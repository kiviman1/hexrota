import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{},performance};vm.createContext(context);
for(const f of ['engine.js','levels.js'])vm.runInContext(fs.readFileSync(new URL('dist/'+f,import.meta.url),'utf8'),context);
const {HexMatch,HEX_LEVELS}=context.window;
assert.equal(HEX_LEVELS.length,10);let previous=0;
const plain=x=>JSON.parse(JSON.stringify(x));
for(const [index,level]of HEX_LEVELS.entries()){
 assert.equal(level.id,index+1);assert.equal(level.rulesVersion,'classic-v4');
 assert(!('powers'in level)&&!('initialSpecials'in level));
 assert.equal(level.initial.length,level.cells.length);assert(level.cells.length>=previous);previous=level.cells.length;
 assert.equal(new Set(level.cells.map(c=>`${c.q},${c.r}`)).size,level.cells.length);
 assert(level.cells.every(c=>Number.isInteger(c.q)&&Number.isInteger(c.r)&&[1,2].includes(c.layers)));
 assert(level.initial.every(v=>level.palette.includes(v)));
 const fresh=new HexMatch(level);assert.equal(fresh.findMatches().length,0);assert(fresh.legalMoves().length>=3);
 assert(!('specials'in fresh));assert.equal(fresh.snapshot().version,4);
 for(const p of fresh.legalMoves()){const trial=fresh.clone();trial.swap(...p);assert.notEqual(trial.status,'won','no one-swap automatic victory');}
 const routes=[level.solution,...level.alternativeSolutions];
 assert(routes.length>=2,'at least two independently certified starts');
 const openings=new Set(routes.map(route=>route[0].slice().sort((a,b)=>a-b).join(',')));
 assert(openings.size>=2);
 for(const [r,route]of routes.entries()){
  assert(route.length<=level.moves);const game=new HexMatch(level);
  for(const pair of route){
   const before=game.snapshot(),result=game.swap(...pair);assert(result.ok);
   assert.equal(game.movesLeft,before.movesLeft-1);assert(result.frames.length<=32);
   assert.equal(game.findMatches().length,0,'cascade settles before input');
   assert.equal(game.score-before.score,result.frames.reduce((n,f)=>n+f.scoreGain,0));
   if(game.status==='playing')assert(game.legalMoves().length>0,'no dead playing board');
   for(const f of result.frames){assert.equal(new Set(f.matched).size,f.matched.length);assert.equal(f.refill.length,f.matched.length);}
  }
  assert.equal(game.status,'won',`level${index+1}route${r} misses a goal`);assert.equal(game.covered,level.cells.length);assert(game.score>=level.target);
  if(r===0){assert.equal(game.turn,level.par);assert.equal(game.score,level.balance.solutionScore);}
  assert.deepEqual(plain(new HexMatch(level,game.snapshot()).snapshot()),plain(game.snapshot()));
 }
 assert.equal(level.balance.winningOpenings,openings.size);assert.equal(level.balance.trials,100);assert.equal(level.balance.greedyTrials,30);
 assert(level.balance.randomWinRate<=(index===0?70:index<3?50:index<6?35:25));
 if(index<2)assert(level.balance.greedyWinRate>=60,'tutorial accepts simple coverage planning');
 console.log(`✓ ${String(index+1).padStart(2,'0')} ${level.name}: ${level.cells.length} cells, ${level.moves} moves, certified ${level.par}, ${openings.size} winning starts, average chain ${level.balance.averageCascadeWaves}`);
}
console.log('All 10 classic levels pass stable starts, multiple certified routes, score+ground goals, move budgets and saved-state replay.');
