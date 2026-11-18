using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // The six vertices are the clipped hexagon used by the journey's CSS map-number.
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class PhoneChapterBadge : MaskableGraphic
    {
        private static readonly Vector2[] Points = {
            new Vector2(.5f,1), new Vector2(1,.75f), new Vector2(1,.25f),
            new Vector2(.5f,0), new Vector2(0,.25f), new Vector2(0,.75f)
        };
        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();
            var box=rectTransform.rect;
            mesh.AddVert(box.center,color,Vector2.zero);
            for(int i=0;i<Points.Length;i++)
                mesh.AddVert(box.min + Vector2.Scale(Points[i],box.size),color,Points[i]);
            for(int i=0;i<Points.Length;i++) mesh.AddTriangle(0,i+1,(i+1)%Points.Length+1);
        }
    }
}
