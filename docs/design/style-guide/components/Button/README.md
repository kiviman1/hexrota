# Button

Panel ve diyaloglardaki düğme kiti; renk anlam taşır, süs için seçilmez.

| Varyant | Token | Ne zaman |
|---|---|---|
| varsayılan (yeşil) | `cta` | Panelin ana eylemi: Başla, Topla, Kur. Bir panelde tek. |
| `secondary` (mavi) | `sky` | Bilgi, Daha sonra, Detay. |
| `buy` (altın) | `gold` | Altın veya yumurta harcayan her şey; etiket fiyatı yazar ("140 Altın"). |
| `danger` (kırmızı) | `heart` | Geri alınamayan: Vazgeç, Bölümden çık. |
| `disabled` | `disabled` | Yetersiz kaynak veya kilit; dokununca nedenini söyleyen balon çıkar. |

- Boyut: 56px standart, 40px `small`. Dokunma alanı en az 48px.
- Etiket fiil ile başlar, en fazla iki kelime. Fiyat düğmede, açıklama düğmenin dışında.
- Gerçek para düğmesi her zaman yerel fiyatı gösterir (₺, £) ve `buy` varyantıdır.
