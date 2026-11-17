# Hexrota 9.15 — Hikâye ve olay motoru

Bu belge 9.15'in sürümlü hikâye sözleşmesini ve mevcut normal uygulamaya bağlanmasını tanımlar. Saf motor, kanonik olay adaptörü, profil ve diyalog sunumu aşağıdaki sahiplik sınırlarını korur. Tamamlanan koşumlar doğrulama bölümünde ayrı sayılarla kaydedilir; native browser ve tam paket sonuçları yalnız kendi tamamlanmış kanıtlarıyla eklenir.

İnceleme girişi aynı normal uygulamada **`/?dev=story-9-15`** adresidir. Oyun bölümleri 9.14'ün aynı sayısal 6/7/8 Ahşap / Çivi / Karma tanımlarıdır; yeni hikâye, taş eşleşmesi veya malzeme toplama için ikinci bir motor kurmaz. `HexStoryAlpha` bu açık query'yi seçer ve fiziksel kayıtları **`hexrota-story-9-15:`** önekiyle ayırır. Main/Production'a otomatik geçiş bu girişin parçası değildir.

Temel sahiplik [ARCHITECTURE.md](ARCHITECTURE.md), malzeme kuralları [MATERIAL_COLLECTION_9_14.md](MATERIAL_COLLECTION_9_14.md), native aktarım sınırı [UNITY_MIGRATION_PLAN.md](UNITY_MIGRATION_PLAN.md) içindedir. Aşağıdaki kabul koşulları bu mevcut sınırları korur.

## Hikâye, oyun ve sunum sınırı

`HexStory` saf veri girdisiyle yeni hikâye durumu ve sunulabilir içerik üretir. DOM, SVG, UnityEngine, depolama, duvar saati, RNG veya animasyon callback'i bu reducer'ın karar kaynağı değildir. Gerçek takas, malzeme olayı, kutu hasarı, puan/zemin ve `playing/won/lost` sonucu mevcut `HexMatch` içinde kalır.

| Alan | Yetkili sahip / sınır |
| --- | --- |
| Tahta ve malzeme ilerlemesi | Mevcut JS/C# `HexMatch`; `classic-v6` / snapshot 6 |
| Hikâye ilerlemesi ve bir kez uygulama | Saf `HexStory` reducer'ı; içerik/tetikleyici/eylem doğrulaması |
| Olayın oyun sonucuna bağlanması | `HexStoryEvents`; aynı `HexMatch` ile kanonik checkpoint replay'i |
| Kalıcı yazım | Mevcut `sessionAction` / `commitSession`, tek revision altında kanonik `game + energy` |
| Diyalog ve seçim görünümü | Host/sunum adaptörü; tıklama tek başına ilerleme kanıtı değildir |
| Öğretici sahnesi ve mevcut Tavik portresi | Mevcut sahne projeksiyonu, `scene-presentation` / `tavik-dialogue` yaşam döngüsü |
| Yerel analitik | `HexEvents`; isteğe bağlı gözlem, hikâye kayıt defteri değildir |

Mevcut kaynaklar `dist/story-engine.js` / `HexStory`, `dist/story-events.js` / `HexStoryEvents`, `dist/story-profile.js` / `HexStoryProfile`, `dist/story-alpha.js` / `HexStoryAlpha`, `dist/story-presentation.js` / `HexStoryPresentation`, `data/story-content-v1.json` ve üretilmiş `dist/story-content.js` dosyalarıdır. `scripts/generate-story-content.cjs` içerik sarmalayıcısını ve mevcut public sahne dosyalarını denetler. `app.js` bu bileşenleri mevcut işlem/sunum yaşam döngüsüne bağlar.

Mevcut `dist/events.js` sonlu bir yerel analitik tamponudur: varsayılan son 500 olayı tutar, sıra numarası kullanır ve isteğe bağlı yazım hatası oyunu geri almaz. Bu tamponun temizlenmesi/budanması/reload'u hikâyeyi yeniden başlatmaz veya aynı tetikleyiciyi tekrar uygulamaz. Hikâye girdisi bu analitik listeden alınmaz; kanonik checkpoint'in gerçek replay'inden türetilir.

## Sürümler ve izole profil

| Kavram | Değer |
| --- | --- |
| İçerik | `schemaVersion:1`, `contentVersion:"story-content-v1"` |
| Reducer durumu | `version:"story-v1"` |
| Profilde hikâye zarfı | `version:"story-profile-v1"` |
| Geliştirici giriş sürümü | `HexStoryAlpha.version === "story-alpha-v1"` |
| Fiziksel storage öneki | `hexrota-story-9-15:` |
| Gerçek bölüm/veri kimliği | `material-alpha-v1` / `materials-v1`; değiştirilmez |
| Mevcut oyun / profil | `classic-v6` / snapshot 6; profil zarfı 2 |

`dist/story-alpha.js`, mevcut `HexMaterialAlpha` kataloğunu delege eder. On sayısal bölümün seçimi, A/B/C tam tanımları, deneme kimlikleri ve gameplay restore'u aynı kalır. `story-alpha-v1`, `levelDataVersion` yerine yazılamaz. Normal profil, `hexrota-flow-9-12:` ve `hexrota-material-9-14:` kayıtları kendi ad alanlarında kalır. Adaptör anahtarlara önek uygular; global Storage prototipi değiştirilmez.

Hikâye kaydının kanonik yeri:

```text
profile.game.story = {
  version: "story-profile-v1",
  states: { [stageIndex]: storyState }
}
```

`stageIndex`, mevcut uygulamanın aşama indeksidir; sayısal bölüm ID'si değildir. Normalizasyon bu alanı story adaptörü üzerinden açıkça korur ve doğrular. Eski profilde hikâye alanı yalnız ilgili story-mode board henüz yoksa kurulabilir; mevcut story board'un hikâye durumu eksikse kayıt bozuk sayılır, sessiz ilerleme üretilmez.

## İçerik şeması

Tarayıcı içerik girdisi `HEX_STORY_CONTENT` olur. `validateContent(raw)` bağımsız derin kopyayı doğrular ve derin dondurur. Üst alan kümesi tam olarak `{schemaVersion,contentVersion,speakers,scenes,chapters,nodes}` biçimindedir.

| Alan | Sözleşme |
| --- | --- |
| `speakers` | `[{id,name}]`; speaker ID referansları doğrulanır, serbest görsel/yükleme komutu içermez |
| `scenes` | `[{id,asset}]`; güvenli göreli public asset yolu; dosyanın varlığını host/paket kontrolü doğrular |
| `chapters` | `[{id,levelId}]`; bölüm ve pozitif sayısal level ID benzersizdir |
| `nodes` | Aşağıdaki tam alan kümesi; bilinmeyen/eksik alan kabul edilmez |

```text
{id,chapterId,speakerId,text,pose,trigger,conditions,once,
 priority,order,next,choices,sceneId}
```

Kimlikler `/^[a-z][a-z0-9-]{0,63}$/` biçimindedir. İçerik en fazla 8 speaker, 8 scene, 16 chapter ve 128 node içerir; speaker/chapter/node listeleri boş olamaz. Speaker adı 1–60, metin 1–240, seçim metni 1–80 karakterdir; yalnız boşluk veya yasak kontrol karakteri içeren metin geçerli değildir. `pose`, `idle`, `point`, `call` veya `celebrate` olur. `priority` ve `order` 0…1000 tamsayıdır; aynı chapter'da çiftleri benzersizdir. Daha yüksek priority, ardından daha düşük order ve ordinal node ID sırası kullanılır; belirsiz eşit çiftler reddedilir.

`next`, null veya aynı chapter'daki bir node ID'sidir. `choices`, boş veya 2–4 öğeli yoğun dizidir; her öğe tam `{id,text,next}` alanlarını taşır, ID node içinde benzersizdir ve hedef aynı chapter'dadır. Tek seçenekli liste reddedilir. `sceneId`, null veya geçerli sahne referansıdır. `once` açık boolean'dır.

`trigger`, null veya tam `{event,materialId,subject}` nesnesidir; filtre alanları null veya geçerli ID'dir. Null materialId/subject ilgili alanı kısıtlamaz; dolu değer olay alanıyla eşleşmelidir. `conditions`, en fazla 16 öğeli ve yalnız aşağıdaki biçimleri içeren **AND** listesidir:

```text
{kind:"event_seen",event,materialId,subject}
{kind:"node_acknowledged",nodeId}
{kind:"choice_selected",nodeId,choiceId}
```

Her chapter en az bir `level_started` tetikleyicisine sahiptir. Null-trigger node'a yalnız `next`/seçim bağlantısıyla ulaşılır. `next` ve seçim grafiği yönlü döngüsüzdür; ulaşılamayan node, bilinmeyen/başka chapter referansı ve imkânsız kendine/geleceğe koşul bağımlılığı reddedilir. Koşul için `eval` veya serbest betik çalıştırılmaz.

İçerik referansları yayımlanmadan önce çözümlenir; bilinmeyen sürüm, bozuk kimlik, geçersiz koşul veya tanımsız seçim sessiz varsayılanla kabul edilmez. Arayüzde görünmeyen bir düğme, reducer doğrulamasının yerine geçmez.

## Kanonik olay adaptörü

`HexStoryEvents.facts(level,metadata,snapshot,Engine=HexMatch)`, checkpoint'i aynı kanonik motorla başlangıçtan replay eder ve bölüm başlangıcından itibaren **tam sıralı olay önekini** döndürür. Canlı motoru değiştirmez; geçersiz snapshot açık hata verir. `context(content,metadata)` aynı denemenin chapter bağlamını kurabilir. Host gerçek takastan sonra, commit'ten önce aday hikâye ilerlemesini bu kanıtla hazırlar.

İzinli olay türleri şunlardır:

```text
level_started, valid_match, blocker_damaged, blocker_broken,
material_collected, region_opened, material_goal_completed,
level_won, level_lost, story_choice_selected, dialogue_acknowledged
```

Her olay bütün alanları taşıyan tam zarfı kullanır:

```text
{id,type,turn,wave,subject,materialId,quantity,total,cell}
```

`id`, 1–240 karakterlik `/^[A-Za-z0-9:/._-]+$/` güvenli dizgedir; aynı deneme/gerçek olayın replay'i aynı ID'yi üretir. Dış gameplay olayının kimliği tam olarak `attemptId + '/' + turn + '/' + wave + '/' + type + '/' + (subject || 'wave')` formülünü kullanır. Kaynak, kutu ve bölge kimliği bu son bileşene girer; subject yoksa `wave` kullanılır. `turn` ve `wave` 0…10000, `quantity` ve `total` 0…2.147.483.647, `cell` −1…10000 tamsayıdır. `subject` ve `materialId`, null veya geçerli içerik ID biçimindedir. Olay sırası tur, sonra dalga bakımından azalmayan sıradadır. `level_started` tur/dalga 0'dır; terminal olay son dalganın bir sonraki dalga indeksindedir.

| Gerçek olay | Payload anlamı |
| --- | --- |
| `valid_match` | `subject:null`, `quantity:matched.length`, `total:0`, `cell:-1` |
| `blocker_damaged` / `blocker_broken` | `subject:blockerId`, `quantity:1`, `total:kalanHP`, gerçek kutu hücresi |
| `material_collected` | `subject:sourceId`, gerçek kaynak miktarı, o toplama sonrasındaki malzeme toplamı ve gerçek kaynak hücresi |
| `material_goal_completed` | subject/materialId malzeme ID'sidir; quantity hedef miktarı, total kanonik toplamdır |
| `region_opened` | `subject:regionId`; açılma gerçek motor verisinden gelir |

Adaptör biçimin yanında anlamı da gerçek motor replay'ine bağlar. Reddedilen takas, ipucu, render, demo veya animasyon bitişi dış oyun olayı değildir. Malzeme tekilliği hücreye/Türkçe metne/DOM'a bağlanmaz; aynı hücrede farklı `sourceId` değerleri korunur. Harici prefix içinde yinelenen ID veya çelişkili olay verisi reddedilir.

`story_choice_selected` ve `dialogue_acknowledged` yalnız reducer eylemlerinin `narrativeEvents` listesine yazılır; harici facts girdisi olarak kabul edilmez. Subject node ID'sidir; quantity/total 0, cell −1'dir. Tur/dalga son dış olaydan alınır; saat okunmaz. Eylem ID'leri `instanceId + "/ack"` veya `instanceId + "/choice/" + choiceId` biçimindedir.

## Saf API, durum ve diyalog eylemleri

| API | Sonuç |
| --- | --- |
| `validateContent(raw)` | Doğrulanmış, bağımsız ve derin dondurulmuş içerik |
| `create(content,context)` | İlk kanonik hikâye durumu |
| `observe(content,state,facts)` | Delta yerine tam kanonik prefix'i tüketen yeni durum |
| `acknowledge(content,state,instanceId,skipped=false)` | Geçerli etkin diyalog örneğinin onayı/atlanması |
| `choose(content,state,instanceId,choiceId)` | Geçerli etkin örnekte tanımlı seçimin uygulanması |
| `restore(content,raw,context,facts)` | Kanonik facts'e karşı journal replay'i ve tam eşitlik doğrulaması |
| `snapshot(state)` | Bağımsız JSON kopyası |
| `active(content,state)` | null veya yalnız sunum görünümü |

API'ler immutable'dır; mevcut girdi durumunu değiştirmez. Context tam olarak `{attemptId,levelId,levelDataVersion,variantId,chapterId}` alanlarını taşır. Attempt ID `a-{levelId}-{pozitifSerial}-{8küçükHex}` biçimindedir; level ID 1…10000 aralığındadır, kimlikteki bölümle ve chapter ile eşleşir. Veri/varyant sürümleri 1–80 karakterlik dizgelerdir. Hikâye gerçek gameplay kimliğini yeniden adlandırmaz.

Durumun tam alan kümesi şöyledir:

```text
{version:"story-v1",contentVersion:"story-content-v1",context,cursor,
 events,narrativeEvents,fired,acknowledged,selectedChoices,
 active,pending,journal}
```

`events`, tüketilen tam kanonik facts kopyasıdır; `cursor === events.length`. `observe`, daha önce tüketilen prefix'in her olayını birebir doğrular. Aynı prefix veya onun eşit kısa prefix'i idempotenttir; ikinci tetikleyici üretmez. İleri prefix gerçek olayların devamını içerir; sadece yeni delta verilmez.

`active`, null veya `{instanceId,nodeId,eventId}`; `pending` ve `fired` aynı öğe biçimindedir. Örnek kimliği `event.id + "/node/" + node.id` olarak kurulur. Bir onay/seçimden ulaşılan sonraki node, o eylemin sabit olay ID'sini kullanır. Örnek/dahili eylem ID'leri aynı güvenli karakter kümesinde en fazla 16.384 karakterdir; dış olay ID'sinin 240 karakter sınırı ayrıdır. `active(content,state)` şunu verir:

```text
{instanceId,nodeId,speakerId,speakerName,text,pose,
 choices:[{id,text}],sceneId}
```

Normal onay node'un `next` bağlantısını izler. Seçim node'u normal onayla kapatılamaz; `skipped:true` gerekir. Atla, node'un `next` bağlantısını izler, seçim yapmış sayılmaz. `choose`, tanımlı `choice.next` bağlantısını izler ve ayrıca `acknowledged` listesine `skipped:false` kaydı ekler. Onay kaydı `{instanceId,nodeId,skipped}`, seçim kaydı `{instanceId,nodeId,choiceId}` olur.

Aynı önceden kaydedilmiş ack/choice'ın tam tekrarı durumu değiştirmez. Yanlış/eski etkin örnek, bilinmeyen seçim veya önceden onaylanan örnekte çelişen eylem reddedilir. Ekrandaki düğmenin kapatılması bu reducer korumasının yerine geçmez; otomatik onay yoktur.

## Tetikleyici kuyruğu ve sınırlar

Önce olay duruma eklenir; koşullar mevcut olayı da görebilir. Aynı chapter'da eşleşen node'lar priority/order sırasıyla değerlendirilir. Mevcut etkin diyalog yeni yüksek öncelikli adayla kesilmez. Etkin yoksa ilk kabul edilen aday açılır; pending her eklemede aynı deterministik sırayla düzenlenir.

`once:true` node deneme başına en fazla bir, `once:false` en fazla sekiz kez fired olabilir. **Etkin öğe + pending toplam kapasitesi 16**, bütün fired geçmişi **256** öğedir. Bir node yalnız kuyruğa kabul edildiğinde fired sayılır. Kuyruk doluysa kalan adaylar deterministik olarak yok sayılır; eski olayı daha sonra görünmez bir kuyruğa ertelemek yoktur. Fired sınırı yeni node kabulünü durdurabilir, fakat gerçek gameplay facts akışını durdurmaz.

Doğrudan `next` önce kuyruğa alınır; bundan sonra eylem olayıyla eşleşen tetikleyiciler işlenir. Next hedefinin koşulları da geçmelidir; içerik bu bağlantıyı imkânsız hale getiriyorsa sözleşme hatası verilir. Bütün geçişler döngüsüz içerik grafiği/node sayısı ile sınırlıdır.

External facts en fazla **4096**, journal en fazla **512**, hikâye eylemi en fazla **256** olur. Journal yalnız şu biçimleri kabul eder:

```text
{kind:"observe",through:int}
{kind:"ack",instanceId,skipped:bool}
{kind:"choice",instanceId,choiceId}
```

Observe yalnız cursor ilerlediğinde journal'a yazılır; ardışık observe kayıtları son `through` değerinde birleşir. Kötü/taşan kayıtlar restore'da sessiz budanmaz; reddedilir.

## Atomik yazım, geri alma ve devam

Kanonik board/deneme, hikâye ilerlemesi ve mevcut can/ekonomi durumu aynı mevcut profil işlemine bağlanır. Host aday sonucu hazırlar; görünür ilerleme yalnız başarılı kanonik commit'ten sonra sunulur. Storage/revision hatası aday hikâye ilerlemesini, tetikleyici tüketimini ve onay/seçim etkisini son güvenli kayıtla birlikte geri alır. Başarısız commit'in ardından eski olay işlenmiş sayılmaz; başarılı commit'in görsel hatası da olayı yeniden uygulamaz.

Reload, kanonik kaydı doğrulayıp mevcut hikâye görünümünü yeniden kurar. `restore`, `create` durumundan raw journal'ı baştan oynatır; her observe için kanonik `facts.slice(0,through)` kullanır ve ortaya çıkan tam snapshot'ı raw kayıtla karşılaştırır. Son `cursor === facts.length` zorunludur; hikâye yetkili checkpoint'in gerisinde veya ilerisinde kalamaz. State içindeki saklanmış `events` tek başına kanıt değildir; dış proof her restore'da gerçek motor replay'inden gelir. Sahte/eksik/bilinmeyen alan veya geçmişle uyuşmayan ack/choice durumu reddedilir.

Önceden uygulanan olaylar sırf görünüm yeniden açıldı diye tekrar tetiklenmez. Restore sırasında aynı hikâye/deneme/veri sürümleri korunur; mevcut oyun snapshot'ına hikâye alanları eklenmez. `HexGameSave.normalize`, `story-profile-v1` alanını story adaptörüyle mevcut `game` içinde açıkça korur ve doğrular; yalnız dosyaya yazılmış olmasına güvenilmez. Kanonik commit ve rollback aynı doğrulanmış zarfı kullanır. Gerçek mounted kabulü, başarısız hamle/onay/seçim yazımı ile reload durumlarını kapsar.

İki sıfırlama farklıdır: `#settings-reset`, açık denemeleri ve bunlara ait story state'lerini temizleyen mevcut ilerleme sıfırlamasıdır. **`#settings-full-reset` → `#full-reset-confirm`**, gerçek `resetForTesting` yoludur: tek kanonik yazımla revision bir artar; varsayılan oyun/can verisi ile `{version:'story-profile-v1',states:{}}` kaydedilir, board ve attempt kayıtları temizlenir. Eski writer, host yeniden yüklenmeden önce revoke edilir; sahiplenilmiş eylem ve lifecycle callback'leri eski board/hikâyeyi geri yazamaz. Legacy/analitik temizlik ve uyumluluk aynaları yalnız story önekiyle çalışır. Normal, flow ve material profilleri, legacy v1 kayıtları dâhil korunur. Yeniden yüklenen geliştirici girişi boş veriyi korur; geliştirici modunun mevcut politikası gereği **`firstOpening:false`** kalır ve on bölüm serbest seçilir. Bu görünüm, sıfırlamanın eski veriyi koruduğu anlamına gelmez.

Serbest geliştirici bölüm seçimi, önceki kampanya bölümlerini tamamlanmış saymaz. 9.14'teki gibi sıra dışı 6/7/8 kazanımı gerçek snapshot/rekor/terminal kaydı üretebilir; sıralı ekonominin kalıcı temizleme/Altın/yıldız uygunluğu mevcut sahibinde kalır. Hikâye tetiklenmesi bu ekonomi koşulunu aşan ödül kanıtı değildir.

## Diyalog, sahne ve yaşam döngüsü

Mevcut öğretici sayaçları kanonik öğretici checkpoint'inin turundan türetilir; T1 Tahta 3/3 ve T2 Çivi 4/4 malzeme envanteri değildir. Yeni hikâye, bu sayaçları veya v4 öğretici sonuçlarını yeniden yorumlamamalıdır.

Mevcut sahne veri dosyası `data/scene-config-v1.json` sunum şeması 2 kullanır; `futureStory:{enabled:false,hooks:[]}` etkisiz bir uzantıdır. Yeni hikâye içeriği ayrı `story-content-v1` sözleşmesi / `HEX_STORY_CONTENT` girdisidir. Eski futureStory alanı tek başına uygulanmış hikâye motoru sayılmaz. Kanonik içerik `wood`/6, `nails`/7 ve `together`/8 chapter'larını; A ilk ahşap/hedef, B ilk çivi/hedef, C bölge/ilk kaynaklar/iki malzemeye bağlı plan seçimi/hedef akışını taşır. C'deki `gate-first` ve `coop-first` seçimleri anlatı yanıtını seçer; malzeme/ekonomi/tahta komutu değildir.

Sahne bağları mevcut `coop-v1` clearing/frame/roof/finished mobile WebP dosyalarıdır. Çekirdek yalnız güvenli `assets/...` yolu ve izinli WebP/PNG/SVG uzantısını kabul eder; üretici public dosyanın varlığını denetler. Bu eşleme gelecekteki Unity prefab/Animator bağından ayrıdır; gerçek Unity varlık veya sahne entegrasyonu yapılmış sayılmaz.

| İçerik sahne kimliği | Mevcut public görsel |
| --- | --- |
| `coop-clearing` | `assets/scenes/coop-v1/backgrounds/clearing-mobile.webp` |
| `coop-frame` | `assets/scenes/coop-v1/backgrounds/frame-mobile.webp` |
| `coop-roof` | `assets/scenes/coop-v1/backgrounds/roof-mobile.webp` |
| `coop-finished` | `assets/scenes/coop-v1/backgrounds/finished-mobile.webp` |

Gelecekteki Unity görsel adaptörü `sceneId` ve bu asset rolünü kendi prefab/renderer anahtarına; `pose` değerini mevcut `idle` / `point` / `call` / `celebrate` sunumuna bağlar. Bu bağlama anlatı tetikleyicisi veya yeni gameplay koşulu değildir. Blender dosyası, Unity Cloud kurulumu veya hesap yetkilendirmesi bu sürümün çalışması için gerekmez.


Portre, dünya aktörü, diyalog kartı ve sahne geçişi aynı kabul edilmiş görünümden çizilmelidir. Inline native `#story-dialog`, kanonik `data-story-instance` ve `data-story-node` alanlarıyla açılır; `#story-ack`, `#story-skip` ve `[data-story-choice]` düğmeleri her node için yeniden kurulur. Düğme closure'ı deneme, diyalog örneği, AppState modal açılışı ve generation kimliğini taşır; koparılmış/eski düğme callback'i ilerleme üretemez. `#story-portrait`, sahiplenilmiş `HexTavikMotion` aktörünü veya mevcut görsel yedeğini barındırır; clear/destroy eski decode/animasyon sonuçlarını geçersiz kılar. Animasyon/tween bitişi hikâye komutu değildir. Sahne decode/asset hatası, azaltılmış hareket veya efekt yokluğu oyunu ve kesinleşmiş hikâye durumunu değiştiremez. Yerel görsel yedekler yalnız sunum sahibindedir.

Mola, Home/gezinme, visibility/pagehide, resize, yeniden başlatma ve test reset'i sahiplenilmiş geçici işleri temizlemelidir. Mola/gezinme yalnız görünümü kapatır, node'u onaylamaz; dönüşte aynı kanonik etkin örnek sunulur. Hamle sırasında kesinleşen diyalog, hamle görseli bitmeden kart açmaz. Terminal bir hikâye bitişi onay bekliyorsa mola kullanılabilir; mevcut kazanma diyaloğu bu kuyruk açıkken gösterilmez. Eski diyalog düğmesi/animasyon/timer callback'i yeni deneme veya yeni diyalog örneğine uygulanmamalıdır. Başarılı reset, eski görsel işlerin yeni kaydı tekrar doldurmasını engelleyen mevcut full-reset bariyerini korumalıdır; başarısız reset son güvenli profili kullanılabilir bırakmalıdır.

## Unity ve sürüm uyumluluğu

Saf C# hikâye çekirdeği UnityEngine, GameObject, Animator, fizik callback'i, dosya veya ağ bağımlılığı almamalıdır. Unity host'u sürümlü içerik, doğrulanmış olay ve ack/choice komutlarını aynı girdiler olarak vermeli; çekirdeğin kanonik durumunu ve görünümünü kendi prefab/arayüzüne bağlamalıdır. Bir konuşmanın ses/animasyon bitişi onay yerine geçmez.

Wire alanları, null değerleri, tamsayı sınırları ve hatalar aynı exact içerik/context/event/state/journal sözleşmesini korur. `unity/Story/StoryEngine.cs` saf Wire tabanlı çekirdektir; `unity/StoryAdapter/CanonicalStoryFacts.cs` mevcut `HexMatch` üzerinden kanonik olayı, `StoryBindings.cs` gerçek bölüm kaynakları/hedefleri/kutu/bölge referanslarını doğrular. `unity/StoryParityHarness`, gerçek .NET 8 / C# 7.3 karşılaştırmasını yürütür. Unity onay/seçim girdisi gerçek `instanceId` ve izinli choice ID'sini taşır; yalnız metin/ekran sırasından komut kimliği çıkarılmaz.

Oyun kuralları/snapshot'ları v4/v5/v6, `materials-v1`, `objectives-v1`, deneme zarfı 1 ve profil zarfı 2 kendi anlamlarını korur. Hikâye şema/içerik sürümü bunlarla karıştırılmamalıdır. Normal oyuncu, flow ve material geliştirme ad alanlarına sessiz hikâye kaydı veya yeni deneme yazılmamalıdır.

## Doğrulama ve mevcut kanıt

Gerçek mounted uygulama kabulü `node check-story-ui.cjs` ile **15/15 grup, exit 0** geçti; yerel log `/workspace/scratch/story-ui.log` içindedir. Altı gerçek A/B/C kazanma yolu ve iki C seçimi; her checkpoint'in kanonik facts/journal restore'u; hamle/onay/seçim yazım hatasında atomik rollback; reload ve tekilleştirme; skip; mola/arka plan/Home, eski düğme ve yeni deneme; yalnız story namespace içinde ilerleme reset'i ve gerçek tam veri reset'i; normal hareket uçuşunun iptalinden sonra aynı kesinleşmiş hikâyenin sunumu; terminal bitişte Pause→Continue→onay→kazanım ve tam T1/T2 v4 sayaçları kapsanır. Tam reset grubunda gerçek iki düğme, tek yazım/revision+1, boş story/board/attempt ve varsayılanlar, eski callback'in etkisizliği, korunan normal/flow/material/legacy v1 kayıtları ve reload birlikte doğrulanır. Bu JSDOM koşumu native yerleşim veya cihaz dokunma kanıtı değildir. Stock harness yalnız can hesabı için UTC'yi sabitler; hikâye veya oyun saati/RNG değiştirilmez.

Tam `npm test` son kaynaklarla **exit 0** tamamlandı. Yeni `test:story` paketi **131 test/grup birimi** içerir: reducer 52, olay adaptörü 13, içerik 10, alfa 7, diyalog sunumu 17, profil 17 ve mounted 15. Bunlar rota/takas sayısı değildir. [Kalıcı doğrulama özeti](../reports/story-9-15/validation.json), [tam npm koşum kaydı](../reports/story-9-15/verification/npm-test.log) ve aşağıdaki native/browser kanıtları aynı son teslimi belgeler; 9.14 sonuçları 9.15 sonucu olarak kullanılmaz.

### Tamamlanan koşumlar

| Komut / ortam | Gerçek sonuç |
| --- | --- |
| `npm test` ve yeni `test:story` | **exit 0**; yeni yedi kontrolün toplam **131 test/grup birimi** de geçer. [Tam koşum kaydı](../reports/story-9-15/verification/npm-test.log). |
| `node check-story-ui.cjs` — gerçek uygulama, mounted JSDOM | **15/15 grup, exit 0.** Altı kazanma yolu, iki seçim dalı, atomik hata/rollback, strict restore, lifecycle/stale, ilerleme reset'i, gerçek tam veri reset'i ve tam T1/T2. [Son tam koşumdaki mounted sonuçlar](../reports/story-9-15/verification/npm-test.log). |
| `node check-story-parity.cjs` — .NET 8.0.428 / C# 7.3 | **282 senaryo, exit 0**; bütün altı kazanma yolunu kapsayan 10 authored rota/seçim/skip senaryosu ve 116 kanonik checkpoint gözlemi. 141 native fact-projection isteğinin 130'u başarılı kanonik projeksiyon, 11'i beklenen bozuk proof reddidir. 1.051 başarılı reducer çağrısı: 405 observe, 407 ack/choice (idempotent tekrarlar dâhil), 123 strict restore ve 116 snapshot izolasyonu. 125 şema/ilerleme/kimlik/eylem reddi. Ayrıca bir gerçek `HexMatch` kaybı → kanonik facts → veriyle tanımlı kayıp repliği → strict restore akışı sınanır; bu senaryo yalnız test içeriği/tek hamleli HP 2 bölüm kopyası kullanır, yayımlanmış gameplay/içerik değiştirilmez. [Native JSON kanıtı](../reports/story-9-15/verification/native-story.json) ve [282 senaryoluk son log](../reports/story-9-15/verification/native-story.log). |
| Önceki 16 native parity komutu | **16/16 exit 0**, [tarihsel native regresyon kaydı](../reports/story-9-15/verification/native-historical.log). Oyun v4/v5/v6, katalog, ipucu, reward, can, session/event, ekonomi, commands ve rescue korunur. |
| `node check-story-browser.cjs` — gerçek Chromium | **29/29 grup, exit 0; errors `[]`.** [Sonuç raporu](../reports/story-9-15/chromium/results.json), [koşum kaydı](../reports/story-9-15/verification/browser-chromium.log). 18 tam kazanma koşusu, 156 route hamlesi, 115 doğrulanmış açık anlatı eylemi ve 57 PNG. |
| `HEXROTA_BROWSER=webkit node check-story-browser.cjs` — gerçek WebKit | **29/29 grup, exit 0; errors `[]`.** [Sonuç raporu](../reports/story-9-15/webkit/results.json), [koşum kaydı](../reports/story-9-15/verification/browser-webkit.log). 18 tam kazanma koşusu, 156 route hamlesi, 115 doğrulanmış açık anlatı eylemi ve 57 PNG. |

Browser başına 320×568, 390×844 ve 430×932'de altı gerçek A/B/C rota/seçim koşusu tamamlanır; C'nin iki seçim dalı da oynanır. Gerçek giriş, açık onay/seçim/skip, birebir checkpoint reload'u, yinelenmeyen olaylar/tepkiler, hamle/onay/seçim kota hatalarında rollback, kısmi ilerleme reset'i ve gerçek tam veri reset'i sınanır. Lifecycle, koparılmış eski düğme, yeni deneme, korunmuş namespace'ler, tam T1/T2 ve normal hamle sunumunun iptalinden sonraki diyalog da kapsamdadır. Terminal bitiş onayını beklerken Pause→Continue aynı örneği korur; ancak açık son onaydan sonra mevcut kazanma diyaloğu açılır.

Her CTA mevcut fiziksel bounding box ve hit target üzerinden doğrulanıp **bir native touchscreen dokunmasıyla** çalıştırılır; iki gerçek rAF ile boyama kontrol edilir. Otomatik tekrar dokunma yoktur. Chromium sürüklemeleri aynı fiziksel altıgen uçları arasında `Input.synthesizeScrollGesture` / `preventFling:true` ile compositor-native touch kullanır; WebKit sürüklemeleri native mouse/pointer fallback yoludur. İki browser'da bütün tap'ler native touchscreen input'tur. Production Date/timer veya yapılandırma değiştirilmez. İki motor aynı dondurulmuş test harness'iyle çalışmıştır.

Toplam **114 PNG** vardır; browser başına 57. 390×844'te gerçek normal uygulamadan dört örnek:

| Browser | A giriş | B çivi toplama | C seçim | C sahne bitişi |
| --- | --- | --- | --- | --- |
| Chromium | [Görüntü](../reports/story-9-15/chromium/390-A-route0-intro.png) | [Görüntü](../reports/story-9-15/chromium/390-B-route0-collection.png) | [Görüntü](../reports/story-9-15/chromium/390-C-route0-c-plan-choice.png) | [Görüntü](../reports/story-9-15/chromium/390-C-route0-scene-ending.png) |
| WebKit | [Görüntü](../reports/story-9-15/webkit/390-A-route0-intro.png) | [Görüntü](../reports/story-9-15/webkit/390-B-route0-collection.png) | [Görüntü](../reports/story-9-15/webkit/390-C-route0-c-plan-choice.png) | [Görüntü](../reports/story-9-15/webkit/390-C-route0-scene-ending.png) |

Farklı gözlem türleri tek bir toplam olarak sunulmaz. Önceki oyun motoru, 9.14 bölüm verisi, öğreticiler ve sahne yapılandırması korunur. İzole Lab kontrolü de Chromium ve WebKit'te 6/6 grup geçti; ayrı loglar `/workspace/scratch/story-lab-*.log` içindedir.

| Katman | Doğrulanan kabul kapsamı |
| --- | --- |
| Saf reducer / veri | Şema/referans doğrulaması, stable olay kimliği, koşullar, deterministik sıra, idempotency, bozuk girdi reddi, immutable girdi |
| JS/C# parity | Aynı içerik/olay/ack/choice dizisi, tam durum/görünüm/wire ve restore karşılaştırması; gerçek .NET 8 / C# 7.3 |
| Normal uygulama | Altı gerçek A/B/C rotası; diyalog onayı ve seçimleri; tek kanonik yazım; başarısız kayıtta board/hikâye rollback'i |
| Browser | Chromium ve gerçek WebKit; 320×568, 390×844, 430×932; gerçek giriş, diyalog/tahta yerleşimi, reload, tekrar üretmeme |
| Yaşam döngüsü | Mola/arka plan/gezinme, stale callback, yeniden başlatma, reset, azaltılmış hareket ve görsel hata |
| Regresyon | Tam T1/T2, tarihsel skor/kat/sayaç sonuçları, mevcut malzeme/engel/akış, ekonomi/can/kayıt ve offline paket |

**Fiziksel iPhone/iOS Safari ve Unity Editor/IL2CPP testi yapılmadı.** Masaüstü WebKit veya C# parity bu cihaz/Editor testlerinin yerine geçmez. Hikâye metni/akışının insanlarla kullanılabilirlik değerlendirmesi de otomatik doğrulama sayısından çıkarılamaz.
