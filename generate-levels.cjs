/* Reproducible classic-v4 level search. No runtime generation in the browser. */
const fs=require('node:fs');
global.window={};require('./dist/engine.js');const HexMatch=window.HexMatch;
function rng(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function shape(kind){const cells=[];for(let q=-3;q<=3;q++)for(let r=-3;r<=3;r++)if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=3){if(kind===19&&Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))>2)continue;if(kind===23&&(Math.abs(q)>2||Math.abs(r)>2))continue;if(kind===29&&Math.abs(q)>2)continue;cells.push({q,r,layers:1});}return cells.sort((a,b)=>(a.r+a.q/2)-(b.r+b.q/2)||a.q-b.q);}
function initialBoard(level,random){const game=new HexMatch({...level,initial:level.cells.map(()=>1)});for(let attempt=0;attempt<20000;attempt++){game.values=level.cells.map(()=>level.palette[Math.floor(random()*level.palette.length)]);if(!game.findMatches().length&&game.legalMoves().length>=3)return game.values.slice();}throw Error('No initial board');}
function solve(level,{maxDepth=32,width=32,prefix=[],target=0}={}){
 const first=new HexMatch(level);for(const pair of prefix)if(!first.swap(...pair).ok)return null;
 const goal=first.remainingLayers;
 let beam=[{game:first,route:prefix.slice(),rank:0}];
 for(let depth=prefix.length;depth<maxDepth;depth++){
  const children=[],seen=new Map();
  for(const node of beam)for(const pair of node.game.legalMoves()){
   const next=node.game.clone();next.swap(...pair);const route=node.route.concat([pair]);
   if(next.remainingLayers===0&&next.score>=target)return {route,score:next.score,turn:route.length};
   if(next.status==='lost')continue;
   // A lower score at the same board, floor, RNG and depth is dominated.
   const key=next.values.join(',')+'|'+next.layers.join('')+'|'+next.rngState;
   const old=seen.get(key);if(old&&old.game.score>=next.score)continue;
   const progress=goal-next.remainingLayers;
   const item={game:next,route,rank:progress*120+next.covered*35+Math.min(next.score,Math.max(target,100))*.04};
   seen.set(key,item);
  }
  children.push(...seen.values());children.sort((a,b)=>b.rank-a.rank);beam=children.slice(0,width);
  if(!beam.length)return null;
 }
 return null;
}
function replay(level,route){const game=new HexMatch(level);for(const p of route)if(!game.swap(...p).ok)throw Error('Invalid certified swap');return game;}
function policyRate(level,trials=100,greedy=false){
 let wins=0,waves=0,swaps=0,maxWaves=0,forced=0;const random=rng(9107+level.id*917+(greedy?131:0));
 for(let t=0;t<trials;t++){
  const game=new HexMatch(level);
  while(game.status==='playing'){
   const moves=game.legalMoves();if(!moves.length)throw Error('Playing board without legal move');
   let pair;
   if(greedy){
    let best=-Infinity,choices=[];
    for(const p of moves){const child=game.clone(),r=child.swap(...p),progress=game.remainingLayers-child.remainingLayers;const rank=progress*100+Math.min(r.scoreGain,Math.max(0,level.target-game.score));if(rank>best){best=rank;choices=[p];}else if(rank===best)choices.push(p);}
    pair=choices[Math.floor(random()*choices.length)];
   }else pair=moves[Math.floor(random()*moves.length)];
   const r=game.swap(...pair);waves+=r.frames.length;swaps++;maxWaves=Math.max(maxWaves,r.frames.length);forced+=r.frames.reduce((n,f)=>n+f.refill.filter(x=>x.forced).length,0);
  }
  if(game.status==='won')wins++;
 }
 return {wins,trials,rate:Math.round(wins/trials*100),averageWaves:Number((waves/Math.max(1,swaps)).toFixed(3)),maxWaves,forcedRefills:forced};
}
function certify(level,main){
 const routes=[main.route],firstKeys=new Set([main.route[0].slice().sort((a,b)=>a-b).join(',')]);
 const openings=new HexMatch(level).legalMoves().filter(p=>!firstKeys.has(p.slice().sort((a,b)=>a-b).join(',')));
 // Check independent openings, not just different suffixes of the same script.
 openings.sort((a,b)=>{const g1=new HexMatch(level),g2=new HexMatch(level);g1.swap(...a);g2.swap(...b);return g1.remainingLayers-g2.remainingLayers;});
 for(const p of openings.slice(0,6)){
  const alternative=solve(level,{maxDepth:level.moves,width:20,prefix:[p],target:level.target});
  if(alternative){routes.push(alternative.route);firstKeys.add(p.slice().sort((a,b)=>a-b).join(','));break;}
 }
 return routes;
}
function generate({outputDirectory='reports/legacy-generated'}={}){
 // Research output cannot replace the original data used by existing saves.
 fs.mkdirSync(outputDirectory,{recursive:true});
 const names=['İlk eşleşme','Üç yönde düşün','Çifte dikkat','Yeşil adalar','Zincir etkisi','İnce seçim','Katman katman','Uzak köşeler','Son hamle','Usta dokunuşu'];
 const subtitles=['Komşu iki sayıyı değiştir; aynı sayıdan en az üçünü sırala.','Üç eksende eşleşme kur. Her hamle bir seçim.','İşaretli zemini yeşile boyamak için iki ayrı eşleşme kur.','Yeşillenmemiş alanlara ulaşan eşleşmeleri ara.','Düşen mevcut taşlarla yeni bir zincir planla.','Puanın kadar geride kalan zemini de düşün.','Çift katmanları tamamlayacak hamlelerini sakla.','Büyüyen tahtada kenarları unutma.','En çok puanı değil, eksik alanı tamamlayan hamleyi ara.','Hedef puan ve bütün zemin, sınırlı hamlede.'];
 const sizes=[19,19,19,23,23,23,29,29,37,37],layerCounts=[0,0,2,3,4,5,7,9,12,16],output=[];
 for(let i=0;i<10;i++){
  let chosen=null;
  for(let attempt=0;attempt<80;attempt++){
   const seed=(12797+i*8171+attempt*101)>>>0,random=rng(seed),cells=shape(sizes[i]),indices=cells.map((_,j)=>j);
   for(let j=indices.length-1;j>0;j--){const k=Math.floor(random()*(j+1));[indices[j],indices[k]]=[indices[k],indices[j]];}
   indices.slice(0,layerCounts[i]).forEach(j=>cells[j].layers=2);
   const level={id:i+1,rulesVersion:'classic-v4',name:names[i],subtitle:subtitles[i],cells,initial:[],seed:(seed*7919)>>>0,palette:i<7?[1,2,3,4]:[1,2,3,4,5],moves:36,target:100000};
   level.initial=initialBoard(level,random);
   const found=solve(level,{maxDepth:32,width:i>=8?48:32});
   if(!found||found.turn<5){console.log(JSON.stringify({level:i+1,attempt,rejected:'solution'}));continue;}
   level.solution=found.route;level.par=found.turn;level.moves=found.turn+(i<2?5:i<5?3:2);level.target=Math.max(15,Math.floor(found.score*.8/5)*5);
   const witness=replay(level,level.solution);if(witness.status!=='won')throw Error('Witness misses final score or ground');
   if(new HexMatch(level).legalMoves().some(p=>{const g=new HexMatch(level);g.swap(...p);return g.status==='won';})){console.log(JSON.stringify({level:i+1,attempt,rejected:'one-move victory'}));continue;}
   const randomTest=policyRate(level,100);
   const maximum=i===0?70:i<3?50:i<6?35:25;
   if(randomTest.rate>maximum){console.log(JSON.stringify({level:i+1,attempt,rejected:'random',random:randomTest.rate}));continue;}
   const solutions=certify(level,found);
   if(solutions.length<2){console.log(JSON.stringify({level:i+1,attempt,rejected:'one opening'}));continue;}
   level.alternativeSolutions=solutions.slice(1);
   const greedyTest=policyRate(level,30,true);
   if(i<2&&greedyTest.rate<60){console.log(JSON.stringify({level:i+1,attempt,rejected:'tutorial planning',greedy:greedyTest.rate}));continue;}
   level.balance={randomWinRate:randomTest.rate,trials:randomTest.trials,solutionScore:witness.score,winningOpenings:solutions.length,averageCascadeWaves:randomTest.averageWaves,maxCascadeWaves:randomTest.maxWaves,forcedRefills:randomTest.forcedRefills,greedyWinRate:greedyTest.rate,greedyTrials:greedyTest.trials};
   chosen=level;console.log(JSON.stringify({level:i+1,attempt,size:cells.length,par:level.par,moves:level.moves,target:level.target,balance:level.balance}));break;
  }
  if(!chosen)throw Error('No candidate meets every gate for level '+(i+1));
  output.push(chosen);
 }
 // Only replace published data after every candidate passes final replay.
 for(const l of output)for(const route of [l.solution,...l.alternativeSolutions])if(replay(l,route).status!=='won')throw Error('Final certification failed');
 const path=outputDirectory+'/levels.js',temp=path+'.next';fs.writeFileSync(temp,'/* Classic-v4 levels: controlled refill and independently certified winning openings. */\nwindow.HEX_LEVELS = '+JSON.stringify(output,null,2)+';\n');fs.renameSync(temp,path);
 fs.writeFileSync(outputDirectory+'/balance-report.json',JSON.stringify({rulesVersion:'classic-v4',method:'100 seeded random-valid games and 30 seeded one-step coverage-greedy games per level; not a human playtest',levels:output.map(l=>({id:l.id,cells:l.cells.length,moves:l.moves,par:l.par,target:l.target,...l.balance}))},null,2)+'\n');
 console.log('Generated 10 research levels in '+outputDirectory+'; published legacy levels were preserved.');
}
module.exports={solve,replay,policyRate,generate};if(require.main===module)generate();
