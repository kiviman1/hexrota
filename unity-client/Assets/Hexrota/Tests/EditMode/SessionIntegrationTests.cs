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
            return CampaignTestRoute.ForActiveAttempt(data, session, storage);
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

        [Test] public void LocalPlaytestRecordsOnlyOptedInCommittedMovesAndExportsWithoutChangingSaves()
        {
            long milliseconds=0;
            session=new UnityGameSession(data,storage,new Clock(),playtestMilliseconds:()=>milliseconds);
            Assert.That(session.PlaytestEnabled,Is.False);
            Assert.That(session.EnterLevelOne(),Is.True);
            Assert.That(storage.Contains("hexrota-playtest-v1"),Is.False);
            session.SetPlaytestEnabled(true);
            Assert.That(session.Restart(),Is.True);
            Assert.That(session.TrySwap(-1,99).Ok,Is.False);
            session.SetPlaytestActivity(true);
            milliseconds=500;
            var route=CertifiedRoute();
            var move=session.TrySwap(route[0][0],route[0][1]);
            Assert.That(move.Ok,Is.True);
            session.SetPlaytestActivity(false);
            milliseconds=4500;
            session.CompletePresentation();
            session.SetPlaytestActivity(true);
            milliseconds=4820;
            session.SetPlaytestActivity(false);
            var export=session.ExportPlaytestData();
            var rows=W.List(export["events"]);
            var details=W.Required(rows.Single(e=>W.Equal(W.Get(e,"name"),"move")),"data");
            Assert.That(W.Equal(W.Get(details,"pair"),W.Arr(route[0][0],route[0][1])),Is.True);
            Assert.That(W.Int32(W.Get(details,"scoreAfter")),Is.EqualTo(session.Snapshot.score));
            Assert.That(W.List(W.Get(details,"cells")),Has.Count.EqualTo(2));
            var observed=W.List(export["attempts"]).Single(a=>W.Equal(W.Get(a,"attemptId"),W.Get(details,"attemptId")));
            Assert.That(W.Equal(W.Get(observed,"observedStart"),true),Is.True);
            Assert.That(W.Integer(W.Get(observed,"activeMs")),Is.EqualTo(820));
            session=new UnityGameSession(data,storage,new Clock(),playtestMilliseconds:()=>milliseconds);
            Assert.That(session.PlaytestEnabled,Is.True);
            Assert.That(session.EnterLevelOne(),Is.True);
            Assert.That(W.List(session.ExportPlaytestData()["events"]).Any(e=>W.Equal(W.Get(e,"name"),"attempt_resumed")),Is.True);
            string dir=System.IO.Path.Combine(System.IO.Path.GetTempPath(),"hexrota-observation-"+Guid.NewGuid().ToString("N"));
            var before=storage.Read(ProfileRepository.ProfileKey);
            try
            {
                string path=session.SavePlaytestExport(dir);
                var saved=WireJsonCodec.Parse(System.IO.File.ReadAllText(path));
                Assert.That(W.Get(saved,"scope"),Is.EqualTo("local_opt_in_no_personal_data"));
                Assert.That(W.List(W.Get(saved,"events")).Count,Is.GreaterThan(1));
                session.ClearPlaytestData();
                Assert.That(W.List(session.ExportPlaytestData()["events"]),Is.Empty);
                Assert.That(session.PlaytestEnabled,Is.True);
                Assert.That(W.Equal(before,storage.Read(ProfileRepository.ProfileKey)),Is.True);
            }
            finally {if(System.IO.Directory.Exists(dir))System.IO.Directory.Delete(dir,true);}
        }
        [Test] public void MobileRestartConfirmationQuotesTheCanonicalChargeWithoutChangingProfile()
        {
            Assert.That(session.EnterLevelOne(),Is.True);
            Assert.That(session.PreviewRestartCharge(),Is.Zero);
            var move=CertifiedRoute()[0];
            Assert.That(session.TrySwap(move[0],move[1]).Ok,Is.True);
            session.CompletePresentation();
            long revision=session.Revision;
            var before=storage.Read(ProfileRepository.ProfileKey);
            Assert.That(session.PreviewRestartCharge(),Is.EqualTo(1));
            Assert.That(session.Revision,Is.EqualTo(revision));
            Assert.That(W.Equal(before,storage.Read(ProfileRepository.ProfileKey)),Is.True);
            Assert.That(session.SetLifeBypass(true),Is.True);
            Assert.That(session.PreviewRestartCharge(),Is.Zero);
            Assert.That(session.SetLifeBypass(false),Is.True);
            Assert.That(session.Restart(0),Is.False);
            Assert.That(session.LastError,Is.EqualTo("confirmation_changed"));
            Assert.That(session.Snapshot.turn,Is.EqualTo(1));
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

        private void CompleteStagesBefore(int nextIndex)
        {
            for (int stage = 0; stage < nextIndex; stage++)
            {
                Assert.That(session.EnterStage(stage), Is.True, session.LastError);
                var route = CertifiedRoute();
                foreach (var pair in route)
                {
                    if (session.NeedsTutorialAcknowledgement) Assert.That(session.AcknowledgeTutorial(), Is.True);
                    var receipt = session.TrySwap(pair[0],pair[1]);
                    Assert.That(receipt.Ok, Is.True, receipt.Reason);
                    session.CompletePresentation();
                }
                Assert.That(session.Status, Is.EqualTo("won"));
            }
        }

        [Test] public void MaskedCampaignOffersBoostersAndRescueAndRetryStartsFresh()
        {
            // Chapter 6 is a classic-v5 board. Boosters, booster purchase and the +5 move
            // rescue are available there (V5AssistanceTests covers their board rules).
            int sixth = session.TutorialCount + 5;
            CompleteStagesBefore(sixth);
            Assert.That(session.EnterStage(sixth), Is.True, session.LastError);
            Assert.That(session.UsesNineByNineFrame, Is.True);
            Assert.That(session.InventoryAvailable, Is.True);
            Assert.That(session.InventoryOffer("greenBrush").CanUse, Is.True);
            int stock = session.InventoryOffer("greenBrush").Stock;
            Assert.That(session.BuyInventoryItem("greenBrush", session.Revision), Is.True, session.LastError);
            Assert.That(session.InventoryOffer("greenBrush").Stock, Is.EqualTo(stock + 1));
            PlayALosingRoute();
            string lostAttempt = session.AttemptId;
            Assert.That(session.ReadRescueAd(), Is.Not.Null, "The rescue sheet is offered on a V5 loss.");
            Assert.That(session.Retry(), Is.True, session.LastError);
            Assert.That(session.AttemptId, Is.Not.EqualTo(lostAttempt));
            Assert.That(session.Snapshot.turn, Is.Zero);
            Assert.That(session.UsesNineByNineFrame, Is.True);
        }

        [Test] public void EarnedGoldRescuesTheSameAttemptOnceAndRestoresTheGrantedMoves()
        {
            // Start an archived classic attempt with enough earned gold. Its saved identity
            // must still support rescue after the application adopts the larger chapter layouts.
            data = ClientGameData.FromResources(false);
            session = new UnityGameSession(data, storage, new Clock());
            CompleteStagesBefore(8);
            int next = session.NextCampaignStage;
            Assert.That(session.EnterStage(next), Is.True);
            string classicAttempt = session.AttemptId;
            session.ReturnToMenu();
            data = ClientGameData.FromResources();
            session = new UnityGameSession(data, storage, new Clock());
            Assert.That(session.EnterStage(next), Is.True, session.LastError);
            Assert.That(session.AttemptId, Is.EqualTo(classicAttempt));
            Assert.That(session.Level.rulesVersion, Is.EqualTo("classic-v4"));
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

        [Test] public void MobileTestAdCancelAndResumePreserveTheLostBoardAndSettleJustOnce()
        {
            Assert.That(session.EnterLevelOne(), Is.True, session.LastError);
            PlayALosingRoute();
            var before = session.Snapshot;
            var offer = session.ReadRescueAd();
            Assert.That(offer.Available, Is.True, offer.Reason);
            var cancelled = session.BeginMobileRescueAd();
            Assert.That(cancelled, Is.Not.Null, session.LastError);
            session.CompleteMobileRescueAd(cancelled, false);
            Assert.That(session.Status, Is.EqualTo("lost"));
            Assert.That(session.ReadRescueAd().PendingId, Is.Null);
            var pending = session.BeginMobileRescueAd();
            Assert.That(pending, Is.Not.Null.And.Not.EqualTo(cancelled));
            session.Suspend();
            session = new UnityGameSession(data, storage, new Clock());
            Assert.That(session.EnterLevelOne(), Is.True, session.LastError);
            Assert.That(session.ReadRescueAd().PendingId, Is.EqualTo(pending));
            Assert.That(session.CompleteMobileRescueAd(pending, true), Is.True, session.LastError);
            Assert.That(session.Snapshot.movesLeft, Is.EqualTo(before.movesLeft + offer.Moves));
            Assert.That(session.Snapshot.turn, Is.EqualTo(before.turn));
            CollectionAssert.AreEqual(before.values, session.Snapshot.values);
            CollectionAssert.AreEqual(before.layers, session.Snapshot.layers);
            Assert.That(session.CompleteMobileRescueAd(pending, true), Is.False);
            Assert.That(session.Snapshot.movesLeft, Is.EqualTo(before.movesLeft + offer.Moves));
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
