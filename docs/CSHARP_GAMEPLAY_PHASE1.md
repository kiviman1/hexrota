# C# Gameplay Core — Phase 1

## Uygulanan sınır

`unity/Gameplay/` mevcut `classic-v4` mekaniklerinin saf C# 7.3 karşılığıdır. Web uygulaması JavaScript motorunu kullanır; bölüm verileri, 40 varyant, kayıt anahtarları, can sistemi ve mevcut ödül dosyaları değişmez. Bu çalışma Unity sahnesi, mobil paket veya C# uygulama akışı oluşturmaz.

| Dosya / API | Sorumluluk |
| --- | --- |
| `GameplayTypes.cs` | `Cell`, `LevelConfig`, `GameSnapshot`, `SwapResult`, `WaveFrame`, `GravityResult`, `FallTile`, unsigned `XorShift32`. |
| `BoardTopology.cs` | Axial komşuluk, üç eksendeki sıralı çizgiler, `q`/`r` sıralı düşüş sütunları. |
| `HexMatch.cs` | Geçerli/geçersiz takas, eşleşme, kat/puan, kontrollü taş üretimi, zincirler, yeniden karıştırma, win/loss, snapshot, clone, replay ve restore. |
| `HexMatch.Replay(config, history)` | Aynı başlangıçtan her takası doğrulayarak yeniden oynatır; geçersiz rota reddedilir. |
| `HexMatch.Restore(snapshot)` | Biçim ve geçmiş doğrulamasından sonra bütün motor durumunu karşılaştırır; reddedilen yükleme mevcut oyunu değiştirmez. |

Çekirdekte UnityEngine, DOM, dosya sistemi, saat, cihaz, ses, animasyon, depolama veya JSON kütüphanesi bağımlılığı bulunmaz. JSON/console/build işleri ayrı `unity/GameplayParityHarness/` .NET 8 test adaptöründedir. `LevelConfig` çözülmüş bir bölüm alır; motorun içine katalog veya varyant seçimi sokulmaz.

## Tel sözleşmesi

Mevcut alan adları ve hücre dizisi sırası korunur. `GameSnapshot` v4 ve `classic-v4` aynıdır; yeni kayıt sürümü oluşturulmadı. RNG `uint`; taş ve sıkıştırma dizileri `int?[]`, düşüş kaynağı nullable `int` olur. `falls.from: null` yeni taş anlamındadır. `spawnOrder`/`spawnCount` yalnızca yeni üretilen taşlarda yazılır; kalan taşların kaydına `null` alanlar eklenmez. Başarısız takasta JS'nin `reason` değeri ve sıfır durum değişimi korunur; başarılı takasta `reason: null` korunur.

Bir dalgada `matched`, `before`, `after`, `layers`, `scoreGain`, `compacted`, `refill`, `falls` karşılaştırılır. Her düşüşün kaynak/hedef indeksi, değeri, yeni taş olup olmadığı ve üretim sırası karşılaştırmanın parçasıdır. Taş, palet, hücre, eşleşme, dalga, hamle ve düşüş dizilerinin sırası anlamlıdır; JSON nesnesi anahtar sırası anlamlı değildir.

Test adaptörü snapshot alanlarını varsayılan CLR sıfırlarıyla doldurmaz: bütün zorunlu anahtarları ve sayısal türlerini okumadan `Restore` çağırmaz. `id` sayı/dizge ayrımı testte `JsonElement` olarak korunur; bu çekirdek kimliği yorumlamaz. Gelecekteki üretim okuyucusu aynı zorunlu alan, nullable ve unsigned kurallarını uygulamalı, typed deneme kimliği doğrulaması ayrıca yapılmalıdır.

Yayımlanmış bölüm kümesindeki sayılar, puanlar, hamle ve indeksler `Int32` sınırındadır. Bu aşama bu veri alanı için doğrulanmıştır; sınırsız JS sayıları veya keyfi harici yapılandırmalar için eşdeğerlik iddiası yoktur. Daha büyük puan/değer alanı gerekiyorsa tipler ve ortak testler birlikte genişletilir.

## Çalıştırılan parity

```sh
npm run test:unity-gameplay
npm run test:unity-rewards
npm test
```

Gameplay komutu .NET 8 SDK arar, C# 7.3 ile gerçekten derler, JSONL isteklerini derlenen DLL'e yollar ve bütün JSON sonucunu `assert.deepEqual` ile karşılaştırır. SDK yoksa kontrol başarısızdır; JS sonucunu C# sonucu gibi gösteren geri dönüş yoktur. İstenirse SDK yolu `DOTNET_PATH` ile verilir. Derleme çıktıları geçici klasörde tutulup temizlenir. GitHub Actions'ta mevcut iki işe ek ayrı `C# gameplay parity` işi vardır.

Referans `fixtures/gameplay-vectors.json` değiştirilmez. Önce JS'nin hâlâ bu sabit beklentileri verdiği doğrulanır; sonra C# karşılaştırılır. Ek uzun rota beklentileri değişmeyen JS motoruyla aynı veri/tohum/hamlelerden hazırlanır.

| Karşılaştırma | Doğrulanan kapsam |
| --- | --- |
| Ortak fixture mekanikleri | 71 örnek; T1/T2, 10 orijinal yol, 40 varyant öneki, eşleşme/RNG/zemin/zincir/düşüş/üretim/karıştırma bileşenleri. |
| Tam doğrulanmış yollar | Her varyantın iki farklı ilk takasından başlayan 80 yolun tamamı, gerçek kazanma sonucuna kadar. |
| Ek rota gerilemesi | Bütün 40 varyantta üç sabit karar tohumu: 120 yasal hamle dizisi, 1.150 takas. Bunlar insan başarısı ölçümü değildir. |
| Geçerli takaslar | Toplam 1.913; bütün ara dalgalar, üretilen taşlar, katlar, RNG ve sonuç durumları. |
| Yükleyip devam etme | 256 tam aynı snapshot devamı; devamdan sonraki bütün üretim ve sonuçlar karşılaştırılır. |
| Açık replay | 260 rota için `HexMatch.Replay` sonuç snapshot'ı; dört geçersiz başlangıç takası örneğinin boş geçmişi dahil. |
| Klon | 2.172 klonda değer/kat/iç içe geçmiş bağımsızlığı; 1.912 sonraki takas önce klonda uygulanır, orijinalin değişmediği ve tam sonucun eşit olduğu doğrulanır. |
| Reddedilen motor kaydı | 1.042 eksik, yanlış tür/sürüm veya replay ile uyuşmayan snapshot; önceki yüklenmiş durumun bozulmadığı doğrulanır. |

Yerel gerçek çalıştırma .NET SDK 8.0.428 ile bu kontrolleri geçmiştir. PR'ın uzaktaki CI sonucu ayrıca raporlanmalıdır; yerel başarı CI veya Unity cihaz testi yerine geçmez.

## Açık kalan kapsam

Ortak fixture içindeki **ipucu önerileri**, **80 varyant-seçici örneği** ve **9 deneme-zarfı reddetmesi** C# Phase 1 karşılaştırmasına dahil değildir. Mevcut JS `npm test` bunları doğrular. `HintSolver`, `VariantSelector`, `HexAttempts`, eski uygulama kayıt geçişleri, LifeManager, ekonomi ve kalıcı saklama adaptörleri henüz C# portu değildir. Mekanik kısmı geçen bir fixture'ın ipucu alanları da C# tarafından kontrol edilmiş gibi sayılmaz.

Karıştırma örneği ve ek yollar bütün nadir geri dönüşlerin çalıştırıldığı anlamına gelmez. Özellikle 32 dalga güvenlik sınırı, tüm stabil kurulum geri dönüşleri ve aşırı yapılandırmalar için ilave adversarial testler gerekir. Fiziksel Unity/iPhone/Android performansı, IL2CPP/AOT, Unity JSON okuyucusu, giriş ve uygulama yaşam döngüsü bu bağımsız .NET çalışmasının doğrulamadığı alanlardır.
