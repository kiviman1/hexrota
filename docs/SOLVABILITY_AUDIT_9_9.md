# Hexrota 9.9 — Çözülebilirlik ve ipucu denetimi

> **9.9c güncel takip:** A-01 katı düğüm bütçesi, H-01 gerçek klon devam doğrulaması ve H-02 açık offline bitiş/kanıt metadata'sı uygulandı; özgün karşı örnekler yeni sağlıklı regresyonlarda geçti. [SOLVER_INTEGRITY_9_9C.md](SOLVER_INTEGRITY_9_9C.md) ve [SOLVER_BUDGET_AND_HINT_REPORT.md](SOLVER_BUDGET_AND_HINT_REPORT.md) güncel sözleşme/kanıttır. Aşağıdaki 9.9/9.9a/9.9b bulguları tarihsel baseline olarak korunur.

> **9.9b takip durumu:** R-02 güvenli yapı/kurtarma doğrulamasıyla giderildi; özgün fixture korunur ve güncel sağlıklı diagnostik exit 0 döner. [BOARD_VALIDATION_9_9B.md](BOARD_VALIDATION_9_9B.md) güncel sözleşme ve test kanıtıdır. Aşağıdaki 9.9/9.9a gözlemleri tarihseldir; H-01/H-02 ve A-01 açık kalır.

> 9.9a, bu audit'i ve yayın verilerini yeniden yazmaz. R-01 için yeni komut reddi, tarihsel v1 replay ve kazanılmış reklam hakkı korumasının güncel durumu [RESCUE_SAFETY_9_9A.md](RESCUE_SAFETY_9_9A.md) içindedir. R-02, H-01/H-02 ve A-01 bu takip işinde çözülmüş sayılmaz.

## Kapsam ve sonuç

Başlangıç: PR #28 birleştirildikten sonraki main, `deb948a701b5acc0dd1b3df7aea744cbb670f783`. Denetim mevcut `classic-v4` motorunu, `variants-v1` verisini, mevcut çözücüleri ve görünür bilgi politikalarını kullanır. Yeni çözücü, tarayıcıda ağır arama veya oyun kuralı eklenmedi; yayımlanmış bölüm/veri, ekonomi ve kayıt sözleşmeleri değiştirilmedi.

Yayımlanmış **40 varyantın 80 bağımsız başlangıçlı kazanma sertifikası** ve **10 eski orijinal bölüm yolu** gerçekten kazanıyor. İncelenen geçerli, oynanmakta olan tahtalarda yasal hamle tespiti ile gerçek takas ve görünür bilgi hamle tespiti uyuşuyor. İncelenen sertifikalarda veya örneklenen oyuncu yollarında yanlış garantili ipucu saptanmadı. Bu sonuç, oyuncunun her yasal seçiminden sonra kazanmanın mümkün kaldığı anlamına gelmez.

Doğrulanmış sınırlılıklar vardır: JS sertifikalı rota ipucunun yayın verisine güvenmesi, `truncated` alanının tam arama anlamına gelmemesi ve çevrimdışı çözücünün bazı kayıp çocuklarda düğüm bütçesini aşabilmesi. Özel/gelecekteki tahtalarda kurtarma sonrası hamlesizlik ve kurtarma sınırları ayrıca [Dead-board raporunda](DEAD_BOARD_RECOVERY_REPORT.md) ele alınır. Bu özel girdiler yayımlanmış 40 varyantta gözlenen bir hata diye sunulmaz.

## Doğru garanti dili

| Sınıf | Kanıt | Ne anlama gelmez? |
| --- | --- | --- |
| Oynanabilir | Eşleşmesiz, geçerli tahtada en az bir gerçek eşleşme üreten komşu takas var. | Kalan puan ve zemin hedefleri hamle bütçesinde tamamlanabilir demek değildir. |
| Kazanılabilirliği kanıtlanmış | Mevcut tahta, RNG ve kalan hamlelerden başlayan gerçek bir devam motorla oynatılarak `won` olur. | Başka oyuncu seçimleri de kazanır demek değildir. |
| Mevcut bütçede kazanılamazlığı kanıtlanmış | Bu denetimde yalnız bir hamlesi kalan durumun bütün yasal takasları tüketilerek hepsinin `lost` olduğu gösterilir. | Başlangıç bölümü imkânsızdır veya güçlendirici/ikinci şansla kurtarılamaz demek değildir. |
| Arama bütçesinde bilinmiyor | Sınırlı derinlik/genişlik/düğüm araması kazanma yolu bulmadı. | İmkânsızlık kanıtı değildir. |

Son iki sınıfın kapsamı **mevcut durumdan kalan hamlelerle yalnız classic-v4 takaslarıdır**. Güçlendirici, +5 hamle kurtarma, can veya ekonomi bu imkânsızlık değerlendirmesine dahil değildir. Tam bilgili denetleyici gerçek deterministik geleceği kullanabilir; görünür bilgi oyuncusu kullanamaz. Bunlar ayrı ölçümlerdir.

## Mevcut korumalar ve sahiplik

| Alan | Gerçek sahip ve koruma |
| --- | --- |
| Üç eksende eşleşme | `dist/engine.js:50–63`; kesişen hücreler tekilleştirilir ve indeks sırası korunur. |
| Yasal takas | `dist/engine.js:64–74`; komşu/eşit olmayan taşlar geçici değiştirilip gerçek eşleşme kontrolü yapılır, sonra geri alınır. `legalMoves()` geometrik sorgudur; terminal durumu engelleyen yetkili kapı `swap()`tır. |
| Hamle ve RNG | `dist/engine.js:142–160`; terminal, komşu olmayan veya eşleşme üretmeyen takas hamle/RNG harcamaz. Geçerli takas dalgaları yetkili motorda tamamen çözülür. |
| Hamlesiz oynanan tahta | `dist/engine.js:120–141,158`; `playing` sonuçta `_ensurePlayable()` çalışır. 128 karıştırma denemesi, ardından sınırlı `_stableBoard()` yedeği vardır. Ayrıntılar ve özel girdi sınırları Dead-board raporundadır. |
| Kazanma/kaybetme | `dist/engine.js:43–49`; puan ve tüm zemin koşulları birlikte değerlendirilir. `won` kontrolü, sıfır hamle ve `exact` hedef aşımı kaynaklı kayıp kontrolünden önce gelir; yasal hamlesi olan tahta yine kaybedilmiş olabilir. |
| Kayıt doğrulama | `dist/engine.js:168–175`; snapshot v4/classic-v4 biçimi, palet, zemin, sayaçlar, RNG, geçmiş ve eşleşmesiz tahta kontrol edilir. Gerçek geçmiş tekrar oynatılır; bütün yetkili alanlar birebir karşılaştırılır. |
| Bölüm/varyant kimliği | `dist/attempts.js:20–70`; veri sürümü, türü korunan Level ID, varyant ve metadata doğrulanır; eksik sürüm sessizce başka tahtayla değiştirilmez. Çözümlenen varyant derin dondurulur. |
| Yayın sertifikası | `lib/level-analysis.cjs:101–104`, mevcut varyant kontrolleri ve yeni denetim; her rota gerçek motorla kazanmalı, bütçeye sığmalı ve ilk hamleler bağımsız olmalı. Katalogdaki biçim kontrolü tek başına bu kanıt değildir. |
| Yardımlı oyun | `dist/commands.js:141–144`; ipucu kopya modelde aranır. Gerçek yardım kullanıldıysa orijinal takas rotaları kaldırılır; artık geçerli olmayan sertifikaya dayanılmaz. |
| Sunum/kayıt/ödül | Bu denetim bu yetkileri taşımaz. İpucu ve simülasyon gözlemseldir; ekonomi, ödül, can, deneme kimliği veya kalıcı profil üretmez. |

Karıştırma RNG tüketebilir; RNG'nin değişmemesi doğru sözleşme değildir. Doğru sözleşme aynı başlangıç/komutlarla aynı sonucun, snapshot/replay'in ve JS/C# ara sonuçlarının eşleşmesidir. Mevcut karıştırma zemin, puan ve hamle geçmişini yeniden yazmaz. Kesin RNG adımları, kaynak/hedef sonuçları ve sınır testleri Dead-board raporunda tutulur.

## Tekrarlanabilir analiz yöntemi

Kaynak: [reports/solvability-9-9.json](../reports/solvability-9-9.json). 9.9 başlangıç kaynak SHA-256: `dc4a4432ebecbf66f8737e02b90106f3e8548db22e40462a9ebaf64f71b5630b`. 9.9b yeniden üretiminde bütün metrikler aynı, güncel kaynak hash'i `212f0da8520b30fee508d030ff4a2942bf7540f253f9e7dd3554d025e2550d49`; yalnız kaynak hash alanları güncellendi.

`audit-solvability-9-9.cjs`, mevcut `HexMatch`, `lib/observable-player.cjs` ve `lib/level-analysis.cjs` işlevlerini yeniden kullanır. Aynı algoritmanın ikinci oyun/çözücü uygulaması yoktur. Rapor `--write` ile üretilir, `--check` ile kaynak ve sonuçların tekrar üretilebilirliği doğrulanır.

- 40 varyant × 4 görünür bilgi politikası × 8 deneme = **1.280 oyun**. Her bölüm/politika için payda 32'dir.
- Karar tohumu `0x6d2b79f5` (`1831565813`); mevcut gözlemlenebilir analizdeki karıştırma formülü politika/deneme/hamle kimliğini kullanır. Gerçek refill tohumu, RNG, gelecek taş veya sertifikalı yol karar girdisi değildir.
- Politikalar: Random, Visible Score, Visible Coverage, Sampled Planning. Sonuncu 4 sentetik gelecek örneği ve derinlik 2 kullanır.
- İpucu: varyant/politika başına en fazla bir, sertifika dışına çıkmış ve en az iki hamle yapılmış `playing` durum; `maxNodes=512`, `maxDepth=3`, `beamWidth=6`. İpucu politika kararında kullanılmaz.
- Mevcut çevrimdışı çözücü: varyant başına bir durum, `width=20`, istenen `maxNodes=6000`. Gerçek arama genişletmeleri ayrıca sayılır; A-01 nedeniyle bu parametre mutlak sert sınır diye sunulmaz.
- Son hamle kanıtı: kalan hamle 1 iken bütün gerçek yasal takaslar klonlarda denenir. Kaynak durum değişmez.

Bu sayılar otomatik gözlem/karşılaştırma sayılarıdır; bağımsız insan oyuncu veya bağımsız test senaryosu sayısı değildir. Aynı varyantın tekrar eden deterministik yolları ayrıca sayılabilir.

## Sertifikalar, replay ve örneklenmiş oyunlar

| Kontrol | Sonuç |
| --- | --- |
| Güncel varyant/rota | 40 / 80; her varyantta iki farklı doğrulanmış ilk takas |
| Sertifikalı ara checkpoint | 600; her biri strict restore ile eşleşti |
| Bağımsız prefix tekrar oynatmaları | Toplam 2.709 takas; her prefix tam snapshot ile eşleşti |
| Eski orijinal yollar | 10/10 gerçekten kazanıyor |
| Görünür politika oyunları | 1.280: 341 kazanma, 939 kayıp |
| Gerçek politika hamleleri | 11.767; her checkpoint strict restore ile eşleşti |
| Yasal hamle/görünür eşleşme uyuşması | 11.767 karar durumu |
| Sertifikadan ayrılan gözlemler | 11.105; bunların hepsi ayrı benzersiz tahta değildir |
| Son hamle gözlemi | 1.044 ziyaret; 776 benzersiz durum |
| Mevcut son hamlede kazanılamazlığı kanıtlanan | 670 benzersiz durum, toplam 907 ziyaret; kapsam yalnız yardımsız mevcut son hamle |
| Karıştırma / tekrar karıştırma | Örneklenen 1.280 oyunda 0 / 0; sertifikalarda da 0 |
| Hamlesiz terminal kayıp | Örneklenen 939 kayıpta 0 |
| En uzun zincir | Sertifikada 16 dalga; görünür politika yollarında 11 dalga |
| 32 dalga güvenlik sınırına ulaşan | Örneklenen politika hamlelerinde 0 |

`audit-solvability-9-9.cjs:18–30` sertifika hamlelerini, ara durumları ve gerçek final hedeflerini; `50–74` politika yollarını doğrular. Son hamle ispatı `44–49` arasındadır. Tam raporda 12 yeniden üretilebilir kazanılamaz son-hamle örneği tutulur; bu kayıt 670 durumun bütün snapshot arşivi değildir.

Sertifikalar bütün olası oyun uzayını kapsamaz. Karıştırmanın bu örneklerde gerçekleşmemesi kurtarma kodunun gereksiz olduğunu kanıtlamaz; ayrı adversarial fixture ve **10.240 hedefli stres denemesi** Dead-board raporunda değerlendirilir. Sınır dışı/özel geometrilerdeki sonuçlar mevcut kampanyanın gözlenen sıklığı olarak yorumlanmamalıdır.

## Zorluk ve adalet gözlemleri

Aşağıdaki tablo bu denetimin **yeni, küçük örneklemli görünür bilgi** çalışmasıdır. Dört başarı sütunu 32 oyun içindeki kazanma sayısını gösterir; insan kazanma oranı değildir. “İlk eşleşme deseni”, ilk takasın eşleştirdiği hücre kümesidir; seçenek çeşitliliğinin göstergesidir, stratejik iyilik kanıtı değildir.

| Bölüm | Başlangıç yasal takas aralığı | İlk eşleşme deseni aralığı | Random | Visible Score | Visible Coverage | Sampled Planning |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 9–22 | 9–20 | 1/32 | 25/32 | 29/32 | 32/32 |
| 2 | 6–16 | 5–13 | 0/32 | 21/32 | 28/32 | 32/32 |
| 3 | 8–15 | 8–12 | 0/32 | 9/32 | 7/32 | 25/32 |
| 4 | 13–18 | 10–14 | 0/32 | 11/32 | 21/32 | 25/32 |
| 5 | 11–17 | 10–14 | 0/32 | 2/32 | 8/32 | 20/32 |
| 6 | 7–13 | 7–12 | 0/32 | 0/32 | 0/32 | 14/32 |
| 7 | 14–25 | 14–21 | 0/32 | 8/32 | 0/32 | 11/32 |
| 8 | 8–15 | 7–13 | 0/32 | 0/32 | 0/32 | 0/32 |
| 9 | 29–39 | 29–38 | 0/32 | 0/32 | 0/32 | 10/32 |
| 10 | 12–31 | 12–26 | 0/32 | 0/32 | 0/32 | 2/32 |

En az seçenek L2/v3'te 6 yasal takas ve 5 desendir; L2/v4 ile L6/v4'te 7 takas vardır. Bunların her birinde iki sertifikalı kazanma başlangıcı geçerlidir. L9/v1'in 39 yasal takası ve 38 deseni olması kolaylık sağlamaz. Yasal seçenek sayısı tek başına yeterli zorluk ölçüsü değildir.

Mevcut [reports/observable-difficulty.json](../reports/observable-difficulty.json) daha geniş, **önceden üretilmiş ayrı** bir karşılaştırmadır: varyant/politika başına 64, bölüm/politika başına 256 oyun. Yeni araç bu tarihi raporu yeniden üretmez; kaynak hash'ini ve özetini `historicalObservableReference.notReproducedByThisTool=true` ile taşır. Tarihi Sampled Planning sonuçları L5'te %52,34, L6'da %33,59, L8'de %2,73, L9'da %19,14, L10'da %3,52'dir. Bunlar da insan oranı değildir.

İki ayrı örneklem aynı araştırma önceliklerini destekliyor:

1. **L8 ve L10:** birkaç yasal seçim bulunması hedeflerin yetiştiğini göstermiyor. Tarihi Sampled Planning 256 oyununda L8'de 213, L10'da 241 kayıp yalnız eksik zeminden kaynaklanmış; puanı düşürmek doğrudan bu sorunu çözmeyebilir.
2. **L6:** L5'ten sonra planlanan rahatlama görünür stratejilerde doğrulanmıyor. Tarihi L6/v1 sonucu %15,63, diğer varyantlar %37,5–40,63; önemli varyant farkı araştırılmalı.
3. **L9:** L8'e göre rahatlama var, ancak 39 başlangıç seçeneğine rağmen basit politikalar zorlanıyor. Tarihi v4 %4,69; diğerleri %23,44–25. Son hücre erişimi ve çift kat yerleşimi incelenmeli.
4. **L5:** tarihi varyant aralığı %23,44–68,75; sertifika varlığı benzer oyuncu zorluğu anlamına gelmiyor.
5. **L3/L7:** ilk strateji sıçraması ve sonraki zemin odaklı darboğazlar, sonraki Level Studio/insan testinin ikincil önceliği.

Bu PR bölüm dengesi, hedef, hamle sayısı, refill veya varyant yayımlamaz. Hiçbir bot sonucu oyuncuyu gizlice kaybettirme ya da ödeme gerekliliği gerekçesi değildir.

## İpucu sonuçları ve gerçek arama sınırları

`dist/engine.js:176–225` üç sınıfı korur:

- `proven_route`: mevcut geçmişe uyan yayımlanmış sertifikalı yolun devamı. JS burada yayın sertifikasına güvenir; H-01 bu güven sınırını açıklar.
- `search_win`: klon motor üzerinde gerçekten `won` olmuş devam. Denetim her garantili devamı ayrıca yeniden oynatır.
- `heuristic`: yasal ve sezgisel öneri, `guaranteed=false`, `continuation=null`. Kazanma vaadi değildir; küçük bütçede kötü bir seçim yapılabilir.

160 kasıtlı sertifika-dışı probun **13'ü `search_win`, 147'si `heuristic`**, 0'ı `proven_route` oldu. 13 garantili devamın tamamı gerçekten kazandı; kaynak snapshot, RNG, puan, zemin ve sayaçlar değişmedi. Bu seçilmiş örneklemin üretimde ipucu kullanım sıklığını temsil ettiği iddia edilmez. Bütün 160 probda `truncated=false` olması aramanın bütün olasılıkları tükettiği anlamına gelmez.

40 mevcut çevrimdışı çözücü probunda **36 yeniden oynatılmış kazanma**, **4 bilinmeyen** bulundu; toplam 49.325 gerçek arama takası ölçüldü. Bilinmeyenler L8/v1 (1.076), L8/v3 (1.391), L8/v4 (1.193) ve L10/v1 (3.863 genişletme). 6.000 düğüm sınırına ulaşmadan da beam budaması bir çözümü kaçırabilir. Bu dört sonuç “imkânsız” diye etiketlenmez. Bu 40 probda istenen düğüm sınırının aşılması gözlenmedi; A-01 için ayrı küçük karşı örnek vardır.

Pozitif tam sayı `maxNodes`, çalışma saatine bağlı kesmeyi devre dışı bırakır; üst sınır 100.000, derinlik üst sınırı 3, beam üst sınırı 32'dir. Düğüm bütçesi verilmezse mevcut JS politika 5.000 düğüm ve varsayılan 90 ms, ayarlanabilir 1–150 ms yumuşak zaman sınırı kullanır. Gerçek süre cihaz ölçümü değildir. JS düğüm modunda başlangıçta kullanılmayan bir saat okuması yapar; karar zaman değerine bağlı değildir.

`dist/hint-worker.js:3–7` 90 ms/derinlik 3 ister. `dist/app.js:1516–1544` 600 ms yanıt süresi, aktif model/epoch/işlem kimliği kontrolü ve 12 ms/derinlik 1 yedeğini korur. İpucu değerlendirmesi yetkili oynanışı değiştirmez; oyuncunun gerçekten ipucu kullanması mevcut `hintsUsed`/yerel olay kaydını meşru biçimde değiştirebilir.

C# `unity/Hints/HintSolver.cs:49–74,119–155` rota bağlarken ve garantili cevap verirken gerçek devamı yeniden doğrular. Pozitif düğüm bütçesiyle saat okunmaz; saat adaptörü yoksa deterministik sıfır saat politikası fiziksel mobil 90 ms garantisi değildir. Bu farklılıklar mevcut [CSHARP_HINTS.md](CSHARP_HINTS.md) sözleşmesinde de açıklanmıştır.

## Doğrulanmış bulgular ve yeniden üretim

| ID | Önem | Bulgu ve kapsam | Öneri / kabul kriteri |
| --- | --- | --- | --- |
| H-01 | Mevcut dondurulmuş yayın verisinde düşük; gelecekte doğrulanmamış import için orta | JS `engine.js:181–186` geçmiş prefix'ini ve sıradaki yasal takası kontrol eder; kalan rotayı yeniden kanıtlamaz. `attempts.js:26–37` biçim/bütçe/bağımsız ilk hamle kontrolüdür. C# rota bağlama daha sıkıdır. Yayımlanmış 80 rotada yanlış garanti bulunmadı. | Yayın öncesi sertifikayı zorunlu tut. Level Studio/import sınırında bütün devamları gerçek motorla kazanma açısından doğrula. Güvenilmeyen rota runtime'a girecekse ortak doğrulanmış rota sözleşmesi tasarla. |
| H-02 | Düşük, sonuç anlamı/dokümantasyon | `truncated=true` yalnız node/time kesilmesini bildirir (`engine.js:200,207,224`). Derinlik/beam budaması `truncated=false` ile belirsiz sonuç verebilir. | `truncated=false` asla “tam arama” diye sunulmasın. Studio'da kesilme nedeni ile çözüm uzayının kapsamını ayrı alanlarda raporla. |
| A-01 | Düşük, çevrimdışı araç bütçesi | `lib/level-analysis.cjs:91–95`: kayıp çocuk `continue` ile bütçe kontrolünü atlar. `maxNodes` bu durumda sert sınır değildir. Runtime HintSolver'ın ön-genişletme sınırı bu hatayı taşımaz. | Sonraki offline/Studio çalışmasında her çocuk öncesi sınır, gerçek genişletme sayısı ve bitiş nedeni ekle. Mevcut audit gerçek sayıyı ayrıca raporlar; runtime çözücü eklemez. |

H-01 karşı örneği: JSON'u bellekte kopyala; L1/v1'in iki rotasını kendi yasal ilk hamlelerinden oluşan birer hamlelik diziye indir. İki ilk hamle farklı olduğundan katalog biçimi kabul edilir. JS `hint()` `proven_route`, `guaranteed=true`, örneğin `[[14,18]]` devamı verir, fakat devam oynatılınca durum `playing` kalır. C# `HintRoutes.Create` aynı kazanmayacak rotayı reddeder. Bu, güven sınırını gösteren diagnostiktir; yanlış garantiyi istenen davranış olarak kalıcı sağlıklı testte sabitlemedik. Gerçek JSON değiştirilmedi.

H-02 karşı örneği: rota alanlarını yalnız klonda kaldırıp `maxNodes=100000,maxDepth=1,beamWidth=1` ile 40 başlangıçta ara. Sonuçlar `heuristic`, `guaranteed=false`, `continuation=null`, `truncated=false`; belirsizlik doğru biçimde korunur.

A-01 karşı örneği: L1/v1 için `[[8,11],[12,17],[1,0],[8,11],[13,16],[9,14],[3,6],[7,10],[18,17]]` geçerli prefix'ini oyna. Bir hamle, dört yasal takas kalır ve hepsi kayıptır. Mevcut `solve(level,{prefix,width:20,maxNodes:1})`, prefix tekrarları hariç **4 arama takası** yapıp `null` döner. Sayım yalnız mevcut `swap` çağrılarını gözler; kuralı değiştirmez. Bu belirli son-hamle durumu ayrıca tüketici ispatla kazanılamazdır; genel `solve=null` aynı kanıtı vermez.

Kurtarma sonrası özel tahtada deadlock ve çözülemeyen palet/geometri sınırları ayrı Dead-board raporunun bulgularıdır. Bunlar bu belgeye “40 varyant bozuk” şeklinde taşınmaz. Güvenli hata sınırı ve JS/C# eşliği o raporun kabul kriterleridir.

## 9.9c bulgu kabul durumu

- **A-01 giderildi:** özgün node1 isteği 4 yerine1 gerçek çocuk genişletir, 9 prefix takası bütçe dışıdır; null sonucu unknown kalır. Node4 ile bütün dört kayıp çocuk gerçekten tüketildiğinde yalnız kalan mevcut durum için proof mümkündür.
- **H-01 giderildi:** özgün iki sahte tek-hamle rotası artık proven_route/true üretemez. Klon replay won olmadıkça garanti verilmez; raw level nesnesi katalog güvenini atlayamaz. Published680 çıktı korunur.
- **H-02 giderildi:** runtime truncated alanı korunur; additive solveWithReport node/depth/beam sınırlarını ve unknown/kanıt ayrımını açıklar. Depth/beam budanmış arama tüketilse de imkânsızlık iddiası yoktur. Özgün40 runtime örneği belirsiz kalır.

Bu durum oyunların evrensel kazanılabilirliği değildir; güçlü booster/rescue veya keyfi oyuncu hatalarının geri alınabilirliği için kanıt verilmez. Tam final test/CI durumu takip raporundadır.

## Kalıcı testler ve çalıştırma kanıtı

Mevcut testler kaldırılmadı veya zayıflatılmadı. Yeni testler yeni oyun/arama algoritması kurmak yerine gerçek API'leri gözlemler.

| Kontrol | Gerçek çalışma sonucu |
| --- | --- |
| `node check-solvability-hints.cjs` | Exit 0, **8 grup**: 40 gerçek sertifika-dışı durum; tekrar edilmiş 120 düğüm/derinlik kararı; 40 farklı saat karşılaştırması; 320 gizli RNG değişikliği karşılaştırması; 8 yardımlı kayıt/ipuçları kontrolü. |
| `node check-observable.cjs` | Exit 0: **80 tahta, 1.920 gizli RNG değişikliği karşılaştırması, 160 sampled karar**. |
| `node audit-solvability-9-9.cjs --check` | Yeni JSON yeniden üretildi ve eşleşti; yukarıdaki 80/600/2.709 ve 1.280/11.767 gözlemler bu çalışmaya aittir. |
| `node check-dead-board-recovery.cjs` | Exit 0, **14 grup**; 354 hücre çifti, gerçek karıştırma ve 32 dalga, restore/replay, yardımlı komut ve sınırlı hata. |
| `npm test` | Mevcut tam zincir ve sona eklenen `test:solvability` tamamlandı. Eski testler korunuyor: 40 varyant/80 rota, ekonomi/can/ikinci şans, onboarding/Tavik, state, F-01 ve 9.8 sunum testleri. Son tam rapor kontrolü bütün JSON'u tekrar üretti (54.453 ms; yalnız bu son adımın süresi). |
| `npm run audit:dead-board-diagnostics` | **Exit 1**, iki açık bulgu, `healthyAcceptance=false`. Bunlar düzeltilmedi; parite eşliği sağlıklı oynanabilirlik garantisi diye raporlanmaz. |

10 farklı C# komutunun tamamı gerçek .NET SDK **8.0.428**, C# **7.3** derlemesiyle **exit 0** döndü. SDK eksikliğinde JS sonucu kullanma yoktur. Değişen gameplay/commands/hints sürücüleri son kez fixture'lar dondurulduktan sonra yeniden çalıştırıldı. Aşağıdaki sayılar farklı türde gözlemlerdir; tek bir toplam “test sayısı” oluşturmak için toplanmaz.

| Komut (`npm run …`) | Son gerçek karşılaştırma kapsamı |
| --- | --- |
| `test:unity-gameplay` | 71 arşivli mekanik + 4 kurtarma + 1 sınırlı hata; 80 tam sertifika, 120 sertifika-dışı koşu; 1.916 geçerli takas, 258 resume, 262 replay, 2.177 clone, 1.050 bozuk kayıt reddi. Ara eşleşme, refill, gravity, RNG, zemin ve status JSON'u karşılaştırıldı. R-02 ayrıca bilinen sorun olarak etiketlidir. |
| `test:unity-rewards` | 104 ortak vektör ve state factory; 98 geçerli / 7 ret. |
| `test:unity-catalog` | 2.107 tam JSON karşılaştırması; 725 seçim, 610 resume, 80 kazanma yolu, 21 arşivli sürüm kontrolü. |
| `test:unity-lives` | 344 derlenmiş istek; 460 yaşam döngüsü geçişi, 152 donmuş v1 migration ve ek ret/makbuz kontrolleri. |
| `test:unity-hints` | **1.003** karşılaştırma; 3 yeni deterministik bütçe/geçiş örneği, 202 devam oyunu; kaynak/garanti/devam/düğüm bütçesi, saf arama ve C#'ın güvenilmeyen rotayı reddetmesi. |
| `test:unity-reward-adapter` | 175 rota, 1.456 turn, 2.928 dalga, 1.564 replay/restore kontrolü. |
| `test:unity-session` | 580 event JSON + 1.362 session JSON karşılaştırması; 36 gerçek `app.js` akışı, 56 hata/guard senaryosu. |
| `test:unity-economy` | 125 akış, 579 tam sonuç/durum karşılaştırması. |
| `test:unity-commands` | 2.930 karşılaştırma, 16.014 adım, 3.326 dalga; renk anahtarı 32-dalga kurtarma ve R-01'in açıkça bilinen sorun karşılaştırması. |
| `test:unity-rescue` | 293 gerçek C# karşılaştırması, 12 donmuş örnek ve 600 derlenmiş yaşam döngüsü geçişi. |

Mevcut GitHub Actions işleri değiştirilmedi. Yeni Node kontrolleri mevcut `npm test` işine, ek parite vektörleri mevcut gerçek C# işlerine dahil olur. Chromium/WebKit, offline, mobil, state/F-01/animasyon ve görünür zorluk işleri de korunur; bu belgede yerel Node çalışması fiziksel cihaz testi olarak sunulmaz. PR'ın check listesi uzaktaki CI sonucunun kaynağıdır.

Yeni ipucu testi L2/v4'te dokuz gerçek hamleden sonra aynı görünür son-hamle tahtasını kullanır: 7 yasal seçimden 1'i kazanır. `maxNodes=1` garantisiz ve kesilmiş sezgisel cevap verir; `maxNodes=8` iki düğümde gerçek `search_win` bulur. Garantili devam bağımsız tekrar oynatılır. Kısıtlı bütçenin kayıp seçmesini ürünün istenen davranışı olarak sabitlemez.

Görünür bilgi sınırı `lib/observable-player.cjs:17–24,38–57` whitelist DTO ve bağımsız sentetik tohumlarla korunur. Testler gerçek RNG/sertifika alanına erişimde hata veren getter'lar ve aynı görünür tahta/karar tohumu, farklı gizli RNG çiftleri kullanır. Görünür hamle önerisi aynı kalmalı; gerçek takas sonrası sonuçların farklı olması normaldir. Tam bilgili `lib/level-analysis.cjs` botları bu görünür modellerle karıştırılmaz.

## Performans sınırları ve sonraki işler

Bu çalışma hızlanma iddiası yapmaz. Deterministik iş sayıları, katı runtime ipucu düğüm sınırı ve ayrı gerçek offline genişletme sayısı ölçülür; fiziksel iPhone/Android süre, ısınma veya Unity/IL2CPP performansı ölçülmedi. Browser/runtime'a yeni audit araması bağlanmadı.

Öncelik sırası:

1. Özel kurtarma tahtaları ve güvenli başarısızlık sınırları için Dead-board raporundaki bulguları ayrı küçük düzeltme olarak ele al; mevcut audit'te kuralı değiştirme.
2. Yayın sertifikası kapısını koru; gelecekteki Level Studio'da H-01 import sınırını kapatmadan dış rota kabul etme.
3. Offline A-01 bütçe sayımını ve H-02 bitiş/kapsam metadata'sını sonraki araç iyileştirmesinde netleştir.
4. Level Studio'da L8/L10 zemin erişimi, L6/L9 rahatlama ve L5/L6/L9 varyant farklarını tek değişkenli adaylarla araştır. Değişmiş hamle/hedef/zemin için yeni sürümlü taban bölüm arşivi ve eski kayıt çözümlemesi gerekir.
5. Gerçek oyuncularla hedefin anlaşılması, son hücre darboğazı ve hata sonrası toparlanmayı ölç. Bot sonuçlarından kesin insan başarı yüzdesi veya bütün rastgele kararların kurtarılabilir olması şartı çıkarma.

Audit'in kabul sınırı: yayımlanmış sertifikalar gerçekten kazanır; geçerli checkpoint/replay aynı sonucu verir; yasal tespit gerçek motorla uyuşur; garantili ipucu gerçek kazanma devamına dayanır; belirsiz sonuçlar açıkça belirsizdir; karıştırma/kurtarma yetkili veriyi bozmaz ve sınırlı davranışının kapsamı belgelenir. Tüm oyun uzayını çözmüş olma veya her oyuncu hatasını telafi etme garantisi verilmez.
