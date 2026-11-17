using System;

namespace Hexrota.Gameplay
{
    // Wire names intentionally match the existing classic-v4 JSON contract.
    [Serializable]
    public sealed class Cell
    {
        public int q;
        public int r;
        public int layers = 1;
    }

    [Serializable]
    public sealed class BlockerConfig
    {
        public string id;
        public int cell;
        public int hp;
        public string regionId;
        public bool? required;
    }
    [Serializable]
    public sealed class RegionConfig
    {
        public string id;
        public int[] cells;
        public string[] requires;
        public bool? required;
    }
    [Serializable]
    public sealed class ObstaclesConfig
    {
        public string version;
        public string activation;
        public int[] sources;
        public BlockerConfig[] blockers;
        public RegionConfig[] regions;
    }
    [Serializable]
    public sealed class BlockerHit
    {
        public string id;
        public int cell;
        public int beforeHp;
        public int hp;
    }

    [Serializable]
    public sealed class LevelConfig
    {
        // Campaign IDs are numbers; tutorial IDs are strings. The host JSON adapter
        // preserves that distinction. No gameplay rule depends on this value.
        public object id;
        public string rulesVersion = "classic-v4";
        public Cell[] cells;
        public int?[] initial;
        public int[] palette;
        public uint seed;
        public int moves;
        public int target;
        public string targetMode;
        public ObstaclesConfig obstacles;
    }

    [Serializable]
    public sealed class GameSnapshot
    {
        public int version = 4;
        public string rulesVersion = "classic-v4";
        public int?[] values;
        public int[] layers;
        public int score;
        public int movesLeft;
        public int turn;
        public uint rngState;
        public int[][] history;
        public string obstacleVersion;
        public int[] blockerHp;
        public bool[] regionOpen;
        public bool[] cellOpen;
    }

    [Serializable]
    public sealed class RefillTile
    {
        public int index;
        public int value;
        public bool forced;
        public int minMatches;
    }

    [Serializable]
    public sealed class FallTile
    {
        public int? from;
        public int to;
        public int value;
        public bool spawn;
        // Null means absent on the wire, unlike from:null which must be emitted.
        public int? spawnOrder;
        public int? spawnCount;
    }

    [Serializable]
    public sealed class GravityResult
    {
        public int?[] compacted;
        public RefillTile[] refill;
        public FallTile[] falls;
    }

    [Serializable]
    public sealed class WaveFrame
    {
        public BlockerHit[] blockerHits;
        public string[] brokenBlockers;
        public string[] openedRegions;
        public int[] openedCells;
        public int[] blockerHp;
        public bool[] regionOpen;
        public bool[] cellOpen;
        public int[] matched;
        public int?[] before;
        public int?[] after;
        public int[] layers;
        public int scoreGain;
        public int?[] compacted;
        public RefillTile[] refill;
        public FallTile[] falls;
    }

    [Serializable]
    public sealed class SwapResult
    {
        public bool ok;
        public string reason;
        public WaveFrame[] frames;
        public int scoreGain;
        public bool reshuffled;
    }
}
