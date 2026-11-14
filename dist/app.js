window.HexSessionStore.boot(function startApp(session) {
  'use strict';
  const $ = id => document.getElementById(id);
  const tutorials=window.HEX_TUTORIALS||[];
  const levels=[...tutorials,...window.HEX_LEVELS];
  const tutorialCount=tutorials.length,campaignCount=window.HEX_LEVELS.length;
  const key = 'hexrota-match-v5',eventKey='hexrota-events-v1';
  let variantCatalog=null;
  if(window.HexAttempts)try{variantCatalog=window.HexAttempts.createCatalog(window.HEX_LEVELS,window.HEX_VARIANTS||null,window.HexMatch);}catch(_){try{variantCatalog=window.HexAttempts.createCatalog(window.HEX_LEVELS,null,window.HexMatch);}catch(_){}}
  const motion={swap:300,digit:240,spread:180,collectPulse:100,pop:200,hold:140,flight:380,count:140,arrival:220,burst:220,ring:300,particle:320,matchPause:430,fall:380,fallStagger:70,columnDelay:16,invalid:280,budget:3300};
  let migrated=false;
  const pad = n => String(n).padStart(2, '0');
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const reduceMotion=()=>saved.preferences.motion==='reduce'||(saved.preferences.motion==='auto'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  const defaultPreferences={music:false,volume:.65,motion:'auto',haptics:false};
  let saved={current:0,done:[],boards:{},attempts:{},attemptStats:{},variantSelection:{seed:0,serial:0,counts:{},recent:{}},guideAcks:[],sound:false,preferences:{...defaultPreferences},records:{}};
  function readSave(name){try{return session?session.read(name):JSON.parse(localStorage.getItem(name));}catch(_){return null;}}
  try {
    let raw=readSave(key);
    if(!raw){
      const previousKey=['hexrota-match-v4','hexrota-match-v3','hexrota-match-v2'].find(name=>readSave(name));
      const previous=previousKey?readSave(previousKey):null;
      if(previous){
        const boards={};
        if(previousKey==='hexrota-match-v4'&&previous.boards)for(let i=0;i<campaignCount;i++)if(previous.boards[i])boards[i+tutorialCount]=previous.boards[i];
        raw={current:Number.isInteger(previous.current)?previous.current+tutorialCount:tutorialCount,done:[...tutorials.map((_,i)=>i),...(Array.isArray(previous.done)?previous.done.filter(i=>Number.isInteger(i)&&i>=0&&i<campaignCount).map(i=>i+tutorialCount):[])],boards,sound:previous.sound};
        migrated=true;
      }
    }
    if(raw&&typeof raw==='object'){
      saved.done=Array.isArray(raw.done)?[...new Set(raw.done.filter(i=>Number.isInteger(i)&&i>=0&&i<levels.length))]:[];
      saved.current=Number.isInteger(raw.current)&&raw.current>=0&&raw.current<levels.length?raw.current:0;
      saved.sound=raw.sound===true;
      saved.guideAcks=Array.isArray(raw.guideAcks)?[...new Set(raw.guideAcks.filter(id=>typeof id==='string'&&tutorials.some((level,index)=>level.steps.some((step,turn)=>step.acknowledge&&id===`${index}:${turn+1}`))))]:[];
      const preferences=raw.preferences||{};
      saved.preferences={music:preferences.music===true,volume:Number.isFinite(preferences.volume)?Math.max(0,Math.min(1,preferences.volume)):.65,motion:['auto','reduce','full'].includes(preferences.motion)?preferences.motion:'auto',haptics:preferences.haptics===true};
      if(raw.records&&typeof raw.records==='object')for(let i=0;i<levels.length;i++){
        const r=raw.records[i];
        if(r&&Number.isInteger(r.score)&&r.score>=0&&r.score<=1000000&&Number.isInteger(r.movesLeft)&&r.movesLeft>=0&&r.movesLeft<=levels[i].moves)saved.records[i]={score:r.score,movesLeft:r.movesLeft,plays:Number.isInteger(r.plays)&&r.plays>=0?Math.min(r.plays,1000000):0};
      }
      if(raw.boards&&typeof raw.boards==='object')for(let i=0;i<levels.length;i++)if(raw.boards[i]&&typeof raw.boards[i]==='object')saved.boards[i]=raw.boards[i];
      if(raw.attempts&&typeof raw.attempts==='object')for(let i=0;i<levels.length;i++)if(Object.prototype.hasOwnProperty.call(raw.attempts,i))saved.attempts[i]=raw.attempts[i];
      if(raw.attemptStats&&typeof raw.attemptStats==='object')for(let i=0;i<levels.length;i++)if(raw.attemptStats[i]&&typeof raw.attemptStats[i]==='object'&&!Array.isArray(raw.attemptStats[i]))saved.attemptStats[i]=raw.attemptStats[i];
      const selection=raw.variantSelection;
      if(selection&&typeof selection==='object'){
        if(Number.isInteger(selection.seed)&&selection.seed>0&&selection.seed<=0xffffffff)saved.variantSelection.seed=selection.seed;
        if(Number.isSafeInteger(selection.serial)&&selection.serial>=0)saved.variantSelection.serial=selection.serial;
        for(const level of levels){
          const id=String(level.id),count=selection.counts?.[id],recent=selection.recent?.[id];
          if(Number.isSafeInteger(count)&&count>=0)saved.variantSelection.counts[id]=count;
          if(Array.isArray(recent))saved.variantSelection.recent[id]=recent.filter(value=>typeof value==='string'&&value.length<=80).slice(-16);
        }
      }

    }else saved.sound=readSave('hexrota-v1')?.sound===true;
  }catch(_){}
  let active=saved.current,activeLevel=levels[saved.current],activeAttempt=null,attemptPending=true,saveBlocked=false,loadIssue=null,engine, selected=null, hinted=null, busy=false, focusIndex=0;
  let pointer=null, toastTimer, terminalTimer, epoch=0, comboText='',presentation=null,hintJob=null;
  const geometryCache=new Map();
  let screen='home',paused=false,pendingStage=null,pendingRestart=null;
  const modalStack=[];
  const audio=window.HexAudio?new window.HexAudio({sfx:saved.sound,music:saved.preferences.music,volume:saved.preferences.volume}):null;
  const difficultyLabels={very_easy:'Çok kolay',easy:'Kolay',medium:'Orta',medium_hard:'Orta-zor',challenge:'Meydan okuma',relief:'Rahatlama',hard:'Zor',final:'Final'};
  let rewardState=null,completionReward=null,completionRewardPlayed=false;
  const rewardReady=()=>!!(window.HexRewards&&window.HexRewardAdapter&&window.HEX_REWARD_RULES);
  function rewardLabel(cue){
    if(!cue)return '';
    switch(cue.labelKey){
      case 'long_run':return cue.value>=5?'Uzun bir rota!':'Güzel eşleşme!';
      case 'chain':return `${cue.value}. zincir!`;
      case 'cross':return cue.value>=3?'Üç yönde eşleşti!':'Çapraz eşleşme!';
      case 'simultaneous':return 'Birden fazla eşleşme!';
      case 'green':return 'Yeni yerler yeşil!';
      case 'doubles':return `${cue.value} yer daha yeşil!`;
      case 'score_goal':return 'Puan hedefi tamam!';
      case 'ground_goal':return 'Her yer yeşil!';
      case 'last_move_win':return 'Tam zamanında!';
      case 'win':return 'Yeşil rota tamam!';
      default:return '';
    }
  }
  function restoreRewards(){
    rewardState=null;completionReward=null;completionRewardPlayed=false;
    if(!rewardReady())return;
    try{rewardState=window.HexRewardAdapter.restore(activeLevel,engine.snapshot(),window.HEX_REWARD_RULES,window.HexMatch,window.HexRewards,activeAttempt?.attemptId||String(activeLevel.id)).state;}catch(_){}
  }
  function planRewards(before,result){
    if(!rewardReady())return null;
    try{
      if(!rewardState)rewardState=window.HexRewardAdapter.restore(activeLevel,before,window.HEX_REWARD_RULES,window.HexMatch,window.HexRewards,activeAttempt?.attemptId||String(activeLevel.id)).state;
      const input=window.HexRewardAdapter.summarize(activeLevel,before,result,engine,activeAttempt?.attemptId||String(activeLevel.id));
      const evaluated=window.HexRewards.evaluate(input,rewardState,window.HEX_REWARD_RULES);
      rewardState=evaluated.nextState;
      completionReward=evaluated.plan.headline?.completion?evaluated.plan.headline:null;completionRewardPlayed=false;
      return evaluated.plan;
    }catch(_){rewardState=null;completionReward=null;return null;}
  }
  function rewardForWave(job,wave){
    const cues=job.rewardPlan?.waves?.filter(cue=>cue.wave===wave||(wave===2&&cue.wave>2))||[];
    return cues.reduce((best,cue)=>!best||cue.tier>best.tier||(cue.tier===best.tier&&cue.rawTier>best.rawTier)?cue:best,null);
  }
  function rewardHeadline(job,wave){
    const cue=job.rewardPlan?.headline;
    if(!cue||cue.completion||job.rewardHeadlineUsed||Math.min(2,cue.wave)!==wave)return null;
    // A floor/score goal from compressed later waves is named after the final board is visible.
    if(cue.wave>2&&(cue.reason==='score_goal'||cue.reason==='ground_goal'))return null;
    job.rewardHeadlineUsed=true;return cue;
  }
  function rewardFeedback(job,cue){
    if(!cue||job.controller.signal.aborted||presentation!==job||job.rewardCueIds.has(cue.id))return;
    job.rewardCueIds.add(cue.id);
    if(saved.sound&&typeof audio?.reward==='function')try{audio.reward(cue);}catch(_){}
    if(saved.preferences.haptics&&typeof navigator.vibrate==='function'&&cue.hapticMs>0)try{navigator.vibrate(Math.min(60,cue.hapticMs));}catch(_){}
  }
  function rewardMilestones(job,wave,kind){
    if(!canAnimate()||job.controller.signal.aborted||presentation!==job)return;
    for(const milestone of job.rewardPlan?.milestones||[]){
      if(milestone.kind!==kind||Math.min(2,milestone.wave)!==wave||job.rewardMilestoneIds.has(milestone.id))continue;
      job.rewardMilestoneIds.add(milestone.id);
      const node=kind==='score'?$('sum').closest('.hud-score'):document.querySelector('.coverage');if(!node)continue;
      node.classList.add('reward-goal-hit');job.rewardNodes.add(node);
      animateElement(job,node,[{filter:'brightness(1)',transform:'scale(1)'},{filter:'brightness(1.18)',transform:`scale(${milestone.percent===100?1.065:1.035})`,offset:.4},{filter:'brightness(1)',transform:'scale(1)'}],{duration:220,easing:'ease-out'});
    }
  }

  const canOpen=i=>i===0||saved.done.includes(i-1)||saved.done.includes(i);
  const isTutorial=()=>active<tutorialCount;
  const stageLabel=i=>i<tutorialCount?`ÖĞREN ${pad(i+1)}`:`BÖLÜM ${pad(i-tutorialCount+1)}`;
  const guideFeedback=()=>{
    if(busy||!isTutorial()||engine?.status!=='playing'||!engine.turn)return null;
    const step=activeLevel.steps[engine.turn-1],id=`${active}:${engine.turn}`;
    return step?.acknowledge&&!saved.guideAcks.includes(id)?{step,id}:null;
  };
  const guidedStep=()=>isTutorial()&&engine?.status==='playing'&&!guideFeedback()?activeLevel.steps[engine.turn]||null:null;
  const samePair=(a,b,p)=>p&&((a===p[0]&&b===p[1])||(a===p[1]&&b===p[0]));
  function selectionSeed(){
    if(saved.variantSelection.seed)return saved.variantSelection.seed;
    let seed=0;try{const value=new Uint32Array(1);window.crypto?.getRandomValues(value);seed=value[0];}catch(_){}
    saved.variantSelection.seed=(seed||Date.now()||0x9e3779b9)>>>0||0x9e3779b9;return saved.variantSelection.seed;
  }
  selectionSeed();
  let eventState=null;
  if(window.HexEvents)try{const old=readSave(eventKey);if(old){window.HexEvents.validateState(old);eventState=old;}else eventState=window.HexEvents.createState();}catch(_){eventState=window.HexEvents.createState();}
  const validCounter=value=>Number.isSafeInteger(value)&&value>=0?value:0;
  function tutorialMetadata(index,serial=0){
    const level=levels[index];return {attemptVersion:1,levelId:level.id,variantId:'fixed',levelDataVersion:'tutorials-v1',attemptId:serial?`t-${level.id}-${serial}`:`legacy-${level.id}`,attemptSerial:serial};
  }
  function restoredStage(index){
    const snapshot=saved.boards[index];if(!snapshot)return null;
    const base=levels[index];
    if(index>=tutorialCount&&variantCatalog)return variantCatalog.restore(base.id,snapshot,saved.attempts[index]);
    let metadata;
    if(index>=tutorialCount){
      metadata={attemptVersion:1,levelId:base.id,variantId:'legacy-original',levelDataVersion:'original-v1',attemptId:`legacy-${base.id}`,attemptSerial:0};
      const provided=saved.attempts[index];
      if(provided!=null&&Object.keys(metadata).some(field=>provided[field]!==metadata[field]))throw new Error('Saved variant identity cannot be verified');
    }else{
      const provided=saved.attempts[index],serial=validCounter(provided?.attemptSerial),expected=tutorialMetadata(index,serial);
      metadata=provided&&Object.keys(expected).every(field=>provided[field]===expected[field])?expected:tutorialMetadata(index);
    }
    return {metadata,level:base,game:new window.HexMatch(base,snapshot),snapshot,legacy:true};
  }
  function statsFor(index,entry,fresh=false){
    if(!entry?.metadata)return null;
    const previous=saved.attemptStats[index],same=!fresh&&previous?.attemptId===entry.metadata.attemptId,id=String(entry.level.id);
    saved.variantSelection.counts[id]=Math.max(1,validCounter(saved.variantSelection.counts[id]),same?validCounter(previous.attemptNumber):0);
    if(same){
      previous.attemptNumber=Math.max(1,validCounter(previous.attemptNumber));previous.started=previous.started===true||entry.game.turn>0;
      previous.terminalEvent=['level_completed','level_failed','level_abandoned'].includes(previous.terminalEvent)?previous.terminalEvent:null;
      previous.hintsUsed=validCounter(previous.hintsUsed);previous.cascades=validCounter(previous.cascades);return previous;
    }
    let cascades=0;const replay=new window.HexMatch(entry.level);
    for(const pair of entry.game.history){const result=replay.swap(...pair);if(result.ok)cascades+=Math.max(0,result.frames.length-1);}
    const stats={attemptId:entry.metadata.attemptId,attemptNumber:saved.variantSelection.counts[String(entry.level.id)]||1,started:!fresh&&entry.game.turn>0,terminalEvent:!fresh&&entry.game.status!=='playing'?(entry.game.status==='won'?'level_completed':'level_failed'):null,hintsUsed:0,cascades};
    saved.attemptStats[index]=stats;return stats;
  }
  function activeStats(){return activeAttempt?saved.attemptStats[active]:null;}
  function eventContext(entry={metadata:activeAttempt,level:activeLevel,game:engine,stats:activeStats()}){
    if(!entry.metadata||!entry.game||!entry.stats)return null;
    const game=entry.game;return {timestamp:Date.now(),levelId:entry.metadata.levelId,variantId:entry.metadata.variantId,levelDataVersion:entry.metadata.levelDataVersion,attemptId:entry.metadata.attemptId,attemptNumber:Math.max(1,validCounter(entry.stats.attemptNumber)),movesUsed:game.turn,movesRemaining:game.movesLeft,score:game.score,targetScore:entry.level.target,covered:game.covered,totalCells:game.total,remainingLayers:game.remainingLayers,cascades:validCounter(entry.stats.cascades),hintsUsed:validCounter(entry.stats.hintsUsed),status:game.status};
  }
  function emitEvent(name,details={},entry){
    if(!eventState)return;
    const context=eventContext(entry);if(!context)return;
    try{eventState=window.HexEvents.append(eventState,name,context,details);if(!sessionDepth)localStorage.setItem(eventKey,JSON.stringify(eventState));}catch(_){/* Local measurements never affect a game or a save. */}
  }
  // Game progress, lives and development receipts share one atomic host commit.
  // Life data never enters a HexMatch snapshot or its gameplay RNG.
  const livesKey='hexrota-lives-v1';
  let lifeFeature=null,lifeManager=null,lifeIssue=null,lifeWriteFailed=false,lifeVerificationProvider=null,pendingLifeStart=null,pendingLifeProvider=null,pendingLifeReceipt=null;
  let lifeLastPersistUtc=0,pendingResetLifeCost=null;
  const lifeClock=()=>Date.now();
  const lifeClone=value=>JSON.parse(JSON.stringify(value));
  let sessionDepth=0,sessionDirty=false,sessionRestoring=false,sessionEventBaseline=null,sessionGameBaseline=null;
  function on(target,type,callback,options){if(!target)return;if(['pointerdown','pointermove','pointercancel','lostpointercapture','touchstart','touchmove','wheel','gesturestart','gesturechange','gestureend'].includes(type)){target.addEventListener(type,callback,options);return;}target.addEventListener(type,function(...args){return sessionAction(()=>callback.apply(this,args));},options);}
  function sessionAction(callback){
    if(!sessionDepth){sessionEventBaseline=eventState?lifeClone(eventState):null;sessionGameBaseline=lifeClone(saved);}sessionDepth++;try{return callback();}finally{sessionDepth--;if(!sessionDepth&&sessionDirty)commitSession();}
  }
  function captureGame(){
    saved.current=active;
    if(engine&&!attemptPending&&!saveBlocked){saved.boards[active]=engine.snapshot();if(activeAttempt)saved.attempts[active]={...activeAttempt};}
  }
  function restoreDurable(){
    const durable=session?.current();if(!durable)return;
    saved=lifeClone(durable.revision===0?sessionGameBaseline:durable.game);lifeFeature=window.HexLifePrototype.validate(durable.energy,lifeManager);active=saved.current;
    try{const entry=restoredStage(active);if(entry){engine=entry.game;activeLevel=entry.level;activeAttempt=entry.metadata;attemptPending=false;saveBlocked=false;}else{activeLevel=levels[active];engine=new window.HexMatch(activeLevel);activeAttempt=null;attemptPending=true;saveBlocked=false;loadIssue=null;}}catch(_){saveBlocked=true;}
    sessionRestoring=true;try{cancelPresentation();cancelHint();selected=null;pendingStage=null;pendingRestart=null;pendingResetLifeCost=null;if(pendingLifeProvider&&!lifeFeature.provider.transactions[pendingLifeProvider]&&!pendingLifeReceipt){pendingLifeProvider=null;if($('life-provider-dialog')?.open)closeModal($('life-provider-dialog'));}if(attemptPending)showScreen('home',{replace:true});restoreRewards();renderLevels();render();renderLives();}catch(_){}finally{sessionRestoring=false;}
  }
  function commitSession(){
    sessionDirty=false;if(sessionRestoring||!lifeFeature)return true;
    try{captureGame();session.commit(saved,lifeFeature);if(eventState)try{localStorage.setItem(eventKey,JSON.stringify(eventState));}catch(_){}lifeWriteFailed=false;lifeLastPersistUtc=lifeFeature.life.lastSeenUtc;if(pendingLifeReceipt&&lifeFeature.testWallet.processedTransactions[pendingLifeReceipt.receipt.transactionId])pendingLifeReceipt=null;return true;}
    catch(_){eventState=sessionEventBaseline;restoreDurable();lifeWriteFailed=true;if(pendingLifeReceipt){pendingLifeProvider=pendingLifeReceipt.receipt.transactionId;$('life-provider-title').textContent='Ödülün kaydedilmeyi bekliyor';$('life-provider-description').textContent='Tamamlanan test işlemi kaydedilemedi. Yeniden denediğinde aynı ödül bir kez kaydedilecek.';openModal('life-provider-dialog');}toast('İşlem kaydedilemedi. Tahtan ve canların son güvenli kayda döndürüldü. Sayfayı yenileyip tekrar dene.');return false;}
  }
  function stageSession(){sessionDirty=true;return sessionDepth>0?true:commitSession();}
  function lifeReady(){return !!(lifeFeature&&lifeManager);}
  function lifeCommit(next,{quiet=false}={}){
    if(sessionRestoring)return false;
    const transactions=Object.values(next.provider.transactions).filter(item=>item.status==='cancelled'||item.status==='unavailable'||item.status==='completed'&&Object.prototype.hasOwnProperty.call(next.testWallet.processedTransactions,item.transactionId)).sort((a,b)=>(a.createdAtUtc||0)-(b.createdAtUtc||0));
    if(transactions.length>128&&window.HexLifeProviders.finalize){next=lifeClone(next);for(const item of transactions.slice(0,-128)){next.provider=window.HexLifeProviders.finalize(next.provider,item.transactionId);if(window.HexLifeProviders.isFinalized(next.provider,item.transactionId))delete next.testWallet.processedTransactions[item.transactionId];}}
    lifeFeature=next;return stageSession();
  }
  function lifeRefresh({persist=false}={}){
    if(!lifeReady())return null;
    try{
      const old=lifeFeature.life,next=lifeManager.reconcile(old);
      const changed=next.lives!==old.lives||next.regenAnchorUtc!==old.regenAnchorUtc||next.unlimitedUntilUtc!==old.unlimitedUntilUtc||next.adUsage.dayUtc!==old.adUsage.dayUtc;
      lifeFeature={...lifeFeature,life:next};
      if(changed||persist||next.lastSeenUtc-lifeLastPersistUtc>=60000)lifeCommit(lifeFeature,{quiet:!persist});
      return lifeManager.view(lifeFeature.life);
    }catch(_){lifeIssue='invalid';return null;}
  }
  function lifeStageIdentity(index){
    if(index===active&&activeAttempt)return activeAttempt;
    try{return restoredStage(index)?.metadata||null;}catch(_){return null;}
  }
  function lifeDiscarded(index=active){
    const identity=lifeStageIdentity(index);if(!identity)return false;
    if(lifeReady())return lifeManager.settlementFor(lifeFeature.life,identity.attemptId)?.discarded===true;
    const raw=readSave(livesKey);return raw?.life?.settledAttempts?.[identity.attemptId]?.discarded===true;
  }
  function lifeContext(entry,outcome){
    return {attemptId:entry.metadata.attemptId,levelId:entry.level.id,tutorial:entry.level.kind==='tutorial',movesUsed:entry.game.turn,outcome,confirmed:outcome==='restart'};
  }
  function lifeSettle(entry,outcome,{historical=false,maxCharge}={}){
    if(!entry?.metadata)return {applied:false,reason:'no_attempt',charged:false};
    if(!lifeReady())return {applied:false,reason:'unavailable',charged:false};
    try{
      const context=lifeContext(entry,outcome),result=historical?lifeManager.acknowledgeHistoricalAttempt(lifeFeature.life,context):lifeManager.settleAttempt(lifeFeature.life,context);
      if(maxCharge===0&&result.charged)return {applied:false,reason:'confirmation_changed',charged:false};
      if(!lifeCommit({...lifeFeature,life:result.state}))return {applied:false,reason:'storage',charged:false};
      renderLives();return result;
    }catch(_){lifeIssue='invalid';return {applied:false,reason:'invalid',charged:false};}
  }
  function settleActiveLife(){
    if(!engine||engine.status==='playing'||!activeAttempt||attemptPending||saveBlocked)return;
    lifeSettle({metadata:activeAttempt,level:activeLevel,game:engine},engine.status==='won'?'won':'failed');
  }
  function initializeLives(){
    if(!window.HexLives||!window.HEX_LIVES_CONFIG||!window.HexLifeProviders||!window.HexLifePrototype){lifeIssue='modules';return;}
    try{
      lifeManager=window.HexLives.createManager(window.HEX_LIVES_CONFIG,{clock:lifeClock,verifyReceipt:receipt=>window.HexLifeProviders.verify(lifeVerificationProvider||lifeFeature?.provider,receipt)});
      const previous=readSave(livesKey),existed=previous!==null||(()=>{try{return localStorage.getItem(livesKey)!==null;}catch(_){return false;}})();
      if(existed){lifeFeature=window.HexLifePrototype.validate(previous,lifeManager);}
      else{
        let random=0;try{const value=new Uint32Array(1);window.crypto?.getRandomValues(value);random=value[0];}catch(_){}
        lifeFeature=window.HexLifePrototype.createState(lifeManager.createState(),{providerNamespace:`dev-${lifeClock().toString(36)}-${random.toString(16)}`,gold:window.HEX_LIVES_CONFIG.development.initialTestGold,adAvailable:true});
        // Only existing pre-feature terminal boards are historical. Later interrupted
        // failure writes are recovered and charged once using their attempt IDs.
        for(let index=0;index<levels.length;index++)try{const entry=restoredStage(index);if(entry&&entry.game.status!=='playing')lifeFeature.life=lifeManager.acknowledgeHistoricalAttempt(lifeFeature.life,lifeContext(entry,entry.game.status==='won'?'won':'failed')).state;}catch(_){}
      }
      // An interrupted TEST provider window never completes an ad or purchase.
      for(const transaction of Object.values(lifeFeature.provider.transactions))if(transaction.status==='pending')transaction.status='cancelled';
      lifeCommit(lifeFeature,{quiet:true});
      if(existed)for(let index=0;index<levels.length;index++)try{const entry=restoredStage(index);if(entry&&entry.game.status!=='playing')lifeSettle(entry,entry.game.status==='won'?'won':'failed');}catch(_){}
    }catch(_){lifeFeature=null;lifeIssue='invalid';}
  }
  function lifeTime(ms){const seconds=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
  function renderLives(){
    const view=lifeReady()?lifeManager.view(lifeFeature.life):null;
    for(const button of document.querySelectorAll('[data-open-lives]')){
      const hearts=button.querySelector('[data-life-hearts]');
      if(hearts)hearts.innerHTML=Array.from({length:5},(_,i)=>`<svg class="icon life-heart${!view||i>=view.lives?' is-empty':''}" data-filled="${!!view&&i<view.lives}" aria-hidden="true"><use href="#i-heart"/></svg>`).join('');
      const summary=button.querySelector('[data-life-summary]'),timer=button.querySelector('[data-life-timer]');
      button.dataset.bypass=String(!!view?.developerBypass);button.dataset.unlimited=String(!!view?.unlimited);
      if(summary)summary.textContent=!view?'Can bilgisi yüklenemedi':view.developerBypass?'TEST · Can sınırı kapalı':view.unlimited?'Sınırsız can':`${view.lives} / ${view.maxLives} can`;
      if(timer)timer.textContent=view?.nextLifeAtUtc!==null&&view?.nextLifeAtUtc!==undefined?`Sonraki can ${lifeTime(view.remainingMs)}`:view?.unlimited?lifeTime(view.unlimitedRemainingMs):view?'Canlar dolu':'Yenileme bilgisi yok';
      button.setAttribute('aria-label',!view?'Can bilgisi yüklenemedi':`${view.lives} can${view.unlimited?', sınırsız can etkin':''}${view.nextLifeAtUtc!==null?', sonraki can '+lifeTime(view.remainingMs):''}`);
    }
    if($('lives-count'))$('lives-count').textContent=view?`${view.lives} / ${view.maxLives}`:'—';
    if($('lives-description'))$('lives-description').textContent=!view?'Can verisi açılamadı. Mevcut oyun kayıtların korundu. Sayfayı yenileyip tekrar dene.':lifeWriteFailed?'Can bilgisi kaydedilemedi. Yeni deneme ve test işlemleri durduruldu.':view.developerBypass?'Geliştirici testi: can sınırı ve can harcaması kapalı.':view.lives===0&&!view.unlimited?'Yeni bir bölüm için can gerekiyor. Bekleyebilir veya ücretsiz öğreticiyi oynayabilirsin.':'Yeni ana bölümler için canın olmalı. Kaybetmek veya oynanmış bir denemeyi sıfırlamak 1 can harcar.';
    if($('lives-next'))$('lives-next').textContent=view?.nextLifeAtUtc!==null&&view?.nextLifeAtUtc!==undefined?lifeTime(view.remainingMs):view?'Canlar dolu':'—';
    if($('lives-unlimited-note')){$('lives-unlimited-note').hidden=!view?.unlimited&&!view?.pendingAdLives;$('lives-unlimited-note').textContent=(view?.unlimited?`Sınırsız can: ${lifeTime(view.unlimitedRemainingMs)}. Normal canların da yenilenmeye devam eder. `:'')+(view?.pendingAdLives?`Bekleyen reklam ödülün: ${view.pendingAdLives} can. Canında yer açılınca otomatik eklenir.`:'');}
    if($('lives-gold'))$('lives-gold').textContent=lifeFeature?.testWallet.gold??'—';
    const products=[['lives-buy-one','single_life','lives-price-one'],['lives-buy-refill','refill_lives','lives-price-refill'],['lives-buy-unlimited','unlimited_lives_30m','lives-price-unlimited']];
    for(const [id,product,priceId]of products){const offer=view?lifeManager.transactionAvailability(lifeFeature.life,product):null;if($(id))$(id).disabled=!offer?.allowed||lifeWriteFailed||lifeFeature.testWallet.gold<offer.costGold;if($(priceId))$(priceId).textContent=offer?.costGold??window.HEX_LIVES_CONFIG?.products?.[product]?.costGold??'—'; }
    const adOffer=view?lifeManager.transactionAvailability(lifeFeature.life,'ad_life'):null;
    if($('lives-ad')){$('lives-ad').disabled=!adOffer?.allowed||!lifeFeature?.provider.adAvailable||lifeWriteFailed;const label=$('lives-ad').querySelector('span');if(label&&lifeManager)label.textContent=`Test reklamı: +${lifeManager.config.ads.rewardLives} can`;}
    const unlimitedLabel=$('lives-buy-unlimited')?.querySelector(':scope > span');if(unlimitedLabel&&lifeManager)unlimitedLabel.textContent=`${lifeManager.config.products.unlimited_lives_30m.durationMs/60000} dk sınırsız can`;
    if($('lives-ad-status'))$('lives-ad-status').textContent=!view?'Test sağlayıcısı yüklenemedi.':!lifeFeature.provider.adAvailable?'Şu anda test reklamı yok. Bekleyebilir veya Test Altını kullanabilirsin.':!adOffer.allowed?adOffer.reason==='already_full'?'Canların zaten dolu.':`Yeni test reklamı için ${lifeTime(adOffer.waitMs||0)} bekle. Bekleme ve Test Altını seçeneklerin de var.`:`TEST: +${lifeManager.config.ads.rewardLives} can. Bugün ${view.adClaimsToday} / ${lifeManager.config.ads.dailyLimit} reklam kullanıldı.`;
    if($('setting-lives-bypass')){$('setting-lives-bypass').checked=!!view?.developerBypass;$('setting-lives-bypass').disabled=!view||!lifeManager.config.development.allowBypass;}
    if($('setting-mock-ad')){$('setting-mock-ad').checked=!!lifeFeature?.provider.adAvailable;$('setting-mock-ad').disabled=!view;}
    if($('setting-test-gold'))$('setting-test-gold').disabled=!view||lifeWriteFailed;
    if($('lives-wait'))$('lives-wait').textContent=pendingLifeStart&&view?.canStart?'Bölüme başla':'Bekle';
  }
  function openLives(request=null){
    if(pendingLifeReceipt){openModal('life-provider-dialog');return;}
    lifeRefresh({persist:true});pendingLifeStart=request;renderLives();
    if($('lives-dialog'))openModal('lives-dialog');else toast('Can bilgisi şu anda açılamadı. Sayfayı yenileyip tekrar dene.');
  }
  function freshCampaignAvailable(index){
    if(index<tutorialCount)return true;
    if(!window.HexAttempts||!variantCatalog?.currentVersion)return false;
    try{const id=String(levels[index].id);variantCatalog.start(levels[index].id,{attemptSerial:saved.variantSelection.serial+1,selectionSeed:selectionSeed(),previousVariantId:saved.attempts[index]?.variantId,recentVariantIds:saved.variantSelection.recent[id]||[]});return true;}catch(_){return false;}
  }
  function resumeLifeRequest(){
    const request=pendingLifeStart;if(!request)return false;
    lifeRefresh({persist:true});if(!lifeReady()||lifeWriteFailed||!lifeManager.canStart(lifeFeature.life,{tutorial:request.index<tutorialCount}))return false;
    pendingLifeStart=null;return enterGame(request.index,{fresh:true,reason:request.reason});
  }
  function beginLifeProduct(productId){
    if(pendingLifeReceipt){openModal('life-provider-dialog');return;}
    if(pendingLifeProvider)return;
    lifeRefresh({persist:true});if(!lifeReady()||lifeWriteFailed){openLives();return;}
    if(productId!=='test_gold_300'){
      const offer=lifeManager.transactionAvailability(lifeFeature.life,productId);
      if(!offer.allowed){toast(offer.reason==='already_full'?'Canların zaten dolu.':'Bu test işlemi henüz kullanılamıyor. Bekleme seçeneklerini kontrol et.');renderLives();return;}
      if(offer.costGold>lifeFeature.testWallet.gold){toast('Test Altının yeterli değil. Bekleyebilir veya geliştirici ayarından Test Altını ekleyebilirsin.');return;}
    }
    const result=window.HexLifeProviders.begin(lifeFeature.provider,{productId,nowUtc:lifeManager.view(lifeFeature.life).effectiveNowUtc});
    if(!result.transactionId){toast('Şu anda test reklamı yok. Bekleyebilir veya Test Altını kullanabilirsin.');renderLives();return;}
    if(!lifeCommit({...lifeFeature,provider:result.state}))return;
    pendingLifeProvider=result.transactionId;
    const text={ad_life:['TEST reklamı',`Gerçek reklam gösterilmiyor. Test sonucunu onaylarsan +${lifeManager.config.ads.rewardLives} can alırsın.`],single_life:['TEST: 1 can',`${lifeManager.config.products.single_life.costGold} Test Altını kullanarak 1 can alacaksın. Gerçek para alınmaz.`],refill_lives:['TEST: Canları tamamla',`${lifeManager.config.products.refill_lives.costGold} Test Altını kullanarak canlarını ${lifeManager.config.maxLives}’e tamamlayacaksın. Gerçek para alınmaz.`],unlimited_lives_30m:['TEST: Sınırsız can',`${lifeManager.config.products.unlimited_lives_30m.costGold} Test Altını kullanarak ${lifeManager.config.products.unlimited_lives_30m.durationMs/60000} dakika sınırsız can alacaksın. Etkin süre varsa bu süre eklenir. Gerçek para alınmaz.`],test_gold_300:['Geliştirici testi','300 Test Altını eklenecek. Bu, gerçek para veya gerçek oyun ekonomisi değildir.']}[productId];
    if($('life-provider-title'))$('life-provider-title').textContent=text[0];if($('life-provider-description'))$('life-provider-description').textContent=text[1];
    if($('life-provider-dialog'))openModal('life-provider-dialog');
  }
  function applyLifeReceipt(receipt,provider=lifeFeature?.provider){
    if(!lifeReady()||lifeWriteFailed||window.HexLifeProviders.isFinalized?.(provider,receipt?.transactionId)||!window.HexLifeProviders.verify(provider,receipt))return {applied:false,reason:'unverified_receipt'};
    lifeRefresh({persist:true});if(lifeWriteFailed)return {applied:false,reason:'storage'};
    if(Object.prototype.hasOwnProperty.call(lifeFeature.testWallet.processedTransactions,receipt.transactionId))return {applied:false,reason:'duplicate_transaction'};
    const next=lifeClone(lifeFeature);next.provider=lifeClone(provider);let applied=false,reason='rejected',goldDelta=0;
    if(receipt.productId==='test_gold_300'){goldDelta=Math.min(300,2147483647-next.testWallet.gold);next.testWallet.gold+=goldDelta;applied=goldDelta>0;reason=applied?'test_gold_granted':'wallet_full';}
    else{
      const offer=lifeManager.transactionAvailability(next.life,receipt.productId);
      if(offer.costGold>next.testWallet.gold)reason='insufficient_gold';
      else{
        try{lifeVerificationProvider=provider;const result=lifeManager.applyTransaction(next.life,receipt);next.life=result.state;applied=result.applied;reason=result.reason;if(applied){goldDelta=-offer.costGold;next.testWallet.gold+=goldDelta;}}finally{lifeVerificationProvider=null;}
      }
    }
    next.testWallet.processedTransactions[receipt.transactionId]={productId:receipt.productId,goldDelta,atUtc:next.life.lastSeenUtc};
    if(!lifeCommit(next))return {applied:false,reason:'storage'};renderLives();return {applied,reason};
  }
  function finishLifeProvider(outcome='completed'){
    const id=pendingLifeProvider;if(!id||!lifeReady())return;
    if(pendingLifeReceipt)lifeWriteFailed=false;lifeRefresh({persist:true});const retryProvider=pendingLifeReceipt?lifeClone(lifeFeature.provider):null;if(retryProvider){retryProvider.nextSerial=Math.max(retryProvider.nextSerial,pendingLifeReceipt.provider.nextSerial);retryProvider.transactions[id]=lifeClone(pendingLifeReceipt.provider.transactions[id]);}
    const result=pendingLifeReceipt?{state:retryProvider,receipt:pendingLifeReceipt.receipt,reason:'completed'}:window.HexLifeProviders.complete(lifeFeature.provider,id,{outcome,nowUtc:lifeManager.view(lifeFeature.life).effectiveNowUtc});
    if(result.receipt)pendingLifeReceipt={provider:result.state,receipt:result.receipt};
    let applied={applied:false,reason:result.reason};
    if(result.receipt)applied=applyLifeReceipt(result.receipt,result.state);else lifeCommit({...lifeFeature,provider:result.state});
    pendingLifeProvider=null;if($('life-provider-dialog')?.open)closeModal($('life-provider-dialog'));
    renderLives();
    if(applied.applied){toast(result.receipt.productId==='test_gold_300'?'300 Test Altını eklendi.':applied.reason==='banked'?'Reklam ödülün saklandı. Canında yer açılınca eklenecek.':'Test işlemi doğrulandı. Canın güncellendi.');resumeLifeRequest();}
    else if(outcome==='completed')toast(applied.reason==='already_full'?'Canların zaten dolu. Altın veya reklam hakkı harcanmadı.':applied.reason==='insufficient_gold'?'Test Altının yeterli değil. İşlem uygulanmadı.':'Test işlemi tamamlanamadı. Bekleyebilir veya diğer seçenekleri kullanabilirsin.');
  }
  function cancelLifeProvider(){
    if(pendingLifeReceipt)return;
    if(!pendingLifeProvider||!lifeReady())return;const id=pendingLifeProvider;pendingLifeProvider=null;
    try{const result=window.HexLifeProviders.complete(lifeFeature.provider,id,{outcome:'cancelled',nowUtc:lifeManager.view(lifeFeature.life).effectiveNowUtc});lifeCommit({...lifeFeature,provider:result.state},{quiet:true});}catch(_){}
  }
  function discardCost(entries){
    if(!lifeReady())return null;let state=lifeManager.reconcile(lifeFeature.life),charged=0;
    for(const entry of entries)if(entry?.metadata&&entry.game.status==='playing'){const result=lifeManager.settleAttempt(state,lifeContext(entry,'restart'));state=result.state;if(result.charged)charged++;}return charged;
  }
  function updateRestartLifeCopy(index){
    const entry=stageEntry(index),cost=discardCost([entry]);
    if(pendingRestart?.index===index)pendingRestart.lifeCost=cost;
    if($('restart-description'))$('restart-description').textContent=lifeReady()&&entry?.game.status==='playing'&&entry.game.turn>0&&lifeManager.view(lifeFeature.life).lives===0&&!lifeManager.view(lifeFeature.life).unlimited&&!lifeManager.view(lifeFeature.life).developerBypass?'Bu deneme kapanacak. Canın olmadığı için can harcanmaz. Yeni deneme için can gerekir.':cost?`Bu bölümdeki ilerlemen sıfırlanacak ve ${cost} can harcanacak.${lifeManager.view(lifeFeature.life).lives===1?' Son canını kullanıyorsun. Yeni tahta açmak için sonra beklemen veya can alman gerekecek.':' Yeni bir tahta açılacak.'}`:'Bu bölümdeki ilerlemen sıfırlanacak. Yeni bir tahta açılacak. Bu işlem can harcamaz.';
  }
  function bindLivesUI(){
    for(const button of document.querySelectorAll('[data-open-lives]'))on(button,'click',()=>openLives());
    on($('lives-ad'),'click',()=>beginLifeProduct('ad_life'));
    on($('lives-buy-one'),'click',()=>beginLifeProduct('single_life'));
    on($('lives-buy-refill'),'click',()=>beginLifeProduct('refill_lives'));
    on($('lives-buy-unlimited'),'click',()=>beginLifeProduct('unlimited_lives_30m'));
    on($('setting-test-gold'),'click',()=>beginLifeProduct('test_gold_300'));
    on($('life-provider-confirm'),'click',()=>finishLifeProvider('completed'));
    on($('life-provider-dialog'),'close',cancelLifeProvider);
    on($('lives-wait'),'click',()=>{const request=pendingLifeStart;pendingLifeStart=null;if(request){lifeRefresh({persist:true});if(lifeReady()&&!lifeWriteFailed&&lifeManager.canStart(lifeFeature.life,{tutorial:request.index<tutorialCount}))enterGame(request.index,{fresh:true,reason:request.reason});}});
    on($('lives-teach'),'click',()=>{pendingLifeStart=null;enterGame(0,{fresh:true,reason:'free_tutorial'});});
    on($('setting-lives-bypass'),'change',event=>{if(!lifeReady())return;const result=lifeManager.setDeveloperBypass(lifeFeature.life,event.target.checked);lifeCommit({...lifeFeature,life:result.state});renderLives();});
    on($('setting-mock-ad'),'change',event=>{if(!lifeReady())return;lifeCommit({...lifeFeature,provider:window.HexLifeProviders.setAdAvailable(lifeFeature.provider,event.target.checked)});renderLives();});
    const tick=()=>{lifeRefresh();renderLives();};
    window.setInterval(()=>sessionAction(tick),1000);on(window,'focus',()=>{lifeRefresh({persist:true});renderLives();});
    on(document,'visibilitychange',()=>{if(!document.hidden){lifeRefresh({persist:true});renderLives();}});
    on(window,'pagehide',()=>lifeRefresh({persist:true}));
    window.HexLifeTestAdapter=Object.freeze({applyReceipt:receipt=>sessionAction(()=>applyLifeReceipt(receipt))});
  }
  function persist() {
    if(sessionRestoring)return false;
    captureGame();
    // A terminal snapshot and its once-only life result share the same write.
    if(lifeReady()&&engine&&activeAttempt&&!attemptPending&&!saveBlocked&&engine.status!=='playing'){
      const result=lifeManager.settleAttempt(lifeFeature.life,lifeContext({metadata:activeAttempt,level:activeLevel,game:engine},engine.status==='won'?'won':'failed'));
      lifeFeature={...lifeFeature,life:result.state};
    }
    return stageSession();
  }
  function startEvent(reason){
    const stats=activeStats();if(!stats||stats.started||engine.status!=='playing')return;
    stats.started=true;persist();emitEvent('level_started',{reason});
  }
  function terminalEvent(){
    const stats=activeStats();if(!stats||!stats.started||stats.terminalEvent||engine.status==='playing')return;
    const name=engine.status==='won'?'level_completed':'level_failed';stats.terminalEvent=name;persist();emitEvent(name);
  }
  function stageEntry(index){
    if(index===active&&!attemptPending&&!saveBlocked)return {metadata:activeAttempt,level:activeLevel,game:engine,stats:activeStats()};
    try{const restored=restoredStage(index);if(restored)return {...restored,stats:statsFor(index,restored)};}catch(_){}
    return null;
  }
  function discardStage(index,reason,entry=stageEntry(index)){
    if(!entry?.metadata)return null;
    if(entry.game.status==='playing'&&entry.stats?.started&&!entry.stats.terminalEvent){entry.stats.terminalEvent='level_abandoned';emitEvent('level_abandoned',{reason},entry);}
    return entry.metadata;
  }
  function toast(message) {
    $('toast').textContent=message; $('toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3300);
  }
  function stopPointer() {
    const old=pointer;pointer=null;
    if(old)try{if($('board').hasPointerCapture?.(old.id))$('board').releasePointerCapture(old.id);}catch(_){}
  }
  // Keep the game canvas tied to the visible viewport without rebuilding its state.
  const appViewport=window.visualViewport;
  let appHeight=0;
  function syncAppHeight(){
    if(Math.abs((Number(appViewport?.scale)||1)-1)>.02)return;
    const height=Math.round(Number(appViewport?.height)||window.innerHeight);
    if(Number.isFinite(height)&&height>0&&height!==appHeight){appHeight=height;document.documentElement.style.setProperty('--app-height',height+'px');}
  }
  ['resize','orientationchange','pageshow'].forEach(name=>on(window,name,syncAppHeight,{passive:true}));
  on(document,'fullscreenchange',syncAppHeight);
  const settleViewport=()=>{if(presentation)finishPresentation(presentation);};
  on(window,'resize',settleViewport,{passive:true});on(window,'orientationchange',settleViewport,{passive:true});
  appViewport?.addEventListener?.('resize',settleViewport,{passive:true});
  appViewport?.addEventListener?.('resize',syncAppHeight,{passive:true});
  syncAppHeight();
  function preventZoom(event){if(event.cancelable)event.preventDefault();}
  function preventPinch(event){preventZoom(event);stopPointer();}
  ['gesturestart','gesturechange','gestureend'].forEach(name=>on(document,name,preventPinch,{passive:false}));
  ['touchstart','touchmove'].forEach(name=>on(document,name,event=>{if(event.touches?.length>1)preventPinch(event);},{passive:false}));
  on(document,'wheel',event=>{if(event.ctrlKey||event.metaKey)preventZoom(event);},{passive:false});
  on(document,'dblclick',preventZoom);
  on(window,'keydown',event=>{if((event.ctrlKey||event.metaKey)&&['+','-','=','0'].includes(event.key))preventZoom(event);});
  function topDialog(){return [...modalStack].reverse().map(id=>$(id)).find(dialog=>dialog.open)||[...document.querySelectorAll('dialog[open]')].at(-1)||null;}
  const gameInputAllowed=()=>!lifeWriteFailed&&!attemptPending&&!saveBlocked&&screen==='game'&&!paused&&!topDialog()&&!lifeDiscarded();
  function syncAudio(){document.body.classList.toggle('reduce-motion',reduceMotion());audio?.configure({sfx:saved.sound,music:saved.preferences.music,volume:saved.preferences.volume});audio?.setActive(!document.hidden&&!paused);}
  function unlockAudio(){syncAudio();audio?.unlock().catch(()=>{});}
  function openModal(id){
    stopPointer();cancelHint();
    if(presentation)finishPresentation(presentation);
    clearTimeout(terminalTimer);
    const dialog=$(id);if(!dialog.open){dialog.showModal();modalStack.push(id);}
    document.body.classList.add('modal-open');
  }
  on(document,'hexrota:open-dialog',event=>{
    if(event.detail?.id!=='install-dialog')return;
    event.preventDefault();openModal('install-dialog');
  });
  function closeModal(dialog){if(dialog?.open)dialog.close();}
  function closeAllDialogs(){[...document.querySelectorAll('dialog[open]')].reverse().forEach(closeModal);}
  document.querySelectorAll('dialog').forEach(dialog=>{
    on(dialog,'close',()=>{
      const index=modalStack.lastIndexOf(dialog.id);if(index>=0)modalStack.splice(index,1);
      if(dialog.id==='pause-dialog'){paused=false;syncAudio();}
      if(dialog.id==='pregame-dialog')pendingStage=null;
      if(dialog.id==='restart-dialog')pendingRestart=null;
      if(!topDialog())document.body.classList.remove('modal-open');
    });
    on(dialog,'click',e=>{
      if(e.target!==dialog)return;
      const r=dialog.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal(dialog);
    });
    dialog.querySelectorAll('[data-close]').forEach(b=>on(b,'click',()=>closeModal(dialog)));
  });
  function tone(value=2,victory=false){if(victory)audio?.victory();else audio?.move(value);}
  function renderSound(){
    $('sound').innerHTML=icon(saved.sound?'sound':'muted');
    $('sound').setAttribute('aria-pressed',String(saved.sound));
    $('sound').setAttribute('aria-label',saved.sound?'Sesi kapat':'Sesi aç');
    $('sound').title=saved.sound?'Sesi kapat':'Sesi aç';
    if($('setting-sfx'))$('setting-sfx').checked=saved.sound;
  }
  function recordWin(index,game,played=false){
    if(game.status!=='won')return;
    const previous=saved.records[index];
    saved.records[index]={score:Math.max(previous?.score||0,game.score),movesLeft:Math.max(previous?.movesLeft||0,game.movesLeft),plays:(previous?.plays||0)+(played?1:0)};
  }
  function hydrateRecords(){
    for(let i=0;i<levels.length;i++)if(saved.boards[i])try{recordWin(i,restoredStage(i).game);}catch(_){}
  }
  function validCheckpoint(index){
    try{return restoredStage(index)?.game||null;}catch(_){return null;}
  }
  function nextStage(){
    const current=validCheckpoint(saved.current);
    if(current?.status==='playing'&&current.turn>0&&canOpen(saved.current)&&!lifeDiscarded(saved.current))return {index:saved.current,resume:true};
    const next=levels.findIndex((_,i)=>!saved.done.includes(i)&&canOpen(i));
    return next>=0?{index:next,resume:false}:null;
  }
  function updateMenus(){
    if(!$('home-play'))return;
    const next=nextStage(),completed=saved.done.filter(i=>i>=tutorialCount).length;
    $('home-play-label').textContent=next?(next.resume?'Devam et':next.index===0?'Birlikte başlayalım':'Oyna'):'Yeniden keşfet';
    $('home-play-detail').textContent=next?next.resume?`${stageLabel(next.index)} · ${validCheckpoint(next.index).movesLeft} hamle kaldı`:next.index===0?'Aynı sayıları eşleştir, puan kazan.':`${stageLabel(next.index)} · ${levels[next.index].name}`:'Bütün bölümler tamamlandı';
    $('home-stage-name').textContent=next?levels[next.index].name:'On iki durak, tamamı yeşil.';
    $('home-progress-text').textContent=`${completed} / ${campaignCount} bölüm tamamlandı`;
    $('home-progress-fill').style.width=`${completed/campaignCount*100}%`;
    $('journey-summary').textContent=`2 öğretici · ${completed} / ${campaignCount} bölüm tamamlandı`;
    $('journey-map').innerHTML=levels.map((level,index)=>{
      const done=saved.done.includes(index),locked=!canOpen(index),current=next?.index===index;
      return `<button class="map-node${done?' done':''}${locked?' locked':''}${current?' current':''}${index<tutorialCount?' tutorial-node':''}" data-stage="${index}" ${locked?'disabled':''} aria-label="${stageLabel(index)}: ${level.name}${done?', tamamlandı':''}${locked?', kilitli':''}"><span class="map-number">${index<tutorialCount?'T'+(index+1):pad(index-tutorialCount+1)}</span><span class="map-name">${level.name}</span></button>`;
    }).join('');
    const records=Object.entries(saved.records).filter(([index])=>+index>=tutorialCount);
    $('record-completed').textContent=`${completed} / ${campaignCount}`;
    $('record-score').textContent=records.length?Math.max(...records.map(([,r])=>r.score)).toLocaleString('tr-TR'):'—';
    $('record-bestmoves').textContent=records.length?Math.max(...records.map(([,r])=>r.movesLeft)):'—';
    $('records-list').innerHTML=levels.slice(tutorialCount).map((level,offset)=>{
      const index=offset+tutorialCount,record=saved.records[index];
      return `<tr><th scope="row"><span class="record-stage">${pad(offset+1)}</span> ${level.name}${saved.done.includes(index)?'<span class="record-complete" aria-label="Tamamlandı">✓</span>':''}</th><td>${record?record.score.toLocaleString('tr-TR'):'—'}</td><td>${record?record.movesLeft:'—'}</td></tr>`;
    }).join('');
    const achievements=[['İlk eşleşme','İlk öğreticiyi tamamla.',!!saved.records[0]],['İki hedef, bir plan','İkinci öğreticiyi tamamla.',!!saved.records[1]],['Yolun yarısı','Beş ana bölümü tamamla.',completed>=5],['Yeşil yolculuk','On ana bölümü tamamla.',completed===campaignCount]];
    $('achievement-list').innerHTML=achievements.map(([name,text,earned])=>`<div class="achievement${earned?' earned':''}"><span class="achievement-mark" aria-hidden="true">${earned?'✓':'◇'}</span><div><strong>${name}</strong><p>${text}</p></div><span class="achievement-state">${earned?'Tamamlandı':'Sırada'}</span></div>`).join('');
  }
  function showScreen(next,{replace=false,historyChange=true}={}){
    const previousScreen=screen;
    if(!['home','journey','game','records'].includes(next))next='home';
    if(presentation)finishPresentation(presentation);
    if(next!=='game')clearScoreReceipt();
    cancelPresentation();cancelHint();stopPointer();clearTimeout(terminalTimer);epoch++;
    if(engine)persist();closeAllDialogs();paused=false;screen=next;
    for(const name of ['home','journey','game','records']){const node=$(name+'-screen');node.hidden=name!==screen;node.inert=name!==screen;}
    document.body.dataset.screen=screen;
    document.querySelectorAll('[data-nav]').forEach(button=>{const active=button.dataset.nav===screen;button.classList.toggle('is-active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    updateMenus();syncAudio();renderLives();
    if(historyChange&&(replace||previousScreen!==screen))try{history[replace?'replaceState':'pushState']({screen},'','#'+screen);}catch(_){}
    document.documentElement.scrollTop=0;document.body.scrollTop=0;
  }
  function enterGame(index,{fresh=false,reason='stage_entry',lifeCostQuote}={}){
    lifeRefresh({persist:true});
    if(index>=tutorialCount&&lifeDiscarded(index))fresh=true;
    const savedGame=validCheckpoint(index),newAttempt=fresh||!savedGame||savedGame.status!=='playing';
    if(index>=tutorialCount&&newAttempt&&savedGame&&savedGame.status!=='playing'&&lifeReady()){
      const terminal=stageEntry(index),recovery=lifeSettle(terminal,savedGame.status==='won'?'won':'failed');
      if(['storage','invalid','unavailable','ledger_full'].includes(recovery.reason)){openLives({index,reason});return false;}
    }
    if(index>=tutorialCount&&newAttempt){
      if(!lifeReady()||lifeWriteFailed||!lifeManager.canStart(lifeFeature.life,{tutorial:false})){openLives({index,reason});return false;}
      if(!freshCampaignAvailable(index)){toast('Yeni tahtalar yüklenemedi. Mevcut denemen korundu.');return false;}
    }
    const previousEntry=fresh?stageEntry(index):null;
    if(index>=tutorialCount&&fresh&&previousEntry?.game.status==='playing'){
      const settlement=lifeSettle(previousEntry,'restart',{maxCharge:lifeCostQuote});
      if(settlement.reason==='confirmation_changed'){pendingRestart={index,reason};updateRestartLifeCopy(index);openModal('restart-dialog');toast('Can koşulları değişti. Yeni bilgiyi kontrol edip tekrar onayla.');return false;}
      if(['storage','invalid','unavailable','ledger_full'].includes(settlement.reason)){openLives({index,reason});return false;}
      if(!lifeManager.canStart(lifeFeature.life,{tutorial:false})){
        discardStage(index,reason,previousEntry);persist();showScreen('home');openLives({index,reason});return false;
      }
    }
    closeAllDialogs();paused=false;
    if(!loadLevel(index,fresh,{activate:true})){showScreen('home');toast(loadIssue==='data'?'Yeni tahtalar yüklenemedi. Sayfayı yenileyip tekrar dene.':'Kaydın açılamadı ve korundu. İstersen yeni bir deneme başlatabilirsin.');return false;}
    const previous=previousEntry?discardStage(index,reason,previousEntry):null;
    showScreen('game');startEvent(reason);
    if(previous&&activeAttempt&&previous.attemptId!==activeAttempt.attemptId)emitEvent('level_retried',{reason,previousAttemptId:previous.attemptId});
    unlockAudio();return true;
  }
  function requestStage(index){
    if(!Number.isInteger(index)||index<0||index>=levels.length||!canOpen(index))return;
    const level=levels[index],checkpoint=validCheckpoint(index),resume=checkpoint?.status==='playing'&&checkpoint.turn>0&&!lifeDiscarded(index),blocked=!!saved.boards[index]&&!checkpoint;
    pendingStage=index;
    $('pregame-dialog').dataset.learning=index===0?'first':index<tutorialCount?'goals':'';
    if($('pregame-lesson'))$('pregame-lesson').hidden=index!==0;
    $('pregame-dialog').querySelector('.pregame-goals').hidden=index===0;
    $('pregame-tag').textContent=stageLabel(index);$('pregame-title').textContent=level.name;
    $('pregame-description').textContent=blocked?'Bu kayıt açılamadı ve korundu. Yeni deneme başlatırsan bu bölümdeki ilerlemen sıfırlanır.':resume?'Kaldığın yerden devam et.':index===0?'Parlayan 2 ile 1’in yerini değiştir.':`${level.target} puana ulaş ve her yeri yeşile boya. ${level.moves} hamlen var.`;
    if($('pregame-note'))$('pregame-note').textContent=index===0?'Kaydırmak yerine iki taşa sırayla da dokunabilirsin.':'Bölümü bitirmek için puanın yeterli olmalı ve her yer yeşil olmalı.';
    $('pregame-target').textContent=level.target;$('pregame-ground').textContent=resume?`${checkpoint.covered} / ${level.cells.length}`:level.cells.length;
    $('pregame-moves').textContent=resume?checkpoint.movesLeft:level.moves;
    $('pregame-start').textContent=blocked?'Yeni deneme başlat':resume?'Devam et':'Başla';$('pregame-restart').hidden=!resume;
    openModal('pregame-dialog');
  }
  function pauseGame(){
    if(screen!=='game'||paused||topDialog())return;
    if(presentation)finishPresentation(presentation);
    if(engine.status!=='playing'){showResult();return;}
    cancelHint();persist();paused=true;syncAudio();openModal('pause-dialog');
  }
  function openSettings(){
    if(presentation)finishPresentation(presentation);cancelHint();
    $('setting-sfx').checked=saved.sound;$('setting-music').checked=saved.preferences.music;
    $('setting-motion').value=saved.preferences.motion;$('setting-volume').value=Math.round(saved.preferences.volume*100);$('volume-value').textContent=`%${Math.round(saved.preferences.volume*100)}`;
    const hapticsAvailable=typeof navigator.vibrate==='function';$('setting-haptics').checked=saved.preferences.haptics;$('setting-haptics').disabled=!hapticsAvailable;
    $('haptics-note').textContent=hapticsAvailable?'Eşleşmelerde kısa dokunma geri bildirimi.':'Bu tarayıcı titreşimi desteklemiyor.';
    openModal('settings-dialog');
  }
  function renderLevels() {
    $('levels').innerHTML=levels.map((l,i)=>{
      const done=saved.done.includes(i),current=i===active,locked=!canOpen(i),learning=i<tutorialCount,number=learning?`T${i+1}`:pad(i-tutorialCount+1);
      return `<button class="level-button${learning?' tutorial-node':''}${current?' active':''}${done?' done':''}" data-level="${i}" ${locked?'disabled':''} ${current?'aria-current="step"':''} aria-label="${learning?'Öğren':`Bölüm ${i-tutorialCount+1}`}: ${l.name}${done?', tamamlandı':''}${locked?', kilitli':''}" title="${l.name}${locked?' — Önceki bölümü tamamla':''}"><span class="level-number">${number}</span><span class="level-copy">${l.name}</span>${locked?'<svg class="icon level-status-icon"><use href="#i-lock"/></svg>':''}</button>`;
    }).join('');
    const completed=saved.done.filter(i=>i>=tutorialCount).length;
    $('completed').textContent=`${completed} / ${campaignCount}`;
    $('journey-fill').style.width=`${completed/campaignCount*100}%`;
  }
  function markCompleted(played=false) {
    recordWin(active,engine,played);
    if(engine.status==='won'&&!saved.done.includes(active)){
      saved.done.push(active);saved.done.sort((a,b)=>a-b);
    }
  }
  function loadLevel(index,fresh=false,{activate=false}={}) {
    clearScoreReceipt();
    cancelPresentation();cancelHint();epoch++;clearTimeout(terminalTimer);stopPointer();busy=false;
    active=canOpen(index)?index:0;activeLevel=levels[active];activeAttempt=null;attemptPending=true;saveBlocked=false;loadIssue=null;
    if(fresh)saved.guideAcks=saved.guideAcks.filter(id=>!id.startsWith(`${active}:`));
    let restored=null;
    if(!fresh&&saved.boards[active])try{restored=restoredStage(active);}catch(_){saveBlocked=true;loadIssue='save';}
    if(restored){engine=restored.game;activeLevel=restored.level;activeAttempt=restored.metadata;attemptPending=false;saved.variantSelection.serial=Math.max(saved.variantSelection.serial,validCounter(activeAttempt?.attemptSerial));statsFor(active,restored);}
    else if(activate&&!saveBlocked){
      const id=String(activeLevel.id),selection=saved.variantSelection;
      if(active>=tutorialCount){
        if(!window.HexAttempts||!variantCatalog?.currentVersion){saveBlocked=true;loadIssue='data';}
        else{
        const previous=saved.attempts[active]?.variantId,recent=selection.recent[id]||[];
        try{
          const attempt=variantCatalog.start(activeLevel.id,{attemptSerial:selection.serial+1,selectionSeed:selectionSeed(),previousVariantId:previous,recentVariantIds:recent});
          activeLevel=attempt.level;activeAttempt=attempt.metadata;selection.seed=attempt.selectionSeed;selection.serial=activeAttempt.attemptSerial;selection.recent[id]=[...recent,activeAttempt.variantId].slice(-16);
        }catch(_){saveBlocked=true;loadIssue='data';}
        }
      }else if(active<tutorialCount){selection.serial++;activeAttempt=tutorialMetadata(active,selection.serial);}
      if(!saveBlocked){
        selection.counts[id]=(selection.counts[id]||0)+1;engine=new window.HexMatch(activeLevel);attemptPending=false;
        statsFor(active,{metadata:activeAttempt,level:activeLevel,game:engine},true);
      }
    }
    if(!engine||attemptPending||saveBlocked)engine=new window.HexMatch(activeLevel);
    selected=null;hinted=null;focusIndex=0;comboText='';restoreRewards();
    $('level-tag').textContent=stageLabel(active);$('level-name').textContent=activeLevel.name;
    const category=activeLevel.difficulty?.id||activeLevel.difficulty?.category||activeLevel.difficulty?.label;
    $('difficulty').textContent=isTutorial()?'Öğretici':activeAttempt?.variantId==='legacy-original'?'Kayıtlı bölüm':difficultyLabels[category]||activeLevel.difficulty?.label||'Bölüm';
    $('target').textContent=activeLevel.target;$('level-note').textContent=activeLevel.subtitle;
    if(isTutorial())focusIndex=activeLevel.steps[engine.turn]?.pair[0]||0;
    if(lifeReady()&&active>=tutorialCount&&activeAttempt&&!attemptPending&&!saveBlocked){const registration=lifeManager.registerAttempt(lifeFeature.life,{attemptId:activeAttempt.attemptId,levelId:activeLevel.id,tutorial:activeLevel.kind==='tutorial',resume:!!restored});lifeFeature={...lifeFeature,life:registration.state};}
    markCompleted();renderLevels();render();persist();return !saveBlocked;
  }
  function geometry() {
    if(geometryCache.has(active))return geometryCache.get(active);
    const step=44,radius=40;
    let positions=activeLevel.cells.map(c=>({x:1.5*step*c.q,y:Math.sqrt(3)*step*(c.r+c.q/2)}));
    const xs=positions.map(p=>p.x),ys=positions.map(p=>p.y);
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    positions=positions.map(p=>({x:p.x-cx,y:p.y-cy}));
    const width=Math.max(isTutorial()?275:370,Math.max(...xs)-Math.min(...xs)+radius*2+24);
    const height=Math.max(isTutorial()?260:300,Math.max(...ys)-Math.min(...ys)+radius*Math.sqrt(3)+26);
    const data={positions,radius,width,height};geometryCache.set(active,data);return data;
  }
  function boardMarkup(state,matching=[],falling=[]) {
    const {positions,radius,width,height}=geometry();
    $('board').setAttribute('viewBox',`${-width/2} ${-height/2} ${width} ${height}`);
    const poly=r=>Array.from({length:6},(_,i)=>`${(r*Math.cos(i*Math.PI/3)).toFixed(3)},${(r*Math.sin(i*Math.PI/3)).toFixed(3)}`).join(' ');
    const outer=poly(radius),inner=poly(radius*.78),matched=new Set(matching),dropped=new Set(falling);
    const highlightRadius=radius*.78-1.2,highlightHeight=highlightRadius*Math.sqrt(3)/2;
    const highlight=`M${(-.8*highlightRadius).toFixed(3)} ${(-.4*highlightHeight).toFixed(3)} L${(-.5*highlightRadius).toFixed(3)} ${(-highlightHeight).toFixed(3)} L${(.5*highlightRadius).toFixed(3)} ${(-highlightHeight).toFixed(3)} L${(.8*highlightRadius).toFixed(3)} ${(-.4*highlightHeight).toFixed(3)}`;
    const interactive=!busy&&!guideFeedback()&&engine.status==='playing',guided=guidedStep(),pair=!busy&&guided?guided.pair:[],support=pair.length?guided.matchIndices.filter(i=>!pair.includes(i)):[];
    let gesture='';
    if(pair.length){
      const source=positions[pair[0]],target=positions[pair[1]],dx=target.x-source.x,dy=target.y-source.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length,ox=-uy*17,oy=ux*17;
      gesture=`<g class="tutorial-gesture" pointer-events="none" aria-hidden="true"><path class="tutorial-guide-line" d="M${source.x+ox+ux*17} ${source.y+oy+uy*17} L${target.x+ox-ux*17} ${target.y+oy-uy*17}" marker-end="url(#tutorial-arrow)"/><g transform="translate(${source.x+12},${source.y+15})"><g class="tutorial-guide-hand" style="--guide-dx:${dx}px;--guide-dy:${dy}px"><path d="M0 0 V-7 C0-10 5-10 5-7 V0 L7-3 C9-5 12-3 11-1 L12-2 C15-3 17-1 16 1 C19 0 21 3 19 6 L16 13 C15 15 13 16 10 16 H7 C5 16 4 15 3 13 L-4 6 C-6 3-3 0-1 2 L2 5"/></g></g></g>`;
    }
    return `<defs><filter id="tile-shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1" flood-color="#3d5031" flood-opacity=".06"/></filter><marker id="tutorial-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L6 3.5 L0 7 Z"/></marker></defs>${activeLevel.cells.map((c,i)=>{
      const left=state.layers[i],green=left===0,partial=left>0&&left<(c.layers||1);
      const classes=['hex-tile',`value-${state.values[i]}`,green?'floor-green':partial?'floor-partial':'floor-untouched',c.layers===2?'layered':'',selected===i?'selected':'',hinted?.includes(i)?'hinted':'',selected!==null&&engine.adjacent(selected,i)?'neighbor':'',matched.has(i)?'matching':'',dropped.has(i)?'falling':'',pair.includes(i)?'tutorial-focus':'',support.includes(i)?'tutorial-support':'',pair[0]===i?'tutorial-source':'',pair[1]===i?'tutorial-target':'',pair.length&&!pair.includes(i)&&!support.includes(i)?'tutorial-muted':''].filter(Boolean).join(' ');
      const p=positions[i],ground=green?'altı yeşil':`${left} eşleşme gerekiyor`;
      const pips=c.layers===2&&!green?`<g class="layer-pips" aria-hidden="true">${Array.from({length:left},(_,dot)=>`<circle class="layer-pip" cx="${left===2?(dot?4:-4):0}" cy="31" r="2.5"/>`).join('')}</g>`:'';
      return `<g transform="translate(${p.x},${p.y})" class="${classes}" data-index="${i}" role="button" tabindex="${i===focusIndex?0:-1}" aria-label="${state.values[i]} sayısı, ${ground}${selected===i?', seçili':''}${hinted?.includes(i)?', ipucu':''}" aria-pressed="${selected===i}" aria-disabled="${!interactive||(pair.length&&!pair.includes(i))}"><polygon class="floor-shape" points="${outer}"/><g class="gem"><polygon class="gem-back" points="${inner}" transform="translate(0 3.5)"/><polygon class="gem-shape" points="${inner}"/><path class="gem-highlight" d="${highlight}"/><text class="hex-number" text-anchor="middle" x="0" y="0">${state.values[i]}</text></g>${green?'<path class="floor-mark" d="m-4 29 3 3 6-7"/>':pips}</g>`;
    }).join('')}${gesture}<g class="fx-layer" aria-hidden="true"></g>`;
  }
  function render(state=null,options={}) {
    const display=state||{values:engine.values,layers:engine.layers,score:engine.score,movesLeft:engine.movesLeft};
    const focused=document.activeElement?.closest?.('[data-index]')?.dataset.index;
    $('board').innerHTML=boardMarkup(display,options.matching||[],options.falling||[]);
    if(focused!==undefined)$('board').querySelector(`[data-index="${focused}"]`)?.focus?.({preventScroll:true});
    const covered=display.layers.filter(n=>n===0).length,total=activeLevel.cells.length;
    renderScore(presentation?.scoreDisplay??display.score);
    $('moves-left').textContent=display.movesLeft;
    $('moves-left').closest('.moves-badge')?.classList.toggle('low',display.movesLeft<=3);
    $('move-counter').textContent=`${activeLevel.moves-display.movesLeft} / ${activeLevel.moves} HAMLE`;
    $('coverage').textContent=`${covered} / ${total}`;
    $('coverage-ring').style.strokeDashoffset=String(87.965*(1-covered/total));
    $('hint').disabled=busy||!!hintJob||!!guideFeedback()||engine.status!=='playing';
    $('hint').querySelector('span').textContent=hintJob?'Aranıyor…':'İpucu';
    $('reset').disabled=false;
    $('skip-animation').hidden=!busy;
    $('continue').hidden=busy||engine.status==='playing';
    $('continue').textContent=engine.status==='lost'?'Yeniden dene →':'Devam et →';
    $('board').setAttribute('aria-busy',String(busy));
    $('board').setAttribute('aria-disabled',String(busy||!!guideFeedback()||engine.status!=='playing'));
    $('board-stage').classList.toggle('busy',busy);
    $('last-combo').textContent=comboText;
    const status=$('board-status');status.className='board-status';
    let text;
    if(options.message)text=options.message;
    else if(engine.status==='won') {text='Puanın yeterli, her yer yeşil. Bölümü bitirdin!';status.classList.add('success');}
    else if(engine.status==='lost'){text='Hamlelerin bitti. Yeniden deneyebilirsin.';status.classList.add('error');}
    else if(guideFeedback())text='Yukarıdaki “Devam et” düğmesine dokun.';
    else if(selected!==null)text='Şimdi yanındaki diğer taşa dokun.';
    else if(display.score>=activeLevel.target)text=`Puanın yeterli! Yeşile boyanacak ${total-covered} yer kaldı.`;
    else text='Yan yana iki taşın yerini değiştir.';
    $('status-text').textContent=text;
    if($('ground-goal-check')){$('ground-goal-check').hidden=covered<total;$('ground-goal-check').setAttribute('aria-label',covered===total?'Her yer yeşil':'Henüz her yer yeşil değil');}
    if($('ground-label'))$('ground-label').textContent=active===0&&engine.turn===0?'Taşların altı yeşil olur':'Yeşil alan';
    if($('game-goal-title'))$('game-goal-title').textContent=active===0?'Aynı sayıları eşleştir':'Puanı topla, alanı boya';
    renderCoach();
  }
  function renderCoach(){
    const coach=$('tutorial-coach'),tutorial=isTutorial(),feedback=guideFeedback();coach.hidden=!tutorial||(engine.status!=='playing'&&!busy);
    document.body.dataset.learning=active===0?'first':tutorial?'goals':'';
    document.body.dataset.hasLayers=String(activeLevel.cells.some(cell=>cell.layers===2));
    document.body.dataset.guideFeedback=String(!!feedback);
    document.body.dataset.guideStep=tutorial?String(busy?Math.max(0,engine.turn-1):engine.turn):'';
    if($('coach-next')){$('coach-next').hidden=!feedback;$('coach-next').disabled=!feedback;}
    if(!tutorial)return;
    const steps=activeLevel.steps,index=Math.min(engine.turn,steps.length-1),step=steps[index],previous=steps[Math.max(0,engine.turn-1)],showFeedback=busy||!!feedback;
    $('coach-step').textContent=feedback?'BU HAMLEDE':`${busy?'İZLE · ':''}ADIM ${busy?Math.max(1,engine.turn):Math.min(engine.turn+1,steps.length)} / ${steps.length}`;
    $('coach-title').textContent=showFeedback?(previous.afterTitle||'İşte böyle!'):(step?.title||activeLevel.title||activeLevel.name);
    const partner=selected!==null&&step?.pair.includes(selected)?step.pair.find(i=>i!==selected):null;
    const destination=partner!==null?engine.values[partner]:null;
    $('coach-text').textContent=showFeedback?(previous.afterText||'Yeni taşlar geliyor. Yeşil alanlar yerinde kalıyor.'):partner!==null?`Şimdi parlayan ${destination} yazan taşa dokun.`:step?.text||'Hazırsın!';
    if($('guide-explanation')){$('guide-explanation').hidden=active!==0||engine.turn>0||busy;$('guide-explanation').textContent='Aynı sayıdan 3 taşı eşleştir. Üç tane 2, toplam 6 puan kazandırır.';}
    $('coach-progress').style.width=`${engine.turn/steps.length*100}%`;
  }
  function renderScore(value){
    $('sum').textContent=value;
    $('score-progress').style.width=`${Math.min(1,value/activeLevel.target)*100}%`;
    $('score-goal-label').textContent=active===0?'PUANIN':value>=activeLevel.target?'HEDEF TAMAM':'HEDEF PUAN';
    if($('score-goal-check')){$('score-goal-check').hidden=value<activeLevel.target;$('score-goal-check').setAttribute('aria-label',value>=activeLevel.target?'Puan hedefi tamam':'Puan hedefi sürüyor');}
  }
  function scoreEquation(frame){
    const values=frame.matched.map(index=>frame.before[index]);
    const counts=new Map();for(const value of values)counts.set(value,(counts.get(value)||0)+1);
    const terms=values.length<=5?values.join(' + '):[...counts].map(([value,count])=>count===1?String(value):`${count} × ${value}`).join(' + ');
    return `${terms} = ${frame.scoreGain}`;
  }
  function clearScoreReceipt(){
    const receipt=$('score-receipt');if(receipt)receipt.textContent='';
    $('sum')?.closest('.hud-score')?.classList.remove('score-arrival');
  }
  function countScore(job,target){
    const from=job.scoreDisplay;
    if(job.controller.signal.aborted||presentation!==job)return Promise.resolve();
    if(typeof requestAnimationFrame!=='function'){job.scoreDisplay=target;renderScore(target);return Promise.resolve();}
    return new Promise(resolve=>{
      const start=performance.now();let frame;
      const done=()=>{cancelAnimationFrame(frame);job.controller.signal.removeEventListener('abort',done);resolve();};
      const step=now=>{
        if(job.controller.signal.aborted||presentation!==job){done();return;}
        const progress=Math.min(1,(now-start)/motion.count),value=Math.round(from+(target-from)*(1-Math.pow(1-progress,3)));
        job.scoreDisplay=value;renderScore(value);
        if(progress<1)frame=requestAnimationFrame(step);else done();
      };
      job.controller.signal.addEventListener('abort',done,{once:true});frame=requestAnimationFrame(step);
    });
  }
  async function flyScore(job,frame,{wave,gain,destination,extra=0,totalWaves=1}){
    const signal=job.controller.signal,nodes=new Set();
    const remove=()=>{for(const node of nodes)node.remove();};
    const current=()=>!signal.aborted&&presentation===job&&canAnimate();
    try{
      if(!current())return;
      let layer=$('score-effects');
      if(!layer){layer=document.createElement('div');layer.id='score-effects';layer.setAttribute('aria-hidden','true');document.body.appendChild(layer);}
      const positions=geometry().positions,view=geometry(),board=$('board'),rect=board.getBoundingClientRect();
      const center=frame.matched.reduce((p,index)=>({x:p.x+positions[index].x/frame.matched.length,y:p.y+positions[index].y/frame.matched.length}),{x:0,y:0});
      let matrix;try{matrix=board.getScreenCTM();}catch(_){}
      const onScreen=position=>{
        try{const point=board.createSVGPoint();point.x=position.x;point.y=position.y;const mapped=point.matrixTransform(matrix);if(Number.isFinite(mapped.x)&&Number.isFinite(mapped.y))return mapped;}catch(_){}
        const scale=Math.min(rect.width/view.width,rect.height/view.height);
        return {x:rect.left+rect.width/2+position.x*scale,y:rect.top+rect.height/2+position.y*scale};
      };
      const origin=onScreen(center),viewportWidth=window.innerWidth||390,viewportHeight=Number(appViewport?.height)||window.innerHeight||700;
      const target=$('sum').getBoundingClientRect(),hud=$('sum').closest('.hud-score'),hudRect=hud?.getBoundingClientRect();
      const end={x:target.width?target.left+target.width/2:64,y:target.height?target.top+target.height/2:64};
      const add=(className,point)=>{
        const node=document.createElement('div');node.className=className;node.style.left=point.x+'px';node.style.top=point.y+'px';node.style.translate='-50% -50%';nodes.add(node);layer.appendChild(node);return node;
      };
      const packet=add('score-packet',origin);packet.style.zIndex='2';packet.dataset.gain=String(gain);packet.dataset.wave=String(wave);packet.dataset.destinationScore=String(destination);packet.dataset.phase='collect';
      const waveCue=rewardForWave(job,wave),headline=rewardHeadline(job,wave);
      const cue=headline&&(!waveCue||headline.tier>waveCue.tier)?headline:waveCue;
      if(cue){packet.dataset.rewardTier=String(cue.tier);packet.dataset.rewardReason=cue.reason;packet.dataset.rewardWave=String(cue.wave);}
      if(headline)packet.dataset.rewardHeadline=headline.reason;
      const chain=document.createElement('span');chain.className='score-packet-chain';chain.textContent=headline?rewardLabel(headline):wave===1?'':extra?`${wave}–${totalWaves}. ZİNCİR`:`${wave}. ZİNCİR`;
      const amount=document.createElement('strong');amount.className='score-packet-gain';amount.textContent=`+${gain}`;packet.append(chain,amount);
      const packetRect=packet.getBoundingClientRect(),peakScale=Math.max(1,(cue?.scalePermille||1300)/1000)*1.08,halfWidth=(packetRect.width||120)*peakScale/2,halfHeight=(packetRect.height||70)*peakScale/2;
      const maxY=Math.max(halfHeight+12,viewportHeight-halfHeight-12),minY=Math.min(maxY,viewportWidth>viewportHeight?halfHeight+12:(hudRect?.bottom||80)+halfHeight+8);
      const start={x:Math.max(halfWidth+12,Math.min(viewportWidth-halfWidth-12,origin.x)),y:Math.max(minY,Math.min(maxY,origin.y))};
      packet.style.left=start.x+'px';packet.style.top=start.y+'px';amount.textContent='';amount.style.opacity='0';
      signal.addEventListener('abort',remove,{once:true});
      const sources=frame.matched.map(index=>({index,value:frame.before[index],point:onScreen(positions[index])}));
      if(extra)sources.push({index:null,value:extra,point:{x:start.x+35,y:Math.min(viewportHeight-24,start.y+42)}});
      const batches=new Map();
      for(const [order,source]of sources.entries()){
        const delay=sources.length>1?Math.round(order/(sources.length-1)*6)*(motion.spread/6):0,at=motion.digit+delay;
        const digit=add('score-digit'+(source.index===null?' score-digit-extra':''),source.point);digit.style.zIndex='3';digit.dataset.value=String(source.value);
        if(source.index===null){digit.dataset.source='chains';digit.textContent=`+${source.value}`;}
        else{digit.dataset.index=String(source.index);digit.textContent=String(source.value);const original=board.querySelector(`[data-index="${source.index}"] .hex-number`);if(original)original.style.opacity='0';}
        const dx=start.x-source.point.x,dy=start.y-source.point.y;
        animateElement(job,digit,[{transform:'translate(0px,0px) scale(1)',opacity:1},{transform:`translate(${dx*.25}px,${dy*.25-12}px) scale(1.2)`,opacity:1,offset:.3},{transform:`translate(${dx}px,${dy}px) scale(.5)`,opacity:0}],{duration:motion.digit,delay,easing:'cubic-bezier(.35,.02,.68,1)',fill:'both'});
        if(!batches.has(at))batches.set(at,[]);batches.get(at).push({value:source.value,digit});
      }
      let elapsed=0,collected=0;
      for(const [at,batch]of batches){
        await pause(at-elapsed,job);if(!current())return;elapsed=at;
        for(const source of batch){collected+=source.value;source.digit.remove();}
        amount.style.opacity='1';amount.textContent=`+${collected}`;packet.dataset.collected=String(collected);
        animateElement(job,amount,[{transform:'scale(.8)'},{transform:'scale(1.08)',offset:.45},{transform:'scale(1)'}],{duration:motion.collectPulse,easing:'ease-out'});
      }
      amount.textContent=`+${gain}`;packet.dataset.phase='pop';
      animateElement(job,packet,[{transform:'scale(.75)',opacity:1},{transform:`scale(${(cue?.scalePermille||1300)/1000})`,opacity:1,offset:.42},{transform:'scale(1)',opacity:1}],{duration:motion.pop,easing:'cubic-bezier(.2,.9,.35,1)',fill:'forwards'});
      rewardFeedback(job,cue);
      for(let n=0;n<(cue?.rings||1);n++){
        const ring=add('score-burst-ring',start);
        animateElement(job,ring,[{transform:`scale(${.3+n*.15})`,opacity:.95},{transform:`scale(${1.65+n*.4})`,opacity:0}],{duration:motion.pop+motion.hold,easing:'ease-out',fill:'forwards'});
      }
      const sparkCount=cue?.sparks??10;
      for(let i=0;i<sparkCount;i++){
        const spark=add('score-burst-spark',start),angle=i*Math.PI*2/sparkCount,distance=42+(i%3)*12+(cue?.tier||0)*4;
        animateElement(job,spark,[{transform:'translate(0px,0px) scale(1)',opacity:1},{transform:`translate(${Math.cos(angle)*distance}px,${Math.sin(angle)*distance}px) scale(.15) rotate(100deg)`,opacity:0}],{duration:motion.pop+motion.hold,easing:'ease-out',fill:'forwards'});
      }
      await pause(motion.pop+motion.hold,job);if(!current())return;
      packet.dataset.phase='fly';chain.style.opacity='0';const dx=end.x-start.x,dy=end.y-start.y;
      animateElement(job,packet,[{transform:'translate(0px,0px) scale(1)',opacity:1},{transform:`translate(${dx*.38-14}px,${dy*.6-16}px) scale(.8)`,opacity:1,offset:.6},{transform:`translate(${dx}px,${dy}px) scale(.18)`,opacity:0}],{duration:motion.flight,easing:'cubic-bezier(.3,.1,.5,1)',fill:'forwards'});
      await pause(motion.flight,job);if(!current())return;
      packet.dataset.phase='arrived';packet.dataset.arrived='true';hud?.classList.add('score-arrival');rewardMilestones(job,wave,'score');
      const receipt=$('score-receipt');if(receipt)receipt.textContent=`+${gain}`;
      animateElement(job,hud,[{transform:'scale(1)'},{transform:'scale(1.065)',offset:.4},{transform:'scale(1)'}],{duration:motion.arrival,easing:'ease-out'});
      await countScore(job,destination);
    }finally{signal.removeEventListener('abort',remove);remove();}
  }
  const canAnimate=()=>!document.hidden&&!reduceMotion()&&typeof window.Element.prototype.animate==='function';
  function cancelPresentation() {
    const job=presentation;presentation=null;busy=false;
    if(job){clearTimeout(job.watchdog);job.controller.abort();for(const a of job.animations)try{a.cancel?.();}catch(_){}for(const node of job.rewardNodes||[])node.classList.remove('reward-goal-hit');clearScoreReceipt();}
  }
  function finishPresentation(job) {
    if(!job||presentation!==job||job.token!==epoch)return;
    cancelPresentation();
    const result=job.result;
    comboText=`+${result.scoreGain} puan${result.frames.length>1?` · ${result.frames.length} zincir`:''}`;
    const deferred=job.rewardPlan?.headline;if(deferred&&!deferred.completion&&!job.rewardHeadlineUsed){comboText=rewardLabel(deferred)+' · '+comboText;job.rewardHeadlineUsed=true;}
    if(result.reshuffled)comboText+=' · Karıştırıldı';
    try{renderLevels();render();persist();}
    catch(_){persist();}
    finally{
      busy=false;$('board').setAttribute('aria-busy','false');$('board-stage').classList.remove('busy');$('reset').disabled=false;$('skip-animation').hidden=true;
    }
    const receipt=$('score-receipt');if(receipt)receipt.textContent=`+${result.scoreGain}`;
    if(result.reshuffled)toast('Eşleşme kalmadı; sayılar karıştırıldı. Zemin ve hamlelerin korundu.');
    if(screen==='game'&&!paused&&engine.status!=='playing'&&!document.hidden){
      terminalTimer=setTimeout(()=>{if(job.token===epoch&&screen==='game'&&!paused&&!document.hidden&&!topDialog())showResult();},80);
    }
  }
  function pause(ms,job) {
    if(job.controller.signal.aborted)return Promise.resolve();
    return new Promise(resolve=>{
      const done=()=>{clearTimeout(timer);job.controller.signal.removeEventListener('abort',done);resolve();};
      const timer=setTimeout(done,ms);job.controller.signal.addEventListener('abort',done,{once:true});
    });
  }
  function animateElement(job,node,frames,options){
    if(!node)return null;
    const animation=node.animate(frames,options);job.animations.push(animation);return animation;
  }
  function svgNode(name,attributes){const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,String(value));return node;}
  function matchEffects(job,frame){
    const layer=$('board').querySelector('.fx-layer'),positions=geometry().positions;
    if(!layer)return;
    let particles=0;
    const inks=['#b5a4da','#e9c37f','#dfaa95','#8bb8d5','#cfabc6'];
    for(const [order,index]of frame.matched.entries()){
      const p=positions[index],gem=$('board').querySelector(`[data-index="${index}"] .gem`);
      animateElement(job,gem,[{transform:'scale(1)',opacity:1},{transform:'scale(1.12)',opacity:1,offset:.25},{transform:'scale(.45)',opacity:0}],{duration:motion.burst,easing:'cubic-bezier(.3,.1,.4,1)',fill:'forwards'});
      if(order<12){const ring=svgNode('circle',{class:'fx-ring',cx:p.x,cy:p.y,r:15});layer.appendChild(ring);animateElement(job,ring,[{r:'15px',opacity:.8},{r:'49px',opacity:0}],{duration:motion.ring,easing:'ease-out',fill:'forwards'});}
      for(let k=0;k<5&&particles<48;k++,particles++){
        const angle=(k*72+order*31)*Math.PI/180,distance=27+(k%3)*10;
        const dot=svgNode(k%2?'circle':'rect',k%2?{class:'fx-particle',cx:p.x,cy:p.y,r:2.5}:{class:'fx-particle',x:p.x-2,y:p.y-2,width:4,height:4,rx:1});
        dot.style.fill=inks[(frame.before[index]-1)%inks.length];layer.appendChild(dot);
        animateElement(job,dot,[{transform:'translate(0px,0px) scale(1)',opacity:1},{transform:`translate(${Math.cos(angle)*distance}px,${Math.sin(angle)*distance-8}px) scale(.35)`,opacity:0}],{duration:motion.particle,easing:'ease-out',fill:'forwards'});
      }
    }
    const centroid=frame.matched.reduce((p,i)=>({x:p.x+positions[i].x/frame.matched.length,y:p.y+positions[i].y/frame.matched.length}),{x:0,y:0});
    const label=svgNode('text',{class:'fx-score',x:centroid.x,y:centroid.y-15,'text-anchor':'middle'});label.textContent=scoreEquation(frame);label.style.display='none';layer.appendChild(label);
  }
  function fallingGems(job,frame){
    const positions=geometry().positions,cells=activeLevel.cells,minQ=Math.min(...cells.map(c=>c.q));let longest=0;
    for(const fall of frame.falls||[]){
      const destination=positions[fall.to],cell=cells[fall.to];
      let origin;
      if(fall.spawn){const column=cells.map((c,i)=>({c,i})).filter(x=>x.c.q===cell.q).sort((a,b)=>a.c.r-b.c.r);origin={x:destination.x,y:positions[column[0].i].y-Math.sqrt(3)*44*(fall.spawnCount-fall.spawnOrder)};}
      else origin=positions[fall.from];
      const dx=origin.x-destination.x,dy=origin.y-destination.y,delay=Math.min(motion.fallStagger,(cell.q-minQ)*motion.columnDelay),duration=motion.fall;
      const node=$('board').querySelector(`[data-index="${fall.to}"] .gem`);
      animateElement(job,node,[{transform:`translate(${dx}px,${dy}px)`,opacity:fall.spawn?0:1},{transform:'translate(0px,2.5px)',opacity:1,offset:.82},{transform:'translate(0px,-1px)',opacity:1,offset:.94},{transform:'translate(0px,0px)',opacity:1}],{duration,delay,easing:'cubic-bezier(.22,.72,.28,1)',fill:'both'});
      longest=Math.max(longest,duration+delay);
    }
    return longest;
  }
  async function presentSwap(job,a,b,before){
    if(!canAnimate())return;
    render(before,{message:'Taşlar yer değiştiriyor…'});
    const pos=geometry().positions,dx=pos[b].x-pos[a].x,dy=pos[b].y-pos[a].y;
    for(const [index,x,y]of[[a,dx,dy],[b,-dx,-dy]])animateElement(job,$('board').querySelector(`[data-index="${index}"] .gem`),[{transform:'translate(0px,0px)'},{transform:`translate(${x}px,${y}px)`}],{duration:motion.swap,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});
    await pause(motion.swap+5,job);
    const frames=job.result.frames;
    // Resolve every wave in the engine; animate the first two so long chains
    // never delay input indefinitely. The final authoritative state follows.
    for(let i=0;i<Math.min(2,frames.length);i++){
      if(job.controller.signal.aborted||presentation!==job||!canAnimate())return;
      const f=frames[i],prior=i?frames[i-1]:null,score=before.score+frames.slice(0,i).reduce((n,frame)=>n+frame.scoreGain,0);
      const extra=i===1?frames.slice(2).reduce((sum,frame)=>sum+frame.scoreGain,0):0,gain=f.scoreGain+extra;
      comboText=`${i?`${i+1}. zincir · `:''}${scoreEquation(f)} puan${extra?` · Devamı +${extra}`:''}`;
      render({values:f.before,layers:prior?prior.layers:before.layers,score,movesLeft:engine.movesLeft},{message:i?'Yeni taşlar da eşleşti!':'Taşlar eşleşti. Puanlar toplanıyor.'});
      const task=flyScore(job,f,{wave:i+1,gain,destination:score+gain,extra,totalWaves:frames.length}).catch(()=>{});job.scoreTasks.push(task);
      matchEffects(job,f);if(!job.rewardPlan||typeof audio?.reward!=='function')tone(Math.min(5,i+1));await pause(motion.matchPause,job);
      if(job.controller.signal.aborted||presentation!==job)return;
      render({values:f.after,layers:f.layers,score:score+f.scoreGain,movesLeft:engine.movesLeft},{falling:f.falls.map(x=>x.to),message:'Yeni taşlar geliyor. Yeşil alanlar yerinde kalıyor.'});
      rewardMilestones(job,i+1,'ground');
      const duration=fallingGems(job,f);await Promise.all([pause(duration+10,job),task]);
    }
    await Promise.all(job.scoreTasks);
  }
  function invalidSwap(a,b){
    if(!canAnimate())return;
    try{const positions=geometry().positions;for(const [from,to]of[[a,b],[b,a]]){const dx=(positions[to].x-positions[from].x)*.25,dy=(positions[to].y-positions[from].y)*.25;$('board').querySelector(`[data-index="${from}"] .gem`)?.animate([{transform:'translate(0px,0px)'},{transform:`translate(${dx}px,${dy}px)`,offset:.4},{transform:'translate(0px,0px)'}],{duration:motion.invalid,easing:'ease-out'});}}catch(_){}
  }
  async function performSwap(a,b) {
    if(!gameInputAllowed()||guideFeedback())return;
    if(busy){finishPresentation(presentation);return;}
    if(engine.status!=='playing')return;
    const guide=guidedStep();
    if(guide&&!samePair(a,b,guide.pair)){selected=null;hinted=guide.pair;render();toast('Bu adımda parlayan iki taşı değiştir. Hamlen harcanmadı.');return;}
    clearScoreReceipt();cancelHint();
    const checkpoint=engine.snapshot(),before={values:engine.values.slice(),layers:engine.layers.slice(),score:engine.score,movesLeft:engine.movesLeft};
    let result;
    try{result=engine.swap(a,b);}catch(_){
      try{engine=new window.HexMatch(activeLevel,checkpoint);}catch(_){engine=new window.HexMatch(activeLevel);}
      selected=null;render();toast('Bu hamle tamamlanamadı. Tahta geri yüklendi; tekrar deneyebilirsin.');return;
    }
    if(!result.ok){
      selected=null;hinted=null;render();
      invalidSwap(a,b);
      toast(engine.adjacent(a,b)?'Üçlü oluşmadı. Hamlen duruyor.':'Sadece komşu iki taşı değiştirebilirsin.');
      return;
    }
    const stats=activeStats();if(stats)stats.cascades=validCounter(stats.cascades)+Math.max(0,result.frames.length-1);
    const rewardPlan=planRewards(checkpoint,result);
    const job={token:++epoch,result,controller:new AbortController(),animations:[],watchdog:null,scoreDisplay:before.score,scoreTasks:[],rewardPlan,rewardCueIds:new Set(),rewardMilestoneIds:new Set(),rewardNodes:new Set(),rewardHeadlineUsed:false};
    presentation=job;busy=true;selected=null;hinted=null;comboText='';
    try{
      markCompleted(true);persist();settleActiveLife();terminalEvent();renderLevels();
      if(!rewardPlan&&saved.preferences.haptics&&typeof navigator.vibrate==='function')try{navigator.vibrate(12);}catch(_){}
      if(rewardPlan&&!canAnimate()&&!rewardPlan.headline?.completion){
        const cue=rewardPlan.headline||rewardPlan.waves.reduce((best,next)=>!best||next.tier>best.tier?next:best,null);rewardFeedback(job,cue);
      }
      job.watchdog=setTimeout(()=>finishPresentation(job),motion.budget);
      await presentSwap(job,a,b,before);
    }catch(_){/* Presentation failure must never lock committed game state. */}
    finally{finishPresentation(job);}
  }
  function select(index) {
    if(!gameInputAllowed()||guideFeedback())return;
    if(busy){finishPresentation(presentation);return;}
    if(engine.status!=='playing')return;
    const guide=guidedStep();
    if(guide&&!guide.pair.includes(index)){hinted=guide.pair;render();toast('Önce parlayan iki altıgeni dene.');return;}
    focusIndex=index;hinted=null;
    if(selected===index){selected=null;render();return;}
    if(selected!==null&&engine.adjacent(selected,index)) {const a=selected;performSwap(a,index);return;}
    selected=index;render();
  }
  function showVictory(){
    const final=active===levels.length-1,learning=isTutorial();
    $('win-eyebrow').textContent=final?'YOLCULUK TAMAMLANDI':`${stageLabel(active)} TAMAMLANDI`;
    $('win-title').textContent=learning?(active===0?'İlk adım tamam!':'Artık hazırsın!'):final?'Usta işi!':'Harika eşleşme!';
    if(completionReward&&!learning)$('win-title').textContent=rewardLabel(completionReward);
    $('win-description').textContent=learning?(active===0?'İlk bölüm tamam. Şimdi puan hedefine de ulaşmayı deneyelim.':'Yeterli puan topladın ve her yeri yeşile boyadın. Şimdi kendi başına oyna.'):final?'10 bölümün hepsini bitirdin!':`${engine.movesLeft} hamlen kaldı. Bölümü bitirdin!`;
    $('win-total').textContent=engine.score;$('win-moves').textContent=engine.movesLeft;
    const nextText=final?'Yolculuğun başına dön':active===0?'İkinci öğreticiye geç':active===1?'İlk bölüme başla':`Bölüm ${pad(active-tutorialCount+2)} ile devam et`;
    $('next').innerHTML=`${nextText} ${icon('arrow')}`;
    $('confetti').innerHTML=reduceMotion()?'':Array.from({length:completionReward?12+completionReward.tier*4:18},(_,i)=>`<i class="confetti-piece" style="left:${i*37%100}%;background:${['#9bbe73','#c4e89b','#b8a5cf','#dbdfb9'][i%4]};--drift:${(i%2?1:-1)*(20+i*2)}px;animation-delay:${i%7*.06}s"></i>`).join('');
    if(completionReward&&!completionRewardPlayed){
      completionRewardPlayed=true;
      if(saved.sound){if(typeof audio?.reward==='function')try{audio.reward(completionReward);}catch(_){}else tone(0,true);}
      if(saved.preferences.haptics&&typeof navigator.vibrate==='function'&&completionReward.hapticMs>0)try{navigator.vibrate(Math.min(60,completionReward.hapticMs));}catch(_){}
    }else if(!completionReward)tone(0,true);
    openModal('win-dialog');
  }
  function showLoss() {
    $('lose-title').textContent='Bir plan daha?';
    $('lose-description').textContent='Hamlelerin bitti. Altı yeşil olmayan taşları eşleştirmeyi dene.';
    $('lose-score').textContent=`${engine.score} / ${activeLevel.target}`;
    $('lose-coverage').textContent=`${engine.covered} / ${activeLevel.cells.length}`;
    openModal('lose-dialog');
  }
  function showResult() {if(engine.status==='won')showVictory();else if(engine.status==='lost')showLoss();}
  function restart(index=active) {
    if(!Number.isInteger(index))index=active;
    const checkpoint=index===active&&!attemptPending&&!saveBlocked?engine:validCheckpoint(index);
    const reason=checkpoint?.status==='lost'?'retry':'restart';
    if(index>=tutorialCount&&variantCatalog&&checkpoint?.status==='playing'){
      pendingRestart={index,reason};updateRestartLifeCopy(index);openModal('restart-dialog');return;
    }
    if(index>=tutorialCount&&saved.boards[index]&&!checkpoint&&variantCatalog){pendingRestart={index,reason};updateRestartLifeCopy(index);openModal('restart-dialog');return;}
    if(enterGame(index,{fresh:true,reason}))toast(index<tutorialCount?'Öğretici baştan başladı.':'Yeni bir tahta hazır. Tekrar dene.');
  }
  function hintEvent(suggestion,kind='heuristic'){
    return sessionAction(()=>{const stats=activeStats();if(!stats)return;
    stats.hintsUsed=validCounter(stats.hintsUsed)+1;persist();
    const source=suggestion?.source||suggestion?.kind||kind,guarantee=source==='proven_route'?'certified_route':source==='search_win'?'bounded_search':source==='guided'?'guided':'none';
    emitEvent('hint_used',{hintKind:source,hintGuarantee:guarantee});});
  }
  function cancelHint(){const job=hintJob;hintJob=null;if(job){clearTimeout(job.timer);job.worker?.terminate();job.resolve?.(null);}}
  async function hint(){
    if(!gameInputAllowed()||guideFeedback()||busy||hintJob||engine.status!=='playing')return;
    const guide=guidedStep();if(guide){selected=null;hinted=guide.pair;hintEvent({kind:'guided',guarantee:'guided'},'guided');render();toast(guide.text);return;}
    const job={token:epoch,game:engine,worker:null,timer:null,resolve:null};hintJob=job;render();
    let suggestion=null;
    try{
      if(typeof window.Worker==='function'){
        suggestion=await new Promise(resolve=>{
          job.resolve=resolve;
          try{
            job.worker=new Worker('./hint-worker.js?v=20');
            job.worker.onmessage=e=>resolve(e.data?.hint||null);
            job.worker.onerror=e=>{e.preventDefault?.();resolve(null);};
            job.worker.postMessage({level:activeLevel,snapshot:engine.snapshot()});
            job.timer=setTimeout(()=>resolve(null),600);
          }catch(_){resolve(null);}
        });
      }
      if(hintJob!==job||job.token!==epoch||job.game!==engine)return;
      if(!suggestion)suggestion=engine.hint({maxMs:12,maxDepth:1});
      if(suggestion?.pair){selected=null;hinted=suggestion.pair;hintEvent(suggestion);toast(suggestion.source==='heuristic'?'Parlayan iki taşın yerini değiştir. Bu bir öneri; kazanma garantisi yok.':'Parlayan iki taşın yerini değiştir.');}
      else toast('Şu anda ipucu bulunamadı. Başka bir üçlü arayabilirsin.');
    }catch(_){toast('İpucu şu anda hazır değil. Oynamaya devam edebilirsin.');}
    finally{if(hintJob===job){cancelHint();render();}}
  }
  on($('levels'),'click',e=>{
    const b=e.target.closest('[data-level]');if(!b||b.disabled||+b.dataset.level===active)return;
    requestStage(+b.dataset.level);
  });
  function tileAt(e){
    const node=document.elementFromPoint?.(e.clientX,e.clientY)||e.target;
    const tile=node?.closest?.('[data-index]');
    if(tile&&$('board').contains(tile))return +tile.dataset.index;
    try{
      const board=$('board'),matrix=board.getScreenCTM?.();if(!matrix)return null;
      const point=board.createSVGPoint();point.x=e.clientX;point.y=e.clientY;
      const local=point.matrixTransform(matrix.inverse());let closest=null,distance=45;
      geometry().positions.forEach((p,i)=>{const d=Math.hypot(p.x-local.x,p.y-local.y);if(d<distance){distance=d;closest=i;}});
      return closest;
    }catch(_){return null;}
  }
  on($('board'),'pointerdown',e=>{
    if(!gameInputAllowed()||guideFeedback()||e.isPrimary===false||(e.button!==0&&e.pointerType!=='touch'))return;
    if(busy){e.preventDefault();finishPresentation(presentation);return;}
    if(engine.status!=='playing'||pointer)return;
    const tile=e.target.closest('[data-index]');if(!tile)return;
    e.preventDefault();pointer={id:e.pointerId,index:+tile.dataset.index,x:e.clientX,y:e.clientY};
    try{$('board').setPointerCapture?.(e.pointerId);}catch(_){}
  });
  on(window,'pointermove',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    if(e.pointerType!=='touch'&&e.buttons===0)stopPointer();
    // No selection mutation here: jitter over the same tile remains a tap.
  });
  on(window,'pointerup',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    const start=pointer,target=tileAt(e);stopPointer();
    if(target===null)return;
    if(target===start.index)select(target);
    else if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>=6)performSwap(start.index,target);
    else select(target);
  });
  on($('board'),'lostpointercapture',stopPointer);
  on(window,'pointercancel',stopPointer);
  on(window,'blur',()=>{stopPointer();if(presentation)finishPresentation(presentation);pauseGame();});
  on(document,'visibilitychange',()=>{stopPointer();if(document.hidden){if(presentation)finishPresentation(presentation);pauseGame();}syncAudio();});
  on(window,'pagehide',()=>{stopPointer();if(presentation)finishPresentation(presentation);});
  on($('board'),'click',e=>{if(e.detail===0){const tile=e.target.closest('[data-index]');if(tile)select(+tile.dataset.index);}});
  on($('board'),'keydown',e=>{
    const tile=e.target.closest('[data-index]');if(!tile||!gameInputAllowed())return;if(guideFeedback()){e.preventDefault();return;}if(busy){e.preventDefault();finishPresentation(presentation);return;}
    const index=+tile.dataset.index;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();select(index);return;}
    const direction={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!direction)return;
    e.preventDefault();const positions=geometry().positions,p=positions[index];
    const next=activeLevel.cells.map((_,i)=>i).filter(i=>engine.adjacent(index,i)).map(i=>{const dx=positions[i].x-p.x,dy=positions[i].y-p.y;return {i,score:(dx*direction[0]+dy*direction[1])/Math.hypot(dx,dy)};}).filter(n=>n.score>0).sort((a,b)=>b.score-a.score)[0];
    if(next){focusIndex=next.i;for(const n of $('board').querySelectorAll('[data-index]'))n.setAttribute('tabindex',+n.dataset.index===focusIndex?'0':'-1');$('board').querySelector(`[data-index="${focusIndex}"]`)?.focus?.();}
  });
  on($('coach-skip'),'click',()=>{cancelPresentation();for(let i=0;i<tutorialCount;i++)if(!saved.done.includes(i))saved.done.push(i);saved.done.sort((a,b)=>a-b);enterGame(tutorialCount);});
  on($('coach-next'),'click',()=>{
    if(!gameInputAllowed())return;
    const feedback=guideFeedback();if(!feedback)return;
    saved.guideAcks.push(feedback.id);selected=null;hinted=null;stopPointer();
    focusIndex=guidedStep()?.pair[0]??0;render();persist();
  });
  on($('tutorial-replay'),'click',()=>enterGame(0,{fresh:true}));
  on($('skip-animation'),'click',()=>finishPresentation(presentation));
  on($('reset'),'click',restart);on($('retry'),'click',restart);on($('hint'),'click',hint);
  on($('help'),'click',()=>openModal('help-dialog'));
  on($('sound'),'click',()=>{saved.sound=!saved.sound;renderSound();persist();unlockAudio();if(saved.sound)tone(3);});
  on($('continue'),'click',showResult);
  on($('next'),'click',()=>{closeModal($('win-dialog'));if(active===levels.length-1){showScreen('journey');return;}if(active<tutorialCount-1)enterGame(active+1,{fresh:true});else requestStage(active+1);});
  on($('review'),'click',()=>closeModal($('win-dialog')));
  on(document,'click',event=>{
    const nav=event.target.closest('[data-nav]');if(nav){event.preventDefault();showScreen(nav.dataset.nav);return;}
    if(event.target.closest('[data-settings]')){event.preventDefault();openSettings();return;}
    const stage=event.target.closest('[data-stage]');if(stage&&!stage.disabled)requestStage(+stage.dataset.stage);
  });
  on($('home-play'),'click',()=>{unlockAudio();const next=nextStage();if(!next)showScreen('journey');else if(next.resume)enterGame(next.index);else requestStage(next.index);});
  on($('home-teach'),'click',()=>enterGame(0,{fresh:true}));
  on($('help-teach'),'click',()=>enterGame(0,{fresh:true}));
  on($('settings'),'click',event=>{event.stopPropagation();openSettings();});
  on($('pause'),'click',pauseGame);
  on($('pregame-start'),'click',()=>{const index=pendingStage;if(index===null)return;const checkpoint=validCheckpoint(index);if(saved.boards[index]&&!checkpoint&&variantCatalog){restart(index);return;}enterGame(index,{fresh:checkpoint?.status!=='playing'||lifeDiscarded(index),reason:checkpoint?'replay':'stage_entry'});});
  on($('pregame-restart'),'click',()=>{const index=pendingStage;if(index!==null)restart(index);});
  on($('restart-confirm'),'click',()=>{
    const request=pendingRestart;if(!request)return;lifeRefresh({persist:true});
    const entry=stageEntry(request.index),view=lifeReady()?lifeManager.view(lifeFeature.life):null;
    if(request.index>=tutorialCount&&entry?.game.status==='playing'&&entry.game.turn>0&&view&&!view.canStart){
      if(!freshCampaignAvailable(request.index)){toast('Yeni tahtalar yüklenemedi. Mevcut denemen korundu.');return;}
      const result=lifeSettle(entry,'restart',{maxCharge:request.lifeCost});
      if(['storage','invalid','unavailable','ledger_full'].includes(result.reason)){openLives({index:request.index,reason:request.reason});return;}
      if(result.reason==='confirmation_changed'){updateRestartLifeCopy(request.index);return;}
      discardStage(request.index,request.reason,entry);persist();showScreen('home');openLives({index:request.index,reason:request.reason});return;
    }
    if(enterGame(request.index,{fresh:true,reason:request.reason,lifeCostQuote:request.lifeCost}))toast('Yeni bir tahta hazır. Önceki denemen sıfırlandı.');
  });
  on($('pause-continue'),'click',()=>{closeModal($('pause-dialog'));unlockAudio();});
  on($('pause-restart'),'click',restart);
  on($('pause-home'),'click',()=>showScreen('home'));
  on($('pause-settings'),'click',event=>{event.stopPropagation();openSettings();});
  on($('win-home'),'click',()=>showScreen('home'));on($('win-map'),'click',()=>showScreen('journey'));
  on($('lose-home'),'click',()=>showScreen('home'));on($('lose-map'),'click',()=>showScreen('journey'));
  function savePreferences(){persist();renderSound();syncAudio();}
  on($('setting-sfx'),'change',event=>{saved.sound=event.target.checked;savePreferences();unlockAudio();if(saved.sound)tone(2);});
  on($('setting-music'),'change',event=>{saved.preferences.music=event.target.checked;savePreferences();unlockAudio();});
  on($('setting-motion'),'change',event=>{saved.preferences.motion=event.target.value;if(presentation)finishPresentation(presentation);savePreferences();});
  on($('setting-volume'),'input',event=>{saved.preferences.volume=Math.max(0,Math.min(1,Number(event.target.value)/100));$('volume-value').textContent=`%${Math.round(saved.preferences.volume*100)}`;savePreferences();});
  on($('setting-haptics'),'change',event=>{saved.preferences.haptics=event.target.checked;savePreferences();if(saved.preferences.haptics&&typeof navigator.vibrate==='function')try{navigator.vibrate(12);}catch(_){} });
  on($('settings-reset'),'click',()=>{
    lifeRefresh({persist:true});const entries=levels.map((_,index)=>stageEntry(index)),cost=discardCost(entries);pendingResetLifeCost=cost;
    if($('reset-description'))$('reset-description').textContent=`Bütün bölüm ilerlemen silinecek.${cost?` Oynanmış açık denemeleri silmek ${cost} can harcar.`:''} Canların yeniden doldurulmaz. Test Altının ve işlem kayıtların korunur.`;
    openModal('reset-dialog');
  });
  on($('reset-confirm'),'click',()=>{
    lifeRefresh({persist:true});
    if(!lifeReady()){toast('Can verisi açılamadı. İlerlemen korundu.');return;}
    const currentResetCost=discardCost(levels.map((_,index)=>stageEntry(index)));
    if(pendingResetLifeCost===null||currentResetCost>pendingResetLifeCost){pendingResetLifeCost=currentResetCost;if($('reset-description'))$('reset-description').textContent=`Koşullar değişti. Bütün bölüm ilerlemen silinecek ve ${currentResetCost} can harcanacak. Canların yeniden doldurulmaz; Test Altının ve işlem kayıtların korunur.`;toast('Can koşulları değişti. Yeni bilgiyi kontrol edip tekrar onayla.');return;}
    const lifeReset=lifeClone(lifeFeature);let actualResetCost=0;
    for(let index=0;index<levels.length;index++){const entry=stageEntry(index);if(entry?.game.status==='playing'){
      const result=lifeManager.settleAttempt(lifeReset.life,lifeContext(entry,'restart'));
      if(['invalid','unavailable','ledger_full'].includes(result.reason)){toast('Can işlemi tamamlanamadı. İlerlemen korundu.');return;}
      lifeReset.life=result.state;if(result.charged)actualResetCost++;
    }}
    if(actualResetCost>pendingResetLifeCost){pendingResetLifeCost=actualResetCost;if($('reset-description'))$('reset-description').textContent=`Koşullar değişti. Bütün bölüm ilerlemen silinecek ve ${actualResetCost} can harcanacak. Canların yeniden doldurulmaz; Test Altının ve işlem kayıtların korunur.`;toast('Can koşulları değişti. Yeni bilgiyi kontrol edip tekrar onayla.');return;}
    if(!lifeCommit(lifeReset))return;
    for(let index=0;index<levels.length;index++)discardStage(index,'progress_reset');cancelPresentation();cancelHint();closeAllDialogs();saved.done=[];saved.boards={};saved.attempts={};saved.attemptStats={};saved.variantSelection.counts={};saved.variantSelection.recent={};saved.guideAcks=[];saved.records={};saved.current=0;active=0;loadLevel(0,true);showScreen('home',{replace:true});toast('Yolculuk sıfırlandı. Ses ve hareket tercihlerin korundu.');
  });
  on(window,'popstate',event=>{
    if(topDialog()){closeModal(topDialog());try{history.pushState({screen},'','#'+screen);}catch(_){}return;}
    const next=event.state?.screen||location.hash.slice(1)||'home';showScreen(next,{historyChange:false});
  });
  on(window,'keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||event.repeat)return;
    if(event.key==='Escape'){
      if(topDialog()){event.preventDefault();closeModal(topDialog());return;}
      if(screen==='game'){event.preventDefault();pauseGame();return;}
      if(screen!=='home'){event.preventDefault();showScreen('home');}return;
    }
    if(!gameInputAllowed()||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
    if(event.key.toLowerCase()==='r'){event.preventDefault();restart();}
    if(event.key.toLowerCase()==='h'){event.preventDefault();hint();}
  });
  on(window,'pagehide',()=>{audio?.stop();if(engine)persist();});
  const motionQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  motionQuery?.addEventListener?.('change',()=>{if(saved.preferences.motion==='auto'){if(presentation&&reduceMotion())finishPresentation(presentation);syncAudio();}});
  sessionAction(()=>{initializeLives();bindLivesUI();hydrateRecords();renderSound();loadLevel(active);showScreen('home',{replace:true});});
  if(migrated)toast('İlerlemen korundu. Öğreticileri yolculuk menüsünden yeniden oynayabilirsin.');
});
