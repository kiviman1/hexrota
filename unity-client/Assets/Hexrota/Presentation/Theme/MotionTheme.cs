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

        [Header("Tahta")]
        [Tooltip("At chapter start the empty board shows this long before the stones drop in.")]
        [Min(0f)] public float emptyBoardHold;
        [Tooltip("Crumbs that burst from a cell when a soil layer breaks.")]
        public Timing soilCrumbs;
        [Range(1, 24)] public int soilCrumbCount;
        [Tooltip("A hit crate's top plank spins off and falls.")]
        public Timing cratePlankFall;
        [Tooltip("The last hit breaks the crate into pieces.")]
        public Timing crateShatter;
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
        [Tooltip("Coop upgrade dust: the cloud covers the building, the sprite changes at its densest, then it clears.")]
        public Timing dustCover, dustClear;
        [Tooltip("Reduced motion: a short cross-fade between the old and new coop instead of the dust.")]
        public Timing reducedCrossfade;
        [Tooltip("Dust puffs per burst, and how far they spread (fraction of the coop width).")]
        [Range(1, 24)] public int dustPuffs;
        [Min(0f)] public float dustSpread;
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
        [Tooltip("Home background clouds, back to front: horizontal drift in source-art pixels per second (1170 px wide painting).")]
        [Min(0f)] public float[] cloudDriftSpeeds;
    }
}
