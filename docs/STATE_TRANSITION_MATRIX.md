# Hexrota — durum geçişleri ve davranış referansı

## Denetim tabanı

Bu bölüm, refaktörden **önceki `main` `996462b8513cfbdbe2747941c0aad76528357842`** davranışını kaydeder. Sonraki mimari değişiklikleri değerlendirirken bu referansın hangi davranışının korunduğu, hangisinin açıkça düzeltildiği belirtilmelidir. Tablo bir ikinci oyun motoru veya yeni kalıcı kayıt sözleşmesi değildir.

Kaynaklar: `dist/app.js`, `dist/index.html`, `dist/pwa.js`, `dist/session-store.js`; aşağıda adları verilen gerçek testler. Test referansının varlığı, bu denetim sırasında o testin yeniden çalıştırıldığı anlamına gelmez. Çalıştırılmış sonuçlar teslim raporuna yazılır.

Terimler: **otorite** motor/komut/ekonomi/can/profil sahibidir; **sunum** bu otoritenin görünümüdür. `PLAYING`, `WON`, `LOST` burada motorun mevcut `status` değerlerine karşılık gelir. `RESOLVING` eski uygulamada ayrı motor durumu değil, `busy` ve `presentation` yaşam döngüsüdür.

## Ekranlar

Gerçek üst düzey ekranlar `home`, `journey`, `game`, `records`, `garden` olup HTML'deki `#<ad>-screen` bölümleridir. Ayarlar bir ekran değildir: `settings-dialog` yerel bir `<dialog>` öğesidir. `showScreen()` tek görünür ve etkileşimli ekranı `hidden`/`inert` ile seçer; `body.dataset.screen` ve `[data-nav]` öğelerini günceller. Ekran geçişi tek başına `loadLevel()` değildir.

| Başlangıç | Olay / gerçek giriş | Koruma | Sonraki durum | Mevcut yan etkiler | Yasak kalıcı etki | Test referansı |
| --- | --- | --- | --- | --- | --- | --- |
| Uygulama açılıyor | `session-store.boot` → başlangıç `sessionAction` | Tek-yazıcı ve kayıt doğrulaması mevcut sahiplerde | `home`; geçerli kayıt/önizleme hazırlanır | Ekonomi/can başlatma veya geçişi, kayıtların türetilmesi, `loadLevel(active)`; `replaceState({screen:'home'}, '', '#home')` | Bozuk mevcut kaydı yeni oyuncu saymak; önizleme için varyant/Attempt ID üretmek | `check-maintenance.cjs`, `check-menu.cjs`, `check-session-browser.cjs` |
| İlk `home` | `#home-play` | `nextStage()` T1 ve `firstOpening` | `game`, gerçek T1 denemesi | `enterGame()` etkinleştirir; ilk açılış daveti kapanır; ses açma girişimi | Önizleme modalı zorlamak; can tüketmek | `check-menu.cjs` “first play…”; `check-first-play-browser.cjs` |
| `home`, devam eden kayıt | `#home-play` | Geçerli, oynanabilir ve terk edilmemiş checkpoint | `game`, aynı deneme | `enterGame(...fresh:false)`; mevcut devam olayı | Yeni varyant/tahta/RNG/Attempt ID üretmek | `check-menu.cjs` “continue resumes…”; `check-lives-ui.cjs` “in-flight variant…” |
| Her gerçek ekran | `[data-nav]` → `showScreen(next)` | Eski kod yalnız ekran adını kontrol eder | İstenen ekran | Sunumlar tamamlanır/iptal edilir, ipucu/gesture temizlenir; mevcut `persist()` çağrılır; modallar kapanır; ses/menüler/sahne yenilenir; farklı ekranda `pushState` | Yeni taş üretmek; ödül veya can kesintisi üretmek | `check-menu.cjs`; `check-garden-browser.cjs` |
| `home` / `journey` / diğer görünür ekran | `#home-garden` / `[data-nav="garden"]` | Bahçe ödül sahibi değildir | `garden` | Kazanılmış yıldızlardan görünüm yeniden üretilir | Yıldız harcamak; tamamlanmış bölümü yeniden oynanabilir yapmak | `check-garden-ui.cjs`, `check-garden-browser.cjs` |
| Kampanya tamamlanmış `home` / `win` | `#home-play` / `#next` | `campaignComplete` | `garden` | “Yeni bölümler yakında” sunumu | İlk kampanya bölümüne dönmek; tekrar ödül | `check-menu.cjs` “completed levels…”; `check-progression-ui.cjs` |
| Gerçek ekran, modal yok | `popstate` | `event.state.screen`, sonra hash, sonra `home` | İstenen ekran; `historyChange:false` | Aynı `showScreen()` temizliği; yeni `pushState` yok | Geri ile hamle/ödül üretmek | `check-menu.cjs` “nested Escape and browser back…” |
| En az bir açık modal | `popstate` | `topDialog()` | Aynı ekran; üst modal kapanır | `{screen}` yeniden geçmişe eklenir; alttaki modal korunur | Modal atlayarak ekranı terk etmek; onaylamak | `check-menu.cjs` “nested Escape…” |
| `game`, modal yok | `Escape` | Tekrarlanan ve Ctrl/Meta/Alt'lı tuşlar işlenmez | `pause`, veya motor terminalse sonuç modalı | `pauseGame()`; varsa sunum tamamlanır; oynanırken kayıt çağrısı | Yeni hamle, yeniden başlatma veya yeni can kesintisi | `check-menu.cjs` “pause blocks…” |
| `journey` / `records` / `garden`, modal yok | `Escape` | Geçerli klavye olayı | `home` | Normal ekran temizliği/geçmiş yazımı | Kalıcı ilerlemeyi silmek | `check-menu.cjs` |
| Yardımcı hedef seçimi, modal yok | `Escape` / hedef iptali | `assistanceMode` etkin | Aynı `game`; hedef seçimi biter | Yalnız geçici seçim temizliği | Envanter/Altın/hamle tüketmek | `check-inventory-ui.cjs` |
| Her ekran | Bilinmeyen ekran adı → `showScreen()` | **Eski davranış:** bilinmeyen ad `home` yapılır | `home` | Sunum iptali, `persist`, modal kapatma ve bazen geçmiş yazımı da çalışır | Yeni sözleşmede geçersiz isteğin bu yan etkileri üretmesi kabul edilmez | Refaktör karakterizasyonunda ayrıca sabitlenmeli; aşağıdaki bulgu N1 |

`showScreen('game')` denemeyi başlatan komut değildir. Mevcut uygulamada hash/geri yoluyla oyuna gelmek tek başına `attemptPending` engelini kaldırmaz. Etkin deneme, `enterGame()`/`loadLevel(...activate:true)` tarafından kurulmalıdır.

## Modal envanteri ve kasıtlı iç içe akışlar

HTML'de **15** modal vardır. “İkinci şans” ayrı bir modal değildir; `lose-dialog` içindeki `#second-chance-panel` bölgesidir. Öğretici koçu, Tavik konuşma portresi, hedef seçme notu, toast, skor/ödül efektleri ve sahne konuşması da `<dialog>` değildir.

Eski `openModal(id)` bütün modallarda önce öğretici gösterimini/gesture'ı durdurur, ipucunu ve geçersiz-takas görsellerini iptal eder; `assistance-dialog` hariç yardım seçimini temizler; etkin sunumu güvenle bitirir; sonuç zamanlayıcısını temizler. `dialog.showModal()` ve `modalStack.push(id)` yalnız aynı öğe kapalıysa çalışır. Açık aynı modala tekrar istek yığının yeni kopyasını eklemez. Fakat **izinli ekran/ebeveyn veya modal öncelik kataloğu yoktur**.

| Modal | Gerçek açılma kaynağı / anlamı | Kasıtlı ebeveyn veya geri dönüş | Kapatma temizliği / dikkat |
| --- | --- | --- | --- |
| `help-dialog` | Üst başlık `#help`; kurallar | Her gerçek ekrandan kök; “Birlikte deneyelim” gerçek T1'e girer | Normal üst modal kapatma; öğreticiye girmek tüm modalları kapatır |
| `win-dialog` | `showVictory()`; doğrulanmış `engine.status==='won'` | `game` sonuç sunumu; sonraki açılmamış bölüm, yolculuk, ana menü veya tamamlanmış kampanyada bahçe | Modalın açılması ödül işlemi değildir; kazanma daha önce atomik olarak kaydedilmiştir |
| `lose-dialog` | `showLoss()`; doğrulanmış `engine.status==='lost'` | `game` sonuç; ikinci şans panelini içerir | “Tahtaya dön” kapanabilir; `#continue` sonucu tekrar açabilir; tekrar açma can kesmez |
| `inventory-dialog` | `#open-inventory`; `inventoryPlayable()` | Yalnız oynanabilir ana bölüm; seçim başlayınca modal kapanır | Kullanım yalnız hedef ve onay sonrası komut/ekonomi sınırında gerçekleşir |
| `assistance-dialog` | `chooseAssistanceTarget()`; gerçek önizleme | Envanterden çıkılmış hedef seçimi sonrası kök `game` modalı | `pendingAssistance` temizlenir; kapatmak envanter/Altın harcamaz |
| `rescue-provider-dialog` | `beginRescueAd()` / bekleyen doğrulanmış makbuzun yeniden sunumu | Normalde `lose-dialog` üstü; teslim bekleyen hak kurtarma girişleri ayrıca korunmalı | `cancelRescueProvider()` yarım test işlemini mevcut otoriteyle iptal eder; kazanılmış `pendingRescueReceipt` silinmez |
| `pregame-dialog` | `requestStage(index)`; bölüm önizlemesi | `home` veya `journey`; gerçek board/variant seçimini değiştirmez | `pendingStage=null`; devam/restart kararı gerçek checkpoint üzerinden tekrar değerlendirilir |
| `pause-dialog` | `pauseGame()`; `game`, modal yok, motor oynuyor | `game`; altında kalıp Ayarlar ve yeniden başlatma onayını barındırır | Kapanınca `paused=false`, ses yeniden eşitlenir; açık alt `pause` kapanmadan Settings'i kapatmak oyunu sürdürmez |
| `settings-dialog` | `openSettings()`; üst başlık, alt gezinme, oyun menüsü, pause | Her gerçek ekrandan kök; `pause-dialog` üstü kasıtlıdır | Tercihler mevcut `persist()` yoluyla yazılır; doğrudan oyundan Ayarlar açmak `paused=true` yapmaz |
| `install-dialog` | `pwa.js` → iptal edilebilir `hexrota:open-dialog` | **`settings-dialog` üstü kasıtlıdır**; uygulama dinleyicisi yoksa PWA native `showModal()` yedeği vardır | Üst modal kapanınca Settings korunur; PWA kurulum sonucu oyun ödülü değildir |
| `lives-dialog` | `openLives(request)`; kullanıcı seçimi veya yeni deneme can engeli | Menü/yolculuk ve başarısız yeni deneme/restart rotası; altında önizleme/onay bulunabilir | `pendingLifeStart` bir yeniden giriş isteğidir; ücretsiz öğretici veya başarılı hak sonrası normal `enterGame()` kullanılır |
| `life-provider-dialog` | `beginLifeProduct()` / bekleyen makbuz ve kayıt hatası | Normalde `lives-dialog` üstü; **Settings üzerinden TEST Altını** ve kurtarılan bekleyen teslim için kök açılma da gerçektir | Kapatma `cancelLifeProvider()`; kazanılmış `pendingLifeReceipt` tutulur; başarılı teslimden sonra `resumeLifeRequest()` çalışabilir |
| `restart-dialog` | `restart()`; oynanmış/bozuk kampanya kaydını değiştirme onayı | `pause-dialog` veya `pregame-dialog` üstü, ayrıca doğrudan oyun R/yeniden düğmesi | `pendingRestart=null`; iptal can kesmez; onay anında maliyet tekrar doğrulanır |
| `reset-dialog` | `#settings-reset`; açık denemeleri silme onayı | `settings-dialog` üstü; Settings altında pause bulunabilir | Kapatmak sadece iptal; onay tamamlanmış kampanyayı, ödül kayıtlarını ve envanteri korur |
| `full-reset-dialog` | `#settings-full-reset`; açık geliştirme testi onayı | `settings-dialog` üstü; Settings altında pause bulunabilir | Başarılı atomik resetten sonra `fullResetPending` eski işlemleri durdurur; temizleme hatasında tek “Yeni oyunu aç” yolu; native `cancel` engellenir |

Nesting için doğrudan korunan örnekler: `pause → settings → reset`, `pause → settings → full-reset`, `pause → restart`, `pregame → restart`, `settings → install`, `lives → life-provider`, `settings → life-provider`, `lose → rescue-provider`. Bunları tek modal sınırına indirgemek bir regresyondur. Yerel native `showModal()` ile bütün çerçeveleri açan `check-comic-ui-browser.cjs` yalnız geometri testidir; üretim komutlarının izin politikasını tanımlamaz.

### Modal geçiş matrisi

| Başlangıç | Olay | Mevcut koruma | Sonraki durum | Yan etki | Yasak etki | Test referansı |
| --- | --- | --- | --- | --- | --- | --- |
| `game`, oynanıyor, modal yok | `#pause` / `Escape` / blur / gizlenme | `screen==='game' && !paused && !topDialog()` | `pause-dialog`, `paused=true` | Commit edilmiş görseli bitir; ipucunu durdur; kaydet; sesi pasifleştir | Hamle/can kesmek | `check-menu.cjs` “pause blocks…”, “backgrounding…” |
| `game`, terminal motor, modal yok | Pause isteği | Oynanıyor korumasından sonra `engine.status!=='playing'` | Doğru `win`/`lose` modalı | Yalnız sonucu sun | Pause'a takılı bırakmak; terminal sonucu değiştirmek | `check-menu.cjs`, `check-lives-ui.cjs` |
| `pause` | `#pause-settings` | Mevcut `openSettings` çağrısı | `pause → settings`; ekran `game` | Tercih alanlarını mevcut veriden doldur | Board'u yeniden kurmak | `check-menu.cjs` “pause blocks…” |
| `pause → settings` | `#settings-reset` veya `#settings-full-reset` | Onay modalını açmak gerçek reset değildir | Üç katmanlı stack | Açık deneme maliyetini/uyarıyı sun | Henüz silmek veya ücret kesmek | `check-menu.cjs` “nested Escape…”; `check-welcome-reset-ui.cjs` |
| `settings` | `#install-app` → özel olay | Uygulama yalnız `detail.id==='install-dialog'` kabul eder | `settings → install` | PWA fallback yönergesini göster | Settings'i kapatmak; motoru yeniden yüklemek | `check-pwa.cjs` “actual app keeps Settings…” |
| Yığın dolu | `[data-close]`, Escape, dış backdrop, browser Back | Üst modal seçimi; `sessionAction` tam reset kilidini korur | Yalnız ilgili üst modal kapanır; ekran korunur | Native close/focus davranışı; yığından ID çıkar; özel pending alanını temizle | Onayı kendiliğinden çalıştırmak; kalan alt modalları yok etmek | `check-menu.cjs`, `check-pwa.cjs` |
| `pause → settings` | Settings kapanışı | Pause hâlâ açık | `pause`, `paused=true` | Derlenen görünüm/sahne güncellemesi | Tahtayı oynanabilir yapmak | `check-menu.cjs` |
| `pause` | `#pause-continue` / pause close | Can/tahta kararı gerekmez; aynı deneme | `game`, `paused=false` | Ses açma girişimi, gösterim ve sahne yenileme | Yeni deneme veya yeni varyant | `check-menu.cjs`; `check-scene-browser.cjs` rotation/pause grubu |
| Geçerli önizleme | `#pregame-start` | `pendingStage` mevcut; checkpoint ve can tekrar değerlendirilir | `game` veya mevcut korumaya ait modal | `enterGame()` ya devam eder ya doğrulanmış yeni deneme açar | Önizlemeyi kaydın yerine geçirmek | `check-menu.cjs`; `check-attempt-ui.cjs` |
| Önizleme/restart isteği, sıfır can | Başlat/yeniden başlat | `LifeManager.canStart`; oynanmış mevcut deneme için açık onay | `lives-dialog`; önceki güvenli kayıt korunur | Maliyet/alınabilecek hakları sun; gerekiyorsa mevcut denemeyi tek kez sonuçlandır | Varyant RNG/Attempt seri sayacını erken artırmak | `check-lives-ui.cjs` zero/last-life/reset grupları |
| `lives` veya Settings TEST ürünü | Kullanıcının ürün isteği | Tek pending işlem; uygunluk ve TEST Altını; mevcut Life provider | `life-provider-dialog` | Sağlayıcı isteği otorite üzerinden kaydedilir | İstek anında can/Altın ödülü vermek | `check-lives-ui.cjs` fake purchases, ad cancellation |
| Sağlayıcı açık | Tamamla / iptal | Doğrulanmış tekil makbuz; pending işlem kimliği | Başarıda sağlayıcı kapanır; istek varsa normal bölüm girişine dönülür | Hak, can ve TEST cüzdanı mevcut atomik kayda girer | Çift callback'te ikinci hak/ücret; başarısız kayıt sonrası kısmi değişim | `check-lives-ui.cjs`; `check-session-browser.cjs` |
| `lose` | +5 Altın veya TEST reklamı | Kayıp aynı deneme; ödeme/hak uygunluğu mevcut rescue otoritesinde | Reklamda `lose → rescue-provider`; Gold başarıda aynı oyun | Aynı ID/RNG/tahta ile bir `grant_moves` komutu ve atomik ekonomi | 10 hamle vermek; ikinci can kesmek; ücret yazılıp hamleyi kaybetmek | `check-second-chance-ui.cjs`, `check-economy-browser.cjs` |
| Doğrulanmış makbuz, kayıt başarısız | Teslimi yeniden dene | Mevcut `pendingLifeReceipt` / `pendingRescueReceipt` | Sağlayıcı/safe UI; yalnız başarıda kapanış | Aynı hak ve işlemle yeniden atomik teslim | Yeni reklam üretmek; yanlış denemeye uygulamak; bekleyen kanıtı kaybetmek | `check-second-chance-ui.cjs` failed delivery; `check-life-consistency.cjs` |
| Herhangi modal stack | Başarılı `enterGame` / ekran geçişi | Gerçek komut korumaları önce çalışır | Ekran ve ilgili aktif deneme; tüm modallar kapanır | `closeAllDialogs()`; görseller ve async işler temizlenir | Geçiş başarısızken kaydı/ödülü silmek | `check-menu.cjs`; `check-second-chance-ui.cjs` |
| Tam reset onayı | `#full-reset-confirm` | İlk çağrı; `SessionStore.resetForTesting()` başarı sınırı | Başarıda `fullResetPending`, sonra reload | Eski callback'ler kilitlenir, kaynaklar kapanır | Başarısız yazımı başarılı göstermesi; eski profilin geri dirilmesi | `check-welcome-reset-ui.cjs` son üç grup |
| `fullResetPending` | Click/keydown/popstate/lifecycle | `on()` → `sessionAction()` başta döner; native `cancel` de önlenir | Kilitli yeniden açılma görünümü | Yalnız tanımlı reload kurtarma düğmesi | Reset öncesi ekonomi/board'un tekrar yazılması | `check-welcome-reset-ui.cjs` stale lifecycle grubu |

## Oyun/sunum ve modalın kesiştiği geçişler

| Başlangıç | Olay | Koruma | Sonraki durum | İzinli etki | Yasak etki | Test referansı |
| --- | --- | --- | --- | --- | --- | --- |
| `game`, aynı T1/T2 board'u | Öğretici koçu / Tavik portresinin güncellenmesi | Gerçek öğretici ve motor/sunum görünümü | Ekran ve aynı engine değişmez; portre konuşur/işaret eder | Aynı kartın metni ve portresi; tam-vücut aktörünün bastırılması | Board'u kurmak, küçültmek, puan/Altın/hamle yazmak | `check-tavik-dialogue.cjs`, `check-scene-browser.cjs` 38 grup |
| Öğretici onay bekliyor | `#coach-next` | `gameInputAllowed()` ve gerçek `guideFeedback()` | Aynı tur; bir sonraki yönerge/işaret | Mevcut `guideAcks` sunum tercihi kaydı; seçimin temizlenmesi | Takası yeniden çalıştırmak; RNG/puan/can/ödül | `check-first-play.cjs`, `check-onboarding.cjs`, `check-first-play-browser.cjs` |
| Oynanabilir oyun | Geçerli gerçek takas | Mevcut motor ve rehber çifti; giriş kilitleri | Önce atomik domain commit, sonra `busy/presentation` | Gerçek motor sonucu/ekonomi/can mevcut komut sınırında; ardından görsel | Animasyon callback'inde ikinci takas veya ödül | `check-input.cjs`, `check-swap-lifecycle.cjs`, `check-score.cjs` |
| Oynanabilir oyun | Geçersiz takas veya yanlış öğretici çifti | Motor/geçerli komşuluk; öğretici yönlendirmesi | Oynanabilir aynı oyun; isteğe bağlı invalid görsel | Seçimi/ipuçlarını ve görseli güncelle | Turn/RNG/puan/zemin değişimi | `check-input.cjs`, `check-mobile-browser.cjs`, `check-first-play.cjs` |
| `RESOLVING` | Yeni dokunma / modal / resize / gezinme | Etkin job kimliği/epoch/AbortController | Önce mevcut commit'in görünümü; ikinci hamle yok | `finishPresentation()` veya cancellation; geçici SVG katman temizliği | Eski board çizmek; kaydı değiştirmek; kalıcı busy | `check-input.cjs`, `check-swap-lifecycle.cjs`, `check-swap-visual.cjs` |
| `RESOLVING`, commit tamam | Animasyon hatası / watchdog / finally | Job kimliği ve token | Gerçek motor durumuna dönülür; sonucu uygun ekranda sunabilir | Görselin güvenli tamamlanması | Başarılı domain commit'i geri almak; hamleyi tekrar uygulamak | `check-input.cjs`, `check-reward-ui.cjs` |
| `game`, hamle sonucu terminal | 80 ms sonuç zamanlayıcısı | Aynı epoch, ekran game, görünür, pause değil, başka modal yok | `win-dialog` veya `lose-dialog` | Yalnız terminal sunum | Home üstüne geç sonuç açmak; tekrar ödül | `check-menu.cjs` “leaving during effects…” |
| `game` | blur / `visibilitychange(hidden)` | Mevcut `pauseGame()` modal korumaları | Oynayan ve modalsızsa pause; başka modal varsa o korunur | Efekt bitirme; gesture ve yardım hedefini bırakma; ses/karakter durdurma | İkinci tur, ikinci ödül, otomatik reklam | `check-menu.cjs` backgrounding; `check-scene-browser.cjs` |
| Gizli sayfa, pause mevcut | Görünür olma / focus | Mevcut modal kapatılmaz | Pause açık kalır | Can zamanı/hakları mevcut servislerden yenilenir; sahne görünümü güncellenir | Kendiliğinden oyuna devam | `check-menu.cjs`, `check-lives-ui.cjs` offline refresh |
| Her görünüm | `pagehide` | Mevcut session/lifecycle korumaları | Görseller yok edilir; engine gerekirse mevcut yoldan kaydolur | Tavik/ilk gösterim/scene/gesture temizliği | Eski async görüntünün dönmesi; yeni hak yazımı | `check-scene-presentation.cjs`, `check-scene-browser.cjs` late images |
| BFCache benzeri geri dönüş | `pageshow.persisted` | SessionStore mevcut lock yeniden edinme politikası | Reload → `home` → kayıt devamı | Aynı attempt/board otoriteden yüklenir | İkinci session sahibi veya ayrı BFCache kayıt yolu | `check-scene-browser.cjs` persisted pageshow; `check-session-browser.cjs` |

Koç görünürlüğü bir modal değildir. Mevcut `gameInputAllowed()` tek başına `busy` veya `guideFeedback` kontrol etmez; bunlar `performSwap`/`select` ve diğer çağıranların daha dar korumalarıdır. Yeniden düzenleme bu farklı korumaları yanlışlıkla kaldırmamalı: busy sırasında dokunma mevcut sunumu bitirebilir, fakat yeni takas çalıştıramaz. Native modal açıkken ise board etkileşimi tamamen engellenir.

## Geçmiş, odak ve kapatma sahipliği

- Geçmiş ekranlara aittir; modal açılışı şu anda kendi `pushState` kaydını oluşturmaz. Browser Back açık modalı kapattığında ekranın kaydını tekrar ekler. Bu, modal durumunu hash'e serileştirmekten farklıdır.
- `topDialog()` stack'i sondan tarar; stack dışında native açılan `dialog[open]` için DOM sırasına dayalı yedeği vardır. `closeAllDialogs()` stack yerine açık DOM listesini ters sırayla kapatır; bu ayrım refaktör sırasında açıkça ele alınmalıdır.
- `close` dinleyicileri stack ID'sini çıkarır; pause, önizleme, restart ve yardım onayının özel pending temizliğini yapar. Provider close dinleyicileri ek olarak mevcut iptal/kanıt kurallarını uygular.
- Odak `showModal()` / `close()` native tarayıcı davranışına bırakılmıştır. Yalnız `#pregame-start` açık `autofocus` taşır. `app.js` modal girişinde/çıkışında ayrı bir odak snapshot'ı veya restore politikası tutmaz. `check-menu.cjs` JSDOM dialog shim'i odak doğrulaması yapmaz; gerçek tarayıcı yeni state testleri bunu ayrıca doğrulamalıdır.
- Tahta kendi klavye odağını `focusIndex`, SVG `tabindex`, `renderBoard()` sonrası eski `data-index` odağını geri yükleme ile yönetir. Modal koordinatörü bu board kimliğini veya elementleri yeniden kurmamalıdır.
- `[data-close]`, backdrop, custom Escape ve native `cancel` farklı kaynaklardır; aynı koordinasyon/guard yoluna bağlanırken tekrarlı kapanış güvenli olmalıdır. Full-reset sonrası kilit mevcut session wrapper'ı ve native `cancel` korumasıyla zaten korunur; bu denetimde bir bypass bulunduğu iddia edilmez.

## Bulguların önceliği

| Kimlik | Şiddet | Somut bulgu | Mevcut güvenlik / sınır | Aşamalı çözüm hedefi |
| --- | --- | --- | --- | --- |
| N1 | Medium | `showScreen` bilinmeyen adı home'a çevirip `persist`, modal/iş temizliği ve history üretebilir | Doğrudan oyun ödülü üretmez; geçersiz nav güvenli no-op değildir | İsim/payload guard'ını ilk yan etkiden önce çalıştır; hatalı istekte mevcut snapshot değişmesin |
| N2 | Medium | `openModal` ID/ekran/ebeveyn kataloğu yoktur; programatik yanlış kombinasyonlar temsil edilebilir | Normal native modal inertliği gerçek arka plan tıklamasını engeller; domain komutları ayrıca korumalıdır | Gerçek mevcut nesting'i whitelist ile kaydet; uygunsuz kombinasyonları native açılmadan reddet |
| N3 | Medium | Screen, `paused`, `modalStack` ve native `dialog.open` ayrı mutable görünümlerdir | `topDialog` DOM fallback ve native close temizliği tutarsızlığın etkisini sınırlar | Modal state sahibi + kontrollü DOM adaptörü; native close'u yalnız kimliği eşleşen görünüm için onayla |
| N4 | Low | `closeAllDialogs` ters DOM sırası, `topDialog` stack sırası kullanır; açık odak restore politikası yok | Native dialog focus davranışı; çoğu test yalnız görünürlüğü doğrular | Üstten alta kapanış ve canlı, hâlâ geçerli opener odağı; gerçek browser testi |
| N5 | Low | Ekran/modalların birçok çağırıcısı cancellation ve render zincirlerine bağımlıdır | `epoch`, AbortController, watchdog, `sessionAction` ve mevcut transaction otoriteleri güçlü savunma sağlar | Kuralları reducer/selectors'a ayır; iptal ve render effect'lerini otorite sahiplerini taşımadan bağla |
| N6 | Low | `paused` ile “her modal açıksa oyun durmuş” aynı kavram değildir | Direct Settings ile pause→Settings farklı ses davranışı taşır; board topDialog ile her iki durumda bloke | Pause bölgesini/selector'ünü intentional nesting'e göre türet; tüm modalları motor pause'a dönüştürme |

Bu navigasyon denetimi **doğrulanmış Critical ekonomik/kayıt bozulması veya High çift hamle hatası bulmadı**. Async, ekonomi veya kayıt denetiminin ayrı bulguları olabilir. Olası native-close yarışları, bunları gösteren test olmadan gerçek üretim hatası diye sunulmaz.

## Migrasyon sırasında asgari sözleşme

Bu maddeler Stage A önerisidir; uygulanmış API diye değerlendirilmez:

1. Gerçek beş ekranı tanıyan, geçersiz payload'ı yan etkisiz reddeden navigation transition.
2. 15 modal ID'si, izinli kök/ebeveynler, tekil stack üyeliği ve üst modal seçiminden oluşan bağımsız modal bölgesi.
3. Aynı modalın tekrar açılması/kapanması için idempotent sonuç; kapatılmış eski DOM olayının yeni açılışı kapatmaması için kimlik/nesil.
4. DOM/history/focus effect'leri saf transition kuralından ayrı; etkilerin başarısızlığında güvenli state/DOM geri dönüşü.
5. `canInteractWithBoard(state, domainView)` yalnız geçici nav/modal/lifecycle ile motor/deneme/kayıt sahibinden gelen doğrulanmış görünümü okur. Ekonomi, can, RNG, board ve seri sayacı state core'a kopyalanmaz.
6. Provider teslim kimlikleri, commit/revision ve makbuz doğrulaması mevcut sahiplerde kalır. Modal açılmasını bir ekonomik işlem veya başarı kanıtı sayan event üretilmez.

Son uygulamanın event adları, guard'ları ve test referansları bu dosyada audit tabanından ayrı bir sonuç bölümüyle eşleştirilmelidir; audit'te mevcut olmayan durumlar sonradan mevcutmuş gibi yazılmamalıdır.
