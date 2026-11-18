using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public static class GardenIllustration
    {
        private const string Name = "GardenIllustration";
        public static void Show(Transform modal, string tier)
        {
            Transform picture = modal.Find(Name);
            if (picture == null)
            {
                picture = new GameObject(Name, typeof(RectTransform), typeof(RawImage)).transform;
                picture.SetParent(modal, false);
                var frame = (RectTransform)picture;
                frame.anchorMin = new Vector2(.12f, .52f);
                frame.anchorMax = new Vector2(.88f, .72f);
                frame.offsetMin = frame.offsetMax = Vector2.zero;
            }
            var image = picture.GetComponent<RawImage>();
            image.raycastTarget = false;
            image.texture = Resources.Load<Texture2D>("GardenArt/" + tier);
            picture.gameObject.SetActive(image.texture != null);
            if (image.texture == null) return;
            // Letterbox the source SVG painting inside the available modal area.
            var bounds = (RectTransform)modal;
            var width = bounds.rect.width * .76f;
            var height = bounds.rect.height * .2f;
            var size = new Vector2(640, 400) * Mathf.Min(width / 640, height / 400);
            image.rectTransform.anchorMin = image.rectTransform.anchorMax = new Vector2(.5f, .62f);
            image.rectTransform.sizeDelta = size;
            image.rectTransform.anchoredPosition = Vector2.zero;
        }

        public static void Hide(Transform modal)
        {
            var picture = modal.Find(Name);
            if (picture != null) picture.gameObject.SetActive(false);
        }
    }
}
