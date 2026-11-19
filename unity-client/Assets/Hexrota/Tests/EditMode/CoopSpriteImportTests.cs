using System;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    // The 2D coop sprites cut by art/coop-2d/cut_sprites.py (Coop_L0 foundation .. Coop_L4).
    public sealed class CoopSpriteImportTests
    {
        private const string Folder = "Assets/Hexrota/Art/Coop2D/";

        [Serializable] private sealed class Entry { public int level; public string file; public float[] pivot; public float diskWidth; public int width; public int height; }
        [Serializable] private sealed class Manifest { public Entry[] levels; }

        private static Manifest Load()
        {
            var json = AssetDatabase.LoadAssetAtPath<TextAsset>(Folder + "coop_sprites.json");
            Assert.That(json, Is.Not.Null, "coop_sprites.json comes with the sprites.");
            return JsonUtility.FromJson<Manifest>(json.text);
        }

        [Test]
        public void EveryLevelIsAMobileSpriteWithoutMipmapsAtFullResolution([Values(0, 1, 2, 3, 4)] int level)
        {
            var entry = Load().levels[level];
            string path = Folder + entry.file;
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;
            Assert.That(importer, Is.Not.Null, path);
            Assert.That(importer.textureType, Is.EqualTo(TextureImporterType.Sprite));
            Assert.That(importer.mipmapEnabled, Is.False);
            Assert.That(importer.alphaIsTransparency, Is.True);
            Assert.That(importer.maxTextureSize, Is.GreaterThanOrEqualTo(Mathf.Max(entry.width, entry.height)), "No downscaling.");
            Assert.That(importer.GetPlatformTextureSettings("Android").format, Is.EqualTo(TextureImporterFormat.ASTC_6x6));
            Assert.That(importer.GetPlatformTextureSettings("iPhone").format, Is.EqualTo(TextureImporterFormat.ASTC_6x6));
            var sprite = AssetDatabase.LoadAssetAtPath<Sprite>(path);
            Assert.That(sprite.rect.width, Is.EqualTo(entry.width));
            Assert.That(sprite.rect.height, Is.EqualTo(entry.height));
        }

        [Test]
        public void EveryLevelStandsOnTheBottomCentreOfItsBaseDisk([Values(0, 1, 2, 3, 4)] int level)
        {
            var entry = Load().levels[level];
            var sprite = AssetDatabase.LoadAssetAtPath<Sprite>(Folder + entry.file);
            var pivot = new Vector2(sprite.pivot.x / sprite.rect.width, sprite.pivot.y / sprite.rect.height);
            Assert.That(pivot.x, Is.EqualTo(entry.pivot[0]).Within(.002f), "Pivot from the cutting script.");
            Assert.That(pivot.y, Is.EqualTo(entry.pivot[1]).Within(.002f));
            Assert.That(pivot.x, Is.InRange(.4f, .6f), "Disk centre.");
            Assert.That(pivot.y, Is.LessThan(.03f), "Bottom of the disk.");
            Assert.That(entry.diskWidth, Is.GreaterThan(entry.width * .8f), "The base disk spans the sprite.");
        }

        [Test]
        public void TheCutHasNoBackgroundLeftOnItsBorder([Values(0, 1, 2, 3, 4)] int level)
        {
            var entry = Load().levels[level];
            var texture = new Texture2D(2, 2);
            Assert.That(texture.LoadImage(System.IO.File.ReadAllBytes(Folder + entry.file)), Is.True);
            try
            {
                // The crop keeps a transparent margin: every border pixel is fully clear.
                for (int x = 0; x < texture.width; x += 7)
                {
                    Assert.That(texture.GetPixel(x, 0).a, Is.Zero, "bottom " + x);
                    Assert.That(texture.GetPixel(x, texture.height - 1).a, Is.Zero, "top " + x);
                }
                for (int y = 0; y < texture.height; y += 7)
                {
                    Assert.That(texture.GetPixel(0, y).a, Is.Zero, "left " + y);
                    Assert.That(texture.GetPixel(texture.width - 1, y).a, Is.Zero, "right " + y);
                }
            }
            finally { UnityEngine.Object.DestroyImmediate(texture); }
        }
    }
}
