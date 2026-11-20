using System.Linq;
using Hexrota.Application;
using Hexrota.Catalog;
using Hexrota.Gameplay;
using Hexrota.UnityClient;
using NUnit.Framework;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    public sealed class MaskedCampaignSaveTests
    {
        [Test]
        public void LayoutsUseThePublishedMasksAndTheArchivedFlowStillResumes()
        {
            var catalog = ClientGameData.FromResources().Catalog;
            int[] counts = { 43, 49, 53, 61, 65 };
            for (int chapter = 1; chapter <= 10; chapter++)
            {
                Assert.That(catalog.List(chapter, catalog.CurrentVersion), Has.Length.EqualTo(4));
                if (chapter < 6)
                {
                    Assert.That(catalog.List(chapter), Has.Length.EqualTo(4));
                    continue;
                }
                var start = catalog.Start(chapter);
                Assert.That(start.Metadata.levelDataVersion, Is.EqualTo(CampaignFlowCatalog.LargeDataVersion));
                Assert.That(W.List(start.LevelWire["cells"]), Has.Count.EqualTo(counts[chapter - 6]));
            }

            var archive = catalog.Start(6, W.Obj("levelDataVersion", CampaignFlowCatalog.DataVersion));
            var game = new HexMatch(LevelCatalog.GameplayConfig(archive.LevelWire));
            var pair = W.List(W.List(archive.LevelWire["solution"])[0]);
            Assert.That(game.Swap(W.Int32(pair[0]), W.Int32(pair[1])).ok, Is.True);
            var restored = catalog.Restore(6, game.Snapshot(), archive.Metadata);
            Assert.That(restored.Snapshot.values, Has.Length.EqualTo(23));
            Assert.That(restored.Metadata.attemptId, Is.EqualTo(archive.Metadata.attemptId));
            Assert.That(W.Equal(LevelCatalog.SnapshotWire(game.Snapshot()), LevelCatalog.SnapshotWire(restored.Snapshot)), Is.True);
        }

        [Test]
        public void AClassicChapterSixResumesOnItsOwnLayoutAndANewAttemptGetsTheLargeMask()
        {
            var classic = ClientGameData.FromResources(false);
            var profile = new MemoryProfileStorage();
            var clock = new SystemUtcClock();
            var session = new UnityGameSession(classic, profile, clock);
            int sixth = session.TutorialCount + 5;
            for (int stage = session.TutorialCount; stage <= sixth; stage++)
            {
                Assert.That(session.EnterStage(stage), Is.True, session.LastError);
                var attempt = W.Required(W.Required(W.Required(profile.Read(ProfileRepository.ProfileKey), "game"), "attempts"), stage.ToString());
                var level = classic.Catalog.ResolveLevelWire(W.Required(attempt, "levelId"), (string)W.Required(attempt, "variantId"),
                    (string)W.Required(attempt, "levelDataVersion"));
                var route = W.List(level["solution"]);
                foreach (var step in route.Take(stage == sixth ? 1 : route.Count))
                {
                    var pair = W.List(step);
                    Assert.That(session.TrySwap(W.Int32(pair[0]), W.Int32(pair[1])).Ok, Is.True);
                    session.CompletePresentation();
                }
                if (stage != sixth) session.ReturnToMenu();
            }
            var snapshot = session.Snapshot;
            string attemptId = session.AttemptId;
            session.Suspend(); // a saved attempt in progress (leaving through the menu would end it)
            var current = ClientGameData.FromResources();
            session = new UnityGameSession(current, profile, clock);
            Assert.That(session.GetChapterPreview(sixth).Cells, Is.EqualTo(snapshot.values.Length));
            Assert.That(session.EnterStage(sixth), Is.True, session.LastError);
            Assert.That(session.AttemptId, Is.EqualTo(attemptId));
            Assert.That(session.UsesNineByNineFrame, Is.False);
            Assert.That(W.Equal(LevelCatalog.SnapshotWire(snapshot), LevelCatalog.SnapshotWire(session.Snapshot)), Is.True);

            Assert.That(session.StartChapterFresh(sixth), Is.True, session.LastError);
            Assert.That(session.AttemptId, Is.Not.EqualTo(attemptId));
            Assert.That(session.UsesNineByNineFrame, Is.True);
            var first = W.List(W.List(current.Levels[sixth]["solution"])[0]);
            Assert.That(session.TrySwap(W.Int32(first[0]), W.Int32(first[1])).Ok, Is.True);
            session.CompletePresentation();
            var expected = LevelCatalog.SnapshotWire(session.Snapshot);
            attemptId = session.AttemptId;
            session.Suspend();
            session = new UnityGameSession(current, profile, clock);
            Assert.That(session.GetChapterPreview(sixth).Cells, Is.EqualTo(43));
            Assert.That(session.EnterStage(sixth), Is.True, session.LastError);
            Assert.That(session.AttemptId, Is.EqualTo(attemptId));
            Assert.That(W.Equal(expected, LevelCatalog.SnapshotWire(session.Snapshot)), Is.True);
        }
    }
}
