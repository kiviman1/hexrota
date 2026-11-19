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
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    public sealed class CampaignJourneyTests
    {
        private Func<UnityGameSession> original;
        private FirstPlayableController controller;
        private MemoryProfileStorage storage;
        private ClientGameData data;

        [UnitySetUp] public IEnumerator StartScene()
        {
            original = FirstPlayableController.SessionFactory;
            storage = new MemoryProfileStorage();
            data = ClientGameData.FromResources();
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, storage, new SystemUtcClock());
            yield return Load();
        }

        private IEnumerator Load()
        {
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            controller = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(controller.Session, Is.Not.Null);
            yield return null;
        }

        [UnityTearDown] public IEnumerator Finish()
        {
            FirstPlayableController.SessionFactory = original;
            if (controller != null) controller.ReturnToMenu();
            yield return null;
        }

        private void Click(string name)
        {
            controller.GetComponentsInChildren<Button>().Single(b => b.name == name).onClick.Invoke();
        }

        [UnityTest]
        public IEnumerator HomePlayTeachesOnChapterOneAndTheSameSavedBoardWinsAndLeadsToChapterTwo()
        {
            Assert.That(controller.Session.FirstOpening, Is.True);
            Click("PlayButton");
            yield return ChapterEntryWait.Ready(controller);
            int first = controller.Session.TutorialCount;
            Assert.That(controller.Session.ActiveStage, Is.EqualTo(first));
            Assert.That(controller.Session.Level.id.ToString(), Is.EqualTo("1"));
            string attemptId = controller.Session.AttemptId;
            var attempts = W.Required(W.Required(storage.Read(ProfileRepository.ProfileKey), "game"), "attempts");
            var metadata = W.Required(attempts, first.ToString());
            var level = data.Catalog.ResolveLevelWire(W.Required(metadata, "levelId"), (string)W.Required(metadata, "variantId"),
                (string)W.Required(metadata, "levelDataVersion"));
            var openings = W.List(level["solutions"]).Select(line => W.List(line)
                .Select(step => W.List(step).Select(W.Int32).ToArray()).ToArray());
            var pair = controller.Session.OpeningLessonPair;
            var route = openings.First(line => line[0].OrderBy(i => i).SequenceEqual(pair.OrderBy(i => i)));
            yield return ChapterEntryWait.PlayOpeningMove(controller);
            var checkpoint = controller.Session.Snapshot;
            controller.ReturnToMenu();
            yield return Load();
            Click("PlayButton");
            yield return ChapterEntryWait.Ready(controller);
            Assert.That(controller.Session.ActiveStage, Is.EqualTo(first));
            Assert.That(controller.Session.AttemptId, Is.EqualTo(attemptId));
            Assert.That(controller.Session.Snapshot.turn, Is.EqualTo(checkpoint.turn));
            CollectionAssert.AreEqual(checkpoint.values, controller.Session.Snapshot.values);
            Assert.That(controller.Session.OpeningLessonPair, Is.Null);

            foreach (var step in route.Skip(1))
            {
                int turn = controller.Session.Snapshot.turn;
                controller.RequestSwap(step[0], step[1]);
                Assert.That(controller.Session.Snapshot.turn, Is.EqualTo(turn + 1));
                float deadline = Time.realtimeSinceStartup + 12f;
                while (controller.Board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
                Assert.That(controller.Board.IsAnimating, Is.False);
            }

            float resultDeadline = Time.realtimeSinceStartup + 6f;
            while (controller.CurrentScreen != "result" && Time.realtimeSinceStartup < resultDeadline) yield return null;
            Assert.That(controller.CurrentScreen, Is.EqualTo("result"));
            Assert.That(controller.Session.Status, Is.EqualTo("won"));
            Assert.That(controller.Session.IsStageComplete(first), Is.True);
            var wallet = controller.Session.ReadPhoneWallet();
            Assert.That(wallet.GoldenEggs, Is.Positive);
            Assert.That(wallet.Gold, Is.Positive);

            Click("Bölüm 02 ile devam et");
            Assert.That(controller.CurrentScreen, Is.EqualTo("preview"));
            yield return null;
            Click("Başla");
            yield return ChapterEntryWait.Ready(controller);
            Assert.That(controller.Session.ActiveStage, Is.EqualTo(first + 1));
            Assert.That(controller.Session.OpeningLessonPair, Is.Null);
            controller.ReturnToMenu();
            var home = controller.GetComponentInChildren<CastleHomeView>();
            Assert.That(home.GetComponentsInChildren<Text>().Single(t => t.name == "GoldValue").text, Is.EqualTo(wallet.Gold.ToString()));
            controller.OpenGarden();
            Assert.That(controller.GetComponentsInChildren<RawImage>().Single(i => i.name == "GardenIllustration").texture.name,
                Is.EqualTo(controller.Session.GardenTier));
            LogAssert.NoUnexpectedReceived();
        }
    }
}
