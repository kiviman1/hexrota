using System;
using System.Globalization;
using Hexrota.Gameplay;
using Hexrota.Rewards;

namespace Hexrota.RewardAdapterCore
{
    [Serializable]
    public sealed class RewardRunFeatures
    {
        public int maxRun;
        public int runCount;
        public int crossAxes;
    }

    [Serializable]
    public sealed class RewardRestoreResult
    {
        public RewardState state;
        public RewardPlan lastPlan;
    }

    // A presentation-independent translation of classic-v4 mechanic results.
    // This class does not publish effects, read clocks or mutate game/director data.
    public static class RewardAdapter
    {
        private static string DefaultAttemptId(LevelConfig level)
        {
            if (level.id == null) return "null";
            return Convert.ToString(level.id, CultureInfo.InvariantCulture);
        }

        private static int Green(int[] layers)
        {
            int total = 0;
            foreach (int left in layers) if (left == 0) total++;
            return total;
        }

        public static RewardRunFeatures RunsFor(LevelConfig level, WaveFrame frame)
        {
            return RunsFor(level, frame, BoardTopology.For(level).lines);
        }

        public static RewardRunFeatures RunsFor(LevelConfig level, WaveFrame frame, int[][] lines)
        {
            if (level == null || frame == null || frame.before == null || lines == null)
                throw new ArgumentException("Reward run features require a board and wave");
            var membership = new int[level.cells.Length];
            var features = new RewardRunFeatures();
            foreach (int[] line in lines)
            {
                int start = 0;
                for (int end = 1; end <= line.Length; end++)
                {
                    if (end < line.Length && frame.before[line[end]] == frame.before[line[start]]) continue;
                    if (frame.before[line[start]].HasValue && end - start >= 3)
                    {
                        features.runCount++;
                        features.maxRun = Math.Max(features.maxRun, end - start);
                        for (int j = start; j < end; j++) membership[line[j]]++;
                    }
                    start = end;
                }
            }
            foreach (int count in membership) features.crossAxes = Math.Max(features.crossAxes, count);
            return features;
        }

        public static RewardInput Summarize(LevelConfig level, GameSnapshot before, SwapResult result,
            HexMatch after = null, bool tutorial = false)
        {
            return Summarize(level, before, result, after, DefaultAttemptId(level), tutorial);
        }

        // The explicit identity overload preserves null just like an explicit JS
        // argument; only the no-identity overload applies the default value.
        public static RewardInput Summarize(LevelConfig level, GameSnapshot before, SwapResult result,
            HexMatch after, string attemptId, bool tutorial = false)
        {
            if (result == null || !result.ok) return null;
            if (level == null || before == null || before.layers == null || result.frames == null)
                throw new ArgumentException("Reward summary requires a board, checkpoint and mechanic result");
            int totalCells = level.cells.Length;
            int[] layers = before.layers;
            int score = before.score;
            int[][] lines = after == null ? BoardTopology.For(level).lines : after.topology.lines;
            var waves = new RewardWave[result.frames.Length];
            for (int index = 0; index < result.frames.Length; index++)
            {
                WaveFrame frame = result.frames[index];
                int newGreen = 0, layersCleared = 0, doubleCleared = 0;
                for (int i = 0; i < totalCells; i++)
                {
                    layersCleared += layers[i] - frame.layers[i];
                    if (layers[i] > 0 && frame.layers[i] == 0)
                    {
                        newGreen++;
                        int originalLayers = level.cells[i].layers == 0 ? 1 : level.cells[i].layers;
                        if (originalLayers == 2) doubleCleared++;
                    }
                }
                score += frame.scoreGain;
                RewardRunFeatures runs = RunsFor(level, frame, lines);
                waves[index] = new RewardWave
                {
                    wave = index + 1, gain = frame.scoreGain, matched = frame.matched.Length,
                    maxRun = runs.maxRun, runCount = runs.runCount, crossAxes = runs.crossAxes,
                    newGreen = newGreen, layersCleared = layersCleared, doubleCleared = doubleCleared,
                    scoreAfter = score, greenAfter = Green(frame.layers)
                };
                layers = frame.layers;
            }
            int scoreAfter = after == null ? score : after.score;
            int greenAfter = Green(layers);
            int movesLeft = after == null ? before.movesLeft - 1 : after.movesLeft;
            bool targetMet = level.targetMode == "exact" ? scoreAfter == level.target : scoreAfter >= level.target;
            string status = after == null
                ? greenAfter == totalCells && targetMet ? "won"
                    : movesLeft <= 0 || (level.targetMode == "exact" && scoreAfter > level.target) ? "lost" : "playing"
                : after.Status;
            return new RewardInput
            {
                attemptId = attemptId, turn = after == null ? before.turn + 1 : after.turn,
                tutorial = tutorial, totalCells = totalCells, target = level.target,
                scoreBefore = before.score, scoreAfter = scoreAfter, greenBefore = Green(before.layers),
                greenAfter = greenAfter, movesLeft = movesLeft, status = status, waves = waves
            };
        }

        // This mirrors the adapter replay contract: snapshot.history is consumed.
        // Full saved-board validation belongs to SaveValidator/HexMatch.Restore.
        // JS forwards a pair by argument spreading; extra entries are ignored here.
        public static RewardRestoreResult Restore(LevelConfig level, GameSnapshot snapshot, RewardRules rules,
            bool tutorial = false)
        {
            return Restore(level, snapshot, rules, DefaultAttemptId(level), tutorial);
        }

        public static RewardRestoreResult Restore(LevelConfig level, GameSnapshot snapshot, RewardRules rules,
            string attemptId, bool tutorial = false)
        {
            string identity = attemptId;
            var replay = new HexMatch(level);
            RewardState state = RewardDirector.CreateState(identity);
            RewardPlan lastPlan = null;
            int[][] route = snapshot == null || snapshot.history == null ? new int[0][] : snapshot.history;
            foreach (int[] pair in route)
            {
                if (pair == null || pair.Length < 2) throw new ArgumentException("Reward history contains an invalid swap");
                GameSnapshot before = replay.Snapshot();
                SwapResult result = replay.Swap(pair[0], pair[1]);
                if (!result.ok) throw new ArgumentException("Reward history contains an invalid swap");
                RewardResult evaluated = RewardDirector.Evaluate(Summarize(level, before, result, replay, identity, tutorial), state, rules);
                state = evaluated.nextState;
                lastPlan = evaluated.plan;
            }
            return new RewardRestoreResult { state = state, lastPlan = lastPlan };
        }
    }
}
