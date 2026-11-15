using System;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Catalog;
using Hexrota.Commands;
using Hexrota.Economy;
using Hexrota.Gameplay;
using Hexrota.Lives;
using Hexrota.Rescue;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.Application
{
    public static class SaveMigration
    {
        public static Dictionary<string, object> Defaults()
        {
            return W.Obj("current", 0L, "done", W.Arr(), "boards", W.Obj(), "attempts", W.Obj(), "attemptStats", W.Obj(), "variantSelection", W.Obj("seed", 0L, "serial", 0L, "counts", W.Obj(), "recent", W.Obj()), "guideAcks", W.Arr(), "sound", false, "preferences", W.Obj("music", false, "volume", .65, "motion", "auto", "haptics", false), "records", W.Obj());
        }
        private static object Indexed(object container, string key)
        {
            if (W.IsMap(container)) return W.Get(container, key);
            int index; if (W.IsList(container) && int.TryParse(key, out index) && index >= 0 && key == index.ToString(System.Globalization.CultureInfo.InvariantCulture)) { var list = W.List(container); if (index < list.Count) return list[index]; }
            return null;
        }
        private static bool HasIndex(object container, string key) { if (W.IsMap(container)) return W.Has(container, key); int index; return W.IsList(container) && int.TryParse(key, out index) && index >= 0 && index < W.List(container).Count && key == index.ToString(System.Globalization.CultureInfo.InvariantCulture); }
        private static bool Counter(object value) { return W.IsSafeInteger(value) && W.Integer(value) >= 0; }
        private static bool Index(object value, int size) { return Counter(value) && W.Integer(value) < size; }
        public static Dictionary<string, object> NormalizeGame(object raw, IList<Dictionary<string, object>> levels, int tutorialCount, string sourceKey = ProfileRepository.GameKey)
        {
            if (sourceKey != ProfileRepository.GameKey && sourceKey != "hexrota-match-v4" && sourceKey != "hexrota-match-v3" && sourceKey != "hexrota-match-v2") throw new ProfileStorageException("unsupported_save_version");
            var saved = Defaults(); int size = levels.Count;
            if (raw == null) return saved;
            if (!W.IsMap(raw)) throw new ProfileStorageException("invalid_game_save");
            if (sourceKey != ProfileRepository.GameKey)
            {
                var previous = W.Map(raw); var done = Enumerable.Range(0, tutorialCount).Select(i => (object)(long)i).ToList();
                if (W.IsList(W.Get(previous, "done"))) foreach (object index in W.List(previous["done"])) if (Index(index, size - tutorialCount)) done.Add(W.Integer(index) + tutorialCount);
                var boards = W.Obj(); if (sourceKey == "hexrota-match-v4") for (int index = 0; index < size - tutorialCount; index++) { object board = Indexed(W.Get(previous, "boards"), index.ToString()); if (W.Truthy(board)) boards[(index + tutorialCount).ToString()] = W.Clone(board); }
                var shifted = W.Obj("current", W.IsInteger(W.Get(previous, "current")) ? W.Integer(previous["current"]) + tutorialCount : tutorialCount, "done", done, "boards", boards, "sound", W.Get(previous, "sound"));
                if (W.Has(previous, "economy")) shifted["economy"] = W.Clone(previous["economy"]);
                if (W.Has(previous, "rescue")) shifted["rescue"] = W.Clone(previous["rescue"]);
                raw = shifted;
            }
            var map = W.Map(raw);
            if (W.Has(map, "economy")) saved["economy"] = W.Clone(map["economy"]);
            if (W.Has(map, "rescue")) saved["rescue"] = W.Clone(map["rescue"]);
            if (W.IsMap(W.Get(map, "boards"))) foreach (var item in W.Map(map["boards"])) { int index; if (!int.TryParse(item.Key, out index) || index < 0 || index >= size || item.Key != index.ToString(System.Globalization.CultureInfo.InvariantCulture) || !W.IsMap(item.Value) && !W.IsList(item.Value)) throw new ProfileStorageException("invalid_game_save"); }
            var completed = W.Arr();
            if (W.IsList(W.Get(map, "done"))) foreach (object index in W.List(map["done"])) if (Index(index, size) && !completed.Any(x => W.Equal(x, index))) completed.Add(W.Integer(index));
            saved["done"] = completed; saved["current"] = Index(W.Get(map, "current"), size) ? W.Integer(map["current"]) : 0L; saved["sound"] = W.Equal(W.Get(map, "sound"), true);
            var acks = W.Arr();
            if (W.IsList(W.Get(map, "guideAcks"))) foreach (object rawId in W.List(map["guideAcks"]))
            {
                string id = rawId as string; if (id == null || acks.Contains(id)) continue; bool valid = false;
                for (int i = 0; i < tutorialCount; i++) { var steps = W.List(W.Get(levels[i], "steps", W.Arr())); for (int turn = 0; turn < steps.Count; turn++) if (W.Equal(W.Get(steps[turn], "acknowledge"), true) && id == i + ":" + (turn + 1)) valid = true; }
                if (valid) acks.Add(id);
            }
            saved["guideAcks"] = acks;
            var preferences = W.Get(map, "preferences"); object volume = W.Get(preferences, "volume"), motion = W.Get(preferences, "motion");
            saved["preferences"] = W.Obj("music", W.Equal(W.Get(preferences, "music"), true), "volume", W.IsNumber(volume) && !double.IsNaN(W.Number(volume)) && !double.IsInfinity(W.Number(volume)) ? Math.Max(0, Math.Min(1, W.Number(volume))) : .65, "motion", new[] { "auto", "reduce", "full" }.Contains(motion as string) ? motion : "auto", "haptics", W.Equal(W.Get(preferences, "haptics"), true));
            for (int i = 0; i < size; i++)
            {
                string key = i.ToString(); object record = Indexed(W.Get(map, "records"), key);
                if (W.IsMap(record) && Counter(W.Get(record, "score")) && W.Integer(W.Get(record, "score")) <= 1000000 && Counter(W.Get(record, "movesLeft")) && W.Integer(W.Get(record, "movesLeft")) <= W.Integer(levels[i]["moves"])) W.Map(saved["records"])[key] = W.Obj("score", W.Get(record, "score"), "movesLeft", W.Get(record, "movesLeft"), "plays", Counter(W.Get(record, "plays")) ? Math.Min(1000000, W.Integer(W.Get(record, "plays"))) : 0L);
                object board = Indexed(W.Get(map, "boards"), key); if (W.IsMap(board) || W.IsList(board)) W.Map(saved["boards"])[key] = W.Clone(board);
                if (HasIndex(W.Get(map, "attempts"), key)) W.Map(saved["attempts"])[key] = W.Clone(Indexed(W.Get(map, "attempts"), key));
                object stats = Indexed(W.Get(map, "attemptStats"), key); if (W.IsMap(stats)) W.Map(saved["attemptStats"])[key] = W.Copy(stats);
            }
            object selection = W.Get(map, "variantSelection"); var target = W.Map(saved["variantSelection"]);
            if (W.IsMap(selection))
            {
                object seed = W.Get(selection, "seed"), serial = W.Get(selection, "serial"); if (Counter(seed) && W.Integer(seed) > 0 && W.Integer(seed) <= uint.MaxValue) target["seed"] = W.Integer(seed); if (Counter(serial)) target["serial"] = W.Integer(serial);
                foreach (var level in levels)
                {
                    string id = W.JsString(level["id"]); object count = W.Get(W.Get(selection, "counts"), id), recent = W.Get(W.Get(selection, "recent"), id);
                    if (Counter(count)) W.Map(target["counts"])[id] = W.Integer(count);
                    if (W.IsList(recent)) { var filtered = W.List(recent).Where(x => x is string && ((string)x).Length <= 80).Select(W.Clone).ToList(); W.Map(target["recent"])[id] = filtered.Skip(Math.Max(0, filtered.Count - 16)).ToList(); }
                }
            }
            return saved;
        }
    }
    public sealed class AttemptRepository
    {
        private readonly LevelCatalog catalog; private readonly IList<Dictionary<string, object>> levels; private readonly int tutorialCount; private readonly EconomyManager economy; private readonly RescueManager rescue;
        public AttemptRepository(LevelCatalog catalog, IList<Dictionary<string, object>> levels, int tutorialCount, Dictionary<string, object> economyConfig = null, RescueManager rescue = null) { this.catalog = catalog; this.levels = levels; this.tutorialCount = tutorialCount; economy = new EconomyManager(economyConfig); this.rescue = rescue ?? new RescueManager(W.Map(economy.Config()["rescue"]), () => 0L); }
        public object AssistanceLimits { get { var config = economy.Config(); return W.Obj("greenBrush", W.Get(W.Get(config["inventory"], "greenBrush"), "maxPerAttempt"), "colorKey", W.Get(W.Get(config["inventory"], "colorKey"), "maxPerAttempt"), "rescue", W.Get(config["rescue"], "maxPerAttempt")); } }
        public AttemptCheckpoint Restore(Dictionary<string, object> game, int index)
        {
            if (index < 0 || index >= levels.Count) throw new ArgumentOutOfRangeException("index"); string key = index.ToString(); object snapshot = W.Get(W.Get(game, "boards"), key); if (snapshot == null) return null;
            object metadata = W.Get(W.Get(game, "attempts"), key); return index < tutorialCount ? catalog.RestoreTutorial((string)levels[index]["id"], snapshot, metadata) : catalog.Restore(levels[index]["id"], snapshot, metadata);
        }
        public ApplicationAttemptCheckpoint RestoreSession(Dictionary<string, object> game, int index)
        {
            if (index < 0 || index >= levels.Count) throw new ArgumentOutOfRangeException("index"); string key = index.ToString(); object snapshot = W.Get(W.Get(game, "boards"), key); if (snapshot == null) return null;
            ApplicationAttemptCheckpoint result;
            if (W.Equal(W.Get(snapshot, "rulesVersion"), AssistedGame.RulesVersion))
            {
                if (index < tutorialCount || !W.IsMap(W.Get(W.Get(game, "attempts"), key))) throw new ProfileStorageException("invalid_assisted_attempt");
                var metadata = W.Map(W.Get(game["attempts"], key));
                // Validate catalog metadata with the real classic initial board,
                // never pass the new command envelope to the classic reader.
                var level = catalog.ResolveLevelWire(levels[index]["id"], W.Get(metadata, "variantId") as string, W.Get(metadata, "levelDataVersion") as string);
                var initial = new HexMatch(LevelCatalog.GameplayConfig(level)); var identity = catalog.Restore(levels[index]["id"], LevelCatalog.SnapshotWire(initial.Snapshot()), metadata);
                var assisted = new AssistedGame(initial.level, identity.Metadata.attemptId, AssistanceLimits, snapshot);
                if (!assisted.Assisted) throw new ProfileStorageException("unassisted_command_envelope");
                result = new ApplicationAttemptCheckpoint { LevelWire = identity.LevelWire, Metadata = identity.Metadata, Game = assisted.Model, Assistance = assisted };
            }
            else
            {
                var classic = Restore(game, index); if (classic == null) return null;
                result = new ApplicationAttemptCheckpoint { LevelWire = classic.LevelWire, Metadata = classic.Metadata, Game = classic.Game };
            }
            ValidateEconomicBindings(game, result); return result;
        }
        private void ValidateEconomicBindings(Dictionary<string, object> game, ApplicationAttemptCheckpoint entry)
        {
            var transactions = W.Obj(); if (W.Has(game, "economy")) transactions = W.Map(economy.Restore(game["economy"])["transactions"]);
            var paid = new HashSet<string>(StringComparer.Ordinal); var commands = entry.Assistance == null ? W.Arr() : W.List(entry.Assistance.Commands);
            var rescued = new HashSet<string>(StringComparer.Ordinal);
            foreach (object command in commands)
            {
                string type = W.Get(command, "type") as string; if (type == "swap") continue;
                if (type == "grant_moves")
                {
                    string grantId = W.Get(command, "id") as string;
                    if (!W.Has(game, "rescue")) throw new ProfileStorageException("rescue_ledger_mismatch"); rescue.Validate(game["rescue"]);
                    var claim = rescue.SettlementFor(game["rescue"], entry.Metadata.attemptId); var transaction = rescue.TransactionFor(game["rescue"], grantId);
                    if (claim == null || transaction == null || !W.Equal(claim["transactionId"], grantId) || !W.Equal(claim["levelId"], entry.LevelWire["id"]) || !W.Equal(transaction["attemptId"], entry.Metadata.attemptId) || !W.Equal(transaction["levelId"], entry.LevelWire["id"]) || !W.Equal(transaction["moves"], 5L)) throw new ProfileStorageException("rescue_ledger_mismatch");
                    object payment = W.Get(transactions, grantId);
                    if (W.Equal(transaction["source"], "gold"))
                    {
                        if (!W.Equal(W.Get(payment, "kind"), "rescue") || !W.Equal(W.Get(payment, "attemptId"), entry.Metadata.attemptId) || !W.Equal(W.Get(payment, "levelId"), entry.LevelWire["id"]) || !W.Equal(W.Get(payment, "costGold"), transaction["costGold"])) throw new ProfileStorageException("rescue_ledger_mismatch"); paid.Add(grantId);
                    }
                    else if (payment != null || !RecordedAdProof(game["rescue"], grantId, entry.Metadata.attemptId, entry.LevelWire["id"])) throw new ProfileStorageException("rescue_ledger_mismatch");
                    rescued.Add(grantId); continue;
                }
                string item = type == "green_brush" ? "greenBrush" : type == "color_key" ? "colorKey" : null; string id = W.Get(command, "id") as string; object row = id == null ? null : W.Get(transactions, id);
                if (item == null || !W.Equal(W.Get(row, "kind"), "use") || !W.Equal(W.Get(row, "itemId"), item) || !W.Equal(W.Get(row, "attemptId"), entry.Metadata.attemptId) || !W.Equal(W.Get(row, "levelId"), entry.LevelWire["id"])) throw new ProfileStorageException("assistance_ledger_mismatch");
                paid.Add(id);
            }
            foreach (var row in transactions)
                if (W.Equal(W.Get(row.Value, "attemptId"), entry.Metadata.attemptId) && (W.Equal(W.Get(row.Value, "kind"), "use") || W.Equal(W.Get(row.Value, "kind"), "rescue")) && (!paid.Contains(row.Key) || !W.Equal(W.Get(row.Value, "levelId"), entry.LevelWire["id"]))) throw new ProfileStorageException("assistance_ledger_mismatch");
            if (W.Has(game, "rescue"))
            {
                rescue.Validate(game["rescue"]); var claim = rescue.SettlementFor(game["rescue"], entry.Metadata.attemptId);
                if (claim != null && (!rescued.Contains((string)claim["transactionId"]) || !W.Equal(claim["levelId"], entry.LevelWire["id"]))) throw new ProfileStorageException("rescue_ledger_mismatch");
            }
        }
        private static bool RecordedAdProof(object state, string id, string attemptId, object levelId)
        {
            object provider = W.Get(state, "provider"), issued = W.Get(W.Get(provider, "transactions"), id);
            if (issued != null) return W.Equal(W.Get(issued, "attemptId"), attemptId) && W.Equal(W.Get(issued, "levelId"), levelId) && DevelopmentRescueProvider.Verify(provider, W.Get(issued, "receipt"));
            string prefix = W.Get(provider, "namespace") as string; if (prefix == null || id == null || !id.StartsWith(prefix + "-", StringComparison.Ordinal)) return false;
            long sequence; string suffix = id.Substring(prefix.Length + 1); if (!long.TryParse(suffix, out sequence) || sequence < 1 || suffix != sequence.ToString(System.Globalization.CultureInfo.InvariantCulture)) return false;
            return W.List(W.Get(provider, "finalizedRanges")).Any(raw => { var range = W.List(raw); return sequence >= W.Integer(range[0]) && sequence <= W.Integer(range[1]); });
        }
        public void ValidateRescuedLives(Dictionary<string, object> game, object energy, LifeManager lives)
        {
            foreach (string key in W.Map(game["boards"]).Keys)
            {
                object snapshot = W.Get(game["boards"], key); if (!W.Equal(W.Get(snapshot, "rulesVersion"), AssistedGame.RulesVersion) || W.Integer(W.Get(W.Get(snapshot, "usage"), "rescue")) == 0) continue;
                var entry = RestoreSession(game, int.Parse(key)); var settlement = lives.SettlementFor(new LifeState(W.Map(W.Get(energy, "life"))), entry.Metadata.attemptId); object row = settlement == null ? null : settlement.ToWire();
                bool discardedArchive = W.Equal(W.Get(row, "discarded"), true) && W.Equal(W.Get(row, "outcome"), "restart") && entry.Game.Status != "won";
                if (row == null || !W.Equal(W.Get(row, "levelId"), entry.LevelWire["id"]) || !W.Equal(W.Get(row, "tutorial"), false) || W.Integer(W.Get(row, "movesUsed")) < entry.Game.level.moves || !(discardedArchive || !W.Equal(W.Get(row, "discarded"), true) && W.Equal(W.Get(row, "outcome"), entry.Game.Status == "won" ? "won" : "failed"))) throw new ProfileStorageException("rescue_life_mismatch");
            }
        }
        public void ValidateRescueState(Dictionary<string, object> game) { if (W.Has(game, "rescue")) rescue.Validate(game["rescue"]); }
        public void ValidateAll(Dictionary<string, object> game) { ValidateRescueState(game); foreach (string key in W.Map(game["boards"]).Keys) { int index; if (!int.TryParse(key, out index) || index < 0 || index >= levels.Count || key != index.ToString(System.Globalization.CultureInfo.InvariantCulture) || !W.IsMap(W.Get(game["boards"], key))) throw new ProfileStorageException("invalid_game_save"); RestoreSession(game, index); } }
    }
    public sealed class ApplicationAttemptCheckpoint
    {
        public Dictionary<string, object> LevelWire;
        public AttemptMetadata Metadata;
        public HexMatch Game;
        public AssistedGame Assistance;
        public object Snapshot { get { return Assistance == null ? (object)LevelCatalog.SnapshotWire(Game.Snapshot()) : Assistance.Snapshot(); } }
    }
    public sealed class SaveValidator
    {
        private readonly AttemptRepository attempts; private readonly LifeManager lives; private readonly EconomyManager economy;
        public SaveValidator(AttemptRepository attempts, LifeManager lives, EconomyManager economy = null) { this.attempts = attempts; this.lives = lives; this.economy = economy; }
        public bool ValidateProfile(object value, bool replayEveryAttempt = true)
        {
            GameProfile.ValidateEnvelope(value); DevelopmentLifeProvider.ValidateEnergy(W.Get(value, "energy"), lives);
            if (W.Has(W.Get(value, "game"), "economy")) (economy ?? new EconomyManager(null)).Restore(W.Get(W.Get(value, "game"), "economy"));
            attempts.ValidateRescueState(W.Map(W.Get(value, "game")));
            if (replayEveryAttempt) { attempts.ValidateAll(W.Map(W.Get(value, "game"))); attempts.ValidateRescuedLives(W.Map(W.Get(value, "game")), W.Get(value, "energy"), lives); } return true;
        }
    }
}
