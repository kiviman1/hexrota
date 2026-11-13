import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js'])vm.runInContext(fs.readFileSync(new URL('dist/'+file,import.meta.url),'utf8'),context);
const {HexMatch,HEX_LEVELS}=context.window;
const plain=value=>JSON.parse(JSON.stringify(value));
const cells=[];
for(let q=-2;q<=2;q++)for(let r=-2;r<=2;r++)if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=2)cells.push({q,r,layers:2});
const at=(q,r)=>cells.findIndex(c=>c.q===q&&c.r===r);
const base={id:'fixture',rulesVersion:'classic-v4',cells,initial:cells.map((_,i)=>100+i),palette:Array.from({length:200},(_,i)=>i+1),seed:9731,moves:10,target:999999,solution:[]};
const e=new HexMatch(base);
assert.equal(e.snapshot().version,4,'Checkpoints use the strengthened classic rules version');
assert.equal(Object.keys(e.snapshot()).sort().join(','),'history,layers,movesLeft,rngState,rulesVersion,score,turn,values,version','Checkpoint contains only classic state');
// Each axial direction independently recognizes straight runs, never bent clusters.
for(const [dq,dr] of [[1,0],[0,1],[1,-1]]){
 const values=base.initial.slice(),expected=[];
 for(let k=-1;k<=1;k++){const i=at(k*dq,k*dr);values[i]=7;expected.push(i);}
 assert.deepEqual(plain(e.findMatches(values)),expected.sort((a,b)=>a-b),'Straight triples on every hex axis');
}
const bent=base.initial.slice();for(const p of [[0,0],[1,0],[1,-1]])bent[at(...p)]=7;
assert.equal(e.findMatches(bent).length,0,'A bent cluster is not a straight match');
const state=JSON.stringify(e.snapshot());
assert.equal(e.swap(at(-2,0),at(2,0)).reason,'neighbor');
assert.equal(JSON.stringify(e.snapshot()),state,'Non-neighbor swap cannot mutate score, moves or RNG');
assert.equal(e.swap(at(0,0),at(1,0)).reason,'no-match');
assert.equal(JSON.stringify(e.snapshot()),state,'Non-matching adjacent swap rolls back every state field');
assert.equal(e.swap(-1,0).ok,false);
// Stable constructed cross: its middle belongs to two matches but loses one layer per wave.
const crossValues=base.initial.slice();
for(const p of [[-1,0],[1,0],[0,-1],[0,1],[1,-1]])crossValues[at(...p)]=7;
crossValues[at(0,0)]=8;
const crossLevel={...base,initial:crossValues,moves:1};
const cross=new HexMatch(crossLevel);
assert.equal(cross.findMatches().length,0);
const cr=cross.swap(at(0,0),at(1,-1));
assert.equal(cr.ok,true);assert(cr.frames.length>=1);
assert.equal(cr.frames[0].matched.length,5,'Intersecting triples remove five unique tiles');
assert.equal(cr.frames[0].scoreGain,35,'Intersection scores each tile once');
assert.equal(cr.frames[0].layers[at(0,0)],1,'Intersection damages middle ground only once per wave');
assert.equal(cross.movesLeft,0);assert.equal(cross.status,'lost','Exhausted moves lose before completing ground');
// Completing both goals with the final legal move wins; overshooting a threshold is fine.
const winner=new HexMatch({...crossLevel,target:30});
winner.layers.fill(0);for(const p of [[-1,0],[1,0],[0,-1],[0,1],[0,0]])winner.layers[at(...p)]=1;
assert.equal(winner.swap(at(0,0),at(1,-1)).ok,true);
assert.equal(winner.movesLeft,0);assert.equal(winner.status,'won');
assert.equal(winner.swap(0,1).reason,'won');
assert.equal(winner.hint(),null);
// Real deterministic refills, gravity and cascades on a production-sized fixture.
function stableLevel(seed){
 const level={...base,id:'seed-'+seed,palette:[1,2,3,4],seed,initial:cells.map(()=>1),moves:16};
 const g=new HexMatch(level);g._stableBoard();level.initial=plain(g.values);level.seed=g.rngState;
 assert.equal(g.findMatches().length,0);assert(g.legalMoves().length>0);
 return level;
}
let cascadeLevel,cascadePair;
search:for(let seed=1;seed<=80;seed++){
 const level=stableLevel(seed),g=new HexMatch(level);
 for(const pair of g.legalMoves()){
  const candidate=new HexMatch(level);const result=candidate.swap(...pair);
  if(result.frames.length>=2){cascadeLevel=level;cascadePair=plain(pair);break search;}
 }
}
assert(cascadeLevel,'Fixture search finds a real cascade');
const a=new HexMatch(cascadeLevel),b=new HexMatch(cascadeLevel);
const ar=a.swap(...cascadePair),br=b.swap(...cascadePair);
assert.deepEqual(plain(ar),plain(br),'Same seed and swap produce identical cascade frames');
assert.equal(JSON.stringify(a.snapshot()),JSON.stringify(b.snapshot()));
assert.equal(ar.scoreGain,ar.frames.reduce((n,f)=>n+f.scoreGain,0));
assert.equal(a.score,ar.scoreGain);
assert.equal(a.turn,1);assert.equal(a.movesLeft,cascadeLevel.moves-1,'An entire cascade costs one move');
for(const frame of ar.frames){
 assert.equal(new Set(frame.matched).size,frame.matched.length);
 assert.equal(frame.scoreGain,frame.matched.reduce((n,i)=>n+frame.before[i],0));
 const removed=new Set(frame.matched);
 for(const column of a.topology.columns){
  const survivors=column.filter(i=>!removed.has(i)).map(i=>frame.before[i]);
  const settled=column.slice(column.length-survivors.length).map(i=>frame.after[i]);
  assert.deepEqual(plain(settled),plain(survivors),'Gravity preserves column survivor order at the bottom');
 }
}
assert.equal(a.findMatches().length,0,'A resolved board is stable');
// Independent coordinate oracle: only new three-cell windows involving the new slot count.
const byCoord=new Map(cells.map((cell,i)=>[`${cell.q},${cell.r}`,i]));
function localTriples(values,index){
 let count=0;const cell=cells[index];
 for(const [dq,dr]of[[1,0],[0,1],[1,-1]])for(let start=-2;start<=0;start++){
  const ids=[0,1,2].map(offset=>byCoord.get(`${cell.q+(start+offset)*dq},${cell.r+(start+offset)*dr}`));
  if(ids.some(i=>i===undefined))continue;
  if(values[ids[0]]!=null&&ids.every(i=>values[i]===values[ids[0]]))count++;
 }
 return count;
}
let checkedRefills=0,foundNaturalChain=false;
for(const frame of ar.frames){
 assert.equal(frame.compacted.length,cells.length,'Gravity compaction is observable before refill');
 const partial=plain(frame.compacted),seen=new Set();
 assert.equal(frame.refill.length,frame.matched.length,'Every cleared tile receives one new number');
 for(const refill of frame.refill){
  assert.equal(partial[refill.index],null,'Only a newly opened slot is refilled');
  assert(!seen.has(refill.index),'A slot is filled once in a wave');seen.add(refill.index);
  const counts=cascadeLevel.palette.map(value=>{partial[refill.index]=value;return localTriples(partial,refill.index);});
  const minimum=Math.min(...counts),chosen=cascadeLevel.palette.indexOf(refill.value);
  assert(chosen>=0);assert.equal(counts[chosen],minimum,'Refill chooses a minimum-triple candidate');
  assert.equal(refill.forced,minimum>0,'Only unavoidable immediate triples are marked forced');
  partial[refill.index]=refill.value;checkedRefills++;
 }
 assert.deepEqual(partial,plain(frame.after),'Recorded sequential refills reproduce the wave output');
 if(a.findMatches(frame.compacted).length)foundNaturalChain=true;
}
assert(checkedRefills>0,'Production cascade exercises controlled refills');
assert(foundNaturalChain,'Existing settled survivors can still create natural gravity chains');
assert(ar.frames.length<=32,'A swap has a finite cascade limit');
// Direct gravity consumes precisely one seeded RNG draw for each new tile.
const gravityOnly=new HexMatch(cascadeLevel),removed=[at(0,0),at(0,1),at(1,-1)];
let expectedRng=gravityOnly.rngState;
for(const _ of removed){let x=expectedRng;x^=x<<13;x^=x>>>17;x^=x<<5;expectedRng=x>>>0;}
const gravityResult=gravityOnly._gravity(removed);
assert.equal(gravityOnly.rngState,expectedRng,'Each replacement consumes exactly one random draw');
assert.equal(gravityResult.refill.length,removed.length);
// All four values can be blocked at one slot; fallback must be finite and minimal.
const blocked=new HexMatch({...base,palette:[1,2,3,4]});
for(const [q,r,value]of[[-2,0,1],[-1,0,1],[1,0,2],[2,0,2],[0,-2,3],[0,-1,3],[0,1,4],[0,2,4]])blocked.values[at(q,r)]=value;
blocked.values[at(0,0)]=null;
const forced=blocked._fillVacancies();
assert.equal(forced.length,1);assert.equal(forced[0].index,at(0,0));
assert.equal(forced[0].forced,true,'An unavoidable candidate is explicit, never retried forever');
assert.equal(forced[0].minMatches,1);assert.equal(localTriples(blocked.values,at(0,0)),1);
// Neither goal by itself finishes the level.
assert.equal(new HexMatch({...base,target:0}).status,'playing','Score alone cannot win without green ground');
const floorOnly=new HexMatch({...crossLevel,target:999999});floorOnly.layers.fill(0);
assert.equal(floorOnly.status,'playing','Green ground alone cannot win below the score target');
assert.equal(floorOnly.swap(at(0,0),at(1,-1)).ok,true);assert.equal(floorOnly.status,'lost');


const restored=new HexMatch(cascadeLevel,plain(a.snapshot()));
assert.equal(JSON.stringify(restored.snapshot()),JSON.stringify(a.snapshot()));
const following=a.legalMoves()[0];assert(following);
assert.deepEqual(plain(restored.swap(...following)),plain(a.swap(...following)),'Checkpoint replay preserves future refills');
assert.equal(JSON.stringify(restored.snapshot()),JSON.stringify(a.snapshot()));
assert.throws(()=>new HexMatch(cascadeLevel,{...plain(a.snapshot()),version:2}),'Old refill rules cannot restore into the new engine');
assert.throws(()=>new HexMatch(cascadeLevel,{...plain(a.snapshot()),movesLeft:-1}));
assert.throws(()=>new HexMatch(cascadeLevel,{...plain(a.snapshot()),values:[]}));
// Checkpoints must follow actual deterministic history, not just pass shape checks.
for(const field of ['score','values','layers','rngState']){
 const tampered=plain(a.snapshot());
 if(field==='score')tampered.score++;
 if(field==='values')tampered.values[0]=cascadeLevel.palette.find(v=>v!==tampered.values[0]);
 if(field==='layers')tampered.layers[0]=tampered.layers[0]>0?tampered.layers[0]-1:1;
 if(field==='rngState')tampered.rngState=((tampered.rngState+1)>>>0)||1;
 assert.throws(()=>new HexMatch(cascadeLevel,tampered),`Tampered ${field} cannot be restored`);
}
const originalBeforeClone=JSON.stringify(a.snapshot()),copy=a.clone();
assert.equal(JSON.stringify(copy.snapshot()),originalBeforeClone,'Search clone starts identical');
copy.values[0]=cascadeLevel.palette.find(v=>v!==copy.values[0]);copy.layers[0]=0;copy.score++;
copy.rngState=((copy.rngState+1)>>>0)||1;copy.history[0][0]=-1;
assert.equal(JSON.stringify(a.snapshot()),originalBeforeClone,'Mutating a clone cannot mutate the original arrays or RNG');

// Dead boards are reshuffled without consuming moves, painting ground, or giving score.
const dead=new HexMatch({...stableLevel(947),palette:[1,2,3,4,5,6]});let foundDead=false;
let randomState=71539;const random=()=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return randomState>>>0;};
for(let n=0;n<30000;n++){
 dead.values=dead.values.map(()=>1+random()%6);
 if(!dead.findMatches().length&&!dead.legalMoves().length){foundDead=true;break;}
}
assert(foundDead,'Dead-board fixture found');
dead.layers=dead.layers.map((_,i)=>i%3);dead.score=23;
const ground=plain(dead.layers),moves=dead.movesLeft,turn=dead.turn;
assert.equal(dead._ensurePlayable(),true);
assert.equal(dead.findMatches().length,0);assert(dead.legalMoves().length>0);
assert.deepEqual(plain(dead.layers),ground);assert.equal(dead.score,23);assert.equal(dead.movesLeft,moves);assert.equal(dead.turn,turn);
const hintBefore=JSON.stringify(dead.snapshot()),hint=dead.hint({maxMs:1,maxDepth:1});
assert(hint?.pair);assert(dead.legalMoves().some(p=>p[0]===hint.pair[0]&&p[1]===hint.pair[1]));
assert.equal(JSON.stringify(dead.snapshot()),hintBefore,'Hint search cannot mutate gameplay');
// Authored levels prove reproducible solutions and valid hints at every canonical prefix.
let checkedLevels=0;
for(const [n,level] of (HEX_LEVELS||[]).entries()){
 if(!Array.isArray(level.initial))continue;
 const game=new HexMatch(level);assert.equal(game.findMatches().length,0);assert(game.legalMoves().length>0);
 for(const pair of level.solution){
  const before=JSON.stringify(game.snapshot()),suggested=game.hint();
  assert(suggested?.pair,`L${n+1} has a hint`);
  assert.deepEqual(plain(suggested.pair),plain(pair));
  assert.equal(JSON.stringify(game.snapshot()),before);
  assert.equal(game.swap(...pair).ok,true,`L${n+1} solution move is legal`);
  assert.equal(game.findMatches().length,0);
 }
 assert.equal(game.status,'won',`L${n+1} wins`);assert.equal(game.covered,level.cells.length);assert(game.score>=level.target);
 const reload=new HexMatch(level,plain(game.snapshot()));assert.equal(reload.status,'won');
 game.reset();assert.equal(game.movesLeft,level.moves);assert.equal(game.score,0);assert.deepEqual(plain(game.values),plain(level.initial));
 checkedLevels++;
}
console.log(`Classic engine checks passed: three axes, no-op rollback, controlled refills, surviving gravity chains, deterministic state, replay validation, last-move victory, dead-board recovery, bounded hints and ${checkedLevels} authored solutions.`);
