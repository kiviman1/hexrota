/* Pure second-chance rules. These proposals have no storage, engine or wallet side effects. */
'use strict';
const assert=require('node:assert/strict'),R=require('./dist/rescue.js'),vectors=require('./fixtures/rescue-vectors.json');
const plain=value=>JSON.parse(JSON.stringify(value)),DAY=86400000;
function execute(request){
 const {config,utc,method,state,context,options,id,receipt,completedProvider,available,verifier}=request;
 if(method==='validateConfig')return R.validateConfig(config);
 const manager=R.createManager(config,{clock:()=>utc,verifyReceipt:verifier==='test'?(receipt,provider)=>R.TestProvider.verify(provider,receipt):verifier==='throw'?()=>{throw Error('test_verifier_unavailable');}:undefined});
 switch(method){
  case'createState':return manager.createState(options);
  case'validate':return manager.validate(state);
  case'restore':case'reconcile':return manager[method](state);
  case'availability':return manager.availability(state,context,options);
  case'beginAd':return manager.beginAd(state,context);
  case'completeAd':return manager.completeAd(state,id,options);
  case'applyAd':return manager.applyAd(state,context,receipt,completedProvider);
  case'applyGold':return manager.applyGold(state,context,id,options);
  case'setAdAvailable':return manager.setAdAvailable(state,available);
  case'settlementFor':case'transactionFor':return manager[method](state,id);
  case'providerCreate':return R.TestProvider.createState(options);
  case'providerValidate':return R.TestProvider.validate(state);
  case'providerBegin':return R.TestProvider.begin(state,options);
  case'providerComplete':return R.TestProvider.complete(state,id,options);
  case'providerVerify':return R.TestProvider.verify(state,receipt);
  case'providerFinalize':return R.TestProvider.finalize(state,id);
  case'providerSetAvailable':return R.TestProvider.setAdAvailable(state,available);
  case'stress':{
   let now=utc;const m=R.createManager(config,{clock:()=>now,verifyReceipt:(r,p)=>R.TestProvider.verify(p,r)});let current=m.createState();
   const ctx=i=>({attemptId:'stress-'+i,levelId:10,tutorial:false,cleared:false,status:'lost',movesLeft:0,turn:7,lastCommand:'swap',rescuesUsed:0});
   for(let i=0;i<request.count;i++){let result;if(request.ads){now=utc+Math.floor(i/2)*DAY;const b=m.beginAd(current,ctx(i)),p=m.completeAd(b.state,b.transactionId);result=m.applyAd(b.state,ctx(i),p.receipt,p.completedProvider);}else result=m.applyGold(current,ctx(i),'stress-gold-'+i,{gold:140});assert.equal(result.applied,true);current=result.state;}
   m.validate(current);const oldId=request.ads?'hexrota-rescue-test-1':'stress-gold-0';return {state:current,oldClaim:m.settlementFor(current,'stress-0'),oldTransaction:m.transactionFor(current,oldId),duplicate:m.applyGold(current,ctx(0),oldId,{gold:140})};
  }
  default:throw Error('unknown_rescue_test_method');
 }
}
function capture(fn){try{return plain(fn());}catch(error){return{error:true,message:error.message};}}
function buildSuite(){
 const requests=[],expected=[],config=vectors.config,T=vectors.initialUtc,ctx=vectors.context;
 let checks=0;
 const call=(method,more={},label=method)=>{const request=plain({config,utc:T,verifier:'test',method,...more}),before=plain(request),result=capture(()=>execute(request));assert.deepEqual(request,before,'JS input immutable: '+label);requests.push(request);expected.push({result,label});checks++;return result;};
 const initial=call('createState');assert.deepEqual(initial,vectors.golden.initial,'frozen initial wire');assert.deepEqual(Object.keys(initial),['schemaVersion','rulesVersion','lastSeenUtc','adUsage','settledAttempts','settledArchive','processedTransactions','transactionArchive','provider']);assert.equal(initial.adUsage.count,0);assert.equal(initial.lastSeenUtc,T);
 for(const item of vectors.availabilityCases){const result=call('availability',{state:initial,context:{...ctx,...item.context},options:{gold:item.gold}},item.id);assert.equal(result.reason,item.reason);assert.equal(result.ad.reason,item.adReason);assert.equal(result.gold.reason,item.goldReason);}
 const gold=call('applyGold',{state:initial,context:ctx,id:'gold-rescue-1',options:{gold:140}});assert.deepEqual(gold,vectors.golden.gold,'frozen gold result and ledger');assert.equal(gold.applied,true);assert.equal(gold.costGold,140);assert.deepEqual(gold.grant,{commandId:'gold-rescue-1',attemptId:ctx.attemptId,source:'gold',moves:5});assert.equal(gold.state.adUsage.count,0);assert.equal(call('validate',{state:gold.state}),true);
 assert.equal(call('applyGold',{state:initial,context:ctx,id:'no-funds',options:{gold:139}}).reason,'insufficient_gold');
 assert.equal(call('applyGold',{state:gold.state,context:{...ctx,status:'playing',movesLeft:5,rescuesUsed:1,lastCommand:'grant_moves'},id:'gold-rescue-1',options:{gold:0}}).reason,'duplicate_transaction');
 assert.equal(call('applyGold',{state:gold.state,context:{...ctx,attemptId:'wrong-attempt'},id:'gold-rescue-1',options:{gold:140}}).reason,'transaction_conflict');
 assert.equal(call('applyGold',{state:gold.state,context:ctx,id:'gold-rescue-2',options:{gold:140}}).reason,'already_rescued');
 assert.equal(call('applyAd',{state:gold.state,context:ctx,receipt:{transactionId:'gold-rescue-1'}}).reason,'transaction_conflict');
 const begun=call('beginAd',{state:initial,context:ctx});assert.deepEqual(begun,vectors.golden.begun,'frozen pending provider');assert.equal(begun.reason,'pending');assert.equal(begun.applied,false);assert.equal(begun.state.adUsage.count,0);assert.equal(call('beginAd',{state:begun.state,context:ctx}).reason,'ad_pending');
 const completed=call('completeAd',{state:begun.state,id:begun.transactionId});assert.deepEqual(completed,vectors.golden.completed,'frozen completed TEST proof');assert.equal(completed.reason,'completed');assert.equal(completed.applied,false);assert.equal(completed.receipt.provider,'development_rescue');assert.equal(completed.receipt.productId,'rescue_moves_5');
 assert.equal(call('applyAd',{state:initial,context:ctx,receipt:completed.receipt,completedProvider:completed.completedProvider}).reason,'unverified_receipt','valid-looking completed provider JSON cannot invent an unissued current transaction');
 const alteredIssuedProof=plain(completed.completedProvider);alteredIssuedProof.transactions[begun.transactionId].createdAtUtc--;
 assert.equal(call('applyAd',{state:begun.state,context:ctx,receipt:completed.receipt,completedProvider:alteredIssuedProof}).reason,'unverified_receipt','issued creation binding is strict');
 const inflatedProof=plain(completed.completedProvider),extraProofId=inflatedProof.namespace+'-2';inflatedProof.nextSerial=3;inflatedProof.transactions[extraProofId]={transactionId:extraProofId,attemptId:'injected-extra',levelId:10,createdAtUtc:T,status:'pending'};
 const targetOnly=call('applyAd',{state:begun.state,context:ctx,receipt:completed.receipt,completedProvider:inflatedProof});assert.equal(targetOnly.applied,true);assert.equal(targetOnly.state.provider.nextSerial,begun.state.provider.nextSerial);assert.equal(Object.hasOwn(targetOnly.state.provider.transactions,extraProofId),false,'even verified target proof cannot import unrelated provider JSON');
 const redeemed=call('applyAd',{state:begun.state,context:ctx,receipt:completed.receipt,completedProvider:completed.completedProvider});assert.deepEqual(redeemed,vectors.golden.awarded,'frozen awarded state');assert.equal(redeemed.applied,true);assert.equal(redeemed.costGold,0);assert.equal(redeemed.state.adUsage.count,1);
 assert.deepEqual(call('applyAd',{state:begun.state,context:ctx,receipt:completed.receipt,completedProvider:completed.completedProvider}),redeemed,'verified result can redeliver after host save failure');
 for(let i=0;i<100;i++)assert.equal(call('applyAd',{state:redeemed.state,context:{...ctx,status:'playing',movesLeft:5,rescuesUsed:1},receipt:completed.receipt,completedProvider:completed.completedProvider},'duplicate callback '+i).reason,'duplicate_transaction');
 assert.equal(call('applyAd',{state:begun.state,context:ctx,receipt:completed.receipt,completedProvider:completed.completedProvider,verifier:'reject'}).reason,'unverified_receipt');assert.equal(call('applyAd',{state:begun.state,context:ctx,receipt:completed.receipt,completedProvider:completed.completedProvider,verifier:'throw'}).reason,'unverified_receipt');
 for(const patch of [{provider:'development'},{productId:'ad_life'},{status:'cancelled'},{attemptId:'other'},{levelId:'10'},{transactionId:'not-issued'},{streamId:'other'},{sequence:2},{verifiedAtUtc:T-1},{extra:true}])assert.equal(call('applyAd',{state:begun.state,context:ctx,receipt:{...completed.receipt,...patch},completedProvider:completed.completedProvider}).reason,'unverified_receipt');
 for(const receipt of [null,{},false,1,[],{transactionId:'__proto__'}])assert.equal(call('applyAd',{state:begun.state,context:ctx,receipt}).reason,'unverified_receipt');
 for(const outcome of ['cancelled','unavailable']){const terminal=call('completeAd',{state:begun.state,id:begun.transactionId,options:{outcome}});assert.equal(terminal.receipt,null);assert.equal(terminal.state.adUsage.count,0);assert.equal(call('applyAd',{state:terminal.state,context:ctx,receipt:completed.receipt,completedProvider:completed.completedProvider}).reason,'unverified_receipt');assert.equal(call('beginAd',{state:terminal.state,context:ctx}).reason,'pending');}
 // One completed target can be redelivered against a newer provider without
 // overwriting the allocator, current availability or another pending request.
 const otherCtx={...ctx,attemptId:'attempt-10-2'},thirdCtx={...ctx,attemptId:'attempt-10-3'};
 const secondPending=call('beginAd',{state:begun.state,context:otherCtx});assert.equal(secondPending.reason,'pending');assert.equal(call('beginAd',{state:secondPending.state,context:thirdCtx}).reason,'daily_reserved');
 const unavailable=call('setAdAvailable',{state:secondPending.state,available:false});assert.equal(call('availability',{state:unavailable,context:thirdCtx,options:{gold:140}}).gold.allowed,true);
 const staleMerge=call('applyAd',{state:unavailable,context:ctx,receipt:completed.receipt,completedProvider:completed.completedProvider});assert.equal(staleMerge.applied,true);assert.equal(staleMerge.state.provider.adAvailable,false);assert.equal(staleMerge.state.provider.nextSerial,3);assert.equal(staleMerge.state.provider.transactions[secondPending.transactionId].status,'pending');
 const secondProof=call('completeAd',{state:staleMerge.state,id:secondPending.transactionId}),second=call('applyAd',{state:staleMerge.state,context:otherCtx,receipt:secondProof.receipt,completedProvider:secondProof.completedProvider});assert.equal(second.applied,true);assert.equal(second.state.adUsage.count,2);
 const enabled=call('setAdAvailable',{state:second.state,available:true});assert.equal(call('beginAd',{state:enabled,context:thirdCtx}).reason,'daily_limit');assert.equal(call('availability',{state:enabled,context:thirdCtx,options:{gold:140}}).gold.allowed,true);
 const tomorrow=call('reconcile',{state:enabled,utc:T+DAY});assert.equal(tomorrow.adUsage.count,0);const rollback=call('reconcile',{state:tomorrow,utc:T-2*DAY});assert.equal(rollback.lastSeenUtc,T+DAY);assert.equal(rollback.adUsage.day,tomorrow.adUsage.day);assert.equal(call('beginAd',{state:rollback,context:thirdCtx,utc:T-2*DAY}).reason,'pending');
 // Regression: proof completed after midnight, canonical write failed, then
 // device clock rolled back. Trusted proof time must survive redelivery/reload;
 // unverified JSON must never advance the quota clock.
 const beforeMidnight=T+DAY-1000,afterMidnight=T+DAY+1000;
 const midnightPending=call('beginAd',{state:initial,context:ctx,utc:beforeMidnight});
 const midnightProof=call('completeAd',{state:midnightPending.state,id:midnightPending.transactionId,utc:afterMidnight});
 const untrustedMidnight=call('applyAd',{state:midnightPending.state,context:ctx,receipt:midnightProof.receipt,completedProvider:midnightProof.completedProvider,utc:beforeMidnight-1000,verifier:'reject'});assert.equal(untrustedMidnight.reason,'unverified_receipt');assert.equal(untrustedMidnight.state.lastSeenUtc,beforeMidnight);assert.equal(untrustedMidnight.state.adUsage.count,0);
 const changedAttempt=call('applyAd',{state:midnightPending.state,context:otherCtx,receipt:midnightProof.receipt,completedProvider:midnightProof.completedProvider,utc:beforeMidnight-1000});assert.equal(changedAttempt.reason,'unverified_receipt');assert.equal(changedAttempt.state.lastSeenUtc,beforeMidnight);assert.equal(changedAttempt.state.adUsage.count,0);
 const midnightAward=call('applyAd',{state:midnightPending.state,context:ctx,receipt:midnightProof.receipt,completedProvider:midnightProof.completedProvider,utc:beforeMidnight-1000});assert.equal(midnightAward.applied,true);assert.equal(midnightAward.state.lastSeenUtc,afterMidnight);assert.equal(midnightAward.state.adUsage.day,Math.floor(afterMidnight/DAY));assert.equal(midnightAward.state.adUsage.count,1);
 const midnightReload=call('restore',{state:midnightAward.state,utc:afterMidnight});assert.equal(midnightReload.adUsage.count,1);
 const midnightSecondPending=call('beginAd',{state:midnightReload,context:otherCtx,utc:afterMidnight});const midnightSecondProof=call('completeAd',{state:midnightSecondPending.state,id:midnightSecondPending.transactionId,utc:afterMidnight});const midnightSecondAward=call('applyAd',{state:midnightSecondPending.state,context:otherCtx,receipt:midnightSecondProof.receipt,completedProvider:midnightSecondProof.completedProvider,utc:beforeMidnight-1000});assert.equal(midnightSecondAward.applied,true);assert.equal(midnightSecondAward.state.adUsage.count,2);
 assert.equal(call('beginAd',{state:midnightSecondAward.state,context:thirdCtx,utc:afterMidnight}).reason,'daily_limit');assert.equal(call('applyGold',{state:redeemed.state,context:ctx,id:begun.transactionId,options:{gold:140}}).reason,'transaction_conflict');
 const crossed=call('applyGold',{state:begun.state,context:ctx,id:'gold-after-ad-pending',options:{gold:140}});assert.equal(crossed.state.provider.transactions[begun.transactionId].status,'cancelled');assert.equal(call('applyAd',{state:crossed.state,context:ctx,receipt:completed.receipt,completedProvider:completed.completedProvider}).reason,'already_rescued');
 const missing=call('setAdAvailable',{state:initial,available:false});assert.equal(call('beginAd',{state:missing,context:ctx}).reason,'ad_unavailable');assert.equal(call('applyGold',{state:missing,context:ctx,id:'gold-without-ad',options:{gold:140}}).applied,true);
 assert.deepEqual(call('restore',{state:begun.state}),begun.state,'reopen keeps pending explicit-user-choice request');assert.equal(call('settlementFor',{state:redeemed.state,id:ctx.attemptId}).source,'ad');assert.equal(call('transactionFor',{state:redeemed.state,id:begun.transactionId}).costGold,0);assert.equal(call('settlementFor',{state:initial,id:'absent'}),null);
 // Rich journal retention is technical, never a gameplay quota. Old exact IDs
 // remain tombstones and cannot become new rewards after hundreds of attempts.
 const goldStress=call('stress',{count:300,ads:false},'300 gold settlement compaction');assert.equal(Object.keys(goldStress.state.settledAttempts).length,128);assert.equal(Object.keys(goldStress.state.settledArchive).length,172);assert.equal(goldStress.duplicate.reason,'duplicate_transaction');
 const adStress=call('stress',{count:300,ads:true},'300 ad settlement and provider compaction');assert.equal(Object.keys(adStress.state.provider.transactions).length,128);assert.deepEqual(adStress.state.provider.finalizedRanges,[[1,172]]);assert.equal(adStress.duplicate.reason,'transaction_conflict');assert.equal(call('providerComplete',{state:adStress.state.provider,id:'hexrota-rescue-test-1',options:{nowUtc:T+150*DAY}}).reason,'finalized');
 const expectError=(result,message)=>assert.deepEqual(result,{error:true,message});
 for(const invalid of [null,{}, {...config,moves:3},{...config,maxPerAttempt:2},{...config,goldCost:-1},{...config,dailyAdLimit:0},{...config,dailyAdLimit:'2'},{...config,extra:1}])expectError(call('validateConfig',{config:invalid}),'invalid_rescue_configuration');
 for(const badUtc of [-1,.5,Number.MAX_SAFE_INTEGER+1,'100'])expectError(call('createState',{utc:badUtc}),'invalid_rescue_clock');
 for(const id of ['__proto__','constructor','a\n','a\r','a\u2028',1,null]){expectError(call('applyGold',{state:initial,context:ctx,id,options:{gold:140}}),'invalid_rescue_transaction_identity');expectError(call('settlementFor',{state:initial,id}),'invalid_rescue_attempt_identity');}
 for(const patch of [{levelId:'10'},{levelId:true},{tutorial:'false'},{attemptId:'__proto__'},{cleared:0},{movesLeft:-1},{turn:1.5},{lastCommand:''},{rescuesUsed:'1'},{status:'failed'},{extra:true}])expectError(call('availability',{state:initial,context:{...ctx,...patch},options:{gold:140}}),'invalid_rescue_context');
 for(const gold of [-1,.5,'140',true,2147483648])expectError(call('availability',{state:initial,context:ctx,options:{gold}}),'invalid_rescue_gold');
 for(const key of Object.keys(initial)){const broken=plain(initial);delete broken[key];expectError(call('restore',{state:broken}),'invalid_rescue_state');}
 for(const patch of [{schemaVersion:2},{rulesVersion:'rescue-v2'},{lastSeenUtc:-1},{adUsage:{day:Math.floor(T/DAY)+1,count:0}},{settledAttempts:[]},{transactionArchive:[]}])expectError(call('validate',{state:{...initial,...patch}}),'invalid_rescue_state');
 for(const row of [null,[],false,1,'bad',{}, {levelId:10,source:'gold',transactionId:'gold-rescue-1',atUtc:T,extra:true}]){const state=plain(gold.state);state.settledAttempts[ctx.attemptId]=row;expectError(call('validate',{state}),'invalid_rescue_settlement');}
 for(const row of [null,[],false,1,'bad',{}, {attemptId:ctx.attemptId,levelId:10,source:'gold',atUtc:T,moves:5,costGold:140,extra:true}]){const state=plain(gold.state);state.processedTransactions['gold-rescue-1']=row;expectError(call('validate',{state}),row?.extra?'invalid_rescue_transaction':'invalid_rescue_settlement');}
 for(const row of [null,{},false,1,'bad',[],[1],[10,'gold','gold-rescue-1',T,0]]){const state=plain(gold.state);state.settledArchive[ctx.attemptId]=row;delete state.settledAttempts[ctx.attemptId];expectError(call('validate',{state}),'invalid_rescue_settlement');}
 for(const row of [null,{},false,1,'bad',[],[1],[ctx.attemptId,10,'gold',T]]){const state=plain(gold.state);state.transactionArchive['gold-rescue-1']=row;delete state.processedTransactions['gold-rescue-1'];expectError(call('validate',{state}),'invalid_rescue_transaction');}
 const invalidClaim=plain(gold.state);invalidClaim.settledAttempts[ctx.attemptId].levelId='10';expectError(call('validate',{state:invalidClaim}),'invalid_rescue_settlement');
 const invalidTx=plain(gold.state);invalidTx.processedTransactions['gold-rescue-1'].moves=10;expectError(call('validate',{state:invalidTx}),'invalid_rescue_transaction');
 const missingTx=plain(gold.state);missingTx.processedTransactions={};expectError(call('validate',{state:missingTx}),'invalid_rescue_settlement');
 const provider=initial.provider;
 for(const opts of [{namespace:'__proto__'},{namespace:'a\n'},{adAvailable:1},{namespace:'x'.repeat(141)}])expectError(call('providerCreate',{options:opts}),'invalid_rescue_provider_configuration');
 for(const patch of [{schemaVersion:2},{nextSerial:0},{finalizedRanges:[[1,1]]},{adAvailable:'false'},{namespace:'__proto__'},{transactions:[]}])expectError(call('providerValidate',{state:{...provider,...patch}}),'invalid_rescue_provider');
 expectError(call('providerFinalize',{state:begun.state.provider,id:begun.transactionId}),'rescue_transaction_not_terminal');const finalized=call('providerFinalize',{state:completed.state.provider,id:begun.transactionId});assert.deepEqual(finalized.finalizedRanges,[[1,1]]);assert.deepEqual(call('providerFinalize',{state:finalized,id:begun.transactionId}),finalized);assert.equal(call('providerVerify',{state:completed.state.provider,receipt:completed.receipt}),true);assert.equal(call('providerVerify',{state:finalized,receipt:completed.receipt}),false);
 return{requests,expected,checks,frozenCases:vectors.availabilityCases.length};
}
if(require.main===module){const suite=buildSuite();console.log(`Rescue: ${suite.checks} immutable JS checks passed; ${suite.frozenCases} frozen availability cases + 5 full wire goldens; two 300-attempt compaction scenarios, duplicate100 and verified save-failure redelivery.`);}
module.exports={buildSuite,execute};
