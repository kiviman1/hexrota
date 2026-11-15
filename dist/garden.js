/* Derived botanical presentation. No progression, storage, clock or gameplay writes. */
(function(root){
 'use strict';
 const IDS=Object.freeze(['flowers','plants','trees','complete']);
 const TEXT=Object.freeze({
  flowers:Object.freeze({label:'Çiçekler',description:'İlk çiçeklerin bahçeye renk katıyor.'}),
  plants:Object.freeze({label:'Yeni bitkiler',description:'Yapraklar ve filizler bahçeni dolduruyor.'}),
  trees:Object.freeze({label:'Ağaçlar',description:'Bahçenin ağaçları büyüdü.'}),
  complete:Object.freeze({label:'Tamamlanmış bahçe',description:'Bütün bahçe açıldı. Kazandığın ilerleme burada kalır.'})
 });
 const map=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const exact=(value,keys)=>map(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
 const integer=value=>Number.isSafeInteger(value)&&value>=0;
 const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 function invalid(){const error=new Error('Invalid botanical view');error.code='invalid_botanical_view';throw error;}
 function describe(view){
  if(!map(view)||!integer(view.stars)||!Array.isArray(view.botanical)||view.botanical.length!==IDS.length)invalid();
  let previous=0;
  const milestones=view.botanical.map((entry,index)=>{
   if(!exact(entry,['stars','id','unlocked'])||entry.id!==IDS[index]||!integer(entry.stars)||entry.stars<=previous||typeof entry.unlocked!=='boolean'||entry.unlocked!==(view.stars>=entry.stars))invalid();
   previous=entry.stars;return {id:entry.id,stars:entry.stars,unlocked:entry.unlocked,...TEXT[entry.id]};
  });
  const maxStars=milestones[milestones.length-1].stars;if(view.stars>maxStars)invalid();
  const unlockedIds=milestones.filter(entry=>entry.unlocked).map(entry=>entry.id),pending=milestones.find(entry=>!entry.unlocked),complete=!pending;
  const next=pending?{id:pending.id,label:pending.label,stars:pending.stars,remaining:pending.stars-view.stars}:null;
  const title=complete?'Bahçen tamamlandı':view.stars===0?'Bahçen seni bekliyor':'Bahçen büyüyor';
  const summary=complete?'Bütün bahçe açıldı. Yeni bölümler yakında.':view.stars===0?'İlk yıldızınla bahçe yolculuğun başlar.':'Kazandığın yıldızlarla açılan güzellikler burada kalır.';
  const progress=unlockedIds.length?milestones.filter(entry=>entry.unlocked).map(entry=>entry.label).join(', '):'Hazır toprak';
  const accessibleLabel=`${title}. ${view.stars} / ${maxStars} yıldız. ${progress}.${next?` Sıradaki: ${next.label}, ${next.remaining} yıldız kaldı.`:''}`;
  return {stars:view.stars,maxStars,tier:unlockedIds[unlockedIds.length-1]||'soil',complete,title,summary,accessibleLabel,unlockedIds,next,milestones};
 }
 function flower(x,y,scale,color){
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 0Q-8-18 0-36" fill="none" stroke="#487b52" stroke-width="4" stroke-linecap="round"/><path d="M-1-12Q-23-31-25-13Q-13-3-1-8M0-20Q24-39 24-21Q11-11 0-16" fill="#75a86e"/><g transform="translate(0 -39)" fill="${color}"><ellipse rx="7" ry="12" cy="-8"/><ellipse rx="7" ry="12" cy="8"/><ellipse rx="12" ry="7" cx="-8"/><ellipse rx="12" ry="7" cx="8"/><circle r="6" fill="#f6d47c"/></g></g>`;
 }
 function plant(x,y,scale){
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 1V-53" stroke="#3d7653" stroke-width="5" stroke-linecap="round"/><path d="M-1-13Q-40-10-40-42Q-7-49-1-13" fill="#74a96c"/><path d="M1-28Q39-21 38-58Q7-61 1-28" fill="#93bd7f"/><path d="M0-46Q-18-56-3-76Q15-62 0-46" fill="#bfd48c"/></g>`;
 }
 function tree(x,y,scale){
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-9 0L-5-84H7L11 0Z" fill="#a77c57"/><path d="M2-49L-24-75M3-61L28-92" fill="none" stroke="#a77c57" stroke-width="7" stroke-linecap="round"/><ellipse cy="-102" rx="48" ry="45" fill="#6e9d6a"/><ellipse cx="-24" cy="-83" rx="36" ry="34" fill="#80ad70"/><ellipse cx="24" cy="-93" rx="34" ry="37" fill="#92b77a"/><ellipse cx="-4" cy="-118" rx="32" ry="28" fill="#a9c68a"/><circle cx="-23" cy="-94" r="4" fill="#edc67c"/><circle cx="25" cy="-111" r="4" fill="#edc67c"/></g>`;
 }
 function markup(view){
  const state=describe(view),has=id=>state.unlockedIds.includes(id);
  const trees=has('trees')?`<g data-garden-layer="trees">${tree(128,237,.92)}${tree(501,225,1.06)}</g>`:'';
  const plants=has('plants')?`<g data-garden-layer="plants">${plant(198,260,.8)}${plant(430,267,.95)}${plant(363,220,.65)}</g>`:'';
  const flowers=has('flowers')?`<g data-garden-layer="flowers">${flower(212,306,.72,'#d9a4b4')}${flower(260,319,.9,'#f1c582')}${flower(317,330,.78,'#bcabd7')}${flower(373,319,.92,'#dfa5b0')}${flower(420,306,.7,'#f1c582')}</g>`:'';
  const finished=has('complete')?'<g data-garden-layer="complete"><path d="M282 261Q320 242 359 261L366 271Q320 252 275 271Z" fill="#d6d6b8"/><path d="M295 286Q320 275 347 286L354 298Q321 284 288 298Z" fill="#e0dfc4"/><path d="M311 157L320 146L329 157L320 168Z" fill="#e0bb66"/><path d="M304 157H297M343 157H336M320 141V134M320 181V174" stroke="#e0bb66" stroke-width="3" stroke-linecap="round"/><path d="M281 208V181Q320 143 359 181V208" fill="none" stroke="#b99c70" stroke-width="6" stroke-linecap="round"/><path d="M283 189Q300 172 311 176M335 176Q350 176 358 192" fill="none" stroke="#8eae76" stroke-width="9" stroke-linecap="round"/></g>':'';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="hex-garden-scene" viewBox="0 0 640 400" width="640" height="400" style="display:block;width:100%;height:auto" role="img" aria-label="${escape(state.accessibleLabel)}"><title>${escape(state.title)}</title><desc>${escape(state.summary)}</desc><g aria-hidden="true"><rect width="640" height="400" rx="32" fill="#eef1e5"/><circle cx="490" cy="83" r="30" fill="#f2dfad"/><path d="M50 218Q168 142 296 203Q439 134 589 208V317H50Z" fill="#dde6cf"/><ellipse cx="321" cy="332" rx="233" ry="35" fill="#d3ddc5"/>${trees}<g data-garden-layer="soil"><path d="M90 259L320 183L551 259L551 289L320 366L90 289Z" fill="#a78967"/><path d="M90 259L320 183L551 259L320 337Z" fill="#b8c58b"/><path d="M320 337V366L551 289V259Z" fill="#8c9c6a"/><path d="M176 257L257 231L324 253L242 281Z" fill="#897459" stroke="#d6bc91" stroke-width="5" stroke-linejoin="round"/><path d="M320 224L398 249L467 227L389 202Z" fill="#897459" stroke="#d6bc91" stroke-width="5" stroke-linejoin="round"/><path d="M202 291L317 253L433 291L317 330Z" fill="#947b59" stroke="#d6bc91" stroke-width="5" stroke-linejoin="round"/><path d="M208 253L246 241M227 265L265 252M364 224L398 235M386 217L420 228M254 296L301 280M290 307L337 291M326 317L373 301" fill="none" stroke="#b39a70" stroke-width="3" stroke-linecap="round"/></g>${plants}${flowers}${finished}</g></svg>`;
 }
 const api=Object.freeze({describe,markup});root.HexGarden=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
