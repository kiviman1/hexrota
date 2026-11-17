/* V5 idle cues use visible facts and canonical first-wave matching only. */
'use strict';
const assert=require('node:assert/strict');
require('./dist/engine.js');const Engine=globalThis.HexMatch,Idle=require('./dist/idle-hints.js');
const flow=require('./data/campaign-flow-levels-v2.json').levels,gated=require('./data/obstacle-levels-v1.json').levels;
const copy=value=>JSON.parse(JSON.stringify(value)),sort=value=>value.slice().sort((a,b)=>a-b),samePair=(a,b)=>sort(a).join(':')===sort(b).join(':'),groups=[];
const freeze=value=>{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;};
function visible(g){return {rulesVersion:g.level.rulesVersion,values:g.values.slice(),layers:g.layers.slice(),score:g.score,target:g.level.target,targetMode:g.level.targetMode,movesLeft:g.movesLeft,cells:copy(g.level.cells).map(({q,r})=>({q,r})),obstacles:copy(g.level.obstacles),blockerHp:g.blockerHp.slice(),regionOpen:g.regionOpen.slice(),...(g.cellOpen?{cellOpen:g.cellOpen.slice()}:{} )};}
function choose(g,input=visible(g),legal=g.legalMoves(),avoid=null){return Idle.chooseVisibleHint(input,legal,values=>g.findMatches(values),avoid);}
function test(name,fn){fn();groups.push(name);console.log('PASS '+name);}
function adjacent(a,b){const q=a.q-b.q,r=a.r-b.r;return Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))===1;}
function boxCells(g,matched){return g.level.obstacles.blockers.filter((box,i)=>g.blockerHp[i]>0&&(g.cellOpen||g.level.obstacles.regions.every((region,j)=>g.regionOpen[j]||!region.cells.includes(box.cell)))&&matched.some(index=>adjacent(g.level.cells[index],g.level.cells[box.cell]))).map(box=>box.cell).sort((a,b)=>a-b);}
function verify(g,hint,legal){
 assert(hint&&typeof hint==='object');for(const key of ['pair','matched','matchingSources','blockers'])assert(Array.isArray(hint[key]),key+' is a copied array');assert(Object.isFrozen(hint));for(const key of ['pair','matched','matchingSources','blockers'])assert(Object.isFrozen(hint[key]),key+' is frozen');
 assert.equal(hint.pair.length,2);assert(hint.pair.every(i=>Number.isInteger(i)&&g.isPlayable(i)&&g.values[i]!==null));assert(legal.some(pair=>samePair(pair,hint.pair)));assert(g.adjacent(...hint.pair));
 const [a,b]=hint.pair,swapped=g.values.slice();[swapped[a],swapped[b]]=[swapped[b],swapped[a]];const matched=g.findMatches(swapped);
 assert.deepEqual(hint.matched,matched);assert(hint.matched.length>0);assert(hint.matched.every(i=>g.isPlayable(i)&&swapped[i]!==null));
 const sources=matched.map(i=>i===a?b:i===b?a:i);assert.deepEqual(sort(hint.matchingSources),sort(sources));assert.equal(new Set(hint.matchingSources).size,hint.matchingSources.length);assert(hint.matchingSources.every(i=>g.isPlayable(i)&&g.values[i]!==null));
 assert.deepEqual(sort(hint.blockers),boxCells(g,matched));assert.equal(new Set(hint.blockers).size,hint.blockers.length);
 const proof=g.clone(),result=proof.swap(...hint.pair);assert(result.ok);assert.deepEqual(sort(hint.blockers),sort(result.frames[0].blockerHits.map(hit=>hit.cell)),'descriptor predicts actual first-wave hits, not later cascade damage');
 return sources.some((source,i)=>source!==matched[i]);
}
let flowPrefixes=0,gatedPrefixes=0,mappedSwapCases=0,damageCases=0;

test('descriptor API exists and all ten real flow routes select legal immutable pure deterministic cues',()=>{
 assert.equal(typeof Idle.chooseVisibleHint,'function');assert.equal(flow.length,5);assert.equal(flow.reduce((n,l)=>n+l.solutions.length,0),10);
 for(const level of flow)for(const route of level.solutions){const g=new Engine(level);for(const pair of route){
  const input=freeze(visible(g)),legal=freeze(copy(g.legalMoves())),before=copy(g.snapshot()),inputBefore=copy(input),hint=choose(g,input,legal);
  if(verify(g,hint,legal))mappedSwapCases++;if(hint.blockers.length)damageCases++;
  assert.deepEqual(copy(g.snapshot()),before);assert.deepEqual(copy(input),inputBefore);assert.deepEqual(choose(g,input,legal.slice().reverse().map(p=>p.slice().reverse())),hint,'pair order and enumeration cannot alter the cue');
  assert.deepEqual(choose(g,input,legal),hint);assert.deepEqual(Idle.chooseVisiblePair(input,legal,values=>g.findMatches(values)),hint.pair,'legacy pair wrapper preserves the selected pair');flowPrefixes++;assert(g.swap(...pair).ok);
 }assert.equal(g.status,'won');assert.equal(choose(g),null,'completed real boards do not produce idle cues');}
 assert(flowPrefixes>0);assert(mappedSwapCases>0,'source mapping exercises a swapped destination');assert(damageCases>0,'real selected hints include crate hits');
});
test('all six gated development routes also produce accurate source mappings and actual box hits',()=>{
 for(const level of gated)for(const route of level.solutions){const g=new Engine(level);for(const pair of route){const before=copy(g.snapshot()),legal=g.legalMoves(),hint=choose(g);verify(g,hint,legal);assert.deepEqual(copy(g.snapshot()),before);gatedPrefixes++;assert(g.swap(...pair).ok);}assert.equal(g.status,'won');assert.equal(choose(g),null);}
});
test('single authored opening reports its visible matching source gems and only neighbouring damaged crates',()=>{
 for(const level of flow.concat(gated)){const g=new Engine(level),pair=level.solutions[0][0],hint=choose(g,visible(g),[pair]);verify(g,hint,[pair]);assert(samePair(hint.pair,pair));const afterSwap=g.values.slice();[afterSwap[pair[0]],afterSwap[pair[1]]]=[afterSwap[pair[1]],afterSwap[pair[0]]];assert.deepEqual(hint.matched,g.findMatches(afterSwap));}
});
test('a cue uses no RNG history route solution or mutation methods even when getters throw',()=>{
 const g=new Engine(flow[0]),input=visible(g),legal=g.legalMoves(),expected=choose(g,input,legal),snapshot=copy(g.snapshot());
 for(const key of ['rngState','seed','initial','solution','solutions','alternativeSolutions','history','clone','snapshot','swap','_random','palette','level'])Object.defineProperty(input,key,{get(){throw Error('forbidden visible projection access: '+key);}});
 const originalSwap=g.swap,originalClone=g.clone,originalRandom=g._random;g.swap=()=>{throw Error('selector called engine.swap');};g.clone=()=>{throw Error('selector called engine.clone');};g._random=()=>{throw Error('selector consumed RNG');};
 assert.deepEqual(choose(g,input,legal),expected);for(const state of [1,0xdeadbeef,0xffffffff]){g.rngState=state;assert.deepEqual(choose(g,input,legal),expected,'visible cue ignores future RNG');}
 g.swap=originalSwap;g.clone=originalClone;g._random=originalRandom;g.rngState=snapshot.rngState;assert.deepEqual(copy(g.snapshot()),snapshot);
});
test('inactive null cells non-neighbours and malformed supplied pairs never become selectable',()=>{
 const g=new Engine(flow[0]),input=visible(g),closed=g.values.findIndex(v=>v===null),active=g.values.findIndex(v=>v!==null),far=g.values.findIndex((v,i)=>v!==null&&!g.adjacent(active,i)&&active!==i);
 for(const candidate of [[active,closed],[closed,active],[active,far],[-1,active],[active,g.total],[active,active],[active,0.5],[active,NaN],[active]])assert.equal(choose(g,input,[candidate]),null,'invalid supplied pair '+JSON.stringify(candidate));
 const legal=g.legalMoves(),hint=choose(g,input,[[active,closed],...legal,[active,far]]);verify(g,hint,legal);
});
test('invalid matching callback output fails closed instead of highlighting inactive or duplicate gems',()=>{
 const g=new Engine(flow[0]),input=visible(g),pair=g.legalMoves()[0],closed=g.values.findIndex(v=>v===null);
 for(const matched of [null,[],[-1],[g.total],[closed],[pair[0],pair[0]],[1.5],[NaN]])assert.equal(Idle.chooseVisibleHint(input,[pair],()=>matched),null);
 assert.equal(Idle.chooseVisibleHint(input,[pair],()=>{throw Error('scan failed');}),null);
});
test('forged masks impossible HP coordinates and region definitions reject without gameplay changes',()=>{
 const g=new Engine(flow[0]),legal=g.legalMoves(),before=copy(g.snapshot());
 const invalid=[x=>x.cellOpen.pop(),x=>delete x.cellOpen,x=>x.cellOpen[0]=!x.cellOpen[0],x=>x.cellOpen[0]=1,x=>x.blockerHp.pop(),x=>x.blockerHp[0]=-1,x=>x.blockerHp[0]=3,x=>x.blockerHp[0]=0.5,x=>x.regionOpen.pop(),x=>x.regionOpen[0]=true,x=>x.regionOpen[0]=1,x=>x.values[x.values.findIndex(v=>v!==null)]=null,x=>x.values[x.values.findIndex(v=>v===null)]=1,x=>x.cells.pop(),x=>x.cells[0].q=NaN,x=>x.cells[0].r=0.5,x=>x.cells[1]={...x.cells[0]},x=>x.obstacles.blockers[1].cell=x.obstacles.blockers[0].cell,x=>x.obstacles.regions[0].requires=['remote-key'],x=>x.obstacles.regions[0].cells.push(g.total),x=>x.obstacles.activation='column-flow-v2',x=>x.obstacles.sources[0]=-1,x=>x.rulesVersion='classic-v6'];
 for(const mutate of invalid){const input=visible(g);mutate(input);assert.equal(choose(g,input,legal),null);assert.deepEqual(copy(g.snapshot()),before);}
});
test('gated masks inconsistent with broken dependencies and overlapping regions fail closed',()=>{
 const g=new Engine(gated[0]),legal=g.legalMoves();for(const mutate of [x=>x.regionOpen[0]=true,x=>x.blockerHp[0]=0,x=>x.obstacles.regions.push({...x.obstacles.regions[0],id:'overlap'}),x=>x.obstacles.regions[0].requires=['unknown'],x=>x.obstacles.blockers[0].cell=-1]){const input=visible(g);mutate(input);assert.equal(choose(g,input,legal),null);}
});
test('v5 remaining required crates keep cues eligible even when all ground and score objectives are met',()=>{
 const g=new Engine(flow[0]),input=visible(g);input.layers.fill(0);input.score=input.target;const hint=choose(g,input);assert(hint,'unbroken required crates mean this visible board is still playing');verify(g,hint,g.legalMoves());
});
test('v4 null stones stay invalid and previous-pair avoidance remains transient and deterministic',()=>{
 const v4={rulesVersion:'classic-v4',values:[1,2,null,4],layers:[1,1,1,0],score:0,target:10,movesLeft:3};assert.equal(Idle.chooseVisibleHint(v4,[[0,1]],()=>[0,1,2]),null);assert.equal(Idle.chooseVisiblePair(v4,[[0,1]],()=>[0,1,2]),null);
 const g=new Engine(flow[0]),input=visible(g),legal=g.legalMoves(),first=choose(g,input,legal);assert(first);const alternative=choose(g,input,legal,first.pair);assert(alternative);verify(g,alternative,legal);if(legal.length>1)assert(!samePair(first.pair,alternative.pair));assert.deepEqual(choose(g,input,[first.pair],first.pair),first,'one legal option can repeat');
 assert.equal(choose(g,{...input,movesLeft:0},legal),null);
});
test('sparse v4 and v5 visible values or ground layers fail closed without matching or RNG',()=>{
 const original=require('./data/levels-original.json').levels[0],classic=new Engine(original),cases=[{g:classic,input:{rulesVersion:'classic-v4',values:classic.values.slice(),layers:classic.layers.slice(),score:classic.score,target:original.target,movesLeft:classic.movesLeft}},{g:new Engine(flow[0])},{g:new Engine(gated[0])}];
 for(const entry of cases){const g=entry.g,input=entry.input||visible(g),legal=g.legalMoves(),before=copy(g.snapshot());for(const field of ['values','layers'])for(const make of [values=>new Array(values.length),values=>{const result=values.slice();delete result[0];return result;}]){const sparse={...input,[field]:make(input[field])};let scans=0;const result=Idle.chooseVisibleHint(sparse,legal,values=>{scans++;return g.findMatches(values);});assert.equal(result,null);assert.equal(scans,0,'invalid visible arrays never reach the matching dependency');assert.deepEqual(copy(g.snapshot()),before);}}
});
test('sparse supplied pairs and matching results return null without changing canonical state',()=>{
 const original=require('./data/levels-original.json').levels[0],classic=new Engine(original),cases=[{g:classic,input:{rulesVersion:'classic-v4',values:classic.values.slice(),layers:classic.layers.slice(),score:classic.score,target:original.target,movesLeft:classic.movesLeft}},{g:new Engine(flow[0])},{g:new Engine(gated[0])}];
 for(const entry of cases){const g=entry.g,input=entry.input||visible(g),legal=g.legalMoves(),selected=legal[0],before=copy(g.snapshot());assert(selected);
  const missingOne=selected.slice();delete missingOne[1];for(const candidates of [new Array(1),[[,,]],[new Array(2)],[missingOne]]){let scans=0;assert.equal(Idle.chooseVisibleHint(input,candidates,values=>{scans++;return g.findMatches(values);}),null);assert.equal(scans,0,'sparse pairs are rejected before matching');assert.deepEqual(copy(g.snapshot()),before);}
  const swapped=g.values.slice();[swapped[selected[0]],swapped[selected[1]]]=[swapped[selected[1]],swapped[selected[0]]];const actual=g.findMatches(swapped),missingMatch=actual.slice();delete missingMatch[0];
  for(const matched of [new Array(1),[,,],new Array(3),missingMatch]){assert.equal(Idle.chooseVisibleHint(input,[selected],()=>matched),null);assert.deepEqual(copy(g.snapshot()),before);}
 }
});
test('arrays cannot impersonate v5 coordinate obstacle blocker or region records',()=>{
 for(const level of [flow[0],gated[0]]){const g=new Engine(level),legal=g.legalMoves(),before=copy(g.snapshot());for(const mutate of [x=>x.cells[0]=Object.assign([],{...x.cells[0]}),x=>x.obstacles=Object.assign([],{...x.obstacles}),x=>x.obstacles.blockers[0]=Object.assign([],{...x.obstacles.blockers[0]}),x=>x.obstacles.regions[0]=Object.assign([],{...x.obstacles.regions[0]})]){const input=visible(g);mutate(input);let scans=0;assert.equal(Idle.chooseVisibleHint(input,legal,values=>{scans++;return g.findMatches(values);}),null);assert.equal(scans,0,'invalid records fail before matching');assert.deepEqual(copy(g.snapshot()),before);}}
});
console.log('Obstacle idle hints: '+groups.length+' groups; '+flowPrefixes+' flow-route prefixes and '+gatedPrefixes+' gated-route prefixes; '+mappedSwapCases+' swapped-source mappings, '+damageCases+' real first-wave crate-hit cues.');
