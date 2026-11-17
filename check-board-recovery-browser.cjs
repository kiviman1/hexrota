/* Real Chromium/WebKit command rollback after a recovery helper throws.
 * The frozen four-cell recovery fixture is mapped to numeric L1/original-v1
 * only by this local HTTP test. No production level, engine rule or presenter
 * is replaced. Native touch reaches the real helper before a one-shot fault.
 * Desktop mobile emulation is not physical-device or native C# host evidence. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium,webkit}=require('playwright');
const {fresh,lifePool,plain,NOW}=require('./check-lives-ui.cjs');
const dist=path.join(__dirname,'dist'),PROFILE='hexrota-profile-v2',browserName=process.env.HEXROTA_BROWSER||'chromium';
assert(['chromium','webkit'].includes(browserName),'supported real browser');
const output=process.env.HEXROTA_BOARD_RECOVERY_SCREENSHOT_DIR||path.join(__dirname,'test-results','board-recovery-'+browserName);
fs.mkdirSync(output,{recursive:true});
const archive=require('./fixtures/dead-board-vectors-9-9.json'),fixture=archive.cases.find(row=>row.id==='natural-dead-board-after-swap-recovers-and-wins');
assert(fixture,'the existing frozen natural recovery route is required');
assert.deepEqual(fixture.steps[0].pair,[0,1]);
const runtime={window:{},performance};vm.createContext(runtime);
for(const file of ['engine.js','levels.js'])vm.runInContext(fs.readFileSync(path.join(dist,file),'utf8'),runtime,{filename:file});
const R=runtime.window,alias={...plain(fixture.level),id:1,name:'Yalnız test için kurtarma tahtası',subtitle:'Üretim bölüm verisi değildir.'};
const aliasLevels=plain(R.HEX_LEVELS).map(level=>level.id===1?alias:level),pack=JSON.parse(fs.readFileSync(path.join(dist,'variants.json'),'utf8'));
const aliasPack={...pack,levels:pack.levels.filter(row=>row.levelId!==1)},initial=new R.HexMatch(alias),expected=new R.HexMatch(alias);
const expectedResult=expected.swap(...fixture.steps[0].pair);assert.equal(expectedResult.ok,true);assert.equal(expectedResult.reshuffled,true);
assert.deepEqual(plain(expected.snapshot()),fixture.steps[0].after.snapshot,'numeric test identity does not change the frozen classic outcome');
const expectedSnapshot=plain(expected.snapshot()),metadata={attemptVersion:1,levelId:1,variantId:'legacy-original',levelDataVersion:'original-v1',attemptId:'legacy-1',attemptSerial:0};
const saved={...fresh(2),boards:{2:plain(initial.snapshot())},attempts:{2:metadata}};
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 let file;try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);file=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));}catch(_){res.writeHead(400).end();return;}
 if(!file.startsWith(dist+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(bytes);});
});
const results=[],errors=[],measurements=[];let browser,url,failure=null;
const board=p=>p.game.boards[p.game.current],attempt=p=>p.game.attempts[p.game.current];

// Observe the actual production reward return values without changing them.
// The private host state is not exposed as a test command or a new authority.
const rewardObservation='\n;('+function(){
 const copy=value=>JSON.parse(JSON.stringify(value)),adapter=window.HexRewardAdapter,director=window.HexRewards;
 const observed=window.__boardRecoveryRewards={state:null,restoreCalls:0,evaluateCalls:0};
 window.HexRewardAdapter=Object.freeze({...adapter,restore(...args){const value=adapter.restore.apply(adapter,args);observed.restoreCalls++;observed.state=copy(value.state);return value;}});
 window.HexRewards=Object.freeze({...director,evaluate(...args){const value=director.evaluate.apply(director,args);observed.evaluateCalls++;observed.state=copy(value.nextState);return value;}});
}.toString()+')();\n';

async function open(size){
 const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
 context.setDefaultTimeout(10000);
 await context.addInitScript(({saved,energy,now})=>{
  if(location.protocol!=='http:')return;Date.now=()=>now;
  if(!localStorage.getItem('hexrota-profile-v2')&&!localStorage.getItem('hexrota-match-v5')){
   localStorage.setItem('hexrota-match-v5',JSON.stringify(saved));localStorage.setItem('hexrota-lives-v1',JSON.stringify(energy));
  }
 },{saved,energy:lifePool(5),now:NOW});
 await context.route('**/levels.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.HEX_LEVELS='+JSON.stringify(aliasLevels)+';'}));
 await context.route('**/variants-data.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.HEX_VARIANTS='+JSON.stringify(aliasPack)+';'}));
 await context.route('**/reward-adapter.js*',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(dist,'reward-adapter.js'),'utf8')+rewardObservation}));
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.screen==='home');
 return {context,page,close:()=>context.close()};
}
async function enter(page){
 await page.locator('#home-play').tap();if(await page.locator('#pregame-dialog').evaluate(node=>node.open))await page.locator('#pregame-start').tap();
 await page.waitForFunction(()=>document.body.dataset.screen==='game');
 await page.locator('#board').evaluate(async board=>{
  const pending=[];for(let node=board;node;node=node.parentElement)for(const animation of node.getAnimations())if(animation.effect?.target===node&&animation.playState==='running'&&animation.effect.getTiming().iterations!==Infinity)pending.push(animation.finished.catch(()=>{}));
  await Promise.all(pending);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 });
}
async function touchPair(page,pair){
 for(const index of pair){const box=await page.locator('#board [data-index="'+index+'"] .floor-shape').boundingBox();assert(box,'real floor '+index+' is visible');await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}
 await page.waitForFunction(()=>document.getElementById('board').getAttribute('aria-busy')==='false');
}
async function profile(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROFILE);}
async function capture(page){
 return page.evaluate(()=>({
  profile:localStorage.getItem('hexrota-profile-v2'),gameMirror:localStorage.getItem('hexrota-match-v5'),lifeMirror:localStorage.getItem('hexrota-lives-v1'),events:localStorage.getItem('hexrota-events-v1'),playtest:localStorage.getItem('hexrota-playtest-v1'),
  rewards:JSON.parse(JSON.stringify(window.__boardRecoveryRewards)),
  visible:{values:[...document.querySelectorAll('#board [data-index]')].map(node=>Number(node.querySelector('.hex-number')?.textContent)),score:Number(document.getElementById('sum').textContent),moves:Number(document.getElementById('moves-left').textContent)}
 }));
}
async function installFault(page,position){
 await page.evaluate(position=>{
  const native=HexMatch.prototype._stableBoard,write=Storage.prototype.setItem;
  const audit=window.__boardRecoveryFault={position,armed:true,helperCalls:0,profileWrites:0,trace:null};
  Storage.prototype.setItem=function(key,value){if(key==='hexrota-profile-v2')audit.profileWrites++;return write.call(this,key,value);};
  HexMatch.prototype._stableBoard=function(...args){
   if(!audit.armed)return native.apply(this,args);
   audit.helperCalls++;audit.trace={entry:this.snapshot(),originalCalled:false,after:null};audit.armed=false;
   if(position==='after'){const returned=native.apply(this,args);audit.trace.originalCalled=true;audit.trace.returned=returned;audit.trace.after=this.snapshot();}
   throw new Error('test-only '+position+' recovery helper exception');
  };
 },position);
}
async function assertAvailable(page){
 assert.equal(await page.locator('#board').getAttribute('aria-busy'),'false');assert.equal(await page.locator('#board').getAttribute('aria-disabled'),'false');
 assert.equal(await page.locator('#hint').count(),0,'manual hint remains absent after command failure');assert.equal(await page.locator('#reset').isDisabled(),false);assert.equal(await page.locator('#open-inventory').isDisabled(),false);
 assert.deepEqual(await page.locator('dialog[open]').evaluateAll(nodes=>nodes.map(node=>node.id)),[],'no speculative result or provider modal');
 assert.equal(await page.locator('.swap-pair,.swap-layer .swap-stone,.score-packet,.tutorial-demo-layer').count(),0,'no retired presentation nodes remain');
}
function assertVisible(captured,snapshot){
 assert.deepEqual(captured.visible.values,snapshot.values,'the rendered values corroborate rollback of the private engine');assert.equal(captured.visible.score,snapshot.score);assert.equal(captured.visible.moves,snapshot.movesLeft);
}
function stableGeometry(before,after){for(const key of ['x','y','width','height'])assert(Math.abs(before[key]-after[key])<.01,'same-phase board geometry '+key+' stays within0.01px');}
async function screenshot(page,name){await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});}
async function check(name,run){if(process.env.HEXROTA_BOARD_RECOVERY_ONLY&&!name.includes(process.env.HEXROTA_BOARD_RECOVERY_ONLY))return;await run();results.push({name,passed:true});console.log('PASS '+browserName+' '+name);}

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port+'/';
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...(executable?{executablePath:executable}:{}),...(browserName==='chromium'?{args:['--no-sandbox']}:{})});
 for(const [width,height]of [[320,568],[390,844],[430,932]])for(const position of ['before','after'])await check(width+'x'+height+' '+position+' real recovery helper fault rolls back and the same native move retries/reloads',async()=>{
  const f=await open({width,height});try{
   await enter(f.page);const initialCapture=await capture(f.page),before=await profile(f.page),initialBoard=plain(board(before)),initialAttempt=plain(attempt(before)),dimensions=await f.page.locator('#board').boundingBox();
   assert.deepEqual(initialBoard,plain(initial.snapshot()));assert.equal(initialAttempt.attemptId,'legacy-1');assertVisible(initialCapture,initialBoard);await assertAvailable(f.page);
   await installFault(f.page,position);await touchPair(f.page,fixture.steps[0].pair);
   await f.page.waitForFunction(()=>window.__boardRecoveryFault.helperCalls===1);
   const afterFault=await capture(f.page),audit=await f.page.evaluate(()=>window.__boardRecoveryFault);
   assert.deepEqual(afterFault,initialCapture,'failed real command preserves the entire canonical profile, mirrors, events, observations, reward state and visible board');
   assert.equal(audit.helperCalls,1);assert.equal(audit.profileWrites,0,'recovery exception cannot reach canonical persistence');assert.equal(audit.trace.entry.turn,1);assert.equal(audit.trace.entry.movesLeft,1);assert.equal(audit.trace.entry.score,3);assert.deepEqual(audit.trace.entry.history,[[0,1]]);assert.notEqual(audit.trace.entry.rngState,initialBoard.rngState,'the real swap and shuffle attempts already consumed RNG inside the failed command');
   if(position==='after'){assert.equal(audit.trace.originalCalled,true);assert.equal(audit.trace.returned,true);assert.deepEqual(audit.trace.after,expectedSnapshot,'the real helper completed its frozen recovery before the injected error');}
   else{assert.equal(audit.trace.originalCalled,false);assert.equal(audit.trace.after,null);}
   const afterFaultDimensions=await f.page.locator('#board').boundingBox();
   await assertAvailable(f.page);assert.match(await f.page.locator('#toast').textContent(),/tamamlanamadı.*geri yüklendi/);stableGeometry(dimensions,afterFaultDimensions);
   await screenshot(f.page,'fault-'+position+'-'+width);
   // The one-shot fault is now disarmed. This is a new explicit native gesture,
   // not a test call to the engine or an automatic recovery command.
   await touchPair(f.page,fixture.steps[0].pair);const committed=await profile(f.page),afterRetry=await capture(f.page);
   assert.deepEqual(board(committed),expectedSnapshot);assert.deepEqual(attempt(committed),initialAttempt);assert.deepEqual(committed.game.economy,before.game.economy);assert.deepEqual(committed.energy,before.energy);assert.deepEqual(committed.game.variantSelection,before.game.variantSelection);
   assert.equal(committed.revision,before.revision+1,'one accepted retry uses one canonical commit');assert.equal(await f.page.evaluate(()=>window.__boardRecoveryFault.profileWrites),1);assertVisible(afterRetry,expectedSnapshot);await assertAvailable(f.page);
   const timeOrigin=await f.page.evaluate(()=>performance.timeOrigin);await f.page.reload({waitUntil:'domcontentloaded'});await f.page.waitForFunction(()=>document.body.dataset.screen==='home');assert.notEqual(await f.page.evaluate(()=>performance.timeOrigin),timeOrigin,'an actual new document loaded');await enter(f.page);
   const reloaded=await profile(f.page),afterReload=await capture(f.page);assert.deepEqual(reloaded.game,committed.game);assert.deepEqual(reloaded.energy,committed.energy);assert.deepEqual(board(reloaded),expectedSnapshot);assert.deepEqual(attempt(reloaded),initialAttempt);assert.equal(afterReload.events,afterRetry.events,'reload and resume cannot replay an event');assert.deepEqual(afterReload.rewards.state,afterRetry.rewards.state,'restored reward state matches the single accepted retry');assertVisible(afterReload,expectedSnapshot);await assertAvailable(f.page);
   measurements.push({viewport:{width,height},faultPosition:position,helperTrace:audit.trace,profileWritesAfterFault:audit.profileWrites,profileWritesAfterRetry:1,canonicalUnchangedAfterFault:true,rewardStateUnchangedAfterFault:true,attemptId:initialAttempt.attemptId,retrySnapshot:expectedSnapshot,actualReload:true,boardBefore:dimensions,boardAfterFault:afterFaultDimensions,boardAfterReload:await f.page.locator('#board').boundingBox()});
   await screenshot(f.page,'retry-reload-'+position+'-'+width);
  }finally{await f.close();}
 });
 assert.deepEqual(errors,[],'production performSwap catches the injected helper failure without unhandled browser errors');console.log('Board recovery browser checks passed: '+results.length+' actual '+browserName+' groups; native touch and real reload. No physical-device or native C# host claim.');
})().catch(error=>{failure=error.stack||String(error);console.error(error);process.exitCode=1;}).finally(async()=>{
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({browser:browserName,success:!failure,passed:results.length,results,measurements,errors,failure,physicalDeviceTested:false,nativeCSharpHostFaultInjected:false,fixtureId:fixture.id,fixtureIsolation:'exact frozen recovery input aliased to numeric L1/original-v1 only in local HTTP responses',faultInjection:'test-only one-shot exception at the real _stableBoard entry or after the original helper returns; no engine, solver, presenter or transaction replacement',filter:process.env.HEXROTA_BOARD_RECOVERY_ONLY||null},null,2)+'\n');
 if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));
});
