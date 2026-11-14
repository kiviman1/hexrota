using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using Hexrota.Gameplay;
using Hexrota.Rewards;
using Hexrota.RewardAdapterCore;
using Hexrota.ParitySupport;

internal static class Program
{
    private static readonly JsonSerializerOptions Json = new JsonSerializerOptions
    {
        IncludeFields = true,
        PropertyNameCaseInsensitive = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never
    };

    private static JsonElement Required(JsonElement root, string name, JsonValueKind kind)
    {
        JsonElement result;
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty(name, out result) || result.ValueKind != kind)
            throw new ArgumentException("Invalid required JSON field: " + name);
        return result;
    }
    private static T Read<T>(JsonElement value) { return JsonSerializer.Deserialize<T>(value.GetRawText(), Json); }
    private static object Snapshot(HexMatch game)
    {
        return new { snapshot = game.Snapshot(), status = game.Status, covered = game.Covered, remainingLayers = game.RemainingLayers };
    }
    private static int[][] History(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Null || value.ValueKind == JsonValueKind.False ||
            value.ValueKind == JsonValueKind.Number && value.GetDouble() == 0 ||
            value.ValueKind == JsonValueKind.String && value.GetString() == "") return null;
        if (value.ValueKind != JsonValueKind.Array) throw new ArgumentException("Invalid reward history");
        var route = new List<int[]>();
        foreach (JsonElement pair in value.EnumerateArray())
        {
            if (pair.ValueKind != JsonValueKind.Array || pair.GetArrayLength() < 2)
                throw new ArgumentException("Reward history contains an invalid swap");
            var entries = new List<int>();
            foreach (JsonElement index in pair.EnumerateArray())
            {
                if (entries.Count == 2) break;
                int number;
                if (index.ValueKind != JsonValueKind.Number || !index.TryGetInt32(out number))
                    throw new ArgumentException("Reward history contains an invalid swap");
                entries.Add(number);
            }
            route.Add(entries.ToArray());
        }
        return route.ToArray();
    }
    private static GameSnapshot HistorySnapshot(JsonElement root)
    {
        JsonElement snapshot, history;
        if (!root.TryGetProperty("snapshot", out snapshot) || snapshot.ValueKind == JsonValueKind.Null)
            return null;
        if (snapshot.ValueKind != JsonValueKind.Object) throw new ArgumentException("Invalid reward snapshot");
        return new GameSnapshot { history = snapshot.TryGetProperty("history", out history) ? History(history) : null };
    }
    private static object Execute(JsonElement root)
    {
        string operation = Required(root, "operation", JsonValueKind.String).GetString();
        JsonElement wireLevel = Required(root, "level", JsonValueKind.Object);
        LevelConfig level = Read<LevelConfig>(wireLevel);
        level.id = WireJson.Read(Required(wireLevel, "id", wireLevel.GetProperty("id").ValueKind));
        JsonElement kind;
        bool tutorial = wireLevel.TryGetProperty("kind", out kind) && kind.ValueKind == JsonValueKind.String && kind.GetString() == "tutorial";
        JsonElement identity;
        string attemptId = root.TryGetProperty("attemptId", out identity) ? identity.GetString() : Convert.ToString(level.id, System.Globalization.CultureInfo.InvariantCulture);
        if (operation == "runs")
        {
            WaveFrame frame = Read<WaveFrame>(Required(root, "frame", JsonValueKind.Object));
            return RewardAdapter.RunsFor(level, frame);
        }
        if (operation == "summary")
        {
            JsonElement result, ok;
            if (!root.TryGetProperty("result", out result) || result.ValueKind == JsonValueKind.Null ||
                result.ValueKind == JsonValueKind.Object && (!result.TryGetProperty("ok", out ok) || ok.ValueKind == JsonValueKind.False))
                return RewardAdapter.Summarize(level, null, null, null, attemptId, tutorial);
            GameSnapshot before = Read<GameSnapshot>(Required(root, "before", JsonValueKind.Object));
            SwapResult mechanic = Read<SwapResult>(result);
            string levelBefore = JsonSerializer.Serialize(level, Json), beforeBefore = JsonSerializer.Serialize(before, Json), mechanicBefore = JsonSerializer.Serialize(mechanic, Json);
            RewardInput input = RewardAdapter.Summarize(level, before, mechanic, null, attemptId, tutorial);
            if (levelBefore != JsonSerializer.Serialize(level, Json) || beforeBefore != JsonSerializer.Serialize(before, Json) || mechanicBefore != JsonSerializer.Serialize(mechanic, Json)) throw new Exception("Summary mutated inputs");
            return input;
        }
        RewardRules rules = Read<RewardRules>(Required(root, "rules", JsonValueKind.Object));
        if (operation == "restore")
        {
            GameSnapshot snapshot = HistorySnapshot(root);
            string before = JsonSerializer.Serialize(snapshot, Json);
            RewardRestoreResult restored = RewardAdapter.Restore(level, snapshot, rules, attemptId, tutorial);
            if (before != JsonSerializer.Serialize(snapshot, Json)) throw new Exception("Restore mutated snapshot history");
            return restored;
        }
        if (operation != "route") throw new ArgumentException("Unknown reward adapter operation");
        int[][] route = History(Required(root, "history", JsonValueKind.Array));
        HexMatch game = new HexMatch(level);
        RewardState state = RewardDirector.CreateState(attemptId);
        var steps = new List<object>();
        foreach (int[] pair in route)
        {
            GameSnapshot before = game.Snapshot();
            SwapResult result = game.Swap(pair[0], pair[1]);
            if (!result.ok) throw new ArgumentException("Reward history contains an invalid swap");
            string immutable = JsonSerializer.Serialize(new object[] { level, before, result, game.Snapshot(), state, rules }, Json);
            RewardInput input = RewardAdapter.Summarize(level, before, result, game, attemptId, tutorial);
            RewardResult evaluated = RewardDirector.Evaluate(input, state, rules);
            if (immutable != JsonSerializer.Serialize(new object[] { level, before, result, game.Snapshot(), state, rules }, Json)) throw new Exception("Adapter/director mutated mechanic inputs");
            state = evaluated.nextState;
            RewardRestoreResult restored = RewardAdapter.Restore(level, game.Snapshot(), rules, attemptId, tutorial);
            RewardInput fallback = RewardAdapter.Summarize(level, before, result, null, attemptId, tutorial);
            steps.Add(new { input = input, fallbackInput = fallback, evaluated = evaluated, restored = restored, after = Snapshot(game) });
        }
        return new { steps = steps, finalRestore = RewardAdapter.Restore(level, game.Snapshot(), rules, attemptId, tutorial), final = Snapshot(game) };
    }
    private static void Main()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            if (String.IsNullOrWhiteSpace(line)) continue;
            try
            {
                using (JsonDocument document = JsonDocument.Parse(line)) Console.WriteLine(JsonSerializer.Serialize(Execute(document.RootElement), Json));
            }
            catch (Exception error)
            {
                Console.WriteLine(JsonSerializer.Serialize(new { error = true, message = error.Message }, Json));
            }
        }
    }
}
