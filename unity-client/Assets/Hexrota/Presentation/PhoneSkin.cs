using System;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    public static class PhoneSkin
    {
        private static Texture2D atlas;
        private static string[] names;

        // min/max reserve the same box in the parent as the SVG in the mobile UI.
        // The image fits inside it without stretching the 24-by-24 viewBox.
        public static RawImage Icon(Transform parent, string symbol, Vector2 min, Vector2 max, Color color)
        {
            if (atlas == null)
            {
                atlas = Resources.Load<Texture2D>("PhoneArt/Icons");
                names = Resources.Load<TextAsset>("PhoneArt/IconNames").text.Trim().Split('\n');
            }
            int index = Array.FindIndex(names, name => name.TrimEnd('\r') == symbol);
            if (index < 0) throw new ArgumentException("Unknown mobile symbol " + symbol, nameof(symbol));
            var bounds = new GameObject("IconBox", typeof(RectTransform)).GetComponent<RectTransform>();
            bounds.SetParent(parent, false);
            bounds.anchorMin = min; bounds.anchorMax = max;
            bounds.offsetMin = bounds.offsetMax = Vector2.zero;
            var image = new GameObject("Icon-" + symbol, typeof(RectTransform), typeof(RawImage)).GetComponent<RawImage>();
            image.transform.SetParent(bounds, false);
            image.texture = atlas; image.color = color; image.raycastTarget = false;
            image.uvRect = new Rect(index % 8 / 8f, 1 - (index / 8 + 1) / 4f, 1 / 8f, 1 / 4f);
            var fit = image.gameObject.AddComponent<AspectRatioFitter>();
            fit.aspectRatio = 1; fit.aspectMode = AspectRatioFitter.AspectMode.FitInParent;
            return image;
        }

        public static void Plate(GameObject panel, Color top, Color bottom, Color border, float radius = 12f, float borderWidth = 2f)
        {
            var surface = panel.GetComponent<PhonePlate>();
            if (surface == null) surface = panel.AddComponent<PhonePlate>();
            surface.Configure(top, bottom, border, radius, borderWidth);
        }
    }
}
