/* Real .NET8/C#7.3 rescue comparison, never a JS fallback. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process'),{buildSuite}=require('./check-rescue.cjs');
const root=__dirname,original=buildSuite(),supplemental=require('./check-rescue-receipts-safety.cjs').buildSupplementalSuite(),{frozenCases}=original;
const requests=original.requests.concat(supplemental.requests),expected=original.expected.concat(supplemental.expected);
function run(command,args,options={}){const result=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:128*1024*1024,...options});if(result.error)throw result.error;if(result.status!==0)throw Error(result.stdout+'\n'+result.stderr);return result.stdout;}
function findSdk(){for(const executable of [...new Set([process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet/dotnet')].filter(Boolean))]){const probe=spawnSync(executable,['--version'],{encoding:'utf8',timeout:15000});if(probe.status===0&&/^8\./.test(probe.stdout.trim()))return{executable,version:probe.stdout.trim()};}throw Error('Rescue parity requires real .NET SDK8; install it or set DOTNET_PATH. No JavaScript fallback.');}
let temp;
try{
 const sdk=findSdk();temp=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-rescue-parity-'));const output=path.join(temp,'bin'),env={...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_NOLOGO:'1'};
 run(sdk.executable,['build',path.join(root,'unity/RescueParityHarness/Hexrota.RescueParity.csproj'),'--configuration','Release','--nologo','--verbosity','quiet','--output',output,'-p:BaseIntermediateOutputPath='+path.join(temp,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(root,'unity/RescueParityHarness/NuGet.Config')],{env});
 const lines=run(sdk.executable,[path.join(output,'Hexrota.RescueParity.dll')],{env,input:requests.map(request=>JSON.stringify(request)).join('\n')+'\n'}).trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));assert.equal(lines.length,expected.length,'every request compiled and executed');
 for(const [index,item]of expected.entries()){assert.equal(lines[index].inputUnchanged,true,item.label+' C# immutable input');assert.deepEqual(lines[index].result,item.result,item.label+' complete JS/C# state/outcome/rejection');}
 console.log(`Rescue parity: ${expected.length} real C# comparisons passed (.NET ${sdk.version}, C#7.3); ${original.expected.length} unchanged original comparisons, ${supplemental.comparisons} retained-receipt comparisons in ${supplemental.groups.length} groups; ${frozenCases} frozen cases + 600 compiled lifecycle transitions. No Unity/IL2CPP/device claim.`);
}finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
