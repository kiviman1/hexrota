/* Transient application coordination. Rule owners supply facts at the boundary;
 * snapshots contain navigation and presentation identities, never game data. */
(function(root){
 'use strict';
 const SCREENS=Object.freeze(['home','game','journey','records','garden']);
 const KINDS=Object.freeze(['presentation','hint']);
 const ACTIVE=Object.freeze(['requested','pending']);
 const TERMINAL=Object.freeze(['succeeded','failed','cancelled']);
 const ALL=SCREENS;
 const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
 const MODALS=freeze({
  'help-dialog':{screens:ALL,parents:[]},
  'win-dialog':{screens:['game'],parents:[],status:'won'},
  'lose-dialog':{screens:['game'],parents:[],status:'lost'},
  'inventory-dialog':{screens:['game'],parents:[],status:'playing'},
  'assistance-dialog':{screens:['game'],parents:[],status:'playing'},
  'rescue-provider-dialog':{screens:['game'],parents:['lose-dialog'],status:'lost',recovery:true,root:false},
  'pregame-dialog':{screens:['home','journey','game'],parents:[]},
  'pause-dialog':{screens:['game'],parents:[],status:'playing'},
  'settings-dialog':{screens:ALL,parents:['pause-dialog']},
  'install-dialog':{screens:ALL,parents:['settings-dialog']},
  'lives-dialog':{screens:ALL,parents:['pregame-dialog','restart-dialog','lose-dialog','settings-dialog']},
  'life-provider-dialog':{screens:ALL,parents:['lives-dialog','settings-dialog'],recovery:true,root:false},
  'restart-dialog':{screens:['home','journey','game'],parents:['pause-dialog','pregame-dialog'],rootScreens:['game']},
  'full-reset-dialog':{screens:ALL,parents:['settings-dialog'],root:false},
  'reset-dialog':{screens:ALL,parents:['settings-dialog'],root:false}
 });
 const EVENTS=freeze({
  NAVIGATE:['type','screen'],OPEN_MODAL:['type','id'],CLOSE_MODAL:['type','id','instance'],CLOSE_ALL:['type'],
  APP_VISIBILITY_CHANGED:['type','hidden'],APP_SUSPENDED:['type'],APP_RESUMED:['type'],INVALIDATE_OPERATIONS:['type'],
  OPERATION_REQUESTED:['type','token'],OPERATION_PENDING:['type','token'],OPERATION_SETTLED:['type','token','status']
 });
 const map=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
 function dataKeys(value,allowed){
  if(!map(value))return false;
  return Reflect.ownKeys(value).every(key=>typeof key==='string'&&allowed.includes(key)&&Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value,key),'value'));
 }
 const exactKeys=(value,keys)=>dataKeys(value,keys)&&Object.keys(value).length===keys.length;
 const attempt=value=>value===null||typeof value==='string'&&value.length>0&&value.length<=256&&value.trim().length>0;
 const validToken=token=>exactKeys(token,['kind','id','attemptId','generation'])&&KINDS.includes(token.kind)&&integer(token.id,1)&&attempt(token.attemptId)&&integer(token.generation);
 const sameToken=(a,b)=>!!a&&!!b&&a.kind===b.kind&&a.id===b.id&&a.attemptId===b.attemptId&&a.generation===b.generation;
 function initialState(){return freeze({navigation:{screen:'home'},overlays:{modals:[],serial:0},lifecycle:{hidden:false,suspended:false},operations:{generation:0,serial:0,presentation:null,hint:null}});}
 function validState(state){
  if(!exactKeys(state,['navigation','overlays','lifecycle','operations'])||!exactKeys(state.navigation,['screen'])||!SCREENS.includes(state.navigation.screen)||!exactKeys(state.overlays,['modals','serial'])||!Array.isArray(state.overlays.modals)||!integer(state.overlays.serial)||!exactKeys(state.lifecycle,['hidden','suspended'])||typeof state.lifecycle.hidden!=='boolean'||typeof state.lifecycle.suspended!=='boolean'||!exactKeys(state.operations,['generation','serial','presentation','hint'])||!integer(state.operations.generation)||!integer(state.operations.serial))return false;
  const ids=new Set();let previous=0;
  for(let i=0;i<state.overlays.modals.length;i++){const descriptor=Object.getOwnPropertyDescriptor(state.overlays.modals,String(i));if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))return false;const modal=descriptor.value;if(!exactKeys(modal,['id','instance'])||!Object.prototype.hasOwnProperty.call(MODALS,modal.id)||ids.has(modal.id)||!integer(modal.instance,1)||modal.instance<=previous||modal.instance>state.overlays.serial)return false;ids.add(modal.id);previous=modal.instance;}
  if(!validModalChain(state.navigation.screen,state.overlays.modals))return false;
  for(const kind of KINDS){const operation=state.operations[kind];if(operation===null)continue;if(!exactKeys(operation,['token','status'])||!validToken(operation.token)||operation.token.kind!==kind||operation.token.id>state.operations.serial||operation.token.generation>state.operations.generation||![...ACTIVE,...TERMINAL].includes(operation.status)||ACTIVE.includes(operation.status)&&operation.token.generation!==state.operations.generation)return false;}
  return true;
 }
 const topModalId=state=>{const modals=state.overlays.modals;return modals.length?modals[modals.length-1].id:null;};
 const modalIds=state=>{const ids=[];for(let i=0;i<state.overlays.modals.length;i++)ids.push(state.overlays.modals[i].id);return ids;};
 const isPaused=state=>modalIds(state).includes('pause-dialog');
 const findModal=(state,id)=>{for(let i=0;i<state.overlays.modals.length;i++)if(state.overlays.modals[i].id===id)return state.overlays.modals[i];return null;};
 const currentOperation=(state,kind)=>KINDS.includes(kind)?state.operations[kind]:null;
 const isCurrentOperation=(state,token)=>validToken(token)&&sameToken(currentOperation(state,token.kind)?.token,token)&&ACTIVE.includes(currentOperation(state,token.kind).status)&&token.generation===state.operations.generation;
 // Clone only own data. Serialization hooks and inherited methods must not
 // transform an already validated event or execute while copying a snapshot.
 function copy(value){
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value)){
   const output=[],length=Object.getOwnPropertyDescriptor(value,'length').value;
   for(let i=0;i<length;i++){const descriptor=Object.getOwnPropertyDescriptor(value,String(i));if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))throw new TypeError('invalid_data');output.push(copy(descriptor.value));}
   return output;
  }
  const output={};for(const key of Object.keys(value)){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))throw new TypeError('invalid_data');Object.defineProperty(output,key,{value:copy(descriptor.value),writable:true,enumerable:true,configurable:true});}return output;
 }
 const result=(state,accepted,changed,reason,effects=[])=>Object.freeze({accepted,changed,reason,state,effects:freeze(copy(effects))});
 const unchanged=(state,reason='unchanged')=>result(state,true,false,reason);
 const reject=(state,reason)=>result(state,false,false,reason);
 const changed=(state,effects=[])=>result(freeze(copy(state)),true,true,'changed',effects);
 function normalizeFacts(facts){
  if(!map(facts))return null;const view=Object.create(null);
  for(const key of ['gameAvailable','recovery','blocked','engineStatus']){
   const descriptor=Object.getOwnPropertyDescriptor(facts,key);if(!descriptor)continue;
   if(!Object.prototype.hasOwnProperty.call(descriptor,'value'))return null;
   const value=descriptor.value;if(key==='engineStatus'?value!==null&&!['playing','won','lost'].includes(value):typeof value!=='boolean')return null;
   view[key]=value;
  }
  return view;
 }
 function cancelled(operations){const next={...operations};for(const kind of KINDS)if(next[kind]&&ACTIVE.includes(next[kind].status))next[kind]={...next[kind],status:'cancelled'};return next;}
 function invalidate(operations){if(operations.generation===Number.MAX_SAFE_INTEGER)return null;return {...cancelled(operations),generation:operations.generation+1};}
 function validModalChain(screen,modals){
  let parent=null;
  for(let i=0;i<modals.length;i++){
   const policy=MODALS[modals[i].id];
   // Provider retry may legitimately outlive its original caller. Its command
   // still requires explicit verified-recovery facts when opening this route.
   if(!policy.recovery&&(!policy.screens.includes(screen)||(parent?!policy.parents.includes(parent):policy.root===false||policy.rootScreens&&!policy.rootScreens.includes(screen))))return false;
   parent=modals[i].id;
  }
  return true;
 }
 function modalAllowed(state,id,facts){
  const policy=MODALS[id],parent=topModalId(state);
  // Recovery is a verified delivery already owned by the existing provider;
  // the UI may expose its retry even after the original caller has gone away.
  if(policy.recovery&&facts.recovery===true)return true;
  if(!policy.screens.includes(state.navigation.screen)||policy.status&&facts.engineStatus!==policy.status)return false;
  return parent?policy.parents.includes(parent):policy.root!==false&&(!policy.rootScreens||policy.rootScreens.includes(state.navigation.screen));
 }
 function transition(state,event,facts={}){
  try{
   if(!validState(state))return reject(state,'invalid_state');
   const descriptor=map(event)?Object.getOwnPropertyDescriptor(event,'type'):null;
   if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||typeof descriptor.value!=='string'||!Object.prototype.hasOwnProperty.call(EVENTS,descriptor.value)||!exactKeys(event,EVENTS[descriptor.value]))return reject(state,'invalid_event');
   facts=normalizeFacts(facts);if(!facts)return reject(state,'invalid_facts');
   const type=descriptor.value;
   if(['NAVIGATE','OPEN_MODAL','OPERATION_REQUESTED','OPERATION_PENDING'].includes(type)&&(facts.blocked===true||state.lifecycle.suspended))return reject(state,'unavailable');
   if(type==='NAVIGATE'){
    if(!SCREENS.includes(event.screen))return reject(state,'invalid_screen');
    if(event.screen==='game'&&facts.gameAvailable!==true)return reject(state,'game_unavailable');
    if(state.navigation.screen===event.screen)return unchanged(state);
    const operations=invalidate(state.operations);if(!operations)return reject(state,'generation_exhausted');
    const effects=copy(state.overlays.modals).reverse().map(modal=>({type:'modal.close',modal}));effects.push({type:'navigation.changed',screen:event.screen,previousScreen:state.navigation.screen});
    return changed({...state,navigation:{screen:event.screen},overlays:{...state.overlays,modals:[]},operations},effects);
   }
   if(type==='OPEN_MODAL'){
    if(typeof event.id!=='string'||!Object.prototype.hasOwnProperty.call(MODALS,event.id))return reject(state,'invalid_modal');
    if(!!findModal(state,event.id))return unchanged(state,'already_open');
    if(!modalAllowed(state,event.id,facts))return reject(state,'modal_forbidden');
    if(state.overlays.serial===Number.MAX_SAFE_INTEGER)return reject(state,'instance_exhausted');
    const modal={id:event.id,instance:state.overlays.serial+1};
    return changed({...state,overlays:{modals:[...state.overlays.modals,modal],serial:modal.instance}},[{type:'modal.open',modal}]);
   }
   if(type==='CLOSE_MODAL'){
    if(typeof event.id!=='string'||!Object.prototype.hasOwnProperty.call(MODALS,event.id)||!integer(event.instance,1))return reject(state,'invalid_modal');
    const current=findModal(state,event.id);
    if(!current)return unchanged(state,'already_closed');
    if(current.instance!==event.instance)return reject(state,'stale_modal');
    const modals=copy(state.overlays.modals).filter(modal=>modal.id!==current.id);
    if(!validModalChain(state.navigation.screen,modals))return reject(state,'modal_topology');
    return changed({...state,overlays:{...state.overlays,modals}},[{type:'modal.close',modal:current}]);
   }
   if(type==='CLOSE_ALL'){
    if(!state.overlays.modals.length)return unchanged(state);
    return changed({...state,overlays:{...state.overlays,modals:[]}},copy(state.overlays.modals).reverse().map(modal=>({type:'modal.close',modal})));
   }
   if(type==='APP_VISIBILITY_CHANGED'){
    if(typeof event.hidden!=='boolean')return reject(state,'invalid_visibility');
    return state.lifecycle.hidden===event.hidden?unchanged(state):changed({...state,lifecycle:{...state.lifecycle,hidden:event.hidden}});
   }
   if(type==='APP_SUSPENDED'){
    if(state.lifecycle.suspended)return unchanged(state);
    const operations=invalidate(state.operations);if(!operations)return reject(state,'generation_exhausted');
    return changed({...state,lifecycle:{...state.lifecycle,suspended:true},operations});
   }
   if(type==='APP_RESUMED')return !state.lifecycle.suspended?unchanged(state):changed({...state,lifecycle:{...state.lifecycle,suspended:false}});
   if(type==='INVALIDATE_OPERATIONS'){
    const operations=invalidate(state.operations);return operations?changed({...state,operations}):reject(state,'generation_exhausted');
   }
   const {token}=event;if(!validToken(token))return reject(state,'invalid_token');
   const operation=state.operations[token.kind];
   if(type==='OPERATION_REQUESTED'){
    if(sameToken(operation?.token,token))return unchanged(state,'duplicate_operation');
    if(state.navigation.screen!=='game'||state.lifecycle.hidden||state.overlays.modals.length)return reject(state,'unavailable');
    if(token.generation!==state.operations.generation||token.id!==state.operations.serial+1)return reject(state,'stale_operation');
    const entry={token:{...token},status:'requested'};
    return changed({...state,operations:{...state.operations,serial:token.id,[token.kind]:entry}});
   }
   if(!sameToken(operation?.token,token)||token.generation!==state.operations.generation)return reject(state,'stale_operation');
   if(type==='OPERATION_PENDING'){
    if(operation.status==='pending')return unchanged(state,'duplicate_operation');
    if(operation.status!=='requested')return reject(state,'settled_operation');
    return changed({...state,operations:{...state.operations,[token.kind]:{...operation,status:'pending'}}});
   }
   if(!TERMINAL.includes(event.status))return reject(state,'invalid_status');
   if(TERMINAL.includes(operation.status))return operation.status===event.status?unchanged(state,'duplicate_operation'):reject(state,'settled_operation');
   return changed({...state,operations:{...state.operations,[token.kind]:{...operation,status:event.status}}});
  }catch(_){return reject(state,'invalid_event');}
 }
 function create(options={}){
  let state=options.state===undefined?initialState():options.state;
  if(!validState(state))throw new TypeError('invalid_state');
  // Copy an injected snapshot so freezing this store never freezes caller data.
  state=freeze(copy(state));
  let disposed=false,draining=false;const listeners=new Set(),queue=[];
  const preview=(event,facts={})=>disposed?reject(state,'disposed'):transition(state,event,facts);
  function dispatch(event,facts={}){
   if(disposed)return reject(state,'disposed');
   // Validate before queuing and copy only validated plain event data.
   const validation=transition(state,event,facts);if(validation.reason.startsWith('invalid_'))return validation;
   const factCopy={};for(const key of ['gameAvailable','engineStatus','recovery','blocked'])if(Object.prototype.hasOwnProperty.call(facts,key))factCopy[key]=facts[key];
   const item={event:freeze(copy(event)),facts:freeze(factCopy),result:null};queue.push(item);
   if(draining)return freeze({accepted:null,changed:false,queued:true,reason:'queued',state,effects:[]});
   draining=true;
   try{while(queue.length&&!disposed){
    const next=queue.shift(),previous=state,processed=transition(state,next.event,next.facts);next.result=processed;
    if(processed.changed){state=processed.state;const current=[...listeners];for(const listener of current){if(disposed||!listeners.has(listener))continue;try{listener(processed,previous,next.event);}catch(error){try{options.onError?.(error);}catch(_){}}}}
   }}finally{draining=false;if(disposed)queue.length=0;}
   return item.result||reject(state,'disposed');
  }
  function subscribe(listener){if(typeof listener!=='function')throw new TypeError('invalid_listener');if(disposed)return ()=>{};listeners.add(listener);let active=true;return ()=>{if(active){active=false;listeners.delete(listener);}};}
  function beginOperation(kind,attemptId=null){
   if(disposed||draining||!KINDS.includes(kind)||!attempt(attemptId))return null;
   const token=freeze({kind,id:state.operations.serial+1,attemptId,generation:state.operations.generation});
   const accepted=dispatch({type:'OPERATION_REQUESTED',token});return !disposed&&accepted.accepted&&accepted.changed?accepted.state.operations[kind].token:null;
  }
  return Object.freeze({snapshot:()=>state,preview,dispatch,subscribe,beginOperation,
   markOperationPending:token=>dispatch({type:'OPERATION_PENDING',token}),settleOperation:(token,status)=>dispatch({type:'OPERATION_SETTLED',token,status}),
   invalidateOperations:()=>dispatch({type:'INVALIDATE_OPERATIONS'}),isCurrentOperation:token=>isCurrentOperation(state,token),
   destroy(){if(disposed)return;disposed=true;queue.length=0;listeners.clear();}
  });
 }
 const api=Object.freeze({SCREENS,MODALS,EVENTS,KINDS,initialState,transition,create,topModalId,modalIds,isPaused,currentOperation,isCurrentOperation});
 root.HexAppState=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
