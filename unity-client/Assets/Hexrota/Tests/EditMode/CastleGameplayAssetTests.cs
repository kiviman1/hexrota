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
        public void LoadingFieldGuideProvidesAnEditableIllustrationForEachTip()
        {
            var prefab = Resources.Load<GameObject>("CastleGame/ChapterLoading");
            Assert.That(PrefabUtility.IsPartOfPrefabAsset(prefab), Is.True);
            var guide = new SerializedObject(prefab.GetComponent<ChapterLoadingView>());
            var tips = guide.FindProperty("tips");
            Assert.That(tips.arraySize, Is.GreaterThan(1));
            for (int i = 0; i < tips.arraySize; i++)
            {
                var tip = tips.GetArrayElementAtIndex(i);
                Assert.That(tip.FindPropertyRelative("heading").stringValue, Is.Not.Empty);
                Assert.That(tip.FindPropertyRelative("body").stringValue, Is.Not.Empty);
                var diagram = tip.FindPropertyRelative("diagram").objectReferenceValue as GameObject;
                Assert.That(diagram, Is.Not.Null);
                Assert.That(diagram.transform.childCount, Is.Positive);
            }
            Assert.That(prefab.GetComponent<CanvasGroup>().blocksRaycasts, Is.True);
            var landscape = prefab.transform.Find("CastleLandscape");
            AssertSprite(landscape, "foundation_0");
            Assert.That(landscape.GetComponent<UnityEngine.UI.Image>().raycastTarget, Is.True);
            Assert.That(landscape.GetComponent<CastleHomeBackdrop>(), Is.Not.Null);
            var backdrops = guide.FindProperty("coopStages");
            Assert.That(Enumerable.Range(0, backdrops.arraySize).Select(i =>
                backdrops.GetArrayElementAtIndex(i).objectReferenceValue.name),
                Is.EqualTo(new[] { "foundation_0", "frame_0", "finished_0" }));
            var card = prefab.transform.Find("SafeContent/TipCard");
            AssertSprite(card.Find("GildedTitleCrest"), "CrestBanner");
            var tavik = card.Find("IllustrationFrame/InlaidEnamel/TavikPoints").GetComponent<UnityEngine.UI.RawImage>();
            Assert.That(tavik.texture.name, Is.EqualTo("point"));
            Assert.That(tavik.uvRect, Is.EqualTo(new Rect(0, 0, 1, 1)));
            Assert.That(guide.FindProperty("progressFill").objectReferenceValue, Is.EqualTo(
                card.Find("LoadingStatus/LoadingTrack/TrackInterior/GreenProgress")));

            var digits = prefab.GetComponentsInChildren<UnityEngine.UI.Text>(true).Where(label => label.name == "Digit").ToArray();
            Assert.That(digits.Select(label => label.text), Is.EquivalentTo(new[] { "2", "2", "2", "4", "4", "4" }));
            foreach (var digit in digits)
            {
                AssertSprite(digit.transform.parent, digit.text == "2" ? "TipStone_02_Yellow" : "TipStone_04_Turquoise");
                Assert.That(digit.GetComponent<UnityEngine.UI.Outline>(), Is.Not.Null);
            }
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
        public void FiveBlankStoneModelsKeepTheirReliefAndHaveNoDigitMesh()
        {
            const string folder = "Assets/Hexrota/Art/CastleBoard/Models/Blank/";
            foreach (string variant in new[] { "01_Purple", "02_Yellow", "03_LightRed", "04_Turquoise", "05_Orange" })
            {
                var model = AssetDatabase.LoadAssetAtPath<GameObject>(folder + "HX_Stone_" + variant + "_ToneRelief_Blank.fbx");
                Assert.That(model, Is.Not.Null, variant);
                var meshes = model.GetComponentsInChildren<MeshFilter>(true).Select(part => part.sharedMesh.name).ToArray();
                Assert.That(meshes.Any(name => name.Contains("ToneRelief")), Is.True, variant);
                Assert.That(meshes.Any(name => name.EndsWith("_Body")), Is.True, variant);
                Assert.That(meshes.Any(name => name.Contains("_Digit_")), Is.False, variant);
            }
        }

        [Test]
        public void ActiveCatalogResolvesEditableBoardWrappersAndTheirImportedModels()
        {
            const string path = "Assets/Hexrota/Art/HexrotaAssets.asset";
            var catalog = AssetDatabase.LoadAssetAtPath<HexrotaAssetCatalog>(path);
            Assert.That(catalog, Is.Not.Null);
            Assert.That(catalog.stone.GetComponentInChildren<TextMesh>(true), Is.Null,
                "The sculpted numeral must not receive a second text label.");
            foreach (var wrapper in new[] { catalog.cell, catalog.stone, catalog.ground })
            {
                Assert.That(PrefabUtility.GetPrefabAssetType(wrapper), Is.EqualTo(PrefabAssetType.Regular));
                foreach (var node in wrapper.GetComponentsInChildren<Transform>(true))
                    Assert.That(GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(node.gameObject), Is.Zero, node.name);
            }
            AssertVariants(catalog.stone, new[] { "HexStone_01_Purple", "HexStone_02_Yellow", "HexStone_03_LightRed",
                "HexStone_04_Turquoise", "HexStone_05_Orange" }, true);
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
