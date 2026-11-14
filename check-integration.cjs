/* Cross-PR integration: real pointer recognition, atomic saves, energy and opt-in observations. */
'use strict';
const assert=require('node:assert/strict');
const {mount,fresh,existing,lifePool,plain,enter,wait,until,NOW,MINUTE}=require('./check-lives-ui.cjs');
const PROFILE='hexrota-profile-v2',OBS='hexrota-playtest-v1';
const tests=[],errors=[];
process.on('unhandledRejection',error=>errors.push(error?.message||String(error)));
function test(name,run){tests.push({name,run});}
const profile=f=>JSON.parse(f.w.localStorage.getItem(PROFILE));
const observed=f=>JSON.parse(f.w.localStorage.getItem(OBS)||'null');
const events=(f,name)=>observed(f)?.events.filter(row=>row.name===name)||[];
function enable(f){f.click('#settings');f.change('#setting-playtest',true);f.click('#settings-done');assert.equal(observed(f).enabled,true);}
function setupPointer(f){
 const board=f.node('#board'),scale=.65,x=450,y=400;let hit=null;
 Object.defineProperty(f.w,'innerWidth',{configurable:true,value:1000});Object.defineProperty(f.w,'innerHeight',{configurable:true,value:1000});
 board.getScreenCTM=()=>({a:scale,b:0,c:0,d:scale,e:x,f:y,inverse(){return {a:1/scale,b:0,c:0,d:1/scale,e:-x/scale,f:-y/scale};}});
 board.createSVGPoint=()=>({x:0,y:0,matrixTransform(m){return {x:m.a*this.x+m.c*this.y+m.e,y:m.b*this.x+m.d*this.y+m.f};}});
 f.d.elementFromPoint=()=>hit===null?board:f.node(`#board [data-index="${hit}"]`);
 function center(index){const position=f.node(`#board [data-index="${index}"]`).getAttribute('transform').match(/-?[\d.]+/g).map(Number);return {x:position[0]*scale+x,y:position[1]*scale+y};}
 function send(type,index,point,{id=1,target,primary=true}={}){hit=index;const event=new f.w.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:id,pointerType:'touch',isPrimary:primary,button:0,buttons:type==='pointerup'?0:1,clientX:point.x,clientY:point.y});(target||(type==='pointerdown'?f.node(`#board [data-index="${index}"]`):f.w)).dispatchEvent(event);}
 return {board,center,send};
}
function beginSwipe(f,pair,{fraction=.44,duplicate=true,cancel=false}={}){
 const input=setupPointer(f),from=input.center(pair[0]),to=input.center(pair[1]),end={x:from.x+(to.x-from.x)*fraction,y:from.y+(to.y-from.y)*fraction};
 input.send('pointerdown',pair[0],from);input.send('pointermove',pair[0],end);
 if(cancel)input.send('pointercancel',pair[0],end);
 input.send('pointerup',pair[0],end);if(duplicate)input.send('pointerup',pair[0],end);return input;
}
async function swipe(f,pair,options){const input=beginSwipe(f,pair,options);await until(()=>input.board.getAttribute('aria-busy')==='false','integrated pointer presentation completes');}
function failureRoute(f){const level=f.game().level;for(let policy=0;policy<120;policy++){const game=new f.w.HexMatch(level);while(game.status==='playing'){const legal=game.legalMoves();game.swap(...legal[(game.turn*7+policy)%legal.length]);}if(game.status==='lost')return plain(game.history);}throw Error('No real failed route found');}
function rejectCanonicalWrites(f){const native=f.w.Storage.prototype.setItem;f.w.Storage.prototype.setItem=function(key,value){if(key===PROFILE)throw new f.w.DOMException('integration quota','QuotaExceededError');return native.call(this,key,value);};return ()=>{f.w.Storage.prototype.setItem=native;};}
function assertNoNetwork(f){assert.deepEqual(f.network,[],'integrated game, life and observations stay local');}
function resume(f){f.return();if(f.node('#pause-dialog').open)f.click('#pause-continue');}

test('short pointer swipe commits one exact variant result and one observation; cancel never commits',async()=>{
 const f=mount({saved:fresh(5)});try{
  enable(f);await enter(f);const model=f.game(),before=plain(model.snapshot()),pair=plain(model.level.solution[0]),energy=plain(f.life());model.swap(...pair);
  await swipe(f,pair,{cancel:true});assert.deepEqual(plain(f.game().snapshot()),before);assert.equal(events(f,'move').length,0);
  const original=f.w.HexMatch.prototype.swap;let instance=null,calls=0;
  f.w.HexMatch.prototype.swap=function(a,b){if(instance===null)instance=this;if(this===instance)calls++;return original.call(this,a,b);};
  await swipe(f,pair);f.w.HexMatch.prototype.swap=original;
  assert.equal(calls,1,'duplicate pointerup cannot make another attempt');assert.deepEqual(plain(f.game().snapshot()),plain(model.snapshot()));
  assert.equal(events(f,'move').length,1);assert.equal(events(f,'move')[0].data.turn,model.turn);assert.deepEqual(events(f,'move')[0].data.pair,pair);
  assert.deepEqual(profile(f).game,f.save());assert.deepEqual(profile(f).energy,f.life());assert.equal(f.life().life.lives,energy.life.lives);assert.equal(model.rngState,profile(f).game.boards[5].rngState);assertNoNetwork(f);
 }finally{f.close();}
});

test('quota-failed swipe rolls back board, life, events and move observations; one retry commits once',async()=>{
 const f=mount({saved:fresh(5)});try{
  enable(f);await enter(f);const canonical=plain(profile(f)),observations=plain(observed(f).events),localEvents=plain(f.events()),model=f.game(),pair=plain(model.level.solution[0]);model.swap(...pair);
  const restore=rejectCanonicalWrites(f);await swipe(f,pair);
  assert.deepEqual(profile(f),canonical,'canonical failure preserves every durable game/life field');assert.deepEqual(f.events(),localEvents,'local lifecycle events have no phantom move');
  assert.deepEqual(observed(f).events,observations,'a rolled-back swipe must not remain in exported observations');
  restore();resume(f);await swipe(f,pair);assert.deepEqual(plain(f.game().snapshot()),plain(model.snapshot()));assert.equal(events(f,'move').length,1,'only the durable retry is recorded');assert.equal(f.life().life.lives,5);assertNoNetwork(f);
 }finally{f.close();}
});

test('quota-failed final swipe cannot record a failed level or spend life; recovery settles once',async()=>{
 const f=mount({saved:fresh(11)});try{
  enable(f);await enter(f);const route=failureRoute(f);for(const pair of route.slice(0,-1))await swipe(f,pair);
  const canonical=plain(profile(f)),observations=plain(observed(f).events),id=f.save().attempts[11].attemptId,restore=rejectCanonicalWrites(f);
  await swipe(f,route.at(-1));assert.deepEqual(profile(f),canonical);assert.equal(f.life().life.lives,5);assert.deepEqual(observed(f).events,observations,'no ghost last move or failure in local exports');assert.equal(events(f,'level_failed').length,0);
  restore();resume(f);await swipe(f,route.at(-1));await until(()=>f.node('#lose-dialog').open,'only the saved terminal result opens');assert.equal(f.life().life.lives,4);assert.equal(events(f,'level_failed').length,1);assert.equal(events(f,'move').length,route.length);
  assert.equal(f.w.HexLives.createManager(f.w.HEX_LIVES_CONFIG,{clock:()=>f.now}).settlementFor(f.life().life,id).charged,true);
  f.click('#retry');assert.equal(f.life().life.lives,4);assert.notEqual(f.save().attempts[11].attemptId,id);assert.equal(events(f,'level_retried').length,1);assertNoNetwork(f);
 }finally{f.close();}
});

test('quota-failed restart restores attempt, selector and observations before a clean confirmed retry',async()=>{
 const f=mount({saved:fresh(5)});try{
  enable(f);await enter(f);await swipe(f,plain(f.game().level.solution[0]));const canonical=plain(profile(f)),observations=plain(observed(f).events),oldId=f.save().attempts[5].attemptId,restore=rejectCanonicalWrites(f);
  f.click('#reset');f.click('#restart-confirm');assert.deepEqual(profile(f),canonical);assert.deepEqual(observed(f).events,observations,'uncommitted retry cannot invent abandonment or a new start');
  restore();resume(f);f.click('#reset');f.click('#restart-confirm');assert.equal(f.life().life.lives,4);assert.notEqual(f.save().attempts[5].attemptId,oldId);assert.equal(f.game().turn,0);assert.equal(events(f,'level_abandoned').length,1);assert.equal(events(f,'level_retried').length,1);assert.equal(events(f,'level_started').length,2);assertNoNetwork(f);
 }finally{f.close();}
});

test('legacy in-flight game resumes at zero lives and swipe retains original replay identity across reload',async()=>{
 const entry=existing(2,{legacy:true}),f=mount({saved:entry.saved,life:lifePool(0)});let next;
 try{
  enable(f);await enter(f);assert.deepEqual(plain(f.game().snapshot()),plain(entry.game.snapshot()));assert.equal(f.life().life.lives,0);const id=plain(f.save().attempts[2]);
  assert.equal(id.variantId,'legacy-original');assert.equal(events(f,'level_started').length,0);assert.equal(events(f,'attempt_resumed').length,1);
  const model=f.game(),pair=plain(model.level.solution[model.turn]);model.swap(...pair);await swipe(f,pair);assert.deepEqual(plain(f.game().snapshot()),plain(model.snapshot()));assert.deepEqual(f.save().attempts[2],id);
  const canonical=plain(profile(f));next=mount({profile:canonical});await enter(next);assert.deepEqual(plain(next.game().snapshot()),plain(model.snapshot()));assert.deepEqual(next.save().attempts[2],id);assert.equal(next.life().life.lives,0);assertNoNetwork(f);assertNoNetwork(next);
 }finally{f.close();next?.close();}
});

test('unlimited entitlement survives expiry through an observed failure and later callback/reload',async()=>{
 const f=mount({saved:fresh(11)});let next;
 try{
  enable(f);f.click('#home-lives');f.click('#lives-buy-unlimited');f.click('#life-provider-confirm');f.click('#lives-wait');await enter(f);
  const id=f.save().attempts[11].attemptId,route=failureRoute(f);assert.equal(f.life().life.registeredAttempts[id].unlimitedAtStart,true);
  f.now=NOW+31*MINUTE;resume(f);assert.equal(f.life().life.unlimitedUntilUtc,null);for(const pair of route)await swipe(f,pair);
  await until(()=>f.node('#lose-dialog').open,'observed unlimited attempt reaches its real loss');assert.equal(f.life().life.lives,5);assert.equal(events(f,'level_failed').length,1);assert.equal(events(f,'level_failed')[0].data.developerBypass,false);
  const manager=f.w.HexLives.createManager(f.w.HEX_LIVES_CONFIG,{clock:()=>f.now}),settled=manager.settlementFor(f.life().life,id);assert.equal(settled.waiver,'unlimited');assert.equal(settled.charged,false);
  next=mount({profile:plain(profile(f)),now:f.now});assert.equal(next.life().life.lives,5);assert.equal(manager.settlementFor(next.life().life,id).waiver,'unlimited');assertNoNetwork(f);assertNoNetwork(next);
 }finally{f.close();next?.close();}
});


test('later nontransactional presentation write failure cannot rewind an already committed move observation',async()=>{
 const saved=fresh(5);saved.preferences.motion='full';const f=mount({saved});try{
  f.w.Element.prototype.animate=function(){return {finished:Promise.resolve(),cancel(){}};};enable(f);await enter(f);
  const model=f.game(),pair=plain(model.level.solution[0]);model.swap(...pair);const input=beginSwipe(f,pair,{duplicate:false});
  assert.equal(input.board.getAttribute('aria-busy'),'true');assert.deepEqual(plain(f.game().snapshot()),plain(model.snapshot()),'the real move is durable before presentation finishes');assert.equal(events(f,'move').length,1);
  const canonical=plain(profile(f)),observations=plain(observed(f).events),restore=rejectCanonicalWrites(f);
  input.send('pointerdown',0,input.center(0),{id:2});await until(()=>input.board.getAttribute('aria-busy')==='false','nontransactional busy input settles presentation');
  assert.deepEqual(profile(f),canonical);assert.deepEqual(observed(f).events,observations,'later cosmetic persistence failure cannot restore an older telemetry baseline');assert.equal(events(f,'move').length,1);restore();resume(f);assert.deepEqual(plain(f.game().snapshot()),plain(model.snapshot()));assertNoNetwork(f);
 }finally{f.close();}
});

(async()=>{let failed=0;for(const {name,run}of tests)try{await run();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+(error.stack||error));}assert.deepEqual(errors,[],'no unhandled integration promises');if(failed)process.exitCode=1;else console.log('Integration checks passed: '+tests.length+' real-app groups covering pointer input, atomic game/life/telemetry rollback, legacy replay and entitlement continuity.');})().catch(error=>{console.error(error);process.exitCode=1;});
