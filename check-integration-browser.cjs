/* Real browser boundaries: touch -> atomic profile -> observations -> offline resume. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const {fresh,existing,lifePool,plain,NOW}=require('./check-lives-ui.cjs');
const {createTracker}=require('./dist/playtest.js');
const PROFILE='hexrota-profile-v2',OBS='hexrota-playtest-v1',dist=path.join(__dirname,'dist');
const shellVersion=fs.readFileSync(path.join(dist,'sw.js'),'utf8').match(/const CACHE='hexrota-shell-v(\d+)'/)?.[1];assert(shellVersion,'the integrated shell is explicitly versioned');
const shellCache='hexrota-shell-v'+shellVersion;
const markup=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const offlineAssets=['','assets/characters/tavik/front.webp',...new Set([...markup.matchAll(/(?:src|href)=["']\.\/([^"']+\.(?:js|css)\?v=\d+)["']/g)].map(match=>match[1]).concat(['hint-worker.js','engine.js','variants-data.js'].map(file=>file+'?v='+shellVersion)))];
assert(offlineAssets.includes('economy-config.js?v='+shellVersion)&&offlineAssets.includes('economy.js?v='+shellVersion),'offline progression dependencies are loaded by the real shell');
const Engine=existing().game.constructor,results=[],errors=[],external=[];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const server=http.createServer((request,response)=>{
 let relative;try{relative=decodeURIComponent(new URL(request.url,'http://test').pathname);}catch(_){response.writeHead(400).end();return;}
 const filename=path.resolve(dist,'.'+(relative==='/'?'/index.html':relative));
 if(!filename.startsWith(dist+path.sep)){response.writeHead(403).end();return;}
 fs.readFile(filename,(error,body)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream','cache-control':'no-store'});response.end(body);});
});
function optedIn(){const tracker=createTracker({now:()=>NOW,monotonic:()=>0});tracker.setEnabled(true);return tracker.snapshot();}
const read=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROFILE);
const observations=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),OBS);
const ready=page=>page.waitForFunction(()=>!!window.HexLifeTestAdapter);
async function enter(page){await page.locator('#home-play').click();if(await page.locator('#pregame-dialog').evaluate(node=>node.open))await page.locator('#pregame-start').click();await page.waitForFunction(()=>document.body.dataset.screen==='game'&&document.getElementById('board').getAttribute('aria-busy')==='false');}
async function levelFor(page){return page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('hexrota-profile-v2')),i=p.game.current,meta=p.game.attempts[i];return i<2?HEX_TUTORIALS[i]:HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(HEX_LEVELS[i-2].id,meta.variantId,meta.levelDataVersion);});}
async function swipe(page,cdp,pair){
 const points=await page.evaluate(pair=>{const b=document.getElementById('board'),matrix=b.getScreenCTM();return pair.map(index=>{const tile=b.querySelector(`[data-index="${index}"]`),m=tile.transform.baseVal.consolidate().matrix,p=b.createSVGPoint();p.x=m.e;p.y=m.f;const value=p.matrixTransform(matrix);return {x:value.x,y:value.y};});},pair);
 const from=points[0],to={x:from.x+(points[1].x-from.x)*.46,y:from.y+(points[1].y-from.y)*.46};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...to,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>document.getElementById('board').getAttribute('aria-busy')==='false');
}
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/`;
 const executable=process.env.CHROMIUM_EXECUTABLE||process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 const browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{}),args:['--no-sandbox']});
 let current;
 async function open({saved=fresh(),life=lifePool(5),recording=false,workers=false}={}){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:workers?'allow':'block'});current=context;
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  context.on('request',request=>{if(!request.url().startsWith(url)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))external.push(request.url());});
  await context.addInitScript(({saved,life,observations,now})=>{
   window.__integrationUtc=now;Date.now=()=>window.__integrationUtc;
   if(location.protocol!=='http:')return;
   if(!localStorage.getItem('hexrota-profile-v2')&&!localStorage.getItem('hexrota-match-v5')){
    localStorage.setItem('hexrota-match-v5',JSON.stringify(saved));localStorage.setItem('hexrota-lives-v1',JSON.stringify(life));
    if(observations)localStorage.setItem('hexrota-playtest-v1',JSON.stringify(observations));
   }
  },{saved,life,observations:recording?optedIn():null,now:NOW});
  const page=await context.newPage();await page.goto(url);await ready(page);const cdp=await context.newCDPSession(page);return {page,context,cdp};
 }
 async function check(name,run){try{await run();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack||error.message});console.error('FAIL '+name+': '+error.message);}finally{if(current)await current.close();current=null;}}
 try{
  await check('native short swipe commits exact board and one opted-in move in the canonical profile',async()=>{
   const {page,cdp}=await open();assert.equal(await page.locator('#setting-playtest').isChecked(),false);
   await page.locator('#settings').click();await page.locator('#setting-playtest').check();await page.locator('#settings-done').click();await enter(page);
   const before=await read(page),stage=before.game.current,level=await levelFor(page),model=new Engine(level,before.game.boards[stage]),pair=plain(level.solution[0]);model.swap(...pair);
   await swipe(page,cdp,pair);const after=await read(page),obs=await observations(page);
   assert.deepEqual(after.game.boards[stage],plain(model.snapshot()));assert.equal(after.energy.life.lives,5);assert.equal(obs.events.filter(e=>e.name==='move').length,1);assert.equal(obs.events.find(e=>e.name==='move').data.attemptId,after.game.attempts[stage].attemptId);
   await page.reload();await ready(page);await enter(page);assert.deepEqual((await read(page)).game.boards[stage],after.game.boards[stage]);assert.equal((await observations(page)).events.filter(e=>e.name==='move').length,1);
  });
  await check('quota-failed native swipe rolls back board, life and observations; a later committed retry records once',async()=>{
   const {page,cdp}=await open({recording:true});await enter(page);const before=await read(page),stage=before.game.current,level=await levelFor(page),pair=plain(level.solution[0]);
   const oldEvents=(await observations(page)).events;
   await page.evaluate(()=>{const native=Storage.prototype.setItem;window.__restoreIntegrationStorage=()=>Storage.prototype.setItem=native;Storage.prototype.setItem=function(key,value){if(key==='hexrota-profile-v2')throw new DOMException('quota','QuotaExceededError');return native.call(this,key,value);};});
   await swipe(page,cdp,pair);assert.deepEqual(await read(page),before);assert.deepEqual((await observations(page)).events,oldEvents,'uncommitted turns must not survive as observed moves');
   await page.evaluate(()=>window.__restoreIntegrationStorage());await page.reload();await ready(page);await enter(page);await swipe(page,cdp,pair);const after=await read(page),model=new Engine(level,before.game.boards[stage]);model.swap(...pair);assert.deepEqual(after.game.boards[stage],plain(model.snapshot()));assert.equal(after.energy.life.lives,5);assert.equal((await observations(page)).events.filter(e=>e.name==='move').length,1);
  });
  await check('failed final swipe cannot debit a life or publish a loss until its canonical commit succeeds',async()=>{
   const entry=existing(11,{lost:true}),route=plain(entry.game.history),last=route.pop(),model=new Engine(entry.game.level);let cascades=0;for(const pair of route)cascades+=Math.max(0,model.swap(...pair).frames.length-1);
   const saved=plain(entry.saved);saved.boards[11]=plain(model.snapshot());saved.attemptStats[11].terminalEvent=null;saved.attemptStats[11].cascades=cascades;
   const {page,cdp}=await open({saved,recording:true});await enter(page);const before=await read(page),oldEvents=(await observations(page)).events;
   await page.evaluate(()=>{const native=Storage.prototype.setItem;window.__restoreIntegrationStorage=()=>Storage.prototype.setItem=native;Storage.prototype.setItem=function(key,value){if(key==='hexrota-profile-v2')throw new DOMException('quota','QuotaExceededError');return native.call(this,key,value);};});
   await swipe(page,cdp,last);assert.deepEqual(await read(page),before);assert.deepEqual((await observations(page)).events,oldEvents);assert.equal(await page.locator('#lose-dialog').evaluate(node=>node.open),false);
   await page.evaluate(()=>window.__restoreIntegrationStorage());await page.reload();await ready(page);await enter(page);await swipe(page,cdp,last);await page.waitForFunction(()=>document.getElementById('lose-dialog').open);
   const after=await read(page);model.swap(...last);assert.equal(model.status,'lost');assert.deepEqual(after.game.boards[11],plain(model.snapshot()));assert.equal(after.energy.life.lives,4);assert.equal((await observations(page)).events.filter(e=>e.name==='level_failed').length,1);assert.equal((await observations(page)).events.filter(e=>e.name==='move').length,1);
  });
  for(const legacy of [false,true])await check((legacy?'legacy original':'certified variant')+' in-flight board migrates and resumes at zero lives without changing RNG or history',async()=>{
   const entry=existing(2,{legacy}),{page}=await open({saved:plain(entry.saved),life:lifePool(0),recording:true});await enter(page);let profile=await read(page);assert.deepEqual(profile.game.boards[2],plain(entry.game.snapshot()));assert.equal(profile.energy.life.lives,0);assert.equal(profile.game.attempts[2].variantId,legacy?'legacy-original':entry.metadata.variantId);
   const identity=profile.game.attempts[2];await page.reload();await ready(page);await enter(page);profile=await read(page);assert.deepEqual(profile.game.boards[2],plain(entry.game.snapshot()));assert.deepEqual(profile.game.attempts[2],identity);assert.equal(profile.energy.life.lives,0);assert.equal((await observations(page)).events.filter(e=>e.name==='level_started').length,0);
  });
  await check('actual PWA shell restores opt-in canonical game offline and serves its hint worker dependencies',async()=>{
   const {page,context,cdp}=await open({recording:true,workers:true});await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   await page.evaluate(()=>navigator.serviceWorker.controller.postMessage({type:'CACHE_APP'}));
   await page.waitForFunction(async({cacheName,assets})=>{const cache=await caches.open(cacheName);return(await Promise.all(assets.map(name=>cache.match(new URL(name,location.href).href)))).every(Boolean);},{cacheName:shellCache,assets:offlineAssets});
   await enter(page);const initial=await read(page),stage=initial.game.current,level=await levelFor(page),model=new Engine(level,initial.game.boards[stage]);model.swap(...level.solution[0]);await swipe(page,cdp,plain(level.solution[0]));assert.deepEqual((await read(page)).game.boards[stage],plain(model.snapshot()));
   await context.setOffline(true);await page.reload();await ready(page);await page.locator('.tavik-portrait img').evaluate(n=>n.decode());assert.equal(await page.locator('.tavik-portrait img').evaluate(n=>n.naturalWidth),147,'approved Tavik remains available offline');await enter(page);assert.deepEqual((await read(page)).game.boards[stage],plain(model.snapshot()));assert.equal(await page.locator('#setting-playtest').isChecked(),true);
   const beforeHint=(await read(page)).game.boards[stage];await page.locator('#hint').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('hexrota-playtest-v1')).events.some(e=>e.name==='hint_used'));assert.deepEqual((await read(page)).game.boards[stage],beforeHint,'offline hint cannot change score, RNG or spent moves');
   const next=plain(level.solution[1]);model.swap(...next);await swipe(page,cdp,next);const after=await read(page);assert.deepEqual(after.game.boards[stage],plain(model.snapshot()));assert.equal(after.energy.life.lives,5);assert.equal((await observations(page)).events.filter(e=>e.name==='move').length,2);
   await context.setOffline(false);
  });
  assert.deepEqual(errors,[],'no uncaught browser errors across combined flows');assert.deepEqual(external,[],'local developer tests never send data to an external service');
  const report={browser:'chromium',transport:'native CDP touch',checks:results.length,results,errors,externalRequests:external,physicalIPhoneTested:false};
  if(process.env.HEXROTA_INTEGRATION_BROWSER_REPORT)fs.writeFileSync(process.env.HEXROTA_INTEGRATION_BROWSER_REPORT,JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:results.length,failed:results.filter(row=>!row.passed).length,physicalIPhoneTested:false}));assert.equal(results.filter(row=>!row.passed).length,0);
 }finally{if(current)await current.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;server.close();});
