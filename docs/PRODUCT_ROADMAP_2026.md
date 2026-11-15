# HEXROTA — Ürün stratejisi ve öncelik yol haritası

**Tarih:** 15 Kasım 2026
**Durum:** Onaylı çalışma planı; aşağıdaki yeni özellikler ve denge değişiklikleri henüz uygulanmadı.
**Referans:** GitHub main (Hexrota 9.3 C# birleşmesi), çalışan PWA prototipi, mevcut analiz dokümanları.

## 1. Ürün vizyonu

**Ürün vaadi:** “Her bulmacayla dünyanı biraz daha yeşert.”

Hexrota'yı yalnızca sayılı altıgenleri eşleştiren bir oyun olarak değil; kısa oturumlarda kolay öğrenilen, takas ve zincirlemeleriyle tatmin eden, adil biçimde zorlaşan ve kalıcı bir yeşil dünya inşa ettiren bir mobil bulmaca olarak geliştireceğiz.

**Rakiplerden alınan tasarım dersleri (özgün bir başarı garantisi değildir):**

| Rakip yaklaşımı | Öğrenilen ilke | Hexrota'nın yorumu |
| --- | --- | --- |
| Hexa Sort | Dokunsal hareket ve anlaşılır görsel tatmin | Eşleşme, düşüş, sayı ve yeşil zemin efektleri net okunmalı |
| Block Blast! | Çok düşük öğrenme maliyeti ve tekrar oynanabilirlik | Oyuncu ilk 15 saniyede geçerli takas yapabilmeli; kısa seanslarda anlamlı sonuç |
| Royal Match | Uzun vadeli ilerleme ve sürekli yeni içerik | Bölüm ilerlemesi kalıcı bahçe/yolculuk görünümünü büyütmeli |
| Color Block Jam | Basit kontrollerle planlama derinliği | Zorluk karar verme gerektirmeli; görünmeyen bilgiye veya zorunlu ödemeye dayanmamalı |

**Başarı döngüsü:** Öğren → eşleştir → tatmin ol → bölümü/zemini tamamla → dünyanı büyüt → yeniden oyna.

Oyun yalnızca para kazanmak için zorlaştırılmayacak. Reklam veya ödeme geçmişi taş üretimini, varyant seçimini, RNG'yi ve ipucu kalitesini etkilemeyecek.

## 2. Başlangıç durumu — uygulanan ve uygulanmayan

- Çalışan mobil uyumlu JavaScript PWA, iki öğretici, 10 kampanya bölümü, bölüm başına dört varyant, toplam 80 doğrulanmış kazanma rotası var.
- C# Gameplay, Reward, Catalog, Lives, Hints, RewardAdapter ve Application/Save/Event çekirdeği JS ile karşılaştırılmıştır. Unity sahnesi / yerel mobil uygulama henüz yok.
- Can sistemi, 30 dakikalık yenilenme, TEST Altın ve sahte reklam/ödül akışları mevcut; gerçek reklam, gerçek mağaza ve düzenli Altın kazanımı mevcut değil.
- İsteğe bağlı yerel oyuncu testi kaydı ve JSON dışa aktarma mevcut; otomatik veri gönderimi, hesap tabanlı oyuncu takibi veya gerçek D1/D7 ölçümü yok.
- Zorluk denetimi 17.920 bot denemesi içerir; bunlar insan kazanma oranı değildir. Görünür bilgiyle karar veren örneklemeli botun başarı oranı yaklaşık: Bölüm 1 %98,8; 2 %98,8; 3 %67,6; 4 %79,7; 5 %52,3; 6 %33,6; 7 %30,5; 8 %2,7; 9 %19,1; 10 %3,5.
- 5. bölüm v1 ile v3 arasındaki bot başarısı farkı 45,3 yüzde puan; 6 ve 9 tasarlanan rahatlama bölümünü güvenilir biçimde sağlamıyor; 8 ve 10 çok sert zorluk zirveleri.
- En sık görülen kayıp türlerinden biri puan hedefi tamamlanmasına rağmen son yeşil zemin hücrelerinin eksik kalması.

## 3. Öncelikli ürün yol haritası

| Öncelik | Paket | Somut teslimat | Karar kapısı |
| --- | --- | --- | --- |
| P1 — Oynanış kalitesi | İlk deneyim, zorluk ve oynanabilir test laboratuvarı | Aday bölüm senaryoları, görünür bilgi bot raporu, izole test modu, gözlem şablonu | Oyuncular kuralları anlayabiliyor; meydan okuma adil; eski kayıtlar etkilenmiyor |
| P2 — Kalıcı yeşil dünya | Bölüm tamamlandıkça büyüyen yolculuk/bahçe | Kazanılan her bölüm için kalıcı, anlaşılır görsel değişim | Yeni bir bölüme geçmenin anlamı ve beklentisi açık |
| P3 — Günlük bulmaca | Ana kampanyadan ayrı günlük meydan okuma | Tarihe bağlı sabit tahta, ücretsiz oynama, kişisel sonuç ve paylaşım | Aynı gün aynı problem; istismar/döngü/kayıt sınırı doğru |
| P4 — Oyuncu ölçümü | Gönüllü playtest ve küçük insan araştırması | Anonimleştirilmiş yerel JSON analizi; başlangıç, kayıp, tekrar, ipucu ve aktif süre | Gerçek insan davranışı bot sonuçlarından ayrı raporlanıyor |
| P5 — İlerleme ve ekonomi | Başarımlar, rekorlar, normal Altın kazanımı ve kozmetik | İdempotent ödüller, şeffaf fiyatlar, tamamen ücretsiz ilerleme | Ücretsiz oyun tatmin edici; alışveriş gücü gizlice artırmıyor |
| P6 — Mobil yayın | Performans, erişilebilirlik, Unity bağlantısı, mağaza hazırlığı | Fiziksel iPhone/Android ve daha sonra IL2CPP testleri | Oyun ve kayıt güvenli, cihaz performansı ölçülmüş, ticari SDK'lar doğrulanmış |

**Bağımlılık:** P4 ölçüm araçları P1'in içinde minimum hâliyle başlatılır; daha büyük analiz çalışması P4'te genişletilir. P1 doğrulanmadan yeni 50 bölüm, güçlendirici ekonomisi veya gerçek reklam/ödeme açılmayacak.

## 4. P1 — Oynanış kalitesi: ilk geliştirme dilimi

### 4.1 Önce ölç, sonra dengele

**İlk görev: Hexrota Balance Lab (#11 önerisi).**

Üretimdeki 10 bölüm, 40 varyant, kazanma yolları, puan ve can kuralları aynen kalsın. Çevrimdışı çalışan bir karşılaştırma aracı ve ilerlemeyi etkilemeyen test yüzeyi ekle.

İncelenecek hipotezler:

| Bölüm | Sorun | Laboratuvarda karşılaştırılacak aday |
| --- | --- | --- |
| 3–4 | Zorluk artışının yer değiştirmesi ve son zemin hücresi | Hedef açıklığı; gerektiğinde +1 hamle ve erişilebilir başlangıçlar |
| 5 | Varyantlar arası büyük başarı farkı | Önce v1'e alternatif başlangıç/tohum; ayrı olarak +1 hamle |
| 6 | Rahatlama olması gerekirken zor | +2 hamle; ayrı deneyde 1–2 çift katı azaltma |
| 7 | 8 öncesi gereksiz yorgunluk | Önceki bölüm düzeldikten sonra +1 hamle veya farklı erişilebilir başlangıç |
| 8 | Birden fazla zemin hücresi eksik kalıyor | +2 hamle; ayrı deneyde iki çift kat azaltma |
| 9 | Rahatlama etkisi yetersiz, v4 zayıf | +2 hamle; ayrı deneyde yeni başlangıç/v4 alternatifi |
| 10 | Finalde puandan çok zemin darboğazı | +2 hamle; ayrı deneyde zor çift kat yerleşimleri |

Bu adaylar öneridir; yayımlanacak ayarlar değildir. Her deney sabit tohum/bütçeyle, aynı görünür bilgi politikalarıyla, mümkünse birden fazla oyun tarzıyla karşılaştırılmalı. Kazanma sertifikaları en az iki farklı ilk takası doğrulamalı.

**Rapor alanları:** bölüm/varyant/veri sürümü, deney adı, bot/politika, örnek sayısı, tamamlanma, puan eksiği, eksik yeşil hücre, kalan çift kat, son hücrede kayıp, açılış çeşitliliği, bilinen kazanma yolu, değişiklik türü ve eski kayıt uyumluluğu.

### 4.2 Gerçek oyuncu pilotu

- İlk pilot: 8–12 gönüllü; önce iki öğretici, sonra ilgili bölümler.
- Oyuncunun ilk geçerli takasa ulaşması, eşleşme/puan/yeşil alan/çift katı açıklayabilmesi ve puan tamamken zemin neden eksik kaldığını anlaması gözlensin.
- “Kuralı anlamadım” ve “kuralı biliyorum ama hamle yetmedi” ayrı işaretlensin.
- Test sırasında oyunu çözdüren ipucu verilmesin; kullanılan oyun içi ipucu ayrıca kaydedilsin.
- Gözlem yalnız açık rızayla; yerel JSON olarak, otomatik sunucu aktarımı olmadan. Can sınırı kapatılmış denemeler normal oyuncu sonuçlarıyla karıştırılmasın.
- İlerlemeyi sıfırlamadan, seçili bölüm/varyant ve deney adayını açabilen izole test modu tercih edilsin.

### 4.3 Sunum ve his

Oyuncunun eşleşme sırasında her iki taşı da görmesi, puan ve zemin ilerlemesini açıkça izlemesi, ses ve titreşim geri bildirimi, son hamle ve zincir tepkisi korunmalı. Önceki kullanıcı geri bildirimi gereği: sabit oyun tahtası küçülmeyecek; “Animasyonu geç” düğmesi ve kalıcı “Boyanacak/Yeşil alan” alt açıklama şeridi geri getirilmeyecek. Oyuncuya kazanma garantisi olmayan ipucu garantiymiş gibi gösterilmeyecek.

İlk Balance Lab PR'ı üretim arayüzünü yeniden tasarlamayacak. Gözlem sonrası gerekirse ayrı ve küçük bir UX PR'ı hazırlanacak.

## 5. P2 — Kalıcı yeşil dünya

- Mevcut ilerleme patikasını genişlet: tamamlanan bölüm, bahçede/yolda kalıcı bir değişiklik oluştursun.
- Bölüm kimliği ve tamamlanma kaydıyla yeniden üretilebilir olsun; yalnız animasyona dayanmasın.
- Dekorasyon oyun sonucu, RNG veya varyant zorluğunu değiştirmesin.
- Küçük mobil ekranda okunaklı, hızlı, düşük güç tüketimli ve azaltılmış hareketle uyumlu olsun.
- Görsel dünya oyuncuya baskı veya kaybetme cezası değil, doğal ilerleme ve merak duygusu sunsun.

## 6. P3 — Günlük bulmaca

- Ana hikâye/kampanya bölümünden ve ücretli can kapısından ayrı olsun.
- Aynı UTC tarih/sürüm için aynı başlangıç/seed/kurallar; bitiş ve yeniden deneme şeffaf.
- Çözüm ya da başarı paylaşımları oyuncu kimliği veya özel kayıt bilgisi sızdırmasın.
- Takvimde farklı zaman dilimi ve çevrimdışı kullanım senaryoları test edilsin.
- Günlük oynama zorunluluğu, geriye dönük cezalandırma veya yanıltıcı süre sayacı olmasın.

## 7. P4 — Ölçüm ve ürün öğrenmesi

Başlangıç için mevcut isteğe bağlı yerel gözlem sistemi kullanılmalı; daha geniş analitik platformu daha sonra rıza, veri saklama ve anonimleştirme kararıyla tasarlanmalı.

Önerilen ölçüler: ilk geçerli hamleye süre, öğretici tamamlama, bölüm/varyant deneme sayısı, kayıp sınıfı, eksik zemin/puan, tekrar deneme, ipucu kullanımı, aktif oyun süresi, geri dönüş niyeti anketi. Gerçek D1/D7 ancak takip ve örneklem koşulları tanımlanınca raporlanabilir. Bot başarısı insan tutma metriği değildir.

## 8. P5 — İlerleme, ödüller ve ekonomi

- Önce başarımlar, rekorlar, kozmetik kazanımlar ve anlaşılır ücretsiz Altın kaynaklarını değerlendir.
- Can sistemi ve mevcut 300 TEST Altın gerçek ekonomi değildir.
- Yeni para/yardım komutları mevcut snapshot v4'e gizlice eklenmeyecek; ayrıca oyun kuralı ve kayıt sürümü tasarlanacak.
- Aynı ödül/işlem iki kez uygulanmayacak; satın alma, reklam veya mağaza ziyaretleri zorluğu etkilemeyecek.
- Gerçek reklam/ödeme SDK'sı ve fiyatları ancak oyuncu testi, hukuk/platform ve adil ekonomi doğrulamasından sonra.

## 9. P6 — Yayın hazırlığı ve teknik güvenlik

- Web PWA, JS kaynakları ve canlı Production bağımsız çalışmalı; C# geliştirme ve Unity geçişi bunları bozmamalı.
- GitHub main yalnız onaylanmış PR ile değişmeli. Tüm 11 mevcut CI işi korunmalı.
- Main ruleset'inde şu an yalnızca iki status check zorunlu; güvenlik iyileştirmesinde 11'ini de korumaya alma işi ayrıca ele alınmalı.
- Bir bölümün yayımlanmış başlangıcı/tohumu/sürümü sessizce değiştirilmeyecek. Hamle/hedef/kat/koordinat değişiyorsa eski temel bölüm tanımı ve eski varyant paketi sürümlü arşivlenecek.
- Yarım kalmış eski deneme aynı tahta, aynı hamle geçmişi, aynı RNG ve aynı can hakkıyla açılmalı.
- Her yeni oyun kuralı için gerçek JS–C# karşılaştırması; her mobil UI değişikliği için Chromium, WebKit ve fiziksel iPhone kontrolü aranmalı.
- Entegrasyon ve yayın ayrı onay kapılarıdır; GitHub CI'nin geçmesi fiziksel cihazın test edildiği anlamına gelmez.

## 10. Sıra ve kararlar

1. **Şimdi:** PR #11 — çevrimdışı Balance Lab + izole test yüzeyi + karşılaştırmalı rapor. Ana oyun kuralları değişmez.
2. **Sonra:** 8–12 oyuncuyla pilot; ilk 15 saniye, öğretici açıklığı, zemin darboğazı ve tekrar deneme isteği gözlenir.
3. **Sonra:** Yalnız desteklenen adaylar için sürümlü dengeleme PR'ı; JS/C# testleri ve eski kayıt devamı.
4. **Ardından:** Kalıcı yeşil dünya, günlük bulmaca, ölçümün genişletilmesi, kozmetik/ekonomi ve mobil yayın.

### Dayanak dokümanlar

- docs/DIFFICULTY_AUDIT.md
- docs/LEVEL_DESIGN.md
- docs/PLAYTEST_MODE.md
- docs/ANALYTICS.md
- docs/ECONOMY_DESIGN.md
- docs/LIVES_DESIGN.md
- docs/CSHARP_9_3_VALIDATION.md
- docs/UNITY_MIGRATION_PLAN.md

**Bu belge çalışma planıdır:** Beklenen etkinin doğrulanmış oyuncu davranışı olduğu iddia edilmez. Yeni fikirler onaylı ürün kararları olarak değil, önce hipotez/test olarak ele alınır.
