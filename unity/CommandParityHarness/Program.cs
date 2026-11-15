using System;
using System.Collections.Generic;
using Hexrota.Contracts;
using Hexrota.Catalog;
using Hexrota.Commands;
using Hexrota.ParitySupport;

internal static class Program
{
    private static object Observed(AssistedGame game)
    {
        return Wire.Obj("snapshot", game.Snapshot(), "status", game.Status, "covered", game.Covered, "remainingLayers", game.RemainingLayers);
    }
    private static object Execute(object request)
    {
        var level = CatalogWire.ReadLevel(Wire.Required(request, "level")); string attempt = Wire.String(Wire.Required(request, "attemptId"));
        var game = new AssistedGame(level, attempt, Wire.Get(request, "limits"), Wire.Get(request, "snapshot"));
        var initial = Observed(game); var steps = new List<object>();
        foreach (object step in Wire.List(Wire.Required(request, "steps")))
        {
            string op = Wire.String(Wire.Required(step, "op")); object before = game.Snapshot(), output;
            if (op == "apply") output = game.Apply(Wire.Get(step, "command"));
            else if (op == "preview")
            {
                output = game.Preview(Wire.Get(step, "command"));
                if (!Wire.Equal(before, game.Snapshot())) throw new InvalidOperationException("Preview mutated the original");
            }
            else if (op == "resume")
            {
                try
                {
                    game = new AssistedGame(level, Wire.Has(step, "attemptId") ? Wire.String(Wire.Get(step, "attemptId")) : attempt, Wire.Get(step, "limits"), Wire.Has(step, "snapshot") ? Wire.Get(step, "snapshot") : game.Snapshot()); output = Wire.Obj("restored", true);
                }
                catch (ArgumentException) { output = Wire.Obj("error", true); }
            }
            else if (op == "clone")
            {
                AssistedGame copy = game.Clone(); output = Wire.Obj("result", copy.Apply(Wire.Get(step, "command")), "copy", Observed(copy));
                if (!Wire.Equal(before, game.Snapshot())) throw new InvalidOperationException("Clone mutated the original");
            }
            else if (op == "classic")
            {
                try { output = game.ClassicSnapshot(); } catch (InvalidOperationException) { output = Wire.Obj("error", true); }
            }
            else throw new ArgumentException("Unknown command test operation");
            steps.Add(Wire.Obj("result", output, "after", Observed(game)));
        }
        return Wire.Obj("initial", initial, "steps", steps);
    }
    private static void Main()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            try { Console.WriteLine(WireJson.Serialize(Execute(WireJson.Parse(line)))); }
            catch (ArgumentException) { Console.WriteLine(WireJson.Serialize(Wire.Obj("error", true))); }
        }
    }
}
