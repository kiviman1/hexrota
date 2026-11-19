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
    }
}
