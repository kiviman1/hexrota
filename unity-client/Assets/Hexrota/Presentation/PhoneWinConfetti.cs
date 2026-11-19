using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // The web win-dialog draws these same coloured strips, deterministic offsets
    // and 2.5-second fall. One mesh keeps them independent of the board's RNG.
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class PhoneWinConfetti : MaskableGraphic
    {
        public int Pieces {get;set;}
        private float started;
        private static readonly Color32[] Colors={new Color32(155,190,115,255),new Color32(196,232,155,255),
            new Color32(184,165,207,255),new Color32(219,223,185,255)};
        protected override void OnEnable(){base.OnEnable();started=Time.unscaledTime;}
        private void Update()
        {
            if(Time.unscaledTime-started>2.9f){enabled=false;return;}
            SetVerticesDirty();
        }
        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();var rect=rectTransform.rect;
            for(int i=0;i<Pieces;i++)
            {
                float t=Mathf.Clamp01((Time.unscaledTime-started-i%7*.06f)/2.5f);
                float fall=t*t;
                float x=rect.xMin+rect.width*(i*37%100)/100f+(i%2==0?-1:1)*(20+2*i)*fall;
                float y=rect.yMax+18-540*fall;
                Vector2 center=new Vector2(x,y);
                float angle=650*fall*Mathf.Deg2Rad;
                Vector2 width=new Vector2(Mathf.Cos(angle),Mathf.Sin(angle))*2.5f;
                Vector2 height=new Vector2(-Mathf.Sin(angle),Mathf.Cos(angle))*5;
                Color tint=Colors[i%4];tint.a=1-fall;
                int n=mesh.currentVertCount;
                mesh.AddVert(center-width-height,tint,Vector2.zero);mesh.AddVert(center-width+height,tint,Vector2.zero);
                mesh.AddVert(center+width+height,tint,Vector2.zero);mesh.AddVert(center+width-height,tint,Vector2.zero);
                mesh.AddTriangle(n,n+1,n+2);mesh.AddTriangle(n,n+2,n+3);
            }
        }
    }
}
