using System;
using System.Collections.Generic;

namespace Hexrota.Gameplay
{
    // Pure classic-v4 rules. The host supplies configurations and handles all I/O.
    public sealed class HexMatch
    {
        public readonly LevelConfig level;
        public readonly BoardTopology topology;
        public int?[] values;
        public int[] layers;
        public int score;
        public int movesLeft;
        public int turn;
        public uint rngState;
        public List<int[]> history;
        public int[][] neighbors { get { return topology.neighbors; } }

        public HexMatch(LevelConfig level, GameSnapshot snapshot = null)
            : this(level, BoardTopology.For(level), true)
        {
            if (snapshot != null) Restore(snapshot);
        }

        private HexMatch(LevelConfig level, BoardTopology topology, bool initialize)
        {
            this.level = level; this.topology = topology;
            if (initialize) Reset();
        }

        private static T[] Duplicate<T>(T[] source) { return (T[])source.Clone(); }
        private static int GroundLayers(Cell cell) { return cell.layers == 0 ? 1 : cell.layers; }

        public void Reset()
        {
            if (level.initial == null || level.initial.Length != level.cells.Length || level.palette == null || level.palette.Length == 0)
                throw new ArgumentException("A level requires initial values and a nonempty palette");
            values = Duplicate(level.initial); layers = new int[level.cells.Length];
            for (int i = 0; i < layers.Length; i++) layers[i] = GroundLayers(level.cells[i]);
            score = 0; movesLeft = level.moves; turn = 0;
            rngState = XorShift32.InitialState(level.seed); history = new List<int[]>();
        }

        public int Total { get { return values.Length; } }
        public int Covered
        {
            get { int count = 0; foreach (int left in layers) if (left == 0) count++; return count; }
        }
        public int RemainingLayers
        {
            get { int count = 0; foreach (int left in layers) count += left; return count; }
        }
        public string Status
        {
            get
            {
                bool scoreMet = level.targetMode == "exact" ? score == level.target : score >= level.target;
                if (Covered == Total && scoreMet) return "won";
                if (movesLeft <= 0 || (level.targetMode == "exact" && score > level.target)) return "lost";
                return "playing";
            }
        }

        public bool Adjacent(int a, int b)
        {
            if (a < 0 || a >= neighbors.Length) return false;
            foreach (int index in neighbors[a]) if (index == b) return true;
            return false;
        }
        public uint Random() { rngState = XorShift32.Next(rngState); return rngState; }
        public int Number() { return level.palette[(int)(Random() % (uint)level.palette.Length)]; }

        public int[] FindMatches(int?[] source = null)
        {
            source = source ?? values;
            var marked = new SortedSet<int>();
            foreach (int[] line in topology.lines)
            {
                int start = 0;
                for (int j = 1; j <= line.Length; j++)
                {
                    if (j < line.Length && source[line[j]].HasValue && source[line[j]] == source[line[start]]) continue;
                    if (source[line[start]].HasValue && j - start >= 3)
                        for (int k = start; k < j; k++) marked.Add(line[k]);
                    start = j;
                }
            }
            var result = new int[marked.Count]; marked.CopyTo(result); return result;
        }
        private void Exchange(int a, int b)
        {
            int? value = values[a]; values[a] = values[b]; values[b] = value;
        }
        public List<int[]> LegalMoves()
        {
            var moves = new List<int[]>();
            foreach (int[] pair in topology.pairs)
            {
                int a = pair[0], b = pair[1];
                if (values[a] == values[b]) continue;
                Exchange(a, b); int[] matched = FindMatches(); Exchange(a, b);
                if (matched.Length != 0) moves.Add(new[] { a, b });
            }
            return moves;
        }
        public int NewMatchesAt(int index, int value, int?[] source = null)
        {
            source = source ?? values; int count = 0;
            foreach (int[] triple in topology.triples[index])
            {
                bool all = true;
                foreach (int i in triple) if (i != index && source[i] != value) { all = false; break; }
                if (all) count++;
            }
            return count;
        }
        public RefillTile[] FillVacancies()
        {
            var refill = new List<RefillTile>();
            foreach (int[] column in topology.columns)
                foreach (int index in column)
                {
                    if (values[index].HasValue) continue;
                    int minimum = int.MaxValue;
                    var choices = new List<int>();
                    foreach (int value in level.palette)
                    {
                        int count = NewMatchesAt(index, value);
                        if (count < minimum) { minimum = count; choices.Clear(); choices.Add(value); }
                        else if (count == minimum) choices.Add(value);
                    }
                    int chosen = choices[(int)(Random() % (uint)choices.Count)];
                    values[index] = chosen;
                    refill.Add(new RefillTile { index = index, value = chosen, forced = minimum > 0, minMatches = minimum });
                }
            return refill.ToArray();
        }
        public GravityResult Gravity(int[] matched)
        {
            var removed = new HashSet<int>(matched);
            var falls = new List<FallTile>();
            var spawnOrders = new Dictionary<int, int[]>();
            foreach (int[] column in topology.columns)
            {
                var survivors = new List<int>();
                foreach (int index in column) if (!removed.Contains(index)) survivors.Add(index);
                int missing = column.Length - survivors.Count;
                var next = new int?[column.Length];
                for (int j = 0; j < survivors.Count; j++)
                {
                    int from = survivors[j], to = column[missing + j]; int? value = values[from];
                    next[missing + j] = value;
                    if (from != to)
                        falls.Add(new FallTile { from = from, to = to, value = value.Value, spawn = false });
                }
                for (int j = 0; j < missing; j++) spawnOrders[column[j]] = new[] { j, missing };
                for (int j = 0; j < column.Length; j++) values[column[j]] = next[j];
            }
            int?[] compacted = Duplicate(values);
            RefillTile[] refill = FillVacancies();
            foreach (RefillTile tile in refill)
            {
                int[] order = spawnOrders[tile.index];
                falls.Add(new FallTile { from = null, to = tile.index, value = tile.value, spawn = true, spawnOrder = order[0], spawnCount = order[1] });
            }
            return new GravityResult { compacted = compacted, refill = refill, falls = falls.ToArray() };
        }
        public bool StableBoard()
        {
            for (int attempt = 0; attempt < 64; attempt++)
            {
                values = new int?[values.Length]; FillVacancies();
                if (FindMatches().Length == 0 && LegalMoves().Count != 0) return true;
            }
            int[,] coefficients = { { 1, 2 }, { 2, 1 }, { 1, -1 } };
            for (int c = 0; c < 3; c++)
                for (int offset = 0; offset < 4; offset++)
                {
                    values = new int?[level.cells.Length];
                    for (int i = 0; i < values.Length; i++)
                    {
                        Cell cell = level.cells[i];
                        int normalized = ((coefficients[c, 0] * cell.q + coefficients[c, 1] * cell.r + offset) % 4 + 4) % 4;
                        int paletteIndex = normalized / 2;
                        values[i] = paletteIndex < level.palette.Length ? (int?)level.palette[paletteIndex] : null;
                    }
                    if (FindMatches().Length == 0 && LegalMoves().Count != 0) return true;
                }
            throw new InvalidOperationException("This board shape cannot provide a settled legal swap");
        }
        public bool EnsurePlayable()
        {
            if (LegalMoves().Count != 0) return false;
            int?[] original = Duplicate(values);
            for (int attempt = 0; attempt < 128; attempt++)
            {
                values = Duplicate(original);
                for (int i = values.Length - 1; i > 0; i--)
                {
                    int j = (int)(Random() % (uint)(i + 1)); Exchange(i, j);
                }
                if (FindMatches().Length == 0 && LegalMoves().Count != 0) return true;
            }
            StableBoard(); return true;
        }
        private static SwapResult Invalid(string reason)
        {
            return new SwapResult { ok = false, reason = reason, frames = new WaveFrame[0], scoreGain = 0, reshuffled = false };
        }
        public SwapResult Swap(int a, int b)
        {
            string status = Status;
            if (status != "playing") return Invalid(status);
            if (!Adjacent(a, b)) return Invalid("neighbor");
            Exchange(a, b); int[] matched = FindMatches();
            if (matched.Length == 0) { Exchange(a, b); return Invalid("no-match"); }
            movesLeft--; turn++; history.Add(new[] { a, b });
            var frames = new List<WaveFrame>(); int totalGain = 0; bool safetyReset = false;
            while (matched.Length != 0)
            {
                int?[] before = Duplicate(values); int gain = 0;
                foreach (int index in matched) gain += values[index].Value;
                foreach (int index in matched) layers[index] = Math.Max(0, layers[index] - 1);
                score += gain; totalGain += gain; GravityResult refill = Gravity(matched);
                frames.Add(new WaveFrame { matched = Duplicate(matched), before = before, after = Duplicate(values), layers = Duplicate(layers), scoreGain = gain, compacted = refill.compacted, refill = refill.refill, falls = refill.falls });
                matched = FindMatches();
                if (frames.Count >= 32 && matched.Length != 0) { StableBoard(); safetyReset = true; break; }
            }
            bool reshuffled = Status == "playing" ? EnsurePlayable() : false;
            reshuffled = reshuffled || safetyReset;
            return new SwapResult { ok = true, reason = null, frames = frames.ToArray(), scoreGain = totalGain, reshuffled = reshuffled };
        }
        public GameSnapshot Snapshot()
        {
            var route = new int[history.Count][];
            for (int i = 0; i < route.Length; i++) route[i] = Duplicate(history[i]);
            return new GameSnapshot { values = Duplicate(values), layers = Duplicate(layers), score = score, movesLeft = movesLeft, turn = turn, rngState = rngState, history = route };
        }
        public HexMatch Clone()
        {
            var clone = new HexMatch(level, topology, false);
            clone.values = Duplicate(values); clone.layers = Duplicate(layers);
            clone.score = score; clone.movesLeft = movesLeft; clone.turn = turn; clone.rngState = rngState;
            clone.history = new List<int[]>(history.Count);
            foreach (int[] pair in history) clone.history.Add(Duplicate(pair));
            return clone;
        }
        public static HexMatch Replay(LevelConfig level, int[][] route)
        {
            if (route == null) throw new ArgumentException("A replay requires a move history");
            var replay = new HexMatch(level);
            foreach (int[] pair in route)
                if (pair == null || pair.Length != 2 || !replay.Swap(pair[0], pair[1]).ok)
                    throw new ArgumentException("Invalid checkpoint history");
            return replay;
        }
        public void Restore(GameSnapshot snapshot)
        {
            int n = Total;
            if (snapshot == null || snapshot.version != 4 || snapshot.rulesVersion != "classic-v4" || snapshot.values == null || snapshot.values.Length != n || snapshot.layers == null || snapshot.layers.Length != n || snapshot.score < 0 || snapshot.movesLeft < 0 || snapshot.movesLeft > level.moves || snapshot.turn != level.moves - snapshot.movesLeft || snapshot.rngState == 0 || snapshot.history == null || snapshot.history.Length != snapshot.turn)
                throw new ArgumentException("Invalid match-three checkpoint");
            for (int i = 0; i < n; i++)
            {
                if (!snapshot.values[i].HasValue || Array.IndexOf(level.palette, snapshot.values[i].Value) < 0 || snapshot.layers[i] < 0 || snapshot.layers[i] > GroundLayers(level.cells[i]))
                    throw new ArgumentException("Invalid match-three checkpoint");
            }
            foreach (int[] pair in snapshot.history)
                if (pair == null || pair.Length != 2 || !Adjacent(pair[0], pair[1]))
                    throw new ArgumentException("Invalid match-three checkpoint");
            if (FindMatches(snapshot.values).Length != 0) throw new ArgumentException("Invalid match-three checkpoint");
            HexMatch replay = Replay(level, snapshot.history);
            bool same = replay.score == snapshot.score && replay.movesLeft == snapshot.movesLeft && replay.turn == snapshot.turn && replay.rngState == snapshot.rngState;
            for (int i = 0; i < n && same; i++) same = replay.values[i] == snapshot.values[i] && replay.layers[i] == snapshot.layers[i];
            if (!same) throw new ArgumentException("Checkpoint does not match its history");
            values = replay.values; layers = replay.layers; score = replay.score;
            movesLeft = replay.movesLeft; turn = replay.turn; rngState = replay.rngState; history = replay.history;
        }
    }
}
