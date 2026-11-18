using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;

namespace Hexrota.UnityClientTests
{
    public sealed class PhoneGameplayLayoutTests
    {
        [Test]
        public void MobileBoardAndControlsFollowThePortraitPlayArea()
        {
            var numeric = new MobileLayout.GameRegions(390f/844,false,false);
            var lesson = new MobileLayout.GameRegions(390f/844,true,true);
            Assert.That(844*numeric.Header,Is.EqualTo(160).Within(.1));
            Assert.That(844*numeric.Footer,Is.EqualTo(90).Within(.1));
            Assert.That(844*(1-numeric.Board.center.y), Is.EqualTo(462).Within(1));
            Assert.That(844*(1-lesson.Board.center.y), Is.EqualTo(535).Within(1));
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
