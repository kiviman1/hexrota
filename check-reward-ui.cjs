/* Reward director integration against the actual game, with no scoring changes. */
'use strict';
const assert=require('node:assert/strict');
const {loadGame,savedLevel,savedGame,confirmRestart}=require('./qa-fixtures.cjs');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=__dirname+'/dist/',key='hexrota-match-v5';
const read=file=>fs.readFileSync(root+file,'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const tests=[],errors=[],unhandled=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const test=(name,run)=>tests.push({name,run});
async function until(check,message,timeout=3700){const start=Date.now();while(!check()&&Date.now()-start<timeout)await wait(5);assert(check(),message);}
const reference={window:{},performance};vm.createContext(reference);
for(const file of ['engine.js','levels.js'])vm.runInContext(read(file),reference);
const level=reference.window.HEX_LEVELS[0];
function fixture(turn){
 const game=new reference.window.HexMatch(level);
 for(const pair of level.solution.slice(0,turn))assert(game.swap(...pair).ok);
 const snapshot=plain(game.snapshot()),pair=plain(level.solution[turn]),result=plain(game.swap(...pair));
 return {snapshot,pair,result,expected:plain(game.snapshot()),status:game.status};
}
const ordinary=fixture(1),cross=fixture(0),winning=fixture(level.solution.length-1);

function mount({which=ordinary,motion='full',sound=true,haptics=true,hintDiagnostics=false}={}){
 const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(read('index.html'),{url:'https://hexrota-reward-ui.example/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 try{
 const w=dom.window,d=w.document,animations=[],packets=[],burstSnapshots=[],audio=[],vibrations=[];
 w.matchMedia=()=>({matches:motion==='reduce',addEventListener(){},removeEventListener(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};
 Object.defineProperty(w.navigator,'vibrate',{configurable:true,value:pattern=>{vibrations.push(plain(pattern));return true;}});
 class Point{constructor(x=0,y=0){this.x=x;this.y=y;}matrixTransform(m){return new Point(m.a*this.x+m.c*this.y+m.e,m.b*this.x+m.d*this.y+m.f);}}
 w.SVGSVGElement.prototype.createSVGPoint=()=>new Point();
 w.SVGElement.prototype.getScreenCTM=()=>({a:1,b:0,c:0,d:1,e:195,f:350});
 w.Element.prototype.getBoundingClientRect=function(){
  let x=0,y=0,width=390,height=650;
  if(this.id==='sum'){x=42;y=28;width=39;height=34;}
  else if(this.classList.contains('hud-score')){x=16;y=10;width=120;height=95;}
  else if(this.id==='board'){x=0;y=155;width=390;height=390;}
  else if(this.classList.contains('score-packet')){width=110;height=68;}
  return {x,y,left:x,top:y,width,height,right:x+width,bottom:y+height,toJSON(){return this;}};
 };
 w.Element.prototype.animate=function(frames,options={}){
  const animation={target:this,frames,options,cancelled:false,cancel(){this.cancelled=true;},get finished(){return Promise.resolve();},addEventListener(){},removeEventListener(){}};
  animations.push(animation);return animation;
 };
 class AudioStub{
  constructor(config={}){this.config={...config};this.active=false;this.unlocked=false;}
  configure(config={}){Object.assign(this.config,config);}
  unlock(){this.unlocked=true;return Promise.resolve(true);}
  setActive(value){this.active=value;}
  record(kind,cue){if(this.config.sfx&&this.active&&this.unlocked&&d.hidden!==true)audio.push({kind,cue:cue?plain(cue):null,score:+d.getElementById('sum').textContent,busy:d.getElementById('board').getAttribute('aria-busy')});}
  reward(cue){this.record('reward',cue);}
  move(){this.record('move');}victory(){this.record('victory');}click(){}stop(){this.active=false;}dispose(){this.active=false;}
 }
 w.HexAudio=AudioStub;
 w.localStorage.setItem(key,JSON.stringify({current:2,done:[0,1],boards:{2:which.snapshot},sound,preferences:{music:false,volume:.65,motion,haptics}}));
 const observed=new WeakSet();
 const observer=new w.MutationObserver(()=>{
  for(const packet of d.querySelectorAll('.score-packet')){
   if(!observed.has(packet)){observed.add(packet);packets.push({node:packet,headline:packet.dataset.rewardHeadline||'',reason:packet.dataset.rewardReason||'',tier:Number(packet.dataset.rewardTier),chain:packet.querySelector('.score-packet-chain')?.textContent||''});}
   if(packet.dataset.phase==='pop'&&!burstSnapshots.some(snapshot=>snapshot.node===packet))burstSnapshots.push({node:packet,rings:d.querySelectorAll('.score-burst-ring').length,sparks:d.querySelectorAll('.score-burst-spark').length});
  }
 });observer.observe(d.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-phase','data-reward-headline']});
 loadGame(w,['engine.js','levels.js','tutorials.js','reward-rules.js','rewards.js','reward-adapter.js','app.js'],read,{hintDiagnostics});
 const node=id=>{const n=d.getElementById(id);assert(n,'#'+id+' exists');return n;};
 const click=id=>{node(id).click();if(id==='reset')confirmRestart(w);},save=()=>JSON.parse(w.localStorage.getItem(key));
 function enter(){d.querySelector('[data-nav="journey"]').click();d.querySelector('[data-stage="2"]').click();if(node('pregame-dialog').open)click('pregame-start');assert.equal(d.body.dataset.screen,'game');assert.equal(save().current,2,'fixture enters the requested campaign board');}
 function move(){for(const index of which.pair)d.querySelector(`#board [data-index="${index}"]`).dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:0}));}
 const busy=()=>node('board').getAttribute('aria-busy')==='true';
 const idle=()=>until(()=>!busy(),'reward presentation unlocks within its bounded duration');
 const clean=()=>{assert.equal(d.querySelectorAll('.score-packet,.score-digit,.score-burst-ring,.score-burst-spark,.reward-goal-hit,.score-arrival').length,0,'no stale score or reward visuals remain');};
 function exact(){assert.equal(+node('sum').textContent,which.expected.score,'feedback cannot change the score');assert.deepEqual(save().boards[2],which.expected,'feedback cannot mutate the saved engine/RNG state');assert.equal(+node('moves-left').textContent,which.expected.movesLeft);}
 return {w,d,which,node,click,save,enter,move,idle,busy,clean,exact,animations,packets,burstSnapshots,audio,vibrations,close(){observer.disconnect();dom.window.close();}};
 }catch(error){dom.window.close();throw error;}
}

function goalAnimations(f){const coverage=f.d.querySelector('.coverage');return f.animations.filter(a=>coverage===a.target||coverage?.contains(a.target));}

test('production markup loads the rules and director before the game',()=>{
 const dom=new JSDOM(read('index.html'));try{
  const files=[...dom.window.document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src').split('?')[0].replace(/^\.\//,''));
  for(const file of ['reward-rules.js','rewards.js','reward-adapter.js'])assert(files.indexOf(file)>=0&&files.indexOf(file)<files.indexOf('app.js'),file+' is loaded before app.js');
 }finally{dom.window.close();}
});

test('restoring a played board and asking for a hint never replay rewards',async()=>{
 const f=mount({hintDiagnostics:true});try{
  assert.equal(f.audio.length,0);assert.equal(f.vibrations.length,0);assert.equal(f.packets.length,0);
  const before=plain(f.save().boards[2]);f.enter();assert.equal(f.d.querySelector('#hint'),null,'manual hint control stays removed');f.w.HexHintTestAdapter.request();
  await until(()=>f.d.querySelector('.hinted'),'the real hint completes');
  assert.deepEqual(f.save().boards[2],before);assert.equal(f.audio.length,0,'restore and hint do not play old reward cues');assert.equal(f.vibrations.length,0);assert.equal(goalAnimations(f).length,0,'old ground milestones are not replayed');
 }finally{f.close();}
});

test('an ordinary triple keeps light feedback and the original earned score',async()=>{
 const f=mount();try{
  f.enter();f.move();await f.idle();f.exact();f.clean();
  assert.equal(f.packets.length,1);assert.equal(f.packets[0].tier,0);assert.equal(f.packets[0].headline,'');assert.equal(f.packets[0].chain,'','a normal triple does not receive a praise headline');
  assert.equal(f.vibrations.length,0,'tier-zero matches do not add a strong tactile cue');
  assert.equal(goalAnimations(f).length,0,'restored milestones remain consumed');
  assert.deepEqual(f.burstSnapshots.map(b=>[b.rings,b.sparks]),[[f.w.HEX_REWARD_RULES.tiers[0].rings,f.w.HEX_REWARD_RULES.tiers[0].sparks]]);
 }finally{f.close();}
});

test('a real crossing earns one stronger headline, a progress pulse and gated cues',async()=>{
 const f=mount({which:cross});try{
  f.enter();assert.equal(f.audio.length,0);assert.equal(f.vibrations.length,0);f.move();
  await until(()=>goalAnimations(f).length>0,'new ground milestone visibly pulses the coverage display');
  await f.idle();f.exact();f.clean();
  const headlines=f.packets.filter(p=>p.headline);assert.equal(headlines.length,1,'one valid move has at most one achievement headline');assert.equal(headlines[0].headline,'cross');assert(/çapraz|eksen/i.test(headlines[0].chain),'the headline describes the actual crossing');assert(!/[×x]\s*\d/i.test(headlines[0].chain),'crossing feedback never implies a scoring multiplier');
  assert.equal(headlines[0].tier,2);assert.equal(headlines[0].reason,'cross');
  assert.deepEqual(f.burstSnapshots.map(b=>[b.rings,b.sparks]),[[f.w.HEX_REWARD_RULES.tiers[2].rings,f.w.HEX_REWARD_RULES.tiers[2].sparks]],'the stronger cue uses the configured visual amplitude');
  const calls=f.audio.filter(a=>a.kind==='reward');assert.equal(calls.length,1);assert.equal(calls[0].cue.tier,2);assert.equal(new Set(calls.map(a=>a.cue.id)).size,calls.length,'cue IDs are consumed once');
  assert.deepEqual(f.vibrations,[f.w.HEX_REWARD_RULES.tiers[2].hapticMs],'tactile feedback is not duplicated by the old generic move pulse');
 }finally{f.close();}
});

test('turning off sound and vibration keeps achievement visuals and exact scoring',async()=>{
 const f=mount({which:cross,sound:false,haptics:false});try{
  f.enter();f.move();await f.idle();f.exact();f.clean();
  assert(f.packets.some(p=>p.tier===2&&p.headline==='cross'));assert.equal(f.audio.length,0);assert.equal(f.vibrations.length,0);
 }finally{f.close();}
});

for(const action of ['skip','reset','navigate','background','resize'])test(action+' clears in-flight reward pulses without a delayed replay',async()=>{
 const f=mount({which:cross});try{
  f.enter();f.move();await until(()=>goalAnimations(f).length>0,'the reward has begun before interruption');const played=f.audio.length,tactile=f.vibrations.length;
  let score=cross.expected.score;
  if(action==='skip')f.click('skip-animation');
  if(action==='reset'){f.click('reset');score=0;}
  if(action==='navigate')f.click('game-home');
  if(action==='background'){Object.defineProperty(f.d,'hidden',{configurable:true,value:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));}
  if(action==='resize')f.w.dispatchEvent(new f.w.Event('resize'));
  await until(()=>!f.busy(),'interrupting remains immediate',180);f.clean();assert.equal(+f.node('sum').textContent,score);
  await wait(300);f.clean();assert.equal(+f.node('sum').textContent,score);assert.equal(f.audio.length,played,'aborted work cannot play an extra reward');assert.equal(f.vibrations.length,tactile,'aborted work cannot vibrate again');
  if(action==='reset')assert.equal(f.save().boards[2].turn,0);else assert.deepEqual(f.save().boards[2],cross.expected,'cosmetic cancellation preserves the committed engine outcome');
 }finally{f.close();}
});

test('reduced motion settles immediately without reward animations',async()=>{
 const f=mount({which:cross,motion:'reduce',sound:false,haptics:false});try{
  f.enter();const start=Date.now();f.move();await until(()=>!f.busy(),'reduced motion is immediate',180);assert(Date.now()-start<180);f.exact();f.clean();assert.equal(f.animations.length,0);assert.equal(f.packets.length,0);assert.equal(f.audio.length,0);assert.equal(f.vibrations.length,0);
 }finally{f.close();}
});

test('victory feedback is emitted once only after the final floor and score settle',async()=>{
 const f=mount({which:winning});try{
  f.enter();f.move();await f.idle();f.exact();
  await until(()=>f.node('win-dialog').open,'victory screen opens after the score animation');
  const completions=f.audio.filter(a=>a.kind==='reward'&&a.cue.completion);
  assert.equal(completions.length,1);assert.equal(completions[0].busy,'false');assert.equal(completions[0].score,winning.expected.score);
  assert(f.packets.every(packet=>!['win','last_move_win'].includes(packet.headline)),'the completion headline does not appear before final ground rendering');
  const before=plain(f.save().boards[2]),count=f.audio.length;f.click('review');await wait(150);assert.deepEqual(f.save().boards[2],before);assert.equal(f.audio.length,count,'reviewing the winning board cannot award victory again');
 }finally{f.close();}
});

(async()=>{
 let failed=0;for(const {name,run}of tests){try{await run();console.log('✓ '+name);}catch(error){failed++;console.error('✗ '+name+'\n'+error.stack);}}
 await wait(20);if(errors.length||unhandled.length){failed++;console.error({errors,unhandled});}
 if(failed)process.exitCode=1;else console.log('Reward UI checks passed: quiet restoration, truthful one-time headlines, configured intensity, user gates, exact engine state and cancellation safety.');
})().catch(error=>{console.error(error);process.exitCode=1;});
