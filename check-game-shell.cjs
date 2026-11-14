/* Native game-shell regressions: viewport changes, zoom gestures and real input. */
'use strict';
const assert=require('node:assert/strict');
const {loadGame,savedLevel,savedGame,confirmRestart}=require('./qa-fixtures.cjs');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=__dirname+'/dist/',key='hexrota-match-v5';
const read=file=>fs.readFileSync(root+file,'utf8');
const tests=[],errors=[],unhandled=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function test(name,run){tests.push({name,run});}
function mount({viewport=true}={}){
 const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(read('index.html'),{url:'https://hexrota-shell.example/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,d=w.document;
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};
 Object.defineProperty(w,'innerHeight',{configurable:true,writable:true,value:844});
 const visual=new w.EventTarget();Object.assign(visual,{height:844,width:390,scale:1});
 Object.defineProperty(w,'visualViewport',{configurable:true,value:viewport?visual:undefined});
 let capture=null,hit=null;
 w.Element.prototype.setPointerCapture=function(id){capture=id;};
 w.Element.prototype.hasPointerCapture=id=>capture===id;
 w.Element.prototype.releasePointerCapture=()=>{capture=null;};
 d.elementFromPoint=()=>hit===null?null:d.querySelector(`#board [data-index="${hit}"]`);
 class AudioStub{configure(){}unlock(){return Promise.resolve();}setActive(){}move(){}victory(){}click(){}stop(){}dispose(){}}
 w.HexAudio=AudioStub;
 w.localStorage.setItem(key,JSON.stringify({current:2,done:[0,1],boards:{},sound:false}));
 loadGame(w,['engine.js','levels.js','tutorials.js','app.js'],read,{originalBoards:[2]});
 const style=d.createElement('style');style.textContent=read('style.css');d.head.append(style);
 const node=id=>{const n=d.getElementById(id);assert(n,'#'+id+' exists');return n;};
 const click=id=>node(id).click();
 const save=()=>JSON.parse(w.localStorage.getItem(key));
 const fingerprint=()=>JSON.stringify(save().boards[save().current]);
 function event(type,properties={},target=d){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,properties);target.dispatchEvent(e);return e;}
 function pointer(type,index,id=1){
  hit=index;
  const target=type==='pointerdown'?d.querySelector(`#board [data-index="${index}"]`):node('board');
  return event(type,{pointerId:id,pointerType:'touch',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:50,clientY:50},target);
 }
 function tap(index,id=1){pointer('pointerdown',index,id);pointer('pointerup',index,id);}
 function enter(){click('home-play');if(node('pregame-dialog').open)click('pregame-start');assert.equal(d.body.dataset.screen,'game');}
 function resize(height,{scale=1,type='resize',onVisual=true}={}){
  visual.height=height;visual.scale=scale;w.innerHeight=height;
  (viewport&&onVisual?visual:w).dispatchEvent(new w.Event(type));
 }
 return {w,d,visual,node,click,event,pointer,tap,enter,resize,save,fingerprint,
  height:()=>d.documentElement.style.getPropertyValue('--app-height'),
  close:()=>dom.window.close()};
}

test('game mode hides website chrome while menu navigation remains available',()=>{
 const markup=new JSDOM(read('index.html'));
 const viewport=new Map(markup.window.document.querySelector('meta[name="viewport"]').content.split(',').map(part=>part.trim().split(/\s*=\s*/)));
 markup.window.close();
 assert.equal(Number(viewport.get('maximum-scale')),1);
 assert(['no','0'].includes(viewport.get('user-scalable')));
 const f=mount();try{
  const header=f.d.querySelector('.site-header');assert(header);
  assert.notEqual(f.w.getComputedStyle(header).display,'none','home retains its navigation');
  f.enter();
  for(const selector of ['.site-header','.intro','.journey','.app-navigation','footer','.stage-note']){
   const n=f.d.querySelector(selector);assert(n,selector+' exists');
   assert.equal(f.w.getComputedStyle(n).display,'none',selector+' is removed from game presentation');
  }
  assert.equal(f.w.getComputedStyle(f.d.body).overflow,'hidden','game document cannot scroll');
  assert.notEqual(f.w.getComputedStyle(f.node('board')).display,'none','board remains visible');
  for(const id of ['sum','target','moves-left','pause','hint','reset'])assert(f.node(id),'HUD and core controls remain reachable');
  f.click('game-home');assert.equal(f.d.body.dataset.screen,'home');
  assert.notEqual(f.w.getComputedStyle(header).display,'none','home chrome returns after leaving game');
 }finally{f.close();}
});

test('the board help strip is removed without losing controls or accessible status',()=>{
 const f=mount();try{
  f.enter();
  assert.equal(f.d.querySelector('.board-legend'),null,'permanent legend was removed');
  const status=f.node('board-status'),description=f.node('status-text');
  assert.equal(status.getAttribute('aria-live'),'polite','status announcements remain live');
  assert(description.classList.contains('sr-only'),'status is available to screen readers without visual text');
  const layout=f.w.getComputedStyle(status);
  assert.equal(layout.minHeight,'0px','status has no reserved height');
  assert.equal(layout.paddingTop,'0px','no upper status gap');
  assert.equal(layout.paddingBottom,'0px','no lower status gap');
  assert(f.node('continue')&&f.node('skip-animation'),'continue and animation skip controls remain');
 }finally{f.close();}
});

test('visible viewport changes fit the shell without changing the active checkpoint',()=>{
 const f=mount();try{
  assert.equal(f.height(),'844px');f.enter();
  const pair=f.w.HEX_LEVELS[0].solution[0];f.tap(pair[0]);f.tap(pair[1]);
  const checkpoint=f.fingerprint();assert.equal(f.save().boards[2].turn,1,'fixture commits a real move');
  f.resize(632);assert.equal(f.height(),'632px');assert.equal(f.fingerprint(),checkpoint);
  f.resize(390,{onVisual:false,type:'orientationchange'});assert.equal(f.height(),'390px');assert.equal(f.fingerprint(),checkpoint);
  f.resize(195,{scale:2});assert.equal(f.height(),'390px','a temporary pinch does not collapse the game canvas');
  assert.equal(f.fingerprint(),checkpoint);assert.equal(f.d.body.dataset.screen,'game');
  f.resize(724,{scale:1});assert.equal(f.height(),'724px');assert.equal(f.fingerprint(),checkpoint);
 }finally{f.close();}
 const fallback=mount({viewport:false});try{assert.equal(fallback.height(),'844px');fallback.resize(620,{onVisual:false});assert.equal(fallback.height(),'620px','older browsers use innerHeight');}finally{fallback.close();}
});

test('pinches cancel pending pointers and leave the next real swap usable',()=>{
 const f=mount();try{
  f.enter();const pair=f.w.HEX_LEVELS[0].solution[0],before=f.fingerprint();
  f.pointer('pointerdown',pair[0],8);
  assert(f.event('touchstart',{touches:[{},{}]}).defaultPrevented);
  f.pointer('pointerup',pair[0],8);assert.equal(f.fingerprint(),before,'pinch consumes no move');
  for(const type of ['gesturestart','gesturechange','gestureend'])assert(f.event(type).defaultPrevented,type+' is canceled');
  assert(f.event('touchmove',{touches:[{},{}]}).defaultPrevented);
  assert(!f.event('touchstart',{touches:[{}]}).defaultPrevented,'single touches remain available');
  assert(!f.event('touchmove',{touches:[{}]}).defaultPrevented,'dialog scrolling is not blanket-canceled');
  f.tap(pair[0],9);f.tap(pair[1],10);
  assert.equal(f.save().boards[2].turn,1,'fresh taps still produce exactly one real swap');
  assert.equal(f.node('board').getAttribute('aria-busy'),'false');
 }finally{f.close();}
});

test('browser zoom shortcuts are blocked without consuming regular input or settings controls',()=>{
 const f=mount();try{
  f.enter();
  for(const modifier of ['ctrlKey','metaKey']){
   assert(f.event('wheel',{[modifier]:true}).defaultPrevented);
   for(const key of ['+','-','=','0']){
    const event=new f.w.KeyboardEvent('keydown',{key,[modifier]:true,cancelable:true,bubbles:true});f.w.dispatchEvent(event);assert(event.defaultPrevented,modifier+' '+key);
   }
  }
  assert(!f.event('wheel').defaultPrevented,'normal scrolling remains available');
  f.click('pause');f.click('pause-settings');assert(f.node('settings-dialog').open);
  const volume=f.node('setting-volume'),checkpoint=f.fingerprint();
  for(const options of [{key:'ArrowRight'},{key:'+'},{key:'a',ctrlKey:true}]){
   const event=new f.w.KeyboardEvent('keydown',{...options,bubbles:true,cancelable:true});volume.dispatchEvent(event);assert(!event.defaultPrevented,'ordinary form input remains available');
  }
  volume.value='40';volume.dispatchEvent(new f.w.Event('input',{bubbles:true}));assert.equal(f.save().preferences.volume,.4);
  assert.equal(f.fingerprint(),checkpoint,'settings do not alter the active board');
  for(const id of ['settings-dialog','pause-dialog']){
   f.w.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert(!f.node(id).open,'Escape closes only the top dialog');
  }
  assert.equal(f.d.body.dataset.screen,'game');f.click('game-home');assert.equal(f.d.body.dataset.screen,'home');
 }finally{f.close();}
});

(async()=>{
 let failed=0;
 for(const {name,run} of tests){try{await run();console.log('✓ '+name);}catch(error){failed++;console.error('✗ '+name+'\n'+error.stack);}}
 await wait(10);
 if(errors.length||unhandled.length){failed++;console.error({errors,unhandled});}
 if(failed)process.exitCode=1;else console.log('Game shell checks passed: scoped chrome, viewport stability, no-zoom gestures and usable game/settings input.');
})().catch(error=>{console.error(error);process.exitCode=1;});
