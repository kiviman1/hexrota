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
        private readonly LevelCatalog classic;
        private readonly Dictionary<string, Dictionary<string, object>> overrides = new Dictionary<string, Dictionary<string, object>>();
        public string CurrentVersion { get { return classic.CurrentVersion; } }
        public string[] Versions { get { return classic.Versions; } }

        private static void Fail(string message) { throw new ArgumentException(message); }
        private bool IsFlow(object levelId) { return overrides.ContainsKey(LevelCatalog.Key(levelId)); }
        private static bool NumericInteger(object value)
        {
            return CatalogWire.Number(value) && !Double.IsInfinity(Convert.ToDouble(value, CultureInfo.InvariantCulture)) && !Double.IsNaN(Convert.ToDouble(value, CultureInfo.InvariantCulture)) && Math.Truncate(Convert.ToDouble(value, CultureInfo.InvariantCulture)) == Convert.ToDouble(value, CultureInfo.InvariantCulture);
        }
        public CampaignFlowCatalog(LevelCatalog classic, IEnumerable<Dictionary<string, object>> levels)
        {
            if (classic == null || levels == null) throw new ArgumentException("Invalid campaign flow override");
            this.classic = classic;
            foreach (var source in levels)
            {
                var level = CatalogWire.CopyMap(source); object id = CatalogWire.Get(level, "id");
                if (!NumericInteger(id) || IsFlow(id) || !Object.Equals(CatalogWire.Get(level, "levelDataVersion"), DataVersion) || !Object.Equals(CatalogWire.Get(level, "variantId"), VariantId) || !Object.Equals(CatalogWire.Get(level, "rulesVersion"), "classic-v5")) Fail("Invalid campaign flow override");
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
                overrides.Add(LevelCatalog.Key(id), level);
            }
        }
        public Dictionary<string, object> ResolveLevelWire(object levelId, string variantId = LevelCatalog.LegacyVariantId, string levelDataVersion = LevelCatalog.LegacyDataVersion)
        {
            if (!IsFlow(levelId)) return classic.ResolveLevelWire(levelId, variantId, levelDataVersion);
            if (variantId != VariantId || levelDataVersion != DataVersion) Fail("Unknown flow campaign version");
            return CatalogWire.CopyMap(overrides[LevelCatalog.Key(levelId)]);
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
            if (CatalogWire.Has(options, "levelDataVersion") && !Object.Equals(CatalogWire.Get(options, "levelDataVersion"), DataVersion)) Fail("Unknown flow campaign version");
            object serial = CatalogWire.Get(options, "attemptSerial") ?? (object)1, seed = CatalogWire.Get(options, "selectionSeed") ?? (object)XorShift32.ZeroSeedFallback;
            if (!CatalogWire.Integer(serial, 1) || !CatalogWire.Integer(seed, 0, UInt32.MaxValue)) Fail("Invalid flow attempt selection");
            uint selectionSeed = VariantSelector.RandomStep((uint)CatalogWire.Long(seed)); long count = CatalogWire.Long(serial);
            var metadata = new AttemptMetadata(levelId, VariantId, DataVersion, "a-" + CatalogWire.Text(levelId) + "-" + count.ToString(CultureInfo.InvariantCulture) + "-" + selectionSeed.ToString("x8", CultureInfo.InvariantCulture), count);
            return new AttemptStart(metadata, overrides[LevelCatalog.Key(levelId)], selectionSeed);
        }
        public AttemptCheckpoint Restore(object levelId, object record, object metadata = null)
        {
            if (!IsFlow(levelId)) return classic.Restore(levelId, record, metadata);
            object snapshot = record, identity = metadata;
            if (CatalogWire.Has(record, "attemptVersion"))
            {
                if (metadata != null) Fail("Duplicate attempt identity");
                identity = record; snapshot = CatalogWire.Get(record, "snapshot");
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
            if (!IsFlow(id)) return classic.Checkpoint(metadata, snapshot);
            return Restore(id, snapshot, metadata).Envelope();
        }
        public string[] List(object levelId) { return IsFlow(levelId) ? new[] { VariantId } : classic.List(levelId); }
        public string[] List(object levelId, string levelDataVersion)
        {
            if (!IsFlow(levelId)) return classic.List(levelId, levelDataVersion);
            if (levelDataVersion != null && levelDataVersion != DataVersion) Fail("Unknown flow campaign version");
            return new[] { VariantId };
        }
        public AttemptMetadata LegacyMetadata(object levelId)
        {
            if (IsFlow(levelId)) Fail("Flow campaign has no legacy identity");
            return classic.LegacyMetadata(levelId);
        }
    }
}
