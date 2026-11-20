using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Hexrota.Application;
using Hexrota.Catalog;
using Hexrota.Gameplay;
using Hexrota.Lives;
using Hexrota.UnityClient;
using W = Hexrota.Contracts.Wire;

internal static class Program
{
    private sealed class Clock : IUtcClock { public long NowUtcMilliseconds() { return 1794916800000L; } }
    private static int assertions, groups, routes, variantCount;
    private static ClientGameData data;
    private static string resources;
    private static void Need(bool value, string message) { assertions++; if (!value) throw new InvalidOperationException(message); }
    private static void Same(object a, object b, string message) { Need(W.Equal(a, b), message); }
    private static void Group(string name, Action run) { run(); groups++; Console.WriteLine("PASS " + name); }
    private static void Throws(Action run, string message) { bool failed = false; try { run(); } catch { failed = true; } Need(failed, message); }
    private static string Snap(UnityGameSession session) { return WireJsonCodec.Serialize(LevelCatalog.SnapshotWire(session.Snapshot)); }
    private static Dictionary<string, object> Profile(IProfileStorage storage) { return W.Map(storage.Read(ProfileRepository.ProfileKey)); }
    private static object Economy(IProfileStorage storage) { return W.Get(W.Get(Profile(storage), "game"), "economy"); }
    private static Dictionary<string, object> Metadata(IProfileStorage storage) { return W.Map(W.Get(W.Get(W.Get(Profile(storage), "game"), "attempts"), "2")); }
    private static List<object> Route(IProfileStorage storage)
    {
        var metadata = Metadata(storage);
        var level = data.Catalog.ResolveLevelWire(metadata["levelId"], (string)metadata["variantId"], (string)metadata["levelDataVersion"]);
        return W.List(W.List(W.Get(level, "solutions"))[0]);
    }
    private static int[] Pair(object wire) { return W.List(wire).Select(W.Int32).ToArray(); }
    private static UnityGameSession New(IProfileStorage storage, uint seed = 4303818) { return new UnityGameSession(data, storage, new Clock(), seed); }
    private static void Main(string[] args)
    {
        if (args.Length != 1) throw new ArgumentException("Pass canonical Resources directory");
        resources = Path.GetFullPath(args[0]); UnityEngine.Resources.FixtureRoot = resources;
        data = ClientGameData.FromResources();
        Group("canonical resource load, numeric/string IDs, codec boundaries", Codec);
        Group("40 real variants and every authored winning route replay and restore", CatalogRoutes);
        Group("input rejection, durable move, animation lock, cancellation, resume", Lifecycle);
        Group("failed canonical storage transaction rolls back complete game and economy", FailedTransaction);
        Group("winning transaction failure cannot persist terminal state or reward", FailedTerminal);
        Group("file compare/exchange, crash-window failure and corrupt-save preservation", FileStorage);
        Group("file-backed session survives cancellation and reconstructs exact snapshot", FileResume);
        Group("one-time campaign completion rejects duplicate settlement and replay", Completion);
        Group("real losing game reaches terminal result and retries with new identity", Loss);
        Group("release compile has no development tools and clears a saved lives bypass", ReleaseHasNoDevelopmentTools);
        Console.WriteLine("HOST_RESULT " + WireJsonCodec.Serialize(W.Obj("groups", groups, "assertions", assertions, "variants", variantCount, "winningRoutes", routes, "scope", "Real .NET runtime/core/file-storage execution; Unity resource seams only. No Unity Editor, PlayMode, IL2CPP, WebGL or device execution.")));
    }
    private static void Codec()
    {
        Need(data.Levels.Count == 12 && data.TutorialCount == 2, "Expected 10 campaign and two fixed tutorial levels");
        Need(data.Levels[0]["id"] is string && data.Levels[2]["id"] is long, "Level ID type lost");
        var raw = WireJsonCodec.Parse("{\"id\":1,\"name\":\"learn-1\",\"seed\":4294967295,\"empty\":null,\"nested\":[null,2],\"stamp\":\"2026-11-17\"}");
        Need(W.Get(raw, "id") is long && W.Get(raw, "stamp") is string, "JSON algebra mismatch");
        Need(W.Integer(W.Get(raw, "seed")) == uint.MaxValue, "Unsigned RNG range lost");
        Same(raw, WireJsonCodec.Parse(WireJsonCodec.Serialize(raw)), "Codec roundtrip changed wire values");
        foreach (var bad in new[] { "{\"a\":1,\"a\":2}", "{}{}", "[NaN]", "[Infinity]", "", "{", "[1,]garbage" }) Throws(() => WireJsonCodec.Parse(bad), "Malformed JSON accepted: " + bad);
        Throws(() => ClientGameData.Load(path => path.EndsWith("variants", StringComparison.Ordinal) ? "{}" : File.ReadAllText(Path.Combine(resources, path + ".json"))), "Missing catalog envelope accepted");
    }
    private static void CatalogRoutes()
    {
        var document = WireJsonCodec.Parse(File.ReadAllText(Path.Combine(resources, "HexrotaData/variants.json")));
        foreach (var levelEntry in W.List(W.Get(document, "levels")))
        foreach (var variantEntry in W.List(W.Get(levelEntry, "variants")))
        {
            variantCount++;
            object levelId = W.Get(levelEntry, "levelId");
            if (levelId == null) levelId = W.Get(levelEntry, "id");
            var config = data.Catalog.ResolveLevelWire(levelId, (string)W.Get(variantEntry, "id"), "variants-v1");
            foreach (var route in W.List(W.Get(config, "solutions")))
            {
                routes++; var engine = new HexMatch(LevelCatalog.GameplayConfig(config));
                foreach (var item in W.List(route)) { var pair = Pair(item); Need(engine.Swap(pair[0], pair[1]).ok, "Certified route rejected"); }
                Need(engine.Status == "won", "Certified route did not win");
                // Catalog metadata sanitization requires canonical attempt IDs; use
                // engine replay restore here, with session identity tested below.
                var restored = new HexMatch(engine.level, engine.Snapshot());
                Same(LevelCatalog.SnapshotWire(engine.Snapshot()), LevelCatalog.SnapshotWire(restored.Snapshot()), "Replay restore changed terminal snapshot");
                var damaged = engine.Snapshot(); damaged.score++;
                Throws(() => new HexMatch(engine.level, damaged), "Tampered snapshot accepted");
            }
        }
        Need(variantCount == 40 && routes >= 80, "Published catalog coverage incomplete");
    }
    private static void Lifecycle()
    {
        var storage = new MemoryProfileStorage(); var session = New(storage);
        Need(session.EnterLevelOne(), "Level one did not start");
        var first = Route(storage)[0]; var pair = Pair(first);
        string before = Snap(session); long revision = session.Revision; object profile = Profile(storage);
        Need(!session.TrySwap(-1, 99).Ok, "Invalid input accepted");
        Need(session.Revision == revision && Snap(session) == before, "Invalid input mutated state"); Same(profile, Profile(storage), "Invalid input wrote profile");
        var move = session.TrySwap(pair[0], pair[1]);
        Need(move.Ok && move.Swap.frames.Length > 0 && session.IsPresenting, "Real move presentation not created");
        Need(session.Snapshot.turn == 1 && session.Snapshot.movesLeft == move.Before.movesLeft - 1, "Move budget mismatch");
        var clone = new HexMatch(session.Level, move.Before); clone.Swap(pair[0], pair[1]);
        Same(LevelCatalog.SnapshotWire(clone.Snapshot()), LevelCatalog.SnapshotWire(move.After), "Presentation differs from authoritative core");
        revision = session.Revision; Need(!session.TrySwap(pair[0], pair[1]).Ok, "Animation lock failed"); Need(session.Revision == revision, "Animation lock mutated save");
        string after = Snap(session); session.CancelPresentation(); Need(!session.IsPresenting && Snap(session) == after, "Cancellation changed committed board");
        var identity = Metadata(storage); session.Suspend();
        var restored = New(storage); Need(restored.EnterLevelOne() && Snap(restored) == after, "Resume changed snapshot/RNG/history"); Same(identity, Metadata(storage), "Resume selected a different attempt");
        // Leaving an open chapter after a move ends the attempt; the life reserved at its start stays spent.
        int lives = restored.ReadPhoneWallet().Lives; Need(lives == 4 && restored.LeavingSpendsLife, "Starting a chapter did not reserve a life");
        restored.ReturnToMenu(); Need(!restored.HasAttempt, "Menu left input enabled");
        Need(restored.ReadPhoneWallet().Lives == lives, "Leaving refunded or charged the reserved life again");
        Need(restored.EnterLevelOne() && restored.Snapshot.turn == 0 && !W.Equal(identity["attemptId"], Metadata(storage)["attemptId"]), "Leaving kept the abandoned attempt");
        Need(restored.ReadPhoneWallet().Lives == lives - 1, "The new attempt did not reserve a life"); identity = Metadata(storage);
        Need(restored.Restart(), "Restart failed"); Need(restored.Snapshot.turn == 0 && !restored.IsPresenting, "Restart left presentation state");
        Need(!W.Equal(identity["attemptId"], Metadata(storage)["attemptId"]), "Restart reused attempt identity");
    }
    private static void FailedTransaction()
    {
        var storage = new MemoryProfileStorage(); var session = New(storage); Need(session.EnterLevelOne(), "Start failed");
        var pair = Pair(Route(storage)[0]); string before = Snap(session); object profile = Profile(storage); long revision = session.Revision;
        storage.FailProfileWrites = true;
        var denied = session.TrySwap(pair[0], pair[1]);
        Need(!denied.Ok && denied.Reason == "storage" && !session.IsPresenting, "Storage failure not surfaced");
        Need(session.Revision == revision && Snap(session) == before, "Failed canonical commit survived rollback"); Same(profile, Profile(storage), "Failed canonical transaction changed game/energy/economy");
        storage.FailProfileWrites = false; Need(session.TrySwap(pair[0], pair[1]).Ok, "Retry after storage recovery failed");
    }
    private static void FailedTerminal()
    {
        var storage = new MemoryProfileStorage(); var session = New(storage); Need(session.EnterLevelOne(), "Start failed");
        var route = Route(storage);
        foreach (var item in route.Take(route.Count - 1)) { var pair = Pair(item); Need(session.TrySwap(pair[0], pair[1]).Ok, "Pre-win route failed"); session.CompletePresentation(); }
        var last = Pair(route[route.Count - 1]); var profile = Profile(storage); string before = Snap(session); long revision = session.Revision;
        storage.FailProfileWrites = true;
        var denied = session.TrySwap(last[0], last[1]);
        Need(!denied.Ok && denied.Reason == "storage", "Winning canonical failure not surfaced");
        Need(session.Status == "playing" && session.Revision == revision && Snap(session) == before, "Uncommitted win leaked to model"); Same(profile, Profile(storage), "Uncommitted win leaked to ledger/save");
        storage.FailProfileWrites = false; Need(session.TrySwap(last[0], last[1]).Ok && session.Status == "won", "Winning retry failed");
        Need(W.List(W.Get(Economy(storage), "claimedLevelIds")).Count == 1, "Winning retry duplicated or lost completion");
    }
    private static void FileStorage()
    {
        string directory = Path.Combine(Path.GetTempPath(), "hexrota-host-cas-" + Guid.NewGuid().ToString("N"));
        try
        {
            var a = new FileProfileStorage(directory); var b = new FileProfileStorage(directory);
            var first = W.Obj("schemaVersion", 2L, "revision", 1L, "game", W.Obj(), "energy", W.Obj());
            Need(a.CompareExchange(ProfileRepository.ProfileKey, 0, first), "Initial atomic create failed");
            string file = Path.Combine(directory, ProfileRepository.ProfileKey + ".json"); string bytes = File.ReadAllText(file);
            Need(!b.CompareExchange(ProfileRepository.ProfileKey, 0, first), "Stale writer accepted"); Need(File.ReadAllText(file) == bytes, "Stale writer altered canonical bytes");
            var next = W.Copy(first); next["revision"] = 2L;
            Directory.CreateDirectory(file + ".pending");
            Throws(() => a.CompareExchange(ProfileRepository.ProfileKey, 1, next), "Simulated atomic-write failure accepted");
            Need(File.ReadAllText(file) == bytes, "Failed atomic write destroyed old profile"); Directory.Delete(file + ".pending");
            Need(b.CompareExchange(ProfileRepository.ProfileKey, 1, next), "Atomic replacement failed"); Need(File.Exists(file + ".previous"), "Previous snapshot not retained");
            File.WriteAllText(file, "{damaged");
            Throws(() => new ProfileRepository(a), "Corrupt profile silently initialized"); Need(File.ReadAllText(file) == "{damaged", "Corrupt evidence overwritten");
            Throws(() => a.Write("../escape", W.Obj()), "Unsafe profile key accepted");
        }
        finally { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
    }
    private static void FileResume()
    {
        string directory = Path.Combine(Path.GetTempPath(), "hexrota-host-resume-" + Guid.NewGuid().ToString("N"));
        try
        {
            var storage = new FileProfileStorage(directory); var session = New(storage); Need(session.EnterLevelOne(), "File attempt failed");
            var pair = Pair(Route(storage)[0]); Need(session.TrySwap(pair[0], pair[1]).Ok, "File move failed");
            string committed = Snap(session); var identity = Metadata(storage); session.Suspend();
            var resumed = New(new FileProfileStorage(directory)); Need(resumed.EnterLevelOne(), "File resume failed"); Need(Snap(resumed) == committed, "File resume changed state"); Same(identity, Metadata(storage), "File resume changed identity");
            var legal = new HexMatch(session.Level, session.Snapshot).LegalMoves()[0]; var durable = Profile(storage);
            var stale = session.TrySwap(legal[0], legal[1]); Need(!stale.Ok && stale.Reason == "stale_profile", "Stale in-memory file writer accepted"); Need(Snap(resumed) == committed, "Stale writer affected resumed game"); Same(durable, Profile(storage), "Stale file session changed durable game/energy");
        }
        finally { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
    }
    private static void Completion()
    {
        var storage = new MemoryProfileStorage(); var session = New(storage); Need(session.EnterLevelOne(), "Start failed");
        foreach (var item in Route(storage)) { var pair = Pair(item); Need(session.TrySwap(pair[0], pair[1]).Ok, "Winning route failed"); session.CompletePresentation(); }
        Need(session.Status == "won", "No terminal win"); var ledger = Economy(storage); var snapshot = Snap(session);
        Need(W.List(W.Get(ledger, "claimedLevelIds")).Count == 1 && W.Integer(W.Get(ledger, "stars")) == 1, "One-time completion grant missing");
        Need(!session.Retry() && session.LastError == "level_completed", "Completed campaign retry reopened rewards");
        Need(!session.Restart() && session.LastError == "level_completed", "Completed campaign restart reopened rewards"); Same(ledger, Economy(storage), "Terminal callbacks duplicated rewards");
        session.ReturnToMenu(); var reloaded = New(storage);
        Need(!reloaded.EnterLevelOne() && reloaded.LastError == "level_completed", "Reload reopened cleared campaign"); Same(ledger, Economy(storage), "Reload duplicated rewards");
        Need(W.Equal(W.Get(W.Get(W.Get(Profile(storage), "game"), "boards"), "2"), WireJsonCodec.Parse(snapshot)), "Saved terminal snapshot lost");
    }
    private static void Loss()
    {
        bool observed = false;
        for (uint seed = 1; seed <= 16 && !observed; seed++)
        {
            var storage = new MemoryProfileStorage(); var session = New(storage, seed); Need(session.EnterLevelOne(), "Loss attempt failed");
            for (int turn = 0; turn < 40 && session.Status == "playing"; turn++)
            {
                var model = new HexMatch(session.Level, session.Snapshot); var moves = model.LegalMoves(); Need(moves.Count > 0, "Core left dead board");
                var pair = moves[(turn * 7 + (int)seed) % moves.Count]; Need(session.TrySwap(pair[0], pair[1]).Ok, "Legal loss-route swap rejected"); session.CompletePresentation();
            }
            if (session.Status != "lost") continue;
            observed = true; Need(session.Snapshot.movesLeft == 0, "Loss before exhausted moves"); var identity = Metadata(storage);
            var lost = Snap(session); Need(!session.TrySwap(0, 1).Ok && Snap(session) == lost, "Terminal loss accepted move");
            Need(session.Retry(), "Loss retry failed"); Need(session.Status == "playing" && session.Snapshot.turn == 0, "Loss retry did not start fresh"); Need(!W.Equal(identity["attemptId"], Metadata(storage)["attemptId"]), "Loss retry reused identity");
            Need(W.List(W.Get(Economy(storage), "claimedLevelIds")).Count == 0, "Loss awarded campaign completion");
        }
        Need(observed, "Deterministic legal-move sample did not produce a loss; add an explicit real-board loss vector");
    }
    // The host compiles Runtime without UNITY_EDITOR or HEXROTA_DEV_TOOLS, exactly like a release player.
    private static void ReleaseHasNoDevelopmentTools()
    {
        var type = typeof(UnityGameSession);
        foreach (var name in new[] { "SetLifeBypass", "SetLifeTestAds", "SetRescueTestAds", "ResetForDevelopmentTest", "LifeTestAds", "RescueTestAds" })
            Need(type.GetMember(name).Length == 0, "Release session still exposes development tool " + name);
        var storage = new MemoryProfileStorage(); var session = New(storage);
        Need(session.BeginLifeProduct(UnityGameSession.DevelopmentLifeProduct) == null && session.LastError == "unknown_product", "Release session granted Test Gold");
        // A Development build may have saved the lives bypass on this device; a release build must drop it.
        var developer = new GameSessionController(data.Catalog, data.Levels, data.TutorialCount, new ProfileRepository(storage), data.LifeConfig, new Clock(), 4303818,
            "hexrota-unity-test", data.RewardRules, economyConfig: data.EconomyConfig, rescueReceiptVerifier: new Hexrota.Rescue.DevelopmentRescueReceiptVerifier(), onboardingInFirstChapter: true);
        Need(W.Equal(W.Get(developer.SetDeveloperBypass(true), "ok"), true), "Could not seed a saved lives bypass");
        Need(W.Equal(New(storage).LifeStatus["developerBypass"], false), "Release session kept a saved lives bypass");
        Need(W.Equal(New(storage).LifeStatus["developerBypass"], false), "Lives bypass came back after reload");
    }
}
