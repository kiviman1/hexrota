# Hexrota Unity campaign

Open this directory in Unity Hub with **6000.6.9f1** (revision **8c45277fb9c5**). The exact release and Web Build Support availability were verified against Unity's official release API; see `../reports/unity-9-11/editor-release.json`. Do not silently upgrade/downgrade.

Open `Assets/Hexrota/Scenes/FirstPlayable.unity` and enter Play Mode. The checked-in scene references the real client controller, camera and visual catalog. UI and the real data-driven board are composed by that controller at runtime; it is not an independent matching demo.

- `Assets/Hexrota/Core`: generated, byte-identical runtime sources from `../unity/`. Edit the canonical sources, then run `npm run unity:sync` at repository root. `--check` rejects drift, extra harness files and missing metadata.
- `Assets/Hexrota/Runtime`: JSON/resource, durable storage, clock and application-session adapters.
- `Assets/Hexrota/Presentation`: touch/selection/drag, mobile layout, disposable swap/wave/fall presentation, menus and pause/result flow.
- `Assets/Hexrota/Art`: 12 permanent prefab catalog bindings containing explicitly temporary geometry/materials.
- `Assets/Hexrota/Resources/HexrotaData`: generated canonical catalog, variants, life/economy/reward configuration.
- `Assets/Hexrota/Tests`: isolated EditMode/PlayMode assemblies; excluded from player builds.
- `Assets/Hexrota/Editor`: exact-version WebGL, Android development APK and iOS export builders.
- `Assets/WebGLTemplates/HexrotaMobile`: phone template and exclusive profile lock.
- `HostTests`: supplemental actual .NET tests for runtime/core/storage, outside Unity Assets.

A fresh profile opens the castle menu. **Oyna** enters Chapter 1, where Tavik highlights a real swap on the selected variant. After that move the player works toward the score and green-ground targets on the same board. Chapters 3, 6 and 8 introduce double-layer ground, crates and the number 5 when they first appear. A numbered chapter win plays a short celebration before the result sheet. The original tutorial IDs and checkpoints remain readable for returning players. A successful move commits through the application controller before the board animates.

The versioned obstacle, flow, material and story modules and data also ship in the Unity source set. See the [feature matrix](../docs/UNITY_MAIN_FEATURE_MATRIX.md) for player-facing availability, and the [roadmap](../docs/UNITY_MAIN_PORT_ROADMAP.md) for remaining migration work.

Storage retains existing profile/snapshot/attempt schemas in a Unity-specific platform namespace (`hexrota-unity-9.11/` on web, subdirectory on native). It never reads or overwrites the existing web prototype's localStorage. Native uses atomic replacement of the canonical game+energy file. Web acknowledges a command only after synchronous localStorage success under an exclusive Web Lock acquired before Unity starts. Corrupt or denied storage fails closed without resetting progression. Cross-platform/cloud migration is not implemented.

Commands commit before animation. Pause, background, scene disable, restart and menu cancel disposable visuals and reconcile to the committed snapshot. A hidden tab stays paused until explicit Resume. Renderer/asset replacement never determines game results.

From repository root:

```sh
npm run test:unity-client-structure
npm run test:unity-client-host
npm run test:unity-client-storage
UNITY_EDITOR_PATH=/path/to/6000.6.9f1/Editor/Unity npm run test:unity-editor
UNITY_EDITOR_PATH=/path/to/6000.6.9f1/Editor/Unity npm run build:unity-web
```

The [migration verification report](../reports/unity-main-migration/README.md) links the real Editor results and portrait comparisons. The earlier [foundation report](../docs/UNITY_FOUNDATION_9_11.md) describes the original 9.11 delivery. See also the [web test instructions](../docs/UNITY_WEB_TESTING.md) and [Blender pipeline](../docs/BLENDER_ASSET_PIPELINE.md).
