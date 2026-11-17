# Hexrota 9.12 — Kırılabilir kutular ve dinamik bölgeler

## Kapsam ve uyumluluk

Bu özellik mevcut `dist/engine.js` / `unity/Gameplay/HexMatch.cs` motorlarını genişletir. Yeni bir demo motoru veya ikinci kalıcı oyun durumu yoktur. Yeni bölüm kuralları `classic-v5`, engel veri sözleşmesi `obstacles-v1`, motor checkpoint'i **snapshot v5** kullanır. Kampanya, öğreticiler, 40 varyant ve 80 sertifikalı yol `classic-v4` / snapshot v4 olarak kalır. Eski kayıtlar v5'e dönüştürülmez.

Çalışmanın tabanı main `a3b5640`'tır; özellik dalı `feature/hexrota-blockers-regions-9-12`'dir. PR #34 ve #35'teki ayrı Unity hazırlık çalışmaları bu uygulamanın kaynağı değildir. Main veya Production'a otomatik yayın yapılmaz.

Snapshot v5, mevcut profil anahtarı `hexrota-match-v5` ile aynı şey değildir. İlki bu yeni motorun checkpoint sürümüdür; ikincisi mevcut kampanyanın tarihsel kayıt anahtarıdır. Geliştirme ekranı kampanya profilini, canı, ekonomiyi veya attempt seçim RNG'sini kullanmaz.

## Dosyalar ve sorumluluklar

| Dosya | Sorumluluk |
| --- | --- |
| `dist/engine.js` | Aynı HexMatch içinde sürüme göre hasar, bölge açma, etkin geometri, düşüş, RNG ve replay |
| `unity/Gameplay/HexMatch.cs`, `HexMatch.Obstacles.cs` | Aynı C# partial HexMatch çekirdeği; UnityEngine bağımlılığı yok |
| `unity/Gameplay/GameplayTypes.cs` | Engel, bölge, hit, checkpoint ve dalga DTO'ları |
| `unity/Gameplay/BoardTopology.cs` | Değişmez axial komşular, üç eksen, q sütunları ve üçlüler |
| `data/obstacle-levels-v1.json` | Unity'ye de aktarılabilir kanonik geliştirme bölümleri ve doğrulanmış yollar |
| `dist/obstacle-levels.js` | Aynı verinin tarayıcı sarmalayıcısı; `HEX_OBSTACLE_LEVELS` |
| `scripts/generate-obstacle-levels.cjs` | Gerçek motorla çevrimdışı bölüm/yol üretimi; oynarken çalışmaz |
| `dist/obstacles.html`, `obstacle-lab.js`, `obstacle-lab.css` | Ayrı geliştirme ekranı, host kayıt/işlem sınırı ve geçici görseller |
| `dist/board-view.js` | Mevcut saf SVG projeksiyonu ve taş kimliği koruyan reconcile adaptörü |
| `dist/move-presentation.js` | Kesinleşmiş motor dalgalarının kopyalanmış/dondurulmuş görsel sırası |
| `dist/board-input.js` | Ortak altıgen dokunma/sürükleme sınıflaması |

`attempts.js` kampanya varyant paketlerini ve ayrı seçim RNG'sini yönetmeye devam eder. Yeni geliştirme bölümleri bu kataloğa eklenmez. `idle-hints.js` motor veya kayıt sahibi değildir; mevcut kampanyanın bekleme ipucu sözleşmesi değişmez. Yeni engellerin bulunduğu tahtanın yetkili uygunluk kontrolü `isPlayable` / `IsPlayable`'dır.

## Bölüm verisi

Şema parçası aşağıdadır. `cell` ve `cells` değerleri aynı level içindeki sıralı hücre dizisinin indeksidir; hücreler yalnız axial `q,r` ile tanımlanır. Oyun koduna bölümün hücre numaraları gömülmez.

```json
{
  "rulesVersion": "classic-v5",
  "levelDataVersion": "obstacles-v1",
  "cells": [{"q":0,"r":0,"layers":1}],
  "initial": [null],
  "palette": [1,2,3],
  "seed": 123,
  "moves": 35,
  "target": 30,
  "obstacles": {
    "version": "obstacles-v1",
    "blockers": [
      {"id":"gate-a","cell":0,"hp":2,"regionId":"garden-a"}
    ],
    "regions": [
      {"id":"garden-a","cells":[1,2],"requires":["gate-a"]}
    ]
  }
}
```

Bu parça alan adlarını gösterir; kendi başına tam ve geçerli bir bölüm değildir. Tam oynanabilir örnekler kanonik JSON içindedir.

- `blockers[].hp` başlangıç dayanıklılığıdır: yalnız 1 veya 2. Güncel HP çalışma durumundaki `blockerHp[]` dizisindedir; dizi sırası tanım sırasıyla aynıdır. HP 0, kırılmış kutunun kalıcı kaydıdır; tanımı silinmez.
- `blockers[].regionId` isteğe bağlı bir bağdır. Varsa adlandırılan bölgenin `requires` listesi kutuyu içermelidir. Bir kutu birden fazla bölgenin koşulunda bulunabilir; yetkili ilişki her bölgenin `requires` listesidir.
- `regions[].requires`, bütün üyeleri kırılmadan açılmayan **AND** koşuludur. Boş veya yinelenen koşul, bilinmeyen kutu ve imkânsız döngü reddedilir.
- `regions[].cells` başlangıçta kapalıdır. `regionOpen[]` tanım sırasıyla `false` başlar, yalnız koşul tamamlandığında `true` olur. Açılma geri alınmaz.
- Kutular ve bölgeler varsayılan olarak kazanma için zorunludur. `required:false` açık istisnadır; zemin ve puan hedeflerini kaldırmaz.
- Aynı hücrede iki kutu, çakışan iki bölge veya bir bölgenin kendi içinde yinelenen hücre reddedilir. Bir kutu kapalı bölgenin içinde bulunabilir; önce o bölge açılmalı, sonra kutu hasar alabilir. Çok aşamalı C bölümü bu ilişkiyi kullanır.
- Tanımlı ama kapalı hücre ile **void** farklıdır. Void koordinatı `cells` içinde hiç yoktur: taş, zemin, komşuluk geçişi veya hedef sayısı oluşturmaz.
- V5'te `layers:0` gerçekten sıfır zemindir; eksik/null kat 1'dir. V4'ün tarihsel eksik/null/0 → 1 davranışı korunur.
- Başlangıç `null` yalnız kutulu veya kapalı hücrelerde geçerlidir. Başlangıçtaki bütün açık hücreler paletten bir tamsayı taş taşır.

Kimlikler 1–80 karakterlik `A–Z`, `a–z`, `0–9`, `_`, `.`, `-` dizgeleridir. Koordinatlar ve taş değerleri signed Int32, hamle/kat/hedef negatif olmayan Int32, seed unsigned 32 bit aralığını kullanır. C# komşuluk ara hesapları taşmadan yapılır. Palet sırası ve yinelenen değerlerin ağırlığı korunur.

Yapısal doğrulama, başlangıçtaki açık hücrelere komşu kutuları varsayımsal olarak kaldırarak ve koşulu tamamlanan bölgeleri açarak bütün kutuların topolojik olarak erişilebilir olmasını denetler. Bu, eşleşme veya kazanılabilirlik kanıtı değildir. Yayın kabulü, gerçek motorla tam kazanma yolunun yeniden oynatılmasını ayrıca gerektirir. Arama bütçesinin bitmesi çözümsüzlük kanıtı değildir.

## Bir hamlenin kuralları

Takas önce sonuç durumu, axial komşuluk ve iki hücrenin oynanabilirliğiyle doğrulanır. Kutu ve kapalı hücre seçim/takas hedefi olamaz. Eşleşme üretmeyen takas taşları geri koyar; hamle, geçmiş, puan ve RNG değişmez.

Geçerli takas bir hamle tüketir ve yalnız bir history çifti ekler. Her eşleşme dalgasında:

1. Üç axial eksendeki eşleşmeler belirlenir. Kapalı/kutulu hücreler eşleşmeye katılmaz.
2. Eşleşen taş değerleri kadar mevcut puan eklenir ve ilgili zemin katı bir azaltılır.
3. Eşleşen hücrelere altıgen komşu olan, kendi bölgesi açık her sağlam kutu **bir** hasar alır. Aynı dalgadaki birden fazla temas veya kesişen eşleşme ikinci hasar vermez.
4. HP 0 kutular kaldırılmış kabul edilir. Ayrı bir puan veya hamle kazanımı oluşmaz.
5. Bütün koşul kutuları HP 0 olan bölgeler açılır.
6. Yeni etkin geometriyle düşüş ve kontrollü refill çözülür.
7. Yeni eşleşme varsa aynı hamlenin sonraki dalgasına geçilir. Aynı kutu sonraki dalgada yeniden hasar alabilir.
8. Dalga sınırı, hamlesiz tahta kurtarma ve son durum mevcut motor sırasıyla tamamlanır; host sonucu kaydeder.

Yeni açılmış bölgenin içindeki kutu, o dalganın hasar aşaması tamamlandıktan sonra görünür olduğundan ancak sonraki dalgada hasar alır. Animasyon sonucu veya süresi hiçbir aşamada HP, RNG veya geometri kararı vermez.

Kazanma mevcut puan (`at least` veya exact) ve bütün tanımlı hücrelerin zeminini bitirme şartlarına ek olarak zorunlu kutuların kırılmasını ve zorunlu bölgelerin açılmasını ister. Son hamlede tamamlanan hedef kazanır. Kalan hamlenin sıfır olması veya exact hedefin aşılması mevcut kayıp kuralıdır. Sonuç checkpoint alanı olarak güvenilmez; kaydedilmiş gerçek durumdan yeniden türetilir.

## Segmentli düşüş ve deterministik RNG

V4'ün q sütunlarına göre tarihsel düşüş/refill çıktıları korunur. V5 her q sütununu artan r sırasıyla tarar ve oynanabilir, r farkı tam 1 olan ardışık hücrelerden segmentler oluşturur. Sağlam kutu, kapalı bölge veya bulunmayan koordinat segmenti keser. Çapraz kayma yoktur.

Her segmentte eşleşmeyen dolu taşların sırası korunur ve artan r yönündeki alt boşluklara sıkıştırılır. Kutunun kırılması veya bölgenin açılmasıyla oluşan yeni null hücreler de gerçek boşluktur; survivor sayılmaz. Yalnız artık gerçekten bitişik olan segmentler birleşebilir. Taş kapalı hücreyi, kutuyu veya void boşluğunu aşamaz.

Bütün segmentlerin sıkıştırılması **refill başlamadan** biter. Refill, mevcut q artan / r artan sırasını korur ve yalnız oynanabilir null hücrelere taş üretir. Her hücre için üçlüler üzerinden olası yeni eşleşme sayısı hesaplanır; en düşük sayılı palette seçeneklerinden mevcut XorShift32 ile seçilir. Her doldurulan hücre bir RNG çekimi tüketir. HP hasarı, bölge açılması, asset seçimi ve animasyon RNG tüketmez.

`falls` gerçek kaynak/hedef taş kimliğini ve spawn sırasını taşır; eşit değerler farklı taşların hareketini saklamaz. `compacted` refill öncesi gerçek ara dizidir. Bu metadata sunum içindir; görsel arıza son tahta dizisini değiştiremez.

Hamlesiz tahtanın kurtarılması yalnız açık taşları karıştırır veya üretir. Kapalı hücrelerin null durumu, HP, bölgeler, zemin, puan ve geçmiş korunur. Sınırlı arama başarısız olursa yardımcı taşları ve RNG'yi giriş durumuna geri alır ve açık hata verir. Her şekil için yasal hamle bulunacağı iddia edilmez; host başarısız hamleyi kalıcılaştırmaz.

## Snapshot v5 ve replay

```text
version: 5
rulesVersion: classic-v5
obstacleVersion: obstacles-v1
values: (int | null)[]
layers: int[]
blockerHp: int[]
regionOpen: bool[]
score: int
movesLeft: int
turn: int
rngState: uint32
history: [[a,b], ...]
```

Blocker/bölge dizileri aynı sürümlü level tanımlarının sırasına bağlıdır. Kırılmış kutu `blockerHp[i] === 0` ile, kapalı bölge `regionOpen[i] === false` ile saklanır. Bölüm tanımı veya sırası değişecekse yeni veri sürümü gerekir; eski checkpoint sessizce yeni tanımla okunamaz.

Restore yalnız şekil kontrolü yapmaz: aynı bölüm başlangıcından bütün history takaslarını yeni bir HexMatch üzerinde yeniden oynatır ve her kanonik alanın eşitliğini ister. Sahte HP, erken açılmış bölge, değiştirilmiş RNG/zemin/puan/taş, eksik alan ve geçersiz geçmiş reddedilir. Yerleşmiş aktif hücrede null kabul edilmez; kapalı/kutulu hücrede taş kabul edilmez. Geçici null yalnız motorun düşüş/refill ara projeksiyonlarında bulunabilir. `clone` HP ve bölge dizileri dahil bütün değişebilir durum dizilerini kopyalar; kaynak oyun değiştirilmez.

C# host JSON adaptörü nullable taş ve `falls.from:null` alanını korumalıdır. Eski v4 wire çıktısına yeni obstacle alanları `null` olarak eklenmez. Core DTO'ları saf C#'tır; platform serializer ayarı gameplay kuralı değildir. `JsonUtility` tek başına genel iç içe/nullable sözleşmenin tam yükleyicisi sayılmaz.

## Web geliştirme ekranı ve sunum

Doğrudan `/obstacles.html` açılır. Test A/B/C seçimi, dokunarak veya sürükleyerek takas, HP, bölge durumu, puan/hedef, kalan hamle, yeşil alan, restart, duraklatma, sonuç ve reload ile devam bu host'tadır. Geliştirme kaydı yalnız `hexrota-obstacles-lab-v1` anahtarını kullanır. Zarf `{version:1, levelDataVersion:'obstacles-v1', activeId, boards:{id:snapshot}}` biçimindedir. Kampanya/profil anahtarlarını okumaz veya değiştirmez. Sayfa mevcut tema CSS'ini, gerçek engine'i, board-view/reconcile, board-input ve move-presentation bileşenlerini kullanır.

Sunum sırası gerektiğinde `SWAP → MATCH → BLOCKER_HIT → BLOCKER_BREAK → REGION_UNLOCK → CLEAR → FALL → REFILL → CASCADE → SETTLE` olur; boş aşamalar atlanır. Klasik `PHASES` dışa aktarımı korunur; obstacle fazları ayrı `OBSTACLE_PHASES` kataloğundadır.

Host önce gerçek hamleyi çözer ve snapshot'ı kaydeder, sonra salt-okuma görsel planı oynatır. Gösterim sırasında giriş kilitlidir. Görsel hata, duraklatma, pagehide veya görünürlük kaybı gösterimi iptal eder; son kesinleşmiş gerçek checkpoint yeniden çizilir. Görsel callback ikinci kayıt, hasar veya ödül üretmez. Kayıt yazımı başarısız olursa host eski gerçek durumu korur ve hata gösterir.

## Geliştirme bölümleri

| Bölüm | Geometri ve öğretim amacı |
| --- | --- |
| A — İlk Kutu | 19 hücreli küçük axial altıgen; bir HP 1 kutu; komşu eşleşme ile kutunun kırılması, bağlı hücrelerin açılması ve refill; iki yol 5 ve 4 hamle |
| B — Kapalı Alt Bölge | 19 hücreli altıgen; üç HP 1 orta engel; hepsi kırılmadan kapalı kalan alt bölge ve açıldıktan sonra devam; iki yol 5 ve 5 hamle |
| C — Çok Aşamalı Açılma | 37 hücreli altıgen; HP 1 ve HP 2 kutular, iki bağımsız bölge koşulu; ilk bölgenin içindeki güçlendirilmiş kutu ikinci bölgeyi açar; iki yol 4 ve 4 hamle |

Her bölümün `solutions` dizisi gerçek motorla yeniden oynatılan kazanma yollarını taşır. `solution`, ilk yolun uyumluluk kopyasıdır. Bölüm üreticisi runtime'da çalışmaz; başlangıç veya hedef oyuncunun kararına göre değiştirilmez. Yol sertifikaları ve gerçek test sayıları aşağıdaki doğrulama kaydına eklenir.

## Blender / Unity görsel bağlama sözleşmesi

Geçici ahşap görseller uygulama içinde çizilmiş özgün SVG şekilleri, çizgiler, HP rozeti ve parçacıklardır. Üçüncü taraf oyun varlığı kullanılmaz. Sonraki Blender varlıkları yalnız sunum katmanına aşağıdaki kararlı anlamlarla bağlanmalıdır:

| Görsel/asset kimliği | Kaynak motor olayı veya durumu | Unity sunum karşılığı |
| --- | --- | --- |
| `crate-wood-intact` | HP 2 kutu | Sağlam ahşap prefab/mesh |
| `crate-wood-cracked` | HP 1 kutu | Çatlamış prefab veya material varyantı |
| `crate-break` | `brokenBlockers` olayı | Ömrü sınırlı parça/particle prefab'ı |
| `region-closed` | `regionOpen[i] === false` | Etkileşimsiz kaplama görseli |
| `region-unlock` | `openedRegions` olayı | Ayrı Unity effect kimliği için ayrılmıştır; web mevcut `region-closed` kaplamasını soldurarak kaldırır |

Web SVG düğümleri `data-asset` üzerinden ilk dört kimliği taşır. `region-unlock` şu anda ayrı bir SVG asset değildir.

HP 1 başlangıç kutusu ve HP 2'den hasar almış kutu aynı HP 1 çatlak görünümünü kullanabilir. Prefab adı oyun kuralı değildir. Physics, collider veya animator callback'i hasar, RNG, kazanma ya da kayıt yazamaz. Unity presenter WaveFrame verisini okuyup kendi nesnelerini günceller; gelecekteki board input adaptörü de `IsPlayable` kontrolünü kullanır. Görsel nesne yüklenemezse oyun ilerlemesi korunur.

## Doğrulama komutları ve kapsam

- `node check-obstacles.cjs`: yeni mekaniğin JS kuralları, veri/snapshot retleri, yollar, clone/replay ve kurtarma kontrolleri.
- `node check-obstacles-parity.cjs`: gerçek .NET 8 üzerinde C# 7.3 derlemesi; yeni motor durumları ve dalga çıktılarının JS ile karşılaştırılması. JS fallback başarı sayılmaz.
- `node check-obstacles-browser.cjs`: gerçek browser'da 320×568, 390×844 ve 430×932; gerçek giriş, reload, gösterim iptali ve geliştirme kaydı izolasyonu.
- `npm test`: mevcut test zinciri ve eklenen engel kontrolleri. Eski goldens, varyant yolları ve kabul eşikleri korunur.
- `npm run test:unity-gameplay`: arşiv klasik mekanik vektörleri, 40 varyantın 80 yolu ve eski restore/recovery karşılaştırmaları.

Bu belge uygulama sözleşmesini tarif eder. Koşum sonuçları, komutların gerçek çıkışları ve sayılarıyla aşağıya eklenmelidir; testin yazılmış olması testin geçtiği anlamına gelmez. Yapısal kabul, yasal hamle ve kazanma ayrı iddialardır.

## Doğrulama kaydı ve sınırlar

2026-11-17 UTC yerel `node check-obstacles.cjs` **exit 0**: 26 grup, 3 bölüm, farklı ilk hamlelerden başlayan 6 tam kazanma yolu ve 27 replay/restore/clone prefix kontrolü. Bu sayılar yalnız bu JS komutunun çıktısıdır; diğer koşumların yerine geçmez.

Yeni engel parity komutu gerçek .NET 8 / C# 7.3 derlemesiyle **exit 0**: 141 senaryo; 6 sertifikalı yol ve 36 rota dışı yasal koşu; 592 geçerli takas, 65 resume, 65 replay, 66 clone ve 86 checkpoint reddi. Hasar/açılma, bütün düşüş/refill dalgaları, RNG ve sonuç JSON'ları JS ile karşılaştırıldı. Eski dokuz C# parity komutu ve ayrıca mevcut gameplay parity komutu da geçti; bunlar yeni test sayılarıyla tek bir toplamda birleştirilmez.

Mevcut kampanyanın gerçek browser regresyonu da **exit 0**: `check-integration-browser.cjs` Chromium 6/6 grup, boş page-error ve dış istek dizileri; `check-animation-pipeline-browser.cjs` **Chromium 23/23 ve WebKit 23/23** grup, iki motorda da boş page-error dizisi. WebKit koşumunda eksik sistem kitaplıklarının yerel Playwright dizinine kurulmasından sonra gerçek WebKit çalıştırıldı; `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` yalnız ön koşul denetimini atlar, browser veya assertion yedeği kullanmaz. İkinci test altı viewport, gerçek çok dalgalı düşüş/taş kimlikleri, tek canonical yazı, hata/iptal, geç callback ve reload durumlarını kapsar. Integration testi CDP kullanır ve Chromium'a özgüdür; WebKit'te çalışmış gibi sayılmaz.

Bu geliştirme sırasında fiziksel iPhone testi veya Unity Editor/IL2CPP sahne testi yapılmış değildir. Browser viewport ve WebKit testi fiziksel iOS testi olarak sunulmaz. Unity Cloud kurulumu, hesap yetkilendirmesi veya yerel Blender dosyası istenmez. C# parity saf gameplay kuralları içindir; gelecekteki prefab görünümü veya native dokunma sürücüsünün testi değildir.


## Ekran görüntüleri

Gerçek WebKit koşumunda 390×844 görünümü; her bölümün başlangıç ve ilk açılma durumu:

| Bölüm | Başlangıç | Açıldıktan sonra |
|---|---|---|
| A — İlk Kutu | ![A başlangıç](../reports/obstacles-9-12/webkit/test-A-initial.png) | ![A açık](../reports/obstacles-9-12/webkit/test-A-opened.png) |
| B — Kapalı Alt Bölge | ![B başlangıç](../reports/obstacles-9-12/webkit/test-B-initial.png) | ![B açık](../reports/obstacles-9-12/webkit/test-B-opened.png) |
| C — Çok Aşamalı Açılma | ![C başlangıç](../reports/obstacles-9-12/webkit/test-C-initial.png) | ![C açık](../reports/obstacles-9-12/webkit/test-C-opened.png) |

Kaynak koruma: önceki hash fixture'ları ve davranış golden'ları değiştirilmez. `fixtures/obstacles-regions-protected.json` yalnız belirtilen on çekirdek/sunum/native host dosyasının yeni tam SHA-256 değerlerini main `a3b5640` tabanına bağlar. Eski koruma testleri bu dar overlay'i okur; katalog verileri, command sonuç goldeni ve eşikler aynıdır. Offline shell 48→49 ile güncellenir; `app.js`, `hint-worker.js`, ana HTML ve UI kit farkları yalnız cache query'sidir.


### Birlikte doğrulama kanıtı

| Gerçek koşum | Sonuç |
|---|---|
| `test:obstacles` | 26 JS grubu; 6 kazanma yolu, 27 replay/restore/clone prefix; dokuz sunum sınırında iptal |
| `test:unity-obstacles` | 141 native senaryo; 592 takas, 65 resume, 65 replay, 66 clone, 86 bozuk snapshot denemesi; 36 rota dışı koşu |
| `test:unity-gameplay` | 71 eski mekanik + 4 recovery + 80 tam sertifika + 120 rota dışı koşu; 1.916 geçerli takas, 258 resume, 262 replay, 2.177 clone kontrolü, 1.050 ret; ek 74 yapı girdisi ve 17 recovery karşılaştırması |
| Diğer mevcut C# komutları | rewards, catalog, hints, reward-adapter, lives, economy, commands, rescue ve session: 9/9 komut exit 0; gerçek .NET **8.0.428**, C# **7.3** |
| Yeni mobil browser | Chromium **14/14**, WebKit **14/14**; her iki motorda üç bölüm × üç boyut, gerçek tap/drag, reload, kazanma, iptal/arka plan, animasyon ve ilk çizim hatası, bozuk kayıt; pageErrors `[]` |
| Mevcut kampanya browser | Chromium integration/offline **6/6**; Chromium animation **23/23**; WebKit animation **23/23**; pageErrors `[]` |
| Mevcut pinned Balance Lab izolasyonu | Chromium **6 grup**, WebKit **6 grup**; her birinde 68 değişmez dosya ve 10 korunan kayıt anahtarı. Eski fixture yalnız ayrı detached test worktree'sinde okunur. |

İlk tam npm denemesinde, paralel audit yükü altında mevcut reduced-motion testinin 180 ms duvar saati assertion'ı başarısız oldu. Değişmemiş score testi ayrı koşumda geçti; eşik veya assertion değiştirilmedi. Son tam `npm test` **exit 0**, 12:42:01–12:46:53 UTC (yaklaşık 292 saniye). Mevcut zincirin tamamı ve yeni 26 JS grubu birlikte geçti.

Klasik observable ve solvability raporları gerçek araçlarla yeniden üretildi. Main ile tam JSON karşılaştırmasında yalnız `observable.sourceHash`, `solvability.sourceHash` ve `solvability.historicalObservableReference.sourceHash` farklıdır; bütün sertifikalar, kararlar, metrikler ve solver sonuçları aynıdır. Yeni hash'ler ek 9.12 fixture'ında sabitlenir; eski fixture'lar değiştirilmez.

Canlı Preview `142bc39` runtime'ında 390×844 Chromium ile ilk A takası gerçek dokunma üzerinden yürütüldü: HP `[0]`, bölge `[true]`, turn `1`; reload snapshot'ı birebir aynı, pageErrors `[]`. Bu Preview feature dalıdır; Production değildir. Süreli paylaşım anahtarı kaynak koda veya bu belgeye yazılmaz.

Ek checkpoint kontrolü gerçek takasla HP 2→1 kalan kutuyu kaydedip geri yükler ve sonraki hamleyi karşılaştırır; ayrıca bir hamlelik gerçek kayıp geçmişini restore/replay/clone ile doğrular. Bu iki native akış son 141 senaryoya dahildir.


Son kaynak değişikliklerinden sonra `git diff --check`, PWA, architecture ve dar hash korumaları da geçti. Main ve Production'a yazılmadı; PR #34/#35 taşınmadı veya birleştirilmedi. Yerel test sonuçları uzak CI tamamlanmış gibi sunulmaz; uzak durum draft PR Checks ekranından izlenir.
