# Hexrota — oyun ekonomisi tasarımı

## Durum ve kapsam

Bu belge ve `data/economy-design.json` bir tasarım önerisidir. Prototipte Altın cüzdanı, mağaza, satın alma, reklam, güçlendirici kullanımı veya bu dosyayı yükleyen bir ekonomi modülü uygulanmadı. JSON içindeki fiyatlar ve ödüller ölçülmüş ürün sonuçları değil, gerçek oyuncu denemelerinde değiştirilecek ilk adaylardır.

Çalışan oyunda puan ve yeşil alan birlikte kazanma koşuludur; normal bir takas bütün zinciriyle bir hamle harcar. Mevcut `classic-v4` motoru ve `snapshot.version = 4` yalnızca takas geçmişini tekrar oynatır. Bu ekonomi tasarımı mevcut kayıt biçimine satın alma veya güçlendirici komutları eklemez.

Öncelik ücretsiz oynanışın anlaşılması, doğrulanmış açılışların dengesi ve tekrar denemenin iyi hissettirmesidir. Ücretli özellikler bu doğrulamanın yerine geçmez.

## Değişmeyecek ilkeler

- Tek oyun içi para birimi **Altın** olur. Puan, Altın değildir ve para harcamak puanı çarpmaz.
- Bütün ana bölümler ve temel varyantlar güçlendiricisiz tamamlanabilir olmalıdır. Yeni verinin kabulü ücretsiz kazanma yollarına dayanır.
- Yeniden deneme, devam etme, bölüm seçimi ve ipucu ücretsiz kalır. Can, enerji, zorunlu bekleme veya kaybetme cezası önerilmez.
- Varyant seçimi, ilk taşlar, taş üretimi ve ipucu kalitesi cüzdan, mağaza gezintisi, reklam veya satın alma geçmişini okuyamaz.
- Aynı güçlendirici komutu, Altın ücretsiz kazanılmış olsa da satın alınmış olsa da aynı sonucu üretir.
- Oyuncuyu bilerek kaybettirme, son hamlede gizli kural değiştirme, kazanma vaadi veya yanıltıcı indirim sayacı kullanılmaz.
- Mağaza kaybettikten sonra kendiliğinden açılmaz. Oyuncu ücretsiz yeniden denemeye tek hareketle ulaşır.
- Oyun alanındaki puan, yeşil alan ve hamle göstergeleri korunur. Altın ve mağaza girişleri ileride ana menü, sonuç ve mağaza ekranlarında gösterilir; T1/T2'ye ekonomi anlatımı eklenmez.

## Altın kaynakları: ilk aday değerler

| Kaynak | Altın | Sınır ve ücretsiz elde edilme kuralı |
| --- | ---: | --- |
| Ekonomi ilk açıldığında başlangıç hediyesi | 100 | Cüzdan başına bir kez; ilerlemeyi sıfırlamak tekrar vermez. |
| Öğreticiyi ilk bitirme | 25 | T1 ve T2 için ayrı ayrı bir kez; tekrar oynama ödülü üretmez. |
| Ana bölümü ilk bitirme | 50 | Sabit kampanya ve Level ID için bir kez; varyant veya deneme başına tekrar verilmez. |
| Tamamlanmış ana bölümü yeniden bitirme | 10 | En fazla 5 ödüllü bitiriş/gün; ödül sınırından sonra oynamak yine ücretsizdir. |
| İsteğe bağlı reklamı tamamlama | 25 | İleride en fazla 3/gün; bu sürümde reklam entegrasyonu ve ödülü yoktur. |

Başlangıç, iki öğretici ve ilk on ana bölüm için önerilen bir defalık toplam **650 Altın** olur. Bu bir oyuncu kazanma veya süre tahmini değildir: yalnızca tablodaki öneri tutarlarının toplamıdır. Örneğin 90 Altınlık ürün yaklaşık iki ilk bölüm ödülüne, 400 Altınlık tema sekiz ilk bölüm ödülüne karşılık gelir; başlangıç hediyesi ve tekrar oynama bu hesabın dışındadır.

Ödül kazanma kaydı idempotent olmalıdır. İlk bitirme talebi `kampanya + Level ID` ile tanımlanır; Variant ID, Attempt ID veya ekonomi fiyat sürümü değiştiğinde yeniden doğmaz. Kaybetmek Altın kazandırmaz. Kalan hamle veya kullanılan güçlendirici, önerilen sabit ilk bitirme tutarını büyütmez.

Günlük sınırlar ilerleme kilidi değildir. Çevrimdışı cihaz saati güvenilir bir finansal otorite değildir; gelecekte gün bazlı taleplerin doğrulanması ayrıca tasarlanmalıdır. Saat hatası nedeniyle mevcut bölüm, kazanılmış ilerleme veya doğrulanmış satın alma silinmez.

## Ürün adayları

Aşağıdaki bütün ürünler **planlanmıştır; prototipte uygulanmamıştır**. Kullanım sınırı kayıt yüklenince korunacak komut geçmişinden hesaplanır. Normal oynanıştan kazanılan Altın ile tüm adaylar alınabilir.

| Ürün | Aday maliyet | Kullanım sınırı | Fayda ve ücretsiz edinme | Uyum / öneri |
| --- | ---: | --- | --- | --- |
| +3 ek hamle | 90 Altın | Bir denemede +3 veya +5 seçeneklerinden yalnızca biri, bir kez | Kaldığı tahtada 3 takas daha; normal oynanış Altınıyla alınır. | En anlaşılır yardım adayı. Ücretsiz denge ve gerçek oyuncu testlerinden sonra değerlendir. |
| +5 ek hamle | 140 Altın | +3 ile ortak tek kullanım sınırı | Aynı tahtada 5 takas daha; normal oynanış Altınıyla alınır. | +3 ile birlikte uygulanacaksa seçenekler ve toplam ücret açık olmalı. Tekrar tekrar teklif etme. |
| Tek taş temizleme | 60 Altın | Deneme başına bir kez | Seçilen taşı kaldırır ve altındaki bir katı azaltır; ücretsiz Altınla alınır. | Son eksik alan için anlamlıdır; yeni komut ve ödül sözleşmesi doğrulanmadan eklenmemeli. |
| Seçilen taşın sayısını yenileme | 50 Altın | Deneme başına bir kez | Seçilen taş başka bir palet değerine dönüşür; ücretsiz Altınla alınır. | İlk mağazaya önerilmez: planı bozabilir, iyi hamle garantisi yoktur. Ön izleme ve RNG davranışı ayrıca doğrulanmalı. |
| Başlangıç fırçası | 80 Altın | İlk takastan önce bir kez; yalnızca iki katlı yeri olan ana bölüm | İki noktalı bir yeri bir noktaya indirir; ücretsiz Altınla alınır. | Başlangıç güçlendiricisi adayıdır. Sayıları veya tohumu değiştirmez; ilk mağazaya önerilmez, öğreticilerde kullanılamaz. |
| Tahta teması | 400 Altın | Tema başına bir kez, kalıcı | Görünümü kişiselleştirir; normal Altın biriktirilir. | İlk mağaza için en düşük denge riski. Rakamların okunurluğu ve dokunma alanları değişmez. |
| Görsel/ses stili | 200 Altın | Stil başına bir kez, kalıcı | Aynı başarıya farklı görünüm veya ses; normal Altın biriktirilir. | İlk mağaza adayı. Başarı seviyesini, puanı, süreyi veya titreşim sınırlarını satın alınabilir hale getirmez. |
| İsteğe bağlı reklam ödülü | Altın harcanmaz | En fazla 3/gün | Tamamlanan reklam başına önerilen 25 Altın | Daha sonra değerlendirilir. Oynamanın, yeniden denemenin veya ilerlemenin şartı değildir. |

Temalar ve stiller başlangıç mağazasının ilk adaylarıdır. Sayı yenileme ve başlangıç yardımı mevcut basit oyuna yeni açıklama yükü getirir; sırf ürün çeşitliliği için eklenmemelidir. +3/+5 ve temizleme ayrı, küçük gerçek oyuncu testleriyle denenmelidir. Gerçek para karşılığı Altın paketlerinin miktarları, yerel fiyatları ve satış düzeni bu aşamada kararlaştırılmadı; gerçek ödeme ürünü veya SDK eklenmedi.

## Güçlendiricili durum nasıl hesaplanmalı?

Bu bölüm önerilen gelecek sözleşmedir. Mevcut v4 kaydı `movesLeft = level.moves - turn` eşitliğini doğrular; sonradan hamle eklemeyi veya hücre temizlemeyi bu kayda gizlice yazmak doğrulamayı bozar. Yeni yardım kuralları ayrı oyun-kuralı ve kayıt sürümüyle gelmelidir. Eski v4 kayıtları aynı motorla açılmaya devam eder.

Önerilen komut günlüğü sıralı `Swap`, `GrantMoves`, `ClearCell`, `RerollCell` ve `ReduceGroundLayer` komutlarını taşır. Her komut kimlik, sıra, parametreler ve ilgili cüzdan işlem kimliğini içerir. Level ID, Variant ID, temel veri sürümü ve temel RNG tohumu aynı denemeye bağlı kalır.

- `movesUsed` geçerli normal takas sayısıdır. Güçlendirici normal bir hamle harcamaz. Gelecekte `movesRemaining = baseMoveBudget + grantedMoves - movesUsed` olur.
- Komut sırası, normal hamle sayısı ve ödül çözüm sırası birbirine karıştırılmaz. Sayı yenileme/temizleme sonrası doğrulanmış ücretsiz çözüm yolunun hâlâ geçerli olduğu iddia edilmez.
- Temel bölüm geometrisi, paleti, puan hedefi ve katman tanımı değişmez. Yardımın etkisi yalnızca o denemenin durumuna ve açık komut geçmişine yazılır.
- Her çözümleme sonunda kazanmak için yine `score >= target` ve bütün yerlerde `layers = 0` gerekir. Son hamlede iki koşul sağlandıysa kazanma, sıfır hamlede kaybetmeden önce değerlendirilir.
- Deneme `assisted`, kullanılan ürünler ve eklenen hamleler ile işaretlenir. Ücretsiz ve yardımlı sonuçlar denge analizinde ayrı raporlanır; mevcut ücretsiz kişisel kayıtlar yardımlı skorlarla sessizce değiştirilmez.

### +3 / +5

Öneri: yalnızca bütün taşlar durduğunda, hamle sıfır olduğu için kaybedilmiş ve henüz kazanılmamış ana bölümde sunulsun. Tek doğrulanmış `GrantMoves` komutu 3 veya 5 hamle ekler. Taşlar, puan, katmanlar, geçmiş takaslar ve RNG değişmez; yeni varyant seçilmez. Oyun tekrar oynanabilir duruma gelir. Bu bir kazanma garantisi değildir; faydasız olduğu bilinen teklif sunulmaz. Reddedilirse ücretsiz yeni denemeye geçilir.

### Tek taş temizleme

Öneri: yalnızca oynanan ve hareketsiz ana tahtada kullanılabilsin. Oyuncu hücreyi seçip işlemi ve ücretini onaylar. Seçilen taş kaldırılır; o hücrenin kalan katmanı varsa bir azalır. İki katlı yer tek kullanımla tamamen yeşile dönüşmez. **Taşın üzerindeki sayı doğrudan puan olarak eklenmez.**

Ardından normal sütun düşüşü, kontrollü üretim ve gerçek eşleşme zincirleri deterministik sırada çözülür. Yalnızca gerçekten eşleşen taşlar normal puanı verir. Hamle sayısı değişmez; RNG yalnızca gerçekleşen üretim/karıştırma işlemleri kadar ilerler. Puan zaten yeterliyse son alanı temizlemek bölümü bitirebilir. Bütün sonuç, ücret kesinleşmeden önce aynı komut girdileriyle hesaplanıp doğrulanır.

### Sayı yenileme ve başlangıç yardımı

Sayı yenileme önerisinde hedef hücre açıkça seçilir. Paletten mevcut değerden farklı bir değer deterministik olarak seçilir; en az iki farklı değer yoksa işlem reddedilir ve ücret alınmaz. Yeni eşleşmeler varsa normal çözümleme uygulanır; doğrudan puan yoktur. RNG seçiminin sırası, ön izleme ve iptal davranışı henüz ürün kararıdır. Bu belirsizlik çözülmeden satışa konmamalıdır.

Başlangıç fırçası önerisinde başlangıçta iki kalan katmanı olan tek yer 2'den 1'e iner. Taş, puan ve RNG değişmez. İki katlı yer olmayan bölümde ve öğreticilerde sunulmaz. Bu da gelecekteki komut günlüğünde yer almalı; temel bölüm verisini değiştirmemelidir.

### Ödül yöneticisiyle sınır

Mevcut Reward Director v1 en az üç taş eşleşen dalgalar ve sıralı takaslar bekler. Tek taş temizlemeyi sahte bir üçlü gibi göndermek veya puan uydurmak doğru değildir. Takas dışı eylem için sürümlü bir adaptör/girdi sözleşmesi ve gerektiğinde ayrı yardım geri bildirimi kararlaştırılmalıdır. Gerçek zincirlerin değerlendirilmesi mevcut başarı ilkelerini korur; tema, ses veya satın alma kaynağı ödül yoğunluğunu oyun kuralı olarak değiştirmez. Bu sözleşme kararı ve testleri henüz uygulanmadı.

## Cüzdan, işlem güvenliği ve kayıt

Altın tamsayıdır; negatif bakiye ve taşma reddedilir. Önerilen ayrı cüzdan günlüğünde `transactionId`, sıra, kaynak, ürün, tutar, önceki/sonraki bakiye ve ilgili deneme bulunur. Kazanç, harcama, iade ve kalıcı hak işlemleri idempotent kimlik taşır. Bu yapı şu anda yoktur.

Gelecekte kullanım sırası: uygunluk ve bakiye kontrolü → saf oyun sonucu hesaplama → cüzdan/komut/deneme kaydını tek mantıksal işlemde yazma → animasyon ve yerel olay. İptal, geçersiz hedef, yetersiz bakiye veya kayıt hatası Altın düşürmez ve tahtayı değiştirmez. Yeniden yükleme geçmiş komutları tekrar oynatır; tekrar ücret veya ilk bitirme ödülü üretmez. Normal oyun, analitik kayıt başarısız olduğu için durdurulmaz; gerçek para işlemi ise doğrulanmış mali kayıt olmadan tamamlanmış sayılmaz.

Yerel oyun geçmişinin yeniden oynatılması, satın alma makbuzunun veya cüzdanın güvenilir olduğunu ispatlamaz. Gerçek ödemede makbuz doğrulama, tekrar işlemden korunma, iade ve kalıcı hak geri yükleme ayrı bir güvenilir otorite gerektirir. Prototipte böyle bir servis yoktur; yalnızca cihazda saklanan bakiyeye güvenli ödeme sistemi denmez.

İlerlemeyi sıfırlama ileride oyun ilerlemesini temizlerken cüzdan, kalıcı haklar ve ilk-ödül talep günlüğünü korumalıdır. Misafir kayıtları, cihaz değişimi, eski oyunculara ilk Altın aktarımı ve hesap silme politikası ödeme entegrasyonundan önce ayrıca kararlaştırılır. Bozuk veya bilinmeyen yardımlı kayıt ücretsiz eski kayıt gibi yorumlanmaz; mali kayıt ayrı tutulur ve mevcut ücretsiz ilerleme silinmez.

## Ölçüm: uygulanan ve planlanan

Ayrıntılı mevcut sözleşme [ANALYTICS.md](ANALYTICS.md) içindedir; aşağıdaki ekonomi metrikleri onun üzerine kurulacak tasarımdır.

**Uygulanan:** `dist/events.js` saf, yerel bir olay şemasıdır. Uygulama olaylarını `hexrota-events-v1` altında en fazla 500 kayıt tutar; dış servise veya kişisel veriye gönderim yoktur. İzin verilen adlar `level_started`, `level_completed`, `level_failed`, `level_retried`, `hint_used`, `booster_used`, `level_abandoned` olur. `booster_used` yalnızca ileriye dönük şemadır; mevcut oyunda güçlendirici kullanımı üretilmez.

Olayların düz alanları sürüm, olay kimliği/sırası/zamanı, Level ID, Variant ID, veri sürümü, Attempt ID/sayısı, kullanılan/kalan hamle, puan/hedef, yeşil yer sayısı/toplamı, kalan katmanlar, ilk eşleşmeden sonraki ek dalga sayısı, ipucu sayısı ve sonuç durumunu içerir. İsteğe bağlı düz ayrıntılar `reason`, `previousAttemptId`, `nextAttemptId`, `hintKind`, `hintGuarantee`, `boosterId` olur. Bu alanlar iç içe `details` nesnesi değildir; bilinmeyen alan/adlar doğrulamada reddedilir.

| Ölçüm | Hesap ve sınır |
| --- | --- |
| Deneme tamamlama | Başlangıcı ve takip penceresi gözlemlenen tekil tamamlanan Attempt ID / tekil başlayan Attempt ID; Level ID, Variant ID ve veri sürümüne göre ayır. Hâlâ açık denemeleri ayrıca göster. |
| Sonucu belli denemede kazanma | Kazanılan / (kazanılan + kaybedilen + açıkça terk edilen). Bu oran bütün başlayanları kapsayan oranla aynı değildir. |
| Tekrar deneme | `level_retried` ile önceki ve sonraki Attempt ID'leri bağla; bitişe kadar kaç tekrar gerektiğini say. |
| İpucu ihtiyacı | İpucu kullanılan denemeler / başlayan denemeler; ipucu başına ilerleme ve tamamlama ile birlikte incele. Nedensellik iddia etme. |
| Yardım etkisi — gelecekte | Yardımlı/yardımsız sonuçları ayrı göster; kullanılan ürün ve temel varyantı koru. Bot başarısı insan kazanma oranı değildir. |
| İlerleme kaybı | Bir bölümü bitirip gözlem penceresinde sonraki bölümü başlatmayan yerel profiller. Gerçek kullanıcı kaybı olduğu sonucuna varma. |
| Mağaza dönüşümü — gelecekte | En az bir doğrulanmış alım yapan uygun profil / mağazayı açan uygun profil; Gold kazanma/harcama dengesi ve iade ile birlikte ölç. |
| Reklam seçimi — gelecekte | İsteğe bağlı teklifi seçen / teklifi gören; doğrulanmış tamamlanma / başlayan reklam; oyun devamına etkisini ayrıca ölç. |

Mağaza açma, teklif gösterimi, ödeme tamamlama ve reklam olayları mevcut yedi olaylık şemada uygulanmadı. Bunlar için sürümlü şema ve mali günlük gerekir. Mevcut `booster_used` alanlarına keyfî ücret veya makbuz verisi eklenmez. Analitik olay, ücret alındığının kanıtı değildir.

Menü, duraklatma, arka plan ve sayfa yenileme oyunu terk etmek sayılmaz; kayıt devam eder. Gerçek terk etme yalnızca bitmemiş denemeyi açıkça silmek/yeniden başlatmaktır. 500 kayıtlık tamponun eski veriyi düşürmesi kohortları eksiltebilir; rapor gözlem kapsamını ve açık/eksik denemeleri göstermelidir. Yerel veriden cihazlar arası kullanıcı sayısı, kalıcı kullanıcı kaybı veya küresel mağaza dönüşümü çıkarılamaz.

## Parametre yönetimi ve açılış sırası

`data/economy-design.json` bütün öneri miktarlarını, sınırları ve ürün tavsiyelerini tek yerde tutar. `loadedByPrototype: false` ve `status: design_only` bilinçlidir; tarayıcıya ekonomi yükleyicisi veya gizli özellik anahtarı eklenmedi. Gelecekte saf Economy Rules, sürümlü veriyi alır ve uygunluk/fiyat/işlem sonucu döndürür; ödeme, reklam ve depolama adaptörleri bu saf modülün dışında kalır.

Önerilen sıra: ücretsiz bölümleri gerçek oyuncularla doğrula → cüzdan/iddia günlüğü ve kurtarma kurallarını test et → kozmetik ön izleme → sınırlı yardım deneyleri → gerekçelendirilirse isteğe bağlı reklam ve gerçek ödeme. Deneyler taş üretimi veya varyant seçiminde ödeme profiline göre değişiklik yapamaz.

Bir özelliğin açılma koşulu; kod, kayıt tekrar oynatma, iptal/yeniden yükleme, iki hedef, RNG, çift alan, ücretin yalnızca bir kez alınması ve ücretsiz tamamlama testlerinin geçmesidir. Ödül animasyonunu atlamak mali veya oyun sonucunu değiştiremez.

## Birlikte kararlaştırılacaklar

1. İlk mağazada yalnızca kozmetik mi, +3/+5 yardımı da olacak mı?
2. Önerilen Gold kaynakları ve fiyatlar gerçek oyuncuların kazanma/harcama hızında nasıl değişmeli?
3. Tek temizleme gerçekten bir katı mı azaltmalı; doğrudan puan vermemesi ve normal hamle harcamaması onaylanıyor mu?
4. Sayı yenileme ve başlangıç yardımı gerekli mi, yoksa ürün listesinden çıkarılmalı mı?
5. Takas dışı komutlar ve ödül girdisi için yeni sürüm sözleşmesi nasıl dondurulmalı?
6. Eski oyuncuların Altın aktarımı, çevrimdışı mali güven, satın alma/hak geri yükleme ve ilerlemeyi sıfırlama politikası ne olacak?
7. İsteğe bağlı reklam gerçekten deneyimi iyileştiriyor mu; hangi gözlemlerden sonra eklenmeli?

Bu kararlar sonuçlanmadan hiçbir fiyat kalibre edilmiş, hiçbir güçlendirici uygulanmış ve hiçbir mali kayıt güvenli ödeme entegrasyonu olarak sunulmaz.
