using System;
using System.Linq;
using Hexrota.UnityClient.Presentation;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Editor
{
    // Adds the coop upgrade panel to the home prefab, following style-guide/components/Panel:
    // purple body, gold ribbon title over the top edge, red close button, cream card, purple
    // inset with the cost, one primary button. Runtime colors come from UiTheme.
    public static class CoopPanelBuilder
    {
        private const string Prefab = "Assets/Hexrota/Resources/CastleHome/CastleHome.prefab";
        private const string Theme = "Assets/Hexrota/Presentation/Theme/";
        private const string Type = "Assets/Hexrota/Art/CastleHomeType/";
        private const string Name = "CoopPanel";

        [MenuItem("Hexrota/Home/Rebuild Coop Upgrade Panel")]
        public static void Rebuild()
        {
            var ui = Load<UiTheme>(Theme + "UiTheme.asset");
            var motion = Load<MotionTheme>(Theme + "MotionTheme.asset");
            var rounded = Load<Sprite>(Theme + "HomeRounded.png");
            var egg = Load<Sprite>("Assets/Hexrota/Art/CastleHome/GoldenEgg.png");
            var body = Load<Font>(Type + "Nunito-Black.ttf");
            var root = PrefabUtility.LoadPrefabContents(Prefab);
            try
            {
                var layout = root.transform.Find("MenuLayout");
                var view = root.GetComponent<CoopHomeView>();
                var display = root.GetComponentsInChildren<Text>(true).First(t => t.name == "StageLabel").font;
                var flightLayer = layout.Find("RewardFlightLayer");
                if (layout == null || view == null || flightLayer == null) throw new InvalidOperationException("Run CoopHomeBuilder first.");
                var existing = layout.Find(Name);
                if (existing != null) UnityEngine.Object.DestroyImmediate(existing.gameObject);

                // Full-screen group under the reward flight layer so spent eggs can fly over it.
                var panel = Rect(layout, Name, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                panel.SetSiblingIndex(flightLayer.GetSiblingIndex());
                var shade = panel.gameObject.AddComponent<Image>();
                shade.color = new Color(ui.shade.r, ui.shade.g, ui.shade.b, ui.shadeOpacity);
                var shadeButton = panel.gameObject.AddComponent<Button>();
                shadeButton.transition = Selectable.Transition.None;
                shadeButton.targetGraphic = shade;

                var bodyRect = Rect(panel, "Body", new Vector2(.5f, .5f), new Vector2(.5f, .5f), new Vector2(0, -10), new Vector2(320, 330));
                bodyRect.gameObject.AddComponent<CanvasGroup>();
                var blocker = bodyRect.gameObject.AddComponent<Image>();
                blocker.color = Color.clear; // swallows taps so only the shade closes the panel
                var bodyRim = Sliced(Rect(bodyRect, "Rim", Vector2.zero, Vector2.one, new Vector2(0, -3), new Vector2(0, 6)), rounded, ui.panelDeep);
                var bodyFill = Sliced(Rect(bodyRect, "Fill", Vector2.zero, Vector2.one, Vector2.zero, new Vector2(-8, -8)), rounded, ui.panel);

                var ribbon = Rect(bodyRect, "Ribbon", new Vector2(.5f, 1), new Vector2(.5f, 1), new Vector2(0, 0), new Vector2(250, 54));
                var ribbonRim = Sliced(Rect(ribbon, "Rim", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero), rounded, ui.goldDeep);
                var ribbonFill = Sliced(Rect(ribbon, "Fill", Vector2.zero, Vector2.one, new Vector2(0, 2), new Vector2(-8, -10)), rounded, ui.gold);
                var title = Label(ribbon, "Title", display, 26, "Kümes Seviye 1", out var titleOutline, ui.goldDeep);

                var close = Rect(bodyRect, "CloseButton", new Vector2(1, 1), new Vector2(1, 1), new Vector2(-4, -4), new Vector2(44, 44));
                var closeHit = close.gameObject.AddComponent<Image>();
                closeHit.color = Color.clear;
                var closeButton = close.gameObject.AddComponent<Button>();
                closeButton.transition = Selectable.Transition.None;
                closeButton.targetGraphic = closeHit;
                var closeRim = Sliced(Rect(close, "Rim", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero), rounded, ui.heartDeep);
                var closeFill = Sliced(Rect(close, "Fill", Vector2.zero, Vector2.one, new Vector2(0, 2), new Vector2(-6, -8)), rounded, ui.heart);
                var closeLabel = Label(close, "X", display, 24, "X", out var closeOutline, ui.heartDeep);

                var card = Rect(bodyRect, "Card", new Vector2(.5f, 1), new Vector2(.5f, 1), new Vector2(0, -92), new Vector2(276, 92));
                var cardFill = Sliced(card, rounded, ui.cream);
                var cardText = Label(card, "Text", body, 17, "Kümes büyür ve 1 yeni tavuk gelir.", out var cardOutline, ui.ink);
                UnityEngine.Object.DestroyImmediate(cardOutline); // body text is never outlined
                cardText.horizontalOverflow = HorizontalWrapMode.Wrap;
                cardText.rectTransform.sizeDelta = new Vector2(-28, -16);

                var cost = Rect(bodyRect, "Cost", new Vector2(.5f, 1), new Vector2(.5f, 1), new Vector2(0, -176), new Vector2(150, 50));
                var costFill = Sliced(cost, rounded, ui.panelInset);
                var costEgg = Rect(cost, "Egg", new Vector2(0, .5f), new Vector2(0, .5f), new Vector2(34, 0), new Vector2(38, 38));
                var eggImage = costEgg.gameObject.AddComponent<Image>();
                eggImage.sprite = egg; eggImage.preserveAspect = true; eggImage.raycastTarget = false;
                var costText = Label(cost, "Amount", display, 28, "6", out var costOutline, ui.panelDeep);
                costText.rectTransform.offsetMin = new Vector2(48, 0);

                var upgrade = Rect(bodyRect, "UpgradeButton", new Vector2(.5f, 0), new Vector2(.5f, 0), new Vector2(0, 68), new Vector2(220, 64));
                var upgradeHit = upgrade.gameObject.AddComponent<Image>();
                upgradeHit.color = Color.clear;
                var upgradeButton = upgrade.gameObject.AddComponent<Button>();
                upgradeButton.transition = Selectable.Transition.None;
                upgradeButton.targetGraphic = upgradeHit;
                var visual = Rect(upgrade, "Visual", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                var buttonRim = Sliced(Rect(visual, "Rim", Vector2.zero, Vector2.one, new Vector2(0, -3), new Vector2(0, 6)), rounded, ui.ctaDeep);
                var buttonFill = Sliced(Rect(visual, "Fill", Vector2.zero, Vector2.one, new Vector2(0, 1), new Vector2(-8, -10)), rounded, ui.cta);
                var buttonLabel = Label(visual, "Label", display, 30, "Yükselt", out var buttonOutline, ui.ctaDeep);

                var hint = Label(bodyRect, "Hint", body, 15, "3 yumurta daha", out var hintOutline, ui.panelDeep);
                UnityEngine.Object.DestroyImmediate(hintOutline);
                hint.rectTransform.anchorMin = new Vector2(.5f, 0);
                hint.rectTransform.anchorMax = new Vector2(.5f, 0);
                hint.rectTransform.anchoredPosition = new Vector2(0, 20);
                hint.rectTransform.sizeDelta = new Vector2(260, 24);
                panel.gameObject.SetActive(false);

                var component = panel.gameObject.AddComponent<CoopUpgradePanel>();
                var data = new SerializedObject(component);
                Set(data, "ui", ui); Set(data, "motion", motion);
                Set(data, "shade", shade); Set(data, "shadeButton", shadeButton); Set(data, "closeButton", closeButton);
                Set(data, "upgradeButton", upgradeButton); Set(data, "body", bodyRect); Set(data, "upgradeVisual", visual);
                Set(data, "bodyRim", bodyRim); Set(data, "bodyFill", bodyFill); Set(data, "ribbonRim", ribbonRim);
                Set(data, "ribbonFill", ribbonFill); Set(data, "cardFill", cardFill); Set(data, "costFill", costFill);
                Set(data, "closeRim", closeRim); Set(data, "closeFill", closeFill);
                Set(data, "buttonRim", buttonRim); Set(data, "buttonFill", buttonFill);
                Set(data, "title", title); Set(data, "cardText", cardText); Set(data, "costText", costText);
                Set(data, "buttonLabel", buttonLabel); Set(data, "hintText", hint); Set(data, "closeLabel", closeLabel);
                Set(data, "titleOutline", titleOutline); Set(data, "buttonLabelOutline", buttonOutline);
                Set(data, "closeOutline", closeOutline); Set(data, "costOutline", costOutline);
                data.ApplyModifiedPropertiesWithoutUndo();

                var viewData = new SerializedObject(view);
                Set(viewData, "panel", component);
                viewData.ApplyModifiedPropertiesWithoutUndo();
                PrefabUtility.SaveAsPrefabAsset(root, Prefab);
            }
            finally { PrefabUtility.UnloadPrefabContents(root); }
        }

        private static T Load<T>(string path) where T : UnityEngine.Object
        {
            var asset = AssetDatabase.LoadAssetAtPath<T>(path);
            if (asset == null) throw new InvalidOperationException("Missing " + path);
            return asset;
        }

        private static void Set(SerializedObject data, string field, UnityEngine.Object value)
        {
            var property = data.FindProperty(field);
            if (property == null) throw new InvalidOperationException("Missing field " + field);
            property.objectReferenceValue = value;
        }

        private static RectTransform Rect(Transform parent, string name, Vector2 min, Vector2 max, Vector2 position, Vector2 size)
        {
            var rect = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rect.gameObject.layer = parent.gameObject.layer;
            rect.SetParent(parent, false);
            rect.anchorMin = min; rect.anchorMax = max;
            rect.anchoredPosition = position; rect.sizeDelta = size;
            return rect;
        }

        private static Image Sliced(RectTransform rect, Sprite sprite, Color color)
        {
            var image = rect.gameObject.AddComponent<Image>();
            image.sprite = sprite; image.type = Image.Type.Sliced; image.pixelsPerUnitMultiplier = 2;
            image.color = color; image.raycastTarget = false;
            return image;
        }

        private static Text Label(Transform parent, string name, Font font, int size, string text, out Outline outline, Color stroke)
        {
            var rect = Rect(parent, name, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var label = rect.gameObject.AddComponent<Text>();
            label.font = font; label.fontSize = size; label.text = text;
            label.alignment = TextAnchor.MiddleCenter;
            label.horizontalOverflow = HorizontalWrapMode.Overflow;
            label.verticalOverflow = VerticalWrapMode.Overflow;
            label.raycastTarget = false;
            label.color = Color.white;
            outline = rect.gameObject.AddComponent<Outline>();
            outline.effectColor = stroke;
            outline.effectDistance = new Vector2(2, -2);
            return label;
        }
    }
}
