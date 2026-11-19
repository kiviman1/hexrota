using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class PhoneRibbonTails : MaskableGraphic
    {
        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();
            var rect=rectTransform.rect;
            AddTail(mesh,rect.xMin+4,-1,rect.yMax-7,rect.yMin+3);
            AddTail(mesh,rect.xMax-4,1,rect.yMax-7,rect.yMin+3);
        }

        private static void AddTail(VertexHelper mesh,float inner,float side,float top,float bottom)
        {
            int i=mesh.currentVertCount;
            var bright=new Color32(237,107,131,255);
            var dark=new Color32(166,41,83,255);
            float outer=inner+side*12;
            mesh.AddVert(new Vector2(inner,top),bright,Vector2.zero);
            mesh.AddVert(new Vector2(outer,top),bright,Vector2.zero);
            mesh.AddVert(new Vector2(outer-side*4.8f,(top+bottom)/2),Color.Lerp(bright,dark,.5f),Vector2.zero);
            mesh.AddVert(new Vector2(outer,bottom),dark,Vector2.zero);
            mesh.AddVert(new Vector2(inner,bottom),dark,Vector2.zero);
            mesh.AddTriangle(i,i+1,i+2);mesh.AddTriangle(i,i+2,i+4);mesh.AddTriangle(i+2,i+3,i+4);
        }
    }
}
