# İsteğe bağlı yerel oyuncu testi

## Oyuncu nasıl kullanır?

1. Ayarlar'da **Oyuncu testi kaydı** anahtarını aç. Varsayılan kapalıdır; açılmadan önceki hamleler geriye dönük oluşturulmaz.
2. Öğreticileri ve ilk 10 bölümü normal biçimde oyna. Test sırasında beklemek istemiyorsan ayrı **Can sınırını kapat** geliştirici ayarını kullan. Bu ayar oyun motorunun puanını, hamle sayısını veya taş üretimini değiştirmez.
3. Ayarlar'da **Test sonucunu JSON olarak indir** düğmesine bas. Tarayıcı `hexrota-playtest.json` dosyası üretir. Dosyayı paylaşmak ayrıca oyuncunun seçimine bağlıdır; otomatik yükleme yapılmaz.
4. **Yalnızca test kaydını temizle** düğmesi gözlem verisini siler. Bölüm, ilerleme, varyant, RNG, can, TEST Altını ve ayarlar sıfırlanmaz. Kayıt anahtarını kapatmak yeni gözlemleri durdurur; eski gözlemleri silmek ayrı işlemdir.

Bu özellik gerçek ödeme/reklam veya üçüncü taraf analitik servisi içermez. Kişinin adı, e-posta adresi, konumu, cihaz kimliği, tarayıcı kimliği ve bağlantının sorgu parametreleri veri sözleşmesinde yoktur. Bölüm/deneme kimlikleri yalnızca mevcut oyun akışını eşleştirir; küresel oyuncu kimliği oluşturulmaz. Yerel JSON dosyasını paylaşmadan önce incelemek mümkündür.

## Uygulanan veri

Saf `dist/playtest.js` saatleri dışarıdan alır. Tarayıcı bağlantısı `dist/app.js` içindedir. Gözlemler oyun snapshot'ından ayrı `hexrota-playtest-v1` anahtarında saklanır. Oyun ve can kayıtlarının anahtarları değişmez. Geçersiz gözlem kaydı veya gözlem yazım hatası oyunun sonucunu değiştirmemelidir.

| Veri | Anlamı |
| --- | --- |
| `level_started` | Gerçekten açılmış yeni deneme; bölüm/varyant/veri sürümü, deneme kimliği ve bölüm içi deneme sayısı. |
| `attempt_resumed` | Mevcut oyun devam ettirilmiş; yeni başlangıç diye sayılmaz. |
| `move` | Gerçek geçerli takas; iki hücrenin indeksi ve axial `q,r` koordinatları, önce/sonra puan ve yeşil alan, kalan hamle/kat, dalga sayısı ve eşleşen hücreler. Geçersiz takas harcanmış hamle olarak kaydedilmez. |
| `hint_used` | İpucu sayısı, öneri kaynağı ve garanti sınıfı. İpucu motorun RNG/puan/hamlesini değiştirmez. |
| `level_completed`, `level_failed` | Son durum, kullanılan/kalan hamle, puan, eksik puan, eksik yeşil hücre, kalan kat ve zincir sayısı. Başarısızlık sınıfı `score`, `ground` veya `score_and_ground`; kazanma `none`. |
| `level_retried` | Yeni denemeyle önceki denemenin kimliğini bağlar. |
| `level_abandoned` | Oynanmış ve bitmemiş deneme açıkça sıfırlanıp bırakılmıştır. Sadece menüye dönmek veya uygulamayı kapatmak bu olayla eşit değildir. |
| `life_blocked` | Sıfır can nedeniyle yeni ana deneme başlatma isteği engellenmiş; istenen bölüm ve görünen can bilgisi. Engellenen istek yeni deneme üretmez. |
| `attempts[].activeMs` | Deneme başına gözlemlenen aktif süre. |
| `attempts[].observedStart` | Kaydedici denemenin gerçek başlangıcını gördü mü? Geç açılan gözlem geçmiş başlangıcı uydurmaz. |
| `developerBypass` | Olay veya hamle sırasında geliştirici can sınırı kapalı mı? Normal canla yapılan testlerden ayrı değerlendirilebilir. |
| `overflow` | Kapasite aşılmış, gözlem penceresi eksik. Varsayılan sınır 2.000 olay ve 2.000 deneme; sessizce tam veri diye sunulmaz. |

Gözlem olayları UTC milisaniye taşır. Süre hesabı belgeye ait monotonic saatle yapılır; cihaz saatini değiştirerek aktif süre ileri/geri oynatılmaz. Yalnızca oyun ekranı görünürken, deneme oynanabilirken, diyalog/duraklama/animasyon yokken geçen zaman sayılır. Düşünme süresi bu tanıma dahildir; her geçen saniyenin aktif parmak hareketi olduğu iddia edilmez. Arka plandan veya odağı kaybettikten sonra mevcut duraklama ekranı kapanana kadar süre başlamaz. Uygulama kapalı geçen süre eklenmez.

## İnsan testi ve hesaplama

İlk testte oyuncuya hamle çözümü söylemeden iki öğreticiyi oynat; ardından sırayla ana bölümlere geçmesini iste. Anlaşılmayan hedefleri ve son kalan yeşil hücreleri oyun sonrasında konuş. JSON ölçümü, bu gözlemin yerine geçmez. Can sınırı kapalı testlerle normal canlı testleri aynı grupta kesin sonuç gibi birleştirme.

| Ölçüm | Hesaplama ve sınır |
| --- | --- |
| Bölüm/varyant tamamlama | `observedStart=true` farklı denemelerden tamamlananların oranı. Yarım kalanlar ve pencere sonunda hâlâ açık denemeler ayrıca gösterilir. |
| Deneme ve tekrar | Deneme kimlikleriyle tekilleştir; `level_retried.previousAttemptId` bağıyla tekrar zincirlerini incele. Geçmiş sürümlerde bilinmeyen deneme sayısı uydurulmaz. |
| İpucu ihtiyacı | Gözlenen tamam/başarısız denemelerde ipucu kullanım sayısı ve sınıfı. Kullanım, tek başına zorunlu ipucu gerektiğinin kanıtı değildir. |
| Başarısızlık yükü | `missingScore`, `missingGround` ve `remainingLayers` ayrı raporlanır. Bir çift katın hâlâ kalmasıyla tek hücre eksikliği aynı ölçü değildir. |
| Hamle dağılımı | `pair`, `cells` ve `matchedIndices` ile hangi hücrelere harcandığı; bitmeyen son katların nerede kaldığı incelenir. |
| Aktif süre | Deneme başına `activeMs`; öncesi gözlenmemiş kayıtlar ve eksik pencereler ayrı işaretlenir. |
| Can nedeniyle engel | `life_blocked` istekleri ve sonraki deneme/öğretici geçişleri; bunlar farklı kullanıcı sayısı değildir. |
| Ayrılma | Açıkça bırakılmış denemeler ile gözlem sonunda yarım kalanlar ayrı sayılır. Pencere sonunda kayıt olmaması oyuncunun oyunu kalıcı olarak bıraktığını kanıtlamaz. |

Bot başarı oranları insan başarı oranı olarak kullanılmaz. Bu yerel, isteğe bağlı örneklem; küresel oyuncu kaybı, kullanıcı tutma, satın alma dönüşümü veya cihazlar arası kişi tekilleştirmesi sağlamaz. Reklam/mağaza dönüşümü bu aşamada uygulanmadı. Birden çok JSON dosyasını otomatik olarak farklı kişiler varsayma; aynı tarayıcıdan tekrar dışa aktarılmış dosyalar olabilir. Önce küçük insan testleriyle hedeflerin anlaşılması ve 5→6 / 8→9 rahatlama geçişleri değerlendirilmelidir; yayımlanmış bölüm verisini değiştirmek ayrı onaylanabilir veri sürümü işidir.

## Otomatik doğrulama

```sh
node check-playtest.cjs
node check-playtest-ui.cjs
```

Saf test açık rıza, saat davranışı, JSON devamı, alan kısıtları ve kapasiteyi doğrular. JSDOM testi gerçek `index.html` betiklerini yükleyerek varsayılan kapalı durum, gerçek hamle/ipuçları, kazanma/kaybetme/tekrar, sıfır can, geliştirici ayarı, duraklama/arka plan/animasyon süresi, Blob JSON indirme ve kayıt temizlemenin oyun/can verisini korumasını kontrol eder. `fetch`, `sendBeacon` ve XHR çağrıları gözlenir; gözlem/export akışı ağ isteği üretmemelidir. Bu, fiziksel telefon, gerçek indirme diyalogu veya mobil Safari testi değildir.
