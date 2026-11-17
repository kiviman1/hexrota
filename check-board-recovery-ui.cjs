/* Real recovery-command failure boundaries. The immutable 9.9 fixture is used
 * as test-only legacy campaign content; no published level or save is edited.
 * Faults run at the real _stableBoard boundary, before or after its real body.
 * Pure assisted-wrapper checks do not claim to exercise booster UI callbacks. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {mount,fresh,lifePool,plain,enter,move,wait}=require('./check-lives-ui.cjs');
const fixture=require('./fixtures/dead-board-vectors-9-9.json').cases.find(row=>row.id==='natural-dead-board-after-swap-recovers-and-wins');
const colorFixture=require('./fixtures/dead-board-vectors-9-9.json').assistedCases[0];
assert(fixture,'the existing replayable natural-recovery fixture is available');
const PROFILE='hexrota-profile-v2',GAME='hexrota-match-v5',EVENTS='hexrota-events-v1',PLAYTEST='hexrota-playtest-v1',STAGE=2,LEVEL=1,ATTEMPT='legacy-1';
const tests=[],browserErrors=[],unhandled=[],results=[];
const test=(name,run)=>tests.push({name,run});
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const profile=f=>JSON.parse(f.w.localStorage.getItem(PROFILE));
const faultMessage=position=>'test-only '+position+' real recovery-helper failure';

function armRecoveryFault(Engine,position){
 assert(['before','after'].includes(position));
 const native=Engine.prototype._stableBoard,record={armed:true,entries:0,nativeCalls:0,rows:[]};
 Engine.prototype._stableBoard=function(...args){
  const inject=record.armed;
  if(!inject)return native.apply(this,args);
  record.entries++;
  const row={position,entry:plain(this.snapshot()),nativeCalled:false};record.rows.push(row);
  if(position==='before'){record.armed=false;throw Error(faultMessage(position));}
  row.nativeCalled=true;record.nativeCalls++;const result=native.apply(this,args);
  row.exit=plain(this.snapshot());row.returned=result;record.armed=false;
  throw Error(faultMessage(position));
 };
 record.restore=()=>{Engine.prototype._stableBoard=native;record.armed=false;};
 return record;
}
function assertReachedRecovery(record,position){
 assert.equal(record.entries,1,'the real swap enters recovery exactly once before its injected exception');
 assert.equal(record.nativeCalls,position==='after'?1:0);
 const trace=record.rows[0],before=fixture.steps[0].before?.snapshot||{turn:0,movesLeft:fixture.level.moves,score:0};
 assert.equal(trace.entry.turn,before.turn+1,'the command has spent its turn before reaching the helper');
 assert.equal(trace.entry.movesLeft,before.movesLeft-1);assert.equal(trace.entry.score,before.score+fixture.steps[0].result.scoreGain);
 assert.deepEqual(trace.entry.history,[fixture.steps[0].pair]);
 if(position==='after'){
  assert.equal(trace.returned,true,'the original helper body really executes successfully before the test-only exception');
  assert.deepEqual(trace.exit,fixture.steps[0].after.snapshot,'successful recovery keeps the original deterministic fixture result');
  assert.notEqual(trace.exit.rngState,trace.entry.rngState,'the original recovery performs real deterministic work');
 }
}
function recoveryMount(stored=null,storedEvents=null){
 const observed={operationEvents:[],rewardCreates:[],rewardEvaluations:[],rewardRestores:[],store:null,unsubscribe:null};
 const f=mount({saved:fresh(STAGE),life:lifePool(5),...(stored?{profile:stored}:{}),...(storedEvents?{events:storedEvents}:{}),beforeApp(w){
  const level={...plain(fixture.level),id:LEVEL,name:'Natural recovery test-only legacy alias',subtitle:'Unpublished recovery fixture'};
  w.HEX_LEVELS=w.HEX_LEVELS.map(row=>row.id===LEVEL?level:row);
  w.HEX_VARIANTS={...plain(w.HEX_VARIANTS),levels:w.HEX_VARIANTS.levels.filter(row=>row.levelId!==LEVEL).map(plain)};
  if(!stored){
   const saved=JSON.parse(w.localStorage.getItem(GAME));saved.current=STAGE;saved.boards={[STAGE]:plain(new w.HexMatch(level).snapshot())};
   saved.attempts={[STAGE]:{attemptVersion:1,levelId:LEVEL,variantId:'legacy-original',levelDataVersion:'original-v1',attemptId:ATTEMPT,attemptSerial:0}};
   w.localStorage.setItem(GAME,JSON.stringify(saved));
  }
  const Core=w.HexAppState;
  w.HexAppState=Object.freeze({...Core,create(options){const store=Core.create(options);observed.store=store;observed.unsubscribe=store.subscribe((change,previous,event)=>{if(event.type.startsWith('OPERATION_'))observed.operationEvents.push(plain(event));});return store;}});
  const director=w.HexRewards,adapter=w.HexRewardAdapter;
  w.HexRewards=Object.freeze({...director,createState(...args){const result=director.createState(...args);observed.rewardCreates.push(plain(result));return result;},evaluate(...args){const result=director.evaluate(...args);observed.rewardEvaluations.push(plain(result));return result;}});
  w.HexRewardAdapter=Object.freeze({...adapter,restore(...args){const result=adapter.restore(...args);observed.rewardRestores.push(plain(result));return result;}});
 }});
 f.w.addEventListener('error',event=>browserErrors.push(event.error?.message||event.message));
 f.observed=observed;const close=f.close;f.close=()=>{observed.unsubscribe?.();close();};return f;
}
function rewardObservation(f){return plain({creates:f.observed.rewardCreates,evaluations:f.observed.rewardEvaluations,restores:f.observed.rewardRestores});}
function capture(f){return {canonical:f.w.localStorage.getItem(PROFILE),events:f.w.localStorage.getItem(EVENTS),playtest:f.w.localStorage.getItem(PLAYTEST),game:f.w.localStorage.getItem(GAME),snapshot:plain(f.game().snapshot()),rewards:rewardObservation(f),operations:plain(f.observed.store.snapshot().operations),operationEvents:plain(f.observed.operationEvents)};}
function assertClean(f){
 assert.equal(f.node('#board').getAttribute('aria-busy'),'false');assert.equal(f.node('#board-stage').classList.contains('busy'),false);
 for(const id of ['#hint','#reset','#open-inventory'])assert.equal(f.node(id).disabled,false,id+' is available after failure');
 assert.equal(f.d.querySelectorAll('dialog[open]').length,0,'a failed command creates no result or provider dialog');
 assert.equal(f.d.querySelectorAll('.swap-pair,.swap-stone,.score-packet').length,0,'a failed command creates no move presentation');
}
function assertRendered(f,snapshot){
 assert.equal(+f.node('#sum').textContent,snapshot.score);assert.equal(+f.node('#moves-left').textContent,snapshot.movesLeft);
 assert.deepEqual([...f.d.querySelectorAll('#board [data-index] .hex-number')].map(node=>Number(node.textContent)),snapshot.values,'visible stones corroborate the host rollback');
 assert.equal(f.d.querySelectorAll('#board .floor-green').length,snapshot.layers.filter(value=>value===0).length);
}
function recordProfileWrites(f){
 const native=f.w.Storage.prototype.setItem,record={attempts:0};
 f.w.Storage.prototype.setItem=function(key,value){if(key===PROFILE)record.attempts++;return native.call(this,key,value);};
 record.restore=()=>{f.w.Storage.prototype.setItem=native;};return record;
}

for(const position of ['before','after'])test('actual app '+position+' recovery-helper exception rolls back every domain and permits explicit retry and reload',async()=>{
 let f=recoveryMount(),fault,writes;
 try{
  await enter(f);const before=capture(f),authority=plain(profile(f));assertRendered(f,before.snapshot);
  const expected=f.game().clone(),success=expected.swap(...fixture.steps[0].pair);assert(success.ok);assert(success.reshuffled);assert.deepEqual(plain(expected.snapshot()),fixture.steps[0].after.snapshot);
  fault=armRecoveryFault(f.w.HexMatch,position);writes=recordProfileWrites(f);
  for(const index of fixture.steps[0].pair)f.click('#board [data-index="'+index+'"]');await wait(5);
  assertReachedRecovery(fault,position);assert.deepEqual(capture(f),before,'no canonical, mirror, event, reward, operation or gameplay state escapes the failed real command');
  assert.deepEqual(profile(f),authority);assert.equal(writes.attempts,0,'recovery failure happens before any canonical write');assertClean(f);assertRendered(f,before.snapshot);assert.match(f.node('#toast').textContent,/tahta geri yüklendi/i);
  const trace=plain(fault.rows[0]);fault.restore();fault=null;
  await move(f,fixture.steps[0].pair);await wait(5);
  const committed=plain(profile(f));assert.equal(writes.attempts,1,'the explicit successful retry keeps the F-01 one-commit boundary');assert.deepEqual(committed.game.boards[STAGE],plain(expected.snapshot()));assert.deepEqual(committed.game.attempts[STAGE],authority.game.attempts[STAGE]);assert.deepEqual(committed.game.economy,authority.game.economy);assert.deepEqual(committed.energy,authority.energy);assertClean(f);assertRendered(f,plain(expected.snapshot()));
  const committedEvents=plain(f.events());writes.restore();writes=null;f.close();f=recoveryMount(committed,committedEvents);await enter(f);
  assert.deepEqual(profile(f).game,committed.game,'ordinary reload/resume preserves the committed game');assert.deepEqual(profile(f).energy,committed.energy);assert.deepEqual(f.events(),committedEvents);assert.deepEqual(plain(f.game().snapshot()),plain(expected.snapshot()));assertClean(f);assertRendered(f,plain(expected.snapshot()));
  results.push({case:'actual-app-'+position,faultInjected:true,trace,canonicalWritesOnFailure:0,canonicalWritesOnExplicitRetry:1,reload:'fresh actual app mount with the canonical profile',sameAttempt:true,resourcesPreserved:true});
 }finally{fault?.restore();writes?.restore();f.close();}
});

function commandRuntime(){const context={window:{},performance};vm.createContext(context);for(const file of ['engine.js','commands.js'])vm.runInContext(fs.readFileSync(__dirname+'/dist/'+file,'utf8'),context,{filename:file});return context.window;}
for(const position of ['before','after'])for(const mode of ['apply','preview','clone-apply'])test('pure assisted '+mode+' '+position+' recovery fault preserves source, command identity and inventory usage',()=>{
 const runtime=commandRuntime(),Game=runtime.HexAssistedGame,source=new Game(plain(fixture.level),{attemptId:'recovery-wrapper'}),before=plain(source.snapshot()),copy=mode==='clone-apply'?source.clone():null,copyBefore=copy?plain(copy.snapshot()):null;
 const command={id:'recovery-swap-1',type:'swap',a:fixture.steps[0].pair[0],b:fixture.steps[0].pair[1]},fault=armRecoveryFault(runtime.HexMatch,position);
 try{
  assert.throws(()=>mode==='preview'?source.preview(command):(copy||source).apply(command),error=>error.message===faultMessage(position));
  assertReachedRecovery(fault,position);assert.deepEqual(plain(source.snapshot()),before);assert.deepEqual(plain(source.usage),before.usage);assert.equal(source.commands.length,0);assert.equal(source.bonusMoves,0);
  if(copy)assert.deepEqual(plain(copy.snapshot()),copyBefore,'a failed apply does not replace even the independent clone');
  fault.restore();
  if(mode==='preview'){const preview=source.preview(command);assert.equal(preview.result.ok,true);assert.deepEqual(plain(source.snapshot()),before,'successful preview also remains read-only');}
  const target=copy||source,result=target.apply(command);assert.equal(result.ok,true);assert.equal(result.duplicate,false,'the failed command ID was not recorded as successful');
  assert.equal(target.movesLeft,before.movesLeft-1);assert.equal(target.turn,before.turn+1);assert.deepEqual(plain(target.usage),before.usage,'a swap never consumes booster inventory usage');assert.equal(target.commands.length,1);const once=plain(target.snapshot());assert.equal(target.apply(command).duplicate,true);assert.deepEqual(plain(target.snapshot()),once);
  if(copy)assert.deepEqual(plain(source.snapshot()),before);
 }finally{fault.restore();}
});

for(const position of ['before','after'])for(const mode of ['apply','preview','clone-apply'])test('pure color-key '+mode+' '+position+' 32-wave recovery fault cannot consume source inventory usage',()=>{
 const runtime=commandRuntime(),Game=runtime.HexAssistedGame,source=new Game(plain(colorFixture.request.level),{attemptId:colorFixture.request.attemptId}),before=plain(source.snapshot()),copy=mode==='clone-apply'?source.clone():null,copyBefore=copy?plain(copy.snapshot()):null;
 const command=plain(colorFixture.request.steps[0].command),fault=armRecoveryFault(runtime.HexMatch,position);
 try{
  assert.throws(()=>mode==='preview'?source.preview(command):(copy||source).apply(command),error=>error.message===faultMessage(position));
  assert.equal(fault.entries,1);assert.equal(fault.nativeCalls,position==='after'?1:0);const trace=fault.rows[0];
  assert.equal(trace.entry.turn,before.turn);assert.equal(trace.entry.movesLeft,before.movesLeft);assert.equal(trace.entry.score,colorFixture.expectedSnapshot.score,'the real color-key cascade reaches its frozen 32-wave recovery boundary');assert.deepEqual(trace.entry.history,before.history);
  if(position==='after')for(const field of ['values','layers','score','movesLeft','turn','rngState','history'])assert.deepEqual(trace.exit[field],colorFixture.expectedSnapshot[field],'the real color-key helper keeps frozen '+field);
  assert.deepEqual(plain(source.snapshot()),before);assert.equal(source.usage.colorKey,0);assert.equal(source.commands.length,0);if(copy)assert.deepEqual(plain(copy.snapshot()),copyBefore);
  fault.restore();
  if(mode==='preview'){const preview=source.preview(command);assert.equal(preview.result.ok,true);assert.equal(preview.snapshot.usage.colorKey,1);assert.deepEqual(plain(source.snapshot()),before,'a successful preview still cannot consume source inventory usage');}
  const target=copy||source,result=target.apply(command);assert.equal(result.ok,true);assert.equal(result.duplicate,false);assert.deepEqual(plain(target.snapshot()),colorFixture.expectedSnapshot,'the explicit retry keeps the complete frozen assisted output');assert.equal(target.usage.colorKey,1);assert.equal(target.movesLeft,before.movesLeft);assert.equal(target.turn,before.turn);
  const once=plain(target.snapshot());assert.equal(target.apply(command).duplicate,true);assert.deepEqual(plain(target.snapshot()),once,'duplicate completion cannot consume a second color key');if(copy)assert.deepEqual(plain(source.snapshot()),before);
 }finally{fault.restore();}
});

if(require.main===module)(async()=>{
 for(const {name,run}of tests){await run();console.log('PASS '+name);}
 await wait(5);assert.deepEqual(browserErrors,[],'production catches actual app swap recovery exceptions');assert.deepEqual(unhandled,[],'no unhandled app callback rejection');
 console.log(JSON.stringify({groups:tests.length,actualAppGroups:2,pureAssistedWrapperGroups:12,results,testOnlyLegacyAlias:true,physicalDeviceTested:false,nativeCSharpHostFaultInjected:false}));
 console.log('Board recovery UI: '+tests.length+' groups passed; actual real-command rollback and pure clone/preview/apply conservation. Booster UI exception handling is not changed or claimed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={tests,recoveryMount,armRecoveryFault,fixture};
