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
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    public sealed class OpeningLessonFeedbackTests : PlayModeTest
    {
        private Func<UnityGameSession> factory;
        private FirstPlayableController game;
        private ClientGameData data;
        private MemoryProfileStorage storage;

        [UnitySetUp]
        public IEnumerator StartCampaign()
        {
            factory = FirstPlayableController.SessionFactory;
            data = ClientGameData.FromResources();
            storage = new MemoryProfileStorage();
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, storage, new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(game.Session.SetPreferences(motion: "reduce"), Is.True);
            game.BeginJourney();
            yield return ChapterEntryWait.Ready(game);
        }

        [UnityTearDown]
        public IEnumerator CloseCampaign()
        {
            FirstPlayableController.SessionFactory = factory;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        [UnityTest]
        public IEnumerator HighlightShowsTheCommittedMatchAndTheSecondTurnIsFree()
        {
            var session = game.Session;
            var before = session.Snapshot;
            int[] pair = session.OpeningLessonPair;
            var model = new HexMatch(session.Level, before);
            var bright = session.OpeningLessonMatchIndices.Concat(pair).Distinct().ToArray();
            Assert.That(bright, Has.Length.EqualTo(4), "Only the carried stone and its three-cell line should be bright.");
            var props = new MaterialPropertyBlock();
            for (int i = 0; i < before.values.Length; i++)
            {
                if (!before.values[i].HasValue) continue;
                GameObject.Find("Stone_" + i).transform.Find("Model").GetComponent<MeshRenderer>().GetPropertyBlock(props);
                Assert.That(props.GetFloat("_GuideOpacity"), Is.EqualTo(bright.Contains(i) ? 1f : .30f).Within(.01f), "Stone_" + i);
            }
            var guide = game.GetComponentInChildren<OpeningLessonView>();
            Assert.That(guide, Is.Not.Null);
            Assert.That(guide.GetComponentsInChildren<Graphic>().All(graphic => !graphic.raycastTarget), Is.True);
            Assert.That(GameObject.Find("OpeningCopy").GetComponent<Text>().text, Does.Contain(before.values[pair[0]].Value.ToString()));
            Assert.That(GameObject.Find("HudWash"), Is.Not.Null);
            Assert.That(GameObject.Find("GestureArrow"), Is.Not.Null);

            var other = model.LegalMoves().First(move => !(pair.Contains(move[0]) && pair.Contains(move[1])));
            game.RequestSwap(other[0], other[1]);
            Assert.That(session.Snapshot.turn, Is.EqualTo(before.turn));
            Assert.That(session.Snapshot.movesLeft, Is.EqualTo(before.movesLeft));
            game.RequestSwap(pair[1], pair[0]);
            yield return null;
            Assert.That(session.Snapshot.turn, Is.EqualTo(1));
            Assert.That(session.Snapshot.movesLeft, Is.EqualTo(before.movesLeft - 1));
            Assert.That(GameObject.Find("HudWash"), Is.Null);
            Assert.That(GameObject.Find("GestureArrow"), Is.Null);
            Assert.That(GameObject.Find("OpeningHeading").GetComponent<Text>().text, Is.EqualTo("Toprağı yeşert"));
            Assert.That(game.Board.InputEnabled, Is.True);

            var next = new HexMatch(session.Level, session.Snapshot).LegalMoves()[0];
            game.RequestSwap(next[0], next[1]);
            Assert.That(session.Snapshot.turn, Is.EqualTo(2));
            Assert.That(guide.gameObject.activeSelf, Is.False);
        }

        [UnityTest]
        public IEnumerator RemovingTheCoachViewReleasesItsInputAndDimming()
        {
            var session = game.Session;
            var pair = session.OpeningLessonPair;
            var match = session.OpeningLessonMatchIndices.Concat(pair).ToArray();
            var before = session.Snapshot;
            int dimmed = Enumerable.Range(0, session.Level.cells.Length)
                .First(i => before.values[i].HasValue && !match.Contains(i));
            var other = new HexMatch(session.Level, before).LegalMoves()
                .First(move => !(pair.Contains(move[0]) && pair.Contains(move[1])));
            UnityEngine.Object.Destroy(game.GetComponentInChildren<OpeningLessonView>().gameObject);
            yield return null;
            yield return null;
            var props = new MaterialPropertyBlock();
            GameObject.Find("Stone_" + dimmed).transform.Find("Model").GetComponent<MeshRenderer>().GetPropertyBlock(props);
            Assert.That(props.GetFloat("_GuideOpacity"), Is.EqualTo(1f));
            game.RequestSwap(other[0], other[1]);
            Assert.That(session.Snapshot.turn, Is.EqualTo(1));
        }

        [UnityTest]
        public IEnumerator LaterChaptersIntroduceMechanicsOnlyWhereTheyFirstAppear()
        {
            game.ReturnToMenu();
            var session = game.Session;
            string[] headings = { "Üç aynı sayıyı hizala", null, "Çift katlı zemin", null, null,
                "Kasaların yolunu aç", null, "5 taşı", null, null };
            for (int chapter = 0; chapter < headings.Length; chapter++)
            {
                game.BeginStage(session.TutorialCount + chapter);
                yield return ChapterEntryWait.Ready(game);
                var copy = GameObject.Find("OpeningHeading");
                Assert.That(copy == null ? null : copy.GetComponent<Text>().text, Is.EqualTo(headings[chapter]), "B" + (chapter + 1));
                if (chapter > 0 && headings[chapter] != null)
                {
                    Assert.That(GameObject.Find("HudWash"), Is.Null);
                    Assert.That(GameObject.Find("GestureArrow"), Is.Null);
                    game.Pause();
                    game.Resume();
                    Assert.That(GameObject.Find("OpeningHeading"), Is.Null);
                }
                var route = Route(session);
                game.RequestSwap(route[0][0], route[0][1]);
                Assert.That(session.Snapshot.turn, Is.EqualTo(1));
                Assert.That(session.ChapterMechanicLesson, Is.EqualTo(UnityGameSession.MechanicLesson.None));
                foreach (var pair in route.Skip(1))
                {
                    Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True, "B" + (chapter + 1));
                    session.CompletePresentation();
                }
                Assert.That(session.Status, Is.EqualTo("won"));
                game.ReturnToMenu();
            }
        }

        [UnityTest]
        public IEnumerator ClassicChapterSixWithoutCratesGetsNoCrateLesson()
        {
            game.ReturnToMenu();
            data = ClientGameData.FromResources(false);
            storage = new MemoryProfileStorage();
            var session = new UnityGameSession(data, storage, new SystemUtcClock());
            for (int stage = session.TutorialCount; stage < session.TutorialCount + 5; stage++)
            {
                Assert.That(session.EnterStage(stage), Is.True, session.LastError);
                foreach (var pair in Route(session))
                {
                    Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True, session.LastError);
                    session.CompletePresentation();
                }
                session.ReturnToMenu();
            }
            Assert.That(session.EnterStage(session.TutorialCount + 5), Is.True);
            string id = session.AttemptId;
            session.ReturnToMenu();
            // Restore this archived attempt with the same catalog a current installation uses.
            data = ClientGameData.FromResources();
            session = new UnityGameSession(data, storage, new SystemUtcClock());
            Assert.That(session.SetPreferences(motion: "reduce"), Is.True);
            game.ConfigureSession(session);
            game.BeginStage(session.TutorialCount + 5);
            yield return ChapterEntryWait.Ready(game);
            Assert.That(session.AttemptId, Is.EqualTo(id));
            Assert.That(session.Level.obstacles, Is.Null);
            Assert.That(session.ChapterMechanicLesson, Is.EqualTo(UnityGameSession.MechanicLesson.None));
            Assert.That(GameObject.Find("OpeningHeading"), Is.Null);
        }

        private int[][] Route(UnityGameSession session)
        {
            var attempts = W.Required(W.Required(storage.Read(ProfileRepository.ProfileKey), "game"), "attempts");
            var identity = W.Required(attempts, session.ActiveStage.ToString());
            var level = data.Catalog.ResolveLevelWire(W.Required(identity, "levelId"),
                (string)W.Required(identity, "variantId"), (string)W.Required(identity, "levelDataVersion"));
            return W.List(level["solution"]).Select(step => W.List(step).Select(W.Int32).ToArray()).ToArray();
        }
    }
}
