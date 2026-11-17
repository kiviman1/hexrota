/* Actual .NET8/C#7.3 parity for boards within a 9x9 hex canvas and versioned flow archives. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=__dirname,copy=v=>JSON.parse(JSON.stringify(v)),context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js','variants-data.js','attempts.js','campaign-flow.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
const W=context.window,Engine=W.HexMatch,base=copy(W.HEX_LEVELS),pack=copy(W.HEX_VARIANTS),archived=copy(require('./data/campaign-flow-levels-v1.json').levels),levels=copy(require('./data/campaign-flow-levels-v2.json').levels),overrides=[...archived,...levels];
const classic=W.HexAttempts.createCatalog(base,pack,Engine),flow=W.HexCampaignFlow.createCatalog(classic,overrides,Engine);
const observed=g=>copy({snapshot:g.snapshot(),status:g.status,covered:g.covered,remainingLayers:g.remainingLayers}),gameRequests=[],gameExpected=[],gameLabels=[],catalogRequests=[],catalogExpected=[],catalogLabels=[];
let swaps=0,waves=0,resumes=0,replays=0,clones=0,rejected=0,winRoutes=0,catalogPrefixes=0,archivePrefixes=0;
function executeGame(request){
 let g=new Engine(request.level);const rows=[{after:observed(g),legalMoves:copy(g.legalMoves())}];
 for(const s of request.steps){let result=null,error=false;try{
  if(s.op==='swap'){result=copy(g.swap(...s.pair));if(result.ok){swaps++;waves+=result.frames.length;}}
  else if(s.op==='resume'){g=new Engine(request.level,g.snapshot());result=true;resumes++;}
  else if(s.op==='clone'){const c=g.clone();result=observed(c);c.blockerHp[0]=-99;c.cellOpen[0]=!c.cellOpen[0];if(c.regionOpen.length)c.regionOpen[0]=!c.regionOpen[0];clones++;}
  else if(s.op==='replay'){const next=new Engine(request.level);for(const pair of g.history)assert(next.swap(...pair).ok);g=next;result=true;replays++;}
  else if(s.op==='restore'){g._restore(copy(s.snapshot));result=true;resumes++;}
  else if(s.op==='inject'){for(const k of ['values','layers','blockerHp','regionOpen','cellOpen','score','movesLeft'])if(k in s)g[k]=copy(s[k]);result=true;}
  else if(s.op==='ensure')result=g._ensurePlayable();
  else if(s.op==='stable')result=g._stableBoard();
  else throw Error('Unknown native test step');
 }catch{error=true;rejected++;}
 rows.push({error,result,after:observed(g),legalMoves:copy(g.legalMoves())});}
 return rows;
}
function addGame(label,level,steps,wire=false){const request=copy({operation:'obstacle',level,steps,wire});gameRequests.push(request);gameExpected.push(executeGame(request));gameLabels.push(label+(wire?' portable':' typed'));}
const catalogObserved=x=>copy({metadata:x.metadata,level:x.level,snapshot:x.game.snapshot(),legacy:x.legacy});
function addCatalog(label,request,fn){let expected;try{expected=copy(fn());}catch{expected={error:true};rejected++;}catalogRequests.push(copy(request));catalogExpected.push(expected);catalogLabels.push(label);}
addCatalog('initialize both authored archives',{operation:'initialize',levels:base,packs:pack,overrides},()=>({currentVersion:classic.currentVersion,versions:[classic.currentVersion]}));
assert.deepEqual(levels.map(l=>l.id),[6,7,8,9,10]);
for(const level of levels){
 assert(level.cells.length>0&&level.cells.length<=81);assert(level.boardSize);assert.equal(level.rulesVersion,'classic-v5');assert.equal(level.levelDataVersion,'campaign-flow-v2');assert.equal(level.variantId,'flow-v2');assert(level.solutions.length>=2);
 const coords=new Set(level.cells.map(c=>c.q+','+c.r));assert.equal(coords.size,level.cells.length);
 for(const cell of level.cells){const row=cell.r+4+Math.floor(cell.q/2);assert(cell.q>=-4&&cell.q<=4&&row>=0&&row<9);}
 addCatalog('latest default L'+level.id,{operation:'start',levelId:level.id,options:{selectionSeed:73,attemptSerial:2}},()=>flow.start(level.id,{selectionSeed:73,attemptSerial:2}));
 addCatalog('latest list L'+level.id,{operation:'list',levelId:level.id},()=>flow.list(level.id));
 addCatalog('explicit resolve L'+level.id,{operation:'resolve',levelId:level.id,variantId:'flow-v2',version:'campaign-flow-v2'},()=>flow.resolveLevel(level.id,'flow-v2','campaign-flow-v2'));
 for(const [routeIndex,route]of level.solutions.entries()){
  const probe=new Engine(level),steps=[];
  for(const pair of probe.topology.pairs.filter(([a,b])=>!probe.isPlayable(a)||!probe.isPlayable(b)).slice(0,10))steps.push({op:'swap',pair});
  for(const pair of route){const result=probe.swap(...pair);assert(result.ok);for(const f of result.frames){assert.equal(f.cellOpen.length,level.cells.length);for(let i=0;i<level.cells.length;i++)if(!f.cellOpen[i])assert.equal(f.after[i],null);for(const fall of f.falls)if(!fall.spawn){const from=level.cells[fall.from],to=level.cells[fall.to];assert.equal(from.q,to.q);for(let r=from.r;r<=to.r;r++)assert(f.cellOpen[level.cells.findIndex(c=>c.q===from.q&&c.r===r)]);}}steps.push({op:'swap',pair},{op:'clone'},{op:'resume'},{op:'replay'});}
  assert.equal(probe.status,'won');assert.equal(probe.covered,level.cells.length);assert(probe.cellOpen.every(Boolean));assert(probe.blockerHp.every(h=>h===0));winRoutes++;
  steps.push({op:'swap',pair:route[0]});addGame('L'+level.id+' winning route '+routeIndex,level,steps,routeIndex%2===1);
  const options={selectionSeed:73,attemptSerial:routeIndex+1},pick=flow.start(level.id,options),g=new Engine(pick.level),rows=[];
  for(const pair of route){assert(g.swap(...pair).ok);const envelope=copy(flow.checkpoint(pick.metadata,g)),restored=flow.restore(level.id,envelope);rows.push({envelope,restored:catalogObserved(restored),status:restored.game.status});catalogPrefixes++;}
  addCatalog('L'+level.id+' campaign route '+routeIndex,{operation:'route',levelId:level.id,options,route},()=>rows);
 }
 for(let trial=0;trial<2;trial++){
  const g=new Engine(level),steps=[];let seed=trial+1;
  while(g.status==='playing'){const legal=g.legalMoves();assert(legal.length);seed=(Math.imul(seed,1664525)+1013904223)>>>0;const pair=copy(legal[seed%legal.length]);assert(g.swap(...pair).ok);steps.push({op:'swap',pair});}
  steps.push({op:'resume'},{op:'clone'},{op:'replay'});addGame('L'+level.id+' alternative '+trial,level,steps,trial===1);
 }
 const fresh=new Engine(level),values=fresh.values.map((v,i)=>fresh.isPlayable(i)?1:null);
 addGame('L'+level.id+' dead board recovery',level,[{op:'inject',values},{op:'ensure'},{op:'clone'}],true);
 const pick=flow.start(level.id,{selectionSeed:0,attemptSerial:3}),g=new Engine(level);g.swap(...level.solutions[0][0]);const snapshot=g.snapshot();
 for(const mutate of [s=>s.cellOpen[0]=!s.cellOpen[0],s=>delete s.cellOpen,s=>s.blockerHp[0]=99,s=>s.values=s.values.slice(1),s=>s.rngState=0]){const bad=copy(snapshot);mutate(bad);addGame('L'+level.id+' forged variable-shape checkpoint',level,[{op:'restore',snapshot:bad}],true);}
 for(const change of [{levelDataVersion:'campaign-flow-v1'},{variantId:'flow-v1'},{levelId:String(level.id)},{attemptId:'a-'+level.id+'-3-00000000-corrupt'}]){const metadata={...pick.metadata,...change};addCatalog('L'+level.id+' forged version identity',{operation:'restore',levelId:level.id,record:snapshot,metadata},()=>catalogObserved(flow.restore(level.id,snapshot,metadata)));}
}
for(let id=1;id<=5;id++){
 const options={selectionSeed:id*73,attemptSerial:4};assert.deepEqual(copy(flow.start(id,options)),copy(classic.start(id,options)));
 addCatalog('first five stay classic L'+id,{operation:'start',levelId:id,options},()=>classic.start(id,options));
}
// Existing v1 saves resolve their authored 23-cell board after v2 becomes current.
for(const level of archived){
 addCatalog('archived v1 selectable L'+level.id,{operation:'start',levelId:level.id,options:{levelDataVersion:'campaign-flow-v1',selectionSeed:73,attemptSerial:1}},()=>flow.start(level.id,{levelDataVersion:'campaign-flow-v1',selectionSeed:73,attemptSerial:1}));
 addCatalog('archived v1 resolve L'+level.id,{operation:'resolve',levelId:level.id,variantId:'flow-v1',version:'campaign-flow-v1'},()=>flow.resolveLevel(level.id,'flow-v1','campaign-flow-v1'));
 for(const [i,route]of level.solutions.entries()){
  const options={levelDataVersion:'campaign-flow-v1',selectionSeed:73,attemptSerial:i+1},pick=flow.start(level.id,options),g=new Engine(pick.level),rows=[];
  assert.equal(g.total,23);
  for(const pair of route){assert(g.swap(...pair).ok);const envelope=copy(flow.checkpoint(pick.metadata,g)),restored=flow.restore(level.id,envelope);assert.equal(restored.game.total,23);rows.push({envelope,restored:catalogObserved(restored),status:restored.game.status});archivePrefixes++;}
  assert.equal(g.status,'won');addCatalog('archived v1 route '+i,{operation:'route',levelId:level.id,options,route},()=>rows);
 }
}
// The first physical review only overrode L6. Its classic L7-L10 attempts
// remain valid when those IDs acquire v2 shapes in a later review.
for(let id=7;id<=10;id++){
 const options={selectionSeed:73,attemptSerial:3,levelDataVersion:classic.currentVersion},pick=classic.start(id,options),game=new Engine(pick.level);game.swap(...pick.level.solutions[0][0]);const envelope=copy(classic.checkpoint(pick.metadata,game));
 addCatalog('earlier review classic start L'+id,{operation:'start',levelId:id,options},()=>flow.start(id,options));
 addCatalog('earlier review classic list L'+id,{operation:'list',levelId:id,version:classic.currentVersion},()=>flow.list(id,classic.currentVersion));
 addCatalog('earlier review classic resolve L'+id,{operation:'resolve',levelId:id,variantId:pick.metadata.variantId,version:classic.currentVersion},()=>flow.resolveLevel(id,pick.metadata.variantId,classic.currentVersion));
 addCatalog('earlier review classic restore L'+id,{operation:'restore',levelId:id,record:envelope},()=>catalogObserved(flow.restore(id,envelope)));
 addCatalog('earlier review classic legacy identity L'+id,{operation:'legacyMetadata',levelId:id},()=>flow.legacyMetadata(id));
}
addCatalog('same ID/version duplicate rejects',{operation:'create',overrides:[...overrides,copy(levels[0])]},()=>{W.HexCampaignFlow.createCatalog(classic,[...overrides,copy(levels[0])],Engine);return{ok:true};});
addCatalog('v1 plus v2 coexist',{operation:'create',overrides},()=>{W.HexCampaignFlow.createCatalog(classic,overrides,Engine);return{ok:true};});
// Source ordering cannot silently downgrade new attempts; an explicit review
// pin preserves older defaults while archived versions remain addressable.
const reverseOverrides=[...levels,...archived],reverseFlow=W.HexCampaignFlow.createCatalog(classic,reverseOverrides,Engine);
addCatalog('initialize reverse archive order',{operation:'initialize',levels:base,packs:pack,overrides:reverseOverrides},()=>({currentVersion:classic.currentVersion,versions:[classic.currentVersion]}));
for(let id=6;id<=10;id++)addCatalog('highest version ignores source ordering L'+id,{operation:'start',levelId:id,options:{}},()=>reverseFlow.start(id));
const pinned=W.HexCampaignFlow.createCatalog(classic,overrides,Engine,{currentVersion:'campaign-flow-v1'});
addCatalog('initialize pinned v1 review',{operation:'initialize',levels:base,packs:pack,overrides,currentVersion:'campaign-flow-v1'},()=>({currentVersion:classic.currentVersion,versions:[classic.currentVersion]}));
for(let id=6;id<=10;id++){
 addCatalog('v1 pin default selection L'+id,{operation:'start',levelId:id,options:{}},()=>pinned.start(id));
 addCatalog('v1 pin default list L'+id,{operation:'list',levelId:id},()=>pinned.list(id));
 addCatalog('v1 pin explicit v2 selection L'+id,{operation:'start',levelId:id,options:{levelDataVersion:'campaign-flow-v2',attemptSerial:2}},()=>pinned.start(id,{levelDataVersion:'campaign-flow-v2',attemptSerial:2}));
}
const pinnedPick=pinned.start(7,{levelDataVersion:'campaign-flow-v2',attemptSerial:2}),pinnedGame=new Engine(pinnedPick.level);pinnedGame.swap(...pinnedPick.level.solutions[0][0]);const pinnedSave=copy(pinned.checkpoint(pinnedPick.metadata,pinnedGame));
addCatalog('v1 review explicitly restores v2 archive',{operation:'restore',levelId:7,record:pinnedSave},()=>catalogObserved(pinned.restore(7,pinnedSave)));
const classicSeven=classic.start(7,{selectionSeed:73}),classicGame=new Engine(classicSeven.level);classicGame.swap(...classicSeven.level.solutions[0][0]);const classicSave=copy(classic.checkpoint(classicSeven.metadata,classicGame));
addCatalog('v1 review delegates untouched L7 classic save',{operation:'restore',levelId:7,record:classicSave},()=>catalogObserved(pinned.restore(7,classicSave)));
for(const currentVersion of ['unknown','campaign-flow-v3'])addCatalog('unknown review pin rejects '+currentVersion,{operation:'create',overrides,currentVersion},()=>{W.HexCampaignFlow.createCatalog(classic,overrides,Engine,{currentVersion});return{ok:true};});
let temp;try{
 const dotnet=[process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean).find(bin=>{const r=spawnSync(bin,['--version'],{encoding:'utf8'});return r.status===0&&/^8\./.test(r.stdout.trim());});assert(dotnet,'actual .NET8 required');
 const run=(args,options={})=>{const r=spawnSync(dotnet,args,{cwd:root,encoding:'utf8',timeout:240000,maxBuffer:256*1024*1024,...options});if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr);return r.stdout;};
 temp=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-large-flow-parity-'));
 for(const spec of [{folder:'GameplayParityHarness',project:'Hexrota.GameplayParity',requests:gameRequests,expected:gameExpected,labels:gameLabels},{folder:'CampaignFlowParityHarness',project:'Hexrota.CampaignFlowParity',requests:catalogRequests,expected:catalogExpected,labels:catalogLabels}]){
  const output=path.join(temp,spec.folder,'bin');run(['build','unity/'+spec.folder+'/'+spec.project+'.csproj','--configuration','Release','--nologo','--verbosity','quiet','--output',output,'-p:BaseIntermediateOutputPath='+path.join(temp,spec.folder,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(root,'unity',spec.folder,'NuGet.Config')]);
  const actual=run([path.join(output,spec.project+'.dll')],{input:spec.requests.map(r=>JSON.stringify(r)).join('\n')+'\n'}).trim().split(/\r?\n/).map(JSON.parse);assert.equal(actual.length,spec.expected.length);
  for(let i=0;i<actual.length;i++){if(spec.expected[i].error)assert.equal(actual[i].error,true,spec.labels[i]);else assert.deepEqual(actual[i],spec.expected[i],spec.labels[i]);}
 }
 console.log(`Large flow JS/C# parity passed: 5 shapes inside 9x9 hex canvases (${levels.map(l=>l.cells.length).join('/')} cells); ${winRoutes} certified routes; ${gameRequests.length} mechanics + ${catalogRequests.length} catalog scenarios; ${swaps} valid swaps/${waves} waves, ${resumes} exact resumes, ${replays} replays, ${clones} independent clones, ${rejected} rejected saves/identities; ${catalogPrefixes} v2 + ${archivePrefixes} archived v1 checkpoint prefixes. Actual .NET8/C#7.3; every resolved fall/refill/RNG/status agrees.`);
}catch(error){console.error(error.stack||error);process.exitCode=1;}finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
