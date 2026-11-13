/* Shared deterministic vectors for the browser director and its C# port. */
const fs=require('node:fs'),vm=require('node:vm');
const rewards=require('./dist/rewards.js'),rules=JSON.parse(fs.readFileSync(__dirname+'/dist/reward-rules.json','utf8'));
const plain=value=>JSON.parse(JSON.stringify(value)),cases=[];
function add(name,input,state,error=false){
 const entry={name,input:plain(input),state:plain(state)};
 if(error){let rejected=false;try{rewards.evaluate(input,state,rules);}catch(_){rejected=true;}if(!rejected)throw new Error('Invalid vector was accepted: '+name);entry.error=true;}
 else entry.expected=rewards.evaluate(input,state,rules);
 cases.push(entry);
}
function move(name,features,options={}){
 const state={...rewards.createState(name),...options.state},totalCells=options.totalCells||19;
 let score=state.lastScore,green=state.lastGreen;
 const waves=features.map((feature,index)=>{
  const w={wave:index+1,gain:9,matched:3,maxRun:3,runCount:1,crossAxes:1,newGreen:3,layersCleared:3,doubleCleared:0,...feature};
  score+=w.gain;green+=w.newGreen;return {...w,scoreAfter:score,greenAfter:green};
 });
 const input={attemptId:name,turn:state.lastTurn+1,tutorial:false,totalCells,target:1000,scoreBefore:state.lastScore,scoreAfter:score,greenBefore:state.lastGreen,greenAfter:green,movesLeft:6,status:'playing',...options.input,waves};
 add(name,input,state);return {input,state};
}
const ordinary=move('ordinary',[{}]);
move('long-four',[{gain:8,matched:4,maxRun:4,newGreen:4,layersCleared:4}]);
move('long-five',[{gain:15,matched:5,maxRun:5,newGreen:5,layersCleared:5}]);
move('long-six',[{gain:18,matched:6,maxRun:6,newGreen:6,layersCleared:6}]);
move('separate-triples',[{gain:12,matched:6,maxRun:3,runCount:2,newGreen:6,layersCleared:6}]);
move('cross-two-axes',[{gain:15,matched:5,maxRun:3,runCount:2,crossAxes:2,newGreen:5,layersCleared:5}]);
move('cross-three-axes',[{gain:21,matched:7,maxRun:3,runCount:3,crossAxes:3,newGreen:7,layersCleared:7}]);
for(const count of [2,3,4,5,7])move('chain-'+count,Array.from({length:count},()=>({})),{totalCells:37});
move('double-layer-finish',[{doubleCleared:2}]);
move('tutorial-epic-cap',[{gain:18,matched:6,maxRun:6,newGreen:6,layersCleared:6}],{input:{tutorial:true}});
move('epic-on-cooldown',[{gain:18,matched:6,maxRun:6,newGreen:6,layersCleared:6}],{state:{lastTurn:1,lastScore:18,lastGreen:6,lastAccentTurn:1,groundMask:1}});
move('epic-eligible-again',[{gain:18,matched:6,maxRun:6,newGreen:0,layersCleared:0}],{state:{lastTurn:3,lastScore:54,lastGreen:12,lastAccentTurn:1,groundMask:3}});
move('score-goal-over-cross',[{gain:21,matched:7,maxRun:3,runCount:3,crossAxes:3,newGreen:7,layersCleared:7}],{input:{target:20}});
move('ground-goal-over-epic',[{gain:57,matched:19,maxRun:5,runCount:5,crossAxes:3,newGreen:19,layersCleared:19}]);
move('simultaneous-goals-win',[{gain:57,matched:19,maxRun:5,runCount:5,crossAxes:3,newGreen:19,layersCleared:19}],{input:{target:40,status:'won',movesLeft:2}});
move('last-move-win',[{gain:57,matched:19,maxRun:5,runCount:5,crossAxes:3,newGreen:19,layersCleared:19}],{input:{target:40,status:'won',movesLeft:0}});
const processed=rewards.evaluate(ordinary.input,ordinary.state,rules).nextState;
add('duplicate-turn',{attemptId:processed.attemptId,turn:1},processed);
add('stale-turn',{attemptId:processed.attemptId,turn:1},{...processed,lastTurn:2});
const missingStateVersion=plain(ordinary.state);delete missingStateVersion.version;
add('missing-state-version-rejected',ordinary.input,missingStateVersion,true);
const missingTutorial=plain(ordinary.input);delete missingTutorial.tutorial;
add('missing-tutorial-rejected',missingTutorial,ordinary.state,true);
const missingScoreBefore=plain(ordinary.input);delete missingScoreBefore.scoreBefore;
add('missing-zero-score-before-rejected',missingScoreBefore,ordinary.state,true);
add('duplicate-ignores-unused-waves',{attemptId:processed.attemptId,turn:1,waves:'unused'},processed);
add('gap-rejected',{...ordinary.input,turn:3},ordinary.state,true);
add('wrong-attempt-rejected',{...ordinary.input,attemptId:'other'},ordinary.state,true);
add('inconsistent-totals-rejected',{...ordinary.input,scoreAfter:99},ordinary.state,true);
add('false-victory-rejected',{...ordinary.input,status:'won'},ordinary.state,true);
const context={window:{},performance};vm.createContext(context);
for(const name of ['engine.js','levels.js','tutorials.js','reward-adapter.js'])vm.runInContext(fs.readFileSync(__dirname+'/dist/'+name,'utf8'),context);
const {HexMatch,HexRewardAdapter,HEX_LEVELS,HEX_TUTORIALS}=context.window;
for(const level of [...HEX_TUTORIALS,...HEX_LEVELS]){
 const attemptId='authored-'+level.id,game=new HexMatch(level);let state=rewards.createState(attemptId);
 for(const [step,pair]of level.solution.entries()){
  const before=game.snapshot(),result=game.swap(...pair),input=plain(HexRewardAdapter.summarize(level,before,result,game,attemptId));
  add(attemptId+'-'+(step+1),input,state);state=rewards.evaluate(input,state,rules).nextState;
 }
}
const output=JSON.stringify({rules,cases},null,2)+'\n',target=__dirname+'/fixtures/reward-vectors.json';
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==output)throw new Error('Reward vectors are stale');}
else fs.writeFileSync(target,output);
console.log(cases.length+' shared reward vectors verified.');
