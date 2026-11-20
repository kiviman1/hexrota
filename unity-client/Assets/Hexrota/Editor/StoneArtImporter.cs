using System;
using System.Collections.Generic;
using System.IO;
using Hexrota.UnityClient.Presentation;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClient.Editor
{
    // Import pipeline for the hand-painted stones in art/stones/source/Stone_1..5.png (1 purple,
    // 2 yellow, 3 red, 4 turquoise, 5 orange). The sources have no numerals and arrive at different
    // sizes with semi-transparent leftovers and a halo. Each one is cleaned, trimmed and scaled to the
    // same visual size (the same area), centred on a square canvas and imported as a sprite. The
    // numeral is drawn by the board in code, at the alpha-weighted centre the pipeline records.
    public static class StoneArtImporter
    {
        public const int Count = 5;
        public const string SourceFolder = "../art/stones/source/";
        public const string Folder = "Assets/Hexrota/Art/Stones/";
        public const string CatalogPath = "Assets/Hexrota/Art/HexrotaAssets.asset";
        public const string DigitFontPath = "Assets/Hexrota/Art/CastleHomeType/LilitaOne-Regular.ttf";
        /// <summary>Square output canvas in pixels.</summary>
        public const int Canvas = 256;
        /// <summary>Every stone gets the same area: that of a disc this many pixels across.</summary>
        public const float VisualDiameter = 196f;
        /// <summary>No stone may be wider or taller than this, so long shapes stay inside the cell.</summary>
        public const float MaxExtent = 228f;
        /// <summary>World size of <see cref="VisualDiameter"/>: about 75% of the 0.97-unit hex cell (flat to flat).</summary>
        public const float VisualWorldSize = .72f;
        public const float PixelsPerUnit = VisualDiameter / VisualWorldSize;
        /// <summary>Source alpha at or below this is a leftover, not paint.</summary>
        public const byte Residue = 24;
        /// <summary>Alpha at or above this is solid body; the stone is the largest solid island.</summary>
        public const byte Solid = 160;

        public sealed class Result
        {
            public Color32[] Pixels;
            /// <summary>Alpha-weighted centre relative to the canvas centre, in pixels (y up).</summary>
            public Vector2 Centre;
            public float Area;
            public RectInt Bounds;
        }

        [MenuItem("Hexrota/Art/Import Stones")]
        public static void ImportAll()
        {
            Directory.CreateDirectory(Folder);
            var sprites = new Sprite[Count];
            var centres = new Vector2[Count];
            var heights = new float[Count];
            for (int value = 1; value <= Count; value++)
            {
                var result = Process(File.ReadAllBytes(SourcePath(value)));
                string path = Folder + "Stone_" + value + ".png";
                var texture = new Texture2D(Canvas, Canvas, TextureFormat.RGBA32, false);
                texture.SetPixels32(result.Pixels);
                File.WriteAllBytes(path, texture.EncodeToPNG());
                UnityEngine.Object.DestroyImmediate(texture);
                AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceSynchronousImport);
                Configure(path);
                sprites[value - 1] = AssetDatabase.LoadAssetAtPath<Sprite>(path);
                centres[value - 1] = result.Centre / PixelsPerUnit;
                heights[value - 1] = result.Bounds.height / PixelsPerUnit;
            }
            var catalog = AssetDatabase.LoadAssetAtPath<HexrotaAssetCatalog>(CatalogPath);
            var serialized = new SerializedObject(catalog);
            var spriteList = serialized.FindProperty("stoneSprites");
            var centreList = serialized.FindProperty("stoneDigitCentres");
            var heightList = serialized.FindProperty("stonePaintedHeights");
            spriteList.arraySize = centreList.arraySize = heightList.arraySize = Count;
            for (int i = 0; i < Count; i++)
            {
                spriteList.GetArrayElementAtIndex(i).objectReferenceValue = sprites[i];
                centreList.GetArrayElementAtIndex(i).vector2Value = centres[i];
                heightList.GetArrayElementAtIndex(i).floatValue = heights[i];
            }
            serialized.FindProperty("stoneDigitFont").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Font>(DigitFontPath);
            serialized.ApplyModifiedPropertiesWithoutUndo();
            AssetDatabase.SaveAssets();
        }

        public static string SourcePath(int value) => Path.Combine(SourceFolder, "Stone_" + value + ".png");

        private static void Configure(string path)
        {
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = PixelsPerUnit;
            importer.spritePivot = new Vector2(.5f, .5f);
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
        }

        /// <summary>Runs the whole pipeline on one PNG and returns the finished canvas.</summary>
        public static Result Process(byte[] png)
        {
            var source = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            if (!source.LoadImage(png)) throw new InvalidDataException("Stone source is not a PNG.");
            int w = source.width, h = source.height;
            var pixels = source.GetPixels32();
            UnityEngine.Object.DestroyImmediate(source);
            Clean(pixels, w, h);
            Bleed(pixels, w, h);
            return Fit(pixels, w, h);
        }

        // Keeps the largest solid island and the soft edge that grows out of it; everything else
        // (specks, the glow ring, faint leftovers) becomes fully transparent. The soft edge is then
        // tightened so no semi-transparent halo is left around the rim.
        internal static void Clean(Color32[] pixels, int w, int h)
        {
            var island = new int[pixels.Length];
            int best = 0, bestSize = 0, label = 0;
            var queue = new Queue<int>();
            for (int start = 0; start < pixels.Length; start++)
            {
                if (pixels[start].a < Solid || island[start] != 0) continue;
                label++; int size = 0;
                island[start] = label; queue.Enqueue(start);
                while (queue.Count > 0)
                {
                    int p = queue.Dequeue(); size++;
                    foreach (int n in Neighbours(p, w, h))
                        if (island[n] == 0 && pixels[n].a >= Solid) { island[n] = label; queue.Enqueue(n); }
                }
                if (size > bestSize) { bestSize = size; best = label; }
            }
            if (best == 0) throw new InvalidDataException("Stone source has no solid body.");
            // Grow the body a few pixels through painted (non-residue) pixels: that is its anti-aliased rim.
            int rim = Mathf.Max(2, Mathf.RoundToInt(Mathf.Max(w, h) / 256f));
            var depth = new int[pixels.Length];
            for (int p = 0; p < pixels.Length; p++)
                if (island[p] == best) { depth[p] = 1; queue.Enqueue(p); }
            while (queue.Count > 0)
            {
                int p = queue.Dequeue();
                if (depth[p] > rim) continue;
                foreach (int n in Neighbours(p, w, h))
                    if (depth[n] == 0 && pixels[n].a > Residue) { depth[n] = depth[p] + 1; queue.Enqueue(n); }
            }
            for (int p = 0; p < pixels.Length; p++)
            {
                if (depth[p] == 0) { pixels[p] = new Color32(0, 0, 0, 0); continue; }
                // Remap the rim so the faint outer glow drops out and the edge stays crisp.
                float a = Mathf.InverseLerp(Residue + 40, 235, pixels[p].a);
                pixels[p].a = (byte)Mathf.RoundToInt(Mathf.Clamp01(a) * 255);
            }
        }

        // Rim and empty pixels take the colour of the nearest solid paint, so filtering and the halo
        // of the source never darken or tint the edge.
        internal static void Bleed(Color32[] pixels, int w, int h)
        {
            var done = new bool[pixels.Length];
            var queue = new Queue<int>();
            for (int p = 0; p < pixels.Length; p++)
                if (pixels[p].a >= 250) { done[p] = true; queue.Enqueue(p); }
            while (queue.Count > 0)
            {
                int p = queue.Dequeue();
                foreach (int n in Neighbours(p, w, h))
                {
                    if (done[n]) continue;
                    done[n] = true;
                    pixels[n] = new Color32(pixels[p].r, pixels[p].g, pixels[p].b, pixels[n].a);
                    queue.Enqueue(n);
                }
            }
        }

        // Trims to the painted bounds, scales to the shared area by box filtering and centres the
        // bounds on the canvas.
        internal static Result Fit(Color32[] pixels, int w, int h)
        {
            int minX = w, minY = h, maxX = -1, maxY = -1; double area = 0;
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    byte a = pixels[y * w + x].a;
                    if (a == 0) continue;
                    area += a / 255.0;
                    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
                }
            int bw = maxX - minX + 1, bh = maxY - minY + 1;
            float diameter = Mathf.Sqrt((float)(4 * area / Math.PI));
            float scale = Mathf.Min(VisualDiameter / diameter, MaxExtent / Mathf.Max(bw, bh));
            float cx = (minX + maxX + 1) * .5f, cy = (minY + maxY + 1) * .5f;
            var output = new Color32[Canvas * Canvas];
            double weight = 0, sx = 0, sy = 0, outArea = 0;
            for (int y = 0; y < Canvas; y++)
                for (int x = 0; x < Canvas; x++)
                {
                    // Source footprint of this output pixel.
                    float x0 = cx + (x - Canvas * .5f) / scale, x1 = x0 + 1 / scale;
                    float y0 = cy + (y - Canvas * .5f) / scale, y1 = y0 + 1 / scale;
                    double r = 0, g = 0, b = 0, a = 0, cover = 0;
                    for (int v = Mathf.FloorToInt(y0); v < Mathf.CeilToInt(y1); v++)
                    {
                        float fy = Mathf.Min(y1, v + 1) - Mathf.Max(y0, v);
                        if (fy <= 0) continue;
                        for (int u = Mathf.FloorToInt(x0); u < Mathf.CeilToInt(x1); u++)
                        {
                            float fx = Mathf.Min(x1, u + 1) - Mathf.Max(x0, u);
                            if (fx <= 0) continue;
                            double f = fx * fy; cover += f;
                            if (u < 0 || v < 0 || u >= w || v >= h) continue;
                            var c = pixels[v * w + u];
                            double pa = c.a / 255.0 * f;
                            r += c.r * pa; g += c.g * pa; b += c.b * pa; a += pa;
                        }
                    }
                    if (cover <= 0) continue;
                    double alpha = a / cover;
                    var o = new Color32(0, 0, 0, (byte)Math.Round(alpha * 255));
                    if (a > 0) { o.r = (byte)Math.Round(r / a); o.g = (byte)Math.Round(g / a); o.b = (byte)Math.Round(b / a); }
                    output[y * Canvas + x] = o;
                    weight += alpha; sx += alpha * (x + .5); sy += alpha * (y + .5); outArea += alpha;
                }
            Bleed(output, Canvas, Canvas);
            int half = Mathf.RoundToInt(bw * scale * .5f), halfH = Mathf.RoundToInt(bh * scale * .5f);
            return new Result {
                Pixels = output,
                Centre = new Vector2((float)(sx / weight) - Canvas * .5f, (float)(sy / weight) - Canvas * .5f),
                Area = (float)outArea,
                Bounds = new RectInt(Canvas / 2 - half, Canvas / 2 - halfH, half * 2, halfH * 2)
            };
        }

        private static IEnumerable<int> Neighbours(int p, int w, int h)
        {
            int x = p % w, y = p / w;
            if (x > 0) yield return p - 1;
            if (x < w - 1) yield return p + 1;
            if (y > 0) yield return p - w;
            if (y < h - 1) yield return p + w;
        }
    }
}
