/* Fast Balance Lab invariants. No production save, engine or policy implementation lives here. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const {spawnSync}=require('node:child_process');
const root=__dirname,dist=path.join(root,'dist'),plain=value=>JSON.parse(JSON.stringify(value));
const {HexMatch,HEX_LEVELS,asLevel,certify}=require('./lib/level-analysis.cjs');
const Player=require('./lib/observable-player.cjs');
const data=require('./data/balance-lab-9-4.json'),pack=require('./dist/variants.json');
const Catalog=require('./dist/balance-lab-catalog.js');
const Analysis=require('./lib/balance-lab-analysis.cjs');
const Audit=require('./audit-observable.cjs');
const protectedFiles=require('./fixtures/balance-lab-protected-9-4.json');
const pairKey=pair=>pair.slice().sort((a,b)=>a-b).join(':');
let checks=0;function check(name,run){run();checks++;console.log('PASS '+name);}
let hiddenComparisons=0,originalRoutes=0,labRoutes=0;
const beforeInputs=JSON.stringify({levels:HEX_LEVELS,pack,data});
const catalog=Catalog.createCatalog(HEX_LEVELS,pack,data,HexMatch),scenarios=catalog.listScenarios();

check('all frozen original runtime/data/C#/roadmap files match the pre-lab baseline',()=>{
 assert.equal(protectedFiles.schemaVersion,1);assert.match(protectedFiles.referenceCommit,/^[0-9a-f]{40}$/);
 assert(Object.keys(protectedFiles.sha256).length>=80);
 for(const [file,expected]of Object.entries(protectedFiles.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),expected,file+' must remain unchanged');
});
check('existing npm commands and eleven original CI runs are retained with additive lab gates',()=>{
 const scripts=require('./package.json').scripts;
 for(const [name,command]of Object.entries(protectedFiles.baselineScripts)){if(name==='test')assert(scripts.test===command||scripts.test.startsWith(command+' && '),'the original npm test chain remains intact');else assert.equal(scripts[name],command,name+' remains intact');}
 const ci=fs.readFileSync(path.join(root,'.github/workflows/ci.yml'),'utf8');for(const id of protectedFiles.baselineCiJobs)assert(new RegExp('^  '+id+':$','m').test(ci),'existing CI job '+id+' remains');assert(/browser:\s*\[chromium,\s*webkit\]/.test(ci),'both original mobile matrix runs remain');assert(!/continue-on-error:\s*true/.test(ci),'CI failures cannot be hidden');
});
check('all 40 original variants and 80 independently starting winning certificates remain valid',()=>{
 assert.equal(pack.levels.length,10);
 for(const entry of pack.levels){assert.equal(entry.variants.length,4);const base=HEX_LEVELS.find(level=>level.id===entry.levelId);for(const variant of entry.variants){const routes=certify(asLevel(base,variant),variant.solutions);assert.equal(routes.length,2);originalRoutes+=routes.length;}}
 assert.equal(originalRoutes,80);
});
check('candidate generation exactly reproduces canonical analysis data without writing it',()=>{
 const before=fs.readFileSync(path.join(root,'data/balance-lab-9-4.json'),'utf8'),wrapper=fs.readFileSync(path.join(dist,'balance-lab-data.js'),'utf8');
 const output=spawnSync(process.execPath,['generate-balance-lab-candidates.cjs','--check-generated'],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});assert.equal(output.status,0,output.stdout+'\n'+output.stderr);assert.equal(fs.readFileSync(path.join(root,'data/balance-lab-9-4.json'),'utf8'),before);assert.equal(fs.readFileSync(path.join(dist,'balance-lab-data.js'),'utf8'),wrapper);
});
check('every original and experimental scenario is stable, independently certified and isolated by identity',()=>{
 assert.equal(scenarios.filter(item=>item.experimentId==='baseline').length,40);
 assert.equal(new Set(scenarios.map(item=>item.scenarioId)).size,scenarios.length);
 const expected=40+data.experiments.reduce((sum,item)=>sum+item.variantIds.length,0);assert.equal(scenarios.length,expected);
 for(const item of scenarios){
  const game=new HexMatch(item.level);assert.match(item.level.id,/^lab94-/);assert.equal(typeof item.levelId,'number');assert.notEqual(item.level.id,item.levelId);
  assert.equal(game.findMatches().length,0,item.scenarioId+' starts without an automatic match');assert(game.legalMoves().length>1);
  const routes=certify(item.level,item.level.solutions);assert(routes.length>=2,item.scenarioId+' requires two actual winning starts');labRoutes+=routes.length;
  assert.equal(new Set(routes.map(route=>pairKey(route[0]))).size,routes.length);assert.equal(item.certification.valid,true);
  for(const route of routes){const a=new HexMatch(item.level),b=new HexMatch(plain(item.level));for(const pair of route){const x=a.swap(...pair),y=b.swap(...pair);assert.deepEqual(plain(x),plain(y));}assert.equal(a.status,'won');assert.deepEqual(plain(a.snapshot()),plain(b.snapshot()));}
 }
 assert.equal(JSON.stringify({levels:HEX_LEVELS,pack,data}),beforeInputs,'catalog and replays cannot mutate authored inputs');
});
check('candidates change exactly one intended factor and preserve all other base rules',()=>{
 for(const item of scenarios){
  const baseline=catalog.resolve(item.levelId,item.variantId,'baseline'),a=baseline.level,b=item.level;
  assert.deepEqual(b.cells.map(({q,r})=>({q,r})),a.cells.map(({q,r})=>({q,r})));assert.deepEqual(b.palette,a.palette);assert.equal(b.target,a.target);assert.equal(b.targetMode,a.targetMode);
  const differences=[];for(const field of ['moves','initial','seed'])if(JSON.stringify(a[field])!==JSON.stringify(b[field]))differences.push(field);
  if(JSON.stringify(a.cells.map(c=>c.layers))!==JSON.stringify(b.cells.map(c=>c.layers)))differences.push('layers');
  assert.deepEqual(differences,item.experimentId==='baseline'?[]:[item.factor],item.scenarioId+' has one independent factor');
  if(item.experimentId==='l6-reduce-double-1')assert.equal(a.cells.reduce((n,c)=>n+c.layers,0)-b.cells.reduce((n,c)=>n+c.layers,0),1);
  if(item.experimentId==='l8-reduce-double-2')assert.equal(a.cells.reduce((n,c)=>n+c.layers,0)-b.cells.reduce((n,c)=>n+c.layers,0),2);
  if(item.experimentId==='l10-relocate-double'){assert.equal(b.cells.filter(c=>c.layers===2).length,a.cells.filter(c=>c.layers===2).length);assert.equal(b.cells.reduce((n,c)=>n+c.layers,0),a.cells.reduce((n,c)=>n+c.layers,0));}
 }
});
check('returned definitions and snapshots are independent copies and repeat the same start/RNG',()=>{
 for(const item of scenarios){const a=catalog.resolve(item.levelId,item.variantId,item.experimentId),before=plain(a),b=catalog.resolve(item.levelId,item.variantId,item.experimentId);a.level.initial[0]=999;a.level.cells[0].layers=0;a.level.solutions[0][0][0]=999;assert.deepEqual(catalog.resolve(item.levelId,item.variantId,item.experimentId),before);assert.deepEqual(plain(new HexMatch(b.level).snapshot()),plain(new HexMatch(catalog.resolve(item.levelId,item.variantId,item.experimentId).level).snapshot()));}
});
check('invalid experiment configuration and wrong ID types are rejected without fallback',()=>{
 for(const id of ['1',null,0,11,1.5,{},[]])assert.throws(()=>catalog.resolve(id,'v1','baseline'));
 for(const variant of ['v0','v5','legacy-original','__proto__',null,1])assert.throws(()=>catalog.resolve(1,variant,'baseline'));
 for(const experiment of ['unknown','__proto__',null,1,{},[]])assert.throws(()=>catalog.resolve(1,'v1',experiment));
 assert.throws(()=>catalog.resolve(1,'v1',data.experiments[0].id),'an experiment cannot be applied to another level');
 const mutations=[d=>{d.schemaVersion=999;},d=>{d.rulesVersion='new-rules';},d=>{d.experiments[0].patch.seed=123;},d=>{d.experiments[0].patch={movesDelta:0};},d=>{d.experiments[0].patch={target:1};},d=>{d.experiments[0].levelId='3';},d=>{d.experiments[0].variantIds=['v9'];},d=>{d.experiments[0].id='arbitrary';},d=>{d.experiments[0].certificates.v1=[[[0,0]],[[0,1]]];},d=>{d.experiments.push(plain(d.experiments[0]));},d=>{d.experiments[0].unknown=true;}];
 for(const change of mutations){const bad=plain(data);change(bad);assert.throws(()=>Catalog.createCatalog(HEX_LEVELS,pack,bad,HexMatch),'invalid authored lab configuration fails closed');}
});
check('lab envelopes cannot resolve or replace real attempts through the published catalog',()=>{
 const context={window:{}};vm.createContext(context);for(const file of ['engine.js','levels.js','variants-data.js','attempts.js'])vm.runInContext(fs.readFileSync(path.join(dist,file),'utf8'),context);
 const w=context.window,production=w.HexAttempts.createCatalog(w.HEX_LEVELS,w.HEX_VARIANTS,w.HexMatch);
 for(const item of scenarios){
  const snapshot=plain(new HexMatch(item.level).snapshot()),identity={attemptVersion:1,levelId:item.level.id,variantId:item.variantId,levelDataVersion:pack.levelDataVersion,attemptId:'lab-isolation',attemptSerial:1};
  assert.throws(()=>production.resolveLevel(item.level.id,item.variantId,pack.levelDataVersion));assert.throws(()=>production.restore(item.levelId,snapshot,identity));assert.throws(()=>production.restore(item.levelId,{...item,snapshot}));
  if(item.experimentId!=='baseline'){const real=production.start(item.levelId,{attemptSerial:1,selectionSeed:1});real.metadata.variantId=item.variantId;assert.throws(()=>production.restore(item.levelId,snapshot,real.metadata),'changed experimental start is not a valid published replay');}
 }
 // A raw baseline snapshot intentionally remains classic-v4 data. Identity is
 // enforced by the envelope and zero persistence, not cryptographic provenance.
});
check('candidate decisions use only visible information and independent bot seeds',()=>{
 const forbidden=['rngState','seed','initial','solution','solutions','alternativeSolutions','history','clone','snapshot','_random'];
 for(const item of scenarios.filter(s=>s.experimentId!=='baseline')){
  const game=new HexMatch(item.level),visible=Player.visibleState(game),before=plain(visible);
  assert.deepEqual(Object.keys(visible).sort(),['cells','values','layers','palette','target','targetMode','score','movesLeft'].sort());
  const poisoned=Object.create(game);Object.defineProperty(poisoned,'level',{value:new Proxy(game.level,{get(target,key){if(forbidden.includes(key))throw Error('Private level read: '+key);return target[key];}})});
  for(const key of forbidden)Object.defineProperty(poisoned,key,{get(){throw Error('Hidden game read: '+key);}});assert.deepEqual(Player.visibleState(poisoned),visible);
  for(const policy of Player.POLICIES){const opts={policy,seed:0xdeadbeef,samples:4,depth:2},expected=Player.choose(visible,opts);assert(expected);for(const hidden of [1,0xffffffff]){const changed=game.clone();changed.rngState=hidden;changed.level={...game.level,seed:hidden,initial:[],solutions:[[[999,998]]],solution:[[999,998]],alternativeSolutions:[]};assert.deepEqual(Player.choose(Player.visibleState(changed),opts),expected);hiddenComparisons++;}assert.deepEqual(visible,before);}
 }
});
check('common opening seeds repeat exactly and seed-only experiments cannot leak actual RNG',()=>{
 const original=catalog.resolve(5,'v1','baseline'),seedOnly=catalog.resolve(5,'v1','l5-seed-v1');
 const before=JSON.stringify(original);const opening=Analysis.openingSummary(original.level);assert.deepEqual(Analysis.openingSummary(original.level),opening);assert.deepEqual(Analysis.openingSummary(seedOnly.level),opening);
 assert.equal(JSON.stringify(original),before);assert.equal(Analysis.SETTINGS.trials,64);assert.equal(Analysis.SETTINGS.samples,4);assert.equal(Analysis.SETTINGS.depth,2);
 for(let p=0;p<4;p++)for(let t=0;t<64;t++)assert.equal(Analysis.decisionSeed(p,t,0),Player.mix32((0x6d2b79f5+Math.imul(p+1,104729)+Math.imul(t+1,15485863)+Math.imul(1,2654435761))>>>0));
});
check('passive terminal measurements preserve the exact existing simulator and restore its prototype on errors',()=>{
 const level=catalog.resolve(8,'v1','baseline').level,original=HexMatch.prototype.swap,expected=Audit.simulate(level,'visible_coverage');
 const a=Analysis.simulateMeasured(level,'visible_coverage'),b=Analysis.simulateMeasured(level,'visible_coverage');assert.deepEqual(a,b,'repeatable actual-engine terminal observations');assert.equal(HexMatch.prototype.swap,original);
 const oldFields={...a};for(const field of ['losses','terminalObservations','lossesSolelyLastGroundCell','lossesWithOneGroundCellAndMissingPoints'])delete oldFields[field];assert.deepEqual(oldFields,expected,'new observer does not change any existing metric');
 assert.equal(a.terminalObservations,64);assert.equal(a.wins+a.losses,64);assert.equal(a.lossesSolelyLastGroundCell+a.lossesWithOneGroundCellAndMissingPoints,a.lossesWithOneGroundCell);assert(a.lossesSolelyLastGroundCell<=a.failures.groundMissingOnly);
 assert.throws(()=>Analysis.simulateMeasured(level,'unknown-policy'));assert.equal(HexMatch.prototype.swap,original,'try/finally removes observer after a rejected simulation');
});
check('the production menu and shell do not import or advertise the lab',()=>{
 for(const name of ['index.html','app.js','pwa.js','sw.js'])assert(!fs.readFileSync(path.join(dist,name),'utf8').includes('balance-lab'),name+' remains an independent player surface');
 const html=fs.readFileSync(path.join(dist,'balance-lab.html'),'utf8');assert(!/\b(?:app|session-store|lives|life-providers|playtest|pwa)\.js/.test(html),'isolated page does not import persistence/economy controllers');
});

async function mount(query=''){
 const calls=[],errors=[],storageValues={},console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
 const sentinel=JSON.stringify({sentinel:'preserve-normal-profile',revision:23,attemptSerial:77,lives:3,testGold:211});
 const keys=['hexrota-profile-v2','hexrota-match-v5','hexrota-match-v4','hexrota-match-v3','hexrota-match-v2','hexrota-lives-v1','hexrota-events-v1','hexrota-playtest-v1'];
 let persistent,read;
 const dom=new JSDOM(fs.readFileSync(path.join(dist,'balance-lab.html'),'utf8'),{url:'https://hexrota-lab.test/balance-lab.html'+query,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console,beforeParse(w){
  persistent=w.localStorage;read=w.Storage.prototype.getItem;for(const key of keys)persistent.setItem(key,sentinel);
  for(const kind of ['localStorage','sessionStorage','indexedDB'])Object.defineProperty(w,kind,{configurable:true,get(){calls.push(kind);throw Error('Lab must not access '+kind);}});
  Object.defineProperty(w.document,'cookie',{configurable:true,get(){calls.push('cookie read');return '';},set(){calls.push('cookie write');throw Error('Lab must not write cookies');}});
  w.fetch=()=>{calls.push('fetch');return Promise.reject(Error('Unexpected lab network'));};w.navigator.sendBeacon=()=>{calls.push('beacon');return false;};w.XMLHttpRequest=function(){calls.push('xhr');throw Error('Unexpected lab network');};
  w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};
 }});
 // The installed JSDOM version intentionally has no ResourceLoader API. As in
 // the existing real-app UI checks, execute the actual HTML script list in order.
 for(const script of dom.window.document.querySelectorAll('script[src]')){const url=new URL(script.src);assert.equal(url.origin,'https://hexrota-lab.test');const file=path.resolve(dist,'.'+url.pathname);assert(file.startsWith(dist+path.sep));dom.window.eval(fs.readFileSync(file,'utf8')+'\n//# sourceURL='+path.basename(file));}
 await new Promise(resolve=>setTimeout(resolve,5));
 const close=()=>dom.window.close(),storageUnchanged=()=>{for(const key of keys)assert.equal(read.call(persistent,key),sentinel,key+' remains byte-identical');};
 return {w:dom.window,calls,errors,storageUnchanged,close};
}
(async()=>{
 let mounted=await mount();try{
  const {w}=mounted;assert.equal(w.HexBalanceLab.inspect().ready,true);const before=plain(w.HexBalanceLab.inspect().snapshot);w.document.querySelector('#lab-restart').click();assert.deepEqual(plain(w.HexBalanceLab.inspect().snapshot),before);
  const select=w.document.querySelector('#lab-level');select.value='3';select.dispatchEvent(new w.Event('change',{bubbles:true}));w.document.querySelector('#lab-experiment').value='l3-moves-plus-1';w.document.querySelector('#lab-start').click();const candidate=plain(w.HexBalanceLab.inspect());assert.equal(candidate.selection.experimentId,'l3-moves-plus-1');assert.equal(candidate.level.moves,HEX_LEVELS[2].moves+1);w.document.querySelector('#lab-restart').click();assert.deepEqual(plain(w.HexBalanceLab.inspect().snapshot),candidate.snapshot);
  candidate.snapshot.values[0]=999;assert.notEqual(w.HexBalanceLab.inspect().snapshot.values[0],999);mounted.storageUnchanged();assert.deepEqual(mounted.calls,[]);assert.deepEqual(mounted.errors,[]);checks++;console.log('PASS actual isolated JSDOM page can select/restart candidates without any storage, cookie or network API access');
 }finally{mounted.close();}
 for(const query of ['?level=bogus','?level=1.5','?level=11','?level=1&variant=v9','?level=1&variant=v1&experiment=unknown','?level=','?variant=','?experiment=','?level=1&level=2','?variant=v1&variant=v2','?unknown=x']){
  mounted=await mount(query);try{assert.equal(mounted.w.HexBalanceLab.inspect().ready,false,query+' must not silently become a new board');assert(mounted.w.document.querySelector('#lab-error').textContent.trim());mounted.storageUnchanged();assert.deepEqual(mounted.calls,[]);checks++;}finally{mounted.close();}
 }
 console.log(`Balance Lab checks passed: ${checks} groups; ${Object.keys(protectedFiles.sha256).length} frozen files; ${scenarios.length} scenarios, ${originalRoutes} original routes and ${labRoutes} lab routes; ${hiddenComparisons} hidden-RNG comparisons; actual memory-only page boot/selection/restart and safe invalid-query rejection. Full report reproduction is a separate balance:lab -- --check gate.`);
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
