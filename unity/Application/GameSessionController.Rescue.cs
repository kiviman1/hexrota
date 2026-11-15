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
        private Dictionary<string, object> RescueContext()
        {
            return RescueContext(CurrentEntry());
        }
        private Dictionary<string, object> RescueContext(Entry entry)
        {
            if (entry == null || entry.metadata == null) return null;
            var commands = entry.assistance == null ? W.Arr() : W.List(entry.assistance.Commands);
            object last = entry.assistance == null ? entry.engine.history.Count > 0 ? (object)"swap" : "none" : commands.Count == 0 ? "none" : W.Get(commands[commands.Count - 1], "type");
            return W.Obj("attemptId", entry.metadata["attemptId"], "levelId", entry.level["id"], "tutorial", entry.index < tutorialCount, "cleared", Completed(entry.index), "status", entry.engine.Status, "movesLeft", (long)entry.engine.movesLeft, "turn", (long)entry.engine.turn, "lastCommand", last, "rescuesUsed", entry.assistance == null ? 0L : W.Integer(W.Get(entry.assistance.Usage, "rescue")));
        }
        private bool RecoverableLoss(Entry entry)
        {
            return entry != null && entry.index >= tutorialCount && entry.engine.Status == "lost" && !Discarded(entry) && entry.engine.LegalMoves().Count > 0 && W.Equal(rescue.Availability(game["rescue"], RescueContext(entry), W.Obj("gold", W.Get(game["economy"], "gold")))["eligible"], true);
        }
        private void CancelPendingRescue(string attemptId)
        {
            var pending = W.Map(W.Get(W.Get(game["rescue"], "provider"), "transactions")).Where(pair => W.Equal(W.Get(pair.Value, "attemptId"), attemptId) && W.Equal(W.Get(pair.Value, "status"), "pending")).Select(pair => pair.Key).ToList();
            foreach (string id in pending) game["rescue"] = rescue.CompleteAd(game["rescue"], id, W.Obj("outcome", "cancelled"))["state"];
        }
        public Dictionary<string, object> RescueOffer()
        {
            var context = RescueContext(); if (context == null) return Result(false, "no_attempt"); var offer = rescue.Availability(game["rescue"], context, W.Obj("gold", W.Get(game["economy"], "gold")));
            if (engine.Status == "lost" && engine.LegalMoves().Count == 0) { offer["eligible"] = false; offer["reason"] = "no_legal_swaps"; foreach (string method in new[] { "ad", "gold" }) { W.Map(offer[method])["allowed"] = false; W.Map(offer[method])["reason"] = "no_legal_swaps"; } } return offer;
        }
        public Dictionary<string, object> ResumeForSecondChance(int index, SessionCommand command = null)
        {
            NeedIndex(index); if (!CanOpen(index)) return Result(false, ClosedReason(index)); var entry = RestoreEntry(index, false);
            if (!RecoverableLoss(entry)) return Result(false, "rescue_unavailable");
            if (HasPendingRescueDelivery && !W.Equal(entry.metadata["attemptId"], W.Get(pendingRescueDelivery["receipt"], "attemptId"))) return Result(false, "pending_rescue_delivery");
            return Execute(() => { Refresh(); Settle(entry, "failed"); LoadExisting(index, true); return Result(true, "rescue_ready"); }, command);
        }
        public Dictionary<string, object> SetRescueAdAvailable(bool available, SessionCommand command = null)
        {
            return Execute(() => { game["rescue"] = rescue.SetAdAvailable(game["rescue"], available); return Result(true, "developer_setting"); }, command);
        }
        public Dictionary<string, object> BeginRescueAd(SessionCommand command = null)
        {
            if (HasPendingRescueDelivery) return Result(false, "pending_rescue_delivery");
            var denied = Guard(command); if (denied != null) return denied; var context = RescueContext(); if (context == null) return Result(false, "no_attempt");
            if (engine.Status == "lost" && engine.LegalMoves().Count == 0) return Result(false, "no_legal_swaps");
            var proposal = rescue.BeginAd(game["rescue"], context);
            return Execute(() => { game["rescue"] = proposal["state"]; return W.Obj("ok", proposal["transactionId"] != null && W.Equal(proposal["reason"], "pending"), "reason", proposal["reason"], "transactionId", proposal["transactionId"]); }, command);
        }
        private Dictionary<string, object> CommitRescue(Dictionary<string, object> proposal, object paidEconomy = null, SessionCommand command = null)
        {
            if (!W.Equal(proposal["applied"], true)) return Result(false, proposal["reason"] as string);
            var grant = W.Map(proposal["grant"]); var candidate = AssistanceCandidate(); var applied = candidate.Apply(W.Obj("id", grant["commandId"], "type", "grant_moves", "moves", grant["moves"]));
            if (!W.Equal(W.Get(applied, "ok"), true) || W.Equal(W.Get(applied, "duplicate"), true)) return Result(false, "rescue_command_rejected");
            return Execute(() =>
            {
                assistance = candidate; engine = candidate.Model; game["rescue"] = proposal["state"]; if (paidEconomy != null) game["economy"] = W.Clone(paidEconomy);
                pendingBoosterQuote = null; rewardState = null; lastRewardPlan = null; CurrentEntry().stats["terminalEvent"] = null;
                Emit("booster_used", CurrentEntry(), W.Obj("boosterId", "rescue5")); return Result(true, "rescued");
            }, command);
        }
        public Dictionary<string, object> RescueWithGold(string operationId, SessionCommand command = null)
        {
            if (HasPendingRescueDelivery) return Result(false, "pending_rescue_delivery");
            var denied = Guard(command); if (denied != null) return denied; var context = RescueContext(); if (context == null) return Result(false, "no_attempt");
            if (engine.Status == "lost" && engine.LegalMoves().Count == 0) return Result(false, "no_legal_swaps");
            var proposal = rescue.ApplyGold(game["rescue"], context, operationId, W.Obj("gold", W.Get(game["economy"], "gold")));
            if (!W.Equal(proposal["applied"], true)) return Result(false, proposal["reason"] as string);
            var payment = economy.SpendRescue(game["economy"], W.Obj("operationId", operationId, "attemptId", metadata["attemptId"], "levelId", activeLevel["id"]));
            if (!W.Equal(payment["applied"], true)) return Result(false, payment["reason"] as string); return CommitRescue(proposal, payment["state"], command);
        }
        public Dictionary<string, object> ApplyRescueReceipt(object receipt, object completedProvider = null, SessionCommand command = null)
        {
            var denied = Guard(command); if (denied != null) return denied; var context = RescueContext(); if (context == null) return Result(false, "no_attempt");
            if (engine.Status == "lost" && engine.LegalMoves().Count == 0) return Result(false, "no_legal_swaps");
            var proposal = rescue.ApplyAd(game["rescue"], context, receipt, completedProvider);
            if (!W.Equal(proposal["applied"], true))
            {
                if (W.Equal(proposal["reason"], "duplicate_transaction") && rescue.TransactionFor(game["rescue"], W.Get(receipt, "transactionId")) != null) pendingRescueDelivery = null;
                return Result(false, proposal["reason"] as string);
            }
            var result = CommitRescue(proposal, null, command);
            if (W.Equal(result["ok"], true)) pendingRescueDelivery = null;
            else if (new[] { "storage", "stale_profile", "read_only", "revision_exhausted" }.Contains(result["reason"] as string)) pendingRescueDelivery = W.Obj("receipt", W.Copy(receipt), "provider", W.Copy(completedProvider ?? W.Get(proposal["state"], "provider")));
            return result;
        }
        public Dictionary<string, object> RetryPendingRescueDelivery(SessionCommand command = null)
        {
            if (!HasPendingRescueDelivery) return Result(false, "no_pending_rescue_delivery");
            return ApplyRescueReceipt(pendingRescueDelivery["receipt"], pendingRescueDelivery["provider"], command);
        }
        public Dictionary<string, object> CompleteRescueAd(string transactionId, string outcome = "completed", SessionCommand command = null)
        {
            if (HasPendingRescueDelivery) return outcome == "completed" && W.Equal(W.Get(pendingRescueDelivery["receipt"], "transactionId"), transactionId) ? RetryPendingRescueDelivery(command) : Result(false, "pending_rescue_delivery");
            var denied = Guard(command); if (denied != null) return denied; var completed = rescue.CompleteAd(game["rescue"], transactionId, W.Obj("outcome", outcome));
            if (completed["receipt"] != null)
            {
                return ApplyRescueReceipt(completed["receipt"], completed["completedProvider"], command);
            }
            return Execute(() => { game["rescue"] = completed["state"]; return Result(false, completed["reason"] as string); }, command);
        }
    }
}
