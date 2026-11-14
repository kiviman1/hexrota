# Görünür bilgiyle zorluk denetimi — 9.2 hazırlığı

## Kapsam ve korunmuş davranış

Bu çalışma bir **analiz PR'ıdır**. `dist/engine.js`, yayımlanmış bölüm/öğretici verileri, 40 varyant, 80 bağımsız kazanma başlangıcı, hedefler, hamle bütçeleri, can kuralları ve mevcut kayıt sözleşmeleri değiştirilmez. Yeni bot tarayıcıya yüklenmez; çevrimdışı geliştirme aracıdır. Aşağıdaki değişiklik önerileri uygulanmış dengeleme değildir.

Sayısal kaynak [`../reports/observable-difficulty.json`](../reports/observable-difficulty.json), önceki tam bilgili karşılaştırma [`../balance-report.json`](../balance-report.json) dosyasıdır. Kaynak parmak izi motoru, ana bölümleri, varyantları, yeni karar kodunu ve rapor üreticisini kapsar. İnsan kazanma oranı veya ticari dengelemenin tamamlandığı iddiası yoktur.

## İki ayrı bilgi sınırı

**Tam bilgili doğrulama:** Mevcut `lib/level-analysis.cjs` gerçek motor durumunu kullanabilir. Her varyantın iki farklı ilk takasla başlayan yayımlanmış yolu tekrar oynatılır; 40 varyantın 80 yolu geçerlidir. Bu varlık kanıtıdır: belirli bir başlangıçtan kazanılabilir. Tipik oyuncunun bu yolu bulacağını göstermez. Eski greedy/coverage/planning modelleri klonlarda gerçek üretim RNG'sini kullanır; gelecek taşları ve doğal zincirleri önceden görebilirler.

**Görünür bilgiyle karar:** `lib/observable-player.cjs` yalnızca şu DTO'yu kabul eder: sıralı `{q,r}` hücreleri, mevcut taş değerleri, kalan zemin katları, izinli sayı paleti, hedef/karşılaştırma türü, puan ve kalan hamle. Mevcut RNG, başlangıç tohumu/dizilimi, hamle geçmişi ve çözüm yolları DTO'da bulunmaz. Paletin oyuncuya açık oyun kuralı olduğu varsayılır; görünmeyen üretim dağılımı gerçek tohumdan çıkarılmaz.

Politika gerçek `HexMatch` örneğini, `clone()` veya `snapshot()` yeteneğini almaz. Seçim tamamlandıktan sonra test yürütücüsü gerçek motorla takası çözer. Örneklemeli politika aynı kuralları bilen ayrı bir model kullanır; modelin başlangıcı yalnızca mevcut görünür tahta, üretimi yalnızca botun bağımsız karar tohumu ile kurulur. Gerçek gelecek taşlar örneklemlere kopyalanmaz.

`check-observable.cjs` 40 varyantın başlangıç ve ilk sertifikalı hamle sonrası 80 durumunda, iki karar tohumu ve dört politikayı sınar. Gerçek gizli RNG üç farklı değere, gizli başlangıç/çözüm verileri ilgisiz değerlere çevrildiğinde **1.920 karar karşılaştırması aynı sonucu vermelidir**. Özel alanları okumak hata veren getter'larla ayrıca engellenir. Aynı testler yasal hamle, değişmeyen DTO ve değişik tahtalara tepkiyi de denetler; sabit tek hamle döndüren sahte bir politika bu kontrolü geçmez.

## Modeller ve deney protokolü

| Model | Karar girdisi ve davranışı | Sınır |
| --- | --- | --- |
| `random` | Görünür tahtadan hesaplanan yasal takaslardan tohumlu seçim. | Yasal olmayan dokunma veya insanın görsel aramasını modellemez. |
| `visible_score` | Sadece görünen ilk eşleşmenin hedefe yararlı puanı; küçük zemin tercihleri. | Henüz oluşmamış zincirleri bilmez. |
| `visible_coverage` | Görünen ilk eşleşmede azalan katlar, yeni yeşil hücreler, ardından puan. | Tek hamlelik alan iştahı sonraki erişimi bozabilir. |
| `sampled` | Dört bağımsız karşı-olgusal üretim, iki hamlelik değerlendirme; ikinci hamle görünür alan sezgisiyle seçilir. | Kısa, örneklem gürültülü yaklaşık planlama; insan modeli veya kazanma garantisi değildir. |

Her politika/varyant için 64 tekrar: 4 × 40 × 64 = **10.240 standart oyun**. Üç amaç odaklı model için ayrıca 40 × 3 × 64 = **7.680 alternatif açılış oyunu**. Dört varyant birlikte bölüm/politika başına 256 gözlemdir. Aynı varyantın gerçek oyun tohumu sabittir; yalnızca bot kararları çeşitlenir. Bunlar bağımsız insan örneklemleri değildir; güven aralığı veya kesin nüfus oranı hesaplanmaz. Her varyanttaki `uniqueTrajectories` tekrarların rota çeşitliliğini gösterir.

Alternatif açılış testi, modelin tercihinden farklı ama ilk dalgada en fazla bir kat daha az kazandıran ve görünen puanı en az %60 olan başka bir yasal takası seçer. Böyle bir hamle yoksa oyun değiştirilmeden ilerler. `changedOpenings` ve `changedOpeningWinRate` yalnızca gerçekten değişen açılışları ayrıca sayar. Bu hamleler makul sapmalardır; daha sonra kaybedildiği için geriye dönük olarak kanıtlanmış hata diye adlandırılmaz. Standart ve alternatif deneylerin oran farkı nedensel insan hata maliyeti değildir.

4, 5, 8, 9 ve 10. bölümlerde varyant başına alan açısından iyi görünen ilk üç açılış ek tam bilgili aramayla incelenir. Yayımlanmış sertifika varsa kullanılır; yoksa genişlik 20, en çok 6.000 düğüm bütçeli arama yapılır. `not_found_within_budget` **çözümsüzlük kanıtı değildir**. Bulunan rotalar `recoveryCertificate` olarak raporlanır.

## İlk on bölümün yeni ölçümü

| Bölüm | Planlanan rol | Hamle / çift kat | Rastgele % | Görünen puan % | Görünen alan % | Örneklemeli % | Ölçüm yorumu |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Çok kolay | 10 / 0 | 5,1 | 89,5 | 95,7 | 98,8 | Başlangıç rolü destekleniyor |
| 2 | Kolay | 10 / 0 | 3,5 | 69,1 | 87,5 | 98,8 | Başlangıç rolü destekleniyor |
| 3 | Orta | 9 / 2 | 1,2 | 27,7 | 21,1 | 67,6 | İlk belirgin artış |
| 4 | Orta-zor | 9 / 3 | 1,6 | 37,5 | 66,4 | 79,7 | 3'ten kolay görünüyor |
| 5 | Meydan okuma | 8 / 4 | 0,0 | 4,3 | 25,0 | 52,3 | Yüksek varyant farkı |
| 6 | Rahatlama | 8 / 5 | 0,0 | 0,0 | 0,0 | 33,6 | Rahatlama doğrulanmıyor |
| 7 | Orta | 8 / 7 | 0,4 | 25,0 | 0,0 | 30,5 | 8 hamlede iki hedef baskısı |
| 8 | Zor | 8 / 9 | 0,0 | 0,0 | 0,0 | 2,7 | Çok keskin zirve |
| 9 | Rahatlama | 12 / 12 | 0,0 | 0,0 | 0,0 | 19,1 | 8'den rahat, genel olarak zor |
| 10 | Final | 14 / 16 | 0,0 | 0,0 | 0,0 | 3,5 | Çok keskin final |

Buradaki oranlar yeni politikaların simülasyon sonuçlarıdır; eski tam bilgili politikalarla bir algoritma kıyaslaması veya insan başarısı tahmini sayılmaz. Örneğin eski ve yeni puan politikaları yalnızca bilgi miktarında değil, değerlendirme ağırlıklarında da farklıdır. Yeni örneklemeli planlayıcının başarısı, eski gerçek gelecek bilgili planlayıcının %100 sonuçlarını oyuncuya aitmiş gibi yorumlama riskini görünür kılar.

## Darboğazlar, varyant farkları ve toparlanma

**Ritim:** 1/2 başarı hissini destekler. 3→4 örneklemeli başarı %67,6'dan %79,7'ye yükselir; planlanan ilk tırmanış bu modelde ters yöndedir. 5→6 %52,3'ten %33,6'ya düşer: rahatlama yerine güçleşme vardır. 8→9 %2,7'den %19,1'e yükselir; göreli rahatlama vardır ama 9'un iki basit amaç odaklı modeldeki başarısı %0'dır. Bu bulgular eski tam bilgili zorluk kapılarının insan benzeri kararlarla aynı ritmi garanti etmediğini gösterir.

**4:** Görünür alan %66,4 iken puan %37,5; eski tam bilgili ölçümde sıralama tersineydi (%3,9 alan / %69,1 greedy). Eski ve yeni ağırlıklar da farklı olduğu için fark yalnızca bilgi sızıntısına atfedilemez. Örneklemeli 52 kaybın tamamında puan tamam, zemin eksiktir; 44 kayıp yalnızca tek yeşil olmayan hücreyle biter. 13–18 başlangıç takası ve 10–14 farklı ilk eşleşme kümesi vardır. Son hücre erişimi nitel testte izlenmelidir.

**5:** Örneklemeli 122 kaybın 105'i yalnız zemin, 2'si yalnız puan, 15'i iki hedef eksikliğidir; 83 kayıp son hücrede kalır. Varyant `v1` %23,4, `v3` %68,8 başarı verir: **45,3 yüzde puanlık** açıklık aynı bölümde benzer zorluk hedefi için güçlü inceleme sinyalidir. Eski kabul kapısı yalnız tam bilgili modellerle sağlanmıştı. Makul alternatif açılış yapılan 217 oyunun 96'sı kazanılır (%44,2); standart %52,3 ile doğrudan insan hata cezası çıkarılamaz.

**6:** Eski tam bilgili alan %86,3 iken yeni ilk dalga alan modeli %0; örneklemeli model %33,6. Sekiz hamlede 23 hücre + 5 ikinci kat ve 160 puan gerekir. Örneklemeli ortalama eksik puan 8,7, eksik hücre 0,85; 170 kaybın 90'ı son hücrede kalır. Sadece puan hedefini azaltmak bütün sorunu çözmez. Rahatlama tasarımı ilk önceliklerden biridir; görünür güçlü açılışlar ve hata payı ayrıca üretim ölçütü olmalıdır.

**7:** Örneklemeli %30,5; varyant aralığı %15,6–48,4. 8 hamlede 29 hücre + 7 ikinci kat ve 215 puan birlikte gerekir. 178 kaybın 109'u tek eksik hücreyle biter; basit alan modeli puanı da kaçırır. Bu bölüm, 8'den önce beklenenden erken yıpratma riski taşır.

**8:** Eski tam bilgili planlama %100, yeni örneklemeli %2,7. Dört varyant da %1,6–6,3 aralığında düşük başarı verir; sorun yalnız tek kötü varyant değildir. 249 kaybın 213'ünde puan yeterli ama zemin eksiktir; ortalama 3,27 hücre eksik kalır. Yalnız son hücreyi kolaylaştırmak yerine 8 hamle/29 hücre/9 çift kat yükü ve erişim yapısı birlikte incelenmelidir. İyi görünen 12 ilk hamleden 10'u için kazanma sertifikası bulundu; kalan iki arama bütçede sonuç vermedi, çözümsüz sayılmadı.

**9:** Eski gerçek gelecek bilgili alan modeli %100, görünür alan modeli %0, örneklemeli %19,1. 29–39 yasal açılış ve 29–38 farklı ilk eşleşme kümesi vardır; seçenek sayısı tek başına toparlanma sağlamaz. Örneklemeli ortalama eksik hücre 1,73, puan 9,3, kısmen temizlenmiş çift hücre 1,16. Makul alternatif açılışta başarı %10,5'e iner; özellikle `v4` standart %4,7 ile diğer varyantların %23,4–25'inden ayrılır. Başlangıcın daha dar sayı çeşitliliği, üretimin beş sayıya açılacağını bilmeyi gerektirebilir; bu geçişin anlaşılabilirliği gözlenmelidir.

**10:** Eski tam bilgili planlama %96,5, örneklemeli %3,5. 247 kaybın 241'inde yalnız zemin, 6'sında iki hedef eksiktir; yalnız puanı kaçıran yoktur. Ortalama eksik puan yalnız 0,49 iken 2,44 hücre ve 1,36 kısmi çift hücre kalır. Puan hedefini düşürmek ana darboğaza dokunmaz. `v1` bu modelde 64 denemede kazanılmadı; iki yayımlanmış kazanma rotası hâlâ geçerlidir, dolayısıyla “imkânsız” değildir.

Odak beş bölümün 60 güçlü görünen açılış kontrolünden 19'u yayımlanmış, 39'u yeni sınırlı aramayla bulunan sertifikaya sahiptir. 58/60 açılışın kazanılabilir bulunması, sonraki kararların kolay olduğu anlamına gelmez. Sonraki safhalarda çözümsüzlük oranı ölçülmemiştir; bir yol bulunmamasını gizli bir kaybettirme mekanizması diye yorumlamak doğru olmaz.

| Bölüm | Örneklemeli varyant aralığı % | En iyi–kötü farkı | Gerçekten değişen açılışlar / kazanma % |
| --- | ---: | ---: | ---: |
| 4 | 65,6–87,5 | 21,9 yüzde puan | 234 / 71,8 |
| 5 | 23,4–68,8 | 45,3 yüzde puan | 217 / 44,2 |
| 6 | 15,6–40,6 | 25,0 yüzde puan | 256 / 34,0 |
| 7 | 15,6–48,4 | 32,8 yüzde puan | 238 / 25,6 |
| 8 | 1,6–6,3 | 4,7 yüzde puan | 209 / 2,4 |
| 9 | 4,7–25,0 | 20,3 yüzde puan | 256 / 10,5 |
| 10 | 0,0–7,8 | 7,8 yüzde puan | 256 / 4,7 |

**Yapısal yük:** 8'de 29 hücre + 9 ikinci kat = 38 yararlı zemin vuruşu, 8 hamlede ortalama en az **4,75 kat/hamle** gerektirir. Önceden yeşil olmuş hücreye eşleşmek bu sayıya katkı yapmaz. 6'da yük 28/8 = 3,50; 5'te 27/8 = 3,38'dir ve 6'nın puan hedefi de 125'ten 160'a yükselir. Bu durumda rahatlama için dizilim ve kat konumlarının sunduğu erişim avantajı gerekir; bu avantaj görünür modellerde güvenilir çıkmamıştır. 9'da 49/12 = 4,08 olduğundan 8'e göre alan vardır ama yalnız tek üçlüler yetmez. Bunlar gerekli verim alt sınırlarıdır; kazanma olasılığı veya kesin yeterlilik hesabı değildir. Gerçek zincir dalgaları raporda sayılır; zaten yeşil hücrelerde geçen dalgalar son zemin erişimini yine çözmeyebilir.

Başlangıçta yasal takas sayısı tek başına anlamlı seçim zenginliği değildir. Raporda farklı ilk eşleşme kümeleri, görünen puan/kat kazanç aralığı ve farklı sertifikalı ilk hamleler ayrıca bulunur. Birbiriyle aynı üçlüyü oluşturan iki takas, oyuncu için iki ayrı strateji olmayabilir.

Son hücre kayıpları, `lossesWithOneGroundCell`; ortalama eksik hücre ve puanlar, `averageMissingGroundCells` / `averageMissingPoints`; kısmen temizlenmiş çift katlı hücreler `averagePartialDoubleCells`; yalnız zemin/yalnız puan/iki hedef eksikliği `failures` altında ölçülür. Bunlar yolun hangi anında tasarımın hatalı olduğunu tek başına ispatlamaz. Çift katlı hücre sayısı zorlukla ilişkili olabilir; coğrafi erişim ve mevcut sayı dizilimi ayrı etkenlerdir.

## Uygulanmamış değişiklik önerileri

| Mevcut durum | Belirlenen problem | Ayrı PR için önerilen aday | Beklenen etki; henüz ölçülmedi | Kayıt uyumluluğu | Yeni sürüm |
| --- | --- | --- | --- | --- | --- |
| 3: 9 hamle, 2 çift kat, 135 puan | 4'ten zor görünüyor; ilk çift kat ve iki hedef aynı anda yük bindiriyor. | Önce hedef geri bildirimi ve çift kat anlama testi; gerekli çıkarsa +1 hamle adayını karşılaştır. | İlk bağımsız bölümlerden sonraki keskin artışı yumuşatabilir. | Sadece sunumda yok; bütçe değişirse eski taban arşivlenmeli. | Sunumda gerekmez; bütçede taban + varyant sürümü. |
| 4: 9 hamle, 3 çift kat | Puan tamamlanıp son hücrede kalan çok oyun var. | Önce geometri/bütçe sabitken son hücre erişimi daha iyi yeni başlangıçlar üret; tek hamlelik son hücre erişim metriği ekle. | Yasal ama anlaşılması güç son kilitleri azaltabilir. | Eski başlangıçları arşivde koru; devam eden deneme değişmez. | Yeni varyant sürümü. |
| 5: 8 hamle, 4 çift kat; `v1` ayrışıyor | Varyant farkı 45,3 yüzde puan. | `v1` için görünür politikalarla benzer aralıkta yeni aday; sonra tüm bölümde +1 hamleyi ayrı deney olarak ölç. | Önce varyant adaletini, sonra hata payını iyileştirebilir. | Başlangıçta eski paket; bütçede taban arşivi de gerekir. | Yeni varyant; bütçe değişirse taban sürümü de. |
| 6: 8 hamle, 5 çift kat, 160 puan | Rahatlama yerine görünür modellerde daha zor. | İlk aday +2 hamle; ayrı adayda erişimi zor 1–2 ikinci katı tek kata indir; etkileri ayrı ölç. | Hata payı ve temizleme boşluğu yaratabilir; puan tek başına çözüm değil. | Yayımlanmış kat/bütçe üzerine yazılamaz; eski taban ve paket saklanmalı. | Yeni taban + varyant sürümü. |
| 7: 8 hamle, 7 çift kat, 215 puan | Final hücre ve puan birlikte sıkışıyor. | 6 rahatlama düzeldikten sonra +1 hamle ve aynı bütçede erişimi iyi başlangıç adaylarını ayrı karşılaştır. | 8 öncesi yorgunluğu azaltabilir; yeni bir zirve yaratmamalı. | Bütçede eski taban; başlangıçta eski varyant korunmalı. | Değişikliğe göre taban + varyant / yalnız varyant. |
| 8: 8 hamle, 9 çift kat | Çok düşük görünür başarı; birkaç hücre birden kalıyor. | +2 hamle ve ayrı adayda 2 ikinci kat azaltma; en az iki görünür stratejinin toparlanmasını kıyasla. | Planlı meydan okumayı koruyup erişilebilir hatalara alan açabilir. | Eski hedef/bütçe/kat tanımı arşivlenmeli. | Yeni taban + varyant sürümü. |
| 9: 12 hamle, 12 çift kat; `v4` ayrışıyor | Rahatlama rolü zayıf; alternatif açılışta belirgin düşüş. | İlk aday +2 hamle; geometri/palet sabitken görünür güçlü açılışları ve son alan erişimi iyi yeni varyantlar ara; `v4` öncelikli. | 8 sonrası kazanma/yeniden deneme hissini destekleyebilir. | Bütçede taban, başlangıçta paket arşivi. | Yeni taban + varyant sürümü. |
| 10: 14 hamle, 16 çift kat | Puan sağlanırken birkaç zemin hücresi kalıyor. | Önce +2 hamle adayını ölç; puanı azaltmak yerine erişimi en güç ikinci katların yerini/sayısını ayrı deneyde değiştir. | Final stratejisini koruyup zemin erişim baskısını azaltabilir. | Eski kat/bütçe ve paket arşivi şart. | Yeni taban + varyant sürümü. |

Bunlar **ölçülmesi önerilen hipotezlerdir**; beklenen etki yeni simülasyon veya insan testiyle doğrulanmış değildir. 1/2 için bu raporda veri değişikliği önerilmiyor. 4'ün ve bazı diğer varyantların uygunluğu, yalnız örneklemeli botu daha başarılı yapmak için değiştirilmemeli; farklı görünür stratejiler ve gözlenen oyuncu davranışı birlikte değerlendirilmelidir.

Aynı `levelDataVersion + levelId + variantId` verisi üzerine yazılmamalıdır. Yeni başlangıç/tohumlar için yeni varyant veri sürümü; mevcut Level ID altında hamle, hedef veya kat haritası değişecekse **sürümlü taban bölüm arşivi de gerekir**. Mevcut katalog yalnızca değişmez orijinal tabanı kullandığı için bu arşiv uygulanmadan önerilen bütçe/kat değişiklikleri yayımlanmamalıdır. Yarım kalan eski deneme eski tanımı ve gerçek geçmişiyle devam etmelidir.

Öncelik sırası: görünür bilgiyle en sorunlu bölümlerde sınırlı aday üretimi → aynı dört politika ve sertifikalarla karşılaştırma → gönüllü insan testi → kayıt sürümü açıkça tasarlanmış ayrı dengeleme PR'ı. Yeni bot eşiklerini mevcut insan kazanma hedefi gibi kabul kapısına zorla çevirmek bu PR'ın parçası değildir.

## Oyuncu testi ve yorumu

İlk nitel testte 8–12 yeni oyuncu iki öğreticiden başlayıp kendi sözcükleriyle eşleşme, puan, yeşil alan ve çift katı açıklamalı. Yardımcı kişi kuralı önceden söylememeli. “Ne yapacağımı anlamadım” ile “ne yapacağımı biliyorum ama hamle yetmedi” farklı sorunlar olarak kaydedilmeli. Gözlem oturumunda 4/5/8/9/10'a ayrı bakılmalı; 5→6 ve 8→9 geçişlerinde hissedilen rahatlama sorulmalı.

Uygulanan isteğe bağlı geliştirici test modu, yerel olaylardan tamamlanma, deneme, ipucu, kayıp nedeni, eksik puan/alan, hamle konumları, aktif süre, tekrar ve can engelini toplar; kullanıcı isteğiyle yerel JSON indirir. Kullanım, açık rıza ve veri sınırları [PLAYTEST_MODE.md](PLAYTEST_MODE.md) içindedir. Katılımcı adı, e-posta, IP veya cihaz parmak izi toplanmaz; hiçbir sunucuya otomatik gönderim yapılmaz. Can sınırını kapatma ayrı ve açık geliştirici tercihidir; bypass sonuçları ayrıca etiketlenir. Yerel test dışa aktarımı bu dokümandaki bot raporundan ayrıdır.

Deneme bazlı tamamlama paydası başlayan benzersiz denemeler; oyuncu bazlı oran için gönüllü oturum gruplaması gerekir. Yarım kalan/kapalı pencereyi kendiliğinden kayıp diye saymamak gerekir. Aktif süre arka planda geçeni dışlamalıdır. Can engelini zorluk kaybıyla, ipucunu doğal çözümle, tekrarları bağımsız oyuncularla birleştirmemek gerekir. Örneklem ve takip süresi önceden tanımlandıktan sonra daha geniş, kişisel veri içermeyen test yapılmalıdır.

## Tekrarlama ve CI

```text
npm run audit:observable    # Raporu 18 bin oyunla yeniden üretir.
npm run test:observable     # Bilgi sınırı testleri + raporu yeniden hesaplayıp birebir karşılaştırır.
npm test                    # Mevcut motor, varyant, can, kayıt, öğretici, UI ve veri kontrolleri.
npm run test:unity-rewards  # Mevcut saf C# ödül uyumu.
```

Yeni `Observable difficulty audit` GitHub Actions işi mevcut JavaScript ve C# ödül işlerini koruyarak eklenmiştir. Rapor zaman eşiğiyle değil sabit karar/arama bütçeleriyle üretilir; çalışma süresi sonuç üzerinde etkili değildir. `HEXROTA_AUDIT_WORKERS=1` sıralı çalışma sağlar, veriyi değiştirmez. CI sonucu PR üzerinden ayrıca bildirilmelidir; dosyanın var olması çalıştırılmış bir kontrol anlamına gelmez.
