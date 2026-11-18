using Hexrota.Catalog;
using Hexrota.Commands;
using Hexrota.Gameplay;
using Newtonsoft.Json;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    public sealed partial class UnityGameSession
    {
        public sealed class ItemOffer
        {
            public bool Unlocked, CanUse, CanBuy;
            public int Stock, Price, UnlockAfter;
        }

        public sealed class ItemPreview
        {
            internal object Quote;
            internal string Item, Operation;
            internal int Index;
            internal int? Value;
            internal SwapResult Effect;
            public int ScoreGain { get { return Effect.scoreGain; } }
            public bool WillReshuffle { get { return Effect.reshuffled; } }
            public int LayersRemoved { get; internal set; }
            public bool WillWin { get; internal set; }
        }

        // Assisted saves include the command journal. A visual snapshot only
        // needs model fields, but simulating the next swap must replay the journal.
        private static GameSnapshot ReadBoardForDisplay(object wire)
        {
            var board = LevelCatalog.ReadSnapshot(wire);
            if (board.rulesVersion == AssistedGame.RulesVersion)
            {
                board.rulesVersion = (string)W.Required(wire, "baseRulesVersion");
                board.version = 4;
            }
            return board;
        }

        private HexMatch ProjectBoard()
        {
            var view = controller.View();
            var wire = W.Required(view, "snapshot");
            if (!W.Equal(W.Get(wire, "rulesVersion"), AssistedGame.RulesVersion))
                return new HexMatch(Level, LevelCatalog.ReadSnapshot(wire));
            return new AssistedGame(Level, (string)W.Required(W.Required(view, "metadata"), "attemptId"),
                W.Required(wire, "limits"), wire).Model;
        }

        public bool InventoryAvailable
        {
            get { return HasAttempt && !IsTutorial && !IsPresenting && Status == "playing" && Level.rulesVersion == "classic-v4"; }
        }

        public ItemOffer InventoryOffer(string item)
        {
            var config = W.Required(W.Required(data.EconomyConfig, "inventory"), item);
            var wallet = controller.EconomyView;
            var stock = W.Int32(W.Required(wallet["inventory"], item));
            var price = W.Int32(W.Required(config, "costGold"));
            var used = W.Int32(W.Get(W.Get(controller.View()["snapshot"], "usage"), item, 0));
            var unlocked = W.Equal(W.Get(wallet["unlocks"], item), true);
            return new ItemOffer {
                Unlocked = unlocked, Stock = stock, Price = price,
                UnlockAfter = W.Int32(W.Required(config, "unlockAfterLevelId")),
                CanUse = InventoryAvailable && unlocked && stock > 0 && used < W.Int32(W.Required(config, "maxPerAttempt")),
                CanBuy = InventoryAvailable && unlocked && W.Int32(wallet["gold"]) >= price
            };
        }

        public bool BuyInventoryItem(string item, long quotedRevision)
        {
            if (!InventoryAvailable || quotedRevision != Revision) { LastError = "stale_preview"; return false; }
            var transactions = W.Map(W.Required(controller.GameSave["economy"], "transactions"));
            string operation = "purchase:" + item + ":" + (transactions.Count + 1);
            return Apply(() => controller.PurchaseInventory(item, operation, Command()));
        }

        public ItemPreview PreviewInventoryItem(string item, int cell, int? value)
        {
            if (!InventoryAvailable) { LastError = "inventory_unavailable"; return null; }
            var view = controller.View();
            var snapshot = W.Required(view, "snapshot");
            var commands = W.List(W.Get(snapshot, "commands") ?? W.Required(snapshot, "history"));
            string attempt = (string)W.Required(view["metadata"], "attemptId");
            string operation = "assist:" + attempt + ":" + (commands.Count + 1) + ":" + item;
            ItemPreview preview = null;
            Apply(() => {
                var result = controller.PreviewBooster(item, cell, value, operation, Command());
                if (W.Equal(result["ok"], true))
                {
                    var projected = W.Required(result, "preview");
                    var effect = W.Required(projected, "result");
                    preview = new ItemPreview {
                        Item = item, Index = cell, Value = value, Operation = operation, Quote = result["quote"],
                        Effect = JsonConvert.DeserializeObject<SwapResult>(WireJsonCodec.Serialize(effect)),
                        WillWin = W.Equal(W.Required(projected, "status"), "won"),
                        LayersRemoved = W.Int32(W.Required(effect, "layersRemoved"))
                    };
                }
                return result;
            });
            return preview;
        }

        public MovePresentation ConfirmInventoryItem(ItemPreview preview)
        {
            if (!InventoryAvailable || preview == null) return null;
            var before = Snapshot;
            if (!Apply(() => controller.UseBooster(preview.Item, preview.Index, preview.Value,
                preview.Operation, Command(), preview.Quote))) return null;
            var receipt = new MovePresentation { Ok = true, A = -1, B = -1, Before = before, After = Snapshot, Swap = preview.Effect };
            IsPresenting = true;
            return receipt;
        }
    }
}
