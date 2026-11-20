using System;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Catalog;
using Hexrota.Commands;
using Hexrota.Economy;
using Hexrota.Gameplay;
using Hexrota.Hints;
using Hexrota.Lives;
using Hexrota.Rewards;
using Hexrota.RewardAdapterCore;
using Hexrota.Rescue;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.Application
{
    // Feature-owned methods; Execute remains the single transaction boundary.
    public sealed partial class GameSessionController
    {
        private Dictionary<string, object> AssistanceGuard(SessionCommand command)
        {
            var denied = Guard(command); if (denied != null) return denied;
            if (engine == null) return Result(false, "no_attempt");
            if (active < tutorialCount) return Result(false, "tutorial");
            if (!AssistedGame.Supports(engine.level)) return Result(false, "inventory_unavailable");
            if (Completed(active)) return Result(false, "level_completed");
            if (!CanOpen(active)) return Result(false, "locked");
            if (Discarded(CurrentEntry())) return Result(false, "attempt_discarded");
            return engine.Status == "playing" ? null : Result(false, engine.Status);
        }
        private AssistedGame AssistanceCandidate()
        {
            return assistance == null ? new AssistedGame(engine.level, (string)metadata["attemptId"], attempts.AssistanceLimits, LevelCatalog.SnapshotWire(engine.Snapshot())) : assistance.Clone();
        }
        private static Dictionary<string, object> BoosterCommand(string itemId, int index, int? value, string operationId)
        {
            if (itemId == "greenBrush") return W.Obj("id", operationId, "type", "green_brush", "index", index);
            if (itemId == "colorKey") return W.Obj("id", operationId, "type", "color_key", "index", index, "value", value.HasValue ? (object)value.Value : null);
            return null;
        }
        public Dictionary<string, object> PreviewBooster(string itemId, int index, int? value, string operationId, SessionCommand command = null)
        {
            pendingBoosterQuote = null;
            var denied = AssistanceGuard(command); if (denied != null) return denied;
            var input = BoosterCommand(itemId, index, value, operationId); if (input == null) return Result(false, "invalid_economy_item");
            var candidate = AssistanceCandidate(); var preview = W.Map(candidate.Preview(input)); var mechanics = W.Map(preview["result"]);
            if (!W.Equal(mechanics["ok"], true)) return Result(false, mechanics["reason"] as string);
            var authorized = economy.Consume(game["economy"], W.Obj("operationId", operationId, "itemId", itemId, "attemptId", metadata["attemptId"], "levelId", activeLevel["id"]));
            if (!W.Equal(authorized["applied"], true)) return Result(false, authorized["reason"] as string);
            pendingBoosterQuote = W.Obj("schemaVersion", 1L, "profileRevision", Revision, "attemptId", metadata["attemptId"], "snapshot", EngineSnapshot(), "command", input);
            return W.Obj("ok", true, "reason", "preview", "itemId", itemId, "costInventory", 1L, "costGold", 0L, "movesSpent", 0L, "preview", preview, "quote", W.Copy(pendingBoosterQuote));
        }
        public Dictionary<string, object> UseBooster(string itemId, int index, int? value, string operationId, SessionCommand command = null, object quote = null)
        {
            var denied = AssistanceGuard(command); if (denied != null) return denied;
            var input = BoosterCommand(itemId, index, value, operationId); if (input == null) return Result(false, "invalid_economy_item");
            var candidate = AssistanceCandidate(); var mechanics = W.Map(candidate.Apply(input));
            if (!W.Equal(mechanics["ok"], true)) return Result(false, mechanics["reason"] as string);
            var authorized = economy.Consume(game["economy"], W.Obj("operationId", operationId, "itemId", itemId, "attemptId", metadata["attemptId"], "levelId", activeLevel["id"]));
            if (!W.Equal(authorized["applied"], true)) return Result(false, authorized["reason"] as string);
            if (pendingBoosterQuote == null || quote == null) return Result(false, "preview_required");
            if (!W.Equal(quote, pendingBoosterQuote) || !W.Equal(pendingBoosterQuote["profileRevision"], Revision) || !W.Equal(pendingBoosterQuote["attemptId"], metadata["attemptId"]) || !W.Equal(pendingBoosterQuote["snapshot"], EngineSnapshot()) || !W.Equal(pendingBoosterQuote["command"], input)) return Result(false, "stale_preview");
            return Execute(() =>
            {
                pendingBoosterQuote = null;
                assistance = candidate; engine = candidate.Model; game["economy"] = authorized["state"];
                var stats = CurrentEntry().stats; stats["cascades"] = Count(stats["cascades"]) + Math.Max(0, W.List(mechanics["frames"]).Count - 1);
                // The classic reward director is intentionally not fed a forged
                // swap turn for a zero-move action. Presentation uses real waves.
                rewardState = null; lastRewardPlan = null; MarkCompleted(true);
                if (engine.Status != "playing") Settle(CurrentEntry(), engine.Status == "won" ? "won" : "failed");
                Emit("booster_used", CurrentEntry(), W.Obj("boosterId", itemId)); Terminal(); return Result(true, "booster_used");
            }, command);
        }
        public Dictionary<string, object> PurchaseInventory(string itemId, string operationId, SessionCommand command = null)
        {
            var denied = Guard(command); if (denied != null) return denied;
            if (engine != null && !AssistedGame.Supports(engine.level)) return Result(false, "inventory_unavailable");
            var proposal = economy.Purchase(game["economy"], W.Obj("operationId", operationId, "itemId", itemId));
            if (!W.Equal(proposal["applied"], true)) return Result(false, proposal["reason"] as string);
            return Execute(() => { game["economy"] = proposal["state"]; return Result(true, "item_purchased"); }, command);
        }
    }
}
