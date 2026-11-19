using System;
using System.Collections.Generic;
using Hexrota.Application;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    // The coop record lives beside the canonical profile, outside Core. The economy ledger keeps
    // counting every Golden Egg ever earned (its "stars" field); this record remembers what the
    // coop has consumed. One record holds both the level and the eggs spent, so a single atomic
    // write either applies an upgrade completely or not at all.
    public sealed class CoopLedger
    {
        public const string StorageKey = "hexrota-coop-v1";
        private const long SchemaVersion = 1;

        private readonly CoopRules rules;
        private readonly IProfileStorage storage;
        private CoopRules.Area area;

        public CoopLedger(CoopRules rules, IProfileStorage storage)
        {
            if (rules == null) throw new ArgumentNullException("rules");
            this.rules = rules;
            this.storage = storage ?? throw new ArgumentNullException("storage");
            Load(storage.Read(StorageKey));
        }

        public string AreaId => area.Id;
        public int Level { get; private set; }
        public int SpentEggs { get; private set; }
        public int UpgradeCount => area.Upgrades.Count;
        public bool IsAreaComplete => Level >= area.Upgrades.Count;

        /// <summary>The upgrade that would build level <see cref="Level"/> + 1, or null when the area is complete.</summary>
        public CoopRules.Upgrade NextUpgrade => IsAreaComplete ? null : area.Upgrades[Level];

        public int Chickens
        {
            get
            {
                int total = 0;
                for (int i = 0; i < Level; i++) total += area.Upgrades[i].Chickens;
                return total;
            }
        }

        public int Available(int earnedEggs) => Math.Max(0, earnedEggs - SpentEggs);

        public bool TryUpgrade(int earnedEggs, out string error)
        {
            var next = NextUpgrade;
            if (next == null) { error = "area_complete"; return false; }
            int cost = next.Cost;
            if (Available(earnedEggs) < cost) { error = "insufficient_eggs"; return false; }
            try
            {
                storage.Write(StorageKey, Record(area.Id, Level + 1, SpentEggs + cost));
            }
            catch (ProfileStorageException storageError)
            {
                error = storageError.Code;
                return false;
            }
            Level++;
            SpentEggs += cost;
            error = null;
            return true;
        }

        /// <summary>Development reset: the coop goes back to an empty plot together with the economy.</summary>
        public void Reset()
        {
            storage.Write(StorageKey, null);
            Load(null);
        }

        private void Load(object raw)
        {
            if (raw == null)
            {
                area = rules.First;
                Level = SpentEggs = 0;
                return;
            }
            // Fail closed like the profile: a damaged record must not silently refund or erase the coop.
            if (!W.IsMap(raw) || !W.Equal(W.Get(raw, "schemaVersion"), SchemaVersion) ||
                !W.IsSafeInteger(W.Get(raw, "level")) || !W.IsSafeInteger(W.Get(raw, "spentEggs")))
                throw new ProfileStorageException("invalid_coop");
            var found = rules.Find(W.Get(raw, "areaId") as string);
            long level = W.Integer(W.Get(raw, "level")), spent = W.Integer(W.Get(raw, "spentEggs"));
            if (found == null || level < 0 || level > found.Upgrades.Count || spent < 0 || spent > int.MaxValue)
                throw new ProfileStorageException("invalid_coop");
            area = found;
            Level = (int)level;
            SpentEggs = (int)spent;
        }

        private static Dictionary<string, object> Record(string areaId, int level, int spent)
        {
            return W.Obj("schemaVersion", SchemaVersion, "areaId", areaId, "level", (long)level, "spentEggs", (long)spent);
        }
    }
}
