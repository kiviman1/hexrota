using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class FirstPlayableController
    {
        private static string ItemName(string id) { return id == "greenBrush" ? "Yeşil Fırça" : "Renk Anahtarı"; }

        public void OpenInventory()
        {
            if (!ready || !HasInterface || (CurrentScreen != "playing" && CurrentScreen != "inventory") ||
                !Session.InventoryAvailable || Board.IsAnimating) return;
            Board.Cancel(Session.Snapshot);
            Board.InputEnabled = false;
            CurrentScreen = "inventory";
            DrawInventory();
        }

        private bool InventoryOpen { get { return ready && HasInterface && CurrentScreen == "inventory" && Session.InventoryAvailable; } }

        private void DrawInventory(string feedback = null)
        {
            if (!InventoryOpen) return;
            ShowPhoneSheet("Çantan.", "Her güçlendiriciyi bir denemede en fazla bir kez kullanabilirsin.", "KÜÇÜK YARDIMLAR", 892, CloseInventory);
            SheetPlate("BalanceBand",22,194,316,19,0xefdaab,0xefdaab,0xefdaab,0);
            SheetText("InventoryBalance","Altının: <b>"+Session.ReadPhoneWallet().Gold+"</b>",22,191,316,26,14,PurpleText);
            DrawInventoryItem("greenBrush",229);
            DrawInventoryItem("colorKey",507);
            SheetText("InventoryNote",feedback??"Prototip fiyatları. Yalnız oyunda kazandığın Altın kullanılır. Gerçek para işlemi yok.",
                22,785,316,35,12,PurpleText);
            SheetButton("Çantayı kapat",22,828,72,40,CloseInventory,SheetStyle.Plain).GetComponentInChildren<UnityEngine.UI.Text>().text="Kapat";
        }

        private void DrawInventoryItem(string id,int y)
        {
            bool brush=id=="greenBrush";
            var offer=Session.InventoryOffer(id);
            SheetPlate(id,22,y,316,265,0xfff6df,0xfbf0d5,0xd6b484,16);
            SheetText(id+"Title",ItemName(id),36,y+25,249,38,15,Tone(0x633c79),TextAnchor.MiddleLeft,true);
            SheetPlate(id+"StockPill",295,y+30,29,27,0x6b4287,0x6b4287,0xb8a0cc,14);
            SheetText(id+"Stock",offer.Stock.ToString(),295,y+30,29,27,15,MenuCream,TextAnchor.MiddleCenter,true);
            string description=brush?"Seçtiğin zeminden bir kat azaltır. Hamle harcamaz, puan eklemez.":
                "Bir taşın sayısını seçtiğin başka bir sayıya değiştirir. Eşleşmeler puan kazandırır.";
            SheetText(id+"Description",description,36,y+68,288,44,12,PurpleText);
            string note=!offer.Unlocked?offer.UnlockAfter+". bölümden sonra açılır.":offer.Used>=offer.Limit?
                "Bu denemede kullandın. Yeni denemede yeniden kullanabilirsin.":"Bu denemede en fazla "+offer.Limit+" kez kullanabilirsin.";
            SheetText(id+"Eligibility",note,36,y+118,288,27,12,Tone(0x876b74));
            EnableSheetButton(SheetButton(brush?"Hücre seç":"Taş seç",36,y+152,288,47,()=>SelectItemTarget(id)),offer.CanUse,SheetStyle.Primary);
            EnableSheetButton(SheetButton(offer.Price+" Altınla +1 al",36,y+207,288,44,()=>ConfirmItemPurchase(id),SheetStyle.Secondary),offer.CanBuy,SheetStyle.Secondary);
        }

        private void ConfirmItemPurchase(string id)
        {
            if (!InventoryOpen) return;
            long revision = Session.Revision;
            var offer = Session.InventoryOffer(id);
            ShowPhoneSheet("Satın almak ister misin?", "1 " + ItemName(id) + " için " + offer.Price + " Altın harcanacak.","ÇANTA",345,()=>DrawInventory());
            SheetButton("Satın al",22,205,316,48,() => {
                if (!InventoryOpen) return;
                bool bought = Session.BuyInventoryItem(id, revision);
                RefreshCounters();
                DrawInventory(bought ? "Çantana eklendi." : "Satın alma gerçekleşmedi.");
            });
            SheetButton("Vazgeç",22,268,316,44,()=>DrawInventory(),SheetStyle.Secondary);
        }

        private void SelectItemTarget(string id)
        {
            if (!InventoryOpen || !Session.InventoryOffer(id).CanUse) return;
            CloseInventory();
            message.text = id == "greenBrush" ? "Yeşertmek istediğin zemine dokun." : "Sayısını değiştirmek istediğin taşa dokun.";
            Board.SelectCellForItem(index => {
                if (CurrentScreen != "playing" || !HasInterface || !Session.InventoryAvailable) return;
                CurrentScreen = "inventory"; Board.InputEnabled = false;
                if (id == "greenBrush") { PreviewItem(id, index, null); return; }
                ShowModal(ItemName(id), "Taşın yeni sayısını seç.");
                var values = Session.Level.palette;
                int count = 0;
                foreach (int value in values)
                {
                    if (value == Session.Snapshot.values[index]) continue;
                    int slot = count++; int picked = value;
                    float x = (slot % 3) / 3f, y = 1f - .28f * (slot / 3);
                    MakeButton(value.ToString(), actions, new Vector2(x, y - .24f), new Vector2(x + .31f, y),
                        () => PreviewItem(id, index, picked));
                }
                AddAction("Vazgeç", 3, OpenInventory);
            });
        }

        private void PreviewItem(string id, int index, int? value)
        {
            if (!InventoryOpen) return;
            var preview = Session.PreviewInventoryItem(id, index, value);
            if (preview == null) { DrawInventory("Bu hücrede kullanılamıyor."); return; }
            string details = "+" + preview.ScoreGain + " puan · " + preview.LayersRemoved + " zemin katı\n" +
                "0 hamle · Çantandan 1 adet düşer.";
            if (preview.WillReshuffle) details += "\nTaşlar karıştırılacak.";
            if (preview.WillWin) details += "\nBu işlemle bölüm tamamlanır.";
            ShowModal(ItemName(id), details);
            AddAction("1 " + ItemName(id) + " kullan", 0, () => {
                if (!InventoryOpen) return;
                var receipt = Session.ConfirmInventoryItem(preview);
                if (receipt == null) { DrawInventory("Tahta değişti. Sonucu yeniden kontrol et."); return; }
                CurrentScreen = "playing"; modal.SetActive(false); message.text = "";
                if (receipt.Swap.frames.Length > 0) Board.Present(receipt);
                else { Board.Render(receipt.After); FinishPresentation(); }
            });
            AddAction("Vazgeç", 1, CloseInventory);
        }

        private void CloseInventory()
        {
            if (!ready || !HasInterface || CurrentScreen != "inventory") return;
            CurrentScreen = "playing"; modal.SetActive(false);
            Board.InputEnabled = Session.Status == "playing";
            RefreshTutorial(true);
        }
    }
}
