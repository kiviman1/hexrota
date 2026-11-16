/* Actual browser acceptance for the read-only move presentation pipeline.
 * Public presentation APIs are observed; domain commands are never replaced. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright'),{PNG}=require('pngjs');
const {fresh,existing,lifePool,NOW}=require('./check-lives-ui.cjs');
const {beforeWin}=require('./check-progression-ui.cjs');
const root=path.join(__dirname,'dist'),PROFILE='hexrota-profile-v2',EVENTS='hexrota-events-v1';
const browserName=process.env.HEXROTA_BROWSER||'chromium';assert(['chromium','webkit'].includes(browserName));
const output=process.env.HEXROTA_PIPELINE_SCREENSHOT_DIR||path.join(__dirname,'test-results','animation-pipeline-'+browserName);fs.mkdirSync(output,{recursive:true});
const viewports=[[320,568],[390,844],[430,932],[844,390],[932,430],[1280,720]],results=[],measurements=[],errors=[];
const plain=value=>JSON.parse(JSON.stringify(value)),board=p=>p.game.boards[p.game.current],attempt=p=>p.game.attempts[p.game.current];
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let file;try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));}catch(_){res.writeHead(400).end();return;}if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(data);});});
let browser,url,failure,current='opening';
async function check(name,run){if(process.env.HEXROTA_PIPELINE_ONLY&&!name.includes(process.env.HEXROTA_PIPELINE_ONLY))return;current=name;await run();results.push(name);console.log('PASS '+browserName+' '+name);}
const profile=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROFILE);
const canonical=page=>page.evaluate(key=>localStorage.getItem(key),PROFILE);
const eventRows=async page=>JSON.parse(await page.evaluate(key=>localStorage.getItem(key)||'{"events":[]}',EVENTS)).events;
function fixture(kind){
 for(let turns=0;turns<10;turns++){
  const f=existing(2,{turns});if(f.game.status!=='playing')continue;
  for(const pair of f.game.legalMoves()){const model=f.game.clone(),result=model.swap(...pair);if(result.ok&&model.status==='playing'&&(kind==='one'?result.frames.length===1:result.frames.length>=3))return {saved:f.saved,pair:plain(pair),expected:plain(model.snapshot()),result:plain(result)};}
 }
 assert.fail('a real '+kind+' wave production fixture exists');
}
function beforeLoss(){
 const f=existing(2,{lost:true}),route=plain(f.game.history),playing=existing(2,{turns:0});
 for(const pair of route.slice(0,-1))assert(playing.game.swap(...pair).ok);
 playing.saved.boards[2]=plain(playing.game.snapshot());playing.saved.attemptStats[2].cascades=0;
 const model=playing.game.clone(),pair=route.at(-1),result=model.swap(...pair);assert.equal(model.status,'lost');
 return {saved:playing.saved,pair,expected:plain(model.snapshot()),result:plain(result)};
}
async function open({saved=fixture('one').saved,size={width:390,height:844},motion='full',routes}={}){
 const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:motion==='reduce'?'reduce':'no-preference',serviceWorkers:'block'});
 await context.addInitScript(({saved,motion,energy,now})=>{
  if(location.protocol!=='http:')return;Date.now=()=>now;
  if(!localStorage.getItem('hexrota-profile-v2')&&!localStorage.getItem('hexrota-match-v5')){if(saved){saved.preferences={...saved.preferences,motion};localStorage.setItem('hexrota-match-v5',JSON.stringify(saved));}localStorage.setItem('hexrota-lives-v1',JSON.stringify(energy));}
  const log={calls:[],writes:[],writeFault:0,armed:false,animations:[],fault:null,faults:0},copy=v=>JSON.parse(JSON.stringify(v));window.__pipeline=log;
  const nativeSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(key==='hexrota-profile-v2'&&log.armed){const row={value,failed:false};log.writes.push(row);if(log.writeFault===log.writes.length){row.failed=true;throw new DOMException('pipeline canonical fault','QuotaExceededError');}}return nativeSet.call(this,key,value);};
  const nativeAnimate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
   const tile=this.closest('[data-index]'),moving=this.closest('.swap-stone'),row={at:performance.now(),className:this.getAttribute('class')||'',index:tile?Number(tile.dataset.index):null,source:moving?Number(moving.dataset.swapSource):null,target:moving?Number(moving.dataset.swapTarget):null,frames:copy(frames),options:copy(options||{})};log.animations.push(row);
   if(log.fault&&!log.faults&&this.closest('.swap-layer')){
    log.faults++;if(log.fault==='throw')throw Error('pipeline test Animation API throw');
    const animation=nativeAnimate.call(this,frames,options),rejection=Promise.reject(new Error('pipeline test Animation.finished rejection'));
    return new Proxy(animation,{get(target,key){if(key==='finished')return rejection;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
   }
   return nativeAnimate.call(this,frames,options);
  };
  let api;
  Object.defineProperty(window,'HexMovePresentation',{configurable:true,get:()=>api,set(value){
   api=Object.freeze({...value,play(input){
    const call={input,plan:input.plan,attemptId:input.attemptId,token:input.token,phases:[],hostOnPhase:input.onPhase,done:false,delivered:false,result:null,identity:new WeakMap(),nextIdentity:0};log.calls.push(call);
    const nodeId=node=>{if(!node)return null;if(!call.identity.has(node))call.identity.set(node,++call.nextIdentity);return call.identity.get(node);};
    const project=()=>{const b=document.getElementById('board');return {values:[...b.querySelectorAll('.hex-tile > .gem .hex-number')].map(n=>Number(n.textContent)),gems:[...b.querySelectorAll('.hex-tile')].map(n=>({index:Number(n.dataset.index),value:Number(n.querySelector('.hex-number')?.textContent),node:nodeId(n.querySelector(':scope > .gem'))})),box:b.getBoundingClientRect().toJSON(),phase:b.dataset.presentationPhase||null,wave:b.dataset.presentationWave||null,swapCount:b.querySelectorAll('.swap-stone').length};};
    const observed={...input,onPhase(event){
     const entry={event:copy(event),eventFrozen:Object.isFrozen(event),canonical:localStorage.getItem('hexrota-profile-v2'),at:performance.now(),before:project(),after:null};call.phases.push(entry);
     input.onPhase?.(event);queueMicrotask(()=>{entry.after=project();});
    }};
    const promise=value.play(observed);call.promise=promise;
    return Promise.resolve(promise).then(result=>{call.done=true;call.result=copy(result);if(log.holdResults)return new Promise(resolve=>{call.release=()=>{call.delivered=true;resolve(result);};});call.delivered=true;return result;},error=>{call.done=true;call.thrown=String(error);throw error;});
   }});
  }});
 },{saved,motion,energy:lifePool(5),now:NOW});
 if(routes)await routes(context);
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.screen==='home');
 return {context,page,close:async()=>{if(!measurements.some(row=>row.name===current))try{measurements.push({name:current,diagnostic:true,...await observations(page)});}catch(_){}await page.screenshot({path:path.join(output,'last-'+current.replace(/[^a-z0-9]+/gi,'-').slice(0,90)+'.png'),animations:'allow',timeout:5000}).catch(()=>{});await context.close();}};
}
async function enter(page){await page.locator('#home-play').tap();if(await page.locator('#pregame-dialog').evaluate(node=>node.open))await page.locator('#pregame-start').tap();await page.waitForFunction(()=>document.body.dataset.screen==='game');await page.locator('#board').evaluate(async board=>{const jobs=[];for(let n=board;n;n=n.parentElement)for(const a of n.getAnimations())if(a.effect?.target===n&&a.playState==='running'&&a.effect.getTiming().iterations!==Infinity)jobs.push(a.finished.catch(()=>{}));await Promise.all(jobs);});}
async function points(page,pair){const out=[];for(const index of pair){const box=await page.locator(`#board [data-index="${index}"] .floor-shape`).boundingBox();assert(box);out.push({x:box.x+box.width/2,y:box.y+box.height/2});}return out;}
async function touch(page,pair){const positions=await points(page,pair);for(const point of positions)await page.touchscreen.tap(point.x,point.y);return positions;}
async function arm(page,{writeFault=2,fault=null}={}){await page.evaluate(({writeFault,fault})=>{window.__pipeline.writes=[];window.__pipeline.armed=true;window.__pipeline.writeFault=writeFault;window.__pipeline.fault=fault;},{writeFault,fault});}
async function segment(page){await page.evaluate(()=>{window.__pipeline.writes=[];window.__pipeline.writeFault=0;});}
async function busy(page){await page.waitForFunction(()=>document.getElementById('board').getAttribute('aria-busy')==='true');}
async function idle(page){await page.waitForFunction(()=>document.getElementById('board').getAttribute('aria-busy')==='false',null,{timeout:20000});}
async function callDone(page){await page.waitForFunction(()=>window.__pipeline.calls.at(-1)?.done,null,{timeout:20000});}
async function engineStatus(page){return page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('hexrota-profile-v2')),m=p.game.attempts[p.game.current],level=HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(m.levelId,m.variantId,m.levelDataVersion);return new HexMatch(level,p.game.boards[p.game.current]).status;});}
async function observations(page){return page.evaluate(()=>({writes:window.__pipeline.writes,faults:window.__pipeline.faults,animations:window.__pipeline.animations,calls:window.__pipeline.calls.map(c=>({attemptId:c.attemptId,token:c.token,plan:c.plan,planFrozen:Object.isFrozen(c.plan),wavesFrozen:Object.isFrozen(c.plan.waves),phases:c.phases,result:c.result,done:c.done,delivered:c.delivered,thrown:c.thrown||null}))}));}
async function geometry(page){return page.evaluate(()=>({board:document.getElementById('board').getBoundingClientRect().toJSON(),hud:document.querySelector('.scoreboard').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth}));}
async function layout(page){return page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('hexrota-profile-v2')),m=p.game.attempts[p.game.current],level=HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(m.levelId,m.variantId,m.levelDataVersion);return {cells:level.cells,...HexBoardView.geometry(level,false)};});}
function stable(a,b,label){assert.equal(b.overflow,false,label+' no horizontal overflow');for(const region of ['board','hud'])for(const key of ['width','height'])assert.equal(b[region][key],a[region][key],label+' exact '+region+' '+key);}
async function clean(page){assert.equal(await page.locator('#board').getAttribute('aria-busy'),'false');assert.equal(await page.locator('#board-stage').evaluate(n=>n.classList.contains('busy')),false);assert.equal(await page.locator('.swap-pair,.swap-layer .swap-stone,.score-packet').count(),0);assert.equal(await page.locator('#reset').isEnabled(),true);const committed=board(await profile(page));if(committed){assert.deepEqual(await page.locator('#board .hex-tile > .gem .hex-number').evaluateAll(nodes=>nodes.map(n=>Number(n.textContent))),committed.values,'final painted numbers agree with the authoritative snapshot');assert.equal(await page.locator('#sum').textContent(),String(committed.score),'HUD settles on the committed score');assert.equal(await page.locator('#moves-left').textContent(),String(committed.movesLeft));}}
function singleWrite(observation){assert.equal(observation.writes.length,1,'the command has one canonical write including full animation completion');assert.equal(observation.writes[0].failed,false);}
function phaseNames(call){return call.phases.map(p=>[p.event.phase,p.event.wave]);}
function expectedPhases(waves){const phases=[['SWAP',null]];for(let wave=1;wave<=waves;wave++){if(wave>1)phases.push(['CASCADE',wave]);for(const phase of ['MATCH','CLEAR','FALL','REFILL'])phases.push([phase,wave]);}phases.push(['SETTLE',null]);return phases;}
function verifyResolved(call,expected,committed){
 assert.equal(call.planFrozen,true);assert.equal(call.wavesFrozen,true);assert.equal(call.attemptId,attempt(committed).attemptId);
 for(const field of ['values','layers','score','movesLeft'])assert.deepEqual(call.plan.final[field],board(committed)[field],'final visual projection '+field+' is derived from the committed command');
 assert.deepEqual(call.plan.waves.map(w=>w.frame),expected.frames,'presentation uses every actual resolved engine frame in the original order');
 assert.deepEqual(phaseNames(call),expectedPhases(expected.frames.length),'each actual engine wave is visibly sequenced');
 for(const phase of call.phases){assert.equal(phase.eventFrozen,true);assert.equal(phase.event.attemptId,call.attemptId);assert.deepEqual(phase.event.token,call.token);assert.equal(phase.canonical,JSON.stringify(committed),'phase callbacks cannot rewrite any authoritative domain');}
 assert.equal(call.result.status,'succeeded');assert.equal(call.result.wavesPresented,expected.frames.length);
}
function verifyIdentity(call){
 if(call.plan.swap){
  const start=call.phases.find(p=>p.event.phase==='SWAP').after,matched=call.phases.find(p=>p.event.phase==='MATCH').after;
  assert.equal(start.swapCount,2,'both reciprocal top-layer stones exist during SWAP');
  for(const [from,to]of [call.plan.swap,[...call.plan.swap].reverse()])assert.equal(matched.gems.find(g=>g.index===to).node,start.gems.find(g=>g.index===from).node,'swap preserves the real source gem identity into MATCH');
 }
 for(const wave of call.plan.waves){
  const number=wave.wave,clear=call.phases.find(p=>p.event.phase==='CLEAR'&&p.event.wave===number),fall=call.phases.find(p=>p.event.phase==='FALL'&&p.event.wave===number);
  assert(clear?.after&&fall?.after,'wave has observable pre-clear and post-fall projections');
  const before=new Map(clear.after.gems.map(g=>[g.index,g])),after=new Map(fall.after.gems.map(g=>[g.index,g]));
  for(const entry of wave.frame.falls.filter(f=>!f.spawn)){
   assert.equal(after.get(entry.to)?.node,before.get(entry.from)?.node,'a real surviving gem retains node identity '+entry.from+'→'+entry.to);
   assert.equal(after.get(entry.to)?.value,entry.value,'real surviving number reaches its engine destination');
  }
 }
 const last=call.plan.waves.at(-1),settle=call.phases.find(p=>p.event.phase==='SETTLE');
 if(last&&JSON.stringify(last.after.values)===JSON.stringify(call.plan.final.values)){
  const refill=call.phases.find(p=>p.event.phase==='REFILL'&&p.event.wave===last.wave);
  assert.deepEqual(settle.after.gems,refill.after.gems,'SETTLE retains the final surviving/refilled gem identities');
 }
}
function verifyTrajectories(call,animations,layout){
 for(const wave of call.plan.waves){
  const start=call.phases.find(p=>p.event.phase==='FALL'&&p.event.wave===wave.wave).at,next=call.phases.find(p=>(p.event.phase==='CASCADE'&&p.event.wave===wave.wave+1)||p.event.phase==='SETTLE').at;
  const actual=animations.filter(a=>a.at>=start&&a.at<next&&a.className==='gem'&&String(a.frames[0]?.transform||'').startsWith('translate('));
  assert.equal(actual.length,wave.frame.falls.length,'all and only engine-provided falls/spawns animate once');
  for(const fall of wave.frame.falls){
   const record=actual.find(a=>a.index===fall.to);assert(record,'an engine destination has a real gem animation');
   const to=layout.positions[fall.to],cell=layout.cells[fall.to],column=layout.cells.map((c,i)=>({c,i})).filter(x=>x.c.q===cell.q).sort((a,b)=>a.c.r-b.c.r);
   const from=fall.spawn?{x:to.x,y:layout.positions[column[0].i].y-Math.sqrt(3)*44*(fall.spawnCount-fall.spawnOrder)}:layout.positions[fall.from];
   const offset=record.frames[0].transform.match(/translate\(([-\d.e+]+)px,([-\d.e+]+)px\)/);assert(offset,'actual fall uses SVG-coordinate displacement');
   assert(Math.abs(Number(offset[1])-(from.x-to.x))<.001,'fall horizontal path uses actual source and destination');assert(Math.abs(Number(offset[2])-(from.y-to.y))<.001,'fall vertical path uses actual source and destination');
   assert.equal(record.frames[0].opacity,fall.spawn?0:1,'refill and surviving fall remain visually distinct');assert.equal(record.options.duration,wave.motion.fall);
  }
 }
}
async function screenshot(page,name){const bytes=await page.screenshot({path:path.join(output,name+'.png'),animations:'allow'}),png=PNG.sync.read(bytes),colors=new Set();for(let i=0;i<png.data.length;i+=4*31)colors.add(png.data[i]+','+png.data[i+1]+','+png.data[i+2]);assert(colors.size>20,'screenshot contains actual rendered content');}
function domainEqual(a,b,label){assert.deepEqual(b.game,a.game,label+' game');assert.deepEqual(b.energy,a.energy,label+' lives');}

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port+'/';
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...executable?{executablePath:executable}:{},...browserName==='chromium'?{args:['--no-sandbox']}:{}});
 for(const [width,height]of viewports)await check(width+'×'+height+' native one-wave command retains exact board/HUD geometry and one write',async()=>{
  const target=fixture('one'),f=await open({saved:target.saved,size:{width,height}});try{
   await enter(f.page);const before=await profile(f.page),g=await geometry(f.page),coordinates=await layout(f.page);await arm(f.page);await touch(f.page,target.pair);await busy(f.page);const committed=await profile(f.page);assert.deepEqual(board(committed),target.expected);stable(g,await geometry(f.page),'pending');
   await idle(f.page);await callDone(f.page);const obs=await observations(f.page);singleWrite(obs);assert.equal(committed.revision,before.revision+1);assert.equal(await canonical(f.page),obs.writes[0].value);verifyResolved(obs.calls[0],target.result,committed);verifyIdentity(obs.calls[0]);verifyTrajectories(obs.calls[0],obs.animations,coordinates);stable(g,await geometry(f.page),'settled');await clean(f.page);await screenshot(f.page,'one-wave-'+width+'x'+height);measurements.push({name:current,viewport:{width,height},geometry:g,...obs});
  }finally{await f.close();}
 });
 await check('five-wave cascade presents every real frame with surviving gem identities and trajectories',async()=>{
  const target=fixture('multi'),f=await open({saved:target.saved});try{
   await enter(f.page);const before=await profile(f.page),g=await geometry(f.page),coordinates=await layout(f.page);await arm(f.page);await touch(f.page,target.pair);await busy(f.page);const committed=await profile(f.page);assert.deepEqual(board(committed),target.expected);await screenshot(f.page,'multi-wave-pending');
   await idle(f.page);await callDone(f.page);const obs=await observations(f.page);singleWrite(obs);verifyResolved(obs.calls[0],target.result,committed);verifyIdentity(obs.calls[0]);verifyTrajectories(obs.calls[0],obs.animations,coordinates);assert.deepEqual(await profile(f.page),committed);assert.equal(committed.revision,before.revision+1);stable(g,await geometry(f.page),'full cascade');await clean(f.page);await screenshot(f.page,'multi-wave-settled');measurements.push({name:current,actualWaves:target.result.frames.length,...obs});
  }finally{await f.close();}
 });
 await check('invalid adjacent swap changes no board RNG turn reward or profile and leaves no valid pipeline',async()=>{
  const target=fixture('one'),f=await open({saved:target.saved});try{await enter(f.page);const before=await canonical(f.page),pair=await f.page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('hexrota-profile-v2')),m=p.game.attempts[p.game.current],l=HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(m.levelId,m.variantId,m.levelDataVersion),g=new HexMatch(l,p.game.boards[p.game.current]);for(let a=0;a<g.total;a++)for(const b of g.neighbors[a])if(!g.clone().swap(a,b).ok)return[a,b];throw Error('no invalid adjacent production pair');});await arm(f.page);await touch(f.page,pair);await f.page.waitForFunction(()=>!document.querySelector('.swap-pair'));assert.equal(await canonical(f.page),before);const obs=await observations(f.page);assert.equal(obs.writes.length,0);assert.equal(obs.calls.length,0);await clean(f.page);measurements.push({name:current,pair,...obs});}finally{await f.close();}
 });
 await check('first authoritative commit failure preserves full rollback and never starts presentation',async()=>{
  const target=fixture('one'),f=await open({saved:target.saved});try{await enter(f.page);const bytes=await canonical(f.page),events=await eventRows(f.page);await arm(f.page,{writeFault:1});await touch(f.page,target.pair);await idle(f.page);const obs=await observations(f.page);assert.equal(obs.writes.length,1);assert.equal(obs.writes[0].failed,true);assert.equal(obs.calls.length,0);assert.equal(await canonical(f.page),bytes);assert.deepEqual(await eventRows(f.page),events);assert.equal(await f.page.locator('dialog[open]').count(),0);await clean(f.page);measurements.push({name:current,...obs});}finally{await f.close();}
 });
 for(const terminal of ['won','lost'])await check('actual '+terminal+' engine result is committed while visuals remain pending and opens one normal result',async()=>{
  const target=terminal==='lost'?beforeLoss():null,f=await open({saved:target?target.saved:beforeWin(1)});try{
   await enter(f.page);const before=await profile(f.page),pair=target?target.pair:await f.page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('hexrota-profile-v2')),m=p.game.attempts[p.game.current];return HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(m.levelId,m.variantId,m.levelDataVersion).solution.at(-1);});await arm(f.page);await touch(f.page,pair);await busy(f.page);const committed=await profile(f.page),id=attempt(committed).attemptId;assert.equal(await engineStatus(f.page),terminal);assert.equal(await f.page.locator(terminal==='won'?'#win-dialog':'#lose-dialog').evaluate(n=>n.open),false);await idle(f.page);await callDone(f.page);await f.page.locator((terminal==='won'?'#win-dialog':'#lose-dialog')+'[open]').waitFor();singleWrite(await observations(f.page));assert.deepEqual(await profile(f.page),committed);assert.equal((await eventRows(f.page)).filter(e=>e.name===(terminal==='won'?'level_completed':'level_failed')&&e.attemptId===id).length,1);assert.equal(committed.energy.life.lives,before.energy.life.lives-(terminal==='lost'?1:0));if(terminal==='won'){assert.equal(committed.game.economy.gold,before.game.economy.gold+20);assert.equal(committed.game.economy.stars,before.game.economy.stars+1);}await clean(f.page);await screenshot(f.page,terminal+'-normal-result');measurements.push({name:current,...await observations(f.page)});
  }finally{await f.close();}
 });
 for(const kind of ['one','multi'])await check('reduced motion settles '+kind+' wave command without optional stone effects',async()=>{
  const target=fixture(kind),f=await open({saved:target.saved,motion:'reduce'});try{await enter(f.page);await arm(f.page);const count=await f.page.evaluate(()=>window.__pipeline.animations.length);await touch(f.page,target.pair);await idle(f.page);const obs=await observations(f.page);singleWrite(obs);assert.deepEqual(board(await profile(f.page)),target.expected);assert.equal(obs.animations.length,count);await clean(f.page);measurements.push({name:current,...obs});}finally{await f.close();}
 });
 for(const phase of ['swap','cascade'])await check('rapid tap during '+phase+' reveals the committed result and cannot execute a second move',async()=>{
  const target=fixture('multi'),f=await open({saved:target.saved});try{await enter(f.page);const point=(await points(f.page,target.pair))[0];await arm(f.page);await touch(f.page,target.pair);await busy(f.page);if(phase==='cascade')await f.page.waitForFunction(()=>window.__pipeline.calls[0]?.phases.some(p=>p.event.phase==='CASCADE'&&p.event.wave===2));const committed=await profile(f.page);await f.page.touchscreen.tap(point.x,point.y);await f.page.touchscreen.tap(point.x,point.y);await idle(f.page);await callDone(f.page);singleWrite(await observations(f.page));assert.deepEqual(await profile(f.page),committed);assert.deepEqual(board(committed),target.expected);await clean(f.page);measurements.push({name:current,...await observations(f.page)});}finally{await f.close();}
 });
 for(const fault of ['throw','reject'])await check('Animation API '+fault+' releases controls without rollback duplicate write or unhandled failure',async()=>{
  const target=fixture('one'),f=await open({saved:target.saved});try{await enter(f.page);await arm(f.page,{fault});await touch(f.page,target.pair);await idle(f.page);await callDone(f.page);let obs=await observations(f.page);assert.equal(obs.faults,1);singleWrite(obs);assert.deepEqual(board(await profile(f.page)),target.expected);assert.doesNotMatch(await f.page.locator('#toast').textContent(),/kaydedilemedi|döndürüldü/);await clean(f.page);const next=await f.page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('hexrota-profile-v2')),m=p.game.attempts[p.game.current],l=HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(m.levelId,m.variantId,m.levelDataVersion),g=new HexMatch(l,p.game.boards[p.game.current]),pair=g.legalMoves()[0];g.swap(...pair);return {pair,expected:g.snapshot()};});await segment(f.page);await touch(f.page,next.pair);await idle(f.page);await callDone(f.page);singleWrite(await observations(f.page));assert.deepEqual(board(await profile(f.page)),next.expected);measurements.push({name:current,...obs});}finally{await f.close();}
 });
 for(const action of ['pause','home','hidden'])await check(action+' during a real later cascade retires visuals and keeps exact committed domains',async()=>{
  const target=fixture('multi'),f=await open({saved:target.saved});try{
   await enter(f.page);await arm(f.page);await touch(f.page,target.pair);await f.page.waitForFunction(()=>window.__pipeline.calls[0]?.phases.some(p=>p.event.phase==='CASCADE'&&p.event.wave===2));const committed=await profile(f.page);await segment(f.page);
   if(action==='hidden')await f.page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});else await f.page.locator(action==='home'?'#game-home':'#pause').tap();
   await idle(f.page);await callDone(f.page);domainEqual(committed,await profile(f.page),'interruption');const obs=await observations(f.page);assert.equal(obs.writes.length,1,'existing explicit navigation/pause authority remains one separate write');assert.equal(obs.writes[0].failed,false);await clean(f.page);
   if(action==='home'){assert.equal(await f.page.evaluate(()=>document.body.dataset.screen),'home');assert.equal(await f.page.locator('dialog[open]').count(),0);}else assert.equal(await f.page.locator('#pause-dialog').evaluate(n=>n.open),true);
   await screenshot(f.page,'cascade-'+action);measurements.push({name:current,...obs});
  }finally{await f.close();}
 });
 await check('late old-attempt phase and real completion cannot alter a new tutorial screen board actor or modal',async()=>{
  const target=fixture('multi'),f=await open({saved:target.saved});try{
   await enter(f.page);await arm(f.page);await f.page.evaluate(()=>window.__pipeline.holdResults=true);await touch(f.page,target.pair);await busy(f.page);await f.page.waitForFunction(()=>window.__pipeline.calls[0]?.done&&!window.__pipeline.calls[0].delivered);assert.equal(await f.page.locator('#board').getAttribute('aria-busy'),'true','actual settled coordinator result is still awaiting its delayed delivery');await f.page.locator('#game-home').tap();await f.page.locator('#home-screen [data-nav="journey"]').tap();await f.page.locator('[data-stage="0"]').tap();await f.page.locator('#pregame-start').tap();await f.page.waitForFunction(()=>document.body.dataset.screen==='game');const before=await canonical(f.page),state=await f.page.evaluate(()=>({phase:document.getElementById('board').dataset.presentationPhase||null,wave:document.getElementById('board').dataset.presentationWave||null,screen:document.body.dataset.screen,values:[...document.querySelectorAll('#board .hex-tile > .gem .hex-number')].map(n=>Number(n.textContent)),dialogs:[...document.querySelectorAll('dialog[open]')].map(n=>n.id),identity:JSON.parse(localStorage.getItem('hexrota-profile-v2')).game.attempts[0]}));assert.notEqual(state.identity.attemptId,(await observations(f.page)).calls[0].attemptId);
   await f.page.evaluate(()=>{const old=window.__pipeline.calls[0];old.hostOnPhase?.(Object.freeze({phase:'REFILL',wave:1,attemptId:old.attemptId,token:old.token}));old.release();});await f.page.waitForFunction(()=>window.__pipeline.calls[0].delivered);await f.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await canonical(f.page),before);assert.deepEqual(await f.page.evaluate(()=>({phase:document.getElementById('board').dataset.presentationPhase||null,wave:document.getElementById('board').dataset.presentationWave||null,screen:document.body.dataset.screen,values:[...document.querySelectorAll('#board .hex-tile > .gem .hex-number')].map(n=>Number(n.textContent)),dialogs:[...document.querySelectorAll('dialog[open]')].map(n=>n.id),identity:JSON.parse(localStorage.getItem('hexrota-profile-v2')).game.attempts[0]})),state);await clean(f.page);measurements.push({name:current,...await observations(f.page)});
  }finally{await f.close();}
 });
 await check('actual reload while WON and visually pending preserves the one clear reward event and won checkpoint',async()=>{
  const f=await open({saved:beforeWin(1)});try{await enter(f.page);const pair=await f.page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('hexrota-profile-v2')),m=p.game.attempts[p.game.current];return HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(m.levelId,m.variantId,m.levelDataVersion).solution.at(-1);});await arm(f.page,{writeFault:0});await f.page.evaluate(()=>window.addEventListener('pagehide',()=>sessionStorage.setItem('pipeline-last-writes',JSON.stringify(window.__pipeline.writes))));await touch(f.page,pair);await busy(f.page);const committed=await profile(f.page),index=committed.game.current,id=attempt(committed).attemptId,events=await eventRows(f.page),origin=await f.page.evaluate(()=>performance.timeOrigin);assert.equal(await engineStatus(f.page),'won');singleWrite(await observations(f.page));await f.page.reload({waitUntil:'domcontentloaded'});await f.page.waitForFunction(()=>document.body.dataset.screen==='home');assert.notEqual(await f.page.evaluate(()=>performance.timeOrigin),origin);const after=await profile(f.page),writes=await f.page.evaluate(()=>JSON.parse(sessionStorage.getItem('pipeline-last-writes')));assert.equal(writes.length,4,'one command and the three existing pagehide authorities');for(const row of writes.slice(1))domainEqual(committed,JSON.parse(row.value),'pagehide');assert.deepEqual(after.game,{...committed.game,current:3});assert.deepEqual(after.energy,committed.energy);assert.deepEqual(after.game.boards[index],committed.game.boards[index]);assert.equal(Object.values(after.game.economy.transactions).filter(t=>t.kind==='clear'&&t.attemptId===id).length,1);assert.deepEqual(await eventRows(f.page),events);assert.equal(await f.page.locator('dialog[open]').count(),0);await clean(f.page);measurements.push({name:current,pagehideWrites:writes.length,exactWonCheckpoint:true,attemptId:id});await screenshot(f.page,'actual-won-reload');}finally{await f.close();}
 });
 await check('tutorial portrait and coop lifecycle stay independent from all visual phases and late assets',async()=>{
  const f=await open({saved:null,motion:'reduce',routes:async context=>{await context.route('**/tavik/*.webp',route=>route.abort());}});try{
   await enter(f.page);const before=await profile(f.page),rect=await f.page.locator('#board').boundingBox();assert(Math.abs((await f.page.locator('#tutorial-coach').boundingBox()).height-118)<1);assert.equal(await f.page.locator('.hx-scene-actor-anchor').isVisible(),false);assert.equal(await f.page.locator('.hx-tavik-dialogue').isVisible(),true);const stages=[];
   for(const lesson of [0,1]){const route=await f.page.evaluate(i=>HEX_TUTORIALS[i].solution,lesson);for(const pair of route){if(await f.page.locator('#coach-next').isVisible())await f.page.locator('#coach-next').tap();await touch(f.page,pair);await idle(f.page);}await f.page.locator('#win-dialog[open]').waitFor();await f.page.waitForFunction(stage=>document.body.dataset.sceneStage===stage,lesson===0?'frame':'finished');stages.push(await f.page.evaluate(()=>document.body.dataset.sceneStage));if(lesson===0)await f.page.locator('#next').tap();}
   assert.deepEqual(stages,['frame','finished']);const after=await profile(f.page);assert.equal(after.game.economy.gold,20);assert.equal(after.energy.life.lives,before.energy.life.lives);assert.equal(Object.values(after.game.economy.transactions).filter(t=>t.kind==='welcome').length,1);assert.equal(await f.page.locator('.hx-scene-actor-anchor').isVisible(),false);measurements.push({name:current,stages,initialBoard:rect,missingAssetsFallback:true});await screenshot(f.page,'tutorial-finished-coop-welcome');
  }finally{await f.close();}
 });
 assert.deepEqual(errors,[],'no pageerror or unhandled rejected visual promise');console.log('Animation pipeline browser checks passed: '+results.length+' actual '+browserName+' groups.');
})().catch(error=>{failure=error.stack||String(error);console.error(error);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({browser:browserName,success:!failure,passed:results.length,results,measurements,errors,failure,nativeTouchInput:true,physicalDeviceTested:false,viewports,filter:process.env.HEXROTA_PIPELINE_ONLY||null,visibilityTest:'synthetic visibilitychange during actual native cascade',reloadTest:'actual HTTP reload during committed WON; not native BFCache'},null,2)+'\n');if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));});
