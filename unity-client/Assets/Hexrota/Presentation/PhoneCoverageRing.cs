using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed class PhoneCoverageRing : BaseMeshEffect
    {
        private float progress;
        public void SetProgress(float value) { progress = Mathf.Clamp01(value); graphic.SetVerticesDirty(); }

        public override void ModifyMesh(VertexHelper mesh)
        {
            if (!IsActive() || progress <= 0) return;
            var rect = graphic.rectTransform.rect;
            float radius = Mathf.Min(rect.width,rect.height)/2;
            const int sides = 40;
            int start = mesh.currentVertCount, count = Mathf.CeilToInt(progress*sides);
            for (int i=0;i<=count;i++)
            {
                float angle = Mathf.Min(i/(float)sides,progress)*Mathf.PI*2;
                Vector2 direction = new Vector2(Mathf.Sin(angle),Mathf.Cos(angle));
                Color32 green = new Color32(107,159,57,255);
                mesh.AddVert(rect.center+direction*radius,green,Vector2.zero);
                mesh.AddVert(rect.center+direction*Mathf.Max(0,radius-2.6f),green,Vector2.zero);
                if (i == 0) continue;
                int edge = start+(i-1)*2;
                mesh.AddTriangle(edge,edge+2,edge+3); mesh.AddTriangle(edge+3,edge+1,edge);
            }
        }
    }
}
