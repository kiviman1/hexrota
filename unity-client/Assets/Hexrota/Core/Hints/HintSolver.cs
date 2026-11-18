using System;
using System.Collections.Generic;
using System.Globalization;
using Hexrota.Gameplay;

namespace Hexrota.Hints
{
    public interface IHintClock { double NowMilliseconds { get; } }

    public sealed class HintOptions
    {
        public double? maxNodes;
        public double? maxMs;
        public double? maxDepth;
        public double? beamWidth;
    }

    public sealed class HintResult
    {
        public int[] pair;
        public string source;
        public bool guaranteed;
        public int[][] continuation;
        public int searchedNodes;
        public int depth;
        public bool truncated;
    }

    // Authored route data is a separate binding, not a gameplay rule/config change.
    // Its private copies cannot be edited after certification by a view or caller.
    public sealed class HintRoutes
    {
        private readonly int[][][] routes;
        private HintRoutes(int[][][] routes) { this.routes = routes; }
        internal int CandidateCount { get { return routes.Length; } }
        internal int CandidateLength(int index) { return routes[index] == null ? 0 : routes[index].Length; }
        internal int[][] CopyCandidate(int index)
        {
            var copy = new int[routes[index].Length][];
            for (int i = 0; i < copy.Length; i++) copy[i] = (int[])routes[index][i].Clone();
            return copy;
        }

        public static HintRoutes Create(LevelConfig level, int[][][] solutions = null,
            int[][] solution = null, int[][][] alternativeSolutions = null)
        {
            if (level == null) throw new ArgumentNullException("level");
            var data = new List<int[][]>();
            if (solutions != null) foreach (int[][] route in solutions) Add(level, route, data, true);
            Add(level, solution, data, false);
            if (alternativeSolutions != null) foreach (int[][] route in alternativeSolutions) Add(level, route, data, true);
            return new HintRoutes(data.ToArray());
        }

        private static void Add(LevelConfig level, int[][] route, List<int[][]> target, bool candidateSlot)
        {
            // Preserve array entry slots for Find's bounded scan, without changing
            // the accepted/ignored null and empty route binding contract.
            if (route == null || route.Length == 0) { if (candidateSlot) target.Add(null); return; }
            if (route.Length > level.moves) throw new ArgumentException("Invalid certified hint route");
            var copy = new int[route.Length][];
            for (int i = 0; i < route.Length; i++)
            {
                if (route[i] == null || route[i].Length != 2) throw new ArgumentException("Invalid certified hint route");
                copy[i] = (int[])route[i].Clone();
            }
            HexMatch replay;
            try { replay = HexMatch.Replay(level, copy); }
            catch (Exception error) { throw new ArgumentException("Invalid certified hint route", error); }
            if (replay.Status != "won") throw new ArgumentException("Hint route does not finish the level");
            target.Add(copy);
        }
    }

    public static class HintSolver
    {
        private const int MaxRouteCandidates = 64, MaxRoutePairs = 512;

        private sealed class Node
        {
            public HexMatch game;
            public int[][] path;
            public double rank;
            public int order;
        }

        private sealed class ZeroClock : IHintClock { public double NowMilliseconds { get { return 0; } } }
        private static readonly IHintClock Timeless = new ZeroClock();
        private static bool Same(int[] a, int[] b)
        {
            return a != null && b != null && a.Length == 2 && b.Length == 2 &&
                ((a[0] == b[0] && a[1] == b[1]) || (a[0] == b[1] && a[1] == b[0]));
        }
        private static double Or(double? value, double fallback)
        {
            return !value.HasValue || value.Value == 0 || double.IsNaN(value.Value) ? fallback : value.Value;
        }
        private static int[][] CopyRoute(int[][] route, int start = 0)
        {
            var result = new int[route.Length - start][];
            for (int i = 0; i < result.Length; i++) result[i] = (int[])route[i + start].Clone();
            return result;
        }
        private static int[][] Append(int[][] path, int[] pair)
        {
            var result = new int[path.Length + 1][];
            Array.Copy(path, result, path.Length); result[path.Length] = (int[])pair.Clone(); return result;
        }
        private static bool Wins(HexMatch source, int[][] continuation)
        {
            var copy = source.Clone();
            foreach (int[] move in continuation)
                if (move == null || move.Length != 2 || !copy.Swap(move[0], move[1]).ok) return false;
            return copy.Status == "won";
        }
        private static string StateKey(HexMatch game)
        {
            var value = new string[game.values.Length]; var layer = new string[game.layers.Length];
            for (int i = 0; i < value.Length; i++) value[i] = game.values[i].HasValue ? game.values[i].Value.ToString(CultureInfo.InvariantCulture) : "";
            for (int i = 0; i < layer.Length; i++) layer[i] = game.layers[i].ToString(CultureInfo.InvariantCulture);
            return string.Join(",", value) + "/" + string.Join(",", layer) + "/" +
                game.score.ToString(CultureInfo.InvariantCulture) + "/" + game.movesLeft.ToString(CultureInfo.InvariantCulture) + "/" + game.rngState.ToString(CultureInfo.InvariantCulture) + (game.HasObstacles ? "/" + String.Join(",", game.blockerHp) + "/" + String.Join(",", game.regionOpen) : "") + (game.HasMaterials ? "/" + String.Join(",", game.materialCounts) + "/" + String.Join(",", game.collectedSources) : "");
        }
        private static HintResult Reply(HexMatch original, List<int[]> legal, Node bestPlaying,
            Node bestLost, int searched, int depth, string source = "heuristic", Node item = null, bool truncated = false)
        {
            int[] pair = item != null ? item.path[0] : bestPlaying != null ? bestPlaying.path[0] : bestLost != null ? bestLost.path[0] : legal[0];
            int[][] continuation = source == "heuristic" ? null : CopyRoute(item.path);
            if (continuation != null && !Wins(original, continuation)) throw new InvalidOperationException("Hint continuation failed replay");
            return new HintResult { pair = (int[])pair.Clone(), source = source, guaranteed = source != "heuristic",
                continuation = continuation, searchedNodes = searched, depth = depth, truncated = truncated };
        }

        public static HintResult Find(HexMatch game, HintRoutes routes = null, HintOptions options = null, IHintClock clock = null)
        {
            if (game == null) throw new ArgumentNullException("game");
            if (game.Status != "playing") return null;
            List<int[]> legal = game.LegalMoves(); if (legal.Count == 0) return null;
            // Keep metadata work separate from search counters and truncated.
            // Copied route pairs bound all current-state proof swap attempts too.
            int routePairs = 0;
            if (routes != null) for (int candidate = 0; candidate < Math.Min(MaxRouteCandidates, routes.CandidateCount); candidate++)
            {
                int length = routes.CandidateLength(candidate);
                if (game.history.Count >= length || length > game.history.Count + game.movesLeft || length > MaxRoutePairs - routePairs) continue;
                routePairs += length;
                int[][] route = routes.CopyCandidate(candidate);
                bool prefix = true;
                for (int i = 0; i < game.history.Count; i++) if (!Same(game.history[i], route[i])) { prefix = false; break; }
                if (!prefix) continue;
                int[] pair = route[game.history.Count]; bool available = false;
                foreach (int[] move in legal) if (Same(move, pair)) { available = true; break; }
                if (!available) continue;
                int[][] continuation = CopyRoute(route, game.history.Count);
                // Binding checks origin certification; both runtimes verify the
                // current-state continuation again before publishing a guarantee.
                if (!Wins(game, continuation)) continue;
                return new HintResult { pair = (int[])pair.Clone(), source = "proven_route", guaranteed = true,
                    continuation = continuation, searchedNodes = 0, depth = 0, truncated = false };
            }
            options = options ?? new HintOptions();
            double requestedNodes = options.maxNodes ?? double.NaN;
            bool nodeLimited = !double.IsNaN(requestedNodes) && !double.IsInfinity(requestedNodes) && requestedNodes > 0 && Math.Floor(requestedNodes) == requestedNodes;
            int maxNodes = (int)Math.Min(100000, nodeLimited ? requestedNodes : 5000);
            double budget = Math.Max(1, Math.Min(150, Or(options.maxMs, 90)));
            // No device or process clock is read in the portable core. Supplying
            // no clock selects a deterministic node/depth-only platform policy.
            clock = clock ?? Timeless;
            double end = nodeLimited ? 0 : clock.NowMilliseconds + budget;
            double maxDepth = Math.Min(game.movesLeft, Math.Max(1, Math.Min(3, Or(options.maxDepth, 3))));
            int width = (int)Math.Max(1, Math.Min(32, Math.Floor(Or(options.beamWidth, 10))));
            int initialLayers = game.RemainingLayers;
            var visited = new HashSet<string>();
            var beam = new List<Node> { new Node { game = game, path = new int[0][], rank = 0 } };
            Node bestPlaying = null, bestLost = null; int searchedNodes = 0, depthReached = 0;
            for (int depth = 0; depth < maxDepth; depth++)
            {
                var next = new List<Node>();
                foreach (Node node in beam)
                {
                    if (node.game.Status != "playing") continue;
                    foreach (int[] pair in node.game.LegalMoves())
                    {
                        if (searchedNodes >= maxNodes || (!nodeLimited && clock.NowMilliseconds >= end))
                            return Reply(game, legal, bestPlaying, bestLost, searchedNodes, depthReached, truncated: true);
                        HexMatch child = node.game.Clone(); SwapResult result = child.Swap(pair[0], pair[1]); if (!result.ok) continue;
                        searchedNodes++; depthReached = Math.Max(depthReached, depth + 1);
                        int[][] path = Append(node.path, pair);
                        int progress = initialLayers - child.RemainingLayers, green = child.Covered - game.Covered;
                        int points = Math.Min(child.score, game.level.target) - Math.Min(game.score, game.level.target);
                        double urgency = (double)Math.Max(0, game.level.target - child.score) / Math.Max(1, child.movesLeft);
                        var item = new Node { game = child, path = path,
                            rank = progress * 120 + green * 45 + points * .8 - (depth + 1) * 8 - urgency * .35, order = next.Count };
                        if (child.Status == "won") return Reply(game, legal, bestPlaying, bestLost, searchedNodes, depthReached, "search_win", item);
                        if (child.Status == "lost") { if (bestLost == null || item.rank > bestLost.rank) bestLost = item; continue; }
                        if (bestPlaying == null || item.rank > bestPlaying.rank) bestPlaying = item;
                        string key = StateKey(child); if (!visited.Add(key)) continue; next.Add(item);
                    }
                }
                next.Sort((a, b) => { int compare = b.rank.CompareTo(a.rank); return compare != 0 ? compare : a.order.CompareTo(b.order); });
                if (next.Count > width) next.RemoveRange(width, next.Count - width);
                beam = next; if (beam.Count == 0) break;
            }
            return Reply(game, legal, bestPlaying, bestLost, searchedNodes, depthReached);
        }
    }
}
