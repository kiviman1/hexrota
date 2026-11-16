# Hexrota — durum mimarisi ve başlangıç envanteri

## A — Değişiklik öncesi referans

Referans `main`: `996462b8513cfbdbe2747941c0aad76528357842` (PR #24 dahil). İlk bölümler bu referanstaki davranışın tarihsel envanteridir. `8fe2e7f` / `3509f58` envanter ve karakterizasyon commit'leri runtime'ı değiştirmedi. Uygulanan son sahiplik ve olay sözleşmesi aşağıdaki B–F kaydında; koşum, CI ve Preview kanıtları `STATE_REFACTOR_REPORT.md` içindedir.

Uygulama `SessionStore.boot` yazıcı kilidi alındıktan sonra başlar. `app.js` 1.684 satırlık bir oturum/DOM orkestratörüdür. Birçok saf alan zaten ayrı modüllerdedir; bu çalışma onları yeniden yazmak için gerekçe değildir. Başlangıçta beş üst ekran vardır: `home`, `game`, `journey`, `records`, `garden`. Ayarlar ekran değildir. HTML'de 15 gerçek `dialog` vardır; ayrıntılı katalog ve iç içe geçişler `STATE_TRANSITION_MATRIX.md` içindedir.

## Yetkili veri ve sınırlar

| Veri | Tek yetkili sahip / doğrulama | UI durumunun yapamayacağı |
| --- | --- | --- |
| Taş, puan, RNG, tur, zemin, kazanma/kaybetme | `HexMatch`; yardımlı denemede `HexAssistedGame` / komut replay'i | Kopya motor kurmak, olayla puan veya tur üretmek |
| Bölüm/varyant/Attempt ID | `attempts.js` kataloğu ve doğrulanmış metadata | UI operasyon seri numarasını Attempt ID saymak |
| Altın, yıldız, stok, tekil tamamlama/hoş geldin hakkı | `economy.js`; mevcut oturum doğrulaması | Modal kapanışı/animasyon bitişiyle ödül yazmak |
| Can, yenilenme, can kesintisi/muafiyeti | `lives.js`; provider kanıtları mevcut adaptörde | UI durumu kapanınca can kesmek veya ödül silmek |
| İkinci şans / makbuzlar | `rescue.js`, mevcut doğrulayıcı ve komut geçmişi | Aynı makbuzla tekrar +5 hamle üretmek |
| Kalıcı profil | `session-store.js`, tek yazıcı + revision CAS | Yeni profil anahtarı veya ikinci commit yolu oluşturmak |
| Eski kayıt okuma/geçiş | `game-save.js`, mevcut motor/komut replay doğrulaması | Bozuk kaydı yeni oyuncu kabul etmek |
| Öğretici ilerlemesi | Başarılı commit'teki doğrulanmış kayıt | Canlı motorun spekülatif turundan malzeme saymak |
| Kümes / botanik görünüm | Kümes: tamamlanan öğreticiler; bahçe: Economy.View yıldız eşikleri | Kampanya yıldızlarıyla kümesi yeniden kurmak |
| Ekran/modal/sunum koordinasyonu | Şimdi `HexAppState`, `HexStateSelectors`, `HexStateEffects`; başlangıçta `app.js` closure'ı | Yukarıdaki alanların ikinci veritabanı olmak |

Korunan sürümler: `hexrota-profile-v2`, `hexrota-match-v5`, `hexrota-lives-v1` uyumluluk aynası, LifeState v2, snapshot v4 / sürümlü yardımlı komutlar, Attempt metadata v1. Can/oyun/ekonomi aynı mevcut atomik commit'te kalır. C# saf çekirdek ve `GameSessionController.Execute` sınırı bu UI çalışmasının dışında kalır.

## Paylaşılan mutable değişkenlerin sınıflandırılması

Satır referansları yukarıdaki baseline'a aittir. Bunların hepsini durum makinesine taşımak amaç değildir.

| Değişken / grup | Gerçekte temsil ettiği | Başlangıç sahibi / korunacak sınır |
| --- | --- | --- |
| `screen` (33) | Gerçek üst navigasyon durumu | Bağımsız değişken kaldırıldı; `appState.navigation.screen` tek sahip |
| `modalStack` (36) | Sıralı modal koordinasyonu; native açık dialog fallback'i var | Bağımsız dizi kaldırıldı; instance kimlikli Core yığını + native Effects adaptörü |
| `paused` (33) | Pause modalının açık kalması; Settings tek başına pause değildir | Bağımsız bayrak kaldırıldı; Pause üyeliğinden `appPaused()` türetir; ses politikası korundu |
| `busy` (30), `presentation` (31) | Aynı görsel işin iki ayrı temsili | Mutable `busy` kaldırıldı; `appBusy()` current requested/pending presentation kaydını okur. Kaynak job yerel kalır |
| `pendingStage`, `pendingRestart` (33) | Önizleme/hedef bölüm ve açık onayın can teklifi bağlamı | Tipli modal verisi adayı; can teklifini mevcut LifeManager tekrar doğrular |
| `firstOpening` (28) | Yalnız bu açılışın ilk daveti; preview hazırlanmasından önce hesaplanır | Kalıcı ilerlemenin yerine geçmez; sunum oturumu latch'i |
| `fullResetPending` (29) | Başarılı test resetinden sonra eski belgenin geri döndürülemez yazım bariyeri | Spekülatif UI talebi değildir; yalnız başarılı `resetForTesting` sonrasında kapanır |
| `saved`, `sourceSaveKey`, `migrated`, `gameLoadIssue` (11–24) | Mevcut transaction çalışma kopyası / bootstrap sonucu | Kalıcı oturum ve yükleme alanında kalır; kanonik değer `session.current()` |
| `engine`, `active`, `activeLevel`, `activeAttempt` (30) | Gerçek etkin oyun ve katalog kimliği | Motor/deneme host'unda kalır; UI yalnız salt projeksiyon alır |
| `attemptPending`, `saveBlocked`, `loadIssue` (30) | Preview/aktivasyon ve replay/yükleme korumaları | Mevcut etkin deneme korumaları; doğrulanmadan birleştirilmez |
| `selected`, `hinted`, `focusIndex`, `pointer` (30–31) | Giriş/klavye/öneri scratch verisi | Board input host'unda yerel; motor snapshot'ı değildir |
| `epoch` (31) | Yükleme/navigasyon/iş kimliği için ortak nesil | Yeni UI iş token'larıyla birlikte korunur; mevcut motor/job referans çitleri kaldırılmadı |
| `hintJob` (31) | Worker, resolver, timeout ve motor referansı | Kaynak handle'ı yerel; hint token'ıyla requested/pending/terminal koordinasyonu Core'a bağlı |
| `invalidPresentation` (33) | Geçersiz takasın kısa dekoratif işi | Yerel controller/animation temizliği; gerçek hamle değildir |
| `terminalTimer`, `toastTimer`, `comboText` (31) | Gecikmiş sonuç efekti, geçici mesaj ve metin | Timer handle'ları yerel; kimlik/yaşam döngüsü çitleri gerekir |
| `assistanceMode`, `pendingAssistance` (34) | Stok seçimi, hedef ve ücretsiz önizleme scratch'i | Mevcut komut adaptörü; stok/hamle/puan otoritesi değildir |
| `economyManager`, `economyIssue`, `lastEconomyReward` (13) | Saf kural instance'ı, yükleme hatası ve son commit ödül sunumu | Mevcut ekonomi alanı / sunum hak sonucu |
| `rescueManager`, `rescueTimeFloor` (35) | Mevcut kurtarma kuralları ve UTC alt sınırı | Yeni UI saat/ödül otoritesi oluşturulmaz |
| `pendingRescueProvider`, `pendingLifeProvider` (35,563) | UI'da gösterilen mevcut transaction kimliği | Başlatılan işlem manager tarafından doğrulanır; UI token'ı makbuz değildir |
| `pendingRescueReceipt`, `pendingLifeReceipt` (35,563) | Doğrulanmış fakat henüz kanonik yazılamamış hak | İptal edilen görsel iş gibi atılamaz; mevcut kurtarma/yeniden teslim sınırı korunur |
| `lifeFeature`, `lifeManager`, `lifeIssue`, `lifeWriteFailed` (563) | Can aggregate çalışma kopyası, saf manager, yükleme/yazma koruması | Atomik game+energy commit'i; UI bunları çoğaltmaz |
| `lifeVerificationProvider`, `pendingLifeStart` (563) | TEST sağlayıcı doğrulaması ve bekleyen başlatma isteği | Mevcut provider / navigasyon adaptörü |
| `lifeLastPersistUtc`, `pendingResetLifeCost` (564) | Son başarılı can yazımı / onaylanan reset teklifinin üst sınırı | Mevcut ekonomik/atomik denetimler; UI tek başına bedel uygulamaz |
| `sessionDepth`, `sessionDirty`, `sessionRestoring` (567) | Senkron Unit of Work / rollback koruması | Aynen oturum host'unda; asenkron reducer efektiyle değiştirilmez |
| `sessionEventBaseline`, `sessionGameBaseline`, `sessionPlaytestBaseline`, `sessionPlaytestDirty` (567) | Yetkili commit başarısızlığında gözlem/çalışma kopyası geri alımı | Mevcut transaction tutarlılığı; UI store'a kopyalanmaz |
| `eventState`, `playtest` (484,540) | Yerel isteğe bağlı ölçüm aggregate'leri | Analitik başarısızlığı oyunu geri alamaz; başarısız oyun analitiğe başarı yazamaz |
| `rewardState`, `completionReward`, `completionRewardPlayed` (83) | Reward Director'ın restore edilmiş sunum durumu ve aynı sunum için tek atış | Ekonomi ödül hakkından ayrıdır; mevcut Director korunur |
| `scenePresentation`, `tavikDialogue`, `lessonDemo`, `scorePresentation`, `audio` (37–39,81,1162) | DOM/animasyon/ses adaptörü kaynak handle'ları | UI snapshot'ında DOM nesnesi/controller/worker saklanmaz |
| `committedSceneGame` (40) | Son başarılı kanonik commit'in sahne için salt referansı | Ayrı mutable ilerleme değildir; rollback'te mevcut durable profile döner |
| `tutorialBuildCounter`, `geometryCache`, `appViewport`, `appHeight`, `motionQuery` | DOM düğümü, geometri cache'i, platform ölçüm/tercih handle'ı | Durum makinesi değil; platform adaptöründe yerel |
| `variantCatalog` (8) | Doğrulanmış immutable katalog handle'ı | Katalog sahipliği değişmez; UI seçim RNG'si oluşturmaz |

## Gerçek paralel alanlar ve işlem sırası

- **Navigation**: Yukarıdaki beş ekran; Settings/Pause/Inventory/Provider bağımsız ekran değil, modaldir. Browser history/hash uygulama ekranını izler. Back üst modalı kapatır; Escape üst modalı veya assistance seçimini kapatır, oyunda Pause açar, diğer ekranlardan Home'a döner.
- **Gameplay phase**: Preview READY'dir. Presentation `requested` yalnız giriş rezervasyonudur ve semantik faz PLAYING kalır; başarılı kanonik commit sonrasındaki `pending` RESOLVING verir. İş bittikten sonra gerçek motor sonucu PLAYING/WON/LOST görünür; RESOLVING sırasında motor çoktan won/lost olabilir. Faz ayrıca saklanmaz ve ikinci bir kazanma hesabı değildir.
- **Modal**: Sıralı native top-layer. Pause→Settings→Reset gibi kasıtlı nesting korunur. Tutorial coach ve portre modal değildir; tek başına motoru durdurmaz. Sesin pause politikası ile board input blokajı aynı şey değildir.
- **Tutorial/Tavik**: `learn-1`/`learn-2` oyununda portre modu rezerve edilir; terminal anda kart gizlense bile küçük tam-vücut aktör geri dönmez. Portre görünür = rezerve mod + mevcut coach görünür. Aynı karar `syncScene()` tarafından iki adaptöre birlikte iletilir; sahnenin geometri/decode güvenliği yine sahne sahibindedir.
- **World**: Committed öğretici sayısı 0/1/2 → foundation/frame/finished; stars okunmaz. Materyal sayacı aynı Attempt ID'ye bağlı committed turn'den Tahta min(turn,3) / Çivi min(turn,4). İstenen sahne ile gerçekten yüklenen fallback görsel aynı olmak zorunda değildir.
- **Async**: İstek/bekleyen/başarılı/hatalı/iptal yalnız gerçek işlerde kullanılır. Worker/AbortController/animasyon referansları yereldir. Provider UI kapansa bile doğrulanmış teslim bekleyen makbuz kaybolamaz. Görsel load nesilleri mevcut scene modülünde kalır.

`sessionAction` async işi await etmez: callback'in senkron kısmını Unit of Work ile sarar. `performSwap`/`confirmAssistance` kendi kanonik commit'ini **ilk await'ten önce** yapar. Sonra yalnız görsel işlem çalışır. Animasyon sonucu ikinci swap/komut veya ödül üretemez.

İki ayrı selector gerekir: `canRouteBoardInput` görseli bitiren dokunuşa izin verebilir; `canStartMove` yeni hamle için playing + çözümleme yok koşulunu ister. Inventory diyalog içi komutları board'un tüm-modal blokajını aynen kullanamaz.

## Başlangıç bulguları — tarihsel denetim

| Seviye | Başlangıç kanıtı / sorun | Uygulanan çözüm / korunan sınır |
| --- | --- | --- |
| Critical / High | Bu incelemede doğrulanmış kalıcı veri/ekonomi bozulması veya çift hamle hatası yok. Mevcut CAS/replay/tek-yazıcı ve ödül testleri korunur. | Hipotezi gerçek açık diye raporlama; transaction yolunu yeniden kurma. |
| Medium | `openModal` bilinen kimlik/ebeveyn/ekran politikası olmadan komut kabul ediyor; bağımsız DOM çağrıları uyumsuz blokaj oluşturabilir. | 15 kimlikli katalog ve parent/screen/status guard'ları bağlandı; yanlış kombinasyon görünüm etkisinden önce reddedilir. Bu kayıt bozuldu iddiası değildir. |
| Medium | `showScreen` bilinmeyen adı Home'a çeviriyor, iptal/persist/dialog kapama etkilerini yine çalıştırıyor. | Geçersiz navigasyon önce reddedilir; sekiz gerçek host guard testi bu bilinçli düzeltmeyi doğrular. |
| Medium | Son hamle sunumu sırasında sentetik persisted `pagehide` + `document.hidden=false` sonrasında 80ms sonuç timer'ı eski belgeye win modalı açabiliyor. Kaydedilmiş oyun byte olarak değişmiyor. | Pagehide önce committed görünümü bitirir; terminal timer'ı temizleyip epoch ve UI generation'ı emekli eder. Kırmızı lifecycle testi şimdi geçer. BFCache reload/yazıcı politikası değişmedi; fiziksel cihaz hatası diye sunulmaz. |
| Medium | Tavik görünürlük kararı host'ta iki çağrıya dağıtılmış; PR #24 mevcut çift aktör hatasını zaten düzeltmiş. | Tek `projectPresentation` sahibi bağlandı; yeni bir çift aktör hatası bulunduğu söylenmez. PR #24 görünümü korunur. |
| Low | Ekran/modal/iş yaşam döngüsü dağınık closure değişkenleri ve tekrarlı türetimler üzerinden okunuyor. | Saf geçiş/selector ve DOM adaptörü eklendi. Job/controller, transaction scratch ve verified receipt verileri mevcut sahiplerinde kaldı. |

Native modal odak geri dönüşü gerçek tarayıcı davranışıdır; JSDOM polyfill'i bunun kanıtı değildir. Mevcut görsel geometri testleri bazı dialogları doğrudan `showModal()` ile açar. Üretim komut korumalarını gevşetmeden, adaptör native açılma/kapanmayı uzlaştırabilmelidir.

## Sabit kabul sınırları

PR #24'ün portresi, üç sütunlu tek coach kartı, 118 px kart ve aynı board/HUD ölçüleri; üst SVG katmanında iki taşın görünür karşılıklı takası; altı yönlü swipe; motion azaltma; gizlenme/iptalde temizlik korunur. Yeni diyalog kartı, alt açıklama şeridi veya animasyon atlama düğmesi eklenmez.

İki öğretici, 10 ana bölüm, 40 varyant / 80 sertifika; classic-v4 ve yardımlı komut sonuçları; tekil hoş geldin/kampanya ödülleri; can/TEST Altını/envanter/ikinci şans; eski kayıtlar ve çevrimdışı kabuk değişmez. PWA cache kuşağı yeni betikler için güncellenebilir; bu bir oyun/kayıt sürümü değişikliği değildir.

## Runtime değişmeden karakterizasyon kanıtı

`npm test` baseline üzerinde geçti. `check-state-characterization.cjs` 11 gerçek uygulama grubu geçti. `check-state-browser.cjs` hem Chromium hem WebKit üzerinde 19/19 geçti: altı viewport, gerçek T1/T2/tekrar, native focus/Back/Escape, sıfır canla kayıt devamı, aynı denemede kurtarma, kayıt hatası, gerçek iki-sekme kilidi, WAAPI hatası, arka plan, görsel fallback ve gerçekten bağlantısı kesilmiş origin üzerinden çevrimdışı reload. İki tarayıcıda da sıfır pageerror; fiziksel cihaz testi değildir. Baseline çıktıları geçici test artifact'ları olarak ayrı tutulur; son refaktör koşumu bunların yerine eski sonuç diye raporlanmaz.

`check-state-lifecycle.cjs` baseline'da sentetik suspension sonrası eski win modalının açılmaması assertion'ında kırmızıydı; kayıt/enerji/ödül ön koşulları geçiyordu. E düzeltmesiyle test yeşile döndü ve normal `test:state` / `npm test` zincirine alındı. Başlangıçta kırmızı sonuç nihai başarı sayısına eklenmez.

## B–F uygulama kaydı

Kod geçişi ve konsolidasyon uygulanmıştır. Son yerel `npm test` geçti; nihai browser/CI/Preview koşumları baseline sonuçlarıyla karıştırılmadan `STATE_REFACTOR_REPORT.md` içinde izlenir.

| Aşama | Uygulanan değişiklik |
| --- | --- |
| A — `8fe2e7f`, `3509f58` | Runtime değişmeden envanter, 11 host karakterizasyon grubu ve iki motorun 19'ar baseline browser grubu. |
| B — `ed14aeb` | DOM'suz `app-state.js` ve Core'a bağlı salt `state-selectors.js`; bağımsız testler. |
| C — `a6daca1` | Navigasyon/native modal adaptörü; `screen`, `paused`, `modalStack` kaldırıldı. Stage C'deki 24/24 iki-browser ve C# session/event sonuçları tarihsel kapı kanıtıdır. |
| D — `0c41663` | Tek Tavik/öğretici/sahne projeksiyonu, committed turn sayaçları ve ortak giriş selector'ları bağlandı. |
| E — `4176aa9` | Görsel operation token'ları, derived busy, commit sonrası pending, hint ve suspension yaşam döngüsü bağlandı; kırmızı lifecycle testi düzeltildi. |
| F — son konsolidasyon | Başarılı tam-reset sonrası iki recurring timer temizliği, UI/portre sahiplerinin destroy'u ve güncel sahiplik belgeleri. Son commit ve teslim kanıtı rapordadır. |

Core dört küçük paralel bölge tutar: `navigation`, instance kimlikli `overlays`, `lifecycle`, bounded `operations`. En fazla son `presentation` ve `hint` kaydı tutulur; board, ekonomi, can, profile veya receipt içeriği yoktur. Immutable snapshot ve FIFO abonelik kuyruğu, eski modal/iş kimliklerinin reddi ve own-data kopyalama UI sözleşmesidir. Giriş komutları hâlâ mevcut domain/replay/tek-yazıcı korumalarını kullanır.

## Saf çekirdeğin gerçek olay sözleşmesi

`HexAppState.initialState()` dondurulmuş başlangıç görünümünü üretir. `transition(state,event,facts)` saf ve deterministiktir; `{accepted,changed,reason,state,effects}` döndürür. Reddedilen olayın `state` referansı değişmez, etkisi yoktur. `create()` özel store oluşturur; uygulamanın store'u global yayınlanmaz. `snapshot()` immutable veri verir; `preview()` değişiklik yapmadan guard'ı değerlendirir. `subscribe()` kaldırılabilir abonelik döndürür; `destroy()` sonraki dispatch'i reddeder. Genel wildcard DOM event bus yoktur.

| Olay | Tam payload | Gerçek anlamı / guard |
| --- | --- | --- |
| `NAVIGATE` | `screen` | Yalnız beş katalog ekranı. Game için çağıran mevcut doğrulanmış denemeden `facts.gameAvailable=true` sağlar. Geçişte UI iş nesli emekli olur; oyun açma komutu değildir. |
| `OPEN_MODAL` | `id` | Sonlu 15 modal, geçerli ekran/ebeveyn/sonuç koşulu. Aynı açık ID idempotent. Başarı yeni opening instance üretir. |
| `CLOSE_MODAL` | `id, instance` | Yalnız aynı açılış. Eski close yeni pencereyi kapatamaz. Alttan kapatma geride yasak zincir bırakıyorsa reddedilir. |
| `CLOSE_ALL` | Ek alan yok | Açık modalları stack sırasıyla üstten alta kapatan etkiler. Kalıcı işlem yapmaz. |
| `APP_VISIBILITY_CHANGED` | `hidden: boolean` | Gerçek platform görünürlüğünün transient gözlemi; kendi başına can/ödül veya motor pause komutu değildir. |
| `APP_SUSPENDED` | Ek alan yok | Bu belgenin görsel iş neslini iptal eder. Host önce mevcut committed görseli güvenle tamamlar. |
| `APP_RESUMED` | Ek alan yok | Belge sunumunu tekrar kullanılabilir kılar; eski işi veya eski timer'ı diriltmez. |
| `INVALIDATE_OPERATIONS` | Ek alan yok | Deneme/yükleme gibi mevcut resource sınırında görsel/hint neslini emekli eder. |
| `OPERATION_REQUESTED` | `token` | `kind, id, attemptId, generation` kimliği. Görünür Game ve modal yok koşulu; sıradaki yerel seri. Presentation için yalnız giriş rezervasyonu; faz henüz PLAYING. |
| `OPERATION_PENDING` | Aynı `token` | Presentation için yalnız başarılı kanonik commit sonrasında; faz RESOLVING. Hint için gerçek hesaplama bekler. Aynı bildirim no-op, eski token ret. |
| `OPERATION_SETTLED` | Aynı `token`, `status` | `succeeded`, `failed` veya `cancelled`; eski/yinelenen terminal bildirim ikinci etki üretmez. |

Operasyon kimlikleri **Attempt ID veya mali transaction ID değildir**. En fazla son `presentation` ve `hint` kaydı tutulur; sınırsız iş günlüğü büyümez. `beginOperation/markOperationPending/settleOperation/invalidateOperations` store'un dar kolaylık API'leridir. `beginOperation` abonelik bildiriminin içinde yeni kaynak sahipsiz kalmasın diye kuyruğa eklemeden reddedilir; açık `dispatch` ise FIFO reentrancy sağlar.

Olaylarda bilinmeyen/eksik/fazla alanlar ve yanlış türler reddedilir. Veri kopyası yalnız kendi veri descriptor'larını okur; getter, kalıtılmış `toJSON` veya özel dizi metodu çalıştırmaz. Çağıranın nesnesi dondurulmaz veya değiştirilmez. `facts` içinde yalnız bilinen primitive guard alanları okunur; motor/profile nesnesi store'a alınmaz.

`facts.engineStatus` gerçek motorun `playing/won/lost` değeridir; reducer bu sonucu üretmez. `facts.blocked` host'un başarılı full-reset bariyerini aktarır. `facts.recovery` yalnız **istenen provider'a ait** mevcut doğrulanmış teslim bekleyen hak için verilir; herhangi bir pending makbuz bütün modal politikasını serbest bırakmaz.

## Selector ve DOM adaptörü sözleşmesi

`HexStateSelectors` Core'dan yalnız ekran kataloğu ve temel salt yardımcıları alır; döngüsel bağımlılık yoktur. `gameplayPhase` gerçek aktif deneme ve mevcut presentation kaydından READY/PLAYING/RESOLVING/WON/LOST türetir. `isResolving` requested/pending giriş kilididir; `gameplayPhase` ise requested için PLAYING, yalnız pending için RESOLVING verir. Working motor adayı requested sırasında terminal görünse bile bu, doğrulanmış sonuç UI'sı değildir. `canRouteBoardInput`, `canStartMove` ve `canUseInventory` ayrı korumalardır. `committedTutorialProgress` eski geçerli indexed array container'larını da okur; yıldız veya yeni bir malzeme defteri okumaz.

`projectPresentation(state,domainView)` immutable `{screen,phase,actorMode,portraitVisible,motionPaused,progress,scene,portrait}` üretir. `.scene` ve `.portrait` mevcut adaptörlerin payload'larıdır. Tek `PORTRAIT/WORLD/NONE` kararı iki görsele iletilir. `tavikState` yalnız mevcut onaylı klipleri IDLE/TALKING/POINTING/INSPECTING/BUILDING/CELEBRATING/WORRIED gibi kavramlara eşler; yeni varlık/timer veya ikinci aktör kurmaz.

`HexStateEffects.create({document,window,state,getFacts,onClose,runAction,onError})` native modal/history/focus adaptörüdür. `canOpen/open/close/closeAll/topDialog/renderScreen/destroy` dış API'sidir. Profil yazmaz; `onClose` mevcut `sessionAction` üzerinden çalışır. Opening instance'e bağlı kapanış, yeni `pendingStage` veya provider bağlamını eski event ile temizleyemez. Varsayılan kapatma yalnız üst modala izin verir. İzinli internal alttan kapanış bile gerekli ebeveyni yetim bırakamaz. Native API dışarıdan bu kuralı aşarsa aynı örnekleri özgün top-layer sırasıyla onarır; bu onarım onay/iptal/ödül callback'i çalıştırmaz.

Yalnız geçerli, hâlâ bağlı ve görünür opener'a odak döner; nav sırasında gizlenen ekrana odak taşınmaz. Mevcut dış native geometri testleri güvenli bir input barrier olarak görülür, üretim komut guard'ına sınırsız giriş sağlamaz. `destroy()` aboneliği, owned close listener'larını, opener/acknowledgment referanslarını temizler.

## Async ve belge yaşam döngüsü sahipliği

`startPresentation` mevcut kaynak job'una UI token rezervasyonu ekler; `activatePresentation` başarılı kanonik commit'ten sonra pending'e geçirir. Rezervasyon tahsis edilemiyor veya hata veriyorsa geçerli domain komutu/ödülü reddedilmez; host aynı committed sonucu hızlı gösterir. `finishPresentation` current job + mevcut epoch ile sınırlıdır; hata/watchdog/iptal controller'ı, kaynak taşları, skor paketlerini ve animasyonları temizler. UI tamamlanması ikinci swap, stok kullanımı veya makbuz değildir.

Hint kendi current-job, engine, epoch ve UI token kontrolünü birlikte kullanır. İptal Worker'ı terminate eder, timer/resolver'ı temizler; geç sonuç daha yeni denemeye yazamaz. Invalid-swap feedback ve scene/pose decode nesilleri mevcut yerel modüllerinde kalır; her geçici handle Core'a taşınmaz.

Visibility olayı önce gerçek `document.hidden` gözlemini kaydeder, committed sunumu tamamlar ve mevcut pause/result politikasını korur. Pagehide ayrıca terminal timer'ı temizler, epoch'u artırır ve APP_SUSPENDED ile UI iş neslini emekli eder; sahne host'unu destroy eder. Pageshow yeni görünürlüğü ve APP_RESUMED'i bildirip sahne sunumunu yeniden kurabilir; eski işi diriltmez. Gerçek persisted dönüşte SessionStore'un sayfayı yeniden yükleyip Web Lock'u tekrar alma politikası değişmez.

Başarılı `resetForTesting` önce tek kanonik reseti yazar ve writer'ı revoke eder. Ancak bundan sonra `fullResetPending` true olur, iki life/rescue recurring timer'ı durur, StateEffects/Core/Tavik/sahne sahipleri kapatılır. Hatalı reset eski session'ı kullanılabilir bırakır. Mevcut global host callback'leri senkron reset bariyeriyle korunur; hepsinin yeni bir global event bus'a taşındığı iddia edilmez.

## Doğrulama sınırı

`npm test`, eski zincirin tamamını ve `test:state` kontrollerini içerir. Yerel son koşumda Core 19, selector 19, DOM effects 15, gerçek host karakterizasyonu 11, adversarial guard 8, operation UI 4 grup ve lifecycle kontrolü geçti. Rakamlar farklı test birimleriyle toplanmaz. Mevcut 15 Actions işi korunur; yeni state-browser Chromium/WebKit matrisinin iki işi eklendi. Workflow tanımı gerçek koşum başarısı değildir; final CI/Preview ve tarayıcı kanıtı raporda kaydedilir. Fiziksel iOS/Android ve Unity/IL2CPP testi yapılmadı.
