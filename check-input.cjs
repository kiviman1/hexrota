/* Interaction regressions that exercise pointer and nonzero animation paths. */
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {loadGame,savedLevel,savedGame,confirmRestart}=require('./qa-fixtures.cjs');
const root=__dirname+'/dist/';
const appSource=fs.readFileSync(process.env.HEXROTA_INPUT_APP_SOURCE||root+'app.js','utf8');
const storageKey=appSource.match(/const key\s*=\s*['"]([^'"]+)['"]/)?.[1];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const unhandled=[],domErrors=[];
process.on('unhandledRejection',reason=>unhandled.push(reason?.message||String(reason)));

const all=w=>[...w.HEX_TUTORIALS,...w.HEX_LEVELS];
function mount({motion='none',current=2,done=[0,1],boards={},transform=null}={}){
  const errors=[],captureCalls=[],activeCaptures=new Map(),animations=[];
  const vc=new VirtualConsole();
  vc.on('jsdomError',error=>{errors.push(error.message);domErrors.push(error.message);});
  const dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'https://hexrota-input.example',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window,d=w.document;
  w.matchMedia=()=>({matches:motion==='none',addEventListener(){},removeEventListener(){}});
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
  w.Element.prototype.setPointerCapture=function(id){activeCaptures.set(id,this);captureCalls.push({id,target:this});};
  w.Element.prototype.hasPointerCapture=function(id){return activeCaptures.get(id)===this;};
  w.Element.prototype.releasePointerCapture=function(id){activeCaptures.delete(id);};
  if(motion!=='none'){
    w.Element.prototype.animate=function(frames,options={}){
      if(motion==='throw')throw new Error('Simulated SVG animation API failure');
      let finished,resolve,reject,timer;
      const animation={
        target:this,frames,options,cancelled:false,
        get finished(){
          if(!finished){
            if(motion==='reject')finished=Promise.reject(new Error('Simulated animation cancellation'));
            else finished=new Promise((yes,no)=>{resolve=yes;reject=no;timer=w.setTimeout(yes,Math.min(options.duration||50,60));});
          }
          return finished;
        },
        cancel(){this.cancelled=true;if(timer)w.clearTimeout(timer);if(reject)reject(new w.DOMException('Animation cancelled','AbortError'));},
        finish(){if(timer)w.clearTimeout(timer);if(resolve)resolve();},
        addEventListener(){},removeEventListener(){}
      };
      animations.push(animation);return animation;
    };
    w.Element.prototype.getAnimations=()=>animations;
  }
  if(storageKey)w.localStorage.setItem(storageKey,JSON.stringify({current,done,boards,sound:false}));
  loadGame(w,['levels.js','engine.js','tutorials.js','audio.js','app.js'],file=>file==='app.js'?appSource:fs.readFileSync(root+file,'utf8'),{originalBoards:current>=2?[current]:[]});
  d.querySelector('[data-nav="journey"]').click();
  const stage=d.querySelector(`[data-stage="${current}"]`);assert(stage&&!stage.disabled,'fixture stage is accessible');stage.click();
  assert(d.getElementById('pregame-dialog').open,'fixture uses real stage preview');d.getElementById('pregame-start').click();
  assert.equal(d.getElementById('game-screen').hidden,false,'fixture enters visible game');
  let hit=null;
  d.elementFromPoint=()=>typeof hit==='number'?d.querySelector(`#board [data-index="${hit}"]`):hit;
  const board=d.getElementById('board');
  const attempts=[];
  const originalSwap=w.HexMatch.prototype.swap;
  w.HexMatch.prototype.swap=function(a,b){attempts.push([a,b]);return originalSwap.call(this,a,b);};
  if(transform){
    const {scale=1,x=170,y=200}=transform;
    Object.defineProperty(w,'innerWidth',{value:1000,configurable:true});Object.defineProperty(w,'innerHeight',{value:900,configurable:true});
    board.getScreenCTM=()=>({a:scale,b:0,c:0,d:scale,e:x,f:y,inverse(){return {a:1/scale,b:0,c:0,d:1/scale,e:-x/scale,f:-y/scale};}});
    board.createSVGPoint=()=>({x:0,y:0,matrixTransform(m){return {x:m.a*this.x+m.c*this.y+m.e,y:m.b*this.x+m.d*this.y+m.f};}});
  }
  function center(index){
    const raw=d.querySelector(`#board [data-index="${index}"]`).getAttribute('transform').match(/-?[\d.]+/g).map(Number);
    const {scale=1,x=170,y=200}=transform||{};return {x:raw[0]*scale+x,y:raw[1]*scale+y};
  }
  function at(a,b,fraction=1,offset={x:0,y:0}){const from=center(a),to=center(b);return {x:from.x+(to.x-from.x)*fraction+offset.x,y:from.y+(to.y-from.y)*fraction+offset.y};}
  function setHit(index){hit=index;}
  function send(type,index,{id=1,x=50,y=50,pointerType='touch',target,primary=true,coalesced}={}){
    if(index!==undefined)setHit(index);
    const event=new w.Event(type,{bubbles:true,cancelable:true});
    Object.assign(event,{pointerId:id,pointerType,isPrimary:primary,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y});if(coalesced)event.getCoalescedEvents=()=>coalesced.map(point=>({clientX:point.x,clientY:point.y}));
    (target||((type==='pointerdown')?d.querySelector(`#board [data-index="${index}"]`):board)).dispatchEvent(event);
  }
  function tap(index,options={}){send('pointerdown',index,options);send('pointerup',index,options);}
  function click(id){const element=d.getElementById(id);assert(element,`#${id} exists`);element.click();if(id==='reset')confirmRestart(w);}
  function readSave(){return JSON.parse(w.localStorage.getItem(storageKey));}
  function assertState(game,message){
    assert.equal(+d.getElementById('sum').textContent,game.score,message+' score');
    assert.equal(+d.getElementById('moves-left').textContent,game.movesLeft,message+' moves');
    assert.equal(d.querySelectorAll('#board .floor-green').length,game.covered,message+' ground');
  }
  function isBusy(){return board.getAttribute('aria-busy')==='true';}
  async function idle(timeout=3600){const start=Date.now();while(isBusy()&&Date.now()-start<timeout)await pause(10);await pause(5);assert(!isBusy(),'presentation releases board before timeout');}
  function assertUnlocked(){assert.equal(board.getAttribute('aria-busy'),'false');assert.equal(d.getElementById('reset').disabled,false);}
  return {dom,w,d,board,index:current,attempts,center,at,get level(){return savedLevel(w);},errors,captureCalls,activeCaptures,animations,send,tap,click,setHit,readSave,assertState,isBusy,idle,assertUnlocked,close:()=>dom.window.close()};
}

const cases=[];
function test(name,run){cases.push({name,run});}

for(const [name,scale]of [['large',1],['small',.48]])test(`gesture short directional swipe inside the same stone is recognized on ${name} board`,async()=>{
 const f=mount({transform:{scale,x:250,y:350}});try{
  const pair=f.level.solution[0],start=f.center(pair[0]),finish=f.at(...pair,.44),before=f.readSave().boards[f.index];
  f.send('pointerdown',pair[0],start);f.send('pointermove',pair[0],finish);f.send('pointerup',pair[0],finish);await f.idle();
  assert.deepEqual(f.attempts,[Array.from(pair)],'direction is recognized even though pointerup still hits the source');
  const model=new f.w.HexMatch(f.level,before);model.swap(...pair);f.assertState(model,'short swipe');
 }finally{f.close();}
});

test('gesture entering the target then returning to the source preserves the intentional swap',async()=>{
 const f=mount({transform:{scale:.7,x:250,y:350}});try{
  const pair=f.level.solution[0],start=f.center(pair[0]),target=f.center(pair[1]);
  f.send('pointerdown',pair[0],start);f.send('pointermove',pair[1],target);f.send('pointermove',pair[0],start);f.send('pointerup',pair[0],start);await f.idle();
  assert.deepEqual(f.attempts,[Array.from(pair)],'a briefly crossed neighbor is remembered');
 }finally{f.close();}
});

test('gesture fast release, slow drag and coalesced samples each produce one attempt',async()=>{
 for(const mode of ['fast','slow','coalesced']){const f=mount({transform:{scale:.65,x:250,y:350}});try{
  const pair=f.level.solution[0],start=f.center(pair[0]),target=f.center(pair[1]);f.send('pointerdown',pair[0],start);
  if(mode==='slow')for(let i=1;i<=12;i++)f.send('pointermove',pair[0],f.at(...pair,i/12));
  if(mode==='coalesced')f.send('pointermove',pair[0],{...start,coalesced:[f.at(...pair,.5),target,start]});
  const finish=mode==='coalesced'?start:target;f.send('pointerup',pair[0],finish);f.send('pointerup',pair[1],finish);await f.idle();
  assert.deepEqual(f.attempts,[Array.from(pair)],mode+' produces exactly one attempt, including duplicate up');
 }finally{f.close();}}
});

test('gesture tile edge and unambiguous narrow gap start retain the source tile',async()=>{
 for(const mode of ['edge','gap']){const f=mount({transform:{scale:.65,x:250,y:350}});try{
  const pair=f.level.solution[0],from=f.center(pair[0]),to=f.center(pair[1]),distance=Math.hypot(to.x-from.x,to.y-from.y),offset=mode==='edge'?26:35;
  const start={x:from.x+(to.x-from.x)*offset*.65/distance,y:from.y+(to.y-from.y)*offset*.65/distance};
  const finish={x:start.x+(to.x-from.x)*.45,y:start.y+(to.y-from.y)*.45};
  f.setHit(null);f.send('pointerdown',undefined,{...start,target:f.board});f.send('pointermove',undefined,finish);f.send('pointerup',undefined,finish);await f.idle();
  assert.deepEqual(f.attempts,[Array.from(pair)],mode+' uses actual hex geometry when DOM hit misses');
 }finally{f.close();}}
});

test('gesture exact gap bisector and contradictory directions remain uncommitted',async()=>{
 const f=mount({transform:{scale:.7,x:250,y:350}});try{
  const pair=f.level.solution[0],start=f.at(...pair,.5),finish=f.center(pair[1]);f.setHit(null);
  f.send('pointerdown',undefined,{...start,target:f.board});f.send('pointermove',undefined,finish);f.send('pointerup',undefined,finish);assert.deepEqual(f.attempts,[],'exact gap bisector has no guessed source');
  const game=new f.w.HexMatch(f.level),index=game.neighbors.findIndex(n=>n.length===6),[first,second]=game.neighbors[index];
  f.send('pointerdown',index,f.center(index));f.send('pointermove',first,f.center(first));f.send('pointermove',second,f.center(second));f.send('pointerup',second,f.center(second));await f.idle();assert.deepEqual(f.attempts,[],'contradictory directions cancel rather than guess');
 }finally{f.close();}
});

test('gesture resize, orientation, visibility and page exit cancel held input',async()=>{
 for(const cancel of ['resize','orientationchange','visibilitychange','pagehide']){const f=mount({transform:{scale:.7,x:250,y:350}});try{
  const pair=f.level.solution[0];f.send('pointerdown',pair[0],f.center(pair[0]));f.send('pointermove',pair[1],f.center(pair[1]));
  (cancel==='visibilitychange'?f.d:f.w).dispatchEvent(new f.w.Event(cancel));f.send('pointerup',pair[1],f.center(pair[1]));await f.idle();assert.deepEqual(f.attempts,[],cancel+' cancels a held gesture');
 }finally{f.close();}}
});

test('gesture directions recognize all six neighbors independently of whether a match is legal',async()=>{
 const probe=mount();let index,neighbors;try{const g=new probe.w.HexMatch(probe.level);index=g.neighbors.findIndex(n=>n.length===6);neighbors=Array.from(g.neighbors[index]);}finally{probe.close();}
 for(const target of neighbors){const f=mount({transform:{scale:.6,x:250,y:350}});try{
  const start=f.center(index),finish=f.at(index,target,.52),before=JSON.stringify(f.readSave().boards[f.index]);
  const model=new f.w.HexMatch(f.level);const expected=model.swap(index,target);f.attempts.length=0;
  f.send('pointerdown',index,start);f.send('pointermove',index,finish);f.send('pointerup',index,finish);await f.idle();
  assert.deepEqual(f.attempts,[[index,target]],'exactly one recognized neighbor attempt');
  if(!expected.ok)assert.equal(JSON.stringify(f.readSave().boards[f.index]),before,'recognized invalid match preserves score, RNG and history');
  else f.assertState(model,'recognized valid neighbor');
 }finally{f.close();}}
});

test('gesture cancellation and competing touch do not commit a previously clear direction',async()=>{
 for(const cancel of ['pointercancel','lostpointercapture','second-touch','viewport','viewport-return']){const f=mount({transform:{scale:.7,x:250,y:350}});try{
  const pair=f.level.solution[0],start=f.center(pair[0]),target=f.center(pair[1]);
  f.send('pointerdown',pair[0],start);f.send('pointermove',pair[1],target);
  if(cancel==='second-touch')f.send('pointerdown',pair[1],{...target,id:2,primary:false});
  else if(cancel==='viewport-return')f.send('pointermove',pair[1],{x:-20,y:target.y});
  else if(cancel!=='viewport')f.send(cancel,pair[1],target);
  f.send('pointerup',pair[1],cancel==='viewport'?{x:-20,y:target.y}:target);await f.idle();
  assert.deepEqual(f.attempts,[],cancel+' never leaks an old target');
 }finally{f.close();}}
});

test('gesture jitter and an ambiguous halfway direction do not invent a swap',async()=>{
 const f=mount({transform:{scale:.7,x:250,y:350}});try{
  const g=new f.w.HexMatch(f.level),index=g.neighbors.findIndex(n=>n.length===6),p=f.center(index);
  f.send('pointerdown',index,p);f.send('pointermove',index,{x:p.x+7,y:p.y+3});f.send('pointerup',index,{x:p.x+7,y:p.y+3});assert.deepEqual(f.attempts,[]);
  const vectors=Array.from(g.neighbors[index]).map(i=>({i,p:f.center(i)})).sort((a,b)=>Math.atan2(a.p.y-p.y,a.p.x-p.x)-Math.atan2(b.p.y-p.y,b.p.x-p.x));
  const q={x:p.x+(vectors[0].p.x+vectors[1].p.x-2*p.x)*.32,y:p.y+(vectors[0].p.y+vectors[1].p.y-2*p.y)*.32};
  f.send('pointerdown',index,p);f.send('pointermove',index,q);f.send('pointerup',index,q);await f.idle();assert.deepEqual(f.attempts,[],'uncertain thirty-degree bisector remains uncommitted');
 }finally{f.close();}
});

test('second touch with 10px jitter still swaps selected neighbors',async()=>{
  const f=mount();try{
    const level=f.level,pair=level.solution[0],game=new f.w.HexMatch(level);
    f.tap(pair[0]);
    f.send('pointerdown',pair[1],{x:50});
    f.send('pointermove',pair[1],{x:60});
    f.send('pointerup',pair[1],{x:60});
    game.swap(...pair);await f.idle();f.assertState(game,'jitter tap');
  }finally{f.close();}
});

test('stable SVG owns capture and cancellation allows the next gesture',async()=>{
  const f=mount();try{
    const level=f.level,pair=level.solution[0],game=new f.w.HexMatch(level);
    f.send('pointerdown',pair[0],{id:3});
    assert(f.captureCalls.some(call=>call.id===3&&call.target===f.board),'capture is explicitly assigned to the stable board, not a replaced tile');
    f.activeCaptures.delete(3);
    f.send('lostpointercapture',pair[0],{id:3});
    f.send('pointerdown',pair[1],{id:4});f.send('pointercancel',pair[1],{id:4});
    f.tap(pair[0],{id:5});f.tap(pair[1],{id:6});
    game.swap(...pair);await f.idle();f.assertState(game,'after cancellation');
    assert.equal(f.activeCaptures.size,0,'no abandoned captured pointers');
  }finally{f.close();}
});

for(const motion of ['throw','reject'])test(`${motion} animation failure cannot lock controls`,async()=>{
  const f=mount({motion});try{
    const level=f.level,pair=level.solution[0],game=new f.w.HexMatch(level);
    f.tap(pair[0]);f.tap(pair[1]);game.swap(...pair);
    await f.idle();f.assertUnlocked();f.assertState(game,'failed presentation preserves committed turn');
    assert.equal(f.readSave().boards[f.index].turn,1,'a failed effect never spends a second turn');
    f.click('reset');assert.equal(+f.d.getElementById('moves-left').textContent,level.moves);
  }finally{f.close();}
});

test('nonzero presentation supports skip and a strict total duration bound',async()=>{
  const f=mount({motion:'normal'});try{
    const level=f.level,pair=level.solution[0],game=new f.w.HexMatch(level);
    f.tap(pair[0]);f.tap(pair[1]);game.swap(...pair);
    assert(f.isBusy(),'test actually enters the animated path');
    assert(f.animations.length>0,'test actually calls the animation API');
    const swaps=f.animations.filter(a=>a.target.classList.contains('gem')&&Array.isArray(a.frames)&&a.frames.length===2&&a.frames[0].transform==='translate(0px,0px)');
    assert.equal(swaps.length,2,'both swapped stones visibly slide');
    assert(swaps.every(a=>a.options.duration>=280),'the swap remains on screen long enough to follow');
    const skip=f.d.getElementById('skip-animation');assert(skip&&!skip.hidden,'visible skip control during effects');
    f.click('skip-animation');await f.idle(150);f.assertUnlocked();f.assertState(game,'skipped presentation');
    f.click('reset');const resetLevel=f.level,resetPair=resetLevel.solution[0],resetGame=new f.w.HexMatch(resetLevel);resetGame.swap(...resetPair);const start=Date.now();f.tap(resetPair[0]);f.tap(resetPair[1]);await f.idle(3600);
    assert(Date.now()-start<3600,'long chains finish within the bounded presentation budget');
    f.assertState(resetGame,'natural presentation completion');
  }finally{f.close();}
});

test('a tap during a cascade reveals the committed result without an extra move',async()=>{
  const f=mount({motion:'normal'});try{
    const level=f.level,pair=level.solution[0],game=new f.w.HexMatch(level);
    f.tap(pair[0]);f.tap(pair[1]);game.swap(...pair);assert(f.isBusy());
    assert.notEqual(f.w.getComputedStyle(f.board).pointerEvents,'none','busy board remains hit-testable for the reveal tap');
    f.tap(0,{id:7});await f.idle(150);f.assertState(game,'fast-forward tap');
    assert.equal(f.readSave().boards[f.index].turn,1,'fast-forward touch does not initiate the next turn');
    assert.equal(f.d.querySelectorAll('#board .selected').length,0,'the reveal tap is consumed');
  }finally{f.close();}
});

test('backgrounding fast-forwards once and late awaits do not redraw old frames',async()=>{
  const f=mount({motion:'normal'});try{
    const level=f.level,pair=level.solution[0],game=new f.w.HexMatch(level);
    f.tap(pair[0]);f.tap(pair[1]);game.swap(...pair);assert(f.isBusy());
    Object.defineProperty(f.d,'hidden',{configurable:true,value:true});
    Object.defineProperty(f.d,'visibilityState',{configurable:true,value:'hidden'});
    f.d.dispatchEvent(new f.w.Event('visibilitychange'));
    await f.idle(150);f.assertState(game,'background result');
    const after=f.board.innerHTML;
    Object.defineProperty(f.d,'hidden',{configurable:true,value:false});
    Object.defineProperty(f.d,'visibilityState',{configurable:true,value:'visible'});
    f.d.dispatchEvent(new f.w.Event('visibilitychange'));
    await pause(250);f.assertUnlocked();f.assertState(game,'foreground result');
    assert.equal(f.board.innerHTML,after,'late presentation work cannot restore stale frames');
    assert(f.d.getElementById('pause-dialog').open,'backgrounded game returns paused');f.click('pause-continue');f.assertState(game,'resume after background');
  }finally{f.close();}
});

test('reset and level preview navigation cancel presentation without stale persistence',async()=>{
  const f=mount({motion:'normal',done:[0,1,2]});try{
    const level=f.level,pair=level.solution[0];
    f.tap(pair[0]);f.tap(pair[1]);assert(f.isBusy());
    assert.equal(f.d.getElementById('reset').disabled,false,'restart remains available while effects run');
    f.click('reset');await f.idle(150);assert.equal(+f.d.getElementById('sum').textContent,0);assert.equal(+f.d.getElementById('moves-left').textContent,level.moves);
    await pause(250);assert.equal(f.readSave().boards[f.index].turn,0,'cancelled animation cannot resave the old turn');
    const nextPair=f.level.solution[0];f.tap(nextPair[0]);f.tap(nextPair[1]);assert(f.isBusy());
    const next=f.d.querySelector('[data-level="3"]');assert(next&&!next.disabled,'unlocked navigation remains available');next.click();
    await f.idle(150);assert(f.d.getElementById('pregame-dialog').open,'navigation shows objective preview');
    assert.equal(f.readSave().current,f.index,'preview does not choose a new active board');
    f.click('pregame-start');const game=savedGame(f.w);
    f.assertState(game,'new level');await pause(250);f.assertState(game,'after stale await');
    assert.equal(f.readSave().current,3,'old animation cannot switch or persist the previous active level');
  }finally{f.close();}
});

async function until(check,message,timeout=1300){const start=Date.now();while(!check()&&Date.now()-start<timeout)await pause(5);assert(check(),message);}
function yOffset(transform){
  if(typeof transform!=='string'||!/^translate/.test(transform))return null;
  const parts=transform.slice(transform.indexOf('(')+1,transform.lastIndexOf(')')).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number)||[];
  return transform.startsWith('translateY')?parts[0]:parts[1];
}
test('burst feedback and exact survivor falls preserve visible tile identity',async()=>{
  const scan=mount();let fixture;
  try{
    for(const [n,level]of scan.w.HEX_LEVELS.entries()){
      const game=new scan.w.HexMatch(level);
      for(const pair of level.solution){
        const checkpoint=game.snapshot(),result=game.swap(...pair),frame=result.frames[0];
        const movement=frame.falls.find(fall=>!fall.spawn&&fall.from!==fall.to&&frame.before[fall.to]===fall.value);
        if(movement){fixture={n,level,pair:Array.from(pair),checkpoint:JSON.parse(JSON.stringify(checkpoint)),movement};break;}
      }
      if(fixture)break;
    }
  }finally{scan.close();}
  assert(fixture,'at least one production frame moves a survivor onto an equal-valued destination');
  const index=fixture.n+2,f=mount({motion:'normal',current:index,done:Array.from({length:index},(_,i)=>i),boards:{[index]:fixture.checkpoint}});
  try{
    f.tap(fixture.pair[0]);f.tap(fixture.pair[1]);
    await until(()=>f.d.querySelector('.fx-layer .fx-particle'),'match creates particles');
    assert(f.d.querySelector('.fx-layer .fx-ring'),'match has a readable expanding ring');
    assert(f.d.querySelector('.fx-layer .fx-score'),'match displays its score near the action');
    const from=fixture.level.cells[fixture.movement.from],to=fixture.level.cells[fixture.movement.to];
    const expected=Math.sqrt(3)*44*((from.r+from.q/2)-(to.r+to.q/2));
    let fallAnimation;
    await until(()=>{
      fallAnimation=f.animations.find(animation=>{
        if(!animation.target.classList.contains('gem'))return false;
        if(+animation.target.closest('[data-index]')?.dataset.index!==fixture.movement.to)return false;
        const frames=animation.frames,offset=Array.isArray(frames)?yOffset(frames[0]?.transform):null;
        return offset!==null&&Math.abs(offset-expected)<.05;
      });return !!fallAnimation;
    },'same-valued survivor animates from its real previous coordinate');
    assert(fallAnimation.frames.every(frame=>frame.opacity===undefined||frame.opacity>0),'surviving gem stays visible rather than fading in');
    assert(fallAnimation.options.duration>=280,'surviving stones fall at a readable pace');
    f.click('skip-animation');await f.idle(150);
  }finally{f.close();}
});

test('reduced motion completes without particles, API calls or a presentation wait',async()=>{
  const f=mount();try{
    const game=new f.w.HexMatch(f.level),pair=f.level.solution[0];
    f.tap(pair[0]);f.tap(pair[1]);game.swap(...pair);await f.idle(150);
    assert.equal(f.animations.length,0);assert.equal(f.d.querySelectorAll('.fx-particle,.fx-ring').length,0);
    f.assertState(game,'reduced-motion result');
  }finally{f.close();}
});

(async()=>{
  const failed=[];
  for(const {name,run} of cases.filter(item=>!process.env.HEXROTA_INPUT_FILTER||new RegExp(process.env.HEXROTA_INPUT_FILTER).test(item.name))){try{await run();console.log('✓ '+name);}catch(error){failed.push({name,error});console.error('✗ '+name+': '+error.message);}}
  await pause(20);
  if(unhandled.length)failed.push({name:'unhandled rejections',error:new Error(unhandled.join('; '))});
  if(domErrors.length)failed.push({name:'uncaught DOM errors',error:new Error(domErrors.join('; '))});
  if(failed.length){console.error(`${failed.length} input regression check(s) failed.`);process.exitCode=1;}
  else console.log('Input checks passed: pointer jitter/capture, animation failures, bounded/skip presentation, real survivor motion, burst effects, reduced motion and cancellation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
