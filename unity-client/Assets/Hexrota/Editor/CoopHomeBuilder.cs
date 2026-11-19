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
        public const string CoopSprite = "CoopSprite";
        public const string TapArea = "CoopTapArea";
        // Retired placeholders (the old 2D coop drawing and the level-0 fence stakes): kept, hidden.
        public const string RetiredDrawing = "CoopDrawing", RetiredStakes = "EmptyPlot";
        private const string DisplayFont = "Assets/Hexrota/Art/CastleHomeType/LilitaOne-Regular.ttf";
        // Where the coop's ground point (bottom-centre of its base disk) sits on the plot.
        private static readonly Vector2 Ground = new Vector2(.5f, .12f);
        private const int DustPuffs = 20;

        [MenuItem("Hexrota/Home/Rebuild Coop Controls")]
        public static void Rebuild()
        {
            var ui = Load<UiTheme>(Theme + "UiTheme.asset");
            var motion = Load<MotionTheme>(Theme + "MotionTheme.asset");
            var rounded = Load<Sprite>(Theme + "HomeRounded.png");
            var hex = Load<Sprite>(Theme + "HomeHex.png");
            var egg = Load<Sprite>(EggSprite);
            var display = Load<Font>(DisplayFont);
            var sprites = CoopSpriteAssets.Prepare();
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
                // The old placeholders leave the scene but stay in the prefab, hidden.
                RetirePlaceholders(plot);
                foreach (var name in new[] { PlotCoop, TapArea })
                {
                    var old = plot.Find(name);
                    if (old != null) UnityEngine.Object.DestroyImmediate(old.gameObject);
                }

                // The coop sprite (Coop_L0 foundation .. Coop_L4) stands on the plot: this rect's pivot is
                // the ground point. It is part of the background, so every UI control keeps tap priority.
                // Eggs fly to it and the upgrade squash scales it from the ground.
                var coop = NewRect(plot, PlotCoop, new Vector2(.1f, Ground.y), new Vector2(.9f, 1.5f), Vector2.zero, Vector2.zero);
                coop.pivot = new Vector2(.5f, 0);
                coop.SetAsLastSibling();
                var visual = NewRect(coop, "CoopVisual", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                visual.pivot = new Vector2(.5f, 0);
                var shadowImage = Simple(NewRect(visual, "Shadow", Vector2.zero, Vector2.zero, Vector2.zero, Vector2.zero), sprites.Shadow, ui.contactShadow);
                shadowImage.preserveAspect = false;
                var previous = Simple(NewRect(visual, "PreviousSprite", Vector2.zero, Vector2.zero, Vector2.zero, Vector2.zero), sprites.Levels[0], Color.white);
                previous.preserveAspect = false;
                previous.gameObject.SetActive(false);
                var current = Simple(NewRect(visual, CoopSprite, Vector2.zero, Vector2.zero, Vector2.zero, Vector2.zero), sprites.Levels[0], Color.white);
                current.preserveAspect = false;
                var spriteView = visual.gameObject.AddComponent<CoopSpriteView>();
                var spriteData = new SerializedObject(spriteView);
                Set(spriteData, "ui", ui);
                var levels = spriteData.FindProperty("levels");
                var disks = spriteData.FindProperty("diskPixels");
                levels.arraySize = disks.arraySize = sprites.Levels.Length;
                for (int i = 0; i < sprites.Levels.Length; i++)
                {
                    levels.GetArrayElementAtIndex(i).objectReferenceValue = sprites.Levels[i];
                    disks.GetArrayElementAtIndex(i).floatValue = sprites.DiskPixels[i];
                }
                Set(spriteData, "plot", plot);
                Set(spriteData, "image", current);
                Set(spriteData, "previous", previous);
                Set(spriteData, "shadow", shadowImage);
                spriteData.ApplyModifiedPropertiesWithoutUndo();

                // Dust for the upgrade transition: a pool of soft puffs over the building.
                var dustRect = NewRect(visual, "Dust", new Vector2(.5f, 0), new Vector2(.5f, 0), Vector2.zero, new Vector2(200, 200));
                var dust = dustRect.gameObject.AddComponent<CoopDustBurst>();
                var dustData = new SerializedObject(dust);
                Set(dustData, "ui", ui); Set(dustData, "motion", motion);
                var pool = dustData.FindProperty("puffs");
                pool.arraySize = DustPuffs;
                for (int i = 0; i < DustPuffs; i++)
                {
                    var puff = Simple(NewRect(dustRect, "Puff" + (i + 1), new Vector2(.5f, .5f), new Vector2(.5f, .5f), Vector2.zero, new Vector2(80, 80)),
                        sprites.Dust[i % sprites.Dust.Length], ui.cream);
                    puff.gameObject.SetActive(false);
                    pool.GetArrayElementAtIndex(i).objectReferenceValue = puff;
                }
                var shapes = dustData.FindProperty("shapes");
                shapes.arraySize = sprites.Dust.Length;
                for (int i = 0; i < sprites.Dust.Length; i++) shapes.GetArrayElementAtIndex(i).objectReferenceValue = sprites.Dust[i];
                dustData.ApplyModifiedPropertiesWithoutUndo();

                // Tapping the plot or the coop (the foundation at level 0) opens the panel.
                var tap = NewRect(plot, TapArea, Vector2.zero, new Vector2(1, 1.5f), Vector2.zero, Vector2.zero);
                var tapImage = tap.gameObject.AddComponent<Image>();
                tapImage.color = Color.clear;
                var tapButton = tap.gameObject.AddComponent<Button>();
                tapButton.transition = Selectable.Transition.None;
                tapButton.targetGraphic = tapImage;
                var badge = NewRect(visual, "ReadyBadge", new Vector2(.5f, 0), new Vector2(.5f, 0), Vector2.zero, new Vector2(30, 32));
                var badgeRim = Simple(NewRect(badge, "Rim", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero), hex, ui.heartDeep);
                var badgeFace = Simple(NewRect(badge, "Face", Vector2.zero, Vector2.one, Vector2.zero, new Vector2(-6, -6)), hex, ui.heart);
                Label(badge, "Mark", font, 18, "!", ui, out var badgeOutline);
                badgeOutline.effectColor = ui.heartDeep;
                badge.gameObject.SetActive(false);
                var badgeData = new SerializedObject(spriteView);
                Set(badgeData, "badge", badge);
                badgeData.ApplyModifiedPropertiesWithoutUndo();

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
                Set(data, "sprite", spriteView); Set(data, "barEgg", eggImage);
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

        // The old 2D coop drawing (inside the previous PlotCoop) and the level-0 stakes are no longer used.
        // They are moved under one hidden holder instead of being deleted.
        private static void RetirePlaceholders(Transform plot)
        {
            var holder = plot.Find("RetiredPlaceholders");
            if (holder == null)
            {
                holder = NewRect(plot, "RetiredPlaceholders", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                holder.SetAsFirstSibling();
            }
            holder.gameObject.SetActive(false);
            var oldCoop = plot.Find(PlotCoop);
            var drawing = oldCoop != null ? oldCoop.Find("CoopVisual/" + RetiredDrawing) : null;
            if (drawing != null) drawing.SetParent(holder, true);
            var stakes = plot.Find(RetiredStakes);
            if (stakes != null) stakes.SetParent(holder, true);
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
