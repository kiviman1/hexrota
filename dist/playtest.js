/* Opt-in local observation data. No browser, storage or network dependency. */
(function(global){
  'use strict';
  const contextFields=['levelId','variantId','levelDataVersion','attemptId','attemptNumber','movesUsed','movesRemaining','score','targetScore','covered','totalCells','remainingLayers','cascades','hintsUsed','status'];
  const eventNames=['level_started','level_completed','level_failed','level_retried','hint_used','level_abandoned','attempt_resumed','life_blocked'];
  const detailFields=['reason','previousAttemptId','hintKind','hintGuarantee','developerBypass','lives','requestedLevelId'];
  const moveFields=['attemptId','turn','pair','cells','scoreBefore','scoreAfter','movesRemaining','coveredBefore','coveredAfter','remainingLayers','waves','matchedIndices','developerBypass'];
  const derivedFields=['missingScore','missingGround','failureReason'];
  const copy=value=>JSON.parse(JSON.stringify(value));
  const integer=value=>Number.isSafeInteger(value)&&value>=0;
  const token=value=>typeof value==='string'&&/^[A-Za-z0-9_.:-]{1,180}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
  function pick(input,fields){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.includes(key)))throw Error('Unexpected playtest field');
    return copy(input);
  }
  function validateFields(fields){
    for(const [key,value]of Object.entries(fields)){
      if(['levelId','requestedLevelId'].includes(key)){if(!integer(value)&&!token(value))throw Error('Invalid observed level');}
      else if(key==='developerBypass'){if(typeof value!=='boolean')throw Error('Invalid observed setting');}
      else if(['variantId','levelDataVersion','attemptId','status','reason','previousAttemptId','hintKind','hintGuarantee'].includes(key)){if(!token(value))throw Error('Invalid observed identity');}
      else if(!integer(value))throw Error('Invalid observed statistic');
    }
    if(fields.attemptId!==undefined&&!token(fields.attemptId))throw Error('Invalid observed attempt');
  }
  function validateMove(fields){
    fields=pick(fields,moveFields);if(!token(fields.attemptId)||!integer(fields.turn)||!Array.isArray(fields.pair)||fields.pair.length!==2||fields.pair.some(value=>!integer(value)))throw Error('Invalid observed move');
    for(const field of ['scoreBefore','scoreAfter','movesRemaining','coveredBefore','coveredAfter','remainingLayers','waves'])if(!integer(fields[field]))throw Error('Invalid move statistic');
    if(!Array.isArray(fields.cells)||fields.cells.length!==2||fields.cells.some(cell=>!cell||Object.keys(cell).sort().join(',')!=='q,r'||!Number.isSafeInteger(cell.q)||!Number.isSafeInteger(cell.r)))throw Error('Invalid observed cell');
    if(!Array.isArray(fields.matchedIndices)||fields.matchedIndices.some(value=>!integer(value)))throw Error('Invalid matched indices');
    if(fields.developerBypass!==undefined&&typeof fields.developerBypass!=='boolean')throw Error('Invalid move test setting');
    return fields;
  }
  function createTracker({now,monotonic,state=null,limit=2000}={}){
    if(typeof now!=='function'||typeof monotonic!=='function'||!integer(limit)||limit<10||limit>10000)throw Error('Playtest clocks and bounded capacity are required');
    let data=state?copy(state):{schemaVersion:1,enabled:false,limit,overflow:false,events:[],attempts:[]};
    function validate(){
      if(data.schemaVersion!==1||typeof data.enabled!=='boolean'||!integer(data.limit)||data.limit<10||data.limit>10000||typeof data.overflow!=='boolean'||!Array.isArray(data.events)||data.events.length>data.limit||!Array.isArray(data.attempts)||data.attempts.length>data.limit)throw Error('Invalid playtest save');
      if(Object.keys(data).some(key=>!['schemaVersion','enabled','limit','overflow','events','attempts'].includes(key)))throw Error('Unexpected playtest save field');
      for(const attempt of data.attempts){
        if(!token(attempt.attemptId)||!integer(attempt.activeMs)||typeof attempt.observedStart!=='boolean'||Object.keys(attempt).some(key=>!['attemptId','activeMs','observedStart'].includes(key)))throw Error('Invalid playtest attempt');
      }
      for(const event of data.events){
        if(!event||!['move',...eventNames].includes(event.name)||!integer(event.utcMs)||!event.data||typeof event.data!=='object'||Object.keys(event).some(key=>!['name','utcMs','data'].includes(key)))throw Error('Invalid playtest event');
        if(event.name==='move')validateMove(event.data);else{
          pick(event.data,[...contextFields,...detailFields,...derivedFields]);
          const fields={...event.data};for(const key of derivedFields)delete fields[key];validateFields(fields);
          for(const key of ['missingScore','missingGround'])if(event.data[key]!==undefined&&!integer(event.data[key]))throw Error('Invalid observed deficit');
          if(event.data.failureReason!==undefined&&!['none','score_and_ground','score','ground'].includes(event.data.failureReason))throw Error('Invalid observed outcome');
        }
      }
    }
    validate();let active=false,current=null,last=monotonic();
    function clock(){const value=monotonic();if(!Number.isFinite(value)||value<0)throw Error('Invalid monotonic clock');return value;}
    function attempt(id){
      if(!token(id))return null;let found=data.attempts.find(item=>item.attemptId===id);
      if(!found&&data.attempts.length<data.limit){found={attemptId:id,activeMs:0,observedStart:false};data.attempts.push(found);}return found;
    }
    function flush(){const time=Math.max(clock(),last);if(data.enabled&&active&&current){const entry=attempt(current);if(entry)entry.activeMs+=Math.max(0,Math.floor(time-last));}last=time;}
    function add(name,fields){
      if(!data.enabled)return false;flush();
      if(data.events.length>=data.limit){data.overflow=true;return false;}
      const time=now();if(!integer(time))throw Error('Invalid UTC clock');
      data.events.push({name,utcMs:time,data:fields});return true;
    }
    function setEnabled(enabled){if(typeof enabled!=='boolean')throw Error('Invalid playtest preference');flush();data.enabled=enabled;last=clock();}
    function setActivity({playing,attemptId=null}){if(typeof playing!=='boolean'||attemptId!==null&&!token(attemptId))throw Error('Invalid playtest activity');flush();active=playing;current=attemptId;}
    function recordEvent(name,context={},details={}){
      if(!eventNames.includes(name))return false;
      const fields={...pick(context,contextFields),...pick(details,detailFields)};
      validateFields(fields);
      if(!data.enabled)return false;
      const entry=attempt(fields.attemptId);if(entry&&name==='level_started')entry.observedStart=true;
      if(name==='level_completed'||name==='level_failed'){
        fields.missingScore=Math.max(0,(fields.targetScore||0)-(fields.score||0));
        fields.missingGround=Math.max(0,(fields.totalCells||0)-(fields.covered||0));
        fields.failureReason=name==='level_completed'?'none':fields.missingScore&&fields.missingGround?'score_and_ground':fields.missingScore?'score':'ground';
      }
      return add(name,fields);
    }
    function recordMove(fields){
      fields=validateMove(fields);
      return add('move',fields);
    }
    function snapshot(){flush();return copy(data);}
    function exportData(){const result=snapshot();return {...result,exportedAtUtc:now(),scope:'local_opt_in_no_personal_data',activeTimeDefinition:'Focused playing game, excluding animations, dialogs and background; monotonic per document.',limitations:['No global player identity or server upload.','Imported/resumed starts may be unobserved.','Overflow indicates an incomplete observation window.']};}
    function clear(){const enabled=data.enabled;data={schemaVersion:1,enabled,limit:data.limit,overflow:false,events:[],attempts:[]};last=clock();}
    return Object.freeze({setEnabled,setActivity,recordEvent,recordMove,snapshot,exportData,clear});
  }
  global.HexPlaytest=Object.freeze({createTracker});if(typeof module!=='undefined'&&module.exports)module.exports=global.HexPlaytest;
})(typeof window!=='undefined'?window:globalThis);
