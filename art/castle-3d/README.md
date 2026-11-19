# Modüler kale prototipi

`CastleModules.blend` Blender kaynağı ve `CastleModules.fbx` dışa aktarılmış modeldir. FBX'in Unity kopyası `unity-client/Assets/Hexrota/Art/Castle3D/CastleModules.fbx` konumundadır. Duvarlar, üç kule gövdesi, çatıları, giriş, merdivenler, fenerler ve bayraklıklar ayrı nesnelerdir. `scripts/generate_modular_castle.py` modeli üretir; `scripts/validate_modular_castle.py` FBX'i yeniden içe aktararak ana parçaları denetler.

FBX 86 mesh nesnesi, 5.530 vertex ve 10.800 üçgen içerir. Geometri basittir; ancak 86 ayrı nesnenin ve çoklu materyallerin çizim çağrısı maliyeti için atlas/birleştirme ve gerçek cihaz profillemesi gereklidir. Model; düz renkli, prosedürel bir taslak olup referanstaki ayrıntılı taş, tüy, bitki ve malzeme kalitesini karşılamaz. Şu anda Unity ana sahnesine bağlanmamıştır; kumaş animasyonu, tavuk heykeli ve fiziksel davranış içermez.
