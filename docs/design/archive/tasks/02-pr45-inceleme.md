# PR #45 incelemesi — Oyna düğmesi ve ödül uçuşu

Commit: `e190183` · Dal: `codex/home-play-button-reward-flight` → `codex/unity-first-chapter-coach`

**Sonuç:** Sağlam, görev metniyle uyumlu. İki düzeltmeden sonra birleştirilebilir.

## İyi olanlar

- `AttentionDirector`: öncelik ve askıya alma doğru; panel açıkken parlama/rozet engelli.
- `RewardFlight`: varış sırasına göre dizilmiş paylar; sayaç sonunda cüzdanla birebir aynı; can sayacının saniyelik yenilenmesi uçuş sırasında sayaçların üzerine yazmıyor (`CastleHomeView.ShowWallet` içinde `IsPlaying` kontrolü).
- Notalar yıldızdan altına `pitchStep` ile kesintisiz yükseliyor; klipler önbellekte.
- `Core/` değişmemiş, yeni paket yok, Lilita One OFL lisansıyla eklenmiş.
- Testler istenenlerin hepsini kapsıyor (dağıtım 1/3/5/6/20/1000, dikkat önceliği, azaltılmış hareket ≤ 0.35 sn, uçuşta parlama yok, kesilince sayaç doğru değere dönüyor).

## Düzeltilecekler

1. **`RewardFlight.Cancel` `completed` geri çağrısını düşürüyor.** `Play(..., onComplete)` ile başlatılan uçuş yarıda kesilirse çağıran hiç haber almıyor. İleride kümes yükseltmesi bu geri çağrıyı bekleyecek. İptalde de çağrılsın; PlayMode testi eklensin.
2. **Kodda sabit sayılar:** `HomePlayButton.PressDepth`, `BevelAtRest`, `BevelPressed` (4/8/2) ve `RewardFlight.IconSize` (28) `MotionTheme`/`UiTheme` alanlarına taşınsın.

## Kontrol edilecek

- Profil revizyonu değişince uçuş iptal oluyor (doğru güvenlik önlemi). Ana ekranda **can yenilenmesi** profili kaydediyorsa, uçuş sırasında bir can dolduğunda animasyon kesilir. Öyleyse can yenilenmesi uçuşu kesmemeli.
- Görsel: düğme kalınlığı, parlama bandı, yazı konturu stil kılavuzuyla karşılaştırılmalı (`Home-Reward.png`).
- Titreşim fiziksel cihazda doğrulanmadı (iOS `.mm`, WebGL `.jslib`, Android).
