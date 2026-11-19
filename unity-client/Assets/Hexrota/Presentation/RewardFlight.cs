using System;
using System.Globalization;
using Hexrota.Rewards;
using Unity.Profiling;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public enum RewardKind { Gold, GoldenEgg }

    [DisallowMultipleComponent]
    public sealed class RewardFlight : MonoBehaviour
    {
        private const int MaxIcons = 8;
        private const int IndividualLimit = 5;
        private static readonly CultureInfo Turkish = CultureInfo.GetCultureInfo("tr-TR");
        private static readonly ProfilerMarker Animation = new ProfilerMarker("Hexrota.RewardFlight.Animate");

        [SerializeField] private MotionTheme motion;
        [SerializeField] private UiTheme ui;
        [SerializeField] private AttentionDirector attention;
        [SerializeField] private RectTransform flightLayer;
        [SerializeField] private Sprite burstSprite;

        internal sealed class Target
        {
            private readonly Image icon;
            private readonly Text count;
            private readonly Vector3 restScale;

            internal Target(Image icon, Text count)
            {
                this.icon = icon;
                this.count = count;
                if (icon != null) restScale = icon.rectTransform.localScale;
            }

            internal Sprite Sprite => icon != null ? icon.sprite : null;
            internal Color Tint => icon != null ? icon.color : default;
            internal void Show(string value) { if (count != null && count.text != value) count.text = value; }
            internal void Scale(float scale) { if (icon != null) icon.rectTransform.localScale = restScale * scale; }

            internal bool TryGetCenter(Camera camera, out Vector2 center)
            {
                center = default;
                if (icon == null || !icon.isActiveAndEnabled || icon.canvasRenderer.cull) return false;
                RectTransform rect = icon.rectTransform;
                if (rect.rect.width <= 0 || rect.rect.height <= 0) return false;
                center = RectTransformUtility.WorldToScreenPoint(camera, rect.TransformPoint(rect.rect.center));
                return center.x >= 0 && center.y >= 0 && center.x <= Screen.width && center.y <= Screen.height;
            }
        }

        private struct IconPath
        {
            public float Delay, Duration, Arc;
        }

        private sealed class Flight
        {
            public Target Target;
            public string StartText, FinalText;
            public int Count;
            public readonly int[] Shares = new int[MaxIcons];
            public readonly int[] ArrivalOrder = new int[MaxIcons];
            public readonly string[] ArrivalText = new string[MaxIcons];
            public readonly AudioClip[] Notes = new AudioClip[MaxIcons];
            public readonly IconPath[] Paths = new IconPath[MaxIcons];

            public float ArrivalTime(int index) => Paths[index].Delay + Paths[index].Duration;
        }

        private readonly Image[] pool = new Image[MaxIcons];
        private readonly Flight first = new Flight(), second = new Flight();
        private readonly PhoneRewardHaptics haptics = new PhoneRewardHaptics();
        private Flight current;
        private Image burst;
        private Camera uiCamera;
        private Target gold, egg;
        private FirstPlayableController controller;
        private UnityGameSession session;
        private PhoneAudio audioPlayer;
        private Action completed;
        private bool reduced, vibrate, spending;
        private long revision;
        private float delay, elapsed, lastImpact, volume;
        private int arrivals, requestedFrame;
        private Vector2 origin, destination;

        public bool IsPlaying => current != null;
        public int ActiveIconCount { get; private set; }

        internal void Bind(FirstPlayableController owner, PhoneAudio audio, Target goldTarget, Target eggTarget)
        {
            controller = owner;
            audioPlayer = audio;
            gold = goldTarget;
            egg = eggTarget;
            Canvas canvas = GetComponentInParent<Canvas>().rootCanvas;
            uiCamera = canvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : canvas.worldCamera;
            for (int i = 0; i < pool.Length; i++) pool[i] = CreateImage("RewardIcon", ui.rewardIconSize);
            burst = CreateImage("RewardBurst", ui.rewardIconSize);
            burst.sprite = burstSprite;
            burst.color = ui.goldLight;
        }

        private Image CreateImage(string name, float size)
        {
            var item = new GameObject(name, typeof(RectTransform), typeof(Image));
            item.layer = gameObject.layer;
            var image = item.GetComponent<Image>();
            image.raycastTarget = false;
            image.preserveAspect = true;
            image.rectTransform.SetParent(flightLayer, false);
            image.rectTransform.sizeDelta = new Vector2(size, size);
            item.SetActive(false);
            return image;
        }

        public static int[] DistributeAmount(int amount)
        {
            var shares = new int[IconCount(amount)];
            FillShares(amount, shares, shares.Length);
            return shares;
        }

        private static int IconCount(int amount) => amount <= IndividualLimit ? Mathf.Max(0, amount) : MaxIcons;

        private static void FillShares(int amount, int[] shares, int count)
        {
            if (count == 0) return;
            int share = amount / count;
            int remaining = amount;
            for (int i = 0; i < count - 1; i++)
            {
                // Six or seven units still launch eight icons. Leave some visual-only arrivals
                // and reserve at least one unit for the last icon.
                shares[i] = share == 0 && i < amount - 1 ? 1 : share;
                remaining -= shares[i];
            }
            shares[count - 1] = remaining;
        }

        public void Play(RewardKind kind, Vector2 fromScreenPoint, int amount, Action onComplete = null)
        {
            var activeSession = controller != null ? controller.Session : null;
            if (activeSession != null)
            {
                var wallet = activeSession.ReadPhoneWallet();
                if (Start(kind == RewardKind.GoldenEgg ? amount : 0, kind == RewardKind.Gold ? amount : 0,
                    fromScreenPoint, wallet, 0, onComplete)) return;
            }
            onComplete?.Invoke();
        }

        internal void PlayWin(Vector2 source, int eggs, int coins, UnityGameSession.PhoneWallet wallet)
        {
            Start(eggs, coins, source, wallet, motion.rewardStartDelay, null);
        }

#if UNITY_EDITOR
        public void PlayDebug()
        {
            if (controller == null || controller.Session == null || controller.CurrentScreen != "menu") return;
            Start(1, 20, controller.HomeRewardSource, controller.Session.ReadPhoneWallet(), motion.rewardStartDelay, null,
                preview: true);
        }
#endif

        private bool Start(int eggs, int coins, Vector2 source, UnityGameSession.PhoneWallet wallet,
            float startDelay, Action callback, bool preview = false)
        {
            if (eggs <= 0 && coins <= 0) return false;
            Cancel(wallet);
            if (!isActiveAndEnabled || !attention.TryAcquire(AttentionKind.RewardFlight, this))
            {
                ShowWallet(wallet);
                return false;
            }

            session = controller.Session;
            revision = session.Revision;
            reduced = session.ReducedMotion;
            spending = false;
            bool sound = session.SoundEnabled;
            volume = sound ? session.Volume : 0;
            vibrate = motion.arrivalHapticMs > 0 && session.HapticsEnabled;
            if (vibrate) haptics.Prepare(motion.arrivalHapticMs);

            RectTransformUtility.ScreenPointToLocalPointInRectangle(flightLayer, source, uiCamera, out origin);
            int pitch = 0;
            Prepare(first, eggs > 0 ? egg : gold, eggs > 0 ? wallet.GoldenEggs : wallet.Gold,
                eggs > 0 ? eggs : coins, sound, preview, ref pitch);
            second.Count = 0;
            if (eggs > 0 && coins > 0) Prepare(second, gold, wallet.Gold, coins, sound, preview, ref pitch);
            completed = callback;
            delay = startDelay;
            requestedFrame = Time.frameCount;
            Begin(first);
            AdvancePastMissingTargets();
            if (current != null && delay == 0) Animate(0);
            return true;
        }

        /// <summary>
        /// Reverse flight: Golden Eggs leave the counter for a point on screen (the coop). The counter
        /// starts at <paramref name="balanceAfter"/> + <paramref name="amount"/> and drops on every arrival.
        /// </summary>
        internal bool PlaySpend(Vector2 toScreenPoint, int amount, int balanceAfter, Action onComplete)
        {
            if (amount <= 0 || controller == null || controller.Session == null) return false;
            Cancel();
            if (!isActiveAndEnabled || !attention.TryAcquire(AttentionKind.RewardFlight, this)) return false;
            session = controller.Session;
            revision = session.Revision;
            reduced = session.ReducedMotion;
            spending = true;
            vibrate = false;
            bool sound = session.SoundEnabled;
            volume = sound ? session.Volume : 0;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(flightLayer, toScreenPoint, uiCamera, out destination);

            var flight = first;
            flight.Target = egg;
            bool hasSource = egg.Sprite != null && egg.TryGetCenter(uiCamera, out _);
            flight.Count = hasSource ? (reduced ? 1 : IconCount(amount)) : 0;
            flight.StartText = Format(balanceAfter + amount);
            flight.FinalText = Format(balanceAfter);
            FillShares(amount, flight.Shares, flight.Count);
            PlanPaths(flight);
            int displayed = balanceAfter + amount, pitch = 0;
            var cue = sound ? new RewardCue { reason = "home_reward" } : null;
            for (int i = 0; i < flight.Count; i++)
            {
                displayed -= flight.Shares[flight.ArrivalOrder[i]];
                flight.ArrivalText[i] = Format(Mathf.Max(balanceAfter, displayed));
                if (sound) { cue.pitchStep = pitch++; cue.tier = 0; cue.completion = false; }
                flight.Notes[i] = sound ? audioPlayer.PrepareHomeReward(cue, volume) : null;
            }
            egg.Show(flight.Count > 0 ? flight.StartText : flight.FinalText);
            second.Count = 0;
            completed = onComplete;
            delay = 0;
            requestedFrame = Time.frameCount;
            Begin(first);
            AdvancePastMissingTargets();
            if (current != null) Animate(0);
            return true;
        }

        private void PlanPaths(Flight flight)
        {
            for (int i = 0; i < flight.Count; i++)
            {
                flight.Paths[i] = new IconPath
                {
                    Delay = i * motion.flyStagger,
                    Duration = reduced ? motion.reducedFlyDuration : UnityEngine.Random.Range(motion.flyMin, motion.flyMax),
                    Arc = reduced ? 0 : UnityEngine.Random.Range(motion.flyArcMin, motion.flyArcMax) * (i % 2 == 0 ? 1 : -1)
                };
                int previous = i - 1;
                while (previous >= 0 && flight.ArrivalTime(flight.ArrivalOrder[previous]) > flight.ArrivalTime(i))
                {
                    flight.ArrivalOrder[previous + 1] = flight.ArrivalOrder[previous];
                    previous--;
                }
                flight.ArrivalOrder[previous + 1] = i;
            }
        }

        private void Prepare(Flight flight, Target target, int balance, int amount, bool sound, bool preview, ref int pitch)
        {
            flight.Target = target;
            bool hasTarget = target.Sprite != null && target.TryGetCenter(uiCamera, out _);
            flight.Count = hasTarget ? (reduced ? 1 : IconCount(amount)) : 0;
            flight.FinalText = Format(balance);
            int displayed = Mathf.Max(0, balance - amount);
            int destination = preview && amount > balance ? amount : balance;
            flight.StartText = Format(displayed);
            FillShares(amount, flight.Shares, flight.Count);
            var cue = sound ? new RewardCue { reason = "home_reward" } : null;
            PlanPaths(flight);
            for (int i = 0; i < flight.Count; i++)
            {
                int index = flight.ArrivalOrder[i];
                displayed += Mathf.Min(flight.Shares[index], destination - displayed);
                flight.ArrivalText[i] = Format(displayed);
                bool last = i == flight.Count - 1;
                if (sound)
                {
                    cue.pitchStep = pitch++;
                    cue.tier = last ? 1 : 0;
                    cue.completion = last;
                }
                flight.Notes[i] = sound ? audioPlayer.PrepareHomeReward(cue, volume) : null;
            }
            target.Show(flight.Count > 0 ? flight.StartText : flight.FinalText);
        }

        private void Begin(Flight flight)
        {
            current = flight;
            elapsed = arrivals = 0;
            lastImpact = float.NegativeInfinity;
            for (int i = 0; i < flight.Count; i++)
            {
                pool[i].sprite = flight.Target.Sprite;
                pool[i].color = flight.Target.Tint;
            }
        }

        private void LateUpdate()
        {
            if (current == null || Time.frameCount == requestedFrame || !attention.IsOwner(this)) return;
            if (session != controller.Session || session.Revision != revision)
            {
                Cancel();
                return;
            }

            float delta = Time.unscaledDeltaTime;
            if (delay > 0)
            {
                delay -= delta;
                if (delay > 0) return;
                delta = -delay;
                delay = 0;
            }
            Animate(delta);
        }

        private void Animate(float delta)
        {
            using (Animation.Auto())
            {
                if (!current.Target.TryGetCenter(uiCamera, out Vector2 screenTarget) ||
                    !RectTransformUtility.ScreenPointToLocalPointInRectangle(flightLayer, screenTarget, uiCamera, out Vector2 end) ||
                    spending && !RectTransformUtility.ScreenPointToLocalPointInRectangle(flightLayer, screenTarget, uiCamera, out origin))
                {
                    FinishCurrent();
                    AdvancePastMissingTargets();
                    return;
                }

                if (spending) end = destination;
                elapsed += delta;
                MoveIcons(end);
                ApplyArrivals();
                UpdateImpact(end);
                if (arrivals == current.Count && (reduced || elapsed - lastImpact >= motion.punch.seconds))
                {
                    FinishCurrent();
                    AdvancePastMissingTargets();
                }
            }
        }

        private void MoveIcons(Vector2 end)
        {
            Vector2 travel = end - origin;
            Vector2 side = travel.sqrMagnitude > 0 ? new Vector2(-travel.y, travel.x).normalized : Vector2.right;
            for (int i = 0; i < current.Count; i++)
            {
                IconPath path = current.Paths[i];
                float age = elapsed - path.Delay;
                if (age < 0 || age >= path.Duration) continue;
                Image icon = pool[i];
                float phase = age / path.Duration;
                float t = reduced ? phase : motion.fly.Evaluate(phase);
                Vector2 control = (origin + end) / 2 + side * path.Arc;
                Vector2 position = Vector2.LerpUnclamped(Vector2.LerpUnclamped(origin, control, t),
                    Vector2.LerpUnclamped(control, end, t), t);
                float scale = reduced ? 1 : age <= motion.flyLaunchDuration
                    ? Mathf.Lerp(motion.flyLaunchScale, motion.flyPeakScale, age / motion.flyLaunchDuration)
                    : Mathf.Lerp(motion.flyPeakScale, 1, Mathf.InverseLerp(motion.flyLaunchDuration, path.Duration, age));
                icon.rectTransform.anchoredPosition = position;
                icon.rectTransform.localScale = Vector3.one * scale;
                if (!icon.gameObject.activeSelf)
                {
                    icon.gameObject.SetActive(true);
                    ActiveIconCount++;
                }
            }
        }

        private void ApplyArrivals()
        {
            while (arrivals < current.Count)
            {
                int index = current.ArrivalOrder[arrivals];
                if (elapsed < current.ArrivalTime(index)) break;
                HideIcon(pool[index]);
                current.Target.Show(current.ArrivalText[arrivals]);
                audioPlayer.Reward(current.Notes[arrivals], volume);
                arrivals++;
                lastImpact = elapsed;
                if (vibrate && arrivals == current.Count && (current == second || second.Count == 0)) haptics.Play();
            }
        }

        private void UpdateImpact(Vector2 end)
        {
            if (reduced || arrivals == 0) return;
            float age = elapsed - lastImpact;
            float spring = 1 - motion.punch.Evaluate(age);
            current.Target.Scale(1 + (motion.punchScale - 1) * spring);
            if (arrivals != current.Count) return;
            if (age >= motion.popOut.seconds)
            {
                if (burst.gameObject.activeSelf) burst.gameObject.SetActive(false);
                return;
            }
            float pop = motion.popOut.Evaluate(age);
            burst.rectTransform.anchoredPosition = end;
            burst.rectTransform.localScale = Vector3.one * (1 + pop);
            if (!burst.gameObject.activeSelf) burst.gameObject.SetActive(true);
            burst.canvasRenderer.SetAlpha(1 - pop);
        }

        private void HideIcon(Image icon)
        {
            if (!icon.gameObject.activeSelf) return;
            icon.gameObject.SetActive(false);
            ActiveIconCount--;
        }

        private void AdvancePastMissingTargets()
        {
            while (current != null && current.Count == 0) FinishCurrent();
        }

        private void FinishCurrent()
        {
            var finished = current;
            finished.Target.Show(finished.FinalText);
            ResetVisuals();
            if (finished == first && second.Count > 0)
            {
                Begin(second);
                return;
            }
            var callback = completed;
            completed = null;
            attention.Release(this);
            callback?.Invoke();
        }

        internal void Cancel(UnityGameSession.PhoneWallet wallet = null)
        {
            if (current == null) return;
            ResetVisuals();
            var callback = completed;
            completed = null;
            ShowWallet(wallet ?? session.ReadPhoneWallet());
            attention.Release(this);
            // Callers (e.g. a coop upgrade) wait for this; an interrupted flight still ends.
            callback?.Invoke();
        }

        private void ShowWallet(UnityGameSession.PhoneWallet wallet)
        {
            gold.Show(Format(wallet.Gold));
            egg.Show(Format(wallet.GoldenEggs));
        }

        private void ResetVisuals()
        {
            current.Target.Scale(1);
            current = null;
            for (int i = 0; i < pool.Length; i++) HideIcon(pool[i]);
            burst.gameObject.SetActive(false);
        }

        internal static string Format(int amount) => amount.ToString("N0", Turkish);
        private void OnDisable() => Cancel();
        private void OnDestroy() => haptics.Dispose();
    }
}
