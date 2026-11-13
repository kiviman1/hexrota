(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const levels = window.HEX_LEVELS;
  const key = 'hexrota-match-v3';
  let migrated=false;
  const pad = n => String(n).padStart(2, '0');
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  let saved = {current:0,done:[],boards:{},sound:false};
  try {
    let raw = JSON.parse(localStorage.getItem(key));
    if(!raw){const previous=JSON.parse(localStorage.getItem('hexrota-match-v2'));if(previous){raw={...previous,boards:{}};migrated=true;}}
    if (raw && typeof raw === 'object') {
      saved.done = Array.isArray(raw.done) ? [...new Set(raw.done.filter(i => Number.isInteger(i) && i>=0 && i<levels.length))] : [];
      saved.current = Number.isInteger(raw.current) && raw.current>=0 && raw.current<levels.length ? raw.current : 0;
      saved.sound = raw.sound === true;
      if (raw.boards && typeof raw.boards === 'object') for(let i=0;i<levels.length;i++) {
        if (raw.boards[i] && typeof raw.boards[i] === 'object') saved.boards[i]=raw.boards[i];
      }
    } else {
      // Sound preference survives the mechanic change; old route progress stays separate.
      const previous = JSON.parse(localStorage.getItem('hexrota-v1'));
      saved.sound = previous?.sound === true;
    }
  } catch (_) {}
  let active=saved.current, engine, selected=null, hinted=null, busy=false, focusIndex=0;
  let pointer=null, toastTimer, terminalTimer, audio, epoch=0, comboText='',presentation=null,hintJob=null;
  const geometryCache=new Map();
  const difficulty=['Isınma','Isınma','Keşif','Keşif','Planlama','Planlama','Zorlu','Zorlu','Ustalık','Ustalık'];
  const canOpen = i => i===0 || saved.done.includes(i-1) || saved.done.includes(i);
  function persist() {
    saved.current=active;
    saved.boards[active]=engine.snapshot();
    try {localStorage.setItem(key,JSON.stringify(saved));} catch (_) {}
  }
  function toast(message) {
    $('toast').textContent=message; $('toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3300);
  }
  function stopPointer() {
    const old=pointer;pointer=null;
    if(old)try{if($('board').hasPointerCapture?.(old.id))$('board').releasePointerCapture(old.id);}catch(_){}
  }
  function openModal(id) {
    stopPointer();
    const dialog=$(id);
    if(!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
  }
  function closeModal(dialog) {if(dialog.open)dialog.close();}
  document.querySelectorAll('dialog').forEach(dialog=>{
    dialog.addEventListener('close',()=>{
      if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');
    });
    dialog.addEventListener('click',e=>{
      if(e.target!==dialog)return;
      const r=dialog.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal(dialog);
    });
    dialog.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(dialog)));
  });
  function tone(value=2,victory=false) {
    if(!saved.sound)return;
    try {
      audio ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audio.state==='suspended')audio.resume().catch(()=>{});
      const play=(f,delay=0)=>{
        const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+delay;
        o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.055,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+.2);
        o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.21);
      };
      if(victory)[523.25,659.25,783.99,1046.5].forEach((f,i)=>play(f,i*.09));else play(300+value*60);
    } catch (_) {}
  }
  function renderSound() {
    $('sound').innerHTML=icon(saved.sound?'sound':'muted');
    $('sound').setAttribute('aria-pressed',String(saved.sound));
    $('sound').setAttribute('aria-label',saved.sound?'Sesi kapat':'Sesi aç');
    $('sound').title=saved.sound?'Sesi kapat':'Sesi aç';
  }
  function renderLevels() {
    $('levels').innerHTML=levels.map((l,i)=>{
      const done=saved.done.includes(i),current=i===active,locked=!canOpen(i);
      return `<button class="level-button${current?' active':''}${done?' done':''}" data-level="${i}" ${locked?'disabled':''} ${current?'aria-current="step"':''} aria-label="Bölüm ${i+1}: ${l.name}${done?', tamamlandı':''}${locked?', kilitli':''}" title="${l.name}${locked?' — Önceki bölümü tamamla':''}"><span class="level-number">${done&&!current?icon('check'):pad(i+1)}</span><span class="level-copy">${l.name}</span>${locked?'<svg class="icon level-status-icon"><use href="#i-lock"/></svg>':''}</button>`;
    }).join('');
    $('completed').textContent=`${saved.done.length} / ${levels.length}`;
    $('journey-fill').style.width=`${saved.done.length/levels.length*100}%`;
  }
  function markCompleted() {
    if(engine.status==='won'&&!saved.done.includes(active)){
      saved.done.push(active);saved.done.sort((a,b)=>a-b);
    }
  }
  function loadLevel(index, fresh=false) {
    cancelPresentation();cancelHint();epoch++;clearTimeout(terminalTimer);stopPointer();busy=false;
    active=canOpen(index)?index:0;
    try {engine=new window.HexMatch(levels[active],fresh?null:saved.boards[active]||null);}
    catch (_) {engine=new window.HexMatch(levels[active]);}
    selected=null;hinted=null;focusIndex=0;comboText='';
    $('level-tag').textContent=`BÖLÜM ${pad(active+1)}`;
    $('level-name').textContent=levels[active].name;
    $('difficulty').textContent=difficulty[active];
    $('target').textContent=levels[active].target;
    $('level-note').textContent=levels[active].subtitle;
    const powers=levels[active].powers||[];
    $('power-tip').textContent=powers.includes('sprout')?'Filiz: beşli veya kesişen eşleşmeden doğar. Eksik zemine doğru büyür.':powers.includes('ring')?'Halka: aynı dört sayıdan doğar. Komşusuyla değiştirince çevresini temizler.':'';
    $('power-tip').hidden=!powers.length;
    markCompleted();renderLevels();render();persist();
  }
  function geometry() {
    if(geometryCache.has(active))return geometryCache.get(active);
    const step=44,radius=40;
    let positions=levels[active].cells.map(c=>({x:1.5*step*c.q,y:Math.sqrt(3)*step*(c.r+c.q/2)}));
    const xs=positions.map(p=>p.x),ys=positions.map(p=>p.y);
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    positions=positions.map(p=>({x:p.x-cx,y:p.y-cy}));
    const width=Math.max(370,Math.max(...xs)-Math.min(...xs)+radius*2+24);
    const height=Math.max(300,Math.max(...ys)-Math.min(...ys)+radius*Math.sqrt(3)+26);
    const data={positions,radius,width,height};geometryCache.set(active,data);return data;
  }
  function boardMarkup(state,matching=[],falling=[],effects=[]) {
    const {positions,radius,width,height}=geometry();
    $('board').setAttribute('viewBox',`${-width/2} ${-height/2} ${width} ${height}`);
    const poly=r=>Array.from({length:6},(_,i)=>`${(r*Math.cos(i*Math.PI/3)).toFixed(3)},${(r*Math.sin(i*Math.PI/3)).toFixed(3)}`).join(' ');
    const outer=poly(radius),inner=poly(radius*.78),matched=new Set(matching),dropped=new Set(falling);
    const interactive=!busy&&engine.status==='playing';
    const targets=new Set(selected!==null?engine.previewPower?.(selected)||[]:[]),powerHits=new Set(effects.flatMap(e=>e.affected)),powerActive=new Set(effects.map(e=>e.index));
    return `<defs><filter id="tile-shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1" flood-color="#3d5031" flood-opacity=".06"/></filter></defs>${levels[active].cells.map((c,i)=>{
      const left=state.layers[i],green=left===0,partial=left>0&&left<(c.layers||1),power=(state.specials||engine.specials||[])[i];
      const classes=['hex-tile',`value-${state.values[i]}`,green?'floor-green':partial?'floor-partial':'floor-untouched',c.layers===2?'layered':'',selected===i?'selected':'',hinted?.includes(i)?'hinted':'',selected!==null&&engine.adjacent(selected,i)?'neighbor':'',matched.has(i)?'matching':'',dropped.has(i)?'falling':'',power?`power-${power}`:'',targets.has(i)?'power-target':'',powerHits.has(i)?'power-hit':'',powerActive.has(i)?'power-active':''].filter(Boolean).join(' ');
      const p=positions[i],ground=green?'zemin yeşil':`${left} eşleşme gerekiyor`;
      return `<g transform="translate(${p.x},${p.y})" class="${classes}" data-index="${i}" role="button" tabindex="${i===focusIndex?0:-1}" aria-label="${state.values[i]} sayısı${power?`, ${power==='ring'?'Halka':'Filiz'} taşı`:''}, ${ground}${selected===i?', seçili':''}${hinted?.includes(i)?', ipucu':''}" aria-pressed="${selected===i}" aria-disabled="${!interactive}"><polygon class="floor-shape" points="${outer}"/><g class="gem"><polygon class="gem-shape" points="${inner}"/><text class="hex-number" text-anchor="middle" x="0" y="${power?-5:0}">${state.values[i]}</text>${power?powerGlyph(power):''}</g>${green?'<path class="floor-mark" d="m-4 29 3 3 6-7"/>':c.layers===2?`<text class="layer-count" text-anchor="middle" x="0" y="31">${left}</text>`:''}</g>`;
    }).join('')}${powerOverlay(effects,positions)}`;
  }
  function powerOverlay(effects,positions){
    return `<g class="power-effects" aria-hidden="true">${effects.map(e=>{const p=positions[e.index],points=e.affected.map(i=>`${positions[i].x},${positions[i].y}`).join(' ');return e.type==='ring'?`<g class="effect-ring"><circle cx="${p.x}" cy="${p.y}" r="68"/>${e.affected.filter(i=>i!==e.index).map(i=>`<path d="M${p.x} ${p.y}L${positions[i].x} ${positions[i].y}"/>`).join('')}</g>`:`<g class="effect-sprout"><polyline points="${points}"/>${e.affected.map(i=>`<circle cx="${positions[i].x}" cy="${positions[i].y}" r="5"/>`).join('')}</g>`;}).join('')}</g>`;
  }
  function render(state=null,options={}) {
    const display=state||{values:engine.values,layers:engine.layers,specials:engine.specials,score:engine.score,movesLeft:engine.movesLeft};
    const focused=document.activeElement?.closest?.('[data-index]')?.dataset.index;
    $('board').innerHTML=boardMarkup(display,options.matching||[],options.falling||[],options.effects||[]);
    if(focused!==undefined)$('board').querySelector(`[data-index="${focused}"]`)?.focus?.({preventScroll:true});
    const covered=display.layers.filter(n=>n===0).length,total=levels[active].cells.length;
    $('sum').textContent=display.score;
    $('moves-left').textContent=display.movesLeft;
    $('moves-left').closest('.moves-badge')?.classList.toggle('low',display.movesLeft<=3);
    $('move-counter').textContent=`${levels[active].moves-display.movesLeft} / ${levels[active].moves} HAMLE`;
    $('coverage').textContent=`${covered} / ${total}`;
    $('coverage-ring').style.strokeDashoffset=String(87.965*(1-covered/total));
    $('hint').disabled=busy||!!hintJob||engine.status!=='playing';
    $('hint').querySelector('span').textContent=hintJob?'Aranıyor…':'İpucu';
    $('reset').disabled=false;
    $('skip-animation').hidden=!busy;
    $('continue').hidden=busy||engine.status==='playing';
    $('continue').textContent=engine.status==='lost'?'Yeniden dene →':'Devam et →';
    $('board').setAttribute('aria-busy',String(busy));
    $('board-stage').classList.toggle('busy',busy);
    $('last-combo').textContent=comboText;
    const power=selected!==null?(engine.specials||[])[selected]:null;
    $('special-preview').hidden=!power;
    $('special-preview').textContent=power==='ring'?'Halka · Takastan sonraki konumunda merkezi ve altı komşusu temizlenir.':power==='sprout'?'Filiz · Takastan sonraki konumundan eksik zemine doğru en fazla üç adım büyür.':'';
    const status=$('board-status');status.className='board-status';
    let text;
    if(options.message)text=options.message;
    else if(engine.status==='won') {text='Hedef tamam, bütün zemin yeşil. Başardın!';status.classList.add('success');}
    else if(engine.status==='lost'){text='Hamleler bitti. Aynı tahtada yeni bir plan deneyebilirsin.';status.classList.add('error');}
    else if(selected!==null)text='Şimdi komşu bir taşı seç. Üç aynı sayıyı hizala.';
    else if(engine.score>=levels[active].target)text=`Puan hedefi tamam! ${total-covered} zemini daha yeşile boya.`;
    else text='Bir taş seç; komşusuyla değiştirip üçlüyü oluştur.';
    $('status-text').textContent=text;
  }
  function powerGlyph(type) {
    return type==='ring'?'<g class="power-symbol ring" transform="translate(0 17)" aria-hidden="true"><circle r="7"/><circle r="2"/><path d="M0-11v2m0 18v2M-9.5-5.5l1.8 1M7.7 4.5l1.8 1M-9.5 5.5l1.8-1M7.7-4.5l1.8-1"/></g>':'<g class="power-symbol sprout" transform="translate(0 17)" aria-hidden="true"><path d="M0 9V0m0 3C-9 3-10-4-10-4S-1-5 0 3Zm0-3C9 0 10-7 10-7S1-8 0 0Z"/></g>';
  }
  const canAnimate=()=>!document.hidden&&!reduceMotion()&&typeof window.Element.prototype.animate==='function';
  function cancelPresentation() {
    const job=presentation;presentation=null;busy=false;
    if(job){clearTimeout(job.watchdog);job.controller.abort();for(const a of job.animations)try{a.cancel?.();}catch(_){}}
  }
  function finishPresentation(job) {
    if(!job||presentation!==job||job.token!==epoch)return;
    cancelPresentation();
    const result=job.result;
    const powers=result.frames.flatMap(f=>f.activated||[]);
    comboText=`${powers.length?'Özel etki · ':''}${result.frames.length>1?`${result.frames.length} zincir · `:''}+${result.scoreGain} puan${result.reshuffled?' · Karıştırıldı':''}`;
    try{renderLevels();render();persist();}
    catch(_){persist();}
    finally{
      busy=false;$('board').setAttribute('aria-busy','false');$('board-stage').classList.remove('busy');$('reset').disabled=false;$('skip-animation').hidden=true;
    }
    if(result.reshuffled)toast('Eşleşme kalmadı; sayılar karıştırıldı. Zemin ve hamlelerin korundu.');
    if(engine.status!=='playing'&&!document.hidden){
      terminalTimer=setTimeout(()=>{if(job.token===epoch&&!document.querySelector('dialog[open]'))showResult();},80);
    }
  }
  function pause(ms,job) {
    if(job.controller.signal.aborted)return Promise.resolve();
    return new Promise(resolve=>{
      const done=()=>{clearTimeout(timer);job.controller.signal.removeEventListener('abort',done);resolve();};
      const timer=setTimeout(done,ms);job.controller.signal.addEventListener('abort',done,{once:true});
    });
  }
  async function presentSwap(job,a,b,before) {
    if(!canAnimate())return;
    render(before);
    const pos=geometry().positions,dx=pos[b].x-pos[a].x,dy=pos[b].y-pos[a].y;
    for(const [i,x,y]of[[a,dx,dy],[b,-dx,-dy]]){
      const gem=$('board').querySelector(`[data-index="${i}"] .gem`);
      if(gem)job.animations.push(gem.animate([{transform:'translate(0px,0px)'},{transform:`translate(${x}px,${y}px)`}],{duration:110,easing:'ease-in-out',fill:'forwards'}));
    }
    await pause(115,job);
    const frames=job.result.frames;
    // Show key waves; the engine has already resolved every wave exactly once.
    let indices=frames.map((_,i)=>i);
    if(indices.length>4){const special=frames.findIndex((f,i)=>i>1&&(f.activated||[]).length);indices=[...new Set([0,1,special>1?special:2,frames.length-1])].sort((x,y)=>x-y);}
    for(const i of indices){
      if(job.controller.signal.aborted||presentation!==job||!canAnimate())return;
      const f=frames[i],prior=i?frames[i-1]:null;
      const score=before.score+frames.slice(0,i).reduce((n,frame)=>n+frame.scoreGain,0);
      const clearTime=(f.activated||[]).length?135:90;
      $('board').style.setProperty('--clear-duration',`${clearTime}ms`);$('board').style.setProperty('--fall-duration','55ms');
      comboText=`${i?`Zincir ×${i+1} · `:''}+${f.scoreGain} puan`;
      render({values:f.before,layers:prior?prior.layers:before.layers,specials:f.beforeSpecials||before.specials,score,movesLeft:engine.movesLeft},{matching:f.removed||f.matched,effects:f.activated||[],message:(f.activated||[]).length?'Özel taş çalışıyor; zemin açılıyor.':i?'Zincirleme eşleşme!':'Eşleşti! Zemin yeşilleniyor.'});
      tone(Math.min(5,i+1));await pause(clearTime+5,job);
      if(job.controller.signal.aborted||presentation!==job)return;
      render({values:f.after,layers:f.layers,specials:f.afterSpecials||engine.specials,score:score+f.scoreGain,movesLeft:engine.movesLeft},{falling:f.matched,message:'Yeni sayılar yerleşiyor…'});
      await pause(60,job);
    }
  }
  async function performSwap(a,b) {
    if(busy){finishPresentation(presentation);return;}
    if(engine.status!=='playing')return;
    cancelHint();
    const checkpoint=engine.snapshot(),before={values:engine.values.slice(),layers:engine.layers.slice(),specials:(engine.specials||[]).slice(),score:engine.score,movesLeft:engine.movesLeft};
    let result;
    try{result=engine.swap(a,b);}catch(_){
      try{engine=new window.HexMatch(levels[active],checkpoint);}catch(_){engine=new window.HexMatch(levels[active]);}
      selected=null;render();toast('Bu hamle tamamlanamadı. Tahta geri yüklendi; tekrar deneyebilirsin.');return;
    }
    if(!result.ok){
      selected=null;hinted=null;render();
      toast(engine.adjacent(a,b)?'Bu takas üçlü oluşturmuyor. Hamlen harcanmadı.':'Sadece komşu iki taşı değiştirebilirsin.');
      return;
    }
    const job={token:++epoch,result,controller:new AbortController(),animations:[],watchdog:null};
    presentation=job;busy=true;selected=null;hinted=null;comboText='';
    try{
      markCompleted();persist();renderLevels();
      job.watchdog=setTimeout(()=>finishPresentation(job),1000);
      await presentSwap(job,a,b,before);
    }catch(_){/* Presentation failure must never lock committed game state. */}
    finally{finishPresentation(job);}
  }
  function select(index) {
    if(busy){finishPresentation(presentation);return;}
    if(engine.status!=='playing')return;
    focusIndex=index;hinted=null;
    if(selected===index){selected=null;render();return;}
    if(selected!==null&&engine.adjacent(selected,index)) {const a=selected;performSwap(a,index);return;}
    selected=index;render();
  }
  function showVictory() {
    const final=active===levels.length-1;
    $('win-eyebrow').textContent=final?'10 BÖLÜMLÜK YOLCULUK TAMAMLANDI':`BÖLÜM ${pad(active+1)} TAMAMLANDI`;
    $('win-title').textContent=final?'Usta işi!':'Güzel eşleşme!';
    $('win-description').textContent=final?'Bütün tahtaları yeşerttin. Her hamlen bir planın parçasıydı.':`${engine.movesLeft} hamle kala hem puan hedefini hem yeşil alanı tamamladın.`;
    $('win-total').textContent=engine.score;$('win-moves').textContent=engine.movesLeft;
    $('next').innerHTML=`${final?'İlk bölüme dön':`Bölüm ${pad(active+2)} ile devam et`} ${icon('arrow')}`;
    $('confetti').innerHTML=reduceMotion()?'':Array.from({length:18},(_,i)=>`<i class="confetti-piece" style="left:${i*37%100}%;background:${['#9bbe73','#c4e89b','#b8a5cf','#dbdfb9'][i%4]};--drift:${(i%2?1:-1)*(20+i*2)}px;animation-delay:${i%7*.06}s"></i>`).join('');
    tone(0,true);openModal('win-dialog');
  }
  function showLoss() {
    $('lose-title').textContent='Bir plan daha?';
    $('lose-description').textContent='Hamlelerin bitti. Önce eksik kalan zeminleri hedefleyerek aynı tahtayı yeniden deneyebilirsin.';
    $('lose-score').textContent=`${engine.score} / ${levels[active].target}`;
    $('lose-coverage').textContent=`${engine.covered} / ${levels[active].cells.length}`;
    openModal('lose-dialog');
  }
  function showResult() {if(engine.status==='won')showVictory();else if(engine.status==='lost')showLoss();}
  function restart() {
    document.querySelectorAll('dialog[open]').forEach(closeModal);
    loadLevel(active,true);toast('Aynı tahta, aynı yeni sayılar. Bu kez başka bir plan dene.');
  }
  function cancelHint(){const job=hintJob;hintJob=null;if(job){clearTimeout(job.timer);job.worker?.terminate();job.resolve?.(null);}}
  async function hint(){
    if(busy||hintJob||engine.status!=='playing')return;
    const job={token:epoch,game:engine,worker:null,timer:null,resolve:null};hintJob=job;render();
    let suggestion=null;
    try{
      if(typeof window.Worker==='function'){
        suggestion=await new Promise(resolve=>{
          job.resolve=resolve;
          try{
            job.worker=new Worker('./hint-worker.js?v=3');
            job.worker.onmessage=e=>resolve(e.data?.hint||null);
            job.worker.onerror=e=>{e.preventDefault?.();resolve(null);};
            job.worker.postMessage({level:levels[active],snapshot:engine.snapshot()});
            job.timer=setTimeout(()=>resolve(null),600);
          }catch(_){resolve(null);}
        });
      }
      if(hintJob!==job||job.token!==epoch||job.game!==engine)return;
      if(!suggestion)suggestion=engine.hint({maxMs:12,maxDepth:1});
      if(suggestion?.pair){selected=null;hinted=suggestion.pair;toast('Parlayan iki taşı değiştir. Özel taşları eksik zemine yakın kullan.');}
      else toast('Şu anda ipucu bulunamadı. Başka bir üçlü arayabilirsin.');
    }catch(_){toast('İpucu şu anda hazır değil. Oynamaya devam edebilirsin.');}
    finally{if(hintJob===job){cancelHint();render();}}
  }
  $('levels').addEventListener('click',e=>{
    const b=e.target.closest('[data-level]');if(!b||b.disabled||+b.dataset.level===active)return;
    persist();loadLevel(+b.dataset.level);
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
  $('board').addEventListener('pointerdown',e=>{
    if(e.isPrimary===false||(e.button!==0&&e.pointerType!=='touch'))return;
    if(busy){e.preventDefault();finishPresentation(presentation);return;}
    if(engine.status!=='playing'||pointer)return;
    const tile=e.target.closest('[data-index]');if(!tile)return;
    e.preventDefault();pointer={id:e.pointerId,index:+tile.dataset.index,x:e.clientX,y:e.clientY};
    try{$('board').setPointerCapture?.(e.pointerId);}catch(_){}
  });
  window.addEventListener('pointermove',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    if(e.pointerType!=='touch'&&e.buttons===0)stopPointer();
    // No selection mutation here: jitter over the same tile remains a tap.
  });
  window.addEventListener('pointerup',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    const start=pointer,target=tileAt(e);stopPointer();
    if(target===null)return;
    if(target===start.index)select(target);
    else if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>=6)performSwap(start.index,target);
    else select(target);
  });
  $('board').addEventListener('lostpointercapture',stopPointer);
  window.addEventListener('pointercancel',stopPointer);
  window.addEventListener('blur',()=>{stopPointer();if(presentation)finishPresentation(presentation);});
  document.addEventListener('visibilitychange',()=>{stopPointer();if(document.hidden&&presentation)finishPresentation(presentation);});
  window.addEventListener('pagehide',()=>{stopPointer();if(presentation)finishPresentation(presentation);});
  $('board').addEventListener('click',e=>{if(e.detail===0){const tile=e.target.closest('[data-index]');if(tile)select(+tile.dataset.index);}});
  $('board').addEventListener('keydown',e=>{
    const tile=e.target.closest('[data-index]');if(!tile)return;if(busy){e.preventDefault();finishPresentation(presentation);return;}
    const index=+tile.dataset.index;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();select(index);return;}
    const direction={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!direction)return;
    e.preventDefault();const positions=geometry().positions,p=positions[index];
    const next=levels[active].cells.map((_,i)=>i).filter(i=>engine.adjacent(index,i)).map(i=>{const dx=positions[i].x-p.x,dy=positions[i].y-p.y;return {i,score:(dx*direction[0]+dy*direction[1])/Math.hypot(dx,dy)};}).filter(n=>n.score>0).sort((a,b)=>b.score-a.score)[0];
    if(next){focusIndex=next.i;for(const n of $('board').querySelectorAll('[data-index]'))n.setAttribute('tabindex',+n.dataset.index===focusIndex?'0':'-1');$('board').querySelector(`[data-index="${focusIndex}"]`)?.focus?.();}
  });
  $('skip-animation').addEventListener('click',()=>finishPresentation(presentation));
  $('reset').addEventListener('click',restart);$('retry').addEventListener('click',restart);$('hint').addEventListener('click',hint);
  $('help').addEventListener('click',()=>openModal('help-dialog'));
  $('sound').addEventListener('click',()=>{saved.sound=!saved.sound;renderSound();persist();if(saved.sound)tone(3);});
  $('continue').addEventListener('click',showResult);
  $('next').addEventListener('click',()=>{closeModal($('win-dialog'));loadLevel(active<levels.length-1?active+1:0,active===levels.length-1);});
  $('review').addEventListener('click',()=>closeModal($('win-dialog')));
  window.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||document.querySelector('dialog[open]')||['INPUT','TEXTAREA'].includes(e.target.tagName))return;
    if(e.key.toLowerCase()==='r'){e.preventDefault();restart();}
    if(e.key.toLowerCase()==='h'){e.preventDefault();hint();}
    if(e.key==='Escape'&&!busy){selected=null;hinted=null;render();}
  });
  renderSound();loadLevel(active);
  if(migrated)toast('Tamamladığın bölümler korundu. Yeni taşlar için mevcut tahta yenilendi.');
})();
