const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const root=__dirname+'/dist/';
const errors=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const settle=async()=>{await wait(1);await wait(1);};
function mount(state,legacy){
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'https://hexrota.example',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 if(state)w.localStorage.setItem('hexrota-match-v2',JSON.stringify(state));
 if(legacy)w.localStorage.setItem('hexrota-v1',JSON.stringify(legacy));
 for(const f of ['levels.js','engine.js','app.js'])w.eval(fs.readFileSync(root+f,'utf8'));
 return dom;
}
function click(w,selector){const n=w.document.querySelector(selector);assert(n,selector+' exists');n.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:0}));}
function tile(w,i){return w.document.querySelector(`#board [data-index="${i}"]`);}
function select(w,i){click(w,`#board [data-index="${i}"]`);}
async function swap(w,pair){select(w,pair[0]);select(w,pair[1]);await settle();}
function numbers(w){return [...w.document.querySelectorAll('.hex-number')].map(n=>+n.textContent);}
(async()=>{
 const dom=mount(null,{done:[0,1,2,3,4,5,6,7,8,9],current:9}),w=dom.window,d=w.document;
 assert.equal(d.querySelectorAll('.level-button').length,10);
 assert.equal(d.querySelectorAll('.level-button:disabled').length,9,'legacy route wins do not bypass new levels');
 assert.equal(d.querySelector('#undo'),null,'unlimited undo removed');
 const l0=w.HEX_LEVELS[0],g0=new w.HexMatch(l0);
 assert.deepEqual(numbers(w),Array.from(l0.initial));
 select(w,0);assert.equal(+d.getElementById('sum').textContent,0,'one tap never gives points');
 select(w,0);assert.equal(+d.getElementById('moves-left').textContent,l0.moves);
 const legal=g0.legalMoves();
 let invalid;
 for(let a=0;a<l0.cells.length&&!invalid;a++)for(let b=a+1;b<l0.cells.length;b++){
  if(g0.adjacent(a,b)&&!legal.some(p=>p.includes(a)&&p.includes(b))){invalid=[a,b];break;}
 }
 assert(invalid);await swap(w,invalid);
 assert.equal(+d.getElementById('sum').textContent,0,'invalid swap no score');
 assert.equal(+d.getElementById('moves-left').textContent,l0.moves,'invalid swap no cost');
 assert.deepEqual(numbers(w),Array.from(l0.initial),'invalid swap rolls back');
 click(w,'#hint');assert.equal(d.querySelectorAll('.hinted').length,2,'pair hint');
 click(w,'#help');assert(d.getElementById('help-dialog').open);click(w,'#help-dialog [data-close]');
 // Dragging swaps exactly one neighboring pair; same motion cannot draw a route.
 const pair=l0.solution[0],start=tile(w,pair[0]),dest=tile(w,pair[1]);
 const down=new w.Event('pointerdown',{bubbles:true,cancelable:true});Object.assign(down,{button:0,pointerType:'touch',pointerId:1,clientX:0,clientY:0});start.dispatchEvent(down);
 const move=new w.Event('pointermove',{bubbles:true});Object.assign(move,{pointerType:'touch',pointerId:1,clientX:30,clientY:0});w.dispatchEvent(move);
 d.elementFromPoint=()=>tile(w,pair[1]);
 const up=new w.Event('pointerup',{bubbles:true});Object.assign(up,{pointerType:'touch',pointerId:1,clientX:30,clientY:0});w.dispatchEvent(up);
 await settle();g0.swap(...pair);
 assert.equal(+d.getElementById('moves-left').textContent,l0.moves-1,'one drag one move');
 assert.equal(+d.getElementById('sum').textContent,g0.score,'cascade score matches engine');
 assert.deepEqual(numbers(w),Array.from(g0.values));
 click(w,'#reset');assert.deepEqual(numbers(w),Array.from(l0.initial),'retry same seed');
 assert.equal(+d.getElementById('sum').textContent,0);
 // Complete every authored solution through DOM controls and verify Next/unlock.
 for(let n=0;n<10;n++){
  const l=w.HEX_LEVELS[n],shadow=new w.HexMatch(l);
  assert.equal(d.getElementById('level-name').textContent,l.name);
  for(const p of l.solution){
   const r=shadow.swap(...p);assert(r.ok);await swap(w,p);
   assert.equal(+d.getElementById('sum').textContent,shadow.score,'UI score matches simulated cascade');
   assert.equal(+d.getElementById('moves-left').textContent,shadow.movesLeft);
   assert.equal(d.querySelectorAll('.floor-green').length,shadow.covered);
  }
  await settle();assert.equal(shadow.status,'won');
  assert(d.getElementById('win-dialog').open,'victory '+n);
  assert.equal(d.getElementById('completed').textContent,`${n+1} / 10`);
  if(n<9)click(w,'#next');
 }
 const saved=JSON.parse(w.localStorage.getItem('hexrota-match-v2'));
 assert.equal(saved.done.length,10);
 const restored=mount(saved),rw=restored.window,rd=rw.document;
 assert.equal(rd.getElementById('completed').textContent,'10 / 10');
 assert.equal(rd.querySelectorAll('.level-button:disabled').length,0);
 assert.equal(rd.getElementById('continue').hidden,false);
 click(rw,'#continue');assert(rd.getElementById('win-dialog').open);click(rw,'#review');
 // A legal but unplanned sequence really can exhaust the move budget.
 const level=w.HEX_LEVELS[9];let losing;
 for(let policy=0;policy<8&&!losing;policy++){
  const game=new w.HexMatch(level),route=[];
  while(game.status==='playing'){const moves=game.legalMoves(),p=moves[(game.turn*7+policy)%moves.length];route.push(p);game.swap(...p);}
  if(game.status==='lost')losing=route;
 }
 assert(losing,'fixture has a failing blind strategy');
 click(rw,'#reset');
 for(const p of losing)await swap(rw,p);
 await settle();assert(rd.getElementById('lose-dialog').open);
 assert.equal(+rd.getElementById('moves-left').textContent,0);
 click(rw,'#retry');assert(!rd.getElementById('lose-dialog').open);assert.deepEqual(numbers(rw),Array.from(level.initial));
 assert.equal(+rd.getElementById('moves-left').textContent,level.moves);
 // Mid-game restore is exact; tampered checkpoints safely restart.
 const state=JSON.parse(rw.localStorage.getItem('hexrota-match-v2'));const game=new w.HexMatch(level);game.swap(...level.solution[0]);state.boards[9]=game.snapshot();
 const middle=mount(state);assert.deepEqual(numbers(middle.window),Array.from(game.values));
 state.boards[9].score+=1;const corrupt=mount(state);assert.equal(+corrupt.window.document.getElementById('sum').textContent,0);
 assert.equal(errors.length,0,errors.join('\n'));
 for(const item of [dom,restored,middle,corrupt])item.window.close();
 console.log('UI DOM checks passed: all 10 match-three levels, invalid swaps, tap/drag, cascades, move budgets, hints, unlock, win/loss/retry, restore and legacy migration.');
})().catch(e=>{console.error(e);process.exit(1)});
