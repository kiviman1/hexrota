/* Offline visible-information policies. The evaluator only receives a whitelist DTO.
 * Counterfactual refill seeds come from the decision seed, never the real game RNG. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/engine.js'),'utf8'),sandbox);
const Model=sandbox.window.HexMatch;
const POLICIES=Object.freeze(['random','visible_score','visible_coverage','sampled']);
const directions=[[1,0],[0,1],[1,-1]];
const topologyCache=new Map();
function mix32(seed){let x=(seed>>>0)||0x9e3779b9;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0;}
function topology(cells){
 const key=cells.map(c=>`${c.q},${c.r}`).join(';');if(topologyCache.has(key))return topologyCache.get(key);
 const map=new Map(cells.map((c,i)=>[`${c.q},${c.r}`,i])),pairs=[],lines=[];
 cells.forEach((c,i)=>{for(const [dq,dr]of directions){const other=map.get(`${c.q+dq},${c.r+dr}`);if(other!==undefined)pairs.push([i,other]);if(map.has(`${c.q-dq},${c.r-dr}`))continue;const line=[];let q=c.q,r=c.r;while(map.has(`${q},${r}`)){line.push(map.get(`${q},${r}`));q+=dq;r+=dr;}if(line.length>=3)lines.push(line);}});
 const result={pairs,lines};topologyCache.set(key,result);return result;
}
function visibleState(game){
 // Do not use snapshot(), clone(), history, seed, solution or rngState here.
 return {cells:game.level.cells.map(c=>({q:c.q,r:c.r})),values:game.values.slice(),layers:game.layers.slice(),palette:game.level.palette.slice(),target:game.level.target,targetMode:game.level.targetMode==='exact'?'exact':'minimum',score:game.score,movesLeft:game.movesLeft};
}
function sanitize(input){
 const cells=input.cells.map(c=>({q:c.q,r:c.r})),values=input.values.slice(),layers=input.layers.slice(),palette=input.palette.slice();
 if(!cells.length||new Set(cells.map(c=>`${c.q},${c.r}`)).size!==cells.length||cells.some(c=>!Number.isInteger(c.q)||!Number.isInteger(c.r))||values.length!==cells.length||layers.length!==cells.length||!palette.length||palette.some(v=>!Number.isInteger(v)||v<1)||values.some(v=>!palette.includes(v))||layers.some(v=>!Number.isInteger(v)||v<0||v>2)||!Number.isInteger(input.target)||input.target<1||!Number.isInteger(input.score)||input.score<0||!Number.isInteger(input.movesLeft)||input.movesLeft<0)throw Error('Invalid visible board');
 return {cells,values,layers,palette,target:input.target,targetMode:input.targetMode==='exact'?'exact':'minimum',score:input.score,movesLeft:input.movesLeft};
}
function matches(values,lines){const set=new Set();for(const line of lines){let start=0;for(let j=1;j<=line.length;j++){if(j<line.length&&values[line[j]]===values[line[start]])continue;if(j-start>=3)for(let k=start;k<j;k++)set.add(line[k]);start=j;}}return [...set].sort((a,b)=>a-b);}
function visibleOptions(input){
 const s=sanitize(input),t=topology(s.cells),options=[];
 if(!s.movesLeft)return options;
 for(const pair of t.pairs){const [a,b]=pair;if(s.values[a]===s.values[b])continue;const values=s.values.slice();[values[a],values[b]]=[values[b],values[a]];const marked=matches(values,t.lines);if(!marked.length)continue;
  const scoreGain=marked.reduce((n,i)=>n+values[i],0),layerGain=marked.filter(i=>s.layers[i]>0).length,greenGain=marked.filter(i=>s.layers[i]===1).length;
  options.push({pair:pair.slice(),matched:marked,scoreGain,layerGain,greenGain});
 }
 return options;
}
function optionRank(option,policy,state){const points=Math.min(option.scoreGain,Math.max(0,state.target-state.score));return policy==='visible_score'?points*100+option.layerGain*2+option.greenGain:option.layerGain*100+option.greenGain*35+points*.1;}
function bestOptions(state,policy){const options=visibleOptions(state);let best=-Infinity,result=[];for(const option of options){const rank=optionRank(option,policy,state);if(rank>best+1e-8){best=rank;result=[option];}else if(Math.abs(rank-best)<1e-8)result.push(option);}return result;}
function createModel(state,seed){
 const level={id:'counterfactual',rulesVersion:'classic-v4',cells:state.cells.map((c,i)=>({...c,layers:Math.max(1,state.layers[i])})),initial:state.values.slice(),seed:(seed>>>0)||1,palette:state.palette.slice(),target:state.target,moves:Math.max(1,state.movesLeft),targetMode:state.targetMode==='exact'?'exact':undefined};
 const model=new Model(level);model.layers=state.layers.slice();model.score=state.score;model.movesLeft=state.movesLeft;return model;
}
function sampledRanks(state,options,seed,{samples=4,depth=2}={}){
 if(!Number.isInteger(samples)||samples<1||samples>16||!Number.isInteger(depth)||depth<1||depth>3)throw Error('Invalid observable sample budget');
 const sumLayers=state.layers.reduce((a,b)=>a+b,0),startCovered=state.layers.filter(n=>n===0).length,deficit=Math.max(0,state.target-state.score),ranks=options.map(()=>0);
 for(let sample=0;sample<samples;sample++){
  // Common independent random numbers compare candidates fairly. No real RNG is passed.
  const synthetic=mix32(seed^Math.imul(sample+1,0x85ebca6b)),base=createModel(state,synthetic);
  options.forEach((option,index)=>{
   const child=base.clone();child.swap(...option.pair);
   for(let turn=1;turn<depth&&child.status==='playing';turn++){
    const publicChild=visibleState(child),next=bestOptions(publicChild,'visible_coverage');
    if(!next.length)break;const chosen=next[mix32(synthetic^Math.imul(turn+1,0xc2b2ae35))%next.length];child.swap(...chosen.pair);
   }
   const rank=child.status==='won'?100000+child.movesLeft*100:(sumLayers-child.remainingLayers)*100+(child.covered-startCovered)*35+Math.min(child.score-state.score,deficit)*.6-(child.status==='lost'?1000:0);
   ranks[index]+=rank/samples;
  });
 }
 return ranks;
}
function choose(input,{policy='visible_coverage',seed=1,samples=4,depth=2}={}){
 if(!POLICIES.includes(policy)||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Invalid observable player');
 const state=sanitize(input),scoreMet=state.targetMode==='exact'?state.score===state.target:state.score>=state.target;
 if(!state.movesLeft||(state.layers.every(layer=>layer===0)&&scoreMet)||(state.targetMode==='exact'&&state.score>state.target))return null;
 const options=visibleOptions(state);if(!options.length)return null;
 const own=mix32(seed);let choices;
 if(policy==='random')choices=options;
 else if(policy==='sampled'){
  const ranks=sampledRanks(state,options,own,{samples,depth}),best=Math.max(...ranks);choices=options.filter((_,i)=>Math.abs(ranks[i]-best)<1e-8);
 }else choices=bestOptions(state,policy);
 const selected=choices[own%choices.length];return {pair:selected.pair.slice(),policy,information:'visible-only',decisionSeed:seed>>>0,choiceCount:choices.length,legalOptions:options.length};
}
module.exports={POLICIES,mix32,visibleState,visibleOptions,choose};
