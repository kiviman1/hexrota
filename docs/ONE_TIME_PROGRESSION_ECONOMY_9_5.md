# Hexrota — 9.5 tek seferlik bölüm ilerlemesi, güçlendiriciler ve ekonomi

**Karar tarihi:** 15 Kasım 2026  
**Durum:** Ürün kuralları; uygulama ve fiyatlar pilot testten önce geliştirme adayıdır.  
**Kaynak:** Oyuncu kararı (bölümler yalnız bir kez tamamlanır; tamamlananlar tekrar görünmez), Hexrota 9.3 çekirdeği, 9.4 Balance Lab ve ekonomi tasarım belgeleri.

## 16 Kasım 2026 — ilk açılış ve test sıfırlaması kararı

Oyuncunun son isteğiyle ilk oynanarak kazanılan T2 sonunda **bir defalık +20 Altın başlangıç hediyesi** verilir. Bu, kampanya bölüm ödülünden ayrı `onboarding-v1` hakkıdır; yıldız veya güçlendirici vermez. T1, öğreticiyi atlama, yüklenen eski done bayrakları ve öğretici tekrarı yeni hak oluşturmaz. Normal sıfırlama hakkı korur. Ayarlardaki ayrı **Test için her şeyi sıfırla**, açık veri-silme onayından sonra bu tarayıcıda tamamen yeni bir prototip profili oluşturabilir. Bu geliştirici işlemi gerçek ödeme veya hesap sistemi değildir. Ayrıntı: [WELCOME_REWARD_AND_TEST_RESET.md](WELCOME_REWARD_AND_TEST_RESET.md).

## 1. Değişmez ürün kuralları

1. Bir ana kampanya bölümü **yalnızca ilk doğrulanmış tamamlamada** 20 Altın ve 1 yıldız kazandırır. Normal oyun modunda tamamlanan bölüm daha sonra yeniden oynanamaz.
2. Tamamlanan ana bölüm **oynanabilir bölüm listelerinde, bölüm seçimi, menü CTA'sı ve sonuç ekranında tekrar seçenek olarak görünmez**. Eski kayıttan erişim, deep link, eskimiş dialog, DOM tetikleme, yeniden yükleme, yeniden deneme ve başka API yolları da sunucu olmadan mevcut uygulama/controller sınırında reddedilir. Yolculuk/bahçe geçmiş başarıları dekoratif olarak gösterebilir; bunlar tıklanabilen eski bölümler değildir.
3. Yalnız henüz tamamlanmamış bölüm devam ettirilebilir, kaybedilmişse yeniden denenebilir. Sonuç ekranında kazanınca **sonraki tamamlanmamış bölüm** açılır; hepsi tamamlanınca kampanya sonu/bahçe ekranı açılır.
4. Öğreticiler T1/T2 **yeniden ödül vermeden tekrar oynanabilir**; ilk gerçek T2 kazanımında ayrı, tek seferlik 20 Altın başlangıç hediyesi vardır. Öğreticiyi atlamak yıldız, Altın veya güçlendirici vermez.
5. Başarısızlık, yeniden deneme, ipucu, animasyon, oyun kapa/aç ve bölümü sıfırlama Altın/yıldız/kampanya hediyesi üretmez.
6. Üretim ana bölüm ilerlemesi geri alınamaz. Mevcut “bütün ilerlemeyi sıfırla” ekranı tamamlanmış ana bölümleri yeniden oynatabilecek durumda bırakılmamalı; yalnız açık/bitmemiş oyun, tercihler ve test verileri için kapsamı açıkça ayrıştırılmalı. Tam veri silme yalnız açık uyarılı **tam kullanıcı verisi silme** gibi farklı bir işlem olabilir; sıradan reset çift ödül yaratamaz. Test laboratuvarı normal profil/ödül erişiminden izole kalır.
7. Tamamlamalar kampanya+kalıcı sayısal Level ID ile anahtarlanır. Variant, Attempt, seed, tarih ve kayıt sürümü değişirse yeni hak doğmaz. 10 ana bölüm varsa en fazla 10 yıldız ve 200 Altın ilk-bitiş kazancı vardır; gelecekte yeni bölümler ayrı Level ID alır.

## 2. Üç ayrı kaynak

| Kaynak | Kazanım | Harcama/işlev | Politika |
| --- | --- | --- | --- |
| Altın | Her yeni ana bölümün ilk bitişinde +20 | Güçlendirici ve +5 hamle, gelecekte kozmetik | Negatif olmaz, transaction ledger tekil; TEST Altınla karıştırılmaz |
| Yıldız | Her yeni ana bölümün ilk bitişinde +1 | Harcanmaz, satılmaz; botanik dünyadaki görsel eşikleri açar | Kalıcı tamamlama sayacı; hiçbir ödeme/ad/replay yıldız üretmez |
| Güçlendirici envanteri | Bölüm 3'ün ilk bitişinde 3 Yeşil Fırça; bölüm 6'nın ilk bitişinde 3 Renk Anahtarı | Oyun sırasında açık onayla tekil kullanım | Hediye bir kez; kalan adet kayıtlıdır; harcama tekil ve geri yüklenebilir |

**Pilot fiyat adayları:** Yeşil Fırça 70 Altın, Renk Anahtarı 90 Altın, +5 hamle kurtarması 140 Altın. Bunlar ticari olarak doğrulanmış fiyatlar değildir. Yeni profil 0 Altınla başlar. İlk gerçek T2 kazanımı 20 Altın başlangıç hediyesi verir; tekrar ödülü veya günlük Altın farmı **yok**. Mevcut 300 **TEST Altın** cüzdanı yeni gerçek/oyun Altınına otomatik dönüştürülmez. Prototipte yeni ürünler de açıkça test ürünleridir; gerçek ödeme yok.

**Yıldız/botanik eşik taslağı:** 2 yıldız çiçekler, 5 yıldız bitkiler, 8 yıldız ağaçlar, 10 yıldız bütün bahçe. Bir kere açılan görsel her zaman açık kalır; yıldıza ödeme kapısı kurulmaz.

## 3. İlk güçlendiriciler

### Yeşil Fırça

- İlk üç adet **3. ana bölümün kazanılmasından sonra** envantere verilir. Bölüm 4'ten itibaren kullanılabilir.
- Bir kullanım: seçilen **tek zeminin** kalan katını bir azaltır. İki katlı yerde 2→1 olur; 1→0 olur.
- Taşı yok etmez, taşın rakamını/değerini değiştirmez; normal eşleşme puanı ve RNG üretmez; hamle tüketmez. Bir hedefte kat kalmıyorsa işlem reddedilir ve envanter eksilmez.
- Son zemin tamamlanırken puan hedefi zaten sağlanmışsa oyun bu işlemle kazanılabilir. İşlem motorun güncel kazanma durumunu tekrar doğrular.
- Bir oyun denemesinde en fazla bir fırça kullanım sınırı pilot adayıdır; ihtiyaç/denge ölçülüp değiştirilebilir.

### Renk Anahtarı

- İlk üç adet **6. ana bölümün kazanılmasından sonra** envantere verilir; bölüm 7'den itibaren kullanılabilir.
- UI semantiği ve deterministik hedef/renk seçimi ayrı bir tasarım/uygulama alt PR'ında kesinleştirilir; kullanım kayda geçmeli ve JS/C# aynı sonucu üretmelidir. Kullanıcı seçimini açıkça görmeden envanter eksiltilmez.
- **Önemli:** Sırf ikinci güçlendiriciyi hemen göstermek için geçici, sonucu belirsiz bir RNG mutasyonu üretime alınmaz. Gerçek renk değiştirme, eşleşme, yerçekimi, ipucu ve replay sözleşmesi doğrulanana dek bu ürün envanterde “yakında” olarak işaretlenebilir; oyun içinde tüketilemez.
- Renk Anahtarı içerik/kuralları netleşince oyuncuya bu özellik düzgün tanıtılır; görünür olmayan bir satın alma çağrısı yapılmaz.

## 4. Başarısızlık ekranında +5 hamle kurtarması

- Ana bölüm son gerçek takasla **kaybedildiğinde**, aynı Attempt ID ile “+5 hamle” teklifi gösterilir. Öğreticilere uygulanmaz.
- Öncelikli CTA “Ödüllü reklam izle → +5 hamle”, alternatif “140 Altın → +5 hamle” ve açık “Yeniden dene” / “Menü” seçenekleridir. Reklam hakkı yoksa, SDK uygun değilse veya reklam yüklenmediyse reklam düğmesi devre dışı olur/açıklanır; uygun Altın seçeneği ve ücretsiz normal yeniden deneme kalır. Sıfır canla ücretsiz yeniden deneme başlatılamıyorsa bekleme seçeneği gösterilir.
- **Deneme başına en çok bir başarılı kurtarma.** Önerilen deneme sürümü için ayrı kurtarma reklamı kotası: UTC günü başına 2; var olan can reklamı kotası (3/gün) ve makbuzları karıştırılmaz. Bu sayılar pilot parametreleridir.
- Tamamlanan / doğrulanmış reklamla veya Altınla aynı denemeye **5 gerçek ek takas hakkı** eklenir; aynı tahta, score, katlar, geçmiş geçerli hamleler, rngState, variantId ve Attempt ID korunur. Kurtarma o deneme için garanti zafer anlamına gelmez.
- Reklam iptal/hata/tekrarlanan callback'de hak kullanılmaz ve 5 hamle verilmez. Altın yetersizse veya atomik kayıt yazımı başarısızsa ücret düşmez/hamle eklenmez.
- İlk kayıpta can daha önce kesildiyse aynı denemede sonradan ikinci kez kesilmez; sonradan kazanma önceki gerçek kesintiyi otomatik iade etmez. Can settlement geçmişi ve kayıtları korunur.
- Dev üretime çıkarken gerçek reklam için doğrulanmış sağlayıcı/receipt kontrolü zorunludur; mevcut lokal maketler gerçek reklam tamamlandı veya mali işlem gibi raporlanmaz.

## 5. Komut geçmişi, kayıt ve C# eşitliği

Mevcut `classic-v4` ve snapshot v4, yalnız geçerli Swap dizisini ve `movesLeft = baseMoves - turn` eşitliğini bilir. +5 hamle ya da fırça kullanımını gizlice `movesLeft` değiştirerek ekleme. **Sürümlü yeni yardım komutu/snapshot zarfı ve açık migrasyon** tasarla (örn. assisted-v1 / commands-v1); eski v4 kayıtları kayıpsız tekrar oynatılabilir kalsın.

Yeni kanonik ilerleme/cüzdan/envanter verisi mevcut atomik `hexrota-profile-v2` mekanizmasına uyumlu veya açık sürümlü güvenli migration ile entegre olacak. Bilinen eski kayıtları sessizce yok etme. Tamamlanan Level ID seti, ilk-haklar, yıldız eşikleri, Altın transferleri, stok, alış/kurtarma ve harcama komutlarının benzersiz kimliği korunacak. Can/testWallet/provider ledger'ları birbirinden ayrılacak. UI, oyun motoru, ekonomi, envanter, yardımcı komut ve analitik tekil authoritative commit sınırında doğru sıralanacak. Yarım kayıtta (crash/commit fail) hiçbiri kısmen uygulanmış sayılmayacak.

**Eski kullanıcı migration:** Mevcut geçerli `saved.done` kampanya tamamlamalarını bir kere `claimedLevelIds` / kalıcı `clearedLevelIds` içine al. Eski doğrulanmış tamamlamalar için tamamlama yıldızı, Altın ve L3/L6 hediyesi **bir kez geriye dönük** tanınabilir; kaynak verisi yetersiz veya bozuksa ödül uydurulmaz, güvenli blokaj/inceleme raporu üretilir. Migration farklı oturum/refresh/reset ile tekrar ödül veremez. T1/T2 ve salt öğretici-skip tamamlamaları kampanya ödülü üretmez. Oyuncuya bir defalık “Geçmiş başarıların eklendi” özeti gösterilebilir.

**Ödül teslim sırası:** Önce tamamlama + geçerli bölüm + daha önce alınmamış Level ID denetimi; sonra oyun, can, Altın, yıldız, stok ve kalıcı Level ID hakları **aynı atomik commit**; ancak başarılı commit ardından kazanma animasyonu / sonuç ekranı / analitik olay. Failing save hiçbir kazanımı veya completed durumunu kısmen bırakmaz. Duplicate callback, sayfa yenileme, iki sekme ve eski completed-stage DOM seçimi yeni altın üretemez.

Yeni C# 9.3 `GameSessionController`, LifeManager, Catalog ve kayıt katmanı ile JS tarafı aynı komut dizilerinde parity testinden geçmeli. `RewardDirector` yalnız sunumu etkiler; ekonomi, skor ve RNG'yi değiştirmez.

## 6. UI / harita davranışı

- Ana oyun menüsünde ve oynanabilir yolculuk listesinde tamamlanmış ana bölüm kartı ya da butonu **hiç üretilmez**. Önceden açılmış diyalog/sekme/klavye kısayolu da aynı korumayı uygular.
- İlerleme çubuğu tamamlanan sayısını gösterebilir; botanik dünyada önceki tamamlama dekorasyonu olabilir ama “Bölüm X tekrar oyna” çağrısı bulunmaz.
- Kazanma sonucunda tam **bir** kez “+20 Altın / +1 Yıldız” ve uygun seviye hediyesi göster. Tarihsel migration yeniden sonuç pop-up'ı üretmez. Bir sonraki oynanabilir **tamamlanmamış** bölüme ilerle; finalde “Bahçeni gör” ve “Yeni bölümler yakında”.
- Başarısızlıkta gerçek eksik hedef(ler)i göster, reklam/Altın +5 hamle seçeneklerini sun ama mağazayı/reklamı otomatik başlatma.
- Öğreticiler ihtiyaç halinde yeniden açıklanır; alınmış başlangıç hediyesi tekrar verilmez. Tamamlanmış kampanya bölümleri için “yeniden oyna” düğmesi veya sonuç CTA'sı yok.
- Yardımlı/yardımsız başarı işaretlenir; önceden sertifikalı ücretsiz kazanma yolu hesapları eski kurallarla korunur.
- Tahta kaydırması, taşların iki yönde görünür hareketi, sabit tahta boyutu, kaldırılmış “Animasyonu geç” butonu/alt açıklama şeridi korunur.

## 7. Geliştirme sırası ve PR'lar

1. **PR12A — Tek seferlik ilerleme, migration, Altın/yıldız/stok, UI ve JS/C# parity.** 10 bölüm oynanabilir listesinden bitenleri gizle; hiçbir replay ödülü yok.
2. **PR12B — Yeşil Fırça'nın gerçek sürümlü komut geçmişi, stok harcama, sonuç ve replay testleri.**
3. **PR12C — Başarısızlık sonrası doğrulanmış +5 hamle kurtarması (TEST ad, Altın, aynı attempt / life settlement).**
4. **PR12D — Renk Anahtarı seçiminin ürün/teknik tasarımı, gerçek JS/C# uygulaması ve pilot kullanımı.**
5. **Integration PR — Hepsini tek dalda birleştir, bütün eski 11+Balance Lab CI kontrollerini koru; üretim bölüm verilerini değiştirme.**

**PR #11 (Balance Lab) şu an ayrı, birleştirilmemiş bir analiz PR'ıdır.** Yeni özellik dalı `main` tabanlı tutulabilir; PR #11 birleştiğinde yeniden güncelle/entegre et. Test laboratuvarı profil, envanter, Altın veya yıldız üretmemeli. Hiçbir dal kullanıcının açık onayı olmadan `main` ile birleşmez.

## 8. Kabul ve güvenlik kapıları

- 10 kampanya bölümü: en fazla 10 yıldız ve 200 Altın ilk-bitiş; her biri ayrı Level ID üzerinden idempotent. Ayrı tek seferlik başlangıç hediyesiyle toplam kaynak 220 Altın, yıldız tavanı yine 10 olur.
- L3 +3 Yeşil Fırça ve L6 +3 Renk Anahtarı sadece tek sefer.
- Tamamlanmış ana bölümler UI ve komut düzeyinde tekrar oynatılamaz; sonraki yeni bölüme geçilir.
- Kayıp, restart, tekrar gönderilmiş işlem, refresh, retry, ödül görseli ve tarihsel migration çift ödül üretmez.
- Reklam durumu tamamlama makbuzu doğrulanmadan 5 hamle üretmez; iptal/başarısız/tekrar callback güvenli.
- Sıfır canla eski açık denemeye devam edilebilir; aynı attempt'te ikinci can harcanmaz.
- Botanik yıldızları satın alınamaz, satılamaz, harcanamaz.
- Eski oyun / can / cüzdan / snapshot / attempt / event / PWA kayıtları ve aynı 40 varyant / 80 rota korunur.
- Bütün JS/C# parite testleri, mevcut 11 CI işi, Lab'in ayrı kontrolleri ve mobil Chromium/WebKit regresyonları geçer. Fiziksel iPhone/Unity/IL2CPP testleri ayrıca gerekir.
- Gerçek para, gerçek reklam SDK veya adil olmayan gizli hamle/taş üretim manipülasyonu ilk sürümün dışında.

## 9. İlgili dosyalar

- `docs/PRODUCT_ROADMAP_2026.md` (PR #11 dalında; bu dalda henüz bulunmayabilir)
- `docs/ECONOMY_DESIGN.md` (eski tekrar ödülü önerisi bu karar ile **geçersiz**)
- `docs/LIVES_DESIGN.md`
- `docs/CSHARP_APPLICATION.md`
- `docs/BALANCE_LAB_9_4.md` (PR #11)
- `dist/app.js`, `dist/engine.js`, `dist/attempts.js`, `dist/lives.js`, `dist/session-store.js`
- `unity/Application/`, `unity/Gameplay/`, `unity/Lives/`

**Önemli:** Fiyatlar, stok kullanım sınırları ve reklam kotası pilot çalışma varsayımlarıdır; onaylanmış ticari fiyat/oyuncu tutma tahmini değildir.
