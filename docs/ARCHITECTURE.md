# Hexrota — kod sahipliği ve bakım rehberi

Bu belge mevcut oyun ve Tavik sahne sunumunun modül sınırlarını açıklar. Oyun kuralları için ilgili sürümlü ürün sözleşmeleri geçerlidir; burada yeni güçlendirici, fiyat veya denge kuralı tanımlanmaz.

## Veri akışı

```text
index.html (sıralı defer bağımlılıkları)
  └─ session-store.boot: tek-yazıcı kilidi + kanonik profil
      └─ app.js: ekran/oturum orkestrasyonu
          ├─ game-save: salt-okuma bootstrap ve eski kayıt normalizasyonu
          ├─ attempts + engine/commands: deneme ve deterministik oyun
          ├─ economy + lives + rescue: saf iş kuralları
          ├─ atomik profil commit'i
          ├─ board-view / board-input / score-presentation / garden / audio
          └─ scene-presentation: kesinleşmiş yıldızlar + salt görünüm bilgisi
              └─ hazırlanmış Tavik hareket adaptörü / isteğe bağlı görseller
```

Görsel olaylar oyun kuralı değildir. Hamlenin kanonik sonucu önce kesinleşir; animasyon arızası, iptal veya arka plana geçiş ikinci bir hamle/ödül oluşturamaz. Analitik kayıt hatası kanonik oyunu geri almamalı; başarısız kanonik hamle de analitiğe başarı diye yazılmamalıdır.

## JavaScript sahiplik tablosu

| Dosya | Sorumluluk | Yapmaması gereken |
| --- | --- | --- |
| `dist/app.js` | Ekranlar, oturum komutları, mevcut atomik commit ve özelliklerin bağlanması | Yeni saf hesapları tekrar içine gömmek |
| `dist/game-save.js` | Kayıt varlığı, v5 normalizasyonu, eski v4/v3/v2 indeks geçişi | Profil yazmak, bozuk kaydı yeni oyuncu saymak |
| `dist/session-store.js` | Profil zarfı, revision, tek başarılı kanonik yazım, uyumluluk aynaları, tarayıcı kilidi | Ödül/hamle üretmek veya hatada kaydı silmek |
| `dist/board-view.js` | Altıgen geometri, SVG işaretlemesi, iki yönlü taş animasyon yolu | DOM, motor, cüzdan, saat veya RNG'ye erişmek |
| `dist/board-input.js` | Yerel koordinatla hücre ve altı yönlü kaydırma sınıflaması | Takas yapmak veya taş sonucunu tahmin etmek |
| `dist/first-play.js` | Kısa öğretici sunumu ve durumsuz, yavaş SVG kaydırma gösterimi | Gerçek takas, kayıt, can veya ödül üretmek |
| `dist/scene-presentation.js` | Dünya, dekoratif Tavik, yerleşim, poz ve kısa kararma yaşam döngüsü | Motor/kayıt/cüzdan sahibi olmak, ikinci girdi sistemi veya ödül kanıtı üretmek |
| `data/scene-config-v1.json` → `dist/scene-config.json` / `.js` | Tek kaynakta sahne eşikleri, yerel varlık yolları ve sunum ayarları | İkinci kalıcı ilerleme sayacı tanımlamak |
| `dist/score-presentation.js` | Enjekte edilen görünüm bağımlılıklarıyla puan animasyonunun yaşam döngüsü | Kalıcı skor, Altın, hamle veya RNG değiştirmek |
| `dist/engine.js` | `classic-v4` takas/eşleşme/düşüş/üretim ve replay | Ekonomi veya DOM |
| `dist/commands.js` | `assisted-v1` yardımlı komut geçmişi | Klasik v4 geçmişini sessizce yeniden yorumlamak |
| `dist/attempts.js` | Katalog, seçim RNG'si, sürümlü varyant/deneme kimliği | Oyun RNG'sini veya fiyatları okumak |
| `dist/economy.js` | Kalıcı tamamlama, Altın, yıldız, stok ve ödül hakları | Tekrar oynayarak yeni hak oluşturmak |
| `dist/lives.js`, `dist/rescue.js` | Can ve aynı denemede ikinci şans kuralları | Doğrulanmamış callback'i ödeme/reklam kanıtı saymak |
| `dist/rewards.js`, `dist/reward-adapter.js` | Gerçek hamle verisinden sunum yoğunluğu | Skor veya kazanma olasılığını değiştirmek |
| `dist/events.js`, `dist/playtest.js` | Yerel olay ve isteğe bağlı gözlem sözleşmeleri | Otomatik kişisel veri gönderimi |
| `dist/garden.js`, `dist/audio.js` | Kalıcı yıldızlardan görünüm; kullanıcı tercihiyle ses | Yeni ödül üretmek |

`app.js` hâlâ büyük bir orkestratördür. Bu çalışmada görünür ve testlenebilir bağımlılık sınırları çıkarılmıştır; tüm paylaşılan oturum durumunun tamamen ortadan kalktığı iddia edilmez. Sonraki güvenli adım ekonomi/can ekran adaptörlerini aynı atomik işlem sınırını koruyarak ayırmaktır.

## C# sahipliği

`unity/Gameplay`, `Catalog`, `Lives`, `Hints`, `Rewards`, `RewardAdapter`, `Economy`, `Commands`, `Rescue`, `Contracts` saf çekirdektir. UnityEngine, DOM, ağ ve dosya API'leri bu dizinlere girmez.

`unity/Application/GameSessionController.cs` başlangıç, ana akış ve **tek `Execute` işlem sınırını** tutar. `GameSessionController.Assistance.cs` envanter/yardım komutlarını, `GameSessionController.Rescue.cs` ikinci şans işlemlerini içerir. Bunlar aynı partial sınıfın parçalarıdır; bağımsız veritabanı veya ikinci oturum sahibi değildir. Bölme, metot gövdelerini veya sıralamayı değiştirmez. Yeni özellikler farklı bir kalıcı commit yolu açmamalıdır.

`ProfileRepository` kalıcı adaptör sözleşmesidir. `MemoryProfileStorage` test adaptörüdür; gerçek iOS dosya sistemi / IL2CPP doğrulaması yerine geçmez. `*ParityHarness` ve `ParitySupport` yalnız test host'larıdır.

## Kayıt kuralları

- `hexrota-profile-v2` tek yetkili zarf; `game + energy` aynı revision altında yazılır.
- Mevcut `hexrota-match-v5` ve `hexrota-lives-v1` aynaları başarılı kanonik yazımdan sonra tamir edilebilir. Ayna hatası başarıyı geri almamalıdır.
- Anahtarın bulunmamasıyla mevcut `null`/bozuk JSON aynı değildir. Yeni/legacy ilerleme bozuksa eski içeriği koru, güvenli hata ver.
- Revision güvenli JSON tamsayısıdır. Sınırda yazma reddedilir; taşırıp bir sonraki açılışı bozma.
- Aynı denemenin can, güçlendirici ve ödül kayıtları iki kez uygulanmaz; DOM düğmesinin gizlenmesi tek güvenlik sınırı değildir.
- Hata yutma sadece belgelenmiş isteğe bağlı sunum/ayna/analitik yollarında olabilir. Yetkili profil okumasında sessiz varsayılan oluşturma yoktur.

## CSS ve çevrimdışı paket

`src/styles/manifest.json` kaynak bölümlerinin sırasını belirler. `npm run styles:sync`, bunları **aynı sırada tek `dist/style.css`** dosyasına birleştirir. Tarayıcıda `@import` zinciri veya ek CSS isteği yoktur. Hazır `dist/assets/scenes/coop-v1/tavik-motion.css` ve `src/styles/07-coop-scene.css` bu hatta eklenmiştir; mevcut çizgi roman teması son bölüm olarak kalır. Hazır hareket CSS'i varlık hash sözleşmesinin parçasıdır; değiştirilmez. Yeni yerleşim kuralları `07-coop-scene.css` içinde düzenlenir; üretilmiş çıktı da commit edilir.

`dist/index.html` bağımlılıkları `defer` sırasıyla yükler. Yeni runtime betiği eklenince `dist/sw.js` allowlist/önbellek listesi, HTML, Worker query ve `qa-fixtures.cjs` birlikte güncellenir. Tavik sahne paketi **PWA v36** kullanır; bu kayıt formatının veya oyun kurallarının sürümünü değiştirmez. Hareket adaptörü, yapılandırma ve sahne modülü çevrimdışı kabuğa dahildir. Hazırlanmış 22 WebP yalnız açık izin listesiyle ihtiyaç anında önbelleğe alınır; ilk çevrimdışı fallback için `clearing-mobile.webp` ve `idle.webp` ayrıca ısıtılır. Kaynak PNG'ler ve bağımsız prova sayfası bu kapsamda değildir. WebP içerik türü doğrulanır; görsel hatası çevrimiçi oyunu veya kayıtları engellemez.

## Tavik sahnesinin sunum sözleşmesi

`node sync-scene-config.cjs`, `data/scene-config-v1.json` dosyasını doğrulayıp tarayıcı için `dist/scene-config.json` ve `dist/scene-config.js` üretir; `--check` eski çıktıyı reddeder. `scene-config.js` yalnız `HEX_SCENE_CONFIG` görünüm verisini yayımlar. Eşiklerin tek kaynağı bu JSON'dır; doğrulayıcı ilk eşiğin sıfır, diğerlerinin sıralı ve kesin artan, tümünün negatif olmayan güvenli tamsayı olmasını ister. Geçersiz yapılandırma, tanınmayan alan veya izin verilmeyen varlık yolu sessizce kabul edilmez. Gelecekteki hikâye için `futureStory: {enabled:false,hooks:[]}` veri uzantısı vardır; kaçırılma/kurtarma sistemi uygulanmış değildir.

`HexScenePresentation.create({document,window,config,board,homeHost,gameHost,onError})` bir DOM sunum adaptörüdür. Dışarıya `update(view)`, `react({key,kind})`, `snapshot()` ve `destroy()` verir. `view` yalnız ekran, ilk açılış, **kesinleşmiş yıldız**, deneme/tur kimliği, sonuç, öğretici çifti ve duraklama/görünürlük/hareket tercihini taşır. Modül motor, oturum deposu, can, ekonomi, RNG veya hamle komutuna erişmez. `app.js` yıldız önbelleğini başarılı atomik commit sonucundan yeniler; geri alma sırasında son geçerli profilden geri yükler. Taslak kazanımın bir kareliğine bile yapı açmaması bu sınırla sağlanır.

| Kanonik kampanya yıldızı | Sahne |
| --- | --- |
| 0–1 | `clearing` |
| 2–4 | `frame` |
| 5–9 | `roof` |
| 10 ve üstü | `finished` |

Yıldız harcanmaz ve sahne için ayrı kayıt tutulmaz. İlk yüklemede mevcut oyuncunun doğru aşaması gösterilir; inşa kutlaması veya öğretici zorlanmaz. Öğretici tamamlama, tekrar ve başlangıç Altını sahne eşiğini değiştirmez. **T2 sonrasındaki tekil +20 Altın**, ön plandaki Altın/sandık ve dönen ışık sunumuyla birlikte korunur. Poz yüklenmesi veya hareketin bitmesi hiçbir ödül yazmaz.

Arka planlar hizalı yapı katmanları değildir. Yüklenen aşama, tahta altında kısa karartmayla değiştirilir: yapılandırma beklemesi 140 ms, CSS opaklık geçişi 120 ms'dir. Azaltılmış harekette geçiş anlıktır. Önce etkin arka plan ve idle, sonraki pozlar/aşamalar ihtiyaçla yüklenir. Geciken decode ve poz yanıtları yaşam döngüsü/istek nesilleriyle elenir. Hata durumunda önbellekteki clearing, statik renk veya onaylı mevcut Tavik portresi kullanılır; oyun tahtası kullanılabilir kalır.

Tek dünya ve tek Tavik ana menüden gerçek T1 tahtasına geçerken korunur; örnek prova tahtası kullanılmaz. Dekoratif katmanlarda `pointer-events:none` bulunur. Normal oyunda 80–110 px Tavik için gerçek SVG hücrelerinin, HUD'un ve öğretici kartının sınırlayıcı kutuları kontrol edilir; hareket için yukarıda 24 px, yanlarda 10 px ek pay ayrılır. Dar öğretici ekranda mevcut Menü/Mola boşluğuna 44–48 px statik yerleşim kullanılabilir. Güvenli alan yoksa karakter gizlenir; tahta veya dokunma alanı küçültülmez. İşaret etme yönü gerçek öğretici çiftine göre yalnız dış kapsayıcıda çevrilir.

Gizli sekme, mola ve açık diyalog hareketi durdurur, geçici tepkileri/kararmayı temizler. Ana menü/oyun dışındaki ekranlar sahne düğümlerini ve dinleyicilerini kaldırır; aynı modül daha sonra yeni bir görünüm kurabilir. `destroy()` nihai ve tekrarlanabilir temizlemedir; `pagehide` ve tam test sıfırlamasında çağrılır. `pagehide` host başvurusunu da boşaltır; sahne host'u normal `pageshow` sırasında mevcut görünümden yeni bir modül kurabilir. **Mevcut kayıt deposunun BFCache politikası değişmemiştir:** `pageshow.persisted` sayfayı yeniden yükler ve tek-yazıcı sahipliği yeniden alınır. Sahneye özel geri dönüş kancası yeni bir BFCache kayıt/oturum akışı değildir. Gizli sekme güncellemesi kendiliğinden modül diriltmez. Hiçbir eski async yanıt temizlenen sahneye yazamaz. Fiziksel cihaz ve Unity/IL2CPP doğrulaması ayrı platform işidir.

## Geliştirme kontrol listesi

1. Güncel `main`den ayrı branch; kullanıcı onayı olmadan merge/Production değişikliği yok.
2. Yeni davranışı önce testle tarif et; düzeltmede önce eski davranışın hatasını yeniden üret.
3. Saf kural değişirse gerçek derlenmiş JS/C# karşılaştırması; sunum değişirse gerçek Chromium/WebKit görüntü ve dokunma testleri.
4. `npm test` mevcut bütün zinciri ve `test:maintenance` kontrolünü çalıştırır. Hiçbir eski test kaldırılmaz; eşiği hatayı gizlemek için gevşetme.
5. `npm run test:maintenance`: CSS üretim tutarlılığı, hafif bağımlılık/syntax korumaları, kayıt sınırı ve dondurulmuş sunum testleri.
6. Görünür ekran davranışı için fiziksel iPhone kontrolü ayrıca gerekir. Otomatik WebKit sonucu iPhone testi diye yazılmaz.
7. Değişikliğin nedeni, modülü, sözleşme etkisi ve kanıtı bakım raporuna/PR açıklamasına yazılır.

## Referanslar

- `CODEBASE_AUDIT_9_5.md`: bu bakımda bulunan/düzeltilen sorunlar ve kalan borçlar.
- `ECONOMY_9_5_DELIVERY.md`: 9.5 ürün davranışı ve platform sınırları.
- `UNITY_MIGRATION_PLAN.md`: JS/C# veri ve platform sınırları.
- `reports/maintenance-source-inventory.json`: runtime, C# ve test kaynak envanteri.

## Comic Adventure

Yeni görsel kaynak: `UI_VISUAL_LANGUAGE.md`. Tema mevcut CSS hattında son bölümdür. Hikâye kitinin demo olması, sabit tahta boyutu ve saf oyun kurallarının korunması zorunludur. `test:comic-ui` bu sınırları denetler.

İlk açılış akışı ve sunum sınırları: `FIRST_PLAY_FLOW.md`. Yeni görsel gösterim, sabit öğretici verilerini veya C# oyun çekirdeğini değiştirmez.

`EconomyManager.claimWelcome/ClaimWelcome` ilk gerçek T2 kazanımına ayrı, sürümlü ve tekil bir Altın işlemi ekler. `SessionStore.resetForTesting` yalnız açık veri-silme onayıyla yeni kanonik profil yazar ve eski yazıcıyı kapatır. Bu işlem sonrası host bütün eski callback yazımlarını engeller; ayrıntı `WELCOME_REWARD_AND_TEST_RESET.md`.
