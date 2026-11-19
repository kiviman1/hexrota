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
    }
}
