using System;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClient.Editor
{
    // Import settings and materials for the 3D coop levels exported by art/coop-3d/process_tripo.py.
    // The models carry no materials of their own: each level gets one "Hexrota/Stylized Lit" material
    // with its 2048 x 2048 albedo, which the coop view assigns at runtime; CoopLook tunes the lighting.
    public static class CoopModelAssets
    {
        public const string Folder = "Assets/Hexrota/Art/3D/Coop/";
        private const string Shaders = "Assets/Hexrota/Art/3D/Shaders/";
        public const int Levels = 5;
        public const int TextureSize = 2048;
        public const string LookPath = "Assets/Hexrota/Presentation/Theme/CoopLook.asset";
        /// <summary>Triangle budget per level (CP_L0 foundation .. CP_L4).</summary>
        public static readonly int[] Budgets = { 2000, 5000, 7000, 9000, 15000 };

        public sealed class Set
        {
            public GameObject[] Levels;
            public Material[] Materials;
            public Material ShadowMaterial, ViewMaterial;
            public Presentation.CoopLook Look;
        }

        public static string ModelPath(int level) => Folder + "CP_L" + level + ".fbx";
        public static string TexturePath(int level) => Folder + "CP_L" + level + "_basecolor.png";
        public static string MaterialPath(int level) => Folder + "CP_L" + level + ".mat";

        [MenuItem("Hexrota/Home/Reimport 3D Coop Models")]
        private static void Reimport() => Prepare();

        public static Set Prepare()
        {
            var lit = Load<Shader>(Shaders + "StylizedLit.shader");
            var set = new Set { Levels = new GameObject[Levels], Materials = new Material[Levels] };
            for (int level = 0; level < Levels; level++)
            {
                ConfigureModel(ModelPath(level));
                var texture = ConfigureTexture(TexturePath(level));
                var material = AssetDatabase.LoadAssetAtPath<Material>(MaterialPath(level));
                if (material == null)
                {
                    material = new Material(lit);
                    AssetDatabase.CreateAsset(material, MaterialPath(level));
                }
                material.shader = lit;
                material.mainTexture = texture;
                EditorUtility.SetDirty(material);
                set.Materials[level] = material;
                set.Levels[level] = Load<GameObject>(ModelPath(level));
            }
            set.ShadowMaterial = MaterialFor(Folder + "CoopBlobShadow.mat", Load<Shader>(Shaders + "BlobShadow.shader"));
            set.ViewMaterial = MaterialFor(Folder + "CoopView.mat", Load<Shader>(Shaders + "UIPremultiplied.shader"));
            set.Look = AssetDatabase.LoadAssetAtPath<Presentation.CoopLook>(LookPath);
            if (set.Look == null)
            {
                set.Look = ScriptableObject.CreateInstance<Presentation.CoopLook>();
                AssetDatabase.CreateAsset(set.Look, LookPath);
            }
            AssetDatabase.SaveAssets();
            return set;
        }

        private static void ConfigureModel(string path)
        {
            var importer = AssetImporter.GetAtPath(path) as ModelImporter;
            if (importer == null) throw new InvalidOperationException("Missing coop model " + path);
            importer.globalScale = 1;
            importer.useFileScale = true;
            importer.bakeAxisConversion = true;
            importer.materialImportMode = ModelImporterMaterialImportMode.None;
            importer.importAnimation = false;
            importer.animationType = ModelImporterAnimationType.None;
            importer.importCameras = false;
            importer.importLights = false;
            importer.importBlendShapes = false;
            importer.isReadable = false;
            importer.meshCompression = ModelImporterMeshCompression.Off;
            // The stylised lit shader needs smooth normals; the Tripo export carries flat ones.
            importer.importNormals = ModelImporterNormals.Calculate;
            importer.normalSmoothingAngle = 60;
            importer.importTangents = ModelImporterTangents.None;
            importer.SaveAndReimport();
        }

        private static Texture2D ConfigureTexture(string path)
        {
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;
            if (importer == null) throw new InvalidOperationException("Missing coop texture " + path);
            importer.textureType = TextureImporterType.Default;
            importer.sRGBTexture = true;
            importer.mipmapEnabled = true;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.filterMode = FilterMode.Trilinear;
            importer.anisoLevel = 4;
            importer.maxTextureSize = TextureSize;
            importer.textureCompression = TextureImporterCompression.CompressedHQ;
            foreach (var platform in new[] { "Android", "iPhone" })
            {
                var settings = importer.GetPlatformTextureSettings(platform);
                settings.overridden = true;
                settings.maxTextureSize = TextureSize;
                settings.format = TextureImporterFormat.ASTC_6x6;
                importer.SetPlatformTextureSettings(settings);
            }
            importer.SaveAndReimport();
            return Load<Texture2D>(path);
        }

        private static Material MaterialFor(string path, Shader shader)
        {
            var material = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (material == null)
            {
                material = new Material(shader);
                AssetDatabase.CreateAsset(material, path);
            }
            material.shader = shader;
            EditorUtility.SetDirty(material);
            return material;
        }

        private static T Load<T>(string path) where T : UnityEngine.Object
        {
            var asset = AssetDatabase.LoadAssetAtPath<T>(path);
            if (asset == null) throw new InvalidOperationException("Missing " + path);
            return asset;
        }
    }
}
