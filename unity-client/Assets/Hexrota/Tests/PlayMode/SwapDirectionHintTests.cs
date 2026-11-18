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
    public sealed class SwapDirectionHintTests
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
        public IEnumerator ReducedMotionShowsOneStaticDirectionUntilThePointedSwapAndNeverMovesByItself()
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
