using System.Collections;
using System.Linq;
using Hexrota.Application;
using Hexrota.UnityClient;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.EventSystems;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace Hexrota.UnityClientTests
{
    public sealed class PhoneGameplayTests
    {
        [UnityTest]
        public IEnumerator SkipButtonOpensNumberedBoardAndFooterCanPauseAndResume()
        {
            var initial = FirstPlayableController.SessionFactory;
            var storage = new MemoryProfileStorage();
            try
            {
                FirstPlayableController.SessionFactory = () => new UnityGameSession(ClientGameData.FromResources(), storage, new SystemUtcClock());
                yield return SceneManager.LoadSceneAsync("FirstPlayable");
                var game = Object.FindAnyObjectByType<FirstPlayableController>();
                game.BeginJourney();
                yield return null;
                var dock = game.GetComponentsInChildren<Button>().Where(b => b.transform.parent.name == "Footer");
                Assert.That(dock.Select(b => b.name), Is.EqualTo(new[]{"Menü","Mola"}));
                Assert.That(game.GetComponentsInChildren<RawImage>().Single(i => i.name == "Face").texture, Is.Not.Null);
                game.GetComponentsInChildren<Button>().Single(b => b.name == "Geç").onClick.Invoke();
                yield return null;
                Assert.That(game.CurrentScreen, Is.EqualTo("playing"));
                Assert.That(game.GetComponentsInChildren<Transform>().Any(t => t.name == "Coach"), Is.False);
                var labels = game.GetComponentsInChildren<Text>();
                Assert.That(labels.Single(t => t.name == "LevelTitle").text, Is.EqualTo(game.Session.StageName(game.Session.ActiveStage)));
                Assert.That(labels.Single(t => t.name == "Moves").text, Is.EqualTo(game.Session.Snapshot.movesLeft.ToString()));
                dock = game.GetComponentsInChildren<Button>().Where(b => b.transform.parent.name == "Footer");
                Assert.That(dock.Select(b => b.name), Is.EqualTo(new[]{"Menü","Yeniden","Çanta","Mola","Ayarlar"}));
                foreach (var value in Enumerable.Range(0,game.Session.Level.cells.Length))
                {
                    Vector2 projected = game.Board.ViewportCell(value);
                    Assert.That(projected.x, Is.InRange(0f,1f));
                    Assert.That(projected.y, Is.InRange(0f,1f));
                    Assert.That(GameObject.Find("Value_"+value).GetComponent<TextMesh>().text,
                        Is.EqualTo(game.Session.Snapshot.values[value].ToString()));
                }
                long revision = game.Session.Revision;
                float deadline = Time.realtimeSinceStartup + 12;
                while (!game.Board.ShowingIdleHint && Time.realtimeSinceStartup < deadline) yield return null;
                Assert.That(game.Board.ShowingIdleHint,Is.True,"An untouched numbered board cues its first visible match after 10 seconds.");
                Assert.That(game.Session.Revision,Is.EqualTo(revision),"The passive cue must not transact or spend.");
                game.Board.OnPointerDown(new PointerEventData(EventSystem.current) { pointerId=1, position=Vector2.zero });
                Assert.That(game.Board.ShowingIdleHint,Is.False);
                game.Board.OnCancel(null);
                dock.Single(b => b.name == "Mola").onClick.Invoke();
                Assert.That(game.CurrentScreen, Is.EqualTo("paused"));
                game.Resume();
                Assert.That(game.Board.InputEnabled, Is.True);
                game.ReturnToMenu();
                LogAssert.NoUnexpectedReceived();
            }
            finally { FirstPlayableController.SessionFactory = initial; }
        }
    }
}
