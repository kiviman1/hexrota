/* Portable life rules. UTC clock and receipt verification are supplied by the host. */
(function(global){
  'use strict';
  const SCHEMA_VERSION=1,RULES_VERSION='lives-v1',DAY_MS=86400000;
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
  function fail(message){throw new Error(message);}
  function freeze(value){if(object(value)||Array.isArray(value)){Object.freeze(value);for(const item of Object.values(value))if(item&&typeof item==='object'&&!Object.isFrozen(item))freeze(item);}return value;}
  function validateConfig(config){
    if(!object(config)||config.schemaVersion!==SCHEMA_VERSION||config.rulesVersion!==RULES_VERSION||config.maxLives!==5||config.initialLives!==5||!integer(config.refillIntervalMs,1)||!integer(config.maxLedgerEntries,1,1000000))fail('Invalid life configuration');
    if(!object(config.firstFailureProtection)||typeof config.firstFailureProtection.enabled!=='boolean'||!Array.isArray(config.firstFailureProtection.levelIds)||config.firstFailureProtection.levelIds.some(value=>!id(value)))fail('Invalid first-failure protection');
    if(!object(config.ads)||!integer(config.ads.rewardLives,1,5)||!integer(config.ads.dailyLimit,1,100)||!integer(config.ads.cooldownMs,1))fail('Invalid life advertisement rules');
    if(!object(config.products)||!object(config.products.single_life)||!object(config.products.refill_lives)||!object(config.products.unlimited_lives_30m)||!integer(config.products.single_life.amount,1,5)||!integer(config.products.unlimited_lives_30m.durationMs,1))fail('Invalid life products');
    for(const name of productIds.filter(name=>name!=='ad_life'))if(!integer(config.products[name].costGold,0,2147483647))fail('Invalid test Gold price');
    if(!object(config.development)||typeof config.development.allowBypass!=='boolean'||!integer(config.development.initialTestGold,0,2147483647))fail('Invalid life development rules');
    return true;
  }
  function createManager(configuration,options={}){
    validateConfig(configuration);const config=freeze(copy(configuration));
    const clock=typeof options.clock==='function'?options.clock:typeof options.clock?.now==='function'?()=>options.clock.now():null;
    if(!clock)fail('LifeManager requires an injected UTC clock');
    const verifier=typeof options.verifyReceipt==='function'?options.verifyReceipt:()=>false;
    function now(){const value=clock();if(!integer(value))fail('Clock must return UTC milliseconds as a safe non-negative integer');return value;}
    const ledgerCount=state=>Object.keys(state.settledAttempts).length+Object.keys(state.processedTransactions).length;
    function validateState(state){
      if(!object(state)||state.schemaVersion!==SCHEMA_VERSION||state.rulesVersion!==RULES_VERSION||!integer(state.lives,0,config.maxLives)||!integer(state.lastSeenUtc)||!nullableTime(state.regenAnchorUtc)||!nullableTime(state.unlimitedUntilUtc)||typeof state.developerBypass!=='boolean')fail('Invalid life save');
      if(state.lives===config.maxLives?state.regenAnchorUtc!==null:state.regenAnchorUtc===null||state.regenAnchorUtc>state.lastSeenUtc)fail('Invalid life refill anchor');
      for(const field of ['settledAttempts','processedTransactions','protectionUsed','firstFailures'])if(!object(state[field]))fail('Invalid life ledger');
      if(ledgerCount(state)>config.maxLedgerEntries)fail('Life ledger exceeds its safe capacity');
      for(const [attemptId,record]of Object.entries(state.settledAttempts)){
        if(!token(attemptId)||!object(record)||!id(record.levelId)||typeof record.tutorial!=='boolean'||!['failed','won','restart'].includes(record.outcome)||!integer(record.movesUsed)||!integer(record.settledAtUtc)||record.settledAtUtc>state.lastSeenUtc||typeof record.charged!=='boolean'||typeof record.discarded!=='boolean'||!nullableTime(record.discardedAtUtc)||record.discarded!==(record.discardedAtUtc!==null)||record.discardedAtUtc!==null&&record.discardedAtUtc>state.lastSeenUtc||!['tutorial','won','no_moves','unlimited','developer_bypass','first_failure','empty','historical',null].includes(record.waiver))fail('Invalid attempt life settlement');
        if(record.charged&&record.waiver!==null||record.outcome==='restart'&&!record.discarded)fail('Inconsistent life settlement');
      }
      for(const [transactionId,record]of Object.entries(state.processedTransactions))if(!token(transactionId)||!object(record)||!productIds.includes(record.productId)||!token(record.provider)||!integer(record.verifiedAtUtc)||!integer(record.processedAtUtc)||record.verifiedAtUtc>record.processedAtUtc||record.processedAtUtc>state.lastSeenUtc||!['granted','rejected'].includes(record.result)||!token(record.reason))fail('Invalid processed life transaction');
      for(const [key,value]of Object.entries(state.protectionUsed))if(!/^(number|string):/.test(key)||value!==true)fail('Invalid protection ledger');
      for(const [key,value]of Object.entries(state.firstFailures))if(!/^(number|string):/.test(key)||!token(value))fail('Invalid first-failure ledger');
      const ad=state.adUsage;
      if(!object(ad)||!integer(ad.dayUtc)||ad.dayUtc>Math.floor(state.lastSeenUtc/DAY_MS)||!integer(ad.claims,0,config.ads.dailyLimit)||!nullableTime(ad.lastClaimUtc)||ad.lastClaimUtc!==null&&ad.lastClaimUtc>state.lastSeenUtc)fail('Invalid advertisement cooldown');
      return true;
    }
    function createState(){
      const time=now();return {schemaVersion:SCHEMA_VERSION,rulesVersion:RULES_VERSION,lives:config.initialLives,regenAnchorUtc:null,lastSeenUtc:time,unlimitedUntilUtc:null,developerBypass:false,settledAttempts:{},processedTransactions:{},protectionUsed:{},firstFailures:{},adUsage:{dayUtc:Math.floor(time/DAY_MS),claims:0,lastClaimUtc:null}};
    }
    function reconcileAt(raw,observedNow){
      validateState(raw);const state=copy(raw),time=Math.max(observedNow,state.lastSeenUtc);state.lastSeenUtc=time;
      if(state.lives<config.maxLives){
        const ticks=Math.floor((time-state.regenAnchorUtc)/config.refillIntervalMs),gain=Math.min(config.maxLives-state.lives,ticks);
        state.lives+=gain;
        if(state.lives===config.maxLives)state.regenAnchorUtc=null;
        else state.regenAnchorUtc+=gain*config.refillIntervalMs;
      }
      if(state.unlimitedUntilUtc!==null&&state.unlimitedUntilUtc<=time)state.unlimitedUntilUtc=null;
      const day=Math.floor(time/DAY_MS);if(day>state.adUsage.dayUtc){state.adUsage.dayUtc=day;state.adUsage.claims=0;}
      return state;
    }
    function reconcile(raw){return reconcileAt(raw,now());}
    function restore(raw){return raw===null||raw===undefined?createState():reconcile(raw);}
    const unlimited=state=>state.unlimitedUntilUtc!==null&&state.unlimitedUntilUtc>state.lastSeenUtc;
    const bypass=state=>config.development.allowBypass&&state.developerBypass;
    function canResume(raw,attemptId){const state=reconcile(raw);return token(attemptId)&&!(owns(state.settledAttempts,attemptId)&&state.settledAttempts[attemptId].discarded);}
    function canStartReconciled(state,context={}){
      if(context.tutorial===true)return true;
      if(context.resume===true)return token(context.attemptId)&&!(owns(state.settledAttempts,context.attemptId)&&state.settledAttempts[context.attemptId].discarded);
      if(ledgerCount(state)>=config.maxLedgerEntries)return false;
      return bypass(state)||unlimited(state)||state.lives>0;
    }
    function canStart(raw,context={}){return canStartReconciled(reconcile(raw),context);}
    function availability(state,productId){
      const time=state.lastSeenUtc;
      const costGold=productId==='ad_life'?0:config.products[productId]?.costGold;
      if(!productIds.includes(productId))return {allowed:false,reason:'unknown_product',costGold:0,availableAtUtc:null,waitMs:null};
      if(ledgerCount(state)>=config.maxLedgerEntries)return {allowed:false,reason:'ledger_full',costGold,availableAtUtc:null,waitMs:null};
      if(productId!=='unlimited_lives_30m'&&state.lives===config.maxLives)return {allowed:false,reason:'already_full',costGold,availableAtUtc:null,waitMs:null};
      if(productId==='ad_life'){
        const cooldownAt=state.adUsage.lastClaimUtc===null?time:state.adUsage.lastClaimUtc+config.ads.cooldownMs;
        const quotaAt=state.adUsage.claims>=config.ads.dailyLimit?(state.adUsage.dayUtc+1)*DAY_MS:time;
        const availableAtUtc=Math.max(cooldownAt,quotaAt);
        if(availableAtUtc>time)return {allowed:false,reason:quotaAt>time?'ad_daily_limit':'ad_cooldown',costGold,availableAtUtc,waitMs:availableAtUtc-time};
      }
      return {allowed:true,reason:'available',costGold,availableAtUtc:time,waitMs:0};
    }
    function transactionAvailability(raw,productId){return availability(reconcile(raw),productId);}
    function view(raw){
      const observedNow=now(),state=reconcileAt(raw,observedNow),time=state.lastSeenUtc,nextLifeAtUtc=state.regenAnchorUtc===null?null:state.regenAnchorUtc+config.refillIntervalMs,ad=availability(state,'ad_life');
      return {lives:state.lives,maxLives:config.maxLives,unlimited:unlimited(state),unlimitedUntilUtc:state.unlimitedUntilUtc,unlimitedRemainingMs:state.unlimitedUntilUtc===null?0:Math.max(0,state.unlimitedUntilUtc-time),nextLifeAtUtc,remainingMs:nextLifeAtUtc===null?0:Math.max(0,nextLifeAtUtc-time),adAvailable:ad.allowed,adReason:ad.reason,adAvailableAtUtc:ad.availableAtUtc,adRemainingMs:ad.waitMs,adClaimsToday:state.adUsage.claims,developerBypass:bypass(state),ledgerFull:ledgerCount(state)>=config.maxLedgerEntries,canStart:canStartReconciled(state),effectiveNowUtc:time,clockRolledBack:observedNow<time};
    }
    function checkedAttempt(attempt,historical=false){
      if(!object(attempt)||!token(attempt.attemptId)||!id(attempt.levelId)||typeof attempt.tutorial!=='boolean'||!integer(attempt.movesUsed)||!(historical?['failed','won']:['failed','won','restart']).includes(attempt.outcome))fail('Invalid life attempt result');
      if(attempt.confirmed!==undefined&&typeof attempt.confirmed!=='boolean')fail('Invalid restart confirmation');
      return attempt;
    }
    function settle(raw,attempt,historical){
      checkedAttempt(attempt,historical);const state=reconcile(raw),time=state.lastSeenUtc,old=owns(state.settledAttempts,attempt.attemptId)?state.settledAttempts[attempt.attemptId]:null;
      if(attempt.outcome==='restart'&&attempt.confirmed!==true)return {state,applied:false,reason:'confirmation_required',charged:false};
      if(old){
        if(old.levelId!==attempt.levelId||old.tutorial!==attempt.tutorial)return {state,applied:false,reason:'attempt_identity_mismatch',charged:false};
        if(old.discarded||old.outcome==='won'||old.outcome===attempt.outcome||historical)return {state,applied:false,reason:'already_settled',charged:false};
        // A future extra-move continuation retains the original settlement for its whole attempt.
        if(attempt.outcome==='won'||attempt.outcome==='restart'){
          old.outcome=attempt.outcome;old.movesUsed=Math.max(old.movesUsed,attempt.movesUsed);
          if(attempt.outcome==='restart'){old.discarded=true;old.discardedAtUtc=time;}
          return {state,applied:true,reason:'result_updated',charged:false};
        }
        return {state,applied:false,reason:'already_settled',charged:false};
      }
      if(ledgerCount(state)>=config.maxLedgerEntries)return {state,applied:false,reason:'ledger_full',charged:false};
      const key=levelKey(attempt.levelId),firstFailure=attempt.outcome==='failed'&&!attempt.tutorial&&!owns(state.firstFailures,key);
      if(firstFailure)state.firstFailures[key]=attempt.attemptId;
      let waiver=null;
      if(historical)waiver='historical';
      else if(attempt.tutorial)waiver='tutorial';
      else if(attempt.outcome==='won')waiver='won';
      else if(attempt.outcome==='restart'&&attempt.movesUsed===0)waiver='no_moves';
      else if(bypass(state))waiver='developer_bypass';
      else if(unlimited(state))waiver='unlimited';
      else if(firstFailure&&config.firstFailureProtection.enabled&&config.firstFailureProtection.levelIds.includes(attempt.levelId)){waiver='first_failure';state.protectionUsed[key]=true;}
      else if(state.lives===0)waiver='empty';
      const charged=waiver===null;
      if(charged){if(state.lives===config.maxLives)state.regenAnchorUtc=time;state.lives--;}
      state.settledAttempts[attempt.attemptId]={levelId:attempt.levelId,tutorial:attempt.tutorial,outcome:attempt.outcome,movesUsed:attempt.movesUsed,settledAtUtc:time,charged,waiver,discarded:attempt.outcome==='restart',discardedAtUtc:attempt.outcome==='restart'?time:null};
      return {state,applied:true,reason:charged?'life_consumed':waiver,charged};
    }
    function settleAttempt(state,attempt){return settle(state,attempt,false);}
    function acknowledgeHistoricalAttempt(state,attempt){return settle(state,attempt,true);}
    function applyTransaction(raw,receipt){
      const state=reconcile(raw),time=state.lastSeenUtc;
      if(!object(receipt)||!token(receipt.transactionId)||!productIds.includes(receipt.productId)||!token(receipt.provider)||receipt.status!=='completed'||!integer(receipt.verifiedAtUtc)||receipt.verifiedAtUtc>time)return {state,applied:false,reason:'invalid_receipt'};
      if(owns(state.processedTransactions,receipt.transactionId))return {state,applied:false,reason:'duplicate_transaction'};
      let verified=false;try{verified=verifier(copy(receipt))===true;}catch(_){}
      if(!verified)return {state,applied:false,reason:'unverified_receipt'};
      if(ledgerCount(state)>=config.maxLedgerEntries)return {state,applied:false,reason:'ledger_full'};
      const available=availability(state,receipt.productId),reason=available.allowed?'granted':available.reason;
      state.processedTransactions[receipt.transactionId]={productId:receipt.productId,provider:receipt.provider,verifiedAtUtc:receipt.verifiedAtUtc,processedAtUtc:time,result:available.allowed?'granted':'rejected',reason};
      if(!available.allowed)return {state,applied:false,reason};
      if(receipt.productId==='unlimited_lives_30m'){
        const until=Math.max(time,state.unlimitedUntilUtc||0)+config.products.unlimited_lives_30m.durationMs;
        if(!integer(until)){state.processedTransactions[receipt.transactionId].result='rejected';state.processedTransactions[receipt.transactionId].reason='time_overflow';return {state,applied:false,reason:'time_overflow'};}
        state.unlimitedUntilUtc=until;
      }else{
        const amount=receipt.productId==='refill_lives'?config.maxLives:receipt.productId==='ad_life'?config.ads.rewardLives:config.products.single_life.amount;
        state.lives=Math.min(config.maxLives,state.lives+amount);
        if(state.lives===config.maxLives)state.regenAnchorUtc=null;
        if(receipt.productId==='ad_life'){state.adUsage.claims++;state.adUsage.lastClaimUtc=time;}
      }
      return {state,applied:true,reason:'granted'};
    }
    function setDeveloperBypass(raw,enabled){
      const state=reconcile(raw);if(typeof enabled!=='boolean')fail('Developer bypass must be boolean');
      if(enabled&&!config.development.allowBypass)return {state,applied:false,reason:'developer_bypass_disabled'};
      const changed=state.developerBypass!==enabled;state.developerBypass=enabled;return {state,applied:changed,reason:changed?'updated':'unchanged'};
    }
    return Object.freeze({config,createState,restore,validateState,reconcile,view,canStart,canResume,settleAttempt,acknowledgeHistoricalAttempt,applyTransaction,transactionAvailability,setDeveloperBypass});
  }
  const api=Object.freeze({SCHEMA_VERSION,RULES_VERSION,DAY_MS,validateConfig,createManager});
  global.HexLives=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
