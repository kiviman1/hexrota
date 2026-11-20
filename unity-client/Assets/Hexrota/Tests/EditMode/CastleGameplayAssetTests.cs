using System.Linq;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEditor;
using UnityEditor.AssetImporters;
using UnityEngine;

namespace Hexrota.UnityClientTests
{
    public sealed class CastleGameplayAssetTests
    {
        [Test]
        public void HudPrefabKeepsGoalArtAndEditableTextOnSeparateObjects()
        {
            var hud = Resources.Load<GameObject>("CastleGame/CastleHud");
            Assert.That(hud, Is.Not.Null);
            Assert.That(PrefabUtility.IsPartOfPrefabAsset(hud), Is.True);
            var nodes = hud.GetComponentsInChildren<Transform>(true);
            Assert.That(nodes.Any(node => node.name == "StageTag" || node.name == "LevelTitle"), Is.False);
            foreach (string field in new[] { "Moves", "Counters", "GroundCount" })
            {
                var node = nodes.Single(item => item.name == field);
                Assert.That(node.GetComponent("Text"), Is.Not.Null, field);
                Assert.That(node.GetComponent("Image"), Is.Null, field);
            }
            foreach (string field in new[] { "ScoreIcon", "GroundIcon" })
            {
                var node = nodes.Single(item => item.name == field);
                var image = node.GetComponent("Image");
                Assert.That(image, Is.Not.Null, field);
                Assert.That(new SerializedObject(image).FindProperty("m_Sprite").objectReferenceValue,
                    Is.TypeOf<Sprite>(), field);
                Assert.That(node.GetComponent("Text"), Is.Null, field);
            }
            var portrait = nodes.Single(node => node.name == "TavikPortrait").GetComponent<UnityEngine.UI.RawImage>();
            Assert.That(portrait.texture, Is.Not.Null);
            Assert.That(portrait.raycastTarget, Is.False);
            var settings = hud.GetComponentsInChildren<UnityEngine.UI.Button>(true).Single();
            Assert.That(settings.name, Is.EqualTo("Ayarlar"));
            var gear = settings.transform.Find("SettingsIcon").GetComponent<UnityEngine.UI.RawImage>();
            Assert.That(gear.texture, Is.Not.Null);
            Assert.That(gear.raycastTarget, Is.False);
        }

        [Test]
        public void ChapterLoadingPrefabReimportsWithoutErrors()
        {
            const string path = "Assets/Hexrota/Resources/CastleGame/ChapterLoading.prefab";
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
            var log = AssetImporter.GetImportLog(path);
            if (log != null)
            {
                var errors = log.logEntries.Where(entry => (entry.flags & ImportLogFlags.Error) != 0);
                Assert.That(errors.Select(entry => entry.message), Is.Empty, path);
            }
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            Assert.That(PrefabUtility.GetPrefabAssetType(prefab), Is.EqualTo(PrefabAssetType.Regular));
        }

        [Test]
        public void LoadingPrefabContainsOnlyTheBackdropAndEditableCenteredLabel()
        {
            var prefab = Resources.Load<GameObject>("CastleGame/ChapterLoading");
            Assert.That(PrefabUtility.IsPartOfPrefabAsset(prefab), Is.True);
            var loading = new SerializedObject(prefab.GetComponent<ChapterLoadingView>());
            Assert.That(prefab.GetComponent<CanvasGroup>().blocksRaycasts, Is.True);
            var landscape = prefab.transform.Find("CastleLandscape");
            AssertSprite(landscape, "foundation_0");
            Assert.That(landscape.GetComponent<UnityEngine.UI.Image>().raycastTarget, Is.True);
            Assert.That(landscape.GetComponent<CastleHomeBackdrop>(), Is.Not.Null);
            var backdrops = loading.FindProperty("coopStages");
            Assert.That(Enumerable.Range(0, backdrops.arraySize).Select(i =>
                backdrops.GetArrayElementAtIndex(i).objectReferenceValue.name),
                Is.EqualTo(new[] { "foundation_0", "frame_0", "finished_0" }));
            Assert.That(prefab.transform.childCount, Is.EqualTo(2));
            var label = prefab.GetComponentsInChildren<UnityEngine.UI.Text>(true).Single();
            Assert.That(loading.FindProperty("loadingLabel").objectReferenceValue, Is.SameAs(label));
            Assert.That(label.text, Is.EqualTo("Yükleniyor…"));
            Assert.That(label.gameObject.activeSelf, Is.False);
            Assert.That(label.alignment, Is.EqualTo(TextAnchor.MiddleCenter));
            Assert.That(label.rectTransform.anchoredPosition, Is.EqualTo(Vector2.zero));
        }

        [Test]
        public void GameplayToolsAndBoardTrayKeepArtworkSeparateFromActionsAndLabels()
        {
            var tools = Resources.Load<GameObject>("CastleGame/CastleGameTools");
            var tray = Resources.Load<GameObject>("CastleGame/CastleBoardTray");
            Assert.That(tools, Is.Not.Null);
            Assert.That(tray, Is.Not.Null);
            var buttons = tools.GetComponentsInChildren<UnityEngine.UI.Button>(true);
            Assert.That(buttons.Select(button => button.name), Is.EquivalentTo(new[] { "Geç", "Devam et" }));
            Assert.That(tools.transform.Find("DockRegion"), Is.Null);
            Assert.That(tools.transform.Find("TavikPosition"), Is.Null);
            AssertSprite(tools.transform.Find("GestureRegion/GuidePosition/GuideGlove"), "GuideGlove");
            var pieces = tray.GetComponentsInChildren<Transform>(true);
            foreach (string layer in new[] { "AntiqueGoldRim", "RoyalFelt", "WovenDiamonds" })
            {
                var node = pieces.Single(child => child.name == layer);
                var image = node.GetComponent("Image");
                Assert.That(image, Is.Not.Null, layer);
                Assert.That(new SerializedObject(image).FindProperty("m_RaycastTarget").boolValue, Is.False, layer);
            }
        }

        private static void AssertSprite(Transform node, string expected)
        {
            Assert.That(node, Is.Not.Null, expected);
            var image = node.GetComponent("Image");
            Assert.That(image, Is.Not.Null, expected);
            var sprite = new SerializedObject(image).FindProperty("m_Sprite").objectReferenceValue as Sprite;
            Assert.That(sprite, Is.Not.Null, expected);
            Assert.That(sprite.name, Is.EqualTo(expected));
        }

        [Test]
        public void ActiveCatalogResolvesEditableFloorWrappersAndTheirImportedModels()
        {
            const string path = "Assets/Hexrota/Art/HexrotaAssets.asset";
            var catalog = AssetDatabase.LoadAssetAtPath<HexrotaAssetCatalog>(path);
            Assert.That(catalog, Is.Not.Null);
            foreach (var wrapper in new[] { catalog.cell, catalog.ground })
            {
                Assert.That(PrefabUtility.GetPrefabAssetType(wrapper), Is.EqualTo(PrefabAssetType.Regular));
                foreach (var node in wrapper.GetComponentsInChildren<Transform>(true))
                    Assert.That(GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(node.gameObject), Is.Zero, node.name);
            }
            AssertVariants(catalog.ground, new[] { "HexFloor_Soil", "HexFloor_Partial", "HexFloor_Green" }, false);
        }

        private static void AssertVariants(GameObject wrapper, string[] expected, bool sculptedNumbers)
        {
            var tile = wrapper.GetComponentInChildren<CastleBoardTile>(true);
            Assert.That(tile, Is.Not.Null, wrapper.name);
            var serialized = new SerializedObject(tile);
            Assert.That(serialized.FindProperty("numberInMesh").boolValue, Is.EqualTo(sculptedNumbers));
            var variants = serialized.FindProperty("variants");
            Assert.That(variants.arraySize, Is.EqualTo(expected.Length));
            for (int i = 0; i < expected.Length; i++)
            {
                var slot = variants.GetArrayElementAtIndex(i);
                var mesh = slot.FindPropertyRelative("mesh").objectReferenceValue as Mesh;
                var material = slot.FindPropertyRelative("material").objectReferenceValue as Material;
                Assert.That(mesh, Is.Not.Null, expected[i]);
                Assert.That(mesh.vertexCount, Is.Positive, expected[i]);
                string modelPath = AssetDatabase.GetAssetPath(mesh);
                Assert.That(modelPath, Does.EndWith("/" + expected[i] + ".fbx"));
                Assert.That(material, Is.Not.Null, expected[i]);
                if (sculptedNumbers)
                {
                    Assert.That(mesh.name, Is.EqualTo("ToneRelief_" + (i + 1)));
                    Assert.That(mesh.subMeshCount, Is.EqualTo(1));
                    Assert.That(material.GetFloat("_VertexPigment"), Is.EqualTo(1));
                    var parts = AssetDatabase.LoadAssetAtPath<GameObject>(modelPath).GetComponentsInChildren<MeshRenderer>();
                    Assert.That(parts.Any(part => part.name.EndsWith("Digit_" + (i + 1) + "_Face")), Is.True);
                    Assert.That(parts.Any(part => part.name.EndsWith("Digit_" + (i + 1) + "_Outline")), Is.True);
                    var bakedColors = mesh.colors32.Distinct().ToArray();
                    foreach (var pigment in parts.SelectMany(part => part.sharedMaterials))
                        CollectionAssert.Contains(bakedColors, (Color32)pigment.color, pigment.name);
                }
                else
                    Assert.That(AssetDatabase.GetAssetPath(material.mainTexture), Does.EndWith("/" + expected[i] + "_BaseColor.png"));
            }
        }
    }
}
