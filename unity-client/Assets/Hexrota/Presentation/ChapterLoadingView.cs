using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    [DisallowMultipleComponent, RequireComponent(typeof(CanvasGroup))]
    public sealed class ChapterLoadingView : MonoBehaviour
    {
        [SerializeField] private Image landscape;
        [SerializeField] private Sprite[] coopStages;
        [SerializeField] private Text loadingLabel;
        [SerializeField] private Color shutterTrim = new Color32(255, 207, 105, 255);
        private RectTransform upperShutter, lowerShutter;
        private Image lowerLandscape, upperTrim, lowerTrim;

        private void Awake()
        {
            // The full-screen surface intercepts taps even while the center is open.
            var inputShield = gameObject.AddComponent<Image>();
            inputShield.color = Color.clear;
            lowerLandscape = Instantiate(landscape, transform, false);
            lowerLandscape.raycastTarget = false;
            upperShutter = CreateShutter("UpperShutter", true, landscape, out upperTrim);
            lowerShutter = CreateShutter("LowerShutter", false, lowerLandscape, out lowerTrim);
            loadingLabel.transform.SetAsLastSibling();
        }

        private RectTransform CreateShutter(string name, bool upper, Image art, out Image trim)
        {
            var panel = new GameObject(name, typeof(RectTransform), typeof(RectMask2D));
            var rect = (RectTransform)panel.transform;
            rect.SetParent(transform, false);
            art.rectTransform.SetParent(rect, false);
            // Both panels sample the same full-height composition at the joined position.
            art.rectTransform.anchorMin = new Vector2(0f, upper ? -1f : 0f);
            art.rectTransform.anchorMax = new Vector2(1f, upper ? 1f : 2f);
            art.rectTransform.offsetMin = art.rectTransform.offsetMax = Vector2.zero;

            trim = new GameObject("GoldEdge", typeof(RectTransform), typeof(Image)).GetComponent<Image>();
            trim.raycastTarget = false;
            var edge = trim.rectTransform;
            edge.SetParent(rect, false);
            float y = upper ? 0f : 1f;
            edge.anchorMin = new Vector2(0f, y);
            edge.anchorMax = new Vector2(1f, y);
            edge.pivot = new Vector2(.5f, y);
            edge.anchoredPosition = Vector2.zero;
            edge.sizeDelta = new Vector2(0f, 3f);
            return rect;
        }

        internal void Show(int coopStage, bool reduced)
        {
            gameObject.SetActive(true);
            transform.SetAsLastSibling();
            if (coopStages.Length > 0)
                landscape.sprite = lowerLandscape.sprite = coopStages[Mathf.Clamp(coopStage, 0, coopStages.Length - 1)];
            SetCoverage(reduced ? 1f : 0f);
            SetLoadingLabel(reduced);
        }

        internal void SetLoadingLabel(bool visible) => loadingLabel.gameObject.SetActive(visible);

        internal void SetCoverage(float coverage)
        {
            float reveal = Mathf.SmoothStep(0f, 1f, coverage);
            float travel = .5f * (1f - reveal);
            PlaceShutter(upperShutter, .5f + travel);
            PlaceShutter(lowerShutter, -travel);
            Color edge = shutterTrim;
            edge.a *= 4f * reveal * (1f - reveal);
            upperTrim.color = lowerTrim.color = edge;
        }

        private static void PlaceShutter(RectTransform shutter, float bottom)
        {
            shutter.anchorMin = new Vector2(0f, bottom);
            shutter.anchorMax = new Vector2(1f, bottom + .5f);
            shutter.offsetMin = shutter.offsetMax = Vector2.zero;
        }

        internal void Hide() => gameObject.SetActive(false);
    }
}
