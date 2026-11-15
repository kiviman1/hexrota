/* Offline lab measurements reuse the existing visible-information simulator.
 * Full game RNG is used only by the engine resolving a chosen move, never by a policy. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {fork}=require('node:child_process');
const Audit=require('../audit-observable.cjs');
const Player=require('./observable-player.cjs');
const {HexMatch,certify,round}=require('./level-analysis.cjs');
const ROOT=path.resolve(__dirname,'..');
const SETTINGS=Object.freeze({trials:Audit.SETTINGS.trials,recoveryTrials:Audit.SETTINGS.recoveryTrials,decisionSeed:Audit.SETTINGS.decisionSeed,samples:Audit.SETTINGS.samples,depth:Audit.SETTINGS.depth});
const POLICIES=Player.POLICIES;
const RECOVERY_POLICIES=Object.freeze(POLICIES.filter(policy=>policy!=='random'));
const SOURCES=Object.freeze(['dist/engine.js','dist/levels.js','dist/attempts.js','dist/variants.json','lib/observable-player.cjs','lib/level-analysis.cjs','audit-observable.cjs','data/balance-lab-9-4.json','generate-balance-lab-candidates.cjs','dist/balance-lab-data.js','dist/balance-lab-catalog.js','lib/balance-lab-analysis.cjs','balance-lab-9-4.cjs']);
const copy=value=>JSON.parse(JSON.stringify(value));
const pairKey=pair=>pair.slice().sort((a,b)=>a-b).join(':');

// Exactly the existing audit seed schedule; candidate identity never influences a decision seed.
function decisionSeed(policyIndex,trial,turn){
 if(!Number.isInteger(policyIndex)||policyIndex<0||policyIndex>=POLICIES.length||!Number.isInteger(trial)||trial<0||trial>=SETTINGS.trials||!Number.isInteger(turn)||turn<0)throw Error('Invalid lab decision seed coordinates');
 return Player.mix32((SETTINGS.decisionSeed+Math.imul(policyIndex+1,104729)+Math.imul(trial+1,15485863)+Math.imul(turn+1,2654435761))>>>0);
}
function openingSummary(level){
 const game=new HexMatch(level),visible=Player.visibleState(game),options=Player.visibleOptions(visible);
 if(game.findMatches().length||options.length<2)throw Error('Lab start must be stable with multiple legal swaps');
 const choices={};
 for(const [index,policy]of POLICIES.entries()){
  const histogram=new Map();
  for(let trial=0;trial<SETTINGS.trials;trial++){
   const choice=Player.choose(visible,{policy,seed:decisionSeed(index,trial,0),samples:SETTINGS.samples,depth:SETTINGS.depth});
   if(!choice)throw Error('Lab opening policy returned no legal choice');
   const key=pairKey(choice.pair);histogram.set(key,(histogram.get(key)||0)+1);
  }
  const chosenPairs=[...histogram].map(([key,count])=>({pair:key.split(':').map(Number),count})).sort((a,b)=>a.pair[0]-b.pair[0]||a.pair[1]-b.pair[1]);
  choices[policy]={trials:SETTINGS.trials,distinctChosenPairs:chosenPairs.length,chosenPairs};
 }
 return {legalMoves:options.length,distinctFirstMatchPatterns:new Set(options.map(option=>option.matched.join(','))).size,minimumImmediateScore:Math.min(...options.map(option=>option.scoreGain)),maximumImmediateScore:Math.max(...options.map(option=>option.scoreGain)),minimumImmediateLayerHits:Math.min(...options.map(option=>option.layerGain)),maximumImmediateLayerHits:Math.max(...options.map(option=>option.layerGain)),choices};
}
function configuration(level){
 return {moves:level.moves,target:level.target,targetMode:level.targetMode==='exact'?'exact':'minimum',cells:level.cells.length,doubleCells:level.cells.filter(cell=>cell.layers===2).length,totalGroundLayers:level.cells.reduce((sum,cell)=>sum+(cell.layers||1),0),seed:level.seed,initial:level.initial.slice(),groundLayers:level.cells.map(cell=>cell.layers||1)};
}
function simulateMeasured(level,policy,{alternativeOpening=false}={}){
 // Observe actual terminal boards without reimplementing the old simulation.
 // The sampled policy uses a separate VM model/prototype, so its synthetic
 // futures cannot enter these counts or gain access to true terminal state.
 const original=HexMatch.prototype.swap,seen=new WeakSet();let terminalObservations=0,lossesSolelyLastGroundCell=0,lossesWithOneGroundCellAndMissingPoints=0;
 HexMatch.prototype.swap=function(...args){
  const result=original.apply(this,args);
  if(result.ok&&this.status!=='playing'&&!seen.has(this)){
   seen.add(this);terminalObservations++;
   if(this.status==='lost'&&this.total-this.covered===1){const scoreMet=this.level.targetMode==='exact'?this.score===this.level.target:this.score>=this.level.target;if(scoreMet)lossesSolelyLastGroundCell++;else lossesWithOneGroundCellAndMissingPoints++;}
  }
  return result;
 };
 let metrics;
 try{metrics=Audit.simulate(level,policy,{alternativeOpening});}finally{HexMatch.prototype.swap=original;}
 assert.equal(terminalObservations,metrics.trials,'observe exactly one real terminal board per original simulator trial');
 assert.equal(lossesSolelyLastGroundCell+lossesWithOneGroundCellAndMissingPoints,metrics.lossesWithOneGroundCell,'joint one-cell counters must partition the existing broader metric');
 return {...metrics,losses:metrics.trials-metrics.wins,terminalObservations,lossesSolelyLastGroundCell,lossesWithOneGroundCellAndMissingPoints};
}
function referenceRouteStatus(level,route){
 const game=new HexMatch(level);
 for(let step=0;step<route.length;step++){
  if(game.status==='won')return {status:'winning_prefix',moves:game.turn,publishedRouteLength:route.length};
  if(game.status!=='playing')return {status:'not_winning_for_candidate',reason:'terminal_before_end',moves:game.turn,publishedRouteLength:route.length};
  const swap=game.swap(...route[step]);if(!swap.ok)return {status:'not_winning_for_candidate',reason:swap.reason,moves:game.turn,publishedRouteLength:route.length};
 }
 return {status:game.status==='won'?'full_route_valid':'not_winning_for_candidate',reason:game.status==='won'?null:'goals_not_reached',moves:game.turn,publishedRouteLength:route.length};
}
function measureScenario(scenario){
 if(!scenario||typeof scenario.scenarioId!=='string'||!Number.isInteger(scenario.levelId)||!scenario.level)throw Error('Invalid lab scenario envelope');
 const before=JSON.stringify(scenario),level=scenario.level,routes=certify(level,level.solutions||[]);
 if(!(level.solutions||[]).every(route=>certify(level,[route]).length===1))throw Error('A known lab winning route failed replay');
 if(routes.length<2)throw Error('Lab scenario lacks two independently starting replay-certified winning routes: '+scenario.scenarioId);
 const published=JSON.parse(fs.readFileSync(path.join(ROOT,'dist/variants.json'),'utf8')).levels.find(entry=>entry.levelId===scenario.levelId)?.variants.find(variant=>variant.id===scenario.variantId);
 if(!published)throw Error('Lab scenario has no published variant reference');
 const publishedReferenceRoutes=published.solutions.map(route=>referenceRouteStatus(level,route));
 const opening=openingSummary(level),models={},recovery={};
 for(const policy of POLICIES)models[policy]=simulateMeasured(level,policy);
 for(const policy of RECOVERY_POLICIES)recovery[policy]=simulateMeasured(level,policy,{alternativeOpening:true});
 assert.equal(JSON.stringify(scenario),before,'measuring a scenario cannot mutate catalog data');
 return {scenarioId:scenario.scenarioId,levelId:scenario.levelId,variantId:scenario.variantId,experimentId:scenario.experimentId,label:scenario.label,factor:scenario.factor,changedFields:copy(scenario.changedFields),baselineRef:copy(scenario.baselineRef),configuration:configuration(level),certification:{status:'replay_verified',information:'full_information_validation_only',independentWinningOpenings:routes.length,routeLengths:routes.map(route=>route.length),winningFirstMoves:routes.map(route=>route[0].slice()),allKnownRoutesValid:true,publishedReferenceRoutes},opening,models,recovery};
}
function sum(rows,modelField,policy,field){return rows.reduce((total,row)=>total+(row[modelField][policy][field]||0),0);}
const MEANS=Object.freeze(['averageMovesUsed','averageScore','averageGroundCompletion','averageRemainingLayers','averageMissingPoints','averageMissingGroundCells','averagePartialDoubleCells','averageCascadeWavesPerMove','averageExtraCascadeWavesPerAttempt','averageMovesAtFinalCell']);
function aggregateModels(rows,modelField,policies){
 if(!Array.isArray(rows)||!rows.length)throw Error('Cannot aggregate an empty lab cohort');
 const models={},variantSpread={};
 for(const policy of policies){
  const trials=sum(rows,modelField,policy,'trials'),wins=sum(rows,modelField,policy,'wins');
  const model={trials,wins,losses:trials-wins,winRate:round(100*wins/trials)};
  for(const field of MEANS)model[field]=round(rows.reduce((total,row)=>total+row[modelField][policy][field]*row[modelField][policy].trials,0)/trials);
  model.averageMovesLeftOnWin=wins?round(rows.reduce((total,row)=>total+(row[modelField][policy].averageMovesLeftOnWin||0)*row[modelField][policy].wins,0)/wins):null;
  for(const field of ['lossesWithOneGroundCell','lossesSolelyLastGroundCell','lossesWithOneGroundCellAndMissingPoints','scoreReachedBeforeGroundTrials'])model[field]=sum(rows,modelField,policy,field);
  model.failures=Object.fromEntries(['pointsMissingOnly','groundMissingOnly','bothMissing'].map(field=>[field,rows.reduce((total,row)=>total+row[modelField][policy].failures[field],0)]));
  model.sumUniqueTrajectories=sum(rows,modelField,policy,'uniqueTrajectories');
  if(modelField==='recovery'){
   model.changedOpenings=sum(rows,modelField,policy,'changedOpenings');model.changedOpeningWins=sum(rows,modelField,policy,'changedOpeningWins');model.changedOpeningWinRate=model.changedOpenings?round(100*model.changedOpeningWins/model.changedOpenings):null;
  }
  models[policy]=model;
  const rates=rows.map(row=>({variantId:row.variantId,winRate:row[modelField][policy].winRate}));
  const minimum=Math.min(...rates.map(row=>row.winRate)),maximum=Math.max(...rates.map(row=>row.winRate));
  variantSpread[policy]={minimumWinRate:minimum,maximumWinRate:maximum,spreadPercentagePoints:round(maximum-minimum),hardestVariants:rates.filter(row=>row.winRate===minimum).map(row=>row.variantId),easiestVariants:rates.filter(row=>row.winRate===maximum).map(row=>row.variantId)};
 }
 return {models,variantSpread};
}
function aggregate(rows){
 return {variants:rows.map(row=>row.variantId),scenarioIds:rows.map(row=>row.scenarioId),...aggregateModels(rows,'models',POLICIES),recovery:aggregateModels(rows,'recovery',RECOVERY_POLICIES),opening:{legalMoveRange:[Math.min(...rows.map(row=>row.opening.legalMoves)),Math.max(...rows.map(row=>row.opening.legalMoves))],firstMatchPatternRange:[Math.min(...rows.map(row=>row.opening.distinctFirstMatchPatterns)),Math.max(...rows.map(row=>row.opening.distinctFirstMatchPatterns))],chosenPairDiversity:Object.fromEntries(POLICIES.map(policy=>[policy,rows.map(row=>({variantId:row.variantId,distinctChosenPairs:row.opening.choices[policy].distinctChosenPairs}))]))}};
}
function deltas(baseline,candidate,policies=POLICIES){
 return Object.fromEntries(policies.map(policy=>{
  const a=baseline.models[policy],b=candidate.models[policy];
  return [policy,{winRatePercentagePoints:round(b.winRate-a.winRate),wins:b.wins-a.wins,losses:b.losses-a.losses,averageMovesUsed:round(b.averageMovesUsed-a.averageMovesUsed),averageMissingPoints:round(b.averageMissingPoints-a.averageMissingPoints),averageMissingGroundCells:round(b.averageMissingGroundCells-a.averageMissingGroundCells),averageRemainingLayers:round(b.averageRemainingLayers-a.averageRemainingLayers),lossesWithOneGroundCell:b.lossesWithOneGroundCell-a.lossesWithOneGroundCell,lossesSolelyLastGroundCell:b.lossesSolelyLastGroundCell-a.lossesSolelyLastGroundCell,groundOnlyLosses:b.failures.groundMissingOnly-a.failures.groundMissingOnly,...policies===RECOVERY_POLICIES?{changedOpenings:b.changedOpenings-a.changedOpenings,changedOpeningWinRatePercentagePoints:a.changedOpeningWinRate!==null&&b.changedOpeningWinRate!==null?round(b.changedOpeningWinRate-a.changedOpeningWinRate):null}:{}}];
 }));
}
function sourceFingerprint(){
 const digest=crypto.createHash('sha256');
 const sources=SOURCES.map(file=>{const bytes=fs.readFileSync(path.join(ROOT,file));digest.update(file+'\0');digest.update(bytes);return {file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
 return {sourceHash:digest.digest('hex'),sources};
}
function checkOriginalMetrics(rows){
 const old=JSON.parse(fs.readFileSync(path.join(ROOT,'reports/observable-difficulty.json'),'utf8'));let comparisons=0;
 for(const row of rows.filter(row=>row.experimentId==='baseline')){
  const original=old.levels.find(level=>level.levelId===row.levelId)?.variants.find(variant=>variant.variantId===row.variantId);
  if(!original)throw Error('Original lab scenario has no existing audit counterpart');
  for(const [field,policies]of [['models',POLICIES],['recovery',RECOVERY_POLICIES]])for(const policy of policies){const metrics={...row[field][policy]};for(const extra of ['losses','terminalObservations','lossesSolelyLastGroundCell','lossesWithOneGroundCellAndMissingPoints'])delete metrics[extra];assert.deepEqual(metrics,original[field][policy],'baseline must exactly reproduce unchanged observable audit metrics');comparisons++;}
 }
 return comparisons;
}
function buildReport(scenarios,rows,{partial=false}={}){
 if(scenarios.length!==rows.length||new Set(rows.map(row=>row.scenarioId)).size!==rows.length)throw Error('Lab result coverage mismatch');
 const lookup=new Map(rows.map(row=>[row.scenarioId,row]));
 for(const scenario of scenarios)if(!lookup.has(scenario.scenarioId))throw Error('Missing lab scenario result');
 for(const row of rows)if(row.experimentId!=='baseline'&&!rows.some(original=>original.experimentId==='baseline'&&original.levelId===row.levelId&&original.variantId===row.variantId))throw Error('Candidate result requires its same-variant baseline');
 const originalMetricComparisons=checkOriginalMetrics(rows),levels=[];
 for(let levelId=1;levelId<=10;levelId++){
  const baselineRows=rows.filter(row=>row.levelId===levelId&&row.experimentId==='baseline');if(!baselineRows.length)continue;
  const baseline=aggregate(baselineRows),experimentIds=[...new Set(rows.filter(row=>row.levelId===levelId&&row.experimentId!=='baseline').map(row=>row.experimentId))],experiments=[];
  for(const experimentId of experimentIds){
   const candidateRows=rows.filter(row=>row.levelId===levelId&&row.experimentId===experimentId),affected=new Set(candidateRows.map(row=>row.variantId)),matchedRows=baselineRows.filter(row=>affected.has(row.variantId));
   if(candidateRows.length!==matchedRows.length)throw Error('Candidate cohort lacks matching baseline variants');
   const matchedBaseline=aggregate(matchedRows),candidate=aggregate(candidateRows),projectedRows=baselineRows.map(original=>candidateRows.find(row=>row.variantId===original.variantId)||original),projected=aggregate(projectedRows);
   experiments.push({experimentId,label:candidateRows[0].label,factor:candidateRows[0].factor,changedFields:copy(candidateRows[0].changedFields),affectedVariants:candidateRows.map(row=>row.variantId),comparison:{matchedVariants:{baseline:matchedBaseline,candidate,delta:deltas(matchedBaseline,candidate),recoveryDelta:deltas(matchedBaseline.recovery,candidate.recovery,RECOVERY_POLICIES)},projectedWholeLevel:{baseline,candidate:projected,delta:deltas(baseline,projected),recoveryDelta:deltas(baseline.recovery,projected.recovery,RECOVERY_POLICIES)}},variantComparisons:candidateRows.map(candidateRow=>{const original=matchedRows.find(row=>row.variantId===candidateRow.variantId),a=aggregate([original]),b=aggregate([candidateRow]);return {variantId:candidateRow.variantId,baselineScenarioId:original.scenarioId,candidateScenarioId:candidateRow.scenarioId,baselineConfiguration:original.configuration,candidateConfiguration:candidateRow.configuration,delta:deltas(a,b),recoveryDelta:deltas(a.recovery,b.recovery,RECOVERY_POLICIES)};})});
  }
  levels.push({levelId,baseline,experiments});
 }
 const baselineRows=rows.filter(row=>row.experimentId==='baseline'),candidateRows=rows.filter(row=>row.experimentId!=='baseline');
 if(!partial&&(levels.length!==10||baselineRows.length!==40||baselineRows.reduce((n,row)=>n+row.certification.independentWinningOpenings,0)!==80))throw Error('Full lab report requires all40originalvariants and80originalroutes');
 return {schemaVersion:1,labVersion:'balance-lab-9-4-v1',status:'analysis_only_not_published',partial,...sourceFingerprint(),method:{...SETTINGS,policies:POLICIES,scenarioCount:rows.length,baselineScenarios:baselineRows.length,candidateScenarios:candidateRows.length,standardGames:rows.length*POLICIES.length*SETTINGS.trials,recoveryGames:rows.length*RECOVERY_POLICIES.length*SETTINGS.recoveryTrials,simulatedGames:rows.length*(POLICIES.length*SETTINGS.trials+RECOVERY_POLICIES.length*SETTINGS.recoveryTrials),recoveryPolicies:RECOVERY_POLICIES,recoveryDefinition:'Existing alternativeOpening simulator: first choose another visible legal opening with no more than one fewer immediate layer hit and at least60%of visible score, if available. This is a plausible deviation, not a proven mistake.',lastCellDefinition:'lossesSolelyLastGroundCell means a lost real terminal board with score target met and exactly one green cell missing; lossesWithOneGroundCell also includes missing points.',terminalObservation:'Passive actual-engine swap observer scoped in try/finally; synthetic sampled-model swaps have a separate prototype. Exactly one terminal observation per simulated game; observer outputs never enter a decision.',openingChoiceEvaluations:rows.length*POLICIES.length*SETTINGS.trials,decisionSeedFormula:'mix32((decisionSeed + imul(policyIndex+1,104729) + imul(trial+1,15485863) + imul(turn+1,2654435761)) >>> 0)',commonDecisionSeeds:true,sharedSimulator:'audit-observable.cjs.simulate (unchanged)',sharedDecisionPolicies:'lib/observable-player.cjs (unchanged)',aggregation:'Trial-weighted means of existing four-decimal simulator metrics; moves remaining on wins weighted by win count. Full-level projection retains original rows for unaffected variants.',informationBoundary:'Policies only receive visibleState DTO. Real RNG, initial seed, history and certificates are unavailable to decisions. Sampled futures use independent bot decision seeds.',comparison:'Matched common-seed aggregate deltas, not paired-trial win/loss discordance. Candidate rows compare only to their same published variant; projectedWholeLevel shows the effect across all four variants.',limitations:['Bot rates are not human win rates; repeated deterministic trials are not independent players.','The same decision seed does not force the same move after visible board, layers or move budget change. More moves need not monotonically improve a sampled policy.','No failed bounded search is called proof of impossibility. Only replayed winning routes are certificates.','Opening-choice evaluations repeat first decisions only; they are not extra complete games.','Experimental levels have isolated lab identities and are never production attempt configurations.','Publishing changed budgets, targets, geometry or ground requires versioned base-level archives plus retained old variants/saves.']},certification:{originalVariants:baselineRows.length,originalWinningRoutes:baselineRows.reduce((n,row)=>n+row.certification.independentWinningOpenings,0),originalPublishedRoutesReplayed:baselineRows.reduce((n,row)=>n+row.certification.publishedReferenceRoutes.length,0),originalPublishedRoutesAllUnchanged:baselineRows.every(row=>row.certification.publishedReferenceRoutes.every(route=>route.status==='full_route_valid')),candidateScenarios:candidateRows.length,candidateWinningRoutes:candidateRows.reduce((n,row)=>n+row.certification.independentWinningOpenings,0),allScenariosHaveTwoIndependentWinningRoutes:rows.every(row=>row.certification.independentWinningOpenings>=2&&row.certification.allKnownRoutesValid),existingAuditMetricComparisons:originalMetricComparisons},levels,scenarios:rows};
}
function loadScenarios(){
 const Catalog=require('../dist/balance-lab-catalog.js'),data=JSON.parse(fs.readFileSync(path.join(ROOT,'data/balance-lab-9-4.json'),'utf8'));
 const {HEX_LEVELS}=require('./level-analysis.cjs'),pack=JSON.parse(fs.readFileSync(path.join(ROOT,'dist/variants.json'),'utf8'));
 return Catalog.createCatalog(HEX_LEVELS,pack,data,HexMatch).listScenarios();
}
async function measureAll(scenarios,{workers=4,quiet=false}={}){
 if(!Number.isInteger(workers)||workers<1||workers>4)throw Error('Balance Lab workers must be1..4');
 if(workers===1)return scenarios.map((scenario,index)=>{const row=measureScenario(scenario);if(!quiet)console.log(`Balance Lab ${index+1}/${scenarios.length}: ${scenario.scenarioId}`);return row;});
 const output=Array(scenarios.length),children=new Set();let cursor=0,completed=0;
 try{
  await Promise.all(Array.from({length:Math.min(workers,scenarios.length)},()=>new Promise((resolve,reject)=>{
   // The old audit starts a task whenever imported in a worker_thread. Child
   // processes preserve its normal-main import semantics without copying it.
   const child=fork(path.join(ROOT,'balance-lab-9-4.cjs'),['--worker'],{stdio:['ignore','ignore','pipe','ipc']});children.add(child);let current=-1,stderr='',finished=false;
   child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
   const sendNext=()=>{if(cursor>=scenarios.length){finished=true;child.disconnect();resolve();return;}current=cursor++;child.send(scenarios[current]);};
   child.on('message',message=>{if(message.error){reject(Error(message.error));return;}if(current<0||message.result?.scenarioId!==scenarios[current].scenarioId){reject(Error('Invalid lab worker response'));return;}output[current]=message.result;completed++;if(!quiet)console.log(`Balance Lab ${completed}/${scenarios.length}: ${message.result.scenarioId}`);sendNext();});
   child.on('error',reject);child.on('exit',code=>{children.delete(child);if(!finished)reject(Error('Balance Lab worker exited early '+code+' '+stderr));});sendNext();
  })));
 }finally{for(const child of children)child.kill();}
 return output;
}
module.exports={SETTINGS,POLICIES,RECOVERY_POLICIES,SOURCES,decisionSeed,openingSummary,configuration,simulateMeasured,measureScenario,aggregate,deltas,sourceFingerprint,checkOriginalMetrics,buildReport,loadScenarios,measureAll};
