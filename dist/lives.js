/* Portable life rules. UTC time and receipt verification are supplied by the host. */
(function(global){
  'use strict';
  const SCHEMA_VERSION=2,RULES_VERSION='lives-v2',DAY_MS=86400000;
  // Diagnostic row retention is a host-storage concern, never a gameplay quota.
  const TECHNICAL_RICH_RETENTION=128;
  const productIds=['ad_life','single_life','refill_lives','unlimited_lives_30m'];
  const copy=value=>JSON.parse(JSON.stringify(value));
  const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
  const reservedTokens=['__proto__','constructor','prototype','toString','toLocaleString','valueOf','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__'];
  const token=value=>typeof value==='string'&&/^[A-Za-z0-9_.:-]{1,180}$/.test(value)&&!reservedTokens.includes(value);
  const id=value=>token(value)||integer(value);
  const levelKey=value=>typeof value+':'+String(value);
  const nullableTime=value=>value===null||integer(value);
  const owns=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const waivers=['tutorial','won','no_moves','unlimited','developer_bypass','first_failure','empty','historical',null];
  function fail(message){throw new Error(message);}
  function freeze(value){if(object(value)||Array.isArray(value)){Object.freeze(value);for(const item of Object.values(value))if(item&&typeof item==='object'&&!Object.isFrozen(item))freeze(item);}return value;}
  function validateConfig(config){
    // Configuration v1 is unchanged: only the life-state contract advances to v2.
    if(!object(config)||!(config.schemaVersion===1&&config.rulesVersion==='lives-v1'||config.schemaVersion===2&&config.rulesVersion==='lives-v2')||config.maxLives!==5||config.initialLives!==5||!integer(config.refillIntervalMs,1)||!integer(config.maxLedgerEntries,1,1000000))fail('Invalid life configuration');
    if(!object(config.firstFailureProtection)||typeof config.firstFailureProtection.enabled!=='boolean'||!Array.isArray(config.firstFailureProtection.levelIds)||config.firstFailureProtection.levelIds.some(value=>!id(value)))fail('Invalid first-failure protection');
    if(!object(config.ads)||!integer(config.ads.rewardLives,1,5)||!integer(config.ads.dailyLimit,1,100)||!integer(config.ads.cooldownMs,1))fail('Invalid life advertisement rules');
    if(!object(config.products)||!object(config.products.single_life)||!object(config.products.refill_lives)||!object(config.products.unlimited_lives_30m)||!integer(config.products.single_life.amount,1,5)||!integer(config.products.unlimited_lives_30m.durationMs,1))fail('Invalid life products');
    for(const name of productIds.filter(name=>name!=='ad_life'))if(!integer(config.products[name].costGold,0,2147483647))fail('Invalid test Gold price');
    if(!object(config.development)||typeof config.development.allowBypass!=='boolean'||!integer(config.development.initialTestGold,0,2147483647))fail('Invalid life development rules');
    return true;
  }
  const archiveSettlement=record=>[record.levelId,record.tutorial,record.outcome,record.movesUsed,record.settledAtUtc,record.charged,record.waiver,record.discardedAtUtc];
  const expandSettlement=entry=>({levelId:entry[0],tutorial:entry[1],outcome:entry[2],movesUsed:entry[3],settledAtUtc:entry[4],charged:entry[5],waiver:entry[6],discarded:entry[7]!==null,discardedAtUtc:entry[7]});
  const archiveTransaction=record=>[record.productId,record.provider,record.verifiedAtUtc,record.processedAtUtc,record.result,record.reason];
  const expandTransaction=entry=>({productId:entry[0],provider:entry[1],verifiedAtUtc:entry[2],processedAtUtc:entry[3],result:entry[4],reason:entry[5]});
  const inRanges=(ranges,value)=>ranges.some(range=>value>=range[0]&&value<=range[1]);
  function addRange(ranges,value){
    const ordered=[...ranges.map(pair=>pair.slice()),[value,value]].sort((a,b)=>a[0]-b[0]),merged=[];
    for(const pair of ordered){const last=merged[merged.length-1];if(last&&pair[0]<=last[1]+1)last[1]=Math.max(last[1],pair[1]);else merged.push(pair);}
    return merged;
  }
  function validRanges(ranges,max=Number.MAX_SAFE_INTEGER){let previous=0;return Array.isArray(ranges)&&ranges.every(pair=>{if(!Array.isArray(pair)||pair.length!==2||!integer(pair[0],1,max)||!integer(pair[1],pair[0],max)||pair[0]<=previous)return false;previous=pair[1]+1;return true;});}
  function createManager(configuration,options={}){
    validateConfig(configuration);const config=freeze(copy(configuration));
    const clock=typeof options.clock==='function'?options.clock:typeof options.clock?.now==='function'?()=>options.clock.now():null;
    if(!clock)fail('LifeManager requires an injected UTC clock');
    const verifier=typeof options.verifyReceipt==='function'?options.verifyReceipt:()=>false;
    function now(){const value=clock();if(!integer(value))fail('Clock must return UTC milliseconds as a safe non-negative integer');return value;}
    const richCount=state=>Object.keys(state.settledAttempts).length+Object.keys(state.processedTransactions).length;
    function checkSettlement(attemptId,record,time){
      if(!token(attemptId)||!object(record)||!id(record.levelId)||typeof record.tutorial!=='boolean'||!['failed','won','restart'].includes(record.outcome)||!integer(record.movesUsed)||!integer(record.settledAtUtc)||record.settledAtUtc>time||typeof record.charged!=='boolean'||typeof record.discarded!=='boolean'||!nullableTime(record.discardedAtUtc)||record.discarded!==(record.discardedAtUtc!==null)||record.discardedAtUtc!==null&&record.discardedAtUtc>time||!waivers.includes(record.waiver))fail('Invalid attempt life settlement');
      if(record.charged&&record.waiver!==null||record.outcome==='restart'&&!record.discarded)fail('Inconsistent life settlement');
    }
    function checkTransaction(transactionId,record,time){if(!token(transactionId)||!object(record)||!productIds.includes(record.productId)||!token(record.provider)||!integer(record.verifiedAtUtc)||!integer(record.processedAtUtc)||record.verifiedAtUtc>record.processedAtUtc||record.processedAtUtc>time||!['granted','rejected'].includes(record.result)||!token(record.reason))fail('Invalid processed life transaction');}
    function validateState(state){
      const legacy=state?.schemaVersion===1&&state?.rulesVersion==='lives-v1';
      if(!object(state)||!legacy&&!(state.schemaVersion===SCHEMA_VERSION&&state.rulesVersion===RULES_VERSION)||!integer(state.lives,0,config.maxLives)||!integer(state.lastSeenUtc)||!nullableTime(state.regenAnchorUtc)||!nullableTime(state.unlimitedUntilUtc)||typeof state.developerBypass!=='boolean')fail('Invalid life save');
      if(state.lives===config.maxLives?state.regenAnchorUtc!==null:state.regenAnchorUtc===null||state.regenAnchorUtc>state.lastSeenUtc)fail('Invalid life refill anchor');
      for(const field of ['settledAttempts','processedTransactions','protectionUsed','firstFailures'])if(!object(state[field]))fail('Invalid life ledger');
      for(const [attemptId,record]of Object.entries(state.settledAttempts))checkSettlement(attemptId,record,state.lastSeenUtc);
      for(const [transactionId,record]of Object.entries(state.processedTransactions))checkTransaction(transactionId,record,state.lastSeenUtc);
      if(!legacy){
        if(!integer(state.pendingAdLives))fail('Invalid pending life credit');
        for(const field of ['registeredAttempts','settledArchive','transactionArchive','transactionStreams'])if(!object(state[field]))fail('Invalid compact life ledger');
        for(const [attemptId,record]of Object.entries(state.registeredAttempts))if(!token(attemptId)||!object(record)||!id(record.levelId)||typeof record.tutorial!=='boolean'||!integer(record.startedAtUtc)||record.startedAtUtc>state.lastSeenUtc||typeof record.unlimitedAtStart!=='boolean'||owns(state.settledAttempts,attemptId)||owns(state.settledArchive,attemptId))fail('Invalid registered attempt');
        for(const [attemptId,entry]of Object.entries(state.settledArchive)){if(!Array.isArray(entry)||entry.length!==8||owns(state.settledAttempts,attemptId))fail('Invalid compact settlement');checkSettlement(attemptId,expandSettlement(entry),state.lastSeenUtc);}
        for(const [transactionId,entry]of Object.entries(state.transactionArchive)){if(!Array.isArray(entry)||entry.length!==6||owns(state.processedTransactions,transactionId))fail('Invalid compact transaction');checkTransaction(transactionId,expandTransaction(entry),state.lastSeenUtc);}
        for(const [streamId,stream]of Object.entries(state.transactionStreams))if(!token(streamId)||!object(stream)||!token(stream.provider)||!validRanges(stream.ranges))fail('Invalid verified transaction stream');
        for(const [transactionId,record]of Object.entries(state.processedTransactions))if((record.streamId!==undefined||record.sequence!==undefined)&&(!token(record.streamId)||!integer(record.sequence,1)||transactionId!==record.streamId+'-'+record.sequence||!owns(state.transactionStreams,record.streamId)||state.transactionStreams[record.streamId].provider!==record.provider||!inRanges(state.transactionStreams[record.streamId].ranges,record.sequence)))fail('Invalid streamed transaction');
      }
      for(const [key,value]of Object.entries(state.protectionUsed))if(!/^(number|string):/.test(key)||value!==true)fail('Invalid protection ledger');
      for(const [key,value]of Object.entries(state.firstFailures))if(!/^(number|string):/.test(key)||!token(value))fail('Invalid first-failure ledger');
      const ad=state.adUsage;if(!object(ad)||!integer(ad.dayUtc)||ad.dayUtc>Math.floor(state.lastSeenUtc/DAY_MS)||!integer(ad.claims,0,config.ads.dailyLimit)||!nullableTime(ad.lastClaimUtc)||ad.lastClaimUtc!==null&&ad.lastClaimUtc>state.lastSeenUtc)fail('Invalid advertisement cooldown');
      return true;
    }
    function createState(){const time=now();return {schemaVersion:SCHEMA_VERSION,rulesVersion:RULES_VERSION,lives:config.initialLives,regenAnchorUtc:null,lastSeenUtc:time,unlimitedUntilUtc:null,developerBypass:false,registeredAttempts:{},pendingAdLives:0,settledAttempts:{},settledArchive:{},processedTransactions:{},transactionArchive:{},transactionStreams:{},protectionUsed:{},firstFailures:{},adUsage:{dayUtc:Math.floor(time/DAY_MS),claims:0,lastClaimUtc:null}};}
    function migrate(raw){
      validateState(raw);const state=copy(raw);
      if(state.schemaVersion===1){state.schemaVersion=SCHEMA_VERSION;state.rulesVersion=RULES_VERSION;state.registeredAttempts={};state.pendingAdLives=0;state.settledArchive={};state.transactionArchive={};state.transactionStreams={};}
      return state;
    }
    function compact(state){
      // Rich audit rows are bounded. Exact legacy identities are never forgotten.
      const rows=[...Object.entries(state.settledAttempts).map(([key,value])=>({kind:'attempt',key,time:value.settledAtUtc})),...Object.entries(state.processedTransactions).map(([key,value])=>({kind:'transaction',key,time:value.processedAtUtc}))].sort((a,b)=>a.time-b.time||(a.key<b.key?-1:a.key>b.key?1:0));
      for(const row of rows.slice(0,Math.max(0,rows.length-Math.min(config.maxLedgerEntries,TECHNICAL_RICH_RETENTION)))){
        if(row.kind==='attempt'){state.settledArchive[row.key]=archiveSettlement(state.settledAttempts[row.key]);delete state.settledAttempts[row.key];}
        else{const record=state.processedTransactions[row.key];if(record.streamId===undefined)state.transactionArchive[row.key]=archiveTransaction(record);delete state.processedTransactions[row.key];}
      }
      return state;
    }
    function applyPending(state){const gain=Math.min(config.maxLives-state.lives,state.pendingAdLives);state.lives+=gain;state.pendingAdLives-=gain;if(state.lives===config.maxLives)state.regenAnchorUtc=null;}
    function reconcileAt(raw,observedNow){
      const state=migrate(raw),time=Math.max(observedNow,state.lastSeenUtc);state.lastSeenUtc=time;
      if(state.lives<config.maxLives){const ticks=Math.floor((time-state.regenAnchorUtc)/config.refillIntervalMs),gain=Math.min(config.maxLives-state.lives,ticks);state.lives+=gain;if(state.lives===config.maxLives)state.regenAnchorUtc=null;else state.regenAnchorUtc+=gain*config.refillIntervalMs;}
      applyPending(state);
      if(state.unlimitedUntilUtc!==null&&state.unlimitedUntilUtc<=time)state.unlimitedUntilUtc=null;
      const day=Math.floor(time/DAY_MS);if(day>state.adUsage.dayUtc){state.adUsage.dayUtc=day;state.adUsage.claims=0;}
      return compact(state);
    }
    function reconcile(raw){return reconcileAt(raw,now());}
    function restore(raw){return raw===null||raw===undefined?createState():reconcile(raw);}
    const unlimited=state=>state.unlimitedUntilUtc!==null&&state.unlimitedUntilUtc>state.lastSeenUtc;
    const bypass=state=>config.development.allowBypass&&state.developerBypass;
    const settlement=(state,attemptId)=>owns(state.settledAttempts,attemptId)?state.settledAttempts[attemptId]:owns(state.settledArchive,attemptId)?expandSettlement(state.settledArchive[attemptId]):null;
    function settlementFor(raw,attemptId){const state=reconcile(raw);return token(attemptId)?copy(settlement(state,attemptId)):null;}
    function registeredAttemptFor(raw,attemptId){const state=reconcile(raw);return token(attemptId)&&owns(state.registeredAttempts,attemptId)?copy(state.registeredAttempts[attemptId]):null;}
    function canResume(raw,attemptId){const state=reconcile(raw);return token(attemptId)&&!settlement(state,attemptId)?.discarded;}
    function canStartReconciled(state,context={}){if(context.tutorial===true)return true;if(context.resume===true)return token(context.attemptId)&&!settlement(state,context.attemptId)?.discarded;return bypass(state)||unlimited(state)||state.lives>0;}
    function canStart(raw,context={}){return canStartReconciled(reconcile(raw),context);}
    function registerAttempt(raw,context){
      if(!object(context)||!token(context.attemptId)||!id(context.levelId)||typeof context.tutorial!=='boolean')fail('Invalid life attempt registration');
      const state=reconcile(raw),old=owns(state.registeredAttempts,context.attemptId)?state.registeredAttempts[context.attemptId]:settlement(state,context.attemptId);
      if(old){if(old.levelId!==context.levelId||old.tutorial!==context.tutorial)return {state,applied:false,reason:'attempt_identity_mismatch'};return {state,applied:false,reason:owns(state.registeredAttempts,context.attemptId)?'already_registered':'already_settled'};}
      if(!canStartReconciled(state,context))return {state,applied:false,reason:'no_lives'};
      state.registeredAttempts[context.attemptId]={levelId:context.levelId,tutorial:context.tutorial,startedAtUtc:state.lastSeenUtc,unlimitedAtStart:unlimited(state)};
      return {state,applied:true,reason:'registered'};
    }
    function availability(state,productId,completed=false){
      const time=state.lastSeenUtc,costGold=productId==='ad_life'?0:config.products[productId]?.costGold;
      if(!productIds.includes(productId))return {allowed:false,reason:'unknown_product',costGold:0,availableAtUtc:null,waitMs:null};
      if(productId!=='unlimited_lives_30m'&&state.lives===config.maxLives&&!(completed&&productId==='ad_life'))return {allowed:false,reason:'already_full',costGold,availableAtUtc:null,waitMs:null};
      if(productId==='ad_life'){
        const cooldownAt=state.adUsage.lastClaimUtc===null?time:state.adUsage.lastClaimUtc+config.ads.cooldownMs,quotaAt=state.adUsage.claims>=config.ads.dailyLimit?(state.adUsage.dayUtc+1)*DAY_MS:time,availableAtUtc=Math.max(cooldownAt,quotaAt);
        if(availableAtUtc>time)return {allowed:false,reason:quotaAt>time?'ad_daily_limit':'ad_cooldown',costGold,availableAtUtc,waitMs:availableAtUtc-time};
      }
      return {allowed:true,reason:'available',costGold,availableAtUtc:time,waitMs:0};
    }
    function transactionAvailability(raw,productId){return availability(reconcile(raw),productId);}
    function view(raw){
      const observedNow=now(),state=reconcileAt(raw,observedNow),time=state.lastSeenUtc,nextLifeAtUtc=state.regenAnchorUtc===null?null:state.regenAnchorUtc+config.refillIntervalMs,ad=availability(state,'ad_life');
      return {lives:state.lives,maxLives:config.maxLives,pendingAdLives:state.pendingAdLives,unlimited:unlimited(state),unlimitedUntilUtc:state.unlimitedUntilUtc,unlimitedRemainingMs:state.unlimitedUntilUtc===null?0:Math.max(0,state.unlimitedUntilUtc-time),nextLifeAtUtc,remainingMs:nextLifeAtUtc===null?0:Math.max(0,nextLifeAtUtc-time),adAvailable:ad.allowed,adReason:ad.reason,adAvailableAtUtc:ad.availableAtUtc,adRemainingMs:ad.waitMs,adClaimsToday:state.adUsage.claims,developerBypass:bypass(state),ledgerFull:false,canStart:canStartReconciled(state),effectiveNowUtc:time,clockRolledBack:observedNow<time};
    }
    function checkedAttempt(attempt,historical=false){if(!object(attempt)||!token(attempt.attemptId)||!id(attempt.levelId)||typeof attempt.tutorial!=='boolean'||!integer(attempt.movesUsed)||!(historical?['failed','won']:['failed','won','restart']).includes(attempt.outcome))fail('Invalid life attempt result');if(attempt.confirmed!==undefined&&typeof attempt.confirmed!=='boolean')fail('Invalid restart confirmation');return attempt;}
    function writeSettlement(state,attemptId,record){delete state.settledArchive[attemptId];state.settledAttempts[attemptId]=record;delete state.registeredAttempts[attemptId];return compact(state);}
    function settle(raw,attempt,historical){
      checkedAttempt(attempt,historical);const state=reconcile(raw),time=state.lastSeenUtc,old=settlement(state,attempt.attemptId),registration=state.registeredAttempts[attempt.attemptId];
      if(attempt.outcome==='restart'&&attempt.confirmed!==true)return {state,applied:false,reason:'confirmation_required',charged:false};
      if(registration&&(registration.levelId!==attempt.levelId||registration.tutorial!==attempt.tutorial))return {state,applied:false,reason:'attempt_identity_mismatch',charged:false};
      if(old){
        if(old.levelId!==attempt.levelId||old.tutorial!==attempt.tutorial)return {state,applied:false,reason:'attempt_identity_mismatch',charged:false};
        if(old.discarded||old.outcome==='won'||old.outcome===attempt.outcome||historical)return {state,applied:false,reason:'already_settled',charged:false};
        // A future extra-move continuation keeps its original charge or waiver.
        if(attempt.outcome==='won'||attempt.outcome==='restart'){old.outcome=attempt.outcome;old.movesUsed=Math.max(old.movesUsed,attempt.movesUsed);if(attempt.outcome==='restart'){old.discarded=true;old.discardedAtUtc=time;}writeSettlement(state,attempt.attemptId,old);return {state,applied:true,reason:'result_updated',charged:false};}
        return {state,applied:false,reason:'already_settled',charged:false};
      }
      const key=levelKey(attempt.levelId),firstFailure=attempt.outcome==='failed'&&!attempt.tutorial&&!owns(state.firstFailures,key);if(firstFailure)state.firstFailures[key]=attempt.attemptId;
      let waiver=null;
      if(historical)waiver='historical';else if(attempt.tutorial)waiver='tutorial';else if(attempt.outcome==='won')waiver='won';else if(attempt.outcome==='restart'&&attempt.movesUsed===0)waiver='no_moves';else if(bypass(state))waiver='developer_bypass';else if(registration?.unlimitedAtStart||unlimited(state))waiver='unlimited';else if(firstFailure&&config.firstFailureProtection.enabled&&config.firstFailureProtection.levelIds.includes(attempt.levelId)){waiver='first_failure';state.protectionUsed[key]=true;}else if(state.lives===0)waiver='empty';
      const charged=waiver===null;if(charged){if(state.lives===config.maxLives)state.regenAnchorUtc=time;state.lives--;applyPending(state);}
      writeSettlement(state,attempt.attemptId,{levelId:attempt.levelId,tutorial:attempt.tutorial,outcome:attempt.outcome,movesUsed:attempt.movesUsed,settledAtUtc:time,charged,waiver,discarded:attempt.outcome==='restart',discardedAtUtc:attempt.outcome==='restart'?time:null});
      return {state,applied:true,reason:charged?'life_consumed':waiver,charged};
    }
    function settleAttempt(state,attempt){return settle(state,attempt,false);}
    function acknowledgeHistoricalAttempt(state,attempt){return settle(state,attempt,true);}
    function transactionSeen(state,transactionId){
      if(owns(state.processedTransactions,transactionId)||owns(state.transactionArchive,transactionId))return true;
      for(const [streamId,stream]of Object.entries(state.transactionStreams)){const prefix=streamId+'-';if(transactionId.startsWith(prefix)){const serial=Number(transactionId.slice(prefix.length));if(integer(serial,1)&&transactionId===prefix+serial&&inRanges(stream.ranges,serial))return true;}}
      return false;
    }
    function hasTransaction(raw,transactionId){const state=reconcile(raw);return token(transactionId)&&transactionSeen(state,transactionId);}
    function applyTransaction(raw,receipt){
      const state=reconcile(raw),time=state.lastSeenUtc;
      if(!object(receipt)||!token(receipt.transactionId)||!productIds.includes(receipt.productId)||!token(receipt.provider)||receipt.status!=='completed'||!integer(receipt.verifiedAtUtc)||receipt.verifiedAtUtc>time)return {state,applied:false,reason:'invalid_receipt'};
      if(transactionSeen(state,receipt.transactionId))return {state,applied:false,reason:'duplicate_transaction'};
      const streamed=receipt.streamId!==undefined||receipt.sequence!==undefined;
      if(streamed&&(!token(receipt.streamId)||!integer(receipt.sequence,1)||receipt.transactionId!==receipt.streamId+'-'+receipt.sequence||owns(state.transactionStreams,receipt.streamId)&&state.transactionStreams[receipt.streamId].provider!==receipt.provider))return {state,applied:false,reason:'invalid_receipt'};
      let verified=false;try{verified=verifier(copy(receipt))===true;}catch(_){}if(!verified)return {state,applied:false,reason:'unverified_receipt'};
      const available=availability(state,receipt.productId,true);let reason=available.allowed?'granted':available.reason;
      if(available.allowed&&receipt.productId==='ad_life'&&!integer(state.pendingAdLives+config.ads.rewardLives))reason='credit_overflow';
      const granted=available.allowed&&reason!=='credit_overflow';
      const record={productId:receipt.productId,provider:receipt.provider,verifiedAtUtc:receipt.verifiedAtUtc,processedAtUtc:time,result:granted?'granted':'rejected',reason};
      if(streamed){record.streamId=receipt.streamId;record.sequence=receipt.sequence;const stream=state.transactionStreams[receipt.streamId]||{provider:receipt.provider,ranges:[]};stream.ranges=addRange(stream.ranges,receipt.sequence);state.transactionStreams[receipt.streamId]=stream;}
      state.processedTransactions[receipt.transactionId]=record;
      if(!granted)return {state:compact(state),applied:false,reason};
      if(receipt.productId==='unlimited_lives_30m'){
        const until=Math.max(time,state.unlimitedUntilUtc||0)+config.products.unlimited_lives_30m.durationMs;
        if(!integer(until)){record.result='rejected';record.reason='time_overflow';return {state:compact(state),applied:false,reason:'time_overflow'};}state.unlimitedUntilUtc=until;
      }else if(receipt.productId==='ad_life'){
        state.pendingAdLives+=config.ads.rewardLives;applyPending(state);state.adUsage.claims++;state.adUsage.lastClaimUtc=time;if(state.pendingAdLives>0){reason='banked';record.reason=reason;}
      }else{const amount=receipt.productId==='refill_lives'?config.maxLives:config.products.single_life.amount;state.lives=Math.min(config.maxLives,state.lives+amount);if(state.lives===config.maxLives)state.regenAnchorUtc=null;}
      return {state:compact(state),applied:true,reason};
    }
    function setDeveloperBypass(raw,enabled){const state=reconcile(raw);if(typeof enabled!=='boolean')fail('Developer bypass must be boolean');if(enabled&&!config.development.allowBypass)return {state,applied:false,reason:'developer_bypass_disabled'};const changed=state.developerBypass!==enabled;state.developerBypass=enabled;return {state,applied:changed,reason:changed?'updated':'unchanged'};}
    return Object.freeze({config,createState,restore,validateState,reconcile,view,canStart,canResume,registerAttempt,registeredAttemptFor,settlementFor,hasTransaction,settleAttempt,acknowledgeHistoricalAttempt,applyTransaction,transactionAvailability,setDeveloperBypass});
  }
  const api=Object.freeze({SCHEMA_VERSION,RULES_VERSION,DAY_MS,TECHNICAL_RICH_RETENTION,validateConfig,createManager});global.HexLives=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
