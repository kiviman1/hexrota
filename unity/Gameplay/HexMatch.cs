using System;
using System.Collections.Generic;

namespace Hexrota.Gameplay
{
    // Pure classic-v4 rules. The host supplies configurations and handles all I/O.
    public sealed partial class HexMatch
    {
        public readonly LevelConfig level;
        public readonly BoardTopology topology;
        public int?[] values;
        public int[] layers;
        public int[] blockerHp;
        public bool[] regionOpen;
        public bool HasObstacles { get { return level.rulesVersion == "classic-v5"; } }
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
        private int InitialLayers(Cell cell) { return HasObstacles ? cell.layers : GroundLayers(cell); }

        // Structural safety is separate from publication or solvability rules.
        // Typed DTO fields already constrain coordinates, values and seed ranges.
        public static bool ValidateLevel(LevelConfig level)
        {
            const string message = "Invalid match-three level";
            if (level == null || level.cells == null || level.cells.Length == 0 || level.palette == null || level.palette.Length == 0 || level.initial == null || level.initial.Length != level.cells.Length || level.moves < 0 || level.target < 0)
                throw new ArgumentException(message);
            var coordinates = new HashSet<AxialCoordinate>();
            var palette = new HashSet<int>(level.palette); long ground = 0;
            for (int i = 0; i < level.cells.Length; i++)
            {
                Cell cell = level.cells[i];
                if (cell == null || cell.layers < 0 || !coordinates.Add(new AxialCoordinate(cell.q, cell.r)) || (level.rulesVersion != "classic-v5" && (!level.initial[i].HasValue || !palette.Contains(level.initial[i].Value))))
                    throw new ArgumentException(message);
                ground += level.rulesVersion == "classic-v5" ? cell.layers : GroundLayers(cell);
                if (ground > int.MaxValue) throw new ArgumentException(message);
            }
            if (level.rulesVersion == "classic-v5") ValidateObstacles(level);
            else if (level.obstacles != null || (level.rulesVersion != null && level.rulesVersion != "classic-v4")) throw new ArgumentException(message);
            return true;
        }

        public void Reset()
        {
            ValidateLevel(level);
            values = Duplicate(level.initial); layers = new int[level.cells.Length];
            for (int i = 0; i < layers.Length; i++) layers[i] = InitialLayers(level.cells[i]);
            blockerHp = null; regionOpen = null;
            if (HasObstacles)
            {
                blockerHp = new int[level.obstacles.blockers.Length];
                for (int i = 0; i < blockerHp.Length; i++) blockerHp[i] = level.obstacles.blockers[i].hp;
                regionOpen = new bool[level.obstacles.regions.Length];
            }
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
                if (Covered == Total && scoreMet && ObstaclesComplete()) return "won";
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
            if (HasObstacles) { source = Duplicate(source); for (int i = 0; i < source.Length; i++) if (!IsPlayable(i)) source[i] = null; }
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
                if ((HasObstacles && (!IsPlayable(a) || !IsPlayable(b))) || values[a] == values[b]) continue;
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
                    if ((HasObstacles && !IsPlayable(index)) || values[index].HasValue) continue;
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
            foreach (int[] column in GravityColumns())
            {
                var survivors = new List<int>();
                foreach (int index in column) if (!removed.Contains(index) && (!HasObstacles || values[index].HasValue)) survivors.Add(index);
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
        private void ValidateRecoveryBoard()
        {
            ValidateLevel(level);
            if (values == null || values.Length != level.cells.Length) throw new InvalidOperationException("Invalid recovery board");
            var palette = new HashSet<int>(level.palette);
            for (int i = 0; i < values.Length; i++)
                if (HasObstacles && !IsPlayable(i) ? values[i].HasValue : (!values[i].HasValue || !palette.Contains(values[i].Value))) throw new InvalidOperationException("Invalid recovery board");
            if (palette.Count < 2) throw new InvalidOperationException("Recovery requires at least two distinct palette values");
        }
        private bool IsValidRecoveryValues()
        {
            if (values == null || values.Length != level.cells.Length) return false;
            for (int i = 0; i < values.Length; i++)
                if (HasObstacles && !IsPlayable(i) ? values[i].HasValue : (!values[i].HasValue || Array.IndexOf(level.palette, values[i].Value) < 0)) return false;
            return true;
        }
        private bool IsPlayableSettledBoard()
        {
            return IsValidRecoveryValues() && FindMatches().Length == 0 && LegalMoves().Count != 0;
        }
        public bool StableBoard()
        {
            ValidateRecoveryBoard();
            int?[] originalValues = values, original = Duplicate(values); uint originalRng = rngState;
            try
            {
                for (int attempt = 0; attempt < 64; attempt++)
                {
                    values = new int?[values.Length]; FillVacancies();
                    if (IsPlayableSettledBoard()) return true;
                }
                int[,] coefficients = { { 1, 2 }, { 2, 1 }, { 1, -1 } };
                for (int c = 0; c < 3; c++)
                    for (int offset = 0; offset < 4; offset++)
                    {
                        values = new int?[level.cells.Length];
                        for (int i = 0; i < values.Length; i++)
                        {
                            Cell cell = level.cells[i];
                            long combination = (long)coefficients[c, 0] * cell.q + (long)coefficients[c, 1] * cell.r + offset;
                            int normalized = (int)((combination % 4 + 4) % 4);
                            if (!HasObstacles || IsPlayable(i)) values[i] = level.palette[normalized / 2];
                        }
                        if (IsPlayableSettledBoard()) return true;
                    }
                throw new InvalidOperationException("This board shape cannot provide a settled legal swap");
            }
            catch
            {
                values = originalValues; Array.Copy(original, values, original.Length); rngState = originalRng;
                throw;
            }
        }
        public bool EnsurePlayable()
        {
            ValidateRecoveryBoard();
            int?[] originalValues = values, original = Duplicate(values); uint originalRng = rngState;
            try
            {
                if (IsPlayableSettledBoard()) return false;
                for (int attempt = 0; attempt < 128; attempt++)
                {
                    values = Duplicate(original);
                    var active = new List<int>();
                    for (int i = 0; i < values.Length; i++) if (!HasObstacles || IsPlayable(i)) active.Add(i);
                    for (int i = active.Count - 1; i > 0; i--)
                    {
                        int j = (int)(Random() % (uint)(i + 1)); Exchange(active[i], active[j]);
                    }
                    if (IsPlayableSettledBoard()) return true;
                }
                StableBoard();
                if (IsPlayableSettledBoard()) return true;
                throw new InvalidOperationException("Recovery did not produce a settled legal board");
            }
            catch
            {
                values = originalValues; Array.Copy(original, values, original.Length); rngState = originalRng;
                throw;
            }
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
            if (HasObstacles && (!IsPlayable(a) || !IsPlayable(b))) return Invalid("blocked");
            Exchange(a, b); int[] matched = FindMatches();
            if (matched.Length == 0) { Exchange(a, b); return Invalid("no-match"); }
            movesLeft--; turn++; history.Add(new[] { a, b });
            var frames = new List<WaveFrame>(); int totalGain = 0; bool safetyReset = false;
            while (matched.Length != 0)
            {
                int?[] before = Duplicate(values); int gain = 0;
                foreach (int index in matched) gain += values[index].Value;
                foreach (int index in matched) layers[index] = Math.Max(0, layers[index] - 1);
                WaveFrame obstacle = DamageBlockers(matched);
                score += gain; totalGain += gain; GravityResult refill = Gravity(matched);
                frames.Add(new WaveFrame { blockerHits = obstacle.blockerHits, brokenBlockers = obstacle.brokenBlockers, openedRegions = obstacle.openedRegions, blockerHp = obstacle.blockerHp, regionOpen = obstacle.regionOpen, matched = Duplicate(matched), before = before, after = Duplicate(values), layers = Duplicate(layers), scoreGain = gain, compacted = refill.compacted, refill = refill.refill, falls = refill.falls });
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
            return new GameSnapshot { version = HasObstacles ? 5 : 4, rulesVersion = HasObstacles ? "classic-v5" : "classic-v4", obstacleVersion = HasObstacles ? "obstacles-v1" : null, blockerHp = HasObstacles ? Duplicate(blockerHp) : null, regionOpen = HasObstacles ? Duplicate(regionOpen) : null, values = Duplicate(values), layers = Duplicate(layers), score = score, movesLeft = movesLeft, turn = turn, rngState = rngState, history = route };
        }
        public HexMatch Clone()
        {
            var clone = new HexMatch(level, topology, false);
            clone.values = Duplicate(values); clone.layers = Duplicate(layers);
            clone.blockerHp = HasObstacles ? Duplicate(blockerHp) : null; clone.regionOpen = HasObstacles ? Duplicate(regionOpen) : null;
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
            if (snapshot == null || snapshot.version != (HasObstacles ? 5 : 4) || snapshot.rulesVersion != (HasObstacles ? "classic-v5" : "classic-v4") || snapshot.values == null || snapshot.values.Length != n || snapshot.layers == null || snapshot.layers.Length != n || snapshot.score < 0 || snapshot.movesLeft < 0 || snapshot.movesLeft > level.moves || snapshot.turn != level.moves - snapshot.movesLeft || snapshot.rngState == 0 || snapshot.history == null || snapshot.history.Length != snapshot.turn)
                throw new ArgumentException("Invalid match-three checkpoint");
            if (HasObstacles && (snapshot.obstacleVersion != "obstacles-v1" || snapshot.blockerHp == null || snapshot.blockerHp.Length != blockerHp.Length || snapshot.regionOpen == null || snapshot.regionOpen.Length != regionOpen.Length)) throw new ArgumentException("Invalid match-three checkpoint");
            for (int i = 0; i < n; i++)
            {
                if ((!HasObstacles && !snapshot.values[i].HasValue) || (snapshot.values[i].HasValue && Array.IndexOf(level.palette, snapshot.values[i].Value) < 0) || snapshot.layers[i] < 0 || snapshot.layers[i] > InitialLayers(level.cells[i]))
                    throw new ArgumentException("Invalid match-three checkpoint");
            }
            foreach (int[] pair in snapshot.history)
                if (pair == null || pair.Length != 2 || !Adjacent(pair[0], pair[1]))
                    throw new ArgumentException("Invalid match-three checkpoint");
            if (!HasObstacles && FindMatches(snapshot.values).Length != 0) throw new ArgumentException("Invalid match-three checkpoint");
            HexMatch replay = Replay(level, snapshot.history);
            bool same = replay.score == snapshot.score && replay.movesLeft == snapshot.movesLeft && replay.turn == snapshot.turn && replay.rngState == snapshot.rngState;
            for (int i = 0; i < n && same; i++) same = replay.values[i] == snapshot.values[i] && replay.layers[i] == snapshot.layers[i];
            if (HasObstacles)
            {
                for (int i = 0; i < blockerHp.Length && same; i++) same = replay.blockerHp[i] == snapshot.blockerHp[i];
                for (int i = 0; i < regionOpen.Length && same; i++) same = replay.regionOpen[i] == snapshot.regionOpen[i];
            }
            if (HasObstacles && (!replay.IsValidRecoveryValues() || replay.FindMatches().Length != 0)) same = false;
            if (!same) throw new ArgumentException("Checkpoint does not match its history");
            blockerHp = replay.blockerHp; regionOpen = replay.regionOpen;
            values = replay.values; layers = replay.layers; score = replay.score;
            movesLeft = replay.movesLeft; turn = replay.turn; rngState = replay.rngState; history = replay.history;
        }
    }
}
