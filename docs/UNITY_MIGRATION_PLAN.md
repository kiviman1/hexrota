# Hexrota — Unity aktarım planı

## Mevcut durum ve aktarım hedefi

Oynanışın referansı saf JavaScript motoru, sürümlü bölüm verileri ve kayıtlı test çıktılarıdır. Unity aktarımında önce aynı girdiden aynı oyun sonucunu üreten C# çekirdeği kurulmalı; çizim, ses, titreşim, dokunma ve cihaz servisleri bunun dışına bağlanmalıdır.

Bu depoda **oyun motorunun C# uygulaması henüz yoktur**. C# olarak uygulanmış ve derlenerek karşılaştırılan parça `unity/Rewards/` içindeki Reward Director'dır. Unity sahnesi, mobil paket, mağaza, ödeme ve reklam entegrasyonu bu çalışmanın parçası değildir.

| Alan | Bu sürümde uygulanan | C# durumu |
| --- | --- | --- |
| Eşleşme, takas, düşüş, üretim, zincir, kazanma | `dist/engine.js`, `classic-v4` | Aktarılacak; ortak oyun vektörleri hazır. |
| 10 ana bölüm, her birinde 4 doğrulanmış varyant | `dist/variants.json`, `dist/attempts.js` | Katalog ve seçim karşılığı aktarılacak. |
| T1/T2 | Sabit sayılar, tohumlar, yönlendirmeler | Aynı veriden çalışacak; varyant seçimine katılmaz. |
| Kayıt devamı ve eski kayıt okuma | Snapshot v4, deneme kimliği v1, eski hamleleri tekrar oynatma | Yerel dosya/cihaz adaptörü ve doğrulayıcı aktarılacak. |
| İpucu | Çoklu doğrulanmış rota, sınırlı arama, açık garanti bilgisi | Aynı düğüm bütçesiyle önce saf C# karşılığı yapılacak. |
| Ödül yöneticisi | Saf JS + C# 7.3, ortak ödül vektörleri | Uygulandı; Unity sunumuna bağlanması gerekiyor. |
| Yerel olaylar | `dist/events.js`, tarayıcıda sınırlı yerel tampon | Aynı şema için cihaz adaptörü yapılacak. |
| Ekonomi | Tasarım belgesi ve yüklenmeyen öneri JSON'u | Uygulanmadı; fiyatlar ve yardım komutları öneridir. |

## Modül eşlemesi

Aşağıdaki C# adları hedef modüllerdir; Reward Director dışındakiler mevcut C# dosyası olarak sunulmuyor.

| Bileşen | Mevcut JS/veri kaynağı | C# karşılığı ve sınırı |
| --- | --- | --- |
| Hexagonal Board Model | `HexMatch`, `topology()` | `HexBoard`, `AxialCell`, `BoardTopology`: sıralı hücreler, değerler, kalan katlar, komşular, çizgiler ve sütunlar. Görsel konum hesaplamaz. |
| Match Detection | `findMatches()` | `MatchDetector`: üç düz yönde en az üç eşit değer; kesişimler tek hücre olarak sayılır. |
| Swap Validator | `adjacent()`, `legalMoves()`, `swap()` başlangıcı | `SwapValidator`: indeks, komşuluk ve gerçekten eşleşme oluşması. Geçersiz işlem bütün durumu korur. |
| Gravity System | `_gravity()` | `GravityResolver`: sütundaki kalan taşların sırasını ve gerçek kaynak/hedef kimliklerini korur. |
| Controlled Refill | `_newMatchesAt()`, `_fillVacancies()` | `ControlledRefill`: en az yeni üçlü oluşturan palet seçeneklerini bulur, bağları yalnızca oyun RNG'siyle çözer. |
| RNG | `_random()`, deneme seçicinin `randomStep()` işlevi | `XorShift32`: iki ayrı durum; biri oyun üretimi, diğeri varyant seçimi içindir. |
| Cascade Resolver | `swap()` çözümleme döngüsü | `CascadeResolver`: bütün dalgalar tek takas/hamle olarak kesinleşir; puan ve alan sonuçları sunumdan önce hesaplanır. |
| Level Configuration | JS kaynakları, JSON dışa aktarımları ve varyant paketi | `LevelCatalog`, `ResolvedLevelConfig`: değişmez taban veri + seçilen başlangıç/tohum/çözüm yolları. |
| Variant Selection | `HexAttempts.createCatalog().start()` | `VariantSelector`, `AttemptMetadata`: seçim geçmişiyle tekrarı azaltır; mağaza veya ödeme girdisi almaz. |
| Hint Solver | `hint()` | `HintSolver`: klonlarda çalışır; doğrulanmış yol, aramayla bulunan kazanma ve sezgisel öneriyi ayırır. |
| Save/Load | `_restore()`, `HexAttempts.restore()/checkpoint()`, uygulama bağlantısı | `SaveValidator`, `AttemptRepository`, eski kayıt adaptörü: kimliği çöz, bütün hamleleri tekrar oynat, tüm durumu karşılaştır. |
| Reward Director | `rewards.js`, `reward-adapter.js`, `reward-rules.json` | Mevcut `RewardDirector.cs`, `RewardTypes.cs`; oyun dalgalarını girdi DTO'suna çeviren adaptör ayrıca bağlanır. |
| Economy Rules | `data/economy-design.json` ve ekonomi belgesi | Gelecekte `EconomyRules`, cüzdan günlüğü ve yardım komutları; şu anda oyun çekirdeğine eklenmez. |

`dist/app.js` içindeki ekran yönetimi, giriş, kayıt servisi ve sunum tek bir C# oyun motoruna kopyalanmamalıdır. Unity tarafında deneme akışını yöneten bir uygulama katmanı, saf çekirdekten ayrı bir sunum katmanı ve cihaz adaptörleri gerekir. Bu katmanın mevcut davranışı; ön izleme, onaylı yeniden başlatma, devam etme ve sonuç ekranı testlerinden alınır.

## Veri kaynakları ve sürümler

| Dosya | Sözleşme | Kullanım |
| --- | --- | --- |
| `data/levels-original.json` | `schemaVersion: 1`, `kind: campaign`, `levelDataVersion: original-v1`, `rulesVersion: classic-v4` | Eski ana bölüm kayıtlarını açacak değişmez orijinal tanımlar. |
| `data/tutorials-fixed.json` | `schemaVersion: 1`, `kind: tutorial`, `levelDataVersion: tutorials-v1`, `rulesVersion: classic-v4` | Sabit T1/T2, çözüm yolları, adımlar ve mevcut metinler. |
| `dist/variants.json` | `schemaVersion: 1`, `levelDataVersion: variants-v1` | Ana bölüm başına 4 başlangıç, tohum, en az iki farklı ilk takasla kazandıran yol ve analiz bilgileri. |
| `dist/difficulty-rules.json` | Veri içindeki şema ve analiz parametreleri | Çevrimdışı bot davranışları, kabul aralıkları ve bölüm ritmi. Oynarken sonucu değiştiren bir ayar değildir. |
| `dist/reward-rules.json` | Ödül kuralı sürümü 1 | Sadece görsel/işitsel/dokunsal geri bildirim kararları. |
| `data/economy-design.json` | `schemaVersion: 1`, `rulesVersion: economy-draft-v1`, `status: design_only`, `loadedByPrototype: false` | Gelecekteki ekonomi için doğrulanmamış aday parametreler. Çalışan oyun tarafından yüklenmez. |

Orijinal ana bölüm ve öğretici JSON'ları `node export-game-config.cjs` ile mevcut JS kaynaklarından üretilir. `--check`, dışa aktarımın bütün alanları ve kimlik türlerini aynen koruduğunu denetler. JS kaynakları değiştirilmez. C# veri yükleyicisi bu JSON'ları okuyabilir; JS kodunu çalıştırması gerekmez. `dist/variants-data.js` yalnızca web için üretilmiş sarmalayıcıdır; Unity'nin veri kaynağı kanonik JSON olmalıdır.

Varyant paketi sıralı `levels` ve `variants` dizilerini taşır. Her varyantın `id`, `initial`, `seed`, `solutions`, `par` ve `difficultyMetrics` alanları vardır. Taban geometrisi, katman tanımı, hedef, hamle bütçesi ve palet orijinal bölümden alınır. `solutions[0]` ana yol, diğerleri alternatif yollardır. İki ilk takasın bağımsızlığı `[a,b]` ile `[b,a]` aynı hareket sayılarak doğrulanır.

**Sürüm saklama sınırı:** Mevcut katalog birden çok varyant paketi arşivini okuyabilir; son paket yeni denemeler için varsayılandır. Eski bir denemenin veri sürümü sessizce yenisine çevrilmez. Ancak bütün paketler aynı değişmez taban bölüm tanımını kullanır. İleride mevcut Level ID altında geometri, hedef, bütçe veya palet değişecekse bunların da sürümlü taban arşivi gerekir; yalnızca eski varyant JSON'unu saklamak yetmez. Bu taban arşiv sistemi henüz uygulanmadı. Mevcut on bölümün orijinalleri korunmalıdır.

## Kimlikler ve JSON → C# dönüşümü

Kimliklerin tel üzerindeki türleri mevcut kayıtlarla aynı kalır:

- Ana bölüm `levelId`: JSON sayısı `1`…`10`.
- Öğretici `levelId`: JSON dizgesi `learn-1` veya `learn-2`.
- Ana varyant: `v1`…`v4`; kimlik anahtarı `levelId + levelDataVersion + variantId` birleşimidir.
- Eski ana bölüm: `variantId = legacy-original`, `levelDataVersion = original-v1`.
- Öğretici: `variantId = fixed`, `levelDataVersion = tutorials-v1`.

`1` ve `"1"` deneme doğrulamasında aynı kimlik değildir. C# çekirdeğinde türü ve değeri taşıyan bir `LevelKey` kullanılabilir; JSON adaptörü mevcut sayı/dizge ayrımını korumalıdır. Bütün kimlikleri körlemesine `int` veya `string` yapmak eski kayıt sözleşmesini bozar.

Diğer dönüşüm sınırları da açıktır: hamleler ve çözüm yolları iç içe JSON dizileridir; `frame.compacted` boş hücreler için `null` içerir; yeni taşlarda `falls.from` değeri `null` olur. Bunları `-1` veya `0` ile değiştirmeyin. C# tarafında hamle yapısı, `int?[]` ara değerler ve nullable kaynak indeksleri kullanılabilir; wire JSON aynı kalır. JSON yükleyicisi tür birliğini, iç içe dizileri, nullable değerleri ve zorunlu alanların varlığını desteklemelidir. `JsonUtility` tek başına bu genel oyun sözleşmesini doğrudan çözmez. Mevcut düz ödül DTO'larında kullanılması, bütün oyun verisinin aynı yöntemle okunabileceği anlamına gelmez.

Oyun ve katman değerleri tamsayıdır. RNG `uint`, sayaçlar ve zaman damgaları gerektiğinde `long` olmalıdır; JS'nin güvenli tamsayı sınırı aşılmamalıdır. Puanı veya büyük tohumları önce işaretli 32-bit sayıya okuyup sonra dönüştürmeyin. İpucu sıralama ağırlıkları C# `double` ile hesaplanmalıdır; `float` eşdeğer değildir. JSON alan sırası karşılaştırmada anlam taşımaz; hücre, palet, hamle ve sonuç dizilerinin sırası taşır.

## Motor snapshot v4 ve deneme v1

Motorun kanonik snapshot alanları:

```text
version: 4
rulesVersion: "classic-v4"
values: int[]
layers: int[]
score: integer
movesLeft: integer
turn: integer
rngState: uint32
history: [ [a, b], ... ]
```

`history` yalnızca geçerli takasları içerir. Bu sürümde `turn = level.moves - movesLeft` ve `history.length = turn` olur. Yükleyici doğru bölüm/varyantın başlangıcını kurar, geçmişi baştan oynatır ve değerleri, katları, puanı, kalan hamleyi, turu ve RNG durumunu karşılaştırır. Yalnızca şekil kontrolü yeterli değildir. Hücrelerin tamamen yeşil sayısı ayrıca güvenilir bir alan olarak alınmaz; kalan katlardan türetilir.

Deneme kimliği ayrı tutulur:

```text
attemptVersion: 1
levelId: number | string
variantId: string
levelDataVersion: string
attemptId: string
attemptSerial: safe integer
```

Saf `HexAttempts` API'si `start`, `resolveLevel`, `restore`, `checkpoint` ve `list` işlemlerini sağlar. `checkpoint(metadata, engine)` dışa taşınabilir `{...metadata, snapshot}` zarfı üretir. Bilinmeyen sürüm/varyant, yanlış Level ID türü, biçimi bozuk deneme kimliği ve aynı anda iki farklı kimlik kaynağı reddedilir. Hatalı yeni varyant kaydı eski orijinal kayıt diye yorumlanmaz.

Ana bölüm deneme kimliği `a-{levelId}-{attemptSerial}-{selectorStateHex8}` biçimindedir; hexadecimal bölüm küçük harfli ve sekiz hanelidir. Eski ana kayıt `legacy-{levelId}` ve seri `0` ile tanınır. Öğreticide uygulama katmanı `t-{tutorialId}-{serial}` veya eski kayıt için `legacy-{tutorialId}` üretir. Öğretici kimlik politikası kampanya varyant seçicisinden ayrıdır.

Tarayıcı saklama anahtarı **`hexrota-match-v5` değişmedi**. `boards[stageIndex]` hâlâ ham motor snapshot v4'tür; `attempts[stageIndex]` paralel kimlik kaydıdır. Aynı JSON yazımında saklanırlar. `attemptStats`, `variantSelection`, öğretici onayları, kayıtlar ve tercihler motor snapshot'ına karıştırılmaz. Aşama indeksi `0/1` T1/T2, `2…11` ana bölüm `1…10` demektir; bu indeks Level ID değildir. Eski ana kayıtlar metadata yoksa orijinal tanımla açılır. Daha eski v4 saklama anahtarından taşınan kampanya indekslerinin iki kaydırıldığı mevcut geçiş de korunur.

`attemptSerial` küresel kimlik sayacıdır; olaylardaki `attemptNumber` bölüm başına gözlemlenen deneme sayısıdır. Eski kaydın bilinmeyen geçmiş deneme sayısı uydurulmaz. İlerlemeyi sıfırlama bölüm sayaçlarını temizlerken seri/seçim durumunu korur; eski kimlikler yeniden üretilmez. Native kayıt adaptörü bu ayrımı korumalıdır. Motor sürümü, saklama anahtarındaki sürüm, veri sürümü ve deneme zarfı sürümü dört farklı kavramdır.

## Deterministik hesaplama sırası

Bu kurallar aktarımda yeniden tasarlanmayacak referans davranışlardır:

1. Hücre dizisinin sırası sabittir; hücre indeksleri bütün geçmiş ve vektörlerde sıfır tabanlıdır. Komşuluk yönleri `[1,0]`, `[0,1]`, `[1,-1]` ve tersleridir. Eşleşme düz çizgide en az üç aynı değerdir; bükülen üçlü eşleşmez. Bir dalganın eşleşen indeksleri benzersiz ve artan sıradadır.
2. Geçerli takas önce iki değeri değiştirir. Eşleşme oluşmadıysa tam geri alınır: RNG, puan, katlar, tur ve hamle değişmez. Bir geçerli takas bütün zinciriyle yalnızca bir hamle harcar.
3. Eşleşen her hücre puana bir kez katılır; o hücrenin kalan katı aynı dalgada en fazla bir azalır ve sıfırın altına inmez. Zemin hücreye aittir, taşla düşmez. Puan çarpanı yoktur.
4. Sütunlar `q` artan, içlerindeki hücreler `r` artan sıradadır. Bütün sütunlar önce sıkıştırılır. Kalan taşların sırası korunur ve boşluklar üstte kalır. Ancak bundan sonra yeni değer üretimine geçilir. Eşit rakamlı iki taşın düşüş kaynağı aynı kabul edilmez.
5. Yeni boşluklar aynı sütun/hücre sırasında doldurulur. Her palet adayı için o noktada oluşacak yeni üçlü pencereleri sayılır; minimumu sağlayan adaylar palet sırasıyla tutulur. **Her yeni taşta, tek aday olsa da tam bir RNG adımı** kullanılır. Bütün adaylar üçlü oluşturuyorsa en azını oluşturan seçilir; sonsuz yeniden deneme yapılmaz. Kalan taşların düşüşünden oluşan gerçek zincirler korunur.
6. Oyun RNG'si xorshift32'dir: `x ^= x << 13; x ^= x >>> 17; x ^= x << 5`, sonuç unsigned 32-bit olur. Başlangıç sıfırsa `0x9e3779b9` kullanılır. C# `uint` ve gerektiğinde `unchecked` ile aynı bit desenini üretmeli; sağa kaydırma mantıksal olmalıdır. Modulo sıralı aday sayısına uygulanır. Başka bir rastgele sayı API'si eşdeğer değildir.
7. Çözümleme bütün dalgalar bitene kadar sürer. Üst sınır 32 dalgadır; devam eden eşleşme varsa mevcut stabil tahta güvenlik yolu uygulanır. Oynanır durumda yasal takas kalmadıysa, her seferinde önceki tabandan başlayan en fazla 128 sıralı karıştırma denenir; sonra mevcut 64 denemeli stabil kurulum ve sabit örüntü geri dönüşü kullanılır. Bu işlem puan, kat, tur veya hamle eklemez. Nadir stabil kurulum geri dönüşü taş çokluğunu korumak zorunda değildir. Bu sınırları veya RNG tüketimini port sırasında değiştirmek ayrı kural sürümü gerektirir.
8. Kazanma önceliği: önce puan ve bütün katların sıfır olması değerlendirilir, sonra hamle tükenmesi. Son geçerli hamlede kazanılır. Yayınlanan bölümler `score >= target` kullanır; mevcut motorun isteğe bağlı `targetMode: exact` dalı kampanyada etkin değildir.

Varyant seçicinin RNG'si oyun RNG'sinden ayrıdır. Adaylar katalog dizisi sırasında alınır; önce önceki ve yakın geçmişteki varyantlar elenir, aday kalmazsa yalnızca önceki elenir, tek adaylı durumda son geri dönüş kullanılır. Seçim bir xorshift adımı kullanır. Başlangıç seçimi cüzdan, ödeme, reklam, ipucu veya kaybetme sayısıyla gizli bir başarı ayarı yapmaz. Ön izleme seçim durumunu tüketmez. Yeni deneme kurulmadan ve doğrulanmadan eski ilerleme silinmez; kayıp sonrası tekrar yeni varyant, devam etme ise aynı snapshot'tır.

## İpucu ve sunum sınırı

İpucu çıktısı `pair`, `source`, `guaranteed`, `continuation`, `searchedNodes`, `depth`, `truncated` alanlarını taşır:

| `source` | Anlam |
| --- | --- |
| `proven_route` | Geçmiş, doğrulanmış yollardan birinin başıyla eşleşir; kalan geçerli yol geri verilir. |
| `search_win` | Mevcut durumdan sınırlı arama içinde gerçekten kazanma yolu bulundu. |
| `heuristic` | Yasal ve ilerlemeye yönelik öneri; kazanma garantisi veya tamamlanmış yol yok. |

`guaranteed` yalnızca ilk iki sınıfta doğrudur. Garanti yolu klonda tekrar oynatılarak test edilir. Kaybedilmiş dallar ileride kurtarılacak oynanır durum gibi genişletilmez. Arama, canlı tahta ve oyun RNG'sini değiştirmez.

Ortak testler `maxNodes` kullanır; pozitif açık düğüm bütçesinde saat kesmesi devre dışıdır. Derinlik en fazla 3, ışın genişliği varsayılan 10/en fazla 32; açık düğüm bütçesi en fazla 100000'dir. Eşit sıralama değerlerinde üretim sırası korunur. C#'ta eşitlikte sıra değiştiren `List.Sort` yerine kararlı sıralama veya açık genişletme sıra numarası kullanılmalıdır. `.8` ve `.35` ağırlıklarının işlem sırası ve `double` hesabı korunur.

Çalışma zamanında web worker için 90 ms/derinlik 3, ana iş parçacığı geri dönüşünde 12 ms/derinlik 1 istenir; istenen zaman bütçesi en fazla 150 ms olarak kabul edilir. Kesme düğümler arasında kontrol edildiği için tek bir çözümleme bu bütçeyi aşabilir. Bunlar fiziksel telefon performans garantisi değildir. Unity'de saf arama ayrı işte çalışabilir; sonuç görüntülenmeden deneme kimliği ve turla eşleştirilmeli, eski sonuçlar iptal edilmelidir. Fiziksel cihaz bütçeleri ayrıca ölçülmelidir. Planlama botunun aramada gelecekteki deterministik üretimi görebilmesi de insan başarısı tahmini olarak kullanılmaz.

Görsel sistem `SwapResult` içindeki dalgaları ve düşüş kimliklerini tüketir. Sonuç önce kesinleşir ve kaydedilir; animasyon iptali, azaltılmış hareket, arka plan, ekran boyutu veya gecikmiş callback puanı ve RNG'yi tekrar hesaplamaz. Reward Director gerçek deneme kimliğiyle geçerli hamle başına bir kez değerlendirilir; yüklemede geçmiş sessizce yeniden kurulur. Ödül kuralı puan, hamle ve kazanma koşulunu değiştirmez. Unity tween, ses ve titreşim tercihleri uygulama/sunum katmanına aittir.

## Yerel olaylar ve ileride ekonomi

Mevcut olay sözleşmesi [ANALYTICS.md](ANALYTICS.md) içindedir. `HexEvents` saf doğrulama/ekleme yapar; `hexrota-events-v1` kaydı varsayılan son 500 olayı saklar. Olay ayrıntıları iç içe `details` nesnesi değil düz alanlardır. `hintKind` kaynak sınıfını, dizge olan `hintGuarantee` ise `certified_route`, `bounded_search`, `none` veya `guided` değerini taşır. Saat, saklama ve ileride ulaşım adaptörünün sorumluluğudur; motor sonucu olay kaydı yazılamadığı için değişmez. Bu tampon eksiksiz insan tutma veya mağaza dönüşüm veritabanı değildir.

Ekonomi için [ECONOMY_DESIGN.md](ECONOMY_DESIGN.md) ve tasarım JSON'u kullanılır. Henüz cüzdan, ürün veya ekonomik komut çalışmaz. Gelecekteki `Swap`, `GrantMoves`, `ClearCell`, `RerollCell`, `ReduceGroundLayer` günlüğü, takas sayısı ile komut sırasını ayırmalı; RNG, ücret ve uygunluk aynı doğrulanabilir işlemde bağlanmalıdır. Bu **gelecek kayıt/kural sürümüdür**; v4 geçmişine gizlice hamle eklemek veya hücre temizlemek doğru değildir. Yeni sürüm numarası ve kesin komut semantiği henüz kararlaştırılmadı; eski snapshot v4 okuyucusu korunmalıdır.

Reward Director v1 en az üç taş eşleşen dalgalar ve sıralı takaslar bekler. Tek taş temizleme veya normal hamle harcamayan yardım bu sözleşmeye doğrudan sığmaz. Üç taş eşleşmiş gibi veri uydurulamaz. Ayrı yardım geri bildirimi veya sürümlü ödül adaptörü, komut/hamle/ödül sırası ayrımıyla ayrıca tasarlanmalı ve test edilmelidir. Ücretsiz kazanılan ve satın alınan Altınla aynı komut aynı oyunu üretmelidir; satış kaynağı motor girdisi değildir.

## Ortak doğrulama vektörleri

`fixtures/gameplay-vectors.json` sürüm 1, gerçek kabul edilmiş katalogdan üretilmiş sabit beklenen çıktıları taşır:

| Kapsam | Sayı / içerik |
| --- | --- |
| Sabit öğretici yolları | T1 ve T2'nin tamamı. |
| Eski ana bölüm yolları | 10 orijinal ana yolun tamamı. |
| Varyant girdileri | 40 varyantın ilk iki doğrulanmış takası; her biri gerçek tohum ve deneme kimliğiyle. Bunlar tam çözüm yolu diye sunulmaz. |
| Bileşen örnekleri | 19 örnek: üç yön, bükülen grup, dört uint RNG başlangıcı, kesişim, ayrı kazanma koşulları, son hamle, doğal zincir, eşit sayıların düşüş kimliği, zorunlu minimum üretim ve hamlesiz tahta. |
| Seçim örnekleri | 80 ardışık seçim; seri, geçmiş filtresi ve ayrı seçim RNG'si. |
| Reddedilen denemeler | 9 yanlış bölüm/tür/varyant/sürüm/kimlik/zarf/uydurulmuş skor örneği. |

Toplam **71 oyun örneği, 162 geçerli takas, 56 yükleyip devam etme, 80 seçim ve 9 reddetme** JS tarafında kontrol edilir. Tam dalga çıktıları; puan, katlar, sıkıştırılmış değerler, üretim sırası, gerçek düşüş kaynakları ve sonuç snapshot'ıyla karşılaştırılır. İpucunun açık düğüm bütçeli çıktısı da saklanır. Bileşen örnekleri test için ara durum enjekte edebilir; bunlar yayımlanabilir başlangıç veya geçerli oyuncu kaydı değildir.

Bu dosya bütün olası oyunları kanıtlamaz. Varyantların iki bağımsız kazanma yolu ve denge sınırları ayrıca varyant testleriyle doğrulanır. 32 dalga güvenlik yolu ve bütün nadir geri dönüşler için C# portunda ek adversarial/özellik testleri gereklidir; tek bir mevcut hamlesiz tahta örneği bütün bu dalların çalıştırıldığı anlamına gelmez.

```sh
node export-game-config.cjs --check
node generate-gameplay-vectors.cjs --check
node check-gameplay-vectors.cjs
npm run test:gameplay-vectors
npm test
npm run test:unity-rewards
```

`generate-gameplay-vectors.cjs` bilinçli yeniden üretim aracıdır; `--check` dosyayı yazmaz. `check-gameplay-vectors.cjs` üreticiyi çağırmadan kontrol edilen JSON'u tekrar oynatır. Beklenen sonuç değişirse yalnızca yeniden üretip geçmek yerine kural/veri değişiminin gerekçesi incelenmelidir. Şu anda bu kontrol JS oyun davranışını doğrular; C# oyun motorunu çalıştırmaz.

Mevcut C# ödül karşılaştırması ayrı olarak `fixtures/reward-vectors.json` içindeki **104 vektör ve durum fabrikasını** .NET 8 ile C# 7.3 derleyerek karşılaştırır. 98 geçerli ve 7 reddedilen değerlendirme sayısı fabrika dahil toplamdır. Bu, bir Unity/iOS/Android paket testi değildir ve C# oyun çekirdeğinin tamamlandığı anlamına gelmez.

## Aktarım sırası ve bitiş kapıları

1. JSON okuyucu, typed `LevelKey`, sıralı veri yapıları ve `XorShift32` yazılır. Bütün RNG/kimlik/reddetme vektörleri eşleşir.
2. Topoloji, eşleşme, takas, düşüş ve kontrollü üretim aktarılır. Tam dalgalar ve snapshot'lar JS golden dosyasıyla alan alan karşılaştırılır; yalnızca sonuç puanı karşılaştırılmaz.
3. Zincir, karıştırma, kazanma, klon ve replay doğrulaması eklenir. Öğreticiler ve eski on çözümün bütün adımları aynı kalır; bozuk kayıtlar reddedilir.
4. Katalog, seçim, deneme kimliği, bütün varyant çözüm yolları ve düğüm bütçeli ipucu aktarılır. Aynı durumdan devam eden üretim ve garanti yolları karşılaştırılır. C# oyun parity komutu bu aşamada yazılacak; henüz depoda yoktur.
5. Ödül adaptörü gerçek deneme kimliğiyle mevcut C# Reward Director'a bağlanır. Tek değerlendirme, sessiz yükleme, animasyon iptali ve tercih testleri geçer.
6. Unity giriş, çizim, ses, titreşim, uygulama yaşam döngüsü ve yerel kayıt adaptörleri eklenir. Aynı hamle günlüğüyle masaüstü ve hedef fiziksel telefonlarda durum eşitliği, input gecikmesi ve bellek ölçülür.
7. Ekonomi kararı verilirse ücretsiz çekirdeğin kabulünden ayrı bir sürümde komut günlüğü, cüzdan, ödül adaptörü ve yardımlı sonuç testleri yapılır. Ücretsiz doğrulanmış yollar bu geçişin ön koşulu olarak kalır.

## Unity öncesi açık kararlar

- Gerçek oyuncularda ilk bağımsız hamle, puan/alan amacı, yeniden deneme ve zor/rahat bölüm ritmi; bot oranları insan oranı değildir. Kabul verileri [LEVEL_DESIGN.md](LEVEL_DESIGN.md) içindedir.
- Unity sürümü, genel JSON okuyucusu ve iç içe diziler/kimlik birliği için DTO adaptörü; hedef cihazlar ve iş parçacığı/performans bütçesi.
- C# gameplay test çalıştırıcısının API'si ve CI kapısı; mevcut ortak dosyalar hazır, çalıştırıcı ve oyun portu uygulanmadı.
- Mevcut Level ID altında taban yapılandırma değiştirilecekse eski taban verilerin arşivlenmesi ve bozuk/bilinmeyen kayıt için kurtarma akışı.
- Yardım ürünlerinin hangilerinin gerçekten gerekli olduğu, ücret adayları, tam komut semantiği, yardımlı sonuç ayrımı ve Reward Director'ın takas dışı eylem sözleşmesi.
- Cihaz değiştirme/kayıt eşitleme, kalıcı haklar ve mali işlem doğrulama; yalnızca yerel replay, ödeme güvenliği sağlamaz.

Bu kararlar görsel uygulama veya gelecekteki ürün kapsamıdır. Mevcut eşleşme, puan, düşüş, üretim, iki kazanma koşulu, eski kayıt tekrarı ve ücretsiz doğrulanmış başlangıç kuralları C# aktarımında yeniden tasarlanmayacaktır.
