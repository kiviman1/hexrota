# Hexrota 9.9 — Hamlesiz tahta ve kurtarma raporu

> **9.9b takip durumu:** R-02 artık erken ve mutasyonsuz ret verir; başarılı kurtarma dolu/izinli, eşleşmesiz ve yasal takaslı olmak zorundadır. Özgün fixture değişmedi; güncel diagnostik exit 0. [BOARD_VALIDATION_9_9B.md](BOARD_VALIDATION_9_9B.md). Aşağıdaki 9.9/9.9a hata çıktıları tarihsel kanıttır.

> **9.9a takip durumu:** Bu rapor 9.9 başlangıç davranışını ve dondurulmuş fixture'ı kaydeder. Yeni canlı `grant_moves` isteği artık `no_legal_swaps` ile reddedilir; eski v1 checkpoint'i tarihsel replay ile aynen korunur. Güncel diagnostik bu ikisini ayrı gösterir ve çözülmemiş R-02 nedeniyle hâlâ exit 1 döner. Makbuz saklama ve uyumluluk sözleşmesi: [RESCUE_SAFETY_9_9A.md](RESCUE_SAFETY_9_9A.md).

## Kapsam

Denetim başlangıcı, PR #28'in birleştirildiği `deb948a701b5acc0dd1b3df7aea744cbb670f783` main commit'idir. Bu çalışma motoru, yardımlı komutları, bölüm verilerini veya C# uygulamasını değiştirmez. Adversarial girdiler `fixtures/dead-board-vectors-9-9.json` içinde ayrı `audit-*` kimlikleriyle tutulur; kampanya varyantı veya gerçek kullanıcı kaydı olarak eklenmez.

Yasal hamlesi olan tahta **oynanabilir** olabilir; bu, kalan hamlelerle iki hedefin de tamamlanabileceği anlamına gelmez. Terminal `lost` durumunda hamlesiz tahta tek başına hata değildir. Asıl güvenlik koşulu, yeni normal takas bekleyen `playing` durumunun yerleşmiş ve yasal takas içeriyor olmasıdır. Bu koşulun normal takas sonrası koruması vardır; ek hamleyle yeniden açma için aşağıdaki R-01 sınırı vardır.

## Mevcut kurtarma mekanizması

| Adım | Mevcut davranış | Kaynak |
| --- | --- | --- |
| Yasal hamle sorgusu | Komşu ve farklı değerli taşlar geçici takas edilir; üç eksenli gerçek eşleşme sorgulanır ve değerler geri alınır. Puan, hamle ve RNG tüketmez. | `dist/engine.js:64–74` |
| Geçersiz takas | Terminal durum, uygunsuz komşuluk, aynı değer veya eşleşmesiz takas reddedilir; normal hamle ve RNG harcanmaz. | `dist/engine.js:142–147` |
| Dalgalar | Puan ve zemin gerçek eşleşmeden hesaplanır. Yerçekimi gerçek kaynak/hedefleri üretir. Kontrollü refill her boşluk için mevcut XorShift32'yi kullanır. Refill gerektiğinde yeni eşleşmeye izin verebilir. | `dist/engine.js:82–119,148–157` |
| 32 dalga sınırı | Kayıtlı 32 dalgadan sonra hâlâ eşleşme varsa `_stableBoard()` yerleşmiş tahta üretir. Kayıtsız 33. eşleşme için puan/zemin ödülü verilmez. | `dist/engine.js:148–158` |
| Hamlesizlik | Geçerli takasın son durumu `playing` ise `_ensurePlayable()` çağrılır. Zaten hamle varsa tam no-op'tur. | `dist/engine.js:132–140,158` |
| İlk yedek | En fazla 128 Fisher–Yates karıştırması; her deneme özgün taş çoklu kümesinden başlar. Eşleşmesiz ve hamleli sonuç kabul edilir. | `dist/engine.js:132–139` |
| İkinci yedek | En fazla 64 kontrollü yeniden üretim; ardından 3 katsayı çifti × 4 offset = 12 deterministik desen. Uygun tahta üretilemiyorsa hata fırlatılır. | `dist/engine.js:120–130` |
| Yeniden yükleme | Gerçek takas geçmişi baştan tekrar oynatılır; snapshot alanları, RNG ve nihai durum birebir karşılaştırılır. | `dist/engine.js:168–175` |

C# karşılıkları `unity/Gameplay/HexMatch.cs:169–233,258–278` içindedir. Yardımlı renk değiştirme aynı mevcut çözüm/kurtarma kurallarını kullanır. `unity/Commands/AssistedGame.cs` ve `dist/commands.js` karşılaştırmalarında ara dalgalar da kontrol edilir.

`legalMoves()` terminal durumda da geometrik takas listesi döndürebilir. Yetkili komut kapısı `swap()` terminal durumda bunları reddeder. Bu API ayrımı bir terminal hamle harcama hatası değildir.

### Korunan alanlar ve RNG sözleşmesi

Karıştırma/yeniden üretim zemin katlarını, puanı, kalan hamleyi, turn sayısını ve geçmişi ayrıca değiştirmez. Takasın kendisinin zaten yaptığı meşru değişiklikler korunur. Yedek yeniden üretim taş çoklu kümesini değiştirebilir; yalnızca permütasyon olduğu iddia edilmez.

RNG'nin değişmemesi beklenmez. Her Fisher–Yates denemesi `hücre sayısı − 1` çekim; her tam kontrollü dolum hücre sayısı kadar çekim yapar. Son desen yedeği ek RNG çekmez. Aynı başlangıç, aynı komutlar ve aynı kurallar aynı ara/son çıktıyı üretmelidir.

Ekonomi, kazanılan ödül, gerçek envanter ve profil saf motorun sahipliğinde değildir. Motor testindeki “ilerleme korundu” ifadesi gerçek Altın veya makbuz işlemi yapılmış anlamına gelmez. Mevcut uygulama/oturum testleri atomik profil kaydını ve yetkili komut başarısızlığındaki geri almayı ayrıca doğrular. Yeni denetim bu sınırı değiştirmez.

## Tekrarlanabilir sağlıklı sınır testleri

`node check-dead-board-recovery.cjs` **14 test grubu** çalıştırır. Kaynak düzeyinde monkey-patch yalnız çekim/çağrı sayısını gözler; karar kuralı veya RNG çıktısını değiştirmez. Enjeksiyonla oluşturulmuş bileşen durumları, gerçek geçmişten gelen kayıtlarla açıkça ayrılır.

| Test | Gerçek gözlem |
| --- | --- |
| Bağımsız yasal hamle doğrulaması | Dört yerleşmiş `playing` durumda toplam 354 sırasız hücre çifti. Koordinat üzerinde bağımsız üçlü-pencere oraklı, motor eşleşmesi ve gerçek takas kabulü aynı. Reddedilen takaslar tam snapshot/RNG no-op. Bu orakl bir çözücü değildir. |
| 128 deneme sınırı | Yatay dört hücre, değerler `[1,1,2,2]`, palet `[1,2]`, seed `1`. Hiçbir permütasyon üçlü üretemez; 128 denemeden sonra 5 tam dolumda `[1,2,1,1]` elde edilir. Tam **404 çekim**: `128×3 + 5×4`. Son RNG `3781358012`; bir yasal takas, sıfır otomatik eşleşme. |
| Zaten oynanabilir tahta | `_ensurePlayable()` `false` döner; sıfır RNG çekimi, tüm alanlar aynı. |
| Gerçek normal hamle sonrası kurtarma | Dört yatay hücre, `[1,2,1,1]`, palet `[1,2,3]`, seed `1`, 2 hamle, hedef 3. `[0,1]` gerçek takası tek dalga ve `reshuffled=true` üretir; RNG `3994976780`. Strict restore aynı durumu verir. Sonraki `[2,3]` ile puan 12, zemin tamam, `won`. |
| Gerçek 32 dalga | Fixture `actual-32nd-wave-safety-reset-replays`: `[12,16]` takası tam 32 dalga, puan **376**, RNG **544843318**, kalan hamle 7, turn 1, tüm zemin 0. Son tahta yerleşmiş ve hamleli. |
| 32 dalga skor/zemin bütünlüğü | Her dalganın puanı gerçek eşleşen değerlerin toplamı; katlar her eşleşen hücrede bir azalır. Son kayıtlı `frame.after` hâlâ eşleşme içerebilir; yetkili final snapshot farklı ve yerleşmiştir. Sunumda final snapshot kullanılmalıdır; mevcut 9.8 akışı bunu yapar. |
| Replay/clone/resume | Gerçek kurtarma ve 32-dalga çıktıları strict restore, geçmiş replay, clone ve sonraki gerçek takasta birebir eşleşir. |
| İmkânsız topoloji | Fixture'da 128 permütasyon, 64 yapım ve 12 desen tüketilip belgelenmiş hata döner; 64 RNG çekimi ve 204 eşleşme sorgusu sayılır. Son RNG `932611783`. Sonsuz döngü yoktur. |
| Yardımlı 32 dalga | Renk Anahtarı fixture'ında indeks 4 → 2; tam 32 dalga, puan **337**, RNG **3363164983**, kullanım 1. Hamle 8, turn 0 ve takas geçmişi boş kalır. Ön izleme saf; uygulama, restore ve yinelenen komut koruması eşleşir. |

İlk 128-deneme testi doğrudan bileşen durum enjeksiyonudur; bu enjekte edilmiş geçmiş için strict restore geçerliliği iddia edilmez. Normal takas ve 32-dalga örnekleri ise gerçekten motorda ulaşılmış, yeniden oynatılabilir durumlardır.

Ham yardımcı metot hata vermeden önce değerleri ve RNG'yi değiştirebilir. `_ensurePlayable()` tek başına atomik bir profil işlemi değildir. Yetkili uygulama komutu mevcut checkpoint/rollback sınırını, yardımlı uygulama clone/commit sınırını korumalıdır; bu denetim onları kaldırmaz. “Sınırlı hata” ifadesi ham yardımcı metotta otomatik geri alma anlamına gelmez.

## R-01 — İkinci şans hamlesiz kaybı oynanıyor olarak yeniden açabilir

**Önem:** genel ek-hamle komut sözleşmesinde orta. Yayımlanmış 40 varyantta ulaşılmış bir örnek bulunmadı; özel ama başlangıçtan kazanılabilir bir tahta ile doğrulandı. Mevcut kampanyanın bozuk olduğu veya ödeme kaybı yaşandığı iddia edilmez.

Neden: normal takas sonunda `_ensurePlayable()` yalnız `playing` durumda çalışır. Son hamlede `lost` olan tahta için bu gerekli değildir. Daha sonra `dist/commands.js:108–112` ve `unity/Commands/AssistedGame.cs:145–149` içindeki `grant_moves`, aynı taşlar/zemin/puan/RNG ile 5 hamle ekler; yeniden açılan tahtanın normal takası olup olmadığını değerlendirmez. Böylece meşru ek-hamle komutuyla `playing + 5 hamle + 0 yasal takas` oluşabilir.

### Yeniden üretim

Fixture: `known-issue-rescue-preserves-terminal-dead-board`, yayımlanmamış 7 hücreli radius-1 tahta. Hücre sırası q sonra r artan, `max(abs(q),abs(r),abs(q+r))≤1`. Her zeminde 1 kat; palet `[1,2,3]`; başlangıç `[1,2,3,1,3,2,2]`; seed `3100882058`; hamle 3; puan hedefi 1. Başlangıçta yalnız bir yasal takası vardır; kazanılabilir olsa da mevcut iki bağımsız kazanma başlangıcı yayın şartını karşılamaz. “Geçerli” burada çekirdek komut/restore sözleşmesini ifade eder, 40 varyantın yayın kabulünü değil.

1. Aynı başlangıçtan `[[3,6],[0,2],[0,1]]` gerçekten kazanır; başlangıç imkânsız değildir.
2. Alternatif yasal `[[3,6],[1,4],[3,5]]` rotası kaybeder.
3. Kaybedilen tahta `[3,3,2,1,3,2,1]`, zemin `[1,0,0,0,0,0,1]`, puan 18, RNG `3389192033`, yasal normal takas 0'dır.
4. Gerçek `grant_moves` komutu +5'i kabul eder. Aynı Attempt ID, tahta, katlar, puan ve RNG korunur; durum `playing` olur ama takas hâlâ 0 ve ipucu `null`dır.
5. Yardımlı snapshot strict restore ile aynı şekilde açılır. Dolayısıyla yalnız görsel bir kilit değildir.

Bu saf komut testi gerçek reklam, Altın veya can harcaması yapmaz. Eldeki uygun güçlendirici ayrıca çözüm sağlayabilir; “bütün yardım türleriyle kurtarılamaz” kanıtı değildir.

Yayımlanmış örneklem: esas rapordaki 1.280 oyunun 939 terminal kaybında bu şekil yoktur. Ayrıca ayrı deterministik rastgele stres çalışmasında **10.240 oyun / 98.218 yasal takas** içinde hamlesiz terminal kayba rastlanmadı. İkinci çalışmanın seçim tohumu `variant.seed ^ imul(trial,15485863) ^ levelId`, her seçimde XorShift32'dir. Bu ikinci örneklem esas 1.280 oyuna eklenip bağımsız geniş örneklem diye sunulmaz; bütün olası yayımlanmış yolların yokluk ispatı değildir.

### Öneri ve kabul kriteri

Ürün kararı gerektirir: mevcut ikinci şans, taş/RNG'nin aynen korunmasını vaat eder. Sessizce `_ensurePlayable()` eklemek bu sözleşmeyi ve mevcut yardımlı replay sonuçlarını değiştirebilir.

- En dar seçenek: yasal normal takası olmayan kayıp için reklam/Altın işlemi başlamadan uygunluk denetimi ve açık alternatif. Tamamlanmış ödül makbuzu varsa teslim/kullanıcı hakkı ayrıca korunmalı.
- Alternatif: açıkça sürümlü yeni kurtarma komutu; gerekirse taşları/RNG'yi değiştirir, diğer yetkili ilerlemeyi korur. Eski `assisted-v1` geçmişine gizlice eklenmemeli.
- Kabul: yeni içerik için bu fixture hem JS hem C#'ta anlamlı oynanabilir sonuç veya ücret/ödül hakkını kaybetmeyen açık ret üretmeli; kayıt, replay, tekrar callback ve gerçek UI işlem sınırı ayrıca test edilmeli.

Bu audit bu seçeneklerden hiçbirini uygulamaz.

## R-02 — Tek değerli geçersiz paletin son yedeği boş taş üretebilir

**Güncel durum — 9.9b: giderildi.** Erken açık ret ve kurtarma son koşulu eklendi; özgün yeniden üretim aşağıda tarihsel kanıt olarak korunur. Güncel testler ve uyumluluk: [BOARD_VALIDATION_9_9B.md](BOARD_VALIDATION_9_9B.md).

**Önem:** mevcut yayımlanmış veri dışında düşük; gelecekte Level Studio/import doğrulama sınırı. Mevcut 40 varyantın geçerli palet/topoloji sözleşmesinde görülmedi.

Yedi hücreli radius-1 tahtaya palet `[1]`, tüm başlangıç değerleri `1`, seed `1` verilip `_ensurePlayable()` çalıştırıldığında 64 yapım sonrası deterministik desen, iki palet girdisi varmış gibi davranır. `dist/engine.js:125–130` / `unity/Gameplay/HexMatch.cs:182–190` içindeki bu desen JS'te `undefined`, C#'ta `null` hücre bırakabilir. JS sonucu `true`, geçersiz indeksler `[0,2,4,5]`, geometrik yasal takas 2, RNG `762117529` olur.

Bu başlangıç otomatik eşleşmelidir ve geçerli yayımlanmış başlangıç değildir. Mevcut yayın sertifikası/başlangıç denetimleri bunu kabul etmez; snapshot doğrulaması da boş hücreli sonucu geçerli kayıt saymaz. Bu nedenle mevcut oyuncu kaydında doğrulanmış bozulma diye raporlanmaz. C# `Reset` yalnız boş olmayan palet şartını denetler; JS constructor/reset bu boşluk kontrolünü de yapmaz ve güvenilir yazarlık verisine dayanır. Bu giriş sınırları yardımcı metodun genel “başarılı sonuçta bütün taşlar geçerli” koşulunu sağlamaz.

Öneri: Studio/import girişinde topoloji, palet ve yerleşmiş/hamleli başlangıç doğrulaması; yedek başarıdan önce bütün hücrelerin izinli ve dolu olması; desteklenmeyen girdide sınırlı açık ret. Gelecekte düzeltilecekse JS/C# hata sözleşmesi ve eski snapshot/replay uyumluluğu birlikte ele alınmalı.

## Test komutları, sağlıklı regresyon ve açık hata ayrımı

- `npm run test:solvability`: 14 kurtarma grubu, 8 ipucu grubu ve deterministik tam rapor karşılaştırması. Mevcut başarılı çalışma koşullarını doğrular.
- `npm run audit:dead-board-diagnostics`: yukarıdaki **iki açık güvenlik bulgusunu** gerçek API ile yeniden üretir. Bulgular dururken **exit 1** döner; başarılı bir oynanabilirlik testi olarak sunulmaz.
- `npm run test:unity-gameplay`: 71 arşivli mekanik örneği korunarak 4 sağlıklı kurtarma ve 1 sınırlı hata örneği eklendi. Son gerçek çalışma 1.916 geçerli takas, 258 resume, 262 replay, 2.177 clone ve 1.050 bozuk kayıt reddini geçti.
- `npm run test:unity-commands`: son gerçek çalışma 2.930 tam karşılaştırma, 16.014 adım ve 3.326 dalga. Sağlıklı renk-anahtarı kurtarma örneği ve R-01'in açıkça etiketli karşılaştırması dahil.

Parite komutları R-01 ve R-02 için JS/C#'ın **aynı sorunu** ürettiğini ayrıca yazar. Bu karşılaştırmanın yeşil olması güvenlik koşulunun geçtiği anlamına gelmez; iki ayrı açık hata diagnostikte kırmızı kalır. Eski CI işleri veya başarısız mevcut testler kaldırılmadı; audit hataları üretim davranışının onayı olarak gizlenmedi.

Tüm 10 C# komutu gerçek .NET SDK **8.0.428** ile C# **7.3** derlenerek çalıştırıldı; JS'e düşüş yoktur. Tam komut ve sonuç tablosu [Solvability audit](SOLVABILITY_AUDIT_9_9.md) belgesindedir.

## Level Studio'ya bırakılacaklar ve sınırlar

Önce R-01 için ürün/komut sözleşmesi kararı alınmalı. Ardından yeni içerik giriş doğrulaması, sertifika doğrulaması, açık arama kapsamı/bitiş nedeni, son-hücre ve çift-kat erişimi raporları Studio'ya taşınabilir. Mevcut bölüm bütçeleri veya taş üretimi bu audit nedeniyle değişmez.

64/128/12 ve 32 dalga sınırları hesaplama adedi sınırıdır; fiziksel telefon süresi veya frame garantisi değildir. Büyük/import edilen topolojiler için bu denetim mobil CPU yeterliliği kanıtı vermez. Yeni runtime çözücü eklenmedi. Fiziksel iPhone/Android, Unity sahnesi ve IL2CPP çalıştırılmadı. Tarayıcı arayüzünde ve 9.8 sunumunda kaynak değişikliği yoktur.
