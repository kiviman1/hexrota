/* Compile the pure C# adapter and compare full inputs/plans/state with the unmodified JS adapter. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const root=__dirname,plain=value=>JSON.parse(JSON.stringify(value));
const context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js','rewards.js','reward-adapter.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
const {HexMatch:Engine,HEX_LEVELS:levels,HEX_TUTORIALS:tutorials,HEX_VARIANTS:variants,HexAttempts,HexRewards:Director,HexRewardAdapter:Adapter}=context.window;
const rules=JSON.parse(fs.readFileSync(path.join(root,'dist/reward-rules.json'),'utf8'));
const catalog=HexAttempts.createCatalog(levels,variants,Engine),requests=[],expected=[];
let routes=0,certified=0,offRoute=0,turns=0,waves=0,resumes=0,rejected=0,components=0,hintBoundaries=0;
function enqueue(name,request,run,{message=false}={}){
 const before=JSON.stringify(request);let value,error;
 try{value=run();}catch(caught){error=caught;}
 assert.equal(JSON.stringify(request),before,name+': JS adapter preserves its inputs');
 requests.push(plain(request));expected.push(error?{name,error:true,message:message?error.message:null}:{name,value:plain(value)});if(error)rejected++;
}
const observed=game=>plain({snapshot:game.snapshot(),status:game.status,covered:game.covered,remainingLayers:game.remainingLayers});
function expectedRoute(level,history,attemptId){
 const game=new Engine(level);let state=Director.createState(attemptId===undefined?String(level.id):attemptId);const steps=[];
 for(const pair of history){
  const before=game.snapshot(),result=game.swap(...pair);assert(result.ok);
  const payload={level,before,result,after:game.snapshot(),state,rules},unchanged=JSON.stringify(payload);
  const input=Adapter.summarize(level,before,result,game,attemptId===undefined?String(level.id):attemptId),evaluated=Director.evaluate(input,state,rules);
  assert.equal(JSON.stringify(payload),unchanged,'real adapter/director cannot mutate mechanic results or original state');state=evaluated.nextState;
  const restored=Adapter.restore(level,game.snapshot(),rules,Engine,Director,attemptId===undefined?String(level.id):attemptId);
  const fallbackInput=Adapter.summarize(level,before,result,null,attemptId===undefined?String(level.id):attemptId);
  steps.push(plain({input,fallbackInput,evaluated,restored,after:observed(game)}));turns++;waves+=input.waves.length;resumes++;
 }
 return {steps,finalRestore:plain(Adapter.restore(level,game.snapshot(),rules,Engine,Director,attemptId===undefined?String(level.id):attemptId)),final:observed(game)};
}
function route(name,level,history,attemptId){
 enqueue(name,{operation:'route',level,history,rules,...(attemptId===undefined?{}:{attemptId})},()=>expectedRoute(level,history,attemptId));routes++;
}
for(const level of [...tutorials,...levels])route('authored-'+level.id,plain(level),plain(level.solution));
for(const group of variants.levels)for(const variant of group.variants){
 const level=plain(catalog.resolveLevel(group.levelId,variant.id,variants.levelDataVersion));
 for(const [index,history]of variant.solutions.entries()){
  route(`certified-${group.levelId}-${variant.id}-${index+1}`,level,plain(history),`reward-${group.levelId}-${variant.id}-${index+1}`);certified++;
 }
 for(let policy=0;policy<2;policy++){
  const game=new Engine(level);while(game.status==='playing'){const legal=game.legalMoves();game.swap(...legal[(game.turn*7+policy*13)%legal.length]);}
  route(`off-route-${group.levelId}-${variant.id}-${policy+1}`,level,plain(game.history),`off-${group.levelId}-${variant.id}-${policy+1}`);offRoute++;
 }
}
assert.equal(certified,80,'every published certified route is exercised');assert.equal(offRoute,80,'every variant has two additional policies');
for(const level of [...tutorials,...levels]){
 for(const snapshot of [undefined,null,{}, {history:[]},{history:null},{history:false},{history:0},{history:''}]){
  enqueue(`empty-restore-${level.id}-${resumes}`,{operation:'restore',level:plain(level),rules,...(snapshot===undefined?{}:{snapshot})},()=>Adapter.restore(level,snapshot,rules,Engine,Director));resumes++;
 }
 const game=new Engine(level);game.swap(...level.solution[0]);
 const snapshot=plain(game.snapshot()),unchanged=JSON.stringify(snapshot);
 const hint=game.hint({maxMs:0,maxDepth:1,maxNodes:32});assert.equal(JSON.stringify(game.snapshot()),unchanged,'asking a hint leaves adapter replay inputs unchanged');hintBoundaries++;
 const corruptExceptHistory={...snapshot,values:['not-used-by-reward-adapter'],score:'not-a-save-validator',rngState:null};
 enqueue('reward-history-only-'+level.id,{operation:'restore',level:plain(level),rules,snapshot:corruptExceptHistory,attemptId:'history-'+level.id},()=>Adapter.restore(level,corruptExceptHistory,rules,Engine,Director,'history-'+level.id));resumes++;
 for(const history of [[[0,0]],[[-1,0]],[[0,999]],[[0]],[null],[[0,1,2]]]){
  enqueue(`invalid-route-${level.id}-${rejected}`,{operation:'restore',level:plain(level),rules,snapshot:{history}},()=>Adapter.restore(level,{history},rules,Engine,Director),{message:history.every(pair=>Array.isArray(pair)&&pair.length===2)});
 }
 const won=new Engine(level);for(const pair of level.solution)assert(won.swap(...pair).ok);assert.equal(won.status,'won');
 const terminalHistory=[...plain(won.history),plain(level.solution[0])];enqueue('terminal-route-'+level.id,{operation:'restore',level:plain(level),rules,snapshot:{history:terminalHistory}},()=>Adapter.restore(level,{history:terminalHistory},rules,Engine,Director),{message:true});
}
const sample=plain(levels[0]),g=new Engine(sample),before=plain(g.snapshot());
for(const result of [null,{ok:false,reason:'neighbor',frames:[],scoreGain:0,reshuffled:false}])enqueue('non-success-summary-'+components++,{operation:'summary',level:sample,before,result},()=>Adapter.summarize(sample,before,result,null));
enqueue('default-id-evaluated-before-result-guard-'+components++,{operation:'summary',level:null,before:null,result:null},()=>Adapter.summarize(null,null,null));
for(const result of [null,{ok:false,frames:'unused-malformed'}])enqueue('failed-result-ignores-unused-payload-'+components++,{operation:'summary',level:sample,before:null,result},()=>Adapter.summarize(sample,null,result));
for(const values of [sample.cells.map(()=>1),sample.cells.map(()=>null),sample.initial]){
 const frame={before:values};enqueue('run-features-'+components++,{operation:'runs',level:sample,frame},()=>Adapter.runsFor(sample,frame));
}
for(const mode of ['at-least','exact'])for(const delta of [-1,0,1]){
 const level={...sample,targetMode:mode},b={...before,score:level.target+delta,movesLeft:1,layers:before.layers.map(()=>0)};
 const result={ok:true,frames:[],scoreGain:0,reshuffled:false,reason:null};
 enqueue('summary-status-'+components++,{operation:'summary',level,before:b,result},()=>Adapter.summarize(level,b,result,null));
}
for(const attemptId of [null,'']){
 const game=new Engine(sample),b=game.snapshot(),result=game.swap(...sample.solution[0]);
 enqueue('explicit-identity-summary-'+String(attemptId),{operation:'summary',level:sample,before:plain(b),result:plain(result),attemptId},()=>Adapter.summarize(sample,b,result,null,attemptId));components++;
 enqueue('explicit-identity-restore-'+String(attemptId),{operation:'restore',level:sample,rules,snapshot:{history:[]},attemptId},()=>Adapter.restore(sample,{history:[]},rules,Engine,Director,attemptId));
}
for(const level of [sample,{...sample,id:'1'},{...sample,id:'learn-identity',kind:'tutorial'}]){
 route('typed-default-id-'+level.id,level,plain(level.solution));
}
function findDotnet(){
 for(const command of [...new Set([process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean))]){
  const found=spawnSync(command,['--version'],{cwd:root,encoding:'utf8',timeout:15000});if(found.status===0&&/^8\./.test(found.stdout.trim()))return {command,version:found.stdout.trim()};
 }
 throw Error('Reward adapter parity requires a real .NET 8 SDK; install it or set DOTNET_PATH. JavaScript output is never a substitute.');
}
function run(command,args,options={}){const out=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:128*1024*1024,timeout:180000,...options});if(out.error)throw out.error;if(out.status!==0)throw Error('Reward adapter C# command failed:\n'+out.stdout+'\n'+out.stderr);return out.stdout;}
let temporary;
try{
 const sdk=findDotnet();temporary=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-reward-adapter-'));const bin=path.join(temporary,'bin'),project=path.join(root,'unity/RewardAdapterParityHarness/Hexrota.RewardAdapterParity.csproj');
 const env={...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_NOLOGO:'1'};
 run(sdk.command,['build',project,'--configuration','Release','--nologo','--verbosity','quiet','--output',bin,'-p:BaseIntermediateOutputPath='+path.join(temporary,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(root,'unity/RewardAdapterParityHarness/NuGet.Config')],{env});
 const output=run(sdk.command,[path.join(bin,'Hexrota.RewardAdapterParity.dll')],{env,input:requests.map(value=>JSON.stringify(value)).join('\n')+'\n'}).trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));assert.equal(output.length,expected.length);
 for(const [i,test]of expected.entries()){
  const actual=output[i];if(test.error){assert.equal(actual.error,true,test.name+': C# rejects invalid reward history');if(test.message)assert.equal(actual.message,test.message,test.name+': explicit invalid-history reason matches');}
  else{assert(!actual?.error,test.name+': '+actual?.message);assert.deepEqual(actual,test.value,test.name+': full adapter input, director output, restore and mechanic result match');}
 }
 console.log(`C# reward adapter parity passed: ${routes} routes (${certified} complete certified + ${offRoute} off-route), ${turns} turns, ${waves} waves, ${resumes} replay/restore checks, ${components} component/status cases, ${rejected} invalid routes and ${hintBoundaries} nonmutating hint boundaries. Full RewardInput/evaluated plans/nextState/restore JSON agrees. C# 7.3 compiled with .NET SDK ${sdk.version}.`);
}catch(error){console.error(error.stack||error);process.exitCode=1;}
finally{if(temporary)fs.rmSync(temporary,{recursive:true,force:true});}
