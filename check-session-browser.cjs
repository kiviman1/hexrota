'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const {fresh,lifePool,plain,NOW,MINUTE}=require('./check-lives-ui.cjs');
const PROFILE='hexrota-profile-v2';
const readProfile=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PROFILE);
const ready=page=>page.waitForFunction(()=>!!window.HexLifeTestAdapter);
const click=async(page,selector)=>{await page.locator(selector).click();};
async function start(page){await click(page,'#home-play');if(await page.locator('#pregame-dialog').evaluate(node=>node.open))await click(page,'#pregame-start');}
async function swap(page,pair){await page.evaluate(pair=>{for(const index of pair)document.querySelector(`#board [data-index="${index}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}));},pair);await page.waitForFunction(()=>document.getElementById('board').getAttribute('aria-busy')==='false');}
async function makeContext(browser,life){const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await context.addInitScript(({saved,life,now})=>{window.__lifeTestUtc=now;Date.now=()=>window.__lifeTestUtc;if(location.protocol!=='http:')return;if(!localStorage.getItem('hexrota-profile-v2')&&!localStorage.getItem('hexrota-match-v5')){localStorage.setItem('hexrota-match-v5',JSON.stringify(saved));localStorage.setItem('hexrota-lives-v1',JSON.stringify(life));}},{saved:fresh(),life,now:NOW});return context;}
async function main(){
 const server=http.createServer((req,res)=>{const filename=path.join(__dirname,'dist',decodeURIComponent(new URL(req.url,'http://test').pathname).replace(/^\//,'')||'index.html');if(!filename.startsWith(path.join(__dirname,'dist')+path.sep)){res.writeHead(403).end();return;}fs.readFile(filename,(error,bytes)=>{if(error){res.writeHead(404).end();return;}const ext=path.extname(filename);res.setHeader('content-type',ext==='.js'?'text/javascript':ext==='.html'?'text/html':ext==='.css'?'text/css':ext==='.json'?'application/json':ext==='.svg'?'image/svg+xml':'application/octet-stream');res.end(bytes);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/`;
 const options={headless:true};if(process.env.CHROMIUM_EXECUTABLE)options.executablePath=process.env.CHROMIUM_EXECUTABLE;
 let browser;
 try{
  browser=await chromium.launch(options);const context=await makeContext(browser,lifePool(5));const errors=[];context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  const first=await context.newPage();await first.goto(url);await ready(first);await start(first);
  const second=await context.newPage();await second.goto(url);await second.locator('#session-lock-panel').waitFor();
  assert.match(await second.locator('#session-lock-panel').textContent(),/başka bir sekmede/);assert.equal(await second.evaluate(()=>!!window.HexLifeTestAdapter),false);
  const initial=await readProfile(first),pair=await first.evaluate(()=>{const s=JSON.parse(localStorage.getItem('hexrota-profile-v2')).game,meta=s.attempts[2];return HexAttempts.createCatalog(HEX_LEVELS,HEX_VARIANTS,HexMatch).resolveLevel(1,meta.variantId,meta.levelDataVersion).solution[0];});
  await Promise.all([swap(first,pair),second.evaluate(()=>{for(const id of ['home-play','lives-ad','life-provider-confirm','restart-confirm'])document.getElementById(id)?.click();})]);
  const after=await readProfile(first);assert.equal(after.game.boards[2].history.length,1);assert.equal(after.energy.life.lives,5);assert(after.revision>initial.revision);
  await second.waitForTimeout(1100);assert.deepEqual(await readProfile(second),after,'read-only tab does not write regeneration, receipts, or selection');
  await first.close();await second.locator('#session-lock-panel button').click();await ready(second);await start(second);assert.deepEqual((await readProfile(second)).game.boards[2],after.game.boards[2],'handoff resumes latest canonical board');
  console.log('PASS two real Chromium pages: exclusive writer, concurrent UI attempt ignored, no overwrite, close/retry handoff');
  const before=await readProfile(second);await second.evaluate(()=>{const original=Storage.prototype.setItem;window.__restoreStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key==='hexrota-profile-v2')throw new DOMException('quota','QuotaExceededError');return original.call(this,key,value);};});
  await click(second,'#reset');await click(second,'#restart-confirm');assert.deepEqual(await readProfile(second),before,'failed canonical restart is all-or-nothing');await second.evaluate(()=>window.__restoreStorage());
  await second.reload();await ready(second);assert.deepEqual((await readProfile(second)).game.boards[2],before.game.boards[2]);assert.equal((await readProfile(second)).energy.life.lives,5);console.log('PASS real Chromium quota failure: board, attempt selection, wallet and life recover together');
  await second.evaluate(()=>{localStorage.setItem('hexrota-match-v5',JSON.stringify({current:0,done:[],boards:{}}));localStorage.removeItem('hexrota-lives-v1');});await second.reload();await ready(second);assert.deepEqual((await readProfile(second)).game.boards[2],before.game.boards[2]);assert.equal((await readProfile(second)).energy.life.lives,5);console.log('PASS canonical recovery ignores stale/missing compatibility mirrors');
  await context.close();
  const ads=await makeContext(browser,lifePool(4)),adPage=await ads.newPage();await adPage.goto(url);await ready(adPage);await click(adPage,'#home-lives');await click(adPage,'#lives-ad');await adPage.evaluate(now=>window.__lifeTestUtc=now,NOW+31*MINUTE);await click(adPage,'#life-provider-confirm');const completed=await readProfile(adPage);assert.equal(completed.energy.life.lives,5);assert.equal(completed.energy.life.pendingAdLives,1);assert.match(await adPage.locator('#lives-unlimited-note').textContent(),/Bekleyen reklam ödülün/);
  const receipt=Object.values(completed.energy.provider.transactions).find(item=>item.status==='completed').receipt;await adPage.evaluate(receipt=>HexLifeTestAdapter.applyReceipt(receipt),receipt);assert.equal((await readProfile(adPage)).energy.life.pendingAdLives,1);await adPage.reload();await ready(adPage);assert.equal((await readProfile(adPage)).energy.life.pendingAdLives,1);console.log('PASS completed ad at natural full pool: visible durable pending reward, duplicate callback grants once');
  await ads.close();
  const unsupported=await browser.newContext();await unsupported.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));const unsupportedPage=await unsupported.newPage();await unsupportedPage.goto(url);await unsupportedPage.locator('#session-lock-panel').waitFor();assert.equal(await unsupportedPage.evaluate(()=>localStorage.getItem('hexrota-profile-v2')),null);assert.match(await unsupportedPage.locator('#session-lock-panel').textContent(),/desteklemiyor/);await unsupported.close();console.log('PASS unsupported lock capability fails closed without changing existing records');
  assert.deepEqual(errors,[],'no browser exceptions');console.log('Chromium session consistency checks passed. Physical iPhone verification remains open.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
