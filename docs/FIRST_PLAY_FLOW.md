# Hexrota — ilk açılış ve oynayarak öğrenme

İlk oynanış sadeleştirilir; `classic-v4`, sabit T1/T2 verileri, bölüm hedefleri, can ve kampanya ilk-tamamlama kuralları korunur. Tavik'in güneşli kümes sahnesi bu gerçek oyunun sunumudur; yeni bir örnek tahta veya oyun hedefi değildir. Ayrı, tek seferlik başlangıç hediyesi ve açık onaylı prototip veri silme işlemi korunur. Mevcut snapshot/profil zarfı sürümleri ve geçerli eski kayıtlar değişmez.

## Akış

| An | Oyuncunun gördüğü | Gerçek eylem / sonuç |
| --- | --- | --- |
| İlk ziyaret | Güneşli arazi, araziyi inceleyen Tavik, **Tavik’in ilk kümesi.**, kısa konuşma ve **Başlayalım** | Oyuncu giriş hareketini beklemeden düğmeye dokunabilir; ek açıklama penceresi açılmadan gerçek T1 başlar. Menü, can ve para seçenekleri bu davette gösterilmez. |
| T1: ilk eşleşme | **Yeşert 0 / 7**, **5 hamle**, parlayan iki taş ve yavaş kaydırma | Oyuncu 2 ile 1'in yerini değiştirir. Üç 2 eşleşir; 6 puan ve 3 yeşil yer oluşur. |
| İlk sonuç | Kısa sonuç cümlesi ve **Devam et** | Oyuncu sonucu gördüğünü onaylamadan sonraki zorunlu kaydırma açılmaz. Mevcut `0:1` öğretici onayı korunur. |
| T1 devamı | Bir eşleşme daha, ardından son iki yer | Yeni taşlar gelirken yeşeren yerlerin kaldığı gösterilir. Yedi yer yeşerince tek devam düğmesi çıkar. |
| T2 | İki hedef ve 6 hamle; sırayla çift kat, zincir ve hedef puan | İki noktanın iki eşleşme istediği, zincirin ek hamle harcamadığı ve puan ile yeşil alanın birlikte tamamlanması öğretilir. Mevcut `1:1` / `1:3` onayları korunur. |
| T2 sonrası | **İlk hediyen hazır!**, açılan sandık ve **+20 Altın → İlk bölüme başla** | İlk gerçek kazanımda ayrı başlangıç hediyesi aynı atomik kayda işlenir. Yıldız verilmez. Öğreticiyi tekrar oynamak ikinci hediye vermez. |
| İlk ana bölüm kazanımı | Mevcut gerçek **+20 Altın / +1 yıldız** ödülü | Mevcut atomik, tek seferlik ekonomi işlemi kullanılır. Kampanya ödülü başlangıç hediyesinden ayrıdır; öğretici tekrarı yeni ödül vermez. |
| Kalıcı kampanya ilerlemesi | Yıldız eşiğine göre arazinin sonraki kümes görünümü | Aşama yalnız başarılı atomik kayıttan gelen yıldızlarla açılır. İnşa hareketi, görsel yüklenmesi veya kutlama yeni ilerleme üretmez. |

İlk davet yalnız yüklenen kayıtta tamamlanma, tahta, deneme metadata'sı ve deneme seri sayacı yoksa gösterilir. Kontrol açılıştaki ön izleme hazırlanmadan yapılır. Mevcut oyuncular normal menüye ve kayıtlarına döner; bozuk kayıt yeni oyuncu sayılmaz. Yeni deneme ancak oyuncu düğmeye bastığında başlatılır.

## Güneşli arazi ve Tavik

Girişte önce etkin arka plan ve Tavik'in idle pozu yüklenir; ardından hazır inspect pozu ve **“Buraya bir kümes kuralım!”** konuşması gösterilir. Konuşma güvenli alana sığmıyorsa dekoratif balon gizlenir; başlık ve **Başlayalım** erişilebilir kalır. Zorunlu bekleme yoktur. Başlayalım aynı dünya görseli üzerinde mevcut SVG tahtasını açar; mevcut kaydırma gösterimi çalışırken Tavik öğretici çiftine doğru işaret eder. Taşlar, sayılar ve asıl hedefler öğretici verilerinden gelir; kümes için ayrı toplanabilir parça eklenmez.

Sunum `dist/scene-presentation.js` içindedir. `app.js` modüle motor yerine salt görünüm bilgisi ve son başarılı kanonik kaydın yıldız sayısını iletir. Ana menüden oyuna geçişte dünya ve Tavik yeniden oluşturulmaz; görünüm sahibi değişir. Kayıttan dönen oyuncu zorunlu giriş veya yeniden ödül görmez. Eşikler `data/scene-config-v1.json` dosyasında tek kaynakta tutulur; `node sync-scene-config.cjs` tarayıcı çıktıları `dist/scene-config.json` / `.js` dosyalarını üretir:

| Kampanya yıldızı | Görünüm |
| --- | --- |
| 0–1 | Güneşli boş arazi (`clearing`) |
| 2–4 | Kümes iskeleti (`frame`) |
| 5–9 | Çatılı kümes (`roof`) |
| 10 ve üstü | Tamamlanan kümes (`finished`) |

Öğreticiler yıldız üretmez; T2'nin başlangıç Altını bu tabloyu ilerletmez. Bu eşikler yeni bir ekonomi veya kayıt sürümü değildir. Bahçe verisi ve mevcut hikâye menüsü korunur; gelecekteki diğer tavukları kurtarma fikri yalnız kapalı bir yapılandırma uzantısıdır.

Arka planlar birbirine hizalı inşaat katmanları değildir; 140 ms beklemeli kısa kararmayla değiştirilir, üst üste yapı parçaları gibi canlandırılmaz. Karartma gerçek tahtanın altındadır. Tavik gerçek hücreleri, HUD'u ve öğretici kartını örtmeyecek güvenli alana yerleşir. Dar öğretici ekranlarda mevcut Menü/Mola boşluğundaki küçük statik yerleşim kullanılabilir; alan yoksa dekoratif karakter gizlenir. Tahta ve dokunma alanı bu nedenle küçültülmez.

Sekme gizlenmesi, açık diyalog ve mola hareketi durdurur. Azaltılmış hareket tercihinde sabit poz ve anlık sahne geçişi kullanılır. Ekran kapanışında geçici düğümler, dinleyiciler ve zamanlayıcılar temizlenir; gecikmiş görsel yanıtları yeni sahneye yazamaz. Görsel host `pageshow` ile yeniden kurulabilir; mevcut kayıt deposu gerçek BFCache dönüşünde (`pageshow.persisted`) sayfayı yeniden yükleme ve yazıcı sahipliğini yeniden alma politikasını korur. Yeni bir BFCache kayıt akışı eklenmemiştir. Başarısız görsel yüklemesi onaylı portre/önbellekteki clearing/statik renge düşer; gerçek oyunu veya ödül akışını engellemez. Hazır hareket kodu kesit animasyonudur; yürüme döngüsü veya 3B rig eklenmemiştir.

## Sunum ve giriş sınırları

- `dist/first-play.js`: kısa Türkçe ders metinleri ve **yalnız görsel** gösterim. Motor, RNG, kayıt, can ve ekonomi erişimi yoktur.
- Gösterim, gerçek hücrelerden alınan iki `.gem` kopyasını ayrı bir SVG katmanında 3.800 ms döngüyle karşılıklı hareket ettirir. Sabit zeminlerin üstünde, elin altında çizilir. Geometri ve iki yönlü yollar mevcut `HexBoardView` üzerinden gelir.
- Oyuncu gösterimin bitmesini beklemek zorunda değildir. Gerçek dokunma/kaydırma gösterimi kaldırır; mevcut `HexBoardInput` ve gerçek takas doğrulaması çalışır. İki taşa sırayla dokunma korunur.
- Gösterim bir takas yapmaz; puan, RNG, hamle, can, onay veya ödül üretmez. Tur değişimi, gerçek animasyon, menü/diyalog, arka plan, sayfa kapanışı ve yeniden çizim kopyaları temizler. Kaynak taşların görünürlüğü geri alınır.
- Azaltılmış hareket tercihinde yalnız sabit vurgu ve yön oku kalır. Animasyon API'si yoksa veya gösterim hata verirse gerçek tahta kullanılabilir kalır.
- Öğretici bilgi kartının yüksekliği sonuç onayında ve animasyon sırasında sabittir; tahtanın alanı daraltılmaz. Kalıcı alt açıklama şeridi ve animasyon atlama düğmesi eklenmez.
- Öğreticide yalnız Menü ve Mola kısa kontrolleri görünür. Mola içinden ayarlara ulaşılır. Ana bölümlerin kontrol çubuğu değişmez.
- Öğretici bitişinde tek sonraki görev düğmesi vardır. Tekrar oynama ana menüdeki mevcut öğretici seçeneğiyle mümkündür.
- Tavik ve dünya yalnız dekoratif DOM katmanlarıdır; ikinci pointer sistemi kurmaz. `first-play.js` gösterimi ile gerçek taşların üst katmandaki iki yönlü takas animasyonu korunur. Taşların/zeminin çizim sırası sahneye taşınmaz.
- T2 sonrası **+20 Altın** bir kez aynı atomik kayda işlenir. Açılan sandıktaki Altının önde görünmesi, sandıktan çıkış hareketi ve dönen arka ışık korunur; bu hareketlerin tamamlanması ödeme/ödül kanıtı değildir.

## Test ve dağıtım

`node check-onboarding.cjs`, `node check-first-play.cjs` ve `npm run test:first-play` ilgili sözleşmeleri doğrular. Son komut gerçek Chromium veya `HEXROTA_BROWSER=webkit` ile WebKit kullanır. Ekran görüntüleri ve sonuçlar `test-results/first-play-{browser}` altında üretilir; kişisel veri veya tarayıcı oturumu kaydedilmez.

Yeni tarayıcı testi 320×568, 390×844, 844×390 ve 1280×900 görünümünde ilk açılışı; gerçek dokunuşlarla iki öğreticiyi, ilk kampanya ödülünü ve yavaş gösterimde piksel değişimini kontrol eder. Gösterim öncesi/sonrası motor snapshot'ı karşılaştırılır. Mevcut mobil giriş, takas görünürlüğü, atomik kayıt ve C# karşılaştırmaları ayrıca çalıştırılır.

Sahne için `node sync-scene-config.cjs --check`, `node check-scene-presentation.cjs`, `node scripts/check-scene-assets.cjs` ve `node check-scene-browser.cjs` kullanılır; son komut `HEXROTA_BROWSER=webkit` ile de çalıştırılabilir. Birim testleri kontrollü gecikmiş görsel/poz yanıtlarını, görünürlük/temizliği, saf sunum sınırını ve güvenli yerleşimi denetler. Entegre HTTP tarayıcı testi gerçek oyundaki aşamaları, mobil yerleşimi, kayıt hatasını ve görsel fallback'i doğrular. Sonuçların kapsamı ve çalıştırılmış kontroller `IMPLEMENTATION_REPORT_SCENE_PHASE1.md` içinde ayrıca raporlanır.

PWA paketi **v36**'dır; hareket adaptörü, sahne yapılandırması ve modül HTML bağımlılık sırasına, çevrimdışı kabuğa ve test yükleyicisine eklenmiştir. İlk çevrimdışı fallback için clearing-mobile ve idle ısıtılır. İzin verilen toplam 22 WebP'nin tamamı açılışta indirilmez/decode edilmez; diğerleri ihtiyaçla önbelleğe alınır. Kaynak PNG'ler ve bağımsız örnek tahta provası uygulama kabuğuna dahil değildir. Bu bir kayıt veya oyun kuralı sürümü değildir. Dağıtım önce ayrı feature PR / Preview ile doğrulanır; Production yayını için kullanıcı onayı gerekir.

Otomatik WebKit testi fiziksel iPhone Safari testi yerine geçmez. İlk gerçek oyuncu denemesinde açıklama yapmadan şu üç gözlem alınmalı: ilk doğru kaydırma, puan ile yeşil alanın farkını anlatabilme ve ilk ana bölümde bağımsız bir eşleşme. Takılma varsa önce hangi ekrana/dokunuşa takıldıkları kaydedilmeli; bölüm dengesi bu sunum değişikliğinin içinde değiştirilmemelidir.

## Yeniden deneme için tam sıfırlama

Ayarlar → Geliştirme testi → **Test için her şeyi sıfırla**. Ayrı onaydan sonra öğreticiler, bölüm ilerlemesi, Altın, yıldız, çanta, can, TEST cüzdanı ve yerel gözlemler yeni oyuncu durumuna döner; sayfa otomatik yeniden açılır. Normal açık-deneme sıfırlaması ve ödül hakları değişmez. Teknik güvenlik ve testler: `WELCOME_REWARD_AND_TEST_RESET.md`.
