using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Hexrota.Gameplay;
using Hexrota.Catalog;
using Hexrota.Contracts;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.StoryAdapter
{
    // Host projection only. Canonical HexMatch is replayed in isolation; the
    // Story reducer receives facts and cannot own gameplay or material progress.
    public static class CanonicalStoryFacts
    {
        private const string Error = "Invalid canonical story facts";
        private static void Assert(bool value) { if (!value) throw new ArgumentException(Error); }
        private static bool Number(object value, int minimum = 0) { return W.IsInteger(value) && W.Number(value) >= minimum && W.Number(value) <= int.MaxValue; }
        private static bool Id(string value) { return value != null && Regex.IsMatch(value, @"\A[a-z][a-z0-9-]{0,63}\z"); }
        private static bool Identity(string value) { return value != null && value.Length > 0 && value.Length <= 240 && Regex.IsMatch(value, @"\A[A-Za-z0-9:/._-]+\z"); }
        private static void Keys(object value, params string[] keys) { Assert(W.IsMap(value) && W.Map(value).Count == keys.Length); foreach (string key in keys) Assert(W.Has(value, key)); }
        private static void Metadata(object metadata, object level = null)
        {
            Keys(metadata, "attemptVersion", "levelId", "variantId", "levelDataVersion", "attemptId", "attemptSerial");
            object id = W.Get(metadata, "levelId"), serial = W.Get(metadata, "attemptSerial");
            Assert(W.Equal(W.Get(metadata, "attemptVersion"), 1) && Number(id, 1) && W.IsSafeInteger(serial) && W.Number(serial) >= 1);
            foreach (string key in new[] { "variantId", "levelDataVersion" }) { var text = W.Get(metadata, key) as string; Assert(text != null && text.Length > 0 && text.Length <= 80); }
            string attempt = W.Get(metadata, "attemptId") as string; Assert(attempt != null && Regex.IsMatch(attempt, "\\Aa-" + W.JsString(id) + "-" + W.JsString(serial) + "-[0-9a-f]{8}\\z"));
            if (level != null) Assert(W.Equal(W.Get(level, "id"), id) && W.Equal(W.Get(level, "variantId"), W.Get(metadata, "variantId")) && W.Equal(W.Get(level, "levelDataVersion"), W.Get(metadata, "levelDataVersion")));
        }
        public static object Context(object content, object metadata)
        {
            Metadata(metadata); object raw = W.Get(content, "chapters"); Assert(W.IsList(raw)); var chapters = W.List(raw); Assert(chapters.Count > 0);
            var ids = new HashSet<string>(StringComparer.Ordinal); var levels = new HashSet<int>(); object selected = null;
            foreach (object chapter in chapters)
            {
                Keys(chapter, "id", "levelId"); string id = W.Get(chapter, "id") as string; object level = W.Get(chapter, "levelId");
                Assert(Id(id) && Number(level, 1) && ids.Add(id) && levels.Add(W.Int32(level))); if (W.Equal(level, W.Get(metadata, "levelId"))) selected = chapter;
            }
            Assert(selected != null); return W.Obj("attemptId", W.Get(metadata, "attemptId"), "levelId", W.Get(metadata, "levelId"), "levelDataVersion", W.Get(metadata, "levelDataVersion"), "variantId", W.Get(metadata, "variantId"), "chapterId", W.Get(selected, "id"));
        }
        public static object Facts(object levelWire, object metadata, object snapshot)
        {
            Metadata(metadata, levelWire); Assert(W.IsMap(levelWire)); LevelConfig level = CatalogWire.ReadLevel(levelWire); var game = new HexMatch(level);
            var initial = CatalogWire.Snapshot(game.Snapshot()); Assert(W.IsMap(snapshot) && W.Map(snapshot).Count == initial.Count); foreach (string key in initial.Keys) Assert(W.Has(snapshot, key));
            object rawHistory = W.Get(snapshot, "history"), rawValues = W.Get(snapshot, "values"), rawLayers = W.Get(snapshot, "layers"), rawTurn = W.Get(snapshot, "turn"), rawRng = W.Get(snapshot, "rngState");
            Assert(W.IsList(rawHistory) && Number(rawTurn) && W.Number(rawTurn) <= 10000 && W.List(rawHistory).Count == W.Int32(rawTurn) && Number(W.Get(snapshot, "score")) && Number(W.Get(snapshot, "movesLeft")) && W.IsInteger(rawRng) && W.Number(rawRng) >= 1 && W.Number(rawRng) <= uint.MaxValue && W.IsList(rawValues) && W.List(rawValues).Count == game.Total && W.IsList(rawLayers) && W.List(rawLayers).Count == game.Total);
            foreach (object value in W.List(rawValues)) Assert(value == null || (W.IsInteger(value) && W.Number(value) >= int.MinValue && W.Number(value) <= int.MaxValue));
            foreach (object layer in W.List(rawLayers)) Assert(Number(layer));
            var history = new List<int[]>(); foreach (object rawPair in W.List(rawHistory)) { Assert(W.IsList(rawPair)); var pair = W.List(rawPair); Assert(pair.Count == 2 && Number(pair[0]) && Number(pair[1]) && W.Number(pair[0]) < game.Total && W.Number(pair[1]) < game.Total); history.Add(new[] { W.Int32(pair[0]), W.Int32(pair[1]) }); }
            var boxes = level.obstacles == null ? new BlockerConfig[0] : level.obstacles.blockers; var regions = level.obstacles == null ? new RegionConfig[0] : level.obstacles.regions;
            var definitions = level.materials == null ? new MaterialDefinition[0] : level.materials.definitions; var sources = level.materials == null ? new MaterialSource[0] : level.materials.sources; var goals = level.objectives == null ? new MaterialGoal[0] : level.objectives.materials;
            var boxesById = new Dictionary<string, BlockerConfig>(StringComparer.Ordinal); var regionsById = new HashSet<string>(StringComparer.Ordinal); var sourcesById = new Dictionary<string, MaterialSource>(StringComparer.Ordinal); var materialIds = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var box in boxes) { Assert(Id(box.id)); boxesById.Add(box.id, box); } foreach (var region in regions) { Assert(Id(region.id)); regionsById.Add(region.id); }
            for (int i = 0; i < definitions.Length; i++) { Assert(Id(definitions[i].id)); materialIds.Add(definitions[i].id, i); } foreach (var source in sources) { Assert(Id(source.id)); sourcesById.Add(source.id, source); } foreach (var goal in goals) Assert(Id(goal.materialId));
            var totals = new int[definitions.Length]; var collected = new HashSet<string>(StringComparer.Ordinal); var completed = new HashSet<string>(StringComparer.Ordinal); var seen = new HashSet<string>(StringComparer.Ordinal); var events = new List<object>();
            Action<string, int, int, string, string, int, int, int> emit = (type, turn, wave, subject, material, quantity, total, cell) =>
            {
                string eventId = (string)W.Get(metadata, "attemptId") + "/" + turn + "/" + wave + "/" + type + "/" + (subject ?? "wave");
                Assert(events.Count < 4096 && seen.Add(eventId) && Identity(eventId) && turn >= 0 && turn <= 10000 && wave >= 0 && wave <= 10000 && (subject == null || Id(subject)) && (material == null || Id(material)) && quantity >= 0 && total >= 0 && cell >= -1 && cell <= 10000);
                events.Add(W.Obj("id", eventId, "type", type, "turn", turn, "wave", wave, "subject", subject, "materialId", material, "quantity", quantity, "total", total, "cell", cell));
            };
            Action<WaveFrame, string, int, int> materials = (frame, kind, turn, wave) =>
            {
                foreach (var item in frame.materialEvents ?? new MaterialEvent[0])
                {
                    if (item.kind != kind) continue; MaterialSource source; int index;
                    Assert(sourcesById.TryGetValue(item.sourceId, out source) && collected.Add(item.sourceId) && source.kind == kind && source.materialId == item.materialId && source.quantity == item.quantity && source.cell == item.cell && materialIds.TryGetValue(item.materialId, out index) && item.quantity > 0);
                    index = materialIds[item.materialId]; totals[index] = checked(totals[index] + item.quantity); emit("material_collected", turn, wave, item.sourceId, item.materialId, item.quantity, totals[index], item.cell);
                }
            };
            Action<int, int> terminal = (turn, wave) => { if (game.Status == "won") emit("level_won", turn, wave, null, null, 0, 0, -1); else if (game.Status == "lost") emit("level_lost", turn, wave, null, null, 0, 0, -1); };
            emit("level_started", 0, 0, null, null, 0, 0, -1); if (game.Status != "playing") terminal(0, 1);
            foreach (int[] pair in history)
            {
                SwapResult result = game.Swap(pair[0], pair[1]); Assert(result.ok && result.frames != null && result.frames.Length > 0); int turn = game.turn;
                for (int i = 0; i < result.frames.Length; i++)
                {
                    WaveFrame frame = result.frames[i]; int wave = i + 1; Assert(frame.matched != null && frame.matched.Length >= 3); emit("valid_match", turn, wave, null, null, frame.matched.Length, 0, -1); materials(frame, "matched-cell", turn, wave);
                    foreach (var hit in frame.blockerHits ?? new BlockerHit[0]) { BlockerConfig box; Assert(boxesById.TryGetValue(hit.id, out box) && box.cell == hit.cell && hit.beforeHp == hit.hp + 1 && hit.hp >= 0); emit("blocker_damaged", turn, wave, hit.id, null, 1, hit.hp, hit.cell); }
                    foreach (string broken in frame.brokenBlockers ?? new string[0]) { BlockerConfig box; Assert(boxesById.TryGetValue(broken, out box)); emit("blocker_broken", turn, wave, broken, null, 1, 0, boxesById[broken].cell); }
                    materials(frame, "crate-break", turn, wave); if (frame.materialCounts != null) Assert(W.Equal(frame.materialCounts, totals));
                    foreach (string region in frame.openedRegions ?? new string[0]) { Assert(regionsById.Contains(region)); emit("region_opened", turn, wave, region, null, 0, 0, -1); }
                    foreach (var goal in goals) { int total = totals[materialIds[goal.materialId]]; if (!completed.Contains(goal.materialId) && total >= goal.quantity) { completed.Add(goal.materialId); emit("material_goal_completed", turn, wave, goal.materialId, goal.materialId, goal.quantity, total, -1); } }
                }
                if (game.Status != "playing") terminal(turn, result.frames.Length + 1);
            }
            Assert(W.Equal(snapshot, CatalogWire.Snapshot(game.Snapshot()))); return events;
        }
    }
}
