## Soft launch planı
- Plan: docs/plan/soft-launch-plan.md (12 hafta).
- Her haftaya başlarken o haftanın istemini ve "Karar bekleyenler" bölümünü oku.
- Hafta bitince plandaki 12 haftalık tabloya Durum sütununu ekle/güncelle ve hafta raporunu docs/plan/reports/hafta-N.md olarak kaydet.

## Çalışma kuralları (plan dönemi boyunca)
- Yeni özellik ve görsel cila yok. Tek istisna okunabilirlik; görsel cila yalnız 11. haftada.
- Her iş ayrı commit; haftada tek PR.
- Üç zorunlu CI kontrolü (editor-tests, runtime-host, source-and-scene-integrity) yeşil olmadan birleştirme yok. Testleri atlayan, devre dışı bırakan ya da etkisizleştiren çözüm yok.
- Yeni mekanik ve akış EditMode/PlayMode testiyle gelir.
- Bir şey başarısız olursa nedeni ayır: oyun kodu mu, test mi, CI mı? Raporda hangisi olduğunu yaz.
- Secrets (lisans, anahtar, parola, token) hiçbir dosyaya, commit'e, PR'a ya da loga yazılmaz.
- Her hafta sonunda kısa rapor: ne bitti, ne kaldı, riskler (docs/plan/reports/hafta-N.md).
- Geliştirici araçları yalnız `UNITY_EDITOR || DEVELOPMENT_BUILD` altında derlenir; release build'de olmadıklarını DevelopmentToolsReleaseTests doğrular.

## Tasarım
- Ürün ve kapsam için tek kaynak: docs/design/PRODUCT.md. Görsel ve hareket kuralları: docs/design/style-guide/. docs/design/archive/ geçersizdir.
- Sanat el boyaması 2D; 3D yok.
- Kapsam sade: tek döngü (bölüm → Altın Yumurta → kümes). Tavuk satışı, sepet, malzeme envanteri çıkışta yok.
- Süre ve renkler kodda sabit yazılmaz: UiTheme / MotionTheme.
- Aynı anda tek dikkat animasyonu (AttentionDirector).
