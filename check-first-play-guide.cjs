/* Additive onboarding guide: real board geometry, immutable visible facts,
 * decorative contours only. The host owns every real move and checkpoint. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const source=name=>fs.readFileSync(path.join(__dirname,'dist',name),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const tests=[];const test=(name,run)=>tests.push({name,run});

function mount({reduced=false,animate=true,gestureHost=false}={}){
 const dom=new JSDOM('<section id="coach"><p id="copy">Kaydır veya dokun.</p><button id="existing-action">Var olan</button></section><svg id="board" xmlns="http://www.w3.org/2000/svg"></svg>',{url:'https://hexrota-guide.example/',runScripts:'outside-only'}),w=dom.window;
 try{
  const board=w.document.getElementById('board'),coach=w.document.getElementById('coach'),animations=[];let motion=reduced,calls=0,throwAt=0;
  w.eval(source('board-view.js'));
  for(const name of ['HexMatch','engine','localStorage','sessionStorage'])Object.defineProperty(w,name,{configurable:true,get(){throw Error('Guide accessed '+name);}});
  w.Math.random=()=>{throw Error('Guide consumed RNG');};
  w.eval(source('first-play.js'));
  const style=w.document.createElement('style');style.textContent=fs.readFileSync(path.join(__dirname,'src/styles/13-first-play.css'),'utf8');w.document.head.append(style);
  const level=freeze({cells:[{q:0,r:-1,layers:1},{q:-1,r:0,layers:1},{q:1,r:-1,layers:1},{q:0,r:0,layers:1},{q:-1,r:1,layers:1},{q:1,r:0,layers:1},{q:0,r:1,layers:1}]}),state=freeze({values:[2,2,3,1,2,2,3],layers:[1,1,1,1,1,1,1],score:0,movesLeft:5,rng:31676});
  const layout=freeze(w.HexBoardView.geometry(level,true)),pair=freeze([4,3]),matchingSources=freeze([1,4,5]);
  const descriptor=freeze({layout,pair,matchingSources,mode:'teach'}),inputBefore=JSON.stringify({level,state,descriptor});
  function fill(layers=state.layers){board.innerHTML=w.HexBoardView.markup(level,{...state,layers},layout,{guided:{pair,matchIndices:[1,3,5]}});}
  fill();
  const originals=()=>[...board.querySelectorAll(':scope>.hex-tile[data-index]')];
  originals()[4].querySelector('.gem').style.setProperty('opacity','.81','important');
  originals()[3].querySelector('.gem').id='original-one';
  if(animate)w.SVGElement.prototype.animate=function(frames,options){
   calls++;if(calls===throwAt)throw Error('test-only guide animation error');
   const animation=new w.EventTarget();let resolve,reject;
   Object.assign(animation,{target:this,frames,options,cancelled:false,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),finish(){resolve();},fail(){reject(Error('test-only rejected animation'));},cancel(){if(this.cancelled)return;this.cancelled=true;this.dispatchEvent(new w.Event('cancel'));reject(Error('animation cancelled'));}});
   animations.push(animation);return animation;
  };
  const guide=w.HexFirstPlay.createGuide({board,gestureHost:gestureHost?coach:null,reducedMotion:()=>motion});
  function capture(){return originals().map(node=>({node,html:node.outerHTML,gem:node.querySelector('.gem'),floor:node.querySelector('.floor-shape'),number:node.querySelector('.hex-number')}));}
  function unchanged(before){
   assert.equal(JSON.stringify({level,state,descriptor}),inputBefore,'guide never changes supplied cells, values, layers, score, moves, RNG or descriptor');
   const current=originals();assert.equal(current.length,before.length);
   for(let n=0;n<before.length;n++){assert.equal(current[n],before[n].node,'real tile identity survives');assert.equal(current[n].outerHTML,before[n].html,'real tile attributes, number and inline styles are byte-exact');assert.equal(current[n].querySelector('.gem'),before[n].gem);assert.equal(current[n].querySelector('.floor-shape'),before[n].floor);assert.equal(current[n].querySelector('.hex-number'),before[n].number);}
  }
  function layer(){return board.querySelector('.first-play-guide-layer');}
  function clean(){assert.equal(guide.isActive(),false);assert.equal(layer(),null);}
  return{w,board,coach,guide,animations,layout,pair,matchingSources,descriptor,originals,capture,unchanged,fill,layer,clean,show:extra=>guide.show({...descriptor,...extra}),reduced:value=>motion=value,throwNext:()=>{throwAt=calls+1;},close(){guide.destroy();w.close();}};
 }catch(error){w.close();throw error;}
}
const microtask=()=>new Promise(resolve=>queueMicrotask(resolve));

test('source target and exact current matching group are unambiguous without moving or hiding any stone',()=>{
 const f=mount();try{
  const before=f.capture();assert.equal(f.show(),true);assert.equal(f.guide.isActive(),true);f.unchanged(before);
  const layer=f.layer();assert(layer);assert.equal(layer.getAttribute('aria-hidden'),'true');assert.equal(layer.getAttribute('pointer-events'),'none');
  const groups=[...layer.querySelectorAll('[data-guide-role]')].filter(n=>n.hasAttribute('data-guide-index'));
  assert.deepEqual(groups.map(n=>[+n.dataset.guideIndex,n.dataset.guideRole]).sort((a,b)=>a[0]-b[0]),[[1,'match'],[3,'target'],[4,'source'],[5,'match']]);
  assert.equal(layer.querySelectorAll('.gem,.hex-number,[tabindex],[role],[data-index]').length,0,'guide creates no copied numeric gems or accessibility/input targets');
  assert.equal(f.board.querySelectorAll('.hex-number').length,7,'all real numbers remain visible exactly once');
  assert.equal(layer.querySelectorAll('.first-play-guide-contour').length,4);
  for(const contour of layer.querySelectorAll('.first-play-guide-contour')){assert.equal(contour.getAttribute('fill'),'none','even missing CSS cannot paint over a number');assert.equal(f.w.getComputedStyle(contour).fill,'none','contours never cover numbers');}
  assert(layer.querySelector('.first-play-guide-hand'),'one explicit hand names the physical source-to-target gesture');
 }finally{f.close();}
});

test('guide anchors use supplied hex geometry and preserve every authored floor target',()=>{
 const f=mount();try{
  const before=f.capture();assert(f.show());
  for(const group of f.layer().querySelectorAll('[data-guide-index]')){const point=f.layout.positions[+group.dataset.guideIndex];assert.equal(group.getAttribute('transform'),`translate(${point.x},${point.y})`);}
  f.unchanged(before);assert.deepEqual(f.originals().map(n=>n.getAttribute('transform')),before.map(row=>row.node.getAttribute('transform')));
 }finally{f.close();}
});

test('only bounded finite guide animations run and completion leaves a usable static cue',async()=>{
 const f=mount();try{
  const before=f.capture();assert(f.show());assert(f.animations.length>0);
  for(const animation of f.animations){assert.equal(animation.options.duration,1800);assert.equal(animation.options.iterations??1,1);assert(f.layer().contains(animation.target));assert(!f.originals().some(node=>node.contains(animation.target)));animation.finish();}
  await microtask();assert(f.guide.isActive());assert(f.layer());f.unchanged(before);
 }finally{f.close();}
});

test('reprompt has the same exact source group and does not introduce unrelated stones',()=>{
 const f=mount();try{
  const before=f.capture();assert(f.show({mode:'reprompt'}));
  assert.deepEqual([...f.layer().querySelectorAll('[data-guide-index]')].map(n=>+n.dataset.guideIndex).sort((a,b)=>a-b),[1,3,4,5]);f.unchanged(before);
 }finally{f.close();}
});

test('legacy hand visibility is restored exactly after repeated stop',()=>{
 const f=mount();try{
  const gesture=f.board.querySelector('.tutorial-gesture');gesture.style.setProperty('visibility','visible','important');gesture.style.opacity='.63';const html=gesture.outerHTML,before=f.capture();
  assert(f.show());assert.equal(gesture.style.visibility,'hidden');f.guide.stop();f.guide.stop();f.clean();assert.equal(gesture.outerHTML,html);f.unchanged(before);assert(f.animations.every(a=>a.cancelled));
 }finally{f.close();}
});

test('reduced motion supplies static source target match and hand instruction without animations',()=>{
 const f=mount({reduced:true});try{
  const before=f.capture();assert(f.show());assert(f.guide.isActive());assert.equal(f.animations.length,0);assert.equal(f.layer().querySelectorAll('[data-guide-index]').length,4);f.unchanged(before);f.guide.stop();f.clean();
 }finally{f.close();}
});

test('missing animation API keeps a complete static guide available',()=>{
 const f=mount({animate:false});try{const before=f.capture();assert(f.show());assert(f.layer());f.unchanged(before);f.guide.stop();f.clean();}finally{f.close();}
});

test('operating system reduced motion also prevents guide animations',()=>{
 const f=mount();try{f.w.matchMedia=()=>({matches:true});const before=f.capture();assert(f.show());assert.equal(f.animations.length,0);assert.equal(f.layer().dataset.reducedMotion,'true');f.unchanged(before);}finally{f.close();}
});

test('duplicate matching sources are rejected rather than rendering ambiguous effects',()=>{
 const f=mount();try{const before=f.capture();assert.equal(f.show({matchingSources:[1,4,4,5]}),false);f.clean();f.unchanged(before);}finally{f.close();}
});

test('mixed numbers or the nonmatching target cannot be presented as the matching group',()=>{
 const f=mount();try{
  const before=f.capture();for(const matchingSources of [[1,3,4],[1,2,4],[1,5],[0,1,5]]){assert.equal(f.show({matchingSources}),false,JSON.stringify(matchingSources));f.clean();f.unchanged(before);}
 }finally{f.close();}
});

test('invalid pairs coordinates modes and missing cells fail closed without touching real tiles',()=>{
 const f=mount();try{
  const before=f.capture();for(const extra of [{pair:[4,4]},{pair:[-1,3]},{pair:[4,99]},{pair:[4.1,3]},{pair:[4]},{matchingSources:[1,4,99]},{mode:'other'},{layout:{...plain(f.layout),positions:f.layout.positions.map((p,n)=>n===4?{x:NaN,y:p.y}:p)}}]){assert.equal(f.show(extra),false);f.clean();f.unchanged(before);}
  assert.equal(f.w.HexFirstPlay.createGuide().show({}),false);
 }finally{f.close();}
});

test('success feedback outlines only supplied already-green terrain and never modifies it',()=>{
 const f=mount();try{
  f.fill([1,0,1,0,1,0,1]);const before=f.capture();assert.equal(f.guide.feedback({layout:f.layout,cells:[1,3,5]}),true);
  assert.deepEqual([...f.layer().querySelectorAll('[data-guide-role]')].map(n=>[+n.dataset.guideIndex,n.dataset.guideRole]),[[1,'green'],[3,'green'],[5,'green']]);
  assert.equal(f.layer().querySelector('.first-play-guide-hand'),null);for(const a of f.animations){assert.equal(a.options.duration,800);assert.equal(a.options.iterations??1,1);}f.unchanged(before);f.guide.stop();f.clean();
 }finally{f.close();}
});

test('feedback rejects ungrown or invalid cells and reduced mode remains static',()=>{
 const f=mount({reduced:true});try{
  const before=f.capture();for(const cells of [[],[1],[-1],[99]]){assert.equal(f.guide.feedback({layout:f.layout,cells}),false);f.clean();f.unchanged(before);}
  f.fill([1,0,1,0,1,0,1]);const green=f.capture();assert(f.guide.feedback({layout:f.layout,cells:[1,3,5,1]}));assert.equal(f.layer().querySelectorAll('[data-guide-index]').length,3,'repeated wave cells receive one green contour');assert.equal(f.animations.length,0);f.unchanged(green);
 }finally{f.close();}
});

test('replacement cancels the previous guide and stale animation completion cannot remove the new one',async()=>{
 const f=mount();try{
  const before=f.capture();assert(f.show());const old=f.animations.slice(),oldLayer=f.layer();assert(f.show({mode:'reprompt'}));const current=f.layer();assert.notEqual(current,oldLayer);assert(old.every(a=>a.cancelled));
  for(const animation of old)animation.finish();await microtask();assert.equal(f.layer(),current);assert(f.guide.isActive());assert.equal(f.board.querySelectorAll('.first-play-guide-layer').length,1);f.unchanged(before);
 }finally{f.close();}
});

test('cancelled or rejected motion cleans the owned layer and restores the legacy gesture',async()=>{
 const f=mount();try{
  const before=f.capture(),gesture=f.board.querySelector('.tutorial-gesture'),html=gesture.outerHTML;
  assert(f.show());f.animations.at(-1).cancel();await microtask();f.clean();assert.equal(gesture.outerHTML,html);f.unchanged(before);
  assert(f.show());f.animations.at(-1).fail();await microtask();f.clean();assert.equal(gesture.outerHTML,html);f.unchanged(before);
 }finally{f.close();}
});

test('animation construction failure leaves no partial layer or changed originals',()=>{
 const f=mount();try{const before=f.capture(),gesture=f.board.querySelector('.tutorial-gesture'),html=gesture.outerHTML;f.throwNext();assert.equal(f.show(),false);f.clean();assert.equal(gesture.outerHTML,html);f.unchanged(before);}finally{f.close();}
});

test('board replacement or external layer removal triggers observer cleanup',async()=>{
 const f=mount();try{
  assert(f.show());const old=f.animations.slice(),gesture=f.board.querySelector('.tutorial-gesture');f.fill();await microtask();f.clean();assert(old.every(a=>a.cancelled));assert.equal(gesture.style.visibility,'');
  const before=f.capture();assert(f.show());f.layer().remove();await microtask();f.clean();f.unchanged(before);
 }finally{f.close();}
});

test('removing a referenced real stone cancels the guide even if its layer remains',async()=>{
 const f=mount();try{assert(f.show());f.originals()[4].remove();await microtask();f.clean();assert(f.animations.every(a=>a.cancelled));}finally{f.close();}
});

test('changed viewBox gem identity or printed value invalidate the old visual cue',async()=>{
 for(const change of [f=>f.board.setAttribute('viewBox','-200 -200 400 400'),f=>{const gem=f.originals()[4].querySelector('.gem');gem.replaceWith(gem.cloneNode(true));},f=>{f.originals()[4].querySelector('.hex-number').textContent='3';}]){
  const f=mount();try{assert(f.show());change(f);await microtask();f.clean();assert(f.animations.every(a=>a.cancelled));assert.equal(f.board.querySelector('.tutorial-gesture').style.visibility,'');}finally{f.close();}
 }
});

test('a removed layer reinserted before observer delivery cannot remain an active stale cue',async()=>{
 const f=mount();try{const before=f.capture();assert(f.show());const layer=f.layer();layer.remove();f.board.append(layer);await microtask();f.clean();f.unchanged(before);assert(f.animations.every(a=>a.cancelled));}finally{f.close();}
});

test('destroy is idempotent and old completions cannot remount effects',async()=>{
 const f=mount();try{
  const before=f.capture();assert(f.show());const old=f.animations.slice();f.guide.destroy();f.guide.destroy();for(const a of old)a.finish();await microtask();f.clean();assert.equal(f.show(),false);assert.equal(f.guide.feedback({layout:f.layout,cells:[1,3,5]}),false);f.unchanged(before);
 }finally{f.close();}
});

test('optional coach host keeps the whole finite hand demonstration outside all real board cells',()=>{
 const f=mount({gestureHost:true});try{
  const before=f.capture(),copy=f.coach.querySelector('#copy'),action=f.coach.querySelector('#existing-action');assert(f.show());
  assert.equal(f.board.querySelector('.first-play-guide-hand'),null,'no hand enters the real board');
  const slot=f.coach.querySelector('.first-play-gesture-slot'),hand=slot.querySelector('.first-play-guide-hand');
  assert(slot&&hand);assert.equal(slot.getAttribute('aria-hidden'),'true');assert.equal(slot.style.pointerEvents,'none');assert.equal(f.w.getComputedStyle(slot).width,'44px');
  assert.equal(slot.querySelector('svg').getAttribute('focusable'),'false');assert.equal(slot.querySelector('[data-index],[tabindex],[role]'),null);
  assert.equal(f.coach.querySelector('#copy'),copy);assert.equal(copy.textContent,'Kaydır veya dokun.');assert.equal(f.coach.querySelector('#existing-action'),action);
  assert.equal(f.layer().querySelectorAll('[data-guide-role]').length,4);assert(f.layer().querySelector('.first-play-guide-arrow'));
  const movement=f.animations.find(a=>a.target===hand);assert(movement);assert.equal(movement.options.duration,1800);assert.equal(movement.options.iterations,1);
  const target=movement.frames.find(frame=>frame.offset===.7).transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\)/);assert(target);assert(Math.abs(Math.hypot(+target[1],+target[2])-20)<1e-9);
  f.unchanged(before);f.guide.stop();f.clean();assert.equal(f.coach.querySelector('.first-play-gesture-slot'),null);assert.equal(f.coach.querySelector('#copy'),copy);assert.equal(f.coach.querySelector('#existing-action'),action);
 }finally{f.close();}
});

test('off-board coach demonstration is static in reduced motion and green feedback adds no hand',()=>{
 const f=mount({gestureHost:true,reduced:true});try{
  assert(f.show());assert(f.coach.querySelector('.first-play-guide-hand'));assert.equal(f.animations.length,0);f.guide.stop();
  f.fill([1,0,1,0,1,0,1]);assert(f.guide.feedback({layout:f.layout,cells:[1,3,5]}));assert.equal(f.coach.querySelector('.first-play-gesture-slot'),null);assert.equal(f.board.querySelector('.first-play-guide-hand'),null);assert.equal(f.animations.length,0);
 }finally{f.close();}
});

test('removing or briefly detaching the coach cancels both owned visuals without reviving an old gesture',async()=>{
 for(const reinsert of [false,true]){const f=mount({gestureHost:true});try{
  const before=f.capture();assert(f.show());const parent=f.coach.parentNode;f.coach.remove();if(reinsert)parent.prepend(f.coach);await microtask();f.clean();assert.equal(f.coach.querySelector('.first-play-gesture-slot'),null);assert(f.animations.every(a=>a.cancelled));f.unchanged(before);
 }finally{f.close();}}
});

test('off-board animation failure and replacement cannot leak coach slots or stale hand callbacks',async()=>{
 const f=mount({gestureHost:true});try{
  const before=f.capture();f.throwNext();assert.equal(f.show(),false);f.clean();assert.equal(f.coach.querySelector('.first-play-gesture-slot'),null);f.unchanged(before);
  assert(f.show());const old=f.animations.slice(),oldSlot=f.coach.querySelector('.first-play-gesture-slot');assert(f.show({mode:'reprompt'}));assert.equal(oldSlot.isConnected,false);assert.equal(f.coach.querySelectorAll('.first-play-gesture-slot').length,1);for(const a of old)a.finish();await microtask();assert(f.guide.isActive());f.guide.destroy();assert.equal(f.coach.querySelector('.first-play-gesture-slot'),null);f.clean();f.unchanged(before);
 }finally{f.close();}
});

test('a detached or board-contained gesture host fails closed without mutating any real tile',()=>{
 const f=mount();try{
  const before=f.capture(),detached=f.w.document.createElement('div');
  for(const host of [detached,f.board]){const guide=f.w.HexFirstPlay.createGuide({board:f.board,gestureHost:host});assert.equal(guide.show(f.descriptor),false);assert.equal(guide.isActive(),false);guide.destroy();}f.unchanged(before);
 }finally{f.close();}
});

test('v2 reveals only the current HUD concept while preserving underlying counter values',()=>{
 const f=mount();try{
  const doc=f.w.document,body=doc.body;body.dataset.screen='game';body.dataset.firstPlayVersion='2';body.dataset.learning='first';
  const hud=doc.createElement('div');hud.className='scoreboard';hud.innerHTML='<div class="goals-panel"><div class="hud-score metric"><strong>6</strong></div><div class="ground-goal"><strong>3 / 7</strong></div></div><div class="moves-badge metric"><strong>4</strong></div>';body.append(hud);
  const score=hud.querySelector('.hud-score'),ground=hud.querySelector('.ground-goal'),moves=hud.querySelector('.moves-badge'),original=hud.textContent;
  body.dataset.onboardingConcept='swap';assert.equal(f.w.getComputedStyle(hud).visibility,'hidden');assert.equal(f.w.getComputedStyle(moves).visibility,'hidden');
  for(const concept of ['ground','score','both']){body.dataset.onboardingConcept=concept;assert.equal(f.w.getComputedStyle(hud).visibility,'visible');assert.equal(f.w.getComputedStyle(moves).visibility,'visible');assert.equal(f.w.getComputedStyle(score).display==='none',concept==='ground');assert.equal(f.w.getComputedStyle(ground).display==='none',concept==='score');assert.equal(hud.textContent,original);}
 }finally{f.close();}
});

test('concept CSS leaves legacy and non-tutorial campaign presentation alone',()=>{
 const f=mount();try{
  const doc=f.w.document,body=doc.body,hud=doc.createElement('div');hud.className='scoreboard';hud.innerHTML='<div class="goals-panel"><div class="hud-score"></div><div class="ground-goal"></div></div><div class="moves-badge metric"></div>';body.append(hud);
  const baseGrid=f.w.getComputedStyle(hud).gridTemplateColumns,baseHeight=f.w.getComputedStyle(hud.querySelector('.moves-badge')).height;body.dataset.screen='game';body.dataset.learning='first';body.dataset.onboardingConcept='swap';assert.equal(f.w.getComputedStyle(hud).visibility,'visible','missingv2 policy retains legacy HUD');
  body.dataset.firstPlayVersion='2';body.dataset.onboardingConcept='';body.dataset.learning='';assert.equal(f.w.getComputedStyle(hud).visibility,'visible');assert.equal(f.w.getComputedStyle(hud).gridTemplateColumns,baseGrid,'campaign grid has no v2 override');assert.equal(f.w.getComputedStyle(hud.querySelector('.moves-badge')).height,baseHeight,'campaign move geometry has no v2 override');
 }finally{f.close();}
});

(async()=>{for(const{name,run}of tests){await run();console.log('PASS '+name);}console.log(`First-play guide checks passed: ${tests.length} cases; real seven-cell hex geometry, no engine/storage/RNG access.`);})().catch(error=>{console.error(error);process.exitCode=1;});
