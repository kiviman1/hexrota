'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const {cases,run}=require('./lib/economy-cases.cjs');
function sdk(){for(const candidate of [...new Set([process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean))]){const p=spawnSync(candidate,['--version'],{encoding:'utf8'});if(p.status===0&&/^8\./.test(p.stdout.trim()))return candidate;}throw Error('Economy parity requires a real .NET 8 SDK; no JavaScript fallback exists.');}
function command(binary,args,options={}){const p=spawnSync(binary,args,{cwd:__dirname,encoding:'utf8',timeout:240000,maxBuffer:128*1024*1024,...options});if(p.error||p.status!==0)throw Error(String(p.error||'')+'\n'+p.stdout+'\n'+p.stderr);return p.stdout;}
const dotnet=sdk(),output=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-economy-'));
try{
 command(process.execPath,['sync-economy-config.cjs','--check']);
 command(dotnet,['build','unity/EconomyParityHarness/EconomyParityHarness.csproj','-c','Release','-o',output,'--nologo']);
 const flows=cases(),results=command(dotnet,[path.join(output,'EconomyParityHarness.dll')],{input:flows.map(c=>JSON.stringify(c.input)).join('\n')+'\n'}).trim().split('\n');assert.equal(results.length,flows.length,'real harness output count');
 let comparisons=0;for(let i=0;i<flows.length;i++){const expected=run(flows[i].input),actual=JSON.parse(results[i]);assert.deepEqual(actual,expected,flows[i].label);comparisons+=Array.isArray(expected)?expected.length:1;}
 console.log(`Real .NET 8 / C# 7.3 economy parity: ${flows.length} flows, ${comparisons} complete result+state comparisons passed. No web-engine replacement or SDK fallback.`);
}finally{fs.rmSync(output,{recursive:true,force:true});}
