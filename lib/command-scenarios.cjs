'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),plain=value=>JSON.parse(JSON.stringify(value));
function createRuntime(){
 const context={window:{}};vm.createContext(context);
 for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js','commands.js'])vm.runInContext(fs.readFileSync(path.join(root,'dist',file),'utf8'),context,{filename:file});
 const W=context.window;return {W,Engine:W.HexMatch,Game:W.HexAssistedGame,catalog:W.HexAttempts.createCatalog(W.HEX_LEVELS,W.HEX_VARIANTS,W.HexMatch)};
}
function execute(runtime,request){
 const {Game}=runtime;
 try{
  let game=new Game(request.level,{attemptId:request.attemptId,...(request.limits===undefined?{}:{limits:request.limits})},request.snapshot);
  const observed=()=>plain({snapshot:game.snapshot(),status:game.status,covered:game.covered,remainingLayers:game.remainingLayers}),initial=observed(),steps=[];
  for(const step of request.steps){
   const before=plain(game.snapshot());let output;
   if(step.op==='apply')output=game.apply(step.command);
   else if(step.op==='preview'){output=game.preview(step.command);assert.deepEqual(plain(game.snapshot()),before,'preview is pure');}
   else if(step.op==='resume'){
    try{game=new Game(request.level,{attemptId:step.attemptId??request.attemptId,...(step.limits===undefined?{}:{limits:step.limits})},step.snapshot??game.snapshot());output={restored:true};}catch(error){output={error:true};}
   }else if(step.op==='clone'){const copy=game.clone();output={result:copy.apply(step.command),copy:{snapshot:copy.snapshot(),status:copy.status,covered:copy.covered,remainingLayers:copy.remainingLayers}};assert.deepEqual(plain(game.snapshot()),before,'clone is independent');}
   else if(step.op==='classic'){try{output=game.classicSnapshot();}catch(error){output={error:true};}}
   else throw Error('Unknown command test operation');
   steps.push({result:plain(output),after:observed()});
  }
  return {initial,steps};
 }catch(error){if(error instanceof assert.AssertionError)throw error;return {error:true};}
}
function buildSuite(){
 const runtime=createRuntime(),{W,Engine,Game,catalog}=runtime,levels={},cases=[],counts={certifiedRoutes:0,legacyPrefixes:0,colorChanges:0,brushTargets:0,malformedCases:0,rescueCases:0};
 const add=(name,key,steps,extra={})=>cases.push({name,level:key,attemptId:'command-test:'+key,steps,...extra});
 const apply=command=>({op:'apply',command}),brush=(id,index)=>({id,type:'green_brush',index}),key=(id,index,value)=>({id,type:'color_key',index,value});
 const published=[];
 for(const group of W.HEX_VARIANTS.levels)for(const variant of group.variants){
  const name='L'+group.levelId+'-'+variant.id,level=plain(catalog.resolveLevel(group.levelId,variant.id,W.HEX_VARIANTS.levelDataVersion));levels[name]=level;published.push(name);
  for(const [ri,route]of variant.solutions.entries()){
   const core=new Engine(level),steps=[];
   for(const [index,pair]of route.entries()){
    steps.push(apply({id:'swap:'+index,type:'swap',a:pair[0],b:pair[1]}));
    if(index===0)steps.push({op:'resume'});assert(core.swap(...pair).ok);
   }
   assert.equal(core.status,'won');steps.push({op:'classic'});add('certified-'+name+'-'+ri,name,steps);counts.certifiedRoutes++;
   const prefix=new Engine(level);
   for(let turn=0;turn<=route.length;turn++){
    add('legacy-'+name+'-'+ri+'-'+turn,name,[{op:'classic'},{op:'resume'},...(turn<route.length?[apply(brush('legacy-brush',prefix.layers.findIndex(x=>x>0)))]:[])],{snapshot:plain(prefix.snapshot())});counts.legacyPrefixes++;
    if(turn<route.length)assert(prefix.swap(...route[turn]).ok);
   }
  }
  for(let index=0;index<level.cells.length;index++){
   const chosen=level.palette.find(value=>value!==level.initial[index]),command=key('key:'+index,index,chosen);
   add('key-'+name+'-'+index,name,[{op:'preview',command},apply(command),{op:'resume'},apply(command),apply(key('key:limit',index,level.initial[index])),{op:'classic'}]);counts.colorChanges++;
   const brushCommand=brush('brush:'+index,index);
   add('brush-'+name+'-'+index,name,[{op:'preview',command:brushCommand},apply(brushCommand),{op:'resume'},apply(brushCommand),apply(brush('brush:limit',index)),{op:'classic'}]);counts.brushTargets++;
  }
  // Actual legal choices only; no injected RNG, moves or layers create a loss.
  const loss=new Game(level,{attemptId:'command-test:'+name}),lossSteps=[];
  while(loss.status==='playing'){
   const choices=loss.legalMoves(),pair=choices[choices.length-1];assert(pair);
   const command={id:'loss-swap:'+loss.turn,type:'swap',a:pair[0],b:pair[1]};assert(loss.apply(command).ok);lossSteps.push(apply(command));
  }
  if(loss.status==='lost'){
   const command={id:'rescue:1',type:'grant_moves',moves:5};lossSteps.push({op:'preview',command},apply(command),{op:'resume'},apply(command));assert(loss.apply(command).ok);
   while(loss.status==='playing'){
    const choices=loss.legalMoves(),pair=choices[choices.length-1];const move={id:'second-loss:'+loss.turn,type:'swap',a:pair[0],b:pair[1]};assert(loss.apply(move).ok);lossSteps.push(apply(move));
   }
   lossSteps.push(apply({id:'rescue:2',type:'grant_moves',moves:5}),{op:'resume'});add('rescue-'+name,name,lossSteps);counts.rescueCases++;
  }
 }
 for(const level of W.HEX_TUTORIALS){const name=level.id;levels[name]=plain(level);add('tutorial-classic-'+name,name,level.solution.map((pair,index)=>apply({id:'t:'+index,type:'swap',a:pair[0],b:pair[1]})).concat({op:'classic'}));}
 levels['brush-win']={id:'brush-win',cells:[{q:0,r:0,layers:1}],initial:[1],palette:[1,2],seed:123,moves:1,target:0};
 add('brush-wins-without-points','brush-win',[apply(brush('last-layer',0)),{op:'resume'},apply(brush('post-win',0))]);
 levels['key-win']={id:'key-win',cells:[{q:0,r:0,layers:1},{q:0,r:1,layers:1},{q:0,r:2,layers:1}],initial:[1,1,2],palette:[1,2,3],seed:123,moves:1,target:3};
 add('key-wins-with-real-match','key-win',[{op:'preview',command:key('key-win',2,1)},apply(key('key-win',2,1)),{op:'resume'},apply({id:'no-rescue',type:'grant_moves',moves:5})]);
 const sample=published[0],level=levels[sample],game=new Game(level,{attemptId:'command-test:'+sample});
 const command=brush('good:brush',0);assert(game.apply(command).ok);const snapshot=plain(game.snapshot());
 const malformed=[null,[],{}, {id:'x',type:'unknown'},brush('__proto__',0),brush('constructor',0),brush('prototype',0),brush('line\n',0),brush('line\r',0),brush('x'.repeat(181),0),brush('',0),brush('x',-1),brush('x','1'),brush('x',0.5),{...brush('x',0),extra:1},key('x',0,999),key('x',0,String(level.palette[0])),key('x',0,level.initial[0]),{id:'x',type:'grant_moves',moves:3},{id:'x',type:'grant_moves',moves:'5'},{id:'x',type:'swap',a:0,b:0}];
 for(const [i,bad]of malformed.entries()){add('invalid-command-'+i,sample,[apply(bad),{op:'resume'}]);counts.malformedCases++;}
 add('id-conflict',sample,[apply(command),apply(key('good:brush',0,level.palette.find(v=>v!==level.initial[0]))),{op:'resume'},apply(command),{op:'clone',command:key('clone-key',0,level.palette.find(v=>v!==level.initial[0]))}]);
 add('zero-caps',sample,[apply(command),apply(key('disabled-key',0,level.palette.find(v=>v!==level.initial[0])))],{limits:{greenBrush:0,colorKey:0,rescue:1}});
 add('custom-caps-resume',sample,[apply(command),apply(brush('brush2',1)),{op:'resume'}],{limits:{greenBrush:2,colorKey:2,rescue:1}});
 for(const field of Object.keys(snapshot)){
  const bad=plain(snapshot);delete bad[field];add('missing-'+field,sample,[],{snapshot:bad});counts.malformedCases++;
 }
 for(const [field,value]of [['version',2],['commandsVersion',2],['baseRulesVersion','future'],['levelId',String(level.id)],['attemptId','wrong'],['assisted',false],['score',snapshot.score+1],['movesLeft',snapshot.movesLeft+1],['rngState',1],['usage',{greenBrush:0,colorKey:0,rescue:0}],['bonusMoves',5],['history',[[0,0]]],['layers',snapshot.layers.map(()=>0)],['values',snapshot.values.map(()=>1)],['commands',[command,command]],['limits',{greenBrush:1,colorKey:1,rescue:2}]]){
  add('forged-'+field,sample,[],{snapshot:{...snapshot,[field]:value}});counts.malformedCases++;
 }
 add('unknown-checkpoint-field',sample,[],{snapshot:{...snapshot,extra:true}});counts.malformedCases++;
 add('resume-rejections-preserve-live',sample,[apply(command),{op:'resume',attemptId:'wrong'},{op:'resume',snapshot:{...snapshot,score:1}},{op:'resume',limits:{greenBrush:0,colorKey:1,rescue:1}},{op:'resume'}]);
 assert.equal(counts.certifiedRoutes,80);assert.equal(published.length,40);
 const requests=cases.map(({name,level,...entry})=>({...entry,level:levels[level]})),expected=requests.map(request=>execute(runtime,request));
 const digest=crypto.createHash('sha256').update(JSON.stringify(expected)).digest('hex');
 return {runtime,requests,expected,fixture:plain({schemaVersion:1,contract:'assisted-v1/commands-v1',publishedVariantCount:40,counts,expectedSha256:digest,levels,cases})};
}
module.exports={createRuntime,execute,buildSuite,plain};
