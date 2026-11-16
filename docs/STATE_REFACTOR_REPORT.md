# Durum mimarisi refaktörü — uygulama ve doğrulama raporu

## Kapsam

Başlangıç `main`: `996462b8513cfbdbe2747941c0aad76528357842` (PR #24 dahil). Dal: `refactor/hexrota-state-architecture`. Aşağıdaki değişiklikler ekran/sunum sahipliğini düzenler; oyun, ekonomi ve kalıcı kayıt yöneticileri yeniden yazılmadı. Bu rapor gerçek yerel sonuçları kaydeder; GitHub kontrolleri ve Preview ayrıca PR üzerinde doğrulanır. Main'e doğrudan yazılmaz, otomatik merge açılmaz.

| Aşama | İncelenebilir commit / sonuç |
| --- | --- |
| A — Envanter, geçiş matrisi, gerçek uygulama karakterizasyonu | `8fe2e7f`; runtime değişmeden 11 grup. |
| A — Gerçek tarayıcı baseline'ı | `3509f58`; Chromium ve WebKit 19'ar grup, altı viewport. |
| B — Saf çekirdek ve selector | `ed14aeb`; uygulamaya bağlamadan bağımsız test edildi. |
| C — Ekran ve modal koordinasyonu | `a6daca1`; mevcut native dialog ve transaction içleri korunarak adaptör bağlandı. |
| D — Öğretici, Tavik ve dünya projeksiyonu | `0c41663`; tek actor-form politikası ve committed tutorial view. |
| E — Async görsel/hint yaşam döngüsü | `4176aa9`; commit sonrası pending, türetilmiş busy, suspension ve stale-result koruması. |
| F — Konsolidasyon ve son doğrulama | Full reset sonrası recurring timer cleanup; yeni browser CI matrisi; nihai dokümantasyon ve regresyonlar. |

## Başlangıçta bulunan sorunlar ve gerçek düzeltmeler

Tam envanter [STATE_ARCHITECTURE.md](STATE_ARCHITECTURE.md), sınırlar [STATE_TRANSITION_MATRIX.md](STATE_TRANSITION_MATRIX.md), aşamalar [STATE_MIGRATION_PLAN.md](STATE_MIGRATION_PLAN.md) içindedir.

| Şiddet / bulgu | Tekrarlanabilir başlangıç davranışı | Son durum |
| --- | --- | --- |
| Medium — geçersiz navigasyon güvenli no-op değildi | Bilinmeyen `data-nav`, Home'a dönüp modal/iş temizliği, persist ve history etkilerini çalıştırabiliyordu. | Hedef, herhangi bir iptal/yazma/render etkisinden önce doğrulanır. Geçersiz olay ekranı, SVG'yi, kaydı ve URL'yi değiştirmez. |
| Medium — bağımsız modal birleşimleri | Gizli programatik DOM komutları Settings/Inventory/preview kombinasyonlarını açabiliyor, reddedilmesi gereken stage isteği `pendingStage` bırakabiliyordu. | Kimlik/ekran/ebeveyn politikası ve instance kontrolü eklendi. Gizli Başla komutu yalnız etkin pregame modalına ait geçerli pending stage ile çalışır. |
| Medium — aynı durumun ayrı mutable sahipleri | `screen`, `paused`, `modalStack` ve native close işleyicileri eşleştiriliyordu. | Ekran/yığın Core; DOM/focus/native close Effects; pause ve busy selector üzerinden türetilir. |
| Medium — retired belgede gecikmiş sonuç UI'sı | Gerçek son L1 hamlesinin commit'inden sonra, görünürlük değişmeden sentetik `pagehide.persisted` gönderildiğinde +150 ms sonra win modalı açılıyordu. | Pagehide committed görseli tamamlar, hint'i/timer'ı iptal eder, epoch ve operation generation'ını geçersizleştirir, sunumu suspend eder. Aynı kayıt/ödül korunur, eski sonuç penceresi açılmaz. Native BFCache/iPhone hatası iddiası değildir. |
| Medium — Tavik form kararı dağınıktı | Portre güncellemesi ile sahnenin `tutorialPortrait` girdisi ayrı hazırlanıyordu. PR #24 görünür çift-actor hatasını zaten düzeltmişti. | `projectPresentation` ortak karar üretir; `syncScene` iki modülü besler. Terminal/hidden coach sırasında da tutorial portrait rezervasyonu korunur. Yeni main görünürlük hatası bulunduğu iddia edilmez. |
| Low — kaynak ve input guard'ları dağınıktı | Animation/Worker/timer/epoch ve alan kontrolleri host'a dağılmıştı. | İki gerçek UI operation türü kimliklendirilir; yeni hamle ve board-routing guard'ları ayrılır. Başarılı full reset eski iki recurring timer'ı temizler. |

Baseline üzerinde **yeni ekonomik bozulma, çift can kesintisi veya çift hamle hatası yeniden üretilmedi**. Mevcut CAS, Web Lock, replay ve tekil makbuz kuralları korunur.

`check-state-guards.cjs` baseline'da **2/8**, düzeltme sonrası **8/8** geçti. Altı kırmızı kontrol geçersiz hedef, etkin olmayan GAME, iki ters Settings/Inventory birleşimi ve iki stale-stage başlatmasıdır. `check-state-lifecycle.cjs` baseline'da kırmızı, son sürümde yeşildir. Bu başlangıç başarısızlıkları gizlenmedi.

Yeni çekirdek entegrasyon öncesinde de sertleştirildi: kalıtılmış `toJSON`/getter hook'ları çalıştırılmaz; zorunlu ebeveyn kapanışı orphan modal bırakamaz; native ebeveyn kapanışı özgün instance sırasıyla onarılır; subscriber içinde convenience operation başlatma sahipsiz queued token üretmez. Bunlar eski main'in ekonomik açıkları değildir.

## Alan sahipliği ve yeni modüller

| Alan | Yetkili sahibi / sınır |
| --- | --- |
| Beş ekran: home/game/journey/records/garden | `HexAppState.navigation`; Settings modal olarak kalır. |
| Modal instance/yığın/topoloji | `HexAppState.overlays`; native düğüm, focus, history ve close onayı `HexStateEffects`. |
| Lifecycle ve iki transient operation | Core hidden/suspended ile presentation/hint token'larını tutar; engine, receipt veya DOM tutmaz. |
| Gameplay fazı ve input | Selector her çağrıda gerçek engine/attempt/write facts'ini okur; ikinci oyun motoru yoktur. |
| Tavik/diyalog/dünya | `projectPresentation` → tek `syncScene` sahibi; mevcut pose/decode/animation sahipleri korunur. |
| Board/skor/RNG/zemin/turn/sonuç | Mevcut `HexMatch` / `HexAssistedGame`. |
| Bölüm/varyant/Attempt ID | Mevcut katalog ve `HexAttempts`. |
| Altın/yıldız/stok/kalıcı tamamlama | Mevcut `HexEconomy`. |
| Can ve kurtarma/makbuz | Mevcut Life/Rescue/provider/verifier sistemleri. |
| Kalıcı atomik profil | Mevcut `HexSessionStore`; UI reducer storage'a erişmez. |

- `dist/app-state.js`: saf transition, dar payload/event kataloğu, guard, immutable snapshot, FIFO dispatch, subscribe/destroy ve stale operation kimlikleri.
- `dist/state-selectors.js`: faz, input, committed tutorial progress, dünya/actor/portrait projeksiyonu. Domain nesnelerini saklamaz veya dondurmaz.
- `dist/state-effects.js`: mevcut ekran/dialog DOM'u, browser history, instance-aware close/focus, kontrollü callbacks ve cleanup. Domain cleanup mevcut `sessionAction` bariyerinde çalışır; grant/receipt/commit içermez.

Toplam üç runtime dosyası yaklaşık 43 KB kaynak (minify/gzip öncesi) ekler; yeni npm bağımlılığı veya framework eklenmez. Ayrı `state-adapters.js` sırf dosya sayısı için üretilmedi.

## Konsolidasyon ve commit sınırı

Bağımsız mutable `screen`, `paused`, `modalStack`, `busy` kaldırıldı. `appScreen`, `appPaused`, `appBusy` salt Core/selector okumasıdır. Genel dialog close ile iki provider close listener'ı tek instance-aware `modalClosed` sahibinde birleşir. Portre ve sahne ortak projeksiyon alır. Kapanış timer'ları ve hint completion kimlikleri mevcut epoch/engine/worker guard'larıyla birlikte çalışır.

İstek rezervasyonu yalnız input kilididir: **requested → PLAYING** (aday engine terminal olsa bile), **başarılı canonical commit → pending/RESOLVING**, sonuç veya güvenli iptal sonrası gerçek engine fazı. `isResolving` API adı requested+pending kilidini kapsar; `gameplayPhase` semantik farkı korur. Görsel token üretilemezse doğrulanmış komut ve ödül geri alınmaz; committed görüntü hızlıca gösterilir. Animasyon callback'i oyun komutu çalıştırmaz.

`epoch`, animation handle `presentation`, Worker `hintJob`, pointer/selection, `activeAttempt`, `attemptPending`, `saveBlocked`, `firstOpening`, `committedSceneGame`, pending request/receipt context'leri ve transaction baseline'ları bilinçli olarak yerinde kaldı. Bunlar tek bir evrensel UI snapshot'ına kopyalanmaz. Özellikle doğrulanmış fakat henüz yazılamamış receipt, navigasyon iptaliyle kaybedilmez. `fullResetPending` yalnız başarılı geri alınamaz canonical reset sonrasında eski belgeyi kapatır; başarısız reset refresh timer'larını veya geçerli profili silmez.

## Tam dosya listesi

Baseline'a göre 27 dosya:

| Grup | Dosyalar |
| --- | --- |
| Yeni runtime | `dist/app-state.js`, `dist/state-selectors.js`, `dist/state-effects.js` |
| Host | `dist/app.js` |
| PWA/yükleme/fixture | `dist/index.html`, `dist/sw.js`, `dist/hint-worker.js`, `dist/ui-kit.html`, `qa-fixtures.cjs` |
| Komutlar/CI/sınır kontrolleri | `package.json`, `.github/workflows/ci.yml`, `scripts/check-architecture.cjs`, `check-comic-ui.cjs`, `check-lives-ui.cjs` |
| Yeni testler | `check-app-state.cjs`, `check-state-selectors.cjs`, `check-state-effects.cjs`, `check-state-characterization.cjs`, `check-state-guards.cjs`, `check-state-operation-ui.cjs`, `check-state-lifecycle.cjs`, `check-state-browser.cjs` |
| Belgeler | `docs/ARCHITECTURE.md`, `docs/STATE_ARCHITECTURE.md`, `docs/STATE_TRANSITION_MATRIX.md`, `docs/STATE_MIGRATION_PLAN.md`, `docs/STATE_REFACTOR_REPORT.md` |

PWA v40 yalnız yeni üç runtime modülünü tutarlı offline allowlist/defer/fixture hattına ekler. `check-comic-ui.cjs` dondurulmuş SW kapsamında yalnız bu üç açık literal'i normalize eder; 88 korunan dosyanın kalan hash'i veya eski assertion'lar gevşetilmez. `check-lives-ui.cjs` isteğe bağlı test-only `beforeApp` gözlem kancası alır; default davranışı değişmez.

`engine`, commands, attempts, level/tutorial/variant data, game-save, SessionStore, economy, lives, rescue, reward/adapter, board/input/score, first-play, scene/portrait, events, garden modülleri; bütün C# kaynakları, stiller/görseller, `package-lock.json` ve Vercel yapılandırması baseline ile aynıdır. `hexrota-profile-v2`, `hexrota-match-v5`, Snapshot v4, assisted command sürümleri, Attempt metadata v1 ve LifeState v2 değişmez.

## Gerçek doğrulama sonuçları

Grup, assertion, vektör, route ve JSON karşılaştırmaları ayrı birimlerdir; tek hayali test toplamına eklenmez.

| Kontrol | Sonuç |
| --- | --- |
| Başlangıç `npm test` | Geçti; runtime değişmeden referans kaydedildi. |
| Son tam seri `npm test` | **Geçti, exit 0**. Eski zincirin tamamı ve yeni `test:state` açık. 40 varyant, 80 sertifikalı rota, 600 restored checkpoint korunur. |
| Son `test:state` | Core **19 grup / 1.861 assertion**; selectors **19**, effects **15**, actual-app karakterizasyon **11**, guard **8**, operation UI **4**, lifecycle **1** grup geçti. |
| Gerçek Chromium/WebKit state geçişleri | **25/25 + 25/25 geçti**, sıfır pageerror. Altı viewport, tarayıcı başına 12 board box ölçüsü main ile **0 px fark**, coach **118 px**. Gerçek stopped-origin offline reload; sentetik hidden/pagehide testleri native cihaz testi diye sunulmaz. |
| Gerçek .NET parity | **10 komutun tamamı geçti**, SDK **8.0.428 / C# 7.3** gerçekten derlendi; aşağıdaki karşılaştırma tablosu. |
| Diğer gerçek browser / observable | Eski CI işleri korunur ve PR üzerinde çalıştırılır. Observable invariant kontrolü 80 board / 1.920 gizli-RNG karşılaştırması / 160 sampled decision geçti; tam rapor tekrar üretimi ve eski browser suite sonuçları PR doğrulama kaydında ayrıca belirtilir. |

| C# komutu | Gerçek karşılaştırma kapsamı |
| --- | --- |
| `test:unity-rewards` | 104 ortak vektör + factory; 98 valid / 7 rejected. |
| `test:unity-gameplay` | 71 mekanik örnek, 80 tam certified route, 120 off-route run; 1.913 valid swap, 256 resume, 260 replay, 2.172 clone; bütün ara dalgalar eşit. |
| `test:unity-catalog` | 2.107 complete JSON; 725 selection, 610 resume; 40 varyant / 80 rota. |
| `test:unity-hints` | 1.000 karşılaştırma; 680 published route state, 280 search state, 11 clock policy; her garanti bağımsız win replay ile doğrulandı. |
| `test:unity-reward-adapter` | 175 route, 1.456 turn, 2.928 wave, 1.564 restore/replay. |
| `test:unity-lives` | 19 ortak + 1 stress senaryosu / 460 transition; 152 frozen-v1 migration, 172 ek probe. |
| `test:unity-session` | Event 580 complete JSON / 462 ret mesajı; session 1.362 complete JSON, 36 gerçek app akışı, 56 native fault/guard. |
| `test:unity-economy` | 125 akış / 579 complete result+state. |
| `test:unity-commands` | 2.928 comparison, 16.001 step, 3.259 wave; 80 certified route / 680 legacy prefix. |
| `test:unity-rescue` | 293 comparison; 12 frozen case + 600 compiled lifecycle transition. |

Eski 15 GitHub Actions işi ve adımları değiştirilmeden korunur. İki yeni gerçek browser işi (`Application state in chromium/webkit`) eklenir; `test:state` mevcut `npm test` zincirine dahildir. Toplam **17 CI işi** beklenir. Her C# işinde .NET SDK kurulumu ve gerçek derleme korunur. Nihai head'in check sonucu PR Checks sekmesinden, Preview git SHA/READY durumu Vercel'den doğrulanır; kaynak raporu henüz alınmamış bir sonucu geçti diye saymaz.

Geliştirme sırasında ilk geniş koşumda yeni üç SW asset'i eski kapsam hash'iyle çakıştı; yalnız dar allowlist normalizasyonu eklendi. Paralel C koşumunda mevcut input survivor-fall zaman sınırı bir kez başarısız oldu; aynı assertion tek başına ve seri tam koşumda geçti. E'de mevcut score long-chain zaman testi bir kez başarısız oldu; nedeni kanıtlanmadı, aynı kaynak üzerinde tek başına ve son seri tam `npm test`te geçti. Eşikler, gameplay veya assertion'lar değiştirilmedi.

## İnceleme ve Preview

- Integration PR: https://github.com/kiviman1/hexrota/pull/25
- Nihai head için CI: https://github.com/kiviman1/hexrota/pull/25/checks
- Dalın Vercel Preview alias'ı: https://hexrota-git-refactor-hexrota-518689-kivanc-tascioglu-s-projects.vercel.app

Alias dalın son Preview'ına ilerler. Korumalı dağıtıma erişim için Vercel'in mevcut kimliği/paylaşım akışı kullanılır; Production veya deployment protection ayarı değiştirilmez. Otomasyonun access token/share cookie'si kaynaklara veya test artifact'larına yazılmaz. Son head, READY/Preview target ve oynanabilirlik teslimde ayrıca doğrulanır.

Ortam yeniden başlatılması, tamamlanmış npm/state/C# sonuçlarından sonra başlamış yerel ek browser/observable süreçlerini kesti. Kesilen koşumlar başarı sayılmaz; yeniden çalıştırılan yerel sonuçlar ve kesintiden etkilenmeyen GitHub CI sonuçları PR doğrulama kaydında ayrılır.

## Kalan sınırlar ve Unity

- UI host domain komutlarını/rollback'i bağlamaya devam eder; SessionStore, receipt doğrulaması veya C# `GameSessionController` yeniden tasarlanmaz.
- İki UI operation türü gerçekten ortak input/screen yaşam döngüsü gerektirir. Profile write senkron mevcut transaction içinde, provider/earned receipt mevcut domain sahibinde, asset decode mevcut modül generation'ında kalır. Her async işi ikinci bir operation/veritabanı otoritesine çevirmemek bilinçli sapmadır.
- Dünya `0/1/2` doğrulanmış öğretici → FOUNDATION/FRAME/FINISHED'tır. Tahta/Çivi committed turn sunumudur; kampanya yıldızı, yeni inventory veya ikinci kalıcı dünya kaydı eklenmez.
- Unity daha sonra bu transient kavramları Canvas/screen ve Animator adaptörlerine eşleyebilir. Saf transition'lar browser/UnityEngine kullanmaz; mevcut C# gameplay/ekonomi tekrarlanmaz.
- Fiziksel iPhone/Android, native BFCache davranışı, Unity Editor ve IL2CPP testi yapılmadı. WebKit masaüstü otomasyonu bunların yerine geçmiş sayılmaz.
