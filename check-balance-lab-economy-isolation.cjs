/* Integration-only: actual pinned PR #11 Lab + current production core, no Lab merge or production writes. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const {chromium,webkit}=require('playwright');
const ROOT=__dirname,PIN='85bc092d4d2e0dc01e91527b92a1d8cbf4664ca1';
const LAB=path.resolve(process.env.HEXROTA_LAB_SOURCE||path.join(ROOT,'..','hexrota-94'));
const browserName=process.env.HEXROTA_BROWSER||'chromium';assert(['chromium','webkit'].includes(browserName),'HEXROTA_BROWSER must name a real supported browser');
const output=process.env.HEXROTA_LAB_ECONOMY_REPORT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-lab95-'+browserName+'-'));fs.mkdirSync(output,{recursive:true});
const copy=value=>JSON.parse(JSON.stringify(value)),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function git(args){const result=spawnSync('git',['-C',LAB,...args],{encoding:'utf8',maxBuffer:32*1024*1024});assert.equal(result.status,0,'Pinned Lab fixture checkout is required. Set HEXROTA_LAB_SOURCE to a clean checkout of '+PIN+'\n'+result.stderr);return result.stdout.trim();}
assert.equal(git(['rev-parse','HEAD']),PIN,'Lab source must be the exact reviewed PR #11 SHA; a moving branch is not a fixture');
const labAssets=['balance-lab.html','balance-lab.css','balance-lab.js','balance-lab-data.js','balance-lab-catalog.js'];
for(const file of [...labAssets.map(file=>'dist/'+file),'data/balance-lab-9-4.json','fixtures/balance-lab-protected-9-4.json'])assert.equal(git(['diff','--exit-code',PIN,'--',file]),'','Pinned Lab asset was edited: '+file);
const frozen=JSON.parse(fs.readFileSync(path.join(LAB,'fixtures/balance-lab-protected-9-4.json'),'utf8'));
// The Lab reference remains pinned. The integrated recovery core has exactly
// four reviewed 9.9b source updates; neither authored data nor Lab assets move.
const focusReview=require('./fixtures/idle-focus-palette-9-12-protected.json');
assert.equal(focusReview.baseline,'a3bb1c83afbb1b73e709eda482c7de5ed0eeeb49');
assert.deepEqual(Object.keys(focusReview.sha256),["dist/app.js", "dist/idle-hints.js", "dist/idle-hint-view.js", "src/styles/03-presentation-and-learning.css", "src/styles/09-idle-hints.css", "src/styles/10-obstacle-flow.css", "dist/style.css", "dist/sw.js"],'only focused hint, palette paint and cache sources extend the prior protection');
for(const [relative,expected]of Object.entries(focusReview.sha256))assert.equal(sha(fs.readFileSync(path.join(ROOT,relative))),expected,'Focused hint/palette source drifted: '+relative);
const idleCompat=require('./fixtures/idle-hints-9-12-protected.json');
const capacity=require('./fixtures/board-capacity-protected.json');
const flow=require('./fixtures/flow-integration-protected.json');
const obstacles=require('./fixtures/obstacles-regions-protected.json');
const recoveryProtection=require('./fixtures/board-validation-protected.json');
const solverProtection=require('./fixtures/solver-integrity-protected.json');
assert.equal(solverProtection.baseline,'11b0161e913904199198ca61f477f47bb11ad390');
assert.deepEqual(Object.keys(solverProtection.sha256).sort(),['dist/engine.js','lib/level-analysis.cjs','unity/Hints/HintSolver.cs','unity/HintParityHarness/Program.cs','unity/HintParityHarness/Hexrota.HintParity.csproj','audit-observable.cjs','audit-solvability-9-9.cjs'].sort(),'only seven reviewed solver/hint/report sources may differ');
for(const [relative,expected]of Object.entries(solverProtection.sha256))assert.equal(sha(fs.readFileSync(path.join(ROOT,relative))),focusReview.sha256[relative]||idleCompat.sha256[relative]||capacity.sha256[relative]||flow.sha256[relative]||obstacles.sha256[relative]||expected,'Reviewed solver source drifted: '+relative);
assert.equal(recoveryProtection.baseline,'f8b0fe25c802404b0516e1b65033fc32627d67fb');
assert.deepEqual(Object.keys(recoveryProtection.sha256).sort(),['dist/engine.js','unity/Gameplay/HexMatch.cs','unity/Gameplay/BoardTopology.cs','unity/GameplayParityHarness/Program.cs'].sort(),'only the four reviewed 9.9b core/harness files may differ from the old Lab reference');
for(const [relative,expected]of Object.entries(recoveryProtection.sha256))assert.equal(sha(fs.readFileSync(path.join(ROOT,relative))),focusReview.sha256[relative]||idleCompat.sha256[relative]||capacity.sha256[relative]||flow.sha256[relative]||obstacles.sha256[relative]||solverProtection.sha256[relative]||expected,'Current recovery source must match its exact reviewed hash: '+relative);
assert.deepEqual(Object.keys(recoveryProtection.reportSourceHashes),['reports/observable-difficulty.json'],'only the observable report source checksum may change; metrics remain byte-protected');

const approvedHostChanges=new Set(['dist/app.js','dist/index.html','dist/style.css','dist/sw.js','unity/Application/GameSessionController.cs','unity/Application/ProfileRepository.cs','dist/session-store.js','unity/Application/SaveMigration.cs','unity/ApplicationParityHarness/ApplicationParityHarness.csproj','unity/ApplicationParityHarness/Program.cs']);
const changedHostFiles=[],sourceOnlyFiles=[],reviewedRecoveryFiles=[],reviewedReportSourceHashes=[];let immutableFiles=0;
for(const [relative,expected]of Object.entries(frozen.sha256)){
 assert.equal(sha(fs.readFileSync(path.join(LAB,relative))),expected,'The pinned Lab reference itself drifted: '+relative);
 if(relative==='docs/PRODUCT_ROADMAP_2026.md'){sourceOnlyFiles.push(relative);continue;}
 const actual=fs.readFileSync(path.join(ROOT,relative));
 if(relative==='reports/observable-difficulty.json'){
  const current=JSON.parse(actual),original=fs.readFileSync(path.join(LAB,relative),'utf8'),prior=JSON.parse(original);
  assert.equal(current.sourceHash,flow.reportSourceHashes?.[relative]||obstacles.reportSourceHashes[relative]||solverProtection.reportSourceHashes[relative],'observable report checksum must match the reviewed current engine');
  const field='"sourceHash": "'+current.sourceHash+'"';assert.equal(actual.toString('utf8').split(field).length,2,'source checksum field occurs exactly once');
  assert.equal(actual.toString('utf8').replace(field,'"sourceHash": "'+prior.sourceHash+'"'),original,'every observable metric, trial, policy and byte outside sourceHash stays pinned');
  reviewedReportSourceHashes.push(relative);continue;
 }

 if(focusReview.sha256[relative]||idleCompat.sha256[relative]||capacity.sha256[relative]||flow.sha256[relative]||obstacles.sha256[relative]||solverProtection.sha256[relative]||recoveryProtection.sha256[relative]){assert.equal(sha(actual),focusReview.sha256[relative]||idleCompat.sha256[relative]||capacity.sha256[relative]||flow.sha256[relative]||obstacles.sha256[relative]||solverProtection.sha256[relative]||recoveryProtection.sha256[relative],'Reviewed recovery source drifted: '+relative);reviewedRecoveryFiles.push(relative);continue;}
 if(approvedHostChanges.has(relative)){if(sha(actual)!==expected)changedHostFiles.push(relative);continue;}
 if(relative==='dist/hint-worker.js'){
  const stripQuery=value=>value.toString('utf8').replace(/(\.\/engine\.js)\?v=\d+/g,'$1');
  assert.equal(stripQuery(actual),stripQuery(fs.readFileSync(path.join(LAB,relative))),'Hint worker may only update its cache query');
  if(sha(actual)!==expected)changedHostFiles.push(relative);continue;
 }
 assert.equal(sha(actual),expected,'Immutable gameplay/data/C# boundary changed: '+relative);immutableFiles++;
}
// The browser serves current core files, rather than the pinned page's old copies.
const runtimeFiles=['engine.js','levels.js','variants-data.js','favicon.svg'];
for(const file of runtimeFiles)assert.equal(sha(fs.readFileSync(path.join(ROOT,'dist',file))),focusReview.sha256['dist/'+file]||idleCompat.sha256['dist/'+file]||capacity.sha256['dist/'+file]||flow.sha256['dist/'+file]||obstacles.sha256['dist/'+file]||solverProtection.sha256['dist/'+file]||recoveryProtection.sha256['dist/'+file]||sha(fs.readFileSync(path.join(LAB,'dist',file))),'Current runtime bytes must match the pinned Lab or exact reviewed recovery source: '+file);

function fixture(){
 const sandbox={window:{},performance};vm.createContext(sandbox);const w=sandbox.window;
 for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js','commands.js','economy-config.js','economy.js','lives-config.js','lives.js','life-providers.js','events.js','playtest.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,'dist',file),'utf8'),sandbox,{filename:file});
 const catalog=w.HexAttempts.createCatalog(w.HEX_LEVELS,w.HEX_VARIANTS,w.HexMatch),economy=w.HexEconomy.createManager(w.HEX_ECONOMY_CONFIG),done=[0,1],boards={},attempts={},records={};
 for(let i=0;i<6;i++){
  const level=w.HEX_LEVELS[i],game=new w.HexMatch(level);for(const pair of level.solution)assert(game.swap(...pair).ok);assert.equal(game.status,'won');
  const stage=i+2;boards[stage]=copy(game.snapshot());done.push(stage);records[stage]={score:game.score,movesLeft:game.movesLeft,plays:1};
 }
 let economic=economy.migrate(null,{done,verifiedLevelIds:[1,2,3,4,5,6]}).state;
 economic=economy.purchase(economic,{operationId:'lab95-sentinel-purchase',itemId:'greenBrush'}).state;
 const entry=catalog.start(7,{attemptSerial:77,selectionSeed:0x41abca}),classic=new w.HexMatch(entry.level);assert(classic.swap(...entry.level.solution[0]).ok);
 const limits={greenBrush:1,colorKey:1,rescue:1},assisted=new w.HexAssistedGame(entry.level,{attemptId:entry.metadata.attemptId,limits},classic.snapshot());
 const aid={id:'lab95-sentinel-brush',type:'green_brush',index:assisted.layers.findIndex(layer=>layer>0)};assert(assisted.apply(aid).ok);
 economic=economy.consume(economic,{operationId:aid.id,itemId:'greenBrush',attemptId:entry.metadata.attemptId,levelId:7}).state;economy.restore(economic);
 boards[8]=copy(assisted.snapshot());attempts[8]=copy(entry.metadata);
 const now=Date.UTC(2026,10,15,12),lifeManager=w.HexLives.createManager(w.HEX_LIVES_CONFIG,{clock:()=>now});let life=lifeManager.createState();
 for(let i=0;i<2;i++)life=lifeManager.settleAttempt(life,{attemptId:'lab95-prior-failure-'+i,levelId:10,tutorial:false,movesUsed:1,outcome:'failed'}).state;
 life=lifeManager.registerAttempt(life,{attemptId:entry.metadata.attemptId,levelId:7,tutorial:false,resume:false}).state;
 const energy=w.HexLifePrototype.createState(life,{providerNamespace:'lab95-protected-life',gold:211,adAvailable:false});w.HexLifePrototype.validate(energy,lifeManager);
 const game={current:8,done,boards,attempts,attemptStats:{8:{attemptId:entry.metadata.attemptId,attemptNumber:1,started:true,terminalEvent:null,hintsUsed:0,cascades:0}},variantSelection:{seed:entry.selectionSeed,serial:77,counts:{7:1},recent:{7:[entry.metadata.variantId]}},guideAcks:[],sound:false,preferences:{music:false,volume:.65,motion:'reduce',haptics:false},records,economy:copy(economic)};
 const profile={schemaVersion:2,revision:23,game,energy:copy(energy)},events=copy(w.HexEvents.createState()),playtest=copy(w.HexPlaytest.createTracker({now:()=>now,monotonic:()=>0}).snapshot());
 assert.equal(game.economy.gold,50);assert.equal(game.economy.stars,6);assert.deepEqual(copy(game.economy.inventory),{greenBrush:3,colorKey:3});assert.equal(energy.life.lives,3);assert.equal(energy.testWallet.gold,211);assert.equal(game.variantSelection.serial,77);
 const values={
  'hexrota-profile-v2':profile,'hexrota-match-v5':game,'hexrota-lives-v1':energy,'hexrota-events-v1':events,'hexrota-playtest-v1':playtest,
  'hexrota-match-v4':{current:0,done:[0],boards:{0:boards[2]},sound:false},'hexrota-match-v3':{current:0,done:[0],sound:false},'hexrota-match-v2':{current:0,done:[0],sound:false},'hexrota-v1':{sound:true},
  'hexrota-lab95-private-sentinel':{schemaVersion:1,value:'other-local-data-is-also-private'}
 };
 return {seed:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,JSON.stringify(value)])),economy,catalog,HexMatch:w.HexMatch};
}
const F=fixture(),seed=F.seed,results=[],errors=[],external=[],requested=[];
const allowed=new Map([...labAssets.map(file=>['/'+file,path.join(LAB,'dist',file)]),...runtimeFiles.map(file=>['/'+file,path.join(ROOT,'dist',file)])]);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer((request,response)=>{
 let pathname;try{pathname=new URL(request.url,'http://localhost').pathname;}catch{response.writeHead(400).end();return;}
 const file=allowed.get(pathname);if(!file){response.writeHead(404).end();return;}
 response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(fs.readFileSync(file));
});
let browser,url;
async function idle(page){await page.waitForFunction(()=>window.HexBalanceLab?.inspect().ready&&!window.HexBalanceLab.inspect().busy);}
async function inspect(page){return page.evaluate(()=>window.HexBalanceLab.inspect());}
async function untouched(page){
 assert.deepEqual(await page.evaluate(()=>window.__lab95Calls),[],'The Lab must neither read nor write profile/storage/cookie/network APIs');
 assert.deepEqual(await page.evaluate(()=>window.__lab95Snapshot()),seed,'Gold/stars/inventory/commands/attempt serial/life/TEST Gold and all other sentinels stay byte-identical');
 assert.deepEqual(await page.evaluate(()=>['HexEconomy','HEX_ECONOMY_CONFIG','HexCommands','HexRescue','HexLives','HexLifePrototype','HexSessionStore','HexPlaytest','HexEvents','HexGarden'].filter(name=>window[name]!==undefined)),[],'No normal progression, economy, command, life or persistence service is loaded');
 assert.equal(await page.locator('#home-screen,#inventory-dialog,#life-provider-dialog,#session-lock-panel,#garden-screen').count(),0,'The normal game/helper UI is absent from the isolated Lab');
}
async function open({width=390,height=844,query=''}={}){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
 context.on('request',request=>{const address=request.url();if(address.startsWith(url))requested.push(new URL(address).pathname);else if(!address.startsWith('data:')&&!address.startsWith('blob:'))external.push(address);});
 await context.addInitScript(seed=>{
  const local=window.localStorage,nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem;
  for(const [key,value]of Object.entries(seed))if(nativeGet.call(local,key)===null)nativeSet.call(local,key,value);
  const calls=[];window.__lab95Calls=calls;window.__lab95Snapshot=()=>Object.fromEntries(Object.keys(seed).map(key=>[key,nativeGet.call(local,key)]));
  const denied=(api,key=null)=>{calls.push({api,key});throw Error('Isolated Lab accessed '+api);};
  for(const method of ['getItem','setItem','removeItem','clear','key'])Storage.prototype[method]=function(...args){return denied('Storage.'+method,args[0]??null);};
  for(const name of ['localStorage','sessionStorage','indexedDB','caches'])Object.defineProperty(window,name,{configurable:true,get:()=>denied(name)});
  Object.defineProperty(document,'cookie',{configurable:true,get:()=>denied('cookie-read'),set:()=>denied('cookie-write')});
  window.fetch=()=>denied('fetch');window.XMLHttpRequest=function(){denied('XHR');};window.WebSocket=function(){denied('WebSocket');};navigator.sendBeacon=()=>denied('sendBeacon');
 },seed);
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(url+'balance-lab.html'+query);await page.waitForFunction(()=>!!window.HexBalanceLab);
 return {page,context};
}
async function choose(page,levelId,variantId,experimentId){await page.locator('#lab-level').selectOption(String(levelId));await page.locator('#lab-variant').selectOption(variantId);await page.locator('#lab-experiment').selectOption(experimentId);await page.locator('#lab-start').tap();await idle(page);}
async function swap(page,pair){await page.locator('#lab-board').scrollIntoViewIfNeeded();for(const index of pair)await page.locator(`#lab-board [data-index="${index}"]`).tap();await idle(page);}
async function check(name,run){await run();results.push({name,passed:true});console.log('PASS '+browserName+' '+name);}
async function reachable(page,selector){const node=page.locator(selector);await node.scrollIntoViewIfNeeded();const box=await node.boundingBox(),viewport=page.viewportSize();assert(box&&box.width>=44&&box.height>=40,selector+' is a mobile touch target');assert(box.x>=-1&&box.x+box.width<=viewport.width+1,selector+' fits screen width');assert(box.y>=-1&&box.y+box.height<=viewport.height+1,selector+' can be reached by scrolling');}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}/`;
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 try{
  browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...executable?{executablePath:executable}:{},args:browserName==='chromium'?['--no-sandbox']:[]});
  for(const [width,height]of [[320,568],[390,844],[844,390]])await check(`${width}x${height} actual pinned Lab controls and read-only local JSON inspection`,async()=>{
   const f=await open({width,height});try{
    await idle(f.page);assert.equal(await f.page.locator('#lab-level option').count(),10);assert.equal(await f.page.locator('#lab-variant option').count(),4);
    for(const id of ['lab-level','lab-variant','lab-experiment','lab-start','lab-restart'])await reachable(f.page,'#'+id);
    const before=await inspect(f.page),json=await f.page.evaluate(()=>JSON.stringify(window.HexBalanceLab.inspect())),exported=JSON.parse(json);assert.deepEqual(exported,before);
    assert(!json.includes('lab95-sentinel')&&!json.includes('testWallet')&&!json.includes('claimedLevelIds'),'JSON inspection cannot leak normal profile data');
    await f.page.evaluate(()=>{const exported=window.HexBalanceLab.inspect();exported.snapshot.values[0]=999;exported.level.target=999;});assert.deepEqual(await inspect(f.page),before,'inspection returns a defensive copy');
    assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await untouched(f.page);await f.page.screenshot({path:path.join(output,`layout-${width}x${height}.png`),fullPage:true});
   }finally{await f.context.close();}
  });
  await check('full Lab win, restart and multiple experiment changes cannot award or spend any player resource',async()=>{
   const f=await open();try{
    await idle(f.page);await choose(f.page,3,'v1','l3-moves-plus-1');const start=await inspect(f.page),model=new F.HexMatch(start.level);
    for(const pair of start.level.solutions[0]){assert(model.swap(...pair).ok);await swap(f.page,pair);await untouched(f.page);}assert.equal(model.status,'won');assert.equal((await inspect(f.page)).status,'won');assert.deepEqual((await inspect(f.page)).snapshot,copy(model.snapshot()));
    await f.page.locator('#lab-restart').tap();await idle(f.page);assert.deepEqual((await inspect(f.page)).snapshot,start.snapshot,'restart preserves exact initial board and RNG');
    for(const [levelId,variantId,experimentId]of [[6,'v3','l6-reduce-double-1'],[9,'v4','l9-initial-v4'],[10,'v1','l10-relocate-double']]){
     await choose(f.page,levelId,variantId,experimentId);const selected=await inspect(f.page);assert.match(selected.level.id,/^lab94-/);assert.equal(selected.selection.experimentId,experimentId);await swap(f.page,selected.level.solutions[0][0]);await f.page.locator('#lab-restart').tap();await idle(f.page);assert.deepEqual((await inspect(f.page)).snapshot,selected.snapshot);await untouched(f.page);
     assert.throws(()=>F.economy.complete(JSON.parse(seed['hexrota-match-v5']).economy,{levelId:selected.level.id,attemptId:'lab-only',status:'won',verified:true}),/invalid_economy_level/,'Lab string identity never grants a campaign entitlement');
     assert.throws(()=>F.catalog.resolveLevel(selected.level.id,variantId,'variants-v1'),'Lab identity cannot enter the real campaign catalog');
    }
   }finally{await f.context.close();}
  });
  await check('real Lab loss, same-board retry and reload never consume lives or change paid inventory',async()=>{
   const f=await open({query:'?level=8&variant=v1&experiment=baseline'});try{
    await idle(f.page);const initial=await inspect(f.page),model=new F.HexMatch(initial.level);while(model.status==='playing'){const legal=model.legalMoves(),pair=legal[(model.turn*7+3)%legal.length];assert(model.swap(...pair).ok);await swap(f.page,pair);}
    assert.equal(model.status,'lost');assert.equal((await inspect(f.page)).status,'lost');assert.deepEqual((await inspect(f.page)).snapshot,copy(model.snapshot()));await untouched(f.page);
    await f.page.locator('#lab-restart').tap();await idle(f.page);assert.deepEqual((await inspect(f.page)).snapshot,initial.snapshot);await swap(f.page,initial.level.solutions[0][0]);await untouched(f.page);await f.page.reload();await idle(f.page);assert.deepEqual((await inspect(f.page)).snapshot,initial.snapshot);await untouched(f.page);
   }finally{await f.context.close();}
  });
  await check('invalid experimental identity fails closed with no fallback, save or economy capability',async()=>{
   for(const query of ['?level=7&variant=v2&experiment=l3-moves-plus-1','?level=7&variant=v2&experiment=unknown','?level=1&level=2']){
    const f=await open({query});try{assert.equal((await inspect(f.page)).ready,false);assert(await f.page.locator('#lab-error').isVisible());await untouched(f.page);}finally{await f.context.close();}
   }
  });
  assert.deepEqual(errors,[],'no uncaught real browser errors');assert.deepEqual(external,[],'no external network requests');for(const pathname of requested)assert(allowed.has(pathname),'Unexpected normal application resource was requested: '+pathname);
  const report={browser:browserName,pinnedLabCommit:PIN,source:LAB,currentCoreCommit:spawnSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).stdout.trim(),checks:results.length,results,immutableProtectedFiles:immutableFiles,approvedHostChanges:changedHostFiles,reviewedRecoveryFiles,reviewedReportSourceHashes,sourceOnlyFiles,protectedStorageKeys:Object.keys(seed),fixture:{gold:50,stars:6,greenBrush:3,colorKey:3,attemptSerial:77,lives:3,testGold:211},labExportUiImplemented:false,exportCheck:'JSON.stringify(HexBalanceLab.inspect()) only; no nonexistent export button is claimed',externalRequests:external,pageErrors:errors,physicalIPhoneTested:false,physicalAndroidTested:false};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(`Pinned Balance Lab / economy isolation passed: ${results.length} ${browserName} groups, ${immutableFiles} immutable files, ${Object.keys(seed).length} protected keys. Artifacts: ${output}. Physical devices were not tested.`);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
