using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using Hexrota.Gameplay;

// File, console and JSON work are deliberately confined to this .NET host.
// The Unity-compatible gameplay core has no dependency on this harness.
internal sealed class FallTileConverter : JsonConverter<FallTile>
{
    public override FallTile Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options)
    {
        throw new NotSupportedException("Gravity metadata is output only");
    }

    public override void Write(Utf8JsonWriter writer, FallTile tile, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        writer.WritePropertyName("from");
        if (tile.from.HasValue) writer.WriteNumberValue(tile.from.Value); else writer.WriteNullValue();
        writer.WriteNumber("to", tile.to);
        writer.WriteNumber("value", tile.value);
        writer.WriteBoolean("spawn", tile.spawn);
        if (tile.spawnOrder.HasValue) writer.WriteNumber("spawnOrder", tile.spawnOrder.Value);
        if (tile.spawnCount.HasValue) writer.WriteNumber("spawnCount", tile.spawnCount.Value);
        writer.WriteEndObject();
    }
}

internal static class Program
{
    private static readonly JsonSerializerOptions Json = BuildJson();
    private static bool portableWire;
    private static int cloneChecks;
    private static int swapCloneChecks;

    private static JsonSerializerOptions BuildJson()
    {
        JsonSerializerOptions result = new JsonSerializerOptions
        {
            IncludeFields = true,
            PropertyNameCaseInsensitive = false,
            DefaultIgnoreCondition = JsonIgnoreCondition.Never
        };

        var resolver = new System.Text.Json.Serialization.Metadata.DefaultJsonTypeInfoResolver();
        resolver.Modifiers.Add(info => {
            if (info.Type == typeof(GameSnapshot) || info.Type == typeof(WaveFrame) || info.Type == typeof(LevelConfig))
                foreach (var property in info.Properties)
                    if (property.Name == "materials" || property.Name == "objectives" || property.Name == "materialVersion" || property.Name == "objectiveVersion" || property.Name == "materialCounts" || property.Name == "collectedSources" || property.Name == "materialEvents" || property.Name == "status" || property.Name == "cellOpen" || property.Name == "openedCells" || property.Name == "obstacles" || property.Name == "obstacleVersion" || property.Name == "blockerHp" || property.Name == "regionOpen" || property.Name == "blockerHits" || property.Name == "brokenBlockers" || property.Name == "openedRegions")
                        property.ShouldSerialize = (instance, value) => value != null;
        });
        result.TypeInfoResolver = resolver;
        result.Converters.Add(new FallTileConverter());
        return result;
    }

    private static JsonElement Required(JsonElement source, string key, JsonValueKind kind)
    {
        JsonElement value;
        if (source.ValueKind != JsonValueKind.Object || !source.TryGetProperty(key, out value) || value.ValueKind != kind)
            throw new ArgumentException("Missing or invalid JSON field: " + key);
        return value;
    }

    private static T Read<T>(JsonElement source)
    {
        return JsonSerializer.Deserialize<T>(source.GetRawText(), Json);
    }

    private static object PortableValue(JsonElement source)
    {
        if (source.ValueKind == JsonValueKind.Object)
        {
            var map = new Dictionary<string, object>(); foreach (JsonProperty p in source.EnumerateObject()) map.Add(p.Name, PortableValue(p.Value)); return map;
        }
        if (source.ValueKind == JsonValueKind.Array)
        {
            var list = new List<object>(); foreach (JsonElement value in source.EnumerateArray()) list.Add(PortableValue(value)); return list;
        }
        if (source.ValueKind == JsonValueKind.String) return source.GetString();
        if (source.ValueKind == JsonValueKind.Number) return source.GetDouble();
        if (source.ValueKind == JsonValueKind.True) return true;
        if (source.ValueKind == JsonValueKind.False) return false;
        return null;
    }

    private static LevelConfig ReadLevel(JsonElement source)
    {
        JsonElement version;
        if (portableWire || (source.TryGetProperty("rulesVersion", out version) && version.ValueKind == JsonValueKind.String && version.GetString() == "classic-v6")) return Hexrota.Catalog.CatalogWire.ReadLevel(PortableValue(source));
        Required(source, "cells", JsonValueKind.Array);
        Required(source, "initial", JsonValueKind.Array);
        Required(source, "palette", JsonValueKind.Array);
        uint seed;
        if (!Required(source, "seed", JsonValueKind.Number).TryGetUInt32(out seed))
            throw new ArgumentException("Level seed must be UInt32");
        Required(source, "moves", JsonValueKind.Number);
        Required(source, "target", JsonValueKind.Number);
        JsonElement rules;
        if (source.TryGetProperty("rulesVersion", out rules) && rules.ValueKind != JsonValueKind.String && rules.ValueKind != JsonValueKind.Null) throw new ArgumentException("Invalid rules version");
        JsonElement obstacles;
        if (source.TryGetProperty("obstacles", out obstacles))
        {
            if (!source.TryGetProperty("rulesVersion", out rules) || rules.GetString() != "classic-v5") throw new ArgumentException("Invalid obstacle rules version");
            Required(obstacles, "version", JsonValueKind.String);
            JsonElement activation;
            if (obstacles.TryGetProperty("activation", out activation) && activation.ValueKind != JsonValueKind.String) throw new ArgumentException("Invalid obstacle activation");
            JsonElement sources;
            if (obstacles.TryGetProperty("sources", out sources) && sources.ValueKind != JsonValueKind.Array) throw new ArgumentException("Invalid obstacle sources");
            foreach (JsonElement box in Required(obstacles, "blockers", JsonValueKind.Array).EnumerateArray())
            {
                Required(box, "id", JsonValueKind.String); Required(box, "cell", JsonValueKind.Number); Required(box, "hp", JsonValueKind.Number);
                JsonElement optional;
                if (box.TryGetProperty("regionId", out optional) && optional.ValueKind != JsonValueKind.String) throw new ArgumentException("Invalid box region");
                if (box.TryGetProperty("required", out optional) && optional.ValueKind != JsonValueKind.True && optional.ValueKind != JsonValueKind.False) throw new ArgumentException("Invalid box requirement");
            }
            foreach (JsonElement region in Required(obstacles, "regions", JsonValueKind.Array).EnumerateArray())
            {
                Required(region, "id", JsonValueKind.String); Required(region, "cells", JsonValueKind.Array); Required(region, "requires", JsonValueKind.Array);
                JsonElement optional;
                if (region.TryGetProperty("required", out optional) && optional.ValueKind != JsonValueKind.True && optional.ValueKind != JsonValueKind.False) throw new ArgumentException("Invalid region requirement");
            }
        }
        if (source.TryGetProperty("rulesVersion", out rules) && rules.ValueKind == JsonValueKind.String && rules.GetString() == "classic-v5")
        {
            // Portable loaders normalize optional/null ground layers to one;
            // explicit zero is a real v5 cleared-ground cell.
            var normalized = System.Text.Json.Nodes.JsonNode.Parse(source.GetRawText());
            foreach (var cell in normalized["cells"].AsArray()) if (cell["layers"] == null) cell["layers"] = 1;
            return JsonSerializer.Deserialize<LevelConfig>(normalized.ToJsonString(), Json);
        }
        return Read<LevelConfig>(source);
    }

    // Snapshot v4 wire validation cannot rely on default CLR numeric field values:
    // omitting a required field must not silently supply a valid zero/default.
    private static GameSnapshot ReadSnapshot(JsonElement source)
    {
        JsonElement version;
        if (portableWire || (source.TryGetProperty("version", out version) && version.ValueKind == JsonValueKind.Number && version.TryGetInt32(out int parsedVersion) && parsedVersion == 6)) return Hexrota.Catalog.CatalogWire.ReadSnapshot(PortableValue(source));
        foreach (string key in new[] { "version", "score", "movesLeft", "turn" })
        {
            int number;
            if (!Required(source, key, JsonValueKind.Number).TryGetInt32(out number))
                throw new ArgumentException("Snapshot field must be Int32: " + key);
        }
        Required(source, "rulesVersion", JsonValueKind.String);
        Required(source, "values", JsonValueKind.Array);
        Required(source, "layers", JsonValueKind.Array);
        Required(source, "history", JsonValueKind.Array);
        uint rngState;
        if (!Required(source, "rngState", JsonValueKind.Number).TryGetUInt32(out rngState))
            throw new ArgumentException("Snapshot RNG must be UInt32");
        if (Required(source, "version", JsonValueKind.Number).GetInt32() == 5)
        {
            Required(source, "obstacleVersion", JsonValueKind.String);
            Required(source, "blockerHp", JsonValueKind.Array);
            Required(source, "regionOpen", JsonValueKind.Array);
        }
        return Read<GameSnapshot>(source);
    }

    private static object Observed(HexMatch game)
    {
        return new { snapshot = portableWire ? (object)Hexrota.Catalog.CatalogWire.Snapshot(game.Snapshot()) : game.Snapshot(), status = game.Status, covered = game.Covered, remainingLayers = game.RemainingLayers };
    }

    private static object CloneObservedAndCheck(HexMatch game)
    {
        string before = JsonSerializer.Serialize(Observed(game), Json);
        HexMatch clone = game.Clone();
        object output = Observed(clone);
        if (JsonSerializer.Serialize(output, Json) != before) throw new InvalidOperationException("Clone state mismatch");
        if (clone.values.Length > 0) clone.values[0] = (clone.values[0] ?? 0) + 1;
        if (clone.layers.Length > 0) clone.layers[0]++;
        if (clone.history.Count > 0 && clone.history[0].Length > 0) clone.history[0][0] = -789;
        if (JsonSerializer.Serialize(Observed(game), Json) != before) throw new InvalidOperationException("Clone shares mutable gameplay state");
        cloneChecks++;
        return output;
    }

    private static HexMatch Injected(LevelConfig level, JsonElement observed)
    {
        GameSnapshot state = ReadSnapshot(Required(observed, "snapshot", JsonValueKind.Object));
        HexMatch game = new HexMatch(level);
        game.values = state.values;
        game.layers = state.layers;
        game.score = state.score;
        game.movesLeft = state.movesLeft;
        game.turn = state.turn;
        game.rngState = state.rngState;
        game.history = new List<int[]>();
        foreach (int[] pair in state.history) game.history.Add((int[])pair.Clone());
        return game;
    }

    private static SwapResult SwapWithCloneCheck(HexMatch game, int[] pair)
    {
        string before = JsonSerializer.Serialize(Observed(game), Json);
        HexMatch clone = game.Clone();
        SwapResult predicted = clone.Swap(pair[0], pair[1]);
        if (JsonSerializer.Serialize(Observed(game), Json) != before)
            throw new InvalidOperationException("Swapping a clone mutated the original game");
        SwapResult actual = game.Swap(pair[0], pair[1]);
        if (JsonSerializer.Serialize(predicted, Json) != JsonSerializer.Serialize(actual, Json) ||
            JsonSerializer.Serialize(Observed(clone), Json) != JsonSerializer.Serialize(Observed(game), Json))
            throw new InvalidOperationException("Clone next-swap result diverged from original");
        swapCloneChecks++;
        return actual;
    }

    private static object ExecuteCase(JsonElement entry)
    {
        cloneChecks = 0;
        swapCloneChecks = 0;
        string kind = Required(entry, "kind", JsonValueKind.String).GetString();
        if (kind == "rng")
        {
            LevelConfig level = new LevelConfig
            {
                cells = new[] { new Cell { q = 0, r = 0, layers = 1 } },
                initial = new int?[] { 1 }, palette = new[] { 1, 2 },
                seed = Required(entry, "seed", JsonValueKind.Number).GetUInt32(), moves = 1, target = 1
            };
            HexMatch game = new HexMatch(level);
            uint initialState = game.rngState;
            List<uint> stream = new List<uint>();
            foreach (JsonElement unused in Required(entry, "expected", JsonValueKind.Array).EnumerateArray()) stream.Add(game.Random());
            return new { initialState = initialState, result = stream };
        }
        LevelConfig config = ReadLevel(Required(entry, "level", JsonValueKind.Object));
        if (kind == "matches")
        {
            HexMatch game = new HexMatch(config);
            return new { result = game.FindMatches(Read<int?[]>(Required(entry, "values", JsonValueKind.Array))) };
        }
        if (kind == "route")
        {
            HexMatch game = new HexMatch(config);
            object initial = Observed(game), initialClone = CloneObservedAndCheck(game);
            object initialLegal = game.LegalMoves();
            List<object> invalids = new List<object>(), steps = new List<object>();
            foreach (JsonElement invalid in Required(entry, "invalidSwaps", JsonValueKind.Array).EnumerateArray())
            {
                int[] pair = Read<int[]>(Required(invalid, "pair", JsonValueKind.Array));
                invalids.Add(new { result = game.Swap(pair[0], pair[1]), after = Observed(game) });
            }
            int resumeAt = Required(entry, "resumeAfterTurn", JsonValueKind.Number).GetInt32(), index = 0;
            foreach (JsonElement step in Required(entry, "steps", JsonValueKind.Array).EnumerateArray())
            {
                int[] pair = Read<int[]>(Required(step, "pair", JsonValueKind.Array));
                Dictionary<string, object> row = new Dictionary<string, object>();
                row["result"] = SwapWithCloneCheck(game, pair);
                row["after"] = Observed(game);
                row["clone"] = CloneObservedAndCheck(game);
                row["legalMoves"] = game.LegalMoves();
                index++;
                if (index == resumeAt)
                {
                    game = new HexMatch(config, game.Snapshot());
                    row["resume"] = Observed(game);
                }
                steps.Add(row);
            }
            Dictionary<string, object> output = new Dictionary<string, object>();
            output["initial"] = initial; output["initialClone"] = initialClone; output["initialLegalMoves"] = initialLegal;
            output["invalidSwaps"] = invalids; output["steps"] = steps;
            List<int[]> route = new List<int[]>();
            foreach (JsonElement step in Required(entry, "steps", JsonValueKind.Array).EnumerateArray())
                route.Add(Read<int[]>(Required(step, "pair", JsonValueKind.Array)));
            output["replay"] = Observed(HexMatch.Replay(config, route.ToArray()));
            JsonElement terminal;
            if (entry.TryGetProperty("terminalSwap", out terminal))
            {
                int[] pair = Read<int[]>(Required(terminal, "pair", JsonValueKind.Array));
                output["terminalSwap"] = new { result = game.Swap(pair[0], pair[1]), after = Observed(game) };
            }
            output["cloneChecks"] = cloneChecks;
            output["swapCloneChecks"] = swapCloneChecks;
            return output;
        }
        HexMatch injected = Injected(config, Required(entry, "state", JsonValueKind.Object));
        object result;
        if (kind == "status") result = injected.Status;
        else if (kind == "state-swap")
        {
            int[] pair = Read<int[]>(Required(entry, "pair", JsonValueKind.Array));
            result = injected.Swap(pair[0], pair[1]);
        }
        else if (kind == "gravity") result = injected.Gravity(Read<int[]>(Required(entry, "removed", JsonValueKind.Array)));
        else if (kind == "refill") result = injected.FillVacancies();
        else if (kind == "reshuffle") result = injected.EnsurePlayable();
        else throw new ArgumentException("Unknown gameplay vector kind: " + kind);
        Dictionary<string, object> component = new Dictionary<string, object>();
        component["result"] = result; component["after"] = Observed(injected);
        if (kind == "reshuffle") component["legalMoves"] = injected.LegalMoves();
        return component;
    }

    private static object ExecuteObstacles(JsonElement request)
    {
        LevelConfig config = ReadLevel(Required(request, "level", JsonValueKind.Object));
        var game = new HexMatch(config); var rows = new List<object>();
        rows.Add(new { after = Observed(game), legalMoves = game.LegalMoves() });
        foreach (JsonElement step in Required(request, "steps", JsonValueKind.Array).EnumerateArray())
        {
            object result = null; bool error = false;
            try
            {
                string op = Required(step, "op", JsonValueKind.String).GetString();
                if (op == "swap") { int[] pair = Read<int[]>(Required(step, "pair", JsonValueKind.Array)); result = SwapWithCloneCheck(game, pair); }
                else if (op == "restore") { game.Restore(ReadSnapshot(Required(step, "snapshot", JsonValueKind.Object))); result = true; }
                else if (op == "resume") { game = new HexMatch(config, game.Snapshot()); result = true; }
                else if (op == "clone")
                {
                    var clone = game.Clone(); result = Observed(clone);
                    if (clone.materialCounts != null && clone.materialCounts.Length > 0) clone.materialCounts[0] = -99;
                    if (clone.collectedSources != null && clone.collectedSources.Length > 0) clone.collectedSources[0] = !clone.collectedSources[0];
                    if (clone.blockerHp.Length > 0) clone.blockerHp[0] = -100;
                    if (clone.regionOpen.Length > 0) clone.regionOpen[0] = !clone.regionOpen[0];
                    if (clone.cellOpen != null && clone.cellOpen.Length > 0) clone.cellOpen[0] = !clone.cellOpen[0];
                }
                else if (op == "replay") { game = HexMatch.Replay(config, game.Snapshot().history); result = true; }
                else if (op == "damage")
                {
                    var method = typeof(HexMatch).GetMethod("DamageBlockers", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                    var frame = (WaveFrame)method.Invoke(game, new object[] { Read<int[]>(Required(step, "matched", JsonValueKind.Array)) });
                    var damage = new Dictionary<string, object> { { "blockerHits", frame.blockerHits }, { "brokenBlockers", frame.brokenBlockers }, { "openedRegions", frame.openedRegions }, { "blockerHp", frame.blockerHp }, { "regionOpen", frame.regionOpen } };
                    if (game.HasColumnFlow) { damage["cellOpen"] = frame.cellOpen; damage["openedCells"] = frame.openedCells; }
                    result = damage;
                }
                else if (op == "gravity") result = game.Gravity(Read<int[]>(Required(step, "matched", JsonValueKind.Array)));
                else if (op == "refill") result = game.FillVacancies();
                else if (op == "ensure") result = game.EnsurePlayable();
                else if (op == "stable") result = game.StableBoard();
                else if (op == "rng") result = game.Random();
                else if (op == "inject")
                {
                    JsonElement value;
                    if (step.TryGetProperty("values", out value)) game.values = Read<int?[]>(value);
                    if (step.TryGetProperty("layers", out value)) game.layers = Read<int[]>(value);
                    if (step.TryGetProperty("materialCounts", out value)) game.materialCounts = Read<int[]>(value);
                    if (step.TryGetProperty("collectedSources", out value)) game.collectedSources = Read<bool[]>(value);
                    if (step.TryGetProperty("blockerHp", out value)) game.blockerHp = Read<int[]>(value);
                    if (step.TryGetProperty("cellOpen", out value)) game.cellOpen = Read<bool[]>(value);
                    if (step.TryGetProperty("regionOpen", out value)) game.regionOpen = Read<bool[]>(value);
                    if (step.TryGetProperty("score", out value)) game.score = value.GetInt32();
                    if (step.TryGetProperty("movesLeft", out value)) game.movesLeft = value.GetInt32();
                    result = true;
                }
                else throw new ArgumentException("Unknown obstacle step");
            }
            catch { error = true; }
            rows.Add(new { error = error, result = result, after = Observed(game), legalMoves = game.LegalMoves() });
        }
        return rows;
    }

    private static object Execute(JsonElement request)
    {
        JsonElement wire; portableWire = request.TryGetProperty("wire", out wire) && wire.ValueKind == JsonValueKind.True;
        string operation = Required(request, "operation", JsonValueKind.String).GetString();
        if (operation == "obstacle") return ExecuteObstacles(request);
        if (operation == "case") return ExecuteCase(Required(request, "vector", JsonValueKind.Object));
        if (operation == "construct")
        {
            return Observed(new HexMatch(ReadLevel(Required(request, "level", JsonValueKind.Object))));
        }
        if (operation == "recovery")
        {
            LevelConfig level = ReadLevel(Required(request, "level", JsonValueKind.Object));
            JsonElement state;
            HexMatch game = request.TryGetProperty("state", out state) ? Injected(level, state) : new HexMatch(level);
            string method = Required(request, "method", JsonValueKind.String).GetString();
            int repeat = Required(request, "repeat", JsonValueKind.Number).GetInt32();
            if ((method != "ensure" && method != "stable") || repeat < 1 || repeat > 4) throw new ArgumentException("Invalid recovery test operation");
            object before = Observed(game); var steps = new List<object>();
            for (int index = 0; index < repeat; index++)
            {
                string prior = JsonSerializer.Serialize(Observed(game), Json);
                try
                {
                    bool result = method == "stable" ? game.StableBoard() : game.EnsurePlayable();
                    steps.Add(new { error = false, result = result, after = Observed(game), legalMoves = game.LegalMoves(), matches = game.FindMatches() });
                }
                catch (Exception error)
                {
                    object after = Observed(game);
                    steps.Add(new { error = true, message = error.Message, after = after, stateUnchanged = JsonSerializer.Serialize(after, Json) == prior });
                }
            }
            return new { before = before, steps = steps };
        }
        if (operation == "restore")
        {
            LevelConfig level = ReadLevel(Required(request, "level", JsonValueKind.Object));
            JsonElement baseline;
            HexMatch game = request.TryGetProperty("baseline", out baseline)
                ? new HexMatch(level, ReadSnapshot(baseline)) : new HexMatch(level);
            string before = JsonSerializer.Serialize(Observed(game), Json);
            try
            {
                game.Restore(ReadSnapshot(Required(request, "snapshot", JsonValueKind.Object)));
                return Observed(game);
            }
            catch (Exception error)
            {
                return new {
                    error = true, errorType = error.GetType().Name, message = error.Message,
                    stateUnchanged = JsonSerializer.Serialize(Observed(game), Json) == before
                };
            }
        }
        throw new ArgumentException("Unknown gameplay harness operation: " + operation);
    }

    private static int Main()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            if (line.Length == 0) continue;
            object result;
            try
            {
                using (JsonDocument document = JsonDocument.Parse(line)) result = Execute(document.RootElement);
            }
            catch (Exception error)
            {
                result = new { error = true, errorType = error.GetType().Name, message = error.Message };
            }
            Console.WriteLine(JsonSerializer.Serialize(result, Json));
        }
        return 0;
    }
}
