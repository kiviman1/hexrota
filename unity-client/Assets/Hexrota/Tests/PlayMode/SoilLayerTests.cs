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
    // Temporary code-drawn soil: two layers dark brown with cracks, one layer light brown, none grass.
    // A breaking layer throws crumbs; the chapter opens on an empty board for about a second.
    public sealed class SoilLayerTests : PlayModeTest
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
            holder = new GameObject("Soil test", typeof(RectTransform));
            board = holder.AddComponent<HexBoardView>();
            var camera = new GameObject("Soil camera").AddComponent<Camera>();
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

        private static (Color colour, float cracks, Texture texture) Floor(int index)
        {
            var renderer = Root().Find("Ground_" + index).GetComponentInChildren<Renderer>();
            var block = new MaterialPropertyBlock();
            renderer.GetPropertyBlock(block);
            return (block.GetColor("_Color"), block.GetFloat("_Cracks"), block.GetTexture("_MainTex"));
        }

        private LevelConfig LevelWithPackedSoil()
        {
            for (int i = data.TutorialCount; i < data.Levels.Count; i++)
            {
                var level = LevelCatalog.GameplayConfig(data.Levels[i]);
                if (level.cells.Any(cell => cell.layers >= 2) && level.cells.Any(cell => cell.layers == 1)) return level;
            }
            Assert.Fail("No chapter mixes one- and two-layer soil.");
            return null;
        }

        [UnityTest]
        public IEnumerator LayersShowAsDarkCrackedSoilLightSoilAndGrass()
        {
            var level = LevelWithPackedSoil();
            var snapshot = new HexMatch(level).Snapshot();
            snapshot.layers[Array.FindIndex(snapshot.layers, layer => layer == 1)] = 0;
            board.Build(level, snapshot);
            yield return null;
            for (int i = 0; i < snapshot.layers.Length; i++)
            {
                var floor = Floor(i);
                int layers = snapshot.layers[i];
                Color expected = layers <= 0 ? catalog.ui.grass : layers == 1 ? catalog.ui.soil : catalog.ui.soilDeep;
                if (level.obstacles != null) continue; // closed cells are shaded by the terrain pass
                Assert.That(floor.colour, Is.EqualTo(expected), "Cell " + i + " with " + layers + " layers");
                Assert.That(floor.cracks, Is.EqualTo(layers >= 2 ? 1f : 0f), "Cell " + i);
                Assert.That(floor.texture, Is.SameAs(Texture2D.whiteTexture), "Soil is drawn in code, not from cell art.");
            }
            Assert.That(Root().GetComponentsInChildren<SoilCrumbs>(), Is.Empty, "Building a board breaks no soil.");
        }

        [UnityTest]
        public IEnumerator ABreakingLayerThrowsCrumbsExceptInReducedMotion()
        {
            var level = LevelWithPackedSoil();
            var snapshot = new HexMatch(level).Snapshot();
            board.Build(level, snapshot);
            yield return null;
            int packed = Array.FindIndex(snapshot.layers, layer => layer >= 2);
            snapshot.layers[packed]--;
            board.Render(snapshot);
            var crumbs = Root().GetComponentsInChildren<SoilCrumbs>().Where(p => p.name == "Crumbs_" + packed).ToArray();
            Assert.That(crumbs, Has.Length.EqualTo(1));
            Assert.That(crumbs[0].Seconds, Is.EqualTo(catalog.motion.soilCrumbs.seconds).Within(.001f));
            Assert.That(crumbs[0].GetComponentsInChildren<SpriteRenderer>(), Has.Length.EqualTo(catalog.motion.soilCrumbCount));
            Assert.That(Floor(packed).colour, Is.EqualTo(catalog.ui.soil));
            Assert.That(Floor(packed).cracks, Is.Zero);
            float end = Time.realtimeSinceStartup + catalog.motion.soilCrumbs.seconds + 1f;
            while (crumbs[0] != null && Time.realtimeSinceStartup < end) yield return null;
            Assert.That(crumbs[0] == null, Is.True, "Crumbs clean themselves up.");

            board.ReducedMotion = true;
            snapshot.layers[packed]--;
            board.Render(snapshot);
            Assert.That(Root().GetComponentsInChildren<SoilCrumbs>(), Is.Empty);
            Assert.That(Floor(packed).colour, Is.EqualTo(catalog.ui.grass));
        }

        [UnityTest]
        public IEnumerator TheChapterOpensOnAnEmptyBoardForAboutASecondBeforeTheStonesFall()
        {
            UnityEngine.Object.Destroy(holder);
            var game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(game.Session.SetPreferences(motion: "full"), Is.True);
            game.BeginLevelOne();
            var curtain = UnityEngine.Object.FindAnyObjectByType<ChapterLoadingView>();
            float deadline = Time.realtimeSinceStartup + 8f;
            while (curtain.gameObject.activeSelf && Time.realtimeSinceStartup < deadline) yield return null;
            float opened = Time.realtimeSinceStartup, firstStone = -1f;
            var world = GameObject.Find("Ground_0").transform.parent;
            var stones = world.Cast<Transform>().Where(t => t.name.StartsWith("Stone_")).ToArray();
            while (game.IsEnteringStage && Time.realtimeSinceStartup < deadline + 8f)
            {
                if (firstStone < 0 && stones.Any(t => t.gameObject.activeSelf)) firstStone = Time.realtimeSinceStartup;
                yield return null;
            }
            Assert.That(firstStone, Is.GreaterThan(0f), "The stones fall in during the entrance.");
            // The board slides in (0.76 s), then stays empty for MotionTheme.emptyBoardHold before the first stone.
            Assert.That(catalog.motion.emptyBoardHold, Is.EqualTo(1f).Within(.2f));
            Assert.That(firstStone - opened, Is.GreaterThan(.76f + catalog.motion.emptyBoardHold * .9f));
            game.ReturnToMenu();
        }
    }
}
