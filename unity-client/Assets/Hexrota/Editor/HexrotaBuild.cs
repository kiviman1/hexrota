#if UNITY_EDITOR
using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Hexrota.Client.Editor
{
    public static class HexrotaBuild
    {
        [MenuItem("Hexrota/Build WebGL")]
        public static void BuildWeb()
        {
            string projectRoot = Path.GetDirectoryName(Application.dataPath);
            string output = Path.Combine(projectRoot, "Builds", "WebGL");
            Directory.CreateDirectory(output);
            var options = new BuildPlayerOptions {
                scenes = new[] { "Assets/Scenes/Hexrota.unity" },
                locationPathName = output,
                target = BuildTarget.WebGL,
                options = BuildOptions.None
            };
            BuildReport report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result != BuildResult.Succeeded)
                throw new InvalidOperationException("Hexrota WebGL build failed: " + report.summary.result);
            Debug.Log("Hexrota WebGL build: " + output);
        }
    }
}
#endif
