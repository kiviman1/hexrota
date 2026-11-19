using System;
using UnityEngine;

namespace Hexrota.UnityClient
{
    // Coop progression data. Costs and arrivals live only in the asset, never in code.
    [CreateAssetMenu(menuName = "Hexrota/Coop Config")]
    public sealed class CoopConfig : ScriptableObject
    {
        public const string ResourcePath = "Coop/CoopConfig";

        [Serializable]
        public struct Upgrade
        {
            [Tooltip("Golden Eggs spent on this upgrade.")]
            [Min(1)] public int cost;
            [Tooltip("New residents that arrive when this upgrade is built.")]
            [Min(0)] public int chickens;
        }

        [Serializable]
        public sealed class Area
        {
            public string id;
            public Upgrade[] upgrades;
        }

        public Area[] areas;

        public Area First => areas != null && areas.Length > 0 ? areas[0] : null;

        public Area Find(string id)
        {
            if (areas == null) return null;
            foreach (var area in areas)
                if (area != null && area.id == id) return area;
            return null;
        }

        public static CoopConfig Load() => Resources.Load<CoopConfig>(ResourcePath);
    }
}
