using System;
using System.Collections.Generic;
using System.Globalization;
using Hexrota.Gameplay;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class HexBoardView
    {
        private readonly IdleHintClock idleClock = new IdleHintClock();
        private readonly List<Renderer> sourceModels = new List<Renderer>();
        private readonly List<Renderer> rendererBuffer = new List<Renderer>();
        private static readonly Vector2Int[] HintCorners = {
            new Vector2Int(2, 0), new Vector2Int(1, 1), new Vector2Int(-1, 1),
            new Vector2Int(-2, 0), new Vector2Int(-1, -1), new Vector2Int(1, -1)
        };
        private string idleAttempt;
        private Func<int[], VisibleIdleHint> chooseIdleHint;
        private VisibleIdleHint cachedHint, paintedHint;
        private TutorialGestureArrow idleArrow;
        private float lastPulse = -1f;
        public bool ShowingIdleHint => paintedHint != null;

        internal void BindIdleHintOverlay(TutorialGestureArrow template)
        {
            // Keep tutorial gestures and ordinary hints independently visible, but
            // share the artist's colours and stroke settings from the tools prefab.
            idleArrow = Instantiate(template, transform, false);
            idleArrow.name = "IdleSwapDirection";
            idleArrow.raycastTarget = false;
            idleArrow.gameObject.SetActive(false);
        }

        public void BindIdleHints(string attemptId, Func<int[], VisibleIdleHint> choose)
        {
            StopIdleHint();
            idleAttempt = attemptId;
            chooseIdleHint = choose;
        }

        public void PlayerMoved(GameSnapshot after)
        {
            ClearHintAppearance();
            idleClock.PlayerMoved(VisibleKey(after));
        }

        private static string VisibleKey(GameSnapshot board)
        {
            // The attempt binds the stage identity. Only visible facts can
            // re-arm a second cue; never use the RNG or presentation revision.
            return string.Join("|",board.score.ToString(CultureInfo.InvariantCulture), board.movesLeft.ToString(CultureInfo.InvariantCulture),
                string.Join(",",board.values),string.Join(",",board.layers), ArrayKey(board.blockerHp),ArrayKey(board.regionOpen),
                ArrayKey(board.cellOpen),ArrayKey(board.materialCounts),ArrayKey(board.collectedSources));
        }
        private static string ArrayKey<T>(T[] data) { return data == null ? "" : string.Join(",",data); }

        private void LateUpdate()
        {
            if (lessonPair != null || idleAttempt == null || chooseIdleHint == null) return;
            bool interactive = InputEnabled && !IsAnimating && BoardCamera != null && BoardCamera.enabled &&
                pointer == int.MinValue && selected < 0 && targetCell == null && world != null;
            if (!interactive || Input.anyKeyDown || Input.touchCount > 0 || Input.mouseScrollDelta.sqrMagnitude > 0)
            {
                StopIdleHint();
                return;
            }

            idleClock.Tick(Time.unscaledTimeAsDouble, true, chooseIdleHint);
            // Reduced motion keeps one static direction, without repeated flashes.
            var next = ReducedMotion ? idleClock.ActiveCue : idleClock.Visible;
            if (next == null)
            {
                HidePaintedHint();
                return;
            }
            if (next != cachedHint)
            {
                if (!HasVisuals) { StopIdleHint(); return; }
                CacheHintModels(next);
            }
            if (paintedHint == null)
            {
                paintedHint = next;
                if (idleArrow != null)
                {
                    idleArrow.SetPair(ViewportCell(next.MovingSource), ViewportCell(next.MovingTarget));
                    idleArrow.gameObject.SetActive(true);
                }
            }

            float progress = Mathf.Clamp01(idleClock.Phase);
            float pulse = ReducedMotion ? 0f : Mathf.Sin(progress * Mathf.PI);
            if (idleArrow != null)
                idleArrow.SetSweep(ReducedMotion ? -1f : Mathf.SmoothStep(0f, 1f, progress));
            if (Mathf.Approximately(lastPulse, pulse)) return;
            lastPulse = pulse;
            SetIdleGlow(sourceModels, .48f, .12f * pulse);
        }

        private void CacheHintModels(VisibleIdleHint hint)
        {
            ClearHintAppearance();
            cachedHint = hint;
            stones[hint.MovingSource].GetComponentsInChildren(false, rendererBuffer);
            foreach (var renderer in rendererBuffer)
                if (!renderer.TryGetComponent<TextMesh>(out _)) sourceModels.Add(renderer);
            rendererBuffer.Clear();
            if (idleArrow != null) idleArrow.SetMatchLoops(MatchPerimeter(hint));
        }

        private Vector2[][] MatchPerimeter(VisibleIdleHint hint)
        {
            // Shared edges have opposite directions on the integer hex lattice.
            var edges = new HashSet<(Vector2Int from, Vector2Int to)>();
            foreach (int index in hint.MatchDestinations)
            {
                var cell = motionCells[index];
                var center = new Vector2Int(3 * cell.q, -2 * cell.r - cell.q);
                for (int i = 0; i < HintCorners.Length; i++)
                {
                    Vector2Int from = center + HintCorners[i], to = center + HintCorners[(i + 1) % HintCorners.Length];
                    if (!edges.Remove((to, from))) edges.Add((from, to));
                }
            }
            var next = new Dictionary<Vector2Int, Vector2Int>();
            foreach (var edge in edges) next.Add(edge.from, edge.to);
            var loops = new List<Vector2[]>();
            var target = motionCells[hint.MovingTarget];
            var origin = new Vector2Int(3 * target.q, -2 * target.r - target.q);
            while (next.Count > 0)
            {
                Vector2Int first = default;
                float nearest = float.PositiveInfinity;
                foreach (var vertex in next.Keys)
                {
                    float distance = (vertex - origin).sqrMagnitude;
                    if (distance >= nearest) continue;
                    nearest = distance;
                    first = vertex;
                }
                var loop = new List<Vector2>();
                Vector2Int point = first;
                do
                {
                    // Same scale as MobileLayout.Axial, in units of a hex corner.
                    loop.Add(BoardCamera.WorldToViewportPoint(new Vector3(point.x * .28f, point.y * RowSpacing * .5f, 0f)));
                    Vector2Int end = next[point];
                    next.Remove(point);
                    point = end;
                } while (point != first);
                loops.Add(loop.ToArray());
            }
            return loops.ToArray();
        }

        private void SetIdleGlow(List<Renderer> models, float outline, float sheen)
        {
            if (tint == null) return;
            foreach (var model in models)
            {
                if (model == null) continue;
                model.GetPropertyBlock(tint);
                tint.SetFloat("_IdleOutline", outline);
                tint.SetFloat("_IdleSheen", sheen);
                model.SetPropertyBlock(tint);
            }
        }

        private void StopIdleHint()
        {
            idleClock.Interrupt();
            ClearHintAppearance();
        }

        private void HidePaintedHint()
        {
            if (paintedHint == null) return;
            paintedHint = null;
            lastPulse = -1f;
            if (idleArrow != null) idleArrow.gameObject.SetActive(false);
            SetIdleGlow(sourceModels, 0, 0);
        }

        private void ClearHintAppearance()
        {
            HidePaintedHint();
            cachedHint = null;
            sourceModels.Clear();
        }
    }
}
