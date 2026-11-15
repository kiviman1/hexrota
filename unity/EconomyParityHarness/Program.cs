using System;
using System.Collections.Generic;
using Hexrota.Contracts;
using Hexrota.Economy;
using Hexrota.ParitySupport;
using W = Hexrota.Contracts.Wire;

internal static class Program
{
    private static object Error(Exception error) { var wire = error as WireException; return W.Obj("error", wire == null ? error.Message : wire.Code); }
    private static void Main()
    {
        string line; while ((line = Console.ReadLine()) != null) try { Console.WriteLine(WireJson.Serialize(Run(W.Map(WireJson.Parse(line))))); } catch (Exception error) { Console.WriteLine(WireJson.Serialize(Error(error))); }
    }
    private static object Run(Dictionary<string, object> input)
    {
        var manager = new EconomyManager(W.Has(input, "config") && input["config"] != null ? W.Map(input["config"]) : null);
        object state = W.Get(input, "state"); var results = W.Arr();
        foreach (object raw in W.List(input["commands"]))
        {
            var command = W.Map(raw); object result;
            try
            {
                string operation = (string)command["op"];
                if (operation == "create") { result = manager.CreateState(); state = result; }
                else if (operation == "restore") { result = manager.Restore(W.Has(command, "state") ? command["state"] : state); state = result; }
                else if (operation == "validate") result = manager.Validate(W.Has(command, "state") ? command["state"] : state);
                else if (operation == "migrate") { result = manager.Migrate(state, W.Has(command, "legacy") ? W.Map(command["legacy"]) : null); state = W.Get(result, "state"); }
                else if (operation == "complete") { result = manager.Complete(state, W.Map(command["context"])); state = W.Get(result, "state"); }
                else if (operation == "canEnter") result = manager.CanEnter(state, command["levelId"]);
                else if (operation == "nextLevel") result = manager.NextLevel(state);
                else if (operation == "view") result = manager.View(state);
                else if (operation == "purchase") { result = manager.Purchase(state, W.Map(command["context"])); state = W.Get(result, "state"); }
                else if (operation == "consume") { result = manager.Consume(state, W.Map(command["context"])); state = W.Get(result, "state"); }
                else if (operation == "spendRescue") { result = manager.SpendRescue(state, W.Map(command["context"])); state = W.Get(result, "state"); }
                else if (operation == "getTransaction") result = manager.GetTransaction(state, command["id"]);
                else if (operation == "config") result = manager.Config();
                else throw new Exception("unknown_economy_operation");
            }
            catch (Exception error) { result = Error(error); }
            results.Add(W.Obj("result", result, "state", W.Clone(state)));
        }
        return results;
    }
}
