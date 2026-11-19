using Hexrota.Application;
using Hexrota.UnityClient;
using NUnit.Framework;

namespace Hexrota.UnityClientTests
{
    public sealed class DevelopmentWinTests
    {
        [Test]
        public void EveryCampaignChapterWinsWithItsStoredSolution()
        {
            var data = ClientGameData.FromResources();
            var store = new MemoryProfileStorage();
            var session = new UnityGameSession(data, store, new SystemUtcClock());
            for (int stage = session.TutorialCount; stage < session.StageCount; stage++)
            {
                Assert.That(session.EnterStage(stage), Is.True, session.StageLabel(stage) + ": " + session.LastError);
                var last = session.PlayDevelopmentRouteToLastMove();
                Assert.That(last, Is.Not.Null, session.StageLabel(stage) + ": " + session.LastError);
                Assert.That(session.TrySwap(last[0], last[1]).Ok, Is.True, session.StageLabel(stage) + ": " + session.LastError);
                session.CompletePresentation();
                Assert.That(session.Status, Is.EqualTo("won"), session.StageLabel(stage));
                session.ReturnToMenu();
                Assert.That(session.IsStageComplete(stage), Is.True, session.StageLabel(stage));
            }
            var wallet = new UnityGameSession(data, store, new SystemUtcClock()).ReadPhoneWallet();
            Assert.That(wallet.EarnedEggs, Is.EqualTo(session.StageCount - session.TutorialCount),
                "Each chapter's first win still earns exactly one Golden Egg.");
        }

        [Test]
        public void TheRouteOnlyStartsFromTheOpeningBoard()
        {
            var data = ClientGameData.FromResources();
            var session = new UnityGameSession(data, new MemoryProfileStorage(), new SystemUtcClock());
            Assert.That(session.PlayDevelopmentRouteToLastMove(), Is.Null);
            Assert.That(session.LastError, Is.EqualTo("not_playing"));

            Assert.That(session.EnterLevelOne(), Is.True, session.LastError);
            var pair = session.OpeningLessonPair;
            Assert.That(pair, Is.Not.Null);
            Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True);
            session.CompletePresentation();
            Assert.That(session.PlayDevelopmentRouteToLastMove(), Is.Null);
            Assert.That(session.LastError, Is.EqualTo("not_at_start"));
        }
    }
}
