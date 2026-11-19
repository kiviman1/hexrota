#import <CoreHaptics/CoreHaptics.h>

static CHHapticEngine *rewardEngine;
static id<CHHapticPatternPlayer> rewardPlayer;
static int preparedMilliseconds;

extern "C" void HexrotaPrepareRewardHaptic(int milliseconds)
{
    if (@available(iOS 13.0, *)) {
        if (![[CHHapticEngine capabilitiesForHardware] supportsHaptics]) return;
        if (!rewardEngine) {
            rewardEngine = [[CHHapticEngine alloc] initAndReturnError:nullptr];
            rewardEngine.playsHapticsOnly = YES;
            rewardEngine.autoShutdownEnabled = YES;
        }
        if (![rewardEngine startAndReturnError:nullptr]) return;
        if (rewardPlayer && preparedMilliseconds == milliseconds) return;

        CHHapticEventParameter *intensity = [[CHHapticEventParameter alloc]
            initWithParameterID:CHHapticEventParameterIDHapticIntensity value:0.45f];
        CHHapticEvent *pulse = [[CHHapticEvent alloc] initWithEventType:CHHapticEventTypeHapticContinuous
            parameters:@[intensity] relativeTime:0 duration:milliseconds / 1000.0];
        CHHapticPattern *pattern = [[CHHapticPattern alloc] initWithEvents:@[pulse] parameters:@[] error:nullptr];
        rewardPlayer = [rewardEngine createPlayerWithPattern:pattern error:nullptr];
        preparedMilliseconds = milliseconds;
    }
}

extern "C" void HexrotaPlayRewardHaptic()
{
    if (@available(iOS 13.0, *)) [rewardPlayer startAtTime:CHHapticTimeImmediate error:nullptr];
}
