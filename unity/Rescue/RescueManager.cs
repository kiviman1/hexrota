using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Hexrota.Contracts;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.Rescue
{
    // The host supplies UTC milliseconds and commits this reducer's proposal with
    // the gameplay command, economy and life state in one profile transaction.
    public interface IRescueReceiptVerifier
    {
        bool Verify(Dictionary<string, object> receipt, Dictionary<string, object> provider);
    }

    internal static class RescueWire
    {
        internal const long Day = 86400000L;
        private static readonly HashSet<string> Reserved = new HashSet<string>(new[] { "__proto__", "prototype", "constructor", "toString", "toLocaleString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__" }, StringComparer.Ordinal);
        internal static void Need(bool condition, string code) { if (!condition) throw new ArgumentException(code); }
        internal static bool Integer(object value, long min = 0, long max = W.MaxSafeInteger) { return W.IsSafeInteger(value) && W.Number(value) >= min && W.Number(value) <= max; }
        internal static bool Token(object value)
        {
            string text = value as string;
            if (text == null || text.Length < 1 || text.Length > 180 || Reserved.Contains(text)) return false;
            foreach (char ch in text) if (!(ch >= 'A' && ch <= 'Z' || ch >= 'a' && ch <= 'z' || ch >= '0' && ch <= '9' || ch == '_' || ch == '.' || ch == ':' || ch == '-')) return false;
            return true;
        }
        internal static bool Exact(object value, params string[] keys) { return W.IsMap(value) && W.Map(value).Count == keys.Length && keys.All(key => W.Has(value, key)); }
        internal static bool OneOf(object value, params string[] values) { return value is string && values.Contains((string)value, StringComparer.Ordinal); }
        internal static Dictionary<string, object> Map(object value) { return W.Map(value); }
        internal static object G(object value, string key) { return W.Get(value, key); }
        internal static long N(object value) { return W.Integer(value); }
        internal static string S(object value) { return W.String(value); }
        internal static List<KeyValuePair<string, object>> Rows(object value) { return W.Map(value).ToList(); }
        internal static IEnumerable<KeyValuePair<string, object>> Ordered(object value, string timeKey)
        {
            return Rows(value).OrderBy(pair => N(G(pair.Value, timeKey))).ThenBy(pair => pair.Key, StringComparer.Ordinal);
        }
    }

    // This provider produces LOCAL TEST receipts only. It is not an ad SDK and its
    // persisted JSON is not proof of a commercial impression or payment.
    public static class DevelopmentRescueProvider
    {
        public const string ProductId = "rescue_moves_5";
        public const string ProviderId = "development_rescue";
        private static long? Serial(object state, string id)
        {
            string prefix = RescueWire.S(RescueWire.G(state, "namespace")) + "-";
            long result;
            if (id == null || !id.StartsWith(prefix, StringComparison.Ordinal) || !long.TryParse(id.Substring(prefix.Length), NumberStyles.None, CultureInfo.InvariantCulture, out result) || result < 1 || result > W.MaxSafeInteger || id != prefix + result.ToString(CultureInfo.InvariantCulture)) return null;
            return result;
        }
        private static bool InRanges(object ranges, long value) { return W.List(ranges).Any(item => value >= RescueWire.N(W.List(item)[0]) && value <= RescueWire.N(W.List(item)[1])); }
        private static bool ValidRanges(object ranges, long maximum)
        {
            if (!W.IsList(ranges)) return false;
            long previous = 0;
            foreach (object item in W.List(ranges))
            {
                if (!W.IsList(item)) return false;
                var pair = W.List(item);
                if (pair.Count != 2 || !RescueWire.Integer(pair[0], 1) || !RescueWire.Integer(pair[1], RescueWire.N(pair[0])) || RescueWire.N(pair[1]) >= maximum || RescueWire.N(pair[0]) <= previous) return false;
                previous = RescueWire.N(pair[1]) + 1;
            }
            return true;
        }
        private static List<object> AddRange(object ranges, long serial)
        {
            var items = W.List(W.Clone(ranges)); items.Add(W.Arr(serial, serial));
            var result = new List<object>();
            foreach (object item in items.OrderBy(value => RescueWire.N(W.List(value)[0])))
            {
                var pair = W.List(item);
                if (result.Count > 0)
                {
                    var last = W.List(result[result.Count - 1]);
                    if (RescueWire.N(pair[0]) <= RescueWire.N(last[1]) + 1) { last[1] = Math.Max(RescueWire.N(last[1]), RescueWire.N(pair[1])); continue; }
                }
                result.Add(W.Clone(pair));
            }
            return result;
        }
        public static bool Validate(object state)
        {
            RescueWire.Need(RescueWire.Exact(state, "schemaVersion", "namespace", "nextSerial", "adAvailable", "transactions", "finalizedRanges") && W.Equal(RescueWire.G(state, "schemaVersion"), 1) && RescueWire.Token(RescueWire.G(state, "namespace")) && RescueWire.S(RescueWire.G(state, "namespace")).Length <= 140 && RescueWire.Integer(RescueWire.G(state, "nextSerial"), 1) && RescueWire.G(state, "adAvailable") is bool && W.IsMap(RescueWire.G(state, "transactions")) && ValidRanges(RescueWire.G(state, "finalizedRanges"), RescueWire.N(RescueWire.G(state, "nextSerial"))), "invalid_rescue_provider");
            foreach (var pair in RescueWire.Rows(RescueWire.G(state, "transactions")))
            {
                string id = pair.Key; object transaction = pair.Value; long? serial = Serial(state, id);
                RescueWire.Need(RescueWire.Token(id) && serial.HasValue && serial.Value < RescueWire.N(RescueWire.G(state, "nextSerial")) && !InRanges(RescueWire.G(state, "finalizedRanges"), serial.Value) && W.IsMap(transaction) && RescueWire.Token(RescueWire.G(transaction, "attemptId")) && RescueWire.Integer(RescueWire.G(transaction, "levelId"), 1) && RescueWire.Integer(RescueWire.G(transaction, "createdAtUtc")) && W.Equal(RescueWire.G(transaction, "transactionId"), id) && RescueWire.OneOf(RescueWire.G(transaction, "status"), "pending", "completed", "cancelled", "unavailable"), "invalid_rescue_provider_transaction");
                bool completed = W.Equal(RescueWire.G(transaction, "status"), "completed");
                RescueWire.Need(completed ? RescueWire.Exact(transaction, "transactionId", "attemptId", "levelId", "createdAtUtc", "status", "receipt") : RescueWire.Exact(transaction, "transactionId", "attemptId", "levelId", "createdAtUtc", "status"), "invalid_rescue_provider_transaction");
                if (completed)
                {
                    object receipt = RescueWire.G(transaction, "receipt");
                    RescueWire.Need(RescueWire.Exact(receipt, "schemaVersion", "provider", "productId", "status", "transactionId", "attemptId", "levelId", "verifiedAtUtc", "streamId", "sequence") && W.Equal(RescueWire.G(receipt, "schemaVersion"), 1) && W.Equal(RescueWire.G(receipt, "provider"), ProviderId) && W.Equal(RescueWire.G(receipt, "productId"), ProductId) && W.Equal(RescueWire.G(receipt, "status"), "completed") && W.Equal(RescueWire.G(receipt, "transactionId"), id) && W.Equal(RescueWire.G(receipt, "attemptId"), RescueWire.G(transaction, "attemptId")) && W.Equal(RescueWire.G(receipt, "levelId"), RescueWire.G(transaction, "levelId")) && RescueWire.Integer(RescueWire.G(receipt, "verifiedAtUtc"), RescueWire.N(RescueWire.G(transaction, "createdAtUtc"))) && W.Equal(RescueWire.G(receipt, "streamId"), RescueWire.G(state, "namespace")) && W.Equal(RescueWire.G(receipt, "sequence"), serial.Value), "invalid_rescue_receipt");
                }
            }
            return true;
        }
        public static Dictionary<string, object> CreateState(Dictionary<string, object> options = null)
        {
            object name = W.Get(options, "namespace", "hexrota-rescue-test"), available = W.Get(options, "adAvailable", true);
            RescueWire.Need(RescueWire.Token(name) && RescueWire.S(name).Length <= 140 && available is bool, "invalid_rescue_provider_configuration");
            return W.Obj("schemaVersion", 1, "namespace", name, "nextSerial", 1, "adAvailable", available, "transactions", W.Obj(), "finalizedRanges", W.Arr());
        }
        public static Dictionary<string, object> Begin(object state, Dictionary<string, object> request)
        {
            Validate(state); object attempt = W.Get(request, "attemptId"), level = W.Get(request, "levelId"), time = W.Get(request, "nowUtc");
            RescueWire.Need(RescueWire.Token(attempt) && RescueWire.Integer(level, 1) && RescueWire.Integer(time), "invalid_rescue_request"); var next = W.Copy(state);
            if (!(bool)W.Get(next, "adAvailable")) return W.Obj("state", next, "transactionId", null, "reason", "ad_unavailable");
            long serial = RescueWire.N(W.Get(next, "nextSerial")); RescueWire.Need(serial < W.MaxSafeInteger, "rescue_transaction_identity_exhausted");
            string id = RescueWire.S(W.Get(next, "namespace")) + "-" + serial.ToString(CultureInfo.InvariantCulture); next["nextSerial"] = serial + 1;
            W.Map(next["transactions"])[id] = W.Obj("transactionId", id, "attemptId", attempt, "levelId", level, "createdAtUtc", time, "status", "pending");
            return W.Obj("state", next, "transactionId", id, "reason", "pending");
        }
        public static Dictionary<string, object> Complete(object state, object transactionId, Dictionary<string, object> options)
        {
            Validate(state); object time = W.Get(options, "nowUtc"), outcome = W.Get(options, "outcome", "completed");
            RescueWire.Need(RescueWire.Token(transactionId) && RescueWire.Integer(time) && RescueWire.OneOf(outcome, "completed", "cancelled", "unavailable"), "invalid_rescue_provider_result"); var next = W.Copy(state); string id = (string)transactionId; long? serial = Serial(next, id);
            if (serial.HasValue && InRanges(next["finalizedRanges"], serial.Value)) return W.Obj("state", next, "receipt", null, "reason", "finalized");
            RescueWire.Need(W.Has(next["transactions"], id), "unknown_rescue_transaction"); var transaction = W.Map(W.Get(next["transactions"], id));
            if (!W.Equal(transaction["status"], "pending")) return W.Obj("state", next, "receipt", W.Clone(W.Get(transaction, "receipt")), "reason", transaction["status"]);
            transaction["status"] = outcome;
            if (W.Equal(outcome, "completed")) transaction["receipt"] = W.Obj("schemaVersion", 1, "provider", ProviderId, "productId", ProductId, "status", "completed", "transactionId", id, "attemptId", transaction["attemptId"], "levelId", transaction["levelId"], "verifiedAtUtc", Math.Max(RescueWire.N(time), RescueWire.N(transaction["createdAtUtc"])), "streamId", next["namespace"], "sequence", serial.Value);
            return W.Obj("state", next, "receipt", W.Clone(W.Get(transaction, "receipt")), "reason", transaction["status"]);
        }
        public static bool Verify(object state, object receipt)
        {
            try { Validate(state); object id = W.Get(receipt, "transactionId"); return W.IsMap(receipt) && RescueWire.Token(id) && W.Has(W.Get(state, "transactions"), (string)id) && W.Equal(W.Get(W.Get(W.Get(state, "transactions"), (string)id), "status"), "completed") && W.Equal(receipt, W.Get(W.Get(W.Get(state, "transactions"), (string)id), "receipt")); } catch { return false; }
        }
        public static Dictionary<string, object> Finalize(object state, object transactionId)
        {
            Validate(state); RescueWire.Need(RescueWire.Token(transactionId), "invalid_rescue_transaction_identity"); var next = W.Copy(state); string id = (string)transactionId; long? serial = Serial(next, id);
            if (serial.HasValue && InRanges(next["finalizedRanges"], serial.Value)) return next;
            RescueWire.Need(W.Has(next["transactions"], id) && !W.Equal(W.Get(W.Get(next["transactions"], id), "status"), "pending"), "rescue_transaction_not_terminal");
            next["finalizedRanges"] = AddRange(next["finalizedRanges"], serial.Value); W.Map(next["transactions"]).Remove(id); return next;
        }
        public static Dictionary<string, object> SetAdAvailable(object state, object available)
        {
            Validate(state); RescueWire.Need(available is bool, "invalid_rescue_availability"); var next = W.Copy(state); next["adAvailable"] = available; return next;
        }
    }

    public sealed class DevelopmentRescueReceiptVerifier : IRescueReceiptVerifier
    {
        public bool Verify(Dictionary<string, object> receipt, Dictionary<string, object> provider) { return DevelopmentRescueProvider.Verify(provider, receipt); }
    }

    public sealed class RescueManager
    {
        private const int Retention = 128;
        private readonly Dictionary<string, object> config;
        private readonly Func<long> clock;
        private readonly IRescueReceiptVerifier verifier;
        public RescueManager(Dictionary<string, object> configuration, Func<long> utcClock, IRescueReceiptVerifier receiptVerifier = null)
        {
            ValidateConfig(configuration); RescueWire.Need(utcClock != null, "rescue_clock_and_verifier_required"); config = W.Copy(configuration); clock = utcClock; verifier = receiptVerifier;
        }
        public static bool ValidateConfig(object configuration)
        {
            RescueWire.Need(RescueWire.Exact(configuration, "moves", "goldCost", "dailyAdLimit", "maxPerAttempt") && W.Equal(W.Get(configuration, "moves"), 5) && RescueWire.Integer(W.Get(configuration, "goldCost"), 0, int.MaxValue) && RescueWire.Integer(W.Get(configuration, "dailyAdLimit"), 1, 100) && W.Equal(W.Get(configuration, "maxPerAttempt"), 1), "invalid_rescue_configuration"); return true;
        }
        private long Now() { long value = clock(); RescueWire.Need(value >= 0 && value <= W.MaxSafeInteger, "invalid_rescue_clock"); return value; }
        private static Dictionary<string, object> ClaimFor(object state, string id)
        {
            object active = W.Get(state, "settledAttempts"), archive = W.Get(state, "settledArchive");
            if (W.Has(active, id)) return W.IsMap(W.Get(active, id)) ? W.Map(W.Get(active, id)) : null;
            if (W.Has(archive, id)) { var row = W.List(W.Get(archive, id)); return W.Obj("levelId", row[0], "source", row[1], "transactionId", row[2], "atUtc", row[3]); }
            return null;
        }
        private static Dictionary<string, object> Transaction(object state, string id)
        {
            object active = W.Get(state, "processedTransactions"), archive = W.Get(state, "transactionArchive");
            if (W.Has(active, id)) return W.IsMap(W.Get(active, id)) ? W.Map(W.Get(active, id)) : null;
            if (W.Has(archive, id)) { var row = W.List(W.Get(archive, id)); return W.Obj("attemptId", row[0], "levelId", row[1], "source", row[2], "atUtc", row[3], "moves", 5, "costGold", row[4]); }
            return null;
        }
        private static bool ValidClaim(object row) { return RescueWire.Exact(row, "levelId", "source", "transactionId", "atUtc") && RescueWire.Integer(W.Get(row, "levelId"), 1) && RescueWire.OneOf(W.Get(row, "source"), "ad", "gold") && RescueWire.Token(W.Get(row, "transactionId")) && RescueWire.Integer(W.Get(row, "atUtc")); }
        private static bool ValidTransaction(object row) { return RescueWire.Exact(row, "attemptId", "levelId", "source", "atUtc", "moves", "costGold") && RescueWire.Token(W.Get(row, "attemptId")) && RescueWire.Integer(W.Get(row, "levelId"), 1) && RescueWire.OneOf(W.Get(row, "source"), "ad", "gold") && RescueWire.Integer(W.Get(row, "atUtc")) && W.Equal(W.Get(row, "moves"), 5) && RescueWire.Integer(W.Get(row, "costGold"), 0, int.MaxValue) && (!W.Equal(W.Get(row, "source"), "ad") || W.Equal(W.Get(row, "costGold"), 0)); }
        public bool Validate(object state)
        {
            RescueWire.Need(RescueWire.Exact(state, "schemaVersion", "rulesVersion", "lastSeenUtc", "adUsage", "settledAttempts", "settledArchive", "processedTransactions", "transactionArchive", "provider") && W.Equal(W.Get(state, "schemaVersion"), 1) && W.Equal(W.Get(state, "rulesVersion"), "rescue-v1") && RescueWire.Integer(W.Get(state, "lastSeenUtc")) && RescueWire.Exact(W.Get(state, "adUsage"), "day", "count") && RescueWire.Integer(W.Get(W.Get(state, "adUsage"), "day"), 0, W.MaxSafeInteger / RescueWire.Day) && RescueWire.Integer(W.Get(W.Get(state, "adUsage"), "count"), 0, 1000000) && RescueWire.N(W.Get(W.Get(state, "adUsage"), "day")) <= RescueWire.N(W.Get(state, "lastSeenUtc")) / RescueWire.Day && W.IsMap(W.Get(state, "settledAttempts")) && W.IsMap(W.Get(state, "settledArchive")) && W.IsMap(W.Get(state, "processedTransactions")) && W.IsMap(W.Get(state, "transactionArchive")), "invalid_rescue_state");
            DevelopmentRescueProvider.Validate(W.Get(state, "provider"));
            foreach (var pair in RescueWire.Rows(W.Get(state, "settledArchive"))) { var row = W.IsList(pair.Value) ? W.List(pair.Value) : new List<object>(); RescueWire.Need(RescueWire.Token(pair.Key) && !W.Has(W.Get(state, "settledAttempts"), pair.Key) && row.Count == 4 && ValidClaim(W.Obj("levelId", row[0], "source", row[1], "transactionId", row[2], "atUtc", row[3])), "invalid_rescue_settlement"); }
            foreach (var pair in RescueWire.Rows(W.Get(state, "transactionArchive"))) { var row = W.IsList(pair.Value) ? W.List(pair.Value) : new List<object>(); RescueWire.Need(RescueWire.Token(pair.Key) && !W.Has(W.Get(state, "processedTransactions"), pair.Key) && row.Count == 5 && ValidTransaction(W.Obj("attemptId", row[0], "levelId", row[1], "source", row[2], "atUtc", row[3], "moves", 5, "costGold", row[4])), "invalid_rescue_transaction"); }
            foreach (var pair in RescueWire.Rows(W.Get(state, "settledAttempts")).Concat(RescueWire.Rows(W.Get(state, "settledArchive"))))
            {
                var claim = ClaimFor(state, pair.Key); var transaction = Transaction(state, W.Get(claim, "transactionId") as string);
                RescueWire.Need(RescueWire.Token(pair.Key) && ValidClaim(claim) && RescueWire.N( W.Get(claim, "atUtc")) <= RescueWire.N(W.Get(state, "lastSeenUtc")) && transaction != null && W.Equal(W.Get(transaction, "attemptId"), pair.Key) && W.Equal(W.Get(transaction, "levelId"), W.Get(claim, "levelId")) && W.Equal(W.Get(transaction, "source"), W.Get(claim, "source")) && W.Equal(W.Get(transaction, "atUtc"), W.Get(claim, "atUtc")), "invalid_rescue_settlement");
            }
            foreach (var pair in RescueWire.Rows(W.Get(state, "processedTransactions")).Concat(RescueWire.Rows(W.Get(state, "transactionArchive"))))
            {
                var transaction = Transaction(state, pair.Key); var claim = ClaimFor(state, W.Get(transaction, "attemptId") as string);
                RescueWire.Need(RescueWire.Token(pair.Key) && ValidTransaction(transaction) && RescueWire.N(W.Get(transaction, "atUtc")) <= RescueWire.N(W.Get(state, "lastSeenUtc")) && claim != null && W.Equal(W.Get(claim, "transactionId"), pair.Key) && W.Equal(W.Get(claim, "levelId"), W.Get(transaction, "levelId")) && W.Equal(W.Get(claim, "source"), W.Get(transaction, "source")) && W.Equal(W.Get(claim, "atUtc"), W.Get(transaction, "atUtc")), "invalid_rescue_transaction");
            }
            return true;
        }
        private static void ValidateContext(object input)
        {
            bool tutorial = W.Get(input, "tutorial") is bool && (bool)W.Get(input, "tutorial");
            RescueWire.Need(RescueWire.Exact(input, "attemptId", "levelId", "tutorial", "cleared", "status", "movesLeft", "turn", "lastCommand", "rescuesUsed") && RescueWire.Token(W.Get(input, "attemptId")) && W.Get(input, "tutorial") is bool && (tutorial ? RescueWire.Token(W.Get(input, "levelId")) : RescueWire.Integer(W.Get(input, "levelId"), 1)) && W.Get(input, "cleared") is bool && RescueWire.OneOf(W.Get(input, "status"), "playing", "won", "lost") && RescueWire.Integer(W.Get(input, "movesLeft")) && RescueWire.Integer(W.Get(input, "turn")) && (W.Get(input, "lastCommand") == null || RescueWire.Token(W.Get(input, "lastCommand"))) && RescueWire.Integer(W.Get(input, "rescuesUsed")), "invalid_rescue_context");
        }
        private static Dictionary<string, object> Compact(Dictionary<string, object> state)
        {
            object active = state["settledAttempts"];
            foreach (var pair in RescueWire.Ordered(active, "atUtc").Take(Math.Max(0, W.Map(active).Count - Retention)).ToList()) { object row = pair.Value; W.Map(state["settledArchive"])[pair.Key] = W.Arr(W.Get(row, "levelId"), W.Get(row, "source"), W.Get(row, "transactionId"), W.Get(row, "atUtc")); W.Map(active).Remove(pair.Key); }
            active = state["processedTransactions"];
            foreach (var pair in RescueWire.Ordered(active, "atUtc").Take(Math.Max(0, W.Map(active).Count - Retention)).ToList()) { object row = pair.Value; W.Map(state["transactionArchive"])[pair.Key] = W.Arr(W.Get(row, "attemptId"), W.Get(row, "levelId"), W.Get(row, "source"), W.Get(row, "atUtc"), W.Get(row, "costGold")); W.Map(active).Remove(pair.Key); }
            var closed = RescueWire.Ordered(W.Get(state["provider"], "transactions"), "createdAtUtc").Where(pair => !W.Equal(W.Get(pair.Value, "status"), "pending")).ToList();
            foreach (var pair in closed.Take(Math.Max(0, closed.Count - Retention))) state["provider"] = DevelopmentRescueProvider.Finalize(state["provider"], pair.Key);
            return state;
        }
        public Dictionary<string, object> CreateState(Dictionary<string, object> options = null)
        {
            long time = Now(); return W.Obj("schemaVersion", 1, "rulesVersion", "rescue-v1", "lastSeenUtc", time, "adUsage", W.Obj("day", time / RescueWire.Day, "count", 0), "settledAttempts", W.Obj(), "settledArchive", W.Obj(), "processedTransactions", W.Obj(), "transactionArchive", W.Obj(), "provider", DevelopmentRescueProvider.CreateState(options));
        }
        public Dictionary<string, object> Reconcile(object state)
        {
            Validate(state); var next = W.Copy(state); long time = Math.Max(Now(), RescueWire.N(next["lastSeenUtc"])), day = time / RescueWire.Day; next["lastSeenUtc"] = time;
            if (RescueWire.N(W.Get(next["adUsage"], "day")) != day) next["adUsage"] = W.Obj("day", day, "count", 0);
            return Compact(next);
        }
        public Dictionary<string, object> Restore(object state) { return Reconcile(state); }
        private string Eligibility(object state, object input)
        {
            ValidateContext(input); if ((bool)W.Get(input, "tutorial")) return "tutorial"; if ((bool)W.Get(input, "cleared")) return "level_cleared";
            if (ClaimFor(state, (string)W.Get(input, "attemptId")) != null || RescueWire.N(W.Get(input, "rescuesUsed")) >= RescueWire.N(config["maxPerAttempt"])) return "already_rescued";
            if (!W.Equal(W.Get(input, "status"), "lost") || RescueWire.N(W.Get(input, "movesLeft")) != 0 || RescueWire.N(W.Get(input, "turn")) < 1 || !W.Equal(W.Get(input, "lastCommand"), "swap")) return "not_lost_after_swap"; return null;
        }
        private static object PendingFor(object state, object input) { return RescueWire.Rows(W.Get(W.Get(state, "provider"), "transactions")).Select(pair => pair.Value).FirstOrDefault(row => W.Equal(W.Get(row, "attemptId"), W.Get(input, "attemptId")) && W.Equal(W.Get(row, "levelId"), W.Get(input, "levelId")) && W.Equal(W.Get(row, "status"), "pending")); }
        private static int Reserved(object state) { return RescueWire.Rows(W.Get(W.Get(state, "provider"), "transactions")).Count(pair => RescueWire.OneOf(W.Get(pair.Value, "status"), "pending", "completed") && ClaimFor(state, (string)W.Get(pair.Value, "attemptId")) == null && RescueWire.N(W.Get(pair.Value, "createdAtUtc")) / RescueWire.Day == RescueWire.N(W.Get(W.Get(state, "adUsage"), "day"))); }
        private Dictionary<string, object> AvailabilityAt(object state, object input, object gold)
        {
            RescueWire.Need(RescueWire.Integer(gold, 0, int.MaxValue), "invalid_rescue_gold"); string reason = Eligibility(state, input); object pending = reason == null ? PendingFor(state, input) : null;
            long quota = Math.Max(0, RescueWire.N(config["dailyAdLimit"]) - RescueWire.N(W.Get(W.Get(state, "adUsage"), "count"))); int reserved = Reserved(state);
            string adReason = reason ?? (!(bool)W.Get(W.Get(state, "provider"), "adAvailable") ? "ad_unavailable" : pending != null ? "ad_pending" : quota == 0 ? "daily_limit" : reserved >= quota ? "daily_reserved" : null);
            string goldReason = reason ?? (RescueWire.N(gold) < RescueWire.N(config["goldCost"]) ? "insufficient_gold" : null);
            return W.Obj("eligible", reason == null, "reason", reason, "attemptId", W.Get(input, "attemptId"), "moves", config["moves"], "costGold", config["goldCost"], "effectiveNowUtc", W.Get(state, "lastSeenUtc"), "ad", W.Obj("allowed", adReason == null, "reason", adReason, "remainingToday", quota, "pendingTransactionId", pending == null ? null : W.Get(pending, "transactionId")), "gold", W.Obj("allowed", goldReason == null, "reason", goldReason, "costGold", config["goldCost"]));
        }
        public Dictionary<string, object> Availability(object state, Dictionary<string, object> context, Dictionary<string, object> options) { return AvailabilityAt(Reconcile(state), context, W.Get(options, "gold")); }
        private static Dictionary<string, object> Result(object state, bool applied, string reason, object grant = null, object costGold = null, object transactionId = null) { return W.Obj("state", state, "applied", applied, "reason", reason, "grant", grant, "costGold", costGold ?? 0, "transactionId", transactionId); }
        public Dictionary<string, object> BeginAd(object state, Dictionary<string, object> context)
        {
            var next = Reconcile(state); var offer = AvailabilityAt(next, context, 0); object ad = offer["ad"];
            if (!(bool)W.Get(ad, "allowed")) return Result(next, false, (string)W.Get(ad, "reason"), null, 0, W.Get(ad, "pendingTransactionId"));
            var begun = DevelopmentRescueProvider.Begin(next["provider"], W.Obj("attemptId", W.Get(context, "attemptId"), "levelId", W.Get(context, "levelId"), "nowUtc", next["lastSeenUtc"])); next["provider"] = begun["state"]; return Result(next, false, (string)begun["reason"], null, 0, begun["transactionId"]);
        }
        public Dictionary<string, object> CompleteAd(object state, object transactionId, Dictionary<string, object> options = null)
        {
            var next = Reconcile(state); var completed = DevelopmentRescueProvider.Complete(next["provider"], transactionId, W.Obj("nowUtc", next["lastSeenUtc"], "outcome", W.Get(options, "outcome", "completed"))); next["provider"] = completed["state"];
            var result = Result(next, false, (string)completed["reason"], null, 0, transactionId); result["receipt"] = completed["receipt"]; result["completedProvider"] = W.Clone(completed["state"]); return result;
        }
        private static Dictionary<string, object> Duplicate(object state, object input, string id, string source)
        {
            var previous = Transaction(state, id); if (previous == null) return null;
            return Result(state, false, W.Equal(previous["attemptId"], W.Get(input, "attemptId")) && W.Equal(previous["levelId"], W.Get(input, "levelId")) && W.Equal(previous["source"], source) ? "duplicate_transaction" : "transaction_conflict", null, 0, id);
        }
        private Dictionary<string, object> Claim(Dictionary<string, object> state, object input, string id, string source, object cost)
        {
            string attempt = (string)W.Get(input, "attemptId"); object level = W.Get(input, "levelId"); W.Map(state["settledAttempts"])[attempt] = W.Obj("levelId", level, "source", source, "transactionId", id, "atUtc", state["lastSeenUtc"]); W.Map(state["processedTransactions"])[id] = W.Obj("attemptId", attempt, "levelId", level, "source", source, "atUtc", state["lastSeenUtc"], "moves", config["moves"], "costGold", cost);
            foreach (var pair in RescueWire.Rows(W.Get(state["provider"], "transactions"))) if (pair.Key != id && W.Equal(W.Get(pair.Value, "attemptId"), attempt) && W.Equal(W.Get(pair.Value, "status"), "pending")) W.Map(pair.Value)["status"] = "cancelled";
            Compact(state); return Result(state, true, "rescued", W.Obj("commandId", id, "attemptId", attempt, "source", source, "moves", config["moves"]), cost, id);
        }
        public Dictionary<string, object> ApplyGold(object state, Dictionary<string, object> context, object transactionId, Dictionary<string, object> options)
        {
            var next = Reconcile(state); ValidateContext(context); RescueWire.Need(RescueWire.Token(transactionId), "invalid_rescue_transaction_identity"); string id = (string)transactionId; var duplicate = Duplicate(next, context, id, "gold"); if (duplicate != null) return duplicate;
            var offer = AvailabilityAt(next, context, W.Get(options, "gold")); object gold = offer["gold"]; if (!(bool)W.Get(gold, "allowed")) return Result(next, false, (string)W.Get(gold, "reason"), null, 0, id); return Claim(next, context, id, "gold", config["goldCost"]);
        }
        public Dictionary<string, object> ApplyAd(object state, Dictionary<string, object> context, object receipt, object completedProvider = null)
        {
            var next = Reconcile(state); ValidateContext(context); if (!W.IsMap(receipt) || !RescueWire.Token(W.Get(receipt, "transactionId"))) return Result(next, false, "unverified_receipt"); string id = (string)W.Get(receipt, "transactionId"); var duplicate = Duplicate(next, context, id, "ad"); if (duplicate != null) return duplicate;
            string reason = Eligibility(next, context); if (reason != null) return Result(next, false, reason, null, 0, id);
            object proof = completedProvider ?? next["provider"]; bool valid = false;
            try
            {
                DevelopmentRescueProvider.Validate(proof); object issued = W.Get(W.Get(next["provider"], "transactions"), id), completed = W.Get(W.Get(proof, "transactions"), id);
                valid = W.Equal(W.Get(receipt, "attemptId"), W.Get(context, "attemptId")) && W.Equal(W.Get(receipt, "levelId"), W.Get(context, "levelId")) && W.Equal(W.Get(proof, "namespace"), W.Get(next["provider"], "namespace")) && issued != null && completed != null && W.Equal(W.Get(issued, "attemptId"), W.Get(context, "attemptId")) && W.Equal(W.Get(issued, "levelId"), W.Get(context, "levelId")) && W.Equal(W.Get(issued, "createdAtUtc"), W.Get(completed, "createdAtUtc")) && (W.Equal(W.Get(issued, "status"), "pending") || W.Equal(W.Get(issued, "status"), "completed") && DevelopmentRescueProvider.Verify(next["provider"], receipt)) && DevelopmentRescueProvider.Verify(proof, receipt) && verifier != null && verifier.Verify(W.Copy(receipt), W.Copy(proof));
            }
            catch { valid = false; }
            if (!valid) return Result(next, false, "unverified_receipt", null, 0, id);
            // Only trusted completion can carry the time floor across a failed
            // save and rollback; unverified provider JSON cannot advance quota.
            long verifiedTime = RescueWire.N(W.Get(receipt, "verifiedAtUtc"));
            if (verifiedTime > RescueWire.N(next["lastSeenUtc"]))
            {
                next["lastSeenUtc"] = verifiedTime; long verifiedDay = verifiedTime / RescueWire.Day;
                if (RescueWire.N(W.Get(next["adUsage"], "day")) != verifiedDay) next["adUsage"] = W.Obj("day", verifiedDay, "count", 0);
            }
            if (RescueWire.N(W.Get(next["adUsage"], "count")) >= RescueWire.N(config["dailyAdLimit"])) return Result(next, false, "daily_limit", null, 0, id);
            W.Map(W.Get(next["provider"], "transactions"))[id] = W.Clone(W.Get(W.Get(proof, "transactions"), id)); W.Map(next["adUsage"])["count"] = RescueWire.N(W.Get(next["adUsage"], "count")) + 1; return Claim(next, context, id, "ad", 0);
        }
        public Dictionary<string, object> SetAdAvailable(object state, object available) { var next = Reconcile(state); next["provider"] = DevelopmentRescueProvider.SetAdAvailable(next["provider"], available); return next; }
        public Dictionary<string, object> SettlementFor(object state, object id) { Validate(state); RescueWire.Need(RescueWire.Token(id), "invalid_rescue_attempt_identity"); var row = ClaimFor(state, (string)id); return row == null ? null : W.Copy(row); }
        public Dictionary<string, object> TransactionFor(object state, object id) { Validate(state); RescueWire.Need(RescueWire.Token(id), "invalid_rescue_transaction_identity"); var row = Transaction(state, (string)id); return row == null ? null : W.Copy(row); }
    }
}
