using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // Temporary soil feedback: when a soil layer breaks, a few small crumbs in the old layer's colour
    // jump out of the cell, fall and fade. Timing and count come from MotionTheme.soilCrumbs.
    public sealed class SoilCrumbs : MonoBehaviour
    {
        private static Sprite dot;
        private Transform[] pieces;
        private Vector3[] velocities;
        private SpriteRenderer[] inks;
        private float seconds, elapsed;
        private Color colour;

        /// <summary>Total time the burst lives before it removes itself.</summary>
        public float Seconds => seconds;

        internal static SoilCrumbs Burst(Transform parent, Vector3 position, Color colour, MotionTheme motion, Material material, int sortingOrder)
        {
            var node = new GameObject("Crumbs");
            node.transform.SetParent(parent, false);
            node.transform.position = position;
            var crumbs = node.AddComponent<SoilCrumbs>();
            crumbs.Setup(colour, motion.soilCrumbs.seconds, motion.soilCrumbCount, material, sortingOrder);
            return crumbs;
        }

        private void Setup(Color tone, float duration, int count, Material material, int sortingOrder)
        {
            if (dot == null)
            {
                dot = Sprite.Create(Texture2D.whiteTexture, new Rect(0, 0, 4, 4), new Vector2(.5f, .5f), 40f);
                dot.name = "Crumb";
            }
            colour = tone; seconds = Mathf.Max(.05f, duration);
            pieces = new Transform[count]; velocities = new Vector3[count]; inks = new SpriteRenderer[count];
            for (int i = 0; i < count; i++)
            {
                var piece = new GameObject("Crumb_" + i);
                piece.transform.SetParent(transform, false);
                float angle = Random.Range(0f, Mathf.PI * 2f);
                piece.transform.localPosition = new Vector3(Mathf.Cos(angle), Mathf.Sin(angle), 0) * Random.Range(.04f, .2f);
                piece.transform.localRotation = Quaternion.Euler(0, 0, Random.Range(0f, 90f));
                float size = Random.Range(.6f, 1.1f);
                piece.transform.localScale = new Vector3(size, size * Random.Range(.7f, 1f), 1);
                var ink = piece.AddComponent<SpriteRenderer>();
                ink.sprite = dot;
                ink.sharedMaterial = material;
                ink.sortingOrder = sortingOrder;
                ink.color = Color.Lerp(colour, Color.black, Random.Range(0f, .25f));
                pieces[i] = piece.transform; inks[i] = ink;
                velocities[i] = new Vector3(Mathf.Cos(angle) * Random.Range(.4f, .9f), Random.Range(.5f, 1.2f), 0);
            }
        }

        private void Update()
        {
            elapsed += Time.unscaledDeltaTime;
            float t = elapsed / seconds;
            if (t >= 1f) { Destroy(gameObject); return; }
            float dt = Time.unscaledDeltaTime;
            for (int i = 0; i < pieces.Length; i++)
            {
                velocities[i] += Vector3.down * 4.5f * dt;
                pieces[i].localPosition += velocities[i] * dt;
                var ink = inks[i].color;
                ink.a = t < .6f ? 1f : 1f - (t - .6f) / .4f;
                inks[i].color = ink;
            }
        }
    }
}
