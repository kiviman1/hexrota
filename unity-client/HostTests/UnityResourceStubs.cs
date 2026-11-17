// .NET HOST ONLY. These are data-loading seams, not a Unity simulation.
// This folder is outside Assets and is never part of the Unity player.
// No GameObject/input/animation/editor API is stubbed; those need the real Editor.
using System;
using System.IO;
namespace UnityEngine
{
    public sealed class TextAsset { public readonly string text; public TextAsset(string text) { this.text = text; } }
    public static class Resources
    {
        public static string FixtureRoot;
        public static T Load<T>(string path) where T : class
        {
            if (typeof(T) != typeof(TextAsset)) throw new NotSupportedException("Only canonical TextAsset resource loading is available in the .NET host.");
            var file = Path.Combine(FixtureRoot, path + ".json");
            return File.Exists(file) ? new TextAsset(File.ReadAllText(file)) as T : null;
        }
    }
    public static class Application { public static string persistentDataPath; }
}
