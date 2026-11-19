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

        private void TapHomeButton(string name, float horizontalOffset = 0f)
        {
            var home = controller.GetComponentInChildren<CastleHomeView>();
            Assert.That(home, Is.Not.Null);
            var button = home.GetComponentsInChildren<Button>().Single(item => item.name == name);
            var rect = (RectTransform)button.transform;
            Canvas.ForceUpdateCanvases();
            var pointer = new PointerEventData(EventSystem.current) {
                position = RectTransformUtility.WorldToScreenPoint(null,
                    rect.TransformPoint(rect.rect.center + Vector2.right * horizontalOffset))
            };
            var hits = new List<RaycastResult>();
            EventSystem.current.RaycastAll(pointer, hits);
            Assert.That(hits, Is.Not.Empty, name + " must be reachable on screen.");
            var target = ExecuteEvents.GetEventHandler<IPointerClickHandler>(hits[0].gameObject);
            Assert.That(target, Is.EqualTo(button.gameObject), name + " must receive the tap above decorative art.");
            Assert.That(button.IsInteractable(), Is.True);
            ExecuteEvents.Execute(target, pointer, ExecuteEvents.pointerClickHandler);
        }

        [UnityTest] public IEnumerator HomeCountersMatchTheProfileAndMenuNavigationDoesNotStartAnAttempt()
        {
            var home = controller.GetComponentInChildren<CastleHomeView>();
            Assert.That(home, Is.Not.Null);
            var wallet = controller.Session.ReadPhoneWallet();
            var labels = home.GetComponentsInChildren<Text>();
            var brand = home.transform.Find("MenuLayout/Brand");
            Assert.That(brand, Is.Not.Null);
            Assert.That(brand.GetComponentsInChildren<Text>().Any(label => !string.IsNullOrWhiteSpace(label.text)), Is.True,
                "The logo must have an independently editable title.");
            var play = home.GetComponentsInChildren<Button>().Single(button => button.name == "PlayButton");
            Assert.That(play.GetComponentInChildren<Text>(), Is.Not.Null, "The primary action must have an editable caption.");
            Assert.That(labels.Single(label => label.name == "GoldValue").text, Is.EqualTo(wallet.Gold.ToString()));
            Assert.That(labels.Single(label => label.name == "LivesValue").text, Is.EqualTo(wallet.Lives.ToString()));
            Assert.That(labels.Single(label => label.name == "LifeStatus").text, Is.EqualTo("Dolu"));
            Assert.That(labels.Single(label => label.name == "StageLabel").text, Does.Contain("1"));
            Assert.That(controller.Session.FirstOpening, Is.True);
            TapHomeButton("LifeButton", 17f);
            Assert.That(controller.CurrentScreen, Is.EqualTo("lives"));
            ButtonNamed("Bekle").onClick.Invoke();
            yield return null;
            TapHomeButton("SettingsButton");
            Assert.That(controller.CurrentScreen, Is.EqualTo("settings"));
            ButtonNamed("Kapat").onClick.Invoke();
            yield return null;
            TapHomeButton("GardenButton");
            Assert.That(controller.CurrentScreen, Is.EqualTo("garden"));
            ButtonNamed("Ana menü").onClick.Invoke();
            yield return null;
            TapHomeButton("RecordsButton");
            Assert.That(controller.CurrentScreen, Is.EqualTo("records"));
            ButtonNamed("Ana menü").onClick.Invoke();
            Assert.That(controller.CurrentScreen, Is.EqualTo("menu"));
            Assert.That(controller.Session.FirstOpening, Is.True);
            yield return null;
            LogAssert.NoUnexpectedReceived();
        }

        [UnityTest] public IEnumerator HomeControlsFitShortAndTallPortraitSafeAreas()
        {
            var home = controller.GetComponentInChildren<CastleHomeView>();
            var frame = (RectTransform)home.transform;
            var originalMin = frame.anchorMin;
            var originalMax = frame.anchorMax;
            var originalLowerOffset = frame.offsetMin;
            var originalUpperOffset = frame.offsetMax;
            var corners = new Vector3[4];
            try
            {
                frame.anchorMin = frame.anchorMax = new Vector2(.5f, .5f);
                frame.anchoredPosition = Vector2.zero;
                foreach (var size in new[] { new Vector2(360, 640), new Vector2(390, 844) })
                {
                    frame.sizeDelta = size;
                    yield return null;
                    Canvas.ForceUpdateCanvases();
                    foreach (var button in home.GetComponentsInChildren<Button>())
                    {
                        ((RectTransform)button.transform).GetWorldCorners(corners);
                        foreach (var corner in corners)
                        {
                            Vector2 point = frame.InverseTransformPoint(corner);
                            Assert.That(point.x, Is.InRange(frame.rect.xMin - 1, frame.rect.xMax + 1), button.name);
                            Assert.That(point.y, Is.InRange(frame.rect.yMin - 1, frame.rect.yMax + 1), button.name);
                        }
                    }
                }
            }
            finally
            {
                frame.anchorMin = originalMin;
                frame.anchorMax = originalMax;
                frame.offsetMin = originalLowerOffset;
                frame.offsetMax = originalUpperOffset;
            }
        }

        [UnityTest] public IEnumerator InsetSafeAreaKeepsControlsVisibleAndBackgroundFillsTheDisplay()
        {
            var home = controller.GetComponentInChildren<CastleHomeView>();
            var canvas = home.GetComponentInParent<Canvas>().rootCanvas;
            var display = (RectTransform)canvas.transform;
            var safe = (RectTransform)display.Find("SafeArea");
            var background = home.transform.Find("MenuLayout/Environment/Background").GetComponent<Image>();
            var originalMin = safe.anchorMin;
            var originalMax = safe.anchorMax;
            try
            {
                safe.anchorMin = new Vector2(.06f, .08f);
                safe.anchorMax = new Vector2(.94f, .87f);
                yield return null;
                Canvas.ForceUpdateCanvases();

                var mesh = background.canvasRenderer.GetMesh();
                Assert.That(mesh, Is.Not.Null);
                var vertices = mesh.vertices.Select(vertex =>
                    display.InverseTransformPoint(background.rectTransform.TransformPoint(vertex))).ToArray();
                Assert.That(vertices, Is.Not.Empty);
                Assert.That(vertices.Min(point => point.x), Is.LessThanOrEqualTo(display.rect.xMin + 1f));
                Assert.That(vertices.Max(point => point.x), Is.GreaterThanOrEqualTo(display.rect.xMax - 1f));
                Assert.That(vertices.Min(point => point.y), Is.LessThanOrEqualTo(display.rect.yMin + 1f));
                Assert.That(vertices.Max(point => point.y), Is.GreaterThanOrEqualTo(display.rect.yMax - 1f));

                var stage = home.GetComponentsInChildren<Text>().Single(label => label.name == "StageLabel");
                var controls = home.GetComponentsInChildren<Button>().Select(button => (RectTransform)button.transform)
                    .Append(stage.rectTransform);
                var corners = new Vector3[4];
                foreach (var control in controls)
                {
                    control.GetWorldCorners(corners);
                    foreach (var corner in corners)
                    {
                        Vector2 point = safe.InverseTransformPoint(corner);
                        Assert.That(point.x, Is.InRange(safe.rect.xMin - 1, safe.rect.xMax + 1), control.name);
                        Assert.That(point.y, Is.InRange(safe.rect.yMin - 1, safe.rect.yMax + 1), control.name);
                    }
                }
            }
            finally
            {
                safe.anchorMin = originalMin;
                safe.anchorMax = originalMax;
            }
        }

        [UnityTest] public IEnumerator ReturningMenuAndMapOpenReadOnlyGoalsBeforeStartingTheRealNumberedBoard()
        {
            TapHomeButton("PlayButton");
            yield return ChapterEntryWait.Ready(controller);
            Assert.That(controller.Session.ActiveStage,Is.Zero);
            Assert.That(controller.Session.CompletedSceneTutorials,Is.Zero);
            controller.ReturnToMenu();
            yield return null;
            TapHomeButton("JourneyButton");
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
            yield return ChapterEntryWait.Ready(controller);
            Assert.That(controller.CurrentScreen,Is.EqualTo("playing"));
            Assert.That(controller.Session.ActiveStage,Is.EqualTo(2));
            Assert.That(controller.Session.CompletedSceneTutorials,Is.EqualTo(2));
            Assert.That(controller.Session.Snapshot.values.Length,Is.EqualTo(19));
            yield return null;
            LogAssert.NoUnexpectedReceived();
        }
    }
}
