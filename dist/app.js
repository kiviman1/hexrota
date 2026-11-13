(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const levels = window.HEX_LEVELS;
  const key = 'hexrota-match-v2';
  const pad = n => String(n).padStart(2, '0');
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  let saved = {current:0,done:[],boards:{},sound:false};
  try {
    const raw = JSON.parse(localStorage.getItem(key));
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
  let pointer=null, toastTimer, terminalTimer, audio, epoch=0, comboText='';
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
  function stopPointer() {pointer=null;}
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
      if(audio.state==='suspended')audio.resume();
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
      return `<button class="level-button${current?' active':''}${done?' done':''}" data-level="${i}" ${locked||busy?'disabled':''} ${current?'aria-current="step"':''} aria-label="Bölüm ${i+1}: ${l.name}${done?', tamamlandı':''}${locked?', kilitli':''}" title="${l.name}${locked?' — Önceki bölümü tamamla':''}"><span class="level-number">${done&&!current?icon('check'):pad(i+1)}</span><span class="level-copy">${l.name}</span>${locked?'<svg class="icon level-status-icon"><use href="#i-lock"/></svg>':''}</button>`;
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
    epoch++;clearTimeout(terminalTimer);stopPointer();busy=false;
    active=canOpen(index)?index:0;
    try {engine=new window.HexMatch(levels[active],fresh?null:saved.boards[active]||null);}
    catch (_) {engine=new window.HexMatch(levels[active]);}
    selected=null;hinted=null;focusIndex=0;comboText='';
    $('level-tag').textContent=`BÖLÜM ${pad(active+1)}`;
    $('level-name').textContent=levels[active].name;
    $('difficulty').textContent=difficulty[active];
    $('target').textContent=levels[active].target;
    $('level-note').textContent=levels[active].subtitle;
    markCompleted();renderLevels();render();persist();
  }
  function geometry() {
    const step=44,radius=40;
    let positions=levels[active].cells.map(c=>({x:1.5*step*c.q,y:Math.sqrt(3)*step*(c.r+c.q/2)}));
    const xs=positions.map(p=>p.x),ys=positions.map(p=>p.y);
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    positions=positions.map(p=>({x:p.x-cx,y:p.y-cy}));
    const width=Math.max(370,Math.max(...xs)-Math.min(...xs)+radius*2+24);
    const height=Math.max(300,Math.max(...ys)-Math.min(...ys)+radius*Math.sqrt(3)+26);
    return {positions,radius,width,height};
  }
  function boardMarkup(state,matching=[],falling=[]) {
    const {positions,radius,width,height}=geometry();
    $('board').setAttribute('viewBox',`${-width/2} ${-height/2} ${width} ${height}`);
    const poly=r=>Array.from({length:6},(_,i)=>`${(r*Math.cos(i*Math.PI/3)).toFixed(3)},${(r*Math.sin(i*Math.PI/3)).toFixed(3)}`).join(' ');
    const outer=poly(radius),inner=poly(radius*.78),matched=new Set(matching),dropped=new Set(falling);
    const interactive=!busy&&engine.status==='playing';
    return `<defs><filter id="tile-shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1" flood-color="#3d5031" flood-opacity=".06"/></filter></defs>${levels[active].cells.map((c,i)=>{
      const left=state.layers[i],green=left===0,partial=left>0&&left<(c.layers||1);
      const classes=['hex-tile',`value-${state.values[i]}`,green?'floor-green':partial?'floor-partial':'floor-untouched',c.layers===2?'layered':'',selected===i?'selected':'',hinted?.includes(i)?'hinted':'',selected!==null&&engine.adjacent(selected,i)?'neighbor':'',matched.has(i)?'matching':'',dropped.has(i)?'falling':''].filter(Boolean).join(' ');
      const p=positions[i],ground=green?'zemin yeşil':`${left} eşleşme gerekiyor`;
      return `<g transform="translate(${p.x},${p.y})" class="${classes}" data-index="${i}" role="button" tabindex="${i===focusIndex?0:-1}" aria-label="${state.values[i]} sayısı, ${ground}${selected===i?', seçili':''}${hinted?.includes(i)?', ipucu':''}" aria-pressed="${selected===i}" aria-disabled="${!interactive}"><polygon class="floor-shape" points="${outer}"/><g class="gem"><polygon class="gem-shape" points="${inner}"/><text class="hex-number" text-anchor="middle" x="0" y="0">${state.values[i]}</text></g>${green?'<path class="floor-mark" d="m-4 29 3 3 6-7"/>':c.layers===2?`<text class="layer-count" text-anchor="middle" x="0" y="31">${left}</text>`:''}</g>`;
    }).join('')}`;
  }
  function render(state=null,options={}) {
    const display=state||{values:engine.values,layers:engine.layers,score:engine.score,movesLeft:engine.movesLeft};
    const focused=document.activeElement?.closest?.('[data-index]')?.dataset.index;
    $('board').innerHTML=boardMarkup(display,options.matching||[],options.falling||[]);
    if(focused!==undefined)$('board').querySelector(`[data-index="${focused}"]`)?.focus?.({preventScroll:true});
    const covered=display.layers.filter(n=>n===0).length,total=levels[active].cells.length;
    $('sum').textContent=display.score;
    $('moves-left').textContent=display.movesLeft;
    $('moves-left').closest('.moves-badge')?.classList.toggle('low',display.movesLeft<=3);
    $('move-counter').textContent=`${levels[active].moves-display.movesLeft} / ${levels[active].moves} HAMLE`;
    $('coverage').textContent=`${covered} / ${total}`;
    $('coverage-ring').style.strokeDashoffset=String(87.965*(1-covered/total));
    $('hint').disabled=busy||engine.status!=='playing';
    $('reset').disabled=busy;
    $('continue').hidden=busy||engine.status==='playing';
    $('continue').textContent=engine.status==='lost'?'Yeniden dene →':'Devam et →';
    $('board').setAttribute('aria-busy',String(busy));
    $('board-stage').classList.toggle('busy',busy);
    $('last-combo').textContent=comboText;
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
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const canAnimate=()=>!reduceMotion()&&typeof window.Element.prototype.animate==='function';
  async function swapMotion(a,b,before) {
    if(!canAnimate())return;
    render(before);
    const positions=geometry().positions,dx=positions[b].x-positions[a].x,dy=positions[b].y-positions[a].y;
    for(const [index,x,y] of [[a,dx,dy],[b,-dx,-dy]]) {
      $('board').querySelector(`[data-index="${index}"] .gem`)?.animate([{transform:'translate(0px,0px)'},{transform:`translate(${x}px,${y}px)`}],{duration:170,easing:'ease-in-out',fill:'forwards'});
    }
    await wait(175);
  }
  async function performSwap(a,b) {
    if(busy||engine.status!=='playing')return;
    const before={values:engine.values.slice(),layers:engine.layers.slice(),score:engine.score,movesLeft:engine.movesLeft};
    const result=engine.swap(a,b);
    if(!result.ok) {
      selected=null;hinted=null;render();
      toast(engine.adjacent(a,b)?'Bu takas üçlü oluşturmuyor. Hamlen harcanmadı.':'Sadece komşu iki taşın yerini değiştirebilirsin.');
      for(const i of [a,b]){
        const tile=$('board').querySelector(`[data-index="${i}"]`);
        tile?.classList.add('hex-error');
        setTimeout(()=>tile?.classList.remove('hex-error'),350);
      }
      return;
    }
    const token=++epoch;busy=true;selected=null;hinted=null;comboText='';
    markCompleted();persist();renderLevels();
    await swapMotion(a,b,before);
    let score=before.score,layers=before.layers;
    for(let i=0;i<result.frames.length;i++) {
      if(token!==epoch)return;
      const frame=result.frames[i];
      const fast=result.frames.length>5&&i>=3,clearTime=fast?65:180,fallTime=fast?45:120;
      $('board').style.setProperty('--clear-duration',`${clearTime}ms`);
      $('board').style.setProperty('--fall-duration',`${fallTime}ms`);
      comboText=`${i>0?`Zincir ×${i+1} · `:''}+${frame.scoreGain} puan`;
      render({values:frame.before,layers,score,movesLeft:engine.movesLeft},{matching:frame.matched,message:i?'Zincirleme eşleşme! Tek hamle, yeni fırsatlar.':'Eşleşti! Sayılar gidiyor, zemin yeşilleniyor.'});
      tone(Math.min(5,i+1));
      if(canAnimate())await wait(clearTime);
      if(token!==epoch)return;
      score+=frame.scoreGain;layers=frame.layers;
      const changed=frame.after.map((v,j)=>v!==frame.before[j]||frame.matched.includes(j)?j:-1).filter(j=>j>=0);
      render({values:frame.after,layers,score,movesLeft:engine.movesLeft},{falling:changed,message:'Yeni sayılar yerleşiyor…'});
      if(canAnimate())await wait(fallTime);
    }
    if(token!==epoch)return;
    busy=false;
    comboText=`${result.frames.length>1?`${result.frames.length} zincir · `:''}+${result.scoreGain} puan${result.reshuffled?' · Tahta karıştırıldı':''}`;
    renderLevels();render();persist();
    if(result.reshuffled)toast('Eşleşme kalmadı; sayılar karıştırıldı. Zemin ve hamlelerin korundu.');
    if(engine.status!=='playing') {
      terminalTimer=setTimeout(()=>{if(token===epoch&&!document.querySelector('dialog[open]'))showResult();},canAnimate()?450:0);
    }
  }
  function select(index) {
    if(busy||engine.status!=='playing')return;
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
    if(busy)return;
    document.querySelectorAll('dialog[open]').forEach(closeModal);
    loadLevel(active,true);toast('Aynı tahta, aynı yeni sayılar. Bu kez başka bir plan dene.');
  }
  function hint() {
    if(busy||engine.status!=='playing')return;
    const suggestion=engine.hint();
    if(suggestion?.pair){selected=null;hinted=suggestion.pair;render();toast('Parlayan iki taşın yerini değiştir. Eksik zeminleri de gözet.');}
    else toast('Şu anda ipucu bulunamadı. Başka bir üçlü arayabilirsin.');
  }
  $('levels').addEventListener('click',e=>{
    const b=e.target.closest('[data-level]');if(!b||b.disabled||busy||+b.dataset.level===active)return;
    persist();loadLevel(+b.dataset.level);
  });
  $('board').addEventListener('pointerdown',e=>{
    if(busy||engine.status!=='playing'||pointer||e.isPrimary===false||(e.button!==0&&e.pointerType!=='touch'))return;
    const tile=e.target.closest('[data-index]');if(!tile)return;
    e.preventDefault();pointer={id:e.pointerId,index:+tile.dataset.index,x:e.clientX,y:e.clientY,moved:false};
  });
  window.addEventListener('pointermove',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    if(e.pointerType!=='touch'&&e.buttons===0){stopPointer();return;}
    if(!pointer.moved&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>9){pointer.moved=true;selected=pointer.index;hinted=null;render();}
  });
  window.addEventListener('pointerup',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    const start=pointer;stopPointer();
    const hit=document.elementFromPoint?.(e.clientX,e.clientY)||e.target;
    const tile=hit?.closest?.('[data-index]');
    if(!tile||!$('board').contains(tile)){selected=null;render();return;}
    const target=+tile.dataset.index;
    if(start.moved&&target!==start.index){performSwap(start.index,target);return;}
    if(!start.moved)select(target);
  });
  window.addEventListener('pointercancel',stopPointer);window.addEventListener('blur',stopPointer);
  $('board').addEventListener('click',e=>{if(e.detail===0){const tile=e.target.closest('[data-index]');if(tile)select(+tile.dataset.index);}});
  $('board').addEventListener('keydown',e=>{
    const tile=e.target.closest('[data-index]');if(!tile||busy)return;
    const index=+tile.dataset.index;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();select(index);return;}
    const direction={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!direction)return;
    e.preventDefault();const positions=geometry().positions,p=positions[index];
    const next=levels[active].cells.map((_,i)=>i).filter(i=>engine.adjacent(index,i)).map(i=>{const dx=positions[i].x-p.x,dy=positions[i].y-p.y;return {i,score:(dx*direction[0]+dy*direction[1])/Math.hypot(dx,dy)};}).filter(n=>n.score>0).sort((a,b)=>b.score-a.score)[0];
    if(next){focusIndex=next.i;for(const n of $('board').querySelectorAll('[data-index]'))n.setAttribute('tabindex',+n.dataset.index===focusIndex?'0':'-1');$('board').querySelector(`[data-index="${focusIndex}"]`)?.focus?.();}
  });
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
})();
