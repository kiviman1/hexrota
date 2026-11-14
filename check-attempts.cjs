/* Portable attempt identities, legacy compatibility, selector isolation and honest hints. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js','variants-data.js','attempts.js','reward-rules.js','rewards.js','reward-adapter.js'])vm.runInContext(fs.readFileSync(__dirname+'/dist/'+file,'utf8'),context,{filename:file});
const {HexMatch:Engine,HEX_LEVELS:levels,HEX_VARIANTS:pack,HexAttempts}=context.window;
const plain=value=>JSON.parse(JSON.stringify(value));
const key=pair=>pair.slice().sort((a,b)=>a-b).join(':');
const catalog=HexAttempts.createCatalog(levels,pack,Engine);
let routeHints=0,offPathHints=0;
for(const base of levels){
 const original=new Engine(base);original.swap(...base.solution[0]);
 const raw=plain(original.snapshot()),legacy=catalog.restore(base.id,raw);
 assert(legacy.legacy,'missing variant metadata selects the original configuration');
 assert.equal(legacy.metadata.variantId,'legacy-original');assert.equal(legacy.metadata.levelDataVersion,'original-v1');
 assert.deepEqual(plain(legacy.snapshot),raw,'old point/layer/RNG/history state survives');
 assert.deepEqual(plain(legacy.game.snapshot()),raw,'old checkpoint is replay-validated with original level data');
 assert.deepEqual(plain(legacy.level.initial),plain(base.initial));assert.equal(legacy.level.seed,base.seed);
 assert.deepEqual(plain(catalog.restore(base.id,catalog.checkpoint(legacy.metadata,legacy.game)).snapshot),raw,'legacy states also have a portable envelope');
 const legacyUntouched=catalog.restore(base.id,new Engine(base).snapshot());assert(legacyUntouched.legacy,'an old untouched turn-zero board stays original');
 const entry=pack.levels.find(row=>row.levelId===base.id);
 let selectionSeed=0x35a11,previousVariantId=null,recentVariantIds=[];
 const firstCycle=[];
 for(let serial=1;serial<=entry.variants.length*3;serial++){
  const options={attemptSerial:serial,selectionSeed,previousVariantId,recentVariantIds:recentVariantIds.slice()};
  const a=catalog.start(base.id,options),b=catalog.start(base.id,plain(options));
  assert.deepEqual(plain(a.metadata),plain(b.metadata),'selector identity is reproducible');assert.equal(a.selectionSeed,b.selectionSeed);
  assert.notEqual(a.metadata.variantId,previousVariantId,'retry avoids immediately repeating the same variant');
  assert.equal(a.metadata.levelId,base.id);assert.equal(a.metadata.attemptSerial,serial);assert.equal(a.metadata.levelDataVersion,pack.levelDataVersion);
  assert.equal(typeof a.metadata.attemptId,'string');assert(a.metadata.attemptId.length>0);
  assert.equal(a.metadata.attemptVersion,1);assert(!a.level.findMatches,'configuration remains data, not an engine');
  if(serial<=entry.variants.length)firstCycle.push(a.metadata.variantId);
  previousVariantId=a.metadata.variantId;recentVariantIds.push(previousVariantId);recentVariantIds=recentVariantIds.slice(-(entry.variants.length-1));selectionSeed=a.selectionSeed;
 }
 assert.equal(new Set(firstCycle).size,entry.variants.length,'recent history cycles through available starts before repeating');
 assert.throws(()=>catalog.resolveLevel(base.id,'missing-variant',pack.levelDataVersion),'unknown variant cannot silently become original');
 assert.throws(()=>catalog.resolveLevel(base.id,entry.variants[0].id,'missing-version'),'unknown version cannot silently become current');
 for(const variant of entry.variants){
  const started=catalog.start(base.id,{attemptSerial:99,selectionSeed:37,previousVariantId:null,recentVariantIds:entry.variants.filter(v=>v.id!==variant.id).map(v=>v.id)});
  const level=catalog.resolveLevel(base.id,variant.id,pack.levelDataVersion);
  const metadata=plain(started.metadata);assert.equal(metadata.variantId,variant.id,'fixture selects the actual requested certified start');
  const game=new Engine(level);game.swap(...variant.solutions[0][0]);
  const before=plain(game.snapshot()),envelope=catalog.checkpoint(metadata,game);
  assert.deepEqual(plain(envelope.snapshot),before,'portable envelope holds unchanged v4 engine fields');
  const restored=catalog.restore(base.id,envelope),split=catalog.restore(base.id,before,metadata);
  assert.deepEqual(plain(restored.metadata),metadata);assert.deepEqual(plain(split.metadata),metadata);
  assert.deepEqual(plain(restored.game.snapshot()),before);assert.deepEqual(plain(split.game.snapshot()),before);
  const reward=context.window.HexRewardAdapter.restore(level,before,context.window.HEX_REWARD_RULES,Engine,context.window.HexRewards,metadata.attemptId);
  assert.equal(reward.state.attemptId,metadata.attemptId,'reward history belongs to this attempt rather than a level index');
  assert.equal(reward.state.lastTurn,game.turn);assert.equal(reward.state.lastScore,game.score);assert.equal(reward.state.lastGreen,game.covered,'reward restoration uses the actual variant initial state and refill history');
  const otherReward=context.window.HexRewardAdapter.restore(level,before,context.window.HEX_REWARD_RULES,Engine,context.window.HexRewards,'qa-other-attempt');
  assert.deepEqual({...plain(reward.state),attemptId:'shared'}, {...plain(otherReward.state),attemptId:'shared'},'changing an attempt identity never changes achieved progress');
  const changed=plain(envelope);changed.snapshot.score++;
  assert.throws(()=>catalog.restore(base.id,changed),'forged numeric state cannot bypass move replay');
  const wrongVariant=plain(envelope);wrongVariant.variantId='missing-variant';assert.throws(()=>catalog.restore(base.id,wrongVariant));
  const wrongLevel=plain(envelope);wrongLevel.levelId=base.id===1?2:1;assert.throws(()=>catalog.restore(base.id,wrongLevel),'mismatched level identity is rejected');
  const wrongVersion=plain(envelope);wrongVersion.levelDataVersion='future-unavailable';assert.throws(()=>catalog.restore(base.id,wrongVersion));
  const otherVariant=entry.variants.find(v=>v.id!==variant.id);
  assert.throws(()=>catalog.restore(base.id,new Engine(level).snapshot(),{...metadata,variantId:otherVariant.id}),'a valid but different variant identity cannot relabel a starting board');
  assert.deepEqual(plain(game.snapshot()),before,'validation and selection never mutate the caller engine');
  for(const route of variant.solutions){
   const guided=new Engine(level);
   for(const pair of route){
    const snapshot=plain(guided.snapshot()),hint=guided.hint({maxNodes:200,maxDepth:2});
    assert(hint&&hint.source==='proven_route'&&hint.guaranteed===true,'all certified routes have a truthful proven hint');
    assert(Array.isArray(hint.continuation)&&hint.continuation.length>0);
    const proof=guided.clone();for(const next of hint.continuation)assert(proof.swap(...next).ok);assert.equal(proof.status,'won','a proven hint carries an actual winning continuation');
    assert.deepEqual(plain(guided.snapshot()),snapshot,'hint does not spend score, layers, moves or RNG');
    guided.swap(...pair);routeHints++;
   }
   assert.equal(guided.hint({maxNodes:100}),null,'terminal boards do not offer a move');
  }
  // Leave the authored route through an actual legal move, where the board allows it.
  let offPath=null;
  for(const route of variant.solutions){
   const prefix=new Engine(level);
   for(let turn=0;turn<Math.min(route.length,3)&&!offPath;turn++){
    const authored=new Set(variant.solutions.filter(r=>prefix.history.every((pair,i)=>r[i]&&key(pair)===key(r[i]))).map(r=>r[prefix.turn]&&key(r[prefix.turn])).filter(Boolean));
    for(const pair of prefix.legalMoves())if(!authored.has(key(pair))){const child=prefix.clone();child.swap(...pair);if(child.status==='playing'){offPath=child;break;}}
    if(prefix.status==='playing')prefix.swap(...route[turn]);
   }
   if(offPath)break;
  }
  if(offPath){
   const snapshot=plain(offPath.snapshot()),hint=offPath.hint({maxNodes:180,maxDepth:3}),again=offPath.hint({maxNodes:180,maxDepth:3});
   assert(hint&&offPath.legalMoves().some(pair=>key(pair)===key(hint.pair)),'off-route hint is legal');
   assert.deepEqual(plain(hint),plain(again),'node-budget search is reproducible');
   assert(['proven_route','search_win','heuristic'].includes(hint.source));
   assert(Number.isInteger(hint.searchedNodes)&&hint.searchedNodes<=180,'search respects its deterministic work budget');
   if(hint.guaranteed){const proof=offPath.clone();assert(hint.continuation?.length);for(const pair of hint.continuation)assert(proof.swap(...pair).ok);assert.equal(proof.status,'won');}
   else {assert.equal(hint.source,'heuristic');assert.equal(hint.continuation,null,'a heuristic is not labeled as a guarantee');}
   const alternatives=offPath.legalMoves().map(pair=>{const child=offPath.clone();child.swap(...pair);return child;});
   const chosen=offPath.clone();chosen.swap(...hint.pair);
   if(alternatives.some(child=>child.status!=='lost'))assert.notEqual(chosen.status,'lost','heuristic avoids an immediate losing option when an alive option exists');
   assert.deepEqual(plain(offPath.snapshot()),snapshot,'off-route search is observational');offPathHints++;
  }
 }
 console.log('✓ Level '+base.id+': legacy continuation, selector cycles, identity/replay guards and variant hints');
}
assert(routeHints>=80);assert(offPathHints>=20,'off-route tests cover a range of real variant boards');
console.log('Attempt and hint checks passed: '+routeHints+' proven-route prefixes and '+offPathHints+' off-route searches.');
