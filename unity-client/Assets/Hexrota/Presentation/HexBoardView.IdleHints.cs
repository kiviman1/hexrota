using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Hexrota.Gameplay;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    public sealed partial class HexBoardView
    {
        private readonly IdleHintClock idleClock = new IdleHintClock();
        private readonly Dictionary<int,Renderer[]> idleModels = new Dictionary<int,Renderer[]>();
        private string idleAttempt;
        private Func<int[],VisibleIdleHint> chooseIdleHint;
        private VisibleIdleHint paintedHint;
        public bool ShowingIdleHint { get { return paintedHint != null; } }

        public void BindIdleHints(string attemptId,Func<int[],VisibleIdleHint> choose)
        {
            StopIdleHint(); idleAttempt = attemptId; chooseIdleHint = choose;
        }
        public void PlayerMoved(GameSnapshot after) { idleClock.PlayerMoved(VisibleKey(after)); }

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
            if (idleAttempt == null || chooseIdleHint == null) return;
            bool interactive = InputEnabled && !IsAnimating && BoardCamera != null && isActiveAndEnabled &&
                pointer == int.MinValue && selected < 0 && targetCell == null && world != null;
            if (Input.anyKeyDown || Input.touchCount > 0 || Input.mouseScrollDelta.sqrMagnitude > 0) StopIdleHint();
            idleClock.Tick(Time.unscaledTimeAsDouble,interactive,chooseIdleHint);
            if (paintedHint != idleClock.Visible)
            {
                ClearPaintedHint();
                paintedHint = idleClock.Visible;
                if (paintedHint != null && HasVisuals)
                    foreach (int i in paintedHint.FocusSources)
                        idleModels[i] = stones[i].GetComponentsInChildren<Renderer>().Where(r => !r.GetComponent<TextMesh>()).ToArray();
            }
            if (paintedHint == null || !HasVisuals) return;
            float phase = idleClock.Phase;
            float pulse = ReducedMotion ? 0 : Mathf.SmoothStep(0,1,1-Mathf.Abs(2*phase-1));
            Vector3 direction = (positions[paintedHint.MovingTarget]-positions[paintedHint.MovingSource]).normalized;
            float displacement = 2.5f*(Screen.width/390f)*2*BoardCamera.orthographicSize/Mathf.Max(1,BoardCamera.pixelHeight);
            foreach (var entry in idleModels)
            {
                int i = entry.Key; bool moving = i == paintedHint.MovingSource;
                stones[i].transform.localScale = Vector3.one*(1 + (moving ? .07f : .05f)*pulse);
                stones[i].transform.position = positions[i]+Vector3.back*.15f + (moving ? direction*displacement*pulse : Vector3.zero);
                SetIdleGlow(entry.Value, moving ? 1 : .7f, pulse*(moving ? .08f : .05f));
            }
        }

        private void SetIdleGlow(Renderer[] models,float outline,float sheen)
        {
            if (tint == null) return;
            foreach (var model in models)
            {
                if (model == null) continue;
                model.GetPropertyBlock(tint); tint.SetFloat("_IdleOutline",outline); tint.SetFloat("_IdleSheen",sheen); model.SetPropertyBlock(tint);
            }
        }

        private void StopIdleHint() { idleClock.Interrupt(); ClearPaintedHint(); }

        private void ClearPaintedHint()
        {
            foreach (var entry in idleModels)
            {
                int i = entry.Key;
                if (i >= stones.Count || stones[i] == null) continue;
                stones[i].transform.localScale = Vector3.one;
                stones[i].transform.position = positions[i] + Vector3.back*.15f;
                SetIdleGlow(entry.Value,0,0);
            }
            paintedHint = null; idleModels.Clear();
        }
    }
}
