/* Offline-only one-factor experiments. Published files are never written. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {HexMatch,HEX_LEVELS,asLevel,solve,certify,pairKey}=require('./lib/level-analysis.cjs');
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'dist/variants.json'),'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));
const mix=value=>{let x=value>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0;};
const SEARCH=Object.freeze({seed:0x94c0ffee,maximumCandidates:64,width:40,maxNodes:16000,openingLimit:8});
function routesAtFirstWin(level,routes){
 const found=[];
 for(const route of routes){const game=new HexMatch(level),prefix=[];for(const pair of route){if(!game.swap(...pair).ok)break;prefix.push(pair.slice());if(game.status==='won'){found.push(prefix);break;}if(game.status!=='playing')break;}}
 return certify(level,found);
}
function prove(level,known=[]){
 let routes=routesAtFirstWin(level,known);
 if(routes.length<2){
  const first=solve(level,{width:SEARCH.width,maxNodes:SEARCH.maxNodes});if(first)routes=certify(level,routes.concat([first]));
  const done=new Set(routes.map(route=>pairKey(route[0])));
  const openings=new HexMatch(level).legalMoves().filter(pair=>!done.has(pairKey(pair)));
  openings.sort((a,b)=>{const x=new HexMatch(level),y=new HexMatch(level);x.swap(...a);y.swap(...b);return x.remainingLayers-y.remainingLayers;});
  for(const pair of openings.slice(0,SEARCH.openingLimit)){const route=solve(level,{prefix:[pair],width:SEARCH.width,maxNodes:SEARCH.maxNodes});if(route)routes=certify(level,routes.concat([route]));if(routes.length>=2)break;}
 }
 return routes.slice(0,2);
}
function patched(base,variant,patch){
 const level=clone(asLevel(base,variant));delete level.solution;delete level.alternativeSolutions;delete level.solutions;
 if(patch.movesDelta!==undefined)level.moves+=patch.movesDelta;
 if(patch.initial)level.initial=patch.initial.slice();if(patch.seed!==undefined)level.seed=patch.seed;
 if(patch.layers)for(const change of patch.layers)level.cells[change.index].layers=change.layers;
 return level;
}
function geometry(base){const game=new HexMatch(base);return base.cells.map((cell,index)=>({...cell,index,distance:Math.max(Math.abs(cell.q),Math.abs(cell.r),Math.abs(cell.q+cell.r)),degree:game.neighbors[index].length}));}
function experiment(levelId,id,label,factor,patch,variants,selection,description){
 const base=HEX_LEVELS.find(level=>level.id===levelId),entry=pack.levels.find(item=>item.levelId===levelId),certificates={};
 for(const variantId of variants){const variant=entry.variants.find(item=>item.id===variantId),level=patched(base,variant,patch),routes=routesAtFirstWin(level,variant.solutions);assert.equal(routes.length,2,id+'/'+variantId+' needs two preserved independent proofs');certificates[variantId]=routes;}
 return {id,levelId,label,description,factor,variantIds:variants,patch,certificates,selection};
}
function alternate(levelId,variantId,factor){
 const base=HEX_LEVELS.find(level=>level.id===levelId),variant=pack.levels.find(item=>item.levelId===levelId).variants.find(item=>item.id===variantId),attempts=[];
 for(let attempt=0;attempt<SEARCH.maximumCandidates;attempt++){
  const draw=mix((SEARCH.seed^Math.imul(levelId,1000003)^Math.imul(attempt+1,2654435761))>>>0);let patch;
  if(factor==='initial'){
   const initial=variant.initial.slice(),a=draw%initial.length;let b=mix(draw)%initial.length;
   if(a===b)b=(b+1)%initial.length;[initial[a],initial[b]]=[initial[b],initial[a]];
   if(initial.every((value,index)=>value===variant.initial[index])){attempts.push({attempt,decision:'unchanged_initial'});continue;}
   patch={initial};
  }else{const seed=mix((variant.seed^draw)>>>0)||1;if(seed===variant.seed){attempts.push({attempt,decision:'unchanged_seed'});continue;}patch={seed};}
  const level=patched(base,variant,patch),game=new HexMatch(level);
  if(game.findMatches().length||game.legalMoves().length<2){attempts.push({attempt,decision:'unstable_or_single_opening'});continue;}
  const routes=prove(level,variant.solutions);attempts.push({attempt,decision:routes.length>=2?'two_independent_certificates':'not_found_within_budget'});
  if(routes.length<2)continue;
  return {id:`l${levelId}-${factor}-${variantId}`,levelId,label:factor==='initial'?'Alternatif başlangıç':'Alternatif üretim tohumu',description:factor==='initial'?'Yalnız başlangıçtaki iki sayının yeri değişir; üretim tohumu aynıdır.':'Yalnız taş üretiminin tohumu değişir; başlangıç sayıları aynıdır.',factor,variantIds:[variantId],patch,certificates:{[variantId]:routes},selection:{rule:'First stable candidate with two independently starting winning certificates; no visible-player win rates are consulted.',...SEARCH,acceptedAttempt:attempt,attempts}};
 }
 throw Error(`No certified ${levelId}/${variantId}/${factor} candidate within predeclared search budget; not an impossibility claim.`);
}
function generate(){
 const variants=['v1','v2','v3','v4'],experiments=[];
 for(const [levelId,delta]of [[3,1],[5,1],[6,2],[7,1],[8,2],[9,2],[10,2]])experiments.push(experiment(levelId,`l${levelId}-moves-plus-${delta}`,`+${delta} hamle`,'moves',{movesDelta:delta},variants,{rule:'Predeclared move-budget increase only.'},'Başlangıç, üretim tohumu, hedef ve zemin aynı kalır.'));
 for(const [levelId,count]of [[6,1],[8,2]]){
  const base=HEX_LEVELS.find(level=>level.id===levelId),ranked=geometry(base).filter(cell=>cell.layers===2).sort((a,b)=>b.distance-a.distance||a.degree-b.degree||a.index-b.index),layers=ranked.slice(0,count).map(cell=>({index:cell.index,layers:1}));
  experiments.push(experiment(levelId,`l${levelId}-reduce-double-${count}`,`${count} çift katı azalt`,'layers',{layers},variants,{rule:'Choose double cells by descending axial distance, then ascending neighbor degree, then index. No outcome metrics consulted.',selectedIndices:layers.map(item=>item.index)},'Yalnız seçili çift zeminler tek kata iner; hamle, puan, başlangıç ve tohum değişmez.'));
 }
 {
  const levelId=10,base=HEX_LEVELS.find(level=>level.id===levelId),entry=pack.levels.find(item=>item.levelId===levelId),cells=geometry(base),donors=cells.filter(cell=>cell.layers===2).sort((a,b)=>b.distance-a.distance||a.degree-b.degree||a.index-b.index),receivers=cells.filter(cell=>cell.layers!==2).sort((a,b)=>a.distance-b.distance||b.degree-a.degree||a.index-b.index),tested=[];let selected=null;
  for(const donor of donors){for(const receiver of receivers){const patch={layers:[{index:donor.index,layers:1},{index:receiver.index,layers:2}]},valid=entry.variants.every(variant=>routesAtFirstWin(patched(base,variant,patch),variant.solutions).length===2);tested.push({from:donor.index,to:receiver.index,publishedRoutesPreserved:valid});if(valid){selected=patch;break;}}if(selected)break;}
  assert(selected,'No double-placement candidate preserves both known certificates in every variant; no production changes made.');
  experiments.push(experiment(levelId,'l10-relocate-double','Çift katın yerini değiştir','layers',selected,variants,{rule:'Outer double donor and inner single recipient in geometry order; first relocation preserving both published proofs in all four variants. Rejected pairs are only rejected for this proof-preservation criterion, not called impossible. No bot win rates consulted.',tested},'Bir çift kat dış hücreden iç hücreye taşınır; çift kat ve toplam kat sayısı aynı kalır.'));
 }
 experiments.push(alternate(5,'v1','initial'),alternate(5,'v1','seed'),alternate(9,'v4','initial'));
 return {schemaVersion:1,labVersion:'balance-lab-9-4-v1',status:'analysis_only',rulesVersion:'classic-v4',baseLevelDataVersion:pack.levelDataVersion,generation:{selection:'Predeclared one-factor experiments. First valid two-certificate candidate accepted; observable policy rates are not used to select data.',search:SEARCH,geometry:'Fixed axial distance, neighbor degree and index order.',certificates:'Every route is replayed and stops at the first actual win. Bounded search failure does not establish impossibility.'},experiments};
}
function wrapper(data){return '/* Generated isolated analysis data; never imported by the production game. */\n(function(root){\'use strict\';const data='+JSON.stringify(data)+';if(typeof module===\'object\'&&module.exports)module.exports=data;else root.HEX_BALANCE_LAB=data;})(typeof window!==\'undefined\'?window:globalThis);\n';}
function main(){
 const flags=process.argv.slice(2),allowed=['--generate','--sync','--check-generated'];
 assert(flags.length<=1&&flags.every(flag=>allowed.includes(flag)),'Choose one supported candidate command: --generate, --sync, or --check-generated.');
 const file=path.join(__dirname,'data/balance-lab-9-4.json'),browser=path.join(__dirname,'dist/balance-lab-data.js');
 if(flags.includes('--generate')){const data=generate();fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');fs.writeFileSync(browser,wrapper(data));console.log('Certified isolated candidates generated: '+data.experiments.length+' experiments.');}
 else{
  const data=JSON.parse(fs.readFileSync(file,'utf8')),expected=wrapper(data);
  if(flags.includes('--check-generated'))assert.equal(JSON.stringify(generate(),null,2)+'\n',fs.readFileSync(file,'utf8'),'Isolated candidates no longer reproduce from the predeclared generator.');
  if(flags.includes('--sync'))fs.writeFileSync(browser,expected);else assert.equal(fs.readFileSync(browser,'utf8'),expected,'Isolated browser data wrapper is stale');
  console.log(flags.includes('--check-generated')?'All 13 isolated experiments exactly reproduce from predeclared search and geometry rules.':'Balance Lab data wrapper agrees with canonical JSON.');
 }
}
if(require.main===module)main();
module.exports={generate,wrapper,SEARCH,routesAtFirstWin};
