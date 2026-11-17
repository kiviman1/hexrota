/* Disposable SVG cue boundaries: the real board retains its identities, cell
 * coordinates, paint palette, accessibility and input targets throughout. */
'use strict';
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const Board=require('./dist/board-view.js'),View=require('./dist/idle-hint-view.js');
const tests=[],test=(name,run)=>tests.push({name,run}),tick=async()=>{await Promise.resolve();await Promise.resolve();};

function fixture({reduced=false,failAnimation=0,missingAnimation=false}={}){
 const dom=new JSDOM('<!doctype html><svg id="board" role="group" aria-label="Board"></svg>',{url:'https://hexrota.invalid/'}),win=dom.window,doc=win.document,board=doc.getElementById('board');
 const level={cells:[{q:0,r:0,layers:1},{q:1,r:0,layers:1},{q:0,r:1,layers:1}]},state={values:[1,2,3],layers:[1,1,1]},layout=Board.geometry(level);
 board.setAttribute('viewBox',`${-layout.width/2} ${-layout.height/2} ${layout.width} ${layout.height}`);Board.reconcile(board,Board.markup(level,state,layout));
 const records=[],scheduled=new Map(),allTimers=[],motionListeners=new Set();let serial=0,motion=reduced;
 const media={get matches(){return motion;},addEventListener(type,fn){if(type==='change')motionListeners.add(fn);},removeEventListener(type,fn){if(type==='change')motionListeners.delete(fn);}};
 win.matchMedia=()=>media;
 if(!missingAnimation)win.Element.prototype.animate=function(frames,options){
  if(failAnimation&&records.length+1===failAnimation)throw new Error('injected animation failure');
  let resolve,reject;const finished=new Promise((yes,no)=>{resolve=yes;reject=no;}),record={node:this,frames,options,cancelled:0,resolve,reject};
  const animation={finished,cancel(){record.cancelled++;reject(new Error('cancelled'));}};records.push(record);return animation;
 };
 const view=View.create({board,setTimeout(fn,ms){const id=++serial,task={id,fn,ms};scheduled.set(id,task);allTimers.push(task);return id;},clearTimeout(id){scheduled.delete(id);}});
 return{dom,win,doc,board,level,state,layout,view,records,scheduled,allTimers,motionListeners,
  tiles:()=>Array.from(board.children).filter(node=>node.hasAttribute('data-index')),
  gems:()=>Array.from(board.children).filter(node=>node.hasAttribute('data-index')).map(node=>node.querySelector(':scope > .gem')),
  show(pair=[0,1]){return view.show({pair,layout});},
  fire(){for(const task of [...scheduled.values()]){scheduled.delete(task.id);task.fn();}},
  setMotion(value){motion=value;for(const listener of [...motionListeners])listener({matches:value});},
  close(){view.destroy();win.close();}
 };
}

test('two 450ms reciprocal nudges move only copies by 2.5 screen pixels; original hit targets and cell coordinates stay fixed',async()=>{
 const f=fixture();try{
  // Include scale plus rotation: direction must be measured in screen space.
  const matrix={a:0,b:.6,c:-.6,d:0};f.board.getScreenCTM=()=>matrix;
  const tiles=f.tiles(),gems=f.gems(),floors=tiles.map(tile=>tile.querySelector('.floor-shape')),transforms=tiles.map(tile=>tile.getAttribute('transform')),labels=tiles.map(tile=>tile.getAttribute('aria-label')),snapshot=JSON.stringify({state:f.state,layout:f.layout});
  const cleanup=f.show(),layer=f.board.querySelector('.idle-hint-layer');
  assert.equal(typeof cleanup,'function');assert.equal(layer,f.board.lastElementChild);assert.equal(layer.getAttribute('aria-hidden'),'true');assert.equal(layer.getAttribute('pointer-events'),'none');assert.equal(layer.querySelector('[data-index],[tabindex],#board'),null);
  assert.equal(f.records.length,2);assert.deepEqual(f.gems(),gems);assert.deepEqual(f.tiles(),tiles);assert.deepEqual(tiles.map(tile=>tile.getAttribute('transform')),transforms);assert.deepEqual(tiles.map(tile=>tile.getAttribute('aria-label')),labels);
  assert.deepEqual(tiles.map(tile=>tile.querySelector('.floor-shape')),floors);assert.equal(gems[0].style.opacity,'0');assert.equal(gems[1].style.opacity,'0');assert.equal(gems[2].getAttribute('style'),null);
  assert.deepEqual(Array.from(layer.querySelectorAll('.hex-number')).map(node=>node.textContent),['1','2']);
  for(const record of f.records){
   assert(!gems.includes(record.node),'only decorative copies animate');assert.deepEqual(record.options,{duration:450,iterations:2,easing:'ease-in-out',fill:'none'});
   assert.equal(record.frames[0].transform,'translate(0px,0px)');assert.equal(record.frames[2].transform,'translate(0px,0px)');assert.equal(record.frames[1].offset,.5);
   const [,x,y]=record.frames[1].transform.match(/^translate\(([-.\de]+)px,([- .\de]+)px\)$/).map(Number);
   assert(Math.abs(Math.hypot(matrix.a*x+matrix.c*y,matrix.b*x+matrix.d*y)-2.5)<1e-10,'maximum displacement is exactly 2.5 CSS px');
  }
  const delta=record=>record.frames[1].transform.match(/[-.\de]+(?=px)/g).map(Number),first=delta(f.records[0]),second=delta(f.records[1]);assert.deepEqual(second,first.map(value=>-value));
  let clicked=null;tiles[0].addEventListener('click',event=>{clicked=event.target;});floors[0].dispatchEvent(new f.win.MouseEvent('click',{bubbles:true}));assert.equal(clicked,floors[0],'real floor remains the same input target');
  assert.equal(JSON.stringify({state:f.state,layout:f.layout}),snapshot);assert.equal(f.scheduled.size,1);assert.equal(f.allTimers[0].ms,900);
  // Native animation completion alone performs no board transition or writes.
  f.records.forEach(record=>record.resolve());await tick();assert.equal(f.board.contains(layer),true);assert.deepEqual(f.gems(),gems);f.fire();assert.equal(f.board.querySelector('.idle-hint-layer'),null);assert(gems.every(node=>node.getAttribute('style')===null));assert(f.records.every(record=>record.cancelled===1));
 }finally{f.close();}
});

test('paint is copied before hiding; exact inline opacity, priority and other original styles return',()=>{
 const f=fixture();try{
  const gems=f.gems();gems[0].setAttribute('style','opacity: .65 !important; transform: scale(1); --gem: rgb(1, 2, 3)');gems[0].querySelector('.gem-shape').style.fill='rgb(41, 52, 63)';
  const before=gems.map(node=>node.outerHTML),cleanup=f.show();assert.equal(f.records[0].node.querySelector('.gem-shape').style.fill,'rgb(41, 52, 63)');assert.equal(f.records[0].node.style.opacity,'0.65');
  cleanup();assert.deepEqual(gems.map(node=>node.outerHTML),before,'raw prior style returns exactly');cleanup();assert(f.records.every(record=>record.cancelled===1),'cleanup is idempotent');
 }finally{f.close();}
});

for(const reduced of [false,true])test('custom duration controls '+(reduced?'static outline lifetime':'both reciprocal pulses and cleanup'),()=>{
 const f=fixture({reduced});try{
  const before=f.board.outerHTML;f.view.show({pair:[0,1],layout:f.layout,duration:1200});assert.equal(f.scheduled.size,1);assert.equal(f.allTimers[0].ms,1200);
  if(reduced)assert.equal(f.records.length,0);else{assert.equal(f.records.length,2);assert(f.records.every(record=>record.options.duration===600&&record.options.iterations===2));}
  f.fire();assert.equal(f.board.outerHTML,before);assert.equal(f.scheduled.size,0);
 }finally{f.close();}
});

test('invalid duration leaves an active cue untouched; zero duration immediately cleans without new animation or timer',async()=>{
 const f=fixture();try{
  const before=f.board.outerHTML;f.show();const active=f.board.outerHTML,records=[...f.records],timer=f.allTimers[0];
  for(const duration of [-1,1.5,NaN,Infinity,-Infinity,'900',null,Number.MAX_SAFE_INTEGER+1]){
   assert.throws(()=>f.view.show({pair:[0,1],layout:f.layout,duration}),/invalid_idle_hint_duration/);assert.equal(f.board.outerHTML,active);assert.equal(f.scheduled.get(timer.id),timer);assert(records.every(record=>record.cancelled===0));
  }
  const cleanup=f.view.show({pair:[0,1],layout:f.layout,duration:0});assert.equal(typeof cleanup,'function');cleanup();await tick();assert.equal(f.board.outerHTML,before);assert.equal(f.records.length,2);assert(records.every(record=>record.cancelled===1));assert.equal(f.scheduled.size,0);assert.equal(f.motionListeners.size,0);
  f.show();assert.equal(f.records.length,4,'a later valid cue is not locked by the zero-duration configuration');assert.equal(f.scheduled.size,1);
 }finally{f.close();}
});

test('large safe-integer duration uses bounded cleanup timers without overflowing browser delay',()=>{
 const f=fixture({reduced:true});try{
  const before=f.board.outerHTML;f.view.show({pair:[0,1],layout:f.layout,duration:2147483648});assert.equal(f.allTimers[0].ms,2147483647);f.fire();assert(f.board.querySelector('.idle-hint-layer'));assert.equal(f.scheduled.size,1);assert.equal(f.allTimers[1].ms,1);f.fire();assert.equal(f.board.outerHTML,before);assert.equal(f.scheduled.size,0);
 }finally{f.close();}
});

test('old cleanup and delayed timer/rejection cannot remove a replacement cue',async()=>{
 const f=fixture();try{
  const retire=f.show(),oldTimer=f.allTimers[0],firstRecords=[...f.records];f.show([1,2]);const replacement=f.board.querySelector('.idle-hint-layer');
  retire();oldTimer.fn();firstRecords[0].reject(new Error('late completion'));await tick();assert.equal(f.board.querySelector('.idle-hint-layer'),replacement);assert.equal(f.scheduled.size,1);assert.equal(f.gems()[0].getAttribute('style'),null);assert.equal(f.gems()[1].style.opacity,'0');
  f.view.hide();await tick();assert.equal(f.board.querySelector('.idle-hint-layer'),null);assert(f.gems().every(node=>node.getAttribute('style')===null));assert.equal(f.scheduled.size,0);
 }finally{f.close();}
});

for(const reason of ['reduced motion','missing animation API'])test(reason+' uses two brief static outlines without hidden originals or movement',()=>{
 const f=fixture(reason==='reduced motion'?{reduced:true}:{missingAnimation:true});try{
  const before=f.gems().map(node=>node.outerHTML);f.show();const layer=f.board.querySelector('.idle-hint-layer');assert.equal(layer.getAttribute('data-idle-hint-mode'),'static');assert.equal(layer.querySelectorAll('.idle-hint-outline').length,2);assert.equal(layer.querySelector('.gem'),null);assert.equal(f.records.length,0);assert.deepEqual(f.gems().map(node=>node.outerHTML),before);assert.equal(f.allTimers[0].ms,900);f.fire();assert.equal(f.board.querySelector('.idle-hint-layer'),null);assert.deepEqual(f.gems().map(node=>node.outerHTML),before);
 }finally{f.close();}
});

test('animation throw after a partial start restores every original and cancels started work',async()=>{
 const f=fixture({failAnimation:2});try{
  const before=f.board.outerHTML,gems=f.gems();assert.throws(()=>f.show(),/injected animation failure/);await tick();assert.equal(f.board.outerHTML,before);assert.deepEqual(f.gems(),gems);assert.equal(f.records[0].cancelled,1);assert.equal(f.scheduled.size,0);assert.equal(f.motionListeners.size,0);
 }finally{f.close();}
});

test('native animation rejection retires only decoration and restores originals',async()=>{
 const f=fixture();try{const before=f.board.outerHTML;f.show();f.records[1].reject(new Error('native animation failure'));await tick();assert.equal(f.board.outerHTML,before);assert.equal(f.scheduled.size,0);assert(f.records.every(record=>record.cancelled===1));}finally{f.close();}
});

for(const event of ['visibility','pagehide','motion'])test(event+' removes all temporary paint and listeners immediately',()=>{
 const f=fixture();try{
  const before=f.board.outerHTML;f.show();
  if(event==='visibility'){Object.defineProperty(f.doc,'hidden',{configurable:true,value:true});f.doc.dispatchEvent(new f.win.Event('visibilitychange'));}
  else if(event==='pagehide')f.win.dispatchEvent(new f.win.Event('pagehide'));else f.setMotion(true);
  assert.equal(f.board.outerHTML,before);assert.equal(f.scheduled.size,0);assert.equal(f.motionListeners.size,0);assert(f.records.every(record=>record.cancelled===1));
 }finally{f.close();}
});

test('unexpected real-board reconciliation removes cue ownership without rebuilding survivors',async()=>{
 const f=fixture();try{
  const gems=f.gems(),tiles=f.tiles();f.show();await tick();assert(f.board.querySelector('.idle-hint-layer'),'view does not observe its own construction');
  Board.reconcile(f.board,Board.markup(f.level,f.state,f.layout,{selected:2,focusIndex:2}));await tick();assert.equal(f.board.querySelector('.idle-hint-layer'),null);assert.deepEqual(f.gems(),gems);assert.deepEqual(f.tiles(),tiles);assert(f.gems().every(node=>node.getAttribute('style')===null));assert.equal(f.scheduled.size,0);assert(f.records.every(record=>record.cancelled===1));
 }finally{f.close();}
});

test('cleanup preserves a later visual owner style and detached original safety',()=>{
 const f=fixture();try{
  const gems=f.gems(),cleanup=f.show();gems[0].style.opacity='.4';gems[0].style.transform='scale(.8)';const laterTransform=gems[0].style.transform;gems[1].remove();cleanup();assert.equal(gems[0].style.opacity,'0.4');assert.equal(gems[0].style.transform,laterTransform);assert.equal(gems[1].getAttribute('style'),null);assert.equal(f.board.querySelector('.idle-hint-layer'),null);
 }finally{f.close();}
});

test('invalid geometry rejects without residual mutation; destroy is permanent and idempotent',()=>{
 const f=fixture();try{
  const before=f.board.outerHTML;for(const pair of [null,[0],[0,0],[-1,1],[0,99],[0,1.5]]){assert.throws(()=>f.view.show({pair,layout:f.layout}),TypeError);assert.equal(f.board.outerHTML,before);}
  assert.throws(()=>f.view.show({pair:[0,1],layout:{positions:[{x:0,y:0},{x:Infinity,y:0}]}}),TypeError);assert.equal(f.board.outerHTML,before);
  f.show();f.view.destroy();f.view.destroy();f.show();assert.equal(f.board.outerHTML,before);assert.equal(f.scheduled.size,0);
 }finally{f.close();}
});

(async()=>{for(const{name,run}of tests){await run();console.log('PASS '+name);}console.log(`Idle hint view checks: ${tests.length} groups passed; original identities/geometry/targets, screen-space two-pulse limit, static reduced motion, cancellation and visual faults.`);})().catch(error=>{console.error(error);process.exitCode=1;});
