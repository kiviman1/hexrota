# Hexrota — Soft Launch Hareket Planı

Nov 20, 2026 · @Kıvanç Taşcıoğlu

## Özet

Karar: 12 hafta boyunca yeni özellik ve görsel cila yok. Mevcut oyunu uçtan uca oynanabilir ve ölçülebilir hâle getirip Android'de soft launch yapıyoruz. Tek istisna okunabilirlik.

Öncelik sırası:

1. Kırık akışı onar: takviye ve kurtarma V5 bölümlerinde kapalı.
2. Yayın yapılandırmasını ayır, belgeleri tekleştir, CI testlerini aç.
3. İnsan testi ve ölçüm.
4. Bölüm üretim hattı, yaklaşık 60 bölüm, 2–3 alan.
5. Ekonomi ve gelir.
6. Cila ve soft launch.

**Güncelleme (20 Kasım 2026):** Hafta 2 yalnız V5 akışına daraltıldı; okunabilirlik minimumu ve geçici sesler hafta 3'ün ilk yarısına geçti. İnsan testi hafta 3'ün sonuna ya da hafta 4'ün başına kaydı; sonraki haftalar birer hafta kaydı, sıra değişmedi. Plan 13 hafta. Aşağıdaki "Analizin değerlendirmesi" bölümündeki hafta numaraları ilk sürüme aittir.

Cevaplanacak asıl soru: Oyuncu yüksek puan ile kalan toprağa erişim arasında seçim yapmaktan keyif alıyor mu?

## Analizin değerlendirmesi

Analiz büyük ölçüde doğru. Aşağıdaki ekler planı değiştiriyor.

**Kabul edilenler**

- Takviye ve kurtarma V5'te kapalı: en kritik bulgu. Oyuncu anahtarı kazanıyor ama kullanamıyor. Testler bunu beklenen davranış sayıyor.
- Geliştirici araçları normal ayarlarda açık: ölçümü bozar.
- Belgeler çelişiyor: 3D, 5 yükseltme/50 yumurta, takım sekmesi.
- Son hücre sorunu ve puan erken bitince sayıların anlamsızlaşması ölçülmeli.
- Ekonomi: 10 bölümün toplamı 220 Altın, tek kurtarmaya yetiyor.
- Altın Yumurta yalnız ilk bölüm kazanımından gelsin; günlük ödül ve etkinlikler Altın/takviye versin.
- Ertelenecekler listesi doğru.

**Ekler ve itirazlar**

- **CI testleri koşmuyor.** EditMode/PlayMode yalnız elle tetiklenince çalışıyor. AI ile kod yazılırken bu sessiz bozulma demek. Hafta 1'e alındı.
- **Okunabilirlik insan testinden önce.** Oyuncu iki hedefi göremezse test sonucu çöpe gider. Oyun ekranı tasarımının yalnız okunabilirlik kısmı hafta 2'ye: büyük rakam, iki hedef paneli, toprak katmanı ve kasa dayanımı göstergesi. Taş zenginleştirme hafta 11'de.
- **Basit sesler erken.** Eşleşme, kazanma ve kaybetme için geçici sesler hafta 2'de; his testini etkiler.
- **Bölüm üretimi en büyük risk.** 60 bölüm elle yapılmaz. Hafta 5'teki üretim hattı kayarsa tüm plan kayar.
- **Alan sanatı erken başlamalı.** Her yeni alan 5 kümes sprite'ı ve arka plan demek. 2. alan sanatı hafta 5'te başlar, 7'ye kalmaz.
- **Mekanik deneyi dörtlü eşleşmeyle başlasın.** Tür oyuncuları eşleşmeden özel taş bekler. Rakam koşullu kasa sonraya.
- **12 hafta, haftada 25–30 saat varsayımına dayanıyor.** Gerçek süren farklıysa takvim uzar, sıra değişmez.

## 13 haftalık plan

Her hafta bir çıktı ve bir "bitti" ölçütü. Ölçüt sağlanmadan sonraki haftaya geçilmez.

| Hafta | Odak | Çıktı | Bitti sayılır | Durum |
| --- | --- | --- | --- | --- |
| 1 | Temizlik | Belgeler tekleşti; geliştirici araçları yalnız dev build'de; CI testleri PR'da koşuyor; V5 akış haritası | Release build'de dev menüsü yok, tek tasarım kaynağı var | Tamamlandı ([rapor](reports/hafta-1.md)) |
| 2 | Akışı onar | V5'te fırça, anahtar, +5 hamle; çanta oyun ekranından açılıyor; uçtan uca PlayMode testi; Android test build'i | Öğretici → bölüm → takviye → kayıp/kurtarma → ödül → kümes → sonraki bölüm, gerçek arayüzden kesintisiz | Tamamlandı ([rapor](reports/hafta-2.md)) |
| 3 | Okunabilirlik ve ses | İlk yarı: okunabilirlik minimumu, geçici sesler. Hafta sonunda insan testi başlar | İki hedef, toprak katmanı ve kasa dayanımı ekranda okunuyor; temel olayların sesi var | PR açık, birleştirme bekliyor ([rapor](reports/hafta-3.md)) |
| 4 | İnsan testi | 8–12 yeni oyuncu gözlemi (hafta 3 sonunda başlar); ilk 10 bölüm düzeltmesi | Oyuncular iki hedefi kendi sözleriyle anlatıyor | Bekliyor |
| 5 | Ölçüm | Analitik + çökme takibi; olay şeması | Bölüm, deneme, kayıp nedeni, tek hücre kaybı, D1/D7 görülüyor | Bekliyor |
| 6 | Üretim hattı | Bölüm şablonları, çözücü + görünür bilgi botu; 11–30. bölümler; 2. alan sanatına başlangıç | Yeni bir bölüm üretilip otomatik doğrulanabiliyor | Bekliyor |
| 7 | Mekanik deneyi | Dörtlü eşleşme → dar etkili yön taşı | Testte keyif artıyor; artmıyorsa atılır | Bekliyor |
| 8 | İçerik | Yaklaşık 60 bölüm; 2.–3. alan verisi ve yükseltme akışı | Birinci kümes bitince ulaşılabilir sonraki hedef var | Bekliyor |
| 9 | Ekonomi ve gelir | Altın dengesi; gerçek ödüllü reklam (TEST reklamı ve Test Altınıyla can satın alma release'den kalkar); kararla tek IAP | Takviye ve kurtarma kullanımı ölçülüyor | Bekliyor |
| 10 | Cihaz testi | Düşük/orta cihaz, arka plan, bağlantı kesilmesi, kayıt, güncelleme | İlerleme hiçbir senaryoda kaybolmuyor | Bekliyor |
| 11 | Kapalı test kohortu | D1/D7 ve kayıp analizi; darboğaz düzeltmeleri | Darboğaz bölümler düzeltildi | Bekliyor |
| 12 | Cila | Taş sprite'ları, oyun ekranı tam tasarımı, geçişler, ses, mağaza görselleri | Görsel tutarlılık kontrolü | Bekliyor |
| 13 | Soft launch | Android, sınırlı ülke; izleme açık | Sürüm yayında | Bekliyor |

Yön taşı deneyi tutmazsa 7. hafta ikinci bir mekanik aramaya harcanmaz, mevcut bölüm çeşitliliğine dönülür.

**Google Play notu:** 13 Kasım 2023'ten sonra açılan kişisel geliştirici hesaplarında üretime çıkmadan önce en az 12 test kullanıcısıyla, kesintisiz 14 günlük kapalı test şart. Dahili test sayılmaz. Bu yüzden kapalı test hafta 9 sonunda başlar, 15–20 kişiyle (bırakanlara pay), ve hafta 11 kohortu bu testten gelir. [Kaynak](https://support.google.com/googleplay/android-developer/answer/14151465)

## Claude Code istemleri

Her haftanın başında o haftanın istemini olduğu gibi ver. Ortak çalışma kuralları hafta 1'de CLAUDE.md'ye yazılır, sonraki istemler onu varsayar. Hafta sonu raporu bu sohbete gelir; gerekirse sonraki istem güncellenir. İstemlerde \[karar\] yazan yerleri "Karar bekleyenler" bölümüne göre doldur.

**CI: tamamlandı (PR #55).** editor-tests, runtime-host ve source-and-scene-integrity main için zorunlu; testler GitHub-hosted runner'da her PR'da koşuyor.

### Hafta 1 — Temizlik

> Yeni yön: 12 hafta boyunca yeni özellik ve görsel cila yok; oyunu uçtan uca tamamlayıp ölçülebilir hâle getiriyoruz. Hafta 1, her iş ayrı commit, tek PR:
>
> 1. **Belgeleri tekleştir.** docs/design/ ve stil belgelerini şu karara göre güncelle: el boyaması 2D (3D yok); alan başına 4 yükseltme, maliyet 1/2/3/4 yumurta, toplam 10; üç kaynak (Can, Altın, Altın Yumurta); takım, lig ve sohbet çıkış kapsamı dışında. Çelişen belgeleri arşive taşı. Tek kaynak `docs/design/PRODUCT.md` olsun.
> 2. **CLAUDE.md çalışma kuralları.** Ekle: plan dönemi boyunca yeni özellik ve görsel cila yok; her iş ayrı commit, haftalık tek PR; üç zorunlu CI kontrolü yeşil olmadan birleştirme yok, testleri atlayan ya da etkisizleştiren çözüm yok; yeni mekanik ve akışa EditMode/PlayMode testi; başarısızlıkta oyun kodu, test ve CI hatasını ayır; secrets hiçbir yerde paylaşılmaz; her hafta sonunda kısa rapor (ne bitti, ne kaldı, riskler). CLAUDE.md, PRODUCT.md'yi göstersin.
> 3. **Geliştirici araçlarını ayır.** Ayarlardaki can sınırsızlığı, test reklamı, test altını ve tam sıfırlama yalnız Editor/Development build'de derlensin. Release build'de olmadıklarını doğrulayan test ekle.
> 4. **V5 akış haritası (kod yazmadan).** Öğretici → bölüm → takviye → kayıp/kurtarma → ödül → kümes → sonraki bölüm zincirinde V5 kampanyada kırık ya da kapalı olan her noktayı listele: InventoryAvailable'ın yalnız classic-v4 kabul etmesi, +5 hamlenin kapalı olması, çantanın HUD'dan açılmaması dahil. Her madde için hafta 2 iş listesi ve tahmini büyüklük çıkar.

### Hafta 2 — Akışı onar

> Hafta 1'deki V5 akış haritasına göre, her iş ayrı commit, tek PR:
>
> 1. Fırça, anahtar ve +5 hamle kurtarması V5 bölümlerinde çalışsın; kasa, zemin katmanı, kayıt ve ödül etkileşimleri dahil. Yalnız sürüm kontrolünü kaldırmak yetmez. Kural: takviyeden doğan her eşleşme ve zincir normal eşleşmeyle aynı kurala uyar, kasaya normal eşleşme gibi bir kat hasar verir; fırça kasalı hücreye ve kasanın arkasında kapalı kalan hücreye kullanılamaz (PRODUCT.md).
> 2. Takviye tepsisi (çanta) oyun ekranındaki HUD'dan açılsın.
> 3. Gerçek arayüz üzerinden uçtan uca PlayMode testi: öğretici → bölüm → takviye → kayıp → kurtarma → kazanma → ödül → kümes yükseltmesi → sonraki bölüm.
> 4. Android test build'i al; telefona kurulum adımlarını bana yaz.
>
> V5 takviyeleri JS sürümüne yazılmaz: bot ve çözücü takviyesiz çözülebilirliği ölçmeye devam eder, V5 takviye davranışı JS karşılaştırmasının dışında kalır.

### Hafta 3 — Okunabilirlik ve ses

> Haftanın ilk yarısı, tek PR:
>
> 1. Okunabilirlik minimumu (görsel cila değil): taş rakamları büyük ve kalın konturlu; puan hedefi ve kalan toprak sayısı HUD'da eşit ağırlıkta; hücredeki toprak katman sayısı okunur; kasa dayanımı görünür; seçili taş belirgin.
> 2. Geçici sesler: eşleşme, zincir, kazanma, kaybetme, takviye, düğme. Ayarlarda ses kapatma.
> 3. İnsan testi için Android build'i yenile.

Senin işin: Haftanın sonunda insan testine başla (hafta 4'ün istemine bak).

### Hafta 4 — İnsan testi

> Hafta 3 sonundan bu haftanın başına 8–12 yeni oyuncuyla test yapacağım. Tek PR:
>
> 1. Yerel olay kaydını genişlet: bölüm başlangıç/bitiş, hamle sayısı, kayıp nedeni (puan / zemin / ikisi), puan tamamlandıktan sonra oynanan hamle, tek hücreyle kayıp, takviye kullanımı, öğretici adımları. Oturum sonunda dışa aktarılabilsin.
> 2. Dışa aktarılan kayıtlardan bölüm başına özet tablo çıkaran bir betik yaz.
> 3. Test bulgularımı verdiğimde ilk 10 bölümü ve öğretici metinlerini ona göre düzelt; her değişikliği botla yeniden doğrula.

Senin işin: Oyuncuya müdahale etme. Bölüm 3 ve 6 sonrasında iki hedefi kendi sözleriyle anlatmasını iste, takıldığı yerleri not et.

### Hafta 5 — Ölçüm

> Tek PR:
>
> 1. Analitik ve çökme takibi SDK'sını entegre et: \[karar\]. Olay adları hafta 4'teki yerel olaylarla aynı olsun; sürüm, platform, cihaz ve ülke boyutları eklensin.
> 2. Oturum, D1/D7 geri dönüş ve bölüm hunisi görülebilsin; gereken panelleri ve sorguları bana tarif et.
> 3. Geliştirme build'lerinin olayları ayrı ortama gitsin, yayın verisini kirletmesin.
> 4. Kullanıcı onayı akışı ekle (İngiltere/AB). Toplanan verilerin listesini Google Play veri güvenliği beyanı için `docs/release/DATA_SAFETY.md`'ye yaz.
> 5. Olayların gönderildiğini ve onay yokken gönderilmediğini doğrulayan test ekle.

### Hafta 6 — Bölüm üretim hattı

> Hedef: yeni bir bölümü hızla üretip otomatik doğrulamak. Tek PR:
>
> 1. Bölüm şablonları: tahta şekli, toprak katmanları, kasalar, taş dağılımı, hamle ve puan hedefi parametreli. Her bölüme rol etiketi: puan ağırlıklı / alan ağırlıklı / dengeli.
> 2. Doğrulama: mevcut çözücü ve görünür bilgi botu her bölümde koşsun; kazanma oranı, ortalama kalan hamle ve tek hücre kaybı oranı raporlansın. Hedef aralık dışındaki bölüm CI'da uyarı versin.
> 3. Bu hatla 11–30. bölümleri üret. Ritim: tanıtım → pekiştirme → eski mekanikle birleşim → meydan okuma → rahatlama. Yeni engel ekleme.
> 4. Süreci `docs/design/LEVELS.md`'ye yaz.

Senin işin (paralel): 2. alanın arka planı ve 5 kümes sprite'ı.

### Hafta 7 — Mekanik deneyi

> Dörtlü eşleşme → yön taşı prototipi, özellik bayrağı arkasında. Tek PR:
>
> 1. Kurallar: üç altıgen eksenden birini kullanır; merkez dahil en fazla 3 hücre; hücre başına en fazla 1 zemin/kasa katı; puan çarpanı yok; ilk sürümde zincirleme tetikleme yok.
> 2. Bayrak kapalıyken davranışın değişmediğini doğrulayan test ekle.
> 3. 21–30. bölümlerde bayrak açık/kapalı bot sonuçlarını karşılaştır.
> 4. Kod, sonuç olumsuz çıkarsa tek PR'la temizce silinebilecek şekilde ayrık olsun.

Senin işin: 3–5 kişiyle bayrak açık/kapalı oynatıp karşılaştır. Keyif artmıyorsa bayrak kapalı kalır.

### Hafta 8 — İçerik ve meta

> Tek PR:
>
> 1. Bölümleri hafta 6 hattıyla 60'a çıkar. 31–60'ta hafta 7 sonucuna göre yön taşını ve mevcut alan açma sistemini kullan; yeni engel ekleme.
> 2. 2. ve 3. alan: CoopConfig ve CoopLook verileri, alan geçişi, Alanlar ekranı, eski alanların ziyaret edilebilmesi.
> 3. Yeni kümes sprite'larını `cut_sprites.py` ile işle; içerik kontrolü geçmeli.
> 4. Test: alan 1 bitince alan 2'nin ilk yükseltmesine kesintisiz geçiş, kayıt geri yüklemesi dahil.

### Hafta 9 — Ekonomi ve gelir

> Tek PR:
>
> 1. Tüm Altın kaynak ve harcamalarını `docs/design/ECONOMY.md`'de tek tabloda topla; değerler config'te olsun.
> 2. Bölüm başına Altın ile fırça, anahtar ve +5 hamle fiyatları için, oyuncunun kabaca her 3–4 bölümde bir takviye alabileceği bir öneri sun. Onayımdan sonra uygula.
> 3. Ödüllü reklam SDK'sı: \[karar\]. +5 hamle ve can yenileme için. Reklam yüklenemezse akış bozulmasın.
> 3a. Kapalı test build'inden önce can panelindeki "TEST reklamı" ve Test Altınıyla can satın alma release'den kalksın; yerine gerçek ödüllü reklam gelsin. Release'de olmadıklarını doğrulayan test ekle (DevelopmentToolsReleaseTests gibi).
> 4. &#91;Karar verildiyse\] tek IAP: reklam kaldırma ya da başlangıç paketi.
> 5. Ekonomi ve reklam olaylarını analitiğe ekle.
> 6. Hafta sonunda Play Console kapalı test kanalı için release build (.aab) hazırla.

Senin işin: Kapalı testi bu hafta sonunda başlat (aşağıdaki Google Play notuna bak).

### Hafta 10 — Cihaz ve kayıt güvenilirliği

> Tek PR:
>
> 1. Kayıt senaryoları için test: bölüm ortasında uygulamayı kapatma, arka plana alma, bağlantı kesilmesi, reklam sırasında kapanma, eski kayıt formatıyla güncelleme, depolama dolu.
> 2. Performans: düşük sınıf Android'de kare hızı, bellek ve yükleme süresini ölç; darboğazları raporla.
> 3. Farklı ekran oranları ve çentik/güvenli alan kontrolü.
> 4. Çökme takibine gelen hataları sınıflandır ve düzelt.

Senin işin: Fiziksel cihazlarda deneme. Kapalı test sürerken yalnız kritik düzeltme yükle.

### Hafta 11 — Kapalı test kohortu

> Kapalı test verisi geldi. Tek PR:
>
> 1. Bölüm hunisi, deneme sayısı, kayıp nedenleri, tek hücre kayıpları ve D1/D7'yi çıkar; en kötü 5 bölümü belirle.
> 2. Bu bölümler için düzeltme öner (sırayla erişim, katman, hamle bütçesi). Onayımdan sonra uygula, botla yeniden doğrula.
> 3. Takviye ve kurtarma kullanımına göre ekonomi ayar önerisi sun.

### Hafta 12 — Cila

> Bu hafta görsel cila serbest. Her görsel değişiklik için önce/sonra yakın çekim gönder. Tek PR:
>
> 1. Oyun ekranı tam tasarımı: ahşap çerçeve, toprak → çimen hücre sprite'ları ve dönüşüm animasyonu, mor/altın HUD (mor 1 taşıyla karışmayacak koyu, doygunluğu düşük ton), Tavik portresi tepkileri.
> 2. Taş sprite'ları: 1 sade çakıl → 5 yıldız kesim mücevher; renk, şekil ve doku ayrımı; gri tonlamada ayırt edilebilirlik testi; rakam taş yüksekliğinin yaklaşık %50'si.
> 3. Kasa: açık ahşap ve demir köşebent, 2 hasar evresi.
> 4. Geçişler, parçacıklar, gerçek sesler ve müzik.
> 5. Mağaza görselleri: ikon, 5–8 ekran görüntüsü, tanıtım grafiği.

### Hafta 13 — Soft launch

> Tek PR:
>
> 1. Release build: geliştirici araçları yok, analitik yayın ortamında, sürüm numarası ve değişiklik notu.
> 2. Mağaza kaydı için metinler: açıklama, veri güvenliği beyanı, gizlilik politikası sayfası.
> 3. Yayın sonrası günlük kontrol listesi: çökme oranı, D1, ilk 10 bölüm hunisi.
> 4. Sonraki içerik paketi (61–80. bölümler) için iş listesi çıkar.

Senin işin: Play Console'da üretim erişimi başvurusu, ülke seçimi, aşamalı dağıtım.

## Karar bekleyenler

### Verilen kararlar

- 20 Kasım 2026: Hafta 2 yalnız V5 takviyeleri, çanta, uçtan uca test ve Android build; okunabilirlik ve sesler hafta 3'ün ilk yarısına; sonraki haftalar bir hafta kaydı (13 hafta).
- 20 Kasım 2026: Takviyeden doğan eşleşme ve zincirler normal kurala uyar, kasaya bir kat hasar verir; fırça kasalı ve kasa arkasında kapalı hücreye kullanılamaz. Kural PRODUCT.md'de.
- 20 Kasım 2026: JS sürümü (arşiv web oyunu, bölüm botu/çözücü, elle tetiklenen karşılaştırma testleri) V5 takviyelerini almaz. Bot takviyesiz çözülebilirliği ölçer; V5 takviye davranışı karşılaştırma dışında.
- 20 Kasım 2026: Kapalı test build'inden önce (hafta 9) TEST reklamı ve Test Altınıyla can satın alma release'den kalkar, gerçek ödüllü reklam gelir.

### Açık kararlar

Hafta 5'e kadar ilk üçü netleşmeli.

- [ ] Haftada gerçekçi kaç saat? Plan 25–30 saat varsayıyor.
- [ ] Google Play geliştirici hesabın kişisel mi, 13 Kasım 2023'ten sonra mı açıldı? Kapalı test şartını belirler.
- [ ] Analitik ve çökme takibi SDK'sı hangisi?
- [ ] Test oyuncuları nereden bulunacak? Hafta 3–4 insan testi için 8–12, hafta 9 kapalı testi için 15–20 kişi.
- [ ] Gelir: yalnız ödüllü reklam mı, reklam + tek IAP mı?
- [ ] 2\. ve 3. alanın teması ve sanat üretim yolu.
- [ ] Malzeme hedefi (61–70. bölümler): bazı bölümlerde puan hedefinin yerine mi geçsin, yoksa ertelensin mi?
- [ ] Soft launch ülkeleri.

## Ölçülecekler ve yapılmayacaklar

Her karar aşağıdaki ölçümlere bağlanır. D1/D7 ülke, platform, edinim kaynağı ve sürüm bazında ayrılır.

| Soru | Ölçüm |
| --- | --- |
| Oyuncu oyunu anladı mı? | İlk bağımsız geçerli hamle, öğretici tamamlama, iki hedefi anlatabilme |
| Nerede takılıyor? | Bölüm başına deneme; kayıp nedeni: puan, zemin ya da ikisi |
| Son hücre sıkıcı mı? | Tek hücreyle kayıp oranı; puan bittikten sonra oynanan hamle |
| Yeniden oynamak istiyor mu? | Kayıptan sonra tekrar oranı, D1, D7 |
| Kümes motive ediyor mu? | Yükseltme hazırken kullanım; yükseltmeden sonra yeni bölüm başlatma |
| Ekonomi çalışıyor mu? | Takviye stoğu ve harcaması, kurtarma kullanımı, reklam isteği ve tamamlanması |
| İçerik yetiyor mu? | İçerik sonuna ulaşan oyuncu ve sonrasında geri dönüş |

**Soft launch'a kadar yapılmayacaklar**

- Takım, sohbet, gerçek zamanlı rekabet
- Aynı anda birden fazla etkinlik, Battle Pass
- Tavuk satın alma, üretim, yumurta satışı
- Dekor seçenekleri, karakter animasyon rigleri
- İlk 100 bölümde yayılan ot, değişen yerçekimi, konveyör, süreli bomba
- Gizli dinamik zorluk ayarı
- Hafta 12'den önce gölge, parlama ve benzeri görsel cila
