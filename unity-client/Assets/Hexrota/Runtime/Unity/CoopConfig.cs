using System;
using System.Linq;
using UnityEngine;

namespace Hexrota.UnityClient
{
    // Unity-side source of the coop values. It only carries data: the rules live in the plain C#
    // CoopRules/CoopLedger (Runtime), which the .NET runtime host compiles without UnityEngine.
    // Costs and arrivals are edited here, never in code.
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

        public CoopRules ToRules()
        {
            return new CoopRules((areas ?? new Area[0]).Select(area => new CoopRules.Area(area.id,
                (area.upgrades ?? new Upgrade[0]).Select(u => new CoopRules.Upgrade(u.cost, u.chickens)))));
        }

        public static CoopConfig Load() => Resources.Load<CoopConfig>(ResourcePath);

        /// <summary>Rules from the shipped asset, or null (coop disabled) when the asset is missing.</summary>
        public static CoopRules LoadRules()
        {
            var config = Load();
            return config != null ? config.ToRules() : null;
        }
    }
}
