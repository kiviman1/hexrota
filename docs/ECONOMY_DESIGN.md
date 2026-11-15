# Altın, yıldız ve envanter — 9.5

Bağlayıcı ürün kararı [ONE_TIME_PROGRESSION_ECONOMY_9_5.md](ONE_TIME_PROGRESSION_ECONOMY_9_5.md) içindedir. Bu belge önceki başlangıç Altını, öğretici ödülü ve tekrar oynama ödülü önerilerinin yerini alır. Ana kampanya doğrusal ve tek tamamlamalıdır. Bütün mevcut bölümlerin ücretsiz kazanma yolları korunur; yardım satın almak ilerleme şartı değildir.

## Uygulama aşamaları

A: kalıcı tamamlama, doğrulanmış ilk kazanma ödülü, migration, bakiye/envanter ve JS/C# oturum sınırları uygulanır. B: iki yardım komutu ve envanter harcaması; C: ikinci şans; D: botanik görünüm. B/C için saf ekonomi işlemlerinin A'da bulunması bu ürünlerin A arayüzünde kullanılabildiği anlamına gelmez. Her aşamanın gerçek doğrulaması ve PR bağımlılığı [ECONOMY_9_5_DELIVERY.md](ECONOMY_9_5_DELIVERY.md) içinde tutulur.

## Kalıcı kazanımlar

| Kaynak | İlk kazanım | Tekillik anahtarı |
| --- | ---: | --- |
| Bir ana bölümün doğrulanmış ilk kazanımı | 20 Altın + 1 yıldız | `clear:main:<sayısal Level ID>` |
| 3. bölümün ilk kazanımı | 3 Yeşil Fırça | `gift:main:3:greenBrush` |
| 6. bölümün ilk kazanımı | 3 Renk Anahtarı | `gift:main:6:colorKey` |
| Öğreticiler, kayıp, ipucu, yeniden deneme, reset | Ödül yok | Yeni hak oluşmaz |

Yeni oyun Altını sıfırdır. On bölümün toplam ilk kazanım kaynağı 200 Altın ve 10 yıldızdır. Varyant, deneme veya veri sürümü değişince yeniden hak doğmaz. Yıldız harcanamaz/satılamaz; 2/5/8/10 yıldız çiçek/bitki/ağaç/tam bahçe görünümünü açar. İlk üç ve altıncı bölüm hediyeleri yalnız bir kez verilir. Öğreticiler ücretsiz ve ödülsüz yeniden oynanır; tamamlanmış ana bölüm tekrar oynanamaz. Menü yalnız sıradaki açık ana bölümü sunar. Kampanya sonunda “Bahçeni gör / Yeni bölümler yakında” gösterilir.

## Ayrı TEST cüzdanı

Mevcut can prototipinin 300 TEST Altını `energy.testWallet` içinde kalır; oyun Altınına dönüştürülmez ve güçlendirici/kurtarma satın alamaz. Bu test can ürünleri mevcut kurallarıyla korunur: +1 can 30 TEST Altın, 5'e tamamlama 100 TEST Altın, 30 dakika sınırsız can 180 TEST Altın. Can reklamı ayrı UTC 3/gün, arada 30 dakika; kurtarma kotasıyla paylaşılmaz. Bunlar gerçek para veya canlı reklam değildir.

## Pilot harcama parametreleri

Kanonik kaynak `data/economy-config-9-5.json`; üretilen JS/C# kopyaları `sync-economy-config.cjs --check` ile doğrulanır. Fiyatlar ticari olarak kalibre edilmemiş test değerleridir.

| Ürün | Altın | Açılma / sınır | Etki |
| --- | ---: | --- | --- |
| Yeşil Fırça stoğu +1 | 70 | L3 tamamlandıktan sonra; denemede 1 kullanım | Seçili zeminden bir kat, sıfır hamle/puan; sayı ve RNG sabit |
| Renk Anahtarı stoğu +1 | 90 | L6 tamamlandıktan sonra; denemede 1 kullanım | Oyuncunun seçtiği başka izinli sayı; gerçek eşleşme/düşüş/üretim |
| İkinci şans +5 hamle | 140 | Ana bölümün gerçek son takas kaybı; denemede 1 | Aynı Attempt ID ve tahta, tam 5 hamle |
| Gönüllü TEST kurtarma reklamı | 0 | Ayrı UTC günde 2; aynı denemede 1 başarılı kurtarma | Yalnız doğrulanmış tamamlanmada +5 hamle |

Ekonomide günlük Altın farmı, mağaza zorlaması, gerçek ödeme, canlı reklam, yeni başlangıç güçlendiricisi veya +3 hamle ürünü yoktur. Gelecekte kozmetik ve doğrulanmış gerçek ödeme ancak ayrı ürün/güven sözleşmesiyle eklenebilir. Mevcut 200 Altın toplam kaynağıyla 140 Altınlık kurtarma pahalıdır; hediye stokları dışındaki yardım sıklığı pilotta ölçülmelidir. Bu sınırlılık gizli taş manipülasyonu veya zorunlu ödeme ile çözülmez.

## Eski kayıtların tanınması

Geçerli eski `done` Level ID'leri kalıcı tamamlanmış kabul edilir. Geçerli katalog ve gerçek hamle geçmişi yeniden oynatıldığında kazanmış olan arşivler, `done` bayrağı eksik olsa da tanınır. Yalnız bu kanıt için ilk ödül/hediye geriye dönük bir kez verilir. Tek başına yüksek skor bir kazanma kanıtı değildir.

Kanıtı bulunmayan eski tamamlamalar yeniden açılmaz; `pendingReviewLevelIds` olarak açıkça bildirilir. Bu durumda yıldız sayısı kapalı bölüm sayısından az olabilir. Sonradan geçerli tarihsel kanıt gelirse yalnız bekleyen ilk hak teslim edilir. Tarihsel migration yeni kazanma pop-up'ı üretmez. Bozuk veya bilinmeyen ekonomi zarfı yeni oyuncu gibi sıfırlanmaz; mevcut profil korunarak yükleme reddedilir. Bu yerel inceleme durumunun hesap/cihazlar arası destek politikası henüz kararlaştırılmamıştır.

## İşlem ve kayıt sınırı

Ekonomi `profile.game.economy` içinde sürüm 1 ledger'dır; dış profil `hexrota-profile-v2`, oyun aynası `hexrota-match-v5`, eski snapshot 4, attempt metadata 1 ve LifeState 2 değişmez. İşlem sırası ve tamamlamalar üzerinden bakiye, yıldız ve stok yeniden doğrulanır. `complete(verified:true)` yalnız hostun doğrulanmış motor sonucundan ürettiği bağlamdır; UI tarafından gönderilen bir kazanma iddiası kabulü değildir.

Önce gerçek oyun sonucu ve uygunluk doğrulanır; oyun/can/Altın/yıldız/stok/tamamlama aynı revision kontrollü profil commit'ine girer. Yalnız başarılı commit ardından sonuç ve görsel geri bildirim gösterilir. Yazma hatasında önceki geçerli profil geri yüklenir; ikinci callback aynı hak veya işlemi yeniden üretmez. İki yazıcı stale revision ile birbirini ezemez. Normal reset kalıcı ledger'ı, tamamlamaları, ödülleri, stokları ve kazanma kanıtı arşivlerini korur.

Yardımlar eski v4 geçmişine gizlenmez: sürümlü `assisted-v1` komut zarfı, klasik takas geçmişini ve yeni yardım komutlarını ayrı doğrular. Eski v4 motor kuralları değişmez. İpucu yardımdan sonra eski sertifikayı garanti diye sunamaz. Mevcut Reward Director v1, klasik hareketlerde aynen korunur; yardım akışına sahte takas veya puan girdisi üretilmez.

## Adalet, ölçüm ve açık kararlar

Ödeme geçmişi, reklam seçimi ve Altın bakiyesi üretim RNG'si veya bölüm varyantını değiştiremez. Yardımlı ve yardımsız denemeler analizde ayrılmalıdır. Ledger ekonomik kanıttır; yerel analitik başarısızlığı oyunu geri alamaz. Hiçbir olay kişisel veri veya otomatik sunucu gönderimi içermez.

Yerel JavaScript/C# ledger doğrulaması gerçek ödeme otoritesi değildir. Cihaz saati, değiştirilmiş uygulama veya tüm tarayıcı verisini elle silme karşısında sunucusuz kalıcı hesap hakkı garanti edilemez. Normal uygulama reseti ve eski UI/API yolları kapalıdır; hesap/cihaz taşıma ve tam veri silme ayrı ürün kararlarıdır. Pilot testte yardım fiyatları, tek kullanım sınırları ve gönüllü reklam sıklığı değerlendirilecek; canlı SDK, makbuz güveni ve uygulama mağazası ürünleri bu aşamada yoktur.
