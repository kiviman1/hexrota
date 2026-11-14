/* Compile the real C# catalog and compare complete resolved levels, identities and replay saves. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=__dirname,plain=value=>JSON.parse(JSON.stringify(value)),context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
const {HexMatch:Engine,HexAttempts,HEX_LEVELS:levels,HEX_TUTORIALS:tutorials,HEX_VARIANTS:pack}=context.window;
const catalog=HexAttempts.createCatalog(levels,pack,Engine),fixtures=JSON.parse(fs.readFileSync(path.join(root,'fixtures/gameplay-vectors.json'))),requests=[],expectations=[];
const observe=entry=>plain({metadata:entry.metadata,level:entry.level,snapshot:entry.game.snapshot(),legacy:entry.legacy});
let selections=0,resumes=0,envelopes=0,certifiedRoutes=0,certifiedSwaps=0,rejections=0,versions=0,tutorialCases=0;
function add(input,evaluate,name){const before=JSON.stringify(input);let expected;try{expected=plain(evaluate());}catch(error){expected={error:true,code:error.code||null,...(error.code?{message:error.message}:{})};rejections++;}assert.equal(JSON.stringify(input),before,name+' reference must not mutate request');requests.push(plain(input));expectations.push({name,expected});}
const campaignJson=fs.readFileSync(path.join(root,'data/levels-original.json'),'utf8'),tutorialJson=fs.readFileSync(path.join(root,'data/tutorials-fixed.json'),'utf8'),variantJson=fs.readFileSync(path.join(root,'dist/variants.json'),'utf8');
assert.deepEqual(JSON.parse(campaignJson).levels,plain(levels),'actual campaign JSON matches authoritative JS source');assert.deepEqual(JSON.parse(tutorialJson).levels,plain(tutorials),'actual tutorial JSON matches authoritative JS source');assert.deepEqual(JSON.parse(variantJson),plain(pack),'actual variants JSON matches authoritative JS source');
add({operation:'loadDocuments',campaignJson,tutorialJson,variantJson},()=>({currentVersion:pack.levelDataVersion,originals:levels,tutorials,variants:pack.levels.flatMap(group=>group.variants.map(variant=>catalog.resolveLevel(group.levelId,variant.id,pack.levelDataVersion)))}),'load-actual-published-JSON-documents');
add({operation:'initialize',levels:plain(levels),tutorials:plain(tutorials),packs:plain(pack)},()=>({currentVersion:pack.levelDataVersion,versions:[pack.levelDataVersion]}),'load10campaigns2tutorials40variants');
for(const entry of fixtures.selectionCases){add({operation:'start',levelId:entry.levelId,options:entry.input},()=>{const result=catalog.start(entry.levelId,entry.input);assert.deepEqual(plain({metadata:result.metadata,selectionSeed:result.selectionSeed}),entry.expected);return result;},'shared-selector-'+(++selections));}
for(const base of levels){
 add({operation:'list',levelId:base.id},()=>catalog.list(base.id),'publication-order-'+base.id);
 add({operation:'legacyMetadata',levelId:base.id},()=>catalog.legacyMetadata(base.id),'legacy-metadata-'+base.id);
 let seed=0,previous=null,recent=[];
 for(let serial=1;serial<=64;serial++){
  const options={selectionSeed:seed,attemptSerial:serial,previousVariantId:previous,recentVariantIds:recent.slice()},selected=catalog.start(base.id,options);
  add({operation:'start',levelId:base.id,options},()=>selected,'selection-sequence-'+base.id+'-'+serial);selections++;
  assert.notEqual(selected.metadata.variantId,previous);seed=selected.selectionSeed;previous=selected.metadata.variantId;recent=[...recent,previous].slice(-16);
 }
 const legacy=new Engine(base);legacy.swap(...base.solution[0]);const snapshot=plain(legacy.snapshot());
 add({operation:'restore',levelId:base.id,record:snapshot},()=>observe(catalog.restore(base.id,snapshot)),'legacy-prefix-'+base.id);resumes++;
 const metadata=plain(catalog.legacyMetadata(base.id));
 add({operation:'checkpoint',metadata,snapshot},()=>catalog.checkpoint(metadata,snapshot),'legacy-envelope-'+base.id);envelopes++;
 add({operation:'selectionRngIsolation',levelId:base.id,options:{selectionSeed:123,attemptSerial:3}},()=>{const game=new Engine(base),before=plain(game.snapshot());const selected=catalog.start(base.id,{selectionSeed:123,attemptSerial:3});assert.deepEqual(plain(game.snapshot()),before);return {before,after:before,selected};},'selection-does-not-consume-game-rng-'+base.id);
 const group=pack.levels.find(g=>g.levelId===base.id);
 for(const variant of group.variants){
  const level=catalog.resolveLevel(base.id,variant.id,pack.levelDataVersion);
  add({operation:'resolve',levelId:base.id,variantId:variant.id,version:pack.levelDataVersion},()=>level,'complete-resolved-variant-'+base.id+'-'+variant.id);
  const selected=catalog.start(base.id,{selectionSeed:37,attemptSerial:99,recentVariantIds:group.variants.filter(v=>v.id!==variant.id).map(v=>v.id)}),metadata=plain(selected.metadata);assert.equal(metadata.variantId,variant.id);
  for(const [routeIndex,route]of variant.solutions.entries()){
   const game=new Engine(level);
   for(const [turn,pair]of route.entries()){
    assert(game.swap(...pair).ok);certifiedSwaps++;const snapshot=plain(game.snapshot()),envelope=plain(catalog.checkpoint(metadata,snapshot));
    add({operation:'restore',levelId:base.id,record:envelope},()=>observe(catalog.restore(base.id,envelope)),`variant-resume-${base.id}-${variant.id}-${routeIndex}-${turn}`);resumes++;
    if(turn===0){
     add({operation:'checkpoint',metadata,snapshot},()=>envelope,`checkpoint-${base.id}-${variant.id}-${routeIndex}`);envelopes++;
     for(const [field,value]of [['score',snapshot.score+1],['rngState',((snapshot.rngState+1)>>>0)||1],['rulesVersion','forged'],['history',null]]){const bad=plain(envelope);bad.snapshot[field]=value;add({operation:'restore',levelId:base.id,record:bad},()=>observe(catalog.restore(base.id,bad)),`forged-${field}-${base.id}-${variant.id}-${routeIndex}`);}
     const wrongType={...metadata,levelId:String(base.id)};add({operation:'restore',levelId:base.id,record:snapshot,metadata:wrongType},()=>observe(catalog.restore(base.id,snapshot,wrongType)),`wrong-id-type-${base.id}-${variant.id}-${routeIndex}`);
     add({operation:'restore',levelId:base.id,record:envelope,metadata},()=>observe(catalog.restore(base.id,envelope,metadata)),`duplicate-identity-${base.id}-${variant.id}-${routeIndex}`);
    }
   }
   assert.equal(game.status,'won');certifiedRoutes++;
  }
 }
}
add({operation:'winningRoutes',groups:plain(pack.levels)},()=>pack.levels.flatMap(group=>group.variants.flatMap(variant=>variant.solutions.map((route,routeIndex)=>{const game=new Engine(catalog.resolveLevel(group.levelId,variant.id,pack.levelDataVersion));for(const pair of route)assert(game.swap(...pair).ok);assert.equal(game.status,'won');return {levelId:group.levelId,variantId:variant.id,routeIndex,snapshot:game.snapshot(),status:game.status};}))), 'native-full80winning-route-replays');
for(const entry of fixtures.rejectionCases)add({operation:'restore',levelId:entry.levelId,record:entry.checkpoint},()=>{try{return observe(catalog.restore(entry.levelId,entry.checkpoint));}catch(error){assert.equal(error.code||null,entry.expectedErrorCode||null);throw error;}},'shared-reject-'+entry.id);
const first=pack.levels[0].variants[0],validLevel=catalog.resolveLevel(1,first.id,pack.levelDataVersion),g=new Engine(validLevel);g.swap(...first.solutions[0][0]);const validMeta=plain(catalog.start(1,{selectionSeed:1,recentVariantIds:pack.levels[0].variants.filter(v=>v.id!==first.id).map(v=>v.id)}).metadata),validSave=plain(g.snapshot());
for(const levelId of ['1',true,null,-1,1.5,{},[],9007199254740992])add({operation:'start',levelId,options:{}},()=>catalog.start(levelId),'strict-level-id-'+JSON.stringify(levelId));
for(const options of [{selectionSeed:null},{selectionSeed:'1'},{selectionSeed:-1},{selectionSeed:4294967296},{attemptSerial:0},{attemptSerial:1.5},{attemptSerial:'1'},{attemptSerial:9007199254740992},{levelDataVersion:1},{levelDataVersion:'unknown'}])add({operation:'start',levelId:1,options},()=>catalog.start(1,options),'invalid-selection-'+JSON.stringify(options));
for(const options of [{selectionSeed:0,attemptSerial:9007199254740991},{selectionSeed:4294967295,attemptSerial:2147483648},{selectionSeed:1,previousVariantId:first.id,recentVariantIds:pack.levels[0].variants.map(v=>v.id)},{selectionSeed:1,previousVariantId:42,recentVariantIds:'not-array'},{selectionSeed:1,attemptSerial:null,levelDataVersion:null}]){add({operation:'start',levelId:1,options},()=>catalog.start(1,options),'boundary-selection-'+JSON.stringify(options));selections++;}
for(const field of Object.keys(validMeta)){const bad={...validMeta};delete bad[field];add({operation:'restore',levelId:1,record:validSave,metadata:bad},()=>observe(catalog.restore(1,validSave,bad)),'missing-metadata-'+field);}
for(const change of [{attemptVersion:'1'},{attemptId:'a-1-1-ABCDEFAB'},{attemptId:'a-1-2-00000001'},{attemptSerial:-1},{variantId:'missing'},{levelDataVersion:'future'},{levelId:'1'},{attemptId:'x'.repeat(181)}]){const bad={...validMeta,...change};add({operation:'restore',levelId:1,record:validSave,metadata:bad},()=>observe(catalog.restore(1,validSave,bad)),'bad-metadata-'+JSON.stringify(change));}
for(const field of Object.keys(validSave)){const bad=plain(validSave);delete bad[field];add({operation:'restore',levelId:1,record:bad,metadata:validMeta},()=>observe(catalog.restore(1,bad,validMeta)),'missing-snapshot-'+field);}
for(const [variantId,version]of [['missing',pack.levelDataVersion],[first.id,'future'],['legacy-original',pack.levelDataVersion],[null,pack.levelDataVersion]])add({operation:'resolve',levelId:1,variantId,version},()=>catalog.resolveLevel(1,variantId,version),'bad-resolution-'+variantId+'-'+version);
for(const version of [null,'future',1])add({operation:'list',levelId:1,version},()=>catalog.list(1,version),'bad-list-version-'+version);
for(const [index,tutorial]of tutorials.entries()){
 add({operation:'tutorial',levelId:tutorial.id},()=>tutorial,'tutorial-wire-'+index);tutorialCases++;
 for(const serial of [0,1,2147483648,9007199254740991]){
  const metadata={attemptVersion:1,levelId:tutorial.id,variantId:'fixed',levelDataVersion:'tutorials-v1',attemptId:serial?`t-${tutorial.id}-${serial}`:`legacy-${tutorial.id}`,attemptSerial:serial};
  add({operation:'tutorialMetadata',levelId:tutorial.id,serial},()=>metadata,'tutorial-meta-'+index+'-'+serial);tutorialCases++;
  const game=new Engine(tutorial);for(const pair of tutorial.solution){game.swap(...pair);const snapshot=plain(game.snapshot());add({operation:'restoreTutorial',levelId:tutorial.id,snapshot,metadata},()=>({metadata,level:tutorial,snapshot,legacy:serial===0}),'tutorial-restore-'+index+'-'+serial+'-'+game.turn);tutorialCases++;}
 }
}
add({operation:'copyIsolation',levelId:1,variantId:first.id},()=>({resolved:catalog.resolveLevel(1,first.id,pack.levelDataVersion),started:catalog.start(1).level}),'returned-data-cannot-mutate-catalog');
// Catalog shape failures preserve the exact source error codes/messages and never fallback.
const mutations=[p=>p.schemaVersion=2,p=>p.levelDataVersion='original-v1',p=>p.levels[0].levelId='1',p=>p.levels.push(plain(p.levels[0])),p=>p.levels[0].variants[0].seed=0,p=>p.levels[0].variants[0].initial[0]='1',p=>p.levels[0].variants[0].solutions=[p.levels[0].variants[0].solutions[0]],p=>p.levels[0].variants[0].solutions[1]=plain(p.levels[0].variants[0].solutions[0]),p=>p.levels[0].variants[0].solutions[0][0]=[-1,0],p=>p.levels[0].variants.push(plain(p.levels[0].variants[0]))];
for(const [i,mutate]of mutations.entries()){const bad=plain(pack);mutate(bad);add({operation:'create',levels:plain(levels),packs:bad},()=>{const c=HexAttempts.createCatalog(levels,bad,Engine);return {currentVersion:c.currentVersion,versions:[c.currentVersion]};},'invalid-catalog-'+i);}
// Archived publication order is explicit, with current meaning the last supplied pack.
const older=plain(pack);older.levelDataVersion='variants-archived-v1';for(const entry of older.levels)entry.variants.reverse();
add({operation:'initialize',levels:plain(levels),tutorials:plain(tutorials),packs:[older,plain(pack)]},()=>{HexAttempts.createCatalog(levels,[older,pack],Engine);return {currentVersion:pack.levelDataVersion,versions:[older.levelDataVersion,pack.levelDataVersion]};},'archived-version-loader');versions++;
const multi=HexAttempts.createCatalog(levels,[older,pack],Engine);
for(const base of levels)for(const version of [older.levelDataVersion,pack.levelDataVersion]){add({operation:'start',levelId:base.id,options:{levelDataVersion:version,selectionSeed:73,attemptSerial:8}},()=>multi.start(base.id,{levelDataVersion:version,selectionSeed:73,attemptSerial:8}),'archived-selection-'+base.id+'-'+version);versions++;}
for(const [name,data]of [['no-pack',null],['empty-packs',[]]])add({operation:'create',levels:plain(levels),packs:data},()=>({currentVersion:HexAttempts.createCatalog(levels,data,Engine).currentVersion,versions:[]}),'legacy-only-'+name);
function dotnet(){for(const command of [...new Set([process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean))]){const r=spawnSync(command,['--version'],{cwd:root,encoding:'utf8',timeout:15000});if(r.status===0&&/^8\./.test(r.stdout.trim()))return {command,version:r.stdout.trim()};}throw Error('C# catalog parity requires actual .NET8; no JavaScript fallback exists.');}
function run(command,args,options={}){const r=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:128*1024*1024,timeout:240000,...options});if(r.error)throw r.error;if(r.status!==0)throw Error('Catalog parity execution failed:\n'+r.stdout+'\n'+r.stderr);return r.stdout;}
let temp;
try{
 const sdk=dotnet();temp=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-catalog-'));const output=path.join(temp,'bin'),env={...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_NOLOGO:'1'};
 run(sdk.command,['build',path.join(root,'unity/CatalogParityHarness/Hexrota.CatalogParity.csproj'),'--configuration','Release','--nologo','--verbosity','quiet','--output',output,'-p:BaseIntermediateOutputPath='+path.join(temp,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(root,'unity/CatalogParityHarness/NuGet.Config')],{env});
 const lines=run(sdk.command,[path.join(output,'Hexrota.CatalogParity.dll')],{env,input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n'}).trim().split(/\r?\n/).map(s=>JSON.parse(s));assert.equal(lines.length,expectations.length);
 for(const [i,{expected,name}]of expectations.entries()){let actual=lines[i];if(expected.error&&expected.code===null){actual={error:actual.error,code:actual.code};}assert.deepEqual(actual,expected,'catalog full JSON parity: '+name);}
 assert.equal(certifiedRoutes,80);assert.equal(pack.levels.reduce((n,g)=>n+g.variants.length,0),40);
 console.log(`C# catalog parity passed: ${expectations.length} complete JSON comparisons; ${selections} exact selections, ${resumes} exact resumes, ${envelopes} checkpoint envelopes, ${certifiedRoutes} full certified routes/${certifiedSwaps} replayed swaps, ${tutorialCases} tutorial ID/metadata/restores, ${versions} archived-version checks, ${rejections} rejected catalog/identity/replay inputs. .NET SDK ${sdk.version}, C#7.3; numeric/string IDs, publication ordering, isolated RNG and copy boundaries preserved.`);
}catch(error){console.error(error.stack||error);process.exitCode=1;}finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
