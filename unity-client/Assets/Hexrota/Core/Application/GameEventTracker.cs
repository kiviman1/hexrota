using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.Application
{
    public sealed class GameEventTracker
    {
        public static readonly string[] Names = { "level_started", "level_completed", "level_failed", "level_retried", "hint_used", "booster_used", "level_abandoned" };
        private static readonly string[] Context = { "timestamp", "levelId", "variantId", "levelDataVersion", "attemptId", "attemptNumber", "movesUsed", "movesRemaining", "score", "targetScore", "covered", "totalCells", "remainingLayers", "cascades", "hintsUsed", "status" };
        private static readonly string[] Details = { "reason", "previousAttemptId", "nextAttemptId", "hintKind", "hintGuarantee", "boosterId" };
        private static bool Token(object value) { return value is string && Regex.IsMatch((string)value, @"\A[A-Za-z0-9_.:-]{1,128}\z"); }
        private static bool Integer(object value, long min = 0, long max = W.MaxSafeInteger) { return W.IsSafeInteger(value) && W.Integer(value) >= min && W.Integer(value) <= max; }
        private static void Require(bool condition, string message) { if (!condition) throw new ArgumentException(message); }
        public static Dictionary<string, object> CreateState(long limit = 500)
        {
            Require(limit >= 1 && limit <= 2000, "Invalid local event buffer limit");
            return W.Obj("schemaVersion", 1L, "limit", limit, "nextSequence", 1L, "events", W.Arr());
        }
        // Wire entry point preserves strict JSON numeric types before converting
        // to the typed convenience API used by application services.
        public static Dictionary<string, object> CreateStateRaw(object options)
        {
            Require(options != null, "Cannot read properties of null (reading 'limit')");
            object limit = W.Get(options, "limit", 500L);
            Require(Integer(limit, 1, 2000), "Invalid local event buffer limit");
            return CreateState(W.Integer(limit));
        }
        public static bool Validate(object raw)
        {
            Require(W.IsMap(raw), "Invalid gameplay event identity");
            var e = W.Map(raw);
            Require(W.Equal(W.Get(e, "schemaVersion"), 1L) && Names.Contains(W.Get(e, "name") as string) && Integer(W.Get(e, "sequence"), 1) && Integer(W.Get(e, "timestamp")) && Token(W.Get(e, "eventId")) && Token(W.Get(e, "attemptId")) && Token(W.Get(e, "variantId")) && Token(W.Get(e, "levelDataVersion")) && (Token(W.Get(e, "levelId")) || Integer(W.Get(e, "levelId"), 1)), "Invalid gameplay event identity");
            Require((string)e["eventId"] == (string)e["attemptId"] + ":" + W.JsString(e["sequence"]), "Invalid gameplay event sequence");
            foreach (string field in new[] { "attemptNumber", "movesUsed", "movesRemaining", "score", "targetScore", "covered", "totalCells", "remainingLayers", "cascades", "hintsUsed" }) Require(Integer(W.Get(e, field)), "Invalid gameplay event statistic");
            Require(W.Integer(e["attemptNumber"]) >= 1 && W.Integer(e["totalCells"]) >= 1 && W.Integer(e["covered"]) <= W.Integer(e["totalCells"]) && new[] { "playing", "won", "lost" }.Contains(W.Get(e, "status") as string), "Invalid gameplay event state");
            string name = (string)e["name"], status = (string)e["status"];
            Require(!(name == "level_completed" && status != "won" || name == "level_failed" && status != "lost" || name == "level_abandoned" && status != "playing"), "Gameplay event does not match its result");
            foreach (string field in Details) if (W.Has(e, field)) Require(Token(e[field]), "Invalid gameplay event detail");
            var allowed = new HashSet<string>(Context.Concat(Details).Concat(new[] { "schemaVersion", "name", "sequence", "eventId" }));
            Require(e.Keys.All(allowed.Contains), "Unexpected gameplay event field"); return true;
        }
        public static bool ValidateState(object raw)
        {
            Require(W.IsMap(raw), "Invalid local event buffer");
            var state = W.Map(raw); Require(W.Equal(W.Get(state, "schemaVersion"), 1L) && Integer(W.Get(state, "limit"), 1, 2000) && Integer(W.Get(state, "nextSequence"), 1) && W.IsList(W.Get(state, "events")), "Invalid local event buffer");
            var events = W.List(state["events"]); Require(events.Count <= W.Integer(state["limit"]), "Invalid local event buffer");
            long previous = 0; foreach (object entry in events) { Validate(entry); long sequence = W.Integer(W.Get(entry, "sequence")); Require(sequence > previous && sequence < W.Integer(state["nextSequence"]), "Invalid local event order"); previous = sequence; } return true;
        }
        public static Dictionary<string, object> Append(Dictionary<string, object> state, string name, Dictionary<string, object> context, Dictionary<string, object> details = null)
        {
            return AppendRaw(state, name, context, details, details != null);
        }
        private static Dictionary<string, object> ContextObject(object value, string[] allowed)
        {
            // Empty JSON arrays have no enumerable keys in the reference contract.
            // Nonempty arrays expose numeric keys and are rejected as context.
            if (W.IsList(value) && W.List(value).Count == 0) return W.Obj();
            Require(W.IsMap(value), "Unexpected gameplay context");
            var map = W.Map(value);
            Require(map.Keys.All(allowed.Contains), "Unexpected gameplay context");
            return map;
        }
        public static Dictionary<string, object> AppendRaw(object rawState, object name, object rawContext, object rawDetails, bool hasDetails)
        {
            ValidateState(rawState);
            var state = W.Map(rawState);
            var context = ContextObject(rawContext, Context);
            var details = hasDetails ? ContextObject(rawDetails, Details) : W.Obj();
            long sequence = W.Integer(state["nextSequence"]);
            string attemptId = W.Has(context, "attemptId") ? W.JsString(context["attemptId"]) : "undefined";
            var e = W.Obj("schemaVersion", 1L, "name", name, "sequence", sequence, "eventId", attemptId + ":" + W.JsString(sequence));
            foreach (var p in context) e[p.Key] = W.Clone(p.Value); foreach (var p in details) e[p.Key] = W.Clone(p.Value); Validate(e);
            var old = W.List(state["events"]);
            if (new[] { "level_started", "level_completed", "level_failed", "level_abandoned" }.Contains(name as string) && old.Any(item => W.Equal(W.Get(item, "attemptId"), e["attemptId"]) && W.Equal(W.Get(item, "name"), name))) return W.Copy(state);
            var all = old.Select(W.Clone).ToList(); all.Add(e); int limit = (int)W.Integer(state["limit"]); if (all.Count > limit) all.RemoveRange(0, all.Count - limit);
            return W.Obj("schemaVersion", 1L, "limit", state["limit"], "nextSequence", sequence + 1L, "events", all);
        }
    }
}
