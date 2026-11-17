/* Versioned material-objective alpha boards. Existing campaign bytes stay read-only. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),context={window:{},performance};vm.createContext(context);vm.runInContext(fs.readFileSync(root+'/dist/engine.js','utf8'),context,{filename:'engine.js'});
const Engine=context.window.HexMatch,base=require('../data/campaign-flow-levels-v2.json').levels,copy=x=>JSON.parse(JSON.stringify(x));
const VERSION='material-alpha-v1',VARIANT='materials-v1';
function definition(id){
 const original=base.find(l=>l.id===id);if(!original||id<6||id>8)throw new Error('Material alpha IDs are 6 through 8');
 const level=copy(original);delete level.solutions;delete level.solution;delete level.par;
 Object.assign(level,{rulesVersion:'classic-v6',levelDataVersion:VERSION,variantId:VARIANT,scenario:['A','B','C'][id-6],name:['Alfa A — Ahşap','Alfa B — Çivi','Alfa C — Karma'][id-6],subtitle:['Kutuları kır; ahşapları topla.','Çivi işaretli hücrelerde eşleştir; çivileri bir kez topla.','Ahşap ve çivi hedeflerini puan ve zemin hedefleriyle birlikte tamamla.'][id-6]});
 const wood=level.obstacles.blockers.map(b=>({id:'alpha-'+id+'-wood-'+b.id,kind:'crate-break',materialId:'wood',quantity:1,cell:b.cell,blockerId:b.id}));
 const nailCells=id===7?[2,28,34,42,48]:id===8?[8,31,41,52]:[];
 const nails=nailCells.map(cell=>({id:'alpha-'+id+'-nail-'+cell,kind:'matched-cell',materialId:'nail',quantity:1,cell}));
 level.materials={version:'materials-v1',definitions:id===6?[{id:'wood'}]:id===7?[{id:'nail'}]:[{id:'wood'},{id:'nail'}],sources:id===6?wood:id===7?nails:wood.concat(nails)};
 level.objectives={version:'objectives-v1',score:id===8,ground:id===8,materials:id===6?[{materialId:'wood',quantity:wood.length}]:id===7?[{materialId:'nail',quantity:nails.length}]:[{materialId:'wood',quantity:wood.length},{materialId:'nail',quantity:nails.length}]};
 return level;
}
function author(id){const level=definition(id),original=base.find(l=>l.id===id),routes=[];
 for(const route of original.solutions){const game=new Engine(level),path=[];for(const pair of route){if(game.status!=='playing')break;if(!game.swap(...pair).ok)throw new Error('Invalid material alpha route on '+id);path.push(copy(pair));}if(game.status!=='won')throw new Error('Material alpha '+id+' did not win; never publish an uncertified board');routes.push(path);}
 if(routes.length<2||routes[0][0].slice().sort((a,b)=>a-b).join(',')===routes[1][0].slice().sort((a,b)=>a-b).join(','))throw new Error('Independent material alpha openings required');
 level.solutions=routes;level.solution=routes[0];level.par=routes[0].length;return level;
}
function certificates(levels){return {schemaVersion:1,rulesVersion:'classic-v6',levelDataVersion:VERSION,materialVersion:'materials-v1',objectiveVersion:'objectives-v1',levels:levels.map(level=>({id:level.id,scenario:level.scenario,cells:level.cells.length,materials:level.materials,objectives:level.objectives,routes:level.solutions.map(path=>{const game=new Engine(level),steps=path.map(pair=>{const r=game.swap(...pair);if(!r.ok)throw new Error('Invalid alpha certificate');return {pair,waves:r.frames.length,materialEvents:r.frames.flatMap((f,wave)=>f.materialEvents.map(e=>({...e,wave}))),materialCounts:game.materialCounts.slice(),status:game.status};});if(game.status!=='won')throw new Error('Uncertified material alpha '+level.id);return {path,steps,status:game.status,score:game.score,movesUsed:game.turn,movesLeft:game.movesLeft,rngState:game.rngState,covered:game.covered,materialCounts:game.materialCounts.slice(),collectedSources:game.collectedSources.slice()};})}))};}
function wire(levels){return '/* Generated from data/material-alpha-levels-v1.json. Isolated 9.14 material-objective alpha. */\nwindow.HEX_MATERIAL_ALPHA_LEVELS = '+JSON.stringify(levels,null,2)+';\n';}
function write(levels){const data={schemaVersion:1,rulesVersion:'classic-v6',levelDataVersion:VERSION,materialVersion:'materials-v1',objectiveVersion:'objectives-v1',levels};fs.writeFileSync(root+'/data/material-alpha-levels-v1.json',JSON.stringify(data,null,2)+'\n');fs.writeFileSync(root+'/dist/material-alpha-levels.js',wire(levels));fs.mkdirSync(root+'/reports/materials-9-14',{recursive:true});fs.writeFileSync(root+'/reports/materials-9-14/level-certificates.json',JSON.stringify(certificates(levels),null,2)+'\n');}
if(require.main===module){if(process.argv.includes('--check')){const data=JSON.parse(fs.readFileSync(root+'/data/material-alpha-levels-v1.json','utf8'));if(fs.readFileSync(root+'/dist/material-alpha-levels.js','utf8')!==wire(data.levels))throw new Error('Material alpha browser catalog drift');if(fs.readFileSync(root+'/reports/materials-9-14/level-certificates.json','utf8')!==JSON.stringify(certificates(data.levels),null,2)+'\n')throw new Error('Material alpha certificate drift');console.log('Material alpha A/B/C, browser wrapper and six actual winning routes verified.');}else write([6,7,8].map(author));}
module.exports={definition,author,certificates,write,Engine,copy};
