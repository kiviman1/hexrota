# Hexrota 9.9c — Bütçe, ipucu ve ölçüm raporu

Sözleşme: [SOLVER_INTEGRITY_9_9C.md](SOLVER_INTEGRITY_9_9C.md). Başlangıç main `11b0161e913904199198ca61f477f47bb11ad390`. Test edilmemiş veya bitmemiş komut başarılı sayılmaz.

## Gerçek önce/sonra karşı örnekler

| Örnek | Önce, değişmemiş main | Sonra |
|---|---|---|
| A-01: L1/v1, audit'in 9 hamlelik prefix'i, width20/node1 | 9 prefix + **4 gerçek arama swap'ı**, null; dört çocuk lost | 9 prefix + **1 gerçek arama swap'ı**, unknown/node_budget_exhausted; null |
| Aynı kalan tek hamlede node4 | Dört kayıp geometrik seçenek vardır | Dördü de sayılır; bütçeye eşit olmak tek başına cutoff değildir; yalnız bu mevcut durum için exhaustive/proven_unwinnable |
| L2/v4: ilk çocuk lost, ikinci won, node2 | Kazanan yol bulunabilir | İkinci çocuk tam sınırda sayılıp solution_found/proven_winnable döner |
| H-01: L1/v1 `[[14,18]]` ve `[[13,16]]` | Katalog biçimsel kabul eder; hint proven_route/true verir; replay sonunda playing | Aynı veri guarantee vermez; node1 arama heuristic/false/null ve truncated=true. Orijinal snapshot aynı |
| H-02: route'suz 40 başlangıç, runtime depth1/beam1 | heuristic/false/null, truncated=false; bu exhaustive değildir | Aynı runtime wire sonucu korunur. Offline depth/beam/node nedenleri artık açık, bağımsız bayraklı ve unknown'dur |

Ek iki-ply fixture: L1/v1 prefix'inin son hamlesini çıkarınca ilk seviyede 10 playing çocuk vardır. Depth1: 10 genişletme/unknown/depth_limit. Width1 ile elde tutulan frontier tükense de 25 genişletme/unknown/beam_pruned. Width20/node105 ile bütün 105 çocuk tamamlandığında yalnız mevcut kalan iki hamlelik normal-takas durumu için exhaustive/proven_unwinnable kanıtı vardır.

Kırmızı baseline'ın tam verisi [solver-integrity-baseline-9-9.json](../fixtures/solver-integrity-baseline-9-9.json) içindedir. Eski audit fixture'ı ve yayımlanmış varyant dosyaları değiştirilmedi.

## Kalıcı test kapsamı

| Dosya | Gerçek kapsam |
|---|---|
| `check-solver-budget.cjs` | **12 grup**, 260 instrument edilmiş arama; 2.823 gerçek çocuk swap'ı (131 lost, 2 won, 2.690 playing), 169 ayrı prefix swap'ı, 28 bozuk seçenek; node0/1, exact-bound kazanma, losing-child bütçesi, depth/beam bilinmezliği, gerçek exhaustive kanıt, source/output kopyaları ve 40 varyantta tekrarlanabilirlik |
| `check-hint-certificates.cjs` | **9 grup**; 80 sertifika/680 durum/600 garanti, 10 legacy bölüm, özgün H-01, 87 malformed veri, 7 mutation, 11 cap örneği; gerçek proof swap sınırı 512 |
| `check-hints-parity.cjs` + gerçek native harness | **1.274 karşılaştırma**: eski 680 durum; 10 orijinal bölüm/20 rota/162 durum; 40 H-02, 14 raw fallback/3 mixed, 22 strict binding ret, 14 direct cap, 20 gerçek assisted restore/hint (color-key/rescue5 dahil), 191 gerçek output mutation ve 100 native input mutation kontrolü |
| Bağımsız native kazanma replay'i | 815 garantili devam gerçekten won; 265 devam oyunu karşılaştırması. Native kaynak dağılımı 759 proven_route, 56 search_win, 319 heuristic, 105 null; retler ayrı karşılaştırmalardır |
| Ample-budget solver karşılaştırması | 40 başlangıç + 80 sertifikalı ilk hamle: **120 eski/yeni rota byte-eşit**, hepsi bağımsız replay ile won |

Bu sayılar farklı tür gözlemlerdir; tek bir toplam hayali test sayısına dönüştürülmez. Runtime `searchedNodes` sadece search work'tür. Authored proof işi ayrıca sayılmıştır.

## Performans: aynı girdilerle Node ölçümü

Yeni [ölçüm script'i](../scripts/measure-solver-integrity.cjs) eski/yeni **gerçek kaynakları** ayrı VM'de çalıştırır; ikinci solver yazmaz. Kaynakları git üzerinden dondurulmuş baseline, aynı 40 off-certificate snapshot ve 40 başlangıç kullanılır. Fixture SHA-256: `27daa973ff819c801212a7fce87cbb3910914bf7bbd5875597fcd815d2a35917`. Tam karşılaştırma: [solver-integrity-performance-9-9c.json](../reports/solver-integrity-performance-9-9c.json).

Ortam: Node **24.22.1**, Linux x64, kernel6.18.57, Xeon Platinum8573C, 5 logical CPU. Ölçümler sırayla, başka ağır worker/browser işi başlamadan alındı. Hint: 1 warmup + durum başına5 zamanlı tekrar; gerçek clone/swap sayaçları. Hint restoration ve bağımsız proof replay zaman penceresinin dışındadır. Solve/analiz:3 tam tekrar. Bellek ölçümü process RSS high-water ve çağrılar arası heap örnekleridir; geçici in-call heap peak'i değildir.

| Ölçüm | Önce | Sonra |
|---|---:|---:|
| Sertifikalı başlangıç hint medyan / p95 | 0,051 / 0,331 ms | **1,011 / 2,763 ms** |
| Aynı grupta max | 3,481 ms | 5,000 ms |
| Route dışı hint medyan / p95 | 27,072 / 54,213 ms | 18,382 / 31,764 ms |
| 40 solve, medyan gerçek çağrı toplamı | 10,028 sn | 9,443 sn |
| 40 politika analizi, medyan çağrı toplamı | 10,880 sn | 9,241 sn |
| Process max RSS | 191.750.144 byte | 192.307.200 byte |
| Çağrılar arası en yüksek heap örneği | 77.118.048 byte | 78.706.856 byte |

Sertifikalı 40 başlangıçta yeni maliyet **40 clone + 278 proof swap** / geçiş; searchedNodes hâlâ0 ve 40 garantinin tamamı kazanır. Bütün 600 nonterminal published hint için 2.665 proof swap, en fazla13/hint ölçüldü. 680 published çıktı birebir aynı.

Route dışı 40 hint geçişinde önce/sonra aynı 5.100 clone/swap/search node vardır. 40 solve geçişinde aynı 50.111 arama genişletmesi, 50.151 toplam swap ve 38 win/2 unknown; üç tekrar rotaları/sayaçları aynıdır. Her politika geçişinde 40×4×2=320 bölüm denemesi, aynı 57.368 clone/60.166 swap ve birebir aynı tam metrikler vardır. Bounded analiz yeni üretim varyantı yazmaz.

Daha kısa ölçülen bazı süreler **algoritmik hızlanma, mobil latency, FPS veya pil iyileşmesi iddiası değildir**. Çalışma/JIT/GC/işletim sistemi koşulları değişebilir; iş miktarı aynı kaldı. Gerçek değişiklik, authored garanti için küçük ama ölçülen doğrulama maliyetidir. Bellek farkı için allocation veya sızıntı nedenselliği iddia edilmez.

### Yeniden üretme

Mevcut script yalnız geliştirme aracıdır. Yeni girdi dosyası hazırlamak için `--prepare-input` gerekir ve mevcut dosyanın üzerine yazmayı reddeder. Örnek ayrı task klasörü:

```sh
baseline_dir=$(mktemp -d /tmp/hexrota99c-reference.XXXXXX)
git archive 11b0161e913904199198ca61f477f47bb11ad390 dist/engine.js dist/levels.js dist/variants.json lib/level-analysis.cjs | tar -x -C "$baseline_dir"
node scripts/measure-solver-integrity.cjs --source-root="$baseline_dir" --input="$baseline_dir/inputs.json" --prepare-input
node scripts/measure-solver-integrity.cjs --source-root="$baseline_dir" --input="$baseline_dir/inputs.json" --output="$baseline_dir/before.json"
node scripts/measure-solver-integrity.cjs --input="$baseline_dir/inputs.json" --output="$baseline_dir/after.json"
```

Aynı source/input SHA'ları ve iş miktarı tekrar üretilebilir; zaman/bellek sayıları için CI eşik assertion'ı yoktur. Baseline kırmızı A-01/H-01 ayrıca eski/yeni gerçek kaynaklarda aynı girdilerle çalıştırılmıştır.

## Worker, fallback ve platform sınırları

Mevcut worker90 ms ve fallback12 ms, **soft search bütçesidir**; snapshot restore veya certificate proof dahil toplam duvar saati garantisi değildir. App600 ms response timeout'ı korunur. Fallback senkron çalışır; worker nihai cleanup'ta terminate edilir. Yeni 64/512 proof sınırı kötü metadata'nın sınırsız replay'ini önler, ama fiziksel telefonda katı latency garantisi vermez. Gelecekteki ithal bölüm, kaynak boyutu/kat/puan kapasitesiyle birlikte offline sertifikasyon kapısından geçmelidir.

Fiziksel iPhone/Android, Unity sahnesi/IL2CPP veya cihaz enerji ölçümü yapılmadı. Otomatik WebKit bu testler yerine sunulmaz. UI input/presentation/save/ekonomi otoriteleri değiştirilmedi.

## Raporların sürüm anlamı

Observable fingerprint artık gerçek bağımlılığı olan `lib/level-analysis.cjs`'yi de kapsar. Observable raporunda yalnız sourceHash değişmesine izin verilir; bütün eski metrikler/rotalar/bot sonuçları sabit kalmalıdır.

Solvability raporu mevcut `classification` compatibility alanını (win veya unknown_within_search_budget) sessizce yeniden etiketlemez. Yeni `solverProbes[i].search` mevcut `solveWithReport` tanısıdır; bağımsız gerçek swap sayımıyla eşitliği ve bütçe üst sınırı assertion ile denetlenir. Yeni termination/classification/flag özetleri eklenir. Eski A-01'in soft-budget davranışı `historicalSoftBudgetReference` içinde commit/hash/prefix/4-versus1 kanıtıyla korunur. Bu ayrım geçmiş insan veya bot kazanma oranlarını değiştirmez.

Raw/mixed testlerde JS bozuk ilk adaydan sonra geçerli adayı seçebilir; C# karşılaştırması bağımsız sertifikalanmış geçerli alt kümeyi bind eder. Bütün bozuk/mixed payload ayrıca strict native Create'a verilerek reddi zorunlu tutulur. Bu, aynı malformed factory girdilerinin iki dilde kabul edildiği iddiası değildir; ortak doğrulanmış devam ve güvenli route-free fallback gerçek derlenmiş Find ile karşılaştırılır.

## Gerçek C# birlikte doğrulama

**10/10 gerçek npm komutu exit0**, .NET SDK **8.0.428**, C# **7.3**, JS fallback yok. UTC 2026-11-17 07:58:21–08:01:15; 138 ilgili kaynak raw önce/sonra aynı hash: `4da1949b8c12919010bdcbc2e78bbce8716af148683949e2bd616f228ac2a982`.

| Komut | Gerçek karşılaştırma |
|---|---|
| unity-rewards | 104 ortak vektör + factory |
| unity-gameplay | 1.916 takas, 80 sertifika; 17 recovery ve 74 yapı girdisi; 258 resume/262 replay/1.050 bozuk kayıt reddi |
| unity-catalog | 2.107 JSON |
| unity-hints | 1.274 JSON; 815 garanti replay'i; cap/legacy/raw/assisted kapsamı yukarıda |
| unity-reward-adapter | 175 rota, 1.456 turn, 2.928 dalga |
| unity-lives | 344 derlenmiş istek, 460 geçiş ve 152 v1 migration |
| unity-session | 1.362 tam JSON + 580 event; 36 gerçek app akışı, 63 native fault/guard |
| unity-economy | 579 karşılaştırma |
| unity-commands | 2.952 karşılaştırma, 16.051 adım; donmuş çıktı hash'i değişmedi |
| unity-rescue | 376 karşılaştırma; 293 eski + 83 receipt saklama |

## Tam JS/browser/CI doğrulaması

Son tam `npm test` **exit0**, 402,126 sn. Bütün eski zincir korunarak level/engine/tutorial/variant/balance, economy/lives/rescue/save, state/F-01/animation, `npm run test:solvability`, board validation ve yeni solver-integrity paketi birlikte tamamlandı. `test:solvability` içindeki gerçek rapor `--check` birebir geçti. Ayrı `npm run audit:dead-board-diagnostics` de **exit0**: R-01 canlı/tarihsel ayrımı ve R-02 sağlık koşulları korunur.

Yeni gerçek worker/browser testi **Chromium10/10 + WebKit10/10 exit0**, iki raporda errors=[]: 320×568,390×844,430×932'de gerçek published/forged worker isteği; gerçek HTTP worker hatası; gerçek yanıtın test içinde bekletildiği açıkça sentetik timeout/stale teslim senaryosu. Dokuz kampanya vakası native touch kullanır; öğretici vakası mevcut H klavye kısayoludur ve touch hint kontrolünün gizli kaldığını doğrular. Sahte motor veya JS karşılığı native başarı diye sunulmaz.

İlk yeni Chromium testindeki ekstra öğretici senaryosu touch #hint'i görünür varsaydığı için başarısız oldu. Gerçek CSS bu kontrolü öğreticide kasıtlı gizler; yalnız yeni test, gizliliği assert edip mevcut H kısayolunu kullanacak şekilde düzeltildi. Uygulama/öğretici değiştirilmedi; tam yeni Chromium ve WebKit koşumları sonra10/10 geçti.

Mevcut yerel session/iki-sekme, integration gerçek offline reload ve Chromium/WebKit state25+25 kontrolleri de exit0 döndü. Eski scene, animation, F-01, Lab, recovery ve rescue tarayıcı paketleri kaldırılmadı; nihai unfiltered ek regresyon/CI sonuçları teslim PR'ının doğrulama bölümünde ve Checks'te tutulur. Bu belge bitmemiş uzak CI'ı başarılı ilan etmez.

`git diff --check`, workflow YAML, PWA ve dar hash kapıları geçti. App/HTML/worker/ui-kit farkı query-only normalize karşılaştırmasıyla, engine'in hint öncesi bütün mekanik gövdesi byte karşılaştırmasıyla doğrulandı. Yayımlanmış level/tutorial/variant/attempt/command/ekonomi/can/rescue/save ve eski gameplay/command/recovery fixture'ları byte olarak aynı. Eski protection fixture'ları silinmedi; sadece yedi incelenmiş kaynak için yeni overlay ve observable sourceHash değişikliği açıkça sabitlendi. Lab'ın diğer bütün rapor byte'ları korunur.

Mevcut **15 job tanımı / matrix sonrası17 iş** ve bütün eski run adımları aynı. Yeni saf suite npm test'e; gerçek hint worker testi ve JSON/screenshot artifact'ı iki mobile işine eklendi. Gerçek C# hint işi ek yeni native vakaları derler. Merge veya Production işlemi yapılmaz.
