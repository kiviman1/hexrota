using System;
using System.Linq;
using Hexrota.UnityClient.Presentation;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Editor
{
    // Adds the coop upgrade sequence pieces to the home prefab: placeholder residents beside the
    // coop, the burst, the "Seviye N!" banner and a full-screen input lock. Run after the coop
    // controls and the upgrade panel builders.
    public static class CoopSequenceBuilder
    {
        private const string Prefab = "Assets/Hexrota/Resources/CastleHome/CastleHome.prefab";
        private const string Theme = "Assets/Hexrota/Presentation/Theme/";
        private const string Resident = "Assets/Hexrota/Resources/CastleHome/Characters/Hen.png";
        private static readonly string[] Owned = { "CoopResidents", "CoopBurst", "CoopLevelBanner", "CoopInputLock" };
        // Up to eight residents (the area maximum), alternating around the coop door.
        private static readonly Vector2[] Spots =
        {
            new Vector2(-72, 0), new Vector2(72, 0), new Vector2(-112, -12), new Vector2(112, -12),
            new Vector2(-36, -22), new Vector2(36, -22), new Vector2(-148, 6), new Vector2(148, 6)
        };

        [MenuItem("Hexrota/Home/Rebuild Coop Upgrade Sequence")]
        public static void Rebuild()
        {
            var ui = Load<UiTheme>(Theme + "UiTheme.asset");
            var motion = Load<MotionTheme>(Theme + "MotionTheme.asset");
            var burstSprite = Load<Sprite>(Theme + "RewardBurst.png");
            var hen = Load<Sprite>(Resident);
            var root = PrefabUtility.LoadPrefabContents(Prefab);
            try
            {
                var layout = root.transform.Find("MenuLayout");
                var home = root.GetComponent<CastleHomeView>();
                var view = root.GetComponent<CoopHomeView>();
                var panel = root.GetComponentInChildren<CoopUpgradePanel>(true);
                var attention = root.GetComponentInChildren<AttentionDirector>(true);
                var flight = root.GetComponentInChildren<RewardFlight>(true);
                var tap = layout != null ? layout.Find("CoopTapArea") : null;
                var font = root.GetComponentsInChildren<Text>(true).First(t => t.name == "StageLabel").font;
                if (tap == null || view == null || panel == null || home == null) throw new InvalidOperationException("Run the coop control and panel builders first.");
                foreach (var name in Owned)
                {
                    var existing = layout.Find(name);
                    if (existing != null) UnityEngine.Object.DestroyImmediate(existing.gameObject);
                }

                var residents = Rect(layout, "CoopResidents", new Vector2(.5f, .33f), new Vector2(.5f, .33f), Vector2.zero, Vector2.zero);
                residents.SetSiblingIndex(tap.GetSiblingIndex() + 1);
                var spots = new RectTransform[Spots.Length];
                for (int i = 0; i < Spots.Length; i++)
                {
                    spots[i] = Rect(residents, "Resident" + (i + 1), new Vector2(.5f, .5f), new Vector2(.5f, .5f), Spots[i], new Vector2(38, 44));
                    spots[i].pivot = new Vector2(.5f, 0);
                    var image = spots[i].gameObject.AddComponent<Image>();
                    image.sprite = hen; image.preserveAspect = true; image.raycastTarget = false;
                    spots[i].gameObject.SetActive(false);
                }

                var burstRect = Rect(layout, "CoopBurst", new Vector2(.5f, .5f), new Vector2(.5f, .5f), Vector2.zero, new Vector2(150, 150));
                burstRect.SetSiblingIndex(residents.GetSiblingIndex() + 1);
                var burst = burstRect.gameObject.AddComponent<Image>();
                burst.sprite = burstSprite; burst.color = ui.goldLight; burst.raycastTarget = false; burst.preserveAspect = true;
                burstRect.gameObject.SetActive(false);

                var bannerRect = Rect(layout, "CoopLevelBanner", new Vector2(.5f, .62f), new Vector2(.5f, .62f), Vector2.zero, new Vector2(300, 64));
                bannerRect.SetSiblingIndex(burstRect.GetSiblingIndex() + 1);
                var banner = bannerRect.gameObject.AddComponent<Text>();
                banner.font = font; banner.fontSize = 46; banner.alignment = TextAnchor.MiddleCenter;
                banner.horizontalOverflow = HorizontalWrapMode.Overflow; banner.verticalOverflow = VerticalWrapMode.Overflow;
                banner.raycastTarget = false; banner.color = ui.label; banner.text = "Seviye 1!";
                var outline = bannerRect.gameObject.AddComponent<Outline>();
                outline.effectColor = ui.goldDeep; outline.effectDistance = new Vector2(3, -3);
                bannerRect.gameObject.SetActive(false);

                var lockRect = Rect(layout, "CoopInputLock", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                lockRect.SetAsLastSibling();
                var blocker = lockRect.gameObject.AddComponent<Image>();
                blocker.color = Color.clear;
                lockRect.gameObject.SetActive(false);

                var sequence = root.GetComponent<CoopUpgradeSequence>();
                if (sequence == null) sequence = root.AddComponent<CoopUpgradeSequence>();
                var data = new SerializedObject(sequence);
                Set(data, "ui", ui); Set(data, "motion", motion); Set(data, "attention", attention);
                Set(data, "rewardFlight", flight); Set(data, "coopView", view); Set(data, "panel", panel);
                Set(data, "inputLock", lockRect.gameObject); Set(data, "burst", burst);
                Set(data, "levelBanner", banner); Set(data, "levelBannerOutline", outline);
                var list = data.FindProperty("residents");
                list.arraySize = spots.Length;
                for (int i = 0; i < spots.Length; i++) list.GetArrayElementAtIndex(i).objectReferenceValue = spots[i];
                data.ApplyModifiedPropertiesWithoutUndo();
                var homeData = new SerializedObject(home);
                Set(homeData, "coopSequence", sequence);
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

        private static RectTransform Rect(Transform parent, string name, Vector2 min, Vector2 max, Vector2 position, Vector2 size)
        {
            var rect = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rect.gameObject.layer = parent.gameObject.layer;
            rect.SetParent(parent, false);
            rect.anchorMin = min; rect.anchorMax = max;
            rect.anchoredPosition = position; rect.sizeDelta = size;
            return rect;
        }
    }
}
