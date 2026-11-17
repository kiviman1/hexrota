/* Stage-A behavior contract against the real application, before state migration.
 * Reuses canonical fixtures; no private app variables or future state API required.
 * JSDOM does not prove native dialog focus, pixels, layout, or a physical device.
 */
'use strict';
const assert=require('node:assert/strict');
const {mount,fresh,existing,lifePool,plain,enter,move,until,wait,NOW}=require('./check-lives-ui.cjs');
const {tutorialBeforeWin}=require('./check-welcome-reset-ui.cjs');
const {beforeWin}=require('./check-progression-ui.cjs');
const {lost,S,proofFor}=require('./check-second-chance-ui.cjs');
const PROFILE='hexrota-profile-v2',tests=[],unhandled=[],browserErrors=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const test=(name,run)=>tests.push({name,run});
const profile=f=>JSON.parse(f.w.localStorage.getItem(PROFILE));
const dialogs=f=>[...f.d.querySelectorAll('dialog[open]')].map(node=>node.id).sort();
const key=(f,value)=>f.w.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
function observed(options){const f=mount(options);f.w.addEventListener('error',event=>browserErrors.push(event.error?.message||event.message));return f;}
function authority(f){
 const p=profile(f),g=p.game;
 return plain({current:g.current,done:g.done,boards:g.boards,attempts:g.attempts,attemptStats:g.attemptStats,
  variantSelection:g.variantSelection,economy:g.economy,rescue:g.rescue,records:g.records,energy:p.energy});
}
function screen(f,name){
 assert.equal(f.d.body.dataset.screen,name);
 for(const value of ['home','journey','game','records','garden']){
  const node=f.node('#'+value+'-screen');assert.equal(node.hidden,value!==name);assert.equal(node.inert,value!==name);
 }
}
function portraitOnly(f){
 assert.equal(f.node('#tutorial-coach').hidden,false);
 assert.equal(f.d.querySelectorAll('#tutorial-coach > .hx-tavik-dialogue').length,1);
 assert.equal(f.node('.hx-tavik-dialogue').hidden,false);
 // Images do not decode in this host: actual painted exclusion is separately
 // checked by check-scene-browser, including late image/fallback completion.
 assert.equal(f.node('.hx-scene-actor-anchor').hidden,true);
 assert.equal(f.d.querySelectorAll('#tutorial-coach').length,1);
}
function playingPair(f){
 const game=f.game();const pair=game.legalMoves().find(pair=>{const next=game.clone();return next.swap(...pair).ok&&next.status==='playing';});
 assert(pair,'the fixture has a real nonterminal legal move');return plain(pair);
}
function failWrites(f){
 const native=f.w.Storage.prototype.setItem;
 f.w.Storage.prototype.setItem=function(key,value){if(key===PROFILE)throw new f.w.DOMException('characterization canonical quota','QuotaExceededError');return native.call(this,key,value);};
 return()=>{f.w.Storage.prototype.setItem=native;};
}

test('tutorial selection and dialogue acknowledgment preserve the SVG and all gameplay/economy authority',async()=>{
 const f=observed({saved:fresh(0)});try{
  screen(f,'home');await enter(f);screen(f,'game');portraitOnly(f);
  const board=f.node('#board'),first=authority(f),pair=plain(f.w.HEX_TUTORIALS[0].solution[0]);
  assert.equal(f.node('.tutorial-build-counter').textContent,'Tahta 0/3');
  f.click('#board [data-index="'+pair[0]+'"]');
  assert.deepEqual(authority(f),first,'selecting a stone only changes presentation');assert.equal(f.node('#board'),board);
  await move(f,[pair[1]]);assert.equal(f.game().turn,1);assert.equal(f.game().score,6);
  assert.equal(f.node('.tutorial-build-counter').textContent,'Tahta 1/3');assert.equal(f.node('#coach-next').hidden,false);portraitOnly(f);
  const acknowledged=authority(f),beforeAcks=plain(f.save().guideAcks);
  f.click('#coach-next');assert.deepEqual(authority(f),acknowledged,'acknowledgment changes no board/RNG/life/Gold/attempt');
  assert.equal(f.node('#board'),board,'the same SVG container remains mounted');assert.equal(f.node('#coach-next').hidden,true);portraitOnly(f);
  assert.equal(f.save().guideAcks.length,beforeAcks.length+1,'the existing durable tutorial acknowledgment is retained');
  const after=plain(f.save());f.click('#coach-next');assert.deepEqual(f.save(),after,'duplicate acknowledgment is a no-op');
 }finally{f.close();}
});

test('T1 result transitions to T2 through the existing preview-free handoff without awarding welcome Gold',async()=>{
 const f=observed({saved:tutorialBeforeWin(0)});try{
  await enter(f);const board=f.node('#board');if(!f.node('#coach-next').hidden)f.click('#coach-next');
  await move(f,plain(f.w.HEX_TUTORIALS[0].solution.at(-1)));await until(()=>f.node('#win-dialog').open,'T1 result opens');
  assert.equal(f.game().status,'won');assert.equal(f.save().economy.gold,0);assert.equal(f.save().economy.stars,0);
  f.click('#next');await until(()=>f.save().current===1,'T2 starts');screen(f,'game');
  assert.equal(f.node('#board'),board);assert.equal(f.node('#pregame-dialog').open,false);assert.equal(f.node('.tutorial-build-counter').textContent,'Çivi 0/4');
  assert(f.save().done.includes(0));assert.equal(f.game().turn,0);assert.equal(f.game().level.id,'learn-2');portraitOnly(f);
 }finally{f.close();}
});

test('nested pause/settings/reset close top-first through Escape and Back without changing the saved attempt',async()=>{
 const f=observed({saved:existing(2,{turns:1}).saved});try{
  await enter(f);const before=authority(f),board=f.node('#board'),pair=playingPair(f);
  f.click('#pause');f.click('#pause-settings');f.click('#settings-reset');screen(f,'game');
  assert.deepEqual(dialogs(f),['pause-dialog','reset-dialog','settings-dialog']);
  for(const index of pair)f.click('#board [data-index="'+index+'"]');key(f,'r');key(f,'h');await wait(2);
  assert.deepEqual(authority(f),before,'nested modals block gameplay and shortcuts');
  key(f,'Escape');assert.deepEqual(dialogs(f),['pause-dialog','settings-dialog']);
  key(f,'Escape');assert.deepEqual(dialogs(f),['pause-dialog']);
  key(f,'Escape');assert.deepEqual(dialogs(f),[]);screen(f,'game');assert.equal(f.node('#board'),board);
  assert.deepEqual(authority(f),before);
  f.click('#pause');f.w.dispatchEvent(new f.w.PopStateEvent('popstate',{state:{screen:'home'}}));
  assert.deepEqual(dialogs(f),[]);screen(f,'game');
  f.w.dispatchEvent(new f.w.PopStateEvent('popstate',{state:{screen:'home'}}));screen(f,'home');
  assert.deepEqual(authority(f),before);assert.equal(f.d.getElementById('settings-screen'),null,'Settings is an overlay, not a sixth screen');
 }finally{f.close();}
});

test('zero-life saved resume and cancelled journey previews retain exact board and variant identity',async()=>{
 const saved=existing(2,{turns:1}).saved,f=observed({saved,life:lifePool(0)});try{
  const checkpoint=plain(saved.boards[2]),metadata=plain(saved.attempts[2]),selection=plain(saved.variantSelection);
  await enter(f);screen(f,'game');assert.deepEqual(plain(f.game().snapshot()),checkpoint);assert.equal(f.life().life.lives,0);
  assert.deepEqual(f.save().attempts[2],metadata);assert.deepEqual(f.save().variantSelection,selection);
  const before=authority(f);f.click('[data-nav="journey"]');screen(f,'journey');f.click('[data-stage="0"]');
  assert.equal(f.node('#pregame-dialog').open,true);screen(f,'journey');assert.deepEqual(authority(f),before,'previewing T1 does not start a new attempt');
  key(f,'Escape');assert.equal(f.node('#pregame-dialog').open,false);f.click('[data-stage="2"]');f.click('#pregame-start');
  screen(f,'game');assert.deepEqual(plain(f.game().snapshot()),checkpoint);assert.deepEqual(f.save().attempts[2],metadata);assert.equal(f.life().life.lives,0);
 }finally{f.close();}
});

test('failed authoritative T2 final write cannot publish a win or welcome reward and can recover safely',async()=>{
 const f=observed({saved:tutorialBeforeWin(1)});let restore;try{
  await enter(f);if(!f.node('#coach-next').hidden)f.click('#coach-next');
  const before=plain(profile(f)),events=plain(f.events()),pair=plain(f.w.HEX_TUTORIALS[1].solution.at(-1));
  restore=failWrites(f);await move(f,pair);
  assert.deepEqual(profile(f),before);assert.deepEqual(f.events(),events);assert.equal(f.node('#win-dialog').open,false);
  assert.equal(f.game().status,'playing');assert.equal(f.node('#board').getAttribute('aria-busy'),'false');assert.equal(f.save().economy.gold,0);
  restore();restore=null;f.return();await move(f,pair);await until(()=>f.node('#win-dialog').open,'the same final move succeeds after recovery');
  assert.equal(f.game().status,'won');assert.equal(f.save().economy.gold,20);assert.equal(f.save().economy.stars,0);
  assert.equal(Object.values(f.save().economy.transactions).filter(row=>row.kind==='welcome').length,1);
 }finally{restore?.();f.close();}
});

test('background cancellation preserves a committed move and late animation completions cannot replay it',async()=>{
 const saved=existing(2,{turns:1}).saved;saved.preferences.motion='full';const f=observed({saved}),animations=[];try{
  await enter(f);
  f.w.Element.prototype.animate=function(){let resolve;const animation={finished:new Promise(yes=>{resolve=yes;}),cancel(){this.cancelled=true;resolve();},finish(){resolve();},addEventListener(){},removeEventListener(){}};animations.push(animation);return animation;};
  const pair=playingPair(f),expected=f.game().clone();assert(expected.swap(...pair).ok);
  for(const index of pair)f.click('#board [data-index="'+index+'"]');
  assert.equal(f.node('#board').getAttribute('aria-busy'),'true');assert.deepEqual(plain(f.game().snapshot()),plain(expected.snapshot()),'the real command commits before presentation');
  const committed=authority(f),board=f.node('#board');
  Object.defineProperty(f.d,'hidden',{configurable:true,value:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));
  assert.equal(f.node('#board').getAttribute('aria-busy'),'false');assert.equal(f.node('#pause-dialog').open,true);
  for(const animation of animations)animation.finish();await wait(5);
  assert.deepEqual(authority(f),committed,'cancelled/late visuals cannot change committed outcome');assert.equal(f.node('#board'),board);
  f.return();assert.equal(f.node('#pause-dialog').open,true,'foreground does not silently resume');f.click('#pause-continue');
  screen(f,'game');assert.deepEqual(authority(f),committed);assert.equal(f.node('#board').getAttribute('aria-busy'),'false');
  assert.equal(f.d.querySelectorAll('.swap-stone,.score-packet,.tutorial-demo-layer').length,0);
  assert.equal(f.d.querySelectorAll('#board .swap-layer').length,1,'the permanent empty upper SVG layer remains available for the next swap');
 }finally{f.close();}
});

test('an animation API failure cannot undo a committed move or leave gameplay busy',async()=>{
 const saved=existing(2,{turns:1}).saved;saved.preferences.motion='full';const f=observed({saved});try{
  await enter(f);f.w.Element.prototype.animate=()=>{throw new Error('characterization animation failure');};
  const pair=playingPair(f),expected=f.game().clone();assert(expected.swap(...pair).ok);await move(f,pair);
  assert.deepEqual(plain(f.game().snapshot()),plain(expected.snapshot()));assert.equal(f.node('#board').getAttribute('aria-busy'),'false');
  assert.equal(f.node('#pause-dialog').open,false);assert.equal(f.d.querySelector('#hint'),null);assert.equal(f.node('#open-inventory').disabled,false);assert.deepEqual(dialogs(f),[]);
 }finally{f.close();}
});

test('a cancelled hint worker cannot write into a later tutorial screen or attempt',async()=>{
 const f=observed({saved:existing(2,{turns:1}).saved,hintDiagnostics:true}),workers=[];try{
  await enter(f);const oldPair=playingPair(f);
  f.w.Worker=class{constructor(){workers.push(this);}postMessage(payload){this.payload=payload;}terminate(){this.terminated=true;}};
  assert.equal(f.d.querySelector('#hint'),null,'developer worker coverage adds no manual control');f.w.HexHintTestAdapter.request();await until(()=>workers.length===1,'the actual hint path starts a worker');
  f.click('#game-home');f.click('#home-teach');await until(()=>f.save().current===0&&f.d.body.dataset.screen==='game','a new tutorial is active');
  assert.equal(workers[0].terminated,true);const before=authority(f),events=plain(f.events());
  workers[0].onmessage({data:{hint:{pair:oldPair,source:'heuristic',guaranteed:false}}});await wait(5);
  assert.deepEqual(authority(f),before);assert.deepEqual(f.events(),events);assert.equal(f.game().level.id,'learn-1');
  assert.equal(f.d.querySelectorAll('#board .hinted').length,0,'the old hint cannot highlight a new board');portraitOnly(f);
 }finally{f.close();}
});

test('cancelled life proof and cancelled full-reset confirmation never grant or erase authority',async()=>{
 const f=observed({life:lifePool(2)});try{
  f.click('#home-lives');f.click('#lives-ad');assert.deepEqual(dialogs(f),['life-provider-dialog','lives-dialog']);
  const id=Object.keys(f.life().provider.transactions).at(-1),proof=plain(f.w.HexLifeProviders.complete(f.life().provider,id,{outcome:'completed',nowUtc:NOW}));assert(proof.receipt);
  f.click('#life-provider-cancel');assert.equal(f.life().provider.transactions[id].status,'cancelled');assert.equal(f.life().life.lives,2);
  key(f,'Escape');const before=authority(f);assert.equal(f.w.HexLifeTestAdapter.applyReceipt(proof.receipt).applied,false);assert.deepEqual(authority(f),before);
  f.click('#settings');f.click('#settings-full-reset');assert.deepEqual(dialogs(f),['full-reset-dialog','settings-dialog']);
  key(f,'Escape');assert.deepEqual(dialogs(f),['settings-dialog']);key(f,'Escape');assert.deepEqual(dialogs(f),[]);
  assert.deepEqual(authority(f),before);assert.equal(f.network.length,0);
 }finally{f.close();}
});

test('verified campaign result leads to the next unopened level and preview does not allocate its attempt',async()=>{
 const f=observed({saved:beforeWin(1)});try{
  await enter(f);await move(f,plain(f.game().level.solution.at(-1)));await until(()=>f.node('#win-dialog').open,'campaign result opens');
  const won=plain(f.save()),economy=plain(won.economy);assert.equal(economy.gold,20);assert.equal(economy.stars,1);
  for(let n=0;n<5;n++)f.click('#continue');assert.deepEqual(f.save().economy,economy);
  f.click('#next');assert.deepEqual(dialogs(f),['pregame-dialog']);assert.equal(f.save().current,2);
  assert.deepEqual(f.save().variantSelection,won.variantSelection,'next-level preview does not allocate an attempt');assert.equal(f.d.querySelector('[data-stage="2"]'),null);
  f.click('#pregame-start');screen(f,'game');assert.equal(f.save().current,3);assert.equal(f.game().level.id,2);assert.equal(f.game().turn,0);
  assert.deepEqual(f.save().economy,economy);
 }finally{f.close();}
});

test('second-chance modal completes only after the same-attempt grant and rejects duplicate receipts',async()=>{
 const f=await lost({clears:0});try{
  const before=plain(f.game().snapshot()),attempt=plain(f.save().attempts[f.save().current]),lives=f.life().life.lives;
  f.click(S.ad);assert.deepEqual(dialogs(f),['lose-dialog','rescue-provider-dialog']);assert.deepEqual(plain(f.game().snapshot()),before);
  const id=Object.keys(f.save().rescue.provider.transactions).at(-1),proof=proofFor(f,id);f.click(S.confirm);
  await until(()=>f.game().status==='playing'&&f.game().movesLeft===5,'the real receipt commits its rescue');assert.deepEqual(dialogs(f),[]);
  for(const key of ['values','layers','rngState','score','history','turn'])assert.deepEqual(plain(f.game().snapshot())[key],before[key]);
  assert.deepEqual(f.save().attempts[f.save().current],attempt);assert.equal(f.life().life.lives,lives);const committed=authority(f);
  for(let n=0;n<3;n++)assert.equal(f.w.HexRescueTestAdapter.applyReceipt(proof.receipt,proof.completedProvider).applied,false);
  assert.deepEqual(authority(f),committed);assert.equal(f.node('#board').getAttribute('aria-busy'),'false');screen(f,'game');
 }finally{f.close();}
});

(async()=>{
 for(const {name,run}of tests){await run();console.log('PASS '+name);}
 await wait(5);assert.deepEqual(unhandled,[]);assert.deepEqual(browserErrors,[]);
 console.log('State characterization passed: '+tests.length+' actual-app groups; no private state API, save contract or gameplay fixture changed. Native focus, pixels and physical devices require the browser suite.');
})().catch(error=>{console.error(error);process.exitCode=1;});
