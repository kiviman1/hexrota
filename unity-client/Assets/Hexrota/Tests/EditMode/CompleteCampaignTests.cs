using System.Linq;
using Hexrota.Application;
using Hexrota.Catalog;
using Hexrota.UnityClient;
using NUnit.Framework;
using UnityEngine;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    internal static class CampaignTestRoute
    {
        internal static int[][] ForActiveAttempt(ClientGameData data, UnityGameSession session, MemoryProfileStorage storage)
        {
            int stage = session.ActiveStage;
            var level = data.Levels[stage];
            if (!session.IsTutorial)
            {
                var game = W.Required(storage.Read(ProfileRepository.ProfileKey), "game");
                var attempt = W.Required(W.Required(game, "attempts"), stage.ToString());
                level = data.Catalog.ResolveLevelWire(W.Required(attempt, "levelId"),
                    (string)W.Required(attempt, "variantId"), (string)W.Required(attempt, "levelDataVersion"));
            }
            return W.List(level["solution"]).Select(pair => W.List(pair).Select(W.Int32).ToArray()).ToArray();
        }
    }

    public sealed class CompleteCampaignTests
    {
        [Test]
        public void SameProfileCompletesAllTenChaptersAcrossReloadsWithoutSeparateLessons()
        {
            var data = ClientGameData.FromResources();
            var storage = new MemoryProfileStorage();
            var clock = new SystemUtcClock();
            var session = new UnityGameSession(data, storage, clock);
            Assert.That(session.StageCount, Is.EqualTo(12));
            for (int stage = session.TutorialCount; stage < session.StageCount; stage++)
            {
                Assert.That(session.NextStage, Is.EqualTo(stage), "Recommended stage after reload");
                Assert.That(session.EnterStage(stage), Is.True, session.LastError);
                int[][] route = CampaignTestRoute.ForActiveAttempt(data, session, storage);
                foreach (int[] pair in route)
                {
                    var receipt = session.TrySwap(pair[0], pair[1]);
                    Assert.That(receipt.Ok, Is.True, "Stage " + stage + ": " + receipt.Reason);
                    session.CompletePresentation();
                }
                Assert.That(session.Status, Is.EqualTo("won"));
                Assert.That(session.IsStageComplete(stage), Is.True);
                session.ReturnToMenu();
                session = new UnityGameSession(data, storage, clock);
                Assert.That(session.IsStageComplete(stage), Is.True);
                Assert.That(session.CanOpenStage(stage), Is.False);
                var milestones = W.List(data.EconomyConfig["botanical"]);
                var unlocked = milestones.LastOrDefault(m => W.Int32(W.Required(m, "stars")) <= session.ClearedCount);
                Assert.That(session.GardenTier, Is.EqualTo(W.Get(unlocked, "id", "soil")));
                Assert.That(Resources.Load<Texture2D>("GardenArt/" + session.GardenTier), Is.Not.Null);
            }
            Assert.That(session.ClearedCount, Is.EqualTo(10));
            Assert.That(session.IsStageComplete(0) || session.IsStageComplete(1), Is.False);
            Assert.That(session.NextStage, Is.EqualTo(-1));
        }
    }
}
