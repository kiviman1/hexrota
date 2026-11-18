using System;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Application;
using Hexrota.Catalog;
using Hexrota.Gameplay;
using Hexrota.Lives;
using Hexrota.UnityClient;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEngine;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    // These are Unity tests, intentionally outside the player assembly. They exercise
    // the published corpus and the real application controller through its UI adapter.
    public sealed class SessionIntegrationTests
    {
        private sealed class Clock : IUtcClock
        {
            public long NowUtcMilliseconds() { return 1794916800000L; }
        }
        private MemoryProfileStorage storage;
        private ClientGameData data;
        private UnityGameSession session;
        private static string Document(string path)
        {
            var asset = Resources.Load<TextAsset>(path);
            Assert.That(asset, Is.Not.Null, "Missing canonical resource: " + path);
            return asset.text;
        }
        [SetUp] public void SetUp()
        {
            storage = new MemoryProfileStorage();
            data = ClientGameData.Load(Document);
            session = new UnityGameSession(data, storage, new Clock());
        }
        private static object WireValue(JToken token)
        {
            if (token is JObject) return ((JObject)token).Properties().ToDictionary(p => p.Name, p => WireValue(p.Value));
            if (token is JArray) return ((JArray)token).Select(WireValue).ToList();
            if (token.Type == JTokenType.Integer) return token.Value<long>();
            if (token.Type == JTokenType.Float) return token.Value<double>();
            if (token.Type == JTokenType.Null) return null;
            if (token.Type == JTokenType.Boolean) return token.Value<bool>();
            return token.Value<string>();
        }
        private static LevelCatalog Catalog()
        {
            return LevelCatalog.FromDocuments(
                WireValue(JToken.Parse(Document("HexrotaData/levels-original"))),
                WireValue(JToken.Parse(Document("HexrotaData/variants"))),
                WireValue(JToken.Parse(Document("HexrotaData/tutorials-fixed"))));
        }
        private int[][] CertifiedRoute()
        {
            var variants = JObject.Parse(Document("HexrotaData/variants"));
            var level = variants["levels"].Single(x => x["levelId"].Value<int>() == Convert.ToInt32(session.Level.id));
            var initial = session.Level.initial.Select(x => x.Value).ToArray();
            var variant = level["variants"].Single(v => v["initial"].Values<int>().SequenceEqual(initial));
            return variant["solutions"][0].Select(pair => pair.Values<int>().ToArray()).ToArray();
        }
        private static void SameSnapshot(GameSnapshot expected, GameSnapshot actual)
        {
            Assert.That(W.Equal(LevelCatalog.SnapshotWire(expected), LevelCatalog.SnapshotWire(actual)), Is.True,
                "Full snapshot, including RNG, layers, move history and score, must match.");
        }
        [Test] public void EveryPublishedVariantLoadsAndItsCertifiedRoutesWinInTheUnityAssembly()
        {
            var catalog = Catalog();
            var variants = JObject.Parse(Document("HexrotaData/variants"));
            int boards = 0, routes = 0;
            foreach (var level in variants["levels"])
            foreach (var variant in level["variants"])
            {
                var resolved = catalog.ResolveLevelWire(level["levelId"].Value<long>(), variant["id"].Value<string>(), "variants-v1");
                var config = LevelCatalog.GameplayConfig(resolved);
                Assert.That(HexMatch.ValidateLevel(config), Is.True);
                boards++;
                foreach (var route in variant["solutions"])
                {
                    var game = new HexMatch(config);
                    foreach (var pair in route)
                    {
                        var swap = pair.Values<int>().ToArray();
                        Assert.That(game.Swap(swap[0], swap[1]).ok, Is.True);
                    }
                    Assert.That(game.Status, Is.EqualTo("won"));
                    routes++;
                }
            }
            Assert.That(boards, Is.EqualTo(40));
            Assert.That(routes, Is.GreaterThanOrEqualTo(80));
        }
        [Test] public void CompletedLessonCanBeReplayedAndItsNewAttemptResumesAcrossReloads()
        {
            Assert.That(session.EnterStage(0), Is.True);
            while (session.Status == "playing")
            {
                if (session.NeedsTutorialAcknowledgement) Assert.That(session.AcknowledgeTutorial(), Is.True);
                var pair = session.TutorialPair;
                Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True);
                session.CompletePresentation();
            }
            Assert.That(session.Status, Is.EqualTo("won"));
            object LessonId() => W.Required(W.Required(W.Required(W.Required(
                storage.Read(ProfileRepository.ProfileKey), "game"), "attempts"), "0"), "attemptId");
            var finishedId = LessonId();
            Assert.That(session.EnterStage(0), Is.True, session.LastError);
            var replayId = LessonId();
            Assert.That(replayId, Is.Not.EqualTo(finishedId));
            for (int turn = 0; turn <= 1; turn++)
            {
                session.ReturnToMenu();
                session = new UnityGameSession(data, storage, new Clock());
                Assert.That(session.EnterStage(0), Is.True, session.LastError);
                Assert.That(session.Snapshot.turn, Is.EqualTo(turn));
                Assert.That(LessonId(), Is.EqualTo(replayId));
                if (turn == 0)
                {
                    var pair = session.TutorialPair;
                    Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True);
                    session.CompletePresentation();
                }
            }
            Assert.That(session.NeedsTutorialAcknowledgement, Is.True);
        }
        [Test] public void RealLevelOneAndRejectedSwapPreserveCanonicalSave()
        {
            Assert.That(session.EnterLevelOne(), Is.True, session.LastError);
            Assert.That(Convert.ToInt64(session.Level.id), Is.EqualTo(1));
            Assert.That(session.Level.cells.Length, Is.GreaterThan(6));
            var before = session.Snapshot;
            var durable = storage.Read(ProfileRepository.ProfileKey);
            var rejected = session.TrySwap(-1, session.Level.cells.Length);
            Assert.That(rejected.Ok, Is.False);
            SameSnapshot(before, session.Snapshot);
            Assert.That(W.Equal(durable, storage.Read(ProfileRepository.ProfileKey)), Is.True);
            Assert.That(session.IsPresenting, Is.False);
        }
        [Test] public void MoveCommitsBeforePresentationAndRejectsDoubleInput()
        {
            Assert.That(session.EnterLevelOne(), Is.True, session.LastError);
            var expected = new HexMatch(session.Level, session.Snapshot);
            var pair = CertifiedRoute()[0];
            var expectedMove = expected.Swap(pair[0], pair[1]);
            Assert.That(expectedMove.ok, Is.True);
            var receipt = session.TrySwap(pair[0], pair[1]);
            Assert.That(receipt.Ok, Is.True, receipt.Reason);
            Assert.That(receipt.Swap.frames.Length, Is.GreaterThan(0));
            Assert.That(session.IsPresenting, Is.True);
            SameSnapshot(expected.Snapshot(), receipt.After);
            SameSnapshot(receipt.After, session.Snapshot);
            var durable = storage.Read(ProfileRepository.ProfileKey);
            Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.False);
            Assert.That(W.Equal(durable, storage.Read(ProfileRepository.ProfileKey)), Is.True);
            session.CompletePresentation();
            Assert.That(session.IsPresenting, Is.False);
        }
        [Test] public void CancelAndBackgroundNeverRollBackTheCommittedMove()
        {
            Assert.That(session.EnterLevelOne(), Is.True, session.LastError);
            var pair = CertifiedRoute()[0];
            var receipt = session.TrySwap(pair[0], pair[1]);
            Assert.That(receipt.Ok, Is.True, receipt.Reason);
            session.CancelPresentation();
            SameSnapshot(receipt.After, session.Snapshot);
            Assert.That(session.IsPresenting, Is.False);
            session.Suspend();
            var reopened = new UnityGameSession(data, storage, new Clock());
            Assert.That(reopened.EnterLevelOne(), Is.True, reopened.LastError);
            SameSnapshot(receipt.After, reopened.Snapshot);
            Assert.That(reopened.IsPresenting, Is.False);
        }
        [Test] public void RestartDuringAnimationCreatesValidatedFreshAttempt()
        {
            Assert.That(session.EnterLevelOne(), Is.True, session.LastError);
            var pair = CertifiedRoute()[0];
            Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True);
            Assert.That(session.Restart(), Is.True, session.LastError);
            Assert.That(session.IsPresenting, Is.False);
            Assert.That(session.Snapshot.turn, Is.Zero);
            Assert.That(session.Snapshot.movesLeft, Is.EqualTo(session.Level.moves));
            SameSnapshot(new HexMatch(session.Level).Snapshot(), session.Snapshot);
            var reopened = new UnityGameSession(data, storage, new Clock());
            Assert.That(reopened.EnterLevelOne(), Is.True, reopened.LastError);
            SameSnapshot(session.Snapshot, reopened.Snapshot);
        }
        [Test] public void WinPersistsOnceAndCampaignCompletionCannotBeFarmedByRetry()
        {
            Assert.That(session.EnterLevelOne(), Is.True, session.LastError);
            foreach (var pair in CertifiedRoute())
            {
                var receipt = session.TrySwap(pair[0], pair[1]);
                Assert.That(receipt.Ok, Is.True, receipt.Reason);
                session.CompletePresentation();
            }
            Assert.That(session.Status, Is.EqualTo("won"));
            var durable = storage.Read(ProfileRepository.ProfileKey);
            Assert.That(session.Retry(), Is.False, "Existing one-time progression contract must be retained.");
            Assert.That(W.Equal(durable, storage.Read(ProfileRepository.ProfileKey)), Is.True);
            Assert.That(session.Restart(), Is.False);
            var reopened = new UnityGameSession(data, storage, new Clock());
            Assert.That(reopened.EnterLevelOne(), Is.False, "Winning proof cannot reopen a completed campaign level.");
        }
        private void PlayALosingRoute()
        {
            List<int[]> lossRoute = null;
            // Search only in a clone, using published rules; never alter the live
            // controller to force a loss or invent a terminal snapshot.
            for (uint seed = 1; seed <= 200 && lossRoute == null; seed++)
            {
                var candidate = new HexMatch(session.Level, session.Snapshot);
                var route = new List<int[]>(); uint random = seed;
                while (candidate.Status == "playing")
                {
                    var moves = candidate.LegalMoves();
                    Assert.That(moves.Count, Is.GreaterThan(0));
                    random = unchecked(random * 1664525u + 1013904223u);
                    var pair = moves[(int)(random % (uint)moves.Count)];
                    Assert.That(candidate.Swap(pair[0], pair[1]).ok, Is.True);
                    route.Add(pair);
                }
                if (candidate.Status == "lost") lossRoute = route;
            }
            Assert.That(lossRoute, Is.Not.Null, "Published level must provide a real losing path for this lifecycle test.");
            foreach (var pair in lossRoute)
            {
                Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True);
                session.CompletePresentation();
            }
        }

        [Test] public void EarnedGoldRescuesTheSameAttemptOnceAndRestoresTheGrantedMoves()
        {
            // Earn the welcome reward and campaign gold through actual clears.
            // No changes to wallet, snapshots or rules to manufacture this offer.
            for (int stage = 0; stage < 8; stage++)
            {
                Assert.That(session.EnterStage(stage), Is.True, session.LastError);
                var route = session.IsTutorial
                    ? W.List(data.Levels[stage]["solution"]).Select(p => W.List(p).Select(W.Int32).ToArray()).ToArray()
                    : CertifiedRoute();
                foreach (var pair in route)
                {
                    if (session.NeedsTutorialAcknowledgement) Assert.That(session.AcknowledgeTutorial(), Is.True);
                    var receipt = session.TrySwap(pair[0],pair[1]);
                    Assert.That(receipt.Ok, Is.True, receipt.Reason);
                    session.CompletePresentation();
                }
                Assert.That(session.Status, Is.EqualTo("won"));
            }
            int next = session.NextCampaignStage;
            Assert.That(session.EnterStage(next), Is.True);
            PlayALosingRoute();
            var offer = session.GetGoldRescueOffer();
            Assert.That(offer, Is.Not.Null);
            Assert.That(offer.Affordable, Is.True);
            var lost = session.Snapshot;
            object profile = storage.Read(ProfileRepository.ProfileKey);
            var game = W.Required(profile,"game");
            long balance = W.Integer(W.Required(W.Required(game,"economy"),"gold"));
            object attempt = W.Required(W.Required(game,"attempts"),next.ToString());
            Assert.That(session.AcceptGoldRescue(offer), Is.True, session.LastError);
            Assert.That(session.AcceptGoldRescue(offer), Is.False, "A stale offer cannot spend twice.");
            session.Suspend();
            session = new UnityGameSession(data, storage, new Clock());
            Assert.That(session.EnterStage(next), Is.True, session.LastError);
            Assert.That(session.Status, Is.EqualTo("playing"));
            Assert.That(session.Snapshot.turn, Is.EqualTo(lost.turn));
            Assert.That(session.Snapshot.movesLeft, Is.EqualTo(lost.movesLeft + offer.Moves));
            CollectionAssert.AreEqual(lost.values,session.Snapshot.values);
            game = W.Required(storage.Read(ProfileRepository.ProfileKey),"game");
            object economy = W.Required(game,"economy");
            Assert.That(W.Integer(W.Required(economy,"gold")), Is.EqualTo(balance - offer.Cost));
            string operation = "rescue:" + W.Required(attempt, "attemptId");
            Assert.That(W.Required(W.Required(W.Required(economy, "transactions"), operation), "kind"), Is.EqualTo("rescue"));
            Assert.That(W.Equal(attempt,W.Required(W.Required(game,"attempts"),next.ToString())), Is.True);
        }

        [Test] public void RealLossSettlesAndRetryCreatesANewSavedAttempt()
        {
            Assert.That(session.EnterLevelOne(), Is.True, session.LastError);
            var initialProfile = storage.Read(ProfileRepository.ProfileKey);
            long initialLives = W.Integer(W.Get(W.Get(W.Get(initialProfile, "energy"), "life"), "lives"));
            string initialAttempt = (string)W.Get(W.Get(W.Get(W.Get(initialProfile, "game"), "attempts"), "2"), "attemptId");
            PlayALosingRoute();
            Assert.That(session.Status, Is.EqualTo("lost"));
            Assert.That(session.Snapshot.movesLeft, Is.Zero);
            var afterLoss = storage.Read(ProfileRepository.ProfileKey);
            Assert.That(W.Integer(W.Get(W.Get(W.Get(afterLoss, "energy"), "life"), "lives")), Is.EqualTo(initialLives - 1));
            session.Suspend();
            Assert.That(session.Retry(), Is.True, session.LastError);
            Assert.That(session.Status, Is.EqualTo("playing"));
            Assert.That(session.Snapshot.turn, Is.Zero);
            var afterRetry = storage.Read(ProfileRepository.ProfileKey);
            Assert.That(W.Integer(W.Get(W.Get(W.Get(afterRetry, "energy"), "life"), "lives")), Is.EqualTo(initialLives - 1),
                "Suspend and retry must not charge the same failed attempt twice.");
            string retriedAttempt = (string)W.Get(W.Get(W.Get(W.Get(afterRetry, "game"), "attempts"), "2"), "attemptId");
            Assert.That(retriedAttempt, Is.Not.EqualTo(initialAttempt));
            var reopened = new UnityGameSession(data, storage, new Clock());
            Assert.That(reopened.EnterLevelOne(), Is.True, reopened.LastError);
            SameSnapshot(session.Snapshot, reopened.Snapshot);
            Assert.That(W.Integer(W.Get(W.Get(W.Get(storage.Read(ProfileRepository.ProfileKey), "energy"), "life"), "lives")),
                Is.EqualTo(initialLives - 1), "Reload preserves the single settlement.");
        }
        [Test] public void StorageFailureCannotProduceAnUncommittedVisualMove()
        {
            Assert.That(session.EnterLevelOne(), Is.True, session.LastError);
            var before = session.Snapshot;
            var pair = CertifiedRoute()[0];
            storage.FailProfileWrites = true;
            var receipt = session.TrySwap(pair[0], pair[1]);
            Assert.That(receipt.Ok, Is.False);
            SameSnapshot(before, session.Snapshot);
            Assert.That(session.IsPresenting, Is.False);
        }
        [Test] public void MissingLevelDataFailsExplicitlyInsteadOfBuildingAFakeBoard()
        {
            Assert.Throws<InvalidOperationException>(() => ClientGameData.Load(path => null));
        }
    }
}
