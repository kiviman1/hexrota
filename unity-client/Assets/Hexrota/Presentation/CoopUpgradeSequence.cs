using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Coop upgrade presentation (attention priority 2). The upgrade itself is saved before anything
    // moves; this sequence is only visual, so cancelling it at any point (background, scene change)
    // just snaps the home to the saved state.
    //   1 panel closes · 2 eggs fly from the counter to the coop
    //   3 a dust cloud covers the building (MotionTheme.dustCover); at its densest the sprite changes
    //   4 the dust clears (dustClear) while the new building squashes and stretches in (coopSquash)
    //   5 sparkle burst + haptic, "Seviye N!" · 6 new residents pop in · 7 bar refills
    // Reduced motion: a short cross-fade between the sprites (reducedCrossfade), no dust, no squash.
    [DisallowMultipleComponent]
    public sealed class CoopUpgradeSequence : MonoBehaviour
    {
        [SerializeField] private UiTheme ui;
        [SerializeField] private MotionTheme motion;
        [SerializeField] private AttentionDirector attention;
        [SerializeField] private RewardFlight rewardFlight;
        [SerializeField] private CoopHomeView coopView;
        [SerializeField] private CoopUpgradePanel panel;
        [Tooltip("Full-screen transparent blocker that locks input while the sequence plays.")]
        [SerializeField] private GameObject inputLock;
        [SerializeField] private Image burst;
        [SerializeField] private CoopDustBurst dust;
        [SerializeField] private Text levelBanner;
        [SerializeField] private Outline levelBannerOutline;
        [Tooltip("Placeholder residents, shown in order; the coop status decides how many are visible.")]
        [SerializeField] private RectTransform[] residents;
        [Tooltip("{n} is replaced by the new level.")]
        [SerializeField] private string bannerFormat = "Seviye {n}!";

        private enum Step { Idle, ClosingPanel, Flying, Dust, Squash, Crossfade, Banner, Residents, Done }
        private readonly PhoneRewardHaptics haptics = new PhoneRewardHaptics();
        private FirstPlayableController controller;
        private UnityGameSession.CoopStatus before, after;
        private Step step;
        private float time;
        private bool reduced, bound;
        private Vector3 coopScale;
        private int shownResidents;

        public bool IsPlaying => step != Step.Idle;
        public int VisibleResidents => shownResidents;
        public string Banner => levelBanner.gameObject.activeSelf ? levelBanner.text : null;
        /// <summary>The dust cloud is covering the building (the sprite changes at the end of this phase).</summary>
        public bool DustCovering => dust != null && dust.Covering;
        public bool DustPlaying => dust != null && dust.IsPlaying;
        internal event Action Finished;

        internal void Bind(FirstPlayableController owner)
        {
            controller = owner;
            if (bound) return;
            bound = true;
            coopView.Opened += OpenPanel;
            panel.UpgradeRequested += Upgrade;
            levelBanner.color = ui.label;
            levelBannerOutline.effectColor = ui.goldDeep;
            burst.color = ui.goldLight;
            HideTransients();
        }

        /// <summary>Shows the residents the saved coop has; used on every home refresh.</summary>
        internal void ShowResidents(UnityGameSession.CoopStatus status)
        {
            if (IsPlaying || status == null) return;
            SetResidents(status.Usable ? status.Chickens : 0);
        }

        private void OpenPanel()
        {
            if (IsPlaying || controller == null || controller.Session == null) return;
            panel.Open(controller.Session.ReadCoop(), controller.Session.ReducedMotion);
        }

        private void Upgrade()
        {
            var session = controller != null ? controller.Session : null;
            if (session == null || IsPlaying) return;
            var previous = session.ReadCoop();
            // Data first: the spend and the new level are durable before step 1 starts.
            if (!session.TryUpgradeCoop())
            {
                panel.Show(session.ReadCoop());
                return;
            }
            before = previous;
            after = session.ReadCoop();
            reduced = session.ReducedMotion;
            attention.TryAcquire(AttentionKind.CoopUpgrade, this);
            coopView.Frozen = true;
            inputLock.SetActive(true);
            coopScale = coopView.CoopTarget.localScale;
            Begin(Step.ClosingPanel);
            panel.Close(() => { if (step == Step.ClosingPanel) Fly(); }, immediate: reduced);
        }

        private void Fly()
        {
            Begin(Step.Flying);
            Vector2 target = RectTransformUtility.WorldToScreenPoint(UiCamera(),
                coopView.CoopTarget.TransformPoint(coopView.CoopTarget.rect.center));
            if (!rewardFlight.PlaySpend(target, before.NextCost, after.Eggs, () => { if (step == Step.Flying) Arrive(); }))
                Arrive();
        }

        // The eggs have landed on the coop.
        private void Arrive()
        {
            var view = coopView.Sprite;
            if (reduced || dust == null || view == null)
            {
                // Reduced motion: a short cross-fade to the new building, no dust.
                Begin(Step.Crossfade);
                if (view != null) view.CrossFade(after.Usable ? after.Level : 0, motion.reducedCrossfade.seconds);
                else coopView.ShowLevel(after);
                return;
            }
            Begin(Step.Dust);
            dust.Play(view.Bounds, () => { if (step == Step.Dust) Squash(); });
        }

        // Densest dust: the sprite changes, then the new building squashes and stretches in while the dust clears.
        private void Squash()
        {
            Begin(Step.Squash);
            coopView.ShowLevel(after);
            coopScale = coopView.CoopTarget.localScale;
        }

        private void Sparkle()
        {
            if (motion.arrivalHapticMs > 0 && controller.Session.HapticsEnabled)
            {
                haptics.Prepare(motion.arrivalHapticMs);
                haptics.Play();
            }
            burst.gameObject.SetActive(true);
            burst.rectTransform.position = coopView.CoopTarget.TransformPoint(coopView.CoopTarget.rect.center);
            burst.rectTransform.localScale = Vector3.one;
            burst.canvasRenderer.SetAlpha(1);
        }

        private void Begin(Step next)
        {
            step = next;
            time = 0;
        }

        private void Update()
        {
            if (!IsPlaying) return;
            if (controller == null || controller.Session == null) { Finish(); return; }
            float delta = Time.unscaledDeltaTime;
            time += delta;
            switch (step)
            {
                case Step.Crossfade:
                {
                    if (time >= motion.reducedCrossfade.seconds)
                    {
                        if (coopView.Sprite != null) coopView.Sprite.FinishFade();
                        SetResidents(after.Chickens);
                        Finish();
                    }
                    break;
                }
                case Step.Squash:
                {
                    // Squash & stretch from the ground while the dust clears; sparkles and the haptic as it settles.
                    var timing = motion.coopSquash;
                    float t = Mathf.Clamp01(time / timing.seconds);
                    float wave = Mathf.Sin(t * Mathf.PI * 2) * (1 - timing.Evaluate(time));
                    coopView.CoopTarget.localScale = Vector3.Scale(coopScale,
                        new Vector3(1 + motion.coopSquashAmount * wave, 1 - motion.coopSquashAmount * wave, 1));
                    if (!burst.gameObject.activeSelf && t >= .5f && time < timing.seconds) Sparkle();
                    if (burst.gameObject.activeSelf)
                    {
                        float s = Mathf.Clamp01((time - timing.seconds * .5f) / timing.seconds);
                        burst.rectTransform.localScale = Vector3.one * (1 + 2 * s);
                        burst.canvasRenderer.SetAlpha(1 - s);
                    }
                    bool dustDone = dust == null || !dust.IsPlaying;
                    if (time >= timing.seconds && dustDone)
                    {
                        coopView.CoopTarget.localScale = coopScale;
                        burst.gameObject.SetActive(false);
                        ShowBanner();
                    }
                    break;
                }
                case Step.Banner:
                {
                    float pop = time < motion.popIn.seconds ? motion.popIn.Evaluate(time) : 1;
                    levelBanner.rectTransform.localScale = Vector3.one * Mathf.Max(0, pop);
                    if (time >= motion.levelBannerHold) { levelBanner.gameObject.SetActive(false); Begin(Step.Residents); }
                    break;
                }
                case Step.Residents:
                {
                    int from = before.Chickens, to = after.Chickens;
                    for (int i = from; i < to && i < residents.Length; i++)
                    {
                        float age = time - (i - from) * motion.residentStagger;
                        if (age < 0) continue;
                        if (!residents[i].gameObject.activeSelf) { residents[i].gameObject.SetActive(true); shownResidents = Mathf.Max(shownResidents, i + 1); }
                        float s = age >= motion.popIn.seconds ? 1 : Mathf.Max(0, motion.popIn.Evaluate(age));
                        residents[i].localScale = Vector3.one * s;
                    }
                    float total = Mathf.Max(0, to - from - 1) * motion.residentStagger + motion.popIn.seconds;
                    if (time >= total) { SetResidents(to); Finish(); }
                    break;
                }
            }
        }

        private void ShowBanner()
        {
            Begin(Step.Banner);
            levelBanner.text = bannerFormat.Replace("{n}", after.Level.ToString(System.Globalization.CultureInfo.InvariantCulture));
            levelBanner.rectTransform.localScale = Vector3.zero;
            levelBanner.gameObject.SetActive(true);
        }

        private void SetResidents(int count)
        {
            shownResidents = Mathf.Min(count, residents.Length);
            for (int i = 0; i < residents.Length; i++)
            {
                residents[i].gameObject.SetActive(i < shownResidents);
                residents[i].localScale = Vector3.one;
            }
        }

        /// <summary>Ends the sequence and shows the saved state. Safe to call at any step.</summary>
        internal void Finish()
        {
            if (!IsPlaying) return;
            step = Step.Idle;
            if (rewardFlight.IsPlaying) rewardFlight.Cancel();
            if (panel.IsOpen) panel.Close(immediate: true);
            if (coopView != null) coopView.Frozen = false;
            if (coopView != null && coopView.CoopTarget != null && controller != null && controller.Session != null)
            {
                var saved = controller.Session.ReadCoop();
                // Step 6: the bar restarts from empty and fills toward the next cost (instant with reduced motion).
                coopView.Show(saved, controller.Session.ReducedMotion);
                SetResidents(saved.Usable ? saved.Chickens : 0);
            }
            HideTransients();
            inputLock.SetActive(false);
            attention.Release(this);
            Finished?.Invoke();
        }

        private void HideTransients()
        {
            if (dust != null) dust.Stop();
            if (coopView != null && coopView.Sprite != null) coopView.Sprite.FinishFade();
            if (coopView != null && coopView.CoopTarget != null) coopView.CoopTarget.localScale = Vector3.one;
            burst.gameObject.SetActive(false);
            levelBanner.gameObject.SetActive(false);
            inputLock.SetActive(false);
        }

        private Camera UiCamera()
        {
            var canvas = GetComponentInParent<Canvas>().rootCanvas;
            return canvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : canvas.worldCamera;
        }

        private void OnDisable() => Finish();
        private void OnDestroy() => haptics.Dispose();
    }
}
