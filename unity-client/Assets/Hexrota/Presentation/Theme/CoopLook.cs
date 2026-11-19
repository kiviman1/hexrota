using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // How the 3D coop is lit and grounded so it sits in the painted background: one warm key light
    // from the upper left, a purple-tinted shadow side, a thin warm rim, ground AO at the base and two
    // soft blob shadows (wide contact + tight occlusion). CoopModelView pushes these values to the
    // "Hexrota/Stylized Lit" and "Hexrota/Blob Shadow" materials every frame, so edits show live.
    [CreateAssetMenu(menuName = "Hexrota/Coop Look")]
    public sealed class CoopLook : ScriptableObject
    {
        [Header("Key light")]
        [Tooltip("Towards the light, relative to the view: x = right, y = up, z = towards the viewer. (-x, +y) is upper left.")]
        public Vector3 lightDirection = new Vector3(-.55f, .7f, .45f);
        public Color lightColor = new Color(1f, .94f, .82f);
        [Range(0f, 2f)] public float lightIntensity = .45f;
        [Tooltip("Soft (wrap) lambert: how far the light wraps round to the shadow side.")]
        [Range(0f, 1f)] public float wrap = .5f;

        [Header("Ambient and shadow side")]
        public Color ambient = new Color(.78f, .76f, .8f);
        [Tooltip("Shadow side tint (panel-deep #3a1a58), mixed in at shadowStrength.")]
        public Color shadowColor = new Color32(0x3a, 0x1a, 0x58, 0xff);
        [Range(0f, 1f)] public float shadowStrength = .3f;

        [Header("Rim")]
        public Color rimColor = new Color(1f, .85f, .6f);
        [Range(0f, 1f)] public float rimStrength = .18f;
        [Tooltip("Higher is thinner.")]
        [Range(.5f, 8f)] public float rimPower = 3.5f;

        [Header("Grounding")]
        [Tooltip("Darkening at the model's base (ambient-occlusion feel) and the height it fades over (m).")]
        [Range(0f, 1f)] public float groundAO = .35f;
        [Range(.01f, .5f)] public float groundAOHeight = .12f;
        [Tooltip("Wide soft contact shadow: colour (alpha = opacity), size relative to the footprint, edge softness.")]
        public Color contactShadow = new Color(.227f, .102f, .345f, .4f);
        [Min(.1f)] public float contactScale = 1.2f;
        [Range(.01f, 1f)] public float contactSoftness = .8f;
        [Tooltip("Tight, light occlusion under the model's centre.")]
        public Color occlusion = new Color(.16f, .07f, .25f, .18f);
        [Min(.1f)] public float occlusionScale = .8f;
        [Range(.01f, 1f)] public float occlusionSoftness = .6f;

        [Header("Grade")]
        [Tooltip("Small boost so the wood reads against the soil.")]
        [Range(0f, 2f)] public float saturation = 1.12f;
        [Range(.5f, 1.5f)] public float contrast = 1.06f;

        private static readonly int LightDir = Shader.PropertyToID("_LightDir"), LightColor = Shader.PropertyToID("_LightColor"),
            LightIntensity = Shader.PropertyToID("_LightIntensity"), Wrap = Shader.PropertyToID("_Wrap"),
            Ambient = Shader.PropertyToID("_Ambient"), ShadowColor = Shader.PropertyToID("_ShadowColor"),
            ShadowStrength = Shader.PropertyToID("_ShadowStrength"), RimColor = Shader.PropertyToID("_RimColor"),
            RimStrength = Shader.PropertyToID("_RimStrength"), RimPower = Shader.PropertyToID("_RimPower"),
            GroundAO = Shader.PropertyToID("_GroundAO"), GroundAOHeight = Shader.PropertyToID("_GroundAOHeight"),
            Saturation = Shader.PropertyToID("_Saturation"), Contrast = Shader.PropertyToID("_Contrast"),
            Color = Shader.PropertyToID("_Color"), Softness = Shader.PropertyToID("_Softness");

        /// <summary>Fills the lit-shader block; <paramref name="view"/> turns the view-relative light into world space.</summary>
        public void ApplyLit(MaterialPropertyBlock block, Quaternion view)
        {
            var d = lightDirection;
            block.SetVector(LightDir, (view * new Vector3(d.x, d.y, -d.z)).normalized);
            block.SetColor(LightColor, lightColor);
            block.SetFloat(LightIntensity, lightIntensity);
            block.SetFloat(Wrap, wrap);
            block.SetColor(Ambient, ambient);
            block.SetColor(ShadowColor, shadowColor);
            block.SetFloat(ShadowStrength, shadowStrength);
            block.SetColor(RimColor, rimColor);
            block.SetFloat(RimStrength, rimStrength);
            block.SetFloat(RimPower, rimPower);
            block.SetFloat(GroundAO, groundAO);
            block.SetFloat(GroundAOHeight, groundAOHeight);
            block.SetFloat(Saturation, saturation);
            block.SetFloat(Contrast, contrast);
        }

        public void ApplyBlob(MaterialPropertyBlock block, bool contact)
        {
            block.SetColor(Color, contact ? contactShadow : occlusion);
            block.SetFloat(Softness, contact ? contactSoftness : occlusionSoftness);
        }
    }
}
