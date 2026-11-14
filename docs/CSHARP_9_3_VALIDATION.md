# Hexrota 9.3 — C# çekirdek doğrulama kapsamı

## Referans ve korunmuş veriler

Referans `main`: `c0383eea3ecfd63714bf4f7ebe0b8f6a79316020`. Dört kaynak dalı, `integration/hexrota-csharp-9-3` içinde birleştirildi. İlk birleşik kod başı `54e65aa`; bundan sonraki entegrasyon değişiklikleri yalnız dokümantasyondur.

`dist/`, `data/`, `fixtures/`, mevcut `unity/Gameplay/`, mevcut `unity/Rewards/`, `package-lock.json` ve Vercel/PWA yapılandırması referansla aynıdır. İki öğretici, on ana bölüm, kırk varyant ve seksen doğrulanmış yol korunur. Bölüm hedefleri, hamleler, fiyatlar ve `classic-v4` kuralları değişmedi. Web paket sürümü 9.2.0 ve mevcut servis çalışanı korunur; C# dosyaları web oyununa bağlanmaz.

## Gerçek C# karşılaştırmaları

Aşağıdaki yedi komut birleşik kodda .NET SDK 8.0.428 ile gerçekten derlenip çalıştırılmıştır; tamamı exit 0 vermiştir. Kaynaklar C# 7.3 olarak derlenir. SDK bulunamadığında JS sonucuyla başarı üreten geri dönüş yoktur.

| Komut | Gerçek karşılaştırma kapsamı |
| --- | --- |
| `npm run test:unity-gameplay` | 71 ortak mekanik örnek, 80 tam kazanma yolu, 120 rota dışı oyun; 1.913 geçerli takas, 256 kayıt devamı, 260 replay, 1.042 hatalı kayıt reddi. Ara eşleşme, taş üretimi, düşüş, katlar, RNG ve sonuç JSON'u karşılaştırılır. |
| `npm run test:unity-rewards` | 104 ortak vektör + durum fabrikası; fabrika dahil 98 geçerli ve 7 ret değerlendirmesi. |
| `npm run test:unity-catalog` | 2.107 tam JSON karşılaştırması; 725 seçim, 610 resume, 90 checkpoint, 80 tam sertifikalı yol, kimlik/veri sürümü ve bozuk kayıt sınırları. |
| `npm run test:unity-lives` | 344 derlenmiş istek; 19 ortak senaryo + 300 sonuçlu stres ile 460 geçiş, 152 frozen v1 geçişi, 172 ek kontrol; 102 ret ve 6 doğrulayıcı sırası kontrolü. |
| `npm run test:unity-hints` | 1.000 karşılaştırma; 80 yolun 680 durumu, 280 arama durumu, 11 saat politikası, 200 ipucu sonrası oynama. Her garanti bağımsız replay ile kazanır. |
| `npm run test:unity-reward-adapter` | 175 rota, 1.456 hamle, 2.928 dalga, 1.564 restore; Director girdisi, planı ve sonraki durum karşılaştırılır. |
| `npm run test:unity-session` | 580 event JSON karşılaştırması/462 birebir ret mesajı; 915 session JSON karşılaştırması/28 gerçek app.js akışı. Ayrıca ayrı sayılan 11 native hata/guard senaryosu. |

Sayılar aynı birimi ölçmez; vektör, hamle, geçiş, dalga ve hata senaryolarını tek bir “toplam test” sayısına toplamayın. Native hata invariantları doğrudan JS JSON parity adedine eklenmez.

## Oturum ve eski kayıtlar

`GameSessionController` ön izleme, yeni giriş/devam, hamle, ipucu, kazanma/kayıp, tekrar, onaylı restart, menü, kapatma/açma ve ilerleme sıfırlamayı yönetir. Repository testi aynı JS commit/read/failure dizisinde tam canonical profil/revision/aynaları karşılaştırır. Gerçek web akışlarının tamamında game, energy, kalıcı events, görünür deneme/snapshot ve RewardState karşılaştırılır. Web UI'nın ek aynı-veri yazım sayısıyla native tek-komut/tek-CAS sayısı eşitlenmez; bu açık ayrım [CSHARP_APPLICATION.md](CSHARP_APPLICATION.md) içinde açıklanır.

Eski orijinal bölüm, v4 indeks kaydırması, v3/v2 ilerleme, v4/v5 indeksli dizi konteynerleri, can ve sağlayıcı v1 geçişleri desteklenir. Mevcut bozuk/null kayıt yeni oyuncu sanılıp silinmez. Snapshot gerçek geçmişten oynatılır; metadata ve RNG doğrulanır. Kayıt hatasında oyun/can/cüzdan/olay birlikte geri alınır. Aynaların veya analitiğin yazılamaması başarılı canonical işlemi bozmaz.

İncelemede yakalanan ve regresyonu eklenen durumlar: eski tamamlanmış sağlayıcı görüntüsünün yeni işlemleri ezmesi, kapatılmış denemede giriş, sıfır canla onaylı restart, null can kaydı, indeksli dizi kaybı ve sınırsız canın giriş sırasında bitmesi. Asenkron host komutları gözlenen revision/attempt/turn zarfını taşımalıdır.

C# ipucu bağlayıcısı yanlış yazar rotasını tam replay ile reddeder; mevcut JS güvenilir yazar verisi varsayar. Bu ek native güven sınırı ayrı testtir. İptal edilmiş TEST makbuzu varsayılan olarak reddedilir. Kapanma sonrası doğrulanmış tamamlanma kurtarması, ayrı enjekte edilmiş güvenilir `IReceiptVerifier` ister; yerel provider JSON'u gerçek mali kanıt değildir.

## Web ve zorluk regresyon kapıları

Mevcut `npm test` korunur; veri üretim tutarlılığı, motor/öğretici/varyant/deneme/can/kayıt/arayüz/ses/PWA/ödül/playtest/entegrasyon ve 14 swap yaşam döngüsü kontrolünü çalıştırır.

| Komut | Kapsam |
| --- | --- |
| `npm run test:mobile-browser` (Chromium) | 40 kontrol; gerçek CDP touch, altı yön, titreme, kenar, capture/cancel, ölçek, ekran yönü, hızlı tekrar ve öğreticiler. |
| Aynı komut (WebKit) | 37 kontrol; WPE WebKit mobil geometri/gesture, native mouse hareketi ve touch tap. Fiziksel iOS dokunma taşıması değildir. |
| `npm run test:swap-visual` (her iki motor) | Motor başına 16 kontrol; iki taşın renk/sayı pikselleri başlangıç/orta/sonda, bağımsız eşleşme kaldırma ve geçici görsel temizliği. PNG ve piksel raporları CI artifact'ı olarak tutulur. |
| `npm run test:session-browser` | Chromium'da 5 grup; iki sekme kilidi, atomik kayıt kurtarma ve doğrulanmış reklam hakkı. |
| `npm run test:integration-browser` | Chromium'da 6 grup; birleşik giriş/kayıt/gözlem/PWA ve gerçek çevrimdışı bağımlılıklar. |
| `npm run test:observable` | 80 görünür tahta, 1.920 gizli RNG bağımsızlık karşılaştırması, 160 örneklenmiş karar ve 17.920 rapor denemesinin yeniden üretimi. Bot sonucu insan kazanma oranı değildir. |

Uzak çalıştırmaların gerçek sonucu ilgili PR'ın GitHub kontrollerinde bulunur. Son rapor, tamamlanmamış veya başarısız bir çalıştırmayı başarılı diye saymamalıdır.

## CI ve platform sınırları

Mevcut yedi Actions çalıştırması korunur. Yeni dört iş: C# katalog/deneme, C# can, C# ipucu/ödül adaptörü, C# uygulama/kayıt/olay. Böylece mobil matris dahil on bir Actions çalıştırması vardır. Her gerçek C# işi .NET 8 SDK kurar ve C# derler. Vercel Preview ayrı kontroldür; Production değişikliği veya PR birleştirmesi bu çalışma kapsamında yapılmaz.

Saf kaynaklar ayrıca C# 7.3/.NET Standard 2.1 hedefinde topluca derlenebilirlik açısından kontrol edilir. Bu Unity editörü/Mono/IL2CPP/AOT doğrulaması yerine geçmez. `ParitySupport` ve `*ParityHarness` yalnız test host'larıdır. Unity host'u JSON, gerçek atomik kalıcı IProfileStorage, giriş/sunum, ses/titreşim, yaşam döngüsü ve cihaz performans testlerini sağlamalıdır. Fiziksel iOS/Android, gerçek SDK ve native dosya yazımı sırasında ani kapanma henüz test edilmedi.
