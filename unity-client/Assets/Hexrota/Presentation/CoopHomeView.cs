using System;
using System.Globalization;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Home coop entry: the coop button, the progress bar toward the next upgrade and the "ready" pulse.
    // The bar never animates backwards; spending resets it at once, earning fills it with MotionTheme.fill.
    [DisallowMultipleComponent]
    public sealed class CoopHomeView : MonoBehaviour
    {
        [SerializeField] private UiTheme ui;
        [SerializeField] private MotionTheme motion;
        [SerializeField] private AttentionDirector attention;
        [SerializeField] private RewardFlight rewardFlight;

        [Header("Coop")]
        [Tooltip("Placeholder coop in the scene; its scale grows with the coop level.")]
        [SerializeField] private RectTransform coop;
        [SerializeField] private Button coopButton, coopTapArea;
        [SerializeField] private RectTransform buttonVisual;
        [SerializeField] private Image buttonRim, buttonFace, pulseRing;
        [SerializeField] private Text buttonLabel;
        [SerializeField] private Outline buttonLabelOutline;
        [SerializeField] private GameObject readyBadge;
        [SerializeField] private Image readyBadgeRim, readyBadgeFace;

        [Header("Panel")]
        [SerializeField] private CoopUpgradePanel panel;

        [Header("Progress")]
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

        /// <summary>Raised when the player taps the coop or its button.</summary>
        internal event Action Opened;

        public UnityGameSession.CoopStatus Status => status;
        public float ShownFill => shownFill;
        public bool IsPulsing => attention != null && attention.IsOwner(this);
        public string ProgressText => barLabel != null ? barLabel.text : null;
        public Button Button => coopButton;
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
            buttonRim.color = buttonLabelOutline.effectColor = ui.skyDeep;
            buttonFace.color = ui.sky;
            buttonLabel.color = barLabel.color = ui.label;
            var ring = ui.gold;
            ring.a = ui.coopRingOpacity;
            pulseRing.color = ring;
            pulseRing.enabled = false;
            readyBadgeRim.color = ui.heartDeep;
            readyBadgeFace.color = ui.heart;
            barTrack.color = ui.panelDeep;
            barFillImage.color = ui.cta;
            barLabelOutline.effectColor = ui.panelDeep;
            coopButton.onClick.AddListener(Open);
            if (coopTapArea != null) coopTapArea.onClick.AddListener(Open);
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
            bool pulsing = IsPulsing;
            pulseRing.enabled = pulsing;
            if (!pulsing)
            {
                pulseTime = 0;
                buttonVisual.localScale = Vector3.one;
                return;
            }
            pulseTime = Mathf.Repeat(pulseTime + Time.unscaledDeltaTime, motion.coopPulsePeriod);
            float beat = 0.5f - 0.5f * Mathf.Cos(2 * Mathf.PI * pulseTime / motion.coopPulsePeriod);
            float scale = 1 + (motion.coopPulseScale - 1) * beat;
            buttonVisual.localScale = new Vector3(scale, scale, 1);
            var ring = pulseRing.color;
            ring.a = ui.coopRingOpacity * beat;
            pulseRing.color = ring;
        }

        private void OnDisable()
        {
            if (attention != null) attention.Release(this);
            if (buttonVisual != null) buttonVisual.localScale = Vector3.one;
            if (pulseRing != null) pulseRing.enabled = false;
            wasFlying = false;
        }
    }
}
