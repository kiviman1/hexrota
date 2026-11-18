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
    public sealed class PhoneMenuNavigationTests
    {
        private Func<UnityGameSession> old;
        private FirstPlayableController controller;
        [UnitySetUp] public IEnumerator Open()
        {
            old=FirstPlayableController.SessionFactory;
            var memory=new MemoryProfileStorage();
            FirstPlayableController.SessionFactory=()=>new UnityGameSession(ClientGameData.FromResources(),memory,new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            controller=UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            yield return null;
        }
        [UnityTearDown] public IEnumerator Close()
        {
            FirstPlayableController.SessionFactory=old;
            if(controller!=null) controller.ReturnToMenu();
            yield return null;
        }

        private Button ButtonNamed(string name)
        {
            return controller.GetComponentsInChildren<Button>().First(b=>b.name==name);
        }

        [UnityTest] public IEnumerator ReturningMenuAndMapOpenReadOnlyGoalsBeforeStartingTheRealNumberedBoard()
        {
            Assert.That(controller.GetComponentsInChildren<RawImage>().Any(i=>i.texture!=null && i.texture.name=="wordmark"),Is.True);
            ButtonNamed("Başlayalım").onClick.Invoke();
            Assert.That(controller.Session.ActiveStage,Is.Zero);
            Assert.That(controller.Session.CompletedSceneTutorials,Is.Zero);
            controller.ReturnToMenu();
            Assert.That(controller.GetComponentsInChildren<ScrollRect>().Length,Is.Positive);
            ButtonNamed("Bölümler").onClick.Invoke();
            Assert.That(controller.CurrentScreen,Is.EqualTo("journey"));
            long revision=controller.Session.Revision;
            ButtonNamed("BÖLÜM 01").onClick.Invoke();
            Assert.That(controller.CurrentScreen,Is.EqualTo("preview"));
            Assert.That(controller.GetComponentsInChildren<Text>().Any(t=>t.text=="85"),Is.True);
            Assert.That(controller.Session.Revision,Is.EqualTo(revision));
            ButtonNamed("Kapat").onClick.Invoke();
            Assert.That(controller.CurrentScreen,Is.EqualTo("journey"));
            Assert.That(controller.Session.Revision,Is.EqualTo(revision));
            ButtonNamed("BÖLÜM 01").onClick.Invoke(); ButtonNamed("Başla").onClick.Invoke();
            Assert.That(controller.CurrentScreen,Is.EqualTo("playing"));
            Assert.That(controller.Session.ActiveStage,Is.EqualTo(2));
            Assert.That(controller.Session.CompletedSceneTutorials,Is.EqualTo(2));
            Assert.That(controller.Session.Snapshot.values.Length,Is.EqualTo(19));
            yield return null;
            LogAssert.NoUnexpectedReceived();
        }
    }
}
