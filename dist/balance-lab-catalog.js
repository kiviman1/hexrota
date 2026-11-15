/* Isolated developer catalog. No storage, attempt selection, clock or network. */
(function(root){
 'use strict';
 const VERSION='balance-lab-9-4-v1',plain=value=>JSON.parse(JSON.stringify(value));
 const map=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const exact=(value,keys)=>map(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
 const pairKey=pair=>pair.slice().sort((a,b)=>a-b).join(':');
 const allVariants=['v1','v2','v3','v4'];
 const planned={
  'l3-moves-plus-1':{levelId:3,factor:'moves',delta:1,variants:allVariants},
  'l5-moves-plus-1':{levelId:5,factor:'moves',delta:1,variants:allVariants},
  'l6-moves-plus-2':{levelId:6,factor:'moves',delta:2,variants:allVariants},
  'l7-moves-plus-1':{levelId:7,factor:'moves',delta:1,variants:allVariants},
  'l8-moves-plus-2':{levelId:8,factor:'moves',delta:2,variants:allVariants},
  'l9-moves-plus-2':{levelId:9,factor:'moves',delta:2,variants:allVariants},
  'l10-moves-plus-2':{levelId:10,factor:'moves',delta:2,variants:allVariants},
  'l6-reduce-double-1':{levelId:6,factor:'layers',reduce:1,variants:allVariants},
  'l8-reduce-double-2':{levelId:8,factor:'layers',reduce:2,variants:allVariants},
  'l10-relocate-double':{levelId:10,factor:'layers',relocate:true,variants:allVariants},
  'l5-initial-v1':{levelId:5,factor:'initial',variants:['v1']},
  'l5-seed-v1':{levelId:5,factor:'seed',variants:['v1']},
  'l9-initial-v4':{levelId:9,factor:'initial',variants:['v4']}
 };
 function fail(message,code='INVALID_LAB_CONFIG'){const error=new Error(message);error.code=code;throw error;}
 function need(condition,message){if(!condition)fail(message);}
 function validateRoutes(level,routes,Engine){
  need(Array.isArray(routes)&&routes.length>=2,'Deneyin en az iki doğrulanmış yolu olmalı.');
  const starts=new Set();
  for(const route of routes){
   need(Array.isArray(route)&&route.length>0&&route.length<=level.moves,'Deney çözüm yolu geçersiz.');
   const game=new Engine(level);
   for(const pair of route){need(Array.isArray(pair)&&pair.length===2&&pair.every(index=>Number.isInteger(index)&&index>=0&&index<level.cells.length)&&pair[0]!==pair[1],'Deney takası geçersiz.');need(game.status==='playing'&&game.swap(...pair).ok,'Deney yolu oynanabilir değil.');}
   need(game.status==='won','Deney çözüm yolu kazanmayla bitmiyor.');starts.add(pairKey(route[0]));
  }
  need(starts.size>=2,'Deney yolları farklı ilk takaslarla başlamalı.');
  return {valid:true,independentOpenings:starts.size,routeLengths:routes.map(route=>route.length),kind:'full_information_replay'};
 }
 function createCatalog(baseLevels,variantPack,experimentData,Engine=root.HexMatch){
  need(Array.isArray(baseLevels)&&baseLevels.length===10&&typeof Engine==='function','Bölüm verileri ve oyun motoru gerekli.');
  need(exact(experimentData,['schemaVersion','labVersion','status','rulesVersion','baseLevelDataVersion','generation','experiments'])&&experimentData.schemaVersion===1&&experimentData.labVersion===VERSION&&experimentData.status==='analysis_only'&&experimentData.rulesVersion==='classic-v4'&&map(experimentData.generation)&&Array.isArray(experimentData.experiments),'Laboratuvar sürümü veya veri şeması geçersiz.');
  need(map(variantPack)&&variantPack.schemaVersion===1&&variantPack.rulesVersion==='classic-v4'&&variantPack.levelDataVersion===experimentData.baseLevelDataVersion&&Array.isArray(variantPack.levels)&&variantPack.levels.length===10,'Yayımlanmış varyant paketi geçersiz.');
  const data=plain(experimentData),bases=new Map(),variants=new Map(),experiments=new Map(),cache=new Map(),keys=[];
  for(const base of baseLevels){need(map(base)&&Number.isInteger(base.id)&&base.id>=1&&base.id<=10&&!bases.has(base.id)&&Array.isArray(base.cells)&&Array.isArray(base.palette)&&base.cells.length>0&&base.palette.length>0&&Number.isInteger(base.moves)&&base.moves>0&&Number.isInteger(base.target)&&base.target>0,'Ana bölüm kimliği veya kuralları geçersiz.');bases.set(base.id,plain(base));}
  for(const entry of variantPack.levels){need(map(entry)&&bases.has(entry.levelId)&&!variants.has(entry.levelId)&&Array.isArray(entry.variants)&&entry.variants.length===4,'Varyant bölüm kimliği geçersiz.');const group=new Map();for(const variant of entry.variants){need(map(variant)&&allVariants.includes(variant.id)&&!group.has(variant.id),'Varyant kimliği geçersiz.');group.set(variant.id,plain(variant));keys.push([entry.levelId,variant.id,'baseline']);}variants.set(entry.levelId,group);}
  for(const item of data.experiments){
   need(exact(item,['id','levelId','label','description','factor','variantIds','patch','certificates','selection']),'Deney alanları geçersiz.');
   const plan=planned[item.id];need(!!plan&&!experiments.has(item.id)&&item.levelId===plan.levelId&&item.factor===plan.factor&&typeof item.label==='string'&&item.label.length>0&&item.label.length<=100&&typeof item.description==='string'&&item.description.length<=300&&Array.isArray(item.variantIds)&&JSON.stringify(item.variantIds)===JSON.stringify(plan.variants)&&map(item.selection),'Bilinmeyen veya değiştirilmiş deney tanımı.');
   const base=bases.get(item.levelId),patch=item.patch;
   need(map(item.certificates)&&JSON.stringify(Object.keys(item.certificates).sort())===JSON.stringify(item.variantIds.slice().sort()),'Deney sertifikalarının varyantları eşleşmiyor.');
   if(item.factor==='moves')need(exact(patch,['movesDelta'])&&patch.movesDelta===plan.delta,'Hamle deneyi yalnız planlanan bütçeyi değiştirebilir.');
   else if(item.factor==='initial')need(exact(patch,['initial'])&&Array.isArray(patch.initial)&&patch.initial.length===base.cells.length&&patch.initial.every(value=>base.palette.includes(value)),'Başlangıç deneyi yalnız sayı dizilimini değiştirebilir.');
   else if(item.factor==='seed')need(exact(patch,['seed'])&&Number.isInteger(patch.seed)&&patch.seed>0&&patch.seed<=0xffffffff,'Tohum deneyi yalnız uint32 tohumu değiştirebilir.');
   else{
    need(exact(patch,['layers'])&&Array.isArray(patch.layers)&&patch.layers.length===(plan.relocate?2:plan.reduce),'Zemin deneyi yalnız planlanan katları değiştirebilir.');
    const seen=new Set();let difference=0;
    for(const change of patch.layers){need(exact(change,['index','layers'])&&Number.isInteger(change.index)&&change.index>=0&&change.index<base.cells.length&&!seen.has(change.index)&&[1,2].includes(change.layers)&&base.cells[change.index].layers!==change.layers,'Deney zemin hücresi geçersiz.');seen.add(change.index);difference+=change.layers-(base.cells[change.index].layers||1);}
    need(plan.relocate?difference===0:difference===-plan.reduce,'Deneyin toplam kat değişimi planla eşleşmiyor.');
   }
   experiments.set(item.id,item);for(const variantId of item.variantIds)keys.push([item.levelId,variantId,item.id]);
  }
  need(experiments.size===Object.keys(planned).length,'Planlanan deneylerden biri eksik.');
  function resolve(levelId,variantId,experimentId='baseline'){
   if(!Number.isInteger(levelId)||!bases.has(levelId)||typeof variantId!=='string'||!variants.get(levelId).has(variantId)||typeof experimentId!=='string')fail('Bölüm, varyant veya deney seçimi geçersiz.','UNKNOWN_LAB_SCENARIO');
   const experiment=experimentId==='baseline'?null:experiments.get(experimentId);
   if(experimentId!=='baseline'&&(!experiment||experiment.levelId!==levelId||!experiment.variantIds.includes(variantId)))fail('Bu deney seçili bölüm ve varyantta yok.','UNKNOWN_LAB_SCENARIO');
   const cacheKey=levelId+'/'+variantId+'/'+experimentId;
   if(!cache.has(cacheKey)){
    const base=bases.get(levelId),variant=variants.get(levelId).get(variantId),level=plain(base),patch=experiment?experiment.patch:null;
    need(Array.isArray(variant.initial)&&variant.initial.length===level.cells.length&&variant.initial.every(value=>level.palette.includes(value))&&Number.isInteger(variant.seed)&&variant.seed>0&&variant.seed<=0xffffffff,'Yayımlanmış başlangıç veya tohum geçersiz.');
    level.initial=variant.initial.slice();level.seed=variant.seed;
    if(patch){if(patch.movesDelta!==undefined)level.moves+=patch.movesDelta;if(patch.initial)level.initial=patch.initial.slice();if(patch.seed!==undefined)level.seed=patch.seed;if(patch.layers)for(const change of patch.layers)level.cells[change.index].layers=change.layers;}
    if(experiment?.factor==='initial')need(JSON.stringify(level.initial)!==JSON.stringify(variant.initial),'Başlangıç deneyi orijinalle aynı olamaz.');
    if(experiment?.factor==='seed')need(level.seed!==variant.seed,'Tohum deneyi orijinalle aynı olamaz.');
    const routes=plain(experiment?experiment.certificates[variantId]:variant.solutions),scenarioId=`lab94-l${levelId}-${variantId}-${experimentId}`;
    Object.assign(level,{id:scenarioId,variantId:`lab94-${variantId}-${experimentId}`,levelDataVersion:VERSION,solutions:routes,solution:routes[0],alternativeSolutions:routes.slice(1)});
    const game=new Engine(level);need(game.findMatches().length===0&&game.legalMoves().length>=2,'Deney başlangıcı kararlı ve çok seçenekli olmalı.');
    const certification=validateRoutes(level,routes,Engine);level.par=Math.min(...certification.routeLengths);
    cache.set(cacheKey,{scenarioId,levelId,variantId,experimentId,label:experiment?experiment.label:'Orijinal',description:experiment?experiment.description:'Yayımlanmış tahta, ayrı laboratuvar kimliğiyle oynanır.',factor:experiment?experiment.factor:'baseline',changedFields:experiment?[experiment.factor==='layers'?'cells.layers':experiment.factor]:[],patch:patch?plain(patch):{},baselineRef:{levelId,variantId,levelDataVersion:variantPack.levelDataVersion},level,certification,selection:experiment?plain(experiment.selection):{rule:'Unchanged published variant; isolated identity only.'}});
   }
   return plain(cache.get(cacheKey));
  }
  // Only deterministic certificate replay happens here, never candidate search.
  for(const [levelId,variantId,experimentId]of keys)resolve(levelId,variantId,experimentId);
  return Object.freeze({version:VERSION,listScenarios:()=>keys.map(args=>resolve(...args)),listExperiments:(levelId,variantId)=>{resolve(levelId,variantId,'baseline');return keys.filter(key=>key[0]===levelId&&key[1]===variantId).map(args=>resolve(...args));},resolve});
 }
 const api=Object.freeze({VERSION,createCatalog});root.HexBalanceLabCatalog=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
