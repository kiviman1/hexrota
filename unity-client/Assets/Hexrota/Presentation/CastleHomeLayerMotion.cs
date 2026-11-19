using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // A layer moves independently; its authored layout is never accumulated or rewritten.
    [DisallowMultipleComponent]
    [RequireComponent(typeof(RectTransform))]
    public sealed class CastleHomeLayerMotion : MonoBehaviour
    {
        [Tooltip("Travel in canvas units around the authored position.")]
        public Vector2 travel;
        [Min(0f)] public float cyclesPerSecond = .04f;
        public float phase;
        [Tooltip("Maximum sway in degrees, useful for independently placed characters.")]
        public float rotation;
        [Tooltip("Maximum vertical stretch for a subtle breathing animation.")]
        public float breathing;
        private RectTransform target;
        private Vector2 origin;
        private Quaternion initialRotation;
        private Vector3 initialScale;

        private void OnEnable()
        {
            target = (RectTransform)transform;
            origin = target.anchoredPosition;
            initialRotation = target.localRotation;
            initialScale = target.localScale;
        }
        private void OnDisable()
        {
            if (target == null) return;
            target.anchoredPosition = origin;
            target.localRotation = initialRotation;
            target.localScale = initialScale;
        }
        private void Update()
        {
            float wave = Mathf.Sin(Time.unscaledTime * cyclesPerSecond * Mathf.PI * 2f + phase);
            target.anchoredPosition = origin + travel * wave;
            target.localRotation = initialRotation * Quaternion.Euler(0f, 0f, wave * rotation);
            target.localScale = Vector3.Scale(initialScale, new Vector3(1f - breathing * wave * .4f, 1f + breathing * wave, 1f));
        }
    }
}
