using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Application;
using Hexrota.Gameplay;
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
    public sealed class SwapDirectionHintTests : PlayModeTest
    {
        // Exercise the actual rendered triangle, including all reverse directions.
        // Only the arrowhead ends in a point. A symmetric connector cannot pass.
        [TestCase(30)]
        [TestCase(90)]
        [TestCase(150)]
        [TestCase(210)]
        [TestCase(270)]
        [TestCase(330)]
        public void ArrowheadPointsIntoTheRequestedNeighbourAndLeavesBothNumbersVisible(float degrees)
        {
            var canvasObject = new GameObject("Hint test canvas", typeof(RectTransform), typeof(Canvas));
            try
            {
                canvasObject.GetComponent<Canvas>().renderMode = RenderMode.ScreenSpaceOverlay;
                var item = new GameObject("Direction", typeof(RectTransform), typeof(TutorialGestureArrow));
                var arrow = item.GetComponent<TutorialGestureArrow>();
                arrow.rectTransform.SetParent(canvasObject.transform, false);
                arrow.rectTransform.sizeDelta = new Vector2(320, 480);
                arrow.color = Color.magenta;
                Vector2 axis = new Vector2(Mathf.Cos(degrees * Mathf.Deg2Rad), Mathf.Sin(degrees * Mathf.Deg2Rad));
                Vector2 source = -axis * 50, target = axis * 50;
                arrow.SetPair(Rect.PointToNormalized(arrow.rectTransform.rect, source),
                    Rect.PointToNormalized(arrow.rectTransform.rect, target));
                Canvas.ForceUpdateCanvases();

                Mesh mesh = arrow.canvasRenderer.GetMesh();
                Assert.That(mesh, Is.Not.Null);
                var colours = mesh.colors32;
                var vertices = mesh.vertices.Where((p, i) => colours[i].Equals((Color32)Color.magenta))
                    .Select(p => (Vector2)p - source).ToArray();
                Assert.That(vertices.Length, Is.GreaterThan(2));
                Vector2 normal = new Vector2(-axis.y, axis.x);
                float tail = vertices.Min(v => Vector2.Dot(v, axis)), tip = vertices.Max(v => Vector2.Dot(v, axis));
                Assert.That(tail, Is.InRange(20f, 40f));
                Assert.That(tip, Is.InRange(65f, 80f));
                var front = vertices.Where(v => Mathf.Abs(Vector2.Dot(v, axis) - tip) < .01f);
                var back = vertices.Where(v => Mathf.Abs(Vector2.Dot(v, axis) - tail) < .01f);
                Assert.That(front.All(v => Mathf.Abs(Vector2.Dot(v, normal)) < .01f), Is.True, "Head points at target.");
                Assert.That(back.Any(v => Mathf.Abs(Vector2.Dot(v, normal)) > 1f), Is.True, "Tail starts at source.");
            }
            finally { Object.DestroyImmediate(canvasObject); }
        }

        [UnityTest]
        public IEnumerator IdleHintPulsesTheWholeOutlineAndNudgesTheSourceTowardTheMatch()
        {
            var original = FirstPlayableController.SessionFactory;
            FirstPlayableController game = null;
            try
            {
                FirstPlayableController.SessionFactory = () => new UnityGameSession(
                    ClientGameData.FromResources(), new MemoryProfileStorage(), new SystemUtcClock());
                yield return SceneManager.LoadSceneAsync("FirstPlayable");
                game = Object.FindAnyObjectByType<FirstPlayableController>();
                Assert.That(game.Session.SetPreferences(motion: "full"), Is.True);
                game.BeginLevelOne();
                yield return ChapterEntryWait.Ready(game);
                yield return ChapterEntryWait.PlayOpeningMove(game);
                var board = game.Board;
                var hint = game.Session.ChooseIdleHint(null);
                Assert.That(hint, Is.Not.Null);
                var model = new HexMatch(game.Session.Level, game.Session.Snapshot);
                var swapped = (int?[])model.values.Clone();
                swapped[hint.MovingSource] = model.values[hint.MovingTarget];
                swapped[hint.MovingTarget] = model.values[hint.MovingSource];
                var matched = model.FindMatches(swapped);
                CollectionAssert.AreEquivalent(matched, hint.MatchDestinations);
                int[] outlined = matched.Append(hint.MovingSource).Distinct().ToArray();
                int edges = outlined.Sum(cell => 6 - outlined.Count(other => model.Adjacent(cell, other)));
                var mint = new Color32(126, 250, 211, 255);
                var overlay = board.GetComponentsInChildren<TutorialGestureArrow>(true).Single();
                var source = GameObject.Find("Stone_" + hint.MovingSource).transform;
                var target = GameObject.Find("Stone_" + hint.MovingTarget).transform;
                Vector3 rest = source.position;
                Vector3 axis = target.position - rest;
                int turn = game.Session.Snapshot.turn;
                long revision = game.Session.Revision;
                float deadline = Time.realtimeSinceStartup + 14f;
                while (!overlay.isActiveAndEnabled && Time.realtimeSinceStartup < deadline) yield return null;
                Assert.That(overlay.isActiveAndEnabled, Is.True);
                Canvas.ForceUpdateCanvases();
                var mesh = overlay.canvasRenderer.GetMesh();
                Assert.That(mesh.vertexCount, Is.EqualTo(edges * 8), "Only the full outline should be drawn.");
                Assert.That(mesh.colors32.Count(color => color.Equals(mint)), Is.EqualTo(edges * 4));
                float initialAlpha = overlay.canvasRenderer.GetAlpha();
                float peakAlpha = initialAlpha;
                int nudges = 0;
                bool extended = false;
                float began = Time.realtimeSinceStartup;
                float until = began + 2.1f;
                while (Time.realtimeSinceStartup < until)
                {
                    yield return null;
                    float distance = Vector3.Dot(source.position - rest, axis) / axis.sqrMagnitude;
                    Assert.That(distance, Is.InRange(-.001f, .11f));
                    Assert.That(Vector3.Distance(source.position, rest + axis * distance), Is.LessThan(.001f));
                    if (!extended && distance > .06f)
                    {
                        nudges++;
                        extended = true;
                        if (nudges == 3) Assert.That(Time.realtimeSinceStartup - began, Is.GreaterThan(1.2f));
                    }
                    if (distance < .02f) extended = false;
                    peakAlpha = Mathf.Max(peakAlpha, overlay.canvasRenderer.GetAlpha());
                }
                Assert.That(nudges, Is.EqualTo(3));
                Assert.That(peakAlpha - initialAlpha, Is.GreaterThan(.15f));
                Assert.That(game.Session.Snapshot.turn, Is.EqualTo(turn));
                Assert.That(game.Session.Revision, Is.EqualTo(revision));
                var modelRenderer = source.GetComponentInChildren<MeshRenderer>();
                var properties = new MaterialPropertyBlock();
                modelRenderer.GetPropertyBlock(properties);
                Assert.That(properties.GetFloat("_IdleOutline"), Is.GreaterThan(0f));
                game.Pause();
                Assert.That(overlay.isActiveAndEnabled, Is.False);
                Assert.That(source.position, Is.EqualTo(rest));
                modelRenderer.GetPropertyBlock(properties);
                Assert.That(properties.GetFloat("_IdleOutline"), Is.Zero);
            }
            finally
            {
                FirstPlayableController.SessionFactory = original;
                if (game != null) game.ReturnToMenu();
            }
        }

        [UnityTest]
        public IEnumerator ReducedMotionShowsAStaticOutlineUntilThePlayerSwaps()
        {
            var original = FirstPlayableController.SessionFactory;
            FirstPlayableController game = null;
            try
            {
                var storage = new MemoryProfileStorage();
                FirstPlayableController.SessionFactory = () =>
                    new UnityGameSession(ClientGameData.FromResources(), storage, new SystemUtcClock());
                yield return SceneManager.LoadSceneAsync("FirstPlayable");
                game = Object.FindAnyObjectByType<FirstPlayableController>();
                Assert.That(game.Session.SetPreferences(motion: "reduce"), Is.True);
                game.BeginLevelOne();
                yield return ChapterEntryWait.Ready(game);
                yield return ChapterEntryWait.PlayOpeningMove(game);
                var board = game.Board;
                var arrow = board.GetComponentsInChildren<TutorialGestureArrow>(true).Single();
                Assert.That(arrow.gameObject.activeSelf, Is.False);
                var move = game.Session.ChooseIdleHint(null);
                var sourceStone = GameObject.Find("Stone_" + move.MovingSource).transform;
                Vector3 start = sourceStone.position;
                int turn = game.Session.Snapshot.turn;
                long revision = game.Session.Revision;
                float deadline = Time.realtimeSinceStartup + 14f;
                while (!board.ShowingIdleHint && Time.realtimeSinceStartup < deadline) yield return null;

                Assert.That(board.ShowingIdleHint && arrow.isActiveAndEnabled, Is.True);
                Assert.That(arrow.raycastTarget, Is.False);
                Canvas.ForceUpdateCanvases();
                var vertices = arrow.canvasRenderer.GetMesh().vertices;
                Assert.That(vertices, Is.Not.Empty);
                float until = Time.realtimeSinceStartup + 1.1f;
                while (Time.realtimeSinceStartup < until)
                {
                    Assert.That(arrow.isActiveAndEnabled && board.ShowingIdleHint, Is.True, "Static cue must not flash.");
                    Assert.That(sourceStone.position, Is.EqualTo(start));
                    yield return null;
                }
                CollectionAssert.AreEqual(vertices, arrow.canvasRenderer.GetMesh().vertices);
                Assert.That(game.Session.Revision, Is.EqualTo(revision));

                var rect = (RectTransform)board.transform;
                Vector2 source = RectTransformUtility.WorldToScreenPoint(null,
                    rect.TransformPoint(Rect.NormalizedToPoint(rect.rect, board.ViewportCell(move.MovingSource))));
                Vector2 target = RectTransformUtility.WorldToScreenPoint(null,
                    rect.TransformPoint(Rect.NormalizedToPoint(rect.rect, board.ViewportCell(move.MovingTarget))));
                var pointer = new PointerEventData(EventSystem.current) { pointerId = 1, position = source };
                var hits = new List<RaycastResult>();
                EventSystem.current.RaycastAll(pointer, hits);
                Assert.That(ExecuteEvents.GetEventHandler<IPointerDownHandler>(hits[0].gameObject), Is.EqualTo(board.gameObject));
                ExecuteEvents.Execute(board.gameObject, pointer, ExecuteEvents.pointerDownHandler);
                Assert.That(board.ShowingIdleHint || arrow.gameObject.activeSelf, Is.False);
                pointer.position = target;
                ExecuteEvents.Execute(board.gameObject, pointer, ExecuteEvents.dragHandler);
                ExecuteEvents.Execute(board.gameObject, pointer, ExecuteEvents.pointerUpHandler);
                Assert.That(game.Session.Snapshot.turn, Is.EqualTo(turn + 1));

                game.Pause();
                game.Resume();
                yield return null;
                Assert.That(arrow.gameObject.activeSelf, Is.False, "Resuming must not resurrect the old direction.");
                LogAssert.NoUnexpectedReceived();
            }
            finally
            {
                FirstPlayableController.SessionFactory = original;
                if (game != null) game.ReturnToMenu();
            }
        }
    }
}
