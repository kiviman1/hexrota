using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;

namespace Hexrota.UnityClientTests
{
    public sealed class PhoneGameplayLayoutTests
    {
        [TestCase(390,844)]
        [TestCase(360,640)]
        [TestCase(393,852)]
        public void BoardUsesTheSpaceBelowTheHudAndRespectsTheTutorialCard(int width, int height)
        {
            var numeric = new MobileLayout.GameRegions((float)width/height,false);
            var lesson = new MobileLayout.GameRegions((float)width/height,true);
            Assert.That(numeric.Header * height / width, Is.EqualTo(104f / 390).Within(.001));
            Assert.That(numeric.Board.yMin * height, Is.InRange(0f, 8f));
            Assert.That(lesson.Board.yMin, Is.EqualTo(numeric.Board.yMin));
            Assert.That(numeric.Board.yMax, Is.LessThan(1 - numeric.Header));
            Assert.That(lesson.CoachTop, Is.LessThan(1 - lesson.Header));
            Assert.That(lesson.Board.yMax,Is.LessThan(lesson.CoachBottom));
        }

        [Test]
        public void SkipWithFailedStorageKeepsTheLessonAndSuccessfulSkipPersistsWithoutAwardingWelcomeGold()
        {
            var data = ClientGameData.FromResources();
            var store = new MemoryProfileStorage();
            var session = new UnityGameSession(data,store,new SystemUtcClock());
            Assert.That(session.EnterStage(0), Is.True);
            var pair = session.TutorialPair;
            Assert.That(session.TrySwap(pair[0],pair[1]).Ok, Is.True);
            session.CompletePresentation();
            var before = session.Snapshot;
            var wallet = session.ReadPhoneWallet();
            store.FailProfileWrites = true;
            Assert.That(session.SkipTutorials(), Is.False);
            Assert.That(session.ActiveStage, Is.Zero);
            Assert.That(session.Snapshot.values, Is.EqualTo(before.values));
            Assert.That(session.Snapshot.turn, Is.EqualTo(before.turn));
            Assert.That(session.IsStageComplete(0), Is.False);
            store.FailProfileWrites = false;
            Assert.That(session.SkipTutorials(), Is.True,session.LastError);
            var restored = new UnityGameSession(data,store,new SystemUtcClock());
            Assert.That(restored.NextStage, Is.EqualTo(restored.TutorialCount));
            Assert.That(restored.IsStageComplete(0) && restored.IsStageComplete(1), Is.True);
            Assert.That(restored.ReadPhoneWallet().Gold, Is.EqualTo(wallet.Gold));
            Assert.That(restored.ReadPhoneWallet().Stars, Is.EqualTo(wallet.Stars));
        }
    }
}
