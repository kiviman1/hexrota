# Hafta 1 raporu — Temizlik

20 Kasım 2026. Dal: `chore/hafta-1-temizlik`, tek PR.

## Ne bitti

- **Plan repoda:** `docs/plan/soft-launch-plan.md`; CLAUDE.md plana, haftalık durum sütununa ve rapor yoluna işaret ediyor.
- **CI:** PR #55 ile zaten tamamdı (editor-tests, runtime-host, source-and-scene-integrity zorunlu).
- **Belgeler tekleşti:** `docs/design/PRODUCT.md` tek kaynak. El boyaması 2D (3D yok); alan başına 4 yükseltme, 1/2/3/4 yumurta (toplam 10); üç kaynak (Can, Altın, Altın Yumurta); takım, lig ve sohbet kapsam dışı. `HANDOFF.md`, `BASLA.md`, `3d-sanat.md` ve Codex görevleri `docs/design/archive/` altında. Stil kılavuzu 2D'ye, 4 yükseltmeye ve Takım'sız alt menüye çekildi.
- **CLAUDE.md çalışma kuralları** eklendi.
- **Geliştirici araçları ayrıldı:** Ayarlar'daki can sınırı, test reklamı ve ikinci şans reklamı anahtarları, 300 Test Altını ve "her şeyi sıfırla" yalnız `UNITY_EDITOR || DEVELOPMENT_BUILD` altında derleniyor; hem arayüz (`FirstPlayableController.Options.cs`) hem oturum API'si (`UnityGameSession.Preferences.cs`). Release build, bir Development build'in cihaza kaydettiği can sınırı atlamasını açılışta kapatıyor.
- **Testler:**
  - `runtime-host`: .NET host, Runtime'ı release gibi (tanımsız `UNITY_EDITOR`/`DEVELOPMENT_BUILD`) derliyor. Yeni grup, geliştirici API'sinin olmadığını, Test Altını ürününün reddedildiğini ve kayıtlı can atlamasının temizlendiğini doğruluyor.
  - `editor-tests`: `DevelopmentToolsReleaseTests` oyuncu betiklerini Development bayrağı olmadan derliyor; Runtime ve Presentation derlemelerinde araçların ve etiketlerinin olmadığını, normal ayarların olduğunu (kontrol) doğruluyor.
- **V5 akış haritası:** `docs/plan/v5-akis-haritasi.md`. Bölüm 6–10 V5. Takviye, takviye satın alma ve +5 hamle çekirdekte `HasObstacles` kapısıyla kapalı; Renk Anahtarı fiilen hiç kullanılamıyor; çantayı açan HUD düğmesi yok. Hafta 2 iş listesi ve büyüklükler belgede.

## Ne kaldı / doğrulanmadı

- Testleri yerelde koşamadım: bu makinede `node` ve `dotnet` yok, Unity editörü proje açıkken çalışıyor. Doğrulamayı PR'daki CI yapacak. Bitti ölçütü ("release build'de dev menüsü yok") CI yeşil olunca sağlanmış sayılır.
- `DevelopmentToolsReleaseTests` CI'daki etkin yapı hedefi için `PlayerBuildInterface.CompilePlayerScripts` kullanıyor. Linux runner'da o hedefin derlenmesi ilk kez deneniyor; başarısız olursa bu test altyapısı sorunudur, oyun kodu değil.
- Can panelindeki "TEST reklamı" ve Test Altını fiyatlı can ürünleri yerinde: bunlar gerçek reklam SDK'sı gelene kadar (hafta 8) can akışının taklidi. Release'de hâlâ görünüyorlar.
- Wireframe HTML'lerindeki Takım sekmesi düzeltilmedi; PRODUCT.md bunu geçersiz sayıyor.
- Kök `docs/*.md` teknik raporları taranmadı; PRODUCT.md çelişkide kendisinin geçerli olduğunu söylüyor.

## Riskler

- **Hafta 2 aşırı dolu.** V5 desteği tek başına kabaca 7–9 gün (en büyük kalem `AssistedGame`'in V5 kayıt/çözüm desteği). Okunabilirlik ve geçici sesler kayabilir.
- **JS paritesi.** `dist/engine.js` + komut vektörleri C# ile parite tutuyor. V5 komutları için ya JS'de de uygulanmalı ya da parite kapsamı dışına alınmalı: karar gerekiyor.
- **V5 takviye kuralları** tasarım kararı istiyor (fırça kasada ne yapar vb.); haritada öneri var.
- Git kimliği bu makinede tanımlı değil; commit'ler yalnız komut bazında önceki commit'lerdeki kimlikle (`kiviman1`) atıldı, global ayar değiştirilmedi.
