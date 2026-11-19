# Hexrota ana ekran katmanları

`Assets/Hexrota/Resources/CastleHome/CastleHome.prefab` içindeki `MenuLayout/Environment` katmanları Unity Prefab Mode veya Inspector üzerinden düzenlenebilir.

Arka plan `art/HomeBackground` katmanlarından kurulur (kaynak klasör git dışıdır; içe aktarılan PNG'ler `Assets/Hexrota/Art/HomeBackground/` altındadır). Çizim sırası:

- `Background`: gökyüzü (`sky.png`). `CastleHomeBackdrop` ekranı en-boy oranını koruyarak doldurur (cover).
- `Background/ArtFrame`: gökyüzüyle aynı kırpmaya oturan çerçeve (`HomeBackgroundLayers`). Alt nesneler kaynak görselin piksel koordinatlarıyla çapalıdır:
  - `Clouds/Cloud1..3`: gökyüzü bandında yatay kayan bulutlar. Hızlar `MotionTheme.cloudDriftSpeeds`; azaltılmış harekette durur.
  - `Ground`: çayır, ağaç, şelale ve toprak arsa (`ground.png`).
  - `CoopPlot`: toprak arsa ve kümes. `PlotCoop` (pivotu zemin noktası) içinde `CoopVisual` (`CoopSpriteView`): seviye 0'da temel `Coop_L0`, seviye 1–4'te `Coop_L1..L4` sprite'ı; altında yumuşak mor blob gölge (`Shadow`). Bütün seviyelerin pivotu taban diskinin alt-ortasıdır, böylece aynı noktada dururlar; disk genişliği arsa genişliğinin seviyeye göre %55–84'ü olduğu için kümes büyür ama arsadan taşmaz. `Dust` (`CoopDustBurst`) yükseltme geçişindeki toz bulutudur. Arsaya dokunmak (`CoopTapArea`) yükseltme panelini açar. Eski 2D kümes çizimi ve kazıklar `RetiredPlaceholders` altında gizli durur. Sakinler (`CoopResidents`) arsada.
  - Sprite'lar: `art/coop-2d/cut_sprites.py` (`uv run art/coop-2d/cut_sprites.py`) `art/coop-2d/source/Coop_L0..L4.png` (git dışı) görsellerini düz zeminden keser, haleyi temizler, kırpar ve pivotu `Art/Coop2D/coop_sprites.json`'a yazar; toz ve gölge sprite'larını da üretir.
- Eski kale sahnesi katmanları (`FarClouds`, `FarIslands`, `Waterfalls`, `Ground`, `Foreground`, `Coop` çizimi), `MenuLayout/Brand` amblemi, yan raylar (`SideActions`) ve avatar altındaki yumurta hapı (`TopBar/EggWallet`) prefab'da gizli durur. Altın Yumurta sayısı kümes ilerleme çubuğunun içinde "mevcut/maliyet" olarak yazar; ödül uçuşunda yumurtalar çubuğa iner.
- Alt menü (`BottomNav`): Mağaza · Ana · Alanlar. Bölüm 5 tamamlanana kadar gizlidir; gizliyken Oyna düğmesi ve çubuk aşağı iner. Yolculuk, Kayıtlar ve Bahçe düğmeleri gizli (sayfaları duruyor); Alanlar şimdilik "Yakında" penceresi açar.
- `PlayArea/PlayButton/BrassGlints`: düğmenin kenarında dolaşan, dokunmaları yakalamayan parıltılar.

Yeniden kurma sırası: `Hexrota > Home > Rebuild Background Layers` → `Rebuild Coop Controls` (kümes sprite'larının içe aktarma ayarlarını ve pivotlarını da kurar; ayrıca `Reimport Coop Sprites`) → `Rebuild Coop Upgrade Sequence` → `Rebuild Home Menu`. Inspector üzerinden yapılan özel düzenlemeler bu komutlarla yeniden yazılabilir.

`Art/Chicken3D`, `Art/Tavik3D` ve `Art/Castle3D` içindeki FBX dosyaları Blender kaynaklarından üretilmiş **prototiplerdir**; aktif 2.5D ana ekrana yerleştirilmemiştir. Tavuk ve Tavik FBX'lerinde Idle, Walk ve Flap klipleri bulunur. Üretim kalitesinde doku, yüz animasyonu, diğer karakter hareketleri ve mobil cihaz profil testleri tamamlanmış değildir.

Görsel üretim istemleri: `castle-home-layered-environment-prompts.md`, `castle-layer-image-prompts.md`, `castle-home-castle-layer-candidates.md` ve `castle-home-characters-foreground-prompts.md`.
