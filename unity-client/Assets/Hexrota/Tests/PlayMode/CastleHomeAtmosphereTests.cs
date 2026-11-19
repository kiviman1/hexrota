using System.Collections;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace Hexrota.UnityClientTests
{
    public sealed class CastleHomeAtmosphereTests
    {
        [UnityTest]
        public IEnumerator AuthoredLayersAnimateIndependentlyAndDoNotInterceptTouches()
        {
            var prefab = Resources.Load<GameObject>("CastleHome/CastleHome");
            Assert.That(prefab, Is.Not.Null);
            var envAsset = prefab.transform.Find("MenuLayout/Environment");
            Assert.That(envAsset.Find("FarClouds/CloudFarLeft"), Is.Not.Null, "Layers must be editable in the prefab.");
            Assert.That(envAsset.Find("FarIslands/IslandLeft"), Is.Not.Null);
            Assert.That(envAsset.Find("Waterfalls/WaterfallLeft"), Is.Not.Null);
            Assert.That(envAsset.Find("Ground/StonePathAndMeadow"), Is.Not.Null);
            Assert.That(envAsset.Find("Coop/LeftFlagCloth"), Is.Not.Null);
            Assert.That(envAsset.Find("Coop/LeftFlagPole"), Is.Not.Null);
            Assert.That(envAsset.Find("Coop/RightFlagCloth"), Is.Not.Null);
            Assert.That(envAsset.Find("Coop/RightFlagPole"), Is.Not.Null);
            Assert.That(envAsset.Find("Coop/CentralTower"), Is.Not.Null);
            Assert.That(envAsset.Find("Coop/RightTower"), Is.Not.Null);
            Assert.That(envAsset.Find("Coop/CastleBody"), Is.Not.Null);
            var home = Object.Instantiate(prefab);
            try
            {
                var env = home.transform.Find("MenuLayout/Environment");
                var cloud = env.Find("FarClouds/CloudFarLeft").GetComponent<RectTransform>();
                var castle = env.Find("Coop");
                var water = env.Find("Waterfalls/WaterfallLeft").GetComponent<Image>();
                var glints = home.GetComponentInChildren<CastleHomeBrassGlints>();
                Assert.That(castle.GetComponent<CastleHomeFlagCloth>(), Is.Null, "The castle and roof must not deform.");
                Assert.That(castle.GetComponentsInChildren<CastleHomeFlagCloth>().Length, Is.EqualTo(2));
                Assert.That(water.material.shader.name, Is.EqualTo("Hexrota/UI/WaterFlow"));
                Assert.That(glints, Is.Not.Null);
                Assert.That(glints.raycastTarget, Is.False);
                foreach (var image in env.GetComponentsInChildren<Image>()) Assert.That(image.raycastTarget, Is.False, image.name);
                var castlePosition = castle.localPosition;
                var cloudPosition = cloud.anchoredPosition;
                yield return new WaitForSecondsRealtime(.35f);
                Assert.That(cloud.anchoredPosition, Is.Not.EqualTo(cloudPosition));
                Assert.That(castle.localPosition, Is.EqualTo(castlePosition));
            }
            finally { Object.Destroy(home); }
        }
    }
}
