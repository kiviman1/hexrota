# Unity ve Android doğrulaması

18 Kasım 2026 tarihinde [61da617](https://github.com/kiviman1/hexrota/commit/61da617) mobil oyun kaynakları Unity **6000.6.9f1** ile çalıştırıldı. Doğrulama projesinin dosyaları Git arşivinden çıkarıldı. Açık kullanıcı projesinin paket değişiklikleri veya kayıtları bu testlere eklenmedi.

| Koşum | Sonuç |
| --- | --- |
| Unity Editor EditMode | **30/30 geçti**, 0 atlandı |
| Unity Editor PlayMode | **25/25 geçti**, 0 atlandı |
| Unity sahnesinde dokunma | Bölüm 1’deki 19 merkezin tamamında gerçek Canvas raycast isabeti. StandaloneInputModule üzerinden iki dokunma ve ardından sürükleme iki ayrı hamle kaydetti. Mola penceresi tahta girişini kesti. |
| Açık Windows Editor, Android hedefi, Direct3D 12 | Oyuncunun mevcut Bölüm 1’i menüden açıldı, mola ve devam çalıştı. 18:9 portre ekranda 66/85 puan, 14/19 yeşil alan ve 6 hamle korundu. [Editor'da Bölüm 1](editor-level-one.png) · [Mola](editor-pause.png) |
| Kanonik C# host testleri | 9 grup, 943 doğrulama, 40 varyant ve 80 kazanma rotası |
| Kaynak ve sahne denetimi | 34 C# kaynağı ve 15 JSON bire bir eşleşti. Öğretici metni ayrıca üretildi. Sahne referansları, GUID ve assembly ayrımı dahil altı kontrol geçti. |
| Android player | Strict geliştirme derlemesi, IL2CPP, arm64-v8a. Android 8.0 ve üstü, hedef API 36, portre, titreşim izni. APK Signature Scheme v2 ile doğrulandı. |
| Fiziksel cihaz | ADB bağlı cihaz göstermedi. Android donanımı, iOS, fiziksel titreşim, çentik ve sistemden dönüş bu koşuma dahil edilmedi. |

[Test adları, süreleri ve özgün Unity XML dosyalarının SHA-256 değerleri](editor-tests.json) kayıtlıdır. Yerel çıktılar `test-results/phone-parity/accepted-edit.xml`, `accepted-play.xml` ve `accepted-android.log` dosyalarındadır.

Android paketi bilgisayarda `unity-client/Builds/Android/Hexrota.apk` konumunda. 55.174.028 bayt, paket kimliği `com.hexrota.client`, SHA-256 `08DDCAF487E1817B2F6216226EC73A520548DD790567DC211F10E52C69E2FFB4`. Oyun içeriğinin kaynak sürümü yukarıdaki Git commit’idir. Android paket etiketi Unity Foundation projesindeki 9.11.0 değerini taşır.

[Görsel karşılaştırma](GORSEL-KARSILASTIRMA.md) ve [özellik matrisi](README.md) ekran kabulünü ve açık işleri gösterir. Genişletilmiş geliştirici kampanyalarının etkileşimli Unity girişleri ve fiziksel cihaz kabulleri açık kalır.
