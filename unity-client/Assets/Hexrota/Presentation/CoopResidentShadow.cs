using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // A hen's contact shadow: a small soft oval under its feet (CoopLook.chickenShadow*). It is a child of
    // the hen's spot, whose pivot is the feet, so it pops in and scales with the hen.
    [RequireComponent(typeof(Image))]
    public sealed class CoopResidentShadow : MonoBehaviour
    {
        [SerializeField] private CoopLook look;
        [Tooltip("The hen drawn over this shadow; its feet are the bottom of the drawn (aspect-fitted) sprite.")]
        [SerializeField] private Image hen;

        private void OnEnable() => Apply();

        public void Apply()
        {
            if (look == null) return;
            var rect = (RectTransform)transform;
            var size = ((RectTransform)rect.parent).rect.size;
            // With preserveAspect the hen is letterboxed in its rect: lift the oval to the drawn feet.
            float feet = 0;
            if (hen != null && hen.sprite != null && hen.preserveAspect)
            {
                var sprite = hen.sprite.rect.size;
                float drawn = Mathf.Min(size.y, size.x * sprite.y / sprite.x);
                feet = (size.y - drawn) / 2;
            }
            rect.anchorMin = rect.anchorMax = new Vector2(.5f, 0);
            rect.pivot = new Vector2(.5f, .5f);
            // Shadow.png reaches half opacity at CoopSpriteView.ShadowHalfRadius of its rect.
            rect.sizeDelta = Vector2.Scale(size, look.chickenShadowSize) / CoopSpriteView.ShadowHalfRadius;
            rect.anchoredPosition = new Vector2(0, feet) + Vector2.Scale(size, look.chickenShadowOffset);
            GetComponent<Image>().color = look.chickenShadowColor;
        }
    }
}
