using System;
using System.Collections.Generic;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.Application
{
    // The platform implements one atomic compare/exchange. No platform file API
    // or device service is referenced by the application core.
    public interface IProfileStorage
    {
        bool Contains(string key);
        object Read(string key);
        bool CompareExchange(string key, long expectedRevision, Dictionary<string, object> next);
        void Write(string key, object value);
    }
    public sealed class ProfileStorageException : InvalidOperationException
    {
        public string Code { get; private set; }
        public ProfileStorageException(string code) : base(code) { Code = code; }
    }
    public sealed class GameProfile
    {
        private readonly Dictionary<string, object> data;
        public GameProfile(Dictionary<string, object> value) { ValidateEnvelope(value); data = W.Copy(value); }
        public long Revision { get { return W.Integer(W.Get(data, "revision"), 0); } }
        public Dictionary<string, object> Game { get { return W.Copy(W.Get(data, "game")); } }
        public Dictionary<string, object> Energy { get { return W.Copy(W.Get(data, "energy")); } }
        public Dictionary<string, object> ToWire() { return W.Copy(data); }
        public static void ValidateEnvelope(object raw, bool migrationBaseline = false)
        {
            if (!W.IsMap(raw) || !W.Equal(W.Get(raw, "schemaVersion"), 2L) || !W.IsSafeInteger(W.Get(raw, "revision")) || W.Integer(W.Get(raw, "revision")) < (migrationBaseline ? 0 : 1) || !W.IsMap(W.Get(raw, "game")) || !W.IsMap(W.Get(raw, "energy"))) throw new ProfileStorageException("invalid_profile");
        }
    }
    public sealed class ProfileRepository
    {
        public const string ProfileKey = "hexrota-profile-v2", GameKey = "hexrota-match-v5", LifeKey = "hexrota-lives-v1", EventKey = "hexrota-events-v1";
        private readonly IProfileStorage storage;
        private Dictionary<string, object> durable;
        private long revision;
        private bool writable;
        public ProfileRepository(IProfileStorage storage, bool writable = true)
        {
            if (storage == null) throw new ArgumentNullException("storage");
            this.storage = storage; this.writable = writable;
            object raw = storage.Read(ProfileKey);
            if (storage.Contains(ProfileKey)) { GameProfile.ValidateEnvelope(raw); durable = W.Copy(raw); revision = W.Integer(W.Get(raw, "revision"), 1); }
            else
            {
                object game = storage.Read(GameKey), energy = storage.Read(LifeKey);
                if (game != null && energy != null) durable = W.Obj("schemaVersion", 2L, "revision", 0L, "game", W.Clone(game), "energy", W.Clone(energy));
            }
        }
        public long Revision { get { return revision; } }
        public Dictionary<string, object> Current() { return durable == null ? null : W.Copy(durable); }
        public bool Contains(string key) { return durable != null && (key == GameKey || key == LifeKey) || storage.Contains(key); }
        public object Read(string key)
        {
            if (durable != null && key == GameKey) return W.Clone(W.Get(durable, "game"));
            if (durable != null && key == LifeKey) return W.Clone(W.Get(durable, "energy"));
            return W.Clone(storage.Read(key));
        }
        public Dictionary<string, object> Commit(Dictionary<string, object> game, Dictionary<string, object> energy)
        {
            if (!writable) throw new ProfileStorageException("read_only");
            if (revision >= W.MaxSafeInteger) throw new ProfileStorageException("revision_exhausted");
            var next = W.Obj("schemaVersion", 2L, "revision", revision + 1L, "game", W.Copy(game), "energy", W.Copy(energy));
            if (!storage.CompareExchange(ProfileKey, revision, next)) throw new ProfileStorageException("stale_profile");
            revision++; durable = next;
            // The canonical write has already succeeded. Repairable mirror or
            // analytics failures must not undo a life settlement or game result.
            try { storage.Write(GameKey, game); } catch { }
            try { storage.Write(LifeKey, energy); } catch { }
            return Current();
        }
        public void SaveEvents(Dictionary<string, object> events) { try { storage.Write(EventKey, events); } catch { } }
        public void Revoke() { writable = false; }
    }
    // A reusable test/in-memory adapter. Native atomic-file or database adapters
    // implement the same CAS contract; this class never creates a native format.
    public sealed class MemoryProfileStorage : IProfileStorage
    {
        private readonly Dictionary<string, object> values = new Dictionary<string, object>(StringComparer.Ordinal);
        private readonly object gate = new object();
        public bool FailProfileWrites, FailMirrorWrites, FailEventWrites;
        public void Seed(string key, object value) { lock (gate) { if (value == null) values.Remove(key); else values[key] = W.Clone(value); } }
        public bool Contains(string key) { lock (gate) { return values.ContainsKey(key); } }
        public void SeedPresent(string key, object value) { lock (gate) { values[key] = W.Clone(value); } }
        public object Read(string key) { lock (gate) { object value; return values.TryGetValue(key, out value) ? W.Clone(value) : null; } }
        public void Write(string key, object value)
        {
            lock (gate)
            {
                if (key == ProfileRepository.ProfileKey && FailProfileWrites || (key == ProfileRepository.GameKey || key == ProfileRepository.LifeKey) && FailMirrorWrites || key == ProfileRepository.EventKey && FailEventWrites) throw new ProfileStorageException("storage");
                values[key] = W.Clone(value);
            }
        }
        public bool CompareExchange(string key, long expectedRevision, Dictionary<string, object> next)
        {
            lock (gate)
            {
                object previous; long actual = 0;
                if (values.TryGetValue(key, out previous)) { GameProfile.ValidateEnvelope(previous); actual = W.Integer(W.Get(previous, "revision"), 1); }
                if (actual != expectedRevision) return false;
                if (FailProfileWrites) throw new ProfileStorageException("storage");
                GameProfile.ValidateEnvelope(next); if (W.Integer(W.Get(next, "revision")) != expectedRevision + 1L) throw new ProfileStorageException("invalid_profile");
                values[key] = W.Copy(next); return true;
            }
        }
    }
}
