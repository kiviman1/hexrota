using System;
using System.Collections.Generic;
using Hexrota.Story;
using Hexrota.Contracts;
using Hexrota.ParitySupport;
using W = Hexrota.Contracts.Wire;

internal static class Program
{
    private static object Observed(object content, object state) { return W.Obj("snapshot", StoryEngine.Snapshot(state), "active", StoryEngine.Active(content, state)); }
    private static object Run(object request)
    {
        string operation = W.Get(request, "operation", "scenario") as string; object content = W.Get(request, "content");
        if (operation == "validate") return StoryEngine.ValidateContent(content);
        if (operation == "bindings") return Hexrota.StoryAdapter.StoryBindings.Validate(content, W.Get(request, "levels"));
        if (operation == "facts") return Hexrota.StoryAdapter.CanonicalStoryFacts.Facts(W.Get(request, "level"), W.Get(request, "metadata"), W.Get(request, "snapshot"));
        if (operation == "context") return Hexrota.StoryAdapter.CanonicalStoryFacts.Context(content, W.Get(request, "metadata"));
        object context = W.Get(request, "context"), state = StoryEngine.Create(content, context);
        var rows = new List<object> { W.Obj("after", Observed(content, state)) };
        foreach (object step in W.List(W.Get(request, "steps")))
        {
            object result = null; bool error = false; object prior = state; string before = WireJson.Serialize(state);
            try
            {
                string op = W.String(W.Get(step, "op"));
                if (op == "observe") state = StoryEngine.Observe(content, state, W.Get(step, "facts"));
                else if (op == "ack")
                {
                    object skipped = W.Get(step, "skipped", false); if (!(skipped is bool)) throw new ArgumentException("invalid_story_contract");
                    state = StoryEngine.Acknowledge(content, state, W.String(W.Get(step, "instanceId")), (bool)skipped);
                }
                else if (op == "choice") state = StoryEngine.Choose(content, state, W.String(W.Get(step, "instanceId")), W.String(W.Get(step, "choiceId")));
                else if (op == "restore") state = StoryEngine.Restore(content, W.Get(step, "snapshot"), W.Get(step, "context", context), W.Get(step, "facts"));
                else if (op == "snapshot") result = StoryEngine.Snapshot(state);
                else if (op == "snapshot-isolation") { result = StoryEngine.Snapshot(state); var disposable = W.Map(StoryEngine.Snapshot(state)); disposable["cursor"] = -999; W.List(disposable["events"]).Clear(); }
                else if (op == "active") result = StoryEngine.Active(content, state);
                else throw new ArgumentException("Unknown story test step");
            }
            catch { error = true; }
            if (WireJson.Serialize(prior) != before) throw new InvalidOperationException("Story input mutated");
            rows.Add(W.Obj("error", error, "result", result, "after", Observed(content, state), "stateUnchanged", WireJson.Serialize(state) == before));
        }
        return rows;
    }
    private static void Main()
    {
        string line; while ((line = Console.ReadLine()) != null)
        {
            try { Console.WriteLine(WireJson.Serialize(Run(WireJson.Parse(line)))); }
            catch { Console.WriteLine(WireJson.Serialize(W.Obj("error", true))); }
        }
    }
}
