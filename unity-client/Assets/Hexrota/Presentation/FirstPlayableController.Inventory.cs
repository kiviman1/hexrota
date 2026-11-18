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
            ShowModal("ÇANTA", Session.WalletSummary);
            var brush = Session.InventoryOffer("greenBrush");
            var key = Session.InventoryOffer("colorKey");
            AddAction(ItemName("greenBrush") + "   ×" + brush.Stock, 0, () => ItemDetails("greenBrush"));
            AddAction(ItemName("colorKey") + "   ×" + key.Stock, 1, () => ItemDetails("colorKey"));
            AddAction("Oyuna dön", 2, CloseInventory);
        }

        private bool InventoryOpen { get { return ready && HasInterface && CurrentScreen == "inventory" && Session.InventoryAvailable; } }

        private void ItemDetails(string id, string feedback = null)
        {
            if (!InventoryOpen) return;
            var offer = Session.InventoryOffer(id);
            string detail = offer.Unlocked ? "Çantanda " + offer.Stock + " adet var."
                : offer.UnlockAfter + ". bölüm tamamlanınca açılır.";
            ShowModal(ItemName(id), (feedback == null ? "" : feedback + "\n") + detail + "\n" + Session.WalletSummary);
            AddAction("Kullan", 0, () => SelectItemTarget(id)).interactable = offer.CanUse;
            AddAction(offer.Price + " altına al", 1, () => ConfirmItemPurchase(id)).interactable = offer.CanBuy;
            AddAction("Geri", 2, OpenInventory);
        }

        private void ConfirmItemPurchase(string id)
        {
            if (!InventoryOpen) return;
            long revision = Session.Revision;
            var offer = Session.InventoryOffer(id);
            ShowModal("SATIN AL", "1 " + ItemName(id) + " için " + offer.Price + " altın harcanacak.");
            AddAction("Satın al", 0, () => {
                if (!InventoryOpen) return;
                bool bought = Session.BuyInventoryItem(id, revision);
                RefreshCounters();
                ItemDetails(id, bought ? "Çantana eklendi." : "Satın alma gerçekleşmedi.");
            });
            AddAction("Vazgeç", 1, () => ItemDetails(id));
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
            if (preview == null) { ItemDetails(id, "Bu hücrede kullanılamıyor."); return; }
            string details = "+" + preview.ScoreGain + " puan · " + preview.LayersRemoved + " zemin katı\n" +
                "0 hamle · Çantandan 1 adet düşer.";
            if (preview.WillReshuffle) details += "\nTaşlar karıştırılacak.";
            if (preview.WillWin) details += "\nBu işlemle bölüm tamamlanır.";
            ShowModal(ItemName(id), details);
            AddAction("1 " + ItemName(id) + " kullan", 0, () => {
                if (!InventoryOpen) return;
                var receipt = Session.ConfirmInventoryItem(preview);
                if (receipt == null) { ItemDetails(id, "Tahta değişti. Sonucu yeniden kontrol et."); return; }
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
