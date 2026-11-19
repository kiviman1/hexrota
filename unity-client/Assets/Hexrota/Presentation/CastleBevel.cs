using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    [RequireComponent(typeof(Image))]
    [DisallowMultipleComponent]
    public sealed class CastleBevel : BaseMeshEffect
    {
        public enum Silhouette { Rounded, Triangle, Arch, CurvedRibbon, Hexagon, CutCorners }

        [SerializeField] private Silhouette shape;
        [SerializeField, Min(0)] private float radius = 12f;
        [SerializeField, Min(0)] private float rim = 2f;
        [SerializeField, Min(0)] private float depth = 2f;
        [SerializeField] private Color upperFace = new Color32(255, 245, 221, 255);
        [SerializeField] private Color lowerFace = new Color32(244, 201, 154, 255);
        [SerializeField] private Color upperRim = new Color32(255, 248, 202, 255);
        [SerializeField] private Color lowerRim = new Color32(219, 153, 68, 255);
        [SerializeField] private Color lowerEdge = new Color32(133, 75, 34, 255);
        [SerializeField, Range(0f,1f)] private float polish;

        internal void CopyFinishFrom(CastleBevel sample)
        {
            shape = sample.shape;
            radius = sample.radius;
            rim = sample.rim;
            depth = sample.depth;
            upperFace = sample.upperFace;
            lowerFace = sample.lowerFace;
            upperRim = sample.upperRim;
            lowerRim = sample.lowerRim;
            lowerEdge = sample.lowerEdge;
            polish = sample.polish;
            var image = (Image)graphic;
            var source = sample.GetComponent<Image>();
            image.sprite = source.sprite;
            image.type = source.type;
            image.color = Color.white;
            image.SetVerticesDirty();
        }

        public override void ModifyMesh(VertexHelper mesh)
        {
            // Assigning a sprite in the Image Inspector replaces this provisional face.
            if (!IsActive() || ((Image)graphic).sprite != null) return;
            Rect rect = graphic.rectTransform.rect;
            if (rect.width <= 0f || rect.height <= 0f) return;
            mesh.Clear();
            float half = Mathf.Min(rect.width, rect.height) * .5f;
            float line = Mathf.Min(rim, half * .45f);
            float extrusion = Mathf.Min(depth, half * .35f);
            if (extrusion > 0f)
            {
                var shadow = rect;
                shadow.y -= extrusion;
                Fill(mesh, shadow, radius, lowerEdge, lowerEdge);
            }
            if (line > 0f) Fill(mesh, rect, radius, lowerRim, upperRim);
            if (polish > 0 && line >= 2f)
            {
                var lip = Rect.MinMaxRect(rect.xMin+line*.48f,rect.yMin+line*.48f,
                    rect.xMax-line*.48f,rect.yMax-line*.48f);
                Fill(mesh, lip, Mathf.Max(0,radius-line*.48f), Color.Lerp(lowerRim,upperRim,.48f),
                    Color.Lerp(upperRim,lowerEdge,.38f));
            }
            var face = Rect.MinMaxRect(rect.xMin + line, rect.yMin + line,
                                       rect.xMax - line, rect.yMax - line);
            Fill(mesh, face, Mathf.Max(0f, radius - line), lowerFace, upperFace);
            if (polish > 0 && shape == Silhouette.Rounded)
            {
                // Two tapered strokes follow the upper edge of the convex enamel face.
                float rounding=Mathf.Min(radius,face.height*.5f);
                float y=face.yMax-Mathf.Max(2f,rounding*.17f);
                float left=face.xMin+rounding;
                Glint(mesh,left,Mathf.Lerp(left,face.xMax-rounding,.56f),y,polish);
                Glint(mesh,Mathf.Lerp(left,face.xMax-rounding,.82f),face.xMax-rounding,y,polish*.65f);
            }
        }

        private static void Glint(VertexHelper mesh,float start,float end,float y,float strength)
        {
            if (end-start < 3f) return;
            int v=mesh.currentVertCount;
            var light=new Color(1f,1f,.86f,strength*.66f);
            float mid=Mathf.Lerp(start,end,.28f);
            mesh.AddVert(new Vector2(start,y-.8f),Color.clear,Vector2.zero);
            mesh.AddVert(new Vector2(mid,y+.6f),light,Vector2.zero);
            mesh.AddVert(new Vector2(end,y),Color.clear,Vector2.zero);
            mesh.AddVert(new Vector2(mid,y-1.6f),light,Vector2.zero);
            mesh.AddTriangle(v,v+1,v+3); mesh.AddTriangle(v+1,v+2,v+3);
        }

        private void Fill(VertexHelper mesh, Rect rect, float corner, Color low, Color high)
        {
            int start = mesh.currentVertCount;
            int count = shape == Silhouette.Arch ? 35 : shape == Silhouette.CurvedRibbon ? 34 :
                shape == Silhouette.Triangle ? 3 : shape == Silhouette.Hexagon ? 6 :
                shape == Silhouette.CutCorners ? 8 : 36;
            mesh.AddVert(rect.center, graphic.color * Color.Lerp(low, high, .5f), Vector2.zero);
            for (int i = 0; i < count; i++)
            {
                Vector2 point = Point(rect, Mathf.Min(corner, Mathf.Min(rect.width, rect.height) * .5f), i);
                float t = Mathf.InverseLerp(rect.yMin, rect.yMax, point.y);
                mesh.AddVert(point, graphic.color * Color.Lerp(low, high, t), Vector2.zero);
            }
            for (int i = 0; i < count; i++)
                mesh.AddTriangle(start, start + 1 + (i + 1) % count, start + 1 + i);
        }

        private Vector2 Point(Rect rect, float corner, int i)
        {
            Vector2 half = rect.size * .5f;
            if (shape == Silhouette.Hexagon)
            {
                float hexAngle = i * Mathf.PI / 3f;
                return rect.center + Vector2.Scale(half, new Vector2(Mathf.Cos(hexAngle), Mathf.Sin(hexAngle) / .8660254f));
            }
            if (shape == Silhouette.CutCorners)
            {
                // A short cut alternates with a long edge at each corner.
                int side = i / 2;
                float sx = side == 0 || side == 3 ? 1f : -1f;
                float sy = side < 2 ? 1f : -1f;
                bool insetX = i % 4 == 1 || i % 4 == 2;
                return rect.center + new Vector2(sx * (half.x - (insetX ? corner : 0f)),
                    sy * (half.y - (insetX ? 0f : corner)));
            }
            if (shape == Silhouette.Arch)
            {
                float rise = Mathf.Min(rect.height * .70f, half.x);
                if (i < 25)
                {
                    float a = Mathf.PI * i / 24;
                    return new Vector2(rect.center.x + half.x * Mathf.Cos(a), rect.yMax - rise + rise * Mathf.Sin(a));
                }
                bool left = i < 30;
                float baseAngle = (left ? 180 + (i - 25) * 22.5f : 270 + (i - 30) * 22.5f) * Mathf.Deg2Rad;
                var baseCorner = new Vector2(left ? rect.xMin + corner : rect.xMax - corner, rect.yMin + corner);
                return baseCorner + new Vector2(Mathf.Cos(baseAngle), Mathf.Sin(baseAngle)) * corner;
            }
            if (shape == Silhouette.CurvedRibbon)
            {
                bool top = i < 17;
                float x = top ? 1 - i / 8f : (i - 17) / 8f - 1;
                float dip = .23f * rect.height;
                float y = (top ? rect.yMax : rect.yMin + dip) - dip * x * x;
                return new Vector2(rect.center.x + x * half.x, y);
            }
            if (shape == Silhouette.Triangle)
            {
                if (i == 0) return new Vector2(rect.xMax, rect.center.y);
                return new Vector2(rect.xMin, i == 1 ? rect.yMax : rect.yMin);
            }

            int quadrant = i / 9;
            float angle = (quadrant * 90f + i % 9 * 11.25f) * Mathf.Deg2Rad;
            var sign = new Vector2(quadrant == 0 || quadrant == 3 ? 1 : -1, quadrant < 2 ? 1 : -1);
            return rect.center + Vector2.Scale(sign, half - Vector2.one * corner)
                + new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * corner;
        }
    }
}
