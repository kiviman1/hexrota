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
        public AnimationCurve fly, breathe, shine;
        [Min(0f)] public float flyMin, flyMax, flyStagger;
        [Min(0f)] public float flyLaunchDuration, reducedFlyDuration, rewardStartDelay;
        [Min(0f)] public float breathePeriod, shineInterval, shineDuration, idleHopDelay;
        public float punchScale, breatheAmplitude, idleHopHeight;
        [Tooltip("Basınca düğmenin aşağı indiği mesafe (px).")]
        [Min(0f)] public float pressDepth;
        public float flyLaunchScale, flyPeakScale, flyArcMin, flyArcMax;
        [Range(0, 20)] public int arrivalHapticMs;
    }
}
