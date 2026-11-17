/* Read-only material paint and committed-wave visual ordering contracts. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const Material=require('./dist/material-view.js'),Board=require('./dist/board-view.js'),Pipeline=require('./dist/move-presentation.js'),HintView=require('./dist/idle-hint-view.js');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('./dist/engine.js','utf8'),sandbox);const Engine=sandbox.window.HexMatch;
const levels=require('./data/material-alpha-levels-v1.json').levels,clone=value=>JSON.parse(JSON.stringify(value));
const tests=[],test=(name,run)=>tests.push({name,run});
const motion={swap:0,budget:3300,digit:0,spread:0,collectPulse:0,pop:0,hold:0,flight:0,count:0,arrival:0,burst:0,ring:0,particle:0,matchPause:0,fall:0,fallStagger:0,columnDelay:0};
function mount(level,state){const dom=new JSDOM('<svg xmlns="http://www.w3.org/2000/svg" id="board"></svg>'),board=dom.window.document.getElementById('board'),layout=Board.geometry(level);Board.reconcile(board,Board.markup(level,state,layout));return{dom,board,layout,close:()=>dom.window.close()};}
function fixture(id=8){const level=levels.find(item=>item.id===id),game=new Engine(level),before=clone(game.snapshot()),pair=level.solutions[0][0],result=clone(game.swap(...pair));assert(result.ok);const final=clone(game.snapshot()),plan=Pipeline.plan({before,final,frames:result.frames,swap:pair,motion});return{level,game,before,final,result,plan};}
async function play(plan,{cancelAt=null,throwAt=null,reduced=false}={}){const phases=[],calls=[],controller=new AbortController(),adapters={};for(const name of ['swap','match','collectTokens','blockerHit','blockerBreak','collectCrates','regionUnlock','clear','fall','refill','settle','pause'])adapters[name]=()=>{calls.push(name);if(name===throwAt)throw Error('injected material visual failure');return 0;};const outcome=await Pipeline.play({plan,attemptId:'material-view-check',token:1,signal:controller.signal,isCurrent:()=>true,canAnimate:()=>!reduced,adapters,onPhase:event=>{phases.push(event.phase);if(event.phase===cancelAt)controller.abort();}});return{outcome,phases,calls};}

test('wood badge stays inside its crate and cell nails never enter the moving gem or obscure its numeral',()=>{
 for(const level of levels){const state=new Engine(level).snapshot(),f=mount(level,state);try{for(const marker of f.board.querySelectorAll('.material-marker')){assert.equal(marker.parentElement.hasAttribute('data-index'),true);assert.equal(marker.closest('.gem'),null);assert.equal(marker.getAttribute('pointer-events'),'none');assert.equal(marker.hasAttribute('data-index'),false);const cell=Number(marker.parentElement.dataset.index);if(marker.classList.contains('material-cell-token')){assert.equal(marker.getAttribute('transform'),'translate(18,22)');assert.equal(marker.parentElement.querySelector('.hex-number').textContent,String(state.values[cell]));}else{assert.equal(marker.getAttribute('transform'),'translate(0,22)');assert(marker.parentElement.querySelector('.blocker-visual'));}}assert.equal(f.board.querySelectorAll(':scope > [data-index]').length,level.cells.length);}finally{f.close();}}
});

test('closed, temporarily empty and already collected cell tokens are invisible',()=>{
 const level=levels.find(item=>item.id===7),game=new Engine(level),index=level.materials.sources.findIndex(source=>source.kind==='matched-cell'),source=level.materials.sources[index],base=game.snapshot();
 const open={...base,values:base.values.slice(),cellOpen:base.cellOpen.slice(),collectedSources:base.collectedSources.slice()};open.values[source.cell]=level.palette[0];open.cellOpen[source.cell]=true;assert(Material.markers(level,open,source.cell).includes('material-cell-token'));
 const closed={...open,cellOpen:open.cellOpen.slice()};closed.cellOpen[source.cell]=false;assert.equal(Material.markers(level,closed,source.cell),'');const empty={...open,values:open.values.slice()};empty.values[source.cell]=null;assert.equal(Material.markers(level,empty,source.cell),'');const collected={...open,collectedSources:open.collectedSources.slice()};collected.collectedSources[index]=true;assert.equal(Material.markers(level,collected,source.cell),'');assert.equal(game.snapshot().collectedSources[index],false);
});

test('distinct materials co-located in one crate aggregate into one buttonless badge without losing source IDs',()=>{
 const level=clone(levels[0]),source=level.materials.sources[0];level.materials.definitions.push({id:'nail'});level.materials.sources.push({...source,id:'extra-nail-source',materialId:'nail',quantity:2});const game=new Engine(level),f=mount(level,game.snapshot());try{const markers=f.board.querySelectorAll(`[data-index="${source.cell}"] > .material-marker`);assert.equal(markers.length,1);assert.equal(markers[0].querySelectorAll('.material-icon-wood').length,1);assert.equal(markers[0].querySelectorAll('.material-icon-nail').length,1);assert.deepEqual(JSON.parse(markers[0].dataset.materialSources),[source.id,'extra-nail-source']);assert.equal(markers[0].querySelector('[role="button"],[tabindex]'),null);}finally{f.close();}
});

test('HUD displays exact committed counts and optional goals without changing any gameplay state',()=>{
 const f=fixture(),snapshot=clone(f.game.snapshot()),html=Material.hud(f.level,f.game),dom=new JSDOM(html);try{f.level.materials.definitions.forEach((definition,index)=>{const node=dom.window.document.getElementById('material-count-'+definition.id);assert.equal(Number(node.dataset.materialCount),snapshot.materialCounts[index]);});assert.deepEqual(clone(f.game.snapshot()),snapshot);assert(!Material.hud(f.level,f.game,{prefix:'pregame-materials-count-'}).includes('id="material-count-'));}finally{dom.window.close();}
});

test('score and ground only v6 definitions create no material badges or material HUD',()=>{
 const level=clone(levels[0]);level.materials.definitions=[];level.materials.sources=[];level.objectives={version:'objectives-v1',score:true,ground:true,materials:[]};const game=new Engine(level),state=game.snapshot();assert.equal(Material.hud(level,state),'');for(let cell=0;cell<level.cells.length;cell++)assert.equal(Material.markers(level,state,cell),'');
});

test('actual v6 wave material projections and events are independent deeply frozen data',()=>{
 const f=fixture();assert(Object.isFrozen(f.plan.waves[0].frame.materialEvents));assert(Object.isFrozen(f.plan.waves[0].after.materialCounts));assert.deepEqual(f.plan.final.materialCounts,f.final.materialCounts);assert.deepEqual(f.plan.final.collectedSources,f.final.collectedSources);const before=JSON.stringify(f.plan);f.result.frames[0].materialEvents.length=0;f.before.materialCounts.fill(999);assert.equal(JSON.stringify(f.plan),before);
});

test('mixed v6 watchdog reserves collection and obstacle waits in addition to normal render slack',()=>{const f=fixture();assert(f.plan.budget>=4680,'3300ms baseline plus token360, hit170, break270, crate360 and unlock220');});

test('real mixed collection order is match then cell collection, damage, break, crate collection and unlock',async()=>{
 const f=fixture(),snapshot=JSON.stringify(f.game.snapshot()),p=await play(f.plan);assert.equal(p.outcome.status,'succeeded');for(const [before,after]of [['MATCH','TOKEN_COLLECT'],['TOKEN_COLLECT','BLOCKER_HIT'],['BLOCKER_BREAK','CRATE_COLLECT'],['CRATE_COLLECT','REGION_UNLOCK']])assert(p.phases.indexOf(before)>=0&&p.phases.indexOf(before)<p.phases.indexOf(after),before+' precedes '+after);assert.equal(JSON.stringify(f.game.snapshot()),snapshot);
});

for(const phase of ['TOKEN_COLLECT','CRATE_COLLECT'])test('cancelling '+phase+' stops future adapters without changing the already committed result',async()=>{const f=fixture(),snapshot=JSON.stringify(f.game.snapshot()),p=await play(f.plan,{cancelAt:phase});assert.equal(p.outcome.status,'cancelled');assert.equal(p.phases.at(-1),phase);assert.equal(JSON.stringify(f.game.snapshot()),snapshot);});
for(const adapter of ['collectTokens','collectCrates'])test(adapter+' visual failure cannot change the committed snapshot',async()=>{const f=fixture(),snapshot=JSON.stringify(f.game.snapshot()),p=await play(f.plan,{throwAt:adapter});assert.equal(p.outcome.status,'failed');assert.equal(JSON.stringify(f.game.snapshot()),snapshot);});

test('reduced motion settles the committed result without material effect adapters',async()=>{const f=fixture(),p=await play(f.plan,{reduced:true});assert.equal(p.outcome.status,'succeeded');assert.deepEqual(p.phases,['SETTLE']);assert.deepEqual(p.calls,['settle']);});

for(const reduced of [false,true])test('v6 '+(reduced?'static':'moving')+' hint keeps material paint fixed and preserves original markers byte-exact',()=>{
 const authored=require('./fixtures/idle-focus-v1.json').cases[0],level=clone(authored.level);level.rulesVersion='classic-v6';level.materials={version:'materials-v1',definitions:[{id:'nail'}],sources:[{id:'hint-nail',kind:'matched-cell',materialId:'nail',quantity:1,cell:0}]};level.objectives={version:'objectives-v1',score:false,ground:false,materials:[{materialId:'nail',quantity:1}]};
 const game=new Engine(level),f=mount(level,game.snapshot()),win=f.dom.window,animated=[];win.Element.prototype.animate=function(){animated.push(this);return{finished:Promise.resolve(),cancel(){}};};const before=f.board.outerHTML,marker=f.board.querySelector('[data-index="0"] > .material-marker'),original=marker.outerHTML,view=HintView.create({board:f.board,reducedMotion:()=>reduced,setTimeout:()=>1,clearTimeout:()=>{}});
 try{
  view.show({pair:authored.pair,...authored.expected,layout:f.layout,preserveMaterialMarkers:true});const copy=f.board.querySelector('.idle-hint-material-copy');assert.equal(marker.outerHTML,original);
  if(reduced)assert.equal(copy,null,'static outline cannot cover the original material token');else{assert(copy);assert.equal(copy.getAttribute('transform'),marker.getAttribute('transform'));assert.equal(copy.getAttribute('pointer-events'),'none');assert.equal(copy.getAttribute('aria-hidden'),'true');assert.equal(copy.querySelector('[id],[tabindex],[data-index],[data-material-source],[data-material-sources],[data-material-cell]'),null);assert.equal(copy.hasAttribute('data-material-source'),false);assert.equal(copy.parentElement.dataset.idleHintSource,'0');assert(copy.compareDocumentPosition(copy.parentElement.querySelector('.gem'))&win.Node.DOCUMENT_POSITION_PRECEDING,'fixed marker paints after the animated gem');assert(animated.every(node=>!copy.contains(node)&&node!==copy));}
  view.hide();assert.equal(f.board.outerHTML,before);view.show({pair:authored.pair,...authored.expected,layout:f.layout});assert.equal(f.board.querySelector('.idle-hint-material-copy'),null,'older hint calls keep their exact visual scope');view.hide();assert.equal(f.board.outerHTML,before);
 }finally{view.destroy();f.close();}
});

test('invalid quantities, source duplicates and cell coordinates reject the visual plan',()=>{for(const change of [event=>event.quantity=0,event=>event.cell=-1,event=>event.kind='fake']){const f=fixture();change(f.result.frames[0].materialEvents[0]);assert.throws(()=>Pipeline.plan({before:f.before,final:f.final,frames:f.result.frames,swap:f.level.solutions[0][0],motion}),TypeError);}const f=fixture();f.result.frames[0].materialEvents.push(f.result.frames[0].materialEvents[0]);assert.throws(()=>Pipeline.plan({before:f.before,final:f.final,frames:f.result.frames,swap:f.level.solutions[0][0],motion}),TypeError);});

(async()=>{for(const{name,run}of tests){await run();console.log('PASS '+name);}console.log(`Material view/presentation checks: ${tests.length} groups passed; real committed waves, anchored markers, counter projections, event order and cancellation.`);})().catch(error=>{console.error(error);process.exitCode=1;});
