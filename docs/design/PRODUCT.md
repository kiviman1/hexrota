# Hexrota — ürün tanımı (tek kaynak)

Son güncelleme: 20 Kasım 2026. Bu dosya oyunun ne olduğunu ve neyin kapsamda olduğunu söyleyen **tek kaynaktır**. Başka bir belge bununla çelişirse bu dosya geçerlidir; çelişen belge düzeltilir ya da `docs/design/archive/` altına taşınır. Uygulama planı ve haftalık işler: [docs/plan/soft-launch-plan.md](../plan/soft-launch-plan.md).

## 1. Oyun

Altıgen tahtada rakamlı taşlarla oynanan bir eşleştirme bulmacası. Oyuncu iki komşu taşı yer değiştirir; eşleşen taşlar patlar, altlarındaki toprak katmanı azalır.

Her bölümün **iki hedefi** vardır ve ikisi de hamle bitmeden tamamlanmalıdır:

1. **Puan hedefi** — eşleşmelerden gelen puan.
2. **Toprak** — tahtadaki bütün toprak katmanları temizlenir.

Engeller: toprak katmanları ve kasa (dayanımı olan engel). Bölüm içi yardımlar **takviye** adını taşır:

| Takviye | Etki |
| --- | --- |
| Yeşil Fırça | Seçili hücreden bir toprak katmanı siler; hamle ve puan harcamaz |
| Renk Anahtarı | Seçili taşı oyuncunun seçtiği başka izinli rakama çevirir |
| +5 hamle (kurtarma) | Hamle bitince bölümü 5 hamleyle sürdürür; Altın ya da ödüllü reklamla |

Asıl tasarım sorusu: oyuncu yüksek puan ile kalan toprağa erişim arasında seçim yapmaktan keyif alıyor mu? Ölçümler bu soruya bağlanır (plan, "Ölçülecekler").

## 2. Tek ilerleme döngüsü

**Bölüm oyna → Altın Yumurta kazan → kümesi büyüt.** Başka ilerleme döngüsü yok.

## 3. Kaynaklar: üç tane, dördüncüsü yok

| Kaynak | Nasıl gelir | Nereye gider |
| --- | --- | --- |
| **Can** | Zamanla dolar; ödüllü reklam | Ana bölüm denemesi (kayıp 1 can) |
| **Altın** | Bölüm ilk kazanımı, günlük ödül ve etkinlikler, satın alma | Takviyeler ve +5 hamle |
| **Altın Yumurta** | **Yalnız** bir bölümün ilk kazanımı (1 yumurta) | **Yalnız** kümes yükseltmesi |

- Altın Yumurta parayla satılmaz; günlük ödül ve etkinlikler yumurta değil Altın ya da takviye verir. Böylece kümes ilerlemesi hep oynamaya bağlı kalır.
- Eski "yıldız" kaldırıldı; yerini Altın Yumurta aldı.
- Tahtadaki malzemeler (Tahta, Çivi… 9.14) yalnız bölüm içi hedeftir, envantere girmez.
- Güncel sayılar `data/economy-config-9-5.json` içindedir. Bilinen sorun: 10 bölümün toplamı 220 Altın, tek kurtarmaya yetiyor. Denge planın 8. haftasında `docs/design/ECONOMY.md` ile tek tabloya toplanacak.

## 4. Kümes ve alanlar

- Her **alan** bir kümestir. Alan başına **4 yükseltme**, maliyet **1 / 2 / 3 / 4 Altın Yumurta (toplam 10)**. Her yükseltme kümesin bir sonraki sprite seviyesini açar (`Coop_L0` temel, `Coop_L1`..`Coop_L4`). Tavuk gelişi 1 / 1 / 2 / 2 (toplam 6).
- Değerler yalnız `unity-client/Assets/Hexrota/Resources/Coop/CoopConfig.asset` içindedir; kodda sayı yazılmaz.
- Tavuklar satın alınmaz, kümesle gelir.
- Alan bitince Tavik oyuncuyu yeni alana taşır. Eski alanlar alt menüdeki **Alanlar** sekmesinden ziyaret edilir.
- Soft launch hedefi: yaklaşık 60 bölüm, 2–3 alan.

## 5. Görsel yön

- **Her şey el boyaması 2D.** 3D model, gerçek zamanlı 3D sahne ve URP geçişi yok. Kümes, tavuklar, Tavik ve arka plan boyanmış 2D sprite/katmandır; arayüz 2D 9-slice sprite'tır.
- Renk, yazı, kontur, panel ve düğme kuralları: [style-guide/README.md](style-guide/README.md), değerler [style-guide/tokens.json](style-guide/tokens.json).
- Hareket ve dikkat bütçesi: [style-guide/hareket.md](style-guide/hareket.md). Aynı anda tek dikkat animasyonu (`AttentionDirector`).
- Süre ve renkler kodda sabit yazılmaz: `UiTheme` / `MotionTheme`.
- Plan dönemi boyunca görsel cila yok (11. hafta hariç). Tek istisna okunabilirlik: büyük taş rakamı, iki hedefin eşit ağırlıkta görünmesi, toprak katmanı ve kasa dayanımı göstergesi.

## 6. Ana ekran

Portrait. Yukarıdan aşağı: üst bar (profil · Can · Altın · Altın Yumurta) → kahraman sahne (kümes ortada, Tavik yanında) → kümes düğmesi + ilerleme çubuğu (sol alt) → **Oyna** ("Bölüm N") → alt menü.

Alt menü: **Mağaza · Alanlar · Ana · Etkinlik**. Takım sekmesi yok. Wireframe'ler ([wireframe/](wireframe/)) yerleşim için geçerlidir; içlerindeki "Takım" sekmesi geçersizdir.

## 7. Kapsam dışı (soft launch'a kadar)

- Takım, lig, sohbet, gerçek zamanlı rekabet
- Aynı anda birden fazla etkinlik, Battle Pass
- Tavuk satın alma, tavuk üretimi, yumurta satışı, sepet, kalıcı malzeme envanteri
- Dekor seçenekleri, karakter animasyon rigleri, 3D sanat
- İlk 100 bölümde yayılan ot, değişen yerçekimi, konveyör, süreli bomba
- Gizli dinamik zorluk ayarı

## 8. Belge haritası

| Belge | Durum |
| --- | --- |
| `docs/design/PRODUCT.md` | Ürün ve kapsam için tek kaynak |
| `docs/design/style-guide/` | Görsel ve hareket kuralları (PRODUCT.md'ye bağlı) |
| `docs/design/wireframe/` | Ana ekran yerleşimi (Takım sekmesi hariç) |
| `docs/design/rakip-analizi.md` | Rakip analizi, bilgi amaçlı |
| `docs/plan/` | Soft launch planı ve haftalık raporlar |
| `docs/design/archive/` | Geçersiz kararlar içeren eski belgeler: 3D şartnamesi, claude.ai devir notları, Codex görevleri |
| `docs/*.md` (kök) | Sürüm bazlı teknik raporlar (9.x). Mimari ve kurallar için geçerli; ürün kapsamında PRODUCT.md ile çelişirse PRODUCT.md geçerli |
