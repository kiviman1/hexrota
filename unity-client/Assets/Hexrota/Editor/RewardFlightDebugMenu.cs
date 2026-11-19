using Hexrota.UnityClient.Presentation;
using UnityEditor;
using UnityEngine;

namespace Hexrota.UnityClient.Editor
{
    internal static class RewardFlightDebugMenu
    {
        private const string Path = "Hexrota/Debug/Play Reward Flight (Gold 20 + Golden Egg 1)";

        [MenuItem(Path, true)]
        private static bool CanPlay() => EditorApplication.isPlaying &&
            Object.FindAnyObjectByType<FirstPlayableController>()?.CurrentScreen == "menu";

        [MenuItem(Path)]
        private static void Play() => Object.FindAnyObjectByType<RewardFlight>()?.PlayDebug();
    }
}
