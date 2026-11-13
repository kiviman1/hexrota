# Hexrota — ödül ve oyun hissi yöneticisi

Bu sürüm, geçerli bir hamlenin başarısını görsel, ses ve isteğe bağlı titreşimle karşılar. Puan, hedefler, hamle bütçesi, kontrollü taş üretimi ve `classic-v4` kayıt kuralları aynı oyun motorunda kalır. Ödül yöneticisi bir puan çarpanı üretmez.

## Kurallar

| Gerçek olay | Ham geri bildirim seviyesi |
| --- | ---: |
| Sıradan üçlü | 0 |
| Aynı çizgide 4 / 5 / 6+ taş | 1 / 2 / 3 |
| 2. / 3–4. / 5+ zincir dalgası | 1 / 2 / 3 |
| Bir hücrede kesişen 2 / 3 eksen | 2 / 3 |
| Aynı dalgada ayrı eşleşmeler | 1 |
| En az 4 ve tahtanın en az %20'si kadar yeni yeşil alan | 1 |
| Aynı dalgada en az 2 çift zeminin tamamlanması | 2 |
| Puan veya zemin hedefinin tamamlanması | 2 |
| Bölümün bitmesi; son hamlede bitiş için ayrı metin/ses | 3 |

Bir dalgadaki seviyeler toplanmaz; en güçlü gerçek olay seçilir. Altı eşleşen hücre iki ayrı üçlü olabilir: uzun eşleşme kararı toplam hücre sayısından değil, gerçek kesintisiz çizgiden çıkarılır. Kesişim de aynı hücreden geçen eşleşmiş eksenlerle ölçülür.

Bir geçerli hamlede en fazla bir ana başlık çıkar. Önce bölüm bitişi, sonra tamamlanan hedef, sonra en güçlü eşleşme başarısı değerlendirilir. Eşit seviyelerde kesişim, zincir, uzun çizgi ve zemin olayları belirli bir sırayla seçilir.

Seviye 3 vurgular arasında iki geçerli hamle bulunur. Bu aralıkta gelen başarının doğru adı korunur; görsel yoğunluk seviye 2 ile sınırlanır. Tamamlanan hedefler ve bölüm bitişi bu sınırlamayı aşabilir. Öğreticilerde sıradan efektler en fazla seviye 1 olur.

Puanın %50/%100; zeminin %25/%50/%75/%100 eşikleri takip edilir. Tek hamlede geçilen bütün eşikler işaretlenir, her hedef için yalnızca en yüksek yeni eşik sunulur. Kısmi ilerleme küçük bir gösterge vurgusudur; her eşikte ayrı büyük başlık açılmaz.

## Sunum

Seviye, toplamın patlama boyutunu, halka ve parçacık sayısını, ses motifini ve isteğe bağlı titreşimi seçer. Kullanıcının onayladığı takas, düşüş, toplanma, bekleme ve uçuş süreleri korunur. Büyük efektlerin toplam ses kazancı yükselmez; motif ve perde değişir. Ses/titreşim tercihleri, azaltılmış hareket ve uygulamanın görünürlüğü uygulanır.

Uzun zincirlerde gösterilmeyen dalgalar son gösterilen toplamda birleştirilir. Kayıtlar animasyondan önce doğru oyun sonucunu saklar. Atla, sıfırla, menü, arka plan veya ekran değişimi eski efektleri iptal eder. Geç kalan bir animasyon yeni tahtaya puan ya da ödül ekleyemez.

## Taşınabilirlik

- `dist/reward-rules.json`: Tek kaynak olan sayısal kurallar; sürüm 1.
- `dist/reward-rules.js`: JSON'dan üretilen tarayıcı sarmalayıcısı.
- `dist/rewards.js`: DOM, saat ve rastgelelik kullanmayan saf karar motoru.
- `dist/reward-adapter.js`: Oyun dalgalarını ortak veri sözleşmesine çevirir; geçmişi sessizce tekrar oynatarak ödül durumunu kurar.
- `unity/Rewards/`: Aynı kararların C# 7.3 karşılığı ve Unity'ye ekleme açıklaması.
- `fixtures/reward-vectors.json`: İki dilde aynı sonucu vermesi gereken ortak örnekler.

C# kodu Unity nesnelerine bağlı değildir. Kurallar `TextAsset` üzerinden `JsonUtility.FromJson<RewardRules>` ile okunabilir. Unity sunum katmanı, dönen olay kimliği ve sayısal yoğunluk değerlerinden animasyon, ses ve haptik çağrılarını üretir. Metinler arayüzde yerelleştirilir; karar motoru `labelKey` döndürür.

`evaluate` her geçerli hamlede bir kez çağrılır. Çıktı `{nextState, plan}` olur. Durum, oyun motorunun sıkı checkpoint'inden ayrıdır. Eski veya tekrarlanan hamle yeni olay döndürmez; sırası atlanan hamle reddedilir. Kayıt yüklerken planlar sessizce yeniden kurulur, eski kutlamalar oynatılmaz.

## Kontroller ve ayarlama

```sh
npm run rewards:sync
npm test
npm run test:unity-rewards
```

Son komut .NET 8 SDK ister; gerekirse `DOTNET_PATH` ile kullanıcı dizinindeki `dotnet` yolu verilir. Test, C# kaynaklarını 7.3 dil sürümüyle geçici dizinde derler ve tüm ortak JSON sonuçlarını karşılaştırır. Bu doğrulama Unity/iOS uygulama derlemesinin yerine geçmez.

Kurallar değişirse sarmalayıcıyı ve ortak vektörleri bilinçli olarak yeniden üretin; beklenen olayları inceleyip test edin. İlk eşikler yazılmış bölüm çözümleriyle kontrol edildi. Oyuncularda hangi yoğunluk ve tekrar aralığının daha iyi hissettirdiği gerçek oynama denemeleriyle ayarlanmalıdır.
