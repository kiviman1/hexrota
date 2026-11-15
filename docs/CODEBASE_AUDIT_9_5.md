# Hexrota 9.5 — kod incelemesi ve güvenli bakım raporu

**Tarih:** 15 Kasım 2026  
**Referans:** `7deb686e1f4cd79aedd9763522c381ff145d216d` (PR #16 birleşmesi)  
**Dal:** `refactor/hexrota-maintenance-9-5`  
**Amaç:** Yeni özellik veya zorluk değişikliği değil; doğrulanmış kayıt hatalarının giderilmesi, sorumlulukların ayrılması ve bakım korumaları.

## İncelemenin kapsamı ve sınırı

Runtime JavaScript, saf C# kaynakları, test çalıştırıcıları, CI, PWA bağımlılıkları ve mevcut ürün/kayıt belgeleri envanterlendi. Elle inceleme özellikle büyük uygulama closure'ı, save bootstrap, profil commit'i, JS/C# normalizasyon farkları, çizim/giriş, efekt iptali ve özelliklerin işlem sınırına odaklandı. Saf çekirdeklerin yayımlanmış verileri ve çıktıları mevcut regresyon/parity testleriyle korunur.

Bu rapor “bütün olası hatalar giderildi” iddiası değildir. Fiziksel iOS/Android, Unity/IL2CPP, gerçek ödeme/reklam ve üretim dosya adaptörü bu çalışma kapsamında test edilmedi. Bölüm hedefleri, hamleler, fiyatlar, 40 varyant ve 80 kazanma sertifikası değiştirilmedi.

## Düzeltilen somut sorunlar

Aşağıdaki beş başarısız beklenti, önce değişmemiş referans sürümde yeniden üretildi. Ortak kök nedenler üç gruptur; sayı beş bağımsız ürün arızası olarak abartılmamalıdır. Bunlar ağırlıkla bozuk/sınır kayıt koşullarıdır, olağan oynanışta sürekli oluştuğu iddia edilmez.

| ID | Eski davranış / risk | Düzeltme ve doğrulama |
| --- | --- | --- |
| SAVE-01 | JS revision `Number.MAX_SAFE_INTEGER` sınırını aşarak sonraki açılışta reddedilen profil yazabiliyordu; C# zaten engelliyordu. | Yazmadan önce `revision_exhausted`; bellek, aynalar ve kanonik byte'lar korunur. Gerçek C# karşılaştırmasına eklendi. |
| SAVE-02 | `commit(null, energy)` veya diğer geçersiz kökler yüklenemeyecek bir profil oluşturabiliyordu. | Her iki payload ve yeni zarf yazımdan önce doğrulanır. C# public commit null girdisi de aynı hata sınıfına getirildi. |
| SAVE-03 | Açık oturumda kanonik profil şeması bozulup revision aynı kaldığında JS onu sessizce ezebiliyordu. | Mevcut kanonik zarf her commit'te yeniden doğrulanır; yanlış şema/map reddedilir. |
| SAVE-04 | Boş profille açıldıktan sonra eklenen JSON `null`, `latest?.revision || 0` nedeniyle yok sayılabiliyordu. | Fiziksel anahtar varlığı ile parsed null ayrıldı; bozuk içerik korunur. |
| SAVE-05 | Mevcut `hexrota-match-v5: null`, yeni oyuncu gibi varsayılanlarla değiştirilebiliyordu. Legacy falsy/null seçiminde de aynı sınıf risk vardı. | `contains` + strict `HexGameSave.load`; C# başlangıcında aynı varlık kontrolü. Hatalı yeni kayıt eski kayda sessizce düşmez. Gerçek uygulama bootstrap testi eklendi. |

Mevcut v4/v5 geçerli kayıtların ve indeksli eski dizi konteynerlerinin normalizasyonu korunur. Bu düzeltmeler yeni bir kayıt sürümü, veri silme veya kendiliğinden onarım mekanizması oluşturmaz.

## Yapısal düzenlemeler

### 1. JavaScript görünüm ve bootstrap sınırları

157.230 byte'lık `dist/app.js`, 138.312 byte'a indirildi (yaklaşık %12). Amaç yalnız satır azaltmak değil; dört alanın bağımlılıklarını açık hâle getirmekti:

- `game-save.js`: DOM/yazım olmadan kayıt yükleme ve eski sürüm normalizasyonu.
- `board-view.js`: motor/DOM/saat olmadan geometri, SVG ve karşılıklı takas yolları.
- `board-input.js`: parmak hareketinin altı yönlü sınıflaması; takas uygulamak host'un işidir.
- `score-presentation.js`: bağımlılıkları enjekte edilmiş puan efekti; oyun/cüzdan/kayıt erişimi yok.

Eski fonksiyonlar ikinci bir uygulama olarak bırakılmadı; `app.js` ince bağlayıcılar üzerinden yeni modülleri çağırır. Test host'ları da gerçek modülleri yükler, sahte UI kopyası kullanmaz.

### 2. C# özellik sahipliği

`GameSessionController` yardım/stoğu `GameSessionController.Assistance.cs`, kurtarmayı `GameSessionController.Rescue.cs` altında toplar. Başlangıç ve ana atomik `Execute` yolu ana dosyada kalır. Public API, metot gövdeleri ve komut sırası korunmuştur; istisna yukarıdaki açık null-record düzeltmesidir.

Bu partial sınıf bölmesidir, bağımsız servisler arasında tamamlanmış bir yeniden mimari değildir. Ortak durum bilinçli olarak tek oturum sahibinde kaldı; iki farklı commit yöneticisi yaratılmadı.

### 3. CSS sahipliği

106.139 byte'lık CSS beş sorumluluk dosyasına ayrıldı; `src/styles/manifest.json` sıralamayı sabitler. `scripts/sync-styles.cjs --check` kaynak ile teslim edilen tek CSS dosyasının birebir aynı olmasını zorunlu kılar. Bu bakımda teslim edilen `dist/style.css` **değişmedi**; özgüllük/cascade ve mobil boyutlar tahminle yeniden yazılmadı.

### 4. Yeni korumalar

- `check-maintenance.cjs`: 10 grup, kayıt sınırları, gerçek bootstrap, saf normalizasyon ve sunum/giriş regresyonları.
- `fixtures/presentation-maintenance.json`: eski `app.js` closure'larından önceden alınmış 52 geometri, 312 SVG ve 104 animasyon yolu özeti. Yeni modüllerden üretilmiş sahte beklenti değildir.
- `scripts/check-architecture.cjs`: hafif bağımlılık/syntax, sıralı betik ve offline varlık kontrolü. Tam statik analiz olduğu iddia edilmez.
- `check-session-parity.cjs`: revision/null/corrupt profiller ve yeni/legacy null başlangıçları için ek gerçek C# istekleri.
- Mevcut 15 CI işi korunur. Bakım kontrolü mevcut `npm test` zincirine eklenmiştir.
- PR #11'in sabit Lab testinin dokunmadığı host dosyaları için onaylı değişiklik listesi yalnız `session-store.js` ve `ProfileRepository.cs` ile genişletildi; gameplay/veri hash sınırları kaldırılmadı.
- Yeni betikler PWA v29 ile atomik bir shell kuşağına alındı. Yeni modüller offline allowlist'te, HTML'de ve test yükleyicisinde birlikte yer alır.

## Çalıştırılan doğrulama ve kanıtın yorumu

| Kontrol | Bu çalışma sırasında doğrulanan |
| --- | --- |
| Referans tam `npm test` | Değişmemiş 7deb686 kaynak kopyasında exit 0. |
| Eski davranışa karşı 5 hedefli probe | Beşi de beklenen reddi üretmedi; hata yeniden üretildi. |
| Refactor sonrası tam `npm test` | Yerel tam koşu exit 0; eski testler eşik gevşetmeden korundu. |
| `npm run test:maintenance` | 10 grup; 512 ek döngü karşılaştırması ve diğer assert'ler geçti. Bunlar bağımsız insan testi sayısı değildir. |
| Görsel sözleşme | 52 tahtada eski SVG/geometri ve 104 karşılıklı yol byte/hash eşitliği; piksel testi değildir. |
| Yerel gerçek Chromium | Sandbox'ın localhost navigasyonunu `ERR_BLOCKED_BY_ADMINISTRATOR` ile engellemesi nedeniyle tamamlanamadı. Başarılı sayılmadı; aynı referansta ayrıca kontrol edildi. |
| Gerçek C# ve Chromium/WebKit CI | PR'ın **aynı son commit** kontrolleri esas alınır; rapordaki yerel JS başarısı bunların yerine geçmez. SDK eksikliğinde sahte JS fallback yoktur. |
| Fiziksel cihazlar | Yapılmadı. |

CI sonucu ve Vercel Preview bağı PR açıklamasında tutulur. Başarısız veya çalışmamış bir kontrol “geçti” diye sunulmaz. Test sayıları (vektör/dalga/komut/grup) birbirine eklenerek şişirilmez.

## Kalan teknik borçlar — bu PR'da değiştirilmedi

1. **Büyük host:** `app.js` hâlâ yaklaşık 138 KB; can, ekonomi ve kurtarma ekranları ortak closure'a bağlı. Bunları ayırmak daha büyük işlem/yaşam döngüsü refactor'udur. Yeni modüllere benzer açık adapter sözleşmeleriyle, her adımda uygulama parity'si gerekir.
2. **C# okunurluk ve tipler:** Bazı domain kaynakları çok sıkıştırılmış, wire map'ler yaygın. Salt toplu format/dto dönüşümü geniş diff yaratacağı için bu incelemede yapılmadı. Değer tiplerine geçiş ayrı parity korumalı iş olmalı.
3. **İsteğe bağlı hata görünürlüğü:** Sunum/analitik/ayna hataları bazı yerlerde sessiz yakalanır. Bunların bir kısmı doğru fail-safe politikadır. Kişisel kayıt göndermeyen yerel tanı tamponu ileride yararlı olabilir; bütün catch'leri rastgele kaldırmak güvenli değildir.
4. **Ölçüm kapsamı:** Eski playtest dışa aktarımı yardımlı komutların bütününü açıklamaz; kanonik komut günlüğüyle birlikte yorumlanmalı. Tutma/gelir metriği diye sunulmamalı.
5. **Fiyat ve bölüm arşivi:** Fiyatları/temel bölüm tanımlarını değiştirmeden tarihsel sürüm arşivi gerekir. Bakım işi bunları veya zorluğu değiştirmez.
6. **Yerel güven sınırı:** Kullanıcının tüm cihaz verisini silmesi, yerel saati değiştirmesi, gerçek reklam/ödeme makbuzu ve cihazlar arası haklar hesap/sunucu otoritesi olmadan güvenli ürün tamamlanmış sayılmaz.
7. **Unity platformu:** JSON okuyucu, gerçek atomik kalıcı dosya adaptörü, Mono/IL2CPP ve cihaz performansı hâlâ ayrı işlerdir.
8. **GitHub kuralları:** CI işlerinin bulunmasıyla hepsinin ruleset'te zorunlu olması farklıdır. Repo yöneticisinin kuralları son gerçek job adlarıyla eşleştirmesi gerekir; yönetim ayarları değiştirilmedi.

## Geri dönüş ve gelecekteki bakım

Yalnız ayrı PR; onaysız `main`/Production değişikliği yok. Runtime refactor'a yeni snapshot/ekonomi şeması eklenmediğinden geri dönüş veri dönüştürmez. PWA kuşağı yeni/eskiyi karıştırmayacak şekilde güncellendi; rollback ayrıca cache ve kayıt devam testiyle yapılmalıdır.

Modül bulma ve yeni özellik yerleştirme rehberi `ARCHITECTURE.md`; dosya envanteri `reports/maintenance-source-inventory.json`. Ürün kararlarının kaynağı ilgili 9.5 sözleşmeleridir; bu belge geçmiş teslim raporlarını silmez.
