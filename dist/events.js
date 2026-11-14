/* Local gameplay event contract. Pure data in/out; no browser, storage or transport calls. */
(function (global) {
  'use strict';
  const names=Object.freeze(['level_started','level_completed','level_failed','level_retried','hint_used','booster_used','level_abandoned']);
  const contextFields=['timestamp','levelId','variantId','levelDataVersion','attemptId','attemptNumber','movesUsed','movesRemaining','score','targetScore','covered','totalCells','remainingLayers','cascades','hintsUsed','status'];
  const detailFields=['reason','previousAttemptId','nextAttemptId','hintKind','hintGuarantee','boosterId'];
  const token=value=>typeof value==='string'&&value.length>0&&value.length<=128&&/^[A-Za-z0-9_.:-]+$/.test(value);
  const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
  const copy=value=>JSON.parse(JSON.stringify(value));
  function validate(event){
    if(!event||typeof event!=='object'||Array.isArray(event)||event.schemaVersion!==1||!names.includes(event.name)||!integer(event.sequence,1)||!integer(event.timestamp)||!token(event.eventId)||!token(event.attemptId)||!token(event.variantId)||!token(event.levelDataVersion)||!(token(event.levelId)||integer(event.levelId,1)))throw new Error('Invalid gameplay event identity');
    if(event.eventId!==`${event.attemptId}:${event.sequence}`)throw new Error('Invalid gameplay event sequence');
    for(const field of ['attemptNumber','movesUsed','movesRemaining','score','targetScore','covered','totalCells','remainingLayers','cascades','hintsUsed'])if(!integer(event[field]))throw new Error('Invalid gameplay event statistic');
    if(event.attemptNumber<1||event.totalCells<1||event.covered>event.totalCells||!['playing','won','lost'].includes(event.status))throw new Error('Invalid gameplay event state');
    if(event.name==='level_completed'&&event.status!=='won'||event.name==='level_failed'&&event.status!=='lost'||event.name==='level_abandoned'&&event.status!=='playing')throw new Error('Gameplay event does not match its result');
    for(const field of detailFields)if(event[field]!==undefined&&!token(event[field]))throw new Error('Invalid gameplay event detail');
    const allowed=new Set(['schemaVersion','name','sequence','eventId',...contextFields,...detailFields]);
    if(Object.keys(event).some(field=>!allowed.has(field)))throw new Error('Unexpected gameplay event field');
    return true;
  }
  function createState(options={}){
    const limit=options.limit===undefined?500:options.limit;
    if(!integer(limit,1,2000))throw new Error('Invalid local event buffer limit');
    return {schemaVersion:1,limit,nextSequence:1,events:[]};
  }
  function validateState(state){
    if(!state||state.schemaVersion!==1||!integer(state.limit,1,2000)||!integer(state.nextSequence,1)||!Array.isArray(state.events)||state.events.length>state.limit)throw new Error('Invalid local event buffer');
    let previous=0;
    for(const event of state.events){validate(event);if(event.sequence<=previous||event.sequence>=state.nextSequence)throw new Error('Invalid local event order');previous=event.sequence;}
    return true;
  }
  function append(state,name,context,details={}){
    validateState(state);
    if(!context||typeof context!=='object'||Object.keys(context).some(field=>!contextFields.includes(field))||!details||typeof details!=='object'||Object.keys(details).some(field=>!detailFields.includes(field)))throw new Error('Unexpected gameplay context');
    const event={schemaVersion:1,name,sequence:state.nextSequence,eventId:`${context.attemptId}:${state.nextSequence}`,...copy(context),...copy(details)};
    validate(event);
    // UI renders, reloads and skipped animations cannot produce the same terminal event twice.
    if(['level_started','level_completed','level_failed','level_abandoned'].includes(name)&&state.events.some(previous=>previous.attemptId===event.attemptId&&previous.name===name))return copy(state);
    return {schemaVersion:1,limit:state.limit,nextSequence:state.nextSequence+1,events:[...state.events.map(copy),event].slice(-state.limit)};
  }
  global.HexEvents=Object.freeze({names,createState,validate,validateState,append});
})(typeof window!=='undefined'?window:globalThis);
