/* Actual C# 7.3/.NET8 application, profile and development-provider parity.
 * UI flow goldens execute the real app.js in JSDOM; no JS session reimplementation.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const {mount,fresh,existing,lifePool,plain,enter,move,wait,until,NOW,MINUTE}=require('./check-lives-ui.cjs');
const root=__dirname,PK='hexrota-profile-v2',GK='hexrota-match-v5',LK='hexrota-lives-v1',EK='hexrota-events-v1';
const context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js','lives-config.js','lives.js','life-providers.js','session-store.js','reward-rules.js','rewards.js','reward-adapter.js','economy-config.js','economy.js','commands.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
const R=context.window,config={levels:plain(R.HEX_LEVELS),tutorials:plain(R.HEX_TUTORIALS),variants:plain(R.HEX_VARIANTS),lifeConfig:plain(R.HEX_LIVES_CONFIG),economyConfig:plain(R.HEX_ECONOMY_CONFIG),now:NOW,selectionSeed:0x41abca,providerNamespace:'ui-test',rewardRules:plain(R.HEX_REWARD_RULES)};
function dotnet(){for(const cmd of [...new Set([process.env.DOTNET_PATH,'dotnet','/workspace/scratch/dotnet/dotnet',path.join(os.homedir(),'.dotnet','dotnet')].filter(Boolean))]){const p=spawnSync(cmd,['--version'],{encoding:'utf8'});if(p.status===0&&/^8\./.test(p.stdout.trim()))return cmd;}throw Error('Session parity requires a real .NET 8 SDK. No JavaScript fallback is permitted.');}
const sdk=dotnet(),build=fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-session-'));
function run(cmd,args,options={}){const p=spawnSync(cmd,args,{cwd:root,encoding:'utf8',maxBuffer:256*1024*1024,timeout:240000,...options});if(p.error||p.status!==0)throw Error(String(p.error||'')+'\n'+p.stdout+'\n'+p.stderr);return p.stdout;}
run(sdk,['build','unity/ApplicationParityHarness/ApplicationParityHarness.csproj','-c','Release','-o',build,'--nologo']);
const cases=[],expected=[],nativeChecks=new Map();let comparisons=0,flowCount=0;
function add(label,input,output){cases.push({label,input});expected.push(plain(output));}
function nativeCase(label,input,check){nativeChecks.set(cases.length,check);add(label,{...config,...input},null);}
function catchError(fn){try{return fn();}catch(e){return {error:e.message};}}
function providerCase(label,state,commands){let current=state;const output=[];for(const c of commands){let result=catchError(()=>{let r;if(c.op==='create'){r=R.HexLifeProviders.createState({namespace:c.namespace||'hexrota-test',adAvailable:c.adAvailable??true});current=r;}else if(c.op==='normalize'){R.HexLifeProviders.validate(current);r=plain(current);if(r.schemaVersion===1){r.schemaVersion=2;r.finalizedRanges=[];}current=r;}else if(c.op==='validate')r=R.HexLifeProviders.validate(current);else if(c.op==='begin'){r=R.HexLifeProviders.begin(current,{productId:c.product,nowUtc:c.now});current=r.state;}else if(c.op==='complete'){r=R.HexLifeProviders.complete(current,c.id,{nowUtc:c.now,outcome:c.outcome||'completed'});current=r.state;}else if(c.op==='verify')r=R.HexLifeProviders.verify(current,c.receipt);else if(c.op==='finalize'){r=R.HexLifeProviders.finalize(current,c.id);current=r;}else if(c.op==='ad'){r=R.HexLifeProviders.setAdAvailable(current,c.value);current=r;}return plain(r);});output.push({result,state:plain(current??null)});}add(label,{mode:'provider',state,commands},output);}
function repositoryCase(label,initial,commands){const values=new Map(Object.entries(plain(initial)).map(([k,v])=>[k,JSON.stringify(v)]));let failure={};const storage={getItem:key=>values.has(key)?values.get(key):null,setItem(key,value){if(key===PK&&failure.profile||[GK,LK].includes(key)&&failure.mirrors||key===EK&&failure.events)throw Error('storage');values.set(key,value);}};const repositories={},output=[];for(const c of commands){let result=catchError(()=>{const id=c.writer||'a',op=c.op;let r;if(op==='open'){repositories[id]=R.HexSessionStore.createStore(storage);r=repositories[id].current();}else if(op==='commit')r=repositories[id].commit(c.game,c.energy);else if(op==='read')r=repositories[id].read(c.key);else if(op==='fail'){failure=c;r=true;}else if(op==='revoke'){repositories[id].revoke();r=true;}else if(op==='write'){storage.setItem(c.key,JSON.stringify(c.value));r=true;}return plain(r);});const id=c.writer||'a';output.push({result,storage:Object.fromEntries([...values].filter(([key])=>[PK,GK,LK,EK].includes(key)).map(([k,v])=>[k,JSON.parse(v)])),revision:repositories[id]?.revision??null,current:repositories[id]?.current()??null});}add(label,{mode:'repository',storage:initial,commands},output);}
function snap(f){
 const profile=JSON.parse(f.w.localStorage.getItem(PK)||'null'),game=plain(profile?.game||f.save()),energy=plain(profile?.energy||f.life()),index=game.current,metadata=game.attempts?.[index]||null,snapshot=game.boards?.[index]||null;
 const base=index<2?f.w.HEX_TUTORIALS[index]:f.w.HEX_LEVELS[index-2],level=index<2?base:metadata?f.w.HexAttempts.createCatalog(f.w.HEX_LEVELS,f.w.HEX_VARIANTS,f.w.HexMatch).resolveLevel(base.id,metadata.variantId,metadata.levelDataVersion):base;
 const engine=snapshot?(snapshot.rulesVersion==='assisted-v1'?new f.w.HexAssistedGame(level,{attemptId:metadata.attemptId,limits:{greenBrush:1,colorKey:1,rescue:1}},snapshot):new f.w.HexMatch(level,snapshot)):null;
 return {game,energy,events:plain(f.events()),view:{stage:index,pending:!snapshot,metadata,snapshot,status:engine?.status??null,life:plain(f.w.HexLives.createManager(f.w.HEX_LIVES_CONFIG,{clock:()=>f.now}).view(energy.life))},rewards:engine&&!engine.assisted?plain(f.w.HexRewardAdapter.restore(engine.level,engine.snapshot(),f.w.HEX_REWARD_RULES,f.w.HexMatch,f.w.HexRewards,metadata?.attemptId||String(engine.level.id)).state):null};
}
async function flow(label,options,steps){const f=mount(options),commands=[{op:'boot'}],gold=[snap(f)];const input={...config,storage:{[GK]:plain(options.saved||fresh()),...(options.life!==undefined?{[LK]:plain(options.life)}:{}),...(options.profile?{[PK]:plain(options.profile)}:{}),...(options.oldV4?{'hexrota-match-v4':plain(options.oldV4)}:{})}};if(options.oldV4)delete input.storage[GK];input.providerNamespace=f.life().provider.namespace;input.selectionSeed=f.save().variantSelection.seed;try{for(const step of steps){commands.push(step.command);await step.run(f);gold.push(snap(f));}add(label,{...input,commands},{flow:gold});flowCount++;}finally{f.close();}}
const op=(command,run)=>({command,run});
function stageEntry(stage,reason='stage_entry',freshValue=true){return op({op:'enter',stage,fresh:freshValue,reason},async f=>{f.click(`[data-stage="${stage}"]`);f.click('#pregame-start');await wait(1);});}
function restartStep(confirmed=true){return op({op:'restart',confirmed},async f=>{f.click('#reset');if(f.node('#restart-dialog').open)f.click(confirmed?'#restart-confirm':'#restart-cancel');await wait(1);});}
function rewardedSave(stage){
 const saved=existing(stage,{turns:0}).saved;
 for(let prior=2;prior<stage;prior++){
  const first=existing(prior,{turns:0}),level=R.HexAttempts.createCatalog(R.HEX_LEVELS,R.HEX_VARIANTS,R.HexMatch).resolveLevel(R.HEX_LEVELS[prior-2].id,first.metadata.variantId,first.metadata.levelDataVersion),won=existing(prior,{turns:level.solution.length});
  for(const key of ['boards','attempts','attemptStats'])saved[key][prior]=plain(won.saved[key][prior]);
  const id=String(level.id);saved.variantSelection.counts[id]=1;saved.variantSelection.recent[id]=[first.metadata.variantId];
 }
 return saved;
}
function assistanceId(saved,itemId){const snapshot=saved.boards[saved.current],attempt=saved.attempts[saved.current];return `assist:${attempt.attemptId}:${(snapshot.commands?.length??snapshot.history.length)+1}:${itemId}`;}
async function chooseBooster(f,itemId,index,value){
 f.click('#open-inventory');f.click(itemId==='greenBrush'?'#use-green-brush':'#use-color-key');f.click(`#board [data-index="${index}"]`);
 assert(f.node('#assistance-dialog').open,'the real assistance preview opens');
 if(itemId==='colorKey'){f.node('#assistance-value').value=String(value);f.node('#assistance-value').dispatchEvent(new f.w.Event('change',{bubbles:true}));}
}
async function confirmBooster(f){f.click('#assistance-confirm');await until(()=>f.node('#board').getAttribute('aria-busy')==='false','assistance presentation ends');}

function writeFailure(f,flags){if(!f._nativeSetItem){f._nativeSetItem=f.w.Storage.prototype.setItem;f.w.Storage.prototype.setItem=function(key,value){const x=f._failure||{};if(key===PK&&x.profile||[GK,LK].includes(key)&&x.mirrors||key===EK&&x.events)throw new f.w.DOMException('storage','QuotaExceededError');return f._nativeSetItem.call(this,key,value);};}f._failure=flags;}

(async()=>{
 // Standalone storage parity includes the complete canonical envelope/revision.
 const g={current:2,done:[0,1],boards:{}},e={schemaVersion:1,life:{lives:5}};
 repositoryCase('repository atomic/cas/rollback/mirror/revoke',{},[{op:'open'},{op:'commit',game:g,energy:e},{op:'open',writer:'b'},{op:'read',key:GK},{op:'commit',game:{...g,current:3},energy:e},{op:'commit',writer:'b',game:g,energy:e},{op:'fail',profile:true},{op:'commit',game:g,energy:e},{op:'fail',mirrors:true},{op:'commit',game:g,energy:e},{op:'read',key:GK},{op:'revoke'},{op:'commit',game:g,energy:e}]);
 repositoryCase('repository legacy mirror baseline',{[GK]:g,[LK]:e},[{op:'open'},{op:'read',key:LK},{op:'commit',game:g,energy:e}]);
 for(const raw of [null,false,0,[], '',{schemaVersion:1,revision:1,game:g,energy:e},{schemaVersion:2,revision:0,game:g,energy:e},{schemaVersion:2,revision:2,game:null,energy:e}])repositoryCase('repository invalid present canonical '+JSON.stringify(raw),{[PK]:raw,[GK]:g,[LK]:e},[{op:'open'}]);
 providerCase('provider all products, duplicates, finalized ranges',null,[{op:'create',namespace:'provider-test'},...R.HexLifeProviders.products.flatMap((product,i)=>[{op:'begin',product,now:NOW+i},{op:'complete',id:'provider-test-'+(i+1),now:NOW+i},{op:'complete',id:'provider-test-'+(i+1),now:NOW+100+i},{op:'finalize',id:'provider-test-'+(i+1)},{op:'complete',id:'provider-test-'+(i+1),now:NOW+200+i}]),{op:'begin',product:'ad_life',now:NOW},{op:'ad',value:false},{op:'complete',id:'provider-test-6',now:NOW+1},{op:'begin',product:'ad_life',now:NOW}]);
 const oldProvider={schemaVersion:1,namespace:'old',nextSerial:1,adAvailable:true,transactions:{}};providerCase('provider frozen v1 migration',oldProvider,[{op:'validate'},{op:'normalize'},{op:'begin',product:'single_life',now:NOW},{op:'complete',id:'old-1',now:NOW,outcome:'cancelled'},{op:'finalize',id:'old-1'}]);
 const badProviders=[{},null,[],{...plain(oldProvider),schemaVersion:3},{...plain(oldProvider),namespace:'x\n'},{...plain(oldProvider),nextSerial:0}];for(const state of badProviders)providerCase('provider malformed '+JSON.stringify(state),state,[{op:'validate'}]);
 // Full real-app goldens, including all persisted stats/selection/reward-independent state.
 await flow('fresh start, preview, valid swap, hint, cancel restart, restart', {saved:fresh(),life:lifePool(5)},[
  op({op:'preview',stage:2},f=>{f.click('[data-stage="2"]');f.click('#pregame-dialog [data-close]');}),
  op({op:'enter',stage:2,fresh:true,reason:'stage_entry'},enter),
  op({op:'hint'},async f=>{f.click('#hint');await until(()=>f.events().events.some(e=>e.name==='hint_used'),'real app hint');}),
  op({op:'swap',pair:plain(R.HexAttempts.createCatalog(R.HEX_LEVELS,R.HEX_VARIANTS,R.HexMatch).start(1,{attemptSerial:1,selectionSeed:0x41abca}).level.solution[0])},async f=>move(f,plain(f.game().level.solution[0]))),
  restartStep(false),restartStep(true)
 ]);
 const resumed=existing();await flow('zero life saved resume, menu, close and reload',{saved:resumed.saved,life:lifePool(0)},[
  op({op:'enter',stage:2,reason:'stage_entry'},enter),
  op({op:'menu'},f=>{f.click('#pause');f.click('#pause-home');}),
  op({op:'close'},f=>f.w.dispatchEvent(new f.w.Event('pagehide'))),
  op({op:'boot'},()=>{})
 ]);
 await flow('zero life blocks main and tutorial stays free',{saved:fresh(),life:lifePool(0)},[
  op({op:'enter',stage:2,fresh:true,reason:'stage_entry'},enter),
  op({op:'enter',stage:0,fresh:true,reason:'free_tutorial'},f=>f.click('#lives-teach')),
  op({op:'hint'},f=>f.click('#hint')),
  op({op:'swap',pair:[4,3]},f=>move(f,[4,3])),
  op({op:'ack'},f=>f.click('#coach-next'))
 ]);
 for(const stage of Array.from({length:10},(_,i)=>i+2)){
  const entry=existing(stage,{turns:0}),level=R.HexAttempts.createCatalog(R.HEX_LEVELS,R.HEX_VARIANTS,R.HexMatch).resolveLevel(R.HEX_LEVELS[stage-2].id,entry.metadata.variantId,entry.metadata.levelDataVersion);
  const steps=[op({op:'enter',stage,reason:'stage_entry'},enter),...plain(level.solution).map(pair=>op({op:'swap',pair},f=>move(f,pair)))];
  await flow('real winning route stage '+stage,{saved:entry.saved,life:lifePool(5)},steps);
 }
 const lost=existing(6,{lost:true});await flow('terminal loss recovery and new retry variant',{saved:lost.saved,life:lifePool(5)},[
  op({op:'enter',stage:6,fresh:true,reason:'replay'},enter)
 ]);
 const legacy=existing(2,{turns:1,legacy:true});await flow('legacy-original live save restore',{saved:legacy.saved,life:lifePool(5)},[op({op:'enter',stage:2},enter)]);
 await flow('old v4 campaign stage shift',{oldV4:{current:0,done:[],boards:{0:plain(legacy.game.snapshot())},sound:true},life:lifePool(5)},[]);
 await flow('new life bootstrap with existing legacy terminal board',{saved:existing(2,{lost:true,legacy:true}).saved},[]);
 await flow('natural regen and test wallet/ad/offline receipts',{saved:fresh(),life:lifePool(3)},[
  op({op:'begin',product:'ad_life'},f=>{f.click('#home-lives');f.click('#lives-ad');}),
  op({op:'time',value:NOW+30*MINUTE},f=>{f.now=NOW+30*MINUTE;}),
  op({op:'complete',id:'ui-test-1'},f=>f.click('#life-provider-confirm')),
  op({op:'begin',product:'test_gold_300'},f=>{f.click('#life-provider-dialog [data-close]');f.click('#lives-dialog [data-close]');f.click('#settings');f.click('#setting-test-gold');}),
  op({op:'complete',id:'ui-test-2'},f=>f.click('#life-provider-confirm'))
 ]);

 const frozenLife=plain(lifePool(5));frozenLife.life=plain(require('./fixtures/lives-vectors-v1.json').cases[0].steps[0].expectedState);
 await flow('frozen life v1 inside old prototype migrates without losing game',{saved:resumed.saved,life:frozenLife},[op({op:'enter',stage:2},enter)]);
 await flow('v5 indexed array checkpoint containers',{saved:{...legacy.saved,boards:[null,null,plain(legacy.game.snapshot())]},life:lifePool(5)},[]);
 await flow('v4 indexed array checkpoint containers',{oldV4:{current:0,done:[],boards:[plain(legacy.game.snapshot())]},life:lifePool(5)},[]);
 for(const count of [0,1])await flow('confirmed played restart at '+count+' life is discarded and cannot move',{saved:resumed.saved,life:lifePool(count)},[
  op({op:'enter',stage:2},enter),restartStep(true),
  op({op:'swap',pair:plain(resumed.game.level.solution[1])},f=>move(f,plain(resumed.game.level.solution[1]))),
  op({op:'hint'},f=>f.click('#hint'))
 ]);
 // A real move which would win must not survive a failed canonical write, debit
 // a life, unlock a stage, or leave a durable terminal analytics event.
 const winEntry=existing(2,{turns:0}),winLevel=R.HexAttempts.createCatalog(R.HEX_LEVELS,R.HEX_VARIANTS,R.HexMatch).resolveLevel(1,winEntry.metadata.variantId,winEntry.metadata.levelDataVersion),nearWin=existing(2,{turns:winLevel.solution.length-1}),last=plain(winLevel.solution.at(-1));
 await flow('winning move canonical failure rollback and retry',{saved:nearWin.saved,life:lifePool(5)},[
  op({op:'enter',stage:2},enter),op({op:'fail',profile:true},f=>writeFailure(f,{profile:true})),
  op({op:'swap',pair:last},f=>move(f,last)),op({op:'fail'},f=>writeFailure(f,{})),op({op:'refresh'},f=>f.return()),op({op:'swap',pair:last},f=>move(f,last))
 ]);
 await flow('analytics write failure does not undo a committed move',{saved:resumed.saved,life:lifePool(5)},[
  op({op:'enter',stage:2},enter),op({op:'fail',events:true},f=>writeFailure(f,{events:true})),
  op({op:'hint'},async f=>{f.click('#hint');await wait(5);}),op({op:'fail'},f=>writeFailure(f,{})),op({op:'menu'},f=>{f.click('#pause');f.click('#pause-home');})
 ]);
 await flow('TEST purchase and unlimited attempt protection after expiry',{saved:fresh(),life:lifePool(3)},[
  op({op:'begin',product:'unlimited_lives_30m'},f=>{f.click('#home-lives');f.click('#lives-buy-unlimited');}),
  op({op:'complete',id:'ui-test-1'},f=>f.click('#life-provider-confirm')),
  op({op:'enter',stage:2,fresh:true,reason:'stage_entry'},async f=>{f.click('#lives-dialog [data-close]');await enter(f);}),
  op({op:'swap',pair:plain(R.HexAttempts.createCatalog(R.HEX_LEVELS,R.HEX_VARIANTS,R.HexMatch).start(1,{attemptSerial:1,selectionSeed:0x41abca}).level.solution[0])},f=>move(f,plain(f.game().level.solution[0]))),
  op({op:'time',value:NOW+31*MINUTE},f=>{f.now=NOW+31*MINUTE;}),restartStep(true)
 ]);
 // Native host guards and fault injection supplement the direct JS-app parity.
 const baseInput={storage:{[GK]:resumed.saved,[LK]:lifePool(5)}};
 nativeCase('duplicate move/attempt callbacks require observed envelope',{...baseInput,commands:[{op:'boot'},{op:'enter',stage:2},{op:'swap',pair:plain(resumed.game.level.solution[1]),envelope:{attemptId:resumed.metadata.attemptId,turn:1}},{op:'swap',pair:plain(resumed.game.level.solution[1]),envelope:{attemptId:resumed.metadata.attemptId,turn:1}},{op:'retry'},{op:'restart',confirmed:false}]},a=>{assert.equal(a[2].result.ok,true);assert.equal(a[3].result.reason,'stale_turn');assert.deepEqual(a[3].profile,a[2].profile);assert.equal(a[4].result.reason,'confirmation_required');assert.deepEqual(a[4].profile,a[3].profile);assert.equal(a[5].result.reason,'cancelled');});
 nativeCase('two native writers reject stale game+life transaction',{...baseInput,commands:[{op:'boot'},{op:'enter',stage:2},{op:'otherWriter'},{op:'swap',pair:plain(resumed.game.level.solution[1])}]},a=>{assert.equal(a[3].result.reason,'stale_profile');assert.deepEqual(a[3].profile,a[2].profile);assert.equal(a[3].profile.game.boards[2].turn,1);assert.equal(a[3].profile.energy.life.lives,5);});
 for(const [label,storage] of [['present null life',{[GK]:fresh(),[LK]:null}],['invalid snapshot',{[GK]:{...resumed.saved,boards:{2:{...resumed.saved.boards[2],score:999999}}},[LK]:lifePool(5)}],['wrong typed metadata',{[GK]:{...resumed.saved,attempts:{2:{...resumed.metadata,levelId:'1'}}},[LK]:lifePool(5)}],['null checkpoint',{[GK]:{...resumed.saved,boards:{2:null}},[LK]:lifePool(5)}],['aliased checkpoint key',{[GK]:{...resumed.saved,boards:{'02':resumed.saved.boards[2]}},[LK]:lifePool(5)}]])nativeCase('invalid save preserved: '+label,{storage,commands:[{op:'boot'}]},a=>{assert(a[0].result.error,label);assert.equal(a[0].profile,null,label+' no replacement canonical profile');});
 const provider1=R.HexLifeProviders.begin(lifePool(3).provider,{productId:'test_gold_300',nowUtc:NOW}),completed1=plain(R.HexLifeProviders.complete(provider1.state,provider1.transactionId,{nowUtc:NOW}));
 nativeCase('stale completed provider snapshot preserves newer issued transaction',{storage:{[GK]:fresh(),[LK]:lifePool(3)},commands:[{op:'boot'},{op:'begin',product:'test_gold_300'},{op:'begin',product:'test_gold_300'},{op:'receipt',receipt:completed1.receipt,provider:completed1.state},{op:'complete',id:'ui-test-2'},{op:'receipt',receipt:completed1.receipt,provider:completed1.state}]},a=>{assert.equal(a[3].result.ok,true);assert.equal(a[3].state.energy.provider.nextSerial,3);assert(a[3].state.energy.provider.transactions['ui-test-2']);assert.equal(a[4].result.ok,true);assert.equal(a[4].state.energy.testWallet.gold,900);assert.equal(a[5].result.reason,'duplicate_transaction');assert.equal(a[5].state.energy.testWallet.gold,900);});
 const recoveryCommands=[{op:'boot'},{op:'begin',product:'test_gold_300'},{op:'fail',profile:true},{op:'receipt',receipt:completed1.receipt,provider:completed1.state},{op:'fail'},{op:'boot'},{op:'receipt',receipt:completed1.receipt,provider:completed1.state},{op:'receipt',receipt:completed1.receipt,provider:completed1.state}];
 nativeCase('untrusted cancelled TEST receipt cannot revive after reopen',{storage:{[GK]:fresh(),[LK]:lifePool(3)},commands:recoveryCommands},a=>{assert.equal(a[3].result.reason,'storage');assert.equal(a[3].state.energy.testWallet.gold,300);assert.equal(a[6].result.reason,'unverified_receipt');assert.equal(a[7].state.energy.testWallet.gold,300);});
 nativeCase('independent verifier permits once-only completed receipt recovery',{storage:{[GK]:fresh(),[LK]:lifePool(3)},trustedRecoveryReceipts:[completed1.receipt],commands:recoveryCommands},a=>{assert.equal(a[3].result.reason,'storage');assert.equal(a[6].result.ok,true);assert.equal(a[6].state.energy.testWallet.gold,600);assert.equal(a[7].result.reason,'duplicate_transaction');assert.equal(a[7].state.energy.testWallet.gold,600);});

 const boundaryLife=lifePool(0);boundaryLife.life.unlimitedUntilUtc=NOW+MINUTE;
 nativeCase('unlimited expiry between CanStart and Register aborts atomically',{storage:{[GK]:fresh(),[LK]:boundaryLife},commands:[{op:'boot'},{op:'enter',stage:2,fresh:true,clockTimes:[NOW+MINUTE-1,NOW+MINUTE-1,NOW+MINUTE+1]}]},a=>{assert.equal(a[1].result.reason,'no_lives');assert.deepEqual(a[1].profile,a[0].profile);assert.deepEqual(a[1].state.game.boards,{});assert.equal(a[1].state.game.variantSelection.serial,0);});
 // The command boundary enforces the same one-time campaign rule as the UI.
 // Stale dialogs and direct repeated calls must not reopen or re-award a win.
 nativeCase('one-time win rejects stale commands and survives reset/reopen',{storage:{[GK]:nearWin.saved,[LK]:lifePool(5)},commands:[{op:'boot'},{op:'enter',stage:2},{op:'swap',pair:last},{op:'swap',pair:last},{op:'hint'},{op:'retry'},{op:'restart',confirmed:true},{op:'preview',stage:2},{op:'enter',stage:2,fresh:true,confirmed:true},{op:'reset',confirmed:true},{op:'boot'},{op:'enter',stage:2,fresh:true,confirmed:true}]},a=>{
  assert.equal(a[2].result.reason,'won');const won=a[2].state.game.economy;assert.equal(won.gold,20);assert.equal(won.stars,1);
  for(const i of [3,4,5,6,7,8]){assert.equal(a[i].result.reason,'level_completed');assert.deepEqual(a[i].profile,a[2].profile);}
  for(const i of [9,10,11]){assert.deepEqual(a[i].state.game.economy,won);assert(a[i].state.game.done.includes(2));assert(a[i].state.game.boards[2]);}
  assert.equal(a[10].state.view.stage,3);assert.equal(a[10].state.view.pending,true);assert.equal(a[11].result.reason,'level_completed');
 });
 nativeCase('unproven legacy completions close permanently without invented awards',{storage:{[GK]:fresh(5),[LK]:lifePool(5)},commands:[{op:'boot'},{op:'enter',stage:2},{op:'reset',confirmed:true},{op:'boot'}]},a=>{
  assert.equal(a[0].state.game.economy.gold,0);assert.equal(a[0].state.game.economy.stars,0);assert.equal(a[1].result.reason,'level_completed');
  for(const i of [0,2,3]){assert.deepEqual(a[i].state.game.done,[2,3,4].concat(i===0?[0,1]:[]).sort((x,y)=>x-y));assert.equal(a[i].state.view.stage,5);}
 });
 for(const economy of [null,{schemaVersion:99}])nativeCase('present invalid economy is preserved '+JSON.stringify(economy),{storage:{[GK]:{...fresh(),economy},[LK]:lifePool(5)},commands:[{op:'boot'}]},a=>{assert(a[0].result.error);assert.equal(a[0].profile,null);});
 const finalBase=existing(11,{turns:0}),finalLevel=R.HexAttempts.createCatalog(R.HEX_LEVELS,R.HEX_VARIANTS,R.HexMatch).resolveLevel(10,finalBase.metadata.variantId,finalBase.metadata.levelDataVersion),finalNear=existing(11,{turns:finalLevel.solution.length-1});
 nativeCase('final campaign win never loops into a replay',{storage:{[GK]:finalNear.saved,[LK]:lifePool(5)},commands:[{op:'boot'},{op:'enter',stage:11},{op:'swap',pair:plain(finalLevel.solution.at(-1))},{op:'retry'},{op:'boot'},{op:'enter',stage:11}]},a=>{assert.equal(a[2].result.reason,'won');assert.equal(a[3].result.reason,'level_completed');assert.equal(a[4].state.view.stage,0);assert.equal(a[5].result.reason,'level_completed');assert.equal(a[4].state.game.economy.clearedLevelIds.length,10);assert.equal(a[4].state.game.economy.gold,20);assert.equal(a[4].state.game.economy.stars,1);});
 const loss=existing(4,{lost:true}),lossStart=plain(loss.saved);lossStart.boards[4]=plain(new R.HexMatch(loss.game.level).snapshot());lossStart.attemptStats[4]={...lossStart.attemptStats[4],terminalEvent:null,cascades:0,started:false};
 await flow('genuine active failure settles life exactly once then retries',{saved:lossStart,life:lifePool(5)},[
  op({op:'enter',stage:4,reason:'replay'},enter),...plain(loss.game.history).map(pair=>op({op:'swap',pair},f=>move(f,pair))),
  op({op:'retry',reason:'retry'},async f=>{f.click('#retry');await wait(1);})
 ]);
 await flow('confirmed progress reset preserves energy wallet and selection serial',{saved:resumed.saved,life:lifePool(5)},[
  op({op:'enter',stage:2},enter),op({op:'reset',confirmed:false},f=>{f.click('#game-settings');f.click('#settings-reset');f.click('#reset-cancel');}),
  op({op:'reset',confirmed:true},f=>{f.click('#settings-reset');f.click('#reset-confirm');})
 ]);
 // Both assistance commands go through the real mobile UI, preview, atomic
 // profile transaction and command-aware save reader, never a JS session clone.
 const inventorySave=rewardedSave(8),inventoryMeta=inventorySave.attempts[8],inventoryLevel=R.HexAttempts.createCatalog(R.HEX_LEVELS,R.HEX_VARIANTS,R.HexMatch).resolveLevel(7,inventoryMeta.variantId,inventoryMeta.levelDataVersion),simulation=new R.HexAssistedGame(inventoryLevel,{attemptId:inventoryMeta.attemptId,limits:{greenBrush:1,colorKey:1,rescue:1}},inventorySave.boards[8]);
 const brushIndex=simulation.layers.findIndex(layer=>layer===1),brushId=assistanceId(inventorySave,'greenBrush');assert(brushIndex>=0);assert(simulation.apply({id:brushId,type:'green_brush',index:brushIndex}).ok);
 let keyChoice;for(let index=0;index<simulation.total;index++)for(const value of inventoryLevel.palette)if(value!==simulation.values[index]){
  const preview=simulation.preview({id:`assist:${inventoryMeta.attemptId}:${simulation.commands.length+1}:colorKey`,type:'color_key',index,value});
  if(preview.result.ok&&preview.status==='playing'&&preview.result.frames.length&&(!keyChoice||preview.result.scoreGain>keyChoice.gain))keyChoice={index,value,gain:preview.result.scoreGain};
 }assert(keyChoice,'a deterministic real key match remains playable');
 const keyId=`assist:${inventoryMeta.attemptId}:${simulation.commands.length+1}:colorKey`;simulation.apply({id:keyId,type:'color_key',index:keyChoice.index,value:keyChoice.value});const assistedSwap=plain(simulation.legalMoves()[0]);
 await flow('real brush/key preview, inventory purchase, assisted swap/hint and reopen',{saved:inventorySave,life:lifePool(5)},[
  op({op:'enter',stage:8},enter),
  op({op:'previewBooster',itemId:'greenBrush',index:brushIndex,operationId:brushId},f=>chooseBooster(f,'greenBrush',brushIndex)),
  op({op:'useBooster',quoteFromPreview:true,itemId:'greenBrush',index:brushIndex,operationId:brushId},confirmBooster),
  op({op:'previewBooster',itemId:'colorKey',index:keyChoice.index,value:keyChoice.value,operationId:keyId},f=>chooseBooster(f,'colorKey',keyChoice.index,keyChoice.value)),
  op({op:'useBooster',quoteFromPreview:true,itemId:'colorKey',index:keyChoice.index,value:keyChoice.value,operationId:keyId},confirmBooster),
  op({op:'purchaseInventory',itemId:'greenBrush',operationId:'purchase:greenBrush:11'},f=>{f.click('#open-inventory');f.click('#buy-green-brush');f.click('#inventory-dialog [data-close]');}),
  op({op:'swap',pair:assistedSwap},f=>move(f,assistedSwap)),
  op({op:'hint',maxDepth:1},async f=>{f.click('#hint');await until(()=>f.events().events.some(event=>event.name==='hint_used'),'assisted real hint');}),
  op({op:'close'},f=>f.w.dispatchEvent(new f.w.Event('pagehide'))),op({op:'boot'},()=>{})
 ]);
 await flow('brush canonical write failure rolls back stock, board and event together',{saved:inventorySave,life:lifePool(5)},[
  op({op:'enter',stage:8},enter),op({op:'previewBooster',itemId:'greenBrush',index:brushIndex,operationId:brushId},f=>chooseBooster(f,'greenBrush',brushIndex)),
  op({op:'fail',profile:true},f=>writeFailure(f,{profile:true})),op({op:'useBooster',quoteFromPreview:true,itemId:'greenBrush',index:brushIndex,operationId:brushId},confirmBooster),
  op({op:'fail'},f=>writeFailure(f,{})),op({op:'refresh'},f=>f.return())
 ]);
 nativeCase('inventory duplicate, invalid target, cap and stale preview are atomic',{storage:{[GK]:inventorySave,[LK]:lifePool(5)},commands:[{op:'boot'},{op:'enter',stage:8},{op:'previewBooster',itemId:'greenBrush',index:brushIndex,operationId:brushId},{op:'useBooster',quoteFromPreview:true,itemId:'greenBrush',index:brushIndex,operationId:brushId},{op:'useBooster',quoteFromPreview:true,itemId:'greenBrush',index:brushIndex,operationId:brushId},{op:'useBooster',quoteFromPreview:true,itemId:'greenBrush',index:brushIndex,operationId:brushId+'-again'},{op:'useBooster',quoteFromPreview:true,itemId:'colorKey',index:keyChoice.index,value:keyChoice.value,operationId:keyId,envelope:{revision:2}},{op:'boot'}]},a=>{
  assert.deepEqual(a[2].state.game,a[1].state.game);assert.equal(a[3].state.game.economy.inventory.greenBrush,2);assert.equal(a[4].result.reason,'duplicate_transaction');assert.deepEqual(a[4].profile,a[3].profile);assert.equal(a[5].result.reason,'ground_empty');assert.equal(a[6].result.reason,'stale_revision');assert.deepEqual(a[6].profile,a[3].profile);assert.deepEqual(a[7].state.game,a[3].state.game);assert.equal(a[7].state.rewards,null);
 });
 const firstKeyId=`assist:${inventoryMeta.attemptId}:${inventorySave.boards[8].history.length+1}:colorKey`;
 nativeCase('booster confirmation requires the exact current preview quote',{storage:{[GK]:inventorySave,[LK]:lifePool(5)},commands:[{op:'boot'},{op:'enter',stage:8},{op:'previewBooster',itemId:'greenBrush',index:brushIndex,operationId:brushId},{op:'useBooster',itemId:'greenBrush',index:brushIndex,operationId:brushId},{op:'useBooster',quoteFromPreview:true,itemId:'colorKey',index:keyChoice.index,value:keyChoice.value,operationId:firstKeyId},{op:'useBooster',quoteFromPreview:true,itemId:'greenBrush',index:brushIndex,operationId:brushId},{op:'useBooster',quoteFromPreview:true,itemId:'colorKey',index:keyChoice.index,value:keyChoice.value,operationId:keyId,envelope:{turn:0}},{op:'previewBooster',itemId:'colorKey',index:keyChoice.index,value:keyChoice.value,operationId:keyId},{op:'refresh'},{op:'useBooster',quoteFromPreview:true,itemId:'colorKey',index:keyChoice.index,value:keyChoice.value,operationId:keyId}]},a=>{
  assert.equal(a[3].result.reason,'preview_required');assert.equal(a[4].result.reason,'stale_preview');assert.deepEqual(a[4].profile,a[2].profile);assert.equal(a[5].result.ok,true);assert.equal(a[5].state.game.boards[8].turn,0);assert.equal(a[6].result.reason,'preview_required');assert.deepEqual(a[6].profile,a[5].profile);assert.deepEqual(a[8].state.game.boards,a[7].state.game.boards);assert.equal(a[9].result.reason,'stale_preview');assert.deepEqual(a[9].profile,a[8].profile);
 });
 const em=R.HexEconomy.createManager(R.HEX_ECONOMY_CONFIG),initialEconomy=plain(em.migrate(null,{done:inventorySave.done,verifiedLevelIds:[1,2,3,4,5,6],sourceKey:GK}).state),oneBrush=new R.HexAssistedGame(inventoryLevel,{attemptId:inventoryMeta.attemptId,limits:{greenBrush:1,colorKey:1,rescue:1}},inventorySave.boards[8]);oneBrush.apply({id:brushId,type:'green_brush',index:brushIndex});
 const paidBrush=plain(em.consume(initialEconomy,{operationId:brushId,itemId:'greenBrush',attemptId:inventoryMeta.attemptId,levelId:7}).state),assistedValid={...plain(inventorySave),economy:paidBrush,boards:{...plain(inventorySave.boards),8:plain(oneBrush.snapshot())}};
 for(const [label,mutate] of [
  ['mechanical command without debit',s=>{s.economy=plain(initialEconomy);}],
  ['paid debit omitted from classic checkpoint',s=>{s.boards[8]=plain(inventorySave.boards[8]);}],
  ['expanded snapshot limits',s=>{s.boards[8].limits.greenBrush=100;}],
  ['string numeric metadata',s=>{s.attempts[8].levelId='7';}],
  ['all-swap assisted envelope',s=>{s.economy=plain(initialEconomy);s.boards[8]=plain(new R.HexAssistedGame(inventoryLevel,{attemptId:inventoryMeta.attemptId,limits:{greenBrush:1,colorKey:1,rescue:1}},inventorySave.boards[8]).snapshot());}],
  ['legacy identity hides paid command',s=>{s.boards[8]=plain(new R.HexMatch(R.HEX_LEVELS[6]).snapshot());delete s.attempts[8];s.economy=plain(em.consume(initialEconomy,{operationId:'assist:legacy-7:1:greenBrush',itemId:'greenBrush',attemptId:'legacy-7',levelId:7}).state);}]
 ]){const saved=plain(assistedValid);mutate(saved);nativeCase('assistance authorization fails closed: '+label,{storage:{[GK]:saved,[LK]:lifePool(5)},commands:[{op:'boot'}]},a=>{assert(a[0].result.error,label);assert.equal(a[0].profile,null,'invalid board/economy pairing never overwrites the save');});}
 nativeCase('valid assisted checkpoint resumes at zero life',{storage:{[GK]:assistedValid,[LK]:lifePool(0)},commands:[{op:'boot'},{op:'enter',stage:8},{op:'close'},{op:'boot'}]},a=>{assert.equal(a[1].result.reason,'resumed');assert.deepEqual(a[1].state.game.boards[8],assistedValid.boards[8]);assert.equal(a[1].state.energy.life.lives,0);assert.equal(a[3].state.rewards,null);});
 // Native compile and compare occurs only after actual JS goldens exist.
 const result=run(sdk,[path.join(build,'ApplicationParityHarness.dll')],{input:cases.map(c=>JSON.stringify(c.input)).join('\n')+'\n'}).trim().split('\n').map(JSON.parse);
 assert.equal(result.length,cases.length);
 for(let i=0;i<cases.length;i++){
  const gold=expected[i],actual=result[i];if(nativeChecks.has(i)){try{nativeChecks.get(i)(actual);}catch(error){fs.writeFileSync(path.join(build,'failure.json'),JSON.stringify({label:cases[i].label,actual},null,2));console.error(cases[i].label+' diagnostic '+path.join(build,'failure.json'));throw error;}continue;}
  if(gold.flow){assert(Array.isArray(actual),cases[i].label+': '+JSON.stringify(actual));assert.equal(actual.length,gold.flow.length);for(let j=0;j<gold.flow.length;j++){const state=actual[j].state?{...actual[j].state,events:actual[j].durableEvents}:null;assert(state,cases[i].label+' step '+j+': '+JSON.stringify(actual[j]));for(const field of ['game','energy','events','view','rewards']){try{assert.deepEqual(state[field],gold.flow[j][field]);}catch(error){fs.writeFileSync(path.join(build,'failure.json'),JSON.stringify({label:cases[i].label,command:cases[i].input.commands[j],actual:actual[j],expected:gold.flow[j]},null,2));error.message=cases[i].label+' step '+j+' '+field+' (full diagnostic '+path.join(build,'failure.json')+')\n'+error.message;throw error;}comparisons++;}}}
  else{try{assert.deepEqual(actual,gold,cases[i].label);}catch(error){fs.writeFileSync(path.join(build,'failure.json'),JSON.stringify({label:cases[i].label,actual,expected:gold},null,2));console.error('Diagnostic '+path.join(build,'failure.json'));throw error;}comparisons+=gold.length;}
 }
 fs.rmSync(build,{recursive:true,force:true});
 console.log(`C# session parity passed: ${comparisons} full JSON comparisons; ${flowCount} real app.js flows; ${nativeChecks.size} native fault/guard scenarios; canonical profile/revision, provider receipts, migration and atomic rollback covered. Physical Unity/iOS/Android tests remain outside this harness.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
