/* Rendered reward evidence: actual SVG occlusion, a front-facing gold coin and
 * rotating rays. Uses the real T2 winning move; never mutates stored progress. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright'),{PNG}=require('pngjs');
const {tutorialBeforeWin}=require('./check-welcome-reset-ui.cjs'),{lifePool,NOW}=require('./check-lives-ui.cjs');
const name=process.env.HEXROTA_BROWSER||'chromium',root=process.env.HEXROTA_WELCOME_VISUAL_ROOT||path.join(__dirname,'dist');
assert(['chromium','webkit'].includes(name),'supported browser');
const out=process.env.HEXROTA_WELCOME_VISUAL_SCREENSHOT_DIR||path.join(__dirname,'test-results','welcome-visual-'+name);fs.mkdirSync(out,{recursive:true});
const PROFILE='hexrota-profile-v2',mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'};
const server=http.createServer((req,res)=>{let file;try{const url=new URL(req.url,'http://local');file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));}catch{res.writeHead(400).end();return;}if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);});});
const results=[],errors=[],metrics=[];let browser,url;
async function check(label,fn){await fn();results.push(label);console.log('PASS '+label);}
async function settled(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function save(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROFILE);}
async function capture(page,file,selector='#welcome-chest'){const image=await page.locator(selector).screenshot({animations:'allow'});fs.writeFileSync(path.join(out,file+'.png'),image);return PNG.sync.read(image);}
function changed(a,b){assert.equal(a.width,b.width);assert.equal(a.height,b.height);let count=0;for(let p=0;p<a.data.length;p+=4)if(Math.abs(a.data[p]-b.data[p])+Math.abs(a.data[p+1]-b.data[p+1])+Math.abs(a.data[p+2]-b.data[p+2])>35)count++;return count;}
function count(png,predicate){let n=0;for(let p=0;p<png.data.length;p+=4)if(predicate(png.data[p],png.data[p+1],png.data[p+2]))n++;return n;}
const cyan=png=>count(png,(r,g,b)=>r<35&&g>200&&b>200);
function cyanCenter(png){let pixels=0,sumY=0;for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){const p=(y*png.width+x)*4;if(png.data[p]<35&&png.data[p+1]>200&&png.data[p+2]>200){pixels++;sumY+=y;}}return{pixels,y:pixels?sumY/pixels:null};}
async function paintCoinMask(page){await page.locator('.welcome-treasure').evaluate(node=>{window.__coinPaintRestore=[node,...node.querySelectorAll('*')].map(item=>({item,style:item.getAttribute('style')}));for(const{item}of window.__coinPaintRestore){item.style.setProperty('fill','#00ffff');item.style.setProperty('stroke','#00ffff');}});}
async function restoreCoinPaint(page){await page.evaluate(()=>{for(const row of [...(window.__coinPaintRestore||[]),...(window.__coinShellRestore||[])])if(row.style===null)row.item.removeAttribute('style');else row.item.setAttribute('style',row.style);delete window.__coinPaintRestore;delete window.__coinShellRestore;});await settled(page);}
async function geometry(page){return page.locator('#win-dialog,#welcome-chest,#next').evaluateAll(nodes=>nodes.map(node=>({id:node.id,...node.getBoundingClientRect().toJSON()})));}
async function fits(page){const sizes=await geometry(page),v=page.viewportSize();for(const box of sizes){assert(box.width>0&&box.height>0,box.id+' rendered');assert(box.x>=-1&&box.y>=-1&&box.right<=v.width+1&&box.bottom<=v.height+1,box.id+' stays in viewport');}}
async function seek(page,time){await page.locator('#win-dialog').evaluate((node,time)=>node.getAnimations({subtree:true}).forEach(animation=>{animation.pause();animation.currentTime=time;}),time);await settled(page);}
async function open(size,motion){
 const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:motion==='reduce'?'reduce':'no-preference',serviceWorkers:'block'});
 await context.addInitScript(({saved,energy,now,motion})=>{Date.now=()=>now;if(location.protocol!=='http:')return;saved.preferences={...saved.preferences,motion};localStorage.setItem('hexrota-match-v5',JSON.stringify(saved));localStorage.setItem('hexrota-lives-v1',JSON.stringify(energy));},{saved:tutorialBeforeWin(),energy:lifePool(5),now:NOW,motion});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(url);await page.waitForFunction(()=>document.body.dataset.screen==='home');await page.locator('#home-play').tap();if(await page.locator('#pregame-dialog').evaluate(node=>node.open))await page.locator('#pregame-start').tap();
 for(const index of await page.evaluate(()=>window.HEX_TUTORIALS[1].solution.at(-1))){const box=await page.locator(`#board [data-index="${index}"]`).boundingBox();assert(box);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}
 await page.locator('#win-dialog[open][data-welcome="true"]').waitFor();await settled(page);assert.equal((await save(page)).game.economy.gold,20);await fits(page);return{context,page};
}
// Change only paint colors for an occlusion mask. The control removes shell
// paint without moving the coin, camera, or geometry, exposing all its pixels.
async function visibleCoin(page,label){
 const normal=await capture(page,label+'-original');
 const position=await page.locator('.welcome-treasure').evaluate(node=>{const rect=node.getBoundingClientRect(),svg=node.ownerSVGElement.getBoundingClientRect();return{x:rect.x-svg.x,y:rect.y-svg.y,width:rect.width,height:rect.height};});
 let goldPixels=0;for(let y=Math.max(0,Math.floor(position.y));y<Math.min(normal.height,Math.ceil(position.y+position.height));y++)for(let x=Math.max(0,Math.floor(position.x));x<Math.min(normal.width,Math.ceil(position.x+position.width));x++){const p=(y*normal.width+x)*4,r=normal.data[p],g=normal.data[p+1],b=normal.data[p+2];if(r>170&&g>110&&b<190&&r-b>60&&g-b>10)goldPixels++;}
 assert(goldPixels>300,label+' original rendered coin has a large gold-colored face');
 try{
  await paintCoinMask(page);
  const visibleImage=await capture(page,label+'-visible-mask'),center=cyanCenter(visibleImage),visible=center.pixels;
  await page.locator('#welcome-chest').evaluate(node=>{window.__coinShellRestore=[...node.children].filter(item=>!item.classList.contains('welcome-treasure')).map(item=>({item,style:item.getAttribute('style')}));for(const{item}of window.__coinShellRestore)item.style.visibility='hidden';});
  const control=cyan(await capture(page,label+'-unobscured-control')),ratio=visible/control;
  metrics.push({label,visiblePixels:visible,controlPixels:control,ratio,goldPixels,centerY:center.y});
  assert(control>400,label+' control coin covers a meaningful rendered area');assert(ratio>.9,label+' at least90% of the coin is actually painted above the shell');return center;
 }finally{
  await restoreCoinPaint(page);
 }
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port+'/';
 const executable=name==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await(name==='webkit'?webkit:chromium).launch({headless:true,...(executable?{executablePath:executable}:{}),...(name==='chromium'?{args:['--no-sandbox']}:{})});
 for(const size of[{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  const current=await open(size,'full');try{const{page}=current,before=await save(page);await seek(page,0);const startGeometry=await geometry(page),early=await capture(page,`${size.width}-opening-start`);
   await check(`${size.width}×${size.height} a large gold coin emerges and stays above the chest`,async()=>{
    await paintCoinMask(page);try{assert.equal(cyan(await capture(page,`${size.width}-opening-start-mask`)),0,'the coin begins inside the closed chest rather than already floating in front');}finally{await restoreCoinPaint(page);}
    await seek(page,700);const midCoin=await visibleCoin(page,`${size.width}-opening-middle`),middle=await capture(page,`${size.width}-opening-middle-clean`);await seek(page,1800);const endCoin=await visibleCoin(page,`${size.width}-opening-end`),end=await capture(page,`${size.width}-opening-end-clean`);
    assert(midCoin.y-endCoin.y>12,'the visible gold pixels rise out of the chest toward their final front position');
    assert(changed(early,middle)>150,'pixels show a real emerging coin and opening lid');assert(changed(early,end)>150,'end presentation differs from the closed chest');
    assert.deepEqual(await geometry(page),startGeometry,'coin animation cannot shrink or shift the dialog, board-sized SVG, or continuation');await fits(page);assert.equal(await page.locator('#next').isEnabled(),true);assert.deepEqual(await save(page),before,'seeking coin visuals cannot mutate canonical board, RNG, score, life, or economy');
    const order=await page.locator('#welcome-chest').evaluate(node=>[...node.children].map(item=>item.classList.contains('welcome-treasure')?'coin':item.classList.contains('welcome-chest-shell')?'shell':'other'));assert(order.indexOf('shell')>=0&&order.at(-1)==='coin','the complete shell is below the last SVG coin layer');
   });
   if(size.width===390)await check('the light rays visibly rotate behind the reward while stored state stays exact',async()=>{
    await seek(page,2000);const timing=await page.locator('.welcome-glow').evaluate(node=>{const spin=node.getAnimations({subtree:true}).find(animation=>animation.animationName==='welcome-rays-spin');if(!spin)return null;window.__welcomeRaySpin=spin;return{duration:spin.effect.getTiming().duration,iterations:spin.effect.getTiming().iterations};});assert(timing,'a real rotating ray animation exists');assert(timing.duration>=16000&&timing.duration<=40000,'the halo rotates slowly');assert.equal(timing.iterations,Infinity);
    await page.locator('#welcome-reward').evaluate(node=>{window.__rayVisualRestore=[...node.children].filter(item=>!item.classList.contains('welcome-glow')).map(item=>({item,style:item.getAttribute('style')}));for(const{item}of window.__rayVisualRestore)item.style.visibility='hidden';window.__welcomeRaySpin.currentTime=0;});await settled(page);const rayStart=await capture(page,'rays-start','#welcome-reward');
    await page.evaluate(()=>{window.__welcomeRaySpin.currentTime=3000;});await settled(page);const rayTurn=await capture(page,'rays-turned','#welcome-reward'),pixels=changed(rayStart,rayTurn);metrics.push({label:'rays',changedPixels:pixels,duration:timing.duration});assert(pixels>600,'screenshots prove visible ray rotation, not merely a CSS declaration');
    await page.evaluate(()=>{for(const row of window.__rayVisualRestore)if(row.style===null)row.item.removeAttribute('style');else row.item.setAttribute('style',row.style);delete window.__rayVisualRestore;delete window.__welcomeRaySpin;});await settled(page);assert.deepEqual(await save(page),before,'rotating the decorative halo changes no saved value');
   });
  }finally{await current.context.close();}
 }
 const reduced=await open({width:320,height:568},'reduce');try{await check('reduced motion keeps a fully visible static coin and stationary rays',async()=>{
  const{page}=reduced,before=await save(page);assert.equal(await page.locator('#welcome-chest').evaluate(node=>node.getAnimations({subtree:true}).length),0);assert.equal(await page.locator('.welcome-glow').evaluate(node=>node.getAnimations({subtree:true}).length),0);await visibleCoin(page,'reduced-coin');
  const first=await capture(page,'reduced-static-start','#welcome-reward');await page.waitForTimeout(500);const second=await capture(page,'reduced-static-end','#welcome-reward');assert.equal(changed(first,second),0,'actual reduced-motion reward pixels stay stationary');assert.deepEqual(await save(page),before);await fits(page);
 });}finally{await reduced.context.close();}
 assert.deepEqual(errors,[],'no real browser errors');fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({browser:name,groups:results.length,results,metrics,physicalDeviceTested:false},null,2));
})().catch(error=>{console.error(error);if(errors.length)console.error({pageErrors:errors});process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
