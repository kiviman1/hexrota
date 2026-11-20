# Claude Code'a geçiş

## 1. Dosyaları repoya koy

Bu zip'teki `docs/design/` klasörünü repo köküne kopyala (`C:/UnityProjects/hexrota/docs/design/`). Var olan `docs/` klasörüyle birleşir; çakışan dosya yok.

İstersen `codex/unity-first-chapter-coach` dalında ayrı bir commit olarak ekle:

```
git checkout codex/unity-first-chapter-coach
git add docs/design
git commit -m "docs(design): ana ekran stil kılavuzu, wireframe, hareket ve 3D şartnameleri"
```

## 2. Claude Code'a ilk mesaj

Repo klasöründe `claude` çalıştır ve şunu yapıştır:

```
docs/design/HANDOFF.md dosyasını oku. Bu, claude.ai'de yaptığımız ana ekran ve görsel yön çalışmasının devir notu. Sonra docs/design/style-guide/README.md, hareket.md ve 3d-sanat.md dosyalarını oku; bunlar tek doğru kaynak.

İlk iş: docs/design/tasks/02-pr45-inceleme.md içindeki iki düzeltmeyi codex/home-play-button-reward-flight dalında yap (PR #45). Önce mevcut kodu oku, plan çıkar, sonra uygula ve testleri çalıştır.

Kurallar: Core/ klasörüne dokunma, yeni paket ekleme, süre ve renkleri UiTheme/MotionTheme'den oku. Türkçe konuş, kısa ve net ol.
```

## 3. Kalıcı hale getirmek (önerilir)

Claude Code her oturumda repo kökündeki `CLAUDE.md` dosyasını okur. Şu satırları `CLAUDE.md`'ye ekle (dosya yoksa oluştur):

```
## Tasarım
- Görsel yön, ana ekran ve hareket kuralları: docs/design/HANDOFF.md ve docs/design/style-guide/
- Kapsam sade: tek döngü (bölüm → Altın Yumurta → kümes). Tavuk satışı, sepet, malzeme envanteri çıkışta yok.
- Süre ve renkler kodda sabit yazılmaz: UiTheme / MotionTheme.
- Aynı anda tek dikkat animasyonu (AttentionDirector).
```

## 4. Bilmen gerekenler

- Bileşen ön izlemeleri (`style-guide/components/*/preview.html`) ve wireframe'ler (`wireframe/*.html`) tarayıcıda açılır.
- claude.ai'deki stil kılavuzu ve wireframe sayfaları yerinde duruyor; ama artık repodaki dosyalar esas. İkisini senkron tutmak istersen değişiklikleri repoda yap.
