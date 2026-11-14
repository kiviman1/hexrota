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

    private static LevelConfig ReadLevel(JsonElement source)
    {
        Required(source, "cells", JsonValueKind.Array);
        Required(source, "initial", JsonValueKind.Array);
        Required(source, "palette", JsonValueKind.Array);
        uint seed;
        if (!Required(source, "seed", JsonValueKind.Number).TryGetUInt32(out seed))
            throw new ArgumentException("Level seed must be UInt32");
        Required(source, "moves", JsonValueKind.Number);
        Required(source, "target", JsonValueKind.Number);
        return Read<LevelConfig>(source);
    }

    // Snapshot v4 wire validation cannot rely on default CLR numeric field values:
    // omitting a required field must not silently supply a valid zero/default.
    private static GameSnapshot ReadSnapshot(JsonElement source)
    {
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
        return Read<GameSnapshot>(source);
    }

    private static object Observed(HexMatch game)
    {
        return new { snapshot = game.Snapshot(), status = game.Status, covered = game.Covered, remainingLayers = game.RemainingLayers };
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

    private static object Execute(JsonElement request)
    {
        string operation = Required(request, "operation", JsonValueKind.String).GetString();
        if (operation == "case") return ExecuteCase(Required(request, "vector", JsonValueKind.Object));
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
