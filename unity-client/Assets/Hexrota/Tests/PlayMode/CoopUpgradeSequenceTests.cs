using System;
using System.Collections;
using System.Globalization;
using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace Hexrota.UnityClientTests
{
    public sealed class CoopUpgradeSequenceTests : PlayModeTest
    {
        private Func<UnityGameSession> original;
        private ClientGameData data;
        private MemoryProfileStorage storage;
        private CoopRules config;
        private FirstPlayableController game;

        // One won chapter = one egg; the test coop's first upgrade costs exactly that.
        private IEnumerator OpenReadyHome(string motion)
        {
            original = FirstPlayableController.SessionFactory;
            data = ClientGameData.FromResources();
            storage = new MemoryProfileStorage();
            config = CoopHomeTests.TestConfig(1, 2);
            CoopHomeTests.PrepareFirstChapter(data, storage, config, true);
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, storage, new SystemUtcClock(), coop: config);
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(game.Session.SetPreferences(motion: motion), Is.True);
            game.ReturnToMenu();
            yield return null;
            Assert.That(Coop.Status.Ready, Is.True);
        }

        [UnityTearDown]
        public IEnumerator CleanUp()
        {
            if (original != null) FirstPlayableController.SessionFactory = original;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        private CoopHomeView Coop => game.GetComponentInChildren<CoopHomeView>();
        private CoopUpgradeSequence Sequence => game.GetComponentInChildren<CoopUpgradeSequence>();
        private RewardFlight Flight => game.GetComponentInChildren<RewardFlight>();
        // The Golden Egg count is the coop bar's "have/cost" text (no separate egg pill).
        private string EggCounter => Coop.ProgressText;

        private void PressUpgrade()
        {
            Coop.Button.onClick.Invoke();
            Assert.That(Coop.Panel.IsOpen, Is.True);
        }

        private static IEnumerator WaitUntilOpen(CoopUpgradePanel panel)
        {
            float deadline = Time.unscaledTime + 1;
            while (!panel.CanUpgrade && Time.unscaledTime < deadline) yield return null;
            Assert.That(panel.CanUpgrade, Is.True);
        }

        [UnityTest]
        public IEnumerator DevelopmentShortcutPreviewsLevelsAndReplaysTheTransitionWithoutSaving()
        {
            yield return OpenReadyHome("full");
            var shortcut = game.GetComponentInChildren<CoopDevelopmentShortcut>();
            Assert.That(shortcut, Is.Not.Null, "The coop shortcut is on the home in the Editor.");
            Assert.That(game.transform.GetComponentsInChildren<Button>(true).Count(b => b.name == CoopDevelopmentShortcut.LevelButtonName), Is.EqualTo(1));
            var saved = game.Session.ReadCoop();
            var view = Coop.Sprite;
            for (int level = 0; level < view.LevelCount; level++)
            {
                shortcut.ShowLevel(level);
                Assert.That(view.Level, Is.EqualTo(level), "Shows level " + level + " at once.");
            }
            shortcut.ShowLevel(3);
            Assert.That(shortcut.Replay(), Is.True);
            Assert.That(Sequence.IsPlaying, Is.True);
            Assert.That(view.Level, Is.EqualTo(2), "The transition starts from the level below.");
            float deadline = Time.unscaledTime + 8;
            while (Sequence.IsPlaying && Time.unscaledTime < deadline) yield return null;
            Assert.That(Sequence.IsPlaying, Is.False);
            Assert.That(view.Level, Is.EqualTo(3), "It ends on the previewed level.");
            var after = game.Session.ReadCoop();
            Assert.That(after.Level, Is.EqualTo(saved.Level), "A preview never saves a level.");
            Assert.That(after.Eggs, Is.EqualTo(saved.Eggs), "A preview never spends eggs.");
        }

        [UnityTest]
        public IEnumerator SequenceSpendsTheEggsBuildsTheLevelAndHoldsAllOtherAttention()
        {
            yield return OpenReadyHome("full");
            var play = game.GetComponentInChildren<HomePlayButton>();
            PressUpgrade();
            yield return WaitUntilOpen(Coop.Panel);
            Coop.Panel.UpgradeButton.onClick.Invoke();

            Assert.That(Sequence.IsPlaying, Is.True);
            Assert.That(game.Session.ReadCoop().Level, Is.EqualTo(1), "Data is saved before step 1.");
            Assert.That(new UnityGameSession(data, storage, new SystemUtcClock(), coop: config).ReadPhoneWallet().GoldenEggs, Is.Zero);
            Assert.That(EggCounter, Is.EqualTo("Hazır!"), "The bar keeps its count until the eggs leave it.");

            bool sawFlight = false, sawBanner = false, sawDust = false, swappedUnderDust = false;
            float squash = 0;
            Assert.That(Coop.Sprite.ShownName, Is.EqualTo("Coop_L0"));
            float deadline = Time.unscaledTime + 6;
            while (Sequence.IsPlaying && Time.unscaledTime < deadline)
            {
                sawFlight |= Flight.ActiveIconCount > 0;
                sawBanner |= Sequence.Banner == "Seviye 1!";
                if (Sequence.DustCovering)
                {
                    sawDust = true;
                    Assert.That(Coop.Sprite.ShownName, Is.EqualTo("Coop_L0"), "The old coop stays until the dust is densest.");
                }
                else if (sawDust && Sequence.DustPlaying) swappedUnderDust |= Coop.Sprite.ShownName == "Coop_L1";
                squash = Mathf.Max(squash, Mathf.Abs(Coop.Sprite.transform.parent.localScale.y - 1));
                Assert.That(play.IsShining, Is.False, "No other attention animation during the upgrade.");
                Assert.That(Coop.IsPulsing, Is.False);
                yield return null;
            }
            Assert.That(Sequence.IsPlaying, Is.False);
            Assert.That(sawFlight && sawBanner, Is.True);
            Assert.That(sawDust, Is.True, "A dust cloud covers the building.");
            Assert.That(swappedUnderDust, Is.True, "The sprite changes while the dust is still up.");
            Assert.That(squash, Is.GreaterThan(.01f), "The new building squashes and stretches in.");
            Assert.That(Coop.Sprite.transform.parent.localScale, Is.EqualTo(Vector3.one), "It settles back.");
            Assert.That(Coop.Sprite.ShownName, Is.EqualTo("Coop_L1"));
            Assert.That(Flight.ActiveIconCount, Is.Zero);
            Assert.That(EggCounter, Is.EqualTo("0/2"), "The bar restarts toward the next cost.");
            Assert.That(Sequence.VisibleResidents, Is.EqualTo(1));
            Assert.That(Coop.Status.Level, Is.EqualTo(1));
            Assert.That(Coop.ProgressText, Is.EqualTo("0/2"));
            Assert.That(Coop.Panel.IsOpen, Is.False);
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest]
        public IEnumerator ReducedMotionUsesOneIconAndFinishesWithinHalfASecond()
        {
            yield return OpenReadyHome("reduce");
            PressUpgrade();
            yield return WaitUntilOpen(Coop.Panel);
            float started = Time.unscaledTime;
            Coop.Panel.UpgradeButton.onClick.Invoke();
            int peak = 0;
            bool faded = false;
            while (Sequence.IsPlaying && Time.unscaledTime - started < 2)
            {
                peak = Mathf.Max(peak, Flight.ActiveIconCount);
                Assert.That(Sequence.DustPlaying, Is.False, "No dust with reduced motion.");
                faded |= Coop.Sprite.Fading;
                yield return null;
            }
            Assert.That(faded, Is.True, "Reduced motion cross-fades the sprites.");
            Assert.That(Coop.Sprite.ShownName, Is.EqualTo("Coop_L1"));
            Assert.That(Time.unscaledTime - started, Is.LessThanOrEqualTo(.55f), "≤ 0.5 s plus one frame.");
            Assert.That(peak, Is.LessThanOrEqualTo(1));
            Assert.That(Sequence.VisibleResidents, Is.EqualTo(1));
            Assert.That(EggCounter, Is.EqualTo("0/2"), "The bar restarts toward the next cost.");
        }

        [UnityTest]
        public IEnumerator InterruptingTheSequenceKeepsTheSavedUpgrade()
        {
            yield return OpenReadyHome("full");
            PressUpgrade();
            yield return WaitUntilOpen(Coop.Panel);
            Coop.Panel.UpgradeButton.onClick.Invoke();
            float deadline = Time.unscaledTime + 3;
            while (Flight.ActiveIconCount == 0 && Time.unscaledTime < deadline) yield return null;
            Assert.That(Flight.IsPlaying && Sequence.IsPlaying, Is.True, "Interrupt while the eggs are in the air.");

            game.OnWebVisibilityChanged("hidden");
            Assert.That(Sequence.IsPlaying, Is.False);
            Assert.That(Flight.IsPlaying, Is.False);
            Assert.That(EggCounter, Is.EqualTo("0/2"), "The bar restarts toward the next cost.");
            Assert.That(Coop.Status.Level, Is.EqualTo(1));

            // A fresh scene and session read the same saved state.
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(game.Session.ReadCoop().Level, Is.EqualTo(1));
            Assert.That(game.Session.ReadPhoneWallet().GoldenEggs, Is.Zero);
            Assert.That(game.Session.ReadPhoneWallet().EarnedEggs, Is.EqualTo(1));
            game.ReturnToMenu();
            yield return null;
            Assert.That(Coop.Status.Level, Is.EqualTo(1));
            Assert.That(Sequence.VisibleResidents, Is.EqualTo(1));
        }

        [UnityTest]
        public IEnumerator SceneChangeMidSequenceDoesNotLoseOrRepeatTheUpgrade()
        {
            yield return OpenReadyHome("full");
            PressUpgrade();
            yield return WaitUntilOpen(Coop.Panel);
            Coop.Panel.UpgradeButton.onClick.Invoke();
            yield return new WaitForSecondsRealtime(.3f);
            Assert.That(Sequence.IsPlaying, Is.True);
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            var restored = new UnityGameSession(data, storage, new SystemUtcClock(), coop: config);
            Assert.That(restored.ReadCoop().Level, Is.EqualTo(1));
            Assert.That(restored.ReadPhoneWallet().GoldenEggs, Is.Zero);
            Assert.That(SpentEggs(storage), Is.EqualTo(1));
        }

        private static long SpentEggs(MemoryProfileStorage store) =>
            Hexrota.Contracts.Wire.Integer(Hexrota.Contracts.Wire.Get(store.Read(CoopLedger.StorageKey), "spentEggs"));
    }
}
