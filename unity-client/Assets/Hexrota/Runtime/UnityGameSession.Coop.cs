using Hexrota.Application;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    // Coop progress sits outside Core: Core keeps counting earned Golden Eggs, the coop ledger
    // records what has been spent. The spendable balance is the difference.
    public sealed partial class UnityGameSession
    {
        public sealed class CoopStatus
        {
            public bool Usable, AreaComplete, Ready;
            public string AreaId;
            public int Level, UpgradeCount, Chickens, Eggs, NextCost, NextChickens;
            /// <summary>The level an upgrade would build now (Level + 1), or the last level once complete.</summary>
            public int TargetLevel => AreaComplete ? Level : Level + 1;
        }

        private readonly IProfileStorage profileStorage;
        private readonly CoopConfig coopConfig;
        private CoopLedger coopLedger;
        private bool coopLoaded;

        /// <summary>Set when the coop record cannot be read; upgrades stay disabled instead of guessing.</summary>
        public string CoopError { get; private set; }

        private int EarnedEggs => W.Int32(controller.EconomyView["stars"]);

        private CoopLedger Coop
        {
            get
            {
                if (coopLoaded) return coopLedger;
                coopLoaded = true;
                CoopError = null;
                if (coopConfig == null) { CoopError = "missing_coop_config"; return null; }
                try { coopLedger = new CoopLedger(coopConfig, profileStorage); }
                catch (ProfileStorageException error) { CoopError = error.Code; }
                return coopLedger;
            }
        }

        private int SpendableEggs(int earned) => Coop != null ? Coop.Available(earned) : earned;

        public CoopStatus ReadCoop()
        {
            int earned = EarnedEggs;
            var ledger = Coop;
            if (ledger == null) return new CoopStatus { Eggs = earned };
            var next = ledger.NextUpgrade;
            int eggs = ledger.Available(earned);
            return new CoopStatus {
                Usable = true, AreaId = ledger.AreaId, AreaComplete = ledger.IsAreaComplete,
                Level = ledger.Level, UpgradeCount = ledger.UpgradeCount, Chickens = ledger.Chickens, Eggs = eggs,
                NextCost = next?.cost ?? 0, NextChickens = next?.chickens ?? 0,
                Ready = next != null && eggs >= next.Value.cost
            };
        }

        /// <summary>Spends the next upgrade's cost and raises the level in one durable write.</summary>
        public bool TryUpgradeCoop()
        {
            var ledger = Coop;
            if (ledger == null) { LastError = CoopError; return false; }
            bool ok = ledger.TryUpgrade(EarnedEggs, out string error);
            LastError = error;
            return ok;
        }

        private void ResetCoop()
        {
            try { profileStorage.Write(CoopLedger.StorageKey, null); }
            catch (ProfileStorageException) { }
            coopLoaded = false;
            coopLedger = null;
        }
    }
}
