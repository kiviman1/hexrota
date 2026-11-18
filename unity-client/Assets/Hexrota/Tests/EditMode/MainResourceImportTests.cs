using System.Linq;
using Hexrota.Catalog;
using Hexrota.Gameplay;
using Hexrota.Story;
using Hexrota.StoryAdapter;
using Hexrota.UnityClient;
using NUnit.Framework;
using UnityEngine;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    public sealed class MainResourceImportTests
    {
        private static object Read(string name)
        {
            var asset = Resources.Load<TextAsset>("HexrotaData/" + name);
            Assert.That(asset, Is.Not.Null, name);
            return WireJsonCodec.Parse(asset.text);
        }

        [TestCase("obstacle-levels-v1", 6)]
        [TestCase("campaign-flow-levels-v1", 2)]
        [TestCase("campaign-flow-levels-v2", 10)]
        [TestCase("material-alpha-levels-v1", 6)]
        public void ImportedVersionedLevelsWinAndRestoreFromEveryAuthoredRoute(string resource, int expectedRoutes)
        {
            int routes = 0;
            foreach (var level in W.List(W.Required(Read(resource), "levels")))
            foreach (var route in W.List(W.Required(level, "solutions")))
            {
                var config = LevelCatalog.GameplayConfig(level);
                var game = new HexMatch(config);
                foreach (var step in W.List(route))
                {
                    var pair = W.List(step);
                    Assert.That(game.Swap(W.Int32(pair[0]), W.Int32(pair[1])).ok, Is.True, resource);
                }
                Assert.That(game.Status, Is.EqualTo("won"));
                var snapshot = LevelCatalog.SnapshotWire(game.Snapshot());
                var restored = new HexMatch(config, LevelCatalog.ReadSnapshot(snapshot));
                Assert.That(W.Equal(snapshot, LevelCatalog.SnapshotWire(restored.Snapshot())), Is.True);
                routes++;
            }
            Assert.That(routes, Is.EqualTo(expectedRoutes));
        }

        [Test]
        public void StoryBindingsResolveEveryChapterAgainstImportedMaterialAttempts()
        {
            var levels = W.List(W.Required(Read("material-alpha-levels-v1"), "levels"));
            var book = StoryBindings.Validate(Read("story-content-v1"), levels);
            var catalog = new MaterialAlphaCatalog(ClientGameData.FromResources().Catalog, levels.Select(W.Map));
            foreach (var chapter in W.List(W.Required(book, "chapters")))
            {
                var attempt = catalog.Start(W.Required(chapter, "levelId"));
                var metadata = attempt.Metadata.ToWire();
                var level = attempt.LevelWire;
                var snapshot = new HexMatch(LevelCatalog.GameplayConfig(level)).Snapshot();
                var facts = CanonicalStoryFacts.Facts(level, metadata, LevelCatalog.SnapshotWire(snapshot));
                var context = CanonicalStoryFacts.Context(book, metadata);
                var state = StoryEngine.Observe(book, StoryEngine.Create(book, context), facts);
                var active = StoryEngine.Active(book, state);
                Assert.That(W.Required(active, "speakerId"), Is.EqualTo("tavik"));
                var resumed = StoryEngine.Restore(book, StoryEngine.Snapshot(state), context, facts);
                Assert.That(W.Equal(active, StoryEngine.Active(book, resumed)), Is.True);
            }
        }
    }
}
