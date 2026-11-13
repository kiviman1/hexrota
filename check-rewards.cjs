/* Portable feedback rules: earned events, replay safety and classic-engine invariants. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'dist');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const rules=JSON.parse(read('reward-rules.json'));
const Rewards=require('./dist/rewards.js');
const Adapter=require('./dist/reward-adapter.js');
const gameContext={window:{},performance};vm.createContext(gameContext);
for(const file of ['engine.js','levels.js','tutorials.js'])vm.runInContext(read(file),gameContext);
const {HexMatch,HEX_LEVELS,HEX_TUTORIALS}=gameContext.window;
const tests=[];
function test(name,run){tests.push({name,run});}
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
function input(waves=[{}],options={},state=Rewards.createState('test')){
 let score=state.lastScore,green=state.lastGreen;
 const normalized=waves.map((item,index)=>{
  const w={wave:index+1,gain:9,matched:3,maxRun:3,runCount:1,crossAxes:1,newGreen:0,layersCleared:3,doubleCleared:0,...item};
  score+=w.gain;green+=w.newGreen;return {...w,scoreAfter:score,greenAfter:green};
 });
 return {attemptId:state.attemptId,turn:state.lastTurn+1,tutorial:false,totalCells:100,target:9999,scoreBefore:state.lastScore,scoreAfter:score,greenBefore:state.lastGreen,greenAfter:green,movesLeft:10,status:'playing',waves:normalized,...options};
}
function evaluate(waves=[{}],options={},state=Rewards.createState('test'),config=rules){return Rewards.evaluate(input(waves,options,state),state,config);}
const run=n=>({matched:n,maxRun:n,gain:n*3,layersCleared:n});

// Use actual hex topology to distinguish long runs, crossings and disjoint triples.
const cells=[];for(let q=-3;q<=3;q++)for(let r=-3;r<=3;r++)if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=3)cells.push({q,r,layers:2});
const level={id:'shape',rulesVersion:'classic-v4',cells,initial:cells.map((_,i)=>100+i),palette:Array.from({length:200},(_,i)=>i+1),seed:9173,moves:10,target:9999,solution:[]};
const shapeEngine=new HexMatch(level),at=(q,r)=>cells.findIndex(c=>c.q===q&&c.r===r);
function shaped(groups,{remaining=2}={}){
 const values=level.initial.slice();for(const {value,coords}of groups)for(const [q,r]of coords){assert(at(q,r)>=0);values[at(q,r)]=value;}
 const matched=Array.from(shapeEngine.findMatches(values));assert(matched.length>=3);
 const before={score:0,layers:cells.map(()=>remaining),turn:0,movesLeft:10};
 const layers=before.layers.map((v,i)=>v-Number(matched.includes(i))),gain=matched.reduce((n,i)=>n+values[i],0);
 const result={ok:true,scoreGain:gain,frames:[{before:values,matched,layers,scoreGain:gain}]};
 const after={score:gain,turn:1,movesLeft:9,status:'playing',topology:shapeEngine.topology};
 return {before,result,after,summary:Adapter.summarize(level,before,result,after,'shape')};
}

test('canonical JSON and browser/CommonJS rewards expose the same deterministic rules',()=>{
 Rewards.validateRules(rules);
 const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(read('reward-rules.js'),sandbox);vm.runInContext(read('rewards.js'),sandbox);
 assert.deepEqual(plain(sandbox.window.HEX_REWARD_RULES),rules,'generated browser rules equal canonical JSON');
 const state=Rewards.createState('same'),move=input([run(4)],{},state);
 assert.deepEqual(plain(sandbox.window.HexRewards.evaluate(move,state,rules)),Rewards.evaluate(move,state,rules));
});

test('an ordinary triple remains subtle and produces no headline, multiplier or extra points',()=>{
 const move=input(),before=JSON.stringify(move),result=Rewards.evaluate(move,Rewards.createState('test'),rules);
 assert.equal(result.plan.waves[0].tier,0);assert.equal(result.plan.waves[0].reason,'match');assert.equal(result.plan.waves[0].labelKey,'');assert.equal(result.plan.headline,null);
 assert.equal(result.nextState.lastScore,9);assert.equal(result.nextState.lastTurn,1);assert.equal(JSON.stringify(move),before);
 assert(!Object.hasOwn(result.plan,'scoreGain'));assert(!Object.hasOwn(result.plan.waves[0],'multiplier'));
});

test('real straight four/five/six runs earn distinct tiers while separate triples never become a six-run',()=>{
 for(const [size,tier]of [[4,1],[5,2],[6,3]]){
  const coords=Array.from({length:size},(_,i)=>[0,i-3]);
  const {summary}=shaped([{value:3,coords}]);
  assert.equal(summary.waves[0].maxRun,size);assert.equal(summary.waves[0].runCount,1);assert.equal(summary.waves[0].crossAxes,1);
  const evaluated=Rewards.evaluate(summary,Rewards.createState('shape'),rules);assert.equal(evaluated.plan.waves[0].tier,tier);assert.equal(evaluated.plan.headline.reason,'long_run');assert.equal(evaluated.plan.headline.value,size);
 }
 const {summary}=shaped([{value:7,coords:[[-2,0],[-2,1],[-2,2]]},{value:8,coords:[[2,-2],[2,-1],[2,0]]}]);
 const w=summary.waves[0];assert.equal(w.matched,6);assert.equal(w.maxRun,3);assert.equal(w.runCount,2);assert.equal(w.crossAxes,1);
 const result=Rewards.evaluate(summary,Rewards.createState('shape'),rules);assert.equal(result.plan.headline.reason,'simultaneous');assert.equal(result.plan.headline.tier,1);assert.equal(result.nextState.lastScore,45);
});

test('two and three actual intersecting axes are recognized without double-counting shared cells',()=>{
 const cross=[[-1,0],[0,0],[1,0],[0,-1],[0,1]];
 for(const [axes,coords,tier,count]of [[2,cross,2,5],[3,[...cross,[-1,1],[1,-1]],3,7]]){
  const {summary}=shaped([{value:2,coords}]);const w=summary.waves[0];assert.equal(w.crossAxes,axes);assert.equal(w.maxRun,3);assert.equal(w.matched,count);assert.equal(w.gain,count*2);
  const result=Rewards.evaluate(summary,Rewards.createState('shape'),rules);assert.equal(result.plan.headline.reason,'cross');assert.equal(result.plan.headline.value,axes);assert.equal(result.plan.headline.tier,tier);
 }
});

test('ground and completed double layers use actual terrain deltas and integer thresholds',()=>{
 const {summary}=shaped([{value:3,coords:[[0,-2],[0,-1],[0,0],[0,1]]}],{remaining:1});
 const w=summary.waves[0];assert.equal(w.newGreen,4);assert.equal(w.layersCleared,4);assert.equal(w.doubleCleared,4);
 const result=Rewards.evaluate(summary,Rewards.createState('shape'),rules);assert.equal(result.plan.headline.reason,'doubles');assert.equal(result.plan.headline.tier,2);
 const config=plain(rules);config.runThresholds=[8,9,10];
 const features={matched:4,maxRun:4,gain:12,layersCleared:4,newGreen:4};
 assert.equal(evaluate([features],{totalCells:20},undefined,config).plan.headline.reason,'green','exactly20% qualifies');
 assert.equal(evaluate([features],{totalCells:21},undefined,config).plan.headline,null,'just under20% does not qualify');
});

test('cascade tiers and headline priority reflect severity first, then the earned shape',()=>{
 for(const [length,tier]of [[1,0],[2,1],[3,2],[4,2],[5,3]]){
  const result=evaluate(Array.from({length},()=>({})));assert.equal(result.plan.waves.at(-1).tier,tier);if(length>1)assert.equal(result.plan.headline.reason,'chain');
 }
 const cross={matched:5,maxRun:3,runCount:2,crossAxes:2,gain:15,layersCleared:5};
 const epic=evaluate([cross,{},{},{},{}]);assert.equal(epic.plan.headline.reason,'chain');assert.equal(epic.plan.headline.wave,5,'epic late chain outranks earlier tier2 cross');
 const tied=evaluate([cross,{},{}]);assert.equal(tied.plan.headline.reason,'cross','cross wins a same-tier tie');
 const same=evaluate([run(5),run(5)]);assert.equal(same.plan.headline.wave,1,'equally strong same reasons keep the earlier wave');
});

test('milestones emit only the highest crossed threshold per objective and mark every passed threshold',()=>{
 const move=input([{gain:6,newGreen:3},{gain:14,matched:5,maxRun:5,layersCleared:5,newGreen:5}],{totalCells:10,target:20});
 const result=Rewards.evaluate(move,Rewards.createState('test'),rules);
 assert.deepEqual(result.plan.milestones.map(m=>[m.kind,m.percent,m.wave]),[['score',100,2],['ground',75,2]]);
 assert.equal(result.nextState.scoreMask,3);assert.equal(result.nextState.groundMask,7);assert.equal(result.plan.headline.reason,'score_goal');assert.equal(result.plan.headline.tier,2);
 assert(result.plan.milestones.every(m=>m.id.startsWith('test:1:milestone:')));
 const noRepeat=evaluate([{}],{totalCells:10,target:20},result.nextState);assert.equal(noRepeat.plan.milestones.length,0,'already passed objectives do not pulse again');
});

test('objective completion and last-move victory override ordinary headlines and bypass tutorial caps',()=>{
 const first=evaluate([{...run(7),newGreen:7}],{totalCells:10,target:30,tutorial:true});
 assert.equal(first.plan.waves[0].tier,1);assert.equal(first.plan.waves[0].rawTier,3);
 const won=evaluate([{newGreen:3}],{totalCells:10,target:30,tutorial:true,movesLeft:0,status:'won'},first.nextState);
 assert.equal(won.plan.headline.reason,'last_move_win');assert.equal(won.plan.headline.tier,3);assert.equal(won.plan.headline.completion,true);assert.equal(won.plan.headline.value,0);
 assert.equal(won.plan.milestones.length,2);assert(won.plan.milestones.every(m=>m.percent===100));
 const ordinaryWin=evaluate([{...run(7),newGreen:7},{newGreen:3}],{totalCells:10,target:30,movesLeft:2,status:'won'});assert.equal(ordinaryWin.plan.headline.reason,'win');
 const groundFirst=evaluate([{...run(7),newGreen:7}],{totalCells:10,target:9999});
 const ground=evaluate([{newGreen:3}],{totalCells:10,target:9999},groundFirst.nextState);assert.equal(ground.plan.headline.reason,'ground_goal');assert.equal(ground.plan.headline.tier,2);
});

test('epic accents require two intervening valid turns without changing the truthful achievement label',()=>{
 let state=Rewards.createState('test');
 const one=evaluate([run(6)],{},state);state=one.nextState;assert.equal(one.plan.waves[0].tier,3);assert.equal(state.lastAccentTurn,1);
 const two=evaluate([run(6)],{},state);state=two.nextState;assert.equal(two.plan.waves[0].tier,2);assert.equal(two.plan.waves[0].rawTier,3);assert.equal(two.plan.headline.reason,'long_run');assert.equal(state.lastAccentTurn,1);
 state=evaluate([{}],{},state).nextState;
 const four=evaluate([run(6)],{},state);assert.equal(four.plan.waves[0].tier,3);assert.equal(four.nextState.lastAccentTurn,4);
});

test('duplicates, stale input and invalid continuity never emit or change reward state',()=>{
 const firstMove=input(),first=Rewards.evaluate(firstMove,Rewards.createState('test'),rules),second=evaluate([{}],{},first.nextState);
 for(const old of [firstMove,{...firstMove,waves:null}]){
  const copy=plain(second.nextState),result=Rewards.evaluate(old,copy,rules);assert(result.plan.duplicate);assert.equal(result.plan.waves.length,0);assert.equal(result.plan.headline,null);assert.equal(result.plan.milestones.length,0);assert.deepEqual(result.nextState,second.nextState);assert.deepEqual(copy,second.nextState);
 }
 const bad=input();bad.turn=2;assert.throws(()=>Rewards.evaluate(bad,Rewards.createState('test'),rules),/continuity/i);
 const wrong=input();wrong.attemptId='other';assert.throws(()=>Rewards.evaluate(wrong,Rewards.createState('test'),rules),/attempt/i);
 for(const mutate of [m=>m.scoreAfter++,m=>m.waves[0].greenAfter++,m=>m.status='won',m=>m.waves[0].maxRun=4,m=>m.waves[0].gain=NaN,m=>m.movesLeft=2147483648,m=>m.turn=1.5]){
  const move=input();mutate(move);assert.throws(()=>Rewards.evaluate(move,Rewards.createState('test'),rules));
 }
});

test('evaluation is immutable, deterministic and independent of clocks or randomness',()=>{
 const poison=()=>{throw new Error('clock or random use is forbidden');},math=Object.create(Math);math.random=poison;
 const sandbox={window:{},Math:math,Date:{now:poison},performance:{now:poison}};vm.createContext(sandbox);vm.runInContext(read('rewards.js'),sandbox);
 const state=freeze(Rewards.createState('test')),move=freeze(input([run(5)])),config=freeze(plain(rules));
 const before=JSON.stringify({state,move,config});const expected=Rewards.evaluate(move,state,config);
 assert.deepEqual(plain(sandbox.window.HexRewards.evaluate(move,state,config)),expected);assert.deepEqual(Rewards.evaluate(move,state,config),expected);assert.equal(JSON.stringify({state,move,config}),before);
 assert.equal(expected.plan.headline.id,'test:1:headline');assert.equal(expected.plan.waves[0].id,'test:1:wave:1');
});

test('all authored routes keep identical engine state and silently restore the same director history',()=>{
 let moves=0;
 for(const lesson of [...HEX_TUTORIALS,...HEX_LEVELS]){
  const game=new HexMatch(lesson),control=new HexMatch(lesson);let state=Rewards.createState(String(lesson.id)),lastPlan=null;
  for(const pair of lesson.solution){
   const before=game.snapshot(),result=game.swap(...pair);assert(result.ok);control.swap(...pair);
   const checkpoint=plain(game.snapshot()),raw=JSON.stringify({before,result,checkpoint});
   const normalized=Adapter.summarize(lesson,before,result,game);
   const planned=Rewards.evaluate(normalized,state,rules);state=planned.nextState;lastPlan=planned.plan;
   assert.equal(JSON.stringify({before,result,checkpoint}),raw,'adapter and director do not mutate move data');assert.deepEqual(plain(game.snapshot()),plain(control.snapshot()),'feedback cannot change board, score, moves, history or RNG');assert.equal(game.score,normalized.scoreAfter);moves++;
  }
  assert.equal(game.status,'won');assert.equal(game.snapshot().version,4);assert.equal(game.snapshot().rulesVersion,'classic-v4');
  const checkpoint=plain(game.snapshot()),restored=Adapter.restore(lesson,checkpoint,rules,HexMatch,Rewards);
  assert.deepEqual(restored.state,state);assert.deepEqual(restored.lastPlan,lastPlan);assert.deepEqual(plain(game.snapshot()),checkpoint,'restoration cannot rewrite the existing engine');
 }
 assert.equal(moves,74,'seven tutorial swaps and sixty-seven campaign swaps are exercised');
 assert.equal(Adapter.summarize(level,{}, {ok:false},{}),null,'invalid swaps produce no normalized reward input');
});

test('shared golden vectors agree with the portable reference output',()=>{
 const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/reward-vectors.json'),'utf8'));
 assert.deepEqual(fixture.rules,rules);
 for(const item of fixture.cases){
  if(item.error)assert.throws(()=>Rewards.evaluate(item.input,item.state,fixture.rules),item.name);
  else assert.deepEqual(Rewards.evaluate(item.input,item.state,fixture.rules),item.expected,item.name);
 }
 assert(fixture.cases.length>=10,'portable vectors cover multiple earned-event and validation cases');
});

let failures=0;for(const {name,run}of tests){try{run();console.log('✓ '+name);}catch(error){failures++;console.error('✗ '+name+'\n'+error.stack);}}
if(failures)process.exitCode=1;else console.log('Reward rules passed: truthful patterns, bounded tiers, objective milestones, deterministic replay, immutable classic scoring and shared vectors.');
