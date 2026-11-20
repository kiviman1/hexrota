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
        [SerializeField] private Button areasButton;

        [Header("Bottom navigation")]
        [Tooltip("Shop · Home · Areas. Hidden until this many campaign chapters are complete.")]
        [SerializeField] private GameObject bottomNavigation;
        [Min(0)] [SerializeField] private int navigationUnlockChapters = 5;
        [Tooltip("Play row and coop bar: their vertical anchor and the bar's height above Play, with and without the menu.")]
        [SerializeField] private RectTransform playArea;
        [SerializeField] private RectTransform coopProgress;
        [SerializeField] private float playAnchorWithMenu = .244f, playAnchorWithoutMenu = .14f;
        [SerializeField] private float barAboveWithMenu = 64, barAboveWithoutMenu = 88;

        [Header("Home motion")]
        [SerializeField] private HomePlayButton playMotion;
        [SerializeField] private AttentionDirector attention;
        [SerializeField] private RewardFlight rewardFlight;
        [SerializeField] private CoopHomeView coopView;
        [SerializeField] private CoopUpgradeSequence coopSequence;
        [SerializeField] private HomeBackgroundLayers background;

        [Header("Player progress")]
        [SerializeField] private Text goldValue;
        [SerializeField] private Image goldIcon;
        [SerializeField] private Text livesValue;
        [SerializeField] private Text lifeStatus;
        [SerializeField] private Text stageLabel;
        [Tooltip("{n} is replaced by the chapter number.")]
        [SerializeField] private string chapterFormat = "Bölüm {n}";
        [SerializeField] private string completedLabel = "Bahçe";
        [SerializeField] private string fullLifeLabel = "Dolu";

        private FirstPlayableController controller;
        private UnityGameSession motionSession;
        private long motionRevision;
        private Camera uiCamera;

        internal RewardFlight Rewards => rewardFlight;
        internal CoopHomeView Coop => coopView;
        public bool NavigationShown => bottomNavigation != null && bottomNavigation.activeSelf;
        public int NavigationUnlockChapters => navigationUnlockChapters;
        /// <summary>Layered home background; its CoopPlot marks where the 3D coop will stand.</summary>
        internal HomeBackgroundLayers Background => background;
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
            // Golden Eggs land on the coop bar, which counts "have/cost" while they arrive.
            rewardFlight.Bind(controller, audio, new RewardFlight.Target(goldIcon, goldValue),
                new RewardFlight.Target(coopView.BarEgg, coopView.BarLabel, coopView.ProgressFor));
            if (coopView != null) coopView.Bind(controller);
            if (coopSequence != null) coopSequence.Bind(controller);
            if (playButton != null) playButton.onClick.AddListener(controller.BeginJourney);
            if (lifeButton != null) lifeButton.onClick.AddListener(controller.OpenMobileLives);
            if (settingsButton != null) settingsButton.onClick.AddListener(controller.OpenMobileSettings);
            if (journeyButton != null) journeyButton.onClick.AddListener(controller.OpenJourney);
            // One progression loop (play → Golden Egg → coop): the garden is no longer a home entry.
            if (gardenButton != null) gardenButton.gameObject.SetActive(false);
            if (recordsButton != null) recordsButton.onClick.AddListener(controller.OpenRecords);
            // The menu is Shop · Home · Areas; Journey and Records stay reachable from their pages only.
            if (journeyButton != null) journeyButton.gameObject.SetActive(false);
            if (recordsButton != null) recordsButton.gameObject.SetActive(false);
            if (areasButton != null) areasButton.onClick.AddListener(controller.OpenAreas);
#if UNITY_EDITOR || HEXROTA_DEV_TOOLS
            // Coop art preview: keys 0-4 / R and two TEST buttons (Editor and HEXROTA_DEV_TOOLS players only).
            if (coopSequence != null && coopView != null && GetComponent<CoopDevelopmentShortcut>() == null)
                CoopDevelopmentShortcut.Attach((RectTransform)transform, coopSequence, coopView.Sprite, controller,
                    playButton.GetComponentInChildren<Text>(true).font, coopSequence.Theme.panelDeep, coopSequence.Theme.label);
#endif
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

        /// <summary>The bottom menu opens once enough campaign chapters are complete; without it the
        /// Play row and the coop bar sit lower, with more room between them.</summary>
        internal void ShowNavigation(int completedChapters)
        {
            bool open = completedChapters >= navigationUnlockChapters;
            if (bottomNavigation != null && bottomNavigation.activeSelf != open) bottomNavigation.SetActive(open);
            float play = open ? playAnchorWithMenu : playAnchorWithoutMenu;
            if (playArea != null) { playArea.anchorMin = new Vector2(playArea.anchorMin.x, play); playArea.anchorMax = new Vector2(playArea.anchorMax.x, play); }
            if (coopProgress != null)
            {
                coopProgress.anchorMin = new Vector2(coopProgress.anchorMin.x, play);
                coopProgress.anchorMax = new Vector2(coopProgress.anchorMax.x, play);
                coopProgress.anchoredPosition = new Vector2(coopProgress.anchoredPosition.x, open ? barAboveWithMenu : barAboveWithoutMenu);
            }
        }

        internal void ShowWallet(UnityGameSession.PhoneWallet wallet)
        {
            // The Golden Egg count lives in the coop bar ("have/cost"), which the coop view writes.
            if (!rewardFlight.IsPlaying && goldValue != null) goldValue.text = RewardFlight.Format(wallet.Gold);
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
            if (background != null) background.SetReducedMotion(session.ReducedMotion);
        }
    }
}
