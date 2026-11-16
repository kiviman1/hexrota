/* Application-screen, menu and settings flows around the real puzzle engine. */
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {loadGame,savedLevel,savedGame,confirmRestart}=require('./qa-fixtures.cjs');
const root=__dirname+'/dist/',key='hexrota-match-v5';
const mounted=[],errors=[],unhandled=[];
process.on('unhandledRejection',e=>unhandled.push(e?.message||String(e)));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const settle=async()=>{await wait(2);await wait(2);};
async function until(fn,message,timeout=1800){const start=Date.now();while(!fn()&&Date.now()-start<timeout)await wait(5);assert(fn(),message);}
const copy=x=>JSON.parse(JSON.stringify(x));
function definitions(){const c={window:{},performance};vm.createContext(c);for(const f of ['engine.js','levels.js','tutorials.js'])vm.runInContext(fs.readFileSync(root+f,'utf8'),c);return {Engine:c.window.HexMatch,levels:[...c.window.HEX_TUTORIALS,...c.window.HEX_LEVELS]};}
function fixture(index=2,turns=1){const {Engine,levels}=definitions(),game=new Engine(levels[index]);for(const pair of levels[index].solution.slice(0,turns))assert(game.swap(...pair).ok);return {game,level:levels[index],snapshot:copy(game.snapshot())};}
function stateFor(index=2,turns=1){const f=fixture(index,turns);return {current:index,done:Array.from({length:index},(_,i)=>i),boards:{[index]:f.snapshot},sound:false,preferences:{music:false,volume:.65,motion:'auto',haptics:false},records:{}};}
function mount(state,options={}){
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{url:'https://hexrota-menu.example',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});mounted.push(dom);
 const w=dom.window,d=w.document,audio=[];
 w.matchMedia=()=>({matches:options.motion!==true,addEventListener(){},removeEventListener(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 Object.defineProperty(w.navigator,'vibrate',{configurable:true,value:()=>true});
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.scrollTo=()=>{};
 if(options.motion)w.Element.prototype.animate=function(){return {cancel(){},finished:Promise.resolve()};};
 class AudioStub{
  constructor(prefs={}){this.calls=[];audio.push(this);this.configure(prefs);}
  configure(prefs={}){this.config={...this.config,...prefs};this.calls.push(['configure',copy(prefs)]);}
  unlock(){this.calls.push(['unlock']);return Promise.resolve();}
  setActive(value){this.active=value;this.calls.push(['active',value]);}
  move(){this.calls.push(['move']);}victory(){this.calls.push(['victory']);}click(){this.calls.push(['click']);}stop(){this.active=false;}dispose(){this.disposed=true;}
 }
 w.HexAudio=AudioStub;
 if(state)w.localStorage.setItem(key,JSON.stringify(state));
 if(options.oldV4)w.localStorage.setItem('hexrota-match-v4',JSON.stringify(options.oldV4));
 loadGame(w,['engine.js','levels.js','tutorials.js','app.js'],file=>fs.readFileSync(root+file,'utf8'));
 return {dom,w,d,audio,save:()=>JSON.parse(w.localStorage.getItem(key)),close:()=>dom.window.close()};
}
function node(f,selector){const n=f.d.querySelector(selector);assert(n,selector+' exists');return n;}
function click(f,selector){node(f,selector).click();}
function change(f,id,value){const n=node(f,'#'+id);if(n.type==='checkbox')n.checked=value;else n.value=String(value);n.dispatchEvent(new f.w.Event('input',{bubbles:true}));n.dispatchEvent(new f.w.Event('change',{bubbles:true}));}
function screen(f,name){for(const s of ['home','journey','game','records','garden']){const target=f.d.getElementById(s+'-screen');if(target)assert.equal(target.hidden,s!==name,'only '+name+' screen is shown');}}
function keypress(f,key){f.w.dispatchEvent(new f.w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));}
function stage(f,index){return node(f,`[data-stage="${index}"]`);}
function closeDialog(f,id){const dialog=node(f,'#'+id);const close=dialog.querySelector('[data-close]');assert(close,id+' has a close action');close.click();}
async function enter(f){click(f,'#home-play');await settle();if(node(f,'#pregame-dialog').open){click(f,'#pregame-start');await settle();}screen(f,'game');}
async function swap(f,pair){const next=f.d.getElementById('coach-next');if(next&&!next.hidden)next.click();for(const index of pair)node(f,`#board [data-index="${index}"]`).dispatchEvent(new f.w.MouseEvent('click',{bubbles:true,detail:0}));await settle();}
function boardFingerprint(f){return JSON.stringify(f.save().boards);}
const tests=[];const test=(name,run)=>tests.push({name,run});

test('first play enters directly and later map previews remain nonmutating',async()=>{
 const f=mount();try{
  screen(f,'home');assert.equal(node(f,'#home-play-label').textContent.trim(),'Başlayalım');
  click(f,'#home-play');await settle();screen(f,'game');
  assert(!node(f,'#pregame-dialog').open,'the first start action opens T1 directly');
  const first=[...f.w.HEX_TUTORIALS,...f.w.HEX_LEVELS][0];
  assert.equal(f.save().current,0);
  assert.equal(+node(f,'#moves-left').textContent,first.moves);
  click(f,'[data-nav="home"]');screen(f,'home');
  click(f,'[data-nav="journey"]');screen(f,'journey');
  assert.equal(stage(f,0).disabled,false);
  assert.equal(f.d.querySelectorAll('[data-stage]:not(:disabled)').length<=3,true,'there are at most two lessons and one next campaign level to play');
  const before=boardFingerprint(f);stage(f,0).click();assert(node(f,'#pregame-dialog').open,'map entry retains its explicit preview');screen(f,'journey');
  assert.equal(+node(f,'#pregame-target').textContent,first.target);
  assert.equal(+node(f,'#pregame-moves').textContent,first.moves);
  closeDialog(f,'pregame-dialog');assert.equal(boardFingerprint(f),before,'canceling a preview preserves the untouched lesson');
 }finally{f.close();}
});

test('continue resumes an existing turn and map preview cancellation is nonmutating',async()=>{
 const initial=stateFor(3,1),f=mount(initial);try{
  screen(f,'home');assert(/devam/i.test(node(f,'#home-play-label').textContent));
  const before=boardFingerprint(f);await enter(f);
  assert(!node(f,'#pregame-dialog').open,'continue is direct');assert.equal(boardFingerprint(f),before,'continuing keeps exact board');
  click(f,'[data-nav="journey"]');screen(f,'journey');
  const current=f.save().current,boards=boardFingerprint(f);stage(f,0).click();
  assert(node(f,'#pregame-dialog').open);assert.equal(f.save().current,current);assert.equal(boardFingerprint(f),boards,'map preview cannot overwrite current progress');
  closeDialog(f,'pregame-dialog');assert.equal(f.save().current,current);
  stage(f,3).click();assert(!node(f,'#pregame-restart').hidden,'partial stage offers explicit restart');
  click(f,'#pregame-start');await settle();screen(f,'game');assert.equal(boardFingerprint(f),boards,'preview resume preserves exact checkpoint');
 }finally{f.close();}
});

test('completed levels disappear and fully cleared journeys lead to the garden',async()=>{
 const {Engine,levels}=definitions(),won=new Engine(levels[2]);for(const pair of levels[2].solution)won.swap(...pair);assert.equal(won.status,'won');
 const f=mount({current:2,done:[0,1,2],boards:{2:copy(won.snapshot())},sound:false});try{
  screen(f,'home');click(f,'#home-play');assert(node(f,'#pregame-dialog').open);assert(node(f,'#pregame-tag').textContent.includes('02'),'completed current advances to the next unfinished campaign stage');closeDialog(f,'pregame-dialog');
  const before=copy(f.save());click(f,'[data-nav="journey"]');assert.equal(f.d.querySelector('[data-stage="2"]'),null,'completed campaign level has no playable card');
  assert.equal(f.d.querySelector('[data-level="2"]'),null,'completed campaign level has no game selector');
  assert.deepEqual(f.save(),before,'opening the journey cannot reset the completed board');
 }finally{f.close();}
 const complete=mount({current:11,done:levels.map((_,i)=>i),boards:{},sound:false});try{
  assert.match(node(complete,'#home-play-label').textContent,/Bahçeni gör/i);
  click(complete,'#home-play');screen(complete,'garden');assert(!node(complete,'#pregame-dialog').open,'all complete does not offer campaign replay');
  assert.equal(complete.d.querySelectorAll('[data-stage]').length,2,'only free lessons remain selectable');
 }finally{complete.close();}
});

test('settings really persist, reset requires consent and keeps preferences',async()=>{
 const oldV4={current:7,done:[0,1,2,3,4,5,6],boards:{},sound:true},initial=stateFor(3,1),won=fixture(2,100);initial.boards[2]=won.snapshot;
 const f=mount(initial,{oldV4});try{
  click(f,'#settings');assert(node(f,'#settings-dialog').open);
  change(f,'setting-sfx',true);change(f,'setting-music',true);change(f,'setting-haptics',true);change(f,'setting-motion','reduce');change(f,'setting-volume',35);
  const set=f.save();assert.equal(set.sound,true);assert.equal(set.preferences.music,true);assert.equal(set.preferences.haptics,true);assert.equal(set.preferences.motion,'reduce');assert.equal(set.preferences.volume,.35);
  const before=copy(set);click(f,'#settings-reset');assert(node(f,'#reset-dialog').open);
  click(f,'#reset-cancel');assert.equal(JSON.stringify(f.save()),JSON.stringify(before),'cancel leaves progress and preferences alone');
  click(f,'#settings-reset');click(f,'#reset-confirm');await settle();
  const reset=f.save();assert.deepEqual(reset.done.filter(index=>index>=2),[2],'ordinary reset preserves permanent campaign completion');assert.equal(reset.current,3,'only the next incomplete campaign level is playable');assert(!reset.boards[3],'unfinished campaign checkpoint removed');
  assert.deepEqual(reset.economy,before.economy,'ordinary reset preserves Gold, stars, claims, inventory and permanent ledger');
  assert.equal(reset.sound,true);assert.deepEqual(reset.preferences,before.preferences,'progress reset does not reset preferences');
  assert.equal(f.w.localStorage.getItem('hexrota-match-v4'),JSON.stringify(oldV4),'older version data untouched');
  const reopened=mount(reset,{oldV4});try{assert.deepEqual(reopened.save().done.filter(index=>index>=2),[2],'reset does not resurrect older migration progress or reopen completed levels');assert.deepEqual(reopened.save().economy,reset.economy);assert.equal(reopened.save().preferences.volume,.35);screen(reopened,'home');}finally{reopened.close();}
 }finally{f.close();}
});

test('pause blocks moves and shortcuts, settings return to the same paused board',async()=>{
 const f=mount(stateFor(2,1));try{
  await enter(f);const before=boardFingerprint(f),saved=f.save(),game=new f.w.HexMatch(f.w.HEX_LEVELS[0],saved.boards[2]),pair=game.legalMoves()[0];
  click(f,'#pause');assert(node(f,'#pause-dialog').open);
  await swap(f,pair);keypress(f,'r');keypress(f,'h');await settle();assert.equal(boardFingerprint(f),before,'paused input cannot spend a turn or reset');
  click(f,'#pause-settings');assert(node(f,'#settings-dialog').open);
  change(f,'setting-motion','auto');closeDialog(f,'settings-dialog');
  assert(node(f,'#pause-dialog').open,'settings returns to pause');assert.equal(boardFingerprint(f),before);
  click(f,'#pause-continue');await settle();assert(!node(f,'#pause-dialog').open);screen(f,'game');assert.equal(boardFingerprint(f),before);
  click(f,'#pause');click(f,'#pause-home');screen(f,'home');
  keypress(f,'r');keypress(f,'h');await settle();assert.equal(boardFingerprint(f),before,'home shortcuts cannot mutate the paused game');
  await enter(f);assert.equal(boardFingerprint(f),before,'home continue resumes the same turn');
 }finally{f.close();}
});

test('nested Escape and browser back close the top modal before leaving the game',async()=>{
 const f=mount(stateFor(2,1));try{
  await enter(f);const before=boardFingerprint(f);click(f,'#pause');click(f,'#pause-settings');click(f,'#settings-reset');
  assert(node(f,'#pause-dialog').open&&node(f,'#settings-dialog').open&&node(f,'#reset-dialog').open);
  keypress(f,'Escape');assert(!node(f,'#reset-dialog').open,'Escape first cancels the destructive confirmation');assert(node(f,'#settings-dialog').open&&node(f,'#pause-dialog').open,'underlying settings and pause remain');
  assert.equal(boardFingerprint(f),before,'Escape never confirms progress deletion');
  keypress(f,'Escape');assert(!node(f,'#settings-dialog').open);assert(node(f,'#pause-dialog').open);
  keypress(f,'Escape');assert(!node(f,'#pause-dialog').open);screen(f,'game');assert.equal(boardFingerprint(f),before);
  click(f,'#pause');f.w.dispatchEvent(new f.w.PopStateEvent('popstate',{state:{screen:'home'}}));assert(!node(f,'#pause-dialog').open);screen(f,'game');
  f.w.dispatchEvent(new f.w.PopStateEvent('popstate',{state:{screen:'home'}}));screen(f,'home');assert.equal(boardFingerprint(f),before);
 }finally{f.close();}
});

test('backgrounding pauses a live game and returning cannot silently spend a move',async()=>{
 const f=mount(stateFor(2,1));try{
  await enter(f);const before=boardFingerprint(f);
  Object.defineProperty(f.d,'hidden',{configurable:true,value:true});Object.defineProperty(f.d,'visibilityState',{configurable:true,value:'hidden'});f.d.dispatchEvent(new f.w.Event('visibilitychange'));
  assert(node(f,'#pause-dialog').open);assert.equal(f.audio.at(-1)?.active,false,'music is inactive while hidden');
  Object.defineProperty(f.d,'hidden',{configurable:true,value:false});Object.defineProperty(f.d,'visibilityState',{configurable:true,value:'visible'});f.d.dispatchEvent(new f.w.Event('visibilitychange'));await settle();
  assert(node(f,'#pause-dialog').open,'returning remains paused until explicit Continue');assert.equal(boardFingerprint(f),before);
  click(f,'#pause-continue');assert(!node(f,'#pause-dialog').open);screen(f,'game');assert.equal(boardFingerprint(f),before);
 }finally{f.close();}
});

test('leaving during effects cannot open stale results above the menu',async()=>{
 const {Engine,levels}=definitions(),index=2,game=new Engine(levels[index]);
 for(const pair of levels[index].solution.slice(0,-1))game.swap(...pair);
 assert.equal(game.status,'playing');const initial={...stateFor(index,0),boards:{[index]:copy(game.snapshot())}};
 const f=mount(initial,{motion:true});try{
  await enter(f);const pair=levels[index].solution.at(-1);await swap(f,pair);
  assert.equal(node(f,'#board').getAttribute('aria-busy'),'true','a real presentation starts');
  click(f,'[data-nav="home"]');screen(f,'home');
  const final=boardFingerprint(f);await wait(1350);
  assert.equal(boardFingerprint(f),final);assert(!node(f,'#win-dialog').open,'no late victory dialog covers home');assert.equal(node(f,'#board').getAttribute('aria-busy'),'false');
 }finally{f.close();}
});

test('records are derived from actual observed wins and result navigation is safe',async()=>{
 const f=mount({...stateFor(2,0),done:[0,1,3]});try{
  await enter(f);const level=f.w.HEX_LEVELS[0],game=new f.w.HexMatch(level);
  for(const pair of level.solution){assert(game.swap(...pair).ok);await swap(f,pair);}
  await until(()=>node(f,'#win-dialog').open,'victory result opens');
  const records=f.save().records;assert(records[2],'observed campaign win creates a record');assert.equal(records[2].score,game.score);assert.equal(records[2].movesLeft,game.movesLeft);assert(records[2].plays>=1);
  assert(!records[3],'a completion flag alone does not invent a best score');
  click(f,'#win-map');screen(f,'journey');assert(!node(f,'#win-dialog').open);
  click(f,'[data-nav="records"]');screen(f,'records');assert(node(f,'#records-list').textContent.includes(String(game.score)),'real best score is displayed');
  assert.equal(+node(f,'#record-score').textContent,game.score,'summary is based on the only observed record');
  click(f,'[data-nav="home"]');screen(f,'home');
 }finally{f.close();}
});

(async()=>{
 const failed=[];
 for(const {name,run} of tests){try{await run();console.log('✓ '+name);}catch(error){failed.push({name,error});console.error('✗ '+name+': '+error.message);}}
 await wait(20);
 if(errors.length)failed.push({name:'uncaught DOM errors',error:new Error(errors.join('; '))});
 if(unhandled.length)failed.push({name:'unhandled promise errors',error:new Error(unhandled.join('; '))});
 for(const item of mounted)try{item.window.close();}catch(_){}
 if(failed.length){for(const f of failed)console.error(f.name+'\n'+f.error.stack);process.exitCode=1;}else console.log('Menu checks passed: landing/start/resume, nonmutating previews, settings/reset, pause guards, stale presentation cancellation and real records.');
})().catch(error=>{console.error(error);process.exitCode=1;});
