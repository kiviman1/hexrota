using System;
using System.Collections;
using System.IO;
using System.Linq;
using Hexrota.Application;
using Hexrota.Gameplay;
using Hexrota.Lives;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Hexrota.UnityClientTests
{
    // Temporary GPU smoke probe in the disposable test project only.
    public sealed class RenderedBoardProbe
    {
        private const string Output = "C:/UnityProjects/hexrota/test-results/unity-lifecycle/";
        private Func<UnityGameSession> originalFactory;
        private FirstPlayableController view;

        private sealed class Clock : IUtcClock
        {
            public long NowUtcMilliseconds() { return 1794916800000L; }
        }

        [UnitySetUp]
        public IEnumerator OpenRealScene()
        {
            originalFactory = FirstPlayableController.SessionFactory;
            FirstPlayableController.SessionFactory = () => new UnityGameSession(
                ClientGameData.FromResources(), new MemoryProfileStorage(), new Clock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable", LoadSceneMode.Single);
            view = UnityEngine.Object.FindFirstObjectByType<FirstPlayableController>();
            Assert.That(view, Is.Not.Null);
            Assert.That(view.Session, Is.Not.Null);
            yield return null;
        }

        [UnityTearDown]
        public IEnumerator UnloadAndRestore()
        {
            FirstPlayableController.SessionFactory = originalFactory;
            var cleanup = SceneManager.CreateScene("RenderedProbeCleanup_" + Guid.NewGuid().ToString("N"));
            SceneManager.SetActiveScene(cleanup);
            var scene = SceneManager.GetSceneByName("FirstPlayable");
            if (scene.IsValid() && scene.isLoaded) yield return SceneManager.UnloadSceneAsync(scene);
            view = null;
            yield return null;
        }

        private static float ColorDistance(Color a, Color b)
        {
            return Mathf.Abs(a.r - b.r) + Mathf.Abs(a.g - b.g) + Mathf.Abs(a.b - b.b);
        }

        private int RenderAndVerifyStones(string name)
        {
            var camera = view.Board.BoardCamera;
            var originalTarget = camera.targetTexture;
            var originalActive = RenderTexture.active;
            var originalRect = camera.rect;
            float originalAspect = camera.aspect;
            float originalSize = camera.orthographicSize;
            const int width = 1200;
            int height = Mathf.Clamp(Mathf.RoundToInt(width / originalAspect), 300, 2400);
            var target = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
            var capture = new Texture2D(width, height, TextureFormat.RGB24, false);
            int verified = 0;
            try
            {
                Assert.That(target.Create(), Is.True);
                camera.targetTexture = target;
                camera.rect = new Rect(0, 0, 1, 1);
                camera.aspect = originalAspect;
                camera.Render();
                RenderTexture.active = target;
                capture.ReadPixels(new Rect(0, 0, width, height), 0, 0);
                capture.Apply(false, false);
                Directory.CreateDirectory(Output);
                File.WriteAllBytes(Output + name + ".png", capture.EncodeToPNG());

                var world = view.gameObject.scene.GetRootGameObjects()
                    .Single(root => root.name == "BoardVisuals_PLACEHOLDER").transform;
                var snapshot = view.Session.Snapshot;
                var block = new MaterialPropertyBlock();
                int radius = Mathf.Max(3, Mathf.CeilToInt(height * .23f / (2 * originalSize)));
                for (int i = 0; i < snapshot.values.Length; i++)
                {
                    if (!snapshot.values[i].HasValue) continue;
                    var stone = world.Find("Stone_" + i);
                    Assert.That(stone, Is.Not.Null);
                    var renderer = stone.GetComponentsInChildren<Renderer>()
                        .First(item => item.GetComponent<TextMesh>() == null);
                    renderer.GetPropertyBlock(block);
                    Color expected = block.GetColor("_Color");
                    Vector3 point = camera.WorldToViewportPoint(stone.position);
                    Assert.That(point.x, Is.InRange(0f, 1f), "Stone " + i + " is outside the camera.");
                    Assert.That(point.y, Is.InRange(0f, 1f), "Stone " + i + " is outside the camera.");
                    int centerX = Mathf.RoundToInt(point.x * (width - 1));
                    int centerY = Mathf.RoundToInt(point.y * (height - 1));
                    int matches = 0;
                    for (int y = Mathf.Max(0, centerY - radius); y <= Mathf.Min(height - 1, centerY + radius); y++)
                    for (int x = Mathf.Max(0, centerX - radius); x <= Mathf.Min(width - 1, centerX + radius); x++)
                    {
                        Color pixel = capture.GetPixel(x, y);
                        // Accept the gamma conversion appropriate to the active
                        // graphics target while rejecting background and text.
                        float distance = Mathf.Min(ColorDistance(pixel, expected),
                            Mathf.Min(ColorDistance(pixel, expected.gamma), ColorDistance(pixel, expected.linear)));
                        if (distance < .12f && ColorDistance(pixel, camera.backgroundColor) > .35f) matches++;
                    }
                    Assert.That(matches, Is.GreaterThanOrEqualTo(8),
                        name + ": expected actual stone-colored GPU pixels near stone " + i + " (" + expected + ").");
                    verified++;
                }
                Assert.That(verified, Is.GreaterThan(0));
            }
            finally
            {
                camera.targetTexture = originalTarget;
                camera.rect = originalRect;
                camera.aspect = originalAspect;
                camera.orthographicSize = originalSize;
                RenderTexture.active = originalActive;
                target.Release();
                UnityEngine.Object.Destroy(target);
                UnityEngine.Object.Destroy(capture);
            }
            return verified;
        }

        [UnityTest]
        public IEnumerator ActualGraphicsRendersLevelOneBeforeAndAfterLegalSwap()
        {
            Assert.That(SystemInfo.graphicsDeviceType, Is.Not.EqualTo(GraphicsDeviceType.Null),
                "This probe requires Unity with real graphics; -nographics is not rendering evidence.");
            view.BeginLevelOne();
            yield return null;
            Assert.That(view.CurrentScreen, Is.EqualTo("playing"), view.Session.LastError);
            int before = RenderAndVerifyStones("level-one-before-swap");
            int turn = view.Session.Snapshot.turn;
            var moves = new HexMatch(view.Session.Level, view.Session.Snapshot).LegalMoves();
            Assert.That(moves, Is.Not.Empty);
            view.RequestSwap(moves[0][0], moves[0][1]);
            Assert.That(view.Session.Snapshot.turn, Is.EqualTo(turn + 1), view.Session.LastError);
            Assert.That(view.Board.IsAnimating, Is.True);
            float deadline = Time.realtimeSinceStartup + 15;
            while (view.Board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(view.Board.IsAnimating, Is.False);
            Assert.That(view.Session.IsPresenting, Is.False);
            Assert.That(view.Board.InputEnabled, Is.True);
            // Completion runs in a coroutine and ClearEffects uses Destroy,
            // which removes objects at the end of that frame. A manual camera
            // Render invoked immediately here can still see those effects.
            // Capture the settled next frame, as the normal player camera does.
            yield return null;
            var effects = view.gameObject.scene.GetRootGameObjects()
                .Single(root => root.name == "BoardVisuals_PLACEHOLDER").transform.Find("Effects");
            Assert.That(effects.childCount, Is.Zero, "Deferred effect destruction must finish before the settled screenshot.");
            int after = RenderAndVerifyStones("level-one-after-swap");
            File.WriteAllText(Output + "rendered-board-probe.txt",
                "Unity: " + UnityEngine.Application.unityVersion + "\nGraphics API: " + SystemInfo.graphicsDeviceType +
                "\nDevice: " + SystemInfo.graphicsDeviceName + "\nVerified stones before: " + before +
                "\nVerified stones after: " + after + "\nTurn: " + view.Session.Snapshot.turn + "\n");
            LogAssert.NoUnexpectedReceived();
        }
    }
}
