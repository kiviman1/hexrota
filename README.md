# Hexrota — eşleştir, alanı yeşert

Telefon ve masaüstü için Türkçe altıgen match-3 bulmacası. İlk 10 bölüm, doğrulanmış çözüm dizileri, sınırlı hamleler, dokunma/sürükleme kontrolleri, kalıcı yeşil zemin, bağlama göre ipucu, ses ve yerel kayıt içerir.

## Oynanış

İki komşu taşı değiştir. Altıgenin üç düz ekseninden birinde aynı sayıdan en az üçü yan yana gelirse eşleşir. Eşleşen taşların değerleri puana eklenir; taşlar silinir, sütundaki üst taşlar aşağı düşer ve boşluklara yeni sayılar gelir. Eşleşme oluşturmayan takas tamamen geri döner ve hamle harcamaz. Bir geçerli takas ve onun bütün zincirleri tek hamle tüketir.

Her eşleşme, altındaki sabit zemini boyar. Zemin ilerlemesi taşlarla birlikte düşmez. Üçüncü bölümden itibaren bazı zeminler iki ayrı eşleşme dalgası gerektirir. Kazanmak için hamleler tükenmeden **hedef puana ulaşmak veya onu aşmak** ve **bütün zemini yeşertmek** gerekir. Son hamlede iki hedefi tamamlamak da kazandırır.

Geçerli takas kalmazsa sayılar otomatik karıştırılır; puan, zemin ilerlemesi ve kalan hamleler korunur. Her bölüm sabit bir başlangıç ve deterministik yenileme tohumu kullanır; yeniden başlatmak aynı bulmacayı verir. Gerçekleştirilen eşleşmelere göre tüketilen yeni sayılar değişebilir. Sınırsız geri alma kaldırılmıştır; yeniden deneme bölümün tamamını sıfırlar.

## Özel taşlar

Halka, oyuncunun kurduğu ilk eşleşmede düz 4'lüden doğar; kendi hücresini ve altı komşusunu temizler. Filiz, düz 5'li veya iki eksende kesişen üçlülerden doğar; eksik zemine doğru en fazla üç adımlık bitişik bir yol açar (kendisi dahil en fazla dört hücre). Filiz'in yeri önemlidir: takastan sonraki konumundan çalışır. Seçili taşın kesikli vurgusu mevcut konumdaki etki örneğidir.

Özel taşı herhangi bir komşusuyla değiştirmek onu çalıştırır ve bir hamle tüketir; ayrıca üçlü yapmak gerekmez. Eşleşme veya başka bir gücün etkisi de özel taşı çalıştırır. İki özel taş değişirse iki etki birleşir. Aynı dalgada her hücre bir kez puan ve zemin hasarı alır; her özel taş en fazla bir kez tetiklenir.

Her takas en fazla bir özel taş üretir. Yeni taş yalnızca oyuncunun ilk doğal eşleşmesinden doğar; devam eden zincirler ve güçlerin temizlediği hücreler yeni özel taş üretmez. Doğum hücresi numarasını korur ve zeminini bir kat boyar; yeni özel taş bu dalgada çalışmaz. Güçler sayılarla birlikte düşer; rastgele doldurmada güç üretilmez.

Halka 3., Filiz 6. bölümde tanıtılır. Bu tanıtım tahtalarında denenebilecek bir özel taş başlangıçta bulunur. Bütün 10 bölüm bu mekaniklerle yeniden çözümlenip doğrulanmıştır.

## Dokunma ve animasyon güvenilirliği

Tahta sabit SVG üzerinde pointer capture kullanır. Parmağın aynı taş üzerindeki küçük kayması seçim veya takası iptal etmez; sürükleme bırakılan hücreye göre değerlendirilir. İnce SVG boşluklarında yakın hücre için sınırlı dokunma toleransı vardır.

Oyun sonucu animasyondan önce tek kez hesaplanır ve kaydedilir. Sunum, hata verse bile kontrolleri açan bir `finally` bloğu ve toplam 1 saniyelik sınırla çalışır. Uzun zincirlerin önemli dalgaları gösterilir; bütün oyun dalgaları doğru hesaplanır. Animasyonu geç düğmesi veya tahtaya dokunmak sunumu sonuca taşır. Yeniden başlatma ve açık bölüm seçimi animasyonu iptal edebilir; eski beklemeler yeni tahtayı değiştiremez. Sekme gizlenince sunum tamamlanır.

Destekleyen tarayıcılarda ipucu araması Web Worker'da çalışır. İşçi açılamazsa kısa süre ve tek derinlikle yerel aramaya dönülür. Eski ipucu sonuçları tahta/hamle değişince iptal edilir.

## Bölüm algoritması

1. Eşleşmesiz ve en az iki geçerli takası olan başlangıç tahtası üret.
2. Takasları, düşüşleri ve bütün zincirleri aynı motorla simüle et.
3. Sınırlı genişlikte aramayla tüm zemini boyayan bir çözüm bul.
4. Çözüm puanından hedefi ve çözüm uzunluğundan hamle bütçesini belirle.
5. Çözümü tekrar oynatıp doğrula; sabit tohumlu 60 rastgele geçerli hamle denemesiyle kaba zorluk kontrolü yap.

Tahtalar 19'dan 37 altıgene büyür; hamle bütçeleri 7–9'dur. Çift zemin ve sayı çeşitliliği artar. Kayıtlar, tahta ve rastgele sayı üretici durumu dahil, hamle geçmişi tekrar oynatılarak doğrulanır. Önceki rota oyununun kazanımları eşleştirme bölümlerini otomatik açmaz. Eşleştirme sürüm 2’den geçişte tamamlanan bölümler ve ses tercihi korunur; özel taşlar için değişen mevcut tahta yeni başlangıçla açılır. Yeni kayıtlar ayrı sürüm 3 anahtarında tutulur; eski anahtarlara dokunulmaz.

Rastgele deneme sonucu bir insan oyun testi değildir. Başlangıçlar çözülebilir olsa da hamle bütçeleri ve zincir sıklığı sonraki oyun testleriyle ayarlanmalıdır. İlk prototipte hedef sayıya tam eşitlik yerine puan eşiği kullanılır; zorunlu zincirler iyi bir hamleyi cezalandırmaz.

## Çalıştırma ve dosyalar

Derleme veya sunucu tarafı kod gerekmez. `dist/` dizinini statik olarak sun. Örneğin yerel geliştirmede `python3 -m http.server 8000 --directory dist`.

- `dist/levels.js`: Sabit başlangıçlar, tohumlar, hamle bütçeleri ve çözümler.
- `dist/engine.js`: DOM'dan bağımsız eşleştirme, düşüş, zincirler, puan, zemin ve ipucu.
- `dist/app.js`: Giriş kontrolleri, sınırlı ve iptal edilebilir sunum, arayüz, yerel kayıt ve ses.
- `dist/hint-worker.js`: Giriş ve çizim akışından ayrı çalışan ipucu araması.
- `dist/style.css`: Duyarlı tasarım ve azaltılmış hareket desteği.
- `generate-levels.cjs`: Tekrarlanabilir bölüm üretimi ve çözüm araması.

R: aynı bölümü yeniden başlat; H: ipucu; Enter/Space: taş seç; ok tuşları: komşu taşa odaklan. İlerleme yalnızca mevcut tarayıcının localStorage alanında saklanır.

## Kontroller

Node.js 22.22.2+ veya 24.15.0+ kullan. `npm install` ardından `npm test`. Üretimde hiçbir harici bağımlılık veya font servisi kullanılmaz; jsdom yalnızca geliştirme testidir.

Testler üç eşleşme eksenini, kesişimlerin tek sayılmasını, çift zemini, geçersiz takasın durum değiştirmemesini, düşüşü, zincirleri, deterministik yenilemeyi, karıştırmayı, ipucunu, son hamlede kazanmayı, kaybetmeyi, kayıt doğrulamayı ve 10 bölümün DOM üzerinden oynanıp açılmasını kapsar. Ayrıca gerçek pointer olaylarıyla parmak kayması, capture/iptal, animasyon hatası, süre sınırı, arka plana geçiş, eski zamanlayıcının etkisiz kalması, Worker hataları ve özel taşların görünümleri test edilir. DOM testi görsel tarayıcı ve fiziksel cihaz testinin yerine geçmez.
