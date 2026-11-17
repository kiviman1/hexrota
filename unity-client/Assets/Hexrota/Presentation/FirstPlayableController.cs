using System;
using Hexrota.Gameplay;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Scene composition only. The runtime session owns commands, persistence,
    // attempt identity, lives, economics and outcomes.
    public sealed class FirstPlayableController : MonoBehaviour
    {
        [SerializeField] private HexrotaAssetCatalog assetCatalog;
        [SerializeField] private Camera boardCamera;
        public static Func<UnityGameSession> SessionFactory = UnityGameSession.CreateDefault;
        public UnityGameSession Session { get; private set; }
        public HexBoardView Board { get; private set; }
        public string CurrentScreen { get; private set; }
        private Canvas canvas;
        private RectTransform safe;
        private GameObject menu, gameplay, modal;
        private RectTransform boardInput;
        private Text title, counters, message, modalTitle, modalCopy, menuCopy;
        private RectTransform actions;
        private Button resumeButton;
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
                    title != null && counters != null && message != null && menuCopy != null &&
                    modalTitle != null && modalCopy != null && actions != null;
            }
        }

        private void Awake()
        {
            UnityEngine.Application.targetFrameRate = 30;
            Screen.sleepTimeout = SleepTimeout.SystemSetting;
            font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            BuildInterface();
            try { Session = SessionFactory(); ready = true; ShowMenu(); }
            catch (Exception error) { ShowError("Kayıt veya bölüm verisi açılamadı.\n" + error.Message); }
            UpdateLayout();
        }

        public void ConfigureSession(UnityGameSession session)
        {
            if (session == null) throw new ArgumentNullException("session");
            if (!HasInterface) return;
            if (Session != null) Session.CancelPresentation();
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
            if (FindFirstObjectByType<EventSystem>() == null)
            {
                var events = new GameObject("EventSystem");
                events.transform.SetParent(transform, false);
                events.AddComponent<EventSystem>(); events.AddComponent<StandaloneInputModule>();
            }
            var canvasObject = new GameObject("MobileUI", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(transform, false); canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(720, 1280); scaler.matchWidthOrHeight = .5f;
            safe = Rect("SafeArea", canvasObject.transform, Vector2.zero, Vector2.one);
            gameplay = Rect("Gameplay", safe, Vector2.zero, Vector2.one).gameObject;
            title = Label("LevelTitle", gameplay.transform, "BÖLÜM 1", new Vector2(.04f,.91f),new Vector2(.96f,.98f),36,TextAnchor.MiddleLeft);
            counters = Label("Counters", gameplay.transform, "", new Vector2(.04f,.78f),new Vector2(.96f,.91f),30,TextAnchor.MiddleLeft);
            boardInput = Rect("BoardInput", gameplay.transform, new Vector2(.025f,.23f),new Vector2(.975f,.76f));
            var touch = boardInput.gameObject.AddComponent<Image>(); touch.color = new Color(1,1,1,.001f);
            Board = boardInput.gameObject.AddComponent<HexBoardView>(); Board.Initialize(boardCamera, assetCatalog);
            Board.SwapRequested += RequestSwap;
            Board.PresentationCompleted += FinishPresentation;
            Board.PresentationCancelled += CancelBoardPresentation;
            message = Label("Feedback", gameplay.transform, "Bir taş seç, komşusuna dokun veya sürükle.", new Vector2(.05f,.15f),new Vector2(.95f,.22f),24,TextAnchor.MiddleCenter);
            MakeButton("Duraklat",gameplay.transform,new Vector2(.05f,.065f),new Vector2(.95f,.14f),Pause);
            Label("PlaceholderNotice",gameplay.transform,"Geçici görseller",new Vector2(.05f,.01f),new Vector2(.95f,.05f),18,TextAnchor.MiddleCenter).color = new Color(.55f,.66f,.65f);
            menu = Panel("MainMenu",safe,Vector2.zero,Vector2.one,new Color(.055f,.10f,.12f));
            Label("Brand",menu.transform,"HEXROTA",new Vector2(.07f,.70f),new Vector2(.93f,.84f),68,TextAnchor.MiddleCenter).color = new Color(.89f,.88f,.60f);
            Label("Subtitle",menu.transform,"Bahçeye giden her hamle",new Vector2(.07f,.61f),new Vector2(.93f,.70f),28,TextAnchor.MiddleCenter);
            menuCopy = Label("MenuCopy",menu.transform,"Bölüm 1\nSayıları eşleştir, zemini yeşert.",new Vector2(.07f,.39f),new Vector2(.93f,.57f),28,TextAnchor.MiddleCenter);
            MakeButton("Bölüm 1 • Başla / Devam et",menu.transform,new Vector2(.08f,.24f),new Vector2(.92f,.34f),BeginLevelOne);
            Label("PreviewNotice",menu.transform,"9.11 Unity geliştirme sürümü\nGeçici görseller",new Vector2(.08f,.07f),new Vector2(.92f,.18f),21,TextAnchor.MiddleCenter).color = new Color(.55f,.66f,.65f);
            modal = Panel("ModalOverlay",safe,Vector2.zero,Vector2.one,new Color(.025f,.05f,.06f,.96f));
            modalTitle = Label("ModalTitle",modal.transform,"",new Vector2(.08f,.71f),new Vector2(.92f,.83f),42,TextAnchor.MiddleCenter);
            modalCopy = Label("ModalCopy",modal.transform,"",new Vector2(.08f,.49f),new Vector2(.92f,.70f),27,TextAnchor.MiddleCenter);
            actions = Rect("Actions",modal.transform,new Vector2(.08f,.09f),new Vector2(.92f,.46f));
            modal.SetActive(false); gameplay.SetActive(false);
        }

        public void BeginLevelOne()
        {
            if (!ready || !HasInterface) return;
            CancelPresentation();
            if (!Session.EnterLevelOne()) { ShowCommandFailure(Session.LastError); return; }
            CurrentScreen = "playing"; menu.SetActive(false); gameplay.SetActive(true); modal.SetActive(false);
            Board.Build(Session.Level, Session.Snapshot); Board.InputEnabled = Session.Status == "playing";
            boardCamera.enabled = true; RefreshCounters(); UpdateLayout(); EvaluateOutcome();
        }

        public void RequestSwap(int a, int b)
        {
            if (!ready || !HasInterface || !Board.CanPresent || requesting || CurrentScreen != "playing" || Board.IsAnimating || Session.Status != "playing") return;
            requesting = true;
            try
            {
                var receipt = Session.TrySwap(a, b);
                Board.InputEnabled = false;
                message.text = receipt.Ok ? "" : RejectionText(receipt.Reason);
                if (!receipt.Ok && receipt.Reason != "neighbor" && receipt.Reason != "no-match" && receipt.Reason != "invalid_swap" && receipt.Reason != "not_adjacent" && receipt.Reason != "no_match")
                {
                    Board.Cancel(Session.Snapshot); Session.CancelPresentation(); Board.InputEnabled = Session.Status == "playing";
                    if (!string.IsNullOrEmpty(Session.LastError)) message.text = RejectionText(Session.LastError);
                    RefreshCounters(); return;
                }
                Board.Present(receipt);
            }
            catch (Exception error) { CancelPresentation(); ShowError("Hamle tamamlanamadı.\n" + error.Message); }
            finally { requesting = false; }
        }

        private void FinishPresentation()
        {
            if (!ready || !HasInterface) return;
            Session.CompletePresentation(); RefreshCounters();
            Board.InputEnabled = CurrentScreen == "playing" && Session.Status == "playing";
            EvaluateOutcome();
        }
        private void CancelBoardPresentation()
        {
            if (Session != null) Session.CancelPresentation();
        }
        private void RefreshCounters()
        {
            if (!Session.HasAttempt) return;
            var snapshot = Session.Snapshot; int green = 0;
            foreach (int layers in snapshot.layers) if (layers == 0) green++;
            title.text = "BÖLÜM 1";
            counters.text = "Hamle  " + snapshot.movesLeft + "    Puan  " + snapshot.score + " / " + Session.Level.target +
                "\nYeşil zemin  " + green + " / " + snapshot.layers.Length;
        }
        private void EvaluateOutcome()
        {
            if (!ready || !Session.HasAttempt || Session.Status == "playing") return;
            CurrentScreen = "result"; Board.InputEnabled = false;
            string details = "Puan: " + Session.Snapshot.score + "\nKalan hamle: " + Session.Snapshot.movesLeft;
            if (Session.Status == "won")
            {
                ShowModal("BAHÇE YEŞERDİ!",details + "\nBu bölüm kalıcı olarak tamamlandı.");
                AddAction("Ana Menü",0,ReturnToMenu);
            }
            else
            {
                ShowModal("YENİ BİR DENEME",details);
                AddAction("Tekrar dene",0,Retry);
                AddAction("Ana Menü",1,ReturnToMenu);
            }
        }
        public void Pause()
        {
            if (!ready || !HasInterface || CurrentScreen != "playing") return;
            CancelPresentation(); Session.Suspend(); RefreshCounters();
            if (Session.Status != "playing") { EvaluateOutcome(); return; }
            CurrentScreen = "paused"; Board.InputEnabled = false;
            ShowPauseMenu();
        }
        private void ShowPauseMenu()
        {
            ShowModal("DURAKLATILDI","Hamlen ve ilerlemen kaydedildi.");
            resumeButton = AddAction("Devam et",0,Resume);
            AddAction("Yeniden başlat",1,ConfirmRestart);
            AddAction("Ana Menü",2,ReturnToMenu);
        }
        public void Resume()
        {
            if (!ready || !HasInterface || CurrentScreen != "paused") return;
            CurrentScreen = "playing"; modal.SetActive(false); Board.Render(Session.Snapshot);
            Board.InputEnabled = Session.Status == "playing"; EvaluateOutcome();
        }
        private void ConfirmRestart()
        {
            ShowModal("YENİDEN BAŞLAT?","Geçerli deneme kapanır. Oynanmış bir denemeyi yeniden başlatmak can harcayabilir.");
            AddAction("Yeniden başlat",0,Restart); AddAction("Vazgeç",1,ReopenPause);
        }
        private void ReopenPause() { CurrentScreen = "playing"; Pause(); }
        public void Restart()
        {
            if (!ready || !HasInterface) return;
            CancelPresentation();
            if (!Session.Restart()) { ShowCommandFailure(Session.LastError); return; }
            OpenCurrentBoard();
        }
        public void Retry()
        {
            if (!ready || !HasInterface) return;
            CancelPresentation();
            if (!Session.Retry()) { ShowCommandFailure(Session.LastError); return; }
            OpenCurrentBoard();
        }
        private void OpenCurrentBoard()
        {
            CurrentScreen = "playing"; menu.SetActive(false); gameplay.SetActive(true); modal.SetActive(false);
            Board.Build(Session.Level,Session.Snapshot); Board.InputEnabled = true; boardCamera.enabled = true;
            message.text = "Bir taş seç, komşusuna dokun veya sürükle."; RefreshCounters(); UpdateLayout();
        }
        public void ReturnToMenu()
        {
            if (!ready || !HasInterface) return;
            CancelPresentation(); Session.ReturnToMenu(); ShowMenu();
        }
        private void ShowMenu()
        {
            CurrentScreen = "menu"; menu.SetActive(true); gameplay.SetActive(false); modal.SetActive(false);
            Board.InputEnabled = false; boardCamera.enabled = true;
            if (!string.IsNullOrEmpty(Session.LastError)) menuCopy.text = RejectionText(Session.LastError);
        }
        private void ShowCommandFailure(string reason)
        {
            Board.InputEnabled = false;
            ShowModal("İŞLEM TAMAMLANAMADI",RejectionText(reason));
            if (CurrentScreen == "paused") AddAction("Geri",0,ReopenPause);
            AddAction("Ana Menü",1,ReturnToMenu);
        }
        private void ShowError(string details)
        {
            CurrentScreen = "error"; if (Board != null) Board.InputEnabled = false;
            ShowModal("OYUN AÇILAMADI",details);
            if (ready) AddAction("Ana Menü",0,ReturnToMenu);
        }
        private void CancelPresentation(bool restoreVisuals = true)
        {
            if (Session != null) Session.CancelPresentation();
            if (Board != null) Board.Cancel(!restoreVisuals || Session == null || !Session.HasAttempt ? null : Session.Snapshot);
        }
        public void OnWebVisibilityChanged(string hidden)
        {
            if (hidden == "hidden") SuspendSafely();
        }
        private void OnApplicationPause(bool paused) { if (paused) SuspendSafely(); }
        private void OnApplicationFocus(bool focused) { if (!focused) SuspendSafely(); }
        private void SuspendSafely()
        {
            if (!ready || !HasInterface) return;
            if (CurrentScreen == "playing") Pause();
            else { CancelPresentation(); Session.Suspend(); }
        }
        private void OnDisable()
        {
            if (!ready) return;
            // Detached world objects and UI children may already be gone. Stop
            // presentation without redrawing anything during teardown.
            if (Board != null) Board.InputEnabled = false;
            CancelPresentation(false); Session.Suspend();
            if (CurrentScreen == "playing") CurrentScreen = "paused";
        }
        private void OnEnable()
        {
            if (!ready || !HasInterface || CurrentScreen != "paused") return;
            Board.Render(Session.Snapshot); RefreshCounters();
            if (Session.Status != "playing") { EvaluateOutcome(); return; }
            ShowPauseMenu();
        }
        private void OnDestroy()
        {
            ready = false;
            if (Session != null) Session.CancelPresentation();
            if (Board != null)
            {
                Board.SwapRequested -= RequestSwap;
                Board.PresentationCompleted -= FinishPresentation;
                Board.PresentationCancelled -= CancelBoardPresentation;
                Board.Cancel(null);
            }
        }
        private void Update()
        {
            if (Screen.width != lastScreen.x || Screen.height != lastScreen.y || Screen.safeArea != lastSafe) UpdateLayout();
            if (Input.GetKeyDown(KeyCode.Escape)) { if (CurrentScreen == "playing") Pause(); else if (CurrentScreen == "paused") Resume(); }
        }
        private void UpdateLayout()
        {
            if (safe == null || Board == null) return;
            lastScreen = new Vector2(Screen.width,Screen.height); lastSafe = Screen.safeArea;
            Rect normalized = MobileLayout.SafeArea(new Rect(0,0,Screen.width,Screen.height),lastSafe);
            safe.anchorMin = normalized.min; safe.anchorMax = normalized.max; safe.offsetMin = safe.offsetMax = Vector2.zero;
            Board.SetViewport(normalized);
        }
        private void ShowModal(string heading,string copy)
        {
            foreach (Transform child in actions) Destroy(child.gameObject);
            modalTitle.text = heading; modalCopy.text = copy; modal.SetActive(true); modal.transform.SetAsLastSibling();
        }
        private Button AddAction(string text,int slot,Action action)
        {
            float top = 1 - slot * .29f;
            return MakeButton(text,actions,new Vector2(0,top-.25f),new Vector2(1,top),action);
        }
        private Button MakeButton(string text,Transform parent,Vector2 min,Vector2 max,Action action)
        {
            var panel = Panel(text,parent,min,max,new Color(.29f,.44f,.33f));
            var button = panel.AddComponent<Button>(); button.targetGraphic = panel.GetComponent<Image>();
            button.onClick.AddListener(() => action());
            Label("Label",panel.transform,text,new Vector2(.025f,.05f),new Vector2(.975f,.95f),26,TextAnchor.MiddleCenter);
            return button;
        }
        private Text Label(string name,Transform parent,string text,Vector2 min,Vector2 max,int size,TextAnchor alignment)
        {
            var rectangle = Rect(name,parent,min,max); var label = rectangle.gameObject.AddComponent<Text>();
            label.font = font; label.text = text; label.fontSize = size; label.alignment = alignment;
            label.color = new Color(.89f,.93f,.86f); label.raycastTarget = false;
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
