using System;
using System.Collections.Generic;
using Hexrota.Catalog;
using Hexrota.Contracts;
using Hexrota.ParitySupport;
using Hexrota.Gameplay;

internal static class Program
{
    private static LevelCatalog catalog;
    private static IEnumerable<Dictionary<string, object>> Levels(object value)
    { var result = new List<Dictionary<string, object>>(); foreach (var item in Wire.List(value)) result.Add(Wire.Map(item)); return result; }
    private static object Run(object request)
    {
        string operation = Wire.String(Wire.Get(request, "operation"));
        if (operation == "loadDocuments") {
            var campaign = WireJson.Parse(Wire.String(Wire.Get(request, "campaignJson"))); var fixedTutorials = WireJson.Parse(Wire.String(Wire.Get(request, "tutorialJson"))); var packs = WireJson.Parse(Wire.String(Wire.Get(request, "variantJson")));
            var loaded = LevelCatalog.FromDocuments(campaign, packs, fixedTutorials); var originals = new List<object>(); var tutorialLevels = new List<object>(); var variants = new List<object>();
            foreach (var source in Wire.List(Wire.Get(campaign, "levels"))) { var idValue = Wire.Get(source, "id"); originals.Add(loaded.ResolveLevelWire(idValue)); foreach (var variantId in loaded.List(idValue)) variants.Add(loaded.ResolveLevelWire(idValue, variantId, loaded.CurrentVersion)); }
            foreach (var source in Wire.List(Wire.Get(fixedTutorials, "levels"))) tutorialLevels.Add(loaded.ResolveTutorial(Wire.String(Wire.Get(source, "id"))));
            return Wire.Obj("currentVersion", loaded.CurrentVersion, "originals", originals, "tutorials", tutorialLevels, "variants", variants);
        }
        if (operation == "initialize") { catalog = new LevelCatalog(Levels(Wire.Get(request, "levels")), Wire.Get(request, "packs"), Levels(Wire.Get(request, "tutorials"))); return Wire.Obj("currentVersion", catalog.CurrentVersion, "versions", catalog.Versions); }
        if (operation == "create") { var candidate = new LevelCatalog(Levels(Wire.Get(request, "levels")), Wire.Get(request, "packs")); return Wire.Obj("currentVersion", candidate.CurrentVersion, "versions", candidate.Versions); }
        object id = Wire.Get(request, "levelId");
        if (operation == "list") return Wire.Has(request, "version") ? catalog.List(id, Wire.Get(request, "version") as string) : catalog.List(id);
        if (operation == "resolve") return catalog.ResolveLevelWire(id, Wire.Has(request, "variantId") ? Wire.Get(request, "variantId") as string : LevelCatalog.LegacyVariantId, Wire.Has(request, "version") ? Wire.Get(request, "version") as string : LevelCatalog.LegacyDataVersion);
        if (operation == "start") return catalog.Start(id, Wire.Map(Wire.Get(request, "options", Wire.Obj()))).ToWire();
        if (operation == "legacyMetadata") return catalog.LegacyMetadata(id).ToWire();
        if (operation == "restore") return catalog.Restore(id, Wire.Get(request, "record"), Wire.Get(request, "metadata")).ToWire();
        if (operation == "checkpoint") return catalog.Checkpoint(Wire.Get(request, "metadata"), Wire.Get(request, "snapshot"));
        if (operation == "tutorial") return catalog.ResolveTutorial((string)id);
        if (operation == "tutorialMetadata") return catalog.TutorialMetadata((string)id, Wire.Integer(Wire.Get(request, "serial", 0L))).ToWire();
        if (operation == "restoreTutorial") return catalog.RestoreTutorial((string)id, Wire.Get(request, "snapshot"), Wire.Get(request, "metadata")).ToWire();
        if (operation == "winningRoutes") {
            var all = new List<object>();
            foreach (var groupValue in Wire.List(Wire.Get(request, "groups"))) {
                var group = Wire.Map(groupValue); object levelId = group["levelId"];
                foreach (var variantValue in Wire.List(group["variants"])) {
                    var variant = Wire.Map(variantValue); var level = catalog.ResolveLevelWire(levelId, (string)variant["id"], catalog.CurrentVersion); int index = 0;
                    foreach (var route in Wire.List(variant["solutions"])) {
                        var game = HexMatch.Replay(CatalogWire.ReadLevel(level), CatalogWire.Route(route));
                        all.Add(Wire.Obj("levelId", levelId, "variantId", variant["id"], "routeIndex", index++, "snapshot", CatalogWire.Snapshot(game.Snapshot()), "status", game.Status));
                    }
                }
            }
            return all;
        }
        if (operation == "copyIsolation") {
            var level = catalog.ResolveLevelWire(id, (string)Wire.Get(request, "variantId"), catalog.CurrentVersion); Wire.List(level["initial"])[0] = -999L;
            var start = catalog.Start(id); var first = start.LevelWire; Wire.List(first["initial"])[0] = -333L;
            return Wire.Obj("resolved", catalog.ResolveLevelWire(id, (string)Wire.Get(request, "variantId"), catalog.CurrentVersion), "started", start.LevelWire);
        }
        if (operation == "selectionRngIsolation") {
            var game = new HexMatch(CatalogWire.ReadLevel(catalog.ResolveLevelWire(id))); var before = CatalogWire.Snapshot(game.Snapshot());
            var selected = catalog.Start(id, Wire.Map(Wire.Get(request, "options", Wire.Obj()))); return Wire.Obj("before", before, "after", CatalogWire.Snapshot(game.Snapshot()), "selected", selected.ToWire());
        }
        throw new ArgumentException("Unknown catalog operation");
    }
    private static void Main()
    {
        string line;
        while ((line = Console.ReadLine()) != null) {
            try { Console.WriteLine(WireJson.Serialize(Run(WireJson.Parse(line)))); }
            catch (Exception error) { var catalogError = error as CatalogException; Console.WriteLine(WireJson.Serialize(Wire.Obj("error", true, "code", catalogError == null ? null : catalogError.Code, "message", error.Message))); }
        }
    }
}
