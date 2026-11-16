# Tavik konuşma portresi — 9.7

- Eğitimde tahtanın yanında küçük duran tam vücut karakter yerine, var olan öğretici koç kartında Tavik’in kafası konuşur.
- Kaynak, onaylı Tavik’in halihazırda projede yer alan point / call / celebrate pozlarıdır. Harici oyun karakteri kullanılmaz.
- Her yeni adımda kısa pop-in ve değişen açık gaga yüzü; başarılı hamlede mutlu gözleri kapalı poz. Yeni konuşma metni veya zorunlu bekleme eklenmez.
- Mevcut 118px öğretici kartı konuşma balonunun kendisidir; ikinci bir alt kart veya yeniden ölçeklenmiş tahta eklenmez.
- Eğitim harici tam-vücut Tavik ve ana menü aynen kalır. Görsel sistem PWA ve CSS tek kaynak hattına uyar.
- Düşük hareket tercihinde sabit poz; sekme gizlenince geçici animasyon ve zamanlayıcılar durur.
- Kayıt, RNG, can, ekonomi, başlangıç Altını, C# ve gerçek takas kuralları değişmez.
- Fiziksel iPhone testi tarayıcı otomasyonunun dışında ayrıca gerekir.

## Portre ve sahne aktörünün görünürlük sözleşmesi

`scene-presentation.update(input)` iç görünümüne `tutorialPortrait: input.tutorialPortrait === true` alanını taşır. Yalnız gerçek `true` değeri oyun ekranındaki tam-vücut aktörü gizler. Gecikmiş poz yüklenmesi, onaylı görsel yedeği ve yeniden yerleşim bu kararı değiştiremez. Ana menü aktörü korunur; portre bayrağı kaldırılınca normal sahne aktörü tekrar kullanılabilir.

T1/T2'de portre mevcut koç kartının içindedir. Portre yüzü taşları, HUD'u, düğmeleri, sayacı veya yönergeyi örtmez. Görsel yüklenemezse onaylı yedek görsel yine bu portrede gösterilir; gizli tam-vücut yedeğinin görünmesi beklenmez. Tahta ve mevcut koç kartının boyutları korunur.

## Yönergeyi örten portre/ok düzeltmesi

Önceki yerleşim portreyi mutlak konumlandırıp metne yalnız portre genişliği kadar sol dolgu ayırıyordu. Dışarı taşan `::after` oku, gölge ve girişteki büyüme bu hesaba dahil değildi. Bu yüzden nominal portre kutusu yönerge kutusuna değmese de okun boyanan kısmı ilk rakamı örtebiliyordu.

Düzeltmenin yerleşim sözleşmesi üç gerçek sütundur: **sabit portre yuvası → esnek metin → eylem**. Metne taşan eski portre oku kaldırıldı. Portre yuvası yalnız halkanın ölçüsünü değil, gölge ve giriş hareketinin en geniş boyama alanını da ayırır. Yönerge bu alanın sağından başlar; üstte veya altta ikinci bir konuşma kutusu eklenmez. Mevcut öğretici kartı tek konuşma balonu olarak kalır.

Mevcut Tahta/Çivi sayaç düğümü, `#coach-step` sonrasında `.coach-heading` içine taşınır. Sayaç metni, erişilebilirlik durumu ve kesinleşmiş kayıttan hesaplanması değişmez; mutlak konumdaki ayrı sayaç başka bir metnin üzerine bindirilmez. Yönerge, sonuç açıklaması, Geç ve Devam et aynı kartın içinde yer alır. Kartın **118 px** yüksekliği ve gerçek SVG tahta/HUD geometrisi bütün desteklenen ekranlarda korunur; karta alan açmak için tahta küçültülmez.

**PWA v39** yalnız güncel sunum betikleri ve CSS için önbellek kuşağıdır. Profil/snapshot/Attempt sürümleri, can, ödüller, RNG ve motor kuralları değişmez.

## Doğrulama ve sınırları

Önceki görünürlük düzeltmesinde `npm test`, 24 sahne birim grubu ve konuşma portresi testi geçti; gerçek Chromium ve WebKit ayrı ayrı **32/32** geçti. Bu sonuçlar tam-vücut aktörünün gizlenmesini ve portre yüzünün gerçekten çizilmesini doğruluyordu. Sadece `avatar.getBoundingClientRect()` ile metin elemanının kutusunu karşılaştırmak, avatar dışındaki pseudo-element boyamasını kapsamadı. Yüz piksel testi de yalnız portre alanındaki çizimi kanıtladı; yönergenin ilk glifinin açıkta kaldığını kanıtlamadı. Bu geçmiş sonuçlar yeni örtüşme düzeltmesinin başarısı olarak kullanılmaz. Yeni gerçek tarayıcı denetimine önceki CSS HTTP yanıtı olarak verildiğinde test, `::after` okunun metin gliflerine, ilk sonuç denklemindeki ilk `2` dahil, taşmasını yakalayarak başarısız oldu; aynı denetim yeni sütunlu CSS ile geçti. Bu karşılaştırma kaynak dosyalarını veya kayıtları değiştirmeden yapıldı.

Yeni kabul denetimleri, `Range.getClientRects()` ile gerçek yönerge/sonuç metninin glif kutularını ve portre/ok/gölge boyama sınırını birlikte inceler. Her iki öğreticinin altı ekran boyutunda tüm yönerge, hareket sürerken gösterilen sonuç ve onay durumları; sayaç ve eylemlerle birlikte kontrol edilir. Girişin başlangıcı/ara büyümesi/sonu, konuşma ve dinlenme hareketleri ile azaltılmış hareket ayrı durumlar olarak denenir. Böylece yalnız animasyon bittikten sonraki temiz bir kare yeterli sayılmaz. Sabit tahta ölçümü ekran girişinin sonlu hareketi tamamlandıktan sonra alınır; duraklatıp dönüşte boyanmış portre denetimi de sabit gecikme yerine sonlu giriş animasyonunu bekler. Bunlar hareketli glif/portre zarfı denetimini atlamaz ve çakışma eşiklerini gevşetmez. Gerçek ekran görüntüleri, sabit 118 px kart ve değişmeyen tahta/HUD ölçümleri de kapsamın parçasıdır.

| Yeni örtüşme düzeltmesinin kontrolü | Durum |
| --- | --- |
| Chromium / WebKit metin-glif ve boyama alanı kontrolleri | İki tarayıcı da **38/38** geçti; her birinde 154 glif kontrolü / 10.990 karakter ölçümü, sıfır örtüşme, sıfır kırpılma ve sıfır tarayıcı hatası. |
| T1/T2 tüm yönerge, sonuç ve animasyon durumları | Her tarayıcıda altı boyutta 114 gerçek yönerge/meşgul-sonuç/onay durumu; hareket zarfı ve tek hoş geldin ödülü kontrol edildi. Duraklatıp dönüş ayrıca iki tarayıcıda üçer kez geçti. |
| Küçük/büyük mobil, yatay ve masaüstünde 118 px kart / sabit tahta-HUD | 320×568, 390×844, 430×932, 844×390, 932×430 ve 1280×720 geçti. 118 px kart ve sahnesiz referansla aynı tahta/HUD ölçüleri korundu. |
| Mevcut JS testleri ve gerçek C# karşılaştırmaları | `npm test` geçti; 24 sahne birim grubu ve portre yaşam döngüsü dahil. Gerçek .NET 8 / C# 7.3 gameplay ve 104 reward vektörü karşılaştırması geçti. |
| GitHub Actions / Vercel Preview | Son commit'in gerçek kontrolleri ve önizleme bağlantısı [PR #24](https://github.com/kiviman1/hexrota/pull/24) üzerinde izlenir. 15 mevcut CI işi korunur; sahne görüntüleri ve glif ölçümleri tarayıcı artifact'larına yazılır. |
| Fiziksel iPhone / Android ve Unity / IL2CPP | Yapılmadı; tarayıcı otomasyonu yerine geçmez |

Son koşumların ekran görüntüleri ve sonuç JSON'ları PR #24 / CI artifact'larında raporlanır.
