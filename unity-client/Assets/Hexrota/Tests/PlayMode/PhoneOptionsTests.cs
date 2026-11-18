using System.Collections;
using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace Hexrota.UnityClientTests
{
    public sealed class PhoneOptionsTests
    {
        [UnityTest]
        public IEnumerator BoardSettingsPersistAndTestCreditRequiresConfirmation()
        {
            var original = FirstPlayableController.SessionFactory;
            var storage = new MemoryProfileStorage();
            try
            {
                FirstPlayableController.SessionFactory = () =>
                    new UnityGameSession(ClientGameData.FromResources(), storage, new SystemUtcClock());
                yield return SceneManager.LoadSceneAsync("FirstPlayable");
                var game = Object.FindAnyObjectByType<FirstPlayableController>();
                game.BeginLevelOne();
                yield return null;
                var initial = game.Session.Snapshot;
                var sound = game.Session.SoundEnabled;
                game.OpenMobileSettings();
                Assert.That(game.Board.InputEnabled, Is.False);
                Press(game, "Efektler");
                Assert.That(game.Session.SoundEnabled, Is.EqualTo(!sound));
                game.GetComponentsInChildren<Slider>().Single().value = 6;
                Assert.That(game.Session.Volume, Is.EqualTo(.3f).Within(.0001f));
                int gold = game.Session.TestGold;
                Press(game, "300 Test Altını ekle");
                Assert.That(game.CurrentScreen, Is.EqualTo("provider"));
                Press(game, "Vazgeç");
                Assert.That(game.Session.TestGold, Is.EqualTo(gold));
                Press(game, "300 Test Altını ekle");
                Press(game, "Tamamla");
                Assert.That(game.Session.TestGold, Is.EqualTo(gold + 300));
                Press(game, "Kapat");
                Assert.That(game.CurrentScreen, Is.EqualTo("playing"));
                Assert.That(game.Board.InputEnabled, Is.True);
                Assert.That(game.Session.Snapshot.values, Is.EqualTo(initial.values));
                Assert.That(game.Session.Snapshot.turn, Is.EqualTo(initial.turn));
                game.OpenMobileLives();
                Assert.That(game.CurrentScreen, Is.EqualTo("lives"));
                Press(game, "Bekle");
                Assert.That(game.Board.InputEnabled, Is.True);
                game.ReturnToMenu();
                yield return SceneManager.LoadSceneAsync("FirstPlayable");
                var restored = Object.FindAnyObjectByType<FirstPlayableController>().Session;
                Assert.That(restored.SoundEnabled, Is.EqualTo(!sound));
                Assert.That(restored.Volume, Is.EqualTo(.3f).Within(.0001f));
                Assert.That(restored.TestGold, Is.EqualTo(gold + 300));
                game = Object.FindAnyObjectByType<FirstPlayableController>();
                game.OpenMobileSettings();
                Press(game, "Test için her şeyi sıfırla");
                Press(game, "Vazgeç");
                Assert.That(game.Session.TestGold, Is.EqualTo(gold + 300));
                Press(game, "Test için her şeyi sıfırla");
                Press(game, "Evet, her şeyi sıfırla");
                Assert.That(game.CurrentScreen, Is.EqualTo("menu"));
                Assert.That(game.Session.FirstOpening, Is.True);
                yield return SceneManager.LoadSceneAsync("FirstPlayable");
                restored = Object.FindAnyObjectByType<FirstPlayableController>().Session;
                Assert.That(restored.FirstOpening, Is.True);
                Assert.That(restored.TestGold, Is.EqualTo(gold));
                Assert.That(restored.SoundEnabled, Is.EqualTo(sound));
                LogAssert.NoUnexpectedReceived();
            }
            finally { FirstPlayableController.SessionFactory = original; }
        }

        private static void Press(FirstPlayableController game, string name)
        {
            var button = game.GetComponentsInChildren<Button>().Single(b => b.name == name);
            Assert.That(button.interactable, Is.True, name);
            button.onClick.Invoke();
        }
    }
}
