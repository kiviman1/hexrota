# Panel

Bütün diyalogların ortak kalıbı: mor gövde, altın kurdele başlık, krem bilgi kartı ve altta tek ana düğme.

- Gövde `panel` + `panel-deep` kontur + `shadow-panel` kalınlığı. Köşe `radius-l`.
- Başlık kurdelesi gövdenin üst kenarına taşar; metin `display-l`/26px, en fazla iki kelime.
- Kapat: sağ üst köşede, gövdeden taşan kırmızı daire. Her panelde aynı yerde.
- İçerik sırası: krem kart (ne oluyor) → mor çukur (sayılar) → düğme (ne yapacağım). Üç bloktan fazlası yeni bir ekran demektir.
- Giriş: 0.25 sn ölçek 0.85 → 1.05 → 1; arka plan %50 karartma. Çıkış daha hızlı (0.15 sn).
- Unity: gövde, kurdele ve kapat düğmesi 9-slice sprite; mevcut "Ayarlar/Canlar/Bir plan daha?" pencereleri bu kalıba taşınır.
