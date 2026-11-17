/* Offline 9x9 offset-hex authoring. All certificates use the canonical engine. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),context={window:{},performance};vm.createContext(context);
for(const file of ['engine.js','levels.js'])vm.runInContext(fs.readFileSync(root+'/dist/'+file,'utf8'),context,{filename:file});
const Engine=context.window.HexMatch,copy=x=>JSON.parse(JSON.stringify(x));
const budgets=[16,18,20,22,24],targets=[210,250,290,340,390],reinforced=[[0],[-2,2],[-3,0,3],[-4,-1,2],[-3,-1,1,3]],extraLayers=[0,4,6,8,10];
const shapes=[[5,6,7,7,7,6,5],[7,7,7,7,7,7,7],[3,5,7,7,9,7,7,5,3],[5,7,7,7,9,7,7,7,5],[5,7,7,9,9,9,7,7,5]];
function definition(id){
 const original=copy(context.window.HEX_LEVELS.find(l=>l.id===id));if(!original||id<6||id>10)throw new Error('Large flow IDs are 6 through 10');
 const shape=shapes[id-6],qMin=-Math.floor(shape.length/2),cells=[];
 for(let row=0;row<9;row++)for(let column=0;column<shape.length;column++){
  const q=column+qMin,length=shape[column],start=4-Math.floor(length/2);if(row<start||row>=start+length)continue;
  cells.push({q,r:row-4-Math.floor(q/2),layers:1});
 }
 const row=c=>c.r+Math.floor(c.q/2)+4,eligible=cells.map((c,i)=>({c,i})).filter(x=>[1,2,6,7].includes(row(x.c))&&Math.abs(x.c.q)<=2).map(x=>x.i);
 for(const i of eligible.slice(0,extraLayers[id-6]))cells[i].layers=2;
 const blockers=cells.map((c,i)=>({c,i})).filter(x=>row(x.c)===4).map(({c,i})=>({id:'l'+id+'-crate-'+(c.q+4),cell:i,hp:reinforced[id-6].includes(c.q)?2:1}));
 const sources=shape.map((_,column)=>cells.findIndex(c=>c.q===column+qMin));
 return {id,rulesVersion:'classic-v5',name:original.name,subtitle:'Kutuların yanında eşleştir; her açık geçitten bağlı alt sütuna taşlar düşer.',levelDataVersion:'campaign-flow-v2',variantId:'flow-v2',boardSize:{columns:9,rows:9,layout:'odd-q',qMin:-4,rowMin:-4},presentation:{fit:'compact'},cells,initial:cells.map((c,i)=>row(c)<4?original.palette[i%original.palette.length]:null),palette:original.palette,seed:1,moves:budgets[id-6],target:targets[id-6],obstacles:{version:'obstacles-v1',activation:'column-flow-v1',sources,blockers,regions:[{id:'l'+id+'-lower',cells:cells.map((c,i)=>row(c)>4?i:-1).filter(i=>i>=0),requires:[]}]}};
}
function rank(g,base){
 const ground=base.remainingLayers-g.remainingLayers,broken=base.blockerHp.reduce((n,h,i)=>n+h-g.blockerHp[i],0),open=g.cellOpen.filter(Boolean).length-base.cellOpen.filter(Boolean).length;
 return ground*40+broken*75+open*11+Math.min(g.score,g.level.target)*.035;
}
function solve(level,first,{width=18,log=false,maxNodes=250000}={}){
 const base=new Engine(level),start=base.clone();const prefix=[];let nodes=0;
 if(first){try{if(!start.swap(...first).ok)return null;}catch{return null;}prefix.push(copy(first));}
 let beam=[{g:start,path:prefix,rank:rank(start,base)}];if(start.status==='won')return prefix;
 for(let depth=prefix.length;depth<level.moves;depth++){
  const next=[],visited=new Set();
  for(const item of beam)for(const pair of item.g.legalMoves()){
   if(nodes++>=maxNodes)return null;
   const child=item.g.clone();try{if(!child.swap(...pair).ok)continue;}catch{continue;}
   const path=item.path.concat([copy(pair)]);if(child.status==='won')return path;if(child.status!=='playing')continue;
   const key=child.values.join(',')+'/'+child.layers.join(',')+'/'+child.blockerHp+'/'+child.rngState+'/'+child.score;
   if(visited.has(key))continue;visited.add(key);next.push({g:child,path,rank:rank(child,base)});
  }
  next.sort((a,b)=>b.rank-a.rank);beam=next.slice(0,width);
  if(log&&beam.length)console.log('L'+level.id,'depth',depth+1,'nodes',nodes,'layers',beam[0].g.remainingLayers,'hp',beam[0].g.blockerHp.join(','),'score',beam[0].g.score);
  if(!beam.length)break;
 }
 return null;
}
function author(id,{width=18,maxSeeds=50,log=false,startSeed=1}={}){
 const base=definition(id);
 for(let seed=startSeed;seed<startSeed+maxSeeds;seed++){
  const level=copy(base);level.seed=(seed*0x9e37+id*97)>>>0;const g=new Engine(level);g.values.fill(null);g._fillVacancies();if(g.findMatches().length||g.legalMoves().length<2)continue;level.initial=copy(g.values);level.seed=g.rngState;
  const openings=g.legalMoves().filter(pair=>{const child=new Engine(level),r=child.swap(...pair);return r.frames[0].brokenBlockers.length>0&&r.frames[0].brokenBlockers.length<level.obstacles.blockers.length;});
  const routes=[];
  for(const first of openings){const route=solve(level,first,{width,log});if(route){routes.push(route);console.log('L'+id+' verified',route.length,'moves seed',seed,'first',first);if(routes.length===2)break;}}
  if(routes.length>=2){level.solutions=routes;level.solution=routes[0];level.par=routes[0].length;return level;}
  if(log)console.log('L'+id+' seed budget exhausted',seed,'openings',openings.length);
 }
 throw new Error('L'+id+' authoring budget exhausted; this is not an unsolvability claim');
}
function certificates(levels){return {rulesVersion:'classic-v5',levelDataVersion:'campaign-flow-v2',activation:'column-flow-v1',boardSize:{columns:9,rows:9,layout:'odd-q',qMin:-4,rowMin:-4},levels:levels.map(l=>({id:l.id,cells:l.cells.length,groundLayers:l.cells.reduce((n,c)=>n+c.layers,0),moves:l.moves,target:l.target,routes:l.solutions.map(route=>{const g=new Engine(l),steps=route.map(pair=>{const r=g.swap(...pair);if(!r.ok)throw new Error('Invalid certificate');return {pair,waves:r.frames.length,scoreGain:r.scoreGain,hits:r.frames.flatMap((f,wave)=>f.blockerHits.map(h=>({...h,wave}))),openedCells:r.frames.flatMap((f,wave)=>f.openedCells.map(cell=>({cell,wave})))};});if(g.status!=='won')throw new Error('Uncertified level '+l.id);return {path:route,steps,status:g.status,score:g.score,movesUsed:g.turn,movesLeft:g.movesLeft,rngState:g.rngState,covered:g.covered};})}))};}
function wire(levels){return '/* Generated from data/campaign-flow-levels-v2.json. Versioned campaign flow shapes inside a 9x9 maximum canvas. */\nwindow.HEX_CAMPAIGN_FLOW_LEVELS_V2 = '+JSON.stringify(levels,null,2)+';\n';}
function write(levels){const data={schemaVersion:1,rulesVersion:'classic-v5',levelDataVersion:'campaign-flow-v2',levels};fs.writeFileSync(root+'/data/campaign-flow-levels-v2.json',JSON.stringify(data,null,2)+'\n');fs.writeFileSync(root+'/dist/campaign-flow-levels-v2.js',wire(levels));fs.mkdirSync(root+'/reports/flow-9-12-v2',{recursive:true});fs.writeFileSync(root+'/reports/flow-9-12-v2/level-certificates.json',JSON.stringify(certificates(levels),null,2)+'\n');}
if(require.main===module){if(process.argv.includes('--check')){const data=JSON.parse(fs.readFileSync(root+'/data/campaign-flow-levels-v2.json','utf8'));if(fs.readFileSync(root+'/dist/campaign-flow-levels-v2.js','utf8')!==wire(data.levels))throw new Error('Large flow browser catalog drift');if(fs.readFileSync(root+'/reports/flow-9-12-v2/level-certificates.json','utf8')!==JSON.stringify(certificates(data.levels),null,2)+'\n')throw new Error('Large flow certificate drift');console.log('Five variable-shape flow boards in a 9x9 maximum canvas, wrapper and all 10 winning routes verified.');}else write([6,7,8,9,10].map(id=>author(id,{log:process.argv.includes('--verbose')})));}
module.exports={definition,solve,author,certificates,write,Engine,copy};
