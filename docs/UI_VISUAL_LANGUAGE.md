# Hexrota — Comic Adventure görsel dili

## Kaynak ve tasarım

15 Kasım 2026'da gönderilen üç kullanıcı referansı yön belirler: mor/altın hikâye kartı, krem ayar paneli, kırmızı kurdele başlığı ve parlak oyun düğmeleri. Başka oyunların ekran görüntüleri veya karakterleri projeye kopyalanmadı.

Dünya koyu mor, paneller sıcak krem ve altın çerçeveli, başlıklar mercan kurdele, ana düğmeler parlak yeşil, ikincil düğmeler mor. Tahta arkasında sakin bir renk alanı korunur. Fontlar sistem fontlarıdır; uzak font veya izleyici bağımlılığı yoktur.

## Kaynak sahipliği

- `src/styles/06-comic-adventure.css`: tek tema bölümü, `body[data-ui-theme="comic"]` altında. CSS kaynağını burada düzenle.
- `src/styles/manifest.json`: kaynak sırası. `npm run styles:sync` tek `dist/style.css` üretir; ikinci bir paketleme hattı kurma.
- `data/ui-comic-tokens.json`: renk/font/varlık sözlüğü; Unity için referans, oyun kuralı değil.
- `dist/assets/ui/adventure-book.svg`: özgün açık macera kitabı, sayılı altıgenler ve yıldızlı yol.
- `dist/assets/ui/adventure-backdrop.svg`: özgün mor altıgen dokulu dünya.
- `dist/assets/ui/hex-star-badge.svg`: özgün altın yıldız/altıgen rozet.
- `dist/ui-kit.html`: canlı CSS düğmeleri, ayar/ödül/kurtarma ve hikâye açılış örneği. Normal oyuncu menüsünden açılmaz.

Üç SVG PWA v30 allowlist'inde ve offline preload listesinde yer alır. Düğme metinleri resme gömülmez. Odak, basış, devre dışı ve azaltılmış hareket durumları tanımlıdır. Düğmeye basmak boyutu veya tahtanın yerleşimini değiştirmez.

## Ürün sınırı

Bu PR yalnız görsel katmandır. Altın, yıldız, envanter, can, kurtarma, kayıt biçimi ve 40 varyant/80 kazanma yolu değişmez. Bahçe→çizgi roman ilerlemesi henüz uygulanmış değildir. Kitte “Oku” yalnız demo mesajı gösterir; yıldız, ödül veya kayıt üretmez.

Tavuk tasarımı onaylanmadığı için ürüne karakter eklenmedi. Önceki görsellerdeki isim veya maskot bu çalışma ile ürün kararı hâline gelmez.

## Codex devam rehberi

1. Bu dosyayı ve `ARCHITECTURE.md` dosyasını oku. Kullanıcı onayı olmadan main/Production değişmez.
2. Yeni görünümü mevcut tema bölümünde geliştir; ekonomi veya C# kuralını görünüm için değiştirme.
3. DOM kimliklerini ve olay bağlantılarını, `[hidden]`, klavye odağını ve uzun modal kaydırmasını koru.
4. “Animasyonu geç” veya kalıcı alt açıklama şeridini geri getirme. Tahta boyutu ve hücre hitbox'ları sabit kalsın.
5. Asset eklenirse PWA ve test sözleşmesini güncelle; dış font/izleyici ekleme.
6. `npm test`, iki tarayıcıda `npm run test:comic-ui-browser`, mevcut mobil/piksel/ekonomi kontrollerini çalıştır. Fiziksel iPhone testini ayrı raporla.
7. Hikâye sistemi sonraki ayrı PR'dır: kazanılmış yıldızları koru, okunmuş ve açılmış bölümleri ayır, tekrar okuma ödül vermesin. Kit görselini gerçek çalışan ilerleme gibi sunma.
