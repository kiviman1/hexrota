using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    [CreateAssetMenu(menuName = "Hexrota/UI Theme")]
    public sealed class UiTheme : ScriptableObject
    {
        public Color cta, ctaDeep, ctaLight;
        public Color gold, goldDeep, goldLight;
        public Color panel, panelDeep, panelInset;
        [Tooltip("Cream info card and the dark text on it.")]
        public Color cream, ink;
        public Color onPanelMuted;
        [Tooltip("Locked / unaffordable button body and outline.")]
        public Color disabled, disabledDeep;
        [Tooltip("Dim behind panels; alpha comes from shadeOpacity.")]
        public Color shade;
        [Range(0f, 1f)] public float shadeOpacity;
        [Tooltip("Secondary action (coop button).")]
        public Color sky, skyDeep;
        [Tooltip("Warning badge only.")]
        public Color heart, heartDeep;
        public Color label, shine;
        [Range(0f, 1f)] public float ctaBandOpacity;
        [Tooltip("Düğme altındaki koyu bevel kalınlığı (px): dururken ve basılıyken.")]
        [Min(0f)] public float bevelAtRest, bevelPressed;
        [Tooltip("Uçan ödül ikonunun kenarı (px).")]
        [Min(1f)] public float rewardIconSize;
        [Tooltip("Coop placeholder scale on the empty plot; it grows to 1 when the area is complete.")]
        [Range(0.1f, 1f)] public float coopScaleEmpty;
        [Range(0f, 1f)] public float coopRingOpacity;
    }
}
