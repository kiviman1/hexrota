# Mobil kaydırma — 9.2 PR 1

## Sorun ve sınır

Önceki giriş kodu `pointermove` sırasında hareketi kaydetmiyordu. `pointerup` anındaki hücre ve iki uç arasındaki mesafe takası belirliyordu. Bu nedenle kendi taşının içinde biten kısa bir kaydırma, hedefi geçip geri dönen parmak ve bazı altıgen yönleri dokunma olarak yorumlanabiliyordu. İkinci parmak da ilk parmağın bekleyen takasını her durumda iptal etmiyordu.

Algılanan kaydırma ve oyun kurallarınca geçerli eşleşme ayrı sonuçlardır. Giriş, bir komşu çifti belirleyip en fazla bir kez `performSwap()` çağırır. Komşu değişiminin eşleşme oluşturup oluşturmadığına aynı `HexMatch.swap()` karar verir. Eşleşmeyen takasın geri dönme animasyonu, algılanmamış bir hareket değildir. Geçersiz eşleşme puan, zemin, hamle geçmişi ve RNG durumunu değiştirmez.

`dist/engine.js`, bölüm/öğretici verileri, 40 varyant, 80 kazanma yolu, kayıt ve can sözleşmeleri değiştirilmedi. Bu PR yalnızca uygulamanın giriş adaptörü, testler ve test altyapısını değiştirir.

## Tanıma kuralları

- Başlangıçta olayın gerçek DOM hedefi kullanılır. Taşların arasındaki boşluk için SVG koordinatlarında altıgen testi yapılır. Kenar payı en fazla 3 ekran pikselidir; dünya koordinatlarında ayrıca 6 birimle sınırlıdır. İki hücre arasında kararsız kalan boşluk otomatik seçilmez.
- Tahtanın `getScreenCTM().inverse()` matrisi hareketin başında alınır. Böylece viewBox, sayfa ölçeği, cihaz piksel oranı ve CSS dönüşümleri taş merkezleriyle aynı koordinatlarda değerlendirilir.
- Yönler gerçek tahtanın altı komşusundan çıkarılır; kare tahta yönleri veya yalnızca yatay/dikey karar kullanılmaz.
- Hareket örnekleri, varsa birleştirilmiş `getCoalescedEvents()` örnekleri ve son bırakma konumu birlikte değerlendirilir. `pointermove` bir takas yapmaz.
- Dokunma titremesi eşiği 12 CSS pikselidir. Bir komşuya ilerleme eşiği, o komşunun ekran uzaklığının %28'i; en az 12, en fazla 20 CSS pikselidir. Bu aralığa göre SVG uzaklığı hesaplanır.
- Yön, komşu ekseninden en fazla 22,5° sapmalıdır. İki yön arasındaki kararsız açı hareket üretmez. İlk açık yön saklanır; parmak kaynağa döndüğünde bu bilgi kaybolmaz. Daha sonra başka bir komşuya açık yön gösterilirse hareket iptal edilir.
- Takas yalnızca bırakmada yapılır. Parmağın kısa süre hedefi geçmesi, daha uzaktaki bir hücreyle takas oluşturmaz; başlangıcın bir komşusu seçilir. Yinelenen bırakma olayı ikinci işlem üretemez.
- İkinci temas, iptal, capture kaybı, pencere dışına çıkma, resize/yön değişimi, odak kaybı, sayfanın gizlenmesi veya kapanması bekleyen hareketi iptal eder. Yanlış pointer kimliğine ait iptal diğer hareketi bitirmez.
- Capture sabit SVG üzerindedir; animasyonda yeniden oluşturulan taş üzerinde değildir. Hareketin motor ve ekran sürümü de kontrol edilir. Animasyon sırasında dokunma yalnızca mevcut sonucu gösterir; sonraki hamleyi başlatmaz.
- İki taşa sırayla dokunma, klavye/erişilebilirlik seçimi ve öğretici kısıtları korunur. SVG matrisi sağlamayan görselsiz test ortamlarında eski uç-nokta yolu kullanılabilir; gerçek tarayıcılar SVG yolunu kullanır.

Bu değerler algılama ayarlarıdır; puanı, zorluk verilerini, üretim RNG'sini veya can ekonomisini değiştirmez. Unity giriş adaptörü aynı davranışları kendi ekran → tahta dönüşümüne uygulayabilir; çekirdek yalnızca komşu indeks çiftini almalıdır.

## Tekrarlanabilir hata kanıtı

Yeni testler düzeltmeden önce çalıştırıldı: ilk altı hareket grubunun beşi eski uygulamada başarısızdı. Genişletilen son test kümesi eski uygulamada **9 grup hata** üretir; mevcut uygulamada bu gruplar geçer. Eski kodu çalışma kopyasına geri yazmadan tekrar ölçmek için:

```sh
git show 1adefd9:dist/app.js > /tmp/hexrota-before-swipe.js
HEXROTA_INPUT_APP_SOURCE=/tmp/hexrota-before-swipe.js HEXROTA_INPUT_FILTER='^gesture' node check-input.cjs
```

Bu komutun eski kodla başarısız olması beklenir. Normal `npm test`, depodaki güncel kodu kullanır; harici uygulama kaynağı veya filtre ayarlanmaz.

## Doğrulama

`check-input.cjs`, gerçek uygulama olaylarını görselsiz DOM üzerinde çalıştırır. Kısa kaydırma, altı yön, hızlı/yavaş hareket, birleştirilmiş örnekler, boşluk/kenar, yön çatışması, jitter, capture/iptal, ikinci temas, ekran dışına çıkış, yön değişimi ve arka plan iptalleri kontrol edilir. Mevcut animasyon hatası, hızlı gösterim, tutorial ve kayıt kontrolleri kaldırılmadı.

`check-mobile-browser.cjs` kendi yerel sunucusunu açar; yayımlanmış siteyi veya kullanıcı kaydını kullanmaz. Gerçek çizilmiş SVG matrisi ve hit testi kullanılır. Test aracı yalnızca test sayfasında `HexMatch.swap` çağrılarını gözleyerek algılanan giriş sayısını eşleşmenin geçerliliğinden ayırır. Son snapshot JavaScript motorunun aynı hamlede ürettiği değerler, RNG, zemin, puan ve geçmişle tam karşılaştırılır.

| Test | Kapsam |
| --- | --- |
| Chromium | Native CDP dokunma; 320×568, 390×844, 430×932 ve 844×390; hızlı/kısa/yavaş kaydırma, hedefi geçip dönme ve iki dokunma |
| Altı yön | Her gerçek komşuya bir deneme; yasal ve eşleşme üretmeyen takaslar ayrı doğrulanır |
| SVG | Taş kenarı, boşluk kenarı, CSS ile küçültülmüş/döndürülmüş tahta ve gerçek viewBox |
| Güvenlik | Native touch cancel, native capture kaybı, çoklu dokunma, jitter, kararsız açı, resize, odak kaybı, art arda hareketler ve animasyon sırasında dokunma |
| Öğretici | T1 ve T2'nin ilk yönlendirilmiş takası; bütün öğreticiler ayrıca mevcut test takımında oynatılır |
| WebKit | Gerçek WebKit SVG/mouse hareketleri ve native dokunma tap'leri; Chromium'a özgü CDP touch dizileri burada çalıştırılmaz |

Yerel doğrulamada `npm test` ve derlenen C# reward parity testi geçti (104 ortak vektör). Chromium **40/40**, WebKit **37/37** tarayıcı senaryosunu geçti; yakalanmamış tarayıcı hatası yoktu. Giriş takımındaki 20 grup, eski animasyon kontrollerini de içerir. WebKit, bu ortamda eksik sistem kütüphaneleri yalnızca geçici çalışma alanına çıkarılarak çalıştırıldı; depoya özel bir sistem paketi veya çalışma zamanı bağımlılığı eklenmedi. Bu sonuçlar yerel çalıştırmalardır; GitHub Actions durumu ayrıca PR kontrollerinden okunmalıdır.

Komutlar:

```sh
npm ci
npm test
npm run test:unity-rewards
npx playwright install --with-deps chromium webkit
npm run test:mobile-browser
HEXROTA_BROWSER=webkit npm run test:mobile-browser
```

Tarayıcı raporu istenirse `HEXROTA_BROWSER_REPORT=/tmp/mobile-report.json` ile yerel JSON yazılır; hiçbir sunucuya gönderilmez. Geliştirme ortamında farklı yürütücü gerekiyorsa `HEXROTA_CHROMIUM_PATH` veya `HEXROTA_WEBKIT_PATH` kullanılabilir. CI, iki tarayıcıyı ayrı matris işleriyle kurup çalıştırır; mevcut gameplay ve C# reward işleri korunur.

**Açık doğrulama:** Fiziksel iPhone/iOS Safari testi yapılmadı. Masaüstü WebKit'in geçmesi iOS dokunma donanımı veya Safari'nin sistem hareketleri için test kanıtı sayılmaz. Gerçek cihazda ekran kenarı, kısa hızlı hareket, arka plana alıp dönme ve ekran döndürme ayrıca denenmelidir. Eşiklerin oyuncu hissi de gerçek cihaz testleriyle kalibre edilmelidir; otomatik testler insan davranışı için başarı yüzdesi vermez.
