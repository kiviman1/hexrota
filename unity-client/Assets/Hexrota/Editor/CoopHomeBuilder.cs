using System;
using System.Linq;
using Hexrota.UnityClient.Presentation;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Editor
{
    // Adds the editable coop controls (button, progress bar, tap area) to the home prefab.
    // Layout follows docs/design/wireframe/Main.html (390 x 844 reference). Colors and timings are
    // applied at runtime from UiTheme/MotionTheme; the values set here only make the prefab readable.
    // Re-running replaces only the objects this builder owns.
    public static class CoopHomeBuilder
    {
        private const string Prefab = "Assets/Hexrota/Resources/CastleHome/CastleHome.prefab";
        private const string Theme = "Assets/Hexrota/Presentation/Theme/";
        private const string EggSprite = "Assets/Hexrota/Art/CastleHome/GoldenEgg.png";
        private static readonly string[] Owned = { "CoopTapArea", "CoopProgress", "CoopButton" };

        [MenuItem("Hexrota/Home/Rebuild Coop Controls")]
        public static void Rebuild()
        {
            var ui = Load<UiTheme>(Theme + "UiTheme.asset");
            var motion = Load<MotionTheme>(Theme + "MotionTheme.asset");
            var rounded = Load<Sprite>(Theme + "HomeRounded.png");
            var hex = Load<Sprite>(Theme + "HomeHex.png");
            var egg = Load<Sprite>(EggSprite);
            var root = PrefabUtility.LoadPrefabContents(Prefab);
            try
            {
                var layout = root.transform.Find("MenuLayout");
                var environment = layout != null ? layout.Find("Environment") : null;
                var coop = environment != null ? environment.Find("Coop") as RectTransform : null;
                var playArea = layout != null ? layout.Find("PlayArea") as RectTransform : null;
                var home = root.GetComponent<CastleHomeView>();
                var attention = root.GetComponentInChildren<AttentionDirector>(true);
                var flight = root.GetComponentInChildren<RewardFlight>(true);
                var font = root.GetComponentsInChildren<Text>(true).First(t => t.name == "StageLabel").font;
                if (coop == null || playArea == null || home == null || attention == null || flight == null)
                    throw new InvalidOperationException("Home prefab hierarchy changed.");
                foreach (var name in Owned)
                {
                    var existing = layout.Find(name);
                    if (existing != null) UnityEngine.Object.DestroyImmediate(existing.gameObject);
                }

                // Transparent hit area over the coop. It sits right above the environment, so every
                // other control keeps priority, and the environment layers stay non-interactive.
                var tap = NewRect(layout, "CoopTapArea", new Vector2(.2f, .32f), new Vector2(.8f, .74f), Vector2.zero, Vector2.zero);
                tap.SetSiblingIndex(environment.GetSiblingIndex() + 1);
                var tapImage = tap.gameObject.AddComponent<Image>();
                tapImage.color = Color.clear;
                var tapButton = tap.gameObject.AddComponent<Button>();
                tapButton.transition = Selectable.Transition.None;
                tapButton.targetGraphic = tapImage;

                // Progress bar: 72px above the play button centre, 200 x 24.
                float playY = playArea.anchorMin.y;
                var bar = NewRect(layout, "CoopProgress", new Vector2(.5f, playY), new Vector2(.5f, playY), new Vector2(0, 72), new Vector2(200, 24));
                bar.SetSiblingIndex(playArea.GetSiblingIndex());
                var track = Sliced(NewRect(bar, "Track", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero), rounded, ui.panelDeep);
                var fill = NewRect(bar, "Fill", Vector2.zero, new Vector2(0, 1), Vector2.zero, Vector2.zero);
                fill.pivot = new Vector2(0, .5f);
                var fillImage = Sliced(fill, rounded, ui.cta);
                var barLabel = Label(bar, "Label", font, 15, "0 / 0", ui, out var barOutline);
                var eggIcon = NewRect(bar, "Egg", new Vector2(0, .5f), new Vector2(0, .5f), new Vector2(-2, 2), new Vector2(34, 34));
                Simple(eggIcon, egg, Color.white);

                // Coop button: hexagon to the left of Play, on the same row.
                var button = NewRect(layout, "CoopButton", new Vector2(0, playY), new Vector2(0, playY), new Vector2(46, 0), new Vector2(64, 70));
                button.SetSiblingIndex(playArea.GetSiblingIndex() + 1);
                var buttonImage = button.gameObject.AddComponent<Image>();
                buttonImage.sprite = hex;
                buttonImage.color = Color.clear;
                var coopButton = button.gameObject.AddComponent<Button>();
                coopButton.transition = Selectable.Transition.None;
                coopButton.targetGraphic = buttonImage;
                var visual = NewRect(button, "Visual", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                var ring = Simple(NewRect(visual, "PulseRing", Vector2.zero, Vector2.one, Vector2.zero, new Vector2(16, 18)), hex, ui.gold);
                ring.enabled = false;
                var rim = Simple(NewRect(visual, "Rim", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero), hex, ui.skyDeep);
                var face = Simple(NewRect(visual, "Face", Vector2.zero, Vector2.one, new Vector2(0, 2), new Vector2(-8, -10)), hex, ui.sky);
                var buttonLabel = Label(visual, "Label", font, 15, "Kümes", ui, out var buttonOutline);
                var badge = NewRect(visual, "ReadyBadge", new Vector2(1, 1), new Vector2(1, 1), new Vector2(-6, -6), new Vector2(26, 28));
                var badgeRim = Simple(NewRect(badge, "Rim", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero), hex, ui.heartDeep);
                var badgeFace = Simple(NewRect(badge, "Face", Vector2.zero, Vector2.one, Vector2.zero, new Vector2(-6, -6)), hex, ui.heart);
                Label(badge, "Mark", font, 16, "!", ui, out var badgeOutline);
                badgeOutline.effectColor = ui.heartDeep;
                badge.gameObject.SetActive(false);

                var view = root.GetComponent<CoopHomeView>();
                if (view == null) view = root.AddComponent<CoopHomeView>();
                var data = new SerializedObject(view);
                Set(data, "ui", ui); Set(data, "motion", motion); Set(data, "attention", attention); Set(data, "rewardFlight", flight);
                Set(data, "coop", coop); Set(data, "coopButton", coopButton); Set(data, "coopTapArea", tapButton);
                Set(data, "buttonVisual", visual); Set(data, "buttonRim", rim); Set(data, "buttonFace", face); Set(data, "pulseRing", ring);
                Set(data, "buttonLabel", buttonLabel); Set(data, "buttonLabelOutline", buttonOutline);
                Set(data, "readyBadge", badge.gameObject); Set(data, "readyBadgeRim", badgeRim); Set(data, "readyBadgeFace", badgeFace);
                Set(data, "barFill", fill); Set(data, "barTrack", track); Set(data, "barFillImage", fillImage);
                Set(data, "barLabel", barLabel); Set(data, "barLabelOutline", barOutline);
                data.ApplyModifiedPropertiesWithoutUndo();
                var homeData = new SerializedObject(home);
                Set(homeData, "coopView", view);
                homeData.ApplyModifiedPropertiesWithoutUndo();

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

        private static RectTransform NewRect(Transform parent, string name, Vector2 min, Vector2 max, Vector2 position, Vector2 size)
        {
            var rect = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rect.gameObject.layer = parent.gameObject.layer;
            rect.SetParent(parent, false);
            rect.anchorMin = min;
            rect.anchorMax = max;
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            return rect;
        }

        private static Image Simple(RectTransform rect, Sprite sprite, Color color)
        {
            var image = rect.gameObject.AddComponent<Image>();
            image.sprite = sprite;
            image.color = color;
            image.preserveAspect = true;
            image.raycastTarget = false;
            return image;
        }

        private static Image Sliced(RectTransform rect, Sprite sprite, Color color)
        {
            var image = Simple(rect, sprite, color);
            image.preserveAspect = false;
            image.type = Image.Type.Sliced;
            image.pixelsPerUnitMultiplier = 4;
            return image;
        }

        private static Text Label(Transform parent, string name, Font font, int size, string text, UiTheme ui, out Outline outline)
        {
            var rect = NewRect(parent, name, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var label = rect.gameObject.AddComponent<Text>();
            label.font = font;
            label.fontSize = size;
            label.alignment = TextAnchor.MiddleCenter;
            label.horizontalOverflow = HorizontalWrapMode.Overflow;
            label.verticalOverflow = VerticalWrapMode.Overflow;
            label.raycastTarget = false;
            label.color = ui.label;
            label.text = text;
            outline = rect.gameObject.AddComponent<Outline>();
            outline.effectColor = ui.ctaDeep;
            outline.effectDistance = new Vector2(1.5f, -1.5f);
            return label;
        }
    }
}
