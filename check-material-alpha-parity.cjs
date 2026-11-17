/* Real C#7.3 / .NET8 parity for the isolated material alpha catalog. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js','variants-data.js','attempts.js','material-alpha.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'dist',file),'utf8'),context,{filename:file});
const W=context.window,copy=v=>JSON.parse(JSON.stringify(v)),Engine=W.HexMatch,base=copy(W.HEX_LEVELS),pack=copy(W.HEX_VARIANTS),overrides=copy(require('./data/material-alpha-levels-v1.json').levels),classic=W.HexAttempts.createCatalog(base,pack,Engine),flow=W.HexMaterialAlpha.createCatalog(classic,overrides,Engine);
const requests=[],expectations=[],labels=[];let rejected=0,selected=0,prefixes=0;
const observed=x=>copy({metadata:x.metadata,level:x.level,snapshot:x.game.snapshot(),legacy:x.legacy});
function add(label,request,fn){let expected;const before=JSON.stringify(request);try{expected=copy(fn());}catch{expected={error:true};rejected++;}assert.equal(JSON.stringify(request),before,label+' input remains intact');requests.push(copy(request));expectations.push(expected);labels.push(label);}
add('initialize',{operation:'initialize',levels:base,packs:pack,overrides},()=>({currentVersion:classic.currentVersion,versions:[classic.currentVersion]}));
for(const id of [1,2,3,4,5,6,7,8,9,10,'6',null,-1]){
 add('default list '+id,{operation:'list',levelId:id},()=>flow.list(id));
 add('default resolution '+id,{operation:'resolve',levelId:id},()=>flow.resolveLevel(id));
 add('legacy metadata '+id,{operation:'legacyMetadata',levelId:id},()=>flow.legacyMetadata(id));
 add('default start '+id,{operation:'start',levelId:id,options:{}},()=>flow.start(id));selected++;
}
for(const options of [{},{selectionSeed:0},{selectionSeed:1,attemptSerial:2},{selectionSeed:4294967295,attemptSerial:9007199254740991},{selectionSeed:null,attemptSerial:null},{levelDataVersion:'material-alpha-v1'},{levelDataVersion:null},{levelDataVersion:'variants-v1'},{levelDataVersion:1},{selectionSeed:-1},{selectionSeed:4294967296},{selectionSeed:1.5},{selectionSeed:'1'},{attemptSerial:0},{attemptSerial:1.5},{attemptSerial:'1'},{attemptSerial:9007199254740992}]){
 add('flow selection '+JSON.stringify(options),{operation:'start',levelId:6,options},()=>flow.start(6,options));selected++;
}
for(const version of [undefined,null,'material-alpha-v1','variants-v1','missing']){
 add('flow list version '+version,{operation:'list',levelId:6,...(version===undefined?{}:{version})},()=>flow.list(6,version));
 for(const variantId of ['materials-v1','legacy-original','v1',null])add('flow resolve '+variantId+' '+version,{operation:'resolve',levelId:6,variantId,...(version===undefined?{}:{version})},()=>flow.resolveLevel(6,variantId,version));
}
add('legacy null list version still rejects',{operation:'list',levelId:1,version:null},()=>flow.list(1,null));
for(const level of base){const options={selectionSeed:73,attemptSerial:8};add('unmodified classic selection '+level.id,{operation:'classicStart',levelId:level.id,options},()=>classic.start(level.id,options));}
for(const alpha of overrides)for(const [i,route]of alpha.solutions.entries()){
 const options={selectionSeed:73,attemptSerial:i+1},pick=flow.start(alpha.id,options),g=new Engine(pick.level),rows=[];
 for(const pair of route){assert(g.swap(...pair).ok);const envelope=copy(flow.checkpoint(pick.metadata,g)),restored=flow.restore(alpha.id,envelope);rows.push({envelope,restored:observed(restored),status:restored.game.status});prefixes++;}
 assert.equal(g.status,'won');add('native material route '+alpha.id+'/'+i,{operation:'route',levelId:alpha.id,options,route},()=>rows);
}
const pick=flow.start(6,{selectionSeed:12,attemptSerial:2}),g=new Engine(pick.level);assert(g.swap(...pick.level.solutions[0][0]).ok);const snapshot=copy(g.snapshot()),metadata=copy(pick.metadata),envelope=copy(flow.checkpoint(metadata,snapshot));
add('flow snapshot metadata restore',{operation:'restore',levelId:6,record:snapshot,metadata},()=>observed(flow.restore(6,snapshot,metadata)));
add('flow envelope restore',{operation:'restore',levelId:6,record:envelope},()=>observed(flow.restore(6,envelope)));
add('flow checkpoint envelope',{operation:'checkpoint',metadata,snapshot},()=>flow.checkpoint(metadata,snapshot));
add('duplicate identity',{operation:'restore',levelId:6,record:envelope,metadata},()=>observed(flow.restore(6,envelope,metadata)));
for(const change of [{attemptVersion:2},{levelId:'6'},{variantId:'v1'},{levelDataVersion:'variants-v1'},{attemptSerial:0},{attemptSerial:1.5},{attemptSerial:'2'},{attemptId:'a-6-3-00000001'},{attemptId:'a-6-2-ABCDEFAB'}]){const bad={...metadata,...change};add('forged flow identity '+JSON.stringify(change),{operation:'restore',levelId:6,record:snapshot,metadata:bad},()=>observed(flow.restore(6,snapshot,bad)));}
for(const key of Object.keys(metadata)){const bad=copy(metadata);delete bad[key];add('missing flow identity '+key,{operation:'restore',levelId:6,record:snapshot,metadata:bad},()=>observed(flow.restore(6,snapshot,bad)));}
for(const [key,value]of [['cellOpen',snapshot.cellOpen.map(()=>true)],['blockerHp',snapshot.blockerHp.map(()=>0)],['regionOpen',[true]],['values',snapshot.values.map(()=>null)],['rngState',1],['history',[[0,0]]]]){const bad={...copy(snapshot),[key]:value};add('forged flow checkpoint '+key,{operation:'restore',levelId:6,record:bad,metadata},()=>observed(flow.restore(6,bad,metadata)));}
for(const record of [null,{},snapshot])add('missing flow identity/checkpoint '+JSON.stringify(record?.version),{operation:'restore',levelId:6,record},()=>observed(flow.restore(6,record)));
for(const mutate of [l=>l.id='6',l=>l.levelDataVersion='other',l=>l.variantId='v1',l=>l.rulesVersion='classic-v4',l=>l.solutions=[],l=>l.solutions=[l.solutions[0]],l=>l.solutions[1]=copy(l.solutions[0]),l=>l.solutions[0]=[[0,0]],l=>l.solutions[0][0]=[-1,0],l=>l.initial[0]=null,l=>l.obstacles.sources=[]]){const bad=copy(overrides);mutate(bad[0]);add('invalid override '+requests.length,{operation:'create',overrides:bad},()=>{W.HexMaterialAlpha.createCatalog(classic,bad,Engine);return{ok:true};});}
add('duplicate overrides',{operation:'create',overrides:[...overrides,...overrides]},()=>{W.HexMaterialAlpha.createCatalog(classic,[...overrides,...overrides],Engine);return{ok:true};});
add('empty overrides delegate classic',{operation:'create',overrides:[]},()=>{W.HexMaterialAlpha.createCatalog(classic,[],Engine);return{ok:true};});
add('returned copies isolate C# registry',{operation:'copyIsolation',levelId:6},()=>({resolved:flow.resolveLevel(6,'materials-v1','material-alpha-v1'),selected:flow.start(6).level}));
const old=classic.start(6,{selectionSeed:8}),oldgame=new Engine(old.level);oldgame.swap(...old.level.solutions[0][0]);const oldsave=copy(classic.checkpoint(old.metadata,oldgame));
add('old L6 checkpoint stays classic through original catalog',{operation:'classicRestore',levelId:6,record:oldsave},()=>observed(classic.restore(6,oldsave)));
add('flow scope rejects old L6 identity',{operation:'restore',levelId:6,record:oldsave},()=>observed(flow.restore(6,oldsave)));
let temp;try{
 const dotnet=[process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean).find(bin=>{const r=spawnSync(bin,['--version'],{encoding:'utf8'});return r.status===0&&/^8\./.test(r.stdout.trim());});assert(dotnet,'real .NET8 is required');
 const run=(args,options={})=>{const r=spawnSync(dotnet,args,{cwd:__dirname,encoding:'utf8',timeout:180000,maxBuffer:128*1024*1024,...options});if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr);return r.stdout;};
 temp=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-material-alpha-parity-'));const output=path.join(temp,'bin');
 run(['build','unity/MaterialAlphaParityHarness/Hexrota.MaterialAlphaParity.csproj','--configuration','Release','--nologo','--verbosity','quiet','--output',output,'-p:BaseIntermediateOutputPath='+path.join(temp,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(__dirname,'unity/MaterialAlphaParityHarness/NuGet.Config')]);
 const actual=run([path.join(output,'Hexrota.MaterialAlphaParity.dll')],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n'}).trim().split(/\r?\n/).map(JSON.parse);
 assert.equal(actual.length,expectations.length);for(let i=0;i<actual.length;i++){if(expectations[i].error)assert.equal(actual[i].error,true,labels[i]);else assert.deepEqual(actual[i],expectations[i],labels[i]);}
 console.log(`Material alpha JS/C# catalog parity passed: ${requests.length} scenarios, ${selected} selection cases, ${overrides.reduce((n,l)=>n+l.solutions.length,0)} complete routes/${prefixes} checkpoint prefixes, ${rejected} rejected override/identity/snapshot cases. Actual .NET8, C#7.3; legacy catalog and isolated material alpha identities remain separate.`);
}catch(error){console.error(error.stack||error);process.exitCode=1;}finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
