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
    public sealed class BoardSwipeInputTests : PlayModeTest
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
        public IEnumerator DirectionCommitsBeforeReleaseAndTheHeldFingerCannotSendAnotherMove()
        {
            yield return OpenLesson();
            var source = GameObject.Find("Stone_" + legalSwap.x).transform;
            Vector3 home = source.position;
            Vector3 shape = source.localScale;
            Quaternion orientation = source.localRotation;
            var art = source.Find("Model");
            Quaternion artOrientation = art.rotation;
            var finger = Down(start);
            Drag(finger, start + (end - start).normalized * 8f + new Vector2(.5f, -.5f));
            Assert.That(source.position, Is.EqualTo(home));
            Assert.That(source.localScale, Is.Not.EqualTo(shape));
            Assert.That(Quaternion.Angle(art.rotation, artOrientation), Is.LessThan(.1f));
            Assert.That(requests, Is.Empty);
            Drag(finger, start);
            Assert.That(source.localScale, Is.EqualTo(shape));
            Drag(finger, start + (end - start).normalized * 8f);
            ExecuteEvents.Execute(board.gameObject, finger, ExecuteEvents.cancelHandler);
            Assert.That(source.localScale, Is.EqualTo(shape));
            Assert.That(source.localRotation, Is.EqualTo(orientation));
            Assert.That(Quaternion.Angle(art.rotation, artOrientation), Is.LessThan(.1f));
            finger = Down(start);
            Drag(finger, end);
            AssertOnlyLegalSwap();
            float deadline = Time.realtimeSinceStartup + 8f;
            while (board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(board.IsAnimating, Is.False);
            Drag(finger, start);
            Up(finger, end);
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
        public IEnumerator ASwipeBelongsToTheNeighbourWhoseSixtyDegreeSliceItFallsIn()
        {
            yield return OpenLesson();
            Vector2 axis = end - start;
            int other = Enumerable.Range(0, game.Session.Level.cells.Length).First(i =>
                Mathf.Abs((ScreenPoint(i) - start).magnitude - axis.magnitude) < 1f &&
                Mathf.Abs(Vector2.Angle(axis, ScreenPoint(i) - start) - 60f) < .5f);
            // Headings are measured from the lesson axis toward the other neighbour, which sits 60 degrees away.
            float lesson = Mathf.Atan2(axis.y, axis.x) * Mathf.Rad2Deg;
            Vector2 toOther = ScreenPoint(other) - start;
            float span = Mathf.DeltaAngle(lesson, Mathf.Atan2(toOther.y, toOther.x) * Mathf.Rad2Deg);
            Assert.That(Mathf.Abs(span), Is.EqualTo(60f).Within(.5f));
            Vector2 Rotated(float degrees)
            {
                float heading = (lesson + Mathf.Sign(span) * degrees) * Mathf.Deg2Rad;
                return start + new Vector2(Mathf.Cos(heading), Mathf.Sin(heading)) * axis.magnitude * .8f;
            }
            // 35 degrees off the lesson axis is already the neighbouring slice: the lesson pair is not asked
            // for (the board's lesson filter then turns the neighbour down too).
            var finger = Down(start);
            Drag(finger, Rotated(35f));
            Up(finger, Rotated(35f));
            Assert.That(requests, Has.No.Member(legalSwap));
            Assert.That(requests.All(r => r == new Vector2Int(legalSwap.x, other)), Is.True);
            Assert.That(game.Session.Snapshot.turn, Is.Zero);
            requests.Clear();
            float deadline = Time.realtimeSinceStartup + 8f; // a turned-down swap plays its short shake
            while (board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(board.IsAnimating, Is.False);
            // 25 degrees off is still inside the lesson pair's slice.
            finger = Down(start);
            Drag(finger, Rotated(25f));
            AssertOnlyLegalSwap();
        }

        [UnityTest]
        public IEnumerator ShortSwipesAndTapsNeverSelectOrSwap()
        {
            yield return OpenLesson();
            var finger = Down(start);
            Drag(finger, start + (end - start).normalized * 8f);
            Up(finger, start + (end - start).normalized * 8f);
            Up(Down(start), start);
            Up(Down(end), end);
            Assert.That(requests, Is.Empty, "Normal play is swipe only; taps are ignored.");
            Assert.That(GameObject.Find("Selection"), Is.Null, "There is no selection ring outside item targeting.");
            Assert.That(game.Session.Snapshot.turn, Is.Zero);
            Up(Down(start), end);
            AssertOnlyLegalSwap();
        }

        [UnityTest]
        public IEnumerator SecondFingerCancelsAnUncommittedSwipe()
        {
            yield return OpenLesson();
            var source = GameObject.Find("Stone_" + legalSwap.x).transform;
            Vector3 home = source.position;
            var first = Down(start);
            Drag(first, start + (end - start).normalized * 4f);
            Assert.That(source.position, Is.EqualTo(home));
            var second = Down(end, 8);
            Assert.That(source.position, Is.EqualTo(home));
            Up(second, end);
            Up(first, end);
            Assert.That(requests, Is.Empty);
            Assert.That(game.Session.Snapshot.turn, Is.Zero);

            Up(Down(start), end);
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
            AssertOnlyLegalSwap();
            Assert.That(board.ReducedMotion, Is.True);
            Assert.That(source.position, Is.EqualTo(sourceHome));
            Assert.That(target.position, Is.EqualTo(targetHome));
            Up(finger, flick);
            AssertOnlyLegalSwap();
        }
    }
}
