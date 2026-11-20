# PlayButton

Ana ekrandaki tek birincil eylem; her zaman "Bölüm N" yazar ve ekranın en doygun, en büyük öğesidir.

- Konum: alt-orta, alt navigasyonun hemen üstü, başparmak bölgesi. Genişlik ekranın ~%50–55'i, yükseklik 84px (1x).
- Renk: `cta` gövde, `cta-deep` kontur + 8px bevel, `cta-light` üst parlama bandı. Etiket `display-xl`, beyaz, `stroke-label` kalınlığında `cta-deep` kontur.
- Zorluk: zor bölümde düğme rengi değişmez, etrafına `rarity-epic` halka eklenir. Oyuncu rengi "oyna" ile eşleştirmeye devam eder.
- Hareket: sürekli %3 "nefes" (2.4 sn) + 4 sn'de bir parlama süpürmesi. Ekranda başka bir dikkat animasyonu oynarken parlama bekler (bkz. README → Hareket bütçesi).
- Basınca 4px aşağı iner, bevel 2px'e düşer; bırakınca hafif overshoot ile döner.
- Unity: 9-slice sprite (gövde + kontur + bevel tek parça), parlama bandı ayrı Image, etiket TextMeshPro outline 0.3 + underlay.
