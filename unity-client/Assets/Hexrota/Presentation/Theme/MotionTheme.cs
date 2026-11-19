using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    [CreateAssetMenu(menuName = "Hexrota/Motion Theme")]
    public sealed class MotionTheme : ScriptableObject
    {
        [System.Serializable]
        public struct Timing
        {
            [Min(0.001f)] public float seconds;
            public AnimationCurve curve;

            public float Evaluate(float elapsed) => curve.Evaluate(Mathf.Clamp01(elapsed / seconds));
        }

        public Timing tap, release, popIn, popOut, punch;
        [Tooltip("Progress bar growth.")]
        public Timing fill;
        [Tooltip("Horizontal shake of a button that cannot be used.")]
        public Timing shake;
        [Min(0f)] public float shakeDistance, shakeCycles;
        [Tooltip("Panel open/close: shade fade seconds and start/end scale.")]
        [Min(0f)] public float shadeIn, shadeOut;
        public float panelOpenScale, panelCloseScale;
        [Tooltip("Coop upgrade: squash & stretch of the coop, and the single punch used with reduced motion.")]
        public Timing coopSquash, reducedUpgradePunch;
        [Range(0f, 0.5f)] public float coopSquashAmount;
        [Tooltip("How long \"Seviye N!\" stays, and the delay between arriving residents.")]
        [Min(0f)] public float levelBannerHold, residentStagger;
        public AnimationCurve fly, breathe, shine;
        [Min(0f)] public float flyMin, flyMax, flyStagger;
        [Min(0f)] public float flyLaunchDuration, reducedFlyDuration, rewardStartDelay;
        [Min(0f)] public float breathePeriod, shineInterval, shineDuration, idleHopDelay;
        public float punchScale, breatheAmplitude, idleHopHeight;
        [Tooltip("Basınca düğmenin aşağı indiği mesafe (px).")]
        [Min(0f)] public float pressDepth;
        [Tooltip("Coop button pulse while an upgrade is ready (seconds per beat, peak scale).")]
        [Min(0.01f)] public float coopPulsePeriod;
        public float coopPulseScale;
        public float flyLaunchScale, flyPeakScale, flyArcMin, flyArcMax;
        [Range(0, 20)] public int arrivalHapticMs;
    }
}
