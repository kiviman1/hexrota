using System;
using System.Collections;
using Hexrota.Application;
using Hexrota.Gameplay;
using Hexrota.Lives;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace Hexrota.UnityClientTests
{
    public sealed class FirstPlayableFlowTests
    {
        private sealed class Clock : IUtcClock
        {
            public long NowUtcMilliseconds() { return 1794916800000L; }
        }
        private Func<UnityGameSession> originalFactory;
        private FirstPlayableController view;
        [UnitySetUp] public IEnumerator OpenRealSceneWithIsolatedStorage()
        {
            originalFactory = FirstPlayableController.SessionFactory;
            FirstPlayableController.SessionFactory = () => new UnityGameSession(
                ClientGameData.FromResources(), new MemoryProfileStorage(), new Clock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable", LoadSceneMode.Single);
            view = UnityEngine.Object.FindFirstObjectByType<FirstPlayableController>();
            Assert.That(view, Is.Not.Null, "Build settings must contain the checked-in gameplay scene.");
            Assert.That(view.Session, Is.Not.Null);
            yield return null;
        }
        [UnityTearDown] public IEnumerator RestoreFactoryAndStopPresentation()
        {
            if (view != null) view.ReturnToMenu();
            FirstPlayableController.SessionFactory = originalFactory;
            yield return null;
        }
        private Vector2 ScreenPoint(int index)
        {
            var cell = view.Session.Level.cells[index];
            Vector2 xy = MobileLayout.Axial(cell.q, cell.r);
            return view.Board.BoardCamera.WorldToScreenPoint(new Vector3(xy.x, xy.y, 0));
        }
        private void Pointer(int index, bool down, int pointerId = 7)
        {
            var e = new PointerEventData(EventSystem.current) { position = ScreenPoint(index), pointerId = pointerId };
            if (down) ExecuteEvents.Execute(view.Board.gameObject, e, ExecuteEvents.pointerDownHandler);
            else ExecuteEvents.Execute(view.Board.gameObject, e, ExecuteEvents.pointerUpHandler);
        }
        [UnityTest] public IEnumerator SceneMenuEntryTapSelectionAndDragReachTheRealCore()
        {
            Assert.That(view.Session.HasAttempt, Is.False);
            view.BeginLevelOne();
            yield return null;
            Assert.That(view.Session.HasAttempt, Is.True, view.Session.LastError);
            Assert.That(view.Board.InputEnabled, Is.True);
            var pair = new HexMatch(view.Session.Level, view.Session.Snapshot).LegalMoves()[0];
            Pointer(pair[0], true); Pointer(pair[0], false);
            Assert.That(view.Board.SelectedIndex, Is.EqualTo(pair[0]));
            // Touch-sized drag through the board's EventSystem interfaces.
            Pointer(pair[0], true);
            var drag = new PointerEventData(EventSystem.current) { pointerId = 7, position = ScreenPoint(pair[1]) };
            ExecuteEvents.Execute(view.Board.gameObject, drag, ExecuteEvents.dragHandler);
            Pointer(pair[1], false);
            Assert.That(view.Session.Snapshot.turn, Is.EqualTo(1));
            Assert.That(view.Board.IsAnimating, Is.True);
            Assert.That(view.Session.IsPresenting, Is.True);
            int turn = view.Session.Snapshot.turn;
            Pointer(pair[0], true); Pointer(pair[1], false);
            Assert.That(view.Session.Snapshot.turn, Is.EqualTo(turn));
            // Wait only for the finite presentation budget; hangs must fail the test.
            float deadline = Time.realtimeSinceStartup + 15;
            while (view.Board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(view.Board.IsAnimating, Is.False);
            Assert.That(view.Session.IsPresenting, Is.False);
            Assert.That(view.Board.InputEnabled, Is.True);
        }
        [UnityTest] public IEnumerator BackgroundPauseAndRestartCancelDisposableAnimation()
        {
            view.BeginLevelOne(); yield return null;
            var pair = new HexMatch(view.Session.Level, view.Session.Snapshot).LegalMoves()[0];
            view.RequestSwap(pair[0], pair[1]);
            Assert.That(view.Board.IsAnimating, Is.True);
            var committed = view.Session.Snapshot;
            view.OnWebVisibilityChanged("hidden");
            yield return null;
            Assert.That(view.Board.IsAnimating, Is.False);
            Assert.That(view.Session.IsPresenting, Is.False);
            Assert.That(view.Session.Snapshot.turn, Is.EqualTo(committed.turn));
            CollectionAssert.AreEqual(committed.values, view.Session.Snapshot.values);
            CollectionAssert.AreEqual(committed.layers, view.Session.Snapshot.layers);
            Assert.That(view.Board.InputEnabled, Is.False, "Backgrounded board stays behind pause UI.");
            view.OnWebVisibilityChanged("visible");
            view.Resume();
            view.Restart(); yield return null;
            Assert.That(view.Session.Snapshot.turn, Is.Zero);
            Assert.That(view.Session.IsPresenting, Is.False);
            Assert.That(view.Board.IsAnimating, Is.False);
            view.ReturnToMenu(); yield return null;
            Assert.That(view.Session.HasAttempt, Is.False);
            Assert.That(view.Board.InputEnabled, Is.False);
        }
        [UnityTest] public IEnumerator MissingOptionalVisualsKeepRealBoardAndTouchTargetsUsable()
        {
            var cameraObject = new GameObject("TestCamera");
            var camera = cameraObject.AddComponent<Camera>(); camera.orthographic = true;
            var boardObject = new GameObject("TestBoard", typeof(RectTransform));
            var board = boardObject.AddComponent<HexBoardView>();
            board.Initialize(camera, null);
            Assert.That(view.Session.EnterLevelOne(), Is.True, view.Session.LastError);
            board.Build(view.Session.Level, view.Session.Snapshot);
            board.SetViewport(new Rect(0, 0, 1, 1));
            board.InputEnabled = true;
            yield return null;
            Assert.That(board.BoardCamera, Is.SameAs(camera));
            Assert.That(board.InputEnabled, Is.True);
            Assert.That(GameObject.Find("Stone_0"), Is.Not.Null);
            Assert.That(GameObject.Find("Value_0").GetComponent<TextMesh>().text, Is.Not.Empty);
            UnityEngine.Object.Destroy(boardObject); UnityEngine.Object.Destroy(cameraObject);
            yield return null;
        }
        [TestCase(320, 568, 0, 20, 0, 0)]
        [TestCase(375, 667, 0, 20, 0, 0)]
        [TestCase(390, 844, 0, 47, 0, 34)]
        [TestCase(430, 932, 0, 59, 0, 34)]
        [TestCase(844, 390, 47, 0, 47, 21)]
        public void MobileViewportStaysInsideSafeArea(float width, float height, float left, float top, float right, float bottom)
        {
            var screen = new Rect(0, 0, width, height);
            var safePixels = new Rect(left, bottom, width - left - right, height - top - bottom);
            var safe = MobileLayout.SafeArea(screen, safePixels);
            var board = MobileLayout.BoardViewport(safe);
            Assert.That(board.xMin, Is.GreaterThanOrEqualTo(safe.xMin));
            Assert.That(board.yMin, Is.GreaterThanOrEqualTo(safe.yMin));
            Assert.That(board.xMax, Is.LessThanOrEqualTo(safe.xMax));
            Assert.That(board.yMax, Is.LessThanOrEqualTo(safe.yMax));
            Assert.That(board.width * width, Is.GreaterThan(250));
            Assert.That(board.height * height, Is.GreaterThan(150));
        }
    }
}
