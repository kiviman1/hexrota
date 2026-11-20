using System;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // How the coop sprites sit on the home plot, per level. The base disk's diameter is measured in
    // each sprite (art/coop-2d/cut_sprites.py); the sprite is scaled so that diameter is
    // diskFraction[level] of the plot width, and the disk centre lands on diskCentre in the plot.
    // The coop's shadow has three layers, all set per level in shadows[level]: a thin contact line
    // along the lower edge of the disk, the main ellipse under the disk and a long soft building
    // shadow cast to the lower right (light from the upper left).
    [CreateAssetMenu(menuName = "Hexrota/Coop Look")]
    public sealed class CoopLook : ScriptableObject
    {
        [Tooltip("Base disk diameter as a fraction of the plot width, per level (L0 foundation .. L4).")]
        public float[] diskFraction = { .45f, .5f, .58f, .68f, .78f };
        [Tooltip("Where the disk centre sits in the plot (fraction of the plot rect).")]
        public Vector2 diskCentre = new Vector2(.5f, .5f);

        [Tooltip("Shadow layers per level (L0 foundation .. L4).")]
        public ShadowLevel[] shadows =
        {
            ShadowLevel.Default(2f), ShadowLevel.Default(2.5f), ShadowLevel.Default(3f),
            ShadowLevel.Default(3.5f), ShadowLevel.Default(4f)
        };

        [Header("Chicken shadow")]
        [Tooltip("Small oval under each hen's feet; alpha is the opacity.")]
        public Color chickenShadowColor = new Color32(0x4a, 0x26, 0x16, 0x59);
        [Tooltip("Oval size as a fraction of the hen's rect (width, height).")]
        public Vector2 chickenShadowSize = new Vector2(.62f, .16f);
        [Tooltip("Oval centre from the hen's feet (pivot), as a fraction of the hen's rect.")]
        public Vector2 chickenShadowOffset = new Vector2(.04f, .03f);

        public float Fraction(int level) =>
            diskFraction.Length == 0 ? .5f : diskFraction[Mathf.Clamp(level, 0, diskFraction.Length - 1)];

        public ShadowLevel Shadow(int level) =>
            shadows == null || shadows.Length == 0 ? ShadowLevel.Default(3f) : shadows[Mathf.Clamp(level, 0, shadows.Length - 1)];

        [Serializable]
        public sealed class ShadowLevel
        {
            [Header("1  Contact line (lower half of the disk edge)")]
            [Tooltip("Dark strip colour; alpha is the opacity.")]
            public Color contactColor = new Color32(0x2e, 0x18, 0x10, 0xb3);
            [Tooltip("Strip thickness in reference units (390 wide screen), before the soft edge.")]
            [Range(0, 8)] public float contactThickness = 3;
            [Tooltip("Soft fade on each side of the strip, in reference units.")]
            [Range(0, 4)] public float contactSoftness = 1;
            [Tooltip("How far the strip's centre line sits outside the disk edge, in reference units.")]
            [Range(-4, 4)] public float contactOutset = .5f;
            // contactDepth and contactWidth describe the rim's real lower outline, which differs from the
            // measured disk ellipse per sprite. cut_sprites.py fits them to each sprite's alpha edge and
            // Reimport Coop Sprites copies them here, so edit the sprite, not these two values.
            [Tooltip("Height of the arc as a share of the disk height, with its lowest point kept on the disk's bottom.")]
            [Range(.4f, 2)] public float contactDepth = .8f;
            [Tooltip("Width of the arc as a share of the measured disk diameter: the grass lip at the top of the disk is wider than the rim at its bottom.")]
            [Range(.8f, 1.2f)] public float contactWidth = .95f;

            [Header("2  Main shadow (ellipse under the disk, multiplied)")]
            [Tooltip("Warm brown; alpha is the opacity.")]
            public Color mainColor = new Color32(0x4a, 0x26, 0x16, 0x80);
            [Tooltip("Ellipse size relative to the disk (1.10 = 10 % wider).")]
            [Min(.5f)] public float mainScale = 1.1f;
            [Tooltip("Offset from the disk centre as a fraction of the disk size; right and down.")]
            public Vector2 mainOffset = new Vector2(.035f, -.08f);

            [Header("3  Building shadow (cast to the lower right, multiplied)")]
            public Color buildingColor = new Color32(0x4a, 0x26, 0x16, 0x4d);
            [Tooltip("Length as a multiple of the sprite's height above the disk centre.")]
            [Min(0)] public float buildingLength = .75f;
            [Tooltip("Width at the base as a fraction of the disk diameter.")]
            [Min(0)] public float buildingWidth = .5f;
            [Tooltip("Direction in degrees below the horizontal, to the right.")]
            [Range(0, 90)] public float buildingAngle = 20;
            [Tooltip("Where the shadow starts, from the disk centre, as a fraction of the disk size.")]
            public Vector2 buildingOrigin = new Vector2(.22f, -.08f);

            public static ShadowLevel Default(float contactThickness) => new ShadowLevel { contactThickness = contactThickness };
        }
    }
}
