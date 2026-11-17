/* Disposable idle guidance only. Real cells, floors, gems and hit targets keep
 * their identities and coordinates. The owner retires this view before render
 * or gameplay; no animation completion can issue a domain command. */
(function(root) {
  'use strict';
  const NS='http://www.w3.org/2000/svg',DURATION=900,DISTANCE=2.5;
  const PAINT=['fill','stroke','stroke-width','opacity','font-family','font-size','font-weight','text-anchor','dominant-baseline'];

  function create(options={}) {
    const board=options.board,doc=board?.ownerDocument,win=doc?.defaultView;
    if(!doc||!win||board.namespaceURI!==NS)throw new TypeError('invalid_idle_hint_board');
    const schedule=options.setTimeout||win.setTimeout.bind(win),unschedule=options.clearTimeout||win.clearTimeout.bind(win);
    const media=typeof win.matchMedia==='function'?win.matchMedia('(prefers-reduced-motion: reduce)'):null;
    const reduced=typeof options.reducedMotion==='function'?options.reducedMotion:()=>!!media?.matches;
    let current=null,generation=0,destroyed=false;
    const svg=(name,attributes)=>{const node=doc.createElementNS(NS,name);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,String(value));return node;};

    function hide() { generation++;current?.cleanup(); }

    // Measure the displacement through the real SVG screen transform. SVG
    // viewBox units vary with viewport size, but the cue stays 2.5 CSS pixels.
    function displacement(from,to,layout) {
      const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
      let scale=0;
      if(typeof board.getScreenCTM==='function'){
        const matrix=board.getScreenCTM();
        if(matrix)scale=Math.hypot(matrix.a*ux+matrix.c*uy,matrix.b*ux+matrix.d*uy);
      }
      if(!(scale>0&&Number.isFinite(scale))){
        const box=board.getBoundingClientRect(),sx=box.width/layout.width,sy=box.height/layout.height;
        scale=sx>0&&sy>0?Math.min(sx,sy):1;
      }
      return{x:ux*DISTANCE/scale,y:uy*DISTANCE/scale};
    }

    function show({pair,matched=[],matchingSources=[],blockers=[],focusMatched,focusSources,movingSource,movingTarget,layout,duration=DURATION,preserveMaterialMarkers=false}={}) {
      if(!Number.isSafeInteger(duration)||duration<0)throw new TypeError('invalid_idle_hint_duration');
      if(destroyed)return()=>{};
      const indices=(items,label)=>{
        if(!Array.isArray(items))throw new TypeError('invalid_idle_hint_'+label);
        const copy=Array.from(items);
        if(copy.some(index=>!Number.isInteger(index)||index<0||!layout?.positions?.[index]))throw new TypeError('invalid_idle_hint_'+label);
        return [...new Set(copy)];
      };
      if(!Array.isArray(layout?.positions)||!Array.isArray(pair)||pair.length!==2)throw new TypeError('invalid_idle_hint_pair');
      const pairIndices=indices(pair,'pair');if(pairIndices.length!==2)throw new TypeError('invalid_idle_hint_pair');
      // Full-wave metadata is validated but never painted. Only the explicit
      // chosen matching group can own a cue; the other swap endpoint and every
      // crate remain completely untouched, even when the wave would hit them.
      indices(matched,'matches');indices(matchingSources,'matches');indices(blockers,'blockers');
      const focused=indices(focusSources,'focus'),destinations=indices(focusMatched,'focus');
      if(focused.length<3||destinations.length!==focused.length||!pairIndices.includes(movingSource)||!pairIndices.includes(movingTarget)||movingSource===movingTarget||!focused.includes(movingSource)||focused.includes(movingTarget)||!destinations.includes(movingTarget))throw new TypeError('invalid_idle_hint_focus');
      const tiles=new Map(Array.from(board.children).filter(node=>node.hasAttribute('data-index')).map(node=>[Number(node.getAttribute('data-index')),node]));
      const source=(index,role)=>{
        const tile=tiles.get(index),node=tile?.querySelector(':scope > .gem'),shape=node?.querySelector('.gem-shape'),position=layout.positions[index];
        if(!node||!shape||!position||![position.x,position.y].every(Number.isFinite))throw new TypeError('invalid_idle_hint_'+role);
        return{index,role,tile,node,shape,position};
      };
      const moving=source(movingSource,'moving'),target=source(movingTarget,'target'),sources=[moving,...focused.filter(index=>index!==movingSource).map(index=>source(index,'match'))];
      if(!Math.hypot(moving.position.x-target.position.x,moving.position.y-target.position.y))throw new TypeError('invalid_idle_hint_pair');
      hide();
      // A zero-duration configuration retires the previous cue immediately;
      // it never creates a zero-duration repeating animation or hidden gem.
      if(duration===0)return()=>{};
      const token=generation,layer=svg('g',{class:'idle-hint-layer','aria-hidden':'true','pointer-events':'none','data-idle-hint-generation':token});
      const animations=[],hidden=[];let timer=null,observer=null,removed=false;
      const job={cleanup};current=job;

      function cleanup() {
        if(removed)return;removed=true;
        if(current===job)current=null;
        observer?.disconnect();
        if(timer!==null)try{unschedule(timer);}catch(_){}
        doc.removeEventListener('visibilitychange',onVisibility);win.removeEventListener('pagehide',cleanup);win.removeEventListener('resize',cleanup);win.removeEventListener('orientationchange',cleanup);win.removeEventListener('blur',cleanup);
        media?.removeEventListener?.('change',onMotion);
        for(const animation of animations)try{animation.cancel?.();}catch(_){}
        try{layer.remove();}catch(_){}
        for(const source of hidden){
          try{
            // A renderer may already have reset the style. Never overwrite a
            // newer animation owner's transform, opacity or other paint.
            if(source.node.getAttribute('style')===source.hiddenStyle){
              if(source.style===null)source.node.removeAttribute('style');else source.node.setAttribute('style',source.style);
            }else if(source.node.style.getPropertyValue('opacity')==='0'&&source.node.style.getPropertyPriority('opacity')==='important'){
              if(source.opacity)source.node.style.setProperty('opacity',source.opacity,source.priority);else source.node.style.removeProperty('opacity');
              if(source.style===null&&!source.node.getAttribute('style'))source.node.removeAttribute('style');
            }
          }catch(_){}
        }
      }
      function onVisibility(){if(doc.hidden)cleanup();}
      function onMotion(event){if(event.matches)cleanup();}
      function scheduleCleanup(remaining){
        // Signed 32-bit browser timer delays must not overflow for an otherwise
        // valid safe-integer configuration. Retain one bounded timer at a time.
        const delay=Math.min(2147483647,remaining);
        timer=schedule(()=>{
          timer=null;if(current!==job||generation!==token)return;
          if(remaining>delay)scheduleCleanup(remaining-delay);else cleanup();
        },delay);
      }

      try{
        const staticCue=reduced()||sources.some(source=>typeof source.node.animate!=='function');
        layer.setAttribute('data-idle-hint-mode',staticCue?'static':'motion');
        for(const source of sources){
          const wrapper=svg('g',{class:source.role==='moving'?'idle-hint-stone idle-hint-moving':'idle-hint-match','data-idle-hint-source':source.index,'data-idle-hint-role':source.role,transform:`translate(${source.position.x},${source.position.y})`});
          const outline=()=>svg('polygon',{class:'idle-hint-outline '+(source.role==='moving'?'idle-hint-moving-outline':'idle-hint-match-outline'),points:source.shape.getAttribute('points')||'','vector-effect':'non-scaling-stroke'});
          if(staticCue)wrapper.appendChild(outline());
          else{
            const copy=source.node.cloneNode(true),originals=[source.node,...source.node.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
            // Freeze the actual paint while outside the original tile palette.
            originals.forEach((node,i)=>{
              const style=win.getComputedStyle(node);
              for(const property of PAINT){const value=style.getPropertyValue(property);if(value)copies[i].style.setProperty(property,value);}
              for(const attribute of ['id','tabindex','data-index'])copies[i].removeAttribute(attribute);
            });
            for(const property of ['--gem','--gem-edge','--gem-back','--number']){
              const value=win.getComputedStyle(source.node).getPropertyValue(property);if(value)wrapper.style.setProperty(property,value);
            }
            copy.style.removeProperty('transform');copy.style.removeProperty('visibility');
            // Brighten only the gem face. Keep the original numeral above this
            // cheap translucent polygon; no filter or recolouring is needed.
            source.sheen=svg('polygon',{class:'idle-hint-sheen',points:source.shape.getAttribute('points')||'',fill:'#fff',stroke:'none',opacity:0});
            copy.insertBefore(source.sheen,copy.querySelector('.hex-number'));copy.appendChild(outline());wrapper.appendChild(copy);
            source.style=source.node.getAttribute('style');source.opacity=source.node.style.getPropertyValue('opacity');source.priority=source.node.style.getPropertyPriority('opacity');
            hidden.push(source);source.node.style.setProperty('opacity','0','important');source.hiddenStyle=source.node.getAttribute('style');source.copy=copy;
          }
          if(preserveMaterialMarkers&&!staticCue){
            // v6 cell tokens stay fixed above a moving hint clone. Duplicate
            // decorative paint only; real markers and source identities stay
            // with their original cells and never enter the animation set.
            for(const marker of source.tile.querySelectorAll(':scope > .material-marker')){
              const copy=marker.cloneNode(true),originals=[marker,...marker.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
              originals.forEach((node,index)=>{
                const style=win.getComputedStyle(node);for(const property of PAINT){const value=style.getPropertyValue(property);if(value)copies[index].style.setProperty(property,value);}
                for(const attribute of Array.from(copies[index].attributes))if(['id','tabindex','data-index'].includes(attribute.name)||attribute.name.startsWith('data-material-'))copies[index].removeAttribute(attribute.name);
              });
              copy.classList.add('idle-hint-material-copy');copy.setAttribute('aria-hidden','true');copy.setAttribute('pointer-events','none');wrapper.appendChild(copy);
            }
          }
          layer.appendChild(wrapper);
        }
        board.appendChild(layer);
        if(!staticCue){
          for(const source of sources){
            const delta=source.role==='moving'?displacement(source.position,target.position,layout):{x:0,y:0};
            const frames=source.role==='moving'?[{transform:'translate(0px,0px) scale(1)'},{transform:`translate(${delta.x}px,${delta.y}px) scale(1.07)`,offset:.5},{transform:'translate(0px,0px) scale(1)'}]:[{transform:'scale(1)'},{transform:'scale(1.05)',offset:.5},{transform:'scale(1)'}];
            const timing={duration,iterations:1,easing:'ease-in-out',fill:'none'};
            const start=(node,keyframes)=>{
              const animation=node.animate(keyframes,timing);animations.push(animation);
              // Cancellation rejects finished; observe every owned animation.
              if(animation.finished&&typeof animation.finished.then==='function')Promise.resolve(animation.finished).catch(cleanup);
            };
            start(source.copy,frames);
            start(source.sheen,[{opacity:0},{opacity:source.role==='moving'?.08:.05,offset:.5},{opacity:0}]);
          }
        }
        doc.addEventListener('visibilitychange',onVisibility);win.addEventListener('pagehide',cleanup);win.addEventListener('resize',cleanup);win.addEventListener('orientationchange',cleanup);win.addEventListener('blur',cleanup);
        media?.addEventListener?.('change',onMotion);
        if(typeof win.MutationObserver==='function'){
          observer=new win.MutationObserver(records=>{if(records.some(record=>record.target!==layer&&!layer.contains(record.target)))cleanup();});
          // Observe only after building and hiding every owned copy. Ignore our
          // disposable subtree, but retire on any real board/paint mutation.
          observer.observe(board,{childList:true,subtree:true,attributes:true,characterData:true});
        }
        scheduleCleanup(duration);
        return cleanup;
      }catch(error){cleanup();throw error;}
    }

    function destroy(){if(destroyed)return;destroyed=true;hide();}
    return Object.freeze({show,hide,destroy});
  }

  const api=Object.freeze({create,DURATION,DISTANCE});root.HexIdleHintView=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
