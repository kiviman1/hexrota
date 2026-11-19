using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace Hexrota.UnityClientTests
{
    public sealed class MobileProgressPanelsTests
    {
        private Func<UnityGameSession> original;
        private FirstPlayableController scene;

        [UnitySetUp] public IEnumerator LoadScene()
        {
            original=FirstPlayableController.SessionFactory;
            var store=new MemoryProfileStorage();
            FirstPlayableController.SessionFactory=()=>new UnityGameSession(ClientGameData.FromResources(),store,new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            scene=UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            yield return null;
        }

        [UnityTearDown] public IEnumerator Restore()
        {
            FirstPlayableController.SessionFactory=original;
            if(scene!=null)scene.ReturnToMenu();
            yield return null;
        }

        private Button Button(string name) { return scene.GetComponentsInChildren<Button>().Single(b=>b.name==name); }
        private string Text(string name) { return scene.GetComponentsInChildren<Text>().Single(t=>t.name==name).text; }

        [UnityTest] public IEnumerator CastlePopupHeaderRemainsTappableWhileSettingsScrollAndPreviewUsesTheSameFrame()
        {
            scene.OpenMobileSettings();
            yield return null;
            Canvas.ForceUpdateCanvases();
            var shell=scene.GetComponentInChildren<CastlePopupChrome>();
            var title=shell.GetComponentsInChildren<Text>().Single(t=>t.name=="DialogTitle");
            var illustration=shell.GetComponentsInChildren<Image>().Single(i=>i.name=="Illustration");
            Assert.That(illustration.sprite,Is.Not.Null);
            Assert.That(illustration.raycastTarget,Is.False);
            var pattern=shell.GetComponentInChildren<CastlePopupPattern>();
            Assert.That(pattern.canvasRenderer.GetMesh().vertexCount,Is.Positive);
            var scroll=shell.GetComponentInChildren<ScrollRect>();
            Vector3 titlePosition=title.transform.position;
            scroll.verticalNormalizedPosition=0;
            yield return null;
            Assert.That(title.transform.position,Is.EqualTo(titlePosition));
            var close=shell.GetComponentsInChildren<Button>().Single(b=>b.name=="Kapat");
            var rect=(RectTransform)close.transform;
            var pointer=new PointerEventData(EventSystem.current) {
                position=RectTransformUtility.WorldToScreenPoint(null,rect.TransformPoint(rect.rect.center))
            };
            var hits=new List<RaycastResult>();
            EventSystem.current.RaycastAll(pointer,hits);
            Assert.That(hits,Is.Not.Empty);
            var hit=ExecuteEvents.GetEventHandler<IPointerClickHandler>(hits[0].gameObject);
            Assert.That(hit,Is.EqualTo(close.gameObject));
            ExecuteEvents.Execute(hit,pointer,ExecuteEvents.pointerClickHandler);
            Assert.That(scene.CurrentScreen,Is.EqualTo("menu"));
            long revision=scene.Session.Revision;
            scene.OpenMobilePreview(scene.Session.NextStage);
            yield return null;
            Assert.That(scene.GetComponentInChildren<CastlePopupChrome>().name,Is.EqualTo("GoalCard"));
            Assert.That(Text("ChapterTitle"),Is.EqualTo(scene.Session.StageName(scene.Session.NextStage)));
            Assert.That(Button("Başla").GetComponent<CastleBevel>(),Is.Not.Null);
            Button("Kapat").onClick.Invoke();
            Assert.That(scene.CurrentScreen,Is.EqualTo("menu"));
            Assert.That(scene.Session.Revision,Is.EqualTo(revision));
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest] public IEnumerator PauseResumeAndLockedInventoryUseTheCampaignBoard()
        {
            scene.BeginLevelOne();
            yield return ChapterEntryWait.Ready(scene);
            var board=scene.Session.Snapshot;
            scene.Pause();
            Assert.That(Text("ModalTitle"),Is.EqualTo("Rota seni bekler."));
            Assert.That(scene.Board.InputEnabled,Is.False);
            Button("Devam et").onClick.Invoke();
            Assert.That(scene.CurrentScreen,Is.EqualTo("playing"));
            Assert.That(scene.Board.InputEnabled,Is.True);
            scene.OpenInventory();
            Assert.That(Text("ModalTitle"),Is.EqualTo("Çantan."));
            Assert.That(Text("greenBrushEligibility"),Is.EqualTo("3. bölümden sonra açılır."));
            Assert.That(Button("Hücre seç").interactable,Is.False);
            Assert.That(Button("Taş seç").interactable,Is.False);
            scene.OnWebVisibilityChanged("hidden");
            Assert.That(Text("ModalTitle"),Is.EqualTo("Rota seni bekler."));
            scene.Resume();
            CollectionAssert.AreEqual(board.values,scene.Session.Snapshot.values);
            Assert.That(scene.Session.Snapshot.turn,Is.EqualTo(board.turn));
        }

        [UnityTest] public IEnumerator HomeLinksToAllTenRecords()
        {
            Button("RecordsButton").onClick.Invoke();
            Assert.That(scene.CurrentScreen,Is.EqualTo("records"));
            Assert.That(Text("Chapter0"),Does.Contain(scene.Session.StageName(scene.Session.TutorialCount)));
            Assert.That(Text("Chapter9"),Does.Contain(scene.Session.StageName(scene.Session.StageCount-1)));
            Assert.That(Text("Status0"),Is.EqualTo("Sırada"));
            Assert.That(Text("BestMoves9"),Is.EqualTo("—"));
            var scroll=scene.GetComponentInChildren<ScrollRect>();
            scroll.verticalNormalizedPosition=0;
            yield return null;
            Assert.That(scroll.verticalNormalizedPosition,Is.LessThan(.01f));
            Button("Ana menü").onClick.Invoke();
            Assert.That(scene.CurrentScreen,Is.EqualTo("menu"));
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest] public IEnumerator PlaytestToggleAndClearKeepTheAttemptPlayable()
        {
            scene.BeginLevelOne();
            yield return ChapterEntryWait.Ready(scene);
            scene.OpenMobileSettings();
            Assert.That(scene.Session.PlaytestEnabled,Is.False);
            Button("Oyuncu testi kaydı").onClick.Invoke();
            Assert.That(scene.Session.PlaytestEnabled,Is.True);
            yield return null;
            Button("Yalnızca test kaydını temizle").onClick.Invoke();
            Button("Tamam").onClick.Invoke();
            Assert.That(scene.CurrentScreen,Is.EqualTo("playing"));
            Assert.That(scene.Board.InputEnabled,Is.True);
            Assert.That(scene.Session.Snapshot.turn,Is.Zero);
        }
    }
}
