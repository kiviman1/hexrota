using System;
using Hexrota.Gameplay;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class HexBoardView
    {
        private ObstaclesConfig terrain;
        private SpriteRenderer[] crates;
        private int[] shownCrateHp;
        private bool[] closedCells;
        private GameObject terrainRoot;
        private Sprite[] crateFragments;
        private GameObject[] lockedMarks;
        private bool[] shownLocked;
        private static Sprite fogSprite, lockSprite;
        /// <summary>Plank shadow offset from its plank, world units (down and to the right).</summary>
        private static readonly Vector3 PlankShadowOffset = new Vector3(.012f, -.02f, .004f);

        // A crate is its painted base with up to two planks crossed over the front face: durability 3
        // shows both, 2 shows plank A, 1 the crate alone. No numeral.
        private void PrepareTerrain(ObstaclesConfig config)
        {
            if (terrainRoot != null)
            {
                terrainRoot.SetActive(false);
                Destroy(terrainRoot);
            }
            terrain = config;
            if (config == null) { closedCells = null; crates = null; shownCrateHp = null; lockedMarks = null; shownLocked = null; return; }
            terrainRoot = new GameObject("Obstacles");
            terrainRoot.transform.SetParent(world, false);
            closedCells = new bool[positions.Length];
            lockedMarks = new GameObject[positions.Length];
            shownLocked = null; // the first paint never animates
            crates = new SpriteRenderer[config.blockers.Length];
            shownCrateHp = new int[config.blockers.Length];
            for (int i = 0; i < crates.Length; i++)
            {
                shownCrateHp[i] = -1; // the first paint never animates
                int cell = config.blockers[i].cell;
                var crate = new GameObject("Crate_" + cell);
                crate.transform.SetParent(terrainRoot.transform, false);
                crate.transform.position = positions[cell] + Vector3.back * .6f;
                crates[i] = crate.AddComponent<SpriteRenderer>();
                crates[i].sprite = assets != null ? assets.crateBase : null;
                crates[i].sortingOrder = 1;
                for (int p = 0; p < 2; p++) BuildPlank(crate.transform, p);
            }
        }

        private static string PlankName(int plank) => plank == 0 ? "Plank_A" : "Plank_B";

        private void BuildPlank(Transform crate, int plank)
        {
            if (assets == null || assets.cratePlanks == null || assets.cratePlanks.Length <= plank) return;
            var look = assets.cratePlanks[plank];
            var ui = assets.ui;
            // The top plank (B) and its shadow draw over plank A.
            var shadow = PlankPart(crate, PlankName(plank) + "_Shadow", look, 2 + plank * 2,
                ui != null ? ui.cratePlankShadow : new Color(0, 0, 0, .4f));
            shadow.transform.localPosition += PlankShadowOffset;
            PlankPart(crate, PlankName(plank), look, 3 + plank * 2, ui != null ? ui.cratePlankTint : Color.white);
        }

        private static SpriteRenderer PlankPart(Transform crate, string name, HexrotaAssetCatalog.CratePlank look, int order, Color colour)
        {
            var node = new GameObject(name);
            node.transform.SetParent(crate, false);
            node.transform.localPosition = new Vector3(look.offset.x, look.offset.y, -.01f);
            node.transform.localRotation = Quaternion.Euler(0, 0, look.rotation);
            node.transform.localScale = Vector3.one * look.scale;
            var ink = node.AddComponent<SpriteRenderer>();
            ink.sprite = look.sprite;
            ink.color = colour;
            ink.sortingOrder = order;
            return ink;
        }

        private void PaintTerrain(int[] hp, bool[] openCells, bool[] openRegions)
        {
            if (terrain == null || hp == null) return;
            Array.Clear(closedCells, 0, closedCells.Length);
            if (openCells != null)
            {
                for (int i = 0; i < closedCells.Length; i++) closedCells[i] = !openCells[i];
            }
            else if (openRegions != null)
            {
                for (int i = 0; i < terrain.regions.Length; i++)
                    if (!openRegions[i])
                        foreach (int cell in terrain.regions[i].cells) closedCells[cell] = true;
            }
            for (int i = 0; i < crates.Length; i++)
            {
                int cell = terrain.blockers[i].cell;
                if (crates[i] != null)
                {
                    int before = shownCrateHp[i];
                    // Every hit drops the top plank; the last one breaks the crate.
                    for (int level = before; before >= 0 && level > hp[i] && level > 0; level--)
                    {
                        if (level >= 2) DropPlank(crates[i].transform, level - 2);
                        else Shatter(crates[i]);
                    }
                    shownCrateHp[i] = hp[i];
                    crates[i].gameObject.SetActive(hp[i] > 0);
                    for (int p = 0; p < 2; p++)
                    {
                        bool shown = hp[i] >= p + 2;
                        var plank = crates[i].transform.Find(PlankName(p));
                        var shadow = crates[i].transform.Find(PlankName(p) + "_Shadow");
                        if (plank != null) plank.gameObject.SetActive(shown);
                        if (shadow != null) shadow.gameObject.SetActive(shown);
                    }
                }
                if (hp[i] > 0) closedCells[cell] = true;
            }
            var ui = assets != null ? assets.ui : null;
            bool first = shownLocked == null;
            if (first) shownLocked = new bool[closedCells.Length];
            for (int i = 0; i < closedCells.Length; i++)
            {
                // A cell still closed behind crates is dark and fogged with a lock; a crate cell shows its crate.
                bool locked = closedCells[i] && !CrateOn(i, hp);
                if (!locked && shownLocked[i] && !first) OpenRegionCell(i);
                shownLocked[i] = locked;
                SetLockedMark(i, locked);
                if (!closedCells[i]) continue;
                // A recessed, shaded floor is still real terrain. Voids have no floor at all.
                Tint(grounds[i], ui != null ? ui.lockedFloor : new Color32(52, 46, 70, 255));
                floorEdges[i] = new Color32(146, 135, 163, 255);
                Tint(cells[i], floorEdges[i]);
            }
        }

        private bool CrateOn(int cell, int[] hp)
        {
            for (int b = 0; b < terrain.blockers.Length; b++) if (terrain.blockers[b].cell == cell && hp[b] > 0) return true;
            return false;
        }

        private void SetLockedMark(int cell, bool locked)
        {
            if (lockedMarks == null) return;
            if (lockedMarks[cell] == null)
            {
                if (!locked) return;
                lockedMarks[cell] = BuildLockedMark(cell);
            }
            lockedMarks[cell].SetActive(locked);
        }

        // Fog over the cell and the lock symbol from the icon atlas, both tinted from UiTheme.
        private GameObject BuildLockedMark(int cell)
        {
            var ui = assets != null ? assets.ui : null;
            var mark = new GameObject("Locked_" + cell);
            mark.transform.SetParent(terrainRoot.transform, false);
            mark.transform.position = positions[cell] + Vector3.back * .3f;
            var fog = new GameObject("Fog").AddComponent<SpriteRenderer>();
            fog.transform.SetParent(mark.transform, false);
            fog.sprite = FogSprite();
            fog.color = ui != null ? ui.lockedFog : new Color(.8f, .8f, .9f, .4f);
            fog.sortingOrder = 1;
            var lockIcon = new GameObject("Lock").AddComponent<SpriteRenderer>();
            lockIcon.transform.SetParent(mark.transform, false);
            lockIcon.transform.localPosition = Vector3.back * .01f;
            lockIcon.sprite = LockSprite();
            lockIcon.color = ui != null ? ui.lockedMark : Color.white;
            lockIcon.sortingOrder = 2;
            return mark;
        }

        /// <summary>A soft hexagon-sized cloud, white so UiTheme tints it.</summary>
        private static Sprite FogSprite()
        {
            if (fogSprite != null) return fogSprite;
            const int size = 64;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false) { name = "Locked fog", wrapMode = TextureWrapMode.Clamp };
            var pixels = new Color32[size * size];
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float u = (x + .5f) / size * 2 - 1, v = (y + .5f) / size * 2 - 1;
                    float d = Mathf.Sqrt(u * u + v * v);
                    // Dense centre, soft edge, a little cloudy variation.
                    float cloud = .85f + .15f * Mathf.Sin(u * 7.1f + v * 3.3f) * Mathf.Cos(v * 5.7f - u * 2.1f);
                    float a = Mathf.Clamp01((1f - Mathf.SmoothStep(.55f, 1f, d)) * cloud);
                    pixels[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
            texture.SetPixels32(pixels);
            texture.Apply(false, true);
            fogSprite = Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(.5f, .5f), size / 1.05f);
            return fogSprite;
        }

        /// <summary>The "lock" symbol from the shared icon atlas (PhoneArt/Icons, 8 x 4 grid).</summary>
        private static Sprite LockSprite()
        {
            if (lockSprite != null) return lockSprite;
            var atlas = Resources.Load<Texture2D>("PhoneArt/Icons");
            var names = Resources.Load<TextAsset>("PhoneArt/IconNames").text.Trim().Split('\n');
            int index = Array.FindIndex(names, name => name.TrimEnd('\r') == "lock");
            float tile = atlas.width / 8f, tall = atlas.height / 4f;
            var rect = new Rect(index % 8 * tile, atlas.height - (index / 8 + 1) * tall, tile, tall);
            lockSprite = Sprite.Create(atlas, rect, new Vector2(.5f, .5f), tile / .34f);
            lockSprite.name = "Lock";
            return lockSprite;
        }

        // The fog and lock lift away as the cell's area opens (MotionTheme.regionOpen).
        private void OpenRegionCell(int cell)
        {
            var motion = assets != null ? assets.motion : null;
            if (motion == null || ReducedMotion || world == null || lockedMarks == null || lockedMarks[cell] == null) return;
            var effect = new GameObject("RegionOpen_" + cell).AddComponent<RegionOpenEffect>();
            effect.transform.SetParent(world, false);
            effect.Play(lockedMarks[cell].transform, motion.regionOpen.seconds);
        }

        // The plank spins off the crate and falls (MotionTheme.cratePlankFall).
        private void DropPlank(Transform crate, int plank)
        {
            var motion = assets != null ? assets.motion : null;
            var source = crate.Find(PlankName(plank));
            if (motion == null || ReducedMotion || world == null || source == null || !source.gameObject.activeInHierarchy) return;
            var debris = CrateDebris.Create(world, "PlankFall_" + crate.name, motion.cratePlankFall.seconds);
            var copy = source.GetComponent<SpriteRenderer>();
            float side = plank == 0 ? -1f : 1f;
            debris.Add(copy.sprite, copy.color, copy.sortingOrder + 4, source.position + Vector3.back * .05f, source.rotation, source.lossyScale,
                new Vector3(side * .7f, 1.1f, 0), side * -420f);
        }

        // The last hit breaks the crate into four pieces that fly apart (MotionTheme.crateShatter).
        private void Shatter(SpriteRenderer crate)
        {
            var motion = assets != null ? assets.motion : null;
            if (motion == null || ReducedMotion || world == null || crate.sprite == null || !crate.gameObject.activeInHierarchy) return;
            if (crateFragments == null || crateFragments[0] == null)
            {
                var whole = crate.sprite;
                var r = whole.textureRect;
                crateFragments = new Sprite[4];
                for (int k = 0; k < 4; k++)
                {
                    var part = new Rect(r.x + (k % 2) * r.width * .5f, r.y + (k / 2) * r.height * .5f, r.width * .5f, r.height * .5f);
                    crateFragments[k] = Sprite.Create(whole.texture, part, new Vector2(.5f, .5f), whole.pixelsPerUnit);
                    crateFragments[k].name = "CrateFragment_" + k;
                }
            }
            var debris = CrateDebris.Create(world, "CrateShatter_" + crate.name, motion.crateShatter.seconds);
            float quarter = crate.sprite.bounds.size.x * .25f;
            for (int k = 0; k < 4; k++)
            {
                var dir = new Vector3((k % 2) * 2 - 1, (k / 2) * 2 - 1, 0);
                debris.Add(crateFragments[k], Color.white, 6, crate.transform.position + dir * quarter + Vector3.back * .05f,
                    Quaternion.identity, crate.transform.lossyScale, new Vector3(dir.x * .9f, .6f + dir.y * .5f, 0), dir.x * 300f);
            }
        }
    }
}
