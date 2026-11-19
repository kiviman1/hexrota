using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Inlaid hex outlines in the illustration well.
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class CastlePopupPattern : MaskableGraphic
    {
        [SerializeField, Min(8f)] private float cellSize = 21f;
        private enum Motif { Honeycomb, Glow, Glint }
        [SerializeField] private Motif motif;

        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();
            Rect bounds = rectTransform.rect;
            if (motif != Motif.Honeycomb)
            {
                bool glow=motif==Motif.Glow;
                int count=glow?32:8;
                mesh.AddVert(bounds.center,color,Vector2.zero);
                for(int i=0;i<count;i++)
                {
                    float angle=i*2f*Mathf.PI/count;
                    var dir=new Vector2(Mathf.Cos(angle),Mathf.Sin(angle));
                    float fraction=glow || i%2==0 ? .5f : .12f;
                    var point=bounds.center+Vector2.Scale(bounds.size,dir)*fraction;
                    mesh.AddVert(point,glow?Color.clear:color,Vector2.zero);
                }
                for(int i=0;i<count;i++) mesh.AddTriangle(0,1+(i+1)%count,1+i);
                return;
            }
            float radius = Mathf.Max(8f, cellSize);
            int row = 0;
            for (float y = bounds.yMin + radius; y <= bounds.yMax - radius; y += radius * 1.65f, row++)
            {
                float start = bounds.xMin + radius + (row % 2) * radius;
                for (float x = start; x <= bounds.xMax - radius; x += radius * 2f)
                {
                    var center = new Vector2(x, y);
                    int first = mesh.currentVertCount;
                    for (int i = 0; i < 6; i++)
                    {
                        float a = (i * 60f + 30f) * Mathf.Deg2Rad;
                        var dir = new Vector2(Mathf.Cos(a), Mathf.Sin(a));
                        mesh.AddVert(center + radius * .78f * dir, color, Vector2.zero);
                        mesh.AddVert(center + radius * .94f * dir, color, Vector2.zero);
                    }
                    for (int i = 0; i < 6; i++)
                    {
                        int v = first + 2*i, next = first + 2*((i+1)%6);
                        mesh.AddTriangle(v, next, v+1);
                        mesh.AddTriangle(v+1, next, next+1);
                    }
                }
            }
        }
    }
}
