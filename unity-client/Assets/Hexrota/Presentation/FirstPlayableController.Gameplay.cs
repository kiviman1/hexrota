using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        [SerializeField] private HexBoardView.StoneMotionSettings stoneMotion = new HexBoardView.StoneMotionSettings();
        [SerializeField] private CastleHudView castleHudPrefab;
        private CastleHudView castleHud;
        [SerializeField] private CastleGameToolsView gameToolsPrefab;
        private CastleGameToolsView gameTools;
        private int[] guidePair;
        private int[] openingPair, openingMatch;
        private string pendingGroundTip, shownMechanicTip;
        private float tipEnds;
        private float guideStarted, speechStarted;
        private string coachCue;

        internal static void Place(RectTransform item, float x0, float y0, float x1, float y1)
        {
            item.anchorMin = new Vector2(x0,y0); item.anchorMax = new Vector2(x1,y1);
            item.offsetMin = item.offsetMax = Vector2.zero;
        }

        private Text PlayText(string name, Transform parent, string copy, float x0, float y0, float x1,
            float y1, int size, Color color, TextAnchor alignment, bool bold = false)
        {
            var t = Label(name,parent,copy,new Vector2(x0,y0),new Vector2(x1,y1),size,alignment);
            t.color = color; t.fontStyle = bold ? FontStyle.Bold : FontStyle.Normal;
            t.resizeTextMinSize = Mathf.Min(size,Mathf.Max(10, size - 7));
            t.verticalOverflow = VerticalWrapMode.Truncate;
            return t;
        }

        private void BuildGameplayScreen()
        {
            gameplay = Rect("Gameplay",safe,Vector2.zero,Vector2.one).gameObject;
            boardInput = Rect("BoardInput",gameplay.transform,Vector2.zero,Vector2.one);
            var touch = boardInput.gameObject.AddComponent<Image>(); touch.color = Color.clear;
            Board = boardInput.gameObject.AddComponent<HexBoardView>(); Board.Initialize(boardCamera,assetCatalog);
            Board.SetStoneMotion(stoneMotion);
            Board.SwapRequested += RequestSwap; Board.PresentationCompleted += FinishPresentation;
            Board.PresentationCancelled += CancelBoardPresentation;
            Board.PresentationStarted += BeginScoreFeedback; Board.WaveProgress += DrawScoreWave;

            var hudPrefab = castleHudPrefab != null ? castleHudPrefab :
                Resources.Load<GameObject>("CastleGame/CastleHud").GetComponent<CastleHudView>();
            castleHud = Instantiate(hudPrefab, gameplay.transform, false);
            castleHud.Bind(this);
            CreateDevelopmentWinButton();

            var toolsPrefab = gameToolsPrefab != null ? gameToolsPrefab :
                Resources.Load<GameObject>("CastleGame/CastleGameTools").GetComponent<CastleGameToolsView>();
            gameTools = Instantiate(toolsPrefab, gameplay.transform, false);
            Place((RectTransform)gameTools.transform, 0, 0, 1, 1);
            gameTools.Bind(this);
            Board.BindIdleHintOverlay(gameTools.DirectionArrow);
            message = gameTools.Feedback;
            CreateScoreFeedback();
        }

        private void LayoutGameplay(UnityEngine.Rect safeRect)
        {
            if (Board == null || Session == null || !Session.HasAttempt) return;
            bool lesson = Session.IsTutorial;
            float aspect = safeRect.width * Screen.width / Mathf.Max(1,safeRect.height * Screen.height);
            var layout = new MobileLayout.GameRegions(aspect,lesson);
            Place((RectTransform)castleHud.transform,0,1-layout.Header,1,1);
            PlaceDevelopmentWinButton(1-layout.Header);
            RefreshBag();
            gameTools.FitRegions(layout);
            var area = layout.Board;
            Place(boardInput,area.xMin,area.yMin,area.xMax,area.yMax);
            var cameraArea = new UnityEngine.Rect(safeRect.x + safeRect.width * area.x,safeRect.y + safeRect.height * area.y,
                safeRect.width * area.width,safeRect.height * area.height);
            Board.SetCameraArea(cameraArea);
            coopScene.SetBoardArea(cameraArea, Board, Session.Level.cells.Length);
            if (gameTools.Opening != null && gameTools.Opening.gameObject.activeSelf) PositionOpeningPrompt();
        }

        private void RefreshCounters()
        {
            if (!Session.HasAttempt) return;
            castleHud.ShowStage(Session.Level.target, Session.Snapshot, Session.Level.cells.Sum(cell => cell.layers));
            RefreshBag();
        }

        // The booster bag sits in the HUD from the first booster unlock (after chapter 3).
        // A new player's first chapters keep the HUD to the settings button only.
        private void RefreshBag()
        {
            if (castleHud == null || Session == null || !Session.HasAttempt) return;
            bool unlocked = Session.InventoryOffer("greenBrush").Unlocked || Session.InventoryOffer("colorKey").Unlocked;
            castleHud.ShowBag(!Session.IsTutorial && unlocked, Session.InventoryAvailable);
        }

        private void RenderLessonCard(bool showCopy)
        {
            var card = Session.CurrentLessonCard();
            if (card == null) return;
            gameTools.ShowCard(card, showCopy);
            string key = Session.ActiveStage + "|" + card.Heading + "|" + card.Counter;
            if (coachCue != key) { coachCue = key; speechStarted = Time.unscaledTime; }
        }

        private void RefreshTutorial(bool clearMessage)
        {
            bool lesson = Session.IsTutorial, feedback = Session.NeedsTutorialAcknowledgement;
            Board.ReducedMotion = Session.ReducedMotion;
            gameTools.SetLesson(lesson, feedback);
            if (lesson)
            {
                RenderLessonCard(clearMessage || !Board.IsAnimating || feedback);
                Board.InputEnabled = !feedback && CurrentScreen == "playing" && Session.Status == "playing";
                Board.MarkPair(Session.TutorialPair,Session.TutorialMatchIndices);
            }
            guidePair = lesson && !feedback && Board.InputEnabled ? Session.TutorialPair : null;
            if (!lesson && CurrentScreen == "playing" && Session.Status == "playing")
                RefreshOpeningLesson();
            guideStarted = Time.unscaledTime;
            gameTools.ShowGuide(guidePair != null);
        }

        private void RefreshOpeningLesson()
        {
            if (gameTools.Opening == null) return;
            if (Session.ShouldTeachOpening)
            {
                openingPair = Session.OpeningLessonPair;
                openingMatch = Session.OpeningLessonMatchIndices;
                Board.SetOpeningPair(openingPair);
                Board.MarkPair(openingPair, openingMatch);
                guidePair = openingPair;
                gameTools.Opening.ShowSwap(Session.Snapshot.values[openingPair[0]].Value);
                coopScene.FocusLesson(true);
                PositionOpeningPrompt();
                return;
            }
            if (pendingGroundTip != null && pendingGroundTip == Session.AttemptId && Session.Snapshot.turn == 1)
            {
                pendingGroundTip = null;
                gameTools.Opening.ShowGround();
            }
            else
            {
                var lesson = Session.ChapterMechanicLesson;
                if (lesson == UnityGameSession.MechanicLesson.None || shownMechanicTip == Session.AttemptId) return;
                shownMechanicTip = Session.AttemptId;
                gameTools.Opening.ShowMechanic(lesson);
            }
            tipEnds = Time.unscaledTime + 6f;
            PositionOpeningPrompt();
        }

        private void PositionOpeningPrompt()
        {
            if (Board.BoardCamera == null) return;
            // Non-blocking reminders sit along the top of the play area.
            float low = 0, high = 1;
            if (openingPair != null)
            {
                low = 1; high = 0;
                foreach (int cell in openingPair) Include(cell);
                foreach (int cell in openingMatch) Include(cell);
            }
            float radius = .56f / (2 * Board.BoardCamera.orthographicSize);
            gameTools.Opening.Position(boardInput, Board.FrameVerticalLimits(), low, high, radius);

            void Include(int cell)
            {
                float y = Board.ViewportCell(cell).y;
                low = Mathf.Min(low, y); high = Mathf.Max(high, y);
            }
        }

        private void HideOpeningLesson()
        {
            if (openingPair != null)
            {
                if (Board != null) Board.SetOpeningPair(null);
                if (coopScene != null) coopScene.FocusLesson(false);
                openingPair = openingMatch = guidePair = null;
                if (gameTools != null) gameTools.ShowGuide(false);
            }
            if (gameTools != null && gameTools.Opening != null)
                gameTools.Opening.gameObject.SetActive(false);
        }

        private void LateUpdate()
        {
            if (!ready || !HasInterface) return;
            if (gameTools.Opening == null && openingPair != null) HideOpeningLesson();
            if (gameTools.Opening != null && gameTools.Opening.gameObject.activeSelf &&
                (CurrentScreen != "playing" || (openingPair == null && Time.unscaledTime >= tipEnds)))
                HideOpeningLesson();
            if (!gameTools.ShowingLesson && openingPair == null) return;
            bool showGesture = guidePair != null && CurrentScreen == "playing" && Board.CanShowTutorialGesture;
            gameTools.ShowGuide(showGesture);
            if (CurrentScreen != "playing") return;
            float elapsed = Time.unscaledTime - speechStarted;
            if (gameTools.ShowingLesson)
                gameTools.ShowPose(!Board.ReducedMotion && !Board.IsAnimating && elapsed < .99f && ((int)(elapsed/.165f) % 2 == 0));
            if (!showGesture) return;
            // Only the glove demonstrates the swipe. The two touch targets stay on their real cells.
            float clock = Mathf.Repeat((Time.unscaledTime-guideStarted)/2.2f,1);
            float pulse = Mathf.SmoothStep(0,1,Mathf.InverseLerp(.17f,.70f,clock));
            var a = Board.ViewportCell(guidePair[0]); var b = Board.ViewportCell(guidePair[1]);
            float opacity = Mathf.InverseLerp(0,.08f,clock) * (1-Mathf.InverseLerp(.77f,.89f,clock));
            if (Board.ReducedMotion) { pulse = 0; opacity = 0; }
            gameTools.MoveGuide(a, b, pulse, opacity, Board.BoardCamera.pixelWidth / Mathf.Max(1f, Board.BoardCamera.pixelHeight));
        }

        internal void SkipLessons()
        {
            if (!ready || !HasInterface || CurrentScreen != "playing" || !Session.IsTutorial) return;
            CancelPresentation();
            if (!Session.SkipTutorials()) { ShowCommandFailure(Session.LastError); return; }
            OpenCurrentBoard();
        }
    }
}
