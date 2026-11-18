using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // uGUI button tint, clipping and raycasts still belong to the original Image.
    // Two rings and a fan reproduce the rounded CSS border and vertical gradient.
    [RequireComponent(typeof(Image))]
    public sealed class PhonePlate : BaseMeshEffect
    {
        private Color top, bottom, edge;
        private float radius, stroke;
        private const int CornerSegments = 8;

        internal void Configure(Color high, Color low, Color border, float cornerRadius, float width)
        {
            top = high; bottom = low; edge = border; radius = cornerRadius; stroke = width;
            var image = (Image)graphic;
            image.sprite = null; image.type = Image.Type.Simple; image.color = Color.white;
            image.SetVerticesDirty();
        }

        public override void ModifyMesh(VertexHelper mesh)
        {
            if (!IsActive()) return;
            mesh.Clear();
            Rect rect = graphic.rectTransform.rect;
            if (rect.width <= 0 || rect.height <= 0) return;
            float limit = Mathf.Min(rect.width, rect.height) * .5f;
            float r = Mathf.Clamp(radius, 0, limit), line = Mathf.Clamp(stroke, 0, limit);
            mesh.AddVert(rect.center, Color.Lerp(bottom, top, .5f), Vector2.zero);
            const int count = 4 * (CornerSegments + 1);
            for (int i = 0; i < count; i++)
            {
                int corner = i / (CornerSegments + 1);
                float a = (corner * 90 + (i % (CornerSegments + 1)) * 90f / CornerSegments) * Mathf.Deg2Rad;
                var normal = new Vector2(Mathf.Cos(a), Mathf.Sin(a));
                var sign = new Vector2(corner == 0 || corner == 3 ? 1 : -1, corner < 2 ? 1 : -1);
                Vector2 mid = rect.center + Vector2.Scale(sign, rect.size / 2 - Vector2.one * r);
                Vector2 outer = mid + normal * r;
                float innerRadius = Mathf.Max(0, r - line);
                Vector2 inner = rect.center + Vector2.Scale(sign, rect.size / 2 - Vector2.one * (innerRadius + line)) + normal * innerRadius;
                mesh.AddVert(inner, Color.Lerp(bottom, top, Mathf.InverseLerp(rect.yMin, rect.yMax, inner.y)), Vector2.zero);
                mesh.AddVert(inner, edge, Vector2.zero);
                mesh.AddVert(outer, edge, Vector2.zero);
            }
            for (int i = 0; i < count; i++)
            {
                int n = 1 + 3 * i, next = 1 + 3 * ((i + 1) % count);
                mesh.AddTriangle(0, next, n);
                mesh.AddTriangle(n + 1, next + 1, next + 2);
                mesh.AddTriangle(n + 1, next + 2, n + 2);
            }
        }
    }
}
