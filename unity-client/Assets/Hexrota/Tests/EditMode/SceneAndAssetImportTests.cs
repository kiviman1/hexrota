using System.Linq;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEditor;
using UnityEditor.SceneManagement;
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

        [Test] public void CastleHomeStoresEditableControlsLabelsAndSeparateEnvironmentArt()
        {
            var home = Resources.Load<GameObject>("CastleHome/CastleHome");
            Assert.That(home, Is.Not.Null);
            Assert.That(PrefabUtility.IsPartOfPrefabAsset(home), Is.True);
            var view = home.GetComponent<CastleHomeView>();
            Assert.That(view, Is.Not.Null);
            var serialized = new SerializedObject(view);
            foreach (var field in new[] { "playButton", "lifeButton", "settingsButton", "journeyButton",
                "gardenButton", "recordsButton", "goldValue", "livesValue", "lifeStatus", "stageLabel" })
            {
                var property = serialized.FindProperty(field);
                Assert.That(property, Is.Not.Null, field);
                var control = property.objectReferenceValue as Component;
                Assert.That(control, Is.Not.Null, field);
                Assert.That(control.transform.IsChildOf(home.transform), Is.True, field);
            }

            var environment = home.transform.Find("MenuLayout/Environment");
            Assert.That(environment, Is.Not.Null);
            foreach (var layer in new[] { "Background", "Coop" })
            {
                var slot = environment.Find(layer);
                Assert.That(slot, Is.Not.Null, layer);
                Assert.That(slot.GetComponent("Image"), Is.Not.Null, layer + " must be replaceable separately.");
            }
            foreach (var node in home.GetComponentsInChildren<Transform>(true))
                Assert.That(GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(node.gameObject), Is.Zero, node.name);
        }

        [Test] public void FirstPlayableExposesTheHomePrefabInItsSafeAreaBeforePlay()
        {
            var scene = EditorSceneManager.OpenPreviewScene("Assets/Hexrota/Scenes/FirstPlayable.unity");
            try
            {
                var controller = scene.GetRootGameObjects()
                    .SelectMany(root => root.GetComponentsInChildren<FirstPlayableController>()).Single();
                var serialized = new SerializedObject(controller);
                var home = serialized.FindProperty("castleHome").objectReferenceValue as CastleHomeView;
                var safe = serialized.FindProperty("safe").objectReferenceValue as RectTransform;
                Assert.That(home, Is.Not.Null);
                Assert.That(safe, Is.Not.Null);
                Assert.That(home.gameObject.activeInHierarchy, Is.True);
                Assert.That(home.transform.IsChildOf(safe), Is.True);
                Assert.That(PrefabUtility.GetCorrespondingObjectFromSource(home.gameObject),
                    Is.EqualTo(Resources.Load<GameObject>("CastleHome/CastleHome")));
            }
            finally
            {
                EditorSceneManager.ClosePreviewScene(scene);
            }
        }

        [Test] public void EveryVisualSlotReferencesARealPrefabWithNoMissingScripts()
        {
            var catalog = AssetDatabase.LoadAssetAtPath<HexrotaAssetCatalog>("Assets/Hexrota/Art/HexrotaAssets.asset");
            Assert.That(catalog, Is.Not.Null);
            Assert.That(catalog.usesPlaceholderArt, Is.True, "9.11 ships clearly marked temporary art.");
            var prefabs = new[] { catalog.cell, catalog.ground, catalog.selectionEffect,
                catalog.matchEffect, catalog.fallEffect, catalog.clearEffect, catalog.tavik,
                catalog.environment, catalog.gardenObject, catalog.menuVisual, catalog.uiVisual };
            Assert.That(prefabs.Length, Is.EqualTo(11));
            // Stones are 2D sprites (Hexrota/Art/Import Stones), not prefabs.
            Assert.That(catalog.stoneSprites, Has.Length.EqualTo(5).And.All.Not.Null);
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
