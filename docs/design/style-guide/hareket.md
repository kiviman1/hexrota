# Hareket şartnamesi

Ana ekran canlı ama sakin olmalı. Hareket üç işe yarar: **nereye bakacağını söylemek**, **ödülü hissettirmek** ve **dokunuşa cevap vermek**. Bu üçüne hizmet etmeyen hareket eklenmez.

> Süreler başlangıç değeridir; cihazda oynanarak ayarlanır. Bütün süreler 60 fps varsayımıyla ve saniye cinsindendir.

## 1. Dikkat bütçesi

Ekranda aynı anda **tek bir dikkat animasyonu** oynar. Yüksek öncelikli olan başlayınca düşük olan durur, bitince kaldığı yerden devam eder.

| Öncelik | Animasyon | Ne zaman |
|---|---|---|
| 1 | Kaynak uçuşu | Ödül sayaca giderken |
| 2 | Yükseltme sekansı | Kümes büyürken |
| 3 | Kümes düğmesi nabzı | Yükseltme hazırken |
| 4 | Oyna parlaması | Başka bir şey yokken |
| 5 | Rozet sallanması | Toplanacak bir şey varken |

**Ortam hareketleri** (bulut, bayrak, şelale, tavukların boşta durması) bu bütçeye girmez. Her zaman oynar ama düşük genlikte kalır.

## 2. Ortak eğriler ve süreler

| Ad | Süre | Eğri | Kullanım |
|---|---|---|---|
| `tap` | 0.08 | ease-out | Düğmeye basma (4px aşağı) |
| `release` | 0.18 | back-out (overshoot 1.6) | Düğmeyi bırakma |
| `pop-in` | 0.30 | back-out (overshoot 1.7) | Panel, rozet, yeni obje belirmesi |
| `pop-out` | 0.15 | ease-in | Kapanış (girişten hızlı) |
| `fly` | 0.55–0.75 | ease-in-out + yay | Kaynak uçuşu |
| `punch` | 0.20 | elastic-out, ölçek 1.15 | Sayaç ikonu her varışta |
| `fill` | 0.40 | ease-out | İlerleme çubuğu |
| `breathe` | 2.4 döngü | sine | Oyna nefesi (%3) |

Doğrusal (linear) eğri yalnız sürekli dönen veya akan şeylerde kullanılır (şelale, bulut).

## 3. Ortam döngüleri

| Öğe | Hareket | Genlik / hız |
|---|---|---|
| Bulutlar | Yatay kayma, katman başına farklı hız | 4–12 px/sn |
| Bayrak | Kumaş dalgası (mevcut `CastleHomeFlagCloth`) | Düşük |
| Şelale | Doku akışı | Sürekli |
| Tavuklar | Idle döngüsü + 3–6 sn'de bir Blink | Her tavuk rastgele fazda |
| Kümes | Hareketsiz; yalnız dokunulunca tepki verir | — |

**Periyodik vuruş:** 4–6 saniyede bir tek bir olay olur. Rastgele bir tavuk Peck, Hop veya kısa Walk yapar; ya da Oyna parlar. İkisi aynı anda olmaz, aynı tavuk iki kez üst üste seçilmez.

## 4. Oyna düğmesi

- **Nefes:** ölçek 1.00 ↔ 1.03, 2.4 sn döngü. Panel açıkken durur.
- **Parlama:** 4 sn'de bir, beyaz eğik bant soldan sağa 0.6 sn'de geçer.
- **Boşta kalma:** oyuncu 8 sn dokunmazsa tek bir zıplama (y +6px, `release`).
- **Basma:** `tap` + bırakınca `release`, ardından bölüm öncesi paneli `pop-in` ile açılır.
- **Ses:** basınca kısa, tok "tık". Panel açılınca hafif "vuş".

## 5. Kaynak uçuşu

Kazanılan her kaynak **geldiği yerden sayacına uçar**. Rakam sayacın içinde sayarak artar.

- **Adet:** Gösterilen ikon sayısı gerçek miktarla aynı olmak zorunda değil. 1–5 kaynakta her biri için bir ikon; daha fazlasında en çok 8 ikon uçar, son ikon kalan farkı taşır.
- **Yol:** Düz çizgi değil, hafif yay (kontrol noktası yolun ortasından 60–120px yana). Her ikon biraz farklı yay alır.
- **Sıralama:** İkonlar 0.06 sn arayla kalkar. Her biri 0.55–0.75 sn'de varır, ilk 0.1 sn'de 0.6 → 1.1 ölçeklenip çıkar.
- **Varış:** Sayaç ikonu her varışta `punch` yapar. Rakam her varışta kendi payı kadar artar. Son varışta küçük parıltı patlar.
- **Ses:** Her varışta artan perdede tek nota (do-re-mi hissi); son varışta biraz daha uzun bir "çın".
- **Titreşim:** Yalnız son varışta hafif tık (destekleyen cihazlarda, ayarlardan kapatılabilir).

## 6. Ekran sekansları

### A. Yeni oyuncu: ilk açılış

| t (sn) | Olay |
|---|---|
| 0.0 | Ekran açılır, arka plan katmanları yerinde |
| 0.2 | Tavik arsaya zıplayarak gelir (Hop) |
| 0.8 | Konuşma balonu `pop-in`: "Buraya bir kümes kuralım!" |
| 1.4 | Oyna düğmesi aşağıdan kayarak gelir, `release` ile oturur |
| 2.0 | Oyna nefesi başlar; balon 4 sn sonra `pop-out` |

Başka hiçbir şey hareket etmez; ilk izlenim tek bir yöne bakar.

### B. Oyun ortası: geri dönüş (normal giriş)

| t | Olay |
|---|---|
| 0.0 | Sahne hazır, tavuklar Idle'da |
| 0.1 | Üst bar yukarıdan, alt menü aşağıdan 0.25 sn'de kayar |
| 0.3 | Yan ray ikonları 0.04 sn arayla `pop-in` |
| 0.6 | Oyna yerinde `pop-in`, sonra nefes başlar |

Toplam 1 sn'nin altında. Ayrı bir "dokun ve başla" ekranı yok.

### C. Kazanma dönüşü (dopamin anı)

| t | Olay | Öncelik |
|---|---|---|
| 0.0 | Bölüm ekranından ana ekrana geçiş; tavuklar Celebrate | — |
| 0.3 | Altın Yumurtalar ekranın alt ortasından üst bardaki sayaca uçar | 1 |
| ~1.2 | Altın sikkeler aynı şekilde Altın sayacına uçar | 1 |
| ~2.0 | İlerleme çubuğu `fill` ile dolar; sayı "8 / 12 → 12 / 12" sayar | — |
| 2.4 | Dolduysa: çubukta "Hazır!", kırmızı altıgen rozet `pop-in` | — |
| 2.6 | Kümes düğmesi nabız başlar (ölçek 1 ↔ 1.08, 0.9 sn döngü, altın halka) | 3 |
| — | Oyna parlaması durur; nefes devam eder | — |

Çubuk dolmadıysa sekans 2.0'da biter, Oyna parlaması geri gelir.

### D. Kümes yükseltmesi

| t | Olay |
|---|---|
| 0.0 | Kümes düğmesine dokunma → yükseltme paneli `pop-in` |
| — | Oyuncu "Kur"a basar; panel `pop-out` |
| 0.2 | Kamera kümese 0.5 sn'de hafifçe yaklaşır (%10) |
| 0.5 | Altın Yumurtalar sayaçtan kümese uçar (ters yön uçuş) |
| 1.1 | Eski parça toz bulutunda 0.25 sn'de küçülür |
| 1.3 | Yeni parça 0 → 1.1 → 1 ölçekle `pop-in`; tahta/kiremit parçacıkları saçılır |
| 1.6 | Tavuklar Flap; yeni sakin geldiyse Arrive, büyüyen varsa Grow |
| 2.4 | Kamera geri çekilir; ilerleme çubuğu yeni hedefle sıfırdan başlar |
| 2.8 | Alan tamamlandıysa: Tavik "Yeni bir yere gidiyoruz!" balonu → alan geçişi |

Sesler: uçuş notaları → toz "puf" → yapı "tak-tak-tak" (3 vuruş) → büyük "ta-da".

## 7. Dokunma tepkileri

Ekrandaki her büyük obje dokunuşa cevap verir; cevapsız dokunuş ölü hissettirir.

| Hedef | Tepki | Süre |
|---|---|---|
| Kümes | Ölçek 1 → 0.96 → 1.03 → 1 jöle sallanma | 0.35 |
| Tavuk | Surprised / Flap / Hop / Peck'ten biri, tekrarsız | klip süresi |
| Tavik | Kısa replik balonu (3–4 cümleden biri) | 2.5 |
| Bulut | Hafif savrulma | 0.4 |
| Kilitli sekme | Yatay titreme + "Bölüm 20'de açılır" balonu | 0.3 |

Tekrarlayan dokunuşa (1 sn'de 3+) tavuk kaçar (Hop ile 1 adım uzaklaşır); küçük bir sürpriz.

## 8. Paneller

- **Açılış:** arka plan 0.2 sn'de %50 kararır; panel `pop-in` (0.85 → 1.05 → 1).
- **Kapanış:** `pop-out` (1 → 0.9, saydamlık 0), karartma 0.15 sn'de kalkar.
- Panel içinde ödül varsa panel oturduktan 0.1 sn sonra ödül ikonları sırayla `pop-in`.
- Panel açıkken sahne ortam hareketleri sürer, dikkat animasyonları durur.

## 9. Azaltılmış hareket

Ayarlarda "azaltılmış hareket" seçiliyse veya cihaz bunu istiyorsa:
- Nefes, parlama, nabız ve kamera yakınlaşması kapanır.
- Kaynak uçuşu tek ikonla 0.3 sn'lik düz geçişe iner.
- Ortam döngüleri yarı hıza iner; dokunma tepkileri kalır.

## 10. Unity uygulama notları

- Süre ve eğri değerleri tek bir `MotionTheme` ScriptableObject'te tutulur; kod sabit sayı içermez.
- **Dikkat bütçesi** tek bir yöneticiden geçer. Her dikkat animasyonu öncelikle "izin ister"; düşük öncelikli olan bekletilir.
- Uçuş ikonları önceden oluşturulmuş bir havuzdan (pool) gelir; her kazanımda yeni nesne yaratılmaz.
- Sesler animasyon olaylarına bağlanır, zamanlayıcıya değil; animasyon atlanırsa ses de atlanır.
- Mevcut `CastleHomeLayerMotion`, `CastleHomeFlagCloth` ve `CastleHomeBrassGlints` ortam katmanında kalır; bu şartnameye göre genlikleri gözden geçirilir.
