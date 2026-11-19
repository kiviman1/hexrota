using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using Hexrota.Application;
using UnityEngine;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClient
{
    public static class PlatformProfileStorage
    {
        public static IProfileStorage Create()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            return new WebProfileStorage();
#else
            return new FileProfileStorage(Path.Combine(UnityEngine.Application.persistentDataPath, "hexrota-unity-9.11"));
#endif
        }
    }
    // Scoped path keeps the prototype and the native foundation independent.
    // One canonical profile contains both gameplay and energy, as required by ProfileRepository.
    // Atomic rename protects against process termination; there is no delete-then-write window.
    public sealed class FileProfileStorage : IProfileStorage
    {
        private readonly string root;
        private static readonly object Gate = new object();
        public FileProfileStorage(string root) { this.root = root; Directory.CreateDirectory(root); }
        private string PathFor(string key)
        {
            if (string.IsNullOrEmpty(key) || key.IndexOfAny(new[] { '/', '\\', '.' }) >= 0) throw new ArgumentException("Invalid storage key");
            return Path.Combine(root, key + ".json");
        }
        public bool Contains(string key) { lock (Gate) return File.Exists(PathFor(key)); }
        public object Read(string key)
        {
            lock (Gate) {
                var path = PathFor(key);
                // Preserve corrupt files and fail closed; never convert a corrupt profile into a fresh save.
                return File.Exists(path) ? WireJsonCodec.Parse(File.ReadAllText(path, Encoding.UTF8)) : null;
            }
        }
        public void Write(string key, object value) { WriteAtomic(key,value,true); }

        internal void WriteObservation(string key, object value) { WriteAtomic(key,value,false); }

        private void WriteAtomic(string key, object value, bool retainPrevious)
        {
            lock (Gate) {
                var path = PathFor(key); var temporary = path + ".pending";
                try {
                    var bytes = Encoding.UTF8.GetBytes(WireJsonCodec.Serialize(value));
                    using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None)) { stream.Write(bytes, 0, bytes.Length); stream.Flush(true); }
                    if (File.Exists(path)) File.Replace(temporary, path, retainPrevious ? path + ".previous" : null);
                    else File.Move(temporary, path);
                }
                catch (Exception) { throw new ProfileStorageException("storage"); }
            }
        }
        public bool CompareExchange(string key, long expectedRevision, Dictionary<string, object> next)
        {
            lock (Gate) {
                var previous = Read(key); long actual = 0;
                if (Contains(key)) { GameProfile.ValidateEnvelope(previous); actual = W.Integer(W.Get(previous, "revision")); }
                if (actual != expectedRevision) return false;
                GameProfile.ValidateEnvelope(next);
                if (W.Integer(W.Get(next, "revision")) != expectedRevision + 1) throw new ProfileStorageException("invalid_profile");
                Write(key, next); return true;
            }
        }
    }
#if UNITY_WEBGL && !UNITY_EDITOR
    // The HTML template obtains an exclusive Web Lock BEFORE loading Unity.
    // Synchronous localStorage commits finish before core transaction acknowledgements.
    public sealed class WebProfileStorage : IProfileStorage
    {
        [DllImport("__Internal")] private static extern int HexrotaStorageContains(string key);
        [DllImport("__Internal")] private static extern IntPtr HexrotaStorageRead(string key);
        [DllImport("__Internal")] private static extern int HexrotaStorageWrite(string key, string json);
        [DllImport("__Internal")] private static extern int HexrotaStorageCas(string key, double revision, string json);
        public bool Contains(string key) { int result = HexrotaStorageContains(key); if (result < 0) throw new ProfileStorageException("storage"); return result == 1; }
        public object Read(string key)
        {
            IntPtr pointer = HexrotaStorageRead(key);
            if (pointer == IntPtr.Zero) throw new ProfileStorageException("storage");
            string json;
            try { json = Marshal.PtrToStringAnsi(pointer); }
            finally { Marshal.FreeHGlobal(pointer); }
            return json == "" ? null : WireJsonCodec.Parse(json);
        }
        public void Write(string key, object value) { if (HexrotaStorageWrite(key, WireJsonCodec.Serialize(value)) != 1) throw new ProfileStorageException("storage"); }
        public bool CompareExchange(string key, long expectedRevision, Dictionary<string, object> next)
        {
            GameProfile.ValidateEnvelope(next);
            if (W.Integer(W.Get(next, "revision")) != expectedRevision + 1) throw new ProfileStorageException("invalid_profile");
            int result = HexrotaStorageCas(key, expectedRevision, WireJsonCodec.Serialize(next));
            if (result < 0) throw new ProfileStorageException("storage");
            return result == 1;
        }
    }
#endif
}
