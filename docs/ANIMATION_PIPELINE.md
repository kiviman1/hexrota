# Hexrota — committed hamlenin animasyon hattı

## Kapsam ve ön koşul

Bu hat `feature/hexrota-animation-pipeline-9-8` dalında, PR #27'nin birleştirildiği `ecba596cc0a31d65ddacac1a724e5286b99de735` main tabanından geliştirilir. F-01 yeniden uygulanmaz veya audit dalından taşınmaz. Önceki bulgunun sınırı [F01_PRESENTATION_PERSIST_FIX.md](F01_PRESENTATION_PERSIST_FIX.md) içindedir. Kaynak audit PR #26 ayrı bir dokümantasyon PR'ıdır; main'e birleştirilmiş varsayılmaz.

Amaç, mevcut JavaScript sunumunu düzenlemektir. Oyun motoru, kayıt şemaları, bölüm verileri, ekonomi, can ve C# çekirdeği bu hattın otoritesi değildir. PR #25'in `HexAppState` mimarisi korunur; yeni bir uygulama yöneticisi veya ikinci gameplay durumu eklenmez.

## Yetki ve sahiplik

| Sorumluluk | Sahip | Sınır |
| --- | --- | --- |
| Geçerli/geçersiz hamle, bütün eşleşmeler, puan, RNG, gravity/refill ve kazanma/kaybetme | Mevcut `HexMatch` / `HexAssistedGame` | Sunum hiçbirini tekrar hesaplamaz. |
| Attempt ID, ekonomi/can/terminal olay hazırlığı ve tek atomik kanonik commit | `app.js` içindeki mevcut domain/oturum çağrıları | İlk await'ten önce başarılı commit gerekir. |
| Requested/pending/terminal presentation işlemi ve türetilmiş input kilidi | Mevcut `HexAppState` / `HexStateSelectors` | Görsel faz, motor sonucu veya kalıcı durum değildir. |
| Resolved veriden salt plan, görsel faz sırası ve await/cancellation | `dist/move-presentation.js` | Motor, profil, economy, receipt veya persist fonksiyonu almaz. |
| SVG geometri, markup, karşılıklı swap yolları ve canlı düğüm uzlaştırması | `dist/board-view.js` | Kaynak/sonuç hareketleri motordan gelir; DOM adaptörü oyun kuralı üretmez. |
| Native animasyon handle'ları, AbortController, watchdog ve kesin son görünüm | `app.js` görsel adaptörleri | Temizlik, mevcut host yaşam döngüsüne bağlıdır. |
| Sayıların toplanması, toplamın HUD'a uçması ve görsel sayım | `dist/score-presentation.js` | Yalnız `job.scoreDisplay` ve DOM değişir; engine.score değişmez. |
| Tavik portresi, dünya aktörü ve kümes görünümü | Mevcut ortak presentation selector → scene/dialogue adaptörleri | Asset/poz tamamlanması ödül veya tutorial ilerlemesi üretmez. |
| Sonuç ekranının uygunluğu, modal ve navigasyon | Mevcut host / state-effects | Coordinator sonuç modalı açmaz. |

Motor **WON** veya **LOST** iken Core presentation işlemi hâlâ **PENDING**, türetilmiş görünüm **RESOLVING** olabilir. Bunlar farklı alanlardır. `SWAP`, `MATCH` gibi etiketler yalnız hangi görsel aşamanın gösterildiğini anlatır.

## Gerçek sıra

Başarılı normal veya assisted komut bütün motor dalgalarını senkron çözer ve mevcut atomik işlemle kaydeder. Başarılı commit sonrasında operation pending yapılır; salt before/final projeksiyonları ve resolved frame'ler sunuma verilir.

1. **SWAP:** Normal hamlede iki geçici taş mevcut üst SVG katmanında aynı anda karşılıklı hareket eder. Assisted komutta aynı giriş aşaması seçilen hücrenin kısa vurgusudur; sahte bir takas veya hamle oluşturmaz.
2. **MATCH:** Dalganın gerçek `frame.before` projeksiyonu ve eşleşen indeksleri gösterilir. İlk normal dalgada gerçek iki kaynak gem düğümü de yer değiştirir.
3. **CLEAR:** Matched taşların burst etkisi ve mevcut sayı toplama/puan paketi başlar. Matched indeksler ve puan `frame` içeriğinden gelir.
4. **FALL:** Gerçek `frame.after` ve ground layers monte edilir; hayatta kalan gem'ler motordaki `fall.from → fall.to` koordinatlarıyla hareket eder.
5. **REFILL:** `spawn:true` hareketler gerçek hedef ve spawn sıra verileriyle başlar. FALL ve REFILL ayrı semantik fazlardır ama animasyonları birlikte sürer; aralarında ek bekleme konmaz.
6. **CASCADE:** İkinci ve sonraki gerçek motor dalgalarının her biri için MATCH → CLEAR → FALL → REFILL tekrarlanır. Artık üçüncü ve sonraki dalgalar ikinci dalganın puan paketine sıkıştırılmaz.
7. **SETTLE:** Son salt projeksiyon gösterilir. Bu görünüm mevcut authoritative sonuca aittir; karıştırma olmuşsa son tahta ara dalgadan farklı olabilir.
8. **REACTION:** Mevcut host isteğe bağlı Tavik/feedback çağrısını yapar. Karakter animasyonu await edilmez; oyun devamının ön koşulu değildir.
9. **RESULT:** Mevcut host, uygun GAME ekranında ve pause/modal/hidden/suspension engeli yoksa terminal sonucu gösterir. Sonuç uygunluğu hâlâ gerçek motor durumuna dayanır.

REACTION ve RESULT coordinator'ın faz enum'unda veya ikinci bir state bölgesinde tutulmaz. Bunlar mevcut host sahipliğindeki sonraki etkilerdir. `board.dataset.presentationPhase/presentationWave` yalnız aktif görsel izdir; işlem temizlenirken kaldırılır ve kayda yazılmaz.

CLEAR'daki sayı toplama ve HUD uçuşu, board'un match/fall/refill etkileriyle örtüşür. Sonraki dalga, mevcut dalganın puan görevi ve düşüş beklemesi bittikten sonra başlar. Puan paketinin kendi mevcut sırası `collect → pop → fly → arrived` olarak korunur.

## Coordinator API

```js
const plan = HexMovePresentation.plan({
  before, final, frames,
  swap: [a, b],          // Assisted komutta null.
  assistance: null,      // Varsa {itemId, index}.
  motion
});

const outcome = await HexMovePresentation.play({
  plan, attemptId, token, signal,
  isCurrent(attemptId, token) { /* Host kimlik/token kontrolü. */ },
  canAnimate() { /* Mevcut motion/lifecycle politikası. */ },
  adapters: {swap, match, clear, fall, refill, settle, pause},
  onPhase(event) { /* Salt {phase, wave, attemptId, token} bildirimi. */ }
});
```

`plan()` accessor/serialization hook çalıştırmadan own-data girdileri kopyalar, şekil ve indeksleri doğrular ve planı derin dondurur. Bu, host'un engine/profile nesnesini dondurmak değildir. Girdi sonradan değiştirilse bile plan değişmez. `wave.before/after` mevcut score prefix'i, ground ve değer projeksiyonlarıdır; `frame` gerçek motor çıktısının kopyasıdır. `firstMoves` ilk normal dalga için karşılıklı `[from,to]` çiftlerini taşır.

Adaptör sözleşmesi:

- `swap(plan)` mevcut swap veya assisted pulse süresini kapsayan Promise döndürebilir.
- `match(wave)` görsel before projeksiyonunu gösterir.
- `clear(wave)` puan görevini başlatıp Promise döndürür; coordinator bu görevin reddini hemen gözler, fakat düşüşü başlatmadan tamamlanmasını beklemez.
- `fall(wave)` ve `refill(wave)` görselleri başlatıp en uzun süreyi milisaniye olarak döndürür.
- `pause(ms)` host'un mevcut abort edilebilir beklemesidir.
- `settle(plan)` yalnız final projeksiyonu gösterir.

Sonuç `{status, phase, wavesPresented, error?}` biçimindedir; `status` `succeeded`, `failed` veya `cancelled` olabilir. Bu sonuç ekonomik işlem, yeni motor komutu veya kanonik kayıt değildir. Host sonuçtan sonra mevcut `finishPresentation()` yoluyla temizlik ve uygun terminal sunumunu tamamlar.

## Kesinti ve hata davranışı

Her faz bildirimi ve her await dönüşü aynı Attempt ID/token ile güncellik ve AbortSignal kontrolünden geçer. Abort, hiç tamamlanmayan bir adaptör Promise'ini bekleyen coordinator'ı da serbest bırakır. Başlatılmış bir görsel adaptör kendi kaynaklarına sahiptir; native handle iptali, puan RAF/DOM temizliği ve scene/decode nesilleri ilgili mevcut sahiplerinde kalır.

| Durum | Davranış |
| --- | --- |
| Çözüm sürerken dokunma/hızlı tekrar | Mevcut input yolu committed sonucu gösterip **return** eder; yeni hamle çalıştırmaz. |
| Pause/Home/bölüm değişimi | Mevcut host görseli sonlandırır, token/epoch sınırını emekli eder ve uygun navigasyon/modal davranışını uygular. Bağımsız meşru kayıtlar korunur. |
| Sekme gizlenmesi/pagehide | Mevcut görünürlük/suspension işlemleri görselleri temizler ve eski terminal timer'ını engeller. Committed snapshot korunur; pagehide'in kendi checkpoint/life/rescue kayıtları görsel commit sayılmaz. |
| Native Animation API throw/reject | Optional sunum başarısız olur; host authoritative final görünümüne döner ve kontrolleri bırakır. `animation.finished` reddi gözlenir; zaten abort edilmiş handle'ın normal iptal reddi ikinci sonuç üretmez. |
| Eski token/Attempt callback'i | Sonraki faz, board güncellemesi veya modal açılışı için yetki vermez. |
| Reduced motion | Dekoratif swap/dalga beklemesi çalışmadan yalnız SETTLE yolu kullanılır. Aynı komut zaten kaydedilmiştir. |
| İlk authoritative kayıt hatası | Mevcut tam rollback korunur; görsel plan, başarısız işlemi başarıya çeviremez. |
| Son redraw hatası | F-01 koruması sürer: görsel hata kanonik persist/rollback veya `lifeWriteFailed` üretmez; mevcut finally temizliği çalışır. |

Kesintiyle hızlı final gösterimi, normal animasyonun bütün fazlarını tamamladığı iddiası değildir. Bu durumda host'un güvenli final redraw'u yapılır; eski phase izi temizlenir. Watchdog da motoru tekrar çalıştırmaz.

## Düğüm kimliği ve çizim düzeni

`HexBoardView.reconcile()` yeni markup'ı detached SVG içinde hazırlar ve açık hareket metadatasını canlı DOM'a dokunmadan doğrular. Uyumlu tahtada static cell/floor/defs/fx/swap katmanları korunur. Normal selection/HUD redraw'ları değerleri değişmeyen gem'leri yeniden yaratmaz.

İlk MATCH için gerçek iki kaynak gem karşılıklı taşınır. Her sonraki düşüşte survivor gem tam kendi `from` düğümünden `to` hücresine geçer; aynı sayılı taşlar da birbirinin yerine tahmin edilmez. Hareketsiz survivor aynı hücrede kalır. Eşleşip temizlenen gem çıkarılır; yalnız gerçek spawn veya değişen değer için yeni gem gerekir. Yeni attempt/topoloji veya final reshuffle başka bir görsel sahiplik sınırı olabilir.

Geçici swap taşları, statik zeminlerden bağımsız en üst çizim katmanında kalır. Boya/sayı stillerinin clone'a aktarılması, altıgen koordinatlar ve gerçek hareket yolları korunur. Puzzle için board veya HUD küçültülmez; tutorial coach, portrait/world-actor rezervasyonu ve mevcut dokunma hedefleri değiştirilmez.

## Tempo ve ölçüm sınırı

Bir ve iki dalgalı hamlelerde mevcut motion sabitleri aynıdır: swap300 ms, match430 ms, fall380 ms ve en fazla70 ms sütun gecikmesi. Puan toplama/uçuşunun mevcut bloklayan üst hesabı1280 ms/dalgadır. Görsel overlap nedeniyle süreler arka arkaya toplanmaz.

Üç ve daha fazla dalgada salt plan, dalga sayısına göre score/effect sürelerini aynı oranla kısaltır; survivor düşüşü en az280 ms kalır. Kullanılan oran mevcut motion girdileriyle hesaplanır:

```text
scoreDuration = digit + spread + pop + hold + flight + count
scale = min(1, max(1, budget - swap - 5 - 200) / (waveCount * scoreDuration))
watchdog = max(baseBudget,
  startDuration + waveCount * (max(pacedScoreDuration,
    pacedMatchPause + pacedFall + pacedFallStagger + 10) + 100) + 250)
```

Dalga başına100 ms ek pay yalnız watchdog içindir: detached çizim ve RAF ile nicelenen sayımın duvar saati maliyetini karşılar; animasyona bekleme eklemez. Bu planlayıcı hesabıdır; ölçülmüş tarayıcı performans sonucu değildir. Çok uzun zincirler, okunabilir minimum düşüş nedeniyle3300 ms'yi aşan watchdog bütçesi alabilir. Gerçek dalgalar gizlenmez veya aynı puan tekrar gösterilmez. Oyuncunun erken final gösterimi dokunuşu korunur.

Daha az canlı düğüm yeniden yaratılması, tek başına daha hızlı frame time veya daha düşük toplam maliyet kanıtı değildir. Detached markup parsing ve attribute diff hâlâ yapılır. Karşılaştırılabilir önce/sonra süre, RAF ve DOM ölçümleri, gerçek koşum sonuçları ve sınırlılıklar [ANIMATION_PIPELINE_TEST_REPORT.md](ANIMATION_PIPELINE_TEST_REPORT.md) içinde ayrı raporlanır.

## F-01 ve taşınabilirlik

Normal başarılı komutun kanonik profili mevcut authoritative sınırda bir kez yazılır. Coordinator bitişi, score arrival, Tavik tepkisi, SETTLE veya result modalı ikinci persist başlatmaz. `finishPresentation()` içinde persist yoktur. Ekonomi/can/receipt/tercih/navigasyon gibi bağımsız işlemlerin kendi kayıt yolları kaldırılmaz.

Saf plan ve sıra kavramları daha sonra Unity coroutine/animation adaptörüne eşlenebilir; bu çalışma mevcut C# gameplay/session sistemini yeniden uygulamaz. Browser DOM, WAAPI, ses ve asset adaptörleri saf planın dışındadır. Fiziksel cihaz/Unity/IL2CPP doğrulaması otomatik tarayıcı veya saf Node testiyle eşdeğer sayılmaz.
