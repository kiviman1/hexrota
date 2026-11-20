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
    // A life is reserved when a chapter starts. A win gives it back and stops the refill timer;
    // a loss, leaving the chapter or closing the app in the middle of it keeps it spent.
    public sealed class LifeReservationTests : PlayModeTest
    {
        private Func<UnityGameSession> original;
        private MemoryProfileStorage storage;
        private FirstPlayableController game;

        [UnitySetUp]
        public IEnumerator OpenFreshProfile()
        {
            original = FirstPlayableController.SessionFactory;
            var data = ClientGameData.FromResources();
            storage = new MemoryProfileStorage();
            // The same opening path the app uses (UnityGameSession.CreateDefault).
            FirstPlayableController.SessionFactory = () => UnityGameSession.OpenApp(data, storage, new SystemUtcClock());
            yield return OpenApp();
        }

        [UnityTearDown]
        public IEnumerator CleanUp()
        {
            FirstPlayableController.SessionFactory = original;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        // Reloading the scene builds a new session from the same saved profile, as reopening the app does.
        private IEnumerator OpenApp()
        {
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(game.CurrentScreen, Is.EqualTo("menu"));
            Assert.That(game.Session.SetPreferences(motion: "reduce"), Is.True);
        }

        private UnityGameSession.PhoneWallet Wallet => game.Session.ReadPhoneWallet();

        private IEnumerator StartFirstChapter()
        {
            game.BeginLevelOne();
            yield return ChapterEntryWait.Ready(game);
            Assert.That(game.CurrentScreen, Is.EqualTo("playing"));
        }

        private IEnumerator WinWithTheDevelopmentShortcut()
        {
            var win = game.GetComponentsInChildren<Button>(true).Single(b => b.name == FirstPlayableController.DevelopmentWinButtonName);
            win.onClick.Invoke();
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
        }

        private void AssertFull()
        {
            Assert.That(Wallet.Lives, Is.EqualTo(5));
            Assert.That(Wallet.Countdown, Is.Null, "No refill timer runs while lives are full.");
            Assert.That(Wallet.Timer, Is.EqualTo("Canlar dolu"));
        }

        [UnityTest]
        public IEnumerator AWinGivesTheReservedLifeBackAndTheSavedProfileKeepsItFull()
        {
            AssertFull();
            yield return StartFirstChapter();
            Assert.That(Wallet.Lives, Is.EqualTo(4), "Starting a chapter reserves a life.");
            Assert.That(Wallet.Countdown, Is.Not.Null);
            yield return WinWithTheDevelopmentShortcut();
            AssertFull();
            game.ReturnToMenu();
            Assert.That(game.CurrentScreen, Is.EqualTo("menu"));
            AssertFull();
            yield return OpenApp();
            AssertFull();
        }

        [UnityTest]
        public IEnumerator LeavingAChapterAfterAMoveSpendsItsLifeAndStartsOverNextTime()
        {
            yield return StartFirstChapter();
            yield return ChapterEntryWait.PlayOpeningMove(game);
            Assert.That(game.Session.LeavingSpendsLife, Is.True);
            game.ReturnToMenu();
            Assert.That(Wallet.Lives, Is.EqualTo(4));
            Assert.That(Wallet.Countdown, Is.Not.Null, "The spent life refills over time.");
            yield return OpenApp();
            Assert.That(Wallet.Lives, Is.EqualTo(4), "Reopening the app neither refunds nor charges again.");
            yield return StartFirstChapter();
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(0), "The left attempt cannot be resumed.");
            Assert.That(Wallet.Lives, Is.EqualTo(3));
        }

        [UnityTest]
        public IEnumerator ClosingTheAppInTheMiddleOfAChapterSpendsItsLife()
        {
            yield return StartFirstChapter();
            yield return ChapterEntryWait.PlayOpeningMove(game);
            Assert.That(Wallet.Lives, Is.EqualTo(4));
            yield return OpenApp(); // the app closed without leaving the chapter
            Assert.That(Wallet.Lives, Is.EqualTo(4));
            Assert.That(game.Session.LeavingSpendsLife, Is.False);
            yield return StartFirstChapter();
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(0), "A chapter left open by closing the app starts over.");
            Assert.That(Wallet.Lives, Is.EqualTo(3));
        }

        [UnityTest]
        public IEnumerator ClosingTheAppBeforeTheFirstMoveGivesTheLifeBackAndKeepsTheBoard()
        {
            yield return StartFirstChapter();
            Assert.That(Wallet.Lives, Is.EqualTo(4));
            string attempt = game.Session.AttemptId;
            yield return OpenApp();
            AssertFull();
            yield return StartFirstChapter();
            Assert.That(game.Session.AttemptId, Is.EqualTo(attempt), "An untouched board is not rerolled by leaving.");
            Assert.That(Wallet.Lives, Is.EqualTo(4), "Resuming reserves the life again.");
        }

        [UnityTest]
        public IEnumerator LeavingFromThePauseSheetAsksFirstWhenItSpendsALife()
        {
            yield return StartFirstChapter();
            yield return ChapterEntryWait.PlayOpeningMove(game);
            game.Pause();
            yield return null;
            Button Labelled(string text) => game.GetComponentsInChildren<Button>(false)
                .Single(b => b.GetComponentsInChildren<Text>(true).Any(t => t.text == text));
            Labelled("Ana menüye dön").onClick.Invoke();
            yield return null;
            Assert.That(game.CurrentScreen, Is.Not.EqualTo("menu"), "Leaving after a move must be confirmed.");
            Labelled("Vazgeç").onClick.Invoke();
            yield return null;
            Assert.That(Wallet.Lives, Is.EqualTo(4));
            Labelled("Ana menüye dön").onClick.Invoke();
            yield return null;
            Labelled("Çık, can harcansın").onClick.Invoke();
            yield return null;
            Assert.That(game.CurrentScreen, Is.EqualTo("menu"));
            Assert.That(Wallet.Lives, Is.EqualTo(4));
        }
    }
}
