/* Pure rescue rules and an explicitly TEST-only provider. No storage, UI, SDK or device clock. */
(function(root){
 'use strict';
 const DAY=86400000,VERSION='rescue-v1',PRODUCT='rescue_moves_5',PROVIDER='development_rescue',RETENTION=128;
 const copy=value=>JSON.parse(JSON.stringify(value)),object=value=>!!value&&typeof value==='object'&&!Array.isArray(value),owns=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const reserved=new Set(['__proto__','prototype','constructor','toString','toLocaleString','valueOf','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__']);
 const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
 const token=value=>typeof value==='string'&&!reserved.has(value)&&value.length>=1&&value.length<=180&&[...value].every(ch=>/[A-Za-z0-9_.:-]/.test(ch));
 const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>owns(value,key));
 const sorted=(a,b)=>a.atUtc-b.atUtc||(a.id<b.id?-1:a.id>b.id?1:0);
 function need(ok,code){if(!ok)throw Error(code);}
 function serialFor(state,id){const prefix=state.namespace+'-',number=typeof id==='string'&&id.startsWith(prefix)?Number(id.slice(prefix.length)):NaN;return integer(number,1)&&id===prefix+number?number:null;}
 function inRanges(ranges,value){return ranges.some(pair=>value>=pair[0]&&value<=pair[1]);}
 function validRanges(ranges,max){let previous=0;return Array.isArray(ranges)&&ranges.every(pair=>{if(!Array.isArray(pair)||pair.length!==2||!integer(pair[0],1)||!integer(pair[1],pair[0])||pair[1]>=max||pair[0]<=previous)return false;previous=pair[1]+1;return true;});}
 function addRange(ranges,value){const result=[];for(const pair of [...ranges.map(pair=>pair.slice()),[value,value]].sort((a,b)=>a[0]-b[0])){const last=result[result.length-1];if(last&&pair[0]<=last[1]+1)last[1]=Math.max(last[1],pair[1]);else result.push(pair);}return result;}
 function validateProvider(state){
  need(exact(state,['schemaVersion','namespace','nextSerial','adAvailable','transactions','finalizedRanges'])&&state.schemaVersion===1&&token(state.namespace)&&state.namespace.length<=140&&integer(state.nextSerial,1)&&typeof state.adAvailable==='boolean'&&object(state.transactions)&&validRanges(state.finalizedRanges,state.nextSerial),'invalid_rescue_provider');
  for(const [id,transaction]of Object.entries(state.transactions)){
   const serial=serialFor(state,id);need(token(id)&&serial!==null&&serial<state.nextSerial&&!inRanges(state.finalizedRanges,serial)&&object(transaction)&&token(transaction.attemptId)&&integer(transaction.levelId,1)&&integer(transaction.createdAtUtc)&&transaction.transactionId===id&&['pending','completed','cancelled','unavailable'].includes(transaction.status),'invalid_rescue_provider_transaction');
   const fields=['transactionId','attemptId','levelId','createdAtUtc','status'];if(transaction.status==='completed')fields.push('receipt');need(exact(transaction,fields),'invalid_rescue_provider_transaction');
   if(transaction.status==='completed'){
    const receipt=transaction.receipt;need(exact(receipt,['schemaVersion','provider','productId','status','transactionId','attemptId','levelId','verifiedAtUtc','streamId','sequence'])&&receipt.schemaVersion===1&&receipt.provider===PROVIDER&&receipt.productId===PRODUCT&&receipt.status==='completed'&&receipt.transactionId===id&&receipt.attemptId===transaction.attemptId&&receipt.levelId===transaction.levelId&&integer(receipt.verifiedAtUtc,transaction.createdAtUtc)&&receipt.streamId===state.namespace&&receipt.sequence===serial,'invalid_rescue_receipt');
   }
  }
  return true;
 }
 function createProvider({namespace='hexrota-rescue-test',adAvailable=true}={}){need(token(namespace)&&namespace.length<=140&&typeof adAvailable==='boolean','invalid_rescue_provider_configuration');return {schemaVersion:1,namespace,nextSerial:1,adAvailable,transactions:{},finalizedRanges:[]};}
 function providerBegin(state,{attemptId,levelId,nowUtc}){
  validateProvider(state);need(token(attemptId)&&integer(levelId,1)&&integer(nowUtc),'invalid_rescue_request');const next=copy(state);if(!next.adAvailable)return {state:next,transactionId:null,reason:'ad_unavailable'};
  need(next.nextSerial<Number.MAX_SAFE_INTEGER,'rescue_transaction_identity_exhausted');const id=next.namespace+'-'+next.nextSerial++;next.transactions[id]={transactionId:id,attemptId,levelId,createdAtUtc:nowUtc,status:'pending'};return {state:next,transactionId:id,reason:'pending'};
 }
 function providerComplete(state,id,{nowUtc,outcome='completed'}={}){
  validateProvider(state);need(token(id)&&integer(nowUtc)&&['completed','cancelled','unavailable'].includes(outcome),'invalid_rescue_provider_result');const next=copy(state),serial=serialFor(next,id);
  if(serial!==null&&inRanges(next.finalizedRanges,serial))return {state:next,receipt:null,reason:'finalized'};
  need(owns(next.transactions,id),'unknown_rescue_transaction');const transaction=next.transactions[id];if(transaction.status!=='pending')return {state:next,receipt:transaction.receipt?copy(transaction.receipt):null,reason:transaction.status};
  transaction.status=outcome;if(outcome==='completed')transaction.receipt={schemaVersion:1,provider:PROVIDER,productId:PRODUCT,status:'completed',transactionId:id,attemptId:transaction.attemptId,levelId:transaction.levelId,verifiedAtUtc:Math.max(nowUtc,transaction.createdAtUtc),streamId:next.namespace,sequence:serial};
  return {state:next,receipt:transaction.receipt?copy(transaction.receipt):null,reason:transaction.status};
 }
 function providerVerify(state,receipt){try{validateProvider(state);return object(receipt)&&token(receipt.transactionId)&&owns(state.transactions,receipt.transactionId)&&state.transactions[receipt.transactionId].status==='completed'&&JSON.stringify(Object.keys(receipt).sort())===JSON.stringify(Object.keys(state.transactions[receipt.transactionId].receipt).sort())&&Object.keys(receipt).every(key=>receipt[key]===state.transactions[receipt.transactionId].receipt[key]);}catch(_){return false;}}
 function providerFinalize(state,id){validateProvider(state);need(token(id),'invalid_rescue_transaction_identity');const next=copy(state),serial=serialFor(next,id);if(serial!==null&&inRanges(next.finalizedRanges,serial))return next;need(owns(next.transactions,id)&&next.transactions[id].status!=='pending','rescue_transaction_not_terminal');next.finalizedRanges=addRange(next.finalizedRanges,serial);delete next.transactions[id];return next;}
 function providerSetAvailable(state,available){validateProvider(state);need(typeof available==='boolean','invalid_rescue_availability');const next=copy(state);next.adAvailable=available;return next;}
 const TestProvider=Object.freeze({createState:createProvider,validate:validateProvider,begin:providerBegin,complete:providerComplete,verify:providerVerify,finalize:providerFinalize,setAdAvailable:providerSetAvailable});
 function validateConfig(config){need(exact(config,['moves','goldCost','dailyAdLimit','maxPerAttempt'])&&config.moves===5&&integer(config.goldCost,0,2147483647)&&integer(config.dailyAdLimit,1,100)&&config.maxPerAttempt===1,'invalid_rescue_configuration');return true;}
 function claimFor(state,id){if(owns(state.settledAttempts,id))return state.settledAttempts[id];if(owns(state.settledArchive,id)){const row=state.settledArchive[id];return {levelId:row[0],source:row[1],transactionId:row[2],atUtc:row[3]};}return null;}
 function transactionFor(state,id){if(owns(state.processedTransactions,id))return state.processedTransactions[id];if(owns(state.transactionArchive,id)){const row=state.transactionArchive[id];return {attemptId:row[0],levelId:row[1],source:row[2],atUtc:row[3],moves:5,costGold:row[4]};}return null;}
 function validClaim(row){return exact(row,['levelId','source','transactionId','atUtc'])&&integer(row.levelId,1)&&['ad','gold'].includes(row.source)&&token(row.transactionId)&&integer(row.atUtc);}
 function validTransaction(row){return exact(row,['attemptId','levelId','source','atUtc','moves','costGold'])&&token(row.attemptId)&&integer(row.levelId,1)&&['ad','gold'].includes(row.source)&&integer(row.atUtc)&&row.moves===5&&integer(row.costGold,0,2147483647)&&(row.source!=='ad'||row.costGold===0);}
 function validateState(state){
  need(exact(state,['schemaVersion','rulesVersion','lastSeenUtc','adUsage','settledAttempts','settledArchive','processedTransactions','transactionArchive','provider'])&&state.schemaVersion===1&&state.rulesVersion===VERSION&&integer(state.lastSeenUtc)&&exact(state.adUsage,['day','count'])&&integer(state.adUsage.day,0,Math.floor(Number.MAX_SAFE_INTEGER/DAY))&&integer(state.adUsage.count,0,1000000)&&state.adUsage.day<=Math.floor(state.lastSeenUtc/DAY)&&object(state.settledAttempts)&&object(state.settledArchive)&&object(state.processedTransactions)&&object(state.transactionArchive),'invalid_rescue_state');validateProvider(state.provider);
  for(const [id,row]of Object.entries(state.settledArchive))need(token(id)&&!owns(state.settledAttempts,id)&&Array.isArray(row)&&row.length===4&&validClaim({levelId:row[0],source:row[1],transactionId:row[2],atUtc:row[3]}),'invalid_rescue_settlement');
  for(const [id,row]of Object.entries(state.transactionArchive))need(token(id)&&!owns(state.processedTransactions,id)&&Array.isArray(row)&&row.length===5&&validTransaction({attemptId:row[0],levelId:row[1],source:row[2],atUtc:row[3],moves:5,costGold:row[4]}),'invalid_rescue_transaction');
  for(const id of [...Object.keys(state.settledAttempts),...Object.keys(state.settledArchive)]){const claim=claimFor(state,id),transaction=transactionFor(state,claim?.transactionId);need(token(id)&&validClaim(claim)&&claim.atUtc<=state.lastSeenUtc&&transaction&&transaction.attemptId===id&&transaction.levelId===claim.levelId&&transaction.source===claim.source&&transaction.atUtc===claim.atUtc,'invalid_rescue_settlement');}
  for(const id of [...Object.keys(state.processedTransactions),...Object.keys(state.transactionArchive)]){const transaction=transactionFor(state,id),claim=claimFor(state,transaction?.attemptId);need(token(id)&&validTransaction(transaction)&&transaction.atUtc<=state.lastSeenUtc&&claim&&claim.transactionId===id&&claim.levelId===transaction.levelId&&claim.source===transaction.source&&claim.atUtc===transaction.atUtc,'invalid_rescue_transaction');}
  return true;
 }
 function validateContext(input){need(exact(input,['attemptId','levelId','tutorial','cleared','status','movesLeft','turn','lastCommand','rescuesUsed'])&&token(input.attemptId)&&typeof input.tutorial==='boolean'&&(input.tutorial?token(input.levelId):integer(input.levelId,1))&&typeof input.cleared==='boolean'&&['playing','won','lost'].includes(input.status)&&integer(input.movesLeft)&&integer(input.turn)&&(input.lastCommand===null||token(input.lastCommand))&&integer(input.rescuesUsed),'invalid_rescue_context');return input;}
 function compact(state){
  const claims=Object.entries(state.settledAttempts).map(([id,row])=>({id,atUtc:row.atUtc})).sort(sorted);for(const {id}of claims.slice(0,Math.max(0,claims.length-RETENTION))){const row=state.settledAttempts[id];state.settledArchive[id]=[row.levelId,row.source,row.transactionId,row.atUtc];delete state.settledAttempts[id];}
  const transactions=Object.entries(state.processedTransactions).map(([id,row])=>({id,atUtc:row.atUtc})).sort(sorted);for(const {id}of transactions.slice(0,Math.max(0,transactions.length-RETENTION))){const row=state.processedTransactions[id];state.transactionArchive[id]=[row.attemptId,row.levelId,row.source,row.atUtc,row.costGold];delete state.processedTransactions[id];}
  // A completed but undelivered receipt is an earned entitlement, not a closed
  // journal entry. Only processed completions may be compacted to tombstones.
  const closed=Object.entries(state.provider.transactions).filter(([id,row])=>row.status!=='pending'&&(row.status!=='completed'||transactionFor(state,id))).map(([id,row])=>({id,atUtc:row.createdAtUtc})).sort(sorted);for(const {id}of closed.slice(0,Math.max(0,closed.length-RETENTION)))state.provider=providerFinalize(state.provider,id);
  return state;
 }
 function createManager(configuration,{clock,verifyReceipt}={}){
  validateConfig(configuration);need(typeof clock==='function'&&(verifyReceipt===undefined||typeof verifyReceipt==='function'),'rescue_clock_and_verifier_required');const config=copy(configuration),verify=verifyReceipt||(()=>false);
  function now(){const value=clock();need(integer(value),'invalid_rescue_clock');return value;}
  function createState(options={}){const time=now();return {schemaVersion:1,rulesVersion:VERSION,lastSeenUtc:time,adUsage:{day:Math.floor(time/DAY),count:0},settledAttempts:{},settledArchive:{},processedTransactions:{},transactionArchive:{},provider:createProvider(options)};}
  function reconcile(state){validateState(state);const next=copy(state),time=Math.max(now(),state.lastSeenUtc),day=Math.floor(time/DAY);next.lastSeenUtc=time;if(next.adUsage.day!==day)next.adUsage={day,count:0};return compact(next);}
  function eligibility(state,input){validateContext(input);if(input.tutorial)return 'tutorial';if(input.cleared)return 'level_cleared';if(claimFor(state,input.attemptId)||input.rescuesUsed>=config.maxPerAttempt)return 'already_rescued';if(input.status!=='lost'||input.movesLeft!==0||input.turn<1||input.lastCommand!=='swap')return 'not_lost_after_swap';return null;}
  function pendingFor(state,input){return Object.values(state.provider.transactions).find(row=>row.attemptId===input.attemptId&&row.levelId===input.levelId&&row.status==='pending')||null;}
  function reserved(state){return Object.values(state.provider.transactions).filter(row=>['pending','completed'].includes(row.status)&&!claimFor(state,row.attemptId)&&Math.floor(row.createdAtUtc/DAY)===state.adUsage.day).length;}
  function availabilityAt(state,input,gold){need(integer(gold,0,2147483647),'invalid_rescue_gold');const reason=eligibility(state,input),held=reason?null:retainedReceiptFor(state,{attemptId:input.attemptId,levelId:input.levelId}),pending=reason?null:pendingFor(state,input),quotaLeft=Math.max(0,config.dailyAdLimit-state.adUsage.count),reservation=reserved(state);const adReason=reason||(held?'receipt_pending_delivery':!state.provider.adAvailable?'ad_unavailable':pending?'ad_pending':quotaLeft===0?'daily_limit':reservation>=quotaLeft?'daily_reserved':null),goldReason=reason||(held?'receipt_pending_delivery':gold<config.goldCost?'insufficient_gold':null);return {eligible:!reason,reason,attemptId:input.attemptId,moves:config.moves,costGold:config.goldCost,effectiveNowUtc:state.lastSeenUtc,ad:{allowed:!adReason,reason:adReason,remainingToday:quotaLeft,pendingTransactionId:held?.receipt.transactionId||pending?.transactionId||null},gold:{allowed:!goldReason,reason:goldReason,costGold:config.goldCost}};}
  function availability(state,input,{gold}={}){const next=reconcile(state);return availabilityAt(next,input,gold);}
  function result(state,applied,reason,grant=null,costGold=0,transactionId=null){return {state,applied,reason,grant,costGold,transactionId};}
  function beginAd(state,input){const next=reconcile(state),offer=availabilityAt(next,input,0);if(!offer.ad.allowed)return result(next,false,offer.ad.reason,null,0,offer.ad.pendingTransactionId);const begun=providerBegin(next.provider,{attemptId:input.attemptId,levelId:input.levelId,nowUtc:next.lastSeenUtc});next.provider=begun.state;return result(next,false,begun.reason,null,0,begun.transactionId);}
  function completeAd(state,id,{outcome='completed'}={}){const next=reconcile(state),completed=providerComplete(next.provider,id,{nowUtc:next.lastSeenUtc,outcome});next.provider=completed.state;return {...result(next,false,completed.reason,null,0,id),receipt:completed.receipt,completedProvider:copy(completed.state)};}
  function duplicate(state,input,id,source){const previous=transactionFor(state,id);if(!previous)return null;return result(state,false,previous.attemptId===input.attemptId&&previous.levelId===input.levelId&&previous.source===source?'duplicate_transaction':'transaction_conflict',null,0,id);}
  function verifiedCompletion(state,receipt,proof){
   try{validateProvider(proof);if(!object(receipt)||!token(receipt.transactionId))return false;const id=receipt.transactionId,issued=state.provider.transactions[id],completed=proof.transactions[id];return proof.namespace===state.provider.namespace&&!!issued&&!!completed&&issued.attemptId===receipt.attemptId&&issued.levelId===receipt.levelId&&issued.createdAtUtc===completed.createdAtUtc&&(issued.status==='pending'||issued.status==='completed'&&providerVerify(state.provider,receipt))&&providerVerify(proof,receipt)&&verify(copy(receipt),copy(proof))===true;}catch(_){return false;}
  }
  function receiptTimeFloor(state,receipt){
   if(receipt.verifiedAtUtc>state.lastSeenUtc){state.lastSeenUtc=receipt.verifiedAtUtc;const day=Math.floor(state.lastSeenUtc/DAY);if(state.adUsage.day!==day)state.adUsage={day,count:0};}
  }
  function retainedReceiptFor(state,identity){
   validateState(state);need(exact(identity,['attemptId','levelId'])&&token(identity.attemptId)&&integer(identity.levelId,1),'invalid_rescue_receipt_identity');
   const candidates=Object.entries(state.provider.transactions).filter(([id,row])=>row.status==='completed'&&row.attemptId===identity.attemptId&&row.levelId===identity.levelId&&!transactionFor(state,id)).map(([id,row])=>({id,atUtc:row.createdAtUtc,row})).sort(sorted);
   for(const {row}of candidates)if(verifiedCompletion(state,row.receipt,state.provider))return {receipt:copy(row.receipt),completedProvider:copy(state.provider)};
   return null;
  }
  function retainAdReceipt(state,receipt,completedProvider=null){
   const next=reconcile(state);if(!object(receipt)||!token(receipt.transactionId))return result(next,false,'unverified_receipt');const id=receipt.transactionId;
   if(transactionFor(next,id))return result(next,false,'duplicate_transaction',null,0,id);
   const proof=completedProvider||next.provider;if(!verifiedCompletion(next,receipt,proof))return result(next,false,'unverified_receipt',null,0,id);
   receiptTimeFloor(next,receipt);next.provider.transactions[id]=copy(proof.transactions[id]);
   return result(next,false,'receipt_retained',null,0,id);
  }
  function claim(state,input,id,source,costGold){
   state.settledAttempts[input.attemptId]={levelId:input.levelId,source,transactionId:id,atUtc:state.lastSeenUtc};state.processedTransactions[id]={attemptId:input.attemptId,levelId:input.levelId,source,atUtc:state.lastSeenUtc,moves:config.moves,costGold};
   for(const [other,row]of Object.entries(state.provider.transactions))if(other!==id&&row.attemptId===input.attemptId&&row.status==='pending')row.status='cancelled';
   compact(state);const grant={commandId:id,attemptId:input.attemptId,source,moves:config.moves};return result(state,true,'rescued',grant,costGold,id);
  }
  function applyGold(state,input,id,{gold}={}){const next=reconcile(state);validateContext(input);need(token(id),'invalid_rescue_transaction_identity');const repeat=duplicate(next,input,id,'gold');if(repeat)return repeat;const offer=availabilityAt(next,input,gold);if(!offer.gold.allowed)return result(next,false,offer.gold.reason,null,0,id);return claim(next,input,id,'gold',config.goldCost);}
  function applyAd(state,input,receipt,completedProvider=null){
   const next=reconcile(state);validateContext(input);if(!object(receipt)||!token(receipt.transactionId))return result(next,false,'unverified_receipt');const id=receipt.transactionId,repeat=duplicate(next,input,id,'ad');if(repeat)return repeat;
   const reason=eligibility(next,input);if(reason)return result(next,false,reason,null,0,id);
   const proof=completedProvider||next.provider,valid=receipt.attemptId===input.attemptId&&receipt.levelId===input.levelId&&verifiedCompletion(next,receipt,proof);
   if(!valid)return result(next,false,'unverified_receipt',null,0,id);
   // A verified completion observed before a failed save is a durable time floor
   // for redelivery. Backdating it across midnight must not restore daily rights.
   receiptTimeFloor(next,receipt);
   if(next.adUsage.count>=config.dailyAdLimit)return result(next,false,'daily_limit',null,0,id);
   next.provider.transactions[id]=copy(proof.transactions[id]);next.adUsage.count++;return claim(next,input,id,'ad',0);
  }
  function setAdAvailable(state,available){const next=reconcile(state);next.provider=providerSetAvailable(next.provider,available);return next;}
  return Object.freeze({createState,validate:validateState,restore:reconcile,reconcile,availability,beginAd,completeAd,applyAd,applyGold,retainAdReceipt,retainedReceiptFor,setAdAvailable,settlementFor:(state,id)=>{validateState(state);need(token(id),'invalid_rescue_attempt_identity');const row=claimFor(state,id);return row?copy(row):null;},transactionFor:(state,id)=>{validateState(state);need(token(id),'invalid_rescue_transaction_identity');const row=transactionFor(state,id);return row?copy(row):null;}});
 }
 const api=Object.freeze({createManager,validateConfig,TestProvider});root.HexRescue=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
