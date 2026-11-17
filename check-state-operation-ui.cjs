/* Real application command → canonical commit → transient operation boundary.
 * The only injection point is the test mount's beforeApp hook. The public state
 * factory is wrapped, never the engine, wallet, receipts or storage authority.
 */
'use strict';
const assert=require('node:assert/strict');
const {mount,existing,plain,enter,move,until,wait}=require('./check-lives-ui.cjs');
const {beforeWin}=require('./check-progression-ui.cjs');
const PROFILE='hexrota-profile-v2',tests=[],unhandled=[],browserErrors=[];
const test=(name,run)=>tests.push({name,run});
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const profile=f=>JSON.parse(f.w.localStorage.getItem(PROFILE));
function fixture({saved=existing(2,{turns:1}).saved,allocationFault=null}={}){
 const observed={store:null,native:null,events:[],hookCalls:0,createCalls:0,allocationCalls:0,unsub:null,errors:[]};
 const f=mount({saved,beforeApp(w,d){
  observed.hookCalls++;assert.equal(d.getElementById('board').id,'board');
  const Core=w.HexAppState;assert.equal(typeof Core.create,'function','the hook runs after production state dependencies');
  w.HexAppState=Object.freeze({...Core,create(options){
   observed.createCalls++;const native=Core.create(options);observed.native=native;
   observed.unsub=native.subscribe((result,previous,event)=>{
    if(!event.type.startsWith('OPERATION_'))return;
    try{observed.events.push({event:plain(event),state:plain(result.state),previous:plain(previous),canonical:JSON.parse(w.localStorage.getItem(PROFILE))});}
    catch(error){observed.errors.push(error?.message||String(error));}
   });
   const store=allocationFault?Object.freeze({...native,beginOperation(kind,attemptId){
    if(kind==='presentation'){observed.allocationCalls++;if(allocationFault==='throw')throw new Error('injected visual token allocation failure');return null;}
    return native.beginOperation(kind,attemptId);
   }}):native;
   observed.store=store;return store;
  }});
 }});
 f.w.addEventListener('error',event=>browserErrors.push(event.error?.message||event.message));
 const close=f.close;f.close=()=>{observed.unsub?.();close();};
 assert.equal(observed.hookCalls,1,'the optional test hook runs once immediately before app.js');
 assert.equal(observed.createCalls,1,'there is one actual application state store');
 f.operations=observed;return f;
}
const presentationEvents=(f,type)=>f.operations.events.filter(row=>row.event.type===type&&row.event.token.kind==='presentation');
function nonterminalMove(f){
 const game=f.game(),pair=game.legalMoves().find(candidate=>{const next=game.clone();return next.swap(...candidate).ok&&next.status==='playing';});
 assert(pair,'a real legal move leaves this fixture playing');return plain(pair);
}
function expectedAfter(f,pair){const expected=f.game().clone();assert(expected.swap(...pair).ok);return plain(expected.snapshot());}
function canonicalPhase(f,row){
 const game=row.canonical.game,stage=game.current,metadata=game.attempts[stage];
 assert(metadata,'the captured canonical view owns a real attempt');
 const catalog=f.w.HexAttempts.createCatalog(f.w.HEX_LEVELS,f.w.HEX_VARIANTS,f.w.HexMatch);
 const level=catalog.resolveLevel(metadata.levelId,metadata.variantId,metadata.levelDataVersion);
 const verified=new f.w.HexMatch(level,game.boards[stage]);
 return f.w.HexStateSelectors.gameplayPhase(row.state,{attemptReady:true,engineStatus:verified.status});
}
function assertPendingAfterCommit(f,row,expected,stage){
 assert.equal(row.event.type,'OPERATION_PENDING');assert.equal(row.state.operations.presentation.status,'pending');
 assert.deepEqual(row.canonical.game.boards[stage],expected,'a pending visual operation sees the already committed real checkpoint');
 assert.equal(row.event.token.attemptId,row.canonical.game.attempts[stage].attemptId,'the operation identity belongs to the committed attempt');
 assert.deepEqual(f.operations.errors,[],'subscription observation never failed silently');
}

test('a real swap becomes OPERATION_PENDING only after its checkpoint is canonically committed',async()=>{
 const f=fixture();try{
  await enter(f);const stage=f.save().current,pair=nonterminalMove(f),expected=expectedAfter(f,pair),lives=f.life().life.lives;
  await move(f,pair);
  const requested=presentationEvents(f,'OPERATION_REQUESTED'),pending=presentationEvents(f,'OPERATION_PENDING'),settled=presentationEvents(f,'OPERATION_SETTLED');
  assert.equal(requested.length,1);
  assert.equal(canonicalPhase(f,requested[0]),'PLAYING','requesting visual lifetime does not publish RESOLVING before canonical presentation activation');
  assert.equal(pending.length,1);assertPendingAfterCommit(f,pending[0],expected,stage);
  assert.equal(canonicalPhase(f,pending[0]),'RESOLVING');
  assert.deepEqual(requested[0].event.token,pending[0].event.token);
  assert.equal(settled.length,1);assert.equal(settled[0].event.status,'succeeded');assert.deepEqual(settled[0].event.token,pending[0].event.token);
  assert.deepEqual(plain(f.game().snapshot()),expected);assert.equal(f.life().life.lives,lives);assert.equal(f.save().economy.gold,0);assert.equal(f.save().economy.stars,0);
  assert.equal(f.node('#board').getAttribute('aria-busy'),'false');
 }finally{f.close();}
});

test('late settlements from a previous real move cannot settle a newer operation or repeat gameplay/rewards',async()=>{
 const f=fixture();try{
  await enter(f);await move(f,nonterminalMove(f));
  const oldToken=presentationEvents(f,'OPERATION_PENDING')[0].event.token,pair=nonterminalMove(f),expected=expectedAfter(f,pair);
  for(const index of pair)f.click('#board [data-index="'+index+'"]');
  const operation=f.operations.store.snapshot().operations.presentation;assert.equal(operation.status,'pending');assert.notEqual(operation.token.id,oldToken.id);
  const committed=f.w.localStorage.getItem(PROFILE),secondToken=plain(operation.token);
  for(const status of ['succeeded','cancelled','failed','succeeded']){
   const stale=f.operations.store.settleOperation(oldToken,status);assert.equal(stale.accepted,false);assert.equal(stale.changed,false);
   assert.equal(f.w.localStorage.getItem(PROFILE),committed,'a stale UI settlement cannot make another domain write');
   assert.deepEqual(plain(f.operations.store.snapshot().operations.presentation.token),secondToken);assert.equal(f.operations.store.snapshot().operations.presentation.status,'pending');
  }
  await until(()=>f.node('#board').getAttribute('aria-busy')==='false','the newer real move finishes normally');
  assert.deepEqual(plain(f.game().snapshot()),expected);assert.equal(presentationEvents(f,'OPERATION_PENDING').length,2);
  assert.equal(presentationEvents(f,'OPERATION_SETTLED').length,2,'only the two genuine visual lifetimes settle');assert.equal(f.save().economy.gold,0);assert.equal(f.save().economy.stars,0);
  assert.deepEqual(f.operations.errors,[]);
 }finally{f.close();}
});

test('null or throwing visual-token allocation fast-reveals actual playing and winning commands without blocking their commit',async()=>{
 for(const allocationFault of ['null','throw'])for(const terminal of [false,true]){
  const f=fixture({saved:terminal?beforeWin(1):existing(2,{turns:1}).saved,allocationFault});try{
   await enter(f);const stage=f.save().current,pair=terminal?plain(f.game().level.solution.at(-1)):nonterminalMove(f),expected=expectedAfter(f,pair),metadata=plain(f.save().attempts[stage]),lives=f.life().life.lives;
   await move(f,pair);assert.equal(f.operations.allocationCalls,1);assert.equal(f.operations.events.filter(row=>row.event.token.kind==='presentation').length,0,'allocation failure has no invented operation token');
   assert.deepEqual(plain(f.game().snapshot()),expected);assert.deepEqual(f.save().attempts[stage],metadata);assert.equal(f.life().life.lives,lives);
   assert.equal(f.node('#board').getAttribute('aria-busy'),'false');assert.equal(f.operations.store.snapshot().operations.presentation,null);
   assert.equal(f.save().economy.gold,terminal?20:0);assert.equal(f.save().economy.stars,terminal?1:0);
   if(terminal){
    await until(()=>f.node('#win-dialog').open,'a verified terminal result is revealed despite presentation allocation failure');
    assert.equal(f.game().status,'won');assert.equal(Object.values(f.save().economy.transactions).filter(row=>row.kind==='clear'&&row.levelId===1).length,1);
    for(let n=0;n<5;n++)f.click('#continue');assert.equal(f.save().economy.gold,20);assert.equal(f.save().economy.stars,1);
   }else{assert.equal(f.game().status,'playing');assert.equal(f.d.querySelector('#hint'),null,'normal campaign has no manual hint');assert.equal(f.node('#board').getAttribute('aria-busy'),'false');}
   assert.deepEqual(f.operations.errors,[]);
  }finally{f.close();}
 }
});

test('a failed canonical winning write emits no pending presentation and a real retry banks its reward before pending',async()=>{
 const f=fixture({saved:beforeWin(1)});let restore;try{
  await enter(f);const stage=f.save().current,pair=plain(f.game().level.solution.at(-1)),expected=expectedAfter(f,pair),before=plain(profile(f)),events=plain(f.events()),native=f.w.Storage.prototype.setItem;
  f.w.Storage.prototype.setItem=function(key,value){if(key===PROFILE)throw new f.w.DOMException('injected operation-order quota','QuotaExceededError');return native.call(this,key,value);};restore=()=>{f.w.Storage.prototype.setItem=native;};
  await move(f,pair);assert.deepEqual(profile(f),before);assert.deepEqual(f.events(),events);assert.equal(f.node('#win-dialog').open,false);
  assert.equal(presentationEvents(f,'OPERATION_REQUESTED').length,1);assert.equal(presentationEvents(f,'OPERATION_PENDING').length,0,'no uncommitted command can become an active visual success');
  assert.equal(f.node('#board').getAttribute('aria-busy'),'false');assert.equal(f.game().status,'playing');assert.equal(f.save().economy.gold,0);assert.equal(f.save().economy.stars,0);
  const oldToken=presentationEvents(f,'OPERATION_REQUESTED')[0].event.token;assert.equal(f.operations.store.isCurrentOperation(oldToken),false);
  restore();restore=null;f.return();await move(f,pair);await until(()=>f.node('#win-dialog').open,'the exact winning swap succeeds after authoritative storage recovers');
  const pending=presentationEvents(f,'OPERATION_PENDING');assert.equal(pending.length,1);assertPendingAfterCommit(f,pending[0],expected,stage);
  assert.equal(pending[0].canonical.game.economy.gold,20);assert.equal(pending[0].canonical.game.economy.stars,1,'the permanent one-clear reward is already in the same commit');
  assert.notEqual(pending[0].event.token.id,oldToken.id);const committed=plain(profile(f));assert.equal(f.operations.store.settleOperation(oldToken,'succeeded').accepted,false);assert.deepEqual(profile(f),committed);
 }finally{restore?.();f.close();}
});

(async()=>{
 for(const {name,run}of tests){await run();console.log('PASS '+name);}
 await wait(5);assert.deepEqual(unhandled,[]);assert.deepEqual(browserErrors,[]);
 console.log('State operation UI passed: '+tests.length+' actual-app groups; real engine commands, canonical commit observation, late tokens and four allocation-fault scenarios. No fake engine or financial success.');
})().catch(error=>{console.error(error);process.exitCode=1;});
