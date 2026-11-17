/* Transient idle guidance. Input facts and legal moves remain owned by the app
 * and engine; this module owns only clocks, session limits and presentation. */
(function(root){
  'use strict';
  const CONFIG=Object.freeze({firstDelay:10000,nextDelay:35000,minInterval:60000,maxPerAttempt:2,duration:900,repeatDelay:900});
  const integer=value=>Number.isSafeInteger(value)&&value>=0;
  const identity=value=>typeof value==='string'&&value.length>0;
  const pair=value=>dense(value)&&value.length===2&&value.every(integer)&&value[0]!==value[1];
  const same=(a,b)=>!!a&&!!b&&a.eligible===b.eligible&&a.attemptId===b.attemptId&&a.generation===b.generation&&a.boardKey===b.boardKey;

  // The whitelist mirrors observable-player's visible first-wave coverage
  // policy. The caller supplies canonical legalMoves and Engine.findMatches;
  // no alternative matching, future refill, RNG or solver is used here.
  const dense=value=>{if(!Array.isArray(value))return false;for(let i=0;i<value.length;i++)if(!Object.prototype.hasOwnProperty.call(value,i))return false;return true;};
  const int32=value=>Number.isInteger(value)&&value>=-2147483648&&value<=2147483647;
  const coordinate=cell=>cell.q+','+cell.r;
  const adjacent=(a,b)=>{const dq=a.q-b.q,dr=a.r-b.r;return Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))===1;};
  const frozenList=values=>Object.freeze(values.slice());
  function descriptor(selected,matched,blockers){
    const selectedPair=selected.slice().sort((a,b)=>a-b),[a,b]=selectedPair,destinations=matched.slice().sort((a,b)=>a-b);
    return Object.freeze({pair:frozenList(selectedPair),matched:frozenList(destinations),matchingSources:frozenList(destinations.map(i=>i===a?b:i===b?a:i).sort((a,b)=>a-b)),blockers:frozenList(blockers.slice().sort((a,b)=>a-b))});
  }
  function visibleObstacles(input){
    const {cells,obstacles:data,blockerHp:hp,regionOpen:opened}=input,n=input.values.length,index=i=>integer(i)&&i<n,id=s=>typeof s==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(s);
    if(!dense(cells)||cells.length!==n||cells.some(c=>!c||Array.isArray(c)||!int32(c.q)||!int32(c.r))||new Set(cells.map(coordinate)).size!==n||!data||Array.isArray(data)||data.version!=='obstacles-v1'||!dense(data.blockers)||!dense(data.regions)||!dense(hp)||hp.length!==data.blockers.length||!dense(opened)||opened.length!==data.regions.length||opened.some(v=>typeof v!=='boolean'))return null;
    const flow=data.activation==='column-flow-v1',boxIds=new Map(),occupied=new Set(),regionIds=new Map(),closed=new Set();
    if(data.activation!==undefined&&!flow)return null;
    for(let i=0;i<data.blockers.length;i++){
      const b=data.blockers[i];if(!b||Array.isArray(b)||!id(b.id)||boxIds.has(b.id)||!index(b.cell)||occupied.has(b.cell)||![1,2].includes(b.hp)||!integer(hp[i])||hp[i]>b.hp||b.required!==undefined&&typeof b.required!=='boolean')return null;
      boxIds.set(b.id,i);occupied.add(b.cell);
    }
    for(let i=0;i<data.regions.length;i++){
      const r=data.regions[i];if(!r||Array.isArray(r)||!id(r.id)||regionIds.has(r.id)||!dense(r.cells)||!r.cells.length||!dense(r.requires)||(flow?r.requires.length!==0:!r.requires.length)||new Set(r.requires).size!==r.requires.length||r.required!==undefined&&typeof r.required!=='boolean')return null;
      for(const j of r.cells){if(!index(j)||closed.has(j))return null;closed.add(j);}
      if(r.requires.some(key=>!boxIds.has(key)))return null;regionIds.set(r.id,i);
    }
    for(const b of data.blockers)if(b.regionId!==undefined&&(flow||!regionIds.has(b.regionId)||!data.regions[regionIds.get(b.regionId)].requires.includes(b.id)))return null;
    const byCoord=new Map(cells.map((c,i)=>[coordinate(c),i])),boxAt=new Map(data.blockers.map((b,i)=>[b.cell,i]));
    function reached(health){
      const mask=cells.map(()=>false);
      for(const source of data.sources){let i=source;while(i!==undefined){const b=boxAt.get(i);if(b!==undefined&&health[b]>0)break;mask[i]=true;const c=cells[i];i=byCoord.get(c.q+','+(c.r+1));}}
      return mask;
    }
    let active;
    if(flow){
      if(!dense(data.sources)||!data.sources.length||new Set(data.sources).size!==data.sources.length||data.sources.some(i=>!index(i))||new Set(data.sources.map(i=>cells[i].q)).size!==data.sources.length||data.sources.some(i=>cells.some(c=>c.q===cells[i].q&&c.r<cells[i].r))||!dense(input.cellOpen)||input.cellOpen.length!==n||input.cellOpen.some(v=>typeof v!=='boolean'))return null;
      active=reached(hp);if(!reached(hp.map(()=>0)).every(Boolean)||active.some((v,i)=>v!==input.cellOpen[i])||data.regions.some((r,i)=>opened[i]!==r.cells.every(j=>active[j])))return null;
    }else{
      if(data.sources!==undefined||input.cellOpen!==undefined||data.regions.some((r,i)=>opened[i]!==r.requires.every(key=>hp[boxIds.get(key)]===0)))return null;
      if(data.blockers.some((b,i)=>data.regions.some((r,j)=>!opened[j]&&r.cells.includes(b.cell))&&hp[i]!==b.hp))return null;
      active=cells.map((_,i)=>!data.blockers.some((b,j)=>b.cell===i&&hp[j]>0)&&!data.regions.some((r,j)=>!opened[j]&&r.cells.includes(i)));
      // Reject cyclic or spatially unreachable authored dependencies using only
      // visible axial geometry. This is reachability, never a move search.
      const removed=new Set(),unlocked=new Set(),exposed=new Set(cells.map((_,i)=>i).filter(i=>!occupied.has(i)&&!closed.has(i)));let changed=true;
      while(changed){changed=false;
        data.blockers.forEach(b=>{if(!removed.has(b.id)&&data.regions.every(r=>!r.cells.includes(b.cell)||unlocked.has(r.id))&&[...exposed].some(i=>adjacent(cells[i],cells[b.cell]))){removed.add(b.id);exposed.add(b.cell);changed=true;}});
        data.regions.forEach(r=>{if(!unlocked.has(r.id)&&r.requires.every(key=>removed.has(key))){unlocked.add(r.id);r.cells.forEach(i=>{if(!data.blockers.some(b=>b.cell===i&&!removed.has(b.id)))exposed.add(i);});changed=true;}});
      }
      if(removed.size!==data.blockers.length||unlocked.size!==data.regions.length)return null;
    }
    if(input.values.some((v,i)=>active[i]?!int32(v):v!==null))return null;
    const objectivesMet=data.blockers.every((b,i)=>b.required===false||hp[i]===0)&&data.regions.every((r,i)=>r.required===false||opened[i]);
    function preview(matched){
      const touched=[],after=hp.slice();
      data.blockers.forEach((b,i)=>{if(hp[i]>0&&(flow||data.regions.every((r,j)=>opened[j]||!r.cells.includes(b.cell)))&&matched.some(j=>adjacent(cells[j],cells[b.cell]))){touched.push(b.cell);after[i]--;}});
      let next;
      if(flow)next=reached(after);
      else{const nextRegions=data.regions.map(r=>r.requires.every(key=>after[boxIds.get(key)]===0));next=cells.map((_,i)=>!data.blockers.some((b,j)=>b.cell===i&&after[j]>0)&&!data.regions.some((r,j)=>!nextRegions[j]&&r.cells.includes(i)));}
      return {blockers:touched,opened:next.reduce((sum,v,i)=>sum+Number(v&&!active[i]),0)};
    }
    return {active,cells,objectivesMet,preview};
  }
  function chooseVisibleHint(input,legalPairs,findMatches,avoidPair=null){
    try{return selectVisible(input,legalPairs,findMatches,avoidPair);}catch(_){return null;}
  }
  function selectVisible(input,legalPairs,findMatches,avoidPair){
    if(!input||typeof input!=='object'||!dense(input.values)||!dense(input.layers)||!input.values.length||input.layers.length!==input.values.length||!input.layers.every(integer)||!integer(input.score)||!integer(input.target)||!integer(input.movesLeft)||!Array.isArray(legalPairs)||typeof findMatches!=='function')return null;
    const v5=input.rulesVersion==='classic-v5';
    if(!v5&&(![undefined,null,'classic-v4'].includes(input.rulesVersion)||!input.values.every(Number.isInteger)))return null;
    const obstacle=v5&&dense(input.values)&&dense(input.layers)?visibleObstacles(input):null;if(v5&&!obstacle)return null;
    const values=input.values.slice(),layers=input.layers.slice(),score=input.score,target=input.target,movesLeft=input.movesLeft,targetMode=input.targetMode==='exact'?'exact':'minimum';
    if(!movesLeft||layers.every(value=>value===0)&&(targetMode==='exact'?score===target:score>=target)&&(!v5||obstacle.objectivesMet)||targetMode==='exact'&&score>target)return null;
    const choices=[],seen=new Set();
    for(const candidate of legalPairs){
      if(!pair(candidate)||candidate.some(index=>index>=values.length))continue;
      const [a,b]=candidate.slice().sort((x,y)=>x-y),key=a+':'+b;
      if(seen.has(key)||values[a]===values[b]||v5&&(!obstacle.active[a]||!obstacle.active[b]||!adjacent(obstacle.cells[a],obstacle.cells[b])))continue;seen.add(key);
      const swapped=values.slice();[swapped[a],swapped[b]]=[swapped[b],swapped[a]];
      let matched;try{matched=findMatches(swapped);}catch(_){continue;}
      if(!dense(matched)||!matched.length||!matched.every(index=>integer(index)&&index<values.length&&(!v5||obstacle.active[index]))||new Set(matched).size!==matched.length)continue;
      const scoreGain=matched.reduce((sum,index)=>sum+swapped[index],0),layerGain=matched.filter(index=>layers[index]>0).length,greenGain=matched.filter(index=>layers[index]===1).length;
      const preview=v5?obstacle.preview(matched):{blockers:[],opened:0};
      const rank=layerGain*100+greenGain*35+Math.min(scoreGain,Math.max(0,target-score))*.1+preview.blockers.length*120+preview.opened*25;
      choices.push({hint:descriptor([a,b],matched,preview.blockers),rank});
    }
    const previous=pair(avoidPair)?avoidPair.slice().sort((a,b)=>a-b).join(':'):null;
    const alternatives=previous===null?choices:choices.filter(choice=>choice.hint.pair.join(':')!==previous),ranked=alternatives.length?alternatives:choices;
    ranked.sort((a,b)=>b.rank-a.rank||a.hint.pair[0]-b.hint.pair[0]||a.hint.pair[1]-b.hint.pair[1]);
    return ranked.length?ranked[0].hint:null;
  }
  function chooseVisiblePair(input,legalPairs,findMatches,avoidPair=null){return chooseVisibleHint(input,legalPairs,findMatches,avoidPair)?.pair||null;}
  function copyPreview(value){
    if(Array.isArray(value))return pair(value)?Object.freeze({pair:frozenList(value)}):null;
    if(!value||typeof value!=='object'||!pair(value.pair)||!['matched','matchingSources','blockers'].every(key=>dense(value[key])&&value[key].every(integer)&&new Set(value[key]).size===value[key].length)||!value.matched.length||value.matched.length!==value.matchingSources.length)return null;
    const [a,b]=value.pair,expected=value.matched.map(i=>i===a?b:i===b?a:i).sort((a,b)=>a-b),actual=value.matchingSources.slice().sort((a,b)=>a-b);if(expected.some((i,j)=>actual[j]!==i))return null;
    return descriptor(value.pair,value.matched,value.blockers);
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
      let preview;try{preview=copyPreview(selected);}catch(_){preview=null;}
      if(!preview){idleSince=null;return;}
      const afterCopy=view();if(!same(afterCopy,expected)){apply(afterCopy,time());schedule();return;}
      const active=entry();if(deadline()===null)return;
      const shownAt=time();active.shown++;active.armed=false;lastShownAt=shownAt;active.lastBoard=current.boardKey;
      cancelIdle();cancelRepeat();hide('replaced');
      active.lastPair=preview.pair;
      const payload=Object.freeze({...preview,attemptId:current.attemptId,generation:current.generation,boardKey:current.boardKey,duration:limits.duration,ordinal:active.shown,repeated:false});
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
  const api=Object.freeze({CONFIG,chooseVisibleHint,chooseVisiblePair,create});root.HexIdleHints=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
