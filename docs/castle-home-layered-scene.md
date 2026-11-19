# Hexrota ana ekran katmanları

`Assets/Hexrota/Resources/CastleHome/CastleHome.prefab` içindeki `MenuLayout/Environment` katmanları Unity Prefab Mode veya Inspector üzerinden düzenlenebilir.

Arka plan `art/HomeBackground` katmanlarından kurulur (kaynak klasör git dışıdır; içe aktarılan PNG'ler `Assets/Hexrota/Art/HomeBackground/` altındadır). Çizim sırası:

- `Background`: gökyüzü (`sky.png`). `CastleHomeBackdrop` ekranı en-boy oranını koruyarak doldurur (cover).
- `Background/ArtFrame`: gökyüzüyle aynı kırpmaya oturan çerçeve (`HomeBackgroundLayers`). Alt nesneler kaynak görselin piksel koordinatlarıyla çapalıdır:
  - `Clouds/Cloud1..3`: gökyüzü bandında yatay kayan bulutlar. Hızlar `MotionTheme.cloudDriftSpeeds`; azaltılmış harekette durur.
  - `Ground`: çayır, ağaç, şelale ve toprak arsa (`ground.png`).
  - `CoopPlot`: toprak arsa. 3D kümes buraya bağlanacak. Şimdilik içinde geçici 2D kümes (`PlotCoop`, dokununca yükseltme paneli açılır, hazırken nabız atar) ve sakinler (`CoopResidents`) var.
- Eski kale sahnesi katmanları (`FarClouds`, `FarIslands`, `Waterfalls`, `Ground`, `Foreground`, `Coop` çizimi) ve `MenuLayout/Brand` amblemi prefab'da gizli durur.
- `PlayArea/PlayButton/BrassGlints`: düğmenin kenarında dolaşan, dokunmaları yakalamayan parıltılar.

Yeniden kurma sırası: `Hexrota > Home > Rebuild Background Layers` → `Rebuild Coop Controls` → `Rebuild Coop Upgrade Sequence`. Inspector üzerinden yapılan özel düzenlemeler bu komutlarla yeniden yazılabilir.

`Art/Chicken3D`, `Art/Tavik3D` ve `Art/Castle3D` içindeki FBX dosyaları Blender kaynaklarından üretilmiş **prototiplerdir**; aktif 2.5D ana ekrana yerleştirilmemiştir. Tavuk ve Tavik FBX'lerinde Idle, Walk ve Flap klipleri bulunur. Üretim kalitesinde doku, yüz animasyonu, diğer karakter hareketleri ve mobil cihaz profil testleri tamamlanmış değildir.

Görsel üretim istemleri: `castle-home-layered-environment-prompts.md`, `castle-layer-image-prompts.md`, `castle-home-castle-layer-candidates.md` ve `castle-home-characters-foreground-prompts.md`.
