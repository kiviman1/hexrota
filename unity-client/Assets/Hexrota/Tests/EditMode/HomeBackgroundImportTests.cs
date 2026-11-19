using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    public sealed class HomeBackgroundImportTests
    {
        [TestCase("sky", 4096), TestCase("ground", 4096), TestCase("foreground", 4096),
         TestCase("cloud_1", 2048), TestCase("cloud_2", 2048), TestCase("cloud_3", 2048)]
        public void LayersImportForMobileWithoutMipmapsAndAtFullResolution(string name, int maxSize)
        {
            string path = "Assets/Hexrota/Art/HomeBackground/" + name + ".png";
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;
            Assert.That(importer, Is.Not.Null, path);
            Assert.That(importer.textureType, Is.EqualTo(TextureImporterType.Sprite));
            Assert.That(importer.mipmapEnabled, Is.False);
            Assert.That(importer.maxTextureSize, Is.EqualTo(maxSize));
            Assert.That(importer.textureCompression, Is.Not.EqualTo(TextureImporterCompression.Uncompressed));
            foreach (var platform in new[] { "Android", "iPhone" })
            {
                var settings = importer.GetPlatformTextureSettings(platform);
                Assert.That(settings.overridden, Is.True, platform);
                Assert.That(settings.format, Is.EqualTo(TextureImporterFormat.ASTC_6x6), platform);
                Assert.That(settings.maxTextureSize, Is.EqualTo(maxSize), platform);
            }
            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            importer.GetSourceTextureWidthAndHeight(out int width, out int height);
            Assert.That(Mathf.Max(width, height), Is.LessThanOrEqualTo(maxSize), "No downscaling: the layer keeps its painted resolution.");
            Assert.That(texture.width, Is.EqualTo(width));
            Assert.That(texture.height, Is.EqualTo(height));
        }
    }
}
