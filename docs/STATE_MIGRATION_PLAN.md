# Durum mimarisi — aşamalı geçiş planı

## Başlangıç ve kapsam

Denetim tabanı: `main` / `996462b8513cfbdbe2747941c0aad76528357842` (PR #24 dahil). Çalışma dalı `refactor/hexrota-state-architecture`.

Bu belgenin ilk sürümü **Aşama A denetim planıdır**. Aşağıdaki sonraki aşamalar uygulandı sayılmaz; her aşamanın gerçek sonucu ve ilgili commit'i teslim raporunda kaydedilir. Var olan uygulama önce karakterize edilir, sonra küçük sınırlarla taşınır. Evrensel, her alanı içeren tek bir durum nesnesi oluşturulmaz.

## Korunan işlem ve veri sınırları

| Yetkili veri | Mevcut sahip / değişmeyecek sözleşme |
| --- | --- |
| Taşlar, zemin, skor, RNG, tur, durum | `HexMatch`, Snapshot v4 / `classic-v4`; yardımlı işlemlerde `HexAssistedGame`, `assisted-v1` komut geçmişi |
| Bölüm, varyant ve deneme | `HexAttempts`; metadata v1, türü korunan Level ID, arşivli veri sürümü ve seçim RNG'si |
| Altın, yıldız, stok ve kalıcı tamamlama | `HexEconomy`; kendi doğrulanan işlem defteri |
| Can ve muafiyet | `HexLives`; LifeState v2, UTC clock/verifier adaptörü |
| +5 hareket ve makbuz hakkı | `HexRescue` + mevcut sağlayıcı; aynı Attempt ID ve tekil işlem defterleri |
| Kalıcı profil | `HexSessionStore`, `hexrota-profile-v2`; `game + energy` tek revision / tek kanonik yazım |
| Uyumluluk aynaları | `hexrota-match-v5`, `hexrota-lives-v1`; başarıdan sonra tamir edilebilir aynalar |
| Öğretici ilerlemesi | Replay ile doğrulanan kayıt; sahne yalnız son başarılı commit projeksiyonunu okur |

Yeni UI çekirdeği bu verileri yazmaz, replay etmez ve ikinci kopyalarını yetkili kabul etmez. Oyun/enerji işlemlerini event reducer içine taşımak yasaktır. Eski bozuk/null kaydı varsayılan yeni oyuncu olarak kabul etmek yasaktır.

`app.js:sessionAction` senkron bir batch sınırıdır; dönen Promise'i bekleyen bir işlem yöneticisi değildir. `performSwap` ve `confirmAssistance` gerçek komutu ve atomik commit'i ilk `await` öncesinde yürütür. Bu sıralama, görsel hata/iptalde sonucun kaybolmamasını sağlar. Yeni effect katmanı bu commit'i geciktirmemelidir.

## A — Envanter ve karakterizasyon

1. Ekranlar, modaller, kalıcı alanlar, geçici kaynaklar ve async kimlikler gerçek kaynaklardan çıkarılır.
2. `STATE_ARCHITECTURE.md` ve `STATE_TRANSITION_MATRIX.md` mevcut davranışı, beklenen iyileştirmelerden ayırır.
3. `npm test` ve anlamlı karakterizasyon kontrolleri baseline üzerinde çalıştırılır. Yeni yaşam döngüsü hatası için kırmızı kanıt ayrı tutulur; geçmekte olan baseline testi diye sunulmaz.
4. Bilinen kırmızı durum: son gerçek kazanma hamlesinin animasyonu sürerken, görünürlük değişmeden gönderilen sentetik `pagehide.persisted` sonrasında gecikmiş sonuç diyaloğu açılır. Profil game/energy ve ödül aynı kalır. Bu bir **Medium sunum yaşam döngüsü** hatasıdır; native BFCache veya fiziksel cihaz kanıtı değildir. `check-state-lifecycle.cjs` amaçlanan güvenli davranışı tarif eder ve başlangıçta kırmızıdır.

Çıkış kapısı: envanter ve başlangıç karakterizasyon commit'i; runtime henüz taşınmamış olmalı.

## B — Saf çekirdek

Küçük, DOM'suz reducer/store; doğrulanan dar olay kataloğu, immutable snapshot, guard, selector, subscription ve cleanup. Navigasyon, modal, sunum işlemi ve yaşam döngüsü paralel bölgeler olarak ayrılır. Motor sonucu veya ekonomi burada saklanmaz. Operation kaydı yalnız transient kimlik/status olabilir; Worker, AbortController, DOM node ve engine clone reducer snapshot'ına girmez.

Test kapısı: başlangıç, geçerli/geçersiz payload, idempotency, bilinmeyen olay, reentrant dispatch, abonelik kaldırma, immutable snapshot ve eski operation tamamlamasının reddi. Bu aşama mevcut app davranışını henüz değiştirmez.

## C — Navigasyon ve modal koordinasyonu

`home/game/journey/records/garden` gerçek ekranlarına bağlanır. Settings bir modal olarak kalır. DOM adapter aynı düğümlere `hidden/inert`, history ve focus etkilerini uygular; tahta yaratma veya bölüm açma işlemi reducer'a girmez. Mevcut pause → settings ve sağlayıcı/sonuç iç içeliği açık politikalarla korunur.

Mevcut `gameInputAllowed` resolving sırasında bir dokunuşu mevcut animasyonu açığa çıkarmak için kabul edebilir; bunu yanlışlıkla yeni hamle veya tamamen cevapsız girişe çevirmeyin. Board guard ile envanterin kendi modalında çalışan komut guard'ı aynı şey değildir.

Çıkış kapısı: Back/Escape, nested modal/focus, invalid screen/modal, pause/resume ve kayıt hatası geçişleri. Kalıcı işlem ve provider içleri değişmez.

## D — Öğretici, Tavik ve dünya sunumu

Tek bir host sunum projeksiyonu, portre/full-body/hidden seçimini üretir; portre ve sahne adaptörleri bu ortak kararı uygular. Varlık decode/pose epoch'ları ve modül cleanup'ı yerel kalır. Mevcut defensive görünürlük korumaları ancak aynı güvence testle sağlanınca sadeleştirilir.

İlerleme: doğrulanmış öğretici tamamlama sayısı `0 → foundation`, `1 → frame`, `2 → finished`. T1 `Tahta min(committedTurn,3)/3`, T2 `Çivi min(committedTurn,4)/4`; yeni envanter/kayıt alanı değildir. Yıldızlar kümese bağlanmaz. PR #24'ün tek koç kartı, 118 px yüksekliği, üç sütunu ve değişmeyen tahta boyutu korunur.

Çıkış kapısı: gerçek iki öğretici, tek +20 hoş geldin Altını, replay/skip, kayıt hatası/rollback, geç varlık/fallback, düşük hareket ve altı viewport'ta ölçüm.

## E — Async oyun sunumu

Mevcut `epoch`, job identity, engine identity, AbortController ve watchdog önce korunur. Yeni transient operation token'ı bu kimliklerin yerine ekonomik işlem kimliği olarak kullanılmaz. Commit sonrası sunum başlayabilir; görsel hata veya süre aşımı authoritative sonucu geri almaz. İptal, geçici taşları/skor paketlerini ve zamanlayıcıları temizleyip etkileşimi açar; eski callback yeni işleme dokunamaz.

`APP_SUSPENDED` benzeri yaşam döngüsü geçişi, son commit'i göstermeyi güvenle tamamladıktan sonra ertelenmiş sonuç açma etkisini emekli etmelidir. `check-state-lifecycle.cjs` bu aşamada düzeltmeyle birlikte yeşile çevrilir. Native `pageshow.persisted` yeniden yükleme ve Web Lock'u tekrar edinme politikası değiştirilmez.

Doğrulanmış fakat yazılamamış `pendingLifeReceipt` / `pendingRescueReceipt` disposable animasyon işi değildir. Mevcut açık yeniden teslim süreci, provider kanıtı ve tekil defterler korunur. Ekran/presentation iptali bu hakları silmez. Tam test sıfırlaması yalnız mevcut başarılı atomik reset sonrasında eski writer/callback'leri kapatır.

## F — Konsolidasyon ve teslim

- Eski flag yalnız kanıtlanan selector/owner karşılığı varsa kaldırılır. Kalıcı transaction baseline'ları, replay ve receipt kanıtları korunur.
- Listener/timer cleanup açık sahiplerde olur; pagehide'da mevcut son kayıt yazımı ile writer revoke sırası bozulmaz.
- Mevcut testler, 15 Actions çalıştırması ve gerçek .NET 8 / C# 7.3 parity işleri korunur. Yeni unit/browser kontrolleri eklenir; başarı eşiği gevşetilmez.
- PWA allowlist/HTML/fixture yükleme sırası yeni runtime modülleriyle birlikte güncellenir; save sürümleri ve Production yapılandırması değişmez.
- `STATE_REFACTOR_REPORT.md` gerçek değişiklik/commit, kaldırılan flag, hata ve çözüm, test sonucu ve kalan borcu yazar. `ARCHITECTURE.md` gerçek final sahipliğini gösterir.
- Tek entegrasyon PR'ı ve Vercel Preview oluşturulur; kullanıcı onayı olmadan main'e merge/Production promotion yapılmaz.

## Unity eşlemesi ve bilinçli sınırlar

| Web kavramı | Gelecekte Unity sunum karşılığı |
| --- | --- |
| Saf navigasyon/modal reducer | Screen/Canvas koordinatörü ve doğrulanan UI komutları |
| Authoritative domain selector | Mevcut C# `GameSessionController` / Gameplay sonucu üzerinden salt görünüm |
| İşlem token'ı / generation | CancellationToken veya explicit operation identity; gerçek makbuz kimliği ayrı |
| Tavik actor form / pose view | Portre UI / Animator adaptörü; mevcut asset clip adları |
| Derived coop stage | Başarılı profil commit'inden scene view; ikinci dünya veritabanı yok |
| Browser history/focus/DOM/Worker | Platform adaptörleri; saf transition tanımlarına girmez |

Bu görev yeni C# gameplay veya `GameSessionController` yeniden yazımı değildir. C# `Execute` ve `ProfileRepository.CompareExchange` atomik sınırı olduğu gibi korunur. Web'e Unity bağımlılığı, native kayıt formatı, SDK, Unity sahnesi veya fiziksel cihaz doğrulaması eklenmez.
