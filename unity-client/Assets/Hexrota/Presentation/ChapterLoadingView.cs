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
        private CanvasGroup curtain;
        private Vector2 cardHome;
        private bool reducedMotion;

        private void Awake()
        {
            curtain = GetComponent<CanvasGroup>();
            cardHome = card.anchoredPosition;
        }

        internal void Show(int chapterIndex, int coopStage, bool reduced)
        {
            gameObject.SetActive(true);
            transform.SetAsLastSibling();
            reducedMotion = reduced;
            if (coopStages.Length > 0)
                landscape.sprite = coopStages[Mathf.Clamp(coopStage, 0, coopStages.Length - 1)];
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
            float reveal = reducedMotion ? 1f : Mathf.SmoothStep(0, 1, Mathf.Clamp01(visibility));
            curtain.alpha = reveal;
            card.localScale = Vector3.one * (fit * Mathf.Lerp(.93f, 1f, reveal));
            card.anchoredPosition = cardHome + Vector2.down * (36f * (1f - reveal));
            progressFill.anchorMax = new Vector2(reducedMotion ? 1f : Mathf.Clamp01(progress), 1f);
        }

        internal void Hide() => gameObject.SetActive(false);
    }
}
