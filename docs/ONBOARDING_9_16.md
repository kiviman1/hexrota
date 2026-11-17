# Hexrota 9.16 — İlk oynayış ve öğrenme

Başlangıç `main` `b078da49` (PR #38 sonrası), özellik dalı `feature/hexrota-first-play-9-16`.

9.16'nın amacı oyuncunun ilk gerçek takası kendi eliyle yapmasını, sonucunu görmesini ve sonraki adımda tek yeni fikirle karşılaşmasını sağlamaktır. Bu çalışma T1/T2'nin mevcut oyununun sunumunu düzenler. Ayrı bir prova tahtası, otomatik oynayan motor veya yeni malzeme/ödül kuralı oluşturmaz.

Bu belgenin araştırma bölümü 17 Kasım 2026'da resmi açık kaynaklardan doğrulandı. Aşağıdaki insan gözlemi protokolü **henüz uygulanmış değildir**; katılımcı, başarı yüzdesi, görüşme alıntısı veya insan testi sonucu raporlanmaz. Sözleşmedeki süreler ve metinler aşağıda verilir; otomatik test kanıtları yalnız gerçek koşumlar tamamlandığında eklenir.

## Kaynaklar ve çıkarım sınırı

Yalnız resmi yardım yazılarının metni incelendi. Rakiplerin uygulaması oynanmadı; bir ilk-oynayış videosu izlenmiş veya güncel bütün sürümlerin ekran dizisi doğrulanmış gibi bir iddia yoktur. Forumdaki oyuncu/moderatör mesajları, reklamlar ve üçüncü taraf çözüm videoları bu tablodaki ürün gerçeğinin kanıtı olarak kullanılmadı. Rakip sanat, ekran, karakter veya metin kopyalanmadı.

Bütün kaynakların erişim tarihi **2026-11-17 (UTC)**. Sayfalarda kalıcı mutlak yayın tarihi gösterilmiyorsa yayın tarihi bilinmiyor olarak ele alındı; değişken “Last Updated: …” etiketleri tahmini bir takvim tarihine çevrilmedi.

| Resmi kaynak | Kaynakta doğrulanan bilgi | Hexrota için tasarım çıkarımı |
| --- | --- | --- |
| [King — Controls: how to switch and match candies](https://candycrush.zendesk.com/hc/en-us/articles/360000750278-Controls-how-to-switch-and-match-candies) | İki şekeri yer değiştirerek üç veya daha fazlasını bir çizgide eşleştirme; dokunup sürükleme; eşleşenlerin temizlenmesi ve yenilerinin düşmesi anlatılır. | İlk çağrı soyut bir kural paragrafı yerine gerçek iki taş üzerindeki tek eylemi anlatsın. Sonuç gösterildikten sonra düşüş/yenilenme açıklansın. Bu bir çıkarımdır; sayfa rakibin gerçek öğretici adım zamanlarını kanıtlamaz. |
| [Dream Games — How do I play Royal Match?](https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/3-how-do-i-play-royal-match/) | Bölüm hedeflerinin sol üstte, kalan hamlenin sağ üstte gösterildiği; hedefler bitmeden hamleler tükenirse bölümün kaybedildiği açıklanır. | Hedef ve hamle gösterildiğinde gerçek HUD verisinden gelsin. İlk ekrana bütün kurallar yüklenmesin; ilgili hedef, oyuncu onu kullanacağı anda vurgulansın. T1'in ilk adımındaki sadeleştirme bizim seçimimizdir; bunun ilk kez oynayanları daha iyi öğrettiği bu kaynaktan ölçülmüş değildir. |
| [Playrix — How do I play match-3 levels?](https://playrix.helpshift.com/hc/en/14-homescapes/faq/1087-how-do-i-play-match-3-levels/) | Match-3 bölümlerinin hikâyeyi ilerlettiği; hedeflerin panelde bulunduğu, üç veya daha çok aynı tür parça ve sınırlı hamle ile oynandığı anlatılır. | Tavik ve kümes, gerçek hamlenin anlamını desteklesin. İlk takastan önce ayrı bir hikâye/eşya sistemi öğrenmek zorunlu olmasın. Sayfa, Homescapes'in ilk ekranlarını veya otomatik kapanma sürelerini doğrulamaz. |
| [King — Where can I find my settings and account options?](https://candycrush.zendesk.com/hc/en-us/articles/39931244875933-Where-can-I-find-my-settings-and-account-options) | Güncel yardım yazısı eski ana menü/Play adımının kaldırıldığını ve haritaya doğrudan geçildiğini; bunun başlangıçtan bir adım çıkardığını söyler. | Başlamadan önce gereksiz bir açıklama/önizleme penceresi eklememek makul bir yönelimdir. Hexrota'nın mevcut tek **Başlayalım** davetini kaldırmak veya rakibin haritasını kopyalamak bu kaynağın gereği değildir. |

Bu kaynaklar **4 saniyenin en iyi bekleme süresi olduğunu**, otomatik geri bildirimin öğrenmeyi artırdığını, belirli bir retention oranını veya rakiplerin aynı davranışı kullandığını göstermez. **4 saniyelik öğretici beklemesi ve kısa geri bildirimin otomatik kapanması, 9.16'nın kendi tasarım gereksinimleridir.** Etkileri kendi testleri ve ileride gerçek yeni oyuncu gözlemiyle değerlendirilir.

Rakipler renk/tür üzerinden anlatır. Hexrota'da kanonik eşleşme **aynı sayıların gerçek altıgen eksende bir çizgi oluşturmasıdır**. Renkler destekleyicidir; kare tahtanın yatay/dikey kuralı veya birbiriyle temas eden herhangi üç hücre mantığı aktarılmaz. Bu sürümün ilk dersine rakip booster, özel şeker veya ekonomi kuralları eklenmez.

## Akış ilkeleri

1. İlk kullanılabilir ekranda tek açık eylem bulunur. Oyuncu karakter animasyonunun bitmesini beklemeden gerçek T1'e başlayabilir.
2. Her çağrı tek hareket ister. Parlayan taş ve yön, metni gerçek hücreye bağlar; oyuncunun hem metin hem uzun kural listesi ezberlemesi gerekmez.
3. Önce eylem, sonra onun gerçek sonucu gösterilir. Puan/zemin geri bildirimi ancak başarılı kanonik kaydın sonucudur.
4. Yeni kavramlar gerçek eylemle sırayla gelir: T1'de takas, ardından kalıcı yeşil zemin; T2'de noktalı zemin, gerçek ilk vuruş sonrası ikinci kat, sonra puan ve en son puan ile zeminin birlikte tamamlanması. Zincir açıklaması yalnız gerçek zincirden sonra görünür.
5. Bekleme yardımı pasiftir. T1'in ilk adımı bir kez hemen sonlu gösterim alır; sonraki adımlarda oyuncunun kendi denemesine yer açılır ve 4 saniye uygun boşta kalma sonrasında sonlu gösterim yapılabilir. Hiçbiri oyuncu yerine takas yapmaz.
6. Sonuç kartı, başarılı kayıt ve sunumun bitişinden sonra 900 ms görünür. Giriş açıktır: tahtaya dokunmak kartı kapatır ve olağan seçimi gerçekleştirir. Otomatik kapanma, “oyuncu anladı” kanıtı değildir; insan gözlemi bunun için ayrıdır.
7. Dokunarak iki taş seçme ile sürükleme aynı gerçek giriş adaptöründe kalır. Bir yöntemle başarı, diğerini kullanmadığı için hata sayılmaz.
8. Mola, gezinme, arka plan veya yeni deneme eski gösterimi/geri bildirim callback'ini geçersiz kılar. Görsel eksikliği oyunu durdurmaz.

Bunlar Hexrota için tasarım kararlarıdır; rakiplerin aynı mikro akışı kullandığı iddiası değildir.

## Kısa Türkçe çağrılar

Aşağıdaki metinler `dist/onboarding-policy.js` içindeki v2 izdüşümündendir. Başlık ve açıklama aynı anda farklı iki görev istemez. “Hemen”, “sadece”, “çok kolay” gibi baskı veya başarı vaadi veren ekler kullanılmaz. İzdüşüm gerçek bölüm kimliği, tur ve `ready`/`result`/`busy` evresinden hesaplanır; ayrı bir ders ilerleme kaydı yoktur.

| Adım | Tek eylem çağrısı | Sonuçta verilecek tek yeni bilgi |
| --- | --- | --- |
| T1 / 1 | “2’yi 1’e kaydır.” / “Ya da ikisine sırayla dokun.” | “Yeşil zemin kalır.” / “Şimdi bir üçlü daha bul.” |
| T1 / 2 | “Sıra sende: bir üçlü bul.” | “Biraz daha yeşerdi.” / “Son iki yeri de yeşert.” |
| T1 / 3 | “Son iki yeri yeşert.” | “İlk alan yeşerdi!” |
| T2 / 1 | “Noktalı yeri yeşert.” | “Bir eşleşme daha gerekiyor.” / “Noktalı yerde bir nokta kaldı.” |
| T2 / 2 | “25 puana ulaş.” | “Yeni taşlar da eşleşti!” / “Ek hamle harcamadın. Hedefin 25 puan.” |
| T2 / 3 | “25 puana ulaş.” | “Puan tamam; son yeri yeşert.” |
| T2 / 4 | “Puan tamam; son yeri yeşert.” | “Görev tamam!” / “Puanın yeterli ve her yer yeşil.” |

Yanlış/rehber dışı girişte kısa ve eyleme dönük dil kullanılır: örneğin “Bu iki taşı deneyelim.” Kullanıcıya hata etiketi yapıştırılmaz. İlk ekranda puan, zemin, çift kat, zincir, para ve inşa aynı açıklama içinde verilmez.

## Korunacak kanonik sözleşme

T1/T2'nin mevcut `classic-v4` motoru, altıgen koordinatları, başlangıç sayıları, seed'i, hamle bütçesi ve hedefi değişmez. Görsel sadeleştirme bu verileri değiştiren yeni bir öğretici motor değildir.

| Öğretici | Değişmeyen gerçek veri |
| --- | --- |
| T1 / `learn-1` | 7 hücre; seed `31676`; 5 hamle; hedef 15; yol `[[4,3],[0,3],[3,5]]`; son durum 18 puan / 7 yeşil hücre |
| T2 / `learn-2` | 9 hücre; seed `512`; 6 hamle; hedef 25; yol `[[2,1],[5,7],[2,1],[2,1]]`; hücre 0 ve 4 çift kat; son durum 30 puan / 9 yeşil hücre |

| Kesinleşmiş adım | Puan | Yeşil hücre | Zincir dalgası | Kalan hamle |
| --- | --- | --- | --- | --- |
| T1 / 1 | 6 | 3 / 7 | 1 | 4 |
| T1 / 2 | 9 | 5 / 7 | 1 | 3 |
| T1 / 3 | 18 | 7 / 7 | 1 | 2 |
| T2 / 1 | 3 | 2 / 9 | 1 | 5 |
| T2 / 2 | 18 | 7 / 9 | 2 | 4 |
| T2 / 3 | 27 | 8 / 9 | 1 | 3 |
| T2 / 4 | 30 | 9 / 9 | 1 | 2 |

T1'in sade hedef anlatımı puan koşulunu motordan silmez; mevcut veride son eşleşme iki koşulu da karşılar. T2'de 27 puan / 8 yeşil hücre durumu, yalnız puanın yetmediğini göstermeye devam eder.

- Mevcut snapshot/profil sürümleri, Attempt ID'leri, RNG ve geçmiş korunur. Yeni politika yalnız aşağıda tanımlanan isteğe bağlı profil alanıdır.
- `guideAcks` içindeki mevcut `0:1`, `1:1`, `1:3` onayları geri yüklenebilir kalır. **V2 ilerlemek için bunları okumaz ve yeni bir onay üretmez; yeni T1/T2 denemesine girişte mevcut geçerli onayları da silmez.** Otomatik kapanış hiçbir kayıt yazmaz; hamle, hikâye seçimi veya onay değildir.
- Öğretici turundan türetilen tarihsel sayaç değerleri değişmez. V2 bunları **“Kümes hikâyesi n/total”** etiketiyle gösterir; erişilebilir adı dekoratif hikâye ilerlemesi olduğunu belirtir. Legacy **Tahta 3/3** ve **Çivi 4/4** metinlerini korur. Hiçbiri 9.14'ün gerçek malzeme sayaçları/arzı yerine geçmez.
- İlk gerçek T2 kazanımının tekil **20 Altını** korunur. Tekrar, Atla veya görsel gösterim yeni hoş geldin ödülü vermez. Kampanya ödülü kendi mevcut işleminde kalır.
- İlk açılış yeni oyuncu uygunluğundan türetilir; bozuk kayıt yeni oyuncu diye yorumlanmaz. Geçerli eski oyuncu kayıtları zorla öğreticiye döndürülmez.
- Mevcut normal, flow, material ve story geliştirme kayıtları kendi ad alanlarında kalır. Araştırma için kullanıcının gerçek kaydı sessizce sıfırlanmaz.

## Sürümlü kayıt ve kapsam

`game.onboarding` isteğe bağlıdır ve varsa tam olarak `{version:'onboarding-v1'}` veya `{version:'onboarding-v2'}` biçimindedir. Fazladan alan, açık `null`, bilinmeyen sürüm, accessor veya geçersiz nesne reddedilir. Zaman damgası, adım numarası, “öğrendi” bayrağı veya ikinci bir ilerleme günlüğü saklanmaz.

| Yüklenen kayıt / kapsam | Sonuç |
| --- | --- |
| Seçili kapsamda gerçek oyun kaydı hiç yok ve normal ilk-oynayışa uygun | Yeni oyun ve enerji kaydıyla aynı işlemde `onboarding-v2` oluşturulur. |
| Mevcut kayıtta alan yok; kayıt boş, kısmi veya tamamlanmış olabilir | Alan **yok kalır** ve legacy davranışı sürer. Kendiliğinden v1 veya v2 eklenmez. |
| Açık, geçerli `onboarding-v1` | Legacy davranış korunur. |
| Açık, geçerli `onboarding-v2` | V2 sunumu kullanılır; ilerleme gerçek motor turundan hesaplanır. |
| Flow, material veya story geliştirme kapsamı | Otomatik v2 kaydı oluşturulmaz. |
| Bozuk kayıt / yükleme sorunu | Yeni oyuncu gibi başlanmaz; mevcut hata/kurtarma akışı kullanılır. |

`HexOnboardingPolicy.normalize(value,{existingRecord,eligible})` bu ayrımı yapar; yok legacy alan için `null` döndürür. `validate`, `isV2`, `rules`, `requiresAcknowledgement` ve `project` saf, dondurulmuş sonuçlar verir. Modülün saat, storage, motor veya RNG yetkisi yoktur. `requiresAcknowledgement` yalnız legacy `step.acknowledge` davranışını taşır.

`GameSave` isteğe bağlı alanı sıkı doğrulayarak taşır. C# `SaveMigration` da aynı alanın isteğe bağlı taşıyıcısıdır; eksik eski alanı icat etmez. Native `Normalize` çağrısında alan yokluğu açık `present:false` ile taşınır; mevcut `null` yokluk sayılmaz ve doğrulamadan geçmez. Hoş geldin ekonomisindeki mevcut **`onboarding-v1` ödül sürümü ayrı bir sözleşmedir**: v2 sunumu onu yeniden adlandırmaz veya ikinci bir ödül anahtarı üretmez. İlk gerçek T2 galibiyeti aynı tekil 20 Altını verir; Atla ve tekrar ek ödül üretmez.

`?dev=first-play-9-16`, `HexOnboardingAlpha` adaptörü ile `hexrota-onboarding-9-16:` storage **ve writer-lock** öneki kullanır. Bu kapsam `developerMode` değildir; normal ilk-açılış daveti gerçekten çalışır. Normal kök URL'deki gerçekten yeni oyuncular da v2'ye uygundur. Mevcut normal ve diğer geliştirme kayıtları taşınmaz. İlerleme sıfırlama, yeniden başlatma ve tekrar politika sürümünü korur; gerçek tam veri sıfırlaması uygun kapsamda yeni v2 oyun oluşturabilir.

| Bileşen | Yetki |
| --- | --- |
| `dist/onboarding-policy.js` | Sürüm doğrulama ve gerçek tur/evreden kısa metin/kavram türetme |
| `dist/app.js` | Mevcut girdi, kanonik kayıt işlemi, geçici sonuç/idle zamanlayıcıları ve yaşam döngüsü |
| `dist/first-play.js` / `createGuide` | Güncel gerçek hücrelerin dekoratif konturu, yön ve ayrılmış alandaki el; gameplay/kayıt yetkisi yok |
| `dist/game-save.js`, `dist/session-store.js` | İsteğe bağlı sürümün sıkı taşınması, mevcut atomik game+energy işlemi ve kapsam kilidi |
| `unity/Application/OnboardingPolicy.cs`, `SaveMigration.cs`, `GameSessionController.cs` | Aynı saf sürüm/izdüşüm sözleşmesi, isteğe bağlı alan taşıma ve mevcut uygulama yaşam döngüsü; bağımsız bir gameplay motoru oluşturmaz |

Gelecekteki Unity el/koç görünümü sonucun sahibi olmaz. Gerçek takası mevcut gameplay çekirdeğine gönderir; sonuç/yardım nesneleri iptal edilebilir sunumdur. C# doğrulaması Unity Editor veya cihaz üzerinde prefab/girdi doğrulaması yerine geçmez.

## Zamanlama ve görünüm sahipliği

9.16'nın 4 saniyesi **öğretici yardımı** içindir. Kampanyanın mevcut pasif ipucu politikası farklıdır: kaynak `dist/idle-hints.js` içindeki 10 saniye ilk bekleme, 900 ms gösterim / 900 ms sessiz tekrar, 35 saniye sonraki bekleme ve 60 saniye yeni döngü aralığıdır. Eski belgelerdeki 4 saniyelik kampanya tekrar metni yeni kaynak için kullanılmaz.

Öğretici metni hemen görünür; 4 saniye, gerçek oyuncu girdisini bekleten zorunlu süre değildir. **T1 tur 0 bir kez hemen sonlu gösterim alır.** Sonraki adım için yeni bekleme noktası sonuç kartının kapanıp tahtanın eyleme hazır olmasıdır: gösterim, 900 ms sonuçtan sonra 4000 ms sessiz süre geçince başlayabilir; `SETTLE` sonrasından toplam 4900 ms'dir. Hamle üretmeyen gerçek bir dokunma ise 4000 ms'yi o etkileşimden yeniden başlatır. Sonuç okunurken geçen süre sonraki adımın boşta beklemesi sayılmaz. Gösterim için uygunluk, etkin öğretici/deneme/tur ile gerçek giriş açıklığını kullanır. Dokunma, seçim, sürükleme, gerçek hamle, açık modal, mola, gezinme, resize, gizlenme ve reset eski gösterimi temizler. Azaltılmış hareket tercihinde hareketli kopya yerine sabit vurgu/yön kullanılır.

Başarılı kanonik hamle kaydı ve sunumun `SETTLE` bitişinden sonra **900 ms** sonuç görünümü başlar. Bu süre boyunca tahta girişi açıktır; dokunma sonucu kapatıp olağan seçimi yapar. Sonuç kapanışı **storage, `guideAcks`, motor veya ödül yazmaz**. Reload gerçek `engine.turn` ile sonraki eylemi gösterir; geçmiş sonuç kartını tekrar oynatmaz.

Zamanlayıcının sahibi uygulamadır; uygunluk anahtarı Attempt ID + tur + epoch'tur. Yeni hamle/deneme, mola, modal, Home, gizlenme, resize ve reset eski callback'i geçersiz kılar. Başarısız veya devam eden yazım için zamanlayıcı başlamaz. Terminal sonuç mevcut kazanma penceresinden önce aynı kısa süreyle görünebilir; Devam/Atla yalnız anlamlı geçişte bulunur. Otomatik kapanışın kalıcı onay sayılması yasaktır.

V2 başlangıçta yalnız takas kavramını verir; puan, zemin ve hamle HUD'sı T1 tur 0'da görsel olarak ve erişilebilirlik ağacında gizlenir. Sayılar ve kontroller okunur/erişilebilir kalır. Gerçek ilk hamleden sonra ilgili HUD açılır. V2 tahta çizimi eski sonsuz el ve sayı soldurmasını çağırmamak için `guided:null` kullanır; gerçek izin verilen çiftin denetimi eski `guidedStep` verisidir.

Elin yönü mevcut eşleşen taşı göstermek için özgün çiftin **kopyasında** çevrilebilir. Kanonik `findMatches` yalnız değerlerin kopyası üzerinde takas sonrası çağrılır; sonuçlar ters takasla gerçek kaynaklara eşlenir. Bu görsel hesap authored çift, motor değerleri, geçmiş veya özgün `.gem` düğümlerini değiştirmez. Yanlış/rehber dışı giriş yalnız yumuşak bir çağrı ve sonlu gösterim üretir; hamle/RNG/geçmiş üretmez.

El, portre ve metin için gerçek hücrelerin dışında ayrılmış koç alanı kullanılır; ince kontur/yön işareti girişe engel olmaz. `HexFirstPlay.createDemo` ve legacy metin API'leri korunur. Dekoratif portre, el veya ok taşın gerçek dokunma alanını örtmez. Bir animasyon, puan/hamle/zemin/ödül veya kayıt sahibi olamaz.

## Gerçek ilk kez oyuncu gözlemi protokolü

**Durum: önerilen çalışma; henüz katılımcı alınmadı veya insan testi yapılmadı.** Otomatik browser testinin başarılı olması öğrenme veya anlaşılma başarısı olarak sunulmaz.

### Hazırlık

- İlk nitel tur için 8–12 Hexrota'yı daha önce oynamamış gönüllü planlanır. Önceki match-3 deneyimi ayrı kaydedilir; tekrar oynayan kişi “ilk kez oyuncu” örneğine alınmaz. Bu sayı istatistiksel retention/A-B iddiası üretmek için yeterli kabul edilmez.
- Katılımcının gerçek kaydını silmeden yeni, kullanılmamış bir test profili sağlanır. Gerçek cihaz, tarayıcı/sürüm, viewport ve tek/çift elle kullanım not edilir. 320×568, 390×844, 430×932 ekran sınıfları özellikle gözlenir.
- Ürün dışı açıklama verilmez. Başlangıç sözü: “Oyunu ilk kez açıyorsun; nasıl ilerleyeceğini kendin dene.” Taş numarası, hangi yöne kaydırılacağı veya üçlü kuralı söylenmez.
- İlk eylemin süresi ölçülürken zorunlu sesli düşünme istenmez; bu yönerge kendi başına süreyi değiştirebilir. Daha sonraki niyet soruları ve her yardımın zamanı ayrı kaydedilir.
- Kayıt/screenshot kullanılacaksa önceden katılımcının bilgisi ve onayı alınır. Sonuçlar P01 gibi anonim katılımcı kodlarıyla tutulur; mevcut yerel gözlem dosyası kendiliğinden bir sunucuya gönderilmez.

### Oturum sırası

| Bölüm | Moderatör ne yapar? | Kaydedilen gözlem |
| --- | --- | --- |
| İlk davet | Başlangıç cümlesinden sonra bekler. | İlk dokunulan hedef, Başlayalım'ı bulma, animasyonu bekleme sanısı, gereksiz gezinme |
| T1 ilk takas | Yön/numara söylemez. İpucu çıkmasını engellemez. | Tahta gerçekten girişe açıldıktan ilk girdiye ve ilk kesinleşen doğru takasa süre; sürükleme/iki dokunma; sistem gösterimi çıkmadan/çıktıktan sonra başarı |
| T1 sonucu ve devam | Geri bildirimdeki metni açıklamaz. | Oyuncunun neyin değiştiğine bakması, otomatik kapanışa yetişememesi, kapandığı için tekrar araması, yeşil zeminin kaldığını fark etmesi |
| T2 | Zemin/zincir/puan açıklamasını önden vermez. | Çift katın ikinci vuruşu, tek hamleli zincir, 27 puan / 8 yeşil durumuna tepkisi ve son hücreye yönelmesi |
| İlk kampanya | Bir hamle önermeden oynatır. | Rehber çift dışında gerçek bağımsız eşleşme; kampanya ipucundan önce/sonra olma; bir bölümün nasıl tamamlandığını anlatabilme |
| Kısa geri anlatım | “Bir eşleşmenin oluşması için ne gerekiyor?” ve “Bir bölüm ne zaman tamamlanıyor?” sorar. | Oyuncunun kendi sözü; sayı/üçlü/çizgi ile puan/zemin ayrımı. Yanıtın rehberden tekrarı mı yoksa yeni tahtaya aktarımı mı olduğu ayrı not edilir. |

Birisi 20 saniye ilerleyemiyorsa önce nötr “Şu an ne yapmaya çalışıyorsun?” sorusu sorulabilir; 40 saniyede hâlâ takılıysa yardım isteyip istemediği sorulur. Bu süreler çalışma protokolünün kendi önerisidir, rakiplerden doğrulanmış eşikler değildir. Verilen her açıklama ayrıca işaretlenir; yardım sonrası başarı yardımsız sonuç gibi raporlanmaz. Katılımcı durmak istediğinde oturum durur.

Başarı etiketleri ayrı tutulur:

- **İpucundan önce:** oyunun gösterimi ve moderatör yardımı olmadan doğru eylem.
- **Sistem rehberliğiyle:** ilk anlık gösterim veya sonraki 4 saniyelik gösterim/diğer oyun yardımı görüldükten sonra doğru eylem; moderatör söylemedi.
- **Moderatör yardımıyla:** doğru eylemden önce insan açıklaması verildi.

Bir doğru takas, tek başına kuralın anlaşıldığını kanıtlamaz. Özellikle rehberli çifti taklit etme ile ilk ana bölümde bağımsız eşleşme ayrı ölçülür. T1'in ilk gösterimi anlık olduğu için ilk takası “ipucundan önce” diye varsaymak doğru değildir; asıl bağımsız deneme sonraki adımlarda ve kampanyada ayrıca gözlenir. Rehber dışı ama motora göre geçerli bir giriş ile komşu olmayan takas ayrı sınıflanır. V2'nin sonuç kartı girişi kilitlememelidir; kart sırasında dokunmanın uygulanmaması gözlenirse oyuncu hatası değil, ürün sorunu olarak kaydedilir.

### Gözlem formu

| Alan | Doldurulacak değer |
| --- | --- |
| Oturum / sürüm | Tarih, commit/Preview, P01 kodu; gerçek URL ve giriş profili |
| Ön deneyim | Hiç / ara sıra / sık match-3; Hexrota geçmişi yok |
| Cihaz | Model, OS/tarayıcı, viewport, yön, tek/çift el |
| İlk davet / girdi | İlk hedef, ilk giriş zamanı, hareket türü |
| İlk doğru takas | Girişe hazır tahtadan süre; ipucundan önce/sistem/moderatör sınıfı |
| Takılma | Gerçek ekran/adım; yanlış hedef türü; gösterimi gördü mü? |
| Geri bildirim | Okunmadan kapandı mı; tekrar aradı mı; beklemeyi engel sandı mı? |
| Anlatım | Oyuncunun kendi sözleri; sayı/üçlü/çizgi ve puan/zemin ayrımı |
| Aktarım | İlk bağımsız kampanya eşleşmesi, yardım türü, bölümün bitişini açıklama |
| Moderatör | Verilen her yardımın tam sözü ve zamanı |

Buradaki form örnek veri içermez; alıntı yerlerine uydurma katılımcı cümlesi yazılmaz. Aynı kişiye iki sürümü gösterip ikisini de ilk deneyim saymak yerine, küçük karşılaştırmada farklı yeni katılımcılar deneyime göre dengelenir. Nitel örnekten retention, nedensel dönüşüm artışı veya pazar karşılaştırması çıkarılmaz.

Aynı noktada birden fazla kişinin takılması, önce çağrı/işaret/geri bildirim yerleşimini inceleme nedenidir; otomatik olarak bölüm sayılarını veya zorluğunu değiştirme gerekçesi değildir. İnsan sonucu raporlanacaksa örneklem, cihazlar, yardım tanımı ve başarısız/yarım oturumlar birlikte belirtilir.

## Otomatik kabul ve teslim durumu

Tam uygulama ve browser kabulü henüz tamamlanmamıştır. Aşağıdaki sonuç yalnız gerçekten bitmiş koşumu belirtir; araştırma ve protokol hazırlamak uygulama veya insan testi yapmakla eş tutulmaz.

| Doğrulama | Gerçek sonuç |
| --- | --- |
| `npm run test:onboarding-v2` | 76 grup/vaka geçti: 21 saf politika, 28 dekoratif rehber, 13 kayıt/scope sınırı ve 14 mounted uygulama grubu. Bu toplam native istek veya browser hamle sayısı değildir. |
| `check-onboarding-parity.cjs`, .NET 8.0.428 / C# 7.3 | 448 istek geçti: bunların içinde 195 evre izdüşümü, 25 isteğe bağlı kayıt taşıma isteği, 190 beklenen bozuk girdi reddi; ayrıca 5 gerçek `GameSession` yaşam döngüsü ve 37 authored öğretici takas denemesi vardır. Bunlar ayrı test ölçüleridir, 448'in birbirini dışlayan toplamı olarak yorumlanmaz. |
| Korunan gameplay/veri | Native koşumda motor, C# Gameplay ve iki authored öğretici dosyasından oluşan 9 korunan kaynak `b078da49` ile aynıydı; yedi kanonik hamle değişmedi. |
| Legacy `check-onboarding.cjs` | 8 eski mounted grup geçti. |
| Legacy `check-ui.cjs` | Komut exit 0; iki öğretici ve on kampanya çözümü, migration/skip/replay/girdi kontrolleri korundu. |
| Legacy `check-first-play-browser.cjs` | Gerçek Chromium 8/8 ve WebKit 8/8 geçti; geometri, render edilmiş PNG, snapshot, onay, dekoratif demo ve gerçek ödül kontrolleri korundu. |
| Eski native regresyonlar | 17/17 komut geçti; gameplay, katalog, ödül, can, ekonomi, session, komut, kurtarma, ipucu, engel, büyük tahta, malzeme ve hikâye karşılaştırmaları korundu. |
| Yeni v2 `check-first-play-v2-ui.cjs` | 14/14 mounted grup geçti; gerçek uygulama/profile akışı, yedi hamle, bozuk yazım, tekil ödül, no-op onay, lifecycle ve eski kısmi kayıtlar kapsandı. Bu JSDOM koşumu native dokunma veya gerçek yerleşim kanıtı değildir. |
| Yeni v2 browser ve tam npm | Son koşumlar bekleniyor; başarı sayısı henüz ilan edilmez. |

Native yaşam döngüleri gerçek T2 galibiyetinin mevcut `onboarding-v1` ledger'ında tekil 20 Altın vermesini, replay/reset politikasının korunmasını, v2'de mevcut üç geçerli onayın korunmasını ve son yazım başarısızlığında tahta ile ödülün geri alınmasını kapsar. Kalıcı kanıtlar: [native sonuç özeti](../reports/onboarding-9-16-native-results.json), [yeni native koşum logu](../reports/onboarding-9-16-native-logs/check-onboarding-parity.cjs.log) ve aynı dizindeki 17 tarihsel komut logu. Farklı komutların senaryo, karşılaştırma, takas ve dalga adetleri tek bir “test sayısı” olarak toplanmaz.

[Mounted uygulama raporu](../reports/onboarding-9-16-mounted-results.json), iki başlangıç ve yedi gerçek hamle sonrasındaki dokuz kanonik snapshot'ın başlangıç commit'iyle byte düzeyinde aynı olduğunu ve 11 korunan motor/gameplay/bölüm kaynağının değişmediğini kaydeder. Zamanlama için gerçek `performance.now`/`setTimeout` kullanır; can muhasebesi için mevcut sabit UTC fixture'ı ve tek bir tutulmuş WAAPI tamamlanma shim'i kapsamda açıkça belirtilmiştir.

Eski akış testleri boş fakat **mevcut** `{}` kaydıyla, politika alanı eklemeden başlar; bu, eski kullanıcı davranışının hâlâ geçerli olduğunu doğrular. Migration girdileri bu fixture ile gölgelenmez. Gerçek kayıt yokluğu ve v2 kaydı yeni testlerdedir. Eski iddialar/eşikler kaldırılmadı.

Beklenen otomatik kapsam: ilk çağrı ve sonlu anlık T1 gösterimi; sonraki adım hazır olduktan veya yeni etkileşimden sonra 4000 ms'den önce gösterim olmaması; gerçek girdide/lifecycle değişiminde iptal; başarılı kayıt + SETTLE sonrası 900 ms sonuç, açık giriş ve hiçbir otomatik onay yazılmaması; eski callback ve reload tutarlılığı; gerçek drag/iki dokunma; değişmeyen yedi T1/T2 hamlesi ve kanonik sonuçları; tekil 20 Altın; mevcut kayıtların legacy kalması, kapsamların korunması ve gerçek tam reset; azaltılmış hareket ve gerçek mobil yerleşim. Yeni kavram zamanlaması, eşik gevşetilerek veya eski motor kontrolleri kaldırılarak doğrulanmaz.

Fiziksel iPhone/Safari gözlemi, gerçek insan ilk-deneyim çalışması ve Unity Editor/IL2CPP testi yapılmış sayılmaz. Bunlar ancak gerçekten gerçekleştirildiklerinde ayrı kanıtla raporlanır.
