/* Presentation-only first-play copy and reciprocal SVG demonstration checks. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const source=name=>fs.readFileSync(path.join(__dirname,'dist',name),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const frozen=value=>{if(value&&typeof value==='object'){for(const item of Object.values(value))frozen(item);Object.freeze(value);}return value;};
const tests=[];
function test(name,run){tests.push({name,run});}

function mount({reduced=false,animate=true}={}){
 const dom=new JSDOM('<svg id="board" xmlns="http://www.w3.org/2000/svg"></svg>',{url:'https://hexrota-first-play.example/',runScripts:'outside-only'}),w=dom.window;
 try{
  const board=w.document.getElementById('board'),animations=[];let animationCalls=0,throwAt=0,motion=reduced;
  w.eval(source('board-view.js'));
  for(const name of ['HexMatch','engine','localStorage','sessionStorage'])Object.defineProperty(w,name,{configurable:true,get(){throw Error('Presentation accessed '+name);}});
  w.Math.random=()=>{throw Error('Presentation consumed RNG');};
  w.eval(source('first-play.js'));
  const model=frozen({values:[2,1,3],layers:[1,1,1],score:0,movesLeft:5,rng:31676});
  const level=frozen({cells:[{q:0,r:0,layers:1},{q:1,r:0,layers:1},{q:0,r:1,layers:1}]}),pair=frozen([0,1]);
  const layout=frozen(w.HexBoardView.geometry(level,true)),paths=frozen(w.HexBoardView.swapPaths(layout,...pair));
  const modelBefore=JSON.stringify(model),inputBefore=JSON.stringify({layout,pair,paths});
  function fill(){board.innerHTML=w.HexBoardView.markup(level,model,layout,{guided:{pair,matchIndices:[0,1,2]}});}
  fill();
  if(animate)w.SVGElement.prototype.animate=function(frames,options){
   animationCalls++;
   if(animationCalls===throwAt)throw Error('test-only animation interruption');
   const animation=new w.EventTarget();let reject;
   Object.assign(animation,{target:this,frames,options,cancelled:false,finished:new Promise((resolve,no)=>{reject=no;}),cancel(){
    if(this.cancelled)return;
    this.cancelled=true;this.dispatchEvent(new w.Event('cancel'));reject(new Error('Animation cancelled'));
   }});
   animations.push(animation);return animation;
  };
  const demo=w.HexFirstPlay.createDemo({board,reducedMotion:()=>motion});
  const originals=()=>[...board.querySelectorAll('.hex-tile[data-index] .gem')];
  function unchanged(){
   assert.equal(JSON.stringify(model),modelBefore,'presentation leaves game values, layers, score, moves and RNG unchanged');
   assert.equal(JSON.stringify({layout,pair,paths}),inputBefore,'presentation leaves supplied geometry, pair and paths unchanged');
   assert.deepEqual([...board.querySelectorAll('.hex-tile[data-index] .hex-number')].map(n=>n.textContent),model.values.map(String),'original tile numbers do not move');
  }
  function clean(){assert.equal(demo.isActive(),false);assert.equal(board.querySelectorAll('.tutorial-demo-layer').length,0);}
  return {w,board,demo,animations,layout,pair,paths,originals,fill,unchanged,clean,
   show:()=>demo.show({layout,pair,paths}),setReduced:value=>motion=value,
   throwNextSecond(){throwAt=animationCalls+2;},close(){demo.stop();w.close();}};
 }catch(error){w.close();throw error;}
}

test('copy follows the exact lesson turn and the previous result while feedback or animation is shown',()=>{
 const f=mount();try{
  const copy=f.w.HexFirstPlay.copy;
  assert.deepEqual(plain(copy('learn-1',0)),{title:'2’yi 1’in yerine kaydır',text:'Aynı sayıdan üç taş yan yana gelsin.'});
  assert.equal(copy('learn-1',1).title,'Bir eşleşme daha yap');
  assert.deepEqual(plain(copy('learn-1',1,{feedback:true})),{title:'İlk eşleşmen!',text:'2 + 2 + 2 = 6 puan. Üç taşın altı yeşerdi.'});
  assert.equal(copy('learn-1',2,{busy:true}).title,'Yeşil yerler kalır');
  assert.equal(copy('learn-2',0).title,'İki noktalı yeri yeşert');
  assert.equal(copy('learn-2',2,{feedback:true}).title,'Zincir eşleşme!');
  assert.equal(copy('learn-2',3,{busy:true}).title,'Puan hedefi tamam!');
  assert.equal(copy('learn-2',4,{feedback:true}).title,'Görev tamam!');
  assert.equal(copy('learn-1',-1).title,copy('learn-1',0).title);
  assert.equal(copy('learn-1',NaN).title,copy('learn-1',0).title);
  assert.equal(copy('learn-2',99).title,'Son yeri yeşert');
  assert.equal(copy('campaign-1',0),null);
  assert(Object.isFrozen(copy('learn-1',0)),'callers cannot rewrite shared lesson copy');
 }finally{f.close();}
});

test('two noninteractive numeric ghosts preserve source identity above floors and below the hand',()=>{
 const f=mount();try{
  const originals=f.originals(),floorNodes=[...f.board.querySelectorAll('.floor-shape')],existingLayers=[...f.board.children].filter(n=>n.matches('.tutorial-gesture,.fx-layer,.swap-layer'));
  originals[0].id='first-original';originals[0].querySelector('.hex-number').setAttribute('tabindex','0');
  assert.equal(f.show(),true);assert.equal(f.demo.isActive(),true);f.unchanged();
  const layer=f.board.querySelector('.tutorial-demo-layer'),stones=[...layer.querySelectorAll('.tutorial-demo-stone')];
  assert.equal(layer.getAttribute('aria-hidden'),'true');assert.equal(layer.getAttribute('pointer-events'),'none');assert.equal(layer.style.pointerEvents,'none');
  assert.equal(stones.length,2);assert.equal(layer.querySelectorAll('.gem').length,2);
  assert(stones[0].classList.contains('value-2'));assert(stones[1].classList.contains('value-1'));
  assert.deepEqual([...layer.querySelectorAll('.hex-number')].map(n=>n.textContent),['2','1']);
  assert.equal(layer.querySelectorAll('[id],[tabindex],[role],[data-index]').length,0,'clones cannot impersonate selectable board cells');
  assert(layer.compareDocumentPosition(f.board.querySelector('.tutorial-gesture'))&f.w.Node.DOCUMENT_POSITION_FOLLOWING,'the hand paints after the moving ghosts');
  assert.deepEqual([...f.board.querySelectorAll('.floor-shape')],floorNodes,'original floor nodes stay mounted');
  assert.deepEqual([...f.board.children].filter(n=>n.matches('.tutorial-gesture,.fx-layer,.swap-layer')),existingLayers,'existing gesture, FX and real swap layers keep their order');
  assert.equal(f.board.querySelectorAll('.tutorial-demo-source').length,2);
  for(const original of originals.slice(0,2))assert.equal(original.style.visibility,'hidden');
  assert.equal(originals[2].style.visibility,'','the third stone is never hidden');
  assert.equal(originals[0].id,'first-original','source attributes stay intact');
 }finally{f.close();}
});

test('both reciprocal routes have a slow loop, a swapped hold and a hidden reset',()=>{
 const f=mount();try{
  assert(f.show());assert.equal(f.animations.length,2);
  for(const [index,animation]of f.animations.entries()){
   assert.equal(animation.target.classList.contains('tutorial-demo-mover'),true);
   assert.equal(animation.options.duration,3800);assert.equal(animation.options.iterations,Infinity);
   const frames=animation.frames,path=f.paths[index];
   assert.equal(frames[0].offset,0);assert.equal(frames.at(-1).offset,1);
   for(let n=1;n<frames.length;n++)assert(frames[n].offset>=frames[n-1].offset,'keyframe offsets increase');
   for(const frame of path)assert(frames.some(actual=>actual.transform===frame.transform&&actual.opacity===1),'every reciprocal curve point remains visible');
   assert(frames.some(frame=>frame.offset===.77&&frame.transform===path.at(-1).transform&&frame.opacity===1),'target position holds before resetting');
   assert(frames.some(frame=>frame.offset===.92&&frame.transform===path[0].transform&&frame.opacity===0),'reset happens while the clone is invisible');
  }
  assert.notEqual(f.paths[0].at(-1).transform,f.paths[1].at(-1).transform,'the two stones travel opposite routes');f.unchanged();
 }finally{f.close();}
});

test('stop restores previous source classes and inline styles and can be repeated safely',()=>{
 const f=mount();try{
  const originals=f.originals();
  originals[0].style.setProperty('visibility','visible','important');originals[0].style.opacity='.7';
  originals[1].classList.add('tutorial-demo-source');
  assert(f.show());f.demo.stop();f.demo.stop();f.clean();f.unchanged();
  assert.equal(originals[0].classList.contains('tutorial-demo-source'),false);
  assert.equal(originals[1].classList.contains('tutorial-demo-source'),true,'pre-existing source class is preserved');
  assert.equal(originals[0].style.getPropertyValue('visibility'),'visible');
  assert.equal(originals[0].style.getPropertyPriority('visibility'),'important');assert.equal(originals[0].style.opacity,'0.7');
  assert.equal(originals[1].style.visibility,'');assert(f.animations.every(animation=>animation.cancelled));
 }finally{f.close();}
});

test('starting another demonstration cancels the old one without duplicate layers',()=>{
 const f=mount();try{
  assert(f.show());const first=f.animations.slice();assert(f.show());
  assert(first.every(animation=>animation.cancelled));assert.equal(f.animations.filter(animation=>!animation.cancelled).length,2);
  assert.equal(f.board.querySelectorAll('.tutorial-demo-layer').length,1);assert.equal(f.board.querySelectorAll('.tutorial-demo-source').length,2);f.unchanged();
 }finally{f.close();}
});

test('cancelling either animation removes both ghosts and restores both originals',async()=>{
 const f=mount();try{
  for(const index of [0,1]){
   assert(f.show());f.animations.slice(-2)[index].cancel();await Promise.resolve();f.clean();
   assert(f.animations.every(animation=>animation.cancelled));assert.equal(f.board.querySelectorAll('.tutorial-demo-source').length,0);
   for(const node of f.originals())assert.equal(node.style.visibility,'');f.unchanged();
  }
 }finally{f.close();}
});

test('rebuilding the board triggers observer cleanup of detached source nodes',async()=>{
 const f=mount();try{
  assert(f.show());const originals=f.originals();f.fill();
  await new Promise(resolve=>f.w.queueMicrotask(resolve));
  assert(f.animations.every(animation=>animation.cancelled),'DOM replacement cancels animations without a host stop');
  for(const node of originals){assert.equal(node.classList.contains('tutorial-demo-source'),false);assert.equal(node.style.visibility,'');}
  f.clean();f.unchanged();
 }finally{f.close();}
});

test('removing the ghost layer also releases its source visibility',async()=>{
 const f=mount();try{
  assert(f.show());f.board.querySelector('.tutorial-demo-layer').remove();
  await new Promise(resolve=>f.w.queueMicrotask(resolve));f.clean();
  assert.equal(f.board.querySelectorAll('.tutorial-demo-source').length,0);f.unchanged();
 }finally{f.close();}
});

test('reduced motion creates no clones and stops an existing demonstration',()=>{
 const f=mount({reduced:true});try{
  assert.equal(f.show(),false);f.clean();assert.equal(f.animations.length,0);
  f.setReduced(false);assert(f.show());f.setReduced(true);assert.equal(f.show(),false);f.clean();
  assert.equal(f.board.querySelectorAll('.tutorial-demo-source').length,0);assert(f.animations.every(animation=>animation.cancelled));f.unchanged();
 }finally{f.close();}
});

test('missing animation support and invalid inputs leave the board playable',()=>{
 const f=mount({animate:false});try{
  assert.equal(f.show(),false);f.clean();assert.equal(f.board.querySelectorAll('.tutorial-demo-source').length,0);f.unchanged();
  assert.equal(f.demo.show({layout:f.layout,pair:[0,0],paths:f.paths}),false);
  assert.equal(f.demo.show({layout:f.layout,pair:[-1,1],paths:f.paths}),false);
  assert.equal(f.demo.show({layout:f.layout,pair:[0,99],paths:f.paths}),false);
  assert.equal(f.w.HexFirstPlay.createDemo().show({}),false);
 }finally{f.close();}
});

test('an exception creating the second animation cleans the partially built demonstration',()=>{
 const f=mount();try{
  f.throwNextSecond();assert.equal(f.show(),false);f.clean();
  assert.equal(f.board.querySelectorAll('.tutorial-demo-source').length,0);
  assert.equal(f.animations.length,1);assert(f.animations[0].cancelled);f.unchanged();
 }finally{f.close();}
});

test('host supplied paths are optional and invalid path data never hides sources',()=>{
 const f=mount();try{
  assert.equal(f.demo.show({layout:f.layout,pair:f.pair}),true,'pure board-view paths can be reused');f.demo.stop();
  assert.equal(f.demo.show({layout:f.layout,pair:f.pair,paths:[[],[]]}),false);f.clean();
  assert.equal(f.demo.show({layout:f.layout,pair:f.pair,paths:[[{transform:null},{transform:'translate(0,0)'}],f.paths[1]]}),false);
  assert.equal(f.board.querySelectorAll('.tutorial-demo-source').length,0);f.unchanged();
 }finally{f.close();}
});

(async()=>{
 for(const {name,run}of tests){await run();console.log('PASS '+name);}
 console.log(`First-play presentation checks passed: ${tests.length} cases; real board-view geometry with no engine, storage or RNG access.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
