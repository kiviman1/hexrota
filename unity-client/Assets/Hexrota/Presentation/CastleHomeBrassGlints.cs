using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed class CastleHomeBrassGlints : MaskableGraphic
    {
        private void Update() { SetVerticesDirty(); }
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            float time = Time.unscaledTime;
            for (int i = 0; i < 3; i++)
            {
                float cycle = Mathf.Repeat(time * .19f + i * .3333f, 1f);
                float pulse = Mathf.Pow(Mathf.Sin(cycle * Mathf.PI), 5f);
                var r = rectTransform.rect;
                var center = BorderPoint(r, Mathf.Repeat(time * .08f + i / 3f, 1f));
                Star(vh, center, 7f + pulse * 5f, pulse);
            }
        }
        private static Vector2 BorderPoint(Rect rect, float progress)
        {
            float radius = rect.height * .48f;
            float straight = Mathf.Max(0f, rect.width - 2f * radius);
            float arc = Mathf.PI * radius;
            float distance = progress * (2f * straight + 2f * arc);
            float left = rect.center.x - straight * .5f;
            float right = rect.center.x + straight * .5f;
            if (distance < straight) return new Vector2(left + distance, rect.center.y + radius);
            distance -= straight;
            if (distance < arc)
            {
                float angle = Mathf.PI * .5f - distance / radius;
                return new Vector2(right + Mathf.Cos(angle) * radius, rect.center.y + Mathf.Sin(angle) * radius);
            }
            distance -= arc;
            if (distance < straight) return new Vector2(right - distance, rect.center.y - radius);
            distance -= straight;
            float leftAngle = -Mathf.PI * .5f - distance / radius;
            return new Vector2(left + Mathf.Cos(leftAngle) * radius, rect.center.y + Mathf.Sin(leftAngle) * radius);
        }
        private static void Star(VertexHelper vh, Vector2 center, float size, float alpha)
        {
            if (alpha < .01f) return;
            int start = vh.currentVertCount;
            Color32 core = new Color(1f, .98f, .78f, alpha);
            Color32 tip = new Color(1f, .85f, .35f, 0f);
            vh.AddVert(center, core, Vector2.zero);
            for (int i = 0; i < 8; i++)
            {
                float angle = i * Mathf.PI / 4f;
                float radius = (i % 2 == 0 ? size : size * .13f);
                vh.AddVert(center + new Vector2(Mathf.Cos(angle) * radius, Mathf.Sin(angle) * radius), tip, Vector2.zero);
            }
            for (int i = 0; i < 8; i++) vh.AddTriangle(start, start + 1 + i, start + 1 + (i + 1) % 8);
        }
    }
}
