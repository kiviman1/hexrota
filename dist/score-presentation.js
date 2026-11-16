/* Score animation owner. This view has no engine, economy, save or RNG access.
 * It receives an immutable wave and presentation callbacks from the app host. */
(function(root){
  'use strict';
  function create({window, document, motion, getPresentation, geometry, renderScore,
    pause, animateElement, canAnimate, rewardForWave, rewardHeadline,
    rewardLabel, rewardFeedback, rewardMilestones}){
    const $=id=>document.getElementById(id);
    const performance=window.performance;
    const requestAnimationFrame=window.requestAnimationFrame?.bind(window);
    const cancelAnimationFrame=window.cancelAnimationFrame?.bind(window);
  function scoreEquation(frame){
    const values=frame.matched.map(index=>frame.before[index]);
    const counts=new Map();for(const value of values)counts.set(value,(counts.get(value)||0)+1);
    const terms=values.length<=5?values.join(' + '):[...counts].map(([value,count])=>count===1?String(value):`${count} × ${value}`).join(' + ');
    return `${terms} = ${frame.scoreGain}`;
  }
  function clearScoreReceipt(){
    const receipt=$('score-receipt');if(receipt)receipt.textContent='';
    $('sum')?.closest('.hud-score')?.classList.remove('score-arrival');
  }
  function countScore(job,target,duration=motion.count){
    const from=job.scoreDisplay;
    if(job.controller.signal.aborted||getPresentation()!==job)return Promise.resolve();
    if(typeof requestAnimationFrame!=='function'){job.scoreDisplay=target;renderScore(target);return Promise.resolve();}
    return new Promise(resolve=>{
      const start=performance.now();let frame;
      const done=()=>{cancelAnimationFrame(frame);job.controller.signal.removeEventListener('abort',done);resolve();};
      const step=now=>{
        if(job.controller.signal.aborted||getPresentation()!==job){done();return;}
        const progress=Math.min(1,(now-start)/duration),value=Math.round(from+(target-from)*(1-Math.pow(1-progress,3)));
        job.scoreDisplay=value;renderScore(value);
        if(progress<1)frame=requestAnimationFrame(step);else done();
      };
      job.controller.signal.addEventListener('abort',done,{once:true});frame=requestAnimationFrame(step);
    });
  }
  async function flyScore(job,frame,{wave,gain,destination,extra=0,totalWaves=1,timing=motion}){
    const signal=job.controller.signal,nodes=new Set();
    const remove=()=>{for(const node of nodes)node.remove();};
    const current=()=>!signal.aborted&&getPresentation()===job&&canAnimate();
    try{
      if(!current())return;
      let layer=$('score-effects');
      if(!layer){layer=document.createElement('div');layer.id='score-effects';layer.setAttribute('aria-hidden','true');document.body.appendChild(layer);}
      const positions=geometry().positions,view=geometry(),board=$('board'),rect=board.getBoundingClientRect();
      const center=frame.matched.reduce((p,index)=>({x:p.x+positions[index].x/frame.matched.length,y:p.y+positions[index].y/frame.matched.length}),{x:0,y:0});
      let matrix;try{matrix=board.getScreenCTM();}catch(_){}
      const onScreen=position=>{
        try{const point=board.createSVGPoint();point.x=position.x;point.y=position.y;const mapped=point.matrixTransform(matrix);if(Number.isFinite(mapped.x)&&Number.isFinite(mapped.y))return mapped;}catch(_){}
        const scale=Math.min(rect.width/view.width,rect.height/view.height);
        return {x:rect.left+rect.width/2+position.x*scale,y:rect.top+rect.height/2+position.y*scale};
      };
      const origin=onScreen(center),viewportWidth=window.innerWidth||390,viewportHeight=Number(window.visualViewport?.height)||window.innerHeight||700;
      const target=$('sum').getBoundingClientRect(),hud=$('sum').closest('.hud-score'),hudRect=hud?.getBoundingClientRect();
      const end={x:target.width?target.left+target.width/2:64,y:target.height?target.top+target.height/2:64};
      const add=(className,point)=>{
        const node=document.createElement('div');node.className=className;node.style.left=point.x+'px';node.style.top=point.y+'px';node.style.translate='-50% -50%';nodes.add(node);layer.appendChild(node);return node;
      };
      const packet=add('score-packet',origin);packet.style.zIndex='2';packet.dataset.gain=String(gain);packet.dataset.wave=String(wave);packet.dataset.destinationScore=String(destination);packet.dataset.phase='collect';
      const waveCue=rewardForWave(job,wave),headline=rewardHeadline(job,wave);
      const cue=headline&&(!waveCue||headline.tier>waveCue.tier)?headline:waveCue;
      if(cue){packet.dataset.rewardTier=String(cue.tier);packet.dataset.rewardReason=cue.reason;packet.dataset.rewardWave=String(cue.wave);}
      if(headline)packet.dataset.rewardHeadline=headline.reason;
      const chain=document.createElement('span');chain.className='score-packet-chain';chain.textContent=headline?rewardLabel(headline):wave===1?'':extra?`${wave}–${totalWaves}. ZİNCİR`:`${wave}. ZİNCİR`;
      const amount=document.createElement('strong');amount.className='score-packet-gain';amount.textContent=`+${gain}`;packet.append(chain,amount);
      const packetRect=packet.getBoundingClientRect(),peakScale=Math.max(1,(cue?.scalePermille||1300)/1000)*1.08,halfWidth=(packetRect.width||120)*peakScale/2,halfHeight=(packetRect.height||70)*peakScale/2;
      const maxY=Math.max(halfHeight+12,viewportHeight-halfHeight-12),minY=Math.min(maxY,viewportWidth>viewportHeight?halfHeight+12:(hudRect?.bottom||80)+halfHeight+8);
      const start={x:Math.max(halfWidth+12,Math.min(viewportWidth-halfWidth-12,origin.x)),y:Math.max(minY,Math.min(maxY,origin.y))};
      packet.style.left=start.x+'px';packet.style.top=start.y+'px';amount.textContent='';amount.style.opacity='0';
      signal.addEventListener('abort',remove,{once:true});
      const sources=frame.matched.map(index=>({index,value:frame.before[index],point:onScreen(positions[index])}));
      if(extra)sources.push({index:null,value:extra,point:{x:start.x+35,y:Math.min(viewportHeight-24,start.y+42)}});
      const batches=new Map();
      for(const [order,source]of sources.entries()){
        const delay=sources.length>1?Math.round(order/(sources.length-1)*6)*(timing.spread/6):0,at=timing.digit+delay;
        const digit=add('score-digit'+(source.index===null?' score-digit-extra':''),source.point);digit.style.zIndex='3';digit.dataset.value=String(source.value);
        if(source.index===null){digit.dataset.source='chains';digit.textContent=`+${source.value}`;}
        else{digit.dataset.index=String(source.index);digit.textContent=String(source.value);const original=board.querySelector(`[data-index="${source.index}"] .hex-number`);if(original)original.style.opacity='0';}
        const dx=start.x-source.point.x,dy=start.y-source.point.y;
        animateElement(job,digit,[{transform:'translate(0px,0px) scale(1)',opacity:1},{transform:`translate(${dx*.25}px,${dy*.25-12}px) scale(1.2)`,opacity:1,offset:.3},{transform:`translate(${dx}px,${dy}px) scale(.5)`,opacity:0}],{duration:timing.digit,delay,easing:'cubic-bezier(.35,.02,.68,1)',fill:'both'});
        if(!batches.has(at))batches.set(at,[]);batches.get(at).push({value:source.value,digit});
      }
      let elapsed=0,collected=0;
      for(const [at,batch]of batches){
        await pause(at-elapsed,job);if(!current())return;elapsed=at;
        for(const source of batch){collected+=source.value;source.digit.remove();}
        amount.style.opacity='1';amount.textContent=`+${collected}`;packet.dataset.collected=String(collected);
        animateElement(job,amount,[{transform:'scale(.8)'},{transform:'scale(1.08)',offset:.45},{transform:'scale(1)'}],{duration:timing.collectPulse,easing:'ease-out'});
      }
      amount.textContent=`+${gain}`;packet.dataset.phase='pop';
      animateElement(job,packet,[{transform:'scale(.75)',opacity:1},{transform:`scale(${(cue?.scalePermille||1300)/1000})`,opacity:1,offset:.42},{transform:'scale(1)',opacity:1}],{duration:timing.pop,easing:'cubic-bezier(.2,.9,.35,1)',fill:'forwards'});
      rewardFeedback(job,cue);
      for(let n=0;n<(cue?.rings||1);n++){
        const ring=add('score-burst-ring',start);
        animateElement(job,ring,[{transform:`scale(${.3+n*.15})`,opacity:.95},{transform:`scale(${1.65+n*.4})`,opacity:0}],{duration:timing.pop+timing.hold,easing:'ease-out',fill:'forwards'});
      }
      const sparkCount=cue?.sparks??10;
      for(let i=0;i<sparkCount;i++){
        const spark=add('score-burst-spark',start),angle=i*Math.PI*2/sparkCount,distance=42+(i%3)*12+(cue?.tier||0)*4;
        animateElement(job,spark,[{transform:'translate(0px,0px) scale(1)',opacity:1},{transform:`translate(${Math.cos(angle)*distance}px,${Math.sin(angle)*distance}px) scale(.15) rotate(100deg)`,opacity:0}],{duration:timing.pop+timing.hold,easing:'ease-out',fill:'forwards'});
      }
      await pause(timing.pop+timing.hold,job);if(!current())return;
      packet.dataset.phase='fly';chain.style.opacity='0';const dx=end.x-start.x,dy=end.y-start.y;
      animateElement(job,packet,[{transform:'translate(0px,0px) scale(1)',opacity:1},{transform:`translate(${dx*.38-14}px,${dy*.6-16}px) scale(.8)`,opacity:1,offset:.6},{transform:`translate(${dx}px,${dy}px) scale(.18)`,opacity:0}],{duration:timing.flight,easing:'cubic-bezier(.3,.1,.5,1)',fill:'forwards'});
      await pause(timing.flight,job);if(!current())return;
      packet.dataset.phase='arrived';packet.dataset.arrived='true';hud?.classList.add('score-arrival');rewardMilestones(job,wave,'score');
      const receipt=$('score-receipt');if(receipt)receipt.textContent=`+${gain}`;
      animateElement(job,hud,[{transform:'scale(1)'},{transform:'scale(1.065)',offset:.4},{transform:'scale(1)'}],{duration:timing.arrival,easing:'ease-out'});
      await countScore(job,destination,timing.count);
    }finally{signal.removeEventListener('abort',remove);remove();}
  }

    return Object.freeze({scoreEquation,clearScoreReceipt,countScore,flyScore});
  }
  const api=Object.freeze({create});root.HexScorePresentation=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
