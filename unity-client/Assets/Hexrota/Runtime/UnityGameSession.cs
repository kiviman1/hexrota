using System;
using System.Linq;
using Hexrota.Application;
using Hexrota.Catalog;
using Hexrota.Gameplay;
using Hexrota.Lives;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    public sealed class SystemUtcClock : IUtcClock
    {
        public long NowUtcMilliseconds() { return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(); }
    }
    public sealed class MovePresentation
    {
        public bool Ok;
        public int A, B;
        public string Reason;
        public GameSnapshot Before, After;
        public SwapResult Swap;
    }
    // Unity owns disposable presentation state; GameSessionController owns every transaction.
    public sealed partial class UnityGameSession
    {
        private readonly ClientGameData data;
        private readonly GameSessionController controller;
        private bool inGame;
        public bool IsPresenting { get; private set; }
        public string LastError { get; private set; }
        public bool HasAttempt { get { return inGame && W.Get(controller.View(), "snapshot") != null; } }
        public string AttemptId { get { return (string)W.Get(W.Get(controller.View(),"metadata"),"attemptId"); } }
        public VisibleIdleHint ChooseIdleHint(int[] previous)
        {
            return HasAttempt && !IsTutorial && !IsPresenting && Status == "playing" ? VisibleIdleHint.Choose(ProjectBoard(),previous) : null;
        }
        public string Status { get { return W.Get(controller.View(), "status") as string; } }
        public long Revision { get { return controller.Revision; } }
        public GameSnapshot Snapshot { get { var value = W.Get(controller.View(), "snapshot"); return value == null ? null : ReadBoardForDisplay(value); } }
        public int StageCount { get { return data.Levels.Count; } }
        public int TutorialCount { get { return data.TutorialCount; } }
        public int ActiveStage { get { return W.Int32(controller.View()["stage"]); } }
        public bool IsTutorial { get { return ActiveStage < TutorialCount; } }
        public string StageName(int index) { return (string)data.Levels[index]["name"]; }
        public bool CanOpenStage(int index) { return controller.CanOpen(index); }
        public bool HasCheckpoint(int index)
        {
            return CanOpenStage(index) && W.Equal(controller.Preview(index)["resume"], true);
        }
        public bool IsStageComplete(int index) { return W.List(controller.GameSave["done"]).Contains((long)index); }
        public string StageLabel(int index)
        {
            return index < TutorialCount ? "ÖĞREN " + (index + 1).ToString("00") :
                "BÖLÜM " + (index - TutorialCount + 1).ToString("00");
        }
        public int NextCampaignStage
        {
            get
            {
                var id = controller.EconomyView["nextLevelId"];
                for (int i = TutorialCount; i < StageCount; i++)
                    if (W.Equal(id, data.Levels[i]["id"])) return i;
                return -1;
            }
        }
        public bool FirstOpening
        {
            get
            {
                var game = controller.GameSave;
                return W.List(game["done"]).Count == 0 && W.Map(game["boards"]).Count == 0 &&
                    W.Map(game["attempts"]).Count == 0 && W.Integer(W.Get(game["variantSelection"], "serial")) == 0;
            }
        }
        public int NextStage
        {
            get
            {
                int next = NextCampaignStage;
                if (next < 0) return -1;
                int current = ActiveStage;
                if (CanOpenStage(current) && (W.Equal(controller.Preview(current)["resume"], true) ||
                    (Status == "lost" && W.Equal(W.Get(controller.RescueOffer(), "eligible"), true)))) return current;
                var done = W.List(controller.GameSave["done"]);
                for (int i = 0; i < TutorialCount; i++) if (!done.Contains((long)i)) return i;
                return next;
            }
        }

        private object TutorialStep(int turn)
        {
            return IsTutorial && turn >= 0 ? W.List(data.Levels[ActiveStage]["steps"]).ElementAtOrDefault(turn) : null;
        }
        public int[] TutorialMatchIndices
        {
            get
            {
                if (!HasAttempt || !IsTutorial || IsPresenting || Status != "playing" || NeedsTutorialAcknowledgement) return null;
                var indices = W.Get(TutorialStep(Snapshot.turn),"matchIndices");
                return indices == null ? null : W.List(indices).Select(W.Int32).ToArray();
            }
        }
        public int[] TutorialPair
        {
            get
            {
                if (!HasAttempt || !IsTutorial || Status != "playing" || NeedsTutorialAcknowledgement) return null;
                var pair = W.Get(TutorialStep(Snapshot.turn), "pair");
                return pair == null ? null : W.List(pair).Select(W.Int32).ToArray();
            }
        }
        public bool NeedsTutorialAcknowledgement
        {
            get
            {
                if (!HasAttempt || !IsTutorial || Status != "playing") return false;
                int turn = Snapshot.turn;
                return W.Equal(W.Get(TutorialStep(turn - 1), "acknowledge"), true) &&
                    !W.List(controller.GameSave["guideAcks"]).Contains(ActiveStage + ":" + turn);
            }
        }
        public sealed class LessonCard
        {
            public string Heading, Title, Text, Counter;
        }
        public LessonCard CurrentLessonCard()
        {
            if (!HasAttempt || !IsTutorial) return null;
            string levelId = (string)data.Levels[ActiveStage]["id"];
            int turn = Snapshot.turn;
            var steps = W.List(data.TutorialCopy[levelId]);
            bool feedback = NeedsTutorialAcknowledgement;
            bool after = feedback || IsPresenting;
            int index = Math.Max(0,Math.Min(steps.Count - 1, turn - (after ? 1 : 0)));
            object copy = W.Required(steps[index],after ? "feedback" : "guide");
            object counter = data.CoopCounters[levelId];
            int target = W.Int32(W.Required(counter,"target"));
            return new LessonCard {
                Heading = feedback && !IsPresenting ? "BU HAMLEDE" :
                    (IsPresenting ? "İZLE · " : "") + "ADIM " + (index + 1) + " / " + steps.Count,
                Title = (string)W.Required(copy,"title"), Text = (string)W.Required(copy,"text"),
                Counter = W.Required(counter,"label") + " " + Math.Min(turn,target) + "/" + target
            };
        }
        public bool AcknowledgeTutorial()
        {
            return NeedsTutorialAcknowledgement && Apply(() => controller.AcknowledgeTutorial(Command()));
        }
        public string WalletSummary
        {
            get
            {
                var economy = controller.EconomyView;
                var life = W.Map(controller.View()["life"]);
                return "Can " + life["lives"] + "/" + life["maxLives"] + "     Altın " + economy["gold"] + "     Yıldız " + economy["stars"];
            }
        }
        public int ClearedCount { get { return W.List(controller.EconomyView["cleared"]).Count; } }
        public string RecordSummary(int first, int count)
        {
            var records = controller.GameSave["records"];
            return string.Join("\n", Enumerable.Range(first,Math.Min(count,StageCount - first)).Select(index => {
                object row = W.Get(records,index.ToString());
                return StageLabel(index) + "  ·  " + StageName(index) + "\n" +
                    (row == null ? "Henüz kayıt yok" : W.Get(row,"score") + " puan  ·  " + W.Get(row,"movesLeft") + " kalan hamle");
            }).ToArray());
        }

        public sealed class GoldRescueOffer
        {
            internal long Revision;
            internal string AttemptId;
            public int Cost { get; internal set; }
            public int Moves { get; internal set; }
            public bool Affordable { get; internal set; }
        }
        public GoldRescueOffer GetGoldRescueOffer()
        {
            if (!HasAttempt || IsTutorial || Status != "lost") return null;
            var offer = controller.RescueOffer();
            if (!W.Equal(W.Get(offer,"eligible"),true)) return null;
            return new GoldRescueOffer {
                Revision = Revision, AttemptId = Command().attemptId,
                Cost = W.Int32(offer["costGold"]), Moves = W.Int32(offer["moves"]),
                Affordable = W.Equal(W.Get(offer["gold"],"allowed"),true)
            };
        }
        public bool AcceptGoldRescue(GoldRescueOffer offer)
        {
            var command = Command();
            if (!HasAttempt || offer == null || offer.Revision != Revision ||
                offer.AttemptId != command.attemptId || !offer.Affordable)
            {
                LastError = "rescue_unavailable"; return false;
            }
            return Apply(() => controller.RescueWithGold("rescue:" + offer.AttemptId, command));
        }
        public string GardenTier
        {
            get
            {
                var unlocked = W.List(controller.EconomyView["botanical"]).LastOrDefault(tier => W.Equal(W.Get(tier,"unlocked"),true));
                return (string)W.Get(unlocked,"id","soil");
            }
        }
        public string GardenSummary
        {
            get
            {
                var names = new[] { "Çiçekler", "Bitkiler", "Ağaçlar", "Tam bahçe" };
                return string.Join("\n", W.List(controller.EconomyView["botanical"]).Select((entry, i) =>
                    names[i] + "   " + W.Get(entry, "stars") + " yıldız   " +
                    (W.Equal(W.Get(entry, "unlocked"), true) ? "Açık" : "Kilitli")).ToArray());
            }
        }
        public int[] RequestHint()
        {
            if (!HasAttempt || IsPresenting || Status != "playing" || NeedsTutorialAcknowledgement) return null;
            int[] pair = null;
            Apply(() => {
                var result = controller.Hint(command: Command());
                if (W.Equal(result["ok"], true)) pair = W.List(result["pair"]).Select(W.Int32).ToArray();
                return result;
            });
            return pair;
        }

        public LevelConfig Level
        {
            get {
                var metadata = W.Get(controller.View(), "metadata");
                if (metadata == null) return null;
                if (IsTutorial) return LevelCatalog.GameplayConfig(data.Catalog.ResolveTutorial((string)W.Required(metadata,"levelId")));
                return LevelCatalog.GameplayConfig(data.Catalog.ResolveLevelWire(W.Required(metadata, "levelId"), (string)W.Required(metadata, "variantId"), (string)W.Required(metadata, "levelDataVersion")));
            }
        }
        public UnityGameSession(ClientGameData data, IProfileStorage storage, IUtcClock clock, uint selectionSeed = 4303818,
            Func<long> playtestMilliseconds = null)
        {
            if (data == null) throw new ArgumentNullException("data");
            this.data = data;
            controller = new GameSessionController(data.Catalog, data.Levels, data.TutorialCount,
                new ProfileRepository(storage), data.LifeConfig, clock, selectionSeed,
                "hexrota-unity-test", data.RewardRules, economyConfig: data.EconomyConfig,
                rescueReceiptVerifier: new Hexrota.Rescue.DevelopmentRescueReceiptVerifier());
            StartPlaytestObservation(storage, clock, playtestMilliseconds);
        }
        public static UnityGameSession CreateDefault()
        {
            return new UnityGameSession(ClientGameData.FromResources(), PlatformProfileStorage.Create(), new SystemUtcClock());
        }
        private SessionCommand Command()
        {
            var view = controller.View();
            return new SessionCommand { expectedRevision = controller.Revision,
                attemptId = W.Get(W.Get(view, "metadata"), "attemptId") as string,
                turn = Snapshot == null ? (int?)null : Snapshot.turn };
        }
        private bool Apply(Func<System.Collections.Generic.Dictionary<string, object>> action,int? requestedStage=null,bool observe=true)
        {
            try {
                var result = action(); bool ok = W.Equal(W.Get(result, "ok"), true);
                LastError = ok ? null : W.Get(result, "reason") as string;
                if(observe) ObserveCommit(result,requestedStage);
                return ok;
            }
            catch (Exception error) {
                var storage = error as ProfileStorageException;
                LastError = storage == null ? error.Message : storage.Code;
                return false;
            }
        }
        public bool EnterLevelOne()
        {
            return EnterStage(TutorialCount);
        }
        public bool EnterStage(int index)
        {
            if (index < 0 || index >= StageCount) { LastError = "invalid_stage"; return false; }
            CancelPresentation();
            bool ok = Apply(() => {
                bool replayLesson = false;
                if (index < TutorialCount && IsStageComplete(index))
                {
                    var previous = W.Get(controller.Preview(index), "snapshot");
                    var level = LevelCatalog.GameplayConfig(data.Levels[index]);
                    replayLesson = previous != null && new HexMatch(level, LevelCatalog.ReadSnapshot(previous)).Status != "playing";
                }
                return controller.Enter(index, fresh: replayLesson);
            },index);
            inGame = ok;
            return ok;
        }
        public bool SkipTutorials()
        {
            if (!HasAttempt || !IsTutorial || IsPresenting) return false;
            return Apply(() => controller.SkipTutorials(Command()), TutorialCount);
        }
        public MovePresentation TrySwap(int a, int b)
        {
            var receipt = new MovePresentation { Ok = false, A = a, B = b, Before = Snapshot, After = Snapshot };
            if (!HasAttempt || IsPresenting) { receipt.Reason = IsPresenting ? "presentation_busy" : "no_attempt"; return receipt; }
            if (NeedsTutorialAcknowledgement) { receipt.Reason = "tutorial_acknowledgement_required"; return receipt; }
            // Frames are a projection obtained by running the SAME core on a clone.
            // The controller still independently validates, commits, settles and saves.
            var projection = ProjectBoard();
            receipt.Swap = projection.Swap(a, b);
            if (!receipt.Swap.ok) { receipt.Reason = receipt.Swap.reason; LastError = receipt.Reason; return receipt; }
            var envelope = Command();
            receipt.Ok = Apply(() => controller.Swap(a, b, envelope),observe:false);
            receipt.Reason = LastError;
            receipt.After = Snapshot;
            if (receipt.Ok)
            {
                IsPresenting = true;
                // Fail closed on adapter drift. Never animate a speculative or uncommitted board.
                if (!W.Equal(LevelCatalog.SnapshotWire(projection.Snapshot()), LevelCatalog.SnapshotWire(receipt.After)))
                {
                    receipt.Ok = false; receipt.Reason = LastError = "presentation_snapshot_mismatch";
                    IsPresenting = false; receipt.Swap = null;
                }
            }
            if(receipt.Ok) ObserveCommit(null,move:receipt);
            return receipt;
        }
        public void CompletePresentation() { IsPresenting = false; }
        public void CancelPresentation() { IsPresenting = false; }
        public bool Restart(int? maximumCharge = null)
        {
            CancelPresentation();
            bool ok = Apply(() => controller.Restart(true, maximumCharge, Command()), ActiveStage);
            if (ok) inGame = true;
            return ok;
        }
        public bool Retry()
        {
            CancelPresentation();
            bool ok = Apply(() => controller.Retry(command: Command()), ActiveStage);
            if (ok) inGame = true;
            return ok;
        }
        public void ReturnToMenu()
        {
            CancelPresentation(); Apply(() => controller.ReturnToMenu(Command())); inGame = false;
        }
        public void Suspend()
        {
            CancelPresentation(); Apply(() => controller.Close(Command()));
        }
    }
}
