using System;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Gameplay;

namespace Hexrota.UnityClient
{
    // The ordinary phone game ranks the visible first match only. It never
    // asks the solver for future draws or registers a paid/manual hint.
    public sealed class VisibleIdleHint
    {
        public int[] Pair { get; private set; }
        public int[] FocusSources { get; private set; }
        public int MovingSource { get; private set; }
        public int MovingTarget { get; private set; }
        private double rank;

        public static VisibleIdleHint Choose(HexMatch board, int[] previousPair = null)
        {
            if (board == null || board.Status != "playing" || board.movesLeft <= 0) return null;
            var choices = new List<VisibleIdleHint>();
            foreach (var pair in board.LegalMoves())
            {
                int a = Math.Min(pair[0],pair[1]), b = Math.Max(pair[0],pair[1]);
                var swapped = (int?[])board.values.Clone();
                swapped[a] = board.values[b]; swapped[b] = board.values[a];
                var matched = board.FindMatches(swapped);
                // Prefer the largest matching group, the higher numeral, then the
                // lower source index. The other endpoint is never highlighted.
                var focused = new[]{a,b}.Where(matched.Contains)
                    .Select(target => new { Target = target, Source = target == a ? b : a,
                        Cells = matched.Where(i => swapped[i] == swapped[target]).ToArray() })
                    .Where(group => group.Cells.Length >= 3)
                    .OrderByDescending(group => group.Cells.Length).ThenByDescending(group => swapped[group.Target])
                    .ThenBy(group => group.Source).FirstOrDefault();
                if (focused == null) continue;
                double score = 0;
                if (!board.HasMaterials || board.level.objectives.ground == true)
                    score += matched.Count(i => board.layers[i] > 0)*100 + matched.Count(i => board.layers[i] == 1)*35;
                if (!board.HasMaterials || board.level.objectives.score == true)
                    score += Math.Min(matched.Sum(i => (long)swapped[i].Value), Math.Max(0,board.level.target-board.score)) * .1;
                if (board.HasObstacles) score += VisibleObjectives(board,matched);
                choices.Add(new VisibleIdleHint { Pair = new[]{a,b}, MovingSource = focused.Source,
                    MovingTarget = focused.Target, FocusSources = focused.Cells.Select(i => i == a ? b : i == b ? a : i).OrderBy(i => i).ToArray(), rank = score });
            }
            return choices.OrderBy(c => previousPair != null && c.Pair.SequenceEqual(previousPair))
                .ThenByDescending(c => c.rank).ThenBy(c => c.Pair[0]).ThenBy(c => c.Pair[1]).FirstOrDefault();
        }

        // Display-only projection of dist/idle-hints.js visibleObstacles and
        // visibleMaterials, using the canonical topology and currently visible HP.
        private static double VisibleObjectives(HexMatch board,int[] match)
        {
            var terrain = board.level.obstacles;
            var remaining = new HashSet<int>();
            var intact = new HashSet<string>();
            var broken = new HashSet<string>();
            int touched = 0;
            for (int i = 0; i < terrain.blockers.Length; i++)
            {
                if (board.blockerHp[i] == 0) continue;
                var crate = terrain.blockers[i];
                bool exposed = board.HasColumnFlow || !terrain.regions.Where((region,r) => !board.regionOpen[r]).Any(region => region.cells.Contains(crate.cell));
                bool hit = exposed && match.Any(index => board.Adjacent(index,crate.cell));
                if (hit) touched++;
                if (hit && board.blockerHp[i] == 1) broken.Add(crate.id);
                else { remaining.Add(crate.cell); intact.Add(crate.id); }
            }
            int opened = 0;
            if (board.HasColumnFlow)
            {
                foreach (var column in board.topology.columns)
                {
                    if (!terrain.sources.Contains(column[0])) continue;
                    int prior = column[0];
                    foreach (int i in column)
                    {
                        if (remaining.Contains(i) || (i != prior && (long)board.level.cells[i].r-board.level.cells[prior].r != 1)) break;
                        if (!board.IsPlayable(i)) opened++;
                        prior = i;
                    }
                }
            }
            else
            {
                foreach (var region in terrain.regions)
                    if (region.requires.Any(intact.Contains)) remaining.UnionWith(region.cells);
                for (int i=0;i<board.Total;i++) if (!board.IsPlayable(i) && !remaining.Contains(i)) opened++;
            }
            long materialGain = 0;
            if (board.HasMaterials)
            {
                foreach (var goal in board.level.objectives.materials)
                {
                    int def = Array.FindIndex(board.level.materials.definitions,d => d.id == goal.materialId);
                    int gained = board.level.materials.sources.Where((s,i) => !board.collectedSources[i] && s.materialId == goal.materialId &&
                        (s.kind == "matched-cell" ? match.Contains(s.cell) : broken.Contains(s.blockerId))).Sum(s => s.quantity);
                    materialGain += Math.Min(gained,Math.Max(0,goal.quantity-board.materialCounts[def]));
                }
            }
            return touched*120 + opened*25 + materialGain*250;
        }
    }
}
