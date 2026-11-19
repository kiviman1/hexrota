# Taş hareketi karşılaştırması

[Unity GameView videosu](tas-animasyonu-karsilastirma.mp4)

Dört sütun aynı Bölüm 1 açılışını ve aynı takası gösterir. Sırasıyla ilk doluş, takas eşiğinden kısa süre önce tutulan taş, takas, eşleşme ve yeniden doluş görünür. Önceki hareket de özgün taş malzemeleriyle kaydedildi. Böylece fark yalnızca animasyondan gelir.

## Inspector ayarları

`FirstPlayable` sahnesindeki **Hexrota → FirstPlayableController → Stone Motion** alanından dört değer düzenlenebilir. Oyunda **Balanced** değerleri varsayılan olarak kullanılır. Tablodaki diğer iki sütun videodaki karşılaştırma ayarlarıdır.

| Ayar | Subtle | Balanced | Bouncy |
| --- | ---: | ---: | ---: |
| Softness | 0,32 | 0,56 | 0,82 |
| Squash Amount | 0,09 | 0,14 | 0,22 |
| Stretch Amount | 0,075 | 0,115 | 0,18 |
| Bounce Damping | 7,0 | 5,2 | 3,4 |

## Sürükleme ve hareket

Parmağı hücreler arasında takip eden eski önizleme, yön hakkında daha uzun süre görsel geri bildirim veriyordu. Bu sürümde taşın merkezi hücresinde kalır ve parmak hareketiyle o yönde esner. Böylece oyuncu hareketin algılandığını görür. Yön eşiğinde takas hemen başlar, aynı dokunuş ikinci bir hamle göndermez.

Taşlar düşüşte dikey uzar, temas anında genişleyip sıkışır ve küçük bir sekmeyle toparlanır. Eşleşen taşlar merkeze toplanırken hafifçe sıkışıp saydamlaşır. Üç ipucu hareketi yaklaşık 1,8 saniyede tamamlanır.

## Görsel kontrol

`BoardFacet.shader` ve `StoneToneRelief.mat` dosyaları Gel Surface eklenmeden önceki sürümle birebir eşleşti. 360×640 GameView kayıtlarında, ilk takas ve doluş bitince tahta bölgesinin piksel özeti dört hareket seçeneğinde de aynı çıktı.

## Test sonuçları

Unity **6000.6.9f1** üzerinde **51 EditMode ve 66 PlayMode testi** geçti. Ek GameView koşuları önceki animasyonu ve üç yeni ayarı kaydetti. Dört Inspector alanı da Unity'nin serileştirilmiş sahne nesnesi üzerinden doğrulandı. Sürüklemenin geri alınması ve iptalinde taşın ölçeği ile dönüşü geri yükleniyor. İlk doluş testinde dikey uzama, temasta sıkışma, sekme ve dinlenme pozu doğrulandı. Build alınmadı.
