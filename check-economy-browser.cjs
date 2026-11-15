/* Rendered mobile progression/economy integration in real Chromium or WebKit. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium,webkit}=require('playwright');
const {legacyClears,beforeWin}=require('./check-progression-ui.cjs');
const {lifePool,plain,NOW}=require('./check-lives-ui.cjs');
const dist=path.join(__dirname,'dist'),browserName=process.env.HEXROTA_BROWSER||'chromium',PROFILE='hexrota-profile-v2';
assert(['chromium','webkit'].includes(browserName));
const output=process.env.HEXROTA_ECONOMY_SCREENSHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-economy-'+browserName+'-'));fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer((request,response)=>{
 let file;try{const pathname=decodeURIComponent(new URL(request.url,'http://local').pathname);file=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));}catch(_){response.writeHead(400).end();return;}
 if(!file.startsWith(dist+path.sep)){response.writeHead(403).end();return;}
 fs.readFile(file,(error,bytes)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});response.end(bytes);});
});
const errors=[],results=[];let browser,url;
async function open(saved=legacyClears(2),size={width:390,height:844},{canonical=null,expectBlocked=false}={}){
 const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addInitScript(({saved,energy,now,canonical})=>{if(location.protocol!=='http:')return;Date.now=()=>now;if(!localStorage.getItem('hexrota-profile-v2')&&!localStorage.getItem('hexrota-match-v5')){if(canonical)localStorage.setItem('hexrota-profile-v2',JSON.stringify(canonical));localStorage.setItem('hexrota-match-v5',JSON.stringify(canonical?canonical.game:saved));localStorage.setItem('hexrota-lives-v1',JSON.stringify(canonical?canonical.energy:energy));}},{saved,energy:lifePool(5,{bypass:true}),now:NOW,canonical});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(url);if(expectBlocked)await page.locator('#session-lock-panel').waitFor();else await page.waitForFunction(()=>!!window.HexLifeTestAdapter&&document.body.dataset.screen==='home');
 return {context,page,profile:()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROFILE),close:()=>context.close()};
}
async function visibleControl(page,selector){const locator=page.locator(selector);await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox(),viewport=page.viewportSize();assert(box&&box.width>0&&box.height>0,selector+' is rendered');const widthFits=box.x>=-.5&&box.x+box.width<=viewport.width+.5,heightFits=box.y>=-.5&&box.y+box.height<=viewport.height+.5;if(!widthFits||!heightFits)await page.screenshot({path:path.join(output,'unreachable-'+selector.replace(/[^a-z0-9]+/gi,'-')+'.png'),fullPage:true});assert(widthFits,selector+' fits the viewport width '+JSON.stringify({box,viewport}));assert(heightFits,selector+' can be reached without clipping '+JSON.stringify({box,viewport}));}
async function start(page){await page.locator('#home-play').tap();if(await page.locator('#pregame-dialog').evaluate(node=>node.open))await page.locator('#pregame-start').tap();await page.waitForFunction(()=>document.body.dataset.screen==='game');}
async function move(page,pair){await page.evaluate(pair=>{for(const index of pair)document.querySelector(`#board [data-index="${index}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}));},pair);await page.waitForFunction(()=>document.getElementById('board').getAttribute('aria-busy')==='false');}
async function route(page){return page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('hexrota-profile-v2')).game,meta=saved.attempts[saved.current];return HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(meta.levelId,meta.variantId,meta.levelDataVersion).solution;});}
async function assistancePreview(page,item,{matching=true}={}){return page.evaluate(({item,matching})=>{
 const saved=JSON.parse(localStorage.getItem('hexrota-profile-v2')).game,meta=saved.attempts[saved.current],catalog=HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch),level=catalog.resolveLevel(meta.levelId,meta.variantId,meta.levelDataVersion),config=HEX_ECONOMY_CONFIG;
 const model=new HexAssistedGame(level,{attemptId:meta.attemptId,limits:{greenBrush:config.inventory.greenBrush.maxPerAttempt,colorKey:config.inventory.colorKey.maxPerAttempt,rescue:config.rescue.maxPerAttempt}},saved.boards[saved.current]);
 const id=`assist:${model.attemptId}:${model.commands.length+1}:${item}`;let command;
 if(item==='greenBrush')command={id,type:'green_brush',index:model.layers.findIndex(layer=>layer>0)};
 else for(let index=0;index<model.total&&!command;index++)for(const value of level.palette)if(value!==model.values[index]){const candidate={id,type:'color_key',index,value},preview=model.preview(candidate);if(preview.result.ok&&(matching?preview.result.frames.length:preview.result.frames.length===0)){command=candidate;break;}}
 if(!command)throw Error('The real board has no matching single-number change');
 return {command,preview:model.preview(command),before:model.snapshot()};
},{item,matching});}
async function selectAssistance(page,item,index){await page.locator('#open-inventory').tap();await page.locator(item==='greenBrush'?'#use-green-brush':'#use-color-key').tap();await page.locator(`#board [data-index="${index}"]`).tap();await page.locator('#assistance-dialog[open]').waitFor();}
async function settleAssistance(page){await page.waitForFunction(()=>document.getElementById('board').getAttribute('aria-busy')==='false');}
async function check(name,run){await run();results.push({name,passed:true});console.log('✓ '+browserName+' '+name);}

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}/`;
 const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 try{
  browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...executable?{executablePath:executable}:{},args:browserName==='chromium'?['--no-sandbox']:[]});
  for(const [width,height]of [[320,568],[390,844],[844,390]])await check(`${width}×${height} menu, inventory and only the next main level are usable`,async()=>{
   const f=await open(legacyClears(2),{width,height});try{
    assert.equal((await f.profile()).game.economy!==undefined,true);
    for(const selector of ['#home-play','#home-teach','#home-lives','#home-screen [data-nav="journey"]'])await visibleControl(f.page,selector);
    assert.equal(await f.page.locator('#home-screen [data-game-gold]').textContent(),'40');assert.equal(await f.page.locator('#home-screen [data-game-stars]').textContent(),'2');
    await f.page.locator('#home-screen [data-nav="journey"]').tap();await visibleControl(f.page,'[data-stage="4"]');assert.equal(await f.page.locator('[data-stage="2"],[data-stage="3"],[data-stage="5"]').count(),0);
    await f.page.locator('[data-stage="4"]').tap();await visibleControl(f.page,'#pregame-start');await f.page.locator('#pregame-dialog [data-close]').tap();
    assert.equal((await f.profile()).game.variantSelection.serial,0,'preview does not advance the real attempt counter');
    await f.page.screenshot({path:path.join(output,`journey-${width}x${height}.png`),fullPage:true});
   }finally{await f.close();}
  });
  await check('real milestone win, stale controls, reset and reload cannot duplicate rewards',async()=>{
   const f=await open();try{
    await start(f.page);for(const pair of await route(f.page))await move(f.page,pair);await f.page.locator('#win-dialog[open]').waitFor();
    const won=await f.profile();assert.equal(won.game.economy!==undefined,true);assert.equal(await f.page.locator('#win-gold').textContent(),'+20 Altın');assert.equal(await f.page.locator('#win-star').textContent(),'+1 yıldız');
    assert.equal(await f.page.locator('#home-screen [data-game-gold]').textContent(),'60');assert.equal(await f.page.locator('#home-screen [data-game-stars]').textContent(),'3');assert.equal(await f.page.locator('#home-screen [data-green-brush]').textContent(),'3');
    await f.page.evaluate(()=>{for(let i=0;i<100;i++){document.getElementById('continue').click();document.getElementById('review').click();}for(const attribute of ['data-stage','data-level']){const button=document.createElement('button');button.setAttribute(attribute,'4');(attribute==='data-level'?document.getElementById('levels'):document.body).append(button);button.click();button.remove();}document.getElementById('pregame-start').click();document.getElementById('reset').click();document.getElementById('restart-confirm').click();});
    assert.deepEqual((await f.profile()).game.economy,won.game.economy);assert.deepEqual((await f.profile()).game.boards[4],won.game.boards[4]);assert.deepEqual((await f.profile()).game.variantSelection,won.game.variantSelection);
    await f.page.locator('#game-home').tap();await f.page.locator('#settings').tap();await f.page.locator('#settings-reset').tap();await visibleControl(f.page,'#reset-confirm');await f.page.locator('#reset-confirm').tap();
    assert.deepEqual((await f.profile()).game.economy,won.game.economy);await f.page.reload();await f.page.waitForFunction(()=>!!window.HexLifeTestAdapter);assert.deepEqual((await f.profile()).game.economy,won.game.economy);assert.equal((await f.profile()).energy.testWallet.gold,300);
    await f.page.screenshot({path:path.join(output,'milestone-after-reset.png'),fullPage:true});
   }finally{await f.close();}
  });
  await check('all-cleared campaign shows a reachable garden and never creates a new attempt',async()=>{
   const f=await open(legacyClears(10),{width:320,height:568});try{
    const before=await f.profile();assert.match(await f.page.locator('#home-play-label').textContent(),/Bahçeni gör/);await f.page.locator('#home-play').tap();await f.page.waitForFunction(()=>document.body.dataset.screen==='garden');
    assert.match(await f.page.locator('#garden-screen').textContent(),/Yeni bölümler yakında/);assert.equal(await f.page.locator('[data-stage]').count(),2);assert.deepEqual((await f.profile()).game.variantSelection,before.game.variantSelection);assert.deepEqual((await f.profile()).game.economy,before.game.economy);
    await f.page.screenshot({path:path.join(output,'complete-garden.png'),fullPage:true});
   }finally{await f.close();}
  });
  await check('a failed final winning write cannot persist partial Gold, stars, inventory, board or observations',async()=>{
   const f=await open(beforeWin(3));try{
    await start(f.page);const finalPair=(await route(f.page)).at(-1),before=await f.profile(),events=await f.page.evaluate(()=>localStorage.getItem('hexrota-events-v1'));
    await f.page.evaluate(()=>{const native=Storage.prototype.setItem;window.__restoreEconomyStorage=()=>Storage.prototype.setItem=native;Storage.prototype.setItem=function(key,value){if(key==='hexrota-profile-v2')throw new DOMException('injected quota failure','QuotaExceededError');return native.call(this,key,value);};});
    await move(f.page,finalPair);assert.deepEqual(await f.profile(),before,'canonical failed win is completely unchanged');assert.equal(await f.page.evaluate(()=>localStorage.getItem('hexrota-events-v1')),events,'uncommitted completion cannot become a durable event');assert.equal(await f.page.locator('#win-dialog').evaluate(node=>node.open),false);
    await f.page.evaluate(()=>window.__restoreEconomyStorage());await f.page.reload();await f.page.waitForFunction(()=>!!window.HexLifeTestAdapter);await start(f.page);await move(f.page,finalPair);await f.page.locator('#win-dialog[open]').waitFor();
    assert.equal(await f.page.locator('#home-screen [data-game-gold]').textContent(),'60');assert.equal(await f.page.locator('#home-screen [data-game-stars]').textContent(),'3');assert.equal(await f.page.locator('#home-screen [data-green-brush]').textContent(),'3');assert.equal((await f.profile()).energy.life.lives,5);
   }finally{await f.close();}
  });
  await check('malformed schema, forged ledger, string campaign ID and null economy fail closed without rewriting saved progress',async()=>{
   const seed=await open();let canonical;try{canonical=await seed.profile();}finally{await seed.close();}
   const badStates=[null,{...canonical.game.economy,schemaVersion:999},{...canonical.game.economy,gold:canonical.game.economy.gold+1},{...canonical.game.economy,clearedLevelIds:['1',2]}];
   for(const economy of badStates){const corrupted=plain(canonical);corrupted.game.economy=economy;const f=await open(undefined,undefined,{canonical:corrupted,expectBlocked:true});try{
    assert.match(await f.page.locator('#session-lock-panel').textContent(),/Kayıt güvenle açılamadı/);assert.deepEqual(await f.profile(),corrupted);assert.equal(await f.page.evaluate(()=>!!window.HexLifeTestAdapter),false,'no life/transaction capability is exposed after invalid profile rejection');
    await f.page.waitForTimeout(40);assert.deepEqual(await f.profile(),corrupted,'failed startup never creates a replacement economy or profile revision');
   }finally{await f.close();}}
  });
  await check('320px assistance controls and previews remain reachable without resizing the board or spending on cancellation',async()=>{
   const f=await open(legacyClears(6),{width:320,height:568});try{
    await start(f.page);const before=await f.profile(),board=await f.page.locator('#board').boundingBox();await visibleControl(f.page,'#open-inventory');await f.page.locator('#open-inventory').tap();await visibleControl(f.page,'#use-green-brush');await visibleControl(f.page,'#use-color-key');await f.page.screenshot({path:path.join(output,'inventory-320x568.png'),fullPage:true});await f.page.locator('#inventory-dialog .modal-close[data-close]').tap();
    for(const item of ['greenBrush','colorKey']){
     const planned=await assistancePreview(f.page,item);await selectAssistance(f.page,item,planned.command.index);if(item==='colorKey'){assert.equal(await f.page.locator('#assistance-value').inputValue(),'');assert.equal(await f.page.locator('#assistance-confirm').isDisabled(),true);await f.page.locator('#assistance-value').selectOption(String(planned.command.value));}
     await visibleControl(f.page,'#assistance-confirm');await visibleControl(f.page,'#assistance-cancel');const displayed=await f.page.locator('#board').boundingBox();assert.equal(displayed.width,board.width,'opening a preview never shrinks the board');assert.equal(displayed.height,board.height,'preview target instructions never reserve board space');
     await f.page.screenshot({path:path.join(output,`preview-${item}-320x568.png`),fullPage:true});await f.page.locator('#assistance-cancel').tap();assert.deepEqual((await f.profile()).game.economy,before.game.economy);assert.deepEqual((await f.profile()).game.boards,before.game.boards);
    }
    assert.equal(await f.page.locator('#skip-animation').isVisible(),false);assert.equal(await f.page.locator('.board-legend').count(),0);
   }finally{await f.close();}
  });
  await check('real brush and color-key confirmations match deterministic command replay and cannot bypass one-use caps',async()=>{
   for(const [clears,item]of [[3,'greenBrush'],[6,'colorKey']]){const f=await open(legacyClears(clears));try{
    await start(f.page);const before=await f.profile(),planned=await assistancePreview(f.page,item),stage=before.game.current;await selectAssistance(f.page,item,planned.command.index);if(item==='colorKey')await f.page.locator('#assistance-value').selectOption(String(planned.command.value));await f.page.locator('#assistance-confirm').tap();await settleAssistance(f.page);
    const committed=await f.profile();assert.deepEqual(committed.game.boards[stage],planned.preview.snapshot,'rendered interaction commits the exact assisted state, including refill RNG');assert.equal(committed.game.economy.inventory[item],2);assert.equal(committed.game.economy.gold,before.game.economy.gold);assert.equal(committed.game.boards[stage].movesLeft,before.game.boards[stage].movesLeft);assert.equal(committed.game.boards[stage].turn,before.game.boards[stage].turn);assert.deepEqual(committed.energy,before.energy);
    if(item==='greenBrush')for(const field of ['values','rngState','score','history'])assert.deepEqual(committed.game.boards[stage][field],before.game.boards[stage][field]);else assert(planned.preview.result.scoreGain>0);
    await f.page.evaluate(()=>document.getElementById('assistance-confirm').click());await f.page.locator('#open-inventory').tap();assert.equal(await f.page.locator(item==='greenBrush'?'#use-green-brush':'#use-color-key').isDisabled(),true);await f.page.evaluate(item=>{document.getElementById(item==='greenBrush'?'use-green-brush':'use-color-key').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.getElementById('assistance-confirm').click();},item);assert.deepEqual((await f.profile()).game.economy,committed.game.economy);assert.deepEqual((await f.profile()).game.boards[stage],committed.game.boards[stage]);
    await f.page.reload();await f.page.waitForFunction(()=>!!window.HexLifeTestAdapter);await start(f.page);assert.deepEqual((await f.profile()).game.boards[stage],committed.game.boards[stage],'assisted continuation preserves exact command replay');await f.page.screenshot({path:path.join(output,`committed-${item}.png`),fullPage:true});
   }finally{await f.close();}}
  });
  await check('inventory purchases debit 70/90 game Gold while leaving TEST Gold, stars and gameplay unchanged',async()=>{
   for(const [item,selector,cost]of [['greenBrush','#buy-green-brush',70],['colorKey','#buy-color-key',90]]){const f=await open(legacyClears(6));try{
    await start(f.page);const before=await f.profile();await f.page.locator('#open-inventory').tap();await visibleControl(f.page,selector);assert.match(await f.page.locator(selector).textContent(),new RegExp(String(cost)));await f.page.locator(selector).tap();const after=await f.profile();assert.equal(after.game.economy.gold,120-cost);assert.equal(after.game.economy.inventory[item],4);assert.equal(after.game.economy.stars,6);assert.deepEqual(after.energy.testWallet,before.energy.testWallet);assert.deepEqual(after.game.boards,before.game.boards);assert.equal(await f.page.locator(selector).isDisabled(),true);
    await f.page.evaluate(selector=>document.querySelector(selector).dispatchEvent(new MouseEvent('click',{bubbles:true})),selector);assert.deepEqual((await f.profile()).game.economy,after.game.economy,'insufficient-funds synthetic callback cannot charge or grant stock');
   }finally{await f.close();}}
  });
  await check('failed assistance writes leave stock, command history, board, life and events unchanged before a safe retry',async()=>{
   const f=await open(legacyClears(3));try{
    await start(f.page);const planned=await assistancePreview(f.page,'greenBrush');await selectAssistance(f.page,'greenBrush',planned.command.index);const before=await f.profile(),events=await f.page.evaluate(()=>localStorage.getItem('hexrota-events-v1'));
    await f.page.evaluate(()=>{const native=Storage.prototype.setItem;window.__restoreInventoryStorage=()=>Storage.prototype.setItem=native;Storage.prototype.setItem=function(key,value){if(key==='hexrota-profile-v2')throw new DOMException('injected assistance write failure','QuotaExceededError');return native.call(this,key,value);};});await f.page.locator('#assistance-confirm').tap();await settleAssistance(f.page);assert.deepEqual(await f.profile(),before);assert.equal(await f.page.evaluate(()=>localStorage.getItem('hexrota-events-v1')),events);
    await f.page.evaluate(()=>window.__restoreInventoryStorage());await f.page.reload();await f.page.waitForFunction(()=>!!window.HexLifeTestAdapter);await start(f.page);await selectAssistance(f.page,'greenBrush',planned.command.index);await f.page.locator('#assistance-confirm').tap();await settleAssistance(f.page);const after=await f.profile();assert.equal(after.game.economy.inventory.greenBrush,2);assert.deepEqual(after.game.boards[before.game.current],planned.preview.snapshot);assert.deepEqual(after.energy,before.energy);
   }finally{await f.close();}
  });
  await check('assisted command/debit mismatches and altered limits block startup without changing canonical saved bytes',async()=>{
   const seed=await open(legacyClears(6));let before,assisted;try{
    await start(seed.page);before=await seed.profile();const planned=await assistancePreview(seed.page,'greenBrush');await selectAssistance(seed.page,'greenBrush',planned.command.index);await seed.page.locator('#assistance-confirm').tap();await settleAssistance(seed.page);assisted=await seed.profile();
   }finally{await seed.close();}
   const changes=[value=>{value.game.economy=plain(before.game.economy);},value=>{value.game.boards[value.game.current]=plain(before.game.boards[value.game.current]);},value=>{value.game.boards[value.game.current].commands.pop();},value=>{value.game.boards[value.game.current].limits.greenBrush=2;}];
   for(const mutate of changes){const corrupted=plain(assisted);mutate(corrupted);const f=await open(undefined,undefined,{canonical:corrupted,expectBlocked:true});try{
    assert.match(await f.page.locator('#session-lock-panel').textContent(),/Kayıt güvenle açılamadı/);assert.deepEqual(await f.profile(),corrupted,'unreadable paid command evidence is preserved, never replaced by a fresh board');assert.equal(await f.page.evaluate(()=>!!window.HexLifeTestAdapter),false);assert.equal(await f.page.evaluate(()=>localStorage.getItem('hexrota-match-v5')),JSON.stringify(corrupted.game),'compatibility mirror also remains unchanged');
   }finally{await f.close();}}
  });
  await check('zero-point key preview states the result before the player explicitly spends one key',async()=>{
   const f=await open(legacyClears(6),{width:320,height:568});try{
    await start(f.page);const before=await f.profile(),planned=await assistancePreview(f.page,'colorKey',{matching:false});assert.equal(planned.preview.result.scoreGain,0);await selectAssistance(f.page,'colorKey',planned.command.index);await f.page.locator('#assistance-value').selectOption(String(planned.command.value));assert.match(await f.page.locator('#assistance-preview').textContent(),/0\s*puan/i);assert.equal(await f.page.locator('#assistance-confirm').isDisabled(),false);assert.deepEqual((await f.profile()).game.economy,before.game.economy);
    await f.page.locator('#assistance-value').evaluate((node,quoted)=>{const other=[...node.options].find(option=>option.value&&option.value!==String(quoted));if(!other)throw Error('An unquoted allowed value is required');node.value=other.value;},planned.command.value);await f.page.locator('#assistance-confirm').tap();assert.deepEqual((await f.profile()).game.economy,before.game.economy);assert.deepEqual((await f.profile()).game.boards,before.game.boards,'an obsolete number quote cannot be silently applied');
    await selectAssistance(f.page,'colorKey',planned.command.index);await f.page.locator('#assistance-value').selectOption(String(planned.command.value));await f.page.screenshot({path:path.join(output,'zero-point-key-preview-320x568.png'),fullPage:true});await f.page.locator('#assistance-confirm').tap();await settleAssistance(f.page);const after=await f.profile();assert.deepEqual(after.game.boards[before.game.current],planned.preview.snapshot);assert.equal(after.game.economy.inventory.colorKey,2);assert.equal(after.game.boards[before.game.current].score,before.game.boards[before.game.current].score);assert.deepEqual(after.game.boards[before.game.current].layers,before.game.boards[before.game.current].layers);
   }finally{await f.close();}
  });
  await check('leaving a target preview and a changed profile revision both invalidate its pending cost',async()=>{
   const f=await open(legacyClears(6));try{
    await start(f.page);const planned=await assistancePreview(f.page,'greenBrush');await selectAssistance(f.page,'greenBrush',planned.command.index);const before=await f.profile();await f.page.evaluate(()=>{document.getElementById('game-home').click();for(const id of ['buy-green-brush','buy-color-key','assistance-confirm'])document.getElementById(id).dispatchEvent(new MouseEvent('click',{bubbles:true}));});assert.deepEqual((await f.profile()).game.economy,before.game.economy,'even affordable stale purchase callbacks do nothing on the home screen');assert.deepEqual((await f.profile()).game.boards,before.game.boards);
    await start(f.page);await selectAssistance(f.page,'greenBrush',planned.command.index);const authoritative=await f.profile();authoritative.revision++;await f.page.evaluate(profile=>localStorage.setItem('hexrota-profile-v2',JSON.stringify(profile)),authoritative);await f.page.locator('#assistance-confirm').tap();await settleAssistance(f.page);assert.deepEqual(await f.profile(),authoritative,'a stale preview cannot overwrite the newer authoritative profile or charge inventory');
   }finally{await f.close();}
  });
  await check('assisted completion earns one normal campaign reward and is visibly marked as assisted',async()=>{
   const f=await open(legacyClears(3),{width:320,height:568});try{
    await start(f.page);const certificate=await route(f.page),planned=await assistancePreview(f.page,'greenBrush');await selectAssistance(f.page,'greenBrush',planned.command.index);await f.page.locator('#assistance-confirm').tap();await settleAssistance(f.page);
    for(const pair of certificate){const won=await f.page.evaluate(()=>document.getElementById('win-dialog').open);if(won)break;await move(f.page,pair);}await f.page.locator('#win-dialog[open]').waitFor();assert.equal(await f.page.locator('#win-assisted').isVisible(),true);assert.equal(await f.page.locator('#home-screen [data-game-gold]').textContent(),'80');assert.equal(await f.page.locator('#home-screen [data-game-stars]').textContent(),'4');const completed=await f.profile(),claim=Object.values(completed.game.economy.transactions).find(row=>row.kind==='clear'&&row.levelId===4);assert(claim&&claim.assisted);assert.equal(await f.page.locator('[data-stage="5"]').count(),0);await f.page.screenshot({path:path.join(output,'assisted-completion-320x568.png'),fullPage:true});
    await f.page.evaluate(()=>{document.getElementById('review').click();document.getElementById('continue').click();});assert.deepEqual((await f.profile()).game.economy,completed.game.economy);
   }finally{await f.close();}
  });
  assert.deepEqual(errors,[],'no browser exceptions');fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({browser:browserName,results,physicalDevicesTested:false},null,2));console.log(`Economy mobile checks passed: ${results.length} groups. Artifacts: ${output}. Physical iPhone/Android verification remains open.`);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
