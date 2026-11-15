using System;
using System.Collections.Generic;
using Hexrota.Contracts;
using Hexrota.ParitySupport;
using Hexrota.Rescue;
using W = Hexrota.Contracts.Wire;

internal sealed class ThrowingVerifier : IRescueReceiptVerifier
{
    public bool Verify(Dictionary<string, object> receipt, Dictionary<string, object> provider) { throw new Exception("test_verifier_unavailable"); }
}
internal static class Program
{
    private static Dictionary<string, object> Context(int index)
    {
        return W.Obj("attemptId", "stress-" + index, "levelId", 10, "tutorial", false, "cleared", false, "status", "lost", "movesLeft", 0, "turn", 7, "lastCommand", "swap", "rescuesUsed", 0);
    }
    private static object Execute(Dictionary<string, object> request)
    {
        string method = (string)W.Get(request, "method"); object utc = W.Get(request, "utc");
        if (method == "validateConfig") return RescueManager.ValidateConfig(W.Get(request, "config"));
        Func<long> clock = () => { if (!W.IsSafeInteger(utc) || W.Number(utc) < 0) throw new ArgumentException("invalid_rescue_clock"); return W.Integer(utc); };
        object verifyKind = W.Get(request, "verifier"); IRescueReceiptVerifier verifier = W.Equal(verifyKind, "test") ? (IRescueReceiptVerifier)new DevelopmentRescueReceiptVerifier() : W.Equal(verifyKind, "throw") ? new ThrowingVerifier() : null;
        var manager = new RescueManager(W.IsMap(W.Get(request, "config")) ? W.Map(W.Get(request, "config")) : null, clock, verifier);
        object state = W.Get(request, "state"), id = W.Get(request, "id"), receipt = W.Get(request, "receipt"), proof = W.Get(request, "completedProvider");
        var context = W.IsMap(W.Get(request, "context")) ? W.Map(W.Get(request, "context")) : null;
        var options = W.IsMap(W.Get(request, "options")) ? W.Map(W.Get(request, "options")) : null;
        switch (method)
        {
            case "createState": return manager.CreateState(options);
            case "validate": return manager.Validate(state);
            case "restore": return manager.Restore(state);
            case "reconcile": return manager.Reconcile(state);
            case "availability": return manager.Availability(state, context, options);
            case "beginAd": return manager.BeginAd(state, context);
            case "completeAd": return manager.CompleteAd(state, id, options);
            case "applyAd": return manager.ApplyAd(state, context, receipt, proof);
            case "applyGold": return manager.ApplyGold(state, context, id, options);
            case "setAdAvailable": return manager.SetAdAvailable(state, W.Get(request, "available"));
            case "settlementFor": return manager.SettlementFor(state, id);
            case "transactionFor": return manager.TransactionFor(state, id);
            case "providerCreate": return DevelopmentRescueProvider.CreateState(options);
            case "providerValidate": return DevelopmentRescueProvider.Validate(state);
            case "providerBegin": return DevelopmentRescueProvider.Begin(state, options);
            case "providerComplete": return DevelopmentRescueProvider.Complete(state, id, options);
            case "providerVerify": return DevelopmentRescueProvider.Verify(state, receipt);
            case "providerFinalize": return DevelopmentRescueProvider.Finalize(state, id);
            case "providerSetAvailable": return DevelopmentRescueProvider.SetAdAvailable(state, W.Get(request, "available"));
            case "stress":
                var current = manager.CreateState(); int count = W.Int32(W.Get(request, "count")); bool ads = W.Equal(W.Get(request, "ads"), true); long initial = W.Integer(utc);
                for (int index = 0; index < count; index++)
                {
                    var input = Context(index); Dictionary<string, object> result;
                    if (ads)
                    {
                        utc = initial + (index / 2) * 86400000L;
                        var begun = manager.BeginAd(current, input); var completed = manager.CompleteAd(begun["state"], begun["transactionId"]);
                        result = manager.ApplyAd(begun["state"], input, completed["receipt"], completed["completedProvider"]);
                    }
                    else result = manager.ApplyGold(current, input, "stress-gold-" + index, W.Obj("gold", 140));
                    if (!W.Equal(result["applied"], true)) throw new Exception("stress_rejected"); current = W.Map(result["state"]);
                }
                manager.Validate(current);
                return W.Obj("state", current, "oldClaim", manager.SettlementFor(current, "stress-0"), "oldTransaction", manager.TransactionFor(current, ads ? "hexrota-rescue-test-1" : "stress-gold-0"), "duplicate", manager.ApplyGold(current, Context(0), ads ? "hexrota-rescue-test-1" : "stress-gold-0", W.Obj("gold", 140)));
            default: throw new Exception("unknown_rescue_test_method");
        }
    }
    private static void Main()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            Dictionary<string, object> request = null; string before = null;
            try
            {
                request = W.Map(WireJson.Parse(line)); before = WireJson.Serialize(request); object result = Execute(request);
                Console.WriteLine(WireJson.Serialize(W.Obj("result", result, "inputUnchanged", before == WireJson.Serialize(request))));
            }
            catch (Exception error) { Console.WriteLine(WireJson.Serialize(W.Obj("result", W.Obj("error", true, "message", error.Message), "inputUnchanged", request == null || before == WireJson.Serialize(request)))); }
        }
    }
}
