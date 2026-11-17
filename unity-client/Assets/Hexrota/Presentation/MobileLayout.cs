using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    // Pure presentation geometry. Safe areas never change game coordinates or rules.
    public static class MobileLayout
    {
        public static Rect SafeArea(Rect screen, Rect safe)
        {
            if (screen.width <= 0 || screen.height <= 0) return new Rect(0, 0, 1, 1);
            return new Rect(safe.x / screen.width, safe.y / screen.height,
                safe.width / screen.width, safe.height / screen.height);
        }

        public static Vector2 Axial(int q, int r)
        {
            return new Vector2(.84f * q, -Mathf.Sqrt(3f) * .56f * (r + q * .5f));
        }

        public static Rect BoardViewport(Rect safe)
        {
            return new Rect(safe.x + safe.width * .025f, safe.y + safe.height * .23f,
                safe.width * .95f, safe.height * .53f);
        }
    }
}
