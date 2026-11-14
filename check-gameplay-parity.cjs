/* Actual C# 7.3 compilation + full-wave comparison with unmodified JavaScript goldens.
 * Gameplay only: C# hints, variant selection, LifeManager and the app are separate ports.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const root=__dirname,plain=value=>JSON.parse(JSON.stringify(value));
function findDotnet(){
 const candidates=[process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean);
 for(const command of [...new Set(candidates)]){
  const result=spawnSync(command,['--version'],{encoding:'utf8',timeout:15000});
  if(result.status===0&&/^8\./.test(result.stdout.trim()))return {command,version:result.stdout.trim()};
 }
 throw Error('Gameplay parity requires .NET 8. Install the SDK or set DOTNET_PATH; this check never substitutes a JavaScript result.');
}
function run(command,args,options={}){
 const result=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:128*1024*1024,timeout:180000,...options});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('Gameplay parity command failed:\n'+result.stdout+'\n'+result.stderr);
 return result.stdout;
}
const context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
const {HexMatch:Engine,HexAttempts,HEX_LEVELS,HEX_VARIANTS}=context.window;
const fixture=JSON.parse(fs.readFileSync(path.join(root,'fixtures/gameplay-vectors.json'),'utf8'));
assert.equal(fixture.schemaVersion,1);assert.equal(fixture.rulesVersion,'classic-v4');assert.equal(fixture.cases.length,71,'the complete shared mechanics fixture is exercised');
const catalog=HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,Engine),requests=[],outcomes=[];
let swaps=0,resumes=0,cloneChecks=0,swapCloneChecks=0,supplementalRoutes=0,offRouteRuns=0,offRouteSwaps=0,replays=0;
const observed=g=>plain({snapshot:g.snapshot(),status:g.status,covered:g.covered,remainingLayers:g.remainingLayers});
function injected(level,state){const g=new Engine(level);for(const k of ['values','layers','score','movesLeft','turn','rngState','history'])g[k]=plain(state.snapshot[k]);return g;}
function request(operation,expected,name,error=false){requests.push(plain(operation));outcomes.push({expected:plain(expected),name,error});}
function rejection(level,snapshot,name,baseline=new Engine(level).snapshot()){
 const before=JSON.stringify(snapshot);assert.throws(()=>new Engine(level,snapshot),name+': JavaScript rejects forged snapshot');assert.equal(JSON.stringify(snapshot),before,name+': JS preserves invalid input');
 request({operation:'restore',level,snapshot,baseline},null,name,true);
}
function expectedCase(entry){
 if(entry.kind==='rng'){
  const game=new Engine({cells:[{q:0,r:0,layers:1}],initial:[1],palette:[1,2],seed:entry.seed,moves:1,target:1});
  const initialState=game.rngState,result=entry.expected.map(()=>game._random());assert.deepEqual(plain(result),entry.expected,entry.id+' JS RNG golden');return {initialState,result};
 }
 if(entry.kind==='matches'){
  const result=plain(new Engine(entry.level).findMatches(entry.values));assert.deepEqual(result,entry.expected,entry.id+' JS matches golden');return {result};
 }
 if(entry.kind==='route'){
  let game=new Engine(entry.level),initial=observed(game);assert.deepEqual(initial,entry.initial,entry.id+' JS initial golden');
  const output={initial,initialClone:initial,initialLegalMoves:plain(game.legalMoves()),invalidSwaps:[],steps:[]};
  for(const invalid of entry.invalidSwaps){const before=observed(game),result=plain(game.swap(...invalid.pair));assert.equal(result.ok,false);assert.equal(result.reason,invalid.reason);assert.deepEqual(observed(game),before);output.invalidSwaps.push({result,after:before});}
  for(const [index,step]of entry.steps.entries()){
   const result=plain(game.swap(...step.pair));assert.deepEqual(result,step.result,entry.id+' JS full-wave golden');assert.deepEqual(observed(game),step.after,entry.id+' JS state golden');swaps++;
   const after=observed(game),row={result,after,clone:after,legalMoves:plain(game.legalMoves())};
   if(index+1===entry.resumeAfterTurn){
    const snapshot=plain(game.snapshot());game=new Engine(entry.level,snapshot);row.resume=observed(game);resumes++;
    request({operation:'restore',level:entry.level,snapshot},observed(game),entry.id+' explicit resume');
    for(const field of ['score','rngState','values','layers']){
     const forged=plain(snapshot);
     if(field==='score')forged.score++;
     else if(field==='rngState')forged.rngState=((forged.rngState+1)>>>0)||1;
     else if(field==='values')forged.values[0]=entry.level.palette.find(n=>n!==forged.values[0]);
     else forged.layers[0]=forged.layers[0]===0?1:forged.layers[0]-1;
     rejection(entry.level,forged,entry.id+' forged '+field,snapshot);
    }
   }
   output.steps.push(row);
  }
  output.replay=observed(game);replays++;
  if(entry.terminalSwap){const result=plain(game.swap(...entry.terminalSwap.pair));assert.deepEqual(result,entry.terminalSwap.result);output.terminalSwap={result,after:observed(game)};assert.deepEqual(output.terminalSwap.after,entry.terminalSwap.after);}
  output.cloneChecks=1+entry.steps.length;cloneChecks+=output.cloneChecks;
  output.swapCloneChecks=entry.steps.length;swapCloneChecks+=output.swapCloneChecks;return output;
 }
 const game=injected(entry.level,entry.state);let result;
 if(entry.kind==='status')result=game.status;
 else if(entry.kind==='state-swap'){result=game.swap(...entry.pair);swaps++;}
 else if(entry.kind==='gravity')result=game._gravity(entry.removed);
 else if(entry.kind==='refill')result=game._fillVacancies();
 else if(entry.kind==='reshuffle')result=game._ensurePlayable();
 else throw Error('Unknown fixture kind '+entry.kind);
 assert.deepEqual(plain(result),entry.result,entry.id+' JS component golden');assert.deepEqual(observed(game),entry.after,entry.id+' JS component state golden');
 const output={result:plain(result),after:observed(game)};if(entry.kind==='reshuffle')output.legalMoves=plain(game.legalMoves());return output;
}
for(const entry of fixture.cases)request({operation:'case',vector:entry},expectedCase(entry),entry.id);
// Prefix fixtures cover every variant, but phase 1 also runs all 80 complete
// certified routes to ensure refill/replay agreement through their actual wins.
for(const group of HEX_VARIANTS.levels)for(const variant of group.variants){
 const level=plain(catalog.resolveLevel(group.levelId,variant.id,HEX_VARIANTS.levelDataVersion));
 for(const [routeIndex,route]of variant.solutions.entries()){
  const game=new Engine(level),entry={id:`certified-${group.levelId}-${variant.id}-${routeIndex+1}`,kind:'route',level,initial:observed(game),invalidSwaps:[{pair:[-1,0],reason:'neighbor'}],steps:[],resumeAfterTurn:1};
  for(const pair of route){const result=plain(game.swap(...pair));assert(result.ok);entry.steps.push({pair:plain(pair),result,after:observed(game)});}
  assert.equal(game.status,'won');entry.terminalSwap={pair:[0,1],result:plain(game.swap(0,1)),after:observed(game)};
  request({operation:'case',vector:entry},expectedCase(entry),entry.id);supplementalRoutes++;
 }
}
// Additional legal decisions intentionally leave certified paths. This is a
// deterministic port regression check, not a human win-rate/balance estimate.
for(const group of HEX_VARIANTS.levels)for(const variant of group.variants){
 const level=plain(catalog.resolveLevel(group.levelId,variant.id,HEX_VARIANTS.levelDataVersion));
 for(let trial=1;trial<=3;trial++){
  const game=new Engine(level),entry={id:`off-route-${group.levelId}-${variant.id}-${trial}`,kind:'route',level,initial:observed(game),invalidSwaps:[],steps:[],resumeAfterTurn:1};
  let choiceSeed=(0x9e3779b9^Number(group.levelId)*65537^variant.seed^trial)>>>0;
  while(game.status==='playing'){
   const legal=game.legalMoves();assert(legal.length>0,entry.id+' remains playable');
   choiceSeed^=choiceSeed<<13;choiceSeed^=choiceSeed>>>17;choiceSeed^=choiceSeed<<5;choiceSeed>>>=0;
   const pair=plain(legal[choiceSeed%legal.length]),result=plain(game.swap(...pair));assert(result.ok);
   entry.steps.push({pair,result,after:observed(game)});offRouteSwaps++;
  }
  assert(entry.steps.length>0);entry.terminalSwap={pair:[0,1],result:plain(game.swap(0,1)),after:observed(game)};
  request({operation:'case',vector:entry},expectedCase(entry),entry.id);offRouteRuns++;
 }
}
// Required wire fields and replay constraints reject malformed snapshots instead
// of accepting C# default zero values. These are core saves, not attempt envelopes.
const sample=fixture.cases.find(v=>v.kind==='route'&&v.steps.length>1),valid=plain(sample.steps[0].after.snapshot);
for(const field of Object.keys(valid)){const bad=plain(valid);delete bad[field];rejection(sample.level,bad,'missing snapshot '+field);}
for(const [field,value]of [['version',5],['rulesVersion','other'],['movesLeft',sample.level.moves+1],['turn',0.5],['rngState',0],['rngState',4294967296],['history',null],['values',null],['layers',null]]){const bad=plain(valid);bad[field]=value;rejection(sample.level,bad,'invalid '+field+' '+String(value));}
for(const pair of [[-1,0],[0,0],[0,sample.level.cells.length],[2147483647,-2147483648]]){
 const g=new Engine(sample.level),before=observed(g),result=plain(g.swap(...pair));assert.equal(result.ok,false);assert.deepEqual(observed(g),before);
 const entry={id:'invalid-neighbor-'+pair.join('-'),kind:'route',level:sample.level,initial:before,invalidSwaps:[{pair,reason:result.reason}],steps:[],resumeAfterTurn:1};request({operation:'case',vector:entry},expectedCase(entry),entry.id);
}
let temp;
try{
 const sdk=findDotnet();temp=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-gameplay-parity-'));
 const output=path.join(temp,'bin'),project=path.join(root,'unity/GameplayParityHarness/Hexrota.GameplayParity.csproj');
 const env={...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_NOLOGO:'1'};
 run(sdk.command,['build',project,'--configuration','Release','--nologo','--verbosity','quiet','--output',output,'-p:BaseIntermediateOutputPath='+path.join(temp,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(root,'unity/GameplayParityHarness/NuGet.Config')],{env});
 const text=run(sdk.command,[path.join(output,'Hexrota.GameplayParity.dll')],{env,input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n'});
 const results=text.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));assert.equal(results.length,outcomes.length,'one real C# result for every request');
 for(const [index,expected]of outcomes.entries()){
  const actual=results[index];
  if(expected.error){assert.equal(actual.error,true,expected.name+' C# must reject malformed/forged snapshot');assert.equal(actual.stateUnchanged,true,expected.name+' rejected restore preserves existing state');}
  else{assert(!actual.error,expected.name+': C# result '+(actual.message||''));assert.deepEqual(actual,expected.expected,expected.name+': complete C# JSON matches JavaScript/golden result');}
 }
 const rejects=outcomes.filter(row=>row.error).length;
 console.log(`C# gameplay parity passed: ${fixture.cases.length} shared mechanics cases + ${supplementalRoutes} full certified routes + ${offRouteRuns} off-route legal runs (${offRouteSwaps} swaps); ${swaps} total valid swaps, ${resumes} exact resumes, ${replays} explicit replays, ${cloneChecks} independent clone checks, ${swapCloneChecks} cloned next-swap comparisons, ${rejects} rejected core saves with unchanged prior state. All intermediate matches/refill/falls/RNG/layers/status JSON agrees. C# 7.3 compiled with .NET SDK ${sdk.version}.`);
 console.log(`Explicit phase-1 scope: ${fixture.selectionCases.length} variant-selector vectors, ${fixture.rejectionCases.length} attempt-envelope rejection vectors and hint recommendations remain JavaScript checks in npm test; they are not claimed as C# ports.`);
}catch(error){console.error(error.stack||error);process.exitCode=1;}
finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
