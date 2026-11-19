using System.Linq;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    // The 3D coop levels exported by art/coop-3d/process_tripo.py (CP_L0 foundation .. CP_L4).
    public sealed class CoopModelImportTests
    {
        private const string Folder = "Assets/Hexrota/Art/3D/Coop/";
        private static readonly int[] Budgets = { 2000, 5000, 7000, 9000, 15000 };

        [Test]
        public void EveryLevelStaysInItsTriangleBudgetWithOneMaterialAndA2048Texture([Values(0, 1, 2, 3, 4)] int level)
        {
            string name = "CP_L" + level;
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(Folder + name + ".fbx");
            Assert.That(model, Is.Not.Null, name + ".fbx");
            var meshes = model.GetComponentsInChildren<MeshFilter>(true).Select(f => f.sharedMesh).ToArray();
            Assert.That(meshes, Has.Length.EqualTo(1), "One mesh per level.");
            int triangles = meshes.Sum(mesh => Enumerable.Range(0, mesh.subMeshCount).Sum(i => (int)mesh.GetIndexCount(i)) / 3);
            Assert.That(triangles, Is.GreaterThan(0).And.LessThanOrEqualTo(Budgets[level]), name + " triangles");
            Assert.That(meshes[0].subMeshCount, Is.EqualTo(1), "One material slot.");

            var importer = (ModelImporter)AssetImporter.GetAtPath(Folder + name + ".fbx");
            Assert.That(importer.materialImportMode, Is.EqualTo(ModelImporterMaterialImportMode.None),
                "The model brings no materials; the coop view assigns the unlit one.");
            Assert.That(importer.importAnimation, Is.False);

            var material = AssetDatabase.LoadAssetAtPath<Material>(Folder + name + ".mat");
            Assert.That(material, Is.Not.Null, name + ".mat");
            Assert.That(material.shader.name, Is.EqualTo("Hexrota/Stylized Lit"));
            Assert.That(importer.importNormals, Is.EqualTo(ModelImporterNormals.Calculate), "The lit shader needs normals.");
            var texture = material.mainTexture as Texture2D;
            Assert.That(texture, Is.Not.Null);
            Assert.That(texture.width, Is.EqualTo(2048));
            Assert.That(texture.height, Is.EqualTo(2048));
            Assert.That(texture.mipmapCount, Is.GreaterThan(1), "A 3D model needs mipmaps.");
            var textureImporter = (TextureImporter)AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(texture));
            Assert.That(textureImporter.maxTextureSize, Is.EqualTo(2048));
            Assert.That(textureImporter.mipmapEnabled, Is.True);
            Assert.That(textureImporter.sRGBTexture, Is.True, "Albedo is sRGB.");
            Assert.That(textureImporter.GetPlatformTextureSettings("Android").format, Is.EqualTo(TextureImporterFormat.ASTC_6x6));
        }

        [Test]
        public void EveryLevelStandsOnTheSameGroundCentre([Values(0, 1, 2, 3, 4)] int level)
        {
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(Folder + "CP_L" + level + ".fbx");
            var bounds = model.GetComponentInChildren<MeshFilter>().sharedMesh.bounds;
            var root = model.GetComponentInChildren<MeshFilter>().transform;
            Assert.That(root.localScale, Is.EqualTo(Vector3.one), "Metres, no import scale.");
            Assert.That(bounds.min.y, Is.EqualTo(0).Within(.07f), "The base disk is gone; the model stands on y = 0.");
            Assert.That(bounds.center.x, Is.EqualTo(0).Within(.05f), "Pivot at the ground centre.");
            Assert.That(bounds.center.z, Is.EqualTo(0).Within(.05f));
            Assert.That(bounds.size.x, Is.InRange(.8f, 1.05f), "About one metre wide.");
        }
    }
}
