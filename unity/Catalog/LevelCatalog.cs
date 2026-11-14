using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;
using Hexrota.Gameplay;

namespace Hexrota.Catalog
{
    public sealed class LevelCatalog
    {
        public const int AttemptVersion = 1;
        public const string LegacyVariantId = "legacy-original", LegacyDataVersion = "original-v1", TutorialDataVersion = "tutorials-v1";
        internal sealed class VariantEntry
        {
            internal readonly List<string> Order = new List<string>();
            internal readonly Dictionary<string, Dictionary<string, object>> Variants = new Dictionary<string, Dictionary<string, object>>();
            internal object Difficulty;
        }
        private readonly Dictionary<string, Dictionary<string, object>> bases = new Dictionary<string, Dictionary<string, object>>();
        private readonly Dictionary<string, Dictionary<string, object>> tutorials = new Dictionary<string, Dictionary<string, object>>();
        private readonly Dictionary<string, Dictionary<string, VariantEntry>> packs = new Dictionary<string, Dictionary<string, VariantEntry>>();
        private readonly Dictionary<string, Dictionary<string, object>> resolved = new Dictionary<string, Dictionary<string, object>>();
        private readonly List<string> versions = new List<string>();
        public string CurrentVersion { get; private set; }
        public string[] Versions { get { return versions.ToArray(); } }
        internal static void Fail(string code, string message) { throw new CatalogException(code, message); }
        private static bool Token(object value) { return value is string && Regex.IsMatch((string)value, @"\A[A-Za-z0-9_.-]{1,80}\z"); }
        private static bool ValidId(object value) { return Token(value) || CatalogWire.Integer(value, 0); }
        internal static string Key(object value) { return (value is string ? "string:" : CatalogWire.Number(value) ? "number:" : value is bool ? "boolean:" : "object:") + CatalogWire.Text(value); }
        internal static bool Truthy(object value) { return value != null && (!(value is bool) || (bool)value) && (!(value is string) || ((string)value).Length != 0) && (!CatalogWire.Number(value) || Convert.ToDouble(value) != 0); }
        public LevelCatalog(IEnumerable<Dictionary<string, object>> baseLevels, object data, IEnumerable<Dictionary<string, object>> tutorialLevels = null)
        {
            if (baseLevels == null) Fail("INVALID_CATALOG", "Campaign levels and a replay engine are required");
            foreach (var source in baseLevels) {
                var id = CatalogWire.Get(source, "id");
                if (source == null || !ValidId(id) || bases.ContainsKey(Key(id))) Fail("INVALID_CATALOG", "Level IDs must be unique");
                bases.Add(Key(id), CatalogWire.CopyMap(source));
            }
            if (tutorialLevels != null) foreach (var source in tutorialLevels) {
                var id = CatalogWire.Get(source, "id");
                if (source == null || !(id is string) || !ValidId(id) || tutorials.ContainsKey(Key(id)) || bases.ContainsKey(Key(id))) Fail("INVALID_CATALOG", "Tutorial IDs must be distinct strings");
                tutorials.Add(Key(id), CatalogWire.CopyMap(source));
            }
            IList sources = CatalogWire.List(data); if (sources == null) sources = Truthy(data) ? new object[] { data } : new object[0];
            foreach (var source in sources) {
                string version = CatalogWire.Get(source, "levelDataVersion") as string;
                var levels = CatalogWire.List(CatalogWire.Get(source, "levels"));
                if (CatalogWire.Map(source) == null || !CatalogWire.Same(CatalogWire.Get(source, "schemaVersion"), 1) || !Token(version) || version == LegacyDataVersion || packs.ContainsKey(version) || levels == null) Fail("INVALID_CATALOG", "Invalid or duplicate variant data version");
                var entries = new Dictionary<string, VariantEntry>();
                foreach (var item in levels) {
                    object id = CatalogWire.Get(item, "levelId"); Dictionary<string, object> basis;
                    var variants = CatalogWire.List(CatalogWire.Get(item, "variants"));
                    if (!bases.TryGetValue(Key(id), out basis) || entries.ContainsKey(Key(id)) || variants == null || variants.Count == 0) Fail("INVALID_CATALOG", "Variant levels must identify an existing campaign level");
                    var entry = new VariantEntry { Difficulty = Truthy(CatalogWire.Get(item, "difficulty")) ? CatalogWire.Clone(CatalogWire.Get(item, "difficulty")) : null };
                    var cells = CatalogWire.List(CatalogWire.Get(basis, "cells")); var palette = CatalogWire.List(CatalogWire.Get(basis, "palette"));
                    if (cells == null || palette == null) Fail("INVALID_CATALOG", "Campaign cells and palette are required");
                    long moves = CatalogWire.Long(CatalogWire.Get(basis, "moves"));
                    foreach (var variant in variants) {
                        string variantId = CatalogWire.Get(variant, "id") as string;
                        var initial = CatalogWire.List(CatalogWire.Get(variant, "initial")); var routes = CatalogWire.List(CatalogWire.Get(variant, "solutions"));
                        bool valid = CatalogWire.Map(variant) != null && Token(variantId) && variantId != LegacyVariantId && !entry.Variants.ContainsKey(variantId) && initial != null && initial.Count == cells.Count && CatalogWire.Integer(CatalogWire.Get(variant, "seed"), 1, UInt32.MaxValue) && routes != null && routes.Count >= 2;
                        if (valid) foreach (var value in initial) { bool found = false; foreach (var allowed in palette) if (CatalogWire.Same(value, allowed)) { found = true; break; } if (!found) { valid = false; break; } }
                        if (!valid) Fail("INVALID_CATALOG", "Invalid certified variant data");
                        var openings = new HashSet<string>();
                        foreach (var routeValue in routes) {
                            var route = CatalogWire.List(routeValue);
                            if (route == null || route.Count == 0 || route.Count > moves) Fail("INVALID_CATALOG", "Invalid certified route shape");
                            foreach (var pairValue in route) {
                                var pair = CatalogWire.List(pairValue);
                                if (pair == null || pair.Count != 2 || !CatalogWire.Integer(pair[0], 0, cells.Count - 1) || !CatalogWire.Integer(pair[1], 0, cells.Count - 1) || CatalogWire.Same(pair[0], pair[1])) Fail("INVALID_CATALOG", "Invalid certified route shape");
                            }
                            var first = CatalogWire.List(route[0]); long a = CatalogWire.Long(first[0]), b = CatalogWire.Long(first[1]); openings.Add(Math.Min(a, b).ToString(CultureInfo.InvariantCulture) + "," + Math.Max(a, b).ToString(CultureInfo.InvariantCulture));
                        }
                        if (openings.Count < 2) Fail("INVALID_CATALOG", "Certified routes require different first swaps");
                        entry.Order.Add(variantId); entry.Variants.Add(variantId, CatalogWire.CopyMap(variant));
                    }
                    entries.Add(Key(id), entry);
                }
                packs.Add(version, entries); versions.Add(version); CurrentVersion = version;
            }
        }
        public static LevelCatalog FromDocuments(object campaignDocument, object variantPacks, object tutorialDocument)
        {
            foreach (var document in new[] { campaignDocument, tutorialDocument })
                if (CatalogWire.Map(document) == null || !CatalogWire.Same(CatalogWire.Get(document, "schemaVersion"), 1) || !Object.Equals(CatalogWire.Get(document, "rulesVersion"), "classic-v4") || CatalogWire.List(CatalogWire.Get(document, "levels")) == null)
                    Fail("INVALID_CATALOG", "Invalid level configuration document");
            if (!Object.Equals(CatalogWire.Get(campaignDocument, "kind"), "campaign") || !Object.Equals(CatalogWire.Get(campaignDocument, "levelDataVersion"), LegacyDataVersion) || !Object.Equals(CatalogWire.Get(tutorialDocument, "kind"), "tutorial") || !Object.Equals(CatalogWire.Get(tutorialDocument, "levelDataVersion"), TutorialDataVersion))
                Fail("INVALID_CATALOG", "Invalid published level document identity");
            var campaign = new List<Dictionary<string, object>>(); var fixedTutorials = new List<Dictionary<string, object>>();
            foreach (var level in CatalogWire.List(CatalogWire.Get(campaignDocument, "levels"))) campaign.Add(CatalogWire.CopyMap(level));
            foreach (var level in CatalogWire.List(CatalogWire.Get(tutorialDocument, "levels"))) fixedTutorials.Add(CatalogWire.CopyMap(level));
            return new LevelCatalog(campaign, variantPacks, fixedTutorials);
        }
        private Dictionary<string, object> BaseFor(object id)
        { Dictionary<string, object> result; if (!bases.TryGetValue(Key(id), out result)) Fail("UNKNOWN_LEVEL", "Unknown campaign level"); return result; }
        internal VariantEntry VariantsFor(object id, object version)
        {
            BaseFor(id); Dictionary<string, VariantEntry> pack; var name = version as string;
            if (name == null || !packs.TryGetValue(name, out pack)) { Fail("UNKNOWN_DATA_VERSION", "The saved level data version is unavailable"); return null; }
            VariantEntry entry; if (!pack.TryGetValue(Key(id), out entry)) Fail("UNKNOWN_VARIANT", "No variants are available for this level"); return entry;
        }
        public Dictionary<string, object> ResolveLevelWire(object levelId, string variantId = LegacyVariantId, string levelDataVersion = LegacyDataVersion)
        {
            var basis = BaseFor(levelId);
            if (variantId == LegacyVariantId) {
                if (levelDataVersion != LegacyDataVersion) Fail("UNKNOWN_DATA_VERSION", "The original board requires its original data version");
                return CatalogWire.CopyMap(basis);
            }
            var entry = VariantsFor(levelId, levelDataVersion); Dictionary<string, object> variant;
            if (variantId == null || !entry.Variants.TryGetValue(variantId, out variant)) { Fail("UNKNOWN_VARIANT", "The saved board variant is unavailable"); return null; }
            string cacheKey = Key(levelId) + "/" + levelDataVersion + "/" + variantId; Dictionary<string, object> result;
            if (!resolved.TryGetValue(cacheKey, out result)) {
                result = CatalogWire.CopyMap(basis); var routes = CatalogWire.List(CatalogWire.Clone(variant["solutions"]));
                var alternative = new List<object>(); for (int i = 1; i < routes.Count; i++) alternative.Add(CatalogWire.Clone(routes[i]));
                result["initial"] = CatalogWire.Clone(variant["initial"]); result["seed"] = variant["seed"]; result["solution"] = CatalogWire.Clone(routes[0]); result["alternativeSolutions"] = alternative; result["solutions"] = CatalogWire.Clone(routes); result["variantId"] = variantId; result["levelDataVersion"] = levelDataVersion;
                object par = CatalogWire.Get(variant, "par"); if (CatalogWire.Integer(par, 1, CatalogWire.Long(basis["moves"]))) result["par"] = par;
                if (Truthy(entry.Difficulty)) result["difficulty"] = CatalogWire.Clone(entry.Difficulty);
                if (Truthy(CatalogWire.Get(variant, "difficultyMetrics"))) result["variantMetrics"] = CatalogWire.Clone(variant["difficultyMetrics"]);
                resolved.Add(cacheKey, result);
            }
            return CatalogWire.CopyMap(result);
        }
        public string[] List(object levelId) { return VariantsFor(levelId, CurrentVersion).Order.ToArray(); }
        public string[] List(object levelId, string version) { return VariantsFor(levelId, version).Order.ToArray(); }
        public AttemptMetadata LegacyMetadata(object levelId) { BaseFor(levelId); return new AttemptMetadata(levelId, LegacyVariantId, LegacyDataVersion, "legacy-" + CatalogWire.Text(levelId), 0); }
        public AttemptMetadata Sanitize(object levelId, object metadata)
        {
            object serial = CatalogWire.Get(metadata, "attemptSerial"); string variant = CatalogWire.Get(metadata, "variantId") as string, version = CatalogWire.Get(metadata, "levelDataVersion") as string, attemptId = CatalogWire.Get(metadata, "attemptId") as string;
            if (CatalogWire.Map(metadata) == null || !CatalogWire.Has(metadata, "levelId") || !CatalogWire.Same(CatalogWire.Get(metadata, "attemptVersion"), AttemptVersion) || !CatalogWire.Same(CatalogWire.Get(metadata, "levelId"), levelId) || variant == null || version == null || !CatalogWire.Integer(serial, 0) || attemptId == null || attemptId.Length > 180) Fail("INVALID_ATTEMPT", "Invalid attempt identity");
            ResolveLevelWire(levelId, variant, version); long count = CatalogWire.Long(serial); string prefix = "a-" + CatalogWire.Text(levelId) + "-" + count.ToString(CultureInfo.InvariantCulture) + "-";
            if (variant == LegacyVariantId ? count != 0 || attemptId != "legacy-" + CatalogWire.Text(levelId) : count < 1 || !attemptId.StartsWith(prefix, StringComparison.Ordinal) || !Regex.IsMatch(attemptId.Substring(prefix.Length), @"\A[0-9a-f]{8}\z")) Fail("INVALID_ATTEMPT", "Attempt ID does not match its identity");
            return new AttemptMetadata(levelId, variant, version, attemptId, count);
        }
        public AttemptStart Start(object levelId, IDictionary<string, object> options = null) { return VariantSelector.Select(this, levelId, options); }
        public AttemptCheckpoint Restore(object levelId, object record, object metadata = null)
        {
            object snapshot = record, identity = metadata;
            if (CatalogWire.Has(record, "attemptVersion")) {
                if (metadata != null) Fail("INVALID_ATTEMPT", "Attempt identity must have one source"); identity = record; snapshot = CatalogWire.Get(record, "snapshot");
            }
            var clean = identity == null ? LegacyMetadata(levelId) : Sanitize(levelId, identity); var level = ResolveLevelWire(levelId, clean.variantId, clean.levelDataVersion);
            if (CatalogWire.Map(snapshot) == null) Fail("INVALID_ATTEMPT", "An attempt requires a gameplay checkpoint");
            var game = new HexMatch(CatalogWire.ReadLevel(level), CatalogWire.ReadSnapshot(snapshot)); return new AttemptCheckpoint(clean, level, game, clean.variantId == LegacyVariantId);
        }
        public AttemptCheckpoint Restore(object levelId, GameSnapshot snapshot, AttemptMetadata metadata) { return Restore(levelId, CatalogWire.Snapshot(snapshot), metadata == null ? null : metadata.ToWire()); }
        public Dictionary<string, object> Checkpoint(object metadata, object snapshot)
        {
            var clean = Sanitize(CatalogWire.Get(metadata, "levelId"), metadata); return Restore(clean.levelId, snapshot, clean.ToWire()).Envelope();
        }
        public Dictionary<string, object> ResolveTutorial(string levelId)
        { Dictionary<string, object> level; if (!tutorials.TryGetValue(Key(levelId), out level)) Fail("UNKNOWN_LEVEL", "Unknown tutorial level"); return CatalogWire.CopyMap(level); }
        public AttemptMetadata TutorialMetadata(string levelId, long serial = 0)
        {
            ResolveTutorial(levelId); if (serial < 0 || serial > CatalogWire.MaxSafeInteger) Fail("INVALID_ATTEMPT", "Invalid attempt identity");
            return new AttemptMetadata(levelId, "fixed", TutorialDataVersion, serial == 0 ? "legacy-" + levelId : "t-" + levelId + "-" + serial.ToString(CultureInfo.InvariantCulture), serial);
        }
        public AttemptCheckpoint RestoreTutorial(string levelId, object snapshot, object metadata = null)
        {
            var level = ResolveTutorial(levelId); long serial = metadata == null ? 0 : CatalogWire.Integer(CatalogWire.Get(metadata, "attemptSerial"), 0) ? CatalogWire.Long(CatalogWire.Get(metadata, "attemptSerial")) : -1;
            var expected = TutorialMetadata(levelId, serial);
            if (metadata != null) foreach (var pair in expected.ToWire()) if (!CatalogWire.Same(CatalogWire.Get(metadata, pair.Key), pair.Value)) Fail("INVALID_ATTEMPT", "Invalid tutorial attempt identity");
            var game = new HexMatch(CatalogWire.ReadLevel(level), CatalogWire.ReadSnapshot(snapshot)); return new AttemptCheckpoint(expected, level, game, serial == 0);
        }
        public static LevelConfig GameplayConfig(object level) { return CatalogWire.ReadLevel(level); }
        public static GameSnapshot ReadSnapshot(object snapshot) { return CatalogWire.ReadSnapshot(snapshot); }
        public static Dictionary<string, object> SnapshotWire(GameSnapshot snapshot) { return CatalogWire.Snapshot(snapshot); }
    }
    public static class VariantSelector
    {
        public static uint RandomStep(uint value) { return XorShift32.Next(XorShift32.InitialState(value)); }
        public static AttemptStart Select(LevelCatalog catalog, object levelId, IDictionary<string, object> options = null)
        {
            options = options ?? new Dictionary<string, object>(); object versionValue = CatalogWire.Get(options, "levelDataVersion") ?? catalog.CurrentVersion;
            var entry = catalog.VariantsFor(levelId, versionValue); object serialValue = CatalogWire.Get(options, "attemptSerial") ?? (object)1;
            if (!CatalogWire.Integer(serialValue, 1) || CatalogWire.Has(options, "selectionSeed") && !CatalogWire.Integer(CatalogWire.Get(options, "selectionSeed"), 0, UInt32.MaxValue)) LevelCatalog.Fail("INVALID_SELECTION", "Selection needs an unsigned seed and positive attempt serial");
            long serial = CatalogWire.Long(serialValue); string previous = CatalogWire.Get(options, "previousVariantId") as string; var recent = new HashSet<string>(); var recentValues = CatalogWire.List(CatalogWire.Get(options, "recentVariantIds"));
            if (recentValues != null) foreach (var value in recentValues) if (value is string) recent.Add((string)value);
            var candidates = entry.Order.FindAll(id => id != previous && !recent.Contains(id)); if (candidates.Count == 0) candidates = entry.Order.FindAll(id => id != previous); if (candidates.Count == 0) candidates.AddRange(entry.Order);
            uint seed = RandomStep(CatalogWire.Has(options, "selectionSeed") ? (uint)CatalogWire.Long(options["selectionSeed"]) : 0x9e3779b9u); string variant = candidates[(int)(seed % (uint)candidates.Count)], version = (string)versionValue;
            var metadata = new AttemptMetadata(levelId, variant, version, "a-" + CatalogWire.Text(levelId) + "-" + serial.ToString(CultureInfo.InvariantCulture) + "-" + seed.ToString("x8", CultureInfo.InvariantCulture), serial);
            return new AttemptStart(metadata, catalog.ResolveLevelWire(levelId, variant, version), seed);
        }
    }
    public sealed class LevelDataVersionResolver
    {
        private readonly LevelCatalog catalog;
        public LevelDataVersionResolver(LevelCatalog catalog) { this.catalog = catalog ?? throw new ArgumentNullException("catalog"); }
        public string CurrentVersion { get { return catalog.CurrentVersion; } }
        public string[] PublishedVersions { get { return catalog.Versions; } }
        public Dictionary<string, object> Resolve(object levelId, string variantId, string version) { return catalog.ResolveLevelWire(levelId, variantId, version); }
    }
}
