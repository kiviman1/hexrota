# Referans durum — Aşama A

Referans commit: `61f1af01f4166b00dbf610f91b69459c0340fbad` (2026-11-14), uygulama 8.3.1. Makinece okunabilir kayıt ve dosya özetleri: `reports/baseline.json`. Eski zorluk raporu değiştirilmeden `reports/baseline-balance.json` içinde saklandı.

## Çalıştırılan kontroller

- `NODE_PATH=/workspace/scratch/hexrota-qa/node_modules npm test`: başarılı. Bu çalışma ortamındaki hazır geliştirme bağımlılıkları kullanıldı; temiz kurulumda `npm ci` ardından `npm test` çalıştırılır.
- `npm run test:unity-rewards`: başarılı. .NET SDK 8.0.428 ile C# 7.3 derlendi; 104 ortak vektör ve durum fabrikası, 98 geçerli / 7 reddedilen değerlendirme karşılaştırıldı.

Bu kayıt başlangıç sürümünün sonucudur; sonraki sürümün test sonucu yerine kullanılamaz.

## Mimari ve değişmezler

Saf JavaScript `HexMatch` motoru DOM veya kayıt servisine bağlı değildir. Üç eşleşme yönü, komşu takası, eşleşen değerlerin bir kez toplanması, hücrede kalan zemin katları, q sütunlarında düşüş, eşleşmeyi azaltan kontrollü üretim, doğal zincir ve hamlesiz tahta karıştırması klasik kurallardır. Tam bir zincir tek hamle harcar. Kazanma puan ve alan koşullarının birlikte tamamlanmasıdır; son hamlede kazanma, hamle bittiği için kaybetmeden önce değerlendirilir.

Motor snapshot sürümü 4 / `classic-v4`; kayıt anahtarı `hexrota-match-v5`. Snapshot, gerçek hamlelerin başlangıçtan tekrar oynatılmasıyla doğrulanır. İki öğreticinin sayısal verileri ve ilk 10 bölümün orijinal tanımları eski kayıtlar için referanstır. Ödül yöneticisi motor puanını değiştirmez; C# karşılığı yalnızca ödül alanındadır.

Çalışma zamanı üretim bağımlılığı yoktur. `jsdom` 31.0.1 yalnızca geliştirme/test bağımlılığıdır. Web uygulamasının giriş, sunum, ses ve kayıt bağlantıları `dist/app.js` içindedir; bu servisler motorun dışında tutulur.

## Eski dengeleme yönteminin sınırları

Eski rapor bölüm başına 100 rastgele geçerli hamle oyunu ve 30 tek hamlelik alan ağırlıklı açgözlü oyun içerir. Açgözlü tercihte rastgelelik yalnızca eşit değerli seçeneklerde kullanılır; aynı tahta ve kararsızlık yoksa tekrarlanan denemeler aynı rotayı izleyebilir. Dolayısıyla %0/%100 insan başarısı veya geniş bir oyuncu davranışı örneklemi değildir.

Bölüm 6 ve 9 için bu politika %0, bölüm 8 için %100 raporlanmıştır. Tek çözümden türetilen geç bölüm bütçeleri ve yalnızca erken bölümlerde uygulanan minimum açgözlü başarı koşulu, planlanan rahatlama/zorluk sırasını güvenceye almıyordu. Yeni analiz aynı orijinalleri dört ayrı davranışla karşılaştırmalı; yeni varyantların kabulü ayrıca denetlenmelidir.
