using System.Linq;
using Hexrota.Application;
using Hexrota.Catalog;
using Hexrota.UnityClient;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEngine;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    public sealed class CompleteCampaignTests
    {
        [Test]
        public void SameProfileCompletesBothLessonsAndAllTenCampaignStagesAcrossReloads()
        {
            var data = ClientGameData.FromResources();
            var storage = new MemoryProfileStorage();
            var clock = new SystemUtcClock();
            var variants = JObject.Parse(Resources.Load<TextAsset>("HexrotaData/variants").text)["levels"];
            var session = new UnityGameSession(data, storage, clock);
            Assert.That(session.StageCount, Is.EqualTo(12));
            for (int stage = 0; stage < session.StageCount; stage++)
            {
                Assert.That(session.NextStage, Is.EqualTo(stage), "Recommended stage after reload");
                Assert.That(session.EnterStage(stage), Is.True, session.LastError);
                int[][] route;
                if (stage < session.TutorialCount)
                    route = W.List(data.Levels[stage]["solution"]).Select(p => W.List(p).Select(W.Int32).ToArray()).ToArray();
                else
                {
                    var attempt = W.Required(W.Required(W.Required(storage.Read(ProfileRepository.ProfileKey), "game"), "attempts"), stage.ToString());
                    var level = variants.Single(l => l["levelId"].Value<int>() == stage - 1);
                    var variant = level["variants"].Single(v => v["id"].Value<string>() == (string)W.Required(attempt, "variantId"));
                    route = variant["solutions"][0].Select(p => p.Values<int>().ToArray()).ToArray();
                }
                foreach (int[] pair in route)
                {
                    if (session.NeedsTutorialAcknowledgement) Assert.That(session.AcknowledgeTutorial(), Is.True);
                    if (stage < session.TutorialCount) CollectionAssert.AreEqual(pair, session.TutorialPair);
                    var receipt = session.TrySwap(pair[0], pair[1]);
                    Assert.That(receipt.Ok, Is.True, "Stage " + stage + ": " + receipt.Reason);
                    session.CompletePresentation();
                }
                Assert.That(session.Status, Is.EqualTo("won"));
                Assert.That(session.IsStageComplete(stage), Is.True);
                session.ReturnToMenu();
                session = new UnityGameSession(data, storage, clock);
                Assert.That(session.IsStageComplete(stage), Is.True);
                if (stage >= session.TutorialCount) Assert.That(session.CanOpenStage(stage), Is.False);
                var milestones = W.List(data.EconomyConfig["botanical"]);
                var unlocked = milestones.LastOrDefault(m => W.Int32(W.Required(m, "stars")) <= session.ClearedCount);
                Assert.That(session.GardenTier, Is.EqualTo(W.Get(unlocked, "id", "soil")));
                Assert.That(Resources.Load<Texture2D>("GardenArt/" + session.GardenTier), Is.Not.Null);
            }
            Assert.That(session.ClearedCount, Is.EqualTo(10));
            Assert.That(session.NextStage, Is.EqualTo(-1));
        }
    }
}
