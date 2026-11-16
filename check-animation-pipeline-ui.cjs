/* Actual application presentation acceptance. Public visual adapters are
 * observed; production commands, engine, canonical store and UI remain real. */
'use strict';
const assert=require('node:assert/strict');
const {mount,existing,plain,enter,until,wait}=require('./check-lives-ui.cjs');
const {beforeWin}=require('./check-progression-ui.cjs');
const PROFILE='hexrota-profile-v2',EVENTS='hexrota-events-v1';
const tests=[],errors=[],unhandled=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const test=(name,run)=>tests.push({name,run});
const profile=f=>JSON.parse(f.w.localStorage.getItem(PROFILE));
const canonical=f=>f.w.localStorage.getItem(PROFILE);
const gems=f=>[...f.d.querySelectorAll('#board > [data-index]')].map(tile=>tile.querySelector(':scope > .gem'));
const values=f=>gems(f).map(gem=>Number(gem.querySelector('.hex-number').textContent));
function candidate(waves){
 for(let turns=0;turns<9;turns++){
  const entry=existing(2,{turns});if(entry.game.status!=='playing')continue;
  for(const pair of entry.game.legalMoves()){
   const model=entry.game.clone(),result=model.swap(...pair);
   if(result.ok&&result.frames.length===waves&&model.status==='playing')return {saved:entry.saved,pair:plain(pair),result:plain(result),expected:plain(model.snapshot())};
  }
 }
 assert.fail('the production fixture has a genuine '+waves+'-wave continuation');
}
const one=candidate(1),five=candidate(5);
function writes(f,{failAt=0}={}){
 const native=f.w.Storage.prototype.setItem,log={attempts:0,successes:0,rejected:0};
 f.w.Storage.prototype.setItem=function(key,value){
  if(key===PROFILE){log.attempts++;if(log.attempts===failAt){log.rejected++;throw new f.w.DOMException('pipeline canonical fault','QuotaExceededError');}log.successes++;}
  return native.call(this,key,value);
 };
 log.restore=()=>{f.w.Storage.prototype.setItem=native;};return log;
}
function fixture({saved=one.saved,reduced=false,rejectKind=null,phaseFailure=false,deferSwap=false,rejectReaction=false}={}){
 const observed={runs:[],animations:[],deferred:[],reactionCalls:0,rejectedAnimations:0};
 const f=mount({saved:{...plain(saved),preferences:{...saved.preferences,motion:reduced?'reduce':'full'}},beforeApp(w){
  const Native=w.HexMovePresentation;
  w.HexMovePresentation=Object.freeze({...Native,play(options){
   const run={plan:options.plan,attemptId:options.attemptId,phases:[],bytes:w.localStorage.getItem(PROFILE),events:w.localStorage.getItem(EVENTS),started:performance.now(),times:[],outcome:null,identities:0,spawns:0};
   observed.runs.push(run);
   const original=options.adapters,sourceGems=[...w.document.querySelectorAll('#board > [data-index]')].map(tile=>tile.querySelector(':scope > .gem'));
   const board=()=>[...w.document.querySelectorAll('#board > [data-index]')].map(tile=>tile.querySelector(':scope > .gem'));
   let waveGems;
   const adapters={...original,
    swap(plan){const task=original.swap(plan);if(!deferSwap)return task;task.catch(()=>{});return new Promise(resolve=>observed.deferred.push(resolve));},
    match(wave){
     if(phaseFailure)throw new Error('pipeline optional match renderer failed');
     const result=original.match(wave),current=board();
     assert.deepEqual(current.map(gem=>Number(gem.querySelector('.hex-number').textContent)),plain(wave.frame.before),'MATCH displays the exact resolved before projection');
     if(wave.wave===1){
      const expected=sourceGems.slice();for(const [from,to]of wave.firstMoves)expected[to]=sourceGems[from];
      current.forEach((node,index)=>assert.equal(node,expected[index],'the original stone survives the reciprocal swap at '+index));
     }
     waveGems=current;return result;
    },
    fall(wave){
     const result=original.fall(wave),current=board(),routes=new Map(wave.frame.falls.map(fall=>[fall.to,fall]));
     assert.deepEqual(current.map(gem=>Number(gem.querySelector('.hex-number').textContent)),plain(wave.frame.after),'FALL displays the exact resolved after projection');
     for(const [index,node]of current.entries()){
      const fall=routes.get(index);
      if(fall?.spawn){assert(!waveGems.includes(node),'a refill creates a new visual stone rather than recycling a cleared one');run.spawns++;}
      else{const from=fall?fall.from:index;assert.equal(node,waveGems[from],'each moving or stationary survivor retains DOM identity');run.identities++;}
     }
     for(const index of wave.frame.matched)assert.equal(waveGems[index].isConnected,false,'a cleared gem leaves the live board');
     return result;
    }
   };
   return Native.play({...options,adapters,onPhase(event){
    assert.equal(w.localStorage.getItem(PROFILE),run.bytes,'visual phase '+event.phase+' cannot write or rewind canonical gameplay');
    assert.equal(w.localStorage.getItem(EVENTS),run.events,'visual phase '+event.phase+' cannot rewind terminal observation');
    assert.equal(event.attemptId,run.attemptId);assert.equal(Object.isFrozen(event),true);assert.equal(Object.isFrozen(run.plan),true);
    run.phases.push({phase:event.phase,wave:event.wave});run.times.push({phase:event.phase,wave:event.wave,ms:Math.round(performance.now()-run.started)});options.onPhase?.(event);
   }}).then(outcome=>{run.outcome=outcome;run.elapsed=Math.round(performance.now()-run.started);return outcome;});
  }});
  if(rejectReaction){const Scene=w.HexScenePresentation;w.HexScenePresentation=Object.freeze({...Scene,create(options){const actor=Scene.create(options);return {...actor,react(){observed.reactionCalls++;return Promise.reject(new Error('optional character reaction rejected'));}};}});}
 }});
 f.w.matchMedia=()=>({matches:reduced,addEventListener(){},removeEventListener(){}});
 f.w.Element.prototype.animate=function(frames,options={}){
  const kind=this.closest?.('.swap-pair')?.getAttribute('data-swap-kind');
  const reject=rejectKind===kind&&observed.rejectedAnimations===0;
  if(reject)observed.rejectedAnimations++;
  const finished=reject?new Promise((resolve,no)=>f.w.setTimeout(()=>no(new Error('native finished promise rejected')),10)):Promise.resolve();
  const animation={target:this,frames,options,finished,cancelled:false,cancel(){this.cancelled=true;},finish(){},addEventListener(){},removeEventListener(){}};
  observed.animations.push(animation);return animation;
 };
 f.w.Element.prototype.getAnimations=function(){return observed.animations.filter(animation=>animation.target===this&&!animation.cancelled);};
 f.w.addEventListener('error',event=>errors.push(event.error?.message||event.message));
 f.begin=pair=>{for(const index of pair)f.click(`#board [data-index="${index}"]`);};
 f.idle=()=>until(()=>f.node('#board').getAttribute('aria-busy')==='false','pipeline releases the actual board',4500);
 f.observed=observed;return f;
}
function clean(f,{tutorialDemo=false}={}){
 assert.equal(f.node('#board').getAttribute('aria-busy'),'false');assert.equal(f.node('#board-stage').classList.contains('busy'),false);
 assert.equal(f.node('#reset').disabled,false);assert.equal(f.node('#skip-animation').hidden,true);
 assert.equal(f.d.querySelectorAll('.swap-pair,.score-packet,.score-digit,.score-burst-ring,.score-burst-spark').length,0,'all transient owned visuals are removed');
 const hidden=gems(f).filter(gem=>gem.style.visibility==='hidden');
 if(tutorialDemo){assert.equal(hidden.length,2,'only the active new tutorial demonstration hides its two sources');assert(hidden.every(gem=>gem.classList.contains('tutorial-demo-source')));assert.equal(f.d.querySelectorAll('#board .tutorial-demo-mover').length,2,'the new owner has both corresponding demonstration copies');}
 else assert.equal(hidden.length,0,'no settled gameplay gem remains hidden');
 assert.equal(f.node('#board').dataset.presentationPhase,undefined,'the transient phase projection is removed');
}
function exact(f,expected,stage=2){assert.deepEqual(profile(f).game.boards[stage],expected);assert.deepEqual(plain(f.game().snapshot()),expected);assert.deepEqual(values(f),expected.values);assert.equal(Number(f.node('#sum').textContent),expected.score);}
function sequence(count){const phases=[{phase:'SWAP',wave:null}];for(let i=1;i<=count;i++){if(i>1)phases.push({phase:'CASCADE',wave:i});for(const phase of ['MATCH','CLEAR','FALL','REFILL'])phases.push({phase,wave:i});}phases.push({phase:'SETTLE',wave:null});return phases;}
function invalid(f){const game=f.game();for(let a=0;a<game.total;a++)for(const b of game.neighbors[a])if(!game.clone().swap(a,b).ok)return [a,b];assert.fail('actual board offers an invalid neighboring swap');}

for(const item of [one,five])test(item.result.frames.length+' real waves consume the resolved frame sequence and retain every survivor identity',async()=>{
 const f=fixture({saved:item.saved});let log;try{
  await enter(f);const before=profile(f),oldFloor=f.d.querySelector('#board [data-index="0"] .floor-shape');log=writes(f);f.begin(item.pair);await f.idle();await wait(5);clean(f);exact(f,item.expected);
  const run=f.observed.runs[0];assert(run);assert.deepEqual(run.phases,sequence(item.result.frames.length),'exact full sequence '+JSON.stringify({budget:run.plan.budget,elapsed:run.elapsed,outcome:run.outcome,times:run.times}));assert.equal(run.outcome.status,'succeeded');assert.equal(run.outcome.wavesPresented,item.result.frames.length);
  assert.deepEqual(plain(run.plan.waves.map(wave=>wave.frame)),item.result.frames,'presentation consumes every actual engine wave without recomputing it');assert(run.identities>0);assert(run.spawns>0);
  assert.equal(f.d.querySelector('#board [data-index="0"] .floor-shape'),oldFloor,'fixed ground node is not reconstructed by the timeline');
  assert.equal(canonical(f),run.bytes);assert.deepEqual(profile(f).energy,before.energy);assert.deepEqual(profile(f).game.economy,before.game.economy);assert.deepEqual(profile(f).game.attempts,before.game.attempts);
  assert.equal(log.attempts,1);assert.equal(log.successes,1);assert.equal(profile(f).revision,before.revision+1);
 }finally{log?.restore();f.close();}
});

test('reduced motion settles the exact committed board without decorative phases or extra writes',async()=>{
 const f=fixture({reduced:true});let log;try{await enter(f);log=writes(f);f.begin(one.pair);await f.idle();await wait(5);clean(f);exact(f,one.expected);assert.equal(f.observed.runs.length,0,'the existing immediate reduced-motion path needs no decorative coordinator job');assert.equal(f.observed.animations.length,0);assert.equal(log.attempts,1);}finally{log?.restore();f.close();}
});

test('invalid feedback uses no move pipeline, canonical write, RNG or reward',async()=>{
 const f=fixture();let log;try{await enter(f);const before=canonical(f),snapshot=plain(f.game().snapshot());log=writes(f);f.begin(invalid(f));await wait(310);clean(f);assert.equal(canonical(f),before);exact(f,snapshot);assert.equal(f.observed.runs.length,0);assert.equal(log.attempts,0);}finally{log?.restore();f.close();}
});

for(const kind of ['valid','invalid'])test('a rejecting native '+kind+' animation promise is observed and does not block the next command',async()=>{
 const f=fixture({rejectKind:kind});let log;try{
  await enter(f);const before=canonical(f);log=writes(f);f.begin(kind==='valid'?one.pair:invalid(f));
  await wait(25);await f.idle();clean(f);assert.equal(f.observed.rejectedAnimations,1);
  if(kind==='valid'){exact(f,one.expected);assert.equal(log.attempts,1);assert.equal(f.observed.runs[0].outcome.status,'cancelled');}
  else{assert.equal(canonical(f),before);assert.equal(log.attempts,0);}
  const model=f.game();let pair;
  for(const move of model.legalMoves()){const candidate=model.clone();if(candidate.swap(...move).ok&&candidate.status==='playing'){pair=plain(move);break;}}
  assert(pair);assert(model.swap(...pair).ok);f.begin(pair);f.click('#skip-animation');await f.idle();await wait(5);clean(f);exact(f,plain(model.snapshot()));assert.equal(log.attempts,kind==='valid'?2:1);
 }finally{log?.restore();f.close();}
});

test('a deferred completion from a previous Attempt ID cannot paint a newly opened tutorial',async()=>{
 const f=fixture({deferSwap:true});try{
  await enter(f);f.begin(one.pair);assert.equal(f.observed.deferred.length,1);const oldRun=f.observed.runs[0],oldAttempt=oldRun.attemptId;
  f.click('#game-home');f.click('[data-nav="journey"]');f.click('[data-stage="0"]');f.click('#pregame-start');await wait(5);assert.equal(f.d.body.dataset.screen,'game');assert.equal(f.save().current,0);
  const before=canonical(f),tutorial=plain(f.game().snapshot()),newAttempt=f.save().attempts[0].attemptId;assert.notEqual(newAttempt,oldAttempt);
  const boardMarkup=f.node('#board').innerHTML,phase=f.node('#board').dataset.presentationPhase;f.observed.deferred[0]();await wait(380);
  assert.equal(oldRun.outcome.status,'cancelled');assert.equal(canonical(f),before);assert.deepEqual(plain(f.game().snapshot()),tutorial);assert.equal(f.node('#board').innerHTML,boardMarkup);assert.equal(f.node('#board').dataset.presentationPhase,phase);assert.equal(f.node('#win-dialog').open,false);clean(f,{tutorialDemo:true});
 }finally{f.close();}
});

test('a visual adapter failure after a committed winning move keeps the earned result eligible',async()=>{
 const f=fixture({saved:beforeWin(1),phaseFailure:true});let log;try{
  await enter(f);const before=profile(f),model=f.game(),pair=plain(model.level.solution.at(-1));assert(model.swap(...pair).ok);assert.equal(model.status,'won');log=writes(f);f.begin(pair);await f.idle();await until(()=>f.node('#win-dialog').open,'committed win survives optional match-render failure');clean(f);exact(f,plain(model.snapshot()));
  assert.equal(f.observed.runs[0].outcome.status,'failed');assert.equal(profile(f).game.economy.gold,before.game.economy.gold+20);assert.equal(profile(f).game.economy.stars,before.game.economy.stars+1);
  assert.equal(Object.values(profile(f).game.economy.transactions).filter(row=>row.kind==='clear'&&row.levelId===1).length,1);assert.equal(f.events().events.filter(row=>row.name==='level_completed'&&row.attemptId===f.save().attempts[2].attemptId).length,1);assert.equal(log.attempts,1);
 }finally{log?.restore();f.close();}
});

test('a real losing move presents defeat after settling once and repeating the result cannot spend another life',async()=>{
 const entry=existing(2,{lost:true}),route=plain(entry.game.history),model=new entry.game.constructor(entry.game.level);
 let cascades=0;for(const pair of route.slice(0,-1))cascades+=Math.max(0,model.swap(...pair).frames.length-1);
 const saved=plain(entry.saved);saved.boards[2]=plain(model.snapshot());saved.attemptStats[2]={...saved.attemptStats[2],terminalEvent:null,cascades};
 const pair=route.at(-1),result=model.swap(...pair);assert.equal(result.ok,true);assert.equal(model.status,'lost');
 const f=fixture({saved});let log;try{
  await enter(f);const before=profile(f);log=writes(f);f.begin(pair);await f.idle();await until(()=>f.node('#lose-dialog').open,'the committed real loss opens normal defeat');clean(f);exact(f,plain(model.snapshot()));
  const committed=canonical(f),run=f.observed.runs[0];assert.equal(run.outcome.status,'succeeded');assert.equal(run.outcome.wavesPresented,result.frames.length);assert.equal(profile(f).energy.life.lives,before.energy.life.lives-1);
  assert.deepEqual(profile(f).game.economy,before.game.economy);assert.equal(f.events().events.filter(row=>row.name==='level_failed'&&row.attemptId===run.attemptId).length,1);assert.equal(log.attempts,1);
  f.click('#lose-dialog [data-close]');f.click('#continue');assert.equal(f.node('#lose-dialog').open,true);assert.equal(canonical(f),committed);assert.equal(log.attempts,1);
 }finally{log?.restore();f.close();}
});

test('the first canonical write failure never starts a visual timeline or publishes a terminal success',async()=>{
 const f=fixture({saved:beforeWin(1)});let log;try{
  await enter(f);const before=canonical(f),model=f.game(),pair=plain(model.level.solution.at(-1));log=writes(f,{failAt:1});f.begin(pair);await f.idle();await wait(100);clean(f);assert.equal(canonical(f),before);assert.equal(f.observed.runs.length,0);assert.equal(f.node('#win-dialog').open,false);assert.equal(log.attempts,1);assert.equal(log.successes,0);assert.equal(log.rejected,1);
 }finally{log?.restore();f.close();}
});

test('an asynchronous Tavik reaction rejection cannot block gameplay or trigger persistence',async()=>{
 const f=fixture({rejectReaction:true});let log;try{await enter(f);log=writes(f);f.begin(one.pair);await f.idle();await wait(25);clean(f);exact(f,one.expected);assert.equal(f.observed.reactionCalls,1);assert.equal(log.attempts,1);assert.equal(f.observed.runs[0].outcome.status,'succeeded');}finally{log?.restore();f.close();}
});

async function run(){let failed=0;for(const {name,run:check}of tests)try{await check();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}await wait(20);assert.deepEqual(errors,[],'no uncaught visual exception');assert.deepEqual(unhandled,[],'all rejected visual promises are observed');console.log(`Animation pipeline actual-app checks: ${tests.length-failed}/${tests.length} groups passed.`);if(failed)process.exitCode=1;return {groups:tests.length,failed};}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={run};
