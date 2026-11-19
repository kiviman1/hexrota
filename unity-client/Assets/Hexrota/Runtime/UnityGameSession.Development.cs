using System.Collections.Generic;
using System.Linq;
using Hexrota.Catalog;
using Hexrota.Gameplay;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    // Development shortcut: a chapter can be won with its stored solution through the real
    // command path, so rewards, records and lives behave exactly as after a played win.
    public sealed partial class UnityGameSession
    {
        /// <summary>
        /// Plays the active chapter's stored solution up to, but not including, its last move and
        /// returns that move so the caller can present the winning swap. Works only from turn 0;
        /// returns null with <see cref="LastError"/> set otherwise.
        /// </summary>
        public int[] PlayDevelopmentRouteToLastMove()
        {
            if (!HasAttempt || Status != "playing") { LastError = "not_playing"; return null; }
            if (Snapshot.turn != 0) { LastError = "not_at_start"; return null; }
            var route = FindWinningRoute();
            if (route == null) { LastError = "no_solution"; return null; }
            for (int i = 0; i < route.Length - 1; i++)
            {
                var move = TrySwap(route[i][0], route[i][1]);
                CompletePresentation();
                if (!move.Ok) { LastError = "route_rejected:" + move.Reason; return null; }
                if (Status != "playing") { LastError = "route_ended_early"; return null; }
            }
            LastError = null;
            return route[route.Length - 1];
        }

        // Stored routes (the same sources the hint solver uses), checked on a copy of the board:
        // the first one that ends in a win from the current opening board is played.
        private int[][] FindWinningRoute()
        {
            var level = ActiveLevelWire;
            var candidates = new List<object>();
            var archive = W.Get(data.ArchivedOpeningSolutions, (string)W.Get(level, "levelDataVersion", LevelCatalog.LegacyDataVersion));
            candidates.Add(W.Get(archive, (string)W.Get(level, "variantId", LevelCatalog.LegacyVariantId)));
            candidates.Add(W.Get(level, "solution"));
            foreach (var key in new[] { "solutions", "alternativeSolutions" })
            {
                var list = W.Get(level, key);
                if (W.IsList(list)) candidates.AddRange(W.List(list).Cast<object>());
            }
            var config = LevelCatalog.GameplayConfig(level);
            foreach (var candidate in candidates)
            {
                if (candidate == null || !W.IsList(candidate) || W.List(candidate).Count == 0) continue;
                var route = W.List(candidate).Select(pair => W.List(pair).Select(W.Int32).ToArray()).ToArray();
                var board = new HexMatch(config, Snapshot);
                bool valid = true;
                foreach (var move in route)
                    if (board.Status != "playing" || !board.Swap(move[0], move[1]).ok) { valid = false; break; }
                if (valid && board.Status == "won") return route;
            }
            return null;
        }
    }
}
