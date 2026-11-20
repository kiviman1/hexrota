# 3D sanat şartnamesi

Ana ekranın orta planı **gerçek zamanlı 3D**: kümes, tavuklar ve Tavik Unity'de canlı modeller olarak çalışır. Arka plan (gök, adalar, şelale) 2D boyalı katmanlarda kalır. Arayüz 2D sprite'tır. Bu sayfa Blender'da üretilecek her şeyin kuralıdır.

> Sayısal bütçeler başlangıç hedefidir. İlk gerçek cihaz ölçümünden sonra güncellenir.

## Sahne düzeni

| Katman | Teknik | İçerik |
|---|---|---|
| Arka | 2D sprite, paralaks | Gök, bulut, uzak adalar, şelale |
| Orta | 3D, gerçek zamanlı | Kümes, tavuklar, Tavik, yakın dekor (çit, çiçeklik) |
| Ön | 2D arayüz (Canvas) | Üst bar, yan raylar, Oyna, alt navigasyon |

- **Kamera:** sabit perspektif, dar görüş açısı (FOV 25–30°), 20–25° yukarıdan bakış. Sonuç bir "diorama" hissidir: kümes oyuncak gibi masada duruyor.
- Kümes ekranın orta %55'lik kahraman alanını doldurur, alt kenarı Oyna düğmesinin üstünde biter.
- Kamera oyuncu hareket ettirmez. Yalnız olay anlarında kısa, otomatik yakınlaşma olur (yükseltme, yeni tavuk geldi).

## Görünüm ve ışık

- **Stil:** toon / stilize. 2–3 kademeli yumuşak gölge (ramp doku), kenarlarda ince sıcak rim ışık. Gerçekçi PBR yok.
- **Işık:** tek yönlü ışık sol üstten, sıcak krem tonu. Gölge rengi saf gri değil, hafif mor (`panel-deep` tonuna yakın); dünya ile arayüz böylece aynı ailede durur.
- **Kontur yok.** Stil kılavuzunun kuralı: kontur arayüzün, dünya konturlu değil.
- **Renkler** `world-*` tokenlarından gelir: kiremit `world-roof`, tahta `world-wood`, taş `world-stone`, çimen `world-grass`. Hiçbir dünya objesi `cta` yeşilinden daha doygun olamaz; Oyna düğmesi her zaman en parlak şeydir.
- Gölge: karakterlerin altında yumuşak, sahte "blob" gölge (dairesel sprite). Gerçek zamanlı gölge yalnız kümeste, düşük çözünürlükte.

## Materyal ve doku

- **Ortak palet dokusu:** bütün 3D modeller tek bir 256×256 renk paleti dokusunu paylaşır. UV'ler düz renk karelerine yerleştirilir. Böylece model başına tek materyal, toplu çizim (SRP Batcher / instancing) mümkün.
- Ayrıntı gerektiren yüzeyler (taş dokusu, tüy deseni) için model başına en fazla bir adet 512×512 el boyaması doku.
- Tavuk varyantları **yeni doku istemez**: aynı mesh, palet dokusunda farklı renk satırına kayan UV ofseti + aksesuar. Böylece 50 tavuk ≈ 1 doku.

## Bütçeler (mobil, orta seviye cihaz, 60 fps hedef)

| Varlık | Üçgen | Materyal | Kemik |
|---|---|---|---|
| Tavuk (temel) | ≤ 3.000 | 1 | ≤ 16 |
| Tavuk aksesuarı | ≤ 400 | palet | sokete bağlı |
| Tavik | ≤ 6.000 | 1–2 | ≤ 22 |
| Kümes (bir seviye, tüm parçalar) | ≤ 15.000 | ≤ 2 | — |
| Sahnenin toplamı | ≤ 60.000 | — | — |

- Sahne en fazla ~40 çizim çağrısı (draw call). Ekranda aynı anda en fazla 8 tavuk animasyonlu; fazlası uyur veya ekran dışında bekler.
- Kemik başına en fazla 4 etki (influence). Yumuşak ağırlık boyama; parça bazlı sert ağırlık yok.

## Tavuk iskelet standardı

Bütün tavuklar **aynı iskeleti** kullanır; animasyonlar her tavukta çalışır.

```
Root
└─ Hips
   ├─ Spine ─ Neck ─ Head ─┬─ Beak
   │                       ├─ Comb
   │                       ├─ EyelidL / EyelidR
   │                       └─ Socket_Head
   ├─ WingL / WingR
   ├─ Tail
   ├─ LegL ─ FootL
   ├─ LegR ─ FootR
   └─ Socket_Back
```

- `Socket_Head`, `Socket_Back`: şapka, gözlük, sırt çantası gibi aksesuarların bağlanma noktası. Aksesuar ayrı mesh, iskelete deri olarak bağlanmaz.
- Boy referansı: tavuk ayakta 0.35 birim. Kümes ölçeği buna göre kurulur.

## Animasyon listesi

30 fps, yerinde (root motion yok; yürüme yolunu kod verir). Döngülerin ilk ve son karesi eşleşir.

| Klip | Döngü | Ne zaman |
|---|---|---|
| Idle | ✓ | Varsayılan |
| Blink | ek katman | 3–6 sn'de bir rastgele |
| Peck | — | Periyodik vuruş, yem yeme |
| Walk | ✓ | Kümes önünde dolaşma |
| Hop | — | Kısa yer değiştirme, sevinç |
| Flap | — | Dokununca, yükseltmede |
| Surprised | — | Dokunma tepkisi |
| Celebrate | — | Bölüm kazanıp ana ekrana dönünce |
| Sleep | ✓ | Canlar bitince / gece |
| LayEgg | — | Dekoratif periyodik vuruş (yumurta ekonomiye girmez) |
| Arrive | — | Yükseltmeyle yeni sakin alana gelir |
| Grow | — | Civciv → piliç → tavuk geçişi (pop + parıltı) |

Dokunma tepkisi rastgele Surprised / Flap / Hop / Peck'ten biridir, aynı tepki arka arkaya iki kez oynamaz.

## Kümes: modüler yapı

- Her kümes seviyesi ayrı modüllerden kurulur: zemin, gövde, çatı, kuleler, tünek, süs. Pivot her modülün zemin merkezinde, 0.25 birimlik ızgaraya oturur.
- Seviye ilerleyişi siluet değiştirir: **kulübe → kuleli kümes → avlulu kümes → kale**. Her seviye bir öncekinden uzaktan ayırt edilebilir olmalı.
- Yükseltme anı: eski parça toz bulutunda küçülür, yeni parça 0 → 1.1 → 1 ölçekle "pop" yapar, tavuklar Flap oynar. Kamera kısa yakınlaşır.

## Blender → Unity dışa aktarım

- Birim: metre, ölçek 1, dönüş ve ölçek uygulanmış (Apply All Transforms).
- FBX: "Apply Transform" açık, eksenler Unity'ye göre (Y yukarı, Z ileri). Animasyonlar NLA eylemleri olarak ayrı klip.
- Adlandırma:
  - Karakter: `CH_Chicken_Base`, `CH_Tavik`
  - Aksesuar: `AC_Hat_Straw`
  - Kümes modülü: `CP_L2_Roof`, `CP_L2_TowerL`
  - Klip: `Chicken_Idle`, `Chicken_Peck`
- Unity klasörü: `Assets/Hexrota/Art/3D/Characters`, `.../Accessories`, `.../Coop`, `.../Shared` (palet dokusu, ramp, shader).
- Her FBX için bir içe aktarma testi (mevcut `ChickenRigImportTests` kalıbı): üçgen bütçesi, kemik adları, klip listesi.

## İkonlar

Sakin kartı görselleri, para birimi ikonları ve mağaza görselleri aynı 3D modellerden render alınır: ortografik kamera, sol üst ışık, şeffaf zemin. Gerekirse 2D'de son rötuş yapılır. Böylece kartlardaki tavuk ile kümesteki tavuk birebir aynıdır.

## Mevcut prototipler (repo) ve kalan iş

| Varlık | Şu an | Hedefe kalan |
|---|---|---|
| Tavuk rig'i | 5.888 üçgen, 6 kemik, Idle/Walk/Flap, sert ağırlık | Üçgen yarıya; standart iskelet; yumuşak ağırlık; palet UV; 8 klip daha |
| Tavik | 12.840 üçgen, 7 kemik | ≤ 6.000 üçgen; yüz/göz kırpma; atlas |
| Kale modülleri | 86 ayrı nesne, 10.800 üçgen | Modülleri seviye başına birleştir; palet dokusu; 4 seviye silueti |

## Unity proje notları

- Proje şu an yerleşik (Built-in) render hattında; URP paketi yok. Toon shader, SRP Batcher ve mobil performans için **URP'ye geçiş** önerilir. 3D üretim başlamadan yapılmalı ki materyaller iki kez kurulmasın.
- `Packages/manifest.json` içinde `com.unity.modules.animation` yok. Animator ile karakter klipleri çalıştırmak için bu modül eklenmeli.
