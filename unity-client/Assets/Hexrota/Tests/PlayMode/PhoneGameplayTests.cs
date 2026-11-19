using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.EventSystems;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace Hexrota.UnityClientTests
{
    public sealed class PhoneGameplayTests
    {
        [UnityTest]
        public IEnumerator TutorialAndNumberedBoardUseTopSettingsAndKeepTheBottomFree()
        {
            var initial = FirstPlayableController.SessionFactory;
            var storage = new MemoryProfileStorage();
            try
            {
                FirstPlayableController.SessionFactory = () => new UnityGameSession(ClientGameData.FromResources(), storage, new SystemUtcClock());
                yield return SceneManager.LoadSceneAsync("FirstPlayable");
                var game = Object.FindAnyObjectByType<FirstPlayableController>();
                game.BeginJourney();
                yield return ChapterEntryWait.Ready(game);
                var hud = game.GetComponentInChildren<CastleHudView>();
                var settings = hud.GetComponentsInChildren<Button>().Single();
                Assert.That(settings.name, Is.EqualTo("Ayarlar"));
                Canvas.ForceUpdateCanvases();
                var portrait = hud.GetComponentsInChildren<RawImage>().Single(i => i.name == "TavikPortrait");
                var headerLabels = hud.GetComponentsInChildren<Text>();
                Vector2 portraitPoint = ScreenCenter(portrait.rectTransform);
                Assert.That(ScreenCenter(headerLabels.Single(t => t.name == "Counters").rectTransform).x,
                    Is.GreaterThan(portraitPoint.x));
                Assert.That(ScreenCenter(headerLabels.Single(t => t.name == "Moves").rectTransform).x,
                    Is.GreaterThan(portraitPoint.x));
                Assert.That(portraitPoint.y, Is.GreaterThan(game.Board.BoardCamera.pixelRect.yMax));
                Assert.That(game.GetComponentInChildren<CastleGameToolsView>().transform.Find("DockRegion"), Is.Null);
                TapSettings(settings);
                Assert.That(game.CurrentScreen, Is.EqualTo("settings"));
                game.GetComponentsInChildren<Button>().Single(b => b.name == "Kapat").onClick.Invoke();
                Assert.That(game.Session.IsTutorial && game.Board.InputEnabled, Is.True);
                Assert.That(game.GetComponentsInChildren<RawImage>().Single(i => i.name == "Face").texture, Is.Not.Null);
                game.GetComponentsInChildren<Button>().Single(b => b.name == "Geç").onClick.Invoke();
                yield return ChapterEntryWait.Ready(game);
                Assert.That(game.CurrentScreen, Is.EqualTo("playing"));
                Assert.That(game.GetComponentsInChildren<Transform>().Any(t => t.name == "Coach"), Is.False);
                var labels = game.GetComponentsInChildren<Text>();
                Assert.That(labels.Any(t => t.name == "StageTag" || t.name == "LevelTitle"), Is.False);
                Assert.That(labels.Single(t => t.name == "Moves").text, Is.EqualTo(game.Session.Snapshot.movesLeft.ToString()));
                Assert.That(game.GetComponentsInChildren<Button>().Select(b => b.name),
                    Is.EquivalentTo(new[] { "Ayarlar" }));
                foreach (var value in Enumerable.Range(0,game.Session.Level.cells.Length))
                {
                    Vector2 projected = game.Board.ViewportCell(value);
                    Assert.That(projected.x, Is.InRange(0f,1f));
                    Assert.That(projected.y, Is.InRange(0f,1f));
                    StoneArtAssertions.ShowsNumber(GameObject.Find("Stone_" + value).transform,
                        game.Session.Snapshot.values[value].Value);
                }
                long revision = game.Session.Revision;
                float deadline = Time.realtimeSinceStartup + 12;
                while (!game.Board.ShowingIdleHint && Time.realtimeSinceStartup < deadline) yield return null;
                Assert.That(game.Board.ShowingIdleHint,Is.True,"An untouched numbered board cues its first visible match after 10 seconds.");
                Assert.That(game.Session.Revision,Is.EqualTo(revision),"The passive cue must not transact or spend.");
                game.Board.OnPointerDown(new PointerEventData(EventSystem.current) { pointerId=1, position=Vector2.zero });
                Assert.That(game.Board.ShowingIdleHint,Is.False);
                game.Board.OnCancel(null);
                TapSettings(settings);
                Assert.That(game.CurrentScreen, Is.EqualTo("settings"));
                Assert.That(game.Board.InputEnabled, Is.False);
                game.GetComponentsInChildren<Button>().Single(b => b.name == "Kapat").onClick.Invoke();
                Assert.That(game.Board.InputEnabled, Is.True);
                game.ReturnToMenu();
                LogAssert.NoUnexpectedReceived();
            }
            finally { FirstPlayableController.SessionFactory = initial; }
        }

        private static void TapSettings(Button settings)
        {
            Canvas.ForceUpdateCanvases();
            var rect = (RectTransform)settings.transform;
            Vector2 point = ScreenCenter(rect);
            Assert.That(point.y, Is.GreaterThan(Screen.safeArea.yMax - Screen.safeArea.height * .25f));
            var input = new PointerEventData(EventSystem.current) { position = point };
            var hits = new List<RaycastResult>();
            EventSystem.current.RaycastAll(input, hits);
            Assert.That(hits, Is.Not.Empty);
            Assert.That(ExecuteEvents.ExecuteHierarchy(hits[0].gameObject, input, ExecuteEvents.pointerClickHandler),
                Is.EqualTo(settings.gameObject));
        }

        private static Vector2 ScreenCenter(RectTransform rect) =>
            RectTransformUtility.WorldToScreenPoint(null, rect.TransformPoint(rect.rect.center));
    }
}
