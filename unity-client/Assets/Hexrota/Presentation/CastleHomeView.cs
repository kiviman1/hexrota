using System.Globalization;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    [DisallowMultipleComponent]
    public sealed class CastleHomeView : MonoBehaviour
    {
        [Header("Navigation")]
        [SerializeField] private Button playButton;
        [SerializeField] private Button lifeButton;
        [SerializeField] private Button settingsButton;
        [SerializeField] private Button journeyButton;
        [SerializeField] private Button gardenButton;
        [SerializeField] private Button recordsButton;

        [Header("Home motion")]
        [SerializeField] private HomePlayButton playMotion;
        [SerializeField] private AttentionDirector attention;
        [SerializeField] private RewardFlight rewardFlight;
        [SerializeField] private CoopHomeView coopView;
        [SerializeField] private CoopUpgradeSequence coopSequence;

        [Header("Player progress")]
        [SerializeField] private Text goldValue;
        [SerializeField] private Text eggValue;
        [SerializeField] private Image eggWallet;
        [SerializeField] private UiTheme walletTheme;
        [SerializeField] private Image goldIcon, eggIcon;
        [SerializeField] private Text livesValue;
        [SerializeField] private Text lifeStatus;
        [SerializeField] private Text stageLabel;
        [Tooltip("{n} is replaced by the chapter number.")]
        [SerializeField] private string chapterFormat = "Bölüm {n}";
        [SerializeField] private string completedLabel = "Kümesine dön";
        [SerializeField] private string fullLifeLabel = "Dolu";

        private FirstPlayableController controller;
        private UnityGameSession motionSession;
        private long motionRevision;
        private Camera uiCamera;

        internal RewardFlight Rewards => rewardFlight;
        internal CoopHomeView Coop => coopView;
        /// <summary>A reward flight or the coop upgrade is animating; periodic refreshes must wait.</summary>
        internal bool IsBusy => rewardFlight.IsPlaying || (coopSequence != null && coopSequence.IsPlaying);
        internal void FinishCoopUpgrade() { if (coopSequence != null) coopSequence.Finish(); }
        internal Vector2 RewardSource
        {
            get
            {
                var rect = (RectTransform)playButton.transform;
                return RectTransformUtility.WorldToScreenPoint(uiCamera, rect.TransformPoint(rect.rect.center));
            }
        }

        internal void Bind(FirstPlayableController owner, PhoneAudio audio)
        {
            controller = owner;
            Canvas canvas = GetComponentInParent<Canvas>().rootCanvas;
            uiCamera = canvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : canvas.worldCamera;
            eggWallet.color = walletTheme.panelDeep;
            eggValue.color = walletTheme.label;
            rewardFlight.Bind(controller, audio, new RewardFlight.Target(goldIcon, goldValue),
                new RewardFlight.Target(eggIcon, eggValue));
            if (coopView != null) coopView.Bind(controller);
            if (coopSequence != null) coopSequence.Bind(controller);
            if (playButton != null) playButton.onClick.AddListener(controller.BeginJourney);
            if (lifeButton != null) lifeButton.onClick.AddListener(controller.OpenMobileLives);
            if (settingsButton != null) settingsButton.onClick.AddListener(controller.OpenMobileSettings);
            if (journeyButton != null) journeyButton.onClick.AddListener(controller.OpenJourney);
            // One progression loop (play → Golden Egg → coop): the garden is no longer a home entry.
            if (gardenButton != null) gardenButton.gameObject.SetActive(false);
            if (recordsButton != null) recordsButton.onClick.AddListener(controller.OpenRecords);
        }

        internal void ShowStage(int nextStage, int tutorialCount)
        {
            if (stageLabel == null) return;
            if (nextStage < 0)
            {
                stageLabel.text = completedLabel;
                return;
            }
            int number = nextStage - tutorialCount + 1;
            stageLabel.text = chapterFormat.Replace("{n}", number.ToString(CultureInfo.InvariantCulture));
        }

        internal void ShowWallet(UnityGameSession.PhoneWallet wallet)
        {
            if (!rewardFlight.IsPlaying)
            {
                if (goldValue != null) goldValue.text = RewardFlight.Format(wallet.Gold);
                if (eggValue != null) eggValue.text = RewardFlight.Format(wallet.GoldenEggs);
            }
            if (livesValue != null) livesValue.text = wallet.Lives.ToString(CultureInfo.InvariantCulture);
            if (lifeStatus != null) lifeStatus.text = wallet.Countdown ?? fullLifeLabel;
        }

        internal void ShowCoop(UnityGameSession.CoopStatus status, bool reducedMotion, int heldBackEggs = 0)
        {
            if (coopView != null) coopView.Show(status, reducedMotion, heldBackEggs);
            if (coopSequence != null) coopSequence.ShowResidents(status);
        }

        internal void RegisterTouch() { if (isActiveAndEnabled) playMotion.RegisterTouch(); }

        private void Update()
        {
            if (controller == null || controller.Session == null) return;
            attention.SetModalOpen(controller.HomePanelOpen || (coopView != null && coopView.PanelOpen));
            var session = controller.Session;
            if (motionSession == session && motionRevision == session.Revision) return;
            motionSession = session;
            motionRevision = session.Revision;
            playMotion.SetReducedMotion(session.ReducedMotion);
        }
    }
}
