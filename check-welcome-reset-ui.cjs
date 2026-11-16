/* Real app tests for the once-only welcome reward and the explicit prototype data reset. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {mount,fresh,lifePool,plain,enter,move,until,wait}=require('./check-lives-ui.cjs');
const PROFILE='hexrota-profile-v2',GAME='hexrota-match-v5',ENERGY='hexrota-lives-v1';
const reference={window:{},performance};vm.createContext(reference);
for(const file of ['engine.js','levels.js','tutorials.js'])vm.runInContext(fs.readFileSync(__dirname+'/dist/'+file,'utf8'),reference,{filename:file});
const R=reference.window,tests=[];
const test=(name,run)=>tests.push({name,run});
const profile=f=>JSON.parse(f.w.localStorage.getItem(PROFILE));
const view=f=>f.w.HexEconomy.createManager(f.w.HEX_ECONOMY_CONFIG).view(f.save().economy);
const welcomeRows=f=>Object.values(f.save().economy.transactions).filter(row=>row.kind==='welcome');
function tutorialBeforeWin(index=1){
 const saved=fresh(index),level=R.HEX_TUTORIALS[index],game=new R.HexMatch(level);
 for(const pair of level.solution.slice(0,-1))assert(game.swap(...pair).ok);
 saved.boards[index]=plain(game.snapshot());
 saved.guideAcks=level.steps.map((step,turn)=>step.acknowledge&&turn<game.turn?`${index}:${turn+1}`:null).filter(Boolean);
 return saved;
}
async function finishTutorial(f,index=1){
 await enter(f);const pair=plain(f.w.HEX_TUTORIALS[index].solution.at(-1));
 await move(f,pair);await until(()=>f.node('#win-dialog').open,'the completed lesson result opens');
 assert.equal(f.game().status,'won');
}
async function replayT2(f){
 f.click('[data-nav="journey"]');f.click('[data-stage="1"]');f.click('#pregame-start');
 for(const pair of plain(f.w.HEX_TUTORIALS[1].solution)){
  if(!f.node('#coach-next').hidden)f.click('#coach-next');
  await move(f,pair);
 }
 await until(()=>f.node('#win-dialog').open,'replayed T2 genuinely wins');
}
function openFullReset(f){f.click('#settings');f.click('#settings-full-reset');assert(f.node('#full-reset-dialog').open,'a separate explicit full-data confirmation opens');}
function verifyWelcome(f){
 assert.equal(view(f).gold,20);assert.equal(view(f).stars,0);assert.deepEqual(plain(view(f).inventory),{greenBrush:0,colorKey:0});
 assert.equal(welcomeRows(f).length,1,'exactly one versioned welcome grant is in the canonical ledger');
 assert.equal(f.node('#win-dialog').dataset.welcome,'true');assert.equal(f.node('#welcome-reward').hidden,false);
 assert.match(f.node('#welcome-gold').textContent,/\+?20\s*Altın/i);
 assert.equal(f.node('#win-rewards').hidden,true,'welcome Gold is separate from a campaign clear reward');
 assert.equal(f.life().testWallet.gold,300,'TEST Gold cannot be substituted for actual welcome Gold');
 assert.equal(profile(f).game.economy.gold,20,'the visible reward is already durably banked');
}

test('a real T2 win atomically banks and presents one welcome chest',async()=>{
 const f=mount({saved:tutorialBeforeWin()});try{
  assert.equal(view(f).gold,0);const energy=plain(f.life());await finishTutorial(f);verifyWelcome(f);
  assert.equal(f.life().life.lives,energy.life.lives,'tutorial reward consumes no life');assert.deepEqual(f.life().testWallet,energy.testWallet,'tutorial reward changes no TEST currency');assert.deepEqual(f.life().provider,energy.provider,'welcome is not a mock payment or ad');
  const settlement=Object.values(f.life().life.settledAttempts).find(row=>row.levelId==='learn-2');assert(settlement&&settlement.tutorial&&!settlement.charged&&settlement.waiver==='tutorial','the existing free tutorial settlement remains valid');
  const before=plain(profile(f));
  for(let n=0;n<100;n++)f.click('#continue');
  assert.deepEqual(profile(f).game.economy,before.game.economy,'100 repeated result requests cannot grant another welcome reward');
  f.click('#next');assert(f.node('#pregame-dialog').open,'the single next action still leads to the first main level preview');
  assert.equal(f.save().variantSelection.serial,before.game.variantSelection.serial,'a reward/preview cannot allocate a campaign Attempt ID');
 }finally{f.close();}
});

test('T1 and skipping the lessons cannot produce the welcome reward',async()=>{
 const first=mount({saved:tutorialBeforeWin(0)});try{
  await finishTutorial(first,0);assert.equal(view(first).gold,0);assert.equal(welcomeRows(first).length,0);assert(first.node('#welcome-reward').hidden);
 }finally{first.close();}
 const skipped=mount({saved:fresh(0)});try{
  await enter(skipped);skipped.click('#coach-skip');assert.equal(view(skipped).gold,0);assert.equal(view(skipped).stars,0);assert.equal(welcomeRows(skipped).length,0);
 }finally{skipped.close();}
});

test('replay, old completion flags and reload never farm welcome Gold',async()=>{
 let f=mount({saved:tutorialBeforeWin()});try{
  await finishTutorial(f);const won=plain(profile(f));f.close();f=mount({profile:won});
  assert.deepEqual(f.save().economy,won.game.economy,'loading the saved reward cannot grant twice');
  await replayT2(f);assert.deepEqual(f.save().economy,won.game.economy,'a new tutorial attempt has no new reward entitlement');
  assert(f.node('#welcome-reward').hidden,'replay does not advertise another welcome grant');
 }finally{f.close();}
 const flags=fresh(2),old=mount({saved:flags});try{
  assert.equal(view(old).gold,0,'historical done flags include a possible skip, so cannot prove a new welcome win');assert.equal(welcomeRows(old).length,0);
 }finally{old.close();}
});

test('a failed final-move save cannot show or partially bank a welcome reward',async()=>{
 const f=mount({saved:tutorialBeforeWin()});try{
  await enter(f);const before=plain(profile(f)),events=plain(f.events()),native=f.w.Storage.prototype.setItem;
  f.w.Storage.prototype.setItem=function(key,value){if(key===PROFILE)throw new f.w.DOMException('injected welcome quota','QuotaExceededError');return native.call(this,key,value);};
  await move(f,plain(f.w.HEX_TUTORIALS[1].solution.at(-1)));
  assert.deepEqual(profile(f),before);assert.deepEqual(f.events(),events);assert.equal(view(f).gold,0);assert.equal(welcomeRows(f).length,0);assert(!f.node('#win-dialog').open,'an uncommitted reward has no celebration');
  f.w.Storage.prototype.setItem=native;f.return();await move(f,plain(f.w.HEX_TUTORIALS[1].solution.at(-1)));await until(()=>f.node('#win-dialog').open,'save recovery can bank the same real win');verifyWelcome(f);
 }finally{f.close();}
});

test('the ordinary progress reset retains the welcome entitlement and banked Gold',async()=>{
 const f=mount({saved:tutorialBeforeWin()});try{
  await finishTutorial(f);f.click('#game-home');const before=plain(f.save().economy);
  f.click('#settings');f.click('#settings-reset');f.click('#reset-confirm');assert.deepEqual(f.save().economy,before,'ordinary reset cannot create another reward claim');
  await replayT2(f);assert.deepEqual(f.save().economy,before);assert(f.node('#welcome-reward').hidden);
 }finally{f.close();}
});

test('full-data reset explains the erased resources and cancellation preserves every committed value',async()=>{
 const f=mount({saved:tutorialBeforeWin(),life:lifePool(1,{gold:90,bypass:true})});try{
  await finishTutorial(f);f.click('#game-home');const before=plain(profile(f));openFullReset(f);
  const text=f.node('#full-reset-dialog').textContent;for(const expected of [/test/i,/Altın/i,/yıldız/i,/can/i,/sil|sıfırla/i])assert(expected.test(text),'full reset states what will be erased: '+expected);
  f.click('#full-reset-cancel');assert.deepEqual(profile(f),before);assert(f.node('#settings-dialog').open,'cancel returns to Settings');
 }finally{f.close();}
});

test('full reset failure keeps the original profile, currency, life and live session usable',async()=>{
 const f=mount({saved:tutorialBeforeWin(),life:lifePool(1,{gold:90,bypass:true})});try{
  await finishTutorial(f);f.click('#game-home');openFullReset(f);const before=plain(profile(f)),native=f.w.Storage.prototype.setItem;
  f.w.Storage.prototype.setItem=function(key,value){if(key===PROFILE)throw new f.w.DOMException('injected full-reset quota','QuotaExceededError');return native.call(this,key,value);};
  f.click('#full-reset-confirm');assert.deepEqual(profile(f),before);assert.equal(view(f).gold,20);assert.equal(f.life().life.lives,1);assert.equal(f.life().testWallet.gold,90);
  f.w.Storage.prototype.setItem=native;f.click('#full-reset-cancel');f.click('#settings-done');f.return();assert.deepEqual(profile(f).game.economy,before.game.economy,'failed reset cannot discard the in-memory economic state');
 }finally{f.close();}
});

test('a committed full reset survives an optional audio cleanup failure',async()=>{
 let f=mount({saved:tutorialBeforeWin(),life:lifePool(1,{gold:90,bypass:true})});try{
  await finishTutorial(f);f.click('#game-home');openFullReset(f);const before=plain(profile(f)),errors=[];
  f.w.addEventListener('error',event=>errors.push(event.message));f.w.HexAudio.prototype.stop=function(){throw new Error('injected optional audio disposal failure');};
  f.click('#full-reset-confirm');const reset=plain(profile(f));assert(reset.revision>before.revision,'successful canonical reset is not rolled back by a presentation failure');
  assert.equal(reset.game.current,0);assert.deepEqual(reset.game.done,[]);assert.deepEqual(reset.game.boards,{});assert.deepEqual(reset.game.attempts,{});assert.equal(reset.energy.life.lives,5);assert.equal(reset.energy.testWallet.gold,300);
  assert(!/Sıfırlama kaydedilemedi|sıfırlanamadı/i.test(f.node('#toast').textContent),'a committed reset is not reported as a failed write');
  f.w.dispatchEvent(new f.w.Event('pagehide'));assert.deepEqual(profile(f),reset);assert.deepEqual(errors,[],'optional audio disposal is handled without an uncaught page error');
  f.close();f=mount({profile:reset});assert.equal(f.d.body.dataset.firstOpening,'true');assert.equal(view(f).gold,0);assert.equal(f.node('#home-play-label').textContent,'Başlayalım');
 }finally{f.close();}
});

test('confirmed full reset is a fresh profile and stale lifecycle callbacks cannot restore the old game',async()=>{
 let f=mount({saved:tutorialBeforeWin(),life:lifePool(1,{gold:90,bypass:true})});try{
  const lifecycleErrors=[];f.w.addEventListener('error',event=>lifecycleErrors.push(event.message));
  await finishTutorial(f);f.click('#game-home');
  const unrelated='unrelated-app-key';f.w.localStorage.setItem(unrelated,'keep me');
  for(const key of ['hexrota-match-v4','hexrota-match-v3','hexrota-match-v2'])f.w.localStorage.setItem(key,JSON.stringify({current:8,done:[0,1,2,3,4,5,6,7,8]}));
  f.w.localStorage.setItem('hexrota-events-v1',JSON.stringify({stale:'test'}));f.w.localStorage.setItem('hexrota-playtest-v1',JSON.stringify({stale:'test'}));
  openFullReset(f);const old=profile(f);f.click('#full-reset-confirm');const reset=plain(profile(f));
  assert(reset.revision>old.revision,'a full reset is a new canonical revision, so stale writers are rejected');
  assert.equal(reset.game.current,0);assert.deepEqual(reset.game.done,[]);assert.deepEqual(reset.game.boards,{});assert.deepEqual(reset.game.attempts,{});assert.deepEqual(reset.game.attemptStats,{});assert.equal(reset.game.variantSelection.serial,0);assert.deepEqual(reset.game.variantSelection.counts,{});assert.deepEqual(reset.game.guideAcks,[]);
  const resetEconomy=plain(reset.game.economy||f.w.HexEconomy.createManager(f.w.HEX_ECONOMY_CONFIG).createState());
  assert.equal(resetEconomy.gold,0);assert.equal(resetEconomy.stars,0);assert.deepEqual(resetEconomy.inventory,{greenBrush:0,colorKey:0});assert.deepEqual(resetEconomy.transactions,{});
  assert.equal(reset.energy.life.lives,5);assert.equal(reset.energy.life.developerBypass,false);assert.equal(reset.energy.testWallet.gold,300);
  for(const key of ['hexrota-match-v4','hexrota-match-v3','hexrota-match-v2','hexrota-events-v1','hexrota-playtest-v1'])assert.equal(f.w.localStorage.getItem(key),null,key+' is cleared rather than migrating back into a new profile');
  assert.equal(f.w.localStorage.getItem(unrelated),'keep me','reset is scoped to Hexrota, never localStorage.clear()');
  f.w.dispatchEvent(new f.w.Event('blur'));f.w.dispatchEvent(new f.w.Event('pagehide'));f.change('#setting-playtest',true);f.click('#playtest-clear');f.click('#playtest-export');f.return();await wait(20);assert.deepEqual(profile(f),reset,'old blur/pagehide/focus/timers cannot resurrect the erased profile');assert.deepEqual(lifecycleErrors,[],'revoked observation callbacks cannot dereference the erased tracker');
  f.close();f=mount({profile:reset});assert.equal(f.d.body.dataset.firstOpening,'true');assert.equal(f.node('#home-play-label').textContent,'Başlayalım');assert.equal(view(f).gold,0);assert.equal(f.life().life.lives,5);assert.equal(f.life().testWallet.gold,300);
  await enter(f);assert.equal(f.save().current,0);assert.equal(f.game().turn,0);assert.equal(f.game().level.id,'learn-1');assert.equal(f.save().variantSelection.serial,1,'the first new tutorial attempt starts from a cleared serial counter');
 }finally{f.close();}
});

if(require.main===module)(async()=>{for(const {name,run}of tests){await run();console.log('PASS '+name);}console.log('Welcome reward and full-reset UI checks passed: '+tests.length+' groups; real app, real canonical saves, no live payments or ads.');})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={tutorialBeforeWin,profile,view};
