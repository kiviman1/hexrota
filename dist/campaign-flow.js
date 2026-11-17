/* Versioned campaign overrides and storage scope for integrated review.
 * Full definitions stay archived; new attempts use the current per-level version. */
(function(root){
 'use strict';
 const prefix='hexrota-flow-9-12:',version='campaign-flow-v1',versions=Object.freeze(['campaign-flow-v1','campaign-flow-v2']);
 const variants=Object.freeze({'campaign-flow-v1':'flow-v1','campaign-flow-v2':'flow-v2'});
 let enabled=false,reviewVersion=null;try{const query=new URLSearchParams(root.location?.search||'');enabled=query.get('dev')==='flow-9-12';if(enabled&&query.has('flowData'))reviewVersion=query.get('flowData');}catch(_){}
 const copy=v=>JSON.parse(JSON.stringify(v)),known=v=>versions.includes(v);
 function storage(backing){return Object.freeze({getItem:key=>backing.getItem(prefix+key),setItem:(key,value)=>backing.setItem(prefix+key,value),removeItem:key=>backing.removeItem(prefix+key)});}
 function currentLevels(overrides,currentVersion=null){
  if(currentVersion!==null&&!known(currentVersion))throw new Error('Unknown flow campaign version');
  const current=new Map();
  for(const level of overrides){
   if(!known(level.levelDataVersion)||level.variantId!==variants[level.levelDataVersion])throw new Error('Invalid campaign flow override');
   if(currentVersion!==null&&level.levelDataVersion!==currentVersion)continue;
   const previous=current.get(level.id);
   if(!previous||versions.indexOf(level.levelDataVersion)>versions.indexOf(previous.levelDataVersion))current.set(level.id,level);
  }
  return [...current.values()];
 }
 function createCatalog(classic,overrides,Engine=root.HexMatch,options={}){
  const pin=options.currentVersion??null,registry=new Map();
  if(pin!==null&&!known(pin))throw new Error('Unknown flow campaign version');
  for(const source of overrides){
   const level=copy(source),dataVersion=level.levelDataVersion;
   if(!Number.isInteger(level.id)||!known(dataVersion)||level.variantId!==variants[dataVersion]||level.rulesVersion!=='classic-v5')throw new Error('Invalid campaign flow override');
   classic.legacyMetadata(level.id);
   if(!registry.has(level.id))registry.set(level.id,new Map());
   const archives=registry.get(level.id);if(archives.has(dataVersion))throw new Error('Invalid campaign flow override');
   Engine.validateLevel(level);
   if(!Array.isArray(level.solutions)||level.solutions.length<2)throw new Error('Flow campaign requires independent winning routes');
   const openings=new Set();for(const route of level.solutions){const game=new Engine(level);if(!Array.isArray(route)||!route.length||!route.every(pair=>Array.isArray(pair)&&pair.length===2&&game.swap(...pair).ok)||game.status!=='won')throw new Error('Invalid campaign flow certificate');openings.add(route[0].slice().sort((a,b)=>a-b).join(','));}
   if(openings.size<2)throw new Error('Flow campaign requires independent openings');
   (function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}})(level);archives.set(dataVersion,level);
  }
  const current=new Map(currentLevels([...registry.values()].flatMap(entries=>[...entries.values()]),pin).map(level=>[level.id,level]));
  const archived=id=>registry.has(id),classicAllowed=id=>!registry.get(id)?.has(version);
  function resolveLevel(id,variantId,levelDataVersion){
   if(!archived(id)||(!known(levelDataVersion)&&classicAllowed(id)))return classic.resolveLevel(id,variantId,levelDataVersion);
   const level=registry.get(id).get(levelDataVersion);
   if(!level||variantId!==level.variantId)throw new Error('Unknown flow campaign version');return level;
  }
  function sanitize(id,m){
   resolveLevel(id,m?.variantId,m?.levelDataVersion);
   if(!m||m.attemptVersion!==1||m.levelId!==id||!Number.isSafeInteger(m.attemptSerial)||m.attemptSerial<1||typeof m.attemptId!=='string'||!new RegExp('^a-'+id+'-'+m.attemptSerial+'-[0-9a-f]{8}$').test(m.attemptId))throw new Error('Invalid flow attempt identity');
   return {attemptVersion:1,levelId:id,variantId:m.variantId,levelDataVersion:m.levelDataVersion,attemptId:m.attemptId,attemptSerial:m.attemptSerial};
  }
  function start(id,options={}){
   const explicit=options.levelDataVersion!==undefined;
   if((!current.has(id)&&!explicit)||!archived(id)||(explicit&&!known(options.levelDataVersion)&&classicAllowed(id)))return classic.start(id,options);
   const level=explicit?registry.get(id).get(options.levelDataVersion):current.get(id);
   if(!level)throw new Error('Unknown flow campaign version');
   const serial=options.attemptSerial??1,seed=options.selectionSeed??0x9e3779b9;
   if(!Number.isSafeInteger(serial)||serial<1||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Invalid flow attempt selection');
   const selectionSeed=root.HexAttempts.randomStep(seed),metadata={attemptVersion:1,levelId:id,variantId:level.variantId,levelDataVersion:level.levelDataVersion,attemptId:'a-'+id+'-'+serial+'-'+selectionSeed.toString(16).padStart(8,'0'),attemptSerial:serial};
   return {metadata,level,selectionSeed};
  }
  function restore(id,record,metadata){
   const identity=record?.attemptVersion!==undefined?record:metadata;
   if(!archived(id)||(!known(identity?.levelDataVersion)&&classicAllowed(id)))return classic.restore(id,record,metadata);
   let snapshot=record;
   if(record?.attemptVersion!==undefined){if(metadata!=null)throw new Error('Duplicate attempt identity');snapshot=record.snapshot;}
   const clean=sanitize(id,identity),level=resolveLevel(id,clean.variantId,clean.levelDataVersion);if(!snapshot)throw new Error('Missing flow checkpoint');
   const game=new Engine(level,snapshot);return {metadata:clean,level,game,snapshot:game.snapshot(),legacy:false};
  }
  function checkpoint(metadata,source){if(!archived(metadata?.levelId)||(!known(metadata?.levelDataVersion)&&classicAllowed(metadata.levelId)))return classic.checkpoint(metadata,source);const checked=restore(metadata.levelId,typeof source?.snapshot==='function'?source.snapshot():source,metadata);return {...checked.metadata,snapshot:checked.snapshot};}
  function list(id,dataVersion){
   if(!archived(id))return classic.list(id,dataVersion);
   if(dataVersion==null){if(!current.has(id))return classic.list(id);return [current.get(id).variantId];}
   if(!known(dataVersion)&&classicAllowed(id))return classic.list(id,dataVersion);
   const level=registry.get(id).get(dataVersion);if(!level)throw new Error('Unknown flow campaign version');return [level.variantId];
  }
  return Object.freeze({...classic,start,restore,checkpoint,resolveLevel,list,legacyMetadata:id=>{if(!classicAllowed(id))throw new Error('Flow campaign has no legacy identity');return classic.legacyMetadata(id);}});
 }
 const api=Object.freeze({enabled,prefix,version,versions,reviewVersion,currentLevels,storage,createCatalog});root.HexCampaignFlow=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
