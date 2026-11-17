using System;

namespace Hexrota.Rewards
{
    [Serializable]
    public sealed class RewardInput
    {
        public string attemptId;
        public int turn;
        public bool tutorial;
        public int totalCells;
        public int target;
        public int scoreBefore;
        public int scoreAfter;
        public int greenBefore;
        public int greenAfter;
        public int movesLeft;
        public string status;
        public RewardWave[] waves;
    }

    [Serializable]
    public sealed class RewardWave
    {
        public int wave;
        public int gain;
        public int matched;
        public int maxRun;
        public int runCount;
        public int crossAxes;
        public int newGreen;
        public int layersCleared;
        public int doubleCleared;
        public int scoreAfter;
        public int greenAfter;
    }

    [Serializable]
    public sealed class RewardState
    {
        public int version = 1;
        public string attemptId;
        public int lastTurn;
        public int lastScore;
        public int lastGreen;
        public int lastAccentTurn = -3;
        public int scoreMask;
        public int groundMask;
    }

    [Serializable]
    public sealed class RewardRules
    {
        public int version;
        public int accentGapTurns;
        public int[] runThresholds;
        public int[] chainThresholds;
        public int crossTier;
        public int crossThreeTier;
        public int simultaneousTier;
        public int groundMin;
        public int groundPercent;
        public int doublesMin;
        public int doublesTier;
        public int tutorialCap;
        public int goalTier;
        public int winTier;
        public int[] scoreMilestones;
        public int[] groundMilestones;
        public RewardTier[] tiers;
    }

    [Serializable]
    public sealed class RewardTier
    {
        public int scalePermille;
        public int sparks;
        public int rings;
        public int pitchStep;
        public int hapticMs;
    }

    [Serializable]
    public sealed class RewardCue
    {
        public string id;
        public int wave;
        public string reason;
        public string labelKey;
        public int tier;
        public int rawTier;
        public int value;
        public int scalePermille;
        public int sparks;
        public int rings;
        public int pitchStep;
        public int hapticMs;
        public bool completion;
    }

    [Serializable]
    public sealed class RewardMilestone
    {
        public string id;
        public int wave;
        public string kind;
        public int percent;
        public int tier;
    }

    [Serializable]
    public sealed class RewardPlan
    {
        public int version = 1;
        public bool duplicate;
        public RewardCue[] waves;
        public RewardCue headline;
        public RewardMilestone[] milestones;
    }

    [Serializable]
    public sealed class RewardResult
    {
        public RewardState nextState;
        public RewardPlan plan;
    }
}
