# İlk hediye ve prototipte tam veri sıfırlama

16 Kasım 2026 oyuncu isteği: ikinci öğretici sonunda görünür bir sandık/ödül ve ilk açılışı tekrar denemek için Ayarlar'dan tam sıfırlama. Bu karar önceki “öğreticiler her durumda ödülsüz” sunumunu değiştirir; kampanya tekrarı ve ödül kuralları korunur.

## Bir defalık başlangıç hediyesi

- Yalnız **gerçek hamlelerle T2 kazanıldığında** 20 Altın; 0 yıldız, 0 envanter. T1, öğretici atlama, done bayrakları ve açılışta eski başarıyı okumak kanıt değildir. Geçerli eski oyuncu T2'yi tekrar oynayıp ilk hakkını alabilir.
- Saf JS `claimWelcome`, C# `ClaimWelcome` ile aynıdır. Controller kazanımı gerçek hamlenin atomik oyun/can kaydına dahil eder; başarısız kayıt hamleyi ve Altını birlikte geri alır. Görsel sandık başarıyla kaydedilmiş kazanımı gösterir.
- Tek işlem `welcome:<campaignId>:onboarding-v1`; kind `welcome`, source `onboarding`, pricesVersion `onboarding-v1`, ilgili tutorial Attempt ID, null sayısal Level ID. Tutorial kimliği API'de string kalır. Yinelenen callback, başka tutorial Attempt ID veya normal ilerleme sıfırlama ikinci ödül vermez.
- `data/economy-config-9-5.json` içindeki opsiyonel `welcome` yapılandırması sürüm ve tutarı açıkça taşır. `onboarding-v1` tarihsel olarak 20 Altın demektir; gelecekte tutar değişirse eski kaydı yeniden hesaplamak yerine yeni sürüm gerekir. Eski config ve geçerli eski ekonomi kayıtları aynı şekilde okunur.
- Yeni ledger satırı harcanabilir bakiyenin doğrulamasına dahildir. Kampanyanın 200 Altın / 10 yıldız sınırı değişmez; başlangıç hediyesiyle toplam ilk kaynak 220 Altındır. Gerçek para, reklam veya yeni para birimi yoktur.
- T2 sonuç ekranı sandığın açılışını, +20 Altını ve “İlk bölüme başla” eylemini sunar. Açılış animasyonu ödül vermez, geciktirilmiş callback ile para yazmaz. Azaltılmış harekette sandık doğrudan açık görünür; devam düğmesi animasyonu beklemez. Tekrar oynanan ve daha önce hakkı alınmış T2 yeni sandık vaat etmez.

### Sandık sunumundaki katman düzeltmesi

Altın madalyası SVG'de sandık gövdesi ve kapaktan **sonra**, ayrı bir ön katmanda çizilir. Kapak açıldıktan sonra gövdenin içinden yükselir ve önde görünür kalır. Arka ışık halesinin maskesi sabittir; ışın dokusu kendi katmanında 24 saniyelik sürekli dönüş yapar. Bu dönüş ile ilk açılışın ölçek/fade hareketi ayrı katmanlardadır. Azaltılmış hareket modunda madalya doğrudan görünür son konumunda durur, ışınlar dönmez. Bu değişiklik yalnız sunumdur; bakiye ve ödül işlemleri değişmez.

**Eski sürüme dönüş sınırı:** Yeni `welcome` satırını tanımayan eski uygulama bu ledger'ı kabul etmez. Yeni sürüm eski kayıtları okur; geri dağıtım gerekiyorsa welcome okuma desteği korunmalıdır. Yeni snapshot, oyun kuralı veya profil zarfı icat edilmez; mevcut ekonomi işlem sözleşmesi açık sürümlü bir işlemle genişler.

## Ayarlardan tamamen yeni test profili

**Test için her şeyi sıfırla**, mevcut **Açık denemeleri sıfırla** işleminden ayrıdır. Açık veri-silme onayıyla bu tarayıcıdaki oyun/öğretici ilerlemesi, kayıtlar, deneme sayacı ve varyant geçmişi, Altın/yıldız/stok, can durumları, TEST cüzdanı ve makbuzlar, tercihler ve yerel olay/test raporları sıfırlanır. Yeni profil 5 can, 300 TEST Altını ve 0 oyun Altını/yıldız/stok ile başlar. Başlangıç hediyesi yeni test profilinde yeniden denenebilir. Bu kontrol prototipin geliştirici alanındadır; ticari sürüm için hesap/veri silme politikası ayrıca gerekir.

`SessionStore.resetForTesting` mevcut tek-yazıcı kilidi ve revision kontrolü altında **tek kanonik game+energy yazımı** yapar; revision artar. Başarısız kanonik yazım eski profili değiştirmez. Başarılı yazımdan sonra eski store revoke edilir; host `fullResetPending` ile session, oyun, lifecycle, sağlayıcı ve gözlem callback'lerini durdurur, sonra sayfayı yeniler. Eski sekme veya pagehide yeni profili eski ilerlemeyle ezemez.

Yalnız bilinen Hexrota legacy/olay/test anahtarları temizlenir. `localStorage.clear()` kullanılmaz; başka uygulamalar ve izole Balance Lab verileri korunur. Kanonik yeni profil eski mirror/legacy kayıttan migration yapılmasını engeller. Yardımcı silme/mirror tamiri başarısızsa yeni profil yine yetkilidir; ekran bu kısmi temizliği açıkça bildirir ve yeni oyunu açma seçeneği verir. PWA/kurulum önbelleği silinmez; çevrimdışı paketin yeniden indirilmesi gerekmez.

## Doğrulama ve taşınabilirlik

- `npm run test:welcome-reset`: 10 storage hata/yarış vakası ve 9 gerçek uygulama akışı.
- `npm run test:welcome-visual`: Chromium/WebKit içinde 320/390 portre ve 844 yatayda ilk/orta/son Altın piksel görünürlüğü, gerçek yükseliş, dönen ışın pikselleri, değişmeyen profil/geometri ve azaltılmış hareket kontrolü. Kanıtlar CI ekran görüntüsü artefaktlarına yazılır.
- `npm run test:welcome-reset-browser`: Chromium/WebKit'te 320/390 portre, 844 yatay ve 1280 masaüstü; görünür sandık/piksel değişimi, gerçek bakiye, vazgeçme, kayıt hatası, gerçek sayfa yenileme ve ilk açılışın yeniden oynanması.
- Ekonomi ve uygulama karşılaştırmaları C# 7.3 / .NET 8 ile gerçekten derlenir. Welcome JS/C# iş kuralıdır. Web tam sıfırlama/reload UI'si platform adaptörüdür; Unity veri-silme ekranı ve cihaz saklama adaptörü henüz yapılmadı. Unity host aynı taze DTO'ları atomik repository yazımından geçirip eski session'ı kapatmalıdır.
- Classic-v4, Snapshot4, 40 varyant, 80 kazanma rotası, can kuralları, kaydırma ve sabit tahta boyutu değişmez. PWA shell v35 yalnız bu web paketini sürümler.
- Fiziksel iPhone/Android ve Unity/IL2CPP doğrulaması yapılmış sayılmaz.
