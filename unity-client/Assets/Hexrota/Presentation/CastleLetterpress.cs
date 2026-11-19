using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    [DisallowMultipleComponent]
    [RequireComponent(typeof(Text))]
    public sealed class CastleLetterpress : BaseMeshEffect
    {
        [SerializeField] private Color upper = new Color32(255, 248, 192, 255);
        [SerializeField] private Color lower = new Color32(255, 187, 46, 255);
        [SerializeField] private Color edge = new Color32(108, 49, 13, 255);
        [SerializeField, Min(0f)] private float thickness = 1.7f;
        [SerializeField, Min(0f)] private float castDepth = 2f;

        public override void ModifyMesh(VertexHelper mesh)
        {
            if (!IsActive() || mesh.currentVertCount == 0) return;
            var glyphs = new List<UIVertex>();
            mesh.GetUIVertexStream(glyphs);
            if (glyphs.Count == 0) return;
            var painted = new List<UIVertex>(glyphs.Count * 10);
            float minY = float.MaxValue, maxY = float.MinValue;
            foreach (var v in glyphs)
            {
                minY = Mathf.Min(minY, v.position.y);
                maxY = Mathf.Max(maxY, v.position.y);
            }
            if (castDepth > 0f) Stamp(glyphs, painted, Vector2.down * (castDepth + thickness), edge);
            if (thickness > 0f)
            {
                for (int i = 0; i < 8; i++)
                {
                    float angle = i * Mathf.PI / 4f;
                    Stamp(glyphs, painted, new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * thickness, edge);
                }
            }
            foreach (var source in glyphs)
            {
                var vertex = source;
                vertex.color = (Color)source.color * Color.Lerp(lower, upper,
                    Mathf.InverseLerp(minY, maxY, source.position.y));
                painted.Add(vertex);
            }
            mesh.Clear();
            mesh.AddUIVertexTriangleStream(painted);
        }

        private static void Stamp(List<UIVertex> source, List<UIVertex> result, Vector2 offset, Color ink)
        {
            foreach (var original in source)
            {
                var vertex = original;
                vertex.position += (Vector3)offset;
                vertex.color = new Color(ink.r, ink.g, ink.b, ink.a * (original.color.a / 255f));
                result.Add(vertex);
            }
        }
    }
}
