/* Audit regressions: observable hint guarantees and finite search budgets.
 * Uses existing engine/policies; no runtime solver or game rules are added. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Player=require('./lib/observable-player.cjs');
const plain=value=>JSON.parse(JSON.stringify(value)),pairKey=pair=>pair.slice().sort((a,b)=>a-b).join(':');
let now=0,clockStep=0;
const context={window:{},performance:{now(){now+=clockStep;return now;}}};vm.createContext(context);
for(const file of ['engine.js','levels.js','variants-data.js','attempts.js','commands.js'])vm.runInContext(fs.readFileSync(__dirname+'/dist/'+file,'utf8'),context,{filename:file});
const {HexMatch:Engine,HEX_LEVELS:levels,HEX_VARIANTS:pack,HexAttempts,HexAssistedGame:Assisted}=context.window;
const catalog=HexAttempts.createCatalog(levels,pack,Engine),tests=[];
const counts={variantSearchStates:0,trueOffRouteStates:0,budgetDecisions:0,clockComparisons:0,visibleHiddenComparisons:0,assistedSearches:0,guaranteesReplayed:0,sources:{proven_route:0,search_win:0,heuristic:0,null:0}};
function test(name,run){tests.push({name,run});}
function noRoutes(level){const result=plain(level);for(const name of ['solutions','solution','alternativeSolutions'])delete result[name];return result;}
function truthful(game,hint,options={}){
 if(!hint){counts.sources.null++;return;}
 assert(game.legalMoves().some(pair=>pairKey(pair)===pairKey(hint.pair)),'every recommendation is an actual legal swap');
 assert(['proven_route','search_win','heuristic'].includes(hint.source));assert.equal(hint.guaranteed,hint.source!=='heuristic');
 assert(Number.isInteger(hint.searchedNodes)&&hint.searchedNodes>=0);assert(hint.depth>=0&&hint.depth<=Math.min(game.movesLeft,options.maxDepth||3));
 if(options.maxNodes)assert(hint.searchedNodes<=Math.min(100000,options.maxNodes),'node budget is checked before each actual child');
 if(hint.guaranteed){assert(hint.continuation?.length);const proof=game.clone();assert(hint.continuation.length<=game.movesLeft);for(const pair of hint.continuation)assert(proof.swap(...pair).ok);assert.equal(proof.status,'won');assert.equal(proof.covered,proof.total);counts.guaranteesReplayed++;}
 else assert.equal(hint.continuation,null,'neither a partial path nor heuristic is a winning certificate');
 if(hint.truncated)assert.equal(hint.guaranteed,false,'budget exhaustion cannot publish a guarantee');
 counts.sources[hint.source]++;
}
function auditedHint(game,options){const before=plain(game.snapshot()),hint=game.hint(options);truthful(game,hint,options);assert.deepEqual(plain(game.snapshot()),before,'hint leaves board, terrain, score, moves, history and RNG unchanged');return plain(hint);}
function budgetCase(){
 const level=plain(catalog.resolveLevel(2,'v4',pack.levelDataVersion)),game=new Engine(level);
 // Actual legal off-route history; no synthetic board/RNG mutation.
 const history=[[7,10],[16,18],[16,14],[9,14],[7,12],[5,10],[8,13],[0,4],[6,9]];
 for(const pair of history)assert(game.swap(...pair).ok);
 assert.equal(game.status,'playing');assert.equal(game.movesLeft,1);assert.equal(game.rngState,749821039);
 return {level,snapshot:plain(game.snapshot()),history};
}
const searchStates=[];
for(const entry of pack.levels)for(const variant of entry.variants){
 const level=catalog.resolveLevel(entry.levelId,variant.id,pack.levelDataVersion);let chosen=null;
 for(const route of variant.solutions){const prefix=new Engine(level);
  for(let i=0;i<Math.min(3,route.length)&&!chosen;i++){
   const prefixes=variant.solutions.filter(path=>prefix.history.every((pair,index)=>path[index]&&pairKey(pair)===pairKey(path[index]))),authored=new Set(prefixes.map(path=>path[prefix.turn]&&pairKey(path[prefix.turn])).filter(Boolean));
   for(const pair of prefix.legalMoves())if(!authored.has(pairKey(pair))){const child=prefix.clone();child.swap(...pair);if(child.status==='playing'){chosen=child;break;}}
   if(prefix.status==='playing')prefix.swap(...route[i]);
  }
  if(chosen)break;
 }
 if(chosen)counts.trueOffRouteStates++;else{chosen=new Engine(level);for(const pair of variant.solutions[0].slice(0,Math.min(2,variant.solutions[0].length-1)))chosen.swap(...pair);}
 searchStates.push({levelId:entry.levelId,variantId:variant.id,game:new Engine(noRoutes(level),plain(chosen.snapshot()))});
}

test('all40 published variants keep search decisions legal, deterministic and observational under three work budgets',()=>{
 assert.equal(searchStates.length,40);assert(counts.trueOffRouteStates>=20);
 for(const {game}of searchStates){counts.variantSearchStates++;
  for(const options of [{maxNodes:1,maxDepth:1,beamWidth:1},{maxNodes:32,maxDepth:2,beamWidth:8},{maxNodes:128,maxDepth:3,beamWidth:10}]){
   now=0;clockStep=0;const first=auditedHint(game,options),second=auditedHint(game,options);assert.deepEqual(first,second);counts.budgetDecisions++;
  }
 }
});
test('explicit node budgets remain deterministic across very different clocks and maxMs options',()=>{
 for(const {game}of searchStates){now=0;clockStep=0;const a=auditedHint(game,{maxNodes:32,maxDepth:2,beamWidth:8,maxMs:1});now=0;clockStep=1e9;const b=auditedHint(game,{maxNodes:32,maxDepth:2,beamWidth:8,maxMs:150});assert.deepEqual(a,b);counts.clockComparisons++;}clockStep=0;
});
test('one remaining move distinguishes a tiny uncertain budget from a replayed winning continuation',()=>{
 const f=budgetCase(),game=new Engine(f.level,f.snapshot),outcomes=game.legalMoves().map(pair=>{const child=game.clone();assert(child.swap(...pair).ok);return child.status;});
 assert.equal(outcomes.length,7);assert.equal(outcomes.filter(status=>status==='won').length,1,'the real horizon has one winning choice');
 const tiny=auditedHint(game,{maxNodes:1,maxDepth:1,beamWidth:1});assert.equal(tiny.source,'heuristic');assert.equal(tiny.guaranteed,false);assert.equal(tiny.truncated,true);
 const enough=auditedHint(game,{maxNodes:8,maxDepth:1,beamWidth:1});assert.equal(enough.source,'search_win');assert.equal(enough.guaranteed,true);assert.equal(enough.continuation.length,1);
});
test('a depth-limited heuristic stays explicitly uncertain even when no node/time early-exit flag is set',()=>{
 const game=new Engine(noRoutes(catalog.resolveLevel(2,'v4',pack.levelDataVersion))),hint=auditedHint(game,{maxNodes:1000,maxDepth:1,beamWidth:1});
 assert.equal(hint.source,'heuristic');assert.equal(hint.guaranteed,false);assert.equal(hint.continuation,null);assert.equal(hint.depth,1);
 // The safety contract is source/guaranteed, not interpreting truncated:false as an exhaustive proof.
});
test('time exhaustion reports a non-guaranteed legal suggestion and does not consume authoritative RNG',()=>{
 const game=searchStates[0].game;now=0;clockStep=1e6;const hint=auditedHint(game,{maxMs:1,maxDepth:3,beamWidth:32});clockStep=0;
 assert.equal(hint.source,'heuristic');assert.equal(hint.guaranteed,false);assert.equal(hint.truncated,true);assert.equal(hint.searchedNodes,0);
});
test('terminal won and lost snapshots never offer another hint',()=>{
 const winCase=budgetCase(),winner=new Engine(winCase.level,winCase.snapshot),hint=winner.hint({maxNodes:8,maxDepth:1});for(const pair of hint.continuation)assert(winner.swap(...pair).ok);assert.equal(winner.status,'won');assert.equal(auditedHint(winner,{maxNodes:32}),null);
 const loser=new Engine(winCase.level,winCase.snapshot),pair=loser.legalMoves().find(pair=>{const child=loser.clone();child.swap(...pair);return child.status==='lost';});assert(pair);assert(loser.swap(...pair).ok);assert.equal(loser.status,'lost');assert.equal(auditedHint(loser,{maxNodes:32}),null);
 for(const terminal of [winner,loser])assert.deepEqual(plain(new Engine(terminal.level,terminal.snapshot()).snapshot()),plain(terminal.snapshot()),'terminal checkpoint still replays exactly');
});
test('off-route visible policies cannot read real RNG, history, routes, clone or snapshot',()=>{
 const hidden=['rngState','seed','initial','solution','solutions','alternativeSolutions','history','clone','snapshot','_random'];
 for(const {game}of searchStates){const original=plain(game.snapshot()),visible=Player.visibleState(game),before=plain(visible);
  const poisoned=Object.create(game);for(const name of hidden)Object.defineProperty(poisoned,name,{get(){throw Error('Hidden read '+name);}});
  Object.defineProperty(poisoned,'level',{value:new Proxy(game.level,{get(target,name){if(hidden.includes(name))throw Error('Hidden level read '+name);return target[name];}})});assert.deepEqual(Player.visibleState(poisoned),visible);
  for(const policy of Player.POLICIES){const options={policy,seed:0x51a77,samples:2,depth:2},expected=Player.choose(visible,options);assert(expected);
   for(const rng of [1,0xffffffff]){const changed=game.clone();changed.rngState=rng;changed.level={...game.level,seed:rng,initial:game.values.map(()=>1),solution:[[999,998]],solutions:[],alternativeSolutions:[]};assert.deepEqual(Player.choose(Player.visibleState(changed),options),expected);counts.visibleHiddenComparisons++;}
  }
  assert.deepEqual(visible,before);assert.deepEqual(plain(game.snapshot()),original);
 }
});
test('assisted hints strip swap-only certificates and preserve command, usage, bonus and RNG state',()=>{
 for(const base of searchStates.slice(0,8)){
  const level=catalog.resolveLevel(base.levelId,base.variantId,pack.levelDataVersion),game=new Assisted(level,{attemptId:'audit-hint-'+base.levelId+'-'+base.variantId});
  const target=game.layers.findIndex(layer=>layer>0);assert(game.apply({id:'audit-brush',type:'green_brush',index:target}).ok);
  const before=plain(game.snapshot()),hint=game.hint({maxNodes:32,maxDepth:2,beamWidth:8});assert.notEqual(hint?.source,'proven_route');truthful(game,hint,{maxNodes:32,maxDepth:2});assert.deepEqual(plain(game.snapshot()),before);
  const restored=new Assisted(level,{attemptId:before.attemptId},before);assert.deepEqual(plain(restored.hint({maxNodes:32,maxDepth:2,beamWidth:8})),plain(hint));assert.deepEqual(plain(restored.snapshot()),before);counts.assistedSearches++;
 }
});
function run(){let failed=0;for(const {name,run}of tests)try{run();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}console.log('Solvability hint audit regressions: '+JSON.stringify({groups:tests.length,failed,...counts}));if(failed)process.exitCode=1;return {failed,...counts};}
module.exports={budgetCase};if(require.main===module)run();
