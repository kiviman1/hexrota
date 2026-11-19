using System;
using Hexrota.UnityClient.Presentation;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Editor
{
    // Decluttered home: the side rails and the egg pill are hidden (kept in the prefab), the bottom menu
    // becomes Shop · Home · Areas (Journey, Records and Garden stay in the prefab, hidden; their pages
    // remain) and opens after chapter 5. Run after Rebuild Coop Controls, which owns the coop bar.
    public static class HomeMenuBuilder
    {
        private const string Prefab = "Assets/Hexrota/Resources/CastleHome/CastleHome.prefab";
        private const string AreasIcon = "Assets/Hexrota/Art/CastleHome/Map.png";
        private const string AreasButton = "AreasButton";
        private const float Spacing = 120;

        [MenuItem("Hexrota/Home/Rebuild Home Menu")]
        public static void Rebuild()
        {
            var icon = AssetDatabase.LoadAssetAtPath<Sprite>(AreasIcon);
            if (icon == null) throw new InvalidOperationException("Missing " + AreasIcon);
            var root = PrefabUtility.LoadPrefabContents(Prefab);
            try
            {
                var layout = root.transform.Find("MenuLayout");
                var nav = layout != null ? layout.Find("BottomNav") : null;
                var home = root.GetComponent<CastleHomeView>();
                var play = layout != null ? layout.Find("PlayArea") as RectTransform : null;
                var bar = layout != null ? layout.Find("CoopProgress") as RectTransform : null;
                var garden = nav != null ? nav.Find("GardenButton") : null;
                var shop = nav != null ? nav.Find("ShopButton") as RectTransform : null;
                var homeButton = nav != null ? nav.Find("HomeButton") as RectTransform : null;
                if (nav == null || home == null || play == null || bar == null || garden == null || shop == null || homeButton == null)
                    throw new InvalidOperationException("Home prefab hierarchy changed (run Rebuild Coop Controls first).");

                foreach (var path in new[] { "SideActions", "TopBar/EggWallet" })
                {
                    var hidden = layout.Find(path);
                    if (hidden != null) hidden.gameObject.SetActive(false);
                }
                foreach (var name in new[] { "JourneyButton", "RecordsButton", "GardenButton" })
                {
                    var hidden = nav.Find(name);
                    if (hidden != null) hidden.gameObject.SetActive(false);
                }

                var existing = nav.Find(AreasButton);
                if (existing != null) UnityEngine.Object.DestroyImmediate(existing.gameObject);
                var areas = (RectTransform)UnityEngine.Object.Instantiate(garden.gameObject, nav, false).transform;
                areas.name = AreasButton;
                areas.gameObject.SetActive(true);
                var areasIcon = areas.Find("Icon").GetComponent<Image>();
                areasIcon.sprite = icon;
                areasIcon.preserveAspect = true;
                foreach (var caption in areas.GetComponentsInChildren<Text>(true)) caption.text = "Alanlar";

                // Shop · Home · Areas
                shop.anchoredPosition = new Vector2(-Spacing, shop.anchoredPosition.y);
                homeButton.anchoredPosition = new Vector2(0, homeButton.anchoredPosition.y);
                areas.anchoredPosition = new Vector2(Spacing, areas.anchoredPosition.y);
                areas.SetSiblingIndex(homeButton.GetSiblingIndex() + 1);
                nav.gameObject.SetActive(false); // opens after chapter 5 (CastleHomeView.ShowNavigation)

                var data = new SerializedObject(home);
                Set(data, "areasButton", areas.GetComponent<Button>());
                Set(data, "bottomNavigation", nav.gameObject);
                Set(data, "playArea", play);
                Set(data, "coopProgress", bar);
                data.ApplyModifiedPropertiesWithoutUndo();

                // The prefab shows the new-profile layout (no menu): Play and the bar sit lower.
                float playY = data.FindProperty("playAnchorWithoutMenu").floatValue;
                play.anchorMin = new Vector2(play.anchorMin.x, playY); play.anchorMax = new Vector2(play.anchorMax.x, playY);
                bar.anchorMin = new Vector2(bar.anchorMin.x, playY); bar.anchorMax = new Vector2(bar.anchorMax.x, playY);
                bar.anchoredPosition = new Vector2(bar.anchoredPosition.x, data.FindProperty("barAboveWithoutMenu").floatValue);
                PrefabUtility.SaveAsPrefabAsset(root, Prefab);
            }
            finally { PrefabUtility.UnloadPrefabContents(root); }
        }

        private static void Set(SerializedObject data, string field, UnityEngine.Object value)
        {
            var property = data.FindProperty(field);
            if (property == null) throw new InvalidOperationException("Missing field " + field);
            if (value == null) throw new InvalidOperationException("Missing value for " + field);
            property.objectReferenceValue = value;
        }
    }
}
