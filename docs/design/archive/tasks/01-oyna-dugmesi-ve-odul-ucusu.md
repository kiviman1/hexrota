# Görev: Ana ekran — Oyna düğmesi ve ödül uçuşu (sunum prototipi)

## Bağlam

Hexrota'nın Unity istemcisi `unity-client/` altında (Unity 6.6, uGUI). Ana ekran görsel olarak yeniden tasarlanıyor. Bu görev yalnız **sunum katmanını** kapsar: Oyna düğmesinin görünümü ve hareketi, ödüllerin sayaçlara uçması ve tek bir "dikkat yöneticisi". Oyun kuralları, ekonomi ve kayıt mantığı **değişmez**.

- Başlangıç dalı: `codex/unity-first-chapter-coach`
- Yeni dal: `codex/home-play-button-reward-flight`
- İlgili mevcut dosyalar:
  - `Assets/Hexrota/Presentation/CastleHomeView.cs`: `playButton`, `stageLabel`, `goldValue`, `ShowStage`, `ShowWallet`
  - `Assets/Hexrota/Presentation/FirstPlayableController.Home.cs`: ana ekran kurulumu, `DrawWallet`
  - `Assets/Hexrota/Presentation/PhoneAudio.cs`: `Reward(session, RewardCue)`, `pitchStep` ile yükselen notalar
  - `Assets/Hexrota/Runtime/UnityGameSession*.cs`: `Session.ReducedMotion`, `Session.HapticsEnabled`, `PhoneWallet`
  - `Assets/Hexrota/Resources/CastleHome/CastleHome.prefab`

## Kısıtlar

- `Assets/Hexrota/Core/` altına **dokunma**. Ekonomi ve ödül değerleri mevcut kaynaklardan okunur, yeniden hesaplanmaz.
- Yeni paket ekleme (DOTween vb. yok). Animasyonlar coroutine veya `Update` ile, `Time.unscaledDeltaTime` kullanılarak yapılır.
- Kodda sabit süre veya renk sayısı olmaz; hepsi aşağıdaki iki ScriptableObject'ten okunur.
- Animasyon sırasında her karede bellek ayırma (GC) olmaz; uçan ikonlar havuzdan (pool) gelir.
- Arayüz metinleri Türkçe kalır. Mevcut testlerin hepsi geçmeye devam etmeli.

## 0. Tema varlıkları

`Assets/Hexrota/Presentation/Theme/` altında oluştur:

**`UiTheme` (ScriptableObject)**: bu görevde gereken renkler:

| Alan | Değer |
|---|---|
| cta | `#5CC531` |
| ctaDeep | `#2E7A12` |
| ctaLight | `#A6EF6A` |
| gold | `#FFC531` |
| goldDeep | `#A86A00` |
| goldLight | `#FFE89A` |
| panelDeep | `#3A1A58` |

**`MotionTheme` (ScriptableObject)**: süre (sn) + `AnimationCurve`:

| Ad | Süre | Eğri |
|---|---|---|
| tap | 0.08 | ease-out |
| release | 0.18 | back-out (overshoot ~1.6) |
| popIn | 0.30 | back-out (overshoot ~1.7) |
| popOut | 0.15 | ease-in |
| flyMin / flyMax | 0.55 / 0.75 | ease-in-out |
| flyStagger | 0.06 | — |
| punch | 0.20 | elastic-out, ölçek 1.15 |
| breathePeriod | 2.4 | sine, genlik 0.03 |
| shineInterval / shineDuration | 4.0 / 0.6 | ease-in-out |
| idleHopDelay | 8.0 | — |

Varsayılan değerlerle birer `.asset` oluştur ve sahneye/prefab'a bağla.

## 1. AttentionDirector

Ekranda aynı anda **tek bir dikkat animasyonu** oynar. Tek bir `AttentionDirector` bileşeni yaz.

- Öncelikler (küçük sayı = yüksek): `RewardFlight = 1`, `CoopUpgrade = 2`, `CoopPulse = 3`, `PlayShine = 4`, `BadgeWiggle = 5`.
- API: `bool TryAcquire(AttentionKind kind, object owner)`, `void Release(object owner)`, `event Action Changed`.
- Yüksek öncelikli bir istek gelince düşük olan sahibine `Changed` ile haber verilir; o da durup bekler. Yüksek öncelikli olan bitince bekleyen kaldığı yerden devam eder.
- Bir panel/modal açıkken (mevcut panel akışından tespit et) `PlayShine` ve `BadgeWiggle` izin alamaz.
- Ortam hareketleri (bulut, bayrak, şelale) bu sistemin dışındadır; onlara dokunma.

## 2. Oyna düğmesi (`HomePlayButton`)

`CastleHomeView.playButton` üzerine eklenen bir bileşen. Görünüm ve hareket şartları:

**Görünüm**
- Gövde `cta`, 4px `ctaDeep` kenar, altında 8px `ctaDeep` "bevel" (düğmenin kalınlığı), köşe 24px.
- Üst %38'de `ctaLight` yarı saydam (%55) parlama bandı. Gradyan kullanma.
- Etiket mevcut `stageLabel` ("Bölüm N"): beyaz, `ctaDeep` renginde kalın dış çizgi (`Outline` veya eşdeğeri) + 3px aşağı gölge.
- Genişlik ekranın ~%54'ü, yükseklik 84 birim (referans 390×844). `MobileLayout` ile uyumlu kalsın.
- Görseller mevcut sprite yoksa 9-slice olarak runtime'da üretilebilir (mevcut `CastleBevel`/`PhonePlate` yaklaşımına bak); ileride gerçek sprite ile değiştirilecek şekilde ayrı bir `Image` katmanında tut.

**Hareket**
- Nefes: ölçek 1.00 ↔ 1.03, `breathePeriod`. Panel açıkken durur.
- Parlama: `shineInterval`'da bir, eğik beyaz bant soldan sağa `shineDuration`'da geçer (`RectMask2D` içinde). **Her seferinde `AttentionDirector`'dan `PlayShine` izni ister**; izin yoksa o turu atlar.
- Boşta kalma: oyuncu `idleHopDelay` boyunca hiçbir yere dokunmazsa tek zıplama (y +6, `release` eğrisiyle).
- Basma: `tap` süresinde 4 birim aşağı iner, bevel 8 → 2'ye düşer. Bırakınca `release` ile geri döner. Mevcut `onClick` davranışı (`BeginJourney`) aynen kalır.
- `Session.ReducedMotion` açıkken nefes, parlama ve zıplama kapalıdır; basma tepkisi kalır.

## 3. Ödül uçuşu (`RewardFlight`)

Kazanılan kaynak geldiği noktadan sayacına uçar ve rakam sayarak artar.

**API**

```csharp
void Play(RewardKind kind, Vector2 fromScreenPoint, int amount, Action onComplete = null);
// RewardKind: Gold, Star  (Star ileride "Altın Yumurta" olacak; şimdilik mevcut Stars sayacı)
```

**Hedefler:** `Gold` → ana ekrandaki altın sayacının ikonu. `Star` → yıldız sayacının ikonu (`DrawWallet` içindeki ilgili öğe). Hedef ekranda yoksa uçuş anında biter ve yalnız rakam güncellenir.

**Kurallar**
- **İkon sayısı:** `amount` 1–5 ise `amount` kadar ikon, daha fazlaysa 8 ikon uçar. Miktar ikonlara dağıtılır; toplam her zaman tam `amount` olur (son ikon kalan farkı taşır). Bu dağıtımı saf bir statik fonksiyon olarak yaz (test edilecek).
- **Yol:** ikinci dereceden Bezier. Kontrol noktası yolun ortasından 60–120 birim yana kayar, yön ve miktar her ikonda biraz farklı olur.
- **Zamanlama:** ikonlar `flyStagger` arayla kalkar. Her biri `flyMin`–`flyMax` arasında rastgele süre alır. İlk 0.1 sn'de ölçek 0.6 → 1.1, varışa doğru 1.0'a iner.
- **Varış:** hedef ikon `punch` yapar. Sayaç rakamı o ikonun payı kadar artar (Türkçe binlik ayıracıyla). Son varışta küçük bir parıltı patlar (basit `Image` ölçek+alfa yeterli).
- **Ses:** her varışta `PhoneAudio.Reward` ile bir nota çalar, `pitchStep` her varışta 1 artar; son varış daha üst bir tier ile çalar.
- **Titreşim:** yalnız son varışta, `Session.HapticsEnabled` ise kısa (≤ 20 ms).
- **Dikkat:** uçuş başlarken `AttentionDirector.TryAcquire(RewardFlight)` alır, bitince bırakır. Bu sırada Oyna parlaması durur.
- **Azaltılmış hareket:** tek ikon, 0.3 sn'lik düz geçiş; ses ve rakam güncellemesi aynı.
- **Havuz:** en fazla 16 ikon önceden oluşturulur, uçuş bitince geri döner.

**Tutarlılık:** Uçuş görseldir. Cüzdan değeri mevcut akışta zaten güncellenmiş olabilir; sayaç uçuş başlarken `eski değer`i gösterip varışlarla `yeni değer`e ulaşmalı ve sonunda gerçek cüzdan değeriyle **birebir aynı** olmalı. Uçuş yarıda kesilirse (sahne değişimi, uygulama arka plana geçti) sayaç anında gerçek değere atlar.

## 4. Bağlantı: kazanma dönüşü

Doğrulanmış bir bölüm kazanımından sonra ana ekrana dönüldüğünde, mevcut ödül sonucundan (ilk kazanımda 20 Altın + 1 yıldız gibi; değerler koddan okunur, sabit yazılmaz):

1. 0.3 sn sonra `Star` uçuşu, Oyna düğmesinin merkezinden başlar.
2. Bitince `Gold` uçuşu aynı noktadan başlar.
3. İkisi bitince Oyna parlaması normal döngüsüne döner.

Ödül yoksa (tekrar oynanan bölüm) uçuş olmaz. Geliştirme için bir editör menüsü ekle: `Hexrota > Debug > Play Reward Flight (Gold 20 + Star 1)`.

## 5. Testler

`Assets/Hexrota/Tests/` altına:

- **EditMode**
  - `RewardFlight` ikon dağıtımı: `amount` 1, 3, 5, 6, 20, 1000 için ikon sayısı (1, 3, 5, 8, 8, 8) ve paylar toplamı = `amount`.
  - `AttentionDirector`: düşük öncelik çalışırken yüksek öncelik izin alır, düşük olana `Changed` gider; yüksek bırakınca düşük tekrar izin alabilir; modal açıkken `PlayShine` reddedilir.
  - `MotionTheme` ve `UiTheme` varlıkları yüklenir ve tablodaki değerleri taşır.
- **PlayMode**
  - `Gold` 20 uçuşu tamamlanınca sayaç metni cüzdan değeriyle aynı; havuzda sızıntı yok (aktif ikon kalmadı).
  - `ReducedMotion` açıkken tek ikon uçar ve süre ≤ 0.35 sn.
  - Uçuş sırasında Oyna parlaması tetiklenmez.

## Kabul ölçütleri

- [ ] Yeni dal, mevcut testlerin tamamı ve yeni testler yeşil.
- [ ] `Core/` altında değişiklik yok; yeni paket yok.
- [ ] Bütün süre/renkler `MotionTheme` / `UiTheme` varlıklarından okunuyor.
- [ ] Debug menüsüyle uçuş tetiklenince: ikonlar yay çizerek, sırayla uçuyor; sayaç zıplıyor ve sayarak artıyor; notalar yükseliyor; Oyna parlaması uçuş boyunca duruyor.
- [ ] Profiler'da uçuş sırasında kare başına GC ayırması 0.
- [ ] PR açıklamasında: değişen dosyalar, nasıl test edileceği ve bilinçli olarak yapılmayanlar listesi.

## Kapsam dışı (yapma)

Kümes düğmesi, ilerleme çubuğu, kümes yükseltme sekansı, 3D tavuklar, üst bar yeniden tasarımı ve Star → Altın Yumurta yeniden adlandırması sonraki görevlerdir.
