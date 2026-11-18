using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Dialog dimensions come from the 390px phone layout. Keep tap targets at their
    // authored size and scroll the contents when the safe viewport is shorter.
    public sealed class MobileSheetViewport : MonoBehaviour
    {
        private RectTransform frame, content, safe;
        private ScrollRect scroll;
        private float height;
        private Vector2 previous;

        public void Configure(RectTransform parent, RectTransform sheet, RectTransform rows, ScrollRect scroller, float designHeight)
        {
            safe = parent; frame = sheet; content = rows; scroll = scroller;
            height = designHeight;
            previous = new Vector2(-1, -1);
            Resize();
        }

        private void LateUpdate() { Resize(); }
        private void Resize()
        {
            if (safe == null || frame == null || content == null) return;
            Vector2 size = safe.rect.size;
            if (size == previous || size.x <= 0 || size.y <= 0) return;
            previous = size;
            float scale = Mathf.Min(size.x / 390f, size.y / 500f);
            float available = size.y / scale - 32f;
            float visible = Mathf.Min(available, height);
            frame.anchorMin = frame.anchorMax = frame.pivot = new Vector2(.5f, .5f);
            frame.sizeDelta = new Vector2(360, visible);
            frame.localScale = new Vector3(scale, scale, 1);
            frame.anchoredPosition = Vector2.zero;
            content.anchorMin = new Vector2(0, 1); content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(.5f, 1); content.sizeDelta = new Vector2(0, height);
            scroll.vertical = visible + .1f < height;
            if (scroll.verticalNormalizedPosition > .999f || !scroll.vertical) content.anchoredPosition = Vector2.zero;
        }
    }
}
