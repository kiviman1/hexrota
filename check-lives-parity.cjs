/* Real .NET 8/C# 7.3 life-v2 parity. No JavaScript substitute for a missing SDK. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const root=__dirname,plain=v=>JSON.parse(JSON.stringify(v)),config=require('./dist/lives-config.json');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'dist/lives.js'),'utf8'),context);const Lives=context.window.HexLives;
const vectors=require('./fixtures/lives-vectors.json'),legacy=require('./fixtures/lives-vectors-v1.json');
const requests=[],expected=[];let transitions=0,migrations=0,rejects=0,extra=0,probeCalls=0;
const queue=(request,output,label)=>{requests.push(plain(request));expected.push({output:plain(output),label});};
function capture(run){try{return plain(run());}catch(error){rejects++;return {error:true,name:error.name,message:error.message};}}
for(const c of vectors.cases){
 let utc=c.initialUtc,state;const trusted=new Set(),manager=Lives.createManager(c.config,{clock:()=>utc,verifyReceipt:r=>trusted.has(JSON.stringify(r))});
 state=manager.createState();assert.deepEqual(plain(state),c.initialState);const initial=plain(state),steps=[];
 for(const [i,step]of c.steps.entries()){
  const op=step.operation;if(op.atUtc!==undefined)utc=op.atUtc;const before=plain(state);let result=null,outcome=null;
  switch(op.kind){
   case 'settle':result=manager.settleAttempt(state,op.context);break;
   case 'register':result=manager.registerAttempt(state,op.context);break;
   case 'historical':result=manager.acknowledgeHistoricalAttempt(state,op.context);break;
   case 'transaction':if(op.verified)trusted.add(JSON.stringify(op.receipt));result=manager.applyTransaction(state,op.receipt);break;
   case 'bypass':result=manager.setDeveloperBypass(state,op.enabled);break;
   case 'reconcile':result={state:manager.reconcile(state)};break;
   case 'reload':result={state:manager.restore(plain(state))};break;
   case 'canStart':outcome={allowed:manager.canStart(state,op.context)};break;
   case 'canResume':outcome={allowed:manager.canResume(state,op.attemptId)};break;
   default:throw Error(op.kind);
  }
  assert.deepEqual(plain(state),before,'JS reducer input stays immutable');if(result){const {state:next,...rest}=result;state=next;outcome=Object.keys(rest).length?plain(rest):null;}
  const row={state:plain(state),view:plain(manager.view(state)),outcome};assert.deepEqual(row,{state:step.expectedState,view:step.expectedView,outcome:step.expectedOutcome},c.id+' '+i+' JS unchanged golden');steps.push(row);transitions++;
 }
 queue({operation:'scenario',config:c.config,scenario:c}, {initial,steps},c.id);
}
for(const c of legacy.cases)for(const raw of [c.initialState,...c.steps.map(s=>s.expectedState)]){
 const manager=Lives.createManager(c.config,{clock:()=>raw.lastSeenUtc}),state=manager.restore(raw);for(const key of Object.keys(raw))if(!['schemaVersion','rulesVersion'].includes(key))assert.deepEqual(plain(state[key]),raw[key]);
 queue({operation:'restore',config:c.config,utc:raw.lastSeenUtc,state:raw},{state:plain(state),view:plain(manager.view(state))},'frozen v1 migration '+(++migrations));
}
const T=Date.UTC(2026,0,8,12),manager=Lives.createManager(config,{clock:()=>T}),initial=plain(manager.createState());
function call(method,state=initial,argument,options={}){
 const request={operation:'call',config:options.config||config,utc:options.utc??T,method,state};if(argument!==undefined)request.argument=argument;if(options.trusted)request.trusted=options.trusted;if(options.verifierThrows)request.verifierThrows=true;
 const before=JSON.stringify(request),calls=[],reference=Lives.createManager(request.config,{clock:()=>request.utc,verifyReceipt:receipt=>{calls.push(plain(receipt));if(options.verifierThrows)throw Error('test verifier unavailable');return(options.trusted||[]).some(x=>JSON.stringify(x)===JSON.stringify(receipt));}});
 const output=capture(()=>({result:reference[method](state,argument),unchangedInput:state,verificationCalls:calls}));assert.equal(JSON.stringify(request),before,'JS call arguments unchanged');probeCalls+=calls.length;queue(request,output,'probe '+method+' '+(++extra));return output;
}
function restore(raw,utc=T,settings=config){const reference=Lives.createManager(settings,{clock:()=>utc});queue({operation:'restore',config:settings,utc,state:raw},capture(()=>{const s=reference.restore(raw);return{state:s,view:reference.view(s)};}),'restore '+(++extra));}
const loss=(attemptId,more={})=>({attemptId,levelId:10,tutorial:false,movesUsed:1,outcome:'failed',...more});
for(const field of Object.keys(initial)){const broken=plain(initial);delete broken[field];restore(broken);}
for(const patch of [{schemaVersion:3},{schemaVersion:'2'},{rulesVersion:'lives-v1'},{lives:6},{lives:-1},{lives:true},{lives:2,regenAnchorUtc:null},{lives:5,regenAnchorUtc:T},{lastSeenUtc:T+.5},{lastSeenUtc:-1},{lastSeenUtc:9007199254740992},{pendingAdLives:-1},{pendingAdLives:'1'},{unlimitedUntilUtc:{}.noSuchField??-1},{developerBypass:'false'},{settledAttempts:[]},{registeredAttempts:[]},{transactionArchive:[]},{transactionStreams:{bad:{provider:'development',ranges:[[1,2],[2,3]]}}},{protectionUsed:{bad:true}},{firstFailures:{'number:1':'constructor'}},{adUsage:{dayUtc:100000,claims:0,lastClaimUtc:null}}])restore({...plain(initial),...patch});
for(const raw of [false,0,[],{},null])restore(raw);
for(const settings of [null,{}, {...config,maxLives:6},{...config,initialLives:4},{...config,refillIntervalMs:0},{...config,maxLedgerEntries:0},{...config,firstFailureProtection:{enabled:'true',levelIds:[]}},{...config,ads:{...config.ads,dailyLimit:0}},{...config,products:{...config.products,single_life:{amount:0,costGold:30}}},{...config,development:{allowBypass:true,initialTestGold:-1}}])queue({operation:'validateConfig',config:settings},capture(()=>Lives.validateConfig(settings)),'configuration rejection '+(++extra));
for(const arg of [null,{},loss('bad',{levelId:true}),loss('constructor'),loss('wrong',{tutorial:'false'}),loss('fraction',{movesUsed:.1}),loss('wrong',{outcome:'other'}),loss('wrong',{confirmed:0})])call('settleAttempt',initial,arg);
for(const arg of [null,{},loss('a',{attemptId:1}),{attemptId:'a',levelId:10,tutorial:'false'}])call('registerAttempt',initial,arg);
for(const arg of [null,0,'false',{},true,false])call('setDeveloperBypass',initial,arg);
for(const method of ['settlementFor','registeredAttemptFor','hasTransaction','canResume'])for(const arg of ['absent','constructor','__proto__',1,null])call(method,initial,arg);
for(const product of ['ad_life','single_life','refill_lives','unlimited_lives_30m','other',null])call('transactionAvailability',initial,product);
let state=plain(initial);for(let n=0;n<5;n++)state=plain(manager.settleAttempt(state,loss('past-'+n)).state);
for(const arg of [null,true,false,1,'boxed',[],{},{tutorial:true},{resume:true,attemptId:'already-running'},{resume:true,attemptId:'constructor'},{tutorial:'true'}])call('canStart',state,arg);
const receipt={transactionId:'receipt-1',productId:'ad_life',provider:'development',status:'completed',verifiedAtUtc:T};
for(const patch of [{},{transactionId:'constructor'},{productId:'other'},{provider:'constructor'},{status:'pending'},{verifiedAtUtc:T+1},{verifiedAtUtc:-1},{streamId:'stream'},{streamId:'stream',sequence:0},{transactionId:'stream-1',streamId:'stream',sequence:2}]){
 const candidate={...receipt,...patch};call('applyTransaction',state,candidate,{trusted:[candidate]});
}
call('applyTransaction',state,receipt);call('applyTransaction',state,receipt,{trusted:[receipt],verifierThrows:true});
const first=call('applyTransaction',state,receipt,{trusted:[receipt]}).result.state;call('applyTransaction',first,receipt,{trusted:[receipt]});call('applyTransaction',first,{...receipt,productId:'unlimited_lives_30m'},{trusted:[{...receipt,productId:'unlimited_lives_30m'}]});
// Key type is part of identity, and rejected operations never charge a different attempt.
const reg=plain(manager.registerAttempt(initial,{attemptId:'identity',levelId:1,tutorial:false}).state);
call('registerAttempt',reg,{attemptId:'identity',levelId:'1',tutorial:false});call('settleAttempt',reg,loss('identity',{levelId:'1'}));call('settleAttempt',reg,loss('identity',{levelId:1}));
const archivedConfig={...config,maxLedgerEntries:2};const historyManager=Lives.createManager(archivedConfig,{clock:()=>T,verifyReceipt:()=>true});let history=historyManager.createState();for(let n=0;n<260;n++)history=historyManager.settleAttempt(history,loss('legacy-'+n,{outcome:n%3===0?'won':'failed'})).state;
restore(plain(history),T,archivedConfig);call('settlementFor',plain(history),'legacy-0',{config:archivedConfig});call('settleAttempt',plain(history),loss('legacy-1'),{config:archivedConfig});call('canStart',plain(history),{tutorial:true},{config:archivedConfig});
for(const bad of ['a\n','a\r','a\r\n','a\u2028']){call('settleAttempt',initial,loss(bad));call('registerAttempt',initial,{attemptId:bad,levelId:1,tutorial:false});call('applyTransaction',state,{...receipt,provider:bad},{trusted:[{...receipt,provider:bad}]});}
// Validation order: malformed attempt identity is checked before reconcile, while
// receipt operations reconcile/validate state before receipt trust is consulted.
for(const raw of [null,false,0,[]]){call('view',raw);call('view',raw,undefined,{utc:-1});call('settleAttempt',raw,{});call('applyTransaction',raw,{});}
call('canStart',initial,null,{utc:-1});
call('settleAttempt',{...initial,lives:6},{});call('registerAttempt',{...initial,lives:6},{});call('applyTransaction',{...initial,lives:6},{});call('setDeveloperBypass',{...initial,lives:6},'wrong');
for(const utc of [-1,.5,9007199254740992])call('view',initial,undefined,{utc});
// Valid configured intervals may produce an unsafe view-only timestamp. JS double
// rounding must be preserved even though durable UTC fields remain safe integers.
const hugeConfig={...config,ads:{...config.ads,cooldownMs:Number.MAX_SAFE_INTEGER}};
const cooling={...plain(initial),lives:4,regenAnchorUtc:T,adUsage:{...initial.adUsage,claims:1,lastClaimUtc:T}};
call('view',cooling,undefined,{config:hugeConfig});call('transactionAvailability',cooling,'ad_life',{config:hugeConfig});
const hugeRefill={...config,refillIntervalMs:Number.MAX_SAFE_INTEGER},waiting={...plain(initial),lives:4,regenAnchorUtc:T};
call('view',waiting,undefined,{config:hugeRefill});
// Both deadline and deferred-credit overflow reject once while preserving the ordinary cap.
const max=9007199254740991,near={...plain(initial),lastSeenUtc:max,unlimitedUntilUtc:max};const unlimited={...receipt,transactionId:'overflow',productId:'unlimited_lives_30m',verifiedAtUtc:max};call('applyTransaction',near,unlimited,{utc:max,trusted:[unlimited]});
const pending={...plain(initial),pendingAdLives:max};call('applyTransaction',pending,receipt,{trusted:[receipt]});
// Exercise compaction in compiled reducers, not merely restore an already compact
// JS object. Default20k rich setting is not a gameplay quota; technical cap is128.
const longOps=Array.from({length:300},(_,n)=>({kind:'settle',context:loss('long-'+n,{outcome:'won'})}));
longOps.push({kind:'canStart',context:{}},{kind:'settle',context:loss('long-0',{outcome:'won'})},{kind:'canResume',attemptId:'other-inflight'});
{
 const scenario={initialUtc:T,config,steps:longOps.map(operation=>({operation}))},native=Lives.createManager(config,{clock:()=>T});let state=native.createState();const start=plain(state),steps=[];
 for(const op of longOps){let outcome;if(op.kind==='settle'){const result=native.settleAttempt(state,op.context);state=result.state;const{state:unused,...rest}=result;outcome=rest;}else outcome={allowed:op.kind==='canStart'?native.canStart(state,op.context):native.canResume(state,op.attemptId)};steps.push({state:plain(state),view:plain(native.view(state)),outcome:plain(outcome)});}
 assert.equal(Object.keys(state.settledAttempts).length,128);assert.equal(native.canStart(state),true);transitions+=longOps.length;queue({operation:'scenario',config,scenario},{initial:start,steps},'compiled300-attempt default-retention stress');
}
let temp;
function findDotnet(){for(const executable of [...new Set([process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean))]){const r=spawnSync(executable,['--version'],{cwd:root,encoding:'utf8',timeout:15000});if(r.status===0&&/^8\./.test(r.stdout.trim()))return{executable,version:r.stdout.trim()};}throw Error('Life parity requires real .NET8 compilation. InstallSDK8 or set DOTNET_PATH; JS fallback is never used.');}
function run(command,args,options={}){const r=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:128*1024*1024,timeout:180000,...options});if(r.error)throw r.error;if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr);return r.stdout;}
try{
 const sdk=findDotnet();temp=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-lives-parity-'));const output=path.join(temp,'bin'),env={...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_NOLOGO:'1'};
 run(sdk.executable,['build',path.join(root,'unity/LivesParityHarness/Hexrota.LivesParity.csproj'),'--configuration','Release','--nologo','--verbosity','quiet','--output',output,'-p:BaseIntermediateOutputPath='+path.join(temp,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(root,'unity/LivesParityHarness/NuGet.Config')],{env});
 const lines=run(sdk.executable,[path.join(output,'Hexrota.LivesParity.dll')],{env,input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n'}).trim().split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));assert.equal(lines.length,expected.length,'every request is executed by compiledC#');
 for(const [i,row]of expected.entries()){assert.equal(lines[i].inputUnchanged,true,row.label+' C# immutableinput');assert.deepEqual(lines[i].output,row.output,row.label+' fullC# state/view/outcome/error/verifierorder matchesJS');}
 console.log(`C# life parity passed: ${vectors.cases.length} shared scenarios plus1long-run stress/${transitions} transitions, ${migrations} frozen v1 migrations, ${extra} extra strict/error/archive/receipt probes (${rejects} rejections, ${probeCalls} verified callback inspections). Every state, view, nullable time, result, ledger and waiver agrees; ${requests.length} compiled requests keep inputs unchanged. C#7.3/.NET${sdk.version}.`);
}catch(error){console.error(error.stack||error);process.exitCode=1;}finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
