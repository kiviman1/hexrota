using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Development shortcut for the coop art (Editor and HEXROTA_DEV_TOOLS players only; release and playtest builds compile
    // the body out and never add it). On the home screen:
    //   keys 0-4  show that coop level at once          R  replay the upgrade transition into it
    //   on a device, two small TEST buttons do the same: "KÜMES n" cycles the level, "GEÇİŞ" replays.
    // It is a preview: no eggs are spent and nothing is saved; the next home refresh shows the saved level.
    [AddComponentMenu("")]
    public sealed class CoopDevelopmentShortcut : MonoBehaviour
    {
#if UNITY_EDITOR || HEXROTA_DEV_TOOLS
        public const string LevelButtonName = "DevelopmentCoopLevel", ReplayButtonName = "DevelopmentCoopReplay";
        private CoopUpgradeSequence sequence;
        private CoopSpriteView sprite;
        private FirstPlayableController controller;
        private Text levelLabel;
        private int labelled = -1;

        internal static CoopDevelopmentShortcut Attach(RectTransform home, CoopUpgradeSequence sequence, CoopSpriteView sprite,
            FirstPlayableController controller, Font font, Color body, Color label)
        {
            if (!FirstPlayableController.DevelopmentToolsEnabled || sequence == null || sprite == null) return null;
            var shortcut = home.gameObject.AddComponent<CoopDevelopmentShortcut>();
            shortcut.sequence = sequence;
            shortcut.sprite = sprite;
            shortcut.controller = controller;
            shortcut.levelLabel = Button(home, LevelButtonName, new Vector2(10, -118), font, body, label, shortcut.NextLevel);
            Button(home, ReplayButtonName, new Vector2(10, -150), font, body, label, () => shortcut.Replay()).text = "TEST: GEÇİŞ";
            shortcut.UpdateLabel();
            return shortcut;
        }

        private static Text Button(RectTransform home, string name, Vector2 position, Font font, Color body, Color label,
            UnityEngine.Events.UnityAction action)
        {
            var rect = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rect.gameObject.layer = home.gameObject.layer;
            rect.SetParent(home, false);
            rect.anchorMin = rect.anchorMax = rect.pivot = new Vector2(0, 1);
            rect.anchoredPosition = position;
            rect.sizeDelta = new Vector2(112, 28);
            var image = rect.gameObject.AddComponent<Image>();
            image.color = body;
            var button = rect.gameObject.AddComponent<Button>();
            button.targetGraphic = image;
            button.onClick.AddListener(action);
            var text = new GameObject("Label", typeof(RectTransform)).GetComponent<RectTransform>();
            text.gameObject.layer = rect.gameObject.layer;
            text.SetParent(rect, false);
            text.anchorMin = Vector2.zero; text.anchorMax = Vector2.one; text.offsetMin = text.offsetMax = Vector2.zero;
            var caption = text.gameObject.AddComponent<Text>();
            caption.font = font; caption.fontSize = 13; caption.alignment = TextAnchor.MiddleCenter;
            caption.color = label; caption.raycastTarget = false;
            return caption;
        }

        private bool OnHome => controller != null && controller.CurrentScreen == "menu" && isActiveAndEnabled;

        /// <summary>Shows a coop level at once (preview only).</summary>
        public void ShowLevel(int level)
        {
            sequence.DevelopmentShowLevel(level);
            UpdateLabel();
        }

        /// <summary>Replays the upgrade transition into the shown level (preview only).</summary>
        public bool Replay() => sequence.DevelopmentReplay();

        private void NextLevel() => ShowLevel((Mathf.Max(0, sprite.Level) + 1) % sprite.LevelCount);

        private void UpdateLabel()
        {
            labelled = Mathf.Max(0, sprite.Level);
            if (levelLabel != null) levelLabel.text = "TEST: KÜMES " + labelled;
        }

        private void Update()
        {
            if (labelled != Mathf.Max(0, sprite.Level)) UpdateLabel();
            if (!OnHome) return;
            for (int level = 0; level < sprite.LevelCount && level <= 9; level++)
                if (Input.GetKeyDown(KeyCode.Alpha0 + level) || Input.GetKeyDown(KeyCode.Keypad0 + level)) ShowLevel(level);
            if (Input.GetKeyDown(KeyCode.R)) Replay();
        }
#endif
    }
}
