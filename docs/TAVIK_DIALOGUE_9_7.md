# Tavik konuşma portresi — 9.7

- Eğitimde tahtanın yanında küçük duran tam vücut karakter yerine, var olan öğretici koç kartında Tavik’in kafası konuşur.
- Kaynak, onaylı Tavik’in halihazırda projede yer alan point / call / celebrate pozlarıdır. Harici oyun karakteri kullanılmaz.
- Her yeni adımda kısa pop-in ve değişen açık gaga yüzü; başarılı hamlede mutlu gözleri kapalı poz. Yeni konuşma metni veya zorunlu bekleme eklenmez.
- Mevcut 118px öğretici kartı konuşma balonunun kendisidir; ikinci bir alt kart veya yeniden ölçeklenmiş tahta eklenmez.
- Eğitim harici tam-vücut Tavik ve ana menü aynen kalır. Görsel sistem PWA ve CSS tek kaynak hattına uyar.
- Düşük hareket tercihinde sabit poz; sekme gizlenince geçici animasyon ve zamanlayıcılar durur.
- Kayıt, RNG, can, ekonomi, başlangıç Altını, C# ve gerçek takas kuralları değişmez.
- Fiziksel iPhone testi tarayıcı otomasyonunun dışında ayrıca gerekir.

## Portre ve sahne aktörünün görünürlük sözleşmesi

`scene-presentation.update(input)` iç görünümüne `tutorialPortrait: input.tutorialPortrait === true` alanını taşır. Yalnız gerçek `true` değeri oyun ekranındaki tam-vücut aktörü gizler. Gecikmiş poz yüklenmesi, onaylı görsel yedeği ve yeniden yerleşim bu kararı değiştiremez. Ana menü aktörü korunur; portre bayrağı kaldırılınca normal sahne aktörü tekrar kullanılabilir.

T1/T2'de portre mevcut koç kartının içindedir. Portre yüzü taşları, HUD'u, düğmeleri, sayacı veya yönergeyi örtmez. Görsel yüklenemezse onaylı yedek görsel yine bu portrede gösterilir; gizli tam-vücut yedeğinin görünmesi beklenmez. Tahta ve mevcut koç kartının boyutları korunur.

Doğrulama: `npm test`, 24 sahne birim grubu ve konuşma portresi testi geçti. Bayrak yalnız test yükleyicisinde kaldırıldığında yeni görünürlük testi beklenen şekilde başarısız olur. Gerçek Chromium ve WebKit koşumları ayrı ayrı **32/32** geçti; iki eğitim altı ekran boyutunda, statik/animasyonlu görünüm, azaltılmış hareket, hatalı görsel, kayıt ve çevrimdışı akışlarla kontrol edildi. Yüz görseli gizlenip halka yerinde bırakılarak alınan piksel karşılaştırması gerçek yüzün çizildiğini doğrular. C# reward ve gameplay karşılaştırmaları gerçek .NET 8 / C# 7.3 derlemesiyle geçti. Son CI durumları PR #24'te; ekran görüntüleri ve sonuç JSON'ları CI artifact'larında bulunur.
