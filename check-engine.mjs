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
const base={id:'fixture',cells,initial:cells.map((_,i)=>100+i),palette:Array.from({length:200},(_,i)=>i+1),seed:9731,moves:10,target:999999,solution:[]};
const e=new HexMatch(base);
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
const restored=new HexMatch(cascadeLevel,plain(a.snapshot()));
assert.equal(JSON.stringify(restored.snapshot()),JSON.stringify(a.snapshot()));
const following=a.legalMoves()[0];assert(following);
assert.deepEqual(plain(restored.swap(...following)),plain(a.swap(...following)),'Checkpoint replay preserves future refills');
assert.equal(JSON.stringify(restored.snapshot()),JSON.stringify(a.snapshot()));
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
const hintBefore=JSON.stringify(dead.snapshot()),hint=dead.hint();
assert(hint?.pair);assert(dead.legalMoves().some(p=>p[0]===hint.pair[0]&&p[1]===hint.pair[1]));
assert.equal(JSON.stringify(dead.snapshot()),hintBefore,'Hint search cannot mutate gameplay');
// Player-earned specials: births occur only in the first natural match wave.
const birthPair=[at(0,-1),at(0,0)];
function birthLevel(length,powers=['ring','sprout']){
 const values=base.initial.slice();
 for(let q=-2;q<=Math.min(2,length-3);q++)values[at(q,0)]=7;
 // length4 occupies q=-2,-1,0,1; length5 adds q=2. The middle is a gap.
 if(length===4)values[at(1,0)]=7;
 if(length===5)values[at(2,0)]=7;
 values[at(0,0)]=8;values[at(0,-1)]=7;
 return {...base,id:'birth-'+length,initial:values,powers};
}
for(const [length,type] of [[4,'ring'],[5,'sprout']]){
 const game=new HexMatch(birthLevel(length));
 assert.equal(game.findMatches().length,0,'Special birth fixture starts settled');
 const result=game.swap(...birthPair),first=result.frames[0];
 assert(result.ok);assert.equal(first.created.length,1,'At most one power is earned per player swap');
 assert.equal(first.created[0].type,type,'Four earns ring; five prioritizes sprout');
 assert.equal(first.created[0].index,birthPair[1],'Birth prefers the player destination');
 assert.equal(first.afterSpecials[birthPair[1]],type,'New power survives in its unremoved anchor');
 assert.equal(first.before[birthPair[1]],7);
 assert.equal(first.layers[birthPair[1]],1,'The survivor anchor still paints its ground once');
 assert.equal(first.activated.length,0,'A newborn does not activate in its birth wave');
 assert(!first.removed.includes(birthPair[1]),'Birth anchor is preserved from gravity removal');
 assert.equal(first.scoreGain,first.matched.reduce((n,i)=>n+first.before[i],0),'Birth scores its painted anchor once');
 assert(result.frames.slice(1).every(f=>f.created.length===0),'Automatic cascades cannot mint extra powers');
}
const disabledBirth=new HexMatch(birthLevel(4,[])).swap(...birthPair);
assert(disabledBirth.frames.every(f=>f.created.length===0),'Powers require the level progression unlock');
const crossedPower=new HexMatch({...crossLevel,moves:10,powers:['ring','sprout']});
const crossedResult=crossedPower.swap(at(0,0),at(1,-1));
assert.equal(crossedResult.frames[0].created[0].type,'sprout','Intersecting triples earn the floor-seeking power');
assert.equal(crossedResult.frames[0].created.length,1);

// A pre-existing power is activated by a neighboring swap without a natural match.
function withPower(entries){
 const specials=cells.map(()=>null);for(const [q,r,type] of entries)specials[at(q,r)]=type;
 return {...base,id:'power-fixture',powers:['ring','sprout'],initialSpecials:specials};
}
const ringStart=at(0,0),ringDest=at(1,0);
const ringLevel=withPower([[0,0,'ring']]),ringGame=new HexMatch(ringLevel);
assert.equal(ringGame.findMatches().length,0);
assert(ringGame.legalMoves().some(p=>p.includes(ringStart)&&p.includes(ringDest)),'Power swap is advertised as legal');
const previewBefore=JSON.stringify(ringGame.snapshot());
assert.deepEqual(plain(ringGame.previewPower(ringStart)).sort((a,b)=>a-b),[ringStart,...ringGame.neighbors[ringStart]].sort((a,b)=>a-b),'Ring preview shows its current hex footprint');
assert.deepEqual(plain(ringGame.previewPower(-1)),[]);assert.deepEqual(plain(ringGame.previewPower(999)),[]);
assert.deepEqual(plain(ringGame.previewPower(ringDest)),[],'Normal numbers have no power footprint');
assert.equal(JSON.stringify(ringGame.snapshot()),previewBefore,'Power previews do not mutate RNG, score, tiles or floor');
const ringResult=ringGame.swap(ringStart,ringDest),ringFrame=ringResult.frames[0];
assert(ringResult.ok);assert.equal(ringGame.movesLeft,ringLevel.moves-1);
const ringPulse=ringFrame.activated.find(p=>p.type==='ring');assert(ringPulse);
assert.equal(ringPulse.index,ringDest,'The power activates after it reaches the swapped destination');
assert.deepEqual(plain(ringPulse.affected).sort((a,b)=>a-b),[ringDest,...ringGame.neighbors[ringDest]].sort((a,b)=>a-b),'Ring follows all six hex neighbors');
assert.equal(ringFrame.matched.length,7);
for(const i of ringFrame.matched)assert.equal(ringFrame.layers[i],1,'Ring hits each ground layer once');
assert(ringResult.frames.every(f=>f.created.length===0),'A power activation never creates fresh powers from its blast');
assert(ringFrame.afterSpecials.every(p=>p===null),'Activated ring is consumed');

// Two neighboring powers and powers hit by another pulse form a finite union.
for(const entries of [[[0,0,'ring'],[1,0,'sprout']],[[0,0,'ring'],[2,0,'ring']]]){
 const game=new HexMatch(withPower(entries)),result=game.swap(ringStart,ringDest),first=result.frames[0];
 assert(result.ok);assert.equal(first.activated.length,2,'Both swapped or hit powers activate');
 assert.equal(new Set(first.activated.map(p=>p.index)).size,2,'A power cannot activate twice in its wave');
 assert.equal(new Set(first.matched).size,first.matched.length,'Overlapping effects union before scoring');
 assert.equal(first.scoreGain,first.matched.reduce((n,i)=>n+first.before[i],0));
 for(const i of first.matched)assert.equal(first.layers[i],1,'Overlapping effects do not double-damage layered ground');
 assert(result.frames.length<=32,'Special resolution stays bounded');
}

// Sprout follows an adjacent path toward unfinished ground instead of clearing a color.
const sproutGame=new HexMatch(withPower([[0,0,'sprout']]));
sproutGame.layers.fill(0);const unfinished=at(-2,0);sproutGame.layers[unfinished]=1;
const sproutResult=sproutGame.swap(ringStart,ringDest),sprout=sproutResult.frames[0].activated.find(p=>p.type==='sprout');
assert(sprout);assert.equal(sprout.index,ringDest);
assert.equal(sprout.affected[0],ringDest);assert(sprout.affected.length<=4);
assert(sprout.affected.includes(unfinished),'Sprout reaches an unfinished floor three edges away');
for(let i=1;i<sprout.affected.length;i++)assert(sproutGame.adjacent(sprout.affected[i-1],sprout.affected[i]),'Growth path uses real hex neighbors');
assert.equal(sproutResult.frames[0].layers[unfinished],0,'Reached ground is painted');

// Number and power are one falling tile; newly refilled tiles carry no power.
const falling=new HexMatch(withPower([[0,-1,'ring'],[0,0,'sprout']]));
const ringValue=falling.values[at(0,-1)],sproutValue=falling.values[at(0,0)];
falling._gravity([at(0,2)]);
assert.equal(falling.specials[at(0,0)],'ring');assert.equal(falling.values[at(0,0)],ringValue);
assert.equal(falling.specials[at(0,1)],'sprout');assert.equal(falling.values[at(0,1)],sproutValue);
assert.equal(falling.specials[at(0,-2)],null);
const specialCount=falling.specials.filter(Boolean).length;
falling._stableBoard();assert.equal(falling.specials.filter(Boolean).length,specialCount,'Safety settle retains outstanding powers');
const powerClone=falling.clone(),beforePowerClone=JSON.stringify(falling.snapshot());powerClone.specials[0]='sprout';
assert.equal(JSON.stringify(falling.snapshot()),beforePowerClone,'Special arrays are isolated in clones');
const replayedRing=new HexMatch(ringLevel,plain(ringGame.snapshot()));
assert.deepEqual(plain(replayedRing.snapshot()),plain(ringGame.snapshot()),'Special activation replays deterministically');
for(const replacement of ['ring','unknown']){
 const bad=plain(ringGame.snapshot());bad.specials[0]=replacement;
 assert.throws(()=>new HexMatch(ringLevel,bad),'Power checkpoint tampering is rejected');
}
const quickBefore=JSON.stringify(ringGame.snapshot()),quickHint=ringGame.hint({maxMs:12,maxDepth:1});
if(quickHint)assert(ringGame.legalMoves().some(p=>p[0]===quickHint.pair[0]&&p[1]===quickHint.pair[1]));
assert.equal(JSON.stringify(ringGame.snapshot()),quickBefore,'Bounded hint keeps the full special state immutable');

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
console.log(`Match engine checks passed: three axes, rollback, intersection layers, deterministic cascade/gravity, restore, last-move victory, loss, reshuffle, special births/activation/gravity, hints and ${checkedLevels} authored solutions.`);
