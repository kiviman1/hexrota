/* One-clear campaign: actual production UI, canonical profile transactions and immutable migration evidence. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {mount,fresh,lifePool,plain,enter,move,until,wait}=require('./check-lives-ui.cjs');
const PROFILE='hexrota-profile-v2',tests=[];
const reference={window:{},performance};vm.createContext(reference);
for(const file of ['engine.js','levels.js','tutorials.js'])vm.runInContext(fs.readFileSync(__dirname+'/dist/'+file,'utf8'),reference,{filename:file});
const R=reference.window;
function legacyClears(count){
 const saved=fresh(Math.min(11,count+2));saved.done=[0,1];
 for(let i=0;i<count;i++){
  const game=new R.HexMatch(R.HEX_LEVELS[i]);for(const pair of game.level.solution)assert(game.swap(...pair).ok);
  assert.equal(game.status,'won','migration evidence is a replay-validated real win');saved.done.push(i+2);saved.boards[i+2]=plain(game.snapshot());
 }
 return saved;
}
function beforeWin(levelId){const saved=legacyClears(levelId-1),game=new R.HexMatch(R.HEX_LEVELS[levelId-1]);for(const pair of game.level.solution.slice(0,-1))assert(game.swap(...pair).ok);saved.boards[levelId+1]=plain(game.snapshot());return saved;}
const profile=f=>JSON.parse(f.w.localStorage.getItem(PROFILE));
const view=f=>f.w.HexEconomy.createManager(f.w.HEX_ECONOMY_CONFIG).view(f.save().economy);
function indicators(f,expected){for(const [selector,value]of Object.entries(expected)){const nodes=[...f.d.querySelectorAll(selector)];assert(nodes.length>=2,selector+' is exposed in menus');for(const node of nodes)assert.equal(+node.textContent,value,selector+' agrees with committed state');}}
async function win(f){const route=plain(f.game().level.solution);for(const pair of route)await move(f,pair);await until(()=>f.node('#win-dialog').open,'verified win result opens');assert.equal(f.game().status,'won');}
const test=(name,run)=>tests.push({name,run});

test('first verified win grants once across 100 repeated results and forged completed controls',async()=>{
 const f=mount();try{
  assert.equal(view(f).gold,0,'new game Gold is independent of 300 TEST Gold');assert.equal(f.life().testWallet.gold,300);
  await enter(f);await win(f);const won=plain(f.save()),originalProfile=profile(f),manager=f.w.HexEconomy.createManager(f.w.HEX_ECONOMY_CONFIG),attempt=won.attempts[2];
  assert.equal(view(f).gold,20);assert.equal(view(f).stars,1);assert.deepEqual(Array.from(view(f).cleared),[1]);
  indicators(f,{'[data-game-gold]':20,'[data-game-stars]':1,'[data-green-brush]':0,'[data-color-key]':0});
  assert.equal(parseInt(f.node('#win-gold').textContent,10),20);assert.equal(parseInt(f.node('#win-star').textContent,10),1);
  for(let i=0;i<100;i++){
   f.click('#continue');f.click('#review');
   const duplicate=manager.complete(won.economy,{levelId:1,attemptId:attempt.attemptId,status:'won',verified:true,assisted:false,tutorial:false});
   assert.equal(duplicate.applied,false);assert.deepEqual(plain(duplicate.state),won.economy,'duplicate completion is a pure no-op');
  }
  assert.deepEqual(f.save().economy,won.economy,'repeated result callbacks cannot award a second time');
  assert.equal(manager.canEnter(won.economy,1),false,'domain guard rejects completed main level');
  assert.equal(manager.canEnter(won.economy,'1'),false,'numeric and string Level IDs are not aliases');
  assert.equal(f.d.querySelector('[data-stage="2"]'),null);assert.equal(f.d.querySelector('[data-level="2"]'),null);
  // Reinsert controls from an obsolete page/dialog to exercise the command layer, not merely hidden UI.
  for(const attribute of ['data-stage','data-level']){const button=f.d.createElement('button');button.setAttribute(attribute,'2');(attribute==='data-level'?f.node('#levels'):f.d.body).append(button);button.click();button.remove();}
  f.click('#pregame-start');f.click('#reset');f.click('#restart-confirm');
  assert.deepEqual(f.save().boards[2],won.boards[2]);assert.deepEqual(f.save().variantSelection,won.variantSelection);assert.deepEqual(f.save().economy,won.economy);
  assert.equal(f.life().testWallet.gold,originalProfile.energy.testWallet.gold);
 }finally{f.close();}
});

test('verified legacy wins migrate once, ambiguous flags stay closed without invented rewards',async()=>{
 let f=mount({saved:legacyClears(6)});try{
  const initial=plain(f.save()),energy=plain(f.life());assert.equal(view(f).gold,120);assert.equal(view(f).stars,6);assert.equal(view(f).inventory.greenBrush,3);assert.equal(view(f).inventory.colorKey,3);
  assert.equal(energy.testWallet.gold,300,'TEST Gold is not migrated into game Gold');
  f.close();f=mount({saved:initial,life:energy});assert.deepEqual(f.save().economy,initial.economy,'reload cannot run legacy reward migration twice');
  indicators(f,{'[data-game-gold]':120,'[data-game-stars]':6,'[data-green-brush]':3,'[data-color-key]':3});
 }finally{f.close();}
 const ambiguous=mount({saved:fresh(5)});try{
  assert.equal(view(ambiguous).gold,0);assert.equal(view(ambiguous).stars,0);assert.deepEqual(Array.from(view(ambiguous).cleared),[1,2,3]);
  assert(!ambiguous.node('#progression-notice').hidden,'missing evidence has a visible review state');
  for(const stage of [2,3,4])assert.equal(ambiguous.d.querySelector(`[data-stage="${stage}"]`),null,'legacy completed stage cannot reopen while proof is missing');
 }finally{ambiguous.close();}
});

test('a replay-validated legacy won board is recognized even if its historical done flag is missing',()=>{
 const saved=legacyClears(1);saved.done=[0,1];let f=mount({saved});try{
  assert.equal(view(f).gold,20);assert.equal(view(f).stars,1);assert.deepEqual(Array.from(view(f).cleared),[1]);assert.equal(f.d.querySelector('[data-stage="2"]'),null);
  const migrated=plain(f.save()),energy=plain(f.life());f.close();f=mount({saved:migrated,life:energy});assert.deepEqual(f.save().economy,migrated.economy,'the recovered historical win is rewarded once');
 }finally{f.close();}
});

test('milestone gifts are committed with real level-three and level-six wins',async()=>{
 for(const [previous,inventory,expected]of [[2,'greenBrush',3],[5,'colorKey',3]]){
  const f=mount({saved:legacyClears(previous)});try{
   await enter(f);assert.equal(view(f).inventory[inventory],0);await win(f);
   assert.equal(view(f).inventory[inventory],expected);assert.equal(view(f).gold,(previous+1)*20);assert.equal(view(f).stars,previous+1);
   const saved=plain(f.save());f.click('#continue');f.click('#review');assert.deepEqual(f.save().economy,saved.economy,'milestone result is idempotent');
  }finally{f.close();}
 }
});

test('ordinary reset preserves cleared levels, reward ledger and inventory across reload',async()=>{
 let f=mount({saved:legacyClears(6)});try{
  await enter(f);await move(f,plain(f.game().level.solution[0]));const before=plain(f.save()),energy=plain(f.life());
  f.click('#game-home');f.click('#settings');f.click('#settings-reset');f.click('#reset-cancel');assert.deepEqual(f.save(),before);
  f.click('#settings-reset');f.click('#reset-confirm');const after=plain(f.save());
  assert.deepEqual(after.economy,before.economy);assert.deepEqual(after.done.filter(i=>i>=2),before.done.filter(i=>i>=2));assert.deepEqual(after.variantSelection,before.variantSelection,'reset cannot rewind Attempt ID/variant history');assert(!after.boards[8]);
  f.close();f=mount({saved:after,life:energy});assert.deepEqual(f.save().economy,after.economy);assert.equal(f.d.querySelector('[data-stage="2"]'),null);
 }finally{f.close();}
});

test('winning the last incomplete level leads to garden and never loops back to completed play',async()=>{
 const f=mount({saved:legacyClears(9)});try{
  await enter(f);await win(f);assert.equal(view(f).gold,200);assert.equal(view(f).stars,10);assert.equal(view(f).campaignComplete,true);
  f.click('#next');assert.equal(f.d.body.dataset.screen,'garden');assert.match(f.node('#garden-screen').textContent,/Yeni bölümler yakında/i);
  f.click('[data-nav="home"]');assert.match(f.node('#home-play-label').textContent,/Bahçeni gör/i);f.click('#home-play');assert.equal(f.d.body.dataset.screen,'garden');
  assert.equal([...f.d.querySelectorAll('[data-stage]')].filter(node=>+node.dataset.stage>=2).length,0);assert.equal([...f.d.querySelectorAll('[data-level]')].filter(node=>+node.dataset.level>=2).length,0);
 }finally{f.close();}
});

test('winning transaction storage failure preserves board, life, Gold, stars, inventory and events together',async()=>{
 const saved=legacyClears(2),stage=4,game=new R.HexMatch(R.HEX_LEVELS[2]);for(const pair of game.level.solution.slice(0,-1))game.swap(...pair);saved.boards[stage]=plain(game.snapshot());
 const f=mount({saved});try{
  await enter(f);const before=profile(f),events=plain(f.events()),native=f.w.Storage.prototype.setItem;
  f.w.Storage.prototype.setItem=function(key,value){if(key===PROFILE)throw new f.w.DOMException('injected write failure','QuotaExceededError');return native.call(this,key,value);};
  await move(f,plain(game.level.solution.at(-1)));assert.deepEqual(profile(f),before,'failed canonical write leaves no partial completion or reward');assert.deepEqual(f.events(),events,'failed win cannot persist an analytics event');
  f.w.Storage.prototype.setItem=native;f.return();await move(f,plain(game.level.solution.at(-1)));await until(()=>f.node('#win-dialog').open,'the same final move succeeds after storage recovery');assert.equal(view(f).gold,60);assert.equal(view(f).inventory.greenBrush,3);
 }finally{f.close();}
});

test('free tutorial replay at zero lives gives no campaign Gold, stars or inventory',async()=>{
 const f=mount({saved:fresh(),life:lifePool(0)});try{
  const before=plain(f.save().economy);f.click('#home-teach');for(const pair of plain(f.w.HEX_TUTORIALS[0].solution)){const next=f.d.getElementById('coach-next');if(next&&!next.hidden)next.click();await move(f,pair);}
  await until(()=>f.node('#win-dialog').open,'free tutorial is genuinely playable');assert.deepEqual(f.save().economy,before);assert.equal(f.life().life.lives,0);
  assert.equal(f.node('#win-rewards').hidden,true,'tutorial result does not advertise campaign rewards');
 }finally{f.close();}
});

if(require.main===module)(async()=>{for(const {name,run}of tests){await run();console.log('✓ '+name);}await wait(5);console.log('Progression UI checks passed: '+tests.length+' integration groups, 100 duplicate completions, real milestone wins, migration and transactional rollback.');})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={legacyClears,beforeWin};
