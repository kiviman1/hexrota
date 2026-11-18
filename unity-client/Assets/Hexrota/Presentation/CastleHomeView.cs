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

        [Header("Player progress")]
        [SerializeField] private Text goldValue;
        [SerializeField] private Text livesValue;
        [SerializeField] private Text lifeStatus;
        [SerializeField] private Text stageLabel;
        [Tooltip("{n} is replaced by the chapter number.")]
        [SerializeField] private string chapterFormat = "Bölüm {n}";
        [Tooltip("{n} is replaced by the tutorial number.")]
        [SerializeField] private string tutorialFormat = "Öğretici {n}";
        [SerializeField] private string completedLabel = "Bahçe";
        [SerializeField] private string fullLifeLabel = "Dolu";

        internal void Bind(FirstPlayableController controller)
        {
            if (playButton != null) playButton.onClick.AddListener(controller.BeginJourney);
            if (lifeButton != null) lifeButton.onClick.AddListener(controller.OpenMobileLives);
            if (settingsButton != null) settingsButton.onClick.AddListener(controller.OpenMobileSettings);
            if (journeyButton != null) journeyButton.onClick.AddListener(controller.OpenJourney);
            if (gardenButton != null) gardenButton.onClick.AddListener(controller.OpenGarden);
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
            bool tutorial = nextStage < tutorialCount;
            int number = tutorial ? nextStage + 1 : nextStage - tutorialCount + 1;
            string format = tutorial ? tutorialFormat : chapterFormat;
            stageLabel.text = format.Replace("{n}", number.ToString(CultureInfo.InvariantCulture));
        }

        internal void ShowWallet(UnityGameSession.PhoneWallet wallet)
        {
            if (goldValue != null) goldValue.text = wallet.Gold.ToString("N0", CultureInfo.GetCultureInfo("tr-TR"));
            if (livesValue != null) livesValue.text = wallet.Lives.ToString(CultureInfo.InvariantCulture);
            if (lifeStatus != null) lifeStatus.text = wallet.Countdown ?? fullLifeLabel;
        }
    }
}
