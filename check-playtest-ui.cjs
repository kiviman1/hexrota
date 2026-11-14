/* Real app integration for the optional, local-only human playtest recorder. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const read=file=>fs.readFileSync(__dirname+'/dist/'+file,'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const GAME='hexrota-match-v5',LIFE='hexrota-lives-v1',OBS='hexrota-playtest-v1';
const NOW=Date.UTC(2026,0,8,12),tests=[],errors=[],unhandled=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
const test=(name,run)=>tests.push({name,run}),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,message,timeout=2500){const start=Date.now();while(!check()&&Date.now()-start<timeout)await wait(5);assert(check(),message);}
const reference={window:{},performance};vm.createContext(reference);
for(const file of ['engine.js','levels.js','tutorials.js','variants-data.js','attempts.js','lives-config.js','lives.js','life-providers.js'])vm.runInContext(read(file),reference,{filename:file});
const R=reference.window;
function fresh(stage=2,motion='reduce'){return {current:stage,done:Array.from({length:stage},(_,i)=>i),boards:{},sound:false,preferences:{motion,music:false,haptics:false},variantSelection:{seed:0x41abca,serial:0,counts:{},recent:{}}};}
function zeroLives(){const manager=R.HexLives.createManager(R.HEX_LIVES_CONFIG,{clock:()=>NOW});let state=manager.createState();for(let n=0;n<5;n++)state=manager.settleAttempt(state,{attemptId:'prior-'+n,levelId:10,tutorial:false,movesUsed:1,outcome:'failed'}).state;return plain(R.HexLifePrototype.createState(state,{providerNamespace:'playtest-ui',gold:300,adAvailable:false}));}
function mount({saved=fresh(),life,observations,animated=false}={}){
 const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(read('index.html'),{url:'https://hexrota-playtest.example/?email=private%40example.test&secret=do-not-export',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,d=w.document,network=[],blobs=[],downloads=[];let mono=0;
 w.Date.now=()=>NOW+mono;Object.defineProperty(w.performance,'now',{configurable:true,value:()=>mono});
 w.matchMedia=()=>({matches:!animated,addEventListener(){},removeEventListener(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};
 if(animated)w.Element.prototype.animate=function(){return {finished:Promise.resolve(),cancel(){}};};
 w.fetch=(...args)=>{network.push(['fetch',...args]);return Promise.reject(new Error('Playtest must remain local'));};
 Object.defineProperty(w.navigator,'sendBeacon',{configurable:true,value:(...args)=>{network.push(['beacon',...args]);return true;}});
 w.XMLHttpRequest.prototype.open=function(...args){network.push(['xhr',...args]);throw Error('Playtest must remain local');};
 w.Blob=global.Blob;w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:local-playtest-'+blobs.length;};w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){downloads.push({href:this.href,name:this.download});};
 class AudioStub{configure(){}unlock(){return Promise.resolve();}setActive(){}move(){}victory(){}reward(){}click(){}stop(){}dispose(){}}
 w.HexAudio=AudioStub;w.localStorage.setItem(GAME,JSON.stringify(saved));
 if(life!==undefined)w.localStorage.setItem(LIFE,JSON.stringify(life));if(observations!==undefined)w.localStorage.setItem(OBS,JSON.stringify(observations));
 for(const script of d.querySelectorAll('script[src]')){const file=script.getAttribute('src').split('/').at(-1).split('?')[0];if(!['audio.js','pwa.js'].includes(file))w.eval(read(file));}
 const f={dom,w,d,network,blobs,downloads,advance(ms){mono+=ms;},save:()=>JSON.parse(w.localStorage.getItem(GAME)),life:()=>JSON.parse(w.localStorage.getItem(LIFE)),observed:()=>JSON.parse(w.localStorage.getItem(OBS)||'null'),close(){w.close();}};
 f.node=selector=>{const result=d.querySelector(selector);assert(result,selector+' exists');return result;};
 f.click=selector=>f.node(selector).dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:0}));
 f.change=(selector,value)=>{const node=f.node(selector);node.checked=value;node.dispatchEvent(new w.Event('change',{bubbles:true}));};
 f.visible=value=>{Object.defineProperty(d,'hidden',{configurable:true,value:!value});d.dispatchEvent(new w.Event('visibilitychange'));};
 f.game=()=>{const s=f.save(),i=s.current,base=w.HEX_LEVELS[i-2],meta=s.attempts?.[i],level=i<2?w.HEX_TUTORIALS[i]:meta?w.HexAttempts.createCatalog(w.HEX_LEVELS,w.HEX_VARIANTS,w.HexMatch).resolveLevel(base.id,meta.variantId,meta.levelDataVersion):base;return new w.HexMatch(level,s.boards[i]);};
 f.openSettings=()=>{if(!f.node('#settings-dialog').open)f.click(d.body.dataset.screen==='game'?'#game-settings':'#settings');};
 f.enable=value=>{f.openSettings();f.change('#setting-playtest',value);f.click('#settings-done');};
 f.export=async()=>{f.openSettings();f.click('#playtest-export');const blob=blobs.at(-1);assert(blob instanceof Blob);assert.equal(blob.type,'application/json');assert.equal(downloads.at(-1).name,'hexrota-playtest.json');assert(/^blob:/.test(downloads.at(-1).href));const text=await blob.text();assert(!text.includes('private@example.test')&&!text.includes('do-not-export'),'location/query identifiers are never exported');return JSON.parse(text);};
 return f;
}
async function enter(f){f.click('#home-play');if(f.node('#pregame-dialog').open)f.click('#pregame-start');await wait(1);}
function beginMove(f,pair){for(const index of pair)f.click(`#board [data-index="${index}"]`);}
async function move(f,pair){beginMove(f,pair);await until(()=>f.node('#board').getAttribute('aria-busy')==='false','move presentation completes');}
function noNetwork(f){assert.deepEqual(f.network,[],'observations, export and all test helpers make no network calls');}
const events=(f,name)=>f.observed()?.events.filter(event=>event.name===name)||[];
function losingRoute(level){for(let policy=0;policy<120;policy++){const g=new R.HexMatch(level);while(g.status==='playing'){const legal=g.legalMoves();g.swap(...legal[(g.turn*7+policy)%legal.length]);}if(g.status==='lost')return plain(g.history);}throw Error('A genuine losing test route is required');}

test('recorder is off by default; real moves and hints remain unobserved until explicit opt-in',async()=>{
 const f=mount();try{assert.equal(f.node('#setting-playtest').checked,false);await enter(f);await move(f,plain(f.game().level.solution[0]));f.click('#hint');await wait(1);const data=await f.export();assert.equal(data.enabled,false);assert.deepEqual(data.events,[]);assert.deepEqual(data.attempts,[]);assert.equal(f.game().turn,1);noNetwork(f);}finally{f.close();}
});

test('opt-in records actual identities, cells, waves and hints without changing engine results',async()=>{
 const f=mount({saved:fresh(5)});try{
  f.enable(true);await enter(f);const start=events(f,'level_started');assert.equal(start.length,1);assert.equal(start[0].data.developerBypass,false);assert.equal(events(f,'attempt_resumed').length,0,'a fresh attempt is not a resume');
  const model=f.game(),before=plain(model.snapshot()),pair=plain(model.level.solution[0]),result=plain(model.swap(...pair));await move(f,pair);
  assert.deepEqual(plain(f.game().snapshot()),plain(model.snapshot()));const rows=events(f,'move');assert.equal(rows.length,1);
  assert.deepEqual(rows[0].data,{attemptId:f.save().attempts[5].attemptId,turn:1,pair,cells:pair.map(i=>plain(model.level.cells[i])).map(({q,r})=>({q,r})),scoreBefore:before.score,scoreAfter:model.score,movesRemaining:model.movesLeft,coveredBefore:before.layers.filter(n=>n===0).length,coveredAfter:model.covered,remainingLayers:model.remainingLayers,waves:result.frames.length,developerBypass:false,matchedIndices:[...new Set(result.frames.flatMap(frame=>frame.matched))]});
  const unchanged=plain(f.game().snapshot());f.click('#hint');await until(()=>events(f,'hint_used').length===1,'actual hint result is observed');assert.deepEqual(plain(f.game().snapshot()),unchanged);assert.equal(events(f,'hint_used')[0].data.hintsUsed,1);
  const probe=new f.w.HexMatch(model.level,unchanged);let invalid;
  for(let a=0;a<probe.total&&!invalid;a++)for(let b=a+1;b<probe.total;b++)if(probe.adjacent(a,b)&&!probe.clone().swap(a,b).ok){invalid=[a,b];break;}
  assert(invalid);await move(f,invalid);assert.equal(events(f,'move').length,1,'invalid swaps are not logged as spent moves');assert.deepEqual(plain(f.game().snapshot()),unchanged);
  const count=f.observed().events.length;f.enable(false);await move(f,plain(model.level.solution[1]));assert.equal(f.observed().events.length,count,'turning observation off stops further records');assert.equal(f.game().turn,2);noNetwork(f);
 }finally{f.close();}
});

test('a genuine failed route records exact deficits and retry creates a new observed attempt',async()=>{
 const f=mount({saved:fresh(11)});try{
  f.enable(true);await enter(f);const id=f.save().attempts[11].attemptId,route=losingRoute(plain(f.game().level));for(const pair of route)await move(f,pair);
  await until(()=>f.node('#lose-dialog').open,'loss modal opens');const game=f.game(),rows=events(f,'level_failed');assert.equal(rows.length,1);const failed=rows[0].data;
  assert.equal(failed.attemptId,id);assert.equal(failed.movesUsed,route.length);assert.equal(failed.movesRemaining,0);assert.equal(failed.missingScore,Math.max(0,game.level.target-game.score));assert.equal(failed.missingGround,game.total-game.covered);assert.equal(failed.remainingLayers,game.remainingLayers);assert.equal(failed.failureReason,failed.missingScore&&failed.missingGround?'score_and_ground':failed.missingScore?'score':'ground');assert.equal(events(f,'move').length,route.length);
  f.click('#retry');assert.notEqual(f.save().attempts[11].attemptId,id);assert.equal(events(f,'level_started').length,2);assert.equal(events(f,'level_retried').length,1);assert.equal(events(f,'level_retried')[0].data.previousAttemptId,id);assert.equal(f.life().life.lives,4);noNetwork(f);
 }finally{f.close();}
});

test('a certified victory records zero deficits and the actual remaining moves',async()=>{
 const f=mount();try{f.enable(true);await enter(f);for(const pair of plain(f.game().level.solution))await move(f,pair);const rows=events(f,'level_completed');assert.equal(rows.length,1);assert.equal(rows[0].data.missingScore,0);assert.equal(rows[0].data.missingGround,0);assert.equal(rows[0].data.failureReason,'none');assert.equal(rows[0].data.movesRemaining,f.game().movesLeft);assert.equal(f.life().life.lives,5);noNetwork(f);}finally{f.close();}
});

test('zero-life blocks and explicit developer bypass are observable without opening an attempt early',async()=>{
 const f=mount({life:zeroLives()});try{
  f.enable(true);const before=plain(f.save());await enter(f);assert(f.node('#lives-dialog').open);assert.deepEqual(f.save().variantSelection,before.variantSelection);assert.deepEqual(f.save().boards,before.boards);assert.equal(events(f,'level_started').length,0);assert.equal(events(f,'life_blocked').length,1);assert.equal(events(f,'life_blocked')[0].data.requestedLevelId,1);assert.equal(events(f,'life_blocked')[0].data.lives,0);
  f.click('#lives-wait');f.openSettings();f.change('#setting-lives-bypass',true);f.click('#settings-done');await enter(f);assert.equal(f.d.body.dataset.screen,'game');assert.equal(f.life().life.lives,0);assert.equal(f.life().life.developerBypass,true);assert.equal(events(f,'level_started').length,1);assert.equal(events(f,'level_started')[0].data.developerBypass,true);await move(f,plain(f.game().level.solution[0]));assert.equal(events(f,'move')[0].data.developerBypass,true);noNetwork(f);
 }finally{f.close();}
});

test('actual pause, background, blur and settings exclude time; clearing only resets observations',async()=>{
 const f=mount();try{
  f.enable(true);await enter(f);f.advance(1000);f.click('#pause');f.advance(2000);f.click('#pause-continue');f.advance(400);f.visible(false);f.advance(8000);f.visible(true);assert(f.node('#pause-dialog').open,'background return retains the actual pause dialog');f.click('#pause-continue');f.advance(300);f.w.dispatchEvent(new f.w.Event('blur'));f.advance(5000);f.w.dispatchEvent(new f.w.Event('focus'));assert(f.node('#pause-dialog').open,'focus alone does not dismiss a pause');f.click('#pause-continue');f.advance(200);f.openSettings();f.advance(7000);
  const data=await f.export(),attempt=data.attempts.find(row=>row.attemptId===f.save().attempts[2].attemptId);assert.equal(attempt.activeMs,1900,'only 1000+400+300+200 focused playable milliseconds count');assert.equal(attempt.observedStart,true);
  const gameplay=plain(f.save()),life=plain(f.life());f.click('#playtest-clear');assert.deepEqual(f.save(),gameplay);assert.deepEqual(f.life(),life);const cleared=await f.export();assert.deepEqual(cleared.events,[]);assert.deepEqual(cleared.attempts,[]);assert.equal(cleared.enabled,true);assert.equal(cleared.scope,'local_opt_in_no_personal_data');noNetwork(f);
 }finally{f.close();}
});

test('real presentation busy state excludes animation time and skipped presentation preserves the move',async()=>{
 const f=mount({saved:fresh(5,'full'),animated:true});try{
  f.enable(true);await enter(f);const model=f.game(),pair=plain(model.level.solution[0]);model.swap(...pair);f.advance(500);beginMove(f,pair);assert.equal(f.node('#board').getAttribute('aria-busy'),'true');f.advance(5000);f.click('#board [data-index="0"]');await until(()=>f.node('#board').getAttribute('aria-busy')==='false','presentation can be skipped');f.advance(250);const data=await f.export();assert.equal(data.attempts.find(row=>row.attemptId===f.save().attempts[5].attemptId).activeMs,750);assert.deepEqual(plain(f.game().snapshot()),plain(model.snapshot()));assert.equal(events(f,'move').length,1);noNetwork(f);
 }finally{f.close();}
});

test('saved opt-in observations resume locally with the same board and no fabricated new start',async()=>{
 let f=mount({saved:fresh(5)});try{
  f.enable(true);await enter(f);await move(f,plain(f.game().level.solution[0]));f.advance(600);f.visible(false);const saved=plain(f.save()),life=plain(f.life()),observations=plain(f.observed()),count=observations.events.filter(e=>e.name==='level_started').length;f.close();f=mount({saved,life,observations});assert.equal(f.node('#setting-playtest').checked,true);await enter(f);assert.deepEqual(f.save().boards[5],saved.boards[5]);assert.equal(events(f,'level_started').length,count);assert.equal(events(f,'attempt_resumed').length,1);assert.equal(events(f,'attempt_resumed')[0].data.attemptId,saved.attempts[5].attemptId);const data=await f.export();assert.equal(data.attempts[0].activeMs,600);noNetwork(f);
 }finally{f.close();}
});

test('late opt-in does not invent a start or pre-consent moves and leaves an honest incomplete window',async()=>{
 const f=mount({saved:fresh(5)});try{
  await enter(f);await move(f,plain(f.game().level.solution[0]));f.enable(true);f.advance(400);f.click('#hint');await until(()=>events(f,'hint_used').length===1,'late observation sees the actual hint');const data=await f.export();assert.equal(data.events.filter(e=>e.name==='level_started').length,0);assert.equal(data.events.filter(e=>e.name==='move').length,0);assert.equal(data.attempts.length,1);assert.equal(data.attempts[0].observedStart,false);assert.equal(data.attempts[0].activeMs,400);assert.equal(f.game().turn,1);noNetwork(f);
 }finally{f.close();}
});

(async()=>{for(const {name,run}of tests){await run();console.log('✓ '+name);}assert.deepEqual(errors,[],'no browser errors');assert.deepEqual(unhandled,[],'no unhandled asynchronous failures');console.log('Playtest UI checks passed: '+tests.length+' real-app groups, explicit consent, exact observations, excluded time, local JSON export, zero network and preserved saves.');})().catch(error=>{console.error(error);process.exitCode=1;});
