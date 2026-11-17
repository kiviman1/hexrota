/* Canonical classic-v6 mechanics compiled as C#7.3 with actual .NET8. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
require('./dist/engine.js');const Engine=globalThis.HexMatch,levels=require('./data/material-alpha-levels-v1.json').levels,copy=x=>JSON.parse(JSON.stringify(x));
const requests=[],expected=[],labels=[],observed=g=>copy({snapshot:g.snapshot(),status:g.status,covered:g.covered,remainingLayers:g.remainingLayers});
let swaps=0,waves=0,events=0,resumes=0,replays=0,clones=0,saveRejects=0,levelRejects=0,prefixes=0;
function execute(request){
 if(request.operation==='construct'){try{return observed(new Engine(request.level));}catch{levelRejects++;return{error:true};}}
 let g=new Engine(request.level);const rows=[{after:observed(g),legalMoves:copy(g.legalMoves())}];
 for(const s of request.steps){let result=null,error=false;try{
  if(s.op==='swap'){result=copy(g.swap(...s.pair));if(result.ok){swaps++;waves+=result.frames.length;events+=result.frames.reduce((n,f)=>n+f.materialEvents.length,0);}}
  else if(s.op==='resume'){g=new Engine(request.level,g.snapshot());result=true;resumes++;}
  else if(s.op==='clone'){const c=g.clone();result=observed(c);if(c.materialCounts.length)c.materialCounts[0]=-99;if(c.collectedSources.length)c.collectedSources[0]=!c.collectedSources[0];if(c.blockerHp.length)c.blockerHp[0]=-99;if(c.regionOpen.length)c.regionOpen[0]=!c.regionOpen[0];if(c.cellOpen?.length)c.cellOpen[0]=!c.cellOpen[0];clones++;}
  else if(s.op==='replay'){const next=new Engine(request.level);for(const p of g.history)assert(next.swap(...p).ok);g=next;result=true;replays++;}
  else if(s.op==='restore'){g._restore(copy(s.snapshot));result=true;resumes++;}
  else if(s.op==='inject'){for(const k of ['values','layers','blockerHp','regionOpen','cellOpen','materialCounts','collectedSources','score','movesLeft'])if(k in s)g[k]=copy(s[k]);result=true;}
  else if(s.op==='ensure')result=g._ensurePlayable();
  else if(s.op==='stable')result=g._stableBoard();
  else if(s.op==='rng')result=g._random();
  else throw Error('Unknown test step');
 }catch{error=true;saveRejects++;}
 rows.push({error,result,after:observed(g),legalMoves:copy(g.legalMoves())});}
 return rows;
}
function add(name,level,steps,wire=false){const request=copy({operation:'obstacle',wire,level,steps});requests.push(request);expected.push(execute(request));labels.push(name+(wire?' portable':' canonical host'));}
function construct(name,level){const request=copy({operation:'construct',wire:true,level});requests.push(request);expected.push(execute(request));labels.push(name);}
function route(level,path,{certified=false,win=true}={}){const g=new Engine(level),steps=[];for(const pair of path){if(g.status!=='playing')break;const result=g.swap(...pair);assert(result.ok);steps.push({op:'swap',pair},{op:'clone'},{op:'resume'},{op:'replay'});if(certified)prefixes++;}if(win)assert.equal(g.status,'won');if(certified)assert.equal(g.history.length,path.length);return steps;}
for(const level of levels)for(const [i,path]of level.solutions.entries()){
 const fresh=new Engine(level),invalids=fresh.topology.pairs.filter(([a,b])=>!fresh.isPlayable(a)||!fresh.isPlayable(b)).slice(0,12).map(pair=>({op:'swap',pair}));
 add('alpha '+level.id+' certified '+i,level,[...invalids,...route(level,path,{certified:true}),{op:'swap',pair:path[0]}],i%2===1);
}
for(const level of levels)for(let trial=0;trial<8;trial++){
 const g=new Engine(level),steps=[];let choice=trial+1;
 while(g.status==='playing'){const legal=g.legalMoves();assert(legal.length);choice=(Math.imul(choice,1664525)+1013904223)>>>0;const pair=copy(legal[choice%legal.length]);assert(g.swap(...pair).ok);steps.push({op:'swap',pair});}
 steps.push({op:'clone'},{op:'resume'},{op:'replay'});add('alternative '+level.id+' '+trial,level,steps,trial%2===1);
}
for(const level of levels){
 const g=new Engine(level);assert(g.swap(...level.solutions[0][0]).ok);const snapshot=g.snapshot();
 for(const key of Object.keys(snapshot)){const bad=copy(snapshot);delete bad[key];add('missing v6 snapshot '+level.id+' '+key,level,[{op:'restore',snapshot:bad}],true);}
 for(const [key,value]of [['materialCounts',snapshot.materialCounts.map(v=>v+1)],['materialCounts',snapshot.materialCounts.map(()=>-1)],['materialCounts',snapshot.materialCounts.map(()=>2147483648)],['collectedSources',snapshot.collectedSources.map(v=>!v)],['collectedSources',snapshot.collectedSources.map(()=>1)],['materialVersion','materials-v2'],['objectiveVersion','objectives-v2'],['status',snapshot.status==='won'?'playing':'won'],['status','invalid'],['rulesVersion','classic-v5'],['version',5],['rngState',0],['history',[[0,0]]],['extraMaterial',true]]){const bad={...copy(snapshot),[key]:value};add('forged v6 '+level.id+' '+key,level,[{op:'restore',snapshot:bad}],true);}
 const values=new Engine(level).values.map((v,i)=>new Engine(level).isPlayable(i)?1:null);
 add('recovery cannot collect '+level.id,level,[{op:'inject',values},{op:'ensure'},{op:'clone'},{op:'stable'}],true);
 const lost=copy(level);lost.moves=1;add('persisted terminal '+level.id,lost,[{op:'swap',pair:level.solutions[0][0]},{op:'clone'},{op:'resume'},{op:'replay'},{op:'swap',pair:level.solutions[0][0]}],true);
}
const [wood,nail,mixed]=levels.map(copy);
add('HP2 damage no grant then restored break one wood',wood,[{op:'swap',pair:[1,8]},{op:'resume'},{op:'clone'},{op:'swap',pair:[1,7]},{op:'resume'},{op:'replay'}],true);
for(const snapshot of [null,false,0,[],{},'invalid'])add('v6 malformed snapshot '+JSON.stringify(snapshot),wood,[{op:'restore',snapshot}],true);
const reversed=copy(mixed);reversed.materials.definitions.reverse();reversed.materials.sources.reverse();reversed.objectives.materials.reverse();add('author order and definition ordering',reversed,route(reversed,reversed.solutions[0]),true);
for(const sourceLevel of [wood,nail]){const extra=copy(sourceLevel),source=extra.materials.sources[0];extra.materials.sources.push({...source,id:'extra-same-origin',quantity:2});extra.objectives.materials.find(g=>g.materialId===source.materialId).quantity+=2;add('shared '+source.kind+' origin distinct sources',extra,route(extra,extra.solutions[0]),true);}
const disabled=copy(wood);disabled.target=0;disabled.targetMode='exact';add('disabled exact score never loses material play',disabled,route(disabled,disabled.solutions[0]),true);
const overshoot=copy(wood);overshoot.target=0;overshoot.targetMode='exact';overshoot.objectives.score=true;add('enabled exact score overshoot persists loss',overshoot,[{op:'swap',pair:overshoot.solutions[0][0]},{op:'clone'},{op:'resume'},{op:'replay'}],true);
const scoreGround=copy(mixed);scoreGround.materials.definitions=[];scoreGround.materials.sources=[];scoreGround.objectives.materials=[];add('empty material definitions retain score ground',scoreGround,route(scoreGround,scoreGround.solutions[0]),true);
const groundOnly=copy(scoreGround);groundOnly.objectives.score=false;groundOnly.target=0;groundOnly.targetMode='exact';add('ground only ignores score overshoot',groundOnly,route(groundOnly,groundOnly.solutions[0]),true);
const scoreOnly=copy(scoreGround);scoreOnly.objectives.ground=false;scoreOnly.target=1;add('score only with existing physical prerequisites',scoreOnly,route(scoreOnly,scoreOnly.solutions[0]),true);
const maximum=copy(nail);maximum.materials.sources=[{...maximum.materials.sources[0],quantity:2147483647}];maximum.objectives.materials[0].quantity=2147483647;add('full Int32 material count boundary',maximum,route(maximum,maximum.solutions[0]),true);
const twoMaximum=copy(maximum);twoMaximum.materials.definitions.push({id:'other'});twoMaximum.materials.sources.push({...twoMaximum.materials.sources[0],id:'other-max',materialId:'other'});twoMaximum.objectives.materials.push({materialId:'other',quantity:2147483647});add('independent Int32 material totals',twoMaximum,route(twoMaximum,twoMaximum.solutions[0]),true);
// Gated v6 reuses the existing geometry and opening rules as well as flow v6.
for(const base of require('./data/obstacle-levels-v1.json').levels){const level={...copy(base),rulesVersion:'classic-v6',materials:{version:'materials-v1',definitions:[{id:'wood'},{id:'nail'}],sources:base.obstacles.blockers.map((b,i)=>({id:'box-'+i,kind:'crate-break',materialId:'wood',quantity:1,cell:b.cell,blockerId:b.id}))},objectives:{version:'objectives-v1',score:true,ground:true,materials:[{materialId:'wood',quantity:base.obstacles.blockers.length}]}};add('gated v6 '+base.id,level,route(level,level.solutions[0]),true);}
// Shape/type/reference rejection is exercised through the real portable host.
const badMaterials=[l=>delete l.materials,l=>l.materials=null,l=>l.materials.version='materials-v2',l=>l.materials.extra=true,l=>l.materials.definitions[0].id='',l=>l.materials.definitions[0].id='bad space',l=>l.materials.definitions[0].extra=true,l=>l.materials.definitions.push({...l.materials.definitions[0]}),l=>l.materials.sources[0].id='',l=>l.materials.sources.push({...l.materials.sources[0]}),l=>l.materials.sources[0].materialId='unknown',l=>l.materials.sources[0].kind='score',l=>l.materials.sources[0].quantity=0,l=>l.materials.sources[0].quantity=-1,l=>l.materials.sources[0].quantity=.5,l=>l.materials.sources[0].quantity=2147483648,l=>l.materials.sources[0].quantity=2147483647,l=>l.materials.sources[0].cell=-1,l=>l.materials.sources[0].cell=l.cells.length,l=>delete l.materials.sources[0].cell,l=>delete l.materials.sources[0].blockerId,l=>l.materials.sources[0].blockerId='unknown',l=>l.materials.sources[0].cell=l.obstacles.blockers.find(b=>b.id!==l.materials.sources[0].blockerId).cell,l=>l.materials.sources[0].extra=true,l=>l.objectives.version='objectives-v2',l=>delete l.objectives,l=>delete l.objectives.score,l=>delete l.objectives.ground,l=>l.objectives.score=1,l=>l.objectives.ground='false',l=>l.objectives.materials[0].materialId='unknown',l=>l.objectives.materials[0].quantity=0,l=>l.objectives.materials[0].quantity=.5,l=>l.objectives.materials[0].quantity=99999,l=>l.objectives.materials[0].extra=true,l=>l.objectives.materials.push({...l.objectives.materials[0]}),l=>l.objectives.extra=true,l=>{l.objectives.score=false;l.objectives.ground=false;l.objectives.materials=[];}];
badMaterials.forEach((mutate,i)=>{const bad=copy(wood);mutate(bad);construct('invalid material or objective '+i,bad);assert.equal(expected.at(-1).error,true,'invalid fixture '+i);});
for(const mutate of [l=>l.materials.sources[0].blockerId=l.obstacles.blockers[0].id,l=>l.materials.sources[0].cell=l.obstacles.blockers[0].cell]){const bad=copy(nail);mutate(bad);construct('invalid matched-cell box claim',bad);assert.equal(expected.at(-1).error,true);}
const isolated=copy(wood),isolatedIndex=isolated.cells.length;isolated.cells.push({q:1000,r:1000,layers:1});isolated.initial.push(1);isolated.obstacles.sources.push(isolatedIndex);isolated.materials.sources.push({id:'unmatchable-token',kind:'matched-cell',materialId:'wood',quantity:1,cell:isolatedIndex});isolated.objectives.materials[0].quantity++;construct('real but geometrically unmatchable material cell',isolated);assert.equal(expected.at(-1).error,true);
for(const level of levels)construct('exact accepted v6 initial '+level.id,level);
let temp;try{
 const dotnet=[process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean).find(bin=>{const r=spawnSync(bin,['--version'],{encoding:'utf8'});return r.status===0&&/^8\./.test(r.stdout.trim());});assert(dotnet,'actual .NET8 is required');
 const run=(args,options={})=>{const r=spawnSync(dotnet,args,{cwd:__dirname,encoding:'utf8',timeout:240000,maxBuffer:256*1024*1024,...options});if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr);return r.stdout;};temp=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-materials-parity-'));const output=path.join(temp,'bin');
 run(['build','unity/GameplayParityHarness/Hexrota.GameplayParity.csproj','--configuration','Release','--nologo','--verbosity','quiet','--output',output,'-p:BaseIntermediateOutputPath='+path.join(temp,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(__dirname,'unity/GameplayParityHarness/NuGet.Config')]);
 const actual=run([path.join(output,'Hexrota.GameplayParity.dll')],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n'}).trim().split(/\r?\n/).map(JSON.parse);assert.equal(actual.length,expected.length);
 for(let i=0;i<actual.length;i++){if(expected[i].error)assert.equal(actual[i].error,true,labels[i]);else assert.deepEqual(actual[i],expected[i],labels[i]);}
 console.log(`Material JS/C# parity passed: ${requests.length} scenarios; 6 certified routes/${prefixes} prefixes + 24 alternative legal runs; ${swaps} valid swaps/${waves} waves/${events} material events; ${resumes} exact resumes, ${replays} replays, ${clones} independent clones; ${saveRejects} rejected checkpoints, ${levelRejects} rejected definitions/objectives. Actual .NET8/C#7.3; event order, once-only grants, objectives, RNG, geometry and status agree.`);
}catch(error){console.error(error.stack||error);process.exitCode=1;}finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
