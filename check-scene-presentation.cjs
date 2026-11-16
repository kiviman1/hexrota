/* Pure presentation contract: controllable asset/actor promises, no business services. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=__dirname,plain=value=>JSON.parse(JSON.stringify(value));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const config=()=>JSON.parse(read('data/scene-config-v1.json'));
const tests=[],test=(name,run)=>tests.push({name,run});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
async function until(check,label,timeout=1200){const start=Date.now();while(!check()&&Date.now()-start<timeout)await sleep(5);assert(check(),label);}
const view=extra=>({screen:'home',firstOpening:true,committedStars:0,levelId:'learn-1',attemptId:'t-learn-1-1',turn:0,status:'playing',busy:false,feedback:false,lessonPair:[0,1],paused:false,hidden:false,modalOpen:false,reducedMotion:false,...extra});
function frozen(value){if(value&&typeof value==='object'){Object.values(value).forEach(frozen);Object.freeze(value);}return value;}
function mount({autoImages=true,autoActor=true,library=true}={}){
 const dom=new JSDOM('<!doctype html><body><main id="home"><div class="tavik-intro"></div></main><section class="game-card"><header class="game-topbar"></header><section id="tutorial-coach"></section><svg id="board" viewBox="-150 -160 300 320"><g data-index="0"></g><g data-index="1"></g></svg><nav class="game-toolbar"></nav></section></body>',{url:'https://hexrota-scene.example/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,images=[],actors=[],errors=[],accesses=[];
 Object.defineProperty(w,'innerWidth',{configurable:true,value:390});Object.defineProperty(w,'innerHeight',{configurable:true,value:844});
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 const rect=(x,y,width,height)=>({x,y,left:x,top:y,width,height,right:x+width,bottom:y+height,toJSON(){return{...this};}});
 const fixed=new Map([[d.querySelector('.game-card'),rect(0,0,390,844)],[d.querySelector('.tavik-intro'),rect(20,150,350,320)],[d.querySelector('.game-topbar'),rect(0,0,390,140)],[d.querySelector('#tutorial-coach'),rect(12,150,366,118)],[d.querySelector('#board'),rect(6,278,378,500)],[d.querySelector('.game-toolbar'),rect(0,790,390,54)],[d.querySelector('[data-index="0"]'),rect(140,410,74,86)],[d.querySelector('[data-index="1"]'),rect(214,452,74,86)]]);
 for(const [node,box]of fixed)node.getBoundingClientRect=()=>box;
 w.HTMLImageElement.prototype.decode=function(){const job={node:this,src:this.src,...deferred()};images.push(job);if(autoImages)job.resolve();return job.promise;};
 Object.defineProperty(w.HTMLImageElement.prototype,'naturalWidth',{configurable:true,get(){return this.src.includes('/backgrounds/')?1672:384;}});
 Object.defineProperty(w.HTMLImageElement.prototype,'naturalHeight',{configurable:true,get(){return this.src.includes('/backgrounds/')?941:384;}});
 if(library)w.HexTavikMotion={mount(host,options){
  const element=d.createElement('div');element.className='hx-tavik';host.append(element);const ready=deferred(),actor={element,options,plays:['idle'],pauses:[],reduced:[],destroyCount:0,readyControl:ready,ready:ready.promise,play(name){actor.plays.push(name);if(actor.fail===name)return Promise.resolve(false);element.dataset.motion=name;return Promise.resolve(true);},pause(value){actor.pauses.push(!!value);element.dataset.paused=String(!!value);},setReducedMotion(value){actor.reduced.push(!!value);element.dataset.reducedMotion=String(!!value);},destroy(){actor.destroyCount++;element.remove();}};
  actors.push(actor);if(autoActor)ready.resolve(true);return actor;
 }};
 for(const name of ['HexMatch','HexEconomy','HexLives','localStorage','sessionStorage'])Object.defineProperty(w,name,{configurable:true,get(){accesses.push(name);throw Error('Presentation accessed '+name);}});
 w.Math.random=()=>{accesses.push('RNG');throw Error('Presentation consumed RNG');};
 w.eval(read('dist/scene-presentation.js'));
 const api=w.HexScenePresentation,board=d.querySelector('#board'),beforeBoard=board.outerHTML;
 const controller=api.create({document:d,window:w,config:config(),board,homeHost:d.querySelector('.tavik-intro'),gameHost:d.querySelector('.game-card'),onError:error=>errors.push(error)});
 function update(extra){const input=frozen(view(extra)),before=JSON.stringify(input);controller.update(input);assert.equal(JSON.stringify(input),before,'view projection is immutable');}
 function unchanged(){assert.equal(board.outerHTML,beforeBoard,'presentation never changes SVG data, geometry or input nodes');assert.deepEqual(accesses,[],'presentation has no engine, economy, life, storage or RNG access');}
 return{dom,w,d,api,controller,images,actors,errors,accesses,update,unchanged,snapshot:()=>plain(controller.snapshot()),close(){controller.destroy();unchanged();dom.window.close();}};
}

test('canonical scene thresholds are strict, data driven and have no future rescue implementation',()=>{
 const f=mount();try{
  const c=config();assert.equal(f.api.validateConfig(c),true);
  const id=stars=>{const stage=f.api.stageForStars(c,stars);return typeof stage==='string'?stage:stage.id;};
  for(const n of [0,1])assert.equal(id(n),'clearing');for(const n of [2,3,4])assert.equal(id(n),'frame');for(const n of [5,6,9])assert.equal(id(n),'roof');for(const n of [10,11,100])assert.equal(id(n),'finished');
  assert.equal(c.futureStory.enabled,false);assert.deepEqual(c.futureStory.hooks,[]);
  for(const mutate of [x=>x.unknown=true,x=>x.stages[1].minStars=0,x=>x.stages[0].background='../engine.js',x=>x.futureStory.enabled=true,x=>x.futureStory.hooks.push('rescue'),x=>x.actor.gameMinSize=x.actor.gameMaxSize+1]){const bad=config();mutate(bad);assert.throws(()=>f.api.validateConfig(bad));}
  for(const bad of [-1,1.5,NaN,Infinity,'2',null])assert.throws(()=>f.api.stageForStars(c,bad),'invalid star input never silently unlocks a stage');
 }finally{f.close();}
});

test('first opening loads only its active world and one actor before showing intro motion',async()=>{
 const f=mount();try{
  f.update();await until(()=>f.snapshot().backgroundReady&&f.snapshot().actorReady,'initial scene assets become ready');
  assert.equal(f.snapshot().stage,'clearing');assert.equal(f.actors.length,1);assert.equal(f.actors[0].plays[0],'idle');
  assert(f.actors[0].plays.includes('inspect'),'the first opening uses the prepared inspect pose');
  assert(f.images.length>0);assert(f.images.every(job=>job.src.includes('/backgrounds/clearing')),'other construction backgrounds are not eagerly decoded');
  assert.equal(f.d.querySelectorAll('.hx-tavik').length,1);f.unchanged();
 }finally{f.close();}
});

test('home to real game preserves the same world and actor without replaying an opening on resume',async()=>{
 const f=mount();try{
  f.update();await until(()=>f.snapshot().actorReady&&f.snapshot().backgroundReady,'home ready');const actor=f.actors[0],worldImages=f.images.length;
  f.update({screen:'game',firstOpening:false});await until(()=>actor.plays.includes('point'),'the existing guided lesson gets a pointing pose');
  assert.equal(f.actors.length,1,'one actor is reparented');assert.equal(f.images.length,worldImages,'the same scene image remains loaded');
  assert(f.d.querySelector('.game-card').contains(actor.element),'game owns the decorative actor');
  const oldInspect=actor.plays.filter(name=>name==='inspect').length;
  f.update({screen:'home',firstOpening:false,committedStars:0});await sleep(0);assert.equal(actor.plays.filter(name=>name==='inspect').length,oldInspect,'returning home does not force the intro');
 }finally{f.close();}
});

test('starting the real board while its background is decoding cannot strand the world',async()=>{
 const f=mount({autoImages:false});try{
  f.update();await until(()=>f.images.some(job=>job.src.includes('/backgrounds/clearing')),'opening background requested');
  f.update({screen:'game',firstOpening:false});await sleep(0);for(const request of f.images)request.resolve();
  await until(()=>f.snapshot().backgroundReady,'the same clearing becomes visible after entering the real board');assert.equal(f.snapshot().mode,'game');assert.equal(f.snapshot().stage,'clearing');f.unchanged();
 }finally{f.close();}
});

test('construction stage derives only from committed stars, never a lesson, reaction or Gold-like field',async()=>{
 const f=mount();try{
  f.update({firstOpening:false,committedStars:5});await until(()=>f.snapshot().backgroundReady,'saved roof scene ready');assert.equal(f.snapshot().stage,'roof');
  for(const kind of ['match','win','build'])f.controller.react({key:'saved:'+kind,kind});await sleep(0);assert.equal(f.snapshot().stage,'roof');
  f.update({screen:'game',firstOpening:false,committedStars:5,levelId:'learn-2',status:'won',turn:4});assert.equal(f.snapshot().stage,'roof','tutorial victory does not add a star');
  f.update({screen:'home',firstOpening:false,committedStars:10});await until(()=>f.snapshot().stage==='finished'&&f.snapshot().backgroundReady,'canonical stars select finished');
 }finally{f.close();}
});

test('a late background decode cannot overwrite a newer star stage',async()=>{
 const f=mount({autoImages:false});try{
  f.update();await until(()=>f.images.some(job=>job.src.includes('/clearing')),'clearing requested');const clearing=f.images.find(job=>job.src.includes('/clearing'));
  f.update({firstOpening:false,committedStars:2});await until(()=>f.images.some(job=>job.src.includes('/frame')),'new frame requested');const frame=f.images.find(job=>job.src.includes('/frame'));
  frame.resolve();await until(()=>f.snapshot().stage==='frame'&&f.snapshot().backgroundReady,'new frame wins');clearing.resolve();await sleep(30);
  assert.equal(f.snapshot().stage,'frame');assert.equal(f.snapshot().backgroundReady,true);assert(!f.d.querySelector('img[src*="backgrounds/clearing"]'),'stale clearing cannot return to the live scene');
 }finally{f.close();}
});

test('pending actor readiness cannot replay intro after a game transition',async()=>{
 const f=mount({autoActor:false});try{
  f.update();assert.equal(f.actors.length,1);const actor=f.actors[0];
  f.update({screen:'game',firstOpening:false});actor.readyControl.resolve(true);await until(()=>f.snapshot().actorReady,'actor ready in current game');
  assert(!actor.plays.includes('inspect'),'old first-opening readiness cannot start inspect in the game');assert(actor.plays.includes('point'));
 }finally{f.close();}
});

test('hidden, modal and paused states suspend the supplied actor and reduced motion stays static',async()=>{
 const f=mount();try{
  f.update({screen:'game',firstOpening:false});await until(()=>f.snapshot().actorReady,'game actor ready');const actor=f.actors[0];
  for(const extra of [{hidden:true},{modalOpen:true},{paused:true}]){f.update({screen:'game',firstOpening:false,...extra});assert.equal(actor.pauses.at(-1),true);assert.equal(f.snapshot().paused,true);}
  f.update({screen:'game',firstOpening:false,reducedMotion:true});assert.equal(actor.pauses.at(-1),false);assert.equal(actor.reduced.at(-1),true);assert.equal(f.snapshot().reducedMotion,true);
 }finally{f.close();}
});

test('duplicate reaction callbacks are cosmetic and do not replay the same cue',async()=>{
 const f=mount();try{
  f.update({screen:'game',firstOpening:false,lessonPair:null});await until(()=>f.snapshot().actorReady,'actor ready');const actor=f.actors[0];
  f.controller.react({key:'attempt-1:turn-1',kind:'match'});await sleep(0);const calls=actor.plays.length;
  for(let n=0;n<100;n++)f.controller.react({key:'attempt-1:turn-1',kind:'match'});await sleep(0);assert.equal(actor.plays.length,calls);assert.equal(f.snapshot().stage,'clearing');f.unchanged();
 }finally{f.close();}
});

test('document visibility pauses motion without advancing the canonical stage',async()=>{
 const f=mount();try{
  f.update({screen:'game',firstOpening:false});await until(()=>f.snapshot().actorReady,'actor ready');
  Object.defineProperty(f.d,'hidden',{configurable:true,value:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));
  assert.equal(f.actors[0].pauses.at(-1),true);assert.equal(f.snapshot().paused,true);assert.equal(f.snapshot().stage,'clearing');
  Object.defineProperty(f.d,'hidden',{configurable:true,value:false});f.d.dispatchEvent(new f.w.Event('visibilitychange'));
  assert.equal(f.actors[0].pauses.at(-1),false);assert.equal(f.snapshot().stage,'clearing');
 }finally{f.close();}
});

test('actor placement reserves room around the board and hides when space is exhausted',async()=>{
 const f=mount();try{
  f.update({screen:'game',firstOpening:false});await until(()=>f.snapshot().actorVisible,'actor finds a free corner');
  const placed=f.snapshot(),r=placed.layout;
  assert(placed.layout,'visible actors expose a layout');
  assert(r.kind==='game','default geometry uses a corner');
  assert(r.width>=80&&r.width<=110);
  const envelope={left:r.left-10,top:r.top-24,right:r.left+r.width+10,bottom:r.top+r.height+5};
  const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  for(const selector of ['.game-topbar','#tutorial-coach','.game-toolbar','[data-index="0"]','[data-index="1"]'])assert(!overlaps(envelope,f.d.querySelector(selector).getBoundingClientRect()),'actor overlaps '+selector);
  assert(envelope.left>=0&&envelope.right<=390&&envelope.top>=0&&envelope.bottom<=844);
  for(const node of f.d.querySelectorAll('[data-index],.game-topbar,#tutorial-coach,.game-toolbar')){
   const b=node.getBoundingClientRect();assert(!(envelope.left<b.right+8&&envelope.right>b.left-8&&envelope.top<b.bottom-8&&envelope.bottom>b.top+8),'actor envelopes avoid '+node.className);
  }
  // Cover the full board, then force a new turn. No room means no actor.
  f.d.querySelector('[data-index="0"]').getBoundingClientRect=()=>({left:0,top:0,right:390,bottom:844,width:390,height:844});
  f.update({screen:'game',firstOpening:false,lessonPair:null,turn:1});await sleep(30);assert.equal(f.snapshot().actorVisible,false);
  f.unchanged();
 }finally{f.close();}
});

test('closing a scene destroys actors and invalidates pending images, then a fresh opening can remount',async()=>{
 const f=mount({autoImages:false,autoActor:false});try{
  f.update();await until(()=>f.images.length>0,'background pending');const actor=f.actors[0],request=f.images[0];
  f.update({screen:'records',firstOpening:false});assert.equal(actor.destroyCount,1);assert.equal(f.snapshot().active,false);
  actor.readyControl.resolve(true);request.resolve();await sleep(30);assert.equal(f.d.querySelectorAll('.hx-tavik').length,0,'closed scene cannot revive');assert(!actor.plays.includes('inspect'));
  f.update({screen:'home',firstOpening:false});assert.equal(f.actors.length,2,'reopening mounts a new SDK actor');
 }finally{f.close();}
});

test('remounting at a higher stage does not perform a construction animation',async()=>{
 const f=mount();try{
  f.update();await until(()=>f.snapshot().actorReady,'ready');
  f.update({screen:'records'});f.update({firstOpening:false,committedStars:5});
  await until(()=>f.snapshot().actorReady,'remounted');
  assert(!f.actors[1].plays.includes('build'));assert.equal(f.snapshot().stage,'roof');
 }finally{f.close();}
});

test('failed reaction leaves the last good pose usable',async()=>{
 const f=mount();try{
  f.update({screen:'game',firstOpening:false});await until(()=>f.snapshot().pose==='point','point ready');
  f.actors[0].fail='celebrate';f.controller.react({key:'fail',kind:'match'});
  await until(()=>f.actors[0].plays.filter(x=>x==='point').length>=2,'last pose recovers');
  assert.equal(f.snapshot().pose,'point');assert.equal(f.actors[0].destroyCount,0);
 }finally{f.close();}
});

test('tutorial can use a compact actor while its pair is temporarily missing',async()=>{
 const f=mount();try{
  f.d.querySelector('[data-index="0"]').getBoundingClientRect=()=>({left:0,top:278,right:390,bottom:778,width:390,height:500});
  f.update({screen:'game',firstOpening:false,levelId:'learn-1',lessonPair:[]});
  await until(()=>f.snapshot().actorVisible,'compact actor visible');
  assert.equal(f.snapshot().layout.kind,'dock');assert.equal(f.actors[0].reduced.at(-1),true);
 }finally{f.close();}
});

test('final destroy is idempotent and no delayed callback or update can revive it',async()=>{
 const f=mount({autoImages:false,autoActor:false});try{
  f.update();await until(()=>f.images.length>0,'pending background');const actor=f.actors[0];f.controller.destroy();f.controller.destroy();
  for(const job of f.images)job.resolve();actor.readyControl.resolve(true);f.update({screen:'game',firstOpening:false});await sleep(30);
  assert.equal(f.snapshot().destroyed,true);assert.equal(f.snapshot().active,false);assert.equal(actor.destroyCount,1);assert.equal(f.d.querySelectorAll('.hx-tavik').length,0);f.unchanged();
 }finally{f.close();}
});

test('failed world assets and an unavailable optional motion SDK leave the real board usable',async()=>{
 const f=mount({autoImages:false,library:false});try{
  assert.doesNotThrow(()=>f.update({screen:'game',firstOpening:false}));await until(()=>f.images.some(job=>job.src.includes('/backgrounds/')),'failed world requested');f.images.find(job=>job.src.includes('/backgrounds/')).reject(new Error('injected scene image failure'));await sleep(200);
  assert(f.errors.length>0,'optional asset error is reported');assert.equal(f.snapshot().active,true,'game scene does not fail closed');
  await until(()=>f.images.some(job=>job.src.includes('assets/characters/tavik/front.webp')),'approved fallback requested');
  f.images.find(job=>job.src.includes('assets/characters/tavik/front.webp')).resolve();
  await until(()=>f.snapshot().fallbackReady,'fallback becomes ready');
  const fallback=[...f.d.querySelectorAll('img')].some(node=>node.src.includes('assets/characters/tavik/front.webp'));assert(fallback,'approved existing Tavik portrait is the only actor fallback');f.unchanged();
 }finally{f.close();}
});

(async()=>{for(const {name,run}of tests){await run();console.log('PASS '+name);}console.log('Scene presentation checks passed: '+tests.length+' groups; controlled asset races, immutable view projections and no gameplay/storage services.');})().catch(error=>{console.error(error);process.exitCode=1;});
