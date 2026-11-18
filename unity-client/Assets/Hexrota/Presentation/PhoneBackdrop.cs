using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace Hexrota.UnityClient.Presentation
{
    // Capture the view under the sheet once. Static dialogs do not copy or blur
    // the screen again until their viewport changes.
    [RequireComponent(typeof(CanvasGroup))]
    public sealed class PhoneBackdrop : MonoBehaviour
    {
        private CanvasGroup group;
        private RawImage blurred;
        private RenderTexture snapshot;
        private Coroutine pending;
        private Material filter;
        private Vector2Int size;

        public static void Show(GameObject overlay)
        {
            if (UnityEngine.Application.isBatchMode || SystemInfo.graphicsDeviceType ==
                UnityEngine.Rendering.GraphicsDeviceType.Null) return;
            var effect = overlay.GetComponent<PhoneBackdrop>();
            if (effect == null) effect = overlay.AddComponent<PhoneBackdrop>();
            if (effect.snapshot == null && effect.pending == null) effect.Request();
        }

        private void Request()
        {
            if (filter == null)
            {
                var shader = Resources.Load<Shader>("PhoneArt/DialogSnapshot");
                if (shader == null || !shader.isSupported) return;
                filter = new Material(shader);
            }
            size = new Vector2Int(Screen.width, Screen.height);
            group = GetComponent<CanvasGroup>();
            group.alpha = 0;
            pending = StartCoroutine(Capture());
        }

        private IEnumerator Capture()
        {
            yield return new WaitForEndOfFrame();
            RenderTexture source = null;
            var previous = RenderTexture.active;
            try
            {
                if (size.x <= 1 || size.y <= 1) yield break;
                source = RenderTexture.GetTemporary(size.x, size.y, 0, RenderTextureFormat.ARGB32);
                ScreenCapture.CaptureScreenshotIntoRenderTexture(source);
                // CSS blur(4px) is measured on a 390px-wide design viewport.
                // Each half-size bilinear pass averages four neighboring texels.
                while (source.width > 112)
                {
                    var next = RenderTexture.GetTemporary(Mathf.Max(1,source.width / 2),
                        Mathf.Max(1,source.height / 2), 0, RenderTextureFormat.ARGB32);
                    source.filterMode = FilterMode.Bilinear;
                    Graphics.Blit(source, next);
                    RenderTexture.ReleaseTemporary(source);
                    source = next;
                }
                FreeTexture();
                snapshot = RenderTexture.GetTemporary(source.width, source.height, 0, RenderTextureFormat.ARGB32);
                Graphics.Blit(source, snapshot, filter);
                snapshot.filterMode = FilterMode.Bilinear;
                snapshot.wrapMode = TextureWrapMode.Clamp;
                if (blurred == null)
                {
                    var layer = new GameObject("BlurredBackground", typeof(RectTransform), typeof(RawImage));
                    layer.transform.SetParent(transform, false);
                    layer.transform.SetAsFirstSibling();
                    blurred = layer.GetComponent<RawImage>();
                    blurred.raycastTarget = false;
                    Stretch(blurred.rectTransform);
                    var shade = new GameObject("Scrim", typeof(RectTransform), typeof(Image)).GetComponent<Image>();
                    shade.transform.SetParent(layer.transform, false);
                    shade.raycastTarget = false;
                    shade.color = GetComponent<Image>().color;
                    Stretch(shade.rectTransform);
                }
                var safe = Screen.safeArea;
                var uv = new Rect(safe.x/size.x,safe.y/size.y,safe.width/size.x,safe.height/size.y);
                if (SystemInfo.graphicsUVStartsAtTop) uv = new Rect(uv.x,1-uv.y,uv.width,-uv.height);
                blurred.uvRect = uv;
                blurred.texture = snapshot;
                blurred.gameObject.SetActive(true);
            }
            finally
            {
                RenderTexture.active = previous;
                if (source != null) RenderTexture.ReleaseTemporary(source);
                group.alpha = 1;
                pending = null;
            }
        }

        private static void Stretch(RectTransform rect)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = rect.offsetMax = Vector2.zero;
        }

        private void LateUpdate()
        {
            if (snapshot != null && pending == null && (Screen.width != size.x || Screen.height != size.y))
                Request();
        }

        private void FreeTexture()
        {
            if (blurred != null) blurred.texture = null;
            if (snapshot != null) RenderTexture.ReleaseTemporary(snapshot);
            snapshot = null;
        }

        private void OnDisable()
        {
            if (pending != null) StopCoroutine(pending);
            pending = null;
            if (group != null) group.alpha = 1;
            if (blurred != null) blurred.gameObject.SetActive(false);
            FreeTexture();
        }

        private void OnDestroy()
        {
            if (filter != null) Destroy(filter);
        }
    }
}
