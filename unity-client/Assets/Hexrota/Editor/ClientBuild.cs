using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Hexrota.UnityClient.Editor
{
    // No build-generated scene: this builds the same serialized scene opened in Hub.
    public static class ClientBuild
    {
        public const string RequiredVersion = "6000.6.9f1";
        public const string ScenePath = "Assets/Hexrota/Scenes/FirstPlayable.unity";

        /// <summary>
        /// Compiles the development tools (lives bypass, test ad toggles, Test Gold, full reset,
        /// TEST win and coop shortcuts). The Editor always has them (UNITY_EDITOR); a player has them
        /// only when its build profile adds this define. Release and playtest players never do.
        /// </summary>
        public const string DevToolsDefine = "HEXROTA_DEV_TOOLS";
        /// <summary>Playtest players record the local playtest log from the first launch (export stays in Settings).</summary>
        public const string PlaytestDefine = "HEXROTA_PLAYTEST";

        /// <summary>The player build profiles and what each compiles.</summary>
        public enum Profile
        {
            /// <summary>Development player with the development tools: for the team.</summary>
            Development,
            /// <summary>Player for human playtests: no development tools or "TEST: KAZAN", no Development watermark;
            /// the local event log is on and can be exported from Settings.</summary>
            Playtest
        }

        public static BuildOptions Options(Profile profile) =>
            profile == Profile.Development ? BuildOptions.Development | BuildOptions.StrictMode : BuildOptions.StrictMode;

        public static string[] Defines(Profile profile) =>
            profile == Profile.Development ? new[] { DevToolsDefine } : new[] { PlaytestDefine };

        [MenuItem("Hexrota/Build Android Development Player")]
        public static void BuildAndroid()
        {
            BuildNative(BuildTarget.Android, NamedBuildTarget.Android, "Builds/Android/Hexrota.apk", Profile.Development);
        }

        [MenuItem("Hexrota/Build Android Playtest Player")]
        public static void BuildAndroidPlaytest()
        {
            // Batch builds may name the APK: -hexrotaApk Builds/Android/Hexrota-playtest-hafta3.apk
            var args = Environment.GetCommandLineArgs();
            int at = Array.IndexOf(args, "-hexrotaApk");
            string output = at >= 0 && at + 1 < args.Length ? args[at + 1] : "Builds/Android/Hexrota-playtest.apk";
            BuildNative(BuildTarget.Android, NamedBuildTarget.Android, output, Profile.Playtest);
        }

        [MenuItem("Hexrota/Export iOS Development Project")]
        public static void BuildIOS()
        {
            BuildNative(BuildTarget.iOS, NamedBuildTarget.iOS, "Builds/iOS", Profile.Development);
        }

        private static void BuildNative(BuildTarget target, NamedBuildTarget namedTarget, string output, Profile profile)
        {
            if (UnityEngine.Application.unityVersion != RequiredVersion)
                throw new BuildFailedException("Install exact Unity " + RequiredVersion);
            if (!BuildPipeline.IsBuildTargetSupported(BuildPipeline.GetBuildTargetGroup(target), target))
                throw new BuildFailedException("Install " + target + " Build Support for " + RequiredVersion);
            var scenes = EditorBuildSettings.scenes.Where(x => x.enabled).Select(x => x.path).ToArray();
            if (scenes.Length != 1 || scenes[0] != ScenePath || !File.Exists(ScenePath))
                throw new BuildFailedException("Build must contain the checked-in FirstPlayable scene only.");
            PlayerSettings.SetScriptingBackend(namedTarget, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetApiCompatibilityLevel(namedTarget, ApiCompatibilityLevel.NET_Standard);
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = scenes, locationPathName = output, target = target,
                options = Options(profile), extraScriptingDefines = Defines(profile)
            });
            if (report.summary.result != BuildResult.Succeeded)
                throw new BuildFailedException(target + " build result: " + report.summary.result);
        }

        [MenuItem("Hexrota/Build Web Preview")]
        public static void BuildWeb()
        {
            if (UnityEngine.Application.unityVersion != RequiredVersion)
                throw new BuildFailedException("Expected Unity " + RequiredVersion + "; found " + UnityEngine.Application.unityVersion);
            if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.WebGL, BuildTarget.WebGL))
                throw new BuildFailedException("Install Web Build Support for " + RequiredVersion);
            var scenes = EditorBuildSettings.scenes.Where(x => x.enabled).Select(x => x.path).ToArray();
            if (scenes.Length != 1 || scenes[0] != ScenePath || !File.Exists(ScenePath))
                throw new BuildFailedException("Build must contain the checked-in FirstPlayable scene only.");
            PlayerSettings.WebGL.template = "PROJECT:HexrotaMobile";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.dataCaching = false;
            PlayerSettings.WebGL.threadsSupport = false;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.WebGL, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetApiCompatibilityLevel(NamedBuildTarget.WebGL, ApiCompatibilityLevel.NET_Standard);
            var output = Environment.GetEnvironmentVariable("HEXROTA_WEB_OUTPUT") ?? "Builds/WebGL";
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = scenes, locationPathName = output, target = BuildTarget.WebGL,
                // The web preview is a public playable build: no development tools.
                options = BuildOptions.StrictMode, extraScriptingDefines = new string[0]
            });
            if (report.summary.result != BuildResult.Succeeded)
                throw new BuildFailedException("Unity build result: " + report.summary.result);
            File.WriteAllText(Path.Combine(output, "hexrota-unity-build.json"),
                "{\"schemaVersion\":1,\"unityVersion\":\"" + UnityEngine.Application.unityVersion +
                "\",\"scene\":\"" + ScenePath + "\",\"target\":\"WebGL\",\"commit\":\"" +
                (Environment.GetEnvironmentVariable("GITHUB_SHA") ?? "local") + "\"}\n");
            File.Copy("WebPreview/vercel.json", Path.Combine(output, "vercel.json"), true);
            Debug.Log("HEXROTA_WEB_BUILD_SUCCEEDED " + report.summary.totalSize + " bytes; " + output);
        }
    }
}
