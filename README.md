# Hexrota — üçlü eşleştirme

Telefon ve masaüstü için Türkçe altıgen sayı bulmacası. Sınırlı hamle, kalıcı yeşil zemin, çift katmanlı zeminler, dokunma/sürükleme kontrolleri, ipucu, ses ve yerel kayıt içerir. Sade üçlü eşleştirme kuralları kullanılır.

## Oynanış

İki komşu taşı değiştir. Altıgenin üç düz ekseninden birinde aynı sayıdan en az üçü yan yana gelirse eşleşir. Eşleşen taşların değerleri puana eklenir; taşlar silinir, sütundaki üst taşlar aşağı düşer ve boşluklara yeni sayılar gelir. Eşleşme oluşturmayan takas geri döner; tahta, zemin, puan, hamle ve rastgele sayı üreticisi değişmez.

Bir geçerli takas ve onun bütün zincirleri tek hamle tüketir. Her eşleşme, altındaki sabit zemini bir kat boyar; kesişimdeki hücre aynı dalgada bir kez sayılır. Zemin taşlarla birlikte düşmez. İşaretli çift katmanlar iki ayrı eşleşme dalgası gerektirir.

Kazanmak için hamleler tükenmeden **hedef puana ulaşmak veya onu aşmak** ve **bütün zemini yeşertmek** gerekir. Son hamlede iki hedefi tamamlamak da kazandırır. Geçerli takas kalmazsa sayılar otomatik karıştırılır; puan, zemin ilerlemesi ve kalan hamleler korunur. Yeniden başlatmak aynı başlangıç ve yenileme tohumunu kullanır.

## Yenileme ve bölüm algoritması

Önce bütün sütunlardaki mevcut taşlar düşürülür; yeni taş yerleri boş bırakılır. Her yeni sayı, üç eksende kendisinin tamamlayacağı eşleşmeler denetlenerek seçilir. Mümkün olduğunda yeni sayının otomatik üçlü yaratması önlenir. Bütün seçenekler engelliyse en az çatışma üreten sayı deterministik olarak seçilir. Mevcut taşların düşüşünden oluşan doğal zincirler çalışmaya devam eder.

Bölüm üreticisi eşleşmesiz ve birden fazla geçerli başlangıcı olan tahtalar arar. Her bölüm için farklı ilk takaslarla başlayan iki kazanılabilir çözüm kaydedilir. Zemin ve puan hedefleriyle bütçe içinde tamamlanan bu diziler yeniden oynatılarak doğrulanır. Arama aynı tahta/zemin/RNG durumuna ulaştığında daha yüksek puanı korur. Bölüm kabul sınırlarını geçemeyen adaylar sessizce yayımlanmaz. Veriler, 10 bölümün tamamı doğrulandıktan sonra yazılır.

Rastgele geçerli hamle denemeleri kaba zorluk kontrolüdür; insan oyun testinin veya strateji kanıtının yerine geçmez. Hamle bütçeleri ve zemin yerleşimi sonraki oynama deneyimiyle ayarlanabilir.

## Dokunma ve animasyon güvenilirliği

Tahta sabit SVG üzerinde pointer capture kullanır. Parmağın aynı taş üzerindeki küçük kayması takası iptal etmez; sürükleme bırakılan hücreye göre değerlendirilir. İnce SVG boşluklarında sınırlı dokunma toleransı vardır.

Oyun sonucu animasyondan önce tek kez hesaplanıp kaydedilir. Sunum hata verse bile kontroller açılır; toplam süre 1 saniyeyle sınırlıdır. Uzun zincirlerin önemli dalgaları gösterilirken bütün oyun dalgaları hesaplanır. Animasyonu geç düğmesi veya tahtaya dokunmak sonuca geçer. Yeniden başlatma ve açık bölüm seçimi sunumu iptal eder; eski beklemeler yeni tahtayı değiştiremez. Sekme gizlenince sunum tamamlanır.

Destekleyen tarayıcılarda ipucu Web Worker'da aranır. İşçi açılamazsa kısa süre ve tek derinlikle yerel aramaya dönülür. Hamle/tahta değişince eski ipucu sonuçları iptal edilir. Kaydedilmiş durumlar hamle geçmişi tekrar oynatılarak doğrulanır.

## Kayıt ve sürüm geçişi

Kayıtlar `hexrota-match-v4` anahtarındadır. Önceki eşleştirme sürümlerindeki tamamlanan bölümler, seçili bölüm ve ses tercihi korunur; değişen kurallar nedeniyle mevcut tahta yeni başlangıçla açılır. Önceki anahtarlara dokunulmaz. İlk rota oyununun kazanımları eşleştirme bölümlerini otomatik açmaz.

## Çalıştırma ve dosyalar

Derleme veya sunucu tarafı kod gerekmez. `dist/` dizinini statik olarak sun. Örneğin yerel geliştirmede `python3 -m http.server 8000 --directory dist`.

- `dist/levels.js`: Başlangıçlar, tohumlar, hamle bütçeleri ve doğrulanmış çözümler.
- `dist/engine.js`: DOM'dan bağımsız eşleştirme, kontrollü yenileme, düşüş, zincirler, puan ve zemin.
- `dist/app.js`: Giriş kontrolleri, iptal edilebilir sunum, arayüz, yerel kayıt ve ses.
- `dist/hint-worker.js`: Giriş ve çizim akışından ayrı çalışan ipucu araması.
- `dist/style.css`: Duyarlı tasarım ve azaltılmış hareket desteği.
- `generate-levels.cjs`: Tekrarlanabilir bölüm üretimi, çözüm araması ve kabul denetimleri.
- `balance-report.json`: Sabit deneme politikalarıyla ölçülen kaba zorluk ve zincir istatistikleri.

Eski `/test.html` bağlantısı güncel oyuna yönlenir. Ayrı deneme oyunu bulunmaz.

R: aynı bölümü yeniden başlat; H: ipucu; Enter/Space: taş seç; ok tuşları: komşu taşa odaklan. İlerleme yalnızca mevcut tarayıcının localStorage alanında saklanır.

## Kontroller

Node.js 22.22.2+ veya 24.15.0+ kullan. `npm install` ardından `npm test`. Üretimde harici bağımlılık veya font servisi kullanılmaz; jsdom yalnızca geliştirme testidir.

Testler üç ekseni, geçersiz takasta durumun korunmasını, kesişimlerin tek sayılmasını, çift zemini, düşüşü, kontrollü yenilemeyi, zincirleri, karıştırmayı, ipucunu, son hamlede kazanmayı, kaybetmeyi ve kayıt doğrulamayı kapsar. On bölüm DOM üzerinden oynanıp açılır. Gerçek pointer olaylarıyla parmak kayması, capture/iptal, animasyon hatası, süre sınırı, sekme değişimi, eski zamanlayıcılar ve Worker hataları kontrol edilir. DOM testleri fiziksel cihaz ve görsel tarayıcı testinin yerine geçmez.
