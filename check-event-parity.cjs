/* Real C# 7.3 event-contract parity. The JavaScript source is an unmodified
 * oracle; no analytics service, persistence or network transport is involved. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const root=__dirname,copy=value=>JSON.parse(JSON.stringify(value));
const sandbox={window:{}};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'dist/events.js'),'utf8'),sandbox,{filename:'events.js'});
const E=sandbox.window.HexEvents,requests=[],expected=[],counts={create:0,validate:0,validateState:0,append:0};
const stableMessages=new Set(['Invalid gameplay event identity','Invalid gameplay event sequence','Invalid gameplay event statistic','Invalid gameplay event state','Gameplay event does not match its result','Invalid gameplay event detail','Unexpected gameplay event field','Invalid local event buffer limit','Invalid local event buffer','Invalid local event order','Unexpected gameplay context',"Cannot read properties of null (reading 'limit')"]);
function invoke(input){
 switch(input.operation){
  case 'create':return Object.hasOwn(input,'options')?E.createState(input.options):E.createState();
  case 'validate':return E.validate(input.value);
  case 'validateState':return E.validateState(input.value);
  case 'append':return Object.hasOwn(input,'details')?E.append(input.state,input.name,input.context,input.details):E.append(input.state,input.name,input.context);
  default:throw Error('Unknown event parity operation');
 }
}
function add(name,input){
 const request=copy(input),before=JSON.stringify(request);let result;
 try{result={result:copy(invoke(request))};}
 catch(error){assert(stableMessages.has(error.message),name+': test exercises a documented source rejection message');result={error:true,message:error.message};}
 assert.equal(JSON.stringify(request),before,name+': JavaScript must preserve input on success and rejection');
 requests.push(request);expected.push({name,...result});counts[request.operation]++;
 return result.result;
}
const context=(overrides={})=>({timestamp:1700000000000,levelId:1,variantId:'v1',levelDataVersion:'variants-v1',attemptId:'a-1-1-12345678',attemptNumber:1,movesUsed:0,movesRemaining:12,score:0,targetScore:85,covered:0,totalCells:19,remainingLayers:19,cascades:0,hintsUsed:0,status:'playing',...overrides});
function event(overrides={}){return {schemaVersion:1,name:'level_started',sequence:1,eventId:'a-1-1-12345678:1',...context(),...overrides};}
const validate=(name,value)=>add(name,{operation:'validate',value});
const validateState=(name,value)=>add(name,{operation:'validateState',value});
// Explicit request helper avoids treating an absent optional field as JSON null.
function appendRequest(label,state,name,ctx,details,includeDetails=false){
 const request={operation:'append',state,name,context:ctx};if(includeDetails)request.details=details;
 return add(label,request);
}

add('default buffer',{operation:'create'});
add('empty options',{operation:'create',options:{}});
for(const options of [null,false,true,0,'',[],[1]])add('raw options '+JSON.stringify(options),{operation:'create',options});
for(const limit of [1,2,3,500,1999,2000,-1,0,2001,Number.MAX_SAFE_INTEGER])add('buffer limit '+limit,{operation:'create',options:{limit}});
for(const limit of [null,true,false,'5',0.5,1.5,{},[],Number.MAX_SAFE_INTEGER+1])add('noninteger buffer limit '+JSON.stringify(limit),{operation:'create',options:{limit}});
add('create ignores unrelated option',{operation:'create',options:{unused:'not-persisted'}});

validate('baseline valid event',event());
for(const levelId of [1,10,Number.MAX_SAFE_INTEGER,'1','T1','T2','0','x'.repeat(128)])validate('typed level ID '+JSON.stringify(levelId),event({levelId}));
for(const [name,status]of [['level_started','playing'],['level_started','won'],['level_started','lost'],['level_completed','won'],['level_failed','lost'],['level_retried','playing'],['hint_used','playing'],['booster_used','playing'],['level_abandoned','playing']])validate('event '+name+' '+status,event({name,status}));
for(const value of [null,false,true,0,1,'',[],[event()]])validate('non-object event '+JSON.stringify(value),value);
for(const field of ['schemaVersion','name','sequence','timestamp','eventId','attemptId','variantId','levelDataVersion','levelId']){
 const missing=event();delete missing[field];validate('missing identity '+field,missing);
 for(const value of [null,false,{},[]])validate('invalid identity '+field+' '+JSON.stringify(value),event({[field]:value}));
}
for(const [field,value]of [['schemaVersion','1'],['schemaVersion',2],['name','other'],['sequence',0],['sequence',-1],['sequence',1.1],['sequence','1'],['sequence',Number.MAX_SAFE_INTEGER+1],['timestamp',-1],['timestamp',0.5],['timestamp','1700000000000'],['timestamp',Number.MAX_SAFE_INTEGER+1],['levelId',0],['levelId',-1],['levelId',1.1],['levelId',''],['levelId','with space']])validate('invalid identity scalar '+field+' '+String(value),event({[field]:value}));
for(const field of ['attemptId','variantId','levelDataVersion','levelId'])for(const value of ['', 'a\n','a\r','a\r\n','a\n\n','\na','a\tb','a b','a/b','a@b','ç','x'.repeat(129)]){
 const e=event({[field]:value});if(field==='attemptId')e.eventId=value+':1';validate('token rejects '+field+' '+JSON.stringify(value),e);
}
validate('all token punctuation',event({attemptId:'a.A_1-:z',eventId:'a.A_1-:z:1',variantId:'a.A_1-:z',levelDataVersion:'a.A_1-:z'}));
validate('maximum derived event ID',event({attemptId:'x'.repeat(126),eventId:'x'.repeat(126)+':1'}));
validate('derived event ID too long',event({attemptId:'x'.repeat(127),eventId:'x'.repeat(127)+':1'}));
validate('event sequence differs',event({eventId:'a-1-1-12345678:2'}));
validate('event ID does not match attempt',event({eventId:'other:1'}));
for(const sequence of [2,127,Number.MAX_SAFE_INTEGER])validate('large exact sequence '+sequence,event({sequence,eventId:'a-1-1-12345678:'+sequence}));
const statistics=['attemptNumber','movesUsed','movesRemaining','score','targetScore','covered','totalCells','remainingLayers','cascades','hintsUsed'];
for(const field of statistics){
 const missing=event();delete missing[field];validate('missing statistic '+field,missing);
 for(const value of [null,true,false,'0',-1,0.5,Number.MAX_SAFE_INTEGER+1,{},[]])validate('invalid statistic '+field+' '+JSON.stringify(value),event({[field]:value}));
}
validate('all safe integer statistic boundaries',event({attemptNumber:Number.MAX_SAFE_INTEGER,movesUsed:Number.MAX_SAFE_INTEGER,movesRemaining:Number.MAX_SAFE_INTEGER,score:Number.MAX_SAFE_INTEGER,targetScore:Number.MAX_SAFE_INTEGER,covered:Number.MAX_SAFE_INTEGER,totalCells:Number.MAX_SAFE_INTEGER,remainingLayers:Number.MAX_SAFE_INTEGER,cascades:Number.MAX_SAFE_INTEGER,hintsUsed:Number.MAX_SAFE_INTEGER}));
for(const overrides of [{attemptNumber:0},{totalCells:0},{covered:20},{status:null},{status:'paused'},{status:1}])validate('invalid gameplay state '+JSON.stringify(overrides),event(overrides));
for(const [name,status]of [['level_completed','playing'],['level_completed','lost'],['level_failed','playing'],['level_failed','won'],['level_abandoned','won'],['level_abandoned','lost']])validate('invalid result '+name+' '+status,event({name,status}));
const details=['reason','previousAttemptId','nextAttemptId','hintKind','hintGuarantee','boosterId'];
for(const field of details){
 for(const value of ['ok','x'.repeat(128)])validate('detail accepts '+field+' length '+value.length,event({[field]:value}));
 for(const value of [null,0,false,'','a\n','x'.repeat(129),{},[]])validate('detail rejects '+field+' '+JSON.stringify(value),event({[field]:value}));
}
for(const field of ['email','playerName','deviceId','ip','extra'])validate('unknown and PII field '+field,event({[field]:'forbidden'}));
validate('identity precedes unknown field',event({timestamp:-1,extra:true}));
validate('sequence precedes bad statistic',event({eventId:'other:1',score:-1}));
validate('statistic precedes wrong status',event({score:-1,status:'bad'}));
validate('result precedes detail',event({name:'level_failed',status:'playing',reason:null}));
validate('detail precedes unknown field',event({reason:null,extra:true}));

const empty=E.createState({limit:3});
validateState('empty buffer',empty);
validateState('state preserves ignored fields',{...copy(empty),unrelated:17});
for(const value of [null,false,true,0,'',[],[event()]])validateState('non-object state '+JSON.stringify(value),value);
for(const field of ['schemaVersion','limit','nextSequence','events']){
 const missing=copy(empty);delete missing[field];validateState('missing state '+field,missing);
 for(const value of [null,false,'1',{},0.5])validateState('invalid state field '+field+' '+JSON.stringify(value),{...copy(empty),[field]:value});
}
for(const overrides of [{schemaVersion:2},{limit:0},{limit:2001},{nextSequence:0},{nextSequence:Number.MAX_SAFE_INTEGER+1},{events:[event()]},{events:[null]}])validateState('invalid buffer '+JSON.stringify(overrides),{...copy(empty),...overrides});
validateState('single ordered event',{...copy(empty),nextSequence:2,events:[event()]});
validateState('bounded gaps in sequence',{...copy(empty),nextSequence:7,events:[event({sequence:3,eventId:'a-1-1-12345678:3'}),event({sequence:6,eventId:'a-1-1-12345678:6'})]});
validateState('duplicate sequence',{...copy(empty),nextSequence:3,events:[event(),event()]});
validateState('reverse order',{...copy(empty),nextSequence:4,events:[event({sequence:2,eventId:'a-1-1-12345678:2'}),event()]});
validateState('sequence equals next',{...copy(empty),nextSequence:1,events:[event()]});
validateState('too many events',{...copy(empty),limit:1,nextSequence:3,events:[event(),event({sequence:2,eventId:'a-1-1-12345678:2'})]});

let state=appendRequest('append baseline',empty,'level_started',context());
for(let turn=1;turn<=12;turn++){
 state=appendRequest('bounded append turn '+turn,state,'hint_used',context({movesUsed:turn,movesRemaining:12-turn,score:turn*8,hintsUsed:turn}),{hintKind:'heuristic',hintGuarantee:'none'},true);
 assert.equal(state.events.length,Math.min(3,turn+1));validateState('validate bounded append '+turn,state);
}
for(const [name,status]of [['level_started','playing'],['level_completed','won'],['level_failed','lost'],['level_abandoned','playing']]){
 const first=appendRequest('terminal initial '+name,E.createState(),'level_started',context());
 const terminal=name==='level_started'?first:appendRequest('terminal append '+name,first,name,context({status}));
 const again=appendRequest('terminal duplicate '+name,terminal,name,context({status,score:999,movesUsed:3}),{reason:'rerender'},true);
 assert.deepEqual(again,terminal,name+' duplicates preserve entire prior buffer');
 appendRequest('terminal duplicate validation precedes dedup '+name,terminal,name,context({status,score:-1}));
 appendRequest('terminal different attempt '+name,terminal,name,context({status,attemptId:'a-1-2-deadbeef'}));
}
for(const name of ['hint_used','booster_used','level_retried']){
 let repeated=E.createState();for(let i=0;i<3;i++)repeated=appendRequest('repeat nonterminal '+name+' '+i,repeated,name,context());
 assert.equal(repeated.nextSequence,4,name+' repeated events advance sequence');
}
appendRequest('append preserves string campaign identity',empty,'level_started',context({levelId:'1'}));
appendRequest('append numeric campaign identity',empty,'level_started',context({levelId:1}));
appendRequest('append tutorial identity',empty,'level_started',context({levelId:'T1'}));
for(const value of [null,false,true,0,'',[]])appendRequest('invalid context '+JSON.stringify(value),empty,'level_started',value);
for(const field of ['email','extra','eventId','sequence','schemaVersion'])appendRequest('context unknown '+field,empty,'level_started',{...context(),[field]:'forbidden'});
for(const value of [null,false,true,0,'',[],{reason:'ok'},{reason:null},{email:'forbidden'},{score:10}])appendRequest('explicit details '+JSON.stringify(value),empty,'level_started',context(),value,true);
appendRequest('unknown event name',empty,'not_an_event',context());
appendRequest('invalid buffer precedes context',null,'level_started',null,null,true);
appendRequest('invalid buffer precedes name',{...copy(empty),nextSequence:0},'bad',context());
appendRequest('unknown context precedes identity',empty,'bad',{...context(),email:'forbidden'});
appendRequest('append nextSequence max safe',{...copy(empty),nextSequence:Number.MAX_SAFE_INTEGER},'hint_used',context());
// Deterministic malformed-field fuzzing exercises source validation order, not
// randomness, and therefore remains reproducible across SDKs and CI workers.
let seed=0x718293a4;
const fuzzFields=Object.keys(event()).concat(details),fuzzValues=[null,false,true,0,1,-1,0.5,'','ok','a\n',[],{},Number.MAX_SAFE_INTEGER+1];
for(let i=0;i<96;i++){
 seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;seed>>>=0;
 const field=fuzzFields[seed%fuzzFields.length],value=fuzzValues[(seed>>>8)%fuzzValues.length];
 validate('deterministic wire fuzz '+i+' '+field,event({[field]:value}));
}

function findDotnet(){
 const candidates=[process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean);
 for(const command of [...new Set(candidates)]){const r=spawnSync(command,['--version'],{encoding:'utf8',timeout:15000});if(r.status===0&&/^8\./.test(r.stdout.trim()))return {command,version:r.stdout.trim()};}
 throw Error('Event parity requires actual .NET 8 compilation; install the SDK or set DOTNET_PATH. No JavaScript fallback is permitted.');
}
function run(command,args,options={}){
 const r=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:64*1024*1024,...options});
 if(r.error)throw r.error;if(r.status!==0)throw Error('Event parity command failed:\n'+r.stdout+'\n'+r.stderr);return r.stdout;
}
let temp;
try{
 const sdk=findDotnet();temp=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-event-parity-'));
 const output=path.join(temp,'bin'),project=path.join(root,'unity/EventParityHarness/Hexrota.EventParity.csproj');
 const env={...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_NOLOGO:'1'};
 run(sdk.command,['build',project,'--configuration','Release','--nologo','--verbosity','quiet','--output',output,'-p:BaseIntermediateOutputPath='+path.join(temp,'obj')+path.sep,'-p:RestoreConfigFile='+path.join(root,'unity/EventParityHarness/NuGet.Config')],{env});
 const lines=run(sdk.command,[path.join(output,'Hexrota.EventParity.dll')],{env,input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n'}).trim().split(/\r?\n/).filter(Boolean);
 assert.equal(lines.length,expected.length,'one actual C# result per JS operation');
 const failures=[];
 for(let i=0;i<expected.length;i++){
  const actual=JSON.parse(lines[i]),{name,...want}=expected[i];
  try{assert.equal(actual.inputUnchanged,true,name+': C# input immutability');delete actual.inputUnchanged;assert.deepEqual(actual,want,name+': full C# JSON/error matches unmodified JS source');}
  catch(error){failures.push({name,request:requests[i],expected:want,actual});}
 }
 if(failures.length){console.error(JSON.stringify(failures.slice(0,20),null,2));throw Error(failures.length+' of '+expected.length+' event parity comparisons failed');}
 const rejects=expected.filter(r=>r.error).length;
 console.log(`C# event parity passed: ${expected.length} complete JSON comparisons (${counts.create} create, ${counts.validate} validate, ${counts.validateState} state validation, ${counts.append} append), ${rejects} exact rejection messages; input immutability for every success/rejection. Covers bounded buffer/order, duplicate terminal callbacks, typed IDs, token boundaries, PII/unknown fields and deterministic wire fuzz. C# 7.3 compiled with .NET SDK ${sdk.version}.`);
}catch(error){console.error(error.stack||error);process.exitCode=1;}
finally{if(temp)fs.rmSync(temp,{recursive:true,force:true});}
