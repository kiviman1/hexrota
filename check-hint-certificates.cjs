/* Runtime certificate boundary: only real cloned wins earn authored guarantees. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value)),tests=[];
let clockReads=0,swapCalls=0;
const context={window:{},performance:{now(){return clockReads++;}}};vm.createContext(context);
for(const file of ['engine.js','levels.js','variants-data.js','attempts.js'])vm.runInContext(fs.readFileSync(__dirname+'/dist/'+file,'utf8'),context,{filename:file});
const W=context.window,Engine=W.HexMatch,pack=W.HEX_VARIANTS,catalog=W.HexAttempts.createCatalog(W.HEX_LEVELS,pack,Engine);
const originalSwap=Engine.prototype.swap;Engine.prototype.swap=function(...args){swapCalls++;return originalSwap.apply(this,args);};
const options={maxNodes:1,maxDepth:1,beamWidth:1};
const counts={publishedRoutes:0,publishedStates:0,publishedGuarantees:0,publishedVerificationSwaps:0,maxPublishedVerificationSwaps:0,legacyRoutes:0,forgedCatalogCases:0,malformedCases:0,mutationCases:0,capCases:0,maxUntrustedVerificationSwaps:0};
const same=(a,b)=>!!a&&!!b&&((a[0]===b[0]&&a[1]===b[1])||(a[0]===b[1]&&a[1]===b[0]));
function test(name,run){tests.push({name,run});}
function noRoutes(level){const copy={...level};for(const field of ['solutions','solution','alternativeSolutions'])delete copy[field];return plain(copy);}
function authored(level){return [...(level.solutions||[]),level.solution,...(level.alternativeSolutions||[])].filter(route=>Array.isArray(route)&&route.length);}
function observed(game,settings=options){
 const before=plain(game.snapshot()),calls=swapCalls,reads=clockReads,hint=plain(game.hint(settings)),verificationAndSearchSwaps=swapCalls-calls;
 assert.deepEqual(plain(game.snapshot()),before,'hint preserves values, layers, score, moves, turn, RNG and history');
 if(hint){
  assert.deepEqual(Object.keys(hint).sort(),['pair','source','guaranteed','continuation','searchedNodes','depth','truncated'].sort(),'runtime HintResult fields stay unchanged');
  assert(game.legalMoves().some(pair=>same(pair,hint.pair)),'suggestion is legal in the actual current state');
  assert.equal(hint.guaranteed,hint.source!=='heuristic');assert(hint.searchedNodes<=settings.maxNodes);
  if(hint.guaranteed){const proof=game.clone();assert(hint.continuation.length>0&&hint.continuation.length<=game.movesLeft);for(const pair of hint.continuation)assert(proof.swap(...pair).ok);assert.equal(proof.status,'won','independent actual engine replay verifies every guarantee');}
  else assert.equal(hint.continuation,null);
 }
 return {hint,swapCalls:verificationAndSearchSwaps,clockReads:clockReads-reads};
}
function fallback(game,settings=options){const copy=game.clone();copy.level=noRoutes(game.level);return observed(copy,settings).hint;}
function expectFallback(game){const result=observed(game);assert.deepEqual(result.hint,fallback(game),'untrusted metadata falls through to the existing bounded search');assert.notEqual(result.hint?.source,'proven_route');return result;}

test('all 80 published routes preserve every previous route hint field and terminal null',()=>{
 for(const group of pack.levels)for(const variant of group.variants){
  const level=catalog.resolveLevel(group.levelId,variant.id,pack.levelDataVersion);
  for(const route of variant.solutions){
   const game=new Engine(level);counts.publishedRoutes++;
   for(let turn=0;turn<=route.length;turn++){
    const result=observed(game),selected=authored(level).find(path=>game.history.length<path.length&&game.history.every((pair,index)=>same(pair,path[index])));
    counts.publishedStates++;
    if(game.status!=='playing')assert.equal(result.hint,null);
    else{
     assert(selected);const continuation=plain(selected.slice(game.history.length));
     assert.deepEqual(result.hint,{pair:continuation[0].slice(),source:'proven_route',guaranteed:true,continuation,searchedNodes:0,depth:0,truncated:false});
     assert.equal(result.swapCalls,continuation.length,'certificate verification follows one linear continuation without search');assert.equal(result.clockReads,0);
     counts.publishedGuarantees++;counts.publishedVerificationSwaps+=result.swapCalls;counts.maxPublishedVerificationSwaps=Math.max(counts.maxPublishedVerificationSwaps,result.swapCalls);
    }
    if(turn<route.length)assert(game.swap(...route[turn]).ok);
   }
  }
 }
 assert.equal(counts.publishedRoutes,80);assert.equal(counts.publishedStates,680);assert.equal(counts.publishedGuarantees,600);assert.equal(counts.publishedVerificationSwaps,2665);assert.equal(counts.maxPublishedVerificationSwaps,13);
});

test('the ten original published solution paths still offer actual winning guarantees',()=>{
 for(const level of W.HEX_LEVELS){
  const game=new Engine(level),route=level.solution;assert(route?.length);counts.legacyRoutes++;
  for(const pair of route){const result=observed(game);assert.equal(result.hint.source,'proven_route');assert.equal(result.hint.guaranteed,true);assert(game.swap(...pair).ok);}
  assert.equal(game.status,'won');assert.equal(observed(game).hint,null);
 }
 assert.equal(counts.legacyRoutes,10);
});

test('H-01 forged one-move routes remain catalog-shaped but cannot claim a winning certificate',()=>{
 const forged=plain(pack),variant=forged.levels.find(group=>group.levelId===1).variants.find(row=>row.id==='v1');
 variant.solutions=variant.solutions.map(route=>route.slice(0,1));assert(!same(variant.solutions[0][0],variant.solutions[1][0]));
 const accepted=W.HexAttempts.createCatalog(W.HEX_LEVELS,forged,Engine),level=accepted.resolveLevel(1,'v1',pack.levelDataVersion),game=new Engine(level);
 for(const route of variant.solutions){const proof=game.clone();for(const pair of route)assert(proof.swap(...pair).ok);assert.equal(proof.status,'playing','the original exact H-01 counterexample is genuinely nonwinning');}
 const result=expectFallback(game);assert.equal(result.hint.guaranteed,false);assert.equal(result.hint.continuation,null);assert.equal(result.hint.searchedNodes,1);assert.equal(result.hint.truncated,true);counts.forgedCatalogCases++;
});

test('malformed route fields, sparse paths and bad later swaps safely use the same fallback',()=>{
 const base=noRoutes(catalog.resolveLevel(1,'v1',pack.levelDataVersion)),sparseRoute=Array(1),sparsePair=Array(2),hugePair=Array(0x3fffffff),inheritedPair=Array(2);sparsePair[0]=14;Object.setPrototypeOf(inheritedPair,{0:14,1:18});
 const malformed=[null,false,5,'route',{},[],sparseRoute,[null],[{}],['pair'],[[14]],[[14,18,0]],[[14.5,18]],[['14',18]],[[NaN,18]],[[Infinity,18]],[[-1,18]],[[base.cells.length,18]],[[14,14]],[sparsePair],[hugePair],[inheritedPair],[[14,18],null],[[14,18],[0,base.cells.length]],Array.from({length:base.moves+1},()=>[14,18])];
 for(const route of malformed)for(const field of ['solutions','solution','alternativeSolutions']){
  const level={...base,[field]:field==='solution'?route:[route]};expectFallback(new Engine(level));counts.malformedCases++;
 }
 for(const field of ['solutions','alternativeSolutions'])for(const value of [null,false,7,'not-an-array',{}]){expectFallback(new Engine({...base,[field]:value}));counts.malformedCases++;}
 // Shape-valid routes can still have an illegal later swap or continue after a win.
 const full=plain(catalog.resolveLevel(1,'v1',pack.levelDataVersion).solutions[0]);
 for(const route of [[[14,18],[0,0]],full.concat([full[0]])]){expectFallback(new Engine({...base,solutions:[route]}));counts.malformedCases++;}
});

test('a malformed candidate does not hide a later valid winning continuation',()=>{
 const published=catalog.resolveLevel(1,'v1',pack.levelDataVersion),level=noRoutes(published),valid=plain(published.solutions[0]);
 Object.assign(level,{solutions:[null,[[14,18],null]],solution:{bad:true},alternativeSolutions:[valid]});
 const game=new Engine(level),result=observed(game);assert.equal(result.hint.source,'proven_route');assert.deepEqual(result.hint.continuation,valid);
});

test('returned arrays and an in-place route mutation cannot reuse an old guarantee',()=>{
 const published=catalog.resolveLevel(1,'v1',pack.levelDataVersion),route=plain(published.solutions[0]),saved=plain(route),level={...noRoutes(published),solutions:[route]},game=new Engine(level);
 const expected=observed(game).hint,output=game.hint(options);output.pair[0]=-1;output.continuation[0][1]=-1;assert.deepEqual(observed(game).hint,expected);assert.deepEqual(route,saved);counts.mutationCases++;
 route.splice(1);const shortened=expectFallback(game);assert.equal(shortened.hint.guaranteed,false);counts.mutationCases++;
 route.push(...saved.slice(1));assert.deepEqual(observed(game).hint,expected);counts.mutationCases++;
 const target=level.target;level.target+=1000000;assert.equal(expectFallback(game).hint.guaranteed,false);counts.mutationCases++;
 level.target=target;assert.deepEqual(observed(game).hint,expected);counts.mutationCases++;
});

test('the same certificate is checked again after the current deterministic future changes',()=>{
 const published=catalog.resolveLevel(1,'v1',pack.levelDataVersion),route=plain(published.solutions[0]),level={...noRoutes(published),solutions:[route]},game=new Engine(level),rng=game.rngState;
 const expected=observed(game).hint;assert.equal(expected.source,'proven_route');
 game.rngState=1;const proof=game.clone();for(const pair of route)if(!proof.swap(...pair).ok)break;assert.notEqual(proof.status,'won');
 assert.equal(expectFallback(game).hint.guaranteed,false);counts.mutationCases++;
 game.rngState=rng;assert.deepEqual(observed(game).hint,expected);counts.mutationCases++;
});

test('at most 64 source candidate slots are inspected, including malformed entries',()=>{
 const published=catalog.resolveLevel(1,'v1',pack.levelDataVersion),valid=plain(published.solutions[0]),base=noRoutes(published);
 for(const invalid of [null,[],{},'bad-route']){
  const within={...base,solutions:Array.from({length:63},()=>invalid),solution:null,alternativeSolutions:[valid]};
  assert.equal(observed(new Engine(within)).hint.source,'proven_route','absent standalone solution consumes no candidate slot');counts.capCases++;
  const beyond={...base,solutions:Array.from({length:64},()=>invalid),solution:[],alternativeSolutions:[valid]};expectFallback(new Engine(beyond));counts.capCases++;
 }
 const unread=Array.from({length:64},()=>null);Object.defineProperty(unread,64,{get(){throw Error('candidate 65 must never be read');}});
 expectFallback(new Engine({...base,solutions:unread}));counts.capCases++;
});

test('512 route-pair copies bound actual proof swaps before the normal search budget',()=>{
 const published=W.HEX_LEVELS.find(level=>level.id===10),base=noRoutes(published),full=plain(published.solution);assert.equal(full.length,12);
 for(const length of [8,9]){const proof=new Engine(base);for(const pair of full.slice(0,length))assert(proof.swap(...pair).ok);assert.equal(proof.status,'playing');}
 // 56 legal but nonwinning nine-move routes plus one eight-move route use 512
 // copied pairs and proof swaps. A later genuine winning path is skipped safely.
 const paths=Array.from({length:56},()=>plain(full.slice(0,9))).concat([plain(full.slice(0,8)),full]);
 const game=new Engine({...base,solutions:paths}),result=expectFallback(game),proofSwaps=result.swapCalls-result.hint.searchedNodes;
 assert.equal(proofSwaps,512);assert.equal(result.hint.searchedNodes,1);assert.equal(result.hint.guaranteed,false);assert.equal(result.hint.truncated,true);
 counts.capCases++;counts.maxUntrustedVerificationSwaps=Math.max(counts.maxUntrustedVerificationSwaps,proofSwaps);
 // Oversized metadata is rejected before reading or copying even its first pair.
 const long=Array(513);Object.defineProperty(long,0,{get(){throw Error('oversized route must not be copied');}});
 expectFallback(new Engine({...base,moves:513,solutions:[long]}));counts.capCases++;
});

let failed=0;for(const {name,run}of tests)try{run();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}
console.log('Hint certificate regressions: '+JSON.stringify({groups:tests.length,failed,...counts}));if(failed)process.exitCode=1;
