# Durum mimarisi refaktörü — uygulama ve doğrulama raporu

## Raporun kapsamı ve mevcut aşama

Başlangıç: `main` / `996462b8513cfbdbe2747941c0aad76528357842`, PR #24 dahil. Dal: `refactor/hexrota-state-architecture`. Bu sürüm **A/B tamamlandı, C uygulaması doğrulanıyor** kontrol noktasıdır; D/E/F ve nihai CI/Preview henüz tamamlandı diye raporlanmaz. Bekleyen sonuçlar aşağıda açıkça işaretlenmiştir.

| Aşama | Gerçek commit / durum |
| --- | --- |
| A — Envanter ve mevcut uygulama karakterizasyonu | `8fe2e7f`: üç mimari belge ve 11 gerçek uygulama grubu; runtime değişmedi. |
| A — Gerçek tarayıcı baseline'ı | `3509f58`: mobil geçiş karakterizasyonu; Chromium ve WebKit 19'ar grup. Runtime değişmedi. |
| B — Saf durum çekirdeği ve selector'lar | `ed14aeb`: DOM'suz iki modül ve bağımsız testler; henüz uygulamaya bağlanmadı. |
| C — Navigasyon / modal adaptörü | Çalışma kopyasında uygulandı; `test:state` geçti. Commit ve geniş regresyon sonuçları eklenecek. |
| D — Tek öğretici/Tavik/sahne projeksiyonu | Bekliyor; çalışan mevcut portre/sahne akışı bu aşamada kaldırılmadı. |
| E — Görsel operation ve suspension yaşam döngüsü | Bekliyor; `busy` ve mevcut epoch/job korumaları şu anda duruyor. |
| F — Konsolidasyon, nihai belgeler, CI ve Preview | Bekliyor. Kullanıcı onayı olmadan merge yapılmayacak. |

## Başlangıçta bulunan mimari sorunlar

Envanterin tamamı [STATE_ARCHITECTURE.md](STATE_ARCHITECTURE.md), geçişler [STATE_TRANSITION_MATRIX.md](STATE_TRANSITION_MATRIX.md), aşamalı plan [STATE_MIGRATION_PLAN.md](STATE_MIGRATION_PLAN.md) içindedir.

| Şiddet / bulgu | Başlangıç kanıtı | Sonuç ve sınırı |
| --- | --- | --- |
| Medium — geçersiz navigasyon güvenli no-op değildi | Bilinmeyen `data-nav`, oyun içinden Home'a dönüyor; modal/iş temizliği ve persist/history etkileri çalışabiliyordu. | C'de guard ilk yan etkiden önce çalışır. Hatalı hedef mevcut ekranı, SVG'yi, profili ve URL'yi değiştirmez. |
| Medium — bağımsız modal birleşimleri mümkündü | Kimlik/ekran/ebeveyn kataloğu yoktu; programatik gizli DOM komutları Settings/Inventory/preview kombinasyonlarını açabiliyordu. | C'de açık modal politikası ve instance kimliğiyle reddedilir. Normal native inertlik ile zaten engellenen kullanıcı tıklamasını ekonomik açık diye sunmuyoruz. |
| Medium — ekran/pause/yığın ve native `dialog.open` ayrı mutable kaynaklardı | Host `screen`, `paused`, `modalStack` ve native close dinleyicileriyle eşleştirme yapıyordu. | C'de ekran ve modal kayıtları Core'a; native DOM, focus ve close onayı Effects'e taşındı. Native fallback yalnız koruyucu input bariyeridir. |
| Medium — gecikmiş sonuç UI'sı retired belgeye dönebiliyordu | Son gerçek L1 kazanma hamlesinin sunumu sırasında görünürlük değişmeden sentetik `pagehide.persisted`; +150 ms sonra win modalı açıldı. | Kayıt game/energy, RNG, ödül defteri ve olaylar değişmedi. Fiziksel iPhone/native BFCache hatası değil. E için kırmızı test var; düzeltme henüz tamamlandı sayılmaz. |
| Medium — Tavik form kararı dağınıktı | Host portre güncellemesi ve sahneye verilen `tutorialPortrait` ayrı çağrılardaydı. PR #24 mevcut görünürlük hatasını zaten düzeltmişti. | D'de ortak salt projeksiyon planlandı. Yeni çift-Tavik hatası bulunduğu iddia edilmiyor; mevcut doğru davranış korunuyor. |
| Low — kaynak cleanup ve guard ifadeleri host'a dağılmıştı | Görsel job, Worker, timer, listener, epoch ve domain guard'ları farklı sahiplerde çağrılıyordu. | Yalnız gerçek UI alanları taşınıyor; faydalı güvenlik guard'ları kısaltma amacıyla kaldırılmıyor. |

Bu denetimde baseline üzerinde **yeni bir kalıcı kayıt/ekonomi bozulması veya çift hamle hatası yeniden üretilmedi**. CAS, tek-yazıcı, replay, tekil makbuz/ödül ve commit-before-presentation sırası mevcut korumalardır.

### Guard'ların kırmızıdan yeşile kanıtı

`check-state-guards.cjs`, C'den önce baseline host üzerinde **2/8** geçti; aşağıdaki altı kontrol beklenen şekilde kırmızıydı. C sonrasında **8/8** geçti. Başlangıçtaki başarısızlıklar gizlenmedi veya başarı adedine eklenmedi.

1. Hatalı ekran adının mevcut ekran/modal/profil/history durumunu değiştirmemesi.
2. Salt Home önizlemesinin ham `GAME` navigasyonuyla kayıtlı bir denemeye dönüşmemesi.
3. Settings açıkken gizli Inventory komutunun reddi.
4. Inventory açıkken gizli Settings komutunun reddi.
5. Settings üstüne gizli bölüm önizlemesinin yığılmaması.
6. Yasak önizleme isteğinden kalan `pendingStage` ile sonraki gizli Başla callback'inin etkin bölümü T1'e değiştirememesi.

`check-state-lifecycle.cjs` ayrı bir **başlangıçta kırmızı** suspension kontrolüdür. Önce gerçek commit, aynı profil/can/olaylar, temiz geçici taşlar ve busy'nin çözülmesi doğrulanır; yalnız retired belgenin win modalını yeniden açmaması assertion'ı baseline'da başarısız olur. E'deki düzeltme ve son sonuç ayrıca kaydedilecek.

### Yeni çekirdeğin entegrasyon öncesi incelemesinde düzeltilen hatalar

Bunlar mevcut main'in ekonomik açıkları değil, yeni modüller devreye alınmadan yakalanan geliştirme hatalarıdır:

- Kalıtılmış `toJSON`, doğrulanmış olayın Journey hedefini kopyalama sırasında Garden'a çevirebiliyordu. Own-data descriptor kopyası artık event, token ve enjekte edilen state'i hook çalıştırmadan taşır; hook çağrısı sıfır ve özgün kimlik/niyet korunur.
- Settings'in zorunlu Full Reset çocuğu açıkken ebeveyni kapatmak geçersiz yığın bırakabiliyordu. Core kalan topolojiyi doğrular; geçersiz kapanışı reddeder. Native close zaten gerçekleşmişse Effects ilgili native diyaloğu ve çocuklarını özgün sırada onarır; ekonomik/provider cleanup çağırmaz. Pause kaldırılıp Settings'in geçerli kök olarak kalması korunur.
- Subscriber içinden `beginOperation` bir sahibi olmayan queued iş bırakabiliyor veya dış çağrıya başka replacement işin token'ını döndürebiliyordu. Convenience API bildirim sırasında yeni iş başlatmaz; dış çağrı yalnız kendi talep token'ını alır. Genel reentrant dispatch FIFO kalır.
- Recognized facts accessors'ın çalışmaması ve normalize edilmeden önceki geçerli indexed-array legacy container projeksiyonu test edildi; caller domain nesneleri dondurulmaz.

## Sahiplik ve modül sınırları

| Alan | Bu kontrol noktasındaki sahibi |
| --- | --- |
| Ekran ve modal instance/yığın/izinler | `HexAppState`; `home/game/journey/records/garden`. Settings ekran değil, modal. |
| Native dialog, focus, close onayı, DOM/history | `HexStateEffects`; mevcut DOM düğümleri kullanılır, tahta yeniden yaratılmaz. |
| Gameplay fazı / board guard / actor form / dünya görünümü | `HexStateSelectors` saf API'si test edildi. Host'a tam bağlama D/E'de tamamlanacak. Domain verisi saklanmaz. |
| Tahta, skor, tur, RNG, katlar ve sonuç | Mevcut `HexMatch` / `HexAssistedGame`; UI reducer yeni motor değildir. |
| Katalog, varyant ve deneme | Mevcut `HexAttempts`; metadata v1 ve typed kimlikler. |
| Altın, yıldız, stok ve kalıcı tamamlama | Mevcut `HexEconomy` ve doğrulanan işlem defteri. |
| Can, sağlayıcı ve ikinci şans | Mevcut Life/Rescue yöneticileri, verifier'lar ve tekil makbuz defterleri. |
| Kalıcı profil ve atomik game+energy | Mevcut `HexSessionStore`; tek-yazıcı Web Lock ve revision kontrolü. |
| Görsel kaynak/Worker/animasyon handle'ları | Sahip modüller/host; immutable UI snapshot'ına DOM, engine clone veya receipt eklenmez. |

Üç yeni runtime modülü yeterlidir; `state-adapters.js` gibi ikinci bir katman sırf dosya sayısını artırmak için oluşturulmadı:

- `dist/app-state.js`: dar doğrulanmış olaylar, saf transition/guard, immutable snapshot, FIFO subscription ve transient operation kimlikleri. DOM, clock, storage ve gameplay içermez.
- `dist/state-selectors.js`: her çağrıda verilen domain facts üzerinden faz/input/committed-tutorial/scene/portrait projeksiyonu. Yetkili verinin kopyasını tutmaz.
- `dist/state-effects.js`: izin verilen modal effects, instance-aware native close, focus/history ve cleanup. `onClose`, mevcut `sessionAction` bariyerinden geçer; receipt/grant/commit yapmaz.

## Kaldırılan ve bilinçli korunan alanlar

C'de bağımsız mutable `screen`, `paused` ve `modalStack` kaldırıldı. `appScreen()` Core'un navigasyonunu, `appPaused()` Pause modal üyeliğini okur. Genel dialog close işleyicisi ile iki provider'a ait ek close dinleyicisi, instance başına tek `modalClosed` callback sahibinde birleştirildi. Geç eski native close yeni provider/request alanlarını temizleyemez.

`navigationEffectGeneration` yeni bir ekran otoritesi değil, reentrant close/rollback sırasında kuyruğa giren eski DOM render microtask'ını elemek için geçici effect kimliğidir.

**Henüz kaldırılmayanlar:** `busy` E'de taşınacak. `epoch`, `presentation`, `hintJob`, `activeAttempt`, `attemptPending`, `saveBlocked`, `firstOpening`, `committedSceneGame`, provider/request context'leri ve transaction baseline'ları şu aşamada korunur. `pendingLifeReceipt` / `pendingRescueReceipt` doğrulanmış fakat yazılamamış haklardır; animasyon iptali bunları silemez. `fullResetPending`, yalnız başarılı atomik full resetten sonra eski document için geri alınamaz güvenlik bariyeridir.

## Değişen dosyalar

Aşağıdaki liste baseline'a göre bu kontrol noktasında gerçekten bulunan değişiklikleri kapsar; E/F ve CI bağlantıları eklendiğinde yenilenecek. Henüz mevcut olmayan dosya uygulanmış gösterilmez.

| Grup | Tam yollar |
| --- | --- |
| Yeni transient runtime | `dist/app-state.js`, `dist/state-selectors.js`, `dist/state-effects.js` |
| Host entegrasyonu | `dist/app.js` |
| Yükleme / çevrimdışı kabuk | `dist/index.html`, `dist/sw.js`, `dist/hint-worker.js`, `dist/ui-kit.html`, `qa-fixtures.cjs` |
| Test komutları / sınır kontrolü | `package.json`, `scripts/check-architecture.cjs` |
| Yeni state testleri | `check-app-state.cjs`, `check-state-selectors.cjs`, `check-state-effects.cjs`, `check-state-characterization.cjs`, `check-state-guards.cjs`, `check-state-browser.cjs` |
| E için ayrı kırmızı test | `check-state-lifecycle.cjs` — şu anda normal geçen test zincirine dahil değil; E düzeltmesiyle birlikte etkinleştirilecek. |
| Belgeler | `docs/STATE_ARCHITECTURE.md`, `docs/STATE_TRANSITION_MATRIX.md`, `docs/STATE_MIGRATION_PLAN.md`, `docs/STATE_REFACTOR_REPORT.md` |

C'deki **PWA v40** yalnız yeni üç modülü yükleme/allowlist/fixture hattına ve sunum önbelleğine ekler. Profil/snapshot/command/attempt/life sürümleri değişmez. `package-lock.json`, bölüm/varyant verileri ve C# oyun/oturum kaynakları bu kontrol noktasında değişmedi. CSS ve hazırlanmış Tavik görselleri değiştirilmedi; PR #24'ün üç sütunlu koç kartı korunur.

## Gerçek test sonuçları

Sayılar farklı birimleri ölçer; grup, assertion, vektör, hamle ve parity karşılaştırmaları tek toplam test sayısına çevrilmez.

| Koşum | Durum / kapsam |
| --- | --- |
| Başlangıç `npm test` | Baseline üzerinde geçti. Son refaktör sonucu yerine kullanılmaz. |
| Başlangıç karakterizasyonu | 11 gerçek uygulama grubu geçti; aynı SVG, iki öğretici, modal nesting, zero-life resume, save rollback, hint cancellation ve aynı-denemede rescue. |
| Başlangıç gerçek browser | Chromium **19/19**, WebKit **19/19**; altı viewport, sıfır pageerror. Bunlar refaktör sonrası sonuçlar değildir. |
| C `npm run test:state` | **Geçti:** Core 19 grup / 1.861 assertion; selector 19 grup; DOM effects 15 grup; karakterizasyon 11 grup; guard 8 grup. |
| C sonrası tam `npm test` | Seri tam koşum exit 0. İlk kapsam hatasında yalnız üç yeni SW betiği açık normalizasyona eklendi; 88 korunan dosyanın kalan hash'i değişmedi. Paralel yerel koşumda mevcut survivor-fall zaman testi bir kez başarısız oldu; aynı assertion tek başına ve seri tam koşumda geçti, eşik değiştirilmedi. D–F sonrası son koşum ayrıca gereklidir. |
| C sonrası gerçek C# session / event | .NET 8.0.428 / C# 7.3 ile session 1.362 tam JSON / 36 gerçek app akışı / 56 native fault-guard; event 580 tam JSON / 462 ret mesajı geçti. Son CI diğer parity işlerini de çalıştıracak. |
| E lifecycle kırmızı→yeşil | **Bekliyor:** baseline kırmızı kanıtı var; düzeltme/son test henüz teslim edilmedi. |
| C sonrası Chromium / WebKit | 24/24 ve 24/24 gerçek browser grubu, sıfır pageerror, main baseline'ına göre bütün ölçülerde 0 px fark. D–F sonrası son koşum ayrıca gereklidir. |
| GitHub Actions | **Bekliyor:** mevcut 15 iş korunuyor; nihai commit'teki gerçek sonuç eklenecek. |
| Vercel Preview | **Bekliyor:** PR ve commit bağlantısı burada/PR açıklamasında paylaşılacak. Production yapılandırması değişmez. |

Fiziksel iPhone/Android, Unity Editor ve IL2CPP testi yapılmadı. Otomatik WebKit bu cihazların testi diye sunulmaz.

## Kalan borç ve bilinçli sınırlar

- Bu bir ekran/sunum mimarisi çalışmasıdır; `sessionAction`/`commitSession`, makbuz doğrulama, can/ekonomi ve C# `GameSessionController.Execute` yeniden yazılmaz.
- App host hâlâ mevcut domain komutlarını ve rollback'i bağlar. Her mutable değişkeni state makinesine taşımak gerekmiyor; request context, transaction scratch, cache ve platform handle'ları kendi sınırında kalır.
- Scene/portrait decode ve düşük hareket cleanup'ı mevcut modüllerinde kalır. Yeni actor policy yalnız form/görünüm seçimini koordine eder; hayali animasyon dosyası eklenmez.
- Doğrulanmış öğretici tamamlama `0/1/2 → foundation/frame/finished`; Tahta/Çivi sayaçları committed turn sunumudur. Kampanya yıldızı, yeni dünya kaydı veya malzeme envanteri oluşturulmaz.
- Gelecekte Unity, bu transient screen/modal/operation kavramlarını Canvas/Animator adaptörlerine eşleyebilir. Saf transition'lara UnityEngine veya tarayıcı API'si girmez; mevcut C# gameplay/ekonomi tekrar edilmez.

Nihai teslimde bu kontrol noktası metni, gerçek D/E/F değişiklikleri, başarısız testlerin çözümleri, tam dosya listesi, son CI ve PR/Preview bağlantılarıyla güncellenecek.
