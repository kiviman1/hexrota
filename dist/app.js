(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const levels = window.HEX_LEVELS;
  const key = 'hexrota-v1';
  const pad = n => String(n).padStart(2, '0');
  const icons = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  let saved = {current:0, done:[], routes:{}, sound:false};
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    if (raw && typeof raw === 'object') {
      saved.done = Array.isArray(raw.done) ? [...new Set(raw.done.filter(n => Number.isInteger(n) && n >= 0 && n < 10))] : [];
      saved.current = Number.isInteger(raw.current) && raw.current >= 0 && raw.current < 10 ? raw.current : 0;
      saved.routes = {};
      if (raw.routes && typeof raw.routes === 'object') for (let i=0;i<10;i++) {
        if (Array.isArray(raw.routes[i]) && raw.routes[i].length <= 46) saved.routes[i] = raw.routes[i];
      }
      saved.sound = raw.sound === true;
    }
  } catch (_) { /* Storage is optional, the game remains playable. */ }
  let active = saved.current, engine, hinted = null, dragging = false, dragLast = null, activePointer = null;
  let toastTimer, winTimer, audio;
  const difficulty = ['Isınma','Isınma','Keşif','Keşif','Düşünce','Düşünce','Zorlu','Zorlu','Ustalık','Ustalık'];
  const persist = () => {
    saved.current = active;
    saved.routes[active] = engine.path.slice();
    try { localStorage.setItem(key, JSON.stringify(saved)); } catch (_) {}
  };
  function notify(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000);
  }
  function openModal(id) {
    stopDrag();
    const dialog = $(id);
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
  }
  function closeModal(dialog) { dialog.close(); }
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      if (![...document.querySelectorAll('dialog')].some(d => d.open)) document.body.classList.remove('modal-open');
    });
    dialog.addEventListener('click', e => {
      if (e.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(dialog);
      }
    });
    dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(dialog)));
  });
  function sound(value = 2, win = false) {
    if (!saved.sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const play = (frequency, offset = 0) => {
        const osc = audio.createOscillator(), gain = audio.createGain(), time = audio.currentTime + offset;
        osc.type = 'sine'; osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.06, time + .012); gain.gain.exponentialRampToValueAtTime(.001, time + .2);
        osc.connect(gain); gain.connect(audio.destination); osc.start(time); osc.stop(time + .21);
      };
      if (win) [523.25,659.25,783.99,1046.5].forEach((f,i) => play(f,i*.09));
      else play(280 + value * 35);
    } catch (_) {}
  }
  function renderSound() {
    $('sound').innerHTML = icons(saved.sound ? 'sound' : 'muted');
    $('sound').setAttribute('aria-pressed', String(saved.sound));
    $('sound').setAttribute('aria-label', saved.sound ? 'Sesi kapat' : 'Sesi aç');
    $('sound').title = saved.sound ? 'Sesi kapat' : 'Sesi aç';
  }
  function unlocked(i) { return i === 0 || saved.done.includes(i - 1) || saved.done.includes(i); }
  function renderLevels() {
    $('levels').innerHTML = levels.map((l,i) => {
      const done = saved.done.includes(i), selected = i === active, locked = !unlocked(i);
      return `<button class="level-button${selected ? ' active' : ''}${done ? ' done' : ''}" data-level="${i}" ${locked ? 'disabled' : ''} ${selected ? 'aria-current="step"' : ''} aria-label="Bölüm ${i+1}: ${l.name}${done ? ', tamamlandı' : ''}${locked ? ', kilitli' : ''}" title="${l.name}${locked ? ' — Önce bir önceki bölümü tamamla' : ''}"><span class="level-number">${done && !selected ? icons('check') : pad(i+1)}</span><span class="level-copy">${l.name}</span>${locked ? '<svg class="icon level-status-icon"><use href="#i-lock"/></svg>' : ''}</button>`;
    }).join('');
    $('completed').textContent = `${saved.done.length} / 10`;
    $('journey-fill').style.width = `${saved.done.length * 10}%`;
  }
  function loadLevel(index) {
    clearTimeout(winTimer);
    active = index;
    if (!unlocked(active)) active = 0;
    let route = saved.routes[active];
    try { engine = new window.HexEngine(levels[active], Array.isArray(route) ? route : []); }
    catch (_) { engine = new window.HexEngine(levels[active]); }
    hinted = null;
    $('level-tag').textContent = `BÖLÜM ${pad(active + 1)}`;
    $('level-name').textContent = levels[active].name;
    $('difficulty').textContent = difficulty[active];
    $('target').textContent = levels[active].target;
    $('level-note').textContent = levels[active].subtitle;
    renderLevels(); render(); persist();
  }
  function boardMarkup() {
    const level = levels[active], step = 44, radius = 40;
    let positions = level.cells.map(c => ({x:1.5 * step * c.q, y:Math.sqrt(3) * step * (c.r + c.q / 2)}));
    const xs = positions.map(c => c.x), ys = positions.map(c => c.y);
    const cx = (Math.max(...xs) + Math.min(...xs))/2, cy = (Math.max(...ys) + Math.min(...ys))/2;
    positions = positions.map(p => ({x:p.x-cx, y:p.y-cy}));
    const width = Math.max(500,Math.max(...xs)-Math.min(...xs)+2*radius+50);
    const height = Math.max(340,Math.max(...ys)-Math.min(...ys)+Math.sqrt(3)*radius+38);
    $('board').setAttribute('viewBox', `${-width/2} ${-height/2} ${width} ${height}`);
    const points = Array.from({length:6},(_,i) => `${(radius*Math.cos(i*Math.PI/3)).toFixed(3)},${(radius*Math.sin(i*Math.PI/3)).toFixed(3)}`).join(' ');
    const last = engine.path.at(-1), neighbors = last === undefined ? [] : engine.neighbors[last];
    const line = engine.path.length > 1 ? `<polyline class="route-line" points="${engine.path.map(i => `${positions[i].x},${positions[i].y}`).join(' ')}"/>` : '';
    return `<defs><filter id="tile-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="1" flood-color="#3d5031" flood-opacity=".055"/></filter></defs>${line}${level.cells.map((c,i) => {
      const count = engine.counts[i], current = i === last;
      const legal = engine.status === 'playing' && count < c.cap && (last === undefined || neighbors.includes(i));
      const p = positions[i];
      const classes = ['hex-tile',count ? 'visited' : '',count === 2 ? 'used-twice' : '',current ? 'current' : '',hinted === i ? 'hinted' : '',legal ? 'legal' : ''].filter(Boolean).join(' ');
      return `<g transform="translate(${p.x},${p.y})" class="${classes}" data-index="${i}" role="button" tabindex="0" aria-label="${c.value} değerinde altıgen; ${count}/${c.cap} kullanım${current ? '; son taş' : ''}${hinted === i ? '; ipucu' : ''}" aria-disabled="${!legal}"><polygon class="hex-shape" points="${points}"/><text class="hex-number" text-anchor="middle" x="0" y="${c.cap===2 ? -5 : count ? -3 : 0}">${c.value}</text>${c.cap===2 ? `<text class="hex-badge" text-anchor="middle" x="0" y="19">${count ? `${count}/2` : '2×'}</text>` : count ? '<path class="tile-check" d="m-4 17 3 3 6-7"/>' : ''}${current ? '<circle class="hex-current-dot" cx="23" cy="-14" r="2.6"/>' : ''}</g>`;
    }).join('')}`;
  }
  function render() {
    const focused = document.activeElement?.closest?.('[data-index]')?.dataset.index;
    $('board').innerHTML = boardMarkup();
    if (focused !== undefined) $('board').querySelector(`[data-index="${focused}"]`)?.focus({preventScroll:true});
    $('sum').textContent = engine.sum;
    document.querySelector('.score-current').classList.toggle('over', engine.status === 'over');
    $('coverage').textContent = `${engine.covered} / ${levels[active].cells.length}`;
    $('coverage-ring').style.strokeDashoffset = String(87.965 * (1-engine.covered / levels[active].cells.length));
    $('move-counter').textContent = `${engine.path.length} HAMLE`;
    $('undo').disabled = engine.path.length === 0;
    $('hint').disabled = engine.status === 'won';
    $('continue').hidden = engine.status !== 'won';
    const status = $('board-status');
    status.className = 'board-status';
    let message = 'Bir altıgen seç ve rotanı başlat.';
    if (engine.status === 'won') {
      message = 'Tam isabet! Bütün altıgenler yeşil, hedef tamam.';
      status.classList.add('success');
    } else if (engine.status === 'over') {
      message = `Hedefi ${engine.sum-levels[active].target} aştın. Bir hamle geri alabilirsin.`;
      status.classList.add('error');
    } else if (engine.status === 'stuck') {
      message = 'Bu rota kapandı. Geri alıp başka bir yol dene.';
      status.classList.add('error');
    } else if (engine.covered === levels[active].cells.length) {
      message = `Her yer yeşil! Hedef için ${levels[active].target-engine.sum} daha gerekiyor.`;
    } else if (engine.path.length) {
      message = `${levels[active].cells.length-engine.covered} altıgen kaldı. Komşu bir taştan devam et.`;
    }
    $('status-text').textContent = message;
  }
  function select(index, quiet = false) {
    if (engine.status === 'won') return;
    const result = engine.add(index);
    if (!result.ok) {
      const messages = {neighbor:'Sadece son seçtiğin altıgene komşu bir taşa gidebilirsin.',used:'Bu taşın kullanım hakkı bitti. Başka bir komşu seç.',over:'Hedefi aştın. Devam etmek için bir hamle geri al.'};
      if (!quiet) {
        if (messages[result.reason]) notify(messages[result.reason]);
        const tile = $('board').querySelector(`[data-index="${index}"]`);
        tile?.classList.add('hex-error');
        setTimeout(() => tile?.classList.remove('hex-error'), 400);
      }
      return;
    }
    hinted = null;
    sound(levels[active].cells[index].value);
    render(); persist();
    if (engine.status === 'won') {
      if (!saved.done.includes(active)) saved.done.push(active);
      saved.done.sort((a,b) => a-b);
      persist(); renderLevels();
      const winningEngine = engine;
      winTimer = setTimeout(() => { if (engine === winningEngine && engine.status === 'won') showVictory(); }, 550);
    }
  }
  function showVictory() {
    const final = active === levels.length-1;
    $('win-eyebrow').textContent = final ? '10 BÖLÜMLÜK YOLCULUK TAMAMLANDI' : `BÖLÜM ${pad(active+1)} TAMAMLANDI`;
    $('win-title').textContent = final ? 'Usta işi bir rota.' : 'Tam isabet!';
    $('win-description').textContent = final ? 'Bütün rotaları keşfettin. Sayılar artık senin dilini konuşuyor.' : 'Her altıgen yeşil, her sayı yerli yerinde.';
    $('win-total').textContent = engine.sum;
    $('win-moves').textContent = engine.path.length;
    $('next').innerHTML = `${final ? 'Yolculuğu yeniden keşfet' : `Bölüm ${pad(active+2)} ile devam et`} ${icons('arrow')}`;
    $('confetti').innerHTML = Array.from({length:22},(_,i) => `<i class="confetti-piece" style="left:${(i*37)%100}%;background:${['#9bbe73','#c4e89b','#789651','#dbdfb9'][i%4]};--drift:${(i%2 ? 1 : -1)*(20+i*2)}px;animation-delay:${(i%7)*.06}s;transform:rotate(${i*28}deg)"></i>`).join('');
    sound(0, true); openModal('win-dialog');
  }
  function undo() {
    clearTimeout(winTimer);
    if (engine.undo()) { hinted = null; render(); persist(); }
  }
  function reset() {
    clearTimeout(winTimer); engine.reset(); hinted = null; render(); persist();
    notify('Yeni bir rota, yeni bir ihtimal.');
  }
  function hint() {
    const result = engine.hint();
    if (result.type === 'next') {
      hinted = result.index; render();
      notify(engine.path.length ? 'Parlayan altıgen, rotanın bir sonraki adımı.' : 'Parlayan altıgenden başlayabilirsin.');
    } else if (result.type === 'undo') {
      hinted = null; render();
      notify(result.reason === 'timeout' ? 'Bu rota için ipucu bulunamadı. Bir adım geri alıp tekrar dene.' : 'Bu rotadan hedefe ulaşılamıyor. Bir adım geri alıp ipucunu tekrar dene.');
      $('undo').animate?.([{background:'#e0efcb'},{background:'transparent'}],{duration:1000,iterations:2});
    }
  }
  $('levels').addEventListener('click', e => {
    const button = e.target.closest('[data-level]');
    if (!button || button.disabled || +button.dataset.level === active) return;
    persist(); loadLevel(+button.dataset.level);
  });
  $('board').addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    const tile = e.target.closest('[data-index]');
    if (!tile) return;
    if (activePointer !== null) return;
    e.preventDefault(); dragging = true; activePointer = e.pointerId; dragLast = +tile.dataset.index;
    select(dragLast);
  });
  window.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== activePointer) return;
    if (e.pointerType !== 'touch' && e.buttons === 0) { stopDrag(); return; }
    const tile = document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-index]');
    if (!tile || !$('board').contains(tile)) return;
    const index = +tile.dataset.index;
    if (index === dragLast) return;
    dragLast = index;
    if (index !== engine.path.at(-1)) select(index, true);
  });
  function stopDrag() { dragging = false; dragLast = null; activePointer = null; }
  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);
  window.addEventListener('blur', stopDrag);
  $('board').addEventListener('keydown', e => {
    const tile = e.target.closest('[data-index]');
    if (!tile) return;
    if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); select(+tile.dataset.index);}
    if (['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const index = +tile.dataset.index, cell = levels[active].cells[index];
      const desired = {ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      const candidates = engine.neighbors[index].map(i => {const c=levels[active].cells[i],dx=1.5*(c.q-cell.q),dy=Math.sqrt(3)*(c.r-cell.r+(c.q-cell.q)/2);return {i,score:(dx*desired[0]+dy*desired[1])/Math.hypot(dx,dy)};}).filter(c=>c.score>0).sort((a,b)=>b.score-a.score);
      if(candidates.length) $('board').querySelector(`[data-index="${candidates[0].i}"]`)?.focus();
    }
  });
  $('board').addEventListener('click', e => {
    // Assistive technologies can activate buttons without a pointer event.
    if (e.detail === 0) {
      const tile = e.target.closest('[data-index]'); if (tile) select(+tile.dataset.index);
    }
  });
  $('undo').addEventListener('click', undo);
  $('reset').addEventListener('click', reset);
  $('hint').addEventListener('click', hint);
  $('help').addEventListener('click', () => openModal('help-dialog'));
  $('sound').addEventListener('click', () => {saved.sound = !saved.sound; renderSound(); persist(); if(saved.sound) sound(4);});
  $('next').addEventListener('click', () => {
    closeModal($('win-dialog'));
    if (active < levels.length-1) loadLevel(active+1);
    else {active = 0; engine = new window.HexEngine(levels[0]); saved.routes[0] = []; loadLevel(0);}
  });
  $('review').addEventListener('click', () => closeModal($('win-dialog')));
  $('continue').addEventListener('click', showVictory);
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || document.querySelector('dialog[open]') || ['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key.toLowerCase() === 'z') {e.preventDefault(); undo();}
    if (e.key.toLowerCase() === 'r') {e.preventDefault(); reset();}
    if (e.key.toLowerCase() === 'h') {e.preventDefault(); hint();}
  });
  renderSound(); loadLevel(active);
})();
