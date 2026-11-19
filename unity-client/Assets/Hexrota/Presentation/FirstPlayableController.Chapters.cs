using System;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        private void DrawJourney()
        {
            var frame=ResetHomePage();
            var background=Rect("AdventureBackdrop",frame,Vector2.zero,Vector2.one).gameObject.AddComponent<RawImage>();
            background.texture=Resources.Load<Texture2D>("PhoneMenu/journey-backdrop");
            background.raycastTarget=false;
            float visible=Mathf.Min(1,frame.rect.width/Mathf.Max(1,frame.rect.height));
            background.uvRect=new UnityEngine.Rect((1-visible)/2,0,visible,1);
            int chapters=Session.StageCount-Session.TutorialCount;
            int next=Session.NextStage;
            int visibleChapters=Session.ClearedCount+(next>=0?1:0);
            float extraHeight=Mathf.Max(0,Mathf.CeilToInt(visibleChapters/3f)-1)*149;
            var page=ScrollingPage(frame,640+extraHeight,true);
            DrawPhoneHeaderBody(page);
            MenuText(page,"Eyebrow","SAYILARIN ARASINDA BİR PATİKA",15,85,285,24,9,PlumEdge,TextAnchor.MiddleLeft,true);
            MenuText(page,"JourneyTitle","Yeşile giden <color=#FFD369>yol.</color>",15,111,295,36,27,MenuCream,TextAnchor.MiddleLeft,true);
            var back=MenuPlate(page,"Ana menüye dön",336,85,39,43,PlumTop,PlumBottom,PlumEdge,13,2);
            MenuClick(back,ShowMenu); MenuIcon(back,"home",8,11,23,MenuCream);
            DrawWallet(page,195,269);
            MenuIcon(page,"leaf",15,336,15,MenuGold);
            MenuText(page,"JourneySummary",Session.ClearedCount+" / "+chapters+" bölüm tamamlandı",38,331,320,28,11,MenuCream,TextAnchor.MiddleLeft,true);
            var map=MenuPlate(page,"JourneyMap",14,368,362,179+extraHeight,new Color32(82,60,112,255),new Color32(64,48,87,255),MenuCream,21,1);
            int slot=0;
            for(int i=Session.TutorialCount;i<Session.StageCount;i++)
            {
                bool current=i==next, done=Session.IsStageComplete(i);
                if(!current && !done) continue;
                var node=MenuPlate(map,Session.StageLabel(i),12+114*(slot%3),16+149*(slot/3),111,144,
                    done?new Color32(215,240,167,255):new Color32(255,242,202,255),
                    done?new Color32(145,194,94,255):new Color32(230,201,144,255),Color.clear,0,0);
                slot++;
                int stage=i;
                if(current) MenuClick(node,()=>OpenMobilePreview(stage));
                var badge=MenuBox(node,"ChapterHex",29,12,53,58);
                badge.gameObject.AddComponent<PhoneChapterBadge>().color=done?new Color32(182,218,124,255):new Color32(249,246,229,255);
                var green=new Color32(78,108,62,255);
                MenuText(node,"ChapterNumber",(i-Session.TutorialCount+1).ToString("00"),25,13,61,57,16,green,TextAnchor.MiddleCenter,true);
                MenuText(node,"ChapterName",Session.StageName(i),3,76,105,24,11,green);
                if(done) MenuText(node,"Completed","Tamamlandı",3,104,105,25,10,green);
            }
            if(next>=0) MenuText(page,"JourneyNote","Açık bir durağa dokun, hedeflerini gör ve kendi hızında devam et.",16,552+extraHeight,358,36,11,MenuCream);
            MenuText(page,"Footer","Biraz düşün. Biraz yeşert.",14,603+extraHeight,190,25,9,PlumEdge,TextAnchor.MiddleLeft);
            DrawPhoneNav(frame,"journey");
        }

        private void ClosePreviewLayer()
        {
            if(previewLayer==null) return;
            previewLayer.SetActive(false); Destroy(previewLayer); previewLayer=null;
        }

        public void OpenMobilePreview(int stage)
        {
            if(!ready || !HasInterface || stage<Session.TutorialCount || !Session.CanOpenStage(stage)) return;
            var p=Session.GetChapterPreview(stage);
            if(p==null) return;
            string origin=CurrentScreen;
            if(origin=="preview") return;
            modal.SetActive(false); ClosePreviewLayer();
            CurrentScreen="preview";
            previewLayer=Panel("ChapterPreview",safe,Vector2.zero,Vector2.one,new Color32(16,10,41,186));
            PhoneBackdrop.Show(previewLayer);
            previewLayer.transform.SetAsLastSibling();
            Action cancel=()=>{
                ClosePreviewLayer(); CurrentScreen=origin;
                if(origin=="result") EvaluateOutcome();
            };
            var shell=CastlePopupChrome.Create(previewLayer.transform,"GoalCard","ChapterTitle",Session.StageName(stage),cancel);
            float height=p.Resume||p.Rescue?494:441;
            var frame=(RectTransform)shell.transform;
            var viewport=Rect("Viewport",frame,Vector2.zero,Vector2.one);
            viewport.offsetMin=new Vector2(0,10);viewport.offsetMax=new Vector2(0,-62);
            shell.PlaceContent(viewport);
            viewport.gameObject.AddComponent<RectMask2D>();
            viewport.gameObject.AddComponent<Image>().color=Color.clear;
            var card=Rect("Content",viewport,Vector2.zero,Vector2.one);
            var scroll=shell.gameObject.AddComponent<ScrollRect>();
            scroll.horizontal=false; scroll.viewport=viewport; scroll.content=card;
            scroll.movementType=ScrollRect.MovementType.Clamped;
            shell.gameObject.AddComponent<MobileSheetViewport>().Configure((RectTransform)previewLayer.transform,frame,card,scroll,height);
            var art=MenuBox(card,"IllustrationWell",17,3,326,105);
            shell.Illustrate(art,CastlePopupChrome.Art.Map);
            MenuText(card,"StageTag",Session.StageLabel(stage),22,113,316,23,12,shell.Gold,TextAnchor.MiddleCenter,true);
            string description=p.Rescue?"Taşların, yeşil alanların ve puanın korunuyor.":p.Resume?"Kaldığın yerden devam et.":p.ScoreTarget+" puana ulaş ve her yeri yeşile boya. "+p.Moves+" hamlen var.";
            MenuText(card,"ChapterDescription",description,22,138,316,35,14,shell.Paper);
            var icons=new[]{"hex","leaf","moves"};var labels=new[]{"HEDEF PUAN","BOYANACAK ALAN","HAMLE"};
            string[] values={p.ScoreTarget.ToString(),p.Resume?p.Green+" / "+p.Cells:p.Cells.ToString(),p.Moves.ToString()};
            for(int i=0;i<3;i++)
            {
                var tile=MenuBox(card,labels[i],22+107.5f*i,183,101,97);
                tile.gameObject.AddComponent<Image>().raycastTarget=false;
                shell.Paint(tile.gameObject,CastlePopupChrome.Finish.Inset);
                MenuIcon(tile,icons[i],40,8,22,shell.Gold);
                MenuText(tile,"GoalValue",values[i],2,32,97,34,24,shell.Paper,TextAnchor.MiddleCenter,true);
                MenuText(tile,"GoalName",labels[i],2,65,97,27,9,shell.Gold,TextAnchor.MiddleCenter,true);
            }
            string start=p.Rescue?"İkinci şans seçenekleri":p.Resume?"Devam et":"Başla";
            var button=MenuBox(card,start,41,304,278,51);
            MenuClick(button,()=>{ClosePreviewLayer(); BeginStage(stage);});
            shell.Paint(button.gameObject,CastlePopupChrome.Finish.Primary);
            CastlePopupChrome.EmbossAction(MenuText(button,"Label",start,3,0,272,49,18,shell.Paper,TextAnchor.MiddleCenter,true));
            if(p.Resume || p.Rescue)
            {
                var restart=MenuBox(card,"Yeni tahtayla baştan başla",22,367,316,43);
                MenuText(restart,"Label","Yeni tahtayla baştan başla",0,0,316,43,14,shell.Paper);
                MenuClick(restart,()=>{
                    ClosePreviewLayer(); CurrentScreen=origin;
                    ShowModal("Baştan başlamak ister misin?","Bu bölümdeki ilerlemen sıfırlanacak. Hamle yaptıysan 1 can gider. Yeni bir tahta için canın olmalı.",()=>OpenMobilePreview(stage));
                    AddAction("Yeni tahtayla başla",0,()=>{if(Session.StartChapterFresh(stage)) OpenCurrentBoard();else ShowCommandFailure(Session.LastError);});
                    AddAction("Vazgeç",1,()=>OpenMobilePreview(stage));
                });
            }
        }
    }
}
