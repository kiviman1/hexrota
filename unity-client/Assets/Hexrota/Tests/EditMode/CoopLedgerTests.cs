using System.Collections.Generic;
using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using NUnit.Framework;
using UnityEngine;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    public sealed class CoopLedgerTests
    {
        private CoopConfig config;
        private int[] costs;

        [SetUp]
        public void LoadShippedConfig()
        {
            config = CoopConfig.Load();
            Assert.That(config, Is.Not.Null, "Resources/" + CoopConfig.ResourcePath + " must exist.");
            costs = config.First.upgrades.Select(u => u.cost).ToArray();
        }

        [Test]
        public void FirstAreaHasFiveUpgradesWithTheAgreedCostsAndArrivals()
        {
            Assert.That(config.areas, Has.Length.EqualTo(1));
            Assert.That(costs, Is.EqualTo(new[] { 6, 8, 10, 12, 14 }));
            Assert.That(config.First.upgrades.Select(u => u.chickens), Is.EqualTo(new[] { 1, 1, 1, 1, 2 }));
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
            Assert.That(ledger.Chickens, Is.EqualTo(config.First.upgrades[0].chickens));

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
            Assert.That(restored.AreaId, Is.EqualTo(config.First.id));
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
            Assert.That(ledger.Chickens, Is.EqualTo(config.First.upgrades.Sum(u => u.chickens)));

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
            store.Seed(CoopLedger.StorageKey, W.Obj("schemaVersion", 1L, "areaId", config.First.id, "level", 99L, "spentEggs", 6L));
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
