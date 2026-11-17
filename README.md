# Hexrota — üçlü eşleştirme

**Oyna:** https://hexrota.vercel.app/

Telefon ve masaüstü için Türkçe altıgen sayı bulmacası. Sınırlı hamle, kalıcı yeşil zemin, çift katmanlı zeminler, dokunma/sürükleme kontrolleri, ipucu, ses ve yerel kayıt içerir. Sade üçlü eşleştirme kuralları kullanılır.

## Menü ve ekran akışı

Oyun ana menüyle açılır. Yeni oyuncu **Birlikte başlayalım** ile ilk örneği görür; sonraki bölümlerde **Oyna** hedefleri gösterir. Geçerli, yarım kalmış bir kayıt varsa **Devam et** aynı tahtayı ve hamle sayısını doğrudan açar. Bütün ana bölümler tamamlandığında ana eylem “Bahçeni gör” olur; “Yeni bölümler yakında” akışı açılır.

- Ana menü: Oyna/Devam Et, öğrenme, bölüm seçimi, ayarlar ve kişisel kayıtlar.
- Bölümler: ödülsüz tekrarlanabilen T1/T2 ve yalnız sıradaki tamamlanmamış ana bölüm. Tamamlanan kampanya bölümleri oynanabilir listelerde üretilmez.
- Bölüm öncesi: T1'de `2 + 2 + 2 → +6 puan` örneği; sonraki duraklarda puan, yeşertilecek alan ve hamle bütçesi. Bir durağa bakıp vazgeçmek aktif tahtayı değiştirmez; Başla veya Devam Et değişikliği uygular.
- Oyun/duraklatma: devam, yeniden başlatma, ayarlar ve ana menü. Arka plana geçiş oyunu duraklatır. Geç kalan efekt ve ipucu sonuçları menülerin üzerine geri gelmez.
- Sonuçlar: ilk doğrulanmış kazanımda 20 Altın + 1 yıldız ve sonraki tamamlanmamış bölüm/bahçe; kayıpta isteğe bağlı açık TEST reklamı veya 140 Altınla tek +5 hamle, normal tekrar veya menü.
- Kayıtlar: gerçekten doğrulanmış kazanmalardan en iyi bölüm puanı ve kalan hamle; bilinmeyen eski sonuçlar “—” olarak gösterilir.

Ayarlar; gerçek ses efektleri, yerel üretilen arka plan müziği, ortak ses düzeyi, cihaza göre/azaltılmış/standart hareket ve destekleyen cihazlarda titreşim içerir. Ses ilk kullanıcı etkileşiminden önce başlamaz. Bitmemiş oyunları sıfırlama ayrı onay ister; kalıcı tamamlamalar, oyun Altını, yıldızlar, envanter, kanıt arşivleri ve ses/hareket tercihleri korunur. Başka uygulamaların localStorage verisine veya eski sürüm anahtarlarına dokunulmaz.

## 9.5 ilerleme ve ekonomi

Her ana kampanya bölümü yalnız bir kez tamamlanır; varyant/deneme/reset yeni ödül hakkı oluşturmaz. L3 ilk kazanımı 3 Yeşil Fırça, L6 ilk kazanımı 3 Renk Anahtarı verir. İki yardım açık hedef/sonuç/maliyet ön izlemesiyle sıfır hamle kullanır; stok alımı 70/90 oyun Altınıdır. Kurtarma aynı Attempt ID, tahta ve RNG ile bir kez +5 hamle verir; ilk kaybın canı tekrar kesilmez. Reklamlar kullanıcı talebiyle açılan geliştirme TEST sağlayıcısıdır; gerçek SDK/ödeme yoktur.

Yıldızlar harcanmaz; 2/5/8/10 yıldız çiçek/bitki/ağaç/tam bahçeyi açar. 300 TEST Altın yalnız eski can prototipinin ayrı cüzdanıdır, yeni oyun Altınına dönüşmez. Eski kanıtlı kazanımlar bir kez ödüllenir; kanıtı eksik eski tamamlamalar yeniden açılmadan incelemede tutulur. Dağıtım onayına kadar yeni özellikler Preview'dadır; üretim ancak main PR onayıyla güncellenir.

Kurallar, komutlar ve gerçek test sayıları: [9.5 teslim kaydı](docs/ECONOMY_9_5_DELIVERY.md), [ürün şartnamesi](docs/ONE_TIME_PROGRESSION_ECONOMY_9_5.md), [ekonomi](docs/ECONOMY_DESIGN.md), [Unity sözleşmesi](docs/UNITY_MIGRATION_PLAN.md). `npm test` bütün yeni JS kontrollerini de çalıştırır; gerçek C# kontrolleri `test:unity-economy`, `test:unity-commands`, `test:unity-rescue`, `test:unity-session` komutlarıdır. Fiziksel cihaz ve Unity/IL2CPP doğrulaması ayrı aşamadır.

## 2 öğretici + 10 bölüm

Yeni oyuncu iki kısa, oynanabilir öğreticiyle başlar. İlkinde 7 altıgen üzerinde komşu takası, üç eşleşme ekseni ve yeşil zemin; ikincisinde 9 altıgen üzerinde çift katman, doğal zincir ve puan/zemin hedeflerinin birlikte tamamlanması öğretilir. Her adımda gerçek bir takas yapılır; sıradaki çift vurgulanır. Yanlış öğretici hamlesi tahta veya bütçe değiştirmez. Öğreticiler atlanabilir veya yolculuk bölümünden yeniden oynanabilir.

İlk öğretici tek eylemle başlar: işaretli komşuları kaydır veya sırayla dokun. Ok ve el hareketi yönü gösterir; oluşacak eşleşmenin diğer taşları görünür kalır. T1'de hedef puan ve hamle bütçesi arka planda korunurken ekranda kazanılan puan ve yeşil zemin öne çıkar; T2'de iki hedef ve hamle sayısı birlikte gösterilir.

Üç açıklama oyuncu **Devam et** düğmesine basana kadar kalır: T1'in ilk eşleşmesi, T2'nin ilk çift katman vuruşu ve T2'de puan tamamken son zeminin eksik kalması. Bu sırada yeni hamle ve ipucu kapalıdır; ayarlar, menü, yeniden başlatma ve öğreticiyi atlama kullanılabilir. Okunan açıklamalar `guideAcks` içinde, oyun motorunun checkpoint verisinden ayrı saklanır. Yeniden açılış aynı tahta ve bekleyen açıklamayla devam eder; onay puan veya hamle üretmez. Öğreticiyi baştan başlatmak yalnızca o öğreticinin onaylarını temizler.

Öğretici ve yardım metinleri günlük Türkçeyle yazılır: hareket için “iki taşın yerini değiştir”, boyanan yer için “taşların altı” veya “yeşil alan” kullanılır. Talimatlar o an yapılacak hareketi söyler; puan, iki nokta ve bölümün bitmesi gerçek hamlelerden sonra açıklanır.

Ardından aynı kontrollü yenileme algoritmasını kullanan 10 bölüm gelir. Orijinal bölüm verileri eski kayıtlar için korunur; yeni oyunlarda her bölümün dört doğrulanmış varyantından biri açılır. Yolculuk etiketleri T1, T2, 01…10'dur. Kampanya ilerleme sayacı yalnızca 10 ana bölümü sayar.

## Oynanış

İki komşu taşı değiştir. Altıgenin üç düz ekseninden birinde aynı sayıdan en az üçü yan yana gelirse eşleşir. Eşleşen taşların değerleri puana eklenir; taşlar silinir, sütundaki üst taşlar aşağı düşer ve boşluklara yeni sayılar gelir. Eşleşme oluşturmayan takas geri döner; tahta, zemin, puan, hamle ve rastgele sayı üreticisi değişmez.

Bir geçerli takas ve onun bütün zincirleri tek hamle tüketir. Her eşleşme, altındaki sabit zemini bir kat boyar; kesişimdeki hücre aynı dalgada bir kez sayılır. Zemin taşlarla birlikte düşmez. İşaretli çift katmanlar iki ayrı eşleşme dalgası gerektirir.

Kazanmak için hamleler tükenmeden **hedef puana ulaşmak veya onu aşmak** ve **bütün zemini yeşertmek** gerekir. Son hamlede iki hedefi tamamlamak da kazandırır. Geçerli takas kalmazsa sayılar otomatik karıştırılır; puan, zemin ilerlemesi ve kalan hamleler korunur. Ana bölümde yeniden başlatma onaydan sonra yeni bir doğrulanmış varyant seçer; kayıptan sonra yeniden deneme doğrudan yeni varyant açar. Devam et aynı varyantı ve durumu getirir. İki öğretici sabittir.

## Yenileme ve bölüm algoritması

Önce bütün sütunlardaki mevcut taşlar düşürülür; yeni taş yerleri boş bırakılır. Her yeni sayı, üç eksende kendisinin tamamlayacağı eşleşmeler denetlenerek seçilir. Mümkün olduğunda yeni sayının otomatik üçlü yaratması önlenir. Bütün seçenekler engelliyse en az çatışma üreten sayı deterministik olarak seçilir. Mevcut taşların düşüşünden oluşan doğal zincirler çalışmaya devam eder.

Çevrimdışı varyant üreticisi eşleşmesiz ve birden fazla geçerli başlangıcı olan tahtalar arar. Her varyant için farklı ilk takaslarla başlayan iki kazanılabilir çözüm kaydedilir. Zemin ve puan hedefleriyle bütçe içinde tamamlanan bu diziler yeniden oynatılarak doğrulanır. Arama aynı tahta/zemin/RNG durumuna ulaştığında daha yüksek puanı korur. Bölüm kabul sınırlarını geçemeyen adaylar sessizce yayımlanmaz. Veriler, 10 bölümdeki bütün varyantlar doğrulandıktan sonra yazılır. Dört bot politikası, aynı bölüm içindeki benzerlik ve bölümler arası dalgalanma sınırları ayrıca denetlenir.

Rastgele geçerli hamle denemeleri kaba zorluk kontrolüdür; insan oyun testinin veya strateji kanıtının yerine geçmez. Hamle bütçeleri ve zemin yerleşimi sonraki oynama deneyimiyle ayarlanabilir.

## Görsel ve hareket sistemi

Rakamlar taşların ana kimliğidir; her değer belirgin ve tutarlı bir renkle desteklenir. Taşın büyük rakamı eşleşince verdiği puanı, toprak rengi altlık henüz yeşermemiş zemini, yeşil altlık kalıcı ilerlemeyi gösterir. Çift katmanlı zeminde ikinci bir rakam yerine iki küçük nokta bulunur; her eşleşmede bir nokta azalır. T1'den sonra puan ve yeşil zemin iki ayrı hedef satırı olarak üstte yer alır; tamamlandıklarında ayrı onay işaretleri görünür. Bölüm seçimi ana menüdeki patikadadır.

Her oyun dalgası gerçek taş kimliğiyle düşüş verisi taşır. Aynı sayılı taşlar bile sütundaki asıl başlangıç hücresinden hedefine kayar; yeni taşlar sütunun üstünden girer. Eşleşmeler kısa büyüme, parçacıklar, ışık halkası ve puan yazısıyla gösterilir. Düşüşte sütun gecikmesi ve hafif yerleşme vardır. Bu veriler oyun kurallarını, tohumları veya checkpoint sonuçlarını değiştirmez.

## Dokunma ve animasyon güvenilirliği

Tahta sabit SVG üzerinde pointer capture kullanır. Parmağın aynı taş üzerindeki küçük kayması takası iptal etmez; sürükleme bırakılan hücreye göre değerlendirilir. İnce SVG boşluklarında sınırlı dokunma toleransı vardır.

Oyun sonucu animasyondan önce tek kez hesaplanıp kaydedilir. Sunum hata verse bile kontroller açılır; toplam süre 3,3 saniyeyle sınırlıdır. Uzun zincirlerin ilk iki dalgası tam hareketle gösterilir; bütün oyun dalgaları hesaplanır. Kalan zincirler son puan ve zeminde eksiksiz görünür. Animasyonu geç düğmesi veya tahtaya dokunmak sonuca geçer. Yeniden başlatma ve açık bölüm seçimi sunumu iptal eder; eski beklemeler yeni tahtayı değiştiremez. Sekme gizlenince sunum tamamlanır.

Destekleyen tarayıcılarda ipucu Web Worker'da aranır. İşçi açılamazsa kısa süre ve tek derinlikle yerel aramaya dönülür. Hamle/tahta değişince eski ipucu sonuçları iptal edilir. Kaydedilmiş durumlar hamle geçmişi tekrar oynatılarak doğrulanır.

## Kayıt ve sürüm geçişi

Kayıtlar `hexrota-match-v5` anahtarındadır. Sürüm 4'ten geçişte mevcut 10 bölümün indeksleri iki kaydırılır; hamle geçmişleri, tamamlanan bölümler ve ses tercihi korunur. Mevcut oyuncular için öğreticiler tamamlanmış sayılır ve tekrar oynanabilir. Daha eski eşleştirme sürümlerinden ilerleme/ses tercihi taşınır, uyumsuz tahta yeniden başlar. Yeni oyuncular ana menüde Birlikte başlayalım ile T1'e başlar. Aynı v5 kayıt anahtarı ve oyun kuralları korunur; tercihler, gözlenen en iyi sonuçlar ve öğretici onayları ayrıca saklanır. Önceki kayıt anahtarlarına dokunulmaz. Yeni denemelerde ham snapshot v4 biçimi `boards` içinde kalır; bölüm/varyant/veri sürümü/deneme kimliği `attempts` içinde aynı JSON yazımında tutulur. Varyant bilgisi bulunmayan eski kayıt yalnızca değişmeyen orijinal bölümle tekrar oynatılarak doğrulanır. Geçerli kaydın tamamı korunur; bilinmeyen veri sürümü veya kimlik sessizce yeni tahtayla değiştirilmez.

## Çalıştırma ve dosyalar

Derleme veya sunucu tarafı kod gerekmez. `dist/` dizinini statik olarak sun. Örneğin yerel geliştirmede `python3 -m http.server 8000 --directory dist`.

- `dist/levels.js`: Eski kayıtlar için değişmez 10 orijinal bölüm; geometri, bütçe, hedef ve palet referansı.
- `dist/variants.json`, `dist/variants-data.js`: 40 doğrulanmış yeni başlangıç ve 80 kazanma yolu.
- `dist/attempts.js`: Saf katalog, tekrar önleyici seçim ve hamle geçmişiyle doğrulanmış deneme geri yükleme.
- `dist/events.js`: Yerel olay şeması; dışarı veri göndermez.
- `dist/tutorials.js`: İki küçük öğretici, yönlendirme adımları ve doğrulanmış çözümler.
- `dist/engine.js`: DOM'dan bağımsız eşleştirme, kontrollü yenileme, düşüş, zincirler, puan ve zemin.
- `dist/app.js`: Giriş kontrolleri, iptal edilebilir sunum, arayüz, yerel kayıt ve ses.
- `dist/hint-worker.js`: Giriş ve çizim akışından ayrı çalışan ipucu araması.
- `dist/audio.js`: Kullanıcı etkileşiminden sonra başlayan, iptal edilebilir yerel ses/müzik katmanı.
- `dist/style.css`: Duyarlı tasarım ve azaltılmış hareket desteği.
- `generate-variants.cjs`, `lib/level-analysis.cjs`: Çevrimdışı varyant üretimi, dört bot ve kabul kapıları.
- `generate-levels.cjs`: Eski araştırma üreticisi; çıktı yalnızca `reports/legacy-generated/` altında, mevcut orijinal verinin üzerine yazılmaz.
- `balance-variants.cjs`: Bütün bot ölçümlerinin ve zorluk sırasının tekrarlanması.
- `data/levels-original.json`, `data/tutorials-fixed.json`: Unity aktarımı için kaynaklarla eşit JSON dışa aktarımları.
- `balance-report.json`: Sabit deneme politikalarıyla ölçülen kaba zorluk ve zincir istatistikleri.

Eski `/test.html` bağlantısı güncel oyuna yönlenir. Ayrı deneme oyunu bulunmaz.

R: aynı bölümü yeniden başlat; H: ipucu; Enter/Space: taş seç; ok tuşları: komşu taşa odaklan. İlerleme yalnızca mevcut tarayıcının localStorage alanında saklanır.

## Kontroller

Node.js 22.22.2+ veya 24.15.0+ kullan. `npm ci` ardından `npm test`. Üretimde harici bağımlılık veya font servisi kullanılmaz; jsdom yalnızca geliştirme testidir.

Testler üç ekseni, geçersiz takasta durumun korunmasını, kesişimlerin tek sayılmasını, çift zemini, düşüşü, kontrollü yenilemeyi, zincirleri, karıştırmayı, ipucunu, son hamlede kazanmayı, kaybetmeyi ve kayıt doğrulamayı kapsar. İki öğretici ve on bölüm DOM üzerinden oynanıp açılır. Yönlendirmeler, yanlış hamlede bütçenin korunması, öğreticileri atlama/yeniden oynama, eski kayıtların iki indeks kaydırılarak korunması ve gerçek başlangıçtan düşüş verisi doğrulanır. Gerçek pointer olaylarıyla parmak kayması, capture/iptal, animasyon hatası, süre sınırı, sekme değişimi, eski zamanlayıcılar ve Worker hataları kontrol edilir. Menü testleri ana ekran, devam etme, ön izleme iptali, ayarlar, onaylı sıfırlama, iç içe pencere geri/Escape sırası, arka planda duraklama ve sonuç ekranı geçişlerini kapsar. Ses katmanı sahte AudioContext ile döngü çoğalması, görünürlük, hata ve kapanış davranışına karşı kontrol edilir. DOM testleri fiziksel cihaz ve görsel tarayıcı testinin yerine geçmez.


## Web uygulaması ve Vercel

`dist/` doğrudan HTTPS üzerinden yayınlanır. `vercel.json` framework algılamasını ve gereksiz derleme/kurulumu kapatır, çıktı dizinini `dist` olarak seçer. Ortam değişkeni veya sunucu gerekmez. `kiviman1/hexrota` GitHub deposunun `main` dalı Vercel’deki `hexrota` projesine bağlıdır; yeni gönderimler otomatik olarak üretim adresine dağıtılır.

Ayarlar içinden bağlantı paylaşılabilir, destekleyen cihazlarda tam ekran açılabilir ve ana ekrana ekleme yönergesi görülebilir. Kurulabilir tarayıcılarda yerel kurulum istemi kullanılır; iPhone/iPad'de Safari'nin Paylaş → Ana Ekrana Ekle yolu açıklanır. Güvenli alan boşlukları ve uygulama simgeleri telefon ekranlarını destekler.

İlk çevrim içi açılıştan sonra doğrulanmış oyun dosyaları çevrim dışı kullanım için saklanır. Giriş sayfaları ve başka sitelerin yanıtları önbelleğe alınmaz. Yeni sürüm beklerken devam eden oyun kendiliğinden yenilenmez; Ayarlar'daki **Yeni sürümü aç** eylemi güncellemeyi uygular. Oyun durumu her hamlede yerel olarak kaydedilir.

İlerleme cihaz ve site adresine özeldir. Eski Sites adresindeki kayıtlar o adreste korunur; Vercel adresi ayrı bir yolculuk başlatır. Bu sürümde hesap veya cihazlar arası eşitleme yoktur.


## Tam ekran oyun görünümü

Oyun alanı görünür ekran yüksekliğini kullanır. Oyun sırasında site başlığı, bölüm şeridi ve genel gezinme gizlenir; üstte puan ve zemin hedefleriyle hamle sayısı, altta oyun kontrolleri bulunur. İlk öğretici bu göstergeleri aşamalı olarak tanıtır. Bölüm seçimi ana menüdeki patikadan yapılır. Dikey ve yatay yerleşimler, güvenli alanlar ve tarayıcı çubuklarının yüksekliği hesaba katılır. Görüntü boyutu değişikliği tahtayı veya hamle kaydını yeniden başlatmaz.

Uygulamada pinch, çift dokunma ve klavye/tekerlek yakınlaştırma hareketleri engellenir. Tek dokunuşlar, taş takası ve ayar pencerelerindeki kaydırma korunur. Tarayıcının kendi adres ve sistem çubuklarını gizlemek için desteklenen cihazlarda ana ekrana ekleme veya tam ekran seçeneği kullanılabilir.


## Puanın tahtadan göstergeye taşınması

Takasın ardından eşleşen taşların rakamları yüzeyden yükselir ve aynı noktaya toplanır. Her rakam vardıkça ara toplam artar; son toplam büyük bir sayı olarak ışık halkası ve parçacıklarla patlar. Ardından yalnızca toplam üstteki puan göstergesine uçar; sayaç varışta artar. Kutu veya hesap kartı kullanılmaz. Son hamlede kazanılan toplam küçük bir rozet olarak kalır; zincirler sıra numarasıyla gösterilir. Bu sunum bir puan çarpanı eklemez.

Oyun motoru sonucu önceden hesaplayıp kaydeder. Hareketli rakamlar yalnızca bu sonucu gösterir; puanı yeniden hesaplayıp kayda eklemez. Uzun zincirlerin son dalgaları tek toplamda birleştirilir; kalan zincir puanları ayrıca toplanarak her puan bir kez göstergeye aktarılır. Azaltılmış harekette, sunumu geçmede, ekran değişiminde veya animasyon hatasında gerçek toplam doğrudan gösterilir. Sunum yine 3,3 saniyeyle sınırlıdır.


Hareket süreleri `app.js` içindeki `motion` ayarlarında birlikte tanımlanır. Takas 300 ms, taş düşüşü 380 ms (sütun gecikmesi en çok 70 ms), rakamların toplanması 240–420 ms sürer. Toplamın büyümesi ve ekranda beklemesi 340 ms, hedefe uçuşu 380 ms'dir. Tek dalga yaklaşık 1,6 saniyede, iki dalga yaklaşık 2,9 saniyede tamamlanır; ikinci dalga öncekinin puanı göstergeye ulaştıktan sonra başlar. Atla ve azaltılmış hareket seçenekleri beklemeden gerçek sonuca geçer.


## Unity ile ortak ödül yöneticisi

Uzun çizgi, gerçek zincir, kesişen eksenler, yeni yeşil alan, çift zemin ve hedef tamamlamaları dört geri bildirim seviyesine çevrilir. Hamlede tek ana başlık seçilir; en büyük efektlerin tekrar aralığı vardır. Mevcut puanlar, bölüm dengesi ve onaylanan animasyon süreleri korunur.

Kurallar `dist/reward-rules.json` içinde, arayüzden bağımsız JavaScript motoru `dist/rewards.js` içindedir. Aynı modelin derlenerek doğrulanan C# 7.3 karşılığı `unity/Rewards/` altındadır. Ayrıntılı davranış ve aktarım adımları: [Ödül yöneticisi](docs/REWARD_DIRECTOR.md).

`npm test` JavaScript, uygulama ve ortak veri kontrollerini çalıştırır. `npm run test:unity-rewards` .NET 8 SDK ile C# / JavaScript sonuçlarını karşılaştırır; `DOTNET_PATH` ile SDK yolu verilebilir. Unity Editör veya iOS paket derlemesi bu aşamada yapılmaz.


## Doğrulanmış varyantlar ve Unity hazırlığı — sürüm 9

`npm test` orijinal regresyonların yanında 40 varyantın 80 yolunu, deneme/kayıt/olay akışlarını, dört politikayla denge raporunu ve ortak gameplay vektörlerini de denetler. `npm run test:unity-rewards` mevcut C# ödül yöneticisini gerçekten derleyerek karşılaştırır. Gameplay motorunun C# uygulaması henüz yoktur; hazırlanmış JSON vektörleri gelecekteki portun kabul sözleşmesidir.

- [Bölüm tasarımı, gerçek bot tablosu ve kabul sınırları](docs/LEVEL_DESIGN.md)
- [Ekonomi tasarımı — uygulanmış mağaza/cüzdan değildir](docs/ECONOMY_DESIGN.md)
- [Unity modül ve veri aktarım planı](docs/UNITY_MIGRATION_PLAN.md)
- [Yerel olay sözleşmesi ve ölçüm sınırları](docs/ANALYTICS.md)
- [Başlangıç referansı ve test sonuçları](docs/BASELINE.md)

Ekonomi ayarları `data/economy-design.json` içinde yalnızca taslak veridir; uygulama bunları yüklemez. Gerçek para, canlı reklam SDK'sı veya güçlendirici eklenmemiştir. 9.1 can denemeleri için ayrı ve açıkça etiketlenmiş bir Test Altını bakiyesi/sahte sağlayıcı ekler; bu gerçek oyun ekonomisi değildir. Her bölüm, temel kurallarla ve satın alma olmadan tamamlanan yollarla doğrulanır.

Botlar, amaç odaklı kararları motor kopyasında gerçek RNG ile hesaplar; gelecek taşları insan oyuncudan daha iyi bilir. Bot başarısı insan kazanma oranı değildir. Özellikle 5/8 planlama zirveleri ve alanı önceleyen stratejide rahatlayan 9, ticari dengeleme öncesi gerçek kullanıcıyla sınanmalıdır.


## Can sistemi — sürüm 9.1

Yeni oyuncu 5 canla başlar. Ana bölüm kaybı veya oynanmış denemeyi onayla kapatma 1 can harcar; aynı deneme iki kez ücretlendirilmez. Kazanma ve T1/T2 ücretsizdir. Eksik can 30 dakikada bir, oyun kapalıyken de yenilenir. Can sıfırken yeni ana deneme açılmaz; doğrulanmış kayıt kaldığı yerden devam edebilir. Beş kalp ana menü ve yolculukta görünür.

`dist/lives.js` saat ve işlem doğrulayıcısı dışarıdan verilen saf yöneticidir. `dist/lives-config.json` kanonik ayardır; değiştirince `npm run lives:sync` tarayıcı kopyasını üretir. Oyun snapshot'ı ve `hexrota-match-v5` değişmez; can, sahte sağlayıcı ve Test Altını tek ayrı `hexrota-lives-v1` kaydında saklanır.

Can ekranındaki reklam ve Altın işlemleri yalnızca **GELİŞTİRME TESTİ** içindir; gerçek reklam gösterilmez veya para alınmaz. Test fiyatları 1 can/30, beşe tamamlama/100 ve 30 dakika sınırsız can/180 Test Altınıdır. Sahte reklam +1 can verir; başarılı talepler günde 3 ve aralarında 30 dakika ile sınırlıdır.

Ayarlar → **Geliştirme testi → Can sınırını kapat** bölüm dengelemesini beklemesiz yapar. Aynı alanda reklam yokluğunu deneme ve 300 Test Altını ekleme araçları bulunur. Geliştirici geçişi varsayılan kapalıdır; ilk üç bölümün ilk kayıp koruması da varsayılan kapalı, JSON'dan yapılandırılabilirdir.

`npm run test:lives` zaman, tekrar bildirim, sıfır can, kayıt, sağlayıcı ve UI senaryolarını doğrular; genel `npm test` buna ek olarak 9.0'ın bütün bölüm/ödül/denge kontrollerini çalıştırır. [Can kuralları ve JSON sözleşmesi](docs/LIVES_DESIGN.md) Unity portunun referansıdır; C# can uygulaması henüz yazılmamıştır.

## Kod bakımı ve mimari

Yeni özellik eklemeden önce [modül sahipliği rehberini](docs/ARCHITECTURE.md) ve [9.5 bakım raporunu](docs/CODEBASE_AUDIT_9_5.md) okuyun. `npm run test:maintenance` kayıt sınırları, sabit sunum sözleşmesi, CSS kaynak üretimi ve bağımlılık kontrollerini çalıştırır. CSS için `src/styles/manifest.json` kaynak sırasını koruyun; `npm run styles:sync` ile tek teslim dosyasını yenileyin.

## Comic Adventure görsel dili

[Tasarım sistemi](docs/UI_VISUAL_LANGUAGE.md), [uygulama raporu](docs/UI_RESTYLE_9_6_REPORT.md) ve `/ui-kit.html` çalışan bileşen örnekleridir. Kit oyun kaydı veya ödül üretmez. `npm run test:comic-ui` ve `npm run test:comic-ui-browser` tasarım sınırlarını denetler.

## Unity 6 client (9.11 — ayrı geliştirme hattı)

Gerçek Unity proje başlangıcı unity-client/ klasöründedir. Kanonik C# kaynakları unity/ altında kalır; node scripts/sync-unity-client.cjs --check üretilmiş Unity kopyalarını ve 10 bölüm/40 varyant verisini denetler. Kurulum, sınırlar ve Blender prefab bağlantıları için [Unity 9.11 rehberi](docs/UNITY_CLIENT_9_11.md) bölümüne bak. Unity WebGL derlemesi doğrulanmadan mevcut Vercel oyununun yerine geçmez.
