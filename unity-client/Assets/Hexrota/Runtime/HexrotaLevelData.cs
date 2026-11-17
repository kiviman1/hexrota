using System;
using Hexrota.Gameplay;

namespace Hexrota.Client
{
    // Unity JsonUtility-friendly transport. Gameplay rules remain in Hexrota.Gameplay.
    [Serializable]
    public sealed class HexrotaVariantData
    {
        public string id;
        public int[] initial;
        public uint seed;
    }

    [Serializable]
    public sealed class HexrotaLevelData
    {
        public int schemaVersion;
        public string rulesVersion;
        public string levelDataVersion;
        public int levelId;
        public string name;
        public Cell[] cells;
        public int[] palette;
        public int moves;
        public int target;
        public string targetMode;
        public HexrotaVariantData[] variants;

        public LevelConfig Resolve(string variantId)
        {
            if (schemaVersion != 1 || rulesVersion != "classic-v4" || levelId < 1 ||
                cells == null || cells.Length == 0 || palette == null || palette.Length == 0 ||
                variants == null || variants.Length == 0 || String.IsNullOrEmpty(levelDataVersion))
                throw new ArgumentException("Invalid Unity level document");

            HexrotaVariantData found = null;
            foreach (HexrotaVariantData candidate in variants)
                if (candidate != null && candidate.id == variantId) { found = candidate; break; }

            if (found == null || found.initial == null || found.initial.Length != cells.Length)
                throw new ArgumentException("Unknown Unity level variant");

            var values = new int?[found.initial.Length];
            for (int i = 0; i < values.Length; i++) values[i] = found.initial[i];
            var copyCells = new Cell[cells.Length];
            for (int i = 0; i < cells.Length; i++)
            {
                if (cells[i] == null) throw new ArgumentException("Invalid Unity cell");
                copyCells[i] = new Cell { q = cells[i].q, r = cells[i].r, layers = cells[i].layers };
            }
            return new LevelConfig {
                id = levelId, rulesVersion = rulesVersion, cells = copyCells,
                initial = values, palette = (int[])palette.Clone(), seed = found.seed,
                moves = moves, target = target, targetMode = targetMode
            };
        }
    }
}
