using System;
using System.IO;
using System.Text;
using Hexrota.UnityClient.Editor;
using NUnit.Framework;
using UnityEditor;
using UnityEditor.Build.Player;

namespace Hexrota.UnityClientTests
{
    // Compiles the player scripts the way each build profile does and checks that the development
    // tools are compiled in only when the profile adds HEXROTA_DEV_TOOLS. DEVELOPMENT_BUILD alone no
    // longer turns them on, so a playtest or profiling Development player stays clean.
    public sealed class DevelopmentToolsReleaseTests
    {
        private const string Runtime = "Hexrota.UnityClient.Runtime.dll";
        private const string Presentation = "Hexrota.UnityClient.Presentation.dll";

        // Member names live in the metadata string heap (UTF-8); visible labels in the user-string heap (UTF-16).
        private static readonly string[] RuntimeMembers = { "SetLifeBypass", "SetLifeTestAds", "SetRescueTestAds", "ResetForDevelopmentTest", "get_LifeTestAds", "get_RescueTestAds" };
        private static readonly string[] PresentationMembers = { "DrawDeveloperSettings", "ConfirmFullReset" };
        private static readonly string[] PresentationLabels = { "Can sınırını kapat", "Test reklamı kullanılabilir", "300 Test Altını ekle", "Test için her şeyi sıfırla" };

        private sealed class Player
        {
            public byte[] Runtime, Presentation;
        }

        private static Player release, playtest, developmentWithoutFlag, development;

        private static Player Compile(ScriptCompilationOptions options, string[] defines)
        {
            string output = Path.Combine(Path.GetTempPath(), "hexrota-player-scripts-" + Guid.NewGuid().ToString("N"));
            try
            {
                var target = EditorUserBuildSettings.activeBuildTarget;
                var settings = new ScriptCompilationSettings
                {
                    target = target,
                    group = BuildPipeline.GetBuildTargetGroup(target),
                    options = options,
                    extraScriptingDefines = defines
                };
                var result = PlayerBuildInterface.CompilePlayerScripts(settings, output);
                Assert.That(result.assemblies, Does.Contain(Runtime).And.Contain(Presentation),
                    "Player script compilation did not produce the game assemblies.");
                return new Player
                {
                    Runtime = File.ReadAllBytes(Path.Combine(output, Runtime)),
                    Presentation = File.ReadAllBytes(Path.Combine(output, Presentation))
                };
            }
            finally
            {
                if (Directory.Exists(output)) Directory.Delete(output, true);
            }
        }

        private static ScriptCompilationOptions ScriptOptions(BuildOptions options) =>
            (options & BuildOptions.Development) != 0 ? ScriptCompilationOptions.DevelopmentBuild : ScriptCompilationOptions.None;

        [OneTimeSetUp]
        public void CompilePlayers()
        {
            release = Compile(ScriptCompilationOptions.None, new string[0]);
            playtest = Compile(ScriptOptions(ClientBuild.Options(ClientBuild.Profile.Playtest)), ClientBuild.Defines(ClientBuild.Profile.Playtest));
            developmentWithoutFlag = Compile(ScriptCompilationOptions.DevelopmentBuild, new string[0]);
            development = Compile(ScriptOptions(ClientBuild.Options(ClientBuild.Profile.Development)), ClientBuild.Defines(ClientBuild.Profile.Development));
        }

        [Test]
        public void TheDevelopmentProfileAddsTheFlagAndThePlaytestProfileDoesNot()
        {
            CollectionAssert.AreEqual(new[] { "HEXROTA_DEV_TOOLS" }, ClientBuild.Defines(ClientBuild.Profile.Development));
            Assert.That(ClientBuild.Defines(ClientBuild.Profile.Playtest), Is.Empty);
            Assert.That(ClientBuild.Options(ClientBuild.Profile.Development) & BuildOptions.Development, Is.Not.EqualTo(BuildOptions.None));
        }

        [Test]
        public void ReleaseRuntimeHasNoDevelopmentSessionTools() { AssertRuntime(release, false, "release"); }

        [Test]
        public void ReleaseSettingsHaveNoDevelopmentControls() { AssertPresentation(release, false, "release"); }

        [Test]
        public void PlaytestPlayerHasNoDevelopmentTools()
        {
            AssertRuntime(playtest, false, "playtest");
            AssertPresentation(playtest, false, "playtest");
        }

        [Test]
        public void DevelopmentBuildAloneNoLongerCompilesTheTools()
        {
            AssertRuntime(developmentWithoutFlag, false, "Development build without HEXROTA_DEV_TOOLS");
            AssertPresentation(developmentWithoutFlag, false, "Development build without HEXROTA_DEV_TOOLS");
        }

        [Test]
        public void DevelopmentProfileCompilesTheTools()
        {
            // Positive control: the same search finds every tool once the flag is set.
            AssertRuntime(development, true, "development profile");
            AssertPresentation(development, true, "development profile");
        }

        private static void AssertRuntime(Player player, bool expected, string profile)
        {
            Assert.That(Has(player.Runtime, "ResetOpenAttempts", Encoding.UTF8), Is.True, "Control: a normal session member must be found.");
            foreach (var name in RuntimeMembers)
                Assert.That(Has(player.Runtime, name, Encoding.UTF8), Is.EqualTo(expected), name + " in the " + profile + " Runtime assembly.");
        }

        private static void AssertPresentation(Player player, bool expected, string profile)
        {
            Assert.That(Has(player.Presentation, "OpenMobileSettings", Encoding.UTF8), Is.True, "Control: a normal settings member must be found.");
            Assert.That(Has(player.Presentation, "İlerlemeyi sıfırla", Encoding.Unicode), Is.True, "Control: a normal settings label must be found.");
            foreach (var name in PresentationMembers)
                Assert.That(Has(player.Presentation, name, Encoding.UTF8), Is.EqualTo(expected), name + " in the " + profile + " Presentation assembly.");
            foreach (var label in PresentationLabels)
                Assert.That(Has(player.Presentation, label, Encoding.Unicode), Is.EqualTo(expected), "\"" + label + "\" in " + profile + " Settings.");
        }

        private static bool Has(byte[] haystack, string text, Encoding encoding)
        {
            var needle = encoding.GetBytes(text);
            for (int i = 0; i + needle.Length <= haystack.Length; i++)
            {
                int j = 0;
                while (j < needle.Length && haystack[i + j] == needle[j]) j++;
                if (j == needle.Length) return true;
            }
            return false;
        }
    }
}
