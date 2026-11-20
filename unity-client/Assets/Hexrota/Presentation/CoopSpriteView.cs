using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // The coop on the home plot as a 2D sprite per level (Art/Coop2D: Coop_L0 foundation, Coop_L1..L4).
    // Every sprite's pivot is the centre of its base disk. The disk diameter measured in each sprite
    // (coop_sprites.json) is scaled to CoopLook.diskFraction[level] of the plot width, and the disk
    // centre lands on CoopLook.diskCentre in the plot, so the coop grows with each level without
    // leaving the plot. The shadow has three layers from CoopLook.shadows[level], drawn under the sprite:
    // a long soft building shadow cast to the lower right (its length follows the sprite's height above
    // the disk), the main warm ellipse under the disk (both multiplied onto the ground) and a thin dark
    // contact line along the lower edge of the disk. The stand's pivot is the bottom of the disk, so the
    // upgrade squash and the ready pulse scale the coop and all its shadows from the ground contact.
    // Reduced motion swaps levels with a short cross-fade.
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
        [Tooltip("Long building shadow (ShadowLong.png, pivot at its base).")]
        [SerializeField] private Image buildingShadow;
        [SerializeField] private CoopContactLine contactLine;
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
        public Image BuildingShadow => buildingShadow;
        public CoopContactLine ContactLine => contactLine;
        public CoopLook Look => look;
        /// <summary>On-screen disk diameter of the shown level, in this view's units.</summary>
        public float ShownDiskWidth => shown >= 0 ? DiskWidth(shown) : 0;
        /// <summary>On-screen disk height (its ellipse's minor axis) of the shown level, in this view's units.</summary>
        public float ShownDiskHeight => shown >= 0 ? DiskHeight(shown) : 0;
        /// <summary>On-screen height of the shown sprite above its disk centre, in this view's units.</summary>
        public float ShownHeightAboveDisk => shown >= 0 ? HeightAboveDisk(shown) : 0;
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
            // The stand's pivot is the bottom of the shown disk, so the disk centre is half a disk above it.
            var centre = new Vector2(0, shown >= 0 ? DiskHeight(shown) / 2 : 0);
            rect.anchoredPosition = centre;
            rect.sizeDelta = size;
            if (target != image) return;
            PlaceStand(DiskHeight(level));
            if (look != null) PlaceShadows(level, centre);
            if (badge != null)
            {
                badge.anchorMin = badge.anchorMax = new Vector2(.5f, 0);
                badge.anchoredPosition = centre + Vector2.Scale(size, badgeAt);
            }
        }

        // All three layers are siblings under the same (pulsing, squashing) parent as the sprite, so
        // they scale with it from the bottom of the disk.
        private void PlaceShadows(int level, Vector2 centre)
        {
            var layers = look.Shadow(level);
            float disk = DiskWidth(level), depth = DiskHeight(level);
            var diskSize = new Vector2(disk, depth);
            if (shadow != null)
            {
                // Main: soft ellipse whose half-opacity edge is mainScale x the disk, shifted right and down.
                var s = Anchor(shadow.rectTransform, new Vector2(.5f, .5f));
                s.sizeDelta = diskSize * (layers.mainScale / ShadowHalfRadius);
                s.anchoredPosition = centre + Vector2.Scale(diskSize, layers.mainOffset);
                shadow.color = layers.mainColor;
            }
            if (buildingShadow != null)
            {
                // Building: starts under the disk and runs to the lower right; its length follows the
                // sprite's height above the disk, and it fades out at the tip (ShadowLong.png).
                var s = Anchor(buildingShadow.rectTransform, new Vector2(0, .5f));
                s.sizeDelta = new Vector2(HeightAboveDisk(level) * layers.buildingLength, disk * layers.buildingWidth);
                s.anchoredPosition = centre + Vector2.Scale(diskSize, layers.buildingOrigin);
                s.localRotation = Quaternion.Euler(0, 0, -layers.buildingAngle);
                buildingShadow.color = layers.buildingColor;
            }
            if (contactLine != null)
            {
                // Contact: thin dark strip along the lower half of the disk edge.
                // The arc keeps the disk's lowest point but is flatter (contactDepth), like the rim's outline.
                var s = Anchor(contactLine.rectTransform, new Vector2(.5f, .5f));
                float k = Mathf.Clamp(layers.contactDepth, .1f, 2);
                s.anchoredPosition = centre - new Vector2(0, depth * (1 - k) / 2);
                contactLine.Set(new Vector2(disk * layers.contactWidth, depth * k) / 2, layers.contactThickness, layers.contactSoftness, layers.contactOutset, layers.contactColor);
            }
        }

        private static RectTransform Anchor(RectTransform rect, Vector2 pivot)
        {
            rect.anchorMin = rect.anchorMax = new Vector2(.5f, 0);
            rect.pivot = pivot;
            return rect;
        }

        // The disk centre sits on CoopLook.diskCentre of the plot; the stand's pivot is the bottom of the
        // disk (half a disk height lower), so squash and pulse scale from the ground contact.
        private void PlaceStand(float diskHeight)
        {
            if (stand == null || look == null) return;
            var c = look.diskCentre;
            float halfWidth = (stand.anchorMax.x - stand.anchorMin.x) / 2, height = stand.anchorMax.y - stand.anchorMin.y;
            stand.anchorMin = new Vector2(c.x - halfWidth, c.y);
            stand.anchorMax = new Vector2(c.x + halfWidth, c.y + height);
            stand.pivot = new Vector2(.5f, 0);
            stand.anchoredPosition = new Vector2(0, -diskHeight / 2);
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

        private float HeightAboveDisk(int level) => (levels[level].rect.height - levels[level].pivot.y) * Scale(level);

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
