# Hexrota — Unity aktarım planı

## Mevcut durum ve aktarım hedefi — 9.3

Oynanışın referansı saf JavaScript motoru, sürümlü bölüm verileri ve kayıtlı test çıktılarıdır. Unity aktarımında önce aynı girdiden aynı oyun sonucunu üreten C# çekirdeği kurulmalı; çizim, ses, titreşim, dokunma ve cihaz servisleri bunun dışına bağlanmalıdır.

9.2 Phase 1 ile `unity/Gameplay/` altında **saf C# 7.3 oyun çekirdeği** uygulanmıştır. Topoloji, eşleşme, takas, düşüş, kontrollü üretim, RNG, zincir, puan/zemin, kazanma/kaybetme, snapshot, klon ve replay gerçek .NET 8 çalıştırıcısıyla JS referansına karşılaştırılır. Ayrıntılı kapsam ve sınırlar [CSHARP_GAMEPLAY_PHASE1.md](CSHARP_GAMEPLAY_PHASE1.md) içindedir. `unity/Rewards/` içindeki mevcut Reward Director korunur. Unity sahnesi, mobil paket, gerçek ödeme ve canlı reklam entegrasyonu yapılmadı. 9.3 çalışma dallarında katalog/seçici, deneme kimliği, LifeManager, ipucu, ödül adaptörü, saf uygulama oturumu, profil deposu/geçişi ve olay sözleşmesi eklendi. Web mevcut JS uygulamalarını kullanmaya devam eder; C# web uygulamasına bağlanmaz. Birleşik C# kabul testleri gerçek .NET 8 ile geçti; dört bağımsız PR ve Integration PR kullanıcı onayına bırakılmıştır. Bu doğrulama Unity cihaz entegrasyonu değildir. Uzak CI ve Vercel Preview sonucu Integration PR kontrollerinde izlenir; ayrıntılı yerel kanıt [CSHARP_9_3_VALIDATION.md](CSHARP_9_3_VALIDATION.md) içindedir.

| Alan | Bu sürümde uygulanan | C# durumu |
| --- | --- | --- |
| Eşleşme, takas, düşüş, üretim, zincir, kazanma | `dist/engine.js`, `classic-v4` | `unity/Gameplay/` içinde uygulandı; tam dalga/snapshot parity testi var. |
| 10 ana bölüm, her birinde 4 doğrulanmış varyant | `dist/variants.json`, `dist/attempts.js` | `unity/Catalog/`: `LevelCatalog`, `VariantSelector`, sürüm çözümü ve deneme/checkpoint DTO’ları uygulandı; 40 varyant/80 yol gerçek karşılaştırma kapsamındadır. |
| T1/T2 | Sabit sayılar, tohumlar, yönlendirmeler | Katalog sabit öğretici verisini ve kimliğini yükler; controller yönlendirilmiş takası/onayı yönetir. Unity öğretici ekranı ve sunumu yapılmadı. |
| Kayıt devamı ve eski kayıt okuma | Snapshot v4, deneme kimliği v1, eski hamleleri tekrar oynatma | Motor replay + katalog zarfı uygulandı. `unity/Application/` profil DTO’su, legacy normalizasyonu ve atomik CAS deposunu içerir; controller 28 gerçek web akışında 915 tam JSON karşılaştırmasını geçti. Native kalıcı depolama adaptörü yapılmadı. |
| İpucu | Çoklu doğrulanmış rota, sınırlı arama, açık garanti bilgisi | `unity/Hints/HintSolver.cs`: üç kaynak sınıfı, doğrulanmış devam, düğüm bütçesi ve dış monoton saat politikası uygulandı. |
| Ödül yöneticisi | Saf JS + C# 7.3, ortak ödül vektörleri | Mevcut Director korundu; `unity/RewardAdapter/` dalga girdisi/restore portu eklendi. Unity sunumu ayrı iştir. |
| Yerel olaylar | `dist/events.js`, tarayıcıda sınırlı yerel tampon | `GameEventTracker` aynı saf doğrulama/ekleme sözleşmesini uygular; 580 gerçek JSON karşılaştırması var. Kalıcı yazım `IProfileStorage` dış adaptöründedir. |
| Can | `dist/lives.js`, kanonik `lives-config.json`, ayrı kayıt ve sahte sağlayıcı | `unity/Lives/` güncel `lives-v2` portu, dış saat/doğrulayıcı ve v1 geçişi uygulandı. Uygulama katmanı ayrı TEST sağlayıcı/cüzdanı içerir; gerçek SDK yoktur. |
| Ekonomi | Genel tasarım JSON'u; 9.1'de yalnızca TEST can cüzdanı/ürünleri | Gerçek mali sistem ve oyun içi yardım komutları uygulanmadı. |

## Modül eşlemesi

Aşağıdaki tablo uygulanmış saf çekirdekle gelecekteki uygulama/cihaz modüllerini ayırır. Çekirdekte ilgili davranışlar bağımsız servis adlarıyla yeniden yazılmadı; mevcut JS sınırını koruyan `HexMatch` ve `BoardTopology` içinde bulunur.

| Bileşen | Mevcut JS/veri kaynağı | C# karşılığı ve sınırı |
| --- | --- | --- |
| Hexagonal Board Model | `HexMatch`, `topology()` | Uygulandı: `Cell`, `BoardTopology`, `HexMatch`; sıralı hücreler, değerler, katlar, komşular, çizgiler ve sütunlar. Görsel konum hesaplamaz. |
| Match Detection | `findMatches()` | Uygulandı: `HexMatch.FindMatches`; üç düz yönde en az üç eşit değer, kesişimler tek sayılır. |
| Swap Validator | `adjacent()`, `legalMoves()`, `swap()` başlangıcı | Uygulandı: `Adjacent`, `LegalMoves`, `Swap`; geçersiz işlem durumu korur. |
| Gravity System | `_gravity()` | Uygulandı: `Gravity`; kalan taş sırası ve gerçek kaynak/hedef kimlikleri korunur. |
| Controlled Refill | `_newMatchesAt()`, `_fillVacancies()` | Uygulandı: `NewMatchesAt`, `FillVacancies`; sıralı minimum üçlü adayları ve aynı RNG tüketimi. |
| RNG | `_random()`, deneme seçicinin `randomStep()` işlevi | `XorShift32` ve `HexMatch.Random` uygulandı; `VariantSelector` ayrı seçim RNG durumunu kullanır; motor RNG’sini değiştirmez. |
| Cascade Resolver | `swap()` çözümleme döngüsü | Uygulandı: `HexMatch.Swap`; bütün dalgalar tek hamlede, sunumdan önce kesinleşir. |
| Level Configuration | JS kaynakları, JSON dışa aktarımları ve varyant paketi | Uygulandı: `LevelCatalog.FromDocuments`, `ResolveLevelWire`, `GameplayConfig`; değişmez taban + seçilen başlangıç/tohum/çözüm yolları. Çözülmüş tam veri wire map, oyun verisi mevcut `LevelConfig` olur; ayrı `ResolvedLevelConfig` tipi icat edilmedi. |
| Variant Selection | `HexAttempts.createCatalog().start()` | Uygulandı: `VariantSelector.Select/RandomStep`, `AttemptMetadata`, `AttemptStart`, `AttemptCheckpoint`, `LevelDataVersionResolver`; yayın sırasını ve kimlik türünü korur, mağaza veya ödeme girdisi almaz. |
| Hint Solver | `hint()` | Uygulandı: `HintSolver.Find`, `HintRoutes.Create`, `HintOptions`, `HintResult`, dış `IHintClock`; klonlarda çalışır ve üç kaynak sınıfını ayırır. |
| Save/Load | `_restore()`, `HexAttempts.restore()/checkpoint()`, uygulama bağlantısı | `HexMatch.Snapshot`, `Clone`, `Replay`, `Restore` uygulandı. `Restore` geçmişi yeniden oynatıp bütün motor alanlarını karşılaştırır; `AttemptRepository`, `SaveMigration`, `SaveValidator`, `GameProfile`, `ProfileRepository` ve `IProfileStorage` uygulandı; gerçek cihaz dosya/DB adaptörü henüz yoktur. Controller’ın 28 gerçek web akışı ve ayrıca 11 native hata senaryosu doğrulanır; UI kaynaklı revision yazım adetleri ayrı repository testiyle ayrılır. |
| Reward Director | `rewards.js`, `reward-adapter.js`, `reward-rules.json` | Mevcut `RewardDirector.cs`, `RewardTypes.cs` korunur; `Hexrota.RewardAdapterCore.RewardAdapter.RunsFor/Summarize/Restore` gerçek dalgaları ve replay geçmişini Director DTO’suna dönüştürür. |
| Life Manager | `dist/lives.js`, `lives-config.json` ve uygulama bağlantısı | Uygulandı: `LifeManager`, `LifeConfig`, `LifeState`, `LifeSettlement`, `LifeTransaction`, `LifeOperationResult`; dış `IUtcClock`/`IReceiptVerifier`. Motor RNG/snapshot’ına dokunmaz. Kalıcı saklama LifeManager’ın sorumluluğu değildir. |
| Economy Rules | `data/economy-design.json`, `life-providers.js` ve ekonomi belgesi | `DevelopmentLifeProvider` ve controller’daki TEST cüzdanı akışı uygulandı. Gerçek `EconomyRules`, ticari cüzdan/SDK ve oyun yardımları gelecekte yapılır. |

`dist/app.js` içindeki ekran yönetimi, giriş, kayıt servisi ve sunum tek bir C# oyun motoruna kopyalanmamalıdır. Unity tarafında deneme akışını yöneten bir uygulama katmanı, saf çekirdekten ayrı bir sunum katmanı ve cihaz adaptörleri gerekir. Bu katmanın mevcut davranışı; ön izleme, onaylı yeniden başlatma, devam etme ve sonuç ekranı testlerinden alınır.

## Veri kaynakları ve sürümler

| Dosya | Sözleşme | Kullanım |
| --- | --- | --- |
| `data/levels-original.json` | `schemaVersion: 1`, `kind: campaign`, `levelDataVersion: original-v1`, `rulesVersion: classic-v4` | Eski ana bölüm kayıtlarını açacak değişmez orijinal tanımlar. |
| `data/tutorials-fixed.json` | `schemaVersion: 1`, `kind: tutorial`, `levelDataVersion: tutorials-v1`, `rulesVersion: classic-v4` | Sabit T1/T2, çözüm yolları, adımlar ve mevcut metinler. |
| `dist/variants.json` | `schemaVersion: 1`, `levelDataVersion: variants-v1` | Ana bölüm başına 4 başlangıç, tohum, en az iki farklı ilk takasla kazandıran yol ve analiz bilgileri. |
| `dist/difficulty-rules.json` | Veri içindeki şema ve analiz parametreleri | Çevrimdışı bot davranışları, kabul aralıkları ve bölüm ritmi. Oynarken sonucu değiştiren bir ayar değildir. |
| `dist/reward-rules.json` | Ödül kuralı sürümü 1 | Sadece görsel/işitsel/dokunsal geri bildirim kararları. |
| `dist/lives-config.json` | `schemaVersion: 1`, `rulesVersion: lives-v1` | 5 can, 30 dakika yenilenme, test fiyatları, reklam sınırları ve isteğe bağlı ilk kayıp koruması. Web sarmalayıcısı `lives-config.js`; C# kanonik JSON'u okur. |
| `data/economy-design.json` | `schemaVersion: 1`, `rulesVersion: economy-draft-v2`, `status: design_only`, `loadedByPrototype: false` | Genel ekonomi önerileri ve ayrı 9.1 TEST can alt kümesi. Bu dosya yüklenmez; uygulanan can değerlerinin kaynağı `lives-config.json` olur. |

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

`1` ve `"1"` deneme doğrulamasında aynı kimlik değildir. Mevcut C# katalog kimliği `object` olarak türüyle taşır; `Wire.TypeKey`/strict karşılaştırma sayı-dizge ayrımını korur. Ayrı `LevelKey` tipi uygulanmış gibi kabul edilmez; platform JSON adaptörü bu ayrımı korumalıdır. Bütün kimlikleri körlemesine `int` veya `string` yapmak eski kayıt sözleşmesini bozar.

Diğer dönüşüm sınırları da açıktır: hamleler ve çözüm yolları iç içe JSON dizileridir; `frame.compacted` boş hücreler için `null` içerir; yeni taşlarda `falls.from` değeri `null` olur. Bunları `-1` veya `0` ile değiştirmeyin. C# tarafında hamle yapısı, `int?[]` ara değerler ve nullable kaynak indeksleri kullanılabilir; wire JSON aynı kalır. JSON yükleyicisi tür birliğini, iç içe dizileri, nullable değerleri ve zorunlu alanların varlığını desteklemelidir. `JsonUtility` tek başına bu genel oyun sözleşmesini doğrudan çözmez. Mevcut düz ödül DTO'larında kullanılması, bütün oyun verisinin aynı yöntemle okunabileceği anlamına gelmez.

Oyun ve katman değerleri tamsayıdır. RNG doğrudan `uint` okunur; `4294967295` dahil unsigned tohumlar işaretli dönüşümden geçirilmez. Phase 1 çekirdeği yayımlanmış bölüm kümesinin sayı, puan, hamle ve indeksleri için `int` kullanır; bu test edilen küme `Int32` sınırındadır. Gelecekte sınırı aşan yapılandırma kabul edilecekse DTO/hesap tipi ve ortak testler açıkça genişletilmelidir; keyfi büyüklükte JS sayılarına parity iddiası yoktur. Sayaç ve UTC zamanları gerektiğinde `long` olmalı, JS güvenli tamsayı sınırı aşılmamalıdır. İpucu sıralama ağırlıkları C# portunda `double` ile hesaplanır; `float` eşdeğer değildir. JSON alan sırası karşılaştırmada anlam taşımaz; hücre, palet, hamle ve sonuç dizilerinin sırası taşır.

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

Saf JS `HexAttempts` API’si `start`, `resolveLevel`, `restore`, `checkpoint` ve `list` işlemlerini sağlar; C# karşılıkları `LevelCatalog.Start`, `ResolveLevelWire`, `Restore`, `Checkpoint` ve `List` olur. `checkpoint(metadata, engine)` dışa taşınabilir `{...metadata, snapshot}` zarfı üretir. Bilinmeyen sürüm/varyant, yanlış Level ID türü, biçimi bozuk deneme kimliği ve aynı anda iki farklı kimlik kaynağı reddedilir. Hatalı yeni varyant kaydı eski orijinal kayıt diye yorumlanmaz.

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

Ekonomi için [ECONOMY_DESIGN.md](ECONOMY_DESIGN.md) ve tasarım JSON'u kullanılır. 9.1'de yalnızca ayrı TEST Altın cüzdanı ve sahte can ürünleri çalışır; gerçek para, canlı reklam veya oyun içi ekonomik yardım komutu yoktur. Gelecekteki `Swap`, `GrantMoves`, `ClearCell`, `RerollCell`, `ReduceGroundLayer` günlüğü, takas sayısı ile komut sırasını ayırmalı; RNG, ücret ve uygunluk aynı doğrulanabilir işlemde bağlanmalıdır. Bu **gelecek kayıt/kural sürümüdür**; v4 geçmişine gizlice hamle eklemek veya hücre temizlemek doğru değildir. Yeni sürüm numarası ve kesin komut semantiği henüz kararlaştırılmadı; eski snapshot v4 okuyucusu korunmalıdır.

Reward Director v1 en az üç taş eşleşen dalgalar ve sıralı takaslar bekler. Tek taş temizleme veya normal hamle harcamayan yardım bu sözleşmeye doğrudan sığmaz. Üç taş eşleşmiş gibi veri uydurulamaz. Ayrı yardım geri bildirimi veya sürümlü ödül adaptörü, komut/hamle/ödül sırası ayrımıyla ayrıca tasarlanmalı ve test edilmelidir. Ücretsiz kazanılan ve satın alınan Altınla aynı komut aynı oyunu üretmelidir; satış kaynağı motor girdisi değildir.

## Can v2 — taşınabilir ek sözleşme

9.2 can yöneticisinin kuralları [LIVES_DESIGN.md](LIVES_DESIGN.md) içinde dondurulmuştur. Bu katman iki ayrı işi yapar: yeni ana denemenin açılmasına izin vermek ve gerçek bir denemenin can sonucunu kimliğiyle bir kez kaydetmek. `HexMatch` içine can, tarih, cüzdan veya reklam verisi girmez. Mevcut 40 varyantın ve eski on bölümün kazanma yolları aynıdır.

C# `LifeManager`, `createManager(config, { clock, verifyReceipt })` sözleşmesinin uygulanmış karşılığıdır; yapılandırma `LifeConfig`, saat `IUtcClock`, makbuz güveni `IReceiptVerifier` üzerinden sağlanır. Clock UTC milisaniye `long` döndürür; her açık geçişte tek zaman örneği kullanılır. Saf çekirdek `DateTime.UtcNow`, Unity sahnesi, reklam/ödeme SDK'sı veya depolama çağırmaz. Doğrulayıcı enjekte edilir; verilmemiş doğrulayıcı bütün makbuzları reddeder. Unity'nin gerçek sağlayıcısı gelecekte bu sınırın dışına bağlanır; `development` makbuzu gerçek para kanıtı değildir. Can çekirdeği sağlayıcı adını bu test değerine kilitlemez; güvenilirliği enjekte edilen doğrulayıcı belirler, böylece gerçek adaptör eklendiğinde can kuralları yeniden yazılmaz.

Can DTO'su: `schemaVersion: 2`, `rulesVersion: lives-v2`, `registeredAttempts`, `pendingAdLives`, `settledArchive`, `transactionArchive`, `transactionStreams`, `lives`, nullable `regenAnchorUtc`, `lastSeenUtc`, nullable `unlimitedUntilUtc`, `developerBypass`, `settledAttempts`, `processedTransactions`, `protectionUsed`, `firstFailures`, `adUsage`. Can 0…5 tamsayıdır. Bütün UTC alanları güvenli JS tamsayı aralığında `long`; `null`, sıfırla değiştirilmez. Günlük reklam anahtarı `floor(effectiveUtc / 86400000)` olur, yerel saat dilimi değildir. `number:1` ve `string:1` koruma anahtarları farklı kalır.

Mantıksal can zarfı oyundan ayrıdır; `hexrota-profile-v2.energy` kanonik alanı ve `hexrota-lives-v1` uyumluluk aynası şu biçimdedir:

```text
hexrota-lives-v1:
  schemaVersion: 1
  life: LifeStateV2
  testWallet:
    schemaVersion: 1
    gold: integer
    processedTransactions: { transactionId: { productId, goldDelta, atUtc } }
  provider:
    schemaVersion: 2
    namespace: string
    nextSerial: safe integer
    adAvailable: boolean
    transactions: { transactionId: development provider record }
    finalizedRanges: [[inclusiveStart, inclusiveEnd]]
```

`hexrota-match-v5` hâlâ tahta/varyant/RNG/hamle geçmişidir. Native kayıt adaptörü oyun ile can/TEST işlem zarfını aynı atomik profil işleminde saklamalı; başarısız yazımı başarı diye göstermemelidir. Oyuncu ilerlemesini sıfırlamak, can sayacını veya işlenmiş makbuz kimliklerini sıfırlamaz.

Eski makbuzun beş alanı: `transactionId`, `productId`, `provider: development`, `status: completed`, `verifiedAtUtc`. Yeni test makbuzları ayrıca doğrulanan `streamId`/`sequence` taşır; sağlayıcı v2 eski biçimi de okur. Ürünler `ad_life`, `single_life`, `refill_lives`, `unlimited_lives_30m`; açık test Altın yüklemesi sağlayıcı/cüzdanda ayrı `test_gold_300` ürünüdür. Doğrulayıcı makbuzu sağlayıcının tamamlanmış kaydıyla karşılaştırır; ödül miktarı veya fiyat callback'ten alınmaz. Aynı kimlik bir kez uygulanır; doğrulanmış fakat uygun olmayan işlem de tekrar ödüle dönmesin diye kaydedilir. Can ve işlem kimlikleri sessizce budanmaz; `maxLedgerEntries` ayrıntılı kayıt saklama eşiğidir; yeni oyunu engellemez. Tam kimlikli arşivler ve yalnızca doğrulanmış seri akışları için kapalı aralıklar tekrar bildirimi korur.

C# can portunda aynı sırayla korunan kurallar:

1. Etkin zaman `max(clockUtc, lastSeenUtc)` olur. Geri alınan saat canı geri çekmez veya sınırsız/reklam hakkını yeniden yaratmaz; saat yakalayana kadar ilerleme donabilir. İleri alınan cihaz saati yerel prototipte güvenilir mali süre otoritesi değildir.
2. Eksik can için geçen tam 30 dakikalar eklenir. İlk kayıp aralığı başlatır; sonraki kayıp veya +1 ödül mevcut aralığı kaydırmaz. Beşe ulaşınca başlangıç `null` olur; daha sonra eksilirse o andan yeni aralık başlar.
3. Sınırsız hak normal yenilenmeyle birlikte çalışır; normal bakiyeyi zorla doldurmaz. Yeni doğrulanmış hak `max(etkinŞimdi, eskiBitiş) + 30 dakika` uzatır. Tekrar callback uzatmaz.
4. Ana kayıp ve geçerli takas sonrası onaylı sıfırlama Attempt ID başına en fazla bir can harcar. Onaysız sıfırlama, menü, kapanma ve öğretici ücretsizdir. 0 can yeni denemeyi engeller; kapatılmamış geçerli kayıt devam edebilir. Son canla onaylı sıfırlamada eski kimlik kapanır, 0 iken aynı kimlik ücretsiz geri açılamaz. Zaten 0 canla oynanmış kaydı sıfırlama açıkça onaylanırsa `empty` muafiyetiyle kapanır; borç tutulmaz, daha sonra kazanılan can tekrar kesilmez. Onaysız yeni deneme engeli veya iptal eski kaydı kapatmaz. Onay sırasında süre nedeniyle maliyet yükselirse kesintiden önce yeni açıklama ve yeniden onay gerekir.
5. Bütün ilerlemeyi sıfırlama onayı, doğrulanmış açık ve oynanmış ana denemelerin gerçek toplam can maliyeti varsa bunu önceden gösterir. Bütün sonuçlandırmalar tek can zarfında kesinleşmeden oyun kaydı temizlenmez; can/TEST Altın/koruma/işlem kimlikleri ve seçim kimliği sayacı korunur.
6. İlk özellik geçişi eski bitmiş sonuçları `historical` olarak kabul eder, ücret almaz. Sonraki kesinti sonrası henüz işlenmemiş yeni sonuçlar tek kez uzlaştırılır. Bypass/sınırsız/koruma nedeniyle ücretsiz sonuç da kayıtlı kalır; ayar kapanınca geriye dönük ücret çıkmaz.
7. Gelecekte +3/+5 aynı denemeyi açarsa ilk can sonucu korunur: ikinci kayıp yeniden kesmez, kazanma yeni kesinti veya otomatik iade üretmez. Yardım komutu uygulaması hâlâ yeni oyun-kuralı/kayıt sözleşmesi gerektirir.

`fixtures/lives-vectors.json` güncel can portunun ortak beklenen JSON’udur; `fixtures/lives-vectors-v1.json` dondurulmuş eski kayıtları korur. `test:unity-lives` .NET 8 ile C# 7.3 portunu gerçekten derleyip tam durum/sonuç/görünüm JSON’unu karşılaştırır. Güncel fixture 19 senaryo ve 157 geçiş/probe içerir; v1 geçişleri, uzun günlük ve ek reddetme/saat/makbuz kontrolleri ayrıca çalışır. Kesin güncel toplam ve kapsam [CSHARP_LIVES.md](CSHARP_LIVES.md) ile komut çıktısında tutulur; eski 9.2’deki “C# can portu yok” durumu artık geçerli değildir.

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
npm run test:unity-gameplay
npm run test:unity-catalog
npm run test:unity-lives
npm run test:unity-hints
npm run test:unity-reward-adapter
npm run test:unity-session
```

`generate-gameplay-vectors.cjs` bilinçli yeniden üretim aracıdır; `--check` dosyayı yazmaz. `check-gameplay-vectors.cjs` üreticiyi çağırmadan kontrol edilen JSON'u JS tarafında tekrar oynatır. Beklenen sonuç değişirse yalnızca yeniden üretip geçmek yerine kural/veri değişiminin gerekçesi incelenmelidir. Ayrı `test:unity-gameplay` komutu C# 7.3 çekirdeğini .NET 8 ile gerçekten derler ve çalıştırır; SDK yoksa başarısız olur. Ortak 71 örneğin mekanik çıktıları, 80 tam sertifikalı varyant yolu ve 120 ek yasal hamle dizisi karşılaştırılır. Snapshot devamı, açık `Replay`, değiştirilebilir dizilerden bağımsız `Clone`, klonda bir sonraki takas ve reddedilen kaydın önceki durumu bozmaması da denetlenir. Phase 1 gameplay komutu seçici veya ipucu portu sayılmaz; 9.3’te bunlar ayrıca `test:unity-catalog` ve `test:unity-hints` altında gerçek C# karşılaştırmasına alınmıştır. 80 seçim ve 9 deneme-zarfı fixture’ı katalog kontrolüne de dahil edilir. Ayrıntılı sayılar ve sınırlamalar Phase 1 belgesindedir.

Mevcut C# ödül karşılaştırması ayrı olarak `fixtures/reward-vectors.json` içindeki **104 vektör ve durum fabrikasını** .NET 8 ile C# 7.3 derleyerek karşılaştırır. 98 geçerli ve 7 reddedilen değerlendirme sayısı fabrika dahil toplamdır. Bu, bir Unity/iOS/Android paket testi değildir ve C# oyun çekirdeğinin tamamlandığı anlamına gelmez.

## 9.3 modülleri ve bitiş kapıları

| Katman | Gerçek C# API / veri sınırı | Kabul kapısı |
| --- | --- | --- |
| Ortak değerler | `unity/Contracts/Wire.cs`: strict sayı/tür, safe integer, eksik/null, derin kopya/eşdeğerlik | Ayrıntılar [CSHARP_WIRE_CONTRACTS.md](CSHARP_WIRE_CONTRACTS.md); yeni modül karşılaştırmalarında ortak kullanılır. |
| Katalog ve deneme | `LevelCatalog.FromDocuments/Start/Restore/Checkpoint/List`, `VariantSelector`, `AttemptMetadata`, `AttemptCheckpoint`, `LevelDataVersionResolver` | `npm run test:unity-catalog`; 40 varyant, 80 tam yol, seçim sırası, legacy ve bozuk veri. [CSHARP_CATALOG.md](CSHARP_CATALOG.md). |
| Gameplay | `BoardTopology`, `HexMatch`, `XorShift32`, snapshot/clone/replay | Mevcut `test:unity-gameplay` korunur; nadir güvenlik yollarının tamamının veya fiziksel cihazın ispatı değildir. |
| Can | `LifeManager` + DTO’lar, `IUtcClock`, `IReceiptVerifier` | `npm run test:unity-lives`; v2 sonuçları, frozen v1 geçişi, tekilleştirme ve uzun günlük. [CSHARP_LIVES.md](CSHARP_LIVES.md). |
| İpucu | `HintSolver.Find`, `HintRoutes.Create`, `HintOptions`, `HintResult`, `IHintClock` | `npm run test:unity-hints`; düğüm bütçeli deterministik sonuç/garanti, kaynak rota ve dış saat politikası. [CSHARP_HINTS.md](CSHARP_HINTS.md). |
| Ödül | Mevcut `RewardDirector` + `RewardAdapter.RunsFor/Summarize/Restore` | `test:unity-rewards` ve `test:unity-reward-adapter`; Director vektörleri, tam dalga girdileri ve sessiz yükleme. [CSHARP_REWARD_ADAPTER.md](CSHARP_REWARD_ADAPTER.md). |
| Profil ve uygulama | `GameSessionController`, `SessionCommand`, `AttemptRepository`, `GameProfile`, `ProfileRepository`, `SaveValidator`, `SaveMigration` | `npm run test:unity-session`; 915 tam JSON karşılaştırması, 28 gerçek `app.js` akışı ve ayrıca 11 native hata/guard senaryosu yerelde geçti. [CSHARP_APPLICATION.md](CSHARP_APPLICATION.md). |
| Yerel olay | `GameEventTracker.CreateState/Validate/ValidateState/Append`, ham JSON için `CreateStateRaw/AppendRaw` | `node check-event-parity.cjs`: 580 tam JSON karşılaştırması, 462 birebir ret mesajı ve bütün girdilerde değişmezlik yerelde geçti; session komutunun parçası olarak CI’a bağlanır. |

Bu modüller C# 7.3 sözdizimiyle saf çekirdektir. `unity/ParitySupport/WireJson.cs` ile `*ParityHarness` projeleri **.NET 8 test host’larıdır**; `System.Text.Json`, console veya dosya okumasının orada bulunması Unity çekirdeğinin bunlara bağımlı olduğu anlamına gelmez. Üretim Unity JSON adaptörü ayrıca seçilecek. SDK bulunamadığında C# yerine JS sonucunu başarı diye döndüren yol yoktur.

İpucu güven sınırı kaynak varsayımından açıkça ayrılır: mevcut JS yazar yollarının zaten sertifikalı olduğunu varsayar. C# `HintRoutes.Create` hatalı/kazanmasız rota bağını reddeder, garantili devamı klonda yeniden doğrular. Yayımlanmış güvenilir yollar doğrudan parity kapsamındadır; bu ek C# reddetmesi JS’nin aynı girdiyi reddettiği gibi raporlanmaz. Gerçek duvar saatiyle kesilen iki aramanın aynı düğümde durduğu iddia edilmez.

### Uygulama akışı ve atomik depolama

`GameSessionController`, katalog, Gameplay, HintSolver, LifeManager ve Reward Adapter’ı birleştirir. `Preview` aktif kaydı veya seçim RNG’sini değiştirmez. `Enter`, `Swap`, `Hint`, `Retry`, `Restart`, `ReturnToMenu`, `Close`, `ResetProgress` ve TEST ürün akışları saf servisleri çağırır; ekran çizmez. T1/T2 yönlendirilmiş takasları/onayları controller tarafından okunur; metin/görsel sunumu Unity host’una aittir.

`SessionCommand.expectedRevision`, `attemptId`, `turn`, UI’nın gözlediği komut zarfıdır. Gecikmiş/çift UI callback’leri aynı zarfı taşımalı; eski revizyon/deneme/tur reddedilmelidir. Yeni sahne bu korumayı atlayarak her callback’te yeni zarf üretmemelidir. Makbuz tekrarları ayrıca gerçek işlem kimliğiyle tekilleştirilir. İpucu sonucu gösterilmeden de aynı deneme/tur bağı korunmalıdır.

Kanonik profil `hexrota-profile-v2 = { schemaVersion: 2, revision, game, energy }` biçimini korur. `ProfileRepository.Commit`, tek `IProfileStorage.CompareExchange(key, expectedRevision, next)` çağrısında oyun ve canı birlikte yazar. Uyum aynaları `hexrota-match-v5` / `hexrota-lives-v1` kanonik başarıdan sonra onarılabilir; ayna veya olay yazımı hatası başarılı oyunu geri almaz. Kanonik yazım hatasında controller önceki oyun/can/olay durumuna dönmelidir. Başarısız hamleye ait olay kalıcı yazımdan önce gönderilmez.

`IProfileStorage` yalnız `Contains`, `Read`, atomik `CompareExchange` ve `Write` sınırını tanımlar. `MemoryProfileStorage` gerçek test/in-memory uygulamasıdır; **iOS/Android dosya, DB, kilitleme, crash-safe rename/fsync veya bulut eşitlemesi değildir**. Native kalıcı adaptör atomiklik, beklenen revizyon, kalıcı başarı/hata sonucu ve süreçler arası yarış semantiğini sağlamalıdır. Tek bir profil dosyasını art arda iki normal yazımla kaydetmek bu sözleşmenin karşılığı olmaz. Yeni native kayıt biçimi henüz icat edilmedi.

`SaveMigration` mevcut v5 alanlarını normalize eder; v4/v3/v2 anahtarlarından mevcut iki öğretici indeks kaydırmasını korur. `AttemptRepository` doğru veri sürümünü katalogdan bulup snapshot geçmişini gerçek motorla doğrular. Hatalı/bilinmeyen profil veya snapshot yeni bir oyun gibi sessizce kabul edilmemelidir. Sıfır canla geçerli açık denemeye devam, kapanma/menü, son canla onaylı restart ve bekleyen ödülün tekrar teslimi birleşik oturum kapısının parçasıdır; bu akışlar gerçek JS/C# karşılaştırması ve ayrıca native hata testleriyle doğrulanmıştır.

### Entegrasyondan sonra kalan platform işleri

1. Unity proje/sahne kurulumu ve platform JSON + `IProfileStorage` adaptörü; UI, altı yönlü dokunma, üst çizim katmanındaki karşılıklı takas, animasyon, ses, titreşim ve yaşam döngüsü bağları.
2. Unity/Mono/IL2CPP, AOT, hedef fiziksel telefonlarda deterministik replay, giriş gecikmesi, bellek ve ipucu zaman bütçesi. C# 7.3/.NET Standard derlemesi bunların yerine geçmez.
3. Gerçek ticari sağlayıcı, güvenilir saat/doğrulama, cüzdan ve ekonomik yardım komutları ayrı kapsamdır; mevcut ücretsiz yollar ve eski okuyucular korunmalıdır.

## Unity öncesi açık kararlar

- Gerçek oyuncularda ilk bağımsız hamle, puan/alan amacı, yeniden deneme ve zor/rahat bölüm ritmi; bot oranları insan oranı değildir. Kabul verileri [LEVEL_DESIGN.md](LEVEL_DESIGN.md) içindedir.
- Unity sürümü, genel JSON okuyucusu ve iç içe diziler/kimlik birliği için DTO adaptörü; hedef cihazlar ve iş parçacığı/performans bütçesi.
- Unity üretim JSON ve kalıcı `IProfileStorage` adaptörü; native atomiklik/revizyon ve bozuk kayıt kurtarma kullanıcı akışı. C# can/katalog/ipucu portları ve gerçek parity komutları uygulanmıştır; controller’ın birleşik kabul testleri geçmiştir; Unity host ve gerçek cihaz doğrulaması ayrıca yapılmalıdır.
- Mevcut Level ID altında taban yapılandırma değiştirilecekse eski taban verilerin arşivlenmesi ve bozuk/bilinmeyen kayıt için kurtarma akışı.
- Yardım ürünlerinin hangilerinin gerçekten gerekli olduğu, ücret adayları, tam komut semantiği, yardımlı sonuç ayrımı ve Reward Director'ın takas dışı eylem sözleşmesi.
- Cihaz değiştirme/kayıt eşitleme, can saati otoritesi, kalıcı haklar ve mali işlem doğrulama; yerel replay, cihaz saati veya sahte sağlayıcı gerçek ödeme/reklam güvenliği sağlamaz.

Bu kararlar görsel uygulama veya gelecekteki ürün kapsamıdır. Mevcut eşleşme, puan, düşüş, üretim, iki kazanma koşulu, eski kayıt tekrarı ve ücretsiz doğrulanmış başlangıç kuralları C# aktarımında yeniden tasarlanmayacaktır.

## Dondurulmuş 9.2 can/profil sözleşmesi — 9.3 portunda korunur

`LifeStateV2`, `lives-v2` kural kimliğidir. `registerAttempt` çağrısı başlangıçtaki `unlimitedAtStart` hakkını kalıcı saklar; C# portu süre bitişinde bunu yeniden hesaplamaz. `pendingAdLives` aktif havuzdan ayrıdır: tamamlanan doğrulanmış reklam dolu havuzda saklanır, yer açılınca uygulanır. Aktif can üst sınırı yine 5'tir. Eski v1 DTO geçişi bakiye, zaman ve sonuç kimliklerini korur; eski kaydın bilinmeyen başlangıç hakkı tahmin edilmez.

Depolama adaptörü `ProfileV2 { schemaVersion, revision, game, energy }` zarfını **tek atomik işlem** olarak saklar. `game`, `hexrota-match-v5` ilerleme sözleşmesidir; içindeki motor snapshot sürümü **v4** kalır. Can çekirdeğine oyun RNG'si veya Unity API girmez. `energy` can durumunu, TEST cüzdanını ve sağlayıcı günlüğünü içerir. Native uygulama profil yazımı başarısızken tahta ve canı birlikte geri almalı; yalnızca canı kesinleştirmemelidir. Tek yazıcı/mutex ve revizyon kontrolü platform adaptörünün sorumluluğudur. Webin Web Locks tercihi saf C# çekirdeğine taşınacak bir bağımlılık değildir.

`registeredAttempts`, ayrıntılı sonuç/işlem kayıtları ve tam kimlikli sıkıştırılmış arşivler JSON nesneleridir. `transactionStreams`/sağlayıcı `finalizedRanges` kapsayıcı başlangıç/bitiş aralıklarıdır; keyfi kimliklerin sayısal bölümünü varsayarak silmek yasaktır. Günlük eşiği oyunu kilitlemez. Ortak `fixtures/lives-vectors-v1.json` geçmişi ve `fixtures/lives-vectors.json` v2 sonuçları artık `test:unity-lives` altında gerçekten derlenmiş C# ile karşılaştırılır. Uygulama/profil bileşimi ayrıca `test:unity-session` kabul kapısındadır; native kalıcı adaptör hâlâ gelecekteki platform işidir. Kesin uygulama ayrıntıları [LIVES_DESIGN.md](LIVES_DESIGN.md) içindedir.

Unity projesine yalnız saf `Gameplay`, `Rewards`, `Contracts`, `Catalog`, `Lives`, `Hints`, `RewardAdapter` ve `Application` kaynakları alınmalıdır. `ParitySupport` ile `*ParityHarness` klasörleri .NET 8 test host’larıdır; Unity Assets içine oyun script’i olarak kopyalanmaz. JSON okuyucusu ve kalıcı dosya/DB adaptörü host tarafında bağlanır.

## 9.5 tek tamamlama ve ekonomi sözleşmesi

Saf JS `dist/economy.js` → C# `unity/Economy/EconomyManager.cs`; tek kanonik yapılandırma `data/economy-config-9-5.json` → üretilen `dist/economy-config.js` / `EconomyDefaults.cs`. Kampanya, sayısal kalıcı Level ID üzerinden tek kazanma hakkı taşır; öğretici string ID'leri aynı kimlik değildir. Variant/Attempt/veri sürümü değişimi yeni ilk ödül üretmez. `claimedLevelIds`, `clearedLevelIds`, Altın, yıldız, stok, migration kanıtı ve sıralı işlem ledger'ı `Game.economy` sürüm 1 DTO'sudur. Dış profil 2, eski snapshot 4, attempt metadata 1, LifeState 2 korunur.

JS app ve C# GameSessionController gerçek motor/replay sonucundan ödül bağlamını üretir; ekonomi/can/oyun aynı revision kontrollü ProfileRepository commit'inde yazılır. Sıradan reset kalıcı hakları ve kanıt arşivlerini silemez. Eski geçerli tamamlamalar kapanır; retro ödül yalnız doğrulanmış replay'den verilir. Kanıtı eksik haklar açık inceleme durumundadır. TEST Altını yeni oyun Altınına çevrilmez.

Aşama A gerçek karşılaştırması `npm run test:unity-economy` ve `test:unity-session` ile derlenen .NET 8/C# 7.3'tür. B/C yardım komutları ve ikinci şans için sürümlü zarf ayrı aşamalarda eklenecektir; Unity sahnesi veya mobil SDK bu katmanın parçası değildir. Güncel aşama durumu: [ECONOMY_9_5_DELIVERY.md](ECONOMY_9_5_DELIVERY.md).

### 9.5 B yardım ve stok sözleşmesi

`dist/commands.js` → `unity/Commands/AssistedGame.cs` (C#7.3). Yeni kanonik zarf `version:1/rulesVersion:assisted-v1/commandsVersion:1/baseRulesVersion:classic-v4`; typed Level ID, Attempt ID, frozen limits, usage, bonusMoves, assisted, sıralı commands ve tam board sonucu taşır. Eski v4 yalnız geçerli swap history'dir ve olduğu gibi doğrulanır. C# `AttemptRepository.RestoreSession` klasik veya yardımlı envelope'u gerçek katalog/replay'den yükler. Envanter ledger'ı ve komutlar aynı kimlik/Attempt/Level/ürün üzerinden iki yönlü eşleşir. Saf mekanik tek başına stok veya ödeme yetkisi vermez. Host ön izleme onayını güncel revision/tahta/Attempt/komut sayısına bağlar; commit stok+oyun+can+ilk ödülü tek işlemde saklar.

İpucu yardım sonrasında authored routes almadan güncel kopyada çalışır. Reward Director v1 normal takasta korunur; yardımlı akış için null state/plan ve temel gerçek dalga sunumu kullanılır, sahte klasik süreklilik üretilmez. Unity UI aynı sözleşmeleri görsele bağlayacak; bu PR sahne veya SDK oluşturmaz. Ayrıntı [ASSISTED_COMMANDS_9_5.md](ASSISTED_COMMANDS_9_5.md) / [INVENTORY_9_5.md](INVENTORY_9_5.md).
