/* Compile the Unity-compatible C# core and compare it with shared JS golden vectors.
 * Requires a .NET 8 SDK. Set DOTNET_PATH when dotnet is not on PATH.
 * Build products are placed in a temporary directory, never in the repository.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=__dirname;
function findDotnet(){
 const candidates=[process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean);
 for(const command of [...new Set(candidates)]){
  const version=spawnSync(command,['--version'],{encoding:'utf8',timeout:15000});
  if(version.status===0&&/^\d+\.\d+/.test(version.stdout.trim()))return {command,version:version.stdout.trim()};
 }
 throw new Error('C# parity requires the .NET 8 SDK. Install it in a user-owned directory and set DOTNET_PATH to its dotnet executable.');
}
function run(command,args,options={}){
 const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:16*1024*1024,timeout:120000,...options});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error('C# parity command failed:\n'+result.stdout+'\n'+result.stderr);
 return result.stdout;
}
const plain=value=>JSON.parse(JSON.stringify(value));
let work;
try{
 const fixturePath=path.resolve(process.argv[2]||path.join(root,'fixtures/reward-vectors.json'));
 const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
 assert(fixture.rules&&Array.isArray(fixture.cases)&&fixture.cases.length,'fixtures contain shared rules and cases');
 const rewards=require(path.join(root,'dist/rewards.js'));
 assert.equal(typeof rewards.evaluate,'function','JS reward module exports evaluate');
 const requests=[{operation:'createState',attemptId:'parity-attempt'}],outcomes=[{name:'createState factory',expected:plain(rewards.createState('parity-attempt'))}];
 for(const vector of fixture.cases){
  const request=plain({input:vector.input,state:vector.state,rules:vector.rules||fixture.rules});
  const before=JSON.stringify(request);
  let actual,error;
  try{actual=rewards.evaluate(request.input,request.state,request.rules);}catch(caught){error=caught;}
  assert.equal(JSON.stringify(request),before,vector.name+': JS director does not mutate input/state/rules');
  if(vector.error===true){assert(error,vector.name+': JS rejects invalid input');outcomes.push({name:vector.name,error:true});}
  else{
   if(error)throw new Error(vector.name+': unexpected JS error: '+error.message);
   assert(Object.prototype.hasOwnProperty.call(vector,'expected'),vector.name+': golden expected result exists');
   assert.deepEqual(plain(actual),vector.expected,vector.name+': JS matches golden result');outcomes.push({name:vector.name,expected:vector.expected});
  }
  requests.push(request);
 }
 const sdk=findDotnet();work=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-reward-parity-'));
 const project=path.join(root,'unity/ParityHarness/Hexrota.RewardParity.csproj'),output=path.join(work,'bin');
 const env={...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_NOLOGO:'1'};
 run(sdk.command,['build',project,'--configuration','Release','--nologo','--verbosity','quiet','--output',output,'-p:BaseIntermediateOutputPath='+path.join(work,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(root,'unity/ParityHarness/NuGet.Config')],{cwd:root,env});
 const text=run(sdk.command,[path.join(output,'Hexrota.RewardParity.dll')],{cwd:root,env,input:requests.map(request=>JSON.stringify(request)).join('\n')+'\n'});
 const results=text.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));assert.equal(results.length,outcomes.length,'one C# result per vector');
 for(let i=0;i<outcomes.length;i++){
  const vector=outcomes[i],actual=results[i];
  if(vector.error)assert.equal(actual.error,true,vector.name+': C# rejects invalid input');
  else{assert(!actual.error,vector.name+': C# evaluates successfully ('+(actual.message||'')+')');assert.deepEqual(actual,vector.expected,vector.name+': C# matches JS golden result');}
 }
 const invalid=outcomes.filter(vector=>vector.error).length;
 console.log('Reward parity checks passed: '+fixture.cases.length+' shared vectors and createState factory ('+(outcomes.length-invalid)+' valid, '+invalid+' rejected); JS and C# outputs agree. C# 7.3 compiled with .NET SDK '+sdk.version+'.');
}catch(error){console.error(error.stack||error);process.exitCode=1;}
finally{if(work)fs.rmSync(work,{recursive:true,force:true});}
