using System;
using System.IO;
using Hexrota.UnityClient.Presentation;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClient.Editor
{
    // Import pipeline for the hand-painted crate in art/crates/source: Crate_Base.png (the crate),
    // Crate_Plank_A.png (a plank from bottom left to top right) and Crate_Plank_B.png (top left to
    // bottom right). Each source is cleaned like the stones (largest solid island, no specks or halo,
    // rim colour bled from the body), checked for the expected content, trimmed and imported as a
    // sprite at the crate's scale. The planks sit on separate, unaligned canvases, so the pipeline
    // measures each plank's axis and records how to lay it across the crate's front face; the board
    // places them in code.
    public static class CrateArtImporter
    {
        public const string SourceFolder = "../art/crates/source/";
        public const string Folder = "Assets/Hexrota/Art/Crates/";
        public const int Canvas = 256;
        /// <summary>The crate's larger side in output pixels.</summary>
        public const float CrateExtent = 228f;
        /// <summary>World size of the crate's larger side: it fills most of a 0.97-unit cell.</summary>
        public const float CrateWorldExtent = .86f;
        /// <summary>The crate's front face inside its painted bounds (x, y from the bottom, width, height), measured from Crate_Base.png.</summary>
        public static readonly Rect FrontFace = new Rect(.04f, .03f, .92f, .62f);
        /// <summary>Each plank spans this share of the front face's diagonal.</summary>
        public const float PlankSpan = .9f;

        public sealed class Piece
        {
            public Color32[] Pixels;
            public RectInt Bounds;
            /// <summary>Alpha-weighted centre and main axis (degrees, y up) in output pixels.</summary>
            public Vector2 Centre;
            public float Angle, Length, Thickness;
        }

        [MenuItem("Hexrota/Art/Import Crate")]
        public static void ImportAll()
        {
            Directory.CreateDirectory(Folder);
            var crateSource = Load(SourcePath("Crate_Base"));
            float scale = CrateExtent / Mathf.Max(crateSource.bounds.width, crateSource.bounds.height);
            float ppu = CrateExtent / CrateWorldExtent;
            var crate = Fit(crateSource, scale);
            CheckCrate(crate);
            var planks = new[] { Fit(Load(SourcePath("Crate_Plank_A")), scale), Fit(Load(SourcePath("Crate_Plank_B")), scale) };
            CheckPlank(planks[0], true);
            CheckPlank(planks[1], false);

            var catalog = AssetDatabase.LoadAssetAtPath<HexrotaAssetCatalog>(StoneArtImporter.CatalogPath);
            var serialized = new SerializedObject(catalog);
            serialized.FindProperty("crateBase").objectReferenceValue = Save("Crate_Base", crate, ppu);
            var list = serialized.FindProperty("cratePlanks");
            list.arraySize = 2;
            for (int i = 0; i < 2; i++)
            {
                var layout = Lay(crate, planks[i], i == 0);
                var slot = list.GetArrayElementAtIndex(i);
                slot.FindPropertyRelative("sprite").objectReferenceValue = Save(i == 0 ? "Crate_Plank_A" : "Crate_Plank_B", planks[i], ppu);
                slot.FindPropertyRelative("offset").vector2Value = layout.offset / ppu;
                slot.FindPropertyRelative("rotation").floatValue = layout.rotation;
                slot.FindPropertyRelative("scale").floatValue = layout.scale;
            }
            serialized.ApplyModifiedPropertiesWithoutUndo();
            AssetDatabase.SaveAssets();
        }

        public static string SourcePath(string name) => Path.Combine(SourceFolder, name + ".png");

        public sealed class Source { public Color32[] Pixels; public int Width, Height; public RectInt bounds; }

        /// <summary>Loads and cleans one source (largest solid island, no specks or halo, bled rim).</summary>
        public static Source Load(string path)
        {
            var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            if (!texture.LoadImage(File.ReadAllBytes(path))) throw new InvalidDataException(path + " is not a PNG.");
            int w = texture.width, h = texture.height;
            var pixels = texture.GetPixels32();
            UnityEngine.Object.DestroyImmediate(texture);
            double before = Painted(pixels);
            StoneArtImporter.Clean(pixels, w, h);
            // Content check: the source is one object. Cleaning may drop specks and glow, not a second object.
            if (Painted(pixels) < before * .9) throw new InvalidDataException(path + " holds more than one object.");
            StoneArtImporter.Bleed(pixels, w, h);
            int minX = w, minY = h, maxX = -1, maxY = -1;
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                    if (pixels[y * w + x].a > 0) { minX = Math.Min(minX, x); maxX = Math.Max(maxX, x); minY = Math.Min(minY, y); maxY = Math.Max(maxY, y); }
            if (maxX < 0) throw new InvalidDataException(path + " is empty after cleaning.");
            return new Source { Pixels = pixels, Width = w, Height = h, bounds = new RectInt(minX, minY, maxX - minX + 1, maxY - minY + 1) };
        }

        private static double Painted(Color32[] pixels)
        {
            double sum = 0;
            foreach (var p in pixels) if (p.a >= StoneArtImporter.Solid) sum += 1;
            return sum;
        }

        /// <summary>Scales a cleaned source by box filtering and centres its painted bounds on the canvas.</summary>
        public static Piece Fit(Source source, float scale)
        {
            var b = source.bounds;
            float cx = b.x + b.width * .5f, cy = b.y + b.height * .5f;
            var output = new Color32[Canvas * Canvas];
            for (int y = 0; y < Canvas; y++)
                for (int x = 0; x < Canvas; x++)
                {
                    float x0 = cx + (x - Canvas * .5f) / scale, x1 = x0 + 1 / scale;
                    float y0 = cy + (y - Canvas * .5f) / scale, y1 = y0 + 1 / scale;
                    double r = 0, g = 0, bl = 0, a = 0, cover = 0;
                    for (int v = Mathf.FloorToInt(y0); v < Mathf.CeilToInt(y1); v++)
                    {
                        float fy = Mathf.Min(y1, v + 1) - Mathf.Max(y0, v);
                        if (fy <= 0) continue;
                        for (int u = Mathf.FloorToInt(x0); u < Mathf.CeilToInt(x1); u++)
                        {
                            float fx = Mathf.Min(x1, u + 1) - Mathf.Max(x0, u);
                            if (fx <= 0) continue;
                            double f = fx * fy; cover += f;
                            if (u < 0 || v < 0 || u >= source.Width || v >= source.Height) continue;
                            var c = source.Pixels[v * source.Width + u];
                            double pa = c.a / 255.0 * f;
                            r += c.r * pa; g += c.g * pa; bl += c.b * pa; a += pa;
                        }
                    }
                    if (cover <= 0 || a <= 0) continue;
                    output[y * Canvas + x] = new Color32((byte)Math.Round(r / a), (byte)Math.Round(g / a), (byte)Math.Round(bl / a), (byte)Math.Round(a / cover * 255));
                }
            StoneArtImporter.Bleed(output, Canvas, Canvas);
            return Measure(output);
        }

        // Alpha-weighted centre, principal axis and extents along and across it.
        public static Piece Measure(Color32[] pixels)
        {
            double w = 0, sx = 0, sy = 0;
            int minX = Canvas, minY = Canvas, maxX = -1, maxY = -1;
            for (int y = 0; y < Canvas; y++)
                for (int x = 0; x < Canvas; x++)
                {
                    double a = pixels[y * Canvas + x].a / 255.0;
                    if (a <= 0) continue;
                    w += a; sx += a * (x + .5); sy += a * (y + .5);
                    minX = Math.Min(minX, x); maxX = Math.Max(maxX, x); minY = Math.Min(minY, y); maxY = Math.Max(maxY, y);
                }
            double mx = sx / w, my = sy / w, xx = 0, yy = 0, xy = 0;
            for (int y = 0; y < Canvas; y++)
                for (int x = 0; x < Canvas; x++)
                {
                    double a = pixels[y * Canvas + x].a / 255.0;
                    if (a <= 0) continue;
                    double dx = x + .5 - mx, dy = y + .5 - my;
                    xx += a * dx * dx; yy += a * dy * dy; xy += a * dx * dy;
                }
            double angle = .5 * Math.Atan2(2 * xy, xx - yy);
            float cos = (float)Math.Cos(angle), sin = (float)Math.Sin(angle);
            float along0 = float.MaxValue, along1 = float.MinValue, across0 = float.MaxValue, across1 = float.MinValue;
            for (int y = 0; y < Canvas; y++)
                for (int x = 0; x < Canvas; x++)
                {
                    if (pixels[y * Canvas + x].a < 128) continue;
                    float dx = x + .5f - (float)mx, dy = y + .5f - (float)my;
                    float u = dx * cos + dy * sin, v = -dx * sin + dy * cos;
                    along0 = Math.Min(along0, u); along1 = Math.Max(along1, u); across0 = Math.Min(across0, v); across1 = Math.Max(across1, v);
                }
            return new Piece
            {
                Pixels = pixels,
                Bounds = new RectInt(minX, minY, maxX - minX + 1, maxY - minY + 1),
                Centre = new Vector2((float)mx - Canvas * .5f, (float)my - Canvas * .5f),
                Angle = (float)(angle * 180 / Math.PI), Length = along1 - along0, Thickness = across1 - across0
            };
        }

        // Content checks: the crate is a squarish solid block with an opaque front face.
        public static void CheckCrate(Piece crate)
        {
            float aspect = (float)crate.Bounds.width / crate.Bounds.height;
            if (aspect < .8f || aspect > 1.25f) throw new InvalidDataException("Crate_Base is not a squarish crate (aspect " + aspect + ").");
            var face = FaceRect(crate);
            int solid = 0, total = 0;
            for (int y = Mathf.CeilToInt(face.yMin); y < Mathf.FloorToInt(face.yMax); y++)
                for (int x = Mathf.CeilToInt(face.xMin); x < Mathf.FloorToInt(face.xMax); x++)
                {
                    total++;
                    if (crate.Pixels[y * Canvas + x].a == 255) solid++;
                }
            if (total == 0 || solid < total * .97f) throw new InvalidDataException("Crate_Base front face is not opaque (" + solid + "/" + total + ").");
        }

        // A plank is a long thin board; A rises to the right, B falls to the right.
        public static void CheckPlank(Piece plank, bool rising)
        {
            if (plank.Length < plank.Thickness * 4) throw new InvalidDataException("Plank is not a long board (" + plank.Length + " x " + plank.Thickness + ").");
            float angle = Mathf.Repeat(plank.Angle + 90f, 180f) - 90f;
            float expected = rising ? 45f : -45f;
            if (Mathf.Abs(Mathf.DeltaAngle(angle, expected)) > 20f)
                throw new InvalidDataException((rising ? "Crate_Plank_A" : "Crate_Plank_B") + " runs at " + angle + " degrees, expected about " + expected + ".");
        }

        /// <summary>The front face in canvas pixels (y up).</summary>
        public static Rect FaceRect(Piece crate)
        {
            var b = crate.Bounds;
            return new Rect(b.x + b.width * FrontFace.x, b.y + b.height * FrontFace.y, b.width * FrontFace.width, b.height * FrontFace.height);
        }

        /// <summary>Where a plank goes: centred on the front face, along one diagonal, spanning <see cref="PlankSpan"/> of it.</summary>
        public static (Vector2 offset, float rotation, float scale) Lay(Piece crate, Piece plank, bool rising)
        {
            var face = FaceRect(crate);
            Vector2 centre = face.center - Vector2.one * Canvas * .5f;
            float diagonal = Mathf.Atan2(face.height, face.width) * Mathf.Rad2Deg * (rising ? 1 : -1);
            float drawn = Mathf.Repeat(plank.Angle + 90f, 180f) - 90f;
            float scale = PlankSpan * Mathf.Sqrt(face.width * face.width + face.height * face.height) / plank.Length;
            float rotation = Mathf.DeltaAngle(drawn, diagonal);
            // The plank sprite is centred on its bounds, not its axis centre: move that centre onto the face centre.
            Vector2 local = Quaternion.Euler(0, 0, rotation) * (plank.Centre * scale);
            return (centre - local, rotation, scale);
        }

        private static Sprite Save(string name, Piece piece, float ppu)
        {
            string path = Folder + name + ".png";
            var texture = new Texture2D(Canvas, Canvas, TextureFormat.RGBA32, false);
            texture.SetPixels32(piece.Pixels);
            File.WriteAllBytes(path, texture.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(texture);
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = ppu;
            importer.alphaIsTransparency = true;
            importer.mipmapEnabled = true;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.filterMode = FilterMode.Trilinear;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.maxTextureSize = Canvas;
            var settings = new TextureImporterSettings();
            importer.ReadTextureSettings(settings);
            settings.spriteMeshType = SpriteMeshType.FullRect;
            settings.spriteAlignment = (int)SpriteAlignment.Center;
            importer.SetTextureSettings(settings);
            importer.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Sprite>(path);
        }
    }
}
