/* Pure read-only projections. No DOM or alternative gameplay authority. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const S=require('./dist/state-selectors.js'),Core=require('./dist/app-state.js');
const tests=[],test=(name,run)=>tests.push({name,run}),clone=value=>JSON.parse(JSON.stringify(value));
function state({screen='game',modals=[],hidden=false,suspended=false,operation=null,status='pending',kind='presentation',generation=0}={}){
  const value=clone(Core.initialState());value.navigation.screen=screen;value.lifecycle={hidden,suspended};
  value.overlays.modals=modals.map((id,index)=>({id,instance:index+1}));value.overlays.serial=modals.length;
  value.operations.generation=generation;
  if(operation!==null){value.operations.serial=1;value.operations[kind]={token:{kind,id:1,attemptId:operation,generation},status};}
  return value;
}
function facts(patch={}){
  return {attemptReady:true,canOpen:true,writeBlocked:false,lifeDiscarded:false,resetPending:false,
    engineStatus:'playing',tutorial:true,levelId:'learn-1',activeIndex:0,tutorialCount:2,attemptId:'t-learn-1-1',turn:0,
    feedback:false,firstOpening:false,portraitAvailable:true,coachVisible:true,reducedMotion:false,lessonPair:[4,3],
    nativeModalOpen:false,nativeModalId:null,committedGame:{current:0,done:[],boards:{},attempts:{}},...patch};
}
const campaign=patch=>facts({tutorial:false,levelId:1,activeIndex:2,attemptId:'campaign-1',coachVisible:false,lessonPair:[],...patch});
const context=patch=>({activeIndex:0,attemptId:'a',tutorialCount:2,...patch});

test('the five real screens are recognized while Settings stays a modal',()=>{
  assert.deepEqual(S.SCREENS,['home','game','journey','records','garden']);
  for(const name of S.SCREENS)assert.equal(S.screen(state({screen:name})),name);
  for(const value of ['settings','GAME',null,7,undefined]){const current=state();current.navigation.screen=value;assert.equal(S.screen(current),null);}
  assert.equal(S.screen(null),null);assert.equal(S.SCREENS,Core.SCREENS,'the navigation catalog has one owner');assert(Object.isFrozen(S.SCREENS));assert(Object.isFrozen(S.PHASES));
});

test('pause comes from stack membership and Settings alone does not become pause',()=>{
  assert.equal(S.isPaused(state({modals:['settings-dialog']})),false);
  assert.equal(S.isPaused(state({modals:['pause-dialog','settings-dialog','reset-dialog']})),true);
  assert.equal(S.canRouteBoardInput(state({modals:['settings-dialog']}),facts()),false);
  assert.equal(S.canRouteBoardInput(state({modals:['pause-dialog','settings-dialog']}),facts()),false);
  assert.equal(S.isPaused(null),false);
});

test('READY distinguishes a read-only preview from an activated engine',()=>{
  for(const engineStatus of ['playing','won','lost'])assert.equal(S.gameplayPhase(state(),facts({attemptReady:false,engineStatus})),'READY');
  assert.equal(S.gameplayPhase(state(),facts()),'PLAYING');
  assert.equal(S.gameplayPhase(state(),facts({engineStatus:'won'})),'WON');
  assert.equal(S.gameplayPhase(state(),facts({engineStatus:'lost'})),'LOST');
  for(const engineStatus of [null,'WON','resolving',undefined])assert.equal(S.gameplayPhase(state(),facts({engineStatus})),'READY');
  assert.equal(S.gameplayPhase(null,facts()),'READY');
});

test('visual resolving can coexist with the real committed win or loss',()=>{
  for(const status of ['requested','pending'])for(const engineStatus of ['playing','won','lost']){
    const current=state({operation:'a',status}),domain=facts({engineStatus});
    assert.equal(S.isResolving(current),true);assert.equal(S.gameplayPhase(current,domain),'RESOLVING');
    assert.equal(S.projectPresentation(current,domain).scene.status,engineStatus,'presentation never rewrites the real engine outcome');
  }
  for(const status of ['succeeded','failed','cancelled']){
    assert.equal(S.isResolving(state({operation:'a',status})),false);
    assert.equal(S.gameplayPhase(state({operation:'a',status}),facts({engineStatus:'won'})),'WON');
  }
  assert.equal(S.isResolving(state({operation:'a',kind:'hint'})),false);
  assert.equal(S.canStartMove(state({operation:'a',kind:'hint'}),facts()),true,'a real move may cancel a pending hint');
});

test('the actual core operation lifecycle feeds selectors without copied domain state',()=>{
  const store=Core.create();
  assert(store.dispatch({type:'NAVIGATE',screen:'game'},{gameAvailable:true}).accepted);
  const token=store.beginOperation('presentation','a');assert(token);assert(S.isResolving(store.snapshot()));
  assert(store.markOperationPending(token).accepted);assert.equal(S.gameplayPhase(store.snapshot(),facts()),'RESOLVING');
  assert(store.settleOperation(token,'failed').accepted);assert.equal(S.gameplayPhase(store.snapshot(),facts()),'PLAYING');
  const newer=store.beginOperation('presentation','b');assert(newer);store.invalidateOperations();
  assert.equal(S.isResolving(store.snapshot()),false);assert.equal(S.canStartMove(store.snapshot(),facts()),true);
  assert.equal(store.settleOperation(newer,'succeeded').accepted,false,'a stale completion cannot restore resolving');
  assert.deepEqual(Object.keys(store.snapshot()).sort(),['lifecycle','navigation','operations','overlays']);store.destroy();
});

test('board routing permits reveal and acknowledgment, while a new move is narrower',()=>{
  const resolving=state({operation:'a'});assert(S.canRouteBoardInput(resolving,facts()));assert.equal(S.canStartMove(resolving,facts()),false);
  assert(S.canRouteBoardInput(state(),facts({feedback:true})));assert.equal(S.canStartMove(state(),facts({feedback:true})),false);
  for(const engineStatus of ['won','lost']){assert(S.canRouteBoardInput(state(),facts({engineStatus})));assert.equal(S.canStartMove(state(),facts({engineStatus})),false);}
  assert.equal(S.canStartMove(state(),facts()),true);
});

test('write, attempt, life, lifecycle and screen barriers fail closed without changing facts',()=>{
  const blocked=[{attemptReady:false},{canOpen:false},{writeBlocked:true},{lifeDiscarded:true},{resetPending:true},{engineStatus:'invalid'},{nativeModalOpen:'true'}];
  for(const patch of blocked){const domain=facts(patch),before=clone(domain);assert.equal(S.canRouteBoardInput(state(),domain),false);assert.equal(S.canStartMove(state(),domain),false);assert.deepEqual(domain,before);}
  for(const key of ['attemptReady','canOpen','writeBlocked','lifeDiscarded','resetPending']){const domain=facts();delete domain[key];assert.equal(S.canRouteBoardInput(state(),domain),false,'missing '+key+' cannot authorize input');}
  for(const current of [state({screen:'home'}),state({screen:'journey'}),state({hidden:true}),state({suspended:true}),null,{}])assert.equal(S.canRouteBoardInput(current,facts()),false);
  const stale=state({operation:'a'});stale.operations.generation++;
  assert.equal(S.isResolving(stale),false);assert.equal(S.canStartMove(stale,facts()),false,'a malformed stale operation snapshot is not an input grant');
});

test('native modal fallback blocks board input without becoming a second pause flag',()=>{
  const domain=facts({nativeModalOpen:true,nativeModalId:'help-dialog'});
  assert.equal(S.isPaused(state()),false);assert.equal(S.canRouteBoardInput(state(),domain),false);
  const view=S.projectPresentation(state(),domain);assert(view.motionPaused);assert(view.scene.modalOpen);assert.equal(view.scene.paused,false);
});

test('inventory works in its own modal and confirmation while unrelated modal commands are rejected',()=>{
  for(const modals of [[],['inventory-dialog'],['assistance-dialog']])assert.equal(S.canUseInventory(state({modals}),campaign()),true);
  for(const modals of [['settings-dialog'],['help-dialog'],['pause-dialog','settings-dialog'],['lose-dialog'],['inventory-dialog','assistance-dialog']])assert.equal(S.canUseInventory(state({modals}),campaign()),false);
  for(const nativeModalId of ['inventory-dialog','assistance-dialog'])assert(S.canUseInventory(state(),campaign({nativeModalOpen:true,nativeModalId})));
  for(const nativeModalId of ['settings-dialog',null,'unknown'])assert.equal(S.canUseInventory(state(),campaign({nativeModalOpen:true,nativeModalId})),false);
  assert.equal(S.canUseInventory(state({modals:['inventory-dialog']}),campaign({nativeModalOpen:true,nativeModalId:'assistance-dialog'})),false,'inconsistent native/core modal owners cannot authorize commands');
  assert.equal(S.canUseInventory(state(),facts()),false,'a tutorial cannot use inventory');
  assert.equal(S.canUseInventory(state({operation:'a'}),campaign()),false);
  assert.equal(S.canUseInventory(state({hidden:true}),campaign()),false);
  assert.equal(S.canUseInventory(state(),campaign({writeBlocked:true})),false);
});

test('committed tutorial progress preserves the exact legacy reach inference',()=>{
  const cases=[
    [null,{},0,0],
    [{current:0,done:[],boards:{0:{turn:1}},attempts:{0:{attemptId:'a'}}},{},0,1],
    [{current:1,done:[],boards:{1:{turn:2}},attempts:{1:{attemptId:'a'}}},{activeIndex:1},1,2],
    [{current:0,done:[0],boards:{},attempts:{}},{},1,0],
    [{current:0,done:[1],boards:{},attempts:{}},{},2,0],
    [{current:2,done:[]},{},2,0],
    [{current:0,done:[],boards:{2:{turn:1}}},{},2,0],
    [{current:0,done:[],attempts:{2:{attemptId:'campaign'}}},{},2,0],
    [{current:0,done:[0,1],boards:{0:{turn:1}},attempts:{0:{attemptId:'a'}}},{},2,1],
    [{current:2,done:[],boards:{2:{turn:5}},attempts:{2:{attemptId:'a'}}},{activeIndex:2},2,0],
    [{current:0,boards:[null,null,{turn:1}],attempts:[]},{},2,0],
    [{current:1,done:[],boards:[null,{turn:2}],attempts:[null,{attemptId:'a'}]},{activeIndex:1},1,2],
    [{current:null,done:null,boards:null,attempts:null},{},0,0]
  ];
  for(const [game,patch,completedTutorialCount,tutorialTurn]of cases){const before=clone(game);assert.deepEqual(S.committedTutorialProgress(game,context(patch)),{completedTutorialCount,tutorialTurn});assert.deepEqual(game,before);}
});

test('only the matching committed attempt supplies tutorial turns, without reading stars or board contents',()=>{
  const checkpoint={turn:2};for(const key of ['values','layers','score','rngState'])Object.defineProperty(checkpoint,key,{enumerable:true,get(){throw Error('must not read '+key);}});
  const game={current:0,done:[],boards:{0:checkpoint},attempts:{0:{attemptId:'a'}}};
  Object.defineProperty(game,'economy',{get(){throw Error('must not read economy');}});Object.defineProperty(game,'stars',{get(){throw Error('must not read stars');}});
  assert.deepEqual(S.committedTutorialProgress(game,context()),{completedTutorialCount:0,tutorialTurn:2});
  assert.equal(S.committedTutorialProgress(game,context({attemptId:'new'})).tutorialTurn,0);
  assert.equal(S.committedTutorialProgress(game,context({attemptId:null})).tutorialTurn,0);
  assert(Object.isFrozen(S.committedTutorialProgress(game,context())));
});

test('malformed progress and typed identity mistakes are rejected without inventing a reached stage',()=>{
  const games=[false,[],{current:'2'},{done:['0']},{done:'0'},{boards:false},{attempts:{'learn-1':{}}},{boards:{'02':{}}},{current:-1},
    {boards:{0:{turn:-1}},attempts:{0:{attemptId:'a'}}},{boards:{0:{turn:1.5}},attempts:{0:{attemptId:'a'}}},{boards:{0:'bad'}}];
  for(const game of games)assert.throws(()=>S.committedTutorialProgress(game,context()),{code:'invalid_committed_game_view'});
  for(const patch of [{activeIndex:'0'},{activeIndex:-1},{tutorialCount:0},{tutorialCount:NaN},{attemptId:1}])assert.throws(()=>S.committedTutorialProgress(null,context(patch)),{code:'invalid_tutorial_projection_context'});
});

test('one actor policy reserves the portrait in both tutorials and keeps the existing two update payloads aligned',()=>{
  for(const activeIndex of [0,1]){
    const domain=facts({activeIndex,levelId:'learn-'+(activeIndex+1),attemptId:'a',turn:2,committedGame:{current:activeIndex,done:[],boards:{[activeIndex]:{turn:1}},attempts:{[activeIndex]:{attemptId:'a'}}}});
    const view=S.projectPresentation(state(),domain);assert.equal(view.actorMode,'PORTRAIT');assert(view.portraitVisible);assert(view.portrait.visible);assert(view.scene.tutorialPortrait);
    assert.equal(view.portrait.levelId,domain.levelId);assert.equal(view.portrait.step,2);assert.equal(view.scene.tutorialTurn,1,'the presentation counter uses the committed turn, never the newer engine turn');
    assert.deepEqual(view.scene.lessonPair,domain.lessonPair);assert.notEqual(view.scene.lessonPair,domain.lessonPair);
  }
});

test('terminal, hidden and suspended coach transitions never release the tutorial actor reservation',()=>{
  for(const current of [state(),state({hidden:true}),state({suspended:true})]){
    const view=S.projectPresentation(current,facts({coachVisible:false,engineStatus:'won'}));
    assert.equal(view.actorMode,'PORTRAIT');assert.equal(view.portrait.visible,false);assert(view.scene.tutorialPortrait);assert.equal(view.scene.status,'won');
  }
  for(const current of [state({hidden:true}),state({suspended:true})]){
    const view=S.projectPresentation(current,facts());assert.equal(view.portraitVisible,false);assert(view.motionPaused);assert(view.scene.hidden);
  }
  const paused=S.projectPresentation(state({modals:['pause-dialog','settings-dialog']}),facts());
  assert(paused.portrait.visible,'native modal retains the logically present portrait underneath');assert(paused.portrait.paused);assert(paused.scene.paused);assert(paused.scene.modalOpen);assert(paused.scene.tutorialPortrait);
});

test('HOME, independent screens and optional portrait failure use the existing world fallback policy',()=>{
  assert.equal(S.projectPresentation(state({screen:'home'}),facts()).actorMode,'WORLD');
  assert.equal(S.projectPresentation(state({screen:'home'}),facts()).portrait.visible,false);
  for(const name of ['journey','records','garden']){const view=S.projectPresentation(state({screen:name}),facts());assert.equal(view.actorMode,'NONE');assert.equal(view.portrait.visible,false);assert.equal(view.scene.screen,name);}
  const fallback=S.projectPresentation(state(),facts({portraitAvailable:false}));assert.equal(fallback.actorMode,'WORLD');assert.equal(fallback.scene.tutorialPortrait,false);assert.equal(fallback.portrait.visible,false);
  const realCampaign=S.projectPresentation(state(),campaign({committedGame:{current:2,done:[]}}));assert.equal(realCampaign.actorMode,'WORLD');assert.equal(realCampaign.scene.completedTutorialCount,2);assert.equal(realCampaign.portrait.visible,false);
});

test('projection is detached, immutable and entirely driven by each new domain view',()=>{
  const current=state({operation:'a'}),domain=facts({turn:1}),beforeState=clone(current),beforeDomain=clone(domain),view=S.projectPresentation(current,domain);
  for(const value of [view,view.scene,view.portrait,view.progress,view.scene.lessonPair])assert(Object.isFrozen(value));
  assert.throws(()=>{view.scene.lessonPair[0]=7;},TypeError);assert.throws(()=>{view.progress.tutorialTurn=99;},TypeError);
  assert.deepEqual(current,beforeState);assert.deepEqual(domain,beforeDomain);
  domain.lessonPair[0]=1;domain.turn=3;domain.feedback=true;assert.equal(view.portrait.step,1);assert.deepEqual(view.scene.lessonPair,[4,3]);
  const next=S.projectPresentation(current,domain);assert.equal(next.portrait.step,3);assert.equal(next.scene.feedback,true);assert.equal(next.scene.busy,true);assert.equal(next.portrait.feedback,true);
  assert.equal(view.scene.feedback,false);assert.equal(S.projectPresentation(state(),facts({firstOpening:true,reducedMotion:true})).scene.firstOpening,true);
  assert.equal(S.projectPresentation(state(),facts({firstOpening:true,reducedMotion:true})).scene.reducedMotion,true);
});

test('presentation rejects invalid Level ID types, lesson payloads and malformed snapshots',()=>{
  for(const domain of [campaign({levelId:'1'}),facts({levelId:1}),facts({levelId:'learn-2'}),facts({tutorial:false}),facts({turn:-1}),facts({coachVisible:'true'}),facts({nativeModalOpen:'false'}),facts({committedGame:{current:'2'}})])assert.throws(()=>S.projectPresentation(state(),domain),TypeError);
  for(const lessonPair of [[1],[1,1],[-1,2],[1.5,2],'1,2'])assert.throws(()=>S.projectPresentation(state(),facts({lessonPair})),{code:'invalid_presentation_view'});
  assert.throws(()=>S.projectPresentation(null,facts()),{code:'invalid_presentation_view'});
  const broken=state();delete broken.lifecycle.hidden;assert.throws(()=>S.projectPresentation(broken,facts()),{code:'invalid_presentation_view'});
});

test('semantic Tavik states map only supplied clips or actual portrait observations',()=>{
  const clips=require('./dist/assets/scenes/coop-v1/tavik-motion.js').clips;
  const expected={idle:'IDLE',point:'POINTING',inspect:'INSPECTING',worried:'WORRIED',celebrate:'CELEBRATING',hop:'HOPPING',carry:'CARRYING',build:'BUILDING',proud:'PROUD',think:'THINKING',call:'TALKING',rest:'RESTING'};
  assert.deepEqual(Object.keys(clips).sort(),Object.keys(expected).sort());
  for(const [scenePose,semantic]of Object.entries(expected))assert.equal(S.tavikState(state(),campaign({scenePose})),semantic);
  assert.equal(S.tavikState(state(),campaign({scenePose:'invented'})),null);assert.equal(S.tavikState(state(),facts()),null,'an unobserved animation state is not invented');
  assert.equal(S.tavikState(state(),facts({portraitSpeaking:true})),'TALKING');assert.equal(S.tavikState(state(),facts({portraitSpeaking:false})),'POINTING');
  assert.equal(S.tavikState(state(),facts({portraitSpeaking:false,feedback:true})),'CELEBRATING');
  assert.equal(S.tavikState(state({screen:'garden'}),campaign({scenePose:'idle'})),null);
});

test('the projection module contains no platform, economic, timing or random dependency',()=>{
  const source=fs.readFileSync(__dirname+'/dist/state-selectors.js','utf8');
  assert(!/\b(document|localStorage|sessionStorage|HexMatch|HexEconomy|HexLives|setTimeout|fetch|addEventListener)\b|Math\.random/.test(source));
  assert(Object.isFrozen(S));
});

let failed=0;
for(const {name,run}of tests)try{run();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name);console.error(error);}
console.log('State selector checks: '+(tests.length-failed)+'/'+tests.length+' passed.');
if(failed)process.exitCode=1;
