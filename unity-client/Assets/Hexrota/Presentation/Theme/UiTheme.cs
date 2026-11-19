using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    [CreateAssetMenu(menuName = "Hexrota/UI Theme")]
    public sealed class UiTheme : ScriptableObject
    {
        public Color cta, ctaDeep, ctaLight;
        public Color gold, goldDeep, goldLight;
        public Color panelDeep;
        public Color label, shine;
        [Range(0f, 1f)] public float ctaBandOpacity;
    }
}
