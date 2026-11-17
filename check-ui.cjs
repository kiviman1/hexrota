/* Guided onboarding, twelve-stage flow, persistence migration and async hints. */
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {loadGame,savedLevel,savedGame,confirmRestart}=require('./qa-fixtures.cjs');
const root=__dirname+'/dist/',key='hexrota-match-v5';
const errors=[],unhandled=[],mounted=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const settle=async()=>{await wait(1);await wait(1);};
async function until(check,message,timeout=1600){const start=Date.now();while(!check()&&Date.now()-start<timeout)await wait(5);assert(check(),message);}
const all=w=>[...w.HEX_TUTORIALS,...w.HEX_LEVELS];
function mount(state,legacy,options={}){
 const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'https://hexrota.example',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 mounted.push(dom);const w=dom.window;
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 if(state)w.localStorage.setItem(key,JSON.stringify(state));
 // This legacy shell suite keeps its acknowledgement/skip contract using an
 // existing absent-policy record. Do not shadow the explicit migration inputs.
 else if(![2,3,4].some(version=>options['v'+version]))w.localStorage.setItem(key,'{}');
 if(legacy)w.localStorage.setItem('hexrota-v1',JSON.stringify(legacy));
 for(const v of [2,3,4])if(options['v'+v])w.localStorage.setItem('hexrota-match-v'+v,JSON.stringify(options['v'+v]));
 if(options.Worker)w.Worker=options.Worker;
 loadGame(w,['levels.js','engine.js','tutorials.js','audio.js','app.js'],file=>fs.readFileSync(root+file,'utf8'),{originalBoards:options.legacyCampaign?Array.from({length:10},(_,i)=>i+2):options.originalStage!==undefined?[options.originalStage]:[],hintDiagnostics:options.hintDiagnostics===true});
 if(options.launch!==false)enterStage(w,readSave(w).current);
 return dom;
}
function click(w,selector){const node=w.document.querySelector(selector);assert(node,selector+' exists');node.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:0}));if(selector==='#reset')confirmRestart(w);}
function startPending(w){const dialog=w.document.getElementById('pregame-dialog');if(dialog?.open)click(w,'#pregame-start');confirmRestart(w);}
function enterStage(w,index){
 const nav=w.document.querySelector('[data-nav="journey"]');assert(nav,'journey navigation exists');nav.click();
 const node=w.document.querySelector(`[data-stage="${index}"]`);assert(node&&!node.disabled,'stage '+index+' is accessible');node.click();
 assert(w.document.getElementById('pregame-dialog').open,'stage preview opens');startPending(w);
 assert.equal(w.document.getElementById('game-screen').hidden,false,'game entered through preview');
}
function tile(w,index){return w.document.querySelector(`#board [data-index="${index}"]`);}
function select(w,index){click(w,`#board [data-index="${index}"]`);}
async function swap(w,pair){const next=w.document.getElementById('coach-next');if(next&&!next.hidden)next.click();select(w,pair[0]);select(w,pair[1]);await settle();}
function numbers(w){return [...w.document.querySelectorAll('#board .hex-number')].map(node=>+node.textContent);}
function readSave(w){return JSON.parse(w.localStorage.getItem(key));}
function assertClassicShell(w){
 assert.equal(w.document.querySelector('.special-guide,.special-preview,#power-tip,.intro-test-link,.power-symbol,.power-ring,.power-sprout'),null,'classic shell has no removed features');
}
function assertBoard(w,game,message){
 const d=w.document;
 assert.equal(+d.getElementById('sum').textContent,game.score,message+' score');
 assert.equal(+d.getElementById('moves-left').textContent,game.movesLeft,message+' moves');
 assert.deepEqual(numbers(w),Array.from(game.values),message+' values');
 assertClassicShell(w);
 assert.equal(d.querySelectorAll('#board .floor-green').length,game.covered,message+' covered count');
 assert.equal(d.getElementById('coverage').textContent,`${game.covered} / ${game.total}`,message+' coverage label');
 for(let i=0;i<game.total;i++){
  const cell=tile(w,i),left=game.layers[i],initial=game.level.cells[i].layers||1;
  assert.equal(cell.classList.contains('floor-green'),left===0,message+' green cell '+i);
  assert.equal(cell.classList.contains('floor-partial'),left>0&&left<initial,message+' partial cell '+i);
  const count=cell.querySelector('.layer-count');if(count)assert.equal(+count.textContent,left,message+' layer label '+i);
 }
 const active=readSave(w).current,snapshot=readSave(w).boards[active];
 assert.deepEqual(snapshot.values,Array.from(game.values),message+' saved values');
 assert.deepEqual(snapshot.layers,Array.from(game.layers),message+' saved layers');
 assert.equal(snapshot.score,game.score,message+' saved score');
 assert.equal(snapshot.movesLeft,game.movesLeft,message+' saved remaining moves');
 assert.equal(snapshot.turn,game.turn,message+' saved turn');
 assert.equal(snapshot.version,4,'presentation changes preserve classic rules checkpoint format');
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
 const game=savedGame(w);
 const pair=[...w.document.querySelectorAll('#board .hinted')].map(node=>+node.dataset.index);
 assert.equal(pair.length,2,'fallback produces a pair');
 assert(game.legalMoves().some(p=>p.includes(pair[0])&&p.includes(pair[1])),'fallback hint is currently legal');
 assert.equal(w.document.getElementById('hint'),null,'manual hint control stays removed');
 assert.equal(w.HexHintTestAdapter.isPending(),false,'developer hint operation returns to ready');
 assert.equal(w.document.getElementById('reset').disabled,false,'controls remain responsive');
}
const campaignState=()=>({current:2,done:[0,1],boards:{},sound:false});
(async()=>{
 const dom=mount(null,{done:[0,1,2,3,4,5,6,7,8,9],current:9},{legacyCampaign:true}),w=dom.window,d=w.document;
 assert.equal(w.HEX_TUTORIALS.length,2);assert.equal(w.HEX_LEVELS.length,10);
 assert.equal(d.querySelectorAll('.level-button').length,3,'two free tutorials and only the next campaign level are selectable');
 assert.equal(d.querySelectorAll('.level-button:disabled').length,0,'tutorials remain free and the next campaign level is available');
 assert.equal(d.querySelector('[data-level="0"] .level-number').textContent,'T1');
 assert.equal(d.querySelector('[data-level="1"] .level-number').textContent,'T2');
 assert.equal(d.querySelector('[data-level="2"] .level-number').textContent,'01','campaign numbering starts after tutorials');
 assert.equal(d.querySelector('#undo'),null,'unlimited undo stays removed');
 const l0=all(w)[0],g0=new w.HexMatch(l0);
 assertBoard(w,g0,'fresh tutorial board');
 assert.equal(readSave(w).current,0);assert.equal(d.getElementById('completed').textContent,'0 / 10');
 assert(!d.getElementById('tutorial-coach').hidden,'coach is visible for a playable tutorial');
 assert(d.getElementById('coach-text').textContent.trim(),'coach gives the next action');
 assert.equal(d.querySelectorAll('.tutorial-focus').length,2,'the guided pair is highlighted');
 // An unrelated adjacent pair cannot waste a tutorial move or RNG draw.
 const expected=l0.solution[0];let unrelated;
 for(let a=0;a<g0.total&&!unrelated;a++)for(const b of g0.neighbors[a])if(!expected.includes(a)||!expected.includes(b)){unrelated=[a,b];break;}
 assert(unrelated);await swap(w,unrelated);assertBoard(w,g0,'unrelated tutorial action costs nothing');
 click(w,'#reset');
 click(w,'#help');assert(d.getElementById('help-dialog').open);click(w,'#help-dialog [data-close]');
 // A real captured drag can perform the prompted tutorial action.
 const pair=l0.solution[0];
 const down=new w.Event('pointerdown',{bubbles:true,cancelable:true});Object.assign(down,{button:0,pointerType:'touch',pointerId:1,clientX:0,clientY:0});tile(w,pair[0]).dispatchEvent(down);
 d.elementFromPoint=()=>tile(w,pair[1]);
 const up=new w.Event('pointerup',{bubbles:true});Object.assign(up,{button:0,pointerType:'touch',pointerId:1,clientX:30,clientY:0});w.dispatchEvent(up);
 await settle();g0.swap(...pair);assertBoard(w,g0,'one tutorial drag one move');
 assert(d.getElementById('coach-text').textContent.trim(),'coach advances after the move');
 click(w,'#reset');assertBoard(w,new w.HexMatch(l0),'tutorial retry same seed');
 // Both tutorials, then every unchanged campaign solution, through actual Next/unlock.
 for(let n=0;n<12;n++){
  const level=all(w)[n],shadow=new w.HexMatch(level);
  assert.equal(d.getElementById('level-name').textContent,level.name);
  assert.equal(d.getElementById('tutorial-coach').hidden,n>=2,'coach belongs only to tutorials');
  for(const next of level.solution){assert(shadow.swap(...next).ok);await swap(w,next);assertBoard(w,shadow,'stage '+n);}
  assert.equal(shadow.status,'won');await until(()=>d.getElementById('win-dialog').open,'victory '+n);
  assert.equal(d.getElementById('completed').textContent,`${Math.max(0,n-1)} / 10`,'tutorial completion does not inflate campaign count');
  if(n<11){click(w,'#next');startPending(w);}
 }
 const saved=readSave(w);assert.equal(saved.done.length,12);
 const restored=mount(saved,null,{launch:false}),rw=restored.window,rd=rw.document;
 assert.equal(rd.getElementById('completed').textContent,'10 / 10');
 assert.equal(rd.querySelector('[data-level="0"] .level-number').textContent,'T1','completed tutorials remain identifiable on mobile');
 assert.equal(rd.querySelector('[data-level="1"] .level-number').textContent,'T2');
 assert.equal(rd.querySelector('[data-level="2"]'),null,'completed campaign levels are removed from playable controls');
 assert.equal(rd.querySelector('[data-stage="11"]'),null,'the final completed level cannot be selected again');
 assert.equal(rd.getElementById('home-screen').hidden,false,'completed journey returns to home on reload');
 assert.match(rd.getElementById('home-play-label').textContent,/Bahçeni gör/i,'completed campaign opens permanent garden progress');
 // A separate unfinished final-level fixture exercises genuine loss/retry; a completed campaign is never replayed for this test.
 const finalStage={current:11,done:Array.from({length:11},(_,i)=>i),boards:{11:new w.HexMatch(w.HEX_LEVELS[9]).snapshot()},sound:false};
 const loss=mount(finalStage,null,{originalStage:11}),lw=loss.window,ld=lw.document;
 // A legal but unplanned sequence can exhaust the finite campaign budget.
 const level=savedLevel(lw);let losing;
 for(let policy=0;policy<20&&!losing;policy++){
  const game=new w.HexMatch(level),route=[];
  while(game.status==='playing'){
   assert(game.turn<=level.moves);const moves=game.legalMoves();assert(moves.length);
   const p=moves[(game.turn*7+policy)%moves.length];route.push(p);assert(game.swap(...p).ok);
  }
  if(game.status==='lost')losing=route;
 }
 assert(losing,'last campaign variant has a failing blind strategy');
 for(const next of losing)await swap(lw,next);
 await until(()=>ld.getElementById('lose-dialog').open,'loss dialog appears after last turn');
 assert.equal(+ld.getElementById('moves-left').textContent,0);
 click(lw,'#retry');assert(!ld.getElementById('lose-dialog').open);assertBoard(lw,savedGame(lw),'loss retry');assert.equal(readSave(lw).boards[11].turn,0,'retry starts an untouched certified board');
 // Exact checkpoint restore survives adding the tutorials; malformed state restarts.
 const state=readSave(lw),original=w.HEX_LEVELS[9],game=new w.HexMatch(original);game.swap(...original.solution[0]);state.boards[11]=game.snapshot();if(state.attempts)delete state.attempts[11];
 const middle=mount(state);assertBoard(middle.window,game,'mid-turn restore');
 state.boards[11].score+=1;const corrupt=mount(state);assert.equal(+corrupt.window.document.getElementById('sum').textContent,0);
 // Explicit tutorial skip opens campaign one. Replay never clears campaign progress.
 const skipped=mount(),sw=skipped.window;click(sw,'#coach-skip');startPending(sw);await settle();
 assert.equal(readSave(sw).current,2);assert.deepEqual(readSave(sw).done,[0,1]);
 assert.equal(sw.document.getElementById('completed').textContent,'0 / 10');
 assert(sw.document.getElementById('tutorial-coach').hidden);
 const first=savedLevel(sw);await swap(sw,first.solution[0]);const campaignBefore=readSave(sw).boards[2];
 click(sw,'#tutorial-replay');startPending(sw);await settle();assert.equal(readSave(sw).current,0);
 assert.deepEqual(readSave(sw).boards[2],campaignBefore,'replaying tutorial preserves an in-progress campaign board');
 const replayed=mount(saved,null,{launch:false}),pw=replayed.window;click(pw,'#tutorial-replay');startPending(pw);await settle();
 assert.equal(readSave(pw).current,0);assert.equal(pw.document.getElementById('completed').textContent,'10 / 10');
 assert.deepEqual(readSave(pw).done.filter(i=>i>=2),saved.done.filter(i=>i>=2),'tutorial replay preserves completed campaign stages');
 // Previous classic checkpoints shift by two and remain valid, without resetting progress.
 const v4game=new w.HexMatch(w.HEX_LEVELS[5]);v4game.swap(...w.HEX_LEVELS[5].solution[0]);
 const v4={current:5,done:[0,1,2,3,4],sound:true,boards:{5:v4game.snapshot()}};
 const upgraded=mount(null,null,{v4}),uw=upgraded.window,us=readSave(uw);
 assert.equal(us.current,7);assert.deepEqual(us.done,[0,1,2,3,4,5,6]);assert.equal(us.sound,true);
 assertBoard(uw,v4game,'v4 board shifts by two without changing rules');
 assert.equal(uw.localStorage.getItem('hexrota-match-v4'),JSON.stringify(v4),'old data stays intact');
 // Older changed-rule checkpoints are discarded, but progress/sound still migrate.
 for(const version of [2,3]){
  const legacy={current:5,done:[0,1,2,3,4],sound:true,boards:{5:{version,score:999}}};
  const migrated=mount(null,null,{['v'+version]:legacy}),mw=migrated.window,ms=readSave(mw);
  assert.deepEqual(ms.done,[0,1,2,3,4,5,6]);assert.equal(ms.current,7);assert.equal(ms.sound,true);
  assert.deepEqual(Object.keys(ms.boards),['7']);assertBoard(mw,savedGame(mw),'v'+version+' migration');assert.equal(ms.boards[7].turn,0,'incompatible old rules restart without inventing moves');
 }
 const v2={current:1,done:[0],sound:false,boards:{}},v3={current:4,done:[0,1,2,3],sound:true,boards:{}};
 const preferred=mount(null,null,{v2,v3,v4});assert.equal(readSave(preferred.window).current,7,'latest previous version wins');
 // Worker responses belong to one campaign board revision.
 for(const cancel of ['turn','restart']){
  const {WorkerStub,instances}=fakeWorkers(),fixture=mount(campaignState(),null,{Worker:WorkerStub,originalStage:2,hintDiagnostics:true}),fw=fixture.window,fd=fw.document;
  const source=fw.HEX_LEVELS[0],next=source.solution[0];let shadow=new fw.HexMatch(source);
  assert.equal(fd.getElementById('hint'),null,'developer worker coverage adds no manual control');fw.HexHintTestAdapter.request();assert.equal(instances.length,1);assert.equal(fw.HexHintTestAdapter.isPending(),true);
  assert.equal(fd.getElementById('reset').disabled,false);
  const worker=instances[0];assert(worker.url.includes('hint-worker.js'));assert(worker.payload.snapshot);
  if(cancel==='turn'){await swap(fw,next);shadow.swap(...next);}else {click(fw,'#reset');shadow=savedGame(fw);}
  worker.reply({pair:next});await settle();assert(worker.terminated);
  assert.equal(fd.querySelectorAll('#board .hinted').length,0,'late hint cannot override new revision');
  assertBoard(fw,shadow,'stale worker '+cancel);assert.equal(fw.HexHintTestAdapter.isPending(),false);
 }
 class UnavailableWorker{constructor(){throw new Error('Worker blocked');}}
 const blocked=mount(campaignState(),null,{Worker:UnavailableWorker,originalStage:2,hintDiagnostics:true});blocked.window.HexHintTestAdapter.request();await settle();assertLegalHint(blocked.window);
 const workers=fakeWorkers(),failed=mount(campaignState(),null,{Worker:workers.WorkerStub,originalStage:2,hintDiagnostics:true});failed.window.HexHintTestAdapter.request();
 workers.instances[0].onerror({preventDefault(){}});await settle();assert(workers.instances[0].terminated);assertLegalHint(failed.window);
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(unhandled.length,0,unhandled.join('\n'));
 console.log('UI checks passed: 2 guided tutorials + 10 campaign solutions, guarded actions, skip/replay, exact state, progress migration and stale/failing hints.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{for(const dom of mounted)dom.window.close();});
