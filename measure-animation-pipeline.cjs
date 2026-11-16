/* Comparative real-browser observation; no gameplay/presentation replacement. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const FIXTURES=__dirname,RUNTIME=path.resolve(process.env.HEXROTA_BENCH_ROOT||path.join(__dirname,'dist'));
const OUT=path.resolve(process.env.HEXROTA_BENCH_OUT||path.join(__dirname,'test-results','animation-benchmark.json'));
const {chromium,webkit}=require('playwright');
const {existing,lifePool,NOW}=require('./check-lives-ui.cjs');
const samples=Number(process.env.HEXROTA_BENCH_SAMPLES||3),browsers=(process.env.HEXROTA_BENCH_BROWSERS||'chromium,webkit').split(',');
assert(Number.isInteger(samples)&&samples>=1&&samples<=20,'1–20 samples per full-motion fixture');assert(browsers.length&&browsers.every(name=>['chromium','webkit'].includes(name)),'supported actual browsers');fs.mkdirSync(path.dirname(OUT),{recursive:true});
const plain=v=>JSON.parse(JSON.stringify(v)),hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const startedUtc=new Date().toISOString(),sourceFiles=['app.js','board-view.js','score-presentation.js','move-presentation.js'].filter(file=>fs.existsSync(path.join(RUNTIME,file))),sourceHashes=Object.fromEntries(sourceFiles.map(file=>[file,hash(fs.readFileSync(path.join(RUNTIME,file)))]));
assert.equal(hash(fs.readFileSync(RUNTIME+'/engine.js')),hash(fs.readFileSync(FIXTURES+'/dist/engine.js')),'comparison reuses unchanged real engine');
const fixtures={};
for(let turns=0;turns<9&&Object.keys(fixtures).length<2;turns++){
 const f=existing(2,{turns});if(f.game.status!=='playing')continue;
 for(const pair of f.game.legalMoves()){
  const clone=f.game.clone(),result=clone.swap(...pair),kind=result.frames.length===1?'one-wave':result.frames.length>=3?'multi-wave':null;
  if(kind&&!fixtures[kind]&&result.ok&&clone.status==='playing')fixtures[kind]={saved:f.saved,pair:plain(pair),expected:plain(clone.snapshot()),frames:plain(result.frames)};
 }
}
assert.deepEqual(Object.keys(fixtures).sort(),['multi-wave','one-wave']);
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 let file;try{const p=decodeURIComponent(new URL(req.url,'http://local').pathname);file=path.resolve(RUNTIME,'.'+(p==='/'?'/index.html':p));}catch(_){return res.writeHead(400).end();}
 if(!file.startsWith(RUNTIME+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(data);});
});
const rows=[];
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+'/';
 for(const name of browsers){
  const executable=name==='chromium'?process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined):process.env.HEXROTA_WEBKIT_PATH;
  const browser=await(name==='chromium'?chromium:webkit).launch({headless:true,...executable?{executablePath:executable}:{},...(name==='chromium'?{args:['--no-sandbox']}:{})});
  try{for(const motion of ['full','reduce'])for(const [kind,f]of Object.entries(fixtures))for(let sample=0;sample<(motion==='full'?samples:1);sample++){
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:motion==='reduce'?'reduce':'no-preference',serviceWorkers:'block'});
   try{
    await context.addInitScript(({saved,energy,now,motion})=>{if(location.protocol!=='http:')return;Date.now=()=>now;if(!localStorage.getItem('hexrota-profile-v2')&&!localStorage.getItem('hexrota-match-v5')){saved.preferences={...saved.preferences,motion};localStorage.setItem('hexrota-match-v5',JSON.stringify(saved));localStorage.setItem('hexrota-lives-v1',JSON.stringify(energy));}},{saved:f.saved,energy:lifePool(5),now:NOW,motion});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.screen==='home');
    await page.locator('#home-play').tap();if(await page.locator('#pregame-dialog').evaluate(n=>n.open))await page.locator('#pregame-start').tap();await page.waitForFunction(()=>document.body.dataset.screen==='game');
    await page.locator('#board').evaluate(async board=>{const jobs=[];for(let n=board;n;n=n.parentElement)for(const a of n.getAnimations())if(a.effect?.target===n&&a.playState==='running'&&a.effect.getTiming().iterations!==Infinity)jobs.push(a.finished.catch(()=>{}));await Promise.all(jobs);});
    const points=[];for(const index of f.pair){const box=await page.locator(`#board [data-index="${index}"] .floor-shape`).boundingBox();assert(box);points.push({x:box.x+box.width/2,y:box.y+box.height/2});}
    await page.touchscreen.tap(points[0].x,points[0].y);
    await page.evaluate(()=>{
     const board=document.getElementById('board'),start=performance.now(),nativeAnimate=Element.prototype.animate,nativeSet=Storage.prototype.setItem,html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML'),boardView=window.HexBoardView,movePresentation=window.HexMovePresentation;
     const baselineBox=board.getBoundingClientRect().toJSON(),state={start,busyAt:null,idleAt:null,writes:0,animations:[],renders:[],frames:[],boxes:[],phases:[],presentationResult:null,before:JSON.parse(localStorage.getItem('hexrota-profile-v2'))};window.__bench=state;let reconcileDepth=0;
     const record=(node,old,kind)=>{const gems=[...node.querySelectorAll('.gem')];state.renders.push({kind,at:performance.now()-start,values:[...node.querySelectorAll('.hex-number')].map(n=>Number(n.textContent)),reusedGems:gems.filter(n=>old.has(n)).length,totalGems:gems.length,falling:[...node.querySelectorAll('.falling')].map(n=>Number(n.dataset.index))});};
     Storage.prototype.setItem=function(k,v){if(k==='hexrota-profile-v2')state.writes++;return nativeSet.call(this,k,v);};
     Element.prototype.animate=function(keyframes,options){const cls=this.getAttribute('class')||'',target=this.closest('[data-index]');state.animations.push({at:performance.now()-start,cls,index:target?Number(target.dataset.index):null,source:this.parentNode?.dataset?.swapSource||null,target:this.parentNode?.dataset?.swapTarget||null,keyframes:JSON.parse(JSON.stringify(keyframes)),options:JSON.parse(JSON.stringify(options||{}))});return nativeAnimate.call(this,keyframes,options);};
     if(html)Object.defineProperty(Element.prototype,'innerHTML',{...html,set(value){const old=this.id==='board'&&!reconcileDepth?new Set(this.querySelectorAll('.gem')):null;html.set.call(this,value);if(old)record(this,old,'rebuild');}});
     if(typeof boardView?.reconcile==='function')window.HexBoardView=Object.freeze({...boardView,reconcile(node,...args){const old=node===board?new Set(node.querySelectorAll('.gem')):null;reconcileDepth++;try{const outcome=boardView.reconcile(node,...args);if(old)record(node,old,'reconcile');return outcome;}finally{reconcileDepth--;}}});
     if(typeof movePresentation?.play==='function')window.HexMovePresentation=Object.freeze({...movePresentation,async play(input){const result=await movePresentation.play({...input,onPhase(event){state.phases.push({phase:event.phase,wave:event.wave,at:performance.now()-start});input.onPhase?.(event);}});state.presentationResult=result;return result;}});
     const observer=new MutationObserver(()=>{if(board.getAttribute('aria-busy')==='true'&&state.busyAt===null)state.busyAt=performance.now()-start;if(state.busyAt!==null&&board.getAttribute('aria-busy')==='false'&&state.idleAt===null)state.idleAt=performance.now()-start;});observer.observe(board,{attributes:true,attributeFilter:['aria-busy']});
     let raf,last;const tick=now=>{if(state.busyAt!==null&&state.idleAt===null){state.frames.push(last===undefined?null:now-last);state.boxes.push(board.getBoundingClientRect().toJSON());}last=now;raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
     state.baselineBox=baselineBox;state.stop=()=>{observer.disconnect();cancelAnimationFrame(raf);Element.prototype.animate=nativeAnimate;Storage.prototype.setItem=nativeSet;window.HexBoardView=boardView;if(movePresentation)window.HexMovePresentation=movePresentation;if(html)Object.defineProperty(Element.prototype,'innerHTML',html);};
    });
    await page.touchscreen.tap(points[1].x,points[1].y);await page.waitForFunction(()=>document.getElementById('board').getAttribute('aria-busy')==='false');
    const observed=await page.evaluate(()=>{const s=window.__bench;s.after=JSON.parse(localStorage.getItem('hexrota-profile-v2'));s.finalBox=document.getElementById('board').getBoundingClientRect().toJSON();s.visualValues=[...document.querySelectorAll('#board .hex-number')].map(n=>Number(n.textContent));s.stop();delete s.stop;return s;});
    assert.deepEqual(observed.after.game.boards[observed.after.game.current],f.expected,'same actual resolved snapshot after visuals');assert.equal(observed.writes,1,'F01 one authoritative command write');assert.deepEqual(errors,[]);assert.deepEqual(observed.visualValues,f.expected.values);if(observed.presentationResult)assert.equal(observed.presentationResult.status,'succeeded','normal benchmark playback is not interrupted by a watchdog');
    for(const box of [...observed.boxes,observed.finalBox])for(const key of ['width','height'])assert.equal(box[key],observed.baselineBox[key],'board size stays exact throughout');
    const intervals=observed.frames.filter(x=>x!==null),animatedGems=observed.animations.filter(a=>a.cls==='gem'),fallCalls=animatedGems.filter(a=>String(a.keyframes[0]?.transform||'').startsWith('translate('));
    const shownWaves=observed.phases.length?observed.phases.filter(p=>p.phase==='FALL').length:observed.renders.filter(r=>r.falling.length).length;
    rows.push({browser:name,motion,kind,sample,engineWaves:f.frames.length,observedAnimatedWaves:shownWaves,busyMs:observed.idleAt!==null?observed.idleAt-observed.busyAt:null,renderCount:observed.renders.length,boardRebuilds:observed.renders.filter(r=>r.kind==='rebuild').length,reconcileCalls:observed.renders.filter(r=>r.kind==='reconcile').length,reusedGemNodes:observed.renders.reduce((sum,r)=>sum+r.reusedGems,0),animationCount:observed.animations.length,fallAnimationCount:fallCalls.length,refillAnimationCount:fallCalls.filter(a=>a.keyframes[0]?.opacity===0).length,rafSamples:intervals.length,meanRafMs:intervals.length?intervals.reduce((n,x)=>n+x,0)/intervals.length:null,maxRafMs:intervals.length?Math.max(...intervals):null,rafOver50ms:intervals.filter(x=>x>50).length,writes:observed.writes,revisionDelta:observed.after.revision-observed.before.revision,exactSnapshot:true,exactGeometry:true,errors,observed});
    console.log(JSON.stringify({browser:name,motion,kind,sample,busyMs:rows.at(-1).busyMs,renders:rows.at(-1).renderCount,engineWaves:f.frames.length,shownWaves:rows.at(-1).observedAnimatedWaves}));
   }finally{await context.close();}
  }}finally{await browser.close();}
 }
 const summary=[];for(const browser of browsers)for(const motion of ['full','reduce'])for(const kind of Object.keys(fixtures)){const group=rows.filter(r=>r.browser===browser&&r.motion===motion&&r.kind===kind),values=group.map(r=>r.busyMs).filter(v=>v!==null).sort((a,b)=>a-b);summary.push({browser,motion,kind,samples:group.length,busyMsRange:values.length?[values[0],values.at(-1)]:null,busyMsMedian:values.length?values[Math.floor(values.length/2)]:null,renderCounts:[...new Set(group.map(r=>r.renderCount))],boardRebuilds:[...new Set(group.map(r=>r.boardRebuilds))],reconcileCalls:[...new Set(group.map(r=>r.reconcileCalls))],reusedGemNodes:[...new Set(group.map(r=>r.reusedGemNodes))],animationCounts:[...new Set(group.map(r=>r.animationCount))],engineWaves:group[0].engineWaves,shownWaves:[...new Set(group.map(r=>r.observedAnimatedWaves))],maxRafMs:Math.max(...group.map(r=>r.maxRafMs||0)),rafOver50ms:group.reduce((n,r)=>n+r.rafOver50ms,0)});}
 assert.deepEqual(Object.fromEntries(sourceFiles.map(file=>[file,hash(fs.readFileSync(path.join(RUNTIME,file)))])),sourceHashes,'reviewed runtime sources did not change while measuring');
 fs.writeFileSync(OUT,JSON.stringify({success:true,startedUtc,createdUtc:new Date().toISOString(),runtime:RUNTIME,sourceHash:sourceHashes['app.js'],sourceHashes,viewports:[{width:390,height:844}],method:'native second tile touch; MutationObserver busy edges, transparent Element.animate observation, board innerHTML/reconcile projections, public coordinator phase observation, rAF interval samples, fresh fixed-clock contexts; serial browsers',limitations:['headless shared host; not physical iPhone',samples+' full-motion repeats, one reduced-motion repeat per fixture and browser','rAF observations are coarse frame continuity, not hardware performance claims','legacy score collection and gravity overlap; phases inferred from actual target/options and DOM projection when coordinator is absent','projection calls, full board rebuilds and reconcile calls are distinct; cumulative reused-node counts are not unique stone counts'],fixtures:Object.fromEntries(Object.entries(fixtures).map(([k,f])=>[k,{pair:f.pair,frames:f.frames,expected:f.expected,attempt:f.saved.attempts[f.saved.current]}])),summary,rows},null,2)+'\n');
 console.log('BENCH PASS '+OUT);console.log(JSON.stringify(summary));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
