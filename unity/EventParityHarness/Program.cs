using System;
using Hexrota.Application;
using Hexrota.ParitySupport;
using W = Hexrota.Contracts.Wire;

// Host-only JSONL runner. Domain validation is performed by the actual pure
// GameEventTracker methods, including malformed raw JSON inputs.
internal static class Program
{
    private static object Execute(object input)
    {
        string operation = W.String(W.Get(input, "operation"));
        switch (operation)
        {
            case "create":
                return W.Has(input, "options") ? GameEventTracker.CreateStateRaw(W.Get(input, "options")) : GameEventTracker.CreateState();
            case "validate": return GameEventTracker.Validate(W.Get(input, "value"));
            case "validateState": return GameEventTracker.ValidateState(W.Get(input, "value"));
            case "append":
                return GameEventTracker.AppendRaw(W.Get(input, "state"), W.Get(input, "name"), W.Get(input, "context"), W.Get(input, "details"), W.Has(input, "details"));
            default: throw new ArgumentException("Unknown event parity operation");
        }
    }

    public static void Main()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            object request = WireJson.Parse(line), baseline = W.Clone(request), response;
            try { response = W.Obj("result", Execute(request), "inputUnchanged", W.Equal(request, baseline)); }
            catch (Exception error) { response = W.Obj("error", true, "message", error.Message, "inputUnchanged", W.Equal(request, baseline)); }
            Console.WriteLine(WireJson.Serialize(response));
        }
    }
}
