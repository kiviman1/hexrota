using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace Hexrota.UnityClient.Presentation
{
    [RequireComponent(typeof(CanvasGroup))]
    public sealed class ChapterVictoryView : MonoBehaviour, IPointerClickHandler
    {
        [SerializeField] private RectTransform safeContent;
        [SerializeField] private RectTransform frame;
        [SerializeField] private RectTransform seal;
        [SerializeField] private RectTransform laurel;
        [SerializeField] private RectTransform tavik;
        [SerializeField] private RectTransform ribbon;
        [SerializeField] private VictoryBloomGraphic bloom;
        [SerializeField, Min(.5f)] private float duration = 2f;
        [SerializeField, Min(.5f)] private float reducedDuration = 1.05f;

        private CanvasGroup opacity;
        private Vector2 tavikRest, ribbonRest;
        private Vector3 sealScale, laurelScale, ribbonScale, tavikScale;
        private float elapsed;
        private bool reduced;
        private Action finished;

        private void Awake()
        {
            opacity = GetComponent<CanvasGroup>();
            tavikRest = tavik.anchoredPosition;
            ribbonRest = ribbon.anchoredPosition;
            sealScale = seal.localScale;
            laurelScale = laurel.localScale;
            ribbonScale = ribbon.localScale;
            tavikScale = tavik.localScale;
        }

        internal void Show(bool reducedMotion, Action onFinished)
        {
            gameObject.SetActive(true);
            transform.SetAsLastSibling();
            elapsed = 0f;
            reduced = reducedMotion;
            finished = onFinished;
            Draw();
        }

        private void Update()
        {
            if (finished == null) return;
            elapsed += Time.unscaledDeltaTime;
            if (elapsed >= (reduced ? reducedDuration : duration))
            {
                Finish();
                return;
            }
            Draw();
        }

        private void Draw()
        {
            var area = MobileLayout.SafeArea(new Rect(0, 0, Screen.width, Screen.height), Screen.safeArea);
            safeContent.anchorMin = area.min;
            safeContent.anchorMax = area.max;
            float fit = Mathf.Min(1.25f, Mathf.Min(safeContent.rect.width * .95f / frame.rect.width,
                safeContent.rect.height * .88f / frame.rect.height));
            frame.localScale = Vector3.one * fit;
            opacity.alpha = reduced ? 1f : Mathf.SmoothStep(0, 1, elapsed / .14f) *
                Mathf.SmoothStep(0, 1, (duration - elapsed) / .18f);
            float sealRise = reduced ? 1f : Mathf.SmoothStep(0, 1, elapsed / .37f);
            seal.localScale = sealScale * Mathf.Lerp(.56f, 1f, sealRise);
            float unfold = reduced ? 1f : Mathf.SmoothStep(0, 1, (elapsed - .10f) / .34f);
            laurel.localScale = Vector3.Scale(laurelScale, new Vector3(Mathf.Lerp(.38f, 1f, unfold), 1f, 1f));
            float hop = reduced ? 0f : Mathf.Sin(Mathf.PI * Mathf.Clamp01((elapsed - .14f) / .66f));
            tavik.anchoredPosition = tavikRest + Vector2.up * (26f * hop);
            tavik.localScale = tavikScale * Mathf.Lerp(.65f, 1f, sealRise);
            float arrival = reduced ? 1f : Mathf.SmoothStep(0, 1, (elapsed - .16f) / .36f);
            ribbon.anchoredPosition = ribbonRest + Vector2.down * (23f * (1f - arrival));
            ribbon.localScale = ribbonScale * Mathf.Lerp(.32f, 1f, arrival);
            bloom.SetPhase(reduced ? 1f : Mathf.Clamp01(elapsed / duration), reduced);
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            if (elapsed >= .35f && eventData.button == PointerEventData.InputButton.Left) Finish();
        }

        private void Finish()
        {
            var notify = finished;
            Hide();
            notify?.Invoke();
        }

        internal void Hide()
        {
            finished = null;
            gameObject.SetActive(false);
        }
    }
}
