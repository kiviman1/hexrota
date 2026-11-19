using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // Home background built from separate painted layers (art/HomeBackground). The sky Image on the
    // same object fills the phone with CastleHomeBackdrop (cover); this component lays the art frame
    // over exactly the same crop, so every child (clouds, ground, coop plot) is placed in source-art
    // coordinates and stays registered with the sky at any screen size.
    // Clouds drift right at MotionTheme.cloudDriftSpeeds and wrap around the visible width; they stop
    // with reduced motion.
    [DisallowMultipleComponent]
    [RequireComponent(typeof(CastleHomeBackdrop))]
    public sealed class HomeBackgroundLayers : MonoBehaviour
    {
        [SerializeField] private MotionTheme motion;
        [Tooltip("Covers the same area as the cropped sky; children use anchors in source-art space.")]
        [SerializeField] private RectTransform frame;
        [Tooltip("Size of the source painting in pixels; cloud speeds are given in these pixels.")]
        [SerializeField] private Vector2 artSize = new Vector2(1170, 2532);
        [Tooltip("Back to front; cloud i drifts at MotionTheme.cloudDriftSpeeds[i].")]
        [SerializeField] private RectTransform[] clouds = new RectTransform[0];
        [Tooltip("Dirt plot in the ground painting where the 3D coop will stand.")]
        [SerializeField] private RectTransform coopPlot;

        private CastleHomeBackdrop backdrop;
        private float visibleMin, visibleMax = 1f;
        private bool reducedMotion;

        public RectTransform Frame => frame;
        public RectTransform CoopPlot => coopPlot;
        public bool ReducedMotion => reducedMotion;
        public RectTransform[] Clouds => clouds;
        public Vector2 ArtSize => artSize;

        public void SetReducedMotion(bool reduced) => reducedMotion = reduced;

        private void OnEnable()
        {
            backdrop = GetComponent<CastleHomeBackdrop>();
            Fit();
        }

        private void LateUpdate()
        {
            Fit();
            if (reducedMotion || motion == null || motion.cloudDriftSpeeds == null) return;
            float delta = Time.unscaledDeltaTime;
            for (int i = 0; i < clouds.Length && i < motion.cloudDriftSpeeds.Length; i++)
                Drift(clouds[i], motion.cloudDriftSpeeds[i] / artSize.x * delta);
        }

        // A cloud that leaves the visible right edge comes back from the visible left edge.
        private void Drift(RectTransform cloud, float step)
        {
            if (cloud == null || step == 0f) return;
            Vector2 min = cloud.anchorMin, max = cloud.anchorMax;
            min.x += step; max.x += step;
            float width = max.x - min.x;
            if (min.x > visibleMax) { min.x = visibleMin - width; max.x = visibleMin; }
            else if (max.x < visibleMin) { max.x = visibleMax + width; min.x = visibleMax; }
            cloud.anchorMin = min; cloud.anchorMax = max;
        }

        /// <summary>Places the frame over the sky's cover crop; safe to call any time.</summary>
        public void Fit()
        {
            if (frame == null || backdrop == null || artSize.x <= 0 || artSize.y <= 0) return;
            var local = (RectTransform)transform;
            Rect display = backdrop.DisplayRect();
            if (display.width <= 0 || display.height <= 0) return;
            float ratio = (display.width / display.height) / (artSize.x / artSize.y);
            Vector2 visible = backdrop.Cover ? new Vector2(Mathf.Min(1f, ratio), Mathf.Min(1f, 1f / ratio)) : Vector2.one;
            Vector2 focal = backdrop.FocalPoint;
            Vector2 size = new Vector2(display.width / visible.x, display.height / visible.y);
            Vector2 origin = new Vector2(display.xMin - Mathf.Clamp01(focal.x) * (1f - visible.x) * size.x,
                                         display.yMin - Mathf.Clamp01(focal.y) * (1f - visible.y) * size.y);
            var position = origin - local.rect.min;
            if (frame.anchorMin != Vector2.zero || frame.anchorMax != Vector2.zero || frame.pivot != Vector2.zero)
            {
                frame.anchorMin = frame.anchorMax = frame.pivot = Vector2.zero;
            }
            if ((frame.anchoredPosition - position).sqrMagnitude > .0001f) frame.anchoredPosition = position;
            if ((frame.sizeDelta - size).sqrMagnitude > .0001f) frame.sizeDelta = size;
            visibleMin = (display.xMin - origin.x) / size.x;
            visibleMax = (display.xMax - origin.x) / size.x;
        }
    }
}
