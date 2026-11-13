/* Translate classic board events into portable reward features. No UI or writes. */
(function(global){
  'use strict';
  const lineCache=new WeakMap();
  function linesFor(level){
    if(lineCache.has(level))return lineCache.get(level);
    const map=new Map(level.cells.map((cell,index)=>[cell.q+','+cell.r,index])),lines=[];
    for(const [dq,dr]of [[1,0],[0,1],[1,-1]])for(const cell of level.cells){
      if(map.has((cell.q-dq)+','+(cell.r-dr)))continue;
      let q=cell.q,r=cell.r;const line=[];
      while(map.has(q+','+r)){line.push(map.get(q+','+r));q+=dq;r+=dr;}
      if(line.length>=3)lines.push(line);
    }
    lineCache.set(level,lines);return lines;
  }
  function runsFor(level,frame,lines=linesFor(level)){
    const membership=Array(level.cells.length).fill(0);let maxRun=0,runCount=0;
    for(const line of lines){let start=0;
      for(let end=1;end<=line.length;end++){
        if(end<line.length&&frame.before[line[end]]===frame.before[line[start]])continue;
        if(frame.before[line[start]]!=null&&end-start>=3){
          runCount++;maxRun=Math.max(maxRun,end-start);
          for(let j=start;j<end;j++)membership[line[j]]++;
        }
        start=end;
      }
    }
    return {maxRun,runCount,crossAxes:Math.max(0,...membership)};
  }
  function summarize(level,before,result,after,attemptId=String(level.id)){
    if(!result?.ok)return null;
    const totalCells=level.cells.length,green=layers=>layers.reduce((n,value)=>n+Number(value===0),0);
    let layers=before.layers,score=before.score;
    const lines=after?.topology?.lines||linesFor(level);
    const waves=result.frames.map((frame,index)=>{
      let newGreen=0,layersCleared=0,doubleCleared=0;
      for(let i=0;i<totalCells;i++){
        layersCleared+=layers[i]-frame.layers[i];
        if(layers[i]>0&&frame.layers[i]===0){newGreen++;if((level.cells[i].layers||1)===2)doubleCleared++;}
      }
      score+=frame.scoreGain;
      const features={wave:index+1,gain:frame.scoreGain,matched:frame.matched.length,...runsFor(level,frame,lines),newGreen,layersCleared,doubleCleared,scoreAfter:score,greenAfter:green(frame.layers)};
      layers=frame.layers;return features;
    });
    const scoreAfter=after?.score??score,greenAfter=green(layers),movesLeft=after?.movesLeft??before.movesLeft-1;
    const targetMet=level.targetMode==='exact'?scoreAfter===level.target:scoreAfter>=level.target;
    const status=typeof after?.status==='string'?after.status:greenAfter===totalCells&&targetMet?'won':movesLeft<=0||(level.targetMode==='exact'&&scoreAfter>level.target)?'lost':'playing';
    return {attemptId,turn:after?.turn??before.turn+1,tutorial:level.kind==='tutorial',totalCells,target:level.target,scoreBefore:before.score,scoreAfter,greenBefore:green(before.layers),greenAfter,movesLeft,status,waves};
  }
  function restore(level,snapshot,rules,Engine=global.HexMatch,Director=global.HexRewards){
    const attemptId=String(level.id),replay=new Engine(level);let state=Director.createState(attemptId),lastPlan=null;
    for(const pair of snapshot?.history||[]){
      const before=replay.snapshot(),result=replay.swap(...pair);
      if(!result.ok)throw new Error('Reward history contains an invalid swap');
      const evaluated=Director.evaluate(summarize(level,before,result,replay,attemptId),state,rules);
      state=evaluated.nextState;lastPlan=evaluated.plan;
    }
    return {state,lastPlan};
  }
  const api={summarize,restore,runsFor};global.HexRewardAdapter=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
