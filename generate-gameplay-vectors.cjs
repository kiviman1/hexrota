/* Cross-language golden inputs/outputs. Generation is an explicit development action. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=__dirname,plain=value=>JSON.parse(JSON.stringify(value));
const context={window:{},performance};vm.createContext(context);
for(const name of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js']){
 const file=path.join(root,'dist',name);assert(fs.existsSync(file),'Missing required game data/module: '+name);
 vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:name});
}
const {HexMatch,HEX_LEVELS,HEX_TUTORIALS,HEX_VARIANTS,HexAttempts}=context.window;
assert.equal(HEX_VARIANTS.schemaVersion,1);assert.equal(HEX_VARIANTS.levels.length,10);
const catalog=HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch),cases=[];
function configuration(level){
 const keys=['id','kind','rulesVersion','cells','initial','palette','seed','moves','target','targetMode','solution','alternativeSolutions','solutions','variantId','levelDataVersion'];
 return plain(Object.fromEntries(keys.filter(key=>level[key]!==undefined).map(key=>[key,level[key]])));
}
function observed(game){return {snapshot:plain(game.snapshot()),status:game.status,covered:game.covered,remainingLayers:game.remainingLayers};}
function routeCase(id,level,route,source,attempt=null){
 const config=configuration(level),game=new HexMatch(config),hintOptions={maxNodes:128,maxDepth:3,beamWidth:10};
 const entry={id,kind:'route',source,level:config,initial:observed(game),hint:{options:hintOptions,expected:plain(game.hint(hintOptions))},steps:[],resumeAfterTurn:1};
 if(attempt)entry.attempt=plain(attempt);
 const nonNeighbor=game.topology.pairs.length?[-1,0]:[0,config.cells.length];
 const noMatch=game.topology.pairs.find(pair=>new HexMatch(config).swap(...pair).reason==='no-match');
 entry.invalidSwaps=[{pair:nonNeighbor,reason:'neighbor'}];
 if(noMatch)entry.invalidSwaps.push({pair:plain(noMatch),reason:'no-match'});
 for(const pair of route){
  const result=game.swap(...pair);assert(result.ok,id+' route move is valid');
  const step={pair:plain(pair),result:plain(result),after:observed(game),hint:{options:hintOptions,expected:plain(game.hint(hintOptions))}};
  if(game.turn===entry.resumeAfterTurn&&attempt)step.attemptCheckpoint=plain(catalog.checkpoint(attempt.metadata,game));
  entry.steps.push(step);
 }
 if(source.scope==='complete')assert.equal(game.status,'won',id+' complete route wins');
 if(game.status!=='playing')entry.terminalSwap={pair:[0,1],result:plain(game.swap(0,1)),after:observed(game)};
 cases.push(entry);return entry;
}
for(const [index,level]of HEX_TUTORIALS.entries())routeCase('tutorial-'+(index+1),level,level.solution,{kind:'tutorial',levelId:level.id,variantId:'fixed',levelDataVersion:'tutorials-v1',scope:'complete'});
for(const level of HEX_LEVELS)routeCase('legacy-'+level.id,level,level.solution,{kind:'legacy',levelId:level.id,variantId:'legacy-original',levelDataVersion:'original-v1',scope:'complete'});
for(const group of HEX_VARIANTS.levels){
 assert(group.variants.length>=4,'Every campaign level supplies at least four variants');
 for(const variant of group.variants){
  const level=catalog.resolveLevel(group.levelId,variant.id,HEX_VARIANTS.levelDataVersion);
  let selected,selectorInput;
  for(let seed=1;seed<=4096;seed++){
   const input={attemptSerial:1,selectionSeed:seed};
   const candidate=catalog.start(group.levelId,input);
   if(candidate.metadata.variantId===variant.id){selected=candidate;selectorInput=input;break;}
  }
  assert(selected,'Deterministic selector can reach '+group.levelId+'/'+variant.id);
  routeCase('variant-'+group.levelId+'-'+variant.id,level,variant.solutions[0].slice(0,2),{
   kind:'variant',levelId:group.levelId,variantId:variant.id,levelDataVersion:HEX_VARIANTS.levelDataVersion,scope:'prefix',certifiedRouteLength:variant.solutions[0].length
  },{selectorInput,metadata:selected.metadata,selectionSeed:selected.selectionSeed});
 }
}

// Standalone component fixtures are deliberately separate from publishable level data.
const cells=[];
for(let q=-2;q<=2;q++)for(let r=-2;r<=2;r++)if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=2)cells.push({q,r,layers:2});
const at=(q,r)=>cells.findIndex(cell=>cell.q===q&&cell.r===r);
const base={id:'component-fixture',rulesVersion:'classic-v4',cells,initial:cells.map((_,i)=>100+i),palette:Array.from({length:200},(_,i)=>i+1),seed:9731,moves:10,target:999999,solution:[]};
for(const [index,[dq,dr]]of [[1,0],[0,1],[1,-1]].entries()){
 const values=base.initial.slice();for(let k=-1;k<=1;k++)values[at(k*dq,k*dr)]=7;
 cases.push({id:'axis-'+index,kind:'matches',level:configuration(base),values,expected:plain(new HexMatch(base).findMatches(values))});
}
const bent=base.initial.slice();for(const point of [[0,0],[1,0],[1,-1]])bent[at(...point)]=7;
cases.push({id:'bent-is-not-match',kind:'matches',level:configuration(base),values:bent,expected:plain(new HexMatch(base).findMatches(bent))});
for(const seed of [0,1,0x80000000,0xffffffff]){
 const game=new HexMatch({...base,seed}),initialState=game.rngState,expected=[];
 for(let i=0;i<12;i++)expected.push(game._random());
 cases.push({id:'rng-'+seed,kind:'rng',seed,initialState,expected});
}
const crossing=base.initial.slice();
for(const point of [[-1,0],[1,0],[0,-1],[0,1],[1,-1]])crossing[at(...point)]=7;
crossing[at(0,0)]=8;
const crossLevel={...base,initial:crossing,moves:1};
routeCase('cross-counts-once',crossLevel,[[at(0,0),at(1,-1)]],{kind:'standalone',scope:'component'});
const scoreOnly=new HexMatch({...base,target:0}),groundOnly=new HexMatch(base);groundOnly.layers.fill(0);
for(const [id,game]of [['score-alone-does-not-win',scoreOnly],['ground-alone-does-not-win',groundOnly]]){
 assert.equal(game.status,'playing');cases.push({id,kind:'status',level:configuration(game.level),state:observed(game),result:game.status,after:observed(game)});
}
const lastMoveLevel={...crossLevel,target:30,cells:cells.map((cell,index)=>({...cell,layers:[at(-1,0),at(1,0),at(0,-1),at(0,1),at(0,0)].includes(index)?1:2}))};
const lastMove=new HexMatch(lastMoveLevel);lastMove.layers.fill(0);
for(const point of [[-1,0],[1,0],[0,-1],[0,1],[0,0]])lastMove.layers[at(...point)]=1;
const lastMoveBefore=observed(lastMove),lastMoveResult=lastMove.swap(at(0,0),at(1,-1));assert.equal(lastMove.status,'won');
cases.push({id:'last-move-wins-before-loss',kind:'state-swap',level:configuration(lastMoveLevel),state:lastMoveBefore,pair:[at(0,0),at(1,-1)],result:plain(lastMoveResult),after:observed(lastMove)});

function stable(seed){
 const level={...base,id:'stable-'+seed,palette:[1,2,3,4],seed,initial:cells.map(()=>1),moves:16};
 const game=new HexMatch(level);game._stableBoard();return {...level,initial:plain(game.values),seed:game.rngState};
}
let cascadeLevel,cascadePair;
search:for(let seed=1;seed<=80;seed++){
 const level=stable(seed),game=new HexMatch(level);
 for(const pair of game.legalMoves())if(new HexMatch(level).swap(...pair).frames.length>=2){cascadeLevel=level;cascadePair=plain(pair);break search;}
}
assert(cascadeLevel,'A reproducible natural cascade is exercised');
routeCase('natural-survivor-cascade',cascadeLevel,[cascadePair],{kind:'standalone',scope:'component'});
const removed=[at(0,0),at(0,1),at(1,-1)];
for(const equalNumbers of [false,true]){
 const game=new HexMatch(cascadeLevel);if(equalNumbers)game.values.fill(2);
 const before=observed(game),result=game._gravity(removed);
 cases.push({id:equalNumbers?'gravity-equal-number-identities':'gravity-draw-order',kind:'gravity',level:configuration(cascadeLevel),state:before,removed,result:plain(result),after:observed(game)});
}
const forced=new HexMatch(stable(5));
for(const [q,r,value]of[[-2,0,1],[-1,0,1],[1,0,2],[2,0,2],[0,-2,3],[0,-1,3],[0,1,4],[0,2,4]])forced.values[at(q,r)]=value;
forced.values[at(0,0)]=null;
const forcedState=observed(forced),forcedResult=forced._fillVacancies();assert(forcedResult[0].forced);
cases.push({id:'forced-refill-minimum-conflict',kind:'refill',level:configuration(forced.level),state:forcedState,result:plain(forcedResult),after:observed(forced)});
const dead=new HexMatch({...stable(947),palette:[1,2,3,4,5,6]});
let randomState=71539,found=false;
function next(){randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return randomState>>>0;}
for(let i=0;i<30000;i++){
 dead.values=dead.values.map(()=>1+next()%6);
 if(!dead.findMatches().length&&!dead.legalMoves().length){found=true;break;}
}
assert(found,'A settled dead board is exercised');
dead.layers=dead.layers.map((_,i)=>i%3);dead.score=23;
const deadBefore=observed(dead),reshuffled=dead._ensurePlayable();assert(reshuffled);
cases.push({id:'dead-board-reshuffle-preserves-progress',kind:'reshuffle',level:configuration(dead.level),state:deadBefore,result:reshuffled,after:observed(dead),legalMoves:plain(dead.legalMoves())});
const noRouteLevel={...HEX_LEVELS[0],solution:[],alternativeSolutions:[],solutions:[]};
routeCase('hint-search-without-certified-route',noRouteLevel,HEX_LEVELS[0].solution,{kind:'standalone',scope:'complete'});
const firstRoutes=[HEX_LEVELS[0].solution,...HEX_LEVELS[0].alternativeSolutions],initialGame=new HexMatch(HEX_LEVELS[0]);
const deviating=initialGame.legalMoves().find(pair=>!firstRoutes.some(route=>route[0].slice().sort((a,b)=>a-b).join(',')===pair.slice().sort((a,b)=>a-b).join(',')));
assert(deviating,'The off-route hint vector starts outside certified openings');
routeCase('hint-after-route-deviation',HEX_LEVELS[0],[deviating],{kind:'standalone',scope:'prefix'});

const selectionCases=[];
for(const level of HEX_LEVELS){
 let selectionSeed=7331,previousVariantId='legacy-original',recentVariantIds=[];
 for(let serial=1;serial<=8;serial++){
  const input={attemptSerial:serial,selectionSeed,previousVariantId,recentVariantIds:recentVariantIds.slice()},chosen=catalog.start(level.id,input);
  selectionCases.push({levelId:level.id,input,expected:{metadata:plain(chosen.metadata),selectionSeed:chosen.selectionSeed}});
  selectionSeed=chosen.selectionSeed;previousVariantId=chosen.metadata.variantId;recentVariantIds=recentVariantIds.concat(previousVariantId).slice(-8);
 }
}
const variants=cases.filter(entry=>entry.source?.kind==='variant').length;
const firstVariant=cases.find(entry=>entry.source?.kind==='variant'),sampleCheckpoint=firstVariant.steps[0].attemptCheckpoint;
const rejectionCases=[];
function reject(id,levelId,change,metadata){
 const checkpoint=plain(sampleCheckpoint);if(change)change(checkpoint);
 let caught;try{catalog.restore(levelId,checkpoint,metadata);}catch(error){caught=error;}
 assert(caught,'Rejection vector must really be invalid: '+id);
 rejectionCases.push({id,levelId,checkpoint,...(metadata===undefined?{}:{metadata:plain(metadata)}),expectedErrorCode:caught.code||null});
}
reject('attempt-wrong-level',firstVariant.source.levelId===1?2:1);
reject('attempt-wrong-id-type',firstVariant.source.levelId,record=>{record.levelId=String(record.levelId);});
reject('attempt-unknown-variant',firstVariant.source.levelId,record=>{record.variantId='missing-variant';});
reject('attempt-unknown-version',firstVariant.source.levelId,record=>{record.levelDataVersion='missing-version';});
reject('attempt-malformed-id',firstVariant.source.levelId,record=>{record.attemptId='malformed';});
reject('attempt-unsupported-envelope',firstVariant.source.levelId,record=>{record.attemptVersion=2;});
reject('attempt-missing-snapshot',firstVariant.source.levelId,record=>{delete record.snapshot;});
reject('attempt-mixed-identity-sources',firstVariant.source.levelId,null,firstVariant.attempt.metadata);
reject('attempt-forged-score',firstVariant.source.levelId,record=>{record.snapshot.score++;});
const fixture={schemaVersion:1,rulesVersion:'classic-v4',variantDataVersion:HEX_VARIANTS.levelDataVersion,
 coverage:{tutorialRoutes:2,legacyRoutes:10,variantPrefixes:variants,selectionCases:selectionCases.length,rejectionCases:rejectionCases.length,componentCases:cases.filter(entry=>!entry.source||entry.source.kind==='standalone').length},
 componentStateNotice:'Component cases may inject synthetic working state. They are not valid player saves or publishable starts.',cases,selectionCases,rejectionCases};
// Keep cell arrays on one line: compact enough to review without hiding object contracts.
const formatted=JSON.stringify(fixture,null,2).replace(/\[\n\s+(?:-?\d+(?:\.\d+)?|null)(?:,\n\s+(?:-?\d+(?:\.\d+)?|null))*\n\s*\]/g,value=>JSON.stringify(JSON.parse(value)));
const target=path.join(root,'fixtures/gameplay-vectors.json'),output=formatted+'\n';
if(process.argv.includes('--check'))assert(fs.readFileSync(target,'utf8')===output,'Gameplay golden vectors are stale; regenerate and review intentionally');
else fs.writeFileSync(target,output);
console.log(cases.length+' gameplay, '+selectionCases.length+' selector and '+rejectionCases.length+' rejection vectors '+(process.argv.includes('--check')?'verified':'generated')+'.');
