/* 9.9a real app safety. The R-01 audit input is aliased to numeric legacy L8
 * only inside this test host; no published level, variant, golden or rule is
 * edited. Engine/command/provider/storage methods are the production methods. */
'use strict';
const assert=require('node:assert/strict');
const {mount,lifePool,plain,enter,move,until,wait,NOW}=require('./check-lives-ui.cjs');
const {legacyClears}=require('./check-progression-ui.cjs');
const {lost,S,profile,proofFor,findLoss}=require('./check-second-chance-ui.cjs');
const audit=require('./fixtures/dead-board-vectors-9-9.json').diagnosticCases.find(item=>item.id==='known-issue-rescue-preserves-terminal-dead-board');
const PROFILE='hexrota-profile-v2',GAME='hexrota-match-v5',STAGE=9,LEVEL=8,ATTEMPT='legacy-8',tests=[],errors=[],unhandled=[];
const test=(name,run)=>tests.push({name,run});
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const meta=f=>f.save().attempts[f.save().current];
const rescue=f=>f.save().rescue;
const gold=f=>f.save().economy.gold;
const authority=f=>{const value=profile(f);return plain({game:value.game,energy:value.energy});};
function manager(f){return f.w.HexRescue.createManager(f.w.HEX_ECONOMY_CONFIG.rescue,{clock:()=>f.now,verifyReceipt:(receipt,provider)=>f.w.HexRescue.TestProvider.verify(provider,receipt)});}
function observe(f){f.w.addEventListener('error',event=>errors.push(event.error?.message||event.message));return f;}
function auditMount({profile:stored,...options}={}){
 const saved=legacyClears(7);
 return observe(mount({...options,saved,life:lifePool(5),profile:stored,beforeApp(w){
  const level={...plain(audit.level),id:LEVEL,name:'R-01 test-only legacy alias',subtitle:'Unpublished audit fixture',par:3};
  w.HEX_LEVELS=w.HEX_LEVELS.map(item=>item.id===LEVEL?level:item);
  // Its single legal opening is intentionally NOT certified campaign content.
  w.HEX_VARIANTS={...plain(w.HEX_VARIANTS),levels:w.HEX_VARIANTS.levels.filter(item=>item.levelId!==LEVEL).map(plain)};
  if(!stored){
   const game=new w.HexMatch(level);for(const pair of audit.losingRoute.slice(0,-1))assert(game.swap(...pair).ok);
   const data=JSON.parse(w.localStorage.getItem(GAME));data.current=STAGE;data.boards[STAGE]=plain(game.snapshot());
   data.attempts={...data.attempts,[STAGE]:{attemptVersion:1,levelId:LEVEL,variantId:'legacy-original',levelDataVersion:'original-v1',attemptId:ATTEMPT,attemptSerial:0}};
   w.localStorage.setItem(GAME,JSON.stringify(data));
  }
 }}));
}
async function auditLoss(){
 const f=auditMount();try{await enter(f);assert.equal(f.game().turn,2);assert.equal(f.game().status,'playing');await move(f,plain(audit.losingRoute.at(-1)));await until(()=>f.node('#lose-dialog').open,'real final UI swap opens R-01 loss');
  assert.equal(f.game().status,'lost');assert.equal(f.game().movesLeft,0);assert.equal(f.game().legalMoves().length,0);assert.equal(f.life().life.lives,4);return f;
 }catch(error){f.close();throw error;}
}
function context(f){const game=f.game();return {attemptId:meta(f).attemptId,levelId:game.level.id,tutorial:false,cleared:false,status:game.status,movesLeft:game.movesLeft,turn:game.turn,lastCommand:game.commands?.at(-1)?.type||(game.history.length?'swap':'none'),rescuesUsed:game.usage?.rescue||0};}
function historicalProof(f){
 const current=plain(profile(f)),m=manager(f),begun=m.beginAd(current.game.rescue,context(f));assert(begun.transactionId,'the old pending-provider wire is valid');
 const completed=m.completeAd(begun.state,begun.transactionId);assert(f.w.HexRescue.TestProvider.verify(completed.completedProvider,completed.receipt));
 current.game.rescue=plain(begun.state);return {pending:current,completed:plain(completed),completeProfile:{...plain(current),game:{...plain(current.game),rescue:plain(completed.state)}}};
}
function assertNoGrant(f,before,label){
 const after=authority(f);
 for(const field of ['boards','attempts','attemptStats','variantSelection','economy','records'])assert.deepEqual(after.game[field],before.game[field],label+' preserves '+field);
 assert.deepEqual(after.energy,before.energy,label+' preserves life, settlements and TEST wallet');
 assert.equal(f.game().movesLeft,0);assert.equal(f.game().status,'lost');assert.equal(gold(f),140);
 assert.equal(rescue(f).adUsage.count,before.game.rescue.adUsage.count);assert.deepEqual(rescue(f).settledAttempts,before.game.rescue.settledAttempts);assert.deepEqual(rescue(f).processedTransactions,before.game.rescue.processedTransactions);
}
function failProfileWrites(f,{once=false}={}){
 const native=f.w.Storage.prototype.setItem;let writes=0;
 f.w.Storage.prototype.setItem=function(key,value){if(key===PROFILE){writes++;if(!once||writes===1)throw new f.w.DOMException('9.9a canonical write failure','QuotaExceededError');}return native.call(this,key,value);};
 return {get writes(){return writes;},restore(){f.w.Storage.prototype.setItem=native;}};
}

test('R-01 final real swap rejects new ad and Gold before any provider, command or source debit',async()=>{
 const f=await auditLoss();try{const before=authority(f),provider=plain(rescue(f).provider),events=plain(f.events());
  assert.equal(f.node(S.ad).disabled,true);assert.equal(f.node(S.gold).disabled,true);assert.match(f.node(S.status).textContent,/hamle.*kalmadı/);
  f.click(S.ad);f.click(S.gold);assert.deepEqual(authority(f),before);assert.deepEqual(rescue(f).provider,provider);assert.deepEqual(f.events(),events);assert(!f.node(S.dialog).open);
  const game=f.game(),beforeCommand=plain(game.snapshot()),denied=game.apply?game.apply({id:'new-live-rescue',type:'grant_moves',moves:5}):new f.w.HexAssistedGame(game.level,{attemptId:ATTEMPT},game.snapshot()).apply({id:'new-live-rescue',type:'grant_moves',moves:5});
  assert.equal(denied.ok,false);assert.equal(denied.reason,'no_legal_swaps');assert.deepEqual(plain(f.game().snapshot()),beforeCommand);
 }finally{f.close();}
});

test('historical earned unpublished delivery reloads as a free claim on an actual published playable loss',async()=>{
 let source=await lost(),f;try{const built=historicalProof(source),before=plain(built.completeProfile),id=built.completed.receipt.transactionId;source.close();source=null;
  f=observe(mount({profile:before}));assert(!f.node(S.dialog).open,'reload does not automatically deliver a stored receipt');await enter(f);assert.equal(f.game().status,'lost');assert(f.game().legalMoves().length>0);
  assert.equal(f.node(S.gold).disabled,true,'an earned free right is never sold again');assert.match(f.node(S.ad).textContent,/saklanan/i);
  const held=authority(f),serial=rescue(f).provider.nextSerial;f.click(S.gold);assert.equal(rescue(f).provider.nextSerial,serial);assert.equal(gold(f),140);assert.equal(f.node(S.confirm).hidden,true);assert.equal(f.node(S.redeliver).hidden,false);
  assert.deepEqual(authority(f),held,'opening an existing right creates no new transaction');f.click(S.redeliver);await until(()=>f.game().status==='playing'&&f.game().movesLeft===5,'the stored receipt grants one normal atomic rescue');
  assert.equal(gold(f),140);assert.equal(rescue(f).adUsage.count,1);assert.equal(rescue(f).provider.nextSerial,serial);assert.equal(rescue(f).settledAttempts[meta(f).attemptId].source,'ad');assert.equal(rescue(f).settledAttempts[meta(f).attemptId].transactionId,id);
  const committed=plain(profile(f));for(let n=0;n<5;n++)assert.equal(f.w.HexRescueTestAdapter.applyReceipt(built.completed.receipt,built.completed.completedProvider).applied,false);assert.deepEqual(profile(f),committed);
 }finally{source?.close();f?.close();}
});

test('verified R-01 earned right is stored without moves, payment, settlement or quota and survives review/navigation/reload',async()=>{
 let source=await auditLoss(),f;try{const built=historicalProof(source);source.close();source=null;f=auditMount({profile:built.pending});const before=authority(f);
  const result=f.w.HexRescueTestAdapter.applyReceipt(built.completed.receipt,built.completed.completedProvider);assert.equal(result.applied,false);assert.equal(result.reason,'receipt_retained');assertNoGrant(f,before,'receipt-only holding');
  assert.equal(rescue(f).provider.transactions[built.completed.receipt.transactionId].status,'completed');assert.deepEqual(rescue(f).provider.transactions[built.completed.receipt.transactionId].receipt,built.completed.receipt);
  await enter(f);assert.equal(meta(f).attemptId,ATTEMPT,'Home reviews the same lost attempt instead of silently replacing it');assert.equal(f.node(S.gold).disabled,true);assert.match(f.node(S.status).textContent,/saklandı.*uygulanamıyor/);
  f.click(S.ad);assert.equal(f.node(S.confirm).hidden,true);assert.equal(f.node(S.redeliver).hidden,false);const same=plain(profile(f));f.click(S.redeliver);assert.deepEqual(profile(f),same,'an already durable identical proof creates no extra canonical transaction');
  const held=authority(f);f.click('#lose-home');assert.equal(f.d.body.dataset.screen,'home');f.click('[data-nav="journey"]');f.return();assert.deepEqual(authority(f),held,'navigation and foreground cannot consume an unavailable stored right');
  const reload=plain(profile(f));f.close();f=auditMount({profile:reload});assertNoGrant(f,before,'reload of held right');await enter(f);assert.equal(meta(f).attemptId,ATTEMPT);assert.equal(f.node(S.gold).disabled,true);
  f.click('#lose-home');f.click('#home-teach');assert.equal(f.game().level.id,'learn-1','a durable right does not lock the player out of a free tutorial');const tutorial=plain(f.game().snapshot());
  assert.equal(f.w.HexRescueTestAdapter.applyReceipt(built.completed.receipt,built.completed.completedProvider).reason,'receipt_retained');assert.deepEqual(plain(f.game().snapshot()),tutorial,'the old receipt cannot grant moves to a tutorial');assert.equal(f.network.length,0);
 }finally{source?.close();f?.close();}
});

test('unverified, cancelled and wrong-attempt proofs cannot become retained rights or new economic state',async()=>{
 let source=await auditLoss(),f;try{const built=historicalProof(source);source.close();source=null;f=auditMount({profile:built.pending});const before=plain(profile(f));
  for(const receipt of [null,{},false,{...built.completed.receipt,attemptId:'other-attempt'},{...built.completed.receipt,levelId:'8'},{...built.completed.receipt,verifiedAtUtc:NOW-1},{...built.completed.receipt,transactionId:'unknown-issued-id'}]){
   const result=f.w.HexRescueTestAdapter.applyReceipt(receipt,built.completed.completedProvider);assert.equal(result.applied,false);assert.equal(result.reason,'unverified_receipt');assert.deepEqual(profile(f),before);
  }
  const cancelled=plain(built.pending);cancelled.game.rescue=plain(manager(f).completeAd(cancelled.game.rescue,built.completed.receipt.transactionId,{outcome:'cancelled'}).state);f.close();f=auditMount({profile:cancelled});const denied=plain(profile(f));assert.equal(f.w.HexRescueTestAdapter.applyReceipt(built.completed.receipt,built.completed.completedProvider).reason,'unverified_receipt');assert.deepEqual(profile(f),denied);
 }finally{source?.close();f?.close();}
});

test('receipt-only write failure keeps memory proof until explicit retry; durable hold then permits menu and reload',async()=>{
 let source=await auditLoss(),f,blocked;try{const built=historicalProof(source);source.close();source=null;f=auditMount({profile:built.pending});const before=plain(profile(f));blocked=failProfileWrites(f);
  const result=f.w.HexRescueTestAdapter.applyReceipt(built.completed.receipt,built.completed.completedProvider);assert.equal(result.reason,'storage');assert.equal(blocked.writes,1,'one failed explicit callback never automatically attempts a second canonical write');assert.deepEqual(profile(f),before);assert.equal(f.node(S.redeliver).hidden,false);
  f.click('#home-teach');assert.equal(f.save().current,STAGE,'an unsaved earned proof cannot be discarded by another attempt');assert.equal(f.game().movesLeft,0);
  blocked.restore();blocked=null;f.return();f.click(S.redeliver);assertNoGrant(f,{game:before.game,energy:before.energy},'explicit receipt-only retry');assert.equal(rescue(f).provider.transactions[built.completed.receipt.transactionId].status,'completed');
  f.click('#home-teach');assert.equal(f.game().level.id,'learn-1','the saved proof no longer creates a memory recovery lock');const stored=plain(profile(f));f.close();f=auditMount({profile:stored});assert.equal(rescue(f).provider.transactions[built.completed.receipt.transactionId].status,'completed');assert.equal(rescue(f).adUsage.count,0);assert.equal(gold(f),140);
 }finally{blocked?.restore();source?.close();f?.close();}
});

test('normal eligible grant failure never falls through to a second automatic receipt write',async()=>{
 const f=await lost();let blocked;try{f.click(S.ad);const old=plain(profile(f)),id=Object.keys(rescue(f).provider.transactions).at(-1);blocked=failProfileWrites(f,{once:true});f.click(S.confirm);
  assert.equal(blocked.writes,1,'even if a later write would succeed, this callback makes only its original grant commit');assert.deepEqual(profile(f),old);assert.equal(f.game().movesLeft,0);assert.equal(rescue(f).provider.transactions[id].status,'pending');assert.equal(f.node(S.redeliver).hidden,false);
  blocked.restore();blocked=null;f.return();f.click(S.redeliver);await until(()=>f.game().movesLeft===5,'a later explicit user retry delivers once');assert.equal(rescue(f).adUsage.count,1);assert.equal(gold(f),140);
 }finally{blocked?.restore();f.close();}
});

test('a late processed ad callback cannot release another attempt\'s unsaved earned receipt',async()=>{
 const f=await lost();let blocked;try{
  f.click(S.ad);const adA=Object.keys(rescue(f).provider.transactions).at(-1),attemptA=plain(meta(f));
  f.click(S.confirm);await until(()=>f.game().movesLeft===5,'the first real TEST ad is committed');
  const receiptA=plain(rescue(f).provider.transactions[adA].receipt),providerA=plain(rescue(f).provider),processedA=plain(rescue(f).processedTransactions[adA]);
  assert.equal(rescue(f).adUsage.count,1);assert.equal(rescue(f).settledAttempts[attemptA.attemptId].transactionId,adA);
  f.click('#reset');assert(f.node('#restart-dialog').open);f.click('#restart-confirm');
  await until(()=>f.game().status==='playing'&&f.game().turn===0,'an explicit restart begins a different actual attempt');
  const attemptB=plain(meta(f));assert.notEqual(attemptB.attemptId,attemptA.attemptId);
  for(const pair of findLoss(f.game()))await move(f,plain(pair));
  await until(()=>f.node('#lose-dialog').open,'the new attempt loses through real legal UI swaps');
  assert.equal(f.game().status,'lost');assert(f.game().legalMoves().length>0);
  f.click(S.ad);const adB=Object.keys(rescue(f).provider.transactions).at(-1),proofB=plain(proofFor(f,adB));
  assert.notEqual(adB,adA);assert.equal(proofB.receipt.attemptId,attemptB.attemptId);
  const pending=plain(profile(f)),events=plain(f.events()),life=f.life().life.lives;
  blocked=failProfileWrites(f);f.click(S.confirm);
  assert.equal(blocked.writes,1);assert.deepEqual(profile(f),pending);assert.equal(f.node(S.redeliver).hidden,false);
  const late=f.w.HexRescueTestAdapter.applyReceipt(receiptA,providerA);
  assert.equal(late.applied,false);assert.equal(late.reason,'duplicate_transaction');
  assert.equal(blocked.writes,1,'a duplicate callback never makes a new write or consumes the current proof');
  assert.deepEqual(profile(f),pending);assert.deepEqual(f.events(),events);assert.equal(meta(f).attemptId,attemptB.attemptId);
  blocked.restore();blocked=null;
  // Storage is working now: a lost memory latch would genuinely allow T1 to
  // start, so a failed write cannot mask the stale-callback regression.
  f.click('#home-teach');assert.equal(meta(f).attemptId,attemptB.attemptId);
  assert.deepEqual(profile(f),pending,'the second earned proof still prevents its attempt from being discarded');
  assert(f.node(S.dialog).open);assert.equal(f.node(S.confirm).hidden,true);assert.equal(f.node(S.redeliver).hidden,false);
  f.click(S.redeliver);await until(()=>f.game().status==='playing'&&f.game().movesLeft===5,'the current proof grants exactly once after explicit retry');
  assert.equal(meta(f).attemptId,attemptB.attemptId);assert.equal(f.life().life.lives,life);assert.equal(gold(f),140);
  assert.equal(rescue(f).adUsage.count,2);assert.deepEqual(rescue(f).processedTransactions[adA],processedA);
  assert.equal(rescue(f).settledAttempts[attemptB.attemptId].transactionId,adB);
  assert.equal(f.game().snapshot().commands.filter(command=>command.type==='grant_moves').length,1);
  const committed=plain(profile(f));
  for(const [receipt,provider]of [[receiptA,providerA],[proofB.receipt,proofB.completedProvider]]){
   assert.equal(f.w.HexRescueTestAdapter.applyReceipt(receipt,provider).applied,false);
   assert.deepEqual(profile(f),committed,'neither completed receipt can grant or alter the current attempt again');
  }
 }finally{blocked?.restore();f.close();}
});

test('historical v1 rescued R-01 checkpoint restores byte-for-byte without reshuffle, refund or second grant',async()=>{
 let source=await auditLoss(),f;try{const old=plain(profile(source)),m=manager(source),id=audit.after.commands.at(-1).id;
  const claim=m.applyGold(old.game.rescue,context(source),id,{gold:old.game.economy.gold});assert(claim.applied,'this historical ledger is valid independently of the new public command policy');
  const economy=source.w.HexEconomy.createManager(source.w.HEX_ECONOMY_CONFIG).spendRescue(old.game.economy,{operationId:id,attemptId:ATTEMPT,levelId:LEVEL});assert(economy.applied);
  const historical={...plain(audit.after),levelId:LEVEL,attemptId:ATTEMPT};old.game.boards[STAGE]=historical;old.game.rescue=plain(claim.state);old.game.economy=plain(economy.state);old.game.attemptStats[STAGE].terminalEvent=null;
  source.close();source=null;f=auditMount({profile:old});await enter(f);assert.deepEqual(plain(f.game().snapshot()),historical);assert.equal(f.game().status,'playing');assert.equal(f.game().legalMoves().length,0);assert.equal(gold(f),0);assert.equal(f.life().life.lives,4);
  const saved=authority(f),duplicate=f.game().apply({id,type:'grant_moves',moves:5});assert.equal(duplicate.duplicate,true,'historical duplicate acknowledgement stays ahead of new safety rejection');assert.deepEqual(authority(f),saved);assert.equal(f.game().movesLeft,5);
 }finally{source?.close();f?.close();}
});

if(require.main===module)(async()=>{for(const {name,run}of tests){await run();console.log('✓ '+name);}await wait(5);assert.deepEqual(errors,[],'no actual app exceptions');assert.deepEqual(unhandled,[],'no unhandled receipt callback errors');console.log(`Rescue safety UI: ${tests.length} real-app groups passed. R-01 is an unpublished test-local legacy alias; no physical device or real ad SDK is claimed.`);})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={tests,auditMount,auditLoss,historicalProof};
