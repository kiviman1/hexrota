/* Core configuration safety is deliberately broader than publishing policy.
 * No solver, normalization, catalog mutation or golden regeneration lives here. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value)),INT_MAX=2147483647,INT_MIN=-2147483648,UINT_MAX=4294967295;
const minimal=()=>({cells:[{q:0,r:0,layers:1}],initial:[1],palette:[1],seed:1,moves:1,target:1});
function validationCases(){
 const rows=[],valid=(id,change={},wire=true)=>rows.push({id,level:{...minimal(),...change},valid:true,wire}),invalid=(id,change={},wire=true)=>rows.push({id,level:{...minimal(),...change},valid:false,wire});
 valid('minimal-component-without-ID-or-rule-fields');
 valid('zero-seed-budget-and-target',{seed:0,moves:0,target:0});
 valid('uint32-upper-seed',{seed:UINT_MAX});
 valid('int32-upper-budget-and-target',{moves:INT_MAX,target:INT_MAX});
 valid('missing-ground-default',{cells:[{q:0,r:0}]});
 valid('null-ground-default',{cells:[{q:0,r:0,layers:null}]},false);
 valid('zero-ground-default',{cells:[{q:0,r:0,layers:0}]});
 valid('large-historical-ground-total',{cells:[{q:0,r:0,layers:INT_MAX}]});
 valid('duplicate-palette-retains-order-and-weight',{palette:[2,1,2,1]});
 valid('signed-int32-palette-boundaries',{cells:[{q:0,r:0},{q:1,r:0},{q:2,r:0}],palette:[INT_MIN,0,INT_MAX],initial:[INT_MIN,0,INT_MAX]});
 valid('int32-coordinate-boundaries-no-wrapped-neighbor',{cells:[{q:INT_MIN,r:0,layers:1},{q:INT_MAX,r:0,layers:1}],initial:[1,2],palette:[1,2]});
 valid('disconnected-component-and-no-legal-opening',{cells:[{q:0,r:0,layers:1},{q:20,r:20,layers:2},{q:-20,r:-20,layers:3}],initial:[1,2,1],palette:[1,2]});
 valid('matched-component-initial-is-not-a-published-start',{cells:[{q:0,r:0,layers:1},{q:1,r:0,layers:1},{q:2,r:0,layers:1}],initial:[1,1,1],palette:[1,2]});

 invalid('empty-cells',{cells:[],initial:[]});invalid('null-cells',{cells:null});invalid('missing-cells',{cells:undefined},false);invalid('not-an-array-cells',{cells:{0:{q:0,r:0},length:1}});
 invalid('null-cell',{cells:[null]});invalid('duplicate-coordinates',{cells:[{q:0,r:0},{q:0,r:0}],initial:[1,1]});invalid('negative-zero-coordinate-alias',{cells:[{q:-0,r:0},{q:0,r:-0}],initial:[1,1]});
 for(const name of ['q','r'])for(const [label,value,wire]of [['fraction',.5,true],['string','0',true],['null',null,true],['boolean',false,true],['missing',undefined,false],['nan',NaN,false],['infinity',Infinity,false],['negative-infinity',-Infinity,false],['below-int32',INT_MIN-1,true],['above-int32',INT_MAX+1,true],['unsafe-integer',Number.MAX_SAFE_INTEGER+1,true]])invalid('coordinate-'+name+'-'+label,{cells:[{q:0,r:0,[name]:value}]},wire);
 invalid('empty-palette',{palette:[]});invalid('null-palette',{palette:null});invalid('missing-palette',{palette:undefined},false);invalid('not-an-array-palette',{palette:'1'});
 for(const [label,value,wire]of [['fraction',1.5,true],['string','1',true],['null',null,true],['boolean',true,true],['undefined',undefined,false],['nan',NaN,false],['infinity',Infinity,false],['below-int32',INT_MIN-1,true],['above-int32',INT_MAX+1,true]])invalid('palette-'+label,{palette:[value]},wire);
 invalid('initial-too-short',{initial:[]});invalid('initial-too-long',{initial:[1,1]});invalid('null-initial',{initial:null});invalid('missing-initial',{initial:undefined},false);invalid('not-an-array-initial',{initial:{0:1,length:1}});invalid('initial-not-in-palette',{initial:[2]});invalid('null-initial-tile',{initial:[null]});invalid('undefined-initial-tile',{initial:[undefined]},false);invalid('string-initial-tile',{initial:['1']});
 for(const [label,value,wire]of [['negative',-1,true],['fraction',.5,true],['string','1',true],['boolean',false,true],['nan',NaN,false],['infinity',Infinity,false],['above-int32',INT_MAX+1,true]])invalid('ground-'+label,{cells:[{q:0,r:0,layers:value}]},wire);
 invalid('ground-total-overflows-int32',{cells:[{q:0,r:0,layers:INT_MAX},{q:1,r:0,layers:1}],initial:[1,1]});
 invalid('zero-ground-counts-as-one-in-total',{cells:[{q:0,r:0,layers:INT_MAX},{q:1,r:0,layers:0}],initial:[1,1]});
 invalid('missing-ground-counts-as-one-in-total',{cells:[{q:0,r:0,layers:INT_MAX},{q:1,r:0}],initial:[1,1]});
 invalid('null-ground-counts-as-one-in-total',{cells:[{q:0,r:0,layers:INT_MAX},{q:1,r:0,layers:null}],initial:[1,1]},false);
 for(const [label,value,wire]of [['negative',-1,true],['fraction',.5,true],['string','1',true],['null',null,true],['missing',undefined,false],['boolean',true,true],['nan',NaN,false],['infinity',Infinity,false],['above-uint32',UINT_MAX+1,true]])invalid('seed-'+label,{seed:value},wire);
 for(const field of ['moves','target'])for(const [label,value,wire]of [['negative',-1,true],['fraction',.5,true],['string','1',true],['null',null,true],['missing',undefined,false],['boolean',false,true],['nan',NaN,false],['infinity',Infinity,false],['above-int32',INT_MAX+1,true]])invalid(field+'-'+label,{[field]:value},wire);
 // Holes and inherited indexed properties cannot be represented by JSON/CLR
 // arrays. Keep these JavaScript density checks separate from transport parity.
 for(const field of ['cells','palette','initial']){
  const sparse=new Array(1);invalid('sparse-'+field,{[field]:sparse},false);
  const inherited=new Array(1),prototype=Object.create(Array.prototype);prototype[0]=field==='cells'?{q:0,r:0,layers:1}:1;Object.setPrototypeOf(inherited,prototype);invalid('inherited-index-'+field,{[field]:inherited},false);
 }
 return rows;
}
function load(){const context={window:{},performance};vm.createContext(context);for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js'])vm.runInContext(fs.readFileSync(__dirname+'/dist/'+file,'utf8'),context,{filename:file});return context.window;}
function frozen(value){if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
function run(){
 const W=load(),Engine=W.HexMatch;assert.equal(typeof Engine.validateLevel,'function','real portable core exposes the structural validator');
 const cases=validationCases(),counts={groups:0,validConfigurations:0,invalidConfigurations:0,wireCases:cases.filter(row=>row.wire).length,publishedAndArchivedConfigurations:0,historicalRestores:0},tests=[];
 const test=(name,body)=>tests.push({name,body});
 const invalid=level=>{assert.throws(()=>Engine.validateLevel(level),error=>error?.message==='Invalid match-three level','validator rejects with the core configuration error');assert.throws(()=>new Engine(level),error=>error?.message==='Invalid match-three level','constructor rejects before topology or reset');};
 test('valid structural configurations preserve all authored data without RNG draws or recovery',()=>{
  for(const row of cases.filter(row=>row.valid)){
   const before=structuredClone(row.level);assert.equal(Engine.validateLevel(row.level),true,row.id);assert.deepEqual(row.level,before,row.id+' validation never normalizes its input');
   const game=new Engine(row.level),snapshot=plain(game.snapshot());assert.deepEqual(row.level,before,row.id+' constructor never rewrites data');assert.deepEqual(snapshot.values,row.level.initial);assert.deepEqual(snapshot.layers,row.level.cells.map(cell=>cell.layers==null||cell.layers===0?1:cell.layers));assert.equal(snapshot.score,0);assert.equal(snapshot.movesLeft,row.level.moves);assert.equal(snapshot.turn,0);assert.deepEqual(snapshot.history,[]);assert.equal(snapshot.rngState,row.level.seed===0?0x9e3779b9:row.level.seed);assert.deepEqual(game.level.palette,row.level.palette);counts.validConfigurations++;
  }
 });
 test('malformed structural configurations reject without touching any supplied field',()=>{
  for(const row of cases.filter(row=>!row.valid)){
   // structuredClone removes a custom prototype; preserve it separately while
   // also checking own-key and density identity for non-JSON test inputs.
   const before=structuredClone(row.level),keys=Reflect.ownKeys(row.level),arrays=Object.fromEntries(['cells','palette','initial'].filter(field=>Array.isArray(row.level[field])).map(field=>[field,{reference:row.level[field],prototype:Object.getPrototypeOf(row.level[field]),keys:Reflect.ownKeys(row.level[field])}]));
   invalid(row.level);assert.deepEqual(Reflect.ownKeys(row.level),keys,row.id);assert.deepEqual(structuredClone(row.level),before,row.id+' rejection does not rewrite input');for(const [field,old]of Object.entries(arrays)){assert.equal(row.level[field],old.reference);assert.equal(Object.getPrototypeOf(row.level[field]),old.prototype);assert.deepEqual(Reflect.ownKeys(row.level[field]),old.keys);}counts.invalidConfigurations++;
  }
  for(const value of [null,undefined,false,1,'level',[]]){invalid(value);counts.invalidConfigurations++;}
 });
 test('the validator accepts frozen data and preserves duplicate-palette weighting and order',()=>{
  const level=frozen({...minimal(),palette:[2,1,2,1],initial:[2],cells:[{q:INT_MAX,r:INT_MIN,layers:0}]});assert.equal(Engine.validateLevel(level),true);const game=new Engine(level);assert.equal(game.level,level);assert.deepEqual(game.level.palette,[2,1,2,1]);assert.deepEqual(plain(game.snapshot()).layers,[1]);assert.equal(game.rngState,1);
 });
 test('component opening properties remain separate from publication acceptance',()=>{
  const singleton=new Engine(minimal());assert.equal(singleton.status,'playing');assert.equal(singleton.legalMoves().length,0);assert.equal(singleton.hint({maxNodes:1}),null);
  const matched=cases.find(row=>row.id==='matched-component-initial-is-not-a-published-start'),game=new Engine(matched.level);assert.deepEqual(plain(game.findMatches()),[0,1,2]);
  const disconnected=new Engine(cases.find(row=>row.id==='disconnected-component-and-no-legal-opening').level);assert.equal(disconnected.legalMoves().length,0);assert.equal(disconnected.status,'playing');
  const edges=new Engine(cases.find(row=>row.id==='int32-coordinate-boundaries-no-wrapped-neighbor').level);assert.equal(edges.adjacent(0,1),false,'signed endpoints are not adjacent by integer wrap');
 });
 test('all original tutorials current variants and archived-version configurations pass structural validation',()=>{
  const older=plain(W.HEX_VARIANTS);older.levelDataVersion='variants-archived-v1';for(const entry of older.levels)entry.variants.reverse();
  const catalog=W.HexAttempts.createCatalog(W.HEX_LEVELS,[older,W.HEX_VARIANTS],Engine);
  for(const level of [...W.HEX_LEVELS,...W.HEX_TUTORIALS]){assert.equal(Engine.validateLevel(level),true);new Engine(level);counts.publishedAndArchivedConfigurations++;}
  for(const version of [older.levelDataVersion,W.HEX_VARIANTS.levelDataVersion])for(const entry of W.HEX_VARIANTS.levels)for(const variant of entry.variants){const level=catalog.resolveLevel(entry.levelId,variant.id,version);assert.equal(Engine.validateLevel(level),true);const game=new Engine(level);assert.equal(game.findMatches().length,0);assert(game.legalMoves().length>=2,'existing published starts retain their separate acceptance properties');counts.publishedAndArchivedConfigurations++;}
  assert.equal(counts.publishedAndArchivedConfigurations,92);
 });
 test('legacy snapshot restore does not impose current publishing requirements',()=>{
  for(const row of cases.filter(row=>['minimal-component-without-ID-or-rule-fields','zero-seed-budget-and-target','duplicate-palette-retains-order-and-weight','disconnected-component-and-no-legal-opening'].includes(row.id))){
   const level={...row.level,id:'historical-'+row.id},game=new Engine(level),snapshot=plain(game.snapshot()),catalog=W.HexAttempts.createCatalog([level],null,Engine),before=structuredClone(level);
   const restored=catalog.restore(level.id,snapshot);assert.deepEqual(plain(restored.game.snapshot()),snapshot);assert.equal(restored.metadata.variantId,'legacy-original');assert.equal(restored.metadata.levelDataVersion,'original-v1');assert.deepEqual(level,before);counts.historicalRestores++;
  }
  assert.equal(counts.historicalRestores,4);
 });
 let failed=0;for(const {name,body}of tests)try{body();counts.groups++;console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}
 console.log('Board structural validation checks: '+JSON.stringify({...counts,failed})+'. Core acceptance is not a published-board or solvability guarantee.');if(failed)process.exitCode=1;return {...counts,failed};
}
if(require.main===module)run();
module.exports={validationCases,run};
