# Hexrota ana ekran katmanları

`Assets/Hexrota/Resources/CastleHome/CastleHome.prefab` içindeki `MenuLayout/Environment` katmanları Unity Prefab Mode veya Inspector üzerinden düzenlenebilir.

- `Background`: güneşli gökyüzü.
- `FarClouds`: birbirinden bağımsız ve farklı hızlarda hareket eden bulutlar.
- `FarIslands`: uzak adalar ve köprü.
- `Waterfalls`: ayrı şelale sprite'ları ve `WaterFlow` UI shader'ı.
- `Ground`: çimen ve taş yol.
- `Coop`: sol kule, merkez kule, sağ kule ve ön gövde ayrı Image katmanlarıdır. İki direk, iki kumaş ve karakterler alt nesnelerdir. Sadece kumaşlarda `CastleHomeFlagCloth` bulunur; şato mesh'i deforme edilmez.
- `Foreground`: çiçek ve çit katmanları.
- `PlayArea/PlayButton/BrassGlints`: düğmenin kenarında dolaşan, dokunmaları yakalamayan parıltılar.

`CastleHomeSpriteAnchor`, direkleri, bayrakları ve karakterleri şatonun gerçek sprite sınırlarına bağlar. Hareket bileşenleri yalnız kendi katmanlarını değiştirir. Referanstaki kule duvarı ve çatıları ayrı ayrı kullanmak için ek görsel denemeler `Art/CastleHome/LayerCandidates/FineSplit` içindedir; bunlar birebir hizalanmadıkları için etkin kompozisyonda kullanılmaz.

`Hexrota > Home > Rebuild Independent Home Layers`, yukarıdaki üretilmiş katman gruplarını ve konumlarını kaynak değerlere sıfırlayarak prefabı yeniden oluşturur. Inspector üzerinden yaptığınız özel düzenlemeler bu komutla yeniden yazılabilir.

`Art/Chicken3D`, `Art/Tavik3D` ve `Art/Castle3D` içindeki FBX dosyaları Blender kaynaklarından üretilmiş **prototiplerdir**; aktif 2.5D ana ekrana yerleştirilmemiştir. Tavuk ve Tavik FBX'lerinde Idle, Walk ve Flap klipleri bulunur. Üretim kalitesinde doku, yüz animasyonu, diğer karakter hareketleri ve mobil cihaz profil testleri tamamlanmış değildir.

Görsel üretim istemleri: `castle-home-layered-environment-prompts.md`, `castle-layer-image-prompts.md`, `castle-home-castle-layer-candidates.md` ve `castle-home-characters-foreground-prompts.md`.
