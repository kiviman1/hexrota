# Hexrota 9.9a — Rescue güvenliği ve uyumluluk

## Uygulamadan önce alınan sözleşme kararı

Başlangıç main: `97d8d704d938dff28773b502938c943e89f92fb1`, PR #29 merged. Bu çalışma solvability audit'ini tekrarlamaz; PR #29'un aynı R-01 fixture'ını kullanır.

Mevcut `rescueOffer()` zaten sıfır yasal takas durumunda hem reklamı hem Altını kapatır. Yeni bir kopya UI uygunluk kuralı eklenmeyecek. Açıklar: doğrudan `AssistedGame.apply(grant_moves)` isteği; tamamlanmış fakat teslim edilmemiş reklam kanıtının yeniden açılış/uygunsuz durumlarda korunması.

Yeni canlı komut politikası:

- Mevcut terminal/hamle/son-komut/kullanım sınırları korunur. Yeni `grant_moves` isteği yasal normal takas yoksa `no_legal_swaps` ile, hiçbir alanı değiştirmeden reddedilir.
- Aynı başarılı komut kimliğinin tekrarına ait duplicate kontrolü bu ret kapısından önce kalır. Ek hamle veya kaynak ikinci kez oluşmaz.
- Kabul edilen komutun tahta, RNG, puan, zemin, geçmiş, Attempt ID ve +5 sonucu değişmez. Yeniden karıştırma yapılmaz.
- Restore yalnız modül-private/private yürütücüyle **kaydedilmiş** v1 komutlarını tarihi kurallarıyla tekrar oynatır; ardından tüm snapshot eşitliği zorunludur. Public apply/preview/clone için bypass parametresi yoktur.

Bu, yeni isteğin kabul politikasıdır; kabul edilmiş geçmiş komutun deterministik dönüşümü değiştirilmez. Bu nedenle yeni command/snapshot sürümü gerekmiyor. `assisted-v1`, commandsVersion 1, classic-v4 ve mevcut profil/ekonomi/rescue şemaları korunur. Tarihi R-01 checkpoint'i aynen yüklenebilir ve takassız kalır; sessiz normalizasyon veya ödül telafisi yoktur. Böyle bir tarihi durumu yeni oynanabilir tahtaya dönüştürmek ileride açıkça sürümlü komut/ürün kararı gerektirir.

## Kazanılmış reklam hakkının saklanması

Mevcut rescue-v1 provider şeması `completed` fakat henüz settlement/processed transaction olmayan kayıtları zaten destekler. Bu kayıt, hak saklama alanı olarak kullanılır; yeni ekonomi/para/kompanzasyon defteri oluşturulmaz.

- Doğrulanan tamamlanma yalnız ilgili verilmiş istek kimliğine birleştirilir; diğer provider kayıtları, nextSerial, reklam uygunluğu ve yeni işlemler eski provider nesnesiyle ezilmez.
- Hakkın saklanması +5 uygulamak değildir. Rescue settlement, Altın, can veya günlük başarılı reklam kotası oluşturmaz.
- Uygun gerçek kayıpta normal teslim, komut ve diğer kaynaklarla mevcut tek atomik grant commit'ini kullanır.
- Teslim edilemeyen doğrulanmış hak, mevcut provider kaydına tamamlanmış/teslim edilmemiş olarak ayrı meşru bir receipt işlemiyle saklanır. Bu işlem oynanışı değiştirmez.
- Kalıcı saklama başarısızsa kanıt bellekte yeniden teslim için kalır; başarısız işlemin Altın/hamle kısmı kısmen başarılı görünmez. Bütün depolama yazıları başarısızken sayfanın zorla kapatılmasına karşı kalıcılık garantisi verilemez.
- Yeniden açılışta tamamlanmış/teslim edilmemiş hak görülür; aynı deneme için yeni reklam veya Altın ödemesi önerilmez. Hakkı saklanmış ama tahtası uygun olmayan oyuncu menüye dönebilir; kayıtlı hak navigasyonla tüketilmez.
- Teslim edilmemiş tamamlanmış kayıtlar genel 128-kayıt sıkıştırmasında silinmez. Teslim edilmiş kayıtların mevcut idempotency arşivi korunur.
- Hak özgün Attempt ID'ye bağlı kalır. Başka denemeye otomatik aktarım, Altın iadesi veya telafi bu çalışmanın sözleşmesi değildir.

## Önceden korunanlar ve gerçekten düzeltilenler

| Sınır | Başlangıç davranışı | 9.9a |
| --- | --- | --- |
| Üretim UI teklifi | `rescueOffer()` sıfır yasal takası zaten engeller. | Bu kural korunur; kopya uygunluk algoritması eklenmez. Saklanan hakkı inceleme erişimi, grant uygunluğundan ayrılır. |
| Yeni mekanik komut | Doğrudan `grant_moves`, R-01'i üretebilir. | `apply/preview/clone` hiçbir alanı değiştirmeden `no_legal_swaps` döndürür. |
| Tarihi assisted-v1 | Eski hatalı checkpoint strict replay ile geçerlidir. | Private tarihsel yürütücü eski sonucu aynen doğrular. Public bypass yoktur. |
| Normal kurtarma | Makbuz/ekonomi, +5 ve durum tek atomik işlemde kaydedilir; hata geri alınır. | Aynı sınır korunur. Başarısız grant yazısından sonra otomatik ikinci kayıt denenmez. |
| Tamamlanmış teslim edilmemiş hak | JSON biçimi geçerli olsa da yeniden açılışta yeni reklam/Altın önerilebilir. | Saf teklif katmanı ikisini de `receipt_pending_delivery` ile kapatır; özgün işlem kimliğini döndürür. UI aynı kanıtı açık istekle teslim eder. |
| Uygun olmayan tahtaya doğrulanmış hak | Erken uygunluk reddi tamamlanma kanıtını saklamayabilir. | `retainAdReceipt/RetainAdReceipt` yalnız verilmiş hedef kaydı doğrulayıp saklar. Sonuç `applied:false, reason:receipt_retained`; bu bir +5 grant'i değildir. |
| Günlük sıkıştırma | Tamamlanmış teslim edilmemiş provider kayıtları da 128 sınırında silinebilir. | İşlenmemiş tamamlanmalar hariç tutulur. Teslim edilmiş kayıtların arşivi/idempotency korunur. |

Yapılandırma değişmedi: +5 hamle, 140 Altın, UTC gününde 2 başarılı kurtarma reklamı, deneme başına 1 kurtarma. Can ve TEST Altını bu paraya çevrilmez. Reklamlar hâlâ açıkça TEST'tir.

## Gerçek uygulama sahipliği

- `dist/commands.js` ve `unity/Commands/AssistedGame.cs`: yeni istek kabulü, private tarihsel replay ve mevcut mekanik dönüşüm.
- `dist/rescue.js` ve `unity/Rescue/RescueManager.cs`: mevcut rescue-v1 ledger'ında yalnız hedef kanıtın saklanması, tipli kimlik sorgusu, teklif kapısı ve sıkıştırma. Varsayılan doğrulayıcı yine reddeder.
- `dist/app.js` ve `unity/Application/GameSessionController.Rescue.cs`: mevcut atomik oturum sınırıyla normal grant veya ayrı receipt-only işlem. Bellekteki kaydedilememiş kanıt ile kalıcı saklanmış hak ayrı tutulur; kalıcı hak yeni bir navigation kilidi değildir.
- `dist/index.html`, `dist/sw.js`, worker import/URL ve UI kit CSS URL'si: **PWA 43** aynı shell kuşağı. Yeni runtime dosyası, oyun sürümü veya kayıt şeması değildir; eski aktif oyuna zorunlu reload eklenmedi.
- UI state, animation coordinator, `finishPresentation`, classic motor, RNG, yayımlanmış bölüm/varyantlar ve fiyatlar değiştirilmedi.

## Yeniden üretim ve kalıcı regresyonlar

`fixtures/dead-board-vectors-9-9.json` PR #29 ile byte olarak aynıdır: SHA-256 `b3e9c892a262bf0d868c821c2a70bf459b9081297205097efc1b9744a32aa349`. R-01'in hem kayıp öncesi komutları hem `before` hem de tarihi `after` snapshot'ı korunur. Yeni kabul davranışını elde etmek için arşiv yeniden üretilmez.

`check-rescue-safety.cjs`: aynı kayıp rotası yeni istekle reddedilir; preview/clone ve fazladan public replay argümanı yetki açamaz. Tarihsel snapshot aynen yüklenir, aynı `rescue:1` duplicate kalır. Bozuk geçmiş, yanlış kimlik, ekstra alan ve replay sırasında exception denetlenir. Aynı küçük tahtada başka bir yasal kayıp rotası normal +5'i ve sonraki gerçek takası doğrular.

`check-rescue-receipts-safety.cjs`: doğrulanmış hakkı saklama ve salt okuma, hatalı/iptal edilmiş/verifier tarafından reddedilmiş kanıt, yalnız hedefin eski provider'dan birleştirilmesi, UTC alt sınırı, tekrar teslim, kota, Gold/reklam kapıları ve 129 işlenmemiş tamamlanmanın 140 işlenmiş kayıt arasında korunması. Saf proposal testi gerçek profil yazma hatası diye sunulmaz.

`check-rescue-safety-ui.cjs`: gerçek app.js ve mevcut profil commit'i; yayımlanmış L8 kaybı, tamamlanmış/unclaimed reload, sıfır takasta hak saklama, ilk grant yazımında ve receipt-only yazımında hata/geri alma, açık tekrar deneme, menü/öğretici geçişi ve tarihi kayıt.

Yeni browser testi üretim kataloğuna fixture eklemez. Yalnız yerel test HTTP yanıtında aynı R-01 geometrisi/başlangıç/tohum, sayısal L8 legacy-original kimliğine açıkça eşlenir. Normal kurtarma kontrolleri ayrıca gerçek yayımlanmış L8'i kullanır. C# command testleri doğrudan özgün string fixture kimliğini kullanır; native session testleri ayrıca gerçek replay ile oluşan başka küçük hamlesiz kaybı kullanır.

## Şimdiye kadar gerçekten çalıştırılan doğrulama

| Kontrol | Sonuç |
| --- | --- |
| Yeni mekanik güvenlik | 12 grup, 22 ek tam C# command senaryosu; tarihi fixture aynı. |
| Yeni saf hak saklama | 10 grup / 83 karşılaştırma. Eski 293 JS rescue kontrolü ve wire golden'ları aynı. |
| Yeni actual-app UI | 8 grup; eski A callback'i ile yeni B'nin kaydedilememiş hakkı da dahil. Mevcut ikinci şans UI paketi ayrıca 15 grup / 169 takas / 22 gerçek kayıpla geçti. |
| Yeni Chromium browser | 10/10; native touch/kontroller, aynı Attempt/RNG, ret, normal Gold ve TEST reklamı, duplicate, hata, hak saklama, gerçek reload. |
| Yeni WebKit browser | 10/10; aynı senaryolar. Yönetilen WebKit binary/kitaplık launcher'ı kullanıldı. Fiziksel iPhone testi değildir. |
| Eski main geometri karşılaştırması | Aynı test-local R-01 ile 3/3 mobil viewport; tahta/hücre/taş ölçüleri baseline'a 0,01 px içinde eşit. |
| C# command parity | Gerçek .NET 8.0.428 / C# 7.3: 2.952 tam karşılaştırma, 16.051 adım, 3.332 dalga. Eski 2.928 golden karşılaştırma korunuyor. |
| C# rescue parity | 376 gerçek karşılaştırma = 293 eski + 83 yeni; mevcut 600 lifecycle geçişi korunuyor. |
| C# session parity | 1.362 tam JSON, 36 actual-app akışı, 63 native hata/guard senaryosu = 56 eski + 7 yeni. Eski A makbuzunun duplicate bildirimi, yeni B'nin henüz kaydedilememiş kanıtını temizleyemez. |
| Tam `npm test` | Son kaynaklar üzerinde **exit 0**. Bütün eski zincir, F-01 20/20, 9.8 animasyon paketi, mevcut solvability raporu `--check` ve yeni 12 + 10 + 8 grup aynı komutta tamamlandı. |
| 10 gerçek C# komutu — son birlikte doğrulama | **10/10 exit 0**; .NET SDK 8.0.428 / C# 7.3. UTC 2026-11-17 00:24:24–00:25:31; 219 ilgili kaynağın öncesi/sonrası SHA-256 özeti aynı (`2775e4fdceb0923869df865607eb6516a2e2d0ad04842d8b8ee545cd54ce3723`). Son native düzeltme dahil; JS fallback yoktur. |

Mevcut GitHub Actions işleri kaldırılmadı. Yeni Node paketi `npm test` sonuna eklendi; mevcut mobile Chromium/WebKit işlerine ayrı `test:rescue-safety-browser` adımı ve screenshot/JSON artifact'ı eklendi. Yeni command, receipt ve session karşılaştırmaları mevcut gerçek C# işlerinde derlenir.

Final C# komutları: `test:unity-rewards`, `test:unity-gameplay`, `test:unity-catalog`, `test:unity-hints`, `test:unity-reward-adapter`, `test:unity-lives`, `test:unity-economy`, `test:unity-commands`, `test:unity-rescue`, `test:unity-session`. Bunların her biri gerçekten çağrıldı; aynı modül sayısını iki kere sayarak 10 elde edilmedi. Gameplay 1.916 takas, catalog 2.107, hints 1.003, reward adapter 1.456 turn / 2.928 dalga, lives 344 istek, economy 579 sonuç, rewards 104 vektör ve session altında 580 event JSON karşılaştırması da korundu.

CI'nin nihai uzak sonucu PR check listesinde tutulur; bu belge yerel doğrulamayı uzak koşum yapılmış gibi sunmaz. Aynı 15 job tanımı ve iki browser matrisiyle toplam 17 iş korunur. Screenshot/JSON kanıtları `rescue-safety-chromium` ve `rescue-safety-webkit` artifact'larıdır. Production yapılandırmasına müdahale yoktur.

### İlk başarısız kontroller ve çözümü

- PWA kuşağı yükseltilirken ilk kontrol eski hint-worker URL'sini yakaladı. App worker URL'si ve worker engine import'u aynı 43 kuşağına alındı; assert değiştirilmedi.
- Yeni native tutorial regresyonu, kampanya makbuz kimliği sorgusunun öğretici string ID'ye gitmesini yakaladı. Guard yalnız doğru retained-receipt helper'ına alındı; eski tutorial bağlam kuralı değiştirilmedi. Son native suite geçti.
- Tam `npm test` ilk çalışmada tema döneminin koruma hash'inde durdu: istenen rescue değişiklikleri, eskiden byte korumalı dosyalardır. Eski `comic-ui-protected.json` veya golden'lar değiştirilmedi; yalnız altı incelenmiş rescue dosyası için `rescue-safety-protected.json` eklendi. Test hem tam altı yol listesini hem kaynak hash'lerini denetler; classic ve diğer dosyalar eski korumada kalır. Bu bir dosya korumasını kaldırma veya genel hash atlama değildir.
- Son incelemede eski A makbuzunun duplicate bildiriminin, B'nin başarısız grant kaydından kalan C# bellek kanıtını temizleyebildiği gerçek native testle kırmızı üretildi. Temizleme iki duplicate dalında yalnız aynı işlem kimliği için sınırlandı. Yeni native regresyon B'nin tekrar teslimini ve sonraki A/B duplicate'lerinin kaynak üretmemesini doğrular.
- İlk yeni browser geometri karşılaştırması PLAYING ile LOST'un dış `#board` yüksekliğini eşit varsaydı: 320×568'de 339,8125 → 309,8125 px. Aynı yerel HTTP testinde app.js ve commands.js yanıtları main `97d8d70` kaynaklarıyla değiştirilince aynı fark tekrarlandı; CSS ve sahne dosyaları zaten değişmemiştir. Yeni assertion aynı LOST evresini provider/ret kontrolleri önce/sonra karşılaştırır; gerçek taş boyutunu ayrıca iki evrede ölçer. Taşlar küçülmez; dış alanın −30 px ve hücrelerin −15 px Y davranışı baseline'da da vardır ve bu görevde düzeltilmez.
- SVG bounding-box strict float eşitliğinde 0,0000153 px fark ölçüldü. Gerçek ham ölçümler JSON'da tutulur; taş boyutu için 0,01 px ölçüm toleransı kullanılır. Güvenlik veya kaynak assertion'ı gevşetilmedi.
- Stock WebKit başlatıcısında eksik sistem kitaplıkları görüldü; başarısız install-deps girişimi paket kurmadı. Mevcut yönetilen launcher ile gerçek WebKit paketi çalıştırılıp geçti. Tarayıcı görünürlük olayı sentetiktir; sayfa reload'u gerçektir.

## Açık kalanlar ve uyumluluğun bedeli

1. **Eski R-01 checkpoint'i takassız kalır.** Yeni komut kapısı düzelmiştir; geçmişte verilmiş 5 hamleyi geri almak veya tahtayı/RNG'yi değiştirmek bu iş değildir. UI güvenle okuyabilir; kapsam “bütün tarihi tahtalar artık oynanabilir” değildir.
2. **R-02 açık:** tek değerli desteklenmeyen palet yedeği bu PR'da değiştirilmedi. `npm run audit:dead-board-diagnostics` çözülmemiş bulgu için kasıtlı exit 1 verir. R-01 yeni istek sağlığı ile tarihi kötü checkpoint karakterizasyonu ayrı gösterilir.
3. H-01/H-02/A-01 audit bulguları bu görevde çözülmedi. Ağır yeni runtime çözücü yoktur.
4. Hakkın özgün denemesi değişmiş/terk edilmişse tamamlanmış kayıt tutulur; başka denemeye otomatik aktarım veya tazminat yoktur. Böyle bir ürün kararı yeni, açık defter sözleşmesi gerektirir.
5. Teslim edilmemiş haklar artık sessizce düşmez; aşırı uzun süre biriken haklar için ileride kayıpsız arşiv politikası gerekebilir. Mevcut günlük/deneme sınırları değiştirilmedi.
6. İptal edilmiş veya unavailable verilmiş isteğin eski kopyasından üretilen makbuz mevcut güven sözleşmesinde doğrulanmış sayılmaz. Test sağlayıcısı iptalden sonra tamamlanma makbuzu üretmez. Canlı SDK yarış/yeniden teslim politikası canlı entegrasyon öncesi ayrıca tanımlanmalıdır.
7. Bütün kalıcı yazılar başarısızken bellekteki makbuzla zorla kapatılan sekme için kayıpsızlık iddiası yoktur. Mevcut TEST pending işlemi yeniden açılabilir; bu, canlı bir sağlayıcı garantisi değildir.
8. Fiziksel iOS/Android, Unity sahnesi ve IL2CPP çalıştırılmadı. Production deployment yapılandırması değişmedi; bu PR otomatik birleştirilmez.
9. 9.9 öncesinde sıkıştırmayla zaten silinmiş ve başka kopyası bulunmayan tamamlanma kanıtı yeniden üretilemez. Mevcut kayıttaki tamamlanmış haklar ileriye doğru korunur; kayıp geçmiş için otomatik telafi uydurulmaz.
