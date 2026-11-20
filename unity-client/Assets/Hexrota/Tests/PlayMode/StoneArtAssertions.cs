using NUnit.Framework;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    internal static class StoneArtAssertions
    {
        // A stone is its hand-painted sprite and a numeral drawn in code: white face over a dark outline.
        internal static void ShowsNumber(Transform stone, int value)
        {
            var model = stone.Find("Model");
            Assert.That(model, Is.Not.Null, stone.name);
            var art = model.GetComponent<SpriteRenderer>();
            Assert.That(art, Is.Not.Null, stone.name);
            Assert.That(art.enabled, Is.True, stone.name);
            Assert.That(art.sprite, Is.Not.Null, stone.name);
            Assert.That(art.sprite.name, Is.EqualTo("Stone_" + value), stone.name);
            var labels = stone.GetComponentsInChildren<TextMesh>();
            Assert.That(labels, Is.Not.Empty, "The numeral is drawn in code.");
            foreach (var label in labels) Assert.That(label.text, Is.EqualTo(value.ToString()), stone.name);
            var face = System.Array.Find(labels, label => label.name.StartsWith("Value_"));
            Assert.That(face, Is.Not.Null, stone.name);
            // White face; a lesson may fade the whole numeral (alpha) together with its stone.
            Assert.That((Vector3)(Vector4)face.color, Is.EqualTo(Vector3.one));
            Assert.That(labels.Length, Is.GreaterThan(1), "The white numeral has a dark outline.");
        }
    }
}
