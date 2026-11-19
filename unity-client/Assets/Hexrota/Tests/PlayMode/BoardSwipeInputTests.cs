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

namespace Hexrota.UnityClientTests
{
    public sealed class BoardSwipeInputTests
    {
        private Func<UnityGameSession> originalFactory;
        private FirstPlayableController game;
        private HexBoardView board;
        private Vector2 start, end;
        private Vector2Int legalSwap;
        private readonly List<Vector2Int> requests = new List<Vector2Int>();

        [UnitySetUp]
        public IEnumerator LoadScene()
        {
            originalFactory = FirstPlayableController.SessionFactory;
            FirstPlayableController.SessionFactory = () => new UnityGameSession(ClientGameData.FromResources(),
                new MemoryProfileStorage(), new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
        }

        private IEnumerator OpenLesson(bool reduced = false)
        {
            Assert.That(game.Session.SetPreferences(motion: reduced ? "reduce" : "full"), Is.True);
            // This fixture has neighbours one and two hexes along the same swipe axis.
            game.BeginStage(0);
            yield return ChapterEntryWait.Ready(game);
            board = game.Board;
            int[] pair = game.Session.TutorialPair;
            legalSwap = new Vector2Int(pair[0], pair[1]);
            start = ScreenPoint(pair[0]);
            end = ScreenPoint(pair[1]);
            requests.Clear();
            board.SwapRequested += RecordRequest;
        }

        [UnityTearDown]
        public IEnumerator CloseScene()
        {
            if (board != null) board.SwapRequested -= RecordRequest;
            FirstPlayableController.SessionFactory = originalFactory;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        private void RecordRequest(int from, int to) => requests.Add(new Vector2Int(from, to));

        private Vector2 ScreenPoint(int index)
        {
            var cell = game.Session.Level.cells[index];
            return board.BoardCamera.WorldToScreenPoint(MobileLayout.Axial(cell.q, cell.r));
        }

        private PointerEventData Down(Vector2 point, int finger = 7)
        {
            var e = new PointerEventData(EventSystem.current) { position = point, pointerId = finger };
            var hits = new List<RaycastResult>();
            EventSystem.current.RaycastAll(e, hits);
            Assert.That(hits, Is.Not.Empty);
            var receiver = ExecuteEvents.GetEventHandler<IPointerDownHandler>(hits[0].gameObject);
            Assert.That(receiver, Is.SameAs(board.gameObject));
            ExecuteEvents.Execute(receiver, e, ExecuteEvents.pointerDownHandler);
            return e;
        }

        private void Drag(PointerEventData e, Vector2 point)
        {
            e.position = point;
            ExecuteEvents.Execute(board.gameObject, e, ExecuteEvents.dragHandler);
        }

        private void Up(PointerEventData e, Vector2 point)
        {
            e.position = point;
            ExecuteEvents.Execute(board.gameObject, e, ExecuteEvents.pointerUpHandler);
        }

        private void AssertOnlyLegalSwap()
        {
            CollectionAssert.AreEqual(new[] { legalSwap }, requests);
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(1));
        }

        [UnityTest]
        public IEnumerator FastReleaseInsideSourceCommitsTheDirectionWithoutAnIntermediateDragEvent()
        {
            yield return OpenLesson();
            // A fast flick can reach the input module in just a down and an up.
            Vector2 flick = Vector2.Lerp(start, end, .43f);
            Up(Down(start), flick);
            AssertOnlyLegalSwap();
        }

        [UnityTest]
        public IEnumerator PassingAcrossTheNeighbourToTheNextStoneStillCommitsOneAdjacentSwap()
        {
            yield return OpenLesson();
            Vector2 beyond = end + (end - start);
            Assert.That(Enumerable.Range(0, game.Session.Level.cells.Length).Any(i =>
                i != legalSwap.y && Vector2.Distance(beyond, ScreenPoint(i)) < 1f), Is.True);
            var finger = Down(start);
            Drag(finger, end);
            Drag(finger, beyond);
            Up(finger, beyond);
            AssertOnlyLegalSwap();
        }

        [UnityTest]
        public IEnumerator BetweenAxesAndConflictingDirectionsRestoreTheBoardWithoutSendingACommand()
        {
            yield return OpenLesson();
            Vector2 axis = end - start;
            Vector2 otherAxis = Enumerable.Range(0, game.Session.Level.cells.Length).Select(i => ScreenPoint(i) - start)
                .First(v => Mathf.Abs(v.magnitude - axis.magnitude) < 1f && Mathf.Abs(Vector2.Angle(axis, v) - 60f) < .5f);
            Vector2 between = start + (axis + otherAxis).normalized * axis.magnitude;
            var source = GameObject.Find("Stone_" + legalSwap.x).transform;
            Vector3 home = source.position;
            var finger = Down(start);
            Drag(finger, between);
            Assert.That(source.position, Is.EqualTo(home), "A bisector is outside both recognition cones.");
            Up(finger, between);
            finger = Down(start);
            Drag(finger, end);
            Assert.That(source.position, Is.Not.EqualTo(home));
            Drag(finger, start + otherAxis);
            Up(finger, end);
            Assert.That(requests, Is.Empty, "Returning to the first axis must not revive a conflicted swipe.");
            Assert.That(source.position, Is.EqualTo(home));
            Assert.That(game.Session.Snapshot.turn, Is.Zero);
        }

        [UnityTest]
        public IEnumerator SecondFingerClearsThePreviewAndBothContactsBeforeTheNextTapPair()
        {
            yield return OpenLesson();
            var source = GameObject.Find("Stone_" + legalSwap.x).transform;
            Vector3 home = source.position;
            var first = Down(start);
            Drag(first, end);
            Assert.That(source.position, Is.Not.EqualTo(home));
            var second = Down(end, 8);
            Assert.That(source.position, Is.EqualTo(home));
            Up(second, end);
            Up(first, end);
            Assert.That(requests, Is.Empty);
            Assert.That(game.Session.Snapshot.turn, Is.Zero);
            Assert.That(board.SelectedIndex, Is.EqualTo(-1));

            Up(Down(start), start);
            Assert.That(board.SelectedIndex, Is.EqualTo(legalSwap.x));
            Up(Down(end), end);
            AssertOnlyLegalSwap();
        }

        [UnityTest]
        public IEnumerator ReducedMotionAcceptsAShortFlickWithoutDisplacingEitherStone()
        {
            yield return OpenLesson(true);
            var source = GameObject.Find("Stone_" + legalSwap.x).transform;
            var target = GameObject.Find("Stone_" + legalSwap.y).transform;
            Vector3 sourceHome = source.position, targetHome = target.position;
            Vector2 flick = Vector2.Lerp(start, end, .43f);
            var finger = Down(start);
            Drag(finger, flick);
            Assert.That(board.ReducedMotion, Is.True);
            Assert.That(source.position, Is.EqualTo(sourceHome));
            Assert.That(target.position, Is.EqualTo(targetHome));
            Up(finger, flick);
            AssertOnlyLegalSwap();
        }
    }
}
