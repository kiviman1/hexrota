using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // A single UI mesh for the light behind the badge and two sprays of seeds.
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class VictoryBloomGraphic : MaskableGraphic
    {
        [SerializeField] private Color sunlight = new Color32(255, 210, 102, 140);
        [SerializeField] private Color leaf = new Color32(143, 241, 174, 255);
        [SerializeField] private Color blossom = new Color32(255, 153, 149, 255);
        private float phase;
        private bool still;

        internal void SetPhase(float value, bool reduced)
        {
            if (Mathf.Approximately(value, phase) && reduced == still) return;
            phase = value;
            still = reduced;
            SetVerticesDirty();
        }

        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();
            Vector2 center = rectTransform.rect.center;
            float radius = Mathf.Min(rectTransform.rect.width, rectTransform.rect.height) * .49f;
            float turn = still ? 0f : phase * .12f;
            for (int i = 0; i < 20; i++)
            {
                float angle = i * (Mathf.PI * .1f) + turn;
                int start = mesh.currentVertCount;
                Color light = color * sunlight;
                var outer = new Color(light.r, light.g, light.b, 0f);
                float length = radius * (i % 2 == 0 ? 1.05f : .90f);
                mesh.AddVert(center, light, Vector2.zero);
                mesh.AddVert(center + Direction(angle - .095f) * length, outer, Vector2.zero);
                mesh.AddVert(center + Direction(angle + .095f) * length, outer, Vector2.zero);
                mesh.AddTriangle(start, start + 1, start + 2);
            }
            for (int i = 0; i < 28; i++)
            {
                float delay = (i % 5) * .027f;
                float t = still ? .56f : Mathf.Clamp01((phase - delay) / .83f);
                if (t <= 0f || t >= 1f) continue;
                float angle = (i * 137.508f + 10f) * Mathf.Deg2Rad;
                Vector2 axis = Direction(angle);
                float range = radius * (.74f + .29f * ((i * 13) % 8) / 7f);
                Vector2 position = center + axis * (range * (.39f + .78f * (1f - (1f - t) * (1f - t))));
                position.y -= radius * .32f * t * t;
                Color ink = (i % 3 == 0 ? blossom : i % 3 == 1 ? leaf : sunlight) * color;
                ink.a *= Mathf.SmoothStep(0, 1, t / .1f) * Mathf.SmoothStep(0, 1, (1f - t) / .28f);
                float size = radius * (i % 4 == 0 ? .036f : .023f);
                if (i % 4 == 0)
                {
                    Diamond(mesh, position, Vector2.up * size, Vector2.right * (size * .28f), ink);
                    Diamond(mesh, position, Vector2.right * (size * .8f), Vector2.up * (size * .22f), ink);
                }
                else
                {
                    Vector2 length = Direction(angle + (still ? 0 : t * 2f)) * size;
                    Diamond(mesh, position, length, new Vector2(-length.y, length.x) * .38f, ink);
                }
            }
        }

        private static Vector2 Direction(float radians) => new Vector2(Mathf.Cos(radians), Mathf.Sin(radians));

        private static void Diamond(VertexHelper mesh, Vector2 center, Vector2 length, Vector2 width, Color ink)
        {
            int start = mesh.currentVertCount;
            mesh.AddVert(center + length, ink, Vector2.zero);
            mesh.AddVert(center + width, ink, Vector2.zero);
            mesh.AddVert(center - length, ink, Vector2.zero);
            mesh.AddVert(center - width, ink, Vector2.zero);
            mesh.AddTriangle(start, start + 1, start + 2);
            mesh.AddTriangle(start, start + 2, start + 3);
        }
    }
}
