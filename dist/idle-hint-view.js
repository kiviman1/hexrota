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

    function show({pair,layout,duration=DURATION}={}) {
      if(!Number.isSafeInteger(duration)||duration<0)throw new TypeError('invalid_idle_hint_duration');
      if(destroyed)return()=>{};
      if(!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||pair.some(index=>!Number.isInteger(index)||index<0)||!Array.isArray(layout?.positions))throw new TypeError('invalid_idle_hint_pair');
      const sources=pair.map(index=>{
        const tile=Array.from(board.children).find(node=>node.getAttribute('data-index')===String(index)),node=tile?.querySelector(':scope > .gem'),position=layout.positions[index];
        if(!node||!position||![position.x,position.y].every(Number.isFinite))throw new TypeError('invalid_idle_hint_pair');
        return{tile,node,position};
      });
      if(!Math.hypot(sources[0].position.x-sources[1].position.x,sources[0].position.y-sources[1].position.y))throw new TypeError('invalid_idle_hint_pair');
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
        doc.removeEventListener('visibilitychange',onVisibility);win.removeEventListener('pagehide',cleanup);
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
        const staticCue=reduced()||typeof sources[0].node.animate!=='function'||typeof sources[1].node.animate!=='function';
        layer.setAttribute('data-idle-hint-mode',staticCue?'static':'motion');
        for(let index=0;index<sources.length;index++){
          const source=sources[index],wrapper=svg('g',{class:'idle-hint-stone','data-idle-hint-source':pair[index],transform:`translate(${source.position.x},${source.position.y})`});
          if(staticCue){
            const shape=source.node.querySelector('.gem-shape');
            if(!shape)throw new TypeError('invalid_idle_hint_gem');
            wrapper.appendChild(svg('polygon',{class:'idle-hint-outline',points:shape.getAttribute('points')||'','vector-effect':'non-scaling-stroke'}));
          }else{
            const copy=source.node.cloneNode(true),originals=[source.node,...source.node.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
            // Freeze actual paint outside the original tile's inherited palette.
            originals.forEach((node,i)=>{
              const style=win.getComputedStyle(node);
              for(const property of PAINT){const value=style.getPropertyValue(property);if(value)copies[i].style.setProperty(property,value);}
              copies[i].removeAttribute('id');copies[i].removeAttribute('tabindex');
            });
            for(const property of ['--gem','--gem-edge','--gem-back','--number']){
              const value=win.getComputedStyle(source.node).getPropertyValue(property);if(value)wrapper.style.setProperty(property,value);
            }
            copy.style.removeProperty('transform');copy.style.removeProperty('visibility');
            wrapper.appendChild(copy);
            source.style=source.node.getAttribute('style');source.opacity=source.node.style.getPropertyValue('opacity');source.priority=source.node.style.getPropertyPriority('opacity');
            hidden.push(source);source.node.style.setProperty('opacity','0','important');source.hiddenStyle=source.node.getAttribute('style');
            source.copy=copy;
          }
          layer.appendChild(wrapper);
        }
        board.appendChild(layer);
        if(!staticCue){
          for(let index=0;index<sources.length;index++){
            const delta=displacement(sources[index].position,sources[1-index].position,layout);
            const animation=sources[index].copy.animate([{transform:'translate(0px,0px)'},{transform:`translate(${delta.x}px,${delta.y}px)`,offset:.5},{transform:'translate(0px,0px)'}],{duration:duration/2,iterations:2,easing:'ease-in-out',fill:'none'});
            animations.push(animation);
            // Native cancellation rejects finished; always observe it. A visual
            // rejection can only retire its own disposable layer.
            if(animation.finished&&typeof animation.finished.then==='function')Promise.resolve(animation.finished).catch(cleanup);
          }
        }
        doc.addEventListener('visibilitychange',onVisibility);win.addEventListener('pagehide',cleanup);
        media?.addEventListener?.('change',onMotion);
        if(typeof win.MutationObserver==='function'){
          observer=new win.MutationObserver(cleanup);observer.observe(board,{childList:true,subtree:true});
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
