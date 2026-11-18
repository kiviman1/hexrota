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
        private Button resumeButton, playButton, acknowledgeButton, hintButton, inventoryButton;
        private Text heroTitle, menuWallet, menuProgress, movesCounter, coachHeading;
        private GameObject coachPortrait;
        private GameObject freshHome, returningHome;
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
                    title != null && counters != null && message != null && menuCopy != null &&
                    modalTitle != null && modalCopy != null && actions != null;
            }
        }

        private void Awake()
        {
            UnityEngine.Application.targetFrameRate = 30;
            Screen.sleepTimeout = SleepTimeout.SystemSetting;
            font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            CreateCardSprite();
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
            var hud = Panel("LevelHUD", gameplay.transform, new Vector2(0,.825f), Vector2.one, new Color32(83, 53, 112, 255));
            title = Label("LevelTitle", hud.transform, "", new Vector2(.04f,.73f),new Vector2(.97f,.98f),28,TextAnchor.MiddleLeft);
            title.fontStyle = FontStyle.Bold; title.color = Gold;
            var statCard = Panel("StageGoals",hud.transform,new Vector2(.04f,.09f),new Vector2(.735f,.72f),Paper);
            Round(statCard);
            counters = Label("Counters",statCard.transform,"",new Vector2(.04f,.05f),new Vector2(.96f,.95f),29,TextAnchor.MiddleCenter);
            counters.color = Ink; counters.fontStyle = FontStyle.Bold;
            var moveCard = Panel("RemainingMoves",hud.transform,new Vector2(.76f,.09f),new Vector2(.96f,.72f),Gold);
            Round(moveCard);
            movesCounter = Label("Moves",moveCard.transform,"",Vector2.zero,Vector2.one,31,TextAnchor.MiddleCenter);
            movesCounter.color = Ink; movesCounter.fontStyle = FontStyle.Bold;
            boardInput = Rect("BoardInput", gameplay.transform, new Vector2(.025f,.07f),new Vector2(.975f,.64f));
            var touch = boardInput.gameObject.AddComponent<Image>(); touch.color = new Color(1,1,1,.001f);
            Board = boardInput.gameObject.AddComponent<HexBoardView>(); Board.Initialize(boardCamera, assetCatalog);
            Board.SwapRequested += RequestSwap;
            Board.PresentationCompleted += FinishPresentation;
            Board.PresentationCancelled += CancelBoardPresentation;
            var coach = Panel("Coach", gameplay.transform, new Vector2(.025f,.665f), new Vector2(.975f,.815f), Paper);
            coachPortrait = Rect("CoachTavik",coach.transform,new Vector2(.02f,.10f),new Vector2(.23f,.90f)).gameObject;
            var portrait = coachPortrait.AddComponent<RawImage>(); portrait.texture = Resources.Load<Texture2D>("CoopArt/inspect");
            portrait.raycastTarget = false;
            coachHeading = Label("CoachHeading",coach.transform,"",new Vector2(.25f,.64f),new Vector2(.97f,.94f),21,TextAnchor.MiddleLeft);
            coachHeading.color = Ink;
            message = Label("Feedback",coach.transform,"",new Vector2(.25f,.06f),new Vector2(.97f,.67f),27,TextAnchor.MiddleLeft);
            Round(coach); message.color = Ink;
            var footer = Panel("Footer",gameplay.transform,Vector2.zero,new Vector2(1,.066f),Card);
            MakeButton("Menü",footer.transform,new Vector2(.025f,.12f),new Vector2(.25f,.88f),ReturnToMenu);
            MakeButton("Mola",footer.transform,new Vector2(.75f,.12f),new Vector2(.975f,.88f),Pause);
            hintButton = MakeButton("İpucu",footer.transform,new Vector2(.265f,.12f),new Vector2(.49f,.88f),ShowHint);
            inventoryButton = MakeButton("Çanta",footer.transform,new Vector2(.505f,.12f),new Vector2(.735f,.88f),OpenInventory);
            acknowledgeButton = MakeButton("Devam et",footer.transform,new Vector2(.32f,.12f),new Vector2(.68f,.88f),AcknowledgeTutorial);

            menu = Panel("MainMenu",safe,Vector2.zero,Vector2.one,Color.clear);
            freshHome = Rect("FirstOpening",menu.transform,Vector2.zero,Vector2.one).gameObject;
            var brand = Label("Brand",freshHome.transform,"⬢ HEXROTA.",new Vector2(.14f,.914f),new Vector2(.86f,.989f),48,TextAnchor.MiddleCenter);
            brand.color = Gold; Emphasize(brand);
            var speech = Panel("Speech",freshHome.transform,new Vector2(.19f,.733f),new Vector2(.81f,.786f),Paper);
            Round(speech);
            var speechCopy = Label("Label",speech.transform,"Buraya bir kümes kuralım!",Vector2.zero,Vector2.one,22,TextAnchor.MiddleCenter);
            speechCopy.color = Ink; speechCopy.fontStyle = FontStyle.Bold;
            var freshTitle = Label("HomeTitle",freshHome.transform,"Tavik’in\n<color=#FFD469>ilk kümesi.</color>",new Vector2(.06f,.36f),new Vector2(.94f,.485f),64,TextAnchor.MiddleCenter);
            Emphasize(freshTitle);
            var subtitle = Label("HomeCopy",freshHome.transform,"Eşleştir, ilerle ve kümesi birlikte kur.",new Vector2(.06f,.321f),new Vector2(.94f,.369f),25,TextAnchor.MiddleCenter);
            Emphasize(subtitle);
            var start = MakeButton("Başlayalım",freshHome.transform,new Vector2(.06f,.21f),new Vector2(.94f,.303f),BeginJourney);
            start.GetComponent<Image>().color = new Color32(62,150,31,255);
            var startLabel = start.GetComponentInChildren<Text>();
            startLabel.text = "Başlayalım\n<size=21>İlk hamleyi birlikte yapalım</size>"; startLabel.color = Paper; startLabel.fontSize = 37;
            returningHome = Rect("ReturningHome",menu.transform,Vector2.zero,Vector2.one).gameObject;
            var header = Panel("Header",returningHome.transform,new Vector2(0,.88f),Vector2.one,Card);
            Label("Brand",header.transform,"HEXROTA",new Vector2(.04f,.16f),new Vector2(.49f,.90f),49,TextAnchor.MiddleLeft).color = Gold;
            menuWallet = Label("Wallet",header.transform,"",new Vector2(.46f,.12f),new Vector2(.98f,.9f),22,TextAnchor.MiddleRight);
            var hero = Panel("HomeCard", returningHome.transform, new Vector2(.04f,.53f), new Vector2(.66f,.76f), Card);
            heroTitle = Label("HomeTitle",hero.transform,"",new Vector2(.06f,.06f),new Vector2(.95f,.94f),51,TextAnchor.MiddleLeft);
            heroTitle.color = Gold; heroTitle.fontStyle = FontStyle.Bold;
            var nextCard = Panel("NextStage",returningHome.transform,new Vector2(.04f,.385f),new Vector2(.96f,.505f),Card);
            menuCopy = Label("MenuCopy",nextCard.transform,"",new Vector2(.05f,.02f),new Vector2(.98f,.99f),27,TextAnchor.MiddleLeft);
            playButton = MakeButton("Oyna",returningHome.transform,new Vector2(.04f,.28f),new Vector2(.96f,.374f),BeginJourney);
            MakeButton("Bölüm yolculuğu",returningHome.transform,new Vector2(.04f,.18f),new Vector2(.61f,.258f),OpenJourney);
            MakeButton("Kayıtlar",returningHome.transform,new Vector2(.64f,.18f),new Vector2(.96f,.258f),() => OpenRecords(0));
            MakeButton("Bahçeni gör",returningHome.transform,new Vector2(.04f,.08f),new Vector2(.96f,.158f),OpenGarden);
            var progress = Panel("Progress",returningHome.transform,Vector2.zero,new Vector2(1,.065f),Card);
            menuProgress = Label("JourneyProgress",progress.transform,"",Vector2.zero,Vector2.one,22,TextAnchor.MiddleCenter);
            modal = Panel("ModalOverlay",safe,Vector2.zero,Vector2.one,Card);
            modalTitle = Label("ModalTitle",modal.transform,"",new Vector2(.08f,.71f),new Vector2(.92f,.83f),42,TextAnchor.MiddleCenter);
            modalCopy = Label("ModalCopy",modal.transform,"",new Vector2(.08f,.49f),new Vector2(.92f,.70f),27,TextAnchor.MiddleCenter);
            actions = Rect("Actions",modal.transform,new Vector2(.08f,.09f),new Vector2(.92f,.46f));
            modal.SetActive(false); gameplay.SetActive(false);
            coopScene = CoopSceneArt.Create(safe, background, boardCamera);
        }

        public void BeginLevelOne() { if (ready) BeginStage(Session.TutorialCount); }

        public void BeginJourney()
        {
            if (!ready || !HasInterface) return;
            int next = Session.NextStage;
            if (next < 0) { OpenGarden(); return; }
            BeginStage(next);
        }

        public void BeginStage(int index)
        {
            if (!ready || !HasInterface) return;
            CancelPresentation();
            if (!Session.EnterStage(index)) { ShowCommandFailure(Session.LastError); return; }
            OpenCurrentBoard();
        }

        public void ContinueAfterWin()
        {
            if (!ready || !HasInterface || CurrentScreen != "result" || Session.Status != "won") return;
            int next = Session.ActiveStage < Session.TutorialCount - 1 ? Session.ActiveStage + 1 : Session.NextCampaignStage;
            if (next < 0) OpenGarden(); else BeginStage(next);
        }

        public void OpenJourney()
        {
            if (!ready || !HasInterface) return;
            if (Session.HasAttempt) { CancelPresentation(); Session.ReturnToMenu(); }
            CurrentScreen = "journey"; gameplay.SetActive(false); menu.SetActive(false); boardCamera.enabled = false;
            RefreshScene();
            ShowModal("BÖLÜM YOLCULUĞU", Session.ClearedCount + " / " + (Session.StageCount - Session.TutorialCount) + " bölüm tamamlandı");
            // Web exposes both lessons and the next open campaign entry.
            int slot = 0;
            for (int i = 0; i < Session.StageCount; i++)
            {
                if (!Session.CanOpenStage(i)) continue;
                int index = i;
                string text = Session.StageLabel(i) + "  ·  " + Session.StageName(i);
                AddAction(text, slot++, () => BeginStage(index));
            }
            AddAction("Ana Menü",slot,ShowMenu);
        }

        private void OpenRecords(int page)
        {
            int first = Session.TutorialCount + 3 * page;
            CurrentScreen = "records"; menu.SetActive(false); gameplay.SetActive(false); boardCamera.enabled = false;
            RefreshScene();
            ShowModal("BÖLÜM KAYITLARI",Session.RecordSummary(first,3));
            int slot = 0;
            if (first + 3 < Session.StageCount) AddAction("Sonraki",slot++,() => OpenRecords(page + 1));
            if (page > 0) AddAction("Önceki",slot++,() => OpenRecords(page - 1));
            AddAction("Ana Menü",slot,ShowMenu);
        }

        public void OpenGarden()
        {
            if (!ready || !HasInterface) return;
            if (Session.HasAttempt) { CancelPresentation(); Session.ReturnToMenu(); }
            CurrentScreen = "garden"; menu.SetActive(false); gameplay.SetActive(false); boardCamera.enabled = false;
            RefreshScene();
            ShowModal("BAHÇEM", Session.WalletSummary + "\n" + Session.GardenSummary);
            GardenIllustration.Show(modal.transform,Session.GardenTier);
            modalCopy.rectTransform.anchorMin = new Vector2(.08f,.30f); modalCopy.rectTransform.anchorMax = new Vector2(.92f,.51f);
            actions.anchorMax = new Vector2(.92f,.29f);
            AddAction("Bölüm yolculuğu",0,OpenJourney); AddAction("Ana Menü",1,ShowMenu);
        }

        private void RefreshScene()
        {
            coopScene.Refresh(Session.IsStageComplete(0), Session.IsStageComplete(1), CurrentScreen == "menu", CurrentScreen == "menu" && Session.FirstOpening);
        }

        public void RequestSwap(int a, int b)
        {
            if (!ready || !HasInterface || !Board.CanPresent || !Board.InputEnabled || requesting || CurrentScreen != "playing" || Board.IsAnimating || Session.Status != "playing") return;
            requesting = true;
            try
            {
                Board.MarkPair(null);
                var receipt = Session.TrySwap(a, b);
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
            Session.CompletePresentation(); RefreshCounters();
            Board.InputEnabled = CurrentScreen == "playing" && Session.Status == "playing";
            RefreshTutorial(false); RefreshScene(); EvaluateOutcome();
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
            title.text = Session.StageLabel(Session.ActiveStage) + "  ·  " + Session.StageName(Session.ActiveStage);
            counters.text = "YEŞERT                  PUAN\n" + green + " / " + snapshot.layers.Length + "                " +
                snapshot.score + (Session.ActiveStage == 0 ? "" : " / " + Session.Level.target);
            movesCounter.text = "<size=18>HAMLE</size>\n" + snapshot.movesLeft;
            if (!Session.IsTutorial) coachHeading.text = "TAVİK";
        }
        private void EvaluateOutcome()
        {
            if (!ready || !Session.HasAttempt || Session.Status == "playing") return;
            CurrentScreen = "result"; Board.InputEnabled = false;
            string details = "Puan: " + Session.Snapshot.score + "\nKalan hamle: " + Session.Snapshot.movesLeft;
            if (Session.Status == "won")
            {
                ShowModal(Session.IsTutorial ? "DERS TAMAMLANDI!" : "BÖLÜM TAMAMLANDI!", details + "\n" + Session.WalletSummary);
                string next = Session.ActiveStage == 0 ? "Birlikte devam edelim" :
                    Session.ActiveStage == Session.TutorialCount - 1 ? "İlk bölüme başla" :
                    Session.NextCampaignStage < 0 ? "Bahçeni gör" : "Sonraki bölüme geç";
                AddAction(next,0,ContinueAfterWin); AddAction("Ana Menü",1,ReturnToMenu);
            }
            else
            {
                ShowModal("YENİ BİR DENEME",details);
                var rescue = Session.GetGoldRescueOffer();
                int slot = 0;
                if (rescue != null)
                {
                    var button = AddAction("+" + rescue.Moves + " hamle  ·  " + rescue.Cost + " altın",slot++,() => ConfirmGoldRescue(rescue));
                    button.interactable = rescue.Affordable;
                }
                AddAction("Tekrar dene",slot++,Retry);
                AddAction("Ana Menü",slot,ReturnToMenu);
            }
        }
        private void ConfirmGoldRescue(UnityGameSession.GoldRescueOffer offer)
        {
            if (CurrentScreen != "result" || !ready) return;
            ShowModal("İKİNCİ ŞANS",offer.Cost + " altın karşılığında bu denemeye " + offer.Moves + " hamle ekle.");
            AddAction("Onayla",0,() => {
                if (!Session.AcceptGoldRescue(offer)) { ShowCommandFailure(Session.LastError); return; }
                OpenCurrentBoard();
            });
            AddAction("Vazgeç",1,EvaluateOutcome);
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
            Board.InputEnabled = Session.Status == "playing"; RefreshTutorial(true); EvaluateOutcome();
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
            boardCamera.enabled = true; Board.Build(Session.Level,Session.Snapshot);
            message.text = "Bir taş seç, komşusuna dokun veya sürükle.";
            Board.InputEnabled = Session.Status == "playing";
            RefreshScene(); RefreshTutorial(true); RefreshCounters(); UpdateLayout(); EvaluateOutcome();
        }
        private void ShowHint()
        {
            if (!ready || CurrentScreen != "playing" || !Board.InputEnabled) return;
            var pair = Session.RequestHint();
            if (pair == null) { message.text = "İpucu bulunamadı."; return; }
            Board.MarkPair(pair);
            message.text = "İşaretli iki taşın yerini değiştir.";
        }

        public void AcknowledgeTutorial()
        {
            if (!ready || CurrentScreen != "playing" || Board.IsAnimating || !Session.AcknowledgeTutorial()) return;
            RefreshTutorial(true);
        }

        private void RenderLessonCard(bool showCopy)
        {
            var card = Session.CurrentLessonCard();
            if (card == null) return;
            coachHeading.text = card.Heading + "       " + card.Counter;
            if (showCopy) message.text = "<b>" + card.Title + "</b>\n" + card.Text;
        }

        private void RefreshTutorial(bool clearMessage)
        {
            bool feedback = Session.NeedsTutorialAcknowledgement;
            acknowledgeButton.gameObject.SetActive(feedback);
            hintButton.gameObject.SetActive(!feedback && !Session.IsTutorial);
            inventoryButton.gameObject.SetActive(!Session.IsTutorial);
            if (Session.IsTutorial)
            {
                RenderLessonCard(clearMessage || !Board.IsAnimating || feedback);
                Board.InputEnabled = !feedback && CurrentScreen == "playing" && Session.Status == "playing";
                Board.MarkPair(Session.TutorialPair,Session.TutorialMatchIndices);
            }
        }

        public void ReturnToMenu()
        {
            if (!ready || !HasInterface) return;
            CancelPresentation(); Session.ReturnToMenu(); ShowMenu();
        }
        private void ShowMenu()
        {
            CurrentScreen = "menu"; menu.SetActive(true); gameplay.SetActive(false); modal.SetActive(false);
            Board.InputEnabled = false; boardCamera.enabled = false;
            RefreshScene();
            int next = Session.NextStage;
            bool fresh = Session.FirstOpening;
            freshHome.SetActive(fresh); returningHome.SetActive(!fresh);
            heroTitle.text = "Aynı sayıları\neşleştir.";
            menuWallet.text = Session.WalletSummary;
            menuProgress.text = "Yeşeren yolculuğun    " + Session.ClearedCount + " / " + (Session.StageCount - Session.TutorialCount);
            menuCopy.text = next < 0 ? "Kampanya tamamlandı" : Session.StageLabel(next) + "  ·  " + Session.StageName(next);
            playButton.GetComponentInChildren<Text>(true).text =
                next < 0 ? "Bahçeni gör" : Session.HasCheckpoint(next) ? "Devam et" : "Oyna";
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
            if (CurrentScreen == "inventory") CloseInventory();
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
            if (CurrentScreen == "playing" || CurrentScreen == "inventory") CurrentScreen = "paused";
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
            if (roundedCard != null) Destroy(roundedCard);
            if (cardTexture != null) Destroy(cardTexture);
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
            GardenIllustration.Hide(modal.transform);
            modalCopy.rectTransform.anchorMin = new Vector2(.08f,.49f); modalCopy.rectTransform.anchorMax = new Vector2(.92f,.7f);
            actions.anchorMax = new Vector2(.92f,.46f);
            foreach (Transform child in actions) { child.gameObject.SetActive(false); Destroy(child.gameObject); }
            modalTitle.text = heading; modalCopy.text = copy; modal.SetActive(true); modal.transform.SetAsLastSibling();
        }
        private Button AddAction(string text,int slot,Action action)
        {
            float top = 1 - slot * .25f;
            return MakeButton(text,actions,new Vector2(0,top-.22f),new Vector2(1,top),action);
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
