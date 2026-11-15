# Hexrota 9.4 — Balance Lab

## Kapsam

Bu çalışma, onaylı [ürün yol haritasının](PRODUCT_ROADMAP_2026.md) P1 ölçüm dilimidir. Bölümler bu PR'da üretim için dengelenmez. Sayısal kaynak [`reports/balance-lab-9-4.json`](../reports/balance-lab-9-4.json); önceki görünür bilgi denetimi [DIFFICULTY_AUDIT.md](DIFFICULTY_AUDIT.md) içindedir. Aşağıdaki karşılaştırmalar bot politikalarını ölçer; insan kazanma oranı veya ticari başarı tahmini değildir.

`classic-v4`, iki öğretici, yayımlanmış 40 varyant/80 kazanma yolu, hedefler, hamleler, üretim RNG'si, can/TEST Altın, mevcut kayıt sürümleri ve C# 9.3 çekirdeği korunur. Deney tanımları yalnız laboratuvara aittir; normal deneme veya kayıtlı varyant yerine geçirilmez. Roadmap yeniden yazılmaz.

## Deney protokolü

Bot kararları mevcut `lib/observable-player.cjs` içindeki dört politikadan gelir; aynı algoritmanın ayrı bir kopyası yoktur. Oyun yürütümü ve metrikler mevcut `audit-observable.cjs.simulate` ile hesaplanır. Her senaryo/politika 64 kez oynanır; politika sırası `random`, `visible_score`, `visible_coverage`, `sampled` olarak sabittir.

| Politika | Karar bilgisi ve yaklaşımı |
| --- | --- |
| Random | Görünen tahtanın yasal takaslarından tohumlu seçim. |
| Visible Score | Görünen ilk eşleşmenin hedefe yararlı puanını önceler; küçük zemin tercihleri içerir. |
| Visible Coverage | Görünen ilk eşleşmede temizlenen katı ve yeni yeşil hücreyi önceler. |
| Sampled Planning | Botun kendi tohumundan dört bağımsız olası taş üretimi örnekler; iki hamlelik değerlendirme yapar. Gerçek gelecek üretimi kullanmaz. |

Ortak karar tohumu, mevcut denetimin formülüyle üretilir:

```text
mix32((0x6d2b79f5
  + imul(policyIndex + 1, 104729)
  + imul(trial + 1, 15485863)
  + imul(turn + 1, 2654435761)) >>> 0)
```

`policyIndex` 0…3, `trial` 0…63'tür. Görünür DTO yalnız koordinatlar, mevcut taş/katlar, izinli palet, hedef türü, puan ve kalan hamleyi içerir. Gerçek RNG, başlangıç tohumu, geçmiş ve sertifikalı yollar karar girdisi değildir. Sertifika doğrulayan tam bilgili motor/arama, bu karar sınırından ayrıdır. Makul sapma/toparlanma deneyinde ilk hamle, modelin tercihinden farklı ama görünen puanı en az %60 ve kat kazancı en fazla bir düşük olan uygun yasal hamleyle değiştirilir; uygun hamle yoksa değiştirilmez. Sonraki kararlar aynı görünür politikayla devam eder. Bu sapma sonradan kaybedildiği için “kanıtlanmış hata” diye adlandırılmaz. `changedOpenings` ile gerçekten değişen alt küme ayrıca raporlanır.

Aynı senaryo tekrarlandığında başlangıç ve üretim tohumu aynıdır; yalnız bot karar tohumları çeşitlenir. Bu nedenle 64 oyun, 64 bağımsız insan değildir. Rota çeşitliliği ayrıca raporlanır. Aynı karar tohumları karşılaştırmayı eşler; farklı taş/kat/hamle girdileri politikanın seçimini değiştirebilir. Görünen kat bilgisi de tercih girdisidir; bir katı azaltınca bot başka bir rotaya sapabilir. Bu yüzden daha az gereksinim veya daha çok hamle, bu sınırlı politikanın ölçülen başarısını matematiksel olarak her zaman artırmaz. Özellikle ek hamle sayısı görünen planlama girdisidir: +2 hamle adayını, sonradan iki ücretsiz hamle eklenmiş aynı hamle dizisi gibi yorumlamayın.

## Tek değişkenli adaylar

Önceden tanımlanan kapsam 40 orijinal ve 43 aday, toplam 83 senaryodur. Dört politika ve 64 tekrar ile **21.248 standart oyun**; üç amaç odaklı politikanın makul alternatif açılışıyla ayrıca **15.936 toparlanma oyunu**, toplam **37.184 tam oyun** hesaplanır. Açılış histogramı için tekrarlanan ilk kararlar ek tam oyun sayılmaz. Burada “orijinal/baseline”, seçili yayımlanmış `variants-v1` varyantıdır; eski kayıtların `legacy-original` tahtasıyla karıştırılmamalıdır. Orijinal 10 bölümün tümü ölçülür; 1, 2 ve 4 kontrol grubu olarak değiştirilmez. Her aday yalnız bir faktörü değiştirir.

| Bölüm | Deney kimliği | Değişen tek faktör | Kapsam |
| --- | --- | --- | --- |
| 3 | `l3-moves-plus-1` | Hamle 9 → 10 | v1–v4 |
| 5 | `l5-moves-plus-1` | Hamle 8 → 9 | v1–v4 |
| 5 | `l5-initial-v1` | Başlangıçta iki taşın yerleşimi; üretim tohumu aynı | Yalnız v1 |
| 5 | `l5-seed-v1` | Üretim tohumu; başlangıç taşları aynı | Yalnız v1 |
| 6 | `l6-moves-plus-2` | Hamle 8 → 10 | v1–v4 |
| 6 | `l6-reduce-double-1` | Bir hücrenin ikinci katını kaldırma; hamle aynı | v1–v4 |
| 7 | `l7-moves-plus-1` | Hamle 8 → 9 | v1–v4 |
| 8 | `l8-moves-plus-2` | Hamle 8 → 10 | v1–v4 |
| 8 | `l8-reduce-double-2` | İki hücrenin ikinci katını kaldırma; hamle aynı | v1–v4 |
| 9 | `l9-moves-plus-2` | Hamle 12 → 14 | v1–v4 |
| 9 | `l9-initial-v4` | Başlangıçta iki taşın yerleşimi; üretim tohumu aynı | Yalnız v4 |
| 10 | `l10-moves-plus-2` | Hamle 14 → 16 | v1–v4 |
| 10 | `l10-relocate-double` | İkinci katın konumu; çift kat sayısı/toplam kat aynı | v1–v4 |

Başlangıç ve tohum aynı adayda birlikte değiştirilmez. Zemin adayına ek hamle eklenmez. Kat azaltma hücreleri, sonuç oranları görülmeden geometriyle seçilir: merkezden uzaklık azalan, komşu sayısı artan, hücre indeksi artan sıra. Bölüm 6'da indeks 1; bölüm 8'de indeksler 25 ve 28 seçilir. Bölüm 10 yerleşiminde ikinci kat indeks 0’dan 21’e taşınır. Önceden tanımlanan dıştan-içe sıradaki ilk iki çift (0→18 ve 0→14) dört varyantın mevcut iki yolunu birlikte korumadığı için seçilmez; bu tahtalar “imkânsız” diye sınıflandırılmaz. Kat yükü azaltılmaz.

Alternatif başlangıç/tohum araması `0x94c0ffee` ile, en fazla 64 aday ve sınırlı tam bilgili aramayla yürür. Arama genişliği 40, düğüm bütçesi 16.000, incelenen ilk hamle sayısı en fazla 8'dir. Otomatik eşleşme içermeyen ve farklı ilk takaslardan başlayan en az iki gerçek kazanma yolu bulunan ilk aday kabul edilir. Görünür bot başarıları aday seçme filtresi değildir. Beşinci bölümün başlangıç adayı indeks 10↔16 takasıyla ilk denemede, yalnız-tohum adayı 3570222040 ile ilk denemede kabul edilmiştir. Dokuzuncu bölüm v4 başlangıcı indeks 32↔35 takasıyla üçüncü adayda kabul edilmiştir; ilk aday kararlı/çok seçenekli başlangıç koşulunu sağlamamış, ikinci aday başlangıcı değiştirmemiştir. Bu, bütün olası başlangıçların veya kat yerleşimlerinin tarandığı anlamına gelmez.

Orijinal 80 yol ve adayların 86 yolu, toplam 166 gerçek kazanma sertifikası doğrulanır. Her senaryonun iki sertifikası farklı ilk takaslarla başlar; bu, 166 bağımsız insan gözlemi değildir. Her oynanabilir adayın yolu gerçek motorda yeniden oynatılır. Değişen zemin nedeniyle daha erken kazanılırsa rota ilk gerçek kazanma anında kesilir; kazanıldıktan sonra hamle ekleyerek sahte sertifika üretilmez. Yayımlanmış bir orijinal yolun değiştirilmiş adayda hâlâ çalışıp çalışmadığı ayrıca `full_route_valid`, erken kazanma öneki için `winning_prefix` veya `not_winning_for_candidate` olarak raporlanır. Son durum adayın imkânsız olduğu anlamına gelmez; adayın kendi iki yeni sertifikası ayrı kanıttır. Sınırlı aramanın yol bulamaması `not_found_within_budget` niteliğindedir; imkânsızlık kanıtı değildir.

## Ölçülen sonuçlar

Tam rapor 83 senaryo ve 37.184 tam oyunu içerir. Kırk orijinalin dört normal ve üç toparlanma metriği, önceki görünür bilgi raporuyla 280 blokta birebir eşleşir. Aşağıdaki oranlar bir ondalık basamağa, ortalama eksikler iki basamağa yuvarlanmıştır; varyant bazındaki bütün alanlar ve tam başarı/kayıp sayıları JSON’dadır. Oranlar dört ondalığa yuvarlanır; farkların son basamağında 0,0001 yüzde puan yuvarlama farkı olabilir. Kesin payda ve başarı/kayıp sayıları asıl kaynaktır.

### Orijinal on bölüm

| Bölüm / tasarım rolü | Hamle / çift kat | Random % | Visible Score % | Visible Coverage % | Sampled Planning % |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 · Çok kolay | 10 / 0 | 5,1 | 89,5 | 95,7 | 98,8 |
| 2 · Kolay | 10 / 0 | 3,5 | 69,1 | 87,5 | 98,8 |
| 3 · Orta | 9 / 2 | 1,2 | 27,7 | 21,1 | 67,6 |
| 4 · Orta-zor | 9 / 3 | 1,6 | 37,5 | 66,4 | 79,7 |
| 5 · Meydan okuma | 8 / 4 | 0,0 | 4,3 | 25,0 | 52,3 |
| 6 · Rahatlama | 8 / 5 | 0,0 | 0,0 | 0,0 | 33,6 |
| 7 · Orta | 8 / 7 | 0,4 | 25,0 | 0,0 | 30,5 |
| 8 · Zor | 8 / 9 | 0,0 | 0,0 | 0,0 | 2,7 |
| 9 · Rahatlama | 12 / 12 | 0,0 | 0,0 | 0,0 | 19,1 |
| 10 · Final | 14 / 16 | 0,0 | 0,0 | 0,0 | 3,5 |

### Her bağımsız adayın aynı kapsamla karşılaştırması

Her hücre **orijinal → aday** bot başarısını gösterir. v1/v4 satırlarının paydası politika başına 64; v1–v4 satırlarının paydası 256 oyundur. Yalnız hedef varyantı değiştiren satırlarda dört varyantlık projeksiyon ayrıca JSON’da tutulur.

| Deney | Kapsam | Random % | Visible Score % | Visible Coverage % | Sampled Planning % | Δ örneklemeli, yüzde puan |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| l3-moves-plus-1 | v1, v2, v3, v4 | 1,2 → 2,0 | 27,7 → 73,0 | 21,1 → 53,9 | 67,6 → 92,2 | 24,6 |
| l5-moves-plus-1 | v1, v2, v3, v4 | 0,0 → 0,4 | 4,3 → 12,1 | 25,0 → 45,7 | 52,3 → 76,6 | 24,2 |
| l5-initial-v1 | v1 | 0,0 → 0,0 | 0,0 → 0,0 | 0,0 → 0,0 | 23,4 → 12,5 | -10,9 |
| l5-seed-v1 | v1 | 0,0 → 0,0 | 0,0 → 0,0 | 0,0 → 0,0 | 23,4 → 46,9 | 23,4 |
| l6-moves-plus-2 | v1, v2, v3, v4 | 0,0 → 0,0 | 0,0 → 14,1 | 0,0 → 15,2 | 33,6 → 78,1 | 44,5 |
| l6-reduce-double-1 | v1, v2, v3, v4 | 0,0 → 0,0 | 0,0 → 0,0 | 0,0 → 17,2 | 33,6 → 43,4 | 9,8 |
| l7-moves-plus-1 | v1, v2, v3, v4 | 0,4 → 0,4 | 25,0 → 37,9 | 0,0 → 7,0 | 30,5 → 58,6 | 28,1 |
| l8-moves-plus-2 | v1, v2, v3, v4 | 0,0 → 0,0 | 0,0 → 0,0 | 0,0 → 0,0 | 2,7 → 23,8 | 21,1 |
| l8-reduce-double-2 | v1, v2, v3, v4 | 0,0 → 0,0 | 0,0 → 0,0 | 0,0 → 0,0 | 2,7 → 7,4 | 4,7 |
| l9-moves-plus-2 | v1, v2, v3, v4 | 0,0 → 0,0 | 0,0 → 0,0 | 0,0 → 5,1 | 19,1 → 45,7 | 26,6 |
| l9-initial-v4 | v4 | 0,0 → 0,0 | 0,0 → 0,0 | 0,0 → 0,0 | 4,7 → 1,6 | -3,1 |
| l10-moves-plus-2 | v1, v2, v3, v4 | 0,0 → 0,0 | 0,0 → 0,0 | 0,0 → 6,3 | 3,5 → 23,4 | 19,9 |
| l10-relocate-double | v1, v2, v3, v4 | 0,0 → 0,0 | 0,0 → 0,0 | 0,0 → 0,0 | 3,5 → 10,9 | 7,4 |

### Hangi hedef eksik kalıyor?

Bu tablo yalnız **Sampled Planning** sonuçlarını ayrıntılandırır; diğer üç politikanın aynı metrikleri JSON’dadır. K/L kazanan/kaybeden sayısıdır. “Sırf son hücre” puan tamamken tam bir yeşil olmayan hücreyle kaybetmektir. Ortalama eksikler bütün oyunları içerir.

| Deney | K/L: orijinal → aday | Ort. eksik puan | Ort. eksik hücre | Ort. kalan kat | Sırf son hücre kaybı | Ort. kullanılan hamle |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| l3-moves-plus-1 | 173/83 → 236/20 | 1,65 → 0,13 | 0,19 → 0,07 | 0,20 → 0,07 | 43 → 16 | 8,48 → 8,81 |
| l5-moves-plus-1 | 134/122 → 196/60 | 0,80 → 0,23 | 0,66 → 0,27 | 0,69 → 0,28 | 69 → 47 | 7,60 → 8,09 |
| l5-initial-v1 | 15/49 → 8/56 | 0,86 → 1,94 | 1,08 → 1,23 | 1,16 → 1,45 | 24 → 31 | 7,80 → 7,95 |
| l5-seed-v1 | 15/49 → 30/34 | 0,86 → 1,97 | 1,08 → 0,56 | 1,16 → 0,58 | 24 → 22 | 7,80 → 7,72 |
| l6-moves-plus-2 | 86/170 → 200/56 | 8,66 → 1,20 | 0,85 → 0,18 | 0,89 → 0,18 | 46 → 35 | 7,94 → 9,04 |
| l6-reduce-double-1 | 86/170 → 111/145 | 8,66 → 7,93 | 0,85 → 0,56 | 0,89 → 0,57 | 46 → 39 | 7,94 → 7,83 |
| l7-moves-plus-1 | 78/178 → 150/106 | 10,27 → 2,82 | 0,96 → 0,51 | 1,02 → 0,54 | 60 → 50 | 7,85 → 8,56 |
| l8-moves-plus-2 | 7/249 → 61/195 | 2,68 → 0,17 | 3,27 → 1,51 | 3,82 → 1,86 | 26 → 88 | 8,00 → 9,86 |
| l8-reduce-double-2 | 7/249 → 19/237 | 2,68 → 3,42 | 3,27 → 2,46 | 3,82 → 2,61 | 26 → 38 | 8,00 → 7,99 |
| l9-moves-plus-2 | 49/207 → 117/139 | 9,29 → 2,62 | 1,73 → 0,82 | 2,08 → 0,99 | 56 → 64 | 11,88 → 13,37 |
| l9-initial-v4 | 3/61 → 1/63 | 25,83 → 9,23 | 2,28 → 2,59 | 2,88 → 3,09 | 5 → 6 | 12,00 → 12,00 |
| l10-moves-plus-2 | 9/247 → 60/196 | 0,49 → <0,01 | 2,44 → 1,31 | 3,09 → 1,65 | 50 → 99 | 13,99 → 15,83 |
| l10-relocate-double | 9/247 → 28/228 | 0,49 → 0,21 | 2,44 → 2,02 | 3,09 → 2,46 | 50 → 65 | 13,99 → 13,96 |

### Makul açılış sapması sonrası toparlanma

Bu oranlar üç ayrı politikanın **bütün toparlanma denemelerini** kapsar; açılışı gerçekten değişen alt kümenin oranı ve sayısı `recovery.models[policy].changedOpeningWinRate/changedOpenings` alanlarındadır. Aynı tohumlarla karşılaştırılır; insan hata toleransı ölçümü veya kazanma garantisi değildir.

| Deney | Visible Score % | Visible Coverage % | Sampled Planning % | Gerçekten değişen örneklemeli açılış sayısı |
| --- | ---: | ---: | ---: | ---: |
| l3-moves-plus-1 | 5,9 → 31,3 | 10,5 → 42,2 | 71,9 → 89,1 | 256 → 256 |
| l5-moves-plus-1 | 0,8 → 35,9 | 26,2 → 40,2 | 48,4 → 73,8 | 217 → 217 |
| l5-initial-v1 | 0,0 → 0,0 | 4,7 → 0,0 | 35,9 → 23,4 | 64 → 64 |
| l5-seed-v1 | 0,0 → 0,0 | 4,7 → 17,2 | 35,9 → 50,0 | 64 → 64 |
| l6-moves-plus-2 | 0,0 → 0,8 | 0,0 → 12,1 | 34,0 → 68,8 | 256 → 256 |
| l6-reduce-double-1 | 0,0 → 0,0 | 0,0 → 0,0 | 34,0 → 36,7 | 256 → 256 |
| l7-moves-plus-1 | 1,6 → 1,6 | 0,0 → 5,9 | 25,8 → 50,4 | 238 → 238 |
| l8-moves-plus-2 | 0,0 → 0,0 | 0,0 → 0,0 | 2,3 → 17,2 | 209 → 209 |
| l8-reduce-double-2 | 0,0 → 0,0 | 0,0 → 0,0 | 2,3 → 6,3 | 209 → 214 |
| l9-moves-plus-2 | 0,0 → 0,0 | 0,0 → 14,1 | 10,5 → 36,3 | 256 → 256 |
| l9-initial-v4 | 0,0 → 0,0 | 0,0 → 0,0 | 4,7 → 3,1 | 64 → 64 |
| l10-moves-plus-2 | 0,0 → 0,0 | 0,0 → 7,4 | 4,7 → 22,7 | 256 → 256 |
| l10-relocate-double | 0,0 → 0,0 | 0,0 → 0,0 | 4,7 → 9,0 | 256 → 256 |

### Varyant adaleti

Aşağıda yalnız örneklemeli modelin orijinal aralığı gösterilir. Aynı bölümün dört varyantı için tablo, 256 denemenin ortalamasının saklayabileceği farkları görünür kılar.

| Bölüm | v1 / v2 / v3 / v4 başarı % | En iyi–kötü farkı, yüzde puan | Yasal ilk takas aralığı | Farklı ilk eşleşme kümesi aralığı |
| --- | --- | ---: | ---: | ---: |
| 1 | 100,0 / 98,4 / 98,4 / 98,4 | 1,6 | 9–22 | 9–20 |
| 2 | 98,4 / 100,0 / 98,4 / 98,4 | 1,6 | 6–16 | 5–13 |
| 3 | 65,6 / 64,1 / 65,6 / 75,0 | 10,9 | 8–15 | 8–12 |
| 4 | 87,5 / 65,6 / 78,1 / 87,5 | 21,9 | 13–18 | 10–14 |
| 5 | 23,4 / 67,2 / 68,8 / 50,0 | 45,3 | 11–17 | 10–14 |
| 6 | 15,6 / 40,6 / 37,5 / 40,6 | 25,0 | 7–13 | 7–12 |
| 7 | 18,8 / 15,6 / 48,4 / 39,1 | 32,8 | 14–25 | 14–21 |
| 8 | 6,3 / 1,6 / 1,6 / 1,6 | 4,7 | 8–15 | 7–13 |
| 9 | 25,0 / 23,4 / 23,4 / 4,7 | 20,3 | 29–39 | 29–38 |
| 10 | 0,0 / 7,8 / 1,6 / 4,7 | 7,8 | 12–31 | 12–26 |

Aday bütün bölümde uygulanmış gibi hesaplanan aralık, yalnız v1/v4 değişen deneylerde diğer üç varyantı **aynen korur**:

| Deney | Dört varyantın örneklemeli aralık genişliği: orijinal → aday | En zor aday varyant(lar) |
| --- | ---: | --- |
| l3-moves-plus-1 | 10,9 → 9,4 | v1 |
| l5-moves-plus-1 | 45,3 → 28,1 | v1 |
| l5-initial-v1 | 45,3 → 56,3 | v1 |
| l5-seed-v1 | 45,3 → 21,9 | v1 |
| l6-moves-plus-2 | 25,0 → 20,3 | v1 |
| l6-reduce-double-1 | 25,0 → 35,9 | v1 |
| l7-moves-plus-1 | 32,8 → 34,4 | v1 |
| l8-moves-plus-2 | 4,7 → 26,6 | v4 |
| l8-reduce-double-2 | 4,7 → 10,9 | v4 |
| l9-moves-plus-2 | 20,3 → 39,1 | v4 |
| l9-initial-v4 | 20,3 → 23,4 | v4 |
| l10-moves-plus-2 | 7,8 → 18,8 | v1 |
| l10-relocate-double | 7,8 → 15,6 | v1 |

## Yedi tasarım sorusunun yanıtı

1. **En büyük kırılma nerede?** Örneklemeli modelde en büyük mutlak düşüş 2→3'tür: %98,8 → %67,6, yani 31,25 yüzde puan. İleri bölümlerde 7→8 de %30,5 → %2,7 ile 27,7 puan düşer; 8, bütün amaç odaklı basit modellerin de %0 olduğu en sert tabandır. 3'e +1 hamle, örneklemeli başarıyı %92,2'ye çıkarır; yalnız bu modelde 2→3 düşüşü 6,6 puana iner. Bu sonuç bütün oyuncu tarzlarında aynı kolaylık eğrisini garanti etmez.
2. **Puan yerine zemin nerede darboğaz?** Orijinal 10'da 247 kaybın 241'i, 8'de 249 kaybın 213'ü, 5'te 122 kaybın 105'i yalnız zemin eksikliğidir. 4'ün 52 kaybının tamamı da yalnız zemindendir. 6 ve 7'de puan ve zemin baskısı birlikte önemlidir; örneklemeli ortalama puan eksikleri sırasıyla 8,66 ve 10,27'dir. 8/10'un puan hedefini azaltmak ana sorunu çözmez. Son bir hücre yüzünden kayıplar 8'de yalnız 26, 10'da 50'dir; bu bölümlerin çoğu kaybı tek hücrelik yakın sonuç değildir.
3. **Aynı bölümde hangi varyantlar ayrışıyor?** 5 v1 %23,4 iken v3 %68,8; fark 45,3 puandır. 7 v2 %15,6 iken v3 %48,4; 6 v1 %15,6 iken v2/v4 %40,6; 9 v4 %4,7 iken v1 %25'tir. 10 v1 bu 64 örneklemeli denemede kazanılmadı ama iki gerçek kazanma yolu vardır; imkânsız değildir. 8'de dört varyantın tamamı çok düşüktür; yalnız bir kötü varyantı değiştirmek yeterli görünmez. +2 hamle sonrası 8'in aralık genişliğinin 4,7'den 26,6 puana çıkması, eski taban etkisinin örttüğü farkları da görünür kılabilir; tek başına yeni bir adaletsizlik mekanizması kanıtı değildir.
4. **Hangi değişiklik farklı stratejilere daha çok alan açıyor?** 3 +1, puan/alan/örneklemeli modelleri %27,7/%21,1/%67,6'dan %73,0/%53,9/%92,2'ye; 5 +1 ise %4,3/%25,0/%52,3'ten %12,1/%45,7/%76,6'ya taşır. 6 +2'de üçü de iyileşir fakat %14,1/%15,2/%78,1 arasında hâlâ büyük tarz farkı vardır. 7 +1 de üç amaç odaklı modelde artış sağlar. Toparlanma tablosu bu artışları makul bir açılış sapmasından sonra ayrıca sınar. Buna karşılık 8 +2'de basit puan ve alan modelleri hâlâ %0'dır; yalnız örneklemeli artışa bakıp herkese hata payı sağlandığı söylenemez. 5 v1'in yalnız tohum adayı da örneklemelide iyileşir ama başlangıç görünümü/ilk karar histogramı aynıdır; “daha anlaşılır açılış” kanıtı değildir.
5. **Hangi bölüm rahatlamayı vermiyor?** Orijinal 5→6, örneklemelide %52,3 → %33,6 ile ters yöndedir. 8→9, %2,7 → %19,1 ile göreli rahatlar ama 9 iki basit amaç odaklı modelde hâlâ %0'dır. 6 +2, değişmemiş 5'e göre güçlü adaydır. Ancak 5 +1 ve 6 +2 birlikte seçilirse örneklemeli oranlar %76,6 → %78,1 olur: yalnız 1,6 puan fark. Alan modelinde aynı sıra %45,7 → %15,2 ile kötüleşir. Bu yüzden bağımsız iyi adayları birlikte yayımlamak, ritmi düzelttiğimiz anlamına gelmez; bu karşılaştırma yalnız bölüm projeksiyonudur, birleşik insan testi değildir.
6. **Hangi adaylar hâlâ çok zor?** 8 +2 ve 10 +2 bile örneklemelide yalnız %23,8 ve %23,4'tür. 8'in iki kat azaltma adayı %7,4; 10'un kat taşıma adayı %10,9'dur. 8 +2 v4 %9,4, 10 +2 v1 %14,1 ile özellikle incelenmelidir. Yeni başlangıçlar bu aramada iyileşme sağlamadı: 5 v1 %23,4 → %12,5; 9 v4 %4,7 → %1,6. Bu negatif sonuçlar saklanmaz veya daha iyi görünen yeni adayla değiştirilmez. 6'nın bir kat azaltması da %43,4 ve zayıf toparlanmayla rahatlama için güçlü bir ikinci tercih değildir.
7. **Hangi aday gereğinden fazla kolaylaşıyor?** İnsan testi olmadan bunu kesin ilan edemeyiz; bütün amaç odaklı stratejilerde birden neredeyse otomatik kazanılan bir aday görülmüyor. En yakından izlenecek aday 3 +1'dir: örneklemeli %92,2, v4 %96,9; buna rağmen alan %53,9 ve rastgele %2'dir. 5 +1 v2'nin %92,2'ye çıkması da v1'in %64,1'iyle birlikte okunmalıdır. Bunlar pilotta ustalaşma/tekrar isteği sorularını gerektirir; “bütün oyuncular için fazla kolay” sonucu değildir.

**Son hücre sayısının tek başına ters okunmaması:** 8 +2'de toplam kayıp 249'dan 195'e, ortalama eksik hücre 3,27'den 1,51'e inerken sırf son hücre kaybı 26'dan 88'e çıkar. 10 +2'de toplam kayıp 247'den 196'ya, eksik hücre 2,44'ten 1,31'e inerken bu sayı 50'den 99'a çıkar. Daha çok kaybeden son hücreye ulaşmıştır; bu sayının artması tek başına adayın kötüleştiğini göstermez. Aynı zamanda kalan darboğazın nerede yoğunlaştığını gösterir.

## En sorunlu beş bölüm ve önerilen sıra

Bu sıra yalnız en düşük ortalamayı sıralamaz: yolda takılma, planlanan rahatlama ve varyant adaleti birlikte değerlendirilir. 7'nin ilk beş dışında olması kolay veya önemsiz olduğu anlamına gelmez; +1 hamlesi sonraki değerlendirmede tutulmalıdır.

| Öncelik | Mevcut sorun | Denenen alternatifler ve ölçülen örneklemeli sonuç | Sonraki karar |
| --- | --- | --- | --- |
| 1 · Bölüm 8 | %2,7; 249 kaybın 213'ü yalnız zemin. Bütün varyantlar zayıf. | +2 hamle %23,8; iki ikinci kat azaltma %7,4. | Önce +2'yi insan pilotunda gözle; iki basit strateji hâlâ %0 olduğundan yayımlama kararı verme. |
| 2 · Bölüm 6 | Rahatlama rolüne rağmen %33,6; puan ve son alan birlikte sıkışıyor. | +2 hamle %78,1; bir ikinci kat azaltma %43,4. | +2 birincil aday; 5'in koşulunu sabit tutarak rahatlama sorusunu test et. |
| 3 · Bölüm 9 | Rahatlama %19,1; v4 %4,7 ile ayrışıyor. | +2 hamle %45,7; v4 başlangıcı %1,6'ya geriliyor. | +2'yi incele; mevcut yeni v4 başlangıcını önerme. +2'de v4 hâlâ %21,9 ve varyant aralığı 39,1 puan. |
| 4 · Bölüm 10 | Final %3,5; kayıpların 241/247'si yalnız zemin. | +2 hamle %23,4; aynı kat sayısıyla 0→21 taşıma %10,9. | Önce +2, ikinci hipotez olarak yalnız kat konumu; ikisi de henüz sağlam insan finali kanıtı değil. |
| 5 · Bölüm 5 | Ortalama %52,3 ama v1–v3 farkı 45,3 puan. | +1 hamle bölümde %76,6; yalnız v1 tohumu %23,4→%46,9; yeni v1 başlangıcı %12,5'e geriliyor. | Geniş hata payı için +1 ile daha dar varyant düzeltmesi için yalnız tohum adayını **ayrı** tut; başlangıç adayını önerme. |

## Bölüm başına eldeki en iyi 1–2 aday

“En iyi”, yalnız bu sınırlı aday kümesindeki karşılaştırmadır; üretime kabul değildir. Birleştirilmiş yamalar denenmedi.

| Bölüm | Birincil aday | Varsa ikinci aday | Dikkat edilmesi gereken |
| --- | --- | --- | --- |
| 3 | `l3-moves-plus-1` | — | Erken kırılmayı azaltıyor; orta bölümün ustalaşma hissi ve %92,2 örneklemeli kolaylık pilotta izlenmeli. |
| 5 | `l5-moves-plus-1` | `l5-seed-v1` | İlki üç stratejide genişler; ikincisi v1 aralığını daraltır ama standart puan/alan modelleri %0 kalır. Birlikte uygulanmış sayılmaz. |
| 6 | `l6-moves-plus-2` | — | Kat azaltma daha zayıf; adayın puan/alan stratejilerinde sınırlı başarısı ve 5 ile birleşik ritmi açık kalır. |
| 7 | `l7-moves-plus-1` | — | %30,5→%58,6, toparlanma %25,8→%50,4; alan modeli yalnız %7 ve varyant farkı hâlâ 34,4 puan. |
| 8 | `l8-moves-plus-2` | — | İki kat azaltma daha zayıf karşılaştırma verisi olarak tutulur; +2 de sert kalır. |
| 9 | `l9-moves-plus-2` | — | v4 için bu yeni başlangıç ikinci tercih değildir; sonraki arama ayrı hipotez ve ayrı doğrulama olmalı. |
| 10 | `l10-moves-plus-2` | `l10-relocate-double` | İkinci aday hamle artırmadan yerleşim hipotezini sınar; başarısı hâlâ düşük, ilkinden bağımsız tutulur. |

1 ve 2'de yeni aday yoktur; %98,8 örneklemeli başlangıç başarısı kontrol olarak korunur. 4'te yeni aday denenmedi; %79,7 başarıya rağmen 44 sırf son hücre kaybı ayrıca gözlenecek UX/erişim riskidir.


## Metrikler nasıl okunmalı?

Başarı/başarısızlık sayısı, ortalama kullanılan hamle, puan eksiği, eksik yeşil hücre, kalan kat, yalnız son bir hücreyle kayıp ve stratejiler arasındaki fark ayrı gösterilir. `lossesWithOneGroundCell` bir eksik hücreyle biten bütün kayıpları sayar; bunların bazılarında puan da eksiktir. Yeni `lossesSolelyLastGroundCell` yalnız puan tamamken tek eksik hücre kaldığı ortak koşulu sayar. “Sırf son hücre yüzünden” değerlendirmesi bu ikinci ölçüye dayanır. Eksik hücre ile kalan kat aynı şey değildir: ikinci katı duran bir hücre tek hücredir ama iki temizleme gerektirebilir. Puan tamamken zemin eksik kalan kayıp, yalnız puanın eksik kaldığı kayıpla birleştirilmez.

Toparlanmadaki `changedOpeningWinRate` yalnız gerçekten değiştirilen açılışların koşullu oranıdır. Adaylar arasında uygun alternatif bulunabilen alt kümeler değişebilir; paydaları görmeden nedensel insan hata maliyeti çıkarılamaz. Ortalama eksikler bütün denemelerin ortalamasıdır; kazananların eksiği sıfırdır. Yalnız kayıplara ait ortalama gibi okunmamalıdır. Ek hamle deneyinde ortalama kullanılan hamlenin artması tek başına daha kötü UX göstermez; daha uzun bütçe ve değişen kazanan/kaybeden bileşimi etkiler. Kazananların kalan hamlesi de yalnız o kazanan alt grubun ölçüsüdür.

Açılış çeşitliliği yasal takas sayısı, farklı ilk eşleşme kümeleri ve botun 64 kararda seçtiği takas dağılımıyla ölçülür. Aynı üçlüyü oluşturan iki takas farklı strateji sayılmayabilir. Çok seçenek bulunması, son hücrelere güvenilir erişim veya insan tarafından anlaşılır seçim bulunduğunu kanıtlamaz.

Yalnız v1/v4 değişen adaylar önce **aynı varyantın** orijinaliyle karşılaştırılır. Bölümün dört varyantlı ortalamasıyla tek adayın oranını karşılaştırmak kapsam hatası olur. Bölüm düzeyindeki olası etki, diğer üç yayımlanmış varyant sabit tutularak ayrıca değerlendirilir. Bu projeksiyon her varyanta eşit 64 deneme ağırlığı verir; gerçek oyuncunun yeniden deneme geçmişine bağlı varyant seçicisinin dağılımını tahmin etmez. Bot varyant farkı bir adalet inceleme sinyalidir; kişilerin şans, beceri veya ödeme geçmişiyle açıklanmaz.

## İzole telefon testi

Sayfa doğrudan `/balance-lab.html` üzerinden açılır; normal ana menüde bağlantısı yoktur. Gizli menü bağlantısı ve `noindex`, kimlik doğrulama yerine geçmez; Preview erişimi mevcut dağıtım korumasına tabidir. Sayfanın güvenlik sınırı, normal oyun kayıtlarından bağımsız çalışmasıdır. Bölüm, varyant ve orijinal/deney seçilir. Örnek bağlantı: `/balance-lab.html?level=5&variant=v1&experiment=l5-initial-v1`. Seçimi değiştirince “Tahtayı aç” kullanılır; yeniden başlatma son açılan senaryoyu aynı taşlar ve RNG ile açar. Bilinmeyen veya yinelenmiş seçim parametreleri sessizce başka tahtaya dönüşmez; güvenli hata gösterilir. Parametresiz adres varsayılan orijinal tahta ile açılır. Kaybın ardından puan/yeşil hücre/kat eksiği birlikte okunabilir.

Laboratuvar durumu bellektedir. Normal profil, can, TEST Altın, kayıtlı deneme ve Attempt ID sayacı okunmaz/değiştirilmez. Sayfa ana oyun oturumunu başlatmaz; can beklemesi ve reklam/mağaza akışı yoktur. Bu nedenle laboratuvar denemesini normal kampanya denemesi veya normal canla yapılan insan testi gibi kaydetmeyin. Sayfayı kapatmak bellek durumunu bitirir; aynı seçim bağlantısı yeniden açılınca başlangıçtan oynanır.

Üretim tahtası/animasyonu değiştirilmez. Laboratuvar da sabit tahta boyutu, iki taşın üst çizim katmanında görünmesi ve azaltılmış hareketi korumalıdır. “Animasyonu geç” düğmesi ve kalıcı alt hedef açıklama şeridi eklenmez. Laboratuvar, mevcut SVG renk/geometri ve kaydırma eşiklerini uyarlayan ayrı, sade bir sunum kullanır; ana oyunun ses/ödül katmanı veya otomatik gözlem kaydedicisi bağlanmaz. Bu yüzden pilotta asıl karşılaştırma aynı laboratuvar sunumundaki orijinal ve aday arasındadır; normal kampanyayla genel “oyun hissi” eşdeğerliği iddia edilmez. Masaüstü Chromium/WebKit emülasyonu fiziksel iPhone Safari testi değildir.

## 8–12 gerçek oyuncuyla ilk pilot

Somut ilk öneri **12 gönüllü, üç grup × dört kişi, kişi başı 30–40 dakika**. Herkes iki öğreticiyi ve ortak bir kısa serbest 3 v1 orijinal tahta örneğini görür; sonra yalnız **iki odak tahtası** oynar. Amaç insan kazanma oranı tahmin etmek değil, anlaşılmayan hedefleri ve adayların belirgin başarısızlık biçimlerini yakalamaktır. Sekiz veya on kişiyle yapılırsa gruplar daha da küçük kalır; aynı anda bütün adaylar hakkında sonuç çıkarılmaz.

| Grup | Dört kişiye verilen iki odak tahta | Koşul kontrolü |
| --- | --- | --- |
| A · Rahatlama 5→6 | Herkese aynı **5 v1 orijinal**, sonra **6 v1 orijinal veya +2 hamle** | İki kişi 6 orijinal, iki kişi 6 +2. Öndeki 5 koşulu değişmez. |
| B · Rahatlama 8→9 | Herkese aynı **8 v2 orijinal**, sonra **9 v4 orijinal veya +2 hamle** | İki kişi 9 orijinal, iki kişi 9 +2. Öndeki 8 koşulu değişmez. |
| C · Sert zirveler | **8 v2** ile **10 v1**, her biri orijinal veya +2 hamle | Koşul ve sıra dört programla dengelenir; bu grup rahatlama etkisini ölçmez. |

C için dört program: (1) 8 orijinal → 10 aday; (2) 10 aday → 8 orijinal; (3) 8 aday → 10 orijinal; (4) 10 orijinal → 8 aday. Böylece her koşul iki kişide görülür ve her bölüm iki kez önce gelir. Hiçbir kişi aynı varyantın hem orijinalini hem adayını görmez. A/B'de sıra bilerek sabittir; rahatlama sorusunun öncesindeki bölüm adaylaştırılmaz. Katılımcılar koşullara önceden ve dengeli atanır; sonuç gördükten sonra yeniden gruplanmaz.

Seçilen varyantlar 6 v1 ve 9 v4 gibi zayıf uçları da içerir; bu amaçlı seçim bütün varyantların ortalamasını temsil etmez. İlk pilotta **5'in adayları, 7 +1 veya bütün 13 deney insanlarda denenmiş sayılmaz**. Bunlar kısa takip oturumuna bırakılır. 5 v1 ve 8 v2'deki sabit önceki tahta çok zor kalırsa oyuncu devam etmeye zorlanmaz; kayıp/yarım kalma ve önceki sonuç kaydedilir. Bu, kilitsiz laboratuvarda yönlendirilmiş geçiştir; gerçek kampanyanın 5'ten 6'ya ilerleme oranı ölçülmez.

Uygulama:

1. Açık rıza alın. Ad, e-posta, cihaz kimliği veya hesap bilgisi gerekmez; yerel gözlem formunda yalnız oturum sırası P01…P12 kullanılabilir. Dosyayı paylaşmak ayrıca tercihtir; otomatik sunucu aktarımı yoktur. Öğreticileri yeni ve ayrı bir test tarayıcı profilinde açın; mevcut oyuncu profilini sıfırlamayın.
2. İlk 15 saniyede geçerli takas denemesini gözleyin; görevli çözüm söylemesin. Öğreticide parlayan çiftle yapılan takas **yönlendirilmiştir**. Ortak serbest laboratuvar tahtasındaki ilk geçerli takasa süre ayrıca kaydedilsin; “bağımsız hamle” yalnız bu gözleme denilsin.
3. Oyuncuya “Bu bölüm ne zaman biter?”, “Sayılar puanı nasıl etkiliyor?”, “İki katlı hücre nasıl tamamlanır?” sorularını kendi sözleriyle yanıtlatın. Yanlış anlamayı “kuralı biliyorum ama hamle yetmedi” durumundan ayırın; görevli doğru cevabı önceden söylemesin.
4. Odak tahtası başına en fazla iki **gönüllü** deneme veya dört dakika ayırın. “Tekrar denemek ister misin?” diye sorun; zorunlu yeniden deneme yaptırmayın. Aynı başlangıçta tekrar öğrenmesi ayrıca görülebilir. Yardım verilirse zamanı ve içeriği ayrı işaretlensin.
5. Elle tutulan yerel formda grup/koşul/varyant/deney, tamamlandı/kaybetti/yarım kaldı, deneme sayısı, eksik puan/hücre/kat, son zor hücre, kabaca aktif süre, yardım ve tekrar isteğini kaydedin. Sohbet, arka plan ve mola sürelerini çıkarın. Laboratuvarda otomatik süre/JSON dışa aktarımı varmış gibi sunmayın; mevcut ana oyun gözlem dosyasıyla bu elle tutulan koşulları karıştırmayın.
6. A/B'de “Bir önceki bölümden sonra bu nasıl hissettirdi?”; herkese “Nerede ne yapacağını anlayamadın?” gibi açık sorular sorun. “Bu daha adil oldu mu?” diyerek beklenen cevabı söylemeyin. Özellikle puan tamamken kalan zemin ve çift kat farkını açıklayabiliyor mu gözleyin.

Grup/koşul başına yalnız iki kişi vardır; bunlardan istatistiksel etki, kesin yüzde veya bütün 40 varyanta genelleme çıkarılmaz. Yarım kalanlar otomatik kayıp, tekrarlar bağımsız kişi, cansız laboratuvar denemesi normal kampanya denemesi değildir. İlk pilot, sonraki daha büyük ölçümün ve ayrı sürümlü dengeleme kararının hipotezlerini daraltır.

## Tekrarlama ve doğrulama

```sh
npm run balance:lab                         # Tam raporu yeniden üretir; yalnız lab raporunu yazar.
npm run balance:lab -- --check --quiet      # Bütün oyunları tekrar hesaplayıp dosyayla birebir karşılaştırır.
npm run test:balance-lab                    # Veri, sertifika, bilgi sınırı, izolasyon ve hatalı seçim kontrolleri.
npm run test:balance-lab-browser            # Seçilen gerçek tarayıcıyla izole ekran kontrolleri.
```

Tarayıcı seçimi Chromium ve WebKit için ayrı yapılır; mevcut mobil giriş/takas, can/kayıt, PWA, C# karşılaştırmaları ve zorluk kontrolleri de korunur. Komutun bulunması, çalıştırıldığı veya fiziksel cihazın doğrulandığı anlamına gelmez; nihai CI/Preview sonuçları PR kontrollerinde ayrıca gösterilir. Fiziksel iPhone Safari ve Android testi bu laboratuvar raporunun otomatik testleriyle yapılmış sayılmaz.

## Üretime geçiş kapısı

Bu adaylar `analysis_only` veridir; Vercel Preview'da oynanabilmeleri üretime kabul edildikleri anlamına gelmez. Bir gün başlangıç/tohum değişikliği yayımlanacaksa eski varyant paketi korunup yeni varyant sürümü gerekir. Mevcut Level ID altında **hamle, hedef, zemin/çift kat veya koordinat** değişecekse ayrıca **yeni sürümlü taban bölüm arşivi** kurulmalıdır. Yalnız varyant numarasını değiştirmek eski tabanı korumaz.

Eski 9.3 denemesi kendi tabanı, varyantı, RNG'si, gerçek geçmişi ve can hakkıyla devam etmelidir. Yeni arşiv/çözümleme ve JS–C# kayıt devamı testleri olmadan bu adayları `dist/levels.js` veya mevcut `dist/variants.json` üzerine yazmak kabul edilmez. İnsan pilotu ve ayrı veri sürümü onayı sonraki karar kapısıdır.
