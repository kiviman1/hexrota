using System;
using System.Linq;
using Hexrota.UnityClient.Presentation;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Editor
{
    // Adds the editable coop controls to the home prefab: the placeholder coop on the background plot
    // (tap to open the upgrade panel, with the ready badge) and the progress bar. Run after
    // Rebuild Background Layers.
    // Layout follows docs/design/wireframe/Main.html (390 x 844 reference). Colors and timings are
    // applied at runtime from UiTheme/MotionTheme; the values set here only make the prefab readable.
    // Re-running replaces only the objects this builder owns.
    public static class CoopHomeBuilder
    {
        private const string Prefab = "Assets/Hexrota/Resources/CastleHome/CastleHome.prefab";
        private const string Theme = "Assets/Hexrota/Presentation/Theme/";
        private const string EggSprite = "Assets/Hexrota/Art/CastleHome/GoldenEgg.png";
        private static readonly string[] Owned = { "CoopTapArea", "CoopProgress", "CoopButton" };
        public const string PlotCoop = "PlotCoop";
        public const string CoopDrawing = "CoopDrawing";
        private const string CoopSprite = "Assets/Hexrota/Art/CastleHome/Coop.png";

        [MenuItem("Hexrota/Home/Rebuild Coop Controls")]
        public static void Rebuild()
        {
            var ui = Load<UiTheme>(Theme + "UiTheme.asset");
            var motion = Load<MotionTheme>(Theme + "MotionTheme.asset");
            var rounded = Load<Sprite>(Theme + "HomeRounded.png");
            var hex = Load<Sprite>(Theme + "HomeHex.png");
            var egg = Load<Sprite>(EggSprite);
            var coopSprite = Load<Sprite>(CoopSprite);
            var root = PrefabUtility.LoadPrefabContents(Prefab);
            try
            {
                var layout = root.transform.Find("MenuLayout");
                var playArea = layout != null ? layout.Find("PlayArea") as RectTransform : null;
                var home = root.GetComponent<CastleHomeView>();
                var attention = root.GetComponentInChildren<AttentionDirector>(true);
                var flight = root.GetComponentInChildren<RewardFlight>(true);
                var layers = root.GetComponentInChildren<HomeBackgroundLayers>(true);
                var plot = layers != null ? layers.CoopPlot : null;
                var font = root.GetComponentsInChildren<Text>(true).First(t => t.name == "StageLabel").font;
                if (playArea == null || home == null || attention == null || flight == null || plot == null)
                    throw new InvalidOperationException("Home prefab hierarchy changed (run Rebuild Background Layers first).");
                foreach (var name in Owned)
                {
                    var existing = layout.Find(name);
                    if (existing != null) UnityEngine.Object.DestroyImmediate(existing.gameObject);
                }
                var oldCoop = plot.Find(PlotCoop);
                if (oldCoop != null) UnityEngine.Object.DestroyImmediate(oldCoop.gameObject);

                // Placeholder coop standing on the plot (until the 3D coop). It is part of the background,
                // so every UI control keeps tap priority. The level scale grows it from its base.
                var coop = NewRect(plot, PlotCoop, new Vector2(.295f, .237f), new Vector2(.705f, 1.126f), Vector2.zero, Vector2.zero);
                coop.pivot = new Vector2(.5f, 0);
                coop.SetAsLastSibling();
                var visual = NewRect(coop, CoopDrawing, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                visual.pivot = new Vector2(.5f, 0);
                var drawing = Simple(visual, coopSprite, Color.white);
                drawing.raycastTarget = true;
                var tapButton = visual.gameObject.AddComponent<Button>();
                tapButton.transition = Selectable.Transition.None;
                tapButton.targetGraphic = drawing;
                var badge = NewRect(visual, "ReadyBadge", new Vector2(.84f, .74f), new Vector2(.84f, .74f), Vector2.zero, new Vector2(30, 32));
                var badgeRim = Simple(NewRect(badge, "Rim", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero), hex, ui.heartDeep);
                var badgeFace = Simple(NewRect(badge, "Face", Vector2.zero, Vector2.one, Vector2.zero, new Vector2(-6, -6)), hex, ui.heart);
                Label(badge, "Mark", font, 18, "!", ui, out var badgeOutline);
                badgeOutline.effectColor = ui.heartDeep;
                badge.gameObject.SetActive(false);

                // Progress bar: in the empty meadow right of the stone path, between the plot and Play.
                float playY = playArea.anchorMin.y;
                var bar = NewRect(layout, "CoopProgress", new Vector2(.5f, playY), new Vector2(.5f, playY), new Vector2(67, 64), new Vector2(200, 24));
                bar.SetSiblingIndex(playArea.GetSiblingIndex());
                var track = Sliced(NewRect(bar, "Track", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero), rounded, ui.panelDeep);
                var fill = NewRect(bar, "Fill", Vector2.zero, new Vector2(0, 1), Vector2.zero, Vector2.zero);
                fill.pivot = new Vector2(0, .5f);
                var fillImage = Sliced(fill, rounded, ui.cta);
                var barLabel = Label(bar, "Label", font, 15, "0 / 0", ui, out var barOutline);
                var eggIcon = NewRect(bar, "Egg", new Vector2(0, .5f), new Vector2(0, .5f), new Vector2(-2, 2), new Vector2(34, 34));
                Simple(eggIcon, egg, Color.white);

                var view = root.GetComponent<CoopHomeView>();
                if (view == null) view = root.AddComponent<CoopHomeView>();
                var data = new SerializedObject(view);
                Set(data, "ui", ui); Set(data, "motion", motion); Set(data, "attention", attention); Set(data, "rewardFlight", flight);
                Set(data, "coop", coop); Set(data, "coopVisual", visual); Set(data, "coopTapArea", tapButton);
                Set(data, "readyBadge", badge.gameObject); Set(data, "readyBadgeRim", badgeRim); Set(data, "readyBadgeFace", badgeFace);
                Set(data, "bar", bar); Set(data, "barFill", fill); Set(data, "barTrack", track); Set(data, "barFillImage", fillImage);
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
