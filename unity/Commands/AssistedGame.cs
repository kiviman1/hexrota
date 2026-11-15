using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Hexrota.Gameplay;
using Hexrota.Catalog;
using Hexrota.Contracts;

namespace Hexrota.Commands
{
    // Pure mechanical commands. The host authorizes inventory, economy, receipts and
    // attempts and atomically persists their state together with this checkpoint.
    public sealed class AssistedGame
    {
        public const string RulesVersion = "assisted-v1";
        public const int Version = 1, CommandsVersion = 1, MaxCommands = 512;
        private static readonly string[] StateKeys = { "values", "layers", "score", "movesLeft", "turn", "rngState", "history" };
        private static readonly string[] SnapshotKeys = { "version", "rulesVersion", "commandsVersion", "baseRulesVersion", "levelId", "attemptId", "limits", "usage", "bonusMoves", "assisted", "commands", "values", "layers", "score", "movesLeft", "turn", "rngState", "history" };
        private static readonly Regex TokenPattern = new Regex("\\A[A-Za-z0-9_.:-]{1,180}\\z", RegexOptions.CultureInvariant);
        private HexMatch model;
        private Dictionary<string, object> limits, usage;
        private List<object> commands;
        private Dictionary<string, object> results;
        public readonly LevelConfig Level;
        public readonly string AttemptId;
        public int BonusMoves { get; private set; }
        public HexMatch Model { get { return model; } }
        public object Limits { get { return Wire.Clone(limits); } }
        public object Usage { get { return Wire.Clone(usage); } }
        public object Commands { get { return Wire.Clone(commands); } }
        public bool Assisted { get { return Used(usage, "greenBrush") + Used(usage, "colorKey") + Used(usage, "rescue") > 0; } }
        public string Status { get { return model.Status; } }
        public int Covered { get { return model.Covered; } }
        public int RemainingLayers { get { return model.RemainingLayers; } }
        public static object DefaultLimits { get { return Wire.Obj("greenBrush", 1, "colorKey", 1, "rescue", 1); } }

        public AssistedGame(LevelConfig level, string attemptId, object limits = null, object snapshot = null)
        {
            if (!Token(attemptId) || level == null || (!(level.id is string) && !Wire.IsSafeInteger(level.id))) throw new ArgumentException("Invalid assisted identity");
            Level = level; AttemptId = attemptId; this.limits = ReadLimits(limits ?? DefaultLimits);
            usage = Wire.Obj("greenBrush", 0, "colorKey", 0, "rescue", 0); commands = new List<object>();
            results = new Dictionary<string, object>(StringComparer.Ordinal); model = new HexMatch(level);
            if (snapshot != null)
            {
                if (Wire.Equal(Wire.Get(snapshot, "version"), 4) && Wire.Equal(Wire.Get(snapshot, "rulesVersion"), "classic-v4")) ImportClassic(snapshot);
                else Restore(snapshot, limits);
            }
        }
        private AssistedGame(LevelConfig level, string attemptId) { Level = level; AttemptId = attemptId; }
        private static bool Exact(object value, params string[] keys)
        {
            if (!Wire.IsMap(value) || Wire.Map(value).Count != keys.Length) return false;
            foreach (string key in keys) if (!Wire.Has(value, key)) return false; return true;
        }
        private static bool Token(object value)
        {
            string text = value as string;
            return text != null && TokenPattern.IsMatch(text) && text != "__proto__" && text != "constructor" && text != "prototype";
        }
        private static bool Integer(object value) { return Wire.IsSafeInteger(value) && Wire.Number(value) >= 0 && Wire.Number(value) <= int.MaxValue; }
        private static int Used(object value, string key) { return Wire.Int32(Wire.Get(value, key)); }
        private static Dictionary<string, object> ReadLimits(object value)
        {
            if (!Exact(value, "greenBrush", "colorKey", "rescue") || !Integer(Wire.Get(value, "greenBrush")) || Used(value, "greenBrush") > 100 || !Integer(Wire.Get(value, "colorKey")) || Used(value, "colorKey") > 100 || !Wire.Equal(Wire.Get(value, "rescue"), 1)) throw new ArgumentException("Invalid assisted limits");
            return Wire.Copy(value);
        }
        private static Dictionary<string, object> Canonical(object value)
        {
            if (!Wire.IsMap(value) || !Token(Wire.Get(value, "id")) || !(Wire.Get(value, "type") is string)) return null;
            string type = (string)Wire.Get(value, "type");
            if (type == "swap" && Exact(value, "id", "type", "a", "b") && Integer(Wire.Get(value, "a")) && Integer(Wire.Get(value, "b"))) return Wire.Copy(value);
            if (type == "green_brush" && Exact(value, "id", "type", "index") && Integer(Wire.Get(value, "index"))) return Wire.Copy(value);
            if (type == "color_key" && Exact(value, "id", "type", "index", "value") && Integer(Wire.Get(value, "index")) && Integer(Wire.Get(value, "value"))) return Wire.Copy(value);
            if (type == "grant_moves" && Exact(value, "id", "type", "moves") && Wire.Equal(Wire.Get(value, "moves"), 5)) return Wire.Copy(value);
            return null;
        }
        private object Invalid(object command, string reason)
        {
            object id = Wire.Get(command, "id"), type = Wire.Get(command, "type");
            return Wire.Obj("ok", false, "reason", reason, "frames", Wire.Arr(), "scoreGain", 0, "reshuffled", false, "commandId", Token(id) ? id : null, "type", type is string ? type : null, "duplicate", false, "movesSpent", 0, "layersRemoved", 0, "usage", Wire.Clone(usage));
        }
        public object PresentationSnapshot()
        {
            var snapshot = CatalogWire.Snapshot(model.Snapshot()); snapshot.Remove("version"); snapshot.Remove("rulesVersion"); return snapshot;
        }
        public object Snapshot()
        {
            var snapshot = Wire.Obj("version", Version, "rulesVersion", RulesVersion, "commandsVersion", CommandsVersion, "baseRulesVersion", "classic-v4", "levelId", Wire.Clone(Level.id), "attemptId", AttemptId, "limits", Wire.Clone(limits), "usage", Wire.Clone(usage), "bonusMoves", BonusMoves, "assisted", Assisted, "commands", Wire.Clone(commands));
            var board = Wire.Map(PresentationSnapshot()); foreach (string key in StateKeys) snapshot.Add(key, board[key]); return snapshot;
        }
        public object ClassicSnapshot()
        {
            if (Assisted) throw new InvalidOperationException("Assisted state is not a classic-v4 checkpoint");
            return CatalogWire.Snapshot(model.Snapshot());
        }
        public AssistedGame Clone()
        {
            return new AssistedGame(Level, AttemptId) { model = model.Clone(), limits = Wire.Copy(limits), usage = Wire.Copy(usage), commands = Wire.List(Wire.Clone(commands)), results = Wire.Copy(results), BonusMoves = BonusMoves };
        }
        private void ImportClassic(object snapshot)
        {
            var verified = new HexMatch(Level, CatalogWire.ReadSnapshot(snapshot)); int index = 0;
            foreach (int[] pair in verified.history)
            {
                object result = Apply(Wire.Obj("id", "legacy-swap:" + (++index), "type", "swap", "a", pair[0], "b", pair[1]));
                if (!Wire.Equal(Wire.Get(result, "ok"), true)) throw new ArgumentException("Invalid classic command migration");
            }
            if (!Wire.Equal(CatalogWire.Snapshot(model.Snapshot()), CatalogWire.Snapshot(verified.Snapshot()))) throw new ArgumentException("Classic command migration mismatch");
        }
        private void Restore(object snapshot, object requestedLimits)
        {
            if (!Exact(snapshot, SnapshotKeys) || !Wire.Equal(Wire.Get(snapshot, "version"), Version) || !Wire.Equal(Wire.Get(snapshot, "rulesVersion"), RulesVersion) || !Wire.Equal(Wire.Get(snapshot, "commandsVersion"), CommandsVersion) || !Wire.Equal(Wire.Get(snapshot, "baseRulesVersion"), "classic-v4") || !Wire.Equal(Wire.Get(snapshot, "attemptId"), AttemptId) || !Wire.Equal(Wire.Get(snapshot, "levelId"), Level.id) || !Wire.IsList(Wire.Get(snapshot, "commands")) || Wire.List(Wire.Get(snapshot, "commands")).Count > MaxCommands) throw new ArgumentException("Invalid assisted checkpoint");
            limits = ReadLimits(Wire.Get(snapshot, "limits"));
            if (requestedLimits != null && !Wire.Equal(ReadLimits(requestedLimits), limits)) throw new ArgumentException("Assisted limits do not match the checkpoint");
            foreach (object command in Wire.List(Wire.Get(snapshot, "commands")))
            {
                object result = Apply(command);
                if (!Wire.Equal(Wire.Get(result, "ok"), true) || Wire.Equal(Wire.Get(result, "duplicate"), true)) throw new ArgumentException("Invalid assisted command history");
            }
            if (!Wire.Equal(Snapshot(), snapshot)) throw new ArgumentException("Assisted checkpoint does not match its command history");
        }
        public object Preview(object command)
        {
            var copy = Clone(); object result = copy.Apply(command);
            return Wire.Obj("result", result, "snapshot", copy.Snapshot(), "status", copy.Status, "covered", copy.Covered, "remainingLayers", copy.RemainingLayers);
        }
        public object Swap(int a, int b, string id = null)
        {
            return Apply(Wire.Obj("id", id ?? ("swap:" + (commands.Count + 1)), "type", "swap", "a", a, "b", b));
        }
        public object Apply(object input)
        {
            var command = Canonical(input); if (command == null) return Invalid(input, "invalid_command");
            string id = (string)command["id"], type = (string)command["type"]; object previous;
            if (results.TryGetValue(id, out previous))
            {
                if (!Wire.Equal(Wire.Get(previous, "command"), command)) return Invalid(command, "command_id_conflict");
                var duplicate = Wire.Copy(Wire.Get(previous, "result")); duplicate["duplicate"] = true; return duplicate;
            }
            if (commands.Count >= MaxCommands) return Invalid(command, "command_limit");
            HexMatch next = model.Clone(); var nextUsage = Wire.Copy(usage); int beforeLayers = next.RemainingLayers, bonus = BonusMoves; SwapResult mechanics;
            if (type == "swap")
            {
                mechanics = next.Swap(Used(command, "a"), Used(command, "b")); if (!mechanics.ok) return Invalid(command, mechanics.reason);
            }
            else if (type == "grant_moves")
            {
                if (next.Status != "lost" || next.movesLeft != 0 || commands.Count == 0 || !Wire.Equal(Wire.Get(commands[commands.Count - 1], "type"), "swap")) return Invalid(command, "rescue_unavailable");
                if (Used(nextUsage, "rescue") >= Used(limits, "rescue")) return Invalid(command, "rescue_limit");
                nextUsage["rescue"] = Used(nextUsage, "rescue") + 1; bonus += 5; next.movesLeft += 5; mechanics = Empty();
            }
            else
            {
                if (next.Status != "playing") return Invalid(command, next.Status);
                int index = Used(command, "index"); if (index >= next.Total) return Invalid(command, "invalid_target");
                if (type == "green_brush")
                {
                    if (next.layers[index] == 0) return Invalid(command, "ground_empty");
                    if (Used(nextUsage, "greenBrush") >= Used(limits, "greenBrush")) return Invalid(command, "green_brush_limit");
                    next.layers[index]--; nextUsage["greenBrush"] = Used(nextUsage, "greenBrush") + 1; mechanics = Empty();
                }
                else
                {
                    int value = Used(command, "value");
                    if (Array.IndexOf(Level.palette, value) < 0 || next.values[index] == value) return Invalid(command, "invalid_value");
                    if (Used(nextUsage, "colorKey") >= Used(limits, "colorKey")) return Invalid(command, "color_key_limit");
                    next.values[index] = value; nextUsage["colorKey"] = Used(nextUsage, "colorKey") + 1;
                    mechanics = ResolveColorChange(next);
                }
            }
            var output = CommandWire.Result(mechanics); output.Add("commandId", id); output.Add("type", type); output.Add("duplicate", false);
            output.Add("movesSpent", type == "swap" ? 1 : 0); output.Add("layersRemoved", beforeLayers - next.RemainingLayers); output.Add("usage", Wire.Clone(nextUsage));
            model = next; usage = nextUsage; BonusMoves = bonus; commands.Add(command); results.Add(id, Wire.Obj("command", Wire.Clone(command), "result", Wire.Clone(output))); return Wire.Clone(output);
        }
        private static SwapResult Empty() { return new SwapResult { ok = true, reason = null, frames = new WaveFrame[0], scoreGain = 0, reshuffled = false }; }
        private static SwapResult ResolveColorChange(HexMatch next)
        {
            var frames = new List<WaveFrame>(); int totalGain = 0; bool safety = false; int[] matched = next.FindMatches();
            while (matched.Length != 0)
            {
                var before = (int?[])next.values.Clone(); int gain = 0;
                foreach (int index in matched) gain += next.values[index].Value;
                foreach (int index in matched) next.layers[index] = Math.Max(0, next.layers[index] - 1);
                next.score += gain; totalGain += gain; GravityResult refill = next.Gravity(matched);
                frames.Add(new WaveFrame { matched = (int[])matched.Clone(), before = before, after = (int?[])next.values.Clone(), layers = (int[])next.layers.Clone(), scoreGain = gain, compacted = refill.compacted, refill = refill.refill, falls = refill.falls });
                matched = next.FindMatches();
                if (frames.Count >= 32 && matched.Length != 0) { next.StableBoard(); safety = true; break; }
            }
            bool reshuffled = (next.Status == "playing" ? next.EnsurePlayable() : false) || safety;
            return new SwapResult { ok = true, reason = null, frames = frames.ToArray(), scoreGain = totalGain, reshuffled = reshuffled };
        }
    }
}
