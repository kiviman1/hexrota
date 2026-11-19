# Hexrota Blender asset pipeline — 9.11

9.11 includes **temporary geometric art only**. No local Blender source was available. The checked-in Unity prefabs and `HexrotaAssets.asset` are permanent binding points; their current meshes/materials are placeholders. Replacing a model must never change cells, coordinates, tile values, layer counts, move history, seeds, economy, or saved IDs.

## Source and naming

Keep editable `.blend` sources outside runtime `Resources`; import reviewed FBX and textures into `unity-client/Assets/Hexrota/Art/Imported/<category>/`. The visual catalog is `unity-client/Assets/Hexrota/Art/HexrotaAssets.asset`. Preserve its `.meta` GUID and prefab wrapper `.meta` GUIDs when replacing visual children. Gameplay uses numeric cell indices from the canonical level; object names never resolve game state.

| Catalog slot | Current wrapper | Replacement contract |
| --- | --- | --- |
| cell | `PLACEHOLDER_Cell.prefab` | Flat-top hex frame; origin at cell center |
| ground | `PLACEHOLDER_Ground.prefab` | Terrain layer visual, independent of falling stone |
| stone | `PLACEHOLDER_NumberedStone.prefab` | Neutral numbered-stone body; presentation supplies number |
| selectionEffect | `PLACEHOLDER_Selection.prefab` | Noninteractive selection accent |
| matchEffect | `PLACEHOLDER_Match.prefab` | Disposable matched-cell effect |
| fallEffect | `PLACEHOLDER_Fall.prefab` | Disposable fall/refill accent |
| clearEffect | `PLACEHOLDER_Clear.prefab` | Disposable cleared-ground effect |
| tavik | `PLACEHOLDER_Tavik.prefab` | Character visual; no game controller or provider SDK |
| environment | `PLACEHOLDER_Environment.prefab` | Level backdrop/decor wrapper |
| gardenObject | `PLACEHOLDER_GardenObject.prefab` | Garden decoration; ownership remains in application state |
| menuVisual | `PLACEHOLDER_MenuVisual.prefab` | Menu decoration |
| uiVisual | `PLACEHOLDER_UIVisual.prefab` | Interface accent; interaction remains on Unity UI controls |

Name sources `HX_<Category>_<Name>_v001.blend`; exports `HX_<Category>_<Name>.fbx`; meshes `M_<Name>`, materials `MAT_<Name>`, textures `T_<Name>_<BaseColor|Normal|Mask>`, actions `AN_<Name>_<State>`. Do not overwrite a GUID by deleting/recreating the wrapper asset. Keep an imported model as a visual child so animation and local offsets can be changed independently.

## Units, axes, pivots

Use metric Blender units, Unit Scale 1, with **1 meter = 1 Unity unit**. Apply object transforms before export; object scale must be `(1,1,1)`. Export selected objects only, FBX scale 1, Forward `-Z`, Up `Y`, and Apply Unit. Inspect the imported orientation once with the Unity camera before delivery.

The first board is drawn in Unity XY: +X right, +Y up, camera on negative Z looking toward +Z. A visual front faces the camera (negative Unity Z). Hex cells have flat tops: approximately **1.12 units wide × 0.97 high**, center/pivot `(0,0,0)`, depth at most `.09`. Stone body target is `.62 × .62` with shallow `.22` depth; number is a separate presentation label at the center, closer to camera. Do not bake gameplay numbers into meshes. Board spacing and axial conversion belong to presentation, not Blender geometry.

Cell and terrain pivots stay at their centers. Stone pivot is center of its body. Character/decor pivots are at ground contact; use a normalized prefab wrapper to position these on the board XY plane. Keep roots unrotated at scale one and put Blender orientation/size corrections on imported children. Terrain stays at its cell when stones move. Add a single noninteractive visual root; remove imported colliders, cameras, lights, and gameplay scripts.

## Materials and budget

Use a shared mobile atlas and a small set of opaque materials. Deliver BaseColor (sRGB), Normal and packed masks (linear); use PNG, with power-of-two atlas dimensions. Supply 512/1024 variants; approve larger textures per scene after profiling on physical iPhone. Avoid transparency stacks, screen-space effects, real-time shadow dependence, and per-tile material instances. Presentation may tint `_Color` via a property block; preserve that property or adapt the wrapper renderer deliberately.

9.11 uses the small `Hexrota/PlaceholderColor` unlit shader and shared materials. The first integration should stay on the project's built-in renderer unless a separate reviewed migration selects another render pipeline. Meshes should be one material/submesh where practical. Initial targets: cell/stone under 500 triangles each, Tavik under 10k, scene decoration under 30k visible combined; these are authoring budgets, not measured device performance.

## Animation and effect handoff

Provide actions as separate clips, starting at frame 1, 30 fps: Tavik `Idle`, `Celebrate`, `Disappointed`, optional `Point`; props `Idle` and optional `Activate`. Export clips by explicit names; disable unused NLA strips and prevent automatic inclusion of every action. Character rig root is `Root`, with no camera movement or motion of the gameplay root. Use Generic animation unless humanoid retargeting is actually needed. Keep transforms finite and predictable at clip end.

Swap, clear, gravity and refill trajectories come from the C# engine's committed `SwapResult`/`WaveFrame` records. Art supplies visual response only. Animation events must not award points, remove terrain, choose RNG values, consume a life, commit a save or unlock input. Every effect must tolerate immediate destruction on pause, background, restart or scene exit. A replacement particle system uses Stop Action `Destroy` or is owned by the presentation effect root. Effects never carry colliders/raycast targets.

## Replacement and review

1. Import the FBX/textures under `Art/Imported` with `.meta` files committed. Check units, normals, pivots, texture import flags and clip names.
2. Duplicate a wrapper only when adding a new visual category; for replacements keep the existing catalog/wrapper GUID. Replace its visual child and remove the temporary mesh component (`PlaceholderHexMesh`) when present.
3. Retain the catalog slot, wrapper origin and expected dimensions. A missing catalog slot uses a small runtime primitive fallback, preserving board play. Set `usesPlaceholderArt` false only once every required slot is replaced and reviewed.
4. Open the committed gameplay scene, enter the real level and test tap/drag, invalid swap, chain, terrain clear and cancellation. Confirm labels and selection remain legible at 320×568 and 390×844 portrait.
5. Build actual WebGL and inspect on iPhone Safari, then Android/iOS packages. Inspect batches, materials, texture memory and frame timing. An Editor preview is not device performance evidence.

Garden, character, environment and UI slots are bindings prepared for subsequent presentation work; their existence does not claim that the full garden/character feature is complete. Original web art and the production web deployment are unchanged.
