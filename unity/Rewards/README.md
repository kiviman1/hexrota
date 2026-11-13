# Hexrota reward director for Unity

`RewardDirector.cs` and `RewardTypes.cs` are a plain C# 7.3 counterpart of `dist/rewards.js`. They depend only on the .NET base library; neither file references `UnityEngine`, a clock, a random generator, UI objects or the game engine. The director returns feedback events and a new state. It does not change the board, score, moves or victory rules.

## Unity integration

Copy both C# files into `Assets/Scripts/Rewards/`. Copy the canonical `dist/reward-rules.json` into your project's data assets. The DTOs use `[Serializable]` classes and public camelCase fields, so the complete rules document can be loaded with `JsonUtility.FromJson<RewardRules>(textAsset.text)`. Call `RewardDirector.ValidateRules(rules)` after loading it.

Create one state per new level attempt:

```csharp
RewardState state = RewardDirector.CreateState(attemptId);
RewardResult result = RewardDirector.Evaluate(input, state, rules);
state = result.nextState;
```

`input` must describe one committed valid move from the game engine, including all cascade waves. The field names and input/output contract are shared with the JavaScript implementation. Supply complete DTO data. JSON adapters should check required fields before deserialization, since ordinary C# fields cannot distinguish an omitted JSON zero/false field from an explicitly supplied one.

Evaluate once per committed move. Persist or silently rebuild the state from the level's move history, and hand `result.plan` to the presentation layer. Rendering, hints, animation callbacks and replay inspection must not evaluate the move again. Duplicate or stale turn input returns no new events. Skipping an animation cancels only its presentation.

Map `scalePermille / 1000f`, spark/ring counts, pitch steps and haptic strength in Unity presentation code. These numeric settings do not prescribe a tween library or a renderer. Keep locale text in the UI: `labelKey` and `reason` are stable identifiers. Goal/win cues must be presented as completion only when `completion` is true; the separate score and ground objective cues do not mean the level has been won.

## Shared parity verification

From the repository root, run:

```sh
node check-reward-parity.cjs
```

This requires the .NET 8 SDK. Set `DOTNET_PATH` when the `dotnet` executable is not on PATH. The test compiles these sources with C# language version 7.3 into a temporary directory, evaluates the shared `fixtures/reward-vectors.json` cases in both implementations, and compares the complete JSON values and input immutability. `unity/ParityHarness/` is a host test executable, not a Unity runtime dependency.

All arithmetic used for decisions is integer arithmetic. Products and cumulative totals use `long`, and event IDs use invariant decimal formatting. Keep those conventions when extending the contract so Web and Unity produce the same events.
