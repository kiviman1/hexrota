/* Independent registry/archive checks for variable authored flow shapes.
 * Uses real HexMatch/HexAttempts; no alternative game or profile migration. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const copy=x=>JSON.parse(JSON.stringify(x)),archive=require('./data/campaign-flow-levels-v1.json').levels,latest=require('./data/campaign-flow-levels-v2.json').levels,overrides=[...archive,...latest],counts=[43,49,53,61,65],versions=['campaign-flow-v1','campaign-flow-v2'];
function load(search='?dev=flow-9-12'){
 const context={window:{location:{search}},performance,URLSearchParams};vm.createContext(context);for(const file of ['engine.js','levels.js','variants-data.js','attempts.js','campaign-flow.js'])vm.runInContext(fs.readFileSync(__dirname+'/dist/'+file,'utf8'),context,{filename:file});
 return context.window;
}
const r=load(),Engine=r.HexMatch,api=r.HexCampaignFlow,classic=r.HexAttempts.createCatalog(r.HEX_LEVELS,r.HEX_VARIANTS,Engine),current=api.createCatalog(classic,overrides,Engine),options={attemptSerial:19,selectionSeed:73};
let groups=0,archivePrefixes=0,legacyRestores=0,newPrefixes=0;function test(name,fn){fn();groups++;console.log('PASS '+name);}
function sorted(levels){return copy(levels).sort((a,b)=>a.id-b.id);}
function checkpoint(catalog,pick,pair){const g=new Engine(pick.level);assert(g.swap(...pair).ok);return {g,envelope:copy(catalog.checkpoint(pick.metadata,g))};}

test('v2 is current by declared version order independently of override insertion order',()=>{
 const orders=[overrides,overrides.slice().reverse(),[...latest,...archive],[...latest.slice(2),...archive,...latest.slice(0,2)]];
 const expected=sorted(latest),reference=latest.map(l=>copy(current.start(l.id,options)));
 for(const order of orders){const before=copy(order);assert.deepEqual(sorted(api.currentLevels(order)),expected);const candidate=api.createCatalog(classic,order,Engine);for(let i=0;i<latest.length;i++)assert.deepEqual(copy(candidate.start(latest[i].id,options)),reference[i]);assert.deepEqual(copy(order),before,'registry neither sorts nor mutates source arrays');}
});
test('default new attempts for six through ten use the five actual v2 cell counts',()=>{
 for(let i=0;i<latest.length;i++){const level=latest[i],pick=current.start(level.id,options);assert.equal(pick.metadata.levelId,level.id);assert.equal(pick.metadata.variantId,'flow-v2');assert.equal(pick.metadata.levelDataVersion,'campaign-flow-v2');assert.equal(pick.level.cells.length,counts[i]);assert.deepEqual(copy(current.list(level.id)),['flow-v2']);assert.equal(new Engine(pick.level).total,counts[i]);assert.equal(current.resolveLevel(level.id,'flow-v2','campaign-flow-v2'),pick.level);const {g,envelope}=checkpoint(current,pick,level.solution[0]),restored=current.restore(level.id,envelope);assert.deepEqual(copy(restored.snapshot),copy(g.snapshot()));assert.equal(restored.level.cells.length,counts[i]);newPrefixes++;}
});
test('first five campaign IDs keep all twenty classic variants and start/restore behavior',()=>{
 for(let id=1;id<=5;id++){assert.deepEqual(copy(current.start(id,options)),copy(classic.start(id,options)));assert.deepEqual(copy(current.list(id)),copy(classic.list(id)));for(const variant of classic.list(id)){const level=classic.resolveLevel(id,variant,classic.currentVersion);assert.equal(current.resolveLevel(id,variant,classic.currentVersion),level);assert.equal(new Engine(level).snapshot().version,4);}const pick=classic.start(id,options),{g,envelope}=checkpoint(classic,pick,pick.level.solution[0]);assert.deepEqual(copy(current.restore(id,envelope).snapshot),copy(g.snapshot()));assert.deepEqual(copy(current.checkpoint(pick.metadata,g)),envelope);}
});
test('explicit v1 pin selects archived six while seven through ten start their original classic boards',()=>{
 const pinned=api.createCatalog(classic,overrides,Engine,{currentVersion:'campaign-flow-v1'});assert.deepEqual(sorted(api.currentLevels(overrides,'campaign-flow-v1')),sorted(archive));assert.deepEqual(sorted(api.currentLevels(overrides,'campaign-flow-v2')),sorted(latest));
 assert.equal(pinned.start(6,options).metadata.levelDataVersion,'campaign-flow-v1');assert.equal(pinned.start(6,options).level.cells.length,23);
 for(let id=7;id<=10;id++){assert.deepEqual(copy(pinned.start(id,options)),copy(classic.start(id,options)));assert.deepEqual(copy(pinned.list(id)),copy(classic.list(id)));assert.equal(pinned.start(id,{...options,levelDataVersion:'campaign-flow-v2'}).metadata.variantId,'flow-v2','pin changes new-attempt default without deleting archives');}
});
test('archived v1 six restores both original seven-move paths after v2 becomes current',()=>{
 const level=archive[0];assert.equal(level.cells.length,23);for(const route of level.solutions){const pick=current.start(6,{...options,levelDataVersion:'campaign-flow-v1'}),g=new Engine(pick.level);for(const pair of route){assert(g.swap(...pair).ok);const envelope=copy(current.checkpoint(pick.metadata,g)),restored=current.restore(6,envelope);assert.equal(restored.level.cells.length,23);assert.equal(restored.metadata.levelDataVersion,'campaign-flow-v1');assert.deepEqual(copy(restored.snapshot),copy(g.snapshot()));assert.deepEqual(copy(current.restore(6,g.snapshot(),pick.metadata).snapshot),copy(g.snapshot()));archivePrefixes++;}assert.equal(g.status,'won');}
 assert.equal(archivePrefixes,14);assert.equal(current.start(6,{...options,attemptSerial:20}).metadata.levelDataVersion,'campaign-flow-v2','an explicit new attempt may select the current shape; restore never does');
});
test('earlier classic seven through ten variants and original snapshots restore unchanged',()=>{
 for(let id=7;id<=10;id++){
  for(const variant of classic.list(id)){const level=classic.resolveLevel(id,variant,classic.currentVersion),pick=classic.start(id,{...options,levelDataVersion:classic.currentVersion}),metadata={...copy(pick.metadata),variantId:variant},g=new Engine(level);assert(g.swap(...level.solution[0]).ok);const envelope=copy(classic.checkpoint(metadata,g)),restored=current.restore(id,envelope);assert.equal(restored.level,level);assert.equal(restored.snapshot.version,4);assert.deepEqual(copy(restored.snapshot),copy(g.snapshot()));assert.deepEqual(copy(current.checkpoint(metadata,g)),envelope);legacyRestores++;}
  const metadata=classic.legacyMetadata(id),level=classic.resolveLevel(id,metadata.variantId,metadata.levelDataVersion),g=new Engine(level);assert(g.swap(...level.solution[0]).ok);const restored=current.restore(id,g.snapshot(),metadata);assert.equal(restored.level,level);assert.deepEqual(copy(restored.snapshot),copy(g.snapshot()));assert.deepEqual(copy(current.legacyMetadata(id)),copy(metadata));legacyRestores++;
 }
 assert.equal(legacyRestores,20);
});
test('v1 and v2 snapshot/identity mixtures cannot reinterpret a saved board',()=>{
 const old=current.start(6,{...options,levelDataVersion:'campaign-flow-v1'}),fresh=current.start(6,options),a=checkpoint(current,old,old.level.solution[0]),b=checkpoint(current,fresh,fresh.level.solution[0]);
 assert.throws(()=>current.restore(6,a.g.snapshot(),fresh.metadata));assert.throws(()=>current.restore(6,b.g.snapshot(),old.metadata));
 for(const [source,metadata]of [[a.envelope,fresh.metadata],[b.envelope,old.metadata]]){const forged={...copy(source),...copy(metadata)},before=copy(forged);assert.throws(()=>current.restore(6,forged));assert.deepEqual(forged,before);}
 for(const mutate of [m=>m.variantId='flow-v1',m=>m.levelDataVersion='campaign-flow-v1',m=>m.levelId='6',m=>m.attemptId+='-changed']){const identity=copy(fresh.metadata);mutate(identity);assert.throws(()=>current.restore(6,b.g.snapshot(),identity));}
 const seven=current.start(7,options);assert.throws(()=>current.restore(7,b.g.snapshot(),seven.metadata));assert.throws(()=>current.restore(6,{},fresh.metadata));assert.throws(()=>current.restore(6,null,fresh.metadata));
});
test('missing per-level archives and unknown version pins fail closed',()=>{
 for(const version of ['campaign-flow-v3','campaign-flow-v0','unknown']){assert.throws(()=>api.currentLevels(overrides,version));assert.throws(()=>api.createCatalog(classic,overrides,Engine,{currentVersion:version}));for(let id=6;id<=10;id++){assert.throws(()=>current.start(id,{...options,levelDataVersion:version}));assert.throws(()=>current.resolveLevel(id,'flow-v2',version));assert.throws(()=>current.list(id,version));}}
 for(let id=7;id<=10;id++){assert.throws(()=>current.start(id,{...options,levelDataVersion:'campaign-flow-v1'}));assert.throws(()=>current.resolveLevel(id,'flow-v1','campaign-flow-v1'));}
 assert.throws(()=>api.createCatalog(classic,[...overrides,copy(latest[0])],Engine),'duplicate same ID/version');const wrong=copy(overrides);wrong.find(l=>l.levelDataVersion==='campaign-flow-v2').variantId='flow-v1';assert.throws(()=>api.createCatalog(classic,wrong,Engine));
});
test('review query pin is explicit and never changes the shared development namespace',()=>{
 for(const [query,enabled,pin]of [['',false,null],['?flowData=campaign-flow-v1',false,null],['?dev=flow-9-12',true,null],['?dev=flow-9-12&flowData=campaign-flow-v1',true,'campaign-flow-v1'],['?dev=flow-9-12&flowData=campaign-flow-v2',true,'campaign-flow-v2']]){const loaded=load(query).HexCampaignFlow;assert.equal(loaded.enabled,enabled);assert.equal(loaded.reviewVersion,pin);assert.equal(loaded.prefix,'hexrota-flow-9-12:');assert.deepEqual(copy(loaded.versions),versions);}
 const backing=new Map([['hexrota-profile-v2','normal-sentinel']]),adapter=api.storage({getItem:key=>backing.get(key)??null,setItem:(key,value)=>backing.set(key,value),removeItem:key=>backing.delete(key)});const pick=current.start(6,options),record=checkpoint(current,pick,pick.level.solution[0]).envelope;adapter.setItem('hexrota-profile-v2',JSON.stringify({game:{attempt:record}}));assert.equal(backing.get('hexrota-profile-v2'),'normal-sentinel');const persisted=JSON.parse(adapter.getItem('hexrota-profile-v2'));assert.equal(current.restore(6,persisted.game.attempt).level.cells.length,43);
});
console.log(`Large campaign registry: ${groups} groups; five current variable shapes, twenty delegated classic variants, ${newPrefixes} v2 prefixes, ${archivePrefixes} archived v1 prefixes, ${legacyRestores} earlier classic restores; strict version isolation and unchanged profile namespace.`);
