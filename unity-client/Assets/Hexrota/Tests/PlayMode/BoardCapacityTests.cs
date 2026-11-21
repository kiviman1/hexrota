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
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    public sealed class BoardCapacityTests : PlayModeTest
    {
        private Func<UnityGameSession> previous;
        private ClientGameData data;
        private HexBoardView board;
        private Camera camera;
        private GameObject holder;

        [UnitySetUp]
        public IEnumerator CreateBoard()
        {
            data = ClientGameData.FromResources();
            previous = FirstPlayableController.SessionFactory;
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, new MemoryProfileStorage(), new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            holder = new GameObject("Capacity test", typeof(RectTransform));
            board = holder.AddComponent<HexBoardView>();
            camera = new GameObject("Capacity camera").AddComponent<Camera>();
            camera.transform.SetParent(holder.transform, false);
            camera.orthographic = true;
            board.Initialize(camera, Resources.FindObjectsOfTypeAll<HexrotaAssetCatalog>().First(c => c.stoneSprites != null && c.stoneSprites.Length == 5 && c.stoneSprites[0] != null));
            board.SetCameraArea(new Rect(.02f, .05f, .96f, .72f));
        }

        [UnityTearDown]
        public IEnumerator CleanUp()
        {
            FirstPlayableController.SessionFactory = previous;
            if (holder != null) UnityEngine.Object.Destroy(holder);
            yield return null;
        }

        private LevelConfig Chapter(int chapter) => LevelCatalog.GameplayConfig(data.Levels[data.TutorialCount + chapter - 1]);

        private void Tap(Vector2 world)
        {
            var input = new PointerEventData(EventSystem.current) { position = camera.WorldToScreenPoint(world), pointerId = -1 };
            board.OnPointerDown(input);
            board.OnPointerUp(input);
        }

        // Normal play never selects on tap; item targeting is the only tap input, so it probes which cells take touches.
        private int TapTarget(Vector2 world)
        {
            int hit = -1;
            board.SelectCellForItem(cell => hit = cell);
            Tap(world);
            board.SelectCellForItem(null);
            return hit;
        }

        [UnityTest]
        public IEnumerator BreakingCratesRevealsAndRefillsTheNewlyConnectedCellsDuringTheWave()
        {
            var level = Chapter(6);
            var model = new HexMatch(level);
            var before = model.Snapshot();
            board.Build(level, before, true);
            yield return null;
            var root = GameObject.Find("Ground_0").transform.parent;
            var first = W.List(W.List(data.Levels[data.TutorialCount + 5]["solution"])[0]).Select(W.Int32).ToArray();
            var swap = model.Swap(first[0], first[1]);
            Assert.That(swap.ok, Is.True);
            var wave = swap.frames[0];
            var damaged = wave.blockerHits.First(hit => hit.beforeHp == 2 && hit.hp == 1);
            var broken = wave.blockerHits.First(hit => hit.hp == 0);
            var intactCrate = root.Find("Obstacles/Crate_" + damaged.cell).GetComponent<SpriteRenderer>();
            bool PlankA() => intactCrate.transform.Find("Plank_A").gameObject.activeSelf;
            var brokenCrate = root.Find("Obstacles/Crate_" + broken.cell);
            int opened = wave.openedCells.First(i => !level.obstacles.blockers.Any(crate => crate.cell == i));
            var xy = MobileLayout.Axial(level.cells[opened].q, level.cells[opened].r);
            var floor = root.Find("Ground_" + opened);
            Color FloorTint()
            {
                var ink = new MaterialPropertyBlock();
                floor.GetComponentInChildren<Renderer>().GetPropertyBlock(ink);
                return ink.GetColor("_Color");
            }
            Color shaded = FloorTint();
            board.InputEnabled = true;
            Assert.That(TapTarget(xy), Is.EqualTo(-1));
            Assert.That(intactCrate.sprite.name, Is.EqualTo("Crate_Base"));
            Assert.That(PlankA(), Is.True, "Durability 2 shows the crate with plank A.");
            Assert.That(brokenCrate.gameObject.activeSelf, Is.True);
            bool changedDuringWave = false;
            board.WaveProgress += (frame, ordinal, progress) => {
                if (ordinal == 1 && progress >= .35f)
                    changedDuringWave |= !PlankA() &&
                        !brokenCrate.gameObject.activeSelf && FloorTint() != shaded;
            };
            board.Present(new MovePresentation { Ok = true, A = first[0], B = first[1], Before = before,
                After = model.Snapshot(), Swap = swap });
            float deadline = Time.realtimeSinceStartup + 6f;
            while (board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(board.IsAnimating, Is.False);
            Assert.That(changedDuringWave, Is.True, "The crates and floor must update as stones start falling.");
            Assert.That(intactCrate.gameObject.activeSelf && !PlankA(), Is.True, "Durability 1 is the crate alone.");
            Assert.That(root.Find("Stone_" + opened).gameObject.activeSelf, Is.True);
            Assert.That(TapTarget(xy), Is.EqualTo(opened));
        }

        [UnityTest]
        public IEnumerator FiveMasksShareTheOddQFrameAndVoidsNeverBecomeTargets()
        {
            int[] counts = { 43, 49, 53, 61, 65 };
            float nineColumnSize = 0;
            for (int chapter = 6; chapter <= 10; chapter++)
            {
                var level = Chapter(chapter);
                var snapshot = new HexMatch(level).Snapshot();
                board.Build(level, snapshot, true);
                yield return null;
                var root = GameObject.Find("Ground_0").transform.parent;
                Assert.That(root.Cast<Transform>().Count(node => node.name.StartsWith("Ground_")), Is.EqualTo(counts[chapter - 6]));
                if (chapter == 6) nineColumnSize = camera.orthographicSize;
                Assert.That(camera.orthographicSize, Is.EqualTo(nineColumnSize).Within(.0001f));
                board.InputEnabled = true;
                for (int q = -4; q <= 4; q++)
                    for (int row = -4; row <= 4; row++)
                    {
                        int r = row - Mathf.FloorToInt(q * .5f);
                        Vector2 xy = MobileLayout.Axial(q, r);
                        Vector2 vp = camera.WorldToViewportPoint(xy);
                        Assert.That(vp.x, Is.InRange(0f, 1f));
                        Assert.That(vp.y, Is.InRange(0f, 1f));
                        int index = Array.FindIndex(level.cells, cell => cell.q == q && cell.r == r);
                        if (index >= 0 && snapshot.values[index].HasValue) continue;
                        Assert.That(TapTarget(xy), Is.EqualTo(-1), "Void and closed cells must not accept touches.");
                    }
                int first = Array.FindIndex(snapshot.values, value => value.HasValue);
                Assert.That(TapTarget(MobileLayout.Axial(level.cells[first].q, level.cells[first].r)), Is.EqualTo(first));
                for (int b = 0; b < level.obstacles.blockers.Length; b++)
                {
                    var crate = root.Find("Obstacles/Crate_" + level.obstacles.blockers[b].cell).GetComponent<SpriteRenderer>();
                    Assert.That(crate.sprite.name, Is.EqualTo("Crate_Base"));
                    // Durability shows as planks, never as a numeral.
                    Assert.That(crate.GetComponentsInChildren<TextMesh>(true), Is.Empty);
                    Assert.That(crate.transform.Find("Plank_A").gameObject.activeSelf, Is.EqualTo(snapshot.blockerHp[b] >= 2));
                    Assert.That(crate.transform.Find("Plank_B").gameObject.activeSelf, Is.EqualTo(snapshot.blockerHp[b] >= 3));
                }
            }
        }

        [UnityTest]
        public IEnumerator OpeningGemsFallThroughTheirOwnColumnAndCancelRestoresTheExactMask()
        {
            var level = Chapter(6);
            var snapshot = new HexMatch(level).Snapshot();
            board.Build(level, snapshot, true);
            yield return null;
            var root = GameObject.Find("Ground_0").transform.parent;
            var stones = Enumerable.Range(0, level.cells.Length).Select(i => root.Find("Stone_" + i)).ToArray();
            var rest = stones.Select(s => s.position).ToArray();
            var restScale = stones.Select(s => s.localScale).ToArray();
            var restRotation = stones.Select(s => s.localRotation).ToArray();
            var home = camera.transform.position;
            board.BeginEntrance(snapshot);
            Assert.That(camera.transform.position.x, Is.LessThan(home.x));
            Assert.That(stones.All(s => !s.gameObject.activeSelf), Is.True);
            board.SetEntranceSlide(.5f);
            Assert.That(stones.All(s => !s.gameObject.activeSelf), Is.True);
            board.SetEntranceSlide(1f);
            Assert.That(camera.transform.position, Is.EqualTo(home));
            // The empty board shows first (MotionTheme.emptyBoardHold), then the stones fall.
            float hold = board.EmptyBoardHold / board.EntranceFillSeconds;
            Assert.That(board.EmptyBoardHold, Is.GreaterThan(0f));
            board.SetEntranceFill(hold * .95f);
            Assert.That(stones.All(s => !s.gameObject.activeSelf), Is.True, "Nothing falls during the empty-board hold.");
            board.SetEntranceFill(hold + (1f - hold) * .48f);
            Assert.That(stones.Where((s, i) => s.gameObject.activeSelf && s.position.y > rest[i].y + .05f), Is.Not.Empty);
            for (int i = 0; i < stones.Length; i++)
            {
                Assert.That(stones[i].position.x, Is.EqualTo(rest[i].x).Within(.0001f));
                if (!snapshot.values[i].HasValue) Assert.That(stones[i].gameObject.activeSelf, Is.False);
            }
            var occupiedColumns = BoardTopology.For(level).columns
                .Where(column => column.Any(i => snapshot.values[i].HasValue)).ToArray();
            int firstArrival = -1, lastArrival = -1;
            var touchedDown = new bool[stones.Length];
            bool bounced = false, stretched = false, squashed = false;
            for (int frame = 0; frame <= 120; frame++)
            {
                board.SetEntranceFill(frame / 120f);
                if (firstArrival < 0 && occupiedColumns.First().Any(i => stones[i].gameObject.activeSelf)) firstArrival = frame;
                if (lastArrival < 0 && occupiedColumns.Last().Any(i => stones[i].gameObject.activeSelf)) lastArrival = frame;
                for (int i = 0; i < stones.Length; i++)
                {
                    if (!stones[i].gameObject.activeSelf) continue;
                    float height = stones[i].position.y - rest[i].y;
                    Vector3 scale = stones[i].localScale;
                    stretched |= height > .15f && scale.y > restScale[i].y * 1.04f;
                    squashed |= Mathf.Abs(height) < .01f && scale.y < restScale[i].y * .94f &&
                        scale.x > restScale[i].x * 1.03f;
                    bounced |= touchedDown[i] && height > .04f;
                    touchedDown[i] |= Mathf.Abs(height) < .002f;
                }
            }
            Assert.That(firstArrival, Is.GreaterThanOrEqualTo(0));
            Assert.That(lastArrival, Is.GreaterThan(firstArrival));
            Assert.That(bounced, Is.True);
            Assert.That(stretched && squashed, Is.True);
            board.Cancel(snapshot);
            for (int i = 0; i < stones.Length; i++)
            {
                Assert.That(stones[i].position, Is.EqualTo(rest[i]));
                Assert.That(stones[i].localScale, Is.EqualTo(restScale[i]));
                Assert.That(stones[i].localRotation, Is.EqualTo(restRotation[i]));
                Assert.That(stones[i].gameObject.activeSelf, Is.EqualTo(snapshot.values[i].HasValue));
            }
        }
    }
}
