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
        internal const float MatchCollected = .29f;
        private const float WaveSeconds = 1.25f;

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
        private int[][] columns;
        private Vector3[] matchCenters;
        private Vector3 waveCenter;
        internal Vector2 MatchCenterInViewport => BoardCamera != null
            ? (Vector2)BoardCamera.WorldToViewportPoint(waveCenter) : Vector2.zero;
        private bool[] unvisitedMatch;
        private int[] connectedMatch;
        private Rect pressedViewport;
        private float swipePixelScale;
        private bool segmentedGravity;

        private void PrepareMotion(LevelConfig level)
        {
            motionCells = level.cells;
            var topology = BoardTopology.For(level);
            swipeNeighbors = topology.neighbors;
            columns = topology.columns;
            matchCenters = new Vector3[level.cells.Length];
            unvisitedMatch = new bool[level.cells.Length];
            connectedMatch = new int[level.cells.Length];
            segmentedGravity = level.obstacles != null;
            columnTop.Clear();
            motionInk.Clear();
            for (int i = 0; i < stones.Count; i++)
            {
                int q = level.cells[i].q;
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

        private void SampleSwipe(Vector2 cursor)
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
                if (!stones[neighbor].activeSelf || !AcceptsOpeningSwap(pressed, neighbor)) continue;
                Vector2 direction = (Vector2)BoardCamera.WorldToScreenPoint(positions[neighbor]) - origin;
                float spacing = direction.magnitude;
                if (spacing <= 0f) continue;
                float alignment = Vector2.Dot(heading, direction / spacing);
                // The web input uses a 22.5-degree cone and 12–20 logical pixels.
                float threshold = Mathf.Clamp(spacing * .28f, 12f * swipePixelScale, 20f * swipePixelScale);
                if (alignment < .9238795f || distance * alignment < threshold) continue;
                int from = pressed;
                // Consume the gesture before dispatch. Subsequent drag and release events cannot swap again.
                ResetGesture();
                Request(from, neighbor);
                return;
            }
        }

        private void ResetGesture()
        {
            pointer = int.MinValue;
            pressed = -1;
            dragged = false;
        }

        private IEnumerator Animate(MovePresentation receipt)
        {
            bool pair = receipt.A >= 0 && receipt.B >= 0 && receipt.A < stones.Count && receipt.B < stones.Count;
            if (pair)
            {
                yield return SwapMotion(receipt.A, receipt.B, receipt.Ok);
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
                float pace = Mathf.Min(1f, 3.3f / (waves.Length * WaveSeconds));
                for (int i = 0; i < waves.Length; i++)
                {
                    yield return AnimateWave(waves[i], i + 1, pace);
                    if (!HasVisuals) { Cancel(null); yield break; }
                    if (i + 1 < waves.Length) yield return new WaitForSecondsRealtime(.075f);
                }
            }
            Render(receipt.After);
            IsAnimating = false;
            animation = null;
            PresentationCompleted?.Invoke();
        }

        private IEnumerator SwapMotion(int a, int b, bool valid)
        {
            const float nudgeTime = .092f;
            float duration = valid ? .22f : .24f;
            for (float elapsed = 0; ; elapsed += Time.unscaledDeltaTime)
            {
                if (!HasVisuals) yield break;
                float t = Mathf.Clamp01(elapsed / duration);
                float fraction;
                if (valid)
                    fraction = Mathf.SmoothStep(0f, 1f, t);
                else if (elapsed < nudgeTime)
                    fraction = Mathf.SmoothStep(0f, .24f, elapsed / nudgeTime);
                else
                    fraction = Mathf.SmoothStep(.24f, 0f, Mathf.InverseLerp(nudgeTime, duration, elapsed));
                MoveAlongSwap(a, b, fraction);
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
            if (number != null) number.gameObject.name = "Value_" + cell;
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
            public float delay, ceiling, duration;
            public Vector3 from, to;
        }

        private static float DropDuration(float rows, float pace) =>
            Mathf.Max(.32f, (.38f + .10f * Mathf.Sqrt(rows)) * pace);

        private Drop[] Routes(WaveFrame wave, float pace, out float lastLanding)
        {
            var drops = new Drop[wave.falls.Length];
            var longestInColumn = new Dictionary<int, float>();
            lastLanding = 0;
            for (int i = 0; i < drops.Length; i++)
            {
                var fall = wave.falls[i];
                int q = motionCells[fall.to].q;
                Vector3 to = positions[fall.to] + Vector3.forward * StoneDepth;
                var drop = new Drop { cell = fall.to, spawn = fall.spawn, to = to };
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
                float rowsToFall = Mathf.Abs(drop.from.y - to.y) / RowSpacing;
                longestInColumn.TryGetValue(q, out float farthest);
                longestInColumn[q] = Mathf.Max(farthest, rowsToFall);
            }
            // Only columns with moving stones take a turn in the left-to-right cascade.
            var columnDelays = new Dictionary<int, float>();
            foreach (var column in columns)
            {
                int q = motionCells[column[0]].q;
                if (longestInColumn.ContainsKey(q)) columnDelays.Add(q, columnDelays.Count * .052f * pace);
            }
            for (int i = 0; i < drops.Length; i++)
            {
                int q = motionCells[drops[i].cell].q;
                // Share the clock across each column to preserve the order of its stones.
                drops[i].delay = columnDelays[q];
                drops[i].duration = DropDuration(longestInColumn[q], pace);
                lastLanding = Mathf.Max(lastLanding, drops[i].duration + drops[i].delay);
            }
            return drops;
        }

        private Vector3 LocateMatches(WaveFrame wave)
        {
            Vector3 center = Vector3.zero;
            foreach (int cell in wave.matched)
            {
                center += positions[cell];
                unvisitedMatch[cell] = true;
            }
            // These are already committed matches. Group their art locally before
            // joining the single gain supplied for this wave, even for two distant runs.
            foreach (int cell in wave.matched)
            {
                if (!unvisitedMatch[cell]) continue;
                Vector3 localCenter = Vector3.zero;
                connectedMatch[0] = cell;
                int count = 1;
                unvisitedMatch[cell] = false;
                for (int i = 0; i < count; i++)
                {
                    int current = connectedMatch[i];
                    localCenter += positions[current];
                    foreach (int neighbor in swipeNeighbors[current])
                    {
                        if (!unvisitedMatch[neighbor] || wave.before[neighbor] != wave.before[cell]) continue;
                        unvisitedMatch[neighbor] = false;
                        connectedMatch[count++] = neighbor;
                    }
                }
                localCenter /= count;
                for (int i = 0; i < count; i++) matchCenters[connectedMatch[i]] = localCenter;
            }
            return center / Mathf.Max(1, wave.matched.Length);
        }

        private void GatherStones(WaveFrame wave, Vector3 center, float phase)
        {
            float gather = Mathf.InverseLerp(.09f, 1f, phase);
            float travel = Mathf.SmoothStep(0f, 1f, gather);
            float pulse = Mathf.Sin(Mathf.PI * Mathf.InverseLerp(0f, .35f, phase));
            float size = Mathf.Lerp(1f, .16f, travel) + .075f * pulse;
            float opacity = 1f - Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(.77f, 1f, phase));
            float flash = Mathf.Sin(Mathf.PI * Mathf.InverseLerp(0f, .85f, phase)) * .8f;
            for (int i = 0; i < wave.matched.Length; i++)
            {
                int cell = wave.matched[i];
                var stone = stones[cell];
                Vector3 source = positions[cell];
                Vector3 control = Vector3.Lerp(source, matchCenters[cell], .56f);
                Vector3 point = Vector3.Lerp(Vector3.Lerp(source, control, travel),
                    Vector3.Lerp(control, center, travel), travel);
                point.z = StoneDepth - (.30f + .003f * i) * travel;
                stone.transform.position = point;
                stone.transform.localScale = Vector3.one * size;
                SetMotionInk(stone, opacity, flash);
                if (phase >= 1f) stone.SetActive(false);
            }
        }

        private IEnumerator AnimateWave(WaveFrame wave, int ordinal, float pace)
        {
            waveCenter = LocateMatches(wave);
            var drops = Routes(wave, pace, out float lastLanding);
            float duration = Mathf.Max(WaveSeconds * pace, lastLanding / (1f - MatchCollected));
            float fallStart = MatchCollected * duration;
            bool cleared = false, falling = false;
            for (float elapsed = 0; ; elapsed += Time.unscaledDeltaTime)
            {
                if (!HasVisuals) yield break;
                if (!cleared)
                {
                    float t = Mathf.Clamp01(elapsed / fallStart);
                    GatherStones(wave, waveCenter, t);
                    if (t >= 1f)
                    {
                        cleared = true;
                        for (int i = 0; i < grounds.Count; i++) PaintFloor(i, wave.layers[i]);
                        PaintTerrain(wave.blockerHp, wave.cellOpen, wave.regionOpen);
                    }
                }
                if (elapsed >= fallStart)
                {
                    if (!falling) { AssignFallDestinations(wave); falling = true; }
                    foreach (var drop in drops)
                        DrawFall(drop, Mathf.Clamp01((elapsed - fallStart - drop.delay) / drop.duration));
                }
                WaveProgress?.Invoke(wave, ordinal, Mathf.Clamp01(elapsed / duration));
                if (elapsed >= duration) yield break;
                yield return null;
            }
        }

        private void DrawFall(Drop drop, float t)
        {
            var stone = stones[drop.cell];
            const float contact = .72f;
            float flight = Mathf.Clamp01(t / contact);
            float descent = flight * flight * (1.45f - .45f * flight);
            Vector3 point = Vector3.Lerp(drop.from, drop.to, descent);
            float stretch = .060f * descent * (1f - Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(.82f, 1f, flight)));
            float landing = Mathf.InverseLerp(contact, 1f, t);
            float impact = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(0f, .14f, landing))
                * (1f - Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(.14f, .40f, landing)));
            float rebound = Mathf.InverseLerp(.23f, 1f, landing);
            float arc = 4f * rebound * (1f - rebound);
            point.y += RowSpacing * .105f * arc * arc;
            stone.transform.position = point;
            stone.transform.localScale = new Vector3(1f + .085f * impact - stretch * .5f, 1f - .10f * impact + stretch, 1f);
            float opacity = drop.spawn ? Mathf.SmoothStep(0, 1, (drop.ceiling - point.y) / (.5f * RowSpacing)) : 1f;
            SetMotionInk(stone, opacity, 0f, drop.spawn && flight < 1f ? drop.ceiling : NoCeiling);
        }
    }
}
