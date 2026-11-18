using System;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        private RectTransform homeContent;
        private GameObject previewLayer;
        private Text homeLifeLabel, homeLifeTimer;
        private RawImage[] homeHearts;
        private float nextLifeDisplay;
        private static readonly Color MenuCream = new Color32(255,245,217,255);
        private static readonly Color MenuGold = new Color32(255,211,106,255);
        private static readonly Color PlumTop = new Color32(125,85,151,255);
        private static readonly Color PlumBottom = new Color32(70,42,91,255);
        private static readonly Color PlumEdge = new Color32(191,150,208,255);

        private void BuildPhoneHome()
        {
            menu = Panel("MainMenu",safe,Vector2.zero,Vector2.one,Color.clear);
        }

        private RectTransform MenuFrame(Transform parent,string name)
        {
            var frame = Rect(name,parent,new Vector2(.5f,.5f),new Vector2(.5f,.5f));
            frame.gameObject.AddComponent<PhonePageFrame>().Fit();
            return frame;
        }

        // Child coordinates use a top-left origin, like the reference mobile layout.
        private RectTransform MenuBox(Transform parent,string name,float x,float y,float w,float h)
        {
            var box = Rect(name,parent,Vector2.up,Vector2.up);
            box.pivot = Vector2.up;
            box.sizeDelta = new Vector2(w,h); box.anchoredPosition = new Vector2(x,-y);
            return box;
        }

        private RectTransform CenteredStrip(Transform parent,string name,float height,float fromTop)
        {
            var box = Rect(name,parent,new Vector2(.5f,1),new Vector2(.5f,1));
            box.pivot = new Vector2(.5f,1); box.sizeDelta = new Vector2(390,height);
            box.anchoredPosition = new Vector2(0,-fromTop); return box;
        }

        private Text MenuText(Transform parent,string name,string copy,float x,float y,float w,float h,
            int pixels,Color colour,TextAnchor align=TextAnchor.MiddleCenter,bool bold=false)
        {
            var slot = MenuBox(parent,name+"Slot",x,y,w,h);
            var label = Label(name,slot,copy,Vector2.zero,Vector2.one,pixels,align);
            label.resizeTextForBestFit = false;
            // The parent scales CSS pixels into the reference Canvas. Request a
            // denser dynamic-font atlas and keep the same rendered line metrics.
            label.rectTransform.anchorMin=label.rectTransform.anchorMax=new Vector2(.5f,.5f);
            label.rectTransform.sizeDelta=new Vector2(w*2,h*2);
            label.rectTransform.localScale=new Vector3(.5f,.5f,1);
            label.fontSize=pixels*2;
            label.fontStyle = bold ? FontStyle.Bold : FontStyle.Normal;
            label.color=colour; return label;
        }

        private RawImage MenuArt(Transform parent,string name,string path,float x,float y,float w,float h)
        {
            var slot = MenuBox(parent,name,x,y,w,h);
            var image = slot.gameObject.AddComponent<RawImage>();
            image.texture=Resources.Load<Texture2D>(path); image.raycastTarget=false;
            return image;
        }
        private void MenuIcon(Transform parent,string symbol,float x,float y,float size,Color colour)
        {
            PhoneSkin.Icon(MenuBox(parent,symbol+"Slot",x,y,size,size),symbol,Vector2.zero,Vector2.one,colour);
        }
        private RectTransform MenuPlate(Transform parent,string name,float x,float y,float w,float h,
            Color top,Color bottom,Color border,float radius,float line=1)
        {
            var box=MenuBox(parent,name,x,y,w,h); box.gameObject.AddComponent<Image>();
            PhoneSkin.Plate(box.gameObject,top,bottom,border,radius,line); return box;
        }
        private void MenuClick(RectTransform box,Action command)
        {
            var hit=box.GetComponent<Graphic>();
            if(hit==null) { var clear=box.gameObject.AddComponent<Image>(); clear.color=Color.clear; hit=clear; }
            hit.raycastTarget=true;
            var button=box.gameObject.AddComponent<Button>(); button.targetGraphic=hit;
            button.onClick.AddListener(()=>command());
        }
        private void MenuAction(Transform parent,string symbol,string title,float x,float y,float w,float h,Action command)
        {
            var button=MenuPlate(parent,title,x,y,w,h,PlumTop,PlumBottom,PlumEdge,12,1.5f);
            MenuClick(button,command);
            if(symbol!=null) MenuIcon(button,symbol,9,(h-20)/2,20,MenuCream);
            if(title.Length>0) MenuText(button,"Label",title,symbol==null?0:28,0,w-(symbol==null?0:32),h,13,MenuCream,TextAnchor.MiddleCenter,true);
        }
        private void PrimaryHomeAction(Transform parent,string title,string detail,float x,float y,float w,float h,Action command)
        {
            MenuPlate(parent,"ButtonShadow",x,y+4,w,h,new Color32(56,87,21,255),new Color32(39,61,21,255),Color.clear,20,0);
            var button=MenuPlate(parent,title,x,y,w,h,new Color32(163,225,65,255),new Color32(44,121,27,255),new Color32(213,244,132,255),20,2);
            MenuClick(button,command);
            MenuPlate(button,"PlayBadge",18,20,34,37,new Color(0,0,0,.16f),new Color(0,0,0,.16f),Color.clear,9,0);
            MenuIcon(button,"play",25,28,20,MenuCream);
            var main=MenuText(button,"ActionTitle",title,64,10,w-98,33,23,Color.white,TextAnchor.MiddleLeft,true);
            Emphasize(main);
            MenuText(button,"ActionDetail",detail,64,41,w-96,22,11,Color.white,TextAnchor.MiddleLeft,true);
            MenuIcon(button,"arrow",w-39,29,18,MenuCream);
        }

        private RectTransform ResetHomePage()
        {
            ClosePreviewLayer();
            foreach(Transform child in menu.transform) { child.gameObject.SetActive(false); Destroy(child.gameObject); }
            homeLifeLabel=null; homeLifeTimer=null; homeHearts=null;
            homeContent=MenuFrame(menu.transform,"PhoneMenu");
            return homeContent;
        }

        private RectTransform ScrollingPage(RectTransform frame,float height,bool navigation)
        {
            var window=Rect("ScrollViewport",frame,Vector2.zero,Vector2.one);
            window.offsetMin=new Vector2(0,navigation?66:0);
            window.gameObject.AddComponent<RectMask2D>();
            var catcher=window.gameObject.AddComponent<Image>(); catcher.color=Color.clear;
            var scroll=window.gameObject.AddComponent<ScrollRect>();
            var content=CenteredStrip(window,"PageContent",height,0);
            scroll.horizontal=false; scroll.vertical=true; scroll.viewport=window; scroll.content=content;
            scroll.movementType=ScrollRect.MovementType.Clamped; scroll.scrollSensitivity=30;
            scroll.verticalNormalizedPosition=1; return content;
        }

        private void DrawHome(bool fresh)
        {
            var frame=ResetHomePage();
            var shade=Panel("WorldTint",frame,Vector2.zero,Vector2.one,Color.white);
            PhoneSkin.Plate(shade,new Color32(32,57,43,48),new Color32(37,26,59,149),Color.clear,0,0);
            if(fresh)
            {
                var scroll=ScrollingPage(frame,Mathf.Max(frame.rect.height,620),false);
                MenuArt(scroll,"HexrotaLogo","PhoneMenu/wordmark",116,18,158,40);
                float heroTop=Mathf.Max(86,(scroll.rect.height-844)*.5f+182);
                var bubble=MenuPlate(scroll,"Speech",75,heroTop,240,43,MenuCream,new Color32(247,228,184,255),new Color32(191,138,71,255),18,2);
                var tail=MenuPlate(scroll,"SpeechTail",160,heroTop+34,12,12,new Color32(247,228,184,255),new Color32(247,228,184,255),new Color32(191,138,71,255),0,1);
                tail.localEulerAngles=new Vector3(0,0,45); bubble.SetAsLastSibling();
                MenuText(bubble,"SpeechText","Buraya bir kümes kuralım!",8,3,224,35,14,Ink,TextAnchor.MiddleCenter,true);
                MenuArt(scroll,"TavikPortrait","CoopArt/inspect",105,heroTop+58,180,180);
                var title=MenuText(scroll,"HomeTitle","Tavik’in\n<color=#FFDA75>ilk kümesi.</color>",18,heroTop+252,354,97,40,MenuCream,TextAnchor.MiddleCenter,true);
                Emphasize(title);
                MenuText(scroll,"HomeCopy","Eşleştir, ilerle ve kümesi birlikte kur.",20,heroTop+356,350,29,15,MenuCream);
                PrimaryHomeAction(scroll,"Başlayalım","İlk hamleyi birlikte yapalım",24,heroTop+406,342,78,BeginJourney);
                return;
            }

            var body=ScrollingPage(frame,1098,true);
            DrawPhoneHeaderBody(body);
            DrawWallet(body,75,143);
            MenuText(body,"Eyebrow","KENDİ TEMPOUNDA BİR YOLCULUK",20,378,350,20,8,MenuCream,TextAnchor.MiddleCenter,true);
            Emphasize(MenuText(body,"HomeTitle","Aynı sayıları\n<color=#FFDA75>eşleştir.</color>",26,450,224,90,32,MenuCream,TextAnchor.MiddleCenter,true));
            var actor=MenuArt(body,"TavikPortrait","CoopArt/idle",252,481,112,112);
            actor.uvRect=new Rect(1,0,-1,1);
            MenuText(body,"HomeCopy","Yan yana iki taşın yerini değiştir. Aynı sayıdan en az 3 taş bir sıra oluştursun.",40,597,310,48,13,MenuCream);
            int next=Session.NextStage;
            var preview=next<0?null:Session.GetChapterPreview(next);
            string action=next<0?"Bahçeni gör":preview.Rescue?"Tahtanı aç":preview.Resume?"Devam et":next==0?"Birlikte başlayalım":"Oyna";
            string detail=next<0?"Yeni bölümler yakında":preview.Rescue?Session.StageLabel(next)+" · İkinci şans seçeneklerini gör":
                preview.Resume?Session.StageLabel(next)+" · "+preview.Moves+" hamle kaldı":next==0?"Aynı sayıları eşleştir, puan kazan.":Session.StageLabel(next)+" · "+Session.StageName(next);
            MenuText(body,"StageName",next<0?"Bahçen ve bütün başarıların burada.":Session.StageName(next),25,650,340,27,12,MenuCream);
            PrimaryHomeAction(body,action,detail,28,683,334,78,BeginJourney);
            MenuAction(body,"swap","Birlikte öğrenelim",28,773,334,46,ReplayFirstLesson);
            MenuAction(body,"leaf","Bahçeni gör",28,831,334,44,OpenGarden);
            MenuText(body,"JourneyProgress","Yeşeren yolculuğun",28,885,125,20,11,MenuCream,TextAnchor.MiddleLeft);
            MenuText(body,"ProgressValue",Session.ClearedCount+" / "+(Session.StageCount-Session.TutorialCount)+" bölüm tamamlandı",153,885,209,20,11,MenuCream,TextAnchor.MiddleRight,true);
            MenuPlate(body,"ProgressTrack",28,907,334,6,Card,Card,PlumEdge,3);
            int total=Session.StageCount-Session.TutorialCount;
            if(Session.ClearedCount>0) MenuPlate(body,"Fill",29,908,332f*Session.ClearedCount/total,4,MenuGold,Gold,Color.clear,2,0);
            var names=new[]{"Bölümler","Kayıtların","Ayarlar"};
            var descriptions=new[]{"Sıradaki keşfin seni bekliyor","Yeşerttiğin her adım","Oyunu kendine uyarla"};
            var icons=new[]{"map","records","settings"};
            Action[] actions={OpenJourney,()=>OpenRecords(0),OpenMobileSettings};
            for(int i=0;i<names.Length;i++)
            {
                var shortcut=MenuPlate(body,names[i],14+123*i,936,115,113,MenuCream,new Color32(249,231,189,255),new Color32(195,144,84,255),18,2);
                MenuClick(shortcut,actions[i]); MenuIcon(shortcut,icons[i],47,13,22,Ink);
                MenuText(shortcut,"Title",names[i],3,40,109,24,14,Ink,TextAnchor.MiddleCenter,true);
                MenuText(shortcut,"Detail",descriptions[i],7,65,101,35,11,Ink);
            }
            DrawPhoneNav(frame,"home");
        }

        private void ReplayFirstLesson()
        {
            if (Session.StartChapterFresh(0)) OpenCurrentBoard(); else ShowCommandFailure(Session.LastError);
        }

        private void DrawPhoneHeader(Transform parent)
        {
            DrawPhoneHeaderBody(CenteredStrip(MenuFrame(parent,"HeaderFrame"),"Header",65,0));
        }

        private void DrawPhoneHeaderBody(RectTransform body)
        {
            var logo=MenuArt(body,"HexrotaLogo","PhoneMenu/wordmark",12,14,158,40);
            MenuClick(logo.rectTransform,ShowMenu);
            var sound=MenuPlate(body,"Ses",263,11,37,44,PlumTop,PlumBottom,PlumEdge,19,2);
            var on=PhoneSkin.Icon(sound,"sound",new Vector2(.17f,.2f),new Vector2(.83f,.8f),MenuCream);
            var off=PhoneSkin.Icon(sound,"muted",new Vector2(.17f,.2f),new Vector2(.83f,.8f),MenuCream);
            on.enabled=Session.SoundEnabled; off.enabled=!Session.SoundEnabled;
            MenuClick(sound,()=>{OnSoundToggle();if(on!=null)on.enabled=Session.SoundEnabled;if(off!=null)off.enabled=!Session.SoundEnabled;});
            var help=MenuBox(body,"Nasıl oynanır?",302,11,35,44); MenuIcon(help,"help",8,12,19,MenuCream); MenuClick(help,ShowHomeRules);
            var settings=MenuPlate(body,"Ayarlar",339,11,37,44,PlumTop,PlumBottom,PlumEdge,19,2);
            MenuIcon(settings,"settings",8,12,21,MenuCream); MenuClick(settings,OpenMobileSettings);
        }

        private void ShowHomeRules()
        {
            string back=CurrentScreen;
            ShowModal("Nasıl oynanır?","Yan yana iki taşa sırayla dokun ya da birini diğerine kaydır.\n\nÜç tane 3 eşleşirse 9 puan kazanırsın. Eşleşen taşların altı yeşil olur, yerlerine yeni taşlar gelir.\n\nHedef puana ulaş ve her yeri yeşile boya.");
            AddAction("Birlikte deneyelim",0,ReplayFirstLesson);
            AddAction("Kapat",1,()=>{modal.SetActive(false);CurrentScreen=back;});
        }

        private void DrawPhoneNav(Transform parent,string active)
        {
            var frame=MenuFrame(parent,"NavFrame");
            var bar=Rect("PhoneNavigation",frame,Vector2.zero,Vector2.right);
            bar.pivot=new Vector2(.5f,0); bar.sizeDelta=new Vector2(0,66);
            bar.gameObject.AddComponent<Image>().color=new Color32(57,37,76,255);
            var row=CenteredStrip(bar,"Destinations",66,0);
            string[] names={"Ana menü","Bölümler","Kayıtlar","Ayarlar"};
            string[] icons={"home","map","records","settings"};
            string[] routes={"home","journey","records","settings"};
            Action[] destinations={ShowMenu,OpenJourney,()=>OpenRecords(0),OpenMobileSettings};
            for(int i=0;i<names.Length;i++)
            {
                var slot=MenuBox(row,names[i],10+93.5f*i,9,90,48);
                if(routes[i]==active) {slot.gameObject.AddComponent<Image>();PhoneSkin.Plate(slot.gameObject,PlumTop,PlumBottom,PlumEdge,12,0);}
                MenuClick(slot,destinations[i]); MenuIcon(slot,icons[i],35,4,19,MenuCream);
                MenuText(slot,"Label",names[i],0,26,90,18,11,MenuCream,TextAnchor.MiddleCenter,true);
            }
        }

        private void DrawWallet(RectTransform body,float lifeY,float walletY)
        {
            var wallet=Session.ReadPhoneWallet();
            var life=MenuPlate(body,"Can seçenekleri",25,lifeY,340,57,PlumTop,new Color32(54,33,74,255),new Color32(218,159,69,255),17,2);
            MenuClick(life,OpenMobileLives);
            homeHearts=new RawImage[wallet.Maximum];
            for(int i=0;i<wallet.Maximum;i++)
            {
                homeHearts[i]=MenuArt(life,"Can "+(i+1),"PhoneMenu/heart",15+22*i,19,19,21);
            }
            TintHearts(wallet.Lives);
            homeLifeLabel=MenuText(life,"Lives",wallet.Lives+" / "+wallet.Maximum+" can",134,7,138,21,14,MenuCream,TextAnchor.MiddleLeft,true);
            homeLifeTimer=MenuText(life,"LifeTimer",wallet.Timer,134,29,138,18,11,MenuCream,TextAnchor.MiddleLeft);
            MenuPlate(life,"AddBadge",299,16,26,26,new Color32(165,219,60,255),new Color32(60,128,26,255),MenuCream,13);
            MenuText(life,"Plus","+",299,15,26,27,20,MenuCream);
            var bar=MenuPlate(body,"Wallet",14,walletY,362,57,PlumTop,new Color32(54,33,74,255),new Color32(197,145,80,255),17);
            string[] names={"Altın","Yıldız","Yeşil Fırça","Renk Anahtarı"};
            int[] values={wallet.Gold,wallet.Stars,wallet.Brushes,wallet.Keys};
            for(int i=0;i<4;i++)
            {
                float left=i*90;
                if(i<2) MenuText(bar,"Symbol",i==0?"●":"★",left+31,10,18,23,14,MenuGold,TextAnchor.MiddleLeft,true);
                else MenuIcon(bar,i==2?"leaf":"swap",left+26,17,14,MenuCream);
                MenuText(bar,names[i]+"Value",values[i].ToString(),left+49,9,40,26,16,MenuCream,TextAnchor.MiddleLeft,true);
                MenuText(bar,names[i],names[i],left,32,90,17,9,MenuCream,TextAnchor.MiddleCenter,true);
            }
        }
        private void TickPhoneLife()
        {
            if((CurrentScreen!="menu" && CurrentScreen!="journey") || homeLifeTimer==null || Time.unscaledTime<nextLifeDisplay) return;
            nextLifeDisplay=Time.unscaledTime+1;
            var wallet=Session.ReadPhoneWallet();
            homeLifeTimer.text=wallet.Timer; homeLifeLabel.text=wallet.Lives+" / "+wallet.Maximum+" can";
            TintHearts(wallet.Lives);
        }

        private void TintHearts(int lives)
        {
            if(homeHearts==null) return;
            for(int i=0;i<homeHearts.Length;i++)
                homeHearts[i].color=i<lives?new Color32(189,113,128,255):new Color32(243,238,232,255);
        }
    }
}
