from pathlib import Path
import subprocess, hashlib

root=Path('.')
def edit(path,old,new):
 p=root/path;s=p.read_text();assert s.count(old)==1,(path,old[:100],s.count(old));p.write_text(s.replace(old,new))
def add(path,text):
 p=root/path;p.write_text(p.read_text()+text)
asset='assets/characters/tavik/front.webp'
assert hashlib.sha256((root/'dist'/asset).read_bytes()).hexdigest()=='7d844f1415c9aae1895805fd8efed174165d793d27a71c08ae89711f938ed7e8'
edit('dist/index.html','<h1 id="home-title">Aynı sayıları<br><span>eşleştir.</span></h1>','<div class="tavik-intro"><h1 id="home-title">Aynı sayıları<br><span>eşleştir.</span></h1><figure class="tavik-portrait"><img src="./assets/characters/tavik/front.webp" width="147" height="238" alt="Tavik: mor tüylü, gözlüklü ve sırt çantalı tavuk" decoding="async"><figcaption>Tavik</figcaption></figure></div>')
add('src/styles/06-comic-adventure.css','''
/* Approved Tavik: direct art crop, not a regenerated mascot. */
body[data-ui-theme="comic"] .tavik-intro{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:10px 0 16px;min-width:0}
body[data-ui-theme="comic"] .tavik-intro h1{flex:1;min-width:0;margin:0}
body[data-ui-theme="comic"] .tavik-portrait{flex:0 0 98px;width:98px;margin:0;overflow:hidden;background:#f9e7d8;border:3px solid #e5b65d;border-radius:22px;box-shadow:0 4px 0 #241637,0 7px 20px #120b2444}
body[data-ui-theme="comic"] .tavik-portrait img{display:block;width:100%;height:auto;object-fit:contain}
body[data-ui-theme="comic"] .tavik-portrait figcaption{margin:0;padding:5px 2px 6px;text-align:center;font-size:15px;line-height:1.1;font-weight:900;color:#fff1d2;background:#654085}
body[data-ui-theme="comic"] .tavik-story-art{position:relative;width:min(100%,350px);height:230px;margin:-76px auto 0}
body[data-ui-theme="comic"] .kit-story .tavik-story-book{display:block;width:100%;height:100%;object-fit:contain;margin:0}
body[data-ui-theme="comic"] .kit-story .tavik-story-guest{position:absolute;left:21%;top:30%;width:64px;height:104px;object-fit:contain;margin:0;border:2px solid #c68b43;border-radius:8px;background:#f9e7d8;transform:rotate(-9deg);box-shadow:0 3px 8px #4b204766}
@media(max-width:360px){body[data-ui-theme="comic"] .tavik-intro{gap:10px}body[data-ui-theme="comic"] .tavik-portrait{flex-basis:80px;width:80px}body[data-ui-theme="comic"] .tavik-intro h1{font-size:29px}}
@media(max-height:520px) and (min-width:601px){body[data-ui-theme="comic"] .tavik-portrait{flex-basis:80px;width:80px}}
''')
old='<img src="./assets/ui/adventure-book.svg" alt="Altıgen bulmacalar ve yıldızlı bir yol gösteren açık macera kitabı">'
new='<div class="tavik-story-art"><img class="tavik-story-book" src="./assets/ui/adventure-book.svg" alt="Açık macera kitabı"><img class="tavik-story-guest" src="./assets/characters/tavik/front.webp" width="147" height="238" alt="Tavik, onaylı karakter tasarımı" decoding="async"></div>'
edit('dist/ui-kit.html',old,new)
edit('dist/ui-kit.html','Bir yıldız daha, bir sürpriz daha.<br>Hikâyenin devamı seni bekliyor.','Tavik’in macerası seni bekliyor.<br>Bir yıldız daha, bir sürpriz daha.')
edit('dist/ui-kit.html','Karakter tasarımı henüz sabitlenmediği için bu sette tavuk kullanılmadı. Başka oyunların ekran görüntüleri, markaları ve karakterleri varlık olarak alınmadı. Bu kit yalnız sunum katmanıdır.','Tavik, kullanıcının onayladığı karakter paftasından alınmıştır; yeniden tasarlanmadı. Bu kit yalnız sunum katmanıdır; hikâye açılması ve yıldız ilerlemesi henüz buraya bağlı değildir.')
edit('dist/sw.js','const ASSETS=[',"const ASSETS=['"+asset+"',")
mime="  if(path.endsWith('.webp'))return type==='image/webp';\n"
edit('dist/sw.js',"  if(path.endsWith('.png'))return type==='image/png';\n","  if(path.endsWith('.png'))return type==='image/png';\n"+mime)
for name in ['dist/index.html','dist/ui-kit.html','dist/sw.js','dist/app.js','dist/hint-worker.js']:
 p=root/name;s=p.read_text();s=s.replace('?v=30','?v=31').replace('hexrota-shell-v30','hexrota-shell-v31');p.write_text(s)
# Preserve the baseline hash guard, allowing only this named art preload and MIME line.
old="for(const asset of tokens.assets)source=source.replace(\"'assets/ui/\"+asset+\"',\",'');"
new=old+"source=source.replace(\"'assets/characters/tavik/front.webp',\",'').replace(\"  if(path.endsWith('.webp'))return type==='image/webp';\\n\",'');"
edit('check-comic-ui.cjs',old,new)
add('check-comic-ui.cjs',"\nrequire('./check-tavik-assets.cjs');\n")
# The existing theme/browser suite is already run by both browser CI jobs.
edit('check-comic-ui-browser.cjs',"'.png':'image/png'","'.png':'image/png','.webp':'image/webp'")
old="await page.locator('#home-play').tap();"
new="await check(size.width+' approved Tavik portrait renders',async()=>{const img=page.locator('.tavik-portrait img');await img.evaluate(n=>n.decode());assert.equal(await img.evaluate(n=>n.naturalWidth),147);assert.equal(await img.evaluate(n=>n.naturalHeight),238);await fits(page,'.tavik-portrait');assert.equal(await page.locator('.tavik-portrait figcaption').textContent(),'Tavik');await page.screenshot({path:path.join(out,'tavik-home-'+size.width+'.png'),fullPage:true});});\n "+old
edit('check-comic-ui-browser.cjs',old,new)
edit('check-comic-ui-browser.cjs',"await page.locator('[data-demo]').first().tap();","await page.locator('.tavik-story-guest').evaluate(n=>n.decode());assert.equal(await page.locator('.tavik-story-guest').evaluate(n=>n.naturalWidth),147);assert.equal(await page.locator('.tavik-story-guest').isVisible(),true);await page.locator('[data-demo]').first().tap();")
# Extend the real offline regression to cover the new binary asset, without changing app behavior.
edit('check-integration-browser.cjs',"'.png':'image/png'","'.png':'image/png','.webp':'image/webp'")
edit('check-integration-browser.cjs',"const offlineAssets=['',","const offlineAssets=['','assets/characters/tavik/front.webp',")
edit('check-integration-browser.cjs',"await context.setOffline(true);await page.reload();await ready(page);await enter(page);","await context.setOffline(true);await page.reload();await ready(page);await page.locator('.tavik-portrait img').evaluate(n=>n.decode());assert.equal(await page.locator('.tavik-portrait img').evaluate(n=>n.naturalWidth),147,'approved Tavik remains available offline');await enter(page);")
for name in ['docs/UI_VISUAL_LANGUAGE.md','docs/UI_RESTYLE_9_6_REPORT.md']:
 add(name,'\n\n## Onaylı Tavik — 15 Kasım 2026\n\nKarakter seçimi artık onaylı: mor tüylü, krem gövdeli, gözlüklü Tavik. Önceki “karakter henüz onaylanmadı” notu bu onayla geçersizdir. Kaynak kimliği ve doğrudan kırpma kaydı `data/tavik-approved.json`; rehber `docs/TAVIK_APPROVED.md`. Ana menü portresi ve örnek hikâye kartı bağlandı. Yeni karakter tasarımı, oyun kuralı veya hikâye ilerlemesi eklenmedi. PWA v31 bu yerel WebP görselini açık MIME denetimiyle önbelleğe alır. Nihai CI sonucu PR #18 üzerinde aynı commit ile doğrulanmalıdır.\n')
subprocess.run(['node','scripts/sync-styles.cjs'],check=True)
print('Approved Tavik crop integrated; domain sources untouched.')
