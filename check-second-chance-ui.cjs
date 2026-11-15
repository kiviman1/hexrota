/* Real production app integration. TEST ads are explicit local callbacks, never live SDK impressions. */
'use strict';
const assert=require('node:assert/strict');
const {mount,lifePool,plain,enter,move,until,wait,NOW}=require('./check-lives-ui.cjs');
const {legacyClears}=require('./check-progression-ui.cjs');
const PROFILE='hexrota-profile-v2',DAY=86400000,tests=[],unhandled=[];
const S={panel:'#second-chance-panel',ad:'#second-chance-ad',gold:'#second-chance-gold',status:'#second-chance-status',dialog:'#rescue-provider-dialog',confirm:'#rescue-provider-confirm',cancel:'#rescue-provider-cancel',redeliver:'#rescue-receipt-retry'};
const counts={groups:0,realSwaps:0,realLosses:0,preservationAssertions:0,reloads:0};
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const test=(name,run)=>tests.push({name,run});
const profile=f=>JSON.parse(f.w.localStorage.getItem(PROFILE));
const attempt=f=>f.save().attempts[f.save().current];
const currentBoard=f=>f.save().boards[f.save().current];
const rescue=f=>f.save().rescue;
const gameGold=f=>f.save().economy.gold;
const requests=f=>Object.keys(rescue(f).provider.transactions);
const receiptOf=f=>{const rows=Object.values(rescue(f).provider.transactions).filter(row=>row.status==='completed');assert(rows.length,'a completed TEST rescue receipt is retained');return plain(rows.at(-1).receipt);};
function manager(f){return f.w.HexRescue.createManager(f.w.HEX_ECONOMY_CONFIG.rescue,{clock:()=>f.now,verifyReceipt:(receipt,provider)=>f.w.HexRescue.TestProvider.verify(provider,receipt)});}
function proofFor(f,id){return plain(manager(f).completeAd(rescue(f),id));}
function noNetwork(f){assert.equal(f.network.length,0,'the TEST rescue/life/economy flows never send network data');}
function availability(f){const game=f.game(),id=attempt(f).attemptId;return manager(f).availability(rescue(f),{attemptId:id,levelId:game.level.id,tutorial:false,cleared:false,status:game.status,movesLeft:game.movesLeft,turn:game.turn,lastCommand:game.commands?.at(-1)?.type||(game.history.length?'swap':null),rescuesUsed:game.usage?.rescue||0},{gold:gameGold(f)});}
function findLoss(game){
 for(let policy=0;policy<120;policy++){
  const copy=game.clone(),route=[];
  while(copy.status==='playing'){
   const legal=copy.legalMoves(),pair=legal[(copy.turn*7+policy)%legal.length];assert(pair,'a playable actual board has a legal swap');assert(copy.swap(...pair).ok);route.push(plain(pair));
  }
  if(copy.status==='lost')return route;
 }
 throw Error('Could not find a real losing route; this is a missing test fixture, not a difficulty verdict.');
}
async function lose(f){
 assert.equal(f.game().status,'playing');const route=findLoss(f.game());assert(route.length,'the loss consumes real legal swaps');
 for(const pair of route){await move(f,pair);counts.realSwaps++;}
 await until(()=>f.node('#lose-dialog').open,'the actual failed game opens the loss result');assert.equal(f.game().status,'lost');counts.realLosses++;return route;
}
async function started({clears=7,lives=5,now=NOW,events}={}){
 const f=mount({saved:legacyClears(clears),life:lifePool(lives,{now}),now,events});
 try{const errors=[];f.w.addEventListener('error',event=>errors.push(event.error?.message||event.message));assert(f.w.HexRescue&&f.w.HexRescueTestAdapter,'real rescue core and host adapter are loaded');await enter(f);assert.deepEqual(errors,[],'normal new-attempt entry throws no browser exception');assert.equal(f.d.body.dataset.screen,'game','normal entry really activates the game before legal-swap fixtures');assert(attempt(f)?.attemptId,'the real new attempt is committed');assert.equal(f.game().level.id,clears+1);assert.equal(gameGold(f),20*clears,'game Gold comes from real replay-validated legacy wins');assert.equal(f.life().testWallet.gold,300,'life TEST Gold remains separate');return f;}catch(error){f.close();throw error;}
}
async function lost(options){const f=await started(options);try{const before=f.life().life.lives;await lose(f);assert.equal(f.life().life.lives,Math.max(0,before-1),'the first real loss is settled once');return f;}catch(error){f.close();throw error;}}
async function offerAgain(f){if(!f.node('#lose-dialog').open)f.click('#continue');await until(()=>f.node('#lose-dialog').open,'the same failed attempt is visible');}
async function enterLost(f,id){assert(!f.node(S.dialog).open,'reload never autoplays a pending TEST ad');await enter(f);await until(()=>f.node('#lose-dialog').open,'normal entry reopens the existing failed attempt');assert.equal(attempt(f).attemptId,id,'viewing a failure does not create a new attempt');assert.equal(f.game().status,'lost');}
function assertGrant(f,beforeGame,beforeAttempt,beforeLife){
 const after=plain(f.game().snapshot());for(const key of ['values','layers','score','rngState','history','turn'])assert.deepEqual(after[key],beforeGame[key],'rescue preserves '+key);
 assert.deepEqual(attempt(f),beforeAttempt,'rescue preserves the entire typed attempt metadata');assert.equal(after.movesLeft,beforeGame.movesLeft+5);assert.equal(after.movesLeft,5);assert.equal(after.usage.rescue,1);assert.equal(after.bonusMoves,5);assert.equal(after.commands.filter(command=>command.type==='grant_moves').length,1);assert.equal(f.game().status,'playing');assert.equal(f.life().life.lives,beforeLife);assert.equal(f.node('#board').getAttribute('aria-busy'),'false');counts.preservationAssertions++;
}
function writeFailure(f){const native=f.w.Storage.prototype.setItem;f.w.Storage.prototype.setItem=function(key,value){if(key===PROFILE)throw new f.w.DOMException('Injected second-chance canonical write failure','QuotaExceededError');return native.call(this,key,value);};return()=>{f.w.Storage.prototype.setItem=native;};}
async function begin(f){const before=plain(f.game().snapshot()),id=attempt(f).attemptId;assert.equal(f.node(S.ad).disabled,false);f.click(S.ad);assert(f.node(S.dialog).open,'only the user request opens the TEST provider dialog');assert.match(f.node(S.dialog).textContent,/TEST/i);assert.match(f.node(S.dialog).textContent,/gerçek.*reklam|gerçek.*işlem|gerçek.*para/i);assert.deepEqual(plain(f.game().snapshot()),before,'beginning an ad gives no moves');const pending=Object.values(rescue(f).provider.transactions).filter(row=>row.status==='pending'&&row.attemptId===id);assert.equal(pending.length,1);return pending[0].transactionId;}
async function complete(f){f.click(S.confirm);await until(()=>f.game().status==='playing'&&f.game().movesLeft===5,'verified explicit TEST completion grants exactly five moves');}

// No engine/level/price fixtures are patched below: every lost board is produced
// by actual legal UI swaps and every wallet is backed by the production ledger.
test('TEST ad begin and cancel grant no moves and consume neither daily right nor Gold',async()=>{
 const f=await lost();try{const old=plain(f.game().snapshot()),metadata=plain(attempt(f)),wallet=plain(f.save().economy),life=plain(f.life()),selection=plain(f.save().variantSelection);assert(!f.node(S.dialog).open);assert(!f.node(S.panel).hidden);const id=await begin(f);assert.equal(rescue(f).adUsage.count,0);f.click(S.cancel);assert.equal(rescue(f).provider.transactions[id].status,'cancelled');assert.equal(rescue(f).adUsage.count,0);assert.deepEqual(plain(f.game().snapshot()),old);assert.deepEqual(attempt(f),metadata);assert.deepEqual(f.save().variantSelection,selection);assert.deepEqual(f.save().economy,wallet);assert.deepEqual(f.life(),life);assert.equal(f.node(S.ad).disabled,false);noNetwork(f);}finally{f.close();}
});

test('verified TEST ad preserves board/RNG/attempt and repeated callbacks grant once; a second loss costs no second life',async()=>{
 const f=await lost();try{const before=plain(f.game().snapshot()),metadata=plain(attempt(f)),life=f.life().life.lives,gold=gameGold(f),wallet=f.life().testWallet.gold;await begin(f);await complete(f);assertGrant(f,before,metadata,life);assert.equal(gameGold(f),gold);assert.equal(f.life().testWallet.gold,wallet);assert.equal(rescue(f).adUsage.count,1);const receipt=receiptOf(f),proof=plain(rescue(f).provider),committed=plain(profile(f));for(let i=0;i<3;i++)assert.equal(f.w.HexRescueTestAdapter.applyReceipt(receipt,proof).applied,false);assert.deepEqual(profile(f).game,committed.game);assert.deepEqual(profile(f).energy,committed.energy);await lose(f);assert.equal(attempt(f).attemptId,metadata.attemptId);assert.equal(f.life().life.lives,life);assert.equal(availability(f).reason,'already_rescued');const stopped=plain(currentBoard(f));f.click(S.gold);f.click(S.ad);assert.deepEqual(currentBoard(f),stopped);noNetwork(f);}finally{f.close();}
});

test('140 earned game Gold buys exactly +5 and does not debit or exchange the 300 life TEST wallet',async()=>{
 const f=await lost();try{const before=plain(f.game().snapshot()),metadata=plain(attempt(f)),life=f.life().life.lives,testWallet=plain(f.life().testWallet);assert.equal(gameGold(f),140);assert.match(f.node(S.gold).textContent,/140/);assert.equal(f.node(S.gold).disabled,false);f.click(S.gold);await until(()=>f.game().movesLeft===5,'explicit Gold option succeeds');assertGrant(f,before,metadata,life);assert.equal(gameGold(f),0);assert.deepEqual(f.life().testWallet,testWallet);const paid=Object.entries(f.save().economy.transactions).filter(([,row])=>row.kind==='rescue'&&row.attemptId===metadata.attemptId);assert.equal(paid.length,1);assert.equal(paid[0][1].costGold,140);assert.equal(currentBoard(f).commands.find(command=>command.type==='grant_moves').id,paid[0][0]);assert.equal(rescue(f).settledAttempts[metadata.attemptId].source,'gold');assert.equal(rescue(f).adUsage.count,0);f.click(S.gold);assert.equal(gameGold(f),0);assert.equal(f.game().movesLeft,5);noNetwork(f);}finally{f.close();}
});

test('insufficient game Gold is rejected before any paid operation; life TEST Gold cannot fund it',async()=>{
 const f=await started();try{f.click('#open-inventory');assert.equal(f.node('#buy-green-brush').disabled,false);f.click('#buy-green-brush');assert.equal(gameGold(f),70,'a genuine inventory purchase spent 70 of 140 earned Gold');f.click('#inventory-dialog [data-close]');await lose(f);assert.equal(f.node(S.gold).disabled,true);const before=plain(profile(f)),providers=requests(f);f.click(S.gold);assert.deepEqual(profile(f).game,before.game);assert.deepEqual(profile(f).energy,before.energy);assert.deepEqual(requests(f),providers);assert.equal(f.life().testWallet.gold,300);assert(!f.node(S.dialog).open);assert.equal(f.game().movesLeft,0);noNetwork(f);}finally{f.close();}
});

test('canonical Gold save failure rolls back money, five moves, command/receipt ledgers and analytics together',async()=>{
 const f=await lost();let restore;try{const before=plain(profile(f)),events=plain(f.events());restore=writeFailure(f);f.click(S.gold);assert.deepEqual(profile(f),before);assert.deepEqual(f.events(),events);assert.equal(gameGold(f),140);assert.equal(f.game().movesLeft,0);assert.equal(f.game().status,'lost');restore();restore=null;f.return();await offerAgain(f);f.click(S.gold);await until(()=>f.game().movesLeft===5,'the same paid rescue can succeed after storage recovers');assert.equal(gameGold(f),0);noNetwork(f);}finally{restore?.();f.close();}
});

test('completed TEST proof survives a failed canonical write for explicit same-page delivery retry',async()=>{
 const f=await lost();let restore;try{const old=plain(f.game().snapshot()),metadata=plain(attempt(f)),life=f.life().life.lives,id=await begin(f),pending=plain(profile(f)),proof=proofFor(f,id);restore=writeFailure(f);f.click(S.confirm);assert.deepEqual(profile(f),pending);assert.equal(f.game().movesLeft,0);assert.equal(gameGold(f),140);assert.equal(rescue(f).adUsage.count,0);assert.equal(rescue(f).provider.transactions[id].status,'pending');assert.equal(f.node(S.redeliver).hidden,false,'failed final write offers receipt redelivery, not another ad');restore();restore=null;f.return();const serial=rescue(f).provider.nextSerial;f.click(S.redeliver);await until(()=>f.game().movesLeft===5,'explicit verified-proof redelivery succeeds');assertGrant(f,old,metadata,life);assert.equal(rescue(f).provider.nextSerial,serial);assert.deepEqual(receiptOf(f),proof.receipt);noNetwork(f);}finally{restore?.();f.close();}
});

test('after failed ad delivery and application reload a verified callback restores the same attempt without rewatching',async()=>{
 let f=await lost(),restore;try{const old=plain(f.game().snapshot()),metadata=plain(attempt(f)),life=f.life().life.lives,id=await begin(f),pending=plain(profile(f)),proof=proofFor(f,id);restore=writeFailure(f);const failedCallback=f.w.HexRescueTestAdapter.applyReceipt(proof.receipt,proof.completedProvider);assert.equal(failedCallback.applied,false,'external receipt is not acknowledged as delivered before successful canonical commit');assert.equal(failedCallback.reason,'storage');assert.deepEqual(profile(f),pending);restore();restore=null;f.close();f=mount({profile:pending,now:NOW});counts.reloads++;assert(!f.node(S.dialog).open);await enterLost(f,metadata.attemptId);assert.equal(requests(f).length,Object.keys(pending.game.rescue.provider.transactions).length);const result=f.w.HexRescueTestAdapter.applyReceipt(proof.receipt,proof.completedProvider);assert.equal(result.applied,true);assertGrant(f,old,metadata,life);assert.equal(gameGold(f),140);assert.equal(rescue(f).adUsage.count,1);assert.equal(f.w.HexRescueTestAdapter.applyReceipt(proof.receipt,proof.completedProvider).applied,false);noNetwork(f);}finally{restore?.();f.close();}
});

test('two rescue ads consume their own UTC quota; a third remains eligible for Gold and life ads have a separate limit',async()=>{
 const f=await lost();try{
  for(let index=0;index<2;index++){await begin(f);await complete(f);assert.equal(rescue(f).adUsage.count,index+1);assert.equal(f.life().life.adUsage.claims,0);await lose(f);f.click('#retry');await until(()=>f.game().status==='playing'&&f.game().turn===0,'normal retry creates a different new board');await lose(f);}
  assert.equal(rescue(f).adUsage.count,2);assert.equal(f.node(S.ad).disabled,true);assert.equal(f.node(S.gold).disabled,false);assert.equal(gameGold(f),140);assert.equal(availability(f).ad.reason,'daily_limit');assert.equal(f.w.HEX_LIVES_CONFIG.ads.dailyLimit,3);const before=requests(f);f.click(S.ad);assert.deepEqual(requests(f),before);assert(!f.node(S.dialog).open);
  f.click('#lose-home');f.click('#home-lives');assert.equal(f.node('#lives-ad').disabled,false);f.click('#lives-ad');f.click('#life-provider-confirm');assert.equal(f.life().life.adUsage.claims,1);assert.equal(rescue(f).adUsage.count,2);assert.equal(f.life().testWallet.gold,300);f.click('#life-provider-dialog [data-close]');f.click('#lives-dialog [data-close]');await enterLost(f,attempt(f).attemptId);
  f.now=NOW+DAY;f.return();await offerAgain(f);assert.equal(rescue(f).adUsage.count,0,'new UTC day resets only the rescue day quota');assert.equal(f.node(S.ad).disabled,false);noNetwork(f);
 }finally{f.close();}
});

test('unavailable TEST ads stay disabled while the earned-Gold alternative remains usable',async()=>{
 const f=await lost();try{f.click('#lose-dialog [data-close]');f.click('#game-settings');f.change('#setting-rescue-ad',false);f.click('#settings-dialog [data-close]');await offerAgain(f);assert.equal(f.node(S.ad).disabled,true);assert.equal(f.node(S.gold).disabled,false);assert.match(f.node(S.status).textContent,/yok|bulunam|kullanılam|uygun değil/i);const before=requests(f);f.click(S.ad);assert.deepEqual(requests(f),before);assert(!f.node(S.dialog).open);f.click(S.gold);await until(()=>f.game().movesLeft===5,'Gold still works when no ad is available');assert.equal(gameGold(f),0);noNetwork(f);}finally{f.close();}
});

test('retry after reopening a pending request releases it; a stale completed callback cannot grant to the new attempt',async()=>{
 let f=await lost();try{const oldId=attempt(f).attemptId,id=await begin(f),pending=plain(profile(f)),proof=proofFor(f,id);f.close();f=mount({profile:pending,now:NOW});counts.reloads++;await enterLost(f,oldId);assert.equal(rescue(f).provider.transactions[id].status,'pending');f.click('#retry');await until(()=>f.game().status==='playing'&&f.game().turn===0,'explicit retry begins a fresh attempt');assert.notEqual(attempt(f).attemptId,oldId);assert.equal(rescue(f).provider.transactions[id].status,'cancelled');assert.equal(rescue(f).adUsage.count,0);const next=plain(profile(f));assert.equal(f.w.HexRescueTestAdapter.applyReceipt(proof.receipt,proof.completedProvider).applied,false);assert.deepEqual(profile(f).game,next.game);assert.deepEqual(profile(f).energy,next.energy);await lose(f);assert.equal(f.node(S.ad).disabled,false,'an unwatched abandoned request did not lock the next attempt');await begin(f);f.click(S.cancel);noNetwork(f);}finally{f.close();}
});

test('a genuine last-life loss may recover and saved assisted progress resumes at zero lives',async()=>{
 let f=await lost({lives:1});try{assert.equal(f.life().life.lives,0);const before=plain(f.game().snapshot()),metadata=plain(attempt(f));await begin(f);await complete(f);assertGrant(f,before,metadata,0);const saved=plain(profile(f));f.close();f=mount({profile:saved,now:NOW});counts.reloads++;await enter(f);assert.equal(f.life().life.lives,0);assert.equal(attempt(f).attemptId,metadata.attemptId);assert.deepEqual(plain(f.game().snapshot()),saved.game.boards[saved.game.current]);assert.equal(f.game().movesLeft,5);noNetwork(f);}finally{f.close();}
});

test('winning after rescue keeps the first life charge and records completion with the original Attempt ID',async()=>{
 const f=await lost({clears:0});try{const id=attempt(f).attemptId;assert.equal(f.life().life.lives,4);await begin(f);await complete(f);const hint=f.game().hint({maxNodes:1500,maxDepth:3,beamWidth:16});assert(hint?.guaranteed&&hint.continuation?.length,'the actual L1 recovery fixture has a verified winning continuation');for(const pair of plain(hint.continuation)){await move(f,pair);counts.realSwaps++;}await until(()=>f.node('#win-dialog').open,'the rescued attempt genuinely wins');assert.equal(f.game().status,'won');assert.equal(attempt(f).attemptId,id);assert.equal(f.life().life.lives,4,'winning later does not refund the original life charge');assert.equal(gameGold(f),20);assert.equal(f.save().economy.stars,1);const events=f.events().events.filter(event=>event.attemptId===id);assert.equal(events.filter(event=>event.name==='level_failed').length,1);assert.equal(events.filter(event=>event.name==='level_completed').length,1,'rescue reopened the terminal lifecycle without changing identity');assert.equal(f.life().life.settledAttempts[id].outcome,'won');noNetwork(f);}finally{f.close();}
});

test('discarding a rescued zero-life attempt remains loadable, cannot resume, and later opens a new attempt without another charge',async()=>{
 let f=await lost({lives:1});try{
  const oldId=attempt(f).attemptId;await begin(f);await complete(f);assert.equal(f.life().life.lives,0);const extraSwap=f.game().legalMoves().find(pair=>{const copy=f.game().clone();return copy.swap(...pair).ok&&copy.status==='playing';});assert(extraSwap,'a genuine post-rescue swap leaves the attempt in progress');await move(f,plain(extraSwap));counts.realSwaps++;assert.equal(f.game().movesLeft,4);const assisted=plain(currentBoard(f)),economy=plain(f.save().economy),claim=plain(rescue(f).settledAttempts[oldId]);
  f.click('#reset');assert(f.node('#restart-dialog').open,'discarding rescued progress still needs explicit confirmation');f.click('#restart-confirm');assert.equal(f.life().life.lives,0);assert.equal(f.life().life.settledAttempts[oldId].outcome,'restart');assert.equal(f.life().life.settledAttempts[oldId].discarded,true);assert.deepEqual(currentBoard(f),assisted,'the discarded checkpoint remains evidence while a fresh zero-life start is blocked');
  const saved=plain(profile(f));f.close();f=mount({profile:saved,now:NOW});counts.reloads++;assert.deepEqual(f.save().economy,economy);assert.deepEqual(currentBoard(f),assisted,'loading retained assistance evidence does not reopen it');assert.deepEqual(rescue(f).settledAttempts[oldId],claim);await enter(f);assert(f.node('#lives-dialog').open,'a discarded checkpoint is not a free resumable game');assert.notEqual(f.d.body.dataset.screen,'game');assert.equal(f.life().life.lives,0);
  f.click('#lives-ad');f.click('#life-provider-confirm');await until(()=>f.d.body.dataset.screen==='game'&&f.game().turn===0,'an explicitly rewarded life can open a fresh attempt');assert.notEqual(attempt(f).attemptId,oldId);assert.equal(f.life().life.lives,1,'the original settled loss/restart cannot debit the newly awarded life');assert.deepEqual(f.save().economy,economy);assert.deepEqual(rescue(f).settledAttempts[oldId],claim);assert.equal(f.game().usage?.rescue||0,0);noNetwork(f);
 }finally{f.close();}
});

test('a second rescued failure cannot re-emit the canonical failure after the first event was evicted; opt-in observation still records it',async()=>{
 const seed=mount();let events;try{events=plain(seed.w.HexEvents.createState({limit:1}));}finally{seed.close();}
 const f=await started({events});try{
  f.click('#game-settings');f.change('#setting-playtest',true);f.click('#settings-dialog [data-close]');await lose(f);const id=attempt(f).attemptId,firstFailure=plain(f.events());assert.equal(firstFailure.limit,1);assert.equal(firstFailure.events.length,1);assert.equal(firstFailure.events[0].name,'level_failed');assert.equal(firstFailure.events[0].attemptId,id);
  await begin(f);await complete(f);const evicted=plain(f.events());assert.equal(evicted.events.length,1);assert.equal(evicted.events[0].name,'booster_used','the real rescue event evicted the first failure from the one-event buffer');assert.equal(evicted.events.some(event=>event.name==='level_failed'),false);const life=f.life().life.lives;await lose(f);
  assert.deepEqual(f.events(),evicted,'a second same-attempt failure does not append a new canonical event even when dedupe history was evicted');assert.equal(f.save().attemptStats[f.save().current].terminalEvent,'level_failed','canonical terminal state still records the second loss');assert.equal(f.life().life.lives,life);assert.equal(f.game().status,'lost');
  const observed=JSON.parse(f.w.localStorage.getItem('hexrota-playtest-v1'));assert.equal(observed.enabled,true);const failures=observed.events.filter(event=>event.name==='level_failed'&&event.data.attemptId===id);assert.equal(failures.length,2,'opt-in local observation retains both real failures');assert.equal(failures[1].data.reason,'post_rescue_failure');noNetwork(f);
 }finally{f.close();}
});

test('a completed earned proof awaiting save cannot become a paid rescue, new ad, restart, reset or different attempt',async()=>{
 const f=await lost();let restore;try{
  const before=plain(f.game().snapshot()),metadata=plain(attempt(f)),life=f.life().life.lives,id=await begin(f),pending=plain(profile(f)),proof=proofFor(f,id);restore=writeFailure(f);f.click(S.confirm);assert.deepEqual(profile(f),pending);assert.equal(f.node(S.redeliver).hidden,false);restore();restore=null;f.return();
  const durable=plain(profile(f)),serial=rescue(f).provider.nextSerial;
  const unchanged=label=>{assert.deepEqual(profile(f).game,durable.game,label+' preserves board, economy, provider and attempt counters');assert.deepEqual(profile(f).energy,durable.energy,label+' preserves life and TEST wallet');assert.equal(f.game().movesLeft,0);assert.equal(gameGold(f),140);assert.equal(f.life().testWallet.gold,300);assert.equal(rescue(f).provider.transactions[id].status,'pending');assert.equal(rescue(f).adUsage.count,0);assert.equal(rescue(f).provider.nextSerial,serial);};
  assert.equal(f.node(S.gold).disabled,true,'earned free delivery cannot be exchanged for a paid rescue');
  for(const [selector,label]of [[S.cancel,'closing the completed provider dialog'],[S.gold,'synthetic Gold option'],[S.ad,'requesting another TEST ad'],['#retry','normal retry'],['#reset','restart'],['#restart-confirm','stale restart confirmation'],['#settings-reset','progress reset'],['#reset-confirm','stale reset confirmation'],['#home-teach','different free tutorial attempt']]){f.click(selector);unchanged(label);}
  f.click(S.ad);assert(f.node(S.dialog).open);assert.equal(f.node(S.confirm).hidden,true,'the earned proof does not ask the player to watch again');assert.equal(f.node(S.redeliver).hidden,false);f.click(S.redeliver);await until(()=>f.game().movesLeft===5,'the original earned proof is explicitly delivered after storage recovers');assertGrant(f,before,metadata,life);assert.equal(gameGold(f),140);assert.equal(rescue(f).adUsage.count,1);assert.equal(rescue(f).provider.nextSerial,serial);assert.equal(f.w.HexRescueTestAdapter.applyReceipt(proof.receipt,proof.completedProvider).applied,false);assert.equal(f.game().movesLeft,5);noNetwork(f);
 }finally{restore?.();f.close();}
});

if(require.main===module)(async()=>{for(const {name,run}of tests){await run();counts.groups++;console.log('✓ '+name);}await wait(5);assert.deepEqual(unhandled,[],'no unhandled second-chance callback failures');console.log('Second-chance UI checks passed: '+JSON.stringify(counts)+'. Real JS app only; this is not a physical-device or live-ad test.');})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={tests,findLoss,S,started,lost,profile,proofFor,availability};
