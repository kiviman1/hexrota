using System;
using System.Collections.Generic;

namespace Hexrota.Gameplay
{
    public sealed partial class HexMatch
    {
        private static bool[] ColumnFlowCells(LevelConfig level, int[] hp)
        {
            var byCoordinate = new Dictionary<AxialCoordinate, int>();
            for (int i = 0; i < level.cells.Length; i++) byCoordinate.Add(new AxialCoordinate(level.cells[i].q, level.cells[i].r), i);
            var blocked = new HashSet<int>();
            for (int b = 0; b < level.obstacles.blockers.Length; b++) if (hp[b] > 0) blocked.Add(level.obstacles.blockers[b].cell);
            var active = new bool[level.cells.Length];
            foreach (int source in level.obstacles.sources)
            {
                Cell top = level.cells[source]; long r = top.r; int index;
                while (r <= int.MaxValue && byCoordinate.TryGetValue(new AxialCoordinate(top.q, (int)r), out index))
                {
                    if (blocked.Contains(index)) break;
                    active[index] = true; r++;
                }
            }
            return active;
        }
        private void RefreshColumnFlow()
        {
            cellOpen = ColumnFlowCells(level, blockerHp);
            for (int r = 0; r < regionOpen.Length; r++)
            {
                bool open = true; foreach (int index in level.obstacles.regions[r].cells) if (!cellOpen[index]) open = false;
                regionOpen[r] = open;
            }
        }
        private static void ValidateColumnFlow(LevelConfig level)
        {
            const string error = "Invalid match-three level";
            var data = level.obstacles;
            if (data.sources == null || data.sources.Length == 0) throw new ArgumentException(error);
            var seen = new HashSet<int>(); var columns = new HashSet<int>();
            foreach (int source in data.sources)
            {
                if (source < 0 || source >= level.cells.Length || !seen.Add(source)) throw new ArgumentException(error);
                Cell top = level.cells[source];
                if (!columns.Add(top.q)) throw new ArgumentException(error);
                foreach (Cell cell in level.cells) if (cell.q == top.q && cell.r < top.r) throw new ArgumentException(error);
            }
            var hp = new int[data.blockers.Length]; for (int b = 0; b < hp.Length; b++) hp[b] = data.blockers[b].hp;
            bool[] active = ColumnFlowCells(level, hp);
            for (int i = 0; i < active.Length; i++)
                if (active[i] ? (!level.initial[i].HasValue || Array.IndexOf(level.palette, level.initial[i].Value) < 0) : level.initial[i].HasValue) throw new ArgumentException(error);
            bool changed;
            do
            {
                changed = false;
                for (int b = 0; b < hp.Length; b++)
                {
                    if (hp[b] == 0) continue;
                    for (int i = 0; i < active.Length; i++) if (active[i] && NeighborCells(level.cells[data.blockers[b].cell], level.cells[i])) { hp[b] = 0; changed = true; break; }
                }
                active = ColumnFlowCells(level, hp);
            } while (changed);
            foreach (int left in hp) if (left != 0) throw new ArgumentException(error);
            foreach (bool open in active) if (!open) throw new ArgumentException(error);
        }
    }
}
