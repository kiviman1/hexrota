/* First-play copy and visual demonstrations only.
 * The host owns the board, lesson progress and every real move. This module
 * receives SVG geometry; it has no engine, storage, score or RNG access. */
(function(root){
  'use strict';

  const lessons=Object.freeze({
    'learn-1':Object.freeze([
      Object.freeze({title:'2’yi 1’in yerine kaydır',text:'Aynı sayıdan üç taş yan yana gelsin.',afterTitle:'İlk eşleşmen!',afterText:'2 + 2 + 2 = 6 puan. Üç taşın altı yeşerdi.'}),
      Object.freeze({title:'Bir eşleşme daha yap',text:'Parlayan iki taşın yerini değiştir.',afterTitle:'Yeşil yerler kalır',afterText:'3 puan daha kazandın. Yeni taşlar geldi; yeşeren yerler kaldı.'}),
      Object.freeze({title:'Son iki yeri yeşert',text:'Parlayan 2 ile 3’ün yerini değiştir.',afterTitle:'İlk alan yeşerdi!',afterText:'Yedi yerin hepsi yeşil. Sıradaki görevde yeni bir zemin var.'})
    ]),
    'learn-2':Object.freeze([
      Object.freeze({title:'İki noktalı yeri yeşert',text:'Parlayan 3 ile 1’in yerini değiştir.',afterTitle:'Bir nokta kaldı',afterText:'İki noktalı yer iki eşleşmede yeşerir.'}),
      Object.freeze({title:'Taşları değiştir, sonra izle',text:'Parlayan iki taşın yerini değiştir.',afterTitle:'Zincir eşleşme!',afterText:'Yeni taşlar da eşleşti: 15 puan. Yalnızca bir hamle kullandın.'}),
      Object.freeze({title:'Puan hedefini tamamla',text:'Parlayan iki taşı değiştir. Hedefin 25 puan.',afterTitle:'Puan hedefi tamam!',afterText:'27 puanın var. Son bir yeri yeşert.'}),
      Object.freeze({title:'Son yeri yeşert',text:'Parlayan iki taşın yerini değiştir.',afterTitle:'Görev tamam!',afterText:'Puanın yeterli ve her yer yeşil. İlk bölüme hazırsın.'})
    ])
  });

  function copy(levelId,turn,{feedback=false,busy=false}={}){
    const steps=lessons[levelId];
    if(!steps)return null;
    const count=Number.isFinite(turn)?Math.max(0,Math.floor(turn)):0;
    const after=!!feedback||!!busy,index=Math.min(steps.length-1,Math.max(0,count-(after?1:0))),step=steps[index];
    return Object.freeze({title:after?step.afterTitle:step.title,text:after?step.afterText:step.text});
  }

  function createDemo({board,reducedMotion=()=>false}={}){
    const doc=board?.ownerDocument,view=doc?.defaultView,svgNS='http://www.w3.org/2000/svg';
    let active=null;

    function stop(){
      const job=active;active=null;
      if(!job)return;
      job.observer?.disconnect();
      for(const animation of job.animations)try{animation.cancel();}catch(_){}
      job.layer.remove();
      for(const source of job.sources){
        if(!source.hadClass)source.node.classList.remove('tutorial-demo-source');
        if(source.visibility)source.node.style.setProperty('visibility',source.visibility,source.priority);
        else source.node.style.removeProperty('visibility');
      }
    }

    function intact(job){
      return board.contains(job.layer)&&job.sources.every(source=>board.contains(source.node));
    }

    function frames(path){
      const first=path[0].transform,last=path[path.length-1].transform;
      return [
        {transform:first,opacity:1,offset:0},
        ...path.map((frame,index)=>({transform:frame.transform,opacity:1,offset:.16+.46*(Number.isFinite(frame.offset)?frame.offset:index/(path.length-1))})),
        {transform:last,opacity:1,offset:.77},
        {transform:last,opacity:0,offset:.89},
        {transform:first,opacity:0,offset:.92},
        {transform:first,opacity:1,offset:1}
      ];
    }

    function show({layout,pair,paths}={}){
      stop();
      try{
        if(!board||!doc||reducedMotion()||!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||!pair.every(index=>Number.isInteger(index)&&index>=0))return false;
        if(!layout?.positions||!pair.every(index=>Number.isFinite(layout.positions[index]?.x)&&Number.isFinite(layout.positions[index]?.y)))return false;
        const tiles=pair.map(index=>board.querySelector(`[data-index="${index}"]`));
        const gems=tiles.map(tile=>tile?.querySelector('.gem'));
        if(gems.some(gem=>!gem||typeof gem.animate!=='function'))return false;
        const routes=paths||root.HexBoardView?.swapPaths(layout,pair[0],pair[1]);
        if(!Array.isArray(routes)||routes.length!==2||!routes.every(path=>Array.isArray(path)&&path.length>1&&path.every(frame=>typeof frame.transform==='string')))return false;

        const layer=doc.createElementNS(svgNS,'g');
        layer.setAttribute('class','tutorial-demo-layer');layer.setAttribute('pointer-events','none');layer.setAttribute('aria-hidden','true');
        layer.style.pointerEvents='none';
        const job={layer,sources:[],animations:[],observer:null};active=job;
        for(let index=0;index<2;index++){
          const tile=tiles[index],gem=gems[index],position=layout.positions[pair[index]];
          const anchor=doc.createElementNS(svgNS,'g'),mover=doc.createElementNS(svgNS,'g');
          const valueClass=[...tile.classList].find(name=>/^value-\d+$/.test(name));
          anchor.setAttribute('class',`hex-tile tutorial-demo-stone${valueClass?' '+valueClass:''}`);
          anchor.setAttribute('transform',`translate(${position.x},${position.y})`);
          anchor.setAttribute('pointer-events','none');mover.setAttribute('class','tutorial-demo-mover');
          const clone=gem.cloneNode(true);
          clone.classList.remove('tutorial-demo-source');clone.style.removeProperty('visibility');
          for(const node of [clone,...clone.querySelectorAll('*')]){
            for(const name of ['id','tabindex','role','data-index'])node.removeAttribute(name);
          }
          mover.appendChild(clone);anchor.appendChild(mover);layer.appendChild(anchor);
          job.sources.push({node:gem,hadClass:gem.classList.contains('tutorial-demo-source'),visibility:gem.style.getPropertyValue('visibility'),priority:gem.style.getPropertyPriority('visibility')});
          gem.classList.add('tutorial-demo-source');gem.style.setProperty('visibility','hidden');
        }
        board.insertBefore(layer,board.querySelector('.tutorial-gesture'));
        const movers=layer.querySelectorAll('.tutorial-demo-mover');
        for(let index=0;index<2;index++){
          const animation=movers[index].animate(frames(routes[index]),{duration:3800,iterations:Infinity,easing:'ease-in-out',fill:'both'});
          job.animations.push(animation);
          const cancelled=()=>{if(active===job)stop();};
          animation.addEventListener?.('cancel',cancelled,{once:true});
          animation.finished?.catch(cancelled);
        }
        const Observer=view?.MutationObserver||root.MutationObserver;
        if(Observer){
          job.observer=new Observer(()=>{if(active===job&&!intact(job))stop();});
          job.observer.observe(board,{childList:true,subtree:true});
        }
        return true;
      }catch(_){stop();return false;}
    }

    function isActive(){
      if(active&&!intact(active))stop();
      return !!active;
    }

    return Object.freeze({show,stop,isActive});
  }

  const api=Object.freeze({copy,createDemo});root.HexFirstPlay=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
