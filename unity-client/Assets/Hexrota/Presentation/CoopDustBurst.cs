using System;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Dust cloud for the coop upgrade: soft puff sprites burst out over the building and cover it
    // (MotionTheme.dustCover), the caller swaps the sprite at the densest moment, then the puffs drift
    // apart and fade (MotionTheme.dustClear). Colour comes from UiTheme.cream.
    [DisallowMultipleComponent]
    public sealed class CoopDustBurst : MonoBehaviour
    {
        [SerializeField] private UiTheme ui;
        [SerializeField] private MotionTheme motion;
        [Tooltip("Pool of puff images (children of this rect, which covers the building).")]
        [SerializeField] private Image[] puffs = new Image[0];
        [SerializeField] private Sprite[] shapes = new Sprite[0];

        private enum Phase { Idle, Cover, Clear }
        private Phase phase;
        private float time;
        private int count;
        private Action peak;
        private Vector2[] start = new Vector2[0], end = new Vector2[0];
        private float[] size = new float[0], spin = new float[0];

        public bool IsPlaying => phase != Phase.Idle;
        public bool Covering => phase == Phase.Cover;
        public int ActivePuffs { get { int n = 0; foreach (var p in puffs) if (p.gameObject.activeSelf) n++; return n; } }

        private void Awake() { foreach (var p in puffs) p.gameObject.SetActive(false); }

        /// <summary>
        /// Bursts over <paramref name="area"/> (the building, in the parent's space relative to its pivot);
        /// <paramref name="onPeak"/> runs when the building is fully covered.
        /// </summary>
        public void Play(Rect area, Action onPeak)
        {
            Stop();
            peak = onPeak;
            var self = (RectTransform)transform;
            self.anchorMin = self.anchorMax = ((RectTransform)self.parent).pivot;
            self.pivot = new Vector2(.5f, .5f);
            self.anchoredPosition = area.center;
            self.sizeDelta = area.size;
            var rect = self.rect;
            count = Mathf.Min(puffs.Length, Mathf.Max(1, motion.dustPuffs));
            if (start.Length != count) { start = new Vector2[count]; end = new Vector2[count]; size = new float[count]; spin = new float[count]; }
            float width = rect.width;
            for (int i = 0; i < count; i++)
            {
                // A third of the puffs fill the middle, the rest spread round it, so the building is fully
                // covered at the densest moment; lower puffs hug the ground.
                float angle = (i + UnityEngine.Random.value * .6f) / count * Mathf.PI * 2;
                var dir = new Vector2(Mathf.Cos(angle), Mathf.Sin(angle));
                var centre = rect.center + new Vector2(0, -rect.height * .08f);
                float reach = i % 3 == 0 ? UnityEngine.Random.value * .1f : .2f + UnityEngine.Random.value * .16f;
                start[i] = centre + dir * width * .04f;
                end[i] = centre + Vector2.Scale(dir, new Vector2(rect.width, rect.height)) * reach;
                size[i] = Mathf.Max(rect.width, rect.height) * (.55f + UnityEngine.Random.value * .25f);
                spin[i] = UnityEngine.Random.Range(-40f, 40f);
                var p = puffs[i];
                p.sprite = shapes.Length > 0 ? shapes[i % shapes.Length] : null;
                p.color = ui.cream;
                p.raycastTarget = false;
                p.gameObject.SetActive(true);
            }
            phase = Phase.Cover;
            time = 0;
            Animate();
        }

        /// <summary>Hides every puff; a pending peak callback is dropped.</summary>
        public void Stop()
        {
            phase = Phase.Idle;
            peak = null;
            foreach (var p in puffs) p.gameObject.SetActive(false);
        }

        private void Update()
        {
            if (phase == Phase.Idle) return;
            time += Time.unscaledDeltaTime;
            if (phase == Phase.Cover && time >= motion.dustCover.seconds)
            {
                phase = Phase.Clear;
                time = 0;
                var callback = peak;
                peak = null;
                callback?.Invoke();
            }
            else if (phase == Phase.Clear && time >= motion.dustClear.seconds)
            {
                Stop();
                return;
            }
            Animate();
        }

        private void Animate()
        {
            float spread = motion.dustSpread;
            for (int i = 0; i < count; i++)
            {
                var p = puffs[i].rectTransform;
                float scale, alpha;
                Vector2 position;
                if (phase == Phase.Cover)
                {
                    float t = motion.dustCover.Evaluate(time);
                    position = Vector2.LerpUnclamped(start[i], end[i], t);
                    scale = Mathf.Lerp(.35f, 1f, t);
                    alpha = Mathf.Clamp01(t * 1.4f);
                }
                else
                {
                    float t = motion.dustClear.Evaluate(time);
                    // Drift outward and up while thinning out.
                    position = end[i] + (end[i] - ((RectTransform)transform).rect.center) * spread * t + Vector2.up * size[i] * .25f * t;
                    scale = 1f + .45f * t;
                    alpha = 1f - t;
                }
                p.anchoredPosition = position;
                p.sizeDelta = Vector2.one * size[i] * scale;
                p.localRotation = Quaternion.Euler(0, 0, spin[i] * (phase == Phase.Cover ? motion.dustCover.Evaluate(time) : 1));
                puffs[i].canvasRenderer.SetAlpha(alpha);
            }
        }

        private void OnDisable() => Stop();
    }
}
