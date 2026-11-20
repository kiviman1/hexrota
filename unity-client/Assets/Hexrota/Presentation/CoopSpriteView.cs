using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // The coop on the home plot as a 2D sprite per level (Art/Coop2D: Coop_L0 foundation, Coop_L1..L4).
    // Every sprite's pivot is the centre of its base disk. The disk diameter measured in each sprite
    // (coop_sprites.json) is scaled to CoopLook.diskFraction[level] of the plot width, and the disk
    // centre lands on CoopLook.diskCentre in the plot, so the coop grows with each level without
    // leaving the plot. A soft warm shadow sits under the disk, offset away from the upper-left light,
    // and scales with the sprite. Reduced motion swaps levels with a short cross-fade.
    [DisallowMultipleComponent]
    public sealed class CoopSpriteView : MonoBehaviour
    {
        [Tooltip("Per-level disk size, disk position on the plot and the contact shadow.")]
        [SerializeField] private CoopLook look;
        [Tooltip("Level sprites in order: Coop_L0 (foundation) .. Coop_L4.")]
        [SerializeField] private Sprite[] levels = new Sprite[0];
        [Tooltip("Diameter and height of each sprite's base disk in its own pixels (from coop_sprites.json).")]
        [SerializeField] private float[] diskPixels = new float[0];
        [SerializeField] private float[] diskHeightPixels = new float[0];
        [SerializeField] private RectTransform plot;
        [Tooltip("The coop's stand on the plot (its pivot is put on the disk centre point).")]
        [SerializeField] private RectTransform stand;
        [SerializeField] private Image image, previous, shadow;
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
        public CoopLook Look => look;
        /// <summary>On-screen disk diameter of the shown level, in this view's units.</summary>
        public float ShownDiskWidth => shown >= 0 ? DiskWidth(shown) : 0;
        /// <summary>The shadow's visible size reaches half opacity at this fraction of its rect (Shadow.png falloff).</summary>
        public const float ShadowHalfRadius = .85f;
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
            if (shadow != null && look != null) shadow.color = look.shadowColor;
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
            if (target == image) PlaceStand();
            if (target == image && shadow != null && look != null)
            {
                // Soft ellipse under the disk: its half-opacity edge is shadowScale x the disk, shifted
                // right and down, away from the upper-left light. It is a sibling under the same
                // (pulsing, squashing) parent, so it scales with the sprite.
                float disk = DiskWidth(level), depth = DiskHeight(level);
                var s = shadow.rectTransform;
                s.anchorMin = s.anchorMax = new Vector2(.5f, 0);
                s.pivot = new Vector2(.5f, .5f);
                s.sizeDelta = new Vector2(disk, depth) * (look.shadowScale / ShadowHalfRadius);
                s.anchoredPosition = Vector2.Scale(new Vector2(disk, depth), look.shadowOffset);
                shadow.color = look.shadowColor;
            }
            if (target == image && badge != null)
            {
                badge.anchorMin = badge.anchorMax = new Vector2(.5f, 0);
                badge.anchoredPosition = Vector2.Scale(size, badgeAt);
            }
        }

        // The stand's pivot (and so the disk centre) sits on CoopLook.diskCentre of the plot.
        private void PlaceStand()
        {
            if (stand == null || look == null) return;
            var c = look.diskCentre;
            float halfWidth = (stand.anchorMax.x - stand.anchorMin.x) / 2, height = stand.anchorMax.y - stand.anchorMin.y;
            stand.anchorMin = new Vector2(c.x - halfWidth, c.y);
            stand.anchorMax = new Vector2(c.x + halfWidth, c.y + height);
            stand.pivot = new Vector2(.5f, 0);
            stand.anchoredPosition = Vector2.zero;
        }

        private float DiskWidth(int level) => (plot != null ? plot.rect.width : 300f) * (look != null ? look.Fraction(level) : .5f);

        private float Scale(int level)
        {
            var sprite = levels[level];
            float pixels = level < diskPixels.Length && diskPixels[level] > 0 ? diskPixels[level] : sprite.rect.width;
            return DiskWidth(level) / pixels;
        }

        private float DiskHeight(int level) =>
            (level < diskHeightPixels.Length && diskHeightPixels[level] > 0 ? diskHeightPixels[level] : levels[level].rect.width * .3f) * Scale(level);

        /// <summary>On-screen size of a level's sprite, in this view's units.</summary>
        public Vector2 SizeOf(int level) => levels[level].rect.size * Scale(level);

        /// <summary>Measured base disk diameter of a level, in its sprite's pixels.</summary>
        public float DiskPixels(int level) => level < diskPixels.Length ? diskPixels[level] : 0;

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
