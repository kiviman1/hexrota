/* Versioned campaign override and storage scope for the integrated 9.12 review.
 * Uses the same app, attempt identity format, canonical store and HexMatch. */
(function(root){
 'use strict';
 const prefix='hexrota-flow-9-12:',version='campaign-flow-v1';
 let enabled=false;try{enabled=new URLSearchParams(root.location?.search||'').get('dev')==='flow-9-12';}catch(_){}
 const copy=v=>JSON.parse(JSON.stringify(v));
 function storage(backing){return Object.freeze({getItem:key=>backing.getItem(prefix+key),setItem:(key,value)=>backing.setItem(prefix+key,value),removeItem:key=>backing.removeItem(prefix+key)});}
 function createCatalog(classic,overrides,Engine=root.HexMatch){
  const registry=new Map();
  for(const source of overrides){
   const level=copy(source);if(!Number.isInteger(level.id)||registry.has(level.id)||level.levelDataVersion!==version||level.variantId!=='flow-v1'||level.rulesVersion!=='classic-v5')throw new Error('Invalid campaign flow override');
   Engine.validateLevel(level);
   if(!Array.isArray(level.solutions)||level.solutions.length<2)throw new Error('Flow campaign requires independent winning routes');
   const openings=new Set();for(const route of level.solutions){const game=new Engine(level);if(!Array.isArray(route)||!route.length||!route.every(pair=>Array.isArray(pair)&&pair.length===2&&game.swap(...pair).ok)||game.status!=='won')throw new Error('Invalid campaign flow certificate');openings.add(route[0].slice().sort((a,b)=>a-b).join(','));}
   if(openings.size<2)throw new Error('Flow campaign requires independent openings');
   (function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}})(level);registry.set(level.id,level);
  }
  const flow=id=>registry.has(id);
  function resolveLevel(id,variantId,levelDataVersion){
   if(!flow(id))return classic.resolveLevel(id,variantId,levelDataVersion);
   if(variantId!=='flow-v1'||levelDataVersion!==version)throw new Error('Unknown flow campaign version');return registry.get(id);
  }
  function sanitize(id,m){
   resolveLevel(id,m?.variantId,m?.levelDataVersion);
   if(!m||m.attemptVersion!==1||m.levelId!==id||!Number.isSafeInteger(m.attemptSerial)||m.attemptSerial<1||typeof m.attemptId!=='string'||!new RegExp('^a-'+id+'-'+m.attemptSerial+'-[0-9a-f]{8}$').test(m.attemptId))throw new Error('Invalid flow attempt identity');
   return {attemptVersion:1,levelId:id,variantId:m.variantId,levelDataVersion:m.levelDataVersion,attemptId:m.attemptId,attemptSerial:m.attemptSerial};
  }
  function start(id,options={}){
   if(!flow(id))return classic.start(id,options);
   if(options.levelDataVersion!==undefined&&options.levelDataVersion!==version)throw new Error('Unknown flow campaign version');
   const serial=options.attemptSerial??1,seed=options.selectionSeed??0x9e3779b9;
   if(!Number.isSafeInteger(serial)||serial<1||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Invalid flow attempt selection');
   const selectionSeed=root.HexAttempts.randomStep(seed),metadata={attemptVersion:1,levelId:id,variantId:'flow-v1',levelDataVersion:version,attemptId:'a-'+id+'-'+serial+'-'+selectionSeed.toString(16).padStart(8,'0'),attemptSerial:serial};
   return {metadata,level:registry.get(id),selectionSeed};
  }
  function restore(id,record,metadata){
   if(!flow(id))return classic.restore(id,record,metadata);
   let snapshot=record,identity=metadata;if(record?.attemptVersion!==undefined){if(metadata!=null)throw new Error('Duplicate attempt identity');identity=record;snapshot=record.snapshot;}
   const clean=sanitize(id,identity),level=resolveLevel(id,clean.variantId,clean.levelDataVersion),game=new Engine(level,snapshot);if(!snapshot)throw new Error('Missing flow checkpoint');
   return {metadata:clean,level,game,snapshot:game.snapshot(),legacy:false};
  }
  function checkpoint(metadata,source){if(!flow(metadata?.levelId))return classic.checkpoint(metadata,source);const checked=restore(metadata.levelId,typeof source?.snapshot==='function'?source.snapshot():source,metadata);return {...checked.metadata,snapshot:checked.snapshot};}
  return Object.freeze({...classic,start,restore,checkpoint,resolveLevel,list:(id,dataVersion)=>flow(id)?(dataVersion==null||dataVersion===version?['flow-v1']:(()=>{throw new Error('Unknown flow campaign version');})()):classic.list(id,dataVersion),legacyMetadata:id=>{if(flow(id))throw new Error('Flow campaign has no legacy identity');return classic.legacyMetadata(id);}});
 }
 const api=Object.freeze({enabled,prefix,version,storage,createCatalog});root.HexCampaignFlow=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
