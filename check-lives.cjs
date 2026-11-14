/* Portable life rules: externally supplied UTC time and verified, idempotent operations. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/dist/',plain=value=>JSON.parse(JSON.stringify(value));
const context={window:{}};vm.createContext(context);
for(const file of ['lives-config.js','lives.js','life-providers.js'])vm.runInContext(fs.readFileSync(root+file,'utf8'),context,{filename:file});
const {HexLives,HexLifeProviders:Providers,HexLifePrototype:Prototype}=context.window;
const config=JSON.parse(fs.readFileSync(root+'lives-config.json','utf8'));
assert.deepEqual(plain(context.window.HEX_LIVES_CONFIG),config,'runtime settings are generated from canonical JSON');
const MINUTE=60000,INTERVAL=30*MINUTE,NOW=Date.UTC(2026,0,8,12),tests=[];
const test=(name,run)=>tests.push({name,run});
function fixture(patch={}){
 const settings={...plain(config),...patch};let now=NOW,serial=0;
 const issued=new Set();
 const manager=HexLives.createManager(settings,{clock:()=>now,verifyReceipt:receipt=>issued.has(JSON.stringify(receipt))});
 let state=manager.createState();
 const f={manager,config:settings,get state(){return state;},set state(value){state=value;},get now(){return now;},set now(value){now=value;},
  refresh(){state=manager.reconcile(state);return state;},
  settle(patch={}){const result=manager.settleAttempt(state,{attemptId:'attempt-'+(++serial),levelId:10,tutorial:false,movesUsed:1,outcome:'failed',...patch});state=result.state;return result;},
  spend(count){for(let i=0;i<count;i++)f.settle();return state;},
  receipt(productId,extra={}){const receipt={transactionId:'receipt-'+(++serial),productId,provider:'development',status:'completed',verifiedAtUtc:now,...extra};issued.add(JSON.stringify(receipt));return receipt;},
  issue(receipt){issued.add(JSON.stringify(receipt));return receipt;},
  apply(receipt){const result=manager.applyTransaction(state,receipt);state=result.state;return result;}
 };
 return f;
}

test('a new profile starts full; failure spends one life while winning and tutorials are free',()=>{
 const f=fixture();assert.equal(f.state.schemaVersion,1);assert.equal(f.state.lives,5);assert.equal(f.state.regenAnchorUtc,null);
 const before=plain(f.state),failed=f.settle({attemptId:'first-failure',levelId:1});
 assert.equal(f.state.lives,4);assert.equal(failed.applied,true);assert.equal(failed.charged,true);assert.equal(f.state.regenAnchorUtc,NOW);
 assert.equal(before.lives,5,'transitions leave the previous DTO unchanged');
 const won=f.settle({attemptId:'first-win',outcome:'won'});assert.equal(won.charged,false);assert.equal(f.state.lives,4);
 for(const id of ['learn-1','learn-2']){const result=f.settle({attemptId:id,levelId:id,tutorial:true});assert.equal(result.charged,false);}
 assert.equal(f.state.lives,4);
});

test('29 minutes do not refill; exactly 30 minutes adds one, and full recovery stops the anchor',()=>{
 const f=fixture();f.spend(5);assert.equal(f.state.lives,0);const start=f.state.regenAnchorUtc;
 f.now=NOW+29*MINUTE;f.refresh();assert.equal(f.state.lives,0);assert.equal(f.state.regenAnchorUtc,start);
 f.now=NOW+INTERVAL;f.refresh();assert.equal(f.state.lives,1);assert.equal(f.state.regenAnchorUtc,NOW+INTERVAL);
 f.now=NOW+150*MINUTE;f.refresh();assert.equal(f.state.lives,5);assert.equal(f.state.regenAnchorUtc,null);
 f.now+=1000*INTERVAL;f.refresh();assert.equal(f.state.lives,5);assert.equal(f.state.regenAnchorUtc,null);
});

test('offline elapsed intervals and fractional remainder survive save/restore without a running timer',()=>{
 const f=fixture();f.spend(4);const closed=JSON.stringify(f.state);
 f.now=NOW+75*MINUTE;f.state=f.manager.restore(JSON.parse(closed));
 assert.equal(f.state.lives,3);assert.equal(f.state.regenAnchorUtc,NOW+60*MINUTE);
 f.now=NOW+89*MINUTE;f.refresh();assert.equal(f.state.lives,3);
 f.now=NOW+90*MINUTE;f.refresh();assert.equal(f.state.lives,4);
});

test('a rewarded life preserves the current refill interval and never exceeds five',()=>{
 const f=fixture();f.spend(3);f.now=NOW+10*MINUTE;const anchor=f.state.regenAnchorUtc;
 const reward=f.apply(f.receipt('ad_life'));assert.equal(reward.applied,true);assert.equal(f.state.lives,3);assert.equal(f.state.regenAnchorUtc,anchor);
 f.now=NOW+INTERVAL;f.refresh();assert.equal(f.state.lives,4,'the existing countdown was not restarted by the ad');
 f.apply(f.receipt('single_life'));assert.equal(f.state.lives,5);assert.equal(f.state.regenAnchorUtc,null);
 const saturated=f.apply(f.receipt('single_life'));assert.equal(saturated.applied,false);assert.equal(f.state.lives,5);
 const full=f.apply(f.receipt('refill_lives'));assert.equal(full.applied,false);assert.equal(f.state.lives,5);
});

test('callbacks are idempotent across serialization and mismatched/unverified receipts cannot grant',()=>{
 const f=fixture();f.spend(4);const receipt=f.receipt('single_life');f.apply(receipt);assert.equal(f.state.lives,2);
 const paid=plain(f.state);assert.equal(f.apply(receipt).applied,false);assert.deepEqual(plain(f.state),paid);
 f.state=f.manager.restore(JSON.parse(JSON.stringify(f.state)));assert.equal(f.apply(receipt).applied,false);assert.equal(f.state.lives,2);
 const forged={...f.receipt('single_life'),productId:'refill_lives'};assert.equal(f.apply(forged).applied,false);assert.equal(f.state.lives,2);
 const notIssued={transactionId:'later-verified',productId:'single_life',provider:'development',status:'completed',verifiedAtUtc:f.now};
 assert.equal(f.apply(notIssued).applied,false);f.issue(notIssued);assert.equal(f.apply(notIssued).applied,true,'an unverified result cannot poison a legitimate future verification of that ID');assert.equal(f.state.lives,3);
 const defaultVerifier=HexLives.createManager(config,{clock:()=>NOW});assert.equal(defaultVerifier.applyTransaction(defaultVerifier.createState(),notIssued).applied,false,'omitting a verifier is fail-closed');
});

test('a verified but ineligible reward is permanently rejected instead of becoming a stored free claim',()=>{
 const f=fixture();const fullReceipt=f.receipt('ad_life');assert.equal(f.apply(fullReceipt).applied,false);
 f.spend(2);assert.equal(f.apply(fullReceipt).applied,false);assert.equal(f.state.lives,3);
 const first=f.receipt('ad_life');assert.equal(f.apply(first).applied,true);f.settle();
 const tooSoon=f.receipt('ad_life');assert.equal(f.apply(tooSoon).applied,false);
 f.now+=INTERVAL;f.refresh();const before=f.state.lives;assert.equal(f.apply(tooSoon).applied,false);assert.equal(f.state.lives,before);
});

test('ad claims enforce a UTC daily limit and a 30-minute cooldown independently of provider callbacks',()=>{
 const f=fixture();f.spend(5);
 for(let n=0;n<3;n++){
  f.now=NOW+n*INTERVAL;f.refresh();if(f.state.lives===5)f.settle();
  const receipt=f.receipt('ad_life');assert.equal(f.apply(receipt).applied,true,'claim '+(n+1)+' succeeds');
  assert.equal(f.apply(receipt).applied,false,'duplicate does not consume another daily claim');
  if(n<2){f.settle();f.now+=29*MINUTE;const availability=f.manager.transactionAvailability(f.state,'ad_life');assert.equal(availability.allowed,false,'29 minutes remains inside the cooldown');}
 }
 f.now=NOW+3*INTERVAL;f.refresh();if(f.state.lives===5)f.settle();
 assert.equal(f.manager.transactionAvailability(f.state,'ad_life').allowed,false,'fourth daily ad is unavailable');
 assert.equal(f.apply(f.receipt('ad_life')).applied,false);
 f.now=NOW+24*60*MINUTE;f.refresh();f.settle();
 assert.equal(f.manager.transactionAvailability(f.state,'ad_life').allowed,true,'the next UTC day permits a fresh claim');
 assert.equal(f.apply(f.receipt('ad_life')).applied,true);
});

test('zero lives blocks only new campaign attempts; existing games and fixed tutorials remain available',()=>{
 const f=fixture();f.spend(5);assert.equal(f.manager.canStart(f.state,{tutorial:false,resume:false}),false);
 assert.equal(f.manager.canStart(f.state,{tutorial:false,resume:true,attemptId:'still-playing'}),true);
 assert.equal(f.manager.canStart(f.state,{tutorial:true,resume:false}),true);
 const empty=f.settle({attemptId:'existing-fails-at-zero'});assert.equal(empty.charged,false);assert.equal(f.state.lives,0);
 f.now+=INTERVAL;f.refresh();assert.equal(f.state.lives,1);f.settle({attemptId:'existing-fails-at-zero'});assert.equal(f.state.lives,1,'a failure observed at zero cannot become a delayed debt');
});

test('reset cancellation and untouched attempts are free; a confirmed played reset closes the old attempt exactly once',()=>{
 const f=fixture();const initial=plain(f.state);
 const cancel=f.settle({attemptId:'cancelled-reset',outcome:'restart',confirmed:false});assert.equal(cancel.applied,false);assert.deepEqual(plain(f.state),initial);
 f.settle({attemptId:'untouched-reset',movesUsed:0,outcome:'restart',confirmed:true});assert.equal(f.state.lives,5);
 f.spend(4);assert.equal(f.state.lives,1);
 const reset=f.settle({attemptId:'last-life-reset',movesUsed:2,outcome:'restart',confirmed:true});assert.equal(reset.charged,true);assert.equal(f.state.lives,0);
 assert.equal(f.manager.canResume(f.state,'last-life-reset'),false,'discarded progress is not a free resume loophole');
 assert.equal(f.manager.canStart(f.state,{resume:true,attemptId:'last-life-reset'}),false);
 assert.equal(f.manager.canResume(f.state,'unrelated-existing'),true);
 f.settle({attemptId:'last-life-reset',movesUsed:2,outcome:'restart',confirmed:true});assert.equal(f.state.lives,0);
});

test('failure, future extra-move continuation and repeated final loss charge an attempt at most once',()=>{
 const f=fixture();f.settle({attemptId:'future-continue',movesUsed:10});assert.equal(f.state.lives,4);
 f.settle({attemptId:'future-continue',movesUsed:13});assert.equal(f.state.lives,4,'a later exhausted extra-move continuation cannot consume again');
 f.settle({attemptId:'future-continue',movesUsed:12,outcome:'won'});assert.equal(f.state.lives,4,'a rescue win does not refund a previously settled life');
 f.state=f.manager.restore(JSON.parse(JSON.stringify(f.state)));f.settle({attemptId:'future-continue',movesUsed:15});assert.equal(f.state.lives,4);
});

test('unlimited play keeps normal regeneration and expires without altering the accumulated pool',()=>{
 const f=fixture();f.spend(3);const originalAnchor=f.state.regenAnchorUtc;f.now+=10*MINUTE;
 const purchased=f.receipt('unlimited_lives_30m');assert.equal(f.apply(purchased).applied,true);assert.equal(f.state.unlimitedUntilUtc,NOW+40*MINUTE);assert.equal(f.state.regenAnchorUtc,originalAnchor);
 const expiry=f.state.unlimitedUntilUtc;assert.equal(f.apply(purchased).applied,false);assert.equal(f.state.unlimitedUntilUtc,expiry);
 f.settle({attemptId:'unlimited-failure'});assert.equal(f.state.lives,2);
 f.now=NOW+30*MINUTE;f.refresh();assert.equal(f.state.lives,3);
 f.now=expiry-1;assert.equal(f.manager.canStart({...f.state,lives:0},{resume:false}),true);
 f.now=expiry;f.refresh();assert.equal(f.state.lives,3);assert.equal(f.state.unlimitedUntilUtc<=f.now,true);
 f.settle({attemptId:'after-unlimited'});assert.equal(f.state.lives,2);
 f.settle({attemptId:'unlimited-failure'});assert.equal(f.state.lives,2,'old unlimited failures never become a later charge');
});

test('additional unique unlimited purchases extend the current period; full refill preserves the five-life cap',()=>{
 const f=fixture();f.spend(5);f.apply(f.receipt('unlimited_lives_30m'));assert.equal(f.manager.canStart(f.state),true);const first=f.state.unlimitedUntilUtc;
 f.now+=10*MINUTE;f.apply(f.receipt('unlimited_lives_30m'));assert.equal(f.state.unlimitedUntilUtc,first+INTERVAL);
 f.apply(f.receipt('refill_lives'));assert.equal(f.state.lives,5);assert.equal(f.state.regenAnchorUtc,null);assert.equal(f.state.unlimitedUntilUtc,first+INTERVAL);
 f.now=first+INTERVAL;f.refresh();assert.equal(f.state.lives,5);
});

test('moving the device clock backwards never duplicates regeneration or rewinds the recorded effective time',()=>{
 const f=fixture();f.spend(3);f.now+=20*MINUTE;f.refresh();const latest=f.state.lastSeenUtc,anchor=f.state.regenAnchorUtc;
 f.now=NOW-60*MINUTE;f.refresh();assert.equal(f.state.lives,2);assert.equal(f.state.lastSeenUtc,latest);assert.equal(f.state.regenAnchorUtc,anchor);
 f.now=NOW+29*MINUTE;f.refresh();assert.equal(f.state.lives,2);
 f.now=NOW+30*MINUTE;f.refresh();assert.equal(f.state.lives,3);
 const stored=plain(f.state);f.now=NOW;f.state=f.manager.restore(stored);assert.equal(f.state.lives,3);assert.equal(f.state.lastSeenUtc,stored.lastSeenUtc);
});

test('first-failure protection is optional, per early level, and does not protect a paid reset',()=>{
 const f=fixture({firstFailureProtection:{...config.firstFailureProtection,enabled:true}});
 f.settle({attemptId:'early-first',levelId:1});assert.equal(f.state.lives,5);
 f.settle({attemptId:'early-first',levelId:1});assert.equal(f.state.lives,5);
 f.settle({attemptId:'early-second',levelId:1});assert.equal(f.state.lives,4);
 for(const levelId of [2,3]){f.settle({attemptId:'level-'+levelId+'-first',levelId});assert.equal(f.state.lives,4);}
 f.settle({attemptId:'not-early',levelId:4});assert.equal(f.state.lives,3);
 f.settle({attemptId:'early-reset',levelId:2,outcome:'restart',confirmed:true});assert.equal(f.state.lives,2);
 f.state=f.manager.restore(JSON.parse(JSON.stringify(f.state)));f.settle({attemptId:'after-restore-early',levelId:2});assert.equal(f.state.lives,1,'protection use survives restoration');
});

test('developer bypass explicitly removes gating and charges, then normal rules resume',()=>{
 const f=fixture();f.spend(5);const toggle=f.manager.setDeveloperBypass(f.state,true);f.state=toggle.state;
 assert.equal(f.manager.canStart(f.state),true);f.settle({attemptId:'bypassed-failure'});assert.equal(f.state.lives,0);
 f.state=f.manager.setDeveloperBypass(f.state,false).state;assert.equal(f.manager.canStart(f.state),false);
 f.now+=INTERVAL;f.refresh();assert.equal(f.state.lives,1);f.settle({attemptId:'bypassed-failure'});assert.equal(f.state.lives,1);
 f.settle({attemptId:'ordinary-after-bypass'});assert.equal(f.state.lives,0);
});

test('historical 9.0 results are acknowledged without retroactive charges',()=>{
 const f=fixture();const old={attemptId:'pre-lives-failure',levelId:10,tutorial:false,movesUsed:14,outcome:'failed'};
 f.state=f.manager.acknowledgeHistoricalAttempt(f.state,old).state;assert.equal(f.state.lives,5);
 f.settle(old);assert.equal(f.state.lives,5);f.settle({attemptId:'new-unsettled-loss'});assert.equal(f.state.lives,4);
 f.state=f.manager.restore(JSON.parse(JSON.stringify(f.state)));f.settle({attemptId:'new-unsettled-loss'});assert.equal(f.state.lives,4);
});

test('life save validation rejects unknown versions and invalid pools without mutating valid input',()=>{
 const f=fixture();f.spend(1);const before=plain(f.state);
 for(const patch of [{schemaVersion:999},{lives:-1},{lives:6},{lives:1.5},{lastSeenUtc:-1},{unlimitedUntilUtc:-1}])assert.throws(()=>f.manager.restore({...plain(f.state),...patch}));
 assert.deepEqual(plain(f.state),before);assert.deepEqual(plain(f.manager.restore(JSON.parse(JSON.stringify(f.state)))),before);
});

test('UTC midnight resets the daily ad quota without bypassing the previous claim cooldown',()=>{
 const f=fixture();f.now=Date.UTC(2026,0,8,23,50);f.state=f.manager.createState();f.spend(5);
 f.apply(f.receipt('ad_life'));assert.equal(f.state.lives,1);
 f.now=Date.UTC(2026,0,9,0,0);f.refresh();assert.equal(f.state.adUsage.claims,0,'the next UTC day has a new quota');
 assert.equal(f.manager.transactionAvailability(f.state,'ad_life').allowed,false,'midnight does not erase the rolling 30-minute cooldown');
 f.now=Date.UTC(2026,0,9,0,20);f.refresh();assert.equal(f.manager.transactionAvailability(f.state,'ad_life').allowed,true);
});

test('ledger capacity fails closed and never evicts an old idempotency key',()=>{
 const f=fixture({maxLedgerEntries:2});f.settle({attemptId:'kept-failure'});const receipt=f.receipt('single_life');f.apply(receipt);assert.equal(f.state.lives,5);
 const full=plain(f.state);assert.equal(f.manager.canStart(f.state),false,'a new attempt is blocked before its result could become untracked');
 assert.equal(f.settle({attemptId:'capacity-failure'}).applied,false);assert.equal(f.apply(f.receipt('unlimited_lives_30m')).applied,false);
 assert.deepEqual(plain(f.state),full);assert.equal(f.apply(receipt).applied,false);assert.equal(f.settle({attemptId:'kept-failure'}).applied,false);
 assert.equal(f.manager.canResume(f.state,'already-playing'),true,'an existing game is not destroyed by ledger saturation');
});

test('reserved JavaScript property names cannot bypass attempt or receipt idempotency',()=>{
 const f=fixture();f.spend(2);const before=plain(f.state);
 for(const name of ['__proto__','constructor','toString','hasOwnProperty']){
  assert.throws(()=>f.manager.settleAttempt(f.state,{attemptId:name,levelId:1,tutorial:false,movesUsed:1,outcome:'failed'}));
  assert.equal(f.apply(f.receipt('single_life',{transactionId:name})).applied,false);
 }
 assert.deepEqual(plain(f.state),before,'invalid identity keys cannot alter counters or object prototypes');
});

test('each public action observes one clock sample, including composed HUD and eligibility operations',()=>{
 let reads=0;const manager=HexLives.createManager(config,{clock:()=>{reads++;return NOW;},verifyReceipt:()=>true});
 const state=manager.createState();assert.equal(reads,1);
 const actions=[
  ()=>manager.restore(state),()=>manager.reconcile(state),()=>manager.view(state),()=>manager.canStart(state),()=>manager.canResume(state,'existing'),
  ()=>manager.transactionAvailability(state,'ad_life'),()=>manager.setDeveloperBypass(state,true),
  ()=>manager.settleAttempt(state,{attemptId:'one-clock',levelId:1,tutorial:false,movesUsed:1,outcome:'failed'}),
  ()=>manager.applyTransaction(state,{transactionId:'one-receipt',productId:'single_life',provider:'development',status:'completed',verifiedAtUtc:NOW})
 ];
 for(const action of actions){reads=0;action();assert.equal(reads,1,'a timer or eligibility boundary cannot move halfway through a public operation');}
});

test('development providers require explicit completion and retain the same receipt on repeated callbacks',()=>{
 let provider=Providers.createState({namespace:'life-test'});const initial=plain(provider),request=Providers.begin(provider,{productId:'ad_life',nowUtc:NOW});
 assert.deepEqual(plain(provider),initial);provider=request.state;assert.equal(Providers.verify(provider,{transactionId:request.transactionId}),false);
 const completed=Providers.complete(provider,request.transactionId,{nowUtc:NOW});provider=completed.state;assert(completed.receipt);assert(Providers.verify(provider,completed.receipt));
 const again=Providers.complete(provider,request.transactionId,{nowUtc:NOW+1000});assert.deepEqual(plain(again.receipt),plain(completed.receipt));
 assert.equal(Providers.verify(provider,{...plain(completed.receipt),productId:'refill_lives'}),false);
 assert.equal(Providers.verify(provider,{...plain(completed.receipt),extra:'not-a-verified-field'}),false);
 provider=Providers.setAdAvailable(provider,false);const unavailable=Providers.begin(provider,{productId:'ad_life',nowUtc:NOW});assert.equal(unavailable.transactionId,null);
 const purchase=Providers.begin(provider,{productId:'single_life',nowUtc:NOW});const cancelled=Providers.complete(purchase.state,purchase.transactionId,{outcome:'cancelled',nowUtc:NOW});assert.equal(cancelled.receipt,null);
 const aggregate=Prototype.createState(fixture().state,{providerNamespace:'qa',gold:300});assert.equal(aggregate.testWallet.gold,300);assert.equal(aggregate.schemaVersion,1);
});

for(const {name,run}of tests){run();console.log('✓ '+name);}
assert(!/\b(?:localStorage|document|window\.document|fetch|XMLHttpRequest|sendBeacon)\b/.test(fs.readFileSync(root+'lives.js','utf8')),'the life reducer does not depend on DOM, storage or transport APIs');
console.log('Life rules passed: '+tests.length+' groups, clock recovery, unique settlements, verified rewards, safe restart and portable saves.');
