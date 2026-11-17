/* Offline measurement only. VM-loads the actual selected sources; timings are
 * observations, never CI thresholds or physical-device/FPS measurements. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const argv=process.argv.slice(2),value=(key,fallback)=>{const item=argv.find(arg=>arg.startsWith(key+'='));return item?item.slice(key.length+1):fallback;};
const root=path.resolve(value('--source-root',path.join(__dirname,'..'))),input=value('--input'),output=value('--output');
const mode=value('--mode','all'),hintRepeats=Number(value('--hint-repeats','5')),passes=Number(value('--passes','3'));
for(const [name,n]of [['hint-repeats',hintRepeats],['passes',passes]])assert(Number.isSafeInteger(n)&&n>0,name+' must be a positive safe integer');
assert(['all','hint','solve','analysis'].includes(mode),'unknown measurement mode');
const plain=value=>JSON.parse(JSON.stringify(value)),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const pairKey=pair=>pair.slice().sort((a,b)=>a-b).join(':');
const settings=Object.freeze({hint:{maxNodes:128,maxDepth:3,beamWidth:6},solve:{width:20,maxNodes:6000},analysis:{trials:2,seed:7631381,planning:{maxNodes:128,maxDepth:3,beamWidth:6},captureRoutes:false},hintWarmups:1,hintRepeats,passes});
const sourceFiles=['dist/engine.js','dist/levels.js','dist/variants.json','lib/level-analysis.cjs'];
const sourceHashes=Object.fromEntries(sourceFiles.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
// Each selected source tree gets its own module cache and JS global. The old
// solve() is run unchanged in baseline mode, including its old budget bug.
const context=vm.createContext({window:{},performance}),cache=new Map();context.global=context;
function load(filename){
 filename=path.resolve(filename);if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);
 const requireFrom=name=>name.startsWith('node:')?require(name):load(path.resolve(path.dirname(filename),name));
 const wrapper=vm.runInContext('(function(exports,require,module,__filename,__dirname){\n'+fs.readFileSync(filename,'utf8')+'\n})',context,{filename});
 wrapper(module.exports,requireFrom,module,filename,path.dirname(filename));return module.exports;
}
const Analysis=load(path.join(root,'lib/level-analysis.cjs')),{HexMatch:Engine,HEX_LEVELS:levels}=Analysis;
function replay(level,route){const game=new Engine(level);for(const pair of route)assert(game.swap(...pair).ok,'fixture/reply must replay legally');return game;}
function onCertificate(history,level){return [level.solution,...(level.alternativeSolutions||[])].some(route=>history.length<=route.length&&history.every((pair,i)=>pairKey(pair)===pairKey(route[i])));}
function prepare(){
 const pack=JSON.parse(fs.readFileSync(path.join(root,'dist/variants.json'),'utf8')),cases=[];
 for(const entry of pack.levels)for(const variant of entry.variants){
  const level=plain(Analysis.asLevel(levels.find(level=>level.id===entry.levelId),variant));let chosen=null;
  for(const route of variant.solutions){const prefix=new Engine(level);
   for(let i=0;i<Math.min(3,route.length)&&!chosen;i++){
    const matching=variant.solutions.filter(route=>prefix.history.every((pair,index)=>route[index]&&pairKey(pair)===pairKey(route[index]))),authored=new Set(matching.map(route=>route[prefix.turn]&&pairKey(route[prefix.turn])).filter(Boolean));
    for(const pair of prefix.legalMoves())if(!authored.has(pairKey(pair))){const child=prefix.clone();child.swap(...pair);if(child.status==='playing'){chosen=child;break;}}
    if(prefix.status==='playing')prefix.swap(...route[i]);
   }
   if(chosen)break;
  }
  assert(chosen&&!onCertificate(chosen.history,level),'fixture must be genuinely off certificate');
  cases.push({levelId:entry.levelId,variantId:variant.id,level,snapshot:plain(chosen.snapshot()),snapshotSha256:hash(JSON.stringify(chosen.snapshot()))});
 }
 assert.equal(cases.length,40);
 return {schemaVersion:1,preparedFrom:sourceHashes,selection:'First legal non-certificate playing child encountered within first three turns of published routes, in original route/legal order. Prepared once and reused unchanged.',cases};
}
assert(input,'--input=/absolute/path.json is required');
if(argv.includes('--prepare-input')){assert(!fs.existsSync(input),'refuse to replace frozen input');fs.writeFileSync(input,JSON.stringify(prepare(),null,2)+'\n');console.log(JSON.stringify({preparedInput:path.resolve(input),sha256:hash(fs.readFileSync(input))}));process.exit(0);}
const inputText=fs.readFileSync(input),fixture=JSON.parse(inputText);assert.equal(fixture.cases.length,40);
assert.equal(sourceHashes['dist/levels.js'],fixture.preparedFrom['dist/levels.js'],'levels changed from frozen inputs');
assert.equal(sourceHashes['dist/variants.json'],fixture.preparedFrom['dist/variants.json'],'variants changed from frozen inputs');
const memory=()=>{const m=process.memoryUsage();return {rssBytes:m.rss,heapUsedBytes:m.heapUsed,heapTotalBytes:m.heapTotal};};
const memoryStart=memory(),betweenOperationMax={...memoryStart};
function sampleMemory(){const m=memory();for(const key of Object.keys(m))betweenOperationMax[key]=Math.max(betweenOperationMax[key],m[key]);}
let active=null;
for(const method of ['clone','swap']){const original=Engine.prototype[method];Engine.prototype[method]=function(...args){if(active)active[method+'Calls']++;return original.apply(this,args);};}
function measured(run){assert.equal(active,null);active={cloneCalls:0,swapCalls:0};const started=performance.now();let result,counts;try{result=run();}finally{const elapsedMs=performance.now()-started;counts={...active,elapsedMs};active=null;sampleMemory();}return {result,counts};}
function distribution(values){const sorted=values.slice().sort((a,b)=>a-b),at=q=>sorted[Math.max(0,Math.ceil(q*sorted.length)-1)];return {samples:values.length,minMs:sorted[0],medianMs:at(.5),p95Ms:at(.95),maxMs:sorted.at(-1),totalMs:values.reduce((n,v)=>n+v,0)};}
function validateHint(game,reply){
 assert(reply&&game.legalMoves().some(pair=>pairKey(pair)===pairKey(reply.pair)));
 if(reply.guaranteed){const proof=game.clone();for(const pair of reply.continuation)assert(proof.swap(...pair).ok);assert.equal(proof.status,'won');}
 else assert.equal(reply.continuation,null);
}
const started=performance.now(),results={};
if(mode==='all'||mode==='hint'){
 const rows=[];
 for(const kind of ['certified_start','off_certificate'])for(const item of fixture.cases){
  const game=kind==='certified_start'?new Engine(item.level):new Engine(item.level,item.snapshot),before=JSON.stringify(game.snapshot());
  for(let i=0;i<settings.hintWarmups;i++)game.hint(settings.hint);
  let first=null;const samples=[];
  for(let i=0;i<hintRepeats;i++){
   const {result,counts}=measured(()=>game.hint(settings.hint));validateHint(game,result);assert.equal(JSON.stringify(game.snapshot()),before,'hint mutated source');
   const comparable=JSON.stringify({result:plain(result),cloneCalls:counts.cloneCalls,swapCalls:counts.swapCalls});if(first===null)first=comparable;else assert.equal(comparable,first,'deterministic hint result/work changed between repetitions');
   samples.push(counts);
  }
  rows.push({kind,levelId:item.levelId,variantId:item.variantId,result:JSON.parse(first).result,cloneCallsPerCall:samples[0].cloneCalls,swapCallsPerCall:samples[0].swapCalls,timing:distribution(samples.map(s=>s.elapsedMs)),samples});
 }
 results.hint={rows,groups:Object.fromEntries(['certified_start','off_certificate'].map(kind=>{const items=rows.filter(row=>row.kind===kind);return [kind,{timing:distribution(items.flatMap(row=>row.samples.map(s=>s.elapsedMs))),cloneCallsPerPass:items.reduce((n,row)=>n+row.cloneCallsPerCall,0),swapCallsPerPass:items.reduce((n,row)=>n+row.swapCallsPerCall,0),searchedNodesPerPass:items.reduce((n,row)=>n+row.result.searchedNodes,0),guaranteedPerPass:items.filter(row=>row.result.guaranteed).length}];}))};
 console.error('Hint measurement complete: '+rows.length+' cases × '+hintRepeats+' timed repetitions.');
}
if(mode==='all'||mode==='solve'){
 const passResults=[];
 for(let pass=0;pass<passes;pass++){
  const rows=[],passStarted=performance.now();
  for(const item of fixture.cases){
   const prefix=item.snapshot.history,{result,counts}=measured(()=>typeof Analysis.solveWithReport==='function'?Analysis.solveWithReport(item.level,{...settings.solve,prefix}):{route:Analysis.solve(item.level,{...settings.solve,prefix})});
   if(result.route)assert.equal(replay(item.level,result.route).status,'won');
   const expansions=counts.swapCalls-prefix.length;assert.equal(expansions,counts.cloneCalls,'search expansions must be clone-backed; prefix replays excluded');
   if(result.searchedNodes!==undefined)assert.equal(result.searchedNodes,expansions);
   rows.push({levelId:item.levelId,variantId:item.variantId,prefixReplaySwaps:prefix.length,actualSearchExpansions:expansions,requestedBudgetExceeded:expansions>settings.solve.maxNodes,route:result.route?plain(result.route):null,report:plain(result),...counts});
  }
  const summary={elapsedMs:performance.now()-passStarted,actualSearchExpansions:rows.reduce((n,row)=>n+row.actualSearchExpansions,0),cloneCalls:rows.reduce((n,row)=>n+row.cloneCalls,0),swapCalls:rows.reduce((n,row)=>n+row.swapCalls,0),provenWins:rows.filter(row=>row.route).length,budgetExceeded:rows.filter(row=>row.requestedBudgetExceeded).length};
  passResults.push({pass,summary,rows});console.error('Solve pass '+(pass+1)+'/'+passes+' complete in '+Math.round(summary.elapsedMs)+' ms.');
 }
 results.solve={passes:passResults,timing:distribution(passResults.map(p=>p.summary.elapsedMs))};
}
if(mode==='all'||mode==='analysis'){
 const passResults=[];
 for(let pass=0;pass<passes;pass++){
  const rows=[],passStarted=performance.now();
  for(const item of fixture.cases){
   const {result,counts}=measured(()=>Analysis.analyse(item.level,settings.analysis));
   rows.push({levelId:item.levelId,variantId:item.variantId,analysis:plain(result),...counts});
  }
  const summary={elapsedMs:performance.now()-passStarted,cloneCalls:rows.reduce((n,row)=>n+row.cloneCalls,0),swapCalls:rows.reduce((n,row)=>n+row.swapCalls,0),episodes:40*Analysis.POLICIES.length*settings.analysis.trials};
  passResults.push({pass,summary,rows});console.error('Full40 policy analysis pass '+(pass+1)+'/'+passes+' complete in '+Math.round(summary.elapsedMs)+' ms.');
 }
 results.analysis={passes:passResults,timing:distribution(passResults.map(p=>p.summary.elapsedMs))};
}
const report={schemaVersion:1,sourceRoot:root,sourceHashes,input:{path:path.resolve(input),sha256:hash(inputText),cases:fixture.cases.length,selection:fixture.selection},environment:{node:process.version,platform:process.platform,arch:process.arch},method:{...settings,mode,timing:'Single Node process, isolated VM-loaded actual source, prototype counters active during measured call only. Hint restoration, warmup and independent proof replay excluded from hint timing. Solve/analysis include their actual full calls. Wall time includes instrumentation and is environment-specific; no timing assertion, physical-device latency, FPS, or thermal claim.',memory:'RSS/heap absolute samples taken between measured calls; transient in-call heap peaks may be missed. processMaxRssBytes is process-lifetime OS high-water mark, including VM/input initialization and proof checks.'},elapsedMs:performance.now()-started,memory:{start:memoryStart,end:memory(),betweenOperationSampledMax:betweenOperationMax,processMaxRssBytes:process.resourceUsage().maxRSS*1024},results};
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output:output?path.resolve(output):null,inputSha256:report.input.sha256,sourceHashes,elapsedMs:report.elapsedMs,memory:report.memory,hint:results.hint?.groups,solve:results.solve?.passes.map(p=>p.summary),analysis:results.analysis?.passes.map(p=>p.summary)}));
