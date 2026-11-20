using System;
using UnityEngine;
using UnityEngine.UI;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        private GameObject optionsShade;
        private RectTransform optionContent;
        private CastlePopupChrome optionsChrome;
        private string optionsReturn, providerRequest;
        private ScrollRect optionsScroll;
        private Text refillTimer;
        private float lifeRefresh;
        private PhoneAudio phoneAudio;

        private static Color OptColor(string hex)
        {
            ColorUtility.TryParseHtmlString("#" + hex, out var color); return color;
        }
        private static void PlaceOption(RectTransform item, float x, float y, float width, float height)
        {
            item.anchorMin = item.anchorMax = item.pivot = Vector2.up;
            item.anchoredPosition = new Vector2(x,-y); item.sizeDelta = new Vector2(width,height);
        }
        private GameObject OptionBox(string name,float x,float y,float w,float h,string high,string low,string edge,float radius=12,float border=1)
        {
            var box = Panel(name,optionContent,Vector2.zero,Vector2.one,Color.white);
            PlaceOption((RectTransform)box.transform,x,y,w,h);
            PhoneSkin.Plate(box,OptColor(high),OptColor(low),OptColor(edge),radius,border);
            return box;
        }
        private Text OptionText(string name,string value,float x,float y,float w,float h,int size,
            TextAnchor align=TextAnchor.MiddleLeft,bool bold=false,Color? color=null)
        {
            var t = Label(name,optionContent,value,Vector2.zero,Vector2.one,size,align);
            PlaceOption(t.rectTransform,x,y,w,h);
            t.fontSize=size; t.resizeTextForBestFit=false; t.color=color ?? optionsChrome.Paper;
            t.verticalOverflow=VerticalWrapMode.Truncate; if(bold)t.fontStyle=FontStyle.Bold;
            return t;
        }
        private Button OptionButton(string text,float x,float y,float w,float h,Action action,bool green=false)
        {
            var box = OptionBox(text,x,y,w,h,green?"91d75a":"9262bd",green?"43852d":"513069",green?"486831":"593968",12,1.5f);
            optionsChrome.Paint(box,green?CastlePopupChrome.Finish.Primary:CastlePopupChrome.Finish.Secondary);
            var button=box.AddComponent<Button>(); button.targetGraphic=box.GetComponent<Image>();
            var caption=Label("Label",box.transform,text,Vector2.zero,Vector2.one,13,TextAnchor.MiddleCenter);
            caption.rectTransform.offsetMin=new Vector2(4,0);caption.rectTransform.offsetMax=new Vector2(-4,0);
            caption.color=Color.white;caption.fontStyle=FontStyle.Bold;caption.resizeTextForBestFit=false;caption.fontSize=green?16:13;
            caption.raycastTarget=false;
            if(green)CastlePopupChrome.EmbossAction(caption);
            button.onClick.AddListener(()=>{ phoneAudio.Click(Session); action(); });
            return button;
        }
        private void OptionsPanel(string screen,string titleText,string eyebrow,string copy,float naturalHeight,float contentHeight)
        {
            if (optionsShade == null)
            {
                // A drawer can cover a normal lesson, a paused game or an existing result.
                // Keep that underlying screen and its attempt intact across all nested views.
                if (CurrentScreen=="playing")
                {
                    CancelPresentation();
                    if (Session.Status != "playing") EvaluateOutcome();
                    else { Board.Render(Session.Snapshot); RefreshTutorial(true); RefreshCounters(); }
                }
                optionsReturn=CurrentScreen;
            }
            else { optionsShade.SetActive(false); Destroy(optionsShade); }
            CurrentScreen=screen;
            Board.InputEnabled=false; refillTimer=null;
            optionsShade=Panel("PhoneOptionsOverlay",safe,Vector2.zero,Vector2.one,new Color32(16,10,41,186));
            PhoneBackdrop.Show(optionsShade);
            optionsChrome=CastlePopupChrome.Create(optionsShade.transform,"PhoneDialog","DialogTitle",titleText,CloseMobileOptions);
            var paper=optionsChrome.gameObject;
            paper.AddComponent<PhoneDialogFrame>().Fit(safe,naturalHeight+58);
            var viewport=Rect("Viewport",paper.transform,Vector2.zero,Vector2.one);
            viewport.offsetMin=new Vector2(4,12); viewport.offsetMax=new Vector2(-4,-62);
            optionsChrome.PlaceContent(viewport);
            viewport.gameObject.AddComponent<RectMask2D>();
            var bg=viewport.gameObject.AddComponent<Image>();bg.color=Color.clear;
            optionContent=Rect("Content",viewport,Vector2.up,Vector2.one);
            optionContent.pivot=Vector2.up; optionContent.sizeDelta=new Vector2(0,contentHeight-10);
            optionsScroll=viewport.gameObject.AddComponent<ScrollRect>();
            optionsScroll.viewport=viewport;optionsScroll.content=optionContent;
            optionsScroll.horizontal=false;optionsScroll.vertical=true;optionsScroll.movementType=ScrollRect.MovementType.Clamped;
            var illustration=Rect("IllustrationWell",optionContent,Vector2.zero,Vector2.one);
            bool livesPage=screen=="lives";
            PlaceOption(illustration,15,2,322,livesPage?98:76);
            var art=livesPage||screen=="reset"||screen=="test-reset"?CastlePopupChrome.Art.Heart:
                screen=="provider"?CastlePopupChrome.Art.Coin:screen=="rules"?CastlePopupChrome.Art.Map:CastlePopupChrome.Art.Gear;
            optionsChrome.Illustrate(illustration,art);
            if(!string.IsNullOrEmpty(eyebrow)) OptionText("Eyebrow",eyebrow,18,livesPage?101:82,316,21,10,TextAnchor.MiddleCenter,true,optionsChrome.Gold);
            if (!string.IsNullOrEmpty(copy))
                OptionText("DialogDescription",copy,19,livesPage?106:107,314,livesPage?55:52,13,TextAnchor.MiddleCenter);
            phoneAudio.Configure(Session,false,true);
        }
        private void OptionSwitch(string key,string titleText,string subtitle,float y,bool value,Action<bool> change,
            bool supported=true,bool inset=false)
        {
            float x=inset?32:18, width=inset?288:316, height=inset?77:68;
            var row=Panel(key,optionContent,Vector2.zero,Vector2.one,Color.clear);
            PlaceOption((RectTransform)row.transform,x,y,width,height);
            var b=row.AddComponent<Button>(); b.interactable=supported;
            OptionText("SettingTitle",titleText,x,y+5,width-64,27,13);
            OptionText("SettingDescription",subtitle,x,y+31,width-66,height-31,11,TextAnchor.UpperLeft,false,optionsChrome.Paper);
            var pill=OptionBox(key+"Track",x+width-43,y+(height-26)/2,43,26,value?"bddf94":"e2e8da",value?"aace80":"dfe6d7",value?"adcb86":"d8dfd0",13);
            var knob=OptionBox(key+"Thumb",x+width-(value?22:39),y+(height-18)/2,18,18,"fbfff8","f7fcf2","f7fcf2",9);
            knob.GetComponent<Image>().raycastTarget=pill.GetComponent<Image>().raycastTarget=false;
            b.onClick.AddListener(()=>{
                float pos=optionsScroll.verticalNormalizedPosition;
                change(!value); OpenMobileSettings(); Canvas.ForceUpdateCanvases(); optionsScroll.verticalNormalizedPosition=pos;
            });
        }
        public void OnSoundToggle()
        {
            if (!ready || !Session.SetPreferences(sound:!Session.SoundEnabled)) return;
            phoneAudio.Configure(Session,true,true); phoneAudio.Click(Session);
            if(CurrentScreen=="menu") ShowMenu();
        }
        public void OpenMobileSettings()
        {
            if (!ready || !HasInterface || IsEnteringStage) return;
            bool inGame = (optionsShade == null ? CurrentScreen : optionsReturn) == "playing";
            float shortfall=1120-SettingsAfterDevelopment;
            OptionsPanel("settings","Ayarlar","","",1800-shortfall,(inGame?1533:1495)-shortfall);
            var controls=Rect("SettingsControls",optionContent,Vector2.zero,Vector2.one);
            controls.anchoredPosition=Vector2.up*(inGame?32:70);
            optionContent=controls;
            if (optionsReturn == "playing")
                OptionButton("Bölümden çık",18,121,316,44,CloseOptionsToHome);
            OptionBox("Ses",18,169,316,220,"724d9e","53367f","a884be",15,.8f);
            OptionSwitch("Efektler","Ses efektleri","Eşleşmelerin ve hamlelerin sesi",175,Session.SoundEnabled,on=>Session.SetPreferences(sound:on));
            OptionSwitch("Müzik","Müzik","Arka planda sakin bir melodi",243,Session.MusicEnabled,on=>Session.SetPreferences(music:on));
            OptionText("VolumeTitle","Ses düzeyi",18,311,150,30,12);
            var percent=OptionText("VolumeValue","%"+Mathf.RoundToInt(Session.Volume*100),242,311,92,30,11,TextAnchor.MiddleRight);
            var sliderBox=Rect("Ses düzeyi",optionContent,Vector2.zero,Vector2.one); PlaceOption(sliderBox,18,340,316,34);
            var touch=sliderBox.gameObject.AddComponent<Image>();touch.color=Color.clear;
            var rail=Panel("Track",sliderBox,new Vector2(0,.38f),new Vector2(1,.62f),Color.white);
            PhoneSkin.Plate(rail,OptColor("ede9da"),OptColor("e7e4d4"),OptColor("b8ac9e"),4,1);
            var fill=Panel("VolumeFill",rail.transform,Vector2.zero,Vector2.one,OptColor("764294"));
            var track=Rect("ThumbRange",sliderBox,Vector2.zero,Vector2.one);
            track.offsetMin=new Vector2(7,0);track.offsetMax=new Vector2(-7,0);
            var handleArea=Rect("VolumeHandle",track,Vector2.zero,Vector2.up);
            var thumb=Panel("Thumb",handleArea,Vector2.one*.5f,Vector2.one*.5f,Color.white);
            ((RectTransform)thumb.transform).sizeDelta=new Vector2(15,15);
            PhoneSkin.Plate(thumb,OptColor("794596"),OptColor("794596"),OptColor("794596"),9,0);
            var slider=sliderBox.gameObject.AddComponent<Slider>(); slider.minValue=0;slider.maxValue=20;slider.wholeNumbers=true;
            slider.fillRect=(RectTransform)fill.transform;slider.handleRect=handleArea;
            slider.value=Mathf.Round(Session.Volume*20);
            slider.onValueChanged.AddListener(v=>{if(Session.SetPreferences(volume:v/20f))percent.text="%"+Mathf.RoundToInt(v*5);});
            OptionBox("Hareket",18,405,316,143,"724d9e","53367f","a884be",15,.8f);
            OptionText("MotionTitle","Animasyonlar",18,415,174,27,13);
            OptionText("MotionDescription","Hareket miktarını seç",18,444,176,29,11);
            string[] modes={"auto","reduce","full"}, captions={"Cihaza göre","Azaltılmış","Standart"};
            int selected=Array.IndexOf(modes,Session.MotionPreference);
            OptionButton(captions[Mathf.Max(0,selected)]+"  ▾",208,426,126,40,()=>{
                OptionsPanel("motion","Animasyonlar","","Hareket miktarını seç",415,415);
                for(int i=0;i<modes.Length;i++){int choice=i;OptionButton(captions[i],18,178+i*56,316,44,()=>{Session.SetPreferences(motion:modes[choice]);OpenMobileSettings();});}
            });
            bool vibration=SystemInfo.supportsVibration;
            OptionSwitch("Titreşim","Titreşim",vibration?"Eşleşmelerde kısa dokunma geri bildirimi.":"Bu cihaz titreşimi desteklemiyor.",480,Session.HapticsEnabled,on=>Session.SetPreferences(haptics:on),vibration);
            float next=565;
#if UNITY_EDITOR || HEXROTA_DEV_TOOLS
            next=DrawDeveloperSettings(next);
#endif
            DrawPlaytestSettings(next);
            OptionText("Storage","Tercihlerin ve ilerlemen bu cihazda saklanır.",18,next+235,316,44,12,TextAnchor.MiddleCenter);
            OptionButton("Tamam",18,next+290,316,50,CloseMobileOptions,true);
            OptionButton("İlerlemeyi sıfırla",18,next+352,316,46,ConfirmOpenReset);
        }

#if UNITY_EDITOR || HEXROTA_DEV_TOOLS
        // Editor and HEXROTA_DEV_TOOLS players only: release and playtest players never compile these controls
        // (DevelopmentToolsReleaseTests compiles a release player and checks for them).
        private const float DevelopmentSettingsHeight=555;
        private const float SettingsAfterDevelopment=565+DevelopmentSettingsHeight;
        private float DrawDeveloperSettings(float y)
        {
            OptionBox("Developer",18,y,316,540,"724d9e","53367f","a884be",15,1);
            OptionText("DevBadge","GELİŞTİRME TESTİ",32,y+17,270,22,10,TextAnchor.MiddleLeft,true);
            OptionSwitch("Can sınırı","Can sınırını kapat","Bölüm testinde can harcanmaz; bekleme gerekmez.",y+35,(bool)Session.LifeStatus["developerBypass"],on=>Session.SetLifeBypass(on),inset:true);
            OptionSwitch("Test reklamı","Test reklamı kullanılabilir","Kapatarak reklam bulunamamasını deneyebilirsin.",y+112,Session.LifeTestAds,on=>Session.SetLifeTestAds(on),inset:true);
            OptionSwitch("İkinci şans","TEST ikinci şans reklamı kullanılabilir","+5 hamle reklamının bulunamamasını ayrı olarak dene.",y+189,Session.RescueTestAds,on=>Session.SetRescueTestAds(on),inset:true);
            OptionText("TestNote","Geliştirme içindir. Gerçek reklam veya para işlemi yoktur.",32,y+267,288,34,11);
            OptionButton("300 Test Altını ekle",32,y+308,288,40,()=>OfferLifeProduct(Hexrota.UnityClient.UnityGameSession.DevelopmentLifeProduct));
            OptionText("ResetTitle","İlk açılışı tekrar dene",32,y+378,288,31,14,TextAnchor.MiddleLeft,true);
            OptionText("ResetHelp","Öğreticiyi, hediyeyi ve bütün ilerlemeyi sıfırdan denemek için yeni oyuncu olarak başla.",32,y+413,288,45,12);
            var reset=OptionButton("Test için her şeyi sıfırla",32,y+476,288,48,ConfirmFullReset);
            optionsChrome.Paint(reset.gameObject,CastlePopupChrome.Finish.Danger);
            return y+DevelopmentSettingsHeight;
        }
        private void ConfirmFullReset()
        {
            OptionsPanel("test-reset","Her şey sıfırlansın mı?","GELİŞTİRME TESTİ",
                "Bu cihazdaki bölümler, öğreticiler, Altın, Altın Yumurtalar, kümes, çanta, canlar ve TEST işlemleri silinir. Bu işlem geri alınamaz.",365,365);
            OptionButton("Evet, her şeyi sıfırla",18,205,316,46,()=>{
                if(Session.ResetForDevelopmentTest())CloseOptionsToHome();
                else OptionText("Failure","Sıfırlama kaydedilemedi. Tekrar deneyebilirsin.",18,312,316,28,12);
            });
            OptionButton("Vazgeç",18,261,316,46,OpenMobileSettings);
        }

#else
        private const float SettingsAfterDevelopment=565;
#endif

        private void ConfirmOpenReset()
        {
            int charge=Session.ResetCharge;
            string copy="Açık denemelerin silinecek. Tamamlanan bölümler, Altın, Altın Yumurtalar ve envanter korunur.";
            if(charge>0)copy+=" Oynanmış açık denemeleri silmek "+charge+" can harcar.";
            OptionsPanel("reset","Baştan başlayalım mı?","",copy,365,365);
            OptionButton("Evet, ilerlemeyi sıfırla",18,205,316,46,()=>{
                if(Session.ResetOpenAttempts(charge)){CloseOptionsToHome();return;}
                if(Session.LastError=="confirmation_changed")ConfirmOpenReset();
                else OptionText("Failure","İlerleme sıfırlanamadı.",18,312,316,28,12);
            });
            OptionButton("Vazgeç",18,261,316,46,OpenMobileSettings);
        }

        private void CloseOptionsToHome()
        {
            Session.ReturnToMenu();
            optionsReturn="menu";
            CloseMobileOptions();
        }

        public void OpenMobileLives()
        {
            if(!ready || !HasInterface)return;
            var view=Session.LifeStatus;
            OptionsPanel("lives","Canlar","","Yeni ana bölümler için canın olmalı. Kaybetmek veya oynanmış bir denemeyi sıfırlamak 1 can harcar.",681,681);
            OptionBox("LifeStats",18,182,316,67,"7951a6","553681","c59fc8",16,1);
            OptionText("LivesLabel","Canların",18,188,155,20,11,TextAnchor.MiddleCenter);
            OptionText("Lives",view["lives"]+" / "+view["maxLives"],18,211,155,28,19,TextAnchor.MiddleCenter,true);
            OptionText("TimeLabel","Sonraki can",173,188,161,20,11,TextAnchor.MiddleCenter);
            refillTimer=OptionText("LifeTime","",173,211,161,28,17,TextAnchor.MiddleCenter,true); UpdateLifeTimer();
            OptionButton("Bekle",18,260,154,44,CloseMobileOptions,true);
            OptionButton("Nasıl oynanır?",181,260,153,44,()=>{
                OptionsPanel("rules","Nasıl oynanır?","","",420,420);
                OptionText("Rules",PlayingInstructions,22,151,308,183,14);
                OptionButton("Geri",18,344,316,46,OpenMobileLives);
            });
            OptionText("Free","Kaldığın yerden devam etmek can harcamaz.",18,308,316,25,11,TextAnchor.MiddleCenter);
            OptionBox("LifeShop",18,344,316,306,"7850a9","53347d","ac8ac4",14,1);
            OptionText("TestGold","GELİŞTİRME TESTİ                         Test Altını: "+Session.TestGold,31,351,289,28,11,TextAnchor.MiddleCenter,true);
            OptionText("Note","Gerçek reklam gösterilmez, para alınmaz.",31,379,289,26,11);
            string[] products={"ad_life","single_life","refill_lives","unlimited_lives_30m"};
            string[] labels={"▷  Test reklamı: +1 can","1 can","Canları "+view["maxLives"]+"'e tamamla","30 dk sınırsız can"};
            for(int i=0;i<products.Length;i++)
            {
                string product=products[i];var offer=Session.LifeProduct(product);
                float y=i==0?413:493+(i-1)*51;
                var button=OptionButton(labels[i],31,y,290,44,()=>OfferLifeProduct(product),i==0);
                if(i>0)
                {
                    optionsChrome.Paint(button.gameObject,CastlePopupChrome.Finish.Secondary);
                    var label=button.GetComponentInChildren<Text>();
                    PlaceOption(label.rectTransform,10,0,178,44);label.alignment=TextAnchor.MiddleLeft;
                    label.fontStyle=FontStyle.Normal;label.color=optionsChrome.Paper;
                    OptionText("Price",offer["costGold"]+" Altın",220,y,91,44,12,TextAnchor.MiddleRight,false,optionsChrome.Paper);
                }
                button.interactable=W.Equal(offer["allowed"],true);
                if(i==0 && !button.interactable)
                    OptionText("AdStatus",W.Equal(view["lives"],view["maxLives"])?"Canların zaten dolu.":"Şu anda kullanılamıyor.",31,458,290,25,11);
            }
        }
        private void UpdateLifeTimer()
        {
            if(refillTimer==null)return;
            lifeRefresh=Time.unscaledTime+1;
            var life=Session.LifeStatus;
            double remaining=W.Number(life["remainingMs"]);
            refillTimer.text=remaining<=0?"Canlar dolu":TimeSpan.FromMilliseconds(remaining).ToString(@"mm\:ss");
        }
        private void OfferLifeProduct(string product)
        {
            string back=CurrentScreen; providerRequest=Session.BeginLifeProduct(product);
            if(providerRequest==null) return;
            OptionsPanel("provider","Test işlemi","GELİŞTİRME TESTİ","Bu test işlemini tamamlamak ister misin? Gerçek para harcanmaz.",340,340);
            Action<bool> complete=confirmed=>{
                var id=providerRequest;providerRequest=null;
                if(id!=null)Session.FinishLifeProduct(id,confirmed);
                if(back=="settings")OpenMobileSettings();else OpenMobileLives();
            };
            OptionButton("Tamamla",18,185,316,46,()=>complete(true),true);
            OptionButton("Vazgeç",18,242,316,46,()=>complete(false));
        }
        private void CloseMobileOptions()
        {
            if(optionsShade==null)return;
            if(providerRequest!=null){Session.FinishLifeProduct(providerRequest,false);providerRequest=null;}
            optionsShade.SetActive(false);Destroy(optionsShade);optionsShade=null;refillTimer=null;
            CurrentScreen=optionsReturn;
            if(CurrentScreen=="playing"){Board.InputEnabled=true;Board.Render(Session.Snapshot);RefreshTutorial(true);RefreshCounters();EvaluateOutcome();}
            else if(CurrentScreen=="menu")ShowMenu();
            phoneAudio.Configure(Session,CurrentScreen!="paused",true);
        }
    }
}
