using System.Collections.Generic;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // Short-lived crate pieces: a plank spinning off a hit crate or the fragments of a broken one.
    // They fly, spin, fall and fade, then remove themselves. Duration comes from MotionTheme.
    public sealed class CrateDebris : MonoBehaviour
    {
        private readonly List<SpriteRenderer> pieces = new List<SpriteRenderer>();
        private readonly List<Vector3> velocities = new List<Vector3>();
        private readonly List<float> spins = new List<float>();
        private float seconds, elapsed;

        /// <summary>How long the pieces live.</summary>
        public float Seconds => seconds;
        public int Count => pieces.Count;

        internal static CrateDebris Create(Transform parent, string name, float duration)
        {
            var node = new GameObject(name);
            node.transform.SetParent(parent, false);
            var debris = node.AddComponent<CrateDebris>();
            debris.seconds = Mathf.Max(.05f, duration);
            return debris;
        }

        internal void Add(Sprite sprite, Color colour, int sortingOrder, Vector3 position, Quaternion rotation, Vector3 scale, Vector3 velocity, float spin)
        {
            var piece = new GameObject("Piece_" + pieces.Count);
            piece.transform.SetParent(transform, false);
            piece.transform.position = position;
            piece.transform.rotation = rotation;
            piece.transform.localScale = scale;
            var ink = piece.AddComponent<SpriteRenderer>();
            ink.sprite = sprite;
            ink.color = colour;
            ink.sortingOrder = sortingOrder;
            pieces.Add(ink); velocities.Add(velocity); spins.Add(spin);
        }

        private void Update()
        {
            float dt = Time.unscaledDeltaTime;
            elapsed += dt;
            float t = elapsed / seconds;
            if (t >= 1f) { Destroy(gameObject); return; }
            for (int i = 0; i < pieces.Count; i++)
            {
                if (pieces[i] == null) continue;
                velocities[i] += Vector3.down * 5f * dt;
                var node = pieces[i].transform;
                node.position += velocities[i] * dt;
                node.Rotate(0, 0, spins[i] * dt);
                var ink = pieces[i].color;
                ink.a = t < .55f ? ink.a : Mathf.Min(ink.a, 1f - (t - .55f) / .45f);
                pieces[i].color = ink;
            }
        }
    }
}
