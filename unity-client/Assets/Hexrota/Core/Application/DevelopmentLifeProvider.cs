using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Hexrota.Lives;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.Application
{
    // This reproduces only the web prototype's local provider. It is not proof of
    // a real payment/ad and has no network, SDK, clock or persistence dependency.
    public static class DevelopmentLifeProvider
    {
        public static readonly string[] Products = { "ad_life", "single_life", "refill_lives", "unlimited_lives_30m", "test_gold_300" };
        private static readonly string[] Reserved = { "__proto__", "prototype", "constructor", "toString", "toLocaleString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__" };
        private static bool Token(object value) { return value is string && !Reserved.Contains((string)value) && Regex.IsMatch((string)value, @"\A[A-Za-z0-9_.:-]{1,180}\z"); }
        private static bool Integer(object v, long min = 0) { return W.IsSafeInteger(v) && W.Integer(v) >= min; }
        private static void Need(bool condition, string message) { if (!condition) throw new ArgumentException(message); }
        private static long? Serial(Dictionary<string, object> state, string id)
        {
            string prefix = (string)state["namespace"] + "-"; if (id == null || !id.StartsWith(prefix, StringComparison.Ordinal)) return null;
            long serial; if (!long.TryParse(id.Substring(prefix.Length), System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out serial) || serial < 1 || serial > W.MaxSafeInteger || id != prefix + serial.ToString(System.Globalization.CultureInfo.InvariantCulture)) return null; return serial;
        }
        private static bool InRanges(object raw, long value) { return W.List(raw).Any(item => value >= W.Integer(W.List(item)[0]) && value <= W.Integer(W.List(item)[1])); }
        private static bool ValidRanges(object raw, long max)
        {
            if (!W.IsList(raw)) return false; long previous = 0;
            foreach (object item in W.List(raw)) { if (!W.IsList(item)) return false; var pair = W.List(item); if (pair.Count != 2 || !Integer(pair[0], 1) || !Integer(pair[1], W.Integer(pair[0])) || W.Integer(pair[1]) >= max || W.Integer(pair[0]) <= previous) return false; previous = W.Integer(pair[1]) + 1; } return true;
        }
        private static List<object> AddRange(object raw, long value)
        {
            var sorted = W.List(raw).Select(item => W.List(W.Clone(item))).ToList(); sorted.Add(W.Arr(value, value)); sorted.Sort((a, b) => W.Integer(a[0]).CompareTo(W.Integer(b[0])));
            var result = W.Arr(); foreach (var pair in sorted) { var last = result.Count == 0 ? null : W.List(result[result.Count - 1]); if (last != null && W.Integer(pair[0]) <= W.Integer(last[1]) + 1) last[1] = Math.Max(W.Integer(last[1]), W.Integer(pair[1])); else result.Add(pair); } return result;
        }
        public static Dictionary<string, object> Create(string name = "hexrota-test", bool adAvailable = true)
        {
            Need(Token(name) && name.Length <= 150, "Invalid development provider configuration"); return W.Obj("schemaVersion", 2L, "namespace", name, "nextSerial", 1L, "adAvailable", adAvailable, "transactions", W.Obj(), "finalizedRanges", W.Arr());
        }
        private static bool ReceiptFields(Dictionary<string, object> receipt)
        {
            string keys = string.Join(",", receipt.Keys.OrderBy(x => x, StringComparer.Ordinal)); return keys == "productId,provider,status,transactionId,verifiedAtUtc" || keys == "productId,provider,sequence,status,streamId,transactionId,verifiedAtUtc";
        }
        public static bool Validate(object raw)
        {
            Need(W.IsMap(raw), "Invalid development provider state"); var state = W.Map(raw); long version = Integer(W.Get(state, "schemaVersion")) ? W.Integer(state["schemaVersion"]) : 0;
            Need((version == 1 || version == 2) && Token(W.Get(state, "namespace")) && ((string)state["namespace"]).Length <= 150 && Integer(W.Get(state, "nextSerial"), 1) && W.Get(state, "adAvailable") is bool && W.IsMap(W.Get(state, "transactions")) && (version != 2 || ValidRanges(W.Get(state, "finalizedRanges"), W.Integer(state["nextSerial"]))), "Invalid development provider state");
            foreach (var pair in W.Map(state["transactions"]))
            {
                Need(W.IsMap(pair.Value), "Invalid development transaction"); var transaction = W.Map(pair.Value); long? serial = Serial(state, pair.Key);
                Need(Token(pair.Key) && serial.HasValue && serial.Value < W.Integer(state["nextSerial"]) && W.Equal(W.Get(transaction, "transactionId"), pair.Key) && Products.Contains(W.Get(transaction, "productId") as string) && Integer(W.Get(transaction, "createdAtUtc")) && new[] { "pending", "completed", "cancelled", "unavailable" }.Contains(W.Get(transaction, "status") as string) && !(version == 2 && InRanges(state["finalizedRanges"], serial.Value)), "Invalid development transaction");
                if (W.Equal(transaction["status"], "completed"))
                {
                    Need(W.IsMap(W.Get(transaction, "receipt")), "Invalid development receipt"); var receipt = W.Map(transaction["receipt"]);
                    Need(ReceiptFields(receipt) && W.Equal(W.Get(receipt, "transactionId"), pair.Key) && W.Equal(W.Get(receipt, "productId"), transaction["productId"]) && W.Equal(W.Get(receipt, "provider"), "development") && W.Equal(W.Get(receipt, "status"), "completed") && Integer(W.Get(receipt, "verifiedAtUtc")) && W.Integer(receipt["verifiedAtUtc"]) >= W.Integer(transaction["createdAtUtc"]) && (!(W.Has(receipt, "streamId") || W.Has(receipt, "sequence")) || W.Equal(W.Get(receipt, "streamId"), state["namespace"]) && W.Equal(W.Get(receipt, "sequence"), serial.Value)), "Invalid development receipt");
                }
                else Need(!W.Has(transaction, "receipt"), "Invalid development receipt status");
            }
            return true;
        }
        public static Dictionary<string, object> Normalize(object raw) { Validate(raw); var state = W.Copy(raw); if (W.Equal(state["schemaVersion"], 1L)) { state["schemaVersion"] = 2L; state["finalizedRanges"] = W.Arr(); } return state; }
        public static Dictionary<string, object> SetAdAvailable(object raw, bool available) { var state = Normalize(raw); state["adAvailable"] = available; return state; }
        public static bool IsFinalized(object raw, string transactionId) { Validate(raw); var state = W.Map(raw); long? serial = Serial(state, transactionId); return serial.HasValue && W.Equal(state["schemaVersion"], 2L) && InRanges(state["finalizedRanges"], serial.Value); }
        public static Dictionary<string, object> Begin(object raw, string product, long now)
        {
            var state = Normalize(raw); Need(Products.Contains(product) && now >= 0 && now <= W.MaxSafeInteger, "Invalid development request");
            if (product == "ad_life" && !(bool)state["adAvailable"]) return W.Obj("state", state, "transactionId", null, "reason", "unavailable");
            long serial = W.Integer(state["nextSerial"]); string id = state["namespace"] + "-" + serial.ToString(System.Globalization.CultureInfo.InvariantCulture);
            var transactions = W.Map(state["transactions"]); Need(!transactions.ContainsKey(id) && serial < W.MaxSafeInteger, "Development transaction identity exhausted"); state["nextSerial"] = serial + 1;
            transactions[id] = W.Obj("transactionId", id, "productId", product, "createdAtUtc", now, "status", "pending"); return W.Obj("state", state, "transactionId", id, "reason", "pending");
        }
        public static Dictionary<string, object> Complete(object raw, string id, long now, string outcome = "completed")
        {
            var state = Normalize(raw); Need(Token(id) && now >= 0 && now <= W.MaxSafeInteger && new[] { "completed", "cancelled", "unavailable" }.Contains(outcome), "Invalid development result");
            if (IsFinalized(state, id)) return W.Obj("state", state, "receipt", null, "reason", "finalized"); var transactions = W.Map(state["transactions"]); Need(transactions.ContainsKey(id), "Unknown development transaction"); var transaction = W.Map(transactions[id]);
            if (!W.Equal(transaction["status"], "pending")) return W.Obj("state", state, "receipt", W.Clone(W.Get(transaction, "receipt")), "reason", transaction["status"]);
            transaction["status"] = outcome;
            if (outcome == "completed") transaction["receipt"] = W.Obj("transactionId", id, "productId", transaction["productId"], "provider", "development", "status", "completed", "verifiedAtUtc", Math.Max(now, W.Integer(transaction["createdAtUtc"])), "streamId", state["namespace"], "sequence", Serial(state, id).Value);
            return W.Obj("state", state, "receipt", W.Clone(W.Get(transaction, "receipt")), "reason", transaction["status"]);
        }
        public static bool Verify(object raw, object receiptRaw)
        {
            try { Validate(raw); var state = W.Map(raw); var receipt = W.Map(receiptRaw); if (!ReceiptFields(receipt) || !Token(W.Get(receipt, "transactionId"))) return false; object transaction = W.Get(W.Get(state, "transactions"), (string)receipt["transactionId"]); return W.Equal(W.Get(transaction, "status"), "completed") && W.IsMap(W.Get(transaction, "receipt")) && W.Equal(W.Get(transaction, "receipt"), receipt); } catch { return false; }
        }
        public static Dictionary<string, object> Finalize(object raw, string id)
        {
            var state = Normalize(raw); Need(Token(id), "Invalid finalized development identity"); if (IsFinalized(state, id)) return state;
            var transactions = W.Map(state["transactions"]); object transaction = W.Get(transactions, id); Need(W.IsMap(transaction) && !W.Equal(W.Get(transaction, "status"), "pending"), "Only terminal development transactions can be finalized"); state["finalizedRanges"] = AddRange(state["finalizedRanges"], Serial(state, id).Value); transactions.Remove(id); return state;
        }
        public static Dictionary<string, object> CreateEnergy(LifeState life, string providerNamespace = "hexrota-test", long gold = 300, bool adAvailable = true)
        {
            Need(gold >= 0 && gold <= 2147483647L, "Invalid test wallet"); return W.Obj("schemaVersion", 1L, "life", life.ToWire(), "testWallet", W.Obj("schemaVersion", 1L, "gold", gold, "processedTransactions", W.Obj()), "provider", Create(providerNamespace, adAvailable));
        }
        public static Dictionary<string, object> ValidateEnergy(object raw, LifeManager manager)
        {
            Need(W.IsMap(raw), "Invalid life prototype save"); var energy = W.Map(raw); object walletRaw = W.Get(energy, "testWallet");
            Need(W.Equal(W.Get(energy, "schemaVersion"), 1L) && W.IsMap(W.Get(energy, "life")) && W.IsMap(walletRaw) && W.Equal(W.Get(walletRaw, "schemaVersion"), 1L) && Integer(W.Get(walletRaw, "gold")) && W.Integer(W.Get(walletRaw, "gold")) <= 2147483647L && W.IsMap(W.Get(walletRaw, "processedTransactions")), "Invalid life prototype save");
            Validate(W.Get(energy, "provider")); foreach (var entry in W.Map(W.Get(walletRaw, "processedTransactions"))) Need(Token(entry.Key) && W.IsMap(entry.Value) && Products.Contains(W.Get(entry.Value, "productId") as string) && W.IsSafeInteger(W.Get(entry.Value, "goldDelta")) && Integer(W.Get(entry.Value, "atUtc")), "Invalid test wallet transaction");
            return W.Obj("schemaVersion", 1L, "life", manager.Restore(W.Map(energy["life"])).ToWire(), "testWallet", W.Copy(walletRaw), "provider", Normalize(energy["provider"]));
        }
    }
}
