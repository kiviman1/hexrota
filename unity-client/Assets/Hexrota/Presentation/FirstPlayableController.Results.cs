using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        private void ResultArt(string name,string texture,float x,float y,float width,float height)
        {
            var rect=Rect(name,sheetDecor,Vector2.zero,Vector2.one);
            At(rect,x,y,width,height);
            var image=rect.gameObject.AddComponent<RawImage>();
            image.texture=Resources.Load<Texture2D>(texture);image.raycastTarget=false;
        }

        private void ResultStats(string[] names,string[] values,float top)
        {
            SheetPlate("ResultStats",22,top-5,316,69,0xf5e7ca,0xf1dfbd,0xd0aa76,14);
            float width=316f/names.Length;
            for(int i=0;i<names.Length;i++)
            {
                float x=22+width*i;
                SheetText("StatName"+i,names[i],x,top,width,18,10,Tone(0x805c71),TextAnchor.MiddleCenter);
                SheetText("StatValue"+i,values[i],x,top+18,width,42,26,Tone(0x654381),TextAnchor.MiddleCenter,true);
            }
        }

        private void DrawWin()
        {
            var result=Session.ReadEarnedResult();
            var board=Session.Snapshot;
            bool tutorial=Session.IsTutorial,first=Session.ActiveStage==0,final=!tutorial && Session.NextCampaignStage<0;
            string next=final?"Bahçeni gör":first?"Birlikte devam edelim":tutorial?"İlk bölüme başla":
                "Bölüm "+(Session.NextCampaignStage-Session.TutorialCount+1).ToString("00")+" ile devam et";
            if(result.Welcome)
            {
                ShowPhoneSheet("İlk hediyen hazır!","İki görevi de tamamladın. Bu Altın senin!","BAŞLANGIÇ HEDİYEN",495);
                PhoneSkin.Plate(sheetFrame.gameObject,Tone(0x472a62),Tone(0x51336a),Tone(0xffdb86),25,4);
                At(sheetEyebrow.rectTransform,22,31,316,20);sheetEyebrow.color=Gold;sheetEyebrow.alignment=TextAnchor.MiddleCenter;
                sheetRibbon.enabled=false;sheetTails.enabled=false;CenterTitle(54);modalTitle.fontSize=30;modalTitle.resizeTextMaxSize=30;
                At(modalCopy.rectTransform,34,103,292,29);modalCopy.alignment=TextAnchor.MiddleCenter;modalCopy.color=Paper;
                ResultArt("WelcomeChest","CoopArt/welcome-chest",56,130,248,200);
                SheetText("WelcomeGold","✦  +"+result.Gold+" Altın",22,317,316,58,32,Gold,TextAnchor.MiddleCenter,true);
                SheetText("WelcomeSaved","Hediyen hesabına eklendi.",22,370,316,34,12,Paper,TextAnchor.MiddleCenter);
                SheetButton(next,22,418,316,50,ContinueAfterWin,SheetStyle.Primary,"arrow");return;
            }
            string title=tutorial?(first?"İlk alan yeşerdi!":"Hazırsın!"):result.Headline??(final?"Usta işi!":"Harika eşleşme!");
            string description=tutorial?(first?"Aynı sayıları eşleştirdin, altlarındaki yerleri yeşerttin.":"Puanı topladın, her yeri yeşerttin. İlk bölüm seni bekliyor."):
                final?"10 bölümün hepsini bitirdin!":board.movesLeft+" hamlen kaldı. Bölümü bitirdin!";
            ShowPhoneSheet(title,description,final?"YOLCULUK TAMAMLANDI":Session.StageLabel(Session.ActiveStage)+" TAMAMLANDI",tutorial?362:570);
            ResultArt("VictoryMark","CoopArt/victory-mark",139,30,82,90);
            At(sheetEyebrow.rectTransform,22,145,316,20);sheetEyebrow.alignment=TextAnchor.MiddleCenter;
            CenterTitle(173);At(modalCopy.rectTransform,22,238,316,25);modalCopy.alignment=TextAnchor.MiddleCenter;
            if(tutorial){SheetButton(next,22,286,316,50,ContinueAfterWin,SheetStyle.Primary,"arrow");return;}
            ResultStats(new[]{"TOPLAM PUAN","KALAN HAMLE","YEŞİL ALAN"},new[]{board.score.ToString(),board.movesLeft.ToString(),"%100"},271);
            if(result.Stars>0)
            {
                SheetPlate("EarnedRewards",22,344,316,64,0x654084,0x38214e,0xe5b660,18);
                SheetText("Earned","+"+result.Gold+" Altın     +"+result.Stars+" yıldız"+(result.Gift!=null?"  "+result.Gift:""),28,350,304,24,14,Tone(0xffe492),TextAnchor.MiddleCenter,true);
                SheetText("ResultSaved",result.Assisted?"Güçlendirici kullanarak tamamladın.":"Bu bölüm tamamlandı. Ödülün ve ilerlemen kaydedildi.",28,378,304,21,11,Tone(0xf5e7fa),TextAnchor.MiddleCenter);
            }
            SheetButton(next,22,424,316,50,ContinueAfterWin,SheetStyle.Primary,"arrow");
            SheetButton("Tahtayı incele",22,478,316,37,ShowBoardReview,SheetStyle.Plain);
            ResultLinks(516);
        }

        private void ResultLinks(int y)
        {
            SheetButton("Bölümler",22,y,152,40,OpenJourney,SheetStyle.Plain,"map");
            SheetButton("Ana menü",184,y,154,40,ReturnToMenu,SheetStyle.Plain,"home");
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
            ShowPhoneSheet("Bir plan daha?","Hamlelerin bitti. Altı yeşil olmayan taşları eşleştirmeyi dene.","BİR YOL DAHA VAR",ad!=null?650:425,ShowBoardReview);
            SheetSymbol("reset",24,false);At(sheetEyebrow.rectTransform,22,82,316,20);sheetEyebrow.alignment=TextAnchor.MiddleCenter;
            CenterTitle(112);At(modalCopy.rectTransform,22,174,316,40);modalCopy.alignment=TextAnchor.MiddleCenter;
            ResultStats(new[]{"TOPLAM PUAN","YEŞİL ALAN"},new[]{board.score+" / "+Session.Level.target,green+" / "+board.layers.Length},216);
            int retryY=298;
            if(ad!=null)
            {
                SheetPlate("SecondChance",22,291,316,211,0xf1e7fa,0xdec9ed,0xb89cd1,18);
                SheetText("SecondChanceTitle","Aynı tahtada +"+ad.Moves+" hamle",34,302,292,25,18,PurpleText,TextAnchor.MiddleCenter,true);
                SheetText("SecondChanceCopy","Taşların, yeşil alanların ve puanın korunur. Bir denemede bir kez kullanabilirsin.",34,331,292,33,12,PurpleText,TextAnchor.MiddleCenter);
                string label=ad.PendingDelivery?"Saklanan ödülünü kullan":ad.PendingId!=null?"Yarım kalan TEST reklamını aç":"TEST reklamı · +"+ad.Moves+" hamle";
                SheetButton(label,35,370,290,40,()=>DrawRescueAd(ad)).interactable=ad.Available;
                SheetButton(ad.Price+" Altın · +"+ad.Moves+" hamle",35,417,290,40,()=>ConfirmGoldRescue(gold),SheetStyle.Secondary).interactable=gold!=null&&gold.Affordable;
                string reason=ad.PendingDelivery?"Ödülün kaydedilmeyi bekliyor.":ad.Reason=="already_rescued"?"Bu denemede ikinci şansını kullandın.":
                    ad.Available?"İkinci şans reklamı: bugün "+ad.Remaining+" hak kaldı.":"Bu denemede TEST reklamı kullanılamıyor.";
                SheetText("RescueAvailability",reason,34,461,292,34,11,PurpleText,TextAnchor.MiddleCenter);
                retryY=518;
            }
            SheetButton("Yeniden dene",22,retryY,316,48,Retry,SheetStyle.Primary,"reset");
            SheetText("RetryNote","Yeni bir tahta ile başlayacaksın.",22,retryY+52,316,24,11,PurpleText,TextAnchor.MiddleCenter);
            ResultLinks(retryY+80);
        }
        private void ConfirmGoldRescue(UnityGameSession.GoldRescueOffer offer)
        {
            if(CurrentScreen!="result"||offer==null||!ready)return;
            ShowPhoneSheet("Aynı tahtada devam et",offer.Cost+" Altın ile aynı denemeye "+offer.Moves+" hamle ekle.","İKİNCİ ŞANS",345,EvaluateOutcome);
            SheetButton(offer.Cost+" Altın kullan",22,205,316,48,()=>{
                if(!Session.AcceptGoldRescue(offer)){DrawLoss();return;}
                OpenCurrentBoard();
            });
            SheetButton("Vazgeç",22,269,316,46,EvaluateOutcome,SheetStyle.Secondary);
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
                if(offer.PendingDelivery?Session.DeliverMobileRescueAd():Session.CompleteMobileRescueAd(id,true)) OpenCurrentBoard();
                else DrawLoss();
            });
            SheetButton("Vazgeç",22,267,316,46,()=>{if(!offer.PendingDelivery)Session.CompleteMobileRescueAd(id,false);DrawLoss();},SheetStyle.Secondary);
        }
    }
}
