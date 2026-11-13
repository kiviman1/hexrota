(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const tutorials=window.HEX_TUTORIALS||[];
  const levels=[...tutorials,...window.HEX_LEVELS];
  const tutorialCount=tutorials.length,campaignCount=window.HEX_LEVELS.length;
  const key = 'hexrota-match-v5';
  let migrated=false;
  const pad = n => String(n).padStart(2, '0');
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  let saved = {current:0,done:[],boards:{},sound:false};
  function readSave(name){try{return JSON.parse(localStorage.getItem(name));}catch(_){return null;}}
  try {
    let raw=readSave(key);
    if(!raw){
      const previousKey=['hexrota-match-v4','hexrota-match-v3','hexrota-match-v2'].find(name=>readSave(name));
      const previous=previousKey?readSave(previousKey):null;
      if(previous){
        const boards={};
        if(previousKey==='hexrota-match-v4'&&previous.boards)for(let i=0;i<campaignCount;i++)if(previous.boards[i])boards[i+tutorialCount]=previous.boards[i];
        raw={current:Number.isInteger(previous.current)?previous.current+tutorialCount:tutorialCount,done:[...tutorials.map((_,i)=>i),...(Array.isArray(previous.done)?previous.done.filter(i=>Number.isInteger(i)&&i>=0&&i<campaignCount).map(i=>i+tutorialCount):[])],boards,sound:previous.sound};
        migrated=true;
      }
    }
    if(raw&&typeof raw==='object'){
      saved.done=Array.isArray(raw.done)?[...new Set(raw.done.filter(i=>Number.isInteger(i)&&i>=0&&i<levels.length))]:[];
      saved.current=Number.isInteger(raw.current)&&raw.current>=0&&raw.current<levels.length?raw.current:0;
      saved.sound=raw.sound===true;
      if(raw.boards&&typeof raw.boards==='object')for(let i=0;i<levels.length;i++)if(raw.boards[i]&&typeof raw.boards[i]==='object')saved.boards[i]=raw.boards[i];
    }else saved.sound=readSave('hexrota-v1')?.sound===true;
  }catch(_){}
  let active=saved.current, engine, selected=null, hinted=null, busy=false, focusIndex=0;
  let pointer=null, toastTimer, terminalTimer, audio, epoch=0, comboText='',presentation=null,hintJob=null;
  const geometryCache=new Map();
  const difficulty=['Isınma','Isınma','Keşif','Keşif','Planlama','Planlama','Zorlu','Zorlu','Ustalık','Ustalık'];
  const canOpen=i=>i===0||saved.done.includes(i-1)||saved.done.includes(i);
  const isTutorial=()=>active<tutorialCount;
  const stageLabel=i=>i<tutorialCount?`ÖĞREN ${pad(i+1)}`:`BÖLÜM ${pad(i-tutorialCount+1)}`;
  const guidedStep=()=>isTutorial()&&engine?.status==='playing'?levels[active].steps[engine.turn]||null:null;
  const samePair=(a,b,p)=>p&&((a===p[0]&&b===p[1])||(a===p[1]&&b===p[0]));
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
      const done=saved.done.includes(i),current=i===active,locked=!canOpen(i),learning=i<tutorialCount,number=learning?`T${i+1}`:pad(i-tutorialCount+1);
      return `<button class="level-button${learning?' tutorial-node':''}${current?' active':''}${done?' done':''}" data-level="${i}" ${locked?'disabled':''} ${current?'aria-current="step"':''} aria-label="${learning?'Öğren':`Bölüm ${i-tutorialCount+1}`}: ${l.name}${done?', tamamlandı':''}${locked?', kilitli':''}" title="${l.name}${locked?' — Önceki bölümü tamamla':''}"><span class="level-number">${done&&!current?icon('check'):number}</span><span class="level-copy">${l.name}</span>${locked?'<svg class="icon level-status-icon"><use href="#i-lock"/></svg>':''}</button>`;
    }).join('');
    const completed=saved.done.filter(i=>i>=tutorialCount).length;
    $('completed').textContent=`${completed} / ${campaignCount}`;
    $('journey-fill').style.width=`${completed/campaignCount*100}%`;
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
    $('level-tag').textContent=stageLabel(active);
    $('level-name').textContent=levels[active].name;
    $('difficulty').textContent=isTutorial()?'Öğretici':difficulty[active-tutorialCount];
    $('target').textContent=levels[active].target;
    $('level-note').textContent=levels[active].subtitle;
    if(isTutorial())focusIndex=levels[active].steps[engine.turn]?.pair[0]||0;
    markCompleted();renderLevels();render();persist();
  }
  function geometry() {
    if(geometryCache.has(active))return geometryCache.get(active);
    const step=44,radius=40;
    let positions=levels[active].cells.map(c=>({x:1.5*step*c.q,y:Math.sqrt(3)*step*(c.r+c.q/2)}));
    const xs=positions.map(p=>p.x),ys=positions.map(p=>p.y);
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    positions=positions.map(p=>({x:p.x-cx,y:p.y-cy}));
    const width=Math.max(isTutorial()?275:370,Math.max(...xs)-Math.min(...xs)+radius*2+24);
    const height=Math.max(isTutorial()?260:300,Math.max(...ys)-Math.min(...ys)+radius*Math.sqrt(3)+26);
    const data={positions,radius,width,height};geometryCache.set(active,data);return data;
  }
  function boardMarkup(state,matching=[],falling=[]) {
    const {positions,radius,width,height}=geometry();
    $('board').setAttribute('viewBox',`${-width/2} ${-height/2} ${width} ${height}`);
    const poly=r=>Array.from({length:6},(_,i)=>`${(r*Math.cos(i*Math.PI/3)).toFixed(3)},${(r*Math.sin(i*Math.PI/3)).toFixed(3)}`).join(' ');
    const outer=poly(radius),inner=poly(radius*.78),matched=new Set(matching),dropped=new Set(falling);
    const interactive=!busy&&engine.status==='playing',guided=guidedStep(),pair=!busy&&guided?guided.pair:[];
    return `<defs><filter id="tile-shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1" flood-color="#3d5031" flood-opacity=".06"/></filter></defs>${levels[active].cells.map((c,i)=>{
      const left=state.layers[i],green=left===0,partial=left>0&&left<(c.layers||1);
      const classes=['hex-tile',`value-${state.values[i]}`,green?'floor-green':partial?'floor-partial':'floor-untouched',c.layers===2?'layered':'',selected===i?'selected':'',hinted?.includes(i)?'hinted':'',selected!==null&&engine.adjacent(selected,i)?'neighbor':'',matched.has(i)?'matching':'',dropped.has(i)?'falling':'',pair.includes(i)?'tutorial-focus':'',pair[0]===i?'tutorial-source':'',pair[1]===i?'tutorial-target':'',pair.length&&!pair.includes(i)?'tutorial-muted':''].filter(Boolean).join(' ');
      const p=positions[i],ground=green?'zemin yeşil':`${left} eşleşme gerekiyor`;
      return `<g transform="translate(${p.x},${p.y})" class="${classes}" data-index="${i}" role="button" tabindex="${i===focusIndex?0:-1}" aria-label="${state.values[i]} sayısı, ${ground}${selected===i?', seçili':''}${hinted?.includes(i)?', ipucu':''}" aria-pressed="${selected===i}" aria-disabled="${!interactive||(pair.length&&!pair.includes(i))}"><polygon class="floor-shape" points="${outer}"/><g class="gem"><polygon class="gem-back" points="${inner}" transform="translate(0 3.5)"/><polygon class="gem-shape" points="${inner}"/><path class="gem-highlight" d="M-26-11.8 -14.8-27 H14.8 L26-11.8"/><text class="hex-number" text-anchor="middle" x="0" y="0">${state.values[i]}</text></g>${green?'<path class="floor-mark" d="m-4 29 3 3 6-7"/>':c.layers===2?`<text class="layer-count" text-anchor="middle" x="0" y="31">${left}</text>`:''}</g>`;
    }).join('')}<g class="fx-layer" aria-hidden="true"></g>`;
  }
  function render(state=null,options={}) {
    const display=state||{values:engine.values,layers:engine.layers,score:engine.score,movesLeft:engine.movesLeft};
    const focused=document.activeElement?.closest?.('[data-index]')?.dataset.index;
    $('board').innerHTML=boardMarkup(display,options.matching||[],options.falling||[]);
    if(focused!==undefined)$('board').querySelector(`[data-index="${focused}"]`)?.focus?.({preventScroll:true});
    const covered=display.layers.filter(n=>n===0).length,total=levels[active].cells.length;
    $('sum').textContent=display.score;
    $('score-progress').style.width=`${Math.min(1,display.score/levels[active].target)*100}%`;
    $('score-goal-label').textContent=display.score>=levels[active].target?'HEDEF TAMAM':'HEDEF PUAN';
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
    const status=$('board-status');status.className='board-status';
    let text;
    if(options.message)text=options.message;
    else if(engine.status==='won') {text='Hedef tamam, bütün zemin yeşil. Başardın!';status.classList.add('success');}
    else if(engine.status==='lost'){text='Hamleler bitti. Aynı tahtada yeni bir plan deneyebilirsin.';status.classList.add('error');}
    else if(selected!==null)text='Şimdi komşu bir taşı seç. Üç aynı sayıyı hizala.';
    else if(engine.score>=levels[active].target)text=`Puan hedefi tamam! ${total-covered} zemini daha yeşile boya.`;
    else text='Bir taş seç; komşusuyla değiştirip üçlüyü oluştur.';
    $('status-text').textContent=text;
    renderCoach();
  }
  function renderCoach(){
    const coach=$('tutorial-coach'),tutorial=isTutorial();coach.hidden=!tutorial||(engine.status!=='playing'&&!busy);
    if(!tutorial)return;
    const steps=levels[active].steps,index=Math.min(engine.turn,steps.length-1),step=steps[index];
    $('coach-step').textContent=`${busy?'İZLE · ':''}ADIM ${busy?Math.max(1,engine.turn):Math.min(engine.turn+1,steps.length)} / ${steps.length}`;
    $('coach-title').textContent=levels[active].title||levels[active].name;
    $('coach-text').textContent=busy?(steps[Math.max(0,engine.turn-1)].afterText||'Güzel! Şimdi taşların nasıl düştüğünü izle.'):step?.text||'Hazırsın!';
    $('coach-progress').style.width=`${engine.turn/steps.length*100}%`;
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
    comboText=`${result.frames.length>1?`${result.frames.length} zincir · `:''}+${result.scoreGain} puan${result.reshuffled?' · Karıştırıldı':''}`;
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
  function animateElement(job,node,frames,options){
    if(!node)return null;
    const animation=node.animate(frames,options);job.animations.push(animation);return animation;
  }
  function svgNode(name,attributes){const node=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,String(value));return node;}
  function matchEffects(job,frame){
    const layer=$('board').querySelector('.fx-layer'),positions=geometry().positions;
    if(!layer)return;
    let particles=0;
    const inks=['#b5a4da','#e9c37f','#dfaa95','#8bb8d5','#cfabc6'];
    for(const [order,index]of frame.matched.entries()){
      const p=positions[index],gem=$('board').querySelector(`[data-index="${index}"] .gem`);
      animateElement(job,gem,[{transform:'scale(1)',opacity:1},{transform:'scale(1.12)',opacity:1,offset:.25},{transform:'scale(.45)',opacity:0}],{duration:160,easing:'cubic-bezier(.3,.1,.4,1)',fill:'forwards'});
      if(order<12){const ring=svgNode('circle',{class:'fx-ring',cx:p.x,cy:p.y,r:15});layer.appendChild(ring);animateElement(job,ring,[{r:'15px',opacity:.8},{r:'49px',opacity:0}],{duration:195,easing:'ease-out',fill:'forwards'});}
      for(let k=0;k<5&&particles<48;k++,particles++){
        const angle=(k*72+order*31)*Math.PI/180,distance=27+(k%3)*10;
        const dot=svgNode(k%2?'circle':'rect',k%2?{class:'fx-particle',cx:p.x,cy:p.y,r:2.5}:{class:'fx-particle',x:p.x-2,y:p.y-2,width:4,height:4,rx:1});
        dot.style.fill=inks[(frame.before[index]-1)%inks.length];layer.appendChild(dot);
        animateElement(job,dot,[{transform:'translate(0px,0px) scale(1)',opacity:1},{transform:`translate(${Math.cos(angle)*distance}px,${Math.sin(angle)*distance-8}px) scale(.35)`,opacity:0}],{duration:200,easing:'ease-out',fill:'forwards'});
      }
    }
    const centroid=frame.matched.reduce((p,i)=>({x:p.x+positions[i].x/frame.matched.length,y:p.y+positions[i].y/frame.matched.length}),{x:0,y:0});
    const label=svgNode('text',{class:'fx-score',x:centroid.x,y:centroid.y-15,'text-anchor':'middle'});label.textContent=`+${frame.scoreGain}`;layer.appendChild(label);
    animateElement(job,label,[{transform:'translate(0px,0px)',opacity:0},{transform:'translate(0px,-10px)',opacity:1,offset:.2},{transform:'translate(0px,-36px)',opacity:0}],{duration:205,easing:'ease-out',fill:'forwards'});
  }
  function fallingGems(job,frame){
    const positions=geometry().positions,cells=levels[active].cells,minQ=Math.min(...cells.map(c=>c.q));let longest=0;
    for(const fall of frame.falls||[]){
      const destination=positions[fall.to],cell=cells[fall.to];
      let origin;
      if(fall.spawn){const column=cells.map((c,i)=>({c,i})).filter(x=>x.c.q===cell.q).sort((a,b)=>a.c.r-b.c.r);origin={x:destination.x,y:positions[column[0].i].y-Math.sqrt(3)*44*(fall.spawnCount-fall.spawnOrder)};}
      else origin=positions[fall.from];
      const dx=origin.x-destination.x,dy=origin.y-destination.y,delay=Math.min(50,(cell.q-minQ)*12),duration=195;
      const node=$('board').querySelector(`[data-index="${fall.to}"] .gem`);
      animateElement(job,node,[{transform:`translate(${dx}px,${dy}px)`,opacity:fall.spawn?0:1},{transform:'translate(0px,2.5px)',opacity:1,offset:.82},{transform:'translate(0px,-1px)',opacity:1,offset:.94},{transform:'translate(0px,0px)',opacity:1}],{duration,delay,easing:'cubic-bezier(.22,.72,.28,1)',fill:'both'});
      longest=Math.max(longest,duration+delay);
    }
    return longest;
  }
  async function presentSwap(job,a,b,before){
    if(!canAnimate())return;
    render(before);
    const pos=geometry().positions,dx=pos[b].x-pos[a].x,dy=pos[b].y-pos[a].y;
    for(const [index,x,y]of[[a,dx,dy],[b,-dx,-dy]])animateElement(job,$('board').querySelector(`[data-index="${index}"] .gem`),[{transform:'translate(0px,0px)'},{transform:`translate(${x}px,${y}px)`}],{duration:155,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});
    await pause(160,job);
    const frames=job.result.frames;
    // Resolve every wave in the engine; animate the first two so long chains
    // never delay input indefinitely. The final authoritative state follows.
    for(let i=0;i<Math.min(2,frames.length);i++){
      if(job.controller.signal.aborted||presentation!==job||!canAnimate())return;
      const f=frames[i],prior=i?frames[i-1]:null,score=before.score+frames.slice(0,i).reduce((n,frame)=>n+frame.scoreGain,0);
      comboText=`${i?`Zincir ×${i+1} · `:''}+${f.scoreGain} puan`;
      render({values:f.before,layers:prior?prior.layers:before.layers,score,movesLeft:engine.movesLeft},{message:i?'Bir hamle, yeni bir zincir!':'Üçlü tamam. Şimdi zemine bak.'});
      matchEffects(job,f);tone(Math.min(5,i+1));await pause(205,job);
      if(job.controller.signal.aborted||presentation!==job)return;
      render({values:f.after,layers:f.layers,score:score+f.scoreGain,movesLeft:engine.movesLeft},{falling:f.falls.map(x=>x.to),message:'Taşlar aşağı kayıyor; zemin yerinde kalıyor.'});
      const duration=fallingGems(job,f);await pause(duration+5,job);
    }
  }
  function invalidSwap(a,b){
    if(!canAnimate())return;
    try{const positions=geometry().positions;for(const [from,to]of[[a,b],[b,a]]){const dx=(positions[to].x-positions[from].x)*.25,dy=(positions[to].y-positions[from].y)*.25;$('board').querySelector(`[data-index="${from}"] .gem`)?.animate([{transform:'translate(0px,0px)'},{transform:`translate(${dx}px,${dy}px)`,offset:.4},{transform:'translate(0px,0px)'}],{duration:190,easing:'ease-out'});}}catch(_){}
  }
  async function performSwap(a,b) {
    if(busy){finishPresentation(presentation);return;}
    if(engine.status!=='playing')return;
    const guide=guidedStep();
    if(guide&&!samePair(a,b,guide.pair)){selected=null;hinted=guide.pair;render();toast('Bu adımda parlayan iki taşı değiştir. Hamlen harcanmadı.');return;}
    cancelHint();
    const checkpoint=engine.snapshot(),before={values:engine.values.slice(),layers:engine.layers.slice(),score:engine.score,movesLeft:engine.movesLeft};
    let result;
    try{result=engine.swap(a,b);}catch(_){
      try{engine=new window.HexMatch(levels[active],checkpoint);}catch(_){engine=new window.HexMatch(levels[active]);}
      selected=null;render();toast('Bu hamle tamamlanamadı. Tahta geri yüklendi; tekrar deneyebilirsin.');return;
    }
    if(!result.ok){
      selected=null;hinted=null;render();
      invalidSwap(a,b);
      toast(engine.adjacent(a,b)?'Üçlü oluşmadı. Hamlen duruyor.':'Sadece komşu iki taşı değiştirebilirsin.');
      return;
    }
    const job={token:++epoch,result,controller:new AbortController(),animations:[],watchdog:null};
    presentation=job;busy=true;selected=null;hinted=null;comboText='';
    try{
      markCompleted();persist();renderLevels();
      job.watchdog=setTimeout(()=>finishPresentation(job),1200);
      await presentSwap(job,a,b,before);
    }catch(_){/* Presentation failure must never lock committed game state. */}
    finally{finishPresentation(job);}
  }
  function select(index) {
    if(busy){finishPresentation(presentation);return;}
    if(engine.status!=='playing')return;
    const guide=guidedStep();
    if(guide&&!guide.pair.includes(index)){hinted=guide.pair;render();toast('Önce parlayan iki altıgeni dene.');return;}
    focusIndex=index;hinted=null;
    if(selected===index){selected=null;render();return;}
    if(selected!==null&&engine.adjacent(selected,index)) {const a=selected;performSwap(a,index);return;}
    selected=index;render();
  }
  function showVictory(){
    const final=active===levels.length-1,learning=isTutorial();
    $('win-eyebrow').textContent=final?'YOLCULUK TAMAMLANDI':`${stageLabel(active)} TAMAMLANDI`;
    $('win-title').textContent=learning?(active===0?'İlk adım tamam!':'Artık hazırsın!'):final?'Usta işi!':'Harika eşleşme!';
    $('win-description').textContent=learning?(active===0?'Komşuları değiştirdin, üç eksende eşleştirdin. Şimdi hedefleri birlikte tanıyalım.':'Puan ve yeşil zemini birlikte tamamladın. Sırada on gerçek bulmaca var.'):final?'On bulmacanın tamamını yeşerttin. Her eşleşme bir adım oldu.':`${engine.movesLeft} hamle kala iki hedefi de tamamladın.`;
    $('win-total').textContent=engine.score;$('win-moves').textContent=engine.movesLeft;
    const nextText=final?'Yolculuğun başına dön':active===0?'İkinci öğreticiye geç':active===1?'İlk bölüme başla':`Bölüm ${pad(active-tutorialCount+2)} ile devam et`;
    $('next').innerHTML=`${nextText} ${icon('arrow')}`;
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
    const guide=guidedStep();if(guide){selected=null;hinted=guide.pair;render();toast(guide.text);return;}
    const job={token:epoch,game:engine,worker:null,timer:null,resolve:null};hintJob=job;render();
    let suggestion=null;
    try{
      if(typeof window.Worker==='function'){
        suggestion=await new Promise(resolve=>{
          job.resolve=resolve;
          try{
            job.worker=new Worker('./hint-worker.js?v=5');
            job.worker.onmessage=e=>resolve(e.data?.hint||null);
            job.worker.onerror=e=>{e.preventDefault?.();resolve(null);};
            job.worker.postMessage({level:levels[active],snapshot:engine.snapshot()});
            job.timer=setTimeout(()=>resolve(null),600);
          }catch(_){resolve(null);}
        });
      }
      if(hintJob!==job||job.token!==epoch||job.game!==engine)return;
      if(!suggestion)suggestion=engine.hint({maxMs:12,maxDepth:1});
      if(suggestion?.pair){selected=null;hinted=suggestion.pair;toast('Parlayan iki taşı değiştir. Eksik kalan zeminlere ulaşan eşleşmeleri gözet.');}
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
  $('coach-skip').addEventListener('click',()=>{cancelPresentation();for(let i=0;i<tutorialCount;i++)if(!saved.done.includes(i))saved.done.push(i);saved.done.sort((a,b)=>a-b);loadLevel(tutorialCount);});
  $('tutorial-replay').addEventListener('click',()=>{document.querySelectorAll('dialog[open]').forEach(closeModal);loadLevel(0,true);});
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
  if(migrated)toast('İlerlemen korundu. Öğreticileri yolculuk menüsünden yeniden oynayabilirsin.');
})();
