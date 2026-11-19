using System.Collections.Generic;
using Hexrota.Gameplay;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class HexBoardView
    {
        private struct OpeningStone
        {
            public Drop drop;
            public Vector3 restScale;
        }

        private readonly List<OpeningStone> openingStones = new List<OpeningStone>();
        private float entranceSlide = 1f;
        internal float EntranceFillSeconds { get; private set; }

        public void BeginEntrance(GameSnapshot snapshot)
        {
            EndEntrance();
            if (snapshot == null || !HasVisuals || snapshot.values.Length != positions.Length) return;
            int movingColumns = 0;
            foreach (var column in columns)
            {
                int firstStone = openingStones.Count;
                int longestRun = 0;
                int top = 0;
                while (top < column.Length)
                {
                    if (!snapshot.values[column[top]].HasValue) { top++; continue; }
                    int end = top + 1;
                    while (end < column.Length && snapshot.values[column[end]].HasValue &&
                        motionCells[column[end]].r == motionCells[column[end - 1]].r + 1) end++;

                    // Each occupied run enters through its own top edge. Crates,
                    // closed cells and void spaces split a column into separate runs.
                    float ceiling = positions[column[top]].y + RowSpacing * .5f;
                    float distance = RowSpacing * (end - top);
                    longestRun = Mathf.Max(longestRun, end - top);
                    for (int i = top; i < end; i++)
                    {
                        int cell = column[i];
                        Vector3 to = positions[cell] + Vector3.forward * StoneDepth;
                        var drop = new Drop { cell = cell, spawn = true, to = to,
                            from = to + Vector3.up * distance, ceiling = ceiling };
                        var stone = stones[cell];
                        openingStones.Add(new OpeningStone { drop = drop, restScale = stone.transform.localScale });
                        stone.transform.position = drop.from;
                        stone.SetActive(false);
                    }
                    top = end;
                }
                if (longestRun == 0) continue;
                float delay = movingColumns++ * .068f;
                float duration = DropDuration(longestRun, 1f);
                for (int i = firstStone; i < openingStones.Count; i++)
                {
                    var entry = openingStones[i];
                    entry.drop.delay = delay;
                    entry.drop.duration = duration;
                    openingStones[i] = entry;
                }
                EntranceFillSeconds = Mathf.Max(EntranceFillSeconds, delay + duration);
            }
            SetEntranceSlide(0f);
        }

        public void SetEntranceSlide(float progress)
        {
            entranceSlide = Mathf.Clamp01(progress);
            if (BoardCamera == null || positions == null || positions.Length == 0) return;
            // Moving the camera keeps world-space clipping and the board's hit coordinates intact.
            float screenSpan = 2f * BoardCamera.orthographicSize * Screen.width / Mathf.Max(1, BoardCamera.pixelHeight);
            BoardCamera.transform.position = restingCamera - Vector3.right * ((1f - entranceSlide) * screenSpan);
        }

        public void SetEntranceFill(float progress)
        {
            if (entranceSlide < 1f || !HasVisuals) return;
            float elapsed = Mathf.Clamp01(progress) * EntranceFillSeconds;
            foreach (var entry in openingStones)
            {
                var drop = entry.drop;
                float t = Mathf.Clamp01((elapsed - drop.delay) / drop.duration);
                DrawFall(drop, t);
                var stone = stones[drop.cell];
                bool inside = stone.transform.position.y < drop.ceiling;
                if (stone.activeSelf != inside) stone.SetActive(inside);
            }
        }

        public void EndEntrance()
        {
            if (entranceSlide != 1f) SetEntranceSlide(1f);
            foreach (var entry in openingStones)
            {
                int cell = entry.drop.cell;
                if (cell >= stones.Count || stones[cell] == null) continue;
                var stone = stones[cell];
                stone.transform.position = entry.drop.to;
                stone.transform.localScale = entry.restScale;
                if (tint != null) SetMotionInk(stone, 1f, 0f);
                stone.SetActive(true);
            }
            openingStones.Clear();
            EntranceFillSeconds = 0f;
        }
    }
}
