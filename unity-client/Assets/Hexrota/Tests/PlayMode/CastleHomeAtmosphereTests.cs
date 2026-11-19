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
            var plotCoop = layers.CoopPlot.Find("PlotCoop");
            Assert.That(plotCoop, Is.Not.Null, "The coop sprite stands on the plot.");
            var view = plotCoop.GetComponentInChildren<CoopSpriteView>(true);
            Assert.That(view, Is.Not.Null);
            Assert.That(view.LevelCount, Is.EqualTo(5), "Coop_L0 foundation and four levels.");
            // The old 2D coop drawing and the level-0 stakes are retired: kept in the prefab, hidden.
            var retired = layers.CoopPlot.Find("RetiredPlaceholders");
            Assert.That(retired, Is.Not.Null);
            Assert.That(retired.gameObject.activeSelf, Is.False);
            Assert.That(retired.Find("CoopDrawing"), Is.Not.Null);
            Assert.That(retired.Find("EmptyPlot"), Is.Not.Null);
            foreach (var image in env.GetComponentsInChildren<Image>(true))
                Assert.That(image.raycastTarget, Is.EqualTo(image.name == "CoopTapArea"), image.name + ": only the plot takes taps.");
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

                // The coop stands on the plot; the bar sits below the plot, right of the stone path, above Play.
                Rect coop = ScreenRect(screen, (RectTransform)layers.CoopPlot.Find("PlotCoop"));
                Assert.That(coop.center.x, Is.EqualTo(plot.center.x).Within(1f));
                Assert.That(coop.yMin, Is.GreaterThan(plot.yMin).And.LessThan(plot.center.y), "The coop base is on the plot.");
                Rect ArtRect(float left, float top, float right, float bottom) => Rect.MinMaxRect(
                    frame.xMin + left / layers.ArtSize.x * frame.width, frame.yMax - bottom / layers.ArtSize.y * frame.height,
                    frame.xMin + right / layers.ArtSize.x * frame.width, frame.yMax - top / layers.ArtSize.y * frame.height);
                var bar = ScreenRect(screen, (RectTransform)home.transform.Find("MenuLayout/CoopProgress"));
                var egg = ScreenRect(screen, (RectTransform)home.transform.Find("MenuLayout/CoopProgress/Egg"));
                var play = ScreenRect(screen, (RectTransform)home.transform.Find("MenuLayout/PlayArea/PlayButton"));
                var barAll = Rect.MinMaxRect(Mathf.Min(bar.xMin, egg.xMin), Mathf.Min(bar.yMin, egg.yMin),
                                             Mathf.Max(bar.xMax, egg.xMax), Mathf.Max(bar.yMax, egg.yMax));
                Assert.That(barAll.yMax, Is.LessThanOrEqualTo(ArtRect(0, 1640, 1170, 1660).yMin), "Bar stays below the plot.");
                Assert.That(barAll.xMin, Is.GreaterThanOrEqualTo(ArtRect(30, 1670, 420, 1990).xMax), "Bar stays right of the stone path.");
                Assert.That(barAll.Overlaps(play), Is.False, "Bar does not cover Play.");
                Assert.That(barAll.xMax, Is.LessThanOrEqualTo(display.xMax), "Bar stays on screen.");

                // Every coop level grows but stays on the plot, clear of Play and the bar, on one ground point.
                var view = home.GetComponentInChildren<CoopSpriteView>();
                Vector2 ground = default;
                float lastWidth = 0;
                for (int level = 0; level < view.LevelCount; level++)
                {
                    view.Show(level);
                    view.Refresh();
                    Rect sprite = ScreenRect(screen, view.Image.rectTransform);
                    string name = "Coop_L" + level + " at " + width + "x" + height;
                    Assert.That(sprite.xMin, Is.GreaterThanOrEqualTo(plot.xMin), name + " fits the plot (left).");
                    Assert.That(sprite.xMax, Is.LessThanOrEqualTo(plot.xMax), name + " fits the plot (right).");
                    Assert.That(sprite.yMin, Is.GreaterThanOrEqualTo(plot.yMin), name + " stands on the plot.");
                    Assert.That(sprite.Overlaps(play), Is.False, name + " clears Play.");
                    Assert.That(sprite.Overlaps(barAll), Is.False, name + " clears the bar.");
                    Assert.That(sprite.width, Is.GreaterThan(lastWidth), name + " is bigger than the level before.");
                    lastWidth = sprite.width;
                    var rt = view.Image.rectTransform;
                    Vector2 foot = screen.InverseTransformPoint(rt.TransformPoint(Vector3.zero));
                    if (level == 0) ground = foot;
                    else Assert.That(Vector2.Distance(foot, ground), Is.LessThan(.5f), name + " stands on the same point.");
                }
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

                yield return null; // skip the load frame's long delta
                yield return null;
                var start = layers.Clouds.Select(c => c.anchorMin.x).ToArray();
                float began = Time.unscaledTime;
                yield return new WaitForSecondsRealtime(.5f);
                float elapsed = Time.unscaledTime - began;
                for (int i = 0; i < start.Length; i++)
                {
                    float moved = (layers.Clouds[i].anchorMin.x - start[i]) * layers.ArtSize.x;
                    Assert.That(moved, Is.GreaterThan(0f), "cloud " + i);
                    Assert.That(moved / elapsed, Is.EqualTo(motion.cloudDriftSpeeds[i]).Within(motion.cloudDriftSpeeds[i] * .5f), "cloud " + i);
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
