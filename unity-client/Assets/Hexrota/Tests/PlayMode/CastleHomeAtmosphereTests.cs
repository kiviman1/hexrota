using System.Collections;
using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace Hexrota.UnityClientTests
{
    // Home background from the painted layers in art/HomeBackground (sky → clouds → ground → coop slot → UI).
    public sealed class CastleHomeAtmosphereTests
    {
        // Points in the 1170 x 2532 painting (top-left origin) that must stay on screen.
        private static readonly (string name, Vector2 point)[] Landmarks =
        {
            ("tree canopy", new Vector2(250, 120)), ("tree trunk", new Vector2(110, 380)),
            ("waterfall", new Vector2(1050, 470)), ("plot left", new Vector2(60, 1320)),
            ("plot centre", new Vector2(575, 1322)), ("plot right", new Vector2(1090, 1320)),
        };

        private static GameObject Prefab()
        {
            var prefab = Resources.Load<GameObject>("CastleHome/CastleHome");
            Assert.That(prefab, Is.Not.Null);
            return prefab;
        }

        [Test]
        public void LayersDrawSkyCloudsGroundThenTheEmptyCoopSlotAndOldSceneIsHidden()
        {
            var env = Prefab().transform.Find("MenuLayout/Environment");
            var background = env.Find("Background");
            Assert.That(background.GetSiblingIndex(), Is.Zero, "The sky draws first.");
            Assert.That(background.GetComponent<Image>().sprite.name, Is.EqualTo("sky"));
            var layers = background.GetComponent<HomeBackgroundLayers>();
            Assert.That(layers, Is.Not.Null);
            var frame = layers.Frame;
            Assert.That(frame.parent, Is.EqualTo(background));
            var clouds = frame.Find("Clouds");
            var ground = frame.Find("Ground");
            Assert.That(clouds.GetSiblingIndex(), Is.LessThan(ground.GetSiblingIndex()), "Clouds pass behind the ground.");
            Assert.That(layers.Clouds.Select(c => c.GetComponent<Image>().sprite.name),
                Is.EqualTo(new[] { "cloud_1", "cloud_2", "cloud_3" }));
            Assert.That(ground.GetComponent<Image>().sprite.name, Is.EqualTo("ground"));
            Assert.That(layers.CoopPlot, Is.Not.Null);
            Assert.That(layers.CoopPlot.GetComponent<Graphic>(), Is.Null, "The plot is only an anchor for the 3D coop.");
            Assert.That(layers.CoopPlot.parent, Is.EqualTo(frame));
            Assert.That(layers.CoopPlot.GetSiblingIndex(), Is.GreaterThan(ground.GetSiblingIndex()));
            Assert.That(Prefab().GetComponentsInChildren<Image>(true).Any(i => i.sprite != null && i.sprite.name == "foreground"),
                Is.False, "foreground.png is not used yet.");

            foreach (var name in new[] { "FarClouds", "FarIslands", "Waterfalls", "Ground", "Foreground" })
            {
                var old = env.Find(name);
                Assert.That(old, Is.Not.Null, name + " is kept in the prefab.");
                Assert.That(old.gameObject.activeSelf, Is.False, name + " is hidden.");
            }
            var coop = env.Find("Coop");
            Assert.That(coop.gameObject.activeSelf, Is.True, "The coop view still scales and targets the placeholder.");
            Assert.That(coop.GetComponent<Image>().enabled, Is.False);
            foreach (Transform part in coop) Assert.That(part.gameObject.activeSelf, Is.False, part.name);
            foreach (var image in env.GetComponentsInChildren<Image>(true)) Assert.That(image.raycastTarget, Is.False, image.name);
        }

        [UnityTest]
        public IEnumerator ArtCoversThePhoneAndKeepsTreeWaterfallAndPlotVisible(
            [Values(360, 390, 430)] int width)
        {
            int height = width == 360 ? 780 : width == 390 ? 844 : 932;
            var canvas = new GameObject("PhoneCanvas", typeof(RectTransform), typeof(Canvas)).GetComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            var screen = (RectTransform)canvas.transform;
            screen.sizeDelta = new Vector2(width, height);
            var home = Object.Instantiate(Prefab(), screen, false);
            try
            {
                var root = (RectTransform)home.transform;
                root.anchorMin = Vector2.zero; root.anchorMax = Vector2.one; root.offsetMin = root.offsetMax = Vector2.zero;
                yield return null;
                Canvas.ForceUpdateCanvases();
                var layers = home.GetComponentInChildren<HomeBackgroundLayers>();
                layers.Fit();
                Rect display = ScreenRect(screen, (RectTransform)layers.transform);
                Assert.That(display.width, Is.EqualTo(width).Within(1f), "The sky fills the phone.");
                Assert.That(display.height, Is.EqualTo(height).Within(1f));
                Rect frame = ScreenRect(screen, layers.Frame);
                Assert.That(frame.width / frame.height, Is.EqualTo(layers.ArtSize.x / layers.ArtSize.y).Within(.001f), "Aspect is kept.");
                Assert.That(frame.xMin, Is.LessThanOrEqualTo(display.xMin + .5f));
                Assert.That(frame.yMin, Is.LessThanOrEqualTo(display.yMin + .5f));
                Assert.That(frame.xMax, Is.GreaterThanOrEqualTo(display.xMax - .5f));
                Assert.That(frame.yMax, Is.GreaterThanOrEqualTo(display.yMax - .5f), "Cover: no empty bands.");
                foreach (var (name, point) in Landmarks)
                {
                    var onScreen = new Vector2(frame.xMin + point.x / layers.ArtSize.x * frame.width,
                                               frame.yMax - point.y / layers.ArtSize.y * frame.height);
                    Assert.That(display.Contains(onScreen), Is.True, name + " at " + width + "x" + height);
                }
                Rect plot = ScreenRect(screen, layers.CoopPlot);
                Assert.That(display.Contains(plot.center), Is.True);
                Assert.That(plot.center.x, Is.EqualTo(display.center.x).Within(width * .05f), "The plot sits in the middle.");
            }
            finally { Object.Destroy(canvas.gameObject); }
        }

        private static Rect ScreenRect(RectTransform screen, RectTransform rect)
        {
            var corners = new Vector3[4];
            rect.GetWorldCorners(corners);
            Vector2 min = screen.InverseTransformPoint(corners[0]), max = screen.InverseTransformPoint(corners[2]);
            return Rect.MinMaxRect(min.x, min.y, max.x, max.y);
        }

        [UnityTest]
        public IEnumerator CloudsDriftAtThemeSpeedsWrapAroundAndStopWithReducedMotion()
        {
            var old = FirstPlayableController.SessionFactory;
            FirstPlayableController.SessionFactory = () =>
                new UnityGameSession(ClientGameData.FromResources(), new MemoryProfileStorage(), new SystemUtcClock());
            try
            {
                yield return SceneManager.LoadSceneAsync("FirstPlayable");
                var game = Object.FindAnyObjectByType<FirstPlayableController>();
                Assert.That(game.Session.SetPreferences(motion: "full"), Is.True);
                yield return null;
                var layers = game.GetComponentInChildren<HomeBackgroundLayers>();
                Assert.That(layers.ReducedMotion, Is.False);
                var motion = Resources.FindObjectsOfTypeAll<MotionTheme>().First();
                Assert.That(motion.cloudDriftSpeeds.Length, Is.EqualTo(layers.Clouds.Length));
                Assert.That(motion.cloudDriftSpeeds.Distinct().Count(), Is.EqualTo(layers.Clouds.Length), "Each cloud has its own speed.");

                var start = layers.Clouds.Select(c => c.anchorMin.x).ToArray();
                float began = Time.unscaledTime;
                yield return new WaitForSecondsRealtime(.5f);
                float elapsed = Time.unscaledTime - began;
                for (int i = 0; i < start.Length; i++)
                {
                    float moved = (layers.Clouds[i].anchorMin.x - start[i]) * layers.ArtSize.x;
                    Assert.That(moved, Is.GreaterThan(0f), "cloud " + i);
                    Assert.That(moved / elapsed, Is.EqualTo(motion.cloudDriftSpeeds[i]).Within(motion.cloudDriftSpeeds[i] * .35f), "cloud " + i);
                }
                foreach (var cloud in layers.Clouds)
                {
                    var rect = ScreenRect((RectTransform)layers.transform, cloud);
                    var sky = ScreenRect((RectTransform)layers.transform, layers.Frame);
                    float topInArt = (sky.yMax - rect.yMax) / sky.height * layers.ArtSize.y;
                    Assert.That(topInArt, Is.LessThan(460f), cloud.name + " starts in the sky band.");
                }

                // Leaving the right edge brings the cloud back from the left edge.
                var first = layers.Clouds[0];
                float width = first.anchorMax.x - first.anchorMin.x;
                first.anchorMin = new Vector2(1.02f, first.anchorMin.y);
                first.anchorMax = new Vector2(1.02f + width, first.anchorMax.y);
                yield return null;
                Assert.That(first.anchorMax.x, Is.LessThanOrEqualTo(.01f), "Wrapped to the left edge.");
                Assert.That(first.anchorMax.x - first.anchorMin.x, Is.EqualTo(width).Within(.0001f));

                Assert.That(game.Session.SetPreferences(motion: "reduce"), Is.True);
                yield return null;
                yield return null;
                Assert.That(layers.ReducedMotion, Is.True, "The home passes the reduced-motion preference on.");
                var still = layers.Clouds.Select(c => c.anchorMin.x).ToArray();
                yield return new WaitForSecondsRealtime(.3f);
                Assert.That(layers.Clouds.Select(c => c.anchorMin.x).ToArray(), Is.EqualTo(still), "Clouds stop with reduced motion.");
                game.ReturnToMenu();
            }
            finally { FirstPlayableController.SessionFactory = old; }
        }
    }
}
