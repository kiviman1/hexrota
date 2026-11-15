# C# Application, Save ve Event Katmanı

Durum: Saf C# 7.3 uygulandı ve gerçek .NET 8 harness ile JavaScript kaynaklarına karşı sınandı. Web uygulaması bu katmanı çağırmaz. Unity sahnesi, platform dosya adaptörü, cihaz SDK'sı ve ağ servisi bu çalışma kapsamında oluşturulmadı.

## 9.5 A: kalıcı tek tamamlama

`GameSessionController`, `Hexrota.Economy.EconomyManager` kullanır. `Game.economy` ledger'ı aynı `hexrota-profile-v2` commit'inde saklanır; TEST cüzdanı ayrıdır. `CanOpen`, `Preview`, `Enter`, `Retry`, `Restart`, `Swap` ve `Hint` tamamlanmış veya sıradaki olmayan kampanya bölümünü reddeder. Öğreticiler ücretsiz yeniden oynanır. Kazanma, gerçek motor durumundan doğrulandıktan sonra 20 Altın/1 yıldız ve L3/L6 stok hediyesi atomik kaydedilir.

Geçerli eski `done` kapalı kalır; replay ile doğrulanmış kazanma arşivi varsa geriye dönük tek ödül verilir. Kanıt yoksa hak incelemede kalır, bölüm yeniden açılmaz. Normal reset kalıcı ledger ve kazanma arşivlerini korur. Ayrıntı: [ECONOMY_CORE_9_5.md](ECONOMY_CORE_9_5.md). A doğrulamasında 915 tam oturum karşılaştırması/28 app.js akışı ve 16 native senaryo (önceki 11 + 5 yeni ilerleme/legacy/final/bozuk ledger sınırı) geçti. Aşama A karşılaştırma sayıları tarihsel referanstır.

## 9.5 B: yardım komutları ve atomik envanter

`AttemptRepository.RestoreSession` klasik v4 veya gerçek yardımlı komut replay'ini seçer; `ApplicationAttemptCheckpoint` doğru snapshot'ı taşır. Yardım komutu ile ekonomi debiti aynı kimlik/Attempt ID/türü korunmuş Level ID/ürün üzerinden iki yönlü bağlanır. Yardımsız all-swap yeni zarf, metadata'sız eski kayıtta gizlenen ücret, desteklenmeyen kullanım limiti ve bozuk sonuç ilk profil yazımından önce reddedilir.

`PreviewBooster` hiçbir kaynak değiştirmeden gerçek sonuç ve savunmalı teklif kopyası döndürür. `UseBooster` önceden oluşturulmuş, revision/Attempt/tam snapshot/parametrelerle aynı zorunlu teklifi ister; yalnız `turn` veya boş komut guard'ı yeterli değildir. `PurchaseInventory`, 70/90 oyun Altınıyla bir stok alır. Stok, tahta, kazanma ödülü ve can aynı atomik kayıttadır. Yardım sonrası ipucu eski sertifikayı kullanmaz; Reward Director plan/durumu null, gerçek sonuç dalgaları sunum girdisidir. Klasik Director korunur.

B doğrulaması: 1.005 tam JSON karşılaştırması, 30 gerçek app.js akışı, 25 native guard senaryosu; olay karşılaştırması 580/462 aynen korunur. Eksik/eski teklif, sıfır-turn değişim, yalnız revision ilerlemesi, kayıt hatası, bozuk ekonomik eşleme ve sıfır canla mevcut yardım kaydından devam dahildir. İkinci şans host'u C aşamasına aittir; B'de yetkisiz grant_moves yüklenmez.

## 9.5 C: doğrulanmış ikinci şans

`RescueOffer`, `ResumeForSecondChance`, `BeginRescueAd`, `CompleteRescueAd`, `ApplyRescueReceipt` ve `RescueWithGold` aynı Attempt ID'de +5 hamle yönetir. Saf RescueManager saati/verifier'ı dışarıdan alır; TEST provider gerçek reklam değildir. `game.rescue` mevcutsa sürümü ve biçimi ilk commit'ten önce doğrulanır. Yardım komutu, rescue claim, varsa aynı kimlikli 140 Altın debiti ve gerçek Life settlement birlikte eşlenir. Geçerli muafiyetler ve sonradan kazanılmış/discarded arşivler korunur; ikinci can kesilmez.

Kanonik yazım başarısız olduğunda bilinen doğrulanmış tamamlanma özel bellekte pending delivery olarak korunur. Menü/aynı kayıp görünümü ve `RetryPendingRescueDelivery` açıktır; yeni deneme, reset, başka ücret veya yeniden reklamla hakkı kaybetme engellenir. Başarılı teslim bir kez temizler. Yeni process sonrasında host/sağlayıcı aynı doğrulanmış kanıtı yeniden teslim etmelidir; çekirdek dosya/SDK veya sahte kalıcı makbuz otoritesi oluşturmaz. Henüz izlenmemiş pending istek açık terk sırasında iptal edilir.

C gerçek karşılaştırma: **1.190 tam JSON**, **34 app.js akışı**, **44 native senaryo**; olay **580 / 462** korunur. Gold/TEST ayrımı, başarısız save ve receipt redelivery, yanlış Life/ekonomi/komut bağları, null/bilinmeyen rescue, UTC gün değişimi, sıfır canla devam, normal takas sonrası archived restart, bilinen kaydedilmemiş kanıt, stale CAS ve tek slot olay tamponu dahildir. Kullanılamaz hamle teklifi için ayrı sentetik geometride gerçek replay testi vardır; yayımlanmış 40 tahta değiştirilmez.

## Bağımlılıklar ve kapsam

Bu çalışma güncel `main` tabanlıdır; katalog, can ve ipucu/ödül adaptörü için henüz onaylanmamış bağımsız PR #6, #7 ve #8'in kaynak dallarını yerel olarak içerir. Bu bağımlılıkların birleştirilmesi GitHub PR'larının onaylanması veya `main`e birleştirilmesi anlamına gelmez. Integration PR bütün modülleri ayrıca sınar.

| C# modülü | Gerçek JavaScript karşılığı | Sorumluluk |
| --- | --- | --- |
| `GameSessionController` | `dist/app.js` oturum fonksiyonları | Bölüm ön izlemesi, giriş/devam, hamle, ipucu, sonuç, tekrar, onaylı sıfırlama, menü/kapatma ve ilerleme sıfırlama |
| `AttemptRepository` | `restoredStage()` ve katalog çağrıları | Kayıtlı bölüm/varyant kimliğini çözme; snapshot'ı gerçek hamle geçmişinden tekrar doğrulama |
| `GameProfile`, `ProfileRepository` | `dist/session-store.js` | Tek yetkili profil, revision denetimi, atomik compare/exchange, tamir edilebilir eski kayıt aynaları |
| `SaveMigration` | `dist/app.js` başlangıç normalizasyonu | v5 içeriği, eski v4 kampanya indekslerinin +2 kaydırılması, v3/v2 ilerleme geçişi |
| `SaveValidator` | Katalog restore + motor replay + prototype validate | Profil zarfı, normalize edilmiş oyun kayıtları ve can/TEST Altın kaydının doğrulanması |
| `GameEventTracker` | `dist/events.js` | Aynı alanlar, tipler, hata mesajları, sınırlı olay tamponu ve terminal olay tekrarını engelleme |
| `DevelopmentLifeProvider` | `dist/life-providers.js` | Yerel TEST işlem kimlikleri, tamamlanmış makbuz, v1/v2 sağlayıcı geçişi ve finalized ranges |
| `IProfileStorage` | Web Storage + writer lock arayüzünün native sınırı | Anahtar varlığı, okuma, atomik revision CAS ve ayrı analitik yazımı |

Gameplay, katalog, LifeManager, HintSolver ve Reward Director bağımsız saf servisler olarak kullanılır. Controller'ın saat kaynağı `IUtcClock` arayüzünden gelir. İpucunun süre politikası ayrı `IHintClock` kullanır. Dosya sistemi, UnityEngine, DOM, zamanlayıcı, cihaz saati ve serializer çekirdeğin bağımlılığı değildir.

## Korunan kayıt sözleşmeleri

Yeni kalıcı native kayıt biçimi eklenmedi. JSON DTO'ları mevcut web anahtarlarına karşılık gelir:

- `hexrota-profile-v2`: `{schemaVersion:2, revision, game, energy}`. Kalıcı revision en az 1, güvenli JSON tamsayısıdır. Eski aynaları okumak için yalnızca bellekte revision 0 tabanı kullanılabilir.
- `hexrota-match-v5`: `current`, `done`, `boards`, `attempts`, `attemptStats`, `variantSelection`, `guideAcks`, `sound`, `preferences`, `records`. **Bu iç nesnede `schemaVersion` alanı yoktur.** v5, depolama anahtarının sürümüdür.
- Gameplay snapshot: `version:4`, `rulesVersion:"classic-v4"`, taşlar, katlar, puan, hamleler, RNG ve gerçek `history`.
- Attempt metadata: `attemptVersion:1`, tipini koruyan `levelId`, `variantId`, `levelDataVersion`, `attemptId`, `attemptSerial`.
- `hexrota-lives-v1`: dış prototype `schemaVersion:1`; içinde güncel can `schemaVersion:2`, `testWallet` ve provider bulunur. Dış anahtarın v1 olması, iç LifeState'in eski v1 olduğu anlamına gelmez.
- `hexrota-events-v1`: `schemaVersion:1`, `limit`, `nextSequence`, `events`; oyun profilinden ayrı, yerel ve isteğe bağlıdır.

Eski `legacy-original` denemeleri orijinal bölüm verileriyle oynatılır. Eski v4 kampanya kayıtları iki öğreticinin arkasına taşınır. v3/v2'deki eski ve artık uyumlu olmayan tahta verileri, mevcut web geçişinin yaptığı gibi taşınmaz; tamamlanan bölümler ve ses tercihi korunur. JavaScript'in kabul ettiği indeksli dizi konteynerlerindeki geçerli v4/v5 tahta kayıtları da normalize edilerek korunur. İç can v1 ve sağlayıcı v1 kayıtları kendi güncel geçişleriyle yüklenir. Metadata, RNG veya snapshot doğrulanamazsa controller yeni bir tahta yazmaz; önceki depolama içeriği tutulur.

Öğretici kimliği string (`"learn-1"`), kampanya kimliği number (`1`) olarak kalır. `"1"` ile `1` aynı bölüm değildir. Seçim RNG'si `variantSelection.seed`, oyun RNG'si snapshot `rngState` alanındadır; biri diğerinin yerine kullanılmaz.

## İşlem ve yaşam döngüsü

Her başarılı native uygulama komutu, `game + energy` toplamını **tek CAS yazımıyla** kaydeder. Başarısız CAS veya yazma hatası; tahta, puan, katlar, hamle geçmişi, varyant seçici, attempt istatistikleri, can, TEST Altın ve bekleyen olayları önceki geçerli duruma döndürür. Kazanma/kaybetme snapshot'ı ile bir defalık can settlement'ı aynı yazımdadır.

`IProfileStorage.CompareExchange(key, expectedRevision, next)` gerçekten atomik olmalıdır. Önce okuma sonra ayrı yazma, bu sözleşmeyi karşılamaz. `Contains()` zorunludur: olmayan anahtarla içinde JSON `null` bulunan anahtar aynı değildir. Bozuk mevcut canonical profil ve mevcut geçersiz can kaydı, yeni oyuncu kaydı olarak kabul edilmez.

Canonical kayıt başarıyla yazıldıktan sonra uyumluluk aynalarının veya analitik kaydının yazılamaması oyunu geri almaz. Analitik olaylar yalnızca başarılı canonical commit sonrasında saklanmaya çalışılır. Başarısız hamlenin sonuç olayı kalıcılaşmaz. İki native yazıcı aynı revision'ı güncelleyemez; kaybeden yazıcı `stale_profile` alır ve sonraki işlem için profili yeniden açmalıdır. Native storage adaptörünün commit sırasında çökme güvenliği sağlaması platform uygulamasının sorumluluğudur.

Menüye dönüş, kapatma ve tekrar açma can harcatmaz. Mevcut oynanabilir kayıt sıfır canla devam edebilir. `Retry()` yalnızca terminal deneme içindir; oynanmış devam eden denemede açık onay olmadan reset yapılamaz. `Restart(false)` hiçbir şeyi değiştirmez. Son canla veya sıfır canla onaylanmış oynanmış deneme kapatıldığında eski snapshot depoda tutulabilir; settlement `discarded:true` olur, `Preview.resume` false olur ve `Swap`/`Hint` kapatılmış Attempt ID için reddedilir.

Asenkron UI/SDK komutları `SessionCommand` içinde **gözlenen `expectedRevision + attemptId + turn`** değerlerini taşımalıdır. Aynı callback ikinci kez geldiğinde eski turn/revision/Attempt ID reddedilir. Host bu zarfı vermezse art arda iki `Swap` çağrısının tek kullanıcı hareketi olduğu varsayılmaz. Yeni kalıcı komut günlüğü icat edilmedi; mevcut hamle geçmişi ve settlement/işlem kimlikleri kullanılır.

Bölüm ön izlemesi yeni varyant seçmez, kaydı veya aktif denemeyi değiştirmez. Bölüm girişinden önce seçim doğrulanır; can kayıt işlemi reddedilirse seçici/tahta/başlangıç olayı atomik olarak geri alınır. Sınırsız canın `CanStart` ile `RegisterAttempt` arasında bitmesi için de bu kontrol yapılır. Bu native fail-closed kontrolü, JS hostunun göz ardı edebildiği ara kayıt reddini ayrıca ele alır; web kuralları değiştirilmedi.

Controller UI penceresi veya reklam başlatmaz. Host, can kazanıldıktan sonra engellenmiş bölüm isteğini tekrar `Enter()` ile gönderebilir. Aynı anda kaç TEST sağlayıcı penceresi açılacağı UI politikasındadır; çekirdek daha önce verilmiş farklı işlem kimliklerini güvenle tutabilir.

## TEST sağlayıcısı, makbuz ve kurtarma

Bu sağlayıcı yerel geliştirme içindir. Kullanıcının değiştirebileceği saat, provider JSON'u veya TEST makbuzu gerçek reklam/ödeme doğrulaması değildir. Gerçek SDK, para çekimi ve otomatik ağ aktarımı yoktur.

Normal teslimde makbuz, mevcut sağlayıcının daha önce verdiği pending işlemle aynı kimlik/ürün/oluşturulma zamanı/namespace bilgisini taşımalı ve tamamlanmış sağlayıcı kaydıyla birebir eşleşmelidir. Tamamlanmış makbuz tekrarı ikinci can veya TEST Altın üretmez. Daha eski bir tamamlanmış sağlayıcı görüntüsü yalnızca ilgili işlemi günceller; daha yeni işlem kayıtlarını, allocator `nextSerial` değerini, reklam bulunabilirliğini veya finalized ranges'i geri alamaz. Başka namespace, farklı tamamlanmış makbuz, unavailable veya finalized işlem reddedilir.

Başlangıçta yarıda kalmış TEST pencereleri JS davranışıyla aynı şekilde cancelled yapılır. Bu yüzden ordinary `ApplyReceipt` cancelled işlemi canlandıramaz. Gerçekten tamamlanmış, fakat önceki profil yazımı başarısız olmuş bir işlemin uygulama yeniden açıldıktan sonra teslimi için **opsiyonel ve bağımsız `IReceiptVerifier recoveryReceiptVerifier`** vardır. Varsayılanı yoktur/reddeder. Host sağlayıcısından bağımsız doğrulayıcı tam makbuzu onaylamalı; eski verilmiş işlemle kimlik/ürün/zaman eşleşmesi yine zorunludur. Sadece çağıranın `true` bayrağı veya kendisinin gönderdiği provider JSON'u yeterli değildir. Harness bu sınırı ayrı bir makbuz izin listesiyle sınar. Bu gelecekteki doğrulanmış native redelivery sınırıdır; doğrudan web TEST UI parity'si gibi sunulmaz.

Yerel provider, zengin terminal kayıtları 128'i aşınca finalized seri aralıklarıyla sıkıştırır. Can settlement'ı, wallet kaydı ve işlem kimliği tek profil içinde kalır. Reklam tamamlama sırasında canlar dolmuşsa bekleyen can hakkı LifeManager tarafından korunur. Cihaz saatini geri almak yeni hak üretmez.

## İpucu ve ödüller

Controller, doğrulanmış `proven_route`, doğrulanan sınırlı arama `search_win` ve garantisiz `heuristic` sınıflarını taşır; öğreticide `guided` kullanır. İpucu isteği RNG/puan/taş/kat/hamle sayısını değiştirmez; sadece hintsUsed ve başarılı kayıt sonrası olay güncellenir. Deterministik test politikası `maxNodes=5000`, `maxDepth=3`, `beamWidth=10` kullanır; süre bütçesi ayrı host politikasıdır.

Ödül girdisi gerçek gameplay sonucundan RewardAdapter ile çıkarılır. Mevcut Reward Director korunur. `CurrentRewards` bağımsız kopyadır. `LastRewardPlan` yalnızca yeni başarılı hamlenin sunum verisidir; kayıt yükleme ve rollback ödül durumunu yeniden kurar, eski efekt planını yeniden yayınlamaz. Sunum planı puanlama veya kayıt doğrulamasının girdisi değildir.

## Gerçek doğrulama ve sınırlar

Komut: `npm run test:unity-session`. .NET 8 yoksa test başarısız olur; JavaScript sonucu C# sonucu yerine kullanılamaz. Harness `LangVersion=7.3` ile C# kaynaklarını derler. SDK ve serializer sadece harness'tedir; saf Application modülü serializer kullanmaz.

- Event parity: **580 tam JSON karşılaştırması**, bunların içinde **462 kaynakla aynı reddetme mesajı**. Oluşturma, alan tipleri, sınırlı tampon/sıra, callback tekrarı, kişisel veri/ek alan reddi ve girdi değişmezliği.
- Application/session parity: **915 tam JSON karşılaştırması**, **28 gerçek `app.js`/JSDOM akışı**. Her adımda tam game, energy, kalıcı events, görünür kayıt/Attempt ID ve yeniden oluşturulan RewardState karşılaştırılır. On ana bölümün kazanma akışları, gerçek aktif kayıp/tekrar, tutorial, sıfır can, onay/iptal, menü/kapatma/yükleme, legacy kayıtlar ve yazma hataları dahildir.
- Bunlardan ayrı **11 native hata/guard senaryosu**: stale turn/revision, Retry onayı, iki controller, bozuk snapshot/metadata/null kayıt, stale provider görüntüsü, makbuz kurtarma ve başlangıç sırasında sınırsız canın bitmesi. Bunlar tam JS parity sayısına eklenmez.
- Repository karşılaştırmaları `dist/session-store.js` ile aynı commit/read/failure dizisinde **tam canonical profil, revision, eski aynalar ve hata sonuçlarını** karşılaştırır.
- Gerçek app akışlarında `game + energy + events` ve oyun görünümü eksiksiz karşılaştırılır; **UI kaynaklı revision yazım adedi eşitliği iddia edilmez**. Web sunum/odak/modal işlemleri ek aynı-veri yazımları yapar; native controller bir mantıksal komut için bir atomik commit yapar. Wire biçimi/revision davranışı ayrı repository parity'sinde birebir doğrulanır.

Katalogdaki 40 varyant/80 kazanma yolu; Gameplay, LifeManager, HintSolver ve Reward Adapter'ın daha geniş parity harness'leriyle ayrıca doğrulanır. Bu katman yayımlanmış bölüm verilerini, motoru, RNG'yi, ekonomi fiyatlarını veya web kayıtlarını değiştirmez.

Henüz doğrulanmayanlar: Unity editörü/sahnesi, Mono/IL2CPP, fiziksel iOS/Android, native dosya yazımı sırasında elektrik/kapanma, gerçek sağlayıcı makbuz doğrulaması ve gerçek cihazda SDK callback yaşam döngüsü. JSDOM akış testi fiziksel mobil giriş testi değildir; mevcut Chromium/WebKit işleri ayrıca korunur. Bunlar Unity host/adaptör aşamasında gerçek platform testleri gerektirir.
