using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Hexrota.Application;
using Hexrota.Gameplay;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    // Temporary sounds: tap, match wave, win, lose and booster, all silenced by the
    // "Ses efektleri" setting.
    public sealed class SoundEffectsTests : PlayModeTest
    {
        private Func<UnityGameSession> original;
        private FirstPlayableController game;
        private MemoryProfileStorage storage;
        private ClientGameData data;

        [UnitySetUp] public IEnumerator StartScene()
        {
            original = FirstPlayableController.SessionFactory;
            storage = new MemoryProfileStorage();
            data = ClientGameData.FromResources();
            // Chapter 1 is won outside the scene so chapter 2 can be lost through real swaps.
            var prep = new UnityGameSession(data, storage, new SystemUtcClock());
            Assert.That(prep.EnterLevelOne(), Is.True, prep.LastError);
            foreach (var pair in Route(prep)) { Assert.That(prep.TrySwap(pair[0], pair[1]).Ok, Is.True); prep.CompletePresentation(); }
            Assert.That(prep.Status, Is.EqualTo("won"));
            prep.ReturnToMenu(); prep.Suspend();
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, storage, new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            Assert.That(game.Session.SetPreferences(motion: "reduce"), Is.True);
            yield return null;
        }

        [UnityTearDown] public IEnumerator Finish()
        {
            FirstPlayableController.SessionFactory = original;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        private int[][] Route(UnityGameSession session)
        {
            var attempt = W.Required(W.Required(W.Required(storage.Read(ProfileRepository.ProfileKey), "game"), "attempts"), session.ActiveStage.ToString());
            var level = data.Catalog.ResolveLevelWire(W.Required(attempt, "levelId"), (string)W.Required(attempt, "variantId"), (string)W.Required(attempt, "levelDataVersion"));
            return W.List(level["solution"]).Select(pair => W.List(pair).Select(W.Int32).ToArray()).ToArray();
        }

        private IEnumerator LoseChapterTwo()
        {
            game.BeginStage(game.Session.TutorialCount + 1);
            yield return ChapterEntryWait.Ready(game);
            List<int[]> loss = null;
            var board = new HexMatch(game.Session.Level, game.Session.Snapshot);
            for (uint seed = 1; seed <= 200 && loss == null; seed++)
            {
                var candidate = board.Clone(); var route = new List<int[]>(); uint random = seed;
                while (candidate.Status == "playing")
                {
                    var moves = candidate.LegalMoves();
                    random = unchecked(random * 1664525u + 1013904223u);
                    var pick = moves[(int)(random % (uint)moves.Count)];
                    candidate.Swap(pick[0], pick[1]); route.Add(pick);
                }
                if (candidate.Status == "lost") loss = route;
            }
            Assert.That(loss, Is.Not.Null);
            foreach (var pair in loss)
            {
                game.RequestSwap(pair[0], pair[1]);
                float deadline = Time.realtimeSinceStartup + 12f;
                while (game.Board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            }
            float shown = Time.realtimeSinceStartup + 5f;
            while (game.CurrentScreen != "result" && Time.realtimeSinceStartup < shown) yield return null;
            Assert.That(game.Session.Status, Is.EqualTo("lost"));
            Assert.That(game.CurrentScreen, Is.EqualTo("result"));
        }

        [UnityTest]
        public IEnumerator ALossPlaysItsSoundAndSheetButtonsTap()
        {
            var audio = game.GetComponent<PhoneAudio>();
            Assert.That(game.Session.SetPreferences(sound: true), Is.True);
            yield return LoseChapterTwo();
            Assert.That(audio.LastSound, Is.EqualTo("lose"), "The loss plays its sound once the result opens.");
            game.GetComponentsInChildren<Button>().Single(b => b.name == "Yeniden dene").onClick.Invoke();
            Assert.That(audio.LastSound, Is.EqualTo("click"), "Sheet buttons tap.");
        }

        [UnityTest]
        public IEnumerator TheSoundEffectsSettingSilencesEverySound()
        {
            var audio = game.GetComponent<PhoneAudio>();
            Assert.That(game.Session.SetPreferences(sound: false), Is.True);
            yield return LoseChapterTwo();
            audio.Win(game.Session); audio.Booster(game.Session); audio.Click(game.Session);
            Assert.That(audio.LastSound, Is.Null, "With sound effects off nothing plays.");
            Assert.That(game.Session.SetPreferences(sound: true), Is.True);
            audio.Booster(game.Session);
            Assert.That(audio.LastSound, Is.EqualTo("booster"));
            audio.Win(game.Session);
            Assert.That(audio.LastSound, Is.EqualTo("win"));
        }
    }
}
