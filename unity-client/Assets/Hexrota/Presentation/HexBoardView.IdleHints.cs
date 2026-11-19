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
        private TutorialGestureArrow idleOutline;
        private Transform hintedStone;
        private Vector3 hintHome, hintDirection;
        private float lastPulse = -1f;
        public bool ShowingIdleHint => paintedHint != null;

        internal void BindIdleHintOverlay(TutorialGestureArrow template)
        {
            // The coach still uses arrows. The idle hint shares its authored stroke style.
            idleOutline = Instantiate(template, transform, false);
            idleOutline.name = "IdleMatchOutline";
            idleOutline.raycastTarget = false;
            idleOutline.gameObject.SetActive(false);
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
            var next = idleClock.ActiveCue;
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
                if (idleOutline != null)
                {
                    idleOutline.SetPair(ViewportCell(next.MovingSource), ViewportCell(next.MovingTarget));
                    idleOutline.gameObject.SetActive(true);
                }
            }

            float phase = idleClock.Phase;
            float pulse = ReducedMotion ? 0f : .5f - .5f * Mathf.Cos(phase * Mathf.PI);
            if (idleOutline != null)
                idleOutline.canvasRenderer.SetAlpha(ReducedMotion ? 1f : Mathf.Lerp(.66f, 1f, pulse));
            // Three quick nudges, then a rest. The outline stays aligned to the board.
            float tick = Mathf.Repeat(phase * 3f, 1f);
            float nudge = ReducedMotion || phase >= 1f ? 0f :
                Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(0f, .24f, tick)) *
                (1f - Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(.24f, .58f, tick)));
            if (hintedStone != null) hintedStone.position = hintHome + hintDirection * nudge;
            if (Mathf.Approximately(lastPulse, pulse)) return;
            lastPulse = pulse;
            SetIdleGlow(sourceModels, .48f, .12f * pulse);
        }

        private void CacheHintModels(VisibleIdleHint hint)
        {
            ClearHintAppearance();
            cachedHint = hint;
            var source = stones[hint.MovingSource];
            hintedStone = source.transform;
            hintHome = hintedStone.position;
            hintDirection = (positions[hint.MovingTarget] - positions[hint.MovingSource]) * .14f;
            source.GetComponentsInChildren(false, rendererBuffer);
            foreach (var renderer in rendererBuffer)
                if (!renderer.TryGetComponent<TextMesh>(out _)) sourceModels.Add(renderer);
            rendererBuffer.Clear();
            if (idleOutline != null) idleOutline.SetMatchEdges(MatchPerimeter(hint));
        }

        private Vector2[] MatchPerimeter(VisibleIdleHint hint)
        {
            // Shared edges have opposite directions on the integer hex lattice.
            var edges = new HashSet<(Vector2Int from, Vector2Int to)>();
            var cells = new HashSet<int>(hint.MatchDestinations) { hint.MovingSource };
            foreach (int index in cells)
            {
                var cell = motionCells[index];
                var center = new Vector2Int(3 * cell.q, -2 * cell.r - cell.q);
                for (int i = 0; i < HintCorners.Length; i++)
                {
                    Vector2Int from = center + HintCorners[i], to = center + HintCorners[(i + 1) % HintCorners.Length];
                    if (!edges.Remove((to, from))) edges.Add((from, to));
                }
            }
            var perimeter = new Vector2[edges.Count * 2];
            int point = 0;
            foreach (var edge in edges)
            {
                perimeter[point++] = ProjectCorner(edge.from);
                perimeter[point++] = ProjectCorner(edge.to);
            }
            return perimeter;
        }

        private Vector2 ProjectCorner(Vector2Int corner) =>
            BoardCamera.WorldToViewportPoint(new Vector3(corner.x * .28f, corner.y * RowSpacing * .5f, 0f));

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
            if (idleOutline != null) idleOutline.gameObject.SetActive(false);
            if (hintedStone != null) hintedStone.position = hintHome;
            SetIdleGlow(sourceModels, 0, 0);
        }

        private void ClearHintAppearance()
        {
            HidePaintedHint();
            cachedHint = null;
            hintedStone = null;
            sourceModels.Clear();
        }
    }
}
