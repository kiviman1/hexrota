/* Real mobile browser garden navigation and saved-state isolation. No physical-device claim. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium,webkit}=require('playwright');
const {legacyClears}=require('./check-progression-ui.cjs');
const {lifePool,NOW}=require('./check-lives-ui.cjs');
const {S,auditFields,pendingEvidence}=require('./check-garden-ui.cjs');
const config=require('./dist/economy-config.js'),Garden=require('./dist/garden.js');
const browserName=process.env.HEXROTA_BROWSER||'chromium',dist=path.join(__dirname,'dist'),PROFILE='hexrota-profile-v2';assert(['chromium','webkit'].includes(browserName));
const output=process.env.HEXROTA_GARDEN_SCREENSHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'hexrota-garden-'+browserName+'-'));fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((request,response)=>{
 let file;try{const pathname=decodeURIComponent(new URL(request.url,'http://local').pathname);file=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));}catch(_){response.writeHead(400).end();return;}
 if(!file.startsWith(dist+path.sep)){response.writeHead(403).end();return;}
 fs.readFile(file,(error,bytes)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});response.end(bytes);});
});
let browser,url;const errors=[],external=[],results=[];
async function open(saved,{width=320,height=568,lives=0}={}){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addInitScript(({saved,energy,now})=>{if(location.protocol!=='http:')return;Date.now=()=>now;if(!localStorage.getItem('hexrota-profile-v2')&&!localStorage.getItem('hexrota-match-v5')){localStorage.setItem('hexrota-match-v5',JSON.stringify(saved));localStorage.setItem('hexrota-lives-v1',JSON.stringify(energy));}},{saved,energy:lifePool(lives),now:NOW});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(url)&&!request.url().startsWith('data:'))external.push(request.url());});
 await page.goto(url);await ready(page);return {page,context,profile:()=>profile(page),close:()=>context.close()};
}
const profile=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROFILE);
const ready=page=>page.waitForFunction(()=>!!window.HexLifeTestAdapter&&!!window.HexGarden&&document.body.dataset.screen==='home');
async function visibleControl(page,selector){
 const locator=page.locator(selector);
 // WebKit SVG.scrollIntoView may center intrinsic SVG height rather than the
 // rendered CSS box. Scroll the page using actual viewport geometry, as a user
 // would, and still require the complete box plus overlay hit-test below.
 await locator.evaluate(node=>{const box=node.getBoundingClientRect();window.scrollBy({top:box.top+box.height/2-innerHeight/2,left:0,behavior:'auto'});return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 const box=await locator.boundingBox(),viewport=page.viewportSize();assert(box&&box.width>0&&box.height>0,selector+' visible');const fitsWidth=box.x>=-.5&&box.x+box.width<=viewport.width+.5,fitsHeight=box.y>=-.5&&box.y+box.height<=viewport.height+.5;
 if(!fitsWidth||!fitsHeight)await page.screenshot({path:path.join(output,'unreachable-'+selector.replace(/[^a-z0-9]+/gi,'-')+'.png'),fullPage:true});
 assert(fitsWidth,selector+' fits mobile width '+JSON.stringify({box,viewport}));assert(fitsHeight,selector+' reachable without clipping '+JSON.stringify({box,viewport}));
 const uncovered=await locator.evaluate((node,point)=>{const hit=document.elementFromPoint(point.x,point.y);return !!hit&&(node===hit||node.contains(hit));},{x:box.x+box.width/2,y:box.y+box.height/2});assert(uncovered,selector+' is reachable above fixed navigation or overlays');
}
async function garden(page){
 const view=await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('hexrota-profile-v2'));return HexEconomy.createManager(HEX_ECONOMY_CONFIG).view(p.game.economy);}),description=Garden.describe(view);
 await page.waitForFunction(()=>document.body.dataset.screen==='garden');assert.equal(await page.locator(S.stars).textContent(),String(view.stars));assert.equal(await page.locator(S.title).textContent(),description.title);assert.equal(await page.locator(S.copy).textContent(),description.summary);
 const svg=page.locator(S.visual+' svg');assert.equal(await svg.getAttribute('role'),'img');assert.equal(await svg.getAttribute('aria-label'),description.accessibleLabel);assert.equal(await svg.locator('[data-garden-layer="soil"]').count(),1);
 for(const milestone of view.botanical){const row=page.locator(S.milestones+` [data-garden-milestone="${milestone.id}"]`);assert.equal(await row.getAttribute('data-unlocked'),String(milestone.unlocked));assert.equal(await svg.locator(`[data-garden-layer="${milestone.id}"]`).count(),milestone.unlocked?1:0);}
 assert.equal(await page.locator(S.screen+' [data-stage],'+S.screen+' [data-level],'+S.screen+' [data-play]').count(),0,'no garden level replay action');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'garden never adds horizontal overflow');
 await visibleControl(page,S.visual+' svg');await visibleControl(page,S.back);for(const milestone of view.botanical)await visibleControl(page,S.milestones+` [data-garden-milestone="${milestone.id}"]`);
 return {svg:await page.locator(S.visual).innerHTML(),milestones:await page.locator(S.milestones).innerHTML(),description,view};
}
async function check(name,run){await run();results.push({name,passed:true});console.log('✓ '+browserName+' '+name);}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}/`;
 try{
  const executable=browserName==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  browser=await(browserName==='webkit'?webkit:chromium).launch({headless:true,...executable?{executablePath:executable}:{},args:browserName==='chromium'?['--no-sandbox']:[]});
  for(const stars of [0,...config.botanical.map(entry=>entry.stars)])await check(stars+' permanent stars at320×568: rendered layers, accessible controls, no currency/attempt changes and identical reload',async()=>{
   const f=await open(legacyClears(stars));try{
    const before=await f.profile();assert.equal(before.energy.life.lives,0);await visibleControl(f.page,S.entry);await f.page.locator(S.entry).tap();const first=await garden(f.page);assert.equal(first.view.stars,stars);assert.deepEqual(auditFields(await f.profile()),auditFields(before));
    await f.page.screenshot({path:path.join(output,'garden-'+stars+'-320x568.png'),fullPage:true});await f.page.locator(S.back).tap();await visibleControl(f.page,S.entry);await f.page.locator(S.entry).tap();assert.deepEqual(auditFields(await f.profile()),auditFields(before));
    await f.page.reload();await ready(f.page);await f.page.locator(S.entry).tap();const second=await garden(f.page);assert.equal(second.svg,first.svg);assert.equal(second.milestones,first.milestones);assert.deepEqual(auditFields(await f.profile()),auditFields(before));
   }finally{await f.close();}
  });
  for(const viewport of [{width:390,height:844},{width:844,height:390}])await check(viewport.width+'×'+viewport.height+' completed garden and final menu never reopen old levels',async()=>{
   const f=await open(legacyClears(config.levelIds.length),viewport);try{
    const before=await f.profile();assert.match(await f.page.locator('#home-play-label').textContent(),/Bahçeni gör/i);await visibleControl(f.page,'#home-play');await f.page.locator('#home-play').tap();const rendered=await garden(f.page);assert.equal(rendered.description.complete,true);assert.match(await f.page.locator(S.screen).textContent(),/Yeni bölümler yakında/i);
    assert.equal(await f.page.locator('[data-stage],[data-level]').evaluateAll(nodes=>nodes.filter(node=>Number(node.getAttribute('data-stage')??node.getAttribute('data-level'))>=2).length),0);assert.deepEqual(auditFields(await f.profile()),auditFields(before));await f.page.screenshot({path:path.join(output,`garden-complete-${viewport.width}x${viewport.height}.png`),fullPage:true});
   }finally{await f.close();}
  });
  await check('pending legacy completion flags keep levels closed while the garden uses only claimed stars',async()=>{
   const f=await open(pendingEvidence(config.levelIds.length));try{
    const before=await f.profile();assert.equal(before.game.economy.stars,0);assert.equal(before.game.economy.clearedLevelIds.length,config.levelIds.length);assert.equal(await f.page.locator('#progression-notice').isVisible(),true);await f.page.locator(S.entry).tap();const first=await garden(f.page);assert.equal(first.description.tier,'soil');assert.equal(first.description.complete,false);assert.deepEqual(auditFields(await f.profile()),auditFields(before));
    await f.page.reload();await ready(f.page);await f.page.locator(S.entry).tap();assert.equal((await garden(f.page)).svg,first.svg);assert.deepEqual(auditFields(await f.profile()),auditFields(before));await f.page.screenshot({path:path.join(output,'garden-pending-review-320x568.png'),fullPage:true});
   }finally{await f.close();}
  });
  await check('browsing around a real played attempt preserves its values, RNG, history, inventory and life ledgers',async()=>{
   const f=await open(legacyClears(config.inventory.colorKey.unlockAfterLevelId),{lives:3});try{
    await f.page.locator('#home-play').tap();if(await f.page.locator('#pregame-dialog').evaluate(node=>node.open))await f.page.locator('#pregame-start').tap();await f.page.waitForFunction(()=>document.body.dataset.screen==='game');
    const pair=await f.page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('hexrota-profile-v2')).game,m=p.attempts[p.current];return HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(m.levelId,m.variantId,m.levelDataVersion).solution[0];});
    await f.page.evaluate(pair=>{for(const index of pair)document.querySelector(`#board [data-index="${index}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}));},pair);await f.page.waitForFunction(()=>document.getElementById('board').getAttribute('aria-busy')==='false');await f.page.locator('#game-home').tap();const before=await f.profile();assert(before.game.boards[before.game.current].history.length>0);
    await f.page.locator(S.entry).tap();await garden(f.page);await f.page.locator(S.back).tap();assert.deepEqual(auditFields(await f.profile()),auditFields(before));await f.page.reload();await ready(f.page);assert.deepEqual(auditFields(await f.profile()),auditFields(before));
   }finally{await f.close();}
  });
  assert.deepEqual(errors,[],'no browser exceptions');assert.deepEqual(external,[],'no garden network service or external asset');fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({browser:browserName,results,physicalDevicesTested:false},null,2));console.log('Garden mobile passed: '+results.length+' real '+browserName+' groups. Artifacts: '+output+'. Physical iPhone/Android verification remains open.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
