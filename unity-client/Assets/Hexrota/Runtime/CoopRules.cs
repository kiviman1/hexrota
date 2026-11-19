using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Hexrota.UnityClient
{
    // Coop progression values as plain C# (no UnityEngine), so the .NET runtime host compiles and
    // tests the rules too. The Unity side builds this from the CoopConfig asset.
    public sealed class CoopRules
    {
        public sealed class Upgrade
        {
            /// <summary>Golden Eggs spent on this upgrade.</summary>
            public int Cost { get; private set; }
            /// <summary>New residents that arrive when this upgrade is built.</summary>
            public int Chickens { get; private set; }

            public Upgrade(int cost, int chickens)
            {
                if (cost < 1) throw new ArgumentOutOfRangeException("cost", "An upgrade costs at least one egg.");
                if (chickens < 0) throw new ArgumentOutOfRangeException("chickens");
                Cost = cost;
                Chickens = chickens;
            }
        }

        public sealed class Area
        {
            public string Id { get; private set; }
            public IList<Upgrade> Upgrades { get; private set; }

            public Area(string id, IEnumerable<Upgrade> upgrades)
            {
                if (string.IsNullOrEmpty(id)) throw new ArgumentException("An area needs an id.", "id");
                var list = new List<Upgrade>(upgrades ?? new Upgrade[0]);
                if (list.Count == 0 || list.Contains(null)) throw new ArgumentException("An area needs upgrades.", "upgrades");
                Id = id;
                Upgrades = new ReadOnlyCollection<Upgrade>(list);
            }
        }

        public IList<Area> Areas { get; private set; }

        public CoopRules(IEnumerable<Area> areas)
        {
            var list = new List<Area>(areas ?? new Area[0]);
            if (list.Count == 0 || list.Contains(null)) throw new ArgumentException("Coop rules need at least one area.", "areas");
            var ids = new HashSet<string>(StringComparer.Ordinal);
            foreach (var area in list)
                if (!ids.Add(area.Id)) throw new ArgumentException("Duplicate area id " + area.Id, "areas");
            Areas = new ReadOnlyCollection<Area>(list);
        }

        public Area First { get { return Areas[0]; } }

        public Area Find(string id)
        {
            foreach (var area in Areas)
                if (area.Id == id) return area;
            return null;
        }
    }
}
