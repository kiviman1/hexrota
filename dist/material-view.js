/* Pure material paint projections. No rules, storage, timers or game authority. */
(function(root){
 'use strict';
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function name(id){return id==='wood'?'Ahşap':id==='nail'?'Çivi':String(id);}
 function icon(id){
  if(id==='wood')return '<g class="material-icon-wood"><path d="m-10-5 16-4 3 7-16 4Z"/><path d="m-8 3 16-4 3 7-16 4Z"/><path class="material-grain" d="m-6-3 9-2m-7 10 9-2"/></g>';
  if(id==='nail')return '<g class="material-icon-nail"><path d="M-6-9H6v4H2v13l-2 3-2-3V-5h-4Z"/><path class="material-nail-shine" d="M-3-7H3M0-4V7"/></g>';
  return '<g class="material-icon-other"><path d="m0-9 8 5v9L0 10-8 5v-9Z"/></g>';
 }
 function markers(level,state,cell){
  if(level.rulesVersion!=='classic-v6'||!level.materials||!Array.isArray(state.collectedSources))return '';
  const list=[];
  for(let i=0;i<level.materials.sources.length;i++){
   const source=level.materials.sources[i];if(source.cell!==cell||state.collectedSources[i])continue;
   if(source.kind==='matched-cell'){
    if(state.values[cell]==null||state.cellOpen&&state.cellOpen[cell]!==true)continue;
   }else{
    const index=level.obstacles.blockers.findIndex(box=>box.id===source.blockerId);
    if(index<0||state.blockerHp[index]<=0)continue;
   }
   list.push(source);
  }
  if(!list.length)return '';
  const ids=[...new Set(list.map(source=>source.materialId))],crate=list.every(source=>source.kind==='crate-break'),position=crate?'0,22':'18,22';
  const glyphs=ids.slice(0,2).map((id,i)=>`<g transform="translate(${ids.length>1?(i?4:-4):0},0) scale(${ids.length>1?.37:.62})">${icon(id)}</g>`).join('');
  return `<g class="material-marker ${crate?'material-crate-badge':'material-cell-token'}" transform="translate(${position})" data-material-cell="${cell}" data-material-source="${escape(list.length===1?list[0].id:'')}" data-material-sources="${escape(JSON.stringify(list.map(source=>source.id)))}" aria-hidden="true" pointer-events="none"><title>${escape(list.map(source=>name(source.materialId)+' '+source.quantity).join(', '))}</title><circle class="material-marker-base" r="8"/>${glyphs}</g>`;
 }
 function hud(level,state,{prefix='material-count-'}={}){
  if(level.rulesVersion!=='classic-v6'||!level.materials)return '';
  return level.materials.definitions.map((definition,index)=>{
   const goal=level.objectives.materials.find(item=>item.materialId===definition.id),count=state.materialCounts[index],label=name(definition.id),id=escape(definition.id);
   return `<div class="material-goal${goal&&count>=goal.quantity?' complete':''}" data-material-id="${id}" aria-label="${escape(label+' '+count+(goal?' / '+goal.quantity:''))}"><svg class="material-goal-icon" viewBox="-13 -13 26 26" aria-hidden="true">${icon(definition.id)}</svg><span>${escape(label)}</span><strong id="${escape(prefix)}${id}" data-material-count="${count}" data-material-target="${goal?goal.quantity:''}">${count}${goal?` <small>/ ${goal.quantity}</small>`:''}</strong></div>`;
  }).join('');
 }
 const api=Object.freeze({name,icon,markers,hud});root.HexMaterialView=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
