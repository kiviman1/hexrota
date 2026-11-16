/* Offline audit instrumentation. Uses the existing engine, observable policies,
 * hint evaluator and bounded solver; adds no runtime solving algorithm. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {HexMatch,HEX_LEVELS,pairKey,solve}=require('./lib/level-analysis.cjs');
const Player=require('./lib/observable-player.cjs');
require('./dist/attempts.js');
const ROOT=__dirname,read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const pack=JSON.parse(read('dist/variants.json')),catalog=global.window.HexAttempts.createCatalog(HEX_LEVELS,pack,HexMatch);
const SETTINGS=Object.freeze({trialsPerVariantPolicy:8,decisionSeed:0x6d2b79f5,observableSamples:4,observableDepth:2,hintMaxNodes:512,hintMaxDepth:3,hintBeamWidth:6,solveWidth:20,solveMaxNodes:6000});
const plain=x=>JSON.parse(JSON.stringify(x)),round=n=>Number(n.toFixed(4));
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const routesFor=variant=>variant.solutions;
const onCertificate=(history,routes)=>routes.some(route=>history.length<=route.length&&history.every((pair,index)=>pairKey(pair)===pairKey(route[index])));
function seedFor(policy,trial,turn){return Player.mix32((SETTINGS.decisionSeed+Math.imul(policy+1,104729)+Math.imul(trial+1,15485863)+Math.imul(turn+1,2654435761))>>>0);}
function replay(level,route){const game=new HexMatch(level);for(const pair of route)assert.equal(game.swap(...pair).ok,true);return game;}
function sameSnapshot(actual,expected,message){assert.deepEqual(plain(actual.snapshot()),plain(expected),message);}
function verifyWinningRoute(level,variantId,route,index){
 assert(route.length>0&&route.length<=level.moves);const game=new HexMatch(level),stages=[];let prefixReplays=0;
 for(const [turn,pair]of route.entries()){
  assert.equal(game.status,'playing');assert(game.legalMoves().some(move=>pairKey(move)===pairKey(pair)));
  const before=game.snapshot(),result=game.swap(...pair);assert.equal(result.ok,true);const snapshot=game.snapshot();
  assert.equal(snapshot.movesLeft,before.movesLeft-1);assert.equal(game.findMatches().length,0);if(game.status==='playing')assert(game.legalMoves().length>0);
  sameSnapshot(new HexMatch(level,snapshot),snapshot,'certified checkpoint strict restore');
  sameSnapshot(replay(level,route.slice(0,turn+1)),snapshot,'independent certified prefix replay');prefixReplays+=turn+1;
  assert.equal(game.status,turn===route.length-1?'won':'playing');
  stages.push({turn:game.turn,movesLeft:game.movesLeft,score:game.score,remainingLayers:game.remainingLayers,rngState:game.rngState,waves:result.frames.length,reshuffled:result.reshuffled});
 }
 assert.equal(game.covered,game.total);assert(game.score>=level.target);assert.equal(game.status,'won');
 return {levelId:level.id,variantId,routeIndex:index,first:route[0],length:route.length,spareMoves:game.movesLeft,score:game.score,remainingLayers:game.remainingLayers,maxCascadeWaves:Math.max(...stages.map(s=>s.waves)),reshuffles:stages.filter(s=>s.reshuffled).length,prefixReplays,stages};
}
function opening(level,variant){
 const game=new HexMatch(level),options=Player.visibleOptions(Player.visibleState(game));assert.equal(game.findMatches().length,0);assert(options.length>=2);
 return {legalMoves:options.length,distinctFirstMatchPatterns:new Set(options.map(o=>o.matched.join(','))).size,minimumImmediateScore:Math.min(...options.map(o=>o.scoreGain)),maximumImmediateScore:Math.max(...options.map(o=>o.scoreGain)),minimumImmediateLayerHits:Math.min(...options.map(o=>o.layerGain)),maximumImmediateLayerHits:Math.max(...options.map(o=>o.layerGain)),independentCertifiedOpenings:new Set(variant.solutions.map(route=>pairKey(route[0]))).size};
}
function hintProbe(level,variantId,policy,snapshot){
 const game=new HexMatch(level,snapshot),before=plain(game.snapshot()),reply=game.hint({maxNodes:SETTINGS.hintMaxNodes,maxDepth:SETTINGS.hintMaxDepth,beamWidth:SETTINGS.hintBeamWidth});
 sameSnapshot(game,before,'hint evaluation cannot mutate authoritative state');assert(reply);assert(game.legalMoves().some(pair=>pairKey(pair)===pairKey(reply.pair)));
 assert(['proven_route','search_win','heuristic'].includes(reply.source));assert(reply.searchedNodes<=SETTINGS.hintMaxNodes);
 if(reply.guaranteed){assert.notEqual(reply.source,'heuristic');assert(Array.isArray(reply.continuation)&&reply.continuation.length>0);const child=game.clone();for(const pair of reply.continuation)assert.equal(child.swap(...pair).ok,true);assert.equal(child.status,'won');assert(reply.continuation.length<=game.movesLeft);}
 else{assert.equal(reply.source,'heuristic');assert.equal(reply.continuation,null);}
 return {levelId:level.id,variantId,policy,turn:game.turn,remainingMoves:game.movesLeft,source:reply.source,guaranteed:reply.guaranteed,truncated:reply.truncated,searchedNodes:reply.searchedNodes,depth:reply.depth,pair:plain(reply.pair),continuation:reply.continuation?plain(reply.continuation):null,snapshotFingerprint:hash(before)};
}
function lastMoveProof(game){
 assert.equal(game.status,'playing');assert.equal(game.movesLeft,1);const before=plain(game.snapshot()),choices=game.legalMoves(),outcomes=[];
 for(const pair of choices){const child=game.clone(),result=child.swap(...pair);assert.equal(result.ok,true);assert(['won','lost'].includes(child.status));outcomes.push({pair:plain(pair),status:child.status,score:child.score,remainingLayers:child.remainingLayers,rngState:child.rngState});}
 sameSnapshot(game,before,'one-move exhaustive verification is observational');
 return {provenUnwinnable:outcomes.length>0&&outcomes.every(o=>o.status==='lost'),legalMoves:choices.length,winningMoves:outcomes.filter(o=>o.status==='won').length,outcomes};
}
function simulateVariant(level,variant,policy,index,proofCache){
 const metrics={trials:SETTINGS.trialsPerVariantPolicy,wins:0,losses:0,decisions:0,strictCheckpointRestores:0,legalVisibleAgreementChecks:0,offRouteStates:0,reshuffles:0,attemptsWithRepeatedReshuffles:0,maxConsecutiveReshuffles:0,maxCascadeWaves:0,cascadeLimitMoves:0,lastCellLosses:0,terminalLostZeroLegal:0,lastMoveVisits:0,lastMoveUnwinnableVisits:0,failedGroundOnly:0,failedPointsOnly:0,failedBoth:0};
 const episodes=[];let sample=null,witness=null,zeroLegalWitness=null;
 for(let trial=0;trial<SETTINGS.trialsPerVariantPolicy;trial++){
  const game=new HexMatch(level);let reshuffles=0,consecutive=0,maxConsecutive=0;
  while(game.status==='playing'){
   assert(game.turn<level.moves);const before=plain(game.snapshot()),visible=Player.visibleState(game),options=Player.visibleOptions(visible),legal=game.legalMoves();
   assert.deepEqual(options.map(o=>pairKey(o.pair)).sort(),legal.map(pairKey).sort());metrics.legalVisibleAgreementChecks++;
   if(game.movesLeft===1){
    metrics.lastMoveVisits++;const key=hash(before);let proof=proofCache.get(key);if(!proof){proof=lastMoveProof(game);proofCache.set(key,proof);}
    if(proof.provenUnwinnable){metrics.lastMoveUnwinnableVisits++;if(!witness)witness={levelId:level.id,variantId:variant.id,policy,trial,scope:'classic-v4 swaps only; current remaining move budget; no booster or second chance',snapshot:before,proof};}
   }
   const decisionSeed=seedFor(index,trial,game.turn),choice=Player.choose(visible,{policy,seed:decisionSeed,samples:SETTINGS.observableSamples,depth:SETTINGS.observableDepth});assert(choice);sameSnapshot(game,before,'observable policy cannot mutate authoritative game');
   const result=game.swap(...choice.pair);assert.equal(result.ok,true);metrics.decisions++;metrics.maxCascadeWaves=Math.max(metrics.maxCascadeWaves,result.frames.length);metrics.cascadeLimitMoves+=Number(result.frames.length===32);
   assert.equal(game.findMatches().length,0);if(game.status==='playing')assert(game.legalMoves().length>0);
   const snapshot=game.snapshot();sameSnapshot(new HexMatch(level,snapshot),snapshot,'off-route checkpoint strict replay');metrics.strictCheckpointRestores++;
   if(result.reshuffled){reshuffles++;metrics.reshuffles++;consecutive++;maxConsecutive=Math.max(maxConsecutive,consecutive);}else consecutive=0;
   const offRoute=!onCertificate(game.history,routesFor(variant));if(offRoute)metrics.offRouteStates++;
   if(!sample&&offRoute&&game.status==='playing'&&game.turn>=2)sample=plain(snapshot);
  }
  assert(['won','lost'].includes(game.status));const terminalLegalMoves=game.legalMoves().length;if(game.status==='lost'&&terminalLegalMoves===0){metrics.terminalLostZeroLegal++;if(!zeroLegalWitness)zeroLegalWitness={levelId:level.id,variantId:variant.id,policy,trial,seed:variant.seed,snapshot:plain(game.snapshot())};}if(game.status==='won')metrics.wins++;else{metrics.losses++;metrics.lastCellLosses+=Number(game.total-game.covered===1);if(game.covered===game.total)metrics.failedPointsOnly++;else if(game.score>=level.target)metrics.failedGroundOnly++;else metrics.failedBoth++;}
  metrics.attemptsWithRepeatedReshuffles+=Number(reshuffles>1);metrics.maxConsecutiveReshuffles=Math.max(metrics.maxConsecutiveReshuffles,maxConsecutive);
  episodes.push({trial,decisionSeedAtTurnZero:seedFor(index,trial,0),status:game.status,turn:game.turn,score:game.score,missingPoints:Math.max(0,level.target-game.score),missingGroundCells:game.total-game.covered,remainingLayers:game.remainingLayers,terminalLegalMoves,reshuffles,maxConsecutiveReshuffles:maxConsecutive,historyFingerprint:hash(game.history),snapshotFingerprint:hash(game.snapshot())});
 }
 return {metrics,episodes,sample,witness,zeroLegalWitness};
}
function historicalReference(){
 const report=JSON.parse(read('reports/observable-difficulty.json'));
 return {sourceHash:report.sourceHash,trialsPerVariantPolicy:report.method.trials,notReproducedByThisTool:true,warning:report.method.warning,levels:report.levels.map(l=>({levelId:l.levelId,label:l.label,visibleRates:Object.fromEntries(Player.POLICIES.map(p=>[p,l.models[p].winRate])),sampledVariantRange:l.models.sampled.variantWinRateRange,sampledVariantRates:l.variants.map(v=>({variantId:v.variantId,winRate:v.models.sampled.winRate})),sampledGroundOnlyFailures:l.models.sampled.failures.groundMissingOnly,sampledLastCellLosses:l.models.sampled.lossesWithOneGroundCell,sampledAlternativeOpeningDifference:l.recovery.sampled.differenceFromStandard}))};
}
function run(){
 const source=crypto.createHash('sha256');for(const file of ['audit-solvability-9-9.cjs','dist/engine.js','dist/levels.js','dist/variants.json','dist/attempts.js','lib/level-analysis.cjs','lib/observable-player.cjs','reports/observable-difficulty.json'])source.update(read(file));
 const certificates=[],variants=[],hintProbes=[],solverProbes=[],witnesses=[],terminalZeroLegalWitnesses=[];let lastMoveUnique=0,lastMoveUniqueUnwinnable=0;
 for(const entry of pack.levels){const base=HEX_LEVELS.find(l=>l.id===entry.levelId);for(const variant of entry.variants){
  const level=catalog.resolveLevel(base.id,variant.id,pack.levelDataVersion),start=opening(level,variant);assert.equal(start.independentCertifiedOpenings,2);
  variant.solutions.forEach((route,index)=>certificates.push(verifyWinningRoute(level,variant.id,route,index)));
  const models={},samples={},proofCache=new Map();
  for(const [index,policy]of Player.POLICIES.entries()){
   const result=simulateVariant(level,variant,policy,index,proofCache);models[policy]={...result.metrics,episodes:result.episodes};if(result.sample){samples[policy]=result.sample;hintProbes.push(hintProbe(level,variant.id,policy,result.sample));}if(result.witness&&witnesses.length<12)witnesses.push(result.witness);if(result.zeroLegalWitness)terminalZeroLegalWitnesses.push(result.zeroLegalWitness);
  }
  lastMoveUnique+=proofCache.size;lastMoveUniqueUnwinnable+=[...proofCache.values()].filter(p=>p.provenUnwinnable).length;
  const policy=['visible_score','visible_coverage','sampled','random'].find(p=>samples[p]);
  if(policy){const snapshot=samples[policy],originalSwap=HexMatch.prototype.swap;let swapCalls=0,route;try{HexMatch.prototype.swap=function(...args){swapCalls++;return originalSwap.apply(this,args);};route=solve(level,{prefix:snapshot.history,width:SETTINGS.solveWidth,maxNodes:SETTINGS.solveMaxNodes});}finally{HexMatch.prototype.swap=originalSwap;}const actualSearchExpansions=swapCalls-snapshot.history.length;assert(actualSearchExpansions>=0);
   if(route){assert(route.length<=level.moves);const end=replay(level,route);assert.equal(end.status,'won');assert.deepEqual(route.slice(0,snapshot.history.length).map(pairKey),snapshot.history.map(pairKey));}
   solverProbes.push({levelId:level.id,variantId:variant.id,policy,turn:snapshot.turn,movesLeft:snapshot.movesLeft,snapshotFingerprint:hash(snapshot),requestedMaxNodes:SETTINGS.solveMaxNodes,actualSearchExpansions,requestedBudgetExceeded:actualSearchExpansions>SETTINGS.solveMaxNodes,classification:route?'proven_winnable':'unknown_within_search_budget',route:route?plain(route):null});
  }
  variants.push({levelId:level.id,variantId:variant.id,opening:start,models});
 }}
 const originals=HEX_LEVELS.map(level=>{const result=verifyWinningRoute(level,'legacy-original',level.solution,0);return {levelId:level.id,length:result.length,spareMoves:result.spareMoves,score:result.score,reshuffles:result.reshuffles,maxCascadeWaves:result.maxCascadeWaves,checkpointCount:result.stages.length};});
 const rows=variants.flatMap(v=>Object.values(v.models)),sum=field=>rows.reduce((n,row)=>n+row[field],0),sourceHash=source.digest('hex');
 const levels=pack.levels.map(entry=>{const items=variants.filter(v=>v.levelId===entry.levelId);return {levelId:entry.levelId,openingLegalRange:[Math.min(...items.map(v=>v.opening.legalMoves)),Math.max(...items.map(v=>v.opening.legalMoves))],firstMatchPatternRange:[Math.min(...items.map(v=>v.opening.distinctFirstMatchPatterns)),Math.max(...items.map(v=>v.opening.distinctFirstMatchPatterns))],policies:Object.fromEntries(Player.POLICIES.map(p=>{const trials=items.reduce((n,v)=>n+v.models[p].trials,0),wins=items.reduce((n,v)=>n+v.models[p].wins,0);return[p,{trials,wins,losses:trials-wins,winRate:round(wins/trials*100),lastCellLosses:items.reduce((n,v)=>n+v.models[p].lastCellLosses,0),maxCascadeWaves:Math.max(...items.map(v=>v.models[p].maxCascadeWaves))}];}))};});
 const report={schemaVersion:1,levelDataVersion:pack.levelDataVersion,rulesVersion:'classic-v4',sourceHash,method:{...SETTINGS,policies:Player.POLICIES,decisionSeedFormula:'Same deterministic mix32 formula used by existing audit-observable.cjs; policy/trial/turn only. Actual RNG, routes and future refills never enter a player decision.',certificateScope:'Every current published campaign variant route plus original legacy route; deterministic exact replay, score and ground goals, current move budget.',proofScope:'Classic-v4 swaps only from the current state and remaining move budget. No booster, extra-move rescue or metagame economy is part of impossibility claims.',searchClassification:'Existing bounded solve: a returned, replay-verified win is proven_winnable; null is unknown_within_search_budget. Exhaustive legal outcomes at one remaining move may prove the current unaided state unwinnable; this does not prove the initial level impossible.',hintSelection:'At most one first off-certificate playing state at turn>=2 per variant/policy; node budget ignores wall-clock. Hint is measured, never used to choose policy moves.',performance:'Offline development tool only, no runtime/browser worker integration. Work is fixed at1280 episodes, at most160 strict-node hint probes and40 existing bounded solver calls. The existing solve maxNodes is a requested soft bound: actual expansions are measured; terminal children can skip its check. No runtime solver is added.'},summary:{variants:variants.length,winningCertificates:certificates.length,certifiedCheckpoints:certificates.reduce((n,r)=>n+r.stages.length,0),independentPrefixReplaySwaps:certificates.reduce((n,r)=>n+r.prefixReplays,0),certificateReshuffles:certificates.reduce((n,r)=>n+r.reshuffles,0),certificateMaxCascadeWaves:Math.max(...certificates.map(r=>r.maxCascadeWaves)),originalLegacyRoutes:originals.length,observableEpisodes:sum('trials'),observableWins:sum('wins'),observableLosses:sum('losses'),observableMoves:sum('decisions'),offRouteStates:sum('offRouteStates'),strictOffRouteRestores:sum('strictCheckpointRestores'),legalVisibleAgreementChecks:sum('legalVisibleAgreementChecks'),reshuffles:sum('reshuffles'),attemptsWithRepeatedReshuffles:sum('attemptsWithRepeatedReshuffles'),maxConsecutiveReshuffles:Math.max(...rows.map(r=>r.maxConsecutiveReshuffles)),terminalLostZeroLegal:sum('terminalLostZeroLegal'),maxCascadeWaves:Math.max(...rows.map(r=>r.maxCascadeWaves)),cascadeLimitMoves:sum('cascadeLimitMoves'),lastMoveVisits:sum('lastMoveVisits'),lastMoveUnwinnableVisits:sum('lastMoveUnwinnableVisits'),lastMoveUniqueStates:lastMoveUnique,lastMoveUniqueProvenUnwinnable:lastMoveUniqueUnwinnable,hintProbes:hintProbes.length,hintSources:Object.fromEntries(['proven_route','search_win','heuristic'].map(source=>[source,hintProbes.filter(h=>h.source===source).length])),truncatedHints:hintProbes.filter(h=>h.truncated).length,guaranteedHints:hintProbes.filter(h=>h.guaranteed).length,solverProbes:solverProbes.length,solverActualSearchExpansions:solverProbes.reduce((n,p)=>n+p.actualSearchExpansions,0),solverRequestedBudgetExceeded:solverProbes.filter(p=>p.requestedBudgetExceeded).length,solverProvenWinnable:solverProbes.filter(p=>p.classification==='proven_winnable').length,solverUnknown:solverProbes.filter(p=>p.classification==='unknown_within_search_budget').length},levels,certificates,originals,variants,hintProbes,solverProbes,provenUnwinnableWitnesses:witnesses,terminalZeroLegalWitnesses,historicalObservableReference:historicalReference()};
 assert.equal(report.summary.variants,40);assert.equal(report.summary.winningCertificates,80);assert.equal(report.summary.certifiedCheckpoints,600);assert.equal(report.summary.observableEpisodes,1280);
 return report;
}
if(require.main===module){try{const started=performance.now(),report=run(),text=JSON.stringify(report,null,2)+'\n',target=path.join(ROOT,'reports/solvability-9-9.json');if(process.argv.includes('--write'))fs.writeFileSync(target,text);else if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),text,'Solvability audit report is stale');console.log(JSON.stringify({success:true,summary:report.summary,elapsedMs:Math.round(performance.now()-started),report:process.argv.includes('--write')?'written':process.argv.includes('--check')?'exactly reproduced':'not written'}));}catch(error){console.error(error);process.exitCode=1;}}
module.exports={SETTINGS,run};
