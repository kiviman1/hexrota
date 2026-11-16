# F-01 — Görsel tamamlanma ve kanonik kaydın ayrılması

## Kapsam ve audit durumu

Başlangıç: güncel `main` **`62c3fc1da82918bd7d39fcb4c04ece1aea26a39e`**. Fix dalı: `fix/presentation-duplicate-persist-f01`.

Kaynak bulgu: **F-01 / Orta**, [PR #26](https://github.com/kiviman1/hexrota/pull/26) ve [o PR'daki audit raporu](https://github.com/kiviman1/hexrota/blob/a4bd5ba9c7fd1070e843780b67799a8e29e03d91/docs/GAME_CORE_PRESENTATION_AUDIT.md). **PR #26 birleştirilmiş değildir.** Bu fix main'den açıldı; audit commit'i veya raporu main'de varmış gibi kopyalanmadı.

Bulgu bu dalda hedefli olarak düzeltildi ve kalıcı regresyonlarla doğrulandı; main için kapanış ancak fix PR'ı onaylanıp birleştirildiğinde geçerlidir. Bu belge, audit'in açık bulgusunun takip/düzeltme referansıdır. Genel animasyon hattı veya PR #25 state mimarisi refaktörü yapılmadı.

## Kök neden ve gerçek işlem sınırı

`performSwap()` motoru senkron çözüp completion/reward, board snapshot, can settlement ve terminal olayı hazırladıktan sonra açık `commitSession()` çağırır. `confirmAssistance()` da inventory debitini ve komut sonucunu aynı kanonik işlemde kaydeder. Ancak eski `finishPresentation()` hem başarılı redraw sonunda hem render catch'inde tekrar `persist()` çağırıyordu.

Bu çağrı `stageSession` → `commitSession` → `SessionStore.commit` ile ikinci profil yazımıydı. İlk commit başarılı, yalnız bu son yazım hatalıysa son durable board korunmasına rağmen `lifeWriteFailed=true` oluyor, sonraki girdi engelleniyor, yanlış rollback mesajı çıkabiliyor ve victory sunumu atlanabiliyordu. Aynı yolun sentetik pointer varyantında sonradan yapılan meşru bir preference yazımı eski event baseline'ını yeniden saklayıp terminal olayını silebiliyordu.

Kanonik ödül/board/can kaybı veya çift ödül bu bulgunun kanıtlanmış etkisi değildi. Sorun, kesinleşmiş işlemin görsel bitiş sırasında yeniden bir kayıt hatası yüzeyine sokulmasıydı.

### `finishPresentation` içinde meşru veri yazımı var mı?

Kod ve 19 çağrı noktası incelendi. `comboText`, headline kullanımı, receipt metni, görsel controller/taş/partikül temizliği, render, Tavik tepkisi ve terminal modal zamanlayıcısı geçici sunumdur. `renderLevels()` DOM'u değiştirir; `render()` DOM/demo/sahne ve isteğe bağlı activity görünümünü yeniler. Bu yol yeni board, skor, RNG, stok, hak veya can değişimi üretmez.

| Çağıran sınır | Korunan bağımsız otoriter kayıt |
| --- | --- |
| Normal takas / assisted komut | Sunum başlamadan önce mevcut açık atomik commit. |
| Home / ekran değişimi | `showScreen()` içindeki mevcut `persist()`. |
| Mola | `pauseGame()` içindeki mevcut `persist()`. |
| Kullanıcı hareket/ses tercihleri | `savePreferences()`; sistem motion gözlemi kendi başına preference yazmaz. |
| Life / rescue / provider | Mevcut `lifeCommit`, reconciliation, receipt ve açık grant commit yolları. |
| Visibility dönüşü / pagehide | Mevcut life/rescue refresh ve checkpoint yazımları. Görsel finisher bu yetkilerin yerine geçmez. |

## Kod değişikliği

`dist/app.js` içinde yalnız finisher'ın iki `persist()` çağrısı kaldırıldı:

```js
// Commands already committed gameplay, rewards and lives before presentation.
// Redraw failures must not write or roll back that durable transaction.
try{renderLevels();render();}
catch(_){/* Keep committed results eligible even if the redraw fails. */}
finally{
  // Mevcut busy/controls cleanup'ı aynen korunur.
}
```

Catch korunur: `cancelPresentation()` current görsel işi önceden temizlediği için bir render istisnasını dışarı bırakmak, aşağıdaki sonuç zamanlayıcısının çalışmasını engelleyebilirdi. Render hatası artık kanonik yazım veya rollback başlatmaz. Mevcut job/epoch/token, AbortController, watchdog, focus/navigation/modal ve terminal eligibility kontrolleri değiştirilmedi.

`persist()`, `stageSession()`, `commitSession()`, rollback veya event-baseline politikası global olarak değiştirilmedi. Terminal olay zaten ilk başarılı commit öncesinde hazırlanır; hatalı ikinci commit yolunun kaldırılması bu F-01 geri-sarma yolunu ortadan kaldırır. Analitik olaylar oyun hakkı veya ikinci bir otoriter kayıt haline getirilmedi.

PWA kabuğu **v40 → v41** olarak tutarlı güncellendi: HTML/worker query'leri, hint worker, UI kit ve SW cache/preload filtresi. Böylece çevrimdışı önbellek düzeltilmemiş `app.js` üzerinde kalmaz. Bu, profil/snapshot/command/attempt/life şeması ya da ürün sürümü değişikliği değildir; yeni runtime modülü eklenmedi.

## Önce / sonra ve kanonik yazım sayıları

Sayılar boot/enter tamamlandıktan sonra yalnız `hexrota-profile-v2` girişimini ölçer. Mirror, yerel analitik ve test raporu yazımları kanonik commit sayılmaz. Ayrı gerçek kullanıcı/platform işlemleri için bütün uygulamaya “yalnız bir yazım” kısıtı getirilmedi.

| Senaryo | Eski davranış / red kanıtı | Düzeltilmiş kabul |
| --- | --- | --- |
| Normal veya reduced-motion hamle | 2 başarılı profil yazımı; revision +2. | 1 başarılı yazım; revision +1; animasyon sonunda ilk committed byte'lar korunur. |
| Yalnız varsayımsal ikinci yazıma quota hatası | 2 girişim /1 başarı /1 ret; sonraki geçerli hamle engellenir. | İlk komutta yalnız 1 girişim; fault tetiklenmez. Sonraki gerçek komut, yeni fault penceresinde 1 meşru yazımla focus/reload olmadan ilerler. |
| İlk otoriter komut yazımı hata verir | Tam rollback gereklidir. | 1 girişim /0 başarı /1 ret; revision +0, board/RNG/history/inventory/ödül/can/events eski halindedir. |
| Gerçek final win | İkinci yazım reddedildiğinde ödül kalır ama Home/kapalı victory gözlenir. | 1 yazım; normal victory; bir clear, bir terminal olay ve can kesmeyen tek win settlement. |
| Yeşil Fırça / Renk Anahtarı | İlk commit'ten sonra tekrar yazıma girer. | Her onay 1 yazım; inventory yalnız 1 azalır; komut ID/geçmiş/strict replay korunur. Preview 0 yazımdır. |
| Render hatası | Catch tekrar persist ederek transaction hatasına dönüşebilir. | Görsel sonuç temizlenir; 0 ek kanonik yazım/rollback; next move veya uygun victory mümkün kalır. |
| Görsel reveal / API hata-iptal | Bitiş ikinci yazıma yol açar. | Komut 1 yazım; reveal, cancel ve geç callback 0 ek yazım. |
| Home, Mola veya hidden→Pause | Görsel yazım aynı event batch'ine karışabilir. | Komut 1 + mevcut açık navigation/pause işlemi 1. Domain içeriği aynıdır; görsel bitiş ek yazmaz. |
| Gerçek reload, win henüz busy | Pagehide otoritesi görselden ayrılmalıdır. | Komut 1 + mevcut rescue pagehide 1 + life pagehide 1 + checkpoint pagehide 1 =4. Yeni boot tamamlanan bölüm yerine bir sonraki açığı seçebilir; eski won checkpoint ve haklar korunur. |

Fault sayacı **komut/sunum penceresi** başına kurulur; sonraki meşru hamlenin ilk yazımı yanlış biçimde “yasak ikinci yazım” sayılmaz. Home/tercih/life/provider gibi meşru işlemlerin testleri fault'u ayrı segmentte izler.

## Kalıcı regresyonlar

### `check-f01-presentation-ui.cjs`

Gerçek `app.js`, motor, command, economy/life ve canonical store'u mevcut fixture'larla çalıştıran **20 grup**. JSDOM'da yalnız platform animasyon/storage arızası enjekte edilir; sahte gameplay motoru veya finisher/commit implementasyonu kullanılmaz.

- A/B: normal ve animasyonlu hamlede bir yazım; ikinci-yazım fault'u kullanılmaz; sonraki hamle focus olmadan çalışır.
- C: oynayan, kazanan, brush ve key ilk-yazım hatalarında tam atomik rollback.
- D: gerçek final kazanımında normal modal, tek clear/terminal olay/uncharged life sonucu.
- E: iki güçlendiricinin gerçek preview/onay UI'sı, mevcut hamle prefix'iyle karışık komut geçmişi, işlem ID'si, inventory debit ve strict replay.
- F: sentetik pointer win sonrası gerçek ses tercihi yazımında terminal olay **1→1** kalır.
- G: final `renderLevels` ve board redraw arızalarında kontrol/görsel cleanup'ı, sıfır ek yazım ve normal next move.
- Rapid reveal, kısmi Animation API arızası, Home, ikinci görsel dalgada Mola, visibility ve kullanıcı motion tercihinin kendi meşru yazımı ayrıca kontrol edilir.

Mevcut `check-lives-ui.cjs` gerçek kaybeden hamlede normal defeat, tek can kesintisi, tekrar sonuç ekranı ve başarısız terminal commit/retry atomikliğini ayrıca korur; tam `npm test` bu kontrolleri de yeniden çalıştırdı.

Test `npm run test:f01` ile bağımsız ve mevcut `npm test` sonunda kalıcı olarak çalışır. Hiçbir eski test kaldırılmadı.

### `check-f01-browser.cjs`

Gerçek Chromium ve WebKit, native touch girdileri ve **320×568, 390×844, 430×932**. Motor/assisted preview ve replay üretim modüllerinden alınır; test içinde ikinci bir oyun kuralı algoritması yoktur. Kanonik yazım byte'ları ile board/RNG/score/turn/Attempt ID/ekonomi/life/events karşılaştırılır; board/HUD/topbar kutuları before/during/after ölçülür.

Bir-yazım/fault/ilk-hata/win/iki güçlendirici/kesintiler/reduced-motion/playing ve winning render hatası/gerçek mid-win reload kalıcı kapsamdadır. Güncel CI'nin iki `Application state in ...` işine yeni F-01 adımı ve screenshot/JSON artifact'ı eklendi. Eski 17 iş ve bütün eski adımlar korunur.

## Gerçek doğrulama kaydı

| Koşum | Sonuç |
| --- | --- |
| Son, fixture'ları düzeltilmiş eski-kod Node baseline | **Red:8/20**, gerçek exit 1; 12 F-01 assertion'ı başarısız. İlk komut yazımı hatası ve meşru action-persistence kontrolleri geçti. |
| Eski-kod browser baseline | Chromium'da doğrudan runner exit 1; her iki motorda `actual2 vs expected1`, exact committed turn korunurken sonraki native hareket engellendi. WebKit'in ilk log-print wrapper'ı 0 dönse de structured sonuç `success:false` idi; başarı sayılmadı. |
| Dar fix sonrası hedefli Node | **Green:20/20**, exit 0, 20 yazım gözlemi, uncaught/unhandled hata yok. |
| `npm test` | **Geçti, exit 0**; tüm mevcut zincir ve yeni F-01 20/20. |
| `npm run test:state` | **Geçti, exit 0**; core19/1.861 assertion, selector19, effects15, characterization11, guard8, operation4, lifecycle1. |
| `npm run test:f01-browser` Chromium / WebKit | **21/21 +21/21 geçti**, unfiltered, her biri gerçek exit 0 ve sıfır pageerror. Üç mobile viewport’ta native touch, exact before/during/after board/HUD ölçüleri. |
| `npm run test:state-browser` Chromium / WebKit | **25/25 +25/25 geçti**, her biri exit 0. |
| `npm run test:scene-browser` Chromium / WebKit | **38/38 +38/38 geçti**, her biri exit 0; mevcut sahne ve çevrimdışı kontrolleri. |
| Session / persistence | **Chromium session5/5 +integration6/6 geçti**, exit 0; gerçek iki-sekme, atomik recovery ve offline shell. Mevcut Node life/session consistency kontrolleri tam npm zincirinde geçti. |
| Mevcut 10 gerçek C# parity komutu | **10/10 geçti, her biri exit 0**; gerçek .NET8.0.428/C#7.3 derlendi, C# kaynak hash’i değişmedi. |

C# komutları: `test:unity-rewards`, `test:unity-gameplay`, `test:unity-catalog`, `test:unity-hints`, `test:unity-reward-adapter`, `test:unity-lives`, `test:unity-session`, `test:unity-economy`, `test:unity-commands`, `test:unity-rescue`. Örnek kapsam: gameplay1.913 takas/80 rota; session1.362 ve event580 complete JSON; commands2.928 comparison/16.001 step. Hiçbir JS fallback kullanılmadı.

İlk geniş browser denemelerinde test aracı beklentileri düzeltildi: SVG yeniden çizilirken geçici hücre düğümünden koordinat okuma yarışı için aynı fiziksel nokta hamleden önce alındı; gerçek reload için rescue+life+checkpoint olmak üzere üç mevcut pagehide yazıcısı ayrı sayıldı. Kazanma-render hata testinde locator’ın otomatik stabilite beklemesi doğal victory ile yarıştığı için önceden ölçülen gerçek Pause merkezine doğrudan native touch kullanıldı. Runtime bu beklentiler için değiştirilmedi; her sonraki yazımın game/energy içeriği ilk commit ile tam karşılaştırılır. Başarısız ilk deneme artifact’ları korundu; tüm kalıcı browser suite’i iki motorda filtresiz yeniden çalıştırıldı. Mevcut session runner'ın yerel Chromium binary seçimi ortam değişkeniyle düzeltildi; kaynak kodu değişmedi.

Grup, assertion, komut, dalga ve JSON karşılaştırma sayıları tek bir test sayısına eklenmez. Kaynak listesi ve nihai head CI/Preview bağlantıları fix PR'ının açıklamasında tutulur; henüz çalıştırılmamış bir komut geçmiş sayılmaz.

## Değişen dosyalar

- `dist/app.js`: görsel finisher'dan iki yazımın kaldırılması ve hint-worker cache query'si.
- `dist/index.html`, `dist/sw.js`, `dist/hint-worker.js`, `dist/ui-kit.html`: tutarlı v41 PWA kabuğu.
- `check-f01-presentation-ui.cjs`, `check-f01-browser.cjs`: kalıcı gerçek uygulama regresyonları.
- `package.json`, `.github/workflows/ci.yml`: mevcut zincire Node/browser testlerinin eklenmesi.
- `docs/ARCHITECTURE.md`: mevcut cache sürümü; bu belge: F-01 bulgu takibi ve test kanıtı.

## Korunan sözleşmeler ve sınırlar

`classic-v4`, assisted komut semantiği, board/HUD geometrisi, RNG, skor/katlar/hedefler/hamleler, 40 varyant/80 rota, ödüller/welcome, can/rescue/receipt, Attempt ID, `hexrota-profile-v2`, `hexrota-match-v5`, Snapshot v4, assisted-v1, LifeState v2 ve PR #25 durum mimarisi korunur. Tavik/coop ilerlemesi ve stiller/görseller değiştirilmez; C# çekirdeği değiştirilmez.

Fiziksel iPhone/Android ve Unity/IL2CPP test edilmedi. Gerçek `page.reload` ile sentetik visibility/pagehide farklı kanıtlar olarak etiketlenir; native BFCache davranışı garanti edilmiş sayılmaz. İlk otoriter yazım başarısızsa mevcut güvenli hata/rollback davranışının sürmesi amaçlanan davranıştır.
