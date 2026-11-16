# Codex — hazır Tavik varlıklarıyla sahne entegrasyonu

Repository: kiviman1/hexrota. Başlangıç dalı: assets/tavik-coop-scene-pack-v1. Güncel main ile uzlaştır; main'e doğrudan yazma.

## Girdi kontrolü

Önce docs/TAVIK_SCENE_ASSET_HANDOFF.md oku. Sohbetteki Hexrota_Tavik_Sahne_Paketi.zip gerçek görselleri, 12 hareket durumunu, 14 pozu ve bağımsız provayı içerir. Bu GitHub dalında şimdilik yönergeler bulunuyor; ZIP olmadan görseller mevcutmuş gibi ilerleme. ZIP SHA256: 3ccc31f22f130a7c6d1e8ca1e97a0ebfb92bac0ec200eaf097b44bcc6605b64b. Arşivi güvenli biçimde aç; yol kaçışı veya mevcut iş kuralı dosyalarını ezme. node scripts/check-scene-assets.cjs çalıştır.

Güncel mimari, FIRST_PLAY_FLOW.md, WELCOME_REWARD_AND_TEST_RESET.md ve UI_LAYOUT_FIXES_9_6.md dosyalarını incele. Referans main e4321b5, PR21 hoş geldin Altını/ışık katmanı değişikliklerini içeriyor; eski özetten dolayı bunları geri alma.

## Hedef

Tavik güneşli arazide kümes kuruyor. Önce yaşayan sahne ve kısa konuşma; sonra aynı arka planın üstüne mevcut gerçek Hexrota tahtası gelir. Tavik yön gösterir, eşleşmelere tepki verir ve ilerleme sonrası inşa/kutlama hareketi yapar. Kar, üşüme, köpek veya rakibin sahnelerini kopyalama.

## Hazır üretimi kullan

Dört sahne: clearing, frame, roof, finished. 14 poz dist/assets/scenes/coop-v1/tavik altında. tavik-motion.css/js hazır 2D kesit hareketidir; 3D rig veya gerçek yürüme döngüsü değildir. Varlık üretme, başka karakter çizme, tavik'i CSS şekilleriyle yeniden kurma. walk-pose ve run-pose durağandır; peş peşe oynatıp yürüme animasyonu diye sunma.

scene-assets-preview.html yalnız kompozisyon provasıdır. İçindeki örnek sayılı tahtayı ana oyuna kopyalama; gerçek mevcut SVG tahta/motor/input kullanılacak.

## Mimari

Sunumu ayrı scene-presentation modülüne, sahne eşiklerini ayrı JSON'a yerleştir. app.js yalnız bağlasın. first-play.js akışını yeniden yazmadan uygun kancayı kullan. İkinci pointer sistemi kurma. Arka plan/Tavik pointer-events:none; mevcut modal erişilebilirliği, safe-area ve tahta geometrisi korunur.

Katmanlar: dünya → karartma → tahta → Tavik → HUD → tutorial/modal. Tavik taşları veya hedefleri örtmesin. Tahta animasyon sırasında küçülmesin. Görüntü yüklenemiyorsa oyun erişilebilir kalsın, onaylı mevcut Tavik portresi/statik renk fallback'i kullanılabilir.

Sahne resimleri piksel hizalı değildir. Aralarında kısa kararma kullan; aynı yapının parçaları gibi morph yapma. Reduced-motion'da statik poz/anlık geçiş; sekme gizlenince pause; sahne kapanınca destroy. Eski async callback veya gecikmiş image decode yeni sahneye yazamasın. Görsel olaylar hiçbir şekilde oyun sonucu veya ödül kanıtı değildir.

## Açılış

Kısa, geçilebilir akış: Tavik araziyi inceler → “Buraya bir kümes kuralım!” → gerçek öğretici tahta sahne üstüne gelir → Tavik doğru yöne işaret eder. Uzun açıklama ve yinelenen giriş ekleme. Öğretici verileri, örnek hamle ve gerçek giriş akışı aynı kalır. Çekiç/tahta çizimleri yeni toplanabilir motor hedeflerine dönüştürülmez.

## Kümes ilerlemesi

İlk test eşikleri: kanonik kampanya yıldızı 0–1 clearing, 2–4 frame, 5–9 roof, 10+ finished. Tek JSON'da tut ve raporla. Yıldızlar harcanmaz. İkinci authoritative ilerleme sayacı oluşturma. Tutorial skip/replay ödül veya inşa ilerlemesi vermez. T2 hoş geldin Altını tekil kalır.

Kazanma önce mevcut atomik kayıtta kesinleşir, sonra inşa sunumu çalışır. Animasyonun bitmesi Altın/yıldız/can yazamaz. Eski oyuncular kendi yıldızlarıyla doğru sahneyi açar; yeniden ödül veya zorunlu öğretici yok.

Bu fazda bahçe verisini silme ve çizgi roman ilerlemesini tamamlandı diye raporlama. Açılış/oyun sahnesi uygulanır; kalıcı hikâye menüsü dönüşümü ayrı iştir. Gelecekte dış güç diğer tavukları kaçırır ve Tavik kurtarır; şu an yalnız veri uzantı noktası bırak. Eksik dost/düşman varlıkları uydurma, Tavik'i çoğaltma.

## Korumalar

Motor, RNG, sayılar, puan, hedef/hamle, can, fiyatlar, envanter, ödüller, 40 varyant/80 yol, tamamlanan bölümün tekrar oynanmaması, snapshot/komut sözleşmeleri ve C# parity değişmez. Sırf sunum için yeni kayıt sürümü veya sahte C# dosyası ekleme.

Aktif arka plan/idle önce yüklensin; diğerleri ihtiyaçla alınsın. Kaynak PNG'ler startup/PWA yüküne eklenmesin. Hareket CSS'i mevcut tek CSS manifest hattına girsin. Güncel PWA kuşağını birlikte güncelle; WebP MIME ve offline fallback test edilsin.

## Test ve teslim

Mevcut bütün CI korunur. Yeni gerçek HTTP Chromium/WebKit testleri: 320×568, 390×844, 430×932, 844×390, 932×430 ve masaüstü; ilk giriş, skip, kayıttan devam, atomik hata, döndürme, açık modal, reduced-motion, arka plana geçme, görsel yükleme hatası, sıfır can, yıldız eşikleri, duplicate callback. Ekran görüntülerinde Tavik/HUD/tahta çakışmasını kontrol et. Fiziksel cihaz test edilmediyse belirt.

Yeni uygulama dalı ve PR oluştur. Onaysız merge/Production değişikliği yok. Vercel Preview paylaş. docs/IMPLEMENTATION_REPORT_SCENE_PHASE1.md içine değişen dosyaları, test sayılarını, kaynak paket hash'ini, kalan görsel/teknik sınırları ve Unity uyarlamasını yaz. Yerel varlık demosu ile gerçek entegre oyun testini birbirine karıştırma.
