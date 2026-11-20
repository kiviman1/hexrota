using System;
using Hexrota.Gameplay;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class HexBoardView
    {
        private ObstaclesConfig terrain;
        private SpriteRenderer[] crates;
        private TextMesh[] crateNumbers;
        /// <summary>The crate's durability numeral as a share of the stone numeral height.</summary>
        public const float CrateDigitScale = 1.15f;
        private bool[] closedCells;
        private GameObject terrainRoot;

        private void PrepareTerrain(ObstaclesConfig config)
        {
            if (terrainRoot != null)
            {
                terrainRoot.SetActive(false);
                Destroy(terrainRoot);
            }
            terrain = config;
            if (config == null) { closedCells = null; crates = null; crateNumbers = null; return; }
            terrainRoot = new GameObject("Obstacles");
            terrainRoot.transform.SetParent(world, false);
            closedCells = new bool[positions.Length];
            crates = new SpriteRenderer[config.blockers.Length];
            crateNumbers = new TextMesh[config.blockers.Length];
            for (int i = 0; i < crates.Length; i++)
            {
                int cell = config.blockers[i].cell;
                var crate = new GameObject("Crate_" + cell);
                crate.transform.SetParent(terrainRoot.transform, false);
                crate.transform.position = positions[cell] + Vector3.back * .6f;
                crates[i] = crate.AddComponent<SpriteRenderer>();
                // A large durability numeral over the crate, in the stones' numeral style.
                crateNumbers[i] = BuildNumeral(crate.transform, "Durability_" + cell, CrateDigitScale);
            }
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
                    if (assets != null) crates[i].sprite = hp[i] > 1 ? assets.crateTwoHits : assets.crateOneHit;
                    crates[i].gameObject.SetActive(hp[i] > 0);
                    if (crateNumbers[i] != null)
                        foreach (var label in crateNumbers[i].GetComponentsInChildren<TextMesh>(true))
                            label.text = hp[i].ToString(System.Globalization.CultureInfo.InvariantCulture);
                }
                if (hp[i] > 0) closedCells[cell] = true;
            }
            for (int i = 0; i < closedCells.Length; i++)
            {
                if (!closedCells[i]) continue;
                // A recessed, shaded floor is still real terrain. Voids have no floor at all.
                Tint(grounds[i], new Color32(117, 123, 159, 255));
                floorEdges[i] = new Color32(146, 135, 163, 255);
                Tint(cells[i], floorEdges[i]);
            }
        }
    }
}
