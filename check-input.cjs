/* Interaction regressions that exercise pointer and nonzero animation paths. */
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {loadGame,savedLevel,savedGame,confirmRestart}=require('./qa-fixtures.cjs');
const root=__dirname+'/dist/';
const appSource=fs.readFileSync(root+'app.js','utf8');
const storageKey=appSource.match(/const key\s*=\s*['"]([^'"]+)['"]/)?.[1];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const unhandled=[],domErrors=[];
process.on('unhandledRejection',reason=>unhandled.push(reason?.message||String(reason)));

const all=w=>[...w.HEX_TUTORIALS,...w.HEX_LEVELS];
function mount({motion='none',current=2,done=[0,1],boards={}}={}){
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
  loadGame(w,['levels.js','engine.js','tutorials.js','audio.js','app.js'],file=>fs.readFileSync(root+file,'utf8'),{originalBoards:current>=2?[current]:[]});
  d.querySelector('[data-nav="journey"]').click();
  const stage=d.querySelector(`[data-stage="${current}"]`);assert(stage&&!stage.disabled,'fixture stage is accessible');stage.click();
  assert(d.getElementById('pregame-dialog').open,'fixture uses real stage preview');d.getElementById('pregame-start').click();
  assert.equal(d.getElementById('game-screen').hidden,false,'fixture enters visible game');
  let hit=null;
  d.elementFromPoint=()=>typeof hit==='number'?d.querySelector(`#board [data-index="${hit}"]`):hit;
  const board=d.getElementById('board');
  function setHit(index){hit=index;}
  function send(type,index,{id=1,x=50,y=50,pointerType='touch',target}={}){
    if(index!==undefined)setHit(index);
    const event=new w.Event(type,{bubbles:true,cancelable:true});
    Object.assign(event,{pointerId:id,pointerType,isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y});
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
  return {dom,w,d,board,index:current,get level(){return savedLevel(w);},errors,captureCalls,activeCaptures,animations,send,tap,click,setHit,readSave,assertState,isBusy,idle,assertUnlocked,close:()=>dom.window.close()};
}

const cases=[];
function test(name,run){cases.push({name,run});}

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
  for(const {name,run} of cases){try{await run();console.log('✓ '+name);}catch(error){failed.push({name,error});console.error('✗ '+name+': '+error.message);}}
  await pause(20);
  if(unhandled.length)failed.push({name:'unhandled rejections',error:new Error(unhandled.join('; '))});
  if(domErrors.length)failed.push({name:'uncaught DOM errors',error:new Error(domErrors.join('; '))});
  if(failed.length){console.error(`${failed.length} input regression check(s) failed.`);process.exitCode=1;}
  else console.log('Input checks passed: pointer jitter/capture, animation failures, bounded/skip presentation, real survivor motion, burst effects, reduced motion and cancellation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
