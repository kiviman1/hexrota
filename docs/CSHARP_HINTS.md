# C# Hint Solver — 9.3

## Uygulanan sınır

`unity/Hints/HintSolver.cs`, mevcut `dist/engine.js` içindeki `HexMatch.hint()` seçim ve arama davranışını saf C# 7.3 ile uygular. JavaScript web motoru ve var olan C# Gameplay/Rewards dosyaları değiştirilmez. JSON, süreç, dosya ve derleme işleri yalnız `unity/HintParityHarness/` içindedir; çekirdek UnityEngine, tarayıcı, UI veya cihaz saatine bağımlı değildir.

| API | İşlev |
| --- | --- |
| `HintSolver.Find(HexMatch, HintRoutes, HintOptions, IHintClock)` | Mevcut durumu değiştirmeden ipucu döndürür; oynanmayan veya hamlesiz durumda `null`. |
| `HintResult` | JS alan adlarıyla `pair`, `source`, `guaranteed`, `continuation`, `searchedNodes`, `depth`, `truncated`. |
| `HintOptions` | Normalize edilmiş nullable sayısal `maxNodes`, `maxMs`, `maxDepth`, `beamWidth`. |
| `IHintClock.NowMilliseconds` | Host tarafından sağlanan monoton zaman politikası. Çekirdek doğrudan sistem saatini okumaz. |
| `HintRoutes.Create(level, solutions, solution, alternativeSolutions)` | Yazar rotalarını sırayı koruyarak kopyalar; her dolu rotayı gerçek motorla kazanma sonucuna kadar doğrular. |

Mevcut `LevelConfig` içine yeni çözüm veya UI alanı eklenmez. Katalog, çözümlenmiş oyun konfigürasyonuna ait rota verilerini ayrıca `HintRoutes` olarak bağlar; sonuç önceden hazırlanıp önbelleğe alınabilir. Rotaların içerideki kopyaları dışarı verilmez; dönen ipucu ve devam yolunu değiştirmek katalog yolunu veya oyunu değiştirmez.

## Seçim ve garanti

1. Oynanabilir durumun yasal takasları mevcut topoloji sırasıyla alınır.
2. Mevcut geçmişe uyan, farklı bağımsız başlangıçları da içeren sertifikalı rotalar sırayla değerlendirilir. Geçmişte ters sırayla verilmiş aynı komşu çifti eşdeğer sayılır.
3. Seçilecek devam, mevcut oyunun klonunda yeniden oynatılıp gerçekten kazanırsa `proven_route`, `guaranteed: true` döner.
4. Uygun rota yoksa aynı aday sırası, rank aritmetiği, ziyaret anahtarı ve kararlı eşitlik sırası ile sınırlı beam araması yürür. Kaybedilmiş durumlar genişletilmez.
5. Bulunan yol gerçek motor klonunda tekrar doğrulanır; `search_win` garantilidir. Diğer öneri `heuristic`, `guaranteed: false`, `continuation: null` olur.

İpucu araması taş, zemin, puan, hamle, RNG ve geçmişi değiştirmez. Önerilen hamlenin daha sonra uygulanması ayrı bir oyun işlemidir.

### Kaynak JS'nin rota güveni varsayımı

Mevcut JS `hint()` fonksiyonu yazar rotalarının zaten sertifikalı olduğunu varsayar; geçmiş öneki ve sıradaki yasal hamleyi kontrol ettikten sonra kalan yolun tümünü yeniden oynatmaz. C# bağlama katmanına yanlış veya kazanmayla bitmeyen rota verildiğinde bu varsayıma dayanılmaz: `HintRoutes.Create` bunu `ArgumentException` ile reddeder. `Find`, mevcut klon üzerinde her garantiyi ayrıca doğrular.

Yayımlanmış seksen güvenilir rotada doğrudan JS/C# sonuçları aynıdır. Altı yanlış/bozuk rota testi **yeni C# güven sınırının reddetmesidir**; JS `hint()` bunları reddediyormuş gibi raporlanmaz. Bu testlerde bağımsız JS motoruyla tam rota tekrarının geçersiz/kazanmasız olduğu doğrulanır. JS algoritması test uğruna değiştirilmemiştir.

## Düğüm bütçesi ve platform süresi

Pozitif tamsayı `maxNodes` verildiğinde kesilme yalnız düğüm sayısıyla belirlenir; C# çekirdeği saat okumaz. Tavan 100.000 düğüm, en fazla üç arama derinliği ve 32 beam genişliğidir. JS'nin derinlikte kesirli sayı davranışı, genişlikte floor ve normalizasyon sınırları korunur. Rank eşitliklerinde adayın önceki sırası korunur.

Düğüm bütçesi verilmediğinde varsayılan sınır 5.000 düğümdür; saat verilmişse ayrıca 1–150 ms aralığına sıkıştırılan zaman bütçesi uygulanır. Saat verilmemesi deterministik düğüm/derinlik politikasını seçer; bunu mobil cihazda gerçek 90 ms performans garantisi saymak doğru değildir. Unity host'u platform zaman politikasını `IHintClock` ile sağlayabilir. UTC yenilenme saati ile ipucu monoton saati aynı iş değildir.

JS ile C# çalışma hızları farklıdır. Gerçek duvar saatiyle kesilen iki aramanın aynı düğümde durduğu iddia edilmez. Deterministik karşılaştırmalar açık düğüm bütçesiyle; süre politikası ise dışarıdan verilen aynı sahte monoton saat dizisiyle ayrıca sınanır. JSON test adaptörü ham JS seçeneklerinin sayısal normalizasyonunu uygular; üretim API'si sayısal `HintOptions` alır.

## Gerçek karşılaştırma

```sh
npm run test:unity-hints
```

Komut gerçek .NET 8 SDK ister, C# 7.3 olarak derler ve derlenen DLL'in bütün ipucu JSON'unu JS ile karşılaştırır. SDK bulunamaz veya derleme çalışmazsa kontrol başarısız olur; JS sonuçlarını C# yerine kullanan geri dönüş yoktur. Derleme ürünleri geçici klasöre çıkarılır ve temizlenir.

Yerel karşılaştırma kapsamı:

- 40 varyantın iki bağımsız kazanma rotasının tüm önek/terminal durumları: 80 rota, 680 durum.
- Rota verilmeden ve sertifikalı rotadan sapıldıktan sonra 280 sınırlı arama durumu.
- T1/T2 ve oynanabilir olup yasal takası bulunmayan küçük tahta.
- Üç kaynak sınıfı, garanti, devam yolu, düğüm/depth/truncated alanları ve bütün oyun snapshot'ı.
- 11 ayrı enjekte edilmiş saat/normalizasyon politikası.
- İpucu alıp gerçekten hamleyi uygulayan 200 devam senaryosu.
- 80 sonuç mutasyonu ve 80 girdi rota mutasyonu kontrolü.
- 13 eksik/bozuk/replay ile uyuşmayan snapshot reddi.
- Altı yanlış veya kazanmayla bitmeyen yazar rotası reddi; bağımsız tam replay oracle'ı.

Komut kesin toplamı ve kaynak dağılımını çalıştırma sonunda yazar; uzak CI sonucu ayrıca değerlendirilmelidir. Her garanti bağımsız olarak kazanma sonucuna kadar yeniden oynatılır. C# çekirdeği .NET 8.0.428 ile yerelde derlenmiştir; gerçek Unity/IL2CPP veya fiziksel iOS/Android performansı bu testin kapsamı değildir.

## Bağımlılıklar

Bu PR güncel `main` üzerindeki mevcut `unity/Gameplay/` ve `unity/Rewards/` dosyalarıyla bağımsız derlenir. C# katalog/can/uygulama PR'ları bu modülün tamamlanması için birleştirilmek zorunda değildir. Sonraki uygulama katmanı katalogdan konfigürasyon + rota bağını, saat politikasını ve gösterilecek ipucu metnini sağlar. Görsel, ses, titreşim veya analiz olayları saf çözücünün parçası değildir.
