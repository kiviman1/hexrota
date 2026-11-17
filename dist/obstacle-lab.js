/* Development host for the canonical rules and shared presentation components.
 * Only this lab's versioned key is read or written. Campaign services stay out. */
(function(root){
  'use strict';
  const KEY='hexrota-obstacles-lab-v1',DATA_VERSION='obstacles-v1';
  const $=id=>document.getElementById(id),levels=root.HEX_OBSTACLE_LEVELS;
  const motion={swap:170,budget:12000,digit:0,spread:0,collectPulse:0,pop:0,hold:0,flight:0,count:0,arrival:0,burst:0,ring:0,particle:0,matchPause:90,fall:270,fallStagger:30,columnDelay:10};
  const phaseCopy={SWAP:'Taşlar yer değiştiriyor…',MATCH:'Eşleşme!',BLOCKER_HIT:'Komşu kutu bir hasar aldı.',BLOCKER_BREAK:'Kutu kırıldı!',REGION_UNLOCK:'Yeni bölge açıldı!',CLEAR:'Eşleşen taşlar temizleniyor.',FALL:'Taşlar yeni alanlara düşüyor.',REFILL:'Boş hücreler doluyor.',CASCADE:'Yeni alanda zincir eşleşme!',SETTLE:'Hamle tamamlandı.'};
  let saved={version:1,levelDataVersion:DATA_VERSION,activeId:levels[0].id,boards:{}},game,level,layout,selected=null,gesture=null,job=null,epoch=0,paused=false,saveError=false;
  function projection(source=game){return {obstacleVersion:DATA_VERSION,values:source.values.slice(),layers:source.layers.slice(),score:source.score,movesLeft:source.movesLeft,blockerHp:source.blockerHp.slice(),regionOpen:source.regionOpen.slice()};}
  function message(text){$('lab-message').textContent=text;}
  function write(active=game){
    const next={...saved,activeId:level.id,boards:{...saved.boards,[level.id]:active.snapshot()}};
    localStorage.setItem(KEY,JSON.stringify(next));saved=next;saveError=false;
  }
  function render(state=projection(),options={}){
    $('board').setAttribute('viewBox',`${-layout.width/2} ${-layout.height/2} ${layout.width} ${layout.height}`);
    root.HexBoardView.reconcile($('board'),root.HexBoardView.markup(level,state,layout,{...options,busy:!!job||paused||saveError,status:game.status,selected,selectedNeighbors:selected===null?[]:game.neighbors[selected]}),options.transition||{});
    $('board').setAttribute('aria-busy',String(!!job));
    $('sum').textContent=state.score;$('target').textContent=level.target;$('moves-left').textContent=state.movesLeft;
    $('ground').textContent=`${state.layers.filter(n=>n===0).length} / ${game.total}`;
    $('blockers').textContent=`Kutu: ${state.blockerHp.filter(hp=>hp===0).length} / ${state.blockerHp.length} kırıldı`;
    $('regions').textContent=`Bölge: ${state.regionOpen.filter(Boolean).length} / ${state.regionOpen.length} açık`;
    const terminal=!job&&game.status!=='playing';$('lab-result').hidden=!terminal;$('lab-result').dataset.status=game.status;
    $('lab-result').textContent=game.status==='won'?'Kazandın! Yeni alanı tamamladın.':'Hamleler bitti. Yeniden deneyebilirsin.';
    $('restart').disabled=!!job;$('level-select').disabled=!!job;$('proven-move').disabled=!!job||paused||saveError||game.status!=='playing';
    $('pause').textContent=paused?'Devam et':'Duraklat';document.body.classList.toggle('paused',paused);
  }
  function current(active){return job===active&&active.token===epoch&&!active.controller.signal.aborted;}
  function animate(active,node,frames,options){
    if(!current(active)||!node||!node.animate)return Promise.resolve();
    const animation=node.animate(frames,options);active.animations.add(animation);
    return animation.finished.catch(()=>{}).finally(()=>{active.animations.delete(animation);try{animation.cancel();}catch(_){}});
  }
  function delay(active,ms){return new Promise(resolve=>{const timer=setTimeout(()=>{active.timers.delete(timer);resolve();},ms);active.timers.add(timer);});}
  function finish(active){
    if(job!==active)return;
    active.controller.abort();for(const animation of active.animations)try{animation.cancel();}catch(_){}
    for(const timer of active.timers)clearTimeout(timer);active.timers.clear();job=null;epoch++;selected=null;
    $('board').dataset.presentationPhase='SETTLE';
    try{render();}catch(_){
      // A failed visual transition cannot keep the command/input job alive.
      // Rebuild from the committed projection if reconciliation was interrupted.
      try{render(projection(),{transition:{reset:true}});}catch(_){
        $('board').setAttribute('aria-busy','false');$('restart').disabled=false;$('level-select').disabled=false;
        message('Kayıtlı hamle korundu. Görünümü yenilemek için sayfayı tekrar açabilirsin.');
      }
    }
  }
  function cancelPresentation(){if(job)finish(job);}
  function canAnimate(){return !document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!paused;}
  function paint(active,state,options){if(current(active))render(state,options);}
  function particles(active,cell){
    if(!current(active))return Promise.resolve();const p=layout.positions[cell],fx=$('board').querySelector('.fx-layer'),parts=[];
    for(let i=0;i<7;i++){
      const node=document.createElementNS('http://www.w3.org/2000/svg','path');node.setAttribute('class','crate-fragment');node.setAttribute('data-asset','crate-break');node.setAttribute('d',`M${p.x-4} ${p.y-3}l9 1-2 7-7-2Z`);fx.append(node);
      const angle=i*Math.PI*2/7,dx=Math.cos(angle)*50,dy=Math.sin(angle)*40;
      parts.push(animate(active,node,[{transform:'translate(0px,0px)',opacity:1},{transform:`translate(${dx}px,${dy}px) rotate(${i*47}deg)`,opacity:0}],{duration:300,easing:'ease-out'}).finally(()=>node.remove()));
    }
    return Promise.all(parts);
  }
  async function performSwap(a,b){
    if(job||paused||saveError||game.status!=='playing'||!game.isPlayable(a)||!game.isPlayable(b))return false;
    const before=projection(),candidate=game.clone();let result;
    try{result=candidate.swap(a,b);}catch(_){message('Hamle tamamlanamadı. Kaydedilmiş tahtan korundu.');return false;}
    selected=null;
    if(!result.ok){render();message('Üçlü oluşmadı; hamlen harcanmadı.');return false;}
    try{write(candidate);}catch(_){message('Kayıt yazılamadı. Hamlen uygulanmadı; yeniden deneyebilirsin.');return false;}
    game=candidate;const active={token:++epoch,controller:new AbortController(),animations:new Set(),timers:new Set()};job=active;
    const final=projection(),attemptId=`${DATA_VERSION}/${level.id}`;
    try{
      render(before);
      const plan=root.HexMovePresentation.plan({before,final,frames:result.frames,swap:[a,b],motion});
      const watchdog=setTimeout(()=>{if(current(active)){finish(active);message('Animasyon tamamlandı; kayıtlı tahtan gösteriliyor.');}},plan.budget);active.timers.add(watchdog);
      const outcome=await root.HexMovePresentation.play({plan,attemptId,token:active.token,signal:active.controller.signal,isCurrent:(_,token)=>current(active)&&token===active.token,canAnimate,
        onPhase({phase,wave}){if(current(active)){$('board').dataset.presentationPhase=phase;$('board').dataset.presentationWave=String(wave||0);message(phaseCopy[phase]);}},
        adapters:{
          async swap(){
            paint(active,before);const paths=root.HexBoardView.swapPaths(layout,a,b);
            await Promise.all([a,b].map((index,offset)=>animate(active,$('board').querySelector(`[data-index="${index}"]>.gem`),paths[offset],{duration:motion.swap,easing:'ease-in-out'})));
          },
          async match(wave){
            paint(active,wave.before,{matching:wave.frame.matched,transition:wave.firstMoves.length?{moves:wave.firstMoves.map(([from,to])=>({from,to}))}:undefined});
            await Promise.all(wave.frame.matched.map(index=>animate(active,$('board').querySelector(`[data-index="${index}"]>.gem`),[{opacity:1},{opacity:.55},{opacity:1}],{duration:160})));
          },
          async blockerHit(wave){
            const hp=wave.before.blockerHp.slice();for(const hit of wave.frame.blockerHits){const index=level.obstacles.blockers.findIndex(b=>b.id===hit.id);if(hit.hp>0)hp[index]=hit.hp;}
            paint(active,{...wave.before,blockerHp:hp});
            await Promise.all(wave.frame.blockerHits.map(hit=>animate(active,$('board').querySelector(`[data-index="${hit.cell}"]>.blocker-visual`),[{transform:'translate(-3px,0)'},{transform:'translate(3px,0)'},{transform:'translate(0,0)'}],{duration:170})));
          },
          async blockerBreak(wave){
            paint(active,{...wave.before,blockerHp:wave.after.blockerHp});
            await Promise.all(wave.frame.brokenBlockers.map(id=>particles(active,level.obstacles.blockers.find(b=>b.id===id).cell)));
          },
          async regionUnlock(wave){
            const opening=wave.frame.openedRegions.flatMap(id=>level.obstacles.regions.find(r=>r.id===id).cells);
            await Promise.all(opening.map(index=>animate(active,$('board').querySelector(`[data-index="${index}"]>.region-cover`),[{opacity:1},{opacity:0}],{duration:230})));
            paint(active,{...wave.before,blockerHp:wave.after.blockerHp,regionOpen:wave.after.regionOpen});
          },
          clear(wave){return Promise.all(wave.frame.matched.map(index=>animate(active,$('board').querySelector(`[data-index="${index}"]>.gem`),[{opacity:1},{opacity:0}],{duration:100})));},
          fall(wave){
            paint(active,wave.after,{transition:{matched:wave.frame.matched,falls:wave.frame.falls}});
            for(const fall of wave.frame.falls.filter(f=>!f.spawn)){
              const from=layout.positions[fall.from],to=layout.positions[fall.to];
              animate(active,$('board').querySelector(`[data-index="${fall.to}"]>.gem`),[{transform:`translate(${from.x-to.x}px,${from.y-to.y}px)`},{transform:'translate(0px,0px)'}],{duration:motion.fall,easing:'ease-in'});
            }
            return motion.fall;
          },
          refill(wave){
            for(const fall of wave.frame.falls.filter(f=>f.spawn)){
              const tile=$('board').querySelector(`[data-index="${fall.to}"]`),defs=$('board').querySelector('defs'),spacing=Math.sqrt(3)*44;
              // spawnOrder comes from the resolved segment. Clip its emergence
              // at that segment's upper edge so a new gem never paints through
              // a box/closed cell above it. No gameplay geometry is recalculated.
              const clip=document.createElementNS('http://www.w3.org/2000/svg','clipPath'),rect=document.createElementNS('http://www.w3.org/2000/svg','rect'),id=`lab-spawn-${active.token}-${wave.wave}-${fall.to}`;
              clip.setAttribute('id',id);rect.setAttribute('x',String(-layout.radius));rect.setAttribute('y',String(-spacing*fall.spawnOrder-layout.radius*.87));rect.setAttribute('width',String(layout.radius*2));rect.setAttribute('height',String(layout.height+spacing*fall.spawnOrder));clip.append(rect);defs.append(clip);tile.setAttribute('clip-path',`url(#${id})`);
              animate(active,tile.querySelector('.gem'),[{transform:`translate(0px,${-spacing*(fall.spawnOrder+.5)}px)`,opacity:0},{transform:'translate(0px,0px)',opacity:1}],{duration:wave.motion.fall,easing:'ease-out'});
            }
            return wave.motion.fall;
          },
          settle(){paint(active,final);},pause(ms){return delay(active,ms);}
        }});
      if(current(active)&&outcome.status==='failed')message('Görsel efekt tamamlanamadı; kaydedilmiş sonuç gösteriliyor.');
    }catch(_){if(current(active))message('Kaydedilmiş sonuç gösteriliyor.');}
    finally{if(job===active){finish(active);message(game.status==='won'?'Bütün hedefler tamamlandı!':game.status==='lost'?'Yeniden başlatıp farklı bir yol dene.':'Komşu kutunun yanında eşleştir; yeni alanları yeşile boya.');}}
    return true;
  }
  function select(index){
    if(job||paused||saveError||game.status!=='playing'||!game.isPlayable(index)){message('Kutu ve kapalı bölge hücreleri seçilemez.');return;}
    if(selected===index){selected=null;render();return;}
    if(selected!==null&&game.adjacent(selected,index)){performSwap(selected,index);return;}
    selected=index;render();
  }
  function localPoint(event){const matrix=$('board').getScreenCTM();if(!matrix)return null;const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return {x:point.x,y:point.y};}
  $('board').addEventListener('pointerdown',event=>{
    if(job||paused||saveError||event.button>0)return;const local=localPoint(event),matrix=$('board').getScreenCTM();if(!local||!matrix)return;
    const index=root.HexBoardInput.hitTest(local,layout,matrix);if(index===null||!game.isPlayable(index))return;
    const origin=layout.positions[index],scale=Math.min(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d));
    gesture={id:event.pointerId,index,x:event.clientX,y:event.clientY,local,maxDistance:0,target:null,invalid:false,conflicted:false,neighbors:game.neighbors[index].filter(i=>game.isPlayable(i)).map(i=>{const p=layout.positions[i],dx=p.x-origin.x,dy=p.y-origin.y,distance=Math.hypot(dx,dy);return {index:i,dx,dy,distance,screenDistance:distance*scale};})};
    $('board').setPointerCapture(event.pointerId);event.preventDefault();
  });
  function sample(event){if(gesture&&gesture.id===event.pointerId)root.HexBoardInput.sample(gesture,event,localPoint(event),{width:innerWidth,height:innerHeight});}
  $('board').addEventListener('pointermove',sample);
  $('board').addEventListener('pointerup',event=>{
    if(!gesture||gesture.id!==event.pointerId)return;sample(event);const completed=gesture;gesture=null;
    if(!completed.invalid&&!completed.conflicted){if(completed.target!==null)performSwap(completed.index,completed.target);else if(completed.maxDistance<12)select(completed.index);}
  });
  $('board').addEventListener('pointercancel',()=>{gesture=null;});
  $('board').addEventListener('keydown',event=>{const tile=event.target.closest('[data-index]');if(tile&&['Enter',' '].includes(event.key)){event.preventDefault();select(Number(tile.dataset.index));}});
  function load(id,restart=false){
    cancelPresentation();level=levels.find(entry=>entry.id===id)||levels[0];layout=root.HexBoardView.geometry(level);selected=null;paused=false;saveError=false;
    try{game=new root.HexMatch(level,restart?null:saved.boards[level.id]||null);}catch(_){game=new root.HexMatch(level);saveError=true;message('Kayıt doğrulanamadı. Test bölümünü yeniden başlatabilirsin.');}
    $('level-select').value=level.id;$('level-title').textContent=level.name||level.title;$('instruction').textContent=level.instruction||level.subtitle||'Yan yana iki taşı dokunarak veya sürükleyerek değiştir. Kutuya komşu eşleşme kutuyu kırar.';
    render(projection(),{transition:{reset:true}});
    if(!saveError)try{write();message('İki komşu taşa dokun veya bir taşı komşusuna sürükle.');}catch(_){saveError=true;render();message('Kayıt açılamadı. Tarayıcı depolamasını kontrol et.');}
  }
  for(const entry of levels){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name||entry.title;$('level-select').append(option);}
  let malformed=false;
  try{const raw=localStorage.getItem(KEY);if(raw){const value=JSON.parse(raw);if(value.version!==1||value.levelDataVersion!==DATA_VERSION||!value.boards||typeof value.boards!=='object'||Array.isArray(value.boards))throw new Error('invalid_lab_save');saved=value;}}catch(_){malformed=true;}
  $('level-select').addEventListener('change',()=>load($('level-select').value));
  $('restart').addEventListener('click',()=>load(level.id,true));
  $('pause').addEventListener('click',()=>{cancelPresentation();paused=!paused;render();message(paused?'Oyun duraklatıldı. Devam et ile sürdürebilirsin.':'Devam edebilirsin.');});
  $('proven-move').addEventListener('click',()=>{
    if(job||paused||saveError)return;
    const hint=game.hint({maxNodes:1500,maxDepth:3});if(!hint){message('Önerilecek hamle yok.');return;}
    selected=null;render(projection(),{hinted:hint.pair});message(hint.guaranteed?'Çerçeveli iki komşu taşı değiştir. Doğrulanmış devam yolu kazanır.':'Çerçeveli iki komşu taş yasal bir eşleşme önerisidir; kazanma garantisi yok.');
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){gesture=null;cancelPresentation();}});
  root.addEventListener('pagehide',()=>{gesture=null;cancelPresentation();});
  // A frozen inspection surface exposes copies only; the engine stays private.
  root.HexObstacleLab=Object.freeze({snapshot:()=>game.snapshot(),level:()=>JSON.parse(JSON.stringify(level)),cancelPresentation,performSwap});
  if(malformed){game=new root.HexMatch(levels[0]);level=levels[0];layout=root.HexBoardView.geometry(level);saveError=true;$('level-title').textContent=level.name;$('instruction').textContent=level.instruction||level.subtitle||'';render();message('Test kaydı bozuk. Yeniden başlat ile yalnız bu test kaydını yenileyebilirsin.');}
  else load(saved.activeId);
})(window);
