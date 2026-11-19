# ProgressBar

Bir sonraki kümes yükseltmesine ne kadar kaldığını gösteren çubuk; Oyna düğmesinin hemen üstünde veya kümes düğmesinde durur.

- Sol uçta para birimi ikonu taşar (Altın Yumurta). Ortada `X / Y` ya da dolunca "Hazır!".
- Dolum `cta`, iç bevel `cta-deep` alt / `cta-light` üst. Zemin `panel-deep`.
- Artış animasyonu: yumurta ikona uçar → çubuk 0.4 sn ease-out ile dolar → dolunca kırmızı altıgen rozet + kümes düğmesi nabız atar.
- Çubuk asla geri gitmez; harcama anında sıfırlanır ve yeni hedefle tekrar dolmaya başlar.
