/* Pure transient coordination contracts: no simulated engine or persistence. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const Core=require('./dist/app-state.js');
let groups=0,checks=0;
const eq=(actual,expected,message)=>{checks++;assert.deepEqual(actual,expected,message);};
function check(name,run){run();groups++;console.log('PASS '+name);}
const facts={gameAvailable:true,engineStatus:'playing'};
const nav=(store,screen,extra={})=>store.dispatch({type:'NAVIGATE',screen},{...facts,...extra});
const open=(store,id,extra={})=>store.dispatch({type:'OPEN_MODAL',id},{...facts,...extra});
const entry=(store,id)=>store.snapshot().overlays.modals.find(modal=>modal.id===id);
const close=(store,id)=>store.dispatch({type:'CLOSE_MODAL',...entry(store,id)});
const game=()=>{const store=Core.create();eq(nav(store,'game').accepted,true);return store;};
const plain=value=>JSON.parse(JSON.stringify(value));
const recursivelyFrozen=value=>!value||typeof value!=='object'||Object.isFrozen(value)&&Object.values(value).every(recursivelyFrozen);
const unchanged=(store,event,expectedFacts={},reason)=>{const before=store.snapshot(),result=store.dispatch(event,expectedFacts);eq(result.changed,false);eq(result.state,before);eq(result.effects,[]);if(reason)eq(result.reason,reason);return result;};

check('initial regions and every actual screen are explicit and independently immutable',()=>{
 const state=Core.initialState();eq(state.navigation.screen,'home');eq(state.overlays.modals,[]);eq(state.lifecycle,{hidden:false,suspended:false});eq(Core.isPaused(state),false);eq(Core.topModalId(state),null);eq(recursivelyFrozen(state),true);
 eq(Core.SCREENS,['home','game','journey','records','garden']);eq(Object.keys(state),['navigation','overlays','lifecycle','operations']);
 const store=Core.create();for(const screen of Core.SCREENS){eq(nav(store,screen).accepted,true);eq(store.snapshot().navigation.screen,screen);unchanged(store,{type:'NAVIGATE',screen},facts);}
});
check('invalid navigation has no cancellation, modal, subscription or other effects',()=>{
 const store=game();open(store,'pause-dialog');let notifications=0;store.subscribe(()=>notifications++);
 for(const screen of ['settings','unknown','GAME',null,1,{},[],false]){const r=unchanged(store,{type:'NAVIGATE',screen},facts,'invalid_screen');eq(r.accepted,false);}
 const before=store.snapshot();eq(unchanged(store,{type:'NAVIGATE',screen:'home'},{blocked:true}).accepted,false);eq(store.snapshot(),before);eq(notifications,0);eq(Core.isPaused(store.snapshot()),true);
 const home=Core.create();eq(unchanged(home,{type:'NAVIGATE',screen:'game'},{}).reason,'game_unavailable');eq(home.snapshot().navigation.screen,'home');
});
check('all15 declared modal identities match the real DOM and real result guards',()=>{
 const html=fs.readFileSync(__dirname+'/dist/index.html','utf8');eq(Object.keys(Core.MODALS).sort(),[...html.matchAll(/<dialog\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]).sort());eq(Object.keys(Core.MODALS).length,15);
 const routes={
  'help-dialog':[], 'win-dialog':[], 'lose-dialog':[], 'inventory-dialog':[], 'assistance-dialog':[],
  'rescue-provider-dialog':['lose-dialog'],'pregame-dialog':[],'pause-dialog':[],'settings-dialog':[],
  'install-dialog':['settings-dialog'],'lives-dialog':[],'life-provider-dialog':['lives-dialog'],
  'restart-dialog':[],'full-reset-dialog':['settings-dialog'],'reset-dialog':['settings-dialog']
 };
 for(const [id,parents]of Object.entries(routes)){const store=game(),status=['win-dialog'].includes(id)?'won':['lose-dialog','rescue-provider-dialog'].includes(id)?'lost':'playing';for(const parent of parents)eq(open(store,parent,{engineStatus:status}).accepted,true,id+' parent');eq(open(store,id,{engineStatus:status}).accepted,true,id);eq(Core.topModalId(store.snapshot()),id);eq(recursivelyFrozen(store.snapshot()),true);}
 for(const [id,status]of [['win-dialog','won'],['lose-dialog','lost'],['pause-dialog','playing']])for(const wrong of ['playing','won','lost',null].filter(v=>v!==status)){const store=game();eq(open(store,id,{engineStatus:wrong}).accepted,false,id+' requires exact engine outcome');eq(store.snapshot().overlays.modals,[]);}
});
check('finite nesting permits current flows and rejects every unrelated modal pairing',()=>{
 const routes={
  'help-dialog':['help-dialog'],'win-dialog':['win-dialog'],'lose-dialog':['lose-dialog'],
  'inventory-dialog':['inventory-dialog'],'assistance-dialog':['assistance-dialog'],
  'rescue-provider-dialog':['lose-dialog','rescue-provider-dialog'],'pregame-dialog':['pregame-dialog'],
  'pause-dialog':['pause-dialog'],'settings-dialog':['settings-dialog'],'install-dialog':['install-dialog'],
  'lives-dialog':['lives-dialog'],'life-provider-dialog':['lives-dialog','life-provider-dialog'],
  'restart-dialog':['restart-dialog'],'full-reset-dialog':['settings-dialog','full-reset-dialog'],'reset-dialog':['settings-dialog','reset-dialog']
 };
 const permitted=new Set([
  'pause-dialog>settings-dialog','pause-dialog>restart-dialog',
  'settings-dialog>install-dialog','settings-dialog>reset-dialog','settings-dialog>full-reset-dialog','settings-dialog>life-provider-dialog','settings-dialog>lives-dialog',
  'pregame-dialog>restart-dialog','pregame-dialog>lives-dialog','restart-dialog>lives-dialog',
  'lose-dialog>rescue-provider-dialog','lose-dialog>lives-dialog','lives-dialog>life-provider-dialog'
 ]);
 for(const [parent,route]of Object.entries(routes))for(const child of Object.keys(Core.MODALS)){
  if(route.includes(child))continue;
  const store=game();for(const id of route){const status=id==='win-dialog'?'won':id==='lose-dialog'||id==='rescue-provider-dialog'?'lost':'playing';eq(open(store,id,{engineStatus:status,recovery:id==='rescue-provider-dialog'}).accepted,true,'fixture '+id);}
  const result=open(store,child,{engineStatus:child==='win-dialog'?'won':child==='lose-dialog'||child==='rescue-provider-dialog'?'lost':'playing'});eq(result.accepted,permitted.has(parent+'>'+child),parent+'>'+child);
  if(!result.accepted)eq(result.effects,[]);
 }
 const nested=game();for(const id of ['pause-dialog','settings-dialog','full-reset-dialog'])eq(open(nested,id).accepted,true);eq(Core.isPaused(nested.snapshot()),true);close(nested,'full-reset-dialog');close(nested,'settings-dialog');eq(Core.isPaused(nested.snapshot()),true);close(nested,'pause-dialog');eq(Core.isPaused(nested.snapshot()),false);
});
check('verified delivery recovery roots are explicit and do not bypass other result guards',()=>{
 for(const screen of Core.SCREENS)for(const id of ['life-provider-dialog','rescue-provider-dialog']){const store=Core.create();nav(store,screen);eq(open(store,id).accepted,false,'normal provider has original caller');eq(open(store,id,{recovery:true}).accepted,true,'verified earned proof remains deliverable');}
 const store=game();open(store,'settings-dialog');eq(open(store,'rescue-provider-dialog').accepted,false);eq(open(store,'rescue-provider-dialog',{recovery:true}).accepted,true);eq(Core.isPaused(store.snapshot()),false);
 const invalid=game();eq(open(invalid,'win-dialog',{recovery:true}).accepted,false,'recovery never manufactures a win');
 const home=Core.create();eq(open(home,'restart-dialog').accepted,false,'restart root belongs to the existing game');open(home,'pregame-dialog');eq(open(home,'restart-dialog').accepted,true,'home preview restart nesting preserved');
});
check('modal instances fence stale closes; duplicate delivery is idempotent',()=>{
 const store=game();open(store,'pause-dialog');const old=entry(store,'pause-dialog');unchanged(store,{type:'OPEN_MODAL',id:old.id},facts,'already_open');close(store,old.id);unchanged(store,{type:'CLOSE_MODAL',...old},{},'already_closed');open(store,old.id);const current=entry(store,old.id);eq(current.instance>old.instance,true);eq(unchanged(store,{type:'CLOSE_MODAL',...old},{},'stale_modal').accepted,false);eq(Core.topModalId(store.snapshot()),old.id);
 open(store,'settings-dialog');const settings=entry(store,'settings-dialog');close(store,'pause-dialog');eq(Core.topModalId(store.snapshot()),'settings-dialog','native sibling close does not close another instance');eq(entry(store,'settings-dialog'),settings);eq(Core.isPaused(store.snapshot()),false);
 const closeAll=store.dispatch({type:'CLOSE_ALL'});eq(closeAll.effects.map(e=>e.modal.id),['settings-dialog']);unchanged(store,{type:'CLOSE_ALL'});
});
check('non-top closes preserve valid nesting instead of orphaning a confirmation',()=>{
 const store=game();for(const id of ['pause-dialog','settings-dialog','full-reset-dialog'])open(store,id);const before=store.snapshot(),settings=entry(store,'settings-dialog');eq(unchanged(store,{type:'CLOSE_MODAL',...settings},{},'modal_topology').accepted,false);eq(store.snapshot(),before);
 close(store,'pause-dialog');eq(Core.modalIds(store.snapshot()),['settings-dialog','full-reset-dialog'],'Settings is a valid root after pause closes');eq(Core.isPaused(store.snapshot()),false);
 const injected=plain(Core.initialState());injected.navigation.screen='game';injected.overlays={serial:2,modals:[{id:'pause-dialog',instance:1},{id:'full-reset-dialog',instance:2}]};assert.throws(()=>Core.create({state:injected}),/invalid_state/);
 const recovery=Core.create();open(recovery,'life-provider-dialog',{recovery:true});eq(Core.topModalId(recovery.snapshot()),'life-provider-dialog');const recovered=Core.create({state:plain(recovery.snapshot())});eq(recovered.snapshot(),recovery.snapshot(),'a verified recovery UI snapshot has a provider root exception');
 const child=game();open(child,'lives-dialog');open(child,'life-provider-dialog');close(child,'lives-dialog');eq(Core.modalIds(child.snapshot()),['life-provider-dialog'],'pending provider can outlive its original caller');
});
check('navigation and global close emit top-first effects without remounting gameplay',()=>{
 for(const action of ['CLOSE_ALL','NAVIGATE']){const store=game();for(const id of ['pause-dialog','settings-dialog','reset-dialog'])open(store,id);const r=store.dispatch(action==='NAVIGATE'?{type:action,screen:'journey'}:{type:action},facts);eq(r.effects.filter(e=>e.type==='modal.close').map(e=>e.modal.id),['reset-dialog','settings-dialog','pause-dialog']);eq(store.snapshot().overlays.modals,[]);if(action==='NAVIGATE')eq(r.effects.at(-1),{type:'navigation.changed',screen:'journey',previousScreen:'game'});eq(r.effects.some(e=>/save|swap|reward|board/i.test(e.type)),false);}
});
check('visual operation lifecycle is deterministic, bounded and duplicate-safe',()=>{
 const events=[];const first=game(),second=game();
 for(const store of [first,second]){const token=store.beginOperation('presentation','attempt-A');eq(token,{kind:'presentation',id:1,attemptId:'attempt-A',generation:1});eq(store.snapshot().operations.presentation.status,'requested');eq(store.isCurrentOperation(token),true);unchanged(store,{type:'OPERATION_REQUESTED',token},{},'duplicate_operation');eq(store.markOperationPending(token).accepted,true);unchanged(store,{type:'OPERATION_PENDING',token},{},'duplicate_operation');eq(store.settleOperation(token,'succeeded').accepted,true);eq(store.isCurrentOperation(token),false);unchanged(store,{type:'OPERATION_SETTLED',token,status:'succeeded'},{},'duplicate_operation');eq(unchanged(store,{type:'OPERATION_SETTLED',token,status:'failed'},{},'settled_operation').accepted,false);events.push(store.snapshot());}
 eq(events[0],events[1]);
 const store=game();for(let i=0;i<256;i++){const kind=i%2?'hint':'presentation',token=store.beginOperation(kind,'attempt-'+i);eq(token.id,i+1);store.markOperationPending(token);eq(store.settleOperation(token,i%3===0?'failed':'succeeded').accepted,true);}eq(Object.keys(store.snapshot().operations),['generation','serial','presentation','hint']);eq(store.snapshot().operations.serial,256);
});
check('replacement, navigation, attempt identity and invalidation reject stale completions',()=>{
 const store=game(),old=store.beginOperation('hint','old-attempt'),current=store.beginOperation('hint','new-attempt');eq(store.settleOperation(old,'succeeded').reason,'stale_operation');eq(store.settleOperation({...current,attemptId:'old-attempt'},'succeeded').reason,'stale_operation');eq(store.isCurrentOperation(current),true);
 store.markOperationPending(current);nav(store,'home');eq(store.snapshot().operations.hint.status,'cancelled');eq(store.isCurrentOperation(current),false);eq(store.settleOperation(current,'succeeded').reason,'stale_operation');nav(store,'game');const next=store.beginOperation('presentation','new-attempt');eq(next.id>current.id,true);store.invalidateOperations();eq(store.snapshot().operations.presentation.status,'cancelled');eq(store.markOperationPending(next).reason,'stale_operation');
});
check('lifecycle keeps the screen and committed domain out of cancellation decisions',()=>{
 const store=game(),token=store.beginOperation('presentation','same');store.markOperationPending(token);store.dispatch({type:'APP_VISIBILITY_CHANGED',hidden:true});eq(store.snapshot().navigation.screen,'game');eq(store.snapshot().operations.presentation.status,'pending','host completes the committed visual before suspend');eq(store.beginOperation('hint','same'),null);unchanged(store,{type:'APP_VISIBILITY_CHANGED',hidden:true});
 store.dispatch({type:'APP_SUSPENDED'});eq(store.snapshot().lifecycle,{hidden:true,suspended:true});eq(store.snapshot().operations.presentation.status,'cancelled');unchanged(store,{type:'APP_SUSPENDED'});eq(nav(store,'home').accepted,false);store.dispatch({type:'APP_RESUMED'});eq(store.snapshot().navigation.screen,'game');eq(store.snapshot().lifecycle.hidden,true);store.dispatch({type:'APP_VISIBILITY_CHANGED',hidden:false});eq(store.beginOperation('hint','same')!==null,true);unchanged(store,{type:'APP_RESUMED'});
 const paused=game();open(paused,'pause-dialog');eq(paused.beginOperation('presentation','same'),null,'new visual work cannot begin behind a modal');
});
check('snapshots/results/tokens are frozen without mutating event, facts or caller state',()=>{
 const store=game(),authoritative={score:7,mutate(){this.score++;}},event={type:'OPEN_MODAL',id:'settings-dialog'},context={engineStatus:'playing',authoritative};const r=store.dispatch(event,context);eq(recursivelyFrozen(r),true);eq(Object.isFrozen(event),false);eq(Object.isFrozen(context),false);eq(Object.isFrozen(authoritative),false);authoritative.mutate();eq(authoritative.score,8);
 assert.throws(()=>{store.snapshot().navigation.screen='records';},TypeError);assert.throws(()=>{r.effects[0].modal.instance=999;},TypeError);
 const injected=plain(Core.initialState()),mutableEvent={type:'NAVIGATE',screen:'journey'},pure=Core.transition(injected,mutableEvent);eq(Object.isFrozen(injected),false);eq(Object.isFrozen(injected.overlays),false);eq(Object.isFrozen(mutableEvent),false);eq(recursivelyFrozen(pure.state),true);eq(injected.navigation.screen,'home');
 const duplicate=Core.transition(injected,{type:'NAVIGATE',screen:'home'});eq(duplicate.state,injected);eq(Object.isFrozen(injected),false);
 const adopted=plain(Core.initialState()),own=Core.create({state:adopted});eq(Object.isFrozen(adopted),false);adopted.navigation.screen='garden';eq(own.snapshot().navigation.screen,'home');
});
check('validated own data executes exactly without inherited serialization hooks',()=>{
 let hooks=0;const event=Object.assign(Object.create({toJSON(){hooks++;return {type:'NAVIGATE',screen:'garden'};}}),{type:'NAVIGATE',screen:'journey'}),store=Core.create();eq(store.dispatch(event).accepted,true);eq(store.snapshot().navigation.screen,'journey');eq(hooks,0);
 const state=plain(Core.initialState());Object.setPrototypeOf(state,{toJSON(){hooks++;return Core.initialState();}});Object.setPrototypeOf(state.navigation,{toJSON(){hooks++;return {screen:'garden'};}});state.navigation.screen='records';const adopted=Core.create({state});eq(adopted.snapshot().navigation.screen,'records');eq(hooks,0);eq(Core.transition(state,{type:'NAVIGATE',screen:'journey'}).state.navigation.screen,'journey');eq(hooks,0);
 const arrays=plain(Core.initialState());arrays.navigation.screen='game';arrays.overlays={serial:1,modals:[{id:'settings-dialog',instance:1}]};for(const method of ['at','find','filter','some'])arrays.overlays.modals[method]=()=>{hooks++;throw Error('caller array method must not execute');};arrays.overlays.modals[Symbol.iterator]=function*(){hooks++;};eq(Core.transition(arrays,{type:'CLOSE_MODAL',id:'settings-dialog',instance:1}).state.overlays.modals,[]);eq(Core.transition(arrays,{type:'NAVIGATE',screen:'journey'}).state.navigation.screen,'journey');eq(hooks,0);
 const operation=game(),token=Object.assign(Object.create({toJSON(){hooks++;return {kind:'hint',id:1,attemptId:'wrong-owner',generation:1};}}),{kind:'hint',id:1,attemptId:'right-owner',generation:1});eq(operation.dispatch({type:'OPERATION_REQUESTED',token}).accepted,true);eq(operation.snapshot().operations.hint.token.attemptId,'right-owner');eq(hooks,0);
});
check('unknown or malformed event payloads fail safely without subscriber notifications',()=>{
 const store=game();let delivered=0;store.subscribe(()=>delivered++);const malformed=[null,undefined,'NAVIGATE',[],{}, {type:'UNKNOWN'}, {type:'NAVIGATE',screen:'home',board:{score:999}}, {type:'APP_VISIBILITY_CHANGED',hidden:'true'}, {type:'OPEN_MODAL',id:'missing'}, {type:'CLOSE_MODAL',id:'pause-dialog',instance:0}, {type:'CLOSE_MODAL',id:'pause-dialog'}, {type:'NAVIGATE',screen:1n}, {type:'OPERATION_REQUESTED',token:{}}, {type:'OPERATION_SETTLED',token:{kind:'hint',id:1,attemptId:'x',generation:1},status:'completed'}];
 let getters=0;const getter={};Object.defineProperty(getter,'type',{enumerable:true,get(){getters++;throw Error('must not execute getter');}});malformed.push(getter);
 for(const event of malformed){const before=store.snapshot();let result;assert.doesNotThrow(()=>{result=store.dispatch(event);});eq(result.accepted,false);eq(result.state,before);eq(result.effects,[]);}
 eq(getters,0);const accessorFacts={};Object.defineProperty(accessorFacts,'blocked',{enumerable:true,get(){getters++;return true;}});eq(unchanged(store,{type:'NAVIGATE',screen:'home'},accessorFacts).reason,'invalid_facts');eq(getters,0);const inherited=Object.create({get blocked(){getters++;return true;}});eq(store.preview({type:'NAVIGATE',screen:'home'},inherited).accepted,true);eq(getters,0);
 for(const context of [null,[],{gameAvailable:'yes'},{engineStatus:'won_maybe'},{recovery:1},{blocked:'false'}])eq(unchanged(store,{type:'NAVIGATE',screen:'home'},context).reason,'invalid_facts');eq(delivered,0);
});
check('reentrant dispatch is FIFO and copies queued event/fact data',()=>{
 const store=Core.create(),order=[];let queued;
 store.subscribe((r,previous,event)=>{order.push('A:'+r.state.navigation.screen);eq(previous.navigation.screen,event.screen==='records'?'home':'records');if(event.screen==='records'){const next={type:'NAVIGATE',screen:'garden'},context={gameAvailable:true};queued=store.dispatch(next,context);next.screen='game';context.gameAvailable=false;}});
 store.subscribe(r=>order.push('B:'+r.state.navigation.screen));const result=nav(store,'records');eq(result.state.navigation.screen,'records');eq(queued.accepted,null);eq(queued.queued,true);eq(order,['A:records','B:records','A:garden','B:garden']);eq(store.snapshot().navigation.screen,'garden');
});
check('operation convenience cannot enqueue an orphan while dispatch is notifying',()=>{
 const store=Core.create();let nested='not called';store.subscribe((r,previous,event)=>{if(event.type==='NAVIGATE')nested=store.beginOperation('presentation','attempt');});nav(store,'game');eq(nested,null);eq(store.snapshot().operations.presentation,null);eq(store.snapshot().operations.serial,0);
 const replaced=game();replaced.subscribe((r,previous,event)=>{if(event.type==='OPERATION_REQUESTED'&&event.token.id===1)replaced.dispatch({type:'OPERATION_REQUESTED',token:{...event.token,id:2,attemptId:'other-owner'}});});const original=replaced.beginOperation('hint','original-owner');eq(original.id,1);eq(original.attemptId,'original-owner');eq(replaced.snapshot().operations.hint.token.id,2);eq(replaced.isCurrentOperation(original),false,'caller never receives another operation owner token');
});
check('subscription removal, addition, exceptions and disposal have explicit lifetimes',()=>{
 const errors=[],store=Core.create({onError:error=>errors.push(error.message)}),order=[];let offB;
 store.subscribe(()=>{order.push('A');offB();store.subscribe(()=>order.push('C'));throw Error('optional-listener');});offB=store.subscribe(()=>order.push('B'));
 nav(store,'journey');eq(order,['A']);eq(errors,['optional-listener']);nav(store,'records');eq(order,['A','A','C']);eq(errors.length,2);offB();offB();
 const disposed=Core.create(),calls=[];disposed.subscribe(()=>{calls.push('first');disposed.dispatch({type:'NAVIGATE',screen:'garden'});disposed.destroy();});disposed.subscribe(()=>calls.push('second'));nav(disposed,'journey');eq(calls,['first']);eq(disposed.snapshot().navigation.screen,'journey');eq(disposed.dispatch({type:'NAVIGATE',screen:'garden'}).reason,'disposed');eq(disposed.preview({type:'CLOSE_ALL'}).reason,'disposed');eq(disposed.beginOperation('hint','x'),null);disposed.destroy();const off=disposed.subscribe(()=>calls.push('late'));off();eq(calls,['first']);
});
check('counter exhaustion and forged identity data never wrap into a new owner',()=>{
 const modal=plain(Core.initialState());modal.overlays.serial=Number.MAX_SAFE_INTEGER;const store=Core.create({state:modal});eq(open(store,'settings-dialog').reason,'instance_exhausted');
 const operation=plain(Core.initialState());operation.navigation.screen='game';operation.operations.serial=Number.MAX_SAFE_INTEGER;const max=Core.create({state:operation});eq(max.beginOperation('hint','attempt'),null);eq(max.snapshot().operations.serial,Number.MAX_SAFE_INTEGER);
 const generation=plain(Core.initialState());generation.operations.generation=Number.MAX_SAFE_INTEGER;const last=Core.create({state:generation});eq(nav(last,'journey').reason,'generation_exhausted');eq(last.dispatch({type:'APP_SUSPENDED'}).reason,'generation_exhausted');
 const mismatched=plain(Core.initialState());mismatched.overlays={serial:1,modals:[{id:'win-dialog',instance:1}]};assert.throws(()=>Core.create({state:mismatched}),/invalid_state/);eq(Core.transition(mismatched,{type:'CLOSE_ALL'}).reason,'invalid_state');
 const bad=plain(Core.initialState());bad.score=12;assert.throws(()=>Core.create({state:bad}),/invalid_state/);eq(Core.transition(bad,{type:'CLOSE_ALL'}).reason,'invalid_state');eq(Object.isFrozen(bad),false);
});
check('runtime remains a small platform-free rule module',()=>{
 const source=fs.readFileSync(__dirname+'/dist/app-state.js','utf8');eq(/\b(document|localStorage|sessionStorage|fetch|XMLHttpRequest|Date|setTimeout|setInterval|HexMatch|HexEconomy|HexLives|UnityEngine)\b/.test(source),false);eq(/Math\.random/.test(source),false);
});
console.log('Application state core passed: '+groups+' groups, '+checks+' assertions; pure transitions, modal instances, FIFO subscriptions and stale visual identities.');
