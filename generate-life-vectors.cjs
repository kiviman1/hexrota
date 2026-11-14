/* Shared JSON goldens for the future C# life port; no browser or real providers. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=__dirname,context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'dist/lives.js'),'utf8'),context);
const config=JSON.parse(fs.readFileSync(path.join(root,'dist/lives-config.json'),'utf8'));
const copy=value=>JSON.parse(JSON.stringify(value)),M=60000,T=Date.UTC(2026,0,8,12);
const loss=(id,extra={})=>({kind:'settle',context:{attemptId:id,levelId:10,tutorial:false,movesUsed:1,outcome:'failed',...extra}});
const reward=(id,productId,extra={})=>({kind:'transaction',verified:true,receipt:{transactionId:id,productId,provider:'development',status:'completed',verifiedAtUtc:T,...extra}});
const clock=offset=>({kind:'reconcile',atUtc:T+offset*M}),reload=()=>({kind:'reload'});
const cases=[];
function add(id,operations,override={}){
 let time=T;const trusted=new Set(),settings={...copy(config),...override};
 const manager=context.window.HexLives.createManager(settings,{clock:()=>time,verifyReceipt:receipt=>trusted.has(JSON.stringify(receipt))});
 let state=manager.createState();const initial=copy(state),steps=[];
 for(const operation of operations){
  if(operation.atUtc!==undefined)time=operation.atUtc;
  let outcome=null;
  if(operation.kind==='reconcile')state=manager.reconcile(state);
  else if(operation.kind==='reload')state=manager.restore(JSON.parse(JSON.stringify(state)));
  else if(operation.kind==='settle'){const result=manager.settleAttempt(state,operation.context);state=result.state;const {state:unused,...rest}=result;outcome=rest;}
  else if(operation.kind==='historical'){const result=manager.acknowledgeHistoricalAttempt(state,operation.context);state=result.state;const {state:unused,...rest}=result;outcome=rest;}
  else if(operation.kind==='transaction'){
   if(operation.verified)trusted.add(JSON.stringify(operation.receipt));
   const result=manager.applyTransaction(state,operation.receipt);state=result.state;const {state:unused,...rest}=result;outcome=rest;
  }else if(operation.kind==='bypass'){const result=manager.setDeveloperBypass(state,operation.enabled);state=result.state;const {state:unused,...rest}=result;outcome=rest;}
  else if(operation.kind==='canStart')outcome={allowed:manager.canStart(state,operation.context)};
  else if(operation.kind==='canResume')outcome={allowed:manager.canResume(state,operation.attemptId)};
  else throw Error('Unknown vector operation');
  steps.push({operation:copy(operation),expectedState:copy(state),expectedView:copy(manager.view(state)),expectedOutcome:outcome&&copy(outcome)});
 }
 cases.push({id,initialUtc:T,config:settings,initialState:initial,steps});
}
const spend=(count,prefix='past-')=>Array.from({length:count},(_,i)=>loss(prefix+i));
add('new-failure-win-free-tutorial',[
 loss('failure'),loss('won',{outcome:'won'}),loss('t1',{tutorial:true,levelId:'learn-1'}),loss('t2',{tutorial:true,levelId:'learn-2'}),loss('failure'),reload(),loss('failure')
]);
add('offline-29-30-150-minutes',[...spend(5),clock(29),clock(30),clock(149),clock(150),clock(600),reload()]);
add('ad-preserves-refill-anchor',[
 ...spend(3),clock(10),reward('ad','ad_life',{verifiedAtUtc:T+10*M}),clock(29),clock(30),reward('one','single_life',{verifiedAtUtc:T+30*M}),clock(60)
]);
add('verified-purchase-callback-replay',[
 ...spend(4),reward('same','single_life'),reward('same','single_life'),reload(),reward('same','single_life'),reward('fill','refill_lives'),reward('fill','refill_lives')
]);
add('confirmed-reset-last-life-closes-only-that-attempt',[
 loss('cancel',{outcome:'restart',confirmed:false}),loss('untouched',{outcome:'restart',movesUsed:0,confirmed:true}),...spend(4),loss('discarded',{outcome:'restart',confirmed:true,movesUsed:2}),
 {kind:'canResume',attemptId:'discarded'},{kind:'canResume',attemptId:'other-inflight'},{kind:'canStart',context:{resume:false}},{kind:'canStart',context:{resume:true,attemptId:'other-inflight'}},loss('discarded',{outcome:'restart',confirmed:true,movesUsed:2})
]);
add('future-extra-move-continuation-charge-once',[
 loss('continuation',{movesUsed:10}),loss('continuation',{movesUsed:13}),loss('continuation',{movesUsed:12,outcome:'won'}),reload(),loss('continuation',{movesUsed:15})
]);
add('unlimited-regenerates-normal-lives-and-expires',[
 ...spend(3),clock(10),reward('unlimited','unlimited_lives_30m',{verifiedAtUtc:T+10*M}),loss('unlimited-fail'),clock(30),clock(40),loss('ordinary'),loss('unlimited-fail')
]);
add('unlimited-stacking-does-not-double-apply-one-receipt',[
 ...spend(5),reward('unlimited','unlimited_lives_30m'),clock(10),reward('unlimited','unlimited_lives_30m'),reward('unlimited-2','unlimited_lives_30m',{verifiedAtUtc:T+10*M}),clock(30),clock(60)
]);
add('clock-rollback-freezes-effective-utc',[
 ...spend(3),clock(20),clock(-60),clock(29),clock(30),clock(0),reload(),clock(60)
]);
const midnight=Date.UTC(2026,0,8,23,50);
add('utc-midnight-does-not-erase-cooldown',[
 {kind:'reconcile',atUtc:midnight},...spend(5),reward('late-ad','ad_life',{verifiedAtUtc:midnight}),
 {kind:'reconcile',atUtc:midnight+10*M},reward('too-early','ad_life',{verifiedAtUtc:midnight+10*M}),{kind:'reconcile',atUtc:midnight+30*M},reward('next-day-ad','ad_life',{verifiedAtUtc:midnight+30*M})
]);
add('optional-first-failure-protection-is-per-level',[
 loss('first-1',{levelId:1}),loss('second-1',{levelId:1}),loss('first-2',{levelId:2}),loss('first-3',{levelId:3}),loss('first-4',{levelId:4}),reload(),loss('second-2',{levelId:2})
],{firstFailureProtection:{...config.firstFailureProtection,enabled:true}});
add('developer-bypass-is-an-explicit-waiver',[
 ...spend(5),{kind:'bypass',enabled:true},{kind:'canStart',context:{}},loss('bypass-failure'),{kind:'bypass',enabled:false},{kind:'canStart',context:{}},clock(30),loss('bypass-failure'),loss('normal-failure')
]);
add('historical-9-0-loss-is-not-retroactively-debited',[
 {kind:'historical',context:{attemptId:'historical',levelId:10,tutorial:false,movesUsed:14,outcome:'failed'}},loss('historical',{movesUsed:14}),loss('new-result'),reload(),loss('new-result')
]);
add('full-reward-is-rejected-for-good',[
 reward('full-ad','ad_life'),loss('later-loss'),reward('full-ad','ad_life'),reward('fresh-ad','ad_life')
]);
const unverified=reward('not-yet-verified','single_life');
add('unverified-callback-does-not-poison-a-later-verification',[
 loss('loss'),{...unverified,verified:false},unverified,unverified
]);
add('ledger-capacity-never-evicts-an-old-key',[
 loss('kept'),reward('one','single_life'),loss('overflow'),reward('unlimited','unlimited_lives_30m'),reward('one','single_life'),{kind:'canStart',context:{}},{kind:'canResume',attemptId:'already-running'}
],{maxLedgerEntries:2});
const payload={schemaVersion:1,rulesVersion:'lives-v1',description:'Pure UTC-clock life goldens. Verified flags configure a fake external verifier; they are not fields trusted by the manager. No C# life execution is claimed.',cases};
const destination=path.join(root,'fixtures/lives-vectors.json'),serialized=JSON.stringify(payload,null,2)+'\n';
if(process.argv.includes('--check')){
 if(fs.readFileSync(destination,'utf8')!==serialized)throw Error('Life vectors are stale; regenerate after reviewing a rule change');
 console.log('Life vectors are current: '+cases.length+' cases, '+cases.reduce((sum,c)=>sum+c.steps.length,0)+' transitions/probes.');
}else{fs.writeFileSync(destination,serialized);console.log('Wrote '+cases.length+' shared life cases.');}
