using UnityEngine;
using UnityEngine.EventSystems;

namespace Hexrota.UnityClient.Presentation
{
    [ExecuteAlways]
    [DisallowMultipleComponent]
    [RequireComponent(typeof(RectTransform))]
    public sealed class CastleHomeLayout : UIBehaviour
    {
        [SerializeField, Min(1)] private float referenceWidth = 390f;
        [SerializeField, Min(1)] private float minimumHeight = 600f;
        private bool resizing;

        protected override void OnEnable()
        {
            base.OnEnable();
            Canvas.preWillRenderCanvases += Fit;
            Fit();
        }

        protected override void OnDisable()
        {
            Canvas.preWillRenderCanvases -= Fit;
            base.OnDisable();
        }

        protected override void OnTransformParentChanged()
        {
            base.OnTransformParentChanged();
            Fit();
        }

        private void Fit()
        {
            if (resizing || !isActiveAndEnabled || !(transform.parent is RectTransform parent)) return;
            Vector2 available = parent.rect.size;
            if (available.x <= 0f || available.y <= 0f) return;
            float scale = Mathf.Min(available.x / Mathf.Max(1f, referenceWidth),
                                    available.y / Mathf.Max(1f, minimumHeight));
            var frame = (RectTransform)transform;
            Vector2 size = available / scale;
            resizing = true;
            if ((frame.sizeDelta - size).sqrMagnitude > .0001f) frame.sizeDelta = size;
            if (!Mathf.Approximately(frame.localScale.x, scale))
                frame.localScale = new Vector3(scale, scale, 1f);
            resizing = false;
        }
    }
}
