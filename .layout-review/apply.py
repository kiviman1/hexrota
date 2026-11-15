from pathlib import Path
import hashlib, subprocess
inputs={'src/styles/06-comic-adventure.css':'8314d326dd8fb141f19c646abb08f856890323f4c65df52c9277353b6aef4b92','dist/style.css':'eb90af4ab849972f6d479e550560e8052b84a5f471e608e0b4a349ca30e0dae9','check-comic-ui-browser.cjs':'4de718254836eecf20460465f4f94b7239baacfd63b04c1f541e13dcd70839a2','dist/index.html':'70b6f202f4886f4e84e6355994103cc6cf36ccffe01fe78c5a52ba2965d5a876','dist/app.js':'5a28a122922588de0753332f3de496cd09b45028472167a3328d96b62e47bc73','dist/hint-worker.js':'badd61102667012c883e1638378fcc252d8040688a66bc2a68c94cdc1628cdb4','dist/sw.js':'67f6c8b41339daaef3c56838916cd38c62f9e03f4bfd3479bfbec75a009a0372','dist/ui-kit.html':'5c65fb73a93213c5e5d1004570eae80afcc9d3882f7deb2902d94bc9d8cd5974'}
for file,expected in inputs.items():
 assert hashlib.sha256(Path(file).read_bytes()).hexdigest()==expected, 'Unexpected source: '+file
css='''
/* Viewport-safe dialogs: page scroll must never move a top-layer panel. */
body[data-ui-theme="comic"] .modal{
  position:fixed;
  inset:0;
  margin:auto;
  max-width:calc(100vw - max(15px,env(safe-area-inset-left,0px)) - max(15px,env(safe-area-inset-right,0px)));
  max-height:calc(var(--app-height,100dvh) - max(16px,env(safe-area-inset-top,0px)) - max(16px,env(safe-area-inset-bottom,0px)));
  overscroll-behavior:contain;
  touch-action:pan-y;
}
/* A close button owns its corner; ribbon text must not occupy that space. */
body[data-ui-theme="comic"] .modal:has(>.modal-close)>.eyebrow{
  display:block;
  min-height:28px;
  padding-inline-end:44px;
  overflow-wrap:anywhere;
}
/* These actions are full-width blocks, not side-by-side inline buttons. */
body[data-ui-theme="comic"] #home-garden{margin-inline:0}
body[data-ui-theme="comic"] .home-copy{min-width:0}
body[data-ui-theme="comic"] .home-copy>.home-teach{max-width:100%}
@media(max-width:480px){
  body[data-ui-theme="comic"] .life-dialog-stats>div{flex-direction:column;align-items:center;justify-content:flex-start;gap:6px;text-align:center}
  body[data-ui-theme="comic"] .life-dialog-stats strong{max-width:100%;white-space:normal;overflow-wrap:anywhere}
}
/* Keep the initial play action above the bottom dock on compact phones. */
@media(max-width:650px) and (max-height:620px) and (orientation:portrait){
  body[data-ui-theme="comic"][data-screen="home"] .home-art{display:none}
  body[data-ui-theme="comic"] .tavik-portrait{flex-basis:58px;width:58px}
  body[data-ui-theme="comic"] .tavik-intro{margin-block:8px 12px}
  body[data-ui-theme="comic"][data-screen="home"] .home-copy>.eyebrow,
  body[data-ui-theme="comic"][data-screen="home"] .home-stage-name{display:none}
}
'''
p=Path('src/styles/06-comic-adventure.css');p.write_text(p.read_text()+css)
p=Path('check-comic-ui-browser.cjs');s=p.read_text()
anchor='(async()=>{await new Promise'
helper='''async function dialogFits(page, selector){
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
'''
assert s.count(anchor)==1;s=s.replace(anchor,helper+anchor)
anchor=" await check(size.width+' home and responsive width'"
new=""" await check(size.width+' home actions align without dock occlusion',async()=>{
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
"""
assert s.count(anchor)==1;s=s.replace(anchor,new+anchor)
anchor="await page.locator('#pregame-dialog[open]').waitFor();await fits(page,'#pregame-start');"
repl="""await page.locator('#pregame-dialog[open]').waitFor();
 await check(size.width+' pregame remains onscreen after home scroll',async()=>{await dialogFits(page,'#pregame-dialog');});
 await fits(page,'#pregame-start');await dialogFits(page,'#pregame-dialog');"""
assert s.count(anchor)==1;s=s.replace(anchor,repl)
s=s.replace("async()=>{await fits(page,'#settings-title');", "async()=>{await dialogFits(page,'#settings-dialog');await noOverlap(page,'#settings-title','#settings-dialog .modal-close');await fits(page,'#settings-title');")
s=s.replace("[{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1280,height:900}]", "[{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:932,height:430},{width:1280,height:900}]")
s=s.replace("async()=>{await dialogFits(page,'#pregame-dialog');});", """async()=>{await dialogFits(page,'#pregame-dialog');
  await page.setViewportSize({width:size.height,height:size.width});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await dialogFits(page,'#pregame-dialog');
  await page.setViewportSize(size);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await dialogFits(page,'#pregame-dialog');
 });""")
s=s.replace('await locator.scrollIntoViewIfNeeded();',"await locator.evaluate(n=>n.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));")
p.write_text(s)
for file in ['dist/index.html','dist/app.js','dist/hint-worker.js','dist/sw.js','dist/ui-kit.html']:
 p=Path(file);p.write_text(p.read_text().replace('?v=31','?v=32').replace('hexrota-shell-v31','hexrota-shell-v32'))
subprocess.run(['node','scripts/sync-styles.cjs'],check=True)
outputs={'src/styles/06-comic-adventure.css':'97bc8fa498c9cffca0cc0b77b4a2d4f2d376c597812e423a76e0d251ca850ae1','dist/style.css':'9199310521a63ae772fb9bd365146708fafaccccc9d625099a2e8c93be133bbd','check-comic-ui-browser.cjs':'dbeccdeb3a2e55a9bbb1320defdf67c7eb87c61f77b4fbe5dbb7bea5ebdddb45','dist/index.html':'00ee3ade4380af1dd5a2588afe33eb856acb55e1e324b83e55bce55f0dd251e3','dist/app.js':'c1848380510012862bbd26284308db5f869b89efacd54f6c544cf1f179afe26e','dist/hint-worker.js':'571658889b4296b54c637e1086723f06f16715e00a53fecd139bf5a55f30181a','dist/sw.js':'5b2571ba49470b579be76f442e5158a735b0862ecd7b356eb1c8043b8b117c27','dist/ui-kit.html':'3f64275aad788957506a93dbf711189825f564a99158740e2cb4730fb598692e'}
for file,expected in outputs.items():
 assert hashlib.sha256(Path(file).read_bytes()).hexdigest()==expected,'Output differs from tested local file: '+file
print('All eight layout source outputs match local validation')
