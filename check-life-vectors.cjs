/* Replay language-independent goldens against the current JS life implementation. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/dist/lives.js','utf8'),context);
const plain=value=>JSON.parse(JSON.stringify(value));
const vectors=JSON.parse(fs.readFileSync(__dirname+'/fixtures/lives-vectors.json','utf8'));
assert.equal(vectors.schemaVersion,2);assert.equal(vectors.rulesVersion,'lives-v2');assert(vectors.cases.length>=19);
let transitions=0;
for(const scenario of vectors.cases){
 let utc=scenario.initialUtc;const verified=new Set();
 const manager=context.window.HexLives.createManager(scenario.config,{clock:()=>utc,verifyReceipt:receipt=>verified.has(JSON.stringify(receipt))});
 let state=manager.createState();assert.deepEqual(plain(state),scenario.initialState,scenario.id+' initial state');
 for(const [index,step]of scenario.steps.entries()){
  const op=step.operation;if(op.atUtc!==undefined)utc=op.atUtc;
  const previous=plain(state);let result=null,outcome=null;
  switch(op.kind){
   case 'settle':result=manager.settleAttempt(state,op.context);break;
   case 'register':result=manager.registerAttempt(state,op.context);break;
   case 'historical':result=manager.acknowledgeHistoricalAttempt(state,op.context);break;
   case 'transaction':if(op.verified)verified.add(JSON.stringify(op.receipt));result=manager.applyTransaction(state,op.receipt);break;
   case 'bypass':result=manager.setDeveloperBypass(state,op.enabled);break;
   case 'reconcile':result={state:manager.reconcile(state)};break;
   case 'reload':result={state:manager.restore(JSON.parse(JSON.stringify(state)))};break;
   case 'canStart':outcome={allowed:manager.canStart(state,op.context)};break;
   case 'canResume':outcome={allowed:manager.canResume(state,op.attemptId)};break;
   default:throw Error('Unknown shared operation');
  }
  assert.deepEqual(plain(state),previous,scenario.id+' reducer leaves old DTO unchanged');
  if(result){const {state:next,...response}=result;state=next;outcome=Object.keys(response).length?plain(response):null;}
  const label=scenario.id+' step '+(index+1);assert.deepEqual(plain(state),step.expectedState,label+' state');assert.deepEqual(plain(manager.view(state)),step.expectedView,label+' view');assert.deepEqual(outcome,step.expectedOutcome,label+' outcome');
  assert(state.lives>=0&&state.lives<=5);transitions++;
 }
}
console.log('Shared life vectors passed: '+vectors.cases.length+' cases, '+transitions+' transitions/probes; C# life port remains future work.');

// Frozen v1 results remain loadable: every old field survives migration unchanged.
const legacyBytes=fs.readFileSync(__dirname+'/fixtures/lives-vectors-v1.json');
assert.equal(require('node:crypto').createHash('sha256').update(legacyBytes).digest('hex'),'b6e7ab6e2e801f710baef9f5ae5786fb7cda15d42cfdb8bbfe636eadda745c92','the archived v1 goldens are immutable');
const legacy=JSON.parse(legacyBytes);
assert.equal(legacy.schemaVersion,1);assert.equal(legacy.rulesVersion,'lives-v1');
let migrated=0;
for(const scenario of legacy.cases){
 for(const raw of [scenario.initialState,...scenario.steps.map(step=>step.expectedState)]){
  const manager=context.window.HexLives.createManager(scenario.config,{clock:()=>raw.lastSeenUtc});
  const state=plain(manager.restore(raw));assert.equal(state.schemaVersion,2);assert.equal(state.rulesVersion,'lives-v2');
  for(const key of Object.keys(raw))if(!['schemaVersion','rulesVersion'].includes(key))assert.deepEqual(state[key],raw[key],scenario.id+' preserved v1 '+key);
  assert.equal(state.pendingAdLives,0);assert.deepEqual(state.registeredAttempts,{});migrated++;
 }
}
console.log('Legacy life migration passed: '+migrated+' frozen v1 states preserved.');
