using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;

namespace Hexrota.Gameplay
{
    public struct AxialCoordinate : IEquatable<AxialCoordinate>
    {
        public readonly int q;
        public readonly int r;
        private static readonly int[,] Offsets =
            { { 1, 0 }, { 0, 1 }, { -1, 1 }, { -1, 0 }, { 0, -1 }, { 1, -1 } };

        public AxialCoordinate(int q, int r) { this.q = q; this.r = r; }
        public AxialCoordinate Neighbor(int direction)
        {
            if (direction < 0 || direction >= 6) throw new ArgumentOutOfRangeException("direction");
            return new AxialCoordinate(checked(q + Offsets[direction, 0]), checked(r + Offsets[direction, 1]));
        }
        public bool Equals(AxialCoordinate other) { return q == other.q && r == other.r; }
        public override bool Equals(object other) { return other is AxialCoordinate && Equals((AxialCoordinate)other); }
        public override int GetHashCode() { unchecked { return (q * 397) ^ r; } }
    }

    public static class XorShift32
    {
        public const uint ZeroSeedFallback = 0x9e3779b9u;
        public static uint InitialState(uint seed) { return seed == 0 ? ZeroSeedFallback : seed; }
        public static uint Next(uint state)
        {
            unchecked
            {
                state ^= state << 13;
                state ^= state >> 17;
                state ^= state << 5;
                return state;
            }
        }
    }

    public sealed class BoardTopology
    {
        private static readonly ConditionalWeakTable<LevelConfig, BoardTopology> Cache =
            new ConditionalWeakTable<LevelConfig, BoardTopology>();
        private static readonly int[,] Directions = { { 1, 0 }, { 0, 1 }, { 1, -1 } };
        public readonly int[][] neighbors;
        public readonly int[][] pairs;
        public readonly int[][] lines;
        public readonly int[][] columns;
        public readonly int[][][] triples;

        public static BoardTopology For(LevelConfig level)
        {
            HexMatch.ValidateLevel(level);
            return Cache.GetValue(level, config => new BoardTopology(config));
        }

        private static bool TryCoordinate(Dictionary<AxialCoordinate, int> cells, long q, long r, out int index)
        {
            index = 0;
            return q >= int.MinValue && q <= int.MaxValue && r >= int.MinValue && r <= int.MaxValue && cells.TryGetValue(new AxialCoordinate((int)q, (int)r), out index);
        }

        private BoardTopology(LevelConfig level)
        {
            Cell[] cells = level.cells;
            if (cells == null) throw new ArgumentException("A level requires cells");
            var byCoordinate = new Dictionary<AxialCoordinate, int>();
            var adjacent = new List<int>[cells.Length];
            var allPairs = new List<int[]>();
            var allLines = new List<int[]>();
            for (int i = 0; i < cells.Length; i++)
            {
                if (cells[i] == null) throw new ArgumentException("A cell cannot be null");
                byCoordinate.Add(new AxialCoordinate(cells[i].q, cells[i].r), i);
                adjacent[i] = new List<int>();
            }
            // Insertion order is part of deterministic legal-move ordering.
            for (int i = 0; i < cells.Length; i++)
            {
                Cell cell = cells[i];
                for (int d = 0; d < 3; d++)
                {
                    int dq = Directions[d, 0], dr = Directions[d, 1], next;
                    if (TryCoordinate(byCoordinate, (long)cell.q + dq, (long)cell.r + dr, out next))
                    {
                        adjacent[i].Add(next); adjacent[next].Add(i);
                        allPairs.Add(new[] { i, next });
                    }
                    int previous;
                    if (TryCoordinate(byCoordinate, (long)cell.q - dq, (long)cell.r - dr, out previous)) continue;
                    var line = new List<int>();
                    long q = cell.q, r = cell.r; int index;
                    while (TryCoordinate(byCoordinate, q, r, out index))
                    {
                        line.Add(index); q += dq; r += dr;
                    }
                    if (line.Count >= 3) allLines.Add(line.ToArray());
                }
            }
            var cellTriples = new List<int[]>[cells.Length];
            for (int i = 0; i < cells.Length; i++) cellTriples[i] = new List<int[]>();
            foreach (int[] line in allLines)
                for (int j = 0; j + 2 < line.Length; j++)
                {
                    var triple = new[] { line[j], line[j + 1], line[j + 2] };
                    foreach (int index in triple) cellTriples[index].Add(triple);
                }
            var columnMap = new SortedDictionary<int, List<int>>();
            for (int i = 0; i < cells.Length; i++)
            {
                List<int> column;
                if (!columnMap.TryGetValue(cells[i].q, out column))
                {
                    column = new List<int>(); columnMap.Add(cells[i].q, column);
                }
                column.Add(i);
            }
            var allColumns = new List<int[]>();
            foreach (var entry in columnMap)
            {
                entry.Value.Sort((a, b) => cells[a].r.CompareTo(cells[b].r));
                allColumns.Add(entry.Value.ToArray());
            }
            neighbors = new int[cells.Length][]; triples = new int[cells.Length][][];
            for (int i = 0; i < cells.Length; i++)
            {
                neighbors[i] = adjacent[i].ToArray(); triples[i] = cellTriples[i].ToArray();
            }
            pairs = allPairs.ToArray(); lines = allLines.ToArray(); columns = allColumns.ToArray();
        }
    }
}
