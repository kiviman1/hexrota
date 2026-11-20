using System;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        private enum SheetStyle { Primary, Secondary, Plain, Danger }
        private RectTransform sheetContent, sheetFrame, sheetDecor;
        private Text sheetEyebrow;
        private CastlePopupChrome sheetChrome;
        private Color SheetInk => sheetChrome.Paper;
        private static Color Tone(int rgb) { return new Color32((byte)(rgb>>16),(byte)(rgb>>8),(byte)rgb,255); }

        private static void At(RectTransform r,float x,float y,float w,float h)
        {
            r.anchorMin = r.anchorMax = new Vector2(0,1); r.pivot = new Vector2(0,1);
            r.sizeDelta = new Vector2(w,h); r.anchoredPosition = new Vector2(x,-y); r.localScale = Vector3.one;
        }

        private GameObject SheetPlate(string name,float x,float y,float w,float h,int top,int bottom,int border,float corner=10)
        {
            var panel = Panel(name,sheetDecor,Vector2.zero,Vector2.one,Color.white);
            At((RectTransform)panel.transform,x,y,w,h);
            PhoneSkin.Plate(panel,Tone(top),Tone(bottom),Tone(border),corner,1.6f);
            return panel;
        }

        private Text SheetText(string name,string value,float x,float y,float width,float height,int size,Color color,
            TextAnchor align=TextAnchor.MiddleLeft,bool bold=false)
        {
            var label=Label(name,sheetDecor,value,Vector2.zero,Vector2.one,size,align);
            At(label.rectTransform,x,y,width,height); label.color=color; label.fontStyle=bold?FontStyle.Bold:FontStyle.Normal;
            label.resizeTextMinSize=Mathf.Max(8,size-2); label.resizeTextMaxSize=size;
            label.verticalOverflow=VerticalWrapMode.Truncate;
            return label;
        }

        private Button SheetButton(string name,float x,float y,float width,float height,Action action,SheetStyle style=SheetStyle.Primary,string symbol=null)
        {
            var button=MakeButton(name,sheetDecor,Vector2.zero,Vector2.one,action);
            At((RectTransform)button.transform,x,y,width,height);
            var label=button.GetComponentInChildren<Text>();
            label.color=sheetChrome.Paper;
            label.fontSize=style==SheetStyle.Primary?18:14; label.resizeTextMaxSize=label.fontSize; label.resizeTextMinSize=10;
            if(style==SheetStyle.Plain) button.GetComponent<Image>().color=Color.clear;
            else sheetChrome.Paint(button.gameObject, style==SheetStyle.Primary?CastlePopupChrome.Finish.Primary:
                style==SheetStyle.Danger?CastlePopupChrome.Finish.Danger:CastlePopupChrome.Finish.Secondary);
            if(style==SheetStyle.Primary) CastlePopupChrome.EmbossAction(label);
            if(symbol!=null)
            {
                bool trailing=style==SheetStyle.Primary;
                float inset=style==SheetStyle.Plain?5f:14f;
                float iconWidth=Mathf.Min(18f,width*.18f);
                float left=trailing?width-inset-iconWidth:inset;
                var caption=label.rectTransform;
                caption.anchorMin=Vector2.zero;caption.anchorMax=Vector2.one;
                caption.offsetMin=new Vector2(trailing?7:inset+iconWidth+4,2);
                caption.offsetMax=new Vector2(trailing?-inset-iconWidth-4:-7,-2);
                PhoneSkin.Icon(button.transform,symbol,new Vector2(left/width,.30f),new Vector2((left+iconWidth)/width,.70f),label.color);
            }
            return button;
        }

        private void BeginSheet(string heading,float height,Action close)
        {
            HideReviewControl();
            modal.SetActive(true); modal.transform.SetAsLastSibling();
            modalCopy.transform.SetParent(modal.transform,false);
            actions.SetParent(modal.transform,false);
            foreach(Transform item in actions) { item.gameObject.SetActive(false); Destroy(item.gameObject); }
            if(sheetFrame!=null) {sheetFrame.gameObject.SetActive(false);Destroy(sheetFrame.gameObject);}
            modal.GetComponent<Image>().color=new Color(0.063f,0.04f,0.161f,.74f);
            PhoneBackdrop.Show(modal);
            sheetChrome=CastlePopupChrome.Create(modal.transform,"PhoneSheet","ModalTitle",heading,close);
            var frame=sheetChrome.gameObject;
            sheetFrame=(RectTransform)sheetChrome.transform;
            var viewport=Rect("Viewport",sheetFrame,Vector2.zero,Vector2.one);
            viewport.offsetMin=new Vector2(0,10); viewport.offsetMax=new Vector2(0,-62);
            sheetChrome.PlaceContent(viewport);
            viewport.gameObject.AddComponent<RectMask2D>();
            viewport.gameObject.AddComponent<Image>().color=Color.clear;
            var scroll=frame.AddComponent<ScrollRect>();scroll.horizontal=false;scroll.movementType=ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity=24;scroll.viewport=viewport;
            sheetContent=Rect("ScrollableContent",viewport,Vector2.zero,Vector2.one);
            sheetDecor=Rect("Content",sheetContent,Vector2.zero,Vector2.one);
            scroll.content=sheetContent;
            frame.AddComponent<MobileSheetViewport>().Configure((RectTransform)modal.transform,sheetFrame,sheetContent,scroll,height);
            actions.SetParent(sheetContent,false); At(actions,22,210,316,216);
            modalCopy.gameObject.SetActive(true);
        }

        private void ShowPhoneSheet(string heading,string copy,string eyebrow,float height,Action close=null)
        {
            BeginSheet(heading,height,close);
            sheetEyebrow=SheetText("Eyebrow",eyebrow,22,14,316,23,12,sheetChrome.Gold,TextAnchor.MiddleCenter,true);
            sheetEyebrow.gameObject.SetActive(!string.IsNullOrWhiteSpace(eyebrow));
            modalCopy.transform.SetParent(sheetDecor,false);
            At(modalCopy.rectTransform,25,44,310,85);
            modalCopy.text=copy; modalCopy.color=sheetChrome.Paper; modalCopy.alignment=TextAnchor.MiddleCenter;
            modalCopy.fontStyle=FontStyle.Normal;
            modalCopy.fontSize=15; modalCopy.resizeTextMinSize=12; modalCopy.resizeTextMaxSize=15;
        }

        private void SheetHero(CastlePopupChrome.Art art, float top, float height)
        {
            var well=Rect("IllustrationWell",sheetDecor,Vector2.zero,Vector2.one);
            At(well,17,top,326,height);
            sheetChrome.Illustrate(well,art);
        }

        private void EnableSheetButton(Button button,bool enabled)
        {
            button.interactable=enabled;
            if (!enabled) button.gameObject.AddComponent<CanvasGroup>().alpha=.60f;
        }

        private void DrawPause()
        {
            ShowPhoneSheet("Rota seni bekler.","Tahtan ve kalan hamlelerin burada korunuyor.","",435,Resume);
            SheetHero(CastlePopupChrome.Art.Map,4,100);
            At(modalCopy.rectTransform,22,111,316,36);
            resumeButton=SheetButton("Devam et",50,154,260,51,Resume,SheetStyle.Primary,"play");
            SheetButton("Bölümü yeniden başlat",30,220,300,43,ConfirmRestart,SheetStyle.Secondary,"reset");
            SheetButton("Ayarlar",30,272,300,43,OpenMobileSettings,SheetStyle.Secondary,"settings");
            SheetButton("Ana menüye dön",22,322,316,36,LeaveFromPause,SheetStyle.Plain,"home");
        }

        // Leaving an open chapter after a move spends the life reserved for it, so the player confirms first.
        private void LeaveFromPause()
        {
            if(!Session.LeavingSpendsLife){ReturnToMenu();return;}
            ShowPhoneSheet("Bölümden çıkılsın mı?","Bu bölüm için ayrılan can harcanacak. Bölüme yeniden girersen yeni bir tahta açılır.","",331,DrawPause);
            SheetHero(CastlePopupChrome.Art.Heart,4,78);
            At(modalCopy.rectTransform,25,93,310,65);
            SheetButton("Çık, can harcansın",30,172,300,48,ReturnToMenu,SheetStyle.Danger,"home");
            SheetButton("Vazgeç",30,234,300,44,DrawPause,SheetStyle.Secondary);
        }

        private void DrawRestart()
        {
            bool fromPause=CurrentScreen=="paused";
            if(Session.IsTutorial){Restart();return;}
            if(!fromPause){CancelPresentation();Session.Suspend();Board.InputEnabled=false;CurrentScreen="paused";}
            Action cancel=()=>{if(fromPause){DrawPause();return;}OpenCurrentBoard(false);};
            int cost=Session.PreviewRestartCharge();
            var life=Session.LifeStatus;
            // The open chapter already holds a reserved life; a restart after a move spends it and reserves a new one.
            string text="Bu bölümdeki ilerlemen sıfırlanacak. Yeni bir tahta açılacak. Bu işlem can harcamaz.";
            if (cost>0 && !Convert.ToBoolean(life["canStart"]))
                text="Bu deneme kapanacak ve bu bölüm için ayrılan can harcanacak. Yeni deneme için can gerekir.";
            else if (cost>0)
                text="Bu bölümdeki ilerlemen sıfırlanacak ve "+cost+" can harcanacak. "+
                    (Convert.ToInt32(life["lives"])==1?"Son canını kullanıyorsun. Yeni tahta açmak için sonra beklemen veya can alman gerekecek.":"Yeni bir tahta açılacak.");
            ShowPhoneSheet("Baştan başlamak ister misin?",text,"",371,cancel);
            SheetHero(CastlePopupChrome.Art.Heart,4,78);
            At(modalCopy.rectTransform,25,93,310,65);
            SheetButton("Yeni tahtayla başla",30,172,300,48,()=>RestartWithQuote(cost),SheetStyle.Danger);
            SheetButton("Vazgeç",30,234,300,44,cancel,SheetStyle.Secondary);
        }
    }
}
