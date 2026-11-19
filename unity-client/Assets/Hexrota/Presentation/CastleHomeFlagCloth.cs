using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Attach to an independently authored cloth Image, never to the castle.
    // The fixed pole edge remains in place while the free end ripples.
    [RequireComponent(typeof(Image))]
    public sealed class CastleHomeFlagCloth : BaseMeshEffect
    {
        [SerializeField, Range(0f, .25f)] private float amplitude = .09f;
        [SerializeField, Min(0f)] private float speed = 2f;
        [SerializeField] private float phaseOffset;

        private void Update()
        {
            if (graphic != null) graphic.SetVerticesDirty();
        }

        public override void ModifyMesh(VertexHelper mesh)
        {
            if (!IsActive() || mesh.currentVertCount != 4) return;
            var a = new UIVertex(); var b = new UIVertex(); var c = new UIVertex(); var d = new UIVertex();
            mesh.PopulateUIVertex(ref a, 0); mesh.PopulateUIVertex(ref b, 1);
            mesh.PopulateUIVertex(ref c, 2); mesh.PopulateUIVertex(ref d, 3);
            mesh.Clear();
            const int columns = 24, rows = 6;
            float time = Time.unscaledTime + phaseOffset;
            float height = Mathf.Abs(b.position.y - a.position.y);
            for (int y = 0; y <= rows; y++)
            for (int x = 0; x <= columns; x++)
            {
                float u = x / (float)columns, v = y / (float)rows;
                var p = a;
                p.position = Vector3.Lerp(Vector3.Lerp(a.position, d.position, u), Vector3.Lerp(b.position, c.position, u), v);
                p.uv0 = Vector2.Lerp(Vector2.Lerp(a.uv0, d.uv0, u), Vector2.Lerp(b.uv0, c.uv0, u), v);
                float freeEnd = u * u;
                p.position.y += Mathf.Sin(time * speed - u * 7f) * height * amplitude * freeEnd;
                p.position.x += Mathf.Sin(time * speed * .8f - u * 5f) * height * amplitude * .28f * freeEnd;
                mesh.AddVert(p);
            }
            for (int y = 0; y < rows; y++)
            for (int x = 0; x < columns; x++)
            {
                int i = y * (columns + 1) + x;
                mesh.AddTriangle(i, i + columns + 1, i + columns + 2);
                mesh.AddTriangle(i + columns + 2, i + 1, i);
            }
        }
    }
}
