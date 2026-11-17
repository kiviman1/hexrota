using System;
using System.Collections.Generic;
using System.Globalization;

namespace Hexrota.Rewards
{
    // Pure game-feel planning. No Unity types, clock, random source or score mutations.
    public static class RewardDirector
    {
        private sealed class Candidate
        {
            public string reason;
            public int tier;
            public int value;
            public int priority;
        }

        public static RewardState CreateState(string attemptId)
        {
            ValidateAttempt(attemptId);
            return new RewardState { attemptId = attemptId };
        }

        public static RewardResult Evaluate(RewardInput input, RewardState state, RewardRules rules)
        {
            ValidateRules(rules);
            ValidateState(state, rules);
            Require(input != null, "input");
            ValidateAttempt(input.attemptId);
            Range(input.turn, 1, int.MaxValue, "turn");
            Require(input.attemptId == state.attemptId, "attemptId mismatch");
            RewardState next = CloneState(state);
            if (input.turn <= state.lastTurn)
                return new RewardResult {
                    nextState = next,
                    plan = new RewardPlan { duplicate = true, waves = new RewardCue[0], headline = null, milestones = new RewardMilestone[0] }
                };
            ValidateNewInput(input, state);

            var cues = new List<RewardCue>();
            Candidate best = null;
            int bestWave = 0;
            foreach (RewardWave wave in input.waves)
            {
                Candidate candidate = Pick(wave, input.totalCells, rules);
                int actual = candidate.tier;
                if (input.tutorial) actual = Math.Min(actual, rules.tutorialCap);
                if (candidate.tier == 3 && (long)input.turn - state.lastAccentTurn < rules.accentGapTurns)
                    actual = Math.Min(actual, 2);
                RewardCue cue = MakeCue(Id(input, "wave:" + Number(wave.wave)), wave.wave,
                    candidate.reason, candidate.reason == "match" ? "" : candidate.reason,
                    actual, candidate.tier, candidate.value, false, rules);
                cues.Add(cue);
                if (best == null || Better(candidate, best)) { best = candidate; bestWave = cues.Count - 1; }
            }
            RewardCue headline = best != null && best.tier > 0 ? CopyCue(cues[bestWave], Id(input, "headline")) : null;
            var milestones = new List<RewardMilestone>();
            CrossMilestones(input, rules.scoreMilestones, "score", input.scoreBefore, input.scoreAfter, input.target, ref next.scoreMask, milestones);
            CrossMilestones(input, rules.groundMilestones, "ground", input.greenBefore, input.greenAfter, input.totalCells, ref next.groundMask, milestones);
            int goalPriority = 0;
            foreach (RewardMilestone milestone in milestones)
            {
                if (milestone.percent != 100) continue;
                int priority = milestone.kind == "ground" ? 81 : 80;
                if (priority <= goalPriority) continue;
                goalPriority = priority;
                string reason = milestone.kind == "ground" ? "ground_goal" : "score_goal";
                headline = MakeCue(Id(input, "headline"), milestone.wave, reason, reason,
                    rules.goalTier, rules.goalTier, 100, false, rules);
            }
            if (input.status == "won")
            {
                string reason = input.movesLeft == 0 ? "last_move_win" : "win";
                headline = MakeCue(Id(input, "headline"), input.waves[input.waves.Length - 1].wave,
                    reason, reason, rules.winTier, rules.winTier, input.movesLeft, true, rules);
            }
            foreach (RewardCue cue in cues) if (cue.tier == 3) next.lastAccentTurn = input.turn;
            if (headline != null && headline.tier == 3) next.lastAccentTurn = input.turn;
            next.lastTurn = input.turn;
            next.lastScore = input.scoreAfter;
            next.lastGreen = input.greenAfter;
            return new RewardResult {
                nextState = next,
                plan = new RewardPlan { waves = cues.ToArray(), headline = headline, milestones = milestones.ToArray() }
            };
        }

        private static Candidate Pick(RewardWave wave, int totalCells, RewardRules rules)
        {
            Candidate best = NewCandidate("match", 0, wave.matched, 0);
            Select(ref best, NewCandidate("long_run", ThresholdTier(wave.maxRun, rules.runThresholds), wave.maxRun, 30));
            Select(ref best, NewCandidate("chain", ThresholdTier(wave.wave, rules.chainThresholds), wave.wave, 40));
            if (wave.crossAxes >= 2)
                Select(ref best, NewCandidate("cross", wave.crossAxes >= 3 ? rules.crossThreeTier : rules.crossTier, wave.crossAxes, 50));
            if (wave.runCount >= 2) Select(ref best, NewCandidate("simultaneous", rules.simultaneousTier, wave.runCount, 20));
            if (wave.newGreen >= rules.groundMin && (long)wave.newGreen * 100 >= (long)totalCells * rules.groundPercent)
                Select(ref best, NewCandidate("green", 1, wave.newGreen, 10));
            if (wave.doubleCleared >= rules.doublesMin) Select(ref best, NewCandidate("doubles", rules.doublesTier, wave.doubleCleared, 15));
            return best;
        }

        private static Candidate NewCandidate(string reason, int tier, int value, int priority)
        { return new Candidate { reason = reason, tier = tier, value = value, priority = priority }; }
        private static bool Better(Candidate candidate, Candidate previous)
        { return candidate.tier > previous.tier || (candidate.tier == previous.tier && candidate.priority > previous.priority); }
        private static void Select(ref Candidate best, Candidate candidate)
        { if (candidate.tier > 0 && Better(candidate, best)) best = candidate; }
        private static int ThresholdTier(int value, int[] thresholds)
        { int tier = 0; for (int i = 0; i < thresholds.Length; i++) if (value >= thresholds[i]) tier = i + 1; return tier; }

        private static void CrossMilestones(RewardInput input, int[] thresholds, string kind,
            int before, int after, int denominator, ref int mask, List<RewardMilestone> output)
        {
            RewardMilestone highest = null;
            for (int i = 0; i < thresholds.Length; i++)
            {
                int percent = thresholds[i], bit = 1 << i;
                if ((mask & bit) != 0 || (long)before * 100 >= (long)denominator * percent || (long)after * 100 < (long)denominator * percent) continue;
                mask |= bit;
                int crossingWave = input.waves[input.waves.Length - 1].wave;
                foreach (RewardWave wave in input.waves)
                {
                    int progress = kind == "score" ? wave.scoreAfter : wave.greenAfter;
                    if ((long)progress * 100 >= (long)denominator * percent) { crossingWave = wave.wave; break; }
                }
                highest = new RewardMilestone {
                    id = Id(input, "milestone:" + kind + ":" + Number(percent)), wave = crossingWave, kind = kind,
                    percent = percent, tier = percent == 100 ? 2 : (kind == "score" || percent >= 50 ? 1 : 0)
                };
            }
            if (highest != null) output.Add(highest);
        }

        private static RewardCue MakeCue(string id, int wave, string reason, string labelKey,
            int tier, int rawTier, int value, bool completion, RewardRules rules)
        {
            RewardTier settings = rules.tiers[tier];
            return new RewardCue {
                id = id, wave = wave, reason = reason, labelKey = labelKey, tier = tier, rawTier = rawTier, value = value,
                scalePermille = settings.scalePermille, sparks = settings.sparks, rings = settings.rings,
                pitchStep = settings.pitchStep, hapticMs = settings.hapticMs, completion = completion
            };
        }
        private static RewardCue CopyCue(RewardCue cue, string id)
        {
            return new RewardCue {
                id = id, wave = cue.wave, reason = cue.reason, labelKey = cue.labelKey, tier = cue.tier,
                rawTier = cue.rawTier, value = cue.value, scalePermille = cue.scalePermille, sparks = cue.sparks,
                rings = cue.rings, pitchStep = cue.pitchStep, hapticMs = cue.hapticMs, completion = cue.completion
            };
        }
        private static RewardState CloneState(RewardState state)
        {
            return new RewardState {
                version = state.version, attemptId = state.attemptId, lastTurn = state.lastTurn,
                lastScore = state.lastScore, lastGreen = state.lastGreen, lastAccentTurn = state.lastAccentTurn,
                scoreMask = state.scoreMask, groundMask = state.groundMask
            };
        }
        private static string Number(int value) { return value.ToString(CultureInfo.InvariantCulture); }
        private static string Id(RewardInput input, string suffix)
        { return input.attemptId + ":" + Number(input.turn) + ":" + suffix; }

        private static void ValidateNewInput(RewardInput input, RewardState state)
        {
            Require((long)input.turn == (long)state.lastTurn + 1, "turn continuity");
            Range(input.totalCells, 1, 4096, "totalCells");
            Range(input.target, 1, int.MaxValue, "target");
            Range(input.scoreBefore, 0, int.MaxValue, "scoreBefore");
            Range(input.scoreAfter, input.scoreBefore, int.MaxValue, "scoreAfter");
            Range(input.greenBefore, 0, input.totalCells, "greenBefore");
            Range(input.greenAfter, input.greenBefore, input.totalCells, "greenAfter");
            Range(input.movesLeft, 0, int.MaxValue, "movesLeft");
            Require(input.scoreBefore == state.lastScore && input.greenBefore == state.lastGreen, "progress continuity");
            Require(input.status == "playing" || input.status == "won" || input.status == "lost", "status");
            Require(input.waves != null && input.waves.Length >= 1 && input.waves.Length <= 32, "waves");
            long score = input.scoreBefore, green = input.greenBefore;
            for (int i = 0; i < input.waves.Length; i++)
            {
                RewardWave wave = input.waves[i]; Require(wave != null, "wave");
                Require(wave.wave == i + 1, "wave order");
                Range(wave.gain, 1, int.MaxValue, "gain");
                Range(wave.matched, 3, input.totalCells, "matched");
                Range(wave.maxRun, 3, wave.matched, "maxRun");
                Range(wave.runCount, 1, wave.matched, "runCount");
                Range(wave.crossAxes, 0, 3, "crossAxes");
                Range(wave.newGreen, 0, wave.matched, "newGreen");
                Range(wave.layersCleared, wave.newGreen, wave.matched, "layersCleared");
                Range(wave.doubleCleared, 0, wave.newGreen, "doubleCleared");
                Range(wave.scoreAfter, 0, int.MaxValue, "wave.scoreAfter");
                Range(wave.greenAfter, 0, input.totalCells, "wave.greenAfter");
                score += wave.gain; green += wave.newGreen;
                Require(score == wave.scoreAfter && green == wave.greenAfter, "wave cumulative progress");
            }
            Require(score == input.scoreAfter && green == input.greenAfter, "move cumulative progress");
            if (input.status == "won") Require(input.scoreAfter >= input.target && input.greenAfter == input.totalCells, "win objectives");
        }
        private static void ValidateState(RewardState state, RewardRules rules)
        {
            Require(state != null && state.version == 1, "state version"); ValidateAttempt(state.attemptId);
            Range(state.lastTurn, 0, int.MaxValue, "lastTurn");
            Range(state.lastScore, 0, int.MaxValue, "lastScore");
            Range(state.lastGreen, 0, 4096, "lastGreen");
            Range(state.lastAccentTurn, -3, state.lastTurn, "lastAccentTurn");
            Range(state.scoreMask, 0, (1 << rules.scoreMilestones.Length) - 1, "scoreMask"); Range(state.groundMask, 0, (1 << rules.groundMilestones.Length) - 1, "groundMask");
        }
        public static void ValidateRules(RewardRules rules)
        {
            Require(rules != null && rules.version == 1, "rules version");
            Range(rules.accentGapTurns, 1, 100, "accentGapTurns");
            ValidateThresholds(rules.runThresholds, 4, int.MaxValue, 3, "runThresholds");
            ValidateThresholds(rules.chainThresholds, 2, int.MaxValue, 3, "chainThresholds");
            Range(rules.crossTier, 1, 3, "crossTier"); Range(rules.crossThreeTier, 1, 3, "crossThreeTier");
            Range(rules.simultaneousTier, 1, 3, "simultaneousTier"); Range(rules.doublesTier, 1, 3, "doublesTier");
            Range(rules.tutorialCap, 0, 2, "tutorialCap"); Range(rules.goalTier, 1, 3, "goalTier"); Range(rules.winTier, 1, 3, "winTier");
            Require(rules.crossThreeTier >= rules.crossTier, "cross tiers");
            Range(rules.groundMin, 1, 4096, "groundMin"); Range(rules.groundPercent, 1, 100, "groundPercent");
            Range(rules.doublesMin, 1, 4096, "doublesMin");
            ValidateThresholds(rules.scoreMilestones, 1, 100, -1, "scoreMilestones");
            ValidateThresholds(rules.groundMilestones, 1, 100, -1, "groundMilestones");
            Require(rules.tiers != null && rules.tiers.Length == 4, "tiers");
            foreach (RewardTier tier in rules.tiers)
            {
                Require(tier != null, "tier");
                Range(tier.scalePermille, 1000, 2000, "scalePermille");
                Range(tier.sparks, 0, 24, "sparks"); Range(tier.rings, 1, 3, "rings");
                Range(tier.pitchStep, 0, 12, "pitchStep"); Range(tier.hapticMs, 0, 60, "hapticMs");
            }
        }
        private static void ValidateThresholds(int[] values, int minimum, int maximum, int length, string name)
        {
            Require(values != null && (length < 0 ? values.Length >= 1 && values.Length <= 30 : values.Length == length), name);
            if (length < 0) Require(values[values.Length - 1] == 100, name + " completion");
            int previous = minimum - 1;
            foreach (int value in values) { Range(value, minimum, maximum, name); Require(value > previous, name + " order"); previous = value; }
        }
        private static void ValidateAttempt(string id)
        { Require(id != null && id.Length >= 1 && id.Length <= 128, "attemptId"); }
        private static void Range(int value, int minimum, int maximum, string name)
        { Require(value >= minimum && value <= maximum, name); }
        private static void Require(bool condition, string message)
        { if (!condition) throw new ArgumentException("Invalid reward " + message); }
    }
}
