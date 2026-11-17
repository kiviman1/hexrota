# Hexrota 9.11 — Unity 6 client foundation

## Scope

- A separate **real Unity 6 project** in unity-client/, pinned to **6000.6.9f1**.
- All 25 portable C# runtime files copied byte-for-byte from canonical unity/ into Assets/Hexrota/Core/. The existing .NET/JS parity harness remains authoritative. Do not edit the copies independently.
- Deterministic generator: node scripts/sync-unity-client.cjs --write. Read-only gate: --check. Both cover C# copies, Unity .meta GUIDs and 10 published level documents (40 variants). The client exports omit certified solution routes.
- A Unity Hexrota scene and runtime bootstrap with a playable 3D placeholder board, two-tap adjacent swap, score/ground/moves feedback, reset, and **development-only** level/variant switching. Every swap calls the canonical C# HexMatch.Swap.
- Optional HexrotaTheme ScriptableObject slot for Blender-derived floor and gem prefabs; no Blender files are required to open the project.
- A .NET 8 content adapter harness validating all 40 configurations against canonical C# gameplay. This is **not** a Unity/IL2CPP test.
- A manual Unity WebGL build workflow and Editor build command. No Unity license secrets, WebGL build output, preview hosting or physical-device validation are claimed.

## Open in Unity

1. In Unity Hub select **Add project from disk** and choose the unity-client/ directory, not the repository root.
2. Use Unity **6000.6.9f1**, with WebGL Build Support when available.
3. Open Assets/Scenes/Hexrota.unity and press **Play**.
4. Tap/click one hexagon, then an adjacent one. A valid match commits through the existing C# engine. Bottom buttons switch levels/variants for development testing only.
5. When canonical C# or published level data changes, run node scripts/sync-unity-client.cjs --write at repository root and commit the generated files.

Unity may generate missing Library/, package lock and settings files on first open. Do not commit Library, Temp, Builds or credentials.

## Blender handoff

The first visual adapter is HexrotaTheme in Assets/Hexrota/Runtime/HexrotaTheme.cs.

- Export Unity-compatible prefabs from Blender models with consistent scale and pivots.
- Create Assets/Hexrota/Resources/Hexrota/Theme.asset of type HexrotaTheme.
- Assign floorPrefab and gemPrefabs[0..] for values 1 onward. Unassigned values retain placeholder visuals.
- Prefabs remain **visual-only**; no board state, scoring, RNG or save authority. Preserve tile root input/collider binding.

The placeholders are intentionally plain. Final materials, animation, effects, sound, accessibility, landscape layout and device performance remain separate acceptance work.

## Verification boundaries

| Gate | Status at authoring |
| --- | --- |
| JS/C# gameplay and published variants | Existing CI/parity suite |
| Generated C# copy/content equality | New Node --check gate, added to required gameplay CI job |
| Generated 40 variant configurations | New .NET 8 content adapter job |
| Unity Editor import / C# compile | **Not run here**; licensed Unity runner required |
| Unity scene interactive smoke test | **Not run here** |
| Unity WebGL artifact | Manual workflow; Unity credentials and WebGL module required |
| Physical iPhone Safari / Android | **Not run** |
| Production hexrota.vercel.app | **Unchanged** |

Manual WebGL build:
- Unity Editor menu **Hexrota → Build WebGL** outputs unity-client/Builds/WebGL.
- GitHub Actions workflow **Hexrota Unity WebGL Build (manual)** requires Unity credentials and uploads an artifact; it does **not** deploy to Vercel yet.
- A phone-playable Unity preview requires a successful real Unity build, separate preview hosting and mobile Safari tests. Do not replace the current web game prematurely.

## Next milestones

1. Run Unity Editor/IL2CPP compilation and resolve Unity-specific serialization/API issues without changing canonical gameplay.
2. Implement the committed-wave animation presenter from SwapResult.frames with cancellation and visual consistency.
3. Bind existing C# catalog/session/save/economy/life/rescue through platform adapters. The current level switcher is not the production campaign.
4. Add menus, tutorials, Tavik, progression and native persistence, then mobile UX/performance checks.
5. Integrate Blender assets through theme/prefab contracts rather than gameplay rewrites.
6. Configure licensed Unity CI, publish a separate Unity WebGL preview and test on a physical iPhone.
