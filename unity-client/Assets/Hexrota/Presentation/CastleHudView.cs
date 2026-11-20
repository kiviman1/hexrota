using System.Globalization;
using System.Linq;
using Hexrota.Gameplay;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    [DisallowMultipleComponent]
    public sealed class CastleHudView : MonoBehaviour
    {
        [Header("Oyun")]
        [SerializeField] private Text remainingMoves;
        [SerializeField] private Button settings;
        [Tooltip("Booster bag. Left empty, it is built from the settings button under it.")]
        [SerializeField] private Button bag;
        [SerializeField, Tooltip("Bag button height below the settings slot, as a fraction of the settings height.")]
        private float bagGap = .06f;

        [Header("Hedefler")]
        [SerializeField] private Text scoreCount;
        [SerializeField] private Text groundCount;
        [SerializeField] private RectTransform scoreProgress;
        [SerializeField] private RectTransform groundProgress;
        [SerializeField] private string progressFormat = "{current} / {target}";

        [Header("Eşleşme geri bildirimi")]
        [SerializeField] private RectTransform scoreGoal;
        [SerializeField] private RectTransform groundGoal;
        private Vector3 scoreRestScale, groundRestScale;
        private int scoreTarget;

        internal RectTransform ScoreDestination => scoreCount.rectTransform;
        internal Button Bag => bag;
        public const string BagButtonName = "Çanta";
        internal bool IsReady => settings != null && scoreCount != null && remainingMoves != null &&
            groundCount != null && scoreProgress != null && groundProgress != null;

        internal void Bind(FirstPlayableController game)
        {
            if (settings != null) { settings.onClick.AddListener(game.PlayButtonSound); settings.onClick.AddListener(game.OpenMobileSettings); }
            if (bag == null && settings != null) bag = BuildBag(CastlePopupChrome.ChestIcon);
            if (bag != null) { bag.onClick.AddListener(game.PlayButtonSound); bag.onClick.AddListener(game.OpenInventory); }
        }

        // Same plate as the settings button, directly under it, with the bag (chest) icon.
        private Button BuildBag(Sprite icon)
        {
            var copy = Instantiate(settings.gameObject, settings.transform.parent, false);
            copy.name = BagButtonName;
            var source = (RectTransform)settings.transform; var rect = (RectTransform)copy.transform;
            float height = source.anchorMax.y - source.anchorMin.y;
            rect.anchorMin = new Vector2(source.anchorMin.x, source.anchorMin.y - height * (1 + bagGap));
            rect.anchorMax = new Vector2(source.anchorMax.x, source.anchorMin.y - height * bagGap);
            var button = copy.GetComponent<Button>();
            button.onClick = new Button.ButtonClickedEvent();
            // The settings glyph is a RawImage; show the chest sprite's area of its texture instead.
            var glyph = copy.GetComponentsInChildren<RawImage>(true).FirstOrDefault();
            if (glyph != null && icon != null)
            {
                glyph.name = "BagIcon";
                glyph.texture = icon.texture;
                var area = icon.textureRect; float w = icon.texture.width, h = icon.texture.height;
                glyph.uvRect = new Rect(area.x / w, area.y / h, area.width / w, area.height / h);
            }
            return button;
        }

        /// <summary>How far the visible bag hangs below the HUD, as a share of the HUD height (0 when hidden).</summary>
        internal float BagOverhang
        {
            get
            {
                if (bag == null || !bag.gameObject.activeSelf) return 0f;
                var rect = (RectTransform)bag.transform;
                return Mathf.Max(0f, -rect.anchorMin.y);
            }
        }

        /// <summary>The bag shows once a booster is unlocked and is usable whenever a booster can be used.</summary>
        internal void ShowBag(bool visible, bool usable)
        {
            if (bag == null) return;
            bag.gameObject.SetActive(visible);
            bag.interactable = usable;
        }

        private void Awake()
        {
            scoreRestScale = scoreGoal.localScale;
            groundRestScale = groundGoal.localScale;
        }

        internal void ShowStage(int target, GameSnapshot snapshot, int startingSoil)
        {
            ShowMoves(snapshot.movesLeft);
            soilAtStart = startingSoil;
            ShowGround(snapshot.layers);
            scoreTarget = target;
            ShowScore(snapshot.score);
        }

        internal void ShowMoves(int moves)
        {
            remainingMoves.text = moves.ToString(CultureInfo.InvariantCulture);
        }

        private int soilAtStart;

        /// <summary>Remaining soil layers on the board; the counter reaches 0 when every cell is green.</summary>
        internal static int RemainingSoil(int[] layers)
        {
            int remaining = 0;
            foreach (int layer in layers) remaining += Mathf.Max(0, layer);
            return remaining;
        }

        internal void ShowGround(int[] layers)
        {
            int remaining = RemainingSoil(layers);
            groundCount.text = remaining.ToString(CultureInfo.InvariantCulture);
            float cleared = soilAtStart > 0 ? Mathf.Clamp01(1f - (float)remaining / soilAtStart) : 1f;
            groundProgress.anchorMax = new Vector2(cleared, groundProgress.anchorMax.y);
            groundProgress.gameObject.SetActive(cleared > 0);
        }

        internal void ShowScore(int score)
        {
            ShowProgress(scoreCount, scoreProgress, score, scoreTarget);
        }

        private void ShowProgress(Text label, RectTransform fill, int current, int target)
        {
            label.text = progressFormat.Replace("{current}", current.ToString(CultureInfo.InvariantCulture))
                .Replace("{target}", target.ToString(CultureInfo.InvariantCulture));
            float fraction = target > 0 ? Mathf.Clamp01((float)current / target) : 1f;
            fill.anchorMax = new Vector2(fraction, fill.anchorMax.y);
            fill.gameObject.SetActive(fraction > 0);
        }

        internal void ScaleGoals(float score, float ground)
        {
            if (scoreGoal != null) scoreGoal.localScale = scoreRestScale * score;
            if (groundGoal != null) groundGoal.localScale = groundRestScale * ground;
        }
    }
}
