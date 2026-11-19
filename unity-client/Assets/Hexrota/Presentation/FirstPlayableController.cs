using System;
using Hexrota.Gameplay;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Scene composition only. The runtime session owns commands, persistence,
    // attempt identity, lives, economics and outcomes.
    public sealed partial class FirstPlayableController : MonoBehaviour
    {
        [SerializeField] private HexrotaAssetCatalog assetCatalog;
        [SerializeField] private Camera boardCamera;
        [SerializeField] private RectTransform safe;
        [SerializeField] private CastleHomeView castleHome;
        [SerializeField] private RectTransform boardTrayPrefab;
        internal RectTransform SafeArea => safe;
        public static Func<UnityGameSession> SessionFactory = UnityGameSession.CreateDefault;
        public UnityGameSession Session { get; private set; }
        public HexBoardView Board { get; private set; }
        public string CurrentScreen { get; private set; }
        private GameObject menu, gameplay, modal;
        private RectTransform boardInput;
        private Text message, modalCopy;
        private RectTransform actions;
        private Button resumeButton;
        private Sprite roundedCard;
        private Texture2D cardTexture;
        private CoopSceneArt coopScene;
        // Colour tokens from src/styles/06-comic-adventure.css.
        private static readonly Color Gold = new Color32(255, 212, 105, 255);
        private static readonly Color Paper = new Color32(255, 242, 206, 255);
        private static readonly Color Ink = new Color32(75, 44, 84, 255);
        private static readonly Color Card = new Color32(33, 21, 53, 235);
        private Font font;
        private Vector2 lastScreen;
        private Rect lastSafe;
        private bool ready, requesting;

        private bool HasInterface
        {
            get
            {
                return this != null && isActiveAndEnabled && Board != null && boardCamera != null &&
                    safe != null && menu != null && gameplay != null && modal != null &&
                    castleHud != null && castleHud.IsReady && gameTools != null && message != null &&
                    modalCopy != null && actions != null;
            }
        }

        private void Awake()
        {
            ApplyFrameRate();
            Screen.sleepTimeout = SleepTimeout.SystemSetting;
            font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            CreateCardSprite();
            phoneAudio = gameObject.AddComponent<PhoneAudio>();
            BuildInterface();
            try { Session = SessionFactory(); ready = true; ShowMenu(); }
            catch (Exception error) { ShowError("Kayıt veya bölüm verisi açılamadı.\n" + error.Message); }
            UpdateLayout();
        }

        public void ConfigureSession(UnityGameSession session)
        {
            if (session == null) throw new ArgumentNullException("session");
            if (!HasInterface) return;
            CancelHomeRewards();
            if (Session != null) { Session.SetPlaytestActivity(false); Session.CancelPresentation(); }
            if (Board != null) Board.Cancel(null);
            Session = session; ready = true; ShowMenu();
        }

        private void BuildInterface()
        {
            if (boardCamera == null)
            {
                var cameraObject = new GameObject("BoardCamera");
                cameraObject.transform.SetParent(transform, false);
                boardCamera = cameraObject.AddComponent<Camera>();
            }
            var backgroundObject = new GameObject("ScreenBackgroundCamera");
            backgroundObject.transform.SetParent(transform, false);
            var background = backgroundObject.AddComponent<Camera>();
            background.clearFlags = CameraClearFlags.SolidColor; background.cullingMask = 0;
            background.depth = boardCamera.depth - 1; background.backgroundColor = new Color(.055f,.10f,.12f);
            boardCamera.orthographic = true; boardCamera.clearFlags = CameraClearFlags.SolidColor;
            boardCamera.backgroundColor = new Color(.055f, .10f, .12f);
            boardCamera.nearClipPlane = .1f; boardCamera.farClipPlane = 100;
            if (FindAnyObjectByType<EventSystem>() == null)
            {
                var events = new GameObject("EventSystem");
                events.transform.SetParent(transform, false);
                events.AddComponent<EventSystem>(); events.AddComponent<StandaloneInputModule>();
            }
            if (safe == null)
            {
                var canvasObject = new GameObject("MobileUI", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
                canvasObject.transform.SetParent(transform, false);
                canvasObject.GetComponent<Canvas>().renderMode = RenderMode.ScreenSpaceOverlay;
                var scaler = canvasObject.GetComponent<CanvasScaler>();
                scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
                scaler.referenceResolution = new Vector2(720, 1280); scaler.matchWidthOrHeight = .5f;
                safe = Rect("SafeArea", canvasObject.transform, Vector2.zero, Vector2.one);
            }
            BuildGameplayScreen();

            BuildPhoneHome();
            modal = Panel("ModalOverlay",safe,Vector2.zero,Vector2.one,Card);
            modalCopy = Label("ModalCopy",modal.transform,"",new Vector2(.08f,.49f),new Vector2(.92f,.70f),27,TextAnchor.MiddleCenter);
            actions = Rect("Actions",modal.transform,new Vector2(.08f,.09f),new Vector2(.92f,.46f));
            modal.SetActive(false); gameplay.SetActive(false);
            var tray = boardTrayPrefab != null ? boardTrayPrefab :
                Resources.Load<GameObject>("CastleGame/CastleBoardTray").GetComponent<RectTransform>();
            coopScene = CoopSceneArt.Create(background, boardCamera, tray);
            CreateChapterEntrance();
        }

        public void BeginLevelOne() { if (ready) BeginStage(Session.TutorialCount); }

        public void BeginJourney()
        {
            if (!ready || !HasInterface || IsEnteringStage) return;
            int next = Session.NextStage;
            if (next < 0) { OpenGarden(); return; }
            var stage = Session.GetChapterPreview(next);
            if (next == Session.TutorialCount || stage.Resume || stage.Rescue) BeginStage(next);
            else OpenMobilePreview(next);
        }

        public void BeginStage(int index)
        {
            if (!ready || !HasInterface || IsEnteringStage) return;
            CancelPresentation();
            if (!Session.EnterStage(index)) { ShowCommandFailure(Session.LastError); return; }
            OpenCurrentBoard();
        }

        public void ContinueAfterWin()
        {
            if (!ready || !HasInterface || CurrentScreen != "result" || Session.Status != "won") return;
            if (Session.ActiveStage < Session.TutorialCount - 1)
            {
                if (Session.StartChapterFresh(Session.ActiveStage + 1)) OpenCurrentBoard();
                else ShowCommandFailure(Session.LastError);
                return;
            }
            int next = Session.NextCampaignStage;
            if (next < 0) OpenGarden(); else OpenMobilePreview(next);
        }

        public void OpenJourney()
        {
            if (!ready || !HasInterface) return;
            LeaveAttemptForMenu();
            CurrentScreen = "journey"; gameplay.SetActive(false); menu.SetActive(true); modal.SetActive(false);
            Board.InputEnabled = false; boardCamera.enabled = false;
            RefreshScene(); DrawJourney();
        }

        internal void OpenRecords() { DrawRecordsPage(); }

        public void OpenGarden() { DrawGardenPage(); }

        private void RefreshScene()
        {
            int progress=Session.CompletedSceneTutorials;
            coopScene.Refresh(progress>=1,progress>=2,CurrentScreen=="menu",gameplay.activeSelf);
        }

        public void RequestSwap(int a, int b)
        {
            if (!ready || !HasInterface || !Board.CanPresent || !Board.InputEnabled || requesting || CurrentScreen != "playing" || Board.IsAnimating || Session.Status != "playing") return;
            if (!Board.AcceptsOpeningSwap(a, b)) return;
            requesting = true;
            try
            {
                if (Session.IsTutorial) Board.MarkPair(null);
                var receipt = Session.TrySwap(a, b);
                if (receipt.Ok && openingPair != null) pendingGroundTip = Session.AttemptId;
                HideOpeningLesson();
                if (receipt.Ok) Board.PlayerMoved(receipt.After);
                Board.InputEnabled = false;
                message.text = receipt.Ok ? "" : RejectionText(receipt.Reason);
                if (!receipt.Ok && receipt.Reason != "neighbor" && receipt.Reason != "no-match" && receipt.Reason != "invalid_swap" && receipt.Reason != "not_adjacent" && receipt.Reason != "no_match")
                {
                    Board.Cancel(Session.Snapshot); Session.CancelPresentation(); Board.InputEnabled = Session.Status == "playing";
                    if (!string.IsNullOrEmpty(Session.LastError)) message.text = RejectionText(Session.LastError);
                    RefreshTutorial(false); RefreshCounters(); return;
                }
                Board.Present(receipt);
                if (receipt.Ok && Session.IsTutorial) RenderLessonCard(true);
            }
            catch (Exception error) { CancelPresentation(); ShowError("Hamle tamamlanamadı.\n" + error.Message); }
            finally { requesting = false; }
        }

        private void FinishPresentation()
        {
            if (!ready || !HasInterface) return;
            FinishScoreFeedback();
            Session.CompletePresentation(); RefreshCounters();
            Board.InputEnabled = CurrentScreen == "playing" && Session.Status == "playing";
            RefreshTutorial(false); RefreshScene(); EvaluateOutcome(liveMove: true);
        }
        private void CancelBoardPresentation()
        {
            ClearScoreFeedback();
            if (Session != null) Session.CancelPresentation();
        }
        private void EvaluateOutcome(bool liveMove = false)
        {
            if (!ready || !Session.HasAttempt || Session.Status == "playing" || CurrentScreen == "celebration") return;
            ClearScoreFeedback();
            Board.InputEnabled = false;
            if (liveMove && CurrentScreen == "playing" && Session.Status == "won" && !Session.IsTutorial)
            {
                ShowChapterVictory();
                return;
            }
            CurrentScreen = "result";
            if (Session.Status == "won") DrawWin(); else DrawLoss();
        }

        public void Pause()
        {
            if (ready && HasInterface && CurrentScreen == "celebration")
            {
                Session.Suspend();
                FinishChapterVictory();
                return;
            }
            if (ready && HasInterface && IsEnteringStage) FinishInterruptedEntrance();
            if (!ready || !HasInterface || CurrentScreen != "playing") return;
            CancelPresentation(); Session.Suspend(); RefreshCounters();
            if (Session.Status != "playing") { EvaluateOutcome(); return; }
            CurrentScreen = "paused"; Board.InputEnabled = false;
            if (phoneAudio != null) phoneAudio.Configure(Session, false);
            ShowPauseMenu();
        }
        private void ShowPauseMenu() { DrawPause(); }
        public void Resume()
        {
            if (!ready || !HasInterface || CurrentScreen != "paused") return;
            CurrentScreen = "playing"; modal.SetActive(false); Board.Render(Session.Snapshot);
            if (phoneAudio != null) phoneAudio.Configure(Session, true);
            Board.InputEnabled = Session.Status == "playing"; RefreshTutorial(true); EvaluateOutcome();
        }
        internal void ConfirmRestart() { DrawRestart(); }
        private void ReopenPause() { CurrentScreen = "playing"; Pause(); }
        public void Restart()
        {
            RestartWithQuote(null);
        }
        private void RestartWithQuote(int? maximumCharge)
        {
            if (!ready || !HasInterface) return;
            CancelPresentation();
            if (!Session.Restart(maximumCharge)) { ShowCommandFailure(Session.LastError); return; }
            OpenCurrentBoard();
        }
        public void Retry()
        {
            if (!ready || !HasInterface) return;
            CancelPresentation();
            if (!Session.Retry()) { ShowCommandFailure(Session.LastError); return; }
            OpenCurrentBoard();
        }
        private void OpenCurrentBoard(bool animateEntry = true)
        {
            CancelHomeRewards();
            if (animateEntry && Session.Status == "playing") StartChapterEntrance();
            else
            {
                CurrentScreen = "playing";
                PrepareCurrentBoard();
                EnableCurrentBoard();
            }
        }

        private void PrepareCurrentBoard()
        {
            ClearScoreFeedback();
            Session.SetPlaytestActivity(false);
            HideReviewControl();
            menu.SetActive(false); gameplay.SetActive(true); modal.SetActive(false);
            boardCamera.enabled = true;
            Board.BindIdleHints(Session.IsTutorial ? null : Session.AttemptId, Session.ChooseIdleHint);
            Board.Build(Session.Level,Session.Snapshot,Session.UsesNineByNineFrame);
            message.text = "";
            Board.InputEnabled = false;
            RefreshScene(); RefreshCounters(); UpdateLayout();
        }

        private void EnableCurrentBoard()
        {
            Board.InputEnabled = Session.Status == "playing";
            RefreshTutorial(true); EvaluateOutcome();
        }
        public void AcknowledgeTutorial()
        {
            if (!ready || CurrentScreen != "playing" || Board.IsAnimating || !Session.AcknowledgeTutorial()) return;
            RefreshTutorial(true);
        }


        public void ReturnToMenu()
        {
            if (!ready || !HasInterface) return;
            RememberHomeRewards();
            CancelPresentation(); Session.ReturnToMenu(); ShowMenu();
        }

        private void LeaveAttemptForMenu()
        {
            if (!Session.HasAttempt) return;
            RememberHomeRewards();
            CancelPresentation();
            Session.ReturnToMenu();
        }
        private void ShowMenu()
        {
            if (chapterVictory != null) chapterVictory.Hide();
            StopChapterEntrance();
            CurrentScreen = "menu"; menu.SetActive(true); gameplay.SetActive(false); modal.SetActive(false);
            Board.InputEnabled = false; boardCamera.enabled = false;
            RefreshScene();
            DrawHome();
        }
        private void ShowCommandFailure(string reason)
        {
            Board.InputEnabled = false;
            ShowModal("İŞLEM TAMAMLANAMADI",RejectionText(reason),CurrentScreen=="paused"?(Action)ReopenPause:ReturnToMenu);
            if (CurrentScreen == "paused") AddAction("Geri",0,ReopenPause);
            AddAction("Ana Menü",1,ReturnToMenu);
        }
        private void ShowError(string details)
        {
            CurrentScreen = "error"; if (Board != null) Board.InputEnabled = false;
            ShowModal("OYUN AÇILAMADI",details,ready?(Action)ReturnToMenu:null);
            if (ready) AddAction("Ana Menü",0,ReturnToMenu);
        }
        private void CancelPresentation(bool restoreVisuals = true)
        {
            HideOpeningLesson();
            if (chapterVictory != null) chapterVictory.Hide();
            StopChapterEntrance();
            ClearScoreFeedback();
            if (Session != null) Session.CancelPresentation();
            if (Board != null) Board.Cancel(!restoreVisuals || Session == null || !Session.HasAttempt ? null : Session.Snapshot);
        }
        public void OnWebVisibilityChanged(string hidden)
        {
            if (hidden == "hidden") SuspendSafely();
        }
        private static void ApplyFrameRate()
        {
            var refresh = Screen.currentResolution.refreshRateRatio;
            UnityEngine.Application.targetFrameRate = UnityEngine.Application.isMobilePlatform &&
                refresh.numerator > 0 && refresh.denominator > 0
                ? Mathf.RoundToInt((float)refresh.value) : 60;
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused) SuspendSafely();
            else ApplyFrameRate();
        }
        private void OnApplicationFocus(bool focused) { if (!focused) SuspendSafely(); }
        private void SuspendSafely()
        {
            if (!ready || !HasInterface) return;
            CancelHomeRewards();
            Session.SetPlaytestActivity(false);
            if (optionsShade != null) CloseMobileOptions();
            if (phoneAudio != null) phoneAudio.Configure(Session, false);
            if (CurrentScreen == "inventory") CloseInventory();
            if (CurrentScreen == "playing" || CurrentScreen == "celebration" || IsEnteringStage) Pause();
            else { CancelPresentation(); Session.Suspend(); }
        }
        private void OnDisable()
        {
            if (!ready) return;
            CancelHomeRewards();
            if (IsEnteringStage)
            {
                prepareOnEnable = !entrancePrepared;
                CurrentScreen = "paused";
            }
            Session.SetPlaytestActivity(false);
            if (phoneAudio != null) phoneAudio.Configure(Session, false);
            // Detached world objects and UI children may already be gone. Stop
            // presentation without redrawing anything during teardown.
            if (Board != null) Board.InputEnabled = false;
            CancelPresentation(false); Session.Suspend();
            if (CurrentScreen == "playing" || CurrentScreen == "inventory" || CurrentScreen == "celebration") CurrentScreen = "paused";
        }
        private void OnEnable()
        {
            if (!ready || !HasInterface || CurrentScreen != "paused") return;
            if (prepareOnEnable) { prepareOnEnable = false; PrepareCurrentBoard(); }
            Board.Render(Session.Snapshot); RefreshCounters();
            if (Session.Status != "playing") { EvaluateOutcome(); return; }
            ShowPauseMenu();
        }
        private void OnDestroy()
        {
            StopChapterEntrance();
            if (chapterVictory != null) Destroy(chapterVictory.gameObject);
            if (chapterLoading != null) Destroy(chapterLoading.gameObject);
            if (roundedCard != null) Destroy(roundedCard);
            if (cardTexture != null) Destroy(cardTexture);
            ready = false;
            if (Session != null) Session.CancelPresentation();
            if (Board != null)
            {
                Board.SwapRequested -= RequestSwap;
                Board.PresentationCompleted -= FinishPresentation;
                Board.PresentationCancelled -= CancelBoardPresentation;
                Board.PresentationStarted -= BeginScoreFeedback; Board.WaveProgress -= DrawScoreWave;
                Board.Cancel(null);
            }
        }
        private void Update()
        {
            if(ready && Session.PlaytestEnabled)
                Session.SetPlaytestActivity(CurrentScreen=="playing" && optionsShade==null && Board!=null && Board.InputEnabled && !Board.IsAnimating);
            if (refillTimer != null && Time.unscaledTime >= lifeRefresh) UpdateLifeTimer();
            if (optionsShade != null && Input.GetKeyDown(KeyCode.Escape)) { CloseMobileOptions(); return; }
            if (ready && BeganTouch())
            {
                if (castleHome != null) castleHome.RegisterTouch();
                phoneAudio.Configure(Session, optionsShade == null && CurrentScreen != "paused", true);
            }
            if (ready) TickPhoneLife();
            if (Screen.width != lastScreen.x || Screen.height != lastScreen.y || Screen.safeArea != lastSafe) UpdateLayout();
            if (Input.GetKeyDown(KeyCode.Escape)) { if (CurrentScreen == "playing" || IsEnteringStage) Pause(); else if (CurrentScreen == "paused") Resume(); }
        }

        private static bool BeganTouch()
        {
            if (Input.GetMouseButtonDown(0)) return true;
            for (int i = 0; i < Input.touchCount; i++)
                if (Input.GetTouch(i).phase == TouchPhase.Began) return true;
            return false;
        }
        private void UpdateLayout()
        {
            if (safe == null || Board == null) return;
            lastScreen = new Vector2(Screen.width,Screen.height); lastSafe = Screen.safeArea;
            Rect normalized = MobileLayout.SafeArea(new Rect(0,0,Screen.width,Screen.height),lastSafe);
            safe.anchorMin = normalized.min; safe.anchorMax = normalized.max; safe.offsetMin = safe.offsetMax = Vector2.zero;
            LayoutGameplay(normalized);
            if (IsEnteringStage && entrancePrepared) SetHudEntrance(hudProgress);
        }
        private void ShowModal(string heading, string copy, Action close = null)
        {
            ShowPhoneSheet(heading, copy, "", 526, close);
        }

        private Button AddAction(string text, int slot, Action action)
        {
            return SheetButton(text, 22, 210 + slot * 58, 316, 48, action, slot == 0 ? SheetStyle.Primary : SheetStyle.Secondary);
        }
        private Button MakeButton(string text,Transform parent,Vector2 min,Vector2 max,Action action)
        {
            var panel = Panel(text,parent,min,max,Gold);
            Round(panel);
            var button = panel.AddComponent<Button>(); button.targetGraphic = panel.GetComponent<Image>();
            button.onClick.AddListener(() => action());
            var textLabel = Label("Label",panel.transform,text,new Vector2(.025f,.05f),new Vector2(.975f,.95f),26,TextAnchor.MiddleCenter);
            textLabel.color = Ink; textLabel.fontStyle = FontStyle.Bold;
            return button;
        }
        private void CreateCardSprite()
        {
            // One shared sliced sprite keeps corners smooth on different phone aspect ratios.
            const int size = 40;
            const int radius = 18;
            cardTexture = new Texture2D(size,size,TextureFormat.RGBA32,false);
            cardTexture.wrapMode = TextureWrapMode.Clamp;
            var pixels = new Color32[size * size];
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                var point = new Vector2(x + .5f, y + .5f);
                var center = new Vector2(Mathf.Clamp(point.x,radius,size-radius),Mathf.Clamp(point.y,radius,size-radius));
                float coverage = Mathf.Clamp01(radius + .5f - Vector2.Distance(point,center));
                pixels[y*size+x] = new Color32(255,255,255,(byte)(255*coverage));
            }
            cardTexture.SetPixels32(pixels); cardTexture.Apply(false,true);
            roundedCard = Sprite.Create(cardTexture,new UnityEngine.Rect(0,0,size,size),new Vector2(.5f,.5f),100,
                0,SpriteMeshType.FullRect,new Vector4(radius,radius,radius,radius));
        }
        private void Round(GameObject panel)
        {
            var image = panel.GetComponent<Image>();
            image.sprite = roundedCard; image.type = Image.Type.Sliced;
        }
        private static void Emphasize(Text label)
        {
            label.fontStyle = FontStyle.Bold;
            var shadow = label.gameObject.AddComponent<Shadow>();
            shadow.effectColor = new Color(0.13f,.06f,.10f,.75f); shadow.effectDistance = new Vector2(2,-3);
        }

        private Text Label(string name,Transform parent,string text,Vector2 min,Vector2 max,int size,TextAnchor alignment)
        {
            var rectangle = Rect(name,parent,min,max); var label = rectangle.gameObject.AddComponent<Text>();
            label.font = font; label.text = text; label.fontSize = size; label.alignment = alignment;
            label.color = Paper; label.raycastTarget = false;
            label.horizontalOverflow = HorizontalWrapMode.Wrap; label.verticalOverflow = VerticalWrapMode.Overflow;
            label.resizeTextForBestFit = true; label.resizeTextMinSize = Mathf.Max(14,size-8); label.resizeTextMaxSize = size;
            return label;
        }
        private static GameObject Panel(string name,Transform parent,Vector2 min,Vector2 max,Color color)
        {
            var rectangle = Rect(name,parent,min,max); rectangle.gameObject.AddComponent<Image>().color = color; return rectangle.gameObject;
        }
        private static RectTransform Rect(string name,Transform parent,Vector2 min,Vector2 max)
        {
            var obj = new GameObject(name,typeof(RectTransform)); var rectangle = (RectTransform)obj.transform;
            rectangle.SetParent(parent,false); rectangle.anchorMin = min; rectangle.anchorMax = max;
            rectangle.offsetMin = rectangle.offsetMax = Vector2.zero; rectangle.localScale = Vector3.one;
            return rectangle;
        }
        private static string RejectionText(string reason)
        {
            switch (reason)
            {
                case "guided_swap_required": return "Önce işaretli taşların yerini değiştir.";
                case "no-match": case "no_match": case "invalid_swap": return "Bu takas bir eşleşme oluşturmuyor.";
                case "neighbor": case "not_adjacent": case "not_adjacent_cells": return "Komşu iki taş seç.";
                case "lives_empty": return "Canın kalmadı. Yenilenmesini bekleyip tekrar dene.";
                case "level_completed": case "already_completed": return "Bu bölüm kalıcı olarak tamamlandı.";
                case "presentation_busy": return "Hamle animasyonu sürüyor.";
                default: return "İşlem uygulanmadı: " + (reason ?? "bilinmeyen hata");
            }
        }
    }
}
