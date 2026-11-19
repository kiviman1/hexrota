using System;
using System.Globalization;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Coop upgrade dialog: purple panel, gold ribbon title, cream card with what arrives, the cost,
    // and one primary button. Without enough eggs the button looks disabled, says how many eggs are
    // missing and only shakes when pressed.
    [DisallowMultipleComponent]
    public sealed class CoopUpgradePanel : MonoBehaviour
    {
        [SerializeField] private UiTheme ui;
        [SerializeField] private MotionTheme motion;

        [Header("Structure")]
        [SerializeField] private Image shade;
        [SerializeField] private Button shadeButton, closeButton, upgradeButton;
        [SerializeField] private RectTransform body, upgradeVisual;
        [SerializeField] private Image bodyRim, bodyFill, ribbonRim, ribbonFill, cardFill, costFill;
        [SerializeField] private Image closeRim, closeFill, buttonRim, buttonFill;
        [SerializeField] private Text title, cardText, costText, buttonLabel, hintText, closeLabel;
        [SerializeField] private Outline titleOutline, buttonLabelOutline, closeOutline, costOutline;

        [Header("Copy")]
        [Tooltip("{n} is replaced by the level the upgrade builds.")]
        [SerializeField] private string titleFormat = "Kümes Seviye {n}";
        [Tooltip("{n} is replaced by the number of arriving chickens.")]
        [SerializeField] private string arrivalFormat = "Kümes büyür ve {n} yeni tavuk gelir.";
        [SerializeField] private string growOnlyText = "Kümes büyür.";
        [SerializeField] private string completeTitle = "Alan tamamlandı";
        [SerializeField] private string completeText = "Bu alanın bütün yükseltmeleri bitti. Tavik yakında yeni bir yere taşınacak.";
        [Tooltip("{n} is replaced by the missing eggs.")]
        [SerializeField] private string missingFormat = "{n} yumurta daha";
        [SerializeField] private string upgradeLabel = "Yükselt";
        [Tooltip("Level 0: the plot is empty and the first upgrade builds the coop.")]
        [SerializeField] private string buildLabel = "Kümesi inşa et";
        [Tooltip("{n} is replaced by the number of arriving chickens (level 0 only).")]
        [SerializeField] private string buildArrivalFormat = "Kümes kurulur ve {n} yeni tavuk gelir.";

        private enum Phase { Closed, Opening, Open, Closing }
        private Phase phase;
        private float time, shakeTime;
        private bool affordable, initialized;
        private Action closed;

        /// <summary>Raised when the player presses an affordable "Yükselt".</summary>
        internal event Action UpgradeRequested;

        public bool IsOpen => phase != Phase.Closed;
        public bool CanUpgrade => affordable && phase == Phase.Open;
        public bool IsShaking => shakeTime < motion.shake.seconds;
        public string Title => title.text;
        public string Hint => hintText.gameObject.activeSelf ? hintText.text : null;
        public string Card => cardText.text;
        public string Cost => costText.text;
        public string Action => buttonLabel.text;
        public Button UpgradeButton => upgradeButton;

        // The panel object starts inactive in the prefab, so set-up runs on first use rather than in Awake.
        private void Initialize()
        {
            if (initialized) return;
            initialized = true;
            bodyRim.color = ui.panelDeep;
            bodyFill.color = ui.panel;
            ribbonRim.color = titleOutline.effectColor = ui.goldDeep;
            ribbonFill.color = ui.gold;
            cardFill.color = ui.cream;
            cardText.color = ui.ink;
            costFill.color = ui.panelInset;
            costOutline.effectColor = ui.panelDeep;
            closeRim.color = closeOutline.effectColor = ui.heartDeep;
            closeFill.color = ui.heart;
            title.color = costText.color = buttonLabel.color = closeLabel.color = ui.label;
            hintText.color = ui.onPanelMuted;
            shadeButton.onClick.AddListener(() => Close());
            closeButton.onClick.AddListener(() => Close());
            upgradeButton.onClick.AddListener(Press);
            shakeTime = motion.shake.seconds;
        }

        internal void Open(UnityGameSession.CoopStatus status, bool reducedMotion)
        {
            Initialize();
            gameObject.SetActive(true);
            Show(status);
            closed = null;
            phase = Phase.Opening;
            time = reducedMotion ? motion.popIn.seconds : 0;
            shakeTime = motion.shake.seconds;
            Apply();
        }

        internal void Show(UnityGameSession.CoopStatus status)
        {
            Initialize();
            bool complete = status == null || !status.Usable || status.AreaComplete;
            title.text = complete ? completeTitle : titleFormat.Replace("{n}", Number(status.TargetLevel));
            bool build = !complete && status.Level == 0;
            buttonLabel.text = build ? buildLabel : upgradeLabel;
            cardText.text = complete ? completeText : status.NextChickens > 0
                ? (build ? buildArrivalFormat : arrivalFormat).Replace("{n}", Number(status.NextChickens)) : growOnlyText;
            costFill.gameObject.SetActive(!complete);
            upgradeButton.gameObject.SetActive(!complete);
            affordable = !complete && status.Eggs >= status.NextCost;
            if (!complete) costText.text = Number(status.NextCost);
            int missing = complete ? 0 : status.NextCost - status.Eggs;
            hintText.gameObject.SetActive(missing > 0);
            if (missing > 0) hintText.text = missingFormat.Replace("{n}", Number(missing));
            buttonRim.color = buttonLabelOutline.effectColor = affordable ? ui.ctaDeep : ui.disabledDeep;
            buttonFill.color = affordable ? ui.cta : ui.disabled;
        }

        /// <param name="done">Called once the panel has finished closing (immediately if already closed).</param>
        internal void Close(Action done = null, bool immediate = false)
        {
            if (phase == Phase.Closed) { done?.Invoke(); return; }
            closed += done;
            if (immediate) { Finish(); return; }
            if (phase == Phase.Closing) return;
            phase = Phase.Closing;
            time = 0;
        }

        private void Press()
        {
            if (phase != Phase.Open) return;
            if (!affordable)
            {
                shakeTime = 0;
                return;
            }
            UpgradeRequested?.Invoke();
        }

        private void Update()
        {
            float delta = Time.unscaledDeltaTime;
            time += delta;
            if (shakeTime < motion.shake.seconds) shakeTime += delta;
            if (phase == Phase.Opening && time >= motion.popIn.seconds) phase = Phase.Open;
            if (phase == Phase.Closing && time >= motion.popOut.seconds) { Finish(); return; }
            Apply();
        }

        private void Apply()
        {
            float shadeAlpha, scale, alpha = 1;
            if (phase == Phase.Closing)
            {
                float t = motion.popOut.Evaluate(time);
                scale = Mathf.LerpUnclamped(1, motion.panelCloseScale, t);
                alpha = 1 - t;
                shadeAlpha = ui.shadeOpacity * (1 - Mathf.Clamp01(time / motion.shadeOut));
            }
            else
            {
                scale = phase == Phase.Open ? 1 : Mathf.LerpUnclamped(motion.panelOpenScale, 1, motion.popIn.Evaluate(time));
                shadeAlpha = ui.shadeOpacity * Mathf.Clamp01(time / motion.shadeIn);
            }
            body.localScale = new Vector3(scale, scale, 1);
            body.GetComponent<CanvasGroup>().alpha = alpha;
            var color = ui.shade;
            color.a = shadeAlpha;
            shade.color = color;

            float shake = 0;
            if (shakeTime < motion.shake.seconds)
            {
                float decay = 1 - motion.shake.Evaluate(shakeTime);
                shake = Mathf.Sin(shakeTime / motion.shake.seconds * motion.shakeCycles * 2 * Mathf.PI) * motion.shakeDistance * decay;
            }
            upgradeVisual.anchoredPosition = new Vector2(shake, 0);
        }

        private void Finish()
        {
            phase = Phase.Closed;
            gameObject.SetActive(false);
            var done = closed;
            closed = null;
            done?.Invoke();
        }

        private static string Number(int value) => value.ToString(CultureInfo.InvariantCulture);
    }
}
