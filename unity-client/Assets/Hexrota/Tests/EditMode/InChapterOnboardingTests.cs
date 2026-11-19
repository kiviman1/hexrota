using System.Collections.Generic;
using System.Linq;
using Hexrota.Application;
using Hexrota.Gameplay;
using Hexrota.UnityClient;
using NUnit.Framework;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    public sealed class InChapterOnboardingTests
    {
        [Test]
        public void EachFirstChapterVariantTeachesAnActualMatchAndRestoresTheSameAttempt()
        {
            var data = ClientGameData.FromResources();
            var seen = new HashSet<string>();
            for (uint seed = 1; seed <= 4; seed++)
            {
                var store = new MemoryProfileStorage();
                var session = new UnityGameSession(data, store, new SystemUtcClock(), seed);
                int chapter = session.TutorialCount;
                Assert.That(session.NextStage, Is.EqualTo(chapter));
                Assert.That(session.EnterStage(chapter), Is.True);
                var game = W.Required(store.Read(ProfileRepository.ProfileKey), "game");
                var metadata = W.Required(W.Required(game, "attempts"), chapter.ToString());
                seen.Add((string)W.Required(metadata, "variantId"));
                Assert.That(W.Required(metadata, "levelDataVersion"), Is.EqualTo("chapter-one-v1"));

                string attempt = session.AttemptId;
                var pair = session.OpeningLessonPair;
                Assert.That(pair, Has.Length.EqualTo(2));
                Assert.That(session.CompletedSceneTutorials, Is.Zero);
                var model = new HexMatch(session.Level, session.Snapshot);
                Assert.That(model.FindMatches(), Is.Empty);
                var counts = model.values.GroupBy(value => value).Select(group => group.Count()).ToArray();
                CollectionAssert.AreEquivalent(new[] {4,5,5,5}, counts);
                Assert.That(model.topology.pairs.Count(edge => model.values[edge[0]] == model.values[edge[1]]),
                    Is.LessThanOrEqualTo(5), "The teaching board should not open with clusters of identical neighbours.");
                var projected = model.Clone().Swap(pair[0], pair[1]);
                Assert.That(projected.ok, Is.True);
                Assert.That(projected.frames, Has.Length.EqualTo(1));
                Assert.That(projected.frames[0].matched, Has.Length.EqualTo(3));
                CollectionAssert.AreEquivalent(projected.frames[0].matched, session.OpeningLessonMatchIndices);
                Assert.That(session.OpeningLessonMatchIndices, Does.Contain(pair[1]));
                var bright = new HashSet<int>(session.OpeningLessonMatchIndices.Concat(pair));
                Assert.That(bright.Count, Is.EqualTo(4));
                Assert.That(bright.SelectMany(index => model.neighbors[index])
                    .Any(index => !bright.Contains(index) && model.values[index] == model.values[pair[0]]), Is.False,
                    "No adjacent decoy of the teaching colour should touch the highlighted group.");

                var level = data.Catalog.ResolveLevelWire(1, (string)W.Required(metadata, "variantId"), "chapter-one-v1");
                foreach (var solution in W.List(level["solutions"]))
                {
                    var replay = model.Clone();
                    foreach (var step in W.List(solution).Select(W.List))
                        Assert.That(replay.Swap(W.Int32(step[0]), W.Int32(step[1])).ok, Is.True);
                    Assert.That(replay.Status, Is.EqualTo("won"));
                }
                int moves = session.Snapshot.movesLeft;

                session = new UnityGameSession(data, store, new SystemUtcClock(), seed);
                Assert.That(session.EnterStage(session.NextStage), Is.True);
                Assert.That(session.AttemptId, Is.EqualTo(attempt));
                Assert.That(session.OpeningLessonPair, Is.EqualTo(pair));
                Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True);
                session.CompletePresentation();
                var played = session.Snapshot;
                Assert.That(played.movesLeft, Is.EqualTo(moves - 1));
                session.ReturnToMenu();
                session = new UnityGameSession(data, store, new SystemUtcClock(), seed);
                Assert.That(session.EnterStage(session.NextStage), Is.True);
                Assert.That(session.AttemptId, Is.EqualTo(attempt));
                Assert.That(session.Snapshot.values, Is.EqualTo(played.values));
                Assert.That(session.Snapshot.layers, Is.EqualTo(played.layers));
                Assert.That(session.Snapshot.score, Is.EqualTo(played.score));
                Assert.That(session.ShouldTeachOpening, Is.False);
                Assert.That(session.CompletedSceneTutorials, Is.EqualTo(1));
            }
            Assert.That(seen, Has.Count.EqualTo(4));
        }

        [Test]
        public void ArchivedFirstBoardsKeepTheirIdentityAndTeachASingleWinnableLine()
        {
            var classic = ClientGameData.FromResources(false);
            var current = ClientGameData.FromResources();
            var pack = WireJsonCodec.Parse(UnityEngine.Resources.Load<UnityEngine.TextAsset>(
                "HexrotaData/chapter-one-openings-v1").text);
            var routes = W.Required(W.Required(pack, "archivedOpeningSolutions"), "variants-v1");
            for (uint seed = 1; seed <= 4; seed++)
            {
                var store = new MemoryProfileStorage();
                var old = new UnityGameSession(classic, store, new SystemUtcClock(), seed);
                Assert.That(old.EnterLevelOne(), Is.True);
                var start = old.Snapshot;
                string id = old.AttemptId;
                var game = W.Required(store.Read(ProfileRepository.ProfileKey), "game");
                var identity = W.Required(W.Required(game, "attempts"), old.ActiveStage.ToString());
                Assert.That(W.Required(identity, "levelDataVersion"), Is.EqualTo("variants-v1"));
                string variant = (string)W.Required(identity, "variantId");
                old.ReturnToMenu();
                var restored = new UnityGameSession(current, store, new SystemUtcClock(), seed);
                Assert.That(restored.EnterLevelOne(), Is.True);
                Assert.That(restored.AttemptId, Is.EqualTo(id));
                Assert.That(restored.Snapshot.values, Is.EqualTo(start.values));
                Assert.That(restored.Snapshot.rngState, Is.EqualTo(start.rngState));
                var steps = W.List(W.Required(routes, variant)).Select(step => W.List(step).Select(W.Int32).ToArray()).ToArray();
                CollectionAssert.AreEquivalent(steps[0], restored.OpeningLessonPair);
                Assert.That(restored.OpeningLessonMatchIndices, Has.Length.EqualTo(3));
                foreach (var step in steps)
                {
                    Assert.That(restored.TrySwap(step[0], step[1]).Ok, Is.True);
                    restored.CompletePresentation();
                }
                Assert.That(restored.Status, Is.EqualTo("won"));
                Assert.That(restored.EnterStage(restored.NextStage), Is.True);
                game = W.Required(store.Read(ProfileRepository.ProfileKey), "game");
                identity = W.Required(W.Required(game, "attempts"), restored.ActiveStage.ToString());
                Assert.That(W.Required(identity, "levelDataVersion"), Is.EqualTo("variants-v1"));
            }
        }

        [TestCase(false)]
        [TestCase(true)]
        public void RestartRemembersWhetherThePlayerActuallyMadeTheirFirstMatch(bool played)
        {
            var data = ClientGameData.FromResources();
            var store = new MemoryProfileStorage();
            var session = new UnityGameSession(data, store, new SystemUtcClock());
            Assert.That(session.EnterLevelOne(), Is.True);
            if (played)
            {
                var pair = session.OpeningLessonPair;
                Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True);
                session.CompletePresentation();
            }
            Assert.That(session.Restart(), Is.True, session.LastError);
            var restored = new UnityGameSession(data, store, new SystemUtcClock());
            Assert.That(restored.EnterLevelOne(), Is.True);
            Assert.That(restored.ShouldTeachOpening, Is.EqualTo(!played));
            Assert.That(restored.CompletedSceneTutorials, Is.EqualTo(played ? 1 : 0));
        }

        [Test]
        public void LegacyTutorialCheckpointsRemainReadableAndTheirWelcomeGiftIsNotRepeated()
        {
            var data = ClientGameData.FromResources();
            var store = new MemoryProfileStorage();
            var session = new UnityGameSession(data, store, new SystemUtcClock());
            Assert.That(session.EnterStage(0), Is.True);
            var first = session.TutorialPair;
            Assert.That(session.TrySwap(first[0], first[1]).Ok, Is.True);
            session.CompletePresentation();
            var archived = session.Snapshot;
            var attempt = session.AttemptId;
            session.ReturnToMenu();
            session = new UnityGameSession(data, store, new SystemUtcClock());
            Assert.That(session.NextStage, Is.EqualTo(session.TutorialCount));
            Assert.That(session.EnterStage(0), Is.True);
            Assert.That(session.AttemptId, Is.EqualTo(attempt));
            Assert.That(session.Snapshot.values, Is.EqualTo(archived.values));
            for (int i = 0; i < session.TutorialCount; i++)
            {
                if (i > 0) Assert.That(session.EnterStage(i), Is.True);
                var route = CampaignTestRoute.ForActiveAttempt(data, session, store);
                foreach (var pair in route.Skip(session.Snapshot.turn))
                {
                    if (session.NeedsTutorialAcknowledgement) Assert.That(session.AcknowledgeTutorial(), Is.True);
                    Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True);
                    session.CompletePresentation();
                }
                Assert.That(session.Status, Is.EqualTo("won"));
            }
            Assert.That(session.ReadEarnedResult().WelcomeGold, Is.EqualTo(20));
            session.ReturnToMenu();
            session = new UnityGameSession(data, store, new SystemUtcClock());
            Assert.That(session.EnterStage(session.NextStage), Is.True);
            Assert.That(session.ShouldTeachOpening, Is.False);
            foreach (var pair in CampaignTestRoute.ForActiveAttempt(data, session, store))
            {
                Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True);
                session.CompletePresentation();
            }
            Assert.That(session.ReadEarnedResult().Gold, Is.EqualTo(20));
            Assert.That(session.ReadEarnedResult().WelcomeGold, Is.Zero);
            Assert.That(session.ReadPhoneWallet().Gold, Is.EqualTo(40));
        }

        [TestCase(false)]
        [TestCase(true)]
        public void FirstWinCommitsTheEligibleRewardsOnceEvenAfterAStorageFailure(bool previouslySkipped)
        {
            var data = ClientGameData.FromResources();
            var store = new MemoryProfileStorage();
            var session = new UnityGameSession(data, store, new SystemUtcClock());
            if (previouslySkipped)
            {
                Assert.That(session.EnterStage(0), Is.True);
                Assert.That(session.SkipTutorials(), Is.True);
            }
            else Assert.That(session.EnterStage(session.NextStage), Is.True);
            Assert.That(session.ShouldTeachOpening, Is.EqualTo(!previouslySkipped));
            int first = session.TutorialCount;
            var wallet = session.ReadPhoneWallet();
            var route = CampaignTestRoute.ForActiveAttempt(data, session, store);
            foreach (var pair in route.Take(route.Length - 1))
            {
                Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True);
                session.CompletePresentation();
            }
            var last = route.Last();
            store.FailProfileWrites = true;
            Assert.That(session.TrySwap(last[0], last[1]).Ok, Is.False);
            Assert.That(session.Status, Is.EqualTo("playing"));
            Assert.That(session.ReadPhoneWallet().Gold, Is.EqualTo(wallet.Gold));
            store.FailProfileWrites = false;
            Assert.That(session.TrySwap(last[0], last[1]).Ok, Is.True);
            session.CompletePresentation();
            var earned = session.ReadEarnedResult();
            Assert.That(earned.WelcomeGold, Is.EqualTo(previouslySkipped ? 0 : 20));
            Assert.That(earned.Gold, Is.EqualTo(20 + earned.WelcomeGold));
            Assert.That(earned.GoldenEggs, Is.EqualTo(1));
            Assert.That(session.CompletedSceneTutorials, Is.EqualTo(2));
            session.ReturnToMenu();
            var restored = new UnityGameSession(data, store, new SystemUtcClock());
            Assert.That(restored.NextStage, Is.EqualTo(first + 1));
            Assert.That(restored.ReadPhoneWallet().Gold, Is.EqualTo(wallet.Gold + earned.Gold));
            Assert.That(restored.ReadPhoneWallet().GoldenEggs, Is.EqualTo(wallet.GoldenEggs + 1));
            Assert.That(restored.IsStageComplete(0), Is.EqualTo(previouslySkipped));
            Assert.That(restored.IsStageComplete(1), Is.EqualTo(previouslySkipped));
            var game = W.Required(store.Read(ProfileRepository.ProfileKey), "game");
            var tx = W.Map(W.Required(W.Required(game, "economy"), "transactions"));
            Assert.That(tx.ContainsKey("welcome:main:onboarding-v1"), Is.EqualTo(!previouslySkipped));
        }
    }
}
