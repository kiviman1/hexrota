# Unity WebGL verification

Built commit `2bfbabd20c18649ad4992f130bf4b22382b9e33d` from a clean Git archive on Windows with the licensed Unity 6000.6.9f1 Editor (revision `8c45277fb9c5`) and Web Build Support. The checked-in `Hexrota.UnityClient.Editor.ClientBuild.BuildWeb` invoked IL2CPP for the enabled FirstPlayable scene. The output passed `node scripts/check-unity-web-build.cjs <output>`, including the uncompressed WebAssembly signature check.

| Build file | Bytes | SHA-256 |
| --- | ---: | --- |
| 1649ea384f080aa0fde1bf324485bdbe.data | 10046287 | `b85dc0837a79fec14bf1b678b07e9cc7b5bac3aac6a513d1c36a1225eefab661` |
| 226c62c5b5b52e9946c2a96f5edc5c39.wasm | 33442847 | `5946e256918cfa6eac9c0edc18520fb019e221049372ec40ae30b2f98942086d` |
| 94343264df97f71176318128ec58df5d.loader.js | 20263 | `1c0dacbf4680fde6b7ae0889aa395a3b13eb2612cc08abf15f2594015e670ff8` |
| f8c165cdcfd991b5999c059738d24b55.framework.js | 306427 | `3237b5ab62aeda7035740dac29dde4d24eae5028bca4f81e0d7f7c1ce369da0b` |

Headless Chrome 157.0.8103.79 loaded the player over loopback HTTP at 390 × 844 using SwiftShader for WebGL. A new browser profile acquired the exclusive Web Lock, rendered the opening screen and entered T1 through its canvas button. Two mouse taps on the board committed the guided swap with turn 1, score 6 and four moves remaining. After reloading and choosing Devam et, the entire saved board snapshot and the attempt ID `t-learn-1-1` matched the prior values. Tapping the restored feedback acknowledgement persisted `0:1`. The run recorded zero JavaScript exceptions and zero browser console errors.

The first startup probe tapped during the Unity splash and timed out. The passing run waited for the rendered home artwork before tapping. Both runs used the same player files. This check covers local desktop Chrome startup, guided input and durable resume. Device and Safari validation remain open.

Reproduce the player from the tested checkout with the exact Editor:

```text
Unity -batchmode -nographics -quit -projectPath <checkout>/unity-client -buildTarget WebGL -executeMethod Hexrota.UnityClient.Editor.ClientBuild.BuildWeb -logFile <log>
node scripts/check-unity-web-build.cjs unity-client/Builds/WebGL
```
