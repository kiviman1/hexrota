# Tavik — arayüze ekleme kaydı

**Tarih:** 15 Kasım 2026
**Dal / PR:** `feat/comic-adventure-ui-9-6` / #18

## Yapılan

Kullanıcının açıkça onayladığı Tavik paftasının ön görünüşü, tasarım değiştirilmeden ana menüye ve UI kitindeki açık macera kitabına bağlandı. Portre 147×238 piksel, 7.904 byte WebP'dir. Resim yeniden üretilmedi; gözlük, mor tüyler, krem gövde, fular, sırt çantası ve renkler kaynakla aynıdır. Dikdörtgen kırpımın açık renk zemini korunur; şeffaf bir sprite olduğu iddia edilmez.

Kaynak JPEG'in adı/hash'i ve kırpım koordinatları `data/tavik-approved.json` içinde, karakter kuralları `docs/TAVIK_APPROVED.md` içinde bulunur. Kaynak paftanın kendisi kullanıcı ekidir; depodaki raster dosya onun arayüz için alınmış ön görünüş kırpımıdır.

## Değişiklik sınırı

- Ana menü başlığının yanında isimli Tavik portresi; mevcut düğmeler ve kimlikler korunur.
- Hikâye tasarım kartında Tavik ve macera kitabı birlikte gösterilir.
- Aynı altın/mor çerçeve dili; yeni framework veya script bağımlılığı yoktur.
- WebP açık MIME doğrulaması ve yalnız adlandırılmış yerel varlık izin listesiyle PWA v31'e eklenir.
- Oyun, can, Altın, yıldız, bölüm, güçlendirici, kayıt, C# ve RNG davranışı değiştirilmez.
- Bahçe→çizgi roman sistemi bu teslimata dahil değildir. Kit açıkça tasarım örneği olarak kalır ve profil yazmaz.
- Geçici hazırlık dosyaları son kaynak ağacından kaldırıldı. Main ve Production değiştirilmedi; PR onaysız birleştirilmez.

## Testler

Hazırlık aşamasında `test:comic-ui` ve `test:maintenance` geçti. Tam son commit kontrollerinin kaynağı PR #18 Checks ekranıdır; önceki commit'in yeşil sonucu yenisine taşınmış sayılmaz.

Yeni korumalar: onaylı resmin SHA-256 ve WebP doğrulaması, HTML bağlantıları, MIME/redirect reddi; Chromium/WebKit'te dört ekran boyutunda gerçek resim decode ve boyut kontrolü; Chromium çevrimdışı sayfa yenilemesinde Tavik resminin yeniden yüklenmesi. Mevcut 15 CI işi korunur. Fiziksel iPhone/Android ve Unity testi yapılmadı.

## Devam

Yeni pozlar gerektiğinde aynı onaylı pafta kullanılmalı. Daha yüksek çözünürlük veya transparan sprite üretimi ayrı görsel çalışmadır; bu küçük kırpımı büyütmek yeni detay üretmez. Kullanıcı onayı, fikrî mülkiyet incelemesi yerine geçmez.
