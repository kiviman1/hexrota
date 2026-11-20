# Hexrota — ana ekran ve görsel yön: devir notu

Bu dosya claude.ai'de yapılan tasarım çalışmasının özetidir (19 Kasım 2026). Claude Code bu klasördeki dosyaları **tek doğru kaynak** olarak kullanır. Oyunun adı ve bütün görseller geçicidir; kurallar kalıcıdır.

## 1. Amaç

Ana ekranı Royal Match / Royal Kingdom / Playrix seviyesinde profesyonel hale getirmek: canlı, "dopamin pompalayan" ama derli toplu. Oyuncu ana ekranda az vakit geçirir; ilk izlenim ve her dönüşte "bir şeyin değiştiğini görmek" önemli.

## 2. Alınan kararlar

**Kapsam: rakipler kadar sade.** Liderlerin hepsi tek döngü kullanıyor; biz de öyle yapıyoruz.

- **Tek ilerleme döngüsü:** bölüm oyna → **Altın Yumurta** kazan → **kümesi** büyüt.
- **Üç kaynak, dördüncüsü yok:**
  - Can: zamanla dolar.
  - Altın: bölüm kazanınca az az + satın alma. Yalnız +5 hamle ve güçlendiricilere harcanır.
  - Altın Yumurta: yalnız bölüm kazanımıyla gelir, yalnız kümese harcanır, **parayla satılmaz**. Eski "yıldız"ın yerini alır.
- **Çıkışta YOK (sonraya park):** tavuk satın alma/koleksiyon mağazası, tavuk yumurtası satışı, sepet, kalıcı malzeme envanteri, takım, çoklu etkinlik.
- **Malzemeler** (Tahta, Çivi… 9.14 sistemi) yalnız **bölüm içi hedef** olarak kalır, envantere girmez. Yükseltme animasyonunda kullanılıyor gibi görünür.
- **Tavuklar satın alınmaz, kümesle gelir.** Bazı yükseltmeler yeni bir sakin getirir; bazıları mevcut sakini büyütür (civciv → piliç → tavuk). Bir alanda en fazla 6–8 sakin.
- **Alan yapısı (2000+ bölüm için):** Her kümes bir "alan"dır, ~5 yükseltme ve ~40–60 bölüm sürer. Alan bitince Tavik yeni yere taşır (değirmen, sahil, dağ çiftliği, kale avlusu…). Eski alanlar alt menüdeki **Alanlar** sekmesinden ziyaret edilir. Çıkışta 3–4 alan yeter.
- **Görsel teknik:** arka plan 2D katmanlar; **kümes, tavuklar ve Tavik gerçek zamanlı 3D** (toon, kontursuz); arayüz 2D 9-slice sprite.
- **Render hattı:** URP'ye geçiş önerildi (henüz yapılmadı). 3D materyal üretiminden **önce** yapılmalı.
- `Packages/manifest.json` içinde `com.unity.modules.animation` yok. Animator için eklenmeli.

## 3. Klasör içeriği

| Yol | Ne |
|---|---|
| `style-guide/README.md` | Stil kılavuzu: ilkeler, dünya/arayüz ayrımı, ışık, kontur, renk anlamları, tipografi, kaynaklar, ana ekran yerleşimi, alanlar |
| `style-guide/tokens.json` | Bütün renk, yazı, boşluk, köşe, kontur, gölge değerleri (tek kaynak) |
| `style-guide/3d-sanat.md` | 3D sanat şartnamesi: kamera, toon ışık, palet dokusu, bütçeler, tavuk iskelet standardı, animasyon listesi, Blender → Unity kuralları |
| `style-guide/hareket.md` | Hareket şartnamesi: dikkat bütçesi, eğriler/süreler, ekran sekansları (ilk açılış, dönüş, kazanma dönüşü, yükseltme), dokunma tepkileri |
| `style-guide/components/` | 7 bileşen kalıbı (PlayButton, Button, CurrencyPill, Panel, HexBadge, ProgressBar, ChickenCard). `preview.html` dosyaları tarayıcıda açılır |
| `wireframe/` | Ana ekranın 3 hali (390×844): `NewPlayer.html`, `Main.html` (oyun ortası), `WinReturn.html` (kazanma dönüşü). Tarayıcıda açılır |
| `rakip-analizi.md` | Royal Match, Royal Kingdom, Playrix, Peak, King ana ekran analizi |
| `tasks/` | Codex için yazılan görevler ve PR incelemeleri |

## 4. Önemli kurallar (kısa)

- **Tek kahraman, tek eylem.** Ekranda renkli/parlak tek birincil düğme: Oyna (`cta` yeşili).
- **Aynı anda tek dikkat animasyonu.** Öncelik: ödül uçuşu > kümes yükseltmesi > kümes nabzı > Oyna parlaması > rozet.
- **Ödül her zaman yolculuk yapar:** kazanılan kaynak sayacına uçar, harcanan kaynak sayaçtan hedefe uçar.
- **Arayüz konturu** dolgunun koyu tonudur, asla siyah değil. Dünya sanatında kontur yok. Gradyan yok; derinliği parlama bandı + alt bevel verir.
- Mor panel (`panel`) + altın kurdele + krem bilgi kartı + tek ana düğme = bütün diyaloglar.
- **Altıgen imza şekildir:** rozetler, çerçeveler.
- Fontlar: **Lilita One** (başlık/düğme/rakam, beyaz + koyu kontur), **Nunito 700/800** (metin).
- Süre ve renkler kodda sabit yazılmaz: `UiTheme` ve `MotionTheme` ScriptableObject'lerinden okunur.

## 5. Ana ekran yerleşimi (portrait)

1. Üst bar (~%9): profil · Can · Altın · Altın Yumurta
2. Kahraman sahne (~%55): kümes ortada, sakinler önünde dolaşır, Tavik yanında
3. Yan raylar: her yanda en fazla 3 ikon, fazlası "+" grubunda; ilk oturumda yok
4. Kümes düğmesi (sol alt) + üstünde ilerleme çubuğu ("Sonraki yükseltme 8 / 12")
5. Oyna (alt orta, ekranın ~%54'ü, "Bölüm N")
6. Alt menü: Mağaza · Alanlar · **Ana** · Takım · Etkinlik (Takım Bölüm 20'de, Etkinlik 15'te, menü 5'te açılır)

Yeni oyuncuda yalnız Can, Altın, Tavik, boş arsa ve Oyna görünür.

## 6. Repo durumu

- Unity çalışma dalı: `codex/unity-first-chapter-coach` (katmanlı animasyonlu kale ana ekranı, son commit `dc94656`).
- **PR #45** (`codex/home-play-button-reward-flight` → `codex/unity-first-chapter-coach`, commit `e190183`): Oyna düğmesi, `AttentionDirector`, `RewardFlight`, `UiTheme`/`MotionTheme`. İncelendi, iki düzeltme bekliyor: `tasks/02-pr45-inceleme.md`.
- Repodaki 3D prototipler bütçenin üstünde: tavuk 5.888 üçgen (hedef ≤3.000), Tavik 12.840 (hedef ≤6.000), kale modülleri 86 ayrı nesne.
- Unity tarafında `Stars` hâlâ "yıldız"; Altın Yumurta'ya yeniden adlandırma ayrı bir görev.

## 7. Sıradaki adımlar

1. PR #45 düzeltmeleri → birleştir. Görsel kontrol: `Home-Reward.png` / ekran kaydı stil kılavuzuyla karşılaştırılmalı. Titreşim fiziksel cihazda denenmeli.
2. URP'ye geçiş + animation modülü (3D'den önce).
3. Kümes düğmesi + ilerleme çubuğu + yükseltme paneli + yükseltme sekansı (`hareket.md` §6-D).
4. `Stars` → Altın Yumurta yeniden adlandırma (sunum + kayıt göçü).
5. Üst bar ve paneller stil kılavuzuna (`Panel`, `CurrencyPill`).
6. 3D tavuk iskelet standardı ve ilk alanın kümes seviyeleri (`3d-sanat.md`).
7. Ekonomi dengesi: tavuklardan gelir yok; altın akışı +5 hamleyi önemsizleştirmemeli.
   - İlk alan maliyetleri şimdilik 10 bölümlük içeriğe göre; bölüm sayısı artınca artan eğriye çekilecek (ör. 2/6/10/14/18). Şu anki değerler `CoopConfig.asset`: 4 yükseltme, her biri bir kümes sprite seviyesi (Coop_L1..Coop_L4); maliyet 1/2/3/4 (toplam 10 yumurta), tavuk gelişi 1/1/2/2 (toplam 6). Seviye 0'da temel sprite'ı (Coop_L0) görünür.
