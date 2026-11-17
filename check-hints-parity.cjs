/* Actual C#7.3 HintSolver parity, independently verified guarantees, no JS fallback. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=__dirname,plain=value=>JSON.parse(JSON.stringify(value));let clockReads=0,clockStep=0;
const context={window:{},performance:{now(){return clockReads++*clockStep;}}};vm.createContext(context);
for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js','commands.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
const W=context.window,Engine=W.HexMatch,catalog=W.HexAttempts.createCatalog(W.HEX_LEVELS,W.HEX_VARIANTS,Engine),requests=[],expected=[];
const counts={publishedRouteStates:0,certifiedRoutes:0,originalLevels:0,originalRoutes:0,originalRouteStates:0,searchStates:0,clockPolicyCases:0,continuedGames:0,rejectedSnapshots:0,rejectedUntrustedRoutes:0,returnedOutputMutation:0,inputRouteMutation:0,auditBudgetTransitionCases:0,rawRouteFallbacks:0,mixedRouteCandidates:0,routeWorkCapCases:0,depthLimitedUncertainty:0,assistedStates:0,terminalStates:0,guaranteesReplayed:0};
const sources={proven_route:0,search_win:0,heuristic:0,null:0};
function normalizeLevel(level,routes){const copy=plain(level);for(const key of ['solutions','solution','alternativeSolutions'])delete copy[key];if(routes)Object.assign(copy,plain(routes));return copy;}
function authored(level){return plain({solutions:level.solutions||[],solution:level.solution||null,alternativeSolutions:level.alternativeSolutions||[]});}
function certify(level,data){
 const paths=[...(data.solutions||[]),data.solution,...(data.alternativeSolutions||[])].filter(route=>route&&route.length);
 for(const route of paths){assert(route.length<=level.moves);assert(route.every(pair=>Array.isArray(pair)&&pair.length===2));const model=new Engine(level);for(const pair of route)assert(model.swap(...pair).ok);assert.equal(model.status,'won');}
}
function add(name,request){
 const routes=request.routes||null,level=normalizeLevel(request.level,Object.hasOwn(request,'rawRoutes')?request.rawRoutes:routes);if(routes)certify(level,routes);
 const game=request.assisted?new W.HexAssistedGame(level,plain(request.assisted),request.snapshot?plain(request.snapshot):null):request.snapshot?new Engine(level,plain(request.snapshot)):new Engine(level),before=plain(game.snapshot()),levelBefore=plain(level);clockReads=0;clockStep=request.clockStep||0;
 const rawHint=game.hint(request.options);let hint=plain(rawHint);assert.deepEqual(plain(game.snapshot()),before,name+' JS hints never mutate original state');assert.deepEqual(plain(level),levelBefore,name+' JS hints never mutate source configuration or route arrays');
 if(request.expectedSource!==undefined)assert.equal(hint?.source||null,request.expectedSource,name+' explicit source contract');
 if(request.expectedTruncated!==undefined)assert.equal(hint?.truncated,request.expectedTruncated,name+' uncertainty is separate from early budget exhaustion');
 if(request.repeatAndMutate&&hint){const unchanged=plain(hint);rawHint.pair[0]=-1;if(rawHint.continuation)rawHint.continuation[0][0]=-1;clockReads=0;hint=plain(game.hint(request.options));assert.deepEqual(hint,unchanged,name+' editing returned JS hint never mutates source route');assert.deepEqual(plain(level),levelBefore);assert.deepEqual(plain(game.snapshot()),before);counts.returnedOutputMutation++;}
 if(hint){sources[hint.source]++;assert.equal(hint.guaranteed,hint.source!=='heuristic');if(hint.guaranteed){assert(Array.isArray(hint.continuation)&&hint.continuation.length);const continuation=game.clone();assert(hint.continuation.length<=game.movesLeft);for(const pair of hint.continuation)assert(continuation.swap(...pair).ok);assert.equal(continuation.status,'won',name+' independent continuation replay');counts.guaranteesReplayed++;}else assert.equal(hint.continuation,null);}
 else sources.null++;
 const output={hint,unchanged:true,snapshot:before};
 if(request.playSuggested){if(!hint)output.played=null;else{const move=game.swap(...hint.pair);output.played={ok:move.ok,reason:move.reason,snapshot:plain(game.snapshot()),status:game.status};}counts.continuedGames++;}
 requests.push(request);expected.push({name,result:output});return hint;
}
function reject(name,request,kind){requests.push(request);expected.push({name,error:true});counts[kind]++;}
for(const group of W.HEX_VARIANTS.levels)for(const variant of group.variants){
 const level=plain(catalog.resolveLevel(group.levelId,variant.id,W.HEX_VARIANTS.levelDataVersion)),routes=authored(level);
 for(const [routeIndex,route]of variant.solutions.entries()){
  const game=new Engine(level);counts.certifiedRoutes++;
  for(let turn=0;turn<=route.length;turn++){
   add(`published-${group.levelId}-${variant.id}-${routeIndex}-${turn}`,{level,snapshot:plain(game.snapshot()),routes,options:{maxNodes:1,maxDepth:3,beamWidth:10},assertNoClockRead:true,clockStep:1e6,playSuggested:turn===1,repeatAndMutate:turn===0,mutateRouteInput:turn===0});counts.publishedRouteStates++;
   if(turn===0)counts.inputRouteMutation++;if(turn<route.length)assert(game.swap(...route[turn]).ok);
  }
 }
 // The solver is deliberately denied answer routes in these search comparisons.
 const game=new Engine(level);for(let turn=0;turn<Math.min(3,variant.solutions[0].length-1);turn++)game.swap(...variant.solutions[0][turn]);
 for(const options of [{maxNodes:1,maxDepth:3,beamWidth:10},{maxNodes:2,maxDepth:3,beamWidth:10},{maxNodes:17,maxDepth:1.5,beamWidth:2.7},{maxNodes:64,maxDepth:3,beamWidth:32},{maxNodes:64,maxDepth:1,beamWidth:1}]){
  add(`search-${group.levelId}-${variant.id}-${JSON.stringify(options)}`,{level,snapshot:plain(game.snapshot()),options,assertNoClockRead:true,clockStep:1e6,playSuggested:options.maxNodes===2});counts.searchStates++;
 }
 // Off-route history exercises fallback even though certified routes are available.
 const off=new Engine(level),certified=new Set(variant.solutions.map(r=>r[0].slice().sort((a,b)=>a-b).join(','))),other=off.legalMoves().find(pair=>!certified.has(pair.slice().sort((a,b)=>a-b).join(',')));
 if(other){off.swap(...other);add(`off-route-${group.levelId}-${variant.id}`,{level,snapshot:plain(off.snapshot()),routes,options:{maxNodes:64,maxDepth:2,beamWidth:8},assertNoClockRead:true,playSuggested:true});counts.searchStates++;}
 // Last in-flight certified board must be solved with search_win, not a route label.
 const late=new Engine(level);for(const pair of variant.solutions[0].slice(0,-1))late.swap(...pair);
 add(`bounded-win-${group.levelId}-${variant.id}`,{level,snapshot:plain(late.snapshot()),options:{maxNodes:1000,maxDepth:3,beamWidth:32},assertNoClockRead:true,playSuggested:true});counts.searchStates++;
 // H-02: a completed depth/beam-limited search remains explicitly uncertain.
 add(`depth-limited-${group.levelId}-${variant.id}`,{level,options:{maxNodes:100000,maxDepth:1,beamWidth:1},assertNoClockRead:true,expectedSource:'heuristic',expectedTruncated:false,repeatAndMutate:true});counts.depthLimitedUncertainty++;
}
// Keep the ten original authored levels as a separate baseline from variants.
for(const original of W.HEX_LEVELS){
 const level=plain(original),routes=authored(level);counts.originalLevels++;
 for(const [routeIndex,route]of [level.solution,...(level.alternativeSolutions||[])].entries()){
  const game=new Engine(level);counts.originalRoutes++;
  for(let turn=0;turn<=route.length;turn++){
   add(`original-${level.id}-${routeIndex}-${turn}`,{level,routes,snapshot:plain(game.snapshot()),options:{maxNodes:1,maxDepth:3},assertNoClockRead:true,repeatAndMutate:turn===0,mutateRouteInput:turn===0,playSuggested:turn===1,expectedSource:turn===route.length?null:'proven_route'});counts.originalRouteStates++;
   if(turn===0)counts.inputRouteMutation++;if(turn<route.length)assert(game.swap(...route[turn]).ok);
  }
 }
}
for(const level of W.HEX_TUTORIALS){const game=new Engine(level),routes=authored(level);for(let turn=0;turn<=level.solution.length;turn++){add(`tutorial-${level.id}-${turn}`,{level:plain(level),snapshot:plain(game.snapshot()),routes,options:{maxNodes:32},assertNoClockRead:true});if(turn<level.solution.length)game.swap(...level.solution[turn]);}}
const single={id:'no-move',cells:[{q:0,r:0,layers:1}],initial:[1],palette:[1],seed:1,moves:1,target:1};
add('playing-with-no-legal-swap',{level:single,options:{maxNodes:1},assertNoClockRead:true});
const sample=plain(catalog.resolveLevel(1,W.HEX_VARIANTS.levels[0].variants[0].id,W.HEX_VARIANTS.levelDataVersion)),sampleGame=new Engine(sample),snapshot=plain(sampleGame.snapshot());
for(const options of [{maxMs:1,maxDepth:3},{maxMs:20,maxDepth:3},{maxMs:150,maxDepth:3},{maxNodes:0,maxMs:1},{maxNodes:2.5,maxMs:1},{maxNodes:'2',maxMs:1},{maxNodes:-1,maxDepth:'2',beamWidth:'3',maxMs:1},{maxNodes:null,maxDepth:[2],beamWidth:[],maxMs:0},null,false,[]]){
 add('injected-clock-'+JSON.stringify(options),{level:sample,snapshot,options,clockStep:10});counts.clockPolicyCases++;
}
// Audit9.9: one actual remaining move, one winning choice among seven legal
// swaps. A tiny bound must remain uncertain; more work can prove the real win.
const auditLastMove=require('./check-solvability-hints.cjs').budgetCase();
for(const options of [{maxNodes:1,maxDepth:1,beamWidth:1},{maxNodes:8,maxDepth:1,beamWidth:1}]){
 add('audit99-last-move-budget-'+options.maxNodes,{level:auditLastMove.level,snapshot:auditLastMove.snapshot,options,assertNoClockRead:true,clockStep:1e6,playSuggested:true});counts.auditBudgetTransitionCases++;
}
add('audit99-depth-limited-uncertainty',{level:auditLastMove.level,snapshot:plain(new Engine(auditLastMove.level).snapshot()),options:{maxNodes:1000,maxDepth:1,beamWidth:1},assertNoClockRead:true,clockStep:1e6});counts.auditBudgetTransitionCases++;
for(const field of Object.keys(snapshot)){const bad=plain(snapshot);delete bad[field];assert.throws(()=>new Engine(sample,bad));reject('missing-snapshot-'+field,{level:sample,snapshot:bad,options:{maxNodes:1}},'rejectedSnapshots');}
for(const [field,value]of [['score',1],['rngState',1],['values',snapshot.values.map(()=>1)],['history',[[0,0]]]]){const bad={...plain(snapshot),[field]:value};assert.throws(()=>new Engine(sample,bad));reject('forged-snapshot-'+field,{level:sample,snapshot:bad,options:{maxNodes:1}},'rejectedSnapshots');}
// Raw JS imported routes are untrusted and now fall back safely. Native C# keeps
// its stricter native binding: JSON shape parsing and Create validation reject
// malformed/nonwinning inputs before Find is called. The
// fallback comparisons below therefore call the real compiled Find with null
// routes, or with only a separately replay-certified later valid candidate.
// These are distinct contracts, not a claim that native binding accepts them.
for(const route of [[[-1,0]],[[0,0]],[sample.solution[0]],sample.solution.slice(0,-1),[[3]],Array.from({length:sample.moves+1},()=>sample.solution[0])]){
 assert.throws(()=>certify(sample,{solution:route}));reject('untrusted-route-'+JSON.stringify(route),{level:sample,routes:{solution:route},certifyOnly:true},'rejectedUntrustedRoutes');
}
const first=sample.solution[0],rawInvalid=[
 ['h01-forged-L1-v1',{solutions:sample.solutions.map(route=>[route[0]])}],
 ['nonwinning-prefix',{solution:sample.solution.slice(0,-1)}],
 ['self-swap',{solution:[[first[0],first[0]]]}],
 ['negative-index',{solution:[[-1,first[1]]]}],
 ['out-of-range-index',{solution:[[first[0],sample.cells.length]]}],
 ['fractional-index',{solution:[[first[0]+.25,first[1]]]}],
 ['string-index',{solution:[[String(first[0]),first[1]]]}],
 ['extra-pair-index',{solution:[[...first,first[0]]]}],
 ['null-pair',{solution:[first,null]}],
 ['short-pair',{solution:[first,[first[0]]]}],
 ['over-budget',{solution:Array.from({length:sample.moves+1},()=>first)}],
 ['object-solution',{solution:{0:first,length:1}}],
 ['bad-containers',{solutions:'untrusted',solution:false,alternativeSolutions:{0:sample.solution,length:1}}]
];
for(const [name,rawRoutes]of rawInvalid){
 add('raw-import-fallback-'+name,{level:sample,rawRoutes,options:{maxNodes:1,maxDepth:1,beamWidth:1},assertNoClockRead:true,expectedSource:'heuristic',expectedTruncated:true,repeatAndMutate:true,playSuggested:true});counts.rawRouteFallbacks++;
 reject('strict-binding-reject-'+name,{level:sample,routes:rawRoutes,certifyOnly:true},'rejectedUntrustedRoutes');
}
for(const [name,rawRoutes,routes]of [
 ['later-solution',{solutions:[[first],sample.solution]},{solutions:[sample.solution]}],
 ['later-alternative',{solution:[first],alternativeSolutions:[sample.solution]},{alternativeSolutions:[sample.solution]}],
 ['malformed-first-candidate',{solutions:[[first,null],sample.solution]},{solutions:[sample.solution]}]
]){
 add('raw-import-valid-'+name,{level:sample,rawRoutes,routes,options:{maxNodes:1,maxDepth:1},assertNoClockRead:true,expectedSource:'proven_route',expectedTruncated:false,repeatAndMutate:true,playSuggested:true});counts.mixedRouteCandidates++;
 reject('strict-binding-mixed-reject-'+name,{level:sample,routes:rawRoutes,certifyOnly:true},'rejectedUntrustedRoutes');
}
const currentPrefix=new Engine(sample);assert(currentPrefix.swap(...first).ok);
add('raw-import-forged-matching-history',{level:sample,snapshot:plain(currentPrefix.snapshot()),rawRoutes:{solution:sample.solution.slice(0,2)},options:{maxNodes:1,maxDepth:1},assertNoClockRead:true,expectedSource:'heuristic',repeatAndMutate:true,playSuggested:true});counts.rawRouteFallbacks++;
// These work-limit cases pass the SAME valid route collection through strict
// native Create and JS. They exercise actual bounded Find, not null-route binding.
for(const [levelId,duplicates,expectedSource,label]of [[1,63,'proven_route','slot64'],[1,64,'heuristic','slot65'],[10,41,'proven_route','pairs505'],[10,42,'heuristic','pairs517']]){
 const level=plain(W.HEX_LEVELS.find(level=>level.id===levelId)),main=level.solution,alternate=level.alternativeSolutions[0],game=new Engine(level);
 assert.notDeepEqual(main[0].slice().sort((a,b)=>a-b),alternate[0].slice().sort((a,b)=>a-b));assert(game.swap(...alternate[0]).ok);
 const routes={solutions:[...Array.from({length:duplicates},()=>main),alternate]};
 add('native-route-work-cap-'+label,{level,routes,snapshot:plain(game.snapshot()),options:{maxNodes:1,maxDepth:1},assertNoClockRead:true,expectedSource,repeatAndMutate:true,playSuggested:true});counts.routeWorkCapCases++;
}
// Ignored entries inside route containers still consume a candidate slot.
// The optional standalone null/empty solution consumes no slot in either core.
for(const field of ['solutions','alternativeSolutions'])for(const empty of [null,[]])for(const slots of [63,64]){
 const level=plain(W.HEX_LEVELS[0]),routes={solution:slots===63?null:[],[field]:[...Array.from({length:slots},()=>empty),level.solution]};
 add(`native-ignored-route-slots-${field}-${empty===null?'null':'empty'}-${slots}`,{level,routes,options:{maxNodes:1,maxDepth:1},assertNoClockRead:true,expectedSource:slots===63?'proven_route':'heuristic',repeatAndMutate:true});counts.routeWorkCapCases++;
}
// A long route is still a real, legal winning certificate. Build it using the
// unchanged engine: clear the original board, then set target to actual score at
// the requested final turn. No synthetic snapshot or forged RNG is introduced.
const longBase=normalizeLevel(W.HEX_LEVELS[0]);longBase.id='hint-route-work-cap';longBase.moves=513;longBase.target=1e9;
const longGame=new Engine(longBase),longRoute=[],longScores=[];
for(let turn=0;turn<513;turn++){
 const pair=turn<W.HEX_LEVELS[0].solution.length?plain(W.HEX_LEVELS[0].solution[turn]):plain(longGame.legalMoves()[0]);
 assert(pair);assert(longGame.swap(...pair).ok);longRoute.push(pair);longScores.push(longGame.score);
}
assert.equal(longGame.covered,longGame.total);
for(const length of [512,513]){
 const level={...plain(longBase),target:longScores[length-1]},routes={solution:longRoute.slice(0,length)};
 add('native-route-single-length-'+length,{level,routes,options:{maxNodes:1,maxDepth:1},assertNoClockRead:true,expectedSource:length===512?'proven_route':'heuristic',repeatAndMutate:true});counts.routeWorkCapCases++;
}
// A real terminal snapshot restores exactly and never recommends another move.
const terminalBase=new Engine(auditLastMove.level,auditLastMove.snapshot);
for(const [status,pair]of ['won','lost'].map(status=>[status,terminalBase.legalMoves().find(pair=>{const copy=terminalBase.clone();copy.swap(...pair);return copy.status===status;})])){
 assert(pair);const terminal=terminalBase.clone();assert(terminal.swap(...pair).ok);
 add('restored-terminal-'+status,{level:auditLastMove.level,snapshot:plain(terminal.snapshot()),options:{maxNodes:32},assertNoClockRead:true,expectedSource:null,playSuggested:true});counts.terminalStates++;
}
// Compile and execute the actual AssistedGame restore + HintSolver composition.
// Every snapshot includes commands, usage and RNG; continued play compares them.
for(const group of W.HEX_VARIANTS.levels.slice(0,2))for(const variant of group.variants){
 const level=plain(catalog.resolveLevel(group.levelId,variant.id,W.HEX_VARIANTS.levelDataVersion)),assisted={attemptId:`hint-parity-${group.levelId}-${variant.id}`},game=new W.HexAssistedGame(level,assisted);
 assert(game.apply({id:'parity-brush',type:'green_brush',index:game.layers.findIndex(layer=>layer>0)}).ok);
 for(const options of [{maxNodes:1,maxDepth:1,beamWidth:1},{maxNodes:32,maxDepth:2,beamWidth:8}]){
  const hint=add(`assisted-restored-${group.levelId}-${variant.id}-${options.maxNodes}`,{level,routes:authored(level),assisted,snapshot:plain(game.snapshot()),options,assertNoClockRead:true,repeatAndMutate:true,playSuggested:true});assert.notEqual(hint?.source,'proven_route');counts.assistedStates++;
 }
}
const rescuedConfig={attemptId:'hint-parity-rescued'},rescued=new W.HexAssistedGame(auditLastMove.level,rescuedConfig,auditLastMove.snapshot),losing=rescued.model.legalMoves().find(pair=>{const copy=rescued.clone();copy.swap(...pair);return copy.status==='lost'&&copy.model.legalMoves().length;});
assert(losing);assert(rescued.swap(...losing).ok);assert(rescued.apply({id:'parity-rescue',type:'grant_moves',moves:5}).ok);assert.equal(rescued.bonusMoves,5);assert.equal(rescued.usage.rescue,1);
const colorConfig={attemptId:'hint-parity-color'},colored=new W.HexAssistedGame(sample,colorConfig),colorIndex=0,colorValue=sample.palette.find(value=>value!==colored.values[colorIndex]);
assert(colored.apply({id:'parity-color',type:'color_key',index:colorIndex,value:colorValue}).ok);
for(const [name,game,assisted]of [['rescue',rescued,rescuedConfig],['color',colored,colorConfig]])for(const options of [{maxNodes:1,maxDepth:1},{maxNodes:64,maxDepth:3}]){
 const hint=add('assisted-restored-'+name+'-'+options.maxNodes,{level:plain(game.level),routes:authored(game.level),assisted,snapshot:plain(game.snapshot()),options,assertNoClockRead:true,repeatAndMutate:true,playSuggested:true});assert.notEqual(hint?.source,'proven_route');counts.assistedStates++;
}
assert.equal(counts.certifiedRoutes,80);assert.equal(counts.originalLevels,10);assert.equal(counts.originalRoutes,20);assert.equal(counts.depthLimitedUncertainty,40);assert.equal(counts.assistedStates,20);assert.equal(counts.routeWorkCapCases,14);for(const source of ['proven_route','search_win','heuristic'])assert(sources[source]>0,'real comparison covers '+source);
function sdk(){for(const executable of [...new Set([process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean))]){const result=spawnSync(executable,['--version'],{cwd:root,encoding:'utf8',timeout:15000});if(result.status===0&&/^8\./.test(result.stdout.trim()))return {executable,version:result.stdout.trim()};}throw Error('Hint parity requires a real .NET8 SDK; no JavaScript fallback is available.');}
function run(executable,args,options={}){const result=spawnSync(executable,args,{cwd:root,encoding:'utf8',maxBuffer:128*1024*1024,timeout:180000,...options});if(result.error)throw result.error;if(result.status!==0)throw Error('Hint parity command failed:\n'+result.stdout+'\n'+result.stderr);return result.stdout;}
let temp;
try{
 const dotnet=sdk();temp=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-hint-parity-'));const bin=path.join(temp,'bin'),env={...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_NOLOGO:'1'};
 run(dotnet.executable,['build',path.join(root,'unity/HintParityHarness/Hexrota.HintParity.csproj'),'--configuration','Release','--nologo','--verbosity','quiet','--output',bin,'-p:BaseIntermediateOutputPath='+path.join(temp,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(root,'unity/HintParityHarness/NuGet.Config')],{env});
 const output=run(dotnet.executable,[path.join(bin,'Hexrota.HintParity.dll')],{env,input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n'}).trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));assert.equal(output.length,expected.length);
 for(let i=0;i<expected.length;i++){const row=expected[i],actual=output[i];if(row.error){assert.equal(actual.error,true,row.name+' native C# binding rejects');assert(['ArgumentException','JsonException'].includes(actual.type),row.name+' fails by validation, not an unexpected runtime exception: '+JSON.stringify(actual));}else{assert(!actual.error,row.name+': '+JSON.stringify(actual));assert.deepEqual(actual,row.result,row.name+' full C# hint/classification/budget/continuation/snapshot parity');}}
 console.log('C# hint parity passed: '+JSON.stringify({...counts,comparisons:expected.length,sources,dotnetSdk:dotnet.version,languageVersion:'7.3'}));
 console.log('Every guarantee was independently replayed to a win; source routes, gameplay, assisted commands and RNG are unchanged. Raw JS bad imports safely fall back; the separate strict native binding (JSON shape parsing plus Create validation) rejects them, then compiled Find with null routes produces the same fallback. Valid over-cap bindings exercise compiled Find directly. Depth/beam uncertainty is separate from node/time exhaustion.');
}catch(error){console.error(error.stack||error);process.exitCode=1;}finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
