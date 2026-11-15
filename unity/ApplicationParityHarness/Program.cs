using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Hexrota.Rewards;
using Hexrota.Application;
using Hexrota.Catalog;
using Hexrota.Contracts;
using Hexrota.Lives;
using Hexrota.Hints;
using Hexrota.Rescue;
using Hexrota.ParitySupport;
using W = Hexrota.Contracts.Wire;

internal sealed class Clock : IUtcClock { public long now; public Queue<long> sequence; public long NowUtcMilliseconds() { if (sequence != null && sequence.Count > 0) now = sequence.Dequeue(); return now; } }
internal sealed class RecoveryVerifier : IReceiptVerifier
{
    public List<object> receipts;
    public bool Verify(LifeTransaction transaction) { return receipts != null && receipts.Any(receipt => W.Equal(receipt, transaction.ToWire())); }
}
internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions { IncludeFields = true };
    private static object JsonWire(object value) { return value == null ? null : WireJson.Parse(JsonSerializer.Serialize(value, JsonOptions)); }
    private static Dictionary<string, object> ResultError(Exception e) { var storage = e as ProfileStorageException; var wire = e as WireException; return W.Obj("error", storage != null ? storage.Code : wire != null ? wire.Code : e.Message); }
    private static void Main()
    {
        string line; while ((line = Console.ReadLine()) != null) try { Console.WriteLine(WireJson.Serialize(Run(W.Map(WireJson.Parse(line))))); } catch (Exception error) { Console.WriteLine(WireJson.Serialize(ResultError(error))); }
    }
    private static object Run(Dictionary<string, object> input)
    {
        string mode = (string)W.Get(input, "mode", "session");
        if (mode == "provider")
        {
            object state = W.Get(input, "state"); var output = W.Arr(); foreach (object raw in W.List(input["commands"]))
            {
                var c = W.Map(raw); string op = (string)c["op"]; object result;
                try
                {
                    if (op == "create") { result = DevelopmentLifeProvider.Create((string)W.Get(c, "namespace", "hexrota-test"), (bool)W.Get(c, "adAvailable", true)); state = result; }
                    else if (op == "normalize") { result = DevelopmentLifeProvider.Normalize(state); state = result; }
                    else if (op == "validate") result = DevelopmentLifeProvider.Validate(state);
                    else if (op == "begin") { result = DevelopmentLifeProvider.Begin(state, (string)c["product"], W.Integer(c["now"])); state = W.Get(result, "state"); }
                    else if (op == "complete") { result = DevelopmentLifeProvider.Complete(state, (string)c["id"], W.Integer(c["now"]), (string)W.Get(c, "outcome", "completed")); state = W.Get(result, "state"); }
                    else if (op == "verify") result = DevelopmentLifeProvider.Verify(state, c["receipt"]);
                    else if (op == "finalize") { result = DevelopmentLifeProvider.Finalize(state, (string)c["id"]); state = result; }
                    else if (op == "ad") { result = DevelopmentLifeProvider.SetAdAvailable(state, (bool)c["value"]); state = result; }
                    else throw new Exception("unknown operation");
                }
                catch (Exception e) { result = ResultError(e); }
                output.Add(W.Obj("result", result, "state", W.Clone(state)));
            }
            return output;
        }
        if (mode == "repository")
        {
            var storage = new MemoryProfileStorage(); foreach (var pair in W.Map(W.Get(input, "storage", W.Obj()))) storage.SeedPresent(pair.Key, pair.Value); var repositories = new Dictionary<string, ProfileRepository>(); var output = W.Arr();
            foreach (object raw in W.List(input["commands"]))
            {
                var c = W.Map(raw); string id = (string)W.Get(c, "writer", "a"), op = (string)c["op"]; object result;
                try
                {
                    if (op == "open") { repositories[id] = new ProfileRepository(storage); result = repositories[id].Current(); }
                    else if (op == "commit") result = repositories[id].Commit(c["game"] == null ? null : W.Map(c["game"]), c["energy"] == null ? null : W.Map(c["energy"]));
                    else if (op == "read") result = repositories[id].Read((string)c["key"]);
                    else if (op == "fail") { storage.FailProfileWrites = (bool)W.Get(c, "profile", false); storage.FailMirrorWrites = (bool)W.Get(c, "mirrors", false); storage.FailEventWrites = (bool)W.Get(c, "events", false); result = true; }
                    else if (op == "revoke") { repositories[id].Revoke(); result = true; }
                    else if (op == "write") { storage.Write((string)c["key"], c["value"]); result = true; }
                    else throw new Exception("unknown operation");
                }
                catch (Exception e) { result = ResultError(e); }
                var saved = W.Obj(); foreach (string key in new[] { ProfileRepository.ProfileKey, ProfileRepository.GameKey, ProfileRepository.LifeKey, ProfileRepository.EventKey }) if (storage.Contains(key)) saved[key] = storage.Read(key);
                output.Add(W.Obj("result", result, "storage", saved, "revision", repositories.ContainsKey(id) ? (object)repositories[id].Revision : null, "current", repositories.ContainsKey(id) ? repositories[id].Current() : null));
            }
            return output;
        }
        var campaign = W.List(input["levels"]).Select(W.Map).ToList(); var tutorials = W.List(input["tutorials"]).Select(W.Map).ToList(); var levels = tutorials.Concat(campaign).ToList(); var catalog = new LevelCatalog(campaign, input["variants"], tutorials); var clock = new Clock { now = W.Integer(input["now"]) }; var store = new MemoryProfileStorage(); foreach (var pair in W.Map(W.Get(input, "storage", W.Obj()))) store.SeedPresent(pair.Key, pair.Value);
        GameSessionController controller = null; object lastBoosterQuote = null; var outputs = W.Arr();
        Func<object> snapshot = () => W.Obj("game", controller.GameSave, "energy", controller.EnergySave, "events", controller.EventSave, "view", controller.View(), "rewards", JsonWire(controller.CurrentRewards), "rewardPlan", JsonWire(controller.LastRewardPlan));
        foreach (object raw in W.List(input["commands"]))
        {
            var c = W.Map(raw); string op = (string)c["op"]; object result;
            try
            {
                if (W.IsList(W.Get(c, "clockTimes"))) clock.sequence = new Queue<long>(W.List(c["clockTimes"]).Select(x => W.Integer(x)));
                SessionCommand envelope = W.IsMap(W.Get(c, "envelope")) ? new SessionCommand { expectedRevision = W.Has(c["envelope"], "revision") ? (long?)W.Integer(W.Get(c["envelope"], "revision")) : null, attemptId = W.Get(c["envelope"], "attemptId") as string, turn = W.Has(c["envelope"], "turn") ? (int?)W.Int32(W.Get(c["envelope"], "turn")) : null } : null;
                if (op == "boot") { controller = new GameSessionController(catalog, levels, tutorials.Count, new ProfileRepository(store), W.Map(input["lifeConfig"]), clock, W.UInt32(W.Get(input, "selectionSeed", 4303818L)), (string)W.Get(input, "providerNamespace", "ui-test"), W.Has(input, "rewardRules") ? JsonSerializer.Deserialize<RewardRules>(WireJson.Serialize(input["rewardRules"]), JsonOptions) : null, W.IsList(W.Get(input, "trustedRecoveryReceipts")) ? new RecoveryVerifier { receipts = W.List(input["trustedRecoveryReceipts"]) } : null, W.Has(input, "economyConfig") ? W.Map(input["economyConfig"]) : null, W.Equal(W.Get(input, "rejectRescueReceipts"), true) ? null : new DevelopmentRescueReceiptVerifier(), W.Get(input, "rescueProviderNamespace") as string); result = true; }
                else if (op == "otherWriter") { new GameSessionController(catalog, levels, tutorials.Count, new ProfileRepository(store), W.Map(input["lifeConfig"]), clock, W.UInt32(input["selectionSeed"]), (string)W.Get(input, "providerNamespace", "ui-test"), null, null, W.Has(input, "economyConfig") ? W.Map(input["economyConfig"]) : null, new DevelopmentRescueReceiptVerifier(), W.Get(input, "rescueProviderNamespace") as string); result = true; }
                else if (op == "enter") result = controller.Enter(W.Int32(c["stage"]), (bool)W.Get(c, "fresh", false), (string)W.Get(c, "reason", "stage_entry"), (bool)W.Get(c, "confirmed", false), W.Has(c, "maximumCharge") ? (int?)W.Int32(c["maximumCharge"]) : null, envelope);
                else if (op == "swap") { var pair = W.List(c["pair"]); result = controller.Swap(W.Int32(pair[0]), W.Int32(pair[1]), envelope); }
                else if (op == "previewBooster") { result = controller.PreviewBooster((string)c["itemId"], W.Int32(c["index"]), W.Has(c, "value") ? (int?)W.Int32(c["value"]) : null, (string)c["operationId"], envelope); lastBoosterQuote = W.Clone(W.Get(result, "quote")); }
                else if (op == "useBooster") result = controller.UseBooster((string)c["itemId"], W.Int32(c["index"]), W.Has(c, "value") ? (int?)W.Int32(c["value"]) : null, (string)c["operationId"], envelope, W.Equal(W.Get(c, "quoteFromPreview"), true) ? lastBoosterQuote : W.Get(c, "quote"));
                else if (op == "purchaseInventory") result = controller.PurchaseInventory((string)c["itemId"], (string)c["operationId"], envelope);
                else if (op == "rescueOffer") result = controller.RescueOffer();
                else if (op == "resumeLost") result = controller.ResumeForSecondChance(W.Int32(c["stage"]), envelope);
                else if (op == "rescueAdAvailable") result = controller.SetRescueAdAvailable((bool)c["value"], envelope);
                else if (op == "beginRescueAd") result = controller.BeginRescueAd(envelope);
                else if (op == "completeRescueAd") result = controller.CompleteRescueAd((string)c["id"], (string)W.Get(c, "outcome", "completed"), envelope);
                else if (op == "rescueReceipt") result = controller.ApplyRescueReceipt(c["receipt"], W.Get(c, "provider"), envelope);
                else if (op == "rescueDelivery") result = controller.RetryPendingRescueDelivery(envelope);
                else if (op == "pendingRescueDelivery") result = controller.HasPendingRescueDelivery;
                else if (op == "rescueGold") result = controller.RescueWithGold((string)c["operationId"], envelope);
                else if (op == "preview") result = controller.Preview(W.Int32(c["stage"]));
                else if (op == "hint") result = controller.Hint(new HintOptions { maxNodes = 5000, maxDepth = W.Has(c, "maxDepth") ? W.Number(c["maxDepth"]) : 3, beamWidth = 10 }, null, envelope);
                else if (op == "ack") result = controller.AcknowledgeTutorial(envelope);
                else if (op == "restart") result = controller.Restart((bool)W.Get(c, "confirmed", false), W.Has(c, "maximumCharge") ? (int?)W.Int32(c["maximumCharge"]) : null, envelope);
                else if (op == "retry") result = controller.Retry((string)W.Get(c, "reason", "retry"), envelope);
                else if (op == "reset") result = controller.ResetProgress((bool)W.Get(c, "confirmed", false), W.Has(c, "maximumCharge") ? (int?)W.Int32(c["maximumCharge"]) : null, envelope);
                else if (op == "menu") result = controller.ReturnToMenu(envelope);
                else if (op == "close") result = controller.Close(envelope);
                else if (op == "refresh") result = controller.RefreshLives(envelope);
                else if (op == "bypass") result = controller.SetDeveloperBypass((bool)c["value"], envelope);
                else if (op == "ad") result = controller.SetAdAvailable((bool)c["value"]);
                else if (op == "begin") result = controller.BeginProduct((string)c["product"]);
                else if (op == "complete") result = controller.CompleteProduct((string)c["id"], (string)W.Get(c, "outcome", "completed"));
                else if (op == "receipt") result = controller.ApplyReceipt(c["receipt"], W.Get(c, "provider"));
                else if (op == "time") { clock.now = W.Integer(c["value"]); result = true; }
                else if (op == "fail") { store.FailProfileWrites = (bool)W.Get(c, "profile", false); store.FailEventWrites = (bool)W.Get(c, "events", false); store.FailMirrorWrites = (bool)W.Get(c, "mirrors", false); result = true; }
                else throw new Exception("unknown operation");
            }
            catch (Exception e) { result = ResultError(e); }
            outputs.Add(W.Obj("result", result, "state", controller == null ? null : snapshot(), "profile", store.Read(ProfileRepository.ProfileKey), "durableEvents", store.Read(ProfileRepository.EventKey)));
        }
        return outputs;
    }
}
