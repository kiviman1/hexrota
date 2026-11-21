using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // A closed cell's area opens: its fog swells and fades while the lock rises and fades.
    // A copy of the cell's mark plays it, so the board can hide the real mark at once.
    public sealed class RegionOpenEffect : MonoBehaviour
    {
        private SpriteRenderer fog, lockIcon;
        private Color fogColour, lockColour;
        private Vector3 lockStart;
        private float seconds, elapsed;

        /// <summary>How long the opening plays.</summary>
        public float Seconds => seconds;

        internal void Play(Transform mark, float duration)
        {
            seconds = Mathf.Max(.05f, duration);
            transform.position = mark.position;
            fog = Copy(mark.Find("Fog"));
            lockIcon = Copy(mark.Find("Lock"));
            if (fog != null) fogColour = fog.color;
            if (lockIcon != null) { lockColour = lockIcon.color; lockStart = lockIcon.transform.localPosition; }
        }

        private SpriteRenderer Copy(Transform source)
        {
            if (source == null) return null;
            var original = source.GetComponent<SpriteRenderer>();
            var ink = new GameObject(source.name).AddComponent<SpriteRenderer>();
            ink.transform.SetParent(transform, false);
            ink.transform.localPosition = source.localPosition;
            ink.sprite = original.sprite;
            ink.color = original.color;
            ink.sortingOrder = original.sortingOrder + 6;
            return ink;
        }

        private void Update()
        {
            elapsed += Time.unscaledDeltaTime;
            float t = Mathf.Clamp01(elapsed / seconds);
            float ease = 1f - (1f - t) * (1f - t);
            if (fog != null)
            {
                fog.transform.localScale = Vector3.one * Mathf.Lerp(1f, 1.4f, ease);
                fog.color = new Color(fogColour.r, fogColour.g, fogColour.b, fogColour.a * (1f - ease));
            }
            if (lockIcon != null)
            {
                lockIcon.transform.localPosition = lockStart + Vector3.up * (.22f * ease);
                lockIcon.color = new Color(lockColour.r, lockColour.g, lockColour.b, lockColour.a * (1f - t));
            }
            if (t >= 1f) Destroy(gameObject);
        }
    }
}
