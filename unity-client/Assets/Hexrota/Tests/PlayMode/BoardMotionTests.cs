using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Application;
using Hexrota.Gameplay;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Hexrota.UnityClientTests
{
    public sealed class BoardMotionTests
    {
        private Func<UnityGameSession> original;
        private FirstPlayableController game;
        private Transform world;

        [UnitySetUp]
        public IEnumerator Open()
        {
            original = FirstPlayableController.SessionFactory;
            var storage = new MemoryProfileStorage();
            FirstPlayableController.SessionFactory = () => new UnityGameSession(ClientGameData.FromResources(), storage, new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            // The archived fixture has a known first-wave survivor for this motion test.
            game.BeginStage(0);
            yield return ChapterEntryWait.Ready(game);
            world = game.gameObject.scene.GetRootGameObjects().Single(obj => obj.name == "BoardVisuals_PLACEHOLDER").transform;
        }

        [UnityTearDown]
        public IEnumerator Close()
        {
            FirstPlayableController.SessionFactory = original;
            game.ReturnToMenu();
            yield return null;
        }

        private Transform Stone(int index) => world.Find("Stone_" + index);

        [UnityTest]
        public IEnumerator SwipeHandsTheSameStonesToTheCommittedWaveBeforeRelease()
        {
            var board = game.Board;
            var pair = game.Session.TutorialPair;
            var a = Stone(pair[0]);
            var b = Stone(pair[1]);
            Vector3 a0 = a.position, b0 = b.position;
            var pointer = new PointerEventData(EventSystem.current) { pointerId = -1 };
            pointer.position = board.BoardCamera.WorldToScreenPoint(a0);
            board.OnPointerDown(pointer);
            pointer.position = board.BoardCamera.WorldToScreenPoint(b0);

            var beforeFalls = new Dictionary<int, Transform>();
            var effects = world.Find("Effects");
            bool swapped = false, lingeringFx = false, identityLost = false;
            int movingSurvivors = 0;
            board.WaveProgress += (wave, ordinal, progress) => {
                if (ordinal != 1) return;
                lingeringFx |= effects.childCount != 0;
                if (progress == 0f)
                {
                    swapped = Stone(pair[0]) == b && Stone(pair[1]) == a;
                    foreach (var drop in wave.falls)
                        if (drop.from.HasValue) beforeFalls.Add(drop.to, Stone(drop.from.Value));
                }
                if (progress < .55f) return;
                foreach (var survivor in beforeFalls)
                    if (Stone(survivor.Key) != survivor.Value) identityLost = true;
                movingSurvivors = beforeFalls.Count;
            };
            board.OnDrag(pointer);
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(1));
            board.OnPointerUp(pointer);
            float deadline = Time.realtimeSinceStartup + 6;
            while (board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(board.IsAnimating, Is.False);
            Assert.That(swapped, Is.True);
            Assert.That(movingSurvivors, Is.Positive, "The first tutorial swap exercises a real survivor fall.");
            Assert.That(identityLost, Is.False, "Survivors must carry their mesh and number from the engine source.");
            Assert.That(lingeringFx, Is.False, "A matched cell must reveal its floor without a placeholder effect mesh.");
        }

        [UnityTest]
        public IEnumerator InterruptedOrOutOfBoardDragsRestoreBothStonesWithoutSpendingAMove()
        {
            var board = game.Board;
            var pair = game.Session.TutorialPair;
            var a = Stone(pair[0]);
            var b = Stone(pair[1]);
            Vector3 a0 = a.position, b0 = b.position;
            var p = new PointerEventData(EventSystem.current) { pointerId = -1 };
            foreach (bool cancel in new[] { true, false })
            {
                p.position = board.BoardCamera.WorldToScreenPoint(a0);
                board.OnPointerDown(p);
                Vector2 heading = board.BoardCamera.WorldToScreenPoint(b0) - board.BoardCamera.WorldToScreenPoint(a0);
                p.position += heading.normalized * 4f;
                board.OnDrag(p);
                Assert.That(a.position, Is.EqualTo(a0));
                if (cancel) board.OnCancel(p);
                else
                {
                    p.position = new Vector2(-100, -100);
                    board.OnDrag(p);
                    board.OnPointerUp(p);
                }
                Assert.That(a.position, Is.EqualTo(a0));
                Assert.That(b.position, Is.EqualTo(b0));
                Assert.That(game.Session.Snapshot.turn, Is.Zero);
                Assert.That(board.IsAnimating, Is.False);
                yield return null;
            }
        }

        [UnityTest]
        public IEnumerator StackedRefillsEnterOneRowApartBelowAnIntactCrate()
        {
            var level = new LevelConfig {
                id = 1, rulesVersion = "classic-v5", moves = 5, target = 10,
                cells = Enumerable.Range(0, 4).Select(r => new Cell { r = r }).ToArray(),
                initial = new int?[] { null, 1, 2, 3 }, palette = new[] { 1, 2, 3 },
                obstacles = new ObstaclesConfig { version = "obstacles-v1", regions = Array.Empty<RegionConfig>(),
                    blockers = new[] { new BlockerConfig { id = "crate", cell = 0, hp = 2 } } }
            };
            var engine = new HexMatch(level);
            var before = engine.Snapshot();
            int[] matched = { 1, 2 };
            var gravity = engine.Gravity(matched);
            var after = engine.Snapshot();
            Assert.That(gravity.falls.Count(f => f.spawn && f.spawnCount == 2), Is.EqualTo(2));
            var wave = new WaveFrame { matched = matched, before = before.values, after = after.values,
                layers = after.layers, falls = gravity.falls };
            var holder = new GameObject("Segment refill test");
            try
            {
                var board = holder.AddComponent<HexBoardView>();
                var catalog = Resources.FindObjectsOfTypeAll<HexrotaAssetCatalog>().First(c => c.stone != null);
                board.Initialize(null, catalog);
                board.Build(level, before);
                var segment = holder.scene.GetRootGameObjects().Single(obj => obj.name == world.name && obj.transform != world).transform;
                var top = segment.Find("Stone_1");
                var bottom = segment.Find("Stone_2");
                float row = top.position.y - bottom.position.y;
                float ceiling = top.position.y + row * .5f;
                bool seenInFlight = false, stacked = false, leaked = false;
                var block = new MaterialPropertyBlock();
                board.WaveProgress += (frame, ordinal, progress) => {
                    if (!top.gameObject.activeSelf) return;
                    var surface = top.Find("Model").GetComponent<MeshRenderer>();
                    surface.GetPropertyBlock(block);
                    if (Mathf.Abs(block.GetFloat("_SpawnCeiling") - ceiling) > .001f) return;
                    seenInFlight = true;
                    stacked |= Mathf.Abs(top.position.y - bottom.position.y - row) > .001f;
                    foreach (var stone in new[] { top, bottom })
                    foreach (var face in stone.GetComponentsInChildren<Renderer>())
                    {
                        face.GetPropertyBlock(block);
                        leaked |= !face.sharedMaterial.HasProperty("_SpawnCeiling") ||
                            Mathf.Abs(block.GetFloat("_SpawnCeiling") - ceiling) > .001f ||
                            (stone.position.y >= ceiling && block.GetFloat("_MotionOpacity") > .001f);
                    }
                };
                board.Present(new MovePresentation { A = -1, B = -1, Ok = true, Before = before,
                    After = after, Swap = new SwapResult { ok = true, frames = new[] { wave } } });
                float deadline = Time.realtimeSinceStartup + 4f;
                while (board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
                Assert.That(board.IsAnimating, Is.False);
                Assert.That(seenInFlight, Is.True, "Both the skin and numeral must receive the active segment mask.");
                Assert.That(stacked, Is.False, "Consecutive refills must retain a full row between their centres.");
                Assert.That(leaked, Is.False, "No ink may be shown above the segment ceiling.");
                Assert.That(segment.Find("Stone_0").gameObject.activeSelf, Is.False);
            }
            finally { UnityEngine.Object.Destroy(holder); }
        }
    }
}
