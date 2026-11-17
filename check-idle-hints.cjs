/* Controlled monotonic clocks and actual engine visible projections. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const Idle=require('./dist/idle-hints.js'),{HexMatch,HEX_LEVELS,asLevel}=require('./lib/level-analysis.cjs');
const Player=require('./lib/observable-player.cjs');
const tests=[],test=(name,run)=>tests.push({name,run}),plain=value=>JSON.parse(JSON.stringify(value));
function clock(){
  let at=0,serial=0;const pending=new Map(),all=new Map();
  return {now:()=>at,setTimeout(fn,delay){assert(Number.isFinite(delay)&&delay>=0);const id=++serial,item={id,fn,at:at+delay};pending.set(id,item);all.set(id,item);return id;},clearTimeout(id){pending.delete(id);},
    advance(ms){const target=at+ms;let calls=0;for(;;){const next=[...pending.values()].sort((a,b)=>a.at-b.at||a.id-b.id)[0];if(!next||next.at>target)break;assert(++calls<1000,'no timer spin');at=next.at;pending.delete(next.id);next.fn();}at=target;},
    jump(ms){at+=ms;},run(id){const item=all.get(id);assert(item);pending.delete(id);item.fn();},ids:()=>[...pending.keys()],count:()=>pending.size};
}
function fixture(options={}){
  const timer=clock(),shown=[],hidden=[];let facts={eligible:true,attemptId:'a',generation:0,boardKey:'board-0'},listener=null,removed=0,chosen=0;
  const deps={read:()=>facts,choosePair:view=>{chosen++;return options.choose?options.choose(view):[0,1];},onShow:event=>{shown.push(event);options.onShow?.(event);},onHide:event=>hidden.push(event),now:timer.now,setTimeout:timer.setTimeout,clearTimeout:timer.clearTimeout,config:options.config};
  if(options.subscribe)deps.subscribe=callback=>{listener=callback;return()=>{removed++;listener=null;};};
  const policy=Idle.create(deps);
  return {timer,shown,hidden,policy,get facts(){return facts;},set(patch,notify=true){facts={...facts,...patch};if(notify)policy.sync();},replace(next){facts=next;policy.sync();},get chosen(){return chosen;},get removed(){return removed;},notify(){listener?.();}};
}
const showFirst=f=>{f.timer.advance(20000);assert.equal(f.shown.length,1);};
const rearm=(f,key='board-1')=>{f.set({eligible:false,boardKey:key});f.policy.playerMoveSucceeded();f.set({eligible:true});};

test('fixed product timings and dependency validation',()=>{
  assert.deepEqual(Idle.CONFIG,{firstDelay:20000,nextDelay:35000,minInterval:60000,maxPerAttempt:2,duration:900});assert(Object.isFrozen(Idle.CONFIG));
  assert.throws(()=>Idle.create(),/invalid_idle_hint_dependencies/);
});
test('per-instance timing and quota configuration is validated, copied and frozen',()=>{
  const config={firstDelay:10,nextDelay:20,minInterval:50,duration:3,maxPerAttempt:1},f=fixture({config});config.firstDelay=0;
  assert(Object.isFrozen(f.policy.config));assert.equal(f.policy.config.firstDelay,10);assert.equal(Idle.CONFIG.firstDelay,20000);f.timer.advance(9);assert.equal(f.shown.length,0);f.timer.advance(1);assert.equal(f.shown.length,1);assert.equal(f.shown[0].duration,3);f.timer.advance(3);assert.equal(f.hidden[0].reason,'elapsed');rearm(f);f.timer.advance(100);assert.equal(f.shown.length,1);f.policy.dispose();
  for(const bad of [null,[],{extra:1},{firstDelay:-1},{nextDelay:1.5},{minInterval:Infinity},{duration:NaN},{maxPerAttempt:0},{maxPerAttempt:2.5},{firstDelay:Number.MAX_SAFE_INTEGER+1}])assert.throws(()=>fixture({config:bad}),/invalid_idle_hint_config/);
});
test('custom second delay and minimum interval both govern rearmed hints',()=>{
  const f=fixture({config:{firstDelay:10,nextDelay:20,minInterval:50,duration:3}});f.timer.advance(10);assert.equal(f.shown.length,1);rearm(f);f.timer.advance(49);assert.equal(f.shown.length,1);f.timer.advance(1);assert.equal(f.shown.length,2);f.policy.dispose();
  const slow=fixture({config:{firstDelay:0,nextDelay:70,minInterval:50,duration:0}});slow.timer.advance(0);assert.equal(slow.shown.length,1);rearm(slow);slow.timer.advance(69);assert.equal(slow.shown.length,1);slow.timer.advance(1);assert.equal(slow.shown.length,2);slow.policy.dispose();
});
test('large configured waits respect the browser timer delay bound',()=>{
  const timer=clock(),delays=[];let shown=0;const p=Idle.create({config:{firstDelay:2147483648},read:()=>({eligible:true,attemptId:'a',generation:0,boardKey:'a0'}),choosePair:()=>[0,1],onShow:()=>shown++,onHide:()=>{},now:timer.now,setTimeout:(fn,delay)=>{delays.push(delay);return timer.setTimeout(fn,delay);},clearTimeout:timer.clearTimeout});
  assert.deepEqual(delays,[2147483647]);timer.advance(2147483647);assert.equal(shown,0);assert.deepEqual(delays,[2147483647,1]);timer.advance(1);assert.equal(shown,1);p.dispose();assert.equal(timer.count(),0);
});
test('large hint durations wait through bounded chunks and dispose cancels the final chunk',()=>{
  for(const disposeEarly of [false,true]){
    const timer=clock(),delays=[],hidden=[];let shown=0;
    const p=Idle.create({config:{firstDelay:0,duration:2147483648},read:()=>({eligible:true,attemptId:'a',generation:0,boardKey:'a0'}),choosePair:()=>[0,1],onShow:()=>shown++,onHide:event=>hidden.push(event),now:timer.now,setTimeout:(fn,delay)=>{delays.push(delay);return timer.setTimeout(fn,delay);},clearTimeout:timer.clearTimeout});
    timer.advance(0);assert.equal(shown,1);assert.equal(hidden.length,0);assert.deepEqual(delays,[0,2147483647]);
    timer.advance(2147483647);assert.equal(hidden.length,0,'a chunk boundary cannot hide early');assert.deepEqual(delays,[0,2147483647,1]);const lastChunk=timer.ids()[0];
    if(disposeEarly){p.dispose();assert.equal(hidden[0].reason,'disposed');assert.equal(timer.count(),0);timer.run(lastChunk);assert.equal(hidden.length,1,'a stale disposed chunk cannot hide again');}
    else{timer.advance(1);assert.equal(hidden.length,1);assert.equal(hidden[0].reason,'elapsed');assert.equal(timer.count(),0);p.dispose();}
  }
});
test('first hint waits 20 seconds then hides after 900ms',()=>{
  const f=fixture();assert.equal(f.timer.count(),1);f.timer.advance(19999);assert.equal(f.chosen,0);f.timer.advance(1);
  assert.equal(f.shown.length,1);assert.equal(f.chosen,1);assert.deepEqual(f.shown[0],{pair:[0,1],attemptId:'a',generation:0,boardKey:'board-0',duration:900,ordinal:1});assert(Object.isFrozen(f.shown[0]));assert(Object.isFrozen(f.shown[0].pair));
  f.timer.advance(899);assert.equal(f.hidden.length,0);f.timer.advance(1);assert.equal(f.hidden[0].reason,'elapsed');assert.equal(f.timer.count(),0);f.policy.dispose();
});
test('meaningful interaction resets full first delay without polling',()=>{
  const f=fixture();f.timer.advance(19000);f.policy.interaction();f.timer.advance(19999);assert.equal(f.shown.length,0);f.timer.advance(1);assert.equal(f.shown.length,1);f.policy.dispose();
});
test('ordinary repeated sync notifications keep the current deadline',()=>{
  const f=fixture();f.timer.advance(10000);for(let i=0;i<100;i++)f.policy.sync();assert.equal(f.timer.count(),1);f.timer.advance(10000);assert.equal(f.shown.length,1);f.policy.dispose();
});
test('all ineligible periods reset idle instead of catching up on resume',()=>{
  for(const reason of ['pause','modal','hidden','navigation','resolving','tutorial','manual hint','reduced motion','pointer gesture']){
    const f=fixture();f.timer.advance(19000);f.set({eligible:false});assert.equal(f.timer.count(),0,reason);f.timer.advance(120000);assert.equal(f.shown.length,0,reason);f.set({eligible:true});f.timer.advance(19999);assert.equal(f.shown.length,0,reason);f.timer.advance(1);assert.equal(f.shown.length,1,reason);f.policy.dispose();
  }
});
test('show disarms unchanged board indefinitely including interactions',()=>{
  const f=fixture();showFirst(f);f.timer.advance(100000);for(let i=0;i<3;i++){f.policy.interaction();f.timer.advance(100000);f.policy.sync();}assert.equal(f.shown.length,1);assert.equal(f.timer.count(),0);f.policy.dispose();
});
test('nonplayer board changes cannot rearm a shown attempt',()=>{
  const f=fixture();showFirst(f);f.set({boardKey:'booster-board'});f.policy.interaction();f.timer.advance(100000);assert.equal(f.shown.length,1);assert.equal(f.timer.count(),0);f.policy.dispose();
});
test('a claimed successful player move with unchanged board cannot rearm',()=>{
  const f=fixture();showFirst(f);f.policy.playerMoveSucceeded();f.timer.advance(100000);assert.equal(f.shown.length,1);assert.equal(f.timer.count(),0);f.policy.dispose();
});
test('successful player move waits 35 idle seconds and 60 seconds since showing',()=>{
  const f=fixture();showFirst(f);f.timer.advance(1000);rearm(f);f.timer.advance(35000);assert.equal(f.shown.length,1,'35 idle seconds alone do not bypass minimum interval');f.timer.advance(23999);assert.equal(f.shown.length,1);f.timer.advance(1);assert.equal(f.shown.length,2);assert.equal(f.shown[1].ordinal,2);f.policy.dispose();
});
test('35 seconds starts after settling even when successful commit occurs during resolving',()=>{
  const f=fixture();showFirst(f);f.timer.advance(70000);f.set({eligible:false,boardKey:'board-1'});f.policy.playerMoveSucceeded();f.timer.advance(100000);assert.equal(f.timer.count(),0);f.set({eligible:true});f.timer.advance(34999);assert.equal(f.shown.length,1);f.timer.advance(1);assert.equal(f.shown.length,2);f.policy.dispose();
});
test('rearmed second delay resets to 35 after meaningful interaction',()=>{
  const f=fixture();showFirst(f);f.timer.advance(70000);rearm(f);f.timer.advance(34000);f.policy.interaction();f.timer.advance(34999);assert.equal(f.shown.length,1);f.timer.advance(1);assert.equal(f.shown.length,2);f.policy.dispose();
});
test('minimum interval continues while paused but resume still waits full 35',()=>{
  const f=fixture();showFirst(f);f.timer.advance(1000);rearm(f);f.timer.advance(1000);f.set({eligible:false});f.timer.advance(100000);f.set({eligible:true});f.timer.advance(34999);assert.equal(f.shown.length,1);f.timer.advance(1);assert.equal(f.shown.length,2);f.policy.dispose();
});
test('at most two shows per attempt despite later successful player moves',()=>{
  const f=fixture();showFirst(f);rearm(f);f.timer.advance(60000);assert.equal(f.shown.length,2);rearm(f,'board-2');f.timer.advance(100000);assert.equal(f.shown.length,2);assert.equal(f.timer.count(),0);f.policy.dispose();
});
test('attempt reentry preserves disarm, quota and minimum interval; a new attempt has its own quota',()=>{
  const f=fixture();showFirst(f);f.set({eligible:false});f.set({attemptId:'b',boardKey:'b0',eligible:true});f.timer.advance(60000);assert.equal(f.shown.length,2);f.set({attemptId:'a',boardKey:'board-0'});f.timer.advance(100000);assert.equal(f.shown.length,2,'reentering a does not rearm');rearm(f);f.timer.advance(35000);assert.equal(f.shown.length,3);f.set({attemptId:'b',boardKey:'b0'});f.timer.advance(100000);assert.equal(f.shown.length,3);f.set({attemptId:'a',boardKey:'board-2'});f.policy.playerMoveSucceeded();f.timer.advance(100000);assert.equal(f.shown.length,3,'a remains limited to two');f.policy.dispose();
});
test('a fresh attempt waits for the page-runtime minimum interval as well as its first delay',()=>{
  const f=fixture();showFirst(f);f.set({attemptId:'b',boardKey:'b0'});f.timer.advance(20000);assert.equal(f.shown.length,1,'a new attempt cannot bypass the previous hint cooldown');assert.equal(f.chosen,1);f.timer.advance(39999);assert.equal(f.shown.length,1);f.timer.advance(1);assert.equal(f.shown.length,2);assert.equal(f.shown[1].attemptId,'b');assert.equal(f.shown[1].ordinal,1,'quota remains per attempt');f.policy.dispose();
});
test('reload creates transient state and waits a fresh full first delay',()=>{
  const f=fixture();showFirst(f);f.policy.dispose();const reload=fixture();reload.timer.advance(19999);assert.equal(reload.shown.length,0);reload.timer.advance(1);assert.equal(reload.shown.length,1);reload.policy.dispose();
});
test('stale idle callbacks cannot show after interaction, generation, board or attempt change',()=>{
  for(const change of ['interaction','generation','board','attempt','ineligible','dispose']){
    const f=fixture(),stale=f.timer.ids()[0];f.timer.advance(19000);
    if(change==='interaction')f.policy.interaction();else if(change==='dispose')f.policy.dispose();else f.set(change==='generation'?{generation:1}:change==='board'?{boardKey:'changed'}:change==='attempt'?{attemptId:'b'}:{eligible:false});
    f.timer.jump(1000);f.timer.run(stale);assert.equal(f.shown.length,0,change);assert.equal(f.chosen,0,change);f.policy.dispose();
  }
});
test('late callbacks re-read eligibility and identity without a notification',()=>{
  for(const patch of [{eligible:false},{attemptId:'b'},{generation:1},{boardKey:'changed'}]){
    const f=fixture(),stale=f.timer.ids()[0];f.set(patch,false);f.timer.jump(20000);f.timer.run(stale);assert.equal(f.shown.length,0);assert.equal(f.chosen,0);f.policy.dispose();
  }
});
test('identity is checked again after synchronous selection',()=>{
  let f;f=fixture({choose(){f.set({generation:1},false);return [0,1];}});f.timer.advance(20000);assert.equal(f.shown.length,0);assert.equal(f.chosen,1);assert.equal(f.timer.count(),1);f.policy.dispose();
});
test('null, throwing or malformed selection creates no retry loop or quota use',()=>{
  for(const choose of [()=>null,()=>{throw Error('unavailable');},()=>[0,0],()=>[-1,0],()=>[1]]){
    const f=fixture({choose});f.timer.advance(100000);assert.equal(f.shown.length,0);assert.equal(f.chosen,1);assert.equal(f.timer.count(),0);f.policy.dispose();
  }
});
test('stale hide callbacks cannot hide a later hint',()=>{
  const f=fixture();showFirst(f);const oldHide=f.timer.ids()[0];f.policy.interaction();rearm(f);f.timer.advance(60000);assert.equal(f.shown.length,2);const count=f.hidden.length;f.timer.run(oldHide);assert.equal(f.hidden.length,count);assert.equal(f.timer.count(),1);f.policy.dispose();
});
test('eligibility loss hides immediately and disposal cancels all resources once',()=>{
  const f=fixture({subscribe:true});showFirst(f);f.set({eligible:false});assert.equal(f.hidden.length,1);assert.equal(f.timer.count(),0);f.set({eligible:true});f.notify();f.policy.dispose();f.policy.dispose();f.notify();f.policy.sync();f.policy.interaction();f.policy.playerMoveSucceeded();assert.equal(f.removed,1);assert.equal(f.timer.count(),0);assert.equal(f.shown.length,1);
});
test('malformed read facts fail closed without timers',()=>{
  for(const facts of [null,{}, {eligible:true,attemptId:'a',generation:0,boardKey:''},{eligible:true,attemptId:'a',generation:-1,boardKey:'x'}]){const f=fixture();f.replace(facts);f.timer.advance(100000);assert.equal(f.shown.length,0);assert.equal(f.timer.count(),0);f.policy.dispose();}
});
test('show callback may synchronously dispose without a timer leak',()=>{
  let f;f=fixture({onShow(){f.policy.dispose();}});f.timer.advance(20000);assert.equal(f.shown.length,1);assert.equal(f.hidden[0].reason,'disposed');assert.equal(f.timer.count(),0);
});
test('construction errors cancel synchronous subscription work and unsubscribe registered listeners',()=>{
  const timer=clock(),facts={eligible:true,attemptId:'a',generation:0,boardKey:'one'},deps={read:()=>facts,choosePair:()=>[0,1],onShow:()=>{},onHide:()=>{},now:timer.now,setTimeout:timer.setTimeout,clearTimeout:timer.clearTimeout};
  assert.throws(()=>Idle.create({...deps,subscribe(sync){sync();throw Error('subscription failed');}}),/subscription failed/);assert.equal(timer.count(),0);
  let removed=0;assert.throws(()=>Idle.create({...deps,now:()=>NaN,subscribe(){return()=>removed++;}}),/invalid_idle_hint_clock/);assert.equal(removed,1);assert.equal(timer.count(),0);
  assert.throws(()=>Idle.create({...deps,subscribe(sync){sync();return null;}}),/invalid_idle_hint_subscription/);assert.equal(timer.count(),0);
});
test('a backwards clock reading cannot shorten the minimum interval',()=>{
  const timer=clock();let fake=0,shows=0;const facts={eligible:true,attemptId:'a',generation:0,boardKey:'one'};
  const p=Idle.create({read:()=>facts,choosePair:()=>[0,1],onShow:()=>shows++,onHide:()=>{},now:()=>fake,setTimeout:timer.setTimeout,clearTimeout:timer.clearTimeout});
  fake=20000;timer.advance(20000);assert.equal(shows,1);facts.boardKey='two';fake=100;p.playerMoveSucceeded();fake=79999;timer.advance(59999);assert.equal(shows,1);fake=80000;timer.advance(1);assert.equal(shows,2);p.dispose();
});

test('selector is deterministic, immutable and reuses the actual engine matching rule across published boards',()=>{
  const pack=JSON.parse(fs.readFileSync(__dirname+'/dist/variants.json','utf8'));let positions=0;
  for(const entry of pack.levels){const base=HEX_LEVELS.find(level=>level.id===entry.levelId);for(const variant of entry.variants){
    const game=new HexMatch(asLevel(base,variant));for(let turn=0;turn<2;turn++){
      const dto=Player.visibleState(game),legal=plain(game.legalMoves()),before=plain(game.snapshot());Object.freeze(dto.values);Object.freeze(dto.layers);Object.freeze(dto);legal.forEach(Object.freeze);Object.freeze(legal);
      const chosen=Idle.chooseVisiblePair(dto,legal,values=>game.findMatches(values));assert(chosen);assert(legal.some(pair=>pair.slice().sort((a,b)=>a-b).join(':')===chosen.join(':')));assert(Object.isFrozen(chosen));
      const reordered=legal.slice().reverse().map(pair=>pair.slice().reverse());assert.deepEqual(Idle.chooseVisiblePair(dto,reordered,values=>game.findMatches(values)),chosen,'tie breaking does not depend on enumeration order');
      const options=Player.visibleOptions(dto),rank=option=>option.layerGain*100+option.greenGain*35+Math.min(option.scoreGain,Math.max(0,dto.target-dto.score))*.1,best=Math.max(...options.map(rank));
      assert.equal(rank(options.find(option=>option.pair.slice().sort((a,b)=>a-b).join(':')===chosen.join(':'))),best,'rank is existing observable visible coverage');
      assert.deepEqual(plain(game.snapshot()),before,'legal selection consumes no RNG or gameplay state');positions++;if(turn===0)assert(game.swap(...chosen).ok);
    }
  }}assert.equal(positions,pack.levels.reduce((sum,entry)=>sum+entry.variants.length*2,0),'every published start and midgame board is covered');assert(positions>0);
});
test('selector reads no hidden metadata and equal visible states ignore actual RNG',()=>{
  const pack=JSON.parse(fs.readFileSync(__dirname+'/dist/variants.json','utf8')),game=new HexMatch(asLevel(HEX_LEVELS.find(level=>level.id===pack.levels[0].levelId),pack.levels[0].variants[0]));
  const visible=Player.visibleState(game),legal=plain(game.legalMoves()),expected=Idle.chooseVisiblePair(visible,legal,values=>game.findMatches(values));
  for(const key of ['rngState','seed','initial','solution','solutions','history','clone','snapshot','_random','cells','palette'])Object.defineProperty(visible,key,{get(){throw Error('forbidden '+key);}});
  assert.deepEqual(Idle.chooseVisiblePair(visible,legal,values=>game.findMatches(values)),expected);
  for(const rngState of [1,0xdeadbeef,0xffffffff]){game.rngState=rngState;assert.deepEqual(Idle.chooseVisiblePair(visible,legal,values=>game.findMatches(values)),expected);}
});
test('selector uses only valid supplied pairs and rejects malformed match results and terminal states',()=>{
  const dto=Object.freeze({values:Object.freeze([1,2,3,4]),layers:Object.freeze([1,1,1,0]),score:0,target:10,movesLeft:3});
  assert.deepEqual(Idle.chooseVisiblePair(dto,[[2,3],[1,0],[0,1],[-1,2],[0,99],[2,2]],()=>[0,1,2,3]),[0,1]);
  for(const matched of [[],null,[-1],[9],[0,0],[1.5]])assert.equal(Idle.chooseVisiblePair(dto,[[0,1]],()=>matched),null);
  assert.equal(Idle.chooseVisiblePair(dto,[[0,1]],()=>{throw Error('no scan');}),null);
  assert.equal(Idle.chooseVisiblePair(dto,[],()=>{throw Error('not called');}),null);
  assert.equal(Idle.chooseVisiblePair({...dto,movesLeft:0},[[0,1]],()=>[0,1,2]),null);
  assert.equal(Idle.chooseVisiblePair({...dto,layers:[0,0,0,0],score:10},[[0,1]],()=>[0,1,2]),null);
  assert.equal(Idle.chooseVisiblePair({...dto,targetMode:'exact',score:11},[[0,1]],()=>[0,1,2]),null);
  assert.equal(Idle.chooseVisiblePair(null,[],()=>[]),null);
});
test('selector avoids the previous canonical pair when another legal option exists and retains a sole move',()=>{
  const dto={values:[1,2,3,4],layers:[1,1,1,0],score:0,target:10,movesLeft:3},matches=()=>[0,1,2,3];
  assert.deepEqual(Idle.chooseVisiblePair(dto,[[0,1],[2,3]],matches),[0,1]);
  assert.deepEqual(Idle.chooseVisiblePair(dto,[[0,1],[2,3]],matches,[1,0]),[2,3]);
  assert.deepEqual(Idle.chooseVisiblePair(dto,[[1,0],[0,1]],matches,[0,1]),[0,1]);
  assert.deepEqual(Idle.chooseVisiblePair(dto,[[0,1],[2,3]],matches,[9,8]),[0,1]);
});
test('previous pair is transient per attempt and guides a different new-board choice',()=>{
  const contexts=[],dto={values:[1,2,3,4],layers:[1,1,1,0],score:0,target:10,movesLeft:3};
  const f=fixture({choose(context){contexts.push(context);return Idle.chooseVisiblePair(dto,[[0,1],[2,3]],()=>[0,1,2,3],context.previousPair);}});
  showFirst(f);assert.equal(contexts[0].previousPair,null);rearm(f);f.timer.advance(60000);assert.deepEqual(contexts[1].previousPair,[0,1]);assert(Object.isFrozen(contexts[1]));assert(Object.isFrozen(contexts[1].previousPair));assert.deepEqual(f.shown[1].pair,[2,3]);
  f.set({attemptId:'b',boardKey:'b0'});f.timer.advance(60000);assert.equal(contexts[2].previousPair,null);assert.deepEqual(f.shown[2].pair,[0,1]);f.policy.dispose();
});

let passed=0;for(const item of tests){try{item.run();passed++;}catch(error){console.error('FAIL: '+item.name);throw error;}}
console.log('Idle hint checks passed: '+passed+' groups; controlled clocks, rearm/quota/stale guards and actual-engine visible-only ranking.');
