# Öğretici kümes yapımı

Başlangıç: `main` `09568dc`. Dal: `feature/tutorial-coop-build-flow`. Bu çalışma eski yıldız temelli kümes görünümünü iki öğreticide tamamlanan üç sahneyle değiştirir. Motor, profil/snapshot sürümleri, ekonomi ve C# kuralları değişmez.

## Oyuncu akışı

| Kesinleşmiş durum | Görünüm | Öğretici kartı |
| --- | --- | --- |
| T1 başlamadan / T1 sürerken | `foundation.jpg` | T1'de **Tahta 0/3 → 3/3** |
| T1 kazanıldı / T2 sürerken | `frame.jpg` | T2'de **Çivi 0/4 → 4/4** |
| T2 sonrası / kampanya | `finished.jpg` | Kampanyada malzeme sayacı yok |

Sayaçlar gerçek öğreticinin **kaydedilmiş tur sayısından** türetilen hikâye sunumudur. Yeni toplanabilir taş, envanter öğesi veya kazanma hedefi oluşturmazlar. Kampanya yıldızları sahneyi değiştirmez. Öğreticiyi tekrar oynamak tamamlanmış kümesi geriye almaz. Mevcut Atla, iki öğreticiyi tamamlanmış işaretleyince üçüncü görünüm açılır; Atla hoş geldin ödülü vermez. İlk gerçek T2 kazanımındaki tekil **20 Altın**, önde çıkan Altın ve dönen ışık korunur.

## Veri ve kayıt sınırı

- `data/scene-config-v1.json` dosya adı korunur; içindeki **sunum şeması v2**, `tutorial-coop-build-flow` kimliğini taşır. `node sync-scene-config.cjs` JSON/JS dağıtım çıktılarını üretir. Yeni profil veya snapshot biçimi yoktur.
- `stageForTutorials(config,completedTutorialCount)` yalnız 0–2 kesinleşmiş öğretici sayısını kullanır. `tutorialCounter(config,levelId,turn)` tür duyarlı `learn-1` / `learn-2` kimlikleriyle Tahta/Çivi bilgisini döndürür; sayısal kampanya kimliklerinde `null` verir.
- `app.js` projeksiyonu başarılı atomik commit sonucundan günceller. Sayaç, kaydedilmiş checkpoint ve etkin denemenin **aynı Attempt ID** olması halinde ilerler. Kayıt hatası eski geçerli projeksiyona döner; taslak hamle ve kazanım sahne/sayaç olarak görünmez.
- Eski seyrek kayıtta T2'ye ulaşılmış olması en az bir öğretici; kampanyaya ulaşılmış olması iki öğretici olarak yalnız görünümde yorumlanır. `done`, ödül hakları veya Altın bu çıkarımla yazılmaz.
- Görsel decode, poz bitişi, tepki, tekrar callback veya pencere kapanışı kalıcı ilerleme/ödül üretmez. Gerçek SVG tahta, kaydırma, iki yönlü üst taş katmanı ve tahta/HUD geometrisi korunur.

## Varlık ve yaşam döngüsü

Yeni kaynaklar `dist/assets/scenes/tutorial-coop-v1/backgrounds/` altında byte olarak korunmuş üç JPEG'dir: her biri **720×1280**, toplam **794.105 byte**. Manifest `data/tutorial-scene-assets-v1.json`; doğrulayıcı `scripts/check-tutorial-scene-assets.cjs`. Tüm ekran yönlerinde aynı portre dosyaları kullanılır. Yalnız kırpma/konumlandırma değişir; eski yatay arka planlara geçilmez.

Tavik `assets/scenes/coop-v1/` altındaki mevcut poz/hareket adaptörünü kullanır; eski paketin **39 hash / 12 hareket** sözleşmesi değişmez. Yeniden çizim veya yeni karakter üretimi yoktur. 140 ms kısa kararma hizalı olmayan sahneler arasında tahta altında çalışır. Azaltılmış hareket, güvenli yerleşim/dar öğretici araç çubuğu, modal/sekme duraklatması, gecikmiş yanıt koruması ve temizleme korunur. BFCache için mevcut `pageshow.persisted → reload` / tek-yazıcı sahipliği politikası sürer.

**PWA v37**, foundation JPEG'i ve mevcut idle pozunu isteğe bağlı ısıtır: **276.693 byte**. Diğer görseller ihtiyaçla yüklenir ve tipi doğrulanarak önbelleğe alınır. İleri sahne çevrimdışı yoksa foundation/statik renk ve onaylı portre fallback'i gerçek oyunu erişilebilir bırakır. Kaynak PNG ve bağımsız örnek tahta yüklenmez.

## Doğrulama durumu

Aşağıdaki sonuçlar bu dalda gerçekten çalıştırılmış son yerel koşumlardır; önceki PR sonuçlarından devralınmaz.

| Kontrol | Bu dalın sonucu |
| --- | --- |
| `node check-scene-presentation.cjs` | **21/21 geçti**: sayaçlar, tür duyarlı kimlikler, yıldızdan bağımsızlık, replay, yön değişimi, yarış/temizlik/fallback |
| `node sync-scene-config.cjs --check` | Geçti |
| `node scripts/check-scene-assets.cjs` | **39 hash / 12 hareket geçti** |
| `node scripts/check-tutorial-scene-assets.cjs` | **3 JPEG / 24 olumsuz senaryo geçti** |
| PWA kontrolleri | **18/18 geçti** |
| Gerçek Chromium / WebKit öğretici ve mobil kontrolleri | **Chromium 26/26, WebKit 26/26 geçti**; mevcut arayüz kontrolleri iki tarayıcıda **63/63**. Ayrı CSS denetimleri 24 geometri ve 28 öğretici geri bildirim durumu için boyut/çakışma korumasını geçti |
| Tam `npm test` ve mevcut regresyon zinciri | **`npm test` exit 0**; mevcut mobil giriş, takas pikseli, hediye/sıfırlama, ekonomi/bahçe ve atomik kayıt komutları ayrıca çalıştırılır; son tam zincir PR CI kontrollerinde |
| Gerçek .NET C# karşılaştırmaları | **10/10 mevcut komut geçti**, gerçek .NET SDK 8.0.428 / C# 7.3 derlemesi: gameplay, rewards, catalog, lives, hints, reward-adapter, session, economy, commands, rescue |
| GitHub Actions / PR | Mevcut **15 CI işi korunur**; son commit sonucu PR kontrollerinde raporlanır |
| Vercel Preview | PR’ın Vercel Preview bağlantısında paylaşılır; Production yapılandırması değiştirilmez |
| Fiziksel iPhone / Android, Unity / IL2CPP | Yapılmadı; otomatik tarayıcı ve .NET sonuçları yerine geçmez |

Önceki entegrasyon geçmişi [IMPLEMENTATION_REPORT_SCENE_PHASE1.md](IMPLEMENTATION_REPORT_SCENE_PHASE1.md) içinde saklanır. Güncel mimari [ARCHITECTURE.md](ARCHITECTURE.md), ayrıntılı öğretici akışı [FIRST_PLAY_FLOW.md](FIRST_PLAY_FLOW.md) içindedir.

Küçük sonuç dosyaları: `reports/tutorial-coop-chromium.json` ve `reports/tutorial-coop-webkit.json`. Tam ekran görüntüleri/ağ izleri CI artifact’larında tutulur. Ana bölümün yıldız kazanması yalnız mevcut bahçe/ekonomi görünümünü etkiler; bu kümes için 2/5/10 yıldız tablosu artık kullanılmaz.
