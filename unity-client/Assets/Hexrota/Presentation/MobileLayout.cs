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

        public readonly struct GameRegions
        {
            public readonly float Header, CoachTop, CoachBottom;
            public readonly Rect Board;

            // The top HUD and the tutorial card use the same reference width as the phone canvas.
            // headerOverhang: how far HUD buttons hang below the header (the booster bag), as a share of
            // the header height; the board starts below them so they never cover a cell.
            public GameRegions(float aspect, bool tutorial, float headerOverhang = 0f)
            {
                float unit = Mathf.Clamp(aspect / 390f, .0001f, 1f / 585f);
                Header = 104 * unit;
                CoachTop = 1 - Header - 6 * unit;
                CoachBottom = CoachTop - 118 * unit;
                float gap = Mathf.Max(10 * unit, headerOverhang * Header + 6 * unit);
                Board = Rect.MinMaxRect(6f/390, 6 * unit, 1-6f/390,
                    tutorial ? CoachBottom-8*unit : 1-Header-gap);
            }
        }

        public static Rect BoardViewport(Rect safe)
        {
            return new Rect(safe.x + safe.width * .025f, safe.y + safe.height * .07f,
                safe.width * .95f, safe.height * .57f);
        }
    }
}
