/* Explicit local prototype erasure: one atomic fresh profile, then safe cleanup.
 * UI confirmation and in-document observation shutdown are tested by the app suite. */
'use strict';
const assert=require('node:assert/strict');
const {createStore}=require('./dist/session-store.js');
const GameSave=require('./dist/game-save.js');
const Lives=require('./dist/lives.js');
const {HexLifePrototype}=require('./dist/life-providers.js');
const lifeConfig=require('./dist/lives-config.json');
const tutorials=require('./data/tutorials-fixed.json').levels;
const levels=[...tutorials,...require('./data/levels-original.json').levels];
const KEY='hexrota-profile-v2',GAME='hexrota-match-v5',ENERGY='hexrota-lives-v1',LOCK='hexrota-profile-writer-v2';
const removed=['hexrota-match-v4','hexrota-match-v3','hexrota-match-v2','hexrota-v1','hexrota-events-v1','hexrota-playtest-v1'];
const NOW=Date.UTC(2026,10,16,12),manager=Lives.createManager(lifeConfig,{clock:()=>NOW});
const clone=value=>JSON.parse(JSON.stringify(value));
const fresh=()=>({game:GameSave.defaults(),energy:HexLifePrototype.createState(manager.createState(),{providerNamespace:'reset-test-new'})});
function memory(){
 const values=new Map(),calls=[];
 return {values,calls,getItem(key){calls.push(['get',key]);return values.has(key)?values.get(key):null;},setItem(key,value){calls.push(['set',key]);values.set(key,String(value));},removeItem(key){calls.push(['remove',key]);values.delete(key);}};
}
function dirty(storage){
 const store=createStore(storage),game={...GameSave.defaults(),current:7,done:[0,1,2,3,4],boards:{7:{oldBoard:true}},attempts:{7:{attemptId:'old-attempt'}},guideAcks:['0:1'],records:{2:{score:88,movesLeft:3,plays:1}},variantSelection:{seed:123,serial:82,counts:{1:7},recent:{1:['v4']}}};
 game.economy={gold:120,stars:6,inventory:{greenBrush:2,colorKey:1},transactions:{old:'receipt'}};
 let life=manager.createState();life=manager.settleAttempt(life,{attemptId:'old-failed',levelId:1,tutorial:false,movesUsed:1,outcome:'failed'}).state;
 const energy=HexLifePrototype.createState(life,{providerNamespace:'reset-test-old',gold:270});
 store.commit(game,energy);
 for(const key of removed)storage.setItem(key,JSON.stringify({old:true,sound:true,enabled:true,events:[{old:true}]}));
 storage.setItem(LOCK,'held-writer');storage.setItem('another-app-save','unrelated');storage.setItem('hexrota-balance-lab-test','isolated-lab');storage.calls.length=0;
 return {store,game,energy};
}
let passed=0;
function check(name,run){run();passed++;console.log('PASS '+name);}
check('one canonical transaction replaces progression, currencies, attempts, settings and energy with fresh defaults',()=>{
 const storage=memory(),{store}=dirty(storage),next=fresh(),beforeRevision=store.revision;
 const input=clone(next),result=store.resetForTesting(next.game,next.energy);
 assert.deepEqual(result.cleanupFailures,[]);assert.equal(result.profile.revision,beforeRevision+1);assert.deepEqual(result.profile.game,input.game);assert.deepEqual(result.profile.energy,input.energy);
 assert.deepEqual(next,input,'caller-owned defaults remain immutable');assert.deepEqual(store.current(),result.profile);
 assert.deepEqual(JSON.parse(storage.getItem(KEY)),result.profile);assert.deepEqual(JSON.parse(storage.getItem(GAME)),input.game);assert.deepEqual(JSON.parse(storage.getItem(ENERGY)),input.energy);
 assert.equal(result.profile.game.variantSelection.serial,0);assert.deepEqual(result.profile.game.boards,{});assert.deepEqual(result.profile.game.done,[]);assert.deepEqual(result.profile.game.records,{});assert.equal(result.profile.energy.life.lives,5);assert.equal(result.profile.energy.testWallet.gold,300);assert.deepEqual(result.profile.energy.provider.transactions,{});
 assert.equal(storage.calls.filter(([type,key])=>type==='set'&&key===KEY).length,1,'one canonical write only');
 const authoritative=storage.calls.findIndex(([type,key])=>type==='set'&&key===KEY),cleanup=storage.calls.findIndex(([type])=>type==='remove');assert(authoritative>=0&&cleanup>authoritative,'cleanup cannot run before authoritative success');
 result.profile.game.current=99;assert.equal(store.current().game.current,0,'returned result cannot mutate durable memory');
});
check('cleanup is scoped to actual legacy and observation keys and preserves the live writer lock',()=>{
 const storage=memory(),{store}=dirty(storage),next=fresh();store.resetForTesting(next.game,next.energy);
 for(const key of removed)assert.equal(storage.getItem(key),null,key+' is removed');
 assert.equal(storage.getItem(LOCK),'held-writer');assert.equal(storage.getItem('another-app-save'),'unrelated');assert.equal(storage.getItem('hexrota-balance-lab-test'),'isolated-lab');
 assert.deepEqual(storage.calls.filter(([type])=>type==='remove').map(([,key])=>key),removed,'no clear() or broad prefix deletion');
});
check('the old in-memory writer is revoked before pagehide can restore the old board or repeat the reset',()=>{
 const storage=memory(),{store,game,energy}=dirty(storage),next=fresh(),result=store.resetForTesting(next.game,next.energy),encoded=storage.getItem(KEY);
 assert.throws(()=>store.commit(game,energy),/read_only/);assert.throws(()=>store.resetForTesting(next.game,next.energy),/read_only/);assert.equal(storage.getItem(KEY),encoded);assert.equal(store.revision,result.profile.revision);
});
check('failed canonical write preserves all prior keys and keeps the original writer usable',()=>{
 const storage=memory(),{store,game,energy}=dirty(storage),before=clone(Object.fromEntries(storage.values)),memoryBefore=store.current(),native=storage.setItem;
 storage.setItem=function(key,value){if(key===KEY)throw Error('quota');native.call(this,key,value);};
 const next=fresh();assert.throws(()=>store.resetForTesting(next.game,next.energy),/quota/);assert.deepEqual(Object.fromEntries(storage.values),before);assert.deepEqual(store.current(),memoryBefore);assert.equal(storage.calls.filter(([type])=>type==='remove').length,0);
 storage.setItem=native;store.commit(game,energy);assert.equal(store.revision,memoryBefore.revision+1,'failed reset did not revoke the valid writer');
});
check('stale concurrent stores cannot erase a more recent profile',()=>{
 const storage=memory(),{store}=dirty(storage),stale=createStore(storage),next=fresh();store.commit({current:3},{life:{lives:2}});const before=storage.getItem(KEY);
 assert.throws(()=>stale.resetForTesting(next.game,next.energy),/stale_profile/);assert.equal(storage.getItem(KEY),before);assert.equal(storage.calls.filter(([type])=>type==='remove').length,0);
});
check('a writer created before a successful reset cannot resurrect previous progress',()=>{
 const storage=memory(),{store,game,energy}=dirty(storage),other=createStore(storage),next=fresh();store.resetForTesting(next.game,next.energy);const before=storage.getItem(KEY);
 assert.throws(()=>other.commit(game,energy),/stale_profile/);assert.throws(()=>other.resetForTesting(next.game,next.energy),/stale_profile/);assert.equal(storage.getItem(KEY),before);
});
check('legacy cleanup failures are reported and cannot resurrect the deleted progression on reload',()=>{
 const storage=memory(),{store}=dirty(storage),native=storage.removeItem;
 storage.removeItem=function(key){if(key==='hexrota-match-v4'||key==='hexrota-events-v1')throw Error('remove blocked');native.call(this,key);};
 const next=fresh(),result=store.resetForTesting(next.game,next.energy);assert.deepEqual(result.cleanupFailures,['hexrota-match-v4','hexrota-events-v1']);assert.notEqual(storage.getItem('hexrota-match-v4'),null);
 const reloaded=createStore(storage),loaded=GameSave.load({read:key=>reloaded.read(key),contains:key=>reloaded.contains(key),levels,tutorials});
 assert.equal(loaded.migrated,false);assert.equal(loaded.sourceSaveKey,GAME);assert.deepEqual(loaded.saved,GameSave.defaults());assert.equal(reloaded.read(ENERGY).life.lives,5);
});
check('failed mirror repair is reported while the fresh canonical game and energy remain authoritative',()=>{
 const storage=memory(),{store}=dirty(storage),native=storage.setItem;
 storage.setItem=function(key,value){if(key===GAME||key===ENERGY)throw Error('mirror blocked');native.call(this,key,value);};
 const next=fresh(),result=store.resetForTesting(next.game,next.energy);assert.deepEqual(result.cleanupFailures,[GAME,ENERGY]);
 const reloaded=createStore(storage);assert.deepEqual(reloaded.read(GAME),next.game);assert.deepEqual(reloaded.read(ENERGY),next.energy);
});
check('invalid inputs and exhausted revisions cannot produce partial cleanup or revoke the writer',()=>{
 for(const pair of [[null,{}],[{},[]],[false,{}]]){const storage=memory(),{store}=dirty(storage),before=storage.getItem(KEY);assert.throws(()=>store.resetForTesting(...pair),/invalid_profile/);assert.equal(storage.getItem(KEY),before);assert.equal(storage.calls.filter(([type])=>type==='remove').length,0);}
 const storage=memory(),next=fresh();storage.setItem(KEY,JSON.stringify({schemaVersion:2,revision:Number.MAX_SAFE_INTEGER,game:next.game,energy:next.energy}));storage.calls.length=0;const store=createStore(storage);assert.throws(()=>store.resetForTesting(next.game,next.energy),/revision_exhausted/);assert.equal(storage.calls.filter(([type])=>type==='remove').length,0);
});
check('fresh data remains a real valid LifeState v2 and normal writer lifecycle resumes only in a new store',()=>{
 const storage=memory(),{store}=dirty(storage),next=fresh(),result=store.resetForTesting(next.game,next.energy);
 assert.deepEqual(HexLifePrototype.validate(result.profile.energy,manager),next.energy);
 const reloaded=createStore(storage);reloaded.commit(next.game,next.energy);assert.equal(reloaded.revision,result.profile.revision+1);reloaded.revoke();assert.throws(()=>reloaded.resetForTesting(next.game,next.energy),/read_only/);
});
console.log('Full test-profile reset storage checks passed: '+passed+' cases; canonical game/energy atomically replaced, optional cleanup reported, no unrelated data erased.');
