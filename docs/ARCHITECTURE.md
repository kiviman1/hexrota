# Hexrota — kod sahipliği ve bakım rehberi

Bu belge mevcut oyun, geçici uygulama durumu ve Tavik sahne sunumunun modül sınırlarını açıklar. Oyun kuralları için ilgili sürümlü ürün sözleşmeleri geçerlidir; burada yeni güçlendirici, fiyat veya denge kuralı tanımlanmaz.

## Veri akışı

```text
index.html (sıralı defer bağımlılıkları)
  └─ session-store.boot: tek-yazıcı kilidi + kanonik profil
      └─ app.js: oturum/iş komutları ve atomik commit orkestrasyonu
          ├─ özel appState örneği (kalıcı profile yazılmaz)
          │   ├─ app-state: saf navigation / overlays / lifecycle / operation geçişleri
          │   ├─ state-selectors: otoriteden gelen görünüm → evre / giriş / tek aktör modu
          │   └─ state-effects: kabul edilmiş modal etkileri / native DOM / odak / geçmiş
          ├─ game-save: salt-okuma bootstrap ve eski kayıt normalizasyonu
          ├─ attempts + engine/commands: deneme ve deterministik oyun
          ├─ economy + lives + rescue: saf iş kuralları
          ├─ atomik profil commit'i
          ├─ move-presentation: çözülmüş, salt-okuma dalgaların görsel sırası
          ├─ board-view / board-input / score-presentation / garden / audio
          └─ syncScene: tek salt-okuma projectPresentation sonucu
              ├─ scene-presentation: kesinleşmiş öğretici ilerlemesi ve dünya aktörü
              └─ tavik-dialogue: aynı mevcut koç kartındaki portre
```

Görsel olaylar oyun kuralı değildir. Hamlenin kanonik sonucu önce kesinleşir; animasyon arızası, iptal veya arka plana geçiş ikinci bir hamle/ödül oluşturamaz. Analitik kayıt hatası kanonik oyunu geri almamalı; başarısız kanonik hamle de analitiğe başarı diye yazılmamalıdır.

## JavaScript sahiplik tablosu

| Dosya | Sorumluluk | Yapmaması gereken |
| --- | --- | --- |
| `dist/app.js` | Özel UI store örneği, gerçek oturum komutları, domain-view sınırı, mevcut atomik commit ve özelliklerin bağlanması | UI olayını ekonomik kanıt saymak; ikinci bir kayıt veya motor oluşturmak |
| `dist/app-state.js` | DOM'suz saf geçişler, ekran/modal katalogları, modal açılış kimlikleri, lifecycle ve görsel iş token'ları; immutable snapshot/abonelik kuyruğu | Profil, board, RNG, cüzdan veya makbuz saklamak; render/kayıt yan etkisi çalıştırmak |
| `dist/state-selectors.js` | Anlık domain-view girdilerinden evre/giriş uygunluğu, kesinleşmiş öğretici ilerlemesi ve tek Tavik sunum projeksiyonu | Domain verisini tutmak veya değiştirmek; yıldızdan ikinci kümes ilerlemesi çıkarmak |
| `dist/state-effects.js` | Kabul edilmiş modal etkilerini native dialog'lara uygulamak; açılış kimliğine bağlı kapanış, odak, üstten kapatma ve kabul edilmiş ekranın DOM/history görünümü | İşlem/makbuz doğrulamak; engine yüklemek; profile veya localStorage'a erişmek |
| `dist/game-save.js` | Kayıt varlığı, v5 normalizasyonu, eski v4/v3/v2 indeks geçişi | Profil yazmak, bozuk kaydı yeni oyuncu saymak |
| `dist/session-store.js` | Profil zarfı, revision, tek başarılı kanonik yazım, uyumluluk aynaları, tarayıcı kilidi | Ödül/hamle üretmek veya hatada kaydı silmek |
| `dist/board-view.js` | Saf geometri/SVG/yol projeksiyonları; ayrıca enjekte edilen SVG üzerinde kaynak→hedef taş kimliğini koruyan `reconcile` adaptörü | Motor, cüzdan, saat veya RNG'ye erişmek; eşleşme/düşüş hesaplamak |
| `dist/move-presentation.js` | Kopyalanıp dondurulmuş motor dalgalarından görsel plan, sıralama ve iptal; yalnız görsel sonuç döndürür | DOM, profil, state store, engine, ekonomi veya kayıt servisi tutmak |
| `dist/board-input.js` | Yerel koordinatla hücre ve altı yönlü kaydırma sınıflaması | Takas yapmak veya taş sonucunu tahmin etmek |
| `dist/first-play.js` | Kısa öğretici sunumu ve durumsuz, yavaş SVG kaydırma gösterimi | Gerçek takas, kayıt, can veya ödül üretmek |
| `dist/scene-presentation.js` | Projeksiyondan üç öğretici sahnesi, saf Tahta/Çivi sayaç biçimi, dekoratif Tavik, yerleşim ve yaşam döngüsü | Motor/kayıt/cüzdan sahibi olmak, kampanya yıldızı okumak veya ödül kanıtı üretmek |
| `dist/tavik-dialogue.js` | Projeksiyondaki portre görünürlüğünden koç içindeki konuşma/işaret/kutlama klibini, yerel zamanlayıcı ve cleanup'ı yönetmek | Kendi kampanya/öğretici ilerlemesini çıkarmak; board'u veya ödülü değiştirmek |
| `data/scene-config-v1.json` → `dist/scene-config.json` / `.js` | Sunum şeması v2: öğretici aşamaları, sayaç tanımları, yerel yollar ve sunum ayarları | İkinci kalıcı ilerleme sayacı veya yeni kayıt sürümü tanımlamak |
| `dist/score-presentation.js` | Enjekte edilen görünüm bağımlılıklarıyla puan animasyonunun yaşam döngüsü | Kalıcı skor, Altın, hamle veya RNG değiştirmek |
| `dist/engine.js` | `classic-v4` takas/eşleşme/düşüş/üretim ve replay | Ekonomi veya DOM |
| `dist/commands.js` | `assisted-v1` yardımlı komut geçmişi; yeni istek uygunluğu ve yalnız restore için private tarihsel replay | Klasik v4 geçmişini sessizce yeniden yorumlamak |
| `dist/attempts.js` | Katalog, seçim RNG'si, sürümlü varyant/deneme kimliği | Oyun RNG'sini veya fiyatları okumak |
| `dist/economy.js` | Kalıcı tamamlama, Altın, yıldız, stok ve ödül hakları | Tekrar oynayarak yeni hak oluşturmak |
| `dist/lives.js`, `dist/rescue.js` | Can ve aynı denemede ikinci şans kuralları; kazanılmış teslim edilmemiş makbuzun mevcut provider kaydında saklanması | Doğrulanmamış callback'i ödeme/reklam kanıtı saymak |
| `dist/rewards.js`, `dist/reward-adapter.js` | Gerçek hamle verisinden sunum yoğunluğu | Skor veya kazanma olasılığını değiştirmek |
| `dist/events.js`, `dist/playtest.js` | Yerel olay ve isteğe bağlı gözlem sözleşmeleri | Otomatik kişisel veri gönderimi |
| `dist/garden.js`, `dist/audio.js` | Kalıcı yıldızlardan görünüm; kullanıcı tercihiyle ses | Yeni ödül üretmek |

`app.js` hâlâ domain orkestratörüdür: `engine`, etkin bölüm/deneme, bekleyen sağlayıcı kanıtları ve mevcut `sessionAction`/commit/rollback sınırı buradadır. Bu kaynaklar UI store'una taşınmaz. Yeni store örneği boot kapsamına özeldir; sınırsız bir global event bus veya `window` üzerinden komut kapısı yayımlanmaz. DOM img/Animation/Worker/AbortController başvuruları kendi sunum sahiplerinde kalır.

## Geçici uygulama durumunun sınırları

`app-state` dört paralel bölge tutar: `navigation`, `overlays`, `lifecycle`, `operations`. Gerçek ekranlar **home, game, journey, records, garden**; Settings mevcut modal olarak kalır. Modal katalogu 15 gerçek `<dialog>` kimliğini, ekran/ebeveyn kurallarını ve doğrulanmış provider teslimi için kontrollü kurtarma girişini tanımlar. `paused` ayrı yazılabilir bayrak değildir; pause modalının varlığından türetilir. Doğrudan oyun → Settings, pause → Settings ile aynı pause durumu değildir.

`NAVIGATE` veya `OPEN_MODAL` isteği mevcut domain-view korumalarıyla **yan etkiden önce** sınanır. Geçersiz ekran/modallar iptal, geçmiş veya kalıcı kayıt üretmeden reddedilir. Native modal etkilerinin sahibi `state-effects`tir; `CLOSE_MODAL` hem ID hem açılış `instance` değerini kullanır. Eski native close olayı yeni açılışın pending verisini temizleyemez. Kullanıcı kapanışı üst modalı hedefler; kontrollü iç kapatma gerekli ebeveyni yetim bırakamaz. `closeAll` üstten alta çalışır. Native geometri testleri veya platform yedeğinin doğrudan açtığı modal yalnız savunmacı giriş engelidir; komut korumasını aşan state-adoption yolu değildir.

DOM/focus/history adaptörü profil yazmaz. `onClose` host'un mevcut `sessionAction` bariyerinde çalışır; provider iptal/teslim kuralları kendi sahiplerinde kalır. Odak yalnız bağlı, görünür, etkin ve kalan üst modala uygun opener'a döner; gezinme eski gizli tahtada odak bırakmaz. Saf store `snapshot/preview/dispatch/subscribe/destroy` API'lerini, sıralı reentrant dispatch ve unsubscribe yaşam döngüsünü sağlar. İş token'ları `kind/id/attemptId/generation` taşır; işin eski tamamlanması yeni işi kapatamaz.

`state-selectors.gameplayPhase` READY/PLAYING/RESOLVING/WON/LOST görünümünü mevcut motor sonucundan ve görsel işten türetir. Presentation `requested` yalnız giriş rezervasyonu ve semantik PLAYING'dir; `pending` yalnız başarılı kanonik commit sonrası RESOLVING olur. `appBusy()` requested/pending kilidini türetir; ayrı mutable `busy` yoktur. WON/LOST yeni bir kazanma hesaplaması değildir. `canRouteBoardInput`, çözümleme sırasında mevcut kesinleşmiş sonucu açığa çıkarabilecek dokunuşla `canStartMove` iznini ayırır; `canUseInventory` gerçek envanter/yardım modalını ilgisiz modaldan ayırır. İş kurallarının uygunluğu mevcut domain sahiplerince hesaplanır, seçiciye anlık salt görünüm olarak verilir.

Navigasyon/modal, merkezi Tavik projeksiyonu, board/inventory selector'ları ve presentation/hint operation yaşam döngüsü bağlandı. `startPresentation` görsel owner'ı rezerve eder; başarılı atomik commit sonrasında `activatePresentation` pending'e geçirir. UI token tahsisi başarısızsa geçerli komut/ödül kaydı engellenmez; gerçek committed sonuç hızlı gösterilir. Mevcut epoch, job/engine referansları ve AbortController korumaları tutulur. Invalid-swap feedback yerel görsel iş olarak kalır.

`HexMovePresentation.plan/play` yalnız commit sonrasında çağrılır. Gerçek motor sonucu, Core operasyon durumu ve yedi görsel faz ayrıdır; her motor dalgası gösterilir. Host start/activate/finish/cancel ve terminal modal uygunluğunun sahibidir. `finishPresentation` ikinci profil yazmaz (PR #27/F-01). `HexBoardView.reconcile`, geçerli swap/fall haritasından gerçek `.gem` düğümlerini taşır, zemin/hücre/SVG katmanlarını korur; yeni taş yalnız motorun spawn verisinden alınır. Ayrıntı: `ANIMATION_PIPELINE.md`; ölçüm ve gerçek koşumlar: `ANIMATION_PIPELINE_TEST_REPORT.md`.

Pagehide committed sunumu güvenle bitirir, hint/terminal timer'ı temizler, epoch'u artırıp `APP_SUSPENDED` ile UI neslini emekli eder; sahne host'unu kaldırır. Pageshow `APP_RESUMED` ve mevcut görünürlükle yalnız sunumu yeniden kurar. Gerçek persisted dönüşte SessionStore'un reload/yazıcı kilidini tekrar alma politikası değişmez. Sonuç timer'ı ayrıca suspension guard'ı taşır; kapanmış belgeye geç win/lose diyaloğu açamaz.

Başarılı `resetForTesting` sonrasında full-reset bariyeri önce etkinleşir, sahiplenilmiş iki life/rescue recurring timer durur, StateEffects/Core/Tavik/sahne kaynakları destroy edilir. Başarısız reset eski writer/session'ı kullanılabilir bırakır. Existing provider/receipt/commit kuralları yeni store'a taşınmaz. Bu kod sözleşmesi uzak test başarısı iddiası değildir; güncel gerçek browser/CI/Preview sonuçları `STATE_REFACTOR_REPORT.md` içinde kaydedilir.

## C# sahipliği

`unity/Gameplay`, `Catalog`, `Lives`, `Hints`, `Rewards`, `RewardAdapter`, `Economy`, `Commands`, `Rescue`, `Contracts` saf çekirdektir. UnityEngine, DOM, ağ ve dosya API'leri bu dizinlere girmez.

`unity/Application/GameSessionController.cs` başlangıç, ana akış ve **tek `Execute` işlem sınırını** tutar. `GameSessionController.Assistance.cs` envanter/yardım komutlarını, `GameSessionController.Rescue.cs` ikinci şans işlemlerini içerir. Bunlar aynı partial sınıfın parçalarıdır; bağımsız veritabanı veya ikinci oturum sahibi değildir. Bölme, metot gövdelerini veya sıralamayı değiştirmez. Yeni özellikler farklı bir kalıcı commit yolu açmamalıdır.

`ProfileRepository` kalıcı adaptör sözleşmesidir. `MemoryProfileStorage` test adaptörüdür; gerçek iOS dosya sistemi / IL2CPP doğrulaması yerine geçmez. `*ParityHarness` ve `ParitySupport` yalnız test host'larıdır.

## Kayıt kuralları

- `hexrota-profile-v2` tek yetkili zarf; `game + energy` aynı revision altında yazılır.
- `classic-v4` motor kuralları, Snapshot v4, `assisted-v1` komut sözleşmesi, Attempt metadata v1 ve LifeState v2 korunur; geçici UI snapshot bu sözleşmelerin yerine geçmez.
- Mevcut `hexrota-match-v5` ve `hexrota-lives-v1` aynaları başarılı kanonik yazımdan sonra tamir edilebilir. Ayna hatası başarıyı geri almamalıdır.
- Anahtarın bulunmamasıyla mevcut `null`/bozuk JSON aynı değildir. Yeni/legacy ilerleme bozuksa eski içeriği koru, güvenli hata ver.
- Revision güvenli JSON tamsayısıdır. Sınırda yazma reddedilir; taşırıp bir sonraki açılışı bozma.
- Aynı denemenin can, güçlendirici ve ödül kayıtları iki kez uygulanmaz; DOM düğmesinin gizlenmesi tek güvenlik sınırı değildir.
- Hata yutma sadece belgelenmiş isteğe bağlı sunum/ayna/analitik yollarında olabilir. Yetkili profil okumasında sessiz varsayılan oluşturma yoktur.

## CSS ve çevrimdışı paket

`src/styles/manifest.json` kaynak bölümlerinin sırasını belirler. `npm run styles:sync`, bunları **aynı sırada tek `dist/style.css`** dosyasına birleştirir. Tarayıcıda `@import` zinciri veya ek CSS isteği yoktur. Mevcut çizgi roman temasından sonra hazır `dist/assets/scenes/coop-v1/tavik-motion.css`, `src/styles/07-coop-scene.css` ve son olarak `src/styles/08-tavik-dialogue.css` gelir. Hazır hareket CSS'i varlık hash sözleşmesinin parçasıdır; değiştirilmez. Yeni sahne yerleşimi `07-coop-scene.css`, koç içi portre yerleşimi `08-tavik-dialogue.css` içinde düzenlenir; üretilmiş çıktı da commit edilir.

`dist/index.html` bağımlılıkları `defer` sırasıyla yükler. Yeni runtime betiği eklenince `dist/sw.js` allowlist/önbellek listesi, HTML, Worker query ve `qa-fixtures.cjs` birlikte güncellenir. Güncel uygulama **PWA v44** kullanır; `app-state.js`, `state-selectors.js`, `state-effects.js`, `move-presentation.js` de app boot öncesi yüklenip aynı çevrimdışı kabuğa alınır. Bu yalnız runtime/CSS önbellek kuşağıdır; kayıt formatının veya oyun kurallarının sürümünü değiştirmez. Hareket adaptörü, yapılandırma ve sahne modülü çevrimdışı kabuğa dahildir. Üç yeni JPEG ihtiyaçla yüklenir; ilk çevrimdışı fallback için `foundation.jpg` ve mevcut `idle.webp` ayrıca ısıtılır: toplam 276.693 byte. Hazır eski varlıklar korunur; yeni akış eski yatay arka planları istemez. Kaynak PNG'ler ve bağımsız prova sayfası bu kapsamda değildir. JPEG/WebP içerik türü doğrulanır; görsel hatası oyunu veya kayıtları engellemez.

## Tavik sahnesinin sunum sözleşmesi

`node sync-scene-config.cjs`, adı korunan `data/scene-config-v1.json` dosyasının **sunum şeması v2** içeriğini doğrulayıp tarayıcı için `dist/scene-config.json` ve `dist/scene-config.js` üretir; `--check` eski çıktıyı reddeder. `scene-config.js` yalnız `HEX_SCENE_CONFIG` görünüm verisini yayımlar. Üç aşama ve iki öğretici sayacı bu JSON'dan okunur. `backgroundBase` yeni portre JPEG'lerini, `assetBase` değiştirilmemiş Tavik pozlarını gösterir. Geçersiz yapılandırma, sayaç/ilerleme girdisi veya izin verilmeyen yol reddedilir. Bu sürüm profil/snapshot sürümü değildir. Gelecekteki hikâye için `futureStory: {enabled:false,hooks:[]}` veri uzantısı vardır; kaçırılma/kurtarma sistemi uygulanmış değildir.

`HexScenePresentation.create({document,window,config,board,homeHost,gameHost,onError})` bir DOM sunum adaptörüdür. Dışarıya `update(view)`, `react({key,kind})`, `snapshot()` ve `destroy()` verir. `view`, **kesinleşmiş `completedTutorialCount` (0–2)** ve **`tutorialTurn`**, ekran, ilk açılış, deneme/tur kimliği, sonuç, öğretici çifti ve duraklama/görünürlük/hareket tercihini taşır. Modül motor, profil, can, ekonomi, RNG veya kampanya yıldızına erişmez. Eski yıldız API'si kaldırılmıştır; `stageForTutorials(config,count)` yalnız bu sayıyı kullanır.

`app.js` içindeki `syncScene`, `HexStateSelectors.projectPresentation` sonucunu her iki Tavik renderer'ına birlikte verir. Tek aktör modu `PORTRAIT / WORLD / NONE` burada seçilir; guided tutorial boyunca portre yuvası ayrılır ve küçük tam-vücut aktörü görünmez. Terminal veya gizli koç portreyi geçici kapattığında bu, aynı anda küçük aktörü geri çağırmaz. `scene-presentation` ve `tavik-dialogue` bu kararın görsel/yerleşim uygulayıcılarıdır.

Host, projeksiyonu başarılı atomik commit'in kanonik oyun verisinden yeniler; geri almada son geçerli profile döner. `tutorialTurn`, yalnız kaydedilmiş öğretici checkpoint'inin Attempt ID'si etkin denemeyle aynıysa kullanılır. `tutorialCounter(config,levelId,turn)` salt hesapla `Tahta min(turn,3)/3` veya `Çivi min(turn,4)/4` döndürür; ana bölümün sayısal kimliğinde `null` verir. Host bunu mevcut öğretici kartında `.tutorial-build-counter` ile gösterir. Sayaç envanter, toplanabilir motor hedefi veya yeni bir kalıcı alan değildir; yanlış takas, gösterim ve başarısız kayıt sayacı artırmaz.

| Kesinleşmiş öğretici ilerlemesi | Sahne |
| --- | --- |
| 0 — T1 öncesi / T1 sürerken | `foundation` |
| 1 — T1 sonrası / T2 sürerken | `frame` |
| 2 — T2 sonrası / kampanya | `finished` |

Sahne için ayrı kayıt tutulmaz. Eksik öğretici bayrakları olan geçerli eski kayıtta, T2'ye ulaşılmış olması en az bir tamamlanmış öğretici; kampanyaya ulaşılmış olması iki tamamlanmış öğretici olarak **yalnız sunumda** yorumlanır. Bu çıkarım `done`, Altın veya ödül hakkı yazmaz. Öğretici tekrarı tamamlanmış kümesi temele döndürmez; kampanya yıldızları kümesi büyütmez. Mevcut Atla akışı iki öğreticiyi tamamlanmış işaretlediğinde üçüncü sahne gösterilir; Atla hoş geldin ödülü üretmez. **İlk gerçek T2 kazanımındaki tekil +20 Altın**, ön plandaki Altın/sandık ve dönen ışık sunumuyla birlikte korunur. İnşa tepkisi yalnız kesinleşmiş öğretici ilerlemesi artarsa çalışır; görsel hareket veya decode hiçbir ödül yazmaz.

Üç teslim JPEG'i 720×1280 boyutunda ve toplam 794.105 byte'tır; yön değişiminde aynı dosyalar kırpılarak kullanılır. Arka planlar hizalı yapı katmanları değildir. Yüklenen aşama, tahta altında kısa karartmayla değiştirilir: yapılandırma beklemesi 140 ms, CSS opaklık geçişi 120 ms'dir. Azaltılmış harekette geçiş anlıktır. Önce etkin arka plan ve idle, sonraki pozlar/aşamalar ihtiyaçla yüklenir. Geciken decode ve poz yanıtları yaşam döngüsü/istek nesilleriyle elenir. Hata durumunda önbellekteki foundation, statik renk veya onaylı mevcut Tavik portresi kullanılır; oyun tahtası kullanılabilir kalır. Eski paketin 39 dosyası ve 12 hareketi byte olarak korunur.

PR #24'te doğrulanan **118 px tek koç kartı**, portre → metin → eylem sütunları ve aynı boyuttaki gerçek tahta korunur. Tek dünya katmanı ana menüden gerçek T1 tahtasına geçerken korunur; T1/T2'de Tavik koç içindeki portredir, tam-vücut figür yalnız normal dünya modundadır; örnek prova tahtası kullanılmaz. Dekoratif katmanlarda `pointer-events:none` bulunur. Normal oyunda 80–110 px Tavik için gerçek SVG hücrelerinin, HUD'un ve öğretici kartının sınırlayıcı kutuları kontrol edilir; hareket için yukarıda 24 px, yanlarda 10 px ek pay ayrılır. Portre kullanılamayan dünya modunun dar yerleşim yedeğinde mevcut Menü/Mola boşluğuna 44–48 px statik figür sığdırılabilir; etkin öğretici portresiyle birlikte gösterilmez. Güvenli alan yoksa karakter gizlenir; tahta veya dokunma alanı küçültülmez. İşaret etme yönü gerçek öğretici çiftine göre yalnız dış kapsayıcıda çevrilir.

Gizli sekme, mola ve açık diyalog hareketi durdurur, geçici tepkileri/kararmayı temizler. Ana menü/oyun dışındaki ekranlar sahne düğümlerini ve dinleyicilerini kaldırır; aynı modül daha sonra yeni bir görünüm kurabilir. `destroy()` nihai ve tekrarlanabilir temizlemedir; `pagehide` ve tam test sıfırlamasında çağrılır. `pagehide` host başvurusunu da boşaltır; sahne host'u normal `pageshow` sırasında mevcut görünümden yeni bir modül kurabilir. **Mevcut kayıt deposunun BFCache politikası değişmemiştir:** `pageshow.persisted` sayfayı yeniden yükler ve tek-yazıcı sahipliği yeniden alınır. Sahneye özel geri dönüş kancası yeni bir BFCache kayıt/oturum akışı değildir. Gizli sekme güncellemesi kendiliğinden modül diriltmez. Hiçbir eski async yanıt temizlenen sahneye yazamaz. Fiziksel cihaz ve Unity/IL2CPP doğrulaması ayrı platform işidir.

## Geliştirme kontrol listesi

1. Güncel `main`den ayrı branch; kullanıcı onayı olmadan merge/Production değişikliği yok.
2. Yeni davranışı önce testle tarif et; düzeltmede önce eski davranışın hatasını yeniden üret.
3. Saf kural değişirse gerçek derlenmiş JS/C# karşılaştırması; sunum değişirse gerçek Chromium/WebKit görüntü ve dokunma testleri.
4. `npm test` mevcut bütün zinciri, `test:maintenance` ve yeni `test:state` kontrollerini çalıştırır. `test:state-browser` gerçek native modal/geçiş/offline akışını Chromium/WebKit üzerinde dener. Mevcut 15 Actions işi korunur; iki state-browser matris işi eklenir. Workflow tanımı koşum başarısı değildir; sonucu son commit'te doğrula. Hiçbir eski test kaldırılmaz; eşiği hatayı gizlemek için gevşetme.
5. `npm run test:maintenance`: CSS üretim tutarlılığı, hafif bağımlılık/syntax korumaları, kayıt sınırı ve dondurulmuş sunum testleri.
6. Görünür ekran davranışı için fiziksel iPhone kontrolü ayrıca gerekir. Otomatik WebKit sonucu iPhone testi diye yazılmaz.
7. Değişikliğin nedeni, modülü, sözleşme etkisi ve kanıtı bakım raporuna/PR açıklamasına yazılır.

## Referanslar

- `STATE_ARCHITECTURE.md`, `STATE_TRANSITION_MATRIX.md`, `STATE_MIGRATION_PLAN.md`, `STATE_REFACTOR_REPORT.md`: geçici durum sahipliği, geçişler ve gerçek migrasyon kanıtları.
- `CODEBASE_AUDIT_9_5.md`: bu bakımda bulunan/düzeltilen sorunlar ve kalan borçlar.
- `ECONOMY_9_5_DELIVERY.md`: 9.5 ürün davranışı ve platform sınırları.
- `UNITY_MIGRATION_PLAN.md`: JS/C# veri ve platform sınırları.
- `reports/maintenance-source-inventory.json`: runtime, C# ve test kaynak envanteri.

## Comic Adventure

Yeni görsel kaynak: `UI_VISUAL_LANGUAGE.md`. Tema mevcut CSS hattında son bölümdür. Hikâye kitinin demo olması, sabit tahta boyutu ve saf oyun kurallarının korunması zorunludur. `test:comic-ui` bu sınırları denetler.

İlk açılış akışı ve sunum sınırları: `FIRST_PLAY_FLOW.md`. Yeni görsel gösterim, sabit öğretici verilerini veya C# oyun çekirdeğini değiştirmez.

`EconomyManager.claimWelcome/ClaimWelcome` ilk gerçek T2 kazanımına ayrı, sürümlü ve tekil bir Altın işlemi ekler. `SessionStore.resetForTesting` yalnız açık veri-silme onayıyla yeni kanonik profil yazar ve eski yazıcıyı kapatır. Bu işlem sonrası host bütün eski callback yazımlarını engeller; ayrıntı `WELCOME_REWARD_AND_TEST_RESET.md`.

## 9.9b tahta doğrulama sınırı

`HexMatch.validateLevel` / C# `HexMatch.ValidateLevel` çekirdek yapı güvenliğini, kurtarma yardımcıları dolu/izinli, eşleşmesiz ve yasal takaslı son koşulu sahiplenir. Yayın sertifikaları ve gelecek import kabulü ayrı offline katmandır; eski checkpoint'lere güncel yayın koşulları dayatılmaz. Yardımcı hata halinde kendi values/RNG'sini geri alır; bütün komutun atomikliği mevcut app/AssistedGame/session sınırındadır. Kayıt sürümleri ve otorite dağılımı değişmedi. Ayrıntı: [BOARD_VALIDATION_9_9B.md](BOARD_VALIDATION_9_9B.md).
