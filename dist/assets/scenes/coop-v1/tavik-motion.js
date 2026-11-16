/* Reusable cutout actor. No storage, rewards, gameplay or global timers. */
(function(root){
 'use strict';
 const clips=Object.freeze({idle:['idle',2800,true],point:['point',1200,false],inspect:['inspect',1600,false],worried:['worried',1100,false],celebrate:['celebrate',1600,false],hop:['hop',800,false],carry:['carry',1000,true],build:['build',2100,false],proud:['proud',1200,false],think:['think',1800,false],call:['call',1800,false],rest:['rest',3800,true]});
 function mount(host,options){
  if(!host||!host.ownerDocument)throw new TypeError('Tavik requires a DOM host');
  const opts=options||{},doc=host.ownerDocument,win=doc.defaultView;
  const base=opts.assetBase||'./assets/scenes/coop-v1/';
  let disposed=false,request=0,manualPause=false;
  const actor=doc.createElement('div'),shadow=doc.createElement('span'),sprite=doc.createElement('img');
  actor.className='hx-tavik';actor.setAttribute('role','img');actor.setAttribute('aria-label','Tavik');
  shadow.className='hx-tavik__shadow';sprite.className='hx-tavik__sprite';sprite.alt='';sprite.width=384;sprite.height=384;sprite.draggable=false;
  actor.append(shadow,sprite);host.append(actor);
  const media=win.matchMedia?win.matchMedia('(prefers-reduced-motion: reduce)'):null;
  let forceReduced=!!opts.reducedMotion;
  function syncMotion(){actor.dataset.reducedMotion=String(forceReduced||!!(media&&media.matches));}
  function syncVisibility(){actor.dataset.paused=String(manualPause||doc.hidden);}
  if(media&&media.addEventListener)media.addEventListener('change',syncMotion);
  doc.addEventListener('visibilitychange',syncVisibility);syncMotion();syncVisibility();
  async function play(name){
   if(disposed)return false;
   if(!Object.prototype.hasOwnProperty.call(clips,name))throw new RangeError('Unknown Tavik clip: '+name);
   const token=++request,probe=new win.Image();probe.src=typeof opts.resolvePose==='function'?opts.resolvePose(clips[name][0]):base+'tavik/'+clips[name][0]+'.webp';
   try{await probe.decode();}catch(error){if(token===request&&typeof opts.onError==='function')opts.onError(error);return false;}
   if(disposed||token!==request)return false;
   sprite.src=probe.src;actor.dataset.motion='';void actor.offsetWidth;actor.dataset.motion=name;
   return true;
  }
  const ready=play('idle');
  return Object.freeze({element:actor,ready,play,pause:function(value){if(!disposed){manualPause=!!value;syncVisibility();}},setReducedMotion:function(value){forceReduced=!!value;syncMotion();},destroy:function(){if(disposed)return;disposed=true;request++;doc.removeEventListener('visibilitychange',syncVisibility);if(media&&media.removeEventListener)media.removeEventListener('change',syncMotion);actor.remove();}});
 }
 const api=Object.freeze({clips,mount});if(typeof module==='object'&&module.exports)module.exports=api;else root.HexTavikMotion=api;
})(typeof globalThis==='object'?globalThis:this);
