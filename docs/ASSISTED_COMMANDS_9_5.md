# 9.5 sürümlü yardım komutları

Bu belge `dist/commands.js` ve `unity/Commands/` uygulamalarının ortak sözleşmesidir. Eski `classic-v4` motoru, snapshot v4 okuyucusu, yayımlanmış bölüm/varyantlar ve normal takas sonuçları değiştirilmemiştir. Yardımsız oyun eski kayıt biçiminde kalabilir; ilk yardımda geçmişi doğrulanarak yeni zarfa geçirilir.

## Motor ve yetkilendirme sınırı

`AssistedGame` yalnız mekanik sonuç ve komut tekrarını yönetir. Envanter, bölüm kilidi, ürünün açılma eşiği, Altın, makbuz doğrulama, reklam kotası ve can sonuçlandırması oturum/ekonomi katmanının sorumluluğudur. Uygulama bir komutu kopya üzerinde çalıştırır; kaynak harcaması, yeni oyun, can ve ilerleme tek atomik profil commit'inde kaydedilir. Commit başarısızsa canlı kopya benimsenmez. Motor çağrısı tek başına satın alma izni değildir.

JS giriş noktası: `new HexAssistedGame(level, {attemptId, limits?}, snapshot?)`. C# karşılığı: `new Hexrota.Commands.AssistedGame(level, attemptId, limits, snapshot)`. C# çekirdeği C# 7.3 ile derlenir; JSON kitaplığı, Unity, saat, disk, DOM ve SDK kullanmaz. Mevcut saf `CatalogWire`, `Wire` ve `HexMatch` yardımcıları tekrar kullanılır.

Komut kimlikleri 1–180 karakterlik ASCII harf/rakam ve `_.:-` içerir; ayrılmış nesne prototip adları reddedilir. Bilinmeyen/ek alanlar, sayıya çevrilen string hedefler ve desteklenmeyen komut sürümleri kabul edilmez.

| Komut | Kanonik alanlar | Sonuç |
| --- | --- | --- |
| Takas | `{id,type:"swap",a,b}` | Gerçek `HexMatch.swap/Swap` çağrısı; 1 hamle, eski puan/yerçekimi/RNG kuralları |
| Yeşil Fırça | `{id,type:"green_brush",index}` | Tek hedefte 2→1 veya 1→0 kat; 0 hamle/puan; taşlar/RNG değişmez |
| Renk Anahtarı | `{id,type:"color_key",index,value}` | Oyuncunun seçtiği izinli, mevcut değerden farklı sayı; 0 hamle; gerçek eşleşmeler normal puan/kat/yerçekimi/üretim üretir |
| Kurtarma | `{id,type:"grant_moves",moves:5}` | Son başarılı komutu gerçek takas olan, 0 hamleli kayıp denemeye tam +5; aynı tahta/RNG/puan/zemin korunur |

Fırça ve anahtar yalnız `playing` durumda kullanılabilir. Boyanmış hedef fırçayı reddeder. Anahtar aynı değeri veya palet dışındaki sayıyı reddeder. Varsayılan deneme sınırları `{greenBrush:1,colorKey:1,rescue:1}`; fırça/anahtar limitleri ayrı yapılandırmada 0–100 olabilir. Kurtarma bu sürümde her zaman en fazla birdir. Teknik komut günlüğü üst sınırı 512'dir; mevcut bölüm bütçelerinin çok üzerindedir. Reddedilen işlem günlüğe eklenmez.

**Anahtar ürün kararı:** Anında eşleşme yaratmayan hazırlık hamlesine izin verilir. Ön izleme bu durumda 0 puanı, seçilen sayıyı ve maliyeti açıkça göstermelidir. Oluşan gerçek eşleşmeler üç eksende tespit edilir, art arda çözülür ve en fazla 32 dalgadan sonra eski motorun güvenli sabit tahta yöntemi kullanılır. Oynanabilir takas kalmamışsa eski `EnsurePlayable` çalışır; bu kontrolün yol açtığı düzenleme/RNG değişimi `reshuffled:true` ile ön izlemede görünür. Rastgele bir sayı seçilmez. Aynı giriş aynı bütün ara dalgaları üretir.

## Ön izleme ve atomiklik

`preview/Preview(command)` bağımsız kopyada gerçek komutu çalıştırır; `{result,snapshot,status,covered,remainingLayers}` verir. Asıl oyun ve RNG değişmez. UI ön izlemeyi **Attempt ID + gözlenen profil revision + komut sayısı** ile bağlar; yalnız takas sayacı yeterli değildir, çünkü yardım komutları `turn` artırmaz. Onay sırasında değişen deneme/durum yeniden ön izleme gerektirir.

Uygulanmış C# host sözleşmesi `GameSessionController.PreviewBooster(itemId, index, value?, operationId)` ile oluşturulan geçici onay nesnesidir. Metodun döndürdüğü ön izleme sonucunun `quote` alanı şu biçimdedir:

```json
{
  "schemaVersion": 1,
  "profileRevision": 42,
  "attemptId": "a-7-1-12345678",
  "snapshot": {},
  "command": {"id":"assist:example","type":"green_brush","index":0}
}
```

Buradaki `snapshot`, ön izlemenin alındığı güncel kanonik oyun checkpoint'inin tamamıdır; örnekte alanı göstermek için boş bırakılmıştır. `UseBooster(..., SessionCommand command = null, object quote = null)` geçerli, **tam olarak güncel** ön izleme nesnesini zorunlu tutar. Aynı revision, Attempt ID, snapshot ve seçilmiş komut birlikte eşleşmelidir. Hedef, sayı, işlem kimliği, profil revision'ı veya sıfır takas tüketen başka bir yardım komutu değişirse eski onay geçersizdir. Onay nesnesi kalıcı kayda yazılmaz; kullanımdan veya geri yüklemeden sonra silinir. Uygulamayı yeniden açmak eski bir ön izlemeyi yeniden kullanılabilir yapmaz.

Oturum yükleyicisi mekanik fırça/anahtar komutları ile ekonomi stok harcama kayıtlarını **iki yönde** eşleştirir: kaynak harcaması olmayan yardım komutu ve gerçek yardım komutu olmayan stok harcaması geçerli kayıt sayılmaz. Geçerli yeni komut, kaynak harcaması ve varsa kazanma/ilerleme aynı profil işleminde kaydedilir. Kurtarma komutu ayrıca kendi deneme, tekil işlem/makbuz ve can sonuçlandırma kurallarıyla doğrulanır; sırf mekanik motorun `grant_moves` kabul etmesi host yetkisi sağlamaz.

Geçerli işlem kopya üzerinde bütünüyle çözülmeden canlı oyun benimsenmez. Aynı komut kimliği ve aynı içerik tekrar gelirse orijinal mekanik sonucu `duplicate:true` ile döner; yeni komut, stok harcaması veya RNG geçişi olmaz. Aynı kimlik farklı içerikle kullanılırsa `command_id_conflict` olur. Tekrar önleme tablosu diskten okunmaz; doğrulanmış günlüğün yeniden oynatılmasından kurulur. Güncel durum için sonuçtaki tarihsel `usage` yerine `snapshot()` esas alınır.

## Kanonik yeni kayıt

```json
{
  "version": 1,
  "rulesVersion": "assisted-v1",
  "commandsVersion": 1,
  "baseRulesVersion": "classic-v4",
  "levelId": 7,
  "attemptId": "a-7-1-12345678",
  "limits": {"greenBrush":1,"colorKey":1,"rescue":1},
  "usage": {"greenBrush":0,"colorKey":0,"rescue":0},
  "bonusMoves": 0,
  "assisted": false,
  "commands": [],
  "values": [], "layers": [], "score": 0,
  "movesLeft": 0, "turn": 0, "rngState": 1, "history": []
}
```

Buradaki boş diziler yalnız şemayı gösterir; geçerli kayıt gerçek bölümün bütün hücrelerini içerir. Sayısal kampanya Level ID'si ile string öğretici kimliği aynı değildir. `turn` ve `history` yalnız başarılı normal takasları içerir. `movesLeft = baseMoves + bonusMoves - turn`. Kullanım, bonus, hamleler, taşlar, zemin, puan ve RNG başlangıçtan komutlar yeniden oynatılarak birlikte doğrulanır; hiçbir alan salt kayıttaki iddiaya dayanmaz. Ek/kayıp alan, tanınmayan sürüm, yanlış kimlik, tekrar komut kimliği veya sonuç uyumsuzluğu kaydı reddeder; yeni tahta ile sessizce değiştirmez.

Saf motor geçerli mekanik replay'i doğrular; kalıcı ekonomi/işlem defterleriyle yetki eşleştirmesi host sınırıdır. Kaydın `limits` alanı tarihsel kuralları dondurur; oturum desteklenen limit politikasını ayrıca kontrol etmelidir. Gelecekte limit/politika değişirse eski kabul edilen yapılandırmaların sürümlü arşivi gerekir.

Eski v4 kayıt önce değiştirilmemiş gerçek v4 okuyucusunda doğrulanır. Geçmiş takaslar `legacy-swap:1`, `legacy-swap:2`, … kimlikleriyle yeniden oynatılır; eski son durumla bütün alanlar karşılaştırılır. Metadata/variant/dataVersion doğrulaması mevcut katalog katmanındadır. Yardım sonrası ham `Model.Snapshot()` kalıcılaştırılmaz: eski v4 hamle denklemini yanlış temsil eder. `ClassicSnapshot()` yardım sonrasında açıkça hata verir. Görselleştirme için sürüm etiketi olmayan `presentationSnapshot/PresentationSnapshot()` vardır.

## İpucu ve sunum

Yardım sonrası eski yalnız-takas sertifikaları güncel zemini/taşları temsil etmez. JS wrapper ipucu kopyasından authored route alanlarını kaldırır; C# host `HintSolver.Find(Model, null, ...)` kullanır. Sınırlı arama güncel gerçek durumdan güvenilir bir devam bulursa `search_win` olabilir; sırf önceki sertifika var diye `proven_route` denmez. Arama asıl oyunu değiştirmez.

Mevcut Reward Director'ın ardışık normal takas/puan/zemin sürekliliği yeni sıfır-hamle komutlarıyla taklit edilmez. Yardımlı denemede eski Director durumu ve planı `null` bırakılır; UI gerçek sonuç dalgalarından temel efekt/ses gösterebilir. Ekonomik tamamlama ve botanik ödülleri bundan bağımsız oturum işlemleridir. Yardımlı ödül sunumu için ileride ayrı sürümlü adaptör tasarlanabilir; bu sürümde uygulanmış sayılmaz.

## Doğrulama

- `node check-commands.cjs`: bütün mekanik invariantlar, 80 rota, 40 varyantın hücre hedefleri, ön izleme/klon/tekrar/bozuk kayıt ve eski kaynak hash'leri.
- `node generate-command-vectors.cjs --check`: dondurulmuş senaryolar ve **tam çıktıların** SHA-256 özeti. Vektör güncellemesi bilinçli, gözden geçirilebilir bir veri değişikliğidir.
- `node check-command-parity.cjs`: gerçek .NET 8 kurulumu ile C# 7.3 derleme ve her senaryonun tam JSON karşılaştırması. Dalga içindeki eşleşme dizileri, `null`, düşüş kaynak/hedefleri, üretim metadata'sı, katlar, puan, RNG, sonuç, kullanım, komut geçmişi ve devam durumu karşılaştırılır. SDK yoksa test başarısız olur; JS sonucu C# yerine kullanılmaz.

`fixtures/command-vectors.json` deterministik girdileri ve tam-çıktı özetini; `fixtures/command-core-hashes.json` değiştirilmemiş classic kaynaklarını sabitler. Telefon/Unity/IL2CPP çalıştırması bu saf çekirdek testlerinin yerine geçmez ve bu belgede yapılmış sayılmaz.
