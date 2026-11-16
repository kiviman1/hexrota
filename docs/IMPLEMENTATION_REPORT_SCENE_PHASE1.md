# Tavik sahne entegrasyonu — Phase 1

> Tarihsel rapor: Bu belgedeki yıldız temelli kümes ilerlemesinin yerini `feature/tutorial-coop-build-flow` çalışmasındaki [öğretici kümes akışı](TUTORIAL_COOP_BUILD_FLOW.md) almıştır. Aşağıdaki önceki teslim/test geçmişi korunur; güncel davranış için yeni belgeyi okuyun.

Tarih: 16 Kasım 2026. Başlangıç: `assets/tavik-coop-scene-pack-v1` (`2ced5d0`); güncel ana oyun referansı `e4321b5`. Uygulama dalı: `feature/tavik-scene-phase1`. Bu çalışma yalnız sunum katmanıdır; yeni bir oyun/kayıt sürümü değildir.

## Gerçekleştirilen akış

İlk açılışta güneşli arazi, hazır `inspect` pozu, kısa kümes daveti ve mevcut **Başlayalım** düğmesi görünür. Oyuncu istediği anda devam edebilir; bekleme veya yeni bir zorunlu diyalog yoktur. Mevcut gerçek yedi hücreli T1 tahtası aynı dünya üzerinde açılır. İkinci bir tahta, örnek tahta veya giriş sistemi oluşturulmadı. Tavik öğreticinin gerçek iki hücresine doğru işaret eder; kaydedilmiş hamleden sonra kısa tepki verir.

Kümes görünümü yalnız başarılı kanonik profil yazımındaki `game.economy.stars` değerinden türetilir:

| Kalıcı yıldız | Sahne |
| --- | --- |
| 0–1 | `clearing` — güneşli arazi |
| 2–4 | `frame` — iskelet |
| 5–9 | `roof` — çatı |
| 10 ve üzeri | `finished` — tamamlanmış kümes |

Başarısız kayıtta taslak yıldızlar sahneye iletilmez. Eski oyuncu doğru aşamaya döner; zorunlu giriş, ikinci ödül veya ikinci inşa sayacı oluşmaz. Öğretici atlamak/tekrarlamak yapı ilerletmez. T2'nin tekil **20 Altın** hediyesi, önde beliren Altın, dönen ışık ve açık onaylı geliştirme sıfırlaması korunur. Mevcut bahçe ekranı değiştirilmedi.

## Paket bütünlüğü

- Kullanıcı ZIP'i: 5.774.200 byte; SHA256 `3ccc31f22f130a7c6d1e8ca1e97a0ebfb92bac0ec200eaf097b44bcc6605b64b`.
- Arşiv yol kaçışı, mutlak yol, sembolik bağ ve yinelenen dosya açısından kontrol edildi. Paket betikleri otomatik çalıştırılmadı; oyun kaynaklarının üzerine toplu çıkarma yapılmadı.
- 8 WebP arka plan, 14 şeffaf WebP poz, 14 kaynak PNG ve sağlanan motion JS/CSS/manifest aktarıldı. **39 hash ve 12 hazır hareket durumu**, değiştirilmemiş teslim doğrulayıcısıyla kontrol edilir.
- Kaynak PNG'ler `art/coop-scene-v1/source/` altında; Vercel'in `dist/` çıktısına veya açılış/PWA yüküne girmez.
- Paket provasının HTML'i ayrı `dist/scene-assets-preview.html` olarak kalır. Oyun bunu yüklemez ve örnek tahtasını kullanmaz.
- Paket içindeki eski prova raporu, deponun mevcut `reports/validation.json` dosyasını ezmemek için `reports/scene-pack-validation.json` olarak saklandı. Bu rapor entegre oyun test sonucu değildir.

## Modül ve dosya sahipliği

| Dosya/grup | Değişiklik |
| --- | --- |
| `data/scene-config-v1.json` | Aşama eşikleri, dosya yolları, yerleşim parametreleri ve kısa davet; `futureStory.enabled=false`, boş uzantı listesi |
| `sync-scene-config.cjs`, `dist/scene-config.json`, `dist/scene-config.js` | Tek JSON'dan doğrulanan dağıtım verisi ve tarayıcı globali |
| `dist/scene-presentation.js` | Dünya, kısa kararma, Tavik pozu/yerleşimi ve yaşam döngüsü; yalnız görünüm girdisi alır |
| `dist/app.js` | Küçük sunum köprüsü; başarılı commit'ten yıldız iletimi, mevcut ekran/öğretici durumunun aktarılması, sayfa yaşam döngüsü |
| `src/styles/07-coop-scene.css`, manifest, CSS üreticisi | Önceki altı CSS kaynağının sırası korunarak sağlanan motion CSS ve yerleşim bölümünün tek çıktıya eklenmesi |
| `dist/index.html`, `dist/hint-worker.js`, `dist/ui-kit.html` | Bağımlılık sırası ve PWA `v36` query uyumu |
| `dist/sw.js`, `check-pwa.cjs` | Tipi doğrulanan, sınırlı ve isteğe bağlı WebP önbelleği; mevcut güvenli HTML/çekirdek kuralları korunur |
| `qa-fixtures.cjs`, `check-lives-ui.cjs`, `check-playtest-ui.cjs` | Gerçek sunum bağımlılıkları ve alt dizinli script yollarını kaybetmeyen test yükleyicisi |
| `check-scene-presentation.cjs`, `check-scene-browser.cjs` | Yeni modül ve gerçek HTTP tarayıcı kontrolleri |
| Comic UI testleri ve `fixtures/scene-phase1-protected.json` | Mevcut 88 korunan dosya denetimi; yalnız gözden geçirilmiş SW değişikliği için dar hash eklentisi |
| `package.json`, `.github/workflows/ci.yml` | Sahne komutları, mevcut Chromium/WebKit işlerine yeni sahne adımı ve görüntü kanıtı |
| `docs/ARCHITECTURE.md`, `docs/FIRST_PLAY_FLOW.md` | Gerçek uygulama sınırları ve açılış akışı |

Yeni komutlar: `npm run scene:sync`, `npm run test:scene`, `npm run test:scene-browser`. Statik/odaklı sahne kontrolleri `npm test` zincirine eklenir.

## Çizim, mobil giriş ve yaşam döngüsü

Arka plan ve karartma dünya katmanında, gerçek tahta bunun üstündedir. Tavik yalnız boşluk bulunan bir konuma yerleşir; taşların, HUD'un, öğretici kartının ve düğmelerin sınırları korunur. Güvenli köşe bulunamazsa öğreticide mevcut araç çubuğunun boş ortasında küçük statik poz denenir; güvenli alan yine yoksa karakter gizlenir. Tahta karaktere yer açmak için küçültülmez. Dekoratif katmanlar `pointer-events:none` kullanır.

Dört arka plan ayrı kompozisyonlardır. Aşama ve yön değişiminde 140 ms kararma ile resim değiştirilir; hizalı inşaat parçaları gibi bindirme veya morph yapılmaz. Azaltılmış hareket anlık geçiş ve statik poz kullanır. Sekme gizlendiğinde/diyalog açıldığında hareket durur. Ekrandan çıkışta timer/listener/DOM ve gecikmiş decode sahipliği temizlenir. `pagehide` sahneyi dispose eder; görsel host `pageshow` ile tekrar kurulabilir. Mevcut kayıt deposunun `pageshow.persisted → reload` ve tek-yazıcı kilidini yeniden alma politikası korunur; yeni bir BFCache kayıt akışı oluşturulmadı. Geliştirme tam sıfırlamasından sonra eski host yeniden sahne veya kayıt üretemez.

Animasyon bitişi hiçbir puan, hamle, can, Altın, yıldız, stok, Attempt ID veya kalıcı durum üretmez. `scene-presentation` motor, ekonomi, profil veya depolama API'si almaz. Mevcut iki yönlü üst SVG takası, öğretici gösterim ve kaydırma motoru değiştirilmedi.

## PWA ve yükleme bütçesi

PWA `v36` sunum bağımlılıklarını çekirdek çevrimdışı kabuğa ekler. 22 hazır WebP yalnız açık izin listesi üzerinden istekle önbelleğe alınabilir. Kurulumda **isteğe bağlı** yalnız `clearing-mobile.webp` ve `idle.webp` ısıtılır: toplam **133.004 byte**; tüm WebP'lerin toplamı **2.206.144 byte**. Diğer 20 resim açılışta toplu indirilmez/decode edilmez. Aktif arka plan ve idle önce, gereken poz sonra yüklenir.

WebP yerine gelen kimlik doğrulama HTML'i, yönlendirme, yanlış MIME, keyfi sorgu ve scope dışı yol saklanmaz. İsteğe bağlı görselin yokluğu kurulum veya başarılı çevrimiçi oyunu başarısız yapmaz. Çevrimdışı ve önbelleksiz isteğe bağlı resim için `503 / no-store` döner; WebKit'te reddedilmiş servis çalışanı Promise'ı yerine normal görsel yükleme hatası ve mevcut fallback çalışır. Çekirdek JS dosyalarının hata davranışı değişmez. İleri aşama resmi henüz önbellekte değilse kayıtlı başlangıç arazisi/statik renk ve onaylı portre fallback'i kullanılır; kazanılmış yıldızlar düşürülmez.

## Test kanıtı

Yerel koşumların kapsamı aşağıdadır. Son commit'in GitHub Actions sonuçları ve Vercel Preview kontrolü [PR #22](https://github.com/kiviman1/hexrota/pull/22) üzerinde izlenir; 15 mevcut CI işi korunmuştur. Yeni sahne tarayıcı adımı mevcut Chromium/WebKit matrisine eklenir; bu işlerin zaman bütçesi ek kapsam için 15 dakikadan 20 dakikaya çıkarılmıştır. Ekran görüntüleri CI artifact'larında saklanır. Fiziksel cihaz testi otomatik tarayıcı sonucuyla eşitlenmez.

- `node scripts/check-scene-assets.cjs`: 39 hash / 12 hareket doğrulaması geçti.
- `node sync-scene-config.cjs --check`: geçti.
- `node check-scene-presentation.cjs`: 18 odaklı grup geçti; async yarış, fallback, duraklatma, yerleşim, tekrar çağrı ve temizleme dahil. Eşiklerin ikinci bir sabit listeden değil verilen JSON'dan okunduğu, alternatif test eşikleriyle ayrıca doğrulanır.
- Yeni gerçek HTTP tarayıcı matrisi: 320×568, 390×844, 430×932, 844×390, 932×430, 1280×720. Ekran görüntüleri ve Tavik gizlenerek alınan karşılaştırmalı piksel kanıtı kullanılır; yalnız DOM doğruluğu yeterli sayılmaz.
- Sahne kapatılmış referansla gerçek tahta geometrisi karşılaştırılır. İki gerçek öğretici, tekil 20 Altın, sıfır canla kayıt devamı, atomik son hamle hatası, yıldız eşikleri, geç decode/404, reduced-motion, modal/döndürme ve gerçek servis çalışanıyla ağ kesilerek çevrimdışı yeniden yükleme test edilir.
- Geri dönüş testi sentetik `PageTransitionEvent` ve sekme testi kontrollü `document.hidden` olayı kullanır; fiziksel Safari arka planı veya gerçek işletim sistemi BFCache kanıtı olarak sunulmaz.

Son yerel koşumlar:

| Kontrol | Sonuç |
| --- | --- |
| `npm test` | Tam zincir exit 0; mevcut oyun/UI/kayıt/ekonomi ve yeni 18 sahne grubu dahil |
| `test:scene-browser` | **Chromium 20/20, WebKit 20/20**, iki koşum da exit 0, yakalanmamış hata yok |
| Mevcut mobil giriş | Chromium **40**, WebKit **37** kontrol; sıfır hata |
| Mevcut takas piksel doğrulaması | Her tarayıcıda **16/16**; iki taşın başlangıç/orta/son görünürlüğü dahil |
| İlk açılış, hoş geldin/sıfırlama, Altın/ışık piksel testleri | Her iki tarayıcıdaki mevcut üç komut geçti |
| Mobil ekonomi ve bahçe | Her tarayıcıda **21 + 9** grup geçti |
| Chromium atomik kayıt ve birleşik çevrimdışı oyun | Her iki komut geçti; birleşik koşum **6/6** |
| `test:observable` | Exit 0; 80 görünür durum, 1.920 gizli RNG bağımsızlığı karşılaştırması, 160 örneklenmiş karar ve mevcut raporun tekrar üretimi |
| PWA | **17/17** grup; isteğe bağlı eksik WebP ve bozuk MIME/önbellek senaryoları dahil |
| Dar koruma denetimi | **8 grup / 88 korunan dosya** ve onaylı Tavik bütünlüğü geçti |

Chromium giriş testi gerçek CDP dokunma olayları kullanır. WebKit'teki kaydırmalar native mouse, tek dokunuşlar native touch üzerinden çalıştırılır; iPhone parmağıyla gerçek Safari testi olduğu iddia edilmez. Son sahne sonuçlarının küçük JSON kopyaları `reports/scene-phase1-chromium.json` ve `reports/scene-phase1-webkit.json` altında; ekran görüntüleri CI artifact'larında bulunur.

Çevrimdışı test, aktif servis çalışanının varlığıyla yetinmez: mevcut SW listesinden türetilen **50 HTML/çekirdek/ısınma yanıtının** 200 durumunu, doğru MIME türünü ve tam okunabilir gövdesini doğrular. Ardından gerçek HTTP origin'i `server.close()` ve açık bağlantıları kapatarak erişilemez yapar. Yeniden yükleme yanıtının **200 ve `fromServiceWorker=true`** olması zorunludur; HTTP önbelleği veya uydurma HTML başarı sayılmaz. Tam oyunla iki çevrimdışı senaryo, 12 ayrı WebKit bağlamında **24/24** geçti; 36 çevrimdışı gezinme gerçek servis çalışanından döndü. Bu tekrarlar hata olursa durur; otomatik başarısızlık tekrarı veya zaman aşımı gevşetmesi eklenmedi.

Bu hazırlık, CI'da görülen WebKit zaman aşımından sonra güçlendirildi. Tek tek soketleri RST ile kesen önceki test düzeneği, 50 gövde hazırken bile dördüncü gerçek oyun tekrarında 32 çekirdek dosya için WebKit iç ağ hatası üretti. `context.setOffline(true)` ise WebKit'te 12/12 denemede servis çalışanına ulaşmadan navigasyonu reddetti. Gerçek origin kapatma bu iki otomasyon davranışından kaçınır; Chromium'da ek olarak native offline anahtarı da kullanılır. Bu bulgular fiziksel Safari'nin uçak modu davranışı olarak genellenmez. Oyunun SW navigasyon/puan/kayıt kuralları bu test düzeltmesi için değiştirilmedi. İsteğe bağlı `HEXROTA_SCENE_TRACE=1` ağ/servis çalışanı kanıtını CI artifact'ına yazar; `HEXROTA_SCENE_ONLY` ve `HEXROTA_SCENE_REPEAT` yalnız tanı koşumlarını daraltmak/bağımsız tekrar etmek içindir, CI tam 20 grubu çalıştırır.

İlk aday koşumunda testlerin iki yanlış varsayımı düzeltildi: başarısız poz yüklemesinde hazır hareket adaptörü son geçerli `inspect` pozunu koruyabilir; mutlaka `idle` beklenmemelidir. Persisted `pageshow` sonrasında mevcut kayıt kilidi host'u gerçekten yeniden yükler; geçici DOM'a erken bakmak yerine yeniden yükleme ve kayıt devamı beklenir. Bunun yanında gerçek WebKit çevrimdışı isteğe bağlı-resim hatası yukarıdaki dar `503/no-store` düzeltmesiyle giderildi. Son yerel koşumlarda bu senaryolar geçmektedir.

Gerçek .NET SDK **8.0.428** ile C# **7.3** derlenerek çalıştırılan mevcut karşılaştırmaların yerel sonuçları:

| Komut | Gerçek karşılaştırma kapsamı | Sonuç |
| --- | --- | --- |
| `test:unity-gameplay` | 71 mekanik örneği, 80 sertifikalı yol, 120 rota dışı koşu; 1.913 geçerli takas ve ara dalgalar | Geçti |
| `test:unity-rewards` | 104 paylaşılan vektör ve durum fabrikası | Geçti |
| `test:unity-catalog` | 2.107 tam JSON karşılaştırması; 40 varyant/80 yol | Geçti |
| `test:unity-lives` | 19 ortak senaryo + uzun koşu/460 geçiş, 152 v1 geçişi, 172 ek prob | Geçti |
| `test:unity-hints` | 1.000 karşılaştırma; 680 yayımlanmış rota durumu, 280 arama durumu | Geçti |
| `test:unity-reward-adapter` | 1.456 tur, 2.928 dalga, 1.564 yeniden oynatma/devam kontrolü | Geçti |
| `test:unity-session` | 580 olay + 1.362 oturum JSON karşılaştırması, 36 gerçek app akışı | Geçti |
| `test:unity-economy` | 125 akış / 579 tam sonuç-durum karşılaştırması | Geçti |
| `test:unity-commands` | 2.928 karşılaştırma, 16.001 adım, 3.259 dalga | Geçti |
| `test:unity-rescue` | 293 karşılaştırma + 600 derlenmiş yaşam döngüsü geçişi | Geçti |

Balance Lab ekonomi izolasyonu, birleştirilmemiş `85bc092d` kaynağı salt test girdisi olarak kullanılarak **Chromium 6/6 ve WebKit 6/6** geçti. 79 değişmez dosya ve 10 korunan kayıt anahtarı kontrol edildi; 320×568, 390×844 ve 844×390 ekranlar, kazanma/kayıp/yeniden deneme, geçersiz deney reddi ve dış ağ isteği olmaması dahil. Lab üretim uygulamasına eklenmedi.

## Korunan sözleşmeler ve Unity uyarlaması

`classic-v4`, 2 öğretici, 10 bölüm, 40 varyant, 80 kazanma yolu, tüm hedef/hamle/zemin ve RNG verileri korunur. `hexrota-profile-v2`, `hexrota-match-v5`, snapshot v4, attempt metadata v1, LifeState v2 ve assisted komut sözleşmeleri değişmez. C# çekirdek ve karşılaştırma dosyaları değiştirilmedi; gerçek derleme testleri yine çalıştırılır.

Unity'de mevcut C# SessionController başarılı işlemi kesinleştirdikten sonra aynı salt-okuma görünüm girdisini bir `ScenePresenter` adaptörüne iletebilir. Yıldız eşiği aynı JSON'dan alınır. Sprite/Animator, Canvas yerleşimi, mobil yaşam döngüsü ve görsel yükleyici platform adaptörüdür; sahne animatörü kayıt servisine yazamaz. Bu fazda Unity sahnesi/C# sunum portu/IL2CPP veya cihaz paketi hazırlanmadı.

## Sınırlar ve kalan kontroller

- Paket gerçek 3D/rig veya kare kare yürüme değildir; hazır şeffaf 2D pozların sınırlı transform hareketidir. `walk-pose`/`run-pose` yürüyüş diye oynatılmadı.
- Dar yatay ekranlarda güvenli boşluk kalmadığında Tavik gizlenebilir. Tahta/HUD/input önceliklidir.
- Arka planların kamera ve yapı konumu tam hizalı değildir; kararma bu varlık sınırını açık biçimde yönetir.
- Kaynak paketin poza göre ufak anatomi/ince tüy alfa farkları değiştirilmedi.
- Dostların kaçırılması/kurtarılması yalnız kapalı veri uzantısıdır. Yeni tavuk/düşman, görev sistemi, ödül veya hikâye menüsü uygulanmadı.
- Fiziksel iPhone Safari, Android, Unity ve IL2CPP testleri yapılmadı. En az bir gerçek iPhone'da ilk açılış, döndürme, uygulama arka planı, ileri/geri dönüş ve çevrimdışı devam ayrıca denenmeli.
- Bu çalışma Production'ı değiştirmez. PR kullanıcı onayı olmadan birleştirilmez.
