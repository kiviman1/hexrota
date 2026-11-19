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
        public const string EmptyPlot = "EmptyPlot";
        public const string TapArea = "CoopTapArea";
        private const string StakeSprite = "Assets/Hexrota/Art/CastleHome/FenceStake.png";
        private const string DisplayFont = "Assets/Hexrota/Art/CastleHomeType/LilitaOne-Regular.ttf";
        // Fence stakes on the empty plot: anchor in the plot (x, y = base) and height in points.
        private static readonly Vector3[] Stakes =
        {
            new Vector3(.3f, .62f, 40), new Vector3(.7f, .62f, 40), new Vector3(.24f, .22f, 52), new Vector3(.76f, .22f, 52),
        };
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
            var stakeSprite = Load<Sprite>(StakeSprite);
            var display = Load<Font>(DisplayFont);
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
                foreach (var name in new[] { PlotCoop, EmptyPlot, TapArea })
                {
                    var old = plot.Find(name);
                    if (old != null) UnityEngine.Object.DestroyImmediate(old.gameObject);
                }

                // Placeholder coop standing on the plot (until the 3D coop). It is part of the background,
                // so every UI control keeps tap priority. The level scale grows it from its base.
                var coop = NewRect(plot, PlotCoop, new Vector2(.295f, .237f), new Vector2(.705f, 1.126f), Vector2.zero, Vector2.zero);
                coop.pivot = new Vector2(.5f, 0);
                coop.SetAsLastSibling();
                var visual = NewRect(coop, "CoopVisual", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                visual.pivot = new Vector2(.5f, 0);
                var drawing = NewRect(visual, CoopDrawing, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                Simple(drawing, coopSprite, Color.white);
                drawing.gameObject.SetActive(false); // level 0: the plot is empty until the first upgrade

                // Level 0: a few fence stakes mark where the coop will be built.
                var empty = NewRect(plot, EmptyPlot, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                empty.SetSiblingIndex(coop.GetSiblingIndex());
                foreach (var stake in Stakes)
                {
                    var post = NewRect(empty, "Stake", new Vector2(stake.x, stake.y), new Vector2(stake.x, stake.y), Vector2.zero, new Vector2(stake.z * .3f, stake.z));
                    post.pivot = new Vector2(.5f, 0);
                    Simple(post, stakeSprite, Color.white);
                }

                // Tapping the plot (empty or built) opens the panel. Transparent, above the coop and residents.
                var tap = NewRect(plot, TapArea, Vector2.zero, new Vector2(1, 1.13f), Vector2.zero, Vector2.zero);
                var tapImage = tap.gameObject.AddComponent<Image>();
                tapImage.color = Color.clear;
                var tapButton = tap.gameObject.AddComponent<Button>();
                tapButton.transition = Selectable.Transition.None;
                tapButton.targetGraphic = tapImage;
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
                var eggIcon = NewRect(bar, "Egg", new Vector2(0, .5f), new Vector2(0, .5f), new Vector2(-2, 2), new Vector2(34, 34));
                var eggImage = Simple(eggIcon, egg, Color.white);
                // "have/cost" in Lilita One, white with the fill's deep outline (set from UiTheme at runtime).
                var barLabel = Label(bar, "Label", display, 17, "0/1", ui, out var barOutline);
                barOutline.effectColor = ui.ctaDeep;
                barOutline.effectDistance = new Vector2(2, -2);

                var view = root.GetComponent<CoopHomeView>();
                if (view == null) view = root.AddComponent<CoopHomeView>();
                var data = new SerializedObject(view);
                Set(data, "ui", ui); Set(data, "motion", motion); Set(data, "attention", attention); Set(data, "rewardFlight", flight);
                Set(data, "coop", coop); Set(data, "coopVisual", visual); Set(data, "coopTapArea", tapButton);
                Set(data, "coopDrawing", drawing.gameObject); Set(data, "emptyPlot", empty); Set(data, "barEgg", eggImage);
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
