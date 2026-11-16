/* Real first opening: one action, a state-free swap demonstration, earned progress.
 * Screenshots are accompanied by geometry, state and rendered-pixel assertions. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {chromium,webkit}=require('playwright'),{PNG}=require('pngjs');
const root=path.join(__dirname,'dist'),browserName=process.env.HEXROTA_BROWSER||'chromium';
assert(['chromium','webkit'].includes(browserName),'HEXROTA_BROWSER must be chromium or webkit');
const out=process.env.HEXROTA_FIRST_PLAY_SCREENSHOT_DIR||path.join(__dirname,'test-results','first-play-'+browserName);
fs.mkdirSync(out,{recursive:true});
const plain=value=>JSON.parse(JSON.stringify(value)),reference={window:{},performance};vm.createContext(reference);
for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),reference);
const {HexMatch:Engine,HEX_TUTORIALS:tutorials,HEX_LEVELS:levels,HEX_VARIANTS:variants,HexAttempts}=reference.window;
const catalog=HexAttempts.createCatalog(levels,variants,Engine);
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.webp':'image/webp','.png':'image/png'};
const server=http.createServer((req,res)=>{
 let file;try{const url=new URL(req.url,'http://local');file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));}catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);});
});
const errors=[],results=[];let browser,url;
async function check(name,run){await run();results.push(name);console.log('PASS '+name);}
async function checkpoint(page){return page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('hexrota-match-v5'));return {current:saved.current,board:saved.boards[saved.current],economy:saved.economy,guideAcks:saved.guideAcks};});}
async function fits(page,selector){
 const box=await page.locator(selector).boundingBox(),viewport=page.viewportSize();
 assert(box&&box.width>0&&box.height>0,selector+' is visible');
 assert(box.x>=-1&&box.y>=-1&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,selector+' fits without scrolling');
}
async function still(page,model,message){
 const saved=await checkpoint(page);assert.deepEqual(saved.board,plain(model.snapshot()),message+' exact board, moves, history and RNG');
 assert.equal(+(await page.locator('#moves-left').textContent()),model.movesLeft,message+' remaining moves');
 assert.equal((await page.locator('#coverage').textContent()).trim(),`${model.covered} / ${model.total}`,message+' green-ground progress');
 assert.equal(+(await page.locator('#sum').textContent()),model.score,message+' score');
 return saved;
}
async function hidden(page,selectors){for(const selector of selectors)assert.equal(await page.locator(selector).first().isVisible(),false,selector+' is deferred');}
function stableBoard(before,after){for(const key of ['x','y','width','height'])assert(Math.abs(before[key]-after[key])<=1,'the result explanation preserves board '+key);}
async function feedbackFits(page){
 const layout=await page.locator('#tutorial-coach').evaluate(coach=>{
  const rect=node=>node.getBoundingClientRect().toJSON(),copy=coach.querySelector('.coach-copy'),next=coach.querySelector('#coach-next');
  const text=[...coach.querySelectorAll('#coach-step,#coach-title,#coach-text')].flatMap(node=>{const range=document.createRange();range.selectNodeContents(node);return [...range.getClientRects()].map(value=>value.toJSON());});
  return {coach:rect(coach),copy:rect(copy),next:rect(next),text};
 });
 const a=layout.copy,b=layout.next;
 assert(a.right<=b.left+.5||b.right<=a.left+.5||a.bottom<=b.top+.5||b.bottom<=a.top+.5,'the feedback explanation and Continue action do not overlap');
 for(const line of layout.text){
  assert(line.left>=layout.coach.left-1&&line.right<=layout.coach.right+1&&line.top>=layout.coach.top-1&&line.bottom<=layout.coach.bottom+1,'every feedback text line fits within the coach');
  assert(line.right<=b.left+.5||b.right<=line.left+.5||line.bottom<=b.top+.5||b.bottom<=line.top+.5,'feedback text never paints over Continue');
 }
 await fits(page,'#coach-next');
}
async function screenshot(page,name,locator){
 const image=await (locator?page.locator(locator).screenshot({animations:'allow'}):page.screenshot({animations:'allow'}));
 fs.writeFileSync(path.join(out,name+'.png'),image);
 const png=PNG.sync.read(image),colors=new Set();
 for(let i=0;i<png.data.length;i+=4*29)colors.add(png.data[i]+','+png.data[i+1]+','+png.data[i+2]);
 assert(colors.size>20,name+' captures rendered content');return png;
}
function changedPixels(a,b){assert.equal(a.width,b.width);assert.equal(a.height,b.height);let count=0;for(let i=0;i<a.data.length;i+=4)if(Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2])>30)count++;return count;}
async function open(size,{motion='reduce',saved}={}){
 const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:motion==='reduce'?'reduce':'no-preference',serviceWorkers:'block'});
 if(saved)await context.addInitScript(saved=>localStorage.setItem('hexrota-match-v5',JSON.stringify(saved)),saved);
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url);await page.waitForFunction(()=>document.body.dataset.screen==='home'&&!!document.querySelector('#home-play-label')?.textContent.trim());
 return {context,page};
}
async function start(page){
 await page.locator('#home-play').tap();await page.waitForFunction(()=>document.body.dataset.screen==='game');
 assert.equal(await page.locator('#pregame-dialog').evaluate(node=>node.open),false,'fresh first action bypasses the preview');
 await fits(page,'#board');await fits(page,'#coverage');await fits(page,'#moves-left');await fits(page,'#tutorial-coach');
 assert.equal((await page.locator('#ground-label').textContent()).trim(),'Yeşert');
 assert.equal(await page.locator('#board .tutorial-focus').count(),2,'one exact neighboring pair is in the spotlight');
 const pair=plain(tutorials[0].solution[0]);
 assert.deepEqual(await page.locator('#board .tutorial-focus').evaluateAll(nodes=>nodes.map(node=>+node.dataset.index).sort((a,b)=>a-b)),pair.sort((a,b)=>a-b));
 await still(page,new Engine(tutorials[0]),'opening T1');
}
async function tapPair(page,pair){
 // Dispatch actual touches even when the app has marked a tile aria-disabled;
 // a disabled result checkpoint must ignore touches instead of relying on the
 // test driver's actionability checks to prevent them.
 for(const index of pair){const box=await page.locator(`#board [data-index="${index}"]`).boundingBox();assert(box,'tile has geometry');await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}
 await page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='false');
}
async function acknowledge(page){if(await page.locator('#coach-next').isVisible()){const before=await checkpoint(page);await page.locator('#coach-next').tap();assert.deepEqual(await checkpoint(page).then(value=>value.board),before.board,'acknowledgement cannot mutate the engine');}}
async function playLesson(page,index){
 const level=tutorials[index],model=new Engine(level);
 for(const [turn,pair]of level.solution.entries()){
  await acknowledge(page);const beforeBoard=await page.locator('#board').boundingBox();assert(model.swap(...pair).ok);await tapPair(page,plain(pair));
  const saved=await still(page,model,`T${index+1} turn ${turn+1}`);
  assert.equal(saved.economy.gold,0,'tutorial cannot award Gold');assert.equal(saved.economy.stars,0,'tutorial cannot award a campaign star');
  if(index===0&&turn===0){
   assert.equal(await page.locator('#coach-next').isVisible(),true,'the first result waits for the player');
   assert.match(await page.locator('#coach-text').textContent(),/6.*puan|puan.*6/i);
   assert.match(await page.locator('#coach-text').textContent(),/yeşil|yeşer/i);
   stableBoard(beforeBoard,await page.locator('#board').boundingBox());
   await feedbackFits(page);await screenshot(page,'t1-first-earned-progress');
   const before=await checkpoint(page);await tapPair(page,plain(level.solution[1]));assert.deepEqual(await checkpoint(page),before,'the next gesture cannot skip the result explanation');
  }
 }
 await page.locator('#win-dialog[open]').waitFor();
 await fits(page,'#win-title');await fits(page,'#next');
 await hidden(page,['#win-rewards','#review','#win-map','#win-home']);
 await screenshot(page,'t'+(index+1)+'-earned-completion');
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port+'/';
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...(executable?{executablePath:executable}:{}),...(browserName==='chromium'?{args:['--no-sandbox']}:{})});
 let journey;
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1280,height:900}]){
  const current=await open(size),{page}=current;
  try{
   await check(`${size.width}×${size.height} one fresh action and a visible first objective`,async()=>{
    assert.equal((await page.locator('#home-play-label').textContent()).trim(),'Başlayalım');
    await hidden(page,['#home-lives','#home-screen .campaign-wallet','#home-teach','#home-garden','.home-shortcuts','.home-progress','.app-navigation']);
    await fits(page,'#home-play');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'opening has no horizontal overflow');
    await screenshot(page,'opening-'+size.width+'x'+size.height);await start(page);
    assert.equal(await page.locator('.tutorial-demo-layer').count(),0,'reduced motion uses the static exact pair');
    await screenshot(page,'t1-objective-'+size.width+'x'+size.height);
    if(size.width!==390){
     const beforeBoard=await page.locator('#board').boundingBox(),model=new Engine(tutorials[0]);assert(model.swap(...tutorials[0].solution[0]).ok);
     await tapPair(page,plain(tutorials[0].solution[0]));await still(page,model,'first visible result');
     await feedbackFits(page);await fits(page,'#board');stableBoard(beforeBoard,await page.locator('#board').boundingBox());
     await screenshot(page,'t1-feedback-'+size.width+'x'+size.height);
    }
   });
   if(size.width===390)journey=current;
  }finally{if(journey!==current)await current.context.close();}
 }
 try{
  const {page}=journey;
  await check('wrong pair is harmless; the first lesson earns its result',async()=>{
   const before=await checkpoint(page);await tapPair(page,[0,1]);assert.deepEqual(await checkpoint(page),before,'unrelated pair consumes no move, score or RNG');
   await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('show'));
   await playLesson(page,0);
  });
  await check('the next concept follows T1 and both tutorials remain rewardless',async()=>{
   await page.locator('#next').tap();await page.waitForFunction(()=>document.body.dataset.learning==='goals');
   for(const index of [0,4])assert.equal(await page.locator(`#board [data-index="${index}"] .layer-pips circle`).count(),2,'T2 identifies each double-layer cell with two pips');
   await screenshot(page,'t2-next-concept');await playLesson(page,1);
  });
  await check('independent campaign play grants one real first-clear reward',async()=>{
   await page.locator('#next').tap();await page.locator('#pregame-dialog[open]').waitFor();await page.locator('#pregame-start').tap();
   await page.waitForFunction(()=>document.body.dataset.screen==='game'&&document.body.dataset.learning==='');
   const data=await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('hexrota-match-v5'));return {index:saved.current,metadata:saved.attempts[saved.current]};});
   const base=levels[data.index-2],level=catalog.resolveLevel(base.id,data.metadata.variantId,data.metadata.levelDataVersion),model=new Engine(level);
   assert.equal(await page.locator('#tutorial-coach').isVisible(),false);assert.equal(await page.locator('.tutorial-focus,.tutorial-demo-layer').count(),0,'campaign has no prescribed pair or demonstration');
   for(const pair of level.solution){assert(model.swap(...pair).ok);await tapPair(page,plain(pair));await still(page,model,'campaign move');}
   await page.locator('#win-dialog[open]').waitFor();assert.equal(await page.locator('#win-rewards').isVisible(),true,'real earned rewards are celebrated');
   const win=await checkpoint(page);assert.equal(win.economy.gold,20);assert.equal(win.economy.stars,1);
   await screenshot(page,'campaign-first-earned-reward');await page.locator('#review').tap();await page.locator('#continue').tap();await page.locator('#win-dialog[open]').waitFor();
   assert.deepEqual((await checkpoint(page)).economy,win.economy,'reviewing a result cannot mint another reward');
  });
 }finally{await journey.context.close();}
 const full=await open({width:390,height:844},{motion:'full'});
 try{await check('slow reciprocal demo moves rendered stones without playing a move',async()=>{
  const {page}=full;await start(page);await page.locator('.tutorial-demo-layer').waitFor();
  const before=await checkpoint(page);
  assert.equal(await page.locator('.tutorial-demo-stone').count(),2);assert.equal(await page.locator('.tutorial-demo-source').count(),2);
  assert.equal(await page.locator('.tutorial-demo-layer').getAttribute('aria-hidden'),'true');
  assert.equal(await page.locator('.tutorial-demo-layer').evaluate(node=>getComputedStyle(node).pointerEvents),'none');
  assert.equal(await page.locator('.tutorial-demo-layer [data-index],.tutorial-demo-layer [tabindex],.tutorial-demo-layer [role]').count(),0,'decorative ghosts introduce no input or accessibility targets');
  const timings=await page.locator('.tutorial-demo-layer').evaluate(node=>node.getAnimations({subtree:true}).map(animation=>animation.effect.getTiming()));
  assert.equal(timings.length,2);assert(timings.every(timing=>timing.duration>=3000&&timing.iterations===Infinity),'both stones exchange places at a slow repeated pace');
  await page.locator('.tutorial-demo-layer').evaluate(node=>node.getAnimations({subtree:true}).forEach(animation=>{animation.pause();animation.currentTime=0;}));
  const first=await screenshot(page,'demo-before','#board');
  await page.locator('.tutorial-demo-layer').evaluate(node=>node.getAnimations({subtree:true}).forEach(animation=>{animation.currentTime=1700;}));
  const second=await screenshot(page,'demo-demonstrated-swap','#board');
  assert(changedPixels(first,second)>100,'actual screenshot pixels show the two stones changing position');
  assert.deepEqual(await checkpoint(page),before,'watching the demonstration changes no board, score, moves, rewards or RNG');
  const model=new Engine(tutorials[0]);assert(model.swap(...tutorials[0].solution[0]).ok);await tapPair(page,plain(tutorials[0].solution[0]));
  await still(page,model,'real touch through the demonstrated pair');
  assert.equal(await page.locator('.tutorial-demo-layer,.tutorial-demo-source').count(),0,'a real move removes preview ghosts and restores the original stones');
  await page.locator('#pause').tap();await page.locator('#pause-home').tap();assert.equal(await page.locator('.tutorial-demo-layer,.tutorial-demo-source').count(),0,'leaving removes demo ghosts and restores original stones');
 });}finally{await full.context.close();}
 assert.deepEqual(errors,[],'no real-browser application errors');
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({browser:browserName,groups:results.length,results,physicalDeviceTested:false},null,2));
})().catch(error=>{console.error(error);if(errors.length)console.error({pageErrors:errors});process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
