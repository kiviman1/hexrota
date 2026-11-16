/* Actual C#7.3 HintSolver parity, independently verified guarantees, no JS fallback. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=__dirname,plain=value=>JSON.parse(JSON.stringify(value));let clockReads=0,clockStep=0;
const context={window:{},performance:{now(){return clockReads++*clockStep;}}};vm.createContext(context);
for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
const W=context.window,Engine=W.HexMatch,catalog=W.HexAttempts.createCatalog(W.HEX_LEVELS,W.HEX_VARIANTS,Engine),requests=[],expected=[];
const counts={publishedRouteStates:0,certifiedRoutes:0,searchStates:0,clockPolicyCases:0,continuedGames:0,rejectedSnapshots:0,rejectedUntrustedRoutes:0,returnedOutputMutation:0,inputRouteMutation:0,auditBudgetTransitionCases:0};
const sources={proven_route:0,search_win:0,heuristic:0,null:0};
function normalizeLevel(level,routes){const copy=plain(level);for(const key of ['solutions','solution','alternativeSolutions'])delete copy[key];if(routes)Object.assign(copy,plain(routes));return copy;}
function authored(level){return plain({solutions:level.solutions||[],solution:level.solution||null,alternativeSolutions:level.alternativeSolutions||[]});}
function certify(level,data){
 const paths=[...(data.solutions||[]),data.solution,...(data.alternativeSolutions||[])].filter(route=>route&&route.length);
 for(const route of paths){assert(route.length<=level.moves);assert(route.every(pair=>Array.isArray(pair)&&pair.length===2));const model=new Engine(level);for(const pair of route)assert(model.swap(...pair).ok);assert.equal(model.status,'won');}
}
function add(name,request){
 const routes=request.routes||null,level=normalizeLevel(request.level,routes);if(routes)certify(level,routes);
 const game=request.snapshot?new Engine(level,plain(request.snapshot)):new Engine(level),before=plain(game.snapshot());clockReads=0;clockStep=request.clockStep||0;
 const hint=plain(game.hint(request.options));assert.deepEqual(plain(game.snapshot()),before,name+' JS hints never mutate original state');
 if(hint){sources[hint.source]++;assert.equal(hint.guaranteed,hint.source!=='heuristic');if(hint.guaranteed){assert(Array.isArray(hint.continuation)&&hint.continuation.length);const continuation=new Engine(level,before);for(const pair of hint.continuation)assert(continuation.swap(...pair).ok);assert.equal(continuation.status,'won',name+' independent continuation replay');}else assert.equal(hint.continuation,null);}
 else sources.null++;
 const output={hint,unchanged:true,snapshot:before};
 if(request.playSuggested){if(!hint)output.played=null;else{const move=game.swap(...hint.pair);output.played={ok:move.ok,reason:move.reason,snapshot:plain(game.snapshot()),status:game.status};}counts.continuedGames++;}
 requests.push(request);expected.push({name,result:output});
}
function reject(name,request,kind){requests.push(request);expected.push({name,error:true});counts[kind]++;}
for(const group of W.HEX_VARIANTS.levels)for(const variant of group.variants){
 const level=plain(catalog.resolveLevel(group.levelId,variant.id,W.HEX_VARIANTS.levelDataVersion)),routes=authored(level);
 for(const [routeIndex,route]of variant.solutions.entries()){
  const game=new Engine(level);counts.certifiedRoutes++;
  for(let turn=0;turn<=route.length;turn++){
   add(`published-${group.levelId}-${variant.id}-${routeIndex}-${turn}`,{level,snapshot:plain(game.snapshot()),routes,options:{maxNodes:1,maxDepth:3,beamWidth:10},assertNoClockRead:true,clockStep:1e6,playSuggested:turn===1,repeatAndMutate:turn===0,mutateRouteInput:turn===0});counts.publishedRouteStates++;
   if(turn===0){counts.returnedOutputMutation++;counts.inputRouteMutation++;}if(turn<route.length)assert(game.swap(...route[turn]).ok);
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
// JS.hint assumes authored route trust. These are separate C# binding rejections,
// verified by a JS full-route replay oracle; no false claim that JS.hint rejects.
for(const route of [[[-1,0]],[[0,0]],[sample.solution[0]],sample.solution.slice(0,-1),[[3]],Array.from({length:sample.moves+1},()=>sample.solution[0])]){
 assert.throws(()=>certify(sample,{solution:route}));reject('untrusted-route-'+JSON.stringify(route),{level:sample,routes:{solution:route},certifyOnly:true},'rejectedUntrustedRoutes');
}
assert.equal(counts.certifiedRoutes,80);for(const source of ['proven_route','search_win','heuristic'])assert(sources[source]>0,'real comparison covers '+source);
function sdk(){for(const executable of [...new Set([process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean))]){const result=spawnSync(executable,['--version'],{cwd:root,encoding:'utf8',timeout:15000});if(result.status===0&&/^8\./.test(result.stdout.trim()))return {executable,version:result.stdout.trim()};}throw Error('Hint parity requires a real .NET8 SDK; no JavaScript fallback is available.');}
function run(executable,args,options={}){const result=spawnSync(executable,args,{cwd:root,encoding:'utf8',maxBuffer:128*1024*1024,timeout:180000,...options});if(result.error)throw result.error;if(result.status!==0)throw Error('Hint parity command failed:\n'+result.stdout+'\n'+result.stderr);return result.stdout;}
let temp;
try{
 const dotnet=sdk();temp=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-hint-parity-'));const bin=path.join(temp,'bin'),env={...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_NOLOGO:'1'};
 run(dotnet.executable,['build',path.join(root,'unity/HintParityHarness/Hexrota.HintParity.csproj'),'--configuration','Release','--nologo','--verbosity','quiet','--output',bin,'-p:BaseIntermediateOutputPath='+path.join(temp,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(root,'unity/HintParityHarness/NuGet.Config')],{env});
 const output=run(dotnet.executable,[path.join(bin,'Hexrota.HintParity.dll')],{env,input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n'}).trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));assert.equal(output.length,expected.length);
 for(let i=0;i<expected.length;i++){const row=expected[i],actual=output[i];if(row.error)assert.equal(actual.error,true,row.name+' native C# binding rejects');else{assert(!actual.error,row.name+': '+JSON.stringify(actual));assert.deepEqual(actual,row.result,row.name+' full C# hint/classification/budget/continuation/snapshot parity');}}
 console.log('C# hint parity passed: '+JSON.stringify({...counts,comparisons:expected.length,sources,dotnetSdk:dotnet.version,languageVersion:'7.3'}));
 console.log('Every guarantee was independently replayed to a win; inputs and RNG are unchanged. Deterministic node-budget parity is separate from injected clock policy. Malformed authored routes are explicitly rejected at the new trust boundary, not misreported as direct JS.hint rejection.');
}catch(error){console.error(error.stack||error);process.exitCode=1;}finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
