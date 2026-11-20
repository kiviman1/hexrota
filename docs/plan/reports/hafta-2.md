# Hafta 2 raporu — Akışı onar

20 Kasım 2026. Dal: `feat/hafta-2-akis`, tek PR: [#57](https://github.com/kiviman1/hexrota/pull/57), birleştirildi. Kapsam, 20 Kasım kararıyla daraltılmış hafta 2'dir: V5 takviyeleri ve kurtarma, oyun ekranından çanta, uçtan uca PlayMode testi, Android test build'i.

## Ne bitti

- **Hafta 1 kapandı:** PR #56 birleştirildi; plan tablosunda "Tamamlandı", CI sonucu hafta 1 raporunda.
- **Plan güncellendi** (ayrı commit): hafta 2 daraltıldı; okunabilirlik ve geçici sesler hafta 3'ün ilk yarısında; insan testi hafta 3 sonu/hafta 4 başı; sonraki haftalar birer hafta kaydı (13 hafta, sıra aynı). Hafta 9'a TEST reklamı ve Test Altınıyla can satın almanın release'den kalkması eklendi. Kararlar "Karar bekleyenler / Verilen kararlar" altında.
- **Takviye–kasa kuralı** `docs/design/PRODUCT.md`'de: takviyeden doğan eşleşme ve zincir normal kurala uyar ve kasaya bir kat hasar verir. Fırça ve anahtar kasalı hücreye ve kasanın arkasında kapalı kalan hücreye kullanılamaz.
- **V5'te fırça, anahtar ve +5 hamle çalışıyor** (çekirdek `unity/`, senkronla `unity-client`):
  - `HexMatch.ResolveBoard`: takasın dalga çözümü ortak yönteme alındı. V5'te anahtarın açtığı eşleşme bu yoldan çözülüyor; kasa hasarı, sütun/alan açılması, düşme ve yeni taş takasla birebir aynı. Classic-v4 anahtar çözümü değişmedi.
  - Fırça/anahtar kasalı ya da kapalı hücrede `blocked` ile reddediliyor; hiçbir şey değişmiyor.
  - Yardımlı kayıt zarfı taban kural sürümünü ve kasa/alan durumunu taşıyor; V5 yardımlı tahta kaydedilip geri yükleniyor.
  - Denetleyicideki `HasObstacles` kapıları (takviye, satın alma, kurtarma) kaldırıldı; yalnız malzemeli v6 tahtalar desteklenmiyor (kampanyada yok).
  - Komut sonucu V5'te kasa/alan dalga alanlarını taşıyor (animasyon için); v4 çıktısı birebir aynı.
  - Renk Anahtarı artık ulaşılabilir: 6. bölümde verilir, 7–10. (V5) bölümlerde kullanılır.
- **Çanta oyun ekranından açılıyor:** HUD'da Ayarlar düğmesinin hemen altında, aynı plaka ve sandık ikonuyla "Çanta" düğmesi. İlk takviye açılınca (3. bölüm sonrası) görünür; yeni oyuncunun ilk bölümlerinde HUD yalnız Ayarlar'dır.
- **Uçtan uca PlayMode testi** (`EndToEndFlowTests`), gerçek sahne ve düğmelerle: 1. bölüm Oyna'dan öğretici açılışla → (2–5 oturumla hazırlanıyor) → 6. bölüm (V5): HUD'dan çanta → Yeşil Fırça → gerçek kayıp → TEST reklamıyla +5 hamle (aynı tahta) → ikinci kayıp → Yeniden dene → gerçek takaslarla kazanma → Altın Yumurta + Altın → ana ekranda kümes yükseltmesi → Oyna'dan 7. bölüm.
- **JS kararı uygulandı:** V5 takviyeleri JS'ye yazılmadı. Classic-v4 için eski C#↔JS karşılaştırmaları birebir geçiyor (aşağıda).

## Testler

Yerelde gerçek Unity 6000.6.9f1 ile (açık editöre dokunmadan, projenin kopyasında batchmode) ve .NET 8 ile koşuldu:

| Kontrol | Sonuç |
| --- | --- |
| EditMode | 119/119 geçti. Yeni: `V5AssistanceTests` (3 test); ters çevrilen: `MaskedCampaignOffersBoostersAndRescueAndRetryStartsFresh` |
| PlayMode | 92 test: 91 eski test geçti; yeni `EndToEndFlowTests` ilk koşuda testin kendi hatasıyla düştü (önizleme ekranındaki "Başla" adımı eksikti), düzeltildi, tek başına koşuda geçti |
| runtime-host (.NET host) | 10 grup, 955 doğrulama geçti |
| Eski C#↔JS karşılaştırmaları (classic-v4) | komut 2952, kurtarma 376, oynanış paritesi birebir geçti |
| sync-unity-client --check, check-unity-client | geçti |

PR #57 CI sonucu, [çalıştırma 44779363106](https://github.com/kiviman1/hexrota/actions/runs/44779363106), ilk denemede üçü de yeşil:

| Kontrol | Sonuç | Süre |
| --- | --- | --- |
| editor-tests | Geçti: EditMode 119/119, PlayMode 92/92 (`EndToEndFlowTests` ve `V5AssistanceTests` dahil), atlanan yok | 11 dk 13 sn |
| runtime-host | Geçti | 29 sn |
| source-and-scene-integrity | Geçti | 23 sn |

## Android test build'i

Projenin `Hexrota > Build Android Development Player` metoduyla (`ClientBuild.BuildAndroid`, IL2CPP, Development) commit `9c575b4` üzerinden alındı: `unity-client/Builds/Android/Hexrota-hafta2.apk` (89,8 MB, git'e girmez). Paket adı `com.hexrota.client`, en düşük Android 8.0 (API 26). Önceki `Hexrota.apk` (18 Kasım) yerinde bırakıldı.

Telefona kurulum (kablo ile, önerilen):

1. Telefonda **Ayarlar → Telefon hakkında → Yapım numarası**'na 7 kez dokun; geliştirici seçenekleri açılır.
2. **Ayarlar → Sistem → Geliştirici seçenekleri → USB hata ayıklama**'yı aç.
3. Telefonu USB ile bilgisayara bağla; telefonda çıkan "USB hata ayıklamaya izin ver" sorusunu onayla.
4. PowerShell'de:

   ```powershell
   & "C:\Program Files\Unity\Hub\Editor\6000.6.9f1\Editor\Data\PlaybackEngines\AndroidPlayer\SDK\platform-tools\adb.exe" install -r "C:\UnityProjects\hexrota\unity-client\Builds\Android\Hexrota-hafta2.apk"
   ```

   "Success" yazınca uygulama telefonda "Hexrota Unity" adıyla görünür. İmza farkı yüzünden reddedilirse önce eski kurulumu telefondan kaldır.

Kablo olmadan: APK'yı telefona kopyala (Drive, e-posta vb.), dosyaya dokun, o uygulama için "bilinmeyen uygulamaları yükle" iznini ver ve kur.

## Ne kaldı / doğrulanmadı

- Çanta ikonu ve konumu yalnız testlerle doğrulandı; telefonda görsel kontrol edilmedi. Düğme HUD'un altında tahtanın sağ üst köşesine biniyor; o köşede hücre varsa dokunmayı kapatabilir. Hafta 3 okunabilirlik işinde bakılmalı.
- Fırçanın kasalı hücrede reddedilmesi arayüzde genel "Bu hücrede kullanılamıyor." mesajını gösteriyor; kasaya özel metin yok.
- V5 takviye davranışı JS karşılaştırmasının dışında (karar). Arşiv web oyunu V5'te takviye sunmaz.
- Çözücü/bot takviyesiz çözülebilirliği ölçmeye devam ediyor; takviyeli çözülebilirlik ölçülmüyor.

## Riskler

- Uçtan uca test uzun (tek profil, birçok animasyon). CI'da süre ve kararsızlık izlenmeli.
- Android build Development build'dir: geliştirici araçları ve "TEST: KAZAN" düğmesi içinde. İnsan testinde oyuncuya gösterilmemeli; hafta 3'te insan testi için release benzeri bir build gerekebilir.
- Okunabilirlik ve sesler hafta 3'e kaydı; insan testi takvimi buna bağlı.
