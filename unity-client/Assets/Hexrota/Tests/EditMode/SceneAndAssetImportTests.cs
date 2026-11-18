using System.Linq;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    public sealed class SceneAndAssetImportTests
    {
        [Test] public void BuildEntrySceneIsImportedAndEnabled()
        {
            const string path = "Assets/Hexrota/Scenes/FirstPlayable.unity";
            Assert.That(AssetDatabase.LoadAssetAtPath<SceneAsset>(path), Is.Not.Null);
            Assert.That(EditorBuildSettings.scenes.Any(scene => scene.enabled && scene.path == path), Is.True);
        }
        [Test] public void EveryVisualSlotReferencesARealPrefabWithNoMissingScripts()
        {
            var catalog = AssetDatabase.LoadAssetAtPath<HexrotaAssetCatalog>("Assets/Hexrota/Art/HexrotaAssets.asset");
            Assert.That(catalog, Is.Not.Null);
            Assert.That(catalog.usesPlaceholderArt, Is.True, "9.11 ships clearly marked temporary art.");
            var prefabs = new[] { catalog.cell, catalog.ground, catalog.stone, catalog.selectionEffect,
                catalog.matchEffect, catalog.fallEffect, catalog.clearEffect, catalog.tavik,
                catalog.environment, catalog.gardenObject, catalog.menuVisual, catalog.uiVisual };
            Assert.That(prefabs.Length, Is.EqualTo(12));
            foreach (var prefab in prefabs)
            {
                Assert.That(prefab, Is.Not.Null, "All Blender replacement slots must be connected.");
                Assert.That(PrefabUtility.IsPartOfPrefabAsset(prefab), Is.True, prefab.name);
                foreach (var component in prefab.GetComponentsInChildren<Transform>(true))
                    Assert.That(GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(component.gameObject),
                        Is.Zero, prefab.name + "/" + component.name);
                Assert.That(prefab.GetComponentsInChildren<Renderer>(true), Is.Not.Empty, prefab.name);
                foreach (var renderer in prefab.GetComponentsInChildren<Renderer>(true))
                foreach (var material in renderer.sharedMaterials)
                {
                    Assert.That(material, Is.Not.Null, prefab.name);
                    Assert.That(material.shader, Is.Not.Null, prefab.name);
                    Assert.That(material.shader.name, Is.Not.EqualTo("Hidden/InternalErrorShader"), prefab.name);
                }
            }
        }
    }
}
