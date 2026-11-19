#if UNITY_EDITOR || DEVELOPMENT_BUILD
using System;
using System.Collections;
using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace Hexrota.UnityClientTests
{
    public sealed class DevelopmentWinButtonTests
    {
        private Func<UnityGameSession> original;
        private FirstPlayableController game;

        [UnitySetUp]
        public IEnumerator OpenFreshProfile()
        {
            original = FirstPlayableController.SessionFactory;
            var data = ClientGameData.FromResources();
            var storage = new MemoryProfileStorage();
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, storage, new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(game.Session.SetPreferences(motion: "reduce"), Is.True);
        }

        [UnityTearDown]
        public IEnumerator CleanUp()
        {
            FirstPlayableController.SessionFactory = original;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        private Button WinButton => game.GetComponentsInChildren<Button>(true)
            .Single(button => button.name == FirstPlayableController.DevelopmentWinButtonName);

        private IEnumerator TapAndReachResult(int stage)
        {
            Assert.That(WinButton.gameObject.activeInHierarchy, Is.True, "Editor runs are development builds.");
            WinButton.onClick.Invoke();
            Assert.That(game.Session.Status, Is.EqualTo("won"));
            float deadline = Time.realtimeSinceStartup + 15f;
            while (game.CurrentScreen != "result" && Time.realtimeSinceStartup < deadline)
            {
                var victory = UnityEngine.Object.FindAnyObjectByType<ChapterVictoryView>();
                if (victory != null && victory.gameObject.activeInHierarchy)
                    ExecuteEvents.Execute(victory.gameObject, new PointerEventData(EventSystem.current), ExecuteEvents.pointerClickHandler);
                yield return null;
            }
            Assert.That(game.CurrentScreen, Is.EqualTo("result"));
            Assert.That(game.Session.IsStageComplete(stage), Is.True);
            Assert.That(game.Session.ReadEarnedResult().GoldenEggs, Is.EqualTo(1));
        }

        [UnityTest]
        public IEnumerator OneTapWinsTheOpenChapterThroughTheNormalResult()
        {
            game.BeginLevelOne();
            yield return ChapterEntryWait.Ready(game);
            int stage = game.Session.ActiveStage;
            yield return TapAndReachResult(stage);
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator AChapterInProgressRestartsAndStillWins()
        {
            game.BeginLevelOne();
            yield return ChapterEntryWait.Ready(game);
            yield return ChapterEntryWait.PlayOpeningMove(game);
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(1));
            yield return TapAndReachResult(game.Session.ActiveStage);
        }
    }
}
#endif
