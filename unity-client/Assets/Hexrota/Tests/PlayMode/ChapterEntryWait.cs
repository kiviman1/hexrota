using System.Collections;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    internal static class ChapterEntryWait
    {
        internal static IEnumerator Ready(FirstPlayableController game)
        {
            float deadline = Time.realtimeSinceStartup + 8f;
            while (game.IsEnteringStage && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(game.IsEnteringStage, Is.False, "The chapter entrance must complete within its presentation budget.");
            Assert.That(game.CurrentScreen, Is.Not.EqualTo("loading"));
            yield return null;
        }

        internal static IEnumerator PlayOpeningMove(FirstPlayableController game)
        {
            var pair = game.Session.OpeningLessonPair;
            Assert.That(pair, Has.Length.EqualTo(2));
            game.RequestSwap(pair[0], pair[1]);
            float deadline = Time.realtimeSinceStartup + 12f;
            while (game.Board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(game.Session.Snapshot.turn, Is.EqualTo(1));
            Assert.That(game.Session.OpeningLessonPair, Is.Null);
            Assert.That(game.Board.IsAnimating, Is.False);
        }
    }
}
