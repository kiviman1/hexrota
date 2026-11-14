/* Offline catalogue acceptance: every published opening is playable and certified. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/dist/';
const context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js','variants-data.js','attempts.js'])vm.runInContext(fs.readFileSync(root+file,'utf8'),context,{filename:file});
const {HexMatch:Engine,HEX_LEVELS:levels,HEX_VARIANTS:pack,HexAttempts}=context.window;
const plain=value=>JSON.parse(JSON.stringify(value));
const pairKey=pair=>pair.slice().sort((a,b)=>a-b).join(':');
assert(HexAttempts&&pack,'production catalogue modules are loaded');
assert.deepEqual(plain(pack),JSON.parse(fs.readFileSync(root+'variants.json','utf8')),'browser data is generated from the canonical JSON');
assert.equal(pack.schemaVersion,1);assert.equal(pack.levels.length,10);
const catalog=HexAttempts.createCatalog(levels,pack,Engine);
let variantCount=0,routeCount=0,replayCount=0;
for(const base of levels){
 const entry=pack.levels.find(row=>row.levelId===base.id);assert(entry,'every campaign level has an entry');
 assert(entry.variants.length>=4,'every campaign level publishes at least four verified starts');
 assert.equal(new Set(entry.variants.map(v=>v.id)).size,entry.variants.length,'variant IDs are unique within the level');
 assert.equal(new Set(entry.variants.map(v=>JSON.stringify(v.initial))).size,entry.variants.length,'starts differ in actual stone arrangement');
 for(const variant of entry.variants){
  variantCount++;
  const level=catalog.resolveLevel(base.id,variant.id,pack.levelDataVersion);
  for(const field of ['id','rulesVersion','cells','moves','target','palette'])assert.deepEqual(plain(level[field]),plain(base[field]),'variant preserves '+field);
  assert.equal(level.targetMode,base.targetMode,'variant preserves win comparison');
  assert.deepEqual(plain(level.initial),plain(variant.initial));assert.equal(level.seed,variant.seed);
  assert(Number.isInteger(variant.seed)&&variant.seed>0&&variant.seed<=0xffffffff,'nonzero uint32 production seed');
  assert.equal(level.initial.length,base.cells.length);assert(level.initial.every(value=>base.palette.includes(value)));
  const initial=new Engine(level);assert.equal(initial.findMatches().length,0,'no automatic opening matches');
  const legal=initial.legalMoves();assert(legal.length>=2,'more than one legal opening is available');
  assert(Array.isArray(variant.solutions)&&variant.solutions.length>=2,'more than one winning route is certified');
  assert(new Set(variant.solutions.map(route=>pairKey(route[0]))).size>=2,'certified routes begin with independent swaps');
  for(const route of variant.solutions){
   routeCount++;assert(route.length>0&&route.length<=base.moves,'proof fits the level move budget');
   assert(legal.some(pair=>pairKey(pair)===pairKey(route[0])),'certified first move is legal');
   const a=new Engine(level),b=new Engine(level);
   for(const [turn,pair] of route.entries()){
    assert.equal(a.status,'playing','proof does not continue after a terminal state');
    const before=a.snapshot(),ar=a.swap(...pair),br=b.swap(...pair);assert(ar.ok,'every certified move succeeds');
    assert.deepEqual(plain(ar),plain(br),'same initial state, RNG and moves reproduce all cascade/gravity frames');
    assert.equal(a.movesLeft,before.movesLeft-1,'whole cascade costs one move');
    assert.deepEqual(plain(a.snapshot()),plain(b.snapshot()),'deterministic result');
    const resumed=new Engine(level,a.snapshot());assert.deepEqual(plain(resumed.snapshot()),plain(a.snapshot()),'each checkpoint is replay-validated');replayCount++;
    assert.equal(a.status,turn===route.length-1?'won':'playing','proof finishes both goals on its final move');
   }
   assert(a.covered===a.total&&a.score>=level.target,'winning proof completes points and ground');
  }
 }
 console.log('✓ Level '+base.id+': '+entry.variants.length+' distinct starts, independent winning openings and exact replay');
}
assert(variantCount>=40);assert(routeCount>=variantCount*2);
console.log('Variant acceptance passed: '+variantCount+' starts, '+routeCount+' winning routes, '+replayCount+' restored checkpoints.');
