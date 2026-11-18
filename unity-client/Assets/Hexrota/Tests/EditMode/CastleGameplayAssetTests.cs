using System.Linq;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEditor;
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
            foreach (string field in new[] { "StageTag", "LevelTitle", "Moves", "Counters", "GroundCount" })
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
        }

        [Test]
        public void GameplayToolsAndBoardTrayKeepArtworkSeparateFromActionsAndLabels()
        {
            var tools = Resources.Load<GameObject>("CastleGame/CastleGameTools");
            var tray = Resources.Load<GameObject>("CastleGame/CastleBoardTray");
            Assert.That(tools, Is.Not.Null);
            Assert.That(tray, Is.Not.Null);
            var bag = tools.transform.Find("DockRegion/CampaignControls/Footer/Çanta");
            Assert.That(bag.GetComponent("Button"), Is.Not.Null);
            Assert.That(bag.Find("Label").GetComponent("Text"), Is.Not.Null);
            AssertSprite(bag.Find("Medallion/Icon"), "GreenBrush");
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
        public void ActiveCatalogResolvesEditableBoardWrappersAndTheirImportedModels()
        {
            const string path = "Assets/Hexrota/Art/HexrotaAssets.asset";
            var catalog = AssetDatabase.LoadAssetAtPath<HexrotaAssetCatalog>(path);
            Assert.That(catalog, Is.Not.Null);
            Assert.That(catalog.stone.GetComponentInChildren<TextMesh>(true), Is.Not.Null,
                "Artists can edit the number separately from the stone mesh.");
            foreach (var wrapper in new[] { catalog.cell, catalog.stone, catalog.ground })
            {
                Assert.That(PrefabUtility.GetPrefabAssetType(wrapper), Is.EqualTo(PrefabAssetType.Regular));
                foreach (var node in wrapper.GetComponentsInChildren<Transform>(true))
                    Assert.That(GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(node.gameObject), Is.Zero, node.name);
            }
            AssertVariants(catalog.stone, new[] { "HexStone_01_Purple", "HexStone_02_Yellow", "HexStone_03_LightRed",
                "HexStone_04_Turquoise", "HexStone_05_Orange" });
            AssertVariants(catalog.ground, new[] { "HexFloor_Soil", "HexFloor_Partial", "HexFloor_Green" });
        }

        private static void AssertVariants(GameObject wrapper, string[] expected)
        {
            var tile = wrapper.GetComponentInChildren<CastleBoardTile>(true);
            Assert.That(tile, Is.Not.Null, wrapper.name);
            var variants = new SerializedObject(tile).FindProperty("variants");
            Assert.That(variants.arraySize, Is.EqualTo(expected.Length));
            for (int i = 0; i < expected.Length; i++)
            {
                var slot = variants.GetArrayElementAtIndex(i);
                var mesh = slot.FindPropertyRelative("mesh").objectReferenceValue as Mesh;
                var material = slot.FindPropertyRelative("material").objectReferenceValue as Material;
                Assert.That(mesh, Is.Not.Null, expected[i]);
                Assert.That(mesh.vertexCount, Is.Positive, expected[i]);
                Assert.That(AssetDatabase.GetAssetPath(mesh), Does.EndWith("/" + expected[i] + ".fbx"));
                Assert.That(material, Is.Not.Null, expected[i]);
                Assert.That(AssetDatabase.GetAssetPath(material.mainTexture), Does.EndWith("/" + expected[i] + "_BaseColor.png"));
            }
        }
    }
}
