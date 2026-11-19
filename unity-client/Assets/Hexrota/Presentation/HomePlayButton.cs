using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    [DisallowMultipleComponent, RequireComponent(typeof(Button))]
    public sealed class HomePlayButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
    {
        [SerializeField] private UiTheme ui;
        [SerializeField] private MotionTheme motion;
        [SerializeField] private AttentionDirector attention;
        [SerializeField] private Image bevel, rim, fill, band, shine;
        [SerializeField] private RectTransform visual, shineViewport;
        [SerializeField] private Text stageLabel;
        [SerializeField] private Outline labelOutline;
        [SerializeField] private Shadow labelShadow;

        private enum Accent { None, Shine, Hop }
        private Accent accent;
        private Button button;
        private bool reducedMotion, pressed, hopped;
        private int pointerId;
        private float breatheTime, shineWait, idleTime, accentTime, pressTime, pressFrom, pressPose;
        private Vector2 restPosition;

        public bool IsShining => accent == Accent.Shine && attention.IsOwner(this);

        private void Awake()
        {
            button = GetComponent<Button>();
            restPosition = visual.anchoredPosition;
            bevel.color = rim.color = labelOutline.effectColor = labelShadow.effectColor = ui.ctaDeep;
            fill.color = ui.cta;
            Color highlight = ui.ctaLight;
            highlight.a = ui.ctaBandOpacity;
            band.color = highlight;
            shine.color = ui.shine;
            stageLabel.color = ui.label;
        }

        private void OnEnable()
        {
            attention.Changed += RefreshAccent;
            breatheTime = shineWait = 0;
            RegisterTouch();
        }

        private void OnDisable()
        {
            attention.Changed -= RefreshAccent;
            StopAccent();
            pressed = false;
            pressTime = motion.release.seconds;
            pressPose = pressFrom = 0;
            visual.localScale = Vector3.one;
            ApplyPose(0);
        }

        internal void SetReducedMotion(bool value)
        {
            if (reducedMotion == value) return;
            reducedMotion = value;
            if (value) StopAccent();
            breatheTime = shineWait = 0;
        }

        internal void RegisterTouch()
        {
            idleTime = 0;
            hopped = false;
            if (accent == Accent.Hop) StopAccent();
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            if (eventData.button != PointerEventData.InputButton.Left || !button.IsInteractable() || pressed) return;
            pointerId = eventData.pointerId;
            RegisterTouch();
            SetPressed(true);
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (eventData.button == PointerEventData.InputButton.Left && eventData.pointerId == pointerId && pressed)
                SetPressed(false);
        }

        private void SetPressed(bool value)
        {
            pressed = value;
            pressFrom = pressPose;
            pressTime = 0;
        }

        private void LateUpdate()
        {
            float delta = Time.unscaledDeltaTime;
            bool animate = !reducedMotion && !attention.ModalOpen;
            if (pressed && attention.ModalOpen) SetPressed(false);
            if (animate)
            {
                breatheTime = Mathf.Repeat(breatheTime + delta, motion.breathePeriod);
                idleTime += delta;
                shineWait += delta;
                bool shineDue = shineWait >= motion.shineInterval;
                if (shineDue) shineWait = Mathf.Repeat(shineWait, motion.shineInterval);
                if (accent == Accent.None && !pressed)
                {
                    if (!hopped && idleTime >= motion.idleHopDelay)
                        hopped = StartAccent(Accent.Hop);
                    else if (shineDue)
                        StartAccent(Accent.Shine);
                }
            }

            float breath = animate ? motion.breathe.Evaluate(breatheTime / motion.breathePeriod) : 0;
            float scale = 1 + motion.breatheAmplitude * breath;
            visual.localScale = new Vector3(scale, scale, 1);
            var timing = pressed ? motion.tap : motion.release;
            pressTime = Mathf.Min(pressTime + delta, timing.seconds);
            pressPose = Mathf.LerpUnclamped(pressFrom, pressed ? 1 : 0, timing.Evaluate(pressTime));

            float hop = 0;
            if (accent != Accent.None && attention.IsOwner(this))
            {
                accentTime += delta;
                float duration = accent == Accent.Shine ? motion.shineDuration : motion.release.seconds;
                if (accentTime >= duration) StopAccent();
                else if (accent == Accent.Shine) PlaceShine();
                else
                {
                    float phase = accentTime / duration;
                    float arc = 1 - Mathf.Abs(2 * phase - 1);
                    hop = motion.idleHopHeight * Mathf.Clamp01(motion.release.curve.Evaluate(arc));
                }
            }
            ApplyPose(hop);
        }

        private bool StartAccent(Accent next)
        {
            if (!attention.TryAcquire(AttentionKind.PlayShine, this)) return false;
            accent = next;
            accentTime = 0;
            if (next == Accent.Shine) PlaceShine();
            RefreshAccent();
            return true;
        }

        private void StopAccent()
        {
            accent = Accent.None;
            RefreshAccent();
            attention.Release(this);
        }

        private void RefreshAccent()
        {
            shine.enabled = IsShining;
            if (!attention.IsOwner(this)) ApplyPose(0);
        }

        private void PlaceShine()
        {
            var stripe = shine.rectTransform;
            float reach = shineViewport.rect.width / 2 + stripe.rect.height / 2;
            float phase = motion.shine.Evaluate(Mathf.Clamp01(accentTime / motion.shineDuration));
            stripe.anchoredPosition = new Vector2(Mathf.Lerp(-reach, reach, phase), 0);
        }

        private void ApplyPose(float hop)
        {
            visual.anchoredPosition = restPosition + Vector2.up * hop;
            rim.rectTransform.anchoredPosition = Vector2.up * (ui.bevelAtRest / 2 - pressPose * motion.pressDepth);
            float inset = pressPose * (ui.bevelAtRest - motion.pressDepth - ui.bevelPressed);
            bevel.rectTransform.offsetMin = Vector2.up * inset;
        }
    }
}
