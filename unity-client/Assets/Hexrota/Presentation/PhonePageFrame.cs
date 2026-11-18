using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // Phone menus use the same 390-unit design width as the measured mobile page.
    // The scroll viewport takes the remaining safe height on shorter devices.
    public sealed class PhonePageFrame : MonoBehaviour
    {
        private RectTransform frame, parent;
        public void Fit()
        {
            if (frame == null) frame = (RectTransform)transform;
            if (parent == null) parent = frame.parent as RectTransform;
            if (parent == null || parent.rect.width < 1 || parent.rect.height < 1) return;
            float scale = Mathf.Min(parent.rect.width / 390f, parent.rect.height / 340f);
            var size = parent.rect.size / scale;
            if ((frame.sizeDelta - size).sqrMagnitude > .0001f) frame.sizeDelta = size;
            if (!Mathf.Approximately(frame.localScale.x,scale)) frame.localScale = new Vector3(scale,scale,1);
        }
        private void LateUpdate() { Fit(); }
    }
}
