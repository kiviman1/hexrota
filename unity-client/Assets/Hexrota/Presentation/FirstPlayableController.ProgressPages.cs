using System.Globalization;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        private RectTransform ProgressPage(string route,string eyebrow,string heading,string description,float height)
        {
            if (!ready || !HasInterface) return null;
            LeaveAttemptForMenu();
            CurrentScreen=route;
            Board.InputEnabled=false; boardCamera.enabled=false;
            gameplay.SetActive(false); modal.SetActive(false); menu.SetActive(true); RefreshScene();
            var frame=ResetHomePage();
            var background=Rect("AdventureBackdrop",frame,Vector2.zero,Vector2.one).gameObject.AddComponent<RawImage>();
            background.texture=Resources.Load<Texture2D>("PhoneMenu/journey-backdrop");
            background.raycastTarget=false;
            float fraction=Mathf.Min(1,frame.rect.width/Mathf.Max(1,frame.rect.height));
            background.uvRect=new UnityEngine.Rect((1-fraction)/2,0,fraction,1);
            var page=ScrollingPage(frame,height,true);
            DrawPhoneHeaderBody(page);
            MenuText(page,"Eyebrow",eyebrow,15,85,282,23,9,PlumEdge,TextAnchor.MiddleLeft,true);
            MenuText(page,"PageHeading",heading,15,109,309,37,25,MenuCream,TextAnchor.MiddleLeft,true);
            MenuText(page,"Subtitle",description,15,150,305,36,12,MenuCream,TextAnchor.UpperLeft);
            var home=MenuPlate(page,"Ana menüye dön",336,85,39,43,PlumTop,PlumBottom,PlumEdge,13,2);
            MenuClick(home,ShowMenu); MenuIcon(home,"home",9,11,22,MenuCream);
            DrawPhoneNav(frame,route); return page;
        }

        private RectTransform Parchment(Transform parent,string name,float x,float y,float w,float h)
        {
            return MenuPlate(parent,name,x,y,w,h,Tone(0xfff9e8),Tone(0xf9e7bd),Tone(0xc39054),18,2);
        }

        private void DrawRecordsPage()
        {
            var page=ProgressPage("records","HER ADIMIN BURADA","Küçük adımlar, <color=#FFD369>güzel izler.</color>",
                "Bu cihazda biriken kişisel oyun kayıtların.",1282);
            if(page==null)return;
            int count=Session.StageCount-Session.TutorialCount;
            var all=Enumerable.Range(Session.TutorialCount,count).Select(Session.ReadStageRecord).ToArray();
            var scores=all.Where(row=>row!=null).ToArray();
            var locale=CultureInfo.GetCultureInfo("tr-TR");
            string[] metrics={"TAMAMLANAN BÖLÜM","EN YÜKSEK BÖLÜM PUANI","EN İYİ KALAN HAMLE"};
            string[] values={Session.ClearedCount+" / "+count,scores.Length==0?"—":scores.Max(row=>row.Score).ToString("N0",locale),
                scores.Length==0?"—":scores.Max(row=>row.Moves).ToString()};
            for(int i=0;i<3;i++)
            {
                var card=Parchment(page,"RecordSummary"+i,14+123.3f*i,195,115,98);
                MenuText(card,"Metric",metrics[i],12,12,92,37,9,Tone(0x765168),TextAnchor.MiddleLeft);
                MenuText(card,"Value",values[i],12,49,92,36,22,Tone(0x794799),TextAnchor.MiddleLeft);
            }
            float tableHeight=95+39.5f*count;
            var table=Parchment(page,"Bölüm kayıtları",14,309,362,tableHeight);
            var recordInk=Tone(0x71805b);
            MenuText(table,"TableHeading","Bölüm kayıtları",18,12,328,37,15,recordInk,TextAnchor.MiddleLeft);
            MenuText(table,"StageColumn","Bölüm",18,59,143,28,10,recordInk,TextAnchor.MiddleLeft);
            MenuText(table,"ScoreColumn","En iyi puan",162,59,88,28,10,recordInk,TextAnchor.MiddleLeft);
            MenuText(table,"MoveColumn","En iyi kalan",254,59,88,28,10,recordInk,TextAnchor.MiddleLeft);
            for(int i=0;i<count;i++)
            {
                float y=90+39.5f*i; int stage=i+Session.TutorialCount; var entry=all[i];
                if (i>0) MenuPlate(table,"Divider",18,y,326,1,Tone(0xe4e5ce),Tone(0xe4e5ce),Color.clear,0,0);
                MenuText(table,"Chapter"+i,(i+1).ToString("00")+"  "+Session.StageName(stage)+(Session.IsStageComplete(stage)?"  ✓":""),
                    18,y+2,142,entry!=null&&entry.Assisted?19:38,11,recordInk,TextAnchor.MiddleLeft);
                if(entry!=null&&entry.Assisted)MenuText(table,"Assisted","Yardımla tamamlandı",16,y+25,164,16,10,Tone(0x82654f),TextAnchor.MiddleLeft);
                MenuText(table,"BestScore"+i,entry==null?"—":entry.Score.ToString("N0",locale),162,y+2,86,38,11,recordInk,TextAnchor.MiddleLeft);
                MenuText(table,"BestMoves"+i,entry==null?"—":entry.Moves.ToString(),254,y+2,88,38,11,recordInk,TextAnchor.MiddleLeft);
            }
            var achievements=Parchment(page,"Yolculuk izleri",14,326+tableHeight,362,347);
            MenuText(achievements,"Title","Yolculuk izleri",16,14,330,36,20,Ink,TextAnchor.MiddleLeft,true);
            string[] titles={"İlk eşleşme","İki hedef, bir plan","Yolun yarısı","Yeşil yolculuk"};
            string[] copy={"İlk eşleşmeni yap.","İlk bölümün puan ve yeşil alan hedeflerine ulaş.","Beş ana bölümü tamamla.","On ana bölümü tamamla."};
            int progress=Session.CompletedSceneTutorials;
            bool[] earned={progress>=1,progress>=2,Session.ClearedCount>=5,Session.ClearedCount==count};
            for(int i=0;i<titles.Length;i++)
            {
                float y=53+60*i;
                MenuText(achievements,"Mark"+i,earned[i]?"✓":"◇",15,y,29,46,20,Tone(0x789c4d));
                MenuText(achievements,"Name"+i,titles[i],54,y,182,23,13,Ink,TextAnchor.MiddleLeft,true);
                MenuText(achievements,"Detail"+i,copy[i],54,y+23,195,24,11,Ink,TextAnchor.MiddleLeft);
                MenuText(achievements,"Status"+i,earned[i]?"Tamamlandı":"Sırada",247,y+6,99,30,10,Ink,TextAnchor.MiddleRight,true);
            }
            MenuText(achievements,"Note","Her işaret, gerçekten tamamladığın bir adıma ait.",16,303,330,28,11,Ink,TextAnchor.MiddleLeft);
        }

        private void DrawGardenPage()
        {
            var page=ProgressPage("garden","KALICI YOLCULUĞUN","Senin <color=#FFD369>bahçen.</color>",
                "Kazandığın Altın Yumurtalarla açılan güzellikler burada kalır.",1100);
            if(page==null)return;
            var wallet=Session.ReadPhoneWallet();
            var currency=MenuPlate(page,"Wallet",14,206,362,57,PlumTop,PlumBottom,Tone(0xc59150),17);
            string[] walletLabels={"Altın","Altın Yumurta","Yeşil Fırça","Renk Anahtarı"};
            int[] totals={wallet.Gold,wallet.GoldenEggs,wallet.Brushes,wallet.Keys};
            for(int i=0;i<4;i++)
            {
                int x=90*i;
                if(i<2)MenuText(currency,"Symbol","●",x+27,10,21,23,14,MenuGold);
                else MenuIcon(currency,i==2?"leaf":"swap",x+27,15,17,MenuCream);
                MenuText(currency,"Amount"+i,totals[i].ToString(),x+48,8,35,27,16,MenuCream,TextAnchor.MiddleLeft,true);
                MenuText(currency,"Kind"+i,walletLabels[i],x,34,90,16,9,MenuCream,TextAnchor.MiddleCenter,true);
            }
            MenuArt(page,"GardenIllustration","GardenArt/"+Session.GardenTier,14,281,362,226);
            var panel=Parchment(page,"GardenProgress",14,523,362,548);
            var entries=Session.GardenMilestones();
            var next=entries.FirstOrDefault(e=>!e.Unlocked);
            MenuText(panel,"Eggs","<color=#BE9641>●</color>  <size=26>"+wallet.EarnedEggs+"</size>  <size=12>kazanılan Altın Yumurta</size>",21,13,320,43,20,Tone(0x395f43),TextAnchor.MiddleLeft);
            string title=next==null?"Bahçen tamamlandı":wallet.EarnedEggs==0?"Bahçen seni bekliyor":"Bahçen büyüyor";
            MenuText(panel,"ProgressTitle",title,21,60,320,32,20,Tone(0x3f6046),TextAnchor.MiddleLeft,true);
            string copy=next==null?"Bütün bahçe açıldı. Yeni bölümler yakında.":wallet.EarnedEggs==0?"İlk Altın Yumurtanla bahçe yolculuğun başlar.":
                "Kazandığın Altın Yumurtalarla açılan güzellikler burada kalır.";
            MenuText(panel,"ProgressDescription",copy,21,103,320,29,12,Tone(0x59704c),TextAnchor.UpperLeft);
            string[] names={"Çiçekler","Yeni bitkiler","Ağaçlar","Tamamlanmış bahçe"};
            string[] descriptions={"İlk çiçeklerin bahçeye renk katıyor.","Yapraklar ve filizler bahçeni dolduruyor.","Bahçenin ağaçları büyüdü.","Bütün bahçe açıldı. Kazandığın ilerleme burada kalır."};
            for(int i=0;i<entries.Length;i++)
            {
                var e=entries[i];float y=135+87*i;
                var row=MenuPlate(panel,e.Id,21,y,320,80,Tone(e.Unlocked?0xe3edcc:0xf6f7ee),Tone(e.Unlocked?0xe1eac7:0xf3f6e9),Tone(0xd1dcbf),13);
                MenuText(row,"Mark",e.Unlocked?"✓":"○",9,10,25,30,17,Tone(0x71914b));
                MenuText(row,"Name",names[i],39,6,281,22,14,Ink,TextAnchor.MiddleLeft,true);
                MenuText(row,"Status",e.Eggs+" Altın Yumurta · "+(e.Unlocked?"Açıldı":"Sırada"),39,28,281,18,11,Tone(0x8b694e),TextAnchor.MiddleLeft,true);
                MenuText(row,"Description",descriptions[i],39,48,281,27,11,Ink,TextAnchor.UpperLeft);
            }
            string footer=next==null?"Yeni bölümler yakında.":names[System.Array.IndexOf(entries,next)]+" için "+(next.Eggs-wallet.EarnedEggs)+" Altın Yumurta daha.";
            MenuText(panel,"NextMilestone",footer,17,492,326,38,13,Ink,TextAnchor.MiddleLeft,true);
        }
    }
}
