using System;
using System.Collections.Generic;
using UnityEngine;

namespace Hexrota.UnityClient.Presentation
{
    public enum AttentionKind { RewardFlight = 1, CoopUpgrade = 2, CoopPulse = 3, PlayShine = 4, BadgeWiggle = 5 }

    [DisallowMultipleComponent]
    public sealed class AttentionDirector : MonoBehaviour
    {
        private struct Claim
        {
            public AttentionKind Kind;
            public object Owner;
        }

        private readonly List<Claim> suspended = new List<Claim>(5);
        private Claim current;
        public bool ModalOpen { get; private set; }
        public event Action Changed;

        public bool IsOwner(object owner) => owner != null && ReferenceEquals(current.Owner, owner);

        public bool TryAcquire(AttentionKind kind, object owner)
        {
            if (owner == null) throw new ArgumentNullException(nameof(owner));
            if (IsOwner(owner)) return current.Kind == kind;
            if (Blocked(kind) || current.Owner != null && current.Kind <= kind) return false;

            RemoveSuspended(owner);
            if (current.Owner != null) suspended.Add(current);
            current = new Claim { Kind = kind, Owner = owner };
            Changed?.Invoke();
            return IsOwner(owner);
        }

        public void Release(object owner)
        {
            if (!IsOwner(owner))
            {
                RemoveSuspended(owner);
                return;
            }
            current = default;
            ResumeEligible();
            Changed?.Invoke();
        }

        public void SetModalOpen(bool open)
        {
            if (ModalOpen == open) return;
            ModalOpen = open;
            if (current.Owner != null && Blocked(current.Kind))
            {
                suspended.Add(current);
                current = default;
            }
            ResumeEligible();
            Changed?.Invoke();
        }

        // An open panel silences the coop pulse and everything below it; flights and the upgrade sequence still run.
        private bool Blocked(AttentionKind kind) => ModalOpen && kind >= AttentionKind.CoopPulse;

        private void RemoveSuspended(object owner)
        {
            for (int i = suspended.Count - 1; i >= 0; i--)
                if (ReferenceEquals(suspended[i].Owner, owner)) suspended.RemoveAt(i);
        }

        private void ResumeEligible()
        {
            if (current.Owner != null) return;
            int best = -1;
            for (int i = 0; i < suspended.Count; i++)
                if (!Blocked(suspended[i].Kind) && (best < 0 || suspended[i].Kind < suspended[best].Kind)) best = i;
            if (best < 0) return;
            current = suspended[best];
            suspended.RemoveAt(best);
        }
    }
}
