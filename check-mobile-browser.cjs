/* Actual rendered SVG and native Chromium touch regression checks. No game hooks ship. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const vm=require('node:vm');
const {chromium,webkit}=require('playwright');
const dist=path.join(__dirname,'dist');
const plain=value=>JSON.parse(JSON.stringify(value));
const reference={window:{},performance};vm.createContext(reference);
for(const file of ['engine.js','levels.js','tutorials.js'])vm.runInContext(fs.readFileSync(path.join(dist,file),'utf8'),reference);
const {HexMatch:Engine,HEX_LEVELS:levels,HEX_TUTORIALS:tutorials}=reference.window;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((request,response)=>{
 let file;try{file=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch(_){response.writeHead(400).end();return;}
 file=path.resolve(dist,'.'+(file==='/'?'/index.html':file));
 if(!file.startsWith(dist+path.sep)){response.writeHead(403).end();return;}
 if(path.basename(file)==='app.js'&&process.env.HEXROTA_APP_SOURCE)file=process.env.HEXROTA_APP_SOURCE;
 fs.readFile(file,(error,body)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(body);});
});
const errors=[],results=[];
const browserName=process.env.HEXROTA_BROWSER||'chromium';
const sizes=[[320,568],[390,844],[430,932],[844,390]];
function toward(from,to,fraction){return {x:from.x+(to.x-from.x)*fraction,y:from.y+(to.y-from.y)*fraction};}

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/`;
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 const browser=await (browserName==='webkit'?webkit:chromium).launch({headless:true,...(executable?{executablePath:executable}:{}),args:browserName==='chromium'?['--no-sandbox']:[]});
 let fixture;
 async function open(width=390,height=844,{stage=2,motion='reduce',boardTransform=''}={}){
  const level=stage<2?tutorials[stage]:levels[stage-2],model=new Engine(level);
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:motion==='reduce'?'reduce':'no-preference',serviceWorkers:'block'});
  await context.addInitScript(state=>localStorage.setItem('hexrota-match-v5',JSON.stringify(state)),{current:stage,done:Array.from({length:stage},(_,i)=>i),boards:{[stage]:plain(model.snapshot())},sound:false,preferences:{motion,music:false,haptics:false}});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.locator('#home-play').click();await page.locator('#pregame-start').click();
  await page.waitForFunction(()=>document.body.dataset.screen==='game'&&document.querySelector('#board').getBoundingClientRect().height>0);
  if(boardTransform)await page.locator('#board').evaluate((board,transform)=>{board.style.transform=transform;},boardTransform);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>{
   window.__qaAttempts=[];window.__qaPointers=[];
   const original=HexMatch.prototype.swap;HexMatch.prototype.swap=function(a,b){window.__qaAttempts.push([a,b]);return original.call(this,a,b);};
   document.querySelector('#board').addEventListener('pointerdown',event=>window.__qaPointers.push(event.pointerId));
  });
  const points=await page.evaluate(()=>{
   const board=document.querySelector('#board'),matrix=board.getScreenCTM();
   return [...board.querySelectorAll('[data-index]')].map(tile=>{const point=board.createSVGPoint(),local=tile.transform.baseVal.consolidate().matrix;point.x=local.e;point.y=local.f;const p=point.matrixTransform(matrix);return {x:p.x,y:p.y};});
  });
  const cdp=browserName==='chromium'?await context.newCDPSession(page):null;
  const read=()=>page.evaluate(stage=>JSON.parse(localStorage.getItem('hexrota-match-v5')).boards[stage],stage);
  const attempts=()=>page.evaluate(()=>window.__qaAttempts);
  const idle=()=>page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='false');
  async function down(point){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});else await page.mouse.move(point.x,point.y).then(()=>page.mouse.down());}
  async function move(point){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});else await page.mouse.move(point.x,point.y);}
  async function up(){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();}
  async function gesture(from,path,{wait=true}={}){await down(from);for(const point of path)await move(point);await up();if(wait)await idle();}
  fixture={context,page,level,model,points,cdp,read,attempts,idle,down,move,up,gesture};return fixture;
 }
 async function close(){if(fixture){await fixture.context.close();fixture=null;}}
 async function check(name,run){try{await run();results.push({name,passed:true});console.log('✓ '+name);}catch(error){results.push({name,passed:false,error:error.message});console.error('✗ '+name+': '+error.message);}finally{await close();}}
 async function sameAttempt(f,pair){assert.deepEqual(await f.attempts(),[plain(pair)],'one recognized neighbor swap attempt');const result=f.model.swap(...pair);assert.deepEqual(await f.read(),plain(f.model.snapshot()),'UI result matches unchanged engine, including invalid swaps and RNG');return result;}

 try{
  for(const [width,height]of sizes){
   for(const mode of ['fast','short','slow','overshoot-return','two-tap'])await check(`${width}×${height} ${mode}`,async()=>{
    const f=await open(width,height),pair=f.level.solution[0],from=f.points[pair[0]],to=f.points[pair[1]];
    if(mode==='two-tap'){for(const point of [from,to])await f.page.touchscreen.tap(point.x,point.y);await f.idle();}
    else{
     const route=mode==='slow'?Array.from({length:10},(_,i)=>toward(from,to,(i+1)/10)):mode==='overshoot-return'?[to,from]:[toward(from,to,mode==='short'?.44:1)];
     await f.gesture(from,route);
    }
    await sameAttempt(f,pair);assert.equal(await f.page.evaluate(()=>getComputedStyle(document.querySelector('#board')).touchAction),'none');
   });
  }
  const scan=new Engine(levels[0]),index=scan.neighbors.findIndex(neighbors=>neighbors.length===6);
  for(const target of scan.neighbors[index])await check(`six directions ${index} → ${target}`,async()=>{
   const f=await open(),from=f.points[index],to=f.points[target];await f.gesture(from,[toward(from,to,.5)]);await sameAttempt(f,[index,target]);
  });
  for(const edge of [26,35])await check(`edge start ${edge} SVG units`,async()=>{
   const f=await open(),pair=f.level.solution[0],from=f.points[pair[0]],to=f.points[pair[1]],start=toward(from,to,edge/(44*Math.sqrt(3)));
   await f.gesture(start,[{x:start.x+(to.x-from.x)*.55,y:start.y+(to.y-from.y)*.55}]);await sameAttempt(f,pair);
  });
  await check('CSS-scaled and rotated SVG uses its inverse screen matrix',async()=>{
   const f=await open(390,844,{boardTransform:'rotate(8deg) scale(.85)'}),pair=f.level.solution[0];await f.gesture(f.points[pair[0]],[toward(f.points[pair[0]],f.points[pair[1]],.5)]);await sameAttempt(f,pair);
  });
  await check('tiny jitter stays a tap',async()=>{const f=await open(),from=f.points[index];await f.gesture(from,[{x:from.x+5,y:from.y+2}]);assert.deepEqual(await f.attempts(),[]);assert.equal((await f.read()).turn,0);});
  await check('ambiguous direction does not guess',async()=>{
   const f=await open(),from=f.points[index],vectors=Array.from(scan.neighbors[index]).map(i=>f.points[i]).sort((a,b)=>Math.atan2(a.y-from.y,a.x-from.x)-Math.atan2(b.y-from.y,b.x-from.x));
   await f.gesture(from,[{x:from.x+(vectors[0].x+vectors[1].x-from.x*2)*.4,y:from.y+(vectors[0].y+vectors[1].y-from.y*2)*.4}]);assert.deepEqual(await f.attempts(),[]);
  });
  if(browserName==='chromium')for(const cancel of ['touchCancel','lost-capture','second-touch'])await check(cancel+' cancels one held swipe',async()=>{
   const f=await open(),pair=f.level.solution[0],from=f.points[pair[0]],to=f.points[pair[1]];await f.down(from);await f.move(to);
   if(cancel==='touchCancel')await f.cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   else if(cancel==='lost-capture'){await f.page.evaluate(()=>{const board=document.querySelector('#board');board.releasePointerCapture(window.__qaPointers.at(-1));});await f.page.waitForTimeout(30);await f.up();}
   else{await f.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...to,id:1},{x:to.x+35,y:to.y+25,id:2}]});await f.up();}
   await f.idle();assert.deepEqual(await f.attempts(),[]);assert.equal((await f.read()).turn,0);
  });
  for(const cancel of ['resize','background'])await check(cancel+' cancels held gesture',async()=>{
   const f=await open(),pair=f.level.solution[0];await f.down(f.points[pair[0]]);await f.move(f.points[pair[1]]);
   if(cancel==='resize')await f.page.setViewportSize({width:844,height:390});else await f.page.evaluate(()=>window.dispatchEvent(new Event('blur')));
   await f.up();assert.deepEqual(await f.attempts(),[]);assert.equal((await f.read()).turn,0);
  });
  await check('rapid sequential swipes stay separate',async()=>{
   const f=await open();for(const pair of f.level.solution.slice(0,2)){await f.gesture(f.points[pair[0]],[f.points[pair[1]]]);f.model.swap(...pair);}
   assert.deepEqual(await f.attempts(),plain(f.level.solution.slice(0,2)));assert.deepEqual(await f.read(),plain(f.model.snapshot()));
  });
  await check('touch during animation only reveals result',async()=>{
   const f=await open(390,844,{motion:'full'}),pair=f.level.solution[0];
   const initial=await f.page.locator('#board').boundingBox();
   await f.gesture(f.points[pair[0]],[f.points[pair[1]]],{wait:false});
   assert.equal(await f.page.locator('#board').getAttribute('aria-busy'),'true');
   const active=await f.page.locator('#board').boundingBox();
   assert.equal(await f.page.locator('#skip-animation').isVisible(),false,'the skip animation control is never visible');
   assert(Math.abs(active.height-initial.height)<=1,'board height does not shrink when a swap animation starts');
   assert(Math.abs(active.width-initial.width)<=1,'board width does not change when swap effects begin');
   await f.gesture(f.points[pair[0]],[f.points[pair[1]]]);
   const finished=await f.page.locator('#board').boundingBox();
   assert(Math.abs(finished.height-initial.height)<=1,'board height remains stable after animation finishes');
   await sameAttempt(f,pair);assert.equal((await f.read()).turn,1);
  });
  for(const stage of [0,1])await check(`T${stage+1} guided native input`,async()=>{const f=await open(390,844,{stage}),pair=f.level.solution[0];await f.gesture(f.points[pair[0]],[f.points[pair[1]]]);await sameAttempt(f,pair);});
  assert.deepEqual(errors,[],'no uncaught browser errors');
  const failed=results.filter(result=>!result.passed);console.log(JSON.stringify({browser:browserName,transport:browserName==='chromium'?'native CDP touch':'native mouse + native touch taps',checks:results.length,failed:failed.length,physicalIPhoneTested:false}));
  if(process.env.HEXROTA_BROWSER_REPORT)fs.writeFileSync(process.env.HEXROTA_BROWSER_REPORT,JSON.stringify({browser:browserName,results,errors,physicalIPhoneTested:false},null,2));
  assert.equal(failed.length,0,`${failed.length} browser input regressions failed`);
 }finally{await close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
