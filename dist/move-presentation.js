/* Resolved-move visual sequencing only. No game, reward or save authority. */
(function(root){
 'use strict';
 const PHASES=Object.freeze(['SWAP','MATCH','CLEAR','FALL','REFILL','CASCADE','SETTLE']);
 const OBSTACLE_PHASES=Object.freeze(['SWAP','MATCH','BLOCKER_HIT','BLOCKER_BREAK','REGION_UNLOCK','CLEAR','FALL','REFILL','CASCADE','SETTLE']);
 const durations=['digit','spread','collectPulse','pop','hold','flight','count','arrival','burst','ring','particle','matchPause','fall','fallStagger','columnDelay'];
 const integer=value=>Number.isSafeInteger(value)&&value>=0;
 function invalid(message){throw new TypeError(message);}
 function copy(value,seen=new Set()){
  if(value===null||['string','boolean'].includes(typeof value))return value;
  if(typeof value==='number'){if(!Number.isFinite(value))invalid('invalid_visual_number');return value;}
  if(!value||typeof value!=='object'||seen.has(value))invalid('invalid_visual_data');
  const proto=Object.getPrototypeOf(value);
  if(!Array.isArray(value)&&proto!==null&&Object.getPrototypeOf(proto)!==null)invalid('invalid_visual_record');
  seen.add(value);const result=Array.isArray(value)?[]:{};
  for(const key of Reflect.ownKeys(value)){
   if(Array.isArray(value)&&key==='length')continue;
   const descriptor=Object.getOwnPropertyDescriptor(value,key);
   if(typeof key!=='string'||!Object.prototype.hasOwnProperty.call(descriptor,'value')||key==='__proto__')invalid('invalid_visual_property');
   Object.defineProperty(result,key,{value:copy(descriptor.value,seen),enumerable:true,writable:true,configurable:true});
  }
  seen.delete(value);return result;
 }
 function freeze(value){if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}
 function projection(value,count){
  const obstacles=value?.obstacleVersion==='obstacles-v1'&&Array.isArray(value.blockerHp)&&value.blockerHp.every(integer)&&Array.isArray(value.regionOpen)&&value.regionOpen.every(n=>typeof n==='boolean')&&(value.cellOpen===undefined||Array.isArray(value.cellOpen)&&value.cellOpen.length===value.values?.length&&value.cellOpen.every(n=>typeof n==='boolean'));
  if(!value||!Array.isArray(value.values)||!value.values.length||count!==undefined&&value.values.length!==count||!Array.isArray(value.layers)||value.layers.length!==value.values.length||!value.values.every(n=>obstacles&&n===null||Number.isSafeInteger(n)&&n>0)||!value.layers.every(integer)||!integer(value.score)||!integer(value.movesLeft))invalid('invalid_visual_projection');
 }
 function scoreDuration(motion){return motion.digit+motion.spread+motion.pop+motion.hold+motion.flight+motion.count;}
 function plan(input){
  const data=copy(input),{before,final,frames,swap=null,assistance=null,motion}=data;
  projection(before);const count=before.values.length;projection(final,count);
  if(!Array.isArray(frames)||!motion||!durations.every(key=>typeof motion[key]==='number'&&motion[key]>=0)||!Number.isFinite(motion.swap)||motion.swap<0||!Number.isFinite(motion.budget)||motion.budget<=0)invalid('invalid_visual_plan');
  const index=value=>integer(value)&&value<count;
  if(swap!==null&&(!Array.isArray(swap)||swap.length!==2||!swap.every(index)||swap[0]===swap[1]))invalid('invalid_visual_swap');
  if(assistance!==null&&(!['greenBrush','colorKey'].includes(assistance.itemId)||!index(assistance.index)))invalid('invalid_visual_assistance');
  let score=before.score,layers=before.layers;
  let obstacleState=before.obstacleVersion==='obstacles-v1'?{obstacleVersion:before.obstacleVersion,blockerHp:before.blockerHp,regionOpen:before.regionOpen,...(before.cellOpen?{cellOpen:before.cellOpen}:{})}:null;
  const scale=frames.length<=2?1:Math.min(1,Math.max(1,motion.budget-motion.swap-5-200)/Math.max(1,frames.length*scoreDuration(motion)));
  const paced={...motion};
  if(scale<1){for(const key of durations)paced[key]=motion[key]*scale;paced.fall=Math.max(280,paced.fall);}
  const waves=frames.map((frame,offset)=>{
   if(!frame||!Array.isArray(frame.matched)||!frame.matched.length||!frame.matched.every(index)||new Set(frame.matched).size!==frame.matched.length||!integer(frame.scoreGain)||!Array.isArray(frame.falls))invalid('invalid_visual_frame');
   const nextObstacleState=obstacleState?{obstacleVersion:'obstacles-v1',blockerHp:frame.blockerHp,regionOpen:frame.regionOpen,...(obstacleState.cellOpen?{cellOpen:frame.cellOpen}:{})}:null;
   projection({values:frame.before,layers,score,movesLeft:final.movesLeft,...obstacleState},count);
   projection({values:frame.after,layers:frame.layers,score:score+frame.scoreGain,movesLeft:final.movesLeft,...nextObstacleState},count);
   if(!frame.falls.every(fall=>fall&&index(fall.to)&&typeof fall.spawn==='boolean'&&(fall.spawn?fall.from===null:index(fall.from))))invalid('invalid_visual_fall');
   const wave={wave:offset+1,frame,before:{values:frame.before,layers,score,movesLeft:final.movesLeft,...obstacleState},after:{values:frame.after,layers:frame.layers,score:score+frame.scoreGain,movesLeft:final.movesLeft,...nextObstacleState},motion:{...paced},firstMoves:offset===0&&swap?[[swap[0],swap[1]],[swap[1],swap[0]]]:[]};
   score+=frame.scoreGain;layers=frame.layers;obstacleState=nextObstacleState;return wave;
  });
  const start=assistance?180:swap?motion.swap+5:0;
  const waveBudget=Math.max(scoreDuration(paced),paced.matchPause+paced.fall+paced.fallStagger+10);
  // Rendering and frame-quantized score counting also consume wall time.
  // This is watchdog slack, never an added visual wait or a gameplay timer.
  const budget=Math.max(motion.budget,start+frames.length*(waveBudget+100)+250);
  return freeze({before,final,waves,swap,assistance,motion,scale,budget});
 }
 async function play({plan,attemptId,token,signal,isCurrent,canAnimate,adapters,onPhase}={}){
  let phase=null,wave=null,wavesPresented=0,aborted=false,abortListener;
  const cancelled=()=>{try{return aborted||!!signal?.aborted||typeof isCurrent!=='function'||!isCurrent(attemptId,token);}catch(_){return true;}};
  const result=(status,error)=>{let message;if(error)try{message=String(error.message||error);}catch(_){message='visual_adapter_failed';}return Object.freeze({status,phase,wavesPresented,...(message?{error:message}:{})});};
  const stopped={};
  const interruption=new Promise(resolve=>{abortListener=()=>{aborted=true;resolve(stopped);};if(signal?.aborted)abortListener();else if(typeof signal?.addEventListener==='function')signal.addEventListener('abort',abortListener,{once:true});});
  const current=()=>{if(cancelled())throw stopped;};
  const wait=async value=>{const outcome=await Promise.race([Promise.resolve(value),interruption]);current();if(outcome===stopped)throw stopped;return outcome;};
  const emit=next=>{current();phase=next;if(typeof onPhase==='function')onPhase(Object.freeze({phase,wave,attemptId,token}));current();};
  try{
   current();
   if(!plan||!Array.isArray(plan.waves)||typeof attemptId!=='string'||!attemptId||!adapters||typeof canAnimate!=='function')invalid('invalid_visual_play');
   if(canAnimate()){
    if(plan.swap||plan.assistance){emit('SWAP');await wait(adapters.swap(plan));}
    for(const item of plan.waves){
     current();if(!canAnimate())break;wave=item.wave;
     if(wave>1)emit('CASCADE');
     emit('MATCH');await wait(adapters.match(item));
     if(item.frame.blockerHits?.length){emit('BLOCKER_HIT');await wait(adapters.blockerHit?.(item));}
     if(item.frame.brokenBlockers?.length){emit('BLOCKER_BREAK');await wait(adapters.blockerBreak?.(item));}
     if(item.frame.openedRegions?.length||item.frame.openedCells?.length){emit('REGION_UNLOCK');await wait(adapters.regionUnlock?.(item));}
     emit('CLEAR');
     // Observe a rejection immediately while its score flight overlaps the
     // board clear/fall. Await it later; no unhandled decorative rejection.
     let scoreError,scoreFailed=false;const score=Promise.resolve(adapters.clear(item)).catch(error=>{scoreFailed=true;scoreError=error;});
     await wait(adapters.pause(item.motion.matchPause));
     if(scoreFailed)throw scoreError||new Error('score_presentation_failed');
     emit('FALL');const fall=await wait(adapters.fall(item));
     emit('REFILL');const refill=await wait(adapters.refill(item));
     const longest=Math.max(Number(fall)||0,Number(refill)||0);
     await wait(Promise.all([adapters.pause(longest+10),score]));
     if(scoreFailed)throw scoreError||new Error('score_presentation_failed');
     wavesPresented++;
    }
   }
   wave=null;emit('SETTLE');await wait(adapters.settle(plan));
   return result('succeeded');
  }catch(error){return error===stopped||cancelled()?result('cancelled'):result('failed',error);}
  finally{try{signal?.removeEventListener?.('abort',abortListener);}catch(_){}}
 }
 const api=Object.freeze({PHASES,OBSTACLE_PHASES,plan,play});root.HexMovePresentation=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
