using System;
using System.Collections;
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
            Assert.That(labels.Single(label => label.name == "LevelTitle").text, Is.EqualTo(game.Session.StageName(game.Session.ActiveStage)));
            string[] stones = { "Purple", "Yellow", "LightRed", "Turquoise", "Orange" };
            for (int i = 0; i < snapshot.values.Length; i++)
            {
                var stone = GameObject.Find("Stone_" + i);
                var digit = stone.GetComponentInChildren<TextMesh>();
                Assert.That(snapshot.values[i].HasValue, Is.True, stone.name);
                Assert.That(digit.text, Is.EqualTo(snapshot.values[i].ToString()), stone.name);
                var stoneModel = stone.transform.Find("Model");
                Assert.That(stoneModel, Is.Not.Null, stone.name);
                Assert.That(stoneModel.GetComponent<MeshFilter>().sharedMesh, Is.Not.Null, stone.name);
                Assert.That(stoneModel.GetComponent<MeshRenderer>().sharedMaterial.mainTexture.name,
                    Does.Contain(stones[snapshot.values[i].Value - 1]), stone.name);
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
            yield return null;
            Assert.That(game.Session.ActiveStage, Is.Zero);
            CheckHudAndBoard();
            int previousMoves = game.Session.Snapshot.movesLeft;
            int[] pair = game.Session.TutorialPair;
            game.RequestSwap(pair[0], pair[1]);
            float deadline = Time.realtimeSinceStartup + 15;
            while (game.Board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(game.Board.IsAnimating, Is.False);
            Assert.That(game.Session.Snapshot.movesLeft, Is.EqualTo(previousMoves - 1));
            CheckHudAndBoard();
        }

        [UnityTest]
        public IEnumerator NumberedBoardKeepsOneHudAndTheCommittedMoveAcrossPauseAndMenu()
        {
            Click("PlayButton");
            Click("Geç");
            yield return null;
            Assert.That(game.Session.ActiveStage, Is.EqualTo(game.Session.TutorialCount));
            CheckHudAndBoard();
            int[] pair = new HexMatch(game.Session.Level, game.Session.Snapshot).LegalMoves()[0];
            game.RequestSwap(pair[0], pair[1]);
            Assert.That(game.Board.IsAnimating, Is.True);
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(1));
            Click("Mola");
            Assert.That(game.CurrentScreen, Is.EqualTo("paused"));
            Assert.That(game.Board.IsAnimating, Is.False);
            Click("Devam et");
            CheckHudAndBoard();
            game.ReturnToMenu();
            Assert.That(game.GetComponentInChildren<CastleHudView>(), Is.Null);
            Assert.That(game.GetComponentInChildren<CoopSceneArt>().GetComponentsInChildren<Transform>()
                .Any(part => part.name == "RoyalFelt"), Is.False);
            Click("PlayButton");
            yield return null;
            Assert.That(game.CurrentScreen, Is.EqualTo("playing"));
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(1));
            Assert.That(game.GetComponentsInChildren<CastleHudView>(true), Has.Length.EqualTo(1));
            CheckHudAndBoard();
        }
    }
}
