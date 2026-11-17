using System;
using System.Collections.Generic;

namespace Hexrota.Gameplay
{
    // This partial extends the canonical engine. Assets and presentation never
    // participate in damage, geometry, RNG, or restoration decisions.
    public sealed partial class HexMatch
    {
        private static bool ValidObstacleId(string id)
        {
            if (id == null || id.Length < 1 || id.Length > 80) return false;
            foreach (char c in id) if (!(c >= 'A' && c <= 'Z') && !(c >= 'a' && c <= 'z') && !(c >= '0' && c <= '9') && c != '_' && c != '.' && c != '-') return false;
            return true;
        }
        private static bool NeighborCells(Cell a, Cell b)
        {
            long dq = (long)a.q - b.q, dr = (long)a.r - b.r;
            return (dq == 0 && Math.Abs(dr) == 1) || (dr == 0 && Math.Abs(dq) == 1) || (dq == 1 && dr == -1) || (dq == -1 && dr == 1);
        }
        private static void ValidateObstacles(LevelConfig level)
        {
            const string error = "Invalid match-three level";
            ObstaclesConfig data = level.obstacles;
            if (data == null || data.version != "obstacles-v1" || data.blockers == null || data.regions == null) throw new ArgumentException(error);
            bool flow = data.activation == "column-flow-v1";
            if ((data.activation != null && !flow) || (!flow && data.sources != null)) throw new ArgumentException(error);
            var ids = new Dictionary<string, int>(); var occupied = new HashSet<int>();
            var regionIds = new HashSet<string>(); var closed = new HashSet<int>();
            for (int b = 0; b < data.blockers.Length; b++)
            {
                BlockerConfig box = data.blockers[b];
                if (box == null || !ValidObstacleId(box.id) || ids.ContainsKey(box.id) || box.cell < 0 || box.cell >= level.cells.Length || !occupied.Add(box.cell) || box.hp < 1 || box.hp > 2) throw new ArgumentException(error);
                ids.Add(box.id, b);
            }
            foreach (RegionConfig region in data.regions)
            {
                if (region == null || !ValidObstacleId(region.id) || !regionIds.Add(region.id) || region.cells == null || region.cells.Length == 0 || region.requires == null || (!flow && region.requires.Length == 0) || (flow && region.requires.Length != 0)) throw new ArgumentException(error);
                foreach (int cell in region.cells) if (cell < 0 || cell >= level.cells.Length || !closed.Add(cell)) throw new ArgumentException(error);
                var requirements = new HashSet<string>();
                foreach (string id in region.requires) if (id == null || !ids.ContainsKey(id) || !requirements.Add(id)) throw new ArgumentException(error);
            }
            foreach (BlockerConfig box in data.blockers)
                if (box.regionId != null)
                {
                    if (flow) throw new ArgumentException(error);
                    bool linked = false;
                    foreach (RegionConfig region in data.regions) if (region.id == box.regionId && (flow || Array.IndexOf(region.requires, box.id) >= 0)) linked = true;
                    if (!linked) throw new ArgumentException(error);
                }
            if (flow) { ValidateColumnFlow(level); return; }
            for (int i = 0; i < level.initial.Length; i++)
            {
                bool inactive = closed.Contains(i) || occupied.Contains(i);
                if (inactive ? level.initial[i].HasValue : (!level.initial[i].HasValue || Array.IndexOf(level.palette, level.initial[i].Value) < 0)) throw new ArgumentException(error);
            }
            // Prove only topology exposure, not solvability: repeatedly remove
            // reachable boxes, then expose regions whose requirements are met.
            var broken = new HashSet<string>(); var opened = new HashSet<string>();
            bool changed;
            do
            {
                changed = false;
                foreach (BlockerConfig box in data.blockers)
                {
                    if (broken.Contains(box.id) || closed.Contains(box.cell)) continue;
                    for (int i = 0; i < level.cells.Length; i++)
                    {
                        if (!closed.Contains(i) && !occupied.Contains(i) && NeighborCells(level.cells[box.cell], level.cells[i]))
                        {
                            broken.Add(box.id); occupied.Remove(box.cell); changed = true; break;
                        }
                    }
                }
                foreach (RegionConfig region in data.regions)
                {
                    if (opened.Contains(region.id)) continue;
                    bool ready = true; foreach (string id in region.requires) if (!broken.Contains(id)) ready = false;
                    if (ready) { opened.Add(region.id); foreach (int cell in region.cells) closed.Remove(cell); changed = true; }
                }
            } while (changed);
            if (broken.Count != data.blockers.Length || opened.Count != data.regions.Length) throw new ArgumentException(error);
        }
        public bool IsPlayable(int index)
        {
            if (index < 0 || index >= values.Length) return false;
            if (!HasObstacles) return true;
            if (HasColumnFlow) return cellOpen[index];
            for (int b = 0; b < blockerHp.Length; b++) if (blockerHp[b] > 0 && level.obstacles.blockers[b].cell == index) return false;
            for (int r = 0; r < regionOpen.Length; r++) if (!regionOpen[r] && Array.IndexOf(level.obstacles.regions[r].cells, index) >= 0) return false;
            return true;
        }
        private bool ObstaclesComplete()
        {
            if (!HasObstacles) return true;
            for (int b = 0; b < blockerHp.Length; b++) if (level.obstacles.blockers[b].required != false && blockerHp[b] != 0) return false;
            for (int r = 0; r < regionOpen.Length; r++) if (level.obstacles.regions[r].required != false && !regionOpen[r]) return false;
            return true;
        }
        private int[][] GravityColumns()
        {
            if (!HasObstacles) return topology.columns;
            var segments = new List<int[]>();
            foreach (int[] column in topology.columns)
            {
                var segment = new List<int>();
                foreach (int index in column)
                {
                    if (!IsPlayable(index)) { if (segment.Count > 0) { segments.Add(segment.ToArray()); segment.Clear(); } continue; }
                    if (segment.Count > 0 && (long)level.cells[index].r != (long)level.cells[segment[segment.Count - 1]].r + 1) { segments.Add(segment.ToArray()); segment.Clear(); }
                    segment.Add(index);
                }
                if (segment.Count > 0) segments.Add(segment.ToArray());
            }
            return segments.ToArray();
        }
        private WaveFrame DamageBlockers(int[] matched)
        {
            var frame = new WaveFrame(); if (!HasObstacles) return frame;
            var hits = new List<BlockerHit>(); var broken = new List<string>(); var opened = new List<string>();
            for (int b = 0; b < blockerHp.Length; b++)
            {
                if (blockerHp[b] <= 0) continue;
                BlockerConfig box = level.obstacles.blockers[b]; bool sealedRegion = false;
                for (int r = 0; r < regionOpen.Length; r++) if (!regionOpen[r] && Array.IndexOf(level.obstacles.regions[r].cells, box.cell) >= 0) sealedRegion = true;
                if (!HasColumnFlow && sealedRegion) continue;
                bool touching = false;
                foreach (int index in matched) if (Adjacent(box.cell, index)) { touching = true; break; }
                if (!touching) continue;
                int before = blockerHp[b]--;
                hits.Add(new BlockerHit { id = box.id, cell = box.cell, beforeHp = before, hp = blockerHp[b] });
                if (blockerHp[b] == 0) broken.Add(box.id);
            }
            if (HasColumnFlow)
            {
                bool[] previousCells = Duplicate(cellOpen), previousRegions = Duplicate(regionOpen);
                RefreshColumnFlow();
                var newlyOpened = new List<int>();
                for (int i = 0; i < cellOpen.Length; i++) if (cellOpen[i] && !previousCells[i]) newlyOpened.Add(i);
                for (int r = 0; r < regionOpen.Length; r++) if (regionOpen[r] && !previousRegions[r]) opened.Add(level.obstacles.regions[r].id);
                frame.openedCells = newlyOpened.ToArray(); frame.cellOpen = Duplicate(cellOpen);
            }
            else for (int r = 0; r < regionOpen.Length; r++)
            {
                if (regionOpen[r]) continue;
                RegionConfig region = level.obstacles.regions[r]; bool ready = true;
                foreach (string id in region.requires)
                    for (int b = 0; b < blockerHp.Length; b++) if (level.obstacles.blockers[b].id == id && blockerHp[b] != 0) ready = false;
                if (ready) { regionOpen[r] = true; opened.Add(region.id); }
            }
            frame.blockerHits = hits.ToArray(); frame.brokenBlockers = broken.ToArray(); frame.openedRegions = opened.ToArray();
            frame.blockerHp = Duplicate(blockerHp); frame.regionOpen = Duplicate(regionOpen); return frame;
        }
    }
}
