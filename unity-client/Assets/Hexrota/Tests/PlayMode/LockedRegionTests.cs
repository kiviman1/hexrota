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
    // Cells still closed behind crates are dark and fogged with a lock; when their area opens the fog
    // and lock lift away (MotionTheme.regionOpen).
    public sealed class LockedRegionTests : PlayModeTest
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
            holder = new GameObject("Locked region test", typeof(RectTransform));
            board = holder.AddComponent<HexBoardView>();
            var camera = new GameObject("Locked camera").AddComponent<Camera>();
            camera.transform.SetParent(holder.transform, false);
            camera.orthographic = true;
            catalog = Resources.FindObjectsOfTypeAll<HexrotaAssetCatalog>().First(c => c.ui != null && c.motion != null);
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

        private static Transform Root() => GameObject.Find("Ground_0").transform.parent;

        private static int[] LockedCells(LevelConfig level)
        {
            var marks = Root().Find("Obstacles").Cast<Transform>().Where(t => t.name.StartsWith("Locked_") && t.gameObject.activeSelf);
            return marks.Select(t => int.Parse(t.name.Substring("Locked_".Length))).ToArray();
        }

        private static GameSnapshot AllOpen(GameSnapshot snapshot)
        {
            for (int b = 0; b < snapshot.blockerHp.Length; b++) snapshot.blockerHp[b] = 0;
            if (snapshot.cellOpen != null) for (int i = 0; i < snapshot.cellOpen.Length; i++) snapshot.cellOpen[i] = true;
            if (snapshot.regionOpen != null) for (int i = 0; i < snapshot.regionOpen.Length; i++) snapshot.regionOpen[i] = true;
            return snapshot;
        }

        [UnityTest]
        public IEnumerator ClosedCellsBehindCratesAreDarkFoggedAndLocked()
        {
            var level = LevelCatalog.GameplayConfig(data.Levels[data.TutorialCount + 6]);
            var snapshot = new HexMatch(level).Snapshot();
            board.Build(level, snapshot, true);
            yield return null;
            var locked = LockedCells(level);
            Assert.That(locked, Is.Not.Empty, "Chapter 7 opens with an area closed behind crates.");
            var crateCells = level.obstacles.blockers.Select(b => b.cell).ToArray();
            Assert.That(locked.Intersect(crateCells), Is.Empty, "A crate cell shows its crate, not a lock.");
            foreach (int cell in locked)
            {
                var mark = Root().Find("Obstacles/Locked_" + cell);
                Assert.That(mark.Find("Fog").GetComponent<SpriteRenderer>().color, Is.EqualTo(catalog.ui.lockedFog));
                var lockIcon = mark.Find("Lock").GetComponent<SpriteRenderer>();
                Assert.That(lockIcon.sprite, Is.Not.Null);
                Assert.That(lockIcon.color, Is.EqualTo(catalog.ui.lockedMark));
                var block = new MaterialPropertyBlock();
                Root().Find("Ground_" + cell).GetComponentInChildren<Renderer>().GetPropertyBlock(block);
                Assert.That(block.GetColor("_Color"), Is.EqualTo(catalog.ui.lockedFloor), "Closed floor is dark.");
                Assert.That(Root().Find("Stone_" + cell).gameObject.activeSelf, Is.False);
            }
        }

        [UnityTest]
        public IEnumerator OpeningTheAreaLiftsTheFogAndLock()
        {
            var level = LevelCatalog.GameplayConfig(data.Levels[data.TutorialCount + 6]);
            var snapshot = new HexMatch(level).Snapshot();
            board.Build(level, snapshot, true);
            yield return null;
            var locked = LockedCells(level);
            board.Render(AllOpen(snapshot));
            Assert.That(LockedCells(level), Is.Empty);
            var effects = Root().GetComponentsInChildren<RegionOpenEffect>();
            Assert.That(effects.Select(e => e.name).OrderBy(n => n), Is.EqualTo(locked.Select(c => "RegionOpen_" + c).OrderBy(n => n)));
            Assert.That(effects[0].Seconds, Is.EqualTo(catalog.motion.regionOpen.seconds).Within(.001f));
            var fog = effects[0].transform.Find("Fog");
            yield return new WaitForSecondsRealtime(effects[0].Seconds * .5f);
            Assert.That(fog.localScale.x, Is.GreaterThan(1.05f), "The fog swells as it clears.");
            yield return new WaitForSecondsRealtime(effects[0].Seconds);
            Assert.That(Root().GetComponentsInChildren<RegionOpenEffect>(), Is.Empty, "The effect removes itself.");
        }

        [UnityTest]
        public IEnumerator ReducedMotionOpensWithoutTheEffect()
        {
            var level = LevelCatalog.GameplayConfig(data.Levels[data.TutorialCount + 6]);
            var snapshot = new HexMatch(level).Snapshot();
            board.ReducedMotion = true;
            board.Build(level, snapshot, true);
            yield return null;
            board.Render(AllOpen(snapshot));
            Assert.That(LockedCells(level), Is.Empty);
            Assert.That(Root().GetComponentsInChildren<RegionOpenEffect>(), Is.Empty);
        }
    }
}
