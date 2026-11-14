'use strict';
const assert=require('node:assert/strict');
const {mount,fresh,existing,lifePool,plain,enter,move}=require('./check-lives-ui.cjs');
const {createStore}=require('./dist/session-store.js');
const profileKey='hexrota-profile-v2',gameKey='hexrota-match-v5',lifeKey='hexrota-lives-v1';
async function testAtomicFailure(){
 const entry=existing(),f=mount({saved:entry.saved,life:lifePool(5)});
 try{
  await enter(f);const before=plain(f.save()),livesBefore=plain(f.life());
  const native=f.w.Storage.prototype.setItem;
  f.w.Storage.prototype.setItem=function(key,value){if(key===gameKey||key===profileKey)throw new f.w.DOMException('simulated quota','QuotaExceededError');return native.call(this,key,value);};
  f.click('#reset');f.click('#restart-confirm');
  assert.equal(f.life().life.lives,livesBefore.life.lives,'an unsaved restart cannot debit a life');
  assert.deepEqual(f.save().boards,before.boards,'storage failure retains the durable board');
 }finally{f.close();}
}
async function testCanonicalRecovery(){
 const entry=existing(),f=mount({saved:entry.saved,life:lifePool(5)});
 try{
  await enter(f);const canonical=JSON.parse(f.w.localStorage.getItem(profileKey));
  assert(canonical,'one authoritative profile is present');
  assert.deepEqual(canonical.game.boards,f.save().boards);
  assert.deepEqual(canonical.energy,f.life());
 }finally{f.close();}
}
function testStoreGuards(){
 const memory=()=>{const values=new Map();return {getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value))};};
 for(const invalid of ['null','false','0','[]','""','{"schemaVersion":99}','{"schemaVersion":2,"revision":1,"game":[],"energy":{}}']){const storage=memory();storage.setItem(profileKey,invalid);assert.throws(()=>createStore(storage),/invalid_profile/);assert.equal(storage.getItem(profileKey),invalid);}
 const storage=memory(),a=createStore(storage),b=createStore(storage),game={current:2,boards:{}},energy={life:{lives:5}};
 a.commit(game,energy);assert.throws(()=>b.commit({current:0},energy),/stale_profile/);assert.deepEqual(JSON.parse(storage.getItem(profileKey)).game,game);
 const prior=storage.getItem(profileKey),native=storage.setItem;storage.setItem=(key,value)=>{if(key===profileKey)throw new Error('quota');native(key,value);};assert.throws(()=>a.commit({current:3},energy),/quota/);assert.equal(storage.getItem(profileKey),prior);assert.deepEqual(a.current().game,game);
 storage.setItem=(key,value)=>{if(key===gameKey||key===lifeKey)throw new Error('mirror quota');native(key,value);};a.commit({current:4},energy);assert.equal(a.current().game.current,4);assert.equal(createStore(storage).read(gameKey).current,4);a.revoke();assert.throws(()=>a.commit(game,energy),/read_only/);
}
async function testEmptySlotRollback(){
 const f=mount({saved:fresh(3),life:lifePool(5)});try{
  const before=plain(f.save()),native=f.w.Storage.prototype.setItem;
  f.w.Storage.prototype.setItem=function(key,value){if(key===profileKey)throw new f.w.DOMException('quota','QuotaExceededError');return native.call(this,key,value);};
  f.click('#home-teach');assert.deepEqual(f.save(),before);
  f.w.Storage.prototype.setItem=native;f.return();assert.equal(f.save().current,3);assert.deepEqual(f.save().boards,{});assert.deepEqual(f.save().attempts,{});assert.deepEqual(f.save().variantSelection,before.variantSelection);
  await enter(f);assert.equal(f.game().level.id,2);assert.equal(f.game().values.length,19);
 }finally{f.close();}
}
async function testAsyncHintRollback(){
 const f=mount();try{
  await enter(f);const before=plain(f.save()),events=plain(f.events()),native=f.w.Storage.prototype.setItem;
  f.w.Storage.prototype.setItem=function(key,value){if(key===profileKey)throw new f.w.DOMException('quota','QuotaExceededError');return native.call(this,key,value);};
  f.click('#hint');await new Promise(resolve=>setTimeout(resolve,5));assert.deepEqual(f.save(),before);assert.deepEqual(f.events(),events,'hint observation does not escape a failed profile transaction');
 }finally{f.close();}
}
async function testProviderBeginRollback(){
 const f=mount({life:lifePool(2)}),errors=[];f.w.addEventListener('error',event=>errors.push(event.message));try{
  f.click('#home-lives');const before=plain(f.life()),native=f.w.Storage.prototype.setItem;
  f.w.Storage.prototype.setItem=function(key,value){if(key===profileKey)throw new f.w.DOMException('quota','QuotaExceededError');return native.call(this,key,value);};
  f.click('#lives-buy-one');assert.deepEqual(f.life(),before);assert(!f.node('#life-provider-dialog').open,'an uncommitted provider request is closed');
  f.w.Storage.prototype.setItem=native;f.click('#life-provider-confirm');assert.deepEqual(errors,[]);assert.equal(f.life().testWallet.gold,300);f.return();f.click('#lives-buy-one');f.click('#life-provider-confirm');assert.equal(f.life().life.lives,3);assert.equal(f.life().testWallet.gold,270);assert.deepEqual(errors,[]);
 }finally{f.close();}
}
async function testVerifiedRetry(){
 const f=mount({life:lifePool(2)});try{
  f.click('#home-lives');f.click('#lives-ad');const native=f.w.Storage.prototype.setItem;
  f.w.Storage.prototype.setItem=function(key,value){if(key===profileKey)throw new f.w.DOMException('quota','QuotaExceededError');return native.call(this,key,value);};
  f.click('#life-provider-confirm');assert.equal(f.life().life.lives,2);assert(f.node('#life-provider-dialog').open,'completed receipt remains available for retry after failed storage');
  f.w.Storage.prototype.setItem=native;f.click('#life-provider-confirm');assert.equal(f.life().life.lives,3);assert.equal(f.life().life.adUsage.claims,1);f.click('#life-provider-confirm');assert.equal(f.life().life.lives,3);
 }finally{f.close();}
}
(async()=>{let failed=0;for(const [name,run]of [['atomic game/life failure',testAtomicFailure],['canonical recovery authority',testCanonicalRecovery],['invalid canonical, stale revision, quota, mirrors and revocation',testStoreGuards],['empty durable slot clears reverted tutorial engine and attempt',testEmptySlotRollback],['quota-failed provider begin clears transient transaction and can recover',testProviderBeginRollback],['asynchronous hint stats and local events roll back together',testAsyncHintRollback],['verified receipt can retry after failed storage without watching again',testVerifiedRetry]])try{await run();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+error.message);}if(failed)process.exitCode=1;})().catch(error=>{console.error(error);process.exitCode=1;});
