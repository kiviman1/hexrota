using System.Collections.Generic;
using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using NUnit.Framework;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    public sealed class CoopLedgerTests
    {
        // Plain C# rules: the ledger is tested without UnityEngine, exactly as the .NET host compiles it.
        private static readonly int[] Costs = { 1, 2, 3, 4 };
        private static readonly int[] Arrivals = { 1, 1, 2, 2 };
        private CoopRules config;
        private int[] costs;

        internal static CoopRules Rules(string id, int[] costs, int[] arrivals) =>
            new CoopRules(new[] { new CoopRules.Area(id, costs.Select((cost, i) => new CoopRules.Upgrade(cost, arrivals[i]))) });

        [SetUp]
        public void BuildRules()
        {
            config = Rules("farm-1", Costs, Arrivals);
            costs = config.First.Upgrades.Select(u => u.Cost).ToArray();
        }

        [Test]
        public void ShippedAssetGivesTheFirstAreaItsCurrentCostsAndArrivals()
        {
            var asset = CoopConfig.Load();
            Assert.That(asset, Is.Not.Null, "Resources/" + CoopConfig.ResourcePath + " must exist.");
            var shipped = asset.ToRules();
            Assert.That(shipped.Areas, Has.Count.EqualTo(1));
            Assert.That(shipped.First.Id, Is.EqualTo("farm-1"));
            // Four upgrades, one per coop sprite level (Coop_L1..Coop_L4), sized for the current
            // 10-chapter campaign (10 eggs, 6 chickens); see docs/design/HANDOFF.md.
            Assert.That(shipped.First.Upgrades.Select(u => u.Cost), Is.EqualTo(new[] { 1, 2, 3, 4 }));
            Assert.That(shipped.First.Upgrades.Select(u => u.Cost).Sum(), Is.EqualTo(10));
            Assert.That(shipped.First.Upgrades.Select(u => u.Chickens), Is.EqualTo(new[] { 1, 1, 2, 2 }));
            Assert.That(shipped.First.Upgrades.Select(u => u.Chickens).Sum(), Is.EqualTo(6));
        }

        [Test]
        public void RulesRejectFreeUpgradesEmptyAreasAndDuplicateIds()
        {
            Assert.That(() => new CoopRules.Upgrade(0, 1), Throws.InstanceOf<System.ArgumentOutOfRangeException>());
            Assert.That(() => new CoopRules.Area("a", new CoopRules.Upgrade[0]), Throws.ArgumentException);
            var area = new CoopRules.Area("a", new[] { new CoopRules.Upgrade(1, 1) });
            Assert.That(() => new CoopRules(new[] { area, area }), Throws.ArgumentException);
            Assert.That(() => new CoopRules(new CoopRules.Area[0]), Throws.ArgumentException);
        }

        [Test]
        public void UpgradeSpendsItsCostRaisesTheLevelAndPersistsBothTogether()
        {
            var store = new MemoryProfileStorage();
            var ledger = new CoopLedger(config, store);
            int earned = costs[0] + 1;
            Assert.That(ledger.Available(earned), Is.EqualTo(earned));

            Assert.That(ledger.TryUpgrade(earned, out string error), Is.True, error);
            Assert.That(ledger.Level, Is.EqualTo(1));
            Assert.That(ledger.SpentEggs, Is.EqualTo(costs[0]));
            Assert.That(ledger.Available(earned), Is.EqualTo(1));
            Assert.That(ledger.Chickens, Is.EqualTo(config.First.Upgrades[0].Chickens));

            var record = store.Read(CoopLedger.StorageKey);
            Assert.That(W.Integer(W.Get(record, "level")), Is.EqualTo(1));
            Assert.That(W.Integer(W.Get(record, "spentEggs")), Is.EqualTo(costs[0]));
        }

        [Test]
        public void InsufficientEggsAreRejectedAndNothingChanges()
        {
            var store = new MemoryProfileStorage();
            var ledger = new CoopLedger(config, store);
            Assert.That(ledger.TryUpgrade(costs[0] - 1, out string error), Is.False);
            Assert.That(error, Is.EqualTo("insufficient_eggs"));
            Assert.That(ledger.Level, Is.Zero);
            Assert.That(ledger.SpentEggs, Is.Zero);
            Assert.That(store.Contains(CoopLedger.StorageKey), Is.False);
        }

        [Test]
        public void SavedCoopLoadsBackWithTheSameLevelAndSpending()
        {
            var store = new MemoryProfileStorage();
            int earned = costs[0] + costs[1];
            var ledger = new CoopLedger(config, store);
            Assert.That(ledger.TryUpgrade(earned, out _), Is.True);
            Assert.That(ledger.TryUpgrade(earned, out _), Is.True);

            var restored = new CoopLedger(config, store);
            Assert.That(restored.AreaId, Is.EqualTo(config.First.Id));
            Assert.That(restored.Level, Is.EqualTo(2));
            Assert.That(restored.SpentEggs, Is.EqualTo(earned));
            Assert.That(restored.Available(earned), Is.Zero);
        }

        [Test]
        public void LastUpgradeCompletesTheAreaAndNoFurtherUpgradeExists()
        {
            var store = new MemoryProfileStorage();
            var ledger = new CoopLedger(config, store);
            int earned = costs.Sum() + 100;
            for (int i = 0; i < costs.Length; i++)
            {
                Assert.That(ledger.IsAreaComplete, Is.False);
                Assert.That(ledger.TryUpgrade(earned, out string error), Is.True, error);
            }
            Assert.That(ledger.IsAreaComplete, Is.True);
            Assert.That(ledger.NextUpgrade, Is.Null);
            Assert.That(ledger.Chickens, Is.EqualTo(Arrivals.Sum()));

            Assert.That(ledger.TryUpgrade(earned, out string last), Is.False);
            Assert.That(last, Is.EqualTo("area_complete"));
            Assert.That(ledger.SpentEggs, Is.EqualTo(costs.Sum()));
            Assert.That(new CoopLedger(config, store).IsAreaComplete, Is.True);
        }

        [Test]
        public void FailedWriteLeavesBothLevelAndBalanceUntouched()
        {
            var store = new FailingStorage();
            var ledger = new CoopLedger(config, store);
            store.Fail = true;
            Assert.That(ledger.TryUpgrade(costs[0], out string error), Is.False);
            Assert.That(error, Is.EqualTo("storage"));
            Assert.That(ledger.Level, Is.Zero);
            Assert.That(ledger.Available(costs[0]), Is.EqualTo(costs[0]));
            store.Fail = false;
            Assert.That(new CoopLedger(config, store).Level, Is.Zero);
        }

        [Test]
        public void DamagedRecordFailsClosedInsteadOfRefunding()
        {
            var store = new MemoryProfileStorage();
            store.Seed(CoopLedger.StorageKey, W.Obj("schemaVersion", 1L, "areaId", "missing", "level", 1L, "spentEggs", 6L));
            Assert.That(() => new CoopLedger(config, store), Throws.InstanceOf<ProfileStorageException>());
            store.Seed(CoopLedger.StorageKey, W.Obj("schemaVersion", 1L, "areaId", config.First.Id, "level", 99L, "spentEggs", 6L));
            Assert.That(() => new CoopLedger(config, store), Throws.InstanceOf<ProfileStorageException>());
        }

        [Test]
        public void ResetReturnsToAnEmptyPlot()
        {
            var store = new MemoryProfileStorage();
            var ledger = new CoopLedger(config, store);
            Assert.That(ledger.TryUpgrade(costs[0], out _), Is.True);
            ledger.Reset();
            Assert.That(ledger.Level, Is.Zero);
            Assert.That(ledger.SpentEggs, Is.Zero);
            Assert.That(new CoopLedger(config, store).Level, Is.Zero);
        }

        private sealed class FailingStorage : IProfileStorage
        {
            private readonly MemoryProfileStorage inner = new MemoryProfileStorage();
            public bool Fail;
            public bool Contains(string key) => inner.Contains(key);
            public object Read(string key) => inner.Read(key);
            public bool CompareExchange(string key, long expectedRevision, Dictionary<string, object> next) =>
                inner.CompareExchange(key, expectedRevision, next);
            public void Write(string key, object value)
            {
                if (Fail) throw new ProfileStorageException("storage");
                inner.Write(key, value);
            }
        }
    }
}
