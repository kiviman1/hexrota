using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Place a child relative to the actually rendered bounds of a preserve-aspect Image.
    // Normalised coordinates make the separate cloth/character sprites follow the castle
    // when the phone aspect ratio changes, without deforming its mesh.
    [ExecuteAlways, DisallowMultipleComponent, RequireComponent(typeof(RectTransform))]
    public sealed class CastleHomeSpriteAnchor : MonoBehaviour
    {
        [Range(0f, 1f)] public float x = .5f;
        [Range(0f, 1f)] public float y = .5f;
        public Vector2 sizeInSprite = new Vector2(.2f, .2f);
        private Rect previousRect;
        private Sprite previousSprite;
        private Vector2 previousSize;
        private float previousX, previousY;

        private void OnEnable() { Fit(); }
        private void Update()
        {
            var image = transform.parent != null ? transform.parent.GetComponent<Image>() : null;
            if (image == null) return;
            var bounds = image.rectTransform.rect;
            if (bounds != previousRect || image.overrideSprite != previousSprite || previousSize != sizeInSprite ||
                !Mathf.Approximately(previousX, x) || !Mathf.Approximately(previousY, y)) Fit();
        }
        public void Fit()
        {
            var image = transform.parent != null ? transform.parent.GetComponent<Image>() : null;
            if (image == null || image.overrideSprite == null) return;
            var area = image.rectTransform.rect;
            var sprite = image.overrideSprite;
            if (area.width <= 0f || area.height <= 0f || sprite.rect.width <= 0f || sprite.rect.height <= 0f) return;
            previousRect = area; previousSprite = sprite; previousSize = sizeInSprite; previousX = x; previousY = y;
            float aspect = sprite.rect.width / sprite.rect.height;
            float width = area.width, height = area.height;
            if (image.preserveAspect)
            {
                if (width / height > aspect) width = height * aspect;
                else height = width / aspect;
            }
            Vector2 lower = area.center - new Vector2(width, height) * .5f;
            var target = (RectTransform)transform;
            target.anchorMin = target.anchorMax = Vector2.zero;
            target.anchoredPosition = lower - area.min + new Vector2(width * x, height * y);
            target.sizeDelta = new Vector2(width * sizeInSprite.x, height * sizeInSprite.y);
        }
    }
}
