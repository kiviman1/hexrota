# Hexrota — eşleştir, alanı yeşert

Telefon ve masaüstü için Türkçe altıgen match-3 bulmacası. İlk 10 bölüm, doğrulanmış çözüm dizileri, sınırlı hamleler, dokunma/sürükleme kontrolleri, kalıcı yeşil zemin, bağlama göre ipucu, ses ve yerel kayıt içerir.

## Oynanış

İki komşu taşı değiştir. Altıgenin üç düz ekseninden birinde aynı sayıdan en az üçü yan yana gelirse eşleşir. Eşleşen taşların değerleri puana eklenir; taşlar silinir, sütundaki üst taşlar aşağı düşer ve boşluklara yeni sayılar gelir. Eşleşme oluşturmayan takas tamamen geri döner ve hamle harcamaz. Bir geçerli takas ve onun bütün zincirleri tek hamle tüketir.

Her eşleşme, altındaki sabit zemini boyar. Zemin ilerlemesi taşlarla birlikte düşmez. Üçüncü bölümden itibaren bazı zeminler iki ayrı eşleşme dalgası gerektirir. Kazanmak için hamleler tükenmeden **hedef puana ulaşmak veya onu aşmak** ve **bütün zemini yeşertmek** gerekir. Son hamlede iki hedefi tamamlamak da kazandırır.

Geçerli takas kalmazsa sayılar otomatik karıştırılır; puan, zemin ilerlemesi ve kalan hamleler korunur. Her bölüm sabit bir başlangıç ve deterministik yenileme tohumu kullanır; yeniden başlatmak aynı bulmacayı verir. Gerçekleştirilen eşleşmelere göre tüketilen yeni sayılar değişebilir. Sınırsız geri alma kaldırılmıştır; yeniden deneme bölümün tamamını sıfırlar.

## Bölüm algoritması

1. Eşleşmesiz ve en az iki geçerli takası olan başlangıç tahtası üret.
2. Takasları, düşüşleri ve bütün zincirleri aynı motorla simüle et.
3. Sınırlı genişlikte aramayla tüm zemini boyayan bir çözüm bul.
4. Çözüm puanından hedefi ve çözüm uzunluğundan hamle bütçesini belirle.
5. Çözümü tekrar oynatıp doğrula; sabit tohumlu 60 rastgele geçerli hamle denemesiyle kaba zorluk kontrolü yap.

Tahtalar 19'dan 37 altıgene büyür; hamle bütçeleri 8–9'dur. Çift zemin ve sayı çeşitliliği artar. Kayıtlar, tahta ve rastgele sayı üretici durumu dahil, hamle geçmişi tekrar oynatılarak doğrulanır. Önceki rota oyununun kazanımları yeni eşleştirme bölümlerini otomatik açmaz; eski kayıt anahtarına dokunulmaz.

Rastgele deneme sonucu bir insan oyun testi değildir. Başlangıçlar çözülebilir olsa da hamle bütçeleri ve zincir sıklığı sonraki oyun testleriyle ayarlanmalıdır. İlk prototipte hedef sayıya tam eşitlik yerine puan eşiği kullanılır; zorunlu zincirler iyi bir hamleyi cezalandırmaz.

## Çalıştırma ve dosyalar

Derleme veya sunucu tarafı kod gerekmez. `dist/` dizinini statik olarak sun. Örneğin yerel geliştirmede `python3 -m http.server 8000 --directory dist`.

- `dist/levels.js`: Sabit başlangıçlar, tohumlar, hamle bütçeleri ve çözümler.
- `dist/engine.js`: DOM'dan bağımsız eşleştirme, düşüş, zincirler, puan, zemin ve ipucu.
- `dist/app.js`: Giriş kontrolleri, animasyon, arayüz, yerel kayıt ve ses.
- `dist/style.css`: Duyarlı tasarım ve azaltılmış hareket desteği.
- `generate-levels.cjs`: Tekrarlanabilir bölüm üretimi ve çözüm araması.

R: aynı bölümü yeniden başlat; H: ipucu; Enter/Space: taş seç; ok tuşları: komşu taşa odaklan. İlerleme yalnızca mevcut tarayıcının localStorage alanında saklanır.

## Kontroller

Node.js 22.22.2+ veya 24.15.0+ kullan. `npm install` ardından `npm test`. Üretimde hiçbir harici bağımlılık veya font servisi kullanılmaz; jsdom yalnızca geliştirme testidir.

Testler üç eşleşme eksenini, kesişimlerin tek sayılmasını, çift zemini, geçersiz takasın durum değiştirmemesini, düşüşü, zincirleri, deterministik yenilemeyi, karıştırmayı, ipucunu, son hamlede kazanmayı, kaybetmeyi, kayıt doğrulamayı ve 10 bölümün DOM üzerinden oynanıp açılmasını kapsar. DOM testi görsel tarayıcı ve fiziksel cihaz testinin yerine geçmez.
