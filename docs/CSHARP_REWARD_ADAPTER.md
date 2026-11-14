# C# ödül adaptörü — 9.3

`unity/RewardAdapter/RewardAdapter.cs`, mevcut `dist/reward-adapter.js` davranışını C# 7.3 ile uygular. Saf çekirdek yalnızca mevcut `unity/Gameplay/` ve `unity/Rewards/` türlerini kullanır. Saat, dosya, ağ, UnityEngine, ses veya animasyon bağımlılığı yoktur. JavaScript oyunu ve mevcut C# Gameplay/Reward Director dosyaları değiştirilmez.

## API ve veri sınırı

Namespace `Hexrota.RewardAdapterCore`:

| API | Çıktı |
| --- | --- |
| `RewardAdapter.RunsFor(LevelConfig, WaveFrame)` | `RewardRunFeatures`: `maxRun`, `runCount`, `crossAxes`. Üç eksenin kesişme üyelikleri sayılır; sayının sıfır/null olması birbiriyle karıştırılmaz. |
| `RewardAdapter.Summarize(level, before, result, after = null, tutorial = false)` / açık kimlikli `Summarize(level, before, result, after, attemptId, tutorial = false)` | Mevcut `RewardInput` ve sıralı `RewardWave[]`; başarısız/null takasta `null`. |
| `RewardAdapter.Restore(level, snapshot, rules, tutorial = false)` / açık kimlikli `Restore(level, snapshot, rules, attemptId, tutorial = false)` | `RewardRestoreResult`: yeniden hesaplanan `state` ve `lastPlan`. İlk durumda `lastPlan: null`. |

`LevelConfig`, gameplay aşamasında görsel/ürün metadata'sı taşımadığı için uygulama, katalogdaki `kind === "tutorial"` bilgisini `tutorial` argümanına aktarır. Sayısal kampanya ve dizge öğretici Level ID'leri host okuyucusunda türlerini korur. `attemptId` açıkça verilmezse JS'deki `String(level.id)` karşılığı kullanılır; kayıt devamında gerçek Attempt ID verilmelidir. Açık kimlikli overload, `null` veya boş dizgeyi varsayılan kimliğe çevirmeden korur; Director bu geçersiz kimliği yeniden oluşturma sırasında reddeder. Eksik argüman ve açık `null` ayrı test edilir.

Her dalgada eşleşen taş adedi, en uzun seri, seri sayısı, çapraz eksen sayısı, kazanç, yeni yeşil alan, temizlenen katlar, tamamen temizlenen çift katlar ve dalga sonrası puan/alan hesaplanır. Son girdi; hedef türü, puan, kalan hamle ve gerçek oyun durumunu içerir. `after` verilmezse JS'nin aynı yedek puan/hamle/status hesabı kullanılır.

Adaptör girişleri veya motoru değiştirmez. `Restore`, önceki hamleleri yeniden hesaplayarak Reward Director durumunu hazırlar; kendisi görsel/ses/titreşim yayımlamaz. Yüklemede `lastPlan` döndürülmesi, hostun eski ödülü yeniden oynatması gerektiği anlamına gelmez.

## Kayıt doğrulamasından farkı

JS adaptörü yalnızca `snapshot.history` alanını tüketir. Kayıtlı puan/değer/zemin/RNG'nin gerçek geçmişe uyduğunu doğrulayan yer `HexMatch.Restore` / `SaveValidator` katmanıdır. C# adaptörü bu sınırı korur; tam checkpoint doğrulamasının yerine kullanılmamalıdır. Uygulama önce oyun kaydını doğrular, ardından ödül durumunu aynı Attempt ID ile yeniden oluşturur.

JS'nin parametre yayma davranışı nedeniyle, ödül geçmişindeki bir çiftin ilk iki girdisinden sonraki girdiler adaptör düzeyinde kullanılmaz. Örneğin ilk iki indeksi yasal olan üç elemanlı bir çift burada yeniden oynatılabilir; oyun snapshot doğrulayıcısı ise böyle bir kaydı reddeder. Bu fark testte özellikle korunur. `null`/eksik veya diğer falsy geçmişler boş ödül geçmişi kabul edilir; tam uygulama kayıt katmanının bu toleransları geçerli kayıt sayması gerekmez.

## Gerçek karşılaştırma

```sh
npm run test:unity-reward-adapter
npm run test:unity-rewards
npm run test:unity-gameplay
```

Yeni komut gerçek .NET 8 SDK arar, C# 7.3 ile derler ve derlenen DLL'e JSONL gönderir. SDK yoksa başarısız olur; JS sonucunu C# sonucu yerine döndüren yol yoktur. `System.Text.Json` ve dosya/console işlemleri yalnızca `unity/RewardAdapterParityHarness/` test hostundadır. Ortak wire okuyucusu `unity/ParitySupport/WireJson.cs` ile paylaşılır.

Yerel .NET 8.0.428 çalıştırmasında:

- 175 rota: 80 tam sertifikalı varyant yolu, her varyantta iki ek politika ile 80 farklı yasal rota, iki öğretici/on orijinal yol ve üç varsayılan kimlik örneği.
- 1.456 hamle ve 2.928 dalganın tam `RewardInput`, Director planı/sonraki durumu ve oyun sonucu JSON'u eşleşti.
- 1.564 hamle öneki/boş geçmiş/bağımsız yükleme kontrolünde ödül durumu ve son plan yeniden hesaplandı.
- 16 bileşen/hedef-durumu örneği; uzun ve çapraz seriler, null değerler, başarısız takas, exact hedef altı/eşit/üstü ve hamle sonu.
- 86 bozuk/terminal sonrası rota, geçersiz açık kimlik veya geçersiz varsayılan kimlik bağlamı reddi. Açık `Reward history contains an invalid swap` nedeni de karşılaştırılır; doğal platform istisnalarının metni aynı ilan edilmez.
- 12 JS ipucu sınırında motor snapshot'ının değişmediği ve aynı ödül geçmişinin korunacağı kontrol edilir. Gerçek C# HintSolver ve ipucu sonrası oyun kompozisyonu ayrıca `test:unity-hints` / uygulama oturumu kontrollerinin konusudur; bu 12 örnek C# ipucu çalıştırması olarak sayılmaz.

Mevcut 104 ödül vektörü ve fabrika testi ayrı `test:unity-rewards` komutunda korunur. Bu adaptör testi, kural puanını değiştiren yeni ödül ekonomisi veya görsel sistem eklemez. Fiziksel Unity, IL2CPP, iOS ve Android çalıştırması bu saf .NET karşılaştırmasının kapsamında değildir.
