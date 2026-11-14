# Yerel olaylar ve ölçüm sözleşmesi

## Uygulanan sınır

`dist/events.js`, veri alan ve yeni veri döndüren saf olay doğrulayıcısıdır. `dist/app.js` oyunla bağlantıyı ve `hexrota-events-v1` anahtarındaki yerel kaydı yapar. Harici analiz servisi, ağ aktarımı, hesap/iletişim/ödeme bilgisi veya kişisel kimlik alanı yoktur. Deneme kimliği oyun denemesini tanımlar; kişiyi tanımlamaz.

Tampon varsayılan olarak son 500 olayı tutar; API sınırı 1–2000'dir. Bu bir geliştirme/test kaydıdır, eksiksiz ömür boyu analitik veritabanı değildir. İlerleme `hexrota-match-v5` içinde ayrı saklanır. Analiz kaydının yazılamaması oyunu, ipucunu veya ilerlemeyi durdurmaz.

## Olay zarfı — sürüm 1

Her olayda `schemaVersion`, `eventId`, `sequence`, `timestamp`, `name`, `levelId`, `variantId`, `levelDataVersion`, `attemptId`, `attemptNumber`, `movesUsed`, `movesRemaining`, `score`, `targetScore`, `covered`, `totalCells`, `remainingLayers`, `cascades`, `hintsUsed`, `status` bulunur. Zaman damgası milisaniye cinsinden yerel saattir; sıra sayısı tampon içinde artar. `eventId = attemptId + ':' + sequence`.

`cascades` ilk eşleşmelerden sonraki ek dalga sayısıdır. `covered / totalCells` tamamen yeşil olan alan oranıdır; tek darbe almış çift alan henüz tamamlanmış sayılmaz. Hamle ve puan motorun gerçek durumundan alınır; ekranda sayıların uçmasının bitmesi beklenmez.

İsteğe bağlı ayrıntılar: `reason`, `previousAttemptId`, `nextAttemptId`, `hintKind`, `hintGuarantee`, `boosterId`. Olay türüne göre yalnızca ilgili alanlar kullanılır; rastgele ek alanlar doğrulamadan geçmez.

| Olay | Gerçek tetikleyici |
| --- | --- |
| `level_started` | Yeni veya henüz başlanmamış kayıtlı denemenin oyun ekranına alınması; ön izleme tetiklemez. |
| `level_completed` | Motorun iki kazanma koşulunu tamamlaması; sunumdan önce ve deneme başına bir kez. |
| `level_failed` | Motorun kayıp durumuna geçmesi; deneme başına bir kez. |
| `level_retried` | Önceki denemenin yerine yeni deneme oluşturulması; olay yeni kimliği, `previousAttemptId` eskisini gösterir. |
| `hint_used` | Gerçekten gösterilen yönlendirme; aramanın iptal edilmesi veya bir ekran çizimi kullanım sayılmaz. |
| `level_abandoned` | Oynanmakta olan denemenin onaylı yeniden başlatma veya ilerleme sıfırlamayla silinmesi. |
| `booster_used` | Şema gelecekteki kullanım için ayrılmıştır; mevcut oyunda güçlendirici olmadığı için üretilmez. |

Yeniden denemenin nedeni başarısızlık (`retry`), oyun ortasında baştan başlama (`restart`) veya bitmiş bölümü tekrar oynama (`replay`) olabilir. Başarısızlık sonrası tekrar oranında bu nedenler ayrılmalıdır. Menü, duraklatma, arka plana geçiş ve tarayıcıyı kapatma terk olayı değildir: oyun devam ettirilebilir biçimde saklanır.

Olaylar dışında kayıtlı `attemptStats` başlangıç/sonuç işaretlerini tutar; çizim, sayfa yenileme, animasyon atlama veya tamponun eski olayları silmesi aynı sonucu yeniden üretmez. Eski, hamle yapılmış kayıtlar için geçmişe dönük sahte başlangıç/sonuç yazılmaz. Bu yüzden yalnızca tam başlangıcı gözlemlenmiş denemeler oran hesabına katılır.

## İpucu yorumu

Motorun `source` alanı `proven_route`, `search_win` veya `heuristic` olabilir. İlk ikisi, mevcut durumdan sonuca kadar geçerli devam yolu bulunduğunu ifade eder. `heuristic` yararlı ilerleme arar; kazanma garantisi değildir. Öğreticideki sabit çift ayrıca `guided` olarak ölçülür. İpucu olayının sınıflandırması bu ayrımı taşır; `hintsUsed` oyun RNG'sini, puanı veya hamle sayısını değiştirmez.

## Hesaplanacak metrikler

Hesaplar `levelId + levelDataVersion + variantId` ile kırılır. Farklı veri sürümleri birleştirilmeden önce sabit kurallarının aynı olduğu doğrulanır.

- **Deneme tamamlama oranı:** başlangıcı ve takip penceresi gözlemlenen benzersiz denemeler içindeki tamamlananlar / başlayanlar. Kapanmamış denemeler ayrıca raporlanır; otomatik olarak kayıp sayılmaz.
- **Bölüm tamamlama oranı:** bir bölümde başlamış yerel oyun akışlarının takip penceresinde en az bir kez tamamlaması. Bir kişiyi birçok tarayıcıda tekilleştiren altyapı mevcut değildir; bunu küresel oyuncu oranı diye sunma.
- **Başarısızlık sonrası tekrar:** `level_failed` ile kapanan denemeler içinden `reason=retry` ve aynı eski kimliğe bağlı yeni denemesi görülenlerin oranı; tekrarın gözlemlenmesi için eşit takip süresi gerekir.
- **Tekrardan başarıya geçiş:** başarısız denemeden sonra bağlı yeni denemelerin kaçında kazanıldığı ve kaç tekrar gerektiği.
- **Açık terk:** onaylı silinen oynanır denemeler / gözlemlenen başlangıçlar. Oyun kapatma veya uzun süre dönmeme oranıyla aynı değildir.
- **Hamle/alan/puan darboğazı:** terminal olaylarında kalan hamle, puan eksiği, `covered / totalCells`, kalan katlar ve ipucu kullanımı. Puan tamam/alan eksik ve alan tamam/puan eksik kayıplar ayrı sayılır.
- **Planlama ihtiyacı:** ipucuyla/ipuçsuz başarı ve bot stratejileri arasındaki farklar birlikte incelenir; zor bölüme gelen oyuncu seçilimi ve ipucu seçme yanlılığı nedeniyle nedensellik iddia edilmez.
- **Süre:** aynı denemenin başlangıç ve sonuç zamanları ancak yerel saat tutarlıysa karşılaştırılır; arka plan süresi aktif düşünme süresi değildir. Aktif oyun süresi için gelecekte ayrı etkinlik/zaman ölçümü gerekir.

Gerçek oyuncu kaybı, günlük geri dönüş veya uzun vadeli tutma oranı için daha uzun takip, açık oturum/etkinlik tanımı, rıza ve kişisel veri minimizasyonu kararı gerekir. Mevcut 500 olaylık yerel tampon bunları güvenilir biçimde hesaplayamaz. İlerideki mağaza dönüşümü için de teklifin görülmesi, mağazanın açılması ve doğrulanmış satın alma/ücretsiz talep olayları gerekir; bunlar şu anda uygulanmamıştır. Sadece gelecekteki `booster_used` olayından satış dönüşümü çıkarılmaz.

## Geliştirmede doğrulama

`check-events.cjs` ve `check-attempt-ui.cjs` saf şema ile gerçek arayüz akışını denetler; ilgili komutlar `package.json` içindedir. Tarayıcı geliştirici araçlarında `JSON.parse(localStorage.getItem('hexrota-events-v1'))` yalnızca o tarayıcıdaki son olayları gösterir. Veriyi dışarı gönderme otomasyonu yoktur. Küçük gerçek kullanıcı denemelerinde gönüllü, elle alınmış gözlem notları bu yerel ölçümleri tamamlamalıdır.
