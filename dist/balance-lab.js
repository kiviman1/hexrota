/* Isolated developer presentation. The normal app/session/life services are not
 * loaded here. Every result and the running HexMatch live only in this document.
 * SVG geometry, palette and gesture thresholds follow the existing app.js. */
(function(root){
  'use strict';
  const $=id=>document.getElementById(id),copy=value=>JSON.parse(JSON.stringify(value));
  const board=$('lab-board'),motion=root.matchMedia('(prefers-reduced-motion: reduce)');
  let catalog=null,active=null,engine=null,positions=[],radius=40,viewWidth=370,viewHeight=300;
  let selected=null,focusIndex=0,pointer=null,job=null,busy=false,generation=0,lastSwapAttempt=null;
  const svg=(name,attributes)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,String(value));return node;};
  const polygon=r=>Array.from({length:6},(_,i)=>`${(r*Math.cos(i*Math.PI/3)).toFixed(3)},${(r*Math.sin(i*Math.PI/3)).toFixed(3)}`).join(' ');
  function announce(message){$('lab-status').textContent=message;}
  function setError(message){$('lab-error').hidden=!message;$('lab-error').textContent=message||'';}
  function controlsDisabled(disabled){for(const id of ['lab-level','lab-variant','lab-experiment','lab-start'])$(id).disabled=disabled;}
  function option(value,label){const node=document.createElement('option');node.value=String(value);node.textContent=label;return node;}
  function levelId(value){if(!/^(?:[1-9]|10)$/.test(value))throw Error('Bölüm seçimi 1 ile 10 arasında olmalı.');return Number(value);}
  function parseSelection(){
    const query=new URL(root.location.href).searchParams;
    for(const key of query.keys())if(!['level','variant','experiment'].includes(key)||query.getAll(key).length!==1)throw Error('Bağlantıda bilinmeyen veya yinelenen bir seçim var.');
    return {levelId:levelId(query.has('level')?query.get('level'):'1'),variantId:query.has('variant')?query.get('variant'):'v1',experimentId:query.has('experiment')?query.get('experiment'):'baseline'};
  }
  function updateExperiments(preferred='baseline'){
    const list=catalog.listExperiments(levelId($('lab-level').value),$('lab-variant').value);
    $('lab-experiment').replaceChildren(...list.map(item=>option(item.experimentId,item.experimentId==='baseline'?'Orijinal tahta':item.label)));
    if(!list.some(item=>item.experimentId===preferred))throw Error('Bu bölüm ve varyant için deney bulunamadı.');
    $('lab-experiment').value=preferred;
  }
  function setupSelectors(selection){
    const all=catalog.listScenarios(),ids=[...new Set(all.map(item=>item.levelId))].sort((a,b)=>a-b);
    $('lab-level').replaceChildren(...ids.map(id=>option(id,`Bölüm ${id}`)));
    $('lab-variant').replaceChildren(...['v1','v2','v3','v4'].map(id=>option(id,`Varyant ${id.slice(1)}`)));
    if(!ids.includes(selection.levelId)||!['v1','v2','v3','v4'].includes(selection.variantId))throw Error('Bölüm veya varyant seçimi geçersiz.');
    $('lab-level').value=String(selection.levelId);$('lab-variant').value=selection.variantId;updateExperiments(selection.experimentId);
  }
  function geometry(){
    const step=44,points=active.level.cells.map(cell=>({x:1.5*step*cell.q,y:Math.sqrt(3)*step*(cell.r+cell.q/2)}));
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    positions=points.map(p=>({x:p.x-cx,y:p.y-cy}));
    viewWidth=Math.max(370,Math.max(...xs)-Math.min(...xs)+radius*2+24);viewHeight=Math.max(300,Math.max(...ys)-Math.min(...ys)+radius*Math.sqrt(3)+26);
    board.setAttribute('viewBox',`${-viewWidth/2} ${-viewHeight/2} ${viewWidth} ${viewHeight}`);
  }
  function gem(value){
    const inner=polygon(radius*.78),r=radius*.78-1.2,h=r*Math.sqrt(3)/2;
    const highlight=`M${-.8*r} ${-.4*h} L${-.5*r} ${-h} L${.5*r} ${-h} L${.8*r} ${-.4*h}`;
    return `<g class="lab-gem"><polygon class="lab-gem-back" points="${inner}" transform="translate(0 3.5)"/><polygon class="lab-gem-shape" points="${inner}"/><path class="lab-gem-highlight" d="${highlight}"/><text class="lab-number" x="0" y="0">${value}</text></g>`;
  }
  function render(state=null){
    if(!engine||!active){board.replaceChildren();$('lab-board-empty').hidden=false;return;}
    const current=state||engine.snapshot(),outer=polygon(radius),interactive=!busy&&engine.status==='playing';
    // All fixed floors are drawn before every gem. Temporary swaps have a third,
    // independent top layer; gravity can never pass behind a neighboring floor.
    const floors=active.level.cells.map((cell,index)=>{
      const p=positions[index],left=current.layers[index],classes=['lab-floor',left===0?'lab-floor-green':left<(cell.layers||1)?'lab-floor-partial':'',cell.layers===2&&left>0?'lab-floor-double':'',selected===index?'lab-floor-selected':''].filter(Boolean).join(' ');
      const markers=left===0?'<path class="lab-floor-mark" d="m-4 29 3 3 6-7"/>':cell.layers===2?Array.from({length:left},(_,dot)=>`<circle class="lab-layer-pip" cx="${left===2?(dot?4:-4):0}" cy="31" r="2.5"/>`).join(''):'';
      return `<g transform="translate(${p.x},${p.y})"><polygon class="${classes}" points="${outer}"/>${markers}</g>`;
    }).join('');
    const gems=current.values.map((value,index)=>{
      const p=positions[index],left=current.layers[index],ground=left===0?'altı yeşil':`${left} kat kaldı`;
      return `<g class="lab-tile lab-value-${value}" data-index="${index}" transform="translate(${p.x},${p.y})" role="button" tabindex="${index===focusIndex?0:-1}" aria-label="${value} sayısı, ${ground}" aria-pressed="${selected===index}" aria-disabled="${!interactive}"><polygon class="lab-hit" points="${outer}"/>${gem(value)}</g>`;
    }).join('');
    const focused=document.activeElement?.closest?.('[data-index]')?.dataset.index;
    board.innerHTML=`<g class="lab-floors" pointer-events="none">${floors}</g><g class="lab-gems">${gems}</g><g class="lab-fx-layer" aria-hidden="true"/><g class="lab-swap-layer" aria-hidden="true" pointer-events="none"/>`;
    board.setAttribute('aria-busy',String(busy));board.setAttribute('aria-disabled',String(!interactive));$('lab-board-empty').hidden=true;
    $('lab-score').textContent=String(current.score);$('lab-target').textContent=String(active.level.target);$('lab-moves').textContent=String(current.movesLeft);
    $('lab-green').textContent=String(current.layers.filter(left=>left===0).length);$('lab-total').textContent=String(active.level.cells.length);$('lab-turns').textContent=`${engine.turn} hamle kullanıldı`;
    if(focused!==undefined)board.querySelector(`[data-index="${focused}"]`)?.focus?.({preventScroll:true});
  }
  function renderResult(){
    const done=!!engine&&engine.status!=='playing';$('lab-result').hidden=!done;if(!done)return;
    const missingScore=Math.max(0,active.level.target-engine.score),missingGreen=engine.total-engine.covered;
    $('lab-result').dataset.outcome=engine.status;$('lab-result-title').textContent=engine.status==='won'?'Tahta tamamlandı!':'Hamleler bitti';
    $('lab-result-summary').textContent=engine.status==='won'?`${engine.turn} hamlede iki hedefi de tamamladın. ${engine.movesLeft} hamlen kaldı.`:missingScore===0?'Puanın yeterliydi. Yeşil olması gereken hücreler kaldı.':missingGreen===0?'Her yer yeşil oldu. Puan hedefi eksik kaldı.':'Puan ve yeşil alan hedefleri eksik kaldı.';
    $('lab-missing-score').textContent=String(missingScore);$('lab-missing-green').textContent=String(missingGreen);$('lab-remaining-layers').textContent=String(engine.remainingLayers);
  }
  function stopPointer(){const old=pointer;pointer=null;if(old)try{if(board.hasPointerCapture?.(old.id))board.releasePointerCapture(old.id);}catch(_){} }
  function alive(current){return job===current&&!current.cancelled&&current.generation===generation;}
  function cancelPresentation(redraw=true){
    stopPointer();generation++;const previous=job;job=null;busy=false;
    if(previous){clearTimeout(previous.watchdog);previous.cancelled=true;for(const animation of previous.animations)try{animation.cancel();}catch(_){}for(const finish of previous.waiters)finish();for(const cleanup of previous.cleanups)cleanup();}
    if(redraw){render();renderResult();if(previous&&engine)announce(engine.status==='won'?'İki hedef de tamamlandı.':engine.status==='lost'?'Deneme bitti. Sonuç aşağıda.':'Son hamle tamamlandı.');}
  }
  function wait(ms,current){return new Promise(resolve=>{if(!alive(current))return resolve();const finish=()=>{clearTimeout(timer);current.waiters.delete(finish);resolve();};const timer=setTimeout(finish,ms);current.waiters.add(finish);});}
  function animate(current,node,frames,options){
    if(!node||!alive(current)||motion.matches||typeof node.animate!=='function')return null;
    const animation=node.animate(frames,options);current.animations.push(animation);return animation;
  }
  async function finishAnimations(animations,current,duration){
    const started=animations.filter(Boolean);if(!started.length)return;
    await Promise.race([Promise.all(started.map(animation=>animation.finished?.catch(()=>{})||wait(duration,current))),wait(duration+120,current)]);
  }
  function swapPaths(a,b){
    const from=positions[a],to=positions[b],dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length,lane=Math.min(radius*.95,length*.5),inset=radius*.78+5,paths=[[],[]];
    for(let step=0;step<=16;step++){
      const t=step/16,bend=lane*Math.sin(Math.PI*t),points=[{x:from.x+dx*t+nx*bend,y:from.y+dy*t+ny*bend},{x:to.x-dx*t-nx*bend,y:to.y-dy*t-ny*bend}];
      const shift=(axis,size)=>Math.min(Math.max(0,-size/2+inset-Math.min(...points.map(p=>p[axis]))),size/2-inset-Math.max(...points.map(p=>p[axis]))),sx=shift('x',viewWidth),sy=shift('y',viewHeight);
      points.forEach((p,index)=>{const origin=index?to:from;paths[index].push({transform:`translate(${p.x+sx-origin.x}px,${p.y+sy-origin.y}px)`,offset:t});});
    }
    return paths;
  }
  async function presentSwap(current,a,b,before){
    render(before);const layer=board.querySelector('.lab-swap-layer'),sources=[],copies=[];
    const cleanup=()=>{for(const source of sources)source.style.removeProperty('visibility');layer?.replaceChildren();};current.cleanups.add(cleanup);
    try{
      for(const [from,to]of[[a,b],[b,a]]){
        const source=board.querySelector(`[data-index="${from}"] .lab-gem`),value=before.values[from],p=positions[from],wrapper=svg('g',{class:`lab-moving-stone lab-value-${value}`,'data-from':from,'data-to':to,'data-value':value,transform:`translate(${p.x},${p.y})`});
        if(!source||!layer)throw Error('Takas katmanı hazırlanamadı.');
        const clone=source.cloneNode(true);wrapper.appendChild(clone);layer.appendChild(wrapper);copies.push(clone);sources.push(source);source.style.visibility='hidden';
      }
      const paths=swapPaths(a,b),animations=copies.map((node,index)=>animate(current,node,paths[index],{duration:380,easing:'cubic-bezier(.25,.7,.2,1)',fill:'forwards'}));
      await finishAnimations(animations,current,380);
    }finally{cleanup();current.cleanups.delete(cleanup);}
  }
  async function presentWaves(current,result,before){
    let layers=before.layers.slice(),score=before.score;
    for(const frame of result.frames){
      if(!alive(current))return;
      render({values:frame.before,layers,score,movesLeft:engine.movesLeft});
      const animations=[],fx=board.querySelector('.lab-fx-layer');
      for(const index of frame.matched){
        const node=board.querySelector(`[data-index="${index}"] .lab-gem`);animations.push(animate(current,node,[{transform:'scale(1)',opacity:1},{transform:'scale(1.12)',opacity:1,offset:.3},{transform:'scale(.5)',opacity:0}],{duration:210,easing:'ease-out',fill:'forwards'}));
        const p=positions[index],ring=svg('circle',{class:'lab-ring',cx:p.x,cy:p.y,r:16});fx?.appendChild(ring);animations.push(animate(current,ring,[{r:'16px',opacity:.8},{r:'42px',opacity:0}],{duration:250,fill:'forwards'}));
      }
      const center=frame.matched.reduce((p,index)=>({x:p.x+positions[index].x/frame.matched.length,y:p.y+positions[index].y/frame.matched.length}),{x:0,y:0});
      const label=svg('text',{class:'lab-wave-label',x:center.x,y:center.y-10});label.textContent=`+${frame.scoreGain}`;fx?.appendChild(label);animations.push(animate(current,label,[{transform:'translateY(0)',opacity:1},{transform:'translateY(-25px)',opacity:0}],{duration:270,fill:'forwards'}));
      await finishAnimations(animations,current,270);if(!alive(current))return;
      layers=frame.layers.slice();score+=frame.scoreGain;render({values:frame.after,layers,score,movesLeft:engine.movesLeft});
      const falling=[];
      for(const fall of frame.falls||[]){
        const destination=positions[fall.to],cell=active.level.cells[fall.to];let origin;
        if(fall.spawn){const column=active.level.cells.map((c,index)=>({c,index})).filter(item=>item.c.q===cell.q).sort((a,b)=>a.c.r-b.c.r);origin={x:destination.x,y:positions[column[0].index].y-Math.sqrt(3)*44*(fall.spawnCount-fall.spawnOrder)};}
        else origin=positions[fall.from];
        falling.push(animate(current,board.querySelector(`[data-index="${fall.to}"] .lab-gem`),[{transform:`translate(${origin.x-destination.x}px,${origin.y-destination.y}px)`,opacity:fall.spawn?0:1},{transform:'translate(0px,2px)',opacity:1,offset:.85},{transform:'translate(0px,0px)',opacity:1}],{duration:310,easing:'cubic-bezier(.22,.72,.28,1)',fill:'both'}));
      }
      await finishAnimations(falling,current,310);
    }
  }
  async function performSwap(a,b){
    if(!engine||busy||engine.status!=='playing')return;
    const before=engine.snapshot(),result=engine.swap(a,b);lastSwapAttempt={pair:[a,b],ok:result.ok,reason:result.reason||null,turnBefore:before.turn,turnAfter:engine.turn};selected=null;
    if(!result.ok){render();announce(result.reason==='neighbor'?'Yalnızca yan yana iki taşı değiştirebilirsin.':'Bu takas, aynı sayıdan 3 taşı bir araya getirmedi.');return;}
    busy=true;const current={generation,animations:[],waiters:new Set(),cleanups:new Set(),cancelled:false,watchdog:null};job=current;
    // Presentation has the same total budget as the normal game. The complete
    // move is already resolved; a long cascade must not hold input indefinitely.
    current.watchdog=setTimeout(()=>{if(alive(current))cancelPresentation();},3300);
    render(before);announce('Taşlar yer değiştiriyor…');
    try{
      if(!motion.matches&&typeof board.animate==='function'){await presentSwap(current,a,b,before);if(alive(current))await presentWaves(current,result,before);}
    }catch(_){/* Presentation failure settles the already resolved memory state. */}
    finally{
      if(alive(current)){clearTimeout(current.watchdog);job=null;busy=false;for(const animation of current.animations)try{animation.cancel();}catch(_){}for(const cleanup of current.cleanups)cleanup();for(const finish of current.waiters)finish();render();renderResult();announce(engine.status==='won'?'İki hedef de tamamlandı.':engine.status==='lost'?'Deneme bitti. Sonuç aşağıda.':`+${result.scoreGain} puan${result.frames.length>1?` · ${result.frames.length} eşleşme dalgası`:''}${result.reshuffled?' · Eşleşme kalmadığı için taşlar karıştırıldı.':''}`);}
    }
  }
  function select(index){
    if(!engine||busy||engine.status!=='playing')return;
    focusIndex=index;if(selected===null){selected=index;render();announce('Şimdi yanındaki diğer taşı seç.');}
    else if(selected===index){selected=null;render();announce('');}
    else if(engine.adjacent(selected,index))performSwap(selected,index);
    else{selected=index;render();announce('Şimdi bu taşın yanındaki taşı seç.');}
  }
  function showDefinition(){
    $('lab-active-title').textContent=`Bölüm ${active.levelId} · ${active.experimentId==='baseline'?'Orijinal':active.label}`;
    $('lab-active-kind').textContent=active.experimentId==='baseline'?'ORİJİNAL · İZOLE OYUN':'DENEY ADAYI · YAYIMLANMADI';$('lab-active-variant').textContent=`VARYANT ${active.variantId.slice(1)}`;
    const changed=Array.isArray(active.changedFields)?active.changedFields.join(', '):JSON.stringify(active.changedFields||{});
    $('lab-definition').textContent=active.experimentId==='baseline'?'Yayımlanmış varyantın kopyası. Normal oyun kurallarıyla, ayrı bellek durumunda oynanır.':`${active.label}. Değişen alan: ${changed||active.factor}. Puan ve kazanma koşulları gerçek oyun motoruyla hesaplanır.`;
    $('lab-scenario').textContent=active.scenarioId;
  }
  function start(selection,updateAddress=true){
    try{
      const resolved=catalog.resolve(selection.levelId,selection.variantId,selection.experimentId),next=new root.HexMatch(resolved.level);
      cancelPresentation(false);active=resolved;engine=next;selected=null;focusIndex=0;lastSwapAttempt=null;setError('');geometry();showDefinition();render();renderResult();$('lab-restart').disabled=false;
      if(updateAddress){const address=new URL(root.location.href);address.search='';address.searchParams.set('level',String(active.levelId));address.searchParams.set('variant',active.variantId);address.searchParams.set('experiment',active.experimentId);root.history.replaceState(null,'',address);}
      announce('Tahta hazır. Komşu sayıları kaydırarak başlayabilirsin.');
      if(updateAddress&&root.innerWidth<=760)$('lab-active-title').closest('.lab-play').scrollIntoView?.({block:'start',behavior:'auto'});
    }catch(error){cancelPresentation(false);active=null;engine=null;render();$('lab-board-empty').textContent='Bu seçim açılamadı.';$('lab-restart').disabled=true;$('lab-result').hidden=true;setError(`Deney açılmadı. ${error.message}`);announce('Başka bir geçerli seçim yapıp “Tahtayı aç”a dokun.');}
  }
  function readSelection(){return {levelId:levelId($('lab-level').value),variantId:$('lab-variant').value,experimentId:$('lab-experiment').value};}
  function boardPoint(event,inverse=null){
    try{const matrix=inverse||board.getScreenCTM?.()?.inverse();if(!matrix)return null;const point=board.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(matrix);return Number.isFinite(local.x)&&Number.isFinite(local.y)?{x:local.x,y:local.y}:null;}catch(_){return null;}
  }
  function tileAt(event){
    const node=document.elementFromPoint?.(event.clientX,event.clientY)||event.target,tile=node?.closest?.('[data-index]');if(tile&&board.contains(tile))return Number(tile.dataset.index);
    const local=boardPoint(event),matrix=board.getScreenCTM?.();if(!local||!matrix)return null;
    const scale=Math.min(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d)),padding=Math.min(6,3/Math.max(.1,scale)),nearest=positions.map((p,index)=>({index,x:Math.abs(local.x-p.x),y:Math.abs(local.y-p.y),distance:Math.hypot(local.x-p.x,local.y-p.y)})).sort((a,b)=>a.distance-b.distance),point=nearest[0];if(!point)return null;
    const inside=pad=>point.x<=radius+pad&&point.y<=radius*Math.sqrt(3)/2+pad&&Math.sqrt(3)*point.x+point.y<=Math.sqrt(3)*radius+pad*2;
    if(inside(0))return point.index;return inside(padding)&&(!nearest[1]||nearest[1].distance-point.distance>padding)?point.index:null;
  }
  function outside(event){return !Number.isFinite(event.clientX)||!Number.isFinite(event.clientY)||event.clientX<0||event.clientY<0||event.clientX>root.innerWidth||event.clientY>root.innerHeight;}
  function samplePointer(event){
    if(!pointer)return;if(outside(event)){pointer.invalid=true;return;}
    pointer.maxDistance=Math.max(pointer.maxDistance,Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y));if(!pointer.local)return;
    const local=boardPoint(event,pointer.inverse);if(!local){pointer.invalid=true;return;}const dx=local.x-pointer.local.x,dy=local.y-pointer.local.y,length=Math.hypot(dx,dy);if(!length||pointer.maxDistance<12)return;
    let choice=null,alignment=-1;
    for(const neighbor of pointer.neighbors){const cosine=(dx*neighbor.dx+dy*neighbor.dy)/(length*neighbor.distance);if(cosine<Math.cos(Math.PI/8)||cosine<=alignment)continue;const along=length*cosine,threshold=Math.max(12,Math.min(20,neighbor.screenDistance*.28))*neighbor.distance/neighbor.screenDistance;if(along<threshold)continue;choice=neighbor.index;alignment=cosine;}
    if(choice===null)return;if(pointer.target===null)pointer.target=choice;else if(pointer.target!==choice)pointer.conflicted=true;
  }
  board.addEventListener('pointerdown',event=>{
    if(pointer&&pointer.id!==event.pointerId){stopPointer();return;}
    if(!engine||busy||engine.status!=='playing'||event.isPrimary===false||(event.button!==0&&event.pointerType!=='touch')||pointer||outside(event))return;
    const tile=event.target.closest?.('[data-index]'),index=tile&&board.contains(tile)?Number(tile.dataset.index):tileAt(event);if(index===null)return;
    const matrix=board.getScreenCTM?.(),local=boardPoint(event),from=positions[index];let inverse=null;try{inverse=matrix?.inverse();}catch(_){}
    const neighbors=local&&matrix?engine.neighbors[index].map(index=>{const dx=positions[index].x-from.x,dy=positions[index].y-from.y;return {index,dx,dy,distance:Math.hypot(dx,dy),screenDistance:Math.hypot(matrix.a*dx+matrix.c*dy,matrix.b*dx+matrix.d*dy)};}).filter(neighbor=>neighbor.screenDistance>0):[];
    event.preventDefault();pointer={id:event.pointerId,index,x:event.clientX,y:event.clientY,local,inverse,neighbors,target:null,maxDistance:0,conflicted:false,invalid:false,generation,engine};try{board.setPointerCapture?.(event.pointerId);}catch(_){}
  });
  root.addEventListener('pointerdown',event=>{if(pointer&&event.pointerType==='touch'&&event.pointerId!==pointer.id)stopPointer();});
  root.addEventListener('pointermove',event=>{if(!pointer||event.pointerId!==pointer.id)return;if(event.pointerType!=='touch'&&event.buttons===0){stopPointer();return;}for(const sample of event.getCoalescedEvents?.()||[])samplePointer(sample);samplePointer(event);});
  root.addEventListener('pointerup',event=>{
    if(!pointer||event.pointerId!==pointer.id)return;samplePointer(event);const gesture=pointer,target=tileAt(event);stopPointer();
    if(outside(event)||gesture.invalid||gesture.conflicted||gesture.generation!==generation||gesture.engine!==engine||busy)return;
    if(gesture.local){if(gesture.target!==null)performSwap(gesture.index,gesture.target);else if(gesture.maxDistance<12&&target===gesture.index)select(gesture.index);return;}
    if(target===null)return;if(target===gesture.index)select(target);else if(gesture.maxDistance>=6)performSwap(gesture.index,target);else select(target);
  });
  const cancelPointer=event=>{if(pointer&&(event.pointerId===undefined||event.pointerId===pointer.id))stopPointer();};
  board.addEventListener('lostpointercapture',cancelPointer);root.addEventListener('pointercancel',cancelPointer);
  board.addEventListener('click',event=>{if(event.detail===0){const tile=event.target.closest?.('[data-index]');if(tile)select(Number(tile.dataset.index));}});
  board.addEventListener('keydown',event=>{
    const tile=event.target.closest?.('[data-index]');if(!tile||!engine||busy||engine.status!=='playing')return;const index=Number(tile.dataset.index);
    if(event.key==='Enter'||event.key===' '){event.preventDefault();select(index);return;}
    const direction={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!direction)return;event.preventDefault();const from=positions[index],next=engine.neighbors[index].map(index=>{const p=positions[index],dx=p.x-from.x,dy=p.y-from.y;return {index,score:(dx*direction[0]+dy*direction[1])/Math.hypot(dx,dy)};}).filter(item=>item.score>0).sort((a,b)=>b.score-a.score)[0];
    if(next){focusIndex=next.index;for(const node of board.querySelectorAll('[data-index]'))node.setAttribute('tabindex',Number(node.dataset.index)===focusIndex?'0':'-1');board.querySelector(`[data-index="${focusIndex}"]`)?.focus?.();}
  });
  root.addEventListener('blur',()=>cancelPresentation());root.addEventListener('resize',()=>cancelPresentation());root.addEventListener('pagehide',()=>cancelPresentation());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelPresentation();});
  motion.addEventListener?.('change',()=>cancelPresentation());
  $('lab-form').addEventListener('submit',event=>{event.preventDefault();try{start(readSelection());}catch(error){setError(error.message);}});
  $('lab-level').addEventListener('change',()=>{try{updateExperiments();setError('');}catch(error){setError(error.message);}});
  $('lab-variant').addEventListener('change',()=>{try{updateExperiments();setError('');}catch(error){setError(error.message);}});
  $('lab-restart').addEventListener('click',()=>{if(active)start({levelId:active.levelId,variantId:active.variantId,experimentId:active.experimentId});});
  root.HexBalanceLab=Object.freeze({inspect:()=>({ready:!!engine&&!!active,selection:active?{levelId:active.levelId,variantId:active.variantId,experimentId:active.experimentId}:null,scenarioId:active?.scenarioId||null,level:active?copy(active.level):null,snapshot:engine?copy(engine.snapshot()):null,busy,status:engine?.status||null,lastSwapAttempt:lastSwapAttempt?copy(lastSwapAttempt):null})});
  try{
    if(!root.HexMatch||!root.HexBalanceLabCatalog||!root.HEX_LEVELS||!root.HEX_VARIANTS||!root.HEX_BALANCE_LAB)throw Error('Laboratuvar verileri yüklenemedi. Sayfayı çevrimiçi yeniden aç.');
    catalog=root.HexBalanceLabCatalog.createCatalog(root.HEX_LEVELS,root.HEX_VARIANTS,root.HEX_BALANCE_LAB,root.HexMatch);const selection=parseSelection();setupSelectors(selection);controlsDisabled(false);start(selection,false);
  }catch(error){setError(error.message);$('lab-board-empty').textContent='Bu deney açılamadı.';announce('Seçim veya deney verisi geçersiz. Yeni bir tahta oluşturulmadı.');}
})(window);
