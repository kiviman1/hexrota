using System;
using System.Linq;
using Hexrota.Catalog;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    public sealed partial class UnityGameSession
    {
        private long openingRevision = -1;
        private int[] openingPair, openingMatches;

        private bool FirstAttemptAtTurn(int chapter, int turn)
        {
            if (!HasAttempt || ActiveStage != TutorialCount + chapter - 1 || Status != "playing" || Snapshot.turn != turn)
                return false;
            var stats = W.Get(controller.GameSave["attemptStats"], ActiveStage.ToString());
            return W.Equal(W.Get(stats, "attemptNumber"), 1L);
        }

        private void ReadOpeningMove()
        {
            if (!inGame) { openingRevision = -1; openingPair = openingMatches = null; return; }
            if (openingRevision == Revision) return;
            openingRevision = Revision;
            openingPair = openingMatches = null;
            if (!HasAttempt || ActiveStage != TutorialCount || Status != "playing" || Snapshot.turn != 0 ||
                IsStageComplete(TutorialCount - 1) || PlayedEarlierFirstChapterAttempt()) return;
            var level = ActiveLevelWire;
            var archive = W.Get(data.ArchivedOpeningSolutions, (string)W.Get(level, "levelDataVersion", LevelCatalog.LegacyDataVersion));
            var route = W.List(W.Get(archive, (string)W.Get(level, "variantId", LevelCatalog.LegacyVariantId), level["solution"]));
            if (route.Count == 0) return;
            var pair = W.List(route[0]);
            int from = W.Int32(pair[0]), to = W.Int32(pair[1]);
            var board = new Hexrota.Gameplay.HexMatch(LevelCatalog.GameplayConfig(level), Snapshot);
            var swap = board.Swap(from, to);
            if (!swap.ok || swap.frames.Length != 1 || swap.frames[0].matched.Length != 3) return;
            openingMatches = swap.frames[0].matched;
            openingPair = !openingMatches.Contains(to) && openingMatches.Contains(from)
                ? new[] { to, from } : new[] { from, to };
        }

        public bool ShouldTeachOpening { get { ReadOpeningMove(); return openingPair != null; } }
        public int[] OpeningLessonPair { get { ReadOpeningMove(); return openingPair?.ToArray(); } }
        public int[] OpeningLessonMatchIndices { get { ReadOpeningMove(); return openingMatches?.ToArray(); } }
        public enum MechanicLesson { None, DoubleGround, Crates, FiveStone }

        public MechanicLesson ChapterMechanicLesson
        {
            get
            {
                int chapter = ActiveStage - TutorialCount + 1;
                if ((chapter != 3 && chapter != 6 && chapter != 8) || !FirstAttemptAtTurn(chapter, 0))
                    return MechanicLesson.None;
                // Saved attempts can resolve to an archived variant of the chapter.
                var level = Level;
                switch (chapter)
                {
                    case 3 when level.cells.Any(cell => cell.layers == 2): return MechanicLesson.DoubleGround;
                    case 6 when level.obstacles?.blockers?.Length > 0: return MechanicLesson.Crates;
                    case 8 when level.palette.Contains(5): return MechanicLesson.FiveStone;
                    default: return MechanicLesson.None;
                }
            }
        }

        private bool PlayedEarlierFirstChapterAttempt()
        {
            // A fresh board replaces its predecessor. The life ledger retains the moves
            // used on the settled attempt, including restarts whose charge was waived.
            var life = W.Required(controller.EnergySave, "life");
            var levelId = data.Levels[TutorialCount]["id"];
            if (W.Map(W.Required(life, "settledAttempts")).Values.Any(row =>
                W.Equal(W.Get(row, "levelId"), levelId) && W.Integer(W.Get(row, "movesUsed")) > 0)) return true;
            var archive = W.Get(life, "settledArchive");
            return archive != null && W.Map(archive).Values.Select(W.List)
                .Any(row => W.Equal(row[0], levelId) && W.Integer(row[3]) > 0);
        }

        // The coop follows a real first swap and the first chapter win. Archived
        // lesson checkpoints still contribute their earned scene progress.
        public int CompletedSceneTutorials
        {
            get
            {
                var save=controller.GameSave;
                var done = W.List(save["done"]);
                if (done.Any(value => W.Int32(value) >= TutorialCount - 1)) return 2;
                var boards = W.Map(save["boards"]);
                var firstChapter = W.Get(boards, TutorialCount.ToString());
                return done.Contains(0L) || boards.ContainsKey("1") ||
                    W.Int32(W.Get(firstChapter, "turn", 0L)) > 0 || PlayedEarlierFirstChapterAttempt() ? 1 : 0;
            }
        }

        public sealed class PhoneWallet
        {
            public int Lives, Maximum, Gold, Stars, Brushes, Keys;
            public string Timer, Countdown;
        }

        public PhoneWallet ReadPhoneWallet()
        {
            var life = controller.View()["life"];
            var wallet = controller.EconomyView;
            bool unlimited = W.Equal(W.Get(life, "unlimited"), true);
            long seconds = (long)Math.Ceiling(Convert.ToDouble(W.Get(life, unlimited ? "unlimitedRemainingMs" : "remainingMs")) / 1000);
            string time = (seconds / 60) + ":" + (seconds % 60).ToString("00");
            return new PhoneWallet {
                Lives = W.Int32(W.Required(life, "lives")), Maximum = W.Int32(W.Required(life, "maxLives")),
                Gold = W.Int32(wallet["gold"]), Stars = W.Int32(wallet["stars"]),
                Brushes = W.Int32(W.Required(wallet["inventory"], "greenBrush")), Keys = W.Int32(W.Required(wallet["inventory"], "colorKey")),
                Timer = W.Get(life, "nextLifeAtUtc") != null ? "Sonraki can " + time : unlimited ? time : "Canlar dolu",
                Countdown = unlimited || W.Get(life, "nextLifeAtUtc") != null ? time : null
            };
        }

        public sealed class ChapterPreview
        {
            public int ScoreTarget, Cells, Green, Moves;
            public bool Resume, Rescue;
        }

        public ChapterPreview GetChapterPreview(int index)
        {
            if (!CanOpenStage(index)) return null;
            var preview = controller.Preview(index);
            var checkpoint = W.Get(preview, "snapshot");
            var level = data.Levels[index];
            bool resume = W.Equal(preview["resume"], true);
            bool rescue = index == ActiveStage && Status == "lost" && W.Equal(W.Get(controller.RescueOffer(), "eligible"), true);
            if (checkpoint != null && index >= TutorialCount && (resume || rescue || W.Int32(W.Required(checkpoint,"turn")) == 0))
            {
                var metadata = W.Required(preview,"metadata");
                level = data.Catalog.ResolveLevelWire(W.Required(metadata,"levelId"), (string)W.Required(metadata,"variantId"), (string)W.Required(metadata,"levelDataVersion"));
            }
            var board = resume ? ReadBoardForDisplay(checkpoint) : null;
            return new ChapterPreview {
                ScoreTarget = W.Int32(level["target"]), Cells = W.List(level["cells"]).Count,
                Moves = resume ? board.movesLeft : W.Int32(level["moves"]), Green = resume ? board.layers.Count(layer => layer == 0) : 0,
                Resume = resume, Rescue = rescue
            };
        }

        public bool StartChapterFresh(int index)
        {
            if (!CanOpenStage(index)) return false;
            CancelPresentation();
            inGame = Apply(() => controller.Enter(index, fresh:true, confirmed:true), index);
            return inGame;
        }
    }
}
