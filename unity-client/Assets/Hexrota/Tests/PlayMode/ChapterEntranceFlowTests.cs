using System;
using System.Collections;
using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Hexrota.UnityClientTests
{
    public sealed class ChapterEntranceFlowTests
    {
        private Func<UnityGameSession> factory;
        private FirstPlayableController game;

        [UnitySetUp]
        public IEnumerator OpenScene()
        {
            factory = FirstPlayableController.SessionFactory;
            FirstPlayableController.SessionFactory = () => new UnityGameSession(ClientGameData.FromResources(),
                new MemoryProfileStorage(), new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
        }

        [UnityTearDown]
        public IEnumerator CloseScene()
        {
            FirstPlayableController.SessionFactory = factory;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        [UnityTest]
        public IEnumerator OnlyTheCompletedEntranceAcceptsASwap()
        {
            Assert.That(game.Session.SetPreferences(motion: "full"), Is.True);
            game.BeginLevelOne();
            var curtain = UnityEngine.Object.FindAnyObjectByType<ChapterLoadingView>();
            Assert.That(curtain, Is.Not.Null);
            string attempt = game.Session.AttemptId;
            var pair = game.Session.OpeningLessonPair;
            game.BeginStage(0);
            game.RequestSwap(pair[0], pair[1]);
            Assert.That(game.CurrentScreen, Is.EqualTo("loading"));
            Assert.That(game.Session.AttemptId, Is.EqualTo(attempt));
            Assert.That(game.Session.Snapshot.turn, Is.Zero);
            float deadline = Time.realtimeSinceStartup + 8f;
            while (curtain.gameObject.activeSelf && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(curtain.gameObject.activeSelf, Is.False);
            Assert.That(game.IsEnteringStage, Is.True);
            var hud = (RectTransform)UnityEngine.Object.FindAnyObjectByType<CastleHudView>().transform;
            Assert.That(hud.anchoredPosition.y, Is.GreaterThan(0f));
            var world = GameObject.Find("Ground_0").transform.parent;
            var stones = world.Cast<Transform>().Where(t => t.name.StartsWith("Stone_")).ToArray();
            Assert.That(stones.Length, Is.EqualTo(game.Session.Level.cells.Length));
            Assert.That(stones.All(t => !t.gameObject.activeSelf), Is.True);
            Assert.That(game.Board.InputEnabled, Is.False);
            yield return ChapterEntryWait.Ready(game);
            Assert.That(hud.anchoredPosition.y, Is.EqualTo(0f).Within(.01f));
            Assert.That(stones.Count(t => t.gameObject.activeSelf), Is.EqualTo(game.Session.Snapshot.values.Count(v => v.HasValue)));
            game.RequestSwap(pair[0], pair[1]);
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(1));
        }

        [UnityTest]
        public IEnumerator BackgroundAndComponentDisableDuringEntryRestoreTheSameAttempt()
        {
            game.BeginLevelOne();
            var curtain = UnityEngine.Object.FindAnyObjectByType<ChapterLoadingView>();
            string attempt = game.Session.AttemptId;
            game.enabled = false;
            yield return null;
            game.enabled = true;
            Assert.That(game.CurrentScreen, Is.EqualTo("paused"));
            Assert.That(curtain.gameObject.activeSelf || game.IsEnteringStage || game.Board.InputEnabled, Is.False);
            game.Resume();
            Assert.That(game.Session.AttemptId, Is.EqualTo(attempt));
            Assert.That(game.Board.InputEnabled, Is.True);

            game.ReturnToMenu();
            game.BeginLevelOne();
            attempt = game.Session.AttemptId;
            float deadline = Time.realtimeSinceStartup + 8f;
            while (curtain.gameObject.activeSelf && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(game.IsEnteringStage, Is.True);
            game.OnWebVisibilityChanged("hidden");
            Assert.That(game.CurrentScreen, Is.EqualTo("paused"));
            Assert.That(game.IsEnteringStage || game.Board.InputEnabled, Is.False);
            game.Resume();
            Assert.That(game.Session.AttemptId, Is.EqualTo(attempt));
            Assert.That(game.Session.Snapshot.turn, Is.Zero);
            Assert.That(GameObject.Find("Stone_0"), Is.Not.Null);
            Assert.That(game.Board.InputEnabled, Is.True);
        }

        [UnityTest]
        public IEnumerator ReducedMotionShowsASteadyTipAndMenuCancelsTheEntrance()
        {
            Assert.That(game.Session.SetPreferences(motion: "reduce"), Is.True);
            game.BeginLevelOne();
            var curtain = UnityEngine.Object.FindAnyObjectByType<ChapterLoadingView>();
            yield return new WaitForSecondsRealtime(.25f);
            Assert.That(curtain.GetComponent<CanvasGroup>().alpha, Is.EqualTo(1f));
            var hud = (RectTransform)UnityEngine.Object.FindAnyObjectByType<CastleHudView>().transform;
            Assert.That(hud.anchoredPosition.y, Is.EqualTo(0f).Within(.01f));
            Assert.That(GameObject.Find("Stone_0"), Is.Not.Null);
            game.ReturnToMenu();
            yield return null;
            Assert.That(game.CurrentScreen, Is.EqualTo("menu"));
            Assert.That(curtain.gameObject.activeSelf || game.IsEnteringStage || game.Board.InputEnabled, Is.False);
        }
    }
}
