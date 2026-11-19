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
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace Hexrota.UnityClientTests
{
    public sealed class MatchScoreFlightTests
    {
        private Func<UnityGameSession> original;
        private FirstPlayableController game;
        private RectTransform packet;
        private Text amount, counter;
        private Transform world;

        [UnitySetUp]
        public IEnumerator SetUp()
        {
            original = FirstPlayableController.SessionFactory;
            var store = new MemoryProfileStorage();
            FirstPlayableController.SessionFactory = () => new UnityGameSession(
                ClientGameData.FromResources(), store, new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            packet = (RectTransform)game.GetComponentInChildren<ScorePacketView>(true).transform;
            amount = packet.Find("PacketGain").GetComponent<Text>();
            counter = game.GetComponentsInChildren<Text>(true).Single(label => label.name == "Counters");
            world = game.gameObject.scene.GetRootGameObjects()
                .Single(root => root.name == "BoardVisuals_PLACEHOLDER").transform;
        }

        [UnityTearDown]
        public IEnumerator TearDown()
        {
            FirstPlayableController.SessionFactory = original;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        private Vector2 Cell(int index)
        {
            var cell = game.Session.Level.cells[index];
            return MobileLayout.Axial(cell.q, cell.r);
        }

        private static Vector2 OnScreen(RectTransform item)
        {
            return RectTransformUtility.WorldToScreenPoint(null, item.TransformPoint(item.rect.center));
        }

        [UnityTest]
        public IEnumerator RealStonesMergeThenOneGainFliesToTheCounterBeforeItsImpact()
        {
            game.BeginLevelOne();
            yield return ChapterEntryWait.Ready(game);
            yield return ChapterEntryWait.PlayOpeningMove(game);
            var model = new HexMatch(game.Session.Level, game.Session.Snapshot);
            var pair = model.LegalMoves().First(move => model.Clone().Swap(move[0], move[1])
                .frames[0].falls.Any(drop => drop.from.HasValue));
            int startScore = game.Session.Snapshot.score;
            var result = model.Swap(pair[0], pair[1]);
            var frame = result.frames[0];
            Vector2 center = Vector2.zero;
            foreach (int cell in frame.matched) center += Cell(cell);
            center /= frame.matched.Length;
            float initialSpread = frame.matched.Sum(cell => Vector2.Distance(Cell(cell), center));
            float minSpread = initialSpread;
            Vector2 centerPx = game.Board.BoardCamera.WorldToScreenPoint(center);
            Vector2 goalPx = OnScreen(counter.rectTransform);
            float travel = Vector2.Distance(centerPx, goalPx);
            float closest = travel, centerError = travel, launchScale = 0f, impactScale = 1f;
            float rest = counter.rectTransform.lossyScale.x;
            bool movedInFlight = false, earlyCredit = false, wrongAmount = false, falling = false;
            var labels = game.GetComponentInChildren<CastleHudView>().GetComponentsInChildren<Text>();
            var moves = labels.Single(label => label.name == "Moves");
            var green = labels.Single(label => label.name == "GroundCount");
            string initialGround = green.text;
            string waveGround = frame.layers.Count(layer => layer == 0) + " / " + frame.layers.Length;
            bool groundOutOfSync = false;
            var firstDropPose = new Dictionary<int, float>();
            var columnStarts = new Dictionary<int, float>();
            var contacted = new HashSet<int>();
            bool bounced = false;
            game.Board.WaveProgress += (wave, ordinal, phase) => {
                if (ordinal != 1) return;
                groundOutOfSync |= green.text != (phase < .29f ? initialGround : waveGround);
                if (phase < .29f)
                {
                    float spread = 0;
                    foreach (int cell in wave.matched)
                        spread += Vector2.Distance(world.Find("Stone_" + cell).position, center);
                    minSpread = Mathf.Min(minSpread, spread);
                }
                else
                {
                    foreach (var fall in wave.falls)
                    {
                        var stone = world.Find("Stone_" + fall.to);
                        float y = stone.position.y;
                        if (!firstDropPose.TryGetValue(fall.to, out float firstY)) firstDropPose.Add(fall.to, y);
                        else if (y < firstY - .005f)
                        {
                            int column = game.Session.Level.cells[fall.to].q;
                            if (!columnStarts.ContainsKey(column)) columnStarts.Add(column, phase);
                        }
                        float height = y - Cell(fall.to).y;
                        bounced |= contacted.Contains(fall.to) && height > .035f;
                        if (Mathf.Abs(height) < .004f) contacted.Add(fall.to);
                    }
                }
                if (packet.gameObject.activeInHierarchy)
                {
                    earlyCredit |= !counter.text.StartsWith(startScore + " /", StringComparison.Ordinal);
                    wrongAmount |= amount.text != "+" + frame.scoreGain;
                    Vector2 position = OnScreen(amount.rectTransform);
                    float toGoal = Vector2.Distance(position, goalPx);
                    closest = Mathf.Min(closest, toGoal);
                    centerError = Mathf.Min(centerError, Vector2.Distance(position, centerPx));
                    launchScale = Mathf.Max(launchScale, packet.localScale.x);
                    movedInFlight |= toGoal > travel * .25f && toGoal < travel * .75f;
                    if (phase > .34f)
                    {
                        foreach (var fall in wave.falls)
                        {
                            if (!fall.from.HasValue) continue;
                            float y = world.Find("Stone_" + fall.to).position.y;
                            falling |= y < Cell(fall.from.Value).y - .02f && y > Cell(fall.to).y + .02f;
                        }
                    }
                }
                if (counter.text.StartsWith((startScore + frame.scoreGain) + " /", StringComparison.Ordinal))
                    impactScale = Mathf.Max(impactScale, counter.rectTransform.lossyScale.x / rest);
            };
            game.RequestSwap(pair[0], pair[1]);
            Assert.That(moves.text, Is.EqualTo(game.Session.Snapshot.movesLeft.ToString()));
            float deadline = Time.realtimeSinceStartup + 12f;
            while (game.Board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;

            Assert.That(game.Board.IsAnimating, Is.False);
            Assert.That(minSpread, Is.LessThan(initialSpread * .38f), "The actual matched skins must approach one another.");
            Assert.That(centerError, Is.LessThan(3f), "The visible digits must originate at the board-space centroid.");
            Assert.That(launchScale, Is.GreaterThan(1.12f));
            Assert.That(movedInFlight && falling, Is.True, "Gravity overlaps the score, with distinct intermediate positions.");
            Assert.That(columnStarts.Count, Is.GreaterThan(1));
            Assert.That(columnStarts.OrderBy(start => start.Key).Select(start => start.Value).Last(),
                Is.GreaterThan(columnStarts.OrderBy(start => start.Key).Select(start => start.Value).First()));
            Assert.That(bounced, Is.True);
            Assert.That(closest, Is.LessThan(travel * .08f), "The amount must reach the visible score counter.");
            Assert.That(earlyCredit || wrongAmount || groundOutOfSync, Is.False);
            Assert.That(impactScale, Is.GreaterThan(1.10f), "The scored counter must pop on impact.");
            Assert.That(counter.rectTransform.lossyScale.x, Is.EqualTo(rest).Within(.001f));
            Assert.That(packet.gameObject.activeInHierarchy, Is.False);
            Assert.That(game.Session.Snapshot.score, Is.EqualTo(startScore + result.scoreGain));
            Assert.That(counter.text, Does.StartWith(game.Session.Snapshot.score + " /"));
        }

        [UnityTest]
        public IEnumerator ARealCascadeDeliversEachWaveOnceToTheSameCounter()
        {
            game.BeginLevelOne();
            yield return ChapterEntryWait.Ready(game);
            yield return ChapterEntryWait.PlayOpeningMove(game);
            var initial = new HexMatch(game.Session.Level, game.Session.Snapshot);
            int[][] route = null;
            for (int depth = 1; depth <= 3 && route == null; depth++)
                route = FindCascade(initial, depth);
            Assert.That(route, Is.Not.Null, "Use a genuine multi-wave continuation in the first chapter.");
            for (int i = 0; i < route.Length - 1; i++)
            {
                game.Board.ReducedMotion = true;
                game.RequestSwap(route[i][0], route[i][1]);
            }
            game.Board.ReducedMotion = false;
            int[] pair = route[route.Length - 1];
            var start = game.Session.Snapshot;
            var result = new HexMatch(game.Session.Level, start).Swap(pair[0], pair[1]);
            Assert.That(result.frames.Length, Is.GreaterThan(1));

            var expectedCounters = new List<string>();
            int runningScore = start.score;
            foreach (var wave in result.frames)
            {
                runningScore += wave.scoreGain;
                expectedCounters.Add(runningScore + " / " + game.Session.Level.target);
            }
            var arrivals = new List<string>();
            var gains = new string[result.frames.Length];
            string previousCounter = counter.text;
            bool creditedInFlight = false;
            game.Board.WaveProgress += (wave, number, phase) => {
                if (packet.gameObject.activeInHierarchy)
                {
                    gains[number - 1] = amount.text;
                    creditedInFlight |= counter.text == expectedCounters[number - 1];
                }
                if (counter.text == previousCounter) return;
                arrivals.Add(counter.text);
                previousCounter = counter.text;
            };

            game.RequestSwap(pair[0], pair[1]);
            float deadline = Time.realtimeSinceStartup + 15f;
            while (game.Board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(game.Board.IsAnimating, Is.False);
            Assert.That(creditedInFlight, Is.False);
            CollectionAssert.AreEqual(result.frames.Select(wave => "+" + wave.scoreGain).ToArray(), gains);
            CollectionAssert.AreEqual(expectedCounters, arrivals);
            Assert.That(game.Session.Snapshot.score, Is.EqualTo(start.score + result.scoreGain));
        }

        private static int[][] FindCascade(HexMatch model, int depth)
        {
            foreach (int[] pair in model.LegalMoves())
            {
                var next = model.Clone();
                var result = next.Swap(pair[0], pair[1]);
                if (result.frames.Length > 1) return new[] { pair };
                if (depth <= 1 || next.Status != "playing") continue;
                var rest = FindCascade(next, depth - 1);
                if (rest != null) return new[] { pair }.Concat(rest).ToArray();
            }
            return null;
        }

        [UnityTest]
        public IEnumerator ReducedMotionAppliesTheExactScoreWithoutPlayingTheCollectionOrFlight()
        {
            Assert.That(game.Session.SetPreferences(motion: "reduce"), Is.True);
            game.BeginLevelOne();
            yield return ChapterEntryWait.Ready(game);
            var pair = game.Session.OpeningLessonPair;
            int score = game.Session.Snapshot.score;
            var plan = new HexMatch(game.Session.Level, game.Session.Snapshot).Swap(pair[0], pair[1]);
            int animatedFrames = 0;
            game.Board.WaveProgress += (wave, number, phase) => animatedFrames++;
            game.RequestSwap(pair[0], pair[1]);
            yield return null;
            Assert.That(animatedFrames, Is.Zero);
            Assert.That(game.Board.IsAnimating || packet.gameObject.activeInHierarchy, Is.False);
            Assert.That(game.Session.Snapshot.score, Is.EqualTo(score + plan.scoreGain));
            Assert.That(counter.text, Does.StartWith((score + plan.scoreGain) + " /"));
        }
    }
}
