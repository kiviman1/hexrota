/* Offline catalog search and certificate validation. The browser only reads its output. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {HexMatch,HEX_LEVELS,POLICIES,rng,pairKey,round,analyse,solve,certify,asLevel}=require('./lib/level-analysis.cjs');
const rules=JSON.parse(fs.readFileSync(path.join(__dirname,'dist/difficulty-rules.json'),'utf8'));
const countArgument=process.argv.find(arg=>arg.startsWith('--count='));
const VARIANT_COUNT=countArgument?Number(countArgument.split('=')[1]):rules.variantsPerLevel;
if(!Number.isSafeInteger(VARIANT_COUNT)||VARIANT_COUNT<4)throw Error('Variant count must be an integer of at least four');
const cacheDir=process.env.HEXROTA_VARIANT_CACHE||path.join(os.tmpdir(),'hexrota-variants-v1');
const hash=require('node:crypto').createHash('sha256').update(fs.readFileSync(__filename)).update(fs.readFileSync(path.join(__dirname,'lib/level-analysis.cjs'))).update(JSON.stringify(rules)).digest('hex');
const options=trials=>({trials,seed:rules.simulationSeed,planning:rules.planning,easeWeights:rules.easeWeights});
function candidate(base,attempt){
 const seed=(0x45d9f3b+base.id*1000003+attempt*2654435761)>>>0,random=rng(seed),game=new HexMatch(base);
 let initial;
 for(let pass=0;pass<1000;pass++){
  if(base.id===9){
   // A recovery stage can begin with fewer distinct allowed values. The running
   // level still uses its full original palette for every later refill.
   const count=attempt%4===0?4:3,offset=attempt%base.palette.length;
   const palette=Array.from({length:count},(_,i)=>base.palette[(offset+i)%base.palette.length]);
   game.level={...base,palette};game.values=base.cells.map(()=>null);game.rngState=(seed+pass*104729)>>>0||1;game._fillVacancies();initial=game.values.slice();game.level=base;
  }else if(attempt%3===0){initial=base.initial.slice();const count=2+(attempt%9);for(let i=0;i<count;i++)initial[Math.floor(random()*initial.length)]=base.palette[Math.floor(random()*base.palette.length)];}
  else initial=base.cells.map(()=>base.palette[Math.floor(random()*base.palette.length)]);
  game.values=initial;
  if(!game.findMatches().length&&game.legalMoves().length>=3)break;
  initial=null;
 }
 if(!initial)return null;
 const refillSeed=(0x9e3779b9+base.id*334214459+attempt*2246822519)>>>0;
 return {...base,initial,seed:refillSeed||1,solution:[],alternativeSolutions:[],solutions:[]};
}
function metricsFor(analysis,solutions,base){
 return {easeScore:analysis.easeScore,difficultyIndex:analysis.difficultyIndex,planningAdvantage:analysis.planningAdvantage,policyWinRates:Object.fromEntries(POLICIES.map(p=>[p,analysis.policies[p].winRate])),shortestCertifiedMoves:solutions[0].length,certifiedRouteLengths:solutions.map(r=>r.length),spareMovesOnShortestRoute:base.moves-solutions[0].length};
}
function acceptance(base,target,analysis,solutions,accepted){
 const reasons=[];
 if(analysis.easeScore<target.easeBand[0]||analysis.easeScore>target.easeBand[1])reasons.push('ease-band');
 if(analysis.policies.planning.winRate<target.minimumPlanningWinRate)reasons.push('planning-floor');
 if(solutions!==null&&solutions.length<2)reasons.push('independent-opening');
 if(solutions?.length&&solutions[0].length<3)reasons.push('too-short');
 if(accepted.length){
  const all=accepted.map(v=>v.analysis).concat(analysis),spans=(values,max)=>Math.max(...values)-Math.min(...values)>max+1e-6;
  if(spans(all.map(v=>v.easeScore),rules.maxEaseSpread))reasons.push('ease-spread');
  for(const policy of ['greedy','coverage','planning']){
   if(spans(all.map(v=>v.policies[policy].winRate),rules.maxPolicyWinRateSpread))reasons.push(policy+'-rate-spread');
   if(spans(all.map(v=>v.policies[policy].averageMovesUsed),rules.maxAverageMovesUsedSpread))reasons.push(policy+'-moves-spread');
   if(spans(all.map(v=>v.policies[policy].averageGroundCompletion),rules.maxAverageGroundCompletionSpread))reasons.push(policy+'-ground-spread');
  }
  if(solutions?.length&&spans(accepted.map(v=>v.solutions[0].length).concat(solutions[0].length),rules.maxCertifiedMoveSpread))reasons.push('certificate-length-spread');
 }
 return reasons;
}
function completeSolutions(level,known){
 let solutions=certify(level,known);
 if(!solutions.length){const main=solve(level,{width:40});if(main)solutions=certify(level,[main]);}
 if(solutions.length<2){
  const done=new Set(solutions.map(r=>pairKey(r[0]))),openings=new HexMatch(level).legalMoves().filter(p=>!done.has(pairKey(p)));
  openings.sort((a,b)=>{const g1=new HexMatch(level),g2=new HexMatch(level);g1.swap(...a);g2.swap(...b);return g1.remainingLayers-g2.remainingLayers;});
  for(const pair of openings.slice(0,8)){const alternative=solve(level,{width:32,prefix:[pair]});if(alternative){solutions=certify(level,solutions.concat([alternative]));if(solutions.length>=2)break;}}
 }
 return solutions.slice(0,2);
}
function searchLevel(levelIndex){
 const base=HEX_LEVELS[levelIndex],target=rules.targets[levelIndex],accepted=[],rejects={},initials=new Set();let attempts=0,screened=0,fullAnalyses=0;
 const cached=path.join(cacheDir,'level-'+base.id+'.json');
 if(process.argv.includes('--resume')&&fs.existsSync(cached))try{
  const data=JSON.parse(fs.readFileSync(cached));
  if(data.accepted?.length===VARIANT_COUNT){
   const checked=[];
   for(const v of data.accepted){
    const expected=candidate(base,v.candidateAttempt);if(!expected||JSON.stringify(expected.initial)!==JSON.stringify(v.initial)||expected.seed!==v.seed)throw Error('Candidate construction changed');
    const level={...base,initial:v.initial,seed:v.seed},analysis=analyse(level,options(rules.trialsPerPolicy)),solutions=certify(level,v.solutions);
    if(acceptance(base,target,analysis,solutions,checked).length)throw Error('Cached candidate no longer meets current gates');
    checked.push({...v,analysis,solutions});
   }
   const result={...data,hash,accepted:checked};fs.writeFileSync(cached,JSON.stringify(result));return result;
  }
 }catch(_){}
 const limit=Number(process.env.HEXROTA_VARIANT_ATTEMPTS)||3000;
 for(let attempt=0;attempt<limit&&accepted.length<VARIANT_COUNT;attempt++){
  attempts=attempt+1;const level=candidate(base,attempt);if(!level){rejects.initial=(rejects.initial||0)+1;continue;}
  const key=level.initial.join(',');if(initials.has(key)||level.seed===base.seed||key===base.initial.join(',')){rejects.duplicate=(rejects.duplicate||0)+1;continue;}
  const screen=analyse(level,options(8));screened++;
  if(screen.easeScore<target.easeBand[0]-8||screen.easeScore>target.easeBand[1]+8||screen.policies.planning.winRate<target.minimumPlanningWinRate-20){rejects.screen=(rejects.screen||0)+1;continue;}
  const analysis=analyse(level,options(rules.trialsPerPolicy));fullAnalyses++;
  // Reject a metric mismatch before spending time finding route certificates.
  let reasons=acceptance(base,target,analysis,null,accepted);
  if(reasons.length){for(const reason of reasons)rejects[reason]=(rejects[reason]||0)+1;continue;}
  const solutions=completeSolutions(level,analysis.winningRoutes);reasons=acceptance(base,target,analysis,solutions,accepted);
  if(reasons.length){for(const reason of reasons)rejects[reason]=(rejects[reason]||0)+1;continue;}
  initials.add(key);accepted.push({initial:level.initial,seed:level.seed,solutions,analysis,candidateAttempt:attempt});
  parentPort?.postMessage({progress:{level:base.id,accepted:accepted.length,attempts,ease:analysis.easeScore,rates:Object.fromEntries(POLICIES.map(p=>[p,analysis.policies[p].winRate])),par:solutions[0].length}});
  fs.mkdirSync(cacheDir,{recursive:true});fs.writeFileSync(cached,JSON.stringify({hash,levelId:base.id,attempts,screened,fullAnalyses,rejects,accepted}));
 }
 if(accepted.length!==VARIANT_COUNT)throw Error(`Level ${base.id} accepted only ${accepted.length}/${VARIANT_COUNT} after ${attempts} candidates; gates unchanged. ${JSON.stringify(rejects)}`);
 const result={hash,levelId:base.id,attempts,screened,fullAnalyses,rejects,accepted};fs.writeFileSync(cached,JSON.stringify(result));return result;
}
function validateCurve(levels){
 const at=id=>levels.find(level=>level.levelId===id).averageEaseScore;
 const checks=[];
 for(const [from,to] of [[1,2],[2,3],[3,4],[4,5],[6,7],[7,8]])checks.push({kind:'ramp',from,to,gain:round(at(from)-at(to)),minimum:rules.curve.minimumRampEaseDrop});
 for(const [from,to] of [[5,6],[8,9]])checks.push({kind:'recovery',from,to,gain:round(at(to)-at(from)),minimum:rules.curve.minimumRecoveryEaseGain});
 for(const [from,to] of [[5,10],[8,10]])checks.push({kind:'final-peak',from,to,gain:round(at(from)-at(to)),minimum:rules.curve.minimumFinalPeakEaseDrop});
 for(const check of checks)if(check.gain+1e-6<check.minimum)throw Error('Difficulty curve fails '+JSON.stringify(check));
 return checks;
}
function validateCatalog(catalog){
 if(catalog.schemaVersion!==1||catalog.rulesVersion!=='classic-v4'||catalog.levelDataVersion!==rules.levelDataVersion||catalog.levels.length!==HEX_LEVELS.length)throw Error('Catalog header mismatch');
 const levelIds=new Set();
 for(const entry of catalog.levels){
  const base=HEX_LEVELS.find(l=>l.id===entry.levelId),target=rules.targets.find(t=>t.levelId===entry.levelId);
  if(!base||levelIds.has(entry.levelId)||entry.variants.length<VARIANT_COUNT)throw Error('Missing/repeated level or variants');levelIds.add(entry.levelId);
  for(const field of ['category','label','role','easeBand','minimumPlanningWinRate'])if(JSON.stringify(entry.difficulty[field])!==JSON.stringify(target[field]))throw Error('Difficulty contract mismatch: '+field);
  const initials=new Set(),ids=new Set(),seeds=new Set();
  for(const variant of entry.variants){
   if(typeof variant.id!=='string'||!variant.id||ids.has(variant.id)||!Number.isInteger(variant.seed)||variant.seed<=0||variant.seed>0xffffffff||seeds.has(variant.seed)||!Array.isArray(variant.initial)||variant.initial.length!==base.cells.length||variant.initial.some(v=>!base.palette.includes(v))||initials.has(variant.initial.join(',')))throw Error('Invalid/repeated variant identity, values or seed');
   for(const key of ['cells','moves','target','palette','rulesVersion'])if(key in variant)throw Error('Variant may not override '+key);
   ids.add(variant.id);seeds.add(variant.seed);initials.add(variant.initial.join(','));
   const level=asLevel(base,variant),game=new HexMatch(level);if(game.findMatches().length||game.legalMoves().length<2)throw Error('Unstable or single-opening variant');
   if(!Array.isArray(variant.solutions)||variant.solutions.length<2)throw Error('Missing certified routes');
   for(const route of variant.solutions)if(certify(level,[route]).length!==1)throw Error('Published route is not a winning witness');
   const routes=certify(level,variant.solutions);if(routes.length<2)throw Error('Uncertified independent starts');
   const metrics=variant.difficultyMetrics;
   if(!metrics||!Number.isFinite(metrics.easeScore)||metrics.easeScore<target.easeBand[0]||metrics.easeScore>target.easeBand[1])throw Error('Outside difficulty band');
   for(const policy of POLICIES)if(!Number.isFinite(metrics.policyWinRates[policy])||metrics.policyWinRates[policy]<0||metrics.policyWinRates[policy]>100)throw Error('Invalid policy rate');
   if(metrics.policyWinRates.planning<target.minimumPlanningWinRate)throw Error('Planning acceptance floor failed');
   if(variant.par!==routes[0].length||metrics.shortestCertifiedMoves!==variant.par||metrics.spareMovesOnShortestRoute!==base.moves-variant.par)throw Error('Incorrect certified route metadata');
  }
  const span=values=>Math.max(...values)-Math.min(...values);
  if(span(entry.variants.map(v=>v.difficultyMetrics.easeScore))>rules.maxEaseSpread+1e-6)throw Error('Variant ease spread exceeds limit');
  for(const policy of ['greedy','coverage','planning'])if(span(entry.variants.map(v=>v.difficultyMetrics.policyWinRates[policy]))>rules.maxPolicyWinRateSpread+1e-6)throw Error('Variant policy spread exceeds limit');
  if(span(entry.variants.map(v=>v.par))>rules.maxCertifiedMoveSpread)throw Error('Variant certified length spread exceeds limit');
 }
 validateCurve(catalog.levels.map(entry=>({levelId:entry.levelId,averageEaseScore:round(entry.variants.reduce((n,v)=>n+v.difficultyMetrics.easeScore,0)/entry.variants.length)})));
 return true;
}
function preservePublishedIdentity(destination,catalog){
 if(!fs.existsSync(destination))return;
 const previous=JSON.parse(fs.readFileSync(destination,'utf8')),equal=require('node:util').isDeepStrictEqual;
 if(previous.levelDataVersion!==catalog.levelDataVersion){
  const archive=path.join(__dirname,'dist/variant-archives',previous.levelDataVersion+'.json');
  if(!fs.existsSync(archive)||!equal(JSON.parse(fs.readFileSync(archive,'utf8')),previous))throw Error('Archive the previous catalog and register it for save resolution before changing its data version');
  return;
 }
 for(const oldLevel of previous.levels){
  const nextLevel=catalog.levels.find(level=>level.levelId===oldLevel.levelId);if(!nextLevel||!equal(oldLevel.difficulty,nextLevel.difficulty))throw Error('Published level difficulty is immutable within its data version');
  for(const oldVariant of oldLevel.variants){const nextVariant=nextLevel.variants.find(v=>v.id===oldVariant.id);if(!nextVariant||!equal(oldVariant,nextVariant))throw Error('Published variants are immutable; change the data version and preserve its archive');}
 }
}

async function generate(){
 const concurrency=Math.max(1,Math.min(4,Number(process.env.HEXROTA_VARIANT_WORKERS)||4)),results=Array(HEX_LEVELS.length);let next=0;
 await Promise.all(Array.from({length:concurrency},async()=>{while(next<HEX_LEVELS.length){const index=next++;results[index]=await new Promise((resolve,reject)=>{const worker=new Worker(__filename,{workerData:{index},argv:process.argv.slice(2)});worker.on('message',m=>{if(m.progress)console.log(JSON.stringify(m.progress));if(m.result)resolve(m.result);});worker.on('error',reject);worker.on('exit',code=>{if(code!==0)reject(Error('Variant worker exited '+code));});});}}));
 const catalog={schemaVersion:1,rulesVersion:'classic-v4',levelDataVersion:rules.levelDataVersion,levels:results.map((result,index)=>({levelId:result.levelId,difficulty:{...rules.targets[index],maxEaseSpread:rules.maxEaseSpread,maxPolicyWinRateSpread:rules.maxPolicyWinRateSpread},variants:result.accepted.map((v,j)=>({id:'v'+(j+1),initial:v.initial,seed:v.seed,solutions:v.solutions,par:v.solutions[0].length,difficultyMetrics:metricsFor(v.analysis,v.solutions,HEX_LEVELS[index])}))}))};
 validateCatalog(catalog);
 const destination=path.join(__dirname,'dist/variants.json'),json=JSON.stringify(catalog,null,2)+'\n';preservePublishedIdentity(destination,catalog);fs.writeFileSync(destination+'.next',json);fs.renameSync(destination+'.next',destination);
 fs.writeFileSync(path.join(__dirname,'dist/variants-data.js'),'/* Generated from variants.json. Offline-certified starts; no runtime generation. */\nwindow.HEX_VARIANTS = '+JSON.stringify(catalog)+';\n');
 const baseline=HEX_LEVELS.map(base=>{const analysis=analyse(base,options(rules.trialsPerPolicy));return {levelId:base.id,cells:base.cells.length,layers:base.cells.reduce((n,c)=>n+c.layers,0),moves:base.moves,target:base.target,par:base.par,...analysis,winningRoutes:undefined};});
 const report={schemaVersion:2,rulesVersion:'classic-v4',levelDataVersion:rules.levelDataVersion,method:{informationScope:'All goal-aware bots clone complete deterministic engine state, including RNG and replacement outcomes. Greedy/Coverage see full immediate cascades; Planning sees bounded future turns. Humans cannot see these future draws. Bot scores are full-information heuristic results, not visible-board human reasoning.',trialsPerPolicy:rules.trialsPerPolicy,seed:rules.simulationSeed,policies:{random:'Uniform legal move; seeded tie/choice stream.',greedy:'Immediate normalized score deficit, layer progress and newly completed ground; no lookahead.',coverage:'Immediate remaining-layer gain, newly completed ground, then capped score progress.',planning:'Configured bounded beam search without certified-route access. Clones expose exact deterministic future refills to this bot; humans cannot see these outcomes.'},planning:rules.planning,easeWeights:rules.easeWeights,calibrationStatus:'simulation-only; real-player calibration pending',strategicHelpProxy:'Planning advantage over the strongest one-step model; this does not measure actual hint demand.',initialConstruction:'Levels 1–8 and10 use stable samples or local mutations of original starts. Recovery level9 uses stable initial layouts with3 or4 distinct values from the unchanged5-value palette. Every subsequent refill uses the full original palette.',warning:'Bot results describe these policies and starts, not human win rates. Ties may yield identical trajectories; uniqueTrajectories is reported. No payment or player-spend inputs exist.'},acceptance:{maxEaseSpread:rules.maxEaseSpread,maxPolicyWinRateSpread:rules.maxPolicyWinRateSpread,maxCertifiedMoveSpread:rules.maxCertifiedMoveSpread,maxAverageMovesUsedSpread:rules.maxAverageMovesUsedSpread,maxAverageGroundCompletionSpread:rules.maxAverageGroundCompletionSpread},baseline,levels:results.map((result,index)=>{const variants=result.accepted.map((v,j)=>({id:'v'+(j+1),candidateAttempt:v.candidateAttempt,initialDistinctValues:new Set(v.initial).size,initialValues:[...new Set(v.initial)].sort((a,b)=>a-b),shortestCertifiedMoves:v.solutions[0].length,spareMoves:HEX_LEVELS[index].moves-v.solutions[0].length,easeScore:v.analysis.easeScore,difficultyIndex:v.analysis.difficultyIndex,planningAdvantage:v.analysis.planningAdvantage,policies:v.analysis.policies}));return {levelId:result.levelId,...rules.targets[index],cells:HEX_LEVELS[index].cells.length,moves:HEX_LEVELS[index].moves,target:HEX_LEVELS[index].target,variantCount:variants.length,averageEaseScore:round(variants.reduce((n,v)=>n+v.easeScore,0)/variants.length),easeSpread:round(Math.max(...variants.map(v=>v.easeScore))-Math.min(...variants.map(v=>v.easeScore))),averagePolicyWinRates:Object.fromEntries(POLICIES.map(p=>[p,round(variants.reduce((n,v)=>n+v.policies[p].winRate,0)/variants.length)])),variants};})};
 report.curveChecks=validateCurve(report.levels);
 fs.writeFileSync(path.join(__dirname,'balance-report.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(__dirname,'reports/variant-generation.json'),JSON.stringify({schemaVersion:1,sourceHash:hash,levels:results.map(({accepted,hash,...rest})=>({...rest,selectedCandidates:accepted.map(v=>v.candidateAttempt)}))},null,2)+'\n');
 console.log(`Certified all${HEX_LEVELS.length*VARIANT_COUNT} variants; catalog and bot report written after every level passed.`);
}
if(!isMainThread){try{parentPort.postMessage({result:searchLevel(workerData.index)});}catch(error){throw error;}}
else if(require.main===module){
 if(process.argv.includes('--check')){const text=fs.readFileSync(path.join(__dirname,'dist/variants.json'),'utf8'),catalog=JSON.parse(text);validateCatalog(catalog);const wrapper='/* Generated from variants.json. Offline-certified starts; no runtime generation. */\nwindow.HEX_VARIANTS = '+JSON.stringify(catalog)+';\n';if(fs.readFileSync(path.join(__dirname,'dist/variants-data.js'),'utf8')!==wrapper)throw Error('Variant wrapper is stale');console.log('Catalog certificates, distinct starts, configured bands and generated wrapper pass.');}
 else generate().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={validateCatalog,validateCurve,preservePublishedIdentity,acceptance,options};
