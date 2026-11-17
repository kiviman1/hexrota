/* Actual production integration: starts, previews, retries, legacy saves and local events. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const {savedLevel,savedGame,prepareLifeBypass}=require('./qa-fixtures.cjs');
const root=__dirname+'/dist/',key='hexrota-match-v5',eventKey='hexrota-events-v1';
const read=file=>fs.readFileSync(root+file,'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),tests=[],errors=[],unhandled=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const test=(name,run)=>tests.push({name,run});
async function until(check,message,timeout=1800){const start=Date.now();while(!check()&&Date.now()-start<timeout)await wait(5);assert(check(),message);}
function fresh(stage=2){return {current:stage,done:Array.from({length:stage},(_,i)=>i),boards:{},sound:true,preferences:{music:false,volume:.5,motion:'reduce',haptics:false},variantSelection:{seed:0x41abca,serial:0,counts:{},recent:{}}};}
function mount(state=fresh(),options={}){
 const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(read('index.html'),{url:'https://hexrota-attempts.example/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,d=w.document,feedback=[],network=[];
 w.matchMedia=()=>({matches:!options.motion,addEventListener(){},removeEventListener(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};
 w.fetch=(...args)=>{network.push(['fetch',args]);return Promise.reject(new Error('Gameplay must remain local'));};
 Object.defineProperty(w.navigator,'sendBeacon',{configurable:true,value:(...args)=>{network.push(['beacon',args]);return true;}});
 if(options.motion)w.Element.prototype.animate=function(){let rejected,promise;return {get finished(){return promise||(promise=new Promise((_,reject)=>{rejected=reject;}));},cancel(){rejected?.(new w.DOMException('Animation cancelled','AbortError'));}};};
 class AudioStub{configure(){}unlock(){return Promise.resolve();}setActive(){}move(){feedback.push('move');}victory(){feedback.push('victory');}click(){}reward(cue){feedback.push(plain(cue));}stop(){}dispose(){}}
 w.HexAudio=AudioStub;
 if(options.oldV4)w.localStorage.setItem('hexrota-match-v4',JSON.stringify(options.oldV4));
 else w.localStorage.setItem(key,JSON.stringify(state));
 if(options.events)w.localStorage.setItem(eventKey,JSON.stringify(options.events));
 for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js','events.js','reward-rules.js','rewards.js','reward-adapter.js','app.js']){
  if(file==='app.js')prepareLifeBypass(w,read,{hintDiagnostics:options.hintDiagnostics===true});
  if(file==='app.js'&&Object.hasOwn(options,'pack'))w.HEX_VARIANTS=options.pack;
  if(file==='app.js'&&options.attempts===false)delete w.HexAttempts;
  w.eval(read(file));
 }
 const f={w,d,dom,feedback,network,save:()=>JSON.parse(w.localStorage.getItem(key)),eventState:()=>JSON.parse(w.localStorage.getItem(eventKey)||'null'),close(){dom.window.close();}};
 f.node=selector=>{const node=d.querySelector(selector);assert(node,selector+' exists');return node;};
 f.click=selector=>f.node(selector).dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:0}));
 f.events=name=>(f.eventState()?.events||[]).filter(event=>!name||event.name===name);
 f.game=()=>savedGame(w);f.level=()=>savedLevel(w);
 return f;
}
function snapshot(f){const save=f.save();return plain(save.boards[save.current]);}
function identity(f){const save=f.save();return plain(save.attempts[save.current]);}
function stats(f){const save=f.save();return plain(save.attemptStats[save.current]);}
async function enter(f){f.click('#home-play');if(f.node('#pregame-dialog').open)f.click('#pregame-start');await wait(1);assert.equal(f.d.body.dataset.screen,'game','a real playable game opens');}
async function move(f,pair){for(const i of pair)f.click(`#board [data-index="${i}"]`);await until(()=>f.node('#board').getAttribute('aria-busy')==='false','move presentation settles');}
function exact(f,game,message){assert.deepEqual(snapshot(f),plain(game.snapshot()),message);assert.equal(+f.node('#sum').textContent,game.score);assert.equal(+f.node('#moves-left').textContent,game.movesLeft);assert.equal(f.node('#coverage').textContent,`${game.covered} / ${game.total}`);}
function validEvents(f){const state=f.eventState();if(state)assert(f.w.HexEvents.validateState(state));assert.equal(f.network.length,0,'gameplay and events never contact a third party');}

test('preview never starts an attempt; actual entry chooses a certified variant exactly once',async()=>{
 const f=mount();try{
  assert.equal(f.w.HEX_VARIANTS.levels.length,10,'the complete real production catalogue is loaded');
  assert(f.w.HEX_VARIANTS.levels.every(level=>level.variants.length>=4));
  const initial=plain(f.save());assert(!initial.boards[2]&&!initial.attempts[2],'booting the menu does not spend a variant selection');
  f.click('[data-nav="journey"]');f.click('[data-stage="2"]');assert(f.node('#pregame-dialog').open);
  assert.deepEqual(f.save(),initial,'viewing objectives preserves every saved board, identity and selector');assert.equal(f.events().length,0);
  f.click('#pregame-dialog [data-close]');assert.deepEqual(f.save(),initial,'canceling the preview is also observational');
  f.click('[data-stage="2"]');f.click('#pregame-start');assert.equal(f.d.body.dataset.screen,'game');
  const meta=identity(f),game=f.game();assert.equal(meta.levelId,1);assert.notEqual(meta.variantId,'legacy-original');assert.equal(meta.levelDataVersion,f.w.HEX_VARIANTS.levelDataVersion);
  assert.equal(meta.attemptVersion,1);assert.equal(game.turn,0);assert.equal(game.score,0);assert.equal(game.movesLeft,f.w.HEX_LEVELS[0].moves);
  assert.equal(f.save().variantSelection.serial,1);assert.equal(f.save().variantSelection.counts[1],1);
  assert.equal(f.events('level_started').filter(event=>event.attemptId===meta.attemptId).length,1);assert.equal(stats(f).started,true);
  exact(f,game,'saved initial board is exactly the selected configuration');validEvents(f);
 }finally{f.close();}
});

test('continue and hint preserve the exact variant, RNG, move history and reward state',async()=>{
 let f=mount();try{
  await enter(f);const game=f.game(),pair=game.level.solution[0];game.swap(...pair);await move(f,pair);exact(f,game,'first certified variant move');
  const save=plain(f.save()),events=plain(f.eventState()),meta=identity(f),selector=plain(save.variantSelection);f.close();f=mount(save,{events,hintDiagnostics:true});
  await enter(f);exact(f,game,'reload continues the exact board');assert.deepEqual(identity(f),meta);assert.deepEqual(f.save().variantSelection,selector);assert.deepEqual(f.eventState(),events,'resume does not count another start');
  const before=snapshot(f),rewards=f.feedback.length;assert.equal(f.d.querySelector('#hint'),null,'manual hint control stays removed');f.w.HexHintTestAdapter.request();await until(()=>f.d.querySelectorAll('#board .hinted').length===2,'a real variant hint is displayed');
  assert.deepEqual(snapshot(f),before,'hint cannot mutate score, terrain, moves, RNG or history');assert.deepEqual(identity(f),meta);assert.deepEqual(f.save().variantSelection,selector);assert.equal(f.feedback.length,rewards,'a hint cannot award audiovisual rewards');
  assert.equal(stats(f).hintsUsed,1);const hint=f.events('hint_used').at(-1);assert(hint);assert.equal(hint.attemptId,meta.attemptId);assert.equal(hint.hintKind,'proven_route');assert.equal(hint.hintGuarantee,'certified_route');
  assert.equal(hint.score,game.score);assert.equal(hint.movesRemaining,game.movesLeft);validEvents(f);
 }finally{f.close();}
});

test('malformed or forged legacy metadata is never silently dropped, even when modules are unavailable',async()=>{
 const source=mount();let checkpoint;try{const game=new source.w.HexMatch(source.w.HEX_LEVELS[0]);game.swap(...game.level.solution[0]);checkpoint=plain(game.snapshot());}finally{source.close();}
 const canonical={attemptVersion:1,levelId:1,variantId:'legacy-original',levelDataVersion:'original-v1',attemptId:'legacy-1',attemptSerial:0};
 const invalid=[false,'invalid',[],{...canonical,levelId:2},{...canonical,levelDataVersion:'unavailable'},{...canonical,attemptId:'legacy-2'},{...canonical,attemptSerial:1}];
 for(const unavailable of [{},{pack:{schemaVersion:999,levels:[]}},{attempts:false}])for(const metadata of invalid){
  const state=fresh();state.boards[2]=plain(checkpoint);state.attempts={2:metadata};const f=mount(state,unavailable);try{
   const before=plain(f.save());assert.deepEqual(before.boards[2],checkpoint);assert.deepEqual(before.attempts[2],metadata,'invalid metadata stays visible to validation rather than becoming an absent legacy identity');
   f.click('#home-play');if(f.node('#pregame-dialog').open)f.click('#pregame-start');
   if(f.node('#restart-dialog').open)f.click('#restart-cancel');
   assert.notEqual(f.d.body.dataset.screen,'game','forged legacy identity cannot become an active board');
   assert.deepEqual(f.save().boards[2],checkpoint);assert.deepEqual(f.save().attempts[2],metadata);assert.deepEqual(f.save().variantSelection,before.variantSelection);assert.equal(f.events().length,0);validEvents(f);
  }finally{f.close();}
 }
});

test('restart is explicit, cancel preserves a paused game, and confirmation chooses another variant',async()=>{
 const f=mount();try{
  await enter(f);await move(f,f.level().solution[0]);const before=plain(f.save()),events=plain(f.eventState()),old=identity(f);
  f.click('#reset');assert(f.node('#restart-dialog').open,'a live campaign restart asks for concrete confirmation');
  assert(/sıfır|silin|kaybol/i.test(f.node('#restart-dialog').textContent),'confirmation explains that progress is reset');
  assert.deepEqual(f.save(),before,'opening confirmation cannot change the attempt');assert.deepEqual(f.eventState(),events);
  f.click('#restart-cancel');assert(!f.node('#restart-dialog').open);assert.deepEqual(f.save(),before);
  f.click('#pause');f.click('#pause-restart');assert(f.node('#pause-dialog').open&&f.node('#restart-dialog').open);
  f.click('#restart-cancel');assert(f.node('#pause-dialog').open,'cancel returns to the same pause menu');assert.deepEqual(f.save(),before);f.click('#pause-continue');
  f.click('#reset');f.click('#restart-confirm');const next=identity(f);
  assert.notEqual(next.variantId,old.variantId,'manual retry avoids the last start');assert.notEqual(next.attemptId,old.attemptId);assert.equal(next.attemptSerial,old.attemptSerial+1);
  assert.equal(snapshot(f).turn,0);assert.equal(snapshot(f).score,0);assert.equal(stats(f).attemptNumber,2);assert.equal(f.save().variantSelection.counts[1],2);
  assert.equal(f.events('level_abandoned').filter(event=>event.attemptId===old.attemptId).length,1,'discarding an unfinished attempt is recorded once');
  const retry=f.events('level_retried').at(-1);assert.equal(retry.previousAttemptId,old.attemptId);assert.equal(retry.attemptId,next.attemptId);
  assert.equal(f.events('level_started').filter(event=>event.attemptId===next.attemptId).length,1);
  const restarted=plain(f.save());f.click('#game-home');await enter(f);assert.deepEqual(identity(f),next,'an untouched but started variant also resumes without rotating');assert.deepEqual(f.save().variantSelection,restarted.variantSelection);validEvents(f);
 }finally{f.close();}
});

test('a failed campaign attempt retries immediately with a new certified variant',async()=>{
 const f=mount(fresh(11));try{
  await enter(f);const level=f.level();let losing;
  for(let policy=0;policy<120&&!losing;policy++){
   const game=new f.w.HexMatch(level),route=[];
   while(game.status==='playing'){const legal=game.legalMoves(),pair=legal[(game.turn*7+policy)%legal.length];route.push(plain(pair));game.swap(...pair);}
   if(game.status==='lost')losing=route;
  }
  assert(losing,'the challenge board contains a genuine failing blind route');
  const old=identity(f);for(const pair of losing)await move(f,pair);await until(()=>f.node('#lose-dialog').open,'failure result opens');
  assert.equal(snapshot(f).movesLeft,0);assert.equal(f.events('level_failed').filter(event=>event.attemptId===old.attemptId).length,1);
  const failed=f.events('level_failed').at(-1);assert.equal(failed.status,'lost');assert.equal(failed.movesRemaining,0);assert.equal(failed.score,snapshot(f).score);
  f.click('#retry');assert(!f.node('#restart-dialog').open,'loss retry does not add an unnecessary confirmation');
  const next=identity(f);assert.notEqual(next.variantId,old.variantId);assert.notEqual(next.attemptId,old.attemptId);assert.equal(snapshot(f).turn,0);assert.equal(stats(f).attemptNumber,2);
  assert.equal(f.events('level_retried').at(-1).previousAttemptId,old.attemptId);assert.equal(f.events('level_failed').filter(event=>event.attemptId===old.attemptId).length,1);validEvents(f);
 }finally{f.close();}
});

test('winning, review and reload record one terminal result even after event-buffer eviction',async()=>{
 let f=mount();try{
  await enter(f);const meta=identity(f),shadow=f.game();let cascades=0;
  for(const pair of shadow.level.solution){const result=shadow.swap(...pair);cascades+=Math.max(0,result.frames.length-1);await move(f,pair);}
  await until(()=>f.node('#win-dialog').open,'certified route opens victory');exact(f,shadow,'certified variant win');
  const completed=f.events('level_completed').filter(event=>event.attemptId===meta.attemptId);assert.equal(completed.length,1);assert.equal(completed[0].status,'won');assert.equal(completed[0].covered,shadow.total);assert.equal(completed[0].cascades,cascades);assert.equal(stats(f).terminalEvent,'level_completed');
  f.click('#review');await wait(30);assert.equal(f.events('level_completed').filter(event=>event.attemptId===meta.attemptId).length,1,'review cannot repeat completion');
  const save=plain(f.save());let events=f.w.HexEvents.createState({limit:1});
  events=f.w.HexEvents.append(events,'hint_used',{timestamp:10,levelId:1,variantId:meta.variantId,levelDataVersion:meta.levelDataVersion,attemptId:'qa-other-attempt',attemptNumber:1,movesUsed:0,movesRemaining:shadow.level.moves,score:0,targetScore:shadow.level.target,covered:0,totalCells:shadow.total,remainingLayers:shadow.level.cells.reduce((n,cell)=>n+(cell.layers||1),0),cascades:0,hintsUsed:1,status:'playing'},{hintKind:'heuristic',hintGuarantee:'none'});
  f.close();f=mount(save,{events:plain(events)});assert.deepEqual(f.eventState(),plain(events),'persisted terminal flags prevent old events being invented after buffer trimming');assert.equal(f.feedback.length,0,'restoring a won attempt does not replay reward effects');validEvents(f);
 }finally{f.close();}
});

test('legacy checkpoints remain exact and malformed identities cannot erase them or other progress',async()=>{
 let f=mount();try{
  const base=f.w.HEX_LEVELS[5],game=new f.w.HexMatch(base);game.swap(...base.solution[0]);const checkpoint=plain(game.snapshot()),state=fresh(7);state.boards[7]=checkpoint;
  const other=new f.w.HexMatch(f.w.HEX_LEVELS[0]);other.swap(...other.level.solution[0]);state.boards[2]=plain(other.snapshot());f.close();f=mount(state);await enter(f);
  exact(f,game,'existing v5 raw checkpoint continues with the original arrangement and refill seed');assert.equal(identity(f).variantId,'legacy-original');assert.equal(identity(f).levelDataVersion,'original-v1');assert.deepEqual(f.save().boards[2],state.boards[2]);
  const valid=plain(f.save());valid.attempts[7]={attemptVersion:1,levelId:base.id,variantId:'not-available',levelDataVersion:'future-unavailable',attemptId:'a-6-8-11223344',attemptSerial:8};
  f.close();f=mount(valid);const protectedBefore=plain(f.save());assert.deepEqual(protectedBefore.boards[7],checkpoint,'unavailable variant data never overwrites a saved board');
  f.click('#home-play');assert(f.node('#pregame-dialog').open);assert(/korun|açılam/i.test(f.node('#pregame-description').textContent));
  f.click('#pregame-start');assert(f.node('#restart-dialog').open,'replacing an unreadable checkpoint still requires explicit consent');f.click('#restart-cancel');
  assert.deepEqual(f.save().boards,protectedBefore.boards);assert.deepEqual(f.save().attempts,protectedBefore.attempts);assert.deepEqual(f.save().variantSelection,protectedBefore.variantSelection);assert.equal(f.events().length,0);validEvents(f);
 }finally{f.close();}
});

test('missing or corrupt variant packs fail closed while valid original saves can continue',async()=>{
 for(const unavailable of [{pack:undefined},{pack:{schemaVersion:999,levels:[]}},{attempts:false}]){
  const f=mount(fresh(),unavailable);try{
   const before=plain(f.save());f.click('#home-play');f.click('#pregame-start');assert.equal(f.d.body.dataset.screen,'home','unverified fallback boards never enter play');
   assert(!f.save().boards[2]&&!f.save().attempts[2]);assert.deepEqual(f.save().variantSelection,before.variantSelection,'failed loading does not consume a selector or attempt count');assert.equal(f.events().length,0);assert(/yüklenemedi/i.test(f.node('#toast').textContent));validEvents(f);
  }finally{f.close();}
 }
 let seed=mount();let state,game;try{game=new seed.w.HexMatch(seed.w.HEX_LEVELS[0]);game.swap(...game.level.solution[0]);state=fresh();state.boards[2]=plain(game.snapshot());}finally{seed.close();}
 const legacy=mount(state,{pack:undefined});try{await enter(legacy);exact(legacy,game,'an original checkpoint does not require a new catalogue');validEvents(legacy);}finally{legacy.close();}
});

test('presentation cancellation and free tutorial navigation preserve the only active campaign attempt',async()=>{
 const state=fresh();state.preferences.motion='full';const f=mount(state,{motion:true});try{
  f.click('[data-nav="journey"]');f.click('[data-stage="2"]');f.click('#pregame-start');const game=f.game(),meta=identity(f),pair=game.level.solution[0];game.swap(...pair);
  for(const index of pair)f.click(`#board [data-index="${index}"]`);assert.equal(f.node('#board').getAttribute('aria-busy'),'true');
  assert.deepEqual(snapshot(f),plain(game.snapshot()),'the engine commits once before reward/animation work');f.click('#skip-animation');await until(()=>f.node('#board').getAttribute('aria-busy')==='false','skipping releases the variant board');exact(f,game,'skipping cannot alter the variant result');
  const old=plain(f.save().boards[2]),oldMeta=identity(f);f.click('#game-home');f.click('[data-nav="journey"]');assert.equal(f.d.querySelector('[data-stage="3"]'),null,'future main levels are not playable out of order');f.click('[data-stage="0"]');
  const preview=plain(f.save());assert.deepEqual(preview.boards[2],old);assert.deepEqual(preview.attempts[2],oldMeta);f.click('#pregame-start');assert.equal(f.save().current,0,'free tutorials remain replayable during the campaign');
  assert.deepEqual(f.save().boards[2],old,'starting a free tutorial preserves the campaign checkpoint');const selection=plain(f.save().variantSelection);
  f.click('#game-home');f.click('[data-nav="journey"]');f.click('[data-stage="2"]');f.click('#pregame-start');exact(f,game,'returning to the previous level continues its exact variant');assert.deepEqual(identity(f),meta);assert.deepEqual(f.save().variantSelection,selection);
  assert.equal(f.events('level_started').filter(event=>event.attemptId===meta.attemptId).length,1);assert.equal(f.events('level_abandoned').filter(event=>event.attemptId===meta.attemptId).length,0,'navigation alone does not declare permanent abandonment');validEvents(f);
 }finally{f.close();}
});

(async()=>{
 for(const {name,run} of tests){await run();console.log('✓ '+name);}
 assert.deepEqual(errors,[],'no browser exceptions');assert.deepEqual(unhandled,[],'no stale asynchronous failures');
 console.log('Attempt UI checks passed: certified starts, exact continuation, guarded fresh retries, preserved legacy saves, honest hints and local-only events.');
})().catch(error=>{console.error(error);process.exitCode=1;});
