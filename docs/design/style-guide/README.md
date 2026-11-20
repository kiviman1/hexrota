# Hexrota — stil kılavuzu

> Ürün kararları ve kapsam için tek kaynak: [../PRODUCT.md](../PRODUCT.md). Bu kılavuz yalnız görsel kuralları tutar.
>
> **Taslak v0.1.** Oyunun adı, logosu ve bütün görseller geçicidir. Bu kılavuz isimden bağımsız kuralları sabitler: renk, ışık, kontur, yazı tipi, düğme ve panel kiti. İsim değişince yalnız logo ve kapak güncellenir.

Hexrota, altıgen tahtada oynanan bir eşleştirme oyunu. Ana ekranın kalbi büyüyen bir **kümes** ve içinde yaşayan **tavuklar**. Ton sıcak, parlak ve oyuncak gibi; ama ekran her zaman derli toplu. Kıyas noktası Royal Match sadeliği ile Playrix'in karakter sıcaklığıdır.

## İlkeler

1. **Tek kahraman, tek eylem.** Her ekranda göz önce bir şeye gider: ana ekranda kümes, sonra Oyna düğmesi. Geri kalan her şey ikincildir.
2. **Arayüz oyuncak, dünya resim.** Arayüz kalın konturlu, bevelli ve dokunulası durur. Dünya sanatı konturlu değildir, boyanmış görünür. Böylece ikisi asla birbirine karışmaz.
3. **Ödül her zaman yolculuk yapar.** Kazanılan kaynak geldiği yerden sayacına uçar, harcanan kaynak sayacından hedefine uçar. Rakam değişip geçmez.
4. **Az ama büyük.** Kümese eklenen her parça uzaktan görülür (çatı, kule, tünek). Vazo boyutunda ödül verilmez.

## Dünya ve arayüz: iki katman

| | Dünya (sahne) | Arayüz (UI) |
|---|---|---|
| Teknik | El boyaması 2D: kümes, tavuklar ve Tavik sprite, arka plan boyalı katmanlar | 2D sprite (9-slice) |
| Palet | `world-*` tokenları: gök, çimen, tahta, kiremit, taş | `panel`, `cta`, `gold`, `sky`, `heart` |
| Doygunluk | Orta-yüksek | En yüksek: düğme her zaman sahneden daha parlak |
| Kontur | Yok, en fazla çok ince ve koyu ton | Kalın: `stroke-ui` (4px), rengin kendi koyu tonu |
| Gölge | Boyalı: 2–3 kademeli yumuşak gölge, mor tonlu | Sert bevel (`bevel`) + `shadow-drop` |

Mor panel (`panel`) bilinçli bir seçim: yeşil-sarı dünyanın tamamlayıcısıdır. Paneller sahnenin üstünde hep "ayrı bir katman" gibi okunur. Royal Match'teki mavi-altın ikilisinin bizdeki karşılığı **mor-altın**dır.

## Işık, kontur, derinlik

- **Tek ışık: sol üstten, sıcak.** Dünya sanatı, ikonlar, düğme parlamaları ve gölgeler aynı yönü izler. Gölge sağ alta düşer.
- **Kontur kuralı:** arayüzde kontur hep dolgunun koyu tonudur (`cta` → `cta-deep`, `gold` → `gold-deep`). Saf siyah kontur kullanılmaz.
- **Bevel:** her dokunulabilir öğenin altında `bevel` kalınlığında koyu bir "yüz" vardır. Basınca bu yüz 2px'e iner; düğme fiziksel olarak çöker.
- **Parlama bandı:** düğmelerin üst %38'inde dolgunun açık tonu (`cta-light`, `gold-light`) yarı saydam bir bant. Hiç gradyan kullanılmaz; derinliği bant + bevel verir.

## Renk

Renkler anlam taşır; süs için seçilmez.

- `cta` (yeşil): "ilerle". Oyna, Başla, Topla. **Ekranda en fazla bir tane.**
- `gold` (altın): para ve değer. Altın, Altın Yumurta, satın alma düğmesi, efsanevi tavuk.
- `sky` (mavi): ikincil eylem ve nadir tavuk.
- `heart` (kırmızı): can, uyarı rozeti, kapat. Başka hiçbir yerde kullanılmaz.
- `panel` / `panel-deep` / `panel-inset`: diyalog katmanları. Metin `on-panel` (beyaz, 9.8:1).
- `cream` + `ink`: panel içindeki okunacak açıklamalar (15:1). Uzun metin hiçbir zaman doğrudan sahnenin üstüne yazılmaz; her zaman krem karta ya da mor panele oturur.
- **Erişilebilirlik notu:** renkli düğmelerdeki beyaz etiketlerin dolguya karşı kontrastı düşüktür (ör. `cta` üzerinde beyaz 2.2:1). Okunabilirliği her zaman `stroke-label` kalınlığındaki koyu kontur sağlar. Konturu olmayan beyaz etiket yasaktır.

## Tipografi

İki aile:

- **Display — Lilita One:** kalın, yuvarlak, tek ağırlık. Düğme etiketleri, başlıklar, rakamlar. Her zaman beyaz + koyu kontur (+ isteğe bağlı 3px aşağı gölge). Stiller: `display-xl` 48, `display-l` 32, `display-m` 24, `display-s` 20.
- **Metin — Nunito 700/800:** açıklama ve talimat. Konturlu yazılmaz; krem veya mor zemin üzerinde düz metin. Stiller: `body-l` 17, `body` 15, `caption` 13.

Kurallar: başlık en fazla iki kelime; düğme etiketi fiille başlar ("Kümesi büyüt", "Topla"). Rakamlarda binlik ayıracı nokta ("1.250"). İkisi de OFL lisanslı; Unity'de TextMeshPro font asset'ine Türkçe karakterler (ğ ü ş ı İ ö ç) eklenmeli. Nihai marka fontu değişebilir, kurallar değişmez.

## Para birimleri

Oyunda **üç kaynak** vardır, dördüncüsü eklenmez:

| Kaynak | Nasıl kazanılır | Nereye harcanır | Renk |
|---|---|---|---|
| **Can** | Zamanla dolar | Bölüm denemesi | `heart` |
| **Altın** | Bölüm kazanınca az az, satın alma | +5 hamle, güçlendiriciler | `gold` |
| **Altın Yumurta** | Her bölüm kazanımı | Yalnız kümes yükseltmeleri | `gold` + parlama |

Altın Yumurta, eski "yıldız"ın yerini alır ve parayla satılmaz. Böylece kümes ilerlemesi her zaman oynamaya bağlı kalır. Tavuklar Altın Yumurta bırakmaz; tahtadaki malzemeler (Tahta, Çivi…) yalnız bölüm içi hedeftir, envantere girmez.

## İkonografi ve şekil dili

- **Altıgen imzadır.** Bildirim rozetleri, seviye rozetleri, ikon çerçeveleri ve ilerleme noktaları altıgendir (`HexBadge`). Bu türde karakterli bir ana ekrana sahip altıgen oyunu yok; şekil bizi ayırır.
- İkonlar dünya objelerinden türetilir ama sadeleştirilir: 2–3 ton dolgu, `*-deep` kontur, sol üstte beyaz parlama lekesi.
- İkon boyutu: üst bar 46px, yan ray 64px, panel içi 32px (1x).

## Ana ekran yerleşimi (portrait)

1. **Üst bar** (~%9): profil · Can · Altın · Altın Yumurta (`CurrencyPill`).
2. **Kahraman sahne** (~%55): kümes tam ortada; tavuklar kümesin önünde dolaşır. Ekranın ortası boş bırakılmaz, üstüne yazı yazılmaz.
3. **Yan raylar:** her yanda en fazla 3 ikon, fazlası "+" grubuna katlanır. İlk oturumda hiç yok.
4. **Kümes düğmesi + ilerleme** (sol alt): `ProgressBar` ile "sonraki yükseltmeye 4 yumurta".
5. **Oyna** (alt orta): `PlayButton`, "Bölüm 12".
6. **Alt navigasyon:** Mağaza · Alanlar · **Ana** · Etkinlik. Takım sekmesi yok. Kilitli sekmeler gri ve kilitli görünür.

## Hareket bütçesi (özet)

Ayrıntılar, süreler ve sekanslar: **Hareket şartnamesi** bölümü. Temel kurallar:

- **Aynı anda tek dikkat animasyonu.** Öncelik: ödül uçuşu > kümes "Hazır!" nabzı > Oyna parlaması > rozet sallanması.
- **Ortam sürekli, ama sessiz:** bulut, bayrak, tavuk göz kırpma ve gagalama, düşük genlikli.
- **Periyodik vuruş 4–6 sn'de bir:** bir tavuk bir şey yapar ya da Oyna parlar. İkisi birden asla.
- **Dokunma tepkisi her şeyde:** kümese dokununca sallanır, tavuğa dokununca 3–4 tepkiden biri oynar.
- Eğri: giriş ease-out + hafif overshoot; çıkış girişten hızlı.

## Kümes, alanlar ve tavuklar

**Kapsam kuralı: rakipler kadar sade.** Tek ilerleme döngüsü var: bölüm oyna → Altın Yumurta → kümesi büyüt. Tavuk satın alma, yumurta satışı ve kalıcı malzeme envanteri çıkışta yok; ileride canlı içerik olarak eklenebilir.

- **Alan:** Her kümes bir alandır: 4 yükseltme, maliyet 1/2/3/4 Altın Yumurta (toplam 10). Alan bitince Tavik oyuncuyu yeni bir yere taşır: değirmen, sahil, dağ çiftliği, kale avlusu… Soft launch'ta 2–3 alan; gerisi güncellemelerle.
- Kümes seviyeleri görsel olarak **büyür**; her yükseltme uzaktan fark edilir bir siluet değişimidir.
- **Tavuklar satın alınmaz, kümesle gelir.** Bazı yükseltmeler yeni bir sakin getirir; bazıları mevcut sakini büyütür (civciv → piliç → tavuk). Bir alanda en fazla 6–8 sakin; ana ekran yalnız şu anki alanı gösterir.
- Her alanın kendine has 2–3 tavuk cinsi vardır. Eski alanlar ve sakinleri alt menüdeki **Alanlar** sekmesinden ziyaret edilir.
- Tavuklar el boyaması 2D sprite'tır; cinsler aynı çizim kalıbında renk, tüy ve aksesuarla ayrılır.

## Yapma

- Ayrı bir "Dokun ve başla" açılış ekranı koyma; oyun doğrudan ana ekrana açılır.
- Sahnenin üstüne uzun metin yazma.
- Aynı anda birden fazla şeyi zıplatma; rozet enflasyonu yaratma.
- Mor panel üzerinde destansı mor (`rarity-epic`) kullanma; krem kartın üstüne koy.
- Siyah kontur, gradyan zemin ya da ince (1px) çizgi kullanma.

## Unity notları

- Düğme, panel, hap ve rozet gövdeleri **9-slice sprite**; parlama bandı ayrı Image.
- Etiket konturu: TextMeshPro outline + underlay (aşağı gölge). Tokenlar bir `UiTheme` ScriptableObject'e taşınır, renkler koddan değil oradan okunur.
- Mevcut mor pencereler (Ayarlar, Canlar, Bir plan daha?) bu kılavuzun `Panel` kalıbına zaten yakın; kurdele, kapat düğmesi ve krem kart eklenerek hizalanır.

## Bu sistemi kullanmak

Renk, yazı, boşluk, köşe, kontur ve gölge değerleri `tokens.json` dosyasındadır; tasarımlar renkleri buradan alır. Bileşen kalıpları `components/bundle.css` içinde düz HTML/CSS sınıflarıdır (`hx-btn`, `hx-panel`, `hx-pill`…); React bileşeni yoktur. Fontlar Google Fonts'tan: Lilita One, Nunito 700/800.
