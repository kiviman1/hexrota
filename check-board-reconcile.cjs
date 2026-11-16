/* Live SVG identity checks driven by real resolved engine frames. No copied
 * matching, gravity, refill or scoring algorithm supplies expected outcomes. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),view=require('./dist/board-view.js');
const context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js','tutorials.js'])vm.runInContext(fs.readFileSync(__dirname+'/dist/'+file,'utf8'),context);
const {HexMatch,HEX_LEVELS}=context.window,plain=value=>JSON.parse(JSON.stringify(value));
const tests=[],test=(name,run)=>tests.push({name,run});let waves=0,survivors=0,spawned=0;
function fixture(level=HEX_LEVELS[0]){
 const dom=new JSDOM('<!doctype html><svg id="board"></svg>'),board=dom.window.document.getElementById('board'),layout=view.geometry(level);
 const markup=(state,options={})=>view.markup(level,state,layout,options),gems=()=>Array.from(board.querySelectorAll(':scope > [data-index]')).map(tile=>tile.querySelector(':scope > .gem'));
 const indices=()=>Array.from(board.querySelectorAll(':scope > [data-index]'));
 return{dom,board,layout,markup,gems,indices,render(state,transition,options){return view.reconcile(board,markup(state,options),transition);},close(){dom.window.close();}};
}
const visual=game=>({values:plain(game.values),layers:plain(game.layers),score:game.score,movesLeft:game.movesLeft});
function stateAtMove(turn=2){const level=HEX_LEVELS[0],game=new HexMatch(level);for(const pair of level.solution.slice(0,turn))assert(game.swap(...pair).ok);const before=visual(game),pair=plain(level.solution[turn]),result=plain(game.swap(...pair));assert(result.ok);return{level,game,before,pair,result};}
function values(f){return f.gems().map(gem=>Number(gem.querySelector('.hex-number').textContent));}
function constants(f){return{tiles:f.indices(),floors:f.indices().map(tile=>tile.querySelector('.floor-shape')),defs:f.board.querySelector(':scope > defs'),fx:f.board.querySelector(':scope > .fx-layer'),swap:f.board.querySelector(':scope > .swap-layer')};}
function sameConstants(f,old){const now=constants(f);assert.deepEqual(now.tiles,old.tiles,'cell groups retain identity');assert.deepEqual(now.floors,old.floors,'static floor polygons retain identity');assert.equal(now.defs,old.defs);assert.equal(now.fx,old.fx);assert.equal(now.swap,old.swap);assert.equal(f.board.lastElementChild,old.swap,'swap layer remains above every static cell');}
function normalized(f,html){const svg=f.dom.window.document.createElementNS('http://www.w3.org/2000/svg','svg');svg.innerHTML=html;return svg.innerHTML;}

test('initial projection mounts once; ordinary selection/HUD redraws retain every real stone and static layer',()=>{
 const {before}=stateAtMove(),f=fixture();try{
  const fresh=f.render(before);assert.equal(fresh.created,before.values.length);assert.equal(fresh.reused,0);assert(Object.isFrozen(fresh));
  const old=f.gems(),fixed=constants(f),projection=f.markup(before,{selected:2,selectedNeighbors:[0,1],focusIndex:2});
  const update=view.reconcile(f.board,projection);assert.equal(update.reused,old.length);assert.equal(update.created,0);assert.equal(update.removed,0);assert.deepEqual(f.gems(),old);sameConstants(f,fixed);assert.equal(f.indices()[2].getAttribute('aria-pressed'),'true');
  assert.equal(f.board.innerHTML,normalized(f,projection),'reconciled attributes/paint exactly reproduce the parsed pure markup');
 }finally{f.close();}
});

test('reciprocal swap captures both original sources before relocating either stone',()=>{
 const {before,pair,result}=stateAtMove(),f=fixture();try{
  f.render(before);const old=f.gems(),fixed=constants(f),swapped={...before,values:result.frames[0].before};
  const count=f.render(swapped,{moves:[{from:pair[0],to:pair[1]},{from:pair[1],to:pair[0]}]});
  assert.equal(f.gems()[pair[0]],old[pair[1]]);assert.equal(f.gems()[pair[1]],old[pair[0]]);assert.equal(count.reused,old.length);assert.equal(count.moved,2);assert.equal(count.created,0);assert.deepEqual(values(f),swapped.values);sameConstants(f,fixed);
 }finally{f.close();}
});

test('all four actual engine waves retain each survivor source identity and create only real refill stones',()=>{
 const {game,before,pair,result}=stateAtMove(),f=fixture(),data=JSON.stringify(result),snapshot=plain(game.snapshot());try{
  assert.equal(result.frames.length,4,'the fixture exercises all previously compressed waves');f.render(before);const fixed=constants(f);
  f.render({...before,values:result.frames[0].before},{moves:[{from:pair[0],to:pair[1]},{from:pair[1],to:pair[0]}]});
  let layers=before.layers;
  for(const frame of result.frames){
   const beforeGems=f.gems();f.render({values:frame.before,layers});assert.deepEqual(f.gems(),beforeGems,'MATCH redraw does not replace survivors before their fall');
   const removed=new Set(frame.matched),moving=new Set(frame.falls.filter(fall=>!fall.spawn).map(fall=>fall.from)),refills=frame.falls.filter(fall=>fall.spawn);
   const count=f.render({values:frame.after,layers:frame.layers},{matched:frame.matched,falls:frame.falls});
   const after=f.gems(),oldSet=new Set(beforeGems);assert.deepEqual(values(f),frame.after);sameConstants(f,fixed);
   assert.equal(count.created,refills.length);assert.equal(count.removed,frame.matched.length);assert.equal(count.reused,beforeGems.length-frame.matched.length);
   for(const index of frame.matched)assert.equal(f.board.contains(beforeGems[index]),false,'cleared original stone is gone');
   for(const fall of frame.falls){
    assert.equal(Number(after[fall.to].querySelector('.hex-number').textContent),fall.value);
    if(fall.spawn){assert.equal(oldSet.has(after[fall.to]),false,'refill uses a genuinely new gem node');spawned++;}
    else{assert.equal(after[fall.to],beforeGems[fall.from],'equal-valued stones still retain their exact source identity');survivors++;}
   }
   for(let i=0;i<beforeGems.length;i++)if(!removed.has(i)&&!moving.has(i))assert.equal(after[i],beforeGems[i],'stationary survivors are never reconstructed');
   layers=frame.layers;waves++;
  }
  assert.deepEqual(values(f),plain(game.values));assert.equal(JSON.stringify(result),data,'read-only engine frames remain unchanged');assert.deepEqual(plain(game.snapshot()),snapshot,'DOM reconciliation never mutates authoritative RNG/board/score/turn/history');
 }finally{f.close();}
});

test('render boundary clears disposable opacity/visibility without cancelling unrelated animation objects',()=>{
 const {before}=stateAtMove(),f=fixture();try{
  f.render(before);const old=f.gems(),fixed=constants(f);let cancelled=0,read=0;
  old[0].style.visibility='hidden';old[0].style.transform='scale(.4)';old[0].querySelector('.hex-number').style.opacity='0';
  old[0].getAnimations=()=>{read++;return[{cancel(){cancelled++;}}];};
  const fx=f.dom.window.document.createElementNS('http://www.w3.org/2000/svg','circle');fx.setAttribute('class','fx-ring');fixed.fx.append(fx);
  f.render(before);assert.equal(f.gems()[0],old[0]);assert.equal(old[0].getAttribute('style'),null);assert.equal(old[0].querySelector('.hex-number').getAttribute('style'),null);assert.equal(read,0);assert.equal(cancelled,0);sameConstants(f,fixed);assert.equal(fixed.fx.childNodes.length,0,'the previous wave effect is disposable');
 }finally{f.close();}
});

test('changed values replace only that gem while cell paint and static geometry stay in place',()=>{
 const {before}=stateAtMove(),f=fixture();try{
  f.render(before);const old=f.gems(),fixed=constants(f),state=plain(before);state.values[0]=state.values[0]===1?2:1;
  const count=f.render(state);assert.equal(count.created,1);assert.equal(count.removed,1);assert.equal(count.reused,old.length-1);assert.notEqual(f.gems()[0],old[0]);for(let i=1;i<old.length;i++)assert.equal(f.gems()[i],old[i]);sameConstants(f,fixed);assert.equal(f.indices()[0].classList.contains('value-'+state.values[0]),true);assert.equal(f.board.innerHTML,normalized(f,f.markup(state)));
 }finally{f.close();}
});

test('invalid and inconsistent transition metadata reject before any live mutation',()=>{
 const {before,pair,result}=stateAtMove(),f=fixture();try{
  f.render(before);const original=f.board.outerHTML,old=f.gems(),frame=result.frames[0],swapped={...before,values:frame.before};
  const invalid=[
   {moves:[{from:-1,to:1}]},{moves:[{from:0,to:1},{from:0,to:2}]},{moves:[{from:0,to:1},{from:2,to:1}]},
   {moves:[{from:pair[0],to:pair[1]}],matched:[0]},{moves:'bad'},{falls:{}},{matched:[0,0]},{matched:[999]},
   {falls:[{from:0,to:1,spawn:true,spawnCount:1,spawnOrder:0}]},{falls:[{from:null,to:1,spawn:true,spawnCount:1,spawnOrder:1}]},
   {falls:[{from:0,to:1,spawn:false,value:999}]},{falls:[{from:0,to:1,spawn:false}],matched:[0]},
   {reset:'true'},{reset:true,moves:[{from:0,to:1}]}
  ];
  for(const transition of invalid){assert.throws(()=>f.render(swapped,transition),TypeError);assert.equal(f.board.outerHTML,original);assert.deepEqual(f.gems(),old);}
  assert.throws(()=>view.reconcile(f.board,'',{}),TypeError);assert.equal(f.board.outerHTML,original);
  const wrong=plain(swapped);wrong.values[pair[0]]=999;assert.throws(()=>f.render(wrong,{moves:[{from:pair[0],to:pair[1]},{from:pair[1],to:pair[0]}]}),TypeError);assert.equal(f.board.outerHTML,original);
 }finally{f.close();}
});

test('new attempt reset and topology change intentionally replace old board ownership',()=>{
 const {before}=stateAtMove(),f=fixture();try{
  f.render(before);const old=f.gems();assert.equal(f.render(before,{reset:true}).created,old.length);assert(f.gems().every(gem=>!old.includes(gem)));
  const tutorial=context.window.HEX_TUTORIALS[0],game=new HexMatch(tutorial),html=view.markup(tutorial,visual(game),view.geometry(tutorial,true));
  assert.equal(view.reconcile(f.board,html).created,tutorial.cells.length);assert.deepEqual(values(f),plain(game.values));
 }finally{f.close();}
});

for(const {name,run}of tests){run();console.log('PASS '+name);}
assert(waves===4&&survivors>0&&spawned>0);
console.log(`Board reconciliation checks: ${tests.length} groups, ${waves} real waves, ${survivors} moving survivors and ${spawned} new refill nodes; authoritative frames unchanged.`);
