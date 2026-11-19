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
        private UnityGameSession.EarnedResult pendingHomeRewards;
        internal bool HomePanelOpen => (modal != null && modal.activeInHierarchy) ||
            (previewLayer != null && previewLayer.activeInHierarchy) || (optionsShade != null && optionsShade.activeInHierarchy);
        internal Vector2 HomeRewardSource => castleHome.RewardSource;
        private static readonly Color MenuCream = new Color32(255,245,217,255);
        private static readonly Color MenuGold = new Color32(255,211,106,255);
        private static readonly Color PlumTop = new Color32(125,85,151,255);
        private static readonly Color PlumBottom = new Color32(70,42,91,255);
        private static readonly Color PlumEdge = new Color32(191,150,208,255);

        private void BuildPhoneHome()
        {
            menu = Panel("MainMenu", safe, Vector2.zero, Vector2.one, Color.clear);
            if (castleHome == null)
            {
                var prefab = Resources.Load<GameObject>("CastleHome/CastleHome");
                castleHome = Instantiate(prefab, menu.transform, false).GetComponent<CastleHomeView>();
                var rect = (RectTransform)castleHome.transform;
                rect.anchorMin = Vector2.zero;
                rect.anchorMax = Vector2.one;
                rect.offsetMin = rect.offsetMax = Vector2.zero;
            }
            else
            {
                castleHome.transform.SetParent(menu.transform, false);
            }
            castleHome.Bind(this, phoneAudio);
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

        private void ClearMenuPage()
        {
            ClosePreviewLayer();
            if (homeContent != null)
            {
                homeContent.gameObject.SetActive(false);
                Destroy(homeContent.gameObject);
                homeContent = null;
            }
            homeLifeLabel = null;
            homeLifeTimer = null;
            homeHearts = null;
        }

        private RectTransform ResetHomePage()
        {
            ClearMenuPage();
            if (castleHome != null) castleHome.gameObject.SetActive(false);
            homeContent = MenuFrame(menu.transform, "PhoneMenu");
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

        private void DrawHome()
        {
            ClearMenuPage();
            if (castleHome == null) return;
            castleHome.gameObject.SetActive(true);
            castleHome.ShowStage(Session.NextStage, Session.TutorialCount);
            var wallet = Session.ReadPhoneWallet();
            castleHome.ShowWallet(wallet);
            nextLifeDisplay = Time.unscaledTime + 1;
            var earned = pendingHomeRewards;
            pendingHomeRewards = null;
            if (earned == null) return;
            Canvas.ForceUpdateCanvases();
            castleHome.Rewards.PlayWin(HomeRewardSource, earned.GoldenEggs, earned.Gold, wallet);
        }

        private void RememberHomeRewards()
        {
            if (!Session.HasAttempt || Session.IsTutorial || Session.Status != "won") return;
            var earned = Session.ReadEarnedResult();
            if (earned.GoldenEggs > 0 || earned.Gold > 0) pendingHomeRewards = earned;
        }

        private void CancelHomeRewards()
        {
            pendingHomeRewards = null;
            if (castleHome != null) castleHome.Rewards.Cancel();
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

        private const string PlayingInstructions = "Komşu iki taşı kaydırarak veya sırayla dokunarak yer değiştir. Aynı sayıdan en az üç taş düz bir hat oluşturunca eşleşir.\n\nÜç tane 3, 9 puan kazandırır. Eşleşmenin altındaki zemin bir kat açılır. Hamlelerin bitmeden puan hedefine ulaş ve bütün zemini yeşert.";

        private void ShowHomeRules()
        {
            string back=CurrentScreen;
            Action close=()=>{modal.SetActive(false); CurrentScreen=back;};
            ShowModal("Nasıl oynanır?",PlayingInstructions,close);
            if (Session.NextStage == Session.TutorialCount)
                AddAction("Bölüm 1’i oyna",0,()=>BeginStage(Session.TutorialCount));

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
            Action[] destinations={ShowMenu,OpenJourney,OpenRecords,OpenMobileSettings};
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
            string[] names={"Altın","Altın Yumurta","Yeşil Fırça","Renk Anahtarı"};
            int[] values={wallet.Gold,wallet.GoldenEggs,wallet.Brushes,wallet.Keys};
            for(int i=0;i<4;i++)
            {
                float left=i*90;
                if(i<2) MenuText(bar,"Symbol","●",left+31,10,18,23,14,MenuGold,TextAnchor.MiddleLeft,true);
                else MenuIcon(bar,i==2?"leaf":"swap",left+26,17,14,MenuCream);
                MenuText(bar,names[i]+"Value",values[i].ToString(),left+49,9,40,26,16,MenuCream,TextAnchor.MiddleLeft,true);
                MenuText(bar,names[i],names[i],left,32,90,17,9,MenuCream,TextAnchor.MiddleCenter,true);
            }
        }
        private void TickPhoneLife()
        {
            if (Time.unscaledTime < nextLifeDisplay) return;
            if (CurrentScreen == "menu" && castleHome != null)
            {
                if (castleHome.Rewards.IsPlaying) return;
                castleHome.ShowWallet(Session.ReadPhoneWallet());
            }
            else if (CurrentScreen == "journey" && homeLifeTimer != null && homeLifeLabel != null)
            {
                var wallet = Session.ReadPhoneWallet();
                homeLifeTimer.text = wallet.Timer;
                homeLifeLabel.text = wallet.Lives + " / " + wallet.Maximum + " can";
                TintHearts(wallet.Lives);
            }
            else return;
            nextLifeDisplay = Time.unscaledTime + 1;
        }

        private void TintHearts(int lives)
        {
            if(homeHearts==null) return;
            for(int i=0;i<homeHearts.Length;i++)
                if (homeHearts[i] != null) homeHearts[i].color=i<lives?new Color32(189,113,128,255):new Color32(243,238,232,255);
        }
    }
}
