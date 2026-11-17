using UnityEngine;
using UnityEngine.SceneManagement;

namespace Hexrota.Client
{
    // The checked-in scene stays asset-independent until Blender prefabs arrive.
    public static class HexrotaBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void CreateGame()
        {
            if (SceneManager.GetActiveScene().name != "Hexrota") return;
            if (Object.FindFirstObjectByType<HexrotaBoardController>() != null) return;
            var host = new GameObject("Hexrota Game Host");
            host.AddComponent<HexrotaBoardController>();
        }
    }
}
