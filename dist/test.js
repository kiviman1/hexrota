(() => {
  'use strict';
  const $=id=>document.getElementById(id), board=$('sandbox-board');
  const base=window.HEX_LEVELS[0],center=base.cells.findIndex(c=>c.q===0&&c.r===0),neighbor=base.cells.findIndex(c=>c.q===0&&c.r===1);
  const cases={
    ring:{name:'Halkayı dene',action:'Halkayı çalıştır',text:'Alttaki düğmeye bas. Hazır Halka, merkezini ve altı komşusunu temizlesin.'},
    sprout:{name:'Filizi dene',action:'Filizi çalıştır',text:'Alttaki düğmeye bas. Filiz, yeşil olmayan zemine doğru yol açsın.'},
    together:{name:'İki gücü birlikte dene',action:'İkisini çalıştır',text:'Alttaki düğmeye bas. Yan yana duran Halka ve Filiz aynı hamlede çalışsın.'}
  };
  const positions=base.cells.map(c=>({x:c.q*66,y:Math.sqrt(3)*44*(c.r+c.q/2)}));
  const width=368,height=398;
  let scenario='ring',tool='play',game,selected=null,readyPair=null,lastEffects=[],lastHit=[],pointer=null;
  function prepare(name=scenario){
    scenario=name;tool='play';selected=center;readyPair=[center,neighbor];lastEffects=[];lastHit=[];
    const initialSpecials=base.cells.map(()=>null);
    initialSpecials[center]=name==='sprout'?'sprout':'ring';if(name==='together')initialSpecials[neighbor]='sprout';
    const level={...base,id:'sandbox',initialSpecials,powers:['ring','sprout'],moves:Infinity,target:Infinity,solution:[]};
    game=new window.HexMatch(level);
    if(name==='sprout'){
      game.layers.fill(0);
      for(const coordinate of [[-1,2],[0,2],[1,1]]){
        const i=level.cells.findIndex(c=>c.q===coordinate[0]&&c.r===coordinate[1]);if(i>=0)game.layers[i]=1;
      }
    }
    $('case-name').textContent=cases[name].name;$('instruction').textContent=cases[name].text;
    setStatus('Hazır taşı çalıştırmak için büyük düğmeye basabilirsin.');render();
  }
  function setStatus(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
  function preview(){
    if(!readyPair)return [];
    const [a,b]=readyPair,copy=game.clone();
    [copy.values[a],copy.values[b]]=[copy.values[b],copy.values[a]];
    [copy.specials[a],copy.specials[b]]=[copy.specials[b],copy.specials[a]];
    return [...new Set([a,b].flatMap(i=>copy.specials[i]?copy.previewPower(i):[]))];
  }
  function effectMarkup(){
    return lastEffects.map(effect=>{
      if(effect.type==='ring'){const p=positions[effect.index];return `<circle class="effect-ring" cx="${p.x}" cy="${p.y}" r="73"/>`;}
      return `<polyline class="effect-path" points="${effect.affected.map(i=>`${positions[i].x},${positions[i].y}`).join(' ')}"/>${effect.affected.map(i=>`<circle class="effect-node" cx="${positions[i].x}" cy="${positions[i].y}" r="4"/>`).join('')}`;
    }).join('');
  }
  function render(){
    const footprint=new Set(preview()),hit=new Set(lastHit),affected=new Set(lastEffects.flatMap(e=>e.affected));
    board.innerHTML=game.values.map((value,i)=>{
      const p=positions[i],power=game.specials[i],green=game.layers[i]===0;
      const cls=['test-tile',`value-${value}`,green?'floor-green':game.layers[i]<(base.cells[i].layers||1)?'floor-partial':'',power?'has-power power-'+power:'',selected===i?'selected':'',readyPair?.[1]===i?'recommended':'',footprint.has(i)?'planned':'',hit.has(i)?'last-hit':'',affected.has(i)?'effect-hit':''].filter(Boolean).join(' ');
      return `<button class="${cls}" data-index="${i}" type="button" style="left:${(p.x+width/2)/width*100}%;top:${(p.y+height/2)/height*100}%;width:${80/width*100}%;height:${Math.sqrt(3)*40/height*100}%" aria-label="${value} sayısı${power?', '+(power==='ring'?'Halka':'Filiz')+' taşı':''}${green?', zemin yeşil':', zemin boyanacak'}${selected===i?', seçili':''}" aria-pressed="${selected===i}"><span class="tile-inner"><span class="tile-number">${value}</span>${power?`<span class="power-symbol" aria-hidden="true">${power==='ring'?'◎':'♧'}</span>`:''}</span>${green?'<span class="floor-check" aria-hidden="true">✓</span>':''}</button>`;
    }).join('');
    $('effect-overlay').setAttribute('viewBox',`${-width/2} ${-height/2} ${width} ${height}`);$('effect-overlay').innerHTML=effectMarkup();
    $('score').textContent=game.score;$('covered').textContent=`${game.covered} / ${game.total}`;$('turn').textContent=game.turn;
    $('activate').textContent=readyPair?actionName(): 'Testi yeniden hazırla';
    document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===scenario)));
    document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
    document.querySelector('.preview-key').hidden=!readyPair&&!lastEffects.length;
    document.querySelector('.preview-key').innerHTML='<span class="preview-dot"></span>'+(readyPair?'Kesikli alan: hazır takasın özel etkisi':'Vurgulu alan: son özel etkinin ulaştığı hücreler');
  }
  function actionName(){
    const powers=readyPair.map(i=>game.specials[i]).filter(Boolean);
    return powers.length>1?'İkisini çalıştır':powers[0]==='sprout'?'Filizi çalıştır':'Halkayı çalıştır';
  }
  function play(a,b){
    const result=game.swap(a,b);
    if(!result.ok){setStatus(game.adjacent(a,b)?'Bu değişim eşleşme oluşturmuyor. Bir özel taşı komşusuyla değiştirebilirsin.':'İki komşu taş seçmelisin.',true);selected=null;render();return;}
    readyPair=null;selected=null;
    // Display the first actual power effect over the authoritative final board.
    lastEffects=result.frames[0]?.activated||[];lastHit=result.frames[0]?.matched||[];
    const affected=new Set(lastEffects.flatMap(e=>e.affected)).size;
    setStatus(`${lastEffects.length?`${lastEffects.length===2?'İki özel taş':lastEffects[0].type==='ring'?'Halka':'Filiz'} çalıştı: ${affected} hücreye özel etki. `:''}+${result.scoreGain} puan · ${result.frames.length} eşleşme dalgası. Yeniden hazırlayabilir veya serbestçe devam edebilirsin.`);
    render();
  }
  function select(index){
    if(tool!=='play'){
      game.specials[index]=tool==='erase'?null:tool;
      readyPair=tool==='erase'?null:[index,game.neighbors[index][0]];
      selected=tool==='erase'?null:index;
      setStatus(tool==='erase'?'Özel güç kaldırıldı.':`${tool==='ring'?'Halka':'Filiz'} eklendi. Büyük düğmeyle çalıştır veya bir komşusuna dokun.`);
      tool='play';lastEffects=[];lastHit=[];render();return;
    }
    if(selected===index){setStatus(game.specials[index]?'Taş seçili. Şimdi bir komşusuna dokun veya büyük düğmeye bas.':'Taş seçili. Şimdi bir komşusuna dokun.');return;}
    if(selected!==null&&game.adjacent(selected,index)){play(selected,index);return;}
    selected=index;lastEffects=[];lastHit=[];
    if(game.specials[index]){readyPair=[index,game.neighbors[index][0]];setStatus('Seçili özel taşı bir komşusuyla değiştir veya büyük düğmeye bas.');}
    else{readyPair=null;setStatus('Şimdi komşu bir taş seç. Üç aynı sayı veya bir özel taşla eşleşme kur.');}
    render();
  }
  $('activate').addEventListener('click',()=>{if(readyPair)play(...readyPair);else prepare();});
  $('reset').addEventListener('click',()=>prepare());
  document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>prepare(b.dataset.scenario)));
  document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{
    tool=b.dataset.tool;selected=null;readyPair=null;lastEffects=[];lastHit=[];
    setStatus(tool==='play'?'İki komşuya sırayla dokunarak serbestçe oyna.':tool==='erase'?'Gücünü kaldırmak istediğin taşa dokun.':`${tool==='ring'?'Halka':'Filiz'} eklemek istediğin taşa dokun.`);render();
  }));
  board.addEventListener('click',e=>{const tile=e.target.closest('[data-index]');if(!tile||e.detail!==0)return;select(+tile.dataset.index);});
  function stopPointer(){const old=pointer;pointer=null;if(old)try{if(board.hasPointerCapture?.(old.id))board.releasePointerCapture(old.id);}catch(_){}}
  board.addEventListener('pointerdown',e=>{
    if(e.isPrimary===false||pointer||(e.button!==0&&e.pointerType!=='touch'))return;
    const tile=e.target.closest('[data-index]');if(!tile)return;
    e.preventDefault();pointer={id:e.pointerId,index:+tile.dataset.index,x:e.clientX,y:e.clientY};
    try{board.setPointerCapture?.(e.pointerId);}catch(_){}
  });
  window.addEventListener('pointerup',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    const start=pointer,hit=document.elementFromPoint?.(e.clientX,e.clientY)||e.target,tile=hit?.closest?.('[data-index]');stopPointer();
    if(!tile||!board.contains(tile))return;
    const target=+tile.dataset.index;e.preventDefault();
    if(tool==='play'&&target!==start.index&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)play(start.index,target);
    else select(target);
  });
  board.addEventListener('lostpointercapture',stopPointer);window.addEventListener('pointercancel',stopPointer);window.addEventListener('blur',stopPointer);
  prepare();
})();
