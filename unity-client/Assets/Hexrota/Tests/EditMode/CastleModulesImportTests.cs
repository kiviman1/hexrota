using System.Linq;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    public sealed class CastleModulesImportTests
    {
        [Test]
        public void FbxContainsIndependentCastleModulesAndBoundedGeometry()
        {
            const string path = "Assets/Hexrota/Art/Castle3D/CastleModules.fbx";
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            Assert.That(model, Is.Not.Null);
            var parts = model.GetComponentsInChildren<MeshFilter>(true);
            Assert.That(parts.Length, Is.GreaterThanOrEqualTo(30));
            foreach (string name in new[] { "Keep_MainWall", "Entrance_Door", "Tower_Left_Wall", "Tower_Left_Roof", "Tower_Center_Wall", "Tower_Center_Roof", "Tower_Right_Wall", "Tower_Right_Roof" })
                Assert.That(parts.Any(part => part.name.StartsWith(name)), Is.True, name + " must remain separately editable.");
            Assert.That(parts.All(part => part.sharedMesh != null), Is.True);
            int triangles = parts.Sum(part => (int)(part.sharedMesh.GetIndexCount(0) / 3));
            Assert.That(triangles, Is.InRange(1, 12000));
        }
    }
}
