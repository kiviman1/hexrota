# Hexrota 9.2 — can ve güvenli kayıt sözleşmesi

## Kapsam ve önceki kararın değişmesi

9.1, 9.0 ekonomi tasarımındaki “can/enerji kapısı yok” önerisini değiştirir. Ana bölüm denemeleri artık can koşuluna tabidir. Öğreticiler, kayıttan devam, ipucu ve varyantların ücretsiz kazanma yolları korunur. Bu bir oyun motoru kuralı değildir: `classic-v4` motoru, snapshot v4, bölüm/veri sürümleri ve `hexrota-match-v5` ilerleme kaydı değişmez.

`dist/lives.js` saf can yöneticisidir. DOM, zamanlayıcı, cihaz saati API'si, ağ ve localStorage çağırmaz. UTC zamanı dışarıdan verilen clock ile alır. Uygulama saklama, ekran ve test sağlayıcısı bağlantılarını kurar. Unity'de aynı veri ve zaman girdileriyle aynı geçişler üretilmelidir; mevcut depoda C# LifeManager uygulaması bulunduğu iddia edilmez.

Gerçek ödeme veya canlı reklam SDK'sı yoktur. Webdeki reklam, Altın ve satın alma araçları açıkça geliştirme/test amaçlı sahte işlemlerdir. Yerel doğrulayıcı gerçek para veya gerçek reklam güvenliği sağlamaz.

## Dondurulan kurallar

| Durum | Sonuç |
| --- | --- |
| Yeni oyuncu veya geçerli eski ilerlemenin ilk can geçişi | 5 can. Önceki kayıplar geriye dönük ücretlendirilmez. |
| Azami can | 5; ödül, yenilenme veya doldurma bu sınırı aşamaz. |
| Yeni ana bölüm denemesi | Can > 0, etkin sınırsız can veya geliştirici geçişi gerekir. Başlangıçta can kesilmez. |
| Ana bölüm kaybı | Deneme kimliği başına en fazla bir can; geçerli koruma/sınırsız/geliştirici istisnası uygulanır. |
| Kazanma | Can tüketmez. |
| T1/T2 | Her zaman ücretsiz, can kapısına girmez. |
| Geçerli kayıtlı oynanır denemeye devam | Can 0 iken de mümkündür; doğrulanmış kayıt, varyant ve RNG aynen açılır. |
| Oyun ortasında yeniden başlatma | En az bir geçerli takas yapılmışsa açık onaydan sonra deneme başına en fazla bir can kesilir ve eski deneme kapatılır. |
| İlk takastan önce yeniden başlatma | Can harcamaz; yeni ana deneme açılacağından 0 can kapısı yine geçerlidir. |
| İptal, ön izleme, menü, duraklatma, kapanma, bağlantı kaybı | Can tüketmez. |
| Yenilenme | Eksik her can için 30 dakika; uygulama kapalıyken geçen süre de hesaplanır. |
| 5 cana ulaşma | Normal yenilenme durur; fazla süre biriktirilmez. Önceden tamamlanan doğrulanmış reklamın +1 ödülü ayrı bekleyen hak olabilir. |

“Geçerli takas” motorun `history` günlüğüne yazdığı hamledir. Taşa dokunmak, geçersiz takas veya ipucu istemek yeniden başlatma ücretini doğurmaz.

## UTC ve yenilenme hesabı

Bütün zamanlar UTC milisaniye cinsinden güvenli tamsayıdır. `1800000` ms bir can aralığıdır. Her açık yönetici işlemi zamanı bir kez okur ve o geçişte aynı UTC anını kullanır. Açılış, uygulamaya dönüş ve işlem öncesinde geçen süre uzlaştırılır; saniyelik ekran sayacı kuralı veya RNG'yi yürütmez.

İlk can eksildiğinde yenilenme başlangıcı kaydedilir. Sonraki kayıplar bu başlangıcı ileri taşımaz. Geçen tam 30 dakikalık aralıklar mevcut eksiğe kadar eklenir; tamamlanmamış aralık sonraki can için korunur. Örneğin 0 candan 150 dakika sonra 5 can olur. 29 dakika tek başına can vermez; 30. dakikada bir can verir.

Bir can reklamı veya tek can alımı sürmekte olan sayacı sıfırlamaz. Örneğin 3 can ve sonraki cana 5 dakika varken +1 ödül alınırsa sonuç 4 can ve yine 5 dakikadır. Ödül 5'e tamamlarsa normal üst sınır kuralı uygulanır: sayaç durur. Doldurma da 5 yapar; yeniden can eksilirse o andan yeni aralık başlar.

Görülen zaman geriye alınırsa etkin zaman son kaydedilen UTC anından geriye gitmez. Geri alma canı azaltmaz, önceden verilmiş canı geri çekmez, bitmiş sınırsız hakkı yeniden açmaz ve reklam beklemesini kısaltmaz. Saat yakalayana kadar etkin süre ilerlemeyebilir. Saatin ileri alınması yerel prototipte süre ödülü doğurabilir; bu sınırlama gizlenmez. Cihaz saati güvenilir reklam, ödeme veya mali hak doğrulaması değildir.

## Sınırsız can

`unlimited_lives_30m` doğrulanmış işlemde 30 dakika verir. Etkin hak varken yeniden alınırsa bitiş `max(etkinŞimdi, eskiBitiş) + 30 dakika` olur. Aynı işlem bildiriminin tekrarı süreyi tekrar uzatmaz.

Sınırsız hak normal bakiyeyi zorla 5 yapmaz. Normal yenilenme kendi başlangıcıyla aynı anda devam eder. Ana bölümde `registerAttempt` başlangıç anında `unlimitedAtStart` hakkını kaydeder. Bu işaret yeniden yükleme ve süre bitişinden sonra da korunur. Böyle başlatılan denemede kayıp veya onaylı yeniden başlatma normal canı azaltmaz; denemenin yaşam döngüsü yine bir kez sonuçlandırılır. Hak bittiğinde yeni denemeler normal bakiyeye bakar; 0 ise yalnızca yeni ana deneme engellenir. Önceden sınırsız hakla başlayan kayıtlı deneme ücretsiz korunur. V1 kayıtta başlangıç zamanı/hakkı yoktur; geçişte açık deneme bir kez mevcut hakla kaydedilir. Bitmiş eski bir sınırsız dönemi tahmin ederek geriye dönük hak üretilmez.

## Deneme başına tek sonuçlandırma

Öğreticiler daima ücretsiz olduğundan web adaptörü onlar için başlangıç hakkı kaydı açmaz; tekrarlanan öğretici açılışları sahipsiz başlangıç kayıtları biriktirmez.

Can işlemi, motordaki tur veya olay tamponu yerine gerçek `attemptId` ile tekilleştirilir. Motor sonucu animasyondan önce kesinleştiği için can sonucu da animasyon callback'inden türetilmez. Aynı kayıp bildirimi, sonuç ekranı, yeniden yükleme veya geç gelen callback ikinci can kesmez.

Geçerli hamle yapılmış ve 1 can kalmış denemede onaylı baştan başlama şu sıradadır:

1. Onay anındaki gerçek deneme ve can durumu doğrulanır.
2. Eski deneme bir kez sonuçlandırılır; can 0'a iner ve deneme yeniden devam ettirilemez olarak işaretlenir.
3. 0 canla yeni varyant/Attempt ID seçilmez. Bekleme ve test ödülü seçenekleri açılır.
4. Daha sonra can kazanılınca yeni deneme açılır. Eski ham snapshot kurtarma amacıyla saklanabilse de kapatılmış kimlik “Devam et” ile ücretsiz yeniden açılmaz.

0 canla mevcut oyuna devam edebilmek, o oyunu baştan başlatma sözü değildir. Oyuncu 0 canla oynanmış oyunu sıfırlamayı açıkça onaylarsa eski kimlik `empty` muafiyetiyle hemen kapatılır; bakiye negatif olmaz ve can borcu tutulmaz. Yeni deneme can gelene kadar bekler. Daha sonra kazanılan bir can, kapanmış eski denemeden tekrar kesilmez. Onay iptal edilirse veya yalnızca yeni deneme kapısına takılınırsa mevcut oynanır kayıt kapatılmaz; kaldığı yerden devam edebilir.

Onay ekranı açıkken can yenilenebilir. Başlangıçta kaydedilmiş sınırsız hak süre bitse de korunur. İşlem anındaki maliyet, gösterilip onaylanan tutardan büyük olursa can kesilmeden açıklama güncellenir ve yeniden onay istenir. Bu kural tek denemeyi başlatma ve bütün ilerlemeyi sıfırlama için aynıdır. Süre geçişi sessizce daha yüksek can kesintisi oluşturmaz.

Ayarlar içindeki bütün ilerlemeyi sıfırlama da ücretli yeniden başlatmayı atlatmaz. Onay ekranı, doğrulanmış açık ana denemelerin hepsi için can geçişini kopyada hesaplar; can kesilecekse **gerçekte kesilecek toplam canı** gösterir. En az bir geçerli hamlesi olan denemeler kimlikleriyle bir kez kapatılır; hamlesiz denemeler ve öğreticiler ücretsizdir. Bakiye yetmezse 0'ın altına inilmez ve sonradan borç alınmaz. Sınırsız/geliştirici muafiyetleri hesaba katılır. Onaydan sonra bütün can sonuçları ile temizlenmiş oyun ilerlemesi aynı kanonik profil yazımında kesinleşir. Yazım hatasında ikisi birlikte son güvenli kayda döner. Can, TEST Altın, koruma/işlem kayıtları ve seçim kimliği sayacı bu işlemde sıfırlanmaz.

Bunun dışındaki geçerli, kapatılmamış kayıtlar 0 canla açılabilir. 0 canla devam edilen bir oyun kaybedildiğinde bakiye negatif olmaz veya geleceğe borç yazılmaz; o sonucun tekrar ücretlendirilmesini önleyen kayıt korunur.

### Gelecekte +3 / +5 hamle

Ek hamle mevcut sürümde uygulanmamıştır; can sözleşmesi şu yaşam döngüsünü şimdiden tanımlar:

- İlk kayıp, mevcut Attempt ID için can sonucunu bir kez kaydeder.
- Gelecekte `GrantMoves` aynı denemeyi açarsa kimlik ve can sonuçlandırma işareti korunur; yeni can ücretli deneme sayılmaz.
- Yeniden kayıp ikinci can kesmez. Sonradan kazanma ek can kesmez ve ilk kayıpta kesilen canı otomatik iade etmez.
- Sonuçlandırma “koruma”, “sınırsız” veya “geliştirici geçişi” nedeniyle ücretsiz olmuşsa da aynı kimlikte ileride yeniden ücret doğmaz.

Böyle bir yardım v4 takas geçmişine gizlice yazılamaz. Yardım komutu, kayıt/kural sürümü ve Reward Director'ın takas dışı sözleşmesi için 9.0'daki ayrı aktarım gereksinimleri devam eder.

### İlk kayıp koruması

İlk üç ana bölümün ilk başarısızlığı için koruma yapılandırılabilir; varsayılan **kapalıdır**. Kullanım deneme/varyant başına değil kalıcı bölüm kimliğiyle izlenir. Öğretici, tekrar yükleme veya varyant yenileme yeni koruma hakkı üretmez. Onaylı oyunu sıfırlama, başarısızlık koruması değildir. İlk başarısızlık, koruma kapalıyken veya sınırsız/geliştirici/geçmiş geçişi nedeniyle can kesilmezken de `firstFailures` içinde kaydedilir. Böylece ayarı sonradan açmak geçmişte ilk kaybını yaşamış bölüme yeni hak üretmez. Uygulanmış ücretsiz koruma ayrıca `protectionUsed` içinde tutulur. Deneme ilk kez sonuçlandırılırken öncelik: geçmiş geçişi → öğretici → kazanma → hamlesiz yeniden başlatma → geliştirici geçişi → sınırsız → yapılandırılmış ilk kayıp koruması → boş bakiye → can kesimidir.

## Ödül ve test fiyatları

| Ürün kimliği | Etki | Test maliyeti / sınır |
| --- | --- | --- |
| `ad_life` | +1 can | Gönüllü sahte reklam; UTC günü başına en fazla 3, başarılı talepler arasında en az 30 dakika. |
| `single_life` | +1 can | 30 TEST Altın. |
| `refill_lives` | Normal canı 5 yapar | 100 TEST Altın. |
| `unlimited_lives_30m` | 30 dakika sınırsız hak | 180 TEST Altın. |

Bu fiyatlar kalibre edilmiş ticari fiyat değildir. Test cüzdanı 300 TEST Altınla başlar; bu, gelecekteki genel ekonomi tasarımındaki 100 Altın başlangıç hediyesini uygulamaz. Bölüm puanı TEST Altına dönüşmez. Geliştiricinin açık test yüklemesi de sahte, doğrulanmış ve tekil bir işlem olarak ayrı cüzdan günlüğüne kaydedilir.

Reklam ancak oyuncu düğmesine dokunursa istenir. Sağlayıcı uygun değilse, süre dolmadıysa veya günlük hak bittiyse can verilmez; bekleme, Altın seçenekleri ve ücretsiz öğretici sunulur. Başlamayan/iptal/başarısız reklam günlük ödül hakkı tüketmez. Gece yarısı günlük sayım yenilenebilir; son başarılı reklamdan kalan 30 dakikalık bekleme gece yarısında silinmez.

Mağaza otomatik açılmaz. Ana menü/yolculuktaki kalpler can seçeneklerini açabilir; 0 canla yeni deneme isteği açık can seçeneklerine yönlendirilir. Bu ekranın açılması reklamı veya satın alma işlemini başlatmaz.

## Doğrulama ve idempotent işlemler

Saf yönetici şu makbuz biçimini kabul eder; doğrulayıcı varsayılan olarak reddeder:

```json
{
  "transactionId": "benzersiz-saglayici-islem-kimligi",
  "productId": "single_life",
  "provider": "development",
  "status": "completed",
  "verifiedAtUtc": 1800000000000
}
```

Doğrulayıcı dışarıdan verilir. Web test sağlayıcısı makbuzu kendi saklanan kayıt defteriyle eşleştirir. Saf çekirdek sağlayıcıyı bu tek isme kilitlemez; güveni enjekte edilen doğrulayıcı belirler. Gerçek sağlayıcı adaptörü ileride eklenebilir, ancak beş alanlı sahte makbuz ticari ödeme doğrulaması değildir. Callback içindeki “+99 can” veya ücret iddiası etkiyi belirlemez; ürün etkisi ve fiyatı yapılandırmadan gelir.

- Doğrulanmamış, iptal edilmiş veya bozuk sonuç ödül vermez.
- Uygun ve doğrulanmış işlem kimliği bir kez uygulanır. Aynı reklam/ödeme callback'i tekrar geldiğinde can, süre veya Altın tekrar değişmez.
- Doğrulanmış fakat o anda uygun olmayan işlem reddedilmiş olarak tekilleştirilir; sonradan can azalınca aynı eski bildirim ödüle dönüşmez.
- Reklam sınırı yalnızca başarılı uygulamadan sonra ilerler. Altın yalnızca can işlemi gerçekten uygulanıp bütün kayıt yazımı başarıyla tamamlandığında düşer.
- `maxLedgerEntries` artık yeni oyun kapısı değildir; ayrıntılı kayıt saklama eşiğidir; teknik üst sınır 128 ayrıntılı satırdır (etkin sınır ikisinin küçüğüdür). Bu sınır bir oyun/ekonomi kuralı değildir ve yayımlanmış 20.000 yapılandırması değiştirilmez. Eski deneme ve genel işlem kimlikleri tam eşitlik koruyan küçük arşiv kayıtlarına taşınır. Kimlikler körlemesine silinmez. Doğrulayıcı tarafından onaylanmış artan sağlayıcı seri numaraları kapalı aralıklarla tekilleştirilir; keyfi eski kimlikler bu varsayıma sokulmaz. Gerçek depolama kotası hatası hâlâ güvenli biçimde işlemi durdurur ve geri alır; sınırsız fiziksel depolama vaat edilmez.

Yerel dosya, makbuz kaydı ve saati oyuncu değiştirebilir. Bu prototip yalnızca uygulama akışındaki tekrar bildirimlerine karşı korur; gerçek para veya reklam sahteciliğini önlediği iddia edilmez. Unity'de gerçek sağlayıcı ve güvenilir doğrulama, saf LifeManager'a ayrı adaptörle bağlanmalıdır.

## Tamamlanan reklamın korunması

Reklam yalnızca başlarken boş yer varsa istenir. Reklam tamamlanırken normal yenilenme 5 cana ulaştıysa doğrulanmış ödül kaybolmaz: `pendingAdLives` içinde saklanır, günlük hak ve bekleme süresi tamamlanma anında bir kez işlenir. Aktif normal havuz hiçbir zaman 5'i aşmaz. Sonraki can harcamasında veya uzlaştırmada boş yer açılınca bekleyen hak otomatik uygulanır; tekrar reklam izlenmez. Dolu havuzda yeni reklam başlatılamaz. Arayüz saklanan ödülü açıkça gösterir. Ücretli tek-can/doldurma ürünleri için dolu havuzda ücret almama kuralı değişmez.

## Saklama ve geçiş

Canlar motor snapshot'ına eklenmez. Yetkili kayıt `hexrota-profile-v2` anahtarında tek JSON değeridir:

```text
{ schemaVersion: 2, revision: pozitif tamsayı,
  game: değişmeyen hexrota-match-v5 içeriği,
  energy: { schemaVersion: 1, life: LifeStateV2,
            testWallet: TestWalletV1, provider: DevelopmentProviderV2 } }
```

Her kullanıcı olayının eşzamanlı kural değişiklikleri tek işlemde toplanır. Sonuçlanan tahta ve kimlik başına can sonucu aynı yazımda kesinleşir; TEST Altın, makbuz ve can işlemi de aynı sınırı kullanır. Başarısız kanonik yazımda motor kayıt tekrar oynatımıyla son güvenli tahtaya döner; can, seçim sayacı ve yerel olay istatistikleri de geri alınır. Animasyon sonucu bu kararı değiştirmez.

`hexrota-match-v5` ve `hexrota-lives-v1` uyumluluk aynaları yazılır; kanonik yazımdan sonra ayna hatası başarılı işlemi geri alamaz. Yeniden açılışta kanonik profil önceliklidir, aynalar onarılır. İlk geçişte kanonik profil yoksa eski iki kayıt ve v4/v3/v2 taşıması aynen okunur. Eski bitmiş 9.0 sonuçları hâlâ ücretsiz kabul edilir; kaçırılmış 9.1 sonuçları kimlikle bir kez uzlaştırılır. Bilinmeyen/bozuk kanonik sürümde üzerine yeni profil yazılmaz.

Sekmeler arasında aynı anda yalnızca bir yazıcı vardır. `session-store.js`, Web Locks API ile sekme yaşamı boyunca özel kilit tutar. İkinci sekme hiçbir oyun, can, sayaç veya sağlayıcı değişikliği yazmadan açıklayıcı bekleme ekranı gösterir. İlk sekme kapanınca “Tekrar dene” en güncel profili yükler. Sayfa yaşamı sonlandığında kilit bırakılır; geri önbellekten açılışta kilit yeniden alınır. Revizyon kontrolü kilide uymayan eski yazıcının üzerine yazmayı ayrıca reddeder. Kilit desteği olmayan tarayıcıda güvenli biçimde kayıt değiştirmeden durur. Bu, bütün tarayıcılarda eşzamanlı düzenleme desteği değildir.

İlerlemeyi sıfırlamak canı, yenilenme sayacını, sınırsız bitişini, koruma kullanımını, TEST Altını veya işlem günlüğünü hediye etmek/silmek için kullanılamaz. Yeni kimlik üretimi ve can geçişi kayıt politikaları birlikte korunmalıdır. Bozuk veya bilinmeyen can verisi geçerli oyun ilerlemesini silmez; bilinmeyen sürüm sessizce tam can hediyesine dönüştürülmez.

## Geliştirici geçişi ve test sınırı

Can sınırını kapatan açık geliştirici ayarı, can miktarı nedeniyle yeni deneme engelini ve can kesintisini atlar. Bozuk veri ve kaydetme hatası gibi güvenlik kontrollerini kaldırmaz. Motor, sayı üretimi, varyant çözüm yolları, puan ve ödül kararları değişmez. Geçişte oynanan sonuçlar sonuçlandırılmış sayılır; ayar sonradan kapanınca eski kayıplar geriye dönük can kesmez. Normal yenilenme/zaman hesabı sürer.

Ayar test amacıyla açıkça etiketlenir, varsayılan kapalıdır. Bölüm dengeleme testleri bunu doğrudan test fixture'ında açabilir; normal oyuncu kaydı gizlice bu ayara geçirilmez.

## Saf API ve JSON sözleşmesi

Oluşturma: `HexLives.createManager(config, { clock: () => utcMs, verifyReceipt: receipt => boolean })`. Saat adaptörü `now()` yöntemi olan nesne de olabilir. Yönetici girdileri değiştirmez; geçiş yeni DTO döndürür. Varsayılan makbuz doğrulayıcı bütün sonuçları reddeder.

| İşlem | Girdi / çıktı |
| --- | --- |
| `createState()` | Clock anında 5 canlık başlangıç DTO'su. |
| `restore(raw)` | Veri yoksa yeni DTO; geçerli veri varsa doğrulama ve zaman uzlaştırması. Bozuk/bilinmeyen veri hata üretir. |
| `validateState(state)` | Şema, sürüm, sınırlar, zamanlar ve günlük bütünlüğü kontrolü. |
| `reconcile(state)` | Çevrimdışı yenilenme, biten sınırsız hak ve UTC reklam günü hesabıyla yeni durum. |
| `view(state)` | Can/sayaç, sınırsız, reklam uygunluğu, kapasite ve saat geri alma göstergeleri; kalıcı durum yerine görünüm. |
| `canStart(state, { tutorial, resume, attemptId })` | Yeni deneme kapısı; devam istisnasında kapatılmış kimlik açılamaz. |
| `registerAttempt(state, { attemptId, levelId, tutorial, resume })` | Başlangıçtaki sınırsız hakkı bir kez kaydeder; eski geçerli devam için `resume: true`. |
| `registeredAttemptFor`, `settlementFor`, `hasTransaction` | Ayrıntılı/arşivlenmiş kayıtları ayırt etmeyen salt okunur sorgular. |
| `canResume(state, attemptId)` | Can bakiyesinden bağımsız; yeniden başlatmayla kapatılmış kimliği reddeder. Motor kaydının doğrulanması ayrıca gerekir. |
| `settleAttempt(state, context)` | `{ state, applied, reason, charged }`; context deneme/Level ID, `tutorial`, `movesUsed`, `outcome` ve yeniden başlatmada `confirmed` içerir. |
| `acknowledgeHistoricalAttempt(state, context)` | İlk özellik geçişindeki doğrulanmış eski kazanma/kayıp için `historical` muafiyeti; can kesmez. |
| `transactionAvailability(state, productId)` | `allowed`, `reason`, `costGold`, `availableAtUtc`, `waitMs`. Reklam sağlayıcısının gerçekten bulunması ayrı kontroldür. |
| `applyTransaction(state, receipt)` | `{ state, applied, reason }`; doğrulanan makbuzun uygun ürün etkisini tek kez uygular. |
| `setDeveloperBypass(state, enabled)` | Yapılandırma izin veriyorsa geçiş; motor durumunu değiştirmez. |

Kanonik can DTO alanları: `schemaVersion: 2`, `rulesVersion: lives-v2`, `pendingAdLives`, `registeredAttempts`, `settledArchive`, `transactionArchive`, `transactionStreams`, `lives`, `regenAnchorUtc`, `lastSeenUtc`, `unlimitedUntilUtc`, `developerBypass`, `settledAttempts`, `processedTransactions`, `protectionUsed`, `firstFailures`, `adUsage`. Doluyken `regenAnchorUtc = null`; eksikken son etkin UTC anından ileri olmayan bir başlangıç zorunludur. Sınırsız hak yokken bitiş `null` olur. `0` ile `null` birbirinin yerine kullanılmaz.

- `registeredAttempts[attemptId]`: `levelId`, `tutorial`, `startedAtUtc`, `unlimitedAtStart`. Deneme sonuçlanınca başlangıç kaydı kaldırılır.
- `settledArchive[id]`: `[levelId,tutorial,outcome,movesUsed,settledAtUtc,charged,waiver,discardedAtUtc]`; son alan `null` değilse kapalıdır.
- `transactionArchive[id]`: `[productId,provider,verifiedAtUtc,processedAtUtc,result,reason]`.
- `transactionStreams[streamId]`: `{ provider, ranges: [[ilkDahil,sonDahil]] }`; yalnız doğrulanmış `streamId + "-" + sequence` kimliği bu yoldan sıkıştırılır.
- `settledAttempts[attemptId]`: `levelId`, `tutorial`, `outcome`, `movesUsed`, `settledAtUtc`, `charged`, `waiver`, `discarded`, `discardedAtUtc`. Sonradan aynı deneme kazanır/yeniden başlatılırsa ilk can kesimi/muafiyet korunur.
- `processedTransactions[transactionId]`: `productId`, `provider`, `verifiedAtUtc`, `processedAtUtc`, `result` (`granted` / `rejected`), `reason`.
- `firstFailures`: türü korunmuş Level ID anahtarından ilk başarısız Attempt ID'ye eşleme. `protectionUsed` aynı anahtarda yalnızca uygulanmış koruma için `true` tutar; `number:1` ile `string:1` aynı değildir.
- `adUsage`: `dayUtc = floor(etkinUTC / 86400000)`, o günkü başarılı `claims`, gün değişiminde de korunan `lastClaimUtc`.
- TEST cüzdanı `processedTransactions[id]`: `productId`, `goldDelta`, `atUtc`. Bu mali güven kanıtı değildir; testteki tekrar bildirimini tekilleştirir.
- Sahte sağlayıcı DTO'su: `schemaVersion: 2`, `namespace`, `nextSerial`, `adAvailable`, `transactions`, `finalizedRanges`. İşlem kaydı `transactionId`, `productId`, `createdAtUtc`, `status`; tamamlanırsa `streamId` ve `sequence` eklenen yedi alanlı `receipt` içerir; eski beş alanlı makbuzlar okunur. Son 128 ayrıntılı tamamlanmış kayıt tutulur, daha eskileri kalıcı kapalı seri aralıklarına taşınır; karşılıkları TEST cüzdanının ayrıntılı günlüğünden kaldırılabilir. Sonuç durumları `pending`, `completed`, `cancelled`, `unavailable` olur.

Makinece okunabilir DTO örnekleri `fixtures/lives-vectors.json` içinde bulunur. Eski v1 örnekleri `fixtures/lives-vectors-v1.json` olarak değiştirilmeden saklanır; geçiş testleri eski bakiye, zaman, koruma ve tekilleştirme kayıtlarını doğrular. Yapılandırma JSON'u `schemaVersion: 1 / lives-v1` olarak kalır: şema ve kural durumunun sürümü ile fiyat parametrelerinin sürümü farklı sözleşmelerdir.

## Unity uygulama sınırı

C# karşılığı `LifeManager`, `LifeConfig`, `LifeState`, `LifeSettlement`, `LifeTransaction` ve dış `IUtcClock` / `IReceiptVerifier` adaptörlerinden oluşmalıdır. UTC alanları `long`, can ve ürün miktarları tamsayıdır. Saat, sağlayıcı ve saklama Unity servislerine bağlanır; saf çekirdeğe `DateTime.UtcNow`, PlayerPrefs, reklam/ödeme SDK'sı veya sahne bağımlılığı girmez.

Aynı başlangıç durumu, aynı UTC zamanları, aynı sıra ve aynı doğrulanmış işlem kimlikleri JS ile C#'ta aynı JSON sonucunu vermelidir. Port sırasında yenilenme başlangıcını, tam can davranışını veya deneme başına tek ücret politikasını yeniden yorumlamak ayrı can kural sürümü gerektirir. Kesin DTO alanları ve ortak vektör komutları aktarım planıyla birlikte tutulur.


## Önceki sürüm doğrulama kaydı — 9.1.0

Genişletilmiş `npm test` ve derlenmiş `npm run test:unity-rewards` geçti. Can çekirdeğinde 22 test grubu; gerçek uygulama bağlantısında 20 senaryo; ortak can JSON verisinde 16 örnek/136 işlem ve doğrulama geçti. Chromium'da 390×664, 320×568 ve 568×320; gerçek dokunma, standart animasyon, kayıt/RNG devamı ve yatay sıfır-can penceresinin kaydırılması denendi. Hata görülmedi. Fiziksel cihaz veya C# LifeManager çalıştırıldığı iddia edilmez.

Makinece okunabilir sonuç `reports/lives-validation.json`; değişmeyen 9.0 kaynak özetleri `reports/lives-baseline.json` içindedir. Ayarları `dist/lives-config.json` üzerinden değiştirip `npm run lives:sync` ile tarayıcı kopyasını üret. `npm run test:lives` bütün can kontrollerini çalıştırır.

## 9.2 regresyonları ve açık sınırlar

Önce 9.1 üzerinde üç çekirdek hata yeniden üretildi: sınırsız dönemde başlayan denemenin süre bitince ücretlenmesi, tamamlanan reklamın dolan havuzda reddedilmesi ve günlük eşiğinde yeni oyunun engellenmesi. Uygulama testinde oyun yazımı başarısızken canın 5'ten 4'e düştüğü de gösterildi. `check-life-consistency.cjs` ve `check-session-consistency.cjs` bu davranışları kalıcı regresyon olarak kontrol eder.

`npm run test:session-browser` gerçek Chromium sayfalarıyla aynı profil üzerinde iki sekmeyi, kapanış/kilit devrini, kota hatasında atomik geri almayı, eski aynalardan kurtarmayı ve dolan havuzda reklam ödülünü sınar. Web Locks desteklenmeyen durumun yazmadan durduğu da kontrol edilir. Kota yüzünden yazılamayan tamamlanmış test makbuzu sekme belleğinde tutulur; kullanıcı aynı ödülü tekrar izlemeksizin kaydetmeyi deneyebilir. Kalıcı depolama tamamen yazılamıyorken sekmenin/cihazın kapanmasından sonra bu yeni makbuzun korunacağı garanti edilemez; gerçek sağlayıcı adaptörü kalıcı doğrulama ve yeniden teslim sağlamalıdır. Fiziksel iPhone doğrulaması ve C# LifeManager parity hâlâ açıktır; çalıştırılmadıkları hâlde geçti olarak raporlanmaz. Son çalıştırma sonuçları `reports/life-save-consistency.json` dosyasına kaydedilir.
