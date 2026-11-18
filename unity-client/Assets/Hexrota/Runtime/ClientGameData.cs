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
        internal Dictionary<string, object> CoopCounters { get; private set; }
        public RewardRules RewardRules { get; private set; }
        public static ClientGameData Load(Func<string, string> read)
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
            var levels = fixedLevels.Concat(W.List(W.Required(campaign, "levels")).Select(W.Map)).ToList();
            return new ClientGameData {
                Catalog = LevelCatalog.FromDocuments(campaign, variants, tutorials),
                Levels = levels, TutorialCount = fixedLevels.Count,
                TutorialCopy = W.Map(WireJsonCodec.Parse(required("HexrotaData/tutorial-coach"))),
                CoopCounters = W.List(W.Required(WireJsonCodec.Parse(required("HexrotaData/scene-config-v1")), "tutorials"))
                    .ToDictionary(item => (string)W.Required(item,"levelId"), item => item),
                LifeConfig = W.Map(WireJsonCodec.Parse(required("HexrotaData/lives-config"))),
                EconomyConfig = W.Map(WireJsonCodec.Parse(required("HexrotaData/economy-config-9-5"))),
                RewardRules = Newtonsoft.Json.JsonConvert.DeserializeObject<RewardRules>(required("HexrotaData/reward-rules"))
            };
        }
        public static ClientGameData FromResources()
        {
            return Load(path => {
                var asset = Resources.Load<TextAsset>(path);
                if (asset == null) throw new InvalidOperationException("Missing canonical game data: " + path);
                return asset.text;
            });
        }
    }
}
