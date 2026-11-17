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

  // The 9.16 guide decorates the current board without moving, hiding or
  // cloning a gem. Its host supplies the exact CURRENT matching sources and
  // owns when teaching, a quiet second move, or an idle reprompt is appropriate.
  function createGuide({board,gestureHost=null,reducedMotion=()=>false}={}){
    const doc=board?.ownerDocument,view=doc?.defaultView,svgNS='http://www.w3.org/2000/svg';
    let active=null,disposed=false;
    const finite=n=>Number.isFinite(n),index=n=>Number.isSafeInteger(n)&&n>=0;
    const element=(name,attributes={})=>{
      const node=doc.createElementNS(svgNS,name);
      for(const [name,value] of Object.entries(attributes))node.setAttribute(name,String(value));
      return node;
    };
    function stop(){
      const job=active;active=null;if(!job)return;
      job.observer?.disconnect();
      for(const animation of job.animations)try{animation.cancel();}catch(_){}
      job.layer.remove();job.gesture?.remove();
      for(const item of job.legacy){
        if(item.style===null)item.node.removeAttribute('style');else item.node.setAttribute('style',item.style);
      }
    }
    function intact(job){
      return board.contains(job.layer)&&(!job.gesture||(gestureHost.isConnected&&gestureHost.contains(job.gesture)))&&board.getAttribute('viewBox')===job.viewBox&&job.sources.every(item=>
        board.contains(item.tile)&&item.tile.querySelector(':scope > .gem')===item.gem&&
        item.tile.querySelector(':scope > .floor-shape')===item.floor&&
        item.gem.querySelector('.hex-number')===item.number&&item.number.textContent===item.value&&
        item.tile.getAttribute('transform')===item.transform);
    }
    function isActive(){if(active&&!intact(active))stop();return !!active;}
    function setup(layout,indices,mode){
      if(disposed||!board||!doc||(gestureHost&&(!gestureHost.isConnected||gestureHost.ownerDocument!==doc||board.contains(gestureHost)))||!layout?.positions||!finite(layout.radius)||layout.radius<=0||!Array.isArray(indices)||!indices.length)return null;
      const unique=[...new Set(indices)];if(!unique.every(i=>index(i)&&finite(layout.positions[i]?.x)&&finite(layout.positions[i]?.y)))return null;
      const sources=unique.map(i=>{
        const tile=board.querySelector(':scope > [data-index="'+i+'"]'),gem=tile?.querySelector(':scope > .gem'),floor=tile?.querySelector(':scope > .floor-shape'),number=gem?.querySelector('.hex-number');
        return {index:i,tile,gem,floor,number,value:number?.textContent,transform:tile?.getAttribute('transform')};
      });
      if(sources.some(item=>!item.tile||!item.gem||!item.floor||!item.number||!/^\d+$/.test(item.value.trim())))return null;
      const layer=element('g',{'class':'first-play-guide-layer','data-guide-mode':mode,'pointer-events':'none','aria-hidden':'true'});
      layer.style.pointerEvents='none';
      layer.setAttribute('data-reduced-motion',String(!!(reducedMotion()||view?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)));
      return {layer,sources,gesture:null,legacy:[],animations:[],observer:null,viewBox:board.getAttribute('viewBox'),reduced:!!(reducedMotion()||view?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)};
    }
    function contour(job,layout,i,role){
      const p=layout.positions[i],r=layout.radius*.89;
      const group=element('g',{'class':'first-play-guide-cell','data-guide-role':role,'data-guide-index':i,transform:'translate('+p.x+','+p.y+')'});
      group.append(element('polygon',{'class':'first-play-guide-contour',fill:'none',points:Array.from({length:6},(_,n)=>(r*Math.cos(n*Math.PI/3)).toFixed(3)+','+(r*Math.sin(n*Math.PI/3)).toFixed(3)).join(' ')}));
      job.layer.append(group);return group;
    }
    function animate(job,node,frames,options){
      if(job.reduced||typeof node.animate!=='function')return;
      const animation=node.animate(frames,options);job.animations.push(animation);
      const cancelled=()=>{if(active===job)stop();};
      animation.addEventListener?.('cancel',cancelled,{once:true});
      animation.finished?.catch(cancelled);
    }
    function mount(job){
      for(const node of board.querySelectorAll(':scope > .tutorial-gesture')){
        job.legacy.push({node,style:node.getAttribute('style')});node.style.setProperty('visibility','hidden');
      }
      active=job;board.insertBefore(job.layer,board.querySelector(':scope > .fx-layer'));if(job.gesture)gestureHost.append(job.gesture);
      const Observer=view?.MutationObserver||root.MutationObserver;
      if(Observer){
        job.observer=new Observer(records=>{
          const removed=records.some(record=>record.type==='childList'&&[...record.removedNodes].some(node=>node===job.layer||node.contains?.(job.layer)||job.gesture&&(node===job.gesture||node.contains?.(job.gesture))));
          if(active===job&&(removed||!intact(job)))stop();
        });
        job.observer.observe(board,{childList:true,subtree:true,characterData:true,attributes:true});
        if(job.gesture){job.observer.observe(gestureHost,{childList:true,subtree:true});if(gestureHost.parentNode)job.observer.observe(gestureHost.parentNode,{childList:true});}
      }
    }
    function show({layout,pair,matchingSources,mode='teach'}={}){
      stop();
      try{
        if(!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||!pair.every(index)||!['teach','reprompt'].includes(mode)||!Array.isArray(matchingSources))return false;
        const matches=[...new Set(matchingSources)];
        if(matches.length<3||matches.length!==matchingSources.length||!matches.includes(pair[0])||matches.includes(pair[1]))return false;
        const job=setup(layout,[...pair,...matches],mode);if(!job)return false;
        const sourceValue=job.sources.find(item=>item.index===pair[0]).value.trim();
        if(matches.some(i=>job.sources.find(item=>item.index===i)?.value.trim()!==sourceValue))return false;
        contour(job,layout,pair[1],'target');
        for(const i of matches)contour(job,layout,i,i===pair[0]?'source':'match');
        const a=layout.positions[pair[0]],b=layout.positions[pair[1]],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
        if(!finite(length)||length<=0)return false;
        const ux=dx/length,uy=dy/length,offset=layout.radius*.87;
        // Choose the edge corridor furthest from the other printed numbers.
        // The hand and arrow stay beside the gems rather than over their digits.
        const route=sign=>{
          const ox=-uy*offset*sign,oy=ux*offset*sign;
          let clearance=Infinity;
          for(let n=0;n<=8;n++)for(const p of layout.positions){
            const x=a.x+ox+dx*n/8+6,y=a.y+oy+dy*n/8+3;
            clearance=Math.min(clearance,Math.hypot(x-p.x,y-p.y));
          }
          return {ox,oy,clearance};
        };
        const first=route(1),other=route(-1),chosen=other.clearance>first.clearance?other:first;
        const ax=a.x+chosen.ox+ux*13,ay=a.y+chosen.oy+uy*13,bx=b.x+chosen.ox-ux*13,by=b.y+chosen.oy-uy*13;
        job.layer.append(element('path',{'class':'first-play-guide-arrow',fill:'none',d:'M'+ax+' '+ay+' L'+bx+' '+by+' M'+(bx-ux*8-uy*4)+' '+(by-uy*8+ux*4)+' L'+bx+' '+by+' L'+(bx-ux*8+uy*4)+' '+(by-uy*8-ux*4)}));
        const hand=element('g',{'class':'first-play-guide-hand'});let motionX=dx,motionY=dy;
        // The v2 host reserves a separate coach column. Its entire hand gesture
        // stays outside the board, including while the physical swap is shown.
        if(gestureHost){
          job.gesture=doc.createElement('div');job.gesture.className='first-play-gesture-slot';job.gesture.setAttribute('aria-hidden','true');job.gesture.style.pointerEvents='none';
          const preview=element('svg',{'class':'first-play-gesture-preview',viewBox:'-28 -30 56 60',width:44,height:60,'aria-hidden':'true',focusable:'false','pointer-events':'none'});
          motionX=ux*20;motionY=uy*20;
          const x=-ux*10,y=-uy*10,tx=ux*10,ty=uy*10;
          preview.append(element('path',{'class':'first-play-gesture-arrow',fill:'none',d:'M'+x+' '+y+' L'+tx+' '+ty+' M'+(tx-ux*7-uy*4)+' '+(ty-uy*7+ux*4)+' L'+tx+' '+ty+' L'+(tx-ux*7+uy*4)+' '+(ty-uy*7-ux*4)}));
          const anchor=element('g',{transform:'translate('+x+','+y+')'});anchor.append(hand);preview.append(anchor);job.gesture.append(preview);
        }else{
          const anchor=element('g',{transform:'translate('+(a.x+chosen.ox)+','+(a.y+chosen.oy)+')'});anchor.append(hand);job.layer.append(anchor);
        }
        // Reuse the already authored tutorial hand, never a new character asset.
        hand.append(element('path',{d:'M0 0 V-7 C0-10 5-10 5-7 V0 L7-3 C9-5 12-3 11-1 L12-2 C15-3 17-1 16 1 C19 0 21 3 19 6 L16 13 C15 15 13 16 10 16 H7 C5 16 4 15 3 13 L-4 6 C-6 3-3 0-1 2 L2 5',transform:gestureHost?'scale(.85)':'scale(.75)'}));
        mount(job);
        animate(job,hand,[{transform:'translate(0px,0px)',opacity:1,offset:0},{transform:'translate(0px,0px)',opacity:1,offset:.2},{transform:'translate('+motionX+'px,'+motionY+'px)',opacity:1,offset:.7},{transform:'translate('+motionX+'px,'+motionY+'px)',opacity:0,offset:.85},{transform:'translate(0px,0px)',opacity:0,offset:.9},{transform:'translate(0px,0px)',opacity:1,offset:1}],{duration:1800,iterations:1,easing:'ease-in-out'});
        for(const node of job.layer.querySelectorAll('[data-guide-role="source"],[data-guide-role="match"]'))animate(job,node,[{opacity:.68},{opacity:1,offset:.5},{opacity:.86}],{duration:1800,iterations:1,easing:'ease-in-out'});
        return true;
      }catch(_){stop();return false;}
    }
    function feedback({layout,cells}={}){
      stop();
      try{
        const job=setup(layout,cells,'feedback');if(!job||job.sources.some(item=>!item.tile.classList.contains('floor-green')))return false;
        for(const i of [...new Set(cells)])contour(job,layout,i,'green');mount(job);
        animate(job,job.layer,[{opacity:.45},{opacity:1,offset:.35},{opacity:.7}],{duration:800,iterations:1,easing:'ease-out'});return true;
      }catch(_){stop();return false;}
    }
    function destroy(){if(disposed)return;stop();disposed=true;}
    return Object.freeze({show,feedback,stop,destroy,isActive});
  }

  const api=Object.freeze({copy,createDemo,createGuide});root.HexFirstPlay=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
