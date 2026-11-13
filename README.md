# Hexrota — üçlü eşleştirme

**Oyna:** https://hexrota.vercel.app/

Telefon ve masaüstü için Türkçe altıgen sayı bulmacası. Sınırlı hamle, kalıcı yeşil zemin, çift katmanlı zeminler, dokunma/sürükleme kontrolleri, ipucu, ses ve yerel kayıt içerir. Sade üçlü eşleştirme kuralları kullanılır.

## Menü ve ekran akışı

Oyun ana menüyle açılır. **Oyna** sıradaki açık bölümün hedeflerini gösterir; geçerli, yarım kalmış bir kayıt varsa **Devam et** aynı tahtayı ve hamle sayısını doğrudan açar. Bütün bölümler tamamlandığında ana eylem yeniden oynamak için bölüm patikasına götürür.

- Ana menü: Oyna/Devam Et, öğrenme, bölüm seçimi, ayarlar ve kişisel kayıtlar.
- Bölümler: T1/T2 ve 01–10 etiketli özgün patika; açık, tamamlanmış ve kilitli duraklar.
- Bölüm öncesi: puan, yeşertilecek alan ve hamle bütçesi. Bir durağa bakıp vazgeçmek aktif tahtayı değiştirmez; Başla veya Devam Et değişikliği uygular.
- Oyun/duraklatma: devam, yeniden başlatma, ayarlar ve ana menü. Arka plana geçiş oyunu duraklatır. Geç kalan efekt ve ipucu sonuçları menülerin üzerine geri gelmez.
- Sonuçlar: sonraki bölüm, tekrar deneme, patika veya ana menü.
- Kayıtlar: gerçekten doğrulanmış kazanmalardan en iyi bölüm puanı ve kalan hamle; bilinmeyen eski sonuçlar “—” olarak gösterilir.

Ayarlar; gerçek ses efektleri, yerel üretilen arka plan müziği, ortak ses düzeyi, cihaza göre/azaltılmış/standart hareket ve destekleyen cihazlarda titreşim içerir. Ses ilk kullanıcı etkileşiminden önce başlamaz. İlerlemeyi sıfırlama ayrı onay ister; ses ve hareket tercihleri korunur. Başka uygulamaların localStorage verisine veya eski sürüm anahtarlarına dokunulmaz.

## 2 öğretici + 10 bölüm

Yeni oyuncu iki kısa, oynanabilir öğreticiyle başlar. İlkinde 7 altıgen üzerinde komşu takası, üç eşleşme ekseni ve yeşil zemin; ikincisinde 9 altıgen üzerinde çift katman, doğal zincir ve puan/zemin hedeflerinin birlikte tamamlanması öğretilir. Her adımda gerçek bir takas yapılır; sıradaki çift vurgulanır. Yanlış öğretici hamlesi tahta veya bütçe değiştirmez. Öğreticiler atlanabilir veya yolculuk bölümünden yeniden oynanabilir.

Ardından aynı kontrollü yenileme algoritmasını kullanan mevcut 10 bölüm gelir; bölüm verileri ve çözüm dizileri değiştirilmemiştir. Yolculuk etiketleri T1, T2, 01…10'dur. Kampanya ilerleme sayacı yalnızca 10 ana bölümü sayar.

## Oynanış

İki komşu taşı değiştir. Altıgenin üç düz ekseninden birinde aynı sayıdan en az üçü yan yana gelirse eşleşir. Eşleşen taşların değerleri puana eklenir; taşlar silinir, sütundaki üst taşlar aşağı düşer ve boşluklara yeni sayılar gelir. Eşleşme oluşturmayan takas geri döner; tahta, zemin, puan, hamle ve rastgele sayı üreticisi değişmez.

Bir geçerli takas ve onun bütün zincirleri tek hamle tüketir. Her eşleşme, altındaki sabit zemini bir kat boyar; kesişimdeki hücre aynı dalgada bir kez sayılır. Zemin taşlarla birlikte düşmez. İşaretli çift katmanlar iki ayrı eşleşme dalgası gerektirir.

Kazanmak için hamleler tükenmeden **hedef puana ulaşmak veya onu aşmak** ve **bütün zemini yeşertmek** gerekir. Son hamlede iki hedefi tamamlamak da kazandırır. Geçerli takas kalmazsa sayılar otomatik karıştırılır; puan, zemin ilerlemesi ve kalan hamleler korunur. Yeniden başlatmak aynı başlangıç ve yenileme tohumunu kullanır.

## Yenileme ve bölüm algoritması

Önce bütün sütunlardaki mevcut taşlar düşürülür; yeni taş yerleri boş bırakılır. Her yeni sayı, üç eksende kendisinin tamamlayacağı eşleşmeler denetlenerek seçilir. Mümkün olduğunda yeni sayının otomatik üçlü yaratması önlenir. Bütün seçenekler engelliyse en az çatışma üreten sayı deterministik olarak seçilir. Mevcut taşların düşüşünden oluşan doğal zincirler çalışmaya devam eder.

Bölüm üreticisi eşleşmesiz ve birden fazla geçerli başlangıcı olan tahtalar arar. Her bölüm için farklı ilk takaslarla başlayan iki kazanılabilir çözüm kaydedilir. Zemin ve puan hedefleriyle bütçe içinde tamamlanan bu diziler yeniden oynatılarak doğrulanır. Arama aynı tahta/zemin/RNG durumuna ulaştığında daha yüksek puanı korur. Bölüm kabul sınırlarını geçemeyen adaylar sessizce yayımlanmaz. Veriler, 10 bölümün tamamı doğrulandıktan sonra yazılır.

Rastgele geçerli hamle denemeleri kaba zorluk kontrolüdür; insan oyun testinin veya strateji kanıtının yerine geçmez. Hamle bütçeleri ve zemin yerleşimi sonraki oynama deneyimiyle ayarlanabilir.

## Görsel ve hareket sistemi

Krem/orman yeşili arayüz, oyun alanını ve üç sabit hedef göstergesini öne çıkarır: puan, hedef, kalan hamle. Yeşil zemin taşlardan ayrı kalır. Masaüstünde bölüm listesi, telefonda kaydırılabilen kısa yolculuk şeridi kullanılır.

Her oyun dalgası gerçek taş kimliğiyle düşüş verisi taşır. Aynı sayılı taşlar bile sütundaki asıl başlangıç hücresinden hedefine kayar; yeni taşlar sütunun üstünden girer. Eşleşmeler kısa büyüme, parçacıklar, ışık halkası ve puan yazısıyla gösterilir. Düşüşte sütun gecikmesi ve hafif yerleşme vardır. Bu veriler oyun kurallarını, tohumları veya checkpoint sonuçlarını değiştirmez.

## Dokunma ve animasyon güvenilirliği

Tahta sabit SVG üzerinde pointer capture kullanır. Parmağın aynı taş üzerindeki küçük kayması takası iptal etmez; sürükleme bırakılan hücreye göre değerlendirilir. İnce SVG boşluklarında sınırlı dokunma toleransı vardır.

Oyun sonucu animasyondan önce tek kez hesaplanıp kaydedilir. Sunum hata verse bile kontroller açılır; toplam süre 1,2 saniyeyle sınırlıdır. Uzun zincirlerin ilk iki dalgası tam hareketle gösterilir; bütün oyun dalgaları hesaplanır. Kalan zincirler son puan ve zeminde eksiksiz görünür. Animasyonu geç düğmesi veya tahtaya dokunmak sonuca geçer. Yeniden başlatma ve açık bölüm seçimi sunumu iptal eder; eski beklemeler yeni tahtayı değiştiremez. Sekme gizlenince sunum tamamlanır.

Destekleyen tarayıcılarda ipucu Web Worker'da aranır. İşçi açılamazsa kısa süre ve tek derinlikle yerel aramaya dönülür. Hamle/tahta değişince eski ipucu sonuçları iptal edilir. Kaydedilmiş durumlar hamle geçmişi tekrar oynatılarak doğrulanır.

## Kayıt ve sürüm geçişi

Kayıtlar `hexrota-match-v5` anahtarındadır. Sürüm 4'ten geçişte mevcut 10 bölümün indeksleri iki kaydırılır; hamle geçmişleri, tamamlanan bölümler ve ses tercihi korunur. Mevcut oyuncular için öğreticiler tamamlanmış sayılır ve tekrar oynanabilir. Daha eski eşleştirme sürümlerinden ilerleme/ses tercihi taşınır, uyumsuz tahta yeniden başlar. Yeni oyuncular ana menüde Oyna ile T1'e başlar. Sürüm 6 aynı v5 kayıt anahtarını ve aynı oyun kurallarını korur; ek olarak tercihleri ve gözlenen en iyi sonuçları saklar. Önceki kayıt anahtarlarına dokunulmaz.

## Çalıştırma ve dosyalar

Derleme veya sunucu tarafı kod gerekmez. `dist/` dizinini statik olarak sun. Örneğin yerel geliştirmede `python3 -m http.server 8000 --directory dist`.

- `dist/levels.js`: 10 ana bölümün başlangıçları, tohumları, bütçeleri ve çözümleri.
- `dist/tutorials.js`: İki küçük öğretici, yönlendirme adımları ve doğrulanmış çözümler.
- `dist/engine.js`: DOM'dan bağımsız eşleştirme, kontrollü yenileme, düşüş, zincirler, puan ve zemin.
- `dist/app.js`: Giriş kontrolleri, iptal edilebilir sunum, arayüz, yerel kayıt ve ses.
- `dist/hint-worker.js`: Giriş ve çizim akışından ayrı çalışan ipucu araması.
- `dist/audio.js`: Kullanıcı etkileşiminden sonra başlayan, iptal edilebilir yerel ses/müzik katmanı.
- `dist/style.css`: Duyarlı tasarım ve azaltılmış hareket desteği.
- `generate-levels.cjs`: Tekrarlanabilir bölüm üretimi, çözüm araması ve kabul denetimleri.
- `balance-report.json`: Sabit deneme politikalarıyla ölçülen kaba zorluk ve zincir istatistikleri.

Eski `/test.html` bağlantısı güncel oyuna yönlenir. Ayrı deneme oyunu bulunmaz.

R: aynı bölümü yeniden başlat; H: ipucu; Enter/Space: taş seç; ok tuşları: komşu taşa odaklan. İlerleme yalnızca mevcut tarayıcının localStorage alanında saklanır.

## Kontroller

Node.js 22.22.2+ veya 24.15.0+ kullan. `npm install` ardından `npm test`. Üretimde harici bağımlılık veya font servisi kullanılmaz; jsdom yalnızca geliştirme testidir.

Testler üç ekseni, geçersiz takasta durumun korunmasını, kesişimlerin tek sayılmasını, çift zemini, düşüşü, kontrollü yenilemeyi, zincirleri, karıştırmayı, ipucunu, son hamlede kazanmayı, kaybetmeyi ve kayıt doğrulamayı kapsar. İki öğretici ve on bölüm DOM üzerinden oynanıp açılır. Yönlendirmeler, yanlış hamlede bütçenin korunması, öğreticileri atlama/yeniden oynama, eski kayıtların iki indeks kaydırılarak korunması ve gerçek başlangıçtan düşüş verisi doğrulanır. Gerçek pointer olaylarıyla parmak kayması, capture/iptal, animasyon hatası, süre sınırı, sekme değişimi, eski zamanlayıcılar ve Worker hataları kontrol edilir. Menü testleri ana ekran, devam etme, ön izleme iptali, ayarlar, onaylı sıfırlama, iç içe pencere geri/Escape sırası, arka planda duraklama ve sonuç ekranı geçişlerini kapsar. Ses katmanı sahte AudioContext ile döngü çoğalması, görünürlük, hata ve kapanış davranışına karşı kontrol edilir. DOM testleri fiziksel cihaz ve görsel tarayıcı testinin yerine geçmez.


## Web uygulaması ve Vercel

`dist/` doğrudan HTTPS üzerinden yayınlanır. `vercel.json` framework algılamasını ve gereksiz derleme/kurulumu kapatır, çıktı dizinini `dist` olarak seçer. Ortam değişkeni veya sunucu gerekmez. `kiviman1/hexrota` GitHub deposunun `main` dalı Vercel’deki `hexrota` projesine bağlıdır; yeni gönderimler otomatik olarak üretim adresine dağıtılır.

Ayarlar içinden bağlantı paylaşılabilir, destekleyen cihazlarda tam ekran açılabilir ve ana ekrana ekleme yönergesi görülebilir. Kurulabilir tarayıcılarda yerel kurulum istemi kullanılır; iPhone/iPad'de Safari'nin Paylaş → Ana Ekrana Ekle yolu açıklanır. Güvenli alan boşlukları ve uygulama simgeleri telefon ekranlarını destekler.

İlk çevrim içi açılıştan sonra doğrulanmış oyun dosyaları çevrim dışı kullanım için saklanır. Giriş sayfaları ve başka sitelerin yanıtları önbelleğe alınmaz. Yeni sürüm beklerken devam eden oyun kendiliğinden yenilenmez; Ayarlar'daki **Yeni sürümü aç** eylemi güncellemeyi uygular. Oyun durumu her hamlede yerel olarak kaydedilir.

İlerleme cihaz ve site adresine özeldir. Eski Sites adresindeki kayıtlar o adreste korunur; Vercel adresi ayrı bir yolculuk başlatır. Bu sürümde hesap veya cihazlar arası eşitleme yoktur.


## Tam ekran oyun görünümü

Sürüm 8'de oyun alanı görünür ekran yüksekliğini kullanır. Oyun sırasında site başlığı, bölüm şeridi ve genel gezinme gizlenir; üstte puan/hedef, bölüm arması ve hamle, altta zemin ilerlemesi ve beş oyun kontrolü bulunur. Bölüm seçimi ana menüdeki patikadan yapılır. Dikey ve yatay yerleşimler, güvenli alanlar ve tarayıcı çubuklarının yüksekliği hesaba katılır. Görüntü boyutu değişikliği tahtayı veya hamle kaydını yeniden başlatmaz.

Uygulamada pinch, çift dokunma ve klavye/tekerlek yakınlaştırma hareketleri engellenir. Tek dokunuşlar, taş takası ve ayar pencerelerindeki kaydırma korunur. Tarayıcının kendi adres ve sistem çubuklarını gizlemek için desteklenen cihazlarda ana ekrana ekleme veya tam ekran seçeneği kullanılabilir.
