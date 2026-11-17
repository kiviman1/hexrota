using System;
using System.Collections.Generic;

namespace Hexrota.Gameplay
{
    // Materials are canonical, once-only cell/crate sources. Visual flights and
    // callbacks only project these events and never create collection progress.
    public sealed partial class HexMatch
    {
        private static void ValidateMaterials(LevelConfig config)
        {
            const string error = "Invalid match-three level";
            MaterialConfig data = config.materials; ObjectiveConfig goals = config.objectives;
            if (data == null || data.version != "materials-v1" || data.definitions == null || data.sources == null || goals == null || goals.version != "objectives-v1" || !goals.score.HasValue || !goals.ground.HasValue || goals.materials == null || (goals.score != true && goals.ground != true && goals.materials.Length == 0)) throw new ArgumentException(error);
            var definitions = new Dictionary<string, int>(); var supply = new long[data.definitions.Length];
            for (int i = 0; i < data.definitions.Length; i++)
            {
                MaterialDefinition definition = data.definitions[i];
                if (definition == null || !ValidObstacleId(definition.id) || definitions.ContainsKey(definition.id)) throw new ArgumentException(error);
                definitions.Add(definition.id, i);
            }
            var sources = new HashSet<string>();
            var geometry = new HashSet<AxialCoordinate>(); foreach (Cell cell in config.cells) geometry.Add(new AxialCoordinate(cell.q, cell.r));
            var crates = new Dictionary<string, BlockerConfig>(); var boxCells = new HashSet<int>();
            foreach (BlockerConfig box in config.obstacles.blockers) { crates.Add(box.id, box); boxCells.Add(box.cell); }
            foreach (MaterialSource source in data.sources)
            {
                int index;
                if (source == null || !ValidObstacleId(source.id) || !sources.Add(source.id) || source.materialId == null || !definitions.TryGetValue(source.materialId, out index) || source.quantity <= 0 || source.cell < 0 || source.cell >= config.cells.Length) throw new ArgumentException(error);
                if (source.kind == "crate-break")
                {
                    BlockerConfig crate;
                    if (source.blockerId == null || !crates.TryGetValue(source.blockerId, out crate) || crate.cell != source.cell) throw new ArgumentException(error);
                }
                else if (source.kind != "matched-cell" || source.blockerId != null || boxCells.Contains(source.cell) || !MaterialCellCanMatch(config.cells[source.cell], geometry)) throw new ArgumentException(error);
                supply[index] += source.quantity;
                if (supply[index] > int.MaxValue) throw new ArgumentException(error);
            }
            var goalIds = new HashSet<string>();
            foreach (MaterialGoal goal in goals.materials)
            {
                int index;
                if (goal == null || goal.materialId == null || !definitions.TryGetValue(goal.materialId, out index) || !goalIds.Add(goal.materialId) || goal.quantity <= 0 || goal.quantity > supply[index]) throw new ArgumentException(error);
            }
        }
        private static bool MaterialCoordinateExists(HashSet<AxialCoordinate> cells, long q, long r)
        {
            return q >= int.MinValue && q <= int.MaxValue && r >= int.MinValue && r <= int.MaxValue && cells.Contains(new AxialCoordinate((int)q, (int)r));
        }
        private static bool MaterialCellCanMatch(Cell cell, HashSet<AxialCoordinate> geometry)
        {
            int[,] directions = { { 1, 0 }, { 0, 1 }, { 1, -1 } };
            for (int d = 0; d < 3; d++) for (int start = -2; start <= 0; start++)
            {
                bool present = true;
                for (int offset = start; offset < start + 3; offset++)
                    if (!MaterialCoordinateExists(geometry, (long)cell.q + offset * directions[d, 0], (long)cell.r + offset * directions[d, 1])) { present = false; break; }
                if (present) return true;
            }
            return false;
        }
        private bool GoalsComplete(bool scoreMet)
        {
            if (!HasMaterials) return Covered == Total && scoreMet;
            if ((level.objectives.score == true && !scoreMet) || (level.objectives.ground == true && Covered != Total)) return false;
            foreach (MaterialGoal goal in level.objectives.materials)
            {
                int index = MaterialIndex(goal.materialId);
                if (materialCounts[index] < goal.quantity) return false;
            }
            return true;
        }
        private int MaterialIndex(string materialId)
        {
            for (int i = 0; i < level.materials.definitions.Length; i++) if (level.materials.definitions[i].id == materialId) return i;
            throw new InvalidOperationException("Unknown material definition");
        }
        private void CollectMaterialSources(string kind, int[] matched, string[] broken, List<MaterialEvent> events)
        {
            var matchSet = matched == null ? null : new HashSet<int>(matched);
            var brokenSet = broken == null ? null : new HashSet<string>(broken);
            for (int i = 0; i < level.materials.sources.Length; i++)
            {
                MaterialSource source = level.materials.sources[i];
                if (collectedSources[i] || source.kind != kind) continue;
                bool collect = kind == "matched-cell" ? matchSet.Contains(source.cell) && IsPlayable(source.cell) : brokenSet.Contains(source.blockerId);
                if (!collect) continue;
                int material = MaterialIndex(source.materialId);
                materialCounts[material] = checked(materialCounts[material] + source.quantity); collectedSources[i] = true;
                events.Add(new MaterialEvent { sourceId = source.id, materialId = source.materialId, quantity = source.quantity, cell = source.cell, kind = source.kind });
            }
        }
    }
}
