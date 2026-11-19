using System;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Catalog;
using Hexrota.Commands;
using Hexrota.Economy;
using Hexrota.Gameplay;
using Hexrota.Hints;
using Hexrota.Lives;
using Hexrota.Rewards;
using Hexrota.RewardAdapterCore;
using Hexrota.Rescue;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.Application
{
    // Commands carry the revision and attempt/turn observed by their caller. This
    // prevents delayed/double UI callbacks without adding a new persisted ledger.
    public sealed class SessionCommand
    {
        public long? expectedRevision;
        public string attemptId;
        public int? turn;
    }
    public sealed partial class GameSessionController
    {
        private readonly LevelCatalog catalog;
        private readonly IList<Dictionary<string, object>> levels;
        private readonly int tutorialCount;
        private readonly bool onboardingInFirstChapter;
        private readonly ProfileRepository repository;
        private readonly AttemptRepository attempts;
        private readonly IUtcClock clock;
        private readonly LifeManager lives;
        private readonly EconomyManager economy;
        private readonly RescueManager rescue;
        private readonly uint initialSelectionSeed;
        private readonly RewardRules rewardRules;
        private readonly IReceiptVerifier recoveryReceiptVerifier;
        private Dictionary<string, object> game, energy, events;
        private Dictionary<string, object> activeLevel, metadata;
        private HexMatch engine;
        private AssistedGame assistance;
        private int active;
        private RewardState rewardState;
        private RewardPlan lastRewardPlan;
        private Dictionary<string, object> verificationProvider;
        private Dictionary<string, object> pendingBoosterQuote;
        private Dictionary<string, object> pendingRescueDelivery;
        private sealed class Verifier : IReceiptVerifier
        {
            public GameSessionController owner;
            public bool Verify(LifeTransaction receipt) { return owner != null && DevelopmentLifeProvider.Verify(owner.verificationProvider ?? W.Get(owner.energy, "provider"), receipt.ToWire()); }
        }
        private sealed class Entry
        {
            internal int index; internal Dictionary<string, object> level, metadata, stats; internal HexMatch engine; internal AssistedGame assistance;
        }
        public GameSessionController(LevelCatalog catalog, IList<Dictionary<string, object>> orderedLevels, int tutorialCount, ProfileRepository repository, Dictionary<string, object> lifeConfig, IUtcClock clock, uint initialSelectionSeed, string providerNamespace = "hexrota-test", RewardRules rewardRules = null, IReceiptVerifier recoveryReceiptVerifier = null, Dictionary<string, object> economyConfig = null, IRescueReceiptVerifier rescueReceiptVerifier = null, string rescueProviderNamespace = null, bool onboardingInFirstChapter = false)
        {
            if (catalog == null || orderedLevels == null || repository == null || clock == null || tutorialCount < 0 || tutorialCount > orderedLevels.Count || initialSelectionSeed == 0) throw new ArgumentException("Invalid application dependencies");
            this.catalog = catalog; this.levels = orderedLevels.Select(W.Copy).ToList(); this.tutorialCount = tutorialCount; this.repository = repository; this.clock = clock; this.initialSelectionSeed = initialSelectionSeed; this.rewardRules = rewardRules; this.recoveryReceiptVerifier = recoveryReceiptVerifier;
            this.onboardingInFirstChapter = onboardingInFirstChapter;
            lives = new LifeManager(lifeConfig, clock, new Verifier { owner = this }); economy = new EconomyManager(economyConfig);
            object raw = repository.Read(ProfileRepository.GameKey); string source = ProfileRepository.GameKey;
            // Present null is corrupt progression, not a new player. Never fall
            // back to an older document and overwrite a malformed newer save.
            if (repository.Contains(ProfileRepository.GameKey))
            {
                if (!W.IsMap(raw)) throw new InvalidOperationException("invalid_game_save");
            }
            else foreach (string previous in new[] { "hexrota-match-v4", "hexrota-match-v3", "hexrota-match-v2" })
            {
                if (!repository.Contains(previous)) continue;
                raw = repository.Read(previous);
                if (!W.IsMap(raw)) throw new InvalidOperationException("invalid_game_save");
                source = previous; break;
            }
            game = SaveMigration.NormalizeGame(raw, levels, tutorialCount, source); if (raw == null) game["sound"] = W.Equal(W.Get(repository.Read("hexrota-v1"), "sound"), true); if (Count(Selection["seed"]) == 0) Selection["seed"] = (long)initialSelectionSeed;
            object rawEnergy = repository.Read(ProfileRepository.LifeKey); bool hadEnergy = repository.Contains(ProfileRepository.LifeKey);
            energy = hadEnergy ? DevelopmentLifeProvider.ValidateEnergy(rawEnergy, lives) : DevelopmentLifeProvider.CreateEnergy(lives.CreateState(), providerNamespace, W.Integer(W.Get(W.Get(lifeConfig, "development"), "initialTestGold")));
            rescue = new RescueManager(W.Map(economy.Config()["rescue"]), RescueNow, rescueReceiptVerifier);
            string lifeNamespace = (string)W.Get(energy["provider"], "namespace");
            string rescueNamespace = rescueProviderNamespace ?? (hadEnergy ? lifeNamespace.Substring(0, Math.Min(130, lifeNamespace.Length)) + "-rescue" : "hexrota-rescue-" + Count(Selection["seed"]).ToString("x", System.Globalization.CultureInfo.InvariantCulture));
            game["rescue"] = W.Has(game, "rescue") ? rescue.Restore(game["rescue"]) : rescue.CreateState(W.Obj("namespace", rescueNamespace));
            attempts = new AttemptRepository(catalog, levels, tutorialCount, economy.Config(), rescue);
            object storedEvents = repository.Read(ProfileRepository.EventKey); try { GameEventTracker.ValidateState(storedEvents); events = W.Copy(storedEvents); } catch { events = GameEventTracker.CreateState(); }
            // Validation precedes all writes. Malformed snapshots are retained by
            // the storage adapter and never replaced with a different board.
            if (W.Has(game, "economy")) economy.Restore(game["economy"]);
            attempts.ValidateAll(game);
            var verified = W.Arr();
            for (int i = 0; i < levels.Count; i++)
            {
                var entry = RestoreEntry(i, false); if (entry == null) continue;
                if (entry.engine.Status != "playing") Settle(entry, entry.engine.Status == "won" ? "won" : "failed", !hadEnergy);
                RecordWin(i, entry.engine, false);
                if (i >= tutorialCount && entry.engine.Status == "won") verified.Add(levels[i]["id"]);
            }
            attempts.ValidateRescuedLives(game, energy, lives);
            // Only replay-validated winning boards corroborate legacy rewards.
            // A legacy completion without proof still permanently blocks replay.
            game["economy"] = economy.Migrate(W.Get(game, "economy"), W.Obj("done", game["done"], "verifiedLevelIds", verified, "sourceKey", source))["state"];
            SyncCompletedCampaign();
            foreach (object tx in W.Map(energy["provider"] is Dictionary<string, object> ? W.Get(energy["provider"], "transactions") : W.Obj()).Values) if (W.Equal(W.Get(tx, "status"), "pending")) W.Map(tx)["status"] = "cancelled";
            active = (int)W.Integer(game["current"]); if (!CanOpen(active)) active = NextCampaignIndex(); game["current"] = (long)active;
            LoadExisting(active, true); Capture(); CompactProvider(); repository.Commit(game, energy); repository.SaveEvents(events);
        }
        public long Revision { get { return repository.Revision; } }
        public Dictionary<string, object> GameSave { get { return W.Copy(game); } }
        public Dictionary<string, object> EnergySave { get { return W.Copy(energy); } }
        public Dictionary<string, object> EconomyView { get { return economy.View(W.Map(game["economy"])); } }
        public bool HasPendingRescueDelivery { get { return pendingRescueDelivery != null; } }
        public Dictionary<string, object> PendingRescueDelivery { get { return pendingRescueDelivery == null ? null : W.Copy(pendingRescueDelivery); } }
        public RewardState CurrentRewards { get { return rewardState == null ? null : new RewardState { version = rewardState.version, attemptId = rewardState.attemptId, lastTurn = rewardState.lastTurn, lastScore = rewardState.lastScore, lastGreen = rewardState.lastGreen, lastAccentTurn = rewardState.lastAccentTurn, scoreMask = rewardState.scoreMask, groundMask = rewardState.groundMask }; } }
        // A feedback plan is presentation output and is never fed into game rules.
        public RewardPlan LastRewardPlan { get { return lastRewardPlan; } }
        public Dictionary<string, object> EventSave { get { return W.Copy(events); } }
        public Dictionary<string, object> View()
        {
            return W.Obj("stage", (long)active, "pending", engine == null, "metadata", W.Clone(metadata), "snapshot", EngineSnapshot(), "status", engine == null ? null : engine.Status, "life", lives.View(new LifeState(W.Map(energy["life"]))));
        }
        public Dictionary<string, object> Preview(int index)
        {
            NeedIndex(index); if (!CanOpen(index)) return Result(false, ClosedReason(index));
            var entry = RestoreEntry(index, false);
            return W.Obj("ok", true, "stage", (long)index, "levelId", levels[index]["id"], "resume", entry != null && entry.engine.Status == "playing" && (entry.engine.turn > 0 || entry.assistance != null) && !Discarded(entry), "snapshot", entry == null ? null : entry.assistance == null ? (object)LevelCatalog.SnapshotWire(entry.engine.Snapshot()) : entry.assistance.Snapshot(), "metadata", entry == null ? null : W.Copy(entry.metadata));
        }
        private static Dictionary<string, object> Result(bool ok, string reason) { return W.Obj("ok", ok, "reason", reason); }
        private void NeedIndex(int index) { if (index < 0 || index >= levels.Count) throw new ArgumentOutOfRangeException("index"); }
        public bool CanOpen(int index) { return index >= 0 && index < levels.Count && (index < tutorialCount || economy.CanEnter(W.Map(game["economy"]), levels[index]["id"])); }
        private bool Completed(int index) { return index >= tutorialCount && index < levels.Count && W.List(economy.View(W.Map(game["economy"]))["cleared"]).Any(x => W.Equal(x, levels[index]["id"])); }
        private void SyncCompletedCampaign()
        {
            var done = W.List(game["done"]).Where(x => W.Integer(x) < tutorialCount).ToList();
            for (int i = tutorialCount; i < levels.Count; i++) if (Completed(i)) done.Add((long)i);
            done.Sort((a, b) => W.Integer(a).CompareTo(W.Integer(b))); game["done"] = done;
        }
        private string ClosedReason(int index) { return Completed(index) ? "level_completed" : "locked"; }
        private int NextCampaignIndex()
        {
            object next = economy.NextLevel(W.Map(game["economy"]));
            for (int i = tutorialCount; i < levels.Count; i++) if (W.Equal(levels[i]["id"], next)) return i;
            return 0;
        }
        private static long Count(object value) { return W.IsSafeInteger(value) && W.Integer(value) >= 0 ? W.Integer(value) : 0; }
        private Dictionary<string, object> Selection { get { return W.Map(game["variantSelection"]); } }
        private object EngineSnapshot() { return engine == null ? null : assistance == null ? (object)LevelCatalog.SnapshotWire(engine.Snapshot()) : assistance.Snapshot(); }
        private Entry CurrentEntry() { return engine == null ? null : new Entry { index = active, level = activeLevel, metadata = metadata, engine = engine, assistance = assistance, stats = W.Map(W.Get(game["attemptStats"], active.ToString())) }; }
        private Entry RestoreEntry(int index, bool stats)
        {
            var restored = attempts.RestoreSession(game, index); if (restored == null) return null;
            var entry = new Entry { index = index, level = restored.LevelWire, metadata = restored.Metadata.ToWire(), engine = restored.Game, assistance = restored.Assistance };
            if (stats) entry.stats = StatsFor(entry, false); return entry;
        }
        private Dictionary<string, object> StatsFor(Entry entry, bool fresh)
        {
            string key = entry.index.ToString(), id = W.JsString(entry.level["id"]); var previous = W.Get(game["attemptStats"], key);
            bool same = !fresh && W.Equal(W.Get(previous, "attemptId"), entry.metadata["attemptId"]);
            var counts = W.Map(Selection["counts"]); counts[id] = Math.Max(1, Math.Max(Count(W.Get(counts, id)), same ? Count(W.Get(previous, "attemptNumber")) : 0));
            Dictionary<string, object> stats;
            if (same)
            {
                stats = W.Map(previous); stats["attemptNumber"] = Math.Max(1, Count(W.Get(stats, "attemptNumber"))); stats["started"] = W.Equal(W.Get(stats, "started"), true) || entry.engine.turn > 0;
                if (!new[] { "level_completed", "level_failed", "level_abandoned" }.Contains(W.Get(stats, "terminalEvent") as string)) stats["terminalEvent"] = null;
                stats["hintsUsed"] = Count(W.Get(stats, "hintsUsed")); stats["cascades"] = Count(W.Get(stats, "cascades"));
            }
            else
            {
                long cascades = 0;
                if (entry.assistance == null) { var replay = new HexMatch(LevelCatalog.GameplayConfig(entry.level)); foreach (var pair in entry.engine.history) { var swap = replay.Swap(pair[0], pair[1]); if (swap.ok) cascades += Math.Max(0, swap.frames.Length - 1); } }
                else { var replay = new AssistedGame(LevelCatalog.GameplayConfig(entry.level), (string)entry.metadata["attemptId"], attempts.AssistanceLimits); foreach (object item in W.List(entry.assistance.Commands)) { var result = replay.Apply(item); if (W.Equal(W.Get(result, "ok"), true)) cascades += Math.Max(0, W.List(W.Get(result, "frames")).Count - 1); } }
                stats = W.Obj("attemptId", entry.metadata["attemptId"], "attemptNumber", counts[id], "started", !fresh && (entry.engine.turn > 0 || entry.assistance != null), "terminalEvent", !fresh && entry.engine.Status != "playing" ? entry.engine.Status == "won" ? "level_completed" : "level_failed" : null, "hintsUsed", 0L, "cascades", cascades);
                W.Map(game["attemptStats"])[key] = stats;
            }
            return stats;
        }
        private void LoadExisting(int index, bool register)
        {
            pendingBoosterQuote = null;
            active = index; game["current"] = (long)index; var entry = RestoreEntry(index, true);
            if (entry == null) { metadata = null; engine = null; assistance = null; activeLevel = levels[index]; rewardState = null; lastRewardPlan = null; return; }
            metadata = entry.metadata; engine = entry.engine; assistance = entry.assistance; activeLevel = entry.level; Selection["serial"] = Math.Max(Count(Selection["serial"]), Count(metadata["attemptSerial"]));
            if (register && index >= tutorialCount) Register(entry, true); RestoreRewards(); MarkCompleted(false);
        }
        private bool Discarded(Entry entry) { var settlement = lives.SettlementFor(new LifeState(W.Map(energy["life"])), (string)entry.metadata["attemptId"]); return settlement != null && W.Equal(W.Get(settlement.ToWire(), "discarded"), true); }
        private Dictionary<string, object> LifeContext(Entry entry, string outcome)
        {
            return W.Obj("attemptId", entry.metadata["attemptId"], "levelId", entry.level["id"], "tutorial", W.Equal(W.Get(entry.level, "kind"), "tutorial"), "movesUsed", (long)entry.engine.turn, "outcome", outcome, "confirmed", outcome == "restart");
        }
        private void Register(Entry entry, bool resume)
        {
            var result = lives.RegisterAttempt(new LifeState(W.Map(energy["life"])), W.Obj("attemptId", entry.metadata["attemptId"], "levelId", entry.level["id"], "tutorial", W.Equal(W.Get(entry.level, "kind"), "tutorial"), "resume", resume)); if (!result.Applied && !resume) throw new ProfileStorageException(result.Reason); if (!result.Applied && resume && result.Reason != "already_registered" && result.Reason != "already_settled") throw new ProfileStorageException(result.Reason); energy["life"] = result.State.ToWire();
        }
        private LifeOperationResult Settle(Entry entry, string outcome, bool historical = false)
        {
            var result = historical ? lives.AcknowledgeHistoricalAttempt(new LifeState(W.Map(energy["life"])), LifeContext(entry, outcome)) : lives.SettleAttempt(new LifeState(W.Map(energy["life"])), LifeContext(entry, outcome)); energy["life"] = result.State.ToWire(); return result;
        }
        private void Refresh() { energy["life"] = lives.Reconcile(new LifeState(W.Map(energy["life"]))).ToWire(); }
        private long RescueNow() { return Math.Max(clock.NowUtcMilliseconds(), Count(W.Get(W.Get(energy, "life"), "lastSeenUtc"))); }
        private void Capture() { game["current"] = (long)active; if (engine != null) { W.Map(game["boards"])[active.ToString()] = EngineSnapshot(); W.Map(game["attempts"])[active.ToString()] = W.Copy(metadata); } }
        private void RecordWin(int index, HexMatch board, bool played)
        {
            if (board.Status != "won") return; var previous = W.Get(game["records"], index.ToString()); W.Map(game["records"])[index.ToString()] = W.Obj("score", Math.Max(Count(W.Get(previous, "score")), board.score), "movesLeft", Math.Max(Count(W.Get(previous, "movesLeft")), board.movesLeft), "plays", Count(W.Get(previous, "plays")) + (played ? 1 : 0));
        }
        private void MarkCompleted(bool played)
        {
            if (engine == null) return; RecordWin(active, engine, played); var done = W.List(game["done"]); if (engine.Status == "won" && !done.Any(x => W.Equal(x, (long)active))) { done.Add((long)active); done.Sort((a, b) => W.Integer(a).CompareTo(W.Integer(b))); }
            if (engine.Status == "won" && active >= tutorialCount)
            {
                var completion = economy.Complete(W.Map(game["economy"]), W.Obj("levelId", activeLevel["id"], "attemptId", metadata["attemptId"], "status", "won", "verified", true, "assisted", assistance != null && assistance.Assisted, "tutorial", false));
                game["economy"] = completion["state"];
                SyncCompletedCampaign();
            }
            bool taughtInChapter = onboardingInFirstChapter && active == tutorialCount && !done.Contains((long) tutorialCount - 1);
            if (played && engine.Status == "won" && (active == tutorialCount - 1 || taughtInChapter))
            {
                var welcome = economy.ClaimWelcome(W.Map(game["economy"]), W.Obj("levelId", activeLevel["id"], "attemptId", metadata["attemptId"], "status", "won", "verified", true), taughtInChapter);
                game["economy"] = welcome["state"];
            }
        }
        private Dictionary<string, object> Context(Entry entry)
        {
            return W.Obj("timestamp", clock.NowUtcMilliseconds(), "levelId", entry.metadata["levelId"], "variantId", entry.metadata["variantId"], "levelDataVersion", entry.metadata["levelDataVersion"], "attemptId", entry.metadata["attemptId"], "attemptNumber", Math.Max(1, Count(entry.stats["attemptNumber"])), "movesUsed", (long)entry.engine.turn, "movesRemaining", (long)entry.engine.movesLeft, "score", (long)entry.engine.score, "targetScore", entry.level["target"], "covered", (long)entry.engine.Covered, "totalCells", (long)entry.engine.Total, "remainingLayers", (long)entry.engine.RemainingLayers, "cascades", Count(entry.stats["cascades"]), "hintsUsed", Count(entry.stats["hintsUsed"]), "status", entry.engine.Status);
        }
        private void Emit(string name, Entry entry, Dictionary<string, object> details = null) { events = GameEventTracker.Append(events, name, Context(entry), details); }
        private void Started(string reason)
        {
            var entry = CurrentEntry(); if (entry == null || W.Equal(entry.stats["started"], true) || engine.Status != "playing") return; entry.stats["started"] = true; Emit("level_started", entry, W.Obj("reason", reason));
        }
        private void Terminal()
        {
            var entry = CurrentEntry(); if (entry == null || !W.Equal(entry.stats["started"], true) || W.Truthy(entry.stats["terminalEvent"]) || engine.Status == "playing") return; string name = engine.Status == "won" ? "level_completed" : "level_failed"; entry.stats["terminalEvent"] = name;
            // Failure is counted once per attempt, even after the bounded event
            // buffer has evicted its original failure. The rescue ledger, not
            // analytics retention, proves this is the second terminal loss.
            if (name == "level_failed" && assistance != null && W.Integer(W.Get(assistance.Usage, "rescue")) > 0 && rescue.SettlementFor(game["rescue"], (string)metadata["attemptId"]) != null) return;
            Emit(name, entry);
        }
        private void Abandon(Entry entry, string reason)
        {
            if (entry != null && entry.engine.Status == "playing" && W.Equal(entry.stats["started"], true) && !W.Truthy(entry.stats["terminalEvent"])) { entry.stats["terminalEvent"] = "level_abandoned"; Emit("level_abandoned", entry, W.Obj("reason", reason)); }
        }
        private void RestoreRewards()
        {
            rewardState = null; lastRewardPlan = null; if (engine != null && rewardRules != null && assistance == null) { var restored = RewardAdapter.Restore(engine.level, engine.Snapshot(), rewardRules, (string)metadata["attemptId"], active < tutorialCount); rewardState = restored.state; /* Restoring state never re-emits historical cues. */ }
        }
        private Dictionary<string, object> Guard(SessionCommand command)
        {
            if (command == null) return null;
            if (command.expectedRevision.HasValue && command.expectedRevision.Value != Revision) return Result(false, "stale_revision");
            if (command.attemptId != null && (metadata == null || command.attemptId != (string)metadata["attemptId"])) return Result(false, "stale_attempt");
            if (command.turn.HasValue && (engine == null || command.turn.Value != engine.turn)) return Result(false, "stale_turn"); return null;
        }
        private Dictionary<string, object> Execute(Func<Dictionary<string, object>> action, SessionCommand command = null)
        {
            var denied = Guard(command); if (denied != null) return denied;
            var oldGame = W.Copy(game); var oldEnergy = W.Copy(energy); var oldEvents = W.Copy(events); int oldActive = active;
            try
            {
                var result = action(); Capture(); CompactProvider(); repository.Commit(game, energy); repository.SaveEvents(events); return result;
            }
            catch (Exception error)
            {
                game = oldGame; energy = oldEnergy; events = oldEvents; active = oldActive; LoadExisting(active, false);
                var storage = error as ProfileStorageException; if (storage != null) return Result(false, storage.Code);
                throw;
            }
        }
        public Dictionary<string, object> Enter(int index, bool fresh = false, string reason = "stage_entry", bool confirmed = false, int? maximumCharge = null, SessionCommand command = null)
        {
            return EnterStage(index, fresh, reason, confirmed, maximumCharge, command, false);
        }
        public Dictionary<string, object> SkipTutorials(SessionCommand command = null)
        {
            if (active >= tutorialCount || engine == null || engine.Status != "playing") return Result(false, "no_tutorial");
            return EnterStage(tutorialCount, false, "stage_entry", false, null, command, true);
        }
        private void MarkLessonsSkipped()
        {
            var done = W.List(game["done"]);
            for (int i = 0; i < tutorialCount; i++)
                if (!done.Contains((long)i)) done.Add((long)i);
            game["done"] = done.OrderBy(value => W.Integer(value)).ToList();
        }
        private Dictionary<string, object> EnterStage(int index, bool fresh, string reason, bool confirmed, int? maximumCharge, SessionCommand command, bool skipTutorials)
        {
            NeedIndex(index); if (!CanOpen(index)) return Result(false, ClosedReason(index));
            var existing = RestoreEntry(index, false);
            if (HasPendingRescueDelivery && (fresh || existing == null || metadata == null || !W.Equal(existing.metadata["attemptId"], metadata["attemptId"]))) return Result(false, "pending_rescue_delivery");
            if (existing != null && existing.engine.Status == "lost" && !fresh && index >= tutorialCount) { if (RecoverableLoss(existing)) return ResumeForSecondChance(index, command, skipTutorials); fresh = true; }
            if (existing != null && existing.engine.Status == "playing" && fresh && !confirmed) return Result(false, "confirmation_required");
            return Execute(() =>
            {
                Refresh(); var previous = RestoreEntry(index, true); if (previous != null && Discarded(previous)) fresh = true;
                bool newAttempt = fresh || previous == null || previous.engine.Status != "playing";
                if (index >= tutorialCount && newAttempt && previous != null && previous.engine.Status != "playing") Settle(previous, previous.engine.Status == "won" ? "won" : "failed");
                if (index >= tutorialCount && newAttempt && !lives.CanStart(new LifeState(W.Map(energy["life"])), W.Obj("tutorial", false))) return Result(false, "lives_empty");
                if (fresh && previous != null && previous.engine.Status == "playing" && index >= tutorialCount)
                {
                    var priorLife = W.Copy(energy["life"]); var settlement = Settle(previous, "restart");
                    if (maximumCharge == 0 && settlement.Charged == true) { energy["life"] = priorLife; return Result(false, "confirmation_changed"); }
                    if (!lives.CanStart(new LifeState(W.Map(energy["life"])), W.Obj("tutorial", false))) { Abandon(previous, reason); return Result(false, "lives_empty"); }
                }
                if (fresh) game["guideAcks"] = W.List(game["guideAcks"]).Where(x => !((string)x).StartsWith(index + ":", StringComparison.Ordinal)).ToList();
                if (previous != null && !fresh) LoadExisting(index, true);
                else
                {
                    active = index; game["current"] = (long)index; activeLevel = levels[index]; string id = W.JsString(activeLevel["id"]); long serial = Count(Selection["serial"]) + 1;
                    if (serial > W.MaxSafeInteger) throw new ProfileStorageException("attempt_serial_exhausted");
                    if (index < tutorialCount) { metadata = catalog.TutorialMetadata((string)activeLevel["id"], serial).ToWire(); Selection["serial"] = serial; }
                    else
                    {
                        var recent = W.List(W.Get(Selection["recent"], id, W.Arr())); var started = catalog.Start(activeLevel["id"], W.Obj("attemptSerial", serial, "selectionSeed", Count(Selection["seed"]) > 0 ? Selection["seed"] : (object)(long)initialSelectionSeed, "previousVariantId", W.Get(W.Get(game["attempts"], index.ToString()), "variantId"), "recentVariantIds", recent));
                        metadata = started.Metadata.ToWire(); activeLevel = started.LevelWire; Selection["seed"] = (long)started.SelectionSeed; Selection["serial"] = metadata["attemptSerial"]; recent.Add(metadata["variantId"]); W.Map(Selection["recent"])[id] = recent.Skip(Math.Max(0, recent.Count - 16)).ToList();
                    }
                    W.Map(Selection["counts"])[id] = Count(W.Get(Selection["counts"], id)) + 1; engine = new HexMatch(LevelCatalog.GameplayConfig(activeLevel)); assistance = null; var entry = new Entry { index = active, metadata = metadata, level = activeLevel, engine = engine }; entry.stats = StatsFor(entry, true); if (index >= tutorialCount) Register(entry, false); RestoreRewards();
                }
                if (fresh && previous != null) { CancelPendingRescue((string)previous.metadata["attemptId"]); Abandon(previous, reason); } MarkCompleted(false); Started(reason);
                if (fresh && previous != null && !W.Equal(previous.metadata["attemptId"], metadata["attemptId"])) Emit("level_retried", CurrentEntry(), W.Obj("reason", reason, "previousAttemptId", previous.metadata["attemptId"]));
                if (skipTutorials) MarkLessonsSkipped();
                return Result(true, newAttempt ? "started" : "resumed");
            }, command);
        }
        public Dictionary<string, object> Swap(int a, int b, SessionCommand command = null)
        {
            var guard = Guard(command); if (guard != null) return guard; if (engine == null) return Result(false, "no_attempt"); if (Completed(active)) return Result(false, "level_completed"); if (Discarded(CurrentEntry())) return Result(false, "attempt_discarded");
            // Swap validation is performed on a clone before opening a transaction.
            var check = engine.Clone().Swap(a, b); if (!check.ok) return Result(false, check.reason);
            if (active < tutorialCount)
            {
                var step = W.List(W.Get(activeLevel, "steps", W.Arr())).ElementAtOrDefault(engine.turn); var pair = W.Get(step, "pair");
                if (pair != null && !W.Equal(pair, W.Arr((long)a, (long)b)) && !W.Equal(pair, W.Arr((long)b, (long)a))) return Result(false, "guided_swap_required");
            }
            return Execute(() =>
            {
                var before = engine.Snapshot(); var stats = CurrentEntry().stats;
                if (assistance == null)
                {
                    var swap = engine.Swap(a, b); stats["cascades"] = Count(stats["cascades"]) + Math.Max(0, swap.frames.Length - 1);
                    if (rewardRules != null) { var input = RewardAdapter.Summarize(engine.level, before, swap, engine, (string)metadata["attemptId"], active < tutorialCount); var reward = RewardDirector.Evaluate(input, rewardState, rewardRules); rewardState = reward.nextState; lastRewardPlan = reward.plan; }
                }
                else { var swap = assistance.Swap(a, b); if (!W.Equal(W.Get(swap, "ok"), true)) throw new ProfileStorageException("assisted_swap_rejected"); engine = assistance.Model; stats["cascades"] = Count(stats["cascades"]) + Math.Max(0, W.List(W.Get(swap, "frames")).Count - 1); rewardState = null; lastRewardPlan = null; }
                MarkCompleted(true); if (engine.Status != "playing") Settle(CurrentEntry(), engine.Status == "won" ? "won" : "failed"); Terminal(); return Result(true, engine.Status);
            }, command);
        }
        private static int[][] Route(object value) { return value == null ? null : W.List(value).Select(p => W.List(p).Select(x => W.Int32(x)).ToArray()).ToArray(); }
        private static int[][][] Routes(object value) { return value == null ? null : W.List(value).Select(Route).ToArray(); }
        public Dictionary<string, object> Hint(HintOptions options = null, IHintClock hintClock = null, SessionCommand command = null)
        {
            var denied = Guard(command); if (denied != null) return denied; if (Completed(active)) return Result(false, "level_completed"); if (engine == null || engine.Status != "playing") return Result(false, "no_hint"); if (Discarded(CurrentEntry())) return Result(false, "attempt_discarded");
            HintResult hint; if (active < tutorialCount)
            {
                var step = W.List(W.Get(activeLevel, "steps", W.Arr())).ElementAtOrDefault(engine.turn); var pair = W.Get(step, "pair"); if (pair == null) return Result(false, "no_hint"); hint = new HintResult { pair = W.List(pair).Select(W.Int32).ToArray(), source = "guided", guaranteed = false };
            }
            else hint = HintSolver.Find(engine, assistance == null ? HintRoutes.Create(engine.level, Routes(W.Get(activeLevel, "solutions")), Route(W.Get(activeLevel, "solution")), Routes(W.Get(activeLevel, "alternativeSolutions"))) : null, options, hintClock);
            if (hint == null) return Result(false, "no_hint");
            return Execute(() => { var entry = CurrentEntry(); entry.stats["hintsUsed"] = Count(entry.stats["hintsUsed"]) + 1; string guarantee = hint.source == "proven_route" ? "certified_route" : hint.source == "search_win" ? "bounded_search" : hint.source == "guided" ? "guided" : "none"; Emit("hint_used", entry, W.Obj("hintKind", hint.source, "hintGuarantee", guarantee)); return W.Obj("ok", true, "reason", "hint", "pair", hint.pair.Select(x => (object)(long)x).ToList(), "source", hint.source, "guaranteed", hint.guaranteed); }, command);
        }
        public Dictionary<string, object> Retry(string reason = "retry", SessionCommand command = null) { if (HasPendingRescueDelivery) return Result(false, "pending_rescue_delivery"); if (Completed(active)) return Result(false, "level_completed"); if (engine == null) return Result(false, "no_attempt"); if (engine.Status == "playing") return Result(false, "confirmation_required"); return Enter(active, true, reason, true, null, command); }
        public Dictionary<string, object> Restart(bool confirmed, int? maximumCharge = null, SessionCommand command = null)
        {
            if (!confirmed) return Result(false, "cancelled");
            if (HasPendingRescueDelivery) return Result(false, "pending_rescue_delivery");
            if (Completed(active)) return Result(false, "level_completed");
            if (active >= tutorialCount && engine != null && engine.Status == "playing" && engine.turn > 0 && !lives.CanStart(new LifeState(W.Map(energy["life"]))))
                return Execute(() => { Refresh(); var entry = CurrentEntry(); var previous = W.Copy(energy["life"]); var settlement = Settle(entry, "restart"); if (maximumCharge == 0 && settlement.Charged == true) { energy["life"] = previous; return Result(false, "confirmation_changed"); } CancelPendingRescue((string)entry.metadata["attemptId"]); Abandon(entry, "restart"); return Result(false, "lives_empty"); }, command);
            return Enter(active, true, "restart", true, maximumCharge, command);
        }
        public Dictionary<string, object> ReturnToMenu(SessionCommand command = null) { return Execute(() => { Refresh(); return Result(true, "menu"); }, command); }
        public Dictionary<string, object> Close(SessionCommand command = null) { return Execute(() => { Refresh(); return Result(true, "closed"); }, command); }
        public Dictionary<string, object> RefreshLives(SessionCommand command = null) { return Execute(() => { Refresh(); game["rescue"] = rescue.Reconcile(game["rescue"]); return Result(true, "refreshed"); }, command); }
        public Dictionary<string, object> SetDeveloperBypass(bool enabled, SessionCommand command = null) { return Execute(() => { energy["life"] = lives.SetDeveloperBypass(new LifeState(W.Map(energy["life"])), enabled).State.ToWire(); return Result(true, "developer_setting"); }, command); }
        public Dictionary<string, object> SetAdAvailable(bool available) { return Execute(() => { energy["provider"] = DevelopmentLifeProvider.SetAdAvailable(energy["provider"], available); return Result(true, "developer_setting"); }); }
        public Dictionary<string, object> AcknowledgeTutorial(SessionCommand command = null)
        {
            if (active >= tutorialCount || engine == null) return Result(false, "not_tutorial");
            return Execute(() => { string id = active + ":" + engine.turn; var acks = W.List(game["guideAcks"]); if (!acks.Contains(id)) acks.Add(id); return Result(true, "acknowledged"); }, command);
        }
        public Dictionary<string, object> ResetProgress(bool confirmed, int? maximumCharge = null, SessionCommand command = null)
        {
            if (!confirmed) return Result(false, "cancelled");
            if (HasPendingRescueDelivery) return Result(false, "pending_rescue_delivery");
            return Execute(() =>
            {
                Refresh(); int charged = 0; var previousLife = W.Copy(energy["life"]); var open = new List<Entry>();
                for (int i = 0; i < levels.Count; i++) { if (Completed(i)) continue; var entry = RestoreEntry(i, true); if (entry != null && entry.engine.Status == "playing") { open.Add(entry); if (Settle(entry, "restart").Charged == true) charged++; } }
                if (maximumCharge.HasValue && charged > maximumCharge.Value) { energy["life"] = previousLife; return Result(false, "confirmation_changed"); }
                for (int i = 0; i < levels.Count; i++) if (!Completed(i)) { var entry = RestoreEntry(i, false); if (entry != null) CancelPendingRescue((string)entry.metadata["attemptId"]); }
                foreach (var entry in open) Abandon(entry, "progress_reset");
                // Keep permanent campaign proof and the one-time ledger. Reset
                // may discard unfinished games, never reopen a cleared level.
                foreach (string key in new[] { "boards", "attempts", "attemptStats", "records" }) game[key] = W.Map(game[key]).Where(pair => { int index; return int.TryParse(pair.Key, out index) && Completed(index); }).ToDictionary(pair => pair.Key, pair => W.Clone(pair.Value));
                game["done"] = W.List(game["done"]).Where(x => W.Integer(x) >= tutorialCount).ToList(); game["guideAcks"] = W.Arr(); LoadExisting(NextCampaignIndex(), false); return Result(true, "progress_reset");
            }, command);
        }
        private void CompactProvider()
        {
            var provider = W.Map(energy["provider"]); var wallet = W.Map(energy["testWallet"]); var processed = W.Map(wallet["processedTransactions"]);
            var closed = W.Map(provider["transactions"]).Values.Where(tx => W.Equal(W.Get(tx, "status"), "cancelled") || W.Equal(W.Get(tx, "status"), "unavailable") || W.Equal(W.Get(tx, "status"), "completed") && W.Has(processed, (string)W.Get(tx, "transactionId"))).OrderBy(tx => W.Integer(W.Get(tx, "createdAtUtc"))).ToList();
            foreach (object tx in closed.Take(Math.Max(0, closed.Count - 128))) { string id = (string)W.Get(tx, "transactionId"); provider = DevelopmentLifeProvider.Finalize(provider, id); if (DevelopmentLifeProvider.IsFinalized(provider, id)) processed.Remove(id); } energy["provider"] = provider;
        }
        public Dictionary<string, object> BeginProduct(string product)
        {
            return Execute(() => { Refresh(); if (product != "test_gold_300") { var offer = lives.TransactionAvailability(new LifeState(W.Map(energy["life"])), product); if (!W.Equal(W.Get(offer, "allowed"), true)) return Result(false, W.Get(offer, "reason") as string); if (W.Integer(offer["costGold"]) > W.Integer(W.Get(energy["testWallet"], "gold"))) return Result(false, "insufficient_gold"); } var began = DevelopmentLifeProvider.Begin(energy["provider"], product, W.Integer(lives.View(new LifeState(W.Map(energy["life"]))) ["effectiveNowUtc"])); energy["provider"] = began["state"]; return W.Obj("ok", began["transactionId"] != null, "reason", began["reason"], "transactionId", began["transactionId"]); });
        }
        // A platform may re-deliver a completed provider receipt after a failed
        // write. The authoritative completed provider proof is supplied too.
        public Dictionary<string, object> ApplyReceipt(object receipt, object completedProvider = null)
        {
            object proof = completedProvider ?? energy["provider"]; object provider;
            try
            {
                string receiptId = W.Get(receipt, "transactionId") as string;
                if (!DevelopmentLifeProvider.Verify(proof, receipt) || !W.Equal(W.Get(proof, "namespace"), W.Get(energy["provider"], "namespace")) || DevelopmentLifeProvider.IsFinalized(energy["provider"], receiptId)) return Result(false, "unverified_receipt");
                var current = W.Copy(energy["provider"]); var issued = W.Get(current["transactions"], receiptId); var completed = W.Get(W.Get(proof, "transactions"), receiptId);
                string issuedStatus = W.Get(issued, "status") as string;
                bool trustedRecovery = issuedStatus == "cancelled" && recoveryReceiptVerifier != null && recoveryReceiptVerifier.Verify(new LifeTransaction(W.Map(receipt)));
                if (issuedStatus != "pending" && !(issuedStatus == "completed" && W.Equal(W.Get(issued, "receipt"), receipt)) && !trustedRecovery) return Result(false, "unverified_receipt");
                if (!W.IsMap(issued) || !W.Equal(W.Get(issued, "productId"), W.Get(completed, "productId")) || !W.Equal(W.Get(issued, "createdAtUtc"), W.Get(completed, "createdAtUtc"))) return Result(false, "unverified_receipt");
                W.Map(current["transactions"])[receiptId] = W.Clone(completed); DevelopmentLifeProvider.Validate(current); provider = current;
            }
            catch { return Result(false, "unverified_receipt"); }
            return Execute(() =>
            {
                Refresh(); string id = (string)W.Get(receipt, "transactionId"), product = (string)W.Get(receipt, "productId"); var wallet = W.Map(energy["testWallet"]); var processed = W.Map(wallet["processedTransactions"]); if (processed.ContainsKey(id)) return Result(false, "duplicate_transaction");
                energy["provider"] = W.Copy(provider); bool applied = false; string reason = "rejected"; long delta = 0;
                if (product == "test_gold_300") { delta = Math.Min(300, 2147483647L - W.Integer(wallet["gold"])); wallet["gold"] = W.Integer(wallet["gold"]) + delta; applied = delta > 0; reason = applied ? "test_gold_granted" : "wallet_full"; }
                else
                {
                    var offer = lives.TransactionAvailability(new LifeState(W.Map(energy["life"])), product); if (W.Integer(offer["costGold"]) > W.Integer(wallet["gold"])) reason = "insufficient_gold";
                    else { try { verificationProvider = W.Copy(provider); var result = lives.ApplyTransaction(new LifeState(W.Map(energy["life"])), W.Map(receipt)); energy["life"] = result.State.ToWire(); applied = result.Applied; reason = result.Reason; if (applied) { delta = -W.Integer(offer["costGold"]); wallet["gold"] = W.Integer(wallet["gold"]) + delta; } } finally { verificationProvider = null; } }
                }
                processed[id] = W.Obj("productId", product, "goldDelta", delta, "atUtc", W.Get(energy["life"], "lastSeenUtc")); return Result(applied, reason);
            });
        }
        public Dictionary<string, object> CompleteProduct(string id, string outcome = "completed")
        {
            var completed = DevelopmentLifeProvider.Complete(energy["provider"], id, W.Integer(lives.View(new LifeState(W.Map(energy["life"]))) ["effectiveNowUtc"]), outcome);
            if (completed["receipt"] != null) return ApplyReceipt(completed["receipt"], completed["state"]);
            return Execute(() => { energy["provider"] = W.Copy(completed["state"]); return Result(false, (string)completed["reason"]); });
        }
    }
}
