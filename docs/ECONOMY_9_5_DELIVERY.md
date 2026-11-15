# 9.5 aşama ve doğrulama kaydı

Başlangıç: `main` 670a83e ve zorunlu ürün şartnamesini ekleyen 289169c. Ürün şartnamesi değiştirilmez. Son kullanıcı talebindeki A/B/C/D sırası esas alınır: A ilerleme, B iki güçlendirici, C ikinci şans, D botanik ekran. Eski şartnamenin PR sıralaması bu son talepte yeniden gruplandırılmıştır.

## A — Tek seferlik ilerleme

Saf JS `dist/economy.js` ve C# `unity/Economy/` aynı veri/işlem sözleşmesini uygular. Katalogdaki sayı türündeki campaign ID'leri, öğretici string ID'lerinden ayrıdır. Menü ve JS/C# oturum sınırı yalnız sıradaki tamamlanmamış ana bölümü açar. Eski kanıt arşivleri ödülü doğrular ama oynanabilir giriş oluşturmaz. Kalıcı ekonomi sıradan resetten etkilenmez. TEST cüzdanı ayrıdır.

Yeni komutlar: `test:economy`, `test:unity-economy`, `test:progression-ui`, `test:economy-browser`. Sonuncusu gerçek Chromium/WebKit'te 320×568, 390×844 ve 844×390 boyutlarını kapsar. C# karşılaştırması gerçek .NET 8/C# 7.3 derlemesidir; SDK eksikse başarısızdır. Fiziksel iPhone/Android veya Unity/IL2CPP doğrulaması değildir.

PWA shell 25, yeni ekonomi bağımlılıklarını uygulamayla birlikte sürümler. Kimlik doğrulama sayfası, yabancı origin ve desteklenmeyen query için önbellek izinleri genişletilmez. Üretim dağıtımı değiştirilmez.

Yerel gerçek doğrulama: ekonomi 14 invariant grubu / 90 akış / 371 işlem; gerçek C# ekonomi 371 tam sonuç+durum karşılaştırması; oturum 915 tam karşılaştırma / 28 gerçek app.js akışı / 16 native guard; olay 580 tam karşılaştırma. Yeni ilerleme UI sekiz gruptur. Mevcut JS referans sürümü ayrı worktree üzerinde npm test ile geçti. A sabit worktree üzerinde tam npm test geçti; GitHub run43724110695 12/12 iş başarılı, Chromium/WebKit ekonomi ekranları yedişer grup geçti. PR #12 onaya hazırdır; birleştirilmedi.

## B — Güçlendirici komutları ve envanter

Bağımlılık A/PR #12; bu dal onun commit'ini içerir, main ile birleşmez. İki yardım, gerçek sonuç ön izlemesi, stok/purchase ve JS/C# oturum doğrulaması bağlanır. `test:commands`, `test:unity-commands`, `test:inventory-ui` eklenir; CI'da ayrı gerçek C# yardım komutu işi vardır. Klasik çekirdek byte'ları korunur. Komut karşılaştırması 2.928 tam JSON / 16.001 işlem / 3.259 dalga; C# oturum 1.005 tam karşılaştırma / 30 gerçek app.js akışı / 25 native guard geçti. Tam npm test geçti; envanter UI 11 grup, Chromium ve WebKit 15'er grup geçti. 320px envanter taşması gerçek tarayıcıda bulunup düzeltildi; sabit tahta boyutu doğrulandı. PWA shell26 `commands.js` dahil güncellenir. GitHub run43726136321 13/13 iş başarılı; PR #13 birleştirilmeden onaya açıktır. Ayrıntı: [INVENTORY_9_5.md](INVENTORY_9_5.md).

## C — Aynı denemede ikinci şans

Bağımlılık B/PR #13. TEST reklam UTC2/gün veya 140 oyun Altınıyla aynı denemeye tek grant_moves:5; tahta/RNG korunur, ikinci can kesilmez. Saf RescueManager 293 gerçek JS/C# karşılaştırması ve 600 settlement stres kontrolü geçti. C# oturum 1.190 tam JSON / 34 gerçek app.js akışı / 44 native senaryo geçti. Tam npm test geçti; ikinci şans UI son tam çalıştırması 15 grup / 169 gerçek UI takası / 22 kayıp / 4 reload geçti. Chromium/WebKit 21'er grup geçti. Sıfır can, kanıt yeniden teslimi ve meşru discarded arşivleri doğrulanır. Yeni test:rescue/test:unity-rescue/test:second-chance-ui ve ayrı gerçek C# CI işi, PWA shell27. GitHub run43728914490 14/14 iş başarılı; PR #14 açık, birleştirilmedi.

## D — Kalıcı botanik görünüm

A'nın yıldız DTO'sunu kullanır; uygulama dalı B/C'yi de içerir, bağımlılık açıkça taşınır. `dist/garden.js` yalnız görünüm üretir; ayrı bir C# kural kopyası yoktur, C# Economy.View zaten aynı eşikleri verir. 0 yıldızda toprak; 2 çiçek, 5 bitki, 8 ağaç, 10 tam bahçe. İnceleme bekleyen eski kapanmış bölüm, doğrulanmış yıldız yoksa sahte tamamlanmış bahçe üretmez. Önceki bölümler oynanabilir olmaz.

Saf 11 yıldız durumu / 55 render / 44 eşik / 17 bozuk veri; gerçek UI 15 grup, Chromium 9 ve WebKit 9 grup geçti. Tam npm test geçti. Küçük/dikey/yatay ekran, sabit menü üstünde gerçek erişilebilirlik ve canlı oyun/profil izolasyonu doğrulandı. GitHub run43730180915 14/14 iş başarılı; PR #15 açık, birleştirilmedi. PWA shell28 bahçe modülünü önbelleğe alır. Ayrıntı [BOTANICAL_PROGRESS_9_5.md](BOTANICAL_PROGRESS_9_5.md).

## Integration

`integration/hexrota-economy-9-5` güncel main670a83e üzerinden oluşturuldu. A52b8419/PR12, B9d6136c/PR13, C8f3ac5c/PR14, D1d56e54/PR15 değişiklikleri yerel Integration merge commit'leriyle toplandı; GitHub PR'ları veya main birleştirilmedi. Runtime/data/unity ağacı D ile birebir aynı, Integration'ın ek farkı izolasyon testi/CI ve bu doğrulama kaydıdır.

CI mevcut14 işi korur, ayrı `Balance Lab economy isolation` işi ekler. Bu iş PR11'in sabit85bc092 commit'ini yalnız fixture olarak ikinci checkout'a alır; gerçek Chromium ve WebKit'te yeni ekonomi profilini korur. Test kaynağı yoksa atlama/başarı taklidi yapmaz. Birleşik runtime üzerinde yerel tam npm test ve aşağıdaki bütün gerçek C# komutları tekrar geçti. Pinned Lab son tekrarı 6 Chromium + 6 WebKit grup, 81 değişmez dosya / 10 profil anahtarı geçti. Güncel CI ve Preview durumunun kaynağı Integration PR Checks ekranıdır.

Hiçbir PR onaysız birleştirilmez; Production değiştirilmez.

PR #11 Balance Lab ayrı ve onaysızdır. Integration uyumluluğu ayrı geçici birleşimde sınanacak; laboratuvarın bellekteki oyunu normal profil, Attempt sayacı, Altın, yıldız, stok veya can üretmeyecektir. Yayımlanmış 40 varyant/80 rota ve classic-v4 çekirdeği korunur. Yeni ekonomi işlevleri, 9.4'ün önceki kaynak hash korumalarında meşru değişiklikler gerektirirse sadece bu onaylı kapsam yeni referansa alınır; donmuş oyun verileri ve izolasyon kontrolleri kaldırılmaz.

## Açık ürün/teknik sınırlar

- Kanıtsız eski tamamlamalar kapalı ve incelemede kalır; otomatik destek/hesap servisi yoktur. Kanıtlı geçiş yalnız bir kez ödüllenir.
- Toplam ilk 10 bölüm kaynağı 200 Altın; 140 Altınlık kurtarma normalilk gelirle en erken 7 bitiş sonrası mümkündür, diğer harcamalar daha da geciktirir. Fiyatlar pilot değeridir; ekonomi kaynağı artırılmadı.
- Renk Anahtarı gerçek sonuç ön izlemesi ücretsiz/iptal edilebilirdir; farklı hedefleri araştırmanın denge etkisi insan testinde ölçülmelidir.
- Yardımlı denemede klasik Director v1 yoğunluğu yerine temel gerçek dalga sunumu kullanılır. Eski Playtest export'u bütün yardım komutlarını içermez; tam sınıflama canonical ledger gerektirir.
- Yerel kayıt manuel veri silme/değiştirme veya zorla eski uygulama çalıştırmaya karşı hesap otoritesi değildir. Gerçek makbuz, hesap taşıma ve platformun atomik dosya adaptörü ayrı çalışmadır.
- Gelecekte fiyat/limit değişiminden önce yayımlanmış ekonomi fiyat/politika arşivi gerekir; bilinmeyen fiyat sürümü şu an güvenle reddedilir.
- Fiziksel iOS/Android, Unity sahnesi/Mono/IL2CPP ve canlı reklam/ödeme SDK'ları denenmedi.

## Birleşik sürümde gerçek karşılaştırmalar

| Komut | Doğrulanan sonuç |
| --- | --- |
| `npm test` | Tam JS/konfigürasyon/80 sertifika/40 varyant, mevcut UI+PWA+can/kayıt, yeni ekonomi/envanter/ikinci şans/bahçe geçti |
| `test:unity-gameplay` | 71 ortak mekanik + 80 tam sertifika + 120 rota dışı koşu; 1.913 geçerli takas/ara sonuç |
| `test:unity-catalog` | 2.107 tam JSON karşılaştırması |
| `test:unity-hints` | 1.000 deterministik karşılaştırma; gerçek garantiler tekrar oynatıldı |
| `test:unity-rewards` | 104 ortak vektör ve state factory |
| `test:unity-reward-adapter` | 175 rota/1.456 tur/2.928 dalga; tam girdi/plan/durum/restore |
| `test:unity-lives` | 344 derlenmiş istek; 460 geçiş, 152 eski v1 geçişi, 172 ek probe |
| `test:unity-economy` | 90 akış / 371 tam sonuç+durum |
| `test:unity-commands` | 2.928 tam JSON / 16.001 işlem / 3.259 dalga |
| `test:unity-rescue` | 293 tam JSON / 600 derlenmiş stres settlement'ı |
| `test:unity-session` | 1.190 tam JSON / 34 gerçek app.js akışı + 44 ayrı native guard; olay 580/462 |
| `test:balance-lab-economy` | 6 Chromium + 6 WebKit, sabit PR11 ile 81 korunan dosya/10 kayıt anahtarı |

Bütün C# testleri gerçek .NET 8.0.428 / C# 7.3 derlemesidir; SDK eksikliğinde JS yedeği yoktur. Sayılar üst üste binen kapsamlar içerir, tek insan kazanma oranı veya bağımsız toplam test sayısı gibi toplanmaz. İlk paralel ağır testlerde iki mevcut yerel UI süre sınırı doldu; sakin tam tekrarlar ve temiz A–D CI geçti, sınırlar gevşetilmedi. Son birleşik yerel koşuda açık başarısız test yoktur. Fiziksel cihaz/Unity testleri bu tablodan çıkarılamaz.
