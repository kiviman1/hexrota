# Görev 03 — Kümes düğmesi, ilerleme çubuğu, yükseltme sekansı

Ön koşul: PR #45 main'e merge edilmiş olmalı. Yeni dal: `feature/coop-upgrade` (main'den).
Referans: `docs/design/HANDOFF.md`, `docs/design/style-guide/` (tokens.json, hareket.md, components/), `docs/design/wireframe/Main.html` ve `WinReturn.html`.

## Aşama 0 — Yıldız → Altın Yumurta (ayrı commit)
- Oyuncuya görünen her yerde "Yıldız" → "Altın Yumurta" (metin, ikon placeholder'ı, ödül uçuşu ikonu).
- Kod içi isim değişikliği: `Stars` → `GoldenEggs`. Kayıt dosyasında eski alan okunup yenisine taşınsın (migration). Eski kaydı olan oyuncu hiçbir şey kaybetmesin.
- Kazanım kuralı aynı kalır: bölüm ilk kez kazanılınca 1 yumurta, tekrarda 0.
- Test: eski formatlı kayıt yüklenince yumurta sayısı doğru geliyor.

## Aşama 1 — Veri ve kurallar
- `CoopConfig` ScriptableObject: alan başına yükseltme listesi (maliyet, yükseltme sonrası gelen tavuk sayısı).
- İlk alan için 5 yükseltme, maliyetler: 6, 8, 10, 12, 14 (toplam 50 ≈ 50 bölüm). Değerler sadece asset'te, kodda sayı yok.
- Kayıtta: mevcut alan, kümes seviyesi. Yükseltme tek işlemde: yumurta düş + seviye artır + kaydet (yarıda kalırsa ikisi de olmamış sayılsın).
- Yetersiz yumurtada yükseltme reddedilir, hiçbir şey değişmez.
- 5. yükseltmeden sonra "Alan tamamlandı" durumu. Yeni alana geçiş (Tavik) bu görevin kapsamı dışında; sadece durum bayrağı ve placeholder metin.
- EditMode testleri: maliyet düşümü, yetersiz bakiye, kaydet/yükle, son seviyede yükseltme yok, alan tamamlandı bayrağı.

## Aşama 2 — Ana ekran: kümes düğmesi + ilerleme çubuğu
- Kümesin altında/yanında (wireframe Main.html'e göre) ilerleme çubuğu: `mevcut yumurta / sonraki maliyet`, üstünde yumurta ikonu ve sayı.
- Çubuk dolunca kümes düğmesi "hazır" durumuna geçer: `AttentionDirector` üzerinden **CoopPulse (öncelik 3)** nabzı. Oyna düğmesinin parıltısı (4) bu sırada susar.
- Ödül uçuşu (1) bitmeden nabız başlamaz. Modal açıkken nabız yok.
- Kümes 3D değil henüz: placeholder görsel (sprite veya basit primitive) yeter. Seviye değişince placeholder değişsin (ölçek ya da renk), sadece okunabilirlik için.

## Aşama 3 — Yükseltme paneli
- Kümese ya da düğmeye dokununca panel: mor panel + altın kurdele başlık ("Kümes Seviye N") + krem kart içinde ne geleceği (tavuk sayısı) + maliyet + tek ana düğme "Yükselt".
- Yetersiz bakiye: düğme pasif görünümde, altında "X yumurta daha" yazısı. Pasif düğmeye basınca hafif sallanma, başka şey yok.
- Renk, köşe, bevel, süreler `UiTheme` / `MotionTheme`'den. Sabit sayı yazma; gerekiyorsa temaya alan ekle.

## Aşama 4 — Yükseltme sekansı (öncelik 2, CoopUpgrade)
Sıra ve yaklaşık süreler (hepsi MotionTheme'e):
1. Panel kapanır (0.2s).
2. Yumurtalar sayaçtan kümese uçar (RewardFlight havuzu ve eğrisi tersine kullanılabilir; ≤8 ikon). Sayaç her varışta azalır.
3. Kümes "squash & stretch" + toz/ışık patlaması placeholder'ı (0.4s), haptik.
4. Seviye placeholder'ı değişir, kısa "Seviye N!" yazısı.
5. Yeni tavuk(lar) placeholder olarak kümesin yanında belirir (0.3s, stagger).
6. İlerleme çubuğu sıfırlanıp yeni maliyete dolar.
- Sekans sırasında girdi kilitli; bitince kilit kalkar. Uygulama arka plana giderse sekans sonucu kaydedilmiş olsun (veri işlemi adım 1'den önce biter, sekans sadece görsel).
- Reduced motion: tek ikon, tek ölçek darbesi, ≤0.5s toplam.
- PlayMode testleri: sekans bitince bakiye ve seviye doğru; sekans ortasında iptal (ör. sahne değişimi) veri bütünlüğünü bozmuyor; sekans sırasında başka dikkat animasyonu oynamıyor.

## Kapsam dışı
Gerçek 3D kümes/tavuk, URP geçişi, yeni alan geçişi, tavuk büyümesi (civciv→tavuk), ses tasarımı (mevcut PhoneAudio.Reward yeterli).

## Teslim
- Aşama başına ayrı commit. Testler yeşil.
- `Home-CoopUpgrade.png` ekran görüntüsü (hazır durumda kümes + panel açık) ve sekansın kısa kaydı varsa ekle.
- PR aç, açıklamada: neler yapıldı, MotionTheme/UiTheme'e eklenen alanlar, bilinen eksikler.
- Belirsiz bir tasarım kararında dur ve sor; kendi kafana göre yeni mekanik ekleme.
