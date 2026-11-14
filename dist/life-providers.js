/* Development-only providers. Local receipts are not payment or advertising proof. */
(function(global){
  'use strict';
  const products=Object.freeze(['ad_life','single_life','refill_lives','unlimited_lives_30m','test_gold_300']);
  const reserved=['__proto__','prototype','constructor','toString','toLocaleString','valueOf','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__'];
  const token=value=>typeof value==='string'&&!reserved.includes(value)&&/^[A-Za-z0-9_.:-]{1,180}$/.test(value);
  const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
  const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const owns=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const inRanges=(ranges,value)=>ranges.some(pair=>value>=pair[0]&&value<=pair[1]);
  function serialFor(state,id){const prefix=state.namespace+'-',serial=typeof id==='string'&&id.startsWith(prefix)?Number(id.slice(prefix.length)):NaN;return integer(serial,1)&&id===prefix+serial?serial:null;}
  function validRanges(ranges,max){let previous=0;return Array.isArray(ranges)&&ranges.every(pair=>{if(!Array.isArray(pair)||pair.length!==2||!integer(pair[0],1)||!integer(pair[1],pair[0])||pair[1]>=max||pair[0]<=previous)return false;previous=pair[1]+1;return true;});}
  function addRange(ranges,value){const merged=[];for(const pair of [...ranges.map(pair=>pair.slice()),[value,value]].sort((a,b)=>a[0]-b[0])){const last=merged[merged.length-1];if(last&&pair[0]<=last[1]+1)last[1]=Math.max(last[1],pair[1]);else merged.push(pair);}return merged;}
  function createState({namespace='hexrota-test',adAvailable=true}={}){
    if(!token(namespace)||namespace.length>150||typeof adAvailable!=='boolean')throw Error('Invalid development provider configuration');
    return {schemaVersion:2,namespace,nextSerial:1,adAvailable,transactions:{},finalizedRanges:[]};
  }
  function receiptFields(receipt){const keys=Object.keys(receipt).sort().join(',');return keys==='productId,provider,status,transactionId,verifiedAtUtc'||keys==='productId,provider,sequence,status,streamId,transactionId,verifiedAtUtc';}
  function validate(state){
    if(!object(state)||![1,2].includes(state.schemaVersion)||!token(state.namespace)||state.namespace.length>150||!integer(state.nextSerial,1)||typeof state.adAvailable!=='boolean'||!object(state.transactions)||state.schemaVersion===2&&!validRanges(state.finalizedRanges,state.nextSerial))throw Error('Invalid development provider state');
    for(const [id,transaction]of Object.entries(state.transactions)){
      const serial=serialFor(state,id);
      if(!token(id)||serial===null||serial>=state.nextSerial||!object(transaction)||transaction.transactionId!==id||!products.includes(transaction.productId)||!integer(transaction.createdAtUtc)||!['pending','completed','cancelled','unavailable'].includes(transaction.status)||state.schemaVersion===2&&inRanges(state.finalizedRanges,serial))throw Error('Invalid development transaction');
      if(transaction.status==='completed'){
        const receipt=transaction.receipt;
        if(!object(receipt)||!receiptFields(receipt)||receipt.transactionId!==id||receipt.productId!==transaction.productId||receipt.provider!=='development'||receipt.status!=='completed'||!integer(receipt.verifiedAtUtc)||receipt.verifiedAtUtc<transaction.createdAtUtc||(Object.prototype.hasOwnProperty.call(receipt,'streamId')||Object.prototype.hasOwnProperty.call(receipt,'sequence'))&&(receipt.streamId!==state.namespace||receipt.sequence!==serial))throw Error('Invalid development receipt');
      }else if(transaction.receipt!==undefined)throw Error('Invalid development receipt status');
    }
    return true;
  }
  function normalized(state){validate(state);const next=clone(state);if(next.schemaVersion===1){next.schemaVersion=2;next.finalizedRanges=[];}return next;}
  function isFinalized(state,transactionId){validate(state);const serial=serialFor(state,transactionId);return serial!==null&&state.schemaVersion===2&&inRanges(state.finalizedRanges,serial);}
  function begin(state,{productId,nowUtc}){
    const next=normalized(state);if(!products.includes(productId)||!integer(nowUtc))throw Error('Invalid development request');
    if(productId==='ad_life'&&!next.adAvailable)return {state:next,transactionId:null,reason:'unavailable'};
    const transactionId=`${next.namespace}-${next.nextSerial}`;
    if(owns(next.transactions,transactionId)||next.nextSerial===Number.MAX_SAFE_INTEGER)throw Error('Development transaction identity exhausted');
    next.nextSerial++;next.transactions[transactionId]={transactionId,productId,createdAtUtc:nowUtc,status:'pending'};
    return {state:next,transactionId,reason:'pending'};
  }
  function complete(state,transactionId,{outcome='completed',nowUtc}={}){
    const next=normalized(state);if(!token(transactionId)||!integer(nowUtc)||!['completed','cancelled','unavailable'].includes(outcome))throw Error('Invalid development result');
    if(isFinalized(next,transactionId))return {state:next,receipt:null,reason:'finalized'};
    const transaction=owns(next.transactions,transactionId)?next.transactions[transactionId]:null;if(!transaction)throw Error('Unknown development transaction');
    if(transaction.status!=='pending')return {state:next,receipt:transaction.receipt?clone(transaction.receipt):null,reason:transaction.status};
    // Inventory controls future requests; it cannot revoke an already completed ad.
    transaction.status=outcome;
    if(transaction.status==='completed')transaction.receipt={transactionId,productId:transaction.productId,provider:'development',status:'completed',verifiedAtUtc:Math.max(nowUtc,transaction.createdAtUtc),streamId:next.namespace,sequence:serialFor(next,transactionId)};
    return {state:next,receipt:transaction.receipt?clone(transaction.receipt):null,reason:transaction.status};
  }
  function verify(state,receipt){
    try{validate(state);if(!object(receipt)||!receiptFields(receipt)||!token(receipt.transactionId)||!owns(state.transactions,receipt.transactionId))return false;
      const expected=state.transactions[receipt.transactionId];return expected.status==='completed'&&!!expected.receipt&&Object.keys(expected.receipt).length===Object.keys(receipt).length&&Object.keys(expected.receipt).every(key=>expected.receipt[key]===receipt[key]);
    }catch(_){return false;}
  }
  // Host invokes this only in the same durable commit as the terminal outcome.
  // Closed serial ranges never forget a duplicate identity, including cancelled gaps.
  function finalize(state,transactionId){
    const next=normalized(state);if(!token(transactionId))throw Error('Invalid finalized development identity');if(isFinalized(next,transactionId))return next;
    const transaction=owns(next.transactions,transactionId)?next.transactions[transactionId]:null;if(!transaction||transaction.status==='pending')throw Error('Only terminal development transactions can be finalized');
    next.finalizedRanges=addRange(next.finalizedRanges,serialFor(next,transactionId));delete next.transactions[transactionId];return next;
  }
  function setAdAvailable(state,available){const next=normalized(state);if(typeof available!=='boolean')throw Error('Invalid development availability');next.adAvailable=available;return next;}
  function createPrototypeState(life,{providerNamespace='hexrota-test',gold=300,adAvailable=true}={}){
    if(!integer(gold)||gold>2147483647)throw Error('Invalid test wallet');
    return {schemaVersion:1,life:clone(life),testWallet:{schemaVersion:1,gold,processedTransactions:{}},provider:createState({namespace:providerNamespace,adAvailable})};
  }
  function validatePrototype(raw,manager){
    if(!object(raw)||raw.schemaVersion!==1||!object(raw.life)||!object(raw.testWallet)||raw.testWallet.schemaVersion!==1||!integer(raw.testWallet.gold)||raw.testWallet.gold>2147483647||!object(raw.testWallet.processedTransactions))throw Error('Invalid life prototype save');
    validate(raw.provider);for(const [id,entry]of Object.entries(raw.testWallet.processedTransactions))if(!token(id)||!object(entry)||!products.includes(entry.productId)||!Number.isSafeInteger(entry.goldDelta)||!integer(entry.atUtc))throw Error('Invalid test wallet transaction');
    const life=manager.restore(raw.life);return {schemaVersion:1,life,testWallet:clone(raw.testWallet),provider:normalized(raw.provider)};
  }
  global.HexLifeProviders=Object.freeze({products,createState,validate,begin,complete,verify,finalize,isFinalized,setAdAvailable});
  global.HexLifePrototype=Object.freeze({createState:createPrototypeState,validate:validatePrototype});
  if(typeof module!=='undefined'&&module.exports)module.exports={HexLifeProviders:global.HexLifeProviders,HexLifePrototype:global.HexLifePrototype};
})(typeof window!=='undefined'?window:globalThis);
