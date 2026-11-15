# Balance Lab PR #11 ile 9.5 ekonomi izolasyonu

Bu, 9.5 Integration için ek uyumluluk kontrolüdür. PR #11'i birleştirmez; ana menüye Lab bağlantısı veya normal oyuna Lab betiği eklemez. İki geliştirme dalını tek seferde yayımlama izni anlamına gelmez.

## Sabit kaynak ve gerçek çalışma yolu

Lab kaynağı PR #11'in **`85bc092d4d2e0dc01e91527b92a1d8cbf4664ca1`** commit'ine sabittir. Hareketli branch adı kabul edilmez. `check-balance-lab-economy-isolation.cjs`, ayrı checkout'u `HEXROTA_LAB_SOURCE` üzerinden okur; yerel varsayılan kardeş `/workspace/hexrota-94` dizinidir. Lab HTML/CSS/JS/katalog/veri dosyalarının bu commit'e göre değiştirilmediğini ayrıca doğrular.

Testin bellek içi statik sunucusu gerçek PR #11 `balance-lab.html`, `balance-lab.css`, `balance-lab.js`, `balance-lab-catalog.js` ve `balance-lab-data.js` dosyalarını sunar. **`engine.js`, `levels.js`, `variants-data.js` ve favicon mevcut 9.5 checkout'undan** sunulur. Bu dosyaların sabit Lab kaynaklarıyla byte düzeyinde eşitliği sınanır. Lab dosyaları normal uygulamanın `dist/` dizinine kopyalanmaz; kaynak checkout'a ve gerçek kullanıcı kayıtlarına yazılmaz.

```sh
HEXROTA_LAB_SOURCE=/workspace/hexrota-94 \
HEXROTA_BROWSER=chromium \
node check-balance-lab-economy-isolation.cjs

HEXROTA_LAB_SOURCE=/workspace/hexrota-94 \
HEXROTA_BROWSER=webkit \
node check-balance-lab-economy-isolation.cjs
```

`HEXROTA_CHROMIUM_PATH` / `HEXROTA_WEBKIT_PATH` mevcut tarayıcı testleriyle aynı şekilde kullanılabilir. `HEXROTA_LAB_ECONOMY_REPORT_DIR` belirtilmezse ekran görüntüleri ve `report.json` geçici bir dizine yazılır. Tarayıcı yoksa test başarısız olur; JSDOM veya JavaScript sonucuyla sahte tarayıcı başarısı üretilmez.

## Korunan gerçek 9.5 durum örneği

Sentinel profil gerçek 9.5 saf modülleriyle kurulur. İlk altı bölümün kazanma yolları gerçek motorla tekrar oynatılır; yeni cüzdan bir kez geçiş yapar. Aktif yedinci bölüm katalogdan gerçek varyant/Attempt ID ile seçilir, bir geçerli takas ve envanter kesintisiyle bağlı bir fırça komutu uygulanır. Yardımlı snapshot yeniden oynatılabilir; ekonomi ve can durumu kendi doğrulayıcılarından geçirilir.

| Alan | Başlangıç sentinel değeri |
| --- | ---: |
| Yeni oyun Altını | 50 |
| Kalıcı yıldız | 6 |
| Yeşil Fırça / Renk Anahtarı stoku | 3 / 3 |
| Attempt seri sayacı | 77 |
| Normal can | 3 |
| Ayrı TEST Altın | 211 |
| Kanonik profil revision | 23 |

Altın hesabı: 6 doğrulanmış eski bitiş ×20 =120; gerçek 70 Altınlık fırça alımı sonrası 50. Fırça hediyesi 3 + satın alınan 1 − gerçek komutla kullanılan 1 =3. Başlangıç TEST Altını oyun Altınına dönüştürülmez.

Her tarayıcı senaryosunda normal profil, v5 oyun aynası, can/TEST cüzdanı, event/playtest kayıtları, v4/v3/v2/v1 eski anahtarları ve bağımsız başka bir yerel sentinel önceden yerleştirilir. **10 anahtarın bütün JSON byte dizileri değişmeden kalmalıdır.** Test, seed yükleme ve kendi salt okunur karşılaştırması dışında normal/oturum Storage erişimini, cookie, IndexedDB, CacheStorage, fetch/XHR, beacon ve WebSocket erişimini kaydeder ve reddeder. Yakalanıp yutulan yasak erişimler de çağrı günlüğü sayesinde testi başarısız kılar.

## Kapsam

- Gerçek Chromium ve WebKit üzerinde 320×568, 390×844 ve 844×390 kontrolleri.
- 10 bölüm / 4 varyant seçenekleri; orijinal ve birden fazla deney arasında geçiş.
- Gerçek bir kazanma rotasının oynanması, gerçek kayıp, aynı tahtayı yeniden başlatma ve sayfa yenileme.
- Yeniden açılışta aynı başlangıç değerleri ve RNG; Lab sonucu Altın/yıldız/stok/can/Attempt sayacı üretmez.
- Normal app, ekonomi, komut, can, kayıt, event/playtest ve bahçe servislerinin tarayıcıda yüklenmediği; normal menü/yardımcı panellerin bulunmadığı kontrol edilir.
- Yanlış deney/Level ID birleşimi, bilinmeyen deney ve yinelenen URL alanlarının yeni tahta oluşturmadan reddedilmesi.
- Lab'in `lab94-...` kimliği normal kampanya kataloğuna ve ekonomi ilk-bitiş işlemine kabul edilmez.

**Dışa aktarma sınırı:** Sabit PR #11 sayfasında export düğmesi veya indirme servisi yoktur. Test gerçek `HexBalanceLab.inspect()` sonucunu `JSON.stringify` ile yerel JSON'a çevirip tekrar okur; kopyanın değiştirilmesinin gerçek Lab tahtasını ve normal profili değiştirmediğini doğrular. Bu, uygulanmamış bir export UI testi olarak sunulmaz. Raporda `labExportUiImplemented:false` açıkça yer alır.

Ham orijinal/baseline classic-v4 snapshot'ı kendi başına kaynağını kriptografik olarak kanıtlamaz. İzolasyon; ayrı Lab kimliği, normal oturum servislerinin hiç yüklenmemesi ve sıfır profil erişimiyle sağlanır. Deneysel tahtayı metadata'sı değiştirilerek gerçek kayda aktarma yolu eklenmez.

## 9.4 donmuş manifest ile meşru uyum

PR #11'in `fixtures/balance-lab-protected-9-4.json` manifest'i 91 eski dosyayı kendi başlangıç durumuna sabitler. 9.5'te bilinçli olarak değişen uygulama/UI dosyalarını bu eski hash'lerle karşılaştırıp “bölüm motoru değişti” demek doğru değildir. Buna karşı bütün manifest'i yeniden üretmek de gerçek motor/veri değişikliklerini gizler.

Bu ek kontrol manifest'i değiştirmeden şu ayrımı yapar:

- **81 değişmez dosya:** Mevcut motor, yayımlanmış bölüm/varyant verileri, özgün fixture'lar ve değişmeyen C# çekirdekleri eski hash'leriyle eşleşir.
- **8 onaylı host/UI dosyası:** `dist/app.js`, `dist/index.html`, `dist/style.css`, `dist/sw.js`, C# `GameSessionController.cs`, `SaveMigration.cs` ve Application parity harness'inin proje/Program dosyaları 9.5'in amaçlanan değişiklikleridir. Yeni kontrol bunların güncel farklarını raporlar; eski hash eşitliği iddia etmez. Davranışları 9.5 normal JS/C#/mobil testlerinin sorumluluğundadır.
- **Hint worker:** Yalnız `engine.js?v=...` önbellek query değişikliği normalize edilir. İşlev kodu değişirse test başarısız olur.
- **Roadmap:** PR #11 checkout'undaki özgün belge korunur/doğrulanır; henüz birleştirilmemiş 9.5 dalında mevcut olması varsayılmaz. Üzerine yeni strateji yazılmaz.

İleride PR #11'in bütün eski Lab testlerini 9.5 ile birlikte bir **geçici compatibility worktree** üzerinde çalıştırmak gerekirse, önce aynı 81 hash kapısı geçirilmelidir. Yalnız bu geçici ağaçta manifest'in onaylı host/UI hash'leri ve yeni additive npm/CI başlangıcı belgelenmiş 9.5 commit'ine güncellenebilir. Hint worker normalizasyonu ayrıca raporlanır; motor, bölüm/varyant, özgün kazanma sertifikaları ve analiz politikası hash'lerine dokunulmaz. Böyle bir geçici adaptasyon kaynak PR #11'in manifest'ini veya ana dalı değiştirmez; başarısız testleri kaldırma izni vermez.

Bu hedefli kontrol 37 binin üzerindeki bütün denge simülasyonlarını yeniden çalıştırmaz. PR #11'in mevcut analiz raporu ve kendi CI sonuçları ayrı kanıttır; bu görev yalnız yeni ekonomiye karşı izolasyonu sınar.

## Integration CI bağlantısı

Integration CI, aynı depodan yukarıdaki tam SHA'yı ikinci bir `actions/checkout` adımıyla ayrı fixture dizinine alıp `HEXROTA_LAB_SOURCE` ayarlayabilir. Fixture için ikinci `npm ci` gerekmez; test mevcut 9.5 Playwright kurulumunu kullanır. Chromium/WebKit mevcut mobil matrix'ine ayrı bir kontrol olarak eklenebilir; eski kontroller kaldırılmaz. Script, bu sabit checkout veya gerçek tarayıcı yoksa sessizce atlamaz.

## Gerçek yerel doğrulama

15 Kasım 2026 çalışmasında Chromium **6/6**, gerçek Playwright WebKit **6/6** grup geçti; iki tarayıcıda da 81 değişmez dosya ve 10 korunan anahtar doğrulandı. Tarayıcı sayfa hatası, dış ağ isteği veya saklama API'si erişimi görülmedi. WebKit'in bu makinedeki varsayılan başlatması eksik sistem kütüphaneleri nedeniyle başarısız oldu; daha önce doğrulanmış `/workspace/scratch/hexrota-qa/webkit-launch.sh` üzerinden gerçek MiniBrowser ve yerel kütüphaneler kullanılarak test başarıyla tekrar çalıştırıldı. JS/JSDOM yedeği kullanılmadı.

Bu, henüz oluşturulmamış Integration PR'ın CI sonucu değildir. Son Integration commit'i üzerinde aynı kontroller CI'da yeniden çalıştırılmalıdır. Fiziksel iPhone/Android, Unity, IL2CPP ve gerçek mağaza/reklam sağlayıcıları bu kontrolle doğrulanmış sayılmaz.
