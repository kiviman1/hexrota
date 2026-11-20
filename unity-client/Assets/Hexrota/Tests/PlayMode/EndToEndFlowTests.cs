using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Application;
using Hexrota.Gameplay;
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
    // One profile through the real scene and its buttons:
    // first chapter with its lesson -> (chapters 2-5 prepared) -> V5 chapter 6: bag from the HUD ->
    // Green Brush -> loss -> TEST rescue ad (+5) -> loss -> retry -> win -> reward -> coop upgrade ->
    // next chapter. Chapters 2-5 are won through the session only to reach a V5 chapter with boosters.
    public sealed class EndToEndFlowTests : PlayModeTest
    {
        private Func<UnityGameSession> original;
        private FirstPlayableController game;
        private MemoryProfileStorage storage;
        private ClientGameData data;
        private CoopRules coop;

        [UnitySetUp] public IEnumerator StartScene()
        {
            original = FirstPlayableController.SessionFactory;
            storage = new MemoryProfileStorage();
            data = ClientGameData.FromResources();
            coop = CoopHomeTests.TestConfig(1, 2, 3, 4);
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, storage, new SystemUtcClock(), coop: coop);
            yield return Load();
        }

        [UnityTearDown] public IEnumerator Finish()
        {
            FirstPlayableController.SessionFactory = original;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        private IEnumerator Load()
        {
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(game.Session, Is.Not.Null);
            Assert.That(game.Session.SetPreferences(motion: "reduce"), Is.True);
            yield return null;
        }

        private Button Find(string name)
        {
            var matches = game.GetComponentsInChildren<Button>().Where(b => b.name == name).ToArray();
            Assert.That(matches, Has.Length.EqualTo(1), "Exactly one visible button named " + name);
            return matches[0];
        }

        private void Click(string name)
        {
            var button = Find(name);
            Assert.That(button.interactable, Is.True, name);
            button.onClick.Invoke();
        }

        private IEnumerator WaitFor(Func<bool> condition, string what, float seconds = 15f)
        {
            float deadline = Time.realtimeSinceStartup + seconds;
            while (!condition() && Time.realtimeSinceStartup < deadline)
            {
                var victory = UnityEngine.Object.FindAnyObjectByType<ChapterVictoryView>();
                if (victory != null && victory.gameObject.activeInHierarchy)
                    ExecuteEvents.Execute(victory.gameObject, new PointerEventData(EventSystem.current), ExecuteEvents.pointerClickHandler);
                yield return null;
            }
            Assert.That(condition(), Is.True, "Timed out waiting for " + what);
        }

        // Home Play opens the chapter preview for a later chapter; Başla starts it.
        private IEnumerator PlayFromHome()
        {
            Click("PlayButton");
            yield return null;
            if (game.CurrentScreen == "preview") Click("Başla");
            yield return ChapterEntryWait.Ready(game);
            Assert.That(game.CurrentScreen, Is.EqualTo("playing"));
        }

        private IEnumerator Swap(int[] pair)
        {
            int turn = game.Session.Snapshot.turn;
            game.RequestSwap(pair[0], pair[1]);
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(turn + 1), "Swap " + pair[0] + "-" + pair[1] + ": " + game.Session.LastError);
            yield return WaitFor(() => !game.Board.IsAnimating, "the swap animation");
        }

        private void TapCell(int index)
        {
            var cell = game.Session.Level.cells[index];
            var xy = MobileLayout.Axial(cell.q, cell.r);
            var e = new PointerEventData(EventSystem.current) { pointerId = 7,
                position = game.Board.BoardCamera.WorldToScreenPoint(new Vector3(xy.x, xy.y, 0)) };
            ExecuteEvents.Execute(game.Board.gameObject, e, ExecuteEvents.pointerDownHandler);
            ExecuteEvents.Execute(game.Board.gameObject, e, ExecuteEvents.pointerUpHandler);
        }

        // Legal swaps on a clone that end in a loss without winning, leaving a legal swap for the rescue.
        private static List<int[]> LosingRoute(HexMatch board)
        {
            for (uint seed = 1; seed <= 400; seed++)
            {
                var candidate = board.Clone(); var route = new List<int[]>(); uint random = seed;
                while (candidate.Status == "playing")
                {
                    var moves = candidate.LegalMoves().Where(pair => { var probe = candidate.Clone(); probe.Swap(pair[0], pair[1]); return probe.Status != "won"; }).ToList();
                    if (moves.Count == 0) break;
                    random = unchecked(random * 1664525u + 1013904223u);
                    var pick = moves[(int)(random % (uint)moves.Count)];
                    candidate.Swap(pick[0], pick[1]); route.Add(pick);
                }
                if (candidate.Status == "lost" && candidate.LegalMoves().Count > 0) return route;
            }
            Assert.Fail("No losing route that keeps a legal swap.");
            return null;
        }

        private static HexMatch Replay(HexMatch board, IEnumerable<int[]> route)
        {
            var copy = board.Clone();
            foreach (var pair in route) Assert.That(copy.Swap(pair[0], pair[1]).ok, Is.True);
            return copy;
        }

        // The certified winning route of the session's active attempt (its saved variant).
        private int[][] Route(UnityGameSession session)
        {
            var attempt = W.Required(W.Required(W.Required(storage.Read(ProfileRepository.ProfileKey), "game"), "attempts"), session.ActiveStage.ToString());
            var level = data.Catalog.ResolveLevelWire(W.Required(attempt, "levelId"), (string)W.Required(attempt, "variantId"),
                (string)W.Required(attempt, "levelDataVersion"));
            return W.List(level["solution"]).Select(pair => W.List(pair).Select(W.Int32).ToArray()).ToArray();
        }

        private void WinWithSession(UnityGameSession session, int stage)
        {
            Assert.That(session.EnterStage(stage), Is.True, session.LastError);
            foreach (var pair in Route(session))
            {
                if (session.NeedsTutorialAcknowledgement) Assert.That(session.AcknowledgeTutorial(), Is.True);
                Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True, session.LastError);
                session.CompletePresentation();
            }
            Assert.That(session.Status, Is.EqualTo("won"));
            session.ReturnToMenu();
        }

        [UnityTest]
        public IEnumerator LessonBoosterLossRescueWinRewardCoopAndNextChapterThroughTheRealInterface()
        {
            // 1. First chapter from the home Play button, with its in-chapter lesson.
            Assert.That(game.Session.FirstOpening, Is.True);
            Click("PlayButton");
            yield return ChapterEntryWait.Ready(game);
            int first = game.Session.TutorialCount;
            Assert.That(game.Session.ActiveStage, Is.EqualTo(first));
            var lesson = game.Session.OpeningLessonPair;
            var route = Route(game.Session);
            yield return ChapterEntryWait.PlayOpeningMove(game);
            Assert.That(route[0].OrderBy(i => i), Is.EqualTo(lesson.OrderBy(i => i)), "The lesson teaches the certified opening.");
            foreach (var step in route.Skip(1)) yield return Swap(step);
            yield return WaitFor(() => game.CurrentScreen == "result", "the first chapter result");
            Assert.That(game.Session.Status, Is.EqualTo("won"));
            game.ReturnToMenu();

            // 2. Chapters 2-5 (classic-v4) through the session, then reopen the scene on the same profile.
            var preparer = new UnityGameSession(data, storage, new SystemUtcClock(), coop: coop);
            for (int stage = first + 1; stage < first + 5; stage++) WinWithSession(preparer, stage);
            preparer.Suspend();
            yield return Load();

            // 3. Chapter 6 is a V5 board: open the bag from the HUD and brush an open ground cell.
            int sixth = first + 5;
            yield return PlayFromHome();
            Assert.That(game.Session.ActiveStage, Is.EqualTo(sixth));
            Assert.That(game.Session.Level.rulesVersion, Is.EqualTo("classic-v5"));
            var board = new HexMatch(game.Session.Level, game.Session.Snapshot);
            int cell = Enumerable.Range(0, board.Total).First(i => board.IsPlayable(i) && board.layers[i] > 0);
            Click(CastleHudView.BagButtonName);
            Assert.That(game.CurrentScreen, Is.EqualTo("inventory"));
            Click("Hücre seç");
            TapCell(cell);
            Click("1 Yeşil Fırça kullan");
            yield return WaitFor(() => game.CurrentScreen == "playing" && !game.Board.IsAnimating, "the brush");
            Assert.That(game.Session.Snapshot.layers[cell], Is.EqualTo(board.layers[cell] - 1));
            Assert.That(game.Session.InventoryOffer("greenBrush").Used, Is.EqualTo(1));
            board.layers[cell]--; // the brush changes ground only; values and RNG are untouched

            // 4. Lose with real swaps.
            var loss = LosingRoute(board);
            foreach (var pair in loss) yield return Swap(pair);
            Assert.That(game.Session.Status, Is.EqualTo("lost"));

            // 5. Rescue from the loss sheet with the TEST ad: +5 moves on the same board.
            yield return WaitFor(() => game.GetComponentsInChildren<Button>().Any(b => b.name == "TEST reklamı · +5 hamle"), "the rescue offer");
            var lost = game.Session.Snapshot;
            Click("TEST reklamı · +5 hamle");
            Click("TEST reklamını tamamla");
            yield return WaitFor(() => game.CurrentScreen == "playing", "the rescued board");
            Assert.That(game.Session.Status, Is.EqualTo("playing"));
            Assert.That(game.Session.Snapshot.movesLeft, Is.EqualTo(lost.movesLeft + 5));
            CollectionAssert.AreEqual(lost.values, game.Session.Snapshot.values);
            CollectionAssert.AreEqual(lost.blockerHp, game.Session.Snapshot.blockerHp);

            // Spend the five moves without winning, then retry.
            var rescued = Replay(board, loss); rescued.movesLeft += 5;
            var tail = LosingRoute(rescued);
            foreach (var pair in tail) yield return Swap(pair);
            Assert.That(game.Session.Status, Is.EqualTo("lost"));
            string lostAttempt = game.Session.AttemptId;
            yield return WaitFor(() => game.GetComponentsInChildren<Button>().Any(b => b.name == "Yeniden dene"), "the retry button");
            Click("Yeniden dene");
            yield return WaitFor(() => game.CurrentScreen == "playing" && !game.IsEnteringStage, "the retried chapter");
            Assert.That(game.Session.AttemptId, Is.Not.EqualTo(lostAttempt));

            // 6. Win the new attempt with real swaps; the result grants the reward.
            var before = game.Session.ReadPhoneWallet();
            foreach (var step in Route(game.Session)) yield return Swap(step);
            yield return WaitFor(() => game.CurrentScreen == "result", "the chapter 6 result");
            Assert.That(game.Session.Status, Is.EqualTo("won"));
            var after = game.Session.ReadPhoneWallet();
            Assert.That(after.GoldenEggs, Is.EqualTo(before.GoldenEggs + 1));
            Assert.That(after.Gold, Is.GreaterThan(before.Gold));

            // 7. Home: the coop upgrade spends a Golden Egg.
            game.ReturnToMenu();
            var home = game.GetComponentInChildren<CoopHomeView>();
            int level = game.Session.ReadCoop().Level;
            yield return WaitFor(() => { if (!home.Panel.IsOpen) home.Button.onClick.Invoke(); return home.Panel.IsOpen; }, "the coop panel");
            Assert.That(home.Panel.CanUpgrade, Is.True);
            home.Panel.UpgradeButton.onClick.Invoke();
            Assert.That(game.Session.ReadCoop().Level, Is.EqualTo(level + 1));
            Assert.That(game.Session.ReadPhoneWallet().GoldenEggs, Is.EqualTo(after.GoldenEggs - coop.Areas[0].Upgrades[level].Cost));
            yield return WaitFor(() => !home.Panel.IsOpen && home.Status.Level == level + 1, "the upgrade sequence");

            // 8. The next chapter starts from Play.
            yield return PlayFromHome();
            Assert.That(game.Session.ActiveStage, Is.EqualTo(sixth + 1));
            LogAssert.NoUnexpectedReceived();
        }
    }
}
