using System;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Application;
using Hexrota.Catalog;
using Hexrota.Lives;
using Hexrota.ParitySupport;
using W = Hexrota.Contracts.Wire;

internal sealed class OnboardingClock : IUtcClock { public long NowUtcMilliseconds() { return 1700000000000L; } }

internal static class Program
{
    private static void Main()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            try
            {
                var input = W.Map(WireJson.Parse(line));
                var before = W.Copy(input);
                object result = Run(input);
                if (!W.Equal(input, before)) throw new Exception("The input was mutated");
                Console.WriteLine(WireJson.Serialize(result));
            }
            catch (Exception) { Console.WriteLine("{\"error\":true}"); }
        }
    }
    private static object Run(Dictionary<string, object> input)
    {
        switch ((string)input["operation"])
        {
            case "validate": return OnboardingPolicy.Validate(W.Get(input, "value"));
            case "normalize": return OnboardingPolicy.Normalize(W.Get(input, "value"), W.Get(input, "options"), W.Has(input, "value"));
            case "isV2": return OnboardingPolicy.IsV2(W.Get(input, "value"));
            case "rules": return OnboardingPolicy.Rules(W.Get(input, "value"));
            case "requiresAcknowledgement": return OnboardingPolicy.RequiresAcknowledgement(W.Get(input, "value"), W.Get(input, "step"));
            case "project": return OnboardingPolicy.Project(W.Get(input, "value"), W.Get(input, "request"));
            case "defaults": return SaveMigration.Defaults();
            case "normalizeGame":
                return SaveMigration.NormalizeGame(W.Get(input, "raw"), W.List(input["levels"]).Select(W.Map).ToList(), W.Int32(input["tutorialCount"]), (string)W.Get(input, "sourceKey", ProfileRepository.GameKey));
            case "copyIsolation":
                var value = W.Get(input, "value");
                var copy = OnboardingPolicy.Validate(value);
                copy["version"] = "changed";
                var rules = OnboardingPolicy.Rules(value);
                rules["feedbackMs"] = -1;
                return W.Obj("value", W.Clone(value), "validated", OnboardingPolicy.Validate(value), "rules", OnboardingPolicy.Rules(value));
            case "session": return Session(input);
            default: throw new Exception("Unknown operation");
        }
    }
    private static object Session(Dictionary<string, object> input)
    {
        var tutorials = W.List(input["tutorials"]).Select(W.Map).ToList();
        var campaign = W.List(input["campaign"]).Select(W.Map).ToList();
        var catalog = new LevelCatalog(campaign, input["variants"], tutorials);
        var levels = tutorials.Concat(campaign).ToList();
        var storage = new MemoryProfileStorage();
        storage.SeedPresent(ProfileRepository.GameKey, input["raw"]);
        GameSessionController controller = null;
        var rows = W.Arr();
        foreach (object raw in W.List(input["commands"]))
        {
            var command = W.Map(raw); object result;
            switch ((string)command["op"])
            {
                case "boot":
                    controller = new GameSessionController(catalog, levels, tutorials.Count, new ProfileRepository(storage), W.Map(input["lifeConfig"]), new OnboardingClock(), 4303818U, "onboarding-test", null, null, W.Map(input["economyConfig"]));
                    result = true; break;
                case "enter": result = controller.Enter(W.Int32(command["stage"]), true, "replay", true); break;
                case "swap":
                    var pair = W.List(command["pair"]); result = controller.Swap(W.Int32(pair[0]), W.Int32(pair[1])); break;
                case "ack": result = controller.AcknowledgeTutorial(); break;
                case "reset": result = controller.ResetProgress(true); break;
                case "failWrites": storage.FailProfileWrites = W.Equal(command["value"], true); result = true; break;
                default: throw new Exception("Unknown session command");
            }
            rows.Add(W.Obj("result", result, "game", controller.GameSave, "view", controller.View(), "wallet", controller.EconomyView, "energy", controller.EnergySave));
        }
        return rows;
    }
}
