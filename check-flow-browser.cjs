/* Normal index/app acceptance: source-connected terrain flow in isolated development mode.
 * No lab host, completed-level fixtures, private engine hooks, or campaign writes. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.join(__dirname,'dist'),browserName=process.env.HEXROTA_BROWSER||'chromium';
assert(['chromium','webkit'].includes(browserName));
const output=process.env.HEXROTA_FLOW_SCREENSHOT_DIR||path.join(__dirname,'reports','flow-9-12',browserName);fs.mkdirSync(output,{recursive:true});
const protectedKeys=['hexrota-profile-v2','hexrota-match-v5','hexrota-lives-v1','hexrota-events-v1','hexrota-playtest-v1'];
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let file;try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));}catch(_){res.writeHead(400).end();return;}if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(data);});});
const results=[],errors=[],measurements=[];let browser,url,active,current='opening';
async function check(name,run){current=name;await run();results.push(name);console.log('PASS '+browserName+' '+name);}
async function open(size={width:390,height:844},motion='reduce'){
 const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:motion,serviceWorkers:'block'});
 await context.addInitScript(({protectedKeys})=>{
  if(!sessionStorage.getItem('flow-test-sentinels')){for(const key of protectedKeys)localStorage.setItem(key,'sentinel:'+key);sessionStorage.setItem('flow-test-sentinels','1');}
  const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
  window.__flowRawGet=key=>get.call(localStorage,key);window.__flowIO={reads:[],writes:[],removes:[]};
  Storage.prototype.getItem=function(key){if(this===localStorage)window.__flowIO.reads.push(key);return get.call(this,key);};
  Storage.prototype.setItem=function(key,value){if(this===localStorage)window.__flowIO.writes.push({key,value});return set.call(this,key,value);};
  Storage.prototype.removeItem=function(key){if(this===localStorage)window.__flowIO.removes.push(key);return remove.call(this,key);};
  let presenter;
  Object.defineProperty(window,'HexMovePresentation',{configurable:true,get(){return presenter;},set(api){presenter=Object.freeze({...api,play(options){const phases=[];window.__flowPresentation={phases,plan:options.plan};return api.play({...options,onPhase(event){options.onPhase?.(event);phases.push({phase:event.phase,wave:event.wave,canonical:window.__flowRawGet('hexrota-flow-9-12:hexrota-profile-v2')});}});}});}});
 },{protectedKeys});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>['home','journey'].includes(document.body.dataset.screen)&&Array.isArray(window.HEX_CAMPAIGN_FLOW_LEVELS),null,{timeout:20000});
 const cdp=browserName==='chromium'?await context.newCDPSession(page):null;active={context,page,cdp};return active;
}
async function close(){if(active){await active.context.close();active=null;}}
async function profile(page){return page.evaluate(()=>{for(const key of Object.keys(localStorage)){if(key==='hexrota-profile-v2')continue;try{const value=JSON.parse(window.__flowRawGet(key));if(value?.schemaVersion===2&&value.game&&value.energy)return {key,value};}catch(_){}}throw Error('isolated development profile missing');});}
async function snapshot(page){const p=(await profile(page)).value;return p.game.boards[p.game.current];}
async function flowLevel(page){return page.evaluate(()=>JSON.parse(JSON.stringify(HEX_CAMPAIGN_FLOW_LEVELS.find(level=>level.id===6))));}
const idle=page=>page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='false',null,{timeout:25000});
async function journey(page){if(await page.locator('#game-home').isVisible())await page.locator('#game-home').tap();await page.locator('[data-nav="journey"]:visible').first().tap();await page.waitForFunction(()=>document.body.dataset.screen==='journey');}
async function enter(page,stage=7){await journey(page);await page.locator(`#journey-map [data-stage="${stage}"]`).tap();await page.waitForFunction(()=>document.getElementById('pregame-dialog').open);await page.locator('#pregame-start').tap();await page.waitForFunction(()=>document.body.dataset.screen==='game');await idle(page);}
async function resume(page){if(await page.locator('#journey-screen').isVisible()){await enter(page,7);return;}await page.locator('#home-play').tap();if(await page.locator('#pregame-dialog').evaluate(node=>node.open))await page.locator('#pregame-start').tap();await page.waitForFunction(()=>document.body.dataset.screen==='game');await idle(page);}
async function points(page,pair){return page.evaluate(pair=>{const board=document.getElementById('board'),matrix=board.getScreenCTM();return pair.map(index=>{const tile=board.querySelector(`[data-index="${index}"]`);if(!tile)throw Error('missing cell '+index);const local=tile.transform.baseVal.consolidate().matrix,p=board.createSVGPoint();p.x=local.e;p.y=local.f;const screen=p.matrixTransform(matrix);return {x:screen.x,y:screen.y};});},pair);}
async function tapPair(page,pair){for(const p of await points(page,pair))await page.touchscreen.tap(p.x,p.y);await idle(page);}
async function dragPair(f,pair){const [a,b]=await points(f.page,pair);if(f.cdp){await f.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});for(let i=1;i<=5;i++)await f.cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/5,y:a.y+(b.y-a.y)*i/5,id:1}]});await f.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await f.page.mouse.move(a.x,a.y);await f.page.mouse.down();await f.page.mouse.move(b.x,b.y,{steps:5});await f.page.mouse.up();}await idle(f.page);}
async function expected(page,route){return page.evaluate(({route})=>{const p=Object.keys(localStorage).filter(k=>k!=='hexrota-profile-v2').map(k=>{try{return JSON.parse(window.__flowRawGet(k));}catch(_){return null;}}).find(p=>p?.schemaVersion===2&&p.game&&p.energy),level=HEX_CAMPAIGN_FLOW_LEVELS.find(l=>l.id===6),game=new HexMatch(level,p.game.boards[p.game.current]),swaps=route.map(pair=>game.swap(...pair));return {snapshot:game.snapshot(),status:game.status,swaps};},{route});}
async function rendered(page){const s=await snapshot(page),l=await flowLevel(page);for(let i=0;i<s.blockerHp.length;i++)if(s.blockerHp[i]>0){const tile=page.locator(`#board [data-index="${l.obstacles.blockers[i].cell}"]`);assert.equal(await tile.locator('.blocker-visual').isVisible(),true,'live crate is visibly rendered');assert.equal(await tile.locator('.region-cover').count(),0,'covered terrain cannot paint over a live crate');}
 const painted=await page.locator('#board [data-index]').evaluateAll(nodes=>nodes.map(tile=>{const text=tile.querySelector('.hex-number')?.textContent.trim();return text?Number(text):null;}));assert.deepEqual(painted,s.values,'normal board paint equals saved engine values including covered cells');assert.equal(Number(await page.locator('#sum').textContent()),s.score);assert.equal(Number(await page.locator('#moves-left').textContent()),s.movesLeft);}
async function isolated(page){const io=await page.evaluate(()=>window.__flowIO);for(const key of protectedKeys){assert(!io.reads.includes(key),'normal campaign key is not read: '+key);assert(!io.writes.some(row=>row.key===key),'normal campaign key is not written: '+key);assert(!io.removes.includes(key),'normal campaign key is not removed: '+key);assert.equal(await page.evaluate(key=>window.__flowRawGet(key),key),'sentinel:'+key);}}
async function screenshot(page,name){await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}/?dev=flow-9-12`;
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 try{
  browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...(executable?{executablePath:executable}:{}),...(browserName==='chromium'?{args:['--no-sandbox']}:{})});
  await check('all ten normal campaign levels enter from empty isolated profile without fabricated wins',async()=>{
   const f=await open();await journey(f.page);assert.equal(await f.page.locator('#journey-map [data-stage]').count(),12,'two tutorials and all ten levels are visible');
   for(let stage=2;stage<12;stage++){
    if(stage!==2)await journey(f.page);
    const node=f.page.locator(`#journey-map [data-stage="${stage}"]`);assert.equal(await node.isEnabled(),true,'level '+(stage-1)+' selectable');await node.tap();await f.page.locator('#pregame-start').tap();await f.page.waitForFunction(()=>document.body.dataset.screen==='game');await idle(f.page);
    const p=(await profile(f.page)).value;assert.equal(p.game.current,stage);assert.equal(p.game.boards[stage].turn,0);assert.equal(p.game.boards[stage].rulesVersion,stage===7?'classic-v5':'classic-v4');assert.deepEqual(p.game.done,[],'no completed progress inserted');
   }
   await isolated(f.page);await close();
  });
  for(const [width,height]of [[320,568],[390,844],[430,932]])await check(`${width}x${height} normal level6 partial source flow, new-area moves and exact reload`,async()=>{
   const f=await open({width,height});await enter(f.page);const level=await flowLevel(f.page),initial=await snapshot(f.page),route=level.solutions?.[0]||level.solution;assert(route?.length>=2,'flow continuation route authored');assert(initial.cellOpen.some(v=>!v),'covered lower cells begin closed');
   assert.equal(new URL(f.page.url()).pathname,'/','normal index owns the game');assert.equal(await f.page.locator('#lab-message').count(),0,'lab host is not loaded');
   await rendered(f.page);const initialClosed=initial.cellOpen.map((open,i)=>open?null:i).filter(i=>i!==null),boxes=level.obstacles.blockers.map(b=>b.cell);
   for(const index of [...new Set([...initialClosed,...boxes])]){const [p]=await points(f.page,[index]);await f.page.touchscreen.tap(p.x,p.y);}assert.deepEqual(await snapshot(f.page),initial,'covered terrain and boxes reject touches');
   const sealedEdge=await f.page.evaluate(()=>{const level=HEX_CAMPAIGN_FLOW_LEVELS.find(l=>l.id===6),game=new HexMatch(level);return game.topology.pairs.find(([a,b])=>game.isPlayable(a)&&!game.isPlayable(b))||game.topology.pairs.find(([a,b])=>!game.isPlayable(a)&&game.isPlayable(b))?.slice().reverse();});
   assert(sealedEdge,'initial active-to-covered edge exists');await dragPair(f,sealedEdge);assert.deepEqual(await snapshot(f.page),initial,'drag into a box or covered cell cannot consume a move');
   const layout=await f.page.evaluate(()=>{const svg=document.getElementById('board'),box=svg.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,board:box.toJSON(),cells:[...svg.querySelectorAll('[data-index]')].map(tile=>{const m=tile.transform.baseVal.consolidate().matrix,p=svg.createSVGPoint();p.x=m.e;p.y=m.f;const q=p.matrixTransform(svg.getScreenCTM());return {index:Number(tile.dataset.index),reachable:document.elementFromPoint(q.x,q.y)?.closest('[data-index]')===tile};})};});assert.equal(layout.overflow,false);assert(layout.cells.every(c=>c.reachable),'all tile centers reachable at mobile size');measurements.push({width,height,...layout});await screenshot(f.page,`${width}-level6-initial`);
   let partial=false,playedNewArea=false,newAreaShown=false,openingTurn=-1;
   for(let turn=0;turn<route.length;turn++){
    const before=await snapshot(f.page),proof=await expected(f.page,[route[turn]]);assert(proof.swaps[0].ok,'authored normal input valid');if(route[turn].some(i=>!initial.cellOpen[i]))playedNewArea=true;
    if(turn===0)await dragPair(f,route[turn]);else await tapPair(f.page,route[turn]);assert.deepEqual(await snapshot(f.page),proof.snapshot,'normal input exact HP/terrain/RNG/history result');await rendered(f.page);
    const opened=proof.snapshot.cellOpen.map((v,i)=>v&&!before.cellOpen[i]?i:null).filter(i=>i!==null);
    if(opened.length&&openingTurn<0){openingTurn=turn;partial=proof.snapshot.cellOpen.some(v=>!v);assert(partial,'first source connection opens only part of lower area');await screenshot(f.page,`${width}-level6-partial-flow`);const durable=await snapshot(f.page);await f.page.reload();await f.page.waitForFunction(()=>['home','journey'].includes(document.body.dataset.screen));await resume(f.page);assert.deepEqual(await snapshot(f.page),durable,'reload resumes exact partial geometry, box HP and RNG');await rendered(f.page);}
    if(playedNewArea&&!newAreaShown){await screenshot(f.page,`${width}-level6-new-area-play`);newAreaShown=true;}
   }
   assert(openingTurn>=0&&partial,'source column flowed into a partial new area');assert(playedNewArea,'player continues with a swap touching formerly covered terrain');assert.equal((await expected(f.page,[])).status,'won','full seven-move normal game route wins');await f.page.waitForFunction(()=>document.getElementById('win-dialog').open);await isolated(f.page);await close();
  });
  await check('normal move presentation sequences blocker and partial-terrain opening after durable commit',async()=>{
   const f=await open({width:390,height:844},'no-preference');await enter(f.page);const level=await flowLevel(f.page),route=level.solutions?.[0]||level.solution,proof=await expected(f.page,[route[0]]),writesBefore=await f.page.evaluate(()=>window.__flowIO.writes.filter(row=>row.key==='hexrota-flow-9-12:hexrota-profile-v2').length);await tapPair(f.page,route[0]);assert.deepEqual(await snapshot(f.page),proof.snapshot);await rendered(f.page);
   const observed=await f.page.evaluate(()=>window.__flowPresentation);const durable=(await profile(f.page)).value;for(const phase of observed.phases)assert.deepEqual(JSON.parse(phase.canonical).game.boards[7],proof.snapshot,'every visual phase reads the already committed result');assert.equal(await f.page.evaluate(()=>window.__flowIO.writes.filter(row=>row.key==='hexrota-flow-9-12:hexrota-profile-v2').length),writesBefore+1,'normal valid move commits canonical profile once');assert(observed,'shared presentation coordinator runs in normal app');const phases=observed.phases.map(p=>p.phase);assert(phases.includes('BLOCKER_HIT'),'normal app presents box damage');if(proof.swaps[0].frames.some(f=>f.brokenBlockers.length))assert(phases.includes('BLOCKER_BREAK'));if(proof.swaps[0].frames.some(f=>f.openedCells?.length))assert(phases.includes('REGION_UNLOCK'),'normal app presents actual newly opened cells');await isolated(f.page);await close();
  });
  await check('real v5 loss survives reload and explicit new attempts and retry restore a playable board',async()=>{
   const f=await open({width:390,height:844});await enter(f.page);
   // Discovered by deterministic legal play on this authored L6 configuration;
   // no scores, moves, terrain, histories or completion flags are injected.
   const losingRoute=[[3,6],[19,22],[16,20],[6,9],[1,5],[20,19],[7,12],[20,19]],initial=(await profile(f.page)).value;
   async function lose(){for(const pair of losingRoute){const proof=await expected(f.page,[pair]);assert(proof.swaps[0].ok);await tapPair(f.page,pair);assert.deepEqual(await snapshot(f.page),proof.snapshot);}await f.page.waitForFunction(()=>document.getElementById('lose-dialog').open);assert.equal((await expected(f.page,[])).status,'lost');assert.equal((await snapshot(f.page)).movesLeft,0);assert.equal(await f.page.locator('#second-chance-panel').isVisible(),false,'classic-v5 has no unsupported assisted rescue offer');await rendered(f.page);}
   await lose();const lost=await snapshot(f.page),lostAttempt=(await profile(f.page)).value.game.attempts[7];await screenshot(f.page,'390-level6-loss');
   await f.page.reload();await f.page.waitForFunction(()=>['home','journey'].includes(document.body.dataset.screen));assert.deepEqual(await snapshot(f.page),lost,'reload preserves the real losing snapshot');assert.equal((await expected(f.page,[])).status,'lost','reloaded loss is replay-valid');
   // Choosing the level and pressing the existing Start button is explicit;
   // reload itself has not discarded the loss or changed its attempt identity.
   assert.equal((await profile(f.page)).value.game.attempts[7].attemptId,lostAttempt.attemptId);await enter(f.page);
   let next=(await profile(f.page)).value;assert.notEqual(next.game.attempts[7].attemptId,lostAttempt.attemptId);assert(next.game.attempts[7].attemptSerial>lostAttempt.attemptSerial);assert.equal(next.game.boards[7].turn,0);assert.equal((await expected(f.page,[])).status,'playing');assert.deepEqual(next.game.done,initial.game.done,'a loss does not fabricate campaign completion');
   await lose();const retryAttempt=(await profile(f.page)).value.game.attempts[7];await f.page.locator('#retry').tap();await idle(f.page);next=(await profile(f.page)).value;assert.notEqual(next.game.attempts[7].attemptId,retryAttempt.attemptId,'native Retry starts a new attempt');assert.equal(next.game.boards[7].turn,0);assert.equal(next.game.boards[7].score,0);assert.equal((await expected(f.page,[])).status,'playing');assert.equal(await f.page.locator('#lose-dialog').evaluate(node=>node.open),false);await rendered(f.page);await isolated(f.page);await close();
  });
  assert.deepEqual(errors,[],'no browser errors');
 }catch(error){console.error(error.stack);process.exitCode=1;if(active)await screenshot(active.page,'failure-'+current.replace(/[^a-z0-9]+/gi,'-').slice(0,80)).catch(()=>{});}
 finally{await close();await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({browser:browserName,checks:results.length,results,measurements,errors,physicalIPhone:false},null,2)+'\n');}
 if(!process.exitCode)for(const file of fs.readdirSync(output))if(file.startsWith('failure-'))fs.unlinkSync(path.join(output,file));console.log(`${results.length} normal flow browser checks passed in ${browserName}; physical iPhone not tested.`);
})();
