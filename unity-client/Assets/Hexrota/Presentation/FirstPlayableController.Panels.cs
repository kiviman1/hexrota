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
        private Image sheetRibbon;
        private PhoneRibbonTails sheetTails;
        private static readonly Color PurpleText = new Color32(75,44,84,255);
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
            label.color=style==SheetStyle.Plain?Tone(0x725374):Tone(0xfff6df);
            label.fontSize=style==SheetStyle.Primary?15:12;label.resizeTextMaxSize=label.fontSize;label.resizeTextMinSize=10;
            if(style==SheetStyle.Plain) button.GetComponent<Image>().color=Color.clear;
            else
            {
                int top=style==SheetStyle.Primary?0x88c83d:style==SheetStyle.Danger?0xed7185:0x8859a7;
                int bottom=style==SheetStyle.Primary?0x2b771c:style==SheetStyle.Danger?0xab3057:0x583279;
                int border=style==SheetStyle.Primary?0xcce77d:style==SheetStyle.Danger?0xffaaa0:0xae87cb;
                PhoneSkin.Plate(button.gameObject,Tone(top),Tone(bottom),Tone(border),11,2);
                var shadow=button.gameObject.AddComponent<Shadow>();
                shadow.effectDistance=new Vector2(0,-2);shadow.effectColor=Tone(style==SheetStyle.Primary?0x235d24:0x41284f);
            }
            if(symbol!=null)
            {
                float fraction=18f/width; bool trailing=style==SheetStyle.Primary;
                float offset=Mathf.Min(.41f,(name.Length*3.6f+12f)/width);
                float cx=.5f+(trailing?offset:-offset);
                label.rectTransform.anchoredPosition=new Vector2(trailing?-9:9,0);
                PhoneSkin.Icon(button.transform,symbol,new Vector2(cx-fraction*.5f,.30f),new Vector2(cx+fraction*.5f,.7f),label.color);
            }
            return button;
        }

        private void BeginSheet(float height)
        {
            HideReviewControl();
            modal.SetActive(true); modal.transform.SetAsLastSibling();
            modalTitle.transform.SetParent(modal.transform,false);
            modalCopy.transform.SetParent(modal.transform,false);
            actions.SetParent(modal.transform,false);
            foreach(Transform item in actions) { item.gameObject.SetActive(false); Destroy(item.gameObject); }
            if(sheetFrame!=null) {sheetFrame.gameObject.SetActive(false);Destroy(sheetFrame.gameObject);}
            modal.GetComponent<Image>().color=new Color(0.063f,0.04f,0.161f,.74f);
            var frame=Panel("PhoneSheet",modal.transform,Vector2.zero,Vector2.one,Color.white);
            sheetFrame=(RectTransform)frame.transform;
            PhoneSkin.Plate(frame,Tone(0xfff9e6),Tone(0xf4dfb0),Tone(0xbd8247),25,4);
            var shadow=frame.AddComponent<Shadow>();shadow.effectDistance=new Vector2(0,-7);shadow.effectColor=Tone(0x633f33);
            var viewport=Rect("Viewport",sheetFrame,Vector2.zero,Vector2.one);
            viewport.gameObject.AddComponent<RectMask2D>();
            var scroll=frame.AddComponent<ScrollRect>();scroll.horizontal=false;scroll.movementType=ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity=24;scroll.viewport=viewport;
            sheetContent=Rect("ScrollableContent",viewport,Vector2.zero,Vector2.one);
            sheetDecor=Rect("Content",sheetContent,Vector2.zero,Vector2.one);
            scroll.content=sheetContent;
            frame.AddComponent<MobileSheetViewport>().Configure((RectTransform)modal.transform,sheetFrame,sheetContent,scroll,height);
            actions.SetParent(sheetContent,false); At(actions,22,210,316,216);
            modalTitle.gameObject.SetActive(true);modalCopy.gameObject.SetActive(true);
        }

        private void ShowPhoneSheet(string heading,string copy,string eyebrow,float height,Action close=null)
        {
            BeginSheet(height);
            sheetEyebrow=SheetText("Eyebrow",eyebrow,22,30,280,26,10,Tone(0x8b5d66),TextAnchor.MiddleLeft,true);
            sheetRibbon=SheetPlate("Ribbon",22,68,316,50,0xf27791,0xbd3767,0xffa9a1).GetComponent<Image>();
            var shadow=sheetRibbon.gameObject.AddComponent<Shadow>();shadow.effectDistance=new Vector2(0,-4);shadow.effectColor=Tone(0x7c2f57);
            sheetTails=Rect("RibbonTails",sheetRibbon.transform,Vector2.zero,Vector2.one).gameObject.AddComponent<PhoneRibbonTails>();
            sheetTails.raycastTarget=false;
            modalTitle.transform.SetParent(sheetRibbon.transform,false);
            At(modalTitle.rectTransform,12,0,292,50);
            modalTitle.text=heading;modalTitle.color=Tone(0xfff6df);modalTitle.alignment=TextAnchor.MiddleLeft;
            modalTitle.fontSize=24;modalTitle.resizeTextMinSize=16;modalTitle.resizeTextMaxSize=24;modalTitle.fontStyle=FontStyle.Bold;
            modalCopy.transform.SetParent(sheetDecor,false);At(modalCopy.rectTransform,22,132,316,52);
            modalCopy.text=copy;modalCopy.color=Tone(0x715266);modalCopy.alignment=TextAnchor.UpperLeft;
            modalCopy.fontSize=13;modalCopy.resizeTextMinSize=11;modalCopy.resizeTextMaxSize=13;modalCopy.fontStyle=FontStyle.Normal;
            if(close!=null)
            {
                var cross=SheetButton("Kapat",304,16,40,43,close,SheetStyle.Danger);
                PhoneSkin.Plate(cross.gameObject,Tone(0xff9d9b),Tone(0xdf416b),Tone(0xffd1b7),22,2);
                cross.GetComponentInChildren<Text>().text="";
                PhoneSkin.Icon(cross.transform,"close",new Vector2(.28f,.28f),new Vector2(.72f,.72f),Color.white);
            }
        }

        private void CenterTitle(float y)
        {
            At(sheetRibbon.rectTransform,22,y,316,50);modalTitle.alignment=TextAnchor.MiddleCenter;
            modalTitle.fontStyle=FontStyle.BoldAndItalic;
        }

        private void SheetSymbol(string symbol,float y,bool large)
        {
            float w=large?82:48,h=large?90:54;
            var rect=Rect("Symbol",sheetDecor,Vector2.zero,Vector2.one);
            At(rect,(360-w)/2,y,w,h);
            var badge=rect.gameObject.AddComponent<PhoneChapterBadge>();
            badge.color=Tone(0xead9f3);badge.raycastTarget=false;
            PhoneSkin.Icon(rect,symbol,new Vector2(.23f,.23f),new Vector2(.77f,.77f),Tone(0x714695));
        }

        private void DrawPause()
        {
            ShowPhoneSheet("Rota seni bekler.","Tahtan ve kalan hamlelerin burada korunuyor.","KÜÇÜK BİR MOLA",500,Resume);
            SheetSymbol("pause",30,false);
            At(sheetEyebrow.rectTransform,22,103,316,18);sheetEyebrow.alignment=TextAnchor.MiddleCenter;
            CenterTitle(143); At(modalCopy.rectTransform,22,209,316,24);modalCopy.alignment=TextAnchor.MiddleCenter;
            resumeButton=SheetButton("Devam et",22,255,316,50,Resume,SheetStyle.Primary,"play");
            SheetButton("Bölümü yeniden başlat",22,315,316,46,ConfirmRestart,SheetStyle.Secondary,"reset");
            SheetButton("Ayarlar",22,371,316,46,OpenMobileSettings,SheetStyle.Secondary,"settings");
            SheetButton("Ana menüye dön",22,434,316,40,ReturnToMenu,SheetStyle.Plain,"home");
        }

        private void DrawRestart()
        {
            bool fromPause=CurrentScreen=="paused";
            if(Session.IsTutorial){Restart();return;}
            if(!fromPause){CancelPresentation();Session.Suspend();Board.InputEnabled=false;CurrentScreen="paused";}
            Action cancel=()=>{if(fromPause){DrawPause();return;}OpenCurrentBoard();};
            int cost=Session.PreviewRestartCharge();
            var life=Session.LifeStatus;
            string text="Bu bölümdeki ilerlemen sıfırlanacak. Yeni bir tahta açılacak. Bu işlem can harcamaz.";
            if (cost>0)
                text="Bu bölümdeki ilerlemen sıfırlanacak ve "+cost+" can harcanacak. "+
                    (Convert.ToInt32(life["lives"])==1?"Son canını kullanıyorsun. Yeni tahta açmak için sonra beklemen veya can alman gerekecek.":"Yeni bir tahta açılacak.");
            else if(Session.Snapshot.turn>0 && !Convert.ToBoolean(life["canStart"]))
                text="Bu deneme kapanacak. Canın olmadığı için can harcanmaz. Yeni deneme için can gerekir.";
            ShowPhoneSheet("Baştan başlamak ister misin?",text,"",355,cancel);
            SheetButton("Yeni tahtayla başla",22,207,316,50,()=>RestartWithQuote(cost),SheetStyle.Danger);
            SheetButton("Vazgeç",22,269,316,46,cancel,SheetStyle.Secondary);
        }
    }
}
