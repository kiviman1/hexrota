/* Pure visual scheduler checks using resolved frames from the real engine. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Pipeline=require('./dist/move-presentation.js');
const source=file=>fs.readFileSync(__dirname+'/dist/'+file,'utf8');
const context={window:{}};vm.createContext(context);
for(const file of ['engine.js','levels.js','tutorials.js'])vm.runInContext(source(file),context);
const motion={swap:300,digit:240,spread:180,collectPulse:100,pop:200,hold:140,flight:380,count:140,arrival:220,burst:220,ring:300,particle:320,matchPause:430,fall:380,fallStagger:70,columnDelay:16,invalid:280,budget:3300};
const plain=value=>JSON.parse(JSON.stringify(value)),fixtures=new Map(),tests=[];
for(const level of context.window.HEX_LEVELS){
 const game=new context.window.HexMatch(level);
 for(const swap of level.solution){const before=game.snapshot(),result=game.swap(...swap);if(!fixtures.has(result.frames.length))fixtures.set(result.frames.length,plain({before,final:game.snapshot(),frames:result.frames,swap,motion}));}
}
for(const count of [1,2,4,5,10])assert(fixtures.has(count),'actual engine fixture has '+count+' waves');
function test(name,run){tests.push({name,run});}
function setup(count=1,override={}){
 const plan=Pipeline.plan(fixtures.get(count)),controller=new AbortController(),phases=[],calls=[],pauses=[],token=Object.freeze({id:1,attemptId:'a-real-fixture',generation:0});
 let current=true;
 const adapters={
  swap(p){calls.push(['swap',p]);},match(w){calls.push(['match',w.wave]);},clear(w){calls.push(['clear',w.wave]);return Promise.resolve();},
  fall(w){calls.push(['fall',w.wave]);return w.motion.fall;},refill(w){calls.push(['refill',w.wave]);return w.motion.fall+w.motion.fallStagger;},
  settle(p){calls.push(['settle',p]);},pause(ms){pauses.push(ms);return Promise.resolve();},...override
 };
 const options={plan,attemptId:'a-real-fixture',token,signal:controller.signal,isCurrent:(attemptId,operation)=>current&&attemptId==='a-real-fixture'&&operation===token,canAnimate:()=>true,adapters,onPhase:event=>phases.push(event)};
 return {plan,controller,phases,calls,pauses,adapters,options,retire(){current=false;}};
}
const expectedPhases=count=>['SWAP',...Array.from({length:count},(_,i)=>[...(i?['CASCADE']:[]),'MATCH','CLEAR','FALL','REFILL']).flat(),'SETTLE'];

test('declared phases are the seven independent visual phases',()=>{
 assert.deepEqual(Pipeline.PHASES,['SWAP','MATCH','CLEAR','FALL','REFILL','CASCADE','SETTLE']);assert(Object.isFrozen(Pipeline.PHASES));
});
for(const count of [1,2,5,10])test('real '+count+'-wave move visits every resolved wave in order',async()=>{
 const f=setup(count),result=await Pipeline.play(f.options);
 assert.deepEqual(result,{status:'succeeded',phase:'SETTLE',wavesPresented:count});
 assert.deepEqual(f.phases.map(e=>e.phase),expectedPhases(count));
 assert.deepEqual(f.calls.filter(c=>c[0]==='match').map(c=>c[1]),Array.from({length:count},(_,i)=>i+1));
 assert(f.phases.every(e=>Object.isFrozen(e)&&e.attemptId===f.options.attemptId&&e.token===f.options.token));
 assert(f.pauses.every(ms=>ms>=0));
});
test('plan is an independent deeply frozen own-data projection',()=>{
 const input=plain(fixtures.get(5)),before=plain(input),plan=Pipeline.plan(input);
 assert.deepEqual(input,before,'planning does not mutate actual engine result');
 input.frames[0].matched.length=0;input.final.values[0]=99;input.before.layers[0]=99;input.motion.swap=1;
 assert.deepEqual(plan.final,before.final);assert.deepEqual(plan.before,before.before);assert.deepEqual(plan.waves[0].frame,before.frames[0]);
 for(const item of [plan,plan.before,plan.final,plan.waves,plan.waves[0],plan.waves[0].frame,plan.waves[0].frame.matched,plan.waves[0].motion])assert(Object.isFrozen(item));
 assert.throws(()=>{plan.waves[0].frame.matched.push(99);},TypeError);
});
test('wave projections use actual frames and exact unmultiplied score prefix',()=>{
 const input=fixtures.get(5),plan=Pipeline.plan(input);let score=input.before.score,layers=input.before.layers;
 for(const [index,wave]of plan.waves.entries()){
  assert.deepEqual(wave.before,{values:input.frames[index].before,layers,score,movesLeft:input.final.movesLeft});score+=input.frames[index].scoreGain;layers=input.frames[index].layers;
  assert.deepEqual(wave.after,{values:input.frames[index].after,layers,score,movesLeft:input.final.movesLeft});
  assert.deepEqual(wave.firstMoves,index?[]:[[input.swap[0],input.swap[1]],[input.swap[1],input.swap[0]]]);
 }
 assert.equal(score,input.final.score);
});
test('one/two-wave timing stays exact; longer sequences retain readable fall and sufficient watchdog',()=>{
 for(const count of [1,2])for(const wave of Pipeline.plan(fixtures.get(count)).waves)assert.deepEqual(wave.motion,motion);
 for(const count of [4,5,10]){
  const plan=Pipeline.plan(fixtures.get(count));assert(plan.scale>0&&plan.scale<1);
  const paced=plan.waves[0].motion,total=paced.digit+paced.spread+paced.pop+paced.hold+paced.flight+paced.count;
  assert(paced.fall>=280);assert(plan.budget>=motion.swap+5+count*Math.max(total,paced.matchPause+paced.fall+paced.fallStagger+10)+250);
 }
 assert(Pipeline.plan(fixtures.get(10)).budget>3300,'readability is not silently truncated by fixed deadline');
});
test('reduced motion settles once without any decorative adapter',async()=>{
 const f=setup(5);f.options.canAnimate=()=>false;
 assert.deepEqual(await Pipeline.play(f.options),{status:'succeeded',phase:'SETTLE',wavesPresented:0});
 assert.deepEqual(f.phases.map(e=>e.phase),['SETTLE']);assert.deepEqual(f.calls.map(c=>c[0]),['settle']);assert.deepEqual(f.pauses,[]);
});
test('motion preference changing between waves reveals final board without later waves',async()=>{
 const f=setup(5);let animate=true;f.options.canAnimate=()=>animate;f.adapters.refill=wave=>{animate=false;return wave.motion.fall;};
 const result=await Pipeline.play(f.options);assert.equal(result.status,'succeeded');assert.equal(result.wavesPresented,1);assert.equal(result.phase,'SETTLE');assert.equal(f.calls.filter(c=>c[0]==='match').length,1);
});
test('score and falling overlap without waiting for score before starting falls',async()=>{
 let release;const f=setup(1,{clear:()=>new Promise(resolve=>{release=resolve;}),refill(){assert.equal(typeof release,'function');release();return 10;}});
 const result=await Pipeline.play(f.options);assert.equal(result.status,'succeeded');assert.deepEqual(f.phases.map(e=>e.phase),expectedPhases(1));
});
for(const name of ['swap','match','clear','fall','refill','settle','pause'])for(const reject of [false,true])test(name+' adapter '+(reject?'rejection':'throw')+' returns visual failure only',async()=>{
 const input=plain(fixtures.get(1)),before=plain(input),f=setup(1,{[name](){if(reject)return Promise.reject(new Error(name+' rejected'));throw new Error(name+' threw');}});
 f.options.plan=Pipeline.plan(input);const result=await Pipeline.play(f.options);assert.equal(result.status,'failed');assert(result.error.includes(name));assert.deepEqual(input,before);assert(Object.isFrozen(result));
 const length=f.calls.length;await Promise.resolve();await Promise.resolve();assert.equal(f.calls.length,length,'no delayed effects after terminal response');
});
test('already aborted signal produces no effects',async()=>{
 const f=setup(1);f.controller.abort();assert.equal((await Pipeline.play(f.options)).status,'cancelled');assert.deepEqual(f.calls,[]);assert.deepEqual(f.phases,[]);
});
test('score rejection without an Error reason is still a visual failure',async()=>{
 const f=setup(1,{clear:()=>Promise.reject()});assert.equal((await Pipeline.play(f.options)).status,'failed');
});
test('abort races an adapter that never settles and permanently retires later phases',async()=>{
 const f=setup(5,{swap:()=>new Promise(()=>{})}),run=Pipeline.play(f.options);f.controller.abort();
 const result=await run;assert.equal(result.status,'cancelled');assert.deepEqual(f.phases.map(e=>e.phase),['SWAP']);assert.equal(f.calls.length,0);
});
test('late completion from retired attempt cannot render a later phase',async()=>{
 let release;const f=setup(5,{swap:()=>new Promise(resolve=>{release=resolve;})}),run=Pipeline.play(f.options);
 f.retire();release();const result=await run;assert.equal(result.status,'cancelled');assert.deepEqual(f.phases.map(e=>e.phase),['SWAP']);assert.equal(f.calls.length,0);
});
test('wrong Attempt ID is rejected without effects',async()=>{
 const f=setup(1);f.options.attemptId='another-attempt';assert.equal((await Pipeline.play(f.options)).status,'cancelled');assert.equal(f.calls.length,0);assert.equal(f.phases.length,0);
});
test('phase callback cancellation cannot trigger its adapter',async()=>{
 const f=setup(1);f.options.onPhase=e=>{f.phases.push(e);f.controller.abort();};
 assert.equal((await Pipeline.play(f.options)).status,'cancelled');assert.equal(f.calls.length,0);
});
test('throwing observer or identity guard fails safely',async()=>{
 const f=setup(1);f.options.onPhase=()=>{throw new Error('observer');};assert.equal((await Pipeline.play(f.options)).status,'failed');assert.equal(f.calls.length,0);
 const second=setup(1);second.options.isCurrent=()=>{throw new Error('identity');};assert.equal((await Pipeline.play(second.options)).status,'cancelled');assert.equal(second.calls.length,0);
});
test('assistance with no frames uses a pulse and settles without score or swap semantics',async()=>{
 const input=plain(fixtures.get(1));input.frames=[];input.swap=null;input.assistance={itemId:'greenBrush',index:0};input.final=plain(input.before);const f=setup(1);f.options.plan=Pipeline.plan(input);
 assert.deepEqual(await Pipeline.play(f.options),{status:'succeeded',phase:'SETTLE',wavesPresented:0});assert.deepEqual(f.phases.map(e=>e.phase),['SWAP','SETTLE']);assert.deepEqual(f.calls.map(c=>c[0]),['swap','settle']);
});
test('malformed plan data rejects without evaluating accessors or serialization hooks',()=>{
 for(const change of [x=>{x.before.values[0]=null;},x=>{x.final.layers.pop();},x=>{x.frames[0].matched.push(999);},x=>{x.frames[0].falls[0].to=999;},x=>{x.swap=[0,0];},x=>{x.motion.swap=-1;},x=>{x.assistance={itemId:'unknown',index:0};}]){const input=plain(fixtures.get(1));change(input);assert.throws(()=>Pipeline.plan(input),TypeError);}
 let reads=0;const input=plain(fixtures.get(1));Object.defineProperty(input,'toJSON',{get(){reads++;throw Error('getter ran');}});assert.throws(()=>Pipeline.plan(input),TypeError);assert.equal(reads,0);
 const cyclic=plain(fixtures.get(1));cyclic.extra=cyclic;assert.throws(()=>Pipeline.plan(cyclic),TypeError);
});

(async()=>{let failed=0;for(const {name,run}of tests)try{await run();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}if(failed)process.exitCode=1;else console.log('Move presentation checks: '+tests.length+' groups passed; real-engine 1/2/5/10-wave fixtures, immutable plans, exact phase order, visual faults and cancellation.');})().catch(error=>{console.error(error);process.exitCode=1;});
