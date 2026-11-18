using System;
using System.Collections;
using System.Linq;
using Hexrota.Application;
using Hexrota.Gameplay;
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
    public sealed class InventoryFlowTests
    {
        private Func<UnityGameSession> originalFactory;
        private FirstPlayableController view;
        private ClientGameData data;
        private MemoryProfileStorage storage;

        [UnitySetUp]
        public IEnumerator OpenScene()
        {
            originalFactory = FirstPlayableController.SessionFactory;
            data = ClientGameData.FromResources();
            storage = new MemoryProfileStorage();
            FirstPlayableController.SessionFactory = () => new UnityGameSession(data, storage, new SystemUtcClock());
            yield return SceneManager.LoadSceneAsync("FirstPlayable");
            view = UnityEngine.Object.FindAnyObjectByType<FirstPlayableController>();
        }

        [UnityTearDown]
        public IEnumerator Restore()
        {
            FirstPlayableController.SessionFactory = originalFactory;
            if (view != null) view.ReturnToMenu();
            yield return null;
        }

        private void Click(string name)
        {
            var button = view.GetComponentsInChildren<Button>().Single(b => b.gameObject.name == name);
            Assert.That(button.interactable, Is.True, name);
            button.onClick.Invoke();
        }

        private void TapCell(int index)
        {
            var cell = view.Session.Level.cells[index];
            var xy = MobileLayout.Axial(cell.q, cell.r);
            var e = new PointerEventData(EventSystem.current) { pointerId = 7,
                position = view.Board.BoardCamera.WorldToScreenPoint(new Vector3(xy.x, xy.y, 0)) };
            ExecuteEvents.Execute(view.Board.gameObject, e, ExecuteEvents.pointerDownHandler);
            ExecuteEvents.Execute(view.Board.gameObject, e, ExecuteEvents.pointerUpHandler);
        }

        [UnityTest]
        public IEnumerator PurchasedAndGrantedItemsRequireValidPreviewAndRestoreTheirBoard()
        {
            var session = view.Session;
            // Earn both unlocks and gold via the selected variant's real authored route.
            for (int i = 0; i < 6; i++)
            {
                int stage = session.TutorialCount + i;
                Assert.That(session.EnterStage(stage), Is.True, session.LastError);
                if (i == 0) Assert.That(session.InventoryOffer("greenBrush").Unlocked, Is.False);
                var game = W.Required(storage.Read(ProfileRepository.ProfileKey), "game");
                var attempt = W.Required(W.Required(game, "attempts"), stage.ToString());
                var level = data.Catalog.ResolveLevelWire(W.Required(attempt, "levelId"), (string)W.Required(attempt, "variantId"),
                    (string)W.Required(attempt, "levelDataVersion"));
                var route = W.List(W.Required(level, "solutions"))[0];
                foreach (var step in W.List(route))
                {
                    var pair = W.List(step);
                    Assert.That(session.TrySwap(W.Int32(pair[0]), W.Int32(pair[1])).Ok, Is.True, session.LastError);
                    session.CompletePresentation();
                }
                Assert.That(session.Status, Is.EqualTo("won"));
                session.ReturnToMenu();
            }

            int seventh = session.TutorialCount + 6;
            view.BeginStage(seventh);
            yield return null;
            Click("Çanta"); Click("70 Altınla +1 al"); Click("Vazgeç");
            Assert.That(session.InventoryOffer("greenBrush").Stock, Is.EqualTo(3));
            Click("70 Altınla +1 al"); Click("Satın al");
            Assert.That(session.InventoryOffer("greenBrush").Stock, Is.EqualTo(4));
            int firstLayer = Array.FindIndex(session.Snapshot.layers, x => x > 0);
            var stale = session.PreviewInventoryItem("greenBrush", firstLayer, null);
            Assert.That(stale, Is.Not.Null);
            session.Suspend();
            Assert.That(session.ConfirmInventoryItem(stale), Is.Null, "Changed revision must invalidate the quote.");
            Assert.That(session.InventoryOffer("greenBrush").Stock, Is.EqualTo(4));
            Click("Hücre seç");
            int cell = Array.FindIndex(session.Snapshot.layers, x => x > 0);
            int startLayer = session.Snapshot.layers[cell], moves = session.Snapshot.movesLeft;
            TapCell(cell); Click("Vazgeç");
            Assert.That(session.Snapshot.layers[cell], Is.EqualTo(startLayer));
            Click("Çanta"); Click("Hücre seç"); TapCell(cell);
            view.OnWebVisibilityChanged("hidden");
            Assert.That(view.CurrentScreen, Is.EqualTo("paused"));
            Assert.That(session.InventoryOffer("greenBrush").Stock, Is.EqualTo(4));
            view.Resume();
            Click("Çanta"); Click("Hücre seç"); TapCell(cell); Click("1 Yeşil Fırça kullan");
            Assert.That(session.Snapshot.layers[cell], Is.EqualTo(startLayer - 1));
            Assert.That(session.InventoryOffer("greenBrush").Stock, Is.EqualTo(3));
            Assert.That(session.InventoryOffer("greenBrush").CanUse, Is.False);

            Click("Çanta"); Click("Taş seç"); TapCell(cell);
            int value = session.Level.palette.First(x => x != session.Snapshot.values[cell]);
            Click(value.ToString()); Click("1 Renk Anahtarı kullan");
            float deadline = Time.realtimeSinceStartup + 15;
            while (view.Board.IsAnimating && Time.realtimeSinceStartup < deadline) yield return null;
            Assert.That(session.IsPresenting, Is.False);
            Assert.That(session.InventoryOffer("colorKey").Stock, Is.EqualTo(2));
            Assert.That(session.Snapshot.movesLeft, Is.EqualTo(moves));

            var expected = session.Snapshot;
            view.ReturnToMenu();
            var restored = new UnityGameSession(data, storage, new SystemUtcClock());
            Assert.That(restored.EnterStage(seventh), Is.True, restored.LastError);
            CollectionAssert.AreEqual(expected.values, restored.Snapshot.values);
            CollectionAssert.AreEqual(expected.layers, restored.Snapshot.layers);
            Assert.That(restored.InventoryOffer("colorKey").CanUse, Is.False);
            var hint = restored.RequestHint();
            Assert.That(hint, Is.Not.Null);
            var swap = restored.TrySwap(hint[0], hint[1]);
            Assert.That(swap.Ok, Is.True, swap.Reason);
            Assert.That(swap.After.turn, Is.EqualTo(expected.turn + 1));
        }
    }
}
