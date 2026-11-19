using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // UI coordinates from BoardCamera.WorldToViewportPoint. The arrow follows the
    // real adjacent cells on all six axes without disturbing stones or their hit areas.
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class TutorialGestureArrow : MaskableGraphic
    {
        [SerializeField] private Color sourceOutline = new Color32(255, 218, 95, 255);
        [SerializeField] private Color destinationCorners = new Color32(126, 250, 211, 255);
        [SerializeField] private Color ink = new Color32(64, 33, 59, 245);
        [SerializeField, Range(.35f, .53f)] private float outlineRadius = .46f;
        [SerializeField, Range(.012f, .06f)] private float stroke = .032f;

        private static readonly Vector2[] HexCorners = {
            new Vector2(1, 0), new Vector2(.5f, .8660254f), new Vector2(-.5f, .8660254f),
            new Vector2(-1, 0), new Vector2(-.5f, -.8660254f), new Vector2(.5f, -.8660254f)
        };
        private Vector2 from, to;
        private float sweep = -1f;
        private Vector2[] matchEdges;

        internal void SetMatchEdges(Vector2[] edges)
        {
            matchEdges = edges;
            SetVerticesDirty();
        }

        public void SetPair(Vector2 source, Vector2 target)
        {
            if (from == source && to == target) return;
            from = source;
            to = target;
            SetVerticesDirty();
        }

        internal void SetSweep(float phase)
        {
            if (Mathf.Approximately(sweep, phase)) return;
            sweep = phase;
            SetVerticesDirty();
        }

        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();
            Rect rect = rectTransform.rect;
            Vector2 start = Rect.NormalizedToPoint(rect, from);
            Vector2 end = Rect.NormalizedToPoint(rect, to);
            Vector2 direction = end - start;
            float span = direction.magnitude;
            if (span < 1f) return;
            if (matchEdges != null)
            {
                DrawMatchEdges(mesh, rect, span * (stroke + .038f), ink);
                DrawMatchEdges(mesh, rect, span * stroke, destinationCorners);
                return;
            }
            Vector2 normal = new Vector2(-direction.y, direction.x);

            Ring(mesh, start, span, false, stroke + .038f, ink);
            Ring(mesh, start, span, false, stroke, sourceOutline);
            Ring(mesh, end, span, true, stroke + .038f, ink);
            Ring(mesh, end, span, true, stroke, destinationCorners);

            // Only bridge the gap between the numerals. The filled arrow and the
            // open destination corners retain their meaning even with movement off.
            Arrow(mesh, start, direction, normal, .224f, .552f, .786f, .066f, .145f, ink);
            Arrow(mesh, start, direction, normal, .251f, .58f, .746f, .038f, .094f, color);
            if (sweep >= 0f)
            {
                Vector2 glint = start + direction * Mathf.Lerp(.29f, .66f, sweep);
                Quad(mesh, glint - direction * .036f, glint + normal * .024f,
                    glint + direction * .036f, glint - normal * .024f, Color.white);
            }
        }

        private void DrawMatchEdges(VertexHelper mesh, Rect rect, float width, Color tint)
        {
            for (int i = 0; i < matchEdges.Length; i += 2)
            {
                Vector2 start = Rect.NormalizedToPoint(rect, matchEdges[i]);
                Vector2 end = Rect.NormalizedToPoint(rect, matchEdges[i + 1]);
                Vector2 axis = (end - start).normalized * (width * .5f);
                Vector2 normal = new Vector2(-axis.y, axis.x);
                // Overlap adjacent ends by half the stroke to keep the corners joined.
                Quad(mesh, start - axis - normal, start - axis + normal,
                    end + axis + normal, end + axis - normal, tint);
            }
        }

        private void Ring(VertexHelper mesh, Vector2 center, float span, bool openCorners, float width, Color tint)
        {
            float outer = span * (outlineRadius + width * .5f);
            float inner = span * (outlineRadius - width * .5f);
            for (int i = 0; i < HexCorners.Length; i++)
            {
                Vector2 a = HexCorners[i], b = HexCorners[(i + 1) % HexCorners.Length];
                if (openCorners)
                {
                    Vector2 first = Vector2.Lerp(a, b, .29f), last = Vector2.Lerp(a, b, .71f);
                    Quad(mesh, center + a * outer, center + first * outer, center + first * inner, center + a * inner, tint);
                    Quad(mesh, center + last * outer, center + b * outer, center + b * inner, center + last * inner, tint);
                }
                else Quad(mesh, center + a * outer, center + b * outer, center + b * inner, center + a * inner, tint);
            }
        }

        private static void Arrow(VertexHelper mesh, Vector2 origin, Vector2 axis, Vector2 normal,
            float tail, float neck, float tip, float stemWidth, float headWidth, Color tint)
        {
            Vector2 a = origin + axis * tail, b = origin + axis * neck;
            Quad(mesh, a - normal * stemWidth, a + normal * stemWidth, b + normal * stemWidth, b - normal * stemWidth, tint);
            int i = mesh.currentVertCount;
            mesh.AddVert(b - normal * headWidth, tint, Vector2.zero);
            mesh.AddVert(b + normal * headWidth, tint, Vector2.zero);
            mesh.AddVert(origin + axis * tip, tint, Vector2.zero);
            mesh.AddTriangle(i, i + 1, i + 2);
        }

        private static void Quad(VertexHelper mesh, Vector2 a, Vector2 b, Vector2 c, Vector2 d, Color tint)
        {
            int i = mesh.currentVertCount;
            mesh.AddVert(a, tint, Vector2.zero);
            mesh.AddVert(b, tint, Vector2.zero);
            mesh.AddVert(c, tint, Vector2.zero);
            mesh.AddVert(d, tint, Vector2.zero);
            mesh.AddTriangle(i, i + 1, i + 2);
            mesh.AddTriangle(i, i + 2, i + 3);
        }
    }
}
