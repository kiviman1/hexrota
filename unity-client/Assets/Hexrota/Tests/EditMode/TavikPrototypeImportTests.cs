using System;
using System.Linq;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    public sealed class TavikPrototypeImportTests
    {
        private const string Path = "Assets/Hexrota/Art/Tavik3D/TavikPrototype.fbx";

        [Test]
        public void ImportedTavikHasItsOwnRigMeshAndThreeWorkingClips()
        {
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(Path);
            Assert.That(model, Is.Not.Null, "Tavik's FBX must import as a model asset.");
            var skin = model.GetComponentsInChildren<SkinnedMeshRenderer>(true).SingleOrDefault();
            Assert.That(skin, Is.Not.Null, "The Tavik mesh must be driven by its armature.");
            Assert.That(skin.sharedMesh, Is.Not.Null);
            // This explorer prototype has additional geometry for goggles, backpack and scarf.
            Assert.That(skin.sharedMesh.vertexCount, Is.InRange(5000, 15000));
            var triangleCount = Enumerable.Range(0, skin.sharedMesh.subMeshCount)
                .Sum(index => (long)skin.sharedMesh.GetIndexCount(index) / 3);
            Assert.That(triangleCount, Is.InRange(10000L, 18000L));
            Assert.That(skin.bones.Count(bone => bone != null), Is.GreaterThanOrEqualTo(7));

            var clips = AssetDatabase.LoadAllAssetsAtPath(Path).OfType<AnimationClip>()
                .Where(clip => !clip.name.StartsWith("__preview__", StringComparison.Ordinal)).ToArray();
            foreach (var pair in new[] { (Name: "Idle", Bone: "Head"), (Name: "Walk", Bone: "LegL"), (Name: "Flap", Bone: "WingL") })
            {
                var clip = clips.SingleOrDefault(item => item.name.EndsWith(pair.Name, StringComparison.OrdinalIgnoreCase));
                Assert.That(clip, Is.Not.Null, pair.Name + " must import as a separate clip.");
                Assert.That(clip.length, Is.GreaterThan(.5f), pair.Name);
                var animated = AnimationUtility.GetCurveBindings(clip)
                    .Where(binding => binding.type == typeof(Transform) &&
                        binding.path.Replace(".", "").Replace("_", "").EndsWith(pair.Bone, StringComparison.OrdinalIgnoreCase))
                    .Select(binding => AnimationUtility.GetEditorCurve(clip, binding))
                    .Where(curve => curve != null && curve.length > 1)
                    .Any(curve => curve.keys.Max(key => key.value) - curve.keys.Min(key => key.value) > .01f);
                Assert.That(animated, Is.True, pair.Name + " must actually animate " + pair.Bone + ".");
            }
        }
    }
}
