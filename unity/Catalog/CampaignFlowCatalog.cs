using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;
using Hexrota.Gameplay;

namespace Hexrota.Catalog
{
    // Explicit review-scope overlay. The underlying archived catalog and all
    // existing identities remain available independently and are never rewritten.
    public sealed class CampaignFlowCatalog
    {
        public const string DataVersion = "campaign-flow-v1", VariantId = "flow-v1";
        public const string LargeDataVersion = "campaign-flow-v2", LargeVariantId = "flow-v2";
        private readonly LevelCatalog classic;
        private readonly Dictionary<string, Dictionary<string, Dictionary<string, object>>> archives = new Dictionary<string, Dictionary<string, Dictionary<string, object>>>();
        private readonly Dictionary<string, Dictionary<string, object>> current = new Dictionary<string, Dictionary<string, object>>();
        public string CurrentVersion { get { return classic.CurrentVersion; } }
        public string[] Versions { get { return classic.Versions; } }

        private static void Fail(string message) { throw new ArgumentException(message); }
        private bool IsFlow(object levelId) { return archives.ContainsKey(LevelCatalog.Key(levelId)); }
        private bool IsCurrentFlow(object levelId) { return current.ContainsKey(LevelCatalog.Key(levelId)); }
        private bool ClassicAllowed(object levelId) { return !IsFlow(levelId) || !archives[LevelCatalog.Key(levelId)].ContainsKey(DataVersion); }
        private static bool IsFlowVersion(object value) { return Object.Equals(value, DataVersion) || Object.Equals(value, LargeDataVersion); }
        private static bool NumericInteger(object value)
        {
            return CatalogWire.Number(value) && !Double.IsInfinity(Convert.ToDouble(value, CultureInfo.InvariantCulture)) && !Double.IsNaN(Convert.ToDouble(value, CultureInfo.InvariantCulture)) && Math.Truncate(Convert.ToDouble(value, CultureInfo.InvariantCulture)) == Convert.ToDouble(value, CultureInfo.InvariantCulture);
        }
        public CampaignFlowCatalog(LevelCatalog classic, IEnumerable<Dictionary<string, object>> levels, string currentDataVersion = null)
        {
            if (classic == null || levels == null) throw new ArgumentException("Invalid campaign flow override");
            if (currentDataVersion != null && currentDataVersion != DataVersion && currentDataVersion != LargeDataVersion) Fail("Unknown flow campaign version");
            this.classic = classic;
            foreach (var source in levels)
            {
                var level = CatalogWire.CopyMap(source); object id = CatalogWire.Get(level, "id");
                string version = CatalogWire.Get(level, "levelDataVersion") as string, variant = CatalogWire.Get(level, "variantId") as string;
                bool identity = version == DataVersion ? variant == VariantId : version == LargeDataVersion && variant == LargeVariantId;
                Dictionary<string, Dictionary<string, object>> versions;
                if (!NumericInteger(id) || !identity || (archives.TryGetValue(LevelCatalog.Key(id), out versions) && versions.ContainsKey(version)) || !Object.Equals(CatalogWire.Get(level, "rulesVersion"), "classic-v5")) Fail("Invalid campaign flow override");
                classic.LegacyMetadata(id);
                LevelConfig config = CatalogWire.ReadLevel(level); HexMatch.ValidateLevel(config);
                var routes = CatalogWire.List(CatalogWire.Get(level, "solutions"));
                if (routes == null || routes.Count < 2) Fail("Flow campaign requires independent winning routes");
                var openings = new HashSet<string>();
                foreach (var sourceRoute in routes)
                {
                    int[][] route;
                    try { route = CatalogWire.Route(sourceRoute); }
                    catch (ArgumentException) { Fail("Invalid campaign flow certificate"); throw; }
                    if (route.Length == 0) Fail("Invalid campaign flow certificate");
                    var game = new HexMatch(config);
                    foreach (int[] pair in route) if (!game.Swap(pair[0], pair[1]).ok) Fail("Invalid campaign flow certificate");
                    if (game.Status != "won") Fail("Invalid campaign flow certificate");
                    int a = route[0][0], b = route[0][1]; openings.Add(Math.Min(a, b).ToString(CultureInfo.InvariantCulture) + "," + Math.Max(a, b).ToString(CultureInfo.InvariantCulture));
                }
                if (openings.Count < 2) Fail("Flow campaign requires independent openings");
                string key = LevelCatalog.Key(id);
                if (!archives.TryGetValue(key, out versions)) { versions = new Dictionary<string, Dictionary<string, object>>(); archives.Add(key, versions); }
                versions.Add(version, level);
                Dictionary<string, object> selected;
                if (!current.TryGetValue(key, out selected) || (version == LargeDataVersion && !Object.Equals(CatalogWire.Get(selected, "levelDataVersion"), LargeDataVersion))) current[key] = level;
            }
            if (currentDataVersion != null)
                foreach (var entry in archives)
                {
                    Dictionary<string, object> selected;
                    if (entry.Value.TryGetValue(currentDataVersion, out selected)) current[entry.Key] = selected;
                    else current.Remove(entry.Key);
                }
        }
        public Dictionary<string, object> ResolveLevelWire(object levelId, string variantId = LevelCatalog.LegacyVariantId, string levelDataVersion = LevelCatalog.LegacyDataVersion)
        {
            if (!IsFlow(levelId)) return classic.ResolveLevelWire(levelId, variantId, levelDataVersion);
            if (ClassicAllowed(levelId) && !IsFlowVersion(levelDataVersion)) return classic.ResolveLevelWire(levelId, variantId, levelDataVersion);
            Dictionary<string, object> level;
            if (levelDataVersion == null || !archives[LevelCatalog.Key(levelId)].TryGetValue(levelDataVersion, out level) || !Object.Equals(CatalogWire.Get(level, "variantId"), variantId)) { Fail("Unknown flow campaign version"); return null; }
            return CatalogWire.CopyMap(level);
        }
        private AttemptMetadata Sanitize(object levelId, object source)
        {
            string variant = CatalogWire.Get(source, "variantId") as string, version = CatalogWire.Get(source, "levelDataVersion") as string;
            ResolveLevelWire(levelId, variant, version);
            object serial = CatalogWire.Get(source, "attemptSerial"), attemptId = CatalogWire.Get(source, "attemptId");
            if (CatalogWire.Map(source) == null || !CatalogWire.Same(CatalogWire.Get(source, "attemptVersion"), 1) || !CatalogWire.Same(CatalogWire.Get(source, "levelId"), levelId) || !CatalogWire.Integer(serial, 1) || !(attemptId is string)) Fail("Invalid flow attempt identity");
            long count = CatalogWire.Long(serial);
            string pattern = "\\Aa-" + Regex.Escape(CatalogWire.Text(levelId)) + "-" + count.ToString(CultureInfo.InvariantCulture) + "-[0-9a-f]{8}\\z";
            if (!Regex.IsMatch((string)attemptId, pattern)) Fail("Invalid flow attempt identity");
            return new AttemptMetadata(levelId, variant, version, (string)attemptId, count);
        }
        public AttemptStart Start(object levelId, IDictionary<string, object> options = null)
        {
            if (!IsFlow(levelId)) return classic.Start(levelId, options);
            options = options ?? new Dictionary<string, object>();
            if (!CatalogWire.Has(options, "levelDataVersion") && !IsCurrentFlow(levelId)) return classic.Start(levelId, options);
            if (CatalogWire.Has(options, "levelDataVersion") && !IsFlowVersion(CatalogWire.Get(options, "levelDataVersion")) && ClassicAllowed(levelId)) return classic.Start(levelId, options);
            Dictionary<string, object> level = null;
            if (CatalogWire.Has(options, "levelDataVersion"))
            {
                string version = CatalogWire.Get(options, "levelDataVersion") as string;
                if (version == null || !archives[LevelCatalog.Key(levelId)].TryGetValue(version, out level)) Fail("Unknown flow campaign version");
            }
            else level = current[LevelCatalog.Key(levelId)];
            object serial = CatalogWire.Get(options, "attemptSerial") ?? (object)1, seed = CatalogWire.Get(options, "selectionSeed") ?? (object)XorShift32.ZeroSeedFallback;
            if (!CatalogWire.Integer(serial, 1) || !CatalogWire.Integer(seed, 0, UInt32.MaxValue)) Fail("Invalid flow attempt selection");
            uint selectionSeed = VariantSelector.RandomStep((uint)CatalogWire.Long(seed)); long count = CatalogWire.Long(serial);
            var metadata = new AttemptMetadata(levelId, (string)level["variantId"], (string)level["levelDataVersion"], "a-" + CatalogWire.Text(levelId) + "-" + count.ToString(CultureInfo.InvariantCulture) + "-" + selectionSeed.ToString("x8", CultureInfo.InvariantCulture), count);
            return new AttemptStart(metadata, level, selectionSeed);
        }
        public AttemptCheckpoint Restore(object levelId, object record, object metadata = null)
        {
            if (!IsFlow(levelId)) return classic.Restore(levelId, record, metadata);
            object snapshot = record, identity = CatalogWire.Has(record, "attemptVersion") ? record : metadata;
            if (ClassicAllowed(levelId) && !IsFlowVersion(CatalogWire.Get(identity, "levelDataVersion"))) return classic.Restore(levelId, record, metadata);
            if (CatalogWire.Has(record, "attemptVersion"))
            {
                if (metadata != null) Fail("Duplicate attempt identity");
                snapshot = CatalogWire.Get(record, "snapshot");
            }
            var clean = Sanitize(levelId, identity); var level = ResolveLevelWire(levelId, clean.variantId, clean.levelDataVersion);
            if (snapshot == null) Fail("Missing flow checkpoint");
            var game = new HexMatch(CatalogWire.ReadLevel(level), CatalogWire.ReadSnapshot(snapshot));
            return new AttemptCheckpoint(clean, level, game, false);
        }
        public Dictionary<string, object> Checkpoint(object metadata, object source)
        {
            var game = source as HexMatch; object snapshot = game == null ? source : CatalogWire.Snapshot(game.Snapshot());
            object id = CatalogWire.Get(metadata, "levelId");
            if (!IsFlow(id) || (ClassicAllowed(id) && !IsFlowVersion(CatalogWire.Get(metadata, "levelDataVersion")))) return classic.Checkpoint(metadata, snapshot);
            return Restore(id, snapshot, metadata).Envelope();
        }
        public string[] List(object levelId) { return IsCurrentFlow(levelId) ? new[] { (string)current[LevelCatalog.Key(levelId)]["variantId"] } : classic.List(levelId); }
        public string[] List(object levelId, string levelDataVersion)
        {
            if (!IsFlow(levelId)) return classic.List(levelId, levelDataVersion);
            if (levelDataVersion == null) return List(levelId);
            if (ClassicAllowed(levelId) && !IsFlowVersion(levelDataVersion)) return classic.List(levelId, levelDataVersion);
            Dictionary<string, object> level;
            if (!archives[LevelCatalog.Key(levelId)].TryGetValue(levelDataVersion, out level)) { Fail("Unknown flow campaign version"); return null; }
            return new[] { (string)level["variantId"] };
        }
        public AttemptMetadata LegacyMetadata(object levelId)
        {
            if (!ClassicAllowed(levelId)) Fail("Flow campaign has no legacy identity");
            return classic.LegacyMetadata(levelId);
        }
    }
}
