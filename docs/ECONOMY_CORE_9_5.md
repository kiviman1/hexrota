# 9.5 saf ilerleme ve ekonomi sözleşmesi

Bu belge `dist/economy.js` ve `unity/Economy/EconomyManager.cs` için uygulanan veri sözleşmesidir. Ana oyun motorunun `classic-v4` kuralları ve snapshot v4 değişmez. Yeni veriler mevcut `hexrota-profile-v2` zarfının **`game.economy`** alanında tutulur; profilin `{game, energy}` yapısı, kayıt anahtarları ve mevcut can/TEST cüzdanı yeniden sürümlendirilmez.

## Yetki ve atomik kayıt sınırı

Modül; DOM, saat, dosya/yerel kayıt, ağ, motor RNG'si veya reklam SDK'sı kullanmaz. Bütün işlemler girdiyi değiştirmeden yeni kopya döndürür. Host, gerçek motorun veya doğrulanmış replay'in kazandığını kontrol edip `complete(..., {verified:true,status:'won',...})` çağırır. Bu parametre bir ödeme makbuzu veya istemciye karşı kriptografik doğrulama değildir. Komut/controller katmanı aynı kontrolü yapmadan UI'dan gelen `verified` değerini güvenilir sayamaz.

Host, dönen ekonomiyi **aynı** profil işlemi içinde oyun snapshot'ı, komut geçmişi, can settlement'ı ve ilerlemeyle kaydeder. Yazma hatasında eski geçerli profil kalır; ödül sunumu/analitik ancak commit başarısından sonra yapılır. Pure manager'ın hazırladığı sonuç tek başına kalıcı işlem sayılmaz.

## Kanonik yapılandırma

`data/economy-config-9-5.json` tek parametre kaynağıdır. `node sync-economy-config.cjs` tarayıcı/CommonJS `dist/economy-config.js` ile saf C# `EconomyDefaults.cs` dosyalarını üretir; `--check` tutarlılığı doğrular.

| Parametre | İlk değer | Durum |
| --- | ---: | --- |
| Doğrulanmış ilk kampanya bitişi | 20 Altın + 1 yıldız | Değişmez ürün kuralı |
| Yeni oyuncunun oyun Altını/yıldızı | 0 / 0 | TEST Altın dönüştürülmez |
| Bölüm 3 hediyesi | 3 Yeşil Fırça | Bir kez |
| Bölüm 6 hediyesi | 3 Renk Anahtarı | Bir kez |
| Fırça / Anahtar | 70 / 90 Altın | Pilot fiyat |
| Altınla kurtarma | 140 Altın, +5 hamle | Pilot fiyat; aynı attempt bir kez |
| Kurtarma reklamı | 2 / UTC günü | Ayrı kurtarma yöneticisi uygular |
| Her güçlendirici | Deneme başına 1 | Pilot kullanım sınırı |
| Bahçe eşikleri | 2 / 5 / 8 / 10 yıldız | Çiçek / bitki / ağaç / bütün bahçe |

Aşama A, tek seferlik ilerleme/hediye/migration ve giriş korumasını kullanır. Saf `purchase`, `consume`, `spendRescue` işlemleri aynı doğrulanan ledger'ın hazırlık sözleşmeleridir; gerçek hedef/komut/mağaza/kurtarma UI bağlantıları sonraki B/C aşamalarına aittir. Hedefi olmayan saf `consume` çağrısı tahta etkisi uygulamaz. Envanter yalnız geçerli hedef komutu başarıyla hazırlandıktan sonra aynı atomik host işleminde azaltılmalıdır.

## `game.economy` v1

```json
{
  "schemaVersion": 1,
  "rulesVersion": "economy-v1",
  "campaignId": "main",
  "clearedLevelIds": [],
  "claimedLevelIds": [],
  "gold": 0,
  "stars": 0,
  "inventory": {"greenBrush": 0, "colorKey": 0},
  "migration": {
    "schemaVersion": 1,
    "source": "new",
    "recognizedLevelIds": [],
    "verifiedLevelIds": []
  },
  "transactions": {}
}
```

Kampanya Level ID'leri JSON sayısıdır: `1` ve `"1"` farklıdır. Öğreticiler `learn-1` / `learn-2` string kimliklerini korur. ID dizileri katalog sırasındadır ve tekrarsızdır. İlk on bölümde toplam bitiş geliri en çok 200 Altın ve 10 yıldızdır. Yıldız harcama, yıldız satın alma ve genel Altın basma API'si yoktur.

`clearedLevelIds` kalıcı oynanamazlık kaydıdır. `claimedLevelIds` ödülü doğrulanıp verilen haklardır. Yalnız ilk tamamlanmamış kampanya bölümü veya ücretsiz öğreticiler açılabilir. Sıradan reset, yeniden deneme, varyant/Attempt ID değişimi bu iki seti temizleyemez. Kampanya bittiğinde `nextLevel` null döndürür; ilk bölüme dönmez.

### İşlem günlüğü

`transactions` işlem kimliği → satır sözlüğüdür. Her satırda `kind`, `levelId`, `attemptId`, `itemId`, `source`, `assisted`, `sequence`, `costGold`, `pricesVersion` bulunur. Sıra 1'den başlar ve boşluksuzdur. Bitiş anahtarı `clear:main:<numericLevelId>`, hediye anahtarı `gift:main:<levelId>:<itemId>` biçimindedir. Dış komutlar `clear:` / `gift:` ön eklerini kullanamaz. Komut ID'leri ASCII harf/rakam veya `_.:-`, 1–180 karakterdir; prototip anahtarları ve satır sonu reddedilir.

Doğrulayıcı bütün satırları tekrar hesaplar: Altın, yıldız, stok, kalıcı bitişler, hediye kaynağı/Attempt ID, sıralama, eksi bakiye, kullanım sınırları ve çift haklar denetlenir. Aynı işlem kimliği + aynı içerik `duplicate_transaction`; farklı içerik `transaction_conflict` üretir. Reddedilen işlem girdiyi değiştirmez. Satın almada işlem anındaki `costGold`/`pricesVersion` tutulur; **mevcut fiyat sürümünde tutar tam yapılandırılmış fiyata eşit olmalıdır**. Henüz yayımlanmış eski 9.5 fiyatı olmadığı için bilinmeyen fiyat sürümleri güvenli biçimde reddedilir, yeni kayıt diye silinmez. **Gelecekte fiyat değiştirilmeden önce bilinen eski fiyat sürümleri için açık, test edilmiş arşiv/migration politikası eklenmelidir**; bu arşiv şu an uygulanmış değildir. Bu çevrimdışı ledger gerçek para veya reklam makbuz doğrulaması yerine geçmez.

## Eski kullanıcı geçişi

Host, eski `saved.done` indekslerini ve gerçek katalogla replay edilerek kazanmış olduğu doğrulanan sayısal Level ID'lerini sağlar. Desteklenen kaynaklar `hexrota-match-v5/v4/v3/v2`'dir. Öğretici indeksleri 0/1 ödülsüzdür; kampanya indeksleri 2–11, Level ID 1–10'a karşılık gelir.

İlk geçişte kalıcı bitişler = geçerli eski done kampanya kimlikleri **birleşim** doğrulanmış eski kazanmış snapshot kimlikleridir. İkinci kaynak, eski uygulamanın kazanmış tahtayı saklayıp done kaydından önce kapanması durumunu kurtarır. Yalnız gerçek replay kanıtı olan kimlikler Altın/yıldız/hediye alır. Geçerli done var ama kanıt yoksa bölüm oynanamaz kalır, `pendingReviewLevelIds` içinde görünür; ödül uydurulmaz. Sonradan aynı tarihsel kimliğe gerçek kanıt sağlanırsa hakkı yalnız bir kez teslim edilir.

**Açık geçiş varsayımı:** Böyle eski profillerde yıldız sayısı bir süre kalıcı bitiş sayısından küçük olabilir. Yıldız = doğrulanmış/ödüllendirilmiş bitiş sayısıdır. İnceleme durumu gizlenmez; eski snapshot silinmez. Mevcut v1 ledger otoritatiftir; sonraki normal done/başka Level ID gönderimleri yeni geçmiş hak oluşturmaz. Bozuk/eski olmayan sürüm kaydı yeni kullanıcı sayılmaz.

**Eksik alan ve null ayrımı:** Yalnız `game` içinde `economy` alanı gerçekten yoksa `migrate(null, legacy)` çağrılır. Alan mevcut ve değeri null/bozuksa `restore` hatasıyla güvenli durdurulmalıdır. Host, bunu yeni ledger oluşturma bahanesiyle kullanamaz; ilk profil yazısından önce kontrol eder.

## JS → C# API eşlemesi

JS: `HexEconomy.createManager(config)`; C#: `new Hexrota.Economy.EconomyManager(config)`. Varsayılan/null yapılandırma kanonik üretilmiş yapılandırmayı kullanır. Saf DTO'lar JSON nesne/dizi/sayı/null türlerini korur; C# çekirdeği `Hexrota.Contracts.Wire` kullanır ve JSON ayrıştırıcıya bağımlı değildir.

| JS | C# | Sonuç |
| --- | --- | --- |
| `createState`, `restore`, `validate` | `CreateState`, `Restore`, `Validate` | Yeni/kopya/doğrulanmış durum |
| `migrate(existing, legacy)` | `Migrate(existing, legacy)` | Tek geçiş + inceleme durumu |
| `complete(state, context)` | `Complete(state, context)` | Tek doğrulanmış bitiş hakkı |
| `canEnter`, `nextLevel`, `view` | `CanEnter`, `NextLevel`, `View` | UI ve controller aynı giriş kuralı |
| `purchase`, `consume`, `spendRescue` | `Purchase`, `Consume`, `SpendRescue` | Tekil harcama/stok hazırlığı |
| `getTransaction`, `config` | `GetTransaction`, `Config` | Kopya/veri sorgusu |

Değişim sonucu `{state, applied, reason, reward, pendingLevelIds}` biçimindedir. `reward` yoksa null; varsa `{gold, stars, inventory:{greenBrush,colorKey}}`. Başarılı harcama ayrıca `costGold` ve `itemId` verir. UI görünümü Altın/yıldız/stok, kalıcı/ödüllü kimlikler, sonraki kimlik, kampanya sonu, inceleme kimlikleri ve bahçe kilitlerini içerir.

## Gerçek test kapsamı

`node check-economy.cjs`: 14 invariant grubu; 100 callback, 10 bitiş ve 2 hediye, öğreticiler, ödülsüz kayıp, eksik eski kanıt, done işareti eksik doğrulanmış kazanım, reset koruması, ayrı TEST bakiye, fiyat/stok/kurtarma tekilliği, değiştirilmiş/bilinmeyen fiyat reddi ve bozuk kayıt reddi. Aynı akışlar iki kez çalıştırılarak tekrarlanabilirlik ve girdi değişmezliği kontrol edilir.

`node check-economy-parity.cjs`: gerçek .NET 8 üzerinde C# 7.3 derlemesi; JS ve C# her adımda **tam sonuç + tam durum** karşılaştırması. SDK yoksa başarısız olur; JS sonucu yedek başarı olarak kullanılamaz. Test akışları `lib/economy-cases.cjs` içinde ortak girdidir; uygulama algoritması kopyalanmaz. Unity/IL2CPP ve fiziksel cihaz testi bu saf çekirdek karşılaştırmasının yerine geçmez ve bu komutlarla yapılmış sayılmaz.
