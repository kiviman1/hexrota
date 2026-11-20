using System.Collections;
using Hexrota.UnityClient.Presentation;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace Hexrota.UnityClientTests
{
    public sealed class CastleHomeFlagClothTests : PlayModeTest
    {
        private static VertexHelper Quad()
        {
            var mesh = new VertexHelper();
            var v = UIVertex.simpleVert;
            v.position = new Vector3(0, 0); v.uv0 = new Vector2(0, 0); mesh.AddVert(v);
            v.position = new Vector3(0, 40); v.uv0 = new Vector2(0, 1); mesh.AddVert(v);
            v.position = new Vector3(100, 40); v.uv0 = new Vector2(1, 1); mesh.AddVert(v);
            v.position = new Vector3(100, 0); v.uv0 = new Vector2(1, 0); mesh.AddVert(v);
            mesh.AddTriangle(0, 1, 2); mesh.AddTriangle(2, 3, 0);
            return mesh;
        }

        [UnityTest]
        public IEnumerator ClothWavesIndependentlyAndItsPoleEdgeStaysFixed()
        {
            var go = new GameObject("StaticCastle", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            try
            {
                var castle = go.GetComponent<Image>();
                castle.sprite = Resources.Load<Sprite>("CastleHome/Layers/CastleWithoutCharacters");
                Assert.That(castle.sprite, Is.Not.Null);
                var cloth = new GameObject("FlagCloth", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
                cloth.transform.SetParent(go.transform, false);
                var image = cloth.GetComponent<Image>();
                image.sprite = Resources.Load<Sprite>("CastleHome/Layers/FlagCloth");
                image.raycastTarget = false;
                var layer = cloth.AddComponent<CastleHomeFlagCloth>();
                Assert.That(layer, Is.Not.Null);
                Assert.That(image.sprite, Is.Not.Null);
                Assert.That(layer.transform.parent, Is.EqualTo(castle.transform));
                Assert.That(layer.GetComponent<Image>().raycastTarget, Is.False);
                Assert.That(go.GetComponent<BaseMeshEffect>(), Is.Null, "The castle must never receive a deformation effect.");
                var initialPosition = castle.rectTransform.localPosition;
                var first = new UIVertex(); var second = new UIVertex();
                var firstAnchor = new UIVertex(); var secondAnchor = new UIVertex();
                using (var mesh = Quad())
                {
                    layer.ModifyMesh(mesh);
                    mesh.PopulateUIVertex(ref firstAnchor, 0);
                    mesh.PopulateUIVertex(ref first, 24);
                }
                yield return new WaitForSecondsRealtime(.35f);
                using (var mesh = Quad())
                {
                    layer.ModifyMesh(mesh);
                    mesh.PopulateUIVertex(ref secondAnchor, 0);
                    mesh.PopulateUIVertex(ref second, 24);
                }
                Assert.That(secondAnchor.position, Is.EqualTo(firstAnchor.position));
                Assert.That(second.position, Is.Not.EqualTo(first.position));
                Assert.That(castle.rectTransform.localPosition, Is.EqualTo(initialPosition));
            }
            finally { Object.Destroy(go); }
        }
    }
}
