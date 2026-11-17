# Hexrota 9.9b — Tahta doğrulaması ve güvenli kurtarma

## Uygulama öncesi sınır kararı

Başlangıç main `f8b0fe25c802404b0516e1b65033fc32627d67fb`; PR #30 merged. 9.9a rescue davranışı bu işte yeniden uygulanmaz. Özgün R-02 fixture'ı değiştirilmez.

Çekirdeğin kabul ettiği yapı, yayımlanmış kampanya başlangıcından daha geniştir. Tek hücre, tek değerli palet, sıfır seed/target/bütçe, başlangıç eşleşmesi veya hamlesiz durum, bileşen incelemesi/tarihi okuma için geçerli olabilir. Bunlar kurtarmanın başarı sağlayabileceği veya yayınlanabilir tahta olduğu anlamına gelmez.

### Çekirdek yapı güvenliği

- Boş olmayan hücre dizisi, null olmayan hücreler ve benzersiz signed-int32 axial koordinatlar. Tam int32 uçlarında C# komşuluk/desen ara hesapları taşmadan yapılmalı; hücre sırası değişmez.
- Boş olmayan, yoğun int32 palet ve aynı hücre sayısında, tamamen paletten gelen başlangıç değerleri. Null/undefined başlangıç taşı yoktur. Palet sırası ve mevcut tekrarların ağırlığı korunur; sort/dedupe/default renk eklenmez.
- Ground için mevcut eksik/null/0 → 1 varsayımı korunur; aksi değerler negatif olmayan int32 olmalı ve başlangıç kat toplamı taşınabilir int32 aralığını aşmamalı. Yayın verisinin 1/2 kat şartı ayrıca mevcut yayın kapısındadır.
- Seed uint32, 0 mevcut fallback'i kullanır. Bütçe ve puan hedefi negatif olmayan int32'dir. Kimlik, sertifika, bölüm zorluk kategorisi veya bağlılık şartı çekirdeğe taşınmaz.
- Core kurulurken RNG çekilmez ve otomatik kurtarma yapılmaz. Başlangıçtaki eşleşme/yasal hamle durumu gerçek motorla incelenir; tek başına constructor reddi değildir.

### Kurtarma güvenliği

- `_stableBoard/StableBoard` ve `_ensurePlayable/EnsurePlayable`, değişiklikten önce yapı/palet ve mevcut değerlerin uzunluk/üyeliğini denetler. Kurtarma en az iki **farklı** palet değeri ister; tek değerli bileşen constructor'ı bundan ayrı kalır.
- Başarıda her taş izinli ve dolu, tahta eşleşmesiz ve en az bir yasal normal takaslıdır. `EnsurePlayable=false` yalnız zaten yerleşmiş ve oynanabilir tahta için no-op'tur.
- 128 permütasyon, 64 kontrollü yapım, 12 desen ve 32 dalga politikası geçerli girdilerde aynı kalır. Ek RNG çekimi, renk veya algoritma eklenmez.
- Açık ret/hata halinde yardımcı metodun değiştirebildiği values/RNG başlangıca geri alınır. Puan, zemin, hamle, turn ve geçmiş yardımcı tarafından değiştirilmez.
- Yardımcı metot atomikliği, bütün `swap` işlemi için yeni bir transaction sistemi değildir. Gerçek uygulama/AssistedGame/native oturumun mevcut clone/checkpoint/commit/rollback sınırları korunur ve ayrıca test edilir.

### Yayın ve gelecekteki import sınırı

Mevcut offline başlangıçta eşleşme olmaması, birden fazla yasal açılış, iki bağımsız kazanma başlangıcı, 40 varyant/80 sertifika, hamle bütçesi, zorluk ve değişmezlik kontrolleri korunur. Tarihi `original-v1`, archived varyantlar ve assisted-v1 kayıtları bunların güncel sürümüne zorla geçirilmez.

Level Studio import'u ileride çekirdek yapının yanında yerleşmiş/yasal açılış, güncel yayın koşulları, kaynak sınırları ve skor aritmetiği kapasitesini de doğrulamalıdır. Çekirdek yapı doğrulaması evrensel kazanılabilirlik veya keyfi büyüklükte içerik için mobil performans garantisi değildir.

## Kök neden ve davranış değişikliği

Özgün `fixtures/dead-board-vectors-9-9.json` içindeki `known-issue-single-palette-fallback-missing-value` tanısı değiştirilmedi (SHA-256 `b3e9c892a262bf0d868c821c2a70bf459b9081297205097efc1b9744a32aa349`). Eski desenin modulo-4 hesabı 0 veya 1 palet indeksini seçiyordu. Tek değerli paletin ikinci elemanı yoktu; JS `undefined`, C# `null` üretiyor ve doluluk denetlenmediğinden başarı bildirilebiliyordu.

| Durum | Önce | Şimdi |
|---|---|---|
| Özgün R-02, EnsurePlayable | 128 permütasyon + 64 kontrollü deneme, 1.216 RNG çekimi; RNG 762117529 ve dört boş/geçersiz taşla başarı | Yapı kabul edilse de kurtarma açık hata; sıfır çekim, RNG 1 ve bütün snapshot aynı |
| Aynı tek değerli tahta, doğrudan StableBoard | 448 çekimden sonra hatalı desen başarısı | Değişiklikten önce aynı açık ret |
| Boş palet | Eksik eleman/üretim davranışı | Constructor/Reset değişiklikten önce `Invalid match-three level` |
| Geçerli iki/çok değerli kurtarma | Mevcut deterministik üretim | Aynı taşlar, RNG ve diğer alanlar; ek başarılı RNG çekimi yok |
| İmkânsız tek hücreli şekil, iki değer | Sınırlı denemelerden sonra hata, yardımcı RNG'si değişmiş kalabiliyordu | Aynı sınırlı denemeler/hata; yardımcı girişindeki taşlar ve RNG geri gelir |
| Başlangıç eşleşmesi olan bileşen | Constructor kabulü | Kabul korunur; EnsurePlayable bunu zaten yerleşmiş sayamaz |

`dist/engine.js` içindeki `validateLevel` / `HexMatch.validateLevel` ve `unity/Gameplay/HexMatch.cs` içindeki `ValidateLevel` aynı yapısal sözleşmeyi uygular. C# DTO zaten int/uint türündedir. JS'ye özgü `undefined`, sparse array, NaN, Infinity veya kalıtılmış alan gibi temsiller ayrı JS testleridir; bunlar derlenmiş JSON karşılaştırmasıymış gibi sayılmaz.

`layers:null` ise **geçerli JSON**'dur: JS ve gerçek `CatalogWire.ReadLevel` (catalog/commands/application yolu) tarihsel varsayılan 1'i kullanır. Doğrudan gameplay harness'ın mevcut typed `JsonSerializer` okuyucusu nonnullable `Cell.layers` için explicit null kabul etmez. Bu önceden var olan taşıma farkı nedeniyle iki null-layer örneği 74 ortak doğrudan-harness girdisinin dışında tutulur. `wire:false`, her durumda “JSON'da temsil edilemez” anlamına gelmez; bu typed okuyucu için ortak girdi olmadığı anlamına da gelir. Keyfi JSON → C# okuyucularının tamamında eşlik iddiası yoktur; üretim catalog aktarım yolu değişmedi.

C# `BoardTopology` komşu/hat hesabını long ara değerlerle sınırlar; int32 uçlarında koordinat sarmasıyla sahte komşu üretilmez. Desen hesabı da long kullanır. Normal hücre, hat, komşu, sütun ve yasal hamle sıraları korunur. Sınır koordinatlarında eski C# integer-wrap ile üretilen sahte komşuluk korunmaz; artık gerçek JS geometrisiyle eşleşir. Yayımlanmış ve arşivlenmiş bölüm geometrileri bu sınır durumunu kullanmaz. `AxialCoordinate.Neighbor` temsil edilemeyen komşuda checked overflow verir.

### Açık hata sözleşmesi

- Yapı: `Invalid match-three level`.
- Kurtarmaya verilen eksik/yabancı taş: `Invalid recovery board`.
- İkiden az farklı palet değeri: `Recovery requires at least two distinct palette values`.
- Sınırlı algoritma oynanabilir yerleşim bulamazsa eski `This board shape cannot provide a settled legal swap` hatası korunur.
- Son yardımcı sonucu sözleşmeyi bozarsa `Recovery did not produce a settled legal board`.

C# yapı reddi `ArgumentException`, kurtarma reddi `InvalidOperationException`; ortak karşılaştırma alanı mesaj ve tam önce/sonra JSON durumudur, dilin exception sınıfı değildir. Geçersiz hamlenin normal `{ok:false}` sonucu, desteklenmeyen yapı için exception'dan ayrı kalır.

## Sahiplik, kayıt ve uyumluluk

- Yardımcılar yalnız değer üretir; puan/zemin/turn/geçmiş/ekonomi veya kayıt yazmaz. Başarısız yardımcı kendi taş/RNG değişikliğini geri alır. Bu, doğrudan `HexMatch.swap` çağrısının tamamını atomik yapan yeni bir sözleşme değildir.
- Gerçek `app.js` komut checkpoint'i ve mevcut canonical commit/rollback yolu korunur. Kurtarma hatasında hamle kalıcılaşmaz; açık tekrar aynı denemeyi başarıyla commit edebilir. F-01 sonrası sunum bitişi ek canonical yazı üretmez.
- `AssistedGame` clone/preview/apply sınırı değişmedi. R-01'in yeni istek reddi ile tarihsel assisted-v1 replay istisnası PR #30'daki gibi kalır. Tarihi PLAYING/5 hamle/sıfır yasal takas checkpoint'i yeniden yazılmaz; yeni istekle üretilemez.
- Snapshot v4, assisted-v1, Attempt metadata v1, bölüm/veri kimlikleri, profile/match/life anahtarları, ekonomi/ödül/receipt ve 40 yayımlanmış varyant değişmedi. Güncel arşiv ve bütün 80 kazanma sertifikası aynı sonuçları üretir.
- Özgün audit fixture'ının `afterError` alanları eski, atomik olmayan yardımcı davranışının kanıtıdır; güncel başarısız kurtarmanın istenen sonucu diye kullanılmaz. Sağlıklı yeni test giriş snapshot'ının bütünüyle korunmasını ister.
- `check-engine.mjs` eski 100..118 sentinel bileşenini geçerli kurulumdan sonra **aynı değerleri açıkça atayarak** kurar; doğrudan `_fillVacancies` çıktısı/assertion'ları korunur. Yabancı taş içeren bu çalışma durumu yayın/restore veya kurtarma girdisi değildir.
- `fixtures/board-validation-protected.json` yalnız engine, C# HexMatch/BoardTopology ve gameplay harness için dört dosyalık, main `f8b0fe2` tabanlı inceleme iznidir. Balance Lab karşılaştırması ayrıca yalnız observable raporunun kaynak hash alanını bu fixture ile sabitler; diğer rapor byte'ları eski sabit referansla aynen karşılaştırılır. Eski `command-core-hashes.json`, gameplay/command çıktı goldeni ve diğer korunmuş dosyaların hash'leri değiştirilmez.
- Runtime'ın çevrimdışı güncellenmesi için yalnız PWA kabuk kuşağı **43 → 44** olur. app.js ve hint-worker değişiklikleri cache query'siyle sınırlıdır; oyun/kayıt sürümü artmaz, Production yapılandırması değişmez.

## Kalıcı regresyon kapsamı

| Test | Gerçekte doğruladığı |
|---|---|
| `check-board-validation.cjs` | 6 grup; 13 kabul/101 ret yapı örneği, 92 güncel/orijinal/arşiv konfigürasyonu, 4 tarihsel restore. 74 JSON/C# ortak örnek. |
| `check-board-recovery.cjs` | 12 grup; singleton/boş/iki/çok değer, sahte hücre başarısının reddi, imkânsız şekil, tekrar sonrası başarı ve sınırlı hata, klasik/assisted dalga kurtarması, restore/replay. 17 native karşılaştırma girdisi. |
| `check-dead-board-recovery.cjs` | 14 grup; eski sağlıklı mekanikler ve R-01 geçmiş uyumluluğu. Özgün R-02 sağlık koşulu artık açık ret + tam korunan durumla geçer; başarı dönerse dolu/izinli/eşleşmesiz/yasal takas koşulları hâlâ zorunlu. |
| `check-gameplay-parity.cjs` + gerçek .NET harness | Önceki 71 mekanik, 4 sağlıklı kurtarma, 80 sertifika ve 120 rota dışı koşu; ek 17 tam kurtarma önce/sonra/hata ve 74 yapı karşılaştırması (12 kabul/62 ret). Null, taş dizisi, RNG, score, kat, turn, hamle, history, eşleşme/yasal takas ve resume/replay karşılaştırılır. |
| `check-board-recovery-ui.cjs` | 14 grup: gerçek uygulamada yardımcıya girmeden/gerçek yardımcıdan çıktıktan sonra bir kerelik hata; başarısız komutta 0 canonical yazı, açık başarılı tekrarda 1 yazı, aynı attempt ve reload. Ek 12 saf assisted swap/key apply/preview/clone koruma kontrolü. |
| `check-board-recovery-browser.cjs` | Chromium ve WebKit'te 320×568, 390×844, 430×932 × iki hata konumu; 6 + 6 gerçek native touch/reload senaryosu. Eski dört hücreli fixture yalnız yerel HTTP testinde numeric original L1'e eşlenir; yayın verisi değişmez. |

Saf ve browser testleri gerçek orijinal yardımcıyı çalıştırır; bir kerelik hata, mevcut host rollback sınırını sınar. Bütün motor veya presenter yerine sahte başarı koyulmaz. Native C# host'una hata enjekte edildiği iddia edilmez; native helper'ın kendi gerçek hata/rollback durumları derlenerek ayrıca karşılaştırılır.

İmkânsız şekil testi, EnsurePlayable'ın yeni yerleşmişlik kontrolü yüzünden 204 yerine 205 match taraması görür. Ek bir doğrulama vardır; 64 kontrollü yapım/RNG çekimi, 128/64/12 bütçeleri ve hata sınıfı değişmez. Eski sınır gevşetilmedi.

## Analiz raporlarının değişmezliği

Mevcut observable ve solvability araçları yeniden çalıştırıldı. Tam JSON karşılaştırmasında **yalnız üç kaynak hash alanı** değişti: observable.sourceHash; solvability.sourceHash; solvability.historicalObservableReference.sourceHash. Tüm episode, sertifika, zorluk, garanti ve metrik alanları aynıdır. Yeni rapor kaynak hash'leri:

- Observable: `0e1e58969d4286a7254259c296de582e5431e6bb372f5a73bc99390cc3f7e8e4`.
- Solvability: `212f0da8520b30fee508d030ff4a2942bf7540f253f9e7dd3554d025e2550d49`.

## Final doğrulama

Yerel birlikte doğrulama, 2026-11-17 UTC:

| Gerçek komut / kapsam | Exit / sonuç |
|---|---|
| Başlangıç `npm run audit:dead-board-diagnostics` | **1**, özgün R-02 yeniden üretildi. |
| Son `npm test` | **0**, 333,355 sn. Bütün mevcut zincir korunur; içinde engine/tutorial/variant, save/life/economy/rescue, state, F-01, animasyon, `npm run test:solvability` ve yeni `test:board-validation` vardır. |
| Son `npm run audit:dead-board-diagnostics` | **0**, güncel açık sağlık bulgusu 0; R-01'in tarihsel sağlıksız checkpoint'i ayrı karakterizasyon olarak tutulur. |
| Observable / solvability yeniden üretim | İkisi de **0**, 364,772 / 73,083 sn; tam JSON'da yalnız yukarıdaki üç hash alanı değişti. Full npm içindeki solvability `--check` de birebir rapor üretimiyle geçti. |
| Yeni gerçek browser kurtarma testi | **Chromium 0 / WebKit 0**, 6/6 + 6/6; sıfır page error. Üç mobile viewport, native touch ve gerçek reload. |
| `git diff --check`, syntax, PWA ve dar hash kapıları | **0**; app/hint-worker/HTML/ui-kit farklarının cache query'siyle sınırlı olduğu ayrıca byte-normalize karşılaştırıldı. |

**10/10 gerçek C# npm komutu exit 0**, .NET SDK **8.0.428**, C# **7.3**, 01:32:09–01:33:54 UTC. JS fallback yoktur. Koşum boyunca izlenen kaynak/fixture fingerprint'leri değişmedi.

| C# komutu | Gerçek karşılaştırma kanıtı |
|---|---|
| `test:unity-rewards` | 104 ortak vektör + createState (98 kabul, 7 ret). |
| `test:unity-gameplay` | 1.916 geçerli takas, 258 resume, 262 replay, 2.177 clone, 1.050 bozuk kayıt reddi; eski 71 mekanik + 4 kurtarma + 80 rota + 120 rota dışı koşu. Ek 17 kurtarma ve 74 yapısal girdi karşılaştırması. |
| `test:unity-catalog` | 2.107 JSON, 725 seçim, 610 resume, 80 tam sertifika/600 hamle, 21 arşiv ve 546 ret. |
| `test:unity-hints` | 1.003 karşılaştırma; gerçek kazanma garantileri bağımsız replay edildi, kaynak/RNG değişmedi. |
| `test:unity-reward-adapter` | 175 rota, 1.456 turn, 2.928 dalga, 1.564 replay/restore. |
| `test:unity-lives` | 344 derlenmiş istek, 460 geçiş, 152 donmuş v1 migration, 172 ek probe. |
| `test:unity-economy` | 125 akış, 579 tam sonuç/durum karşılaştırması. |
| `test:unity-commands` | 2.952 tam karşılaştırma, 16.051 adım, 3.332 dalga; değişmeyen command çıktı hash'i `5f9650ace1553ab24dff9511c212d4bb533c75792d52dced4c4d46bb9f9be99f`. |
| `test:unity-rescue` | 376 karşılaştırma (293 eski + 83 hak koruma), 600 compiled lifecycle geçişi. |
| `test:unity-session` | 1.362 JSON, 36 gerçek app akışı, 63 native hata/guard senaryosu; aynı komutun event harness'ı da çalışır. |

Commands sürücüsünde 9.9a'dan kalmış “R-02 hâlâ kırmızı” console açıklaması, yeni diagnostikle çelişmemesi için düzeltildi; assertion/fixture/karşılaştırma değişmedi. Bu açıklama değişikliğinden sonra gerçek commands parity ayrıca yeniden çalıştırıldı: **exit 0**, 17,338 sn.

Bu sayılar farklı tür gözlemlerdir; toplanarak tek bir hayali test sayısı üretilmez. C# akış/receipt/hata testleri korunur; native uygulama içinde beklenmedik recovery exception'ı enjekte edildiği iddia edilmez.

Son mevcut browser regresyonu **8/8 komut exit 0**: Chromium session (5 kontrol) ve integration/offline (6 kontrol); Chromium/WebKit rescue (10+10), state (25+25), animation (23+23). Bütün raporlanan page-error dizileri boştur. Koşum 01:28:55–01:33:49 UTC, runtime fingerprint'leri sabit. İlk tarayıcı çağrısı ortam yeniden başlarken süreç/sonuç üretmeden kesildi; bu çağrı başarı sayılmadı. Tam sıra yeniden başlatıldı ve tamamlandı.

Son C# birlikte koşumunda 224 kaynağın önce/sonra SHA-256 özeti aynı: `e19e64d0b71918ce632833b5dc6b9d7085b7a9b297ccf5b450097ac872bcd2af`. Son native hata mesajı ve commands console açıklaması bu koşuma dahildir. Tam npm'in JS kaynakları bundan önceki ve sonraki koşumda aynıdır; son C# mesajı sonrası dar tema/command hash kontrolleri ayrıca exit 0 ile tekrarlandı.

İlk yeni JSDOM reload denemesinde ayrı yerel event-store test seed'i eksikti. Kalıcı profilin yanına gerçek event-store seed'i eklenerek test kurulumu düzeltildi; runtime veya assertion gevşetilmedi. Eski kaynak hash kapıları da silinmedi: dört incelenmiş dosyalık açık overlay eklendi ve özgün davranış golden'larıyla tekrar kontrol edildi.

İlk uzak CI **#71** (head `5a56a5a`) Balance Lab izolasyon adımında tarayıcı açılmadan eski motor hash'ine takıldı. Bu ortam hatası sayılmadı. Mevcut Lab testi eski kaynak SHA'sını zorunlu kılıyordu; yeni motor için dört dosyalık aynı inceleme overlay'i kullanıldı. Yeniden üretilen observable raporunda da yalnız tek `sourceHash` alanı farklı olduğundan bu alan açıkça sabitlendi; geri kalan rapor **byte-byte** eski referansa eşit olmak zorundadır. Lab'ın sabit commit'i, varlıkları, bütün authored verisi, diğer 74 değişmez dosyası ve 10 özel profil anahtarına sıfır erişim koşulları korunur. Hiçbir izolasyon veya davranış assertion'ı kaldırılmadı.

Son yerel `npm run test:balance-lab-economy`: **Chromium exit 0 / 6 grup**, 11,181 sn; **WebKit exit 0 / 6 grup**, 13,140 sn. Güncel gerçek motorla kazanma, kayıp, tekrar, reload, deney seçimi ve hatalı kimlik; Gold/yıldız/envanter/can/Attempt ID/profil değişmezliği tekrar doğrulandı. Bu ek düzeltme yalnız test uyumluluk kapısı ve metadata'dır; motor ve C# davranışları değişmedi.

CI mevcut **15 iş tanımı / matrix sonrası 17 işi** korur. Yeni saf test npm test'e; yeni browser test+JSON/ekran görüntüsü artifact'ı iki mobile browser işine eklenir. Yeni native vakalar mevcut gerçek gameplay parity işinde derlenir. Uzak CI koşumunun güncel durumu teslim PR'ının Checks ve doğrulama bölümünde verilir; bu belge henüz bitmemiş uzak koşumu başarılı ilan etmez.

## Kalan sınırlar

1. Bu sözleşme **oynanabilir** ile **kazanılabilir** olmayı eşitlemez. Yasal takas, keyfi oyuncu kararından kazanma garantisi değildir. H-01/H-02 ve A-01 bu dar R-02 işinde çözülmedi.
2. Düzensiz/bağlantısız geometri çekirdekte incelenebilir; her şekil için kurtarma çözümü garanti edilmez. Algoritma bulamazsa açık ve atomik yardımcı hatası verir; mobilde yeni solver yoktur.
3. Yapısal int32 kabulü, keyfi taş/skor toplamları için bütün ileriki aritmetiğin taşmayacağını veya çok büyük ithal içeriğin mobilde hızlı olacağını garanti etmez. Gelecekteki Level Studio skor kapasitesi, kaynak limitleri ve yayın kabulünü ayrıca denetlemelidir.
4. LevelConfig geometrisi motor ömrü boyunca sabittir. Cache'lenmiş topolojinin yerinde editör mutasyonu bu işin API'si değildir; yeni konfigürasyon/motor oluşturulmalıdır.
5. Desteklenmeyen ithal tahtada booster UI preview'sının exception gösterimi için yeni UI eklenmedi. Kaynak oyun clone/command sınırında korunur; Studio bu girdiyi UI'ya sunmadan doğrulamalıdır.
6. Fiziksel iPhone/Android, Unity sahnesi/IL2CPP testi yapılmadı. Otomatik WebKit gerçek fiziksel iOS testi olarak sunulmaz. Performans iyileşmesi veya evrensel çözüm iddiası yoktur.

## Değişen dosyalar

- `.github/workflows/ci.yml`
- `check-balance-lab-economy-isolation.cjs`
- `check-board-recovery-browser.cjs`
- `check-board-recovery-ui.cjs`
- `check-board-recovery.cjs`
- `check-board-validation.cjs`
- `check-comic-ui.cjs`
- `check-command-parity.cjs`
- `check-commands.cjs`
- `check-dead-board-recovery.cjs`
- `check-engine.mjs`
- `check-gameplay-parity.cjs`
- `dist/app.js`
- `dist/engine.js`
- `dist/hint-worker.js`
- `dist/index.html`
- `dist/sw.js`
- `dist/ui-kit.html`
- `docs/ARCHITECTURE.md`
- `docs/BOARD_VALIDATION_9_9B.md`
- `docs/DEAD_BOARD_RECOVERY_REPORT.md`
- `docs/RESCUE_SAFETY_9_9A.md`
- `docs/SOLVABILITY_AUDIT_9_9.md`
- `fixtures/board-validation-protected.json`
- `package.json`
- `reports/observable-difficulty.json`
- `reports/solvability-9-9.json`
- `unity/Gameplay/BoardTopology.cs`
- `unity/Gameplay/HexMatch.cs`
- `unity/GameplayParityHarness/Program.cs`
