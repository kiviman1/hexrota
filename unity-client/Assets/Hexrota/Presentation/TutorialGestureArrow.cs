using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class TutorialGestureArrow : MaskableGraphic
    {
        private Vector2 from, to;
        public void SetPair(Vector2 a, Vector2 b)
        {
            if (from == a && to == b) return;
            from = a; to = b; SetVerticesDirty();
        }

        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();
            var rect = rectTransform.rect;
            Vector2 start = UnityEngine.Rect.NormalizedToPoint(rect,from), end = UnityEngine.Rect.NormalizedToPoint(rect,to);
            Vector2 delta = end-start;
            float distance = delta.magnitude;
            if (distance < 1) return;
            // Neighbour centers are 44*sqrt(3) units apart in board-view.js.
            float unit = distance/(44f*Mathf.Sqrt(3));
            Vector2 dir = delta/distance, normal = new Vector2(dir.y,-dir.x);
            start += (normal+dir)*17*unit; end += (normal-dir)*17*unit;
            float len = Vector2.Distance(start,end);
            for (float x=0;x<len;x+=7*unit)
            {
                Vector2 a = start+dir*x, b = start+dir*Mathf.Min(len,x+4*unit);
                Vector2 n = normal*1.3f*unit;
                int idx = mesh.currentVertCount;
                mesh.AddVert(a+n,color,Vector2.zero); mesh.AddVert(b+n,color,Vector2.zero);
                mesh.AddVert(b-n,color,Vector2.zero); mesh.AddVert(a-n,color,Vector2.zero);
                mesh.AddTriangle(idx,idx+1,idx+2); mesh.AddTriangle(idx+2,idx+3,idx);
            }
            int tip = mesh.currentVertCount;
            mesh.AddVert(end+dir*2.6f*unit,color,Vector2.zero);
            mesh.AddVert(end-dir*13*unit+normal*9.1f*unit,color,Vector2.zero);
            mesh.AddVert(end-dir*13*unit-normal*9.1f*unit,color,Vector2.zero);
            mesh.AddTriangle(tip,tip+1,tip+2);
        }
    }
}
