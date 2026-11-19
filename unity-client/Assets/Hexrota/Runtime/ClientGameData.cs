using System;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Catalog;
using Hexrota.Rewards;
using UnityEngine;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    // Only JSON decoding belongs to the platform. Validation/resolution stays in the catalog.
    public sealed class ClientGameData
    {
        public LevelCatalog Catalog { get; private set; }
        public IList<Dictionary<string, object>> Levels { get; private set; }
        public int TutorialCount { get; private set; }
        public Dictionary<string, object> LifeConfig { get; private set; }
        public Dictionary<string, object> EconomyConfig { get; private set; }
        internal Dictionary<string, object> TutorialCopy { get; private set; }
        internal Dictionary<string, object> ArchivedOpeningSolutions { get; private set; }
        internal Dictionary<string, object> CoopCounters { get; private set; }
        public RewardRules RewardRules { get; private set; }
        public static ClientGameData Load(Func<string, string> read, bool useLargeCampaign = true)
        {
            if (read == null) throw new ArgumentNullException("read");
            Func<string, string> required = path => {
                string json = read(path);
                if (string.IsNullOrWhiteSpace(json)) throw new InvalidOperationException("Missing canonical game data: " + path);
                return json;
            };
            var campaign = WireJsonCodec.Parse(required("HexrotaData/levels-original"));
            var tutorials = WireJsonCodec.Parse(required("HexrotaData/tutorials-fixed"));
            var variants = WireJsonCodec.Parse(required("HexrotaData/variants"));
            var fixedLevels = W.List(W.Required(tutorials, "levels")).Select(W.Map).ToList();
            var chapters = W.List(W.Required(campaign, "levels")).Select(W.Map);
            var openings = WireJsonCodec.Parse(required("HexrotaData/chapter-one-openings-v1"));
            // Both versions can restore saved games. The current mobile campaign uses
            // the teaching openings only for new attempts in the chapter covered by the pack.
            var catalog = LevelCatalog.FromDocuments(campaign, W.Arr(openings, variants), tutorials,
                useLargeCampaign ? (string)W.Required(openings, "levelDataVersion") : null);
            if (useLargeCampaign)
            {
                var archived = W.List(W.Required(WireJsonCodec.Parse(required("HexrotaData/campaign-flow-levels-v1")), "levels")).Select(W.Map);
                var current = W.List(W.Required(WireJsonCodec.Parse(required("HexrotaData/campaign-flow-levels-v2")), "levels")).Select(W.Map).ToList();
                catalog = catalog.WithCampaignFlow(archived.Concat(current));
                var overrides = current.ToDictionary(level => W.Int32(level["id"]));
                chapters = chapters.Select(level => overrides.TryGetValue(W.Int32(level["id"]), out var layout) ? layout : level);
            }
            return new ClientGameData {
                Catalog = catalog, ArchivedOpeningSolutions = W.Map(W.Required(openings, "archivedOpeningSolutions")),
                Levels = fixedLevels.Concat(chapters).ToList(), TutorialCount = fixedLevels.Count,
                TutorialCopy = W.Map(WireJsonCodec.Parse(required("HexrotaData/tutorial-coach"))),
                CoopCounters = W.List(W.Required(WireJsonCodec.Parse(required("HexrotaData/scene-config-v1")), "tutorials"))
                    .ToDictionary(item => (string)W.Required(item,"levelId"), item => item),
                LifeConfig = W.Map(WireJsonCodec.Parse(required("HexrotaData/lives-config"))),
                EconomyConfig = W.Map(WireJsonCodec.Parse(required("HexrotaData/economy-config-9-5"))),
                RewardRules = Newtonsoft.Json.JsonConvert.DeserializeObject<RewardRules>(required("HexrotaData/reward-rules"))
            };
        }
        public static ClientGameData FromResources(bool useLargeCampaign = true)
        {
            return Load(path => {
                var asset = Resources.Load<TextAsset>(path);
                if (asset == null) throw new InvalidOperationException("Missing canonical game data: " + path);
                return asset.text;
            }, useLargeCampaign);
        }
    }
}
