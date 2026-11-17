# Hexrota 9.9c — Çözücü bütünlüğü ve doğrulanmış ipuçları

Başlangıç main `11b0161e913904199198ca61f477f47bb11ad390`. PR #29, #30 ve #31'in merged olduğu ve bu main'in ataları olduğu doğrulandı. Çalışma ayrı `fix/hexrota-solver-integrity-9-9c` dalındadır. Oyun motoru veya state mimarisi yeniden yazılmadı.

## Üç bulgunun sınırı

| Bulgu | Özgün kırmızı kanıt | 9.9c sağlık koşulu |
|---|---|---|
| A-01 | L1/v1 audit prefix'i, `maxNodes=1`: 9 prefix takasına ek 4 arama takası; hepsi kayıp | Tam 1 yeni çocuk, `unknown / node_budget_exhausted`; prefix bütçe dışı |
| H-01 | L1/v1 iki rotası `[[14,18]]`, `[[13,16]]` olarak kısaltılınca eski JS `proven_route/guaranteed=true` verir; devam sonunda oyun hâlâ playing | Klonda gerçekten won olmayan devam asla authored guarantee olamaz; aynı girdide sınırlı arama heuristic/false/null verir |
| H-02 | Derinlik/beam sınırlı runtime sonucunda `truncated=false`, aramanın tamamı tarandı anlamına gelmez | Eski runtime alanları korunur; offline sonuçta bağımsız sınırlama bayrakları, bitiş nedeni ve kanıt sınıfı açıkça raporlanır |

Özgün audit metni ve fixture'ları silinmedi. Ek [solver-integrity-baseline-9-9.json](../fixtures/solver-integrity-baseline-9-9.json) uygulama öncesi gerçek kırmızı çalışmayı, kaynak hash'ini ve tam A-01 prefix'ini dondurur. Bu dosya eski yanlış garantiyi istenen yeni davranış olarak tanımlamaz.

## A-01: Katı çevrimdışı bütçe

Sahip `lib/level-analysis.cjs` içindeki mevcut beam çözücüdür. `solve(level, options)` hâlâ kazanma rotası veya `null` döndürür; yeni algoritma veya mobil çözücü eklenmedi. Ek `solveWithReport(level, options)` aynı aramanın tanısını döndürür.

Bir genişletme, mevcut motorun klonunda yapılan **bir gerçek çocuk swap çağrısıdır**. Kazanan ve kaybeden çocuklar da sayılır. Bütçe her çocuk oluşturulmadan önce denetlenir; kayıp çocuğun `continue` dalı sınırı atlayamaz. Sağlanan prefix'in yasal tekrar oynatılması yeni arama düğümü/depth bütçesine dahil değildir ve `prefixMoves` olarak ayrıca sayılır.

- Varsayılanlar: `width=40`, `maxNodes=30000`, `maxDepth=level.moves-prefix.length`.
- Açık `maxNodes` ve `maxDepth`, negatif olmayan safe integer; `width`, pozitif safe integer olmalıdır. `0` node/depth çocuk genişletmez. Null/string/fraction/NaN/Infinity/negatif veya safe-integer dışı değer RangeError verir; gizli coercion/default yoktur.
- Prefix array olmalı; hatalı veya terminalden sonra uzatılan hamle geçmişi `invalid_prefix / unknown`, `solve=null` üretir. Geçerli terminal prefix ayrıca değerlendirilir.
- Düğüm sayısının bütçeye **eşit** olması tek başına kesilme değildir. Son izinli çocuk kazanırsa rota verilir; bütün çocuklar tam bu sınırda tüketildiyse gerçek exhaustive sonuca izin verilir.
- Mevcut legal order, rank ve eşitlik sırası korunur. 40 başlangıç + 80 sertifikalı ilk-hamle prefix'inde ample bütçeli 120 eski/yeni çözüm byte olarak aynı ve bağımsız replay ile won'dur.
- Kanıt dedup anahtarı values/layers/RNG/score/movesLeft'i tam ayırır. Çok basamaklı ground vektörleri için virgüllü ayrı anahtar kullanılır; mevcut politika/cache anahtarlarına dokunulmaz.

## H-02: Tanı sözleşmesi ve kanıt anlamı

```js
{
  route, classification, terminationReason, searchedNodes, prefixMoves, depth,
  limits: {maxNodes, maxDepth, width},
  nodeBudgetCutoff, depthLimited, beamPruned, exhaustive
}
```

| Alan/değer | Gerçek anlam |
|---|---|
| `proven_winnable` | Gerçek motorun won ile bitirdiği rota var |
| `proven_unwinnable` | Yalnız mevcut prefix sonrası normal classic takaslar ve kalan hamle bütçesi altında, kayıp terminal durum veya budanmamış eksiksiz frontier tüketimiyle kanıt |
| `unknown` | Çözüm bulunamadı; bütçe/derinlik/beam veya geçersiz prefix nedeniyle imkânsızlık kanıtı yok |
| `solution_found` | Kazanma rotası bulundu; bütün arama uzayını tüketmek gerekmez |
| `node_budget_exhausted` | İşlenmeyi bekleyen çocuk varken yeni genişletme bütçesi kalmadı |
| `depth_limit` | Seçili frontier'da araştırılmamış yasal devam varken derinlik sınırına ulaşıldı |
| `beam_pruned` | Önceden budanan olasılıklar var; elde tutulan frontier tükense de kanıt tam değildir |
| `search_exhausted` | Gerçekten eksiksiz, budanmamış sonuç; terminal prefix de bu sınıfa girer |
| `invalid_prefix` | Verilen geçmiş geçerli başlangıç/komut devamı değildir; sınıflandırma unknown |

Birden fazla sınırlama varsa birincil neden önceliği solution > node > depth > beam > exhausted'dır; bütün uygulanmış sınırlamaların bayrakları ayrıca korunur. Exhaustive, `proven_winnable` için gerekli değildir; exhaustive=true yalnız tamamlanmış no-solution kanıtında kullanılır. Offline API'nin zaman bütçesi yoktur; sahte `time_budget_exhausted` alanı eklenmez.

Runtime `HintResult` wire alanları değişmedi. `truncated=true` mevcut node/time kesilmesini ifade etmeye devam eder. `false`, depth/beam veya ayrı certificate-work sınırlarının uygulanmadığı anlamına gelmez. `heuristic/guaranteed=false/continuation=null` belirsizlik sözleşmesidir.

## H-01: Gerçek kazanma doğrulaması ve güven sınırları

JS `HexMatch.hint` her uygun authored rota için:

1. Hamle dizisinin yoğunluğunu, ikili integer indekslerini ve kalan hamle uzunluğunu denetler.
2. Değerleri kopyalar; gerçek geçmiş prefix'ini ve sıradaki yasal takası kontrol eder.
3. Devamı **mevcut oyun klonunda** gerçek `swap` ile oynatır.
4. Her hamle kabul edilip son durum won ise `proven_route/guaranteed=true` döndürür.

Yasal ilk hamle, kazanma kanıtı değildir. Bozuk/kazandırmayan veri atlanır ve mevcut bounded search çalışır. `search_win` gerçek search çocuğunda won olduğunda korunur. Orijinal değerler, zemin, RNG, puan, turn/history değişmez. Mutable route/level/state için unsafe proof cache yoktur; sonraki istek tekrar mevcut durumdan doğrular.

C# `HintRoutes.Create` mevcut strict import sertifikasyonu ve private kopyalarını korur. `HintSolver.Find` mevcut klon replay'ini koruyarak JS ile aynı bounded candidate okumasını kullanır. Eski bütün route'ları baştan derin kopyalayan `Certified` erişimi yerine yalnız kabul edilmiş adayı kopyalar. Array içindeki null/empty slotlar aynı 64 aday hesabı için private placeholder olarak tutulur; opsiyonel standalone null/empty solution yok sayılır. Bu public wire/schema değişikliği değildir.

### Doğrulama işinin ayrı sınırı

Her hint/Find isteğinde en fazla **64 aday slotu**, toplam **512 tam-rota metadata çifti** kabul edilir. Kalan çift bütçesinden uzun rota kopyalanmadan atlanır; tarama 64 slotta durur. Eşleşmeyen prefix'ler ve bozuk array girişleri de işi sınırlar. En fazla 512 proof swap denemesi yapılabilir; C# ayrıca seçilen continuation'ı kopyaladığından toplam pair-array kopyası 1024'e kadar çıkabilir. Bunlar `searchedNodes` değildir. Native binding'in strict import sertifikasyonu bu Find iş sayımından ayrıdır.

Sınırdan dolayı doğrulanmamış bir rota garanti diye verilmez. Mevcut arama gerçek kazanma bulursa yine `search_win` olabilir; aksi sonuç belirsizdir. Yayımlanmış 600 nonterminal ipucunda en uzun gerçek replay 13 hamledir; 680 çıktı (80 terminal null dahil) eskiyle birebir aynıdır.

### Yayın, katalog ve gelecekteki import

- Mevcut offline `generate-variants.validateCatalog` her sertifikayı `certify`/gerçek motorla kazanma açısından doğrulamaya devam eder. 40 varyant/80 sertifika ve 10 orijinal rota değiştirilmez.
- JS catalog identity/shape sınırı, bütün ithal rotaların kazanma kanıtı olarak sunulmaz. Sahte pack biçimsel kabul edilse bile raw `HexMatch.hint` artık güven sözleşmesini atlayamaz.
- C# strict binding malformed/nonwinning sertifikayı erken reddeder; JS raw hint bunları yok sayıp bounded search'e geçebilir. İki ret sınırı karıştırılmaz; fallback C# `Find(null)` ile ayrıca karşılaştırılır.
- Gelecekteki Level Studio dış import'u **offline gerçek sertifikasyondan geçmeden yayımlayamaz**; metadata içindeki bir "verified" boolean'ı yetki değildir. Yeni import/editor sistemi bu görevde oluşturulmadı. Runtime savunması, yayın kapısının yerine geçmez.

## Değişmeyen otoriteler

Board/RNG/puan/zemin/turn/win-loss motorundur; economy/life/receipts/save/session başka mevcut otoritelerinde kalır. Classic-v4, assisted-v1, snapshot4, veri sürümleri, Attempt ID, R-01 tarihsel replay, R-02 recovery, F-01 ve Animation Pipeline değiştirilmez. Runtime farkı yalnız hint alanıdır; app/worker/HTML/PWA farkları yalnız cache kuşağı **44 → 45**'tir.

Test/harness ve rapor değişiklikleri, yeni `solver-integrity-protected.json` içinde main 11b0161 tabanlı **yedi** açık kaynak hash'iyle sabitlenir. Eski 9.9b ve diğer protection fixture'ları, gameplay/command golden'ları korunur. Yeni observable raporunda yalnız sourceHash güncellenebilir; Lab bütün diğer rapor byte'larını ve özel profil anahtarlarını korur. Nihai ölçüm ve test kayıtları: [SOLVER_BUDGET_AND_HINT_REPORT.md](SOLVER_BUDGET_AND_HINT_REPORT.md).

## Değişen dosyalar

- `.github/workflows/ci.yml`
- `audit-observable.cjs`
- `audit-solvability-9-9.cjs`
- `check-balance-lab-economy-isolation.cjs`
- `check-comic-ui.cjs`
- `check-commands.cjs`
- `check-hint-certificates.cjs`
- `check-hint-integrity-browser.cjs`
- `check-hints-parity.cjs`
- `check-solver-budget.cjs`
- `dist/app.js`
- `dist/engine.js`
- `dist/hint-worker.js`
- `dist/index.html`
- `dist/sw.js`
- `dist/ui-kit.html`
- `docs/ARCHITECTURE.md`
- `docs/SOLVABILITY_AUDIT_9_9.md`
- `docs/SOLVER_BUDGET_AND_HINT_REPORT.md`
- `docs/SOLVER_INTEGRITY_9_9C.md`
- `fixtures/solver-integrity-baseline-9-9.json`
- `fixtures/solver-integrity-protected.json`
- `lib/level-analysis.cjs`
- `package.json`
- `reports/observable-difficulty.json`
- `reports/solvability-9-9.json`
- `reports/solver-integrity-performance-9-9c.json`
- `scripts/measure-solver-integrity.cjs`
- `unity/HintParityHarness/Hexrota.HintParity.csproj`
- `unity/HintParityHarness/Program.cs`
- `unity/Hints/HintSolver.cs`
