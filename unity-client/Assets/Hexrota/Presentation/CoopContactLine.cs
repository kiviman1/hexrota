using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // The coop's contact line: a thin dark strip along the lower half of the base disk's ellipse, where
    // the disk meets the ground. It is drawn as a mesh so its thickness stays the same at every level and
    // scale. The strip fades out on both sides (softness) and tapers away at the two ends of the arc.
    // The rect's pivot is the disk centre; CoopSpriteView sets the size and the look from CoopLook.
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class CoopContactLine : MaskableGraphic
    {
        private const int Segments = 48;
        /// <summary>Share of the arc at each end over which the strip tapers away.</summary>
        public const float Taper = .16f;

        [SerializeField] private Vector2 radii = new Vector2(100, 30);
        [SerializeField] private float thickness = 3, softness = 1, outset = 1;

        public Vector2 Radii => radii;
        public float Thickness => thickness;

        public void Set(Vector2 diskRadii, float lineThickness, float lineSoftness, float lineOutset, Color lineColor)
        {
            radii = diskRadii;
            thickness = Mathf.Max(0, lineThickness);
            softness = Mathf.Max(0, lineSoftness);
            outset = lineOutset;
            color = lineColor;
            rectTransform.sizeDelta = diskRadii * 2;
            SetVerticesDirty();
        }

        /// <summary>The point of the strip's centre line at <paramref name="t"/> (0 = left end, 1 = right end), relative to the disk centre.</summary>
        public Vector2 PointAt(float t, out Vector2 normal)
        {
            float a = Mathf.PI * (1 + t);
            var edge = new Vector2(radii.x * Mathf.Cos(a), radii.y * Mathf.Sin(a));
            normal = new Vector2(Mathf.Cos(a) / Mathf.Max(radii.x, .01f), Mathf.Sin(a) / Mathf.Max(radii.y, .01f)).normalized;
            return edge + normal * outset;
        }

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            if (thickness <= 0 || radii.x <= 0 || radii.y <= 0) return;
            var c = (Color32)color;
            var clear = new Color32(c.r, c.g, c.b, 0);
            for (int i = 0; i <= Segments; i++)
            {
                float t = i / (float)Segments;
                var p = PointAt(t, out var n);
                float end = Mathf.SmoothStep(0, 1, Mathf.Min(t, 1 - t) / Taper);
                float half = thickness * Mathf.Lerp(.35f, 1, end) / 2;
                var core = new Color32(c.r, c.g, c.b, (byte)Mathf.RoundToInt(c.a * end));
                vh.AddVert(p - n * (half + softness), clear, Vector4.zero);
                vh.AddVert(p - n * half, core, Vector4.zero);
                vh.AddVert(p + n * half, core, Vector4.zero);
                vh.AddVert(p + n * (half + softness), clear, Vector4.zero);
                if (i == 0) continue;
                int b = (i - 1) * 4, d = i * 4;
                for (int k = 0; k < 3; k++)
                {
                    vh.AddTriangle(b + k, d + k, d + k + 1);
                    vh.AddTriangle(b + k, d + k + 1, b + k + 1);
                }
            }
        }
    }
}
