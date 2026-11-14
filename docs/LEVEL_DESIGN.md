# Bölüm tasarımı ve doğrulama

## Mevcut durum

Bu sürümde 2 sabit öğretici ve 10 ana bölüm vardır. Her ana bölümün 4 farklı başlangıcı bulunur: toplam 40 varyant, 80 kazanma yolu. Her varyantın iki yolu farklı **ilk takaslarla** başlar; aynı takasın ters yazımı farklı başlangıç sayılmaz. `dist/levels.js` ve `dist/tutorials.js` orijinal verileri korunmuştur. Yeni varyantlar eski kayıtları değiştirmez.

Üretim çalışma zamanında yapılmaz. `generate-variants.cjs`, `lib/level-analysis.cjs` ve `dist/difficulty-rules.json` geliştirme sırasında adayları üretir, ölçer ve reddeder. Kanonik çıktı `dist/variants.json`; tarayıcı kopyası `dist/variants-data.js` içindeki `HEX_VARIANTS` verisidir. `HexAttempts` yalnızca bu doğrulanmış başlangıçlardan seçim yapar.

## Değişmeyecek temel kurallar

- İki komşu taş yer değiştirir. Aynı sayıdan en az üç taş, altıgen tahtanın üç düz yönünden birinde sıralanırsa eşleşir. Geçersiz takas puan, hamle veya RNG tüketmez.
- Eşleşen hücreler bir dalgada tek kez sayılır; kesişimdeki taşın puanı iki kere eklenmez. Puan, gerçekten eşleşen taşların sayılarının toplamıdır.
- Yeşil alan hücreye aittir, düşen taşla taşınmaz. Tek kat bir eşleşmede, çift kat iki ayrı dalgada tamamlanır. Aynı hücreden geçen iki çizgi tek dalgada iki kat temizlemez.
- Düşüş q sütunlarında gerçekleşir. Bütün sütunlar sıkıştırıldıktan sonra eksikler doldurulur. Mevcut taşların düşüşünden doğan doğal eşleşmeler korunur; yeni taş üretimi o andaki yeni eşleşme sayısını en aza indiren değerlerden RNG ile seçer.
- Takas ve bütün devam eşleşmeleri tek hamledir. Kazanmak için hem puan yeterli olmalı hem bütün alan yeşil olmalıdır. Son hamlede kazanma kontrolü, hamlesi kalmadığı için kaybetme kontrolünden önce gelir.
- Hamlesiz tahta karıştırması ve 32 dalgalık güvenlik sınırı mevcut motor sözleşmesinin parçasıdır; puan/alan/hamle ilerlemesi silinmez. Kesin sıralama ve C# aktarım ayrıntıları Unity planındadır.

Üretim; satın alma, ödeme geçmişi, mağaza, önceki kayıp veya oyuncu performansı okuyan bir sistem değildir. Takas sırasında gizlice zorluk değiştirilmez. Varyant seçici RNG ile taş üretim RNG'si ayrıdır.

## İlk 10 bölümün ritmi

**9.2 denetim notu:** Aşağıdaki tablo mevcut tam bilgili kabul kapısının tarihsel ölçümüdür; görünür bilgiyle oyuncu erişilebilirliğini doğrulamaz. [Yeni zorluk denetimi](DIFFICULTY_AUDIT.md) gizli RNG okumayan dört ayrı modeli, 17.920 oyunu ve uygulanmamış dengeleme önerilerini içerir. Bu yeni ölçümde özellikle 6 ve 9 için rahatlama rolü, 5 için varyant benzerliği, 8 ve 10 için erişilebilirlik yeniden değerlendirilmelidir. Yayımlanmış bölüm verileri bu denetimde değiştirilmedi.

Aşağıdaki yüzdeler **bot başarılarıdır**. Her varyant/model için 64 tekrar, bölüm/model için toplam 256 deneme vardır. Dört modelle 10.240 yeni varyant oyunu; ayrıca aynı yöntemle 2.560 orijinal tahta oyunu ölçülmüştür. Başarılar insan kazanma olasılığı değildir.

| Bölüm | Tasarım rolü | Hücre | Hamle | Puan | Varyant | Rastgele % | Açgözlü % | Alan % | Planlama % | Zorluk endeksi |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Çok kolay | 19 | 10 | 85 | 4 | 5.9 | 96.1 | 96.9 | 100.0 | 2.6 |
| 2 | Kolay | 19 | 10 | 110 | 4 | 4.3 | 81.2 | 75.0 | 100.0 | 16.9 |
| 3 | Orta | 19 | 9 | 135 | 4 | 0.4 | 60.5 | 44.1 | 100.0 | 37.0 |
| 4 | Orta-zor | 23 | 9 | 110 | 4 | 0.0 | 69.1 | 3.9 | 100.0 | 52.5 |
| 5 | Meydan okuma | 23 | 8 | 125 | 4 | 0.0 | 4.7 | 0.0 | 100.0 | 73.6 |
| 6 | Rahatlama | 23 | 8 | 160 | 4 | 0.0 | 73.4 | 86.3 | 100.0 | 14.1 |
| 7 | Orta | 29 | 8 | 215 | 4 | 0.0 | 7.4 | 58.6 | 100.0 | 46.4 |
| 8 | Zor | 29 | 8 | 170 | 4 | 0.0 | 0.0 | 2.7 | 100.0 | 73.8 |
| 9 | Rahatlama | 37 | 12 | 265 | 4 | 0.0 | 19.1 | 100.0 | 100.0 | 24.3 |
| 10 | Final | 37 | 14 | 280 | 4 | 0.0 | 0.0 | 0.4 | 96.5 | 75.7 |

Endeks: `100 − (0,30 × açgözlü başarı + 0,45 × alan başarısı + 0,25 × planlama başarısı)`. Ağırlıklar ve bantlar tasarım varsayımıdır; gerçek oyuncularla kalibre edilmemiştir. Rastgele model, strateji kullanmadan ilerleme kontrolü olarak ayrıca raporlanır; endekse girmez.

`dist/difficulty-rules.json` içindeki biçim kontrolü, ilk tırmanışlarda en az 3 kolaylık puanlık azalma, 5→6 ve 8→9 geçişlerinde en az 20 puanlık rahatlama, finalde önceki iki zirveden en az 1 puan daha yüksek zorluk arar. `balance-report.json.curveChecks` gerçekleşen farkları içerir. Bunlar model tabanlı sıralama kapılarıdır; oyuncuya gösterilen kesin kazanma oranları değildir.

### Eski rapordaki %0 / %100 farkı

`reports/baseline-balance.json` eski raporun aynısıdır. `recheck-legacy-balance.cjs` eski politika ve tohumlarla 100 rastgele/30 alan ağırlıklı açgözlü oyunu tekrar çalıştırır; oranlar birebir yeniden elde edilmiştir. Yeni açgözlü politikanın tanımı farklı olduğundan eski ve yeni politika oranları doğrudan aynı ölçüm gibi karşılaştırılmaz. Adil karşılaştırma, `balance-report.json.baseline` ile yeni varyantlara aynı dört politikanın uygulanmasıdır.

- **Orijinal 6:** yeni tek adımlık açgözlü/alan politikaları %0; planlama %100. Sekiz hamlede hem puan hem kalan çift alanlara erişim zorlaşıyordu. Yeni başlangıçlarda açgözlü yaklaşık %73,4, alan %86,3; rahatlama rolü bu modellerde sağlanıyor.
- **Orijinal 9:** açgözlü ve alan politikaları puan hedefini geçse de ortalama alanın yaklaşık %90–92'sinde kalıyordu. Sorun puandan çok son hücrelere erişimdi. Üç hamlelik planlama bile yalnızca %53,1 başarı gösteriyordu. Yeni 9, alan politikasında %100, açgözlüde yaklaşık %19,1; rahatlama özellikle alanı izleyen oyun tarzına bağlıdır.
- **Orijinal 8:** üç amaç odaklı model %100; yalnızca iki ayrı rota tekrar ediliyordu. Büyük tahta ve çift alan sayısı tek başına zorluk garantisi değildi. Yeni 8'de açgözlü %0, alan yaklaşık %2,7, planlama %100; belirgin bir planlama zirvesi oluştu.

Yeni 4'te açgözlü yaklaşık %69,1 iken alan politikası %3,9'dur. Daha fazla alanı hemen temizlemek, son alanlara daha sonra erişebilmekle aynı değildir. Bu fark bir oyuncu tarzını yanlışlıkla aşırı cezalandırma riski olarak gerçek denemelerde izlenmelidir.

## Dört davranış modeli ve sınırları

- **Random:** yalnızca yasal takaslar arasında tohumlu seçim yapar. Geçersiz dokunma sayısını veya insanın düşünme biçimini modellemez.
- **Greedy:** tek hamle sonundaki hedefe yönelik puan, azalan kat ve yeni yeşil alan kazancını normalize ederek değerlendirir.
- **Coverage:** önce kalan katları ve yeni tamamlanan alanları, sonra puanı değerlendirir.
- **Planning:** en çok üç hamle ileri, 6 genişlikte ve 192 düğüm bütçeli arama yapar. Kayıtlı kazanma yollarını okumaz.

Amaç odaklı botlar motorun kopyasında gerçek RNG durumuyla sonuçları hesaplar. Özellikle planlayıcı, insanın göremediği gelecek taşları da bilir. Bu **tam durum bilgili** simülasyondur; görünür tahtayla insan planlamasının karşılığı değildir. 5 ve 8'de tek adımlık politikalar çok düşükken planlamanın %100 olması bu nedenle insanlarda adil ve anlaşılır zorluk kanıtı sayılmaz. Ticari dengelemeden önce bu bölümlerde görünür bilgiyle karar verme ayrıca gözlenmelidir.

Rastgelelik modelin seçim/tohum akışındadır; aynı varyantın oyun RNG'si sabittir. Beraberlik yoksa model aynı rotayı tekrarlar. `uniqueTrajectories`, önbellek kullanımı ve arama derinliği raporlanır; 64 tekrar otomatik olarak 64 bağımsız strateji değildir. Tek tahta için %0/%100, tek bir belirlenimci tercihin sonucu olabilir.

Rapor; kazanma, kullanılan/kalan hamle, puan, alan oranı, kalan katlar, zincir dalgaları, karıştırma, zorunlu üretim, rota çeşitliliği ve stratejiler arası farkları içerir. `planningAdvantage` ve arama yükü ileri planlama ihtiyacına ilişkin göstergedir; insanın kaç ipucuna ihtiyacı olduğunu ölçmez. `failures.scoreOnly` alan tamamken puanın eksik kaldığını, `groundOnly` puan tamamken alanın eksik kaldığını belirtir.

## Varyant kabul kapıları

Her ana bölümün koordinatları, kat yerleri, puanı, hamle bütçesi, paleti ve temel rolü sabittir. Yalnızca başlangıç sayıları, üretim tohumu ve bunların çözüm yolları değişir.

1. Başlangıç değerleri izinli paletten gelir; otomatik eşleşme yoktur, en az iki yasal takas vardır.
2. Dizilimler ve tohumlar aynı bölüm içinde farklıdır. En az iki ayrı ilk takasla başlayan, bütçe içinde iki gerçek kazanma yolu vardır. Yollar sonuca ulaştıktan sonra devam edemez.
3. Her yol motorla tekrar oynatılır; her hamle sonu ve dalga sonucu deterministiktir. Kayıt geri yükleme gerçek geçmişten doğrulanır.
4. Dört model 64'er denemeyle ölçülür; bölümün kolaylık bandı ve minimum planlama başarısı sağlanır.
5. Aynı bölümde varyantlar arası kolaylık farkı en fazla 14 puan; her amaç odaklı modelin başarı farkı en fazla 30 yüzde puandır. En kısa sertifika uzunluğu farkı en fazla 2 hamle; ortalama kullanılan hamle farkı en fazla 2,5; ortalama alan tamamlama farkı en fazla 0,15'tir.
6. Bölümler arası dalgalanma kontrolü de geçer. Kapı geçmeyen aday reddedilir; sessizce sınır gevşetilmez.

9. bölümde dört varyanta ulaşmak için daha az farklı sayıyla kurulmuş başlangıçlar da arandı: başlangıçlarda paletin 3 veya 4 farklı değeri bulunur. İzin verilen palet hâlâ beş değerdir; normal yeni taş üretimi beşini de kullanır. Bu başlangıç tasarımıdır, oyun sırasında değiştirilen bir üretim kuralı değildir. 37 hücre + 12 ikinci kat = 49 başlangıç katı vardır.

İlk yayın 4 varyanttır. `variantsPerLevel` veya `--count=N` en az 4 olacak şekilde 8/16 ve fazlasını destekler; her yeni başlangıç aynı kapılardan geçer. Yayımlanmış bir `levelDataVersion + levelId + variantId` içeriği değiştirilemez. Aynı sürüme ekleme mevcut kimlikleri korumalıdır; içerik değişiminde eski sürüm arşivlenmelidir. Sabit hedef/bütçe/koordinat değişikliği ayrıca eski temel bölüm tanımının arşivini gerektirir; mevcut katalog yalnızca değişmez orijinal temel veriyi kullanır.

Eski `generate-levels.cjs` araştırma çıktısı artık `reports/legacy-generated/` altına gider; mevcut kayıtların orijinal `dist/levels.js` verisini üzerine yazmaz.

## Yeniden deneme, ipucu ve ödül

Kayıptan sonra tekrar deneme yeni varyant seçer. Oyun ortasında baştan başlama, bu denemenin sıfırlanacağını söyleyen onaydan sonra yeni varyant seçer; iptal aynı oyunu korur. Ön izleme varyant seçmez. Devam et; varyant kimliğini, başlangıç sürümünü, RNG'yi, puanı, alanı, kalan hamleyi ve geçmişi aynen geri yükler. Öğreticiler sabittir. Seçici önce son kullanılanları dışlar, mümkün olmadığında yine hemen önceki varyantı dışlayarak seçer.

İpucu iki sertifikalı rotayı da izleyebilir. Rotadan çıkıldığında sınırlı arama yapar; `proven_route` ve `search_win` gerçek devam yolu, `heuristic` yalnızca öneridir. Kaybetmiş arama dalı gelecekte düzelebilecekmiş gibi genişletilmez. İpucu istemek oyun RNG'sini, hamleyi, puanı veya ödül durumunu değiştirmez; yalnızca ayrı kullanım sayacı/yerel olay eklenir. Worker için mevcut 90 ms, ana iş parçacığı geri dönüşü için 12 ms/1 derinlik sınırları kullanılır. Bunlar işbirlikçi zaman bütçeleridir; tek takas değerlendirmesi bitmeden kesilemez. Cihazda ölçüm ayrıca gerekir.

Reward Director görsel/ses/titreşim yoğunluğunu seçer; puan veya kazandırma kurallarını değiştirmez. Gerçek zincir, hedef tamamlanması ve son hamlede kazanma olayları kutlanır. Animasyonu atlamak veya arka plana geçmek sonucu değiştirmez; puan önce kaydedilir. Eski animasyon süreleri ve güvenlik süresi korunmuştur. 9.1'de ana bölüm kaybı/oynanmış denemeyi onayla kapatma can tüketir; can sıfırsa yeni deneme yenilenmeyi veya isteğe bağlı can kazanımını bekler. Öğreticiler ve var olan oyuna devam ücretsizdir. Mağaza/reklam kendiliğinden açılmaz. Saf motor ve çevrimdışı denge testleri can kapısından bağımsızdır; UI dengelemesinde açık geliştirici geçişi kullanılabilir. Ayrıntılar `LIVES_DESIGN.md` içindedir.

## Gerçek kullanıcıyla sonraki kalibrasyon

İlk nitel denemeyi 8–12 yeni oyuncuyla yap: açıklama vermeden öğreticiyi açtır, ilk bağımsız eşleşmeyi ve ilk bölüm bitişini gözle. “Sayı ne kazandırıyor?”, “Bir bölüm ne zaman bitiyor?”, “İki nokta ne demek?” sorularını kendi sözleriyle yanıtlayabiliyorlar mı? 9 hücreden 19 hücreye geçiş ve yeni sayı renkleri özellikle izlenmeli.

Sonra önceden tanımlanmış takip süresi/örneklemle daha geniş dengeleme denemesi yap. Tamamlama, deneme sayısı, ipucu, puan/alan eksiği, gönüllü tekrar isteği ve 5→6 / 8→9 rahatlama hissi birlikte değerlendirilir. Sabit bir varyantın belirgin biçimde daha kötü olması durumunda yeni veri sürümünde değiştirilir; yarım kalmış eski deneme eski tanımıyla devam eder. Teknik sıra sabitlenebilir, ticari zorluk sayıları insan testi olmadan nihai kabul edilemez.

Yerel olayların gerçek kapsamı ve payda kuralları `ANALYTICS.md`; gelecekteki ücretsiz ekonomi/ürün sınırları `ECONOMY_DESIGN.md`; C# veri sözleşmeleri `UNITY_MIGRATION_PLAN.md` içindedir.

## Tekrarlanabilir komutlar

- `npm run variants:generate`: geliştirme sırasında sertifikalı katalog üretimi/yeniden doğrulama; tarayıcıda çalışmaz.
- `npm run variants:check`: yayımlanan veri, bütün yollar, benzerlik ve dört politika ölçümlerini denetler.
- `npm run balance:check`: eski politikayı birebir yeniden ölçer, yeni raporu ve dalgalanma sırasını doğrular.
- `npm test`: yukarıdaki kabul kontrollerini, kayıt/arayüz/animasyon/ödül ve ortak vektör kontrolleriyle birlikte çalıştırır.
