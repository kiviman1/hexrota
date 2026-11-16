/* Read-only application projections. Domain facts are supplied for each call;
 * the selectors retain no profile, board, transaction or platform resources. */
(function(root){
  'use strict';
  const Core=typeof module==='object'&&module.exports?require('./app-state.js'):root.HexAppState;
  if(!Core)throw new Error('state_core_unavailable');
  const SCREENS=Core.SCREENS;
  const PHASES=Object.freeze(['READY','PLAYING','RESOLVING','WON','LOST']);
  const ACTIVE=new Set(['requested','pending']);
  const STATUSES=new Set(['requested','pending','succeeded','failed','cancelled']);
  const ENGINE_STATUSES=new Set(['playing','won','lost']);
  const INVENTORY_MODALS=new Set(['inventory-dialog','assistance-dialog']);
  const CLIP_STATES=Object.freeze({idle:'IDLE',point:'POINTING',inspect:'INSPECTING',worried:'WORRIED',celebrate:'CELEBRATING',hop:'HOPPING',carry:'CARRYING',build:'BUILDING',proud:'PROUD',think:'THINKING',call:'TALKING',rest:'RESTING'});
  const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const integer=value=>Number.isSafeInteger(value)&&value>=0;
  const identity=value=>typeof value==='string'&&value.length>0;
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);

  function screen(state){
    const value=state?.navigation?.screen;
    return SCREENS.includes(value)?value:null;
  }
  function modals(state){return Array.isArray(state?.overlays?.modals)?state.overlays.modals:null;}
  function isPaused(state){const stack=modals(state);return !!stack&&stack.every(record)&&Core.isPaused(state);}
  function activeOperation(state,kind){
    const operations=state?.operations,operation=operations?.[kind],token=operation?.token;
    return !!(record(operations)&&record(operation)&&record(token)&&token.kind===kind&&Core.isCurrentOperation(state,token));
  }
  function isResolving(state){return activeOperation(state,'presentation');}
  function validStateView(state){
    const stack=modals(state),lifecycle=state?.lifecycle,operations=state?.operations;
    if(!screen(state)||!stack||!integer(state.overlays.serial)||!record(lifecycle)||typeof lifecycle.hidden!=='boolean'||typeof lifecycle.suspended!=='boolean'||!record(operations)||!integer(operations.generation)||!integer(operations.serial))return false;
    if(!stack.every((entry,index)=>record(entry)&&identity(entry.id)&&integer(entry.instance)&&entry.instance>0&&entry.instance<=state.overlays.serial&&(!index||entry.instance>stack[index-1].instance))||new Set(stack.map(entry=>entry.id)).size!==stack.length)return false;
    for(const kind of Core.KINDS){
      const operation=operations[kind];
      if(operation===null)continue;
      const token=operation?.token;
      if(!record(operation)||!STATUSES.has(operation.status)||!record(token)||token.kind!==kind||!integer(token.id)||token.id===0||token.id>operations.serial||!integer(token.generation)||token.generation>operations.generation||(token.attemptId!==null&&!identity(token.attemptId)))return false;
      if(ACTIVE.has(operation.status)&&token.generation!==operations.generation)return false;
    }
    return true;
  }
  function suspended(state){return state?.lifecycle?.hidden===true||state?.lifecycle?.suspended===true;}
  function nativeModal(domain){return domain?.nativeModalOpen===true;}
  function anyModal(state,domain){return !!modals(state)?.length||nativeModal(domain);}
  function validInputFacts(domain){
    return record(domain)&&['attemptReady','canOpen','writeBlocked','lifeDiscarded','resetPending'].every(key=>typeof domain[key]==='boolean')&&ENGINE_STATUSES.has(domain.engineStatus)&&(!own(domain,'nativeModalOpen')||typeof domain.nativeModalOpen==='boolean');
  }
  function availableAttempt(state,domain){
    return validStateView(state)&&validInputFacts(domain)&&screen(state)==='game'&&!suspended(state)&&!isPaused(state)&&domain.attemptReady===true&&domain.canOpen===true&&domain.writeBlocked===false&&domain.lifeDiscarded===false&&domain.resetPending===false;
  }
  function gameplayPhase(state,domain){
    if(!validStateView(state)||domain?.attemptReady!==true||!ENGINE_STATUSES.has(domain.engineStatus))return 'READY';
    // Reservation locks input before the existing synchronous transaction, but
    // is not yet a committed visual phase or proof of a terminal result.
    if(isResolving(state))return state.operations.presentation.status==='pending'?'RESOLVING':'PLAYING';
    return domain.engineStatus==='won'?'WON':domain.engineStatus==='lost'?'LOST':'PLAYING';
  }
  function canRouteBoardInput(state,domain){
    // A resolving tap may reveal the already committed result. The move guard
    // below is deliberately narrower than this routing guard.
    return availableAttempt(state,domain)&&!anyModal(state,domain);
  }
  function canStartMove(state,domain){
    return canRouteBoardInput(state,domain)&&domain.engineStatus==='playing'&&!isResolving(state)&&domain.feedback===false;
  }
  function canUseInventory(state,domain){
    if(!availableAttempt(state,domain)||domain.engineStatus!=='playing'||isResolving(state)||domain.tutorial!==false||!integer(domain.activeIndex)||!integer(domain.tutorialCount)||domain.activeIndex<domain.tutorialCount)return false;
    // The inventory and confirmation buttons operate inside their own modal.
    // An unrelated modal must not authorize a programmatic inventory command.
    const stack=modals(state);
    if(stack.length>1||!stack.every(entry=>INVENTORY_MODALS.has(entry.id)))return false;
    return !nativeModal(domain)||INVENTORY_MODALS.has(domain.nativeModalId)&&(!stack.length||Core.topModalId(state)===domain.nativeModalId);
  }
  function invalid(code){const error=new TypeError(code);error.code=code;throw error;}
  function indexKeys(value){
    // Legacy saves can use indexed arrays. The canonical loader normalizes
    // them, but a pre-normalization committed projection must remain readable.
    if(!value||typeof value!=='object')invalid('invalid_committed_game_view');
    const keys=Object.keys(value);
    if(!keys.every(key=>/^(?:0|[1-9]\d*)$/.test(key)&&integer(Number(key))))invalid('invalid_committed_game_view');
    return keys.map(Number);
  }
  function committedTutorialProgress(committedGame,{activeIndex,attemptId,tutorialCount}={}){
    if(!integer(activeIndex)||!integer(tutorialCount)||tutorialCount===0||(attemptId!==null&&attemptId!==undefined&&!identity(attemptId)))invalid('invalid_tutorial_projection_context');
    if(committedGame===null||committedGame===undefined)return Object.freeze({completedTutorialCount:0,tutorialTurn:0});
    if(!record(committedGame))invalid('invalid_committed_game_view');
    if(own(committedGame,'current')&&committedGame.current!==null&&!integer(committedGame.current))invalid('invalid_committed_game_view');
    const done=committedGame.done??[];
    if(!Array.isArray(done)||!done.every(integer))invalid('invalid_committed_game_view');
    const boards=committedGame.boards??{},attempts=committedGame.attempts??{};
    const indices=[committedGame.current,...done,...indexKeys(boards),...indexKeys(attempts)];
    const completedTutorialCount=indices.some(index=>integer(index)&&index>=tutorialCount)?2:done.includes(1)?2:indices.includes(1)||done.includes(0)?1:0;
    let tutorialTurn=0;
    if(activeIndex<tutorialCount){
      const checkpoint=boards[activeIndex],metadata=attempts[activeIndex];
      if(checkpoint!==undefined&&checkpoint!==null&&!record(checkpoint)||metadata!==undefined&&metadata!==null&&!record(metadata))invalid('invalid_committed_game_view');
      if(attemptId&&metadata?.attemptId===attemptId){
        if(own(checkpoint||{},'turn')&&!integer(checkpoint.turn))invalid('invalid_committed_game_view');
        tutorialTurn=checkpoint?.turn||0;
      }
    }
    return Object.freeze({completedTutorialCount,tutorialTurn});
  }
  function validPresentationFacts(domain){
    if(!record(domain)||!['tutorial','firstOpening','portraitAvailable','coachVisible','feedback','reducedMotion'].every(key=>typeof domain[key]==='boolean')||!ENGINE_STATUSES.has(domain.engineStatus)||!integer(domain.activeIndex)||!integer(domain.tutorialCount)||domain.tutorialCount===0||!integer(domain.turn)||(domain.attemptId!==null&&!identity(domain.attemptId))||own(domain,'nativeModalOpen')&&typeof domain.nativeModalOpen!=='boolean')return false;
    if(domain.tutorial!==(domain.activeIndex<domain.tutorialCount))return false;
    return domain.tutorial?domain.levelId==='learn-'+(domain.activeIndex+1):typeof domain.levelId==='number'&&integer(domain.levelId);
  }
  function projectPresentation(state,domain){
    if(!validStateView(state)||!validPresentationFacts(domain))invalid('invalid_presentation_view');
    const currentScreen=screen(state),busy=isResolving(state),paused=isPaused(state),hidden=suspended(state),modalOpen=anyModal(state,domain);
    const progress=committedTutorialProgress(domain.committedGame,{activeIndex:domain.activeIndex,attemptId:domain.attemptId,tutorialCount:domain.tutorialCount});
    const rawPair=domain.lessonPair??[];
    if(!Array.isArray(rawPair)||![0,2].includes(rawPair.length)||!rawPair.every(integer)||(rawPair.length===2&&rawPair[0]===rawPair[1]))invalid('invalid_presentation_view');
    const lessonPair=Object.freeze(rawPair.slice());
    const actorMode=currentScreen==='game'&&domain.tutorial&&domain.portraitAvailable?'PORTRAIT':['home','game'].includes(currentScreen)?'WORLD':'NONE';
    const portraitVisible=actorMode==='PORTRAIT'&&domain.coachVisible&&!hidden;
    const motionPaused=paused||hidden||modalOpen;
    const scene=Object.freeze({screen:currentScreen,firstOpening:domain.firstOpening,...progress,levelId:domain.levelId,attemptId:domain.attemptId,turn:domain.turn,status:domain.engineStatus,busy,feedback:domain.feedback,lessonPair,tutorialPortrait:actorMode==='PORTRAIT',paused,hidden,modalOpen,reducedMotion:domain.reducedMotion});
    const portrait=Object.freeze({visible:portraitVisible,levelId:domain.levelId,step:domain.turn,feedback:busy||domain.feedback,busy,paused:motionPaused});
    return Object.freeze({screen:currentScreen,phase:gameplayPhase(state,domain),actorMode,portraitVisible,motionPaused,progress,scene,portrait});
  }
  function tavikState(state,domain){
    const view=projectPresentation(state,domain);
    if(view.actorMode==='PORTRAIT'){
      if(typeof domain.portraitSpeaking!=='boolean')return null;
      return domain.portraitSpeaking?'TALKING':view.portrait.feedback?'CELEBRATING':'POINTING';
    }
    return view.actorMode==='WORLD'&&own(CLIP_STATES,domain.scenePose)?CLIP_STATES[domain.scenePose]:null;
  }
  const api=Object.freeze({SCREENS,PHASES,screen,isPaused,isResolving,gameplayPhase,canRouteBoardInput,canStartMove,canUseInventory,committedTutorialProgress,projectPresentation,tavikState});
  root.HexStateSelectors=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
