using System;
using System.Collections;
using System.Linq;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace Hexrota.UnityClientTests
{
    /// <summary>
    /// Base of every PlayMode test class. A test fails when an Error, Exception or Assert reaches
    /// the console and the test did not expect it with LogAssert.Expect, including messages logged
    /// after the test body: in the class's own teardown, OnDisable/OnDestroy or a late coroutine.
    /// NUnit runs this teardown after the derived class's teardown, still inside the test's log scope,
    /// so such a message fails the test that caused it instead of the next one.
    /// </summary>
    public abstract class PlayModeTest
    {
        private const int SettleFrames = 2;

        [SetUp]
        public void NeverIgnoreFailingMessages()
        {
            LogAssert.ignoreFailingMessages = false;
        }

        [UnityTearDown]
        public IEnumerator FailOnUnexpectedConsoleErrors()
        {
            for (int i = 0; i < SettleFrames; i++) yield return null;
            LogAssert.NoUnexpectedReceived();
        }
    }

    public sealed class ConsoleErrorPolicyTests : PlayModeTest
    {
        [UnityTest]
        public IEnumerator AnExpectedErrorDoesNotFailTheTest()
        {
            LogAssert.Expect(LogType.Error, "Hexrota console policy: expected error");
            Debug.LogError("Hexrota console policy: expected error");
            yield return null;
        }

        [Test]
        public void EveryPlayModeTestClassUsesTheConsoleErrorPolicy()
        {
            var missing = typeof(PlayModeTest).Assembly.GetTypes()
                .Where(type => type.IsClass && !type.IsAbstract && type.GetMethods(BindingFlags.Public | BindingFlags.Instance)
                    .Any(method => method.GetCustomAttributes(typeof(TestAttribute), true).Any() ||
                                   method.GetCustomAttributes(typeof(UnityTestAttribute), true).Any()))
                .Where(type => !typeof(PlayModeTest).IsAssignableFrom(type))
                .Select(type => type.Name).ToArray();
            Assert.That(missing, Is.Empty, "PlayMode test classes must derive from PlayModeTest.");
        }
    }
}
