/* Pure board presentation: geometry, SVG markup, and reciprocal swap paths.
 * No DOM, storage, timers, RNG, or application state. The host owns mounting.
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

  const api = Object.freeze({ geometry, markup, swapPaths });
  root.HexBoardView = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
