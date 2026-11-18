# Telefon görünümünün Unity ile karşılaştırması

Her görselde solda telefon genişliğinde çalışan mevcut Hexrota, sağda Unity `FirstPlayable` sahnesi bulunur. İki kare de 390 × 844 pikseldir. PNG dosyalarındaki oyun görüntüleri özgün çözünürlüklerini korur.

| Ekran | Görüntüde kontrol edilen durum |
| --- | --- |
| [İlk açılış](screens/fresh.png) | Sıfır profil, Tavik’in konuşması ve ilk öğreticiye giriş |
| [Dönen oyuncunun ana menüsü](screens/returning.png) | Tamamlanmış kümes manzarası, Tavik, cüzdan, alt gezinme ve altı hamleli kayıt |
| [Bölüm haritası](screens/journey.png) | İlk öğreticiye girdikten sonra açılan haritada T1, T2 ve Bölüm 1 |
| [Bölüm 1 önizlemesi](screens/preview.png) | İlk kez açılacak bölümün 85 puan, 19 alan ve 10 hamle hedefleri |
| [İlk öğretici](screens/tutorial.png) | İlk tahta, yönlendiren el, işaretli taşlar, Tavik’in açıklaması ve beş hamle |
| [T1 galibiyeti](screens/win-0.png) | Öğreticinin geçerli takaslarıyla kazanılan ilk madalya ve T2’ye geçiş |
| [İkinci öğretici](screens/tutorial-2.png) | 25 puan, dokuz alan, altı hamle ve ilk çivi adımı |
| [T2 galibiyeti](screens/win-1.png) | İkinci öğreticinin bitişi, ödül sandığı ve 20 Altın |
| [Çanta](screens/inventory.png) | Öğretici ödülüyle Bölüm 1’e giriş, 20 Altın bakiyesi, iki yardımın açılma koşulları |
| [Kayıtlı Bölüm 1](screens/board.png) | Dördüncü tur, 66 / 85 puan, 14 / 19 yeşil alan, altı hamle |
| [Bölüm 1 galibiyeti](screens/board-won.png) | Onuncu turda 120 puan, 19 yeşil alan, 20 Altın ve bir yıldız |
| [Bölüm 1 kaybı](screens/board-lost.png) | Aynı başlangıçtan farklı son takasla 144 puan, 18 yeşil alan ve ikinci şans seçenekleri |
| [Kazanılmış Altın ile kurtarma](screens/gold-offer.png) | İlk yedi bölümü kazanan oyuncunun Bölüm 8’deki kaybında 140 Altın seçeneği |
| [Kurtarılan tahta](screens/gold-resumed.png) | 140 Altın harcanınca aynı Bölüm 8 tahtasında 69 puan ve beş yeni hamle |
| [Ayarlar](screens/settings.png) | Bölüm içinden açılan ses, müzik, ses düzeyi, animasyon ve titreşim seçenekleri |
| [Canlar](screens/lives.png) | Ana menüden açılan beş dolu can, ücretsiz öğretici ve test mağazası |
| [Mola](screens/pause.png) | Aynı kayıtlı bölümde devam, yeniden başlatma, ayarlar ve menü düğmeleri |
| [Kayıtlar](screens/records.png) | Bölüm özeti ve kaydırılabilen sonuç listesi |
| [Bahçe](screens/garden.png) | Sıfır kalıcı yıldız durumundaki çizim, ilerleme ve ilk bahçe hedefleri |

## Ölçüm

Web referansı, `main` üzerindeki `dist` uygulamasının yerel kopyasında Chromium mobil görünümüyle alındı. Unity kareleri, 6000.6.9f1 Editor ile ayrı bir çalışma kopyasından derlenen görünür Windows oyuncusunda, AMD Radeon RX 9070 XT ve Direct3D 11 ile üretildi. Oyuncunun gerçek arka plan kamerası, tahta kamerası ve uGUI Canvas'ı aynı boyutta bir RenderTexture'a çizildi. Pencerelerin arka plan efekti gerçek oyun çerçevesini kullandı. Ekranlar sahnenin kendi düğme eylemleriyle açıldı.

İlk açılış ve T1 için iki uygulama boş profille başlatıldı. Kayıtlı bölüm için aynı kayıt zarfı Chrome'un geçici deposuna ve Unity'nin bellek deposuna yüklendi. Unity'de 19 hücrenin sayı ve zemin katmanları, skor, tur ve kalan hamle kayıtla karşılaştırıldı. Kişisel kayıt dosyası rapora dahil edilmedi.

İki öğretici de kendi yönlendirdiği takaslarla oynandı. Bölüm 1’de iki uygulama aynı kayıtlı tahtadan altı takas yaptı. İlk beş takas ortaktı. Son takasın değişmesi iki ayrı sonuç verdi. Altınla kurtarma denemesinde ilk yedi bölüm tarayıcıda gerçek takaslarla tamamlandı. Bu yedi ödülle kazanılan 140 Altın ve Bölüm 8’in son hamlesinden önceki kayıt Unity’ye taşındı. İki uygulama da son takastan sonra kurtarma düğmesini kullandı. Unity kontrolü 140’tan sıfıra inen bakiyeyi, sıfırdan beşe çıkan hamleyi, 69 puanı ve 29 hücrenin korunan sayı/zemin dizilerini doğruladı.

## Gözlenen farklar ve kapsam

Ana menüdeki logo ve kümes çizimleri, haritada görünen duraklar, önizleme hedefleri, iki öğreticinin yönlendirmesi ve kayıtlı tahta karşılaştırmalarda yer alıyor. Unity yazı yüzü, bazı satır sonları, çerçeve ve gölge kalınlıkları Web'den farklı. İki uygulamada da pencere açılınca alttaki oyun bulanıklaşıyor. Tarayıcıdaki odak halkaları, konfeti yerleşimi ve hareketli yönlendirme elinin yakalanan karesi farklı.

Bu görüntüler masaüstünde dikey çözünürlük kullanılarak alındı. Fiziksel bir Android veya iOS cihazındaki dokunma, güvenli alan, kare hızı, titreşim ve sistemden geri dönüş ayrı cihaz doğrulaması gerektirir.
