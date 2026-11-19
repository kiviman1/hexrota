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

        private void ResultStats(string[] names,string[] values,float top)
        {
            SheetPlate("ResultStats",22,top,316,84,0x6f489f,0x50347a,0xc69ed7,14);
            float width=316f/names.Length;
            for(int i=0;i<names.Length;i++)
            {
                float x=22+width*i;
                SheetText("StatName"+i,names[i],x,top+15,width,19,9,sheetChrome.Gold,TextAnchor.MiddleCenter);
                SheetText("StatValue"+i,values[i],x,top+35,width,36,25,sheetChrome.Paper,TextAnchor.MiddleCenter,true);
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
                ShowPhoneSheet("İlk hediyen hazır!","İki görevi de tamamladın. Bu Altın senin!","BAŞLANGIÇ HEDİYEN",441,ShowBoardReview);
                SheetHero(CastlePopupChrome.Art.Reward,4,142);
                At(sheetEyebrow.rectTransform,22,150,316,20);
                At(modalCopy.rectTransform,22,174,316,34);
                SheetText("WelcomeGold","+"+result.Gold+" Altın",22,212,316,44,27,sheetChrome.Gold,TextAnchor.MiddleCenter,true);
                SheetText("WelcomeSaved","Hediyen hesabına eklendi.",22,258,316,27,13,sheetChrome.Paper,TextAnchor.MiddleCenter);
                CelebrateWin();
                SheetButton(next,38,301,284,50,ContinueAfterWin,SheetStyle.Primary,"arrow");return;
            }
            string title=tutorial?(first?"İlk alan yeşerdi!":"Hazırsın!"):result.Headline??(final?"Usta işi!":"Harika eşleşme!");
            string description=tutorial?(first?"Aynı sayıları eşleştirdin, altlarındaki yerleri yeşerttin.":"Puanı topladın, her yeri yeşerttin. İlk bölüm seni bekliyor."):
                final?"10 bölümün hepsini bitirdin!":board.movesLeft+" hamlen kaldı. Bölümü bitirdin!";
            int assisted=result.Assisted?32:0,gift=result.Gift!=null?24:0;
            int welcome=result.WelcomeGold>0?24:0;
            int rewardHeight=result.GoldenEggs>0?82+gift+welcome:0;
            int rewardsY=262+assisted;
            int nextY=rewardsY+rewardHeight+13;
            ShowPhoneSheet(title,description,final?"YOLCULUK TAMAMLANDI":Session.StageLabel(Session.ActiveStage)+" TAMAMLANDI",
                tutorial?338:nextY+233,ShowBoardReview);
            if (tutorial) CelebrateWin();
            SheetHero(CastlePopupChrome.Art.Reward,3,113);
            At(sheetEyebrow.rectTransform,22,122,316,22);
            At(modalCopy.rectTransform,22,147,316,27);
            if(tutorial){SheetButton(next,38,191,284,48,ContinueAfterWin,SheetStyle.Primary,"arrow");return;}
            if(result.Assisted) SheetText("AssistedClear","Güçlendirici kullanarak tamamladın.",22,173,316,24,12,SheetInk,TextAnchor.MiddleCenter);
            ResultStats(new[]{"TOPLAM PUAN","KALAN HAMLE","YEŞİL ALAN"},new[]{board.score.ToString(),board.movesLeft.ToString(),"%100"},176+assisted);
            if(result.GoldenEggs>0)
            {
                SheetPlate("EarnedRewards",22,rewardsY,316,rewardHeight,0x7650a6,0x51347b,0xdfb579,18);
                SheetText("Earned","+"+result.Gold+" Altın     +"+result.GoldenEggs+" Altın Yumurta",28,rewardsY+9,304,30,19,sheetChrome.Gold,TextAnchor.MiddleCenter,true);
                if(result.Gift!=null) SheetText("Gift",result.Gift,28,rewardsY+40,304,24,13,sheetChrome.Paper,TextAnchor.MiddleCenter,true);
                if(welcome>0) SheetText("WelcomeIncluded","Bu ödüle "+result.WelcomeGold+" Altın başlangıç hediyen dahil.",28,rewardsY+40+gift,304,24,13,sheetChrome.Paper,TextAnchor.MiddleCenter);
                SheetText("ResultSaved","Bu bölüm tamamlandı. Ödülün ve ilerlemen kaydedildi.",28,rewardsY+43+gift+welcome,304,25,11,sheetChrome.Paper,TextAnchor.MiddleCenter);
            }
            SheetButton(next,35,nextY,290,50,ContinueAfterWin,SheetStyle.Primary,"arrow");
            SheetButton("Tahtayı incele",128,nextY+55,104,35,ShowBoardReview,SheetStyle.Plain);
            ResultLinks(nextY+94);
        }

        private void ResultLinks(int y)
        {
            SheetPlate("ResultDivider",22,y,316,1,0xad88ca,0xad88ca,0xad88ca,0);
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
            int retryY=ad==null?292:658;
            ShowPhoneSheet("Bir plan daha?","Hamlelerin bitti. Altı yeşil olmayan taşları eşleştirmeyi dene.","",retryY+240,ShowBoardReview);
            SheetHero(CastlePopupChrome.Art.Heart,3,102);
            At(modalCopy.rectTransform,22,125,316,43);
            ResultStats(new[]{"TOPLAM PUAN","YEŞİL ALAN"},new[]{board.score+" / "+Session.Level.target,green+" / "+board.layers.Length},190);
            if(ad!=null)
            {
                SheetPlate("SecondChance",22,288,316,350,0x754eb0,0x51347e,0xc198d1,18);
                SheetText("SecondChanceTitle","Aynı tahtada +"+ad.Moves+" hamle",40,302,280,30,18,sheetChrome.Gold,TextAnchor.MiddleLeft,true);
                SheetText("SecondChanceCopy","Taşların, yeşil alanların ve puanın korunur. Bir denemede bir kez kullanabilirsin.",40,336,280,44,12,SheetInk);
                string label=ad.PendingDelivery?"Saklanan ödülünü kullan":ad.PendingId!=null?"Yarım kalan TEST reklamını aç":"TEST reklamı · +"+ad.Moves+" hamle";
                EnableSheetButton(SheetButton(label,40,391,280,47,()=>DrawRescueAd(ad)),ad.Available);
                EnableSheetButton(SheetButton(ad.Price+" Altın · +"+ad.Moves+" hamle",40,447,280,46,()=>UseGoldRescue(gold),SheetStyle.Secondary),
                    gold!=null&&gold.Affordable&&!ad.PendingDelivery);
                SheetText("RescueAvailability",RescueAvailability(ad,gold),40,501,280,68,12,SheetInk,TextAnchor.MiddleLeft,true);
                SheetText("TestProviderNote","TEST reklamında gerçek reklam gösterilmez. Gerçek para işlemi yoktur.",40,576,280,48,11,SheetInk);
            }
            SheetButton("Yeniden dene",22,retryY,316,50,Retry,SheetStyle.Primary,"reset");
            SheetText("RetryNote","Yeni bir tahta ile başlayacaksın.",22,retryY+65,316,23,11,SheetInk,TextAnchor.MiddleCenter);
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
            ShowPhoneSheet(offer.PendingDelivery?"Saklanan reklam ödülün":"TEST reklamı: +"+offer.Moves+" hamle",description,"GELİŞTİRME TESTİ",380,()=>{if(!offer.PendingDelivery)Session.CompleteMobileRescueAd(id,false);DrawLoss();});
            SheetButton(offer.PendingDelivery?"Ödülü kullanmayı dene":"TEST reklamını tamamla",22,158,316,48,()=>{
                if(offer.PendingDelivery?Session.DeliverMobileRescueAd():Session.CompleteMobileRescueAd(id,true)) OpenCurrentBoard(false);
                else DrawLoss();
            });
            SheetButton("Vazgeç",22,219,316,46,()=>{if(!offer.PendingDelivery)Session.CompleteMobileRescueAd(id,false);DrawLoss();},SheetStyle.Secondary);
        }
    }
}
