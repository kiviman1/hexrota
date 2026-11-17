/* Actual .NET 8 / C# 7.3 parity through the canonical gameplay harness. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
require('./dist/engine.js');const Engine=globalThis.HexMatch,levels=require('./data/obstacle-levels-v1.json').levels;
const copy=x=>JSON.parse(JSON.stringify(x)),requests=[],expected=[],labels=[],observed=g=>copy({snapshot:g.snapshot(),status:g.status,covered:g.covered,remainingLayers:g.remainingLayers});
let swaps=0,resumes=0,replays=0,clones=0,rejects=0;
function execute(request){
 if(request.operation==='construct'){try{return observed(new Engine(request.level));}catch{return {error:true};}}
 let g=new Engine(request.level);const rows=[{after:observed(g),legalMoves:copy(g.legalMoves())}];
 for(const s of request.steps){let result=null,error=false;
  try{
   if(s.op==='swap'){result=copy(g.swap(...s.pair));if(result.ok)swaps++;}
   else if(s.op==='damage')result=copy(g._damageBlockers(s.matched));
   else if(s.op==='gravity')result=copy(g._gravity(s.matched));
   else if(s.op==='refill')result=copy(g._fillVacancies());
   else if(s.op==='ensure')result=g._ensurePlayable();
   else if(s.op==='stable')result=g._stableBoard();
   else if(s.op==='rng')result=g._random();
   else if(s.op==='restore'){g._restore(copy(s.snapshot));result=true;resumes++;}
   else if(s.op==='resume'){g=new Engine(request.level,g.snapshot());result=true;resumes++;}
   else if(s.op==='replay'){const replay=new Engine(request.level);for(const pair of g.history)assert(replay.swap(...pair).ok);g=replay;result=true;replays++;}
   else if(s.op==='clone'){const c=g.clone();result=observed(c);if(c.blockerHp.length)c.blockerHp[0]=-100;if(c.regionOpen.length)c.regionOpen[0]=!c.regionOpen[0];if(c.cellOpen?.length)c.cellOpen[0]=!c.cellOpen[0];clones++;}
   else if(s.op==='inject'){for(const k of ['values','layers','blockerHp','regionOpen','cellOpen','score','movesLeft'])if(k in s)g[k]=copy(s[k]);result=true;}
   else throw Error('Unknown obstacle step');
  }catch{error=true;rejects++;}
  rows.push({error,result,after:observed(g),legalMoves:copy(g.legalMoves())});
 }
 return rows;
}
function add(label,level,steps){const r=copy({operation:'obstacle',level,steps});requests.push(r);expected.push(execute(r));labels.push(label);}
function construct(label,level){const r=copy({operation:'construct',level});requests.push(r);expected.push(execute(r));labels.push(label);}
for(const level of levels)for(const [i,route]of level.solutions.entries()){
 const steps=[];const probe=new Engine(level);
 for(const [a,b]of [[-1,0],[0,level.cells.length],...probe.topology.pairs.filter(([a,b])=>!probe.isPlayable(a)||!probe.isPlayable(b))])steps.push({op:'swap',pair:[a,b]});
 for(const pair of route){probe.swap(...pair);steps.push({op:'swap',pair},{op:'clone'},{op:'resume'},{op:'replay'});const bad=probe.snapshot();bad.rngState=(bad.rngState+1)>>>0||1;steps.push({op:'restore',snapshot:bad});}
 steps.push({op:'swap',pair:[0,1]});add(level.id+' certified '+i,level,steps);
}
for(const level of levels)for(let trial=0;trial<12;trial++){
 const g=new Engine(level),steps=[];let seed=trial+1;
 while(g.status==='playing'){const legal=g.legalMoves();assert(legal.length);seed=(Math.imul(seed,1664525)+1013904223)>>>0;const pair=copy(legal[seed%legal.length]);g.swap(...pair);steps.push({op:'swap',pair});}
 steps.push({op:'resume'},{op:'clone'},{op:'replay'});add(level.id+' legal alternatives '+trial,level,steps);
}
const a=copy(levels[0]),b=copy(levels[1]),c=copy(levels[2]);
let g=new Engine(a),neighbors=g.neighbors[a.obstacles.blockers[0].cell];
const hp2=copy(a);hp2.obstacles.blockers[0].hp=2;
const chippedPair=new Engine(hp2).legalMoves().find(pair=>{const probe=new Engine(hp2);probe.swap(...pair);return probe.blockerHp[0]===1;});assert(chippedPair);
add('actual HP2 chipped checkpoint resumes replays and clones',hp2,[{op:'swap',pair:chippedPair},{op:'resume'},{op:'replay'},{op:'clone'}]);
const short=copy(a);short.moves=1;short.target=100000;
add('actual terminal loss checkpoint resumes replays and clones',short,[{op:'swap',pair:new Engine(short).legalMoves()[0]},{op:'resume'},{op:'replay'},{op:'clone'},{op:'swap',pair:short.solutions[0][0]}]);
add('two separate hits with multi-contact deduplication',hp2,[{op:'damage',matched:[neighbors[0],neighbors[1],neighbors[0]]},{op:'damage',matched:[neighbors[0]]},{op:'gravity',matched:[]},{op:'rng'}]);
add('all required boxes and region opening',b,b.obstacles.blockers.map(box=>({op:'damage',matched:new Engine(b).neighbors[box.cell].filter(i=>new Engine(b).isPlayable(i))})).concat([{op:'gravity',matched:[]}]));
add('hidden box immune before region exposure',c,[{op:'damage',matched:new Engine(c).neighbors[c.obstacles.blockers[2].cell]}]);
const at=(l,q,r)=>l.cells.findIndex(c=>c.q===q&&c.r===r);
add('healthy box stops survivors',a,[{op:'inject',regionOpen:[true]},{op:'gravity',matched:[at(a,0,2)]}]);
add('breaking contiguous barrier merges segments',a,[{op:'damage',matched:neighbors},{op:'gravity',matched:[]}]);
const cells=a.cells.filter(cell=>cell.q!==0||cell.r!==0),voidLevel={...a,cells,initial:cells.map((cell,i)=>i%3+1),obstacles:{version:'obstacles-v1',blockers:[],regions:[]}};
add('void splits fall column',voidLevel,[{op:'gravity',matched:[at(voidLevel,0,2)]}]);
add('dead board recovery with inactive cells',c,[{op:'inject',values:new Engine(c).values.map((v,i)=>new Engine(c).isPlayable(i)?1:null)},{op:'ensure'},{op:'clone'}]);
add('bounded stable regeneration on obstacle geometry',c,[{op:'stable'},{op:'ensure'}]);
add('blocked targets cannot win early',a,[{op:'inject',layers:a.cells.map(()=>0),score:a.target},{op:'inject',blockerHp:[0]},{op:'inject',regionOpen:[true]}]);
add('moves exhaustion loses',a,[{op:'inject',movesLeft:0},{op:'swap',pair:new Engine(a).legalMoves()[0]}]);
for(const level of levels){const game=new Engine(level);game.swap(...level.solutions[0][0]);const snapshot=game.snapshot();
 for(const key of Object.keys(snapshot)){const bad=copy(snapshot);delete bad[key];add('missing snapshot '+level.id+' '+key,level,[{op:'restore',snapshot:bad}]);}
 for(const [key,value]of [['version',4],['rulesVersion','classic-v4'],['obstacleVersion','obstacles-v2'],['rngState',0],['values',snapshot.values.map(()=>null)],['blockerHp',snapshot.blockerHp.map(()=>3)],['regionOpen',snapshot.regionOpen.map(()=>false)],['history',[[0,0]]]]){const bad={...copy(snapshot),[key]:value};if(JSON.stringify(bad)===JSON.stringify(snapshot))continue;add('forged snapshot '+level.id+' '+key,level,[{op:'restore',snapshot:bad}]);}
}
const mutations=[l=>l.cells[1]={...l.cells[0]},l=>l.cells[0].q=.5,l=>l.initial[0]=null,l=>l.initial[l.obstacles.blockers[0].cell]=1,l=>l.obstacles.blockers.push({...l.obstacles.blockers[0],id:'overlap'}),l=>l.obstacles.blockers[0].hp=3,l=>l.obstacles.blockers[0].cell=-1,l=>l.obstacles.blockers[0].id='',l=>l.obstacles.regions[0].requires=['unknown'],l=>l.obstacles.regions[0].requires=['a-gate','a-gate'],l=>l.obstacles.regions[0].cells.push(999),l=>l.obstacles.regions.push({...l.obstacles.regions[0],id:'overlap'}),l=>l.obstacles.regions[0].cells.push(l.obstacles.blockers[0].cell),l=>l.cells[l.obstacles.blockers[0].cell]={q:1000,r:1000,layers:1},l=>l.obstacles.blockers[0].regionId='unknown',l=>l.obstacles.version='obstacles-v2',l=>l.rulesVersion='classic-v4',l=>l.rulesVersion='other',l=>l.obstacles.blockers[0].id='invalid space',l=>delete l.obstacles.blockers[0].cell,l=>l.obstacles.blockers[0].required=null,l=>l.obstacles.regions[0].required=null];
mutations.forEach((mutate,i)=>{const bad=copy(a);mutate(bad);construct('invalid level '+i,bad);assert.equal(expected.at(-1).error,true);});
for(const kind of ['null','omitted','zero']){const level=copy(a);if(kind==='null')level.cells[0].layers=null;else if(kind==='omitted')delete level.cells[0].layers;else level.cells[0].layers=0;construct('v5 '+kind+' ground layers',level);}
for(const level of levels)construct('exact valid initial '+level.id,level);
// Physical source-fed L6 uses both typed DTO and portable CatalogWire loaders.
const flowLevel=copy(require('./data/campaign-flow-levels-v1.json').levels[0]);
function flowAdd(label,steps){for(const wire of [false,true]){const r=copy({operation:'obstacle',wire,level:flowLevel,steps});requests.push(r);expected.push(execute(r));labels.push('column flow '+label+(wire?' portable wire':' typed'));}}
function flowConstruct(label,level){for(const wire of [false,true]){const r=copy({operation:'construct',wire,level});requests.push(r);expected.push(execute(r));labels.push('column flow '+label+(wire?' portable wire':' typed'));}}
for(const [i,route]of flowLevel.solutions.entries()){
 const probe=new Engine(flowLevel),steps=[];
 for(const pair of probe.topology.pairs.filter(([a,b])=>!probe.isPlayable(a)||!probe.isPlayable(b)))steps.push({op:'swap',pair});
 for(const pair of route){assert(probe.swap(...pair).ok);const bad=probe.snapshot();bad.cellOpen[0]=!bad.cellOpen[0];steps.push({op:'swap',pair},{op:'clone'},{op:'resume'},{op:'replay'},{op:'restore',snapshot:bad});}
 assert.equal(probe.status,'won');flowAdd('certified route '+i,steps);
}
for(let trial=0;trial<6;trial++){
 const probe=new Engine(flowLevel),steps=[];let seed=trial+1;
 while(probe.status==='playing'){const legal=probe.legalMoves();assert(legal.length);seed=(Math.imul(seed,1664525)+1013904223)>>>0;const pair=copy(legal[seed%legal.length]);assert(probe.swap(...pair).ok);steps.push({op:'swap',pair});}
 steps.push({op:'resume'},{op:'clone'},{op:'replay'});flowAdd('alternative legal run '+trial,steps);
}
const flowAt=(q,r)=>at(flowLevel,q,r),left=flowAt(-2,-1),center=flowAt(0,-1);
flowAdd('one hole opens only same q and leaves remote lanes closed',[{op:'damage',matched:[left]},{op:'gravity',matched:[]},{op:'clone'}]);
flowAdd('HP2 first hit remains closed and second opens its physical lane',[{op:'damage',matched:[center,center]},{op:'gravity',matched:[]},{op:'damage',matched:[center]},{op:'gravity',matched:[]}]);
flowAdd('descriptive region reports complete only when all physical lanes open',flowLevel.obstacles.blockers.flatMap(box=>Array.from({length:box.hp},()=>({op:'damage',matched:[flowAt(flowLevel.cells[box.cell].q,-1)]}))).concat([{op:'gravity',matched:[]} ]));
flowAdd('recovery preserves closed lanes and RNG parity',[{op:'inject',values:new Engine(flowLevel).values.map((v,i)=>new Engine(flowLevel).isPlayable(i)?1:null)},{op:'ensure'},{op:'clone'}]);
flowAdd('stable generation honors physical source mask',[{op:'stable'},{op:'ensure'}]);
const flowProbe=new Engine(flowLevel);flowProbe.swap(...flowLevel.solutions[0][0]);
for(const mutate of [s=>delete s.cellOpen,s=>s.cellOpen[0]=!s.cellOpen[0],s=>s.cellOpen.pop(),s=>s.cellOpen[0]=1,s=>s.regionOpen[0]=!s.regionOpen[0],s=>s.values[0]=null]){const bad=copy(flowProbe.snapshot());mutate(bad);flowAdd('forged cell flow snapshot',[{op:'restore',snapshot:bad}]);}
const flowMutations=[l=>l.obstacles.sources.push(l.obstacles.sources[0]),l=>l.obstacles.sources[0]=-1,l=>l.obstacles.sources[0]=.5,l=>l.obstacles.sources[0]=l.cells.length,l=>l.obstacles.sources=[],l=>l.obstacles.sources=null,l=>delete l.obstacles.sources,l=>l.obstacles.regions[0].requires=['l6-crate-0'],l=>l.obstacles.activation='column-flow-v2',l=>l.obstacles.activation=null,l=>l.obstacles.blockers[0].regionId=l.obstacles.regions[0].id,l=>l.obstacles.sources[0]=flowAt(-2,1),l=>l.obstacles.sources[0]=flowAt(-1,-1),l=>l.initial[flowAt(2,1)]=1,l=>l.cells[flowAt(-2,1)].r=10];
flowMutations.forEach((mutate,i)=>{const bad=copy(flowLevel);mutate(bad);flowConstruct('invalid source geometry '+i,bad);assert.equal(expected.at(-1).error,true);});
flowConstruct('exact published L6',flowLevel);
for(const kind of ['null','omitted','zero']){const level=copy(flowLevel);if(kind==='null')level.cells[0].layers=null;else if(kind==='omitted')delete level.cells[0].layers;else level.cells[0].layers=0;flowConstruct(kind+' ground defaults',level);}
let temp;try{
 const dotnet=[process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean).find(bin=>{const r=spawnSync(bin,['--version'],{encoding:'utf8'});return r.status===0&&/^8\./.test(r.stdout.trim());});assert(dotnet,'actual .NET 8 is required');
 const run=(args,options={})=>{const r=spawnSync(dotnet,args,{cwd:__dirname,encoding:'utf8',timeout:180000,maxBuffer:128*1024*1024,...options});if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr);return r.stdout;};
 temp=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-obstacles-parity-'));const output=path.join(temp,'bin');
 run(['build','unity/GameplayParityHarness/Hexrota.GameplayParity.csproj','--configuration','Release','--nologo','--verbosity','quiet','--output',output,'-p:BaseIntermediateOutputPath='+path.join(temp,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(__dirname,'unity/GameplayParityHarness/NuGet.Config')]);
 const rows=run([path.join(output,'Hexrota.GameplayParity.dll')],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n'}).trim().split(/\r?\n/).map(line=>JSON.parse(line));
 assert.equal(rows.length,requests.length);for(let i=0;i<rows.length;i++){if(expected[i].error)assert.equal(rows[i].error,true,labels[i]);else assert.deepEqual(rows[i],expected[i],labels[i]);}
 console.log(`Obstacles JS/C# parity passed: ${requests.length} scenarios; 6 gated certified routes + 2 flow routes in typed/portable loaders + 48 alternative legal runs; ${swaps} valid swaps, ${resumes} resumes, ${replays} replays, ${clones} clone checks, ${rejects} rejected snapshot attempts; full damage/unlock/fall/refill/RNG/status JSON. Actual .NET 8, C# 7.3.`);
}catch(error){console.error(error.stack||error);process.exitCode=1;}finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
