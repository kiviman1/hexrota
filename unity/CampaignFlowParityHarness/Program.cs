using System;
using System.Collections.Generic;
using Hexrota.Catalog;
using Hexrota.Contracts;
using Hexrota.ParitySupport;
using Hexrota.Gameplay;

internal static class Program
{
    private static LevelCatalog classic;
    private static CampaignFlowCatalog flow;
    private static IEnumerable<Dictionary<string, object>> Levels(object value)
    { var result = new List<Dictionary<string, object>>(); foreach (var item in Wire.List(value)) result.Add(Wire.Map(item)); return result; }
    private static object Run(object request)
    {
        string operation = Wire.String(Wire.Get(request, "operation"));
        if (operation == "initialize")
        {
            classic = new LevelCatalog(Levels(Wire.Get(request, "levels")), Wire.Get(request, "packs"));
            flow = new CampaignFlowCatalog(classic, Levels(Wire.Get(request, "overrides")), Wire.Get(request, "currentVersion") as string);
            return Wire.Obj("currentVersion", flow.CurrentVersion, "versions", flow.Versions);
        }
        if (operation == "create") { new CampaignFlowCatalog(classic, Levels(Wire.Get(request, "overrides")), Wire.Get(request, "currentVersion") as string); return Wire.Obj("ok", true); }
        object id = Wire.Get(request, "levelId");
        if (operation == "start") return flow.Start(id, Wire.Map(Wire.Get(request, "options", Wire.Obj()))).ToWire();
        if (operation == "classicStart") return classic.Start(id, Wire.Map(Wire.Get(request, "options", Wire.Obj()))).ToWire();
        if (operation == "list") return Wire.Has(request, "version") ? flow.List(id, Wire.Get(request, "version") as string) : flow.List(id);
        if (operation == "resolve") return flow.ResolveLevelWire(id, Wire.Has(request, "variantId") ? Wire.Get(request, "variantId") as string : LevelCatalog.LegacyVariantId, Wire.Has(request, "version") ? Wire.Get(request, "version") as string : LevelCatalog.LegacyDataVersion);
        if (operation == "legacyMetadata") return flow.LegacyMetadata(id).ToWire();
        if (operation == "restore") return flow.Restore(id, Wire.Get(request, "record"), Wire.Get(request, "metadata")).ToWire();
        if (operation == "checkpoint") return flow.Checkpoint(Wire.Get(request, "metadata"), Wire.Get(request, "snapshot"));
        if (operation == "classicRestore") return classic.Restore(id, Wire.Get(request, "record"), Wire.Get(request, "metadata")).ToWire();
        if (operation == "route")
        {
            var selected = flow.Start(id, Wire.Map(Wire.Get(request, "options", Wire.Obj()))); var game = new HexMatch(CatalogWire.ReadLevel(selected.LevelWire));
            var checkpoints = new List<object>();
            foreach (int[] pair in CatalogWire.Route(Wire.Get(request, "route")))
            {
                if (!game.Swap(pair[0], pair[1]).ok) throw new ArgumentException("Invalid route step");
                var envelope = flow.Checkpoint(selected.Metadata.ToWire(), game);
                var resumed = flow.Restore(id, envelope);
                checkpoints.Add(Wire.Obj("envelope", envelope, "restored", resumed.ToWire(), "status", resumed.Game.Status));
            }
            return checkpoints;
        }
        if (operation == "copyIsolation")
        {
            var level = flow.ResolveLevelWire(id, CampaignFlowCatalog.VariantId, CampaignFlowCatalog.DataVersion); Wire.List(level["initial"])[0] = -999L;
            var selected = flow.Start(id); var returned = selected.LevelWire; Wire.List(returned["initial"])[0] = -100L;
            return Wire.Obj("resolved", flow.ResolveLevelWire(id, CampaignFlowCatalog.VariantId, CampaignFlowCatalog.DataVersion), "selected", selected.LevelWire);
        }
        throw new ArgumentException("Unknown campaign flow operation");
    }
    private static void Main()
    {
        string line; while ((line = Console.ReadLine()) != null)
        {
            try { Console.WriteLine(WireJson.Serialize(Run(WireJson.Parse(line)))); }
            catch (Exception error) { Console.WriteLine(WireJson.Serialize(Wire.Obj("error", true, "message", error.Message))); }
        }
    }
}
