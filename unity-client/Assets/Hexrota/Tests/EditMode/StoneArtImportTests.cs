using System.Collections.Generic;
using System.IO;
using System.Linq;
using Hexrota.UnityClient.Editor;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    // The five hand-painted stones (art/stones/source) go through StoneArtImporter: no leftovers or
    // halo, one shared visual size of about 75% of a cell, and numerals drawn in code that stay
    // readable on every colour, the yellow stone included.
    public sealed class StoneArtImportTests
    {
        private const float CellHeight = .97f; // flat-to-flat height of a board hex (MobileLayout.Axial)

        private static Color32[] Pixels(int value)
        {
            var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            Assert.That(texture.LoadImage(File.ReadAllBytes(StoneArtImporter.Folder + "Stone_" + value + ".png")), Is.True);
            Assert.That(texture.width, Is.EqualTo(StoneArtImporter.Canvas));
            Assert.That(texture.height, Is.EqualTo(StoneArtImporter.Canvas));
            var pixels = texture.GetPixels32();
            Object.DestroyImmediate(texture);
            return pixels;
        }

        private static HexrotaAssetCatalog Catalog() =>
            AssetDatabase.LoadAssetAtPath<HexrotaAssetCatalog>(StoneArtImporter.CatalogPath);

        [Test]
        public void TheCatalogHoldsFiveSquareSpritesAtOneScaleAndOneNumeralFont()
        {
            var catalog = Catalog();
            Assert.That(catalog.stoneSprites, Has.Length.EqualTo(5));
            Assert.That(catalog.stoneDigitFont, Is.Not.Null);
            Assert.That(catalog.stoneDigitFont.name, Is.EqualTo("LilitaOne-Regular"));
            for (int i = 0; i < 5; i++)
            {
                var sprite = catalog.stoneSprites[i];
                Assert.That(sprite, Is.Not.Null, "Stone " + (i + 1));
                Assert.That(sprite.name, Is.EqualTo("Stone_" + (i + 1)));
                Assert.That(sprite.pixelsPerUnit, Is.EqualTo(StoneArtImporter.PixelsPerUnit).Within(.01f));
                Assert.That(sprite.rect.size, Is.EqualTo(Vector2.one * StoneArtImporter.Canvas));
                Assert.That(sprite.pivot, Is.EqualTo(Vector2.one * StoneArtImporter.Canvas * .5f));
                var importer = (TextureImporter)AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(sprite));
                Assert.That(importer.alphaIsTransparency, Is.True);
                Assert.That(catalog.stonePaintedHeights[i], Is.GreaterThan(0));
            }
            Assert.That(AssetDatabase.FindAssets("HexStone_0 t:Model"), Is.Empty, "The old stone models are gone.");
        }

        [Test]
        public void NoSpeckOrHaloSurvivesAroundAnyStone()
        {
            int w = StoneArtImporter.Canvas;
            for (int value = 1; value <= 5; value++)
            {
                var pixels = Pixels(value);
                // One painted island: every visible pixel connects to the body (8-neighbourhood).
                var seen = new bool[pixels.Length];
                int start = System.Array.FindIndex(pixels, p => p.a == 255);
                var queue = new Queue<int>(); queue.Enqueue(start); seen[start] = true; int reached = 0;
                while (queue.Count > 0)
                {
                    int p = queue.Dequeue(); reached++;
                    int x = p % w, y = p / w;
                    for (int dy = -1; dy <= 1; dy++)
                        for (int dx = -1; dx <= 1; dx++)
                        {
                            int nx = x + dx, ny = y + dy, n = ny * w + nx;
                            if (nx < 0 || ny < 0 || nx >= w || ny >= w || seen[n] || pixels[n].a == 0) continue;
                            seen[n] = true; queue.Enqueue(n);
                        }
                }
                Assert.That(reached, Is.EqualTo(pixels.Count(p => p.a > 0)), "Stone " + value + " has detached specks.");
                // The soft edge is a thin anti-aliased rim, not a halo: at most about two pixels deep.
                int rim = 0, soft = 0;
                for (int p = 0; p < pixels.Length; p++)
                {
                    if (pixels[p].a > 0 && pixels[p].a < 250) soft++;
                    int x = p % w, y = p / w;
                    if (pixels[p].a == 255 && x > 0 && x < w - 1 && y > 0 && y < w - 1 &&
                        (pixels[p - 1].a < 255 || pixels[p + 1].a < 255 || pixels[p - w].a < 255 || pixels[p + w].a < 255)) rim++;
                }
                Assert.That(soft, Is.LessThanOrEqualTo(rim * 2.5f), "Stone " + value + " keeps a semi-transparent halo.");
                // Nothing touches the canvas edge.
                for (int i = 0; i < w; i++)
                    Assert.That(new[] { pixels[i].a, pixels[(w - 1) * w + i].a, pixels[i * w].a, pixels[i * w + w - 1].a }.Max(),
                        Is.Zero, "Stone " + value + " touches the canvas edge.");
            }
        }

        [Test]
        public void EveryStoneHasTheSameVisualSizeOfAboutThreeQuartersOfACell()
        {
            for (int value = 1; value <= 5; value++)
            {
                var pixels = Pixels(value);
                double area = pixels.Sum(p => p.a / 255.0);
                float diameter = Mathf.Sqrt((float)(4 * area / System.Math.PI)) / StoneArtImporter.PixelsPerUnit;
                Assert.That(diameter / CellHeight, Is.InRange(.66f, .78f), "Stone " + value + " visual size against the cell.");
                float height = Catalog().stonePaintedHeights[value - 1];
                Assert.That(height / CellHeight, Is.InRange(.6f, .86f), "Stone " + value + " height against the cell.");
            }
            Assert.That(StoneArtImporter.VisualWorldSize / CellHeight, Is.EqualTo(.75f).Within(.03f));
        }

        [Test]
        public void TheImportedStonesAreWhatThePipelineMakesFromTheSources()
        {
            for (int value = 1; value <= 5; value++)
            {
                string source = StoneArtImporter.SourcePath(value);
                Assert.That(File.Exists(source), Is.True, source);
                var result = StoneArtImporter.Process(File.ReadAllBytes(source));
                var imported = Pixels(value);
                int worst = 0;
                for (int p = 0; p < imported.Length; p++) worst = Mathf.Max(worst, Mathf.Abs(imported[p].a - result.Pixels[p].a));
                Assert.That(worst, Is.LessThanOrEqualTo(1), "Stone " + value + " differs from its source.");
                var centre = Catalog().stoneDigitCentres[value - 1];
                Assert.That(Vector2.Distance(centre, result.Centre / StoneArtImporter.PixelsPerUnit), Is.LessThan(.001f));
            }
            // The triangle's visual centre sits below the middle of its box, so its numeral sits lower too.
            Assert.That(Catalog().stoneDigitCentres[2].y, Is.LessThan(-.03f));
        }

        private static float Luminance(Color c)
        {
            float Channel(float v) => v <= .03928f ? v / 12.92f : Mathf.Pow((v + .055f) / 1.055f, 2.4f);
            return .2126f * Channel(c.r) + .7152f * Channel(c.g) + .0722f * Channel(c.b);
        }

        private static float Contrast(Color a, Color b)
        {
            float x = Luminance(a), y = Luminance(b);
            return (Mathf.Max(x, y) + .05f) / (Mathf.Min(x, y) + .05f);
        }

        [Test]
        public void TheWhiteNumeralAndItsDarkOutlineReadOnEveryStoneIncludingYellow()
        {
            Assert.That(Contrast(HexBoardView.DigitFace, HexBoardView.DigitOutline), Is.GreaterThan(12f));
            Assert.That(HexBoardView.DigitHeightShare, Is.EqualTo(.5f));
            for (int value = 1; value <= 5; value++)
            {
                var body = Pixels(value).Where(p => p.a == 255).ToArray();
                var mean = new Color(body.Average(p => p.r / 255f), body.Average(p => p.g / 255f), body.Average(p => p.b / 255f));
                // On dark bodies the white face carries the numeral, on light ones the dark outline does.
                float best = Mathf.Max(Contrast(HexBoardView.DigitFace, mean), Contrast(HexBoardView.DigitOutline, mean));
                Assert.That(best, Is.GreaterThan(4.5f), "Stone " + value);
                // White alone is weak on the yellow stone (2), so its outline must stand out strongly there.
                if (value == 2)
                {
                    Assert.That(Contrast(HexBoardView.DigitFace, mean), Is.LessThan(3f), "Yellow is the weak case for white.");
                    Assert.That(Contrast(HexBoardView.DigitOutline, mean), Is.GreaterThan(7f), "Yellow stone outline");
                }
            }
        }
    }
}
