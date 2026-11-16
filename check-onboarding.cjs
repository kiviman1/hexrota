/* First-play understanding, deliberate lesson acknowledgements and transfer to a real puzzle. */
'use strict';
const assert=require('node:assert/strict');
const {loadGame,savedLevel,savedGame,confirmRestart}=require('./qa-fixtures.cjs');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=__dirname+'/dist/',key='hexrota-match-v5';
const source=file=>fs.readFileSync(root+file,'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const errors=[],unhandled=[],tests=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const test=(name,run)=>tests.push({name,run});
async function until(check,message,timeout=1600){const start=Date.now();while(!check()&&Date.now()-start<timeout)await wait(5);assert(check(),message);}
function mount(state,{motion='reduce'}={}){
 const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(source('index.html'),{url:'https://hexrota-onboarding.example/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,d=w.document,animations=[];
 const style=d.createElement('style');style.textContent=source('style.css');d.head.appendChild(style);
 w.matchMedia=()=>({matches:motion==='reduce',addEventListener(){},removeEventListener(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};
 // Hold the first real animation open so feedback cannot appear before presentation ends.
 if(motion==='full')w.Element.prototype.animate=function(keyframes,options){let finished,reject;const animation={get finished(){return finished||(finished=new Promise((_,no)=>{reject=no;}));},cancel(){reject?.(new w.DOMException('Animation cancelled','AbortError'));}};animations.push({node:this,keyframes,options,animation});return animation;};
 class AudioStub{configure(){}unlock(){return Promise.resolve();}setActive(){}move(){}victory(){}click(){}stop(){}dispose(){}}
 w.HexAudio=AudioStub;
 if(state)w.localStorage.setItem(key,JSON.stringify(state));
 loadGame(w,['engine.js','levels.js','tutorials.js','app.js'],source);
 const f={dom,w,d,animations,node(selector){const node=d.querySelector(selector);assert(node,selector+' exists');return node;},save(){return JSON.parse(w.localStorage.getItem(key));},close(){dom.window.close();}};
 f.click=selector=>f.node(selector).dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:0}));
 f.board=()=>plain(f.save().boards[f.save().current]);
 f.levels=[...w.HEX_TUTORIALS,...w.HEX_LEVELS];
 return f;
}
function tile(f,index){return f.node(`#board [data-index="${index}"]`);}
function visible(f,node){
 for(let current=node;current&&current.nodeType===1;current=current.parentElement){const style=f.w.getComputedStyle(current);if(current.hidden||style.display==='none'||style.visibility==='hidden')return false;}
 return true;
}
function tapPair(f,pair){for(const index of pair)f.click(`#board [data-index="${index}"]`);}
function dragPair(f,pair){
 const pointer=(type,x,y)=>{const event=new f.w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y});Object.defineProperties(event,{pointerId:{value:7},pointerType:{value:'touch'},isPrimary:{value:true}});return event;};
 f.d.elementFromPoint=()=>tile(f,pair[1]);tile(f,pair[0]).dispatchEvent(pointer('pointerdown',10,10));f.w.dispatchEvent(pointer('pointerup',60,60));
}
async function play(f,pair){tapPair(f,pair);await until(()=>f.node('#board').getAttribute('aria-busy')==='false','move presentation finishes');}
function keypress(f,key,target=f.w){target.dispatchEvent(new f.w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));}
function begin(f){f.click('#home-play');if(f.node('#pregame-dialog').open)f.click('#pregame-start');assert.equal(f.node('#game-screen').hidden,false);}
function enterStage(f,index){f.click('[data-nav="journey"]');f.click(`[data-stage="${index}"]`);assert(f.node('#pregame-dialog').open);f.click('#pregame-start');}
function feedback(f,pending=true){
 assert.equal(f.d.body.dataset.guideFeedback,String(pending),'feedback phase is explicit');
 assert.equal(f.node('#coach-next').hidden,!pending,'only a pending explanation has an acknowledgement');
 if(pending){
  assert.equal(f.d.querySelectorAll('#board .tutorial-focus,#board .tutorial-support,#board .tutorial-gesture').length,0,'next move is not prompted while explaining the result');
  assert.equal(f.node('#hint').disabled,true,'hint is unavailable while explaining');
 }
}
function focus(f,step){
 const indices=selector=>[...f.d.querySelectorAll(selector)].map(node=>+node.dataset.index).sort((a,b)=>a-b);
 assert.deepEqual(indices('#board .tutorial-focus'),plain(step.pair).sort((a,b)=>a-b),'exactly the two swappable neighbours are focused');
 assert.deepEqual(indices('#board .tutorial-support'),plain(step.matchIndices).filter(index=>!step.pair.includes(index)).sort((a,b)=>a-b),'the other members of the actual resulting match remain visible');
 for(const index of step.matchIndices.filter(index=>!step.pair.includes(index))){const node=tile(f,index);assert(!node.classList.contains('tutorial-muted'),'matching support stone is not dimmed');assert.equal(f.w.getComputedStyle(node).opacity,'1','matching support stone has full opacity');}
 const gesture=f.node('#board .tutorial-gesture');
 assert.equal(gesture.getAttribute('aria-hidden'),'true','gesture is decorative');
 assert.equal(f.w.getComputedStyle(gesture).pointerEvents,'none','gesture never intercepts touch input');
 assert(gesture.querySelector('path'),'a visible hand and direction are drawn');
}
function exact(f,engine,message){assert.deepEqual(f.board(),plain(engine.snapshot()),message);assert.equal(+f.node('#sum').textContent,engine.score,message+' HUD score');assert.equal(f.node('#coverage').textContent,`${engine.covered} / ${engine.total}`,message+' green ground');}
function acknowledge(f){const snapshot=f.board();f.click('#coach-next');feedback(f,false);assert.deepEqual(f.board(),snapshot,'acknowledging an explanation cannot award points, spend a move or advance RNG');}
function stateAt(f,index,turns=0,extra={}){
 const engine=new f.w.HexMatch(f.levels[index]);for(const pair of f.levels[index].solution.slice(0,turns))assert(engine.swap(...pair).ok);
 return {current:index,done:Array.from({length:index},(_,i)=>i),boards:{[index]:plain(engine.snapshot())},sound:false,preferences:{motion:'reduce'},records:{},...extra};
}

test('a fresh opening offers one task and one direct first action',async()=>{
 const f=mount();try{
  assert.equal(f.node('#home-play-label').textContent.trim(),'Başlayalım','first opening has one concrete start action');
  for(const selector of ['#home-lives','#home-screen .campaign-wallet','#home-teach','#home-garden','.home-shortcuts','.home-progress','.app-navigation'])assert.equal(visible(f,f.node(selector)),false,selector+' is deferred until play has begun');
  assert.equal(visible(f,f.node('#home-play')),true);
  const before=plain(f.save());f.click('#home-play');
  assert.equal(f.node('#pregame-dialog').open,false,'first action enters the lesson without a second start screen');
  assert.equal(f.node('#game-screen').hidden,false);assert.equal(f.save().current,0);
  const engine=new f.w.HexMatch(f.levels[0]);exact(f,engine,'starting the lesson preserves the fixed T1 board');
  assert.deepEqual(f.save().economy,before.economy,'starting cannot grant Gold, stars or inventory');
  assert.equal(f.d.body.dataset.learning,'first');feedback(f,false);
  assert.equal(visible(f,f.node('#coverage')),true,'the first objective is visible');
  assert.match(f.node('#ground-label').textContent,/yeşert/i,'the first objective uses an action');
  assert.equal(visible(f,f.node('#moves-left')),true,'the first move budget is visible');
  assert.equal(+f.node('#moves-left').textContent,5);
  const text=f.node('#coach-title').textContent+' '+f.node('#coach-text').textContent;
  assert(/kaydır|değiştir/i.test(text),'first action stays explicit on the board');
  focus(f,f.levels[0].steps[0]);
  const original=f.board();tapPair(f,[0,1]);assert.deepEqual(f.board(),original,'unrelated taps cannot consume the teaching move');
 }finally{f.close();}
});

test('the first opening is derived from progress and never replaces a returning checkpoint',async()=>{
 let f=mount();try{
  const state=stateAt(f,0,0),checkpoint=plain(state.boards[0]);f.close();f=mount(state);
  assert.notEqual(f.node('#home-play-label').textContent.trim(),'Başlayalım','an existing untouched lesson is a returning profile');
  f.click('#home-play');assert(f.node('#pregame-dialog').open,'returning untouched lesson retains the normal preview');
  assert.deepEqual(f.save().boards[0],checkpoint,'preview does not recreate a checkpoint');
  assert.equal(f.node('#game-screen').hidden,true);
 }finally{f.close();}
});

test('the slow swap demonstration is decorative and never commits gameplay',async()=>{
 const f=mount(null,{motion:'full'});try{
  begin(f);const before=f.board(),layer=f.node('#board .tutorial-demo-layer');
  assert.equal(layer.getAttribute('aria-hidden'),'true');assert.equal(f.w.getComputedStyle(layer).pointerEvents,'none');
  assert.equal(layer.querySelectorAll('.tutorial-demo-stone .gem').length,2,'both real stone designs are demonstrated');
  assert.equal(layer.querySelectorAll('[data-index],[tabindex],[role],[id]').length,0,'the demonstration adds no duplicate input or accessibility targets');
  assert.equal(f.d.querySelectorAll('#board .tutorial-demo-source').length,2,'only the original pair is temporarily concealed');
  const animations=f.animations.filter(item=>layer.contains(item.node));
  assert.equal(animations.length,2);assert(animations.every(item=>item.options.duration>=3000&&item.options.iterations===Infinity),'the exchange is slow enough to follow');
  await wait(60);assert.deepEqual(f.board(),before,'watching cannot consume moves, award score, advance history or RNG');
  f.click('#game-home');assert.equal(f.d.querySelectorAll('.tutorial-demo-layer,.tutorial-demo-source').length,0,'leaving cleans up ghosts and restores the real pair');
  assert.deepEqual(f.board(),before,'leaving a demonstration preserves the fixed checkpoint');
 }finally{f.close();}
});

test('the first result stays explained until acknowledged, with safe controls still usable',async()=>{
 const f=mount(null,{motion:'full'});try{
  begin(f);const level=f.levels[0],engine=new f.w.HexMatch(level);
  assert(engine.swap(...level.solution[0]).ok);dragPair(f,level.solution[0]);
  assert.equal(f.node('#board').getAttribute('aria-busy'),'true');
  assert.equal(f.node('#coach-next').hidden,true,'acknowledgement does not interrupt the animation');
  assert.equal(f.d.body.dataset.guideFeedback,'false','animation and explanation are distinct phases');
  f.click('#skip-animation');await until(()=>f.node('#coach-next').hidden===false,'first result waits for acknowledgement');
  feedback(f);exact(f,engine,'first swipe awards exactly six');
  assert(/6/.test(f.node('#coach-text').textContent)&&/puan/i.test(f.node('#coach-text').textContent),'result explains the six-point gain');
  assert(/yeşil|yeşer/i.test(f.node('#coach-text').textContent),'result explains the ground change');
  const before=f.board(),text=f.node('#coach-text').textContent;
  tapPair(f,level.solution[1]);
  for(const index of level.solution[1])keypress(f,'Enter',tile(f,index));
  keypress(f,'h');f.click('#hint');
  f.w.dispatchEvent(new f.w.Event('resize'));await wait(60);
  assert.deepEqual(f.board(),before,'tap, Enter, hint and resize cannot play through the explanation');
  assert.equal(f.d.querySelectorAll('#board .selected,#board .hinted').length,0,'blocked input does not expose a different prompt');
  assert.equal(f.node('#coach-text').textContent,text,'feedback is not replaced by the next move text');
  f.click('#game-settings');assert(f.node('#settings-dialog').open,'settings remain usable');f.click('#settings-done');feedback(f);
  f.click('#game-home');assert.equal(f.node('#home-screen').hidden,false,'menu remains usable');begin(f);feedback(f);exact(f,engine,'returning from menu preserves the explained result');
  acknowledge(f);assert(f.save().guideAcks.includes('0:1'),'acknowledgement is persisted outside the engine snapshot');focus(f,level.steps[1]);
 }finally{f.close();}
});

test('reload resumes the exact explanation without duplicating points or forgetting acknowledgement',async()=>{
 let f=mount();try{
  begin(f);await play(f,f.levels[0].solution[0]);feedback(f);
  const state=plain(f.save()),snapshot=f.board();f.close();f=mount(state);begin(f);
  feedback(f);assert.deepEqual(f.board(),snapshot,'pending checkpoint, values, history, moves and RNG survive reload');
  assert.equal(+f.node('#sum').textContent,6,'reload does not award the first six points again');
  acknowledge(f);const acknowledged=plain(f.save());f.close();f=mount(acknowledged);begin(f);
  feedback(f,false);assert.deepEqual(f.board(),snapshot,'acknowledged checkpoint is unchanged after another reload');focus(f,f.levels[0].steps[1]);
 }finally{f.close();}
});

test('the second lesson separates stone values, double ground and the two win conditions',async()=>{
 let f=mount();try{
  const state=stateAt(f,1);f.close();f=mount(state);enterStage(f,1);
  const level=f.levels[1],engine=new f.w.HexMatch(level);assert.equal(f.d.body.dataset.learning,'goals');
  assert.equal(f.node('#score-goal-check').hidden,true);assert.equal(f.node('#ground-goal-check').hidden,true,'both goals start incomplete');
  assert.equal(f.d.querySelectorAll('#board .layer-count').length,0,'floor no longer has a second set of confusing numerals');
  for(const index of [0,4])assert.equal(tile(f,index).querySelectorAll('.layer-pips circle').length,2,'two pips identify double ground');
  assert(engine.swap(...level.solution[0]).ok);await play(f,level.solution[0]);feedback(f);exact(f,engine,'double ground first hit');
  assert.equal(tile(f,4).querySelectorAll('.layer-pips circle').length,1,'one pip is left after the first hit');
  assert.equal(tile(f,0).querySelectorAll('.layer-pips circle').length,2,'untouched double ground keeps two pips');
  const doubleExplanation=f.node('#coach-text').textContent.toLocaleLowerCase('tr-TR');
  assert(/iki|2/.test(doubleExplanation)&&/eşleşme/.test(doubleExplanation),'feedback names the two-match requirement');
  acknowledge(f);
  assert(engine.swap(...level.solution[1]).ok);await play(f,level.solution[1]);feedback(f,false);exact(f,engine,'chain uses one move');
  assert(engine.swap(...level.solution[2]).ok);await play(f,level.solution[2]);feedback(f);exact(f,engine,'score target with one ground remaining');
  assert(engine.score>=level.target&&engine.covered<engine.total,'the teaching checkpoint distinguishes score and ground');
  assert.equal(f.node('#score-goal-check').hidden,false,'score goal visibly completes independently');
  assert.equal(f.node('#ground-goal-check').hidden,true,'unfinished ground goal remains visibly incomplete');
  assert.equal(f.node('#win-dialog').open,false,'score alone cannot complete the lesson');
  assert.equal(f.save().economy.gold,0,'a partial lesson cannot grant the welcome gift');
  const explanation=f.node('#coach-text').textContent.toLocaleLowerCase('tr-TR');
  assert(/puan/.test(explanation)&&/yeşil|yeşer/.test(explanation),'feedback names the score and green area goals');
  assert(/bitmedi|gerek|olmalı|kazan|tamamlan|son.*yeşert/.test(explanation),'feedback explains that score alone does not finish the level');
  acknowledge(f);assert.deepEqual(plain(f.save().guideAcks),['1:1','1:3']);
  assert(engine.swap(...level.solution[3]).ok);await play(f,level.solution[3]);exact(f,engine,'last ground completes both goals');
  assert.equal(f.node('#score-goal-check').hidden,false);assert.equal(f.node('#ground-goal-check').hidden,false,'both goal checks are visible only when both goals complete');
  await until(()=>f.node('#win-dialog').open,'both goals open the completed lesson');
  assert.equal(f.save().economy.gold,20,'a verified T2 win banks the one-time welcome gift');
  assert.equal(f.node('#win-dialog').dataset.welcome,'true','the first verified T2 win uses the welcome chest presentation');
  assert.equal(visible(f,f.node('#welcome-reward')),true,'the real welcome gift is visibly celebrated');
  assert.match(f.node('#welcome-gold').textContent,/20.*Altın/i);
  assert.equal(f.save().economy.stars,0,'welcome gift never grants campaign stars');
  assert.deepEqual(plain(f.save().economy.inventory),{greenBrush:0,colorKey:0},'welcome gift does not unlock inventory');
 }finally{f.close();}
});

test('reset and tutorial replay clear only the active lesson acknowledgement',async()=>{
 let f=mount();try{
  const state=stateAt(f,0,1,{done:[0,1],guideAcks:['0:1','1:1','1:3']});f.close();f=mount(state);begin(f);
  // Completed lessons remain replayable; home-teach intentionally starts lesson one afresh.
  f.click('#game-home');f.click('#home-teach');feedback(f,false);
  assert.equal(f.board().turn,0);assert.deepEqual(plain(f.save().guideAcks),['1:1','1:3'],'fresh lesson replay retains the other lesson acknowledgement history');
  await play(f,f.levels[0].solution[0]);feedback(f);f.click('#reset');feedback(f,false);
  assert.equal(f.board().turn,0,'reset is usable from pending feedback');assert.equal(+f.node('#sum').textContent,0);
  assert.deepEqual(plain(f.save().guideAcks),['1:1','1:3']);
  await play(f,f.levels[0].solution[0]);feedback(f);keypress(f,'r');feedback(f,false);assert.equal(f.board().turn,0,'reset keyboard shortcut also remains usable');
  await play(f,f.levels[0].solution[0]);feedback(f);f.click('#coach-skip');
  assert.equal(f.save().current,2,'skip is usable from pending feedback');assert.equal(f.d.body.dataset.learning,'');
 }finally{f.close();}
});

test('a player can transfer the mechanic to a campaign move without a forced pair',async()=>{
 let f=mount();try{
  const state=stateAt(f,2,0,{guideAcks:['0:1','1:1','1:3']});f.close();f=mount(state);enterStage(f,2);
  assert.equal(f.d.body.dataset.learning,'');feedback(f,false);assert.equal(f.node('#tutorial-coach').hidden,true);
  assert.equal(f.d.querySelectorAll('#board .tutorial-focus,#board .tutorial-support,#board .tutorial-gesture').length,0);
  const engine=new f.w.HexMatch(f.levels[2]),pair=engine.legalMoves()[0];assert(pair,'campaign has an independent legal move');
  assert(engine.swap(...pair).ok);await play(f,plain(pair));exact(f,engine,'unprompted legal campaign swipe');feedback(f,false);
 }finally{f.close();}
});

(async()=>{
 for(const {name,run}of tests){await run();console.log('✓ '+name);}
 assert.deepEqual(errors,[],'no browser errors');assert.deepEqual(unhandled,[],'no unhandled presentation rejection');
 console.log('First-play onboarding checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
