using System;
using System.Collections;
using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;
using System.Linq;

namespace Hexrota.UnityClientTests
{
    public sealed class CampaignJourneyTests
    {
        private Func<UnityGameSession> original;
        private FirstPlayableController controller;
        private MemoryProfileStorage storage;

        [UnitySetUp] public IEnumerator StartScene()
        {
            original = FirstPlayableController.SessionFactory;
            storage = new MemoryProfileStorage();
            FirstPlayableController.SessionFactory = () => new UnityGameSession(ClientGameData.FromResources(), storage, new SystemUtcClock());
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

        private IEnumerator Move(int[] pair)
        {
            int turn = controller.Session.Snapshot.turn;
            controller.RequestSwap(pair[0], pair[1]);
            float end = Time.realtimeSinceStartup + 12;
            while (controller.Board.IsAnimating && Time.realtimeSinceStartup < end) yield return null;
            Assert.That(controller.Board.IsAnimating, Is.False);
            Assert.That(controller.Session.Snapshot.turn, Is.EqualTo(turn + 1));
        }

        [UnityTest] public IEnumerator StartButtonRestoresTutorialAcknowledgementAndLeadsThroughBothLessonsToCampaign()
        {
            var start = controller.GetComponentsInChildren<Button>().Single(b => b.name == "PlayButton");
            Assert.That(controller.Session.FirstOpening, Is.True);
            start.onClick.Invoke();
            var sceneArt = controller.GetComponentsInChildren<RawImage>().Single(i => i.name == "CoopLandscape");
            Assert.That(sceneArt.texture.name, Is.EqualTo("foundation"));
            Assert.That(controller.Session.FirstOpening, Is.False);
            Func<string, string> text = name => controller.GetComponentsInChildren<Text>().Single(label => label.name == name).text;
            Assert.That(text("CoachHeading"), Is.EqualTo("ADIM 1 / 3"));
            Assert.That(text("LessonCounter"), Is.EqualTo("Tahta 0/3"));
            Assert.That(text("LessonTitle"), Is.EqualTo("2’yi 1’in yerine kaydır"));
            Assert.That(text("LessonCopy"), Is.EqualTo("Aynı sayıdan üç taş yan yana gelsin."));
            Assert.That(controller.Session.ActiveStage, Is.Zero);
            for (int stage = 0; stage < 2; stage++)
            {
                if (stage == 1) Assert.That(text("LessonCounter"), Is.EqualTo("Çivi 0/4"));
                for (int turn = 0; turn < (stage == 0 ? 3 : 4); turn++)
                {
                    var pair = controller.Session.TutorialPair;
                    Assert.That(pair, Has.Length.EqualTo(2));
                    // Build disposes the previous stage's visual root at end of frame.
                    yield return null;
                    var focus = pair.Concat(controller.Session.TutorialMatchIndices).ToArray();
                    for (int i = 0; i < controller.Session.Level.cells.Length; i++)
                    {
                        var label = GameObject.Find("Value_" + i).GetComponent<TextMesh>();
                        Assert.That(label.color.a, Is.EqualTo(focus.Contains(i) ? 1f : .30f).Within(.01f),
                            "Tutorial focus for cell " + i);
                    }
                    yield return Move(pair);
                    if (controller.Session.NeedsTutorialAcknowledgement)
                    {
                        Assert.That(controller.Board.InputEnabled, Is.False);
                        if (stage == 0 && turn == 0)
                        {
                            yield return Load();
                            Assert.That(controller.Session.FirstOpening, Is.False, "A committed turn survives scene reload.");
                            start = controller.GetComponentsInChildren<Button>().Single(b => b.name == "PlayButton");
                            start.onClick.Invoke();
                            sceneArt = controller.GetComponentsInChildren<RawImage>().Single(i => i.name == "CoopLandscape");
                            Assert.That(text("CoachHeading"), Is.EqualTo("BU HAMLEDE"));
                            Assert.That(text("LessonCounter"), Is.EqualTo("Tahta 1/3"));
                            Assert.That(text("LessonTitle"), Is.EqualTo("İlk eşleşmen!"));
                            Assert.That(text("LessonCopy"), Does.Contain("2 + 2 + 2 = 6 puan."));
                            Assert.That(controller.Session.Snapshot.turn, Is.EqualTo(1));
                            Assert.That(controller.Session.NeedsTutorialAcknowledgement, Is.True);
                        }
                        controller.AcknowledgeTutorial();
                        Assert.That(controller.Board.InputEnabled, Is.True);
                    }
                }
                Assert.That(controller.CurrentScreen, Is.EqualTo("result"));
                Assert.That(text("ModalTitle"), Is.EqualTo(stage == 0 ? "İlk alan yeşerdi!" : "İlk hediyen hazır!"));
                var resultArt = controller.GetComponentsInChildren<RawImage>()
                    .Single(image => image.name == (stage == 0 ? "VictoryMark" : "WelcomeChest"));
                Assert.That(resultArt.texture, Is.Not.Null);
                Assert.That(controller.Session.IsStageComplete(stage), Is.True);
                Assert.That(sceneArt.texture.name, Is.EqualTo(stage == 0 ? "frame" : "finished"));
                controller.ContinueAfterWin();
                if (stage==1)
                {
                    Assert.That(controller.CurrentScreen, Is.EqualTo("preview"));
                    var begin = controller.GetComponentsInChildren<Button>().Single(b => b.name == "Başla");
                    begin.onClick.Invoke();
                }
                Assert.That(controller.Session.ActiveStage, Is.EqualTo(stage + 1));
            }
            Assert.That(controller.Session.Level.id.ToString(), Is.EqualTo("1"));
            Assert.That(controller.Session.IsTutorial, Is.False);
            controller.ReturnToMenu();
            var home = controller.GetComponentInChildren<CastleHomeView>();
            var wallet = controller.Session.ReadPhoneWallet();
            Assert.That(wallet.Gold, Is.Positive, "Completing the lessons awards the real welcome gift.");
            var balance = home.GetComponentsInChildren<Text>().Single(label => label.name == "GoldValue");
            Assert.That(balance.text, Is.EqualTo(wallet.Gold.ToString()));
            controller.OpenJourney();
            Assert.That(controller.CurrentScreen, Is.EqualTo("journey"));
            controller.OpenGarden();
            Assert.That(controller.CurrentScreen, Is.EqualTo("garden"));
            var garden = controller.GetComponentsInChildren<RawImage>().Single(i => i.name == "GardenIllustration");
            Assert.That(garden.texture.name, Is.EqualTo("soil"));
            LogAssert.NoUnexpectedReceived();
        }
    }
}
