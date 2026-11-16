/* Prepared world/actor presentation. The host supplies committed progress and
 * view facts; visual callbacks have no authority over a player's results. */
(function(root){
 'use strict';
 const ids=['clearing','frame','roof','finished'],thresholds=[0,2,5,10];
 const own=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
 const integer=value=>Number.isSafeInteger(value)&&value>=0;
 function validateConfig(config){
  const need=condition=>{if(!condition)throw new TypeError('invalid_scene_config');};
  need(own(config,['schemaVersion','id','assetBase','fallbackPortrait','stages','transitionMs','actor','copy','futureStory']));
  need(config.schemaVersion===1&&config.id==='coop-scene-phase1'&&config.assetBase==='./assets/scenes/coop-v1/'&&config.fallbackPortrait==='./assets/characters/tavik/front.webp');
  need(Array.isArray(config.stages)&&config.stages.length===4&&config.stages.every((stage,index)=>own(stage,['id','minStars','background','mobileBackground'])&&stage.id===ids[index]&&stage.minStars===thresholds[index]&&stage.background==='backgrounds/'+ids[index]+'.webp'&&stage.mobileBackground==='backgrounds/'+ids[index]+'-mobile.webp'));
  need(integer(config.transitionMs)&&config.transitionMs<=500&&own(config.actor,['homeSize','gameMaxSize','gameMinSize','clearance']));
  need(integer(config.actor.homeSize)&&config.actor.homeSize>=80&&config.actor.homeSize<=240&&integer(config.actor.gameMaxSize)&&config.actor.gameMaxSize<=140&&integer(config.actor.gameMinSize)&&config.actor.gameMinSize>=64&&config.actor.gameMinSize<=config.actor.gameMaxSize&&integer(config.actor.clearance)&&config.actor.clearance>=4&&config.actor.clearance<=24);
  need(own(config.copy,['intro'])&&typeof config.copy.intro==='string'&&config.copy.intro.length>0&&config.copy.intro.length<=80&&own(config.futureStory,['enabled','hooks'])&&config.futureStory.enabled===false&&Array.isArray(config.futureStory.hooks)&&config.futureStory.hooks.length===0);return true;
 }
 function stageForStars(config,stars){validateConfig(config);if(!integer(stars))throw new TypeError('invalid_scene_stars');return config.stages.reduce((chosen,stage)=>stars>=stage.minStars?stage:chosen,config.stages[0]).id;}
 function create(options){
  const opts=options||{},doc=opts.document||root.document,win=opts.window||doc?.defaultView||root,config=JSON.parse(JSON.stringify(opts.config||root.HEX_SCENE_CONFIG));
  validateConfig(config);if(!doc?.body||!opts.homeHost||!opts.gameHost)throw new TypeError('Scene requires DOM hosts');
  const board=opts.board||doc.getElementById('board'),homeHost=opts.homeHost,gameHost=opts.gameHost;
  let disposed=false,active=false,generation=0,backgroundEpoch=0,poseEpoch=0,world=null,background=null,shade=null,anchor=null,facing=null,speech=null,actor=null,fallback=null;
  let view=null,mode=null,stage=null,loadedStage=null,backgroundKey=null,backgroundReady=false,actorReady=false,fallbackReady=false,pose=null,desiredPose=null,layout=null,face='right',frame=null,fadeTimer=null,fadeResolve=null,reactionTimer=null,reaction=null,listeners=[];
  const seenReactions=new Set(),failedImages=new Set();
  const reactions={match:'celebrate',invalid:'think',win:'celebrate',loss:'worried',build:'build',celebrate:'celebrate',worried:'worried',hop:'hop'};
  const rect=node=>{if(!node||node.hidden)return null;const r=node.getBoundingClientRect();return r&&Number.isFinite(r.left)&&Number.isFinite(r.top)&&r.width>0&&r.height>0?{left:r.left,top:r.top,right:r.right??r.left+r.width,bottom:r.bottom??r.top+r.height,width:r.width,height:r.height}:null;};
  const overlap=(a,b,gap=0)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
  const box=(left,top,size)=>({left,top,right:left+size,bottom:top+size,width:size,height:size});
  const paused=()=>!!(view&&(view.paused||view.hidden||view.modalOpen||doc.hidden));
  const reduced=()=>!!view?.reducedMotion;
  function report(error){try{opts.onError?.(error);}catch(_){}}
  function setBody(name,value){doc.body.dataset[name]=String(value);}
  function cancelFade(){if(fadeTimer!==null)win.clearTimeout(fadeTimer);fadeTimer=null;const resolve=fadeResolve;fadeResolve=null;resolve?.();if(shade)shade.dataset.dark='false';}
  function waitFade(ms){return new Promise(resolve=>{fadeResolve=resolve;fadeTimer=win.setTimeout(()=>{fadeTimer=null;fadeResolve=null;resolve();},ms);});}
  function clearReaction(){if(reactionTimer!==null)win.clearTimeout(reactionTimer);reactionTimer=null;reaction=null;}
  function decode(src){const image=new win.Image();image.src=src;return (typeof image.decode==='function'?image.decode():new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;})).then(()=>image);}
  function valid(token){return !disposed&&active&&generation===token;}
  function effectivePose(){if(reaction)return reaction;return mode==='opening'?'inspect':view?.status==='lost'?'worried':view?.status==='won'?'proud':mode==='game'&&view?.lessonPair?.length===2&&!view?.feedback&&!view?.busy?'point':'idle';}
  function motionPolicy(){if(paused())cancelFade();if(actor){actor.pause(paused());actor.setReducedMotion(reduced()||layout?.kind==='dock');}setBody('scenePaused',paused());}
  function updatePose(){
   if(!actor||!actorReady||!active)return;const next=effectivePose();if(next===desiredPose){motionPolicy();return;}
   desiredPose=next;const token=++poseEpoch,life=generation,current=actor;
   Promise.resolve().then(()=>{if(!valid(life)||token!==poseEpoch||actor!==current)return false;return current.play(next);}).then(ok=>{
    if(!valid(life)||token!==poseEpoch||actor!==current)return;
    if(!ok){if(reaction===next){reaction=null;if(effectivePose()!==next){desiredPose=null;updatePose();}}return;}
    pose=next;motionPolicy();
    if(reaction===next&&!paused()){
     const duration=Number((win.HexTavikMotion||root.HexTavikMotion)?.clips?.[next]?.[1])||1600;
     reactionTimer=win.setTimeout(()=>{reactionTimer=null;if(valid(life)&&token===poseEpoch){reaction=null;desiredPose=null;updatePose();}},Math.min(2600,duration+120));
    }
   }).catch(report);
  }
  function reparent(host){if(anchor&&anchor.parentNode!==host)host.appendChild(anchor);}
  function place(host,target,kind){
   const hostRect=rect(host);if(!hostRect)return false;reparent(host);layout={kind,left:target.left,top:target.top,width:target.width,height:target.height};
   anchor.style.left=(target.left-hostRect.left)+'px';anchor.style.top=(target.top-hostRect.top)+'px';anchor.style.setProperty('--tavik-size',target.width+'px');anchor.style.width=target.width+'px';anchor.style.height=target.height+'px';anchor.dataset.layout=kind;anchor.dataset.placement=kind;anchor.hidden=false;delete anchor.dataset.hiddenReason;
   let targetX=(win.innerWidth||hostRect.right)/2;
   const targets=(view?.lessonPair||[]).map(index=>rect(board?.querySelector(`[data-index="${index}"]`))).filter(Boolean);
   if(targets.length)targetX=targets.reduce((sum,r)=>sum+(r.left+r.right)/2,0)/targets.length;
   face=targetX<(target.left+target.width/2)?'left':'right';anchor.dataset.face=face;motionPolicy();return true;
  }
  function hideActor(reason){if(!anchor)return;anchor.hidden=true;anchor.dataset.layout='hidden';anchor.dataset.hiddenReason=reason;layout=null;motionPolicy();}
  function layoutHome(){
   if(!actorReady){hideActor('fallback');return;}
   const portrait=rect(homeHost.querySelector('.tavik-portrait'))||rect(doc.querySelector('#home-screen .tavik-portrait')),hostRect=rect(homeHost);
   if(!portrait||!hostRect){hideActor('nospace');return;}
   const first=mode==='opening',header=rect(doc.querySelector('.site-header')),headerBottom=header?.bottom||0,gap=10;
   let speechWidth=0,speechHeight=0;
   if(first){
    // Compact and landscape CSS change padding/font metrics. Measure the real
    // bubble without painting it rather than reserving a desktop-sized box.
    speech.style.width=Math.min(240,Math.max(160,(win.innerWidth||320)-36))+'px';speech.style.left='0px';speech.style.top='0px';speech.style.visibility='hidden';speech.hidden=false;
    const measured=rect(speech);speechWidth=measured?.width||Math.min(240,(win.innerWidth||320)-24);speechHeight=measured?.height||62;speech.hidden=true;speech.style.removeProperty('visibility');
   }
   const available=first?Math.max(80,portrait.bottom-Math.max(portrait.top,headerBottom+speechHeight+gap)):portrait.width;
   const size=Math.min(first?config.actor.homeSize:portrait.width,portrait.height-4,available),target=box(portrait.left+(portrait.width-size)/2,portrait.bottom-size,size);
   if(!place(homeHost,target,'home')){hideActor('nospace');return;}
   speech.hidden=true;if(first){
    const blocked=[...doc.querySelectorAll('#home-title,.home-description,#home-play,.site-header')].map(rect).filter(Boolean);
    const viewportWidth=win.innerWidth||320,viewportHeight=win.innerHeight||568;
    const clampX=left=>Math.max(12,Math.min(viewportWidth-speechWidth-12,left));
    const candidates=[
     [clampX(target.left+size/2-speechWidth/2),target.top-speechHeight-gap],
     [clampX(target.left+size+gap),target.top+size/2-speechHeight/2],
     [clampX(target.left-speechWidth-gap),target.top+size/2-speechHeight/2],
     [clampX(viewportWidth/2-speechWidth/2),headerBottom+gap]
    ];
    for(const [left,top]of candidates){const candidate={left,top,right:left+speechWidth,bottom:top+speechHeight};
     if(top>=8&&candidate.bottom<=viewportHeight-8&&!overlap(candidate,target,4)&&!blocked.some(r=>overlap(candidate,r,4))){speech.style.left=(left-hostRect.left)+'px';speech.style.top=(top-hostRect.top)+'px';speech.hidden=false;break;}
    }
   }
  }
  function layoutGame(){
   const hostRect=rect(gameHost),area=rect(board?.closest('.board-wrap'))||rect(board);if(!hostRect||!area){hideActor('nospace');return;}
   const tiles=[...(board?.querySelectorAll('[data-index]')||[])].map(rect).filter(Boolean),controls=[...gameHost.querySelectorAll('.game-topbar,#tutorial-coach,.game-toolbar,#assistance-target-prompt')].map(rect).filter(Boolean),blocked=tiles.concat(controls),gap=config.actor.clearance;
   const sizes=[config.actor.gameMaxSize,96,config.actor.gameMinSize].filter((value,index,list)=>value>=config.actor.gameMinSize&&value<=config.actor.gameMaxSize&&list.indexOf(value)===index);
   for(const size of sizes){
    const choices=[[area.left+14,area.bottom-size-8],[area.right-size-14,area.bottom-size-8],[area.left+14,area.top+28],[area.right-size-14,area.top+28]];
    for(const [left,top]of choices){const target=box(left,top,size),envelope={left:left-10,top:top-24,right:left+size+10,bottom:top+size+5};
     if(envelope.left>=hostRect.left+4&&envelope.right<=hostRect.right-4&&envelope.top>=hostRect.top+4&&envelope.bottom<=hostRect.bottom-4&&!blocked.some(r=>overlap(envelope,r,gap))&&place(gameHost,target,'game'))return;
    }
   }
   // Compact teaching uses the existing empty space between Menu and Pause. A
   // static cutout here cannot jump into the board or touch controls.
   const toolbar=gameHost.querySelector('.game-toolbar'),dock=rect(toolbar);
   if((view?.lessonPair?.length||typeof view?.levelId==='string'&&/^learn-/.test(view.levelId))&&dock){
    const buttons=[...toolbar.querySelectorAll('button')].map(rect).filter(Boolean),size=Math.min(48,dock.height-8),left=dock.left+(dock.width-size)/2,top=dock.top+(dock.height-size)/2,target=box(left,top,size);
    const protectedNodes=tiles.concat(buttons,[...gameHost.querySelectorAll('.game-topbar,#tutorial-coach')].map(rect).filter(Boolean));
    if(size>=36&&!protectedNodes.some(r=>overlap(target,r,4))&&place(toolbar,target,'dock'))return;
   }
   hideActor('nospace');
  }
  function layoutNow(){frame=null;if(!active||disposed||!anchor)return;if(speech)speech.hidden=true;if(paused()){hideActor(view?.modalOpen?'modal':'paused');return;}if(!actorReady&&!fallbackReady){hideActor('loading');return;}if(mode==='game')layoutGame();else layoutHome();}
  function scheduleLayout(){if(frame!==null||!active)return;frame=win.requestAnimationFrame?win.requestAnimationFrame(layoutNow):win.setTimeout(layoutNow,0);}
  function showFallback(){
   if(!anchor||fallback||actorReady)return;const token=generation;fallback=doc.createElement('img');fallback.className='hx-scene-fallback';fallback.alt='Tavik';fallback.width=147;fallback.height=238;fallback.draggable=false;fallback.hidden=true;facing.appendChild(fallback);
   decode(config.fallbackPortrait).then(image=>{if(!valid(token)||!fallback)return;fallback.src=image.src;fallback.hidden=false;fallbackReady=true;scheduleLayout();}).catch(error=>{if(valid(token)){report(error);hideActor('asset');}});
  }
  function ensureActor(){
   const sdk=win.HexTavikMotion||root.HexTavikMotion,token=generation;if(!sdk?.mount){showFallback();return;}
   let mounted;
   try{mounted=sdk.mount(facing,{assetBase:config.assetBase,reducedMotion:reduced(),onError:report});actor=mounted;motionPolicy();}
   catch(error){report(error);showFallback();return;}
   Promise.resolve(mounted.ready).then(ok=>{
    if(!valid(token)||actor!==mounted)return;
    if(ok===false){mounted.destroy();actor=null;showFallback();return;}
    actorReady=true;pose='idle';desiredPose=null;setBody('sceneActorReady',true);motionPolicy();scheduleLayout();updatePose();
   }).catch(error=>{if(valid(token)&&actor===mounted){report(error);mounted.destroy();actor=null;showFallback();}});
  }
  async function applyBackground(image,targetStage,token,life){
   if(!valid(life)||token!==backgroundEpoch)return;
   const animate=backgroundReady&&!reduced()&&!paused()&&config.transitionMs>0;
   if(animate){shade.dataset.dark='true';await waitFade(config.transitionMs);}
   if(!valid(life)||token!==backgroundEpoch)return;
   background.src=image.src;background.hidden=false;backgroundReady=true;loadedStage=targetStage;world.dataset.fallback=String(targetStage!==stage);background.dataset.ready='true';shade.dataset.dark='false';
  }
  function requestBackground(){
   const selected=config.stages.find(entry=>entry.id===stage),mobile=(win.innerWidth||1024)<=650&&(win.innerHeight||768)>=(win.innerWidth||1024),src=config.assetBase+(mobile?selected.mobileBackground:selected.background);
   if(src===backgroundKey)return;backgroundKey=src;cancelFade();const token=++backgroundEpoch,life=generation;
   const load=failedImages.has(src)?Promise.reject(new Error('Scene image unavailable')):decode(src);
   load.then(image=>applyBackground(image,selected.id,token,life)).catch(error=>{
    if(!valid(life)||token!==backgroundEpoch)return;failedImages.add(src);report(error);backgroundReady=false;background.hidden=true;world.dataset.fallback='true';
    const safe=config.assetBase+config.stages[0].mobileBackground;
    if(src===safe||failedImages.has(safe)){loadedStage=null;return;}
    decode(safe).then(image=>applyBackground(image,'clearing',token,life)).catch(error=>{if(valid(life)&&token===backgroundEpoch){failedImages.add(safe);loadedStage=null;report(error);}});
   });
  }
  function bind(target,type,callback){target.addEventListener(type,callback);listeners.push(()=>target.removeEventListener(type,callback));}
  function mount(){
   active=true;generation++;backgroundReady=false;actorReady=false;fallbackReady=false;backgroundKey=null;loadedStage=null;pose=null;desiredPose=null;
   world=doc.createElement('div');world.className='hx-scene-world';world.setAttribute('aria-hidden','true');world.style.pointerEvents='none';
   background=doc.createElement('img');background.className='hx-scene-background';background.alt='';background.draggable=false;background.hidden=true;
   shade=doc.createElement('div');shade.className='hx-scene-transition';shade.dataset.dark='false';world.append(background,shade);doc.body.prepend(world);
   anchor=doc.createElement('div');anchor.className='hx-scene-actor-anchor';anchor.setAttribute('aria-hidden','true');anchor.style.pointerEvents='none';anchor.hidden=true;
   facing=doc.createElement('div');facing.className='hx-scene-actor-facing';anchor.appendChild(facing);
   speech=doc.createElement('p');speech.className='hx-scene-speech';speech.setAttribute('aria-hidden','true');speech.textContent=config.copy.intro;speech.hidden=true;homeHost.appendChild(speech);
   reparent(mode==='game'?gameHost:homeHost);setBody('sceneActive',true);setBody('sceneActorReady',false);
   bind(win,'resize',()=>{requestBackground();scheduleLayout();});bind(win,'orientationchange',()=>{requestBackground();scheduleLayout();});
   bind(doc,'visibilitychange',()=>{if(doc.hidden)clearReaction();motionPolicy();updatePose();scheduleLayout();});
   ensureActor();requestBackground();scheduleLayout();
  }
  function close(){
   if(!active)return;active=false;generation++;backgroundEpoch++;poseEpoch++;cancelFade();clearReaction();
   if(frame!==null){if(win.cancelAnimationFrame)win.cancelAnimationFrame(frame);else win.clearTimeout(frame);frame=null;}
   for(const unbind of listeners.splice(0))unbind();try{actor?.destroy();}catch(error){report(error);}
   world?.remove();anchor?.remove();speech?.remove();world=background=shade=anchor=facing=speech=actor=fallback=null;actorReady=fallbackReady=backgroundReady=false;layout=null;pose=desiredPose=null;seenReactions.clear();failedImages.clear();setBody('sceneActive',false);setBody('sceneActorReady',false);setBody('scenePaused',false);
  }
  function update(input){
   if(disposed)return false;if(!input||!integer(input.committedStars))throw new TypeError('invalid_scene_view');
   const previous=view,previousStage=stage,wasActive=active;view={...input,lessonPair:Array.isArray(input.lessonPair)?input.lessonPair.slice(0,2):[]};
   if(!['home','game'].includes(view.screen)){close();mode=null;return true;}
   mode=view.screen==='game'?'game':view.firstOpening?'opening':'home';stage=stageForStars(config,view.committedStars);setBody('sceneMode',mode);setBody('sceneStage',stage);
   if(!active)mount();else{reparent(mode==='game'?gameHost:homeHost);requestBackground();}
   if(previous&&(previous.screen!==view.screen||previous.attemptId!==view.attemptId||previous.turn!==view.turn||paused())){clearReaction();desiredPose=null;}
   motionPolicy();updatePose();scheduleLayout();
   if(wasActive&&previousStage&&previousStage!==stage&&previous&&view.committedStars>previous.committedStars)react({key:'stage:'+view.committedStars+':'+(view.attemptId||''),kind:'build'});
   return true;
  }
  function react(event){
   if(disposed||!active||paused()||!event||typeof event.key!=='string'||!event.key||!Object.prototype.hasOwnProperty.call(reactions,event.kind)||seenReactions.has(event.key))return false;
   seenReactions.add(event.key);if(seenReactions.size>64)seenReactions.delete(seenReactions.values().next().value);clearReaction();reaction=reactions[event.kind];desiredPose=null;updatePose();return true;
  }
  function snapshot(){return {active,mode,stage,loadedStage,backgroundReady,actorReady,fallbackReady,pose,paused:paused(),reducedMotion:reduced(),actorVisible:!!(anchor&&!anchor.hidden),face,layout:layout?{...layout}:null,generation,destroyed:disposed};}
  function destroy(){if(disposed)return;close();disposed=true;}
  return Object.freeze({update,react,destroy,snapshot});
 }
 const api=Object.freeze({validateConfig,stageForStars,create});root.HexScenePresentation=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
