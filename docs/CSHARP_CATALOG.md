# C# bölüm kataloğu ve deneme kimliği — 9.3

## Uygulanan kapsam

`unity/Catalog/`, yayımlanmış `dist/attempts.js` kurallarının C# 7.3 karşılığıdır. Saf çekirdek UnityEngine, DOM, saat, depolama, ağ veya JSON kütüphanesi kullanmaz. `.NET 8` JSON/console işleri yalnız `unity/CatalogParityHarness/` ve ortak `unity/ParitySupport/WireJson.cs` adaptöründedir. Web uygulaması JavaScript motoru ve mevcut JavaScript modülleriyle çalışmayı sürdürür.

| Modül | JavaScript karşılığı ve sorumluluğu |
| --- | --- |
| `LevelCatalog` | `HexAttempts.createCatalog`: değişmez taban/veri sürümleri, tam bölüm çözme, legacy restore ve checkpoint. |
| `VariantSelector` | `start` / `randomStep`: ayrı unsigned seçim RNG'si, önceki/yakın varyantlardan kaçınma, birebir attempt ID. |
| `AttemptMetadata` | `attemptVersion:1` kimliği; Level ID türünü, seri, varyant ve veri sürümünü korur. |
| `AttemptCheckpoint` | Kimlik, çözülmüş bölüm ve gerçek motor replay'iyle doğrulanan snapshot; `Envelope()` mevcut v1 deneme zarfını üretir. |
| `LevelDataVersionResolver` | Yayımlanmış veri sürümünü açıkça seçer; bilinmeyen sürüm/varyant yeni bir başlangıca dönüşmez. |
| `CatalogWire` | Ortak saf `Wire` yardımcısı üzerinde strict gameplay config/snapshot dönüşümü; nullable ve unsigned alanlar korunur. |

Mevcut `data/levels-original.json`, `data/tutorials-fixed.json` ve `dist/variants.json` dosyaları gerçek .NET JSON adaptörüyle yüklenir; tam on orijinal bölüm, iki öğretici ve kırk çözülmüş varyant çıktısı JS kaynaklarıyla karşılaştırılır. `LevelCatalog.FromDocuments` yayın zarfının kimlik/sürüm alanlarını kontrol eder.

Katalog saf `Dictionary<string,object>` / `List<object>` veri değerleri alır; JSON adaptörü integral sayıları `long`, kesirli sayıları `double` olarak taşır. `1` ile `"1"` ayrı kimliktir. Kampanya dosyasında mevcut ID'ler sayısal; öğreticilerde `learn-1` / `learn-2` string kalır. Seçim seri numarası ve kimlik sayıları JS safe-integer sınırına kadar `Int64` ile korunur. Gameplay sayısal alanları mevcut yayımlanmış motorun doğrulanmış Int32 alanını kullanır; rastgele büyük harici oyun yapılandırmaları için daha geniş bir eşdeğerlik iddiası yoktur.

## Kaynak sözleşmesi ve sınırlar

- Varyant yayın sırası ayrı `List<string>` ile tutulur. Sonuçlar Unity/Mono `Dictionary` enumerasyon sırasına bağlanmaz.
- Seçim RNG'si `VariantSelector.RandomStep` içinde ilerler; gameplay `rngState` alanına erişmez. `0` seçim tohumu mevcut sıfır-tohum fallback'iyle aynı sonucu verir.
- Son verilen geçerli veri paketi `CurrentVersion` olur. Önceki paketler kendi sürüm kimliğiyle çözülür. `original-v1 / legacy-original` taban veriyi kullanır.
- Constructor, JS gibi çözüm rotalarının biçimini ve iki farklı ilk takası doğrular. Her rastgele paketin gerçekten kazanılabilirliğini constructor içinde ağır aramayla ispatlamaz. Yayımlanmış kırk varyantın seksen yolu testte gerçek C# ve JS motorlarıyla son kazanma durumuna kadar oynatılır.
- `Restore` kimliği kontrol eder; `HexMatch` her hamleyi tekrar oynatıp değer, zemin, puan, hamle ve RNG'yi karşılaştırır. Bozuk snapshot/kimlik sessizce sıfırlanmaz.
- Çağırana dönen katalog verisi kopyadır. Dış kodun bir `LevelWire` dizisini değiştirmesi yayımlanmış kataloğu veya başka bir denemeyi değiştirmez.
- Öğreticilerin sabit verisi `ResolveTutorial` ile yüklenir. `TutorialMetadata` mevcut app kimliklerini üretir: seri sıfırken `legacy-learn-1`, pozitif seride `t-learn-1-<serial>`; `fixed / tutorials-v1` korunur. Öğretici kaydı restore edilirken bozuk kimlik açıkça reddedilir, yeni tahta oluşturulmaz.
- Katalog hata kodları ve mesajları JS ile karşılaştırılır. Gameplay'in CLR istisna türü bir JS `Error` türü gibi sunulmaz; bozuk motor kayıtlarında reddetme ve kod yokluğu karşılaştırılır. Mevcut gameplay parity ayrıca saf motorun 1.042 bozuk yüklemeyi önceki durumu değiştirmeden reddettiğini doğrular.

## Uygulama katmanı API'si

```csharp
var catalog = new LevelCatalog(campaignWire, variantPackWire, tutorialWire);
AttemptStart started = catalog.Start(1L, optionsWire);
AttemptCheckpoint resumed = catalog.Restore(1L, savedEnvelopeWire);
Dictionary<string, object> envelope = catalog.Checkpoint(metadataWire, snapshotWire);
LevelConfig config = LevelCatalog.GameplayConfig(started.LevelWire);
```

`AttemptStart` ve `AttemptCheckpoint` dışarıya `ToWire()` kopyaları verir. Controller bu nesneleri kendi kalıcı saklama/olay/can işlemiyle birleştirir. Bu PR can, ekonomi, UI navigasyonu veya dosya saklama akışı eklemez; uygulama oturum PR'ının bağımlılığıdır.

## Gerçek karşılaştırma

```sh
npm run test:unity-catalog
npm run test:unity-gameplay
npm run test:unity-rewards
npm test
```

`test:unity-catalog`, .NET 8 SDK'yı bulmadan başarısız olur; C# 7.3 ile gerçekten DLL derler, JSONL isteklerini derlenmiş programa gönderir ve tam çıktı JSON'unu değişmemiş JS kaynak sonucu ile karşılaştırır. JS sonuçlarını C# sonucu gibi kullanan fallback yoktur. CI'da mevcut yedi işe ek ayrı `C# catalog and attempt parity` işi vardır.

Yerel kontrol: 2.107 tam JSON karşılaştırması; 725 seçim, 610 kayıt devamı, 90 checkpoint zarfı, seksen tam kazanma rotası/600 hamle, 38 öğretici kimlik/restore kontrolü, 21 arşiv sürümü kontrolü ve 546 bozuk katalog/kimlik/replay reddetmesi geçti. Mevcut fixture'ın seksen seçim ve dokuz deneme reddi örneği doğrudan kapsanır. Gerçek derleme .NET SDK 8.0.428 / C# 7.3 ile yapılmıştır. Uzak CI sonucu PR'ın en güncel kontrollerinden ayrıca raporlanmalıdır.

Fiziksel Unity, iOS/Android veya IL2CPP/AOT testi bu bağımsız .NET doğrulamasının parçası değildir. Bu aşama sahne veya mobil paket oluşturmaz; mevcut JavaScript üretim uygulamasına C# bağlanmaz.
