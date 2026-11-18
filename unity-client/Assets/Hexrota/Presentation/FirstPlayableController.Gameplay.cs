using System;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        private GameObject playHeader, playDock, coachCard, scoreTrack, scoreDivider;
        private RectTransform goalsBox, scoreColumn, groundColumn, movesBox, scoreFill;
        private Text stageTag, scoreCaption, groundCaption, groundCount, lessonTitle, lessonCopy, lessonCounter;
        private Button skipLesson;
        private readonly Button[] dockButtons = new Button[5];
        private RawImage guideHand, playActor, coachFace;
        private TutorialGestureArrow guideArrow;
        private Texture2D pointFace, talkFace, happyFace;
        private int[] guidePair;
        private float guideStarted, speechStarted;
        private string coachCue;
        private static readonly Color HeadingInk = new Color32(74,44,86,255);
        private static readonly Color BrownInk = new Color32(100,68,42,255);
        private static readonly Color GreenInk = new Color32(67,93,49,255);

        private static void Place(RectTransform item, float x0, float y0, float x1, float y1)
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

        private GameObject GamePlate(string name, Transform parent, Color top, Color bottom, Color border,
            float radius = 24f, float borderWidth = 2f)
        {
            var plate = Panel(name,parent,Vector2.zero,Vector2.one,Color.white);
            PhoneSkin.Plate(plate,top,bottom,border,radius,borderWidth);
            return plate;
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
            playActor = Rect("BoardTavik",gameplay.transform,Vector2.zero,Vector2.one).gameObject.AddComponent<RawImage>();
            playActor.raycastTarget = false; playActor.texture = Resources.Load<Texture2D>("CoopArt/idle");

            playHeader = GamePlate("LevelHUD",gameplay.transform,new Color32(98,63,126,255),
                new Color32(57,37,76,255),new Color32(109,73,88,255),0);
            Transform hud = playHeader.transform;
            stageTag = PlayText("StageTag",hud,"",.045f,.77f,.205f,.955f,17,Gold,TextAnchor.MiddleLeft,true);
            title = PlayText("LevelTitle",hud,"",.211f,.77f,.96f,.955f,27,Gold,TextAnchor.MiddleLeft,true);
            goalsBox = (RectTransform)GamePlate("StageGoals",hud,new Color32(255,245,213,255),
                new Color32(238,214,163,255),new Color32(202,146,83,255)).transform;
            scoreColumn = Rect("ScoreGoal",goalsBox,Vector2.zero,Vector2.one);
            scoreCaption = PlayText("ScoreLabel",scoreColumn,"",0,0,1,1,17,BrownInk,TextAnchor.MiddleLeft,true);
            counters = PlayText("Counters",scoreColumn,"",0,0,1,1,47,HeadingInk,TextAnchor.MiddleRight,true);
            scoreTrack = Panel("ScoreTrack",scoreColumn,new Vector2(.055f,.12f),new Vector2(.855f,.18f),new Color32(207,178,132,255));
            scoreFill = (RectTransform)Panel("ScoreProgress",scoreTrack.transform,Vector2.zero,Vector2.one,new Color32(111,170,64,255)).transform;
            groundColumn = Rect("GreenGoal",goalsBox,Vector2.zero,Vector2.one);
            scoreDivider = Panel("GoalDivider",groundColumn,new Vector2(0,.98f),Vector2.one,new Color32(198,168,118,255));
            var ring = GamePlate("CoverageRing",groundColumn.gameObject.transform,Color.clear,Color.clear,new Color32(187,163,118,190),50,3);
            var ringFit = ring.AddComponent<AspectRatioFitter>(); ringFit.aspectMode = AspectRatioFitter.AspectMode.WidthControlsHeight; ringFit.aspectRatio = 1;
            var ringRect = (RectTransform)ring.transform; Place(ringRect,.05f,.5f,.12f,.5f);
            groundCaption = PlayText("GroundLabel",groundColumn,"",0,0,1,1,20,GreenInk,TextAnchor.MiddleLeft);
            groundCount = PlayText("GroundCount",groundColumn,"",0,0,1,1,27,GreenInk,TextAnchor.MiddleRight,true);
            movesBox = (RectTransform)GamePlate("RemainingMoves",hud,new Color32(255,222,117,255),
                new Color32(239,171,50,255),new Color32(255,227,156,255)).transform;
            PlayText("MovesLabel",movesBox,"HAMLE",0,.64f,1,.93f,17,BrownInk,TextAnchor.MiddleCenter,true);
            movesCounter = PlayText("Moves",movesBox,"",0,.08f,1,.71f,69,HeadingInk,TextAnchor.MiddleCenter,true);

            coachCard = GamePlate("Coach",gameplay.transform,new Color32(255,244,212,255),
                new Color32(243,223,175,255),new Color32(189,138,71,255),21,2);
            var coach = coachCard.transform;
            coachPortrait = Rect("CoachTavik",coach,new Vector2(.043f,.5f),new Vector2(.24f,.5f)).gameObject;
            var aspect = coachPortrait.AddComponent<AspectRatioFitter>(); aspect.aspectMode = AspectRatioFitter.AspectMode.WidthControlsHeight; aspect.aspectRatio = 1;
            PhoneSkin.Plate(coachPortrait.AddComponent<Image>().gameObject,new Color32(255,244,211,255),new Color32(184,142,215,255),
                new Color32(189,133,68,255),120,4);
            coachPortrait.AddComponent<Mask>().showMaskGraphic = true;
            coachFace = Rect("Face",coachPortrait.transform,new Vector2(-.645f,-1.13f),new Vector2(1.585f,1.1f)).gameObject.AddComponent<RawImage>();
            coachFace.raycastTarget = false;
            pointFace = Resources.Load<Texture2D>("CoopArt/point"); talkFace = Resources.Load<Texture2D>("CoopArt/call");
            happyFace = Resources.Load<Texture2D>("CoopArt/celebrate");
            coachHeading = PlayText("CoachHeading",coach,"",.32f,.72f,.59f,.92f,14,BrownInk,TextAnchor.MiddleLeft,true);
            var pill = GamePlate("LessonMaterial",coach,new Color32(255,246,219,255),new Color32(255,235,202,255),
                new Color32(185,130,73,255),18,2);
            Place((RectTransform)pill.transform,.575f,.742f,.754f,.905f);
            lessonCounter = PlayText("LessonCounter",pill.transform,"",.02f,0,.98f,1,20,BrownInk,TextAnchor.MiddleCenter,true);
            lessonTitle = PlayText("LessonTitle",coach,"",.32f,.39f,.746f,.72f,27,HeadingInk,TextAnchor.MiddleLeft,true);
            lessonTitle.resizeTextMinSize = 25;
            lessonCopy = PlayText("LessonCopy",coach,"",.32f,.06f,.785f,.39f,21,HeadingInk,TextAnchor.MiddleLeft);
            skipLesson = MakeButton("Geç",coach,new Vector2(.8f,.22f),new Vector2(.99f,.78f),SkipLessons);
            skipLesson.GetComponent<Image>().color = Color.clear;
            var skipText = skipLesson.GetComponentInChildren<Text>(); skipText.fontSize = 18; skipText.fontStyle = FontStyle.Normal;
            acknowledgeButton = MakeButton("Devam et",coach,new Vector2(.787f,.23f),new Vector2(.987f,.77f),AcknowledgeTutorial);
            acknowledgeButton.GetComponentInChildren<Text>().fontSize = 22;
            guideArrow = Rect("GestureArrow",boardInput,Vector2.zero,Vector2.one).gameObject.AddComponent<TutorialGestureArrow>();
            guideArrow.color = new Color32(255,244,182,235); guideArrow.raycastTarget = false;
            guideHand = PhoneSkin.Icon(boardInput,"guide-hand",Vector2.zero,Vector2.one,Color.white);
            guideHand.raycastTarget = false;
            message = PlayText("Feedback",gameplay.transform,"",.1f,.13f,.9f,.19f,23,Paper,TextAnchor.MiddleCenter,true);
            Emphasize(message);

            playDock = GamePlate("Footer",gameplay.transform,new Color32(98,65,122,255),
                new Color32(53,34,69,255),new Color32(128,88,146,255),0);
            dockButtons[0] = BuildDockButton("Menü","home",ReturnToMenu);
            dockButtons[1] = BuildDockButton("Yeniden","reset",ConfirmRestart);
            dockButtons[2] = inventoryButton = BuildDockButton("Çanta","leaf",OpenInventory);
            dockButtons[3] = BuildDockButton("Mola","pause",Pause);
            dockButtons[4] = BuildDockButton("Ayarlar","settings",OpenMobileSettings);
            CreateScoreFeedback();
        }

        private Button BuildDockButton(string caption, string symbol, Action action)
        {
            bool blue = symbol == "leaf";
            var button = MakeButton(caption,playDock.transform,Vector2.zero,Vector2.one,action);
            PhoneSkin.Plate(button.gameObject,blue ? new Color32(117,190,229,255) : new Color32(159,119,190,255),
                blue ? new Color32(57,123,176,255) : new Color32(80,50,106,255),new Color32(169,132,188,255),20,1);
            var label = button.GetComponentInChildren<Text>(); label.fontSize = label.resizeTextMaxSize = 16; label.resizeTextMinSize = 12;
            label.color = Paper; label.fontStyle = FontStyle.Bold;
            var medallion = GamePlate("Medallion",button.transform,blue ? new Color32(123,196,231,255) : new Color32(149,114,174,255),
                blue ? new Color32(52,120,172,255) : new Color32(100,67,123,255),new Color32(215,183,220,255),90,3);
            var fit = medallion.AddComponent<AspectRatioFitter>(); fit.aspectMode = AspectRatioFitter.AspectMode.HeightControlsWidth; fit.aspectRatio = 1;
            PhoneSkin.Icon(medallion.transform,symbol,new Vector2(.23f,.23f),new Vector2(.77f,.77f),Paper);
            return button;
        }

        private void LayoutGameplay(UnityEngine.Rect safeRect)
        {
            if (Board == null || Session == null || !Session.HasAttempt) return;
            bool lesson = Session.IsTutorial, first = Session.ActiveStage == 0;
            float aspect = safeRect.width * Screen.width / Mathf.Max(1,safeRect.height * Screen.height);
            var layout = new MobileLayout.GameRegions(aspect,lesson,first);
            Place((RectTransform)playHeader.transform,0,1-layout.Header,1,1);
            Place((RectTransform)playDock.transform,0,0,1,layout.Footer);
            Place((RectTransform)coachCard.transform,.031f,layout.CoachBottom,.969f,layout.CoachTop);
            var area = layout.Board;
            Place(boardInput,area.xMin,area.yMin,area.xMax,area.yMax);
            var cameraArea = new UnityEngine.Rect(safeRect.x + safeRect.width * area.x,safeRect.y + safeRect.height * area.y,
                safeRect.width * area.width,safeRect.height * area.height);
            Board.SetCameraArea(cameraArea);
            Place(goalsBox,.046f,.08f,first ? .738f : .707f,.72f);
            Place(movesBox,first ? .764f : .738f,.08f,.954f,.72f);
            if (first)
            {
                Place(scoreColumn,.72f,.02f,.99f,.98f); Place(groundColumn,0,0,.72f,1);
                Place(scoreCaption.rectTransform,0,.55f,1,.84f); Place(counters.rectTransform,0,.11f,1,.58f);
                scoreCaption.alignment = counters.alignment = TextAnchor.MiddleCenter;
                Place(groundCaption.rectTransform,.21f,.54f,.98f,.82f); Place(groundCount.rectTransform,.21f,.12f,.98f,.59f);
                groundCount.alignment = TextAnchor.MiddleLeft; groundCount.fontSize = groundCount.resizeTextMaxSize = 43;
                Place((RectTransform)scoreDivider.transform,.995f,0,1,1);
            }
            else
            {
                Place(scoreColumn,0,.44f,1,1); Place(groundColumn,0,0,1,.43f);
                Place(scoreCaption.rectTransform,.055f,.25f,.5f,.85f); Place(counters.rectTransform,.43f,.25f,.86f,.91f);
                scoreCaption.alignment = TextAnchor.MiddleLeft; counters.alignment = TextAnchor.MiddleRight;
                Place(groundCaption.rectTransform,.16f,.08f,.51f,.9f); Place(groundCount.rectTransform,.54f,.08f,.87f,.90f);
                groundCount.alignment = TextAnchor.MiddleRight; groundCount.fontSize = groundCount.resizeTextMaxSize = 27;
                Place((RectTransform)scoreDivider.transform,0,.978f,1,1);
            }
            scoreTrack.SetActive(!first);
            for (int i = 0; i < dockButtons.Length; i++)
            {
                var button = dockButtons[i];
                button.gameObject.SetActive(!lesson || i == 0 || i == 3);
                float x = lesson ? (i == 0 ? .036f : .797f) : .036f + .188f * i;
                Place((RectTransform)button.transform,x,.13f,x + (lesson ? .167f : .174f),.89f);
                var medallion = (RectTransform)button.transform.Find("Medallion");
                float center = lesson ? .26f : .5f;
                Place(medallion,center,lesson ? .09f : .28f,center,lesson ? .91f : .95f);
                var label = button.GetComponentInChildren<Text>().rectTransform;
                Place(label,lesson ? .48f : 0,.02f,1,lesson ? .99f : .28f);
            }
            PositionBoardActor(area,aspect,lesson);
        }

        private void PositionBoardActor(UnityEngine.Rect area, float aspect, bool lesson)
        {
            playActor.gameObject.SetActive(false);
            if (lesson || Board == null || playActor.texture == null) return;
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
                    Place(playActor.rectTransform,box.xMin,box.yMin,box.xMax,box.yMax);
                    playActor.gameObject.SetActive(true); return;
                }
            }
        }

        private void RefreshCounters()
        {
            if (!Session.HasAttempt) return;
            var snapshot = Session.Snapshot; int green = 0;
            foreach (int layers in snapshot.layers) if (layers == 0) green++;
            bool first = Session.ActiveStage == 0;
            stageTag.text = Session.StageLabel(Session.ActiveStage);
            title.text = first ? "Her yeri yeşert" : Session.IsTutorial ? "İki hedefi tamamla" : "Puanı topla, alanı boya";
            groundCaption.text = first ? "YEŞERT" : "Yeşil alan"; groundCount.text = green + " / " + snapshot.layers.Length;
            scoreCaption.text = first ? "PUAN" : "HEDEF PUAN";
            scoreTarget = Session.Level.target; simpleScore = first;
            DrawScore(snapshot.score);
            movesCounter.text = snapshot.movesLeft.ToString();
        }

        private void RenderLessonCard(bool showCopy)
        {
            var card = Session.CurrentLessonCard();
            if (card == null) return;
            coachHeading.text = card.Heading; lessonCounter.text = card.Counter;
            if (showCopy) { lessonTitle.text = card.Title; lessonCopy.text = card.Text; }
            string key = Session.ActiveStage + "|" + card.Heading + "|" + card.Counter;
            if (coachCue != key) { coachCue = key; speechStarted = Time.unscaledTime; }
        }

        private void RefreshTutorial(bool clearMessage)
        {
            bool lesson = Session.IsTutorial, feedback = Session.NeedsTutorialAcknowledgement;
            Board.ReducedMotion = Session.ReducedMotion;
            coachCard.SetActive(lesson);
            if (lesson)
            {
                RenderLessonCard(clearMessage || !Board.IsAnimating || feedback);
                acknowledgeButton.gameObject.SetActive(feedback); skipLesson.gameObject.SetActive(!feedback);
                Board.InputEnabled = !feedback && CurrentScreen == "playing" && Session.Status == "playing";
                Board.MarkPair(Session.TutorialPair,Session.TutorialMatchIndices);
            }
            guidePair = lesson && !feedback && Board.InputEnabled ? Session.TutorialPair : null;
            guideStarted = Time.unscaledTime;
            guideHand.gameObject.SetActive(guidePair != null);
            guideArrow.gameObject.SetActive(guidePair != null);
        }

        private void LateUpdate()
        {
            if (!ready || CurrentScreen != "playing" || !HasInterface || coachCard == null || !coachCard.activeSelf) return;
            if (coachFace != null)
            {
                float elapsed = Time.unscaledTime - speechStarted;
                var pose = acknowledgeButton.gameObject.activeSelf ? happyFace : pointFace;
                coachFace.texture = !Board.ReducedMotion && !Board.IsAnimating && elapsed < .99f && ((int)(elapsed/.165f) % 2 == 0) ? talkFace : pose;
            }
            if (guidePair == null || guideHand == null || !Board.CanPresent) return;
            guideHand.gameObject.SetActive(!Board.IsAnimating);
            guideArrow.gameObject.SetActive(!Board.IsAnimating);
            if (Board.IsAnimating) return;
            Board.AnimateGuide(guidePair[0],guidePair[1],Time.unscaledTime-guideStarted);
            float clock = Mathf.Repeat((Time.unscaledTime-guideStarted)/2.2f,1);
            float pulse = Board.ReducedMotion ? .5f : Mathf.SmoothStep(0,1,Mathf.InverseLerp(.15f,.70f,clock));
            var a = Board.ViewportCell(guidePair[0]); var b = Board.ViewportCell(guidePair[1]);
            guideArrow.SetPair(a,b);
            var p = Vector2.Lerp(a,b,pulse);
            float w = .098f, h = w * Board.BoardCamera.pixelWidth / Mathf.Max(1,Board.BoardCamera.pixelHeight);
            guideHand.color = new Color(1,1,1,Board.ReducedMotion ? 1 : 1-Mathf.InverseLerp(.85f,.95f,clock));
            Place((RectTransform)guideHand.transform.parent,p.x+w*.23f,p.y-h*1.04f,p.x+w*1.23f,p.y-h*.04f);
        }

        private void SkipLessons()
        {
            if (!ready || !HasInterface || CurrentScreen != "playing" || !Session.IsTutorial) return;
            CancelPresentation();
            if (!Session.SkipTutorials()) { ShowCommandFailure(Session.LastError); return; }
            OpenCurrentBoard();
        }
    }
}
