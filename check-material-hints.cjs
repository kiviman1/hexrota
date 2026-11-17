/* V6 passive guidance uses visible, one-wave collection facts only. The
 * canonical hex legal/matching scan is shared with the existing engine. */
'use strict';
const assert=require('node:assert/strict');
require('./dist/engine.js');const Engine=globalThis.HexMatch,Idle=require('./dist/idle-hints.js');
const copy=value=>JSON.parse(JSON.stringify(value)),groups=[],base=require('./fixtures/idle-focus-v1.json').cases[0].level;
const source=(id,kind,materialId,quantity,cell,blockerId)=>({id,kind,materialId,quantity,cell,...(blockerId===undefined?{}:{blockerId})});
function projection(g){return {rulesVersion:'classic-v6',values:g.values.slice(),layers:g.layers.slice(),score:g.score,target:g.level.target,targetMode:g.level.targetMode,movesLeft:g.movesLeft,cells:g.level.cells.map(({q,r})=>({q,r})),obstacles:copy(g.level.obstacles),blockerHp:g.blockerHp.slice(),regionOpen:g.regionOpen.slice(),...(g.cellOpen?{cellOpen:g.cellOpen.slice()}:{} )};}
function fixture({hp=1,sources=[source('wood-box','crate-break','wood',1,9,'adjacent-crate'),source('water-token','matched-cell','water',1,6)],goals=[{materialId:'water',quantity:1}],score=false,ground=false,level=base}={}){
 const authored=copy(level);authored.obstacles.blockers.forEach(box=>{box.required=false;if(box.id==='adjacent-crate')box.hp=hp;});authored.obstacles.regions.forEach(region=>{region.required=false;});
 authored.rulesVersion='classic-v6';authored.materials={version:'materials-v1',definitions:[{id:'wood'},{id:'water'}],sources:copy(sources)};authored.objectives={version:'objectives-v1',score,ground,materials:copy(goals)};
 const g=new Engine(authored),input=projection(g);input.materials=copy(authored.materials);input.objectives=copy(authored.objectives);input.materialCounts=g.materialCounts.slice();input.collectedSources=g.collectedSources.slice();
 return {g,input,legal:g.legalMoves()};
}
function choose(f,input=f.input,legal=f.legal){return Idle.chooseVisibleHint(input,legal,values=>f.g.findMatches(values));}
function test(name,run){run();groups.push(name);console.log('PASS '+name);}
function pair(hint,expected){assert(hint);assert.deepEqual(hint.pair,expected.slice().sort((a,b)=>a-b));}
function unchanged(f,run){const board=JSON.stringify(f.g.snapshot()),bytes=JSON.stringify(f.input);const result=run();assert.equal(JSON.stringify(f.g.snapshot()),board,'canonical engine checkpoint unchanged');assert.equal(JSON.stringify(f.input),bytes,'visible counters, source flags and serialized record unchanged');return result;}

test('v6 material-only goal remains eligible after the score and every ground layer are complete',()=>{
 const f=fixture();f.input.score=f.input.target;f.input.layers.fill(0);const hint=unchanged(f,()=>choose(f));pair(hint,[4,7]);assert.equal(hint.movingSource,4);assert(hint.focusSources.every(i=>f.g.values[i]===f.g.values[hint.movingSource]));assert(hint.focusSources.every(i=>!hint.blockers.includes(i)));
});
test('only enabled objectives determine terminal and exact-score overshoot eligibility',()=>{
 const f=fixture();f.input.targetMode='exact';f.input.score=f.input.target+1;pair(choose(f),[4,7]);f.input.objectives.score=true;assert.equal(choose(f),null,'enabled exact-score overshoot stops hints');f.input.objectives.score=false;f.input.collectedSources[1]=true;f.input.materialCounts[1]=1;assert.equal(choose(f),null,'collected material-only goal is complete despite unneeded score/ground');f.input.objectives.ground=true;assert(choose(f),'remaining enabled ground still needs a move');f.input.layers.fill(0);assert.equal(choose(f),null);f.input.movesLeft=0;f.input.collectedSources[1]=false;f.input.materialCounts[1]=0;assert.equal(choose(f),null,'zero moves remains terminal');
});
test('empty obstacle/material collections support explicitly enabled score or ground objectives',()=>{
 const level=copy(require('./data/levels-original.json').levels[0]);Object.assign(level,{rulesVersion:'classic-v6',obstacles:{version:'obstacles-v1',blockers:[],regions:[]},materials:{version:'materials-v1',definitions:[],sources:[]},objectives:{version:'objectives-v1',score:true,ground:false,materials:[]}});const g=new Engine(level),input={...projection(g),materials:copy(level.materials),objectives:copy(level.objectives),materialCounts:[],collectedSources:[]},f={g,input,legal:g.legalMoves()};assert(choose(f));input.score=input.target;assert.equal(choose(f),null);input.objectives.score=false;input.objectives.ground=true;assert(choose(f));input.layers.fill(0);assert.equal(choose(f),null);input.objectives.ground=false;assert.equal(choose(f),null,'an objective-free board is malformed');
});
test('a direct first-wave token can outrank an unrelated crate hit using only visible goal progress',()=>{
 const f=fixture();pair(unchanged(f,()=>choose(f)),[4,7]);const old={...copy(f.input),rulesVersion:'classic-v5'};pair(Idle.chooseVisibleHint(old,f.legal,values=>f.g.findMatches(values)),[2,5],'the pre-v6 crate/ground preference remains intact');
});
test('HP1 crate drops rank immediately while HP2 damage does not predict a future drop',()=>{
 for(const hp of [1,2]){const f=fixture({hp,sources:[source('wood-box','crate-break','wood',1,9,'adjacent-crate'),source('wood-token','matched-cell','wood',1,6)],goals:[{materialId:'wood',quantity:1}]});pair(unchanged(f,()=>choose(f)),hp===1?[2,5]:[4,7]);}
});
test('first-wave grant expectations match actual canonical v6 swaps and never advance the live checkpoint',()=>{
 for(const hp of [1,2])for(const selected of [[2,5],[4,7]]){const f=fixture({hp}),before=JSON.stringify(f.g.snapshot()),hint=choose(f,f.input,[selected]);pair(hint,selected);const proof=f.g.clone(),result=proof.swap(...selected);assert(result.ok);assert.deepEqual(result.frames[0].materialEvents.map(event=>event.sourceId).sort(),selected[0]===2?(hp===1?['wood-box']:[]):['water-token']);assert.equal(JSON.stringify(f.g.snapshot()),before);assert.deepEqual(f.g.materialCounts,[0,0]);assert.deepEqual(f.g.collectedSources,[false,false]);}
});
test('material benefit caps at remaining goal demand and ignores irrelevant or already collected units',()=>{
 const f=fixture({sources:[source('wood-box','crate-break','wood',10,9,'adjacent-crate'),source('water-token','matched-cell','water',2,6)],goals:[{materialId:'wood',quantity:1},{materialId:'water',quantity:2}]});pair(choose(f),[4,7],'ten surplus wood units cannot outweigh two needed water units');
 const collected=fixture({sources:[source('wood-box','crate-break','wood',1,9,'adjacent-crate'),source('wood-token','matched-cell','wood',1,6)],goals:[{materialId:'wood',quantity:2}]});collected.input.collectedSources[1]=true;collected.input.materialCounts[0]=1;pair(choose(collected),[2,5]);
});
test('matched-cell sources belong to destination cells rather than the moved gem source',()=>{
 const f=fixture({hp:2,sources:[source('unmatched-moving-source','matched-cell','water',100,5),source('matched-bottom','matched-cell','water',1,6)]});pair(choose(f),[4,7]);const moved=fixture({hp:2,sources:[source('matched-destination','matched-cell','water',100,2),source('matched-bottom','matched-cell','water',1,6)]});pair(choose(moved),[2,5]);
});
test('distinct source IDs sharing a matched cell or crate aggregate without duplicate collection',()=>{
 const f=fixture({sources:[source('wood-box-a','crate-break','wood',1,9,'adjacent-crate'),source('wood-box-b','crate-break','wood',1,9,'adjacent-crate'),source('water-a','matched-cell','water',1,6),source('water-b','matched-cell','water',1,6)],goals:[{materialId:'wood',quantity:2},{materialId:'water',quantity:2}]});pair(unchanged(f,()=>choose(f)),[2,5]);assert.deepEqual(f.input.materialCounts,[0,0]);assert.deepEqual(f.input.collectedSources,[false,false,false,false]);
});
test('a closed token is valid authored data but cannot be selected matched or already collected',()=>{
 const level=require('./data/campaign-flow-levels-v2.json').levels[0],first=fixture({level,sources:[],goals:[],ground:true}),closed=first.g.values.findIndex((value,i)=>value===null&&!level.obstacles.blockers.some(box=>box.cell===i));assert(closed>=0);
 const f=fixture({level,sources:[source('covered-water','matched-cell','water',1,closed)]});assert(unchanged(f,()=>choose(f)),'closed later-reachable token does not disable all guidance');const active=f.g.values.findIndex(value=>value!==null);assert.equal(choose(f,f.input,[[active,closed]]),null);assert.equal(Idle.chooseVisibleHint(f.input,[f.legal[0]],()=>[active,closed,f.legal[0][1]]),null);f.input.collectedSources[0]=true;f.input.materialCounts[1]=1;assert.equal(choose(f),null,'a closed token cannot have been collected');
});
test('matched-cell supply on a real coordinate without any possible axial triple fails before scanning',()=>{
 const f=fixture();f.input.cells.push({q:20,r:20});f.input.values.push(1);f.input.layers.push(1);f.input.materials.sources[1].cell=f.input.cells.length-1;let scans=0;const before=JSON.stringify(f.g.snapshot());assert.equal(Idle.chooseVisibleHint(f.input,f.legal,values=>{scans++;return f.g.findMatches(values);}),null);assert.equal(scans,0,'geometrically impossible source cannot contribute authored supply');assert.equal(JSON.stringify(f.g.snapshot()),before);
});
test('invalid source kinds coordinates blocker bindings quantities and strict record fields fail closed',()=>{
 const invalid=[x=>x.materials.version='materials-v2',x=>x.materials.extra=1,x=>x.materials.definitions[0].extra=1,x=>x.materials.definitions[0].id='bad id',x=>x.materials.definitions[1].id='wood',x=>x.materials.sources[1].id=x.materials.sources[0].id,x=>x.materials.sources[0].kind='future-refill',x=>x.materials.sources[0].blockerId='unknown',x=>x.materials.sources[0].cell=8,x=>delete x.materials.sources[0].blockerId,x=>x.materials.sources[1].blockerId='adjacent-crate',x=>x.materials.sources[1].cell=9,x=>x.materials.sources[1].cell=-1,x=>x.materials.sources[1].cell=x.values.length,x=>x.materials.sources[1].cell=0.5,x=>x.materials.sources[1].materialId='unknown',x=>x.materials.sources[1].quantity=0,x=>x.materials.sources[1].quantity=-1,x=>x.materials.sources[1].quantity=0.5,x=>x.materials.sources[1].quantity=2147483648,x=>x.materials.sources.push(source('overflow','matched-cell','water',2147483647,6))];
 for(const mutate of invalid){const f=fixture();mutate(f.input);let scans=0;const before=JSON.stringify(f.g.snapshot());assert.equal(Idle.chooseVisibleHint(f.input,f.legal,values=>{scans++;return f.g.findMatches(values);}),null);assert.equal(scans,0);assert.equal(JSON.stringify(f.g.snapshot()),before);}
});
test('forged counters collection flags and objective records fail closed before matching',()=>{
 const invalid=[x=>x.score=2147483648,x=>x.target=2147483648,x=>x.movesLeft=2147483648,x=>x.layers[0]=2147483648,x=>x.materialCounts.pop(),x=>x.materialCounts[0]=-1,x=>x.materialCounts[0]=0.5,x=>x.materialCounts[0]=2147483648,x=>x.materialCounts[0]=1,x=>x.collectedSources.pop(),x=>x.collectedSources[0]=1,x=>{x.collectedSources[0]=true;x.materialCounts[0]=1;},x=>{x.blockerHp[0]=0;x.values[9]=1;},x=>x.objectives.version='objectives-v2',x=>x.objectives.score=1,x=>delete x.objectives.ground,x=>x.objectives.extra=true,x=>x.objectives.materials[0].quantity=0,x=>x.objectives.materials[0].quantity=2,x=>x.objectives.materials[0].materialId='unknown',x=>x.objectives.materials.push(copy(x.objectives.materials[0])),x=>x.objectives.materials[0].extra=true];
 for(const mutate of invalid){const f=fixture();mutate(f.input);let scans=0;assert.equal(Idle.chooseVisibleHint(f.input,f.legal,values=>{scans++;return f.g.findMatches(values);}),null);assert.equal(scans,0);}
 const broken=fixture({goals:[{materialId:'water',quantity:1}]});broken.input.blockerHp[0]=0;broken.input.values[9]=1;broken.input.collectedSources[0]=true;broken.input.materialCounts[0]=1;assert(choose(broken),'a correctly collected already-broken crate is accepted');
});
test('sparse arrays and arrays impersonating material records reject without scanning',()=>{
 const bad=[x=>delete x.materialCounts[0],x=>delete x.collectedSources[0],x=>delete x.materials.definitions[0],x=>delete x.materials.sources[0],x=>delete x.objectives.materials[0],x=>x.materials=Object.assign([],{...x.materials}),x=>x.objectives=Object.assign([],{...x.objectives}),x=>x.materials.definitions[0]=Object.assign([],{...x.materials.definitions[0]}),x=>x.materials.sources[0]=Object.assign([],{...x.materials.sources[0]}),x=>x.objectives.materials[0]=Object.assign([],{...x.objectives.materials[0]})];for(const mutate of bad){const f=fixture();mutate(f.input);let scans=0;assert.equal(Idle.chooseVisibleHint(f.input,f.legal,values=>{scans++;return f.g.findMatches(values);}),null);assert.equal(scans,0);}
});
test('the same frozen focus repeats deterministically without commands RNG or serialized state changes',()=>{
 const f=fixture(),expected=choose(f),before=JSON.stringify(f.g.snapshot()),bytes=JSON.stringify(f.input);for(const key of ['seed','rngState','history','initial','solutions','solution','snapshot','clone','swap','level'])Object.defineProperty(f.input,key,{get(){throw Error('forbidden '+key);}});const swap=f.g.swap,random=f.g._random,clone=f.g.clone;f.g.swap=()=>{throw Error('hint called swap');};f.g.clone=()=>{throw Error('hint called clone');};f.g._random=()=>{throw Error('hint called RNG');};
 for(const legal of [f.legal,f.legal.slice().reverse().map(p=>p.slice().reverse())])for(let i=0;i<3;i++){const hint=choose(f,f.input,legal);assert.deepEqual(hint,expected);assert(Object.isFrozen(hint));for(const key of ['pair','matched','matchingSources','focusMatched','focusSources','blockers'])assert(Object.isFrozen(hint[key]));}f.g.swap=swap;f.g._random=random;f.g.clone=clone;assert.equal(JSON.stringify(f.g.snapshot()),before);assert.equal(JSON.stringify(f.input),bytes);
});
test('v4 and v5 callers never read new material or objective fields',()=>{
 const f=fixture(),old=copy(f.input);old.rulesVersion='classic-v5';const expected=Idle.chooseVisibleHint(old,f.legal,values=>f.g.findMatches(values));for(const key of ['materials','objectives','materialCounts','collectedSources'])Object.defineProperty(old,key,{get(){throw Error('legacy read '+key);}});assert.deepEqual(Idle.chooseVisibleHint(old,f.legal,values=>f.g.findMatches(values)),expected);
 const level=require('./data/levels-original.json').levels[0],g=new Engine(level),input={values:g.values.slice(),layers:g.layers.slice(),score:g.score,target:level.target,movesLeft:g.movesLeft},legal=g.legalMoves(),hint=Idle.chooseVisibleHint(input,legal,v=>g.findMatches(v));for(const key of ['materials','objectives','materialCounts','collectedSources'])Object.defineProperty(input,key,{get(){throw Error('legacy read '+key);}});assert.deepEqual(Idle.chooseVisibleHint(input,legal,v=>g.findMatches(v)),hint);
});
console.log('Material idle hints: '+groups.length+' groups; visible immediate gains, enabled-objective eligibility, strict source/counter validation and unchanged focused presentation.');
