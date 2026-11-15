// Generated from data/economy-config-9-5.json; run node sync-economy-config.cjs.
using System.Collections.Generic;
using W = Hexrota.Contracts.Wire;
namespace Hexrota.Economy
{
    public static class EconomyDefaults
    {
        public static Dictionary<string, object> Create() { return W.Obj("schemaVersion", 1, "rulesVersion", "economy-v1", "pricesVersion", "economy-9-5-v1", "campaignId", "main", "levelIds", W.Arr(1, 2, 3, 4, 5, 6, 7, 8, 9, 10), "tutorialIds", W.Arr("learn-1", "learn-2"), "tutorialCount", 2, "reward", W.Obj("gold", 20, "stars", 1), "inventory", W.Obj("greenBrush", W.Obj("unlockAfterLevelId", 3, "gift", 3, "costGold", 70, "maxPerAttempt", 1), "colorKey", W.Obj("unlockAfterLevelId", 6, "gift", 3, "costGold", 90, "maxPerAttempt", 1)), "rescue", W.Obj("moves", 5, "goldCost", 140, "dailyAdLimit", 2, "maxPerAttempt", 1), "botanical", W.Arr(W.Obj("stars", 2, "id", "flowers"), W.Obj("stars", 5, "id", "plants"), W.Obj("stars", 8, "id", "trees"), W.Obj("stars", 10, "id", "complete"))); }
    }
}
