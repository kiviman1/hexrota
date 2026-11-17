/* Isolated, versioned material-objective alpha catalog. Full level definitions
 * stay in this scope; classic attempts and archived flow saves stay separate. */
(function(root){
 'use strict';
 const prefix='hexrota-material-9-14:',version='material-alpha-v1',variant='materials-v1',versions=Object.freeze([version]);
 const alpha=id=>Number.isInteger(id)&&id>=6&&id<=8,record=value=>value&&typeof value==='object'&&!Array.isArray(value);
 const dense=value=>{if(!Array.isArray(value))return false;for(let i=0;i<value.length;i++)if(!Object.prototype.hasOwnProperty.call(value,i))return false;return true;};
 const copy=value=>JSON.parse(JSON.stringify(value));
 const freeze=value=>{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;};
 let enabled=false;try{enabled=new URLSearchParams(root.location?.search||'').get('dev')==='materials-9-14';}catch(_){}
 function storage(backing){return Object.freeze({getItem:key=>backing.getItem(prefix+key),setItem:(key,value)=>backing.setItem(prefix+key,value),removeItem:key=>backing.removeItem(prefix+key)});}
 function identity(level){return record(level)&&alpha(level.id)&&level.levelDataVersion===version&&level.variantId===variant&&level.rulesVersion==='classic-v6';}
 function currentLevels(overrides,currentVersion=null){
  if(currentVersion!==null&&currentVersion!==version)throw new Error('Unknown material alpha version');
  if(!dense(overrides))throw new Error('Invalid material alpha override');
  const ids=new Set(),result=[];for(const source of overrides){if(!identity(source)||ids.has(source.id))throw new Error('Invalid material alpha override');ids.add(source.id);result.push(freeze(copy(source)));}return result;
 }
 function createCatalog(classic,overrides,Engine=root.HexMatch,options={}){
  if(!classic||typeof classic.start!=='function'||typeof Engine!=='function'||!record(options))throw new Error('Invalid material alpha catalog');
  const currentVersion=options.currentVersion??null;if(currentVersion!==null&&currentVersion!==version)throw new Error('Unknown material alpha version');
  if(!dense(overrides))throw new Error('Invalid material alpha override');
  // Validate original claims before JSON copying can discard undefined keys.
  for(const source of overrides){if(!identity(source))throw new Error('Invalid material alpha override');Engine.validateLevel(source);}
  const registry=new Map();for(const level of currentLevels(overrides,currentVersion)){
   classic.legacyMetadata(level.id);Engine.validateLevel(level);
   if(!dense(level.solutions)||level.solutions.length<2)throw new Error('Material alpha requires independent winning routes');
   const openings=new Set();for(const route of level.solutions){
    if(!dense(route)||!route.length)throw new Error('Invalid material alpha certificate');
    const game=new Engine(level);for(const pair of route)if(!dense(pair)||pair.length!==2||!pair.every(Number.isInteger)||!game.swap(pair[0],pair[1]).ok)throw new Error('Invalid material alpha certificate');
    if(game.status!=='won')throw new Error('Invalid material alpha certificate');openings.add(route[0].slice().sort((a,b)=>a-b).join(','));
   }
   if(openings.size<2)throw new Error('Material alpha requires independent openings');registry.set(level.id,level);
  }
  function resolveLevel(id,variantId,levelDataVersion){
   if(!alpha(id))return classic.resolveLevel(id,variantId,levelDataVersion);
   const level=registry.get(id);if(!level||levelDataVersion!==version||variantId!==variant)throw new Error('Unknown material alpha version');return level;
  }
  function sanitize(id,metadata){
   resolveLevel(id,metadata?.variantId,metadata?.levelDataVersion);
   if(!record(metadata)||metadata.attemptVersion!==1||metadata.levelId!==id||!Number.isSafeInteger(metadata.attemptSerial)||metadata.attemptSerial<1||typeof metadata.attemptId!=='string'||!new RegExp('^a-'+id+'-'+metadata.attemptSerial+'-[0-9a-f]{8}$').test(metadata.attemptId))throw new Error('Invalid material alpha attempt identity');
   return {attemptVersion:1,levelId:id,variantId:variant,levelDataVersion:version,attemptId:metadata.attemptId,attemptSerial:metadata.attemptSerial};
  }
  function start(id,options={}){
   if(!alpha(id))return classic.start(id,options);
   if(!record(options)||options.levelDataVersion!==undefined&&options.levelDataVersion!==version)throw new Error('Unknown material alpha version');
   const level=registry.get(id);if(!level)throw new Error('Unknown material alpha version');
   const serial=options.attemptSerial??1,seed=options.selectionSeed??0x9e3779b9;
   if(!Number.isSafeInteger(serial)||serial<1||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Invalid material alpha selection');
   const selectionSeed=root.HexAttempts.randomStep(seed),metadata={attemptVersion:1,levelId:id,variantId:variant,levelDataVersion:version,attemptId:'a-'+id+'-'+serial+'-'+selectionSeed.toString(16).padStart(8,'0'),attemptSerial:serial};
   return {metadata,level,selectionSeed};
  }
  function restore(id,record,metadata){
   if(!alpha(id))return classic.restore(id,record,metadata);
   let snapshot=record,identity=metadata;if(record?.attemptVersion!==undefined){if(metadata!=null)throw new Error('Duplicate attempt identity');snapshot=record.snapshot;identity=record;}
   const clean=sanitize(id,identity),level=resolveLevel(id,clean.variantId,clean.levelDataVersion);if(!snapshot)throw new Error('Missing material alpha checkpoint');
   const game=new Engine(level,snapshot);return {metadata:clean,level,game,snapshot:game.snapshot(),legacy:false};
  }
  function checkpoint(metadata,source){
   if(!alpha(metadata?.levelId))return classic.checkpoint(metadata,source);
   const checked=restore(metadata.levelId,typeof source?.snapshot==='function'?source.snapshot():source,metadata);return {...checked.metadata,snapshot:checked.snapshot};
  }
  function list(id,dataVersion){
   if(!alpha(id))return classic.list(id,dataVersion);
   if(!registry.has(id)||dataVersion!==undefined&&dataVersion!==null&&dataVersion!==version)throw new Error('Unknown material alpha version');return [variant];
  }
  return Object.freeze({...classic,start,restore,checkpoint,resolveLevel,list,legacyMetadata:id=>{if(alpha(id))throw new Error('Material alpha has no legacy identity');return classic.legacyMetadata(id);}});
 }
 const api=Object.freeze({enabled,prefix,version,versions,currentLevels,storage,createCatalog});root.HexMaterialAlpha=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
