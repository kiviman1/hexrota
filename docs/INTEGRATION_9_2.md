# Hexrota 9.2.0 entegrasyonu

## Kaynak ve kapsam

`integration/hexrota-9.2`, `main` dalının `1adefd90db277312d562a45fa7ce8ed068fc818f` commit'inden açıldı. Aşağıdaki kaynak PR'lar yerel entegrasyon merge commit'leriyle birlikte korundu. Bu çalışma `main` dalına yayımlama veya kaynak PR'ları GitHub üzerinde birleştirme değildir.

| Kaynak PR | Kaynak head | Korunan iş |
| --- | --- | --- |
| #1 | `7d7d2feaaa67c4ed4c5a8e22b3b4da066bc2095d` | Saf C# gameplay ve gerçek derlenmiş parity |
| #2 | `3e6a4aa558ecce21df3032d3ef031a60748f24d7` | Altı yönde hareket yolu tanıma, Chromium/WebKit testleri |
| #3 | `d9462a32e9fa7b2961b7ca650b331f28141b59e9` | Görünür bilgiyle analiz ve isteğe bağlı yerel oyuncu testi |
| #4 | `2b9c7c70326f6d93d0a88c7099c98544881ffdce` | Can hakları, atomik profil ve güvenli sekme kilidi |

Birleştirme sırası C# → can/kayıt → mobil giriş → görünür analiz/yerel test oldu. Oyun motoru, T1/T2, on ana bölüm, kırk varyant, seksen sertifikalı kazanma yolu, gameplay/reward fixture'ları ve mevcut C# Rewards dosyalarının içeriği korunur. Yeni insan dengelemesi veya bölüm parametresi değişikliği yapılmadı.

## Çakışmaların çözümü

- `dist/app.js`: PR2'nin gerçek SVG koordinatlarında biriktirdiği hareket, PR4'ün işlem sınırıyla birlikte çalışır. `pointermove` kayıt yazmaz; bırakma, erişilebilirlik tıklaması ve klavye ile yapılan hamle aynı atomik akışa girer. Çoklu temas/iptal/kayıp capture korumaları korunur.
- PR3'ün gözlemleri, PR4'ün canonical profil yazımı başarıyla bitmeden bağımsız gözlem anahtarına yazılmaz. Başarısız hamle/sonuç/yeniden başlatmada gözlem durumu işlem öncesine döner. Daha sonra yalnız sunum sırasında oluşan bir kayıt hatası, önceden kaydedilmiş hamlenin gözlemini geri sarmaz.
- Oyun ve enerji tek `hexrota-profile-v2` değerinde saklanır. `hexrota-match-v5` ile `hexrota-lives-v1` uyumluluk aynaları korunur. Snapshot `classic-v4` davranışı değişmez; can v1→v2 geçişi ve v1 fixture arşivi korunur.
- Paket ve lock sürümü birlikte `9.2.0` olur. İki geliştirme bağımlılığı aynı sabit sürümlerle korunur. Dört PR'ın bütün npm komutları ve alt kontrolleri bir aradadır.
- Tek çevrimdışı shell sürümü **v21**: HTML script/CSS URL'leri, SW cache/allowlist/preload, uygulamanın hint Worker URL'si ve Worker'ın engine import'u birlikte güncellenir. `session-store.js` ile `playtest.js`, uygulamadan önce yüklenir ve çevrimdışı ön yüklenir. Güncelleme aktif oyunu kendiliğinden yeniden yüklemez.
- CI'da gameplay/UI/veri, C# reward, C# gameplay, can/kayıt Chromium, mobil Chromium/WebKit matrisi ve görünür zorluk analizi korunur. Matris dahil yedi iş vardır. Yeni birleşik native tarayıcı kontrolü mevcut can/kayıt işine eklenir; hiçbir önceki test çıkarılmaz veya soft-fail yapılmaz.

## Birleşince bulunan ve düzeltilen hatalar

Ham birleşimde canonical kayıt yazımı kota yüzünden başarısız olduğunda üç gözlem hatası yeniden üretildi: normal hamlenin, son hamledeki kaybın ve yeniden başlatma/terk/yeni denemenin günlükte kalması. Kalıcı profil doğru geri alınmasına rağmen ölçüm yanlış görünüyordu. `check-integration.cjs` bu üç durumu önce başarısız olarak gösterdi; işlem içi gözlem yazımını erteleme ve baseline geri alma düzeltmesinden sonra geçti.

Gözlem deposu oyun kaydının yetkili kaynağı değildir. Canonical oyun başarılıyken ayrı gözlem yazımı hata verebilir veya sekme iki yazım arasında kapanabilir; bu durumda ölçüm eksik olabilir. Böyle bir ölçüm hatası oyunu geri almaz ve sonuç/RNG/can değiştirmez. JSON penceresi, rıza ve kapasite sınırları [PLAYTEST_MODE.md](PLAYTEST_MODE.md) içinde açıklanır.

## Tekrarlanabilir doğrulama

```sh
npm ci
npm test
npm run test:unity-gameplay
npm run test:unity-rewards
npm run test:observable
npx playwright install --with-deps chromium webkit
npm run test:mobile-browser
HEXROTA_BROWSER=webkit npm run test:mobile-browser
npm run test:session-browser
npm run test:integration-browser
```

`npm test`, mevcut can/kayıt/öğretici/giriş/ödül/veri/denge kontrollerine ek olarak özgün dokuz yerel oyuncu testi grubunu ve yeni yedi birleşik gerçek uygulama grubunu içerir. Yeni JSDOM adaptörü yalnızca görselsiz testlerde açıkça izole oturum kullanır; üretimde gerçek Web Locks yolu korunur.

C# gameplay kontrolü 71 ortak mekanik örneği, seksen tam sertifikalı yol ve 120 ek rotada 1.913 geçerli takasın ara JSON'unu karşılaştırır. C# reward, mevcut 104 vektör ve fabrika örneğini karşılaştırır. Görünür zorluk kontrolü 1.920 gizli RNG değişimi karşılaştırması ve 17.920 oyunun raporunu yeniden hesaplar. Bunlar insan kazanma oranı değildir.

Gerçek mobil giriş kontrolleri Chromium'da kırk, WebKit'te otuz yedi senaryodur. WebKit kaydırmaları native mouse, tap'ler native dokunmayla yapılır. Can/kayıt tarayıcı kontrolü iki gerçek sayfada kilit devri ve kurtarmayı sınar. Yeni altı birleşik Chromium grubu native dokunma → canonical kayıt → gözlem → yeniden yükleme/çevrimdışı devam yolunu sınar; gerçek SW cache'i ve offline hint Worker da çalıştırılır.

Yerel sonuçlar ve değişmez kaynak özetleri [../reports/integration-9.2-validation.json](../reports/integration-9.2-validation.json) dosyasındadır. GitHub Actions ve Vercel sonucu Integration PR'ının en güncel commit kontrollerinden değerlendirilmelidir; yerel rapor uzak CI kanıtı yerine geçmez.

## Vercel ve onay sınırı

Vercel'in mevcut Git bağlantısı yalnızca `integration/hexrota-9.2` push'u için Preview oluşturur. Proje `hexrota`, hedef Preview olmalıdır; üretim alias'ı değiştirilmez. Preview ve üretim farklı origin'ler olduğu için gerçek üretim tarayıcı kayıtları Preview'a otomatik taşınmaz. Uyumluluk testleri sentetik eski kayıtlarla yapılır; kullanıcı kaydı toplanmaz.

Integration PR'ı inceleme içindir. Onay olmadan `main` push'u, PR merge, production promote veya mobil paket oluşturma yapılmaz.

## Açık sınırlar

- Fiziksel iPhone/iOS Safari, Unity cihazı ve IL2CPP/AOT doğrulaması yapılmadı. Masaüstü WebKit sonucu bu cihaz testlerinin yerine geçmez.
- Aynı origin/tarayıcı profilinde tek yazan sekme tasarlanmıştır; ikinci sekme bekler. Web Locks desteklemeyen ortam kayıtları değiştirmeden durur.
- Eski keyfi işlem kimliklerinin kesin tekilleştirme kayıtları sonlu tarayıcı kotasını doldurabilir. Kota hatası güvenli geri alınır; sınırsız fiziksel saklama garantisi yoktur.
- Kalıcı yazım tamamen kapalıyken sekme kapanırsa yeni yerel test makbuzunun teslimi garanti edilemez. Gerçek reklam/ödeme sağlayıcısı gelecekte güvenilir yeniden teslim sağlamalıdır.
- C# ipucu, varyant seçimi, uygulama deneme zarfı, can ve kalıcı saklama portları henüz bu gameplay aşamasına dahil değildir.
- Bölüm 6/9'un rahatlama rolü, 5'in varyant farkı ve 8/10'un zemin baskısı için insan testi gerekir. [DIFFICULTY_AUDIT.md](DIFFICULTY_AUDIT.md) önerileri bu entegrasyonda uygulanmadı.
