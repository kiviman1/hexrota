using System;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    [DisallowMultipleComponent, RequireComponent(typeof(CanvasGroup))]
    public sealed class ChapterLoadingView : MonoBehaviour
    {
        [Serializable]
        private sealed class IllustratedTip
        {
            public string heading;
            [TextArea] public string body;
            public GameObject diagram;
        }

        [SerializeField] private RectTransform safeContent;
        [SerializeField] private Image landscape;
        [SerializeField] private Sprite[] coopStages;
        [SerializeField] private RectTransform card;
        [SerializeField] private Text heading;
        [SerializeField] private Text body;
        [SerializeField] private IllustratedTip[] tips;
        [SerializeField] private RectTransform progressFill;
        [SerializeField] private Color shutterTrim = new Color32(255, 207, 105, 255);
        private RectTransform upperShutter, lowerShutter;
        private Image upperLandscape, lowerLandscape, upperTrim, lowerTrim;
        private CanvasGroup cardVisibility;
        private bool reducedMotion;

        private void Awake()
        {
            // The full-screen surface intercepts taps even while the center is open.
            var inputShield = gameObject.AddComponent<Image>();
            inputShield.color = Color.clear;
            upperLandscape = landscape;
            lowerLandscape = Instantiate(landscape, transform, false);
            lowerLandscape.raycastTarget = false;
            upperShutter = CreateShutter("UpperShutter", true, upperLandscape, out upperTrim);
            lowerShutter = CreateShutter("LowerShutter", false, lowerLandscape, out lowerTrim);
            cardVisibility = card.gameObject.AddComponent<CanvasGroup>();
        }

        private RectTransform CreateShutter(string name, bool upper, Image art, out Image trim)
        {
            var panel = new GameObject(name, typeof(RectTransform), typeof(RectMask2D));
            var rect = (RectTransform)panel.transform;
            rect.SetParent(transform, false);
            rect.SetSiblingIndex(safeContent.GetSiblingIndex());
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

        internal void Show(int chapterIndex, int coopStage, bool reduced)
        {
            gameObject.SetActive(true);
            transform.SetAsLastSibling();
            reducedMotion = reduced;
            if (coopStages.Length > 0)
                upperLandscape.sprite = lowerLandscape.sprite = coopStages[Mathf.Clamp(coopStage, 0, coopStages.Length - 1)];
            if (tips.Length > 0)
            {
                int selected = Mathf.Max(0, chapterIndex) % tips.Length;
                for (int i = 0; i < tips.Length; i++)
                    tips[i].diagram.SetActive(i == selected);
                heading.text = tips[selected].heading;
                body.text = tips[selected].body;
            }
            SetTransition(0, 0);
        }

        // The illustrated card follows the safe area; the castle landscape covers the full canvas.
        // The controller owns input and clocks, so suspend/skip cannot leave a coroutine behind.
        internal void SetTransition(float visibility, float progress)
        {
            Rect area = MobileLayout.SafeArea(new Rect(0, 0, Screen.width, Screen.height), Screen.safeArea);
            safeContent.anchorMin = area.min;
            safeContent.anchorMax = area.max;
            float fit = Mathf.Min(1.16f, Mathf.Min(safeContent.rect.width * .94f / card.rect.width,
                safeContent.rect.height * .73f / card.rect.height));
            float reveal = reducedMotion ? 1f : Mathf.SmoothStep(0f, 1f, visibility);
            float travel = .5f * (1f - reveal);
            PlaceShutter(upperShutter, .5f + travel);
            PlaceShutter(lowerShutter, -travel);
            Color edge = shutterTrim;
            edge.a *= Mathf.Sin(Mathf.PI * reveal);
            upperTrim.color = lowerTrim.color = edge;
            cardVisibility.alpha = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(.87f, 1f, reveal));
            card.localScale = Vector3.one * fit;
            progressFill.anchorMax = new Vector2(reducedMotion ? 1f : Mathf.Clamp01(progress), 1f);
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
