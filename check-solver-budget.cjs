/* Offline solver integrity: observe real engine swaps, never a second solver.
 * Historical audit fixtures and published level data remain unchanged. */
'use strict';
const assert=require('node:assert/strict');
const {HexMatch,HEX_LEVELS,asLevel,solve,solveWithReport}=require('./lib/level-analysis.cjs');
const pack=require('./dist/variants.json');
const plain=value=>JSON.parse(JSON.stringify(value));
const levelFor=(id,variantId)=>asLevel(HEX_LEVELS.find(level=>level.id===id),pack.levels.find(entry=>entry.levelId===id).variants.find(variant=>variant.id===variantId));
const a01Prefix=[[8,11],[12,17],[1,0],[8,11],[13,16],[9,14],[3,6],[7,10],[18,17]];
const winningPrefix=[[7,10],[16,18],[16,14],[9,14],[7,12],[5,10],[8,13],[0,4],[6,9]];
const tests=[],counts={observedSearches:0,actualChildSwaps:0,losingChildren:0,winningChildren:0,playingChildren:0,prefixReplaySwaps:0,winningRoutesReplayed:0,publishedVariants:0,invalidOptions:0};
function test(name,run){tests.push({name,run});}
function replay(level,route){const game=new HexMatch(level);for(const pair of route)assert.equal(game.swap(...pair).ok,true);return game;}
function outcomes(level,prefix){const game=replay(level,prefix),before=plain(game.snapshot());assert.equal(game.status,'playing');const result=game.legalMoves().map(pair=>{const child=game.clone();assert.equal(child.swap(...pair).ok,true);return {pair:pair.slice(),status:child.status};});assert.deepEqual(plain(game.snapshot()),before);return result;}
function observe(level,options={}){
 const beforeLevel=plain(level),beforeOptions=plain(options),prefixLength=options.prefix?.length||0,original=HexMatch.prototype.swap;
 let calls=0;const statuses=[];let report;
 try{HexMatch.prototype.swap=function(...args){calls++;const result=original.apply(this,args);if(calls>prefixLength)statuses.push(this.status);return result;};report=solveWithReport(level,options);}finally{HexMatch.prototype.swap=original;}
 assert.equal(calls-prefixLength,report.searchedNodes,'metadata counts actual child swap calls, excluding prefix replay');
 assert(report.searchedNodes<=report.limits.maxNodes,'strict bound applies to every child');
 assert.equal(statuses.length,report.searchedNodes);assert.deepEqual(plain(level),beforeLevel);assert.deepEqual(plain(options),beforeOptions);
 assert.equal(report.classification,report.route!==null?'proven_winnable':report.exhaustive?'proven_unwinnable':'unknown');
 if(report.exhaustive){assert.equal(report.route,null);assert.equal(report.nodeBudgetCutoff,false);assert.equal(report.depthLimited,false);assert.equal(report.beamPruned,false);assert.equal(report.terminationReason,'search_exhausted');}
 if(report.route){assert.deepEqual(report.route.slice(0,prefixLength),options.prefix||[]);assert.equal(replay(level,report.route).status,'won');counts.winningRoutesReplayed++;}
 counts.observedSearches++;counts.actualChildSwaps+=report.searchedNodes;counts.prefixReplaySwaps+=prefixLength;
 for(const status of statuses)counts[status==='lost'?'losingChildren':status==='won'?'winningChildren':'playingChildren']++;
 return report;
}
function freeze(value){if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}

test('exact A-01 fixture spends one node on one terminal loss, then stops unknown',()=>{
 const level=levelFor(1,'v1'),choices=outcomes(level,a01Prefix);
 assert.deepEqual(choices.map(choice=>choice.pair),[[0,4],[6,11],[7,5],[11,16]]);assert(choices.every(choice=>choice.status==='lost'));
 const report=observe(level,{prefix:a01Prefix,width:20,maxNodes:1});
 assert.equal(report.searchedNodes,1);assert.equal(report.depth,1);assert.equal(report.prefixMoves,9);assert.equal(report.classification,'unknown');assert.equal(report.terminationReason,'node_budget_exhausted');assert.equal(report.nodeBudgetCutoff,true);assert.equal(report.exhaustive,false);
 assert.equal(solve(level,{prefix:a01Prefix,width:20,maxNodes:1}),null,'legacy result remains route or null');
});
test('all four terminal losses fit exactly and prove current remaining-move state unwinnable',()=>{
 const level=levelFor(1,'v1');
 for(const maxNodes of [2,3]){const report=observe(level,{prefix:a01Prefix,maxNodes});assert.equal(report.searchedNodes,maxNodes);assert.equal(report.classification,'unknown');}
 for(const maxNodes of [4,5]){const report=observe(level,{prefix:a01Prefix,maxNodes});assert.equal(report.searchedNodes,4);assert.equal(report.classification,'proven_unwinnable');assert.equal(report.exhaustive,true);assert.equal(report.nodeBudgetCutoff,false);}
});
test('the winning child at the exact node boundary is counted and returned',()=>{
 const level=levelFor(2,'v4'),choices=outcomes(level,winningPrefix);
 assert.equal(choices.length,7);assert.deepEqual(choices.slice(0,2),[{pair:[3,8],status:'lost'},{pair:[4,9],status:'won'}]);assert.equal(choices.filter(choice=>choice.status==='won').length,1);
 const short=observe(level,{prefix:winningPrefix,maxNodes:1});assert.equal(short.classification,'unknown');
 const exact=observe(level,{prefix:winningPrefix,maxNodes:2});assert.equal(exact.classification,'proven_winnable');assert.equal(exact.searchedNodes,2);assert.equal(exact.nodeBudgetCutoff,false);assert.equal(exact.terminationReason,'solution_found');assert.deepEqual(exact.route,winningPrefix.concat([[4,9]]));
 assert.deepEqual(solve(level,{prefix:winningPrefix,maxNodes:2}),exact.route);
});
test('zero nodes does not expand a child; zero depth also reports its omitted work',()=>{
 const level=levelFor(1,'v1');
 const nodes=observe(level,{prefix:a01Prefix,maxNodes:0});assert.equal(nodes.searchedNodes,0);assert.equal(nodes.terminationReason,'node_budget_exhausted');assert.equal(nodes.depth,0);assert.equal(nodes.depthLimited,false);
 const depth=observe(level,{prefix:a01Prefix,maxDepth:0});assert.equal(depth.searchedNodes,0);assert.equal(depth.terminationReason,'depth_limit');assert.equal(depth.depthLimited,true);assert.equal(depth.nodeBudgetCutoff,false);
 const both=observe(level,{prefix:a01Prefix,maxNodes:0,maxDepth:0});assert.equal(both.terminationReason,'node_budget_exhausted');assert.equal(both.nodeBudgetCutoff,true);assert.equal(both.depthLimited,true);assert.equal(both.classification,'unknown');
});
test('invalid explicit budgets reject before any swap, without coercion or silent defaults',()=>{
 const level=levelFor(1,'v1'),original=HexMatch.prototype.swap;let swaps=0;
 try{HexMatch.prototype.swap=function(...args){swaps++;return original.apply(this,args);};
  for(const key of ['maxNodes','maxDepth','width'])for(const value of [-1,1.5,NaN,Infinity,-Infinity,null,'1',true,Number.MAX_SAFE_INTEGER+1,...(key==='width'?[0]:[])]){
   assert.throws(()=>solveWithReport(level,{[key]:value}),RangeError);assert.throws(()=>solve(level,{[key]:value}),RangeError);counts.invalidOptions++;
  }
  assert.throws(()=>solveWithReport(level,{prefix:null}),TypeError);assert.equal(swaps,0);
 }finally{HexMatch.prototype.swap=original;}
 const defaults=observe(level,{prefix:a01Prefix,maxNodes:undefined,width:undefined,maxDepth:undefined});assert.deepEqual(defaults.limits,{maxNodes:30000,maxDepth:1,width:40});
});
test('depth-limited search stays unknown even when all first children were expanded',()=>{
 const level=levelFor(1,'v1'),prefix=a01Prefix.slice(0,-1),choices=outcomes(level,prefix);
 assert.equal(choices.length,10);assert(choices.every(choice=>choice.status==='playing'));
 const report=observe(level,{prefix,width:20,maxNodes:1000,maxDepth:1});assert.equal(report.searchedNodes,10);assert.equal(report.depth,1);assert.equal(report.depthLimited,true);assert.equal(report.beamPruned,false);assert.equal(report.classification,'unknown');assert.equal(report.terminationReason,'depth_limit');
});
test('a beam-pruned search stays unknown after its retained frontier is entirely lost',()=>{
 const level=levelFor(1,'v1'),prefix=a01Prefix.slice(0,-1),report=observe(level,{prefix,width:1,maxNodes:1000,maxDepth:2});
 assert.equal(report.searchedNodes,25);assert.equal(report.depth,2);assert.equal(report.beamPruned,true);assert.equal(report.nodeBudgetCutoff,false);assert.equal(report.depthLimited,false);assert.equal(report.exhaustive,false);assert.equal(report.classification,'unknown');assert.equal(report.terminationReason,'beam_pruned');
});
test('two-ply exhaustive proof includes every one of the 105 real children',()=>{
 const level=levelFor(1,'v1'),prefix=a01Prefix.slice(0,-1),report=observe(level,{prefix,width:20,maxNodes:105,maxDepth:2});
 assert.equal(report.searchedNodes,105);assert.equal(report.depth,2);assert.equal(report.exhaustive,true);assert.equal(report.classification,'proven_unwinnable');
});
test('termination precedence retains simultaneous node, depth and beam flags',()=>{
 const level=levelFor(1,'v1'),prefix=a01Prefix.slice(0,-1),all=observe(level,{prefix,width:1,maxNodes:10,maxDepth:1});
 assert.equal(all.terminationReason,'node_budget_exhausted');assert.equal(all.nodeBudgetCutoff,true);assert.equal(all.depthLimited,true);assert.equal(all.beamPruned,true);assert.equal(all.exhaustive,false);
 const depth=observe(level,{prefix,width:1,maxNodes:100,maxDepth:1});assert.equal(depth.terminationReason,'depth_limit');assert.equal(depth.beamPruned,true);assert.equal(depth.depthLimited,true);assert.equal(depth.classification,'unknown');
});
test('terminal prefixes replay outside the budget and invalid continuations cannot prove anything',()=>{
 const level=levelFor(1,'v1'),winning=pack.levels[0].variants[0].solutions[0],won=observe(level,{prefix:winning,maxNodes:0,maxDepth:0});
 assert.deepEqual(won.route,winning);assert.equal(won.searchedNodes,0);assert.equal(won.prefixMoves,winning.length);assert.equal(won.terminationReason,'solution_found');assert.equal(won.nodeBudgetCutoff,false);
 const losing=a01Prefix.concat([[0,4]]),lost=observe(level,{prefix:losing,maxNodes:0,maxDepth:0});assert.equal(lost.classification,'proven_unwinnable');assert.equal(lost.searchedNodes,0);assert.equal(lost.exhaustive,true);
 for(const prefix of [[[0,0]],[null],[[0]],[[0,1,2]],new Array(1),winning.concat([[0,4]]),losing.concat([[0,4]])]){
  const report=solveWithReport(level,{prefix,maxNodes:0});assert.equal(report.terminationReason,'invalid_prefix');assert.equal(report.classification,'unknown');assert.equal(report.exhaustive,false);assert.equal(report.searchedNodes,0);assert.equal(solve(level,{prefix,maxNodes:0}),null);
 }
});
test('frozen input, prefix aliases and existing game state stay untouched',()=>{
 const level=freeze(plain(levelFor(2,'v4'))),prefix=freeze(plain(winningPrefix)),options=freeze({prefix,maxNodes:2}),source=replay(level,prefix),before=plain(source.snapshot());
 const report=observe(level,options);assert.deepEqual(plain(source.snapshot()),before);assert.notEqual(report.route[0],prefix[0]);report.route[0][0]=999;assert.deepEqual(prefix,winningPrefix);
 const won=freeze(plain(pack.levels[1].variants[3].solutions[0])),terminal=observe(level,{prefix:won,maxNodes:0});assert.notEqual(terminal.route,won);assert.notEqual(terminal.route[0],won[0]);
});
test('all 40 published variants use deterministic legal traversal under strict small budgets',()=>{
 for(const entry of pack.levels)for(const variant of entry.variants){const level=levelFor(entry.levelId,variant.id);counts.publishedVariants++;
  for(const maxNodes of [0,1,32]){const options={maxNodes,width:6,maxDepth:2},first=observe(level,options),second=observe(level,options);assert.deepEqual(first,second);assert.deepEqual(solve(level,options),first.route);}
 }
 assert.equal(counts.publishedVariants,40);
});

function run(){let failed=0;for(const {name,run}of tests)try{run();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}const result={groups:tests.length,failed,...counts};console.log('Offline solver budget regressions: '+JSON.stringify(result));if(failed)process.exitCode=1;return result;}
module.exports={run};if(require.main===module)run();
