/* Real mobile-engine QA for the isolated lab. Never opens a production save adapter. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium,webkit}=require('playwright'),{PNG}=require('pngjs');
const {HexMatch}=require('./lib/level-analysis.cjs');
const {existing,lifePool,plain}=require('./check-lives-ui.cjs');
const root=__dirname,dist=path.join(root,'dist'),browserName=process.env.HEXROTA_BROWSER||'chromium';
assert(['chromium','webkit'].includes(browserName));
const output=process.env.HEXROTA_LAB_SCREENSHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-lab-'+browserName+'-'));fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((request,response)=>{let file;try{file=path.resolve(dist,'.'+new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400).end();return;}if(!file.startsWith(dist+path.sep)){response.writeHead(403).end();return;}fs.readFile(file,(error,body)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);});});
const results=[],errors=[],external=[];
const protectedKeys=['hexrota-profile-v2','hexrota-match-v5','hexrota-match-v4','hexrota-match-v3','hexrota-match-v2','hexrota-lives-v1','hexrota-events-v1','hexrota-playtest-v1'];
const entry=existing(2),energy=plain(lifePool(3));energy.testWallet.gold=211;entry.saved.variantSelection.serial=77;
const profile={schemaVersion:2,revision:23,game:entry.saved,energy};
const seed=Object.fromEntries(protectedKeys.map(key=>[key,JSON.stringify(key==='hexrota-profile-v2'?profile:key==='hexrota-match-v5'?entry.saved:key==='hexrota-lives-v1'?energy:{schemaVersion:1,sentinel:'preserve-player-state',attemptSerial:77})]));
let browser,current,url;
function towards(a,b,f){return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};}
async function idle(page){await page.waitForFunction(()=>window.HexBalanceLab?.inspect().ready&&!window.HexBalanceLab.inspect().busy);}
async function inspect(page){return page.evaluate(()=>window.HexBalanceLab.inspect());}
async function points(page){await page.locator('#lab-board').scrollIntoViewIfNeeded();return page.evaluate(()=>{const svg=document.querySelector('#lab-board'),matrix=svg.getScreenCTM();return [...svg.querySelectorAll('.lab-tile[data-index]')].map(tile=>{const p=svg.createSVGPoint(),local=tile.transform.baseVal.consolidate().matrix;p.x=local.e;p.y=local.f;const s=p.matrixTransform(matrix);return{x:s.x,y:s.y};});});}
async function open({width=390,height=844,motion='reduce',query=''}={}){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:motion,serviceWorkers:'block'});current=context;
 context.on('request',request=>{if(!request.url().startsWith(url)&&!request.url().startsWith('data:')&&!request.url().startsWith('blob:'))external.push(request.url());});
 await context.addInitScript(({seed,keys})=>{
  const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,local=window.localStorage,session=window.sessionStorage;
  for(const key of keys)if(nativeGet.call(local,key)===null)nativeSet.call(local,key,seed[key]);
  const calls=[];window.__labQaStorageCalls=calls;window.__labQaSeed=()=>Object.fromEntries(keys.map(key=>[key,nativeGet.call(local,key)]));
  for(const name of ['getItem','setItem','removeItem','clear','key']){const original=Storage.prototype[name];Storage.prototype[name]=function(...args){calls.push({api:name,key:args[0]??null});return original.apply(this,args);};}
  for(const [name,value]of [['localStorage',local],['sessionStorage',session]])Object.defineProperty(window,name,{configurable:true,get(){calls.push({api:name});return value;}});
  if('indexedDB'in window)Object.defineProperty(window,'indexedDB',{configurable:true,get(){calls.push({api:'indexedDB'});throw Error('Lab accessed IndexedDB');}});
  Object.defineProperty(document,'cookie',{configurable:true,get(){calls.push({api:'cookie-read'});return '';},set(){calls.push({api:'cookie-write'});throw Error('Lab attempted cookie persistence');}});
  window.fetch=()=>{calls.push({api:'fetch'});return Promise.reject(Error('Unexpected lab network API'));};navigator.sendBeacon=()=>{calls.push({api:'sendBeacon'});return false;};window.XMLHttpRequest=function(){calls.push({api:'XHR'});throw Error('Unexpected lab XHR');};
  // The pixel case samples real native WAAPI frames deterministically. Keep its
  // watchdog outside the screenshot window, as the existing swap-visual suite
  // does. All cancellation/normal-input cases use the untouched real clock.
  const nativeAnimate=Element.prototype.animate,nativeTimer=window.setTimeout,nativeClear=window.clearTimeout,deadlines=new Set();window.__labQaDeadlines=deadlines;
  Element.prototype.animate=function(frames,options){const animation=nativeAnimate.call(this,frames,options);if((window.__labQaFreezeSwap||window.__labQaStallPresentation)&&this.closest?.('.lab-swap-layer')){animation.pause();animation.currentTime=0;}return animation;};
  window.setTimeout=function(callback,delay,...args){
   const held=window.__labQaFreezeSwap&&(delay===500||delay===3300)||window.__labQaStallPresentation&&delay===500;
   if(delay===3300){let handle;handle=nativeTimer(()=>{deadlines.delete(handle);callback(...args);},held?10000:delay);deadlines.add(handle);return handle;}
   return nativeTimer(callback,held?10000:delay,...args);
  };
  window.clearTimeout=function(handle){deadlines.delete(handle);return nativeClear(handle);};
 },{seed,keys:protectedKeys});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(url+'balance-lab.html'+query);await page.waitForFunction(()=>!!window.HexBalanceLab);
 const cdp=browserName==='chromium'?await context.newCDPSession(page):null;
 return {page,context,cdp};
}
async function untouched(f){assert.deepEqual(await f.page.evaluate(()=>window.__labQaStorageCalls),[],'lab uses no storage/cookie/network APIs');assert.deepEqual(await f.page.evaluate(()=>window.__labQaSeed()),seed,'all real profile/life/wallet/attempt keys remain byte-identical');}
async function check(name,run){try{await run();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack||error.message});console.error('FAIL '+name+': '+error.message);}finally{if(current){await current.close();current=null;}}}
async function choose(f,level,variant,experiment){await f.page.locator('#lab-level').selectOption(String(level));await f.page.locator('#lab-variant').selectOption(variant);await f.page.locator('#lab-experiment').selectOption(experiment);await f.page.locator('#lab-start').click();await idle(f.page);}
async function gesture(f,from,path,{wait=true}={}){
 if(f.cdp){await f.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});for(const point of path)await f.cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});await f.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else{await f.page.mouse.move(from.x,from.y);await f.page.mouse.down();for(const point of path)await f.page.mouse.move(point.x,point.y);await f.page.mouse.up();}
 if(wait)await idle(f.page);
}
async function tapPair(f,pair){const p=await points(f.page);for(const index of pair)await f.page.touchscreen.tap(p[index].x,p[index].y);await idle(f.page);}
async function sameMove(f,before,pair){const model=new HexMatch(before.level,before.snapshot),result=model.swap(...pair),after=await inspect(f.page);assert.deepEqual(after.snapshot,plain(model.snapshot()));assert.deepEqual(after.lastSwapAttempt.pair,plain(pair));assert.equal(after.lastSwapAttempt.ok,result.ok);return after;}
function rgb(value){const values=value.match(/[\d.]+/g);assert(values&&values.length>=3,'SVG computed RGB color');return values.slice(0,3).map(Number);}
function countPixels(png,rect,color,sx,sy){let count=0;const left=Math.max(0,Math.floor(rect.x*sx)),right=Math.min(png.width,Math.ceil((rect.x+rect.width)*sx)),top=Math.max(0,Math.floor(rect.y*sy)),bottom=Math.min(png.height,Math.ceil((rect.y+rect.height)*sy));for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const i=(y*png.width+x)*4;if(png.data[i+3]>200&&Math.max(...color.map((c,j)=>Math.abs(c-png.data[i+j])))<30)count++;}return count;}
async function visibleMovingStones(page,name){
 const stones=await page.evaluate(()=>[...document.querySelectorAll('.lab-swap-layer .lab-moving-stone')].map(node=>{const shape=node.querySelector('.lab-gem-shape'),text=node.querySelector('.lab-number'),s=shape.getBoundingClientRect(),t=text.getBoundingClientRect();return{from:node.dataset.from,to:node.dataset.to,shape:{x:s.x,y:s.y,width:s.width,height:s.height},text:{x:t.x,y:t.y,width:t.width,height:t.height},fill:getComputedStyle(shape).fill,ink:getComputedStyle(text).fill};}));assert.equal(stones.length,2);
 const screenshot=await page.screenshot({path:path.join(output,name+'.png')}),png=PNG.sync.read(screenshot),viewport=page.viewportSize(),sx=png.width/viewport.width,sy=png.height/viewport.height;
 for(const stone of stones){assert(stone.shape.width>10&&stone.text.width>5);assert(countPixels(png,stone.shape,rgb(stone.fill),sx,sy)>40,'moving stone '+stone.from+' has painted color pixels');assert(countPixels(png,stone.text,rgb(stone.ink),sx,sy)>10,'moving stone '+stone.from+' has painted numeral pixels');}
 return stones;
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}/`;
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...(executable?{executablePath:executable}:{}),args:browserName==='chromium'?['--no-sandbox']:[]});
 try{
  for(const [width,height]of [[320,568],[390,844],[844,390]])await check(`${width}×${height} reachable controls, deterministic candidate restart and profile isolation`,async()=>{
   const f=await open({width,height});await idle(f.page);assert.equal(await f.page.locator('#lab-level option').count(),10);assert.equal(await f.page.locator('#lab-variant option').count(),4);
   for(const id of ['lab-level','lab-variant','lab-experiment','lab-start','lab-restart']){const control=f.page.locator('#'+id);await control.scrollIntoViewIfNeeded();const box=await control.boundingBox();assert(box&&box.width>=44&&box.height>=40,id+' is a usable touch target');assert(box.x>=-1&&box.x+box.width<=width+1,id+' is horizontally accessible');assert(box.y>=-1&&box.y+box.height<=height+1,id+' is reachable by scroll');}
   await choose(f,3,'v1','l3-moves-plus-1');const start=await inspect(f.page);assert.equal(start.selection.experimentId,'l3-moves-plus-1');assert.match(start.level.id,/^lab94-/);assert.equal(start.level.moves,10);
   await tapPair(f,start.level.solutions[0][0]);await sameMove(f,start,start.level.solutions[0][0]);await f.page.locator('#lab-restart').click();await idle(f.page);assert.deepEqual((await inspect(f.page)).snapshot,start.snapshot);await untouched(f);
   assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'mobile page has no horizontal overflow');await f.page.screenshot({path:path.join(output,`layout-${width}-${height}.png`),fullPage:true});
  });
  for(const kind of ['short','slow','overshoot-return','two-tap'])await check(kind+' uses one ordinary engine swap',async()=>{
   const f=await open();await idle(f.page);const before=await inspect(f.page),pair=before.level.solutions[0][0],p=await points(f.page),from=p[pair[0]],to=p[pair[1]];
   if(kind==='two-tap')await tapPair(f,pair);else await gesture(f,from,kind==='slow'?Array.from({length:9},(_,i)=>towards(from,to,(i+1)/9)):kind==='overshoot-return'?[to,from]:[towards(from,to,.47)]);
   const after=await sameMove(f,before,pair);assert.equal(after.snapshot.turn,1);await untouched(f);
  });
  const first=await open();await idle(first.page);const initial=await inspect(first.page),topology=new HexMatch(initial.level),center=topology.neighbors.findIndex(neighbors=>neighbors.length===6);await first.context.close();current=null;
  for(const to of topology.neighbors[center])await check(`short swipe recognizes hex neighbor ${center}→${to}`,async()=>{const f=await open();await idle(f.page);const before=await inspect(f.page),p=await points(f.page);await gesture(f,p[center],[towards(p[center],p[to],.5)]);await sameMove(f,before,[center,to]);await untouched(f);});
  await check('small jitter remains a tap and creates no swap attempt',async()=>{const f=await open();await idle(f.page);const before=await inspect(f.page),p=await points(f.page);await gesture(f,p[center],[{x:p[center].x+3,y:p[center].y+2}]);const after=await inspect(f.page);assert.deepEqual(after.snapshot,before.snapshot);assert.equal(after.lastSwapAttempt,null);await untouched(f);});
  await check('winning and losing results show actual missing score, cells and layers',async()=>{
   const f=await open();await idle(f.page);await choose(f,3,'v1','l3-moves-plus-1');let state=await inspect(f.page);const model=new HexMatch(state.level);for(const pair of state.level.solutions[0]){model.swap(...pair);await tapPair(f,pair);}assert.equal((await inspect(f.page)).status,'won');assert.equal(await f.page.locator('#lab-missing-score').textContent(),'0');assert.equal(await f.page.locator('#lab-missing-green').textContent(),'0');assert.equal(await f.page.locator('#lab-remaining-layers').textContent(),'0');assert(await f.page.locator('#lab-result').isVisible());
   await choose(f,8,'v1','baseline');state=await inspect(f.page);const losing=new HexMatch(state.level);while(losing.status==='playing'){const options=losing.legalMoves(),pair=plain(options[(losing.turn*7+3)%options.length]);losing.swap(...pair);await tapPair(f,pair);}assert.equal(losing.status,'lost','predeclared legal off-route fixture loses');assert.equal((await inspect(f.page)).status,'lost');assert.equal(Number(await f.page.locator('#lab-missing-score').textContent()),Math.max(0,losing.level.target-losing.score));assert.equal(Number(await f.page.locator('#lab-missing-green').textContent()),losing.total-losing.covered);assert.equal(Number(await f.page.locator('#lab-remaining-layers').textContent()),losing.remainingLayers);await untouched(f);
  });
  await check('direct experimental URL and reload preserve the exact initial board and RNG',async()=>{const f=await open({query:'?level=9&variant=v4&experiment=l9-initial-v4'});await idle(f.page);const before=await inspect(f.page);assert.equal(before.selection.experimentId,'l9-initial-v4');await tapPair(f,before.level.solutions[0][0]);await untouched(f);await f.page.reload();await idle(f.page);assert.deepEqual((await inspect(f.page)).snapshot,before.snapshot);await untouched(f);});
  await check('both moving stones stay painted above floors and board dimensions remain stable',async()=>{
   const f=await open({motion:'no-preference'});await idle(f.page);const before=await inspect(f.page),pair=before.level.solutions[0][0],p=await points(f.page),box=await f.page.locator('#lab-board').boundingBox();await f.page.evaluate(()=>window.__labQaFreezeSwap=true);await gesture(f,p[pair[0]],[p[pair[1]]],{wait:false});await f.page.waitForFunction(()=>document.querySelectorAll('.lab-swap-layer .lab-moving-stone').length===2);
   const paused=await f.page.evaluate(()=>{const animations=document.getAnimations().filter(a=>a.effect?.target?.closest?.('.lab-swap-layer'));for(const a of animations){a.pause();a.currentTime=0;}return animations.length;});assert(paused>=2,'both real SVG stones have active native animations');
   for(const fraction of [0,.5,.97]){await f.page.evaluate(fraction=>{for(const a of document.getAnimations().filter(a=>a.effect?.target?.closest?.('.lab-swap-layer'))){a.pause();a.currentTime=Number(a.effect.getTiming().duration)*fraction;}},fraction);await f.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await visibleMovingStones(f.page,'swap-'+String(fraction));const active=await f.page.locator('#lab-board').boundingBox();assert(Math.abs(active.width-box.width)<1&&Math.abs(active.height-box.height)<1,'the board does not shrink during animation');}
   await f.page.evaluate(()=>{for(const a of document.getAnimations())a.finish();});await idle(f.page);assert.equal(await f.page.locator('.lab-moving-stone').count(),0);await sameMove(f,before,pair);assert.equal(await f.page.getByText('Animasyonu geç',{exact:false}).count(),0);await untouched(f);
  });
  for(const cancel of ['restart','resize','background'])await check(cancel+' safely removes temporary swap visuals',async()=>{
   const f=await open({motion:'no-preference'});await idle(f.page);const before=await inspect(f.page),pair=before.level.solutions[0][0],p=await points(f.page);await gesture(f,p[pair[0]],[p[pair[1]]],{wait:false});await f.page.waitForFunction(()=>window.HexBalanceLab.inspect().busy);
   if(cancel==='restart')await f.page.locator('#lab-restart').click();else if(cancel==='resize')await f.page.setViewportSize({width:844,height:390});else await f.page.evaluate(()=>window.dispatchEvent(new Event('blur')));
   await idle(f.page);assert.equal(await f.page.locator('.lab-moving-stone').count(),0);assert.equal(await f.page.evaluate(()=>window.__labQaDeadlines.size),0,'cancel removes the old presentation deadline');if(cancel==='restart')assert.deepEqual((await inspect(f.page)).snapshot,before.snapshot);else await sameMove(f,before,pair);await untouched(f);
  });
  await check('real 3300ms deadline settles stalled native animations and cannot affect a fresh move',async()=>{
   const f=await open({motion:'no-preference'});await idle(f.page);const before=await inspect(f.page),pair=before.level.solutions[0][0],p=await points(f.page);await f.page.evaluate(()=>window.__labQaStallPresentation=true);
   const started=Date.now();await gesture(f,p[pair[0]],[p[pair[1]]],{wait:false});await f.page.waitForFunction(()=>document.querySelectorAll('.lab-moving-stone').length===2);assert.equal(await f.page.evaluate(()=>window.__labQaDeadlines.size),1);
   await f.page.waitForFunction(()=>!window.HexBalanceLab.inspect().busy,null,{timeout:6500});const elapsed=Date.now()-started;assert(elapsed>=3000&&elapsed<6200,'the real bounded deadline, not a completed animation, resolves presentation');assert.equal(await f.page.locator('.lab-moving-stone').count(),0);assert.equal(await f.page.evaluate(()=>window.__labQaDeadlines.size),0);await sameMove(f,before,pair);
   await f.page.evaluate(()=>window.__labQaStallPresentation=false);await f.page.locator('#lab-restart').click();await idle(f.page);assert.deepEqual((await inspect(f.page)).snapshot,before.snapshot);await tapPair(f,pair);await sameMove(f,before,pair);assert.equal(await f.page.evaluate(()=>window.__labQaDeadlines.size),0,'normal completion removes its own deadline');await untouched(f);
  });
  await check('invalid query is rejected without creating or persisting a replacement board',async()=>{const f=await open({query:'?level=1&variant=v1&experiment=not-an-experiment'});const state=await inspect(f.page);assert.equal(state.ready,false);assert(await f.page.locator('#lab-error').isVisible());assert((await f.page.locator('#lab-error').textContent()).trim());await untouched(f);});
  assert.deepEqual(errors,[],'no uncaught page errors');assert.deepEqual(external,[],'isolated developer surface makes no external network requests');
  const report={browser:browserName,transport:browserName==='chromium'?'native CDP touch and native touch taps':'native mouse gestures and native touch taps',checks:results.length,failed:results.filter(r=>!r.passed).length,results,errors,externalRequests:external,protectedKeys:protectedKeys.length,physicalIPhoneTested:false,physicalAndroidTested:false};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({browser:browserName,checks:report.checks,failed:report.failed,physicalIPhoneTested:false}));assert.equal(report.failed,0);
 }finally{if(current)await current.close();await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;}).finally(()=>server.close());
