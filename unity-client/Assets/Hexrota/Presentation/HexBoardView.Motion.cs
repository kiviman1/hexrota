using System.Collections;
using System.Collections.Generic;
using Hexrota.Gameplay;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class HexBoardView
    {
        private const float StoneDepth = -.15f;
        private static readonly float RowSpacing = Mathf.Abs(MobileLayout.Axial(0, 1).y);
        private static readonly int MotionOpacity = Shader.PropertyToID("_MotionOpacity");
        private static readonly int MotionFlash = Shader.PropertyToID("_MotionFlash");
        private static readonly int SpawnCeiling = Shader.PropertyToID("_SpawnCeiling");
        private const float NoCeiling = 100000f;

        private sealed class StoneInk
        {
            public Renderer[] renderers;
            public float opacity = 1f;
            public float flash;
            public float ceiling = NoCeiling;
        }

        private readonly Dictionary<GameObject, StoneInk> motionInk = new Dictionary<GameObject, StoneInk>();
        private readonly Dictionary<int, float> columnTop = new Dictionary<int, float>();
        private Cell[] motionCells;
        private int[][] swipeNeighbors;
        private int swipeTarget = -1;
        private Rect pressedViewport;
        private float swipePixelScale;
        private int firstColumn;
        private bool segmentedGravity;
        private int dragSource = -1, dragTarget = -1;
        private float dragFraction, releasedFraction;

        private void PrepareMotion(LevelConfig level)
        {
            motionCells = level.cells;
            swipeNeighbors = BoardTopology.For(level).neighbors;
            segmentedGravity = level.obstacles != null;
            firstColumn = int.MaxValue;
            columnTop.Clear();
            motionInk.Clear();
            for (int i = 0; i < stones.Count; i++)
            {
                int q = level.cells[i].q;
                firstColumn = Mathf.Min(firstColumn, q);
                if (!columnTop.TryGetValue(q, out float highest) || positions[i].y > highest)
                    columnTop[q] = positions[i].y;
                motionInk.Add(stones[i], new StoneInk { renderers = stones[i].GetComponentsInChildren<Renderer>(true) });
            }
        }

        private void SetMotionInk(GameObject stone, float opacity, float flash, float ceiling = NoCeiling)
        {
            var ink = motionInk[stone];
            if (ink.opacity == opacity && ink.flash == flash && ink.ceiling == ceiling) return;
            ink.opacity = opacity;
            ink.flash = flash;
            ink.ceiling = ceiling;
            foreach (var renderer in ink.renderers)
            {
                if (renderer == null) continue;
                renderer.GetPropertyBlock(tint);
                tint.SetFloat(MotionOpacity, opacity);
                tint.SetFloat(MotionFlash, flash);
                tint.SetFloat(SpawnCeiling, ceiling);
                renderer.SetPropertyBlock(tint);
            }
        }

        // A second native touch may land on the HUD and never send this view an event.
        private void Update()
        {
            if (pointer != int.MinValue && TouchInterrupted()) OnCancel(null);
        }

        private bool TouchInterrupted()
        {
            if (Input.touchCount > 1) return true;
            if (Input.touchCount == 0) return false;
            var touch = Input.GetTouch(0);
            return touch.fingerId != pointer || touch.phase == TouchPhase.Canceled;
        }

        private void SampleSwipe(Vector2 cursor, bool preview)
        {
            if (!InputEnabled || IsAnimating || !HasVisuals || BoardCamera == null ||
                BoardCamera.pixelRect != pressedViewport || !pressedViewport.Contains(cursor) || TouchInterrupted())
            {
                OnCancel(null);
                return;
            }
            Vector2 delta = cursor - down;
            float distance = delta.magnitude;
            if (distance >= 12f * swipePixelScale) dragged = true;
            if (!dragged || targetCell != null) return;

            Vector2 origin = BoardCamera.WorldToScreenPoint(positions[pressed]);
            Vector2 heading = distance > 0f ? delta / distance : Vector2.zero;
            foreach (int neighbor in swipeNeighbors[pressed])
            {
                if (!stones[neighbor].activeSelf) continue;
                Vector2 direction = (Vector2)BoardCamera.WorldToScreenPoint(positions[neighbor]) - origin;
                float spacing = direction.magnitude;
                if (spacing <= 0f) continue;
                float alignment = Vector2.Dot(heading, direction / spacing);
                // The web input uses a 22.5-degree cone and 12–20 logical pixels.
                float threshold = Mathf.Clamp(spacing * .28f, 12f * swipePixelScale, 20f * swipePixelScale);
                if (alignment < .9238795f || distance * alignment < threshold) continue;
                if (swipeTarget >= 0 && neighbor != swipeTarget) { OnCancel(null); return; }
                swipeTarget = neighbor;
                break;
            }
            if (!preview || swipeTarget < 0 || ReducedMotion) return;
            Vector2 path = (Vector2)BoardCamera.WorldToScreenPoint(positions[swipeTarget]) - origin;
            dragSource = pressed;
            dragTarget = swipeTarget;
            dragFraction = Mathf.Clamp(Vector2.Dot(delta, path) / path.sqrMagnitude * .75f, 0f, .48f);
            MoveAlongSwap(dragSource, dragTarget, dragFraction);
        }

        private void ResetGesture()
        {
            ClearDragPose();
            pointer = int.MinValue;
            pressed = swipeTarget = -1;
            dragged = false;
        }

        private void ClearDragPose()
        {
            if (dragSource >= 0 && dragSource < stones.Count && stones[dragSource] != null)
                stones[dragSource].transform.position = positions[dragSource] + Vector3.forward * StoneDepth;
            if (dragTarget >= 0 && dragTarget < stones.Count && stones[dragTarget] != null)
                stones[dragTarget].transform.position = positions[dragTarget] + Vector3.forward * StoneDepth;
            dragSource = dragTarget = -1;
            dragFraction = 0f;
        }

        private IEnumerator Animate(MovePresentation receipt, float releasedAt)
        {
            bool pair = receipt.A >= 0 && receipt.B >= 0 && receipt.A < stones.Count && receipt.B < stones.Count;
            if (pair)
            {
                yield return SwapMotion(receipt.A, receipt.B, receipt.Ok, releasedAt);
                if (!HasVisuals) { Cancel(null); yield break; }
                if (receipt.Ok)
                {
                    var a = stones[receipt.A];
                    var number = numbers[receipt.A];
                    AssignStone(receipt.A, stones[receipt.B], numbers[receipt.B]);
                    AssignStone(receipt.B, a, number);
                }
            }
            if (receipt.Ok && receipt.Swap != null)
            {
                var waves = receipt.Swap.frames;
                if (!pair && waves.Length > 0)
                {
                    // A color-key receipt can change a gem before its first match.
                    for (int i = 0; i < stones.Count; i++)
                        if (receipt.Before.values[i] != waves[0].before[i]) PaintStone(i, waves[0].before[i]);
                }
                float pace = Mathf.Min(1f, 3f / Mathf.Max(1, waves.Length * .9f));
                for (int i = 0; i < waves.Length; i++)
                {
                    yield return AnimateWave(waves[i], i + 1, pace);
                    if (!HasVisuals) { Cancel(null); yield break; }
                }
            }
            Render(receipt.After);
            IsAnimating = false;
            animation = null;
            PresentationCompleted?.Invoke();
        }

        private IEnumerator SwapMotion(int a, int b, bool valid, float releasedAt)
        {
            float duration = valid ? .30f * (1f - releasedAt) : .28f;
            Vector3 towards = Vector3.ClampMagnitude(positions[b] - positions[a], RowSpacing) * .25f;
            for (float elapsed = 0; ; elapsed += Time.unscaledDeltaTime)
            {
                if (!HasVisuals) yield break;
                float t = Mathf.Clamp01(elapsed / duration);
                if (valid) MoveAlongSwap(a, b, Mathf.SmoothStep(releasedAt, 1f, t));
                else if (releasedAt > 0f) MoveAlongSwap(a, b, Mathf.SmoothStep(releasedAt, 0f, t));
                else
                {
                    float reach = t < .4f ? t / .4f : (1f - t) / .6f;
                    Vector3 nudge = towards * Mathf.SmoothStep(0, 1, reach);
                    stones[a].transform.position = positions[a] + Vector3.forward * StoneDepth + nudge;
                    stones[b].transform.position = positions[b] + Vector3.forward * StoneDepth - nudge;
                }
                if (t >= 1f) yield break;
                yield return null;
            }
        }

        private void AssignStone(int cell, GameObject stone, TextMesh number)
        {
            if (stones[cell] == stone) return;
            stones[cell] = stone;
            numbers[cell] = number;
            stone.name = "Stone_" + cell;
            number.gameObject.name = "Value_" + cell;
        }

        // Snapshot the old permutation first. A destination can itself be another
        // fall's source, including when both stones show the same number.
        private void AssignFallDestinations(WaveFrame wave)
        {
            var oldStones = stones.ToArray();
            var oldNumbers = numbers.ToArray();
            var reserved = new bool[stones.Count];
            var arriving = new bool[stones.Count];
            var assigned = new bool[stones.Count];
            foreach (var fall in wave.falls)
            {
                arriving[fall.to] = true;
                if (!fall.from.HasValue) continue;
                int from = fall.from.Value;
                AssignStone(fall.to, oldStones[from], oldNumbers[from]);
                assigned[fall.to] = reserved[from] = true;
            }
            for (int i = 0; i < stones.Count; i++)
                if (!arriving[i] && !reserved[i]) assigned[i] = reserved[i] = true;
            int spare = 0;
            for (int i = 0; i < stones.Count; i++)
            {
                if (!assigned[i])
                {
                    while (reserved[spare]) spare++;
                    AssignStone(i, oldStones[spare], oldNumbers[spare]);
                    spare++;
                    PaintStone(i, wave.after[i]);
                }
                else if (!arriving[i] && wave.before[i] != wave.after[i]) PaintStone(i, wave.after[i]);
            }
        }

        private struct Drop
        {
            public int cell;
            public bool spawn;
            public float delay, ceiling;
            public Vector3 from, to;
        }

        private Drop[] Routes(WaveFrame wave, float pace, out float lastDelay)
        {
            var drops = new Drop[wave.falls.Length];
            lastDelay = 0;
            for (int i = 0; i < drops.Length; i++)
            {
                var fall = wave.falls[i];
                int q = motionCells[fall.to].q;
                Vector3 to = positions[fall.to] + Vector3.forward * StoneDepth;
                var drop = new Drop { cell = fall.to, spawn = fall.spawn, to = to,
                    delay = Mathf.Min(.070f, (q - firstColumn) * .016f) * pace };
                if (fall.spawn)
                {
                    int order = fall.spawnOrder.GetValueOrDefault();
                    float head = segmentedGravity ? to.y + order * RowSpacing : columnTop[q];
                    // Maintain one cell of separation as the column enters below its blocker.
                    int rows = fall.spawnCount.GetValueOrDefault(1) - order;
                    drop.from = new Vector3(to.x, head + RowSpacing * rows, to.z);
                    drop.ceiling = head + RowSpacing * .5f;
                }
                else drop.from = positions[fall.from.Value] + Vector3.forward * StoneDepth;
                drops[i] = drop;
                lastDelay = Mathf.Max(lastDelay, drop.delay);
            }
            return drops;
        }

        private IEnumerator AnimateWave(WaveFrame wave, int ordinal, float pace)
        {
            float burst = .22f * pace, fallStart = .25f * pace;
            float fallDuration = Mathf.Max(.28f, .38f * pace);
            var drops = Routes(wave, pace, out float lastDelay);
            float duration = Mathf.Max(fallStart + fallDuration + lastDelay, .81f * pace);
            bool cleared = false, falling = false;
            for (float elapsed = 0; ; elapsed += Time.unscaledDeltaTime)
            {
                if (!HasVisuals) yield break;
                if (!cleared)
                {
                    float t = Mathf.Clamp01(elapsed / burst);
                    float vanish = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(.25f, 1f, t));
                    float size = t < .25f ? Mathf.Lerp(1f, 1.12f, t / .25f) : Mathf.Lerp(1.12f, .40f, vanish);
                    foreach (int cell in wave.matched)
                    {
                        var stone = stones[cell];
                        stone.transform.localScale = Vector3.one * size;
                        SetMotionInk(stone, 1f - vanish, Mathf.Sin(Mathf.PI * t));
                        if (t >= 1f) stone.SetActive(false);
                    }
                    if (t >= 1f)
                    {
                        cleared = true;
                        for (int i = 0; i < grounds.Count; i++) PaintFloor(i, wave.layers[i]);
                    }
                }
                if (elapsed >= fallStart)
                {
                    if (!falling) { AssignFallDestinations(wave); falling = true; }
                    foreach (var drop in drops)
                        DrawFall(drop, Mathf.Clamp01((elapsed - fallStart - drop.delay) / fallDuration));
                }
                WaveProgress?.Invoke(wave, ordinal, Mathf.Clamp01(elapsed / duration));
                if (elapsed >= duration) yield break;
                yield return null;
            }
        }

        private void DrawFall(Drop drop, float t)
        {
            var stone = stones[drop.cell];
            float flight = Mathf.Clamp01(t / .82f);
            float descent = flight * (.48f + .52f * flight);
            Vector3 point = Vector3.Lerp(drop.from, drop.to, descent);
            // A short compression at contact followed by one much smaller rebound.
            float impact = t < .82f ? 0f : Mathf.Sin(Mathf.PI * Mathf.InverseLerp(.82f, .93f, t));
            float rebound = t < .93f ? 0f : Mathf.Sin(Mathf.PI * Mathf.InverseLerp(.93f, 1f, t));
            point.y += rebound * .012f - impact * .033f;
            stone.transform.position = point;
            stone.transform.localScale = new Vector3(1f + .055f * impact, 1f - .065f * impact, 1f);
            float opacity = drop.spawn ? Mathf.SmoothStep(0, 1, (drop.ceiling - point.y) / (.5f * RowSpacing)) : 1f;
            SetMotionInk(stone, opacity, 0f, drop.spawn && flight < 1f ? drop.ceiling : NoCeiling);
        }
    }
}
