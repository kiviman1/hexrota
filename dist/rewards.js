/* Versioned, deterministic reward feedback. Never changes game score or RNG. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.HexRewards=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const MAX=2147483647;
  const priorities={match:0,green:10,doubles:15,simultaneous:20,long_run:30,chain:40,cross:50,score_goal:80,ground_goal:81,win:100,last_move_win:100};
  function integer(value,min=0,max=MAX){if(!Number.isInteger(value)||value<min||value>max)throw new Error('Reward integer out of range');return value;}
  function attempt(value){if(typeof value!=='string'||value.length<1||value.length>128)throw new Error('Invalid reward attempt');}
  function thresholds(values,min,length){
    if(!Array.isArray(values)||(length?values.length!==length:values.length<1||values.length>30))throw new Error('Invalid reward thresholds');
    for(let i=0;i<values.length;i++){integer(values[i],min,length?MAX:100);if(i&&values[i]<=values[i-1])throw new Error('Reward thresholds must increase');}
    if(!length&&values.at(-1)!==100)throw new Error('Reward milestones must include completion');
  }
  function validateRules(r){
    if(!r||r.version!==1)throw new Error('Unsupported reward rules');
    integer(r.accentGapTurns,1,100);thresholds(r.runThresholds,4,3);thresholds(r.chainThresholds,2,3);
    for(const field of ['crossTier','crossThreeTier','simultaneousTier','doublesTier','goalTier','winTier'])integer(r[field],1,3);
    if(r.crossThreeTier<r.crossTier)throw new Error('Invalid cross tiers');
    integer(r.tutorialCap,0,2);integer(r.groundMin,1,4096);integer(r.groundPercent,1,100);integer(r.doublesMin,1,4096);
    thresholds(r.scoreMilestones,1);thresholds(r.groundMilestones,1);
    if(!Array.isArray(r.tiers)||r.tiers.length!==4)throw new Error('Four feedback tiers required');
    for(const t of r.tiers){if(!t)throw new Error('Invalid feedback tier');integer(t.scalePermille,1000,2000);integer(t.sparks,0,24);integer(t.rings,1,3);integer(t.pitchStep,0,12);integer(t.hapticMs,0,60);}
  }
  function createState(attemptId){attempt(attemptId);return {version:1,attemptId,lastTurn:0,lastScore:0,lastGreen:0,lastAccentTurn:-3,scoreMask:0,groundMask:0};}
  function copyState(s){return {version:s.version,attemptId:s.attemptId,lastTurn:s.lastTurn,lastScore:s.lastScore,lastGreen:s.lastGreen,lastAccentTurn:s.lastAccentTurn,scoreMask:s.scoreMask,groundMask:s.groundMask};}
  function validateState(s,r){
    if(!s||s.version!==1)throw new Error('Unsupported reward state');attempt(s.attemptId);
    integer(s.lastTurn);integer(s.lastScore);integer(s.lastGreen,0,4096);integer(s.lastAccentTurn,-3,s.lastTurn);
    integer(s.scoreMask,0,2**r.scoreMilestones.length-1);integer(s.groundMask,0,2**r.groundMilestones.length-1);
  }
  function emptyPlan(duplicate=false){return {version:1,duplicate,waves:[],headline:null,milestones:[]};}
  function validateInput(input,s){
    integer(input.totalCells,1,4096);integer(input.target,1);integer(input.scoreBefore);integer(input.scoreAfter);integer(input.greenBefore,0,input.totalCells);integer(input.greenAfter,0,input.totalCells);integer(input.movesLeft);
    if(typeof input.tutorial!=='boolean'||!['playing','won','lost'].includes(input.status))throw new Error('Invalid reward move state');
    if(input.turn!==s.lastTurn+1||input.scoreBefore!==s.lastScore||input.greenBefore!==s.lastGreen)throw new Error('Reward move continuity mismatch');
    if(!Array.isArray(input.waves)||input.waves.length<1||input.waves.length>32)throw new Error('Invalid reward waves');
    let score=input.scoreBefore,green=input.greenBefore;
    for(let i=0;i<input.waves.length;i++){
      const w=input.waves[i];if(!w||w.wave!==i+1)throw new Error('Invalid reward wave order');
      integer(w.gain,1);integer(w.matched,3,input.totalCells);integer(w.maxRun,3,w.matched);integer(w.runCount,1,w.matched);integer(w.crossAxes,0,3);integer(w.newGreen,0,w.matched);integer(w.layersCleared,w.newGreen,w.matched);integer(w.doubleCleared,0,w.newGreen);integer(w.scoreAfter);integer(w.greenAfter,0,input.totalCells);
      score+=w.gain;green+=w.newGreen;
      if(score!==w.scoreAfter||green!==w.greenAfter)throw new Error('Reward wave total mismatch');
    }
    if(score!==input.scoreAfter||green!==input.greenAfter)throw new Error('Reward move total mismatch');
    if(input.status==='won'&&(score<input.target||green!==input.totalCells))throw new Error('Reward victory needs both goals');
  }
  function thresholdTier(value,values){let tier=0;for(let i=0;i<values.length;i++)if(value>=values[i])tier=i+1;return tier;}
  function stronger(a,b){return !b||a.rawTier>b.rawTier||(a.rawTier===b.rawTier&&priorities[a.reason]>priorities[b.reason]);}
  function evaluate(input,state,rules){
    validateRules(rules);validateState(state,rules);
    if(!input||typeof input!=='object')throw new Error('Invalid reward move');attempt(input.attemptId);integer(input.turn,1);
    if(input.attemptId!==state.attemptId)throw new Error('Reward attempt mismatch');
    const nextState=copyState(state),plan=emptyPlan(input.turn<=state.lastTurn);
    if(plan.duplicate)return {nextState,plan};
    validateInput(input,state);
    const prefix=input.attemptId+':'+input.turn;
    const epicAllowed=input.turn-state.lastAccentTurn>=rules.accentGapTurns;
    const cue=(reason,value,rawTier,wave,completion=false,forcedTier=null)=>{
      let tier=rawTier;
      if(forcedTier!==null)tier=forcedTier;
      else{if(input.tutorial)tier=Math.min(tier,rules.tutorialCap);if(rawTier===3&&!epicAllowed)tier=Math.min(tier,2);}
      const t=rules.tiers[tier];
      return {id:prefix+':wave:'+wave,wave,reason,labelKey:reason==='match'?'':reason,tier,rawTier,value,scalePermille:t.scalePermille,sparks:t.sparks,rings:t.rings,pitchStep:t.pitchStep,hapticMs:t.hapticMs,completion};
    };
    let ordinary=null,scoreBefore=input.scoreBefore,greenBefore=input.greenBefore,scoreMilestone=null,groundMilestone=null;
    for(const w of input.waves){
      let best={reason:'match',rawTier:0,value:w.matched};
      const offer=(reason,rawTier,value)=>{const candidate={reason,rawTier,value};if(rawTier>0&&stronger(candidate,best))best=candidate;};
      offer('long_run',thresholdTier(w.maxRun,rules.runThresholds),w.maxRun);
      offer('chain',thresholdTier(w.wave,rules.chainThresholds),w.wave);
      if(w.crossAxes>=2)offer('cross',w.crossAxes>=3?rules.crossThreeTier:rules.crossTier,w.crossAxes);
      if(w.runCount>=2)offer('simultaneous',rules.simultaneousTier,w.runCount);
      if(w.newGreen>=rules.groundMin&&w.newGreen*100>=input.totalCells*rules.groundPercent)offer('green',1,w.newGreen);
      if(w.doubleCleared>=rules.doublesMin)offer('doubles',rules.doublesTier,w.doubleCleared);
      const waveCue=cue(best.reason,best.value,best.rawTier,w.wave);plan.waves.push(waveCue);
      if(waveCue.rawTier>0&&stronger(waveCue,ordinary))ordinary=waveCue;
      for(let i=0;i<rules.scoreMilestones.length;i++){
        const p=rules.scoreMilestones[i],bit=1<<i;
        if(!(nextState.scoreMask&bit)&&scoreBefore*100<input.target*p&&w.scoreAfter*100>=input.target*p){
          nextState.scoreMask|=bit;scoreMilestone={id:prefix+':milestone:score:'+p,wave:w.wave,kind:'score',percent:p,tier:p===100?2:1};
        }
      }
      for(let i=0;i<rules.groundMilestones.length;i++){
        const p=rules.groundMilestones[i],bit=1<<i;
        if(!(nextState.groundMask&bit)&&greenBefore*100<input.totalCells*p&&w.greenAfter*100>=input.totalCells*p){
          nextState.groundMask|=bit;groundMilestone={id:prefix+':milestone:ground:'+p,wave:w.wave,kind:'ground',percent:p,tier:p===100?2:p>=50?1:0};
        }
      }
      scoreBefore=w.scoreAfter;greenBefore=w.greenAfter;
    }
    if(scoreMilestone)plan.milestones.push(scoreMilestone);if(groundMilestone)plan.milestones.push(groundMilestone);
    plan.headline=ordinary?{...ordinary,id:prefix+':headline'}:null;
    if(scoreMilestone?.percent===100)plan.headline=cue('score_goal',100,rules.goalTier,scoreMilestone.wave,false,rules.goalTier);
    if(groundMilestone?.percent===100)plan.headline=cue('ground_goal',100,rules.goalTier,groundMilestone.wave,false,rules.goalTier);
    if(input.status==='won')plan.headline=cue(input.movesLeft===0?'last_move_win':'win',input.movesLeft,rules.winTier,input.waves.length,true,rules.winTier);
    if(plan.headline)plan.headline.id=prefix+':headline';
    if(plan.waves.some(w=>w.tier===3)||plan.headline?.tier===3)nextState.lastAccentTurn=input.turn;
    nextState.lastTurn=input.turn;nextState.lastScore=input.scoreAfter;nextState.lastGreen=input.greenAfter;
    return {nextState,plan};
  }
  return {createState,evaluate,validateRules};
});
