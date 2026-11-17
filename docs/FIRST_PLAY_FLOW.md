# Hexrota — ilk açılış ve oynayarak öğrenme

İlk oynanış sadeleştirilir; `classic-v4`, sabit T1/T2 verileri, bölüm hedefleri, can ve kampanya ilk-tamamlama kuralları korunur. Tavik'in güneşli kümes sahnesi bu gerçek oyunun sunumudur; yeni bir örnek tahta veya oyun hedefi değildir. Ayrı, tek seferlik başlangıç hediyesi ve açık onaylı prototip veri silme işlemi korunur. Mevcut snapshot/profil zarfı sürümleri ve geçerli eski kayıtlar değişmez.

## Akış

| An | Oyuncunun gördüğü | Gerçek eylem / sonuç |
| --- | --- | --- |
| İlk ziyaret | Güneşli temel sahnesi, araziyi inceleyen Tavik, **Tavik’in ilk kümesi.**, kısa konuşma ve **Başlayalım** | Oyuncu giriş hareketini beklemeden düğmeye dokunabilir; ek açıklama penceresi açılmadan gerçek T1 başlar. Menü, can ve para seçenekleri bu davette gösterilmez. |
| T1: ilk eşleşme | **Tahta 0/3**, **Yeşert 0 / 7**, **5 hamle**, parlayan iki taş ve yavaş kaydırma | Oyuncu 2 ile 1'in yerini değiştirir. Üç 2 eşleşir; 6 puan ve 3 yeşil yer oluşur. Başarılı kayıt sonrası Tahta 1/3 görünür. |
| İlk sonuç | Kısa sonuç cümlesi ve **Devam et** | Oyuncu sonucu gördüğünü onaylamadan sonraki zorunlu kaydırma açılmaz. Mevcut `0:1` öğretici onayı korunur. |
| T1 devamı | Tahta 2/3, sonra 3/3; bir eşleşme daha, ardından son iki yer | Sayaç kaydedilmiş turu izler. Yedi yer yeşerip kazanım kesinleşince iskelet sahnesi açılır; tek devam düğmesi çıkar. |
| T2 | **Çivi 0/4 → 4/4**, iki gerçek hedef ve 6 hamle; sırayla çift kat, zincir ve hedef puan | Sayaç her kaydedilmiş gerçek hamleden sonra ilerler. İki noktanın iki eşleşme istediği, zincirin ek hamle harcamadığı ve puan ile yeşil alanın birlikte tamamlanması öğretilir. Mevcut `1:1` / `1:3` onayları korunur. |
| T2 sonrası | **İlk hediyen hazır!**, açılan sandık ve **+20 Altın → İlk bölüme başla** | İlk gerçek kazanımda ayrı başlangıç hediyesi aynı atomik kayda işlenir. Yıldız verilmez. Öğreticiyi tekrar oynamak ikinci hediye vermez. |
| İlk ana bölüm kazanımı | Mevcut gerçek **+20 Altın / +1 yıldız** ödülü | Mevcut atomik, tek seferlik ekonomi işlemi kullanılır. Kampanya ödülü başlangıç hediyesinden ayrıdır; öğretici tekrarı yeni ödül vermez. |
| Kampanya / öğretici tekrarı | Tamamlanmış kümes korunur | Kümes iki öğreticiyle tamamlanır; kampanya yıldızlarıyla değişmez. Tekrar oynamak temeli yeniden kurmaz veya yeni ödül üretmez. |

İlk davet yalnız yüklenen kayıtta tamamlanma, tahta, deneme metadata'sı ve deneme seri sayacı yoksa gösterilir. Kontrol açılıştaki ön izleme hazırlanmadan yapılır. Mevcut oyuncular normal menüye ve kayıtlarına döner; bozuk kayıt yeni oyuncu sayılmaz. Yeni deneme ancak oyuncu düğmeye bastığında başlatılır.

## Güneşli arazi ve Tavik

Girişte önce etkin arka plan ve Tavik'in idle pozu yüklenir; ardından hazır inspect pozu ve **“Buraya bir kümes kuralım!”** konuşması gösterilir. Konuşma güvenli alana sığmıyorsa dekoratif balon gizlenir; başlık ve **Başlayalım** erişilebilir kalır. Zorunlu bekleme yoktur. Başlayalım aynı dünya görseli üzerinde mevcut SVG tahtasını açar; mevcut kaydırma gösterimi çalışırken Tavik öğretici çiftine doğru işaret eder. Taşlar, sayılar ve asıl hedefler öğretici verilerinden gelir; kümes için ayrı toplanabilir parça eklenmez.

Sunum `dist/scene-presentation.js` içindedir. `app.js` modüle motor veya yıldız yerine son başarılı kanonik kayıttan türetilen `completedTutorialCount` ve `tutorialTurn` ile salt görünüm bilgisini iletir. Ana menüden oyuna geçişte dünya ve Tavik yeniden oluşturulmaz; görünüm sahibi değişir. Kayıttan dönen oyuncu zorunlu giriş veya yeniden ödül görmez. `data/scene-config-v1.json` dosyasındaki sunum şeması v2 tek kaynaktır; `node sync-scene-config.cjs` tarayıcı çıktıları `dist/scene-config.json` / `.js` dosyalarını üretir:

| Kesinleşmiş öğretici sayısı | Görünüm |
| --- | --- |
| 0 | Güneşli temel (`foundation`) |
| 1 | Kümes iskeleti (`frame`) |
| 2 | Tamamlanan kümes (`finished`) |

**Tahta/Çivi hikâye sayaçlarıdır:** mevcut öğreticinin kaydedilmiş tur sayısını sırasıyla 3 ve 4 ile sınırlar. Envantere malzeme eklemez, taşları değiştirmez ve kazanma koşulu oluşturmaz. Sayaç yalnız kayıttaki Attempt ID etkin denemeyle aynıysa checkpoint turunu kullanır; yanlış takas, animasyon ve başarısız kayıt sayacı ilerletmez. Kayıttan devam aynı değeri geri getirir.

Geçerli eski kayıtta T2'ye ulaşılmış ama T1 işareti eksikse en az iskelet, kampanyaya ulaşılmışsa tamamlanmış kümes gösterilir; bu çıkarım yalnız sunumdur. Mevcut **Atla** iki öğreticiyi tamamlanmış işaretleyip kampanyaya geçer; kesinleşen bu durumda üçüncü sahne gösterilir, hoş geldin Altını verilmez. İlk gerçek T2 kazanımının tekil +20 Altını korunur. Öğreticiler yıldız üretmez; kampanya yıldızları kümes görünümüne etki etmez. Profil/snapshot sürümleri, bahçe verisi ve mevcut hikâye menüsü değişmez; gelecekteki kurtarma fikri yalnız kapalı yapılandırma uzantısıdır.

Arka planlar birbirine hizalı inşaat katmanları değildir; 140 ms beklemeli kısa kararmayla değiştirilir, üst üste yapı parçaları gibi canlandırılmaz. Karartma gerçek tahtanın altındadır. Tavik gerçek hücreleri, HUD'u ve öğretici kartını örtmeyecek güvenli alana yerleşir. Dar öğretici ekranlarda mevcut Menü/Mola boşluğundaki küçük statik yerleşim kullanılabilir; alan yoksa dekoratif karakter gizlenir. Tahta ve dokunma alanı bu nedenle küçültülmez.

Sekme gizlenmesi, açık diyalog ve mola hareketi durdurur. Azaltılmış hareket tercihinde sabit poz ve anlık sahne geçişi kullanılır. Ekran kapanışında geçici düğümler, dinleyiciler ve zamanlayıcılar temizlenir; gecikmiş görsel yanıtları yeni sahneye yazamaz. Görsel host `pageshow` ile yeniden kurulabilir; mevcut kayıt deposu gerçek BFCache dönüşünde (`pageshow.persisted`) sayfayı yeniden yükleme ve yazıcı sahipliğini yeniden alma politikasını korur. Yeni bir BFCache kayıt akışı eklenmemiştir. Başarısız görsel yüklemesi onaylı portre/önbellekteki foundation/statik renge düşer; gerçek oyunu veya ödül akışını engellemez. Hazır hareket kodu kesit animasyonudur; yürüme döngüsü veya 3B rig eklenmemiştir.

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

Sahne için `node sync-scene-config.cjs --check`, `node check-scene-presentation.cjs`, `node scripts/check-scene-assets.cjs`, `node scripts/check-tutorial-scene-assets.cjs` ve `node check-scene-browser.cjs` kullanılır; son komut `HEXROTA_BROWSER=webkit` ile de çalıştırılabilir. Birim testleri sayaçları, tür duyarlı öğretici kimliklerini, yıldız okunmamasını, kontrollü gecikmiş görsel/poz yanıtlarını, görünürlük/temizliği ve güvenli yerleşimi denetler. Entegre HTTP tarayıcı testi gerçek öğreticilerdeki sayaçları, aşamaları, kayıt hatasını ve mobil fallback'i doğrular. Güncel sonuçlar [TUTORIAL_COOP_BUILD_FLOW.md](TUTORIAL_COOP_BUILD_FLOW.md) içindedir; önceki Phase 1 raporu tarihsel kalır.

PWA paketi **v37**'dir. Üç yeni 720×1280 portre JPEG'i yön değişiminde aynı dosyadan gösterilir; toplam 794.105 byte'tır. İlk çevrimdışı fallback için foundation ve mevcut idle ısıtılır: 276.693 byte. Diğer sahne/pozlar ihtiyaçla yüklenir; eski yatay arka planlar bu akışta kullanılmaz. Kaynak PNG'ler ve bağımsız prova tahtası uygulama kabuğuna dahil değildir. Eski 39 paket dosyası ve 12 hazır hareket byte olarak korunur. Bu bir kayıt veya oyun kuralı sürümü değildir. Dağıtım ayrı feature PR / Preview ile doğrulanır; Production değişikliği kullanıcı onayına bağlıdır.

Otomatik WebKit testi fiziksel iPhone Safari testi yerine geçmez. İlk gerçek oyuncu denemesinde açıklama yapmadan şu üç gözlem alınmalı: ilk doğru kaydırma, puan ile yeşil alanın farkını anlatabilme ve ilk ana bölümde bağımsız bir eşleşme. Takılma varsa önce hangi ekrana/dokunuşa takıldıkları kaydedilmeli; bölüm dengesi bu sunum değişikliğinin içinde değiştirilmemelidir.

## Yeniden deneme için tam sıfırlama

Ayarlar → Geliştirme testi → **Test için her şeyi sıfırla**. Ayrı onaydan sonra öğreticiler, bölüm ilerlemesi, Altın, yıldız, çanta, can, TEST cüzdanı ve yerel gözlemler yeni oyuncu durumuna döner; sayfa otomatik yeniden açılır. Normal açık-deneme sıfırlaması ve ödül hakları değişmez. Teknik güvenlik ve testler: `WELCOME_REWARD_AND_TEST_RESET.md`.

## 9.10 kampanya bekleme ipucu

T1/T2'nin rehber hamleleri, mevcut öğretici koçu, Tavik portresi, Tahta/Çivi sayaçları ve hoş geldin ödülü aynen korunur. Yeni pasif ipucu yalnız öğretici olmayan, etkileşime açık ana bölüm tahtasında çalışır. İlk uygun bekleme 20 saniyedir; gösterimden sonra başarılı bir oyuncu hamlesi olmadan tekrar kurulmaz. Sonraki uygun bekleme 35 saniye, iki gösterim arası en az 60 saniye ve aynı sayfa oturumunda deneme başına en fazla iki gösterimdir. Tüm ortak runtime/style bağımlılıkları artık PWA v46'dadır; bu yalnız önbellek kuşağıdır.
