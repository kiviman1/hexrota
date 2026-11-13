import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js'])vm.runInContext(fs.readFileSync(new URL('dist/'+file,import.meta.url),'utf8'),context);
const {HexMatch,HEX_LEVELS}=context.window;
assert.equal(HEX_LEVELS.length,10);
let previousSize=0;
for(const [index,level] of HEX_LEVELS.entries()){
 assert.equal(level.id,index+1);assert.equal(level.cells.length,level.initial.length);
 assert(level.cells.length>=previousSize);previousSize=level.cells.length;
 const game=new HexMatch(level);
 assert.equal(game.findMatches().length,0,'no automatic opening match');
 assert(game.legalMoves().length>=2,'more than one possible opening');
 assert.equal(level.moves>=level.solution.length,true);
 assert.equal(new Set(level.cells.map(c=>`${c.q},${c.r}`)).size,level.cells.length);
 for(const pair of level.solution){const result=game.swap(...pair);assert(result.ok,'solution move must create a match');assert.equal(game.findMatches().length,0,'every cascade settles');}
 assert.equal(game.status,'won',`Level ${index+1} witness wins`);
 assert.equal(game.covered,level.cells.length);assert(game.score>=level.target);
 assert.equal(game.score,level.balance.solutionScore,'stored witness score matches');
 const replay=new HexMatch(level,game.snapshot());assert.equal(JSON.stringify(replay.snapshot()),JSON.stringify(game.snapshot()));
 assert(level.balance.randomWinRate<=65,'random valid-swap benchmark recorded during generation');
 console.log(`✓ ${String(index+1).padStart(2,'0')} ${level.name}: ${level.cells.length} cells, ${level.moves} moves, verified solution ${level.par}, score ${level.target}, random-valid benchmark ${level.balance.randomWinRate}%/${level.balance.trials}`);
}
console.log('All 10 match-three levels pass legal opening, deterministic solution, full ground coverage, target and move-budget checks.');
