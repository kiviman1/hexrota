using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Printed route fragments around the edges of Tavik's field guide.
    public sealed class LoadingMapGraphic : MaskableGraphic
    {
        private static readonly Vector2[] West = {
            new Vector2(-.07f,.67f), new Vector2(.09f,.74f), new Vector2(.09f,.83f),
            new Vector2(.26f,.90f), new Vector2(.40f,.90f), new Vector2(.54f,1.04f)
        };
        private static readonly Vector2[] East = {
            new Vector2(.43f,-.05f), new Vector2(.63f,.09f), new Vector2(.78f,.09f),
            new Vector2(.93f,.18f), new Vector2(.93f,.31f), new Vector2(1.08f,.37f)
        };

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            DrawRoute(vh, West);
            DrawRoute(vh, East);
        }

        private void DrawRoute(VertexHelper vh, Vector2[] path)
        {
            Rect rect = rectTransform.rect;
            for (int i = 1; i < path.Length; i++)
            {
                Vector2 start = Rect.NormalizedToPoint(rect, path[i - 1]);
                Vector2 end = Rect.NormalizedToPoint(rect, path[i]);
                float length = Vector2.Distance(start, end);
                if (length < 1f) continue;
                Vector2 delta = (end - start) / length;
                Vector2 side = new Vector2(-delta.y, delta.x);
                for (float t = 10; t < length - 7; t += 18)
                {
                    Vector2 a = start + delta * t;
                    Vector2 b = start + delta * Mathf.Min(t + 8f, length - 7f);
                    AddQuad(vh, a - side, a + side, b + side, b - side);
                }
                AddQuad(vh, end + Vector2.left * 5, end + Vector2.up * 6,
                    end + Vector2.right * 5, end + Vector2.down * 6);
            }
        }

        private void AddQuad(VertexHelper vh, Vector2 a, Vector2 b, Vector2 c, Vector2 d)
        {
            int index = vh.currentVertCount;
            vh.AddVert(a, color, Vector2.zero);
            vh.AddVert(b, color, Vector2.zero);
            vh.AddVert(c, color, Vector2.zero);
            vh.AddVert(d, color, Vector2.zero);
            vh.AddTriangle(index, index + 1, index + 2);
            vh.AddTriangle(index, index + 2, index + 3);
        }
    }
}
