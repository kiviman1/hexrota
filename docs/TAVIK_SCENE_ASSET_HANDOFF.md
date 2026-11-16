# Hexrota — Tavik / Kümes sahne paketi v1

Tarih: 16 Kasım 2026. Referans main: `e4321b50a8d307b158f886c21f2d2bf9466fde5f`.

## Teslim durumu — önemli

Bu dalda teslim yönergesi bulunur. **Görseller ve hareket kodu henüz bu GitHub dalına yüklenmiş değildir.** Kullanıcının sohbetindeki `Hexrota_Tavik_Sahne_Paketi.zip` bunların tamamını içerir; Codex'e ZIP de verilmelidir. Dosyalar mevcut değilken placeholder ile tamamlandı raporu verilmez.

- ZIP boyutu: 5.774.200 byte.
- ZIP SHA256: `3ccc31f22f130a7c6d1e8ca1e97a0ebfb92bac0ec200eaf097b44bcc6605b64b`.
- Ayrı yüksek çözünürlüklü kaynak arşivi: `Hexrota_Tavik_Orijinal_Gorseller.zip`, 15.788.444 byte; SHA256 `b36d7b5dea5d1ee1bd02d925251451fb750be36a6d72c5890118deffea62ac29`.
- Bu bir varlık/sunum teslimatıdır; ana oyuna bağlanmış sahne sistemi değildir. Main ve Production değiştirilmedi.

## ZIP içeriği

- `dist/assets/scenes/coop-v1/backgrounds/`: `clearing`, `frame`, `roof`, `finished` adlı dört güneşli sahne. 1672×941 WebP ve `-mobile` son ekli 1024×576 sürümleri.
- `dist/assets/scenes/coop-v1/tavik/`: aynı 384×384 şeffaf tuvalde 14 poz. `idle`, `hop`, `point`, `inspect`, `worried`, `celebrate`, `walk-pose`, `run-pose`, `carry`, `build`, `proud`, `think`, `call`, `rest`.
- `art/coop-scene-v1/source/`: pozların kayıpsız PNG karşılıkları.
- `dist/assets/scenes/coop-v1/tavik-motion.css` ve `.js`: 12 hazır kesit/transform hareketi ve küçük DOM adaptörü.
- Aynı dizindeki `manifest.json`: kaynak dosya/hash/kırpım bilgileri, boyutlar, sabit taban pivotu ve kullanım sınırları.
- `dist/scene-assets-preview.html`: bağımsız görsel prova; örnek tahta oynanabilir değildir. Altın, can, yıldız veya kayıt üretmez.
- `reports/asset-integrity.json`, `scripts/check-scene-assets.cjs`: 39 kaynak/varlık hash'i; `node scripts/check-scene-assets.cjs` ile doğrulama.
- `reports/validation.json`: yerel prova testinin kapsamı ve sınırları.
- `docs/CODEX_SCENE_PHASE1_PROMPT.md`: ayrıntılı entegrasyon talimatı.

## Animasyon niteliği

12 hazır durum: idle, point, inspect, worried, celebrate, hop, carry, build, proud, think, call, rest. Seçilen statik poz nefes alma, eğilme, zıplama veya ritmik hareketle canlandırılır. Bazı durumlar aynı keyframe tarifini paylaşır.

**Bu paket 3D model, iskelet rig'i, bağımsız çekiç-kol animasyonu, göz kırpma rig'i veya kare kare yürüme döngüsü içermez.** `walk-pose` ve `run-pose` durağan referanslardır; ilgisiz pozlar sıraya dizilip yürüyüş diye gösterilmez. `build` bütün kesitin hafif vuruş hareketidir. Pozlar arasında anatomik oranlar 3D rig kesinliğinde değildir.

```js
const actor = HexTavikMotion.mount(host, {
  assetBase: './assets/scenes/coop-v1/',
  reducedMotion: false,
  onError: reportOptionalPresentationError
});
await actor.ready;
await actor.play('point');
actor.pause(true);
actor.setReducedMotion(true);
actor.destroy();
```

`play()` hareketin bitmesini değil, yeni pozun gösterilmeye başlamasını bekler. Bu dönüş değerinden Altın, yıldız, can veya kalıcı sahne ilerlemesi türetilmez. Sistem reduced-motion tercihi uygulanır; gizlenen sayfada animasyon durur. Destroy birden fazla çağrılabilir.

## Sahne sınırları

Arka plan → karartma → mevcut gerçek tahta → görünür Tavik → HUD → tutorial/modal. Tavik/arka plan dekoratiftir; pointer-events:none. Mevcut altıgen geometri ve kaydırma korunur.

Dört sahne ayrı resimdir. Kamera/ufuk/malzeme yerleşimleri tam eşleşmez; ilk temel merkez-altta, sonraki yapı sağdadır. Bunları hizalı kümes parçaları gibi üst üste bindirme. Kısa kararma kullan. Kesintisiz sabit kamera gerektiren sonraki sürüm için ayrı taban ve şeffaf kümes parçaları ayrıca üretilmelidir.

Dikey başlangıç önerisi object-position:72% 50%; yatay:50% 50%. Gerçek tahta ile ayrıca doğrula. Sahne uğruna taşları/dokunma alanını küçültme. İnce tüy kenarlarının alfa temizliğinde ayrıntı kaybı olabilir.

## İlerleme önerisi

Kanonik kazanılmış kampanya yıldızından türet: 0–1 clearing, 2–4 frame, 5–9 roof, 10+ finished. Eşikler ilk test adaylarıdır; tek JSON'da tutulur. Yıldız harcanmaz. İkinci bir yetkili sahne ilerlemesi sayacı oluşturulmaz. Öğreticiyi geçme/replay yeni ödül veya inşa sağlamaz.

Güncel main'deki T2 tekil hoş geldin Altını, ön plandaki Altın/ışık sunumu ve açık onaylı test-reset koruması korunur. Eski 9.6 özetine dönülmez. `docs/FIRST_PLAY_FLOW.md` ve `docs/WELCOME_REWARD_AND_TEST_RESET.md` okunmalıdır.

Düşman, kaçırılma veya kurtarılmış dost varlıkları bu pakette yoktur. Şimdilik gelecekteki hikâyeye uzantı noktası bırak. Yeni tavuk tasarımı uydurma, Tavik'i çoğaltıp arkadaşlar diye kullanma; kar/üşüme/köpek sahnelerini kullanma.

## Mobil / PWA

Önce aktif arka plan ve idle pozu; sonraki sahne/poz ihtiyaçla yüklenir. Yaklaşık 2.2 MB toplam WebP'yi ve kaynak PNG'leri açılışta birlikte decode etme. Hareket CSS'ini mevcut tek CSS üretim hattına bağla. Prova HTML'indeki gömülü büyük veri paketini üretime alma. Güncel PWA sürümünü kontrol et; WebP MIME/allowlist, yükleme hatası ve çevrimdışı fallback'i test et.

## Yapılan kontrol ve yapılmayanlar

Yerel Chromium'da 320×568, 390×844, 430×932, 844×390 ve 1280×720 prova incelendi. WebP decode, yedi örnek durum geçişi, yatay taşma, reduced-motion, geçersiz durum reddi ve çift destroy kontrol edildi; konsol hatası yok. 39 dosya hash'i ve 12 sunum durumu doğrulandı.

Ortam localhost gezinmesini ERR_BLOCKED_BY_ADMINISTRATOR ile engelledi. Yerel kontrol set_content/gömülü görseller kullandı; HTTP/PWA veya entegre oyun regresyonu değildir. Fiziksel iPhone/Android, WebKit, Unity ve IL2CPP bu paket için test edilmedi. GitHub'a varlıklar aktarılıp ana oyuna bağlandıktan sonra mevcut CI ve yeni gerçek HTTP tarayıcı kontrolleri yeniden çalıştırılmalı.
