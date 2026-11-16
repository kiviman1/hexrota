# Durum mimarisi — uygulanan aşamalı geçiş

## Referans, kapsam ve kanıt sınırı

Başlangıç `main`: `996462b8513cfbdbe2747941c0aad76528357842` (PR #24 dahil). Dal `refactor/hexrota-state-architecture`. Bu belge ilk Stage A planını, gerçekten uygulanan aşama kaydına dönüştürür. Baseline envanteri `STATE_ARCHITECTURE.md` / `STATE_TRANSITION_MATRIX.md` içinde tarihsel olarak korunur; yeni API'ler başlangıçta varmış gibi yazılmaz.

Kod göçü ve son konsolidasyon uygulandı; son yerel `npm test` geçti. Nihai browser, derlenmiş C# karşılaştırmaları, CI/PR ve Vercel Preview kanıtları `STATE_REFACTOR_REPORT.md` içinde commit bazında kaydedilir. Buradaki workflow/test tanımı, henüz gözlenmemiş uzak koşumun geçtiği iddiası değildir.

| Aşama | Gerçek değişiklik / commit |
| --- | --- |
| A — Envanter ve host karakterizasyonu | `8fe2e7f`; runtime değişmeden üç belge ve 11 gerçek uygulama grubu. |
| A — Mobil baseline | `3509f58`; runtime değişmeden Chromium/WebKit 19'ar grup. |
| B — Saf çekirdek | `ed14aeb`; DOM'suz Core/selector ve bağımsız geçiş testleri. |
| C — Navigation ve native modal | `a6daca1`; `screen`, `paused`, `modalStack` kaldırıldı, sınırlı DOM/history/focus adaptörü bağlandı. |
| D — Öğretici/Tavik/dünya | `0c41663`; tek committed presentation projeksiyonu ve ortak board/inventory giriş selector'ları. |
| E — Async presentation | `4176aa9`; derived busy, commit sonrası pending, hint kimlikleri ve suspension guard'ı. |
| F — Konsolidasyon | Başarılı full-reset recurring timer/resource cleanup, gerçek sahiplik belgeleri ve yeni CI state-browser matrisi; son teslim commit'i rapordadır. |

## Değişmeyen yetkili veri sınırları

| Yetkili veri | Korunan sahip / sözleşme |
| --- | --- |
| Taşlar, zemin, skor, RNG, tur, durum | `HexMatch`, Snapshot v4 / `classic-v4`; yardımda `HexAssistedGame`, `assisted-v1` komut geçmişi |
| Bölüm, varyant ve deneme | `HexAttempts`; metadata v1, typed Level ID, arşivli veri sürümü, ayrı selection RNG |
| Altın, yıldız, stok, kalıcı tamamlama ve welcome | `HexEconomy`; tekil doğrulanan işlem defteri |
| Can ve muafiyet | `HexLives`; LifeState v2, UTC clock/verifier adaptörü |
| +5 hareket ve makbuz hakkı | `HexRescue` + mevcut provider, aynı Attempt ID ve tekil defterler |
| Kalıcı profil | `HexSessionStore`, `hexrota-profile-v2`; game+energy tek revision/kanonik yazım |
| Uyumluluk aynaları | `hexrota-match-v5`, `hexrota-lives-v1`; başarıdan sonra tamir edilebilir aynalar |
| Öğretici ilerlemesi | Replay doğrulanan son başarılı profil; yeni dünya/malzeme kaydı yok |

UI reducer bu değerleri yazmaz, replay etmez veya ikinci authoritative kopyalarını saklamaz. Bozuk/null save yeni oyuncu olarak kabul edilmez. `sessionAction` hâlâ senkron batch'tir; Promise'i bekleyen yeni bir transaction framework kurulmadı. Gerçek takas/booster komutu ve mevcut atomik commit ilk await'ten önce tamamlanır. Görsel hata authoritative başarıyı geri alamaz.

## A — Önce gözle, sonra değiştir

Envanterde gerçek beş ekran, 15 native modal, ortak mutable alanlar ve async kaynak/kimlikleri çıkarıldı. Normal davranışın baseline `npm test`, 11 host ve iki browser'ın 19'ar grubu runtime değişmeden kaydedildi.

Adversarial guard hedefleri başlangıçta 2/8 geçti: altı hatalı navigasyon/modal/pending-stage senaryosu kırmızıydı. Bunlar normal native inertlik arkasında oyuncu tıklaması gibi gösterilmez. Ayrı lifecycle kırmızı test, son gerçek kazanma hamlesinden sonra sentetik persisted pagehide'da stale win modalı açılmasını gösterdi; game/energy/ödül aynıydı. Bu kanıt native BFCache veya fiziksel cihaz testi değildir. Düzeltmelerle bu kontroller normal test zincirinde yeşile döndü.

## B — Küçük saf çekirdek

`app-state.js` dört paralel transient bölgeyi taşır: navigation, overlays, lifecycle ve yalnız presentation/hint için bounded operations. Motor, receipt, engine clone, Worker veya DOM snapshot'a girmez. Doğrulanan olay kataloğu, immutable own-data kopyası, guard, FIFO reentrancy ve kaldırılabilir abonelik vardır. Unknown payload ve stale instance/token güvenle reddedilir.

`state-selectors.js` Core'un ekran/kind kataloğu ve temel salt yardımcılarını kullanır; ikinci katalog/state authority oluşturmaz. Geçerli eski indexed container'lar committed tutorial projeksiyonunda desteklenir. Kalıtılmış serialization hook'ları veya recognized accessor'lar event/facts kopyalanırken çalıştırılmaz; caller domain nesnesi dondurulmaz.

## C — Ekran ve modal koordinasyonu

Gerçek `home/game/journey/records/garden` ekranları korundu. Settings modal kaldı. Geçersiz NAVIGATE/OPEN_MODAL ilk iptal/persist/history/native DOM etkisinden önce reddedilir. Pending stage yalnız kabul edilebilir önizlemede atanır; Başla yalnız açık/en üst önizlemeyi kullanır.

`state-effects.js` aynı DOM düğümlerini, native close acknowledgment'larını, focus ve history'yi yönetir. Pause→Settings→Reset, Settings→TEST provider ve aynı denemede rescue provider akışları korunur. Açılış instance'ı geç eski close olayını fence eder; gerekli ebeveynin kapanışı yasak zincir bırakıyorsa reddedilir. Native close zaten gerçekleşmişse aynı instance'lar özgün top-layer sırasıyla onarılır ve domain cleanup çağrılmaz.

Provider close temizliği tek `modalClosed` sahibinde, mevcut `sessionAction` bariyeri altında çalışır. Board input ile modal içi inventory komutlarının izinleri ayrı selector'lardır; resolving dokunuşu yalnız mevcut committed sonucu açığa çıkarır, yeni hamle değildir.

## D — Tek Tavik ve sahne projeksiyonu

`syncScene()` bir `projectPresentation` çağrısının `.portrait` ve `.scene` payload'larını iki mevcut adaptöre verir. Tek actorMode `PORTRAIT/WORLD/NONE` üretir. Tutorial boyunca portre kanalı rezerve kalır; kart terminalde/gizliyken küçük full-body tekrar ortaya çıkmaz. Mevcut decode/pose generation'ları, clip adları, fallback ve yerel cleanup korundu.

İlerleme yalnız son başarılı committed profile dayanır: `0→foundation`, `1→frame`, `2→finished`; T1 Tahta min(turn,3)/3, T2 Çivi min(turn,4)/4. Aynı Attempt ID olmadan speculative turn sayılmaz. Yıldızlar kümese bağlanmaz; yeni envanter/kayıt yoktur. PR #24'ün 118 px tek kartı, üç sütunu ve gerçek tahta/HUD ölçüsü korunur.

## E — İş rezervasyonu ile committed sunumu ayır

Mevcut epoch, current job/engine referansı ve AbortController kaldı; UI token'ı bunların veya ekonomik transaction kimliğinin yerine geçmez. Presentation requested yalnız giriş rezervasyonudur: `appBusy()` bunu kilit olarak görür, semantik `gameplayPhase` PLAYING kalır. Başarılı kanonik commit sonrasında pending ve RESOLVING olur. Terminal outcome sonrası gerçek motorun PLAYING/WON/LOST görünümü türetilir; ayrıca yazılan faz yoktur.

UI token tahsisi null/hatalıysa geçerli takas/booster commit'i reddedilmez; mevcut committed sonuç hızlı gösterilir. Dört gerçek operation UI grubu commit sırasını, geç token'ı, token tahsis arızasını ve failed-write/retry ödülünü doğrular. Invalid-swap feedback kendi küçük yerel görsel işi olarak kaldı. Hint token'ı ayrıca job/engine/epoch ile korunur; Worker terminate, resolver ve timer cleanup yapılır.

Visibility mevcut pause/result davranışını korur. Pagehide mevcut committed sunumu bitirip yeni kurulmuş terminal timer'ı da temizler, epoch'u artırır, APP_SUSPENDED ile UI generation'ı emekli eder ve sahneyi kaldırır. Pageshow mevcut görünürlük/APP_RESUMED üzerinden yalnız görünümü kurar; eski işi yeniden başlatmaz. `check-state-lifecycle.cjs` kırmızıdan yeşile döndü. Gerçek `pageshow.persisted` reload ve Web Lock'u tekrar edinme politikası değişmedi.

Doğrulanmış fakat yazılamamış life/rescue receipt, disposable animasyon işi değildir. Açık yeniden teslim, provider proof ve tekil defterler korunur; ekran/presentation iptali bu hakkı silmez.

## F — Temizlik ve teslim sınırı

Bağımsız mutable screen/paused/modalStack/busy kaldırıldı; appScreen/appPaused/appBusy salt selector'dır. Transaction baseline'ları, request quote'ları, preview clone'ları ve faydalı epoch/engine guard'ları tutuldu. Genel bir wildcard bus veya ikinci veritabanı oluşturulmadı.

Başarılı full reset önce mevcut `resetForTesting` commit + writer revoke yapar. Sonra reset bariyeri açılır, sahiplenilen iki life/rescue recurring timer durdurulur; Effects/Core/portre/sahne kaynakları destroy edilir. Başarısız reset önceki session'ı kullanılabilir bırakır. Mevcut global callback'ler host bariyerinden geçer; bütün platform dinleyicilerinin gereksiz yere yeniden yazıldığı iddia edilmez.

`npm test` bütün eski kontrolleri ve yeni `test:state` zincirini tutar. `test:state-browser` gerçek Chromium/WebKit geçiş/native modal/offline kapsamıdır. Mevcut 15 Actions işi kaldırılmadı; state-browser matrisine iki ayrı iş eklendi. Son yerel npm koşumu geçti. Final uzak koşum, parity sayıları, PR ve Preview bağlantısı raporda doğrulanır; başarısız veya yapılmamış test yeşil sayılmaz.

PWA v40 yalnız üç runtime modülünü HTML/allowlist/fixture yükleme sırasına ekleyen cache kuşağıdır; profil/snapshot/command/attempt/life sürümleri ve Production yapılandırması değişmedi. Onay olmadan merge yapılmaz.

## Unity kavramsal eşlemesi ve bilinçli kapsam dışı işler

| Web kavramı | Gelecekte Unity sunum karşılığı |
| --- | --- |
| Saf navigation/modal reducer | Screen/Canvas koordinatörü ve doğrulanan UI komutları |
| Domain selector | Mevcut C# GameSessionController/Gameplay sonucu üzerinden salt view |
| Operation token/generation | CancellationToken veya explicit operation identity; makbuz ID'si ayrı |
| Tavik actorMode/pose | Portre UI / Animator adaptörü, mevcut onaylı clip adları |
| Committed coop stage | Başarılı profilden scene view; ikinci dünya veritabanı yok |
| DOM/history/focus/Worker | Platform adaptörleri; saf transition tanımlarına girmez |

Bu görev C# gameplay veya GameSessionController yeniden yazımı değildir. `Execute` ve `ProfileRepository.CompareExchange` sınırı korundu. Web'e UnityEngine bağımlılığı, yeni native kayıt biçimi, SDK veya Unity sahnesi eklenmedi. Fiziksel iOS/Android ve Unity/IL2CPP doğrulaması yapılmadı.
