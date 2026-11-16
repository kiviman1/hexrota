# Hexrota — ilk açılış ve oynayarak öğrenme

İlk oynanış sadeleştirilir; `classic-v4`, sabit T1/T2 verileri, bölüm hedefleri, can ve kampanya ilk-tamamlama kuralları korunur. Son kullanıcı isteğiyle ayrı, tek seferlik başlangıç hediyesi ve açık onaylı prototip veri silme işlemi eklenmiştir. Mevcut snapshot/profil zarfı sürümleri ve geçerli eski kayıtlar korunur.

## Akış

| An | Oyuncunun gördüğü | Gerçek eylem / sonuç |
| --- | --- | --- |
| İlk ziyaret | Tavik, kısa bir davet, **Başlayalım** | Ek açıklama penceresi açılmadan T1 başlar. Menü, can ve para seçenekleri bu davette gösterilmez. |
| T1: ilk eşleşme | **Yeşert 0 / 7**, **5 hamle**, parlayan iki taş ve yavaş kaydırma | Oyuncu 2 ile 1'in yerini değiştirir. Üç 2 eşleşir; 6 puan ve 3 yeşil yer oluşur. |
| İlk sonuç | Kısa sonuç cümlesi ve **Devam et** | Oyuncu sonucu gördüğünü onaylamadan sonraki zorunlu kaydırma açılmaz. Mevcut `0:1` öğretici onayı korunur. |
| T1 devamı | Bir eşleşme daha, ardından son iki yer | Yeni taşlar gelirken yeşeren yerlerin kaldığı gösterilir. Yedi yer yeşerince tek devam düğmesi çıkar. |
| T2 | İki hedef ve 6 hamle; sırayla çift kat, zincir ve hedef puan | İki noktanın iki eşleşme istediği, zincirin ek hamle harcamadığı ve puan ile yeşil alanın birlikte tamamlanması öğretilir. Mevcut `1:1` / `1:3` onayları korunur. |
| T2 sonrası | **İlk hediyen hazır!**, açılan sandık ve **+20 Altın → İlk bölüme başla** | İlk gerçek kazanımda ayrı başlangıç hediyesi aynı atomik kayda işlenir. Yıldız verilmez. Öğreticiyi tekrar oynamak ikinci hediye vermez. |
| İlk ana bölüm kazanımı | Mevcut gerçek **+20 Altın / +1 yıldız** ödülü | Mevcut atomik, tek seferlik ekonomi işlemi kullanılır. Kampanya ödülü başlangıç hediyesinden ayrıdır; öğretici tekrarı yeni ödül vermez. |

İlk davet yalnız yüklenen kayıtta tamamlanma, tahta, deneme metadata'sı ve deneme seri sayacı yoksa gösterilir. Kontrol açılıştaki ön izleme hazırlanmadan yapılır. Mevcut oyuncular normal menüye ve kayıtlarına döner; bozuk kayıt yeni oyuncu sayılmaz. Yeni deneme ancak oyuncu düğmeye bastığında başlatılır.

## Sunum ve giriş sınırları

- `dist/first-play.js`: kısa Türkçe ders metinleri ve **yalnız görsel** gösterim. Motor, RNG, kayıt, can ve ekonomi erişimi yoktur.
- Gösterim, gerçek hücrelerden alınan iki `.gem` kopyasını ayrı bir SVG katmanında 3.800 ms döngüyle karşılıklı hareket ettirir. Sabit zeminlerin üstünde, elin altında çizilir. Geometri ve iki yönlü yollar mevcut `HexBoardView` üzerinden gelir.
- Oyuncu gösterimin bitmesini beklemek zorunda değildir. Gerçek dokunma/kaydırma gösterimi kaldırır; mevcut `HexBoardInput` ve gerçek takas doğrulaması çalışır. İki taşa sırayla dokunma korunur.
- Gösterim bir takas yapmaz; puan, RNG, hamle, can, onay veya ödül üretmez. Tur değişimi, gerçek animasyon, menü/diyalog, arka plan, sayfa kapanışı ve yeniden çizim kopyaları temizler. Kaynak taşların görünürlüğü geri alınır.
- Azaltılmış hareket tercihinde yalnız sabit vurgu ve yön oku kalır. Animasyon API'si yoksa veya gösterim hata verirse gerçek tahta kullanılabilir kalır.
- Öğretici bilgi kartının yüksekliği sonuç onayında ve animasyon sırasında sabittir; tahtanın alanı daraltılmaz. Kalıcı alt açıklama şeridi ve animasyon atlama düğmesi eklenmez.
- Öğreticide yalnız Menü ve Mola kısa kontrolleri görünür. Mola içinden ayarlara ulaşılır. Ana bölümlerin kontrol çubuğu değişmez.
- Öğretici bitişinde tek sonraki görev düğmesi vardır. Tekrar oynama ana menüdeki mevcut öğretici seçeneğiyle mümkündür.

## Test ve dağıtım

`node check-onboarding.cjs`, `node check-first-play.cjs` ve `npm run test:first-play` ilgili sözleşmeleri doğrular. Son komut gerçek Chromium veya `HEXROTA_BROWSER=webkit` ile WebKit kullanır. Ekran görüntüleri ve sonuçlar `test-results/first-play-{browser}` altında üretilir; kişisel veri veya tarayıcı oturumu kaydedilmez.

Yeni tarayıcı testi 320×568, 390×844, 844×390 ve 1280×900 görünümünde ilk açılışı; gerçek dokunuşlarla iki öğreticiyi, ilk kampanya ödülünü ve yavaş gösterimde piksel değişimini kontrol eder. Gösterim öncesi/sonrası motor snapshot'ı karşılaştırılır. Mevcut mobil giriş, takas görünürlüğü, atomik kayıt ve C# karşılaştırmaları ayrıca çalıştırılır.

PWA paketi v34'tür; yeni modül HTML bağımlılık sırasına, çevrimdışı önbelleğe ve test yükleyicisine eklenmiştir. Bu bir kayıt veya oyun kuralı sürümü değildir. Dağıtım önce ayrı feature PR / Preview ile doğrulanır; Production yayını için kullanıcı onayı gerekir.

Otomatik WebKit testi fiziksel iPhone Safari testi yerine geçmez. İlk gerçek oyuncu denemesinde açıklama yapmadan şu üç gözlem alınmalı: ilk doğru kaydırma, puan ile yeşil alanın farkını anlatabilme ve ilk ana bölümde bağımsız bir eşleşme. Takılma varsa önce hangi ekrana/dokunuşa takıldıkları kaydedilmeli; bölüm dengesi bu sunum değişikliğinin içinde değiştirilmemelidir.

## Yeniden deneme için tam sıfırlama

Ayarlar → Geliştirme testi → **Test için her şeyi sıfırla**. Ayrı onaydan sonra öğreticiler, bölüm ilerlemesi, Altın, yıldız, çanta, can, TEST cüzdanı ve yerel gözlemler yeni oyuncu durumuna döner; sayfa otomatik yeniden açılır. Normal açık-deneme sıfırlaması ve ödül hakları değişmez. Teknik güvenlik ve testler: `WELCOME_REWARD_AND_TEST_RESET.md`.
