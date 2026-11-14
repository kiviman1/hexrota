using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Hexrota.Gameplay;
using Hexrota.Hints;

internal static class Program
{
    private static readonly JsonSerializerOptions Json = new JsonSerializerOptions { IncludeFields = true, DefaultIgnoreCondition = JsonIgnoreCondition.Never };
    private sealed class Clock : IHintClock
    {
        public double step;
        public int reads;
        public double NowMilliseconds { get { return step * reads++; } }
    }
    private static JsonElement Required(JsonElement value, string key, JsonValueKind kind)
    {
        JsonElement found;
        if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty(key, out found) || found.ValueKind != kind) throw new ArgumentException("Missing or invalid field: " + key);
        return found;
    }
    private static T Read<T>(JsonElement value) { return JsonSerializer.Deserialize<T>(value.GetRawText(), Json); }
    private static GameSnapshot Snapshot(JsonElement source)
    {
        foreach (string key in new[] { "version", "score", "movesLeft", "turn" })
        {
            int number; if (!Required(source, key, JsonValueKind.Number).TryGetInt32(out number)) throw new ArgumentException("Invalid integer: " + key);
        }
        Required(source, "rulesVersion", JsonValueKind.String); Required(source, "values", JsonValueKind.Array); Required(source, "layers", JsonValueKind.Array); Required(source, "history", JsonValueKind.Array);
        uint rng; if (!Required(source, "rngState", JsonValueKind.Number).TryGetUInt32(out rng)) throw new ArgumentException("Invalid snapshot RNG");
        return Read<GameSnapshot>(source);
    }
    private static LevelConfig Level(JsonElement source)
    {
        Required(source, "cells", JsonValueKind.Array); Required(source, "initial", JsonValueKind.Array); Required(source, "palette", JsonValueKind.Array);
        Required(source, "seed", JsonValueKind.Number); Required(source, "moves", JsonValueKind.Number); Required(source, "target", JsonValueKind.Number);
        return Read<LevelConfig>(source);
    }
    private static int[][][] Routes(JsonElement source, string name)
    {
        JsonElement found; if (!source.TryGetProperty(name, out found) || found.ValueKind == JsonValueKind.Null) return null;
        if (found.ValueKind != JsonValueKind.Array) throw new ArgumentException("Invalid route container");
        return Read<int[][][]>(found);
    }
    private static int[][] Route(JsonElement source, string name)
    {
        JsonElement found; if (!source.TryGetProperty(name, out found) || found.ValueKind == JsonValueKind.Null) return null;
        if (found.ValueKind != JsonValueKind.Array) throw new ArgumentException("Invalid route container");
        return Read<int[][]>(found);
    }
    private static double Number(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Number) return value.GetDouble();
        if (value.ValueKind == JsonValueKind.Null || value.ValueKind == JsonValueKind.False) return 0;
        if (value.ValueKind == JsonValueKind.True) return 1;
        if (value.ValueKind == JsonValueKind.String)
        {
            string text = value.GetString().Trim(); double number;
            if (text.Length == 0) return 0;
            if (text == "Infinity" || text == "+Infinity") return double.PositiveInfinity;
            if (text == "-Infinity") return double.NegativeInfinity;
            return double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out number) ? number : double.NaN;
        }
        if (value.ValueKind == JsonValueKind.Array)
        {
            if (value.GetArrayLength() == 0) return 0;
            if (value.GetArrayLength() == 1)
            {
                JsonElement single = value[0];
                if (single.ValueKind == JsonValueKind.Null) return 0;
                if (single.ValueKind == JsonValueKind.String || single.ValueKind == JsonValueKind.Number || single.ValueKind == JsonValueKind.Array) return Number(single);
            }
        }
        return double.NaN;
    }
    private static HintOptions Options(JsonElement request)
    {
        JsonElement options, value; var result = new HintOptions();
        if (!request.TryGetProperty("options", out options) || options.ValueKind != JsonValueKind.Object) return result;
        if (options.TryGetProperty("maxNodes", out value)) result.maxNodes = value.ValueKind == JsonValueKind.Number ? value.GetDouble() : double.NaN;
        if (options.TryGetProperty("maxMs", out value)) result.maxMs = Number(value);
        if (options.TryGetProperty("maxDepth", out value)) result.maxDepth = Number(value);
        if (options.TryGetProperty("beamWidth", out value)) result.beamWidth = Number(value);
        return result;
    }
    private static object Execute(JsonElement request)
    {
        LevelConfig level = Level(Required(request, "level", JsonValueKind.Object));
        JsonElement snapshot; var game = request.TryGetProperty("snapshot", out snapshot) && snapshot.ValueKind != JsonValueKind.Null ? new HexMatch(level, Snapshot(snapshot)) : new HexMatch(level);
        string before = JsonSerializer.Serialize(game.Snapshot(), Json);
        JsonElement routes, flag;
        HintRoutes certified = null;
        if (request.TryGetProperty("routes", out routes) && routes.ValueKind == JsonValueKind.Object)
        {
            int[][][] solutions = Routes(routes, "solutions"), alternatives = Routes(routes, "alternativeSolutions"); int[][] solution = Route(routes, "solution");
            certified = HintRoutes.Create(level, solutions, solution, alternatives);
            if (request.TryGetProperty("mutateRouteInput", out flag) && flag.ValueKind == JsonValueKind.True)
            {
                if (solutions != null && solutions.Length > 0 && solutions[0].Length > 0) solutions[0][0][0] = -1;
                if (solution != null && solution.Length > 0) solution[0][0] = -1;
            }
        }
        if (request.TryGetProperty("certifyOnly", out flag) && flag.ValueKind == JsonValueKind.True) return new { routesAccepted = true, unchanged = before == JsonSerializer.Serialize(game.Snapshot(), Json) };
        var clock = new Clock(); JsonElement step; if (request.TryGetProperty("clockStep", out step)) clock.step = step.GetDouble();
        HintResult hint = HintSolver.Find(game, certified, Options(request), clock);
        if (request.TryGetProperty("assertNoClockRead", out flag) && flag.ValueKind == JsonValueKind.True && clock.reads != 0) throw new InvalidOperationException("Node-limited hints read a platform clock");
        if (request.TryGetProperty("repeatAndMutate", out flag) && flag.ValueKind == JsonValueKind.True && hint != null)
        {
            string expected = JsonSerializer.Serialize(hint, Json); hint.pair[0] = -1; if (hint.continuation != null && hint.continuation.Length > 0) hint.continuation[0][0] = -1;
            clock.reads = 0; hint = HintSolver.Find(game, certified, Options(request), clock);
            if (JsonSerializer.Serialize(hint, Json) != expected) throw new InvalidOperationException("A returned hint mutated the source route or game");
        }
        if (before != JsonSerializer.Serialize(game.Snapshot(), Json)) throw new InvalidOperationException("Hint search mutated gameplay");
        var answer = new Dictionary<string, object> { { "hint", hint }, { "unchanged", true }, { "snapshot", game.Snapshot() } };
        if (request.TryGetProperty("playSuggested", out flag) && flag.ValueKind == JsonValueKind.True)
        {
            if (hint == null) answer["played"] = null;
            else { SwapResult swap = game.Swap(hint.pair[0], hint.pair[1]); answer["played"] = new { ok = swap.ok, reason = swap.reason, snapshot = game.Snapshot(), status = game.Status }; }
        }
        return answer;
    }
    private static void Main()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            try { using (JsonDocument document = JsonDocument.Parse(line)) Console.WriteLine(JsonSerializer.Serialize(Execute(document.RootElement), Json)); }
            catch (Exception error) { Console.WriteLine(JsonSerializer.Serialize(new { error = true, type = error.GetType().Name }, Json)); }
        }
    }
}
