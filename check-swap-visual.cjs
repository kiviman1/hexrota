/* Screenshot pixels, not DOM visibility, verify moving gem fills AND number ink. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),vm=require('node:vm');
const {chromium,webkit}=require('playwright'),{PNG}=require('pngjs');
const dist=path.join(__dirname,'dist'),browserName=process.env.HEXROTA_BROWSER||'chromium';
assert(['chromium','webkit'].includes(browserName),'an explicit supported browser is required');
const output=process.env.HEXROTA_SWAP_SCREENSHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-swap-'+browserName+'-'));fs.mkdirSync(output,{recursive:true});
const plain=value=>JSON.parse(JSON.stringify(value)),reference={window:{},performance};vm.createContext(reference);
for(const file of ['engine.js','levels.js'])vm.runInContext(fs.readFileSync(path.join(dist,file),'utf8'),reference,{filename:file});
const {HexMatch:Engine,HEX_LEVELS:levels}=reference.window,level=levels[0],stage=2;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((request,response)=>{
 let file;try{const name=decodeURIComponent(new URL(request.url,'http://local').pathname);file=path.resolve(dist,'.'+(name==='/'?'/index.html':name));}catch(_){response.writeHead(400).end();return;}
 if(!file.startsWith(dist+path.sep)){response.writeHead(403).end();return;}
 if(path.basename(file)==='app.js'&&process.env.HEXROTA_SWAP_APP_SOURCE)file=process.env.HEXROTA_SWAP_APP_SOURCE;
 fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});response.end(data);});
});
const results=[],errors=[];let browser,fixture;
function color(text){const values=text.match(/[\d.]+/g);assert(values&&values.length>=3,'expected solid RGB color');return values.slice(0,3).map(Number);}
function pixels(image,box,expected){
 let count=0;
 for(let y=Math.max(0,Math.floor(box.y)-1);y<Math.min(image.height,Math.ceil(box.y+box.height)+1);y++)for(let x=Math.max(0,Math.floor(box.x)-1);x<Math.min(image.width,Math.ceil(box.x+box.width)+1);x++){
  const offset=(y*image.width+x)*4;if(expected.every((value,k)=>Math.abs(image.data[offset+k]-value)<=12)&&image.data[offset+3]>240)count++;
 }
 return count;
}
async function draw(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function open({motion='full',width=390,height=844,turns=0}={}){
 const model=new Engine(level);for(const pair of level.solution.slice(0,turns))assert(model.swap(...pair).ok);
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:motion==='reduce'?'reduce':'no-preference',serviceWorkers:'block'});
 await context.addInitScript(({save,freeze})=>{
  if(location.protocol!=='http:')return;
  localStorage.setItem('hexrota-match-v5',JSON.stringify(save));
  const nativeAnimate=Element.prototype.animate,nativeTimer=window.setTimeout,nativeClear=window.clearTimeout;
  window.__qaSwapAnimations=[];window.__qaSwapTimers=[];window.__qaMatchAnimations=[];window.__qaMatchTimers=[];window.__qaFreezeSwap=freeze;
  Element.prototype.animate=function(frames,options){
   if(window.__qaThrowSwap&&this.closest('.swap-layer'))throw Error('test-only animation service failure');
   const animation=nativeAnimate.call(this,frames,options);
   if(window.__qaFreezeSwap&&options?.duration===300&&this.classList.contains('gem')){animation.pause();animation.currentTime=0;window.__qaSwapAnimations.push(animation);}
   if(window.__qaFreezeMatch&&this.classList.contains('score-digit')){animation.pause();animation.currentTime=0;}
   if(window.__qaFreezeMatch&&options?.duration===220&&this.classList.contains('gem')&&!this.closest('.swap-layer')){animation.pause();animation.currentTime=20;window.__qaMatchAnimations.push(animation);}
   return animation;
  };
  window.setTimeout=function(callback,delay,...args){
   if(window.__qaFreezeMatch&&(delay===430||delay===240)){const id=nativeTimer(()=>{},2147483647);window.__qaMatchTimers.push({id,callback:()=>callback(...args)});return id;}
   if(window.__qaFreezeSwap&&(delay===305||delay===3300)){
    const id=nativeTimer(()=>{},2147483647);window.__qaSwapTimers.push({id,delay,callback:()=>callback(...args)});return id;
   }
   return nativeTimer(callback,delay,...args);
  };
  window.__qaReleaseSwap=()=>{window.__qaFreezeSwap=false;const timers=window.__qaSwapTimers.splice(0);for(const timer of timers)if(timer.delay===305){nativeClear(timer.id);timer.callback();}};
  window.__qaReleaseMatch=()=>{window.__qaFreezeMatch=false;for(const timer of window.__qaMatchTimers.splice(0)){nativeClear(timer.id);timer.callback();}};
 },{save:{current:stage,done:[0,1],boards:{[stage]:plain(model.snapshot())},sound:false,preferences:{motion,music:false,haptics:false}},freeze:motion!=='reduce'});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(fixtureUrl);await page.locator('#home-play').click();if(await page.locator('#pregame-dialog').evaluate(node=>node.open))await page.locator('#pregame-start').click();await page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='false');await page.waitForTimeout(350);await draw(page);
 const read=()=>page.evaluate(stage=>JSON.parse(localStorage.getItem('hexrota-profile-v2')).game.boards[stage],stage);
 fixture={context,page,model,read};return fixture;
}
async function close(){if(fixture){await fixture.context.close();fixture=null;}}
async function capture(page,name){const file=path.join(output,name+'.png');return PNG.sync.read(await page.screenshot({path:file,animations:'allow'}));}
async function stones(page,indices,{moving=false}={}){
 return page.evaluate(({indices,moving})=>indices.map(index=>{
  const board=document.querySelector('#board'),original=board.querySelector(`.hex-tile[data-index="${index}"]`);
  const node=moving?(board.querySelector(`.swap-stone[data-swap-source="${index}"] .gem`)||original.querySelector('.gem')):original.querySelector('.gem');
  const gem=node.querySelector('.gem-shape'),number=node.querySelector('.hex-number'),rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  return {index,value:number.textContent,fill:getComputedStyle(gem).fill,ink:getComputedStyle(number).fill,box:rect(gem),numberBox:rect(number)};
 }),{indices,moving});
}
async function begin(f,pair){
 await f.page.evaluate(pair=>{for(const index of pair)document.querySelector(`.hex-tile[data-index="${index}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}));},pair);
}
async function idle(f){await f.page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='false');await draw(f.page);}
async function assertFinal(f,name){
 await idle(f);assert.deepEqual(await f.read(),plain(f.model.snapshot()),'render interruption preserves exact committed engine result');
 assert.equal(await f.page.locator('.swap-stone').count(),0,'no temporary swap stone survives');assert.equal(await f.page.locator('.swap-layer > *').count(),0,'transient layer is empty');
 const staticStones=await stones(f.page,Array.from({length:f.model.total},(_,i)=>i)),image=await capture(f.page,name);
 const paint=staticStones.map(stone=>({index:stone.index,value:stone.value,fillPixels:pixels(image,stone.box,color(stone.fill)),inkPixels:pixels(image,stone.numberBox,color(stone.ink)),box:stone.box,numberBox:stone.numberBox}));fs.writeFileSync(path.join(output,name+'-pixels.json'),JSON.stringify(paint,null,2));
 for(const stone of paint){assert.equal(stone.value,String(f.model.values[stone.index]));assert(stone.fillPixels>300,`final stone${stone.index} fill is painted (${stone.fillPixels})`);assert(stone.inkPixels>20,`final stone${stone.index} number is painted (${stone.inkPixels})`);}
 return {paintedStones:staticStones.length};
}
async function check(name,run){try{const evidence=await run();results.push({name,passed:true,...evidence});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.message});console.error('FAIL '+name+': '+error.message);}finally{await close();}}
async function verifyPaintedSwap(f,pair,prefix,{resumeBeforeFinal=false}={}){
 const original=await stones(f.page,pair),before=await capture(f.page,prefix+'-before');
   const referencePixels=original.map(stone=>({fill:pixels(before,stone.box,color(stone.fill)),ink:pixels(before,stone.numberBox,color(stone.ink))}));
   for(const counts of referencePixels){assert(counts.fill>200,'reference gem has measurable fill pixels');assert(counts.ink>20,'reference number has measurable ink pixels');}
   await begin(f,pair);assert.equal(f.model.swap(...pair).ok,true,'test route is a real legal swap');await f.page.waitForFunction(()=>window.__qaSwapAnimations.length===2);
   const phases=[];
   for(const [phase,time]of [['start',0],['mid',150],['end',300]]){
    await f.page.evaluate(time=>{for(const animation of window.__qaSwapAnimations)animation.currentTime=time;},time);await draw(f.page);
    const moving=await stones(f.page,pair,{moving:true}),image=await capture(f.page,prefix+'-'+phase);
    const paint=moving.map((stone,i)=>({index:stone.index,value:stone.value,fillPixels:pixels(image,stone.box,color(original[i].fill)),inkPixels:pixels(image,stone.numberBox,color(original[i].ink)),referenceFill:referencePixels[i].fill,referenceInk:referencePixels[i].ink}));
    phases.push({phase,time,paint});
    for(const [i,stone]of paint.entries()){
     assert.equal(stone.value,original[i].value,'transient source identity preserves its number');
     assert(stone.fillPixels>=referencePixels[i].fill*.72,`${phase}: stone${stone.index} color must actually paint (${stone.fillPixels}/${referencePixels[i].fill} pixels)`);
     assert(stone.inkPixels>=referencePixels[i].ink*.65,`${phase}: stone${stone.index} number must actually paint (${stone.inkPixels}/${referencePixels[i].ink} pixels)`);
    }
   }
   assert.equal(await f.page.locator('.swap-layer .swap-stone').count(),2,'two reciprocal visuals belong to the top layer');
   assert(await f.page.locator('.swap-layer').evaluate(layer=>layer.parentElement.lastElementChild===layer),'swap layer paints after all cell floors/effects');
   await f.page.evaluate(()=>window.__qaReleaseSwap());let feedbackBeforeResume;
   if(resumeBeforeFinal){
    await idle(f);assert.deepEqual(await f.read(),plain(f.model.snapshot()));assert.equal(await f.page.locator('.swap-stone').count(),0);assert(await f.page.locator('.hex-tile > .gem').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).visibility==='visible')),'all original gems are restored before leaving');
    const staticNodes=await stones(f.page,Array.from({length:f.model.total},(_,i)=>i)),image=await capture(f.page,prefix+'-before-resume');feedbackBeforeResume=staticNodes.map(stone=>({index:stone.index,value:stone.value,inkPixels:pixels(image,stone.numberBox,color(stone.ink))}));
    // The existing small-viewport combo HUD can overlap the top static glyph.
    // Actual menu/resume clears that feedback; do not mask it or weaken pixel gates.
    await f.page.click('#game-home');await f.page.click('#home-play');if(await f.page.locator('#pregame-dialog').evaluate(node=>node.open))await f.page.click('#pregame-start');await f.page.waitForTimeout(350);await draw(f.page);
   }
   const final=await assertFinal(f,prefix+'-settled');return {phases,...final,...(resumeBeforeFinal?{feedbackBeforeResume,finalVerifiedAfterActualMenuResume:true}:{})};
}
let fixtureUrl;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));fixtureUrl=`http://127.0.0.1:${server.address().port}/`;
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...(executable?{executablePath:executable}:{}),args:browserName==='chromium'?['--no-sandbox']:[]});
 try{
  // Three axial orientations, each with the original direction and reversed touch order.
  for(const pair of [[3,6],[6,3],[0,4],[4,0],[6,4],[4,6]])await check(`both gem colors and number ink stay visible for${pair[0]}→${pair[1]} at start/mid/end`,async()=>verifyPaintedSwap(await open(),pair,'pair-'+pair.join('-')));
  await check('an authored progressed board keeps both gems painted over an already green destination',async()=>{const f=await open({turns:1}),pair=[1,6];assert.equal(f.model.layers[pair[1]],0,'the destination is genuinely green after a replayed authored move');return verifyPaintedSwap(f,pair,'green-destination');});
  await check('small-screen top-edge swap keeps both complete painted numbers inside the board',async()=>verifyPaintedSwap(await open({width:320,height:568}),[0,2],'small-top-edge',{resumeBeforeFinal:true}));
  await check('match removal remains a separate painted stage after both swap visuals are removed',async()=>{
   const f=await open(),pair=[3,6];await f.page.evaluate(()=>window.__qaFreezeMatch=true);await begin(f,pair);const result=f.model.swap(...pair);await f.page.waitForFunction(()=>window.__qaSwapAnimations.length===2);await f.page.evaluate(()=>window.__qaReleaseSwap());await f.page.waitForFunction(()=>window.__qaMatchAnimations.length>0);await draw(f.page);
   assert.equal(await f.page.locator('.swap-stone').count(),0,'the swap owner is gone before any match removal');
   const matched=await stones(f.page,plain(result.frames[0].matched)),image=await capture(f.page,'match-painted-stage');
   for(const stone of matched){assert.equal(stone.value,String(result.frames[0].before[stone.index]));assert(pixels(image,stone.box,color(stone.fill))>300,`matching stone${stone.index} color still paints before removal`);}
   const flying=await f.page.evaluate(()=>[...document.querySelectorAll('.score-digit')].map(node=>{const r=node.getBoundingClientRect();return {index:Number(node.dataset.index),value:node.textContent,ink:getComputedStyle(node).color,box:{x:r.x,y:r.y,width:r.width,height:r.height}};}));
   assert(flying.length>=matched.length,'match numbers have moved into their separate score-flight owner');for(const digit of flying){assert.equal(digit.value,String(result.frames[0].before[digit.index]));assert(pixels(image,digit.box,color(digit.ink))>20,`floating match digit${digit.index} really paints`);}
   assert(await f.page.locator('.fx-layer .fx-ring').count()>0,'match effects keep their own ring owner');
   await f.page.evaluate(()=>window.__qaReleaseMatch());return {...await assertFinal(f,'match-stage-final'),matchedGemCount:matched.length,floatingDigits:flying.length};
  });
  await check('skip cleans both temporary gems and paints the exact authoritative board',async()=>{const f=await open(),pair=[3,6];await begin(f,pair);f.model.swap(...pair);await f.page.waitForFunction(()=>window.__qaSwapAnimations.length===2);await f.page.click('#skip-animation');return assertFinal(f,'skip-final');});
  await check('busy repeated input completes one move; the next independent swap stays exact',async()=>{
   const f=await open(),first=[3,6];await begin(f,first);f.model.swap(...first);await f.page.waitForFunction(()=>window.__qaSwapAnimations.length===2);await f.page.evaluate(()=>document.querySelector('[data-index="3"]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0})));await assertFinal(f,'rapid-first-final');
   await f.page.evaluate(()=>{window.__qaFreezeSwap=true;window.__qaSwapAnimations=[];});const next=plain(level.solution[1]);await begin(f,next);assert(f.model.swap(...next).ok);await f.page.waitForFunction(()=>window.__qaSwapAnimations.length===2);await f.page.click('#skip-animation');return assertFinal(f,'rapid-second-final');
  });
  await check('backgrounding a moving swap clears overlays and resumes the saved visual state',async()=>{const f=await open(),pair=[3,6];await begin(f,pair);f.model.swap(...pair);await f.page.waitForFunction(()=>window.__qaSwapAnimations.length===2);await f.page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await f.page.locator('.swap-stone').count(),0);await f.page.click('#pause-continue');await f.page.waitForTimeout(350);return assertFinal(f,'background-final');});
  await check('leaving the game during a swap cannot leave stale moving images after resume',async()=>{const f=await open(),pair=[3,6];await begin(f,pair);f.model.swap(...pair);await f.page.waitForFunction(()=>window.__qaSwapAnimations.length===2);await f.page.click('#game-home');assert.equal(await f.page.locator('.swap-stone').count(),0);await f.page.click('#home-play');if(await f.page.locator('#pregame-dialog').evaluate(node=>node.open))await f.page.click('#pregame-start');await f.page.waitForTimeout(350);return assertFinal(f,'navigate-final');});
  await check('invalid match returns both original painted gems without spending a move',async()=>{const f=await open();await f.page.evaluate(()=>window.__qaFreezeSwap=false);const pair=[0,1];assert.equal(f.model.clone().swap(...pair).ok,false);await begin(f,pair);await f.page.waitForTimeout(350);return assertFinal(f,'invalid-final');});
  await check('reduced motion never creates transient gems and paints the same final result',async()=>{const f=await open({motion:'reduce'}),pair=[3,6];await begin(f,pair);f.model.swap(...pair);assert.equal(await f.page.locator('.swap-stone').count(),0);return assertFinal(f,'reduced-final');});
  await check('a failing animation API cannot strand either moving image or an input lock',async()=>{const f=await open(),pair=[3,6];await f.page.evaluate(()=>window.__qaThrowSwap=true);await begin(f,pair);f.model.swap(...pair);return assertFinal(f,'animation-error-final');});
  assert.deepEqual(errors,[],'no browser exceptions');
 }finally{await close();if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
 const report={browser:browserName,viewport:{width:390,height:844},deviceScaleFactor:1,pixelTolerance:12,minimumFillRatio:.72,minimumNumberInkRatio:.65,results,errors,physicalIPhoneTested:false};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 const failed=results.filter(row=>!row.passed);console.log(JSON.stringify({browser:browserName,checks:results.length,failed:failed.length,screenshotDirectory:output,physicalIPhoneTested:false}));assert.equal(failed.length,0,'all actual screenshot pixel and cleanup regressions must pass');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;server.close();});
