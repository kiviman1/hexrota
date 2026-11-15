# 9.5 aşama ve doğrulama kaydı

Başlangıç: `main` 670a83e ve zorunlu ürün şartnamesini ekleyen 289169c. Ürün şartnamesi değiştirilmez. Son kullanıcı talebindeki A/B/C/D sırası esas alınır: A ilerleme, B iki güçlendirici, C ikinci şans, D botanik ekran. Eski şartnamenin PR sıralaması bu son talepte yeniden gruplandırılmıştır.

## A — Tek seferlik ilerleme

Saf JS `dist/economy.js` ve C# `unity/Economy/` aynı veri/işlem sözleşmesini uygular. Katalogdaki sayı türündeki campaign ID'leri, öğretici string ID'lerinden ayrıdır. Menü ve JS/C# oturum sınırı yalnız sıradaki tamamlanmamış ana bölümü açar. Eski kanıt arşivleri ödülü doğrular ama oynanabilir giriş oluşturmaz. Kalıcı ekonomi sıradan resetten etkilenmez. TEST cüzdanı ayrıdır.

Yeni komutlar: `test:economy`, `test:unity-economy`, `test:progression-ui`, `test:economy-browser`. Sonuncusu gerçek Chromium/WebKit'te 320×568, 390×844 ve 844×390 boyutlarını kapsar. C# karşılaştırması gerçek .NET 8/C# 7.3 derlemesidir; SDK eksikse başarısızdır. Fiziksel iPhone/Android veya Unity/IL2CPP doğrulaması değildir.

PWA shell 25, yeni ekonomi bağımlılıklarını uygulamayla birlikte sürümler. Kimlik doğrulama sayfası, yabancı origin ve desteklenmeyen query için önbellek izinleri genişletilmez. Üretim dağıtımı değiştirilmez.

Yerel gerçek doğrulama: ekonomi 14 invariant grubu / 90 akış / 371 işlem; gerçek C# ekonomi 371 tam sonuç+durum karşılaştırması; oturum 915 tam karşılaştırma / 28 gerçek app.js akışı / 16 native guard; olay 580 tam karşılaştırma. Yeni ilerleme UI sekiz gruptur. Mevcut JS referans sürümü ayrı worktree üzerinde npm test ile geçti. PR CI ve son birleşik sonuçlar teslimde ayrıca kaydedilecektir; başlamış veya planlanan kontrol geçmiş sayılmaz.

## B/C/D ve Integration

Henüz bu A aşamasına bağlanmamıştır. B A'nın ekonomi/oturum kaydına, C B'nin sürümlü yardım komutuna, D A'nın kalıcı yıldızlarına dayanır. Her biri bağımlılığını açıklayan ayrı PR'da geliştirilecek; hiçbir PR onaysız birleştirilmeyecektir. Integration dalı bütün modülleri tekrar test edecektir.

PR #11 Balance Lab ayrı ve onaysızdır. Integration uyumluluğu ayrı geçici birleşimde sınanacak; laboratuvarın bellekteki oyunu normal profil, Attempt sayacı, Altın, yıldız, stok veya can üretmeyecektir. Yayımlanmış 40 varyant/80 rota ve classic-v4 çekirdeği korunur. Yeni ekonomi işlevleri, 9.4'ün önceki kaynak hash korumalarında meşru değişiklikler gerektirirse sadece bu onaylı kapsam yeni referansa alınır; donmuş oyun verileri ve izolasyon kontrolleri kaldırılmaz.
