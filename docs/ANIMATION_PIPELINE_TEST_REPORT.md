# Animation Pipeline 9.8 — uygulama ve doğrulama

## Referans ve kapsam

Dal: `feature/hexrota-animation-pipeline-9-8`. Başlangıç main: **`ecba596cc0a31d65ddacac1a724e5286b99de735`**, PR #27 merge commit'i. GitHub'da PR #27 `merged:true` doğrulandı; F-01 main'de zaten vardı. [PR #26 audit'i](https://github.com/kiviman1/hexrota/blob/a4bd5ba9c7fd1070e843780b67799a8e29e03d91/docs/GAME_CORE_PRESENTATION_AUDIT.md) ayrı, birleştirilmemiş kaynak olarak okundu; cherry-pick edilmedi.

Bu çalışma motor/state/ekonomi refaktörü değildir. `engine`, `commands`, state core/selectors/effects, SessionStore, saves, attempts, level/variant/tutorial verileri, rewards/adapter/audio, scene/Tavik/first-play, CSS/görseller ve C# kaynakları başlangıçla aynı tutulur. Kaynak karşılaştırması test kanıtının yerini tutmaz; ilgili gerçek koşumlar aşağıdadır.

## Gerçek mimari değişikliği

- `dist/move-presentation.js`: küçük, DOM'suz plan/sıra modülü. Bağımsız kopyalanmış/dondurulmuş resolved frame'ler, Attempt ID/token, AbortSignal ve dar görsel adaptörler alır; yalnız görsel sonuç döndürür.
- `app.js`: mevcut command→commit→pending sınırı, Core operasyonları, sahiplenilmiş native handle'lar, cleanup, final fallback ve sonuç uygunluğu kalır. `presentSwap` artık bu adaptörleri bağlar. Hiçbir callback motor/ödül/kayıt otoritesi olmaz.
- `board-view.js`: saf geometri/markup/paths aynıdır; `reconcile` gerçek swap/fall kaynaklarından survivor `.gem` düğümünü taşır ve statik hücre/zemin/katmanları korur.
- `score-presentation.js`: mevcut collect/pop/fly/arrived sırası korunur; dalga başına salt timing alabilir. Gösterilen skor, engine skoru değildir.
- Bir/iki dalganın motion değerleri korunur. Üçüncü ve sonraki dalgalar artık ikinci pakete eklenmez; her gerçek frame ayrı gösterilir. Uzun zincirde görsel tempo ölçeklenir, survivor düşüşü en az280 ms kalır; watchdog çizim payını da hesaba katar. Bu koruma payı yeni bekleme değildir.
- PWA42 yeni modülü defer/worker/cache/fixture hattına ekler; kayıt veya ürün sürümü değişmez. Yeni bağımlılık yoktur.

API, faz sırası, overlap ve sahiplik: [ANIMATION_PIPELINE.md](ANIMATION_PIPELINE.md). SETTLE/REACTION/RESULT otoriteleri farklıdır: coordinator SETTLE'ı bildirir ve mevcut host son görünümü çizer; host isteğe bağlı reaksiyon ve terminal modal uygunluğunu yürütür. Committed WON ile pending/RESOLVING birlikte kalabilir.

## Regresyon kapıları

| Kontrol | Kanıtlanan davranış |
| --- | --- |
| `check-move-presentation.cjs` | **34 grup:** gerçek1/2/5/10 dalga, exact faz sırası, own-data immutability, süre planı, bütün adaptör throw/reject'leri, abort ile tamamlanmayan Promise'den çıkış, eski Attempt/token ve reduced motion. |
| `check-board-reconcile.cjs` | **7 grup:** dört gerçek motor dalgası;25 moving survivor identity,16 refill node; floor/cell/defs/fx/swap korunması, strict before/after değerleri ve bozuk haritanın canlı DOM öncesi reddi. |
| `check-animation-pipeline-ui.cjs` | **11 gerçek-app grup:** her fazda aynı kanonik byte'lar,1 yazım, gerçek düşen/sabit/yeni taş kimliği, invalid0 yazım, ilk commit rollback, valid/invalid Animation.finished reddi, eski attempt callback'i, engellemeyen Tavik reddi, gerçek win/loss ve tek can. |
| Mevcut skor testi | **10 grup:** dört gerçek paket `[5,6,20,9]`, toplam40/final59, exact kaynak indeksleri, bütün arrival'lar ve monoton HUD; mevcut3600 ms kabul sınırı korunur. |
| Mevcut F-01 | **20 gerçek-app grup:** finisher0 ek yazım, armed quota fault'unun kullanılmaması, sonraki normal hamle, ilk hata rollback, assisted stok/replay/kimlik, terminal olay ve render arızası. |
| Mevcut swap lifecycle | **14 grup:** karşılıklı üst katman, reveal/cancel, yeni hareket sahipliği, görünürlük/navigasyon/resize, reduced motion ve kısmi API hatası. |

Grup, hareket, frame, assertion ve JSON karşılaştırması tek bir yapay toplamda birleştirilmez.

### Değiştirilen eski testlerin gerekçesi

Assertion düşürülmedi veya başarısız suite çıkarılmadı:

1. Eski skor testi dört motor dalgasını iki pakete sıkıştırmayı istiyordu. Yeni ürün talebiyle çelişen bu beklenti, dört ayrı exact paket/arrival/kaynak sayısı doğrulamasına **güçlendirildi**. Deadline ve final puan/monotonluk/değerler korunur.
2. F-01 render-fault testinin `#board.innerHTML` enjeksiyonu incremental renderer'da doğal olarak çalışmıyordu. Hata, gerçek renderer'ın oluşturduğu detached SVG'nin native `innerHTML` setter'ına taşındı. Renderer/finisher mock edilmez; `fault fired`, tek yazım, exact kayıt/event, next move/victory ve cleanup assertion'ları aynıdır. `#levels` enjeksiyonu değişmedi.
3. Eski rapid-swap testi her işte dış `.swap-layer` düğümünün de değişmesini varsayıyordu. Artık bu statik katman özellikle korunur. Kimlik karşılaştırması her işe ait gerçek `.swap-pair` düğümüne taşındı; eski callback'in yeni pair'i silememesi aynı güçte doğrulanır.
4. Görsel-tema hash korumasına yalnız iki açık dosya için yeni sabit hash overlay eklendi: `board-view.js`, `score-presentation.js`. 88 dosyalık mevcut hash kapsamı, domain/C# hash'leri,52 tahtanın markup/geometri goldens ve art hash'leri kaldırılmadı. SW normalizasyonuna yalnız yeni literal modül eklendi; yeni modülün defer/allowlist/sözdizim/sınır kontrolü ayrıca zorunlu.

## Testte bulunan ve giderilen sorunlar

İlk gerçek-app ve Chromium beş-dalga koşumları `REFILL5` sonrasında normal SETTLE yerine watchdog iptali gösterdi. Oyun zaten doğru kaydedilmişti; bir profil yazımı, exact snapshot ve haklar korunuyordu. Plan3350 ms veriyordu; ölçülen DOM/RAF yükü bazı dalgaları nominal559 ms yerine yaklaşık600–650 ms yapıyordu.

Watchdog'a **dalga başına100 ms çizim payı** eklendi. Animasyonlara veya puan beklemelerine yeni süre eklenmedi. Aynı strict all-wave/SETTLE assertion'ı ve4500 ms actual-app test deadline'ı ile11/11 geçti. Önceki başarısız koşum başarı diye sayılmadı. Çok uzun zincirlerde okunabilir280 ms düşüş ve tüm dalgaları gösterme, evrensel3300 ms tavanla aynı anda garanti edilemez; türetilen watchdog gerektiğinde büyür. Oyuncunun reveal dokunuşu daima korunur.

İlk tam `npm test`, mevcut reduced-motion pinch/giriş testinde senkron `aria-busy=false` sözleşmesini yakaladı. Yeni SETTLE adaptörünün pending sırasında yaptığı erken redraw bu attribute'u gereksizce `true` yapıyordu. Çift final redraw kaldırıldı: coordinator SETTLE'ı bildirir; authoritative final görünümünü **mevcut host finisher, operation settlement sonrasında** çizer. İkinci tam koşum, bu çizim kaldırıldıktan sonra da yeni coordinator await'lerinin eski reduced-motion öğretici onayını geciktirdiğini gösterdi. Animasyonsuz durumda eski `presentSwap` erken dönüşü aynen korundu; SETTLE/final redraw mevcut host'ta kalır ve dekoratif coordinator işi oluşturulmaz. Oyun/puan/kayıt değişmeden mevcut game-shell ve onboarding testleri aynı assertion'larla geçti. Saf coordinator'ın doğrudan reduced girdisi ayrıca SETTLE-only olarak test edilir.

Test harness'in ilk stale-attempt cleanup beklentisi, T1'e gidildiğinde mevcut öğretici gösteriminin kendi iki kaynağını gizlemesini eski animasyon artığı sayıyordu. Yeni test tam iki demo copy/source sahipliğini ayrıca doğrular; eski swap/score düğümü veya eski canonical/phase yazımına izin vermez.

## Ölçüm

Baseline, kod değişmeden `/tmp` altında değişmez dist kopyasında alındı. Native touch, aynı gerçek bir/beş-dalga fixture'ları,390×844, her full-motion senaryoda üç tekrar ve her reduced-motion senaryoda bir tekrar kullanıldı: iki tarayıcıda toplam16 koşum. Clock yalnız test bağlamında sabitlendi; gerçek platform saati politikası değiştirilmedi.

Önce/sonra hamle yazımları, authoritative snapshot, geometry, native animation çağrıları, busy süresi ve RAF aralıkları gözlenir. `renderCount`, eski yolda canlı board yazımını, yeni yolda reconciler çağrısını sayan **projeksiyon çağrısı** metriğidir; ayrı `boardRebuilds` canlı `#board.innerHTML` yazımını, `reconcileCalls` ise incremental adaptörü sayar. Bunlar toplam render/parse maliyeti değildir. `reusedGemNodes` farklı taş adedi değil, fazlar boyunca kümülatif reuse olaylarıdır. Eski beş motor dalgası koşumu yalnız iki dalga çiziyordu; yeni beş-dalga koşumuyla aynı miktarda görsel iş yaptığı iddia edilemez.

Aynı taşınabilir `npm run measure:animation` aracıyla baseline16 +candidate16 = **32 gerçek koşum** yeniden alındı; tümü exact snapshot/geometry,1 kanonik yazım ve revision+1 verdi. Ölçüm sırasında başka ağır test koşmadı; her runtime'ın başlangıç/bitiş kaynak hash'leri aynı kaldı. Son karşılaştırma: [reports/animation-pipeline-9-8.json](../reports/animation-pipeline-9-8.json).

| Tarayıcı / senaryo | Önce medyan busy | Sonra medyan busy | Önce→sonra gösterilen gerçek dalga |
| --- | ---: | ---: | --- |
| Chromium / tek dalga |1630,4 ms |1630,1 ms |1→1 |
| WebKit / tek dalga |1693 ms |1639 ms |1→1 |
| Chromium / beş motor dalgası |2922,9 ms |3246,4 ms |2→5 |
| WebKit / beş motor dalgası |3102 ms |3477 ms |2→5 |

Tek dalgada75 native animasyon çağrısı iki sürümde de aynıdır. Beş dalgada154→319 çağrı, artık beş dalganın tamamının gösterilmesine karşılık gelir. Tek dalgada4 canlı SVG yeniden kurulum yerine4 reconcile; beş dalgada6 yeniden kurulum yerine12 reconcile yapılır. **Yeni full-motion koşumlarında canlı board yeniden kurulum sayısı0**; statik hücre/zemin ve gerçek survivor identity korunur. Reduced motion iki sürümde de0 animasyon/1 projeksiyon verir; busy attribute aralığı gözlenmediği için süre `null` tutulur,0 ms diye raporlanmaz.

RAF maksimumları tek dalgada Chromium83,3→183,3 ms, WebKit268→273 ms gibi değişkendir; uzun zincirde iş yükü de farklıdır. Üç tekrarlı paylaşımlı headless örnekten FPS, enerji veya genel hızlanma sonucu çıkarılmıyor. Yeni beş-dalga koşumlarının hepsi normal `succeeded` sonucu verdi; watchdog ile kısaltılan animasyon başarı sayılmadı.

Yeniden üretim: aynı checkout'taki ölçüm aracıyla `HEXROTA_BENCH_ROOT=/path/to/baseline/dist HEXROTA_BENCH_OUT=... npm run measure:animation`, ardından ROOT=candidate/dist. Ayrı historical dist için aynı fixture'lar, tarayıcı binary'leri,390×844, örnek sayısı ve idle-host koşulu kullanılmalıdır. `HEXROTA_BENCH_SAMPLES` ve `HEXROTA_BENCH_BROWSERS` seçenekleri yardımcı script'in başında belgelenir.

Bu paylaşımlı headless ortam fiziksel mobil FPS/enerji/bellek ölçümü değildir. Daha az canlı SVG yeniden kurulumundan tek başına performans iyileşmesi sonucu çıkarılmaz. Trace'ler anlamlı iş yükü farkını da içerir.

## Gerçek tam doğrulama

| Koşum | Gerçek sonuç |
| --- | --- |
| Son `npm test` | **Exit0**, bütün mevcut zincir + yeni animasyon testleri.40 varyant/80 rota/600 restore;10.240 deterministik bot denemesi yeniden doğrulandı. |
| `test:state` | Tam npm zincirinde geçti; mevcut Core/selectors/effects ve actual-app guard/lifecycle assertion'ları açık. |
| `test:animation` | **34 +7 +11 grup**, gerçek exit0; test birimleri ayrı tutulur. |
| Mevcut F-01/score/swap lifecycle | Tam zincirde **20 /10 /14 grup** geçti; hiçbir suite kaldırılmadı. |
| Yeni `test:animation-browser` | **Chromium23/23 +WebKit23/23**, filtresiz, her biri exit0 ve sıfır pageerror. |
| Mobil/landscape | İki motorda320×568,390×844,430×932,844×390,932×430,1280×720; exact before/during/after board/HUD kutuları, boyalı son değerler, gerçek fall/refill yolları ve stone identity. |
| Native browser tehlike senaryoları | Invalid, ilk kayıt hatası, gerçek win/loss, reduced motion, erken reveal/sonraki dalgada reveal, Animation API throw/reject, Pause/Home/hidden, eski Attempt callback'i ve geciktirilmiş **gerçek** eski sonuç teslimi, WON+pending sırasında actual reload, T1/T2/portrait/coop/eksik asset fallback geçti. |
| C# | Aşağıdaki10 gerçek komut geçti; son session testi nihai runtime sabitken ayrıca yeniden çalıştırıldı. |

Son yerel runtime SHA256: app `970e3ea2c1b7867faa4bc5573929d2185a5b96e1329bbc188338cfce149e280f`, coordinator `c857b988264baeddee771cdbd76fdc4c318a21e096fff74d7dc926cf1b94e29c`. Browser sonucu `test-results/animation-pipeline-{chromium,webkit}/results.json`; screenshot'lar aynı klasörlerde. CI bu klasörleri artifact olarak saklar.

Mevcut17 GitHub Actions işi ve bütün önceki adımlar korunur. Yeni Node kontrolleri `npm test`te, yeni23 senaryo ise mevcut iki Application state browser işinde çalışır. Eski mobile/swipe/pixel/scene/offline, life/save/two-tab, observable audit ve Lab isolation işleri etkin kalır. **Nihai head'in CI sonucu ve eski browser koşumlarının güncel kanıtı PR açıklamasındaki teslim kaydındadır**; workflow tanımı veya bir test referansı kendi başına başarı iddiası değildir.

Gerçek C# .NET8.0.428/C#7.3 ile on komutun tamamı exit0: rewards104 vektör, gameplay1.913 valid swap/80 rota, catalog2.107 JSON, hints1.000, reward adapter175 rota/1.456 tur/2.928 wave, lives344 request/460 transition, economy579 comparison, commands2.928 comparison/16.001 step, rescue293 comparison/600 lifecycle, session1.362 +events580 JSON/36 actual-app flow/56 native fault-guard. JS fallback yok. Session testi son runtime sabitken çalıştı; C# kaynak hash'i baştan sona değişmedi.

## Teslim ve sınırlar

Tek uygulama PR'ı main'i hedefler; PR bağlantısı, exact head için GitHub CI ve Vercel Preview dağıtım/remote smoke sonucu PR açıklamasındaki teslim kaydında tutulur. Preview yalnız bu feature dalına aittir. Production'a deploy/promote veya kullanıcı onayı olmadan merge yapılmaz.

Değişen dosya grupları:

- Runtime: `app.js`, `board-view.js`, `score-presentation.js`, yeni `move-presentation.js`.
- PWA/fixture: `index.html`, `sw.js`, `hint-worker.js`, `ui-kit.html`, `qa-fixtures.cjs`.
- Yeni testler: `check-move-presentation.cjs`, `check-board-reconcile.cjs`, `check-animation-pipeline-ui.cjs`, `check-animation-pipeline-browser.cjs`.
- Mevcut testlerin açık sözleşme güncellemeleri: `check-score.cjs`, `check-swap-lifecycle.cjs`, iki `check-f01-*`, `check-comic-ui.cjs`, `scripts/check-architecture.cjs`; dar hash overlay `fixtures/animation-pipeline-protected.json`.
- Komut/CI: `package.json`, `.github/workflows/ci.yml`; yeniden üretilebilir ölçüm: `measure-animation-pipeline.cjs` ve aşağıda bağlantılı ölçüm raporu.
- Belgeler: `ARCHITECTURE.md`, `ANIMATION_PIPELINE.md`, bu rapor.

Fiziksel iPhone/Android, native BFCache ve Unity/IL2CPP test edilmedi. Sentetik hidden/pagehide ile gerçek HTTP reload ayrı kanıtlardır. Görsel hata halinde fall/score akışı güvenli final redraw'a kısalabilir; bu normal tamamlanmış animasyon sayılmaz. Kalıcı kayıt arızası ilk komut sınırında hâlâ gerçek rollback'tir.

Yeni koordinatör UI store veya persistence layer değildir. Commit sonrası animasyon, Tavik, reaction, SETTLE ve sonuç modalı hiçbir kalıcı hak üretmez. Production yapılandırması değiştirilmez ve PR kullanıcı onayı olmadan birleştirilmez.
