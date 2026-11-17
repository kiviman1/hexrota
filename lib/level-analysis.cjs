/* Offline deterministic analysis. Policies never consult certified solutions.
 * Goal-aware bots clone the complete engine state, including RNG. One-step
 * policies see the whole resulting cascade and its replacement draws; planning
 * sees bounded future turns. These are full-information simulation heuristics,
 * not models of what a human can infer from the visible board alone.
 */
'use strict';
const path=require('node:path');
global.window=global.window||{};
require(path.join(__dirname,'../dist/engine.js'));
require(path.join(__dirname,'../dist/levels.js'));
const {HexMatch,HEX_LEVELS}=global.window;
const POLICIES=['random','greedy','coverage','planning'];
const round=(n,d=4)=>Number(n.toFixed(d));
function rng(seed){let x=(seed>>>0)||0x9e3779b9;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
const pairKey=p=>p.slice().sort((a,b)=>a-b).join(',');
const stateKey=g=>g.values.join(',')+'|'+g.layers.join('')+'|'+g.rngState+'|'+g.score+'|'+g.movesLeft;
function planningChoices(game,{maxDepth=3,beamWidth=6,maxNodes=192}={}){
 const rootLayers=game.remainingLayers,deficit=Math.max(0,game.level.target-game.score);
 let beam=[{game,first:null}],best=-Infinity,choices=[],nodes=0,deepest=0;
 const consider=(child,first)=>{
  const rank=child.status==='won'?1e7+child.movesLeft*100:child.status==='lost'?-1e7:(rootLayers-child.remainingLayers)*120+(child.covered-game.covered)*45+Math.min(child.score-game.score,deficit)*.8;
  if(rank>best+1e-8){best=rank;choices=[first];}else if(Math.abs(rank-best)<1e-8)choices.push(first);
  return rank;
 };
 for(let depth=0;depth<maxDepth;depth++){
  deepest=depth+1;const next=[];
  for(const item of beam)for(const pair of item.game.legalMoves()){
   const child=item.game.clone();child.swap(...pair);nodes++;
   const first=item.first||pair,rank=consider(child,first);
   if(child.status==='playing')next.push({game:child,first,rank});
   if(nodes>=maxNodes)return {choices:uniquePairs(choices),nodes,depth:depth+1};
  }
  next.sort((a,b)=>b.rank-a.rank);beam=next.slice(0,beamWidth);if(!beam.length)break;
 }
 return {choices:uniquePairs(choices),nodes,depth:deepest};
}
function uniquePairs(pairs){return [...new Map(pairs.map(p=>[pairKey(p),p.slice()])).values()];}
function policyChoices(game,policy,options={},cache=new Map()){
 const key=policy+'|'+stateKey(game);if(cache.has(key))return cache.get(key);
 const legal=game.legalMoves();let result;
 if(policy==='random')result={choices:legal,nodes:0,depth:0};
 else if(policy==='planning')result=planningChoices(game,options);
 else{
  let best=-Infinity,choices=[];const initialLayers=game.level.cells.reduce((n,c)=>n+(c.layers||1),0),deficit=Math.max(0,game.level.target-game.score);
  for(const pair of legal){
   const child=game.clone(),resolved=child.swap(...pair),layers=game.remainingLayers-child.remainingLayers,covered=child.covered-game.covered;
   const rank=child.status==='won'?1e7+child.movesLeft*100:child.status==='lost'?-1e7:policy==='greedy'?Math.min(resolved.scoreGain,deficit)/game.level.target*100+layers/initialLayers*100+covered/game.total*100:layers*100+covered*35+Math.min(resolved.scoreGain,deficit)*.1;
   if(rank>best+1e-8){best=rank;choices=[pair];}else if(Math.abs(rank-best)<1e-8)choices.push(pair);
  }
  result={choices,nodes:legal.length,depth:1};
 }
 if(!result.choices.length)result={choices:legal.slice(0,1),nodes:result.nodes,depth:result.depth};
 cache.set(key,result);return result;
}
function simulate(level,policy,{trials=64,seed=7631381,planning={},captureRoutes=true}={}){
 const cache=new Map(),witnesses=new Map(),paths=new Set(),failures={scoreOnly:0,groundOnly:0,both:0};
 let wins=0,moves=0,winMoves=0,left=0,score=0,coverage=0,layers=0,waves=0,cascades=0,reshuffles=0,forced=0,maxWaves=0,searchNodes=0,searchDepth=0,cacheHits=0,decisions=0;
 for(let trial=0;trial<trials;trial++){
  const random=rng((seed+level.id*104729+POLICIES.indexOf(policy)*65537+trial*15485863)>>>0),game=new HexMatch(level);
  while(game.status==='playing'){
   const key=policy+'|'+stateKey(game);if(cache.has(key))cacheHits++;
   const selected=policyChoices(game,policy,planning,cache);decisions++;searchNodes+=selected.nodes;searchDepth+=selected.depth;
   const pair=selected.choices[Math.floor(random()*selected.choices.length)];
   if(!pair)throw Error('Playing board has no policy move');
   const result=game.swap(...pair);if(!result.ok)throw Error('Policy picked an illegal move');
   waves+=result.frames.length;cascades+=Math.max(0,result.frames.length-1);maxWaves=Math.max(maxWaves,result.frames.length);reshuffles+=Number(result.reshuffled);
   forced+=result.frames.reduce((n,f)=>n+f.refill.filter(v=>v.forced).length,0);
  }
  paths.add(JSON.stringify(game.history));moves+=game.turn;score+=game.score;coverage+=game.covered/game.total;layers+=game.remainingLayers;
  if(game.status==='won'){
   wins++;left+=game.movesLeft;winMoves+=game.turn;
   if(captureRoutes){const key=pairKey(game.history[0]),old=witnesses.get(key);if(!old||game.history.length<old.length)witnesses.set(key,game.history.map(p=>p.slice()));}
  }else if(game.covered===game.total)failures.scoreOnly++;else if(game.score>=level.target)failures.groundOnly++;else failures.both++;
 }
 return {metrics:{trials,wins,winRate:round(wins/trials*100),averageMovesUsed:round(moves/trials),averageWinningMoves:wins?round(winMoves/wins):null,averageMovesLeftOnWin:wins?round(left/wins):null,averageScore:round(score/trials),averageGroundCompletion:round(coverage/trials),averageRemainingLayers:round(layers/trials),averageCascadeWavesPerMove:round(waves/Math.max(1,moves)),averageCascadeWavesPerAttempt:round(waves/trials),averageExtraCascadesPerAttempt:round(cascades/trials),maxCascadeWaves:maxWaves,reshuffles,forcedRefills:forced,uniqueTrajectories:paths.size,winningOpenings:witnesses.size,averageSearchNodesPerMove:round(searchNodes/Math.max(1,decisions)),averageLookaheadDepth:round(searchDepth/Math.max(1,decisions)),cachedDecisions:cacheHits,decisions,failures},witnesses:[...witnesses.values()]};
}
function analyse(level,options={}){
 const policies={},witnesses=new Map();
 for(const policy of POLICIES){const measured=simulate(level,policy,options);policies[policy]=measured.metrics;for(const route of measured.witnesses){const key=pairKey(route[0]),old=witnesses.get(key);if(!old||route.length<old.length)witnesses.set(key,route);}}
 const weights=options.easeWeights||{greedy:.3,coverage:.45,planning:.25};
 const easeScore=round(Object.entries(weights).reduce((n,[policy,weight])=>n+policies[policy].winRate*weight,0));
 return {policies,easeScore,difficultyIndex:round(100-easeScore),planningAdvantage:round(policies.planning.winRate-Math.max(policies.greedy.winRate,policies.coverage.winRate)),winningRoutes:[...witnesses.values()].sort((a,b)=>a.length-b.length||pairKey(a[0]).localeCompare(pairKey(b[0])))};
}
// Keep the historical beam/rank traversal. Reports distinguish why it stopped
// from whether it proved anything about the current unaided swap-only state.
// Prefix replay is outside the child budget and depth; zero permits no children.
// Explicit budgets must be safe integers (width >= 1; nodes/depth >= 0).
function solveWithReport(level,{width=40,prefix=[],maxNodes=30000,maxDepth}={}){
 const budget=(name,value,min)=>{if(!Number.isSafeInteger(value)||value<min)throw new RangeError(name+' must be a safe integer >= '+min);return value;};
 budget('width',width,1);budget('maxNodes',maxNodes,0);
 if(maxDepth!==undefined)budget('maxDepth',maxDepth,0);
 if(!Array.isArray(prefix))throw new TypeError('prefix must be an array');
 const start=new HexMatch(level),limits={maxNodes,maxDepth:maxDepth===undefined?Math.max(0,level.moves-prefix.length):maxDepth,width};
 let searchedNodes=0,prefixMoves=0,depth=0,nodeBudgetCutoff=false,depthLimited=false,beamPruned=false;
 const report=(terminationReason,route=null,exhaustive=false)=>({route,classification:route!==null?'proven_winnable':exhaustive?'proven_unwinnable':'unknown',terminationReason,searchedNodes,prefixMoves,depth,limits,nodeBudgetCutoff,depthLimited,beamPruned,exhaustive});
 const route=[];
 for(const pair of prefix){
  if(!Array.isArray(pair)||pair.length!==2||!Number.isInteger(pair[0])||!Number.isInteger(pair[1])||!start.swap(...pair).ok)return report('invalid_prefix');
  route.push(pair.slice());prefixMoves++;
 }
 if(start.status==='won')return report('solution_found',route);
 if(start.status==='lost')return report('search_exhausted',null,true);
 // Unlike heuristic cache keys, proof deduplication must distinguish every
 // valid layer vector, including multi-digit custom layer counts.
 const exactKey=game=>game.values.join(',')+'|'+game.layers.join(',')+'|'+game.rngState+'|'+game.score+'|'+game.movesLeft;
 let beam=[{game:start,route}];
 for(let ply=0;;ply++){
  if(ply>=limits.maxDepth){
   if(!beam.some(item=>item.game.legalMoves().length))return report(beamPruned?'beam_pruned':'search_exhausted',null,!beamPruned);
   depthLimited=true;nodeBudgetCutoff=searchedNodes>=maxNodes;
   return report(nodeBudgetCutoff?'node_budget_exhausted':'depth_limit');
  }
  const seen=new Map();
  for(const item of beam)for(const pair of item.game.legalMoves()){
   // Check before every actual child, including terminal wins and losses.
   // Reaching equality is not a cutoff unless another child is pending.
   if(searchedNodes>=maxNodes){nodeBudgetCutoff=true;return report('node_budget_exhausted');}
   const game=item.game.clone(),result=game.swap(...pair);searchedNodes++;depth=ply+1;
   if(!result.ok)throw new Error('Solver legal move was rejected');
   const childRoute=item.route.concat([pair.slice()]);
   if(game.status==='won')return report('solution_found',childRoute);
   if(game.status==='lost')continue;
   const key=exactKey(game),rank=(start.remainingLayers-game.remainingLayers)*120+game.covered*40+Math.min(game.score,level.target)*.8;
   const old=seen.get(key);if(!old||rank>old.rank)seen.set(key,{game,route:childRoute,rank,order:searchedNodes});
  }
  if(!seen.size)return report(beamPruned?'beam_pruned':'search_exhausted',null,!beamPruned);
  if(seen.size>width)beamPruned=true;
  beam=[...seen.values()].sort((a,b)=>b.rank-a.rank||a.order-b.order).slice(0,width);
 }
}
function solve(level,options){return solveWithReport(level,options).route;}
function certify(level,routes=[]){
 const distinct=new Map();
 for(const route of routes){if(!route?.length||route.length>level.moves)continue;const game=new HexMatch(level);let valid=true;for(const pair of route)if(!game.swap(...pair).ok){valid=false;break;}if(valid&&game.status==='won'){const key=pairKey(route[0]),old=distinct.get(key);if(!old||route.length<old.length)distinct.set(key,route.map(p=>p.slice()));}}
 return [...distinct.values()].sort((a,b)=>a.length-b.length||pairKey(a[0]).localeCompare(pairKey(b[0])));
}
function asLevel(base,variant){return {...base,initial:variant.initial.slice(),seed:variant.seed,solution:variant.solutions?.[0]||[],alternativeSolutions:variant.solutions?.slice(1)||[]};}
module.exports={HexMatch,HEX_LEVELS,POLICIES,rng,pairKey,round,analyse,simulate,solve,solveWithReport,certify,asLevel};
