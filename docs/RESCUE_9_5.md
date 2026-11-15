# 9.5 — İkinci şans kuralları ve taşınabilir sözleşme

Bu belge `dist/rescue.js` ile `unity/Rescue/RescueManager.cs` uygulamalarını açıklar. Ana ürün kararları `ONE_TIME_PROGRESSION_ECONOMY_9_5.md` dosyasındadır. Buradaki fiyatlar ve kotalar pilot parametreleridir; gerçek ödeme veya reklam SDK'sı yoktur.

## Uygulanan saf katman

| JavaScript | C# 7.3 | İşlev |
| --- | --- | --- |
| `HexRescue.createManager` | `Hexrota.Rescue.RescueManager` | Uygunluk, teklifler, idempotent kurtarma önerisi |
| `HexRescue.TestProvider` | `DevelopmentRescueProvider` | Açıkça TEST olan reklam isteği ve yerel makbuz |
| Dışarıdan `verifyReceipt` | `IRescueReceiptVerifier` | Makbuz güven sınırı; varsayılan ret |
| TEST doğrulama adaptörü | `DevelopmentRescueReceiptVerifier` | Yalnız geliştirme sağlayıcısının tam makbuz eşitliği |

Modüller DOM, depolama, UnityEngine, SDK, ağ veya cihaz saati kullanmaz. Saat çağırandan gelir. JS `clock: () => utcMilliseconds`; C# `Func<long>`. Unity host'u mevcut `IUtcClock.NowUtcMilliseconds` metodunu bu delegate'e bağlayabilir. UTC sayıları 0 ile 9.007.199.254.740.991 arasında tam sayıdır. Etkin zaman, kayıtlı `lastSeenUtc` ve gözlenen saatin büyüğüdür. Host mevcut LifeManager'ın etkin zamanını da hesaba katmalıdır. Tam ve dışarıdan doğrulanmış bir tamamlanma makbuzunun `verifiedAtUtc` değeri de teslim sırasında zaman alt sınırı olur. Böylece kayıt hatasından sonra gece yarısı aşılmış ve cihaz saati geri alınmışsa reklam eski güne yazılıp ertesi gün ikinci kez kota açamaz. Bu alt sınır yalnız makbuz ve verilmiş hedef işlem tamamen doğrulandıktan sonra uygulanır; doğrulanmamış JSON saati ilerletemez. Yerel cihaz saati ve TEST JSON'u ticari makbuz doğrulaması değildir.

## Ürün kuralları

- Teklif yalnız tamamlanmamış ana bölümde, **son başarılı gerçek komut `swap`**, durum `lost`, kalan hamle 0 ve en az bir geçerli takas yapılmışsa uygundur. Öğreticiler ve tamamlanmış ana bölümler reddedilir.
- Deneme başına en çok **bir başarılı** kurtarma. Başarılı kurtarma kaydı ve motor komut geçmişindeki `usage.rescue` birlikte kontrol edilir. Sunum callback'i hak oluşturamaz.
- Reklam veya 140 Altın karşılığında **tam 5** hamle. Attempt ID, varyant, önceki takaslar, taşlar, zemin, puan ve RNG korunur. Motorun `grant_moves` komutu ayrı sürümlü komut geçmişine girer; classic-v4 snapshot değiştirilmez.
- Reklam kotası UTC gününde 2 başarılı teslimdir; can reklamı kotasından ve makbuzlarından ayrıdır. Tamamlanmayan reklam günlük hakkı tüketmez.
- Uygun Altın alternatifi reklam bulunamadığında/kota dolduğunda açık kalır. 140'tan az Altınla ücretli kurtarma başlatılmaz. Saf yönetici cüzdana dokunmaz; harcamayı ekonomi yöneticisi önerir.
- İlk kayıpta kesilmiş can iade edilmez. Aynı Attempt ID tekrar kaybederse mevcut LifeManager settlement geçmişi ikinci kesintiyi engeller; sonraki kazanma da ilk kesintiyi iade etmez.
- Reklam otomatik açılmaz. Bekleyen isteğin yeniden yüklenmesi yeni izlenme gerektirmez ve kendiliğinden modal açmamalıdır. Oyuncu açıkça TEST işlemini sürdürür veya başka seçeneği kullanır.

Yapılandırma `data/economy-config-9-5.json` içindeki `rescue` nesnesidir:

```json
{"moves":5,"goldCost":140,"dailyAdLimit":2,"maxPerAttempt":1}
```

İlk sözleşmede hamle 5 ve deneme sınırı 1 sabittir. Kotanın/fiyatın değiştirilmesi eski makbuzun maliyet kaydını yeniden hesaplamaz. Bu sürüm reklamlar arasında ek bir bekleme süresi koymaz; can reklamının bekleme kuralı kurtarma reklamına taşınmaz.

## Uygulama sınırı ve bağlam

Yönetici, doğrulanmış oyun durumundan hazırlanmış şu bağlamı kabul eder:

```json
{
  "attemptId":"a-8-1-12345678",
  "levelId":8,
  "tutorial":false,
  "cleared":false,
  "status":"lost",
  "movesLeft":0,
  "turn":20,
  "lastCommand":"swap",
  "rescuesUsed":0
}
```

Öğretici kimlikleri string kalır (`learn-1`); ana bölüm kimlikleri sayıdır. `8` ile `"8"` aynı kimlik değildir. Alanlar tam olarak denetlenir; keyfi ek alan kabul edilmez. Katalogda bölümün varlığı ve sıradaki tamamlanmamış bölüm olması session/ekonomi sınırında da doğrulanır. Saf rescue katmanına UI'nın beyanı doğrudan aktarılmaz.

JS kurulum örneği:

```js
const manager = HexRescue.createManager(HEX_ECONOMY_CONFIG.rescue, {
  clock: () => effectiveUtc,
  verifyReceipt: (receipt, provider) => HexRescue.TestProvider.verify(provider, receipt)
});
```

C# karşılığı:

```csharp
var manager = new RescueManager(rescueConfig, () => effectiveUtc,
    new DevelopmentRescueReceiptVerifier());
```

Doğrulayıcı verilmezse reklam teslimi reddedilir. Yerel TEST doğrulayıcı canlı reklam güvenliği sağlamaz; gerçek sağlayıcı ileride ayrı adaptördür.

| JS / C# yöntemi | Girdi ve sonuç |
| --- | --- |
| `createState` / `CreateState` | İsteğe bağlı `{namespace, adAvailable}` ile yeni state |
| `validate` / `Validate` | Bozuk state'i hata koduyla reddeder |
| `restore`, `reconcile` / `Restore`, `Reconcile` | Zamanı uzlaştırır; bekleyen istekleri ve tekil hakları korur |
| `availability` / `Availability` | `(state, context, {gold})`; reklam ve Altın için ayrı `allowed/reason` |
| `beginAd` / `BeginAd` | Bekleyen TEST isteği; henüz hamle veya kota harcamaz |
| `completeAd` / `CompleteAd` | `(state, id, {outcome})`; `completed/cancelled/unavailable` sonucu ve varsa makbuz |
| `applyAd` / `ApplyAd` | `(state, context, receipt, completedProvider?)`; doğrulanmış teslim önerisi |
| `applyGold` / `ApplyGold` | `(state, context, operationId, {gold})`; yeterli bakiye kontrolü ve maliyet önerisi |
| `setAdAvailable` / `SetAdAvailable` | Gelecek istekleri etkiler; tamamlanmış reklamı iptal edemez |
| `settlementFor`, `transactionFor` | Tam ve arşivlenmiş tekil kaydı aynı şekilde bulur |

Bir işlem sonucu:

```json
{
  "state": "Yeni rescue state nesnesi",
  "applied": true,
  "reason": "rescued",
  "grant": {
    "commandId":"hexrota-rescue-test-1",
    "attemptId":"a-8-1-12345678",
    "source":"ad",
    "moves":5
  },
  "costGold":0,
  "transactionId":"hexrota-rescue-test-1"
}
```

`CompleteAd` ayrıca `receipt` ve `completedProvider` döndürür. Bunlar tek başına hamle kazandırmaz. `applied:false` sonuçları yeni hak üretmez. Aynı ID ve aynı bağlam `duplicate_transaction`; başka deneme/bölüm/kaynak için aynı ID `transaction_conflict` olur. Geçersiz/iptal/başka ürüne ait makbuz `unverified_receipt` olur.

## Atomik uygulama sırası

1. Geçerli profil revision'ını ve etkin denemenin doğrulanmış snapshot'ını oku.
2. Katalog/kalıcı tamamlama kontrolünü yap, bağlamı motorun son başarılı komutundan oluştur.
3. Reklam başlatılırsa yalnız bekleyen istek/provider seri numarasını kanonik profil commit'inde sakla. TEST onayı sonra gösterilir.
4. Onaylanmış reklam için doğrulanmış tamamlanma kanıtı elde et. Altın için önce yeterli bakiye kontrol et.
5. Güncel profil üzerinde `ApplyAd` veya `ApplyGold` önerisini üret.
6. Altında **aynı operation ID** ile `EconomyManager.SpendRescue`; ardından aynı ID ile `{id, type:"grant_moves", moves:5}` uygula. Bunların hepsi ayrık klonlar üzerinde yürür.
7. Oyun snapshot'ı, rescue state, ekonomi ve can state'ini **tek revision kontrollü profil commit'i** ile yaz. Herhangi bir ret/yazma hatasında önceki geçerli durum kalır.
8. Yalnız başarılı commit ardından oynanışa dön ve olay/sunum üret. Analitik hatası geçerli commit'i geri alamaz.

Can kesilmiş ilk kayıp bu işlemin öncesinde aynı deneme için settlement olmuştur. Kurtarmada can yöneticisi yeni attempt olarak kaydedilmez. İkinci kayıp aynı ID ile sonuçlandırılır.

Kayıt yazımı başarısızsa `completedProvider` ve tam makbuz host'ta yeniden teslim edilebilir. Yönetici eski sağlayıcı kanıtından **yalnız önceden verilmiş hedef işlemi** alır. Daha yeni `nextSerial`, reklam uygunluğu ve diğer bekleyen işlemleri eski provider nesnesiyle ezmez. Yeniden teslimde aynı makbuz ve operation ID kullanılır; yeni reklam/ücret başlatılmaz.

## JSON kayıt sözleşmesi

Kalıcı yer: `hexrota-profile-v2` içindeki **`game.rescue`**. Ekonomi `game.economy`, can mevcut `energy`, gameplay snapshot ve attempt metadata kendi mevcut sözleşmelerinde kalır. Eksik rescue alanı eski profilde ilk kez oluşturulur; mevcut bozuk/yanlış sürümlü rescue alanı yeni boş state diye kabul edilmez.

```json
{
  "schemaVersion":1,
  "rulesVersion":"rescue-v1",
  "lastSeenUtc":1794700800000,
  "adUsage":{"day":20772,"count":0},
  "settledAttempts":{},
  "settledArchive":{},
  "processedTransactions":{},
  "transactionArchive":{},
  "provider":{
    "schemaVersion":1,
    "namespace":"hexrota-rescue-test",
    "nextSerial":1,
    "adAvailable":true,
    "transactions":{},
    "finalizedRanges":[]
  }
}
```

`day = floor(lastSeenUtc / 86400000)`; örnekteki gün sayısı açıklama içindir, gerçek değer formülle üretilir. Aktif claim kaydı `{levelId,source,transactionId,atUtc}`; aktif transaction `{attemptId,levelId,source,atUtc,moves,costGold}`. Karşılıklı kimlik/tarih/kaynak ilişkisi doğrulanır. Son 128 zengin kayıt tutulur. Eski claim `[levelId,source,transactionId,atUtc]`, eski transaction `[attemptId,levelId,source,atUtc,costGold]` olarak kayıpsız arşivlenir; eski ID unutulmaz. Bu teknik sıkıştırma oyun kullanım kotası değildir.

TEST provider bitmiş eski seri numaralarını birleşik kapalı aralıklara taşır. Bekleyen istekler kendiliğinden silinmez; başarısız commit sonrası kanıt yeniden sunulabilir. Tamamlanmamış isteği terk eden host, açık iptal sonucunu kayda geçirebilir. Aynı günün bekleyen/tamamlanmış ama teslim edilmemiş istekleri kota rezervasyonu sayılır; aynı anda üç istek başlatılamaz. Kota **başarılı teslim gününde** tüketilir. Gün aşan makbuzda güncel kota dolmuşsa teklif reddedilir; can sistemindeki bankalanmış can hakkına dönüştürülmez. Tek etkin denemeli normal akışta bu durum ikinci eşzamanlı oyun olarak açılmaz.

Makbuzun `provider:"development_rescue"`, `productId:"rescue_moves_5"`, Attempt ID, sayısal Level ID, stream/sequence, tam alan listesi ve sağlayıcıdaki tam makbuz karşılığı doğrulanır. Can sisteminin `development/ad_life` makbuzu bu sözleşmede geçmez. Varsayılan doğrulayıcı hiçbir makbuz kabul etmez.

## Gerçek doğrulama ve sınırlar

- `node check-rescue.cjs`: 293 değişmez JS girdi/sonuç kontrolü; 12 dondurulmuş uygunluk örneği ve beş tam state/provider/sonuç golden'ı; 100 yinelenen callback; kayıt hatasından sonra gece yarısı/saat geri alma ve yanlış denemeye gelen geç makbuz regresyonları; iki 300-denemelik journal sıkıştırma akışı.
- `node check-rescue-parity.cjs`: gerçek .NET 8 derlemesi, C# 7.3; 293 JS/C# tam state/sonuç/ret karşılaştırması. Uzun akışlar içinde toplam 600 başarılı kurtarma settlement'ı C# reducer'larında da çalışır. SDK bulunmazsa test başarısızdır; JS yedeği yoktur.
- `node check-rescue-transactions.cjs`: yayımlanmış L8'in gerçek kaybedilen takasları, replay, değişmeyen RNG/tahta, Altın+hamle atomik geri alma, doğrulanmış TEST kanıtını tekrar teslim, bağımsız can reklam kotası, ikinci can kesintisinin olmaması ve eski revision yazıcının reddi.
- Bu modül testleri saf kurallar ile transaction bileşimini doğrular. Gerçek app/UI ve tam session parity regresyonları ayrıca Stage C / Integration testleriyle doğrulanmalıdır.
- Fiziksel iPhone/Android, Unity Editor ve IL2CPP testi bu saf .NET çalışmasının parçası değildir. Gerçek reklam doğrulaması, sunucu saati ve güvenli uzak cüzdan henüz uygulanmamıştır.
