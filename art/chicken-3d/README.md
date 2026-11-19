# Rigli tavuk prototipi

`ChickenRig.blend`, `scripts/generate_home_chicken.py` ile ayrı bir Blender sürecinde üretilen düzenlenebilir kaynaktır. Unity modeli `unity-client/Assets/Hexrota/Art/Chicken3D/ChickenRig.fbx` içindedir.

Model 3016 vertex, 5888 üçgen ve altı kemik içerir. FBX; 24 fps olarak tasarlanmış Idle (1–49 kare), Walk (1–25) ve Flap (1–25) kliplerini içerir. Blender'da yeniden içe aktarma kontrolü `scripts/validate_home_chicken.py` ile yapılabilir.

Bu model basit, düz renkli, prosedürel bir prototiptir. Referans görsellerdeki ayrıntılı doku ve karakter kalitesine ulaşmaz; ayrıca kullanıcı arayüzüne veya mevcut ana sahneye otomatik olarak bağlanmamıştır. Kemik ağırlıkları parça bazındadır; yüz mimikleri, göz kırpma, yem yeme ve yumuşak tüy deformasyonu henüz yoktur. Mobil cihaz üzerinde performans ölçümü yapılmamıştır.
