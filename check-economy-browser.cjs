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
async function visibleControl(page,selector){const locator=page.locator(selector);await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox(),viewport=page.viewportSize();assert(box&&box.width>0&&box.height>0,selector+' is rendered');assert(box.x>=-.5&&box.x+box.width<=viewport.width+.5,selector+' fits the viewport width');assert(box.y>=-.5&&box.y+box.height<=viewport.height+.5,selector+' can be reached without clipping');}
async function start(page){await page.locator('#home-play').tap();if(await page.locator('#pregame-dialog').evaluate(node=>node.open))await page.locator('#pregame-start').tap();await page.waitForFunction(()=>document.body.dataset.screen==='game');}
async function move(page,pair){await page.evaluate(pair=>{for(const index of pair)document.querySelector(`#board [data-index="${index}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}));},pair);await page.waitForFunction(()=>document.getElementById('board').getAttribute('aria-busy')==='false');}
async function route(page){return page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('hexrota-profile-v2')).game,meta=saved.attempts[saved.current];return HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(meta.levelId,meta.variantId,meta.levelDataVersion).solution;});}
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
  assert.deepEqual(errors,[],'no browser exceptions');fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({browser:browserName,results,physicalDevicesTested:false},null,2));console.log(`Economy mobile checks passed: ${results.length} groups. Artifacts: ${output}. Physical iPhone/Android verification remains open.`);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
