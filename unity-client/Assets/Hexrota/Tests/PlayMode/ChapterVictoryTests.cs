using System;
using System.Collections;
using System.Globalization;
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
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    public sealed class ChapterVictoryTests
    {
        private Func<UnityGameSession> original;
        private FirstPlayableController game;
        private UnityGameSession session;
        private int[] last;

        [UnitySetUp]
        public IEnumerator OpenOneMoveBeforeARealWin()
        {
            original = FirstPlayableController.SessionFactory;
            var data = ClientGameData.FromResources();
            var storage = new MemoryProfileStorage();
            var preparer = new UnityGameSession(data, storage, new SystemUtcClock());
            Assert.That(preparer.EnterLevelOne(), Is.True, preparer.LastError);
            var attempts = W.Required(W.Required(storage.Read(ProfileRepository.ProfileKey), "game"), "attempts");
            var identity = W.Required(attempts, preparer.ActiveStage.ToString());
            var level = data.Catalog.ResolveLevelWire(W.Required(identity, "levelId"),
                (string)W.Required(identity, "variantId"), (string)W.Required(identity, "levelDataVersion"));
            var route = W.List(level["solution"]).Select(pair => W.List(pair).Select(W.Int32).ToArray()).ToArray();
            foreach (var step in route.Take(route.Length - 1))
            {
                Assert.That(preparer.TrySwap(step[0], step[1]).Ok, Is.True, preparer.LastError);
                preparer.CompletePresentation();
            }
            last = route.Last();
            preparer.ReturnToMenu();
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, storage, new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            session = game.Session;
        }

        [UnityTearDown]
        public IEnumerator CleanUp()
        {
            FirstPlayableController.SessionFactory = original;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        private IEnumerator Win(string motion)
        {
            Assert.That(session.SetPreferences(motion: motion), Is.True);
            game.BeginLevelOne();
            yield return ChapterEntryWait.Ready(game);
            game.RequestSwap(last[0], last[1]);
            Assert.That(session.Status, Is.EqualTo("won"));
            float timeout = Time.realtimeSinceStartup + 12f;
            while (game.CurrentScreen == "playing" && Time.realtimeSinceStartup < timeout) yield return null;
            Assert.That(game.CurrentScreen, Is.EqualTo("celebration"));
            Assert.That(game.Board.IsAnimating || game.Board.InputEnabled, Is.False);
            var counter = game.GetComponentInChildren<CastleHudView>().GetComponentsInChildren<Text>().Single(t => t.name == "Counters");
            Assert.That(counter.text, Does.StartWith(session.Snapshot.score + " / "));
        }

        [UnityTest]
        public IEnumerator LiveWinShowsTavikAfterScoreAndSkipsToTheSameEarnedResult()
        {
            yield return Win("full");
            var victory = UnityEngine.Object.FindAnyObjectByType<ChapterVictoryView>();
            Assert.That(victory.GetComponentInChildren<Text>().text, Is.EqualTo("Başardın!"));
            var tavik = victory.GetComponentInChildren<RawImage>();
            Assert.That(tavik.texture, Is.SameAs(Resources.Load<Texture2D>("CoopArt/celebrate")));
            Assert.That(tavik.uvRect, Is.EqualTo(new Rect(0, 0, 1, 1)));
            var seal = (RectTransform)victory.GetComponentsInChildren<Transform>().Single(t => t.name == "GardenSeal");
            var initialScale = seal.localScale;
            var wallet = session.ReadPhoneWallet();
            string attempt = session.AttemptId;
            yield return new WaitForSecondsRealtime(.45f);
            Assert.That(seal.localScale.x, Is.GreaterThan(initialScale.x));
            ExecuteEvents.Execute(victory.gameObject, new PointerEventData(EventSystem.current), ExecuteEvents.pointerClickHandler);
            Assert.That(victory.gameObject.activeSelf, Is.False);
            Assert.That(game.CurrentScreen, Is.EqualTo("result"));
            Assert.That(session.AttemptId, Is.EqualTo(attempt));
            Assert.That(session.ReadPhoneWallet().Gold, Is.EqualTo(wallet.Gold));
            game.GetComponentsInChildren<Button>().Single(b => b.name == "Tahtayı incele").onClick.Invoke();
            game.GetComponentsInChildren<Button>().Single(b => b.name == "Sonucu göster").onClick.Invoke();
            Assert.That(game.CurrentScreen, Is.EqualTo("result"));
            Assert.That(victory.gameObject.activeSelf, Is.False);
            Assert.That(session.ReadPhoneWallet().GoldenEggs, Is.EqualTo(wallet.GoldenEggs));
        }

        [UnityTest]
        public IEnumerator BackgroundDuringReducedMotionKeepsTheWinAndReleasesTheOverlay()
        {
            yield return Win("reduce");
            var victory = UnityEngine.Object.FindAnyObjectByType<ChapterVictoryView>();
            var bird = (RectTransform)victory.GetComponentInChildren<RawImage>().transform;
            Vector2 position = bird.anchoredPosition;
            yield return new WaitForSecondsRealtime(.16f);
            Assert.That(bird.anchoredPosition, Is.EqualTo(position));
            Assert.That(victory.GetComponent<CanvasGroup>().alpha, Is.EqualTo(1f));
            var wallet = session.ReadPhoneWallet();
            game.OnWebVisibilityChanged("hidden");
            Assert.That(game.CurrentScreen, Is.EqualTo("result"));
            Assert.That(victory.gameObject.activeSelf, Is.False);
            Assert.That(session.ReadPhoneWallet().Gold, Is.EqualTo(wallet.Gold));
            game.ReturnToMenu();
            yield return new WaitForSecondsRealtime(1.1f);
            Assert.That(game.CurrentScreen, Is.EqualTo("menu"));
        }

        [UnityTest]
        public IEnumerator VerifiedWinReturnsWithEggBeforeGoldAndGlidesToTheSavedWallet()
        {
            yield return Win("reduce");
            var earned = session.ReadEarnedResult();
            var wallet = session.ReadPhoneWallet();
            Assert.That(earned.Gold, Is.Positive);
            Assert.That(earned.GoldenEggs, Is.Positive);
            float resultBy = Time.unscaledTime + 2;
            while (game.CurrentScreen == "celebration" && Time.unscaledTime < resultBy) yield return null;
            Assert.That(game.CurrentScreen, Is.EqualTo("result"));
            game.GetComponentsInChildren<Button>().Single(button => button.name == "Ana menü").onClick.Invoke();

            var flight = game.GetComponentInChildren<RewardFlight>();
            var gold = Counter("GoldValue");
            var star = Counter("EggValue");
            Assert.That(flight.IsPlaying, Is.True);
            Assert.That(flight.ActiveIconCount, Is.Zero, "The sequence starts after the return delay.");
            Assert.That(gold.text, Is.EqualTo(Turkish(wallet.Gold - earned.Gold)));
            Assert.That(star.text, Is.EqualTo(Turkish(wallet.GoldenEggs - earned.GoldenEggs)));
            float deadline = Time.unscaledTime + 2;
            while (flight.ActiveIconCount == 0 && flight.IsPlaying && Time.unscaledTime < deadline) yield return null;
            Assert.That(flight.ActiveIconCount, Is.EqualTo(1));
            string finalStars = Turkish(wallet.GoldenEggs);
            while (star.text != finalStars && flight.IsPlaying && Time.unscaledTime < deadline) yield return null;
            Assert.That(star.text, Is.EqualTo(finalStars));
            Assert.That(flight.IsPlaying, Is.True, "Gold is still in the sequence when the egg is credited.");
            Assert.That(gold.text, Is.EqualTo(Turkish(wallet.Gold - earned.Gold)));
            yield return WaitForFlight(flight);
            Assert.That(gold.text, Is.EqualTo(Turkish(wallet.Gold)));

            game.ReturnToMenu();
            Assert.That(flight.IsPlaying, Is.False, "The same verified win must only be presented once.");
            Assert.That(session.ReadPhoneWallet().Gold, Is.EqualTo(wallet.Gold));
        }

        [UnityTest]
        public IEnumerator GoldTwentyCountsUpWithNoPoolLeakAndReconcilesIfInterrupted()
        {
            yield return Win("reduce");
            game.ReturnToMenu();
            game.OnWebVisibilityChanged("hidden");
            Assert.That(session.SetPreferences(motion: "full"), Is.True);
            var flight = game.GetComponentInChildren<RewardFlight>();
            var gold = Counter("GoldValue");
            var wallet = session.ReadPhoneWallet();
            Assert.That(wallet.Gold, Is.GreaterThanOrEqualTo(20));
            bool completed = false;
            flight.Play(RewardKind.Gold, PlayCenter(), 20, () => completed = true);
            string old = Turkish(wallet.Gold - 20);
            string final = Turkish(wallet.Gold);
            Assert.That(gold.text, Is.EqualTo(old));
            bool sawPartialCredit = false;
            int peak = 0;
            float deadline = Time.unscaledTime + 3;
            while (flight.IsPlaying && Time.unscaledTime < deadline)
            {
                sawPartialCredit |= gold.text != old && gold.text != final;
                peak = Mathf.Max(peak, flight.ActiveIconCount);
                yield return null;
            }
            Assert.That(completed && sawPartialCredit, Is.True);
            Assert.That(peak, Is.EqualTo(8));
            Assert.That(flight.ActiveIconCount, Is.Zero);
            Assert.That(flight.GetComponentsInChildren<Image>(true).Count(icon => icon.name == "RewardIcon"), Is.EqualTo(8));
            Assert.That(flight.GetComponentsInChildren<Image>().Any(icon => icon.name == "RewardIcon"), Is.False);
            Assert.That(gold.text, Is.EqualTo(final));

            flight.Play(RewardKind.Gold, PlayCenter(), 20);
            Assert.That(gold.text, Is.EqualTo(old));
            game.OnWebVisibilityChanged("hidden");
            Assert.That(flight.IsPlaying, Is.False);
            Assert.That(flight.ActiveIconCount, Is.Zero);
            Assert.That(gold.text, Is.EqualTo(final));

            gold.transform.parent.Find("Coin").gameObject.SetActive(false);
            completed = false;
            flight.Play(RewardKind.Gold, PlayCenter(), 20, () => completed = true);
            Assert.That(completed, Is.True);
            Assert.That(flight.IsPlaying, Is.False);
            Assert.That(gold.text, Is.EqualTo(final));
        }

        [UnityTest]
        public IEnumerator InterruptedFlightStillReportsCompletionOnce()
        {
            yield return Win("reduce");
            game.ReturnToMenu();
            game.OnWebVisibilityChanged("hidden");
            Assert.That(session.SetPreferences(motion: "full"), Is.True);
            var flight = game.GetComponentInChildren<RewardFlight>();
            var gold = Counter("GoldValue");
            string final = Turkish(session.ReadPhoneWallet().Gold);
            int calls = 0;
            flight.Play(RewardKind.Gold, PlayCenter(), 20, () => calls++);
            float deadline = Time.unscaledTime + 2;
            while (flight.ActiveIconCount == 0 && flight.IsPlaying && Time.unscaledTime < deadline) yield return null;
            Assert.That(flight.IsPlaying, Is.True, "The flight must still be in the air when it is cut.");
            Assert.That(calls, Is.Zero);

            game.OnWebVisibilityChanged("hidden");
            Assert.That(flight.IsPlaying, Is.False);
            Assert.That(calls, Is.EqualTo(1), "Cancel must still call the completion callback.");
            Assert.That(flight.ActiveIconCount, Is.Zero);
            Assert.That(gold.text, Is.EqualTo(final));

            // A newer flight replacing an unfinished one also completes the first caller.
            int replaced = 0, next = 0;
            flight.Play(RewardKind.Gold, PlayCenter(), 20, () => replaced++);
            flight.Play(RewardKind.Gold, PlayCenter(), 20, () => next++);
            Assert.That(replaced, Is.EqualTo(1));
            Assert.That(next, Is.Zero);
            yield return WaitForFlight(flight);
            Assert.That(new[] { calls, replaced, next }, Is.EqualTo(new[] { 1, 1, 1 }));
            Assert.That(gold.text, Is.EqualTo(final));
        }

        [UnityTest]
        public IEnumerator ReducedFlightUsesOneIconAndCompletesWithinPointThreeFiveSeconds()
        {
            yield return Win("reduce");
            game.ReturnToMenu();
            game.OnWebVisibilityChanged("hidden");
            var flight = game.GetComponentInChildren<RewardFlight>();
            float started = Time.unscaledTime;
            float finished = -1;
            flight.Play(RewardKind.Gold, PlayCenter(), 20, () => finished = Time.unscaledTime);
            Assert.That(flight.ActiveIconCount, Is.EqualTo(1));
            while (flight.IsPlaying && Time.unscaledTime - started < 1)
            {
                Assert.That(flight.ActiveIconCount, Is.EqualTo(1));
                yield return null;
            }
            Assert.That(finished - started, Is.InRange(.27f, .35f));
            Assert.That(flight.ActiveIconCount, Is.Zero);
            Assert.That(Counter("GoldValue").text, Is.EqualTo(Turkish(session.ReadPhoneWallet().Gold)));
        }

        [UnityTest]
        public IEnumerator FlightPreemptsAndThenResumesTheHomePlayShine()
        {
            Assert.That(session.SetPreferences(motion: "full"), Is.True);
            var flight = game.GetComponentInChildren<RewardFlight>();
            var play = game.GetComponentInChildren<HomePlayButton>();
            float deadline = Time.unscaledTime + 6;
            while (!play.IsShining && Time.unscaledTime < deadline) yield return null;
            Assert.That(play.IsShining, Is.True);

            flight.Play(RewardKind.Gold, PlayCenter(), 20);
            Assert.That(flight.IsPlaying, Is.True);
            deadline = Time.unscaledTime + 3;
            while (flight.IsPlaying && Time.unscaledTime < deadline)
            {
                Assert.That(play.IsShining, Is.False);
                yield return null;
            }
            Assert.That(flight.IsPlaying, Is.False);
            Assert.That(play.IsShining, Is.True);
        }

        private Text Counter(string name) => game.GetComponentInChildren<CastleHomeView>()
            .GetComponentsInChildren<Text>().Single(label => label.name == name);

        private Vector2 PlayCenter()
        {
            var rect = (RectTransform)game.GetComponentInChildren<HomePlayButton>().transform;
            return RectTransformUtility.WorldToScreenPoint(null, rect.TransformPoint(rect.rect.center));
        }

        private static IEnumerator WaitForFlight(RewardFlight flight)
        {
            float deadline = Time.unscaledTime + 3;
            while (flight.IsPlaying && Time.unscaledTime < deadline) yield return null;
            Assert.That(flight.IsPlaying, Is.False);
            Assert.That(flight.ActiveIconCount, Is.Zero);
        }

        private static string Turkish(int number) => number.ToString("N0", CultureInfo.GetCultureInfo("tr-TR"));
    }
}
