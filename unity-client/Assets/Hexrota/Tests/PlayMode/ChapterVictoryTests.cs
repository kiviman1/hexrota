using System;
using System.Collections;
using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;
using W = Hexrota.Contracts.Wire;

namespace Hexrota.UnityClientTests
{
    public sealed class ChapterVictoryTests
    {
        private Func<UnityGameSession> original;
        private FirstPlayableController game;
        private UnityGameSession session;
        private int[] last;

        [UnitySetUp]
        public IEnumerator OpenOneMoveBeforeARealWin()
        {
            original = FirstPlayableController.SessionFactory;
            var data = ClientGameData.FromResources();
            var storage = new MemoryProfileStorage();
            var preparer = new UnityGameSession(data, storage, new SystemUtcClock());
            Assert.That(preparer.EnterLevelOne(), Is.True, preparer.LastError);
            var attempts = W.Required(W.Required(storage.Read(ProfileRepository.ProfileKey), "game"), "attempts");
            var identity = W.Required(attempts, preparer.ActiveStage.ToString());
            var level = data.Catalog.ResolveLevelWire(W.Required(identity, "levelId"),
                (string)W.Required(identity, "variantId"), (string)W.Required(identity, "levelDataVersion"));
            var route = W.List(level["solution"]).Select(pair => W.List(pair).Select(W.Int32).ToArray()).ToArray();
            foreach (var step in route.Take(route.Length - 1))
            {
                Assert.That(preparer.TrySwap(step[0], step[1]).Ok, Is.True, preparer.LastError);
                preparer.CompletePresentation();
            }
            last = route.Last();
            preparer.ReturnToMenu();
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, storage, new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            game = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
            session = game.Session;
        }

        [UnityTearDown]
        public IEnumerator CleanUp()
        {
            FirstPlayableController.SessionFactory = original;
            if (game != null) game.ReturnToMenu();
            yield return null;
        }

        private IEnumerator Win(string motion)
        {
            Assert.That(session.SetPreferences(motion: motion), Is.True);
            game.BeginLevelOne();
            yield return ChapterEntryWait.Ready(game);
            game.RequestSwap(last[0], last[1]);
            Assert.That(session.Status, Is.EqualTo("won"));
            float timeout = Time.realtimeSinceStartup + 12f;
            while (game.CurrentScreen == "playing" && Time.realtimeSinceStartup < timeout) yield return null;
            Assert.That(game.CurrentScreen, Is.EqualTo("celebration"));
            Assert.That(game.Board.IsAnimating || game.Board.InputEnabled, Is.False);
            var counter = game.GetComponentInChildren<CastleHudView>().GetComponentsInChildren<Text>().Single(t => t.name == "Counters");
            Assert.That(counter.text, Does.StartWith(session.Snapshot.score + " / "));
        }

        [UnityTest]
        public IEnumerator LiveWinShowsTavikAfterScoreAndSkipsToTheSameEarnedResult()
        {
            yield return Win("full");
            var victory = UnityEngine.Object.FindAnyObjectByType<ChapterVictoryView>();
            Assert.That(victory.GetComponentInChildren<Text>().text, Is.EqualTo("Başardın!"));
            var tavik = victory.GetComponentInChildren<RawImage>();
            Assert.That(tavik.texture, Is.SameAs(Resources.Load<Texture2D>("CoopArt/celebrate")));
            Assert.That(tavik.uvRect, Is.EqualTo(new Rect(0, 0, 1, 1)));
            var seal = (RectTransform)victory.GetComponentsInChildren<Transform>().Single(t => t.name == "GardenSeal");
            var initialScale = seal.localScale;
            var wallet = session.ReadPhoneWallet();
            string attempt = session.AttemptId;
            yield return new WaitForSecondsRealtime(.45f);
            Assert.That(seal.localScale.x, Is.GreaterThan(initialScale.x));
            ExecuteEvents.Execute(victory.gameObject, new PointerEventData(EventSystem.current), ExecuteEvents.pointerClickHandler);
            Assert.That(victory.gameObject.activeSelf, Is.False);
            Assert.That(game.CurrentScreen, Is.EqualTo("result"));
            Assert.That(session.AttemptId, Is.EqualTo(attempt));
            Assert.That(session.ReadPhoneWallet().Gold, Is.EqualTo(wallet.Gold));
            game.GetComponentsInChildren<Button>().Single(b => b.name == "Tahtayı incele").onClick.Invoke();
            game.GetComponentsInChildren<Button>().Single(b => b.name == "Sonucu göster").onClick.Invoke();
            Assert.That(game.CurrentScreen, Is.EqualTo("result"));
            Assert.That(victory.gameObject.activeSelf, Is.False);
            Assert.That(session.ReadPhoneWallet().Stars, Is.EqualTo(wallet.Stars));
        }

        [UnityTest]
        public IEnumerator BackgroundDuringReducedMotionKeepsTheWinAndReleasesTheOverlay()
        {
            yield return Win("reduce");
            var victory = UnityEngine.Object.FindAnyObjectByType<ChapterVictoryView>();
            var bird = (RectTransform)victory.GetComponentInChildren<RawImage>().transform;
            Vector2 position = bird.anchoredPosition;
            yield return new WaitForSecondsRealtime(.16f);
            Assert.That(bird.anchoredPosition, Is.EqualTo(position));
            Assert.That(victory.GetComponent<CanvasGroup>().alpha, Is.EqualTo(1f));
            var wallet = session.ReadPhoneWallet();
            game.OnWebVisibilityChanged("hidden");
            Assert.That(game.CurrentScreen, Is.EqualTo("result"));
            Assert.That(victory.gameObject.activeSelf, Is.False);
            Assert.That(session.ReadPhoneWallet().Gold, Is.EqualTo(wallet.Gold));
            game.ReturnToMenu();
            yield return new WaitForSecondsRealtime(1.1f);
            Assert.That(game.CurrentScreen, Is.EqualTo("menu"));
        }
    }
}
