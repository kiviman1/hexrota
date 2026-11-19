using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using NUnit.Framework;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    public sealed class GoldenEggTests
    {
        // Wins the first chapter through the real session so the economy ledger stays valid.
        internal static UnityGameSession WinFirstChapter(ClientGameData data, MemoryProfileStorage store)
        {
            var session = new UnityGameSession(data, store, new SystemUtcClock());
            Assert.That(session.EnterLevelOne(), Is.True, session.LastError);
            var attempts = W.Required(W.Required(store.Read(ProfileRepository.ProfileKey), "game"), "attempts");
            var identity = W.Required(attempts, session.ActiveStage.ToString());
            var level = data.Catalog.ResolveLevelWire(W.Required(identity, "levelId"),
                (string)W.Required(identity, "variantId"), (string)W.Required(identity, "levelDataVersion"));
            var route = W.List(level["solution"]).Select(pair => W.List(pair).Select(W.Int32).ToArray()).ToArray();
            foreach (var step in route)
            {
                Assert.That(session.TrySwap(step[0], step[1]).Ok, Is.True, session.LastError);
                session.CompletePresentation();
            }
            Assert.That(session.Status, Is.EqualTo("won"));
            session.ReturnToMenu();
            return session;
        }

        [Test]
        public void ASaveWithTheLegacyStarsFieldLoadsAsGoldenEggs()
        {
            var data = ClientGameData.FromResources();
            var store = new MemoryProfileStorage();
            int before = new UnityGameSession(data, store, new SystemUtcClock()).ReadPhoneWallet().EarnedEggs;
            WinFirstChapter(data, store);

            // The durable profile keeps the ledger's original "stars" field; nothing is rewritten.
            var economy = W.Required(W.Required(store.Read(ProfileRepository.ProfileKey), "game"), "economy");
            Assert.That(W.Int32(W.Required(economy, "stars")), Is.EqualTo(before + 1));
            Assert.That(W.Has(economy, "goldenEggs"), Is.False);

            var restored = new UnityGameSession(data, store, new SystemUtcClock()).ReadPhoneWallet();
            Assert.That(restored.EarnedEggs, Is.EqualTo(before + 1));
            Assert.That(restored.GoldenEggs, Is.EqualTo(before + 1));
        }

        [Test]
        public void WalletShowsEarnedMinusCoopSpendingAndRejectsAnUnaffordableUpgrade()
        {
            var data = ClientGameData.FromResources();
            var store = new MemoryProfileStorage();
            var session = WinFirstChapter(data, store);
            int earned = session.ReadPhoneWallet().EarnedEggs;
            Assert.That(earned, Is.Positive);

            var coop = session.ReadCoop();
            Assert.That(coop.Usable, Is.True, session.CoopError);
            Assert.That(coop.Level, Is.Zero);
            Assert.That(coop.TargetLevel, Is.EqualTo(1));
            Assert.That(coop.Eggs, Is.EqualTo(earned));
            Assert.That(coop.Ready, Is.EqualTo(earned >= coop.NextCost));
            Assert.That(coop.NextCost, Is.GreaterThan(earned), "One chapter must not pay for the first upgrade.");
            Assert.That(session.TryUpgradeCoop(), Is.False);
            Assert.That(session.LastError, Is.EqualTo("insufficient_eggs"));
            Assert.That(store.Contains(CoopLedger.StorageKey), Is.False);

            // A coop that already spent eggs lowers the spendable balance but never the earned count.
            store.Seed(CoopLedger.StorageKey, W.Obj("schemaVersion", 1L, "areaId", coop.AreaId, "level", 0L, "spentEggs", (long)earned));
            var reloaded = new UnityGameSession(data, store, new SystemUtcClock());
            Assert.That(reloaded.ReadPhoneWallet().GoldenEggs, Is.Zero);
            Assert.That(reloaded.ReadPhoneWallet().EarnedEggs, Is.EqualTo(earned));
        }

        [Test]
        public void DevelopmentResetAlsoEmptiesTheCoop()
        {
            var data = ClientGameData.FromResources();
            var store = new MemoryProfileStorage();
            var session = WinFirstChapter(data, store);
            store.Seed(CoopLedger.StorageKey, W.Obj("schemaVersion", 1L, "areaId", session.ReadCoop().AreaId, "level", 1L, "spentEggs", 1L));
            session = new UnityGameSession(data, store, new SystemUtcClock());
            Assert.That(session.ReadCoop().Level, Is.EqualTo(1));

            Assert.That(session.ResetForDevelopmentTest(), Is.True, session.LastError);
            Assert.That(session.ReadCoop().Level, Is.Zero);
            Assert.That(new UnityGameSession(data, store, new SystemUtcClock()).ReadCoop().Level, Is.Zero);
        }

        [Test]
        public void DamagedCoopRecordDisablesUpgradesWithoutTouchingTheWallet()
        {
            var data = ClientGameData.FromResources();
            var store = new MemoryProfileStorage();
            WinFirstChapter(data, store);
            store.Seed(CoopLedger.StorageKey, W.Obj("schemaVersion", 99L));
            var session = new UnityGameSession(data, store, new SystemUtcClock());
            Assert.That(session.ReadCoop().Usable, Is.False);
            Assert.That(session.CoopError, Is.EqualTo("invalid_coop"));
            Assert.That(session.TryUpgradeCoop(), Is.False);
            Assert.That(session.ReadPhoneWallet().EarnedEggs, Is.Positive);
        }
    }
}
