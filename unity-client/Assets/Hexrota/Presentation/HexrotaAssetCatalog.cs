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
        [Header("Taşlar")]
        [Tooltip("Stone art for values 1–5, imported from art/stones/source by Hexrota/Art/Import Stones.")]
        public Sprite[] stoneSprites = new Sprite[5];
        [Tooltip("Where each stone's numeral sits: its alpha-weighted centre relative to the sprite centre, in world units.")]
        public Vector2[] stoneDigitCentres = new Vector2[5];
        [Tooltip("Height of each stone's painted pixels in world units; numerals are half the average.")]
        public float[] stonePaintedHeights = new float[5];
        [Tooltip("The single font used for every stone numeral.")]
        public Font stoneDigitFont;
        [Header("Tema")]
        public UiTheme ui;
        public MotionTheme motion;
        [Header("Kapalı alanlar")]
        public Sprite crateOneHit;
        public Sprite crateTwoHits;
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
