/* Development-only providers. Local receipts are not payment or advertising proof. */
(function(global){
  'use strict';
  const products=Object.freeze(['ad_life','single_life','refill_lives','unlimited_lives_30m','test_gold_300']);
  const token=value=>typeof value==='string'&&!['__proto__','prototype','constructor'].includes(value)&&/^[A-Za-z0-9_.:-]{1,150}$/.test(value);
  const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
  const clone=value=>JSON.parse(JSON.stringify(value));
  function createState({namespace='hexrota-test',adAvailable=true}={}){
    if(!token(namespace)||typeof adAvailable!=='boolean')throw Error('Invalid development provider configuration');
    return {schemaVersion:1,namespace,nextSerial:1,adAvailable,transactions:{}};
  }
  function validate(state){
    if(!state||state.schemaVersion!==1||!token(state.namespace)||!integer(state.nextSerial,1)||typeof state.adAvailable!=='boolean'||!state.transactions||typeof state.transactions!=='object'||Array.isArray(state.transactions))throw Error('Invalid development provider state');
    for(const [id,transaction]of Object.entries(state.transactions)){
      const prefix=state.namespace+'-',serial=id.startsWith(prefix)?Number(id.slice(prefix.length)):NaN;
      if(!token(id)||!integer(serial,1)||serial>=state.nextSerial||id!==prefix+serial||transaction.transactionId!==id||!products.includes(transaction.productId)||!integer(transaction.createdAtUtc)||!['pending','completed','cancelled','unavailable'].includes(transaction.status))throw Error('Invalid development transaction');
      if(transaction.status==='completed'&&(!transaction.receipt||transaction.receipt.transactionId!==id||transaction.receipt.productId!==transaction.productId||transaction.receipt.provider!=='development'||transaction.receipt.status!=='completed'||(!integer(transaction.receipt.verifiedAtUtc)||transaction.receipt.verifiedAtUtc<transaction.createdAtUtc)))throw Error('Invalid development receipt');
    }
    return true;
  }
  function begin(state,{productId,nowUtc}){
    validate(state);if(!products.includes(productId)||!integer(nowUtc))throw Error('Invalid development request');
    if(productId==='ad_life'&&!state.adAvailable)return {state:clone(state),transactionId:null,reason:'unavailable'};
    const next=clone(state),transactionId=`${state.namespace}-${state.nextSerial}`;
    if(next.transactions[transactionId]||state.nextSerial===Number.MAX_SAFE_INTEGER)throw Error('Development transaction identity exhausted');
    next.nextSerial++;next.transactions[transactionId]={transactionId,productId,createdAtUtc:nowUtc,status:'pending'};
    return {state:next,transactionId,reason:'pending'};
  }
  function complete(state,transactionId,{outcome='completed',nowUtc}={}){
    validate(state);if(!token(transactionId)||!integer(nowUtc)||!['completed','cancelled','unavailable'].includes(outcome))throw Error('Invalid development result');
    const next=clone(state),transaction=next.transactions[transactionId];if(!transaction)throw Error('Unknown development transaction');
    if(transaction.status!=='pending')return {state:next,receipt:transaction.receipt?clone(transaction.receipt):null,reason:transaction.status};
    transaction.status=transaction.productId==='ad_life'&&!next.adAvailable?'unavailable':outcome;
    if(transaction.status==='completed')transaction.receipt={transactionId,productId:transaction.productId,provider:'development',status:'completed',verifiedAtUtc:Math.max(nowUtc,transaction.createdAtUtc)};
    return {state:next,receipt:transaction.receipt?clone(transaction.receipt):null,reason:transaction.status};
  }
  function verify(state,receipt){
    try{validate(state);if(!receipt||Object.keys(receipt).sort().join(',')!=='productId,provider,status,transactionId,verifiedAtUtc')return false;
      const expected=state.transactions[receipt.transactionId];return expected?.status==='completed'&&!!expected.receipt&&Object.keys(expected.receipt).every(key=>expected.receipt[key]===receipt[key]);
    }catch(_){return false;}
  }
  function setAdAvailable(state,available){validate(state);if(typeof available!=='boolean')throw Error('Invalid development availability');const next=clone(state);next.adAvailable=available;return next;}
  function createPrototypeState(life,{providerNamespace='hexrota-test',gold=300,adAvailable=true}={}){
    if(!integer(gold)||gold>2147483647)throw Error('Invalid test wallet');
    return {schemaVersion:1,life:clone(life),testWallet:{schemaVersion:1,gold,processedTransactions:{}},provider:createState({namespace:providerNamespace,adAvailable})};
  }
  function validatePrototype(raw,manager){
    if(!raw||raw.schemaVersion!==1||!raw.life||typeof raw.life!=='object'||Array.isArray(raw.life)||!raw.testWallet||raw.testWallet.schemaVersion!==1||!integer(raw.testWallet.gold)||raw.testWallet.gold>2147483647||!raw.testWallet.processedTransactions||typeof raw.testWallet.processedTransactions!=='object'||Array.isArray(raw.testWallet.processedTransactions))throw Error('Invalid life prototype save');
    validate(raw.provider);
    for(const [id,entry]of Object.entries(raw.testWallet.processedTransactions))if(!token(id)||!entry||!products.includes(entry.productId)||!Number.isSafeInteger(entry.goldDelta)||!integer(entry.atUtc))throw Error('Invalid test wallet transaction');
    const life=manager.restore(raw.life);return {schemaVersion:1,life,testWallet:clone(raw.testWallet),provider:clone(raw.provider)};
  }
  global.HexLifeProviders=Object.freeze({products,createState,validate,begin,complete,verify,setAdAvailable});
  global.HexLifePrototype=Object.freeze({createState:createPrototypeState,validate:validatePrototype});
  if(typeof module!=='undefined'&&module.exports)module.exports={HexLifeProviders:global.HexLifeProviders,HexLifePrototype:global.HexLifePrototype};
})(typeof window!=='undefined'?window:globalThis);
