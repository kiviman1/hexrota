using System;
using Hexrota.UnityClient.Presentation;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Editor
{
    // Replaces the home background with the painted layers in Art/HomeBackground (source: art/HomeBackground,
    // see its README). Draw order: sky → cloud_1..3 → ground → (empty: 3D coop and residents) → UI.
    // foreground.png is imported but not used yet. Old castle-scene layers are hidden, not deleted.
    // Re-running replaces only the ArtFrame this builder owns.
    public static class HomeBackgroundBuilder
    {
        private const string Prefab = "Assets/Hexrota/Resources/CastleHome/CastleHome.prefab";
        private const string Art = "Assets/Hexrota/Art/HomeBackground/";
        private const string Motion = "Assets/Hexrota/Presentation/Theme/MotionTheme.asset";
        private static readonly Vector2 ArtSize = new Vector2(1170, 2532);

        // Source-pixel rectangles (left, top, width, height). The README puts the clouds in the visible
        // sky band (y < ~460); cloud_1 keeps its painted position, the other two are lifted into the band.
        private static readonly Rect[] CloudRects =
        {
            new Rect(491, 186, 678, 352),
            new Rect(0, 70, 482, 254),
            new Rect(782, 300, 387, 178),
        };
        // The dirt plot in ground.png, measured from the painting.
        private static readonly Rect PlotRect = new Rect(40, 985, 1070, 675);
        private static readonly string[] OldLayers = { "FarClouds", "FarIslands", "Waterfalls", "Ground", "Foreground" };

        [MenuItem("Hexrota/Home/Rebuild Background Layers")]
        public static void Rebuild()
        {
            ConfigureImport("sky", 4096);
            ConfigureImport("ground", 4096);
            ConfigureImport("foreground", 4096);
            for (int i = 1; i <= 3; i++) ConfigureImport("cloud_" + i, 2048);

            var motion = AssetDatabase.LoadAssetAtPath<MotionTheme>(Motion);
            if (motion == null) throw new InvalidOperationException("MotionTheme is missing.");
            var root = PrefabUtility.LoadPrefabContents(Prefab);
            try
            {
                var env = root.transform.Find("MenuLayout/Environment");
                var background = env != null ? env.Find("Background") : null;
                var coop = env != null ? env.Find("Coop") : null;
                var home = root.GetComponent<CastleHomeView>();
                if (background == null || coop == null || home == null) throw new InvalidOperationException("Home prefab hierarchy changed.");

                var sky = background.GetComponent<Image>();
                sky.sprite = Sprite("sky");
                sky.type = Image.Type.Simple;
                sky.preserveAspect = false;
                sky.color = Color.white;
                sky.raycastTarget = false;
                var backdrop = background.GetComponent<CastleHomeBackdrop>() ?? background.gameObject.AddComponent<CastleHomeBackdrop>();
                var backdropData = new SerializedObject(backdrop);
                backdropData.FindProperty("cover").boolValue = true;
                // Wider screens crop top and bottom: keep a little more of the top (tree, waterfall).
                backdropData.FindProperty("focalPoint").vector2Value = new Vector2(.5f, .6f);
                backdropData.ApplyModifiedPropertiesWithoutUndo();

                var existing = background.Find("ArtFrame");
                if (existing != null) UnityEngine.Object.DestroyImmediate(existing.gameObject);
                var frame = NewRect(background, "ArtFrame");
                frame.anchorMin = frame.anchorMax = frame.pivot = Vector2.zero;
                frame.sizeDelta = ArtSize;
                var cloudGroup = NewRect(frame, "Clouds"); Stretch(cloudGroup);
                var clouds = new RectTransform[CloudRects.Length];
                for (int i = 0; i < clouds.Length; i++)
                {
                    clouds[i] = NewRect(cloudGroup, "Cloud" + (i + 1));
                    Place(clouds[i], CloudRects[i]);
                    AddImage(clouds[i], Sprite("cloud_" + (i + 1)));
                }
                var ground = NewRect(frame, "Ground"); Stretch(ground);
                AddImage(ground, Sprite("ground"));
                var plot = NewRect(frame, "CoopPlot");
                Place(plot, PlotRect);

                var layers = background.GetComponent<HomeBackgroundLayers>() ?? background.gameObject.AddComponent<HomeBackgroundLayers>();
                var data = new SerializedObject(layers);
                data.FindProperty("motion").objectReferenceValue = motion;
                data.FindProperty("frame").objectReferenceValue = frame;
                data.FindProperty("artSize").vector2Value = ArtSize;
                var list = data.FindProperty("clouds");
                list.arraySize = clouds.Length;
                for (int i = 0; i < clouds.Length; i++) list.GetArrayElementAtIndex(i).objectReferenceValue = clouds[i];
                data.FindProperty("coopPlot").objectReferenceValue = plot;
                data.ApplyModifiedPropertiesWithoutUndo();
                var homeData = new SerializedObject(home);
                homeData.FindProperty("background").objectReferenceValue = layers;
                homeData.ApplyModifiedPropertiesWithoutUndo();

                // Layers of the old castle scene stay in the prefab, hidden.
                foreach (var name in OldLayers)
                {
                    var old = env.Find(name);
                    if (old != null) old.gameObject.SetActive(false);
                }
                // The placeholder coop stays active: the coop view scales it and the upgrade sequence
                // targets it. Only its castle drawing (towers, flags, hen, chick) is hidden.
                var castle = coop.GetComponent<Image>();
                if (castle != null) castle.enabled = false;
                foreach (Transform part in coop) part.gameObject.SetActive(false);

                PrefabUtility.SaveAsPrefabAsset(root, Prefab);
            }
            finally { PrefabUtility.UnloadPrefabContents(root); }
            AssetDatabase.SaveAssets();
            Debug.Log("Home background layers rebuilt.");
        }

        private static void ConfigureImport(string name, int maxSize)
        {
            string path = Art + name + ".png";
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;
            if (importer == null) throw new InvalidOperationException("Missing home background layer: " + path);
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.filterMode = FilterMode.Bilinear;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.maxTextureSize = maxSize;
            importer.textureCompression = TextureImporterCompression.CompressedHQ;
            foreach (var platform in new[] { "Android", "iPhone" })
            {
                var settings = importer.GetPlatformTextureSettings(platform);
                settings.overridden = true;
                settings.maxTextureSize = maxSize;
                settings.format = TextureImporterFormat.ASTC_6x6;
                settings.compressionQuality = 100;
                importer.SetPlatformTextureSettings(settings);
            }
            importer.SaveAndReimport();
        }

        private static Sprite Sprite(string name)
        {
            var sprite = AssetDatabase.LoadAssetAtPath<Sprite>(Art + name + ".png");
            if (sprite == null) throw new InvalidOperationException("Missing home background sprite: " + name);
            return sprite;
        }

        private static RectTransform NewRect(Transform parent, string name)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.layer = parent.gameObject.layer;
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        private static void Stretch(RectTransform rect)
        {
            rect.anchorMin = Vector2.zero; rect.anchorMax = Vector2.one; rect.offsetMin = rect.offsetMax = Vector2.zero;
        }

        // Anchors a rectangle given in source pixels (top-left origin) inside the art frame.
        private static void Place(RectTransform rect, Rect source)
        {
            rect.anchorMin = new Vector2(source.xMin / ArtSize.x, 1f - source.yMax / ArtSize.y);
            rect.anchorMax = new Vector2(source.xMax / ArtSize.x, 1f - source.yMin / ArtSize.y);
            rect.offsetMin = rect.offsetMax = Vector2.zero;
            rect.pivot = new Vector2(.5f, .5f);
        }

        private static void AddImage(RectTransform rect, Sprite sprite)
        {
            rect.gameObject.AddComponent<CanvasRenderer>();
            var image = rect.gameObject.AddComponent<Image>();
            image.sprite = sprite;
            image.raycastTarget = false;
        }
    }
}
