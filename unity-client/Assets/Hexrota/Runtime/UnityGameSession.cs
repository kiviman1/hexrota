using System;
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
    public sealed class UnityGameSession
    {
        private readonly ClientGameData data;
        private readonly GameSessionController controller;
        private bool inGame;
        public bool IsPresenting { get; private set; }
        public string LastError { get; private set; }
        public bool HasAttempt { get { return inGame && W.Get(controller.View(), "snapshot") != null; } }
        public string Status { get { return W.Get(controller.View(), "status") as string; } }
        public long Revision { get { return controller.Revision; } }
        public GameSnapshot Snapshot { get { var value = W.Get(controller.View(), "snapshot"); return value == null ? null : LevelCatalog.ReadSnapshot(value); } }
        public LevelConfig Level
        {
            get {
                var metadata = W.Get(controller.View(), "metadata");
                if (metadata == null) return null;
                return LevelCatalog.GameplayConfig(data.Catalog.ResolveLevelWire(W.Required(metadata, "levelId"), (string)W.Required(metadata, "variantId"), (string)W.Required(metadata, "levelDataVersion")));
            }
        }
        public UnityGameSession(ClientGameData data, IProfileStorage storage, IUtcClock clock, uint selectionSeed = 4303818)
        {
            if (data == null) throw new ArgumentNullException("data");
            this.data = data;
            controller = new GameSessionController(data.Catalog, data.Levels, data.TutorialCount,
                new ProfileRepository(storage), data.LifeConfig, clock, selectionSeed,
                "hexrota-unity-test", data.RewardRules, economyConfig: data.EconomyConfig);
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
        private bool Apply(Func<System.Collections.Generic.Dictionary<string, object>> action)
        {
            try {
                var result = action(); bool ok = W.Equal(W.Get(result, "ok"), true);
                LastError = ok ? null : W.Get(result, "reason") as string;
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
            CancelPresentation();
            bool ok = Apply(() => controller.Enter(data.TutorialCount));
            inGame = ok;
            return ok;
        }
        public MovePresentation TrySwap(int a, int b)
        {
            var receipt = new MovePresentation { Ok = false, A = a, B = b, Before = Snapshot, After = Snapshot };
            if (!HasAttempt || IsPresenting) { receipt.Reason = IsPresenting ? "presentation_busy" : "no_attempt"; return receipt; }
            // Frames are a projection obtained by running the SAME core on a clone.
            // The controller still independently validates, commits, settles and saves.
            var projection = new HexMatch(Level, receipt.Before);
            receipt.Swap = projection.Swap(a, b);
            if (!receipt.Swap.ok) { receipt.Reason = receipt.Swap.reason; LastError = receipt.Reason; return receipt; }
            var envelope = Command();
            receipt.Ok = Apply(() => controller.Swap(a, b, envelope));
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
            return receipt;
        }
        public void CompletePresentation() { IsPresenting = false; }
        public void CancelPresentation() { IsPresenting = false; }
        public bool Restart()
        {
            CancelPresentation();
            bool ok = Apply(() => controller.Restart(true, command: Command()));
            if (ok) inGame = true;
            return ok;
        }
        public bool Retry()
        {
            CancelPresentation();
            bool ok = Apply(() => controller.Retry(command: Command()));
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
