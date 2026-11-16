/* Animated Tavik portrait inside the existing tutorial dialogue; presentation only. */
(function(root){
 'use strict';
 const poses=Object.freeze({idle:'idle',point:'point',talk:'call',celebrate:'celebrate'});
 const base='./assets/scenes/coop-v1/tavik/';
 function create(options={}){
  const doc=options.document||root.document,win=options.window||doc?.defaultView||root,coach=options.coach;
  if(!doc||!coach)throw new TypeError('Tavik dialogue requires tutorial coach');
  const avatar=doc.createElement('div'),ring=doc.createElement('span'),photo=doc.createElement('img');
  avatar.className='hx-tavik-dialogue';avatar.hidden=true;avatar.setAttribute('aria-hidden','true');
  ring.className='hx-tavik-dialogue__ring';photo.className='hx-tavik-dialogue__face';
  photo.alt='';photo.width=384;photo.height=384;photo.draggable=false;photo.decoding='async';
  ring.appendChild(photo);avatar.appendChild(ring);coach.insertBefore(avatar,coach.firstChild);
  let disposed=false,active=false,sequence=0,timer=null,key='',rest='point';
  const url=name=>base+poses[name]+'.webp';
  const clear=()=>{sequence++;if(timer!==null){win.clearTimeout(timer);timer=null;}avatar.dataset.speaking='false';};
  const paint=name=>{const src=url(name);if(photo.getAttribute('src')!==src)photo.setAttribute('src',src);};
  const reduce=()=>!!(options.reducedMotion?.()||win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const suspended=()=>!active||doc.hidden||!!options.paused?.()||reduce();
  function speak(){
   clear();if(suspended()){paint(rest);return;}
   const own=sequence;let beat=0;avatar.dataset.speaking='true';
   const tick=()=>{
    if(disposed||own!==sequence)return;
    if(suspended()||beat>=6){avatar.dataset.speaking='false';paint(rest);timer=null;return;}
    paint(beat%2===0?'talk':rest);beat++;timer=win.setTimeout(tick,165);
   };
   tick();
  }
  function update(input={}){
   if(disposed)return false;
   const visible=!!input.visible&&/^(learn-1|learn-2)$/.test(input.levelId||'');
   if(!visible){active=false;clear();avatar.hidden=true;coach.dataset.tavikDialogue='false';key='';return false;}
   active=true;avatar.hidden=false;coach.dataset.tavikDialogue='true';
   const feedback=!!input.feedback,blocked=!!input.paused||!!input.busy;
   rest=feedback?'celebrate':'point';
   avatar.dataset.mood=feedback?'happy':'guide';
   avatar.dataset.reducedMotion=String(reduce());
   const nextKey=input.levelId+':'+(Number(input.step)||0)+':'+(feedback?'feedback':'guide');
   if(nextKey!==key){
    key=nextKey;clear();paint(rest);
    if(!blocked&&!suspended()){
     avatar.classList.remove('hx-tavik-dialogue--enter');void avatar.offsetWidth;
     avatar.classList.add('hx-tavik-dialogue--enter');speak();
    }
   }else if(blocked||suspended()){clear();paint(rest);}
   return true;
  }
  function visibility(){if(doc.hidden){clear();paint(rest);}else if(active)paint(rest);}
  doc.addEventListener('visibilitychange',visibility);
  photo.addEventListener('error',()=>{if(!disposed&&photo.getAttribute('src')!=='./assets/characters/tavik/front.webp')photo.src='./assets/characters/tavik/front.webp';});
  function destroy(){if(disposed)return;disposed=true;active=false;clear();doc.removeEventListener('visibilitychange',visibility);avatar.remove();delete coach.dataset.tavikDialogue;}
  function snapshot(){return Object.freeze({visible:!avatar.hidden,speaking:avatar.dataset.speaking==='true',pose:photo.getAttribute('src'),key,destroyed:disposed});}
  return Object.freeze({update,destroy,snapshot});
 }
 const api=Object.freeze({create,poses});root.HexTavikDialogue=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
