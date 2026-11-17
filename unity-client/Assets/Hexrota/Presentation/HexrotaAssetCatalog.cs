using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    /// <summary>Visual-only binding surface. Replace any prefab without changing rules or save IDs.</summary>
    [CreateAssetMenu(menuName = "Hexrota/Visual Asset Catalog")]
    public sealed class HexrotaAssetCatalog : ScriptableObject
    {
        [Tooltip("All supplied 9.11 assets are temporary. Replace references with imported Blender prefab wrappers.")]
        public bool usesPlaceholderArt = true;
        public GameObject cell;
        public GameObject ground;
        public GameObject stone;
        public GameObject selectionEffect;
        public GameObject matchEffect;
        public GameObject fallEffect;
        public GameObject clearEffect;
        public GameObject tavik;
        public GameObject environment;
        public GameObject gardenObject;
        public GameObject menuVisual;
        public GameObject uiVisual;

        public static GameObject InstantiateOrFallback(GameObject prefab, Transform parent, string visualName)
        {
            GameObject instance;
            if (prefab != null) instance = Instantiate(prefab, parent, false);
            else
            {
                // Missing optional art never affects the board or commands. No asset lookup by game ID.
                instance = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                instance.transform.SetParent(parent, false);
                instance.transform.localScale = Vector3.one * .62f;
                var collider = instance.GetComponent<Collider>();
                if (collider != null) Destroy(collider);
            }
            instance.name = visualName;
            instance.transform.localPosition = Vector3.zero;
            instance.transform.localRotation = Quaternion.identity;
            return instance;
        }
    }
}
