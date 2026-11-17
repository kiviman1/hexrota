/* Board presentation: pure geometry, SVG markup, reciprocal swap paths and an
 * explicit DOM reconciler. No storage, timers, RNG or application state.
 * Keep paint order stable: static floors, effects, then the moving swap layer. */
(function(root) {
  'use strict';
  function geometry(level, tutorial = false) {
    const step=44,radius=40;
    let positions=level.cells.map(c=>({x:1.5*step*c.q,y:Math.sqrt(3)*step*(c.r+c.q/2)}));
    const xs=positions.map(p=>p.x),ys=positions.map(p=>p.y);
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    positions=positions.map(p=>({x:p.x-cx,y:p.y-cy}));
    const width=Math.max(tutorial?275:370,Math.max(...xs)-Math.min(...xs)+radius*2+24);
    const height=Math.max(tutorial?260:300,Math.max(...ys)-Math.min(...ys)+radius*Math.sqrt(3)+26);
    return {positions,radius,width,height};
  }

  function markup(level, state, layout, options = {}) {
    const { matching = [], falling = [], busy = false, feedback = false, status = "playing", guided = null, selected = null, hinted = null, focusIndex = 0, selectedNeighbors = [] } = options;
    const {positions,radius,width,height}=layout;
    const poly=r=>Array.from({length:6},(_,i)=>`${(r*Math.cos(i*Math.PI/3)).toFixed(3)},${(r*Math.sin(i*Math.PI/3)).toFixed(3)}`).join(' ');
    const outer=poly(radius),inner=poly(radius*.78),matched=new Set(matching),dropped=new Set(falling);
    const highlightRadius=radius*.78-1.2,highlightHeight=highlightRadius*Math.sqrt(3)/2;
    const highlight=`M${(-.8*highlightRadius).toFixed(3)} ${(-.4*highlightHeight).toFixed(3)} L${(-.5*highlightRadius).toFixed(3)} ${(-highlightHeight).toFixed(3)} L${(.5*highlightRadius).toFixed(3)} ${(-highlightHeight).toFixed(3)} L${(.8*highlightRadius).toFixed(3)} ${(-.4*highlightHeight).toFixed(3)}`;
    const interactive = !busy && !feedback && status === 'playing';
    const pair = !busy && guided ? guided.pair : [];
    const support = pair.length ? guided.matchIndices.filter(i => !pair.includes(i)) : [];
    let gesture='';
    if(pair.length){
      const source=positions[pair[0]],target=positions[pair[1]],dx=target.x-source.x,dy=target.y-source.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length,ox=-uy*17,oy=ux*17;
      gesture=`<g class="tutorial-gesture" pointer-events="none" aria-hidden="true"><path class="tutorial-guide-line" d="M${source.x+ox+ux*17} ${source.y+oy+uy*17} L${target.x+ox-ux*17} ${target.y+oy-uy*17}" marker-end="url(#tutorial-arrow)"/><g transform="translate(${source.x+12},${source.y+15})"><g class="tutorial-guide-hand" style="--guide-dx:${dx}px;--guide-dy:${dy}px"><path d="M0 0 V-7 C0-10 5-10 5-7 V0 L7-3 C9-5 12-3 11-1 L12-2 C15-3 17-1 16 1 C19 0 21 3 19 6 L16 13 C15 15 13 16 10 16 H7 C5 16 4 15 3 13 L-4 6 C-6 3-3 0-1 2 L2 5"/></g></g></g>`;
    }
    return `<defs><filter id="tile-shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1" flood-color="#3d5031" flood-opacity=".06"/></filter><marker id="tutorial-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L6 3.5 L0 7 Z"/></marker></defs>${level.cells.map((c,i)=>{
      const left=state.layers[i],green=left===0,partial=left>0&&left<(c.layers||1);
      // Obstacle layers are read-only engine projections. Empty gem containers
      // keep the same reconciler/identity contract as ordinary occupied cells.
      if(level.rulesVersion==='classic-v5'&&level.obstacles){
        const definitions=level.obstacles,blockerIndex=definitions.blockers.findIndex(b=>b.cell===i);
        const hp=blockerIndex<0?0:state.blockerHp[blockerIndex];
        const locked=definitions.regions.some((region,index)=>!state.regionOpen[index]&&region.cells.includes(i));
        if(hp>0||locked||state.values[i]===null){
          const p=positions[i],kind=hp>0?'blocked':locked?'closed':'empty';
          const crate=hp>0?`<g data-asset="${hp===1?'crate-wood-cracked':'crate-wood-intact'}" class="blocker-visual ${hp===1?'blocker-cracked':'blocker-reinforced'}" aria-hidden="true"><polygon class="crate-body" points="${inner}"/><path class="crate-grain" d="M-23 -14 H23 M-29 0 H29 M-23 14 H23 M-8 -26 V26 M12 -26 V26"/><path class="crate-brace" d="M-22 -15 22 15 M-22 15 22 -15"/>${hp===1?'<path class="crate-crack" d="m4-26-8 12 9 7-10 12 6 21"/>':''}<rect class="crate-hp-badge" x="-13" y="-11" width="26" height="22" rx="7"/><text class="crate-hp" text-anchor="middle" x="0" y="5">${hp}</text></g>`:'';
          return `<g transform="translate(${p.x},${p.y})" class="hex-tile obstacle-cell obstacle-${kind} ${green?'floor-green':'floor-untouched'}" data-index="${i}" data-cell-state="${kind}" role="button" tabindex="-1" aria-disabled="true" aria-label="${hp>0?'Ahşap kutu, '+hp+' dayanıklılık':locked?'Kapalı bölge':'Boş hücre'}"><polygon class="floor-shape" points="${outer}"/><g class="gem"></g>${crate}${locked?`<g data-asset="region-closed" class="region-cover" aria-hidden="true"><polygon points="${inner}"/><path d="M-7-3v-5a7 7 0 0 1 14 0v5m-18 0h22v18h-22Z"/><circle cx="0" cy="5" r="2"/></g>`:''}</g>`;
        }
      }
      const classes=['hex-tile',`value-${state.values[i]}`,green?'floor-green':partial?'floor-partial':'floor-untouched',c.layers===2?'layered':'',selected===i?'selected':'',hinted?.includes(i)?'hinted':'',selected!==null&&selectedNeighbors.includes(i)?'neighbor':'',matched.has(i)?'matching':'',dropped.has(i)?'falling':'',pair.includes(i)?'tutorial-focus':'',support.includes(i)?'tutorial-support':'',pair[0]===i?'tutorial-source':'',pair[1]===i?'tutorial-target':'',pair.length&&!pair.includes(i)&&!support.includes(i)?'tutorial-muted':''].filter(Boolean).join(' ');
      const p=positions[i],ground=green?'altı yeşil':`${left} eşleşme gerekiyor`;
      const pips=c.layers===2&&!green?`<g class="layer-pips" aria-hidden="true">${Array.from({length:left},(_,dot)=>`<circle class="layer-pip" cx="${left===2?(dot?4:-4):0}" cy="31" r="2.5"/>`).join('')}</g>`:'';
      return `<g transform="translate(${p.x},${p.y})" class="${classes}" data-index="${i}" role="button" tabindex="${i===focusIndex?0:-1}" aria-label="${state.values[i]} sayısı, ${ground}${selected===i?', seçili':''}${hinted?.includes(i)?', ipucu':''}" aria-pressed="${selected===i}" aria-disabled="${!interactive||(pair.length&&!pair.includes(i))}"><polygon class="floor-shape" points="${outer}"/><g class="gem"><polygon class="gem-back" points="${inner}" transform="translate(0 3.5)"/><polygon class="gem-shape" points="${inner}"/><path class="gem-highlight" d="${highlight}"/><text class="hex-number" text-anchor="middle" x="0" y="0">${state.values[i]}</text></g>${green?'<path class="floor-mark" d="m-4 29 3 3 6-7"/>':pips}</g>`;
    }).join('')}${gesture}<g class="fx-layer" aria-hidden="true"></g><g class="swap-layer" aria-hidden="true" pointer-events="none"></g>`;
  }

  function swapPaths(layout,a,b){
    const {positions,radius,width,height}=layout,from=positions[a],to=positions[b];
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
    const lane=Math.min(radius*.95,length*.5),inset=radius*.78+5,paths=[[],[]];
    for(let step=0;step<=16;step++){
      const t=step/16,bend=lane*Math.sin(Math.PI*t);
      const points=[{x:from.x+dx*t+nx*bend,y:from.y+dy*t+ny*bend},{x:to.x-dx*t-nx*bend,y:to.y-dy*t-ny*bend}];
      // Move the pair inward together near an edge, preserving separation and
      // keeping the complete gem and number inside the SVG viewport.
      const shift=(axis,size)=>Math.min(Math.max(0,-size/2+inset-Math.min(...points.map(p=>p[axis]))),size/2-inset-Math.max(...points.map(p=>p[axis])));
      const sx=shift('x',width),sy=shift('y',height);
      points.forEach((point,index)=>{const origin=index?to:from;paths[index].push({transform:`translate(${point.x+sx-origin.x}px,${point.y+sy-origin.y}px)`,offset:t});});
    }
    return paths;
  }

  // Reconcile the supplied visual projection without deriving game rules. The
  // host supplies either the already resolved reciprocal swap or engine falls.
  // Capture every source before moving any node: a destination can itself be
  // another survivor's source. Only spawn/changed gems enter the live board.
  function reconcile(board, html, transition = {}) {
    if(!board?.ownerDocument||typeof html!=='string'||!transition||typeof transition!=='object'||Array.isArray(transition))throw new TypeError('invalid_board_projection');
    const doc=board.ownerDocument,template=doc.createElementNS('http://www.w3.org/2000/svg','svg');template.innerHTML=html;
    const tiles=node=>Array.from(node.children).filter(child=>child.hasAttribute('data-index'));
    const desired=tiles(template),previous=tiles(board),number=node=>node?.querySelector('.hex-number')?.textContent;
    const index=node=>Number(node.getAttribute('data-index'));
    if(!desired.length||desired.some((tile,i)=>index(tile)!==i||!tile.querySelector(':scope > .gem')||!tile.querySelector(':scope > .floor-shape')))throw new TypeError('invalid_board_projection');
    const moves=transition.moves===undefined?[]:transition.moves,falls=transition.falls===undefined?[]:transition.falls,matched=transition.matched===undefined?[]:transition.matched;
    if(!Array.isArray(moves)||!Array.isArray(falls)||!Array.isArray(matched)||(transition.reset!==undefined&&typeof transition.reset!=='boolean')||(moves.length&&(falls.length||matched.length)))throw new TypeError('invalid_board_transition');
    const valid=i=>Number.isInteger(i)&&i>=0&&i<desired.length;
    if(matched.some(i=>!valid(i))||new Set(matched).size!==matched.length)throw new TypeError('invalid_board_transition');
    const erased=new Set(matched),sources=new Set(),destinations=new Set(),routes=[];
    for(const move of moves){
      if(!move||!valid(move.from)||!valid(move.to)||sources.has(move.from)||destinations.has(move.to))throw new TypeError('invalid_board_transition');
      sources.add(move.from);destinations.add(move.to);routes.push({from:move.from,to:move.to,spawn:false});
    }
    for(const fall of falls){
      if(!fall||typeof fall.spawn!=='boolean'||!valid(fall.to)||destinations.has(fall.to)||
        (fall.spawn?(fall.from!==null||!Number.isInteger(fall.spawnCount)||fall.spawnCount<1||!Number.isInteger(fall.spawnOrder)||fall.spawnOrder<0||fall.spawnOrder>=fall.spawnCount):(!valid(fall.from)||sources.has(fall.from)||erased.has(fall.from))))throw new TypeError('invalid_board_transition');
      if(!fall.spawn)sources.add(fall.from);destinations.add(fall.to);routes.push(fall);
    }
    const explicit=moves.length||falls.length||matched.length;
    const compatible=previous.length===desired.length&&previous.every((tile,i)=>index(tile)===i&&tile.getAttribute('transform')===desired[i].getAttribute('transform')&&tile.querySelector(':scope > .gem'));
    if(explicit&&(!compatible||transition.reset===true))throw new TypeError('invalid_board_transition');
    const oldGems=previous.map(tile=>tile.querySelector(':scope > .gem'));
    // Validate all declared source/value relationships before touching live DOM.
    for(const route of routes){
      const target=desired[route.to].querySelector(':scope > .gem');
      if((route.value!==undefined&&String(route.value)!==number(target))||(!route.spawn&&number(oldGems[route.from])!==number(target)))throw new TypeError('invalid_board_transition');
    }
    if(!compatible||transition.reset===true){
      board.replaceChildren(...Array.from(template.childNodes));
      return Object.freeze({reused:0,created:desired.length,removed:oldGems.filter(Boolean).length,moved:0});
    }
    const chosen=new Map(),reused=new Set();
    for(const route of routes)if(!route.spawn){chosen.set(route.to,oldGems[route.from]);reused.add(oldGems[route.from]);}
    for(let i=0;i<desired.length;i++)if(!destinations.has(i)&&!sources.has(i)&&!erased.has(i)&&number(oldGems[i])===number(desired[i].querySelector(':scope > .gem'))){chosen.set(i,oldGems[i]);reused.add(oldGems[i]);}
    const syncAttributes=(target,source)=>{
      for(const attribute of Array.from(target.attributes))if(!source.hasAttribute(attribute.name))target.removeAttribute(attribute.name);
      for(const attribute of Array.from(source.attributes))if(target.getAttribute(attribute.name)!==attribute.value)target.setAttribute(attribute.name,attribute.value);
    };
    const align=(parent,children)=>{
      children.forEach((child,i)=>{if(parent.childNodes[i]!==child)parent.insertBefore(child,parent.childNodes[i]||null);});
      while(parent.childNodes.length>children.length)parent.lastChild.remove();
    };
    const syncTree=(target,source)=>{
      if(target.nodeType!==source.nodeType||target.nodeName!==source.nodeName)return source;
      if(target.nodeType!==1){if(target.nodeValue!==source.nodeValue)target.nodeValue=source.nodeValue;return target;}
      syncAttributes(target,source);
      const children=Array.from(source.childNodes).map((child,i)=>target.childNodes[i]?syncTree(target.childNodes[i],child):child);align(target,children);return target;
    };
    const reconciled=new Map();
    for(let i=0;i<desired.length;i++){
      const target=previous[i],source=desired[i],gem=chosen.get(i)||source.querySelector(':scope > .gem'),floor=target.querySelector(':scope > .floor-shape');
      syncAttributes(target,source);
      const children=Array.from(source.childNodes).map(child=>{
        if(child.nodeType===1&&child.classList.contains('gem'))return syncTree(gem,child);
        if(child.nodeType===1&&child.classList.contains('floor-shape'))return syncTree(floor,child);
        const prior=Array.from(target.childNodes).find(old=>old.nodeType===child.nodeType&&old.nodeName===child.nodeName&&(old.nodeType!==1||old.getAttribute('class')===child.getAttribute('class')));
        return prior?syncTree(prior,child):child;
      });align(target,children);reconciled.set(i,target);
    }
    const key=node=>node.nodeType===1?node.nodeName+'|'+(node.getAttribute('id')||node.getAttribute('class')||''):null;
    const staticNodes=new Map(Array.from(board.childNodes).filter(node=>node.nodeType===1&&!node.hasAttribute('data-index')).map(node=>[key(node),node]));
    const children=Array.from(template.childNodes).map(node=>{
      if(node.nodeType===1&&node.hasAttribute('data-index'))return reconciled.get(index(node));
      const prior=staticNodes.get(key(node));return prior?syncTree(prior,node):node;
    });align(board,children);
    return Object.freeze({reused:reused.size,created:desired.length-reused.size,removed:oldGems.length-reused.size,moved:routes.filter(route=>!route.spawn&&route.from!==route.to).length});
  }

  const api = Object.freeze({ geometry, markup, swapPaths, reconcile });
  root.HexBoardView = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
