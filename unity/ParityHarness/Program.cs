using System;
using System.Text.Json;
using System.Text.Json.Serialization;
using Hexrota.Rewards;

internal sealed class HarnessRequest
{
    public RewardInput input = null;
    public RewardState state = null;
    public RewardRules rules = null;
}

internal sealed class HarnessError
{
    public bool error = true;
    public string errorType;
    public string message;
}

internal static class Program
{
    private static readonly JsonSerializerOptions Json = new JsonSerializerOptions
    {
        IncludeFields = true,
        PropertyNameCaseInsensitive = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never
    };

    private static readonly string[] StateIntegers =
        { "version", "lastTurn", "lastScore", "lastGreen", "lastAccentTurn", "scoreMask", "groundMask" };
    private static readonly string[] RuleIntegers =
        { "version", "accentGapTurns", "crossTier", "crossThreeTier", "simultaneousTier", "groundMin", "groundPercent", "doublesMin", "doublesTier", "tutorialCap", "goalTier", "winTier" };
    private static readonly string[] RuleArrays =
        { "runThresholds", "chainThresholds", "scoreMilestones", "groundMilestones" };
    private static readonly string[] TierIntegers =
        { "scalePermille", "sparks", "rings", "pitchStep", "hapticMs" };
    private static readonly string[] InputIntegers =
        { "turn", "totalCells", "target", "scoreBefore", "scoreAfter", "greenBefore", "greenAfter", "movesLeft" };
    private static readonly string[] WaveIntegers =
        { "wave", "gain", "matched", "maxRun", "runCount", "crossAxes", "newGreen", "layersCleared", "doubleCleared", "scoreAfter", "greenAfter" };

    // Public Unity DTOs cannot distinguish an omitted numeric JSON field from 0.
    // Validate the wire shape before creating typed data; the core validates ranges.
    private static JsonElement Required(JsonElement value, string name, JsonValueKind kind)
    {
        JsonElement result;
        if (value.ValueKind != JsonValueKind.Object || !value.TryGetProperty(name, out result) || result.ValueKind != kind)
            throw new ArgumentException("Invalid or missing JSON field: " + name);
        return result;
    }

    private static int RequiredInteger(JsonElement value, string name)
    {
        int result;
        if (!Required(value, name, JsonValueKind.Number).TryGetInt32(out result))
            throw new ArgumentException("Invalid Int32 JSON field: " + name);
        return result;
    }

    private static void RequireIntegers(JsonElement value, string[] names)
    {
        foreach (string name in names) RequiredInteger(value, name);
    }

    private static T Read<T>(JsonElement value)
    {
        return JsonSerializer.Deserialize<T>(value.GetRawText(), Json);
    }

    private static HarnessRequest ReadEvaluation(JsonElement root)
    {
        JsonElement rules = Required(root, "rules", JsonValueKind.Object);
        RequireIntegers(rules, RuleIntegers);
        foreach (string name in RuleArrays)
        {
            foreach (JsonElement threshold in Required(rules, name, JsonValueKind.Array).EnumerateArray())
            {
                int number;
                if (threshold.ValueKind != JsonValueKind.Number || !threshold.TryGetInt32(out number))
                    throw new ArgumentException("Invalid integer threshold: " + name);
            }
        }
        foreach (JsonElement tier in Required(rules, "tiers", JsonValueKind.Array).EnumerateArray())
            RequireIntegers(tier, TierIntegers);

        JsonElement state = Required(root, "state", JsonValueKind.Object);
        RequireIntegers(state, StateIntegers);
        Required(state, "attemptId", JsonValueKind.String);

        JsonElement input = Required(root, "input", JsonValueKind.Object);
        string attemptId = Required(input, "attemptId", JsonValueKind.String).GetString();
        int turn = RequiredInteger(input, "turn");
        HarnessRequest result = new HarnessRequest
        {
            rules = Read<RewardRules>(rules),
            state = Read<RewardState>(state)
        };
        if (turn <= result.state.lastTurn)
        {
            // Stale input deliberately ignores the unused payload, even malformed waves.
            // Evaluate still validates rules, state, identity and turn before returning.
            result.input = new RewardInput { attemptId = attemptId, turn = turn };
            return result;
        }
        RequireIntegers(input, InputIntegers);
        JsonElement tutorial;
        if (!input.TryGetProperty("tutorial", out tutorial) ||
            (tutorial.ValueKind != JsonValueKind.True && tutorial.ValueKind != JsonValueKind.False))
            throw new ArgumentException("Invalid or missing JSON field: tutorial");
        Required(input, "status", JsonValueKind.String);
        foreach (JsonElement wave in Required(input, "waves", JsonValueKind.Array).EnumerateArray())
            RequireIntegers(wave, WaveIntegers);
        result.input = Read<RewardInput>(input);
        return result;
    }

    private static void Main()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            if (String.IsNullOrWhiteSpace(line)) continue;
            try
            {
                using (JsonDocument document = JsonDocument.Parse(line))
                {
                    JsonElement root = document.RootElement;
                    JsonElement operation;
                    if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("operation", out operation))
                    {
                        if (operation.ValueKind != JsonValueKind.String) throw new ArgumentException("Invalid operation.");
                        if (operation.GetString() == "createState")
                        {
                            string attemptId = Required(root, "attemptId", JsonValueKind.String).GetString();
                            Console.WriteLine(JsonSerializer.Serialize(RewardDirector.CreateState(attemptId), Json));
                            continue;
                        }
                        if (operation.GetString() != "evaluate") throw new ArgumentException("Unknown operation.");
                    }
                    HarnessRequest request = ReadEvaluation(root);
                    string before = JsonSerializer.Serialize(request, Json);
                    RewardResult result = RewardDirector.Evaluate(request.input, request.state, request.rules);
                    if (!String.Equals(before, JsonSerializer.Serialize(request, Json), StringComparison.Ordinal))
                        throw new InvalidOperationException("RewardDirector mutated request data.");
                    Console.WriteLine(JsonSerializer.Serialize(result, Json));
                }
            }
            catch (Exception error)
            {
                Console.WriteLine(JsonSerializer.Serialize(new HarnessError
                {
                    errorType = error.GetType().Name,
                    message = error.Message
                }, Json));
            }
        }
    }
}
