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
  let sourceSaveKey=key;
  let gameLoadIssue=null;
  let migrated=false,economyManager=null,economyIssue=null,lastEconomyReward=null;
  const pad = n => String(n).padStart(2, '0');
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const reduceMotion=()=>saved.preferences.motion==='reduce'||(saved.preferences.motion==='auto'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  let saved = window.HexGameSave.defaults();
  // Optional observation data may fail independently; progression uses strict reads.
  function readSave(name){try{return session?session.read(name):JSON.parse(localStorage.getItem(name));}catch(_){return null;}}
  try {
    const loaded = window.HexGameSave.load({
      read: name => session.read(name), contains: name => session.contains(name), levels, tutorials
    });
    saved = loaded.saved; sourceSaveKey = loaded.sourceSaveKey; migrated = loaded.migrated;
  } catch (_) { gameLoadIssue = 'invalid'; }
  let active=saved.current,activeLevel=levels[saved.current],activeAttempt=null,attemptPending=true,saveBlocked=false,loadIssue=null,engine, selected=null, hinted=null, busy=false, focusIndex=0;
  let pointer=null, toastTimer, terminalTimer, epoch=0, comboText='',presentation=null,hintJob=null;
  const geometryCache=new Map();
  let screen='home',paused=false,pendingStage=null,pendingRestart=null,invalidPresentation=null;
  let assistanceMode=null,pendingAssistance=null;
  let rescueManager=null,pendingRescueProvider=null,pendingRescueReceipt=null,rescueTimeFloor=0;
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
    if(!rewardReady()||engine?.assisted)return;
    try{rewardState=window.HexRewardAdapter.restore(activeLevel,engine.snapshot(),window.HEX_REWARD_RULES,window.HexMatch,window.HexRewards,activeAttempt?.attemptId||String(activeLevel.id)).state;}catch(_){}
  }
  function planRewards(before,result){
    if(engine?.assisted){rewardState=null;completionReward=null;completionRewardPlayed=false;return null;}
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

  const economyView=()=>{try{return economyManager&&saved.economy?economyManager.view(saved.economy):null;}catch(_){return null;}};
  const canOpen=i=>Number.isInteger(i)&&i>=0&&i<levels.length&&!economyIssue&&!!economyManager?.canEnter(saved.economy,levels[i].id);
  const campaignCleared=i=>i>=tutorialCount&&!!economyView()?.cleared.includes(levels[i]?.id);
  function initializeEconomy(){
    if(gameLoadIssue)throw new Error('invalid_game_save');
    if(!window.HexEconomy||!window.HEX_ECONOMY_CONFIG)throw new Error('economy_unavailable');
    economyManager=window.HexEconomy.createManager(window.HEX_ECONOMY_CONFIG);
    if(Object.prototype.hasOwnProperty.call(saved,'economy'))economyManager.restore(saved.economy);
    const verifiedLevelIds=[];
    for(let index=tutorialCount;index<levels.length;index++){
      try{if(restoredStage(index)?.game.status==='won')verifiedLevelIds.push(levels[index].id);}catch(_){}
    }
    // Existing completion flags permanently close a level. Only replayed wins
    // provide evidence for a retroactive grant; missing evidence is reported.
    const migratedEconomy=economyManager.migrate(saved.economy??null,{done:saved.done,verifiedLevelIds,sourceKey:sourceSaveKey});
    saved.economy=migratedEconomy.state;
    syncCompletedCampaign();
    validateAssistedCheckpoints();
    if(!canOpen(saved.current))saved.current=nextCampaignIndex()??0;
    active=saved.current;activeLevel=levels[active];
  }
  function syncCompletedCampaign(){
    const cleared=economyView()?.cleared||[];
    saved.done=[...new Set([...saved.done.filter(i=>i<tutorialCount),...levels.map((level,index)=>index>=tutorialCount&&cleared.includes(level.id)?index:-1).filter(index=>index>=0)])].sort((a,b)=>a-b);
  }
  function nextCampaignIndex(){
    const id=!economyIssue&&saved.economy?economyManager?.nextLevel(saved.economy):null;
    return typeof id==='number'?levels.findIndex((level,index)=>index>=tutorialCount&&level.id===id):null;
  }
  function campaignEntryAllowed(index,{notify=true}={}){
    if(canOpen(index))return true;
    if(notify)toast(campaignCleared(index)?'Bu bölüm tamamlandı. Sıradaki bölümden devam edebilirsin.':'Bu bölüm henüz açılamıyor. Sıradaki bölümden devam et.');
    return false;
  }
  function renderEconomy(){
    const view=economyView();if(!view)return;
    for(const [selector,value]of [['[data-game-gold]',view.gold],['[data-game-stars]',view.stars],['[data-green-brush]',view.inventory.greenBrush],['[data-color-key]',view.inventory.colorKey]])document.querySelectorAll(selector).forEach(node=>{node.textContent=String(value);});
    if($('inventory-dialog')?.open)renderInventory();
    const pending=view.pendingReviewLevelIds||[];
    $('progression-notice').hidden=!pending.length;
    $('progression-notice').textContent=pending.length?'Eski tamamlamaların korundu. Bazı eski sonuçların kanıtı bulunamadığı için ödülleri inceleme bekliyor. Bu bölümler yeniden açılmaz.':'';
    renderGarden(view);
  }
  function renderGarden(view){
    if(!window.HexGarden)return;
    const garden=window.HexGarden.describe(view);
    $('garden-visual').innerHTML=window.HexGarden.markup(view);
    $('garden-stars').textContent=String(garden.stars);
    $('garden-progress-title').textContent=garden.title;$('garden-progress-copy').textContent=garden.summary;
    $('garden-milestones').innerHTML=garden.milestones.map(milestone=>`<li data-garden-milestone="${milestone.id}" data-unlocked="${milestone.unlocked}"><span class="garden-milestone-mark" aria-hidden="true">${milestone.unlocked?'✓':'○'}</span><div><strong>${milestone.label}</strong><span>${milestone.stars} yıldız · ${milestone.unlocked?'Açıldı':'Sırada'}</span><p>${milestone.description}</p></div></li>`).join('');
    $('garden-next-milestone').hidden=!garden.next;$('garden-next-milestone').textContent=garden.next?`${garden.next.label} için ${garden.next.remaining} yıldız daha.`:'';
    $('garden-coming-soon').hidden=!view.campaignComplete;
    const pending=view.pendingReviewLevelIds||[];$('garden-pending-notice').hidden=!pending.length;
    $('garden-pending-notice').textContent=pending.length?'Eski tamamlamaların korundu. Kanıtı bulunamayan bazı eski sonuçların yıldız ödülü inceleme bekliyor. Bahçen yalnız kaydedilmiş yıldızlarınla büyür; tamamlanan bölümler yeniden açılmaz.':'';
  }

  function rescueClock(){return Math.max(lifeClock(),rescueTimeFloor,lifeFeature?.life?.lastSeenUtc||0);}
  function initializeRescue(){
    if(gameLoadIssue||!window.HexRescue)throw new Error('invalid_rescue_module_or_save');
    const prior=readSave(livesKey),stamp=prior?.life?.lastSeenUtc;
    rescueTimeFloor=Number.isSafeInteger(stamp)&&stamp>=0?stamp:0;
    rescueManager=window.HexRescue.createManager(window.HEX_ECONOMY_CONFIG.rescue,{clock:rescueClock,verifyReceipt:(receipt,provider)=>window.HexRescue.TestProvider.verify(provider,receipt)});
    if(Object.prototype.hasOwnProperty.call(saved,'rescue'))saved.rescue=rescueManager.restore(saved.rescue);
    else{
      const previous=prior?.provider?.namespace,namespace=typeof previous==='string'&&/^[A-Za-z0-9_.:-]+$/.test(previous)?previous.slice(0,130)+'-rescue':`hexrota-rescue-${selectionSeed().toString(16)}`;
      saved.rescue=rescueManager.createState({namespace});
    }
  }
  function rescueContext(entry={metadata:activeAttempt,level:activeLevel,game:engine},index=active){
    if(!entry?.metadata||!entry.game)return null;
    return {attemptId:entry.metadata.attemptId,levelId:entry.level.id,tutorial:index<tutorialCount,cleared:campaignCleared(index),status:entry.game.status,movesLeft:entry.game.movesLeft,turn:entry.game.turn,lastCommand:entry.game.commands?.at(-1)?.type||(entry.game.history.length?'swap':'none'),rescuesUsed:validCounter(entry.game.usage?.rescue)};
  }
  function rescueOffer(index=active){
    if(!rescueManager||!saved.rescue||index<tutorialCount||!canOpen(index)||lifeDiscarded(index))return null;
    try{
      const entry=index===active&&!attemptPending&&!saveBlocked?{metadata:activeAttempt,level:activeLevel,game:engine}:restoredStage(index),context=rescueContext(entry,index);
      if(!context)return null;
      const offer=rescueManager.availability(saved.rescue,context,{gold:economyView().gold});
      if(offer.eligible&&!entry.game.legalMoves().length)return {...offer,eligible:false,reason:'no_legal_swaps',ad:{...offer.ad,allowed:false,reason:'no_legal_swaps'},gold:{...offer.gold,allowed:false,reason:'no_legal_swaps'}};
      return offer;
    }catch(_){return null;}
  }
  function recoverableLoss(index){return rescueOffer(index)?.eligible===true;}
  function resumeSecondChance(index){
    if(!campaignEntryAllowed(index)||!recoverableLoss(index))return false;
    if(!loadLevel(index,false,{activate:false}))return false;
    showScreen('game');showLoss();return true;
  }
  function validateRescueLife(game,metadata){
    const manager=lifeManager||window.HexLives.createManager(window.HEX_LIVES_CONFIG,{clock:rescueClock,verifyReceipt:()=>false});
    const feature=lifeFeature||window.HexLifePrototype.validate(readSave(livesKey),manager),settled=manager.settlementFor(feature.life,metadata.attemptId);
    const discardedHistory=settled?.discarded===true&&settled.outcome==='restart'&&game.status!=='won';
    if(!settled||settled.levelId!==metadata.levelId||settled.tutorial||(!discardedHistory&&(settled.discarded||settled.outcome!==(game.status==='won'?'won':'failed')))||settled.movesUsed<game.level.moves)throw new Error('Rescue has no matching first loss life settlement');
  }
  function validateRescueCommand(command,game,metadata,economyState){
    if(!rescueManager||!saved.rescue)throw new Error('Missing rescue ledger');
    const settled=rescueManager.settlementFor(saved.rescue,metadata.attemptId),transaction=rescueManager.transactionFor(saved.rescue,command.id),payment=economyState.transactions[command.id];
    if(!settled||!transaction||settled.transactionId!==command.id||settled.levelId!==metadata.levelId||transaction.attemptId!==metadata.attemptId||transaction.levelId!==metadata.levelId||transaction.moves!==5||settled.source!==transaction.source)throw new Error('Rescue command has no matching settlement');
    if(transaction.source==='gold'){
      if(!payment||payment.kind!=='rescue'||payment.itemId!=='rescue5'||payment.attemptId!==metadata.attemptId||payment.levelId!==metadata.levelId||payment.costGold!==transaction.costGold)throw new Error('Rescue payment mismatch');
    }else{
      if(payment)throw new Error('An ad rescue cannot debit Gold');
      const provider=saved.rescue.provider,record=provider.transactions[command.id],prefix=provider.namespace+'-',serial=command.id.startsWith(prefix)?Number(command.id.slice(prefix.length)):NaN;
      const archived=Number.isSafeInteger(serial)&&serial>0&&command.id===prefix+serial&&provider.finalizedRanges.some(pair=>serial>=pair[0]&&serial<=pair[1]);
      if(!archived&&(!record||record.status!=='completed'||record.attemptId!==metadata.attemptId||record.levelId!==metadata.levelId||!window.HexRescue.TestProvider.verify(provider,record.receipt)))throw new Error('Rescue advertisement has no verified completion');
    }
    validateRescueLife(game,metadata);
  }
  function renderRescue(){
    if(!rescueManager||!saved.rescue)return;
    const offer=rescueOffer(),lost=active>=tutorialCount&&!attemptPending&&!saveBlocked&&engine?.status==='lost';
    $('second-chance-panel').hidden=!lost;
    $('second-chance-ad').disabled=!offer?.eligible||!(offer.ad.allowed||offer.ad.pendingTransactionId);
    $('second-chance-gold').disabled=!offer?.gold.allowed||lifeWriteFailed||!!pendingRescueReceipt;
    $('second-chance-gold').textContent=`${window.HEX_ECONOMY_CONFIG.rescue.goldCost} Altın · +5 hamle`;
    $('second-chance-ad').textContent=pendingRescueReceipt?'Kazandığın +5 hamleyi kaydet':offer?.ad.pendingTransactionId?'Yarım kalan TEST reklamını aç':'TEST reklamı · +5 hamle';
    $('setting-rescue-ad').checked=saved.rescue.provider.adAvailable;
    const reason=offer?.reason||offer?.ad.reason;
    let message;
    if(reason==='no_legal_swaps')message='Bu tahtada eşleşme yapacak hamle kalmadı. Yeni bir deneme başlatabilirsin.';
    else if(!offer?.eligible)message=reason==='already_rescued'?'Bu denemede ikinci şansını kullandın. Yeni bir deneme başlatabilir veya menüye dönebilirsin.':'Bu deneme kapanmış. Yeni bir deneme başlatabilir veya menüye dönebilirsin.';
    else if(reason==='ad_unavailable')message='Şu an TEST reklamı yok. Yeniden deneyebilir veya menüye dönebilirsin.';
    else if(reason==='daily_limit')message='Bugünkü 2 ikinci şans reklamı hakkın doldu.';
    else if(reason==='daily_reserved')message='Bugünkü reklam hakların yarım kalan TEST işlemleri için ayrılmış.';
    else if(offer.ad.pendingTransactionId)message='Başlattığın TEST işlemini sürdürebilirsin. Yeni bir reklam hakkı ayrılmaz.';
    else message=`İkinci şans reklamı: bugün ${offer.ad.remainingToday} hak kaldı. Can reklamlarından ayrıdır.`;
    if(offer?.eligible&&!offer.gold.allowed)message+=' Altın seçeneği için bakiyen yetersiz.';
    else if(offer?.gold.allowed&&['ad_unavailable','daily_limit','daily_reserved'].includes(reason))message+=' Altınla devam edebilirsin.';
    if(pendingRescueReceipt)message='Ödülü zaten kazandın. Altın harcamadan kaydetmeyi tekrar dene; yeni reklam gerekmez.';
    $('second-chance-status').textContent=message;
  }
  function showRescueProvider(id){
    pendingRescueProvider=id;const proof=pendingRescueReceipt?.receipt.transactionId===id;
    $('rescue-provider-title').textContent=proof?'Ödülün kaydedilmeyi bekliyor':'TEST reklamı: +5 hamle';
    $('rescue-provider-description').textContent=proof?'Tamamlanan TEST işleminin doğrulanmış ödülü henüz kaydedilemedi. Aynı ödülü kaydetmeyi tekrar dene; yeni reklam başlatılmaz.':'Bu yerel test gerçek reklam göstermez. Yalnız tamamladığında aynı tahtana 5 hamle eklenir.';
    $('rescue-provider-confirm').hidden=!!proof;$('rescue-receipt-retry').hidden=!proof;
    openModal('rescue-provider-dialog');
  }
  function beginRescueAd(){
    if(pendingRescueReceipt){showRescueProvider(pendingRescueReceipt.receipt.transactionId);return {applied:false,reason:'pending_rescue_delivery'};}
    if(screen!=='game'||!$('lose-dialog').open||busy||paused||lifeWriteFailed)return {applied:false,reason:'unavailable'};
    const offer=rescueOffer();if(!offer?.eligible)return {applied:false,reason:'unavailable'};
    if(offer.ad.pendingTransactionId){showRescueProvider(offer.ad.pendingTransactionId);return {applied:false,reason:'ad_pending'};}
    if(!offer.ad.allowed){renderRescue();return {applied:false,reason:offer.ad.reason};}
    const result=rescueManager.beginAd(saved.rescue,rescueContext());if(!result.transactionId)return result;
    saved.rescue=result.state;persist();if(!commitSession())return {applied:false,reason:'storage'};
    showRescueProvider(result.transactionId);return result;
  }
  function cancelRescueProvider(){
    if(sessionRestoring)return;
    const id=pendingRescueProvider;pendingRescueProvider=null;
    if(!id||pendingRescueReceipt?.receipt.transactionId===id||saved.rescue?.provider.transactions[id]?.status!=='pending')return;
    const result=rescueManager.completeAd(saved.rescue,id,{outcome:'cancelled'});saved.rescue=result.state;persist();commitSession();renderRescue();
  }
  function cancelPendingRescue(entry){
    if(!entry?.metadata||!saved.rescue)return;
    for(const [id,row]of Object.entries(saved.rescue.provider.transactions))if(row.attemptId===entry.metadata.attemptId&&row.status==='pending'){
      if(pendingRescueReceipt?.receipt.transactionId===id)continue;
      saved.rescue=rescueManager.completeAd(saved.rescue,id,{outcome:'cancelled'}).state;
    }
  }
  function applyRescueGrant(result,economyState){
    const model=commandGame(),applied=model.apply({id:result.grant.commandId,type:'grant_moves',moves:5});
    if(!applied.ok||applied.duplicate)return {applied:false,reason:'invalid_command'};
    cancelPresentation();cancelHint();cancelAssistance();clearScoreReceipt();stopPointer();epoch++;
    engine=model;saved.economy=economyState;saved.rescue=result.state;const stats=activeStats();if(stats)stats.terminalEvent=null;
    rewardState=null;completionReward=null;completionRewardPlayed=false;
    persist();emitEvent('booster_used',{boosterId:'rescue5'});
    if(!commitSession()){
      if(pendingRescueReceipt)showRescueProvider(pendingRescueReceipt.receipt.transactionId);
      return {applied:false,reason:'storage'};
    }
    pendingRescueProvider=null;pendingRescueReceipt=null;closeAllDialogs();paused=false;render();renderLevels();updateMenus();renderLives();renderRescue();
    toast('Aynı tahtana 5 hamle eklendi.');return {applied:true,reason:'rescued'};
  }
  function applyRescueReceipt(receipt,completedProvider){
    if(!rescueManager||!activeAttempt||attemptPending||saveBlocked||active<tutorialCount||!canOpen(active)||lifeDiscarded(active)||receipt?.attemptId!==activeAttempt.attemptId||receipt?.levelId!==activeLevel.id)return {applied:false,reason:'attempt_changed'};
    try{
      if(engine.status==='lost'&&!engine.legalMoves().length)return {applied:false,reason:'no_legal_swaps'};
      const result=rescueManager.applyAd(saved.rescue,rescueContext(),receipt,completedProvider);
      if(!result.applied)return {applied:false,reason:result.reason};
      pendingRescueReceipt={receipt:lifeClone(receipt),completedProvider:lifeClone(completedProvider||saved.rescue.provider)};
      return applyRescueGrant(result,saved.economy);
    }catch(_){return {applied:false,reason:'invalid'};}
  }
  function finishRescueProvider(){
    if(pendingRescueReceipt)return applyRescueReceipt(pendingRescueReceipt.receipt,pendingRescueReceipt.completedProvider);
    const id=pendingRescueProvider;
    if(!id||!$('rescue-provider-dialog').open)return {applied:false,reason:'unavailable'};
    const result=rescueManager.completeAd(saved.rescue,id,{outcome:'completed'});
    if(!result.receipt)return {applied:false,reason:'unverified_receipt'};
    return applyRescueReceipt(result.receipt,result.completedProvider);
  }
  function rescueWithGold(){
    if(pendingRescueReceipt){showRescueProvider(pendingRescueReceipt.receipt.transactionId);return {applied:false,reason:'pending_rescue_delivery'};}
    if(screen!=='game'||!$('lose-dialog').open||busy||paused||lifeWriteFailed)return {applied:false,reason:'unavailable'};
    const offer=rescueOffer();if(!offer?.gold.allowed)return {applied:false,reason:offer?.gold.reason||'unavailable'};
    const operationId=`rescue:${activeAttempt.attemptId}`,result=rescueManager.applyGold(saved.rescue,rescueContext(),operationId,{gold:economyView().gold});
    if(!result.applied)return {applied:false,reason:result.reason};
    const debit=economyManager.spendRescue(saved.economy,{operationId,attemptId:activeAttempt.attemptId,levelId:activeLevel.id});
    if(!debit.applied)return {applied:false,reason:debit.reason};
    return applyRescueGrant(result,debit.state);
  }
  function rescueRefresh({write=false}={}){
    if(!rescueManager||!saved.rescue||sessionRestoring)return;
    const before=saved.rescue,next=rescueManager.reconcile(before);saved.rescue=next;
    if(write||next.adUsage.day!==before.adUsage.day||next.adUsage.count!==before.adUsage.count)persist();
    renderRescue();
  }
  function bindRescueUI(){
    on($('second-chance-ad'),'click',beginRescueAd);on($('second-chance-gold'),'click',rescueWithGold);
    on($('rescue-provider-confirm'),'click',finishRescueProvider);on($('rescue-receipt-retry'),'click',finishRescueProvider);
    on($('rescue-provider-dialog'),'close',cancelRescueProvider);
    on($('setting-rescue-ad'),'change',event=>{saved.rescue=rescueManager.setAdAvailable(saved.rescue,event.target.checked);persist();if(commitSession())renderRescue();});
    on(window,'focus',()=>rescueRefresh({write:true}));on(document,'visibilitychange',()=>{if(!document.hidden)rescueRefresh({write:true});});
    window.setInterval(()=>sessionAction(()=>{if(Math.floor(rescueClock()/86400000)!==saved.rescue.adUsage.day)rescueRefresh({write:true});}),1000);
    on(window,'pagehide',()=>rescueRefresh({write:true}));
    window.HexRescueTestAdapter=Object.freeze({applyReceipt:(receipt,provider)=>sessionAction(()=>applyRescueReceipt(receipt,provider))});
  }

  function assistanceLimits(){
    return {greenBrush:window.HEX_ECONOMY_CONFIG.inventory.greenBrush.maxPerAttempt,colorKey:window.HEX_ECONOMY_CONFIG.inventory.colorKey.maxPerAttempt,rescue:window.HEX_ECONOMY_CONFIG.rescue.maxPerAttempt};
  }
  function validateAssistanceBindings(game,metadata){
    const commands=Array.isArray(game.commands)?game.commands:[],assistance=commands.filter(command=>command.type!=='swap');
    if(!saved.economy){if(assistance.length)throw new Error('Assisted checkpoint has no economy');return;}
    const state=economyManager.restore(saved.economy),bound=new Set();
    for(const command of assistance){
      const itemId=command.type==='green_brush'?'greenBrush':command.type==='color_key'?'colorKey':null;
      if(command.type==='grant_moves'){validateRescueCommand(command,game,metadata,state);bound.add(command.id);continue;}
      if(!itemId)throw new Error('Unsupported assisted command');
      const row=state.transactions[command.id];
      if(!row||row.kind!=='use'||row.itemId!==itemId||row.attemptId!==metadata.attemptId||row.levelId!==metadata.levelId)throw new Error('Assisted command has no matching inventory debit');
      bound.add(command.id);
    }
    for(const [id,row]of Object.entries(state.transactions))if(row.attemptId===metadata.attemptId&&['use','rescue'].includes(row.kind)&&!bound.has(id))throw new Error('Present checkpoint omits a paid command');
    const rescued=rescueManager?.settlementFor(saved.rescue,metadata.attemptId);if(rescued&&!bound.has(rescued.transactionId))throw new Error('Present checkpoint omits a rescued command');
  }
  function validateAssistedCheckpoints(){
    const transactions=saved.economy.transactions;
    for(let index=tutorialCount;index<levels.length;index++){
      const snapshot=saved.boards[index];if(!snapshot)continue;
      const attemptIds=[saved.attempts[index]?.attemptId,`legacy-${levels[index].id}`];
      const charged=Object.values(transactions).some(row=>attemptIds.includes(row.attemptId)&&['use','rescue'].includes(row.kind));
      const rescued=rescueManager&&attemptIds.some(id=>typeof id==='string'&&rescueManager.settlementFor(saved.rescue,id));
      if(snapshot.rulesVersion==='assisted-v1'||charged||rescued)restoredStage(index);
    }
  }
  function inventoryUsage(itemId){return validCounter(engine?.usage?.[itemId]);}
  function inventoryPlayable(){return screen==='game'&&canOpen(active)&&active>=tutorialCount&&!attemptPending&&!saveBlocked&&!lifeWriteFailed&&!lifeDiscarded()&&!paused&&!busy&&engine?.status==='playing';}
  function renderInventory(){
    const view=economyView();if(!view)return;
    for(const [itemId,suffix]of [['greenBrush','green-brush'],['colorKey','color-key']]){
      const config=window.HEX_ECONOMY_CONFIG.inventory[itemId],unlocked=view.unlocks[itemId],used=inventoryUsage(itemId)>=config.maxPerAttempt;
      $('inventory-'+suffix+'-stock').textContent=String(view.inventory[itemId]);
      $('inventory-'+suffix+'-note').textContent=!unlocked?`${config.unlockAfterLevelId}. bölümden sonra açılır.`:used?'Bu denemede kullandın. Yeni denemede yeniden kullanabilirsin.':`Bu denemede en fazla ${config.maxPerAttempt} kez kullanabilirsin.`;
      $('use-'+suffix).disabled=!inventoryPlayable()||!unlocked||used||view.inventory[itemId]===0;
      $('buy-'+suffix).disabled=!inventoryPlayable()||!unlocked||view.gold<config.costGold;
      $('buy-'+suffix).textContent=`${config.costGold} Altınla +1 al`;
    }
  }
  function cancelAssistance(){assistanceMode=null;pendingAssistance=null;if($('assistance-target-prompt'))$('assistance-target-prompt').hidden=true;if($('assistance-confirm'))$('assistance-confirm').disabled=true;}
  function beginAssistance(itemId){
    if(!inventoryPlayable())return;
    const view=economyView(),config=window.HEX_ECONOMY_CONFIG.inventory[itemId];
    if(!view.unlocks[itemId]||view.inventory[itemId]<1||inventoryUsage(itemId)>=config.maxPerAttempt)return;
    closeModal($('inventory-dialog'));cancelHint();stopPointer();selected=null;hinted=null;
    assistanceMode={itemId,attemptId:activeAttempt.attemptId,epoch};pendingAssistance=null;
    $('assistance-target-copy').textContent=itemId==='greenBrush'?'Yeşertmek istediğin zemine dokun.':'Sayısını değiştirmek istediğin taşa dokun.';
    $('assistance-target-prompt').hidden=false;render();
  }
  function commandGame(){return engine.assisted?engine.clone():new window.HexAssistedGame(activeLevel,{attemptId:activeAttempt.attemptId,limits:assistanceLimits()},engine.snapshot());}
  function chooseAssistanceTarget(index){
    const mode=assistanceMode;
    if(!mode||!inventoryPlayable()||mode.attemptId!==activeAttempt.attemptId||mode.epoch!==epoch||!Number.isInteger(index)||index<0||index>=engine.total){cancelAssistance();return;}
    if(mode.itemId==='greenBrush'&&engine.layers[index]===0){toast('Burası zaten yeşil. Katı kalan bir zemin seç.');return;}
    const model=commandGame(),commandId=`assist:${activeAttempt.attemptId}:${model.commands.length+1}:${mode.itemId}`;
    pendingAssistance={itemId:mode.itemId,index,commandId,game:engine,attemptId:activeAttempt.attemptId,epoch,revision:session.revision,snapshot:JSON.stringify(engine.snapshot()),model,preview:null,command:null};
    assistanceMode=null;$('assistance-target-prompt').hidden=true;
    const key=mode.itemId==='colorKey';$('assistance-title').textContent=key?'Renk Anahtarı':'Yeşil Fırça';
    $('assistance-description').textContent=key?`${engine.values[index]} yazan taşı seçtin. İzin verilen başka bir sayıyı sen seç. Hamle harcamazsın.`:`Bu zemindeki ${engine.layers[index]} katı ${engine.layers[index]-1} kata indir. Taşın sayısı değişmez; hamle harcamaz, puan eklemez.`;
    $('assistance-value-label').hidden=!key;
    $('assistance-value').innerHTML='<option value="">Sayı seç</option>'+activeLevel.palette.filter(value=>value!==engine.values[index]).map(value=>`<option value="${value}">${value}</option>`).join('');
    $('assistance-value').value='';updateAssistancePreview();openModal('assistance-dialog');
  }
  function updateAssistancePreview(){
    const pending=pendingAssistance;if(!pending)return;
    const value=$('assistance-value').value;
    if(pending.itemId==='colorKey'&&value===''){$('assistance-preview').textContent='Önce yeni sayıyı seç. Oluşacak puanı kullanmadan önce göreceksin.';$('assistance-confirm').disabled=true;pending.preview=null;return;}
    const command=pending.itemId==='greenBrush'?{id:pending.commandId,type:'green_brush',index:pending.index}:{id:pending.commandId,type:'color_key',index:pending.index,value:Number(value)};
    const preview=pending.model.preview(command);pending.command=command;pending.preview=preview;
    $('assistance-confirm').disabled=!preview.result.ok;
    $('assistance-confirm').textContent=`1 ${pending.itemId==='greenBrush'?'Yeşil Fırça':'Renk Anahtarı'} kullan`;
    $('assistance-preview').innerHTML=preview.result.ok?`<strong>+${preview.result.scoreGain} puan · ${preview.result.layersRemoved} zemin katı</strong><span>0 hamle · Çantandan 1 adet düşer.</span>${pending.itemId==='colorKey'&&!preview.result.frames.length?'<p>Şu an eşleşme oluşmuyor. Taşı sonraki hamlen için değiştiriyorsun.</p>':''}${preview.result.reshuffled?'<p>Bu değişimden sonra hamle kalmadığı için taşlar karıştırılacak. Zemin korunur.</p>':''}${preview.status==='won'?'<p>Bu işlemle bölüm tamamlanır.</p>':''}`:'Bu hücrede kullanılamıyor. Başka bir hedef seç.';
  }
  async function confirmAssistance(){
    const pending=pendingAssistance;
    if(!pending?.preview?.result.ok)return;
    if(!inventoryPlayable()||pending.game!==engine||pending.attemptId!==activeAttempt.attemptId||pending.epoch!==epoch||pending.revision!==session.revision||pending.snapshot!==JSON.stringify(engine.snapshot())||(pending.itemId==='colorKey'&&String(pending.command?.value)!==$('assistance-value').value)){closeModal($('assistance-dialog'));cancelAssistance();toast('Tahtan veya kaydın değişti. Sonucu yeniden kontrol edip kullan.');return;}
    const debit=economyManager.consume(saved.economy,{operationId:pending.commandId,itemId:pending.itemId,attemptId:pending.attemptId,levelId:activeLevel.id});
    if(!debit.applied){closeModal($('assistance-dialog'));cancelAssistance();toast('Bu güçlendirici şu anda kullanılamıyor. Çantan korundu.');return;}
    const before={values:engine.values.slice(),layers:engine.layers.slice(),score:engine.score,movesLeft:engine.movesLeft};
    const next=pending.model.clone(),result=next.apply(pending.command);if(!result.ok||result.duplicate)return;
    closeModal($('assistance-dialog'));cancelAssistance();clearScoreReceipt();cancelHint();clearInvalidSwap();stopPointer();engine=next;saved.economy=debit.state;
    rewardState=null;completionReward=null;completionRewardPlayed=false;
    const stats=activeStats();if(stats)stats.cascades=validCounter(stats.cascades)+Math.max(0,result.frames.length-1);
    const job={token:++epoch,result,controller:new AbortController(),animations:[],watchdog:null,scoreDisplay:before.score,scoreTasks:[],rewardPlan:null,rewardCueIds:new Set(),rewardMilestoneIds:new Set(),rewardNodes:new Set(),rewardHeadlineUsed:false,assistanceItem:pending.itemId,assistanceIndex:pending.index};
    presentation=job;busy=true;selected=null;hinted=null;comboText='';syncPlaytestActivity();
    try{
      markCompleted(true);persist();settleActiveLife();emitEvent('booster_used',{boosterId:pending.itemId});terminalEvent();
      if(!commitSession())return;
      job.committed=true;renderLevels();updateMenus();
      job.watchdog=setTimeout(()=>finishPresentation(job),motion.budget);await presentSwap(job,null,null,before);
    }catch(_){if(!job.committed){sessionDirty=false;restoreDurable();toast('Güçlendirici kaydedilemedi. Tahtan ve çantan korundu.');}}
    finally{finishPresentation(job);}
  }
  function purchaseInventory(itemId){
    if(!inventoryPlayable())return;
    const operationId=`purchase:${itemId}:${Object.keys(saved.economy.transactions).length+1}`;
    const result=economyManager.purchase(saved.economy,{operationId,itemId});if(!result.applied){renderInventory();toast(result.reason==='insufficient_gold'?'Altının yetmiyor.':'Bu ürün henüz açılamıyor.');return;}
    saved.economy=result.state;persist();if(!commitSession())return;renderEconomy();renderInventory();toast('Çantana 1 adet eklendi.');
  }

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
    if(index>=tutorialCount&&variantCatalog){
      if(snapshot.rulesVersion==='assisted-v1'){
        if(!window.HexAssistedGame)throw new Error('Assisted game module is unavailable');
        const metadata=saved.attempts[index];
        if(!metadata||metadata.levelId!==base.id)throw new Error('Saved assisted identity cannot be verified');
        const resolved=variantCatalog.resolveLevel(base.id,metadata.variantId,metadata.levelDataVersion);
        const checked=variantCatalog.restore(base.id,new window.HexMatch(resolved).snapshot(),metadata);
        const game=new window.HexAssistedGame(checked.level,{attemptId:checked.metadata.attemptId,limits:assistanceLimits()},snapshot);
        if(!game.assisted)throw new Error('Unassisted command envelope is not a campaign checkpoint');
        validateAssistanceBindings(game,checked.metadata);
        return {...checked,game,snapshot};
      }
      const restored=variantCatalog.restore(base.id,snapshot,saved.attempts[index]);validateAssistanceBindings(restored.game,restored.metadata);return restored;
    }
    let metadata;
    if(index>=tutorialCount){
      metadata={attemptVersion:1,levelId:base.id,variantId:'legacy-original',levelDataVersion:'original-v1',attemptId:`legacy-${base.id}`,attemptSerial:0};
      const provided=saved.attempts[index];
      if(provided!=null&&Object.keys(metadata).some(field=>provided[field]!==metadata[field]))throw new Error('Saved variant identity cannot be verified');
    }else{
      const provided=saved.attempts[index],serial=validCounter(provided?.attemptSerial),expected=tutorialMetadata(index,serial);
      metadata=provided&&Object.keys(expected).every(field=>provided[field]===expected[field])?expected:tutorialMetadata(index);
    }
    if(snapshot.rulesVersion==='assisted-v1')throw new Error('Assisted checkpoints require the verified campaign catalog');
    const game=new window.HexMatch(base,snapshot);if(index>=tutorialCount)validateAssistanceBindings(game,metadata);
    return {metadata,level:base,game,snapshot,legacy:true};
  }
  function statsFor(index,entry,fresh=false){
    if(!entry?.metadata)return null;
    const previous=saved.attemptStats[index],same=!fresh&&previous?.attemptId===entry.metadata.attemptId,id=String(entry.level.id);
    saved.variantSelection.counts[id]=Math.max(1,validCounter(saved.variantSelection.counts[id]),same?validCounter(previous.attemptNumber):0);
    if(same){
      previous.attemptNumber=Math.max(1,validCounter(previous.attemptNumber));previous.started=previous.started===true||entry.game.turn>0||entry.game.assisted===true;
      previous.terminalEvent=['level_completed','level_failed','level_abandoned'].includes(previous.terminalEvent)?previous.terminalEvent:null;
      previous.hintsUsed=validCounter(previous.hintsUsed);previous.cascades=validCounter(previous.cascades);return previous;
    }
    let cascades=0;
    if(entry.game.assisted){const replay=new window.HexAssistedGame(entry.level,{attemptId:entry.metadata.attemptId,limits:assistanceLimits()});for(const command of entry.game.commands){const result=replay.apply(command);if(result.ok)cascades+=Math.max(0,result.frames.length-1);}}
    else{const replay=new window.HexMatch(entry.level);for(const pair of entry.game.history){const result=replay.swap(...pair);if(result.ok)cascades+=Math.max(0,result.frames.length-1);}}
    const stats={attemptId:entry.metadata.attemptId,attemptNumber:saved.variantSelection.counts[String(entry.level.id)]||1,started:!fresh&&(entry.game.turn>0||entry.game.assisted===true),terminalEvent:!fresh&&entry.game.status!=='playing'?(entry.game.status==='won'?'level_completed':'level_failed'):null,hintsUsed:0,cascades};
    saved.attemptStats[index]=stats;return stats;
  }
  function activeStats(){return activeAttempt?saved.attemptStats[active]:null;}
  function eventContext(entry={metadata:activeAttempt,level:activeLevel,game:engine,stats:activeStats()}){
    if(!entry.metadata||!entry.game||!entry.stats)return null;
    const game=entry.game;return {timestamp:Date.now(),levelId:entry.metadata.levelId,variantId:entry.metadata.variantId,levelDataVersion:entry.metadata.levelDataVersion,attemptId:entry.metadata.attemptId,attemptNumber:Math.max(1,validCounter(entry.stats.attemptNumber)),movesUsed:game.turn,movesRemaining:game.movesLeft,score:game.score,targetScore:entry.level.target,covered:game.covered,totalCells:game.total,remainingLayers:game.remainingLayers,cascades:validCounter(entry.stats.cascades),hintsUsed:validCounter(entry.stats.hintsUsed),status:game.status};
  }
  const playtestKey='hexrota-playtest-v1';let playtest=null;
  const createPlaytest=state=>window.HexPlaytest.createTracker({now:()=>Date.now(),monotonic:()=>performance.now(),state});
  if(window.HexPlaytest)try{playtest=createPlaytest(readSave(playtestKey));}catch(_){/* Invalid observation data must not affect play. */}
  function persistPlaytest(){
    if(!playtest||sessionRestoring)return;
    if(sessionDepth){sessionPlaytestDirty=true;return;}
    sessionPlaytestDirty=false;try{localStorage.setItem(playtestKey,JSON.stringify(playtest.snapshot()));}catch(_){}
  }
  function syncPlaytestActivity(){
    if(!playtest)return;try{playtest.setActivity({playing:screen==='game'&&!busy&&!paused&&!document.hidden&&!topDialog()&&engine?.status==='playing',attemptId:activeAttempt?.attemptId||null});}catch(_){}
  }
  function observePlaytest(name,context,details={}){
    if(!playtest)return;try{const{timestamp,...fields}=context||{};playtest.recordEvent(name,fields,{...details,developerBypass:!!lifeFeature?.life?.developerBypass});syncPlaytestActivity();persistPlaytest();}catch(_){}
  }
  function emitEvent(name,details={},entry){
    if(!eventState)return;
    const context=eventContext(entry);if(!context)return;
    observePlaytest(name,context,details);
    try{eventState=window.HexEvents.append(eventState,name,context,details);if(!sessionDepth)localStorage.setItem(eventKey,JSON.stringify(eventState));}catch(_){/* Local measurements never affect a game or a save. */}
  }
  // Game progress, lives and development receipts share one atomic host commit.
  // Life data never enters a HexMatch snapshot or its gameplay RNG.
  const livesKey='hexrota-lives-v1';
  let lifeFeature=null,lifeManager=null,lifeIssue=null,lifeWriteFailed=false,lifeVerificationProvider=null,pendingLifeStart=null,pendingLifeProvider=null,pendingLifeReceipt=null;
  let lifeLastPersistUtc=0,pendingResetLifeCost=null;
  const lifeClock=()=>Date.now();
  const lifeClone=value=>JSON.parse(JSON.stringify(value));
  let sessionDepth=0,sessionDirty=false,sessionRestoring=false,sessionEventBaseline=null,sessionGameBaseline=null,sessionPlaytestBaseline=null,sessionPlaytestDirty=false;
  function on(target,type,callback,options){if(!target)return;if(['pointerdown','pointermove','pointercancel','lostpointercapture','touchstart','touchmove','wheel','gesturestart','gesturechange','gestureend'].includes(type)){target.addEventListener(type,callback,options);return;}target.addEventListener(type,function(...args){return sessionAction(()=>callback.apply(this,args));},options);}
  function sessionAction(callback){
    if(!sessionDepth){
      sessionEventBaseline=eventState?lifeClone(eventState):null;sessionGameBaseline=lifeClone(saved);sessionPlaytestBaseline=null;
      if(playtest)try{sessionPlaytestBaseline=playtest.snapshot();}catch(_){}
    }
    sessionDepth++;try{return callback();}finally{sessionDepth--;if(!sessionDepth){if(sessionDirty)commitSession();else if(sessionPlaytestDirty)persistPlaytest();}}
  }
  function captureGame(){
    saved.current=active;
    if(engine&&!attemptPending&&!saveBlocked){saved.boards[active]=engine.snapshot();if(activeAttempt)saved.attempts[active]={...activeAttempt};}
  }
  function restoreDurable(){
    const durable=session?.current();if(!durable)return;
    saved=lifeClone(durable.revision===0?sessionGameBaseline:durable.game);lastEconomyReward=null;
    if(rescueManager){try{if(Object.prototype.hasOwnProperty.call(saved,'rescue'))saved.rescue=rescueManager.restore(saved.rescue);else initializeRescue();}catch(_){economyIssue='invalid';}}
    if(economyManager)try{if(Object.prototype.hasOwnProperty.call(saved,'economy'))saved.economy=economyManager.restore(saved.economy);else initializeEconomy();syncCompletedCampaign();}catch(_){economyIssue='invalid';}lifeFeature=window.HexLifePrototype.validate(durable.energy,lifeManager);active=saved.current;
    try{if(!canOpen(active)){active=nextCampaignIndex()??0;saved.current=active;}
      const entry=restoredStage(active);if(entry){engine=entry.game;activeLevel=entry.level;activeAttempt=entry.metadata;attemptPending=false;saveBlocked=false;}else{activeLevel=levels[active];engine=new window.HexMatch(activeLevel);activeAttempt=null;attemptPending=true;saveBlocked=false;loadIssue=null;}}catch(_){saveBlocked=true;}
    sessionRestoring=true;try{cancelAssistance();cancelPresentation();cancelHint();selected=null;pendingStage=null;pendingRestart=null;pendingResetLifeCost=null;if(pendingLifeProvider&&!lifeFeature.provider.transactions[pendingLifeProvider]&&!pendingLifeReceipt){pendingLifeProvider=null;if($('life-provider-dialog')?.open)closeModal($('life-provider-dialog'));}if(attemptPending)showScreen('home',{replace:true});restoreRewards();renderLevels();render();renderLives();renderRescue();}catch(_){}finally{sessionRestoring=false;}
  }
  function commitSession(){
    sessionDirty=false;if(sessionRestoring||!lifeFeature)return true;
    try{captureGame();session.commit(saved,lifeFeature);if(eventState)try{localStorage.setItem(eventKey,JSON.stringify(eventState));}catch(_){}lifeWriteFailed=false;lifeLastPersistUtc=lifeFeature.life.lastSeenUtc;if(pendingLifeReceipt&&lifeFeature.testWallet.processedTransactions[pendingLifeReceipt.receipt.transactionId])pendingLifeReceipt=null;if(sessionPlaytestDirty)persistPlaytest();return true;}
    catch(_){eventState=sessionEventBaseline;
      // Observation events describe committed moves only. Never rewind an already
      // saved move when a later presentation-only write fails.
      if(sessionPlaytestDirty&&sessionPlaytestBaseline)try{playtest=createPlaytest(sessionPlaytestBaseline);}catch(_){}
      sessionPlaytestDirty=false;restoreDurable();lifeWriteFailed=true;if(pendingLifeReceipt){pendingLifeProvider=pendingLifeReceipt.receipt.transactionId;$('life-provider-title').textContent='Ödülün kaydedilmeyi bekliyor';$('life-provider-description').textContent='Tamamlanan test işlemi kaydedilemedi. Yeniden denediğinde aynı ödül bir kez kaydedilecek.';openModal('life-provider-dialog');}toast('İşlem kaydedilemedi. Tahtan ve canların son güvenli kayda döndürüldü. Sayfayı yenileyip tekrar dene.');return false;}
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
    if(request&&lifeReady()&&!lifeManager.view(lifeFeature.life).canStart)observePlaytest('life_blocked',{}, {requestedLevelId:levels[request.index].id,reason:'lives_empty',developerBypass:lifeManager.view(lifeFeature.life).developerBypass,lives:lifeManager.view(lifeFeature.life).lives});
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
    const name=engine.status==='won'?'level_completed':'level_failed';stats.terminalEvent=name;persist();
    if(name==='level_failed'&&engine.usage?.rescue>0&&rescueManager?.settlementFor(saved.rescue,activeAttempt.attemptId)){observePlaytest(name,eventContext(),{reason:'post_rescue_failure'});return;}
    emitEvent(name);
  }
  function stageEntry(index){
    if(index===active&&!attemptPending&&!saveBlocked)return {metadata:activeAttempt,level:activeLevel,game:engine,stats:activeStats()};
    try{const restored=restoredStage(index);if(restored)return {...restored,stats:statsFor(index,restored)};}catch(_){}
    return null;
  }
  function discardStage(index,reason,entry=stageEntry(index)){
    if(!entry?.metadata)return null;
    cancelPendingRescue(entry);
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
  const settleViewport=()=>{stopPointer();clearInvalidSwap();if(presentation)finishPresentation(presentation);};
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
  const gameInputAllowed=()=>canOpen(active)&&!lifeWriteFailed&&!attemptPending&&!saveBlocked&&screen==='game'&&!paused&&!topDialog()&&!lifeDiscarded();
  function syncAudio(){document.body.classList.toggle('reduce-motion',reduceMotion());audio?.configure({sfx:saved.sound,music:saved.preferences.music,volume:saved.preferences.volume});audio?.setActive(!document.hidden&&!paused);}
  function unlockAudio(){syncAudio();audio?.unlock().catch(()=>{});}
  function openModal(id){
    stopPointer();cancelHint();clearInvalidSwap();if(id!=='assistance-dialog')cancelAssistance();
    if(presentation)finishPresentation(presentation);
    clearTimeout(terminalTimer);
    const dialog=$(id);if(!dialog.open){dialog.showModal();modalStack.push(id);}
    document.body.classList.add('modal-open');syncPlaytestActivity();
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
      if(dialog.id==='assistance-dialog')pendingAssistance=null;
      if(!topDialog())document.body.classList.remove('modal-open');syncPlaytestActivity();
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
    const campaignIndex=nextCampaignIndex();
    if(campaignIndex===null||campaignIndex<0)return null;
    if(recoverableLoss(saved.current))return {index:saved.current,resume:false,rescue:true};
    const activeCheckpoint=validCheckpoint(saved.current);
    if(canOpen(saved.current)&&activeCheckpoint?.status==='playing'&&(activeCheckpoint.turn>0||activeCheckpoint.assisted)&&!lifeDiscarded(saved.current))return {index:saved.current,resume:true};
    const tutorialIndex=tutorials.findIndex((_,index)=>!saved.done.includes(index));
    const index=tutorialIndex>=0?tutorialIndex:campaignIndex,current=validCheckpoint(index);
    return {index,resume:current?.status==='playing'&&(current.turn>0||current.assisted)&&!lifeDiscarded(index),rescue:recoverableLoss(index)};
  }
  function updateMenus(){
    if(!$('home-play'))return;
    const next=nextStage(),completed=economyView()?.cleared.length||0;
    renderEconomy();
    $('home-play-label').textContent=next?(next.rescue?'Tahtanı aç':next.resume?'Devam et':next.index===0?'Birlikte başlayalım':'Oyna'):'Bahçeni gör';
    $('home-play-detail').textContent=next?next.rescue?`${stageLabel(next.index)} · İkinci şans seçeneklerini gör`:next.resume?`${stageLabel(next.index)} · ${validCheckpoint(next.index).movesLeft} hamle kaldı`:next.index===0?'Aynı sayıları eşleştir, puan kazan.':`${stageLabel(next.index)} · ${levels[next.index].name}`:'Yeni bölümler yakında';
    $('home-stage-name').textContent=next?levels[next.index].name:'Bahçen ve bütün başarıların burada.';
    $('home-progress-text').textContent=`${completed} / ${campaignCount} bölüm tamamlandı`;
    $('home-progress-fill').style.width=`${completed/campaignCount*100}%`;
    $('journey-summary').textContent=`2 öğretici · ${completed} / ${campaignCount} bölüm tamamlandı`;
    $('journey-map').innerHTML=levels.map((level,index)=>{
      if(index>=tutorialCount&&!canOpen(index))return '';
      const done=saved.done.includes(index),locked=!canOpen(index),current=next?.index===index;
      return `<button class="map-node${done?' done':''}${locked?' locked':''}${current?' current':''}${index<tutorialCount?' tutorial-node':''}" data-stage="${index}" ${locked?'disabled':''} aria-label="${stageLabel(index)}: ${level.name}${done?', tamamlandı':''}${locked?', kilitli':''}"><span class="map-number">${index<tutorialCount?'T'+(index+1):pad(index-tutorialCount+1)}</span><span class="map-name">${level.name}</span></button>`;
    }).join('');
    const records=Object.entries(saved.records).filter(([index])=>+index>=tutorialCount);
    $('record-completed').textContent=`${completed} / ${campaignCount}`;
    $('record-score').textContent=records.length?Math.max(...records.map(([,r])=>r.score)).toLocaleString('tr-TR'):'—';
    $('record-bestmoves').textContent=records.length?Math.max(...records.map(([,r])=>r.movesLeft)):'—';
    $('records-list').innerHTML=levels.slice(tutorialCount).map((level,offset)=>{
      const index=offset+tutorialCount,record=saved.records[index],assisted=Object.values(saved.economy?.transactions||{}).some(row=>row?.kind==='clear'&&row.levelId===level.id&&row.assisted);
      return `<tr><th scope="row"><span class="record-stage">${pad(offset+1)}</span> ${level.name}${assisted?'<span class="assisted-record-label">Yardımla tamamlandı</span>':''}${saved.done.includes(index)?'<span class="record-complete" aria-label="Tamamlandı">✓</span>':''}</th><td>${record?record.score.toLocaleString('tr-TR'):'—'}</td><td>${record?record.movesLeft:'—'}</td></tr>`;
    }).join('');
    const achievements=[['İlk eşleşme','İlk öğreticiyi tamamla.',!!saved.records[0]],['İki hedef, bir plan','İkinci öğreticiyi tamamla.',!!saved.records[1]],['Yolun yarısı','Beş ana bölümü tamamla.',completed>=5],['Yeşil yolculuk','On ana bölümü tamamla.',completed===campaignCount]];
    $('achievement-list').innerHTML=achievements.map(([name,text,earned])=>`<div class="achievement${earned?' earned':''}"><span class="achievement-mark" aria-hidden="true">${earned?'✓':'◇'}</span><div><strong>${name}</strong><p>${text}</p></div><span class="achievement-state">${earned?'Tamamlandı':'Sırada'}</span></div>`).join('');
  }
  function showScreen(next,{replace=false,historyChange=true}={}){
    const previousScreen=screen;cancelAssistance();
    if(!['home','journey','game','records','garden'].includes(next))next='home';
    if(presentation)finishPresentation(presentation);
    if(next!=='game')clearScoreReceipt();
    cancelPresentation();cancelHint();stopPointer();clearTimeout(terminalTimer);epoch++;
    if(engine)persist();closeAllDialogs();paused=false;screen=next;
    for(const name of ['home','journey','game','records','garden']){const node=$(name+'-screen');node.hidden=name!==screen;node.inert=name!==screen;}
    document.body.dataset.screen=screen;
    document.querySelectorAll('[data-nav]').forEach(button=>{const active=button.dataset.nav===screen;button.classList.toggle('is-active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    updateMenus();syncAudio();syncPlaytestActivity();renderLives();
    if(historyChange&&(replace||previousScreen!==screen))try{history[replace?'replaceState':'pushState']({screen},'','#'+screen);}catch(_){}
    document.documentElement.scrollTop=0;document.body.scrollTop=0;
  }
  function enterGame(index,{fresh=false,reason='stage_entry',lifeCostQuote}={}){
    if(!campaignEntryAllowed(index))return false;
    if(pendingRescueReceipt&&(fresh||pendingRescueReceipt.receipt.attemptId!==saved.attempts[index]?.attemptId)){showRescueProvider(pendingRescueReceipt.receipt.transactionId);toast('Önce tamamlanan ödülü kaydet. Yeni reklam izlemen gerekmez.');return false;}
    if(!fresh&&recoverableLoss(index))return resumeSecondChance(index);
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
    if(newAttempt&&savedGame)cancelPendingRescue(previousEntry||stageEntry(index));
    closeAllDialogs();paused=false;
    if(!loadLevel(index,fresh,{activate:true})){showScreen('home');toast(loadIssue==='data'?'Yeni tahtalar yüklenemedi. Sayfayı yenileyip tekrar dene.':'Kaydın açılamadı ve korundu. İstersen yeni bir deneme başlatabilirsin.');return false;}
    const previous=previousEntry?discardStage(index,reason,previousEntry):null;
    showScreen('game');startEvent(reason);
    if(previous&&activeAttempt&&previous.attemptId!==activeAttempt.attemptId)emitEvent('level_retried',{reason,previousAttemptId:previous.attemptId});
    if(!newAttempt)observePlaytest('attempt_resumed',eventContext()||{});syncPlaytestActivity();
    unlockAudio();return true;
  }
  function requestStage(index){
    if(!Number.isInteger(index)||index<0||index>=levels.length||!canOpen(index))return;
    const recovering=recoverableLoss(index);
    const level=levels[index],checkpoint=validCheckpoint(index),resume=checkpoint?.status==='playing'&&(checkpoint.turn>0||checkpoint.assisted)&&!lifeDiscarded(index),blocked=!!saved.boards[index]&&!checkpoint;
    pendingStage=index;
    $('pregame-dialog').dataset.learning=index===0?'first':index<tutorialCount?'goals':'';
    if($('pregame-lesson'))$('pregame-lesson').hidden=index!==0;
    $('pregame-dialog').querySelector('.pregame-goals').hidden=index===0;
    $('pregame-tag').textContent=stageLabel(index);$('pregame-title').textContent=level.name;
    $('pregame-description').textContent=recovering?'Taşların, yeşil alanların ve puanın korunuyor. İkinci şans seçeneklerini görebilir veya yeni bir deneme başlatabilirsin.':blocked?'Bu kayıt açılamadı ve korundu. Yeni deneme başlatırsan bu bölümdeki ilerlemen sıfırlanır.':resume?'Kaldığın yerden devam et.':index===0?'Parlayan 2 ile 1’in yerini değiştir.':`${level.target} puana ulaş ve her yeri yeşile boya. ${level.moves} hamlen var.`;
    if($('pregame-note'))$('pregame-note').textContent=index===0?'Kaydırmak yerine iki taşa sırayla da dokunabilirsin.':'Bölümü bitirmek için puanın yeterli olmalı ve her yer yeşil olmalı.';
    $('pregame-target').textContent=level.target;$('pregame-ground').textContent=resume?`${checkpoint.covered} / ${level.cells.length}`:level.cells.length;
    $('pregame-moves').textContent=resume?checkpoint.movesLeft:level.moves;
    $('pregame-start').textContent=recovering?'İkinci şans seçenekleri':blocked?'Yeni deneme başlat':resume?'Devam et':'Başla';$('pregame-restart').hidden=!resume&&!recovering;
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
    renderRescue();openModal('settings-dialog');
  }
  function renderLevels() {
    $('levels').innerHTML=levels.map((l,i)=>{
      if(i>=tutorialCount&&!canOpen(i))return '';
      const done=saved.done.includes(i),current=i===active,locked=!canOpen(i),learning=i<tutorialCount,number=learning?`T${i+1}`:pad(i-tutorialCount+1);
      return `<button class="level-button${learning?' tutorial-node':''}${current?' active':''}${done?' done':''}" data-level="${i}" ${locked?'disabled':''} ${current?'aria-current="step"':''} aria-label="${learning?'Öğren':`Bölüm ${i-tutorialCount+1}`}: ${l.name}${done?', tamamlandı':''}${locked?', kilitli':''}" title="${l.name}${locked?' — Önceki bölümü tamamla':''}"><span class="level-number">${number}</span><span class="level-copy">${l.name}</span>${locked?'<svg class="icon level-status-icon"><use href="#i-lock"/></svg>':''}</button>`;
    }).join('');
    const completed=saved.done.filter(i=>i>=tutorialCount).length;
    $('completed').textContent=`${completed} / ${campaignCount}`;
    $('journey-fill').style.width=`${completed/campaignCount*100}%`;
  }
  function markCompleted(played=false) {
    if(engine.status!=='won')return;
    if(active>=tutorialCount){
      if(played){
        const result=economyManager.complete(saved.economy,{levelId:activeLevel.id,attemptId:activeAttempt?.attemptId,status:'won',verified:true,assisted:engine.assisted===true,tutorial:false});
        saved.economy=result.state;
        if(result.applied)lastEconomyReward={...result.reward,attemptId:activeAttempt.attemptId};
      }
      syncCompletedCampaign();
    }else if(!saved.done.includes(active)){saved.done.push(active);saved.done.sort((a,b)=>a-b);}
    recordWin(active,engine,played);
  }
  function loadLevel(index,fresh=false,{activate=false}={}) {
    if(activate&&!campaignEntryAllowed(index))return false;
    clearScoreReceipt();cancelAssistance();
    cancelPresentation();cancelHint();epoch++;clearTimeout(terminalTimer);stopPointer();busy=false;
    active=canOpen(index)?index:nextCampaignIndex()??0;lastEconomyReward=null;activeLevel=levels[active];activeAttempt=null;attemptPending=true;saveBlocked=false;loadIssue=null;
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
  // Geometry and markup are pure: the host supplies all current view state.
  function geometry() {
    if (!geometryCache.has(active)) geometryCache.set(active, window.HexBoardView.geometry(activeLevel, isTutorial()));
    return geometryCache.get(active);
  }
  function boardMarkup(state, matching = [], falling = []) {
    const layout = geometry(), { width, height } = layout;
    $('board').setAttribute('viewBox', `${-width/2} ${-height/2} ${width} ${height}`);
    return window.HexBoardView.markup(activeLevel, state, layout, {
      matching, falling, busy, feedback: !!guideFeedback(), status: engine.status,
      guided: guidedStep(), selected, hinted, focusIndex,
      selectedNeighbors: selected === null ? [] : engine.neighbors[selected]
    });
  }
  function render(state=null,options={}) {
    clearInvalidSwap();
    const display=state||{values:engine.values,layers:engine.layers,score:engine.score,movesLeft:engine.movesLeft};
    const focused=document.activeElement?.closest?.('[data-index]')?.dataset.index;
    $('board').innerHTML=boardMarkup(display,options.matching||[],options.falling||[]);
    if(focused!==undefined)$('board').querySelector(`[data-index="${focused}"]`)?.focus?.({preventScroll:true});
    const covered=display.layers.filter(n=>n===0).length,total=activeLevel.cells.length;
    renderScore(presentation?.scoreDisplay??display.score);
    $('moves-left').textContent=display.movesLeft;
    $('moves-left').closest('.moves-badge')?.classList.toggle('low',display.movesLeft<=3);
    $('move-counter').textContent=`${engine.turn} / ${activeLevel.moves+(engine.bonusMoves||0)} HAMLE`;
    $('coverage').textContent=`${covered} / ${total}`;
    $('coverage-ring').style.strokeDashoffset=String(87.965*(1-covered/total));
    $('hint').disabled=busy||!!hintJob||!!guideFeedback()||engine.status!=='playing';
    $('hint').querySelector('span').textContent=hintJob?'Aranıyor…':'İpucu';
    $('reset').disabled=false;
    $('open-inventory').hidden=isTutorial();$('open-inventory').disabled=busy||engine.status!=='playing'||attemptPending||saveBlocked;
    $('skip-animation').hidden=true; // Permanent animation-skip control is intentionally hidden; board remains full-size.
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
    renderCoach();syncPlaytestActivity();
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
  // Presentation modules cannot mutate authoritative game/profile state.
  const scorePresentation=window.HexScorePresentation.create({
    window,document,motion,getPresentation:()=>presentation,geometry,renderScore,
    pause,animateElement,canAnimate:()=>canAnimate(),rewardForWave,rewardHeadline,
    rewardLabel,rewardFeedback,rewardMilestones
  });
  function scoreEquation(frame){return scorePresentation.scoreEquation(frame);}
  function clearScoreReceipt(){return scorePresentation.clearScoreReceipt();}
  function flyScore(job,frame,options){return scorePresentation.flyScore(job,frame,options);}
  const canAnimate=()=>!document.hidden&&!reduceMotion()&&typeof window.Element.prototype.animate==='function';
  function cancelPresentation() {
    clearInvalidSwap();
    const job=presentation;presentation=null;busy=false;
    if(job){clearTimeout(job.watchdog);job.controller.abort();job.swapVisual?.cleanup();for(const a of job.animations)try{a.cancel?.();}catch(_){}for(const node of job.rewardNodes||[])node.classList.remove('reward-goal-hit');clearScoreReceipt();}
  }
  function finishPresentation(job) {
    if(!job||presentation!==job||job.token!==epoch)return;
    cancelPresentation();
    const result=job.result;
    comboText=job.assistanceItem==='greenBrush'?'Zeminden bir kat azaldı.':job.assistanceItem&&result.scoreGain===0?'Taşın sayısı değişti.':`+${result.scoreGain} puan${result.frames.length>1?` · ${result.frames.length} zincir`:''}`;
    const deferred=job.rewardPlan?.headline;if(deferred&&!deferred.completion&&!job.rewardHeadlineUsed){comboText=rewardLabel(deferred)+' · '+comboText;job.rewardHeadlineUsed=true;}
    if(result.reshuffled)comboText+=' · Karıştırıldı';
    try{renderLevels();render();persist();}
    catch(_){persist();}
    finally{
      busy=false;$('board').setAttribute('aria-busy','false');$('board-stage').classList.remove('busy');$('reset').disabled=false;$('skip-animation').hidden=true;
    }
    const receipt=$('score-receipt');if(receipt)receipt.textContent=result.scoreGain?`+${result.scoreGain}`:'';
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
  // Only temporary gems live above the board. Floors and match effects retain
  // their own positions, while every visual owner removes only its own nodes.
  function swapVisual(job,a,b,kind='valid'){
    const board=$('board'),layer=board.querySelector('.swap-layer'),positions=geometry().positions;
    if(!layer)throw new Error('Swap drawing layer unavailable');
    const group=svgNode('g',{class:'swap-pair','data-swap-kind':kind}),sources=[],stones=[];
    let removed=false;
    const cleanup=()=>{
      if(removed)return;removed=true;group.remove();
      for(const {node,visibility,priority}of sources){if(visibility)node.style.setProperty('visibility',visibility,priority);else node.style.removeProperty('visibility');}
      job.controller.signal.removeEventListener('abort',cleanup);
    };
    const visual={stones,cleanup};job.swapVisual=visual;
    job.controller.signal.addEventListener('abort',cleanup,{once:true});
    try{
      layer.appendChild(group);
      for(const [from,to]of[[a,b],[b,a]]){
        const original=board.querySelector(`[data-index="${from}"] .gem`);
        if(!original)throw new Error('Swap gem unavailable');
        const copy=original.cloneNode(true),position=positions[from],value=original.querySelector('.hex-number')?.textContent||'';
        const wrapper=svgNode('g',{class:'swap-stone','data-swap-source':from,'data-swap-target':to,'data-swap-value':value,'data-swap-kind':kind,transform:`translate(${position.x},${position.y})`});
        // Freeze actual paint, including number ink, before leaving the tile's
        // inherited CSS-variable scope. WebKit must not resolve a new palette.
        const paint=['fill','stroke','stroke-width','opacity','font-family','font-size','font-weight','text-anchor','dominant-baseline'];
        const originals=[original,...original.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
        originals.forEach((node,index)=>{const style=window.getComputedStyle(node);for(const property of paint){const value=style.getPropertyValue(property);if(value)copies[index].style.setProperty(property,value);}});
        const style=window.getComputedStyle(original);
        for(const property of ['--gem','--gem-edge','--gem-back','--number']){const value=style.getPropertyValue(property);if(value)wrapper.style.setProperty(property,value);}
        copy.style.removeProperty('transform');copy.style.removeProperty('visibility');
        wrapper.appendChild(copy);group.appendChild(wrapper);stones.push(copy);
        sources.push({node:original,visibility:original.style.getPropertyValue('visibility'),priority:original.style.getPropertyPriority('visibility')});
        original.style.visibility='hidden';
      }
      return visual;
    }catch(error){cleanup();throw error;}
  }
  function swapPaths(a, b) { return window.HexBoardView.swapPaths(geometry(), a, b); }
  function clearInvalidSwap(){
    const job=invalidPresentation;invalidPresentation=null;if(!job)return;
    clearTimeout(job.timer);job.controller.abort();job.swapVisual?.cleanup();
    for(const animation of job.animations)try{animation.cancel?.();}catch(_){}
  }
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
    if(job.assistanceItem){
      render({...before,values:job.result.frames[0]?.before||engine.values},{message:'Güçlendiricin uygulanıyor.'});
      const stone=$('board').querySelector(`[data-index="${job.assistanceIndex}"] ${job.assistanceItem==='greenBrush'?'.floor-shape':'.gem'}`);
      animateElement(job,stone,[{opacity:.7},{opacity:1}],{duration:180,easing:'ease-out'});await pause(180,job);
    }else{
    render(before,{message:'Taşlar yer değiştiriyor…'});
    const visual=swapVisual(job,a,b),paths=swapPaths(a,b);
    try{
      visual.stones.forEach((node,index)=>animateElement(job,node,paths[index],{duration:motion.swap,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'}));
      await pause(motion.swap+5,job);
    }finally{visual.cleanup();}
    }
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
    clearInvalidSwap();
    if(!canAnimate())return;
    const job={controller:new AbortController(),animations:[],timer:null};invalidPresentation=job;
    try{
      const visual=swapVisual(job,a,b,'invalid'),positions=geometry().positions;
      for(const [index,[from,to]]of[[a,b],[b,a]].entries()){
        const dx=(positions[to].x-positions[from].x)*.25,dy=(positions[to].y-positions[from].y)*.25;
        animateElement(job,visual.stones[index],[{transform:'translate(0px,0px)'},{transform:`translate(${dx}px,${dy}px)`,offset:.4},{transform:'translate(0px,0px)'}],{duration:motion.invalid,easing:'ease-out',fill:'both'});
      }
      job.timer=setTimeout(()=>{if(invalidPresentation===job)clearInvalidSwap();},motion.invalid+5);
    }catch(_){clearInvalidSwap();}
  }
  async function performSwap(a,b) {
    if(!gameInputAllowed()||guideFeedback())return;
    if(assistanceMode){chooseAssistanceTarget(a);return;}
    if(busy){finishPresentation(presentation);return;}
    if(engine.status!=='playing')return;
    const guide=guidedStep();
    if(guide&&!samePair(a,b,guide.pair)){selected=null;hinted=guide.pair;render();toast('Bu adımda parlayan iki taşı değiştir. Hamlen harcanmadı.');return;}
    clearScoreReceipt();cancelHint();clearInvalidSwap();
    const checkpoint=engine.snapshot(),before={values:engine.values.slice(),layers:engine.layers.slice(),score:engine.score,movesLeft:engine.movesLeft};
    let result;
    try{result=engine.swap(a,b);}catch(_){
      try{engine=checkpoint.rulesVersion==='assisted-v1'?new window.HexAssistedGame(activeLevel,{attemptId:activeAttempt.attemptId,limits:assistanceLimits()},checkpoint):new window.HexMatch(activeLevel,checkpoint);}catch(_){saveBlocked=true;}
      selected=null;render();toast('Bu hamle tamamlanamadı. Tahta geri yüklendi; tekrar deneyebilirsin.');return;
    }
    if(!result.ok){
      selected=null;hinted=null;render();
      invalidSwap(a,b);
      toast(engine.adjacent(a,b)?'Üçlü oluşmadı. Hamlen duruyor.':'Sadece komşu iki taşı değiştirebilirsin.');
      return;
    }
    if(playtest&&activeAttempt)try{playtest.recordMove({attemptId:activeAttempt.attemptId,turn:engine.turn,pair:[a,b],cells:[a,b].map(index=>({q:activeLevel.cells[index].q,r:activeLevel.cells[index].r})),scoreBefore:before.score,scoreAfter:engine.score,movesRemaining:engine.movesLeft,coveredBefore:before.layers.filter(value=>value===0).length,coveredAfter:engine.covered,remainingLayers:engine.remainingLayers,waves:result.frames.length,developerBypass:!!lifeFeature?.life?.developerBypass,matchedIndices:[...new Set(result.frames.flatMap(frame=>frame.matched))]});persistPlaytest();}catch(_){}
    const stats=activeStats();if(stats)stats.cascades=validCounter(stats.cascades)+Math.max(0,result.frames.length-1);
    const rewardPlan=planRewards(checkpoint,result);
    const job={token:++epoch,result,controller:new AbortController(),animations:[],watchdog:null,scoreDisplay:before.score,scoreTasks:[],rewardPlan,rewardCueIds:new Set(),rewardMilestoneIds:new Set(),rewardNodes:new Set(),rewardHeadlineUsed:false};
    presentation=job;busy=true;selected=null;hinted=null;comboText='';syncPlaytestActivity();
    try{
      markCompleted(true);persist();settleActiveLife();terminalEvent();
      // Commit the board, life settlement and permanent reward together before feedback.
      if(!commitSession())return;
      job.committed=true;renderLevels();if(engine.status==='won')updateMenus();
      if(!rewardPlan&&saved.preferences.haptics&&typeof navigator.vibrate==='function')try{navigator.vibrate(12);}catch(_){}
      if(rewardPlan&&!canAnimate()&&!rewardPlan.headline?.completion){
        const cue=rewardPlan.headline||rewardPlan.waves.reduce((best,next)=>!best||next.tier>best.tier?next:best,null);rewardFeedback(job,cue);
      }
      job.watchdog=setTimeout(()=>finishPresentation(job),motion.budget);
      await presentSwap(job,a,b,before);
    }catch(_){if(!job.committed){sessionDirty=false;restoreDurable();toast('Hamle kaydedilemedi. Son güvenli tahtan korundu.');}}
    finally{finishPresentation(job);}
  }
  function select(index) {
    if(!gameInputAllowed()||guideFeedback())return;
    if(assistanceMode){chooseAssistanceTarget(index);return;}
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
    $('win-total').textContent=engine.score;$('win-moves').textContent=engine.movesLeft;$('win-assisted').hidden=learning||!engine.assisted;
    const nextText=economyView()?.campaignComplete?'Bahçeni gör':active===0?'İkinci öğreticiye geç':active===1?'İlk bölüme başla':`Bölüm ${pad(active-tutorialCount+2)} ile devam et`;
    $('next').innerHTML=`${nextText} ${icon('arrow')}`;
    const grant=lastEconomyReward?.attemptId===activeAttempt?.attemptId?lastEconomyReward:null;
    $('win-rewards').hidden=learning||!grant;
    $('win-gold').textContent=`+${grant?.gold||0} Altın`;$('win-star').textContent=`+${grant?.stars||0} yıldız`;
    const gifts=[];if(grant?.inventory?.greenBrush)gifts.push(`+${grant.inventory.greenBrush} Yeşil Fırça`);if(grant?.inventory?.colorKey)gifts.push(`+${grant.inventory.colorKey} Renk Anahtarı`);
    $('win-inventory').hidden=!gifts.length;$('win-inventory').textContent=gifts.join(' · ');renderEconomy();
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
    $('lose-coverage').textContent=`${engine.covered} / ${activeLevel.cells.length}`;renderRescue();
    openModal('lose-dialog');
  }
  function showResult() {if(engine.status==='won')showVictory();else if(engine.status==='lost')showLoss();}
  function restart(index=active) {
    if(!Number.isInteger(index))index=active;
    if(!campaignEntryAllowed(index))return;
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
    cancelAssistance();
    const guide=guidedStep();if(guide){selected=null;hinted=guide.pair;hintEvent({kind:'guided',guarantee:'guided'},'guided');render();toast(guide.text);return;}
    const job={token:epoch,game:engine,worker:null,timer:null,resolve:null};hintJob=job;render();
    let suggestion=null;
    try{
      if(typeof window.Worker==='function'&&!engine.assisted){
        suggestion=await new Promise(resolve=>{
          job.resolve=resolve;
          try{
            job.worker=new Worker('./hint-worker.js?v=31');
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
  // Recognition uses the complete gesture, independently from match validation.
  // Coordinates stay in the board's SVG space; thresholds stay in screen pixels.
  function boardPoint(e,inverse=null){
    try{
      const board=$('board'),matrix=inverse||board.getScreenCTM?.()?.inverse();if(!matrix)return null;
      const point=board.createSVGPoint();point.x=e.clientX;point.y=e.clientY;
      const local=point.matrixTransform(matrix);return Number.isFinite(local.x)&&Number.isFinite(local.y)?local:null;
    }catch(_){return null;}
  }
  function tileAt(e){
    const node=document.elementFromPoint?.(e.clientX,e.clientY)||e.target;
    const tile=node?.closest?.('[data-index]');
    if(tile&&$('board').contains(tile))return +tile.dataset.index;
    const local=boardPoint(e);if(!local)return null;
    return window.HexBoardInput.hitTest(local, geometry(), $('board').getScreenCTM());
  }
  function samplePointer(e) {
    if (!pointer) return;
    const local = pointer.local ? boardPoint(e, pointer.inverse) : null;
    window.HexBoardInput.sample(pointer, e, local, { width: window.innerWidth, height: window.innerHeight });
  }
  function outsideViewport(e) {
    return window.HexBoardInput.outsideViewport(e, { width: window.innerWidth, height: window.innerHeight });
  }
  on($('board'),'pointerdown',e=>{
    if(pointer&&pointer.id!==e.pointerId){stopPointer();return;}
    if(!gameInputAllowed()||guideFeedback()||e.isPrimary===false||(e.button!==0&&e.pointerType!=='touch'))return;
    if(busy){e.preventDefault();finishPresentation(presentation);return;}
    if(engine.status!=='playing'||pointer||outsideViewport(e))return;
    const downTile=e.target.closest?.('[data-index]');
    const index=downTile&&$('board').contains(downTile)?+downTile.dataset.index:tileAt(e);if(index===null)return;
    if(assistanceMode){e.preventDefault();select(index);return;}
    const matrix=$('board').getScreenCTM?.(),local=boardPoint(e),positions=geometry().positions,from=positions[index];
    let inverse=null;try{inverse=matrix?.inverse();}catch(_){}
    const neighbors=local&&matrix?engine.neighbors[index].map(index=>{
      const dx=positions[index].x-from.x,dy=positions[index].y-from.y;
      return {index,dx,dy,distance:Math.hypot(dx,dy),screenDistance:Math.hypot(matrix.a*dx+matrix.c*dy,matrix.b*dx+matrix.d*dy)};
    }).filter(neighbor=>neighbor.screenDistance>0):[];
    e.preventDefault();pointer={id:e.pointerId,index,x:e.clientX,y:e.clientY,local,inverse,neighbors,target:null,maxDistance:0,conflicted:false,invalid:false,epoch,game:engine};
    try{$('board').setPointerCapture?.(e.pointerId);}catch(_){}
  });
  // A second contact anywhere cancels rather than committing a half-finished pinch.
  window.addEventListener('pointerdown',e=>{if(pointer&&e.pointerType==='touch'&&e.pointerId!==pointer.id)stopPointer();});
  on(window,'pointermove',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    if(e.pointerType!=='touch'&&e.buttons===0){stopPointer();return;}
    const samples=e.getCoalescedEvents?.()||[];for(const sample of samples)samplePointer(sample);samplePointer(e);
  });
  on(window,'pointerup',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    samplePointer(e);const gesture=pointer,target=tileAt(e);stopPointer();
    if(outsideViewport(e)||gesture.invalid||gesture.conflicted||gesture.epoch!==epoch||gesture.game!==engine||!gameInputAllowed()||busy)return;
    if(gesture.local){
      if(gesture.target!==null)performSwap(gesture.index,gesture.target);
      else if(gesture.maxDistance<12&&target===gesture.index)select(gesture.index);
      return;
    }
    // Non-rendering hosts may lack SVG matrices; endpoint taps remain available.
    if(target===null)return;
    if(target===gesture.index)select(target);
    else if(gesture.maxDistance>=6)performSwap(gesture.index,target);
    else select(target);
  });
  const cancelPointer=e=>{if(pointer&&(e.pointerId===undefined||e.pointerId===pointer.id))stopPointer();};
  on($('board'),'lostpointercapture',cancelPointer);
  on(window,'pointercancel',cancelPointer);
  on(window,'blur',()=>{cancelAssistance();stopPointer();if(presentation)finishPresentation(presentation);pauseGame();});
  on(document,'visibilitychange',()=>{if(document.hidden)cancelAssistance();stopPointer();if(document.hidden){if(presentation)finishPresentation(presentation);pauseGame();}syncAudio();});
  on(window,'pagehide',()=>{cancelAssistance();stopPointer();clearInvalidSwap();if(presentation)finishPresentation(presentation);});
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
  on($('open-inventory'),'click',()=>{if(!inventoryPlayable())return;renderInventory();openModal('inventory-dialog');});
  on($('use-green-brush'),'click',()=>beginAssistance('greenBrush'));on($('use-color-key'),'click',()=>beginAssistance('colorKey'));
  on($('buy-green-brush'),'click',()=>purchaseInventory('greenBrush'));on($('buy-color-key'),'click',()=>purchaseInventory('colorKey'));
  on($('assistance-value'),'change',updateAssistancePreview);on($('assistance-confirm'),'click',confirmAssistance);
  on($('assistance-target-cancel'),'click',()=>{cancelAssistance();render();});
  on($('tutorial-replay'),'click',()=>enterGame(0,{fresh:true}));
  on($('skip-animation'),'click',()=>finishPresentation(presentation));
  on($('reset'),'click',restart);on($('retry'),'click',restart);on($('hint'),'click',hint);
  on($('help'),'click',()=>openModal('help-dialog'));
  on($('sound'),'click',()=>{saved.sound=!saved.sound;renderSound();persist();unlockAudio();if(saved.sound)tone(3);});
  on($('continue'),'click',showResult);
  on($('next'),'click',()=>{closeModal($('win-dialog'));if(economyView()?.campaignComplete){showScreen('garden');return;}if(active<tutorialCount-1)enterGame(active+1,{fresh:true});else {const next=nextCampaignIndex();if(next!==null)requestStage(next);}});
  on($('review'),'click',()=>closeModal($('win-dialog')));
  on(document,'click',event=>{
    const nav=event.target.closest('[data-nav]');if(nav){event.preventDefault();showScreen(nav.dataset.nav);return;}
    if(event.target.closest('[data-settings]')){event.preventDefault();openSettings();return;}
    const stage=event.target.closest('[data-stage]');if(stage&&!stage.disabled)requestStage(+stage.dataset.stage);
  });
  on($('home-play'),'click',()=>{unlockAudio();const next=nextStage();if(!next)showScreen('garden');else if(next.rescue)resumeSecondChance(next.index);else if(next.resume)enterGame(next.index);else requestStage(next.index);});
  on($('home-teach'),'click',()=>enterGame(0,{fresh:true}));
  on($('help-teach'),'click',()=>enterGame(0,{fresh:true}));
  on($('settings'),'click',event=>{event.stopPropagation();openSettings();});
  on($('pause'),'click',pauseGame);
  on($('pregame-start'),'click',()=>{const index=pendingStage;if(index===null)return;const checkpoint=validCheckpoint(index);if(recoverableLoss(index)){resumeSecondChance(index);return;}if(saved.boards[index]&&!checkpoint&&variantCatalog){restart(index);return;}enterGame(index,{fresh:checkpoint?.status!=='playing'||lifeDiscarded(index),reason:checkpoint?'replay':'stage_entry'});});
  on($('pregame-restart'),'click',()=>{const index=pendingStage;if(index!==null)restart(index);});
  on($('restart-confirm'),'click',()=>{
    const request=pendingRestart;if(!request||!campaignEntryAllowed(request.index))return;lifeRefresh({persist:true});
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
  on($('setting-motion'),'change',event=>{saved.preferences.motion=event.target.value;clearInvalidSwap();if(presentation)finishPresentation(presentation);savePreferences();});
  on($('setting-volume'),'input',event=>{saved.preferences.volume=Math.max(0,Math.min(1,Number(event.target.value)/100));$('volume-value').textContent=`%${Math.round(saved.preferences.volume*100)}`;savePreferences();});
  on($('setting-haptics'),'change',event=>{saved.preferences.haptics=event.target.checked;savePreferences();if(saved.preferences.haptics&&typeof navigator.vibrate==='function')try{navigator.vibrate(12);}catch(_){} });
  on($('settings-reset'),'click',()=>{
    if(pendingRescueReceipt){showRescueProvider(pendingRescueReceipt.receipt.transactionId);return;}
    lifeRefresh({persist:true});const entries=levels.map((_,index)=>campaignCleared(index)?null:stageEntry(index)),cost=discardCost(entries);pendingResetLifeCost=cost;
    if($('reset-description'))$('reset-description').textContent=`Açık denemelerin silinecek. Tamamlanan bölümler, Altın, yıldızlar ve envanter korunur.${cost?` Oynanmış açık denemeleri silmek ${cost} can harcar.`:''} Canların yeniden doldurulmaz. Test Altının ve işlem kayıtların korunur.`;
    openModal('reset-dialog');
  });
  on($('reset-confirm'),'click',()=>{
    if(pendingRescueReceipt){showRescueProvider(pendingRescueReceipt.receipt.transactionId);return;}
    lifeRefresh({persist:true});
    if(!lifeReady()){toast('Can verisi açılamadı. İlerlemen korundu.');return;}
    const currentResetCost=discardCost(levels.map((_,index)=>campaignCleared(index)?null:stageEntry(index)));
    if(pendingResetLifeCost===null||currentResetCost>pendingResetLifeCost){pendingResetLifeCost=currentResetCost;if($('reset-description'))$('reset-description').textContent=`Koşullar değişti. Açık denemelerin silinecek ve ${currentResetCost} can harcanacak. Tamamlanan bölümler ve ödüllerin korunur. Canların yeniden doldurulmaz; Test Altının ve işlem kayıtların korunur.`;toast('Can koşulları değişti. Yeni bilgiyi kontrol edip tekrar onayla.');return;}
    const lifeReset=lifeClone(lifeFeature);let actualResetCost=0;
    for(let index=0;index<levels.length;index++){if(campaignCleared(index))continue;const entry=stageEntry(index);if(entry?.game.status==='playing'){
      const result=lifeManager.settleAttempt(lifeReset.life,lifeContext(entry,'restart'));
      if(['invalid','unavailable','ledger_full'].includes(result.reason)){toast('Can işlemi tamamlanamadı. İlerlemen korundu.');return;}
      lifeReset.life=result.state;if(result.charged)actualResetCost++;
    }}
    if(actualResetCost>pendingResetLifeCost){pendingResetLifeCost=actualResetCost;if($('reset-description'))$('reset-description').textContent=`Koşullar değişti. Açık denemelerin silinecek ve ${actualResetCost} can harcanacak. Tamamlanan bölümler ve ödüllerin korunur. Canların yeniden doldurulmaz; Test Altının ve işlem kayıtların korunur.`;toast('Can koşulları değişti. Yeni bilgiyi kontrol edip tekrar onayla.');return;}
    if(!lifeCommit(lifeReset))return;
    for(let index=0;index<levels.length;index++){if(campaignCleared(index))continue;discardStage(index,'progress_reset');delete saved.boards[index];delete saved.attempts[index];delete saved.attemptStats[index];delete saved.records[index];}
    cancelPresentation();cancelHint();closeAllDialogs();saved.done=saved.done.filter(index=>campaignCleared(index));saved.guideAcks=[];saved.current=nextCampaignIndex()??0;active=saved.current;engine=null;activeAttempt=null;attemptPending=true;loadLevel(active);showScreen('home',{replace:true});toast('Açık denemeler silindi. Tamamlanan bölümlerin ve bütün ödüllerin korundu.');
  });
  on(window,'popstate',event=>{
    if(topDialog()){closeModal(topDialog());try{history.pushState({screen},'','#'+screen);}catch(_){}return;}
    const next=event.state?.screen||location.hash.slice(1)||'home';showScreen(next,{historyChange:false});
  });
  on(window,'keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||event.repeat)return;
    if(event.key==='Escape'){
      if(assistanceMode&&!topDialog()){event.preventDefault();cancelAssistance();return;}
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
  motionQuery?.addEventListener?.('change',()=>{if(saved.preferences.motion==='auto'){if(reduceMotion()){clearInvalidSwap();if(presentation)finishPresentation(presentation);}syncAudio();}});
  function bindPlaytest(){
    if(!playtest)return;
    const toggle=$('setting-playtest');if(toggle){toggle.checked=playtest.snapshot().enabled;toggle.addEventListener('change',()=>{playtest.setEnabled(toggle.checked);syncPlaytestActivity();persistPlaytest();toast(toggle.checked?'Yerel oyuncu testi kaydı açık. Veri gönderilmez.':'Yerel oyuncu testi kaydı kapalı.');});}
    $('playtest-export')?.addEventListener('click',()=>{const json=JSON.stringify(playtest.exportData(),null,2),blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='hexrota-playtest.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    $('playtest-clear')?.addEventListener('click',()=>{playtest.clear();persistPlaytest();toast('Yalnızca oyuncu testi kaydı temizlendi.');});
    window.addEventListener('blur',()=>{playtest.setActivity({playing:false,attemptId:activeAttempt?.attemptId||null});persistPlaytest();});
    window.addEventListener('focus',syncPlaytestActivity);
    document.addEventListener('visibilitychange',()=>{syncPlaytestActivity();persistPlaytest();});
    window.addEventListener('pagehide',()=>{playtest.setActivity({playing:false,attemptId:activeAttempt?.attemptId||null});persistPlaytest();});
  }
  sessionAction(()=>{try{initializeRescue();initializeEconomy();}catch(error){economyIssue='invalid';throw error;}initializeLives();bindLivesUI();bindRescueUI();hydrateRecords();renderSound();loadLevel(active);showScreen('home',{replace:true});bindPlaytest();});
  if(migrated)toast('İlerlemen korundu. Öğreticileri yolculuk menüsünden yeniden oynayabilirsin.');
});
