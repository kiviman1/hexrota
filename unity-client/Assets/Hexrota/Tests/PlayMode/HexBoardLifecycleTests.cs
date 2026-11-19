using System;
using System.Collections;
using System.Linq;
using Hexrota.Application;
using Hexrota.Gameplay;
using Hexrota.Lives;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Hexrota.UnityClientTests
{
    public sealed class HexBoardLifecycleTests
    {
        private sealed class Clock : IUtcClock
        {
            public long NowUtcMilliseconds() { return 1794916800000L; }
        }

        private Func<UnityGameSession> originalFactory;
        private FirstPlayableController view;

        [UnitySetUp]
        public IEnumerator OpenRealSceneWithIsolatedStorage()
        {
            originalFactory = FirstPlayableController.SessionFactory;
            FirstPlayableController.SessionFactory = () => new UnityGameSession(
                ClientGameData.FromResources(), new MemoryProfileStorage(), new Clock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable", LoadSceneMode.Single);
            view = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(view, Is.Not.Null);
            Assert.That(view.Session, Is.Not.Null);
            yield return null;
        }

        [UnityTearDown]
        public IEnumerator UnloadSceneAndRestoreFactory()
        {
            FirstPlayableController.SessionFactory = originalFactory;
            // Unloading, rather than returning to the menu, also cleans up after
            // an assertion fails with a disabled controller or missing visuals.
            var cleanup = SceneManager.CreateScene("LifecycleCleanup_" + Guid.NewGuid().ToString("N"));
            SceneManager.SetActiveScene(cleanup);
            var scene = SceneManager.GetSceneByName("FirstPlayable");
            if (scene.IsValid() && scene.isLoaded) yield return SceneManager.UnloadSceneAsync(scene);
            view = null;
            yield return null;
        }

        private IEnumerator BeginLevel()
        {
            view.BeginLevelOne();
            yield return ChapterEntryWait.Ready(view);
            Assert.That(view.CurrentScreen, Is.EqualTo("playing"), view.Session.LastError);
            Assert.That(view.Board.InputEnabled, Is.True);
        }

        private GameObject VisualRoot()
        {
            return view.gameObject.scene.GetRootGameObjects()
                .Single(root => root.name == "BoardVisuals_PLACEHOLDER");
        }

        private void StartLegalSwap()
        {
            int turn = view.Session.Snapshot.turn;
            var moves = new HexMatch(view.Session.Level, view.Session.Snapshot).LegalMoves();
            Assert.That(moves, Is.Not.Empty);
            var pair = view.Session.OpeningLessonPair ?? moves[0];
            view.RequestSwap(pair[0], pair[1]);
            Assert.That(view.Session.Snapshot.turn, Is.EqualTo(turn + 1), view.Session.LastError);
            Assert.That(view.Board.IsAnimating, Is.True);
            Assert.That(view.Session.IsPresenting, Is.True);
        }

        private IEnumerator FinishSwap()
        {
            float deadline = Time.realtimeSinceStartup + 15;
            while (view.Board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(view.Board.IsAnimating, Is.False, "Presentation must finish within its finite budget.");
            Assert.That(view.Session.IsPresenting, Is.False);
            Assert.That(view.Board.InputEnabled, Is.True);
        }

        private static void AssertSnapshot(GameSnapshot expected, GameSnapshot actual)
        {
            Assert.That(actual.turn, Is.EqualTo(expected.turn));
            Assert.That(actual.movesLeft, Is.EqualTo(expected.movesLeft));
            Assert.That(actual.score, Is.EqualTo(expected.score));
            Assert.That(actual.rngState, Is.EqualTo(expected.rngState));
            Assert.That(actual.history, Is.EqualTo(expected.history));
            CollectionAssert.AreEqual(expected.values, actual.values);
            CollectionAssert.AreEqual(expected.layers, actual.layers);
        }

        private static void AssertTinted(GameObject visual)
        {
            var renderers = visual.GetComponentsInChildren<Renderer>()
                .Where(renderer => renderer.GetComponent<TextMesh>() == null).ToArray();
            Assert.That(renderers, Is.Not.Empty, visual.name);
            var block = new MaterialPropertyBlock();
            foreach (var renderer in renderers)
            {
                Assert.That(renderer.enabled, Is.True, renderer.name);
                Assert.That(renderer.gameObject.activeInHierarchy, Is.True, renderer.name);
                renderer.GetPropertyBlock(block);
                Color color = block.GetColor("_Color");
                Assert.That(color.a, Is.GreaterThan(0), "A live MaterialPropertyBlock must tint " + visual.name);
                Assert.That(block.GetColor("_BaseColor"), Is.EqualTo(color));
            }
        }

        [UnityTest]
        public IEnumerator LevelOneShowsTintedNumberedStonesAndCompletesASwap()
        {
            yield return BeginLevel();
            yield return null;
            var world = VisualRoot().transform;
            var snapshot = view.Session.Snapshot;
            for (int i = 0; i < snapshot.values.Length; i++)
            {
                var stone = world.Find("Stone_" + i);
                Assert.That(stone, Is.Not.Null, "Every logical cell needs its stone container.");
                Assert.That(stone.gameObject.activeSelf, Is.EqualTo(snapshot.values[i].HasValue));
                if (snapshot.values[i].HasValue)
                {
                    StoneArtAssertions.ShowsNumber(stone, snapshot.values[i].Value);
                    AssertTinted(stone.gameObject);
                    Vector3 viewport = view.Board.BoardCamera.WorldToViewportPoint(stone.position);
                    Assert.That(viewport.x, Is.InRange(0f, 1f));
                    Assert.That(viewport.y, Is.InRange(0f, 1f));
                    Assert.That(viewport.z, Is.GreaterThan(view.Board.BoardCamera.nearClipPlane));
                }
                AssertTinted(world.Find("Ground_" + i).gameObject);
                AssertTinted(world.Find("Cell_" + i).gameObject);
            }
            StartLegalSwap();
            yield return FinishSwap();
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator ScorePacketFliesToTheHudAndPauseDiscardsItsVisuals()
        {
            yield return BeginLevel();
            var feedback = view.GetComponentsInChildren<Transform>(true).Single(node => node.name == "ScoreFeedback");
            var packet = feedback.Find("ScorePacket");
            StartLegalSwap();
            int scored = view.Session.Snapshot.score;
            float end = Time.realtimeSinceStartup+4;
            while ((!packet.gameObject.activeInHierarchy || string.IsNullOrEmpty(packet.GetComponentInChildren<UnityEngine.UI.Text>().text)) &&
                   Time.realtimeSinceStartup < end) yield return null;
            Assert.That(packet.gameObject.activeInHierarchy,Is.True);
            view.Pause();
            Assert.That(feedback.gameObject.activeSelf,Is.False);
            Assert.That(view.Session.Snapshot.score,Is.EqualTo(scored));
            view.Resume(); StartLegalSwap();
            int expectedScore = view.Session.Snapshot.score;
            yield return FinishSwap();
            var amount = view.GetComponentsInChildren<UnityEngine.UI.Text>().Single(t => t.name == "Counters");
            Assert.That(amount.text,Is.EqualTo(expectedScore + " / " + view.Session.Level.target));
            Assert.That(feedback.gameObject.activeSelf,Is.False);
        }

        [UnityTest]
        public IEnumerator PauseDuringSwapPreservesCommittedBoardAndResumeAcceptsAnotherSwap()
        {
            yield return BeginLevel();
            int completions = 0;
            view.Board.PresentationCompleted += () => completions++;
            StartLegalSwap();
            var committed = view.Session.Snapshot;
            view.OnWebVisibilityChanged("hidden");
            yield return null;
            Assert.That(view.CurrentScreen, Is.EqualTo("paused"));
            Assert.That(view.Board.IsAnimating, Is.False);
            Assert.That(view.Session.IsPresenting, Is.False);
            Assert.That(view.Board.InputEnabled, Is.False);
            Assert.That(completions, Is.Zero, "Cancellation must not report normal completion.");
            AssertSnapshot(committed, view.Session.Snapshot);
            view.OnWebVisibilityChanged("visible");
            view.Resume();
            Assert.That(view.CurrentScreen, Is.EqualTo("playing"));
            AssertSnapshot(committed, view.Session.Snapshot);
            StartLegalSwap();
            yield return FinishSwap();
            Assert.That(completions, Is.EqualTo(1));
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator MissingDetachedVisualRootIsSafeDuringControllerTeardown()
        {
            yield return BeginLevel();
            StartLegalSwap();
            var session = view.Session;
            var committed = session.Snapshot;
            int completions = 0;
            view.Board.PresentationCompleted += () => completions++;
            // Simulate the independent scene root being destroyed before the
            // controller's OnDisable. DestroyImmediate makes this order exact.
            UnityEngine.Object.DestroyImmediate(VisualRoot());
            view.enabled = false;
            Assert.That(session.IsPresenting, Is.False);
            Assert.That(view.Board.IsAnimating, Is.False);
            AssertSnapshot(committed, session.Snapshot);
            UnityEngine.Object.Destroy(view.gameObject);
            yield return null;
            Assert.That(view == null, Is.True);
            Assert.That(completions, Is.Zero);
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator SceneUnloadDuringSwapLeavesNoCallbacksOrVisualRootsAndReloadCanSwap()
        {
            yield return BeginLevel();
            StartLegalSwap();
            var session = view.Session;
            var oldBoard = view.Board;
            var oldWorld = VisualRoot();
            int completions = 0;
            oldBoard.PresentationCompleted += () => completions++;
            var oldScene = view.gameObject.scene;
            var empty = SceneManager.CreateScene("LifecycleUnload_" + Guid.NewGuid().ToString("N"));
            SceneManager.SetActiveScene(empty);
            yield return SceneManager.UnloadSceneAsync(oldScene);
            yield return null;
            Assert.That(oldBoard == null, Is.True);
            Assert.That(oldWorld == null, Is.True, "The detached visual root belongs to the unloaded scene.");
            Assert.That(session.IsPresenting, Is.False);
            Assert.That(completions, Is.Zero);
            Assert.That(UnityEngine.Object.FindObjectsByType<Transform>(FindObjectsInactive.Include)
                .Any(item => item.name == "BoardVisuals_PLACEHOLDER"), Is.False);
            yield return SceneManager.LoadSceneAsync("FirstPlayable", LoadSceneMode.Single);
            view = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(view, Is.Not.Null);
            yield return BeginLevel();
            StartLegalSwap();
            yield return FinishSwap();
            Assert.That(completions, Is.Zero, "The old board must not call back into a later scene.");
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator ControllerDisableAndEnablePausesCommittedSwapUntilResume()
        {
            yield return BeginLevel();
            StartLegalSwap();
            var committed = view.Session.Snapshot;
            int completions = 0;
            view.Board.PresentationCompleted += () => completions++;
            view.enabled = false;
            yield return null;
            Assert.That(view.CurrentScreen, Is.EqualTo("paused"));
            Assert.That(view.Board.IsAnimating, Is.False);
            Assert.That(view.Session.IsPresenting, Is.False);
            Assert.That(view.Board.InputEnabled, Is.False);
            AssertSnapshot(committed, view.Session.Snapshot);
            view.enabled = true;
            yield return null;
            Assert.That(view.CurrentScreen, Is.EqualTo("paused"));
            Assert.That(view.Board.InputEnabled, Is.False);
            Assert.That(completions, Is.Zero);
            var overlay = view.GetComponentsInChildren<Transform>(true).Single(item => item.name == "ModalOverlay");
            Assert.That(overlay.gameObject.activeInHierarchy, Is.True);
            view.Resume();
            AssertSnapshot(committed, view.Session.Snapshot);
            StartLegalSwap();
            yield return FinishSwap();
            Assert.That(completions, Is.EqualTo(1));
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator VisualRootDestroyedDuringSwapCancelsWithoutCommittingInvisibleMoves()
        {
            yield return BeginLevel();
            StartLegalSwap();
            var committed = view.Session.Snapshot;
            int completions = 0;
            view.Board.PresentationCompleted += () => completions++;
            UnityEngine.Object.Destroy(VisualRoot());
            float deadline = Time.realtimeSinceStartup + 5;
            while (view.Board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(view.enabled, Is.True, "The animation must notice missing visuals without controller shutdown.");
            Assert.That(view.Board.IsAnimating, Is.False);
            Assert.That(view.Session.IsPresenting, Is.False);
            Assert.That(view.Board.InputEnabled, Is.False);
            Assert.That(completions, Is.Zero);
            AssertSnapshot(committed, view.Session.Snapshot);
            var moves = new HexMatch(view.Session.Level, committed).LegalMoves();
            Assert.That(moves, Is.Not.Empty);
            view.RequestSwap(moves[0][0], moves[0][1]);
            yield return null;
            AssertSnapshot(committed, view.Session.Snapshot);
            Assert.That(view.Session.IsPresenting, Is.False);
            Assert.That(completions, Is.Zero);
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator IdleControllerDisableLocksInputAndResumeAcceptsASwap()
        {
            yield return BeginLevel();
            var committed = view.Session.Snapshot;
            Assert.That(view.Board.IsAnimating, Is.False);
            view.enabled = false;
            Assert.That(view.Board.InputEnabled, Is.False, "Idle disable must lock input even without animation cancellation.");
            yield return null;
            Assert.That(view.CurrentScreen, Is.EqualTo("paused"));
            Assert.That(view.Session.IsPresenting, Is.False);
            AssertSnapshot(committed, view.Session.Snapshot);
            view.enabled = true;
            yield return null;
            Assert.That(view.CurrentScreen, Is.EqualTo("paused"));
            Assert.That(view.Board.InputEnabled, Is.False);
            view.Resume();
            Assert.That(view.CurrentScreen, Is.EqualTo("playing"));
            Assert.That(view.Board.InputEnabled, Is.True);
            AssertSnapshot(committed, view.Session.Snapshot);
            StartLegalSwap();
            yield return FinishSwap();
            LogAssert.NoUnexpectedReceived();
        }
    }
}
