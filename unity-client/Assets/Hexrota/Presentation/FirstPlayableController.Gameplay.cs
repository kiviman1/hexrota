using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        [SerializeField] private CastleHudView castleHudPrefab;
        private CastleHudView castleHud;
        [SerializeField] private CastleGameToolsView gameToolsPrefab;
        private CastleGameToolsView gameTools;
        private int[] guidePair;
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
            Board.SwapRequested += RequestSwap; Board.PresentationCompleted += FinishPresentation;
            Board.PresentationCancelled += CancelBoardPresentation;
            Board.PresentationStarted += BeginScoreFeedback; Board.WaveProgress += DrawScoreWave;

            var hudPrefab = castleHudPrefab != null ? castleHudPrefab :
                Resources.Load<GameObject>("CastleGame/CastleHud").GetComponent<CastleHudView>();
            castleHud = Instantiate(hudPrefab, gameplay.transform, false);

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
            bool lesson = Session.IsTutorial, first = Session.ActiveStage == 0;
            float aspect = safeRect.width * Screen.width / Mathf.Max(1,safeRect.height * Screen.height);
            var layout = new MobileLayout.GameRegions(aspect,lesson,first);
            Place((RectTransform)castleHud.transform,0,1-layout.Header,1,1);
            gameTools.FitRegions(layout);
            var area = layout.Board;
            Place(boardInput,area.xMin,area.yMin,area.xMax,area.yMax);
            var cameraArea = new UnityEngine.Rect(safeRect.x + safeRect.width * area.x,safeRect.y + safeRect.height * area.y,
                safeRect.width * area.width,safeRect.height * area.height);
            Board.SetCameraArea(cameraArea);
            coopScene.SetBoardArea(cameraArea, Board, Session.Level.cells.Length);
            PositionBoardActor(area,aspect,lesson);
        }

        private void PositionBoardActor(UnityEngine.Rect area, float aspect, bool lesson)
        {
            var mount = gameTools.ActorMount;
            mount.gameObject.SetActive(false);
            if (lesson || Board == null || !gameTools.CanShowActor) return;
            foreach (float pixels in new[] {110f,96f,80f})
            {
                float w = pixels / 390f, h = w * aspect, gx = 8f / 390f, gy = gx * aspect;
                foreach (var p in new[] {
                    new Vector2(area.xMin+14f/390,area.yMin+gy), new Vector2(area.xMax-14f/390-w,area.yMin+gy),
                    new Vector2(area.xMin+14f/390,area.yMax-28f/390*aspect-h), new Vector2(area.xMax-14f/390-w,area.yMax-28f/390*aspect-h) })
                {
                    var box = new UnityEngine.Rect(p.x,p.y,w,h);
                    var envelope = new UnityEngine.Rect(p.x-10f/390-gx,p.y-5f/390*aspect-gy,w+20f/390+2*gx,h+29f/390*aspect+2*gy);
                    if (envelope.yMin < area.yMin || envelope.yMax > area.yMax + 10f/390*aspect || Board.OverlapsTiles(envelope,area)) continue;
                    Place(mount,box.xMin,box.yMin,box.xMax,box.yMax);
                    mount.gameObject.SetActive(true); return;
                }
            }
        }

        private void RefreshCounters()
        {
            if (!Session.HasAttempt) return;
            int stage = Session.ActiveStage;
            castleHud.ShowStage(stage, Session.TutorialCount, Session.StageName(stage), Session.Level.target, Session.Snapshot);
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
            guideStarted = Time.unscaledTime;
            gameTools.ShowGuide(guidePair != null);
        }

        private void LateUpdate()
        {
            if (!ready || !HasInterface || !gameTools.ShowingLesson) return;
            bool showGesture = guidePair != null && CurrentScreen == "playing" && Board.CanShowTutorialGesture;
            gameTools.ShowGuide(showGesture);
            if (CurrentScreen != "playing") return;
            float elapsed = Time.unscaledTime - speechStarted;
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
