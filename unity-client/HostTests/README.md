# Runtime adapter host checks

Run from the repository root:

```sh
node scripts/check-unity-runtime.cjs --report
```

This executable compiles the **actual generated C# core and actual Runtime adapter files** with C# 7.3 and warnings as errors, then executes canonical route, session transaction, JSON codec and atomic file-storage checks on .NET 8. Newtonsoft.Json 13.0.3 is restored with a committed lock file. This package is only a .NET test-host dependency; Unity uses its official Newtonsoft package.

`UnityResourceStubs.cs` supplies only the `Resources.Load<TextAsset>` fixture boundary and `Application.persistentDataPath` name needed to compile those runtime files. It does not simulate GameObjects, input, rendering, animations, the Unity Editor, the WebGL bridge or a mobile device. The complete directory is outside `Assets`, so host test sources and NuGet artifacts cannot enter a Unity build.

Use the real EditMode/PlayMode tests and WebGL build workflow to validate Unity behavior. Passing this host executable does not establish Unity compilation or device playability.
