# C# ortak veri değerleri ve JSON sınırı

## Uygulanan sınır

`unity/Contracts/Wire.cs`, yeni C# modüllerinin mevcut JavaScript JSON sözleşmelerini temsil etmesi için küçük bir ortak değer katmanıdır. C# 7.3 kullanır. UnityEngine, JSON kütüphanesi, dosya sistemi, ağ, saat veya cihaz servisi içermez. Oyun kuralı, yeni kayıt sürümü veya yeni kimlik biçimi tanımlamaz.

`unity/ParitySupport/WireJson.cs` ise **yalnız .NET test host'u** içindir. `System.Text.Json`, UTF-8 ve bellek akışı kullanarak gerçek JS/C# karşılaştırma isteklerini okur/yazar. Unity çekirdeğinin bu adaptöre referans vermesi gerekmez. Gelecekteki Unity JSON adaptörü aynı değer/alan sözleşmesini uygulamalıdır; bu görev Unity serileştiricisi veya dosya biçimi seçmez.

Bağımsız PR'ların derlenebilmesi için aynı iki ortak dosya katalog, can, ipucu/ödül adaptörü ve uygulama dallarında byte düzeyinde aynı içerikle bulunur. Entegrasyonda tek dosya çifti kullanılır. Paylaşılan değişiklikler bütün bağımsız dallara aynı şekilde uygulanmalıdır.

## Değer alanı

| JSON değeri | Çekirdek karşılığı |
| --- | --- |
| object | `Dictionary<string, object>`; anahtar karşılaştırması ordinal |
| array | `List<object>`; sıra anlamlıdır |
| string | `string` |
| boolean | `bool` |
| null | `null` |
| integral number | JSON test adaptöründe mümkünse `Int64`; çekirdek `int`, `uint`, `long` gibi sayısal CLR değerlerini de kabul eder |
| fractional number | JSON test adaptöründe `Double` |

JSON'daki `1`, `1.0` ve C# sayısal `1` değerleri aynı sayı kimliğini temsil eder. JSON dizgesi `"1"` farklı kimliktir. `Wire.Equal(1L, 1.0)` doğrudur; `Wire.Equal(1L, "1")` ve `Wire.Equal(false, 0)` yanlıştır. `Wire.TypeKey` sırasıyla `number:1` ve `string:1` üretir. Öğretici ve kampanya ID'lerini eşitlemek için dizgeye çevirip bu ayrımı kaybetmek yasaktır.

`Wire.Number` yalnız sayısal CLR tiplerini kabul eder; `"1"` veya `true` sayıya çevrilmez. `IsSafeInteger`/`Integer` JavaScript güvenli tamsayı aralığını, `-9007199254740991 .. 9007199254740991`, doğrular. `Int32` ve `UInt32` ayrıca kendi sınırlarını denetler. RNG için `4294967295` korunur; negatif veya büyük değer unsigned alana sarılarak kabul edilmez. UTC milisaniye ve deneme serileri `long` kalabilir, ancak kendi modül doğrulayıcısı güvenli JSON tamsayı sınırını da uygulamalıdır.

Wire katmanı JavaScript'in genel amaçlı yorumlayıcısı değildir. `JsString` mevcut kimlik/token alanlarının kültürden bağımsız yazımını sağlar; uygulama girdilerinin doğrulanması ilgili modülün görevidir. Geçerli JSON dışında kalan NaN/Infinity/cycle gibi nesneler yeni bir saklama sözleşmesi olarak kabul edilmez. JSON adaptörü sonlu olmayan sayı yazımını reddeder.

## Eksik alan ve null

Alan yokluğu dictionary üyeliğiyle temsil edilir. `Get` hem eksik hem açık null için kolaylık olarak null döndürebilir; bu, ikisinin aynı sözleşme olduğu anlamına gelmez.

```csharp
var nullable = Wire.Obj("from", null);
Wire.Has(nullable, "from");    // true
Wire.Has(nullable, "missing"); // false
Wire.Get(nullable, "from");    // null
Wire.Get(nullable, "missing"); // null
```

Zorunlu alanlar `Has` veya `Required` ile denetlenmelidir. `Required` eksik alanı reddeder, açık null'ı döndürür; null'ın izinli olup olmadığını modül belirler. `Wire.Equal` anahtar kümelerini karşılaştırdığı için `{ "from": null }` ile `{}` eşit değildir. Host, typed DTO'lara varsayılan sıfır/null doldurarak bozuk kaydı geçerli hale getirmemelidir.

## Kopya, sıra ve sahiplik

`Clone` map/array yapısını derin kopyalar, `Copy` map döndürür. Testte kopyanın iç dizisine yazmak orijinali değiştirmediği doğrulanmıştır. `Map` ve zaten `List<object>` olan `List` mevcut nesneyi döndürebilir; kendileri immutable veri sağlamaz. Kendi sahipliği dışına veri veren DTO'lar `ToWire` üzerinden savunmacı kopya kullanmalıdır.

Dizilerde sıra korunur: hücreler, hamle geçmişi, varyant adayları, eşleşme dalgaları ve üretilen taşlar sıralı sözleşmelerdir. JSON object alan sırası eşdeğerlik için anlamlı değildir. Deterministik seçim, CLR dictionary enumeration sırasına güvenmemeli; katalogdaki açık sıra listeleri veya gerektiğinde ordinal sıralama kullanılmalıdır.

`WireException.Code`, modüllerin makinece karşılaştırılabilir hata kodu üretmesine yardımcı olur. Ortak helper'ın genel `ArgumentException` mesajı, JS modülünün özel hata nedeni yerine kendiliğinden geçmez; ilgili modül kendi kaynak doğrulama sırasını ve nedenlerini korumalıdır.

## Gerçek doğrulama ve taşınabilirlik sınırı

Ortak dosyalar gerçek .NET 8 SDK ile `LangVersion=7.3` kullanılarak derlendi. İlk smoke çalıştırmasında **25 assertion geçti**: sayı/dizge ID ayrımı, UInt32 ve güvenli tamsayı üst sınırları, eksik/null ayrımı, iç dizide deep clone bağımsızlığı, JSON roundtrip, numeric equality, bool/string coercion reddi, truthiness, array yazımı, aralık/tür/eksik-alan reddi ve kodlu exception.

Smoke projesi geliştirme çalışma alanında `/workspace/scratch/hexrota-wire-smoke/` altında oluşturuldu; bu sayı tek başına bütün modüllerin parity kapsamı değildir. Her modülün CI'da gerçek C# derlemesini yapan kendi karşılaştırma komutu ayrıca çalışmalıdır. SDK bulunamadığında JS çıktısını C# sonucu gibi kullanan bir fallback yoktur.

C# 7.3 sözdizimi tek başına Unity çalışma zamanı uyumluluğunu kanıtlamaz. Yeni saf modüller için ayrıca JSON/Unity/I/O/doğrudan saat bağımlılığı ve yeni BCL API'leri denetlenir. .NET Standard referans yüzeyinde derleme, fiziksel Unity, Mono veya IL2CPP çalıştırması yerine sunulmamalıdır. Fiziksel iOS/Android ve Unity IL2CPP doğrulaması bu aşamada yapılmış değildir.
