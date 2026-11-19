using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // Match the phone dialog's CSS max-width and fit shorter devices by scrolling.
    public sealed class PhoneDialogFrame : MonoBehaviour
    {
        private RectTransform available, frame;
        private float requested;
        private Vector2 lastSize;
        public void Fit(RectTransform host, float height)
        {
            available = host; frame = (RectTransform)transform; requested = height;
            UpdateSize();
        }
        private void LateUpdate() { if (available != null && lastSize != available.rect.size) UpdateSize(); }
        private void UpdateSize()
        {
            lastSize = available.rect.size;
            if (lastSize.x <= 0 || lastSize.y <= 0) return;
            float scale = Mathf.Min(lastSize.x / 390f, lastSize.y / 440f);
            frame.anchorMin = frame.anchorMax = frame.pivot = new Vector2(.5f, .5f);
            frame.anchoredPosition = Vector2.zero; frame.localScale = Vector3.one * scale;
            frame.sizeDelta = new Vector2(360, Mathf.Min(requested, lastSize.y / scale * .88f));
        }
    }
}
