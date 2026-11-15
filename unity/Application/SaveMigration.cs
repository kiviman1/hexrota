using System;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Catalog;
using Hexrota.Economy;
using Hexrota.Gameplay;
using Hexrota.Lives;
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
                raw = W.Obj("current", W.IsInteger(W.Get(previous, "current")) ? W.Integer(previous["current"]) + tutorialCount : tutorialCount, "done", done, "boards", boards, "sound", W.Get(previous, "sound"));
            }
            var map = W.Map(raw);
            if (W.Has(map, "economy")) saved["economy"] = W.Clone(map["economy"]);
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
        private readonly LevelCatalog catalog; private readonly IList<Dictionary<string, object>> levels; private readonly int tutorialCount;
        public AttemptRepository(LevelCatalog catalog, IList<Dictionary<string, object>> levels, int tutorialCount) { this.catalog = catalog; this.levels = levels; this.tutorialCount = tutorialCount; }
        public AttemptCheckpoint Restore(Dictionary<string, object> game, int index)
        {
            if (index < 0 || index >= levels.Count) throw new ArgumentOutOfRangeException("index"); string key = index.ToString(); object snapshot = W.Get(W.Get(game, "boards"), key); if (snapshot == null) return null;
            object metadata = W.Get(W.Get(game, "attempts"), key); return index < tutorialCount ? catalog.RestoreTutorial((string)levels[index]["id"], snapshot, metadata) : catalog.Restore(levels[index]["id"], snapshot, metadata);
        }
        public void ValidateAll(Dictionary<string, object> game) { foreach (string key in W.Map(game["boards"]).Keys) { int index; if (!int.TryParse(key, out index) || index < 0 || index >= levels.Count || key != index.ToString(System.Globalization.CultureInfo.InvariantCulture) || !W.IsMap(W.Get(game["boards"], key))) throw new ProfileStorageException("invalid_game_save"); Restore(game, index); } }
    }
    public sealed class SaveValidator
    {
        private readonly AttemptRepository attempts; private readonly LifeManager lives; private readonly EconomyManager economy;
        public SaveValidator(AttemptRepository attempts, LifeManager lives, EconomyManager economy = null) { this.attempts = attempts; this.lives = lives; this.economy = economy; }
        public bool ValidateProfile(object value, bool replayEveryAttempt = true)
        {
            GameProfile.ValidateEnvelope(value); DevelopmentLifeProvider.ValidateEnergy(W.Get(value, "energy"), lives);
            if (W.Has(W.Get(value, "game"), "economy")) (economy ?? new EconomyManager(null)).Restore(W.Get(W.Get(value, "game"), "economy"));
            if (replayEveryAttempt) attempts.ValidateAll(W.Map(W.Get(value, "game"))); return true;
        }
    }
}
