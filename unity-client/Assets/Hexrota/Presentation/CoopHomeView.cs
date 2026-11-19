using System;
using System.Globalization;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Home coop entry: the coop on the plot (tap to open the upgrade panel), the progress bar toward the
    // next upgrade and the "ready" pulse, which beats on the coop itself and on the bar.
    // The bar never animates backwards; spending resets it at once, earning fills it with MotionTheme.fill.
    [DisallowMultipleComponent]
    public sealed class CoopHomeView : MonoBehaviour
    {
        [SerializeField] private UiTheme ui;
        [SerializeField] private MotionTheme motion;
        [SerializeField] private AttentionDirector attention;
        [SerializeField] private RewardFlight rewardFlight;

        [Header("Coop")]
        [Tooltip("Placeholder coop on the plot; its scale grows with the coop level.")]
        [SerializeField] private RectTransform coop;
        [Tooltip("The coop drawing inside the placeholder; it beats while an upgrade is ready.")]
        [SerializeField] private RectTransform coopVisual;
        [Tooltip("Tapping the coop opens the upgrade panel.")]
        [SerializeField] private Button coopTapArea;
        [SerializeField] private GameObject readyBadge;
        [SerializeField] private Image readyBadgeRim, readyBadgeFace;

        [Header("Panel")]
        [SerializeField] private CoopUpgradePanel panel;

        [Header("Progress")]
        [Tooltip("The whole bar; it beats with the coop while an upgrade is ready.")]
        [SerializeField] private RectTransform bar;
        [SerializeField] private RectTransform barFill;
        [SerializeField] private Image barTrack, barFillImage;
        [SerializeField] private Text barLabel;
        [SerializeField] private Outline barLabelOutline;
        [Tooltip("{have} and {cost} are replaced by the egg counts.")]
        [SerializeField] private string progressFormat = "{have} / {cost}";
        [SerializeField] private string readyLabel = "Hazır!";
        [SerializeField] private string completeLabel = "Alan tamamlandı";

        private FirstPlayableController controller;
        /// <summary>Set by the upgrade sequence: the view keeps its current state until released.</summary>
        internal bool Frozen;
        private UnityGameSession.CoopStatus status;
        private bool reducedMotion, wasFlying, bound;
        private float shownFill, fillFrom, fillTo, fillTime, pulseTime;
        private Vector3 coopRestScale = Vector3.one;

        /// <summary>Raised when the player taps the coop.</summary>
        internal event Action Opened;

        public UnityGameSession.CoopStatus Status => status;
        public float ShownFill => shownFill;
        public bool IsPulsing => attention != null && attention.IsOwner(this);
        public string ProgressText => barLabel != null ? barLabel.text : null;
        /// <summary>The coop on the plot; tapping it opens the upgrade panel.</summary>
        public Button Button => coopTapArea;
        public RectTransform CoopVisual => coopVisual;
        public RectTransform ProgressBar => bar;
        public bool PanelOpen => panel != null && panel.IsOpen;
        public CoopUpgradePanel Panel => panel;
        public bool ReadyBadgeShown => readyBadge != null && readyBadge.activeSelf;
        internal RectTransform CoopTarget => coop;

        internal void Bind(FirstPlayableController owner)
        {
            controller = owner;
            if (bound) return;
            bound = true;
            if (coop != null) coopRestScale = coop.localScale;
            barLabel.color = ui.label;
            readyBadgeRim.color = ui.heartDeep;
            readyBadgeFace.color = ui.heart;
            barTrack.color = ui.panelDeep;
            barFillImage.color = ui.cta;
            barLabelOutline.effectColor = ui.panelDeep;
            coopTapArea.onClick.AddListener(Open);
        }

        // CoopUpgradeSequence opens the panel and runs the upgrade.
        private void Open() => Opened?.Invoke();

        /// <param name="heldBackEggs">Eggs that are still flying to the counter; the bar fills once they land.</param>
        internal void Show(UnityGameSession.CoopStatus next, bool reduced, int heldBackEggs = 0)
        {
            reducedMotion = reduced;
            if (next == null) return;
            var previous = status;
            status = next;
            int eggs = Mathf.Max(0, next.Eggs - heldBackEggs);
            float target = Fraction(next, eggs);
            bool firstShow = previous == null;
            bool levelChanged = !firstShow && (previous.Level != next.Level || previous.AreaId != next.AreaId);
            if (firstShow || reduced || target < shownFill && !levelChanged) SetFill(target);
            else if (levelChanged) { SetFill(0); fillTo = target; fillTime = 0; } // spent: reset, then fill toward the new cost
            else if (!Mathf.Approximately(target, fillTo)) { fillFrom = shownFill; fillTo = target; fillTime = 0; }

            bool ready = next.Ready && heldBackEggs == 0;
            barLabel.text = !next.Usable ? "" : next.AreaComplete ? completeLabel : ready ? readyLabel :
                progressFormat.Replace("{have}", eggs.ToString(CultureInfo.InvariantCulture))
                    .Replace("{cost}", next.NextCost.ToString(CultureInfo.InvariantCulture));
            readyBadge.SetActive(ready);
            ShowLevel(next);
        }

        /// <summary>Updates only the placeholder coop for the given level.</summary>
        internal void ShowLevel(UnityGameSession.CoopStatus next)
        {
            if (coop != null && next != null && next.Usable && next.UpgradeCount > 0)
                coop.localScale = coopRestScale * Mathf.Lerp(ui.coopScaleEmpty, 1, (float)next.Level / next.UpgradeCount);
        }

        private static float Fraction(UnityGameSession.CoopStatus s, int eggs)
        {
            if (!s.Usable) return 0;
            if (s.AreaComplete) return 1;
            return s.NextCost <= 0 ? 0 : Mathf.Clamp01((float)eggs / s.NextCost);
        }

        private void SetFill(float value)
        {
            shownFill = fillFrom = fillTo = value;
            fillTime = motion.fill.seconds;
            ApplyFill();
        }

        private void ApplyFill() => barFill.anchorMax = new Vector2(shownFill, 1);

        private void Update()
        {
            if (controller == null || controller.Session == null || status == null) return;
            bool flying = rewardFlight != null && rewardFlight.IsPlaying;
            if (wasFlying && !flying && !Frozen) Show(controller.Session.ReadCoop(), controller.Session.ReducedMotion);
            wasFlying = flying;

            if (fillTime < motion.fill.seconds)
            {
                fillTime += Time.unscaledDeltaTime;
                shownFill = Mathf.LerpUnclamped(fillFrom, fillTo, motion.fill.Evaluate(fillTime));
                ApplyFill();
            }

            // The pulse waits for the flight and the fill so that one thing moves at a time.
            bool wantsPulse = status.Ready && readyBadge.activeSelf && !reducedMotion && !flying && !Frozen &&
                fillTime >= motion.fill.seconds && isActiveAndEnabled;
            if (wantsPulse && !IsPulsing && !attention.ModalOpen) attention.TryAcquire(AttentionKind.CoopPulse, this);
            else if (!wantsPulse && IsPulsing) attention.Release(this);
            AnimatePulse();
        }

        private void AnimatePulse()
        {
            if (!IsPulsing)
            {
                pulseTime = 0;
                SetPulseScale(1);
                return;
            }
            pulseTime = Mathf.Repeat(pulseTime + Time.unscaledDeltaTime, motion.coopPulsePeriod);
            float beat = 0.5f - 0.5f * Mathf.Cos(2 * Mathf.PI * pulseTime / motion.coopPulsePeriod);
            SetPulseScale(1 + (motion.coopPulseScale - 1) * beat);
        }

        private void SetPulseScale(float scale)
        {
            var size = new Vector3(scale, scale, 1);
            if (coopVisual != null) coopVisual.localScale = size;
            if (bar != null) bar.localScale = size;
        }

        private void OnDisable()
        {
            if (attention != null) attention.Release(this);
            SetPulseScale(1);
            wasFlying = false;
        }
    }
}
