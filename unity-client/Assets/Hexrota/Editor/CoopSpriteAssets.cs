using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClient.Editor
{
    // Import settings for the 2D coop sprites cut by art/coop-2d/cut_sprites.py. The pivot of every
    // level is the centre of its base disk (read from coop_sprites.json); the disk sizes scale each
    // level against the plot (CoopLook).
    public static class CoopSpriteAssets
    {
        public const string Folder = "Assets/Hexrota/Art/Coop2D/";
        public const int Levels = 5;
        /// <summary>Largest source is about 1.2k px wide; 2048 keeps it at full resolution.</summary>
        public const int MaxSize = 2048;
        public const string LookPath = "Assets/Hexrota/Presentation/Theme/CoopLook.asset";

        public sealed class Set
        {
            public Sprite[] Levels = new Sprite[CoopSpriteAssets.Levels];
            public float[] DiskPixels = new float[CoopSpriteAssets.Levels];
            public float[] DiskHeightPixels = new float[CoopSpriteAssets.Levels];
            public Presentation.CoopLook Look;
            public Sprite[] Dust;
            public Sprite Shadow;
        }

        [Serializable] private sealed class Entry { public int level; public string file; public float[] pivot; public float diskWidth; public float diskHeight; }
        [Serializable] private sealed class Manifest { public Entry[] levels; public string[] dust; public string shadow; }

        [MenuItem("Hexrota/Home/Reimport Coop Sprites")]
        private static void Reimport() => Prepare();

        public static Set Prepare()
        {
            var json = AssetDatabase.LoadAssetAtPath<TextAsset>(Folder + "coop_sprites.json");
            if (json == null) throw new InvalidOperationException("Run art/coop-2d/cut_sprites.py first: " + Folder + "coop_sprites.json is missing.");
            var manifest = JsonUtility.FromJson<Manifest>(json.text);
            var set = new Set();
            foreach (var entry in manifest.levels)
            {
                set.Levels[entry.level] = Configure(Folder + entry.file, new Vector2(entry.pivot[0], entry.pivot[1]));
                set.DiskPixels[entry.level] = entry.diskWidth;
                set.DiskHeightPixels[entry.level] = entry.diskHeight;
            }
            var dust = new List<Sprite>();
            foreach (var file in manifest.dust) dust.Add(Configure(Folder + file, new Vector2(.5f, .5f), 512));
            set.Dust = dust.ToArray();
            set.Shadow = Configure(Folder + manifest.shadow, new Vector2(.5f, .5f), 512);
            set.Look = AssetDatabase.LoadAssetAtPath<Presentation.CoopLook>(LookPath);
            if (set.Look == null) throw new InvalidOperationException("Missing " + LookPath);
            for (int i = 0; i < Levels; i++)
                if (set.Levels[i] == null) throw new InvalidOperationException("Missing coop level sprite " + i);
            return set;
        }

        private static Sprite Configure(string path, Vector2 pivot, int maxSize = MaxSize)
        {
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;
            if (importer == null) throw new InvalidOperationException("Missing " + path);
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            var settings = new TextureImporterSettings();
            importer.ReadTextureSettings(settings);
            settings.spriteAlignment = (int)SpriteAlignment.Custom;
            settings.spritePivot = pivot;
            settings.spriteMeshType = SpriteMeshType.FullRect;
            importer.SetTextureSettings(settings);
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.filterMode = FilterMode.Bilinear;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.maxTextureSize = maxSize;
            importer.textureCompression = TextureImporterCompression.CompressedHQ;
            foreach (var platform in new[] { "Android", "iPhone" })
            {
                var p = importer.GetPlatformTextureSettings(platform);
                p.overridden = true;
                p.maxTextureSize = maxSize;
                p.format = TextureImporterFormat.ASTC_6x6;
                importer.SetPlatformTextureSettings(p);
            }
            importer.SaveAndReimport();
            var sprite = AssetDatabase.LoadAssetAtPath<Sprite>(path);
            if (sprite == null) throw new InvalidOperationException("Not a sprite: " + path);
            return sprite;
        }
    }
}
