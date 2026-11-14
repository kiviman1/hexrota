# Uygulama sonuç raporu — 9.0.0

## 1. Tamamlanan çalışma

Aşama A'da `61f1af0` referansı ve geçen başlangıç kontrolleri kaydedildi. Aşama B'de 40 doğrulanmış başlangıç, sürümlü deneme kimlikleri, gerçek geçmişle kayıt doğrulaması ve yeni varyantla yeniden deneme uygulandı. Aşama C'de dört bot politikası ve yapılandırılmış zorluk dalgalanması ölçüldü. Aşama D'de yalnızca ekonomi tasarımı/verisi hazırlandı. Aşama E'de Unity veri dışa aktarımları, aktarım sözleşmeleri ve ortak oyun vektörleri tamamlandı.

İki öğreticinin ve 10 orijinal bölümün kaynak dosyaları birebir korunuyor. Temel eşleşme, puanlama, üretim, düşüş, RNG, zincir ve snapshot v4 kuralları değişmedi. Motor değişikliği ipucunda çoklu rota, arama kaynağı/garantisi ve düğüm bütçesidir.

Yeni oyun seçimi kayıttan devam etmeden ayrılır. Kayıptan sonra yeni varyant, oyun ortasında onaylı yeni varyant; ön izlemede değişiklik yoktur. Eski kayıtlar `legacy-original / original-v1` ile, yeni kayıtlar kendi kimlikleriyle tekrar oynatılır. Bilinmeyen kimlik veya eksik veri sessizce başka tahta açmaz; kayıt korunur. Ödül sunumu puanı değiştirmez. Yerel olay katmanı dışarı veri göndermez.

## 2. Değişen dosyalar

Referans commit'e göre tam liste:

- `README.md`
- `balance-report.json`
- `balance-variants.cjs`
- `check-attempt-ui.cjs`
- `check-attempts.cjs`
- `check-events.cjs`
- `check-game-shell.cjs`
- `check-gameplay-vectors.cjs`
- `check-input.cjs`
- `check-menu.cjs`
- `check-onboarding.cjs`
- `check-pwa.cjs`
- `check-reward-ui.cjs`
- `check-score.cjs`
- `check-ui.cjs`
- `check-variants.cjs`
- `data/economy-design.json`
- `data/levels-original.json`
- `data/tutorials-fixed.json`
- `dist/app.js`
- `dist/attempts.js`
- `dist/difficulty-rules.json`
- `dist/engine.js`
- `dist/events.js`
- `dist/hint-worker.js`
- `dist/index.html`
- `dist/reward-adapter.js`
- `dist/sw.js`
- `dist/variants-data.js`
- `dist/variants.json`
- `docs/ANALYTICS.md`
- `docs/BASELINE.md`
- `docs/ECONOMY_DESIGN.md`
- `docs/IMPLEMENTATION_REPORT.md`
- `docs/LEVEL_DESIGN.md`
- `docs/UNITY_MIGRATION_PLAN.md`
- `export-game-config.cjs`
- `fixtures/gameplay-vectors.json`
- `generate-gameplay-vectors.cjs`
- `generate-levels.cjs`
- `generate-variants.cjs`
- `lib/level-analysis.cjs`
- `package-lock.json`
- `package.json`
- `qa-fixtures.cjs`
- `recheck-legacy-balance.cjs`
- `reports/baseline-balance.json`
- `reports/baseline.json`
- `reports/legacy-policy-recheck.json`
- `reports/validation.json`
- `reports/variant-generation.json`

## 3–4. Varyant sayıları ve ölçülen ritim

Her bölümde **4 varyant**, her varyantta farklı ilk hamlelerden **2 kazanma yolu** vardır. Toplam **40 başlangıç / 80 yol**. Tahta koordinatları, tek/çift kat yerleri, hamle bütçeleri, hedefler ve üretim paletleri değiştirilmedi. Seçici ve üretici 8/16 ve fazlasına açıktır; mevcut kimlikler aynı veri sürümünde değiştirilemez.

Aşağıdaki oranlar insan başarısı değildir. Her varyant/model 64 kez ölçülür. Endeks yüksekse ilgili ağırlıklı bot modeline göre daha zordur.

| Bölüm | Rol | Varyant | Hamle | Hedef | Açgözlü % | Alan % | Planlama % | Endeks |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Çok kolay | 4 | 10 | 85 | 96.1 | 96.9 | 100.0 | 2.6 |
| 2 | Kolay | 4 | 10 | 110 | 81.2 | 75.0 | 100.0 | 16.9 |
| 3 | Orta | 4 | 9 | 135 | 60.5 | 44.1 | 100.0 | 37.0 |
| 4 | Orta-zor | 4 | 9 | 110 | 69.1 | 3.9 | 100.0 | 52.5 |
| 5 | Meydan okuma | 4 | 8 | 125 | 4.7 | 0.0 | 100.0 | 73.6 |
| 6 | Rahatlama | 4 | 8 | 160 | 73.4 | 86.3 | 100.0 | 14.1 |
| 7 | Orta | 4 | 8 | 215 | 7.4 | 58.6 | 100.0 | 46.4 |
| 8 | Zor | 4 | 8 | 170 | 0.0 | 2.7 | 100.0 | 73.8 |
| 9 | Rahatlama | 4 | 12 | 265 | 19.1 | 100.0 | 100.0 | 24.3 |
| 10 | Final | 4 | 14 | 280 | 0.0 | 0.4 | 96.5 | 75.7 |

Rastgele politika dahil bütün ölçümler `balance-report.json`; tanım, ağırlıklar ve kabul sınırları `LEVEL_DESIGN.md` içindedir. 6 ve 9'da rahatlama, finalde önceki iki zirveden daha yüksek model zorluğu doğrulandı. Eski rapordaki %0/%100 değerleri orijinal politika ve tohumlarla aynen yeniden üretildi; bunlar botun tekrar ettiği tercihler ve alan darboğazlarıyla açıklanıyor.

## 5. Gerçekte geçen testler

- Birleşik `npm test`: geçti. 40 başlangıç, 80 yol, 600 kayıt geri yükleme noktası; 600 doğrulanmış ipucu öneki, 40 rota dışı durum; eski 12 bölüm akışı, eski sürümden taşıma, menü/giriş/animasyon/PWA/ödül ve yeni deneme/olay kontrolleri dahil.
- `npm run test:unity-rewards`: geçti; C# 7.3/.NET SDK 8.0.428 ile 104 ortak vektör ve durum fabrikası gerçekten derlenip karşılaştırıldı (98 geçerli, 7 reddedilen değerlendirme).
- Güncel denge raporu: 10.240 varyant denemesi + 2.560 orijinal tahta denemesi tekrar hesaplandı. Eski 100 rastgele/30 açgözlü politika ölçümleri de yeniden üretildi.
- Ortak oyun vektörleri: 71 örnek, 162 geçerli takas, 56 kayıt devamı, 80 seçim, 9 reddetme. JS sonuçları doğrulandı; C# oyun motoru çalıştırılmış değildir.
- Gerçek Chromium: 390×664, 320×568 ve 568×320; dokunma, gerçek Worker, tam/azaltılmış animasyon, duraklatmada yeniden başlatma iptali/onayı, kayıp sonrası yeni varyant, kayıt/RNG devamı ve hata sayısı 0. Bunlar fiziksel iPhone/Android testleri değildir.
- JSON dışa aktarımları ve tasarım verisi, değişmeyen öğretici/orijinal kaynak özetleri, `git diff --check`: geçti.

Nihai doğrulamada başarısız kalan test yoktur. Yapılmayanlar: fiziksel cihaz testi, insan dengeleme deneyi, C# gameplay port/parity, Unity sahnesi/mobil paket, gerçek ödeme veya reklam entegrasyonu.

## 6. Önemli riskler

1. **İnsan zorluğu hâlâ ölçülmeli.** Planlama ve diğer amaç odaklı botlar gerçek RNG'yi kopyalayıp gelecek taşları bilir. 5/8'de tek adımlık başarı çok düşükken planlamanın %100 olması insanda anlaşılır strateji kanıtı değildir. 9 özellikle alanı izleyen oyunda rahatlatıcıdır; puan odaklı oynayana aynı rahatlığı vermeyebilir.
2. **Dört başlangıç sınırlı içeriktir.** Tekrarı azaltır, sonsuz içerik veya kişiye özel denge değildir. Yeni varyantlar aynı kapılardan geçirilmelidir.
3. **Sürüm arşivi zorunludur.** Gelecekte hedef/bütçe/koordinat değişirse yalnızca varyant JSON arşivi yetmez; eski temel tanımların sürümlü arşivi gerekir.
4. **Yerel kayıt/ölçüm mali güvenlik değildir.** Tarayıcı verisi temizlenebilir veya değiştirilebilir; 500 olaylık tampon bütün geçmiş değildir. Gerçek ekonomi ayrı işlem günlüğü, geri yükleme ve doğrulama tasarımı gerektirir.
5. **Güçlendiriciler yeni kural sözleşmesidir.** Mevcut v4 yalnızca takas geçmişi doğrular. Tek taş temizleme veya ek hamle, ödeme arayüzünden ibaret olamaz. Reward Director v1 de takas dışı tek hücre olayını sahte üçlü olarak almamalıdır.

## 7. Unity öncesi ortak kararlar

- İnsan denemesinden sonra 5/8/9'un zorluk hedefleri ve ipucunun ne kadar yönlendirici olacağı.
- İlk ticari sürümde yalnızca kozmetik mi, yoksa sınırlı kurtarma yardımları mı bulunacağı; Altın fiyat/kazanım önerilerinin kalibrasyonu.
- Tek taş temizlemenin alan/puan/hamle davranışı; sayı yenileme ve başlangıç yardımının gerçekten gerekli olup olmadığı.
- Yardım komutları için yeni kayıt/kural ve takas dışı ödül sözleşmesi; cüzdan, çevrimdışı mali güven, hakları geri yükleme ve sıfırlama politikası.
- Nullable alanları/iç içe dizileri/kimlik türlerini koruyan Unity JSON adaptörü ve C# çekirdek portunun kabul takvimi.

Eşleştirme, puanlama, üretim ve kayıt devamı yeniden tasarlanacak açık seçimler değildir; mevcut sözleşmeler ve test vektörleri portun referansıdır. Ekonomi önerileri `design_only`; prototip onları yüklemez. İlgili ayrıntılar `ECONOMY_DESIGN.md`, `UNITY_MIGRATION_PLAN.md` ve `ANALYTICS.md` içindedir.
