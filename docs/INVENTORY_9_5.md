# 9.5 B — Envanter ve iki yardım

Bağımlılık: A'nın kalıcı ekonomi ledger'ı ve tek tamamlama sınırı. Saf mekanikler [ASSISTED_COMMANDS_9_5.md](ASSISTED_COMMANDS_9_5.md) içinde; bu belge oturum ve kullanıcı onayı sınırını açıklar. Classic-v4 motoru ve yayımlanmış başlangıçlar değiştirilmez.

## Açılma ve satın alma

L3 ilk doğrulanmış kazanımında üç Yeşil Fırça, L6'da üç Renk Anahtarı atomik verilir. Fırça L4'ten, anahtar L7'den itibaren tamamlanmamış oynanır ana bölümde kullanılabilir. Öğretici, kayıp, tamamlanmış bölüm ve animasyon sırasında kullanım kapalıdır. Saf mekanik sınıfı envanter otoritesi değildir; JS/C# session hem bölüm hem stok hem kullanım sınırını denetler.

Çanta ana menüde stok/bakiye bilgisini ve oyun içinde tek bir giriş düğmesini sunar. Satın alma açık 70/90 Altın düğmesiyle bir stok alır; TEST cüzdanına veya gerçek para sağlayıcısına bağlanmaz. Yetersiz bakiye ve kilitli ürün hiçbir değişiklik yaratmaz. Fiyatlar kanonik ekonomi verisinden gelir; kullanım başına stok maliyeti birdir. Denemede her ürün ayrı bir kez kullanılabilir.

## Hedef, sayı ve ön izleme

Fırçada oyuncu henüz katı olan hücreyi seçer. Bir kat azalır, puan/hamle/taş/RNG değişmez. Puan hedefi zaten sağlandıysa son katın temizlenmesi kazanma sayılır.

Anahtarda oyuncu hedef taşı ve izinli başka bir sayıyı açıkça seçer. Mevcut sayı ve palet dışı değer reddedilir. Saf komut kopyada bütünüyle çözülür; gerçek puan, temizlenen katlar, olası zincirler ve yeni durum onaydan önce hesaplanır. Anında eşleşme yoksa sıfır puanlı hazırlık hamlesi olduğu açıkça yazılır; rastgele sayı vaadi yoktur. Oynanabilirlik karıştırması gerekiyorsa ön izlemede açıklanır. Onay 1 stok harcar, sıfır hamle tüketir; iptal hiçbir mekanik veya ekonomik etki üretmez.

Onay yalnız ön izlenen duruma aittir: Attempt ID, profil revision, komut sayısı ve tam tahta durumu/parametreler bağlanır. Sadece normal takas sayacı yeterli değildir. Hedef/sayı değiştirme, başka deneme, menü, arka plan veya eski revision sonrasında yeniden ön izleme gerekir.

## Atomik komut ve yükleme

İlk yardıma kadar eski v4 kayıt korunur. İlk yardımda mevcut v4 geçmişi gerçek motorla doğrulanır ve `assisted-v1` / commandsVersion1 zarfına geçirilir. Aynı işlem kimliği ekonomi `use` satırında ve mekanik komutta bulunur. Her iki yönde doğrulanır: mevcut checkpoint'teki her yardımın aynı Attempt ID, türü korunmuş Level ID ve doğru ürün debiti olmalı; aynı mevcut denemeye ait debit de checkpoint'teki komutta bulunmalıdır. Yalnız takaslardan oluşan yeni yardım zarfı kabul edilmez. Desteklenen kullanım limitleri dışındaki kayıt yüklenmez.

Normal reset bitmemiş checkpoint'i kaldırabilir; tarihsel harcama ledger'ı korunur, bu nedenle artık checkpoint'i olmayan eski denemede ters eşleştirme aranmaz. Yeniden oynatma stok harcamaz veya puan uydurmaz. Bozuk ekonomik/komut eşleşmesi ilk profil yazımından önce yüklemeyi durdurur; yeni tahta ile değiştirmez.

Stok debiti, yeni tahta, olası kazanma/20 Altın/1 yıldız ve can sonucu tek atomik profil commit'indedir. Yazma hatasında önceki geçerli durum ve stok korunur. Sonuç ekranı ve analitik commit'ten sonra gösterilir. Aynı onayın tekrarı ikinci komut veya stok düşümü üretmez.

## İpucu ve ödül sunumu

Yardım sonrası eski yalnız takas kazanma sertifikaları kullanılmaz. İpucu güncel durumdan sınırlı arama yapar; garanti bulunursa `search_win`, aksi halde `heuristic` olabilir. Arama canlı RNG'yi değiştirmez. Eski worker'a yardım snapshot'ı gönderilmez.

Reward Director v1 klasik takaslarda aynen korunur. Yardımlı denemede eski Director sürekliliği taklit edilmez; durum/plan null bırakılır, gerçek dalga/puan/zemin üzerinden temel sunum kullanılır. Yardımlı kazanma canonical komut/ekonomi ledger'ında ve kullanıcı sonuç/kayıt görünümünde işaretlenir. Görsel yoğunluk puanı değiştirmez.

## Doğrulama komutları

`test:commands`, `test:unity-commands`, `test:inventory-ui`, `test:economy-browser`, `test:unity-session` ve mevcut `npm test`. Gerçek C# komut karşılaştırması 2.928 tam JSON senaryosu, 16.001 işlem ve 3.259 uygulanan eşleşme dalgasını kapsar; 80 eski sertifika, 680 eski kayıt öneki ve 40 varyantın her hücre hedefi dahildir. UI/native host sayıları son doğrulama kaydında ayrıca verilir; devam eden kontrol geçmiş sayılmaz. Fiziksel iPhone/Android ve Unity/IL2CPP ayrıca gerekir.
