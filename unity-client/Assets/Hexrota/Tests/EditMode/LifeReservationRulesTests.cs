using System.Collections.Generic;
using Hexrota.Lives;
using Hexrota.UnityClient;
using NUnit.Framework;
using UnityEngine;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    // A life is reserved when a chapter starts. A win gives it back; a loss, a restart or leaving keeps it spent.
    public sealed class LifeReservationRulesTests
    {
        private sealed class Clock : IUtcClock { public long Now = 1794916800000L; public long NowUtcMilliseconds() { return Now; } }
        private const long Level = 9001L; // not in the first-failure protection list
        private Clock clock;
        private LifeManager lives;

        [SetUp] public void SetUp()
        {
            clock = new Clock();
            var data = ClientGameData.Load(path => Resources.Load<TextAsset>(path).text);
            lives = new LifeManager(data.LifeConfig, clock);
        }

        private static Dictionary<string, object> Attempt(string id, string outcome, long moves = 3)
        {
            return W.Obj("attemptId", id, "levelId", Level, "tutorial", false, "movesUsed", moves, "outcome", outcome, "confirmed", outcome == "restart");
        }
        private LifeState Start(LifeState state, string id)
        {
            var result = lives.RegisterAttempt(state, W.Obj("attemptId", id, "levelId", Level, "tutorial", false));
            Assert.That(result.Applied, Is.True, result.Reason);
            return result.State;
        }
        private int Count(LifeState state) { return W.Int32(lives.View(state)["lives"]); }
        private bool Refilling(LifeState state) { return lives.View(state)["nextLifeAtUtc"] != null; }

        [Test] public void StartingReservesALifeAndAWinGivesItBackWithoutARefillTimer()
        {
            var state = Start(lives.CreateState(), "a-1");
            Assert.That(Count(state), Is.EqualTo(4));
            Assert.That(Refilling(state), Is.True, "A reserved life counts down like a spent one.");
            var won = lives.SettleAttempt(state, Attempt("a-1", "won"));
            Assert.That(won.Charged, Is.False);
            Assert.That(Count(won.State), Is.EqualTo(5));
            Assert.That(Refilling(won.State), Is.False);
        }

        [Test] public void ALossKeepsTheReservedLifeSpentAndNeverChargesTwice()
        {
            var state = Start(lives.CreateState(), "a-1");
            var lost = lives.SettleAttempt(state, Attempt("a-1", "failed"));
            Assert.That(lost.Charged, Is.True);
            Assert.That(Count(lost.State), Is.EqualTo(4));
            Assert.That(Refilling(lost.State), Is.True);
        }

        [Test] public void LeavingAfterAMoveSpendsTheLifeAndLeavingBeforeOneGivesItBack()
        {
            var left = lives.SettleAttempt(Start(lives.CreateState(), "a-1"), Attempt("a-1", "restart"));
            Assert.That(left.Charged, Is.True);
            Assert.That(Count(left.State), Is.EqualTo(4));
            var untouched = lives.SettleAttempt(Start(left.State, "a-2"), Attempt("a-2", "restart", moves: 0));
            Assert.That(untouched.Charged, Is.False);
            Assert.That(Count(untouched.State), Is.EqualTo(4));
        }

        [Test] public void LeavingBeforeAMoveReleasesTheLifeAndResumingTheSameBoardReservesItAgain()
        {
            var released = lives.ReleaseReservation(Start(lives.CreateState(), "a-1"), "a-1");
            Assert.That(released.Applied, Is.True, released.Reason);
            Assert.That(Count(released.State), Is.EqualTo(5));
            Assert.That(Refilling(released.State), Is.False);
            Assert.That(lives.ReleaseReservation(released.State, "a-1").Applied, Is.False, "A life is released once.");
            var resumed = lives.RegisterAttempt(released.State, W.Obj("attemptId", "a-1", "levelId", Level, "tutorial", false, "resume", true));
            Assert.That(resumed.Applied, Is.True, resumed.Reason);
            Assert.That(Count(resumed.State), Is.EqualTo(4));
            var again = lives.RegisterAttempt(resumed.State, W.Obj("attemptId", "a-1", "levelId", Level, "tutorial", false, "resume", true));
            Assert.That(again.Applied, Is.False, "An attempt holds at most one reserved life.");
            Assert.That(Count(lives.SettleAttempt(resumed.State, Attempt("a-1", "won")).State), Is.EqualTo(5));
        }

        [Test] public void AWinAfterAnExtraMovesRescueStillGivesTheLifeBack()
        {
            var state = Start(lives.CreateState(), "a-1");
            var lost = lives.SettleAttempt(state, Attempt("a-1", "failed"));
            Assert.That(Count(lost.State), Is.EqualTo(4));
            var won = lives.SettleAttempt(lost.State, Attempt("a-1", "won", moves: 8));
            Assert.That(won.Applied, Is.True, won.Reason);
            Assert.That(Count(won.State), Is.EqualTo(5));
            Assert.That(Refilling(won.State), Is.False);
            Assert.That(lives.SettlementFor(won.State, "a-1").ToWire()["charged"], Is.EqualTo(false));
        }

        [Test] public void TheLastLifeCanBeReservedAndTheReservationSurvivesASaveRoundTrip()
        {
            var state = lives.CreateState();
            for (int i = 1; i <= 4; i++) state = lives.SettleAttempt(Start(state, "s-" + i), Attempt("s-" + i, "failed")).State;
            Assert.That(Count(state), Is.EqualTo(1));
            state = Start(state, "last");
            Assert.That(Count(state), Is.EqualTo(0));
            var restored = lives.Restore(W.Map(Hexrota.UnityClient.WireJsonCodec.Parse(Hexrota.UnityClient.WireJsonCodec.Serialize(state.ToWire()))));
            Assert.That(lives.ValidateState(restored), Is.True);
            var won = lives.SettleAttempt(restored, Attempt("last", "won"));
            Assert.That(Count(won.State), Is.EqualTo(1), "The empty-lives waiver must not apply to a reserved attempt.");
        }
    }
}
