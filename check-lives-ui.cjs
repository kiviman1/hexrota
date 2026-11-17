/* Real integration: atomic profile, legacy save migration, verified providers and untouched engine outcomes. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const {savedGame}=require('./qa-fixtures.cjs');
const root=__dirname+'/dist/',read=file=>fs.readFileSync(root+file,'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const profileKey='hexrota-profile-v2',gameKey='hexrota-match-v5',lifeKey='hexrota-lives-v1',eventKey='hexrota-events-v1';
const NOW=Date.UTC(2026,0,8,12),MINUTE=60000,tests=[],errors=[],unhandled=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const test=(name,run)=>tests.push({name,run}),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,message,timeout=2200){const start=Date.now();while(!check()&&Date.now()-start<timeout)await wait(5);assert(check(),message);}
const reference={window:{},performance};vm.createContext(reference);
for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js','lives-config.js','lives.js','life-providers.js'])vm.runInContext(read(file),reference,{filename:file});
const R=reference.window,catalog=R.HexAttempts.createCatalog(R.HEX_LEVELS,R.HEX_VARIANTS,R.HexMatch);
function lifePool(count,{gold=300,now=NOW,adAvailable=true,bypass=false}={}){
 const manager=R.HexLives.createManager(R.HEX_LIVES_CONFIG,{clock:()=>now});let state=manager.createState();
 for(let n=0;n<5-count;n++)state=manager.settleAttempt(state,{attemptId:'previous-'+n,levelId:10,tutorial:false,movesUsed:1,outcome:'failed'}).state;
 if(bypass)state=manager.setDeveloperBypass(state,true).state;
 return plain(R.HexLifePrototype.createState(state,{providerNamespace:'ui-test',gold,adAvailable}));
}
function fresh(stage=2){return {current:stage,done:Array.from({length:stage},(_,i)=>i),boards:{},sound:false,preferences:{motion:'reduce',music:false,haptics:false},variantSelection:{seed:0x41abca,serial:0,counts:{},recent:{}}};}
function existing(stage=2,{turns=1,lost=false,legacy=false}={}){
 const saved=fresh(stage),base=R.HEX_LEVELS[stage-2],entry=legacy?null:catalog.start(base.id,{attemptSerial:7,selectionSeed:0x41abca});
 const level=entry?.level||base;let game=new R.HexMatch(level),cascades=0;
 if(lost){
  let route;
  for(let policy=0;policy<120&&!route;policy++){const attempt=new R.HexMatch(level);while(attempt.status==='playing'){const moves=attempt.legalMoves(),pair=moves[(attempt.turn*7+policy)%moves.length];attempt.swap(...pair);}if(attempt.status==='lost')route=plain(attempt.history);}
  assert(route,'a genuine failed route exists');for(const pair of route)cascades+=Math.max(0,game.swap(...pair).frames.length-1);
 }else for(const pair of level.solution.slice(0,turns))cascades+=Math.max(0,game.swap(...pair).frames.length-1);
 saved.boards[stage]=plain(game.snapshot());
 if(entry){saved.attempts={[stage]:plain(entry.metadata)};saved.attemptStats={[stage]:{attemptId:entry.metadata.attemptId,attemptNumber:1,started:true,terminalEvent:lost?'level_failed':null,hintsUsed:0,cascades}};saved.variantSelection.serial=7;saved.variantSelection.counts[base.id]=1;saved.variantSelection.recent[base.id]=[entry.metadata.variantId];}
 return {saved,game,metadata:entry?.metadata};
}
function mount({saved=fresh(),life,now=NOW,oldV4,profile,events,writeFailure=false,beforeApp=null,hintDiagnostics=false}={}){
 if(beforeApp!==null&&typeof beforeApp!=='function')throw new TypeError('beforeApp must be a function');
 const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(read('index.html'),{url:'https://hexrota-lives.example/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 try{
 const w=dom.window,d=w.document,network=[];let utc=now;w.HexSessionTestMode={isolated:true};if(hintDiagnostics)w.HexHintTestMode={enabled:true};
 w.Date.now=()=>utc;w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};
 w.fetch=(...args)=>{network.push(args);return Promise.reject(new Error('Life development providers must be local'));};
 Object.defineProperty(w.navigator,'sendBeacon',{configurable:true,value:(...args)=>{network.push(args);return true;}});
 class AudioStub{configure(){}unlock(){return Promise.resolve();}setActive(){}move(){}victory(){}reward(){}click(){}stop(){}dispose(){}}
 w.HexAudio=AudioStub;
 if(oldV4)w.localStorage.setItem('hexrota-match-v4',JSON.stringify(oldV4));else w.localStorage.setItem(gameKey,JSON.stringify(saved));
 if(life!==undefined)w.localStorage.setItem(lifeKey,JSON.stringify(life));
 if(profile)w.localStorage.setItem(profileKey,JSON.stringify(profile));
 if(events!==undefined)w.localStorage.setItem(eventKey,JSON.stringify(events));
 if(writeFailure){const native=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(key,value){if(key===profileKey)throw new w.DOMException('Life storage unavailable','QuotaExceededError');return native.call(this,key,value);};}
 for(const script of d.querySelectorAll('script[src]')){const file=script.getAttribute('src').split('?')[0].replace(/^\.\//,'');if(!['audio.js','pwa.js'].includes(file)){if(file==='app.js')beforeApp?.(w,d);w.eval(read(file));}}
 const f={dom,w,d,network,get now(){return utc;},set now(value){utc=value;},save:()=>JSON.parse(w.localStorage.getItem(gameKey)),life:()=>JSON.parse(w.localStorage.getItem(lifeKey)),events:()=>JSON.parse(w.localStorage.getItem(eventKey)||'null'),close(){dom.window.close();}};
 f.node=selector=>{const n=d.querySelector(selector);assert(n,selector+' exists');return n;};f.click=selector=>f.node(selector).dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:0}));
 f.return=()=>{Object.defineProperty(d,'hidden',{configurable:true,value:false});d.dispatchEvent(new w.Event('visibilitychange'));w.dispatchEvent(new w.Event('focus'));};
 f.change=(selector,value)=>{const n=f.node(selector);n.checked=value;n.dispatchEvent(new w.Event('change',{bubbles:true}));};
 f.game=()=>savedGame(w);
 return f;
 }catch(error){dom.window.close();throw error;}
}
async function enter(f){f.click('#home-play');if(f.node('#pregame-dialog').open)f.click('#pregame-start');await wait(1);}
async function move(f,pair){for(const index of pair)f.click(`#board [data-index="${index}"]`);await until(()=>f.node('#board').getAttribute('aria-busy')==='false','move presentation ends');}
function noNetwork(f){assert.equal(f.network.length,0,'life, wallet and ad simulation never call external services');}
function latestReceipt(f){const completed=Object.values(f.life().provider.transactions).filter(t=>t.status==='completed');assert(completed.length);return plain(completed.at(-1).receipt);}

test('new profiles have five visible hearts in both menus, a stopped timer and explicit development labels',()=>{
 const f=mount();try{
  assert.equal(f.life().life.lives,5);assert.equal(f.life().life.developerBypass,false,'the production default does not bypass lives');
  for(const button of ['#home-lives','#journey-lives']){assert.equal(f.node(button).querySelectorAll('[data-life-hearts] svg').length,5);assert(/5/.test(f.node(button).getAttribute('aria-label')));assert(/dolu/i.test(f.node(button).querySelector('[data-life-timer]').textContent));}
  assert(!f.node('#lives-dialog').open&&!f.node('#life-provider-dialog').open,'no shop or ad starts automatically');f.click('#home-lives');
  assert(/GELİŞTİRME TESTİ/.test(f.node('#lives-dialog').textContent));assert(/gerçek.*reklam|gerçek.*para/i.test(f.node('#lives-dialog').textContent));assert.equal(+f.node('#lives-gold').textContent,300);noNetwork(f);
 }finally{f.close();}
});

test('zero blocks a new attempt before selector/save changes and leaves waiting, test Gold and free teaching available',async()=>{
 const f=mount({life:lifePool(0,{adAvailable:false})});try{
  const before=plain(f.save());await enter(f);assert(f.node('#lives-dialog').open);assert.notEqual(f.d.body.dataset.screen,'game');assert.deepEqual(f.save().variantSelection,before.variantSelection);assert.deepEqual(f.save().boards,before.boards);
  assert.equal(f.node('#lives-ad').disabled,true);assert(/yok|bulunama/i.test(f.node('#lives-ad-status').textContent));assert.equal(f.node('#lives-buy-one').disabled,false);assert.equal(f.node('#lives-buy-refill').disabled,false);assert.equal(f.node('#lives-teach').disabled,false);
  f.click('#lives-ad');assert.equal(Object.keys(f.life().provider.transactions).length,0,'unavailable ads cannot start through a synthetic click');
  f.click('#lives-teach');assert.equal(f.save().current,0);assert.equal(f.life().life.lives,0);await move(f,[4,3]);assert.equal(f.life().life.lives,0);assert.equal(+f.node('#sum').textContent,6);noNetwork(f);
 }finally{f.close();}
});

test('an in-flight variant resumes exactly at zero and pause/close/foreground changes spend nothing',async()=>{
 const entry=existing(),f=mount({saved:entry.saved,life:lifePool(0)});try{
  await enter(f);assert.equal(f.d.body.dataset.screen,'game');assert.deepEqual(plain(f.game().snapshot()),plain(entry.game.snapshot()));const before=plain(f.life()),snapshot=plain(f.save().boards[2]);
  f.click('#pause');f.click('#pause-continue');Object.defineProperty(f.d,'hidden',{configurable:true,value:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));f.w.dispatchEvent(new f.w.Event('pagehide'));f.return();
  assert.equal(f.life().life.lives,0);assert.deepEqual(f.save().boards[2],snapshot);assert.deepEqual(f.life().life.settledAttempts,before.life.settledAttempts);noNetwork(f);
 }finally{f.close();}
});

test('failure spends one, exact reload and repeated result screens cannot spend another; winning spends none',async()=>{
 let f=mount({saved:fresh(11)});try{
  await enter(f);const actual=f.game();let losing;
  for(let policy=0;policy<120&&!losing;policy++){const g=new f.w.HexMatch(actual.level);while(g.status==='playing'){const legal=g.legalMoves();g.swap(...legal[(g.turn*7+policy)%legal.length]);}if(g.status==='lost')losing=plain(g.history);}
  assert(losing);for(const pair of losing)await move(f,pair);await until(()=>f.node('#lose-dialog').open,'failure result opens');assert.equal(f.life().life.lives,4);
  const save=plain(f.save()),life=plain(f.life());f.click('#lose-dialog [data-close]');f.click('#continue');assert.equal(f.life().life.lives,4);
  f.close();f=mount({saved:save,life});assert.equal(f.life().life.lives,4);assert.deepEqual(f.save().boards[11],save.boards[11]);
 }finally{f.close();}
 const won=mount();try{await enter(won);for(const pair of won.game().level.solution)await move(won,plain(pair));assert.equal(won.game().status,'won');assert.equal(won.life().life.lives,5);noNetwork(won);}finally{won.close();}
});

test('played restart states its life cost; cancel keeps a paused game and confirmation charges once',async()=>{
 const f=mount();try{
  await enter(f);await move(f,plain(f.game().level.solution[0]));const old=plain(f.save()),life=plain(f.life());
  f.click('#pause');f.click('#pause-restart');assert(f.node('#restart-dialog').open);assert(/1 can/.test(f.node('#restart-dialog').textContent));f.click('#restart-cancel');assert(f.node('#pause-dialog').open);assert.deepEqual(f.save(),old);assert.deepEqual(f.life(),life);f.click('#pause-continue');
  f.click('#reset');f.click('#restart-confirm');assert.equal(f.life().life.lives,4);assert.notEqual(f.save().attempts[2].attemptId,old.attempts[2].attemptId);assert.notEqual(f.save().attempts[2].variantId,old.attempts[2].variantId);assert.equal(f.game().turn,0);
  f.click('#restart-confirm');assert.equal(f.life().life.lives,4,'an old confirm callback cannot debit the new attempt');
 }finally{f.close();}
});

test('the last-life reset closes the discarded attempt, blocks a fresh board and can recover by a verified user-requested ad',async()=>{
 const entry=existing(),f=mount({saved:entry.saved,life:lifePool(1)});try{
  await enter(f);const old=plain(f.save()),oldId=old.attempts[2].attemptId;f.click('#reset');f.click('#restart-confirm');
  assert.equal(f.life().life.lives,0);assert.equal(f.life().life.settledAttempts[oldId].discarded,true);assert(f.node('#lives-dialog').open);assert.deepEqual(f.save().boards[2],old.boards[2],'discarded snapshot is retained for safe recovery, not silently overwritten');assert.deepEqual(f.save().variantSelection,old.variantSelection);
  f.click('#lives-wait');await enter(f);assert(f.node('#lives-dialog').open);assert.notEqual(f.d.body.dataset.screen,'game','discarded played progress cannot be resumed for free');
  f.click('#lives-ad');assert(f.node('#life-provider-dialog').open);f.click('#life-provider-confirm');await until(()=>f.d.body.dataset.screen==='game','reward starts the requested fresh attempt');
  assert.equal(f.life().life.lives,1);assert.notEqual(f.save().attempts[2].attemptId,oldId);assert.equal(f.game().turn,0);noNetwork(f);
 }finally{f.close();}
});

test('confirming a played reset at zero closes it without debt and a later rewarded life starts the fresh board with one',async()=>{
 const entry=existing(),f=mount({saved:entry.saved,life:lifePool(0)});try{
  await enter(f);const old=plain(f.save()),oldId=old.attempts[2].attemptId;
  f.click('#reset');assert(f.node('#restart-dialog').open,'the resumable played game still requires explicit discard consent at zero');
  assert(/can harca(?:maz|nmaz)|0 can/.test(f.node('#restart-description').textContent));f.click('#restart-cancel');assert.deepEqual(f.save().boards[2],old.boards[2]);assert(!f.life().life.settledAttempts[oldId]?.discarded);
  f.click('#reset');f.click('#restart-confirm');assert(f.node('#lives-dialog').open);assert.equal(f.life().life.lives,0);assert.equal(f.life().life.settledAttempts[oldId].discarded,true);
  f.click('#lives-ad');f.click('#life-provider-confirm');await until(()=>f.d.body.dataset.screen==='game','one rewarded life opens the requested fresh board');
  assert.equal(f.life().life.lives,1,'the already discarded zero-life attempt cannot debit the newly awarded life');assert.notEqual(f.save().attempts[2].attemptId,oldId);assert.equal(f.game().turn,0);f.click('#restart-confirm');assert.equal(f.life().life.lives,1);
 }finally{f.close();}
});

test('restarting an untouched attempt is free and denying a new attempt at zero preserves the resumable old one',async()=>{
 const f=mount();try{await enter(f);const before=plain(f.life());f.click('#reset');if(f.node('#restart-dialog').open)f.click('#restart-confirm');assert.equal(f.life().life.lives,before.life.lives);}finally{f.close();}
 const entry=existing(2,{turns:0}),zero=mount({saved:entry.saved,life:lifePool(0)});try{
  await enter(zero);const before=plain(zero.save()),life=plain(zero.life());zero.click('#reset');if(zero.node('#restart-dialog').open)zero.click('#restart-confirm');
  assert.equal(zero.life().life.lives,0);assert.deepEqual(zero.save().boards[2],before.boards[2]);assert.deepEqual(zero.save().variantSelection,before.variantSelection);assert(!zero.life().life.settledAttempts[before.attempts[2].attemptId]?.discarded,'a blocked free restart does not erase the existing zero-turn attempt');
  assert.equal(Object.keys(zero.life().life.settledAttempts).length,Object.keys(life.life.settledAttempts).length);
 }finally{zero.close();}
});

test('fake Gold purchases charge configured costs only after completion and duplicate receipts never charge twice',async()=>{
 for(const [selector,product,cost,lives]of [['#lives-buy-one','single_life',30,3],['#lives-buy-refill','refill_lives',100,5],['#lives-buy-unlimited','unlimited_lives_30m',180,2]]){
  let f=mount({life:lifePool(2)});try{
   f.click('#home-lives');const anchor=f.life().life.regenAnchorUtc;f.click(selector);assert(f.node('#life-provider-dialog').open);assert(/gerçek.*para|test işlemi/i.test(f.node('#life-provider-dialog').textContent));assert.equal(f.life().testWallet.gold,300);assert.equal(f.life().life.lives,2);
   f.click('#life-provider-cancel');assert.equal(f.life().testWallet.gold,300);assert.equal(f.life().life.lives,2);
   f.click(selector);f.click('#life-provider-confirm');assert.equal(f.life().testWallet.gold,300-cost);assert.equal(f.life().life.lives,lives);
   if(product==='single_life')assert.equal(f.life().life.regenAnchorUtc,anchor);if(product==='unlimited_lives_30m')assert.equal(f.life().life.unlimitedUntilUtc,NOW+30*MINUTE);
   const receipt=latestReceipt(f),completed=plain(f.life());assert.equal(f.w.HexLifeTestAdapter.applyReceipt(receipt).applied,false);assert.deepEqual(f.life(),completed);
   const save=plain(f.save());f.close();f=mount({saved:save,life:completed});assert.equal(f.w.HexLifeTestAdapter.applyReceipt(receipt).applied,false);assert.deepEqual(f.life(),completed);noNetwork(f);
  }finally{f.close();}
 }
});

test('rewarded ad completion adds one while preserving the timer; cancellation, forged callback and cooldown add nothing',()=>{
 const f=mount({life:lifePool(2)});try{
  f.click('#home-lives');const anchor=f.life().life.regenAnchorUtc;f.click('#lives-ad');f.click('#life-provider-cancel');assert.equal(f.life().life.lives,2);assert.equal(f.life().life.adUsage.claims,0);
  const forged={transactionId:'unissued',productId:'ad_life',provider:'development',status:'completed',verifiedAtUtc:NOW};assert.equal(f.w.HexLifeTestAdapter.applyReceipt(forged).applied,false);
  f.click('#lives-ad');f.click('#life-provider-confirm');assert.equal(f.life().life.lives,3);assert.equal(f.life().life.regenAnchorUtc,anchor);assert.equal(f.life().life.adUsage.claims,1);assert.equal(f.life().testWallet.gold,300);
  const receipt=latestReceipt(f);f.w.HexLifeTestAdapter.applyReceipt(receipt);assert.equal(f.life().life.lives,3);assert.equal(f.life().life.adUsage.claims,1);assert.equal(f.node('#lives-ad').disabled,true);assert(/30:00|bekle/.test(f.node('#lives-ad-status').textContent));noNetwork(f);
 }finally{f.close();}
});

test('returning offline refreshes 29/30/150-minute regeneration and unlimited expiry without changing an ongoing game',async()=>{
 const entry=existing(),f=mount({saved:entry.saved,life:lifePool(0)});try{
  await enter(f);const before=plain(f.save().boards[2]);f.now=NOW+29*MINUTE;f.return();assert.equal(f.life().life.lives,0);
  f.now=NOW+30*MINUTE;f.return();assert.equal(f.life().life.lives,1);assert.deepEqual(f.save().boards[2],before);
  f.now=NOW+150*MINUTE;f.return();assert.equal(f.life().life.lives,5);assert.equal(f.life().life.regenAnchorUtc,null);assert.deepEqual(f.save().boards[2],before);
 }finally{f.close();}
 const unlimited=mount({life:lifePool(0)});try{unlimited.click('#home-lives');unlimited.click('#lives-buy-unlimited');unlimited.click('#life-provider-confirm');assert.equal(unlimited.life().life.lives,0);unlimited.now=NOW+30*MINUTE;unlimited.return();assert.equal(unlimited.life().life.lives,1);assert.equal(unlimited.life().life.unlimitedUntilUtc,null);}finally{unlimited.close();}
});

test('an unlimited-start attempt keeps its waiver through expiry, reload and reset confirmation',async()=>{
 let f=mount({life:lifePool(2)});try{
  f.click('#home-lives');f.click('#lives-buy-unlimited');f.click('#life-provider-confirm');f.click('#lives-wait');await enter(f);await move(f,plain(f.game().level.solution[0]));
  const saved=plain(f.save()),life=plain(f.life()),id=saved.attempts[2].attemptId;f.close();f=mount({saved,life,now:NOW+31*MINUTE});await enter(f);
  f.click('#reset');assert(/can harca(?:maz|nmaz)|0 can/.test(f.node('#restart-description').textContent));f.click('#restart-confirm');
  assert.equal(f.life().life.lives,3,'normal regeneration continues; the protected attempt costs nothing');assert.equal(f.life().life.settledAttempts[id].waiver,'unlimited');assert.notEqual(f.save().attempts[2].attemptId,id);assert.equal(f.game().turn,0);
 }finally{f.close();}
});

test('9.0 terminal saves get no retroactive debit, while an unrecorded 9.1 loss after a crash is settled once',()=>{
 const old=existing(11,{lost:true,legacy:true});let f=mount({saved:old.saved});try{assert.equal(f.life().life.lives,5);assert.deepEqual(f.save().boards[11],old.saved.boards[11]);const save=plain(f.save()),life=plain(f.life());f.close();f=mount({saved:save,life});assert.equal(f.life().life.lives,5);}finally{f.close();}
 const recent=existing(11,{lost:true});let crash=mount({saved:recent.saved,life:lifePool(5)});try{assert.equal(crash.life().life.lives,4);assert.deepEqual(crash.save().boards[11],recent.saved.boards[11]);const saved=plain(crash.save()),life=plain(crash.life());crash.close();crash=mount({saved,life});assert.equal(crash.life().life.lives,4);}finally{crash.close();}
});

test('developer life bypass is explicit, persists and permits balancing at zero without changing engine outcomes',async()=>{
 const f=mount({life:lifePool(0)});try{
  assert.equal(f.life().life.developerBypass,false);f.click('#settings');f.change('#setting-lives-bypass',true);f.click('#settings-done');assert.equal(f.life().life.developerBypass,true);
  await enter(f);assert.equal(f.d.body.dataset.screen,'game');const model=f.game(),pair=plain(model.level.solution[0]);model.swap(...pair);await move(f,pair);assert.deepEqual(plain(f.game().snapshot()),plain(model.snapshot()));assert.equal(f.life().life.lives,0);
  f.click('#reset');f.click('#restart-confirm');assert.equal(f.life().life.lives,0);assert.equal(f.game().turn,0);noNetwork(f);
 }finally{f.close();}
});

test('progress reset preserves the life pool, protection and verified test wallet instead of creating a free refill',()=>{
 const f=mount({life:lifePool(2)});try{
  f.click('#home-lives');f.click('#lives-buy-one');f.click('#life-provider-confirm');f.click('#lives-wait');const before=plain(f.life());
  f.click('#settings');f.click('#settings-reset');assert(/canların|can|Test Altını/i.test(f.node('#reset-dialog').textContent));f.click('#reset-confirm');
  assert.equal(f.life().life.lives,before.life.lives);assert.deepEqual(f.life().testWallet,before.testWallet);assert.deepEqual(f.life().life.processedTransactions,before.life.processedTransactions);assert.deepEqual(f.life().life.protectionUsed,before.life.protectionUsed);
 }finally{f.close();}
});

test('an unwritable authoritative profile blocks new transactions without charging the in-memory wallet or erasing gameplay saves',async()=>{
 const base=existing(),life=lifePool(2),f=mount({saved:base.saved,life,writeFailure:true});try{
  assert.deepEqual(f.save().boards[2],base.saved.boards[2]);f.click('#home-lives');const before=plain(f.life());f.click('#lives-buy-one');if(f.node('#life-provider-dialog').open)f.click('#life-provider-confirm');
  assert.deepEqual(f.life(),before);assert.deepEqual(f.save().boards[2],base.saved.boards[2]);noNetwork(f);
 }finally{f.close();}
});

test('a callback whose final aggregate write fails grants nothing and never partially debits test Gold',()=>{
 const f=mount({life:lifePool(2)});try{
  f.click('#home-lives');f.click('#lives-buy-one');assert(f.node('#life-provider-dialog').open);const before=plain(f.life());
  const native=f.w.Storage.prototype.setItem;f.w.Storage.prototype.setItem=function(key,value){if(key===profileKey)throw new f.w.DOMException('Final commit failed','QuotaExceededError');return native.call(this,key,value);};
  f.click('#life-provider-confirm');assert.deepEqual(f.life(),before,'the provider receipt, wallet debit and life credit are committed together or not at all');assert.equal(f.life().life.lives,2);assert.equal(f.life().testWallet.gold,300);noNetwork(f);
 }finally{f.close();}
});

test('a failed terminal transaction rolls back board, life and variant; retrying that move after recovery charges once',async()=>{
 const f=mount({saved:fresh(11)});try{
  await enter(f);const level=f.game().level;let route;
  for(let policy=0;policy<120&&!route;policy++){const g=new f.w.HexMatch(level);while(g.status==='playing'){const moves=g.legalMoves();g.swap(...moves[(g.turn*7+policy)%moves.length]);}if(g.status==='lost')route=plain(g.history);}
  assert(route);const oldId=f.save().attempts[11].attemptId;
  for(const pair of route.slice(0,-1))await move(f,pair);
  const before=plain(f.save()),native=f.w.Storage.prototype.setItem;f.w.Storage.prototype.setItem=function(key,value){if(key===profileKey)throw new f.w.DOMException('Loss settlement failed','QuotaExceededError');return native.call(this,key,value);};
  await move(f,route.at(-1));assert.deepEqual(f.save(),before);assert.equal(f.life().life.lives,5);assert(!f.life().life.settledAttempts[oldId]);
  f.w.Storage.prototype.setItem=native;f.return();await move(f,route.at(-1));await until(()=>f.node('#lose-dialog').open,'the repeated valid move can complete after storage recovers');assert.equal(f.life().life.lives,4);assert.equal(f.life().life.settledAttempts[oldId].charged,true);
  f.click('#retry');assert.equal(f.life().life.lives,4);assert.notEqual(f.save().attempts[11].attemptId,oldId);
 }finally{f.close();}
});

test('the previous v4 game key migrates exactly while the first life profile starts at five',async()=>{
 const model=new R.HexMatch(R.HEX_LEVELS[0]);model.swap(...model.level.solution[0]);
 const old={current:0,done:[],boards:{0:plain(model.snapshot())},sound:false};const f=mount({oldV4:old});try{
  assert.equal(f.save().current,2);assert.deepEqual(f.save().boards[2],plain(model.snapshot()));assert.equal(f.life().life.lives,5);
  await enter(f);assert.deepEqual(plain(f.game().snapshot()),plain(model.snapshot()));assert.equal(f.life().life.lives,5);
  assert.deepEqual(JSON.parse(f.w.localStorage.getItem('hexrota-match-v4')),old,'the source migration key remains untouched');
 }finally{f.close();}
});

test('full progress reset explains played-attempt costs, supports cancellation and batches multiple closures without negative lives',async()=>{
 const f=mount();try{
  await enter(f);await move(f,plain(f.game().level.solution[0]));const before=plain(f.save()),life=plain(f.life());
  f.click('#game-settings');f.click('#settings-reset');assert(/1 can/.test(f.node('#reset-description').textContent));f.click('#reset-cancel');assert.deepEqual(f.save(),before);assert.deepEqual(f.life(),life);
  f.click('#settings-reset');f.click('#reset-confirm');assert.equal(f.life().life.lives,4);assert.deepEqual(f.save().boards,{});
 }finally{f.close();}
 const first=existing(2),second=existing(3),saved=plain(second.saved);saved.done=[0,1];saved.boards[2]=first.saved.boards[2];saved.attempts[2]=first.saved.attempts[2];saved.attemptStats[2]=first.saved.attemptStats[2];
 // Older versions could retain several unfinished boards. Neither board is a permanent completion;
 // a done flag on stage 2 would now correctly preserve that closed level as historical evidence.
 const many=mount({saved,life:lifePool(1)});try{
  many.click('#settings');many.click('#settings-reset');assert(/1 can/.test(many.node('#reset-description').textContent));many.click('#reset-confirm');assert.equal(many.life().life.lives,0);assert.deepEqual(many.save().boards,{});
  for(const meta of [first.metadata,second.metadata])assert.equal(many.life().life.settledAttempts[meta.attemptId].discarded,true,'each deleted played attempt is durably closed');
 }finally{many.close();}
});

if(require.main===module)(async()=>{for(const {name,run}of tests){await run();console.log('✓ '+name);}assert.deepEqual(errors,[],'no browser exceptions');assert.deepEqual(unhandled,[],'no unhandled async life/provider failure');console.log('Life UI checks passed: '+tests.length+' groups with real modules, atomic profile saves, verified local transactions and unchanged engine results.');})().catch(error=>{console.error(error);process.exitCode=1;});

module.exports={mount,fresh,existing,lifePool,plain,enter,move,wait,until,NOW,MINUTE};
