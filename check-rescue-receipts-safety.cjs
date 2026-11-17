/* Pure earned-receipt retention checks. Profile I/O belongs to host/browser tests. */
'use strict';
const assert=require('node:assert/strict'),R=require('./dist/rescue.js'),{execute}=require('./check-rescue.cjs'),vectors=require('./fixtures/rescue-vectors.json');
const plain=value=>JSON.parse(JSON.stringify(value)),DAY=86400000;
function capture(fn){try{return plain(fn());}catch(error){return {error:true,message:error.message};}}
function buildSupplementalSuite(){
 const requests=[],expected=[],groups=[],config=vectors.config,T=vectors.initialUtc,ctx=vectors.context;
 const identity={attemptId:ctx.attemptId,levelId:ctx.levelId};
 function call(method,args={},label=method){
  const request=plain({config,utc:T,verifier:'test',method,...args}),before=plain(request),result=capture(()=>execute(request));
  assert.deepEqual(request,before,label+' leaves every input unchanged');requests.push(request);expected.push({label:'receipt safety: '+label,result:plain(result)});return result;
 }
 function group(name,fn){fn();groups.push(name);}
 const neutral=(result,reason)=>{assert.equal(result.applied,false);assert.equal(result.reason,reason);assert.equal(result.grant,null);assert.equal(result.costGold,0);};
 const initial=call('createState'),pending=call('beginAd',{state:initial,context:ctx}),proof=call('completeAd',{state:pending.state,id:pending.transactionId});
 let held,delivered;
 group('retain verified completion without granting, claiming, quota or cost',()=>{
  held=call('retainAdReceipt',{state:pending.state,receipt:proof.receipt,completedProvider:proof.completedProvider});neutral(held,'receipt_retained');
  assert.equal(held.transactionId,pending.transactionId);assert.deepEqual(held.state.adUsage,pending.state.adUsage);
  for(const key of ['settledAttempts','settledArchive','processedTransactions','transactionArchive'])assert.deepEqual(held.state[key],pending.state[key]);
  assert.deepEqual(Object.keys(held.state),Object.keys(initial),'existing rescue-v1 shape');assert.equal(held.state.provider.transactions[pending.transactionId].status,'completed');
  const expectedState=plain(pending.state);expectedState.provider.transactions[pending.transactionId]=plain(proof.completedProvider.transactions[pending.transactionId]);assert.deepEqual(held.state,expectedState,'only issued target completion changes');
  neutral(call('retainAdReceipt',{state:held.state,receipt:proof.receipt}),'receipt_retained');
 });
 group('retained lookup is typed, read-only and returns independent copies',()=>{
  const before=plain(held.state),read=call('retainedReceiptFor',{state:held.state,identity});assert.deepEqual(read.receipt,proof.receipt);assert.deepEqual(read.completedProvider,held.state.provider);
  read.receipt.sequence=999;read.completedProvider.transactions[pending.transactionId].status='cancelled';assert.deepEqual(held.state,before,'lookup output cannot mutate retained entitlement');
  assert.equal(call('retainedReceiptFor',{state:held.state,identity:{...identity,attemptId:'other-attempt'}}),null);
  assert.equal(call('retainedReceiptFor',{state:held.state,identity:{...identity,levelId:9}}),null);
  for(const bad of [null,{},[],{...identity,levelId:'10'},{...identity,levelId:true},{...identity,attemptId:'__proto__'},{...identity,extra:true}])assert.deepEqual(call('retainedReceiptFor',{state:held.state,identity:bad}),{error:true,message:'invalid_rescue_receipt_identity'});
 });
 group('invalid or untrusted proof cannot retain an entitlement',()=>{
  for(const verifier of ['reject','throw'])neutral(call('retainAdReceipt',{state:pending.state,receipt:proof.receipt,completedProvider:proof.completedProvider,verifier}),'unverified_receipt');
  for(const patch of [{attemptId:'other'},{levelId:'10'},{levelId:true},{transactionId:'not-issued'},{sequence:2},{streamId:'other'},{verifiedAtUtc:T-1},{status:'cancelled'},{productId:'ad_life'},{extra:true}]){
   const result=call('retainAdReceipt',{state:pending.state,receipt:{...proof.receipt,...patch},completedProvider:proof.completedProvider});neutral(result,'unverified_receipt');assert.deepEqual(result.state,pending.state);
  }
  for(const receipt of [null,{},false,1,[],{transactionId:'__proto__'}])neutral(call('retainAdReceipt',{state:pending.state,receipt}),'unverified_receipt');
  neutral(call('retainAdReceipt',{state:initial,receipt:proof.receipt,completedProvider:proof.completedProvider}),'unverified_receipt');
  const rebound=plain(proof.completedProvider);rebound.transactions[pending.transactionId].attemptId='other';rebound.transactions[pending.transactionId].receipt.attemptId='other';
  neutral(call('retainAdReceipt',{state:pending.state,receipt:rebound.transactions[pending.transactionId].receipt,completedProvider:rebound}),'unverified_receipt');
  for(const outcome of ['cancelled','unavailable']){
   const cancelled=call('completeAd',{state:pending.state,id:pending.transactionId,options:{outcome}});neutral(call('retainAdReceipt',{state:cancelled.state,receipt:proof.receipt,completedProvider:proof.completedProvider}),'unverified_receipt');
  }
 });
 group('merge only target receipt into newer provider state',()=>{
  const second=call('beginAd',{state:pending.state,context:{...ctx,attemptId:'newer-pending'}}),disabled=call('setAdAvailable',{state:second.state,available:false}),inflated=plain(proof.completedProvider);
  const unrelated=inflated.namespace+'-999';inflated.nextSerial=1000;inflated.adAvailable=true;inflated.transactions[unrelated]={transactionId:unrelated,attemptId:'unissued-extra',levelId:9,createdAtUtc:T,status:'pending'};
  const merged=call('retainAdReceipt',{state:disabled,receipt:proof.receipt,completedProvider:inflated});neutral(merged,'receipt_retained');
  const targetOnly=plain(disabled);targetOnly.provider.transactions[pending.transactionId]=plain(proof.completedProvider.transactions[pending.transactionId]);assert.deepEqual(merged.state,targetOnly);
  assert.equal(merged.state.provider.nextSerial,3);assert.equal(merged.state.provider.adAvailable,false);assert.equal(merged.state.provider.transactions[second.transactionId].status,'pending');assert.equal(Object.hasOwn(merged.state.provider.transactions,unrelated),false);
 });
 group('held proof blocks another ad and Gold without reserving a new transaction',()=>{
  const offer=call('availability',{state:held.state,context:ctx,options:{gold:1000}});assert.equal(offer.eligible,true);assert.equal(offer.reason,null);
  for(const method of ['ad','gold']){assert.equal(offer[method].allowed,false);assert.equal(offer[method].reason,'receipt_pending_delivery');}assert.equal(offer.ad.pendingTransactionId,pending.transactionId);
  const ad=call('beginAd',{state:held.state,context:ctx});neutral(ad,'receipt_pending_delivery');assert.equal(ad.transactionId,pending.transactionId);assert.deepEqual(ad.state,held.state);
  const gold=call('applyGold',{state:held.state,context:ctx,id:'must-not-charge',options:{gold:1000}});neutral(gold,'receipt_pending_delivery');assert.deepEqual(gold.state,held.state);
  const other={...ctx,attemptId:'reserved-second'},third={...ctx,attemptId:'reserved-third'},second=call('beginAd',{state:held.state,context:other});assert.equal(second.reason,'pending');
  assert.equal(call('beginAd',{state:second.state,context:third}).reason,'daily_reserved');
  assert.equal(call('beginAd',{state:second.state,context:third,utc:T+DAY}).reason,'pending','old-day rights do not consume new-day reservation');
 });
 group('retained delivery succeeds once and duplicate callbacks stay neutral',()=>{
  delivered=call('applyAd',{state:held.state,context:ctx,receipt:proof.receipt});assert.equal(delivered.applied,true);assert.equal(delivered.grant.moves,5);assert.equal(delivered.costGold,0);assert.equal(delivered.state.adUsage.count,1);
  assert.equal(Object.keys(delivered.state.settledAttempts).length,1);assert.equal(Object.keys(delivered.state.processedTransactions).length,1);
  assert.equal(call('retainedReceiptFor',{state:delivered.state,identity}),null);
  for(let n=0;n<3;n++){const repeated=call('applyAd',{state:delivered.state,context:ctx,receipt:proof.receipt},'duplicate held callback '+n);neutral(repeated,'duplicate_transaction');assert.deepEqual(repeated.state,delivered.state);}
  const retainedAgain=call('retainAdReceipt',{state:delivered.state,receipt:proof.receipt,completedProvider:proof.completedProvider});neutral(retainedAgain,'duplicate_transaction');assert.deepEqual(retainedAgain.state,delivered.state);
  const elsewhere=call('applyAd',{state:held.state,context:{...ctx,attemptId:'different-attempt'},receipt:proof.receipt});neutral(elsewhere,'unverified_receipt');assert.deepEqual(elsewhere.state,held.state);
 });
 group('trusted completion keeps UTC floor across midnight and clock rollback',()=>{
  const beforeMidnight=T+DAY-1000,afterMidnight=T+DAY+1000,started=call('beginAd',{state:initial,context:ctx,utc:beforeMidnight}),completed=call('completeAd',{state:started.state,id:started.transactionId,utc:afterMidnight});
  const rejected=call('retainAdReceipt',{state:started.state,receipt:completed.receipt,completedProvider:completed.completedProvider,utc:beforeMidnight-1000,verifier:'reject'});neutral(rejected,'unverified_receipt');assert.equal(rejected.state.lastSeenUtc,beforeMidnight);
  const retained=call('retainAdReceipt',{state:started.state,receipt:completed.receipt,completedProvider:completed.completedProvider,utc:beforeMidnight-1000});neutral(retained,'receipt_retained');assert.equal(retained.state.lastSeenUtc,afterMidnight);assert.deepEqual(retained.state.adUsage,{day:Math.floor(afterMidnight/DAY),count:0});
  const reloaded=call('restore',{state:plain(retained.state),utc:T-DAY});assert.equal(reloaded.lastSeenUtc,afterMidnight);assert.deepEqual(reloaded,retained.state);
  const applied=call('applyAd',{state:reloaded,context:ctx,receipt:completed.receipt,utc:T-DAY});assert.equal(applied.applied,true);assert.equal(applied.state.lastSeenUtc,afterMidnight);assert.equal(applied.state.adUsage.count,1);
 });
 group('daily quota denial keeps old earned proof available for later delivery',()=>{
  let current=held.state;const tomorrow=T+DAY;
  for(let n=0;n<2;n++){
   const input={...ctx,attemptId:'tomorrow-used-'+n},begun=call('beginAd',{state:current,context:input,utc:tomorrow}),completed=call('completeAd',{state:begun.state,id:begun.transactionId,utc:tomorrow});
   const awarded=call('applyAd',{state:begun.state,context:input,receipt:completed.receipt,completedProvider:completed.completedProvider,utc:tomorrow});assert.equal(awarded.applied,true);current=awarded.state;
  }
  const denied=call('applyAd',{state:current,context:ctx,receipt:proof.receipt,utc:tomorrow});neutral(denied,'daily_limit');assert.equal(denied.state.adUsage.count,2);assert.deepEqual(call('retainedReceiptFor',{state:denied.state,identity,utc:tomorrow}).receipt,proof.receipt);
  const later=call('applyAd',{state:denied.state,context:ctx,receipt:proof.receipt,utc:T+2*DAY});assert.equal(later.applied,true);assert.equal(later.state.adUsage.count,1);
 });
 group('JSON reload and discarded proposals preserve canonical input and proof',()=>{
  const canonical=plain(pending.state),proposed=call('retainAdReceipt',{state:canonical,receipt:proof.receipt,completedProvider:proof.completedProvider});
  assert.equal(canonical.provider.transactions[pending.transactionId].status,'pending','unsaved proposal cannot mutate canonical state');assert.deepEqual(canonical,pending.state);
  const retried=call('retainAdReceipt',{state:canonical,receipt:proof.receipt,completedProvider:proof.completedProvider});assert.deepEqual(retried,proposed,'discarded write can retry the identical proof');
  const reloaded=call('restore',{state:JSON.parse(JSON.stringify(retried.state))});assert.deepEqual(reloaded,held.state);assert.deepEqual(call('retainedReceiptFor',{state:reloaded,identity}).receipt,proof.receipt);
  const grant=call('applyAd',{state:reloaded,context:ctx,receipt:proof.receipt});assert.deepEqual(reloaded,held.state,'discarded grant proposal cannot claim canonical proof');assert.deepEqual(grant,delivered);
 });
 group('129 unclaimed completions survive closed-record compaction and stay deliverable',()=>{
  let now=T,current;const manager=R.createManager(config,{clock:()=>now,verifyReceipt:(receipt,provider)=>R.TestProvider.verify(provider,receipt)}),issued={};current=manager.createState();
  const heldContexts=[];
  for(let n=0;n<129;n++){
   now=T+n*DAY;const input={...ctx,attemptId:'held-stress-'+n};heldContexts.push(input);const begun=manager.beginAd(current,input),completed=manager.completeAd(begun.state,begun.transactionId),retained=manager.retainAdReceipt(begun.state,completed.receipt,completed.completedProvider);
   assert.equal(retained.reason,'receipt_retained');issued[begun.transactionId]=plain(completed.completedProvider.transactions[begun.transactionId]);current=retained.state;
  }
  for(let n=0;n<140;n++){
   now=T+(129+n)*DAY;const input={...ctx,attemptId:'processed-stress-'+n},begun=manager.beginAd(current,input),completed=manager.completeAd(begun.state,begun.transactionId),awarded=manager.applyAd(begun.state,input,completed.receipt,completed.completedProvider);
   assert.equal(awarded.applied,true);issued[begun.transactionId]=plain(completed.completedProvider.transactions[begun.transactionId]);current=awarded.state;
  }
  const raw=plain(current);raw.provider.transactions=issued;raw.provider.finalizedRanges=[];
  assert.equal(call('validate',{state:raw,utc:now}),true,'all rows came from valid issued operations');
  const compacted=call('reconcile',{state:raw,utc:now},'129 held plus 140 processed compaction');assert.deepEqual(compacted,current);assert.deepEqual(compacted.provider.finalizedRanges,[[130,141]]);assert.equal(Object.keys(compacted.provider.transactions).length,257);
  for(let n=0;n<129;n++){const id=compacted.provider.namespace+'-'+(n+1);assert.equal(compacted.provider.transactions[id].status,'completed');assert.equal(manager.transactionFor(compacted,id),null);}
  const oldestIdentity={attemptId:heldContexts[0].attemptId,levelId:ctx.levelId},latestIdentity={attemptId:heldContexts[128].attemptId,levelId:ctx.levelId};
  const oldest=call('retainedReceiptFor',{state:compacted,identity:oldestIdentity,utc:now}),latest=call('retainedReceiptFor',{state:compacted,identity:latestIdentity,utc:now});assert.equal(oldest.receipt.sequence,1);assert.equal(latest.receipt.sequence,129);
  const restored=call('restore',{state:plain(compacted),utc:now});assert.deepEqual(restored,compacted);
  const awarded=call('applyAd',{state:restored,context:heldContexts[0],receipt:oldest.receipt,utc:now});assert.equal(awarded.applied,true);assert.equal(awarded.state.adUsage.count,2);assert.equal(call('retainedReceiptFor',{state:awarded.state,identity:oldestIdentity,utc:now}),null);
  neutral(call('applyAd',{state:awarded.state,context:heldContexts[0],receipt:oldest.receipt,utc:now}),'duplicate_transaction');
 });
 return {requests,expected,groups,comparisons:expected.length};
}
if(require.main===module){const suite=buildSupplementalSuite();console.log('Rescue retained-receipt safety passed: '+JSON.stringify({groups:suite.groups.length,comparisons:suite.comparisons,unclaimedCompletions:129,processedCompactionRecords:140,profileIO:'not mocked; tested by host/browser suites'}));}
module.exports={buildSupplementalSuite};
