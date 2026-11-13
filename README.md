# Hexrota

Telefon ve masaüstü için Türkçe altıgen sayı bulmacası. İlk 10 bölüm, doğrulanmış çözüm rotaları, sürükle/dokun kontrolleri, geri alma, bağlama göre ipucu, ses ve yerel ilerleme kaydı içerir.

## Oynanış

Herhangi bir altıgenden başla. Yalnızca son taşın komşusuna ilerle. Her ziyaret, taşın değerini toplama ekler. Normal taşlar bir, `2×` taşlar en fazla iki kez kullanılabilir. Kazanmak için bütün taşları en az bir kere ziyaret et ve hedef toplamı tam tuttur.

Bölümler sırayla açılır. Çift kullanım üçüncü bölümde başlar. Tahta 7 taştan 23 taşa, çözüm rotası 7 hamleden 27 hamleye büyür. İlerleme yalnızca mevcut tarayıcıdaki localStorage'da saklanır. Z: geri al; R: yeniden başla; H: ipucu. Taşlar klavyeyle de seçilebilir.

## Çalıştırma

Derleme veya sunucu tarafı kod gerekmez. `dist/` dizinini statik olarak sun. Örneğin yerel geliştirmede `python3 -m http.server 8000 --directory dist`.

- `dist/levels.js`: Bölüm verileri ve bilinen çözümler.
- `dist/engine.js`: DOM'dan bağımsız kurallar ve süre sınırı olan ipucu araması.
- `dist/app.js`: Arayüz, giriş kontrolleri, kayıt ve ses.
- `dist/style.css`: Duyarlı tasarım ve azaltılmış hareket desteği.

## Kontroller

Node.js 22.22.2+ veya 24.15.0+ kullan. `npm install` ardından `npm test`. Oyun üretimde hiçbir harici bağımlılık veya font servisi kullanmaz; jsdom yalnızca geliştirme testidir.

Testler bütün çözüm rotalarını, toplamları, komşuluğu, kullanım sınırlarını, ipuçlarını, kayıt geri yüklemeyi ve 10 bölümün DOM üzerinden oynanıp açılmasını doğrular. DOM testi görsel tarayıcı ve fiziksel cihaz testinin yerine geçmez.
