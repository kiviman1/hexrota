# C# LifeManager — 9.3

## Uygulanan sınır

`unity/Lives/` güncel `dist/lives.js` **lives-v2** uygulamasının saf C# 7.3 karşılığıdır. Önceki 9.1 davranışı yeniden kurulmaz: deneme başlangıcındaki sınırsız can hakkı, dolu havuzda bekleyen reklam hakkı, kayıt arşivi ve doğrulanmış seri aralıkları aktarılmıştır. JavaScript web oyunu, bölüm/öğretici/veri dosyaları, mevcut C# Gameplay ve Rewards dosyaları değişmez.

| Modül | JavaScript karşılığı / sorumluluk |
| --- | --- |
| `LifeManager` | `HexLives.createManager`: doğrulama, yenilenme, başlatma/devam kapısı, deneme ve işlem reducer'ları. |
| `LifeConfig` | `lives-config.json` sözleşmesi; yapılandırma v1 veya v2 kabul edilir, mevcut yayımlanmış v1 ayarlar değiştirilmez. |
| `LifeState` | V2 yaşam durumu ve saf JSON nesne ağacı; eski v1 durumları `Restore` ile geçirilir. |
| `LifeSettlement` | Can ücretinin/muafiyetinin deneme kimliği, sonuç ve terk bilgileri. |
| `LifeTransaction` | Doğrulanacak makbuzun kimliği, ürünü, sağlayıcısı, UTC ve isteğe bağlı stream/sequence bilgileri. |
| `LifeOperationResult` | Tam `state`, `applied`, `reason`; yalnız uygun işlemlerde `charged`. |
| `IUtcClock` | Dışarıdan `NowUtcMilliseconds(): long`; negatif veya JS safe-integer sınırını aşan saat reddedilir. |
| `IReceiptVerifier` | `Verify(LifeTransaction): bool`; dış sağlayıcı güveni. Varsayılan doğrulayıcı ödül vermez. |

Çekirdek UnityEngine, DOM, saat servisi, timer, dosya sistemi, JSON kütüphanesi, SDK veya ağ istemcisi kullanmaz. Normal CLR koleksiyonları ve LINQ ile çalışır. JSON okuma/yazma yalnız `.NET 8` parity adaptöründe `unity/ParitySupport/WireJson.cs` üzerinden yapılır. Bu dosya çekirdek değildir; Unity'nin üretim JSON adaptörü henüz seçilmiş sayılmaz.

## DTO ve davranış sözleşmesi

DTO'lar mevcut alan adlarını ve alan varlığını `Dictionary<string, object>` / `List<object>` JSON ağacı olarak korur. `ToWire()` derin kopya döndürür; reducer eski DTO'yu değiştirmez. Sayılar ve dizgeler farklıdır: kampanya `1` ile dizge `"1"` aynı Level ID değildir. JSON sayıları JS'nin safe-integer aralığında doğrulanır; Kalıcı UTC alanları C# `long` kullanır. Yapılandırılmış çok büyük sürelerden türeyen ve kalıcı duruma yazılmayan görünüm zamanları/geri sayımlar, JS double aritmetiğinin safe-integer sınırı dışındaki yuvarlamasını da korur. Bir opak kimlik büyük/küçük harf, sıralama veya sayı biçimi bakımından yeniden yorumlanmaz.

`regenAnchorUtc`, `unlimitedUntilUtc`, `discardedAtUtc`, `lastClaimUtc` gibi nullable alanlar telde `null` olarak bulunur. `LifeOperationResult.Charged == null`, JavaScript sonucunda bu alanın **bulunmaması** anlamındadır; `ToWire()` bu durumda `charged` eklemez. Gelecekteki serializer varsayılan değerlerle eksik alanları sessizce doldurmamalıdır.

Temel durum alanları: `schemaVersion`, `rulesVersion`, `lives`, `regenAnchorUtc`, `lastSeenUtc`, `unlimitedUntilUtc`, `developerBypass`, `registeredAttempts`, `pendingAdLives`, `settledAttempts`, `settledArchive`, `processedTransactions`, `transactionArchive`, `transactionStreams`, `protectionUsed`, `firstFailures`, `adUsage`.

- Başlangıç/maksimum 5; doğal yenilenme mevcut yapılandırmada 30 dakikadır. Çevrimdışı geçen süre işlem öncesinde hesaplanır. Saat geriye alınırsa etkin UTC eski `lastSeenUtc` değerinden geriye gitmez.
- Kazanma ve öğretici ücretsizdir. Onaysız reset ücret üretmez. Aynı deneme sonucu en fazla bir kez ücretlenir; devam sonrası kazanma/terk, önceki ücret veya muafiyeti korur.
- `RegisterAttempt`, o anda geçerli sınırsız hakkını saklar. Bu kayıt süre bitse ve tekrar yüklenilse de korunur. Kayıttan devam ile yeni deneme kapısı ayrıdır.
- `ApplyTransaction`, önce durumu yeniler; sonra makbuz biçimi, tekrar/stream kimliği, dış doğrulama ve ürün koşullarını mevcut JS sırasıyla değerlendirir. Doğrulanmamış makbuz işlem kimliğini zehirlemez. Tekrarlanan kimlik doğrulayıcıya tekrar gitmeden reddedilir.
- Tamamlanan reklam havuz doluysa `pendingAdLives` içine alınır; aktif can 5'i aşmaz. Kota/cooldown bir kez işlenir; yer açıldığında hak tekrar reklam izlemeden kullanılır.
- Ayrıntılı kayıtlar, `min(maxLedgerEntries, 128)` satırla sınırlanır. Eski keyfi deneme/işlem kimlikleri tam arşiv kanıtıyla korunur; yalnız doğrulanmış stream sıra numaraları aralıklarla sıkıştırılır. Saklama eşiği yeni oyunu kilitlemez.
- `CanStart(state)` JS'deki belirtilmemiş `{}` bağlamıdır. `CanStart(state, null)` JS'nin açık `null` girdisi gibi, durum yenilemesinden sonra `LifeTypeException` verir. Hata JSON adaptörü bunu `TypeError` olarak gösterir; diğer kural doğrulamaları mevcut JS hata mesajlarını korur.

Yeni uygulama denemeleri controller tarafından kaydedilmelidir. Eski kayıtların başlangıç hakkı bulunmayabilir; bu modül geçişte geçmişte hiç tutulmamış süresi dolmuş sınırsız hakkı uydurmaz. Eski, kayıtlı olmayan bir denemenin sonuçlandırılması JS'nin legacy uyumluluk davranışını korur. Tahtanın gerçekten bu denemeye ait olduğunu ve kazanma/kaybetme sonucunu uygulama katmanı doğrular; LifeManager oyun motorunu çağırmaz.

## Eski kayıtlar ve katman ayrımı

`LifeState.schemaVersion: 1 / rulesVersion: lives-v1`, `Restore` ile v2'ye geçirilir. Mevcut bütün eski alanlar korunur; yeni `registeredAttempts`, arşiv ve stream sözlükleri boş, `pendingAdLives` sıfır başlar. Frozen `fixtures/lives-vectors-v1.json` değiştirilmez.

Tarayıcı anahtarı `hexrota-lives-v1`, içteki can durumunun sürümüyle aynı kavram değildir. Bu anahtardaki enerji aggregate'i ayrıca TEST cüzdanı ve geliştirme sağlayıcısını içerir. Bu PR enerji aggregate'i için yeni format icat etmez; `dist/life-providers.js`, cüzdan, atomik profil ve oyun controller portları uygulama PR'ının açık bağımlılığıdır. Verifier callback'i o katmanın doğrulanmış sağlayıcı bağlamına bağlanmalıdır.

## Gerçek parity testi

```sh
npm run test:unity-lives
npm run test:unity-gameplay
npm run test:unity-rewards
npm test
```

`test:unity-lives`, .NET SDK 8'i bulur, `LangVersion=7.3` ile gerçekten derler ve JSONL isteklerini derlenen C# DLL'ine yollar. SDK bulunamazsa başarısız olur; JS sonucunu C# yerine kullanmaz. Her C# çıktısı bağımsız, değişmeyen JS referansı ile `deepEqual` üzerinden karşılaştırılır. Fixture beklenenleri önce mevcut JS ile kontrol edilir; C# test geçsin diye JS değiştirilmez.

| Karşılaştırma | Yerel gerçek sonuç |
| --- | --- |
| V2 fixture | 19 senaryo, 157 geçiş/probe; her adımın tam durumu, görünümü ve sonucu. |
| Uzun günlük | 300 yeni kazanılmış deneme + 3 kapı/tekrar probe'u; varsayılan 20.000 ayarla 128 ayrıntılı satır, tam eski kimlikler, yeni oyun açık. |
| V1 geçiş | 152 dondurulmuş eski durum; eski alanlar korunarak v2 karşılaştırması. |
| Ek adversarial karşılaştırma | 172 yapılandırma, eksik/yanlış tür, null, yanlış kimlik türü, UTC, arşiv ve makbuz probe'u; 102 exception beklentisi. |
| Tam C# istekleri | 344; 460 geçiş + 152 eski yükleme + ek probe'lar; girişlerin değişmediği ayrıca doğrulanır. |
| Doğrulayıcı sırası | 6 gerçek callback incelemesi; geçersiz/tekrar girişler dış doğrulamayı atlar, doğrulayıcı hatası ödül vermez. |

Yerel derleme .NET 8.0.428 ile 0 uyarı/0 hata verdi. Yeni `C# life parity` GitHub Actions işi aynı komutu .NET 8 kurarak çalıştırır; mevcut yedi CI işi korunur. Uzaktaki PR kontrolü ayrıca incelenmelidir; yerel sonuç uzak CI sonucu olarak sunulmaz.

## Kalan platform sınırları

Can çekirdeği tamamlanmıştır; gerçek reklam/ödeme, cihaz saatinin güvenilirliği, kalıcı atomik dosya yazımı, Unity sahnesi, IL2CPP/AOT ve fiziksel iOS/Android bu PR'ın doğrulamadığı adaptör/platform sınırlarıdır. Cihaz saati ve geliştirme makbuzu güvenilir ticari kanıt sayılmaz. Genel eski kimliklerin kesin tekilleştirme arşivi sonlu saklama alanı tüketebilir; bu modül fiziksel sınırsız saklama vaat etmez.
