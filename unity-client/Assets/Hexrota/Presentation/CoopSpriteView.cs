using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // The coop on the home plot as a 2D sprite per level (Art/Coop2D: Coop_L0 foundation, Coop_L1..L4).
    // Every sprite's pivot is the bottom-centre of its base disk, so all levels stand on the same point
    // (this RectTransform's pivot, on the plot). The size comes from the plot width: the base disk of
    // level n is diskFraction[n] of the plot, so the coop grows with each level without leaving the plot.
    // A soft purple blob shadow sits under the disk. Reduced motion swaps levels with a short cross-fade.
    [DisallowMultipleComponent]
    public sealed class CoopSpriteView : MonoBehaviour
    {
        [SerializeField] private UiTheme ui;
        [Tooltip("Level sprites in order: Coop_L0 (foundation) .. Coop_L4.")]
        [SerializeField] private Sprite[] levels = new Sprite[0];
        [Tooltip("Width of each sprite's base disk in its own pixels (from coop_sprites.json).")]
        [SerializeField] private float[] diskPixels = new float[0];
        [Tooltip("Base disk width per level as a fraction of the plot width: the coop grows but stays on the plot.")]
        [SerializeField] private float[] diskFraction = { .55f, .6f, .68f, .76f, .84f };
        [SerializeField] private RectTransform plot;
        [SerializeField] private Image image, previous, shadow;
        [Tooltip("Blob shadow size relative to the disk (width, height) and its centre above the pivot (fraction of the disk width).")]
        [SerializeField] private Vector2 shadowSize = new Vector2(1.08f, .3f);
        [SerializeField] private float shadowLift = .1f;
        [Tooltip("Ready badge, kept at the top-right of the shown sprite (fraction of its size from the pivot).")]
        [SerializeField] private RectTransform badge;
        [SerializeField] private Vector2 badgeAt = new Vector2(.34f, .82f);

        private int shown = -1;
        private float fadeTime, fadeSeconds;
        private float plotWidth;

        public int Level => shown;
        public string ShownName => shown >= 0 && shown < levels.Length && levels[shown] != null ? levels[shown].name : null;
        public int LevelCount => levels.Length;
        public Image Image => image;
        public Image Shadow => shadow;
        public bool Fading => previous != null && previous.gameObject.activeSelf;

        /// <summary>The shown sprite's rect in the parent's space, relative to the parent's pivot.</summary>
        public Rect Bounds
        {
            get
            {
                var rt = image.rectTransform;
                var r = rt.rect;
                return new Rect(rt.localPosition.x + r.x, rt.localPosition.y + r.y, r.width, r.height);
            }
        }

        private void Awake()
        {
            if (shadow != null && ui != null) shadow.color = ui.contactShadow;
            if (previous != null) previous.gameObject.SetActive(false);
            if (shown < 0) Show(0);
        }

        /// <summary>Shows a level at once (levels past the last show the last).</summary>
        public void Show(int level)
        {
            if (levels.Length == 0) return;
            level = Mathf.Clamp(level, 0, levels.Length - 1);
            if (previous != null) previous.gameObject.SetActive(false);
            image.canvasRenderer.SetAlpha(1);
            shown = level;
            Apply(image, level);
        }

        /// <summary>Cross-fades from the shown level to another over <paramref name="seconds"/> (reduced motion).</summary>
        public void CrossFade(int level, float seconds)
        {
            if (previous == null || seconds <= 0 || shown < 0) { Show(level); return; }
            int from = shown;
            Show(level);
            previous.gameObject.SetActive(true);
            Apply(previous, from);
            fadeTime = 0;
            fadeSeconds = seconds;
            image.canvasRenderer.SetAlpha(0);
            previous.canvasRenderer.SetAlpha(1);
        }

        /// <summary>Ends a cross-fade at once.</summary>
        public void FinishFade()
        {
            if (!Fading) return;
            previous.gameObject.SetActive(false);
            image.canvasRenderer.SetAlpha(1);
        }

        private void Apply(Image target, int level)
        {
            var sprite = levels[level];
            target.sprite = sprite;
            if (sprite == null) return;
            var rect = target.rectTransform;
            var size = SizeOf(level);
            rect.anchorMin = rect.anchorMax = new Vector2(.5f, 0);
            rect.pivot = new Vector2(sprite.pivot.x / sprite.rect.width, sprite.pivot.y / sprite.rect.height);
            rect.anchoredPosition = Vector2.zero;
            rect.sizeDelta = size;
            if (target == image && shadow != null)
            {
                float disk = DiskWidth(level);
                var s = shadow.rectTransform;
                s.anchorMin = s.anchorMax = new Vector2(.5f, 0);
                s.pivot = new Vector2(.5f, .5f);
                s.sizeDelta = new Vector2(disk * shadowSize.x, disk * shadowSize.y);
                s.anchoredPosition = new Vector2(0, disk * shadowLift);
            }
            if (target == image && badge != null)
            {
                badge.anchorMin = badge.anchorMax = new Vector2(.5f, 0);
                badge.anchoredPosition = Vector2.Scale(size, badgeAt);
            }
        }

        private float DiskWidth(int level) =>
            (plot != null ? plot.rect.width : 300f) * (level < diskFraction.Length ? diskFraction[level] : diskFraction[diskFraction.Length - 1]);

        /// <summary>On-screen size of a level's sprite, in this view's units.</summary>
        public Vector2 SizeOf(int level)
        {
            var sprite = levels[level];
            float pixels = level < diskPixels.Length && diskPixels[level] > 0 ? diskPixels[level] : sprite.rect.width;
            return sprite.rect.size * (DiskWidth(level) / pixels);
        }

        /// <summary>Re-fits the shown level to the plot now (the plot follows the background's cover fit).</summary>
        public void Refresh()
        {
            if (shown < 0 || plot == null) return;
            plotWidth = plot.rect.width;
            Apply(image, shown);
        }

        private void LateUpdate()
        {
            // The plot follows the background's cover fit; keep the coop sized to it.
            if (plot != null && shown >= 0 && !Mathf.Approximately(plot.rect.width, plotWidth))
            {
                plotWidth = plot.rect.width;
                Apply(image, shown);
            }
            if (!Fading) return;
            fadeTime += Time.unscaledDeltaTime;
            float t = Mathf.Clamp01(fadeTime / fadeSeconds);
            image.canvasRenderer.SetAlpha(t);
            previous.canvasRenderer.SetAlpha(1 - t);
            if (t >= 1) FinishFade();
        }
    }
}
