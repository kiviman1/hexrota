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
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    // A cheap test coop (costs 1 and 2) so one won chapter makes the first upgrade affordable.
    public sealed class CoopHomeTests
    {
        private Func<UnityGameSession> original;
        private ClientGameData data;
        private MemoryProfileStorage storage;
        private CoopRules config;
        private FirstPlayableController game;
        private int[] last;

        internal static CoopRules TestConfig(params int[] costs) =>
            new CoopRules(new[] { new CoopRules.Area("test-farm", costs.Select(cost => new CoopRules.Upgrade(cost, 1))) });

        // Plays the first chapter up to its last move (or to the win) outside the scene.
        internal static int[] PrepareFirstChapter(ClientGameData data, MemoryProfileStorage storage, CoopRules config, bool win)
        {
            var preparer = new UnityGameSession(data, storage, new SystemUtcClock(), coop: config);
            Assert.That(preparer.EnterLevelOne(), Is.True, preparer.LastError);
            var attempts = W.Required(W.Required(storage.Read(ProfileRepository.ProfileKey), "game"), "attempts");
            var identity = W.Required(attempts, preparer.ActiveStage.ToString());
            var level = data.Catalog.ResolveLevelWire(W.Required(identity, "levelId"),
                (string)W.Required(identity, "variantId"), (string)W.Required(identity, "levelDataVersion"));
            var route = W.List(level["solution"]).Select(pair => W.List(pair).Select(W.Int32).ToArray()).ToArray();
            foreach (var step in route.Take(win ? route.Length : route.Length - 1))
            {
                Assert.That(preparer.TrySwap(step[0], step[1]).Ok, Is.True, preparer.LastError);
                preparer.CompletePresentation();
            }
            preparer.ReturnToMenu();
            return route.Last();
        }

        private IEnumerator Open(bool won, string motion)
        {
            original = FirstPlayableController.SessionFactory;
            data = ClientGameData.FromResources();
            storage = new MemoryProfileStorage();
            config = TestConfig(1, 2);
            last = PrepareFirstChapter(data, storage, config, won);
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, storage, new SystemUtcClock(), coop: config);
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(game.Session.SetPreferences(motion: motion), Is.True);
            yield return null;
        }

        [UnityTearDown]
        public IEnumerator CleanUp()
        {
            if (original != null) FirstPlayableController.SessionFactory = original;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        private CoopHomeView Coop => game.GetComponentInChildren<CoopHomeView>();
        private HomePlayButton Play => game.GetComponentInChildren<HomePlayButton>();

        [UnityTest]
        public IEnumerator BarShowsEggsTowardTheNextUpgradeWithoutPulsing()
        {
            yield return Open(false, "full");
            game.ReturnToMenu();
            yield return null;
            Assert.That(Coop.ProgressText, Is.EqualTo("0/1"));
            Assert.That(Coop.ShownFill, Is.Zero);
            Assert.That(Coop.ReadyBadgeShown, Is.False);
            float until = Time.unscaledTime + 1;
            while (Time.unscaledTime < until)
            {
                Assert.That(Coop.IsPulsing, Is.False);
                yield return null;
            }
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator ReadyCoopPulsesSilencesTheShineAndStopsUnderAPanel()
        {
            yield return Open(true, "full");
            game.ReturnToMenu();
            float deadline = Time.unscaledTime + 3;
            while (!Coop.IsPulsing && Time.unscaledTime < deadline) yield return null;
            Assert.That(Coop.IsPulsing, Is.True);
            Assert.That(Coop.ProgressText, Is.EqualTo("Hazır!"));
            Assert.That(Coop.ReadyBadgeShown, Is.True);
            Assert.That(Coop.ShownFill, Is.EqualTo(1).Within(.001f));
            Assert.That(Coop.ReadyBadgeShown && Coop.CoopVisual.GetComponentInChildren<Image>(false) != null, Is.True);
            float coopPeak = 1, barPeak = 1;
            float beat = Time.unscaledTime + 1.5f;
            while (Time.unscaledTime < beat)
            {
                coopPeak = Mathf.Max(coopPeak, Coop.CoopVisual.localScale.x);
                barPeak = Mathf.Max(barPeak, Coop.ProgressBar.localScale.x);
                yield return null;
            }
            Assert.That(coopPeak, Is.GreaterThan(1.01f), "The coop itself beats.");
            Assert.That(barPeak, Is.GreaterThan(1.01f), "The bar beats with it.");

            // Longer than a shine interval: the play button must not shine while the coop pulses.
            deadline = Time.unscaledTime + 4.5f;
            while (Time.unscaledTime < deadline)
            {
                Assert.That(Play.IsShining, Is.False);
                yield return null;
            }

            game.OpenMobileSettings();
            yield return null;
            yield return null;
            Assert.That(Coop.IsPulsing, Is.False, "No pulse while a panel is open.");
            Assert.That(Coop.CoopVisual.localScale.x, Is.EqualTo(1).Within(.0001f));
            Assert.That(Coop.ProgressBar.localScale.x, Is.EqualTo(1).Within(.0001f));
            game.GetComponentsInChildren<Button>().Single(button => button.name == "Kapat").onClick.Invoke();
            deadline = Time.unscaledTime + 2;
            while (!Coop.IsPulsing && Time.unscaledTime < deadline) yield return null;
            Assert.That(Coop.IsPulsing, Is.True);
        }

        [UnityTest]
        public IEnumerator ReducedMotionShowsReadyWithoutAPulse()
        {
            yield return Open(true, "reduce");
            game.ReturnToMenu();
            yield return null;
            Assert.That(Coop.ProgressText, Is.EqualTo("Hazır!"));
            Assert.That(Coop.ReadyBadgeShown, Is.True);
            float until = Time.unscaledTime + 1;
            while (Time.unscaledTime < until)
            {
                Assert.That(Coop.IsPulsing, Is.False);
                yield return null;
            }
        }

        [UnityTest]
        public IEnumerator UnaffordablePanelExplainsTheUpgradeAndOnlyShakes()
        {
            yield return Open(false, "full");
            game.ReturnToMenu();
            yield return null;
            Coop.Button.onClick.Invoke();
            var panel = Coop.Panel;
            Assert.That(panel.IsOpen, Is.True);
            yield return new WaitForSecondsRealtime(.4f);
            Assert.That(panel.Title, Is.EqualTo("Kümes Seviye 1"));
            Assert.That(panel.Card, Is.EqualTo("Kümes kurulur ve 1 yeni tavuk gelir."));
            Assert.That(panel.Action, Is.EqualTo("Kümesi inşa et"), "Level 0: the first upgrade builds the coop.");
            Assert.That(panel.Cost, Is.EqualTo("1"));
            Assert.That(panel.Hint, Is.EqualTo("1 yumurta daha"));
            Assert.That(panel.CanUpgrade, Is.False);
            Assert.That(Play.IsShining, Is.False);

            panel.UpgradeButton.onClick.Invoke();
            Assert.That(panel.IsShaking, Is.True);
            Assert.That(panel.IsOpen, Is.True);
            Assert.That(game.Session.ReadCoop().Level, Is.Zero);
            Assert.That(storage.Contains(CoopLedger.StorageKey), Is.False);

            panel.GetComponentsInChildren<Button>().Single(b => b.name == "CloseButton").onClick.Invoke();
            float deadline = Time.unscaledTime + 1;
            while (panel.IsOpen && Time.unscaledTime < deadline) yield return null;
            Assert.That(panel.IsOpen, Is.False);
        }

        [UnityTest]
        public IEnumerator TappingTheCoopOpensTheAffordablePanelAndUpgradeSpendsTheEggs()
        {
            yield return Open(true, "reduce");
            game.ReturnToMenu();
            yield return null;
            int eggs = game.Session.ReadPhoneWallet().GoldenEggs;
            var plot = game.GetComponentInChildren<HomeBackgroundLayers>().CoopPlot;
            Assert.That(Coop.Button.transform.IsChildOf(plot), Is.True, "The tap target is the plot with its coop.");
            Assert.That(game.GetComponentsInChildren<Button>(true).Any(b => b.name == "CoopButton"), Is.False,
                "There is no separate coop button.");
            Assert.That(Coop.CoopBuilt, Is.False, "Level 0: the plot is empty.");
            Assert.That(Coop.EmptyPlotShown, Is.True, "Level 0 shows fence stakes.");
            Coop.Button.onClick.Invoke();
            var panel = Coop.Panel;
            yield return null;
            Assert.That(panel.IsOpen, Is.True);
            Assert.That(panel.CanUpgrade, Is.True);
            Assert.That(panel.Hint, Is.Null);

            panel.UpgradeButton.onClick.Invoke();
            Assert.That(game.Session.ReadCoop().Level, Is.EqualTo(1), "The upgrade is saved before anything animates.");
            Assert.That(game.Session.ReadPhoneWallet().GoldenEggs, Is.EqualTo(eggs - 1));
            float deadline = Time.unscaledTime + 3;
            while ((panel.IsOpen || Coop.Status.Level != 1) && Time.unscaledTime < deadline) yield return null;
            Assert.That(panel.IsOpen, Is.False);
            Assert.That(Coop.ProgressText, Is.EqualTo("0/2"));
            Assert.That(Coop.CoopBuilt, Is.True, "The coop appears from level 1.");
            Assert.That(Coop.EmptyPlotShown, Is.False);
            Assert.That(new UnityGameSession(data, storage, new SystemUtcClock(), coop: config).ReadCoop().Level, Is.EqualTo(1));
        }

        [UnityTest]
        public IEnumerator EggsLandBeforeTheBarFillsAndThePulseStarts()
        {
            yield return Open(false, "full");
            game.BeginLevelOne();
            yield return ChapterEntryWait.Ready(game);
            game.RequestSwap(last[0], last[1]);
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
            game.GetComponentsInChildren<Button>().Single(button => button.name == "Ana menü").onClick.Invoke();

            var flight = game.GetComponentInChildren<RewardFlight>();
            Assert.That(flight.IsPlaying, Is.True);
            Assert.That(Coop.ProgressText, Is.EqualTo("0/1"), "The earned egg is still in the air.");
            deadline = Time.unscaledTime + 4;
            while (flight.IsPlaying && Time.unscaledTime < deadline)
            {
                Assert.That(Coop.IsPulsing, Is.False, "The reward flight owns attention.");
                Assert.That(Coop.ReadyBadgeShown, Is.False);
                yield return null;
            }
            Assert.That(flight.IsPlaying, Is.False);
            deadline = Time.unscaledTime + 2;
            while (!Coop.IsPulsing && Time.unscaledTime < deadline) yield return null;
            Assert.That(Coop.ProgressText, Is.EqualTo("Hazır!"));
            Assert.That(Coop.IsPulsing, Is.True);
        }
    }
}
