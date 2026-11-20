using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // How the coop sprites sit on the home plot, per level. The base disk's diameter is measured in
    // each sprite (art/coop-2d/cut_sprites.py); the sprite is scaled so that diameter is
    // diskFraction[level] of the plot width, and the disk centre lands on diskCentre in the plot.
    [CreateAssetMenu(menuName = "Hexrota/Coop Look")]
    public sealed class CoopLook : ScriptableObject
    {
        [Tooltip("Base disk diameter as a fraction of the plot width, per level (L0 foundation .. L4).")]
        public float[] diskFraction = { .45f, .5f, .58f, .68f, .78f };
        [Tooltip("Where the disk centre sits in the plot (fraction of the plot rect).")]
        public Vector2 diskCentre = new Vector2(.5f, .5f);

        [Header("Contact shadow")]
        [Tooltip("Warm dark purple-brown; alpha is the opacity.")]
        public Color shadowColor = new Color32(0x3a, 0x1a, 0x28, 0x59);
        [Tooltip("Shadow size relative to the disk (1.08 = 8 % wider).")]
        [Min(.5f)] public float shadowScale = 1.08f;
        [Tooltip("Offset from the disk centre as a fraction of the disk size; light comes from the upper left, so right and down.")]
        public Vector2 shadowOffset = new Vector2(.035f, -.08f);

        public float Fraction(int level) =>
            diskFraction.Length == 0 ? .5f : diskFraction[Mathf.Clamp(level, 0, diskFraction.Length - 1)];
    }
}
