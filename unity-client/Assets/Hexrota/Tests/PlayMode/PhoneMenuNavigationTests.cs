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
            Assert.That(brand, Is.Not.Null, "The emblem is kept in the prefab.");
            Assert.That(brand.gameObject.activeSelf, Is.False, "The emblem is hidden so the sky band and clouds show.");
            Assert.That(brand.GetComponentsInChildren<Text>(true).Any(label => !string.IsNullOrWhiteSpace(label.text)), Is.True,
                "The logo keeps an independently editable title.");
            Assert.That(home.transform.Find("MenuLayout/TopBar").gameObject.activeInHierarchy, Is.True, "The top bar stays.");
            var play = home.GetComponentsInChildren<Button>().Single(button => button.name == "PlayButton");
            Assert.That(play.GetComponentInChildren<Text>(), Is.Not.Null, "The primary action must have an editable caption.");
            Assert.That(labels.Single(label => label.name == "GoldValue").text, Is.EqualTo(wallet.Gold.ToString()));
            Assert.That(labels.Single(label => label.name == "LivesValue").text, Is.EqualTo(wallet.Lives.ToString()));
            Assert.That(labels.Single(label => label.name == "LifeStatus").text, Is.EqualTo("Dolu"));
            Assert.That(labels.Single(label => label.name == "StageLabel").text, Does.Contain("1"));
            Assert.That(controller.Session.FirstOpening, Is.True);
            TapHomeButton("CoopTapArea");
            Assert.That(home.GetComponentInChildren<CoopHomeView>().PanelOpen, Is.True,
                "Tapping the coop on the plot opens the upgrade panel.");
            home.GetComponentInChildren<CoopHomeView>().Panel.GetComponentsInChildren<Button>().Single(b => b.name == "CloseButton").onClick.Invoke();
            yield return new WaitForSecondsRealtime(.5f);
            TapHomeButton("LifeButton", 17f);
            Assert.That(controller.CurrentScreen, Is.EqualTo("lives"));
            ButtonNamed("Bekle").onClick.Invoke();
            yield return null;
            TapHomeButton("SettingsButton");
            Assert.That(controller.CurrentScreen, Is.EqualTo("settings"));
            ButtonNamed("Kapat").onClick.Invoke();
            yield return null;
            Assert.That(home.GetComponentsInChildren<Button>(true).Single(button => button.name == "GardenButton")
                .gameObject.activeInHierarchy, Is.False, "The garden is not a home entry in the single coop loop.");
            // A new profile sees a quiet home: no side rails, no egg pill, no bottom menu yet.
            Assert.That(home.NavigationShown, Is.False, "The bottom menu opens after chapter 5.");
            foreach (var hidden in new[] { "MenuLayout/SideActions", "MenuLayout/TopBar/EggWallet", "MenuLayout/BottomNav" })
                Assert.That(home.transform.Find(hidden).gameObject.activeInHierarchy, Is.False, hidden);
            var bar = (RectTransform)home.transform.Find("MenuLayout/CoopProgress");
            var label = bar.GetComponentsInChildren<Text>().Single(t => t.name == "Label");
            Assert.That(label.font.name, Is.EqualTo("LilitaOne-Regular"));
            Assert.That(label.GetComponent<Outline>().effectColor, Is.EqualTo(Resources.FindObjectsOfTypeAll<UiTheme>().First().ctaDeep),
                "White label with the green fill's deep outline.");
            Assert.That(Gap(bar, (RectTransform)ButtonNamed("PlayButton").transform), Is.GreaterThanOrEqualTo(20f),
                "Without the menu, Play and the bar sit lower with room between them.");
            controller.OpenRecords();
            Assert.That(controller.CurrentScreen, Is.EqualTo("records"), "The Records page itself stays.");
            ButtonNamed("Ana menü").onClick.Invoke();
            Assert.That(controller.CurrentScreen, Is.EqualTo("menu"));
            Assert.That(controller.Session.FirstOpening, Is.True);
            yield return null;
            LogAssert.NoUnexpectedReceived();
        }

        // Vertical gap between the bottom of one rect and the top of the one below, in screen points.
        private static float Gap(RectTransform upper, RectTransform lower)
        {
            var a = new Vector3[4]; var b = new Vector3[4];
            upper.GetWorldCorners(a); lower.GetWorldCorners(b);
            var canvas = upper.GetComponentInParent<Canvas>().rootCanvas.transform;
            return canvas.InverseTransformPoint(a[0]).y - canvas.InverseTransformPoint(b[1]).y;
        }

        [UnityTest] public IEnumerator BottomMenuOpensAfterChapterFiveAsShopHomeAreas()
        {
            var storage = new MemoryProfileStorage();
            var data = ClientGameData.FromResources();
            var preparer = new UnityGameSession(data, storage, new SystemUtcClock());
            int unlock = controller.GetComponentInChildren<CastleHomeView>().NavigationUnlockChapters;
            for (int stage = preparer.TutorialCount; stage < preparer.TutorialCount + unlock; stage++)
            {
                Assert.That(preparer.EnterStage(stage), Is.True, preparer.LastError);
                var last = preparer.PlayDevelopmentRouteToLastMove();
                Assert.That(last, Is.Not.Null, preparer.LastError);
                Assert.That(preparer.TrySwap(last[0], last[1]).Ok, Is.True);
                preparer.CompletePresentation();
                preparer.ReturnToMenu();
            }
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, storage, new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            controller = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            yield return null;
            Canvas.ForceUpdateCanvases();
            var home = controller.GetComponentInChildren<CastleHomeView>();
            Assert.That(home.NavigationShown, Is.True);
            var nav = home.transform.Find("MenuLayout/BottomNav");
            var tabs = nav.GetComponentsInChildren<Button>().OrderBy(b => b.transform.position.x).Select(b => b.name).ToArray();
            Assert.That(tabs, Is.EqualTo(new[] { "ShopButton", "HomeButton", "AreasButton" }), "Mağaza · Ana · Alanlar");
            var dock = (RectTransform)nav.Find("Dock");
            Assert.That(Gap((RectTransform)ButtonNamed("PlayButton").transform, dock), Is.GreaterThan(0f), "Play sits above the menu.");
            Assert.That(Gap((RectTransform)home.transform.Find("MenuLayout/CoopProgress"), (RectTransform)ButtonNamed("PlayButton").transform),
                Is.GreaterThan(0f), "The bar stays above Play.");
            TapHomeButton("AreasButton");
            Assert.That(controller.CurrentScreen, Is.EqualTo("areas"));
            Assert.That(controller.GetComponentsInChildren<Text>().Any(t => t.text.Contains("Yakında")), Is.True, "Areas is a placeholder for now.");
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
                    // The coop on the plot belongs to the full-screen background art, not to the safe-area UI.
                    var art = home.GetComponentInChildren<HomeBackgroundLayers>().transform;
                    foreach (var button in home.GetComponentsInChildren<Button>().Where(b => !b.transform.IsChildOf(art)))
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
                // The coop tap area belongs to the full-screen background art, not to the safe-area UI.
                var art = home.GetComponentInChildren<HomeBackgroundLayers>().transform;
                var controls = home.GetComponentsInChildren<Button>().Where(button => !button.transform.IsChildOf(art))
                    .Select(button => (RectTransform)button.transform)
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
            Assert.That(controller.Session.ActiveStage,Is.EqualTo(controller.Session.TutorialCount));
            Assert.That(controller.Session.OpeningLessonPair,Has.Length.EqualTo(2));
            controller.ReturnToMenu();
            yield return null;
            controller.OpenJourney(); // the Journey page stays, though it is no longer a menu tab
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
            Assert.That(controller.Session.CompletedSceneTutorials,Is.Zero);
            Assert.That(controller.Session.Snapshot.values.Length,Is.EqualTo(19));
            yield return null;
            LogAssert.NoUnexpectedReceived();
        }
    }
}
