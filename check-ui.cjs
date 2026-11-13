/* Full DOM gameplay, special-stone and asynchronous hint regressions. */
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const root=__dirname+'/dist/',key='hexrota-match-v3';
const errors=[],unhandled=[],mounted=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const settle=async()=>{await wait(1);await wait(1);};
async function until(check,message,timeout=1000){const start=Date.now();while(!check()&&Date.now()-start<timeout)await wait(5);assert(check(),message);}
function mount(state,legacy,options={}){
 const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'https://hexrota.example',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 mounted.push(dom);const w=dom.window;
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 if(state)w.localStorage.setItem(key,JSON.stringify(state));
 if(legacy)w.localStorage.setItem('hexrota-v1',JSON.stringify(legacy));
 if(options.v2)w.localStorage.setItem('hexrota-match-v2',JSON.stringify(options.v2));
 if(options.Worker)w.Worker=options.Worker;
 for(const file of ['levels.js','engine.js','app.js'])w.eval(fs.readFileSync(root+file,'utf8'));
 return dom;
}
function click(w,selector){const node=w.document.querySelector(selector);assert(node,selector+' exists');node.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:0}));}
function tile(w,index){return w.document.querySelector(`#board [data-index="${index}"]`);}
function select(w,index){click(w,`#board [data-index="${index}"]`);}
async function swap(w,pair){select(w,pair[0]);select(w,pair[1]);await settle();}
function numbers(w){return [...w.document.querySelectorAll('.hex-number')].map(node=>+node.textContent);}
function readSave(w){return JSON.parse(w.localStorage.getItem(key));}
function domPowers(w){return [...w.document.querySelectorAll('#board [data-index]')].map(node=>node.classList.contains('power-ring')?'ring':node.classList.contains('power-sprout')?'sprout':null);}
function assertBoard(w,game,message){
 const d=w.document;
 assert.equal(+d.getElementById('sum').textContent,game.score,message+' score');
 assert.equal(+d.getElementById('moves-left').textContent,game.movesLeft,message+' moves');
 assert.deepEqual(numbers(w),Array.from(game.values),message+' values');
 assert.deepEqual(domPowers(w),Array.from(game.specials),message+' special positions');
 for(let i=0;i<game.total;i++){
  const cell=tile(w,i),left=game.layers[i],initial=game.level.cells[i].layers||1;
  assert.equal(cell.classList.contains('floor-green'),left===0,message+' green cell '+i);
  assert.equal(cell.classList.contains('floor-partial'),left>0&&left<initial,message+' partial cell '+i);
  const count=cell.querySelector('.layer-count');if(count)assert.equal(+count.textContent,left,message+' layer label '+i);
 }
 const active=readSave(w).current,snapshot=readSave(w).boards[active];
 assert.deepEqual(snapshot.values,Array.from(game.values),message+' saved values');
 assert.deepEqual(snapshot.layers,Array.from(game.layers),message+' saved layers');
 assert.deepEqual(snapshot.specials,Array.from(game.specials),message+' saved specials');
}
function fakeWorkers(){
 const instances=[];
 class WorkerStub{
  constructor(url){this.url=url;this.terminated=false;instances.push(this);}
  postMessage(payload){this.payload=payload;}
  terminate(){this.terminated=true;}
  reply(hint){this.onmessage?.({data:{hint}});}
 }
 return {WorkerStub,instances};
}
function assertLegalHint(w){
 const save=readSave(w),level=w.HEX_LEVELS[save.current],game=new w.HexMatch(level,save.boards[save.current]);
 const pair=[...w.document.querySelectorAll('.hinted')].map(node=>+node.dataset.index);
 assert.equal(pair.length,2,'fallback produces a pair');
 assert(game.legalMoves().some(p=>p.includes(pair[0])&&p.includes(pair[1])),'fallback hint is currently legal');
 assert.equal(w.document.getElementById('hint').disabled,false,'hint button returns to ready');
 assert.equal(w.document.getElementById('reset').disabled,false,'controls remain responsive');
}
(async()=>{
 const dom=mount(null,{done:[0,1,2,3,4,5,6,7,8,9],current:9}),w=dom.window,d=w.document;
 assert.equal(d.querySelectorAll('.level-button').length,10);
 assert.equal(d.querySelectorAll('.level-button:disabled').length,9,'legacy route wins do not bypass new levels');
 assert.equal(d.querySelector('#undo'),null,'unlimited undo removed');
 const l0=w.HEX_LEVELS[0],g0=new w.HexMatch(l0);
 assertBoard(w,g0,'fresh board');
 select(w,0);assert.equal(+d.getElementById('sum').textContent,0,'one tap never gives points');
 select(w,0);assert.equal(+d.getElementById('moves-left').textContent,l0.moves);
 const legal=g0.legalMoves();let invalid;
 for(let a=0;a<l0.cells.length&&!invalid;a++)for(let b=a+1;b<l0.cells.length;b++){
  if(g0.adjacent(a,b)&&!legal.some(p=>p.includes(a)&&p.includes(b))){invalid=[a,b];break;}
 }
 assert(invalid);await swap(w,invalid);assertBoard(w,g0,'invalid swap rolls back without cost');
 click(w,'#hint');await settle();assert.equal(d.querySelectorAll('.hinted').length,2,'pair hint');
 click(w,'#help');assert(d.getElementById('help-dialog').open);click(w,'#help-dialog [data-close]');
 // One drag is one swap; it never draws a multi-turn route.
 const pair=l0.solution[0];
 const down=new w.Event('pointerdown',{bubbles:true,cancelable:true});Object.assign(down,{button:0,pointerType:'touch',pointerId:1,clientX:0,clientY:0});tile(w,pair[0]).dispatchEvent(down);
 const move=new w.Event('pointermove',{bubbles:true});Object.assign(move,{pointerType:'touch',pointerId:1,clientX:30,clientY:0});w.dispatchEvent(move);
 d.elementFromPoint=()=>tile(w,pair[1]);
 const up=new w.Event('pointerup',{bubbles:true});Object.assign(up,{pointerType:'touch',pointerId:1,clientX:30,clientY:0});w.dispatchEvent(up);
 await settle();g0.swap(...pair);assertBoard(w,g0,'one drag one move');
 click(w,'#reset');assertBoard(w,new w.HexMatch(l0),'retry same seed');
 // Every authored route traverses the actual UI and automatic Next/unlock flow.
 for(let n=0;n<10;n++){
  const level=w.HEX_LEVELS[n],shadow=new w.HexMatch(level);
  assert.equal(d.getElementById('level-name').textContent,level.name);
  for(const next of level.solution){assert(shadow.swap(...next).ok);await swap(w,next);assertBoard(w,shadow,'level '+(n+1));}
  assert.equal(shadow.status,'won');await until(()=>d.getElementById('win-dialog').open,'victory '+n);
  assert.equal(d.getElementById('completed').textContent,`${n+1} / 10`);
  if(n<9)click(w,'#next');
 }
 const saved=readSave(w);assert.equal(saved.done.length,10);
 const restored=mount(saved),rw=restored.window,rd=rw.document;
 assert.equal(rd.getElementById('completed').textContent,'10 / 10');
 assert.equal(rd.querySelectorAll('.level-button:disabled').length,0);
 assert.equal(rd.getElementById('continue').hidden,false);
 click(rw,'#continue');assert(rd.getElementById('win-dialog').open);click(rw,'#review');
 // A legal but unplanned sequence can exhaust its finite budget.
 const level=w.HEX_LEVELS[9];let losing;
 for(let policy=0;policy<12&&!losing;policy++){
  const game=new w.HexMatch(level),route=[];
  while(game.status==='playing'){const moves=game.legalMoves(),p=moves[(game.turn*7+policy)%moves.length];route.push(p);game.swap(...p);}
  if(game.status==='lost')losing=route;
 }
 assert(losing,'last level has a failing blind strategy');click(rw,'#reset');
 for(const next of losing)await swap(rw,next);
 await until(()=>rd.getElementById('lose-dialog').open,'loss dialog appears after the final turn');
 assert.equal(+rd.getElementById('moves-left').textContent,0);
 click(rw,'#retry');assert(!rd.getElementById('lose-dialog').open);assertBoard(rw,new rw.HexMatch(rw.HEX_LEVELS[9]),'loss retry');
 // Exact restore includes the special-stone vector; tampered checkpoints restart safely.
 const state=readSave(rw),game=new w.HexMatch(level);game.swap(...level.solution[0]);state.boards[9]=game.snapshot();
 const middle=mount(state);assertBoard(middle.window,game,'mid-turn restore');
 state.boards[9].score+=1;const corrupt=mount(state);assert.equal(+corrupt.window.document.getElementById('sum').textContent,0);
 // V2 match progress migrates, while changed boards are discarded and not replayed.
 const v2={current:5,done:[0,1,2,3,4],sound:true,boards:{0:{version:2,score:999},5:{version:2,score:999}}};
 const migrated=mount(null,null,{v2}),mw=migrated.window,ms=readSave(mw);
 assert.deepEqual(ms.done,v2.done);assert.equal(ms.current,5);assert.equal(ms.sound,true);
 assert.deepEqual(Object.keys(ms.boards),['5'],'legacy board checkpoints are discarded');
 assertBoard(mw,new mw.HexMatch(mw.HEX_LEVELS[5]),'v2 fresh current board');
 assert.equal(mw.localStorage.getItem('hexrota-match-v2'),JSON.stringify(v2),'legacy data itself is left intact');
 // Tutorial specials are visible, named accessibly, and preview their footprint.
 for(const [index,type,label]of[[2,'ring','Halka'],[5,'sprout','Filiz']]){
  const fixture=mount({current:index,done:Array.from({length:index},(_,i)=>i),boards:{},sound:false}),fw=fixture.window,fd=fw.document;
  const source=fw.HEX_LEVELS[index],shadow=new fw.HexMatch(source),power=shadow.specials.indexOf(type);
  assert(power>=0,`level ${index+1} provides ${type}`);
  assert(tile(fw,power).querySelector(`.power-symbol.${type}`),'special glyph visible');
  assert(tile(fw,power).getAttribute('aria-label').includes(label+' taşı'),'special has an accessible name');
  select(fw,power);
  const preview=[...fd.querySelectorAll('.power-target')].map(node=>+node.dataset.index).sort((a,b)=>a-b);
  assert.deepEqual(preview,Array.from(shadow.previewPower(power)).sort((a,b)=>a-b),'selected power previews engine footprint');
  assert.equal(fd.getElementById('special-preview').hidden,false);
  assert(fd.getElementById('special-preview').textContent.includes(label),'effect explanation visible');
  const neighbor=shadow.neighbors[power][0],result=shadow.swap(power,neighbor);assert(result.ok,'special activates without requiring a number match');
  assert.equal(shadow.movesLeft,source.moves-1,'power activation costs exactly one move');
  assert(result.frames.some(frame=>(frame.activated||[]).some(effect=>effect.type===type)),'power effect actually fired');
  select(fw,neighbor);await settle();assertBoard(fw,shadow,type+' activation');
  assert(fd.getElementById('last-combo').textContent.includes('Özel etki'),'activation feedback shown');
 }
 // Worker responses belong to one board revision and are ignored after a turn/reset.
 for(const cancel of ['turn','restart']){
  const {WorkerStub,instances}=fakeWorkers(),fixture=mount(null,null,{Worker:WorkerStub}),fw=fixture.window,fd=fw.document;
  const source=fw.HEX_LEVELS[0],shadow=new fw.HexMatch(source),next=source.solution[0];
  click(fw,'#hint');assert.equal(instances.length,1);assert(fd.getElementById('hint').disabled,'pending worker is visible');
  assert.equal(fd.getElementById('reset').disabled,false,'hint search leaves controls responsive');
  const worker=instances[0];assert(worker.url.includes('hint-worker.js'));assert(worker.payload.snapshot);
  if(cancel==='turn'){await swap(fw,next);shadow.swap(...next);}else click(fw,'#reset');
  worker.reply({pair:next});await settle();
  assert.equal(worker.terminated,true,'obsolete worker is terminated');
  assert.equal(fd.querySelectorAll('.hinted').length,0,'late hint cannot overwrite a new board revision');
  assertBoard(fw,shadow,'after stale worker '+cancel);
  assert.equal(fd.getElementById('hint').disabled,false,'stale response cannot leave hint busy');
 }
 // Both constructor failure and a worker startup error use a legal local fallback.
 class UnavailableWorker{constructor(){throw new Error('Worker blocked by environment');}}
 const blocked=mount(null,null,{Worker:UnavailableWorker});click(blocked.window,'#hint');await settle();assertLegalHint(blocked.window);
 const workers=fakeWorkers(),failed=mount(null,null,{Worker:workers.WorkerStub});click(failed.window,'#hint');
 let prevented=false;workers.instances[0].onerror({preventDefault(){prevented=true;}});await settle();
 assert(prevented);assert(workers.instances[0].terminated);assertLegalHint(failed.window);
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(unhandled.length,0,unhandled.join('\n'));
 console.log('UI DOM checks passed: 10 solutions, tap/drag, specials/previews, exact board state, win/loss/retry, v2 migration, checkpoint validation and stale/failing hint workers.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{for(const dom of mounted)dom.window.close();});
