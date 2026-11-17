/* Actual HTTP navigation and production application; not physical-device testing. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),{legacyClears}=require('./check-progression-ui.cjs'),{lifePool,NOW}=require('./check-lives-ui.cjs');
const name=process.env.HEXROTA_BROWSER||'chromium',root=path.join(__dirname,'dist'),out=process.env.HEXROTA_COMIC_SCREENSHOT_DIR||path.join(__dirname,'test-results','comic-'+name);assert(['chromium','webkit'].includes(name));fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const server=http.createServer((req,res)=>{let file;try{const url=new URL(req.url,'http://local');file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));}catch{res.writeHead(400).end();return;}if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(b);});});
let browser;const results=[],errors=[];
async function check(label,fn){await fn();results.push(label);console.log('PASS '+label);}
async function fits(page,selector){const locator=page.locator(selector);await locator.evaluate(n=>n.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));const b=await locator.boundingBox(),v=page.viewportSize();assert(b&&b.width>0&&b.height>0,selector+' visible');assert(b.x>=-1&&b.x+b.width<=v.width+1,selector+' horizontal clipping');assert(b.y>=-1&&b.y+b.height<=v.height+1,selector+' vertical clipping');}
async function dialogFits(page, selector){
 const data=await page.locator(selector).evaluate(n=>({rect:n.getBoundingClientRect().toJSON(),position:getComputedStyle(n).position,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth}));
 const r=data.rect,v=page.viewportSize();
 assert.equal(data.position,'fixed',selector+' is anchored to the viewport, not page scroll');
 assert(r.width>0&&r.height>0&&r.x>=-1&&r.y>=-1&&r.right<=v.width+1&&r.bottom<=v.height+1,selector+' entire frame stays in viewport');
 assert(data.scrollWidth<=data.clientWidth+1,selector+' has no horizontal overflow');
}
async function noOverlap(page,a,b){
 const x=await page.locator(a).boundingBox(),y=await page.locator(b).boundingBox();
 assert(x&&y,a+' and '+b+' have geometry');
 assert(x.x+x.width<=y.x+.5||y.x+y.width<=x.x+.5||x.y+x.height<=y.y+.5||y.y+y.height<=x.y+.5,a+' must not overlap '+b);
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';const executable=name==='webkit'?process.env.HEXROTA_WEBKIT_PATH:process.env.HEXROTA_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);browser=await(name==='webkit'?webkit:chromium).launch({headless:true,...(executable?{executablePath:executable}:{}),...(name==='chromium'?{args:['--no-sandbox']}:{})});
for(const size of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:932,height:430},{width:1280,height:900}]){
 const ctx=await browser.newContext({viewport:size,hasTouch:true,isMobile:true,deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
 await ctx.addInitScript(({saved,energy,now})=>{if(location.protocol!=='http:')return;Date.now=()=>now;if(!localStorage.getItem('hexrota-profile-v2')){localStorage.setItem('hexrota-match-v5',JSON.stringify(saved));localStorage.setItem('hexrota-lives-v1',JSON.stringify(energy));}},{saved:legacyClears(2),energy:lifePool(5,{bypass:true}),now:NOW});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>!!window.HexLifeTestAdapter&&document.body.dataset.screen==='home');
 await check(size.width+' home actions align without dock occlusion',async()=>{
  const rects=await page.locator('#home-play,#home-teach,#home-garden').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
  for(const r of rects){assert(Math.abs(r.left-rects[0].left)<=1,'stacked actions share a left edge');assert(Math.abs(r.width-rects[0].width)<=1,'stacked actions share a width');}
  if(size.width<=650&&size.height<=620&&size.height>size.width){
   const dock=await page.locator('.app-navigation').boundingBox();assert(rects[0].bottom<=dock.y-1,'initial Oyna button is fully above navigation without scrolling');
  }
 });
 await check(size.width+' all modal frames survive a scrolled menu',async()=>{
  const before=await page.evaluate(()=>localStorage.getItem('hexrota-profile-v2'));
  const ids=await page.locator('dialog.modal').evaluateAll(nodes=>nodes.map(n=>n.id));
  for(const id of ids){
   await page.evaluate(id=>{window.scrollTo(0,200);document.getElementById(id).showModal();},id);
   await dialogFits(page,'#'+id);
   await page.locator('#'+id).evaluate(n=>n.close());
   await page.waitForTimeout(0);
  }
  assert.equal(await page.evaluate(()=>localStorage.getItem('hexrota-profile-v2')),before,'geometry checks do not alter progression');
  await page.evaluate(()=>window.scrollTo(0,0));
 });
 await page.locator('#home-lives').tap();await page.locator('#lives-dialog[open]').waitFor();
 await check(size.width+' life summary and close button stay inside panel',async()=>{
  await dialogFits(page,'#lives-dialog');await noOverlap(page,'#lives-title','#lives-dialog .modal-close');
  const fit=await page.locator('.life-dialog-stats').evaluate(n=>{const r=n.getBoundingClientRect();return [...n.querySelectorAll('span,strong')].every(x=>{const b=x.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1;});});assert(fit,'life labels and values stay within summary');
  await page.screenshot({path:path.join(out,'lives-'+size.width+'.png')});
 });
 await page.locator('#lives-dialog [data-close]').first().tap();
 await check(size.width+' home and responsive width',async()=>{assert.equal(await page.locator('body').getAttribute('data-ui-theme'),'comic');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await fits(page,'#home-play');assert((await page.locator('.home-art').evaluate(n=>getComputedStyle(n,'::after').backgroundImage)).includes('adventure-book.svg'));await page.screenshot({path:path.join(out,'home-'+size.width+'.png'),fullPage:true});});
 await check(size.width+' prepared Tavik cutout renders while the approved portrait remains the fallback',async()=>{
  await page.waitForFunction(()=>document.body.dataset.sceneActorReady==='true');
  const img=page.locator('.hx-scene-actor-anchor .hx-tavik__sprite');assert.equal(await img.count(),1,'one prepared scene actor, never duplicated companions');await img.evaluate(n=>n.decode());assert.equal(await img.evaluate(n=>n.naturalWidth),384);assert.equal(await img.evaluate(n=>n.naturalHeight),384);assert.equal(await img.isVisible(),true,'the scene actor is visible');assert(await img.evaluate(n=>{let alpha=1;for(let p=n;p;p=p.parentElement)alpha*=Number(getComputedStyle(p).opacity);return alpha>.95;}),'the prepared actor is painted at full opacity');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/scenes/coop-v1/manifest.json'),'utf8')),url=new URL(await img.evaluate(n=>n.currentSrc));assert(manifest.poses.some(pose=>url.pathname==='/assets/scenes/coop-v1/'+pose.file),'only supplied poses may render Tavik');await fits(page,'.hx-scene-actor-anchor');
  const fallback=page.locator('.tavik-portrait img');assert.equal(await fallback.count(),1,'approved original portrait survives as a fallback');await fallback.evaluate(n=>n.decode());assert.equal(await fallback.evaluate(n=>n.naturalWidth),147);assert.equal(await fallback.evaluate(n=>n.naturalHeight),238);assert.equal(await page.locator('.tavik-portrait figcaption').textContent(),'Tavik');await page.screenshot({path:path.join(out,'tavik-home-'+size.width+'.png'),fullPage:true});
 });
 await page.locator('#home-play').tap();await page.locator('#pregame-dialog[open]').waitFor();
 await check(size.width+' pregame remains onscreen after home scroll',async()=>{await dialogFits(page,'#pregame-dialog');
  await page.setViewportSize({width:size.height,height:size.width});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await dialogFits(page,'#pregame-dialog');
  await page.setViewportSize(size);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await dialogFits(page,'#pregame-dialog');
 });
 await fits(page,'#pregame-start');await dialogFits(page,'#pregame-dialog');await page.screenshot({path:path.join(out,'pregame-'+size.width+'.png')});await page.locator('#pregame-start').tap();await page.waitForFunction(()=>document.body.dataset.screen==='game');
 await check(size.width+' board and controls',async()=>{await fits(page,'#board');assert.equal(await page.locator('#hint').count(),0,'manual hint has no visible or empty dock slot');for(const id of ['#open-inventory','#pause'])await fits(page,id);assert.equal(await page.locator('#skip-animation').isVisible(),false);await page.screenshot({path:path.join(out,'game-'+size.width+'.png')});});
 await page.locator('#game-settings').tap();await page.locator('#settings-dialog[open]').waitFor();
 await check(size.width+' settings scrolling',async()=>{await dialogFits(page,'#settings-dialog');await noOverlap(page,'#settings-title','#settings-dialog .modal-close');await fits(page,'#settings-title');await page.screenshot({path:path.join(out,'settings-'+size.width+'.png')});await fits(page,'#settings-done');await page.locator('#settings-done').tap();assert.equal(await page.locator('#settings-dialog').evaluate(n=>n.open),false);});
 await page.locator('#open-inventory').tap();await page.locator('#inventory-dialog[open]').waitFor();await fits(page,'#inventory-title');await fits(page,'#buy-color-key');await page.screenshot({path:path.join(out,'inventory-'+size.width+'.png')});await page.locator('#inventory-dialog [data-close]').first().tap();
 await page.goto(url+'ui-kit.html');const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 await check(size.width+' story demo is isolated',async()=>{await page.locator('.tavik-story-guest').evaluate(n=>n.decode());assert.equal(await page.locator('.tavik-story-guest').evaluate(n=>n.naturalWidth),147);assert.equal(await page.locator('.tavik-story-guest').isVisible(),true);await page.locator('[data-demo]').first().tap();assert.equal(await page.locator('.kit-toast').isVisible(),true);assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),before);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'kit-'+size.width+'.png'),fullPage:true});});
 await ctx.close();
}
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({browser:name,groups:results.length,results,physicalDeviceTested:false},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
