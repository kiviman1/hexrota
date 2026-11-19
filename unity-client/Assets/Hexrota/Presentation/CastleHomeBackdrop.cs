using UnityEngine;
using UnityEngine.Sprites;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Cover the phone without stretching the illustration. The focal point is
    // normalized within the amount cropped off each edge.
    [RequireComponent(typeof(Image))]
    public sealed class CastleHomeBackdrop : BaseMeshEffect
    {
        [SerializeField] private Vector2 focalPoint = new Vector2(.5f, .5f);
        private RectTransform safeArea;
        private RectTransform screenArea;
        private Vector4 edgeOffsets;

        protected override void OnEnable()
        {
            base.OnEnable();
            var controller = GetComponentInParent<FirstPlayableController>();
            safeArea = controller != null ? controller.SafeArea : null;
            var canvas = graphic.canvas;
            screenArea = canvas != null ? (RectTransform)canvas.rootCanvas.transform : null;
            edgeOffsets = Vector4.zero;
            Canvas.preWillRenderCanvases += RefreshEdges;
            RefreshEdges();
        }

        protected override void OnDisable()
        {
            Canvas.preWillRenderCanvases -= RefreshEdges;
            base.OnDisable();
        }

        private void RefreshEdges()
        {
            if (safeArea == null || screenArea == null || graphic == null) return;
            var local = graphic.rectTransform;
            Vector2 lower = local.InverseTransformVector(screenArea.TransformPoint(screenArea.rect.min) -
                                                         safeArea.TransformPoint(safeArea.rect.min));
            Vector2 upper = local.InverseTransformVector(screenArea.TransformPoint(screenArea.rect.max) -
                                                         safeArea.TransformPoint(safeArea.rect.max));
            var offsets = new Vector4(Mathf.Min(0, lower.x), Mathf.Min(0, lower.y),
                                      Mathf.Max(0, upper.x), Mathf.Max(0, upper.y));
            if ((offsets - edgeOffsets).sqrMagnitude < .000001f) return;
            edgeOffsets = offsets;
            graphic.SetVerticesDirty();
        }

        public override void ModifyMesh(VertexHelper mesh)
        {
            if (!IsActive()) return;
            var image = (Image)graphic;
            Sprite sprite = image.overrideSprite;
            Rect rect = image.rectTransform.rect;
            if (sprite == null || image.type != Image.Type.Simple || rect.height <= 0 || rect.width <= 0) return;
            // Extend only the illustration into the notch and home-indicator margins.
            // The authored Image rect, its focal point and the UI hit areas stay editable.
            Rect display = Rect.MinMaxRect(rect.xMin + edgeOffsets.x, rect.yMin + edgeOffsets.y,
                                          rect.xMax + edgeOffsets.z, rect.yMax + edgeOffsets.w);
            float ratio = (display.width / display.height) / (sprite.rect.width / sprite.rect.height);
            Vector2 visible = new Vector2(Mathf.Min(1f, ratio), Mathf.Min(1f, 1f / ratio));
            Vector4 bounds = DataUtility.GetOuterUV(sprite);
            var vertex = new UIVertex();
            for (int i = 0; i < mesh.currentVertCount; i++)
            {
                mesh.PopulateUIVertex(ref vertex, i);
                float x = Mathf.InverseLerp(rect.xMin, rect.xMax, vertex.position.x);
                float y = Mathf.InverseLerp(rect.yMin, rect.yMax, vertex.position.y);
                vertex.position = new Vector3(Mathf.Lerp(display.xMin, display.xMax, x),
                                              Mathf.Lerp(display.yMin, display.yMax, y), vertex.position.z);
                vertex.uv0 = new Vector2(
                    Mathf.Lerp(bounds.x, bounds.z, x * visible.x + Mathf.Clamp01(focalPoint.x) * (1f - visible.x)),
                    Mathf.Lerp(bounds.y, bounds.w, y * visible.y + Mathf.Clamp01(focalPoint.y) * (1f - visible.y)));
                mesh.SetUIVertex(vertex, i);
            }
        }
    }
}
