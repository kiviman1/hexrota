# Tavik 3D prototype

This asset is a manually generated, editable, low-poly Blender interpretation of the approved Tavik 2D concept. It is a prototype rather than an exact production sculpt: the character has a cream body, large purple eye surrounds, red crest and scarf, orange beak and feet, gold-and-turquoise goggles, pendant, backpack, purple wings and tail. The source character reference is `unity-client/Assets/Hexrota/Resources/CoopArt/idle.png` and the approved design brief is `data/tavik-approved.json`.

- Editable Blender source: `art/tavik-3d/TavikPrototype.blend`.
- Unity-importable FBX: `unity-client/Assets/Hexrota/Art/Tavik3D/TavikPrototype.fbx`.
- Source generator: `scripts/generate_tavik_prototype.py`.
- Rendered reference preview: `art/tavik-3d/TavikPrototypePreview.png`.

The mesh contains 6,520 vertices and 12,840 triangles, with seven bones and rigid per-component bone weights. Blender actions and exported FBX clips are named Idle (49 frames), Walk (25 frames), and Flap (25 frames), authored at 24 fps and in place. The clip endpoints match. The action set was checked by re-importing the FBX into Blender: all three clips and seven bones were present, the Walk left leg rotated between +25 and -25 degrees, the Flap wing reached 45 degrees, and the Idle clip left those limbs at rest.

The model uses simple geometric primitives and flat-color materials, not a textured or production-quality character sculpt. There are no face, eye-blink, mouth, finger or deformable-feather rigs, no root motion, and no authored peck/sleep animation. The asset is not installed in a Unity scene or prefab, and actual mobile performance or Unity runtime animation playback has not been measured. A lower triangle count, texture atlas, skinned feather joints, polished character sculpt, grounded feet, and mobile device profiling remain appropriate before production.

To regenerate with Blender 5.3:

```
"C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" -b --python scripts/generate_tavik_prototype.py
```
