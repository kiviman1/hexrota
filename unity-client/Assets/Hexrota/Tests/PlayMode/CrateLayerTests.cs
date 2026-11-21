using System;
using System.Collections;
using System.Linq;
using Hexrota.Application;
using Hexrota.Catalog;
using Hexrota.Gameplay;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Hexrota.UnityClientTests
{
    // Crate durability is drawn, not written: 3 = crate and two crossed planks, 2 = crate and plank A,
    // 1 = the crate alone. Each hit spins the top plank off; the last hit breaks the crate.
    public sealed class CrateLayerTests : PlayModeTest
    {
        private Func<UnityGameSession> previous;
        private ClientGameData data;
        private HexBoardView board;
        private HexrotaAssetCatalog catalog;
        private GameObject holder;

        [UnitySetUp]
        public IEnumerator CreateBoard()
        {
            data = ClientGameData.FromResources();
            previous = FirstPlayableController.SessionFactory;
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, new MemoryProfileStorage(), new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            holder = new GameObject("Crate test", typeof(RectTransform));
            board = holder.AddComponent<HexBoardView>();
            var camera = new GameObject("Crate camera").AddComponent<Camera>();
            camera.transform.SetParent(holder.transform, false);
            camera.orthographic = true;
            catalog = Resources.FindObjectsOfTypeAll<HexrotaAssetCatalog>().First(c => c.crateBase != null);
            board.Initialize(camera, catalog);
            board.SetCameraArea(new Rect(.02f, .05f, .96f, .72f));
        }

        [UnityTearDown]
        public IEnumerator CleanUp()
        {
            FirstPlayableController.SessionFactory = previous;
            if (holder != null) UnityEngine.Object.Destroy(holder);
            yield return null;
        }

        // Chapter 6 with every crate one hit stronger (at most 3): the shipped chapters are unchanged.
        private LevelConfig ToughChapterSix()
        {
            var level = LevelCatalog.GameplayConfig(data.Levels[data.TutorialCount + 5]);
            foreach (var crate in level.obstacles.blockers) crate.hp = Mathf.Min(HexMatch.MaxBlockerHp, crate.hp + 1);
            Assert.That(HexMatch.ValidateLevel(level), Is.True);
            return level;
        }

        private static Transform Root() => GameObject.Find("Ground_0").transform.parent;

        private static bool Shown(Transform crate, string part) => crate.Find(part).gameObject.activeSelf;

        [UnityTest]
        public IEnumerator EachDurabilityIsDrawnWithPlanksAndNoNumeral()
        {
            var level = ToughChapterSix();
            var snapshot = new HexMatch(level).Snapshot();
            Assert.That(snapshot.blockerHp, Does.Contain(3));
            board.Build(level, snapshot, true);
            yield return null;
            for (int b = 0; b < level.obstacles.blockers.Length; b++)
            {
                var crate = Root().Find("Obstacles/Crate_" + level.obstacles.blockers[b].cell);
                int hp = snapshot.blockerHp[b];
                Assert.That(crate.GetComponent<SpriteRenderer>().sprite, Is.SameAs(catalog.crateBase));
                Assert.That(crate.GetComponentsInChildren<TextMesh>(true), Is.Empty, "No durability numeral.");
                Assert.That(Shown(crate, "Plank_A"), Is.EqualTo(hp >= 2));
                Assert.That(Shown(crate, "Plank_B"), Is.EqualTo(hp >= 3));
                Assert.That(Shown(crate, "Plank_A_Shadow"), Is.EqualTo(hp >= 2), "Each plank has a thin shadow.");
                var plank = crate.Find("Plank_A").GetComponent<SpriteRenderer>();
                Assert.That(plank.color, Is.EqualTo(catalog.ui.cratePlankTint), "Planks are darkened to stand apart.");
                Assert.That(plank.sortingOrder, Is.GreaterThan(crate.GetComponent<SpriteRenderer>().sortingOrder));
                Assert.That(crate.Find("Plank_B").GetComponent<SpriteRenderer>().sortingOrder, Is.GreaterThan(plank.sortingOrder),
                    "Plank B lies on top and falls first.");
            }
        }

        [UnityTest]
        public IEnumerator EveryHitDropsTheTopPlankAndTheLastHitShattersTheCrate()
        {
            var level = ToughChapterSix();
            var snapshot = new HexMatch(level).Snapshot();
            int b = Array.IndexOf(snapshot.blockerHp, 3);
            board.Build(level, snapshot, true);
            yield return null;
            var crate = Root().Find("Obstacles/Crate_" + level.obstacles.blockers[b].cell);
            CrateDebris Debris(string prefix) => Root().GetComponentsInChildren<CrateDebris>().SingleOrDefault(d => d.name.StartsWith(prefix));

            snapshot.blockerHp[b] = 2;
            board.Render(snapshot);
            Assert.That(Shown(crate, "Plank_B"), Is.False);
            Assert.That(Shown(crate, "Plank_A"), Is.True);
            var fall = Debris("PlankFall_");
            Assert.That(fall, Is.Not.Null, "The top plank spins off.");
            Assert.That(fall.Count, Is.EqualTo(1));
            Assert.That(fall.Seconds, Is.EqualTo(catalog.motion.cratePlankFall.seconds).Within(.001f));
            var piece = fall.GetComponentInChildren<SpriteRenderer>();
            Assert.That(piece.sprite, Is.SameAs(catalog.cratePlanks[1].sprite));
            Quaternion start = piece.transform.rotation;
            Vector3 from = piece.transform.position;
            yield return new WaitForSecondsRealtime(fall.Seconds * .4f);
            Assert.That(Quaternion.Angle(start, piece.transform.rotation), Is.GreaterThan(10f), "The plank turns as it falls.");
            Assert.That(piece.transform.position, Is.Not.EqualTo(from));
            yield return new WaitForSecondsRealtime(fall.Seconds);
            Assert.That(fall == null, Is.True, "The falling plank removes itself.");

            snapshot.blockerHp[b] = 1;
            board.Render(snapshot);
            Assert.That(Shown(crate, "Plank_A"), Is.False);
            Assert.That(crate.gameObject.activeSelf, Is.True, "Durability 1 is the crate alone.");
            Assert.That(Debris("PlankFall_").GetComponentInChildren<SpriteRenderer>().sprite, Is.SameAs(catalog.cratePlanks[0].sprite));

            snapshot.blockerHp[b] = 0;
            board.Render(snapshot);
            Assert.That(crate.gameObject.activeSelf, Is.False);
            var shatter = Debris("CrateShatter_");
            Assert.That(shatter, Is.Not.Null, "The last hit breaks the crate.");
            Assert.That(shatter.Count, Is.EqualTo(4));
            Assert.That(shatter.Seconds, Is.EqualTo(catalog.motion.crateShatter.seconds).Within(.001f));
            yield return new WaitForSecondsRealtime(shatter.Seconds + .2f);
            Assert.That(shatter == null, Is.True);
        }

        [UnityTest]
        public IEnumerator ReducedMotionChangesTheCrateWithoutDebris()
        {
            var level = ToughChapterSix();
            var snapshot = new HexMatch(level).Snapshot();
            int b = Array.IndexOf(snapshot.blockerHp, 3);
            board.ReducedMotion = true;
            board.Build(level, snapshot, true);
            yield return null;
            snapshot.blockerHp[b] = 0;
            board.Render(snapshot);
            Assert.That(Root().Find("Obstacles/Crate_" + level.obstacles.blockers[b].cell).gameObject.activeSelf, Is.False);
            Assert.That(Root().GetComponentsInChildren<CrateDebris>(), Is.Empty);
        }

        [Test]
        public void TheEngineTakesThreeHitsToBreakADurabilityThreeCrate()
        {
            var level = ToughChapterSix();
            var first = Hexrota.Contracts.Wire.List(Hexrota.Contracts.Wire.List(data.Levels[data.TutorialCount + 5]["solution"])[0])
                .Select(Hexrota.Contracts.Wire.Int32).ToArray();
            var game = new HexMatch(level);
            var swap = game.Swap(first[0], first[1]);
            Assert.That(swap.ok, Is.True);
            var hit = swap.frames.SelectMany(f => f.blockerHits).First(h => h.beforeHp == 3);
            Assert.That(hit.hp, Is.EqualTo(2), "One match is one hit.");
            var tooTough = LevelCatalog.GameplayConfig(data.Levels[data.TutorialCount + 5]);
            tooTough.obstacles.blockers[0].hp = HexMatch.MaxBlockerHp + 1;
            Assert.That(() => HexMatch.ValidateLevel(tooTough), Throws.ArgumentException);
        }
    }
}
