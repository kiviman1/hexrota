/* Repeatable offline audit. Hidden state is used to resolve play and certify paths,
 * never passed to the observable decision function. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {HexMatch,HEX_LEVELS,asLevel,solve,certify,round}=require('./lib/level-analysis.cjs');
const Player=require('./lib/observable-player.cjs');
const root=__dirname,pack=JSON.parse(fs.readFileSync(path.join(root,'dist/variants.json'),'utf8'));
const SETTINGS=Object.freeze({trials:64,decisionSeed:0x6d2b79f5,samples:4,depth:2,recoveryTrials:64,openingProbeWidth:20,openingProbeNodes:6000});
const pairKey=p=>p.slice().sort((a,b)=>a-b).join(':');
function decisionSeed(policy,trial,turn){return Player.mix32((SETTINGS.decisionSeed+Math.imul(policy+1,104729)+Math.imul(trial+1,15485863)+Math.imul(turn+1,2654435761))>>>0);}
function alternative(publicState,chosen,seed){
 const options=Player.visibleOptions(publicState),preferred=options.find(o=>pairKey(o.pair)===pairKey(chosen));
 const plausible=options.filter(o=>pairKey(o.pair)!==pairKey(chosen)&&o.layerGain>=Math.max(1,preferred.layerGain-1)&&o.scoreGain>=preferred.scoreGain*.6);
 return plausible.length?plausible[seed%plausible.length].pair:null;
}
function simulate(level,policy,{alternativeOpening=false}={}){
 let wins=0,moves=0,winLeft=0,score=0,ground=0,layers=0,pointDeficit=0,cellDeficit=0,waves=0,cascades=0,partialDouble=0,lastCellLosses=0,lastCellMoves=0,scoreBeforeGround=0,changedOpenings=0,changedOpeningWins=0;
 const paths=new Set(),failures={pointsMissingOnly:0,groundMissingOnly:0,bothMissing:0},trials=alternativeOpening?SETTINGS.recoveryTrials:SETTINGS.trials,policyIndex=Player.POLICIES.indexOf(policy);
 for(let trial=0;trial<trials;trial++){
  const game=new HexMatch(level);let lastStageMoves=0,scoreFirst=false,openingChanged=false;
  while(game.status==='playing'){
   const publicState=Player.visibleState(game),seed=decisionSeed(policyIndex,trial,game.turn),choice=Player.choose(publicState,{policy,seed,samples:SETTINGS.samples,depth:SETTINGS.depth});
   if(!choice)throw Error('Observable player cannot move on a playing board');
   let pair=choice.pair;
   if(alternativeOpening&&game.turn===0){const other=alternative(publicState,pair,seed);if(other){pair=other;changedOpenings++;openingChanged=true;}}
   if(game.total-game.covered===1)lastStageMoves++;
   const result=game.swap(...pair);if(!result.ok)throw Error('Observable player picked illegal swap');
   waves+=result.frames.length;cascades+=Math.max(0,result.frames.length-1);
   if(game.score>=level.target&&game.covered<game.total)scoreFirst=true;
  }
  paths.add(JSON.stringify(game.history));moves+=game.turn;score+=game.score;ground+=game.covered/game.total;layers+=game.remainingLayers;pointDeficit+=Math.max(0,level.target-game.score);cellDeficit+=game.total-game.covered;lastCellMoves+=lastStageMoves;scoreBeforeGround+=Number(scoreFirst);
  partialDouble+=level.cells.filter((c,i)=>c.layers===2&&game.layers[i]===1).length;
  if(game.status==='won'){wins++;winLeft+=game.movesLeft;changedOpeningWins+=Number(openingChanged);}else{lastCellLosses+=Number(game.total-game.covered===1);if(game.covered===game.total)failures.pointsMissingOnly++;else if(game.score>=level.target)failures.groundMissingOnly++;else failures.bothMissing++;}
 }
 return {trials,wins,winRate:round(wins/trials*100),averageMovesUsed:round(moves/trials),averageMovesLeftOnWin:wins?round(winLeft/wins):null,averageScore:round(score/trials),averageGroundCompletion:round(ground/trials),averageRemainingLayers:round(layers/trials),averageMissingPoints:round(pointDeficit/trials),averageMissingGroundCells:round(cellDeficit/trials),averagePartialDoubleCells:round(partialDouble/trials),averageCascadeWavesPerMove:round(waves/Math.max(1,moves)),averageExtraCascadeWavesPerAttempt:round(cascades/trials),lossesWithOneGroundCell:lastCellLosses,averageMovesAtFinalCell:round(lastCellMoves/trials),scoreReachedBeforeGroundTrials:scoreBeforeGround,uniqueTrajectories:paths.size,failures,...alternativeOpening?{changedOpenings,changedOpeningWins,changedOpeningWinRate:changedOpenings?round(changedOpeningWins/changedOpenings*100):null}:{} };
}
function openings(level,variant,focus){
 const publicState=Player.visibleState(new HexMatch(level)),options=Player.visibleOptions(publicState),ranked=options.slice().sort((a,b)=>(b.layerGain*100+b.greenGain*35+b.scoreGain*.1)-(a.layerGain*100+a.greenGain*35+a.scoreGain*.1));
 const result={legalMoves:options.length,distinctFirstMatchPatterns:new Set(options.map(o=>o.matched.join(','))).size,minimumImmediateScore:Math.min(...options.map(o=>o.scoreGain)),maximumImmediateScore:Math.max(...options.map(o=>o.scoreGain)),minimumImmediateLayerHits:Math.min(...options.map(o=>o.layerGain)),maximumImmediateLayerHits:Math.max(...options.map(o=>o.layerGain)),certifiedIndependentOpenings:new Set(variant.solutions.map(r=>pairKey(r[0]))).size};
 if(focus)result.goodLookingOpeningProbes=ranked.slice(0,3).map(option=>{
  const known=variant.solutions.find(route=>pairKey(route[0])===pairKey(option.pair)),route=known||solve(level,{prefix:[option.pair],width:SETTINGS.openingProbeWidth,maxNodes:SETTINGS.openingProbeNodes});
  return {pair:option.pair,immediateVisibleScore:option.scoreGain,immediateVisibleLayerHits:option.layerGain,firstMatchIndices:option.matched,recoveryCertificate:!!route,source:known?'published_certificate':route?'bounded_full_information_search':'not_found_within_budget',certifiedTotalMoves:route?route.length:null};
 });
 return result;
}
function auditVariant(item){
 const base=HEX_LEVELS.find(l=>l.id===item.levelId),level=asLevel(base,item.variant),proofs=certify(level,item.variant.solutions);
 if(proofs.length<2)throw Error('Published independent win certificates failed');
 const models={};for(const policy of Player.POLICIES)models[policy]=simulate(level,policy);
 const recovery={};for(const policy of ['visible_score','visible_coverage','sampled'])recovery[policy]=simulate(level,policy,{alternativeOpening:true});
 return {levelId:item.levelId,variantId:item.variant.id,fullInformationCertificates:{valid:true,independentOpenings:proofs.length,routeLengths:proofs.map(r=>r.length)},opening:openings(level,item.variant,[4,5,8,9,10].includes(item.levelId)),models,recovery};
}
function summarize(results){
 return pack.levels.map(entry=>{
  const base=HEX_LEVELS.find(l=>l.id===entry.levelId),variants=results.filter(v=>v.levelId===entry.levelId),means={};
  for(const policy of Player.POLICIES){const fields=['winRate','averageMovesUsed','averageScore','averageGroundCompletion','averageRemainingLayers','averageMissingPoints','averageMissingGroundCells','averagePartialDoubleCells','averageMovesAtFinalCell'];means[policy]=Object.fromEntries(fields.map(field=>[field,round(variants.reduce((n,v)=>n+v.models[policy][field],0)/variants.length)]));means[policy].variantWinRateRange=[Math.min(...variants.map(v=>v.models[policy].winRate)),Math.max(...variants.map(v=>v.models[policy].winRate))];means[policy].lossesWithOneGroundCell=variants.reduce((n,v)=>n+v.models[policy].lossesWithOneGroundCell,0);means[policy].failures=Object.fromEntries(['pointsMissingOnly','groundMissingOnly','bothMissing'].map(key=>[key,variants.reduce((n,v)=>n+v.models[policy].failures[key],0)]));}
  const recovery=Object.fromEntries(['visible_score','visible_coverage','sampled'].map(policy=>[policy,{meanWinRate:round(variants.reduce((n,v)=>n+v.recovery[policy].winRate,0)/variants.length),changedOpenings:variants.reduce((n,v)=>n+v.recovery[policy].changedOpenings,0),changedOpeningWins:variants.reduce((n,v)=>n+v.recovery[policy].changedOpeningWins,0),changedOpeningWinRate:(()=>{const n=variants.reduce((n,v)=>n+v.recovery[policy].changedOpenings,0);return n?round(variants.reduce((n,v)=>n+v.recovery[policy].changedOpeningWins,0)/n*100):null;})(),differenceFromStandard:round(variants.reduce((n,v)=>n+v.recovery[policy].winRate-v.models[policy].winRate,0)/variants.length)}]));
  return {levelId:base.id,label:entry.difficulty.label,cells:base.cells.length,doubleCells:base.cells.filter(c=>c.layers===2).length,moves:base.moves,target:base.target,models:means,recovery,variants};
 });
}
async function run(){
 const items=pack.levels.flatMap(entry=>entry.variants.map(variant=>({levelId:entry.levelId,variant}))),results=Array(items.length);let index=0;
 const workers=Math.max(1,Math.min(4,Number(process.env.HEXROTA_AUDIT_WORKERS)||4));
 await Promise.all(Array.from({length:workers},async()=>{while(index<items.length){const current=index++;results[current]=await new Promise((resolve,reject)=>{const worker=new Worker(__filename,{workerData:items[current]});worker.on('message',resolve);worker.on('error',reject);worker.on('exit',code=>{if(code)reject(Error('Observable audit worker failed: '+code));});});if(!process.argv.includes('--quiet'))console.log(`Observable audit ${current+1}/${items.length}: level${items[current].levelId}/${items[current].variant.id}`);}}));
 const full=JSON.parse(fs.readFileSync(path.join(root,'balance-report.json'),'utf8'));
 const fingerprint=crypto.createHash('sha256');for(const file of ['dist/engine.js','dist/levels.js','dist/variants.json','lib/observable-player.cjs','audit-observable.cjs'])fingerprint.update(fs.readFileSync(path.join(root,file)));
 const report={schemaVersion:1,levelDataVersion:pack.levelDataVersion,sourceHash:fingerprint.digest('hex'),method:{...SETTINGS,information:'Visible-only decisions. Exact RNG/seed/solutions/history are absent from policy inputs. Sampled policy uses independent synthetic draws from its own decision seed, never actual future draws.',publicRulesAssumption:'The allowed numeric palette is treated as public game rules; its order is fixed. No refill distribution beyond the current controlled-refill rule is inferred from hidden state.',models:{random:'Uniform seeded legal swap.',visible_score:'Highest visible first-wave score, with small layer/green tie preference.',visible_coverage:'Highest visible first-wave layer gain, then new green cells and capped points.',sampled:'Four independent counterfactual refill samples; two-ply rollout with visible-coverage follow-up. This is an approximation, not a guarantee.'},warning:'Simulation policy rates are not human win rates. Failure of bounded recovery search does not prove a state unsolvable. Alternative openings are plausible visible deviations, not objectively proven mistakes.'},certification:{kind:'full-information solver / published replay certificates',variants:items.length,independentWinningRoutes:results.reduce((n,v)=>n+v.fullInformationCertificates.independentOpenings,0),allValid:true},fullInformationReference:full.levels.map(l=>({levelId:l.levelId,rates:l.averagePolicyWinRates})),levels:summarize(results)};
 const target=path.join(root,'reports/observable-difficulty.json'),expected=JSON.stringify(report,null,2)+'\n';
 if(process.argv.includes('--write')){fs.writeFileSync(target,expected);console.log('Observable audit report written.');}else{if(fs.readFileSync(target,'utf8')!==expected)throw Error('Observable report is stale; run npm run audit:observable');console.log('Observable report exactly reproduces for all40 variants and hidden-information-free policies.');}
 console.log(JSON.stringify(report.levels.map(l=>({level:l.levelId,random:l.models.random.winRate,score:l.models.visible_score.winRate,coverage:l.models.visible_coverage.winRate,sampled:l.models.sampled.winRate,recovery:l.recovery.sampled.meanWinRate}))));
}
if(!isMainThread){try{parentPort.postMessage(auditVariant(workerData));}catch(error){throw error;}}
else if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={SETTINGS,simulate,auditVariant};
