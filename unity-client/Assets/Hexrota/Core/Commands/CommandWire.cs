using System.Collections.Generic;
using Hexrota.Gameplay;
using Hexrota.Contracts;

namespace Hexrota.Commands
{
    public static class CommandWire
    {
        public static Dictionary<string, object> Result(SwapResult result)
        {
            var frames = new List<object>();
            foreach (WaveFrame frame in result.frames)
            {
                var refill = new List<object>(); foreach (RefillTile tile in frame.refill) refill.Add(Wire.Obj("index", tile.index, "value", tile.value, "forced", tile.forced, "minMatches", tile.minMatches));
                var falls = new List<object>();
                foreach (FallTile tile in frame.falls)
                {
                    var fall = Wire.Obj("from", tile.from.HasValue ? (object)tile.from.Value : null, "to", tile.to, "value", tile.value, "spawn", tile.spawn);
                    if (tile.spawnOrder.HasValue) fall.Add("spawnOrder", tile.spawnOrder.Value);
                    if (tile.spawnCount.HasValue) fall.Add("spawnCount", tile.spawnCount.Value); falls.Add(fall);
                }
                var wave = Wire.Obj("matched", Wire.Clone(frame.matched), "before", Wire.Clone(frame.before), "after", Wire.Clone(frame.after), "layers", Wire.Clone(frame.layers), "scoreGain", frame.scoreGain, "compacted", Wire.Clone(frame.compacted), "refill", refill, "falls", falls);
                // Crate and region state exists only on obstacle (classic-v5) waves; classic-v4 output is unchanged.
                if (frame.blockerHp != null)
                {
                    var hits = new List<object>(); foreach (BlockerHit hit in frame.blockerHits ?? new BlockerHit[0]) hits.Add(Wire.Obj("id", hit.id, "cell", hit.cell, "beforeHp", hit.beforeHp, "hp", hit.hp));
                    wave.Add("blockerHits", hits); wave.Add("brokenBlockers", Wire.Clone(frame.brokenBlockers ?? new string[0]));
                    wave.Add("openedRegions", Wire.Clone(frame.openedRegions ?? new string[0])); wave.Add("blockerHp", Wire.Clone(frame.blockerHp));
                    wave.Add("regionOpen", Wire.Clone(frame.regionOpen));
                    if (frame.cellOpen != null) { wave.Add("cellOpen", Wire.Clone(frame.cellOpen)); wave.Add("openedCells", Wire.Clone(frame.openedCells ?? new int[0])); }
                }
                frames.Add(wave);
            }
            return Wire.Obj("ok", result.ok, "reason", result.reason, "frames", frames, "scoreGain", result.scoreGain, "reshuffled", result.reshuffled);
        }
    }
}
