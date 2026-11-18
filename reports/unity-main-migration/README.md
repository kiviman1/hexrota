# Unity aktarımı · ilk teslimin doğrulaması

Bölüm 1 iki öğreticiden sonra gerçek sahnede açıldı. Web ve Unity, aynı seçim tohumuyla aynı 19 taşı, zemini, deneme kimliğini ve başlangıç bakiyesini üretti. Editor PlayMode'da geçerli takas animasyonu tamamlandı ve ikinci takas da kabul edildi. [Portre görüntüleri ve karşılaştırılan kayıt](visual-comparison.md)

## Test edilen kaynak

- GitHub `main` tabanı ve Web referansı [b078da4](https://github.com/kiviman1/hexrota/commit/b078da49a0a1c9632195f13aefefad812e7f92ab).
- Unity Foundation 9.11 [PR #35](https://github.com/kiviman1/hexrota/pull/35) ve tahta yaşam döngüsü düzeltmesi [PR #40](https://github.com/kiviman1/hexrota/pull/40), [475587b](https://github.com/kiviman1/hexrota/commit/475587b) ile bu tabana alındı. FirstPlayable sahnesi ve sahne GUID'i #40 ile aynı. Prefab katalog referansları import testinden geçti.
- Test edilen oyun kaynakları [2bfbabd](https://github.com/kiviman1/hexrota/commit/2bfbabd20c18649ad4992f130bf4b22382b9e33d). Normal kampanya uygulama oturumuna, yardımlar ve kurtarma aynı kalıcı işlem sistemine bağlı. `unity/`, `data/`, `dist/` ve `src/` altında `main` ile fark yok.

## 18 Kasım 2026 koşumu

| Denetim | Sonuç | Neyi kapsıyor |
|---|---|---|
| Unity **6000.6.9f1** (8c45277fb9c5) EditMode | **19 geçti**, 0 başarısız, 0 atlandı | Temiz Git arşivinin ilk import'u, gerçek prefab/scene bağları, 40 varyantın tüm kayıtlı rotaları, T1/T2 + 10 bölümde aynı profili yeniden yükleyerek ilerleme, tekrar oynanan dersin geri yüklenmesi, kayıp ve ikinci şans. [NUnit çıktısı](EditMode.xml) |
| Aynı Editor'da PlayMode | **17 geçti**, 0 başarısız, 0 atlandı | Gerçek FirstPlayable sahnesi, T1/T2'nin yedi hamlesi, koç onayı ve yeniden açılış, Bölüm 1 taş/zemin renkleri ve takas, iki dokunma ve sürükleme, duraklat/devam, animasyon sırasında yok edilen objeler, sahne kapanışı, yardım kullanımı ve modal akışı. [NUnit çıktısı](PlayMode.xml) |
| JavaScript ↔ C# kanonik mekanik paritesi | Altı komut geçti | Engeller 217 senaryo, arşiv flow kataloğu 136, büyük tahtalar 50 mekanik + 103 katalog, malzeme motoru 196, malzeme kataloğu 156, Tavik hikâyesi 282. [Komut çıktıları](core-parity.txt) |
| Unity C#/.NET host | **9 grup**, **943 assertion** | 40 varyant ve 80 kazanma rotası, işlem öncesi/sonrası tahta, atomik dosya yazımı, depolama hataları ve tekil ödül. |
| Kaynak, sahne ve Web kayıt köprüsü | **33 C# + 15 JSON** bayt eşitliği, 1 üretilen ders metni, 6 yapı ve 10 depolama kontrolü | Kontrol senkron kaybını, benzersiz GUID'leri, çözülmeyen referansları ve Web Locks, kota ve eski revizyon davranışını denetler. |
| Portre görünümü | **3 Web/Unity çifti**, 390 × 844 | Ana menü, T1 ve Bölüm 1. Windows oyuncusunda GPU çizimi, Web'de yerel `main` sürümünün Chrome mobil görünümü. [Görüntüler ve yöntem](visual-comparison.md) |
| Unity WebGL / IL2CPP ve Chrome | Derleme ve tarayıcı denemesi geçti | Yerel HTTP üzerinden Web Lock ile açılış, gerçek Canvas üzerinde T1 takası, 6 puan, sayfayı yeniledikten sonra aynı tahta ve deneme, ardından kaydedilen koç onayı. [WebGL koşumu](webgl-verification.md) |

İki Editor koşumu `git archive 2bfbabd unity-client` ile dışa aktarılan, önceden `Library` veya kullanıcı ayarları içermeyen aynı proje üzerinde sırayla yapıldı. XML dosyalarında yalnızca yerel derleme yolunun kullanıcı dizini bölümü kısaltıldı. Standalone GPU görüntüleri ayrı bir koşumdan geliyor.

## Yeniden çalıştırma

Depo kökünde kaynak ve host kontrollerini çalıştırın.

```sh
node scripts/sync-unity-client.cjs --check
node scripts/check-unity-client.cjs
node scripts/check-unity-web-storage.cjs
node scripts/check-unity-runtime.cjs
```

.NET 8 SDK PATH üzerinden bulunamıyorsa `DOTNET_PATH` değişkeninde tam yürütülebilir yolu verin. Unity Hub'da `unity-client` dizinini 6000.6.9f1 ile açın. Test Runner'da önce EditMode, sonra PlayMode için **Run All** seçin. Her iki platformu komut satırından çalıştırmak için Bash ortamını kullanın.

```sh
UNITY_EDITOR_PATH=/path/to/6000.6.9f1/Editor/Unity bash scripts/run-unity-client.sh tests
```

## Kalan oyuncu akışları

Normal Web girişinde T1, T2 ve 1 ile 10 arasındaki kampanya bölümleri bulunur. 9.12 flow, 9.14 materyal ve 9.15 hikâye ekleri `main` üzerinde kendi inceleme girişleri ve kayıt alanlarıyla açılır. Bu PR bu sürümlerin C# modüllerini, JSON'larını ve rota testlerini Unity'ye alır. Oyuncunun Unity menüsünden bu girişlere ulaşması, engel ve materyal sunumu, kalıcı hikâye diyaloğu ve seçimleri sonraki aşamadadır.

Web'deki bölüm önizlemesi, tam sonuç ve harita görselleri, öğretici atlama, test reklamı, ses/titreşim tercihleri ve pasif ipuçları açık kalıyor. Android ve iOS fiziksel cihaz koşumu yapılmadı. Test ve kabul ölçütleri her özellik için ayrı kaydedildi. [Özellik matrisi](../../docs/UNITY_MAIN_FEATURE_MATRIX.md) · [Aktarım yol haritası](../../docs/UNITY_MAIN_PORT_ROADMAP.md)
