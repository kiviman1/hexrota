using System;
using System.Collections;
using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace Hexrota.UnityClientTests
{
    public sealed class CastleGameplayFlowTests
    {
        private Func<UnityGameSession> originalFactory;
        private FirstPlayableController game;

        [UnitySetUp]
        public IEnumerator OpenFirstPlayable()
        {
            originalFactory = FirstPlayableController.SessionFactory;
            var storage = new MemoryProfileStorage();
            FirstPlayableController.SessionFactory = () =>
                new UnityGameSession(ClientGameData.FromResources(), storage, new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            yield return null;
        }

        [UnityTearDown]
        public IEnumerator Close()
        {
            FirstPlayableController.SessionFactory = originalFactory;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        private void Click(string name)
        {
            game.GetComponentsInChildren<Button>().Single(button => button.name == name).onClick.Invoke();
        }

        private void CheckHudAndBoard()
        {
            var view = game.GetComponentsInChildren<CastleHudView>().Single();
            var tray = game.GetComponentInChildren<CoopSceneArt>().GetComponentsInChildren<Transform>()
                .Single(part => part.name == "RoyalFelt");
            Assert.That(tray.GetComponent<Image>().raycastTarget, Is.False);
            var labels = view.GetComponentsInChildren<Text>();
            var snapshot = game.Session.Snapshot;
            Assert.That(labels.Single(label => label.name == "Moves").text, Is.EqualTo(snapshot.movesLeft.ToString()));
            Assert.That(labels.Single(label => label.name == "Counters").text, Is.EqualTo(snapshot.score + " / " + game.Session.Level.target));
            Assert.That(labels.Single(label => label.name == "GroundCount").text, Is.EqualTo(snapshot.layers.Count(layer => layer == 0) + " / " + snapshot.layers.Length));
            Assert.That(labels.Any(label => label.name == "StageTag" || label.name == "LevelTitle"), Is.False);
            for (int i = 0; i < snapshot.values.Length; i++)
            {
                var stone = GameObject.Find("Stone_" + i);
                Assert.That(snapshot.values[i].HasValue, Is.True, stone.name);
                StoneArtAssertions.ShowsNumber(stone.transform, snapshot.values[i].Value);
                var ground = GameObject.Find("Ground_" + i);
                var floor = ground.transform.Find("Model").GetComponent<MeshRenderer>();
                string state = snapshot.layers[i] == 0 ? "Green" :
                    snapshot.layers[i] < game.Session.Level.cells[i].layers ? "Partial" : "Soil";
                Assert.That(floor.sharedMaterial.mainTexture.name, Does.Contain("HexFloor_" + state), ground.name);
            }
        }

        [UnityTest]
        public IEnumerator PlayShowsTutorialGoalsAndItsFirstSwapUpdatesEachVisibleLayer()
        {
            Click("PlayButton");
            yield return ChapterEntryWait.Ready(game);
            Assert.That(game.Session.ActiveStage, Is.EqualTo(game.Session.TutorialCount));
            CheckHudAndBoard();
            int previousMoves = game.Session.Snapshot.movesLeft;
            int[] pair = game.Session.OpeningLessonPair;
            game.RequestSwap(pair[0], pair[1]);
            float deadline = Time.realtimeSinceStartup + 15;
            while (game.Board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(game.Board.IsAnimating, Is.False);
            Assert.That(game.Session.Snapshot.movesLeft, Is.EqualTo(previousMoves - 1));
            CheckHudAndBoard();
        }

        [UnityTest]
        public IEnumerator TutorialGloveShowsTheSwipeWhileBothPlayableStonesStayOnTheirCells()
        {
            Click("PlayButton");
            yield return ChapterEntryWait.Ready(game);
            var tools = game.GetComponentInChildren<CastleGameToolsView>();
            var gesture = tools.transform.Find("GestureRegion");
            var hand = (RectTransform)gesture.Find("GuidePosition");
            Assert.That(gesture.gameObject.activeInHierarchy, Is.True);
            int[] pair = game.Session.OpeningLessonPair;
            var source = GameObject.Find("Stone_" + pair[0]).transform;
            var target = GameObject.Find("Stone_" + pair[1]).transform;
            Vector3 from = source.position, to = target.position;
            Vector3 sourceScale = source.localScale, targetScale = target.localScale;
            Vector2 displacement = game.Board.ViewportCell(pair[1]) - game.Board.ViewportCell(pair[0]);
            Vector2 handStart = hand.anchorMin;
            int turn = game.Session.Snapshot.turn;
            float furthest = 0;
            float until = Time.realtimeSinceStartup + 1.7f;
            while (Time.realtimeSinceStartup < until)
            {
                Assert.That(source.position, Is.EqualTo(from));
                Assert.That(target.position, Is.EqualTo(to));
                Assert.That(source.localScale, Is.EqualTo(sourceScale));
                Assert.That(target.localScale, Is.EqualTo(targetScale));
                furthest = Mathf.Max(furthest, Vector2.Dot(hand.anchorMin - handStart, displacement.normalized));
                yield return null;
            }
            Assert.That(furthest, Is.GreaterThan(displacement.magnitude * .7f));
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(turn));
            game.Pause();
            yield return null;
            Assert.That(gesture.gameObject.activeInHierarchy, Is.False);
        }

        [UnityTest]
        public IEnumerator TopSettingsKeepsOneHudAndTheCommittedMoveOnReturnToTheLevel()
        {
            Click("PlayButton");
            yield return ChapterEntryWait.Ready(game);
            Assert.That(game.Session.ActiveStage, Is.EqualTo(game.Session.TutorialCount));
            CheckHudAndBoard();
            int[] pair = game.Session.OpeningLessonPair;
            game.RequestSwap(pair[0], pair[1]);
            Assert.That(game.Board.IsAnimating, Is.True);
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(1));
            Click("Ayarlar");
            Assert.That(game.CurrentScreen, Is.EqualTo("settings"));
            Assert.That(game.Board.IsAnimating, Is.False);
            Click("Kapat");
            CheckHudAndBoard();
            Click("Ayarlar");
            Click("Bölümden çık");
            Assert.That(game.CurrentScreen, Is.EqualTo("menu"));
            Assert.That(game.GetComponentInChildren<CastleHudView>(), Is.Null);
            Assert.That(game.GetComponentInChildren<CoopSceneArt>().GetComponentsInChildren<Transform>()
                .Any(part => part.name == "RoyalFelt"), Is.False);
            Click("PlayButton");
            yield return ChapterEntryWait.Ready(game);
            Assert.That(game.CurrentScreen, Is.EqualTo("playing"));
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(1));
            Assert.That(game.GetComponentsInChildren<CastleHudView>(true), Has.Length.EqualTo(1));
            CheckHudAndBoard();
        }
    }
}
