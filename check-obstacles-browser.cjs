/* Mobile acceptance for the real classic-v5 engine and shared board/presentation.
 * Run separately with HEXROTA_BROWSER=webkit for actual WebKit, not an iPhone. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.join(__dirname,'dist'),KEY='hexrota-obstacles-lab-v1';
const browserName=process.env.HEXROTA_BROWSER||'chromium';assert(['chromium','webkit'].includes(browserName));
const output=process.env.HEXROTA_OBSTACLES_SCREENSHOT_DIR||path.join(__dirname,'reports','obstacles-9-12',browserName);
fs.mkdirSync(output,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{let file;try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);file=path.resolve(root,'.'+(pathname==='/'?'/obstacles.html':pathname));}catch(_){res.writeHead(400).end();return;}if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(data);});});
const errors=[],results=[],measurements=[];let browser,url,current='opening',active;
const plain=v=>JSON.parse(JSON.stringify(v));
async function check(name,run){current=name;await run();results.push(name);console.log('PASS '+browserName+' '+name);}
async function open(size={width:390,height:844},motion='reduce'){
 const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:motion,serviceWorkers:'block'});
 await context.addInitScript(key=>{
  localStorage.setItem('hexrota-profile-v2','campaign-sentinel');
  localStorage.setItem('hexrota-match-v5','legacy-sentinel');
  const watched={reads:[],writes:[],removes:[]};window.__obstacleStorage=watched;
  const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
  Storage.prototype.getItem=function(k){watched.reads.push(k);return get.call(this,k);};
  Storage.prototype.setItem=function(k,v){watched.writes.push({key:k,value:v});return set.call(this,k,v);};
  Storage.prototype.removeItem=function(k){watched.removes.push(k);return remove.call(this,k);};
  window.__obstacleRawGet=k=>get.call(localStorage,k);
  let boardView;
  Object.defineProperty(window,'HexBoardView',{configurable:true,get(){return boardView;},set(api){boardView=Object.freeze({...api,reconcile(...args){if(window.__failObstacleRender&&!window.__obstacleRenderFault){window.__obstacleRenderFault=true;throw Error('obstacle initial projection fault');}return api.reconcile(...args);}});}});
 },KEY);
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.HexObstacleLab&&document.querySelector('#board [data-index]'));
 const cdp=browserName==='chromium'?await context.newCDPSession(page):null;
 active={context,page,cdp};return active;
}
async function close(){if(active){await active.context.close();active=null;}}
const idle=page=>page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='false',null,{timeout:20000});
const snapshot=page=>page.evaluate(()=>HexObstacleLab.snapshot());
const level=page=>page.evaluate(()=>HexObstacleLab.level());
const canonical=page=>page.evaluate(key=>window.__obstacleRawGet(key),KEY);
const writeCount=page=>page.evaluate(()=>window.__obstacleStorage.writes.length);
async function select(page,id){await page.locator('#level-select').selectOption(String(id));await idle(page);}
async function center(page,index){const box=await page.locator(`#board [data-index="${index}"] > .floor-shape`).boundingBox();assert(box,'cell '+index+' rendered');return {x:box.x+box.width/2,y:box.y+box.height/2};}
async function tapPair(page,pair){for(const index of pair){const point=await center(page,index);await page.touchscreen.tap(point.x,point.y);}await idle(page);}
async function dragPair(f,pair){
 const from=await center(f.page,pair[0]),to=await center(f.page,pair[1]);
 if(f.cdp){await f.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});for(let j=1;j<=6;j++)await f.cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*j/6,y:from.y+(to.y-from.y)*j/6,id:1}]});await f.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else {await f.page.mouse.move(from.x,from.y);await f.page.mouse.down();await f.page.mouse.move(to.x,to.y,{steps:6});await f.page.mouse.up();}
 await idle(f.page);
}
async function renderMatches(page){
 const s=await snapshot(page),painted=await page.locator('#board [data-index]').evaluateAll(nodes=>nodes.map(tile=>{const n=tile.querySelector('.hex-number');return n&&n.textContent.trim()!==''?Number(n.textContent):null;}));
 assert.deepEqual(painted,s.values,'rendered tile values equal committed canonical snapshot');
 assert.equal(Number(await page.locator('#sum').textContent()),s.score);
 assert.equal(Number(await page.locator('#moves-left').textContent()),s.movesLeft);
 assert.equal(await page.locator('#board').getAttribute('aria-busy'),'false');
}
async function isolated(page){const io=await page.evaluate(()=>window.__obstacleStorage);assert(io.reads.every(k=>k===KEY),'lab reads only its development storage key');assert(io.writes.every(row=>row.key===KEY),'lab writes only its development storage key');assert(io.removes.every(k=>k===KEY),'lab removes only its development storage key');assert.equal(await page.evaluate(()=>window.__obstacleRawGet('hexrota-profile-v2')),'campaign-sentinel');assert.equal(await page.evaluate(()=>window.__obstacleRawGet('hexrota-match-v5')),'legacy-sentinel');}
async function expected(page,route){return page.evaluate(route=>{const model=new HexMatch(HexObstacleLab.level(),HexObstacleLab.snapshot());const swaps=route.map(pair=>model.swap(...pair));return {snapshot:model.snapshot(),status:model.status,swaps};},route);}
async function screenshot(page,name){await page.screenshot({path:path.join(output,name+'.png'),fullPage:true,animations:'disabled'});}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}/obstacles.html`;
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 try{
  browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...(executable?{executablePath:executable}:{}),...(browserName==='chromium'?{args:['--no-sandbox']}:{})});
  for(const [width,height]of [[320,568],[390,844],[430,932]]){
   const f=await open({width,height});
   const options=await f.page.locator('#level-select option').evaluateAll(nodes=>nodes.map(n=>({id:n.value,name:n.textContent})));
   assert.equal(options.length,3,'three authored development levels');
   for(const [offset,option]of options.entries())await check(`${width}x${height} test ${String.fromCharCode(65+offset)} native input, unlock, win and reload`,async()=>{
    await select(f.page,option.id);await f.page.locator('#restart').tap();await idle(f.page);
    const l=await level(f.page),initial=await snapshot(f.page),route=l.solutions?.[0]||l.solution;assert(route?.length,'verified authored route exists');
    const closed=l.obstacles.regions.flatMap(r=>r.cells),blocked=l.obstacles.blockers.map(b=>b.cell);
    for(const index of [...new Set([...closed,...blocked])]){const p=await center(f.page,index);await f.page.touchscreen.tap(p.x,p.y);}
    assert.deepEqual(await snapshot(f.page),initial,'blocked and closed taps cannot modify board or consume moves');
    const layout=await f.page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,board:document.querySelector('#board').getBoundingClientRect().toJSON(),height:innerHeight}));
    assert.equal(layout.overflow,false,'no horizontal overflow');assert(layout.board.width>0&&layout.board.height>0,'board visible');
    const bounds=await f.page.evaluate(()=>{const svg=document.querySelector('#board'),box=svg.getBoundingClientRect(),wrap=svg.parentElement.getBoundingClientRect();return {inside:box.top>=wrap.top-1&&box.bottom<=wrap.bottom+1,centers:[...svg.querySelectorAll('[data-index]')].map(tile=>{const p=svg.createSVGPoint(),m=tile.transform.baseVal.consolidate().matrix;p.x=m.e;p.y=m.f;const c=p.matrixTransform(svg.getScreenCTM());return document.elementFromPoint(c.x,c.y)?.closest('[data-index]')?.dataset.index===tile.dataset.index;})};});
    assert(bounds.inside,'SVG stays within board wrapper');assert(bounds.centers.every(Boolean),'every cell center is reachable without a controls overlay');measurements.push({width,height,level:l.id,...layout});
    if(width===390)await screenshot(f.page,'test-'+String.fromCharCode(65+offset)+'-initial');
    const proof=await expected(f.page,route);assert.equal(proof.status,'won','route wins through real engine');
    let opened=false;
    for(let turn=0;turn<route.length;turn++){
     const previous=await snapshot(f.page),step=await expected(f.page,[route[turn]]);assert(step.swaps[0].ok,'authored move accepted');
     const writesBefore=await writeCount(f.page);
     if(turn===0)await dragPair(f,route[turn]);else await tapPair(f.page,route[turn]);
     assert.equal(await writeCount(f.page),writesBefore+1,'each valid move commits once before presentation and no animation callback rewrites it');
     assert.deepEqual(await snapshot(f.page),step.snapshot,'native move matches actual engine including HP, geometry and RNG');await renderMatches(f.page);
     if(!opened&&step.snapshot.regionOpen?.some(Boolean)){opened=true;if(width===390)await screenshot(f.page,'test-'+String.fromCharCode(65+offset)+'-opened');}
     if(turn===0){const durable=await canonical(f.page);await f.page.reload();await idle(f.page);assert.equal(await canonical(f.page),durable,'reload keeps exact snapshot');assert.deepEqual(await snapshot(f.page),step.snapshot,'reload restores resolved state');await renderMatches(f.page);}
     assert.equal(step.snapshot.turn,previous.turn+1);
    }
    assert.deepEqual(await snapshot(f.page),proof.snapshot);assert(opened,'a new playable region opens');
    assert(/kazand|tamamla/i.test(await f.page.locator('#lab-result').textContent()),'winning outcome displayed');
    if(width===320){const box=await f.page.locator('#lab-result').boundingBox();assert(box&&box.y>=0&&box.y+box.height<=height,'terminal outcome is inside the smallest viewport');}
    await isolated(f.page);
   });
   await close();
  }
  await check('presentation cancellation never rolls back a committed box break or unlock',async()=>{
   const f=await open({width:390,height:844},'no-preference'),l=await level(f.page),route=l.solutions?.[0]||l.solution,proof=await expected(f.page,[route[0]]);
   await f.page.evaluate(()=>{
    window.__cancelledAt=null;
    const observer=new MutationObserver(()=>{const board=document.querySelector('#board'),phase=board.dataset.presentationPhase||board.dataset.phase;if(phase==='BLOCKER_HIT'||phase==='BLOCKER_BREAK'||phase==='REGION_UNLOCK'){window.__cancelledAt=phase;observer.disconnect();HexObstacleLab.cancelPresentation();}});
    observer.observe(document.querySelector('#board'),{attributes:true});window.__cancelObserver=observer;
   });
   await tapPair(f.page,route[0]);assert(await f.page.evaluate(()=>window.__cancelledAt),'cancelled an obstacle presentation phase');
   assert.deepEqual(await snapshot(f.page),proof.snapshot);await renderMatches(f.page);
   const durable=await canonical(f.page);await f.page.reload();await idle(f.page);assert.equal(await canonical(f.page),durable);await renderMatches(f.page);await isolated(f.page);await close();
  });
  await check('background interruption and reduced motion preserve the canonical result',async()=>{
   const f=await open({width:320,height:568},'no-preference'),l=await level(f.page),route=l.solutions?.[0]||l.solution,proof=await expected(f.page,[route[0]]);
   const p=await center(f.page,route[0][0]),q=await center(f.page,route[0][1]);await f.page.touchscreen.tap(p.x,p.y);await f.page.touchscreen.tap(q.x,q.y);
   await f.page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await idle(f.page);assert.deepEqual(await snapshot(f.page),proof.snapshot);await renderMatches(f.page);await isolated(f.page);await close();
  });
  await check('animation API failure still paints and reloads the saved engine result',async()=>{
   const f=await open({width:390,height:844},'no-preference'),l=await level(f.page),route=l.solutions?.[0]||l.solution,proof=await expected(f.page,[route[0]]),writesBefore=await writeCount(f.page);
   await f.page.evaluate(()=>{const native=Element.prototype.animate;window.__obstacleAnimationFault=false;Element.prototype.animate=function(...args){if(!window.__obstacleAnimationFault){window.__obstacleAnimationFault=true;throw Error('obstacle presentation fault');}return native.apply(this,args);};});
   await tapPair(f.page,route[0]);assert(await f.page.evaluate(()=>window.__obstacleAnimationFault),'real animation API fault injected');
   assert.equal(await writeCount(f.page),writesBefore+1);assert.deepEqual(await snapshot(f.page),proof.snapshot);await renderMatches(f.page);await isolated(f.page);await close();
  });
  await check('initial projection failure after commit recovers the canonical board and input lock',async()=>{
   const f=await open({width:390,height:844},'no-preference'),l=await level(f.page),route=l.solutions?.[0]||l.solution,proof=await expected(f.page,[route[0]]),writesBefore=await writeCount(f.page);
   const from=await center(f.page,route[0][0]);await f.page.touchscreen.tap(from.x,from.y);
   await f.page.evaluate(()=>{window.__failObstacleRender=true;});
   const to=await center(f.page,route[0][1]);await f.page.touchscreen.tap(to.x,to.y);await idle(f.page);
   assert(await f.page.evaluate(()=>window.__obstacleRenderFault),'real initial reconcile fault injected after move commit');
   assert.equal(await writeCount(f.page),writesBefore+1);assert.deepEqual(await snapshot(f.page),proof.snapshot);await renderMatches(f.page);
   assert.equal(await f.page.locator('#restart').isEnabled(),true,'input lock cleared');await isolated(f.page);await close();
  });
  await check('corrupt development save is retained until explicit restart',async()=>{
   const f=await open(),l=await level(f.page),route=l.solutions?.[0]||l.solution;
   await f.page.evaluate(key=>localStorage.setItem(key,'{broken'),KEY);await f.page.reload();await idle(f.page);
   assert.equal(await canonical(f.page),'{broken','corrupt save is not silently replaced');assert(/bozuk|doğrulanamadı/i.test(await f.page.locator('#lab-message').textContent()));
   const before=await snapshot(f.page);await tapPair(f.page,route[0]);assert.deepEqual(await snapshot(f.page),before,'corrupt save blocks moves');
   await f.page.locator('#restart').tap();await idle(f.page);assert.equal(JSON.parse(await canonical(f.page)).version,1,'explicit restart repairs only the lab save');await renderMatches(f.page);await isolated(f.page);await close();
  });
  assert.deepEqual(errors,[],'no uncaught browser errors');
 }catch(error){if(active)await screenshot(active.page,'failure-'+current.replace(/[^a-z0-9]+/gi,'-').slice(0,90)).catch(()=>{});console.error(error.stack);process.exitCode=1;}
 finally{await close();await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({browser:browserName,checks:results.length,results,measurements,errors,physicalIPhone:false},null,2)+'\n');}
 if(!process.exitCode)for(const file of fs.readdirSync(output))if(file.startsWith('failure-')&&file.endsWith('.png'))fs.unlinkSync(path.join(output,file));
 console.log(`${results.length} obstacle mobile browser checks passed in ${browserName}. Physical iPhone was not tested.`);
})();
