# Kümes modelleri — işleme raporu

`process_tripo.py` çıktısı. Üçgenler Blender'ın gerçek üçgen sayısıdır.

| Seviye | Kaynak üçgen | Disk üst bandı (m) | Silinen yüz | Disk sonrası | Decimate | Son üçgen | Bütçe | Kaynak doku | Boyut (G × D × Y, m) |
|---|---|---|---|---|---|---|---|---|---|
| CP_L0 | 1598 | 0.050–0.065 | 151 | 1447 | hayır | 1447 | 2000 | 4096×4096 → 2048² | 0.97 × 0.86 × 0.50 |
| CP_L1 | 4600 | 0.035–0.050 | 638 | 3962 | hayır | 3962 | 5000 | 4096×4096 → 2048² | 0.93 × 0.76 × 0.99 |
| CP_L2 | 6279 | 0.050–0.065 | 483 | 5796 | hayır | 5796 | 7000 | 4096×4096 → 2048² | 0.97 × 0.93 × 0.97 |
| CP_L3 | 8509 | 0.100–0.105 | 1457 | 7052 | hayır | 7052 | 9000 | 4096×4096 → 2048² | 0.93 × 0.94 × 0.85 |
| CP_L4 | 13981 | 0.035–0.060 | 1163 | 12818 | hayır | 12818 | 15000 | 4096×4096 → 2048² | 0.97 × 0.93 × 0.79 |

Pivot zemin merkezinde (silinen disk üst bandının ortası z = 0), ölçek metre, ön yüz (kapı) Blender −Y → Unity −Z (kümes kamerası bu taraftan bakar).
