using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Editor and HEXROTA_DEV_TOOLS players only: one tap wins the open chapter. The stored solution is
    // played through the real session, then the last move goes through the normal swap path, so the
    // celebration, result screen, rewards and home reward flight all run as after a real win.
    public sealed partial class FirstPlayableController
    {
        public const string DevelopmentWinButtonName = "DevelopmentWin";
        private const string DevelopmentWinLabel = "TEST: KAZAN";
        private Button developmentWin;

        /// <summary>True in the Editor and in players built with HEXROTA_DEV_TOOLS (the Development profile); release and playtest players never show the shortcut.</summary>
#if UNITY_EDITOR || HEXROTA_DEV_TOOLS
        public static bool DevelopmentToolsEnabled => true;
#else
        public static bool DevelopmentToolsEnabled => false;
#endif

        private void CreateDevelopmentWinButton()
        {
            if (!DevelopmentToolsEnabled || castleHud == null || developmentWin != null) return;
            var font = castleHud.GetComponentInChildren<Text>(true).font;
            var rect = new GameObject(DevelopmentWinButtonName, typeof(RectTransform)).GetComponent<RectTransform>();
            rect.gameObject.layer = castleHud.gameObject.layer;
            // A sibling of the HUD (not inside it), placed under its bottom-left corner by LayoutGameplay.
            rect.SetParent(castleHud.transform.parent, false);
            rect.pivot = new Vector2(0, 1);
            rect.sizeDelta = new Vector2(124, 34);
            var body = rect.gameObject.AddComponent<Image>();
            body.color = PlumBottom;
            developmentWin = rect.gameObject.AddComponent<Button>();
            developmentWin.targetGraphic = body;
            developmentWin.onClick.AddListener(DevelopmentCompleteStage);
            var label = new GameObject("Label", typeof(RectTransform)).GetComponent<RectTransform>();
            label.gameObject.layer = rect.gameObject.layer;
            label.SetParent(rect, false);
            label.anchorMin = Vector2.zero; label.anchorMax = Vector2.one; label.offsetMin = label.offsetMax = Vector2.zero;
            var text = label.gameObject.AddComponent<Text>();
            text.font = font; text.fontSize = 15; text.alignment = TextAnchor.MiddleCenter;
            text.color = MenuGold; text.raycastTarget = false; text.text = DevelopmentWinLabel;
        }

        private void PlaceDevelopmentWinButton(float hudBottom)
        {
            if (developmentWin == null) return;
            var rect = (RectTransform)developmentWin.transform;
            rect.anchorMin = rect.anchorMax = new Vector2(0, hudBottom);
            rect.anchoredPosition = new Vector2(10, -6);
            rect.SetAsLastSibling();
        }

        /// <summary>Wins the open chapter with its stored solution (Editor and HEXROTA_DEV_TOOLS players only).</summary>
        public void DevelopmentCompleteStage()
        {
            if (!DevelopmentToolsEnabled || !ready || !HasInterface || CurrentScreen != "playing" || Board == null ||
                Board.IsAnimating || IsEnteringStage || requesting || Session.Status != "playing") return;
            // The solution starts from the opening board; a chapter already in progress restarts first.
            if (Session.Snapshot.turn != 0 && !Session.Restart()) { ShowCommandFailure(Session.LastError); return; }
            var last = Session.PlayDevelopmentRouteToLastMove();
            HideOpeningLesson(); // the first-chapter lesson only accepts its own opening swap
            OpenCurrentBoard(false);
            if (last == null)
            {
                message.text = "TEST: çözüm oynanamadı (" + Session.LastError + ")";
                return;
            }
            RequestSwap(last[0], last[1]);
        }
    }
}
