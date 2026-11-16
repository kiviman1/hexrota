# Tavik sahne entegrasyonu — Phase 1

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

Dört arka plan ayrı kompozisyonlardır. Aşama ve yön değişiminde 140 ms kararma ile resim değiştirilir; hizalı inşaat parçaları gibi bindirme veya morph yapılmaz. Azaltılmış hareket anlık geçiş ve statik poz kullanır. Sekme gizlendiğinde/diyalog açıldığında hareket durur. Ekrandan çıkışta timer/listener/DOM ve gecikmiş decode sahipliği temizlenir. `pagehide` sahneyi dispose eder; `pageshow` aynı host'a dönüldüğünde yalnız sunumu yeniden kurar. Geliştirme tam sıfırlamasından sonra eski host yeniden sahne veya kayıt üretemez.

Animasyon bitişi hiçbir puan, hamle, can, Altın, yıldız, stok, Attempt ID veya kalıcı durum üretmez. `scene-presentation` motor, ekonomi, profil veya depolama API'si almaz. Mevcut iki yönlü üst SVG takası, öğretici gösterim ve kaydırma motoru değiştirilmedi.

## PWA ve yükleme bütçesi

PWA `v36` sunum bağımlılıklarını çekirdek çevrimdışı kabuğa ekler. 22 hazır WebP yalnız açık izin listesi üzerinden istekle önbelleğe alınabilir. Kurulumda **isteğe bağlı** yalnız `clearing-mobile.webp` ve `idle.webp` ısıtılır: toplam **133.004 byte**; tüm WebP'lerin toplamı **2.206.144 byte**. Diğer 20 resim açılışta toplu indirilmez/decode edilmez. Aktif arka plan ve idle önce, gereken poz sonra yüklenir.

WebP yerine gelen kimlik doğrulama HTML'i, yönlendirme, yanlış MIME, keyfi sorgu ve scope dışı yol saklanmaz. İsteğe bağlı görselin yokluğu kurulum veya başarılı çevrimiçi oyunu başarısız yapmaz. Çevrimdışı ileri aşama resmi henüz önbellekte değilse kayıtlı başlangıç arazisi/statik renk ve onaylı portre fallback'i kullanılır; kazanılmış yıldızlar düşürülmez.

## Test kanıtı

Son entegre koşumlar ve CI/Preview bağlantıları bu bölümde teslim öncesi güncellenir. Fiziksel cihaz testi otomatik tarayıcı sonucuyla eşitlenmez.

- `node scripts/check-scene-assets.cjs`: 39 hash / 12 hareket doğrulaması geçti.
- `node sync-scene-config.cjs --check`: geçti.
- `node check-scene-presentation.cjs`: 17 odaklı grup geçti; async yarış, fallback, duraklatma, yerleşim, tekrar çağrı ve temizleme dahil.
- Yeni gerçek HTTP tarayıcı matrisi: 320×568, 390×844, 430×932, 844×390, 932×430, 1280×720. Ekran görüntüleri ve Tavik gizlenerek alınan karşılaştırmalı piksel kanıtı kullanılır; yalnız DOM doğruluğu yeterli sayılmaz.
- Sahne kapatılmış referansla gerçek tahta geometrisi karşılaştırılır. İki gerçek öğretici, tekil 20 Altın, sıfır canla kayıt devamı, atomik son hamle hatası, yıldız eşikleri, geç decode/404, reduced-motion, modal/döndürme ve gerçek servis çalışanıyla ağ kesilerek çevrimdışı yeniden yükleme test edilir.
- Geri dönüş testi sentetik `PageTransitionEvent` ve sekme testi kontrollü `document.hidden` olayı kullanır; fiziksel Safari arka planı veya gerçek işletim sistemi BFCache kanıtı olarak sunulmaz.

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
