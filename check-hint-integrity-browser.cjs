/* Real HTTP/mobile-browser hint boundary: native #hint touch -> actual Worker ->
 * production engine -> rendered pair and truthful observation. Forged metadata
 * exists only in this server's /forged/ responses. Delivery gates below hold real
 * Worker MessageEvents for cancellation/timeout policy tests; they do not invent
 * a hint or measure solver speed. Offline reload remains in integration-browser. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium,webkit}=require('playwright');
const {fresh,lifePool,plain,NOW}=require('./check-lives-ui.cjs');
const {createTracker}=require('./dist/playtest.js');
const dist=path.join(__dirname,'dist'),PROFILE='hexrota-profile-v2',OBS='hexrota-playtest-v1';
const browserName=process.env.HEXROTA_BROWSER||'chromium';
assert(['chromium','webkit'].includes(browserName),'supported real browser');
const output=process.env.HEXROTA_HINT_INTEGRITY_SCREENSHOT_DIR||path.join(__dirname,'test-results','hint-integrity-'+browserName);
fs.mkdirSync(output,{recursive:true});
const runtime={window:{},performance};vm.createContext(runtime);
for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js'])vm.runInContext(fs.readFileSync(path.join(dist,file),'utf8'),runtime,{filename:file});
const R=runtime.window,Engine=R.HexMatch,pack=plain(R.HEX_VARIANTS),catalog=R.HexAttempts.createCatalog(R.HEX_LEVELS,pack,Engine);
const forged=plain(pack),forgedVariant=forged.levels.find(row=>row.levelId===1).variants.find(row=>row.id==='v1');
forgedVariant.solutions=[[[14,18]],[[13,16]]];
const forgedCatalog=R.HexAttempts.createCatalog(R.HEX_LEVELS,forged,Engine);
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const requests=[],results=[],errors=[],externalRequests=[];let browser,url,failure=null,currentCase=null;
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);}catch(_){res.writeHead(400).end();return;}
 const match=pathname.match(/^\/(published|forged|worker-error)(?:\/|$)/),mode=match?.[1]||'published';
 if(match)pathname=pathname.slice(match[0].length-(match[0].endsWith('/')?1:0))||'/';
 const file=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(dist+path.sep)){res.writeHead(403).end();return;}
 const record={path:new URL(req.url,'http://local').pathname,mode,status:200};requests.push(record);
 if(mode==='worker-error'&&path.basename(file)==='hint-worker.js'){
  record.status=404;res.writeHead(404,{'content-type':'application/javascript','cache-control':'no-store'}).end('/* Explicit worker-load-failure fixture. */');return;
 }
 if(mode==='forged'&&['variants-data.js','variants.json'].includes(path.basename(file))){
  record.override='forged L1/v1 exact one-move prefixes';
  res.writeHead(200,{'content-type':mime[path.extname(file)],'cache-control':'no-store'}).end(path.basename(file)==='variants-data.js'?'window.HEX_VARIANTS='+JSON.stringify(forged)+';\n':JSON.stringify(forged));return;
 }
 fs.readFile(file,(error,bytes)=>{if(error){record.status=404;res.writeHead(404).end();return;}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(bytes);});
});

function campaignSeed(){
 const saved=fresh(2),metadata={attemptVersion:1,levelId:1,variantId:'v1',levelDataVersion:pack.levelDataVersion,attemptId:'a-1-7-0041abca',attemptSerial:7};
 saved.boards[2]=plain(new Engine(catalog.resolveLevel(1,'v1',pack.levelDataVersion)).snapshot());
 saved.attempts={2:metadata};saved.attemptStats={2:{attemptId:metadata.attemptId,attemptNumber:1,started:true,terminalEvent:null,hintsUsed:0,cascades:0}};
 saved.variantSelection.serial=7;saved.variantSelection.counts[1]=1;saved.variantSelection.recent[1]=['v1'];return saved;
}
function tutorialSeed(){const saved=fresh(0);saved.boards[0]=plain(new Engine(R.HEX_TUTORIALS[0]).snapshot());return saved;}
function optedIn(){const tracker=createTracker({now:()=>NOW,monotonic:()=>0});tracker.setEnabled(true);return tracker.snapshot();}
async function profile(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROFILE);}
async function observations(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),OBS);}
async function capture(page){return page.evaluate(()=>window.__hintIntegrityCapture.serializable());}
async function open({size={width:390,height:844},mode='published',gate='pass',saved=campaignSeed()}={}){
 const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addInitScript(({saved,energy,observations,now,gate})=>{
  if(location.protocol!=='http:')return;Date.now=()=>now;
  if(!localStorage.getItem('hexrota-profile-v2')&&!localStorage.getItem('hexrota-match-v5')){
   localStorage.setItem('hexrota-match-v5',JSON.stringify(saved));localStorage.setItem('hexrota-lives-v1',JSON.stringify(energy));localStorage.setItem('hexrota-playtest-v1',JSON.stringify(observations));
  }
  const clone=value=>JSON.parse(JSON.stringify(value)),workers=[],held=[],fallback=[];
  window.__hintIntegrityCapture={
   workers,fallback,
   release(){const pending=held.splice(0);for(const deliver of pending)deliver();return pending.length;},
   serializable(){return clone({workers,fallback,heldMessages:held.length,gate});}
  };
  const NativeWorker=window.Worker;
  function ObservedWorker(script,options){
   const worker=new NativeWorker(script,options);
   if(!new URL(script,location.href).pathname.endsWith('/hint-worker.js'))return worker;
   const row={url:new URL(script,location.href).href,requests:[],messages:[],errors:[],terminateCalls:0};workers.push(row);
   let appOnmessage=null;
   // The listener always sees the genuine native Worker response first. Only
   // the app callback is gated, to simulate delayed delivery without fake data.
   worker.addEventListener('message',event=>{
    row.messages.push(clone(event.data));
    const deliver=()=>{if(typeof appOnmessage==='function')appOnmessage.call(worker,event);};
    if(gate==='hold')held.push(deliver);else deliver();
   });
   worker.addEventListener('error',event=>row.errors.push(event.message||'worker load error'));
   Object.defineProperty(worker,'onmessage',{configurable:true,get:()=>appOnmessage,set:value=>{appOnmessage=value;}});
   const post=worker.postMessage.bind(worker),terminate=worker.terminate.bind(worker);
   worker.postMessage=function(message,...rest){row.requests.push(clone(message));return post(message,...rest);};
   worker.terminate=function(){row.terminateCalls++;return terminate();};return worker;
  }
  ObservedWorker.prototype=NativeWorker.prototype;Object.setPrototypeOf(ObservedWorker,NativeWorker);window.Worker=ObservedWorker;
 },{saved,energy:lifePool(5),observations:optedIn(),now:NOW,gate});
 const page=await context.newPage();page.on('pageerror',error=>errors.push({case:currentCase,message:error.message}));
 context.on('request',request=>{if(!request.url().startsWith(url)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))externalRequests.push(request.url());});
 try{
  await page.goto(url+mode+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.screen==='home'&&!!window.HexLifeTestAdapter);
  await page.locator('#home-play').tap();if(await page.locator('#pregame-dialog').evaluate(node=>node.open))await page.locator('#pregame-start').tap();
  await page.waitForFunction(()=>document.body.dataset.screen==='game'&&document.getElementById('board').getAttribute('aria-busy')==='false');
  await page.evaluate(()=>{
   const original=HexMatch.prototype.hint;
   HexMatch.prototype.hint=function(options){
    const before=this.snapshot(),hint=original.call(this,options);
    window.__hintIntegrityCapture.fallback.push(JSON.parse(JSON.stringify({options,before,after:this.snapshot(),hint})));return hint;
   };
  });
  return {context,page,close:()=>context.close()};
 }catch(error){await context.close();throw error;}
}
function unchangedGameplay(before,after,hints=1){
 const expected=plain(before.game),stage=expected.current;
 expected.attemptStats[stage].hintsUsed+=hints;
 assert.deepEqual(after.game,expected,'only the legitimate hint statistic changes; board, RNG, score, moves, turn, history, Attempt, progression, economy and rescue stay exact');
 assert.deepEqual(after.energy,before.energy,'a hint cannot spend a life or mutate the life/provider wallet');
 assert.equal(after.schemaVersion,before.schemaVersion);assert(after.revision>=before.revision,'canonical revisions remain monotonic');
}
function samePair(a,b){return !!a&&!!b&&a.length===2&&b.length===2&&a.slice().sort((x,y)=>x-y).join(',')===b.slice().sort((x,y)=>x-y).join(',');}
function truthful(request,hint){
 assert(hint,'the real engine returns a hint');
 assert.deepEqual(Object.keys(hint).sort(),['pair','source','guaranteed','continuation','searchedNodes','depth','truncated'].sort(),'public HintResult fields remain stable');
 const game=new Engine(request.level,request.snapshot),before=plain(game.snapshot());
 assert(game.legalMoves().some(pair=>samePair(pair,hint.pair)),'the result is legal in the exact submitted state');
 assert(['proven_route','search_win','heuristic'].includes(hint.source));assert.equal(hint.guaranteed,hint.source!=='heuristic');
 if(hint.guaranteed){
  assert(Array.isArray(hint.continuation)&&hint.continuation.length>0&&hint.continuation.length<=game.movesLeft);assert(samePair(hint.pair,hint.continuation[0]));
  const proof=game.clone();for(const pair of hint.continuation)assert.equal(proof.swap(...pair).ok,true,'every advertised continuation swap replays');
  assert.equal(proof.status,'won','every claimed guarantee wins in an independent production-engine replay');
 }else assert.equal(hint.continuation,null);
 assert.deepEqual(plain(game.snapshot()),before,'independent validation does not alter its source snapshot');
}
async function fits(page,selector){const box=await page.locator(selector).boundingBox(),size=page.viewportSize();assert(box&&box.width>0&&box.height>0,selector+' rendered');assert(box.x>=-.5&&box.y>=-.5&&box.x+box.width<=size.width+.5&&box.y+box.height<=size.height+.5,selector+' reachable at '+size.width+'x'+size.height);}
async function hintedPair(page){return page.locator('#board .hinted').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.index)).sort((a,b)=>a-b));}
async function finishHint(page){
 await page.waitForFunction(()=>{const p=JSON.parse(localStorage.getItem('hexrota-profile-v2'));return p.game.attemptStats[p.game.current].hintsUsed===1&&!document.getElementById('hint').disabled;});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function resultEvidence(f,before,{source=null,fallback=false}={}){
 await finishHint(f.page);const after=await profile(f.page),seen=await capture(f.page),worker=seen.workers[0];
 unchangedGameplay(before,after);assert.equal(seen.workers.length,1,'normal campaign UI starts one genuine Worker');assert.equal(worker.requests.length,1);assert(worker.terminateCalls>=1,'completed jobs terminate the native worker');
 assert.deepEqual(worker.requests[0].snapshot,before.game.boards[before.game.current],'worker receives the exact canonical board');
 const hint=fallback?seen.fallback[0]?.hint:worker.messages[0]?.hint;
 if(fallback){assert.equal(seen.fallback.length,1,'one actual main-thread engine fallback');assert.deepEqual(seen.fallback[0].after,seen.fallback[0].before,'fallback hint is read only');}
 else{assert.equal(worker.messages.length,1,'a genuine Worker MessageEvent supplies the result');assert.equal(seen.fallback.length,0,'the result reaches the app from the real worker');}
 truthful(worker.requests[0],hint);if(source)assert.equal(hint.source,source);
 assert.deepEqual(await hintedPair(f.page),hint.pair.slice().sort((a,b)=>a-b),'native hint result is rendered on exactly the suggested tiles');
 const events=(await observations(f.page)).events.filter(row=>row.name==='hint_used');assert.equal(events.length,1);assert.equal(events[0].data.hintKind,hint.source);
 assert.equal(events[0].data.hintGuarantee,hint.source==='proven_route'?'certified_route':hint.source==='search_win'?'bounded_search':'none');
 assert.equal(events[0].data.attemptId,before.game.attempts[before.game.current].attemptId);
 if(hint.source==='heuristic')assert.match(await f.page.locator('#toast').textContent(),/garantisi yok/i,'heuristic wording explicitly carries no winning guarantee');
 return {hint,seen,evidence:{viewport:f.page.viewportSize(),workerScript:worker.url,source:hint.source,guaranteed:hint.guaranteed,continuationLength:hint.continuation?.length||0,fallbackCalls:seen.fallback.length,workerErrors:worker.errors,workerTerminations:worker.terminateCalls,visiblePair:await hintedPair(f.page)}};
}
async function screenshot(page,name){await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});}
async function check(name,run){
 if(process.env.HEXROTA_HINT_INTEGRITY_ONLY&&!name.includes(process.env.HEXROTA_HINT_INTEGRITY_ONLY))return;
 currentCase=name;const evidence=await run();results.push({name,passed:true,...evidence});console.log('PASS '+browserName+' '+name);currentCase=null;
}

(async()=>{
 // Freeze the exact nonwinning counterexample before any browser assertions.
 const badLevel=forgedCatalog.resolveLevel(1,'v1',pack.levelDataVersion);
 for(const route of forgedVariant.solutions){const proof=new Engine(badLevel);assert.equal(proof.swap(...route[0]).ok,true);assert.equal(proof.status,'playing','the exact one-move forged prefix does not win');}
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port+'/';
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...executable?{executablePath:executable}:{},args:browserName==='chromium'?['--no-sandbox']:[]});
 for(const [width,height]of [[320,568],[390,844],[430,932]]){
  await check(`published L1/v1 ${width}x${height} native hint returns a real proven route`,async()=>{
   const f=await open({size:{width,height}});try{await fits(f.page,'#hint');const before=await profile(f.page);await f.page.locator('#hint').tap();const result=await resultEvidence(f,before,{source:'proven_route'});assert.deepEqual(result.hint.continuation,plain(catalog.resolveLevel(1,'v1',pack.levelDataVersion).solution));await screenshot(f.page,'published-'+width);return result.evidence;}finally{await f.close();}
  });
  await check(`forged L1/v1 ${width}x${height} actual worker rejects nonwinning one-move certificates`,async()=>{
   const f=await open({size:{width,height},mode:'forged'});try{
    const served=await f.page.evaluate(async()=>({script:HEX_VARIANTS,json:await(await fetch('./variants.json')).json()}));
    for(const data of [served.script,served.json])assert.deepEqual(data.levels.find(row=>row.levelId===1).variants.find(row=>row.id==='v1').solutions,[[[14,18]],[[13,16]]],'HTTP-only forged fixture reaches both catalog representations');
    await fits(f.page,'#hint');const before=await profile(f.page);await f.page.locator('#hint').tap();const result=await resultEvidence(f,before);assert.notEqual(result.hint.source,'proven_route','nonwinning metadata cannot earn an authored guarantee');assert.deepEqual(result.seen.workers[0].requests[0].level.solutions,forgedVariant.solutions);await screenshot(f.page,'forged-'+width);return result.evidence;
   }finally{await f.close();}
  });
 }
 await check('390x844 explicit worker HTTP load error uses the actual read-only app fallback',async()=>{
  const f=await open({mode:'worker-error'});try{const before=await profile(f.page);await f.page.locator('#hint').tap();const result=await resultEvidence(f,before,{source:'proven_route',fallback:true});assert.equal(result.seen.workers[0].messages.length,0);assert(result.seen.workers[0].errors.length>0,'a genuine native Worker error triggers fallback');await screenshot(f.page,'worker-load-error-fallback');return {...result.evidence,fault:'HTTP 404 for hint-worker.js only'};}finally{await f.close();}
 });
 await check('430x932 synthetic held real-worker delivery reaches the timeout fallback safely',async()=>{
  const f=await open({size:{width:430,height:932},gate:'hold'});try{
   const before=await profile(f.page);await f.page.locator('#hint').tap();const result=await resultEvidence(f,before,{source:'proven_route',fallback:true});assert.equal(result.seen.workers[0].messages.length,1,'the held message was computed by the genuine worker');assert.equal(result.seen.heldMessages,1);truthful(result.seen.workers[0].requests[0],result.seen.workers[0].messages[0].hint);
   const stable=await profile(f.page);assert.equal(await f.page.evaluate(()=>window.__hintIntegrityCapture.release()),1);await f.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.deepEqual(await profile(f.page),stable,'releasing an already timed-out real response cannot commit a second hint');assert.equal((await observations(f.page)).events.filter(row=>row.name==='hint_used').length,1);await screenshot(f.page,'synthetic-timeout-fallback');return {...result.evidence,fault:'hold a genuine MessageEvent until the production timeout; this is a policy test, not a solver timing measurement'};
  }finally{await f.close();}
 });
 await check('320x568 navigation cancels a held actual worker result and guards late delivery',async()=>{
  const f=await open({size:{width:320,height:568},gate:'hold'});try{
   const before=await profile(f.page);await f.page.locator('#hint').tap();await f.page.waitForFunction(()=>window.__hintIntegrityCapture.workers[0]?.messages.length===1);assert.equal((await capture(f.page)).fallback.length,0,'navigate while the actual worker request is still pending');
   await f.page.locator('#game-home').tap();await f.page.waitForFunction(()=>document.body.dataset.screen==='home');const cancelled=await profile(f.page),seen=await capture(f.page);unchangedGameplay(before,cancelled,0);assert(seen.workers[0].terminateCalls>=1,'navigation terminates the native worker');truthful(seen.workers[0].requests[0],seen.workers[0].messages[0].hint);
   const stable={profile:cancelled,observations:await observations(f.page),pair:await hintedPair(f.page)};assert.equal(await f.page.evaluate(()=>window.__hintIntegrityCapture.release()),1);await f.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.deepEqual(await profile(f.page),stable.profile);assert.deepEqual(await observations(f.page),stable.observations,'stale delivery publishes no hint-used event');assert.deepEqual(await hintedPair(f.page),stable.pair);assert.equal(await f.page.locator('body').getAttribute('data-screen'),'home');assert.equal((await capture(f.page)).fallback.length,0,'cancelled jobs never invoke main-thread fallback');
   await f.page.locator('#home-play').tap();if(await f.page.locator('#pregame-dialog').evaluate(node=>node.open))await f.page.locator('#pregame-start').tap();await f.page.waitForFunction(()=>document.body.dataset.screen==='game');assert.equal(await f.page.locator('#hint').isEnabled(),true);assert.deepEqual(await hintedPair(f.page),[]);unchangedGameplay(before,await profile(f.page),0);await screenshot(f.page,'stale-worker-after-navigation');return {viewport:f.page.viewportSize(),source:seen.workers[0].messages[0].hint.source,deliveredAfterNavigation:true,lateHintEvents:0,fault:'gate and later release a real worker MessageEvent; production cancellation still calls native terminate'};
  }finally{await f.close();}
 });
 await check('320x568 tutorial H shortcut stays guidance with the hint control intentionally hidden',async()=>{
  const f=await open({size:{width:320,height:568},saved:tutorialSeed()});try{const before=await profile(f.page);assert.equal(await f.page.locator('#hint').isVisible(),false,'tutorials intentionally simplify the dock');await f.page.keyboard.press('h');await finishHint(f.page);unchangedGameplay(before,await profile(f.page));const seen=await capture(f.page);assert.equal(seen.workers.length,0);assert.equal(seen.fallback.length,0);assert.deepEqual(await hintedPair(f.page),plain(R.HEX_TUTORIALS[0].steps[0].pair).sort((a,b)=>a-b));const events=(await observations(f.page)).events.filter(row=>row.name==='hint_used');assert.equal(events.length,1);assert.equal(events[0].data.hintKind,'guided');assert.equal(events[0].data.hintGuarantee,'guided');await screenshot(f.page,'tutorial-guided');return {viewport:f.page.viewportSize(),source:'guided',guarantee:'guided',workersStarted:0,input:'real keyboard H production shortcut; tutorial #hint remains hidden'};}finally{await f.close();}
 });
 assert(results.length>0,'the optional name filter selects at least one check');assert.deepEqual(errors,[],'no uncaught application browser errors');assert.deepEqual(externalRequests,[],'local verification sends no external requests');
 console.log('Hint integrity browser checks passed: '+results.length+' actual '+browserName+' groups. Native campaign touch; tutorial keyboard H; no physical device or solver-speed claim.');
})().catch(error=>{failure=error.stack||String(error);console.error(error);process.exitCode=1;}).finally(async()=>{
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({browser:browserName,success:!failure,passed:results.length,results,errors,externalRequests,failure,failedCase:failure?currentCase:null,physicalDeviceTested:false,transport:'real local HTTP + native browser Worker + native Playwright touchscreen; production keyboard H shortcut for the tutorial whose hint control is hidden',fixtureIsolation:'only local /forged/ variants-data.js and variants.json responses are replaced; published files are never written',timeoutScope:'synthetic gating of a genuine native Worker MessageEvent verifies timeout policy, not performance',offlineCoverage:'check-integration-browser.cjs already verifies actual PWA offline reload and hint worker dependencies',requests,filter:process.env.HEXROTA_HINT_INTEGRITY_ONLY||null},null,2)+'\n');
 if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));
});
