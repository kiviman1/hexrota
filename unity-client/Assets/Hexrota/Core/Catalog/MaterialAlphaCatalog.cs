using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;
using Hexrota.Gameplay;

namespace Hexrota.Catalog
{
    // Host storage is explicitly separate. This portable catalog owns no I/O.
    public sealed class MaterialAlphaCatalog
    {
        public const string DataVersion = "material-alpha-v1", VariantId = "materials-v1", StoragePrefix = "hexrota-material-9-14:";
        private readonly LevelCatalog classic;
        private readonly Dictionary<string, Dictionary<string, object>> registry = new Dictionary<string, Dictionary<string, object>>();
        public string CurrentVersion { get { return classic.CurrentVersion; } }
        public string[] Versions { get { return classic.Versions; } }
        private static void Fail(string message) { throw new ArgumentException(message); }
        private static bool Alpha(object id) { return CatalogWire.Integer(id, 6, 8); }
        public MaterialAlphaCatalog(LevelCatalog classic, IEnumerable<Dictionary<string, object>> levels, string currentDataVersion = null)
        {
            if (classic == null || levels == null) Fail("Invalid material alpha catalog");
            if (currentDataVersion != null && currentDataVersion != DataVersion) Fail("Unknown material alpha version");
            this.classic = classic;
            foreach (var source in levels)
            {
                if (source == null) Fail("Invalid material alpha override");
                var level = CatalogWire.CopyMap(source); object id = CatalogWire.Get(level, "id");
                if (!Alpha(id) || registry.ContainsKey(LevelCatalog.Key(id)) || !Object.Equals(CatalogWire.Get(level, "levelDataVersion"), DataVersion) || !Object.Equals(CatalogWire.Get(level, "variantId"), VariantId) || !Object.Equals(CatalogWire.Get(level, "rulesVersion"), "classic-v6")) Fail("Invalid material alpha override");
                classic.LegacyMetadata(id); LevelConfig config = CatalogWire.ReadLevel(level); HexMatch.ValidateLevel(config);
                var routes = CatalogWire.List(CatalogWire.Get(level, "solutions"));
                if (routes == null || routes.Count < 2) Fail("Material alpha requires independent winning routes");
                var openings = new HashSet<string>();
                foreach (object sourceRoute in routes)
                {
                    int[][] route = CatalogWire.Route(sourceRoute);
                    if (route.Length == 0) Fail("Invalid material alpha certificate");
                    var game = new HexMatch(config);
                    foreach (int[] pair in route) if (!game.Swap(pair[0], pair[1]).ok) Fail("Invalid material alpha certificate");
                    if (game.Status != "won") Fail("Invalid material alpha certificate");
                    int a = route[0][0], b = route[0][1]; openings.Add(Math.Min(a, b).ToString(CultureInfo.InvariantCulture) + "," + Math.Max(a, b).ToString(CultureInfo.InvariantCulture));
                }
                if (openings.Count < 2) Fail("Material alpha requires independent openings");
                registry.Add(LevelCatalog.Key(id), level);
            }
        }
        public Dictionary<string, object> ResolveLevelWire(object levelId, string variantId = LevelCatalog.LegacyVariantId, string levelDataVersion = LevelCatalog.LegacyDataVersion)
        {
            if (!Alpha(levelId)) return classic.ResolveLevelWire(levelId, variantId, levelDataVersion);
            Dictionary<string, object> level;
            if (levelDataVersion != DataVersion || variantId != VariantId || !registry.TryGetValue(LevelCatalog.Key(levelId), out level)) { Fail("Unknown material alpha version"); return null; }
            return CatalogWire.CopyMap(level);
        }
        private AttemptMetadata Sanitize(object levelId, object source)
        {
            ResolveLevelWire(levelId, CatalogWire.Get(source, "variantId") as string, CatalogWire.Get(source, "levelDataVersion") as string);
            object serial = CatalogWire.Get(source, "attemptSerial"), attemptId = CatalogWire.Get(source, "attemptId");
            if (CatalogWire.Map(source) == null || !CatalogWire.Same(CatalogWire.Get(source, "attemptVersion"), 1) || !CatalogWire.Same(CatalogWire.Get(source, "levelId"), levelId) || !CatalogWire.Integer(serial, 1) || !(attemptId is string)) Fail("Invalid material alpha attempt identity");
            long count = CatalogWire.Long(serial);
            string pattern = "\\Aa-" + Regex.Escape(CatalogWire.Text(levelId)) + "-" + count.ToString(CultureInfo.InvariantCulture) + "-[0-9a-f]{8}\\z";
            if (!Regex.IsMatch((string)attemptId, pattern)) Fail("Invalid material alpha attempt identity");
            return new AttemptMetadata(levelId, VariantId, DataVersion, (string)attemptId, count);
        }
        public AttemptStart Start(object levelId, IDictionary<string, object> options = null)
        {
            if (!Alpha(levelId)) return classic.Start(levelId, options);
            options = options ?? new Dictionary<string, object>();
            if (CatalogWire.Has(options, "levelDataVersion") && !Object.Equals(CatalogWire.Get(options, "levelDataVersion"), DataVersion)) Fail("Unknown material alpha version");
            Dictionary<string, object> level; if (!registry.TryGetValue(LevelCatalog.Key(levelId), out level)) { Fail("Unknown material alpha version"); return null; }
            object serial = CatalogWire.Get(options, "attemptSerial") ?? (object)1, seed = CatalogWire.Get(options, "selectionSeed") ?? (object)XorShift32.ZeroSeedFallback;
            if (!CatalogWire.Integer(serial, 1) || !CatalogWire.Integer(seed, 0, UInt32.MaxValue)) Fail("Invalid material alpha selection");
            uint selectionSeed = VariantSelector.RandomStep((uint)CatalogWire.Long(seed)); long count = CatalogWire.Long(serial);
            var metadata = new AttemptMetadata(levelId, VariantId, DataVersion, "a-" + CatalogWire.Text(levelId) + "-" + count.ToString(CultureInfo.InvariantCulture) + "-" + selectionSeed.ToString("x8", CultureInfo.InvariantCulture), count);
            return new AttemptStart(metadata, level, selectionSeed);
        }
        public AttemptCheckpoint Restore(object levelId, object record, object metadata = null)
        {
            if (!Alpha(levelId)) return classic.Restore(levelId, record, metadata);
            object snapshot = record, identity = metadata;
            if (CatalogWire.Has(record, "attemptVersion"))
            {
                if (metadata != null) Fail("Duplicate attempt identity"); snapshot = CatalogWire.Get(record, "snapshot"); identity = record;
            }
            var clean = Sanitize(levelId, identity); var level = ResolveLevelWire(levelId, clean.variantId, clean.levelDataVersion);
            if (snapshot == null) Fail("Missing material alpha checkpoint");
            var game = new HexMatch(CatalogWire.ReadLevel(level), CatalogWire.ReadSnapshot(snapshot));
            return new AttemptCheckpoint(clean, level, game, false);
        }
        public Dictionary<string, object> Checkpoint(object metadata, object source)
        {
            object id = CatalogWire.Get(metadata, "levelId");
            var game = source as HexMatch; var typedSnapshot = source as GameSnapshot; object snapshot = game != null ? CatalogWire.Snapshot(game.Snapshot()) : typedSnapshot != null ? CatalogWire.Snapshot(typedSnapshot) : source;
            if (!Alpha(id)) return classic.Checkpoint(metadata, snapshot);
            return Restore(id, snapshot, metadata).Envelope();
        }
        public string[] List(object levelId)
        {
            if (!Alpha(levelId)) return classic.List(levelId);
            if (!registry.ContainsKey(LevelCatalog.Key(levelId))) { Fail("Unknown material alpha version"); return null; }
            return new[] { VariantId };
        }
        public string[] List(object levelId, string levelDataVersion)
        {
            if (!Alpha(levelId)) return classic.List(levelId, levelDataVersion);
            if (!registry.ContainsKey(LevelCatalog.Key(levelId)) || levelDataVersion != null && levelDataVersion != DataVersion) { Fail("Unknown material alpha version"); return null; }
            return new[] { VariantId };
        }
        public AttemptMetadata LegacyMetadata(object levelId)
        {
            if (Alpha(levelId)) Fail("Material alpha has no legacy identity"); return classic.LegacyMetadata(levelId);
        }
    }
}
