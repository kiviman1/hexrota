# Hexrota — durum mimarisi ve başlangıç envanteri

## A — Değişiklik öncesi referans

Referans `main`: `996462b8513cfbdbe2747941c0aad76528357842` (PR #24 dahil). Bu bölüm mevcut davranışın envanteridir; aşağıdaki planlanan sınırlar henüz uygulanmış sayılmaz. İlk envanter/karakterizasyon commit'i runtime'ı değiştirmez. Son uygulama sahipliği, doğrulama ve kalan borçlar ayrıca bu belgenin sonunda ve `STATE_REFACTOR_REPORT.md` içinde kaydedilir.

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
| Ekran/modal/sunum koordinasyonu | Başlangıçta `app.js` closure'ı | Yukarıdaki alanların ikinci veritabanı olmak |

Sürümler değişmeyecek: `hexrota-profile-v2`, `hexrota-match-v5`, `hexrota-lives-v1` uyumluluk aynası, LifeState v2, snapshot v4 / sürümlü yardımlı komutlar, Attempt metadata v1. Can/oyun/ekonomi aynı mevcut atomik commit'te kalır. C# saf çekirdek ve `GameSessionController.Execute` sınırı bu UI çalışmasının dışında kalır.

## Paylaşılan mutable değişkenlerin sınıflandırılması

Satır referansları yukarıdaki baseline'a aittir. Bunların hepsini durum makinesine taşımak amaç değildir.

| Değişken / grup | Gerçekte temsil ettiği | Başlangıç sahibi / korunacak sınır |
| --- | --- | --- |
| `screen` (33) | Gerçek üst navigasyon durumu | Uygulama navigasyonuna taşınacak |
| `modalStack` (36) | Sıralı modal koordinasyonu; native açık dialog fallback'i var | Modal bölgesi + DOM adaptörüne taşınacak |
| `paused` (33) | Pause modalının açık kalması; Settings tek başına pause değildir | Stack üyeliğinden türetilebilir; mevcut ses davranışı korunacak |
| `busy` (30), `presentation` (31) | Aynı görsel işin iki ayrı temsili | Görsel operasyon yaşam döngüsünden tek türetim adayı; kaynak job yerel kalır |
| `pendingStage`, `pendingRestart` (33) | Önizleme/hedef bölüm ve açık onayın can teklifi bağlamı | Tipli modal verisi adayı; can teklifini mevcut LifeManager tekrar doğrular |
| `firstOpening` (28) | Yalnız bu açılışın ilk daveti; preview hazırlanmasından önce hesaplanır | Kalıcı ilerlemenin yerine geçmez; sunum oturumu latch'i |
| `fullResetPending` (29) | Başarılı test resetinden sonra eski belgenin geri döndürülemez yazım bariyeri | Spekülatif UI talebi değildir; yalnız başarılı `resetForTesting` sonrasında kapanır |
| `saved`, `sourceSaveKey`, `migrated`, `gameLoadIssue` (11–24) | Mevcut transaction çalışma kopyası / bootstrap sonucu | Kalıcı oturum ve yükleme alanında kalır; kanonik değer `session.current()` |
| `engine`, `active`, `activeLevel`, `activeAttempt` (30) | Gerçek etkin oyun ve katalog kimliği | Motor/deneme host'unda kalır; UI yalnız salt projeksiyon alır |
| `attemptPending`, `saveBlocked`, `loadIssue` (30) | Preview/aktivasyon ve replay/yükleme korumaları | Mevcut etkin deneme korumaları; doğrulanmadan birleştirilmez |
| `selected`, `hinted`, `focusIndex`, `pointer` (30–31) | Giriş/klavye/öneri scratch verisi | Board input host'unda yerel; motor snapshot'ı değildir |
| `epoch` (31) | Yükleme/navigasyon/iş kimliği için ortak nesil | Tipli iş token'larıyla beraber denetlenecek; mevcut motor/job referans çitleri korunur |
| `hintJob` (31) | Worker, resolver, timeout ve motor referansı | Kaynak handle'ı yerel; istek/iptal/sonuç koordinasyonu ayrı |
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
- **Gameplay phase**: Başlangıç preview'i READY; oynanabilir doğrulanmış deneme PLAYING; devam eden görsel iş RESOLVING; gerçek motor sonucu WON/LOST. RESOLVING altında motor çoktan won/lost olabilir. Bu, motorun sonucunu yeniden hesaplayan ikinci bir makine değildir.
- **Modal**: Sıralı native top-layer. Pause→Settings→Reset gibi kasıtlı nesting korunur. Tutorial coach ve portre modal değildir; tek başına motoru durdurmaz. Sesin pause politikası ile board input blokajı aynı şey değildir.
- **Tutorial/Tavik**: `learn-1`/`learn-2` oyununda portre modu rezerve edilir; terminal anda kart gizlense bile küçük tam-vücut aktör geri dönmez. Portre görünür = rezerve mod + mevcut coach görünür. Aynı karar iki adaptöre iletilmelidir; sahnenin geometri/decode güvenliği yine sahne sahibindedir.
- **World**: Committed öğretici sayısı 0/1/2 → foundation/frame/finished; stars okunmaz. Materyal sayacı aynı Attempt ID'ye bağlı committed turn'den Tahta min(turn,3) / Çivi min(turn,4). İstenen sahne ile gerçekten yüklenen fallback görsel aynı olmak zorunda değildir.
- **Async**: İstek/bekleyen/başarılı/hatalı/iptal yalnız gerçek işlerde kullanılır. Worker/AbortController/animasyon referansları yereldir. Provider UI kapansa bile doğrulanmış teslim bekleyen makbuz kaybolamaz. Görsel load nesilleri mevcut scene modülünde kalır.

`sessionAction` async işi await etmez: callback'in senkron kısmını Unit of Work ile sarar. `performSwap`/`confirmAssistance` kendi kanonik commit'ini **ilk await'ten önce** yapar. Sonra yalnız görsel işlem çalışır. Animasyon sonucu ikinci swap/komut veya ödül üretemez.

İki ayrı selector gerekir: `canRouteBoardInput` görseli bitiren dokunuşa izin verebilir; `canStartMove` yeni hamle için playing + çözümleme yok koşulunu ister. Inventory diyalog içi komutları board'un tüm-modal blokajını aynen kullanamaz.

## Başlangıç bulguları

| Seviye | Kanıt / sorun | Yapılacak / yapılmayacak |
| --- | --- | --- |
| Critical / High | Bu incelemede doğrulanmış kalıcı veri/ekonomi bozulması veya çift hamle hatası yok. Mevcut CAS/replay/tek-yazıcı ve ödül testleri korunur. | Hipotezi gerçek açık diye raporlama; transaction yolunu yeniden kurma. |
| Medium | `openModal` bilinen kimlik/ebeveyn/ekran politikası olmadan komut kabul ediyor; bağımsız DOM çağrıları uyumsuz blokaj oluşturabilir. | Mevcut kasıtlı nesting'i katalogla, yasak kombinasyonları görünüm etkisinden önce reddet. Bu kayıt bozuldu iddiası değildir. |
| Medium | `showScreen` bilinmeyen adı Home'a çeviriyor, iptal/persist/dialog kapama etkilerini yine çalıştırıyor. | Geçersiz navigasyonu önce reddet; bunu bilinçli davranış düzeltmesi olarak test et. |
| Medium | Son hamle sunumu sırasında sentetik persisted `pagehide` + `document.hidden=false` sonrasında 80ms sonuç timer'ı eski belgeye win modalı açabiliyor. Kaydedilmiş oyun byte olarak değişmiyor. | Suspension görsel neslini iptal etmeli; gerçek BFCache reload/yazıcı politikası değiştirilmez. Fiziksel cihaz hatası diye sunulmaz. |
| Medium | Tavik görünürlük kararı host'ta iki çağrıya dağıtılmış; PR #24 mevcut çift aktör hatasını zaten düzeltmiş. | Çalışan davranışı tek projeksiyon sahibine bağla; yeni bir çift aktör hatası bulundu deme. |
| Low | Ekran/modal/iş yaşam döngüsü dağınık closure değişkenleri ve tekrarlı türetimler üzerinden okunuyor. | Saf geçiş/selector ve açık adaptör sınırları ekle; her scratch değişkeni makineye taşıma. |

Native modal odak geri dönüşü gerçek tarayıcı davranışıdır; JSDOM polyfill'i bunun kanıtı değildir. Mevcut görsel geometri testleri bazı dialogları doğrudan `showModal()` ile açar. Üretim komut korumalarını gevşetmeden, adaptör native açılma/kapanmayı uzlaştırabilmelidir.

## Sabit kabul sınırları

PR #24'ün portresi, üç sütunlu tek coach kartı, 118 px kart ve aynı board/HUD ölçüleri; üst SVG katmanında iki taşın görünür karşılıklı takası; altı yönlü swipe; motion azaltma; gizlenme/iptalde temizlik korunur. Yeni diyalog kartı, alt açıklama şeridi veya animasyon atlama düğmesi eklenmez.

İki öğretici, 10 ana bölüm, 40 varyant / 80 sertifika; classic-v4 ve yardımlı komut sonuçları; tekil hoş geldin/kampanya ödülleri; can/TEST Altını/envanter/ikinci şans; eski kayıtlar ve çevrimdışı kabuk değişmez. PWA cache kuşağı yeni betikler için güncellenebilir; bu bir oyun/kayıt sürümü değişikliği değildir.

## Runtime değişmeden karakterizasyon kanıtı

`npm test` baseline üzerinde geçti. `check-state-characterization.cjs` 11 gerçek uygulama grubu geçti. `check-state-browser.cjs` hem Chromium hem WebKit üzerinde 19/19 geçti: altı viewport, gerçek T1/T2/tekrar, native focus/Back/Escape, sıfır canla kayıt devamı, aynı denemede kurtarma, kayıt hatası, gerçek iki-sekme kilidi, WAAPI hatası, arka plan, görsel fallback ve gerçekten bağlantısı kesilmiş origin üzerinden çevrimdışı reload. İki tarayıcıda da sıfır pageerror; fiziksel cihaz testi değildir. Baseline çıktıları geçici test artifact'ları olarak ayrı tutulur; son refaktör koşumu bunların yerine eski sonuç diye raporlanmaz.

`check-state-lifecycle.cjs` ayrı bir hedefli kırmızı testtir: baseline'da sentetik suspension sonrası eski win modalının açılması assertion'ında beklendiği gibi başarısız olur; kayıt/enerji/ödül ön koşulları geçer. Bu test Stage E düzeltmesiyle birlikte etkinleştirilecektir.

## B–F uygulama kaydı

Bu bölüm aşamalar gerçek kod ve testlerle tamamlandıkça güncellenecek. Henüz pure core, yeni runtime veya tamamlanmış migration iddiası yoktur. Kamu API'leri, son sahiplik ve Unity eşlemesi uygulama tamamlandıktan sonra gerçek dosyalara göre yazılacaktır.
