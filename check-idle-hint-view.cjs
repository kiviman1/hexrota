/* Disposable SVG cue boundaries: the real board retains its identities, cell
 * coordinates, paint palette, accessibility and input targets throughout. */
'use strict';
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const Board=require('./dist/board-view.js'),View=require('./dist/idle-hint-view.js');
const tests=[],test=(name,run)=>tests.push({name,run}),tick=async()=>{await Promise.resolve();await Promise.resolve();};

const cue=(pair=[0,1])=>pair[0]===0?{pair,matched:[0,1,2,3,4,5],matchingSources:[0,1,2,3,4,5],focusMatched:[1,2,3],focusSources:[0,2,3],movingSource:0,movingTarget:1}:{pair,matched:[0,1,2,3,4,5],matchingSources:[0,1,2,3,4,5],focusMatched:[0,4,5],focusSources:[1,4,5],movingSource:1,movingTarget:0};
function fixture({reduced=false,failAnimation=0,missingAnimation=false,group=false,caseConfig=null}={}){
 const dom=new JSDOM('<!doctype html><svg id="board" role="group" aria-label="Board"></svg>',{url:'https://hexrota.invalid/'}),win=dom.window,doc=win.document,board=doc.getElementById('board');
 const cells=[{q:0,r:0,layers:1},{q:1,r:0,layers:1},{q:1,r:1,layers:1},{q:1,r:2,layers:1},{q:0,r:1,layers:1},{q:0,r:2,layers:1}];
 const level=caseConfig?caseConfig.level:group?{rulesVersion:'classic-v5',cells:cells.concat([{q:2,r:0,layers:1},{q:2,r:1,layers:1}]),obstacles:{version:'obstacles-v1',blockers:[{id:'box',cell:6,hp:2}],regions:[]}}:{cells};
 const state=caseConfig?{values:level.initial.slice(),layers:level.cells.map(c=>c.layers),blockerHp:level.obstacles.blockers.map(b=>b.hp),regionOpen:level.obstacles.regions.map(()=>false)}:group?{values:[4,3,4,4,3,3,null,2],layers:Array(8).fill(1),blockerHp:[2],regionOpen:[]}:{values:[4,3,4,4,3,3],layers:Array(6).fill(1)},layout=Board.geometry(level);
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
  show(pair=[0,1]){return view.show({...cue(pair),layout});},
  fire(){for(const task of [...scheduled.values()]){scheduled.delete(task.id);task.fn();}},
  setMotion(value){motion=value;for(const listener of [...motionListeners])listener({matches:value});},
  close(){view.destroy();win.close();}
 };
}

test('one 900ms approach moves only the matching 4 toward the untouched 3; other matching 4s pulse in place',async()=>{
 const f=fixture();try{
  const matrix={a:0,b:.6,c:-.6,d:0};f.board.getScreenCTM=()=>matrix;
  const tiles=f.tiles(),gems=f.gems(),floors=tiles.map(tile=>tile.querySelector('.floor-shape')),transforms=tiles.map(tile=>tile.getAttribute('transform')),labels=tiles.map(tile=>tile.getAttribute('aria-label')),snapshot=JSON.stringify({state:f.state,layout:f.layout}),partner=gems[1].outerHTML;
  const cleanup=f.show(),layer=f.board.querySelector('.idle-hint-layer');
  assert.equal(typeof cleanup,'function');assert.equal(layer,f.board.lastElementChild);assert.equal(layer.getAttribute('aria-hidden'),'true');assert.equal(layer.getAttribute('pointer-events'),'none');assert.equal(layer.querySelector('[data-index],[tabindex],#board'),null);
  assert.equal(f.records.length,6);assert.deepEqual(f.gems(),gems);assert.deepEqual(f.tiles(),tiles);assert.deepEqual(tiles.map(tile=>tile.getAttribute('transform')),transforms);assert.deepEqual(tiles.map(tile=>tile.getAttribute('aria-label')),labels);assert.deepEqual(tiles.map(tile=>tile.querySelector('.floor-shape')),floors);
  for(const i of [0,2,3])assert.equal(gems[i].style.opacity,'0');for(const i of [1,4,5])assert.equal(gems[i].getAttribute('style'),null);assert.equal(gems[1].outerHTML,partner);
  assert.deepEqual(Array.from(layer.querySelectorAll('.hex-number')).map(node=>node.textContent),['4','4','4']);assert.equal(layer.querySelector('[data-idle-hint-source="1"]'),null);
  const motionRecords=f.records.filter(record=>'transform' in record.frames[0]),moving=motionRecords.filter(record=>record.node.parentElement.dataset.idleHintRole==='moving'),sheens=f.records.filter(record=>'opacity' in record.frames[0]);assert.equal(motionRecords.length,3);assert.equal(moving.length,1);assert.equal(sheens.length,3);
  const record=moving[0];assert(!gems.includes(record.node));assert.deepEqual(record.options,{duration:900,iterations:1,easing:'ease-in-out',fill:'none'});assert.equal(record.frames[0].transform,'translate(0px,0px) scale(1)');assert.equal(record.frames[2].transform,'translate(0px,0px) scale(1)');assert.equal(record.frames[1].offset,.5);
  const [,x,y]=record.frames[1].transform.match(/^translate\(([-.\de]+)px,([- .\de]+)px\) scale\(1.07\)$/).map(Number);assert(Math.abs(Math.hypot(matrix.a*x+matrix.c*y,matrix.b*x+matrix.d*y)-2.5)<1e-10);
  const direction={x:f.layout.positions[1].x-f.layout.positions[0].x,y:f.layout.positions[1].y-f.layout.positions[0].y};assert(x*direction.x+y*direction.y>0,'only the moved 4 approaches the 3');
  for(const other of motionRecords.filter(r=>r!==record))assert.deepEqual(other.frames,[{transform:'scale(1)'},{transform:'scale(1.05)',offset:.5},{transform:'scale(1)'}]);assert(f.records.every(r=>r.frames.every(frame=>!Object.hasOwn(frame,'filter'))));
  let clicked=null;tiles[0].addEventListener('click',event=>{clicked=event.target;});floors[0].dispatchEvent(new f.win.MouseEvent('click',{bubbles:true}));assert.equal(clicked,floors[0]);assert.equal(JSON.stringify({state:f.state,layout:f.layout}),snapshot);assert.equal(f.scheduled.size,1);assert.equal(f.allTimers[0].ms,900);
  f.records.forEach(r=>r.resolve());await tick();assert.equal(f.board.contains(layer),true);assert.deepEqual(f.gems(),gems);f.fire();assert.equal(f.board.querySelector('.idle-hint-layer'),null);assert(gems.every(node=>node.getAttribute('style')===null));assert(f.records.every(r=>r.cancelled===1));
 }finally{f.close();}
});

test('paint is copied before hiding; exact inline opacity, priority and other original styles return',()=>{
 const f=fixture();try{
  const gems=f.gems();gems[0].setAttribute('style','opacity: .65 !important; transform: scale(1); --gem: rgb(1, 2, 3)');gems[0].querySelector('.gem-shape').style.fill='rgb(41, 52, 63)';
  const before=gems.map(node=>node.outerHTML),cleanup=f.show();assert.equal(f.records[0].node.querySelector('.gem-shape').style.fill,'rgb(41, 52, 63)');assert.equal(f.records[0].node.style.opacity,'0.65');
  cleanup();assert.deepEqual(gems.map(node=>node.outerHTML),before,'raw prior style returns exactly');cleanup();assert(f.records.every(record=>record.cancelled===1),'cleanup is idempotent');
 }finally{f.close();}
});

for(const reduced of [false,true])test('custom duration controls '+(reduced?'static outline lifetime':'single matching-source approach and cleanup'),()=>{
 const f=fixture({reduced});try{
  const before=f.board.outerHTML;f.view.show({...cue(),layout:f.layout,duration:1200});assert.equal(f.scheduled.size,1);assert.equal(f.allTimers[0].ms,1200);
  if(reduced)assert.equal(f.records.length,0);else{assert.equal(f.records.length,6);assert(f.records.every(record=>record.options.duration===1200&&record.options.iterations===1));}
  f.fire();assert.equal(f.board.outerHTML,before);assert.equal(f.scheduled.size,0);
 }finally{f.close();}
});

test('invalid duration leaves an active cue untouched; zero duration immediately cleans without new animation or timer',async()=>{
 const f=fixture();try{
  const before=f.board.outerHTML;f.show();const active=f.board.outerHTML,records=[...f.records],timer=f.allTimers[0];
  for(const duration of [-1,1.5,NaN,Infinity,-Infinity,'900',null,Number.MAX_SAFE_INTEGER+1]){
   assert.throws(()=>f.view.show({...cue(),layout:f.layout,duration}),/invalid_idle_hint_duration/);assert.equal(f.board.outerHTML,active);assert.equal(f.scheduled.get(timer.id),timer);assert(records.every(record=>record.cancelled===0));
  }
  const cleanup=f.view.show({...cue(),layout:f.layout,duration:0});assert.equal(typeof cleanup,'function');cleanup();await tick();assert.equal(f.board.outerHTML,before);assert.equal(f.records.length,6);assert(records.every(record=>record.cancelled===1));assert.equal(f.scheduled.size,0);assert.equal(f.motionListeners.size,0);
  f.show();assert.equal(f.records.length,12,'a later valid cue is not locked by the zero-duration configuration');assert.equal(f.scheduled.size,1);
 }finally{f.close();}
});

test('large safe-integer duration uses bounded cleanup timers without overflowing browser delay',()=>{
 const f=fixture({reduced:true});try{
  const before=f.board.outerHTML;f.view.show({...cue(),layout:f.layout,duration:2147483648});assert.equal(f.allTimers[0].ms,2147483647);f.fire();assert(f.board.querySelector('.idle-hint-layer'));assert.equal(f.scheduled.size,1);assert.equal(f.allTimers[1].ms,1);f.fire();assert.equal(f.board.outerHTML,before);assert.equal(f.scheduled.size,0);
 }finally{f.close();}
});

test('old cleanup and delayed timer/rejection cannot remove a replacement cue',async()=>{
 const f=fixture();try{
  const retire=f.show(),oldTimer=f.allTimers[0],firstRecords=[...f.records];f.show([1,0]);const replacement=f.board.querySelector('.idle-hint-layer');
  retire();oldTimer.fn();firstRecords[0].reject(new Error('late completion'));await tick();assert.equal(f.board.querySelector('.idle-hint-layer'),replacement);assert.equal(f.scheduled.size,1);assert.equal(f.gems()[0].getAttribute('style'),null);assert.equal(f.gems()[1].style.opacity,'0');
  f.view.hide();await tick();assert.equal(f.board.querySelector('.idle-hint-layer'),null);assert(f.gems().every(node=>node.getAttribute('style')===null));assert.equal(f.scheduled.size,0);
 }finally{f.close();}
});

for(const reason of ['reduced motion','missing animation API'])test(reason+' uses matching-only static outlines without hidden originals or movement',()=>{
 const f=fixture(reason==='reduced motion'?{reduced:true}:{missingAnimation:true});try{
  const before=f.gems().map(node=>node.outerHTML);f.show();const layer=f.board.querySelector('.idle-hint-layer');assert.equal(layer.getAttribute('data-idle-hint-mode'),'static');assert.equal(layer.querySelectorAll('.idle-hint-outline').length,3);assert.equal(layer.querySelector('.gem'),null);assert.equal(f.records.length,0);assert.deepEqual(f.gems().map(node=>node.outerHTML),before);assert.equal(f.allTimers[0].ms,900);f.fire();assert.equal(f.board.querySelector('.idle-hint-layer'),null);assert.deepEqual(f.gems().map(node=>node.outerHTML),before);
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

for(const event of ['visibility','pagehide','motion','resize','orientationchange','blur'])test(event+' removes all temporary paint and listeners immediately',()=>{
 const f=fixture();try{
  const before=f.board.outerHTML;f.show();
  if(event==='visibility'){Object.defineProperty(f.doc,'hidden',{configurable:true,value:true});f.doc.dispatchEvent(new f.win.Event('visibilitychange'));}
  else if(event==='motion')f.setMotion(true);else f.win.dispatchEvent(new f.win.Event(event));
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
  const before=f.board.outerHTML;for(const pair of [null,[0],[0,0],[-1,1],[0,99],[0,1.5]]){assert.throws(()=>f.view.show({...cue(),pair,layout:f.layout}),TypeError);assert.equal(f.board.outerHTML,before);}
  assert.throws(()=>f.view.show({...cue(),layout:{positions:[{x:0,y:0},{x:Infinity,y:0}]}}),TypeError);assert.equal(f.board.outerHTML,before);
  f.show();f.view.destroy();f.view.destroy();f.show();assert.equal(f.board.outerHTML,before);assert.equal(f.scheduled.size,0);
 }finally{f.close();}
});

const descriptor=()=>({...cue(),focusSources:[0,2,2,3],blockers:[6,6]});

test('frozen focus descriptor deduplicates only the intended 4s and leaves full-wave 3s and crates unpainted',async()=>{
 const f=fixture({group:true});try{
  const tiles=f.tiles(),gems=f.gems(),before=f.board.outerHTML,otherBefore=[1,4,5,6,7].map(i=>tiles[i].outerHTML),box=tiles[6].querySelector('.blocker-visual'),boxBefore=box.outerHTML;
  const input=descriptor();for(const value of Object.values(input))if(Array.isArray(value))Object.freeze(value);Object.freeze(input);f.view.show({...input,layout:f.layout});const layer=f.board.querySelector('.idle-hint-layer');
  assert.deepEqual(Array.from(layer.querySelectorAll('[data-idle-hint-role="moving"]')).map(n=>Number(n.dataset.idleHintSource)),[0]);assert.deepEqual(Array.from(layer.querySelectorAll('[data-idle-hint-role="match"]')).map(n=>Number(n.dataset.idleHintSource)),[2,3]);
  assert.equal(layer.querySelector('.idle-hint-blocker,.idle-hint-blocker-outline,[data-idle-hint-role="blocker"]'),null);for(const i of [1,4,5,6,7])assert.equal(layer.querySelector(`[data-idle-hint-source="${i}"]`),null);
  assert.equal(f.records.length,6);for(const record of f.records){assert.equal(record.options.duration,900);assert.equal(record.options.iterations,1);assert(record.frames.every(frame=>Object.keys(frame).every(key=>['transform','opacity','offset'].includes(key))));}
  for(const record of f.records.filter(r=>'transform' in r.frames[0]).slice(1))assert.deepEqual(record.frames,[{transform:'scale(1)'},{transform:'scale(1.05)',offset:.5},{transform:'scale(1)'}]);
  assert.deepEqual(Array.from(layer.querySelectorAll('.hex-number')).map(n=>n.textContent),['4','4','4']);assert.equal(box.outerHTML,boxBefore);assert.deepEqual(f.tiles(),tiles);assert.deepEqual(f.gems(),gems);assert.deepEqual([1,4,5,6,7].map(i=>tiles[i].outerHTML),otherBefore);
  await tick();assert(f.board.contains(layer));f.fire();await tick();assert.equal(f.board.outerHTML,before);assert.equal(f.scheduled.size,0);assert(f.records.every(r=>r.cancelled===1));
 }finally{f.close();}
});

test('cheap brightness stays below only the focused numerals with bounded opacity and no filters',async()=>{
 const f=fixture({group:true});try{
  const before=f.board.outerHTML;f.view.show({...descriptor(),layout:f.layout});const layer=f.board.querySelector('.idle-hint-layer'),sheens=f.records.filter(r=>'opacity' in r.frames[0]);assert.equal(sheens.length,3);assert.equal(layer.querySelectorAll('.idle-hint-sheen').length,3);
  for(const record of sheens){const polygon=record.node,gem=polygon.parentElement,number=gem.querySelector('.hex-number'),role=gem.parentElement.dataset.idleHintRole;assert.equal(polygon.localName,'polygon');assert.equal(polygon.getAttribute('fill'),'#fff');assert.equal(polygon.getAttribute('stroke'),'none');assert(polygon.compareDocumentPosition(number)&f.win.Node.DOCUMENT_POSITION_FOLLOWING);assert.equal(polygon.getAttribute('points'),gem.querySelector('.gem-shape').getAttribute('points'));assert.deepEqual(record.frames,[{opacity:0},{opacity:role==='moving'?.08:.05,offset:.5},{opacity:0}]);assert.deepEqual(record.options,{duration:900,iterations:1,easing:'ease-in-out',fill:'none'});}
  assert(f.records.every(r=>r.frames.every(frame=>!Object.hasOwn(frame,'filter'))));f.view.hide();await tick();assert.equal(f.board.outerHTML,before);assert(f.records.every(r=>r.cancelled===1));
 }finally{f.close();}
});

test('show copies focus fields so later caller mutations cannot redirect the matching group or old timer',async()=>{
 const f=fixture({group:true});try{
  const input=descriptor(),before=f.board.outerHTML;f.view.show({...input,layout:f.layout});const layer=f.board.querySelector('.idle-hint-layer');input.pair.reverse();input.focusSources.fill(7);input.matchingSources.fill(5);input.blockers.length=0;input.movingSource=1;
  await tick();assert.deepEqual(Array.from(layer.querySelectorAll('[data-idle-hint-role="match"]')).map(n=>Number(n.dataset.idleHintSource)),[2,3]);assert.equal(layer.querySelector('.idle-hint-blocker-outline'),null);f.view.hide();assert.equal(f.board.outerHTML,before);
 }finally{f.close();}
});

for(const reduced of [true,false])test((reduced?'reduced motion':'missing animation')+' outlines only focused 4s without touching 3s or crates',()=>{
 const f=fixture({group:true,reduced,missingAnimation:!reduced});try{
  const gems=f.gems(),before=f.board.outerHTML,gemBefore=gems.map(g=>g.outerHTML),box=f.tiles()[6].querySelector('.blocker-visual'),boxBefore=box.outerHTML;f.view.show({...descriptor(),layout:f.layout});const layer=f.board.querySelector('.idle-hint-layer');assert.equal(layer.dataset.idleHintMode,'static');assert.equal(layer.querySelectorAll('.idle-hint-outline').length,3);assert.equal(layer.querySelector('.idle-hint-blocker-outline,[data-idle-hint-source="1"],[data-idle-hint-source="4"],[data-idle-hint-source="5"],[data-idle-hint-source="6"]'),null);assert.equal(layer.querySelector('.gem'),null);assert.equal(f.records.length,0);assert.deepEqual(gems.map(g=>g.outerHTML),gemBefore);assert.equal(box.outerHTML,boxBefore);f.fire();assert.equal(f.board.outerHTML,before);
 }finally{f.close();}
});

test('focus animation throw and rejection restore every selected source and retire all owned work',async()=>{
 for(const mode of ['throw','reject']){const f=fixture({group:true,failAnimation:mode==='throw'?5:0});try{const before=f.board.outerHTML;if(mode==='throw')assert.throws(()=>f.view.show({...descriptor(),layout:f.layout}),/injected animation failure/);else{f.view.show({...descriptor(),layout:f.layout});f.records[4].reject(new Error('group rejection'));}await tick();assert.equal(f.board.outerHTML,before);assert.equal(f.scheduled.size,0);assert(f.records.every(r=>r.cancelled===1));}finally{f.close();}}
});

test('missing focus or invalid selected sources fail closed without disturbing a valid cue',()=>{
 const f=fixture({group:true});try{
  f.show();const before=f.board.outerHTML,timers=f.scheduled.size;
  for(const change of [x=>delete x.focusSources,x=>delete x.focusMatched,x=>delete x.movingSource,x=>delete x.movingTarget,x=>x.focusSources=[0,2,6],x=>x.focusSources=[0,2,99],x=>x.focusSources=[0,1,2],x=>x.movingSource=7,x=>x.movingTarget=3,x=>x.focusMatched=[2,3],x=>x.blockers=[99],x=>x.matched=[-1],x=>x.focusSources=Array(3)]){const input=descriptor();change(input);assert.throws(()=>f.view.show({...input,layout:f.layout}),TypeError);assert.equal(f.board.outerHTML,before);assert.equal(f.scheduled.size,timers);}
 }finally{f.close();}
});

test('real board paint changes retire a focused cue while owned-decoration changes do not self-cancel',async()=>{
 const f=fixture({group:true});try{const before=f.board.outerHTML;f.view.show({...descriptor(),layout:f.layout});const layer=f.board.querySelector('.idle-hint-layer');layer.querySelector('.idle-hint-outline').setAttribute('opacity','.5');await tick();assert.equal(f.board.querySelector('.idle-hint-layer'),layer);f.tiles()[7].setAttribute('data-rendered','changed');await tick();assert.equal(f.board.querySelector('.idle-hint-layer'),null);f.tiles()[7].removeAttribute('data-rendered');assert.equal(f.board.outerHTML,before);assert.equal(f.scheduled.size,0);}finally{f.close();}
});

for(const item of require('./fixtures/idle-focus-v1.json').cases)for(const reduced of [false,true])test(item.id+' 3↔4 fixture '+(reduced?'static':'motion')+' leaves the nonfocused endpoint and adjacent crate byte-exact',async()=>{
 const f=fixture({caseConfig:item,reduced});try{
  const before=f.board.outerHTML,tiles=f.tiles(),gems=f.gems(),partner=tiles[item.expected.movingTarget].outerHTML,crateCells=item.level.obstacles.blockers.map(box=>box.cell),crates=crateCells.map(i=>tiles[i].outerHTML),input={pair:item.pair,...item.expected};f.view.show({...input,layout:f.layout});const layer=f.board.querySelector('.idle-hint-layer'),sources=Array.from(layer.children).map(n=>Number(n.dataset.idleHintSource));assert.deepEqual(sources.slice().sort((a,b)=>a-b),item.expected.focusSources);assert.equal(layer.querySelector('.idle-hint-blocker-outline,[data-idle-hint-role="blocker"]'),null);assert.equal(tiles[item.expected.movingTarget].outerHTML,partner);assert.deepEqual(crateCells.map(i=>tiles[i].outerHTML),crates);for(const i of item.expected.matchingSources.filter(i=>!item.expected.focusSources.includes(i)))assert.equal(layer.querySelector(`[data-idle-hint-source="${i}"]`),null);
  if(reduced)assert.equal(f.records.length,0);else{assert.deepEqual(Array.from(layer.querySelectorAll('.hex-number')).map(n=>n.textContent),Array(item.expected.focusSources.length).fill(String(item.level.initial[item.expected.movingSource])));const moved=f.records.filter(r=>r.frames[0].transform?.startsWith('translate('));assert.equal(moved.length,1);assert.equal(Number(moved[0].node.parentElement.dataset.idleHintSource),item.expected.movingSource);assert.equal(layer.querySelector(`[data-idle-hint-source="${item.expected.movingTarget}"]`),null);}
  assert.deepEqual(f.gems(),gems);await tick();f.fire();await tick();assert.equal(f.board.outerHTML,before);
 }finally{f.close();}
});

(async()=>{for(const{name,run}of tests){await run();console.log('PASS '+name);}console.log(`Idle hint view checks: ${tests.length} groups passed; original identities/geometry/targets, one-way matching-only scale/group limits, static reduced motion, cancellation and visual faults.`);})().catch(error=>{console.error(error);process.exitCode=1;});
