/* Offline authoring only: certificates use the actual shared HexMatch engine. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),context={window:{},performance};vm.createContext(context);vm.runInContext(fs.readFileSync(root+'/dist/engine.js','utf8'),context);
const Engine=context.window.HexMatch,copy=x=>JSON.parse(JSON.stringify(x));
function hex(radius){const cells=[];for(let r=-radius;r<=radius;r++)for(let q=-radius;q<=radius;q++)if(Math.abs(q+r)<=radius)cells.push({q,r,layers:1});return cells;}
function make(id,radius,boxDefs,regionDefs,moves,target){
 const cells=hex(radius),at=(q,r)=>{const i=cells.findIndex(c=>c.q===q&&c.r===r);if(i<0)throw new Error('Missing cell');return i;};
 const blockers=boxDefs.map(([id,q,r,hp])=>({id,cell:at(q,r),hp}));
 const regions=regionDefs.map(([id,filter,requires])=>({id,cells:cells.map((c,i)=>filter(c)?i:-1).filter(i=>i>=0),requires}));
 for(const box of blockers){const gate=regions.find(r=>r.requires.includes(box.id));if(gate)box.regionId=gate.id;}
 const initial=cells.map((c,i)=>blockers.some(b=>b.cell===i)||regions.some(a=>a.cells.includes(i))?null:1);
 return {id:'obstacle-'+id,rulesVersion:'classic-v5',levelDataVersion:'obstacles-v1',name:{a:'İlk Kutu',b:'Kapalı Alt Bölge',c:'Çok Aşamalı Açılma'}[id],subtitle:{a:'Kutunun yanında eşleştir; yeni hücreleri aç.',b:'Üç kutuyu kır; aşağıdaki bahçeye ulaş.',c:'Önce sol bahçeyi, sonra güçlendirilmiş geçidi aç.'}[id],cells,initial,palette:[1,2,3],seed:1,moves,target,obstacles:{version:'obstacles-v1',blockers,regions}};
}
const definitions=[
 make('a',2,[['a-gate',0,0,1]],[['a-garden',c=>c.r===2,['a-gate']]],35,30),
 make('b',2,[['b-left',-1,0,1],['b-center',0,0,1],['b-right',1,0,1]],[['b-lower',c=>c.r>0,['b-left','b-center','b-right']]],65,90),
 make('c',3,[['c-first',-1,0,1],['c-side',1,0,1],['c-reinforced',-1,2,2]],[['c-west',c=>c.r>0&&c.q<0,['c-first']],['c-east',c=>c.r>0&&c.q>=0,['c-side','c-reinforced']]],95,150)
];
function rank(g,start){return (start.remainingLayers-g.remainingLayers)*20+g.blockerHp.reduce((n,h,i)=>n+(start.blockerHp[i]-h)*80,0)+g.regionOpen.reduce((n,o,i)=>n+Number(o&&!start.regionOpen[i])*180,0)+Math.min(g.score,g.level.target)*.05;}
function solve(level,first){let game=new Engine(level),path=[],frames=[];if(first){const r=game.swap(...first);if(!r.ok)return null;path.push(first);frames.push(...r.frames);}
 for(let step=path.length;step<level.moves&&game.status==='playing';step++){
  const choices=[];for(const pair of game.legalMoves()){let child=game.clone(),result;try{result=child.swap(...pair);}catch{continue;}const immediate=rank(child,game);let look=0;
   if(child.status==='won')return {path:path.concat([copy(pair)]),game:child,frames:frames.concat(result.frames)};
   if(child.status==='playing')for(const next of child.legalMoves()){let second=child.clone();try{second.swap(...next);}catch{continue;}look=Math.max(look,rank(second,child));}
   choices.push({pair,child,result,rank:immediate+look*.42});
  }
  choices.sort((a,b)=>b.rank-a.rank);if(!choices.length)return null;const best=choices[0];game=best.child;path.push(copy(best.pair));frames.push(...best.result.frames);
 }
 return game.status==='won'?{path,game,frames}:null;
}
function author(level){
 for(let seed=1;seed<500;seed++){
  const candidate=copy(level);candidate.seed=seed;const game=new Engine(candidate);game.values.fill(null);game._fillVacancies();if(game.findMatches().length||!game.legalMoves().length)continue;candidate.initial=copy(game.values);candidate.seed=game.rngState;
  let openings=game.legalMoves();if(level.id==='obstacle-a')openings=openings.filter(p=>{const g=new Engine(candidate);const r=g.swap(...p);return r.frames[0]?.brokenBlockers.length>0;});
  const routes=[];let best=null;
  for(const first of openings){const result=solve(candidate,first);if(!result)continue;
   if(level.id==='obstacle-c'&&!result.frames.some(f=>f.openedRegions.length&&result.frames[result.frames.indexOf(f)+1]))continue;
   routes.push(result.path);best=result;if(routes.length===2)break;
  }
  if(!routes.length)continue;candidate.solutions=routes;candidate.solution=routes[0];candidate.par=routes[0].length;
  console.log(candidate.id,'seed',seed,'routes',routes.map(p=>p.length),'score',best.game.score,'waves',best.frames.length,'unlock',best.frames.map((f,i)=>f.openedRegions.length?{wave:i,regions:f.openedRegions}:null).filter(Boolean));return candidate;
 }
 throw new Error('No verified route found within authoring budget for '+level.id+'; this is not an unsolvability claim');
}
function certificates(levels){return {rulesVersion:'classic-v5',dataVersion:'obstacles-v1',levels:levels.map(l=>({id:l.id,cells:l.cells.length,closedCells:l.obstacles.regions.reduce((n,r)=>n+r.cells.length,0),blockers:l.obstacles.blockers.map(b=>({id:b.id,hp:b.hp})),routes:l.solutions.map(path=>{const g=new Engine(l),steps=path.map(pair=>{const result=g.swap(...pair);if(!result.ok)throw new Error('Route failed');return {pair,waves:result.frames.length,reshuffled:result.reshuffled,damage:result.frames.flatMap((f,wave)=>f.blockerHits.map(h=>({...h,wave}))),opened:result.frames.flatMap((f,wave)=>f.openedRegions.map(id=>({id,wave})))};});if(g.status!=='won')throw new Error('Uncertified development level');return {path,steps,status:g.status,score:g.score,movesUsed:g.turn,movesLeft:g.movesLeft,rngState:g.rngState,covered:g.covered};})}))};}
if(require.main===module){
 if(process.argv.includes('--check')){
  const catalog=JSON.parse(fs.readFileSync(root+'/data/obstacle-levels-v1.json','utf8')),expected='/* Generated from data/obstacle-levels-v1.json. Development catalog only. */\nwindow.HEX_OBSTACLE_LEVELS = '+JSON.stringify(catalog.levels,null,2)+';\n';
  if(fs.readFileSync(root+'/dist/obstacle-levels.js','utf8')!==expected)throw new Error('Obstacle browser catalog drift');
  for(const level of catalog.levels){if(level.solutions.length<2)throw new Error('Two authored routes required');for(const route of level.solutions){const game=new Engine(level);for(const pair of route)if(!game.swap(...pair).ok)throw new Error('Invalid route');if(game.status!=='won')throw new Error('Uncertified development level');}}
  if(fs.readFileSync(root+'/reports/obstacles-9-12/level-certificates.json','utf8')!==JSON.stringify(certificates(catalog.levels),null,2)+'\n')throw new Error('Obstacle route evidence drift');
  console.log('Obstacle catalog wrapper and all 6 winning routes verified.');process.exit(0);
 }
 const output={schemaVersion:1,rulesVersion:'classic-v5',obstacleVersion:'obstacles-v1',levels:definitions.map(author)};
 fs.mkdirSync(root+'/reports/obstacles-9-12',{recursive:true});fs.writeFileSync(root+'/reports/obstacles-9-12/level-certificates.json',JSON.stringify(certificates(output.levels),null,2)+'\n');
 fs.writeFileSync(root+'/data/obstacle-levels-v1.json',JSON.stringify(output,null,2)+'\n');fs.writeFileSync(root+'/dist/obstacle-levels.js','/* Generated from data/obstacle-levels-v1.json. Development catalog only. */\nwindow.HEX_OBSTACLE_LEVELS = '+JSON.stringify(output.levels,null,2)+';\n');
}
module.exports={definitions,solve};
