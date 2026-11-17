using UnityEngine;

namespace Hexrota.Client
{
    // Optional Blender FBX-derived prefabs. Gameplay never depends on these assets.
    [CreateAssetMenu(fileName = "HexrotaTheme", menuName = "Hexrota/Visual Theme")]
    public sealed class HexrotaTheme : ScriptableObject
    {
        public GameObject floorPrefab;
        // Array index 0 represents value 1. Missing entries use safe placeholders.
        public GameObject[] gemPrefabs;
        public bool showNumbersOnPrefabs = false;

        public GameObject GemFor(int value)
        {
            int index = value - 1;
            return gemPrefabs != null && index >= 0 && index < gemPrefabs.Length
                ? gemPrefabs[index] : null;
        }
    }
}
