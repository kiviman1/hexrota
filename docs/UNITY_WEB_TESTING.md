# HEXROTA 9.11 — Unity Web build ve iPhone testleri

## Gerçek durum ve kesin sürüm

2026-11-17 tarihinde Unity'nin resmi [Release API'si](https://services.api.unity.com/unity/editor/release/v1/releases?version=6000.6.9f1) **6000.6.9f1** sürümünü döndürdü: yayın 2026-11-12, revision `8c45277fb9c5`. Linux Editor ve Web Build Support indirme adresleri mevcut; sorgu kanıtı `reports/unity-9-11/editor-release.json`. Sürüm alternatifine geçilmedi.

Bu görev ortamında Unity Editor ve Web Build Support kurulu değil. Editor çalıştırılması, aktivasyon, EditMode/PlayMode veya WebGL/IL2CPP build yapılmadı. GitHub secret adlarını listeleme talebi `403 Resource not accessible by integration` döndü; bu nedenle lisans secret'ının varlığı hakkında çıkarım yapılmaz. Gerçek Unity çıktısı yokken Unity Preview yayınlanmaz. Git entegrasyonunun eski web oyunundan oluşturabileceği standart Vercel PR Preview bir Unity build değildir.

Unity Hub ile `unity-client/` açılır. Tam **6000.6.9f1** ve aynı sürüm **Web Build Support** gerekir; Android/iOS modülleri kendi platform build'lerinde ayrıca gerekir. `ProjectVersion.txt` sürümü/revision'ı pinler. Projenin ilk import'u paketleri çözümler; bu ortamda Unity import'u doğrulanmadı. UGUI 2.0.0 [Editor ile dağıtılan Unity 6 core paketidir](https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/index.html); Newtonsoft JSON 3.2.1 ve Test Framework 1.4.6 resmi Unity registry sürümleridir. Paketler dış oyun framework'ü eklemez.

## Kaynak, test ve build komutları

Repo kökünde:

```sh
node scripts/sync-unity-client.cjs --check
node scripts/check-unity-client.cjs
UNITY_EDITOR_PATH=/path/to/6000.6.9f1/Editor/Unity scripts/run-unity-client.sh tests
UNITY_EDITOR_PATH=/path/to/6000.6.9f1/Editor/Unity scripts/run-unity-client.sh web
```

`tests` gerçek Editor Test Runner ile EditMode ve PlayMode çalıştırır; boş/başarısız XML raporu reddedilir. `web` tam sürüm ve Web modülünü kontrol eder, checked-in `FirstPlayable.unity` sahnesini IL2CPP ile derler. Lisansın meşru biçimde etkinleştirilmiş olması gerekir; Unity aktivasyon hatası komutu başarısız kılar. Kod lisans sağlamaz veya aktivasyonu taklit etmez. Editor menüsü: **Hexrota → Build Web Preview**. Aynı sahne için **Build Android Development Player** (`Builds/Android/Hexrota.apk`) ve **Export iOS Development Project** (`Builds/iOS`) giriş noktaları da exact sürüm/modül kontrolleriyle IL2CPP geliştirme çıktısı üretir. Android SDK/NDK/JDK ve iOS Xcode/signing kurulumu ayrıca gerekir; bu native build'ler çalıştırılmadı.

Çıktı: `unity-client/Builds/WebGL/`. `hexrota-unity-build.json` yalnız başarılı `BuildPipeline.BuildPlayer` sonrasında yazılır. `node scripts/check-unity-web-build.cjs <çıktı>` Unity loader/framework/data, WebAssembly magic byte'ları, exact sürüm ve sahneyi doğrular; eski `engine.js` içeren dizini reddeder. Bu yapısal kontrol oynanabilirlik testi değildir.

`.github/workflows/unity-client.yml` PR'larda kaynak/sahne kontrollerini çalıştırır. Gerçek test/build işi **workflow_dispatch → run_editor=true** ile başlatılır ve `[self-hosted, linux, x64, unity-6000.6.9f1]` etiketli etkin lisanslı runner gerektirir. İsteğe bağlı repository variable `UNITY_EDITOR_PATH` Editor konumunu belirler. Self-hosted cihazda Git, Node 24, Python 3 ve exact Unity+Web modülü kurulmalıdır. PR kodu self-hosted makinede otomatik çalıştırılmaz. Runner yoksa iş sırada kalır; çalışmayan Editor işi başarı olarak sayılmaz. XML/log ve gerçek WebGL çıktısı artifact olarak saklanır. İş akışı hiçbir adresi yayınlamaz.

## Ayrı Vercel Preview

Production `https://hexrota.vercel.app/` ve kökteki `vercel.json` değiştirilmez. Geçerli gerçek Unity artifact'ı indirip kontrol ettikten sonra **ayrı** `hexrota-unity-preview` Vercel projesine bağlayın. Build klasöründeki `vercel.json` saf statik dosya servisidir. Deploy komutunu yalnız bu klasörde, ayrı proje kimlikleriyle çalıştırın; `--prod` kullanmayın:

```sh
node scripts/check-unity-web-build.cjs unity-client/Builds/WebGL
cd unity-client/Builds/WebGL
# Bu dizini ayrı hexrota-unity-preview projesine bağladıktan sonra:
vercel deploy
```

Vercel proje veya token kurulumu bu görevde yapılmadı. Gerçek çıktı ve yetkili ayrı proje olmadan Preview URL'si iddia edilmez. Web build sıkıştırmasızdır: ilk testlerde Safari gzip/Brotli header uyumsuzluklarını önler; `.wasm` MIME tipi açık, dosyalar `no-store`. İlk indirme maliyeti daha yüksektir; 9.12'de ölçüm sonrasında compression/cache değiştirilebilir. Thread kapalıdır; SharedArrayBuffer / COOP-COEP zorunluluğu yoktur.

## iPhone Safari kabul matrisi

Fiziksel cihaz testi henüz yapılmadı. Her gerçek build için commit, Unity sürümü, iOS/Safari sürümü ve ölçümleri kaydedin:

| Alan | Kontrol |
| --- | --- |
| Görünür alan | 320×568, 375×667, 390×844, 430×932; adres çubuğunu aç/kapat; çentik ve home indicator altında UI kalmamalı. Canvas CSS safe-area insets içinde, Retina çözünürlük oranı en çok 1.5. |
| Ekran yönü | Portrait birincil; landscape'e dönüp geri gelince tahta ve menü erişilebilir, hücre dokunma konumları doğru. |
| Dokunma | Tek dokunuşla seç + komşuya dokun; sürükleyerek bırak; parmak tahta dışına çıkışı ve ikinci parmak hamle üretmemeli. Geçersiz takas hamle/puan/RNG değiştirmemeli. |
| Yaşam döngüsü | Düşüş sırasında uygulama değiştir; Safari sekmesini gizle; geri dön; pause/resume/restart/menu. Son committed board aynen çizilmeli, kilit veya ikinci hamle oluşmamalı. |
| Kayıt | Geçerli hamleden hemen sonra reload; aynı attempt/variant/RNG/snapshot. Kazanma/kaybetme/yeniden başlatmada sonuç ve can işlemi bir kez. Private mode/quota hatası açık hata üretmeli. |
| Çoklu sekme | İkinci Unity sekmesi kayıt kilidi nedeniyle oyunu açmamalı. İlk sekme kapanınca ikinci yenilenebilir. HTTPS/Web Locks yoksa kayıt açıkça engellenir. |
| Performans | Soğuk açılış, indirme boyutu, yükleme zamanı, bellek uyarısı, 5 dk zincirli oyun; 30 FPS hedefi ve en kötü frame süreleri fiziksel cihazda ölçülmeli. |
| Sonuç | Gerçek bölüm 1 yolu ile kazan; yasal farklı takaslarla hamleleri tüketip kaybet; tekrar ve menü/geri dön. Çözüm yolu UI tarafından otomatik uygulanmaz. |

Unity Browser build desteği ve iOS bellek sınırları gerçek Safari/cihaz üzerinde doğrulanmalıdır; otomatik masaüstü WebKit sonucu fiziksel iPhone testi değildir. Runtime, geçici görseller kullanır; gerçek Blender entegrasyonu [BLENDER_ASSET_PIPELINE.md](BLENDER_ASSET_PIPELINE.md) üzerinden ilerler.
