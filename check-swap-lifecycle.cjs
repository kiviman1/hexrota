/* Presentation ownership and cleanup. Raster visibility is checked separately in real browsers. */
'use strict';
const assert=require('node:assert/strict');
const {mount,fresh,plain,enter,wait,until}=require('./check-lives-ui.cjs');
const tests=[],errors=[],unhandled=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const test=(name,run)=>tests.push({name,run});
async function fixture({reduced=false,failAt=0}={}){
 const saved=fresh(2);saved.preferences.motion=reduced?'reduce':'full';
 const f=mount({saved});f.w.matchMedia=()=>({matches:reduced,addEventListener(){},removeEventListener(){}});
 const animations=[];let calls=0;
 f.w.Element.prototype.animate=function(frames,options={}){
  calls++;if(failAt===calls)throw Error('Simulated animation API failure');
  const animation={target:this,frames,options,cancelled:false,cancel(){this.cancelled=true;},finish(){},addEventListener(){},removeEventListener(){}};
  animations.push(animation);return animation;
 };
 f.w.Element.prototype.getAnimations=function(){return animations.filter(animation=>animation.target===this&&!animation.cancelled);};
 f.w.addEventListener('error',event=>errors.push(event.message));await enter(f);
 f.animations=animations;f.calls=()=>calls;
 f.layer=()=>{const layer=f.d.querySelector('#board .swap-layer');return layer?.querySelector('.swap-stone')?layer:null;};
 f.begin=pair=>{for(const index of pair)f.click(`#board [data-index="${index}"]`);};
 f.idle=()=>until(()=>f.node('#board').getAttribute('aria-busy')==='false','presentation releases input',4500);
 f.clean=()=>{assert.equal(f.layer(),null,'no temporary swap layer remains');assert.equal(f.d.querySelectorAll('#board [data-swap-hidden],#board .swap-hidden').length,0,'sources are not left hidden');for(const gem of f.d.querySelectorAll('#board [data-index] .gem')){assert.notEqual(gem.style.visibility,'hidden');assert.notEqual(gem.getAttribute('visibility'),'hidden');}};
 f.exact=model=>{
  assert.deepEqual(plain(f.game().snapshot()),plain(model.snapshot()),'durable values, layers, score, moves, RNG and history exactly match real engine');
  assert.equal(+f.node('#sum').textContent,model.score);assert.equal(+f.node('#moves-left').textContent,model.movesLeft);
  const values=[...f.d.querySelectorAll('#board [data-index]')].map(tile=>Number(tile.querySelector('.hex-number')?.textContent));assert.deepEqual(values,plain(model.values),'all settled stones have their authoritative values');
 };
 return f;
}
function firstMove(f){const model=f.game(),pair=plain(model.level.solution[model.turn]);assert(model.swap(...pair).ok);return {model,pair};}
function snapshot(f){return plain(f.game().snapshot());}
function invalidPair(f){const model=f.game();for(let a=0;a<model.values.length;a++)for(const b of model.neighbors[a])if(!model.clone().swap(a,b).ok)return [a,b];throw Error('Fixture has no invalid neighboring swap');}

test('both swap stones have an independent top layer, then matching and final drawing resume normally',async()=>{
 const f=await fixture();try{
  const {model,pair}=firstMove(f),before=snapshot(f);f.begin(pair);
  assert(f.layer(),'two-way swap creates its presentation layer');
  const layer=f.layer(),gems=[...layer.querySelectorAll('.gem')];assert.equal(gems.length,2,'both stones are present in the moving layer');
  assert.deepEqual(gems.map(gem=>Number(gem.querySelector('.hex-number')?.textContent)).sort(),pair.map(i=>before.values[i]).sort(),'both numbers travel with their gems');
  assert.equal(layer.parentElement,f.node('#board'),'moving layer is outside individual cell groups');assert.equal(layer.querySelectorAll('.floor-shape').length,0,'fixed floors never move with a stone');
  await until(()=>!f.layer(),'swap layer ends before matched numbers are removed');
  assert(f.d.querySelector('#board .fx-layer .fx-ring'),'match effects begin separately after both moving stones are removed');
  await f.idle();f.clean();f.exact(model);assert.equal(f.life().life.lives,5);
 }finally{f.close();}
});

test('skip settles the committed result once and cancelled swap callbacks cannot alter it',async()=>{
 const f=await fixture();try{
  const {model,pair}=firstMove(f);f.begin(pair);assert(f.layer());f.click('#skip-animation');f.clean();f.exact(model);
  const stable=snapshot(f);await wait(380);assert.deepEqual(snapshot(f),stable);f.clean();assert(f.animations.some(animation=>animation.cancelled),'owned animations were cancelled');
 }finally{f.close();}
});

test('rapid reveal followed by a new swap leaves the new presentation owned by the new move',async()=>{
 const f=await fixture();try{
  const first=firstMove(f);f.begin(first.pair);const old=f.layer();assert(old);
  f.click(`#board [data-index="${first.pair[0]}"]`);f.clean();f.exact(first.model);
  const next=firstMove(f);f.begin(next.pair);const current=f.layer();assert(current&&current!==old);
  await wait(35);assert.equal(f.layer(),current,'old aborted promise cannot remove the new moving layer');assert.equal(current.isConnected,true);
  f.click('#skip-animation');f.clean();f.exact(next.model);assert.equal(next.model.turn,2);
 }finally{f.close();}
});

test('invalid neighboring feedback preserves the engine and cannot contaminate a following valid swap',async()=>{
 const f=await fixture();try{
  const before=snapshot(f),pair=invalidPair(f);f.begin(pair);assert.deepEqual(snapshot(f),before,'invalid animation spends no move and consumes no RNG');
  const valid=firstMove(f);f.begin(valid.pair);assert(f.layer(),'valid presentation can begin immediately after invalid feedback');
  await wait(35);assert(f.layer());f.click('#skip-animation');f.clean();f.exact(valid.model);
  await wait(330);f.clean();f.exact(valid.model);assert.equal(f.life().life.lives,5);
 }finally{f.close();}
});

for(const interruption of ['visibilitychange','pagehide','resize','home'])test(interruption+' removes temporary stones while preserving the already committed move',async()=>{
 const f=await fixture();try{
  const {model,pair}=firstMove(f);f.begin(pair);assert(f.layer());
  if(interruption==='home')f.click('#game-home');
  else if(interruption==='visibilitychange'){Object.defineProperty(f.d,'hidden',{configurable:true,value:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));}
  else f.w.dispatchEvent(new f.w.Event(interruption));
  f.clean();assert.deepEqual(snapshot(f),plain(model.snapshot()));assert.equal(f.life().life.lives,5);await wait(20);f.clean();
 }finally{f.close();}
});

test('reduced motion creates no moving layer and finishes the same game result',async()=>{
 const f=await fixture({reduced:true});try{const {model,pair}=firstMove(f);f.begin(pair);await f.idle();f.clean();f.exact(model);assert.equal(f.calls(),0,'reduced motion does not invoke animations');}finally{f.close();}
});

test('changing motion preference during a swap clears its visual owner without replaying the move',async()=>{
 const f=await fixture();try{const {model,pair}=firstMove(f);f.begin(pair);assert(f.layer());const select=f.node('#setting-motion');select.value='reduce';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));await f.idle();f.clean();f.exact(model);await wait(30);f.exact(model);}finally{f.close();}
});

for(const failAt of [1,2])test('animation API failure '+failAt+' cleans even a partially created pair and settles the exact result',async()=>{
 const f=await fixture({failAt});try{const {model,pair}=firstMove(f);f.begin(pair);await f.idle();f.clean();f.exact(model);assert.equal(f.life().life.lives,5);}finally{f.close();}
});

for(const failAt of [1,2])test('invalid feedback API failure '+failAt+' restores both sources and never changes game state',async()=>{
 const f=await fixture({failAt});try{
  const before=snapshot(f);f.begin(invalidPair(f));await wait(5);f.clean();assert.deepEqual(snapshot(f),before);assert.equal(f.life().life.lives,5);
  const valid=firstMove(f);f.begin(valid.pair);assert(f.layer(),'an animation failure cannot lock the next valid move');f.click('#skip-animation');f.clean();f.exact(valid.model);
 }finally{f.close();}
});

(async()=>{let failed=0;for(const {name,run}of tests)try{await run();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+': '+error.message);}assert.deepEqual(errors,[],'no uncaught browser errors');assert.deepEqual(unhandled,[],'no unhandled aborted animation promises');console.log(`Swap lifecycle checks: ${tests.length-failed}/${tests.length} passed.`);if(failed)process.exitCode=1;})().catch(error=>{console.error(error);process.exitCode=1;});
