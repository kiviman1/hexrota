/* Portable level attempts. Selection never touches the gameplay RNG or storage. */
(function(global){
  'use strict';
  const ATTEMPT_VERSION=1,LEGACY_VARIANT_ID='legacy-original',LEGACY_DATA_VERSION='original-v1';
  const plain=value=>JSON.parse(JSON.stringify(value));
  const validId=value=>(typeof value==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(value))||(Number.isSafeInteger(value)&&value>=0);
  const uint32=value=>Number.isInteger(value)&&value>=0&&value<=0xffffffff;
  const key=value=>typeof value+':'+String(value);
  function fail(code,message){const error=new Error(message);error.code=code;throw error;}
  function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;}
  function randomStep(value){let state=(value>>>0)||0x9e3779b9;state^=state<<13;state^=state>>>17;state^=state<<5;return state>>>0;}
  function routeKey(pair){return pair.slice().sort((a,b)=>a-b).join(',');}
  function createCatalog(baseLevels,data,Engine=global.HexMatch){
    if(!Array.isArray(baseLevels)||typeof Engine!=='function')fail('INVALID_CATALOG','Campaign levels and a replay engine are required');
    const bases=new Map(),packs=new Map(),resolved=new Map();
    for(const base of baseLevels){
      if(!base||!validId(base.id)||bases.has(key(base.id)))fail('INVALID_CATALOG','Level IDs must be unique');
      bases.set(key(base.id),base);
    }
    const source=Array.isArray(data)?data:data?[data]:[];let currentVersion=null;
    for(const pack of source){
      if(!pack||pack.schemaVersion!==1||typeof pack.levelDataVersion!=='string'||!validId(pack.levelDataVersion)||pack.levelDataVersion===LEGACY_DATA_VERSION||packs.has(pack.levelDataVersion)||!Array.isArray(pack.levels))fail('INVALID_CATALOG','Invalid or duplicate variant data version');
      const entries=new Map();
      for(const entry of pack.levels){
        const base=bases.get(key(entry?.levelId));
        if(!base||entries.has(key(entry.levelId))||!Array.isArray(entry.variants)||!entry.variants.length)fail('INVALID_CATALOG','Variant levels must identify an existing campaign level');
        const variants=new Map();
        for(const variant of entry.variants){
          if(!variant||!validId(variant.id)||typeof variant.id!=='string'||variant.id===LEGACY_VARIANT_ID||variants.has(variant.id)||!Array.isArray(variant.initial)||variant.initial.length!==base.cells.length||variant.initial.some(value=>!base.palette.includes(value))||!uint32(variant.seed)||variant.seed===0||!Array.isArray(variant.solutions)||variant.solutions.length<2)fail('INVALID_CATALOG','Invalid certified variant data');
          const openings=new Set();
          for(const route of variant.solutions){
            if(!Array.isArray(route)||!route.length||route.length>base.moves||route.some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(index=>!Number.isInteger(index)||index<0||index>=base.cells.length)||pair[0]===pair[1]))fail('INVALID_CATALOG','Invalid certified route shape');
            openings.add(routeKey(route[0]));
          }
          if(openings.size<2)fail('INVALID_CATALOG','Certified routes require different first swaps');
          variants.set(variant.id,freeze(plain(variant)));
        }
        entries.set(key(entry.levelId),{variants,difficulty:entry.difficulty?freeze(plain(entry.difficulty)):null});
      }
      packs.set(pack.levelDataVersion,entries);currentVersion=pack.levelDataVersion;
    }
    function baseFor(levelId){const base=bases.get(key(levelId));if(!base)fail('UNKNOWN_LEVEL','Unknown campaign level');return base;}
    function variantsFor(levelId,version=currentVersion){
      baseFor(levelId);const pack=packs.get(version);
      if(!pack)fail('UNKNOWN_DATA_VERSION','The saved level data version is unavailable');
      const entry=pack.get(key(levelId));if(!entry)fail('UNKNOWN_VARIANT','No variants are available for this level');return entry;
    }
    function resolveLevel(levelId,variantId=LEGACY_VARIANT_ID,levelDataVersion=LEGACY_DATA_VERSION){
      const base=baseFor(levelId);
      if(variantId===LEGACY_VARIANT_ID){
        if(levelDataVersion!==LEGACY_DATA_VERSION)fail('UNKNOWN_DATA_VERSION','The original board requires its original data version');
        return base;
      }
      const entry=variantsFor(levelId,levelDataVersion),variant=entry.variants.get(variantId);
      if(!variant)fail('UNKNOWN_VARIANT','The saved board variant is unavailable');
      const cacheKey=key(levelId)+'/'+levelDataVersion+'/'+variantId;
      if(!resolved.has(cacheKey)){
        const level=plain(base),routes=plain(variant.solutions);
        Object.assign(level,{initial:variant.initial.slice(),seed:variant.seed,solution:routes[0],alternativeSolutions:routes.slice(1),solutions:routes,variantId,levelDataVersion});
        if(Number.isInteger(variant.par)&&variant.par>0&&variant.par<=base.moves)level.par=variant.par;
        if(entry.difficulty)level.difficulty=plain(entry.difficulty);
        if(variant.difficultyMetrics)level.variantMetrics=plain(variant.difficultyMetrics);
        resolved.set(cacheKey,freeze(level));
      }
      return resolved.get(cacheKey);
    }
    function legacyMetadata(levelId){baseFor(levelId);return {attemptVersion:ATTEMPT_VERSION,levelId,variantId:LEGACY_VARIANT_ID,levelDataVersion:LEGACY_DATA_VERSION,attemptId:'legacy-'+levelId,attemptSerial:0};}
    function sanitize(levelId,metadata){
      if(!metadata||typeof metadata!=='object'||metadata.attemptVersion!==ATTEMPT_VERSION||metadata.levelId!==levelId||typeof metadata.variantId!=='string'||typeof metadata.levelDataVersion!=='string'||!Number.isSafeInteger(metadata.attemptSerial)||metadata.attemptSerial<0||typeof metadata.attemptId!=='string'||metadata.attemptId.length>180)fail('INVALID_ATTEMPT','Invalid attempt identity');
      resolveLevel(levelId,metadata.variantId,metadata.levelDataVersion);
      const legacy=metadata.variantId===LEGACY_VARIANT_ID;
      if(legacy?(metadata.attemptSerial!==0||metadata.attemptId!=='legacy-'+levelId):(metadata.attemptSerial<1||!metadata.attemptId.startsWith('a-'+levelId+'-'+metadata.attemptSerial+'-')||!/^[0-9a-f]{8}$/.test(metadata.attemptId.slice(('a-'+levelId+'-'+metadata.attemptSerial+'-').length))))fail('INVALID_ATTEMPT','Attempt ID does not match its identity');
      return {attemptVersion:ATTEMPT_VERSION,levelId,variantId:metadata.variantId,levelDataVersion:metadata.levelDataVersion,attemptId:metadata.attemptId,attemptSerial:metadata.attemptSerial};
    }
    function start(levelId,options={}){
      baseFor(levelId);const levelDataVersion=options.levelDataVersion??currentVersion,entry=variantsFor(levelId,levelDataVersion),ids=[...entry.variants.keys()];
      const attemptSerial=options.attemptSerial??1;
      if(!Number.isSafeInteger(attemptSerial)||attemptSerial<1||options.selectionSeed!==undefined&&!uint32(options.selectionSeed))fail('INVALID_SELECTION','Selection needs an unsigned seed and positive attempt serial');
      const previous=options.previousVariantId??null,recent=new Set(Array.isArray(options.recentVariantIds)?options.recentVariantIds:[]);
      let candidates=ids.filter(id=>id!==previous&&!recent.has(id));
      if(!candidates.length)candidates=ids.filter(id=>id!==previous);
      if(!candidates.length)candidates=ids;
      const selectionSeed=randomStep(options.selectionSeed??0x9e3779b9),variantId=candidates[selectionSeed%candidates.length];
      const metadata={attemptVersion:ATTEMPT_VERSION,levelId,variantId,levelDataVersion,attemptId:'a-'+levelId+'-'+attemptSerial+'-'+selectionSeed.toString(16).padStart(8,'0'),attemptSerial};
      return {metadata,level:resolveLevel(levelId,variantId,levelDataVersion),selectionSeed};
    }
    function restore(levelId,record,metadata){
      let snapshot=record,identity=metadata;
      if(record?.attemptVersion!==undefined){
        if(metadata!==undefined&&metadata!==null)fail('INVALID_ATTEMPT','Attempt identity must have one source');
        identity=record;snapshot=record.snapshot;
      }
      const clean=identity==null?legacyMetadata(levelId):sanitize(levelId,identity),level=resolveLevel(levelId,clean.variantId,clean.levelDataVersion);
      if(!snapshot||typeof snapshot!=='object')fail('INVALID_ATTEMPT','An attempt requires a gameplay checkpoint');
      // The engine replays every move and compares board, terrain, points and RNG.
      const game=new Engine(level,snapshot);
      return {metadata:clean,level,snapshot:game.snapshot(),game,legacy:clean.variantId===LEGACY_VARIANT_ID};
    }
    function checkpoint(metadata,engineOrSnapshot){
      const clean=sanitize(metadata?.levelId,metadata),snapshot=typeof engineOrSnapshot?.snapshot==='function'?engineOrSnapshot.snapshot():engineOrSnapshot;
      const restored=restore(clean.levelId,snapshot,clean);
      return {...clean,snapshot:restored.snapshot};
    }
    function list(levelId,version=currentVersion){return [...variantsFor(levelId,version).variants.keys()];}
    return Object.freeze({start,restore,checkpoint,resolveLevel,list,currentVersion,legacyMetadata});
  }
  const api=Object.freeze({ATTEMPT_VERSION,LEGACY_VARIANT_ID,LEGACY_DATA_VERSION,createCatalog,randomStep});
  global.HexAttempts=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
