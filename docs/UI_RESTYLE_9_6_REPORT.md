# Hexrota 9.6 — görsel dil uygulaması

Referans: `ec82719cca4e595fcbbeca329ea9284466e3d42a`, PR #17 sonrası main.
Dal: `feat/comic-adventure-ui-9-6`. Kullanıcı onayı olmadan merge yok.

## Teslimat

Gerçek ana oyun: mor dünya, altın çerçeveler, krem paneller, mercan kurdele başlıkları, kabartmalı yeşil/mor/kırmızı düğmeler, yeni menü görseli ve oyun içi göstergeler. Üç özgün SVG, renk sözlüğü, tasarım rehberi ve çalışan bileşen galerisi eklendi.

Bu yalnız mockup değildir: ana oyunun CSS'i değişti. Ancak kitaplı hikâye açılış kartı `ui-kit.html` içinde açıkça etiketli örnektir; bahçe/hikâye iş kuralı değişmedi. Onaylanmamış tavuk tasarımı kullanılmadı.

## Koruma

Oyun motoru, koordinatlar, C# kaynakları, ekonomi, stok, can, yıldızlar, kurtarma ve bölüm verileri korunur. `app.js` / `hint-worker.js` yalnız bağımlılık query'sinde v29→v30 değişir. Service worker yalnız kuşak ve üç yeni SVG varlık girdisinde güncellenir. HTML aynı DOM kimliklerini ve olay bağlantılarını korur.

## Doğrulama

- Yerel kaynak ağacı önce gerçek main tree hash'i `72728aba3b60863cd8d49094d96c0490cbdcde1b` ile eşleştirildi.
- İlk tema uygulamasında tam mevcut `npm test` geçti. Son GitHub kaynaklarının kesin kanıtı aynı commit'in CI sonucudur; yerel sonuç onun yerine sunulmaz.
- Yeni `check-comic-ui.cjs`: altı sözleşme grubu, 89 korunmuş dosya, eski DOM kimlikleri, offline asset'ler ve izole demo. Cache/allowlist farkları açıkça sınırlandırılmıştır.
- Yerel Chromium DOM/CSS incelemesi 320×568, 390×844, 844×390 ve 1280×900'de yapıldı; ilk iki soluk düğme ve sayfa altı arka planı düzeltildi. Yerel URL navigasyonu ortam tarafından engellendiğinden bu inceleme `setContent` ve bellek profili kullanır; gerçek PWA/URL testi değildir.
- Gerçek Chromium/WebKit CI adımı gerçek HTTP sunucusu, normal uygulama, dört ekran boyutu, modal/düğme erişimi, ekran görüntüleri ve kitte kayıt izolasyonunu sınar. Mevcut 15 iş korunur. Son durum PR Checks'ten doğrulanmalıdır.
- Fiziksel iPhone/Android, Unity/IL2CPP, gerçek reklam/ödeme test edilmedi.

## Devam

Tasarım kaynakları `UI_VISUAL_LANGUAGE.md` içindedir. Kitteki hikâyeyi gerçek yıldız ilerlemesine bağlamak ayrı ürün/migration işi; bu PR'da bahçe kurallarını gizlice kaldırma. Ön izleme ve nihai CI bağlantıları PR açıklamasına eklenir. Üretim kullanıcının onayını bekler.


## Onaylı Tavik — 15 Kasım 2026

Karakter seçimi artık onaylı: mor tüylü, krem gövdeli, gözlüklü Tavik. Önceki “karakter henüz onaylanmadı” notu bu onayla geçersizdir. Kaynak kimliği ve doğrudan kırpma kaydı `data/tavik-approved.json`; rehber `docs/TAVIK_APPROVED.md`. Ana menü portresi ve örnek hikâye kartı bağlandı. Yeni karakter tasarımı, oyun kuralı veya hikâye ilerlemesi eklenmedi. PWA v31 bu yerel WebP görselini açık MIME denetimiyle önbelleğe alır. Nihai CI sonucu PR #18 üzerinde aynı commit ile doğrulanmalıdır.
