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
    // The crate art (art/crates/source) goes through CrateArtImporter: clean edges, checked content,
    // one shared scale, and the planks laid across the crate's front face in code.
    public sealed class CrateArtImportTests
    {
        private static readonly string[] Names = { "Crate_Base", "Crate_Plank_A", "Crate_Plank_B" };

        private static HexrotaAssetCatalog Catalog() =>
            AssetDatabase.LoadAssetAtPath<HexrotaAssetCatalog>(StoneArtImporter.CatalogPath);

        private static Color32[] Imported(string name)
        {
            var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            Assert.That(texture.LoadImage(File.ReadAllBytes(CrateArtImporter.Folder + name + ".png")), Is.True);
            Assert.That(texture.width, Is.EqualTo(CrateArtImporter.Canvas));
            var pixels = texture.GetPixels32();
            Object.DestroyImmediate(texture);
            return pixels;
        }

        [Test]
        public void TheCatalogHoldsTheCrateAndBothPlanksAtOneScale()
        {
            var catalog = Catalog();
            Assert.That(catalog.crateBase, Is.Not.Null);
            Assert.That(catalog.crateBase.name, Is.EqualTo("Crate_Base"));
            Assert.That(catalog.cratePlanks, Has.Length.EqualTo(2));
            Assert.That(catalog.cratePlanks[0].sprite.name, Is.EqualTo("Crate_Plank_A"));
            Assert.That(catalog.cratePlanks[1].sprite.name, Is.EqualTo("Crate_Plank_B"));
            float ppu = CrateArtImporter.CrateExtent / CrateArtImporter.CrateWorldExtent;
            foreach (var sprite in new[] { catalog.crateBase, catalog.cratePlanks[0].sprite, catalog.cratePlanks[1].sprite })
                Assert.That(sprite.pixelsPerUnit, Is.EqualTo(ppu).Within(.01f), sprite.name);
            // The painted crate (not the 256 px canvas around it) fills most of a 0.97-unit cell.
            var painted = CrateArtImporter.Measure(Imported("Crate_Base")).Bounds;
            Assert.That(Mathf.Max(painted.width, painted.height) / ppu, Is.InRange(.7f, .9f));
            Assert.That(AssetDatabase.FindAssets("AreaCrate_HP"), Is.Empty, "The old numbered shields are gone.");
        }

        [Test]
        public void NoSpeckOrHaloSurvivesAroundTheCrateOrThePlanks()
        {
            int w = CrateArtImporter.Canvas;
            foreach (var name in Names)
            {
                var pixels = Imported(name);
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
                Assert.That(reached, Is.EqualTo(pixels.Count(p => p.a > 0)), name + " has detached specks.");
                int soft = pixels.Count(p => p.a > 0 && p.a < 250), solid = pixels.Count(p => p.a == 255);
                Assert.That(soft, Is.LessThan(solid * .08f), name + " keeps a semi-transparent halo.");
                for (int i = 0; i < w; i++)
                    Assert.That(new[] { pixels[i].a, pixels[(w - 1) * w + i].a, pixels[i * w].a, pixels[i * w + w - 1].a }.Max(),
                        Is.Zero, name + " touches the canvas edge.");
            }
        }

        [Test]
        public void TheImportedArtIsWhatThePipelineMakesAndPassesItsContentChecks()
        {
            var crateSource = CrateArtImporter.Load(CrateArtImporter.SourcePath("Crate_Base"));
            float scale = CrateArtImporter.CrateExtent / Mathf.Max(crateSource.bounds.width, crateSource.bounds.height);
            var pieces = Names.Select(n => CrateArtImporter.Fit(n == "Crate_Base" ? crateSource : CrateArtImporter.Load(CrateArtImporter.SourcePath(n)), scale)).ToArray();
            for (int i = 0; i < Names.Length; i++)
            {
                var imported = Imported(Names[i]);
                int worst = 0;
                for (int p = 0; p < imported.Length; p++) worst = Mathf.Max(worst, Mathf.Abs(imported[p].a - pieces[i].Pixels[p].a));
                Assert.That(worst, Is.LessThanOrEqualTo(1), Names[i] + " differs from its source.");
            }
            Assert.DoesNotThrow(() => CrateArtImporter.CheckCrate(pieces[0]));
            Assert.DoesNotThrow(() => CrateArtImporter.CheckPlank(pieces[1], true));
            Assert.DoesNotThrow(() => CrateArtImporter.CheckPlank(pieces[2], false));
            // The checks catch swapped or wrong art.
            Assert.Throws<InvalidDataException>(() => CrateArtImporter.CheckPlank(pieces[1], false));
            Assert.Throws<InvalidDataException>(() => CrateArtImporter.CheckPlank(pieces[0], true), "A crate is not a plank.");
            var catalog = Catalog();
            float ppu = CrateArtImporter.CrateExtent / CrateArtImporter.CrateWorldExtent;
            for (int i = 0; i < 2; i++)
            {
                var layout = CrateArtImporter.Lay(pieces[0], pieces[i + 1], i == 0);
                Assert.That(Vector2.Distance(catalog.cratePlanks[i].offset, layout.offset / ppu), Is.LessThan(.001f));
                Assert.That(catalog.cratePlanks[i].rotation, Is.EqualTo(layout.rotation).Within(.01f));
                Assert.That(catalog.cratePlanks[i].scale, Is.EqualTo(layout.scale).Within(.001f));
            }
        }

        [Test]
        public void TheTwoPlanksCrossOnTheFrontFaceAndStayInsideTheCrate()
        {
            var crate = CrateArtImporter.Measure(Imported("Crate_Base"));
            var face = CrateArtImporter.FaceRect(crate);
            var catalog = Catalog();
            float ppu = CrateArtImporter.CrateExtent / CrateArtImporter.CrateWorldExtent;
            float[] directions = new float[2];
            for (int i = 0; i < 2; i++)
            {
                var plank = CrateArtImporter.Measure(Imported(Names[i + 1]));
                var look = catalog.cratePlanks[i];
                var turn = Quaternion.Euler(0, 0, look.rotation);
                Vector2 centre = look.offset * ppu + (Vector2)(turn * (plank.Centre * look.scale)) + Vector2.one * CrateArtImporter.Canvas * .5f;
                Assert.That(Vector2.Distance(centre, face.center), Is.LessThan(2f), Names[i + 1] + " is centred on the front face.");
                float angle = (plank.Angle + look.rotation) * Mathf.Deg2Rad;
                directions[i] = Mathf.Repeat(plank.Angle + look.rotation + 90f, 180f) - 90f;
                var half = new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * plank.Length * look.scale * .5f;
                foreach (var end in new[] { centre + half, centre - half })
                    Assert.That(crate.Bounds.Contains(new Vector2Int(Mathf.RoundToInt(end.x), Mathf.RoundToInt(end.y))), Is.True,
                        Names[i + 1] + " end " + end + " leaves the crate.");
            }
            Assert.That(directions[0], Is.GreaterThan(15f), "Plank A rises to the right.");
            Assert.That(directions[1], Is.LessThan(-15f), "Plank B falls to the right.");
        }
    }
}
