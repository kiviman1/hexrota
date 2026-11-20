using System;
using System.IO;
using System.Text;
using NUnit.Framework;
using UnityEditor;
using UnityEditor.Build.Player;

namespace Hexrota.UnityClientTests
{
    // Compiles the player scripts exactly as a release (non-Development) build does and checks that
    // the development tools from Settings are not in the shipped assemblies at all.
    public sealed class DevelopmentToolsReleaseTests
    {
        private const string Runtime = "Hexrota.UnityClient.Runtime.dll";
        private const string Presentation = "Hexrota.UnityClient.Presentation.dll";

        // Member names live in the metadata string heap (UTF-8); visible labels in the user-string heap (UTF-16).
        private static readonly string[] RuntimeMembers = { "SetLifeBypass", "SetLifeTestAds", "SetRescueTestAds", "ResetForDevelopmentTest", "get_LifeTestAds", "get_RescueTestAds" };
        private static readonly string[] PresentationMembers = { "DrawDeveloperSettings", "ConfirmFullReset" };
        private static readonly string[] PresentationLabels = { "Can sınırını kapat", "Test reklamı kullanılabilir", "300 Test Altını ekle", "Test için her şeyi sıfırla" };

        private static string output;

        [OneTimeSetUp]
        public void CompileReleasePlayerScripts()
        {
            output = Path.Combine(Path.GetTempPath(), "hexrota-release-scripts-" + Guid.NewGuid().ToString("N"));
            var target = EditorUserBuildSettings.activeBuildTarget;
            var settings = new ScriptCompilationSettings
            {
                target = target,
                group = BuildPipeline.GetBuildTargetGroup(target),
                options = ScriptCompilationOptions.None // no DevelopmentBuild flag: DEVELOPMENT_BUILD is undefined
            };
            var result = PlayerBuildInterface.CompilePlayerScripts(settings, output);
            Assert.That(result.assemblies, Does.Contain(Runtime).And.Contain(Presentation),
                "Release player script compilation did not produce the game assemblies.");
        }

        [OneTimeTearDown]
        public void Clean()
        {
            if (output != null && Directory.Exists(output)) Directory.Delete(output, true);
        }

        [Test]
        public void ReleaseRuntimeHasNoDevelopmentSessionTools()
        {
            var bytes = File.ReadAllBytes(Path.Combine(output, Runtime));
            Assert.That(Has(bytes, "ResetOpenAttempts", Encoding.UTF8), Is.True, "Control: a normal session member must be found.");
            foreach (var name in RuntimeMembers)
                Assert.That(Has(bytes, name, Encoding.UTF8), Is.False, name + " is compiled into the release Runtime assembly.");
        }

        [Test]
        public void ReleaseSettingsHaveNoDevelopmentControls()
        {
            var bytes = File.ReadAllBytes(Path.Combine(output, Presentation));
            Assert.That(Has(bytes, "OpenMobileSettings", Encoding.UTF8), Is.True, "Control: a normal settings member must be found.");
            Assert.That(Has(bytes, "İlerlemeyi sıfırla", Encoding.Unicode), Is.True, "Control: a normal settings label must be found.");
            foreach (var name in PresentationMembers)
                Assert.That(Has(bytes, name, Encoding.UTF8), Is.False, name + " is compiled into the release Presentation assembly.");
            foreach (var label in PresentationLabels)
                Assert.That(Has(bytes, label, Encoding.Unicode), Is.False, "\"" + label + "\" is shown in release Settings.");
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
