/* Score feedback: receipts, count-up and cancellation against the real game. */
'use strict';
const assert=require('node:assert/strict');
const {loadGame,savedLevel,savedGame,confirmRestart}=require('./qa-fixtures.cjs');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=__dirname+'/dist/',key='hexrota-match-v5';
const source=file=>fs.readFileSync(root+file,'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const tests=[],unhandled=[],browserErrors=[];
process.on('unhandledRejection',error=>unhandled.push(error?.message||String(error)));
function test(name,run){tests.push({name,run});}
async function until(check,message,timeout=3600){const start=Date.now();while(!check()&&Date.now()-start<timeout)await wait(5);assert(check(),message);}
const reference={window:{},performance};vm.createContext(reference);
for(const file of ['engine.js','levels.js','tutorials.js'])vm.runInContext(source(file),reference);
const campaign=reference.window.HEX_LEVELS[0];
function fixture(step){const game=new reference.window.HexMatch(campaign);for(const pair of campaign.solution.slice(0,step))game.swap(...pair);const checkpoint=plain(game.snapshot()),pair=plain(campaign.solution[step]),result=plain(game.swap(...pair));return {checkpoint,pair,result,expected:plain(game.snapshot())};}
const simple=fixture(1),chain=fixture(2);

function mount({motion='full',which=simple}={}){
 const vc=new VirtualConsole();vc.on('jsdomError',error=>browserErrors.push(error.message));
 const dom=new JSDOM(source('index.html'),{url:'https://hexrota-score.example/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 try{
 const w=dom.window,d=w.document,animations=[],packets=[],digits=[],phases=[],mergeSamples=[],samples=[];
 w.matchMedia=()=>({matches:motion==='reduce',addEventListener(){},removeEventListener(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};
 class Point{constructor(x=0,y=0){this.x=x;this.y=y;}matrixTransform(m){return new Point(m.a*this.x+m.c*this.y+m.e,m.b*this.x+m.d*this.y+m.f);}}
 w.DOMPoint=Point;w.SVGElement.prototype.getScreenCTM=()=>({a:1,b:0,c:0,d:1,e:195,f:350});
 w.SVGSVGElement.prototype.createSVGPoint=()=>new Point();
 w.Element.prototype.getBoundingClientRect=function(){
  let x=0,y=0,width=390,height=650;
  if(this.id==='sum'){x=42;y=28;width=39;height=34;}
  else if(this.classList.contains('hud-score')){x=16;y=10;width=120;height=95;}
  else if(this.id==='board'){x=0;y=155;width=390;height=390;}
  else if(this.classList.contains('score-packet')){width=110;height=68;}
  return {x,y,left:x,top:y,width,height,right:x+width,bottom:y+height,toJSON(){return this;}};
 };
 if(motion!=='reduce')w.Element.prototype.animate=function(frames,options={}){
  if((motion==='throw'&&this.classList.contains('score-packet'))||(motion==='digitThrow'&&this.classList.contains('score-digit'))||(motion==='burstThrow'&&this.classList.contains('score-burst-ring')))throw new Error('Score animation API failure');
  let promise,resolve,reject,timer;
  const animation={target:this,frames,options,cancelled:false,
   get finished(){if(!promise)promise=new Promise((yes,no)=>{resolve=yes;reject=no;timer=w.setTimeout(yes,(Number(options.duration)||0)+(Number(options.delay)||0));});return promise;},
   cancel(){this.cancelled=true;if(timer)w.clearTimeout(timer);if(reject)reject(new w.DOMException('Animation cancelled','AbortError'));},
   finish(){if(timer)w.clearTimeout(timer);resolve?.();},addEventListener(){},removeEventListener(){}};
  animations.push(animation);return animation;
 };
 w.Element.prototype.getAnimations=function(){return animations.filter(a=>a.target===this&&!a.cancelled);};
 class AudioStub{configure(){}unlock(){return Promise.resolve();}setActive(){}move(){}victory(){}click(){}stop(){}dispose(){}}
 w.HexAudio=AudioStub;
 w.localStorage.setItem(key,JSON.stringify({current:2,done:[0,1],boards:{2:which.checkpoint},sound:false,preferences:{motion:motion==='reduce'?'reduce':'full'}}));
 const observed=new WeakSet();
 const observer=new w.MutationObserver(records=>{
  for(const record of records){
   for(const added of record.addedNodes||[]){
    if(added.nodeType!==1)continue;
    for(const node of [added,...added.querySelectorAll('.score-packet,.score-digit')]){
     if(observed.has(node))continue;
     if(node.matches?.('.score-packet')){
      observed.add(node);packets.push({node,gain:+node.dataset.gain,wave:node.dataset.wave,destination:+node.dataset.destinationScore,chain:node.querySelector('.score-packet-chain')?.textContent||''});
      phases.push({node,phase:node.dataset.phase,score:+d.getElementById('sum').textContent});
     }else if(node.matches?.('.score-digit')){
      observed.add(node);digits.push({node,wave:packets.at(-1)?.wave,value:+node.dataset.value,index:node.dataset.index,source:node.dataset.source,left:parseFloat(node.style.left),top:parseFloat(node.style.top)});
     }
    }
   }
   if(record.type==='attributes'&&record.attributeName==='data-phase'&&record.target.matches('.score-packet'))phases.push({node:record.target,phase:record.target.dataset.phase,score:+d.getElementById('sum').textContent});
  }
  for(const packet of packets){const text=packet.node.querySelector('.score-packet-gain')?.textContent||'';if(text){const value=Number(text.replace(/^\+/,''));if(Number.isFinite(value)&&mergeSamples.filter(s=>s.node===packet.node).at(-1)?.value!==value)mergeSamples.push({node:packet.node,value});}}
  samples.push(+d.getElementById('sum')?.textContent||0);
 });observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-phase']});
 loadGame(w,['engine.js','levels.js','tutorials.js','app.js'],source);
 const node=id=>{const n=d.getElementById(id);assert(n,'#'+id+' exists');return n;};
 const click=id=>{node(id).click();if(id==='reset')confirmRestart(w);},save=()=>JSON.parse(w.localStorage.getItem(key));
 d.querySelector('[data-nav="journey"]').click();d.querySelector('[data-stage="2"]').click();click('pregame-start');
 function move(){for(const index of which.pair){const tile=d.querySelector(`#board [data-index="${index}"]`);tile.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:0}));}}
 const score=()=>+node('sum').textContent,busy=()=>node('board').getAttribute('aria-busy')==='true';
 const idle=()=>until(()=>!busy(),'score presentation releases input within the existing budget');
 const clean=(receipt)=>{assert.equal(d.querySelectorAll('.score-packet,.score-digit,.score-burst-ring,.score-burst-spark').length,0,'no merge digits, totals or bursts remain');assert.equal(d.querySelectorAll('.score-arrival').length,0,'no stale HUD pulse');if(receipt!==undefined&&d.getElementById('score-receipt'))assert.equal(node('score-receipt').textContent,receipt,'gain label belongs to the current move');};
 function exact(){assert.equal(score(),which.expected.score,'HUD equals the engine result');assert.deepEqual(save().boards[2],which.expected,'saved checkpoint stays the exact engine result');assert.equal(+node('moves-left').textContent,which.expected.movesLeft,'all flights spend only the original move');}
 return {w,d,node,click,move,save,score,busy,idle,clean,exact,animations,packets,digits,phases,mergeSamples,samples,which,close(){observer.disconnect();dom.window.close();}};
 }catch(error){dom.window.close();throw error;}
}

test('matched digits merge into a popped total before the total flies to the HUD',async()=>{
 const f=mount();try{
  assert.equal(f.score(),10);f.move();assert(f.busy());
  assert.equal(f.save().boards[2].score,19,'engine score is committed before visual feedback');
  await until(()=>f.d.querySelector('.score-packet'),'a match starts the merge presentation');
  const packet=f.d.querySelector('.score-packet');
  assert.equal(packet.dataset.phase,'collect');
  assert.equal(+packet.dataset.gain,9);assert.equal(+packet.dataset.destinationScore,19);
  assert.equal(packet.querySelector('.score-packet-math'),null,'no formula card substitutes for the animated addition');
  await until(()=>f.d.querySelectorAll('.score-digit').length===3,'all three matched values are lifted');
  const pieces=f.digits.filter(d=>d.wave==='1');
  assert.deepEqual(pieces.map(d=>d.value),[3,3,3]);
  assert.equal(new Set(pieces.map(d=>d.index)).size,3,'each matched stone supplies its own number');
  for(const digit of pieces){
   const tile=f.d.querySelector(`#board [data-index="${digit.index}"]`),xy=tile.getAttribute('transform').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
   assert(Math.abs(digit.left-(xy[0]+195))<.01,'number starts at its actual stone x coordinate');
   assert(Math.abs(digit.top-(xy[1]+350))<.01,'number starts at its actual stone y coordinate');
   assert(f.animations.some(a=>a.target===digit.node),'each lifted number actually animates');
  }
  assert.equal(f.score(),10,'the HUD stays unchanged while the values gather');
  await until(()=>packet.dataset.phase==='pop','the completed addition enters its burst phase');
  assert.equal(packet.querySelector('.score-packet-gain').textContent,'+9');
  assert(f.d.querySelector('.score-burst-ring')&&f.d.querySelector('.score-burst-spark'),'a visible ring and sparks emphasize the summed total');
  assert.equal(f.score(),10,'the popped total has not yet reached the HUD');
  await wait(240);
  assert.equal(packet.dataset.phase,'pop','the completed total stays readable before it starts flying');
  assert.equal(packet.querySelector('.score-packet-gain').textContent,'+9','the finished sum remains visible during the hold');
  assert.equal(f.score(),10,'holding the total does not prematurely credit the HUD');
  await until(()=>packet.dataset.phase==='fly','the popped total begins its separate flight');
  assert.equal(f.score(),10,'credit waits until the flight lands');
  await f.idle();f.exact();f.clean();assert(f.node('score-receipt').textContent.includes('9'),'the earned total remains readable after arrival');
  assert.deepEqual(f.phases.filter(p=>p.node===packet).map(p=>p.phase).filter((phase,index,all)=>!index||phase!==all[index-1]),['collect','pop','fly','arrived'],'collect, sum burst and flight are distinct ordered stages');
  assert.deepEqual(f.mergeSamples.filter(p=>p.node===packet).map(p=>p.value),[3,6,9],'the collected values visibly accumulate');
  assert(f.phases.filter(p=>p.node===packet&&p.phase!=='arrived').every(p=>p.score===10),'no earlier stage credits the HUD');
  assert(f.samples.some(value=>value>10&&value<19),'HUD count-up visibly passes through intermediate values');
  assert(f.animations.some(a=>a.target===packet),'the summed total uses the flight animation');
 }finally{f.close();}
});

test('long chains account for every resolved wave and point exactly once without introducing a multiplier',async()=>{
 const f=mount({which:chain});try{
  assert.equal(chain.result.frames.length,4);assert.equal(chain.result.scoreGain,40);f.move();await f.idle();f.exact();f.clean();
  const gains=chain.result.frames.map(frame=>frame.scoreGain);
  assert.deepEqual(gains,[5,6,20,9],'the unchanged real engine still resolves the authored four-wave fixture');
  assert.equal(f.packets.length,chain.result.frames.length,'every actual engine wave has its own visible receipt');
  assert(f.packets.every(packet=>f.phases.some(event=>event.node===packet.node&&event.phase==='arrived')),'the unchanged safety deadline cannot truncate any visible receipt');
  for(let index=1;index<f.packets.length;index++){
   const priorArrival=f.phases.findIndex(event=>event.node===f.packets[index-1].node&&event.phase==='arrived');
   const nextCollect=f.phases.findIndex(event=>event.node===f.packets[index].node&&event.phase==='collect');
   assert(nextCollect>priorArrival,'each real cascade remains readable until its own total reaches the HUD');
  }
  assert.deepEqual(f.packets.map(packet=>packet.gain),gains,'receipts never aggregate later unseen waves');
  assert.deepEqual(f.packets.map(packet=>Number(packet.wave)),[1,2,3,4],'receipts retain actual engine-wave ordering');
  let cumulative=chain.checkpoint.score;
  assert.deepEqual(f.packets.map(packet=>packet.destination),gains.map(gain=>cumulative+=gain),'each destination is its exact engine-score prefix');
  assert.equal(f.packets.reduce((total,packet)=>total+packet.gain,0),40);
  assert.equal(f.packets.at(-1).destination,59,'the final destination is the actual engine score');
  const displayed=f.samples.filter(value=>value>=19);assert(displayed.every((value,index)=>value<=59&&(!index||value>=displayed[index-1])),'HUD count-up never regresses or overshoots the committed total');
  for(const packet of f.packets.slice(1)){
   assert(packet.chain.includes(String(packet.wave)),'each caption identifies its real cascade');
   assert(!/[×x]\s*\d/i.test(packet.chain),'the chain caption does not imply a score multiplier');
  }
  const groups=f.packets.map(packet=>f.digits.filter(d=>d.wave===packet.wave));
  assert.deepEqual(groups.map(group=>group.reduce((total,digit)=>total+digit.value,0)),gains,'every visible merge adds up to its actual earned wave total');
  assert.equal(f.digits.filter(d=>d.source==='chains').length,0,'no synthetic extra component substitutes for actual later matched stones');
  for(const [index,group]of groups.entries()){
   const frame=chain.result.frames[index],expected=frame.matched.map(i=>frame.before[i]).sort((a,b)=>a-b);
   assert.deepEqual(group.map(d=>d.value).sort((a,b)=>a-b),expected,'each actual matched stone contributes its own number exactly once');
   assert.deepEqual(group.map(d=>Number(d.index)).sort((a,b)=>a-b),frame.matched.slice().sort((a,b)=>a-b),'all and only actual matched indices supply digits');
   assert.equal(new Set(group.map(d=>d.index)).size,frame.matched.length,'a wave never counts a stone twice');
  }
 }finally{f.close();}
});

for(const action of ['skip','reset','navigate','background','resize'])test(`${action} cannot leave stale flights or delayed score writes`,async()=>{
 const f=mount();try{
  f.move();await until(()=>f.d.querySelector('.score-packet'),'a flight exists before interruption');
  let expected=19;
  if(action==='skip')f.click('skip-animation');
  if(action==='reset'){f.click('reset');expected=0;}
  if(action==='navigate'){
   f.click('game-home');f.d.querySelector('[data-nav="journey"]').click();f.d.querySelector('[data-stage="0"]').click();f.click('pregame-start');expected=0;
  }
  if(action==='background'){Object.defineProperty(f.d,'hidden',{configurable:true,value:true});f.d.dispatchEvent(new f.w.Event('visibilitychange'));}
  if(action==='resize')f.w.dispatchEvent(new f.w.Event('resize'));
  await f.idle();assert.equal(f.score(),expected);f.clean(expected===0?'':undefined);
  await wait(500);assert.equal(f.score(),expected,'aborted callbacks cannot overwrite the current HUD');f.clean(expected===0?'':undefined);
  assert.equal(f.node('board').getAttribute('aria-busy'),'false');
  if(action==='reset')assert.equal(f.save().boards[2].turn,0);
  else if(action!=='navigate')assert.equal(f.save().boards[2].turn,simple.expected.turn,'interruption cannot spend a second move');
  else assert.deepEqual(f.save().boards[2],simple.expected,'free tutorial navigation preserves the unfinished campaign result');
 }finally{f.close();}
});

test('reset during count-up cancels the pending score animation frames',async()=>{
 const f=mount();try{
  f.move();await until(()=>f.score()>10&&f.score()<19,'count-up reaches an intermediate value');
  f.click('reset');assert.equal(f.score(),0);f.clean('');
  await wait(250);assert.equal(f.score(),0,'an old count-up frame cannot restore the previous score');f.clean('');
  assert.equal(f.save().boards[2].turn,0);
 }finally{f.close();}
});

test('reduced motion and failed flight APIs still settle the exact earned total',async()=>{
 for(const motion of ['reduce','throw','digitThrow','burstThrow']){
  const f=mount({motion});try{
   const start=Date.now();f.move();await f.idle();f.exact();f.clean();
   if(motion==='reduce'){assert(Date.now()-start<180,'reduced motion does not wait for decorative movement');assert.equal(f.packets.length,0);assert.equal(f.animations.length,0);}
  }finally{f.close();}
 }
});

test('a swap without a match creates no score receipt and consumes no move',async()=>{
 const f=mount();try{
  const game=new f.w.HexMatch(f.w.HEX_LEVELS[0],simple.checkpoint),legal=game.legalMoves();let invalid;
  for(let a=0;a<game.neighbors.length&&!invalid;a++)for(const b of game.neighbors[a])if(!legal.some(pair=>pair.includes(a)&&pair.includes(b))){invalid=[a,b];break;}
  assert(invalid,'fixture includes a neighboring invalid swap');
  const before=plain(f.save().boards[2]);for(const index of invalid)f.d.querySelector(`#board [data-index="${index}"]`).dispatchEvent(new f.w.MouseEvent('click',{bubbles:true,detail:0}));
  await wait(20);assert.equal(f.score(),10);assert.deepEqual(f.save().boards[2],before);assert.equal(f.packets.length,0);f.clean('');
 }finally{f.close();}
});

(async()=>{let failed=0;for(const {name,run}of tests){try{await run();console.log('✓ '+name);}catch(error){failed++;console.error('✗ '+name+'\n'+error.stack);}}await wait(20);if(unhandled.length||browserErrors.length){failed++;console.error({unhandled,browserErrors});}if(failed)process.exitCode=1;else console.log('Score checks passed: real number collection, running addition, sum burst, ordered HUD flight, exact chain totals, interruption cleanup and failure safety.');})().catch(error=>{console.error(error);process.exitCode=1;});
