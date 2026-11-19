using System.Collections;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        [SerializeField] private ChapterLoadingView loadingPrefab;
        private ChapterLoadingView chapterLoading;
        private CanvasGroup gameplayInput;
        private Coroutine entrance;
        private float hudProgress;
        private bool entrancePrepared, prepareOnEnable;
        public bool IsEnteringStage { get; private set; }

        private void CreateChapterEntrance()
        {
            gameplayInput = gameplay.AddComponent<CanvasGroup>();
            var prefab = loadingPrefab != null ? loadingPrefab :
                Resources.Load<GameObject>("CastleGame/ChapterLoading").GetComponent<ChapterLoadingView>();
            // The curtain also covers the area outside the notch-safe gameplay canvas.
            chapterLoading = Instantiate(prefab, safe.GetComponentInParent<Canvas>().rootCanvas.transform, false);
            Place((RectTransform)chapterLoading.transform, 0, 0, 1, 1);
            chapterLoading.Hide();
        }

        private void StartChapterEntrance()
        {
            StopChapterEntrance();
            IsEnteringStage = true;
            entrancePrepared = false;
            CurrentScreen = "loading";
            Board.InputEnabled = false;
            gameplayInput.interactable = gameplayInput.blocksRaycasts = false;
            bool reduced = Session.ReducedMotion;
            chapterLoading.Show(Session.CompletedSceneTutorials, reduced);
            entrance = StartCoroutine(EnterChapter(reduced));
        }

        private IEnumerator EnterChapter(bool reduced)
        {
            float closeTime = reduced ? 0f : .43f;
            const float hold = .42f;
            float openTime = reduced ? 0f : .42f;
            float elapsed = 0f;
            while (elapsed < closeTime)
            {
                chapterLoading.SetCoverage(elapsed / closeTime);
                yield return null;
                elapsed += Time.unscaledDeltaTime;
            }
            chapterLoading.SetCoverage(1f);
            chapterLoading.SetLoadingLabel(true);
            // Present an opaque frame before instantiating the board beneath it.
            yield return null;
            PrepareCurrentBoard();
            RefreshTutorial(true);
            Board.InputEnabled = false;
            Board.BeginEntrance(Session.Snapshot);
            entrancePrepared = true;
            SetHudEntrance(reduced ? 1f : 0f);
            SetBoardSlide(reduced ? 1f : 0f);
            if (reduced) Board.SetEntranceFill(1f);

            yield return new WaitForSecondsRealtime(hold);
            chapterLoading.SetLoadingLabel(false);
            for (float t = 0; t < openTime; t += Time.unscaledDeltaTime)
            {
                chapterLoading.SetCoverage(1f - t / openTime);
                yield return null;
            }
            chapterLoading.Hide();
            if (!reduced)
            {
                const float hudEnd = .32f, boardEnd = .76f;
                float fillEnd = boardEnd + Board.EntranceFillSeconds;
                for (float t = 0; t < fillEnd; t += Time.unscaledDeltaTime)
                {
                    SetHudEntrance(Mathf.SmoothStep(0, 1, Mathf.Clamp01(t / hudEnd)));
                    SetBoardSlide(Mathf.SmoothStep(0, 1, Mathf.InverseLerp(hudEnd, boardEnd, t)));
                    if (t >= boardEnd) Board.SetEntranceFill(Mathf.InverseLerp(boardEnd, fillEnd, t));
                    yield return null;
                }
            }
            entrance = null;
            StopChapterEntrance();
            CurrentScreen = "playing";
            EnableCurrentBoard();
        }

        private void SetHudEntrance(float progress)
        {
            hudProgress = progress;
            var hud = (RectTransform)castleHud.transform;
            float distance = safe.rect.height * (1f - boardInput.anchorMax.y + .04f);
            var offset = Vector2.up * ((1f - progress) * distance);
            hud.anchoredPosition = offset;
            ((RectTransform)gameTools.transform).anchoredPosition = offset;
        }

        private void SetBoardSlide(float progress)
        {
            Board.SetEntranceSlide(progress);
            coopScene.SetEntranceSlide(progress);
        }

        private void StopChapterEntrance()
        {
            if (!IsEnteringStage) return;
            IsEnteringStage = false;
            if (entrance != null) StopCoroutine(entrance);
            entrance = null;
            if (chapterLoading != null) chapterLoading.Hide();
            if (entrancePrepared)
            {
                if (castleHud != null && gameTools != null && safe != null && boardInput != null) SetHudEntrance(1f);
                if (Board != null) Board.EndEntrance();
                if (coopScene != null) coopScene.SetEntranceSlide(1f);
            }
            entrancePrepared = false;
            if (gameplayInput != null) gameplayInput.interactable = gameplayInput.blocksRaycasts = true;
        }

        private void FinishInterruptedEntrance()
        {
            bool needsBoard = !entrancePrepared;
            StopChapterEntrance();
            CurrentScreen = "playing";
            if (needsBoard) PrepareCurrentBoard();
        }
    }
}
