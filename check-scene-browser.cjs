/* Actual HTTP/browser scene integration. Scene images never authorize game state.
 * Uses only isolated local browser profiles; physical-device testing is separate. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright'),{PNG}=require('pngjs');
const {legacyClears,beforeWin}=require('./check-progression-ui.cjs');
const {fresh,existing,lifePool,NOW}=require('./check-lives-ui.cjs');
const root=path.join(__dirname,'dist'),browserName=process.env.HEXROTA_BROWSER||'chromium';
assert(['chromium','webkit'].includes(browserName),'supported browser');
const output=process.env.HEXROTA_SCENE_SCREENSHOT_DIR||path.join(__dirname,'test-results','scene-'+browserName);
fs.mkdirSync(output,{recursive:true});
const PROFILE='hexrota-profile-v2',GAME='hexrota-match-v5',ENERGY='hexrota-lives-v1';
const plain=value=>JSON.parse(JSON.stringify(value));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.webp':'image/webp','.png':'image/png'};
let networkOffline=false;
const server=http.createServer((req,res)=>{
 if(networkOffline){res.destroy();return;}
 let file;try{const url=new URL(req.url,'http://local');file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));}catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);});
});
let browser,url;const errors=[],results=[],measurements=[];
async function check(name,run){if(process.env.HEXROTA_SCENE_ONLY&&!name.includes(process.env.HEXROTA_SCENE_ONLY))return;await run();results.push(name);console.log('PASS '+browserName+' '+name);}
async function profile(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROFILE);}
function stableRect(before,after,message){for(const key of ['x','y','width','height'])assert(Math.abs(before[key]-after[key])<=1,message+' '+key+' before='+before[key]+' after='+after[key]);}
function overlap(a,b,margin=0){return a.left<b.right-margin&&a.right>b.left+margin&&a.top<b.bottom-margin&&a.bottom>b.top+margin;}
async function screenshot(page,name){const b=await page.screenshot({animations:'allow'});fs.writeFileSync(path.join(output,name+'.png'),b);const p=PNG.sync.read(b),colors=new Set();for(let i=0;i<p.data.length;i+=4*41)colors.add(p.data[i]+','+p.data[i+1]+','+p.data[i+2]);assert(colors.size>30,name+' contains rendered image content');}
async function sceneReady(page,stage='clearing'){
 await page.waitForFunction(stage=>document.body.dataset.sceneActive==='true'&&document.body.dataset.sceneStage===stage,stage,{timeout:12000});
 await page.waitForFunction(stage=>{const n=document.querySelector('.hx-scene-background');return n&&n.complete&&n.naturalWidth>0&&new RegExp('/'+stage+'(?:-mobile)?\\.webp$').test(n.src);},stage,{timeout:12000});
}
async function actorReady(page){await page.waitForFunction(()=>document.body.dataset.sceneActorReady==='true'||!!document.querySelector('.hx-scene-fallback[src]'),{},{timeout:10000});}
async function fits(page,selector){const b=await page.locator(selector).boundingBox(),v=page.viewportSize();assert(b&&b.width>0&&b.height>0,selector+' has visible geometry');assert(b.x>=-1&&b.y>=-1&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1,selector+' stays in the viewport');return b;}
async function layout(page,{requireActor=false}={}){
 const data=await page.evaluate(()=>{
  const shown=n=>{if(!n)return false;const b=n.getBoundingClientRect();if(!b.width||!b.height)return false;for(let p=n;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||s.display==='none'||s.visibility==='hidden'||+s.opacity<.05)return false;}return true;};
  const rect=n=>n.getBoundingClientRect().toJSON();
  const anchor=document.querySelector('.hx-scene-actor-anchor');
  const image=anchor?.querySelector('.hx-tavik__sprite,.hx-scene-fallback');
  const active=shown(image);
  const cells=[...document.querySelectorAll('#board .floor-shape')].filter(shown).map(rect);
  const controls=[...document.querySelectorAll('.game-topbar,.tutorial-coach,.game-toolbar button')].filter(shown).map(rect);
  const focus=[...document.querySelectorAll('#board .tutorial-focus')].map(rect);
  return{active,actor:active?rect(image):null,anchor:anchor?rect(anchor):null,layout:anchor?.dataset.layout,face:anchor?.dataset.face,hiddenReason:anchor?.dataset.hiddenReason,cells,controls,focus,board:rect(document.querySelector('#board')),overflow:document.documentElement.scrollWidth>innerWidth,pointer:anchor?getComputedStyle(anchor).pointerEvents:null};
 });
 assert.equal(data.overflow,false,'scene adds no horizontal overflow');
 if(requireActor)assert(data.active,'Tavik is visible at this supported viewport');
 if(data.active){
  assert.equal(data.pointer,'none','the actor cannot intercept a board gesture');
  for(const target of [...data.cells,...data.controls])assert(!overlap(data.actor,target,1),'painted Tavik image cannot cover a stone, HUD, coach or control');
  const v=page.viewportSize();assert(data.actor.left>=-1&&data.actor.right<=v.width+1&&data.actor.top>=-1&&data.actor.bottom<=v.height+1,'the complete actor stays on screen');
  if(data.focus.length){const center=data.focus.reduce((n,r)=>n+(r.left+r.right)/2,0)/data.focus.length;assert.equal(data.face,center<(data.actor.left+data.actor.right)/2?'left':'right','pointing pose faces the actual guided pair');}data.paintedActorPixels=await paintedActor(page);
 }else assert(['hidden','dock','game'].includes(data.layout)||data.hiddenReason,'a hidden compact actor has an explicit safe-layout result');
 measurements.push({viewport:page.viewportSize(),actorVisible:data.active,paintedActorPixels:data.paintedActorPixels,layout:data.layout,hiddenReason:data.hiddenReason,board:data.board});return data;
}
async function paintedActor(page){
 const anchor=page.locator('.hx-scene-actor-anchor'),sprite=page.locator('.hx-scene-actor-anchor .hx-tavik__sprite,.hx-scene-actor-anchor .hx-scene-fallback').filter({visible:true}).first();
 const r=await sprite.boundingBox(),v=page.viewportSize(),clip={x:Math.max(0,Math.floor(r.x)),y:Math.max(0,Math.floor(r.y)),width:Math.min(v.width,Math.ceil(r.x+r.width))-Math.max(0,Math.floor(r.x)),height:Math.min(v.height,Math.ceil(r.y+r.height))-Math.max(0,Math.floor(r.y))};
 const old=await anchor.evaluate(n=>({visibility:n.style.visibility,animations:[...n.querySelectorAll('.hx-tavik__sprite')].map(m=>m.style.animationPlayState)}));
 let a,b;try{await anchor.evaluate(n=>{for(const m of n.querySelectorAll('.hx-tavik__sprite'))m.style.animationPlayState='paused';});a=PNG.sync.read(await page.screenshot({clip,animations:'allow'}));await anchor.evaluate(n=>n.style.visibility='hidden');b=PNG.sync.read(await page.screenshot({clip,animations:'allow'}));}
 finally{await anchor.evaluate((n,old)=>{n.style.visibility=old.visibility;[...n.querySelectorAll('.hx-tavik__sprite')].forEach((m,i)=>m.style.animationPlayState=old.animations[i]);},old);}
 let changed=0;for(let i=0;i<a.data.length;i+=4)if(Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2])>40)changed++;
 assert(changed>Math.max(12,a.width*a.height*.02),'actual rendered pixels show Tavik above the scene');return changed;
}
async function open(size,{saved,energy=lifePool(5),motion='reduce',serviceWorkers='block',routes,disableScene=false}={}){
 const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:motion==='reduce'?'reduce':'no-preference',serviceWorkers});
 await context.addInitScript(({saved,energy,now,motion})=>{if(location.protocol!=='http:')return;Date.now=()=>now;if(!localStorage.getItem('hexrota-profile-v2')){if(saved){saved.preferences={...saved.preferences,motion};localStorage.setItem('hexrota-match-v5',JSON.stringify(saved));}localStorage.setItem('hexrota-lives-v1',JSON.stringify(energy));}},{saved,energy,now:NOW,motion});
 if(disableScene)await context.route('**/scene-presentation.js*',route=>route.abort());
 if(routes)await routes(context);
 const page=await context.newPage(),requests=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Unhandled scene browser exception: '+e.stack);});page.on('request',r=>requests.push(new URL(r.url()).pathname));await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.screen==='home');return{context,page,requests};
}
async function enter(page){await page.locator('#home-play').tap();if(await page.locator('#pregame-dialog').evaluate(n=>n.open))await page.locator('#pregame-start').tap();await page.waitForFunction(()=>document.body.dataset.screen==='game');}
async function touchPair(page,pair){for(const i of pair){const n=page.locator(`#board [data-index="${i}"]`),r=await n.boundingBox();assert(r);await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}await page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='false');}
async function acknowledge(page){if(await page.locator('#coach-next').isVisible())await page.locator('#coach-next').tap();}
async function lesson(page,index){const route=await page.evaluate(i=>window.HEX_TUTORIALS[i].solution,index);for(const pair of route){await acknowledge(page);await touchPair(page,pair);}await page.locator('#win-dialog[open]').waitFor();}
async function gameSnapshot(page){return page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('hexrota-profile-v2'));return p.game.boards[p.game.current];});}
async function homeFromGame(page){await page.locator('#game-home').tap();await page.waitForFunction(()=>document.body.dataset.screen==='home');}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port+'/';
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...(executable?{executablePath:executable}:{}),...(browserName==='chromium'?{args:['--no-sandbox']}:{})});
 const sizes=[{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:932,height:430},{width:1280,height:720}];
 for(const size of sizes)await check(size.width+'×'+size.height+' sunny opening becomes the same real board without smaller geometry or actor overlap',async()=>{
  const current=await open(size);const baseline=await open(size,{disableScene:true});try{
   const{page}=current;await sceneReady(page);await actorReady(page);assert.equal(await page.locator('body').getAttribute('data-scene-mode'),'opening');assert.match(await page.locator('.hx-scene-speech').textContent(),/kümes/i);await page.locator('.hx-scene-speech').waitFor({state:'visible'});await fits(page,'.hx-scene-speech');await fits(page,'#home-play');
   const image=await page.locator('.hx-scene-background').getAttribute('src');const before=await profile(page);assert.equal(before.game.variantSelection.serial,0,'the opening itself does not allocate an Attempt ID');assert.equal(before.game.economy.gold,0);assert.equal(before.game.economy.stars,0);
   assert(!current.requests.some(p=>/scene-assets-preview\.html|\/art\//.test(p)),'the independent example board and source PNGs are never loaded');
   const initialSceneImages=[...new Set(current.requests.filter(p=>/\/assets\/scenes\/.*\.webp$/.test(p)))];assert(initialSceneImages.length<=4,'startup does not decode all poses/backgrounds');assert(!initialSceneImages.some(p=>/\/(frame|roof|finished)(?:-mobile)?\.webp$/.test(p)),'unearned construction images are not eagerly loaded');
   await screenshot(page,'opening-'+size.width+'x'+size.height);await enter(page);await enter(baseline.page);await sceneReady(page);await actorReady(page);assert.equal(await page.locator('.hx-scene-background').getAttribute('src'),image,'the real board appears over the same scene');assert.equal(await page.locator('#board [data-index]').count(),7,'this is the actual seven-cell T1 board');assert.equal(await page.locator('#board .tutorial-focus').count(),2);assert.equal(await page.locator('#skip-animation').isVisible(),false);
   stableRect(await baseline.page.locator('#board').boundingBox(),await page.locator('#board').boundingBox(),'scene preserves baseline board geometry');await page.waitForTimeout(80);await layout(page,{requireActor:size.width===390||size.width===430});await screenshot(page,'t1-'+size.width+'x'+size.height);
  }finally{await current.context.close();await baseline.context.close();}
 });
 await check('two real tutorials preserve engine state and award only the single actual welcome gift',async()=>{
  const f=await open({width:390,height:844});try{await enter(f.page);await sceneReady(f.page);const start=await gameSnapshot(f.page);assert.equal(start.turn,0);await lesson(f.page,0);const first=await profile(f.page);assert.equal(first.game.economy.gold,0);assert.equal(first.game.economy.stars,0);await f.page.locator('#next').tap();await lesson(f.page,1);await f.page.locator('#win-dialog[data-welcome="true"]').waitFor();const won=await profile(f.page);assert.equal(won.game.economy.gold,20);assert.equal(won.game.economy.stars,0);assert.equal(Object.values(won.game.economy.transactions).filter(r=>r.kind==='welcome').length,1);assert.equal(won.energy.life.lives,5);assert.equal(await f.page.locator('body').getAttribute('data-scene-stage'),'clearing');await screenshot(f.page,'welcome-after-real-tutorials');await f.page.waitForTimeout(1700);assert.deepEqual(await profile(f.page),won,'presentation completion cannot write any profile/Gold/star/life state');
  }finally{await f.context.close();}
 });
 await check('full-motion real swipe keeps the board size and never lets Tavik cover its stones',async()=>{
  const f=await open({width:390,height:844},{motion:'full'});try{await enter(f.page);await sceneReady(f.page);await actorReady(f.page);await f.page.waitForTimeout(450);const before=await f.page.locator('#board').boundingBox();const pair=await f.page.evaluate(()=>HEX_TUTORIALS[0].solution[0]);const a=await f.page.locator(`#board [data-index="${pair[0]}"] .floor-shape`).boundingBox(),b=await f.page.locator(`#board [data-index="${pair[1]}"] .floor-shape`).boundingBox();await f.page.mouse.move(a.x+a.width/2,a.y+a.height/2);await f.page.mouse.down();await f.page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:4});await f.page.mouse.up();await f.page.waitForFunction(()=>JSON.parse(localStorage.getItem('hexrota-profile-v2')).game.boards[0].turn===1);stableRect(before,await f.page.locator('#board').boundingBox(),'the animated board never shrinks');await layout(f.page);await screenshot(f.page,'real-swipe-during-effects');await f.page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='false');stableRect(before,await f.page.locator('#board').boundingBox(),'the result keeps the same board');const p=await profile(f.page);assert.equal(p.game.boards[0].score,6);assert.equal(p.game.boards[0].movesLeft,4);await layout(f.page);}
  finally{await f.context.close();}
 });
 await check('committed campaign stars select exactly clearing/frame/roof/finished without a second progression counter',async()=>{
  for(const [stars,stage]of [[0,'clearing'],[1,'clearing'],[2,'frame'],[4,'frame'],[5,'roof'],[9,'roof'],[10,'finished']]){
   const f=await open({width:390,height:844},{saved:legacyClears(stars)});try{await sceneReady(f.page,stage);const p=await profile(f.page);assert.equal(p.game.economy.stars,stars);assert.equal(await f.page.locator('body').getAttribute('data-first-opening'),'false','returning players are never forced into the intro');assert.equal(await f.page.locator('.hx-scene-speech').isVisible(),false);assert(!Object.keys(p.game).some(k=>/sceneProgress|coopProgress|rescued/i.test(k)),'there is no new authoritative scene/quest counter');await screenshot(f.page,'stars-'+stars+'-'+stage);const after=await profile(f.page);assert.deepEqual(after.game.economy,p.game.economy);assert.deepEqual(after.game.variantSelection,p.game.variantSelection);}
   finally{await f.context.close();}
  }
  const ambiguous=fresh(11);ambiguous.done=Array.from({length:12},(_,i)=>i);const f=await open({width:390,height:844},{saved:ambiguous});try{await sceneReady(f.page,'clearing');assert.equal((await profile(f.page)).game.economy.stars,0,'unverified completion flags cannot build a coop');}finally{await f.context.close();}
 });
 await check('failed final profile write never flashes unearned construction and a later real commit opens it',async()=>{
  const f=await open({width:390,height:844},{saved:beforeWin(2)});try{await sceneReady(f.page,'clearing');await enter(f.page);await sceneReady(f.page,'clearing');const before=await profile(f.page);assert.equal(before.game.economy.stars,1);await f.page.evaluate(()=>{window.__sceneStages=[];window.__sceneObserver=new MutationObserver(()=>window.__sceneStages.push(document.body.dataset.sceneStage));window.__sceneObserver.observe(document.body,{attributes:true,attributeFilter:['data-scene-stage']});window.__sceneSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='hexrota-profile-v2')throw new DOMException('injected scene commit quota','QuotaExceededError');return window.__sceneSet.call(this,k,v);};});const pair=await f.page.evaluate(()=>HEX_LEVELS[1].solution.at(-1));await touchPair(f.page,pair);assert.deepEqual(await profile(f.page),before,'the winning move, Gold and stars roll back together');assert.equal(await f.page.locator('body').getAttribute('data-scene-stage'),'clearing');assert.equal(await f.page.evaluate(()=>window.__sceneStages.includes('frame')),false,'speculative stars never select an unearned image');await f.page.evaluate(()=>{Storage.prototype.setItem=window.__sceneSet;delete window.__sceneSet;window.dispatchEvent(new Event('focus'));});await touchPair(f.page,pair);await f.page.locator('#win-dialog[open]').waitFor();assert.equal((await profile(f.page)).game.economy.stars,2);await f.page.locator('#win-home').tap();await sceneReady(f.page,'frame');await screenshot(f.page,'earned-frame-after-recovered-commit');await f.page.evaluate(()=>window.__sceneObserver.disconnect());}
  finally{await f.context.close();}
 });
 await check('a saved campaign resumes exactly at zero lives while the scene remains presentation-only',async()=>{
  const seed=existing(2,{turns:1}),f=await open({width:390,height:844},{saved:seed.saved,energy:lifePool(0)});try{await sceneReady(f.page,'clearing');const before=await profile(f.page);await enter(f.page);assert.deepEqual(await gameSnapshot(f.page),plain(seed.game.snapshot()));assert.equal((await profile(f.page)).energy.life.lives,0);assert.deepEqual((await profile(f.page)).game.attempts,before.game.attempts);const stable=await profile(f.page);await f.page.waitForTimeout(1600);assert.deepEqual(await profile(f.page),stable,'actor/background decoding cannot change a resumed attempt');await screenshot(f.page,'zero-life-resume');}finally{await f.context.close();}
 });
 await check('rotation, open modals and simulated backgrounding preserve the game and pause Tavik',async()=>{
  const f=await open({width:390,height:844},{motion:'full'});try{await enter(f.page);await sceneReady(f.page);await actorReady(f.page);await f.page.locator('#pause').tap();await f.page.locator('#pause-dialog[open]').waitFor();const before=await profile(f.page);assert.equal(await f.page.locator('.hx-tavik').getAttribute('data-paused'),'true');await f.page.setViewportSize({width:844,height:390});await f.page.waitForTimeout(100);await fits(f.page,'#pause-dialog');assert.deepEqual((await profile(f.page)).game,before.game);await screenshot(f.page,'landscape-pause');await f.page.locator('#pause-continue').tap();await f.page.waitForTimeout(80);await layout(f.page);await f.page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await f.page.locator('.hx-tavik').getAttribute('data-paused'),'true');assert.deepEqual((await profile(f.page)).game,before.game);await f.page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await f.page.locator('#pause-dialog').evaluate(n=>n.open),true,'returning from the background does not silently resume play');}
  finally{await f.context.close();}
 });
 await check('simulated persisted pagehide/pageshow destroys and restores only the scene presentation',async()=>{
  const f=await open({width:390,height:844});try{await enter(f.page);await sceneReady(f.page);await actorReady(f.page);await touchPair(f.page,[4,3]);const before=await profile(f.page);await f.page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));assert.equal(await f.page.locator('.hx-scene-world').count(),0);assert.equal(await f.page.locator('.hx-scene-actor-anchor').count(),0);await f.page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await sceneReady(f.page);await actorReady(f.page);assert.equal(await f.page.locator('.hx-scene-world').count(),1);assert.equal(await f.page.locator('.hx-scene-actor-anchor').count(),1);const after=await profile(f.page);assert.deepEqual(after.game.boards,before.game.boards);assert.deepEqual(after.game.attempts,before.game.attempts);assert.deepEqual(after.game.economy,before.game.economy);assert.deepEqual(after.energy,before.energy);await layout(f.page);await screenshot(f.page,'persisted-pageshow-restored-scene');}
  finally{await f.context.close();}
 });
 await check('late pose loads cannot repopulate a destroyed scene or advance a real saved board',async()=>{
  let release,pointRequested;const gate=new Promise(resolve=>release=resolve),requested=new Promise(resolve=>pointRequested=resolve),f=await open({width:390,height:844},{routes:async context=>{await context.route('**/assets/scenes/coop-v1/tavik/point.webp',async route=>{pointRequested();await gate;try{await route.continue();}catch{}});}});try{await enter(f.page);await Promise.race([requested,new Promise((_,reject)=>setTimeout(()=>reject(new Error('the point pose must actually be pending')),7000))]);const before=await profile(f.page);await homeFromGame(f.page);await f.page.locator('.app-navigation [data-nav="journey"]').tap();await f.page.waitForFunction(()=>document.body.dataset.screen==='journey');assert.equal(await f.page.locator('.hx-scene-world').count(),0);assert.equal(await f.page.locator('.hx-scene-actor-anchor').count(),0);release();await f.page.waitForTimeout(200);assert.equal(await f.page.locator('.hx-scene-world').count(),0);assert.equal(await f.page.locator('.hx-scene-actor-anchor').count(),0);assert.deepEqual((await profile(f.page)).game.economy,before.game.economy);assert.deepEqual((await profile(f.page)).game.boards,before.game.boards);}
  finally{release();await f.context.close();}
 });
 await check('unavailable scene images fall back safely and never block the real board or duplicate Tavik',async()=>{
  const f=await open({width:390,height:844},{routes:async context=>context.route('**/assets/scenes/coop-v1/**/*.webp',route=>route.fulfill({status:404,body:'missing'}))});try{await enter(f.page);await f.page.locator('.hx-scene-fallback').waitFor({state:'visible'});assert.equal(await f.page.locator('.hx-scene-fallback:visible').count(),1);assert.equal(await f.page.locator('.hx-scene-actor-anchor .hx-tavik').count(),0,'a failed SDK actor is replaced, never doubled');await fits(f.page,'#board');await touchPair(f.page,[4,3]);const p=await profile(f.page);assert.equal(p.game.boards[0].score,6);assert.equal(p.game.boards[0].turn,1);assert.equal(p.game.economy.gold,0);assert.equal(p.energy.life.lives,5);await screenshot(f.page,'failed-scene-images-still-playable');}
  finally{await f.context.close();}
 });
 await check('a missing guided pose retains the loaded idle cutout and the real tutorial stays playable',async()=>{
  const f=await open({width:390,height:844},{routes:async context=>context.route('**/assets/scenes/coop-v1/tavik/point.webp',route=>route.fulfill({status:404,body:'missing pose'}))});try{await enter(f.page);await actorReady(f.page);await f.page.waitForTimeout(120);assert.match(await f.page.locator('.hx-tavik__sprite').getAttribute('src'),/\/idle\.webp$/);assert.equal(await f.page.locator('.hx-tavik__sprite:visible').count(),1);assert.equal(await f.page.locator('.hx-scene-fallback').count(),0);await touchPair(f.page,[4,3]);assert.equal((await gameSnapshot(f.page)).score,6);assert.equal((await gameSnapshot(f.page)).turn,1);}
  finally{await f.context.close();}
 });
 await check('the game is immediately usable while the active scene background is still loading',async()=>{
  let release;const gate=new Promise(resolve=>release=resolve),f=await open({width:390,height:844},{routes:async context=>context.route('**/assets/scenes/coop-v1/backgrounds/clearing-mobile.webp',async route=>{await gate;try{await route.continue();}catch{}})});try{await enter(f.page);await touchPair(f.page,[4,3]);assert.equal((await gameSnapshot(f.page)).score,6);release();await sceneReady(f.page);assert.equal((await gameSnapshot(f.page)).score,6);}
  finally{release();await f.context.close();}
 });
 await check('real offline cached scene and board reload without uncached pose downloads becoming gameplay failures',async()=>{
  const f=await open({width:390,height:844},{serviceWorkers:'allow'});try{await sceneReady(f.page);await actorReady(f.page);await f.page.evaluate(async()=>{await navigator.serviceWorker.ready;await new Promise(resolve=>{if(navigator.serviceWorker.controller)return resolve();navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});});});await enter(f.page);await touchPair(f.page,[4,3]);const before=await gameSnapshot(f.page);await homeFromGame(f.page);networkOffline=true;await f.page.reload({waitUntil:'domcontentloaded'});await f.page.waitForFunction(()=>document.body.dataset.screen==='home');await enter(f.page);assert.deepEqual(await gameSnapshot(f.page),before);await sceneReady(f.page);await screenshot(f.page,'offline-cached-scene-resume');}
  finally{networkOffline=false;await f.context.close();}
 });
 await check('offline cached advanced scene and uncached advanced background fallback preserve canonical stars and board',async()=>{
  const f=await open({width:390,height:844},{saved:legacyClears(2),serviceWorkers:'allow'});try{
   await sceneReady(f.page,'frame');await f.page.evaluate(async()=>{await navigator.serviceWorker.ready;await new Promise(resolve=>{if(navigator.serviceWorker.controller)return resolve();navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});});await fetch('./assets/scenes/coop-v1/backgrounds/frame-mobile.webp',{cache:'reload'});});
   const before=await profile(f.page);networkOffline=true;await f.page.reload({waitUntil:'domcontentloaded'});await sceneReady(f.page,'frame');assert.deepEqual((await profile(f.page)).game,before.game,'offline frame painting does not alter canonical progress');await screenshot(f.page,'offline-earned-frame');
   const deleted=await f.page.evaluate(async()=>{let count=0;for(const name of await caches.keys()){const cache=await caches.open(name);for(const req of await cache.keys())if(/\/frame-mobile\.webp$/.test(req.url)){if(await cache.delete(req))count++;}}return count;});assert(deleted>0,'the test removes an actually cached advanced scene');
   await f.page.reload({waitUntil:'domcontentloaded'});await f.page.waitForFunction(()=>{const n=document.querySelector('.hx-scene-background');return document.body.dataset.sceneStage==='frame'&&n?.complete&&n.naturalWidth>0&&n.src.endsWith('/clearing-mobile.webp');});assert.equal(await f.page.locator('.hx-scene-world').getAttribute('data-fallback'),'true');assert.deepEqual((await profile(f.page)).game,before.game,'fallback art cannot downgrade earned stars or replace the real game');await enter(f.page);await fits(f.page,'#board');await screenshot(f.page,'offline-uncached-frame-falls-back-to-clearing');
  }finally{networkOffline=false;await f.context.close();}
 });
 assert.deepEqual(errors,[],'there are no unhandled browser exceptions');console.log('Scene integration passed: '+results.length+' actual '+browserName+' groups.');
})().catch(error=>{console.error(error);if(errors.length)console.error({browserErrors:errors});process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({browser:browserName,passed:results.length,results,measurements,errors,physicalDeviceTested:false,filteredRun:process.env.HEXROTA_SCENE_ONLY||null,hiddenStateTest:'visibilitychange event with overridden document.hidden',serverOfflineTest:true,bfcacheTest:'synthetic persisted PageTransitionEvent lifecycle; actual browser cache restoration is not asserted'},null,2)+'\n');networkOffline=false;if(browser)await browser.close();server.close();});
