/* Stage B: the real UI must atomically connect assistance commands, inventory and replay validation. */
'use strict';
const assert=require('node:assert/strict');
const {mount,plain,enter,move,until,wait}=require('./check-lives-ui.cjs');
const {legacyClears}=require('./check-progression-ui.cjs');
const PROFILE='hexrota-profile-v2',tests=[],test=(name,run)=>tests.push({name,run});
const state=f=>plain(f.save()),profile=f=>JSON.parse(f.w.localStorage.getItem(PROFILE));
const snapshot=f=>state(f).boards[state(f).current];
const economy=f=>f.w.HexEconomy.createManager(f.w.HEX_ECONOMY_CONFIG).view(state(f).economy);
function model(f){
 assert(f.w.HexCommands&&f.w.HexAssistedGame,'the production shell loads the versioned assistance engine');
 const saved=state(f),meta=saved.attempts[saved.current],catalog=f.w.HexAttempts.createCatalog(f.w.HEX_LEVELS,f.w.HEX_VARIANTS,f.w.HexMatch);
 const level=catalog.resolveLevel(meta.levelId,meta.variantId,meta.levelDataVersion),config=f.w.HEX_ECONOMY_CONFIG;
 return new f.w.HexAssistedGame(level,{attemptId:meta.attemptId,limits:{greenBrush:config.inventory.greenBrush.maxPerAttempt,colorKey:config.inventory.colorKey.maxPerAttempt,rescue:config.rescue.maxPerAttempt}},saved.boards[saved.current]);
}
function command(f,item,index,value){const game=model(f);return {id:`assist:${game.attemptId}:${game.commands.length+1}:${item}`,type:item==='greenBrush'?'green_brush':'color_key',index,...item==='colorKey'?{value}:{}};}
function cancelSelection(f){
 if(f.node('#assistance-dialog').open)f.click('#assistance-cancel');
 const target=f.node('#assistance-target-prompt');if(!target.hidden)f.click('#assistance-target-cancel');
 if(f.node('#inventory-dialog').open){const close=f.node('#inventory-dialog').querySelector('[data-close]');assert(close,'inventory has a safe close action');close.click();}
}
function openInventory(f){if(!f.node('#inventory-dialog').open)f.click('#open-inventory');assert(f.node('#inventory-dialog').open);}
function choose(f,item,index){openInventory(f);f.click(item==='greenBrush'?'#use-green-brush':'#use-color-key');f.click(`#board [data-index="${index}"]`);}
function chooseValue(f,value){const select=f.node('#assistance-value');select.value=String(value);select.dispatchEvent(new f.w.Event('input',{bubbles:true}));select.dispatchEvent(new f.w.Event('change',{bubbles:true}));}
async function settled(f){await until(()=>f.node('#board').getAttribute('aria-busy')==='false','assistance presentation settles within the normal budget');}
function keyChoice(game,matching=true){for(let index=0;index<game.total;index++)for(const value of game.level.palette)if(value!==game.values[index]){const preview=game.preview({id:'qa-key-preview',type:'color_key',index,value});if(preview.result.ok&&(matching?preview.result.frames.length:preview.result.frames.length===0))return {index,value};}assert.fail('real level seven has a valid '+(matching?'matching':'nonmatching')+' single-number change');}
function protectedData(saved){return {boards:saved.boards,attempts:saved.attempts,variantSelection:saved.variantSelection,economy:saved.economy};}

test('milestone inventory and level unlocks are shown without mixing game Gold and TEST Gold',async()=>{
 const early=mount({saved:legacyClears(2)});try{await enter(early);openInventory(early);assert.equal(early.node('#use-green-brush').disabled,true);assert.equal(early.node('#use-color-key').disabled,true);assert.equal(economy(early).gold,40);assert.equal(early.life().testWallet.gold,300);}finally{early.close();}
 for(const [clears,brush,key,gold]of [[3,3,0,60],[6,3,3,120]]){
  const f=mount({saved:legacyClears(clears)});try{await enter(f);openInventory(f);assert.equal(+f.node('#inventory-green-brush-stock').textContent,brush);assert.equal(+f.node('#inventory-color-key-stock').textContent,key);assert.equal(f.node('#use-green-brush').disabled,false);assert.equal(f.node('#use-color-key').disabled,key===0);assert.equal(economy(f).gold,gold);assert.equal(f.life().testWallet.gold,300);}finally{f.close();}
 }
});

test('owned campaign assistance cannot be consumed in a free guided tutorial',async()=>{
 const f=mount({saved:legacyClears(6)});try{
  f.click('#home-teach');assert.equal(state(f).current,0);const before=state(f);f.click('#open-inventory');
  if(f.node('#inventory-dialog').open){assert.equal(f.node('#use-green-brush').disabled,true);assert.equal(f.node('#use-color-key').disabled,true);}
  for(const selector of ['#use-green-brush','#use-color-key','#assistance-confirm'])f.click(selector);assert.deepEqual(protectedData(state(f)),protectedData(before),'synthetic tutorial assistance cannot consume campaign inventory or alter its command history');
 }finally{f.close();}
});

test('brush preview and cancellation are observational; a cleared ground target is rejected without stock loss',async()=>{
 const f=mount({saved:legacyClears(3)});try{
  await enter(f);await move(f,plain(model(f).level.solution[0]));const before=state(f),game=model(f),empty=game.layers.findIndex(layer=>layer===0),target=game.layers.findIndex(layer=>layer>0);assert(empty>=0&&target>=0);
  choose(f,'greenBrush',empty);assert.deepEqual(protectedData(state(f)),protectedData(before));assert(!f.node('#assistance-dialog').open||f.node('#assistance-confirm').disabled,'empty terrain cannot be confirmed');cancelSelection(f);
  choose(f,'greenBrush',target);assert(f.node('#assistance-dialog').open);assert.match(f.node('#assistance-dialog').textContent,/Yeşil Fırça/i);assert.deepEqual(protectedData(state(f)),protectedData(before),'preview cannot mutate the command stream or consume inventory');
  f.click('#assistance-cancel');f.click('#assistance-confirm');assert.deepEqual(protectedData(state(f)),protectedData(before),'a canceled dialog callback cannot consume inventory');
 }finally{f.close();}
});

test('brush removes exactly one ground layer once with no move, score, value or RNG change',async()=>{
 const f=mount({saved:legacyClears(3)});try{
  await enter(f);const before=state(f),game=model(f),target=game.layers.findIndex(layer=>layer>0),expected=game.preview(command(f,'greenBrush',target));assert.equal(expected.result.ok,true);
  choose(f,'greenBrush',target);f.click('#assistance-confirm');await settled(f);const actual=snapshot(f);
  assert.deepEqual(actual,plain(expected.snapshot),'the committed assisted envelope equals deterministic command replay');assert.equal(actual.rulesVersion,'assisted-v1');assert.equal(actual.baseRulesVersion,'classic-v4');assert.equal(actual.version,1);
  for(const field of ['values','score','movesLeft','turn','rngState','history'])assert.deepEqual(actual[field],before.boards[before.current][field],'brush preserves '+field);
  const expectedLayers=before.boards[before.current].layers.slice();expectedLayers[target]--;assert.deepEqual(actual.layers,expectedLayers);assert.equal(economy(f).inventory.greenBrush,2);assert.equal(economy(f).gold,60);
  f.click('#assistance-confirm');assert.deepEqual(snapshot(f),actual,'duplicate confirmation cannot append another command');assert.equal(economy(f).inventory.greenBrush,2);
  openInventory(f);assert.equal(f.node('#use-green-brush').disabled,true,'the one-per-attempt cap is visible');const committed=state(f);f.click('#use-green-brush');f.click('#assistance-confirm');assert.deepEqual(protectedData(state(f)),protectedData(committed),'synthetic clicks cannot bypass the attempt cap');
 }finally{f.close();}
});

test('color key requires an explicit other palette number, previews its real cascades and spends zero moves',async()=>{
 const f=mount({saved:legacyClears(6)});try{
  await enter(f);const before=state(f),game=model(f),choice=keyChoice(game),expected=game.preview(command(f,'colorKey',choice.index,choice.value));
  choose(f,'colorKey',choice.index);assert(f.node('#assistance-dialog').open);assert.equal(f.node('#assistance-value').value,'','another number must be deliberately chosen');assert.equal(f.node('#assistance-confirm').disabled,true);
  chooseValue(f,game.values[choice.index]);f.click('#assistance-confirm');assert.deepEqual(protectedData(state(f)),protectedData(before),'same-number/no-selection input is rejected without inventory loss');
  chooseValue(f,choice.value);assert.equal(f.node('#assistance-confirm').disabled,false);assert.match(f.node('#assistance-preview').textContent,/puan/i);assert.match(f.node('#assistance-dialog').textContent,/Renk Anahtarı/i);assert.deepEqual(protectedData(state(f)),protectedData(before));
  const unquoted=game.level.palette.find(value=>value!==game.values[choice.index]&&value!==choice.value);assert.notEqual(unquoted,undefined);f.node('#assistance-value').value=String(unquoted);f.click('#assistance-confirm');assert.deepEqual(protectedData(state(f)),protectedData(before),'changing the selected number without refreshing the preview invalidates its old quote');
  choose(f,'colorKey',choice.index);chooseValue(f,choice.value);
  f.click('#assistance-cancel');assert.deepEqual(protectedData(state(f)),protectedData(before),'canceling a real matching preview is free');choose(f,'colorKey',choice.index);chooseValue(f,choice.value);f.click('#assistance-confirm');await settled(f);
  const actual=snapshot(f);assert.deepEqual(actual,plain(expected.snapshot),'values, waves, refill RNG, score, ground and commands agree with the actual engine preview');assert.equal(actual.movesLeft,before.boards[before.current].movesLeft);assert.equal(actual.turn,before.boards[before.current].turn);assert.deepEqual(actual.history,before.boards[before.current].history);assert(expected.result.scoreGain>0);assert.equal(actual.score,before.boards[before.current].score+expected.result.scoreGain);assert.equal(economy(f).inventory.colorKey,2);
  const committed=state(f);f.click('#assistance-confirm');openInventory(f);assert.equal(f.node('#use-color-key').disabled,true);f.click('#use-color-key');f.click('#assistance-confirm');assert.deepEqual(protectedData(state(f)),protectedData(committed));
 }finally{f.close();}
});

test('an assisted campaign clear still grants its first reward once and labels the permanent result honestly',async()=>{
 const f=mount({saved:legacyClears(3)});try{
  await enter(f);const game=model(f),route=plain(game.level.solution),target=game.layers.findIndex(layer=>layer>0);choose(f,'greenBrush',target);f.click('#assistance-confirm');await settled(f);
  for(const pair of route){if(f.game().status==='won')break;await move(f,pair);}await until(()=>f.node('#win-dialog').open,'assisted certified route genuinely completes');assert.equal(f.game().status,'won');assert.equal(f.node('#win-assisted').hidden,false);assert.equal(economy(f).gold,80);assert.equal(economy(f).stars,4);assert.equal(economy(f).inventory.greenBrush,2);
  const saved=state(f),claim=Object.values(saved.economy.transactions).find(row=>row.kind==='clear'&&row.levelId===4);assert(claim&&claim.assisted,'the permanent completion records that assistance was used');assert.equal(f.d.querySelector('[data-stage="5"]'),null);f.click('#continue');f.click('#review');assert.deepEqual(state(f).economy,saved.economy,'reopening an assisted result cannot duplicate Gold or stars');
 }finally{f.close();}
});

test('a zero-point key result is previewed honestly and applies only after explicit confirmation',async()=>{
 const f=mount({saved:legacyClears(6)});try{
  await enter(f);const before=state(f),game=model(f),choice=keyChoice(game,false),expected=game.preview(command(f,'colorKey',choice.index,choice.value));assert.equal(expected.result.scoreGain,0);assert.equal(expected.result.frames.length,0);
  choose(f,'colorKey',choice.index);chooseValue(f,choice.value);assert.match(f.node('#assistance-preview').textContent,/0\s*puan/i);assert.equal(f.node('#assistance-confirm').disabled,false);assert.deepEqual(protectedData(state(f)),protectedData(before),'showing a zero-point result is still only a preview');
  f.click('#assistance-confirm');await settled(f);assert.deepEqual(snapshot(f),plain(expected.snapshot));assert.equal(snapshot(f).score,before.boards[before.current].score);assert.deepEqual(snapshot(f).layers,before.boards[before.current].layers);assert.equal(snapshot(f).movesLeft,before.boards[before.current].movesLeft);assert.equal(economy(f).inventory.colorKey,2);
 }finally{f.close();}
});

test('70/90 Gold purchases use the game wallet and insufficient funds never debit either wallet',async()=>{
 for(const [item,button,cost]of [['greenBrush','#buy-green-brush',70],['colorKey','#buy-color-key',90]]){
  const f=mount({saved:legacyClears(6)});try{
   await enter(f);openInventory(f);assert.match(f.node(button).textContent,new RegExp(String(cost)));const before=state(f),wallet=plain(f.life().testWallet);f.click(button);
   assert.equal(economy(f).gold,120-cost);assert.equal(economy(f).inventory[item],4);assert.deepEqual(f.life().testWallet,wallet,'inventory never spends TEST Gold');assert.deepEqual(state(f).boards,before.boards,'buying stock does not apply a gameplay command');
   const purchased=state(f);assert.equal(f.node(button).disabled,true);f.click(button);assert.deepEqual(protectedData(state(f)),protectedData(purchased),'insufficient funds block a duplicate synthetic purchase click');
  }finally{f.close();}
 }
});

test('assisted saves restore exactly and cross-ledger/command tampering cannot silently create a fresh attempt',async()=>{
 let f=mount({saved:legacyClears(6)});try{
  await enter(f);const before=state(f),game=model(f),target=game.layers.findIndex(layer=>layer>0);choose(f,'greenBrush',target);f.click('#assistance-confirm');await settled(f);const assisted=state(f),energy=plain(f.life());
  f.close();f=mount({saved:assisted,life:energy,hintDiagnostics:true});await enter(f);assert.deepEqual(snapshot(f),assisted.boards[assisted.current]);assert.deepEqual(state(f).economy,assisted.economy);assert.deepEqual(plain(model(f).snapshot()),assisted.boards[assisted.current],'restoring actually replays the mixed command stream');
  const beforeHint=protectedData(state(f));assert.equal(f.d.querySelector('#hint'),null,'manual hint control stays removed');f.w.HexHintTestAdapter.request();await until(()=>f.d.querySelectorAll('#board .hinted').length===2,'assisted continuation can still request a legal bounded hint');assert.deepEqual(protectedData(state(f)),beforeHint,'hinting cannot mutate assisted commands, inventory, RNG or the board');const hinted=[...f.d.querySelectorAll('#board .hinted')].map(node=>+node.dataset.index);assert(model(f).legalMoves().some(pair=>pair.includes(hinted[0])&&pair.includes(hinted[1])));assert.notEqual(f.events().events.filter(event=>event.name==='hint_used').at(-1).hintKind,'proven_route','changed command history is not labeled as the original certified swap route');
  const cases=[
   saved=>{saved.economy=plain(before.economy);},
   saved=>{saved.boards[saved.current]=plain(before.boards[before.current]);},
   saved=>{saved.boards[saved.current].commands.pop();},
   saved=>{saved.boards[saved.current].limits.greenBrush=2;}
  ];
  for(const mutate of cases){const bad=plain(assisted);mutate(bad);assert.throws(()=>mount({saved:bad,life:energy}),/Assisted|assisted|inventory|command|limits/i,'the isolated test host surfaces the exact startup refusal; the real browser verifies saved bytes and blocked UI');}
 }finally{f.close();}
});

test('an assistance write failure rolls back inventory, command, board, life and events together',async()=>{
 const f=mount({saved:legacyClears(3)});try{
  await enter(f);const game=model(f),target=game.layers.findIndex(layer=>layer>0);choose(f,'greenBrush',target);const before=profile(f),events=plain(f.events()),native=f.w.Storage.prototype.setItem;
  f.w.Storage.prototype.setItem=function(key,value){if(key===PROFILE)throw new f.w.DOMException('injected inventory write failure','QuotaExceededError');return native.call(this,key,value);};
  f.click('#assistance-confirm');await settled(f);assert.deepEqual(profile(f),before);assert.deepEqual(f.events(),events,'a rejected assistance transaction cannot persist a command event');
  f.w.Storage.prototype.setItem=native;f.return();cancelSelection(f);choose(f,'greenBrush',target);f.click('#assistance-confirm');await settled(f);assert.equal(economy(f).inventory.greenBrush,2);assert.equal(snapshot(f).usage.greenBrush,1);
 }finally{f.close();}
});

test('leaving a preview or racing a newer profile revision cannot spend an obsolete preview',async()=>{
 const f=mount({saved:legacyClears(6)});try{
  await enter(f);const target=model(f).layers.findIndex(layer=>layer>0);choose(f,'greenBrush',target);const before=state(f);f.click('#game-home');for(const selector of ['#buy-green-brush','#buy-color-key','#assistance-confirm'])f.click(selector);assert.deepEqual(protectedData(state(f)),protectedData(before),'leaving the game invalidates the pending target and even affordable purchase callbacks');
  await enter(f);cancelSelection(f);choose(f,'greenBrush',target);const authoritative=profile(f);authoritative.revision++;f.w.localStorage.setItem(PROFILE,JSON.stringify(authoritative));f.click('#assistance-confirm');await settled(f);assert.deepEqual(profile(f),authoritative,'CAS rejects a preview captured before another profile revision');
 }finally{f.close();}
});

if(require.main===module)(async()=>{for(const {name,run}of tests){await run();console.log('✓ '+name);}await wait(5);console.log('Inventory UI checks passed: '+tests.length+' integration groups using real command previews, strict replay, costs, caps and atomic rollback.');})().catch(error=>{console.error(error);process.exitCode=1;});
