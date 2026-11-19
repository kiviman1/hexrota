using NUnit.Framework;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    internal static class StoneArtAssertions
    {
        internal static void ShowsNumber(Transform stone, int value)
        {
            var model = stone.Find("Model");
            Assert.That(model, Is.Not.Null, stone.name);
            var mesh = model.GetComponent<MeshFilter>().sharedMesh;
            Assert.That(mesh, Is.Not.Null, stone.name);
            Assert.That(mesh.name, Is.EqualTo("ToneRelief_" + value), stone.name);
            Assert.That(model.GetComponent<MeshRenderer>().enabled, Is.True, stone.name);
            Assert.That(stone.GetComponentInChildren<TextMesh>(), Is.Null,
                "The visible numeral comes from the numbered FBX.");
        }
    }
}
