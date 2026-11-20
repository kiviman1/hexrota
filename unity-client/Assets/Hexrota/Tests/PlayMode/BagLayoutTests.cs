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
    // The booster bag hangs under the HUD settings button. On the three reference phones it must
    // never cover a board cell, on a classic chapter and on the largest V5 mask.
    public sealed class BagLayoutTests : PlayModeTest
    {
        private Func<UnityGameSession> previous;
        private FirstPlayableController game;
        private Vector2Int original;

        [UnityTearDown]
        public IEnumerator CleanUp()
        {
            if (previous != null) FirstPlayableController.SessionFactory = previous;
            if (game != null) game.ReturnToMenu();
#if UNITY_EDITOR
            // Give the next tests the game view size they started with.
            if (original.x > 0) UnityEditor.PlayModeWindow.SetCustomRenderingResolution((uint)original.x, (uint)original.y, "Restored");
#endif
            yield return null;
        }

        [UnityTest] public IEnumerator TheBagStaysOffTheBoardAt360x780() => Check(360, 780);
        [UnityTest] public IEnumerator TheBagStaysOffTheBoardAt390x844() => Check(390, 844);
        [UnityTest] public IEnumerator TheBagStaysOffTheBoardAt430x932() => Check(430, 932);

        private IEnumerator Check(int width, int height)
        {
            original = new Vector2Int(Screen.width, Screen.height);
#if UNITY_EDITOR
            UnityEditor.PlayModeWindow.SetCustomRenderingResolution((uint)width, (uint)height, "Bag " + width + "x" + height);
#endif
            yield return null;
            yield return null;
            Assert.That(new Vector2Int(Screen.width, Screen.height), Is.EqualTo(new Vector2Int(width, height)), "Game view size");
            // Chapter 4 (classic, first with the bag) and chapter 10 (the largest V5 mask), each still unplayed.
            foreach (int chapter in new[] { 4, 10 })
            {
                yield return OpenChapter(chapter);
                Assert.That(game.CurrentScreen, Is.EqualTo("playing"), "Chapter " + chapter);
                AssertBagClearOfBoard(chapter, width, height);
                game.ReturnToMenu();
                yield return null;
            }
        }

        // Wins the chapters before this one outside the scene, then opens it through the scene.
        private IEnumerator OpenChapter(int chapter)
        {
            var data = ClientGameData.FromResources();
            var storage = new MemoryProfileStorage();
            var preparer = new UnityGameSession(data, storage, new SystemUtcClock());
            for (int stage = preparer.TutorialCount; stage < preparer.TutorialCount + chapter - 1; stage++)
            {
                Assert.That(preparer.EnterStage(stage), Is.True, preparer.LastError);
                var move = preparer.PlayDevelopmentRouteToLastMove();
                Assert.That(move, Is.Not.Null, preparer.LastError);
                Assert.That(preparer.TrySwap(move[0], move[1]).Ok, Is.True);
                preparer.CompletePresentation();
            }
            preparer.Suspend();
            if (previous == null) previous = FirstPlayableController.SessionFactory;
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, storage, new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(game.Session.SetPreferences(motion: "reduce"), Is.True);
            game.BeginStage(game.Session.TutorialCount + chapter - 1);
            yield return ChapterEntryWait.Ready(game);
            yield return null;
            Canvas.ForceUpdateCanvases();
        }

        private void AssertBagClearOfBoard(int chapter, int width, int height)
        {
            var bag = game.GetComponentsInChildren<Button>().SingleOrDefault(b => b.name == CastleHudView.BagButtonName);
            Assert.That(bag, Is.Not.Null, "Chapter " + chapter + ": the bag shows once a booster is unlocked.");
            var corners = new Vector3[4];
            ((RectTransform)bag.transform).GetWorldCorners(corners);
            var canvas = bag.GetComponentInParent<Canvas>().rootCanvas;
            var eye = canvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : canvas.worldCamera;
            Vector2 min = RectTransformUtility.WorldToScreenPoint(eye, corners[0]);
            Vector2 max = RectTransformUtility.WorldToScreenPoint(eye, corners[2]);
            var bagRect = Rect.MinMaxRect(min.x, min.y, max.x, max.y);
            Assert.That(bagRect.yMin, Is.GreaterThan(0f));
            var camera = game.Board.BoardCamera;
            var level = game.Session.Level;
            // A hex reaches 0.56 world units from its centre; test its bounding box on screen.
            float reach = camera.WorldToScreenPoint(new Vector3(.56f, 0, 0)).x - camera.WorldToScreenPoint(Vector3.zero).x;
            for (int i = 0; i < level.cells.Length; i++)
            {
                Vector2 centre = camera.WorldToScreenPoint(MobileLayout.Axial(level.cells[i].q, level.cells[i].r));
                var cell = new Rect(centre.x - reach, centre.y - reach * .866f, reach * 2, reach * 1.732f);
                Assert.That(cell.Overlaps(bagRect), Is.False,
                    "Chapter " + chapter + " at " + width + "x" + height + ": the bag covers cell " + i + ".");
            }
        }
    }
}
