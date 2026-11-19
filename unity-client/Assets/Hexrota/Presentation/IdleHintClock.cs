using System;
using System.Collections.Generic;

namespace Hexrota.UnityClient.Presentation
{
    // Time is injected so changes of focus, restored attempts and exact Web
    // deadlines are reproducible without waiting a real minute in unit tests.
    public sealed class IdleHintClock
    {
        private sealed class Attempt
        {
            internal int Shown;
            internal bool Armed = true;
            internal string LastBoard;
            internal int[] LastPair;
        }
        private readonly Dictionary<string,Attempt> attempts = new Dictionary<string,Attempt>();
        private Attempt attempt;
        private string board;
        private bool wasEligible, attempted;
        private double since, cycleStart, lastShown = double.NegativeInfinity;
        private VisibleIdleHint cycle;
        internal VisibleIdleHint ActiveCue => cycle;
        public VisibleIdleHint Visible { get; private set; }
        public float Phase { get; private set; }

        public void Bind(string identity, string visibleBoard)
        {
            attempt = null;
            if (identity != null && !attempts.TryGetValue(identity,out attempt))
                attempts.Add(identity,attempt = new Attempt());
            board = visibleBoard;
            Interrupt();
        }

        public void Interrupt()
        {
            wasEligible = attempted = false; cycle = Visible = null;
        }

        public void PlayerMoved(string committedBoard)
        {
            Interrupt();
            if (attempt != null && attempt.LastBoard != committedBoard) attempt.Armed = true;
        }

        public void Tick(double now, bool eligible, Func<int[],VisibleIdleHint> choose)
        {
            if (!eligible || attempt == null) { Interrupt(); return; }
            if (!wasEligible) { since = now; wasEligible = true; }
            if (cycle == null)
            {
                if (attempted || !attempt.Armed || attempt.Shown >= 2 || attempt.LastBoard == board ||
                    now < Math.Max(since + (attempt.Shown == 0 ? 10 : 35), lastShown + 60)) return;
                attempted = true;
                cycle = choose(attempt.LastPair);
                if (cycle == null) return;
                cycleStart = lastShown = now;
                attempt.Shown++; attempt.Armed = false; attempt.LastPair = cycle.Pair; attempt.LastBoard = board;
            }
            const double nudgeDuration = 1.8;
            double elapsed = (now - cycleStart) % (2 * nudgeDuration);
            Visible = elapsed < nudgeDuration ? cycle : null;
            Phase = (float)(elapsed / nudgeDuration);
        }
    }
}
