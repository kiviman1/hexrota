# 9.5 botanik ilerleme sunumu

`dist/garden.js`, kalıcı ekonomi görünümünden basit bir iki boyutlu bahçe üretir. Bahçe yeni bir kayıt, kaynak veya oyun modu değildir. Tamamlanan bölümleri yeniden açmaz; yıldız harcamaz ve ödül üretmez.

## Tek veri kaynağı

Host geçerli ekonomi durumunu `economyManager.view(state)` ile görünüme dönüştürür ve bu görünümü `HexGarden.describe(view)` / `HexGarden.markup(view)` fonksiyonlarına verir. Görsel modül yalnız `stars` ve `botanical` alanlarını okur; normal profil, kayıt, can, Altın, envanter, Attempt ID, saat, RNG veya ağ servislerine erişmez.

Eşikler `data/economy-config-9-5.json` → üretilmiş ekonomi yapılandırması → `Economy.view().botanical` yolundan gelir. Renderer ikinci bir sayısal eşik tablosu tutmaz. Mevcut yapılandırma:

| Kalıcı yıldız | Açılan görünüm |
| --- | --- |
| 0 | Hazır toprak ve boş ekim alanları |
| 2 | Çiçekler |
| 5 | Yeni bitkiler |
| 8 | Ağaçlar |
| 10 | Tamamlanmış bahçe, taş yol ve bahçe kemeri |

Her yeni katman öncekileri korur. İlerleme kalıcı ekonomi tamamlama defterinden türediği için uygulama kapatılıp açıldığında aynı yıldız sayısı aynı bahçeyi verir. Eski tamamlamanın kanıtı incelemedeyken yıldız verilmediyse yalnız doğrulanmış, verilmiş yıldızlar görselleştirilir; geçersiz tamamlama iddiasından bahçe ödülü uydurulmaz.

## API ve host sınırı

`describe(view)`: `stars`, `maxStars`, `tier`, `complete`, Türkçe `title`, `summary`, `accessibleLabel`, `unlockedIds`, sıradaki açılmanın `next` bilgisi ve dört `milestones` girdisini verir. Dönen nesne bağımsızdır; girdiyi veya kalıcı ekonomiyi değiştirmez.

`markup(view)`: aynı görünümü erişilebilir, ölçeklenebilir bir inline SVG string'ine çevirir. Sıfır yıldızda toprak görünür. SVG sabittir; görsel üretim servisi, harici varlık, animasyon, üç boyutlu sistem, sayfa içi oyun düğmesi veya bitmiş bölüm bağlantısı içermez. `role="img"`, Türkçe `aria-label`, `title` ve `desc` kullanır. Sabit `viewBox`, `width:100%;height:auto` ile telefon genişliğine sığar. Görsel içindeki katmanlar dekoratiftir; ekran okuyucu bütün bahçe özetini tek bir resim olarak okur.

Menüye dönüş, sıradaki açık bölüm ve “Yeni bölümler yakında” gibi akışlar mevcut host/controller sınırında yönetilir. Renderer hiçbir bölüm için `data-stage`, oynatma bağlantısı veya callback üretmez. Ekonomi/C# `View` zaten botanik açılmaları hesapladığından ikinci bir C# bahçe kural modeli eklenmez; Unity ileride aynı DTO'yu kendi görsellerine bağlar.

Bozuk görünüm, yanlış tipte yıldız, yinelenen/sırasız eşik, bilinmeyen katman, yıldızla tutarsız `unlocked` veya desteklenen son eşiği aşan yıldız `invalid_botanical_view` ile reddedilir. Host bu hatayı boş/starter bahçe diye sessizce kaydetmemeli; kayıt doğrulaması ve kullanıcıya güvenli hata davranışı mevcut oturum katmanında kalmalıdır.

## Test kapsamı

`node check-garden.cjs` gerçek ekonomi yöneticisiyle 0–10 yıldızın tamamını, yapılandırmadan türeyen dört katmanı, kampanya sonunu, tekrar üretilebilirliği, bağımsız çıktı nesnelerini, dondurulmuş girdi üzerinde yan etkisizliği, erişilebilir SVG yapısını ve bozuk görünüm reddini kontrol eder. Yasak storage/ağ/saat/RNG adaptörleriyle browser UMD giriş noktası ayrıca çalıştırılır. Sayısal eşiklerin renderer içinde kopyalanmadığı, yapay olarak kaydırılmış bir görünümle sınanır; bu test üretim ekonomi yapılandırmasını değiştirmez.

`node check-garden-ui.cjs` gerçek HTML/JS uygulamasını yükleyen **15 entegrasyon grubunu** çalıştırır: 0–10 doğrulanmış yıldızın tamamı, sıfır canla bahçeye erişim, canlı oynanmış tahta, kampanya sonu ve iki farklı eski kayıt inceleme durumu. Bahçe açma/kapatma ve yeniden yükleme Altın, yıldız, envanter, can, TEST cüzdanı, Attempt ID sayacı, taşlar, zemin, geçmiş veya RNG'yi değiştiremez. Kanıt bekleyen kapalı bölümler için yıldız uydurulmaz.

`HEXROTA_BROWSER=chromium node check-garden-browser.cjs` ve `HEXROTA_BROWSER=webkit node check-garden-browser.cjs` gerçek tarayıcı başına **9 mobil grubu** çalıştırır. 320×568 ekranda boş bahçe ve yapılandırmadaki bütün eşikler; 390×844 ve 844×390 ekranlarda tamamlanmış bahçe; inceleme bekleyen eski kayıt ve gerçek takas yapılmış deneme kontrol edilir. Kontroller tam viewport sınırlarını ve sabit alt menü/overlay üstünde gerçek hit-test erişimini doğrular; sadece DOM varlığı yeterli sayılmaz. Render edilmiş SVG geometrisiyle sayfa kaydırılır: WebKit'in SVG `scrollIntoView` metodunda asıl yükseklik ile CSS yüksekliğini farklı merkezlemesi, uygulama taşması diye yorumlanmaz.

Bu uygulama aşamasında 15 entegrasyon grubu ve **9 + 9 gerçek Chromium/WebKit grubu geçti**. Tarayıcı testleri aynı yıldızın yeniden yüklemede aynı SVG/katmanları ürettiğini, bitmiş bölümlere oynatma kontrolü çıkmadığını ve kaynak/kayıt izolasyonunu doğruladı. Yerel özel tarayıcı kurulumu varsa mevcut `HEXROTA_CHROMIUM_PATH` / `HEXROTA_WEBKIT_PATH` adaptörleri kullanılabilir; gerçek tarayıcı başlatılamazsa test başarısız olur. Ekran görüntüleri ve `results.json`, geçici çıktı dizinine veya `HEXROTA_GARDEN_SCREENSHOT_DIR` konumuna yazılır.

Fiziksel iPhone/Android, Unity sahnesi veya IL2CPP testleri yapılmadı. Yerel masaüstü WebKit çalıştırması fiziksel iOS Safari doğrulaması olarak sunulmaz.
