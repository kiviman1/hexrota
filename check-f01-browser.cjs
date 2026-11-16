/* F-01: a committed command owns one canonical write. Real Chromium/WebKit,
 * native touch input, production fixtures and replay; presentation owns none. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const {existing,lifePool,NOW}=require('./check-lives-ui.cjs');
const {beforeWin,legacyClears}=require('./check-progression-ui.cjs');
const PROFILE='hexrota-profile-v2',EVENTS='hexrota-events-v1';
const browserName=process.env.HEXROTA_BROWSER||'chromium';
assert(['chromium','webkit'].includes(browserName),'supported actual browser');
const root=path.join(__dirname,'dist');
const output=process.env.HEXROTA_F01_SCREENSHOT_DIR||path.join(__dirname,'test-results','f01-browser-'+browserName);
fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 let file;
 try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));}catch(_){res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(body);});
});
let browser,url,failure=null,currentCheck='opening';const results=[],measurements=[],errors=[];
const plain=value=>JSON.parse(JSON.stringify(value));
const board=p=>p.game.boards[p.game.current],attempt=p=>p.game.attempts[p.game.current];
async function profile(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROFILE);}
async function canonical(page){return page.evaluate(key=>localStorage.getItem(key),PROFILE);}
async function events(page){return page.evaluate(key=>localStorage.getItem(key),EVENTS);}
const eventList=value=>JSON.parse(value||'{"events":[]}').events||[];
async function check(name,run){
 if(process.env.HEXROTA_F01_ONLY&&!name.includes(process.env.HEXROTA_F01_ONLY))return;
 currentCheck=name;
 await run();results.push(name);console.log('PASS '+browserName+' '+name);
}
async function open({saved=existing(2,{turns:1}).saved,size={width:390,height:844},motion='full'}={}){
 const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:motion==='reduce'?'reduce':'no-preference',serviceWorkers:'block'});
 await context.addInitScript(({saved,motion,energy,now})=>{
  if(location.protocol!=='http:')return;Date.now=()=>now;
  if(!localStorage.getItem('hexrota-profile-v2')&&!localStorage.getItem('hexrota-match-v5')){
   saved.preferences={...saved.preferences,motion};
   localStorage.setItem('hexrota-match-v5',JSON.stringify(saved));localStorage.setItem('hexrota-lives-v1',JSON.stringify(energy));
  }
 },{saved,motion,energy:lifePool(5),now:NOW});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.screen==='home');
 return {context,page,close:async()=>{
  // Preserve the last real browser view even when an assertion interrupts a
  // case before its named evidence screenshot. Screenshot failure cannot mask
  // the original assertion or prevent context cleanup.
  await page.screenshot({path:path.join(output,'last-view-'+currentCheck.replace(/[^a-z0-9]+/gi,'-').slice(0,120)+'.png'),animations:'allow',timeout:5000}).catch(()=>{});
  await context.close();
 }};
}
async function enter(page){await page.locator('#home-play').tap();if(await page.locator('#pregame-dialog').evaluate(n=>n.open))await page.locator('#pregame-start').tap();await page.waitForFunction(()=>document.body.dataset.screen==='game');await settled(page);}
async function settled(page){await page.locator('#board').evaluate(async board=>{const jobs=[];for(let node=board;node;node=node.parentElement)for(const animation of node.getAnimations())if(animation.effect?.target===node&&animation.playState==='running'&&animation.effect.getTiming().iterations!==Infinity)jobs.push(animation.finished.catch(()=>{}));await Promise.all(jobs);});}
async function pointCell(page,index){const rect=await page.locator(`#board [data-index="${index}"] .floor-shape`).boundingBox();assert(rect,'actual stone hit target exists');return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};}
async function tapCell(page,index){const point=await pointCell(page,index);await page.touchscreen.tap(point.x,point.y);}
async function touch(page,pair){for(const index of pair)await tapCell(page,index);}
async function idle(page){await page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='false');}
async function currentRoute(page){return page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('hexrota-profile-v2')),index=p.game.current,meta=p.game.attempts[index];return index<2?HEX_TUTORIALS[index].solution:HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(meta.levelId,meta.variantId,meta.levelDataVersion).solution;});}
async function shot(page,name){await page.screenshot({path:path.join(output,name+'.png'),animations:'allow'});}
async function installProbe(page){
 await page.evaluate(()=>{
  const native=Storage.prototype.setItem,state={segments:[],active:null};window.__f01Writes=state;
  window.__f01RestoreWrites=()=>Storage.prototype.setItem=native;
  Storage.prototype.setItem=function(key,value){
   if(key==='hexrota-profile-v2'&&state.active){
    const segment=state.active,entry={ordinal:segment.writes.length+1,value,failed:false};segment.writes.push(entry);
    if(segment.failAt===entry.ordinal){entry.failed=true;throw new DOMException('F01 canonical write fault','QuotaExceededError');}
   }
   return native.call(this,key,value);
  };
 });
}
async function segment(page,name,failAt=2){await page.evaluate(({name,failAt})=>{const entry={name,failAt,writes:[]};window.__f01Writes.segments.push(entry);window.__f01Writes.active=entry;},{name,failAt});}
async function writes(page){return page.evaluate(()=>window.__f01Writes.active);}
async function restoreProbe(page){await page.evaluate(()=>window.__f01RestoreWrites?.()).catch(()=>{});}
function oneWrite(log,message){assert.equal(log.writes.length,1,message+' has exactly one canonical write including finish');assert.equal(log.writes[0].failed,false,message+' first authoritative write succeeds');}
function unchanged(before,after,message){assert.deepEqual(after.game,before.game,message+' game');assert.deepEqual(after.energy,before.energy,message+' energy');}
function nonterminalFixture(){
 for(let turns=0;turns<9;turns++){
  const f=existing(2,{turns});if(f.game.status!=='playing')continue;
  for(const pair of f.game.legalMoves()){
   const model=f.game.clone(),result=model.swap(...pair);
   if(result.ok&&result.frames.length>=2&&model.status==='playing')return {saved:f.saved,pair:plain(pair),expected:plain(model.snapshot()),frames:result.frames.length};
  }
 }
 assert.fail('production fixture provides a real nonterminal multiwave cascade');
}
async function geometry(page,label){
 const boxes=await page.evaluate(()=>{
  const rect=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();
  return {board:rect('#board'),hud:rect('.scoreboard'),topbar:rect('.game-topbar'),overflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert.equal(boxes.overflow,false,label+' has no horizontal overflow');
 const viewport=page.viewportSize();
 for(const key of ['board','hud']){
  const box=boxes[key];assert(box.width>0&&box.height>0,label+' '+key+' is visible');
  assert(box.left>=-1&&box.top>=-1&&box.right<=viewport.width+1&&box.bottom<=viewport.height+1,label+' '+key+' fits the mobile viewport');
 }
 measurements.push({label,viewport,...boxes});return boxes;
}
function stable(before,after,label){
 for(const node of ['board','hud','topbar'])for(const key of ['x','y','width','height'])assert(Math.abs(before[node][key]-after[node][key])<=1,label+' '+node+'.'+key+' '+before[node][key]+'→'+after[node][key]);
}
async function clean(page){
 assert.equal(await page.locator('#board').getAttribute('aria-busy'),'false','presentation releases busy');
 assert.equal(await page.locator('.swap-pair,.swap-layer .swap-stone,.score-packet').count(),0,'temporary swap and score nodes are cleaned');
 assert.equal(await page.locator('#board-stage').evaluate(node=>node.classList.contains('busy')),false,'busy stage class is cleaned');
}
async function dialogs(page){return page.locator('dialog[open]').evaluateAll(nodes=>nodes.map(node=>node.id));}
async function nextExpected(page,pair=null){
 return page.evaluate(pair=>{
  const p=JSON.parse(localStorage.getItem('hexrota-profile-v2')),i=p.game.current,meta=p.game.attempts[i],config=HEX_ECONOMY_CONFIG;
  const level=HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(meta.levelId,meta.variantId,meta.levelDataVersion),snapshot=p.game.boards[i];
  const model=snapshot.rulesVersion==='assisted-v1'?new HexAssistedGame(level,{attemptId:meta.attemptId,limits:{greenBrush:config.inventory.greenBrush.maxPerAttempt,colorKey:config.inventory.colorKey.maxPerAttempt,rescue:config.rescue.maxPerAttempt}},snapshot):new HexMatch(level,snapshot);
  pair=pair||model.legalMoves()[0];
  const result=model.swap(...pair);if(!result.ok)throw new Error('production fixture has no valid continuation');
  return {pair,snapshot:model.snapshot(),status:model.status,frames:result.frames.length};
 },pair);
}
async function assistancePlan(page,item){
 return page.evaluate(item=>{
  const p=JSON.parse(localStorage.getItem('hexrota-profile-v2')),index=p.game.current,meta=p.game.attempts[index],config=HEX_ECONOMY_CONFIG;
  const level=HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(meta.levelId,meta.variantId,meta.levelDataVersion);
  const model=new HexAssistedGame(level,{attemptId:meta.attemptId,limits:{greenBrush:config.inventory.greenBrush.maxPerAttempt,colorKey:config.inventory.colorKey.maxPerAttempt,rescue:config.rescue.maxPerAttempt}},p.game.boards[index]);
  const id=`assist:${meta.attemptId}:${model.commands.length+1}:${item}`;
  let command,preview;
  if(item==='greenBrush'){
   const target=model.layers.findIndex(layer=>layer>0);command={id,type:'green_brush',index:target};preview=model.preview(command);
  }else{
   outer:for(let target=0;target<model.total;target++)for(const value of model.level.palette)if(value!==model.values[target]){
    const candidate={id,type:'color_key',index:target,value},candidatePreview=model.preview(candidate);
    if(candidatePreview.result.ok&&candidatePreview.result.frames.length&&candidatePreview.status==='playing'){command=candidate;preview=candidatePreview;break outer;}
   }
  }
  if(!preview?.result.ok)throw new Error('production model has no valid '+item+' UI fixture');
  return {command,preview};
 },item);
}
async function selectAssistance(page,item,plan){
 await page.locator('#open-inventory').tap();await page.locator('#inventory-dialog[open]').waitFor();
 await page.locator(item==='greenBrush'?'#use-green-brush':'#use-color-key').tap();
 await tapCell(page,plan.command.index);await page.locator('#assistance-dialog[open]').waitFor();
 if(item==='colorKey')await page.locator('#assistance-value').selectOption(String(plan.command.value));
 assert.equal(await page.locator('#assistance-confirm').isEnabled(),true,'actual assistance preview enables confirmation');
}
async function replay(page){
 return page.evaluate(()=>{
  const p=JSON.parse(localStorage.getItem('hexrota-profile-v2')),index=p.game.current,meta=p.game.attempts[index],config=HEX_ECONOMY_CONFIG;
  const level=HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(meta.levelId,meta.variantId,meta.levelDataVersion);
  return new HexAssistedGame(level,{attemptId:meta.attemptId,limits:{greenBrush:config.inventory.greenBrush.maxPerAttempt,colorKey:config.inventory.colorKey.maxPerAttempt,rescue:config.rescue.maxPerAttempt}},p.game.boards[index]).snapshot();
 });
}

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port+'/';
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...(executable?{executablePath:executable}:{}),...(browserName==='chromium'?{args:['--no-sandbox']}:{})});
 await check('second-write fault stays armed through finish and next real native command works without focus or reload',async()=>{
  const f=await open();try{
   await enter(f.page);const before=await profile(f.page),route=await currentRoute(f.page),firstPair=route[board(before).turn];
   await installProbe(f.page);await segment(f.page,'first real gesture');await touch(f.page,firstPair);await idle(f.page);
   const committed=await profile(f.page),first=await writes(f.page);
   await segment(f.page,'next real gesture');await touch(f.page,route[board(committed).turn]);await idle(f.page);
   const next=await profile(f.page),second=await writes(f.page);
   measurements.push({label:'second-write',beforeTurn:board(before).turn,committedTurn:board(committed).turn,nextTurn:board(next).turn,first,second});
   await shot(f.page,'second-write-armed-native-continuation');
   oneWrite(first,'first real gesture');assert.deepEqual(committed,JSON.parse(first.writes[0].value));
   assert.equal(committed.revision,before.revision+1);assert.deepEqual(attempt(committed),attempt(before));assert.deepEqual(committed.energy,before.energy);assert.deepEqual(committed.game.economy,before.game.economy);
   oneWrite(second,'next real gesture');assert.equal(board(next).turn,board(committed).turn+1,'storage recovery is not needed to accept the next valid native input');
   assert.deepEqual(attempt(next),attempt(before));
  }finally{await restoreProbe(f.page);await f.close();}
 });
 for(const [width,height]of [[320,568],[390,844],[430,932]])await check(`${width}x${height} native committed cascade has one write and stable board and HUD`,async()=>{
  const fixture=nonterminalFixture(),f=await open({saved:fixture.saved,size:{width,height}});try{
   await enter(f.page);const before=await profile(f.page),start=await geometry(f.page,'before-'+width);
   await shot(f.page,'geometry-'+width+'-before');await installProbe(f.page);await segment(f.page,'one native cascade');
   await touch(f.page,fixture.pair);await f.page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='true');
   const committed=await profile(f.page),during=await geometry(f.page,'during-'+width);await shot(f.page,'geometry-'+width+'-during');
   assert.deepEqual(board(committed),fixture.expected,'canonical command is complete while real feedback remains busy');
   assert.equal(committed.revision,before.revision+1);assert.deepEqual(attempt(committed),attempt(before));
   assert.deepEqual(committed.energy,before.energy);assert.deepEqual(committed.game.economy,before.game.economy);
   await idle(f.page);const after=await geometry(f.page,'after-'+width),log=await writes(f.page);
   await shot(f.page,'geometry-'+width+'-after');oneWrite(log,'native cascade');assert.equal(await canonical(f.page),log.writes[0].value,'visual finish leaves the exact first committed bytes');
   stable(start,during,'feedback geometry');stable(start,after,'finished geometry');await clean(f.page);
   measurements.push({label:'one-write-'+width,frames:fixture.frames,writes:log.writes.length,turn:board(committed).turn,attemptId:attempt(committed).attemptId});
  }finally{await restoreProbe(f.page);await f.close();}
 });
 for(const terminal of [false,true])await check(`first authoritative ${terminal?'winning':'playing'} write failure rolls back the whole command`,async()=>{
  const f=await open({saved:terminal?beforeWin(1):existing(2,{turns:1}).saved});try{
   await enter(f.page);const before=await profile(f.page),bytes=await canonical(f.page),priorEvents=await events(f.page),route=await currentRoute(f.page),pair=terminal?route.at(-1):route[board(before).turn];
   await installProbe(f.page);await segment(f.page,'failed first write',1);await touch(f.page,pair);await idle(f.page);
   const log=await writes(f.page);assert.equal(log.writes.length,1,'rollback does not retry the rejected transaction');assert.equal(log.writes[0].failed,true);
   assert.equal(await canonical(f.page),bytes,'canonical bytes roll back exactly, including revision, RNG, attempts, reward and energy');
   assert.deepEqual(await profile(f.page),before);assert.equal(await events(f.page),priorEvents,'failed command emits no committed observation');
   assert.equal(await f.page.locator('#sum').textContent(),String(board(before).score));assert.equal(await f.page.locator('#moves-left').textContent(),String(board(before).movesLeft));
   assert.deepEqual(await dialogs(f.page),[],'failed command never presents victory or defeat');await clean(f.page);
   measurements.push({label:'first-write-'+(terminal?'win':'playing'),writes:log.writes.length,exactCanonicalRollback:true,exactEventsRollback:true});await shot(f.page,'first-write-'+(terminal?'win':'playing')+'-rollback');
  }finally{await restoreProbe(f.page);await f.close();}
 });
 await check('final winning swap has one write one clear one terminal event and normal victory',async()=>{
  const f=await open({saved:beforeWin(1)});try{
   await enter(f.page);const before=await profile(f.page),pair=(await currentRoute(f.page)).at(-1),expected=await nextExpected(f.page,pair);assert.equal(expected.status,'won');
   await installProbe(f.page);await segment(f.page,'final winning gesture');await touch(f.page,pair);
   await f.page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='true');
   const committed=await profile(f.page),committedEvents=await events(f.page),id=attempt(committed).attemptId;
   assert.equal(await f.page.locator('#win-dialog').evaluate(node=>node.open),false,'victory is deferred while feedback is running');
   await idle(f.page);await f.page.locator('#win-dialog[open]').waitFor();await clean(f.page);
   const log=await writes(f.page);oneWrite(log,'winning gesture');assert.deepEqual(committed,JSON.parse(log.writes[0].value));assert.equal(await canonical(f.page),log.writes[0].value);
   assert.deepEqual(board(committed),expected.snapshot);assert.deepEqual(attempt(committed),attempt(before));
   assert.equal(committed.game.economy.gold,before.game.economy.gold+20);assert.equal(committed.game.economy.stars,before.game.economy.stars+1);
   const clear=Object.values(committed.game.economy.transactions).filter(row=>row.kind==='clear'&&row.attemptId===id);assert.equal(clear.length,1);
   assert.equal(committed.energy.life.lives,before.energy.life.lives);assert.equal(committed.energy.life.settledAttempts[id].outcome,'won');assert.equal(committed.energy.life.settledAttempts[id].charged,false);
   assert.equal(eventList(committedEvents).filter(row=>row.name==='level_completed'&&row.attemptId===id).length,1);assert.equal(await events(f.page),committedEvents,'finish cannot roll back or duplicate terminal observations');
   assert.doesNotMatch(await f.page.locator('#toast').textContent(),/kaydedilemedi|döndürüldü/,'normal victory is never described as a rolled-back command');
   await f.page.locator('#review').tap();await f.page.locator('#continue').tap();await f.page.locator('#win-dialog[open]').waitFor();
   oneWrite(await writes(f.page),'reopened committed result');assert.equal(await canonical(f.page),log.writes[0].value);assert.equal(await events(f.page),committedEvents);
   measurements.push({label:'winning-swap',writes:log.writes.length,clearCount:clear.length,terminalEvents:1,attemptId:id});await shot(f.page,'one-winning-command-normal-victory');
  }finally{await restoreProbe(f.page);await f.close();}
 });
 for(const item of ['greenBrush','colorKey']){
  await check(`${item} actual UI commits once with inventory history attempt and strict replay intact`,async()=>{
   const f=await open({saved:legacyClears(6)});try{
    await enter(f.page);const before=await profile(f.page),plan=await assistancePlan(f.page,item),priorEvents=await events(f.page);
    await installProbe(f.page);await segment(f.page,'preview',0);await selectAssistance(f.page,item,plan);
    assert.equal((await writes(f.page)).writes.length,0,'preview is read-only');assert.deepEqual(await profile(f.page),before);assert.equal(await events(f.page),priorEvents);
    await segment(f.page,'confirmed '+item);await f.page.locator('#assistance-confirm').tap();await idle(f.page);
    const after=await profile(f.page),log=await writes(f.page);oneWrite(log,item+' confirmation');assert.equal(await canonical(f.page),log.writes[0].value);
    assert.deepEqual(board(after),plan.preview.snapshot);assert.deepEqual(await replay(f.page),board(after),'production strict replay reconstructs the exact mixed command stream');
    assert.deepEqual(attempt(after),attempt(before));assert.deepEqual(board(after).history,board(before).history);assert.equal(board(after).turn,board(before).turn);assert.equal(board(after).movesLeft,board(before).movesLeft);
    assert.equal(board(after).commands.at(-1).id,plan.command.id);assert.equal(board(after).commands.at(-1).type,plan.command.type);
    assert.equal(after.game.economy.inventory[item],before.game.economy.inventory[item]-1);assert.deepEqual(after.energy,before.energy);
    const debit=after.game.economy.transactions[plan.command.id];assert.equal(debit.kind,'use');assert.equal(debit.itemId,item);assert.equal(debit.attemptId,attempt(before).attemptId);
    assert.equal(eventList(await events(f.page)).filter(row=>row.name==='booster_used'&&row.attemptId===attempt(before).attemptId&&row.boosterId===item).length,1);
    await clean(f.page);measurements.push({label:item,commandId:plan.command.id,writes:log.writes.length,strictReplay:true,attemptId:attempt(after).attemptId});await shot(f.page,item+'-committed-once');
   }finally{await restoreProbe(f.page);await f.close();}
  });
  await check(`${item} first authoritative UI write failure atomically restores inventory command and events`,async()=>{
   const f=await open({saved:legacyClears(6)});try{
    await enter(f.page);const before=await profile(f.page),bytes=await canonical(f.page),priorEvents=await events(f.page),plan=await assistancePlan(f.page,item);
    await selectAssistance(f.page,item,plan);await installProbe(f.page);await segment(f.page,'failed '+item,1);await f.page.locator('#assistance-confirm').tap();await idle(f.page);
    const log=await writes(f.page);assert.equal(log.writes.length,1);assert.equal(log.writes[0].failed,true);assert.equal(await canonical(f.page),bytes);assert.deepEqual(await profile(f.page),before);assert.equal(await events(f.page),priorEvents);
    assert.equal(await f.page.locator('#sum').textContent(),String(board(before).score));await clean(f.page);
    measurements.push({label:item+'-first-write-failure',writes:log.writes.length,exactCanonicalRollback:true,exactEventsRollback:true});await shot(f.page,item+'-atomic-rollback');
   }finally{await restoreProbe(f.page);await f.close();}
  });
 }
 for(const interruption of ['rapid taps','animation cancel','animation throw','Home','Pause during second wave','visibility hidden'])await check(`${interruption} retires presentation without another gameplay command`,async()=>{
  const fixture=nonterminalFixture(),f=await open({saved:fixture.saved});try{
   await enter(f.page);const before=await profile(f.page),sourcePoint=await pointCell(f.page,fixture.pair[0]);await installProbe(f.page);await segment(f.page,'committed cascade',0);
   if(interruption==='animation throw')await f.page.evaluate(()=>{
    const native=Element.prototype.animate;window.__f01AnimationThrows=0;window.__f01RestoreAnimate=()=>Element.prototype.animate=native;
    Element.prototype.animate=function(...args){if(this.closest?.('#board')){window.__f01AnimationThrows++;throw new Error('F01 optional browser animation fault');}return native.apply(this,args);};
   });
   await touch(f.page,fixture.pair);
   if(interruption!=='animation throw')await f.page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='true');
   if(interruption==='Pause during second wave')await f.page.waitForFunction(()=>!!document.querySelector('.score-packet[data-wave="2"]'),null,{timeout:6000});
   const committed=await profile(f.page),committedEvents=await events(f.page);
   assert.deepEqual(board(committed),fixture.expected);assert.equal(board(committed).turn,board(before).turn+1);assert.deepEqual(attempt(committed),attempt(before));
   let expectedWrites=1;
   if(interruption==='rapid taps'){
    // A physical double tap uses the same screen point. Cache it before the
    // gesture, since cascade renders replace SVG nodes while input is busy.
    const times=[];
    for(let index=0;index<2;index++){times.push(await f.page.evaluate(()=>performance.now()));await f.page.touchscreen.tap(sourcePoint.x,sourcePoint.y);}
    assert(times[1]-times[0]<350,'two literal native taps form a rapid double tap');measurements.push({label:'rapid-tap-timing',intervalMs:times[1]-times[0]});
   }else if(interruption==='animation cancel')await f.page.evaluate(()=>{
    window.__f01CancelledAnimations=0;
    for(const animation of document.getAnimations())if(animation.effect?.target?.closest?.('#board')&&animation.playState==='running'){window.__f01CancelledAnimations++;animation.cancel();}
   });
   else if(interruption==='Home'){await f.page.locator('#game-home').tap();await f.page.waitForFunction(()=>document.body.dataset.screen==='home');expectedWrites=2;}
   else if(interruption==='Pause during second wave'){await f.page.locator('#pause').tap();await f.page.locator('#pause-dialog[open]').waitFor();expectedWrites=2;}
   else if(interruption==='visibility hidden'){
    await f.page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    await f.page.locator('#pause-dialog[open]').waitFor();expectedWrites=2;
   }
   await idle(f.page);await clean(f.page);await f.page.waitForTimeout(3500);
   const after=await profile(f.page),log=await writes(f.page);unchanged(committed,after,interruption+' and late callbacks');assert.equal(await events(f.page),committedEvents);
   assert.equal(log.writes.length,expectedWrites,interruption+' permits only the committed move and its explicit Home/Pause persistence');
   for(const entry of log.writes.slice(1))unchanged(committed,JSON.parse(entry.value),'navigation or pause write preserves the committed command');
   if(expectedWrites===1)assert.equal(await canonical(f.page),log.writes[0].value,'presentation interruption alone does not change canonical bytes');
   if(interruption==='animation cancel')assert((await f.page.evaluate(()=>window.__f01CancelledAnimations))>0,'actual running Web Animations were cancelled');
   if(interruption==='animation throw')assert((await f.page.evaluate(()=>window.__f01AnimationThrows))>0,'actual browser animation path threw after the commit');
   if(interruption==='Home')assert.deepEqual(await dialogs(f.page),[],'old timers never show a result over Home');
   if(interruption==='Pause during second wave'){
    await segment(f.page,'explicit motion preference write',0);await f.page.locator('#pause-settings').tap();
    await f.page.locator('#settings-dialog[open]').waitFor();await f.page.locator('#setting-motion').selectOption('reduce');
    const preference=await profile(f.page),preferenceLog=await writes(f.page);oneWrite(preferenceLog,'explicit preference change');
    assert.deepEqual(preference.game,{...committed.game,preferences:{...committed.game.preferences,motion:'reduce'}},'only the requested preference changes');
    assert.deepEqual(preference.energy,committed.energy);assert.equal(await events(f.page),committedEvents);
    assert.equal(preference.revision,after.revision+1,'preferences retain their existing independent persistence authority');
    measurements.push({label:'preferences-authority',writes:preferenceLog.writes.length,motion:preference.game.preferences.motion});
    await f.page.locator('#settings-done').tap();await f.page.locator('#pause-continue').tap();
   }
   if(interruption==='visibility hidden'){
    await segment(f.page,'explicit foreground life and rescue refresh',0);
    await f.page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    unchanged(committed,await profile(f.page),'legitimate foreground authority');
    const foreground=await writes(f.page);assert(foreground.writes.length>0,'existing life/rescue refresh authority remains active');
    for(const entry of foreground.writes)unchanged(committed,JSON.parse(entry.value),'explicit life refresh');
    measurements.push({label:'foreground-authority',writes:foreground.writes.length});
   }
   measurements.push({label:interruption,frames:fixture.frames,writes:log.writes.length,allowedAuthorityWrites:expectedWrites-1,lateCallbacksWaitMs:3500});await shot(f.page,interruption.replaceAll(' ','-'));
  }finally{await f.page.evaluate(()=>window.__f01RestoreAnimate?.()).catch(()=>{});await restoreProbe(f.page);await f.close();}
 });
 await check('reduced motion commits once and retains native continuation',async()=>{
  const f=await open({motion:'reduce'});try{
   await enter(f.page);const before=await profile(f.page),route=await currentRoute(f.page),pair=route[board(before).turn],expected=await nextExpected(f.page,pair);
   await installProbe(f.page);await segment(f.page,'reduced motion');await touch(f.page,pair);await idle(f.page);oneWrite(await writes(f.page),'reduced motion');
   assert.deepEqual(board(await profile(f.page)),expected.snapshot);await clean(f.page);
   await segment(f.page,'reduced motion next real command');await touch(f.page,route[expected.snapshot.turn]);await idle(f.page);oneWrite(await writes(f.page),'reduced motion continuation');
   assert.equal(board(await profile(f.page)).turn,board(before).turn+2);await shot(f.page,'reduced-motion-native-continuation');
  }finally{await restoreProbe(f.page);await f.close();}
 });
 for(const terminal of [false,true])await check(`postcommit ${terminal?'winning':'playing'} finisher DOM render exception keeps canonical bytes events and cleanup`,async()=>{
  const fixture=terminal?{saved:beforeWin(1)}:nonterminalFixture(),f=await open({saved:fixture.saved});try{
   await enter(f.page);const start=await geometry(f.page,'render-error-before');await installProbe(f.page);await segment(f.page,'render failure',0);
   const pair=terminal?(await currentRoute(f.page)).at(-1):fixture.pair,expectedCommand=await nextExpected(f.page,pair),sourcePoint=await pointCell(f.page,pair[0]);
   const pauseRect=terminal?await f.page.locator('#pause').boundingBox():null;if(terminal)assert(pauseRect,'visible Pause hit target exists before the command');
   await touch(f.page,pair);await f.page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='true');
   const committed=await profile(f.page),committedEvents=await events(f.page);assert.deepEqual(board(committed),expectedCommand.snapshot);
   await f.page.evaluate(()=>{
    const board=document.getElementById('board'),native=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');window.__f01RenderThrows=0;
    window.__f01RestoreRender=()=>delete board.innerHTML;
    Object.defineProperty(board,'innerHTML',{configurable:true,get(){return native.get.call(this);},set(value){window.__f01RenderThrows++;throw new Error('F01 optional final DOM render fault');}});
   });
   // Completed campaign boards intentionally refuse further board input. The
   // visible Pause control still reveals their already committed result and
   // reaches the final renderer synchronously, before another cascade render.
   if(terminal)await f.page.touchscreen.tap(pauseRect.x+pauseRect.width/2,pauseRect.y+pauseRect.height/2);else await f.page.touchscreen.tap(sourcePoint.x,sourcePoint.y);await idle(f.page);
   assert((await f.page.evaluate(()=>window.__f01RenderThrows))>0,'the finisher actually hit the injected board DOM setter');
   oneWrite(await writes(f.page),'postcommit rendering failure');assert.deepEqual(await profile(f.page),committed);assert.equal(await events(f.page),committedEvents);
   assert.doesNotMatch(await f.page.locator('#toast').textContent(),/kaydedilemedi|döndürüldü/,'an optional DOM failure cannot report a domain rollback');await clean(f.page);
   stable(start,await geometry(f.page,'render-error-after'),'optional render exception');await f.page.evaluate(()=>window.__f01RestoreRender());
   if(terminal){
    await f.page.locator('#win-dialog[open]').waitFor();assert.equal(await canonical(f.page),(await writes(f.page)).writes[0].value,'eligible victory remains presentation only after the DOM fault');
    assert.equal(eventList(await events(f.page)).filter(row=>row.name==='level_completed'&&row.attemptId===attempt(committed).attemptId).length,1);
    assert.equal(await events(f.page),committedEvents);
   }else{
    const expected=await nextExpected(f.page);await segment(f.page,'native continuation after render failure');await touch(f.page,expected.pair);await idle(f.page);
    oneWrite(await writes(f.page),'native continuation after DOM failure');assert.deepEqual(board(await profile(f.page)),expected.snapshot);
   }
   measurements.push({label:'postcommit-'+(terminal?'winning':'playing')+'-render-failure',domainRollback:false,canonicalWrites:1,cleanup:true,...terminal?{eligibleVictoryOpens:true}:{nextNativeCommand:true}});await shot(f.page,'postcommit-'+(terminal?'winning':'playing')+'-render-failure-cleanup');
  }finally{await f.page.evaluate(()=>window.__f01RestoreRender?.()).catch(()=>{});await restoreProbe(f.page);await f.close();}
 });
 await check('actual reload during committed winning feedback preserves one clear and terminal event',async()=>{
  const f=await open({saved:beforeWin(1)});try{
   await enter(f.page);const before=await profile(f.page),pair=(await currentRoute(f.page)).at(-1);await installProbe(f.page);await segment(f.page,'winning move plus explicit pagehide',0);
   await f.page.evaluate(()=>window.addEventListener('pagehide',()=>sessionStorage.setItem('f01-last-document-writes',JSON.stringify(window.__f01Writes.active))));
   await touch(f.page,pair);await f.page.waitForFunction(()=>document.querySelector('#board').getAttribute('aria-busy')==='true'&&!document.querySelector('#win-dialog').open);
   const committed=await profile(f.page),committedEvents=await events(f.page),oldOrigin=await f.page.evaluate(()=>performance.timeOrigin),id=attempt(committed).attemptId,index=committed.game.current;
   assert.equal(committed.game.economy.gold,before.game.economy.gold+20);assert.equal(committed.game.economy.stars,before.game.economy.stars+1);oneWrite(await writes(f.page),'winning command before actual reload');
   const response=await f.page.reload({waitUntil:'domcontentloaded'});assert.equal(response.status(),200);await f.page.waitForFunction(()=>document.body.dataset.screen==='home');
   assert.notEqual(await f.page.evaluate(()=>performance.timeOrigin),oldOrigin,'a genuinely new browser document loaded');
   const reloaded=await profile(f.page),oldLog=await f.page.evaluate(()=>JSON.parse(sessionStorage.getItem('f01-last-document-writes')));
   // bindRescueUI, bindLivesUI and the generic checkpoint handler each retain
   // their own pagehide authority. Their three writes are separate from the
   // command; retiring its presentation must not add a fourth pagehide write.
   assert.equal(oldLog.writes.length,4,'old document permits one command plus existing rescue, life and checkpoint pagehide writes; visual retirement adds none');
   for(const entry of oldLog.writes.slice(1))unchanged(committed,JSON.parse(entry.value),'legitimate rescue/life/checkpoint pagehide persistence');
   assert.equal(reloaded.game.current,3,'established bootstrap selects the next unopened level after first clear');
   assert.deepEqual(reloaded.game,{...committed.game,current:3},'only established campaign routing may change on bootstrap');assert.deepEqual(reloaded.energy,committed.energy);
   assert.deepEqual(reloaded.game.boards[index],committed.game.boards[index]);assert.deepEqual(reloaded.game.attempts[index],attempt(committed));
   assert.equal(Object.values(reloaded.game.economy.transactions).filter(row=>row.kind==='clear'&&row.attemptId===id).length,1);assert.equal(eventList(await events(f.page)).filter(row=>row.name==='level_completed'&&row.attemptId===id).length,1);
   await f.page.waitForTimeout(3500);unchanged(reloaded,await profile(f.page),'old callback deadlines after actual reload');assert.equal(await events(f.page),committedEvents);assert.deepEqual(await dialogs(f.page),[]);await clean(f.page);
   measurements.push({label:'actual-mid-win-reload',oldDocumentWrites:oldLog.writes.length,allowedPagehideWrites:3,currentAdvancedTo:3,exactWonCheckpoint:true,terminalEventCount:1,attemptId:id});await shot(f.page,'actual-reload-committed-win');
  }finally{await restoreProbe(f.page);await f.close();}
 });
 assert.deepEqual(errors,[],'no unhandled browser errors');
 console.log('F01 browser checks passed: '+results.length+' actual '+browserName+' groups.');
})().catch(error=>{failure=error.stack||String(error);console.error(error);process.exitCode=1;}).finally(async()=>{
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({browser:browserName,success:!failure,passed:results.length,results,measurements,errors,failure,nativeTouchInput:true,physicalDeviceTested:false,mobileViewports:[[320,568],[390,844],[430,932]],visibilityTest:'synthetic visibilitychange during an actual native-touch cascade; existing foreground life/rescue authority remains active',reloadTest:'actual HTTP reload while the canonical win is still presenting; no native BFCache claim',filter:process.env.HEXROTA_F01_ONLY||null},null,2)+'\n');
 if(browser)await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));
});
