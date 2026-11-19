using System;
using System.Linq;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    public sealed class ChickenRigImportTests
    {
        private const string Path = "Assets/Hexrota/Art/Chicken3D/ChickenRig.fbx";

        [Test]
        public void ImportedChickenContainsSkinnedMeshBonesAndThreeAnimatedClips()
        {
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(Path);
            Assert.That(model, Is.Not.Null, "FBX must import as a model asset.");
            var skin = model.GetComponentsInChildren<SkinnedMeshRenderer>(true).SingleOrDefault();
            Assert.That(skin, Is.Not.Null, "A bone-driven skinned mesh is required.");
            Assert.That(skin.sharedMesh, Is.Not.Null);
            Assert.That(skin.sharedMesh.vertexCount, Is.InRange(1, 5000));
            Assert.That(skin.bones.Count(bone => bone != null), Is.GreaterThanOrEqualTo(6));
            var clips = AssetDatabase.LoadAllAssetsAtPath(Path).OfType<AnimationClip>()
                .Where(clip => !clip.name.StartsWith("__preview__", StringComparison.Ordinal)).ToArray();
            foreach (string name in new[] { "Idle", "Walk", "Flap" })
            {
                var clip = clips.SingleOrDefault(item => item.name.EndsWith(name, StringComparison.OrdinalIgnoreCase));
                Assert.That(clip, Is.Not.Null, name + " must be imported independently.");
                Assert.That(clip.length, Is.GreaterThan(.5f), name);
                var animatedBones = AnimationUtility.GetCurveBindings(clip)
                    .Where(binding => binding.type == typeof(Transform))
                    .Select(binding => binding.path).Distinct().ToArray();
                Assert.That(animatedBones, Is.Not.Empty, name + " must contain bone animation curves.");
            }
        }
    }
}
