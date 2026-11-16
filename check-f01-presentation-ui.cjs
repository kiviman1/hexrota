/* F-01: real application commands commit once; visual completion owns no profile write. */
'use strict';
const assert=require('node:assert/strict');
const {mount,existing,plain,enter,move,until,wait}=require('./check-lives-ui.cjs');
const {legacyClears,beforeWin}=require('./check-progression-ui.cjs');
const PROFILE='hexrota-profile-v2',EVENTS='hexrota-events-v1',tests=[],results=[],browserErrors=[],unhandled=[];
const test=(name,run)=>tests.push({name,run});
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const profile=f=>JSON.parse(f.w.localStorage.getItem(PROFILE));
const eventRows=f=>JSON.parse(f.w.localStorage.getItem(EVENTS)||'{"events":[]}').events;

// Observe the public production state factory. Neither game rules nor the host's
// command/commit/finisher are replaced or exposed as a private testing API.
function fixture({saved=existing(2,{turns:1}).saved,reduced=true,animationFault=0}={}){
 saved=plain(saved);saved.preferences={...saved.preferences,motion:reduced?'reduce':'full'};
 const observed={store:null,events:[],animations:[],animationCalls:0};
 const f=mount({saved,beforeApp(w){
  const Core=w.HexAppState;
  w.HexAppState=Object.freeze({...Core,create(options){
   const store=Core.create(options);observed.store=store;
   observed.unsubscribe=store.subscribe((result,previous,event)=>{
    if(event.type.startsWith('OPERATION_'))observed.events.push({event:plain(event),state:plain(result.state)});
   });return store;
  }});
 }});
 f.w.matchMedia=()=>({matches:reduced,addEventListener(){},removeEventListener(){}});
 f.w.Element.prototype.animate=function(frames,options={}){
  observed.animationCalls++;if(observed.animationCalls===animationFault)throw Error('F-01 optional animation failure');
  const animation={target:this,frames,options,cancelled:false,cancel(){this.cancelled=true;},finish(){},addEventListener(){},removeEventListener(){}};
  observed.animations.push(animation);return animation;
 };
 f.w.Element.prototype.getAnimations=function(){return observed.animations.filter(animation=>animation.target===this&&!animation.cancelled);};
 f.w.addEventListener('error',event=>browserErrors.push(event.error?.message||event.message));
 f.observed=observed;f.begin=pair=>{for(const index of pair)f.click(`#board [data-index="${index}"]`);};
 f.idle=()=>until(()=>f.node('#board').getAttribute('aria-busy')==='false','real presentation releases board input',4500);
 const close=f.close;f.close=()=>{observed.unsubscribe?.();close();};return f;
}
function recordWrites(f,{failAt=0}={}){
 const native=f.w.Storage.prototype.setItem,record={attempts:0,successes:0,rejections:0,rows:[],failAt};
 f.w.Storage.prototype.setItem=function(key,value){
  if(key!==PROFILE)return native.call(this,key,value);
  record.attempts++;const row={attempt:record.attempts,revision:JSON.parse(value).revision};record.rows.push(row);
  if(record.attempts===record.failAt){record.rejections++;row.rejected=true;throw new f.w.DOMException('F-01 canonical write fault '+record.attempts,'QuotaExceededError');}
  const result=native.call(this,key,value);record.successes++;return result;
 };
 record.restore=()=>{f.w.Storage.prototype.setItem=native;};return record;
}
function report(name,record,extra={}){const row={case:name,attempts:record.attempts,successes:record.successes,rejections:record.rejections,...extra};results.push(row);console.log('COUNTS '+JSON.stringify(row));}
function clean(f){
 assert.equal(f.node('#board').getAttribute('aria-busy'),'false');assert.equal(f.node('#board-stage').classList.contains('busy'),false);
 assert.equal(f.node('#reset').disabled,false);assert.equal(f.node('#skip-animation').hidden,true);
 assert.equal(f.d.querySelector('#board .swap-pair'),null,'no owned moving stones survive completion');
 assert.equal(f.d.querySelectorAll('#board [data-swap-hidden],#board .swap-hidden').length,0,'no stone source stays hidden');
 for(const gem of f.d.querySelectorAll('#board [data-index] .gem')){assert.notEqual(gem.style.visibility,'hidden');assert.notEqual(gem.getAttribute('visibility'),'hidden');}
 const operation=f.observed.store.snapshot().operations.presentation;
 assert(!operation||!['requested','pending'].includes(operation.status),'the public UI operation is settled');
 if(operation)assert.equal(f.observed.store.isCurrentOperation(operation.token),false,'a settled visual token cannot accept late callbacks');
}
function nonterminalMove(f,{cascades=0}={}){
 const game=f.game();
 for(const pair of game.legalMoves()){
  const expected=game.clone(),result=expected.swap(...pair);
  if(result.ok&&expected.status==='playing'&&result.frames.length>=cascades)return {pair:plain(pair),expected,result};
 }
 assert.fail('the real fixture has a nonterminal valid move with '+cascades+' waves');
}
function exact(f,expected,stage=f.save().current){
 assert.deepEqual(profile(f).game.boards[stage],plain(expected.snapshot()),'canonical board, history, score, RNG and moves equal the actual engine');
 assert.deepEqual(f.save().boards[stage],plain(expected.snapshot()),'the compatibility checkpoint agrees with canonical storage');
 assert.deepEqual(plain(f.game().snapshot()),plain(expected.snapshot()),'normal production restore replays the exact command');
}
async function pointerSwap(f,pair,{settle=true}={}){
 let hit=pair[0];f.d.elementFromPoint=()=>f.node(`#board [data-index="${hit}"]`);
 for(const [type,index,x]of [['pointerdown',pair[0],100],['pointerup',pair[1],160]]){
  hit=index;const event=new f.w.Event(type,{bubbles:true,cancelable:true});
  Object.assign(event,{pointerId:1,pointerType:'touch',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:100});
  f.node(`#board [data-index="${index}"]`).dispatchEvent(event);
 }
 if(settle)await f.idle();
}
function winningInvariant(f,before,expected,stage){
 const after=profile(f),attempt=after.game.attempts[stage].attemptId;
 assert.deepEqual(after.game.boards[stage],plain(expected.snapshot()));assert.deepEqual(after.game.attempts[stage],before.game.attempts[stage]);
 assert.deepEqual(after.game.variantSelection,before.game.variantSelection);
 assert.equal(after.game.economy.gold,before.game.economy.gold+20);assert.equal(after.game.economy.stars,before.game.economy.stars+1);
 assert.equal(Object.values(after.game.economy.transactions).filter(row=>row.kind==='clear'&&row.levelId===expected.level.id).length,1);
 assert.equal(after.energy.life.lives,before.energy.life.lives);
 const settlement=after.energy.life.settledAttempts[attempt];assert.equal(settlement.outcome,'won');assert.equal(settlement.charged,false);
 assert.equal(Object.keys(after.energy.life.settledAttempts).length,Object.keys(before.energy.life.settledAttempts).length+1);
 assert.equal(eventRows(f).filter(row=>row.name==='level_completed'&&row.attemptId===attempt).length,1);
 return after;
}

for(const reduced of [true,false])test('A '+(reduced?'reduced motion':'natural animated finish')+' makes one canonical write for a real valid move',async()=>{
 const f=fixture({reduced});let record;try{
  await enter(f);const before=profile(f),stage=before.game.current,{pair,expected}=nonterminalMove(f);record=recordWrites(f);
  await move(f,pair);await wait(5);clean(f);exact(f,expected,stage);
  assert.deepEqual(profile(f).energy,before.energy);assert.deepEqual(profile(f).game.economy,before.game.economy);
  report('A-'+(reduced?'reduce':'animated'),record,{revisionDelta:profile(f).revision-before.revision,turn:expected.turn});
  assert.equal(record.attempts,1,'animation completion must not attempt a second canonical PROFILE write');assert.equal(record.successes,1);
  assert.equal(profile(f).revision,before.revision+1);assert.equal(f.observed.animationCalls>0,!reduced);
 }finally{record?.restore();f.close();}
});

test('B a hypothetical second-write quota fault is unused and the next valid input needs no focus recovery',async()=>{
 const f=fixture();let record;try{
  await enter(f);const before=profile(f),stage=before.game.current,first=nonterminalMove(f);record=recordWrites(f,{failAt:2});
  await move(f,first.pair);await wait(5);const firstCounts={attempts:record.attempts,successes:record.successes,rejections:record.rejections};
  const committed=profile(f);assert.deepEqual(committed.game.boards[stage],plain(first.expected.snapshot()));assert.deepEqual(committed.energy,before.energy);
  record.failAt=0;const next=nonterminalMove(f);await move(f,next.pair);await wait(5);clean(f);
  report('B-second-fault',record,{first:firstCounts,expectedTurn:next.expected.turn,actualTurn:f.game().turn});
  assert.deepEqual(firstCounts,{attempts:1,successes:1,rejections:0},'there is no post-presentation write for the injected second fault to reject');
  exact(f,next.expected,stage);assert.equal(record.attempts,2,'two real moves each write once without a lifecycle recovery action');
 }finally{record?.restore();f.close();}
});

for(const terminal of [false,true])test('C first authoritative '+(terminal?'winning':'playing')+' write failure preserves complete rollback',async()=>{
 const f=fixture({saved:terminal?beforeWin(1):existing(2,{turns:1}).saved});let record;try{
  await enter(f);const before=profile(f),events=plain(f.events()),stage=before.game.current;
  const pair=terminal?plain(f.game().level.solution.at(-1)):nonterminalMove(f).pair,expected=f.game().clone();assert(expected.swap(...pair).ok);
  record=recordWrites(f,{failAt:1});await move(f,pair);await wait(5);clean(f);
  assert.deepEqual(profile(f),before,'no partial board, reward, life, attempt, inventory or revision survives the rejected command');
  assert.deepEqual(f.save(),before.game);assert.deepEqual(f.life(),before.energy);assert.deepEqual(f.events(),events);
  assert.equal(f.node('#win-dialog').open,false);assert.equal(f.observed.events.filter(row=>row.event.type==='OPERATION_PENDING').length,0);
  report('C-first-failure-'+(terminal?'win':'playing'),record,{revisionDelta:profile(f).revision-before.revision});
  assert.deepEqual([record.attempts,record.successes,record.rejections],[1,0,1]);
  record.restore();record=null;f.return();await move(f,pair);exact(f,expected,stage);
  if(terminal)await until(()=>f.node('#win-dialog').open,'a real retry still presents victory after first-write recovery');
 }finally{record?.restore();f.close();}
});

test('D a real winning move commits one reward, terminal event and uncharged life settlement then shows victory',async()=>{
 const f=fixture({saved:beforeWin(1)});let record;try{
  await enter(f);const before=profile(f),stage=before.game.current,pair=plain(f.game().level.solution.at(-1)),expected=f.game().clone();assert(expected.swap(...pair).ok);assert.equal(expected.status,'won');
  record=recordWrites(f,{failAt:2});await move(f,pair);await wait(110);clean(f);
  const after=winningInvariant(f,before,expected,stage);
  report('D-win',record,{gold:after.game.economy.gold,stars:after.game.economy.stars,screen:f.d.body.dataset.screen,victoryOpen:f.node('#win-dialog').open});
  assert.equal(record.attempts,1);assert.equal(record.rejections,0);assert.equal(f.d.body.dataset.screen,'game');assert.equal(f.node('#win-dialog').open,true,'presentation failure must not send the committed winner Home');
  assert.doesNotMatch(f.node('#toast').textContent,/kaydedilemedi|güvenli kayda/,'a successful command does not display a storage rollback warning');
  for(let i=0;i<5;i++)f.click('#continue');assert.deepEqual(profile(f).game.economy,after.game.economy);assert.equal(record.attempts,1,'repeated result display has no canonical write');
  assert.equal(eventRows(f).filter(row=>row.name==='level_completed').length,1,'late result display cannot duplicate the terminal event');
 }finally{record?.restore();f.close();}
});

function assistedModel(f){
 const saved=f.save(),stage=saved.current,metadata=saved.attempts[stage],config=f.w.HEX_ECONOMY_CONFIG;
 const catalog=f.w.HexAttempts.createCatalog(f.w.HEX_LEVELS,f.w.HEX_VARIANTS,f.w.HexMatch),level=catalog.resolveLevel(metadata.levelId,metadata.variantId,metadata.levelDataVersion);
 return new f.w.HexAssistedGame(level,{attemptId:metadata.attemptId,limits:{greenBrush:config.inventory.greenBrush.maxPerAttempt,colorKey:config.inventory.colorKey.maxPerAttempt,rescue:config.rescue.maxPerAttempt}},saved.boards[stage]);
}
function assistanceChoice(f,item){
 const model=assistedModel(f);
 if(item==='greenBrush')return {index:model.layers.findIndex(layer=>layer>0)};
 for(let index=0;index<model.total;index++)for(const value of model.level.palette)if(value!==model.values[index]){
  const preview=model.preview({id:'f01-choice',type:'color_key',index,value});if(preview.result.ok&&preview.result.frames.length&&preview.status==='playing')return {index,value};
 }
 assert.fail('the real color-key fixture has a matching nonterminal command');
}
function chooseAssistance(f,item,choice){
 if(!f.node('#inventory-dialog').open)f.click('#open-inventory');f.click(item==='greenBrush'?'#use-green-brush':'#use-color-key');
 f.click(`#board [data-index="${choice.index}"]`);assert(f.node('#assistance-dialog').open,'actual inventory UI opens its command preview');
 if(item==='colorKey'){
  const select=f.node('#assistance-value');select.value=String(choice.value);select.dispatchEvent(new f.w.Event('input',{bubbles:true}));select.dispatchEvent(new f.w.Event('change',{bubbles:true}));
 }
 assert.equal(f.node('#assistance-confirm').disabled,false);
 const model=assistedModel(f),command={id:`assist:${model.attemptId}:${model.commands.length+1}:${item}`,type:item==='greenBrush'?'green_brush':'color_key',index:choice.index,...item==='colorKey'?{value:choice.value}:{}};
 const expected=model.preview(command);assert(expected.result.ok);return expected;
}
for(const item of ['greenBrush','colorKey'])test('E '+item+' real UI command debits once, retains its ID/history and strictly replays after visual finish',async()=>{
 const f=fixture({saved:legacyClears(6)});let record;try{
  await enter(f);await move(f,nonterminalMove(f).pair);const before=profile(f),stage=before.game.current,history=plain(assistedModel(f).commands),choice=assistanceChoice(f,item),expected=chooseAssistance(f,item,choice);record=recordWrites(f,{failAt:2});
  f.click('#assistance-confirm');await f.idle();await wait(5);clean(f);const after=profile(f),actual=after.game.boards[stage];
  assert.deepEqual(actual,plain(expected.snapshot));assert.deepEqual(plain(assistedModel(f).snapshot()),actual,'restoring invokes strict command replay');
  assert.equal(actual.usage[item],1);assert.equal(actual.commands.filter(row=>row.id===expected.result.commandId).length,1);
  assert(history.length>0,'assistance follows a real committed move');assert.deepEqual(actual.commands.slice(0,-1),history,'assistance retains the existing swap command IDs and order');
  assert.equal(after.game.economy.inventory[item],before.game.economy.inventory[item]-1);
  assert.equal(actual.movesLeft,before.game.boards[stage].movesLeft);assert.equal(actual.turn,before.game.boards[stage].turn);assert.deepEqual(actual.history,before.game.boards[stage].history);
  assert.deepEqual(after.game.attempts,before.game.attempts);assert.deepEqual(after.energy,before.energy);
  assert.equal(eventRows(f).filter(row=>row.name==='booster_used'&&row.boosterId===item).length,1);
  const rows=Object.entries(after.game.economy.transactions).filter(([id])=>id===expected.result.commandId);assert.equal(rows.length,1,'inventory transaction and command retain the same operation ID');
  assert.equal(rows[0][1].kind,'use');assert.equal(rows[0][1].itemId,item);assert.equal(rows[0][1].attemptId,actual.attemptId);
  report('E-'+item,record,{commands:actual.commands.length,usage:actual.usage[item],stock:after.game.economy.inventory[item]});
  assert.deepEqual([record.attempts,record.successes,record.rejections],[1,1,0]);
  f.click('#assistance-confirm');assert.deepEqual(profile(f),after,'a stale confirm does not replay or debit the committed command');
 }finally{record?.restore();f.close();}
});
for(const item of ['greenBrush','colorKey'])test('E '+item+' first-write failure rolls back command, inventory, board, life and local events atomically',async()=>{
 const f=fixture({saved:legacyClears(6)});let record;try{
  await enter(f);await move(f,nonterminalMove(f).pair);const choice=assistanceChoice(f,item);chooseAssistance(f,item,choice);const before=profile(f),events=plain(f.events()),pendingBefore=f.observed.events.filter(row=>row.event.type==='OPERATION_PENDING').length;record=recordWrites(f,{failAt:1});
  f.click('#assistance-confirm');await f.idle();await wait(5);clean(f);assert.deepEqual(profile(f),before);assert.deepEqual(f.save(),before.game);assert.deepEqual(f.life(),before.energy);assert.deepEqual(f.events(),events);
  assert.equal(f.observed.events.filter(row=>row.event.type==='OPERATION_PENDING').length,pendingBefore,'the rejected assistance command publishes no new pending success');
  report('E-first-failure-'+item,record);assert.deepEqual([record.attempts,record.successes,record.rejections],[1,0,1]);
  record.restore();record=null;f.return();const expected=chooseAssistance(f,item,choice);f.click('#assistance-confirm');await f.idle();assert.deepEqual(profile(f).game.boards[before.game.current],plain(expected.snapshot));
  assert.equal(profile(f).game.economy.inventory[item],before.game.economy.inventory[item]-1);
 }finally{record?.restore();f.close();}
});

test('F a synthetic pointer win keeps its local terminal event through a later legitimate preference write',async()=>{
 const f=fixture({saved:beforeWin(1)});let record;try{
  await enter(f);const before=profile(f),stage=before.game.current,pair=plain(f.game().level.solution.at(-1)),expected=f.game().clone();assert(expected.swap(...pair).ok);
  record=recordWrites(f,{failAt:2});await pointerSwap(f,pair);await wait(110);
  const committed=winningInvariant(f,before,expected,stage),terminal=plain(eventRows(f).find(row=>row.name==='level_completed'));
  const presentationWrites=record.attempts;record.failAt=0;const previousSound=committed.game.sound;f.click('#sound');await wait(5);
  const after=profile(f),afterTerminal=eventRows(f).filter(row=>row.name==='level_completed'&&row.attemptId===terminal.attemptId);
  report('F-pointer-terminal',record,{presentationWrites,terminalBefore:1,terminalAfter:afterTerminal.length,legitimatePreferenceWrites:record.attempts-presentationWrites});
  assert.deepEqual(afterTerminal,[terminal],'a later real setting commit cannot rewind the committed pointer terminal event');
  assert.equal(after.game.sound,!previousSound);assert.equal(after.revision,committed.revision+1);assert.deepEqual(after.game.boards[stage],plain(expected.snapshot()));assert.deepEqual(after.game.economy,committed.game.economy);assert.deepEqual(after.energy,committed.energy);
  assert.equal(presentationWrites,1);assert.equal(record.attempts,2,'the move and the explicit preference change each own one write');
 }finally{record?.restore();f.close();}
});

// Fail the actual DOM setter once, only after the canonical command is pending.
// The host's real finisher and its error recovery still run unchanged.
for(const selector of ['#levels','#board'])test('G optional finisher render failure at '+selector+' cleans up without persistence or blocking the next move',async()=>{
 const f=fixture({reduced:false});let record,restoreDOM;try{
  await enter(f);const before=profile(f),stage=before.game.current,first=nonterminalMove(f);record=recordWrites(f,{failAt:2});f.begin(first.pair);
  assert.equal(f.observed.store.snapshot().operations.presentation.status,'pending');
  const node=f.node(selector),descriptor=Object.getOwnPropertyDescriptor(f.w.Element.prototype,'innerHTML');let injected=0;
  const fault={configurable:true,get(){return descriptor.get.call(this);},set(value){
   const operation=f.observed.store.snapshot().operations.presentation;
   if(!injected&&(!operation||!['requested','pending'].includes(operation.status))){injected++;throw Error('F-01 optional finish rendering failure');}return descriptor.set.call(this,value);
  }};
  if(selector==='#board'){
   // The real reconciler parses a detached SVG projection rather than assigning
   // board.innerHTML. Fault its actual DOM setter; never mock the view/finisher.
   const create=f.d.createElementNS;
   f.d.createElementNS=function(...args){const element=create.apply(this,args);if(element.localName==='svg'&&!element.isConnected)Object.defineProperty(element,'innerHTML',fault);return element;};
   restoreDOM=()=>{f.d.createElementNS=create;};
  }else{Object.defineProperty(node,'innerHTML',fault);restoreDOM=()=>{delete node.innerHTML;};}
  f.click('#skip-animation');await f.idle();await wait(5);clean(f);assert.equal(injected,1,'the optional final render actually throws');
  assert.deepEqual(profile(f).game.boards[stage],plain(first.expected.snapshot()));assert.deepEqual(profile(f).energy,before.energy);
  const firstCounts={attempts:record.attempts,rejections:record.rejections};restoreDOM();restoreDOM=null;record.failAt=0;
  const next=nonterminalMove(f);f.begin(next.pair);f.click('#skip-animation');await f.idle();await wait(5);clean(f);
  report('G-render-'+selector.slice(1),record,{first:firstCounts,expectedTurn:next.expected.turn,actualTurn:f.game().turn});
  assert.deepEqual(firstCounts,{attempts:1,rejections:0},'optional rendering failure does not enter canonical persistence failure recovery');exact(f,next.expected,stage);assert.equal(record.attempts,2);
  assert.doesNotMatch(f.node('#toast').textContent,/kaydedilemedi|güvenli kayda/);
 }finally{restoreDOM?.();record?.restore();f.close();}
});

test('guards rapid input reveals one committed move and canceled callbacks cannot duplicate it',async()=>{
 const f=fixture({reduced:false});let record;try{
  await enter(f);const stage=f.save().current,first=nonterminalMove(f);record=recordWrites(f);f.begin(first.pair);
  assert(f.d.querySelector('#board .swap-pair'));f.click(`#board [data-index="${first.pair[0]}"]`);clean(f);exact(f,first.expected,stage);
  const afterReveal=record.attempts,next=nonterminalMove(f);f.begin(next.pair);f.click('#skip-animation');await f.idle();await wait(380);clean(f);exact(f,next.expected,stage);
  report('guards-rapid-cancel',record,{afterReveal,turn:next.expected.turn});assert.equal(afterReveal,1);assert.equal(record.attempts,2);
  assert(f.observed.animations.some(animation=>animation.cancelled));assert.equal(f.observed.events.filter(row=>row.event.type==='OPERATION_PENDING').length,2);
 }finally{record?.restore();f.close();}
});

for(const action of ['home','pause','visibility','motion'])test('guards '+action+' during presentation preserves command and counts its legitimate write separately',async()=>{
 const f=fixture({reduced:false});let record;try{
  await enter(f);const before=profile(f),stage=before.game.current,first=nonterminalMove(f,{cascades:action==='pause'?3:0});record=recordWrites(f);f.begin(first.pair);
  if(action==='pause')await until(()=>/2\. zincir/.test(f.node('#last-combo').textContent),'a real multiwave presentation reaches its second visible cascade',4500);
  const afterCommand=record.attempts;assert.equal(afterCommand,1);
  if(action==='home')f.click('#game-home');
  if(action==='pause')f.click('#pause');
  if(action==='visibility'){Object.defineProperty(f.d,'hidden',{configurable:true,value:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));}
  if(action==='motion'){const select=f.node('#setting-motion');select.value='reduce';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));}
  await f.idle();await wait(30);clean(f);assert.deepEqual(profile(f).game.boards[stage],plain(first.expected.snapshot()));assert.deepEqual(profile(f).energy,before.energy);
  report('guards-'+action,record,{commandWrites:afterCommand,legitimateActionWrites:record.attempts-afterCommand,waves:first.result.frames.length});
  assert.equal(record.attempts,2,'the explicit navigation, pause, lifecycle or preference action still retains its own profile write');
  if(action==='home')assert.equal(f.d.body.dataset.screen,'home');if(['pause','visibility'].includes(action))assert.equal(f.node('#pause-dialog').open,true);if(action==='motion')assert.equal(profile(f).game.preferences.motion,'reduce');
  await wait(25);assert.equal(record.attempts,2,'retired animation callbacks never add profile writes');
 }finally{record?.restore();f.close();}
});

for(const animationFault of [1,2])test('guards animation API failure '+animationFault+' retains the one committed move and releases input',async()=>{
 const f=fixture({reduced:false,animationFault});let record;try{
  await enter(f);const stage=f.save().current,{pair,expected}=nonterminalMove(f);record=recordWrites(f);await move(f,pair);await wait(5);clean(f);exact(f,expected,stage);
  report('guards-animation-fault-'+animationFault,record,{animationCalls:f.observed.animationCalls});assert.equal(record.attempts,1);assert.equal(record.rejections,0);
 }finally{record?.restore();f.close();}
});

async function run(){
 let failures=0;for(const {name,run:check}of tests)try{await check();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+'\n'+error.stack);}
 await wait(5);assert.deepEqual(browserErrors,[],'no uncaught browser errors');assert.deepEqual(unhandled,[],'no unhandled presentation errors');
 console.log(`F-01 presentation UI checks: ${tests.length-failures}/${tests.length} actual-app groups passed; ${results.length} canonical-write observations.`);
 if(failures)process.exitCode=1;return {groups:tests.length,failures,results};
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={fixture,recordWrites,profile,eventRows,pointerSwap,nonterminalMove,assistedModel,assistanceChoice,chooseAssistance,clean,run};
