/* Actual .NET8/C#7.3 optional onboarding transport and pure presentation parity. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const P=require('./dist/onboarding-policy.js'),G=require('./dist/game-save.js');
require('./dist/engine.js');const Engine=globalThis.HexMatch;
const tutorials=require('./data/tutorials-fixed.json').levels,campaign=require('./data/levels-original.json').levels,levels=[...tutorials,...campaign];
const copy=value=>JSON.parse(JSON.stringify(value)),own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const requests=[],expected=[],labels=[],sessionChecks=new Map();let rejects=0,projections=0,transports=0,nativeSessions=0,nativeMoves=0;
function execute(r){switch(r.operation){
 case'validate':return P.validate(r.value);
 case'normalize':return P.normalize(r.value,r.options);
 case'isV2':return P.isV2(r.value);
 case'rules':return P.rules(r.value);
 case'requiresAcknowledgement':return P.requiresAcknowledgement(r.value,r.step);
 case'project':projections++;return P.project(r.value,r.request);
 case'defaults':return G.defaults();
 case'normalizeGame':{transports++;if(r.raw===null)return G.defaults();const sourceKey=r.sourceKey||G.KEY;return G.load({read:key=>key===sourceKey?r.raw:null,contains:key=>key===sourceKey,levels:r.levels,tutorials,onboardingEligible:false}).saved;}
 case'copyIsolation':{const validated=P.validate(r.value),rules=P.rules(r.value);assert(Object.isFrozen(validated)&&Object.isFrozen(rules));assert.throws(()=>validated.version='changed',TypeError);assert.throws(()=>rules.feedbackMs=-1,TypeError);return{value:r.value,validated:P.validate(r.value),rules:P.rules(r.value)};}
 default:throw Error('Unknown operation');
}}
function add(label,request){const r=copy(request),before=JSON.stringify(r);let result;try{result=execute(r);}catch{result={error:true};rejects++;}assert.equal(JSON.stringify(r),before,label+' input immutable');requests.push(r);expected.push(copy(result));labels.push(label);}
const policies=[undefined,null,{version:'onboarding-v1'},{version:'onboarding-v2'},false,0,'onboarding-v2',[],{}, {version:null},{version:2},{version:'onboarding-v3'},{version:'onboarding-v2\n'},{version:'onboarding-v2',extra:true}];
for(const [i,value]of policies.entries()){
 for(const operation of ['validate','isV2','rules'])add(operation+' policy '+i,{operation,...(value===undefined?{}:{value})});
 for(const step of [undefined,null,{},[],{acknowledge:true},{acknowledge:false},{acknowledge:1},{acknowledge:'true'}])add('strict acknowledgement '+i+' '+JSON.stringify(step),{operation:'requiresAcknowledgement',...(value===undefined?{}:{value}),...(step===undefined?{}:{step})});
 for(const existingRecord of [false,true])for(const eligible of [false,true])add('normalize '+i+' '+existingRecord+' '+eligible,{operation:'normalize',...(value===undefined?{}:{value}),options:{existingRecord,eligible}});
}
for(const options of [undefined,null,[],false,{}, {existingRecord:true},{eligible:true},{existingRecord:1,eligible:true},{existingRecord:true,eligible:'true'},{existingRecord:false,eligible:true,extra:true}])add('invalid context '+JSON.stringify(options),{operation:'normalize',...(options===undefined?{}:{options})});
for(const value of [null,{version:'onboarding-v1'},{version:'onboarding-v2'}]){
 for(const levelId of ['learn-1','learn-2'])for(const turn of [0,1,2,3,4,5,2147483647])for(const phase of ['ready','result','busy'])add('projection '+JSON.stringify(value)+' '+levelId+' '+turn+' '+phase,{operation:'project',value,request:{levelId,turn,phase}});
 for(const request of [undefined,null,false,[],{}, {levelId:1},{levelId:'campaign-only'}, {levelId:'learn-1'}, {levelId:'learn-2',turn:-1,phase:'ready'},{levelId:'learn-1',turn:.5,phase:'ready'},{levelId:'learn-1',turn:'1',phase:'ready'},{levelId:'learn-1',turn:2147483648,phase:'ready'},{levelId:'learn-1',turn:1,phase:'future'},{levelId:'learn-1',turn:1,phase:'ready',extra:true}])add('projection boundary '+JSON.stringify(value)+' '+JSON.stringify(request),{operation:'project',value,...(request===undefined?{}:{request})});
}
for(const level of tutorials){const engine=new Engine(level);for(let turn=0;turn<=level.solution.length;turn++){
 const checkpoint=JSON.stringify(engine.snapshot());for(const phase of ['ready','result','busy'])add('actual tutorial '+level.id+' '+turn+' '+phase,{operation:'project',value:{version:'onboarding-v2'},request:{levelId:level.id,turn:engine.turn,phase}});
 assert.equal(JSON.stringify(engine.snapshot()),checkpoint,'projection cannot change actual tutorial board');if(turn<level.solution.length)assert(engine.swap(...level.solution[turn]).ok);
}assert.equal(engine.status,'won');}
for(const version of ['onboarding-v1','onboarding-v2'])add('independent pure copies '+version,{operation:'copyIsolation',value:{version}});
add('historical defaults stay absent',{operation:'defaults'});
for(const sourceKey of [G.KEY,...G.LEGACY_KEYS])for(const value of [undefined,null,{version:'onboarding-v1'},{version:'onboarding-v2'},{version:'onboarding-v9'},{version:'onboarding-v2',complete:true}]){
 const raw={current:0,done:[],boards:{},guideAcks:['0:1','1:1','1:3','bad','0:1'],...(value===undefined?{}:{onboarding:value})};
 add('optional transport '+sourceKey+' '+JSON.stringify(value),{operation:'normalizeGame',raw,levels,tutorialCount:2,sourceKey});
}
add('missing raw has legacy defaults, no host enrollment',{operation:'normalizeGame',raw:null,levels,tutorialCount:2});

// The native application, not a second onboarding game model, drives all seven
// authored moves, reload/replay/reset and the existing singleton welcome ledger.
const lifeConfig=require('./dist/lives-config.json'),economyConfig=require('./data/economy-config-9-5.json'),variants=require('./dist/variants.json');
const sessionInput={operation:'session',tutorials,campaign,variants,lifeConfig,economyConfig};
function nativeSession(label,raw,commands,check){sessionChecks.set(requests.length,check);requests.push(copy({...sessionInput,raw,commands}));expected.push(null);labels.push(label);nativeSessions++;}
function assertPolicy(game,policy){assert.equal(own(game,'onboarding'),policy!==undefined,'optional policy presence remains stable');if(policy!==undefined)assert.deepEqual(game.onboarding,policy);}
for(const policy of [undefined,{version:'onboarding-v1'},{version:'onboarding-v2'}]){
 const raw={...G.defaults(),...(policy===undefined?{}:{onboarding:policy})},commands=[{op:'boot'}],checkpoints=[];
 for(let stage=0;stage<2;stage++){
  commands.push({op:'enter',stage});const engine=new Engine(tutorials[stage]);checkpoints.push({index:commands.length-1,snapshot:copy(engine.snapshot())});
  for(const [turn,pair]of tutorials[stage].solution.entries()){
   commands.push({op:'swap',pair});assert(engine.swap(...pair).ok);checkpoints.push({index:commands.length-1,snapshot:copy(engine.snapshot())});nativeMoves++;
   if(policy?.version==='onboarding-v2'||tutorials[stage].steps[turn].acknowledge)commands.push({op:'ack'});
  }
 }
 commands.push({op:'boot'},{op:'reset'},{op:'boot'},{op:'enter',stage:1});
 const replay=new Engine(tutorials[1]);for(const pair of tutorials[1].solution){commands.push({op:'swap',pair});assert(replay.swap(...pair).ok);checkpoints.push({index:commands.length-1,snapshot:copy(replay.snapshot())});nativeMoves++;if(policy?.version==='onboarding-v2')commands.push({op:'ack'});}
 nativeSession('real native tutorial lifecycle '+JSON.stringify(policy),raw,commands,rows=>{
  assert.equal(rows.length,commands.length);for(const row of rows)assertPolicy(row.game,policy);
  for(const c of checkpoints)assert.deepEqual(rows[c.index].view.snapshot,c.snapshot,'native tutorial result equals actual JS engine');
  for(let i=0;i<commands.length;i++)if(commands[i].op==='ack'&&policy?.version==='onboarding-v2'){
   assert.deepEqual(rows[i].result,{ok:false,reason:'automatic_feedback'});assert.deepEqual(rows[i].game,rows[i-1].game,'automatic receipt creates no guide acknowledgment or transaction');
  }
  const final=rows.at(-1);assert.equal(final.wallet.gold,20);assert.equal(final.wallet.stars,0);assert.deepEqual(final.wallet.inventory,{greenBrush:0,colorKey:0});
  const ledger=Object.entries(final.game.economy.transactions);assert.equal(ledger.length,1);assert.equal(ledger[0][0],'welcome:main:onboarding-v1');assert.equal(ledger[0][1].kind,'welcome');
  if(policy?.version==='onboarding-v2')assert.deepEqual(final.game.guideAcks,[]);
 });
}
{
 const policy={version:'onboarding-v2'},guideAcks=['0:1','1:1','1:3'];
 const raw={...G.defaults(),onboarding:policy,guideAcks},commands=[{op:'boot'},{op:'enter',stage:0},{op:'swap',pair:tutorials[0].solution[0]},{op:'ack'},{op:'boot'},{op:'enter',stage:1},{op:'swap',pair:tutorials[1].solution[0]},{op:'ack'},{op:'boot'}];
 nativeMoves+=2;nativeSession('v2 fresh entries retain preexisting valid guide acknowledgements',raw,commands,rows=>{
  for(const row of rows){assertPolicy(row.game,policy);assert.deepEqual(row.game.guideAcks,guideAcks,'v2 transport/fresh entry/real move/ack/reload retains existing valid guide acknowledgements');}
  for(const index of [3,7]){assert.deepEqual(rows[index].result,{ok:false,reason:'automatic_feedback'});assert.deepEqual(rows[index].game,rows[index-1].game,'v2 acknowledgement is an unchanged no-op');}
  assert.equal(rows.at(-1).wallet.gold,0,'neither first move mints a welcome reward');
 });
}
// A failed final gameplay transaction cannot leave a policy, won snapshot or
// welcome grant partially committed; retrying the actual move commits once.
{const level=tutorials[1],game=new Engine(level);for(const pair of level.solution.slice(0,-1))assert(game.swap(...pair).ok);const raw={...G.defaults(),current:1,done:[0],onboarding:{version:'onboarding-v2'},boards:{1:copy(game.snapshot())}},pair=level.solution.at(-1),commands=[{op:'boot'},{op:'enter',stage:1}];
 // Enter normally creates a fresh lesson, so restore the near-win directly on
 // boot and attempt the last move without an explicit fresh entry.
 commands.splice(1,1,{op:'failWrites',value:true},{op:'swap',pair},{op:'failWrites',value:false},{op:'swap',pair},{op:'boot'});nativeMoves+=2;
 nativeSession('actual final move rollback and singleton grant',raw,commands,rows=>{assert.deepEqual(rows[2].game,rows[1].game);assert.equal(rows[2].view.status,'playing');assert.equal(rows[2].wallet.gold,0);assertPolicy(rows[2].game,raw.onboarding);assert.equal(rows[4].view.status,'won');assert.equal(rows[4].wallet.gold,20);assert.equal(rows[5].wallet.gold,20);assert.equal(Object.keys(rows[5].game.economy.transactions).length,1);});
}

let temp;
try{
 const dotnet=[process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean).find(bin=>{const r=spawnSync(bin,['--version'],{encoding:'utf8'});return r.status===0&&/^8\./.test(r.stdout.trim());});assert(dotnet,'actual .NET8 SDK required; no JS fallback');
 const run=(args,options={})=>{const r=spawnSync(dotnet,args,{cwd:__dirname,encoding:'utf8',timeout:300000,maxBuffer:256*1024*1024,...options});if(r.status!==0)throw Error(String(r.error||'')+'\n'+r.stdout+'\n'+r.stderr);return r.stdout;};
 temp=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-onboarding-parity-'));const output=path.join(temp,'bin');
 run(['build','unity/OnboardingParityHarness/Hexrota.OnboardingParity.csproj','--configuration','Release','--nologo','--verbosity','quiet','--output',output,'-p:BaseIntermediateOutputPath='+path.join(temp,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(__dirname,'unity/OnboardingParityHarness/NuGet.Config')]);
 const actual=run([path.join(output,'Hexrota.OnboardingParity.dll')],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n'}).trim().split(/\r?\n/).map(JSON.parse);assert.equal(actual.length,requests.length);
 for(let i=0;i<requests.length;i++){if(sessionChecks.has(i)){assert(!actual[i].error,labels[i]);sessionChecks.get(i)(actual[i]);}else assert.deepEqual(actual[i],expected[i],labels[i]);}
 console.log(`Onboarding JS/C# parity passed: ${requests.length} requests; ${projections} phase projections, ${transports} optional save transports, ${rejects} malformed policy/context/projection/transport rejections; ${nativeSessions} native application lifecycles/${nativeMoves} authored tutorial swap attempts. Actual .NET8/C#7.3; legacy absence, v2 no-ack, fixed seven moves, singleton20Gold and failed-write rollback preserved.`);
}catch(error){console.error(error.stack||error);process.exitCode=1;}finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
