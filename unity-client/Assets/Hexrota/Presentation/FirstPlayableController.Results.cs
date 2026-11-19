using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        private ChapterVictoryView chapterVictory;

        private void ShowChapterVictory()
        {
            if (chapterVictory == null)
            {
                var prefab = Resources.Load<GameObject>("CastleGame/ChapterVictory").GetComponent<ChapterVictoryView>();
                chapterVictory = Instantiate(prefab, safe.GetComponentInParent<Canvas>().rootCanvas.transform, false);
            }
            CurrentScreen = "celebration";
            modal.SetActive(false);
            chapterVictory.Show(Session.ReducedMotion, FinishChapterVictory);
        }

        private void FinishChapterVictory()
        {
            if (chapterVictory != null) chapterVictory.Hide();
            if (!ready || !HasInterface || CurrentScreen != "celebration") return;
            CurrentScreen = "result";
            DrawWin();
        }

        private void ResultArt(string name,string texture,float x,float y,float width,float height)
        {
            var rect=Rect(name,sheetDecor,Vector2.zero,Vector2.one);
            At(rect,x,y,width,height);
            var image=rect.gameObject.AddComponent<RawImage>();
            image.texture=Resources.Load<Texture2D>(texture);image.raycastTarget=false;
        }

        private void ResultStats(string[] names,string[] values,float top)
        {
            SheetPlate("ResultStats",22,top,316,84,0xf5e7ca,0xf1dfbd,0xd0aa76,14);
            float width=316f/names.Length;
            for(int i=0;i<names.Length;i++)
            {
                float x=22+width*i;
                SheetText("StatName"+i,names[i],x,top+15,width,19,9,Tone(0x805c71),TextAnchor.MiddleCenter);
                SheetText("StatValue"+i,values[i],x,top+35,width,36,25,Tone(0x654381),TextAnchor.MiddleCenter,true);
            }
        }

        private void DrawWin()
        {
            var result=Session.ReadEarnedResult();
            var board=Session.Snapshot;
            bool tutorial=Session.IsTutorial,first=Session.ActiveStage==0,final=!tutorial && Session.NextCampaignStage<0;
            string next=final?"Bahçeni gör":first?"Birlikte devam edelim":tutorial?"İlk bölüme başla":
                "Bölüm "+(Session.NextCampaignStage-Session.TutorialCount+1).ToString("00")+" ile devam et";
            if(tutorial && result.Welcome)
            {
                ShowPhoneSheet("İlk hediyen hazır!","İki görevi de tamamladın. Bu Altın senin!","BAŞLANGIÇ HEDİYEN",495);
                PhoneSkin.Plate(sheetFrame.gameObject,Tone(0x472a62),Tone(0x51336a),Tone(0xffdb86),25,4);
                At(sheetEyebrow.rectTransform,22,31,316,20);sheetEyebrow.color=Gold;sheetEyebrow.alignment=TextAnchor.MiddleCenter;
                sheetRibbon.enabled=false;sheetTails.enabled=false;CenterTitle(54);modalTitle.fontSize=30;modalTitle.resizeTextMaxSize=30;
                At(modalCopy.rectTransform,34,103,292,29);modalCopy.alignment=TextAnchor.MiddleCenter;modalCopy.color=Paper;
                ResultArt("WelcomeChest","CoopArt/welcome-chest",56,130,248,200);
                SheetPlate("GoldCoin",80,325,43,43,0xffdb63,0xe7a735,0xfff1a4,22);
                SheetText("CoinMark","✦",80,323,43,43,26,Tone(0xfff5ac),TextAnchor.MiddleCenter,true);
                SheetText("WelcomeGold","+"+result.Gold+" Altın",132,317,177,58,32,Gold,TextAnchor.MiddleLeft,true);
                SheetText("WelcomeSaved","Hediyen hesabına eklendi.",22,370,316,34,12,Paper,TextAnchor.MiddleCenter);
                CelebrateWin();
                SheetButton(next,22,418,316,50,ContinueAfterWin,SheetStyle.Primary,"arrow");return;
            }
            string title=tutorial?(first?"İlk alan yeşerdi!":"Hazırsın!"):result.Headline??(final?"Usta işi!":"Harika eşleşme!");
            string description=tutorial?(first?"Aynı sayıları eşleştirdin, altlarındaki yerleri yeşerttin.":"Puanı topladın, her yeri yeşerttin. İlk bölüm seni bekliyor."):
                final?"10 bölümün hepsini bitirdin!":board.movesLeft+" hamlen kaldı. Bölümü bitirdin!";
            int assisted=result.Assisted?32:0,gift=result.Gift!=null?24:0;
            int welcome=result.WelcomeGold>0?24:0;
            int rewardHeight=result.Stars>0?82+gift+welcome:0;
            int nextY=412+assisted+rewardHeight;
            ShowPhoneSheet(title,description,final?"YOLCULUK TAMAMLANDI":Session.StageLabel(Session.ActiveStage)+" TAMAMLANDI",tutorial?362:nextY+197);
            if (tutorial) CelebrateWin();
            ResultArt("VictoryMark","CoopArt/victory-mark",139,30,82,90);
            At(sheetEyebrow.rectTransform,22,145,316,20);sheetEyebrow.alignment=TextAnchor.MiddleCenter;
            CenterTitle(173);At(modalCopy.rectTransform,22,238,316,25);modalCopy.alignment=TextAnchor.MiddleCenter;
            if(tutorial){SheetButton(next,22,286,316,50,ContinueAfterWin,SheetStyle.Primary,"arrow");return;}
            if(result.Assisted) SheetText("AssistedClear","Güçlendirici kullanarak tamamladın.",22,268,316,25,12,PurpleText,TextAnchor.MiddleCenter);
            ResultStats(new[]{"TOPLAM PUAN","KALAN HAMLE","YEŞİL ALAN"},new[]{board.score.ToString(),board.movesLeft.ToString(),"%100"},286+assisted);
            if(result.Stars>0)
            {
                int rewardsY=397+assisted;
                SheetPlate("EarnedRewards",22,rewardsY,316,rewardHeight,0x654084,0x38214e,0xe5b660,18);
                SheetText("Earned","+"+result.Gold+" Altın     +"+result.Stars+" yıldız",28,rewardsY+12,304,30,18,Tone(0xffe492),TextAnchor.MiddleCenter,true);
                if(result.Gift!=null) SheetText("Gift",result.Gift,28,rewardsY+42,304,24,13,Tone(0xd2f4a7),TextAnchor.MiddleCenter,true);
                if(welcome>0) SheetText("WelcomeIncluded","Bu ödüle "+result.WelcomeGold+" Altın başlangıç hediyen dahil.",28,rewardsY+42+gift,304,24,13,Paper,TextAnchor.MiddleCenter);
                SheetText("ResultSaved","Bu bölüm tamamlandı. Ödülün ve ilerlemen kaydedildi.",28,rewardsY+44+gift+welcome,304,25,11,Tone(0xf5e7fa),TextAnchor.MiddleCenter);
            }
            SheetButton(next,22,nextY,316,50,ContinueAfterWin,SheetStyle.Primary,"arrow");
            SheetButton("Tahtayı incele",132,nextY+57,96,40,ShowBoardReview,SheetStyle.Plain);
            ResultLinks(nextY+113);
        }

        private void ResultLinks(int y)
        {
            SheetPlate("ResultDivider",22,y,316,1,0xe6ecdd,0xe6ecdd,0xe6ecdd,0);
            SheetButton("Bölümler",90,y+13,88,44,OpenJourney,SheetStyle.Plain,"map");
            SheetButton("Ana menü",179,y+13,91,44,ReturnToMenu,SheetStyle.Plain,"home");
        }

        private void CelebrateWin()
        {
            if(Session.ReducedMotion)return;
            var confetti=Rect("Confetti",sheetDecor,Vector2.zero,Vector2.one).gameObject.AddComponent<PhoneWinConfetti>();
            confetti.Pieces=Session.FeedbackPlan?.headline==null?18:12+Session.FeedbackPlan.headline.tier*4;
            confetti.raycastTarget=false;
        }

        private void ShowBoardReview()
        {
            modal.SetActive(false);Board.InputEnabled=false;
            if(reviewControl==null)reviewControl=MakeButton("Sonucu göster",gameplay.transform,new Vector2(.26f,.12f),new Vector2(.74f,.19f),()=>{
                reviewControl.gameObject.SetActive(false);EvaluateOutcome();
            });
            reviewControl.gameObject.SetActive(true);
        }
        private Button reviewControl;
        private void HideReviewControl() { if(reviewControl!=null)reviewControl.gameObject.SetActive(false); }

        private void DrawLoss()
        {
            var board=Session.Snapshot;int green=0;foreach(int layer in board.layers)if(layer==0)green++;
            var ad=Session.ReadRescueAd();var gold=Session.GetGoldRescueOffer();
            int retryY=ad==null?413:782;
            ShowPhoneSheet("Bir plan daha?","Hamlelerin bitti. Altı yeşil olmayan taşları eşleştirmeyi dene.","BİR YOL DAHA VAR",retryY+187,ShowBoardReview);
            SheetSymbol("reset",30,true);
            At(sheetEyebrow.rectTransform,22,128,316,28);sheetEyebrow.alignment=TextAnchor.MiddleCenter;
            CenterTitle(166);At(modalCopy.rectTransform,22,232,316,44);modalCopy.alignment=TextAnchor.MiddleCenter;
            ResultStats(new[]{"TOPLAM PUAN","YEŞİL ALAN"},new[]{board.score+" / "+Session.Level.target,green+" / "+board.layers.Length},302);
            if(ad!=null)
            {
                SheetPlate("SecondChance",22,413,316,350,0xf1e7fa,0xdec9ed,0xb89cd1,18);
                SheetText("SecondChanceTitle","Aynı tahtada +"+ad.Moves+" hamle",40,427,280,30,18,Tone(0x60337f),TextAnchor.MiddleLeft,true);
                SheetText("SecondChanceCopy","Taşların, yeşil alanların ve puanın korunur. Bir denemede bir kez kullanabilirsin.",40,461,280,44,12,PurpleText);
                string label=ad.PendingDelivery?"Saklanan ödülünü kullan":ad.PendingId!=null?"Yarım kalan TEST reklamını aç":"TEST reklamı · +"+ad.Moves+" hamle";
                EnableSheetButton(SheetButton(label,40,516,280,47,()=>DrawRescueAd(ad)),ad.Available,SheetStyle.Primary);
                EnableSheetButton(SheetButton(ad.Price+" Altın · +"+ad.Moves+" hamle",40,572,280,46,()=>UseGoldRescue(gold),SheetStyle.Secondary),
                    gold!=null&&gold.Affordable&&!ad.PendingDelivery,SheetStyle.Secondary);
                SheetText("RescueAvailability",RescueAvailability(ad,gold),40,626,280,68,12,Tone(0x67486d),TextAnchor.MiddleLeft,true);
                SheetText("TestProviderNote","TEST reklamında gerçek reklam gösterilmez. Gerçek para işlemi yoktur.",40,701,280,48,11,Tone(0x67486d));
            }
            SheetButton("Yeniden dene",22,retryY,316,50,Retry,SheetStyle.Primary,"reset");
            SheetText("RetryNote","Yeni bir tahta ile başlayacaksın.",22,retryY+65,316,23,11,PurpleText,TextAnchor.MiddleCenter);
            ResultLinks(retryY+102);
        }

        private static string RescueAvailability(UnityGameSession.RescueAdOffer ad,UnityGameSession.GoldRescueOffer gold)
        {
            if(ad.PendingDelivery) return "Reklam ödülün saklandı. Yeni reklam izlemeden veya Altın harcamadan kullanabilirsin.";
            string status;
            switch(ad.Reason)
            {
                case "no_legal_swaps":return "Bu tahtada eşleşme yapacak hamle kalmadı. Yeni bir deneme başlatabilirsin.";
                case "already_rescued":return "Bu denemede ikinci şansını kullandın. Yeni bir deneme başlatabilir veya menüye dönebilirsin.";
                case "ad_unavailable":status="Şu an TEST reklamı yok. Yeniden deneyebilir veya menüye dönebilirsin.";break;
                case "daily_limit":status="Bugünkü ikinci şans reklamı hakkın doldu.";break;
                case "daily_reserved":status="Bugünkü reklam hakların yarım kalan TEST işlemleri için ayrılmış.";break;
                default:status=ad.PendingId!=null?"Başlattığın TEST işlemini sürdürebilirsin. Yeni bir reklam hakkı ayrılmaz.":
                    "İkinci şans reklamı: bugün "+ad.Remaining+" hak kaldı. Can reklamlarından ayrıdır.";break;
            }
            if(gold!=null && !gold.Affordable) status+=" Altın seçeneği için bakiyen yetersiz.";
            else if(gold!=null && !ad.Available) status+=" Altınla devam edebilirsin.";
            return status;
        }
        private void UseGoldRescue(UnityGameSession.GoldRescueOffer offer)
        {
            if(CurrentScreen!="result" || offer==null || !ready)return;
            if(Session.AcceptGoldRescue(offer)) OpenCurrentBoard(false);
            else DrawLoss();
        }
        private void DrawRescueAd(UnityGameSession.RescueAdOffer offer)
        {
            string id=offer.PendingId;
            if(!offer.PendingDelivery && id==null)id=Session.BeginMobileRescueAd();
            if(!offer.PendingDelivery && id==null){DrawLoss();return;}
            string description=offer.PendingDelivery?"Bu ödül kaydedilmeyi bekliyor. Aynı denemeye eklemeyi tekrar deneyebilirsin.":
                "Bu yerel test gerçek reklam göstermez. Yalnız tamamladığında aynı tahtana "+offer.Moves+" hamle eklenir.";
            ShowPhoneSheet(offer.PendingDelivery?"Saklanan reklam ödülün":"TEST reklamı: +"+offer.Moves+" hamle",description,"GELİŞTİRME TESTİ",350);
            SheetButton(offer.PendingDelivery?"Ödülü kullanmayı dene":"TEST reklamını tamamla",22,208,316,48,()=>{
                if(offer.PendingDelivery?Session.DeliverMobileRescueAd():Session.CompleteMobileRescueAd(id,true)) OpenCurrentBoard(false);
                else DrawLoss();
            });
            SheetButton("Vazgeç",22,267,316,46,()=>{if(!offer.PendingDelivery)Session.CompleteMobileRescueAd(id,false);DrawLoss();},SheetStyle.Secondary);
        }
    }
}
