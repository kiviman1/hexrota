# Hexrota 9.14 — Malzeme toplama ve bölüm hedefleri

9.14, mevcut normal uygulamada **`/?dev=materials-9-14`** adresinden açılan izole bir mekanik alfadır. Aynı menü, yolculuk haritası, tahta, giriş adaptörü, `HexMatch`, atomik profil işlemi ve hamle sunumu kullanılır. On kampanya bölümü baştan seçilebilir; sayısal 6/7/8, Ahşap / Çivi / Karma A/B/C örnekleridir. Ayrı bir demo motoru veya ikinci oyun durumu kurulmaz.

Bu bölümler hedef ve malzeme sözleşmesini denemek içindir; insanlarla dengelenmiş kampanya bölümleri olarak değerlendirilmez. Serbest seçim için sahte öğretici tamamlanması, yıldız, Altın veya `done` kaydı üretilmez. Gerçek oynanışın tamamlanma ve ekonomi işlemleri mevcut sahiplerinde kalır. Main/Production'a geçiş bu geliştirici girişinin bir sonucu değildir.

Mevcut sınırlar [ARCHITECTURE.md](ARCHITECTURE.md), bölüm ilkeleri [LEVEL_DESIGN.md](LEVEL_DESIGN.md), engel/aktivasyon kuralları [OBSTACLES_AND_REGIONS_9_12.md](OBSTACLES_AND_REGIONS_9_12.md), büyük şekiller ve void ayrımı [LARGE_BOARDS_9_12.md](LARGE_BOARDS_9_12.md) içinde korunur. Bu belge yalnız yeni `classic-v6` sözleşmesini ekler.

## Sürümler ve sahiplik

| Kavram | 9.14 değeri / sorumluluğu |
| --- | --- |
| Oyun kuralları | `classic-v6`; aynı JS ve saf C# `HexMatch` |
| Motor checkpoint'i | Snapshot `version: 6` |
| Engel tanımları | `obstacles-v1`; v5 hasar, AND-geçit ve `column-flow-v1` kuralları |
| Malzeme tanımları | `materials-v1` |
| Etkin hedefler | `objectives-v1` |
| Alfa bölüm verisi | `levelDataVersion: "material-alpha-v1"` |
| Alfa varyantı | `variantId: "materials-v1"`; malzeme şemasıyla aynı yazılan ayrı katalog alanı |
| Deneme zarfı | Mevcut `attemptVersion: 1` |
| Fiziksel kayıt öneki | `hexrota-material-9-14:` |

`classic-v4` / snapshot v4 ve `classic-v5` / snapshot v5 tanımları kendi okuyucularıyla devam eder. Eski kampanya, öğreticiler ve arşiv flow bölümleri malzeme hedefi varmış gibi yeniden yorumlanmaz; eski snapshot'lara sıfır sayaç eklenerek v6 oluşturulmaz. V4/v5 motor çıktısına v6 `status` veya malzeme alanları eklenmez. V6 hedef/malzeme tanımları v4/v5 bölümlere takılamaz.

Snapshot sürümü, veri sürümü, varyant kimliği, profil zarfı ve tarihsel `hexrota-match-v5` anahtarı farklı kavramlardır. Profil zarfı `hexrota-profile-v2`, mevcut revision/CAS ve tek `game + energy` commit'i korunur. Yeni malzemeler denemeye ait bölüm ilerlemesidir; çanta, cüzdan, kümes envanteri veya kalıcı inşa stoğu değildir. T1/T2'nin öğretici turundan türetilen dekoratif Tahta/Çivi sayacı da bu motor sayaçlarının yerine geçmez.

| Dosya / alan | Sahibi |
| --- | --- |
| `dist/engine.js`, `unity/Gameplay/HexMatch.Materials.cs` | Kaynağın uygunluğu, bir kez toplama, sayaçlar, hedef ve nihai sonuç |
| `unity/Gameplay/GameplayTypes.cs` | Malzeme/hedef/olay/snapshot DTO'ları |
| `unity/Catalog/CatalogWire.cs` | Taşınabilir JSON değerlerinin tür ve alan doğrulaması |
| `data/material-alpha-levels-v1.json` | Unity'ye de aktarılabilen tam sürümlü alfa bölüm tanımları |
| `dist/material-alpha-levels.js` | Aynı verinin `HEX_MATERIAL_ALPHA_LEVELS` tarayıcı sarmalayıcısı |
| `dist/material-alpha.js`, `unity/Catalog/MaterialAlphaCatalog.cs` | Alfa veri/deneme kimliği, klasik kataloğa delegasyon ve strict restore |
| `dist/app.js` | Mevcut komut/commit/rollback sınırı ve sunum yaşam döngüsü |
| `dist/material-view.js` / `HexMaterialView` | Saf ikon, kaynak işareti ve kanonik sayaç projeksiyonu |
| `dist/move-presentation.js` | Kesinleşmiş dalgalardaki toplama olaylarının görsel sırası |

## Bölüm verisi

Aşağıdaki parça alan adlarını gösterir; `cell` ve `blockerId` referansları tam bölüm verisine aittir. Tek başına oynanabilir bölüm değildir.

```json
{
  "rulesVersion": "classic-v6",
  "levelDataVersion": "material-alpha-v1",
  "variantId": "materials-v1",
  "target": 290,
  "obstacles": {
    "version": "obstacles-v1",
    "blockers": [{"id":"crate-a","cell":5,"hp":2}],
    "regions": []
  },
  "materials": {
    "version": "materials-v1",
    "definitions": [{"id":"wood"},{"id":"nail"}],
    "sources": [
      {"id":"wood-a","kind":"crate-break","materialId":"wood","quantity":1,"cell":5,"blockerId":"crate-a"},
      {"id":"nail-a","kind":"matched-cell","materialId":"nail","quantity":1,"cell":8}
    ]
  },
  "objectives": {
    "version": "objectives-v1",
    "score": true,
    "ground": true,
    "materials": [{"materialId":"wood","quantity":1},{"materialId":"nail","quantity":1}]
  }
}
```

`materials.definitions` sırası sayaç dizisinin sırasıdır; `materials.sources` sırası toplama bayraklarının sırasıdır. Sunum `wood` için Ahşap, `nail` için Çivi adını kullanır. Alfa A/B yalnız kullandığı malzemeyi tanımlar; C ikisini tanımlar. Çekirdek davranışı Türkçe etikete veya bölüm ID'sine bağlanmaz.

V6, **zorunlu** `obstacles` nesnesiyle v5 kurallarını taşır. Engel kullanmayan bir bölümde `{ "version":"obstacles-v1", "blockers":[], "regions":[] }` geçerlidir. `column-flow-v1` seçilirse kaynak sütunu, kapalı hücre, `cellOpen` ve erişilebilirlik kuralları aynen sürer. `materials.sources`, `obstacles.sources` ile aynı şey değildir: ilki tek kullanımlık malzeme kaynakları, ikincisi fiziksel taş akışının sütun başlangıçlarıdır.

### Doğrulama

- Malzeme tanımı ve kaynak ID'leri benzersizdir; 1–80 karakterlik `[A-Za-z0-9_.-]` biçimindedir. Kaynak/hedef `materialId` değeri mevcut bir tanımı göstermelidir. Her malzeme için en fazla bir hedef satırı bulunur.
- Kaynak `quantity` ve hedef `quantity`, **1…2.147.483.647** aralığında tamsayıdır. Aynı malzemenin bütün kaynak miktarlarının toplamı da signed int32 sınırını aşamaz. Hedef toplam arzdan büyük olamaz. Sayısal dizge, kesir, NaN, negatif/sıfır miktar veya taşma reddedilir.
- `cell`, aynı bölümdeki sıralı `level.cells` dizisinin geçerli indeksidir. Ekran koordinatı, 9×9 kapasite indeksi veya başka bölümün indeksi kullanılamaz. Void için kaynak oluşturulamaz.
- `crate-break` kaynağında `blockerId` zorunludur; mevcut kutuyu ve **aynı hücreyi** göstermelidir. Kutunun malzeme vermesi için açık kaynak tanımı gerekir.
- `matched-cell` kaynağında `blockerId` alanı bulunmaz; kutunun kendi hücresine yerleştirilemez. Hücre, üç axial eksenden en az birinde **üç ardışık gerçek hücreden oluşan bir pencerenin** üyesi olmalıdır; hiçbir olası üçlü çizgisi bulunmayan gerçek uç hücre malzeme arzı sayılmaz. Bu v6'ya özgü geometrik kontrol solver veya RNG çalıştırmaz; başlangıçta kapalı fakat geometrik olarak eşleşebilir arazi hücresine kaynak konabilir. Toplamak için önce açılması ve gerçekten eşleşmesi gerekir.
- Farklı kaynak ID'leri aynı hücrede bulunabilir; aynı kutuya birden fazla kaynak bağlanabilir. Hücre başına tek kaynak varsayımı kurulmaz. Tekilleştirme hücreye veya malzeme türüne göre yapılmaz.
- `materials`, tanım/kaynak nesneleri, `objectives` ve hedef satırları bu sürümün belirtilen alanlarını taşır. Eksik/bilinmeyen alanlar, bilinmeyen şema veya kaynak türü reddedilir. Diziler boşluklu/sparse olamaz.
- `score` ve `ground` açık boolean değerlerdir. En az biri `true` olmalı veya malzeme hedef listesi boş olmamalıdır. Yalnız zorunlu kutuların varlığı, boş etkin hedef listesini geçerli yapmaz. Puan/zemin hedefi etkinse malzeme tanımları, kaynaklar ve malzeme hedefleri boş olabilir.

Arz doğrulaması biçimsel imkânsız hedefleri eler; oyuncunun hedefe hamle bütçesi içinde erişebileceğinin kanıtı değildir. Yayımlanan alfa verisinin yolları ayrıca gerçek motorla doğrulanır; bu da insan zorluk dengesi ölçümü değildir.

## Hedefler ve nihai sonuç

Kazanmak için **bütün etkin hedefler AND koşuluyla** tamamlanır:

1. `objectives.score === true` ise mevcut `target` / `targetMode` puan koşulu.
2. `objectives.ground === true` ise bütün gerçek hücrelerin katlarının sıfır olması.
3. Her malzeme hedefinde ilgili kanonik sayaç `>= quantity`.
4. V5'ten gelen bütün zorunlu kutu ve bölgeler; `required:false` istisnası aynı kalır.

Puan hedefi etkin değilse puan yine gerçek eşleşmelerden hesaplanır, fakat kazanmayı engellemez; `targetMode:"exact"` aşımı da kayıp üretmez. `target` alanı mevcut bölüm biçimindeki geçerli tamsayı alanı olarak kalır. Zemin hedefi kapalıyken katlar yine gerçek eşleşmelerle temizlenir, fakat kalan katlar tek başına kazanmayı engellemez. Malzeme toplamak ayrıca puan, hamle veya kat temizliği vermez.

Puan hedefi etkin olduğunda `targetMode:"exact"`, tam eşitlik ister ve aşım mevcut kayıp kuralını kullanır; diğer mevcut hedef modu `score >= target` davranışındadır. Nihai sonuç `playing`, `won` veya `lost` olur. Bütün zincir çözüldükten sonra önce kazanma değerlendirilir; son hamlede bütün koşullar tamamlanırsa sonuç `won` olur. Tamamlanmamış koşulla sıfır hamle `lost` olur. UI sayaç, tik veya animasyon callback'inden yeni bir kazanma hesabı çıkaramaz.

## Bir dalgada toplama sırası

Geçerli takas ve bütün zincirleri yine tek hamledir. Kesişen eşleşmelerin hücre kümesi dalga başına benzersizdir. V6 aşağıdaki sırayı ekler:

1. Gerçek eşleşen hücreler belirlenir; mevcut puan ve zemin işlemleri uygulanır.
2. **Kutu hasarından önce**, bu dalgada gerçekten eşleşen oynanabilir hücrelerin toplanmamış `matched-cell` kaynakları toplanır.
3. Gerçek komşu eşleşme mevcut kuralla her kutuya dalga başına en fazla bir hasar verir.
4. **HP gerçekten sıfıra düştükten sonra**, yalnız o dalgada kırılan kutulara bağlı toplanmamış `crate-break` kaynakları toplanır.
5. Bölge/`cellOpen` aktivasyonu güncellenir; mevcut segmentli q düşüşü, kontrollü refill ve sonraki eşleşme çalışır.

Her türün olayları kendi kaynak tanım sırasıyla üretilir; aynı dalgada önce bütün `matched-cell`, ardından bütün `crate-break` olayları gelir. HP 2→1 hasarı malzeme vermez. Aynı kutuya birden fazla komşu eşleşme, aynı kaynağı tekrar vermez. İki katlı bir hücre tekrar eşleştiğinde zemin ilerleyebilir; daha önce alınmış çivi tekrar verilmez.

Hücre kaynağı düşen sayı taşına bağlı değildir; hücrede kalır. Takasla üstünden geçmek, düşüş, refill, bölge açılması, karıştırma veya animasyon toplama sayılmaz. Yeni açılan hücredeki çivi ancak gerçek bir sonraki eşleşmede alınır. Toplamanın kendisi RNG tüketmez, taş üretimini veya düşüş sırasını değiştirmez. Mevcut güvenlik/hamlesiz tahta kurtarması malzeme üretemez ve toplama bayraklarını sıfırlayamaz.

Bir kaynak alındığında, tanım indeksindeki `collectedSources[i]` bir kez `true` olur ve ilgili malzemenin `materialCounts[j]` değerine tanımlı miktar eklenir. Aynı hücrede farklı ID'li iki kaynak varsa her biri kendi miktarını bir kez verir. Bu durum restore, clone ve replay boyunca korunur.

## Snapshot, dalga ve strict restore

Snapshot v6 mevcut taş, kat, puan, hamle, tur, RNG ve geçmiş alanlarına v5 engel alanlarını ve şunları ekler:

```text
version: 6
rulesVersion: "classic-v6"
obstacleVersion: "obstacles-v1"
materialVersion: "materials-v1"
objectiveVersion: "objectives-v1"
materialCounts: int32[materials.definitions.length]
collectedSources: bool[materials.sources.length]
status: "playing" | "won" | "lost"
```

`blockerHp` ve `regionOpen` tanım sırasıyla taşınır. Yalnız `column-flow-v1` için `cellOpen: bool[level.cells.length]` bulunur. `materialCounts` negatif olamaz. `status`, saklanan fakat restore sırasında motordan yeniden doğrulanan sonuçtur; bağımsız yazılabilir bir sonuç bayrağı değildir.

Her v6 eşleşme dalgası şu alanları taşır; hiç toplama yoksa olay listesi boştur:

```text
materialEvents: [{sourceId, materialId, quantity, cell, kind}]
materialCounts: int32[]       // bu dalga sonundaki kümülatif toplam
collectedSources: bool[]     // bu dalga sonundaki kümülatif kaynak bayrakları
```

Olayın `kind` değeri `matched-cell` veya `crate-break` olur. `blockerId` olayda tekrar taşınmaz; gerekirse `sourceId` ile değişmez tanımdan bulunur. Her dalga kendi dizi kopyasını verir; sonraki dalga önceki sonucu değiştiremez. Olaylar kanonik değişimin sunum kanıtıdır; restore sırasında sayaçlara yeniden eklenmez.

Restore önce doğru `levelId + levelDataVersion + variantId` tanımını çözer. Aynı başlangıç/seed ile geçmişin tamamını yeniden oynatır; taşlar, katlar, skor, hamle, tur, RNG, HP, bölge/akış, sayaçlar, kaynak bayrakları ve sonuç aynı olmalıdır. Geçmiş yalnız kabul edilmiş takasları taşır; `turn = level.moves - movesLeft = history.length` korunur. V6 wire alan kümesi ve dizi tür/uzunlukları da doğrulanır. Eksik/fazla alan, sahte sayaç veya bayrak, yanlış sonuç, hayali kaynak, yanlış veri/kurallar sürümü ve geçmişle uyuşmayan checkpoint reddedilir; sessiz yeni oyun oluşturulmaz.

Clone bütün mutable çalışma dizilerini ve geçmiş çiftlerini ayırır. Değişmez bölüm tanımı/topoloji paylaşılabilir; bir clone'un malzeme dizisini değiştirmek diğer oyunu değiştiremez. Aynı geçmiş aynı olayları ve aynı snapshot'ı üretmelidir. Kanonik durumun geri alınması gerektiğinde yalnız görsel iş değil, snapshot'taki sayaçlar/bayraklar da mevcut rollback sınırında geri yüklenir.

## İzole normal uygulama ve alfa verileri

`HexMaterialAlpha` açık `dev=materials-9-14` query'sini seçer. Kayıt adaptörü bütün mantıksal anahtarlara `hexrota-material-9-14:` önekini uygular; örnekler:

```text
hexrota-material-9-14:hexrota-profile-v2
hexrota-material-9-14:hexrota-match-v5
hexrota-material-9-14:hexrota-profile-writer-v2
```

Normal profil ve `hexrota-flow-9-12:` arşivi kendi ad alanlarında kalır. Aynalar, olay/playtest kayıtları, tercihler ve test reset'i aynı izole adaptörden geçmelidir; global Storage prototipi değiştirilmez. Writer-lock ve CAS mevcut mantıksal sözleşmeyi kullanır. Mevcut can geliştirme bypass'ı yalnız bu izole profil içinde kullanılabilir.

| Sayısal bölüm | Senaryo | Etkin hedefler | Gerçek hücre |
| --- | --- | --- | ---: |
| 6 | A — Ahşap | `wood` kaynaklarını topla; zorunlu kutu/bölgeler | 43 |
| 7 | B — Çivi | `nail` hücre kaynaklarını topla; zorunlu kutu/bölgeler | 49 |
| 8 | C — Karma | Ahşap + çivi + puan + zemin; zorunlu kutu/bölgeler | 53 |

A/B'de puan ve zemin hedefleri kapalıdır. Veriler mevcut büyük flow şekillerinin tam kopyalarından türetilir; kaynak hücreleri, miktarlar ve hedefler kanonik alfa JSON'unda bulunur. 9×9 kapasite yine 81 gerçek hedef anlamına gelmez. Void hücre, taş, hit target veya malzeme kaynağı üretmez.

Yalnız 6/7/8 yeni `material-alpha-v1` / `materials-v1` kimliğini kullanır; diğer yedi kampanya bölümü ve öğreticiler klasik kataloğa delege edilir. Alfa kayıtları normal/flow L6–L8 kayıtlarına dönüştürülmez. Katalog, iki farklı ilk takasla başlayan tam yolları gerçek aynı motorla doğrular. Deneme kimliği mevcut `a-{levelId}-{attemptSerial}-{8hex}` biçimindedir; seçim RNG'si oyun RNG'sinden ayrıdır. Bilinmeyen alfa sürümü, yanlış ID türü veya legacy alfa kimliği reddedilir.

Üretici `scripts/generate-material-alpha.cjs` çevrimdışı çalışır. `reports/materials-9-14/level-certificates.json` tam yolların, dalga olaylarının ve sonuçların yeniden üretilebilir kaydıdır. Kayıtlı yol veya rapor dosyasının bulunması tek başına güncel test koşumunun geçtiğini göstermez.

## Sunum, ipucu ve varlık aktarımı

`HexMaterialView` tanımlardan ve kesinleşmiş durumdan kaynak rozeti/çivi işareti ile HUD'u çizer. Sayı taşlarının mevcut şekli, sayısı, hit target'ı ve altıgen komşuluğu korunur. Kaynak işaretleri dekoratiftir; dokunma yakalamaz. HUD `materialCounts` değerini okur; sayı uçuşunun varış callback'iyle artırılmaz. Boş/kapalı hücrede henüz toplanamayan çivi, açılmadan oynanabilir taş gibi sunulmaz.

Host mevcut sırayı korur: motor sonucu → mevcut atomik commit → sunum aktivasyonu. `HexMovePresentation` yalnız kopyalanıp dondurulmuş dalgaları oynatır. Malzeme sırası `MATCH → TOKEN_COLLECT → BLOCKER_HIT → BLOCKER_BREAK → CRATE_COLLECT → REGION_UNLOCK → CLEAR → FALL → REFILL` olur; ilgili olay yoksa faz atlanır. Sonraki zincir `CASCADE` ile aynı sıraya girer; `SETTLE` kanonik son durumu gösterir.

V6 görsel watchdog bütçesi malzeme toplama ve engel fazlarının zorunlu beklemelerini de kapsar; normal C sunumu zaman aşımı yedeğine düşmeden `succeeded` tamamlanmalıdır. Bu yalnız görsel işin yaşam süresi sınırıdır; oyun hamlesi, RNG veya kanonik işlem süresi değildir. V4/v5'in mevcut bütçe davranışı korunur.

Toplama efekti yalnız committed `materialEvents` içinden üretilir. Aynı görsel işte `sourceId`, deneme kimliği ve sunum nesliyle tekrarlar elenir; aynı hücredeki farklı kaynaklar korunur. View'ın geçici çizim/cleanup kayıtları ikinci bir kalıcı malzeme durumu değildir. Reload sayaçları snapshot'tan çizer; geçmiş uçuşları ödül gibi tekrar oynatmaz. İptal, mola, pagehide, gezinme, eski callback, azaltılmış hareket veya efekt hatası kanonik toplamı değiştiremez. Cleanup uçuş düğümlerini/animasyonlarını kaldırır; mevcut kaydedilmiş tahta ve sayaçlar gösterilir.

Mevcut **Reward Director v1** sözleşmesi değiştirilmez: klasik kazanım geri bildirimi hem puan hem zemin tamamlanmasını bekler. V6'da bu iki hedeften biri kapalıysa host eski reward sunumunu atlar; A/B'de normal kazanma diyaloğu, snapshot `status:"won"`, gerçek puan/hamle/oynanma kayıtları ve `attemptStats.terminalEvent:"level_completed"` korunur. Eski adaptöre kazanım kabul ettirmek için sahte puan veya yeşil hücre üretilmez. C'de iki hedef de etkin olduğundan mevcut reward geri bildirimi kullanılmaya devam eder. Malzeme işareti/HUD/toplama sunumu bu klasik reward planından ayrı olarak kesinleşmiş motor olaylarını gösterir; yeni bir reward-v1 malzeme portu yapılmış sayılmaz.

Bu gerçek kazanım kaydı, sıra dışı geliştirici seçiminin kalıcı kampanya temizliği veya ekonomi ödülü alacağı anlamına gelmez. Boş alfa profilinde sıradaki kalıcı bölüm hâlâ 1 iken 6/7/8 kazanılırsa mevcut sıralı `economy.complete` uygunluğu korunur: `done`, `economy.cleared`, Altın ve yıldızlar bu kazanım için ilerletilmez. Geliştirici serbest seçimi önceki bölümleri tamamlanmış saymaz ve ekonomi sırasını aşmaz. Motor sonucu, gerçek deneme/rekor kaydı ve kazanma diyaloğu yine saklanır; kalıcı ekonomi yalnız kendi mevcut uygunluk koşulları sağlandığında ilerler.

Pasif ipucu mevcut bekleme/giriş/cleanup politikasını korur. V6'da yalnız görünür kaynak tanımları, toplanma bayrakları, sayaçlar, etkin hedefler ve görünür HP/akış verisi değerlendirilebilir. Çivi için gerçek ilk eşleşme hücresi, kutu malzemesi için bu ilk hasarda gerçekten kırılacak HP 1 kutu kullanılır. Gelecek cascade/refill, gerçek RNG veya authored çözüm okunmaz; ipucu malzeme toplayamaz ve kazanma hesaplayamaz. Ayrıntılı politika [SMART_IDLE_HINTS_9_10.md](SMART_IDLE_HINTS_9_10.md) içindeki sahiplik sınırına tabidir.

Eşleşen gruptaki sayı taşı görsel olarak yaklaşırken çivi işareti hücrede sabit kalır. İpucu overlay'inin gerektiğinde ürettiği statik malzeme boyası, hareketli `.gem` kopyasının dışındaki dekoratif kardeştir; animasyon almaz. Bu boyadan `id` ve `data-material-*` kaynak kimlikleri kaldırılır; asıl hücre işaretinin DOM kimliği ve markup'ı korunur. Aynı ipucu tekrarında dondurulmuş focus dizileri yeniden kullanılır. İpucu toplama uçuşu, kanonik takas, kayıt veya sayaç değişimi üretmez; dokunma mevcut görseli temizler.

Gelecekte Blender/Unity varlıklarının `futureBindings` eşlemesi sunum/import metadata'sında kalmalıdır. Ahşap/çivi ikonu, hücre işareti, kutu rozeti ve toplama uçuşu `materialId` / `source.kind` / `sourceId` üzerinden bağlanabilir; mevcut `crate-wood-intact`, `crate-wood-cracked`, `crate-break`, `terrain-covered` varlık rolleri sürer. Bu bağlar motor şemasına, kaynak arzına, RNG'ye, HP'ye veya hedefe yeni anlam katamaz. Prefab, fizik çarpışması, Animator Event veya tween tamamlanması toplama komutu değildir.

## Unity'ye taşınabilir sınır

`GameplayTypes` malzeme tanımı, kaynak, hedef, olay ve snapshot tiplerini taşır. `HexMatch.Materials.cs` aynı saf C# 7.3 çekirdeğinin parçasıdır; UnityEngine, ekran, saat, ağ, depolama veya animator bağımlılığı almaz. JSON import'u `CatalogWire` üzerinden açık boolean/int32/dizi alanlarını korur; `null`, eksik alan veya sayısal dizgeye sessiz varsayılan vermez. `MaterialAlphaCatalog` sürümlü katalog/deneme çözümünü yapar; cihaz dosya sistemi adaptörü değildir.

Snapshot JSON'u **`CatalogWire.Snapshot(game.Snapshot())`** ile kanonik wire nesnesinden yazılmalıdır. Ham `GameSnapshot` DTO'sunu doğrudan serialize etmek, yeni v6 alanlarını null/varsayılan değerlerle eski v4/v5 şekillerine sızdırabilir. Aynı DTO'nun bütün sürümlere alan yayımladığı bir serializer, sürümlü wire sözleşmesinin yerine geçmez.

Unity host'u sıralı gerçek axial hücreleri, paleti, başlangıç/seed'i, engel akışını, malzeme/hedef tanımlarını ve tam deneme kimliğini aynı girdiler olarak yüklemelidir. Çıktı `SwapResult` dalgaları ve snapshot'tır. Görsel kaynak koordinatı olayın gerçek hücresinden; HUD miktarı kanonik diziden alınır. Sonuç/ekonomi kararı `HexMatch.Status` ve mevcut uygulama işlem sınırında kalır; eski puan/zemin varsayımıyla malzeme kazanımı yeniden hesaplanamaz.

Giriş adaptörünün çekirdeğe ilettiği sözleşme yine **iki gerçek komşu hücre indeksidir**. Ekran→tahta dönüşümü, altı yönlü kısa kaydırma, iki dokunma, tek bırakmada tek komut, çoklu temas/odak/yön değişimi iptali ve mevcut işlem kilidi host'a aittir. Unity girişi malzeme rozetine yeni toplama dokunuşu eklemez; null/kapalı/void hücre uygunluğunu aynı çekirdek belirler. Ortak giriş davranışı [MOBILE_INPUT.md](MOBILE_INPUT.md), genel aktarım sınırı [UNITY_MIGRATION_PLAN.md](UNITY_MIGRATION_PLAN.md) içindedir.

## Doğrulama ve kanıt durumu

9.14'ün son kaynaklarıyla tam `npm test`, yeni JS/view/mounted paketi, gerçek C# ve Chromium/WebKit koşumları geçti. Kalıcı sonuç özeti [validation.json](../reports/materials-9-14/validation.json), native ayrıntılar [native-parity.json](../reports/materials-9-14/native-parity.json) içindedir. Geçmiş 9.12 sonuçları 9.14 başarısı olarak aktarılmaz. Grup, senaryo, takas ve dalga gibi farklı gözlem türleri tek bir yapay test toplamına eklenmez.

```sh
node scripts/generate-material-alpha.cjs --check
node check-materials.cjs
node check-material-alpha.cjs
node check-material-hints.cjs
node check-material-view.cjs
node check-materials-ui.cjs
node check-materials-parity.cjs
node check-material-alpha-parity.cjs
node check-materials-browser.cjs
HEXROTA_BROWSER=webkit node check-materials-browser.cjs
npm run test:materials
npm run test:unity-materials
npm test
```

| Gerçek komut / ortam | Sonuç ve kanıt |
| --- | --- |
| `npm test` — son kaynaklarla tam regresyon | **exit 0.** [Kalıcı doğrulama özeti](../reports/materials-9-14/validation.json); yerel log `/workspace/scratch/materials-npm-final.log`. Yeni `test:materials` paketi **73 grup** içerir: motor 20, katalog 11, pasif ipucu 16, view/sunum 16, mounted uygulama 10. Bu 73 grup aşağıdaki mounted 10 grubu da kapsar. |
| `node check-materials-ui.cjs` — mevcut uygulama, mounted JSDOM | **Son tekrar koşumu 10/10 grup, exit 0.** Yerel koşum kaydı: `/workspace/scratch/materials-ui.log`. Altı gerçek A/B/C yolu kazanma diyaloğuna ulaşır; terminal checkpoint'ler strict restore edilir; gerçek rekor puan/hamle/oynanma ve `level_completed` kaydı doğrulanırken sıra dışı ekonominin değişmediği kontrol edilir. Devam eden oyunda reload/kaynak tekilliği/kat durumu; HP 2 ilk hasarda sıfır, kırılmada bir ahşap; karışık dalgada token→kutu sırası, tek kanonik commit ve değişmez olay dizileri; kanonik kota/yazım hatasında tam rollback; molada uçuş temizliği ve eski callback'in yeni yazım üretmemesi; isteğe bağlı painter hatası ve reduced motion doğrulanır. Normal C sunumunun `succeeded` bitişi, v6 zorunlu faz sürelerini içeren watchdog bütçesiyle geçer; saat/eşik assertion'ları gevşetilmez. Yeni v6 pasif ipucu kabul grubu aşağıdaki iki gerçek durumu kapsar. T1/T2'nin bütün gerçek yönlendirilmiş hamlelerinde v4 snapshot'lar ve son Tahta 3/3, Çivi 4/4 öğretici sayaçları korunur. |
| `node check-materials-parity.cjs` — gerçek .NET 8.0.428 / C# 7.3 | **196 senaryo geçti**: altı tam yol / 52 checkpoint prefix'i ve 24 rota dışı yasal koşu; 501 geçerli takas, 1.154 dalga, 269 malzeme olayı; 166 birebir resume, 165 replay, 168 bağımsız clone; 102 reddedilen checkpoint ve 41 reddedilen tanım/hedef. [Kalıcı native kanıt](../reports/materials-9-14/native-parity.json); olay sırası, tekil toplama, hedefler, RNG, geometri ve sonuç karşılaştırılır. |
| `node check-material-alpha-parity.cjs` — gerçek .NET 8.0.428 / C# 7.3 | **156 senaryo geçti**; 30 seçim, altı tam kazanma yolu / 52 checkpoint prefix'i, 89 reddedilen override/kimlik/snapshot. [Kalıcı native kanıt](../reports/materials-9-14/native-parity.json). Son kaynaklarla `npm run test:unity-materials` ayrıca **exit 0**; iki yeni komutun yerel log'u `/workspace/scratch/materials-native-final.log` içindedir. |
| Mevcut 14 native parity komutu — gerçek .NET 8.0.428 / C# 7.3 | **14/14 komut exit 0.** Gameplay, katalog, reward/adapter, hint, lives, event/session, ekonomi, commands/rescue ve önceki engel/flow/büyük tahta regresyonları. [Kalıcı native özeti](../reports/materials-9-14/native-parity.json); komut bazındaki yerel kayıt `/workspace/scratch/materials-native-legacy/summary.json` içindedir. |
| `node check-materials-browser.cjs` — gerçek Chromium | **18/18 grup, exit 0; errors `[]`.** [Makine tarafından okunabilir sonuç](../reports/materials-9-14/chromium/results.json); yerel log `/workspace/scratch/materials-browser-chromium.log`. Dokuz tam A/B/C kazanma koşusu, 72 route hamlesi ve 33 PNG. |
| `HEXROTA_BROWSER=webkit node check-materials-browser.cjs` — gerçek WebKit | **18/18 grup, exit 0; errors `[]`.** [Makine tarafından okunabilir sonuç](../reports/materials-9-14/webkit/results.json); yerel log `/workspace/scratch/materials-browser-webkit.log`. Dokuz tam A/B/C kazanma koşusu, 72 route hamlesi ve 33 PNG. |

Görünürlük denetimi `--check --quiet` ile geçti: mevcut 40 varyantın bütün metrikleri aynıdır. Tam solvability kontrolü de `npm test` içinde geçti. Dar klasik kaynak korumaları ve denetim provenance hash'leri yeni kaynaklara uyarlandı; mevcut denetim raporlarında yalnız iki dosyadaki üç kaynak parmak izi satırı değişir. Ölçüm, denge eşiği veya solver kabul sonucu değiştirilmez.

Son mounted koşum gerçek uygulama/motor/kayıt akışını ve ekonomi sırası ayrımını doğrular; native yerleşim veya fiziksel dokunma kanıtı değildir. Yeni pasif ipucu kabul grubunda başlangıçtaki null/kapalı hücreli B tahtasında `[2,10]` önerisi ve 11.800 ms'deki tekrarı aynı dondurulmuş dizileri kullanır; yalnız eşleşen grup vurgulanır, hücre 2'nin asıl çivi işareti kopyalanmadan kimliği/markup'ı korunur. Üç gerçek B hamlesi ve reload sonrasında `[34,41]` önerisinde taşınan sayı kaynağı 34'ün çivi boyası statik/sanitized kardeş olarak kalır; asıl işaret byte olarak aynıdır. İki durumda da takas, RNG, HUD, bütün localStorage, snapshot veya malzeme bayrağı değişmez; toplama uçuşu başlamaz ve dokunma görseli temizler. Mounted harness zaten can testleri için `window.Date.now` değerini sabitler; yeni ipucu grubu yalnız idle controller'ın enjekte edilen bağımlılık saatini değiştirir. Ek Date override'ı veya global timer zamanlama değişikliği eklenmez.

Tablodaki tamamlanmış **18/18** browser koşumları normal uygulamada 320×568, 390×844 ve 430×932 boyutlarının her birinde A/B/C'yi tam kazanır. İki browser'da da ilk hamle sonrası birebir reload, kaynak tekilliği/HUD yerleşimi, HP 2 ilk hasarda sıfır/kırılmada bir ahşap, katı kalan hücrede ilk çivi toplama, kaynak-hücre işaretleri ve normal C sunumunun 4.680 ms bütçeyle `succeeded` tamamlanması doğrulanır. Donmuş dalga olayları, kanonik sayaçlar, tek commit ve kaynak başına tek görsel paket; kota hatasında rollback; Pause/resize/Home ile uçuş iptali; reduced motion'da uçuş yokluğu; gerçek rekor/terminal kayıtları ve ekonomi sırasının korunması da kapsamdadır. Her iki tam T1/T2 rotasında tarihsel v4 skor/kat/sayaç sonuçları korunur.

Yeni 18. browser grubu iki gerçek 10 saniye bekleme ve ilk önerinin 11.800 ms tekrarını kullanır; Date/timer veya ipucu yapılandırması değiştirilmez. Başlangıçtaki null hücreli B'de çivi 2'nin asıl işareti korunur; üç gerçek hamle ve birebir reload sonrası kaynak 34'ün statik, kaynak kimlikleri çıkarılmış çivi boyası hareketli sayı kopyasının üstünde kalır. Asıl işaretin kimliği/markup'ı/geometrisi; bütün localStorage, snapshot, HUD ve malzeme bayrakları aynıdır. Toplama olayı/uçuşu oluşmaz; native dokunma ipucunu temizler.

Her browser **33 PNG**, toplam **66 PNG** üretmiştir: 27 A/B/C başlangıç/toplama/kazanım görüntüsü ile HP 2, karışık dalga, T1/T2 ilk-adım sayaçları ve iki pasif ipucu kanıtı. İki browser'da dokunmalar native touchscreen input'tur; Chromium sürüklemesi CDP native touch, WebKit sürüklemesi native mouse/pointer fallback yoludur. Gerçek WebKit koşumu fiziksel iOS dokunma testi olarak adlandırılmaz.

390×844 Chromium'da mevcut normal uygulama kanıtları; WebKit karşılıkları [kendi rapor dizininde](../reports/materials-9-14/webkit/results.json) bulunur:

| Senaryo | Başlangıç | Gerçek toplama sonrası | Kazanım |
| --- | --- | --- | --- |
| A — Ahşap | [Görüntü](../reports/materials-9-14/chromium/390-alpha-A-initial.png) | [Görüntü](../reports/materials-9-14/chromium/390-alpha-A-collected.png) | [Görüntü](../reports/materials-9-14/chromium/390-alpha-A-won.png) |
| B — Çivi | [Görüntü](../reports/materials-9-14/chromium/390-alpha-B-initial.png) | [Görüntü](../reports/materials-9-14/chromium/390-alpha-B-collected.png) | [Görüntü](../reports/materials-9-14/chromium/390-alpha-B-won.png) |
| C — Karma | [Görüntü](../reports/materials-9-14/chromium/390-alpha-C-initial.png) | [Görüntü](../reports/materials-9-14/chromium/390-alpha-C-collected.png) | [Görüntü](../reports/materials-9-14/chromium/390-alpha-C-won.png) |

V6 pasif ipucu kanıtları: [başlangıçtaki null hücreli B ve aynı önerinin tekrarı](../reports/materials-9-14/chromium/390-v6-passive-nullable-first-repeat.png); [hareketli sayı kopyasının üstünde sabit kalan çivi işareti](../reports/materials-9-14/chromium/390-v6-passive-static-nail-above-moving-clone.png). Aynı dosya adları WebKit rapor dizininde de bulunur.

| Katman | Gerekli kontrol |
| --- | --- |
| Saf motor | Ahşap yalnız gerçek kırılmada; HP 2 ilk hasarında sıfır; çivi yalnız açık/eşleşen hücrede; aynı dalgada tür sırası; aynı hücrede farklı kaynaklar; tekrar eşleşmede tekrar verme yok |
| Veri ve hedefler | Int32 miktar/arz, bilinmeyen/tekrarlı ID, yanlış hücre/kutu ilişkisi, en az bir etkin hedef, kapalı puan/zemin, son hamle kazanımı ve gerçek kayıp |
| Snapshot | Her sertifikalı prefix'te restore/replay/clone; sonraki dalga eşitliği; forged sayaç/bayrak/status/sürüm reddi; v4/v5 çıktısının korunması |
| Katalog ve profil | A/B/C tam yolları, diğer bölümlerin delegasyonu, ayrı storage/writer-lock/reset, normal ve flow kayıtlarının korunması |
| JS/C# | Gerçek .NET 8 / C# 7.3 ile portable JSON/DTO, tam dalga/snapshot/status, restore/clone ve katalog kimliği karşılaştırması |
| Normal uygulama browser'ı | Üç mobil boyutta bütün on bölümün seçimi, A/B/C gerçek dokunma/drag, işaret/sayaç/efekt sırası, tek commit, iptal/arka plan/reload, hata ve reduced motion |
| Regresyon | Mevcut klasik/engel/büyük tahta, pasif ipucu, ekonomi/can/kayıt ve çevrimdışı paket kontrolleri |

Browser ekran görüntüsü ve çalışma raporu yalnız gerçek normal uygulama akışından alınmalıdır. JSDOM yerleşim/dokunma kanıtı değildir. Chromium ve masaüstü WebKit sonuçları ayrı kaydedilir; testin kendi kontrollü saati motor/RNG/kaydı sahteleştirmemelidir. C# parity, Unity sahne/prefab/cihaz entegrasyonunun yerine geçmez.

**Fiziksel iPhone/iOS Safari ve Unity Editor/IL2CPP testi yapılmadı.** İnsanlarla alfa hedef okunabilirliği ve zorluk dengesi ayrıca değerlendirilmelidir.


## Mobil Preview yerleşimi

Vercel'in yüzen Preview Toolbar düğmesi canlı WebKit kontrolünde C senaryosunun sağ kenardaki 30. hücresini örttü; düğmeye dokunma dış araç çubuğunu açıp mevcut doğru blur→Pause davranışını tetikledi. Oyun kuralları veya giriş kilidi değiştirilmedi. [Vercel'in belgelenmiş dal ayarı](https://vercel.com/docs/vercel-toolbar/managing-toolbar) kullanılarak `VERCEL_PREVIEW_FEEDBACK_ENABLED=0` yalnız `feature/hexrota-material-objectives-9-14` dalının **Preview** ortamına tanımlandı. Production ve diğer dalların ayarları kapsam dışıdır; bu ayar sonraki Preview dağıtımında uygulanır.

Yeni browser kabul sürücüsü, gerçek `.floor-shape.getBoundingClientRect()` merkezi ile `elementFromPoint` hit kontrolünü kullanır; ikinci dokunma ilk dokunmadan sonra yeniden ölçülür. SVG transform listesini `consolidate()` ile birleştirmez. Bu yalnız test sürücüsünün koordinat okumasıdır; oyun giriş adaptörü değişmedi. Bu sürücüyle 18/18 Chromium ve 18/18 WebKit yeniden geçti, aynı bütün kontroller/eşikler korundu. Canlı Preview doğrulaması kaynak dosyalarının hash'lerini ve gerçek oynanış/kayıt sonuçlarını ayrıca karşılaştırır.
