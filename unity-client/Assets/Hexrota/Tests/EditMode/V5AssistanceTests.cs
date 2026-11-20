using System.Collections.Generic;
using System.Linq;
using Hexrota.Application;
using Hexrota.Gameplay;
using Hexrota.Lives;
using Hexrota.UnityClient;
using NUnit.Framework;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    // Chapters 6-10 use classic-v5 boards (crates and regions). Boosters and the +5 move
    // rescue work there with one rule: a match made by a booster follows the same wave
    // rules as a swap, so it damages a crate like any other match. A crate is never a
    // booster target (docs/design/PRODUCT.md).
    public sealed class V5AssistanceTests
    {
        private sealed class Clock : IUtcClock
        {
            public long NowUtcMilliseconds() { return 1794916800000L; }
        }

        private MemoryProfileStorage storage;
        private ClientGameData data;
        private UnityGameSession session;

        [SetUp] public void SetUp()
        {
            storage = new MemoryProfileStorage();
            data = ClientGameData.FromResources();
            session = new UnityGameSession(data, storage, new Clock());
        }

        private int Chapter(int number) { return session.TutorialCount + number - 1; }

        private void WinChaptersBefore(int stageIndex)
        {
            for (int stage = 0; stage < stageIndex; stage++)
            {
                Assert.That(session.EnterStage(stage), Is.True, session.LastError);
                foreach (var pair in CampaignTestRoute.ForActiveAttempt(data, session, storage))
                {
                    if (session.NeedsTutorialAcknowledgement) Assert.That(session.AcknowledgeTutorial(), Is.True);
                    Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True, session.LastError);
                    session.CompletePresentation();
                }
                Assert.That(session.Status, Is.EqualTo("won"));
                session.ReturnToMenu();
            }
        }

        private HexMatch Board() { return new HexMatch(session.Level, session.Snapshot); }

        private void Reload(int stage)
        {
            session.Suspend();
            session = new UnityGameSession(data, storage, new Clock());
            Assert.That(session.EnterStage(stage), Is.True, session.LastError);
        }

        private void PlayToALoss()
        {
            List<int[]> lossRoute = null;
            for (uint seed = 1; seed <= 200 && lossRoute == null; seed++)
            {
                var candidate = Board(); var route = new List<int[]>(); uint random = seed;
                while (candidate.Status == "playing")
                {
                    var moves = candidate.LegalMoves();
                    Assert.That(moves.Count, Is.GreaterThan(0));
                    random = unchecked(random * 1664525u + 1013904223u);
                    var pair = moves[(int)(random % (uint)moves.Count)];
                    Assert.That(candidate.Swap(pair[0], pair[1]).ok, Is.True);
                    route.Add(pair);
                }
                // Rescue needs a legal swap left on the lost board.
                if (candidate.Status == "lost" && candidate.LegalMoves().Count > 0) lossRoute = route;
            }
            Assert.That(lossRoute, Is.Not.Null, "The chapter must have a real losing path that leaves a legal swap.");
            foreach (var pair in lossRoute)
            {
                Assert.That(session.TrySwap(pair[0], pair[1]).Ok, Is.True, session.LastError);
                session.CompletePresentation();
            }
            Assert.That(session.Status, Is.EqualTo("lost"));
        }

        [Test]
        public void GreenBrushWorksOnAnOpenV5CellButNeverOnACrateAndTheBoardRestores()
        {
            int sixth = Chapter(6);
            WinChaptersBefore(sixth);
            Assert.That(session.EnterStage(sixth), Is.True, session.LastError);
            Assert.That(session.Level.rulesVersion, Is.EqualTo("classic-v5"));
            Assert.That(session.InventoryAvailable, Is.True);
            var offer = session.InventoryOffer("greenBrush");
            Assert.That(offer.CanUse, Is.True, "Chapter 3 gifts brushes; chapter 6 is a V5 board.");

            var board = Board();
            var blockers = session.Level.obstacles.blockers;
            int crate = blockers[Enumerable.Range(0, blockers.Length).First(b => board.blockerHp[b] > 0)].cell;
            object before = storage.Read(ProfileRepository.ProfileKey);
            Assert.That(session.PreviewInventoryItem("greenBrush", crate, null), Is.Null);
            Assert.That(session.LastError, Is.EqualTo("blocked"), "A crate is broken by matches only.");
            var sealedGround = Enumerable.Range(0, board.Total).Where(i => !board.IsPlayable(i) && board.layers[i] > 0 && i != crate).ToArray();
            Assert.That(sealedGround, Is.Not.Empty, "Chapter 6 seals ground behind its crates.");
            Assert.That(session.PreviewInventoryItem("greenBrush", sealedGround[0], null), Is.Null);
            Assert.That(session.LastError, Is.EqualTo("blocked"), "Ground sealed behind a crate cannot be brushed.");
            Assert.That(W.Equal(before, storage.Read(ProfileRepository.ProfileKey)), Is.True, "A refused booster changes nothing.");

            int open = Enumerable.Range(0, board.Total).First(i => board.IsPlayable(i) && board.layers[i] > 0);
            var preview = session.PreviewInventoryItem("greenBrush", open, null);
            Assert.That(preview, Is.Not.Null, session.LastError);
            Assert.That(preview.LayersRemoved, Is.EqualTo(1));
            Assert.That(session.ConfirmInventoryItem(preview), Is.Not.Null, session.LastError);
            session.CompletePresentation();
            var after = session.Snapshot;
            Assert.That(after.layers[open], Is.EqualTo(board.layers[open] - 1));
            Assert.That(after.movesLeft, Is.EqualTo(board.movesLeft), "Boosters spend no move.");
            CollectionAssert.AreEqual(board.blockerHp, after.blockerHp);
            Assert.That(session.InventoryOffer("greenBrush").Stock, Is.EqualTo(offer.Stock - 1));

            string attempt = session.AttemptId;
            Reload(sixth);
            Assert.That(session.AttemptId, Is.EqualTo(attempt));
            var restored = session.Snapshot;
            CollectionAssert.AreEqual(after.values, restored.values);
            CollectionAssert.AreEqual(after.layers, restored.layers);
            CollectionAssert.AreEqual(after.blockerHp, restored.blockerHp);
            CollectionAssert.AreEqual(after.regionOpen, restored.regionOpen);
            Assert.That(restored.movesLeft, Is.EqualTo(after.movesLeft));
            Assert.That(session.InventoryOffer("greenBrush").Used, Is.EqualTo(1));
        }

        [Test]
        public void ColorKeyMatchesDamageCratesExactlyLikeASwapWave()
        {
            int seventh = Chapter(7);
            WinChaptersBefore(seventh);
            Assert.That(session.EnterStage(seventh), Is.True, session.LastError);
            Assert.That(session.Level.rulesVersion, Is.EqualTo("classic-v5"));
            Assert.That(session.InventoryOffer("colorKey").CanUse, Is.True, "Chapter 6 gifts keys; chapter 7 is a V5 board.");

            var board = Board();
            UnityGameSession.ItemPreview hit = null; int cell = -1, value = 0;
            for (int i = 0; i < board.Total && hit == null; i++)
            {
                if (!board.IsPlayable(i)) continue;
                foreach (int candidate in session.Level.palette)
                {
                    if (board.values[i] == candidate) continue;
                    var preview = session.PreviewInventoryItem("colorKey", i, candidate);
                    if (preview != null && preview.CrateHits > 0)
                    {
                        hit = preview; cell = i; value = candidate; break;
                    }
                }
            }
            Assert.That(hit, Is.Not.Null, "Chapter 7's opening board must allow a key match next to a crate.");

            // The same edit resolved by the swap engine's wave rules.
            var expected = board.Clone();
            expected.values[cell] = value;
            var waves = expected.ResolveBoard();
            Assert.That(waves.ok, Is.True);

            Assert.That(session.ConfirmInventoryItem(hit), Is.Not.Null, session.LastError);
            session.CompletePresentation();
            var after = session.Snapshot;
            CollectionAssert.AreEqual(expected.blockerHp, after.blockerHp);
            CollectionAssert.AreEqual(expected.regionOpen, after.regionOpen);
            CollectionAssert.AreEqual(expected.layers, after.layers);
            CollectionAssert.AreEqual(expected.values, after.values);
            Assert.That(after.score, Is.EqualTo(expected.score));
            Assert.That(after.movesLeft, Is.EqualTo(board.movesLeft));
            for (int b = 0; b < board.blockerHp.Length; b++)
                Assert.That(board.blockerHp[b] - after.blockerHp[b], Is.LessThanOrEqualTo(waves.frames.Length),
                    "A crate loses at most one point per wave, as with a swap.");
            Assert.That(board.blockerHp.Sum(), Is.GreaterThan(after.blockerHp.Sum()));

            Reload(seventh);
            CollectionAssert.AreEqual(after.blockerHp, session.Snapshot.blockerHp);
            CollectionAssert.AreEqual(after.values, session.Snapshot.values);
        }

        [Test]
        public void TheRescueAdGivesFiveMovesOnTheSameV5BoardOnce()
        {
            int sixth = Chapter(6);
            WinChaptersBefore(sixth);
            Assert.That(session.EnterStage(sixth), Is.True, session.LastError);
            PlayToALoss();
            var lost = session.Snapshot;
            Assert.That(session.GetChapterPreview(sixth).Rescue, Is.True);
            var ad = session.ReadRescueAd();
            Assert.That(ad, Is.Not.Null);
            Assert.That(ad.Available, Is.True, ad.Reason);
            Assert.That(session.GetGoldRescueOffer(), Is.Not.Null);
            var pending = session.BeginMobileRescueAd();
            Assert.That(pending, Is.Not.Null, session.LastError);

            string attempt = session.AttemptId;
            Reload(sixth);
            Assert.That(session.AttemptId, Is.EqualTo(attempt));
            Assert.That(session.CompleteMobileRescueAd(pending, true), Is.True, session.LastError);
            var rescued = session.Snapshot;
            Assert.That(session.Status, Is.EqualTo("playing"));
            Assert.That(rescued.movesLeft, Is.EqualTo(lost.movesLeft + ad.Moves));
            CollectionAssert.AreEqual(lost.values, rescued.values);
            CollectionAssert.AreEqual(lost.layers, rescued.layers);
            CollectionAssert.AreEqual(lost.blockerHp, rescued.blockerHp);
            Assert.That(session.CompleteMobileRescueAd(pending, true), Is.False, "A receipt settles once.");

            Reload(sixth);
            Assert.That(session.Snapshot.movesLeft, Is.EqualTo(rescued.movesLeft));
            CollectionAssert.AreEqual(rescued.blockerHp, session.Snapshot.blockerHp);
        }
    }
}
