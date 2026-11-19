# HEXROTA 9.11 — Unity Foundation & First Playable

## Teslimat sınırı

`main` üzerindeki `a3b5640a3feea3e07d7eb918fc148c683242430d` (birleştirilmiş PR #33 / 9.10) temel alınarak `feature/9.11-unity-first-playable` dalı oluşturuldu. Mevcut `dist/`, `unity/` çekirdeği, kanonik bölüm verileri, web ekonomisi/kayıtları ve Production yapılandırması değiştirilmedi. PR otomatik birleştirilmedi.

Gerçek Unity proje, sahne, prefab ve uygulama adaptörleri eklendi. **Bu ortamda Unity Editor kurulu olmadığı için Unity içinde oynanabilirlik, import, rendering, EditMode/PlayMode veya WebGL başarı iddiası yoktur.** İlk gerçek Editor çalıştırması ve telefon kontrolü açık kabul kapısıdır.

## Proje ve uygulanan akış

`unity-client/` Unity Hub projesidir. Tam hedef **6000.6.9f1**, revision **8c45277fb9c5**; Unity resmi sürüm API'sinde Linux Editor ve Web Build Support bulundu. Sürüm kanıtı `reports/unity-9-11/editor-release.json`; farklı sürüm build sırasında reddedilir.

Gerçek serialized `Assets/Hexrota/Scenes/FirstPlayable.unity`; kamera, ışık, `FirstPlayableController` ve `HexrotaAssets.asset` referanslarını içerir. Menü, HUD, EventSystem ve bölümden üretilen tahta sahne controller'ı tarafından kurulur. 12 gerçek prefab, ortak materyaller ve geçici altıgen mesh/shader committed durumdadır.

Uygulanan istemci akışları: Menü → Bölüm 1 başla/devam et → seçim ve dokunma/sürükleyerek takas → geçerli/geçersiz hamle → swap/eşleşme/temizleme/düşüş/refill/zincir sunumu → kazanma/kaybetme. HUD hamle, puan/hedef ve yeşil zemin gösterir. Duraklat/devam, onaylı yeniden başlat, kayıpta tekrar ve menüye dönüş vardır. Girdi animasyonda kilitlenir; arka plan/iptal son kaydedilmiş motor snapshot'ına döner.

**Mevcut ürün sözleşmesi:** kazanılan kampanya bölümü kalıcı kapanır; çekirdek `level_completed` ile Retry/Restart/Enter'ı reddeder. Kazanma ekranı Menü sunar. Kayıp sonrası Retry ve oyun içi Restart can kurallarını kullanır. Bunu değiştirmek, istenmeyen ekonomi/ilerleme değişikliği olacağı için kazanılmış bölümü tekrar açan bir yol eklenmedi.

T1/T2 indeksleri ve verileri korunur; ilk istemci doğrudan gerçek kampanya Bölüm 1'i (stage 2) açar. Öğretici sunumu, yardım/rescue mağaza ekranları, tam bahçe, Tavik animasyonları ve 9.10 pasif idle-hint sunumu henüz Unity UI'ye taşınmadı; mevcut modülleri çekirdeğe bağlıdır.

## Çekirdek ve kayıt bağlantısı

11 modülden 25 C# kaynağı **byte olarak aynı** bağlanır: Gameplay, Catalog, Application, Contracts, Lives, Economy, Commands, Rescue, Hints, Rewards, RewardAdapter. `scripts/sync-unity-client.cjs` açık allowlist, SHA256 manifest, sabit meta/GUID ve `--check` sunar. Harness, Program.cs, ParitySupport ve System.Text.Json oyuncu assembly'sine girmez. Kopya üzerinde elle değişiklik ve beklenmeyen dosya ekleme testi gerçekten reddedildi.

`UnityGameSession` mevcut `GameSessionController`'ı çağırır; çekirdekten bağımsız eşleşme, puan, RNG veya sonuç hesabı yazılmadı. Controller bütün hamleyi atomik kaydeder. Sunum için aynı motorun klonundan alınan dalgalar, controller'ın tam snapshot'ıyla (RNG/geçmiş dahil) karşılaştırılır; tutarsızlıkta görsel sonuç kullanılmaz. Bu fazda UI'de assisted komut yoktur; ileride assisted sunum, kendi authoritative sonuç kayıtları üzerinden genişletilmelidir.

Resmi Unity Newtonsoft paketi dictionary/list, null, uzun tamsayı, unsigned tohum ve sayısal/dizgesel kimlik ayrımını korur. JsonUtility genel save okuyucusu yapılmadı. Snapshot v4, attempt v1, profile v2 ve kayıt anahtarı sözleşmeleri aynıdır. Unity platform namespace'i ayrıdır: mevcut web kayıtlarını okumaz/yazmaz. Native canonical profil atomik dosya replacement ile, web HTTPS Web Lock altında senkron localStorage CAS ile kaydedilir. Bozuk/engelli kayıt sıfırlanmaz; hata gösterilir. Platformlar arası taşıma/cloud save yoktur.

## Gerçek doğrulamalar

| Kontrol | Gerçek sonuç |
| --- | --- |
| `npm ci`, `npm test` | Exit 0; mevcut JS/UI/veri/denge/regresyon zinciri korundu |
| 10 mevcut `test:unity-*` komutu | .NET 8.0.428 / C#7.3 ile exit 0; session komutu ayrıca event parity çalıştırır |
| `test:unity-client-host` | Gerçek yeni Runtime + Core + dosya deposu: 9 grup, 943 assertion; 40 varyant / 80 kazanan rota; exit 0 |
| `test:unity-client-storage` | Gerçek .jslib fonksiyonları, yalnız Emscripten bellek sınırı mock: 10 grup; exit 0 |
| `test:unity-client-structure` | 6 grup; kaynak, GUID/metalar, sahne/prefab referansları, sürüm/build/assembly sınırları; exit 0 |
| `test:unity-editor` | **Exit 2 / BLOCKED: Unity Editor kurulu değil** |
| Unity EditMode / PlayMode | 11 + 8 = 19 test hazır; **çalıştırılmadı** |
| WebGL / Android / iOS build | **Çalıştırılmadı**; Editor/lisans/modül ortamı yok |
| iPhone Safari | **Çalıştırılmadı**; fiziksel cihaz ve gerçek Unity build yok |

Ham loglar ve makine okunabilir kapsam `reports/unity-9-11/` altındadır. Host testler Unity resource yükleyici sınırını küçük stub ile değiştirir; Unity API derleme/çalıştırma doğrulaması değildir.

## CI, web ve Blender

`.github/workflows/unity-client.yml` PR üzerinde kaynak/sahne/depo ve gerçek .NET adaptör testlerini çalıştırır. Lisanslı, tam sürümlü `unity-6000.6.9f1` etiketli self-hosted runner'da manual dispatch gerçek EditMode + PlayMode XML sonuçlarını ve WebGL artifact'ını üretir. Eksik Editor/sürüm/modül açık başarısızlıktır. Lisans gereksinimi ortadan kaldırılmış gibi gösterilmez. Secret isimlerini okuma isteği GitHub tarafından HTTP403 ile reddedildi; lisans varlığı bilinmiyor. Build runner sağlanmış değil.

Unity web template güvenli tek sekme kaydı, görünürlük iptali, touch-action, viewport/Retina DPR sınırı içerir. Gerçek wasm/data/framework/loader ve build manifest olmadan artifact doğrulanmaz. **Unity Web Preview yayınlanmadı.** Repository'nin olağan Vercel Git entegrasyonunun oluşturabileceği eski web Preview'ı Unity build olarak sunulmamalıdır. `https://hexrota.vercel.app/` Production'a dağıtım yapılmadı. Ayrı Preview yayını için gerçek build ve Vercel yönergesi `UNITY_WEB_TESTING.md` içindedir.

`BLENDER_ASSET_PIPELINE.md`: isim, birim/eksen/pivot, materyal/atlas, animasyon/FBX ve wrapper GUID standardı. Hücre/zemin/taş, seçim/eşleşme/düşüş/temizleme, Tavik, çevre, bahçe, menü/UI için katalog slotları bağlıdır. Yerel Blender dosyalarına erişim varsayılmadı.

## 9.12 devam işleri

1. Lisanslı 6000.6.9f1 + Web Build Support ortamında import/19 Editor testi/IL2CPP WebGL çalıştır; import veya cihaz hatalarını gider ve package lock'u gerçek Editor çözümünden kaydet.
2. Gerçek artifact'ı ayrı Vercel Preview'a dağıt; fiziksel iPhone Safari'de giriş, ekran boyutları, döndürme, arka plan, iki sekme, kayıt kota/geri yükleme ve performansı ölç. Production'ı değiştirme.
3. Blender modellerini katalog wrapper'larına bağla; mevcut placeholder render/animasyonlarını fiziksel cihazda değerlendir.
4. T1/T2, tam kampanya ekranı, Tavik/bahçe sunumu, 9.10 pasif idle önerileri ve yardım/rescue UI'lerini mevcut çekirdek sözleşmeleriyle bağla.
5. Android/iOS gerçek geliştirme paketleri ve mobil yaşam döngüsü doğrulaması; native çok süreçli/cloud kayıt stratejisini ayrıca tasarla.
