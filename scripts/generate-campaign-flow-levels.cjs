/* Versioned L6 authoring; original campaign bytes are read and never rewritten. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),context={window:{},performance};vm.createContext(context);
for(const name of ['engine.js','levels.js'])vm.runInContext(fs.readFileSync(root+'/dist/'+name,'utf8'),context,{filename:name});
const Engine=context.window.HexMatch,copy=x=>JSON.parse(JSON.stringify(x));
function definition(){
 const original=copy(context.window.HEX_LEVELS.find(l=>l.id===6)),{solution,alternativeSolutions,balance,par,...level}=original;
 level.rulesVersion='classic-v5';level.levelDataVersion='campaign-flow-v1';level.variantId='flow-v1';level.subtitle='Kutuların yanında eşleştir; kırılan her geçitten yalnız bağlı sütuna taşlar düşer.';
 const columns=[...new Set(level.cells.map(c=>c.q))].sort((a,b)=>a-b),sources=columns.map(q=>level.cells.map((c,i)=>({c,i})).filter(x=>x.c.q===q).sort((a,b)=>a.c.r-b.c.r)[0].i);
 const blockers=level.cells.map((c,i)=>({c,i})).filter(x=>x.c.r===0).map(({c,i})=>({id:'l6-crate-'+(c.q+2),cell:i,hp:c.q===0?2:1}));
 const lower=level.cells.map((c,i)=>c.r>0?i:-1).filter(i=>i>=0);
 level.obstacles={version:'obstacles-v1',activation:'column-flow-v1',sources,blockers,regions:[{id:'l6-lower',cells:lower,requires:[]}]};
 level.initial=level.initial.map((v,i)=>level.cells[i].r>=0?null:v);return level;
}
function rank(g,start){return (start.remainingLayers-g.remainingLayers)*30+g.blockerHp.reduce((n,h,i)=>n+(start.blockerHp[i]-h)*95,0)+g.cellOpen.reduce((n,o,i)=>n+Number(o&&!start.cellOpen[i])*25,0)+Math.min(g.score,g.level.target)*.08;}
function solve(level,first,{width=120}={}){
 const start=new Engine(level),prefix=[];if(first){try{if(!start.swap(...first).ok)return null;}catch{return null;}prefix.push(copy(first));}
 if(start.status==='won')return prefix;
 let beam=[{g:start,path:prefix,rank:0}],visited=new Set();const base=new Engine(level);
 for(let depth=prefix.length;depth<level.moves;depth++){
  const next=[];
  for(const item of beam)for(const pair of item.g.legalMoves()){
   const child=item.g.clone();try{if(!child.swap(...pair).ok)continue;}catch{continue;}
   const path=item.path.concat([copy(pair)]);if(child.status==='won')return path;if(child.status!=='playing')continue;
   const key=child.values.join(',')+'/'+child.layers.join(',')+'/'+child.blockerHp+'/'+child.rngState+'/'+child.score;
   if(visited.has(key))continue;visited.add(key);next.push({g:child,path,rank:rank(child,base)});
  }
  next.sort((a,b)=>b.rank-a.rank);beam=next.slice(0,width);if(!beam.length)break;
 }
 return null;
}
function author(){
 const base=definition();
 for(const moves of [8,10,12,16,20])for(let seed=1;seed<=60;seed++){
  const level=copy(base);level.moves=moves;level.seed=seed;const g=new Engine(level);g.values.fill(null);g._fillVacancies();if(g.findMatches().length||g.legalMoves().length<2)continue;level.initial=copy(g.values);level.seed=g.rngState;
  const openings=g.legalMoves().filter(pair=>{const c=new Engine(level),r=c.swap(...pair);return r.frames.some(f=>f.brokenBlockers.length);});
  const routes=[];for(const first of openings){const route=solve(level,first);if(route){routes.push(route);console.log('L6 certificate',moves,'seed',seed,'first',first,'moves',route.length);if(routes.length===2)break;}}
  if(routes.length>=2){level.solutions=routes;level.solution=routes[0];level.par=routes[0].length;return level;}
 }
 throw new Error('Flow authoring budget exhausted; no unsolvability claim.');
}
function certificates(levels){return {rulesVersion:'classic-v5',levelDataVersion:'campaign-flow-v1',activation:'column-flow-v1',levels:levels.map(l=>({id:l.id,cells:l.cells.length,routes:l.solutions.map(path=>{const g=new Engine(l),steps=path.map(pair=>{const r=g.swap(...pair);if(!r.ok)throw new Error('Route failed');return {pair,waves:r.frames.length,hits:r.frames.flatMap((f,wave)=>f.blockerHits.map(h=>({...h,wave}))),openedCells:r.frames.flatMap((f,wave)=>f.openedCells.map(cell=>({cell,wave})))};});if(g.status!=='won')throw new Error('Uncertified flow level');return {path,steps,status:g.status,score:g.score,movesUsed:g.turn,movesLeft:g.movesLeft,rngState:g.rngState};})}))};}
function wire(levels){return '/* Generated from data/campaign-flow-levels-v1.json. L6 development override only. */\nwindow.HEX_CAMPAIGN_FLOW_LEVELS = '+JSON.stringify(levels,null,2)+';\n';}
if(require.main===module){if(process.argv.includes('--check')){const data=JSON.parse(fs.readFileSync(root+'/data/campaign-flow-levels-v1.json','utf8'));if(fs.readFileSync(root+'/dist/campaign-flow-levels.js','utf8')!==wire(data.levels))throw new Error('Flow browser catalog drift');if(fs.readFileSync(root+'/reports/obstacles-9-12/flow-certificates.json','utf8')!==JSON.stringify(certificates(data.levels),null,2)+'\n')throw new Error('Flow certificate drift');console.log('L6 flow catalog wrapper and winning certificates verified.');}else{const data={schemaVersion:1,rulesVersion:'classic-v5',levelDataVersion:'campaign-flow-v1',levels:[author()]};fs.writeFileSync(root+'/data/campaign-flow-levels-v1.json',JSON.stringify(data,null,2)+'\n');fs.writeFileSync(root+'/dist/campaign-flow-levels.js',wire(data.levels));fs.mkdirSync(root+'/reports/obstacles-9-12',{recursive:true});fs.writeFileSync(root+'/reports/obstacles-9-12/flow-certificates.json',JSON.stringify(certificates(data.levels),null,2)+'\n');}}
module.exports={definition,solve,certificates};
