# Hexrota ana ekran katmanları

`Assets/Hexrota/Resources/CastleHome/CastleHome.prefab` içindeki `MenuLayout/Environment` katmanları Unity Prefab Mode veya Inspector üzerinden düzenlenebilir.

Arka plan `art/HomeBackground` katmanlarından kurulur (kaynak klasör git dışıdır; içe aktarılan PNG'ler `Assets/Hexrota/Art/HomeBackground/` altındadır). Çizim sırası:

- `Background`: gökyüzü (`sky.png`). `CastleHomeBackdrop` ekranı en-boy oranını koruyarak doldurur (cover).
- `Background/ArtFrame`: gökyüzüyle aynı kırpmaya oturan çerçeve (`HomeBackgroundLayers`). Alt nesneler kaynak görselin piksel koordinatlarıyla çapalıdır:
  - `Clouds/Cloud1..3`: gökyüzü bandında yatay kayan bulutlar. Hızlar `MotionTheme.cloudDriftSpeeds`; azaltılmış harekette durur.
  - `Ground`: çayır, ağaç, şelale ve toprak arsa (`ground.png`).
  - `CoopPlot`: toprak arsa ve 3D kümes. `Coop3D` (RawImage + `CoopModelView`) kümesi kendi kamerasıyla bir render texture'a çizer; böylece kümes arka planın önünde, arayüzün arkasında durur. Seviye 0'da temel (`CP_L0`), seviye 1–4'te `CP_L1..CP_L4` görünür; altında yumuşak blob gölge vardır, kamera ~30° yukarıdan bakar. `CoopGround` modelin zemin merkezinin oturduğu noktadır. `PlotCoop` kümesin arayüz hedefidir: yumurtalar ona uçar, yükseltme darbesi ve hazır nabzı onu ölçekler, 3D model bu ölçeği kopyalar. Arsaya dokunmak (`CoopTapArea`) yükseltme panelini açar. Sakinler (`CoopResidents`) şimdilik 2D.
  - Modeller: `art/coop-3d/process_tripo.py` (Blender, headless) Tripo GLB'lerinden (`art/coop-3d/source/`, git dışı) `Art/3D/Coop/CP_L0..CP_L4.fbx` üretir; rapor `art/coop-3d/report.md`. Işık dokuda pişmiş olduğu için `Hexrota/Unlit Baked` shader'ı kullanılır (URP'ye geçişte URP Unlit ile değişir).
- Eski kale sahnesi katmanları (`FarClouds`, `FarIslands`, `Waterfalls`, `Ground`, `Foreground`, `Coop` çizimi), `MenuLayout/Brand` amblemi, yan raylar (`SideActions`) ve avatar altındaki yumurta hapı (`TopBar/EggWallet`) prefab'da gizli durur. Altın Yumurta sayısı kümes ilerleme çubuğunun içinde "mevcut/maliyet" olarak yazar; ödül uçuşunda yumurtalar çubuğa iner.
- Alt menü (`BottomNav`): Mağaza · Ana · Alanlar. Bölüm 5 tamamlanana kadar gizlidir; gizliyken Oyna düğmesi ve çubuk aşağı iner. Yolculuk, Kayıtlar ve Bahçe düğmeleri gizli (sayfaları duruyor); Alanlar şimdilik "Yakında" penceresi açar.
- `PlayArea/PlayButton/BrassGlints`: düğmenin kenarında dolaşan, dokunmaları yakalamayan parıltılar.

Yeniden kurma sırası: `Hexrota > Home > Rebuild Background Layers` → `Rebuild Coop Controls` (3D kümes modellerinin içe aktarma ayarlarını ve malzemelerini de kurar; ayrıca `Reimport 3D Coop Models`) → `Rebuild Coop Upgrade Sequence` → `Rebuild Home Menu`. Inspector üzerinden yapılan özel düzenlemeler bu komutlarla yeniden yazılabilir.

`Art/Chicken3D`, `Art/Tavik3D` ve `Art/Castle3D` içindeki FBX dosyaları Blender kaynaklarından üretilmiş **prototiplerdir**; aktif 2.5D ana ekrana yerleştirilmemiştir. Tavuk ve Tavik FBX'lerinde Idle, Walk ve Flap klipleri bulunur. Üretim kalitesinde doku, yüz animasyonu, diğer karakter hareketleri ve mobil cihaz profil testleri tamamlanmış değildir.

Görsel üretim istemleri: `castle-home-layered-environment-prompts.md`, `castle-layer-image-prompts.md`, `castle-home-castle-layer-candidates.md` ve `castle-home-characters-foreground-prompts.md`.
