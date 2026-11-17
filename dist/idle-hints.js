/* Transient idle guidance. Input facts and legal moves remain owned by the app
 * and engine; this module owns only clocks, session limits and presentation. */
(function(root){
  'use strict';
  const CONFIG=Object.freeze({firstDelay:10000,nextDelay:35000,minInterval:60000,maxPerAttempt:2,duration:900,repeatDelay:4000});
  const integer=value=>Number.isSafeInteger(value)&&value>=0;
  const identity=value=>typeof value==='string'&&value.length>0;
  const pair=value=>Array.isArray(value)&&value.length===2&&value.every(integer)&&value[0]!==value[1];
  const same=(a,b)=>!!a&&!!b&&a.eligible===b.eligible&&a.attemptId===b.attemptId&&a.generation===b.generation&&a.boardKey===b.boardKey;

  // The whitelist mirrors observable-player's visible first-wave coverage
  // policy. The caller supplies canonical legalMoves and Engine.findMatches;
  // no alternative matching, future refill, RNG or solver is used here.
  function chooseVisiblePair(input,legalPairs,findMatches,avoidPair=null){
    if(!input||typeof input!=='object'||!Array.isArray(input.values)||!Array.isArray(input.layers)||!input.values.length||input.layers.length!==input.values.length||!input.values.every(Number.isInteger)||!input.layers.every(integer)||!integer(input.score)||!integer(input.target)||!integer(input.movesLeft)||!Array.isArray(legalPairs)||typeof findMatches!=='function')return null;
    const values=input.values.slice(),layers=input.layers.slice(),score=input.score,target=input.target,movesLeft=input.movesLeft,targetMode=input.targetMode==='exact'?'exact':'minimum';
    if(!movesLeft||layers.every(value=>value===0)&&(targetMode==='exact'?score===target:score>=target)||targetMode==='exact'&&score>target)return null;
    const choices=[],seen=new Set();
    for(const candidate of legalPairs){
      if(!pair(candidate)||candidate.some(index=>index>=values.length))continue;
      const [a,b]=candidate.slice().sort((x,y)=>x-y),key=a+':'+b;
      if(seen.has(key)||values[a]===values[b])continue;seen.add(key);
      const swapped=values.slice();[swapped[a],swapped[b]]=[swapped[b],swapped[a]];
      let matched;try{matched=findMatches(swapped);}catch(_){continue;}
      if(!Array.isArray(matched)||!matched.length||!matched.every(index=>integer(index)&&index<values.length)||new Set(matched).size!==matched.length)continue;
      const scoreGain=matched.reduce((sum,index)=>sum+swapped[index],0),layerGain=matched.filter(index=>layers[index]>0).length,greenGain=matched.filter(index=>layers[index]===1).length;
      const rank=layerGain*100+greenGain*35+Math.min(scoreGain,Math.max(0,target-score))*.1;
      choices.push({pair:[a,b],rank});
    }
    const previous=pair(avoidPair)?avoidPair.slice().sort((a,b)=>a-b).join(':'):null;
    const alternatives=previous===null?choices:choices.filter(choice=>choice.pair.join(':')!==previous);
    const ranked=alternatives.length?alternatives:choices;
    ranked.sort((a,b)=>b.rank-a.rank||a.pair[0]-b.pair[0]||a.pair[1]-b.pair[1]);
    return ranked.length?Object.freeze(ranked[0].pair):null;
  }

  // read(): {eligible,attemptId,generation,boardKey}. The board key is derived
  // exclusively from visible board facts by the caller. False eligibility
  // resets the full idle delay; the page-runtime minimum interval keeps
  // elapsing across attempts. Quota, disarm and previous pairs stay per attempt.
  // An untouched hint cycle repeats the same cue after each quiet repeatDelay;
  // repeats consume no quota and never advance the minimum-interval timestamp.
  // choosePair receives those same facts plus previousPair for this attempt.
  // subscribe(sync), when supplied, returns an unsubscribe function. config
  // may override CONFIG fields for one instance; defaults remain immutable.
  function create({read,choosePair,onShow,onHide,now,setTimeout:scheduleTimeout,clearTimeout:cancelTimeout,subscribe,config={}}={}){
    if(![read,choosePair,onShow,onHide,now,scheduleTimeout,cancelTimeout].every(value=>typeof value==='function')||subscribe!==undefined&&typeof subscribe!=='function')throw new TypeError('invalid_idle_hint_dependencies');
    if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(key=>!Object.prototype.hasOwnProperty.call(CONFIG,key)))throw new TypeError('invalid_idle_hint_config');
    const limits=Object.freeze({...CONFIG,...config});
    if(!Object.entries(limits).every(([key,value])=>integer(value)&&(!['maxPerAttempt','repeatDelay'].includes(key)||value>0)))throw new TypeError('invalid_idle_hint_config');
    const attempts=new Map();
    let disposed=false,current=null,idleSince=null,idleTimer=null,idleDue=null,hideTimer=null,visible=null,revision=0,presentationRevision=0,lastTime=-Infinity,lastShownAt=null,unsubscribe=null;
    let cycle=null,repeatTimer=null,repeatDue=null,repeatRevision=0;
    function time(){const value=now();if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError('invalid_idle_hint_clock');lastTime=Math.max(lastTime,value);return lastTime;}
    function view(){
      let value;try{value=read();}catch(_){value=null;}
      if(!value||typeof value!=='object'||typeof value.eligible!=='boolean'||!identity(value.attemptId)||!integer(value.generation)||!identity(value.boardKey))return Object.freeze({eligible:false,attemptId:null,generation:0,boardKey:null});
      return Object.freeze({eligible:value.eligible,attemptId:value.attemptId,generation:value.generation,boardKey:value.boardKey});
    }
    function entry(){
      if(!current?.attemptId)return null;
      if(!attempts.has(current.attemptId))attempts.set(current.attemptId,{shown:0,armed:true,lastBoard:null,lastPair:null});
      return attempts.get(current.attemptId);
    }
    function cancelIdle(){if(idleTimer!==null)cancelTimeout(idleTimer);idleTimer=null;idleDue=null;revision++;}
    function cancelRepeat(){if(repeatTimer!==null)cancelTimeout(repeatTimer);repeatTimer=null;repeatDue=null;cycle=null;repeatRevision++;}
    function hide(reason){
      if(hideTimer!==null)cancelTimeout(hideTimer);hideTimer=null;presentationRevision++;
      const previous=visible;visible=null;
      if(previous)try{onHide(Object.freeze({...previous,reason}));}catch(_){}
    }
    function apply(next,at){
      if(same(current,next))return false;
      cancelIdle();cancelRepeat();hide('state_changed');current=next;idleSince=next.eligible?at:null;entry();return true;
    }
    function deadline(){
      const active=entry();
      if(disposed||!current?.eligible||idleSince===null||!active||!active.armed||active.shown>=limits.maxPerAttempt||active.lastBoard===current.boardKey)return null;
      return Math.max(idleSince+(active.shown?limits.nextDelay:limits.firstDelay),lastShownAt===null?-Infinity:lastShownAt+limits.minInterval);
    }
    function schedule(){
      const due=deadline();
      if(due===null){if(idleTimer!==null)cancelIdle();return;}
      if(idleTimer!==null&&idleDue===due)return;
      cancelIdle();const token=revision;idleDue=due;
      // Browser timers cap at a signed 32-bit delay. Long configured waits use
      // bounded wakeups so overflow cannot turn them into immediate retries.
      idleTimer=scheduleTimeout(()=>fire(token),Math.min(2147483647,Math.max(0,due-time())));
    }
    function scheduleRepeat(activeCycle){
      if(disposed||cycle!==activeCycle||!same(current,activeCycle.view))return;
      const at=time(),next=view();
      if(!same(next,activeCycle.view)){apply(next,at);schedule();return;}
      repeatDue=at+limits.repeatDelay;armRepeat(activeCycle);
    }
    function armRepeat(activeCycle){
      const token=++repeatRevision;
      repeatTimer=scheduleTimeout(()=>repeat(token,activeCycle),Math.min(2147483647,Math.max(0,repeatDue-time())));
    }
    function repeat(token,activeCycle){
      if(disposed||token!==repeatRevision||cycle!==activeCycle||repeatDue===null)return;
      repeatTimer=null;const at=time(),next=view();
      if(!same(next,activeCycle.view)){apply(next,at);schedule();return;}
      if(at<repeatDue){armRepeat(activeCycle);return;}
      repeatDue=null;repeatRevision++;
      showCue(Object.freeze({...activeCycle.payload,repeated:true}),at,activeCycle);
    }
    function showCue(payload,shownAt,activeCycle){
      visible=payload;
      const expiresAt=shownAt+limits.duration;
      function armHide(){
        const presentationToken=++presentationRevision;
        hideTimer=scheduleTimeout(()=>expire(presentationToken),Math.min(2147483647,Math.max(0,expiresAt-time())));
      }
      function expire(presentationToken){
        if(disposed||presentationToken!==presentationRevision)return;
        hideTimer=null;const remaining=expiresAt-time();
        if(remaining>0)armHide();
        else{hide('elapsed');scheduleRepeat(activeCycle);}
      }
      armHide();
      try{onShow(payload);}catch(_){cancelRepeat();hide('presentation_error');}
    }
    function fire(token){
      if(disposed||token!==revision)return;
      idleTimer=null;idleDue=null;
      const at=time(),next=view();
      if(apply(next,at)){schedule();return;}
      const due=deadline();if(due===null)return;if(at<due){schedule();return;}
      const expected=current;
      const context=Object.freeze({...expected,previousPair:entry().lastPair});
      let selected;try{selected=choosePair(context);}catch(_){selected=null;}
      if(disposed||token!==revision)return;
      const checked=view();
      if(!same(checked,expected)){apply(checked,time());schedule();return;}
      if(!pair(selected)){idleSince=null;return;}
      const active=entry();if(deadline()===null)return;
      const shownAt=time();active.shown++;active.armed=false;lastShownAt=shownAt;active.lastBoard=current.boardKey;
      cancelIdle();cancelRepeat();hide('replaced');
      active.lastPair=Object.freeze(selected.slice());
      const payload=Object.freeze({pair:active.lastPair,attemptId:current.attemptId,generation:current.generation,boardKey:current.boardKey,duration:limits.duration,ordinal:active.shown,repeated:false});
      const activeCycle={view:current,payload};cycle=activeCycle;
      showCue(payload,shownAt,activeCycle);
    }
    function sync(){if(disposed)return;apply(view(),time());schedule();}
    function interaction(){
      if(disposed)return;const at=time();apply(view(),at);cancelIdle();cancelRepeat();hide('interaction');idleSince=current.eligible?at:null;schedule();
    }
    // Called only after an authoritative, persisted PLAYER swap succeeds.
    // Presentation can still make eligibility false; settling starts the idle
    // delay later. Invalid swaps, boosters and manual hints never call this.
    function playerMoveSucceeded(){
      if(disposed)return;const at=time();apply(view(),at);cancelIdle();cancelRepeat();hide('player_move');
      const active=entry();if(active&&active.lastBoard!==current.boardKey)active.armed=true;
      idleSince=current.eligible?at:null;schedule();
    }
    function dispose(){
      if(disposed)return;disposed=true;cancelIdle();cancelRepeat();hide('disposed');const remove=unsubscribe;unsubscribe=null;
      try{if(remove)remove();}finally{attempts.clear();current=null;idleSince=null;}
    }
    try{
      if(subscribe){const remove=subscribe(sync);if(typeof remove!=='function')throw new TypeError('invalid_idle_hint_subscription');unsubscribe=remove;}
      sync();
    }catch(error){dispose();throw error;}
    return Object.freeze({config:limits,sync,interaction,playerMoveSucceeded,dispose});
  }
  const api=Object.freeze({CONFIG,chooseVisiblePair,create});root.HexIdleHints=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
