/* Focused checks for the normal-app development namespace and real catalog.
 * No UI, fabricated completion, replacement gameplay, or storage monkeypatch. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const copy=x=>JSON.parse(JSON.stringify(x)),root=__dirname,prefix='hexrota-flow-9-12:',keys=['hexrota-profile-v2','hexrota-match-v5','hexrota-lives-v1','hexrota-match-v4','hexrota-match-v3','hexrota-match-v2','hexrota-v1','hexrota-events-v1','hexrota-playtest-v1'];
function memory(initial={}){const map=new Map(Object.entries(initial)),log=[];return {map,log,getItem(k){log.push(['read',k]);return map.has(k)?map.get(k):null;},setItem(k,v){log.push(['write',k]);map.set(k,String(v));},removeItem(k){log.push(['remove',k]);map.delete(k);}};}
function load(search=''){
 const backing=memory(),locks=[],window={location:{search},localStorage:backing,navigator:{locks:{request(name){locks.push(name);return Promise.resolve();}}},addEventListener(){}};
 const context={window,performance,URLSearchParams};vm.createContext(context);
 for(const name of ['engine.js','levels.js','variants-data.js','attempts.js','campaign-flow-levels.js','campaign-flow.js','session-store.js'])vm.runInContext(fs.readFileSync(root+'/dist/'+name,'utf8'),context,{filename:name});
 return {...window,backing,locks};
}
const r=load('?dev=flow-9-12'),Engine=r.HexMatch,classic=r.HexAttempts.createCatalog(r.HEX_LEVELS,r.HEX_VARIANTS,Engine),catalog=r.HexCampaignFlow.createCatalog(classic,r.HEX_CAMPAIGN_FLOW_LEVELS,Engine),level=catalog.resolveLevel(6,'flow-v1','campaign-flow-v1');
let groups=0;function test(name,run){run();groups++;console.log('PASS '+name);}

test('flow mode requires the explicit query and never activates on ordinary URLs',()=>{
 for(const query of ['', '?dev=flow', '?dev=flow-9-12x', '?flow=flow-9-12', '?dev=', '?dev=FLOW-9-12'])assert.equal(load(query).HexCampaignFlow.enabled,false,query);
 assert.equal(r.HexCampaignFlow.enabled,true);assert.equal(r.HexCampaignFlow.prefix,prefix);assert.equal(r.HexCampaignFlow.version,'campaign-flow-v1');assert(Object.isFrozen(r.HexCampaignFlow));assert.deepEqual(r.backing.log,[],'bootstrap mode discovery does not read or write profiles');
});
test('all logical storage operations stay inside the development prefix',()=>{
 const backing=memory(Object.fromEntries(keys.map(k=>[k,'production-sentinel:'+k]))),storage=r.HexCampaignFlow.storage(backing);assert(Object.isFrozen(storage));
 for(const key of keys){assert.equal(storage.getItem(key),null);storage.setItem(key,'dev:'+key);assert.equal(storage.getItem(key),'dev:'+key);storage.removeItem(key);assert.equal(storage.getItem(key),null);assert.equal(backing.map.get(key),'production-sentinel:'+key);}
 assert(backing.log.every(([,key])=>key.startsWith(prefix)),'even missing/legacy reads use the development namespace');
});
test('canonical store retains atomic revision and mirrors through the same adapter',()=>{
 const sentinels=Object.fromEntries(keys.map(k=>[k,'production-sentinel:'+k])),backing=memory(sentinels),storage=r.HexCampaignFlow.storage(backing),store=r.HexSessionStore.createStore(storage);
 assert.equal(store.current(),null);const attempt=catalog.start(6,{attemptSerial:1,selectionSeed:123}),game={current:7,done:[],boards:{7:new Engine(attempt.level).snapshot()},attempts:{7:attempt.metadata}},energy={life:{developerBypass:false}};
 const committed=copy(store.commit(game,energy));assert.equal(committed.revision,1);assert.deepEqual(committed.game.done,[]);assert.deepEqual(JSON.parse(backing.map.get(prefix+'hexrota-match-v5')),copy(game));assert.deepEqual(JSON.parse(backing.map.get(prefix+'hexrota-lives-v1')),energy);
 const resumed=r.HexSessionStore.createStore(storage);assert.deepEqual(copy(resumed.current()),committed);resumed.commit(game,energy);assert.throws(()=>store.commit(game,energy),/stale_profile/,'development uses the existing CAS guard');
 for(const [key,value]of Object.entries(sentinels))assert.equal(backing.map.get(key),value);
});
test('development reset cannot remove production or legacy records',()=>{
 const sentinels=Object.fromEntries(keys.map(k=>[k,'production-sentinel:'+k])),backing=memory(sentinels),storage=r.HexCampaignFlow.storage(backing),store=r.HexSessionStore.createStore(storage);
 for(const key of keys)if(!['hexrota-profile-v2','hexrota-match-v5','hexrota-lives-v1'].includes(key))storage.setItem(key,'dev-old');
 const result=copy(store.resetForTesting({current:0,done:[],boards:{}},{life:{}}));assert.deepEqual(result.cleanupFailures,[]);assert.equal(result.profile.revision,1);assert.throws(()=>store.commit({},{}),/read_only/);
 for(const [key,value]of Object.entries(sentinels))assert.equal(backing.map.get(key),value);
 assert(backing.log.every(([,key])=>key.startsWith(prefix)));
});
test('development and ordinary boot use different real writer-lock names',()=>{
 r.HexSessionStore.boot(()=>{});assert.deepEqual(r.locks,[prefix+'hexrota-profile-writer-v2']);const ordinary=load('');ordinary.HexSessionStore.boot(()=>{});assert.deepEqual(ordinary.locks,['hexrota-profile-writer-v2']);
});
test('nine unchanged campaigns delegate every classic variant and initial snapshot',()=>{
 let variants=0;for(const entry of r.HEX_VARIANTS.levels)if(entry.levelId!==6)for(const variant of entry.variants){const a=classic.resolveLevel(entry.levelId,variant.id,r.HEX_VARIANTS.levelDataVersion),b=catalog.resolveLevel(entry.levelId,variant.id,r.HEX_VARIANTS.levelDataVersion);assert.equal(a,b);assert.equal(new Engine(b).snapshot().version,4);variants++;}
 assert.equal(variants,36);const options={attemptSerial:19,selectionSeed:741,previousVariantId:'v1',recentVariantIds:['v2']};for(let id=1;id<=10;id++)if(id!==6)assert.deepEqual(copy(catalog.start(id,options)),copy(classic.start(id,options)));
 const classicSix=classic.start(6,{attemptSerial:2,selectionSeed:63});assert.equal(new Engine(classicSix.level).snapshot().version,4);assert.equal(r.HEX_LEVELS.find(l=>l.id===6).rulesVersion,'classic-v4');
});
test('flow attempt uses numeric six and versioned deterministic metadata',()=>{
 const options={attemptSerial:17,selectionSeed:123},a=catalog.start(6,options),b=catalog.start(6,options);assert.deepEqual(copy(a),copy(b));assert.equal(a.level,level);assert.deepEqual(copy(catalog.list(6)),['flow-v1']);assert.equal(a.metadata.levelId,6);assert.equal(a.metadata.variantId,'flow-v1');assert.equal(a.metadata.levelDataVersion,'campaign-flow-v1');assert.match(a.metadata.attemptId,/^a-6-17-[0-9a-f]{8}$/);
 assert.throws(()=>catalog.start('6',options));assert.throws(()=>catalog.legacyMetadata(6));for(const dataVersion of ['original-v1','variants-v1','campaign-flow-v2']){assert.throws(()=>catalog.resolveLevel(6,'flow-v1',dataVersion));assert.throws(()=>catalog.start(6,{...options,levelDataVersion:dataVersion}));assert.throws(()=>catalog.list(6,dataVersion));}
 for(const options of [{attemptSerial:0},{attemptSerial:1.5},{selectionSeed:-1},{selectionSeed:4294967296}])assert.throws(()=>catalog.start(6,options));
});
test('catalog validates independent real wins and copies its immutable override',()=>{
 const source=copy(r.HEX_CAMPAIGN_FLOW_LEVELS),before=copy(source),fresh=r.HexCampaignFlow.createCatalog(classic,source,Engine),resolved=fresh.resolveLevel(6,'flow-v1','campaign-flow-v1');assert.deepEqual(source,before);assert(Object.isFrozen(resolved));assert(Object.isFrozen(resolved.obstacles));assert(Object.isFrozen(resolved.obstacles.blockers));source[0].initial[0]=999;assert.notEqual(resolved.initial[0],999);
 for(const mutate of [l=>l.solutions=[l.solutions[0]],l=>l.solutions=[l.solutions[0],l.solutions[0]],l=>l.solutions[0]=[[0,0]],l=>l.rulesVersion='classic-v4',l=>l.levelDataVersion='wrong',l=>l.variantId='wrong']){const bad=copy(r.HEX_CAMPAIGN_FLOW_LEVELS);mutate(bad[0]);assert.throws(()=>r.HexCampaignFlow.createCatalog(classic,bad,Engine));}
});
test('flow checkpoint restore verifies history at every prefix of both winning routes',()=>{
 let prefixes=0;for(const route of level.solutions){const started=catalog.start(6,{attemptSerial:3,selectionSeed:59}),g=new Engine(started.level);for(const pair of route){assert(g.swap(...pair).ok);const snapshot=copy(g.snapshot()),record=catalog.checkpoint(started.metadata,g),restored=catalog.restore(6,record),separate=catalog.restore(6,snapshot,started.metadata);assert.deepEqual(copy(restored.snapshot),snapshot);assert.deepEqual(copy(separate.snapshot),snapshot);assert.equal(restored.legacy,false);prefixes++;}assert.equal(g.status,'won');}assert.equal(prefixes,14);
});
test('missing and forged flow checkpoints or identities reject without changing inputs',()=>{
 const started=catalog.start(6,{attemptSerial:4,selectionSeed:91}),g=new Engine(started.level);assert(g.swap(...level.solution[0]).ok);const valid=copy(catalog.checkpoint(started.metadata,g)),baseline=copy(valid);
 for(const mutate of [x=>delete x.snapshot,x=>delete x.snapshot.cellOpen,x=>x.snapshot.cellOpen[0]=!x.snapshot.cellOpen[0],x=>x.snapshot.rngState=1,x=>x.snapshot.blockerHp[0]=0,x=>x.snapshot.history[0]=[0,0],x=>x.levelId='6',x=>x.attemptSerial=0,x=>x.attemptId='a-6-4-deadbeef-extra',x=>x.variantId='v1',x=>x.levelDataVersion='variants-v1']){const forged=copy(valid);mutate(forged);const input=copy(forged);assert.throws(()=>catalog.restore(6,forged));assert.deepEqual(forged,input);}
 assert.throws(()=>catalog.restore(6,valid,valid));assert.throws(()=>catalog.restore(6,null,started.metadata));assert.throws(()=>catalog.restore(6,{},started.metadata));assert.deepEqual(valid,baseline);
});
console.log('Campaign flow adapter: '+groups+' groups; isolated storage/CAS/reset/writer locks, 36 delegated classic variants, 2 real flow routes / 14 replayed prefixes.');
