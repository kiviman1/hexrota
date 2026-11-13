/* Interaction regressions that exercise pointer and nonzero animation paths. */
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const root=__dirname+'/dist/';
const appSource=fs.readFileSync(root+'app.js','utf8');
const storageKey=appSource.match(/const key\s*=\s*['"]([^'"]+)['"]/)?.[1];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const unhandled=[],domErrors=[];
process.on('unhandledRejection',reason=>unhandled.push(reason?.message||String(reason)));

function mount({motion='none',current=0,done=[]}={}){
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
    w.Element.prototype.animate=function(_frames,options={}){
      if(motion==='throw')throw new Error('Simulated SVG animation API failure');
      let finished,resolve,reject,timer;
      const animation={
        cancelled:false,
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
  if(storageKey)w.localStorage.setItem(storageKey,JSON.stringify({current,done,boards:{},sound:false}));
  for(const file of ['levels.js','engine.js','app.js'])w.eval(fs.readFileSync(root+file,'utf8'));
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
  function click(id){const element=d.getElementById(id);assert(element,`#${id} exists`);element.click();}
  function readSave(){return JSON.parse(w.localStorage.getItem(storageKey));}
  function assertState(game,message){
    assert.equal(+d.getElementById('sum').textContent,game.score,message+' score');
    assert.equal(+d.getElementById('moves-left').textContent,game.movesLeft,message+' moves');
    assert.equal(d.querySelectorAll('.floor-green').length,game.covered,message+' ground');
  }
  function isBusy(){return board.getAttribute('aria-busy')==='true';}
  async function idle(timeout=1400){const start=Date.now();while(isBusy()&&Date.now()-start<timeout)await pause(10);await pause(5);assert(!isBusy(),'presentation releases board before timeout');}
  function assertUnlocked(){assert.equal(board.getAttribute('aria-busy'),'false');assert.equal(d.getElementById('reset').disabled,false);}
  return {dom,w,d,board,errors,captureCalls,activeCaptures,animations,send,tap,click,setHit,readSave,assertState,isBusy,idle,assertUnlocked,close:()=>dom.window.close()};
}

const cases=[];
function test(name,run){cases.push({name,run});}

test('second touch with 10px jitter still swaps selected neighbors',async()=>{
  const f=mount();try{
    const level=f.w.HEX_LEVELS[0],pair=level.solution[0],game=new f.w.HexMatch(level);
    f.tap(pair[0]);
    f.send('pointerdown',pair[1],{x:50});
    f.send('pointermove',pair[1],{x:60});
    f.send('pointerup',pair[1],{x:60});
    game.swap(...pair);await f.idle();f.assertState(game,'jitter tap');
  }finally{f.close();}
});

test('stable SVG owns capture and cancellation allows the next gesture',async()=>{
  const f=mount();try{
    const level=f.w.HEX_LEVELS[0],pair=level.solution[0],game=new f.w.HexMatch(level);
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
    const level=f.w.HEX_LEVELS[0],pair=level.solution[0],game=new f.w.HexMatch(level);
    f.tap(pair[0]);f.tap(pair[1]);game.swap(...pair);
    await f.idle();f.assertUnlocked();f.assertState(game,'failed presentation preserves committed turn');
    assert.equal(f.readSave().boards[0].turn,1,'a failed effect never spends a second turn');
    f.click('reset');assert.equal(+f.d.getElementById('moves-left').textContent,level.moves);
  }finally{f.close();}
});

test('nonzero presentation supports skip and a strict total duration bound',async()=>{
  const f=mount({motion:'normal'});try{
    const level=f.w.HEX_LEVELS[0],pair=level.solution[0],game=new f.w.HexMatch(level);
    f.tap(pair[0]);f.tap(pair[1]);game.swap(...pair);
    assert(f.isBusy(),'test actually enters the animated path');
    assert(f.animations.length>0,'test actually calls the animation API');
    const skip=f.d.getElementById('skip-animation');assert(skip&&!skip.hidden,'visible skip control during effects');
    f.click('skip-animation');await f.idle(150);f.assertUnlocked();f.assertState(game,'skipped presentation');
    f.click('reset');const start=Date.now();f.tap(pair[0]);f.tap(pair[1]);await f.idle(1400);
    assert(Date.now()-start<1400,'long chains finish within the bounded presentation budget');
    f.assertState(game,'natural presentation completion');
  }finally{f.close();}
});

test('a tap during a cascade reveals the committed result without an extra move',async()=>{
  const f=mount({motion:'normal'});try{
    const level=f.w.HEX_LEVELS[0],pair=level.solution[0],game=new f.w.HexMatch(level);
    f.tap(pair[0]);f.tap(pair[1]);game.swap(...pair);assert(f.isBusy());
    assert.notEqual(f.w.getComputedStyle(f.board).pointerEvents,'none','busy board remains hit-testable for the reveal tap');
    f.tap(0,{id:7});await f.idle(150);f.assertState(game,'fast-forward tap');
    assert.equal(f.readSave().boards[0].turn,1,'fast-forward touch does not initiate the next turn');
    assert.equal(f.d.querySelectorAll('.selected').length,0,'the reveal tap is consumed');
  }finally{f.close();}
});

test('backgrounding fast-forwards once and late awaits do not redraw old frames',async()=>{
  const f=mount({motion:'normal'});try{
    const level=f.w.HEX_LEVELS[0],pair=level.solution[0],game=new f.w.HexMatch(level);
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
  }finally{f.close();}
});

test('reset and unlocked level navigation cancel presentation without stale persistence',async()=>{
  const f=mount({motion:'normal',done:[0]});try{
    const level=f.w.HEX_LEVELS[0],pair=level.solution[0];
    f.tap(pair[0]);f.tap(pair[1]);assert(f.isBusy());
    assert.equal(f.d.getElementById('reset').disabled,false,'restart remains available while effects run');
    f.click('reset');await f.idle(150);assert.equal(+f.d.getElementById('sum').textContent,0);assert.equal(+f.d.getElementById('moves-left').textContent,level.moves);
    await pause(250);assert.equal(f.readSave().boards[0].turn,0,'cancelled animation cannot resave the old turn');
    f.tap(pair[0]);f.tap(pair[1]);assert(f.isBusy());
    const next=f.d.querySelector('[data-level="1"]');assert(next&&!next.disabled,'unlocked navigation remains available');next.click();
    await f.idle(150);const game=new f.w.HexMatch(f.w.HEX_LEVELS[1]);
    f.assertState(game,'new level');await pause(250);f.assertState(game,'after stale await');
    assert.equal(f.readSave().current,1,'old animation cannot switch or persist the previous active level');
  }finally{f.close();}
});

(async()=>{
  const failed=[];
  for(const {name,run} of cases){try{await run();console.log('✓ '+name);}catch(error){failed.push({name,error});console.error('✗ '+name+': '+error.message);}}
  await pause(20);
  if(unhandled.length)failed.push({name:'unhandled rejections',error:new Error(unhandled.join('; '))});
  if(domErrors.length)failed.push({name:'uncaught DOM errors',error:new Error(domErrors.join('; '))});
  if(failed.length){console.error(`${failed.length} input regression check(s) failed.`);process.exitCode=1;}
  else console.log('Input checks passed: pointer jitter/capture, animation failures, bounded/skip presentation, busy touches, visibility and cancellation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
