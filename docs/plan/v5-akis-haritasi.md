# V5 akış haritası (hafta 1)

20 Kasım 2026. Kod yazmadan çıkarıldı; hafta 2'nin iş listesi bu belgedir.

## Bağlam

Mobil kampanya (`ClientGameData.FromResources()`, büyük kampanya açık):

| Bölüm | Kural | Kaynak |
| --- | --- | --- |
| learn-1, learn-2 (öğretici) | classic-v4 | `data/tutorials-fixed.json` |
| 1–5 | classic-v4 | `data/levels-original.json` |
| **6–10** | **classic-v5** (kasa `blockers`, toprak bölgeleri `regions`, `sources`, `activation`) | `data/campaign-flow-levels-v2.json` |

Kampanyanın yarısı V5. Çekirdek kodun tek yetkilisi kök `unity/` klasörüdür; `unity-client/Assets/Hexrota/Core` oradan `scripts/sync-unity-client.cjs` ile üretilir. Çekirdek değişiklikleri `unity/` içinde yapılır ve senkronlanır.

## Zincir

Öğretici → bölüm → takviye → kayıp/kurtarma → ödül → kümes → sonraki bölüm.

| # | Halka | V5'te durum | Kanıt |
| --- | --- | --- | --- |
| 1 | Öğretici → bölüm 1 | Çalışıyor (v4) | `CompleteCampaignTests`, `DevelopmentWinTests` |
| 2 | Bölüm 6–10 oynanışı ve kazanma | Çalışıyor | `DevelopmentWinTests` her bölümü saklı çözümle kazanıyor |
| 3 | V5 engellerine giriş anlatımı (bölüm 6) | **Doğrulanacak**: kasa ve bölge ilk kez burada çıkıyor; özel bir öğretim adımı olup olmadığı belirsiz | `InChapterOnboardingTests` yalnız ilk bölümü kapsıyor |
| 4 | Takviye: Yeşil Fırça | **Kapalı** | aşağıda K1, K2, K3, K4 |
| 5 | Takviye: Renk Anahtarı | **Kapalı ve fiilen ölü**: hediye 6. bölüm kazanımında gelir, açılış L6 sonrası; kalan bölümlerin hepsi V5 | `economy-config-9-5.json` `colorKey.unlockAfterLevelId: 6` |
| 6 | Çantayı oyundan açma | **Yok**: `OpenInventory()` yalnız testlerden çağrılıyor; HUD'da düğme yok | `FirstPlayableController.Inventory.cs`, `CastleHudView` (yalnız `settings` düğmesi) |
| 7 | Takviye satın alma | **Kapalı** (V5 bölümündeyken) | K1 |
| 8 | Kayıp → +5 hamle (Altın ya da reklam) | **Kapalı**: kayıp ekranında ikinci şans bölümü hiç çizilmiyor | K5, K6 |
| 9 | Kayıp → yeniden dene | Çalışıyor | `SessionIntegrationTests.MaskedCampaignLossOffersNoAssistanceAndStartsFreshOnReentry` |
| 10 | Kazanma → Altın + Altın Yumurta | Çalışıyor | `DevelopmentWinTests` (bölüm başına 1 yumurta) |
| 11 | Ödül uçuşu → kümes yükseltmesi | Çalışıyor (alan 1, 4 yükseltme) | `CoopLedgerTests`, PlayMode kümes testleri |
| 12 | Sonraki bölüm | Çalışıyor; 10. bölümden sonra "Yeni bölümler yakında" | — |

## Kırık noktalar

| Kod | Yer | Ne yapıyor |
| --- | --- | --- |
| K1 | `unity/Application/GameSessionController.Assistance.cs` `AssistanceGuard` ve `PurchaseInventory` | `engine.HasObstacles` ise `inventory_unavailable` döner: fırça/anahtar önizleme, kullanım ve satın alma reddedilir |
| K2 | `unity/Commands/AssistedGame.cs` | Kayıt biçimi `baseRulesVersion: "classic-v4"` sabit; `ImportClassic` yalnız v4 anlık görüntüsünü kabul ediyor; `Restore` v4 dışını reddediyor. Fırça doğrudan `layers[index]--` yapıyor: kasa (`blockers`), bölge etkinleşmesi ve kaynak hücreleri hesaba katılmıyor. `ResolveColorChange` kendi zincirini çözüyor, V5 kasa hasarı ve bölge kurallarını uygulamıyor |
| K3 | `unity/Application/SaveMigration.cs` | Yardımlı tahta kayıtlarını yalnız v4 tabanlı varsayıyor |
| K4 | `unity-client/.../Runtime/UnityGameSession.Inventory.cs` `InventoryAvailable` | `Level.rulesVersion == "classic-v4"` şartı; geri yüklemede `baseRulesVersion` v4 varsayımı (satır 35–47) |
| K5 | `unity/Application/GameSessionController.Rescue.cs` `RescueContext`, `RecoverableLoss` | `HasObstacles` ise kurtarma bağlamı `null`, kayıp kurtarılamaz sayılıyor |
| K6 | `Runtime/UnityGameSession.cs` `ReadRescueAd`, `GetGoldRescueOffer` | K5 yüzünden V5'te `null`; `DrawLoss` ikinci şans panelini hiç çizmiyor |
| K7 | Testler | `SessionIntegrationTests.MaskedCampaignLossOffersNoAssistanceAndStartsFreshOnReentry` V5'te takviye/kurtarma olmamasını **beklenen davranış** olarak doğruluyor; hafta 2'de ters çevrilmeli |
| K8 | JS referansı | `dist/engine.js`, `dist/rescue.js`, `fixtures/command-vectors.json` ve `check-command-parity`/`check-rescue-parity` C# ile parite tutuyor. C# komut anlamı V5 için değişince parite ya JS'de de güncellenir ya da V5 komutları parite kapsamı dışına alınır (karar) |

## Hafta 2 iş listesi

Büyüklük: S ≤ 4 saat, M ≈ 1–2 gün, L ≈ 3+ gün.

| # | İş | Kapsadığı | Büyüklük |
| --- | --- | --- | --- |
| 1 | V5 takviye kurallarını yaz ve onaylat (fırça kasalı hücrede ne yapar, etkin olmayan bölgede ne yapar; anahtar sonrası zincir kasaya hasar verir mi). Önerim: fırça 1 toprak katı ya da 1 kasa dayanımı; anahtar sonrası zincir normal V5 çözümüyle | K2 | S |
| 2 | `AssistedGame`'i V5 anlık görüntüsüyle çalıştır: `baseRulesVersion` V5'i kabul etsin, kayıt/geri yükleme, fırça ve anahtar V5 çözümünü kullansın (HexMatch'in engel farkında yolları) | K2 | L |
| 3 | Kayıt göçü ve geriye uyum: V5 yardımlı tahta kaydı + mevcut v4 kayıtlarının bozulmadığını gösteren test | K3 | M |
| 4 | Denetleyici kapılarını kaldır (`AssistanceGuard`, `PurchaseInventory`, `RescueContext`, `RecoverableLoss`) | K1, K5 | S |
| 5 | Runtime: `InventoryAvailable` sürüm şartı ve geri yükleme eşlemesi | K4, K6 | S |
| 6 | HUD'a çanta düğmesi; takviye tepsisi oyun ekranından açılsın; kasalı hücre seçimi | Halka 6 | M |
| 7 | Renk Anahtarı açılışını ulaşılabilir yap (V5 desteğiyle çözülür; yine de ekonomi kontrolü) | Halka 5 | S |
| 8 | Testleri ters çevir ve genişlet: V5'te fırça, anahtar, +5 hamle (Altın ve reklam), kasa/zemin/kayıt/ödül etkileşimi | K7 | M |
| 9 | JS paritesi kararı ve uygulaması | K8 | S (kapsam dışı) – L (JS'de de uygula) |
| 10 | Bölüm 6 V5 tanıtımını gerçek arayüzde doğrula; eksikse not al (yeni öğretici yazmak hafta 3 bulgularına kalır) | Halka 3 | S |

Toplam: kabaca 7–9 gün. Hafta 2'nin diğer işleri (okunabilirlik, geçici sesler, uçtan uca PlayMode testi, Android build) ile birlikte 25–30 saatlik haftaya sığmaz. Öneri: hafta 2'de 1–6 ve 8; okunabilirlik ve sesler gerekirse hafta 2'nin sonuna ya da hafta 3'ün başına kayar. Karar senin.
